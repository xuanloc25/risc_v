import { getTransferSizeLog2, isTileLinkAtomic, isTileLinkRead, isTileLinkWrite } from './tilelink.js';
import { attachPort } from './port_link.js';

// Translate the bus operation into the permission domain checked by the MMU.
// In this simulator, instruction fetches use execute permission, loads use read,
// and stores/atomics use write.
function classifyAccess(type) {
    if (type === 'fetch') return 'execute';
    if (isTileLinkRead(type)) return 'read';
    if (isTileLinkWrite(type) || isTileLinkAtomic(type)) return 'write';
    return 'read';
}

export class MMU {
    constructor(upperPort = null, lowerPort = null, { pageSize = 4096, cacheabilityPredicate = () => true } = {}) {
        // The MMU sits between the CPU and the cache/lower memory system.
        // It translates virtual addresses, enforces permissions, and tags
        // requests with cacheability information for lower levels.
        this.upperPort = upperPort;
        this.lowerPort = lowerPort;
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
    }

    attachCPU(cpu) {
        attachPort(cpu, this, 'cpu-to-mmu');
    }

    setCacheabilityPredicate(predicate) {
        this.cacheabilityPredicate = predicate ?? (() => true);
    }

    mapPage(virtualBase, physicalBase, permissions = {}) {
        // This simulator keeps a very small software-managed page table and TLB.
        // A new mapping is inserted into both for immediate use.
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
        if (!this.lowerPort || typeof this.lowerPort.receiveRequest !== 'function') {
            throw new Error('MMU has no attached lower port');
        }

        // CPU-visible requests arrive with a virtual address. After translation,
        // the lower port sees a physical address, while the original VA is kept
        // so the response path can still report the CPU-facing address.
        const accessType = classifyAccess(req.type);
        const translated = this.translateAddress(req.address, accessType);

        this.lowerPort.receiveRequest({
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

        // Lower levels may respond using the translated physical address; the CPU
        // should keep reasoning in terms of the original virtual address.
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
                // A software page-table hit refills the tiny TLB.
                this.stats.pageTableHits++;
                this.tlb.set(vpn, entry);
            }
        }

        if (!entry) {
            // Bare-metal programs in this project can run without setting up page
            // tables. Unmapped addresses therefore fall back to VA == PA.
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
        if (this.lowerPort?.mem) return this.lowerPort.mem;
        if (typeof this.lowerPort?.memBytes === 'function') return this.lowerPort.memBytes();
        throw new Error('MMU cannot expose backing memory bytes');
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
