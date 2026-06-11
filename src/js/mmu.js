import {
    TL_A_Opcode,
    TL_D_Opcode,
    getOpcodeName,
    getTransferSizeLog2,
    isTileLinkAtomic,
    isTileLinkRead,
    isTileLinkWrite
} from './tilelink.js';
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

function describeOpcode(type, channel = 'A') {
    if (typeof type !== 'number') return type;
    return getOpcodeName(channel === 'D' ? TL_D_Opcode : TL_A_Opcode, type);
}

function describeEndpoint(endpoint, fallback = 'lower') {
    return endpoint?.lower?.name ?? endpoint?.name ?? endpoint?.constructor?.name ?? fallback;
}

export class MMU {
    constructor(upperPort = null, lowerPort = null, { pageSize = 4096, cacheabilityPredicate = () => true, tlbSize = 8, tlbWays = 2 } = {}) {
        // MMU nằm giữa CPU và hệ thống cache/bộ nhớ cấp thấp.
        // Nó biên dịch địa chỉ ảo, thực thi các quyền, và gắn thẻ
        // yêu cầu với thông tin khả năng lưu đệm (cacheability) cho các cấp thấp hơn.

        // Kiểm tra và validate cấu hình MMU / TLB
        if ((pageSize & (pageSize - 1)) !== 0 || pageSize <= 0) {
            throw new Error(`Invalid page size: ${pageSize}. Must be a power of two.`);
        }
        const tlbSizeVal = tlbSize ?? 8;
        const tlbWaysVal = tlbWays === 'fully' ? tlbSizeVal : (parseInt(tlbWays) || 4);
        if (tlbSizeVal <= 0 || tlbWaysVal <= 0) {
            throw new Error(`TLB size and associativity must be positive values.`);
        }
        if (tlbSizeVal % tlbWaysVal !== 0) {
            throw new Error(`TLB size (${tlbSizeVal}) must be divisible by associativity (${tlbWaysVal}).`);
        }
        if (tlbWaysVal > tlbSizeVal) {
            throw new Error(`TLB associativity (${tlbWaysVal}) cannot exceed TLB size (${tlbSizeVal}).`);
        }

        this.upperPort = upperPort;
        this.lowerPort = lowerPort;
        this.instructionLowerPort = lowerPort;
        this.dataLowerPort = lowerPort;
        this.pageSize = pageSize;
        this.cacheabilityPredicate = cacheabilityPredicate;

        this.tlbSize = tlbSizeVal;
        this.tlbWays = tlbWaysVal;
        this.tlbSets = Math.max(1, Math.floor(tlbSizeVal / tlbWaysVal));

        this.pageTable = new Map();

        // Khởi tạo các block vật lý cho TLB (Set-Associative)
        this.tlbBlocks = Array.from({ length: this.tlbSize }, (_, id) => {
            const set = Math.floor(id / this.tlbWays);
            const way = id % this.tlbWays;
            return {
                id,
                set,
                way,
                valid: false,
                vpn: null,
                virtualBase: 0,
                physicalBase: 0,
                read: false,
                write: false,
                execute: false,
                cacheable: false,
                lastReference: 0
            };
        });

        this.referenceCounter = 0;
        this.translationHistory = [];
        this.lastTranslation = null;
        this.stats = this._createStats();
    }

    attachUpperPort(upperPort) {
        this.upperPort = upperPort;
    }

    attachLowerPort(lowerPort) {
        this.lowerPort = lowerPort;
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
        const normalizedVirtualBase = this._getPageBase(virtualBase);
        const normalizedPhysicalBase = this._getPageBase(physicalBase);
        const entry = {
            virtualBase: normalizedVirtualBase,
            physicalBase: normalizedPhysicalBase,
            read: permissions.read !== false,
            write: permissions.write !== false,
            execute: permissions.execute !== false,
            cacheable: permissions.cacheable !== false,
            lastReference: 0
        };

        const vpn = this._getPageNumber(entry.virtualBase);
        this.pageTable.set(vpn, entry);
        this._invalidateTlbVpn(vpn);
    }

    unmapPage(virtualBase) {
        const vpn = this._getPageNumber(virtualBase >>> 0);
        this.pageTable.delete(vpn);
        this._invalidateTlbVpn(vpn);
    }

