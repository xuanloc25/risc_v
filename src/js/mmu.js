import { getTransferSizeLog2, isTileLinkAtomic, isTileLinkRead, isTileLinkWrite } from './tilelink.js';

function classifyAccess(type) {
    if (type === 'fetch') return 'execute';
    if (isTileLinkRead(type)) return 'read';
    if (isTileLinkWrite(type) || isTileLinkAtomic(type)) return 'write';
    return 'read';
}

export class MMU {
    constructor(cpu = null, lowerPort = null, { pageSize = 4096, cacheabilityPredicate = () => true } = {}) {
        this.cpu = cpu;
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

    attachCPU(cpu) {
        this.cpu = cpu;
    }

    attachLowerPort(lowerPort) {
        this.lowerPort = lowerPort;
    }

    setCacheabilityPredicate(predicate) {
        this.cacheabilityPredicate = predicate ?? (() => true);
    }

    mapPage(virtualBase, physicalBase, permissions = {}) {
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
        if (!this.cpu || typeof this.cpu.receiveResponse !== 'function') {
            throw new Error('MMU has no attached CPU');
        }

        this.cpu.receiveResponse({
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
                this.stats.pageTableHits++;
                this.tlb.set(vpn, entry);
            }
        }

        if (!entry) {
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
        if (this.lowerPort?.mem) return this.lowerPort.mem;
        if (typeof this.lowerPort?.memBytes === 'function') return this.lowerPort.memBytes();
        if (this.lowerPort?.lowerLevel?.mem) return this.lowerPort.lowerLevel.mem;
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
