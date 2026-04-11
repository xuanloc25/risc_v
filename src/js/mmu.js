import { getTransferSizeLog2, isTileLinkAtomic, isTileLinkRead, isTileLinkWrite } from './tilelink.js';
import { attachPort } from './port_link.js';

// Chuyển đổi thao tác bus sang miền quyền được kiểm tra bởi MMU.
// Trong trình giả lập này, lấy lệnh dùng quyền execute, tải dùng read,
// và lưu trữ/nguyên tử (atomics) dùng write.
function classifyAccess(type) {
    if (type === 'fetch') return 'execute';
    if (isTileLinkRead(type)) return 'read';
    if (isTileLinkWrite(type) || isTileLinkAtomic(type)) return 'write';
    return 'read';
}

export class MMU {
    constructor(upperPort = null, lowerPort = null, { pageSize = 4096, cacheabilityPredicate = () => true } = {}) {
        // MMU nằm giữa CPU và hệ thống cache/bộ nhớ cấp thấp.
        // Nó biên dịch địa chỉ ảo, thực thi các quyền, và gắn thẻ
        // yêu cầu với thông tin khả năng lưu đệm (cacheability) cho các cấp thấp hơn.
        this.upperPort = upperPort;
        this.lowerPort = lowerPort;
        this.instructionLowerPort = lowerPort;
        this.dataLowerPort = lowerPort;
        this.pageSize = pageSize;
        this.cacheabilityPredicate = cacheabilityPredicate;

        this.pageTable = new Map();
        this.tlb = new Map();
        this.stats = {
            translations: 0,
            tlbHits: 0,
            pageTableHits: 0,
            identityFallbacks: 0
        };
    }

    attachUpperPort(upperPort) {
        this.upperPort = upperPort;
    }

    attachLowerPort(lowerPort) {
        this.lowerPort = lowerPort;
        this.instructionLowerPort = lowerPort;
        this.dataLowerPort = lowerPort;
    }

    attachInstructionLowerPort(lowerPort) {
        this.instructionLowerPort = lowerPort;
    }

    attachDataLowerPort(lowerPort) {
        this.dataLowerPort = lowerPort;
    }

    attachCPU(cpu) {
        attachPort(cpu, this, 'cpu-to-mmu');
    }

    setCacheabilityPredicate(predicate) {
        this.cacheabilityPredicate = predicate ?? (() => true);
    }

    mapPage(virtualBase, physicalBase, permissions = {}) {
        // Trình giả lập này giữ một bảng phân trang và TLB rất nhỏ được quản lý bằng phần mềm.
        // Một ánh xạ mới được chèn vào cả hai để sử dụng ngay lập tức.
        const entry = {
            virtualBase: virtualBase >>> 0,
            physicalBase: physicalBase >>> 0,
            read: permissions.read !== false,
            write: permissions.write !== false,
            execute: permissions.execute !== false,
            cacheable: permissions.cacheable !== false
        };

        const vpn = this._getPageNumber(entry.virtualBase);
        this.pageTable.set(vpn, entry);
        this.tlb.set(vpn, entry);
    }

    unmapPage(virtualBase) {
        const vpn = this._getPageNumber(virtualBase >>> 0);
        this.pageTable.delete(vpn);
        this.tlb.delete(vpn);
    }

    clearMappings() {
        this.pageTable.clear();
        this.tlb.clear();
    }

    reset() {
        this.tlb.clear();
        this.stats = {
            translations: 0,
            tlbHits: 0,
            pageTableHits: 0,
            identityFallbacks: 0
        };
    }

    sendRequest(from, req) {
        const lowerPort = this._resolveLowerPort(req.type);
        if (!lowerPort || typeof lowerPort.receiveRequest !== 'function') {
            throw new Error('MMU has no attached lower port');
        }

        // Các yêu cầu từ CPU đến với một địa chỉ ảo. Sau khi biên dịch,
        // cổng cấp thấp nhận một địa chỉ vật lý, trong khi VA gốc được giữ lại
        // để đường dẫn phản hồi vẫn có thể trả về đúng địa chỉ lúc đầu của CPU.
        const accessType = classifyAccess(req.type);
        const translated = this.translateAddress(req.address, accessType);

        lowerPort.receiveRequest({
            ...req,
            from,
            replyTo: this,
            size: getTransferSizeLog2(req, 2),
            virtualAddress: req.address >>> 0,
            address: translated.physicalAddress >>> 0,
            cacheable: translated.cacheable,
            translation: translated
        });
    }

    receiveResponse(resp) {
        if (!this.upperPort || typeof this.upperPort.receiveResponse !== 'function') {
            throw new Error('MMU has no attached CPU');
        }

        // Các cấp thấp hơn có thể phản hồi bằng địa chỉ vật lý đã được biên dịch; CPU
        // nên tiếp tục xử lý dựa trên địa chỉ ảo gốc.
        this.upperPort.receiveResponse({
            ...resp,
            address: resp.virtualAddress ?? resp.address
        });
    }

    translateAddress(address, accessType = 'read') {
        const va = address >>> 0;
        const vpn = this._getPageNumber(va);
        const offset = va & (this.pageSize - 1);

        this.stats.translations++;

        let entry = this.tlb.get(vpn);
        if (entry) {
            this.stats.tlbHits++;
        } else {
            entry = this.pageTable.get(vpn);
            if (entry) {
                // Lượt hit bảng phân trang phần mềm sẽ được nạp lại vào TLB nhỏ.
                this.stats.pageTableHits++;
                this.tlb.set(vpn, entry);
            }
        }

        if (!entry) {
            // Các chương trình bare-metal trong dự án này có thể chạy mà không cần thiết lập
            // bảng phân trang. Địa chỉ không được ánh xạ do đó sẽ chuyển về VA == PA.
            this.stats.identityFallbacks++;
            return {
                virtualAddress: va,
                physicalAddress: va,
                cacheable: !!this.cacheabilityPredicate(va),
                mode: 'identity'
            };
        }

        this._assertPermission(entry, accessType, va);
        return {
            virtualAddress: va,
            physicalAddress: (entry.physicalBase + offset) >>> 0,
            cacheable: entry.cacheable && !!this.cacheabilityPredicate((entry.physicalBase + offset) >>> 0),
            mode: 'mapped'
        };
    }

    memBytes() {
        // Helper for debug views/tests that want to inspect the backing memory
        // through the MMU/cache stack.
        const lowerPort = this.dataLowerPort ?? this.instructionLowerPort ?? this.lowerPort;
        if (lowerPort?.mem) return lowerPort.mem;
        if (typeof lowerPort?.memBytes === 'function') return lowerPort.memBytes();
        throw new Error('MMU cannot expose backing memory bytes');
    }

    _resolveLowerPort(type) {
        if (type === 'fetch') {
            return this.instructionLowerPort ?? this.lowerPort ?? this.dataLowerPort;
        }

        return this.dataLowerPort ?? this.lowerPort ?? this.instructionLowerPort;
    }

    _getPageNumber(address) {
        return Math.floor((address >>> 0) / this.pageSize);
    }

    _assertPermission(entry, accessType, address) {
        if (accessType === 'read' && !entry.read) {
            throw new Error(`MMU read fault at virtual address 0x${address.toString(16)}`);
        }
        if (accessType === 'write' && !entry.write) {
            throw new Error(`MMU write fault at virtual address 0x${address.toString(16)}`);
        }
        if (accessType === 'execute' && !entry.execute) {
            throw new Error(`MMU execute fault at virtual address 0x${address.toString(16)}`);
        }
    }
}