    clearMappings() {
        this.pageTable.clear();
        for (const block of this.tlbBlocks) {
            this._resetTlbBlock(block);
        }
    }

    reset() {
        this.referenceCounter = 0;
        this.translationHistory = [];
        this.lastTranslation = null;
        this.stats = this._createStats();

        for (const block of this.tlbBlocks) {
            this._resetTlbBlock(block);
        }

        for (const entry of this.pageTable.values()) {
            entry.lastReference = 0;
        }
    }

    receiveRequest(req) {
        const from = req.from ?? 'cpu';
        const lowerPort = this._resolveLowerPort(req.type);
        if (!lowerPort || typeof lowerPort.receiveRequest !== 'function') {
            throw new Error('MMU has no attached lower port');
        }

        // Các yêu cầu từ CPU đến với một địa chỉ ảo. Sau khi biên dịch,
        // cổng cấp thấp nhận một địa chỉ vật lý, trong khi VA gốc được giữ lại
        // để đường dẫn phản hồi vẫn có thể trả về đúng địa chỉ lúc đầu của CPU.
        const accessType = classifyAccess(req.type);
        let translated;
        try {
            translated = this.translateAddress(req.address, accessType);
        } catch (error) {
            // Truy cập lỗi quyền không bao giờ đến được dòng log REQUEST bên dưới,
            // nên cần một dòng [MMU] riêng để fault hiển thị trong Systems Log Console.
            console.warn(`[MMU] FAULT from=${from} type=${describeOpcode(req.type)} access=${accessType}: ${error.message}`);
            throw error;
        }
        const targetName = describeEndpoint(lowerPort, req.type === 'fetch' ? 'instruction-cache' : 'data-cache');

        console.log(
            `[MMU] REQUEST from=${from} type=${describeOpcode(req.type)} access=${accessType} ` +
            `va=0x${(req.address >>> 0).toString(16)} -> pa=0x${translated.physicalAddress.toString(16)} ` +
            `mode=${translated.mode} src=${translated.source} cacheable=${translated.cacheable} next=${targetName}`
        );

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

    sendRequest(from, req) {
        this.receiveRequest({
            ...req,
            from
        });
    }

    receiveResponse(resp) {
        if (!this.upperPort || typeof this.upperPort.receiveResponse !== 'function') {
            throw new Error('MMU has no attached CPU');
        }

        // Các cấp thấp hơn có thể phản hồi bằng địa chỉ vật lý đã được biên dịch; CPU
        // nên tiếp tục xử lý dựa trên địa chỉ ảo gốc.
        const virtualAddress = resp.virtualAddress ?? resp.address;
        console.log(
            `[MMU] RESPONSE from=${resp.from} to=${resp.to} type=${describeOpcode(resp.type, 'D')} ` +
            `pa=0x${(resp.address >>> 0).toString(16)} -> va=0x${(virtualAddress >>> 0).toString(16)} ` +
            `data=${resp.data ?? ''}`
        );

        this.upperPort.receiveResponse({
            ...resp,
            address: virtualAddress
        });
    }

    translateAddress(address, accessType) { //='read'|'write'|'execute'
        const va = address >>> 0;
        const vpn = this._getPageNumber(va);
        const offset = va & (this.pageSize - 1);

        this.stats.translations++;

        // Tìm kiếm trong các blocks TLB (Hardware cache)
        const block = this._findTlbBlock(vpn);

        let entry = null;
        let source = 'tlb';
        if (block) {
            this.stats.tlbHits++;
            entry = block;
            block.lastReference = this._touchEntry(block);
        } else {
            this.stats.tlbMisses++;
            entry = this.pageTable.get(vpn);
            source = entry ? 'page-table' : 'identity';
            if (entry) {
                // Lượt hit bảng phân trang phần mềm sẽ được nạp lại vào TLB nhỏ.
                this.stats.pageTableHits++;
                entry.lastReference = this._touchEntry(entry);
                this._insertIntoTlb(vpn, entry);
            }
        }

        if (!entry) {
            // Các chương trình bare-metal trong dự án này có thể chạy mà không cần thiết lập
            // bảng phân trang. Địa chỉ không được ánh xạ do đó sẽ chuyển về VA == PA.
            this.stats.identityFallbacks++;
            const lastReference = this._nextReference();
            const result = {
                virtualAddress: va,
                physicalAddress: va,
                cacheable: !!this.cacheabilityPredicate(va),
                mode: 'identity',
                vpn,
                offset,
                source,
                lastReference
            };
            this._recordTranslation({
                ...result,
                accessType,
                result: 'ok'
            });
            return result;
        }

        try {
            this._assertPermission(entry, accessType, va);
        } catch (error) {
            this._recordTranslation({
                virtualAddress: va,
                physicalAddress: null,
                cacheable: entry.cacheable,
                mode: 'fault',
                vpn,
                offset,
                source,
                accessType,
                result: error.message,
                lastReference: entry.lastReference
            });
            throw error;
        }

        const physicalAddress = (entry.physicalBase + offset) >>> 0;
        const lastReference = entry.lastReference;
        const result = {
            virtualAddress: va,
            physicalAddress,
            cacheable: entry.cacheable && !!this.cacheabilityPredicate(physicalAddress),
            mode: 'mapped',
            vpn,
            offset,
            source,
            lastReference
        };
        this._recordTranslation({
            ...result,
            accessType,
            result: 'ok'
        });
        return result;
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

    _getPageBase(address) {
        return ((address >>> 0) & ~(this.pageSize - 1)) >>> 0;
    }

    _createStats() {
        return {
            translations: 0,
            tlbHits: 0,
            tlbMisses: 0,
            tlbRefills: 0,
            tlbEvictions: 0,
            pageTableHits: 0,
            identityFallbacks: 0
        };
    }

    _nextReference() {
        this.referenceCounter++;
        return this.referenceCounter;
    }

    _touchEntry(entry) {
        entry.lastReference = this._nextReference();
        return entry.lastReference;
    }

    _recordTranslation(record) {
        this.lastTranslation = record;
        this.translationHistory.unshift(record);
        if (this.translationHistory.length > 32) {
            this.translationHistory.pop();
        }
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

    _findTlbBlock(vpn) {
        const setIndex = vpn % this.tlbSets;
        const setStart = setIndex * this.tlbWays;
        const setEnd = setStart + this.tlbWays;

        for (let i = setStart; i < setEnd; i++) {
            const block = this.tlbBlocks[i];
            if (block.valid && block.vpn === vpn) {
                return block;
            }
        }
        return null;
    }

    _resetTlbBlock(block) {
        block.valid = false;
        block.vpn = null;
        block.virtualBase = 0;
        block.physicalBase = 0;
        block.read = false;
        block.write = false;
        block.execute = false;
        block.cacheable = false;
        block.lastReference = 0;
    }

    _invalidateTlbVpn(vpn) {
        for (const block of this.tlbBlocks) {
            if (block.vpn === vpn) {
                this._resetTlbBlock(block);
            }
        }
    }

    _insertIntoTlb(vpn, entry) {
        const setIndex = vpn % this.tlbSets;
        const setStart = setIndex * this.tlbWays;
        const setEnd = setStart + this.tlbWays;

        let block = this._findTlbBlock(vpn);
        let refilled = false;
        // Kiểm tra xem vpn này đã tồn tại trong Set chưa
        if (!block) {
            // Tìm block trống (invalid)
            for (let i = setStart; i < setEnd; i++) {
                if (!this.tlbBlocks[i].valid) {
                    block = this.tlbBlocks[i];
                    break;
                }
            }

            // Nếu đầy Set, chọn block LRU để thay thế (lastReference nhỏ nhất)
            if (!block) {
                let lruBlock = this.tlbBlocks[setStart];
                for (let i = setStart + 1; i < setEnd; i++) {
                    if (this.tlbBlocks[i].lastReference < lruBlock.lastReference) {
                        lruBlock = this.tlbBlocks[i];
                    }
                }
                block = lruBlock;
                this.stats.tlbEvictions++;
                console.log(`[MMU] TLB EVICTION: set=${setIndex} way=${block.way} vpn=0x${block.vpn.toString(16)} evicted for vpn=0x${vpn.toString(16)}`);
            }
            refilled = true;
        }

        block.valid = true;
        block.vpn = vpn;
        block.virtualBase = entry.virtualBase;
        block.physicalBase = entry.physicalBase;
        block.read = entry.read;
        block.write = entry.write;
        block.execute = entry.execute;
        block.cacheable = entry.cacheable;
        block.lastReference = entry.lastReference;

        if (refilled) {
            this.stats.tlbRefills++;
        }
        return block;
    }
}
