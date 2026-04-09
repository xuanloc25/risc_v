import {
    TL_A_Opcode,
    TL_D_Opcode,
    applyTileLinkAtomic,
    getOpcodeName,
    getTransferSizeLog2,
    isTileLinkAtomic,
    isTileLinkRead,
    isTileLinkWrite,
    readSizedValue,
    writeSizedValue
} from './tilelink.js';

function formatLogNumber(value) {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value !== 'number' || Number.isNaN(value)) return String(value);
    return `${value} (0x${(value >>> 0).toString(16)})`;
}

function createEmptyStatistics() {
    return {
        numRead: 0,
        numWrite: 0,
        numHit: 0,
        numMiss: 0,
        totalCycles: 0
    };
}

export class Cache {
    constructor(lowerPort = null, policy = {}, lowerCache = null, { name = 'cache', writeBack = true, writeAllocate = true, isCacheable = () => true } = {}) {
        this.name = name;
        this.upperPort = null;
        this.lowerPort = lowerPort;
        this.lowerCache = lowerCache;
        this.policy = this._normalizePolicy(policy);
        this.writeBack = writeBack;
        this.writeAllocate = writeAllocate;
        this.isCacheable = isCacheable;
        this.enabled = true;

        this.blocks = [];
        this.referenceCounter = 0;
        this.statistics = createEmptyStatistics();

        this.pending = null;
        this.cycle = 0;

        this._initializeBlocks();
    }

    get mem() {
        if (this.lowerCache?.mem) return this.lowerCache.mem;
        if (this.lowerPort?.mem) return this.lowerPort.mem;
        if (typeof this.lowerPort?.memBytes === 'function') return this.lowerPort.memBytes();
        return {};
    }

    attachUpperPort(upperPort) {
        this.upperPort = upperPort;
    }

    attachLowerPort(lowerPort) {
        this.lowerPort = lowerPort;
    }

    setEnabled(enabled) {
        this.enabled = !!enabled;
    }

    reset() {
        for (const block of this.blocks) {
            block.valid = false;
            block.modified = false;
            block.tag = 0;
            block.lastReference = 0;
        }

        this.referenceCounter = 0;
        this.statistics = createEmptyStatistics();
        this.pending = null;
        this.cycle = 0;
    }

    receiveRequest(req) {
        if (this.pending) {
            console.warn(`[Cache:${this.name}] Busy; request dropped`);
            return;
        }

        const requestAddress = (req.virtualAddress ?? req.address) >>> 0;
        const requestType = typeof req.type === 'number' ? getOpcodeName(TL_A_Opcode, req.type) : req.type;
        console.log(`[Cache:${this.name}] REQ type=${requestType} addr=0x${requestAddress.toString(16)} value=${formatLogNumber(req.value)}`);

        if (!this.enabled) {
            this._forwardWithoutCaching(req);
            return;
        }

        if (!this._shouldCacheRequest(req)) {
            this._completeLocally(this._serveBypassRequest(req));
            return;
        }

        if (isTileLinkRead(req.type)) {
            this._handleReadRequest(req);
            return;
        }

        if (isTileLinkWrite(req.type)) {
            this._handleWriteRequest(req);
            return;
        }

        if (isTileLinkAtomic(req.type)) {
            this._handleAtomicRequest(req);
            return;
        }

        console.warn(`[Cache:${this.name}] Unsupported request type ${req.type}`);
    }

    tick(bus = null) {
        this.cycle++;
        if (!this.pending) return;

        if (this.pending.kind === 'miss') {
            this._advanceMissTransaction();
            if (!this.pending || this.pending.kind === 'miss') return;
        }

        if (this.pending.waitingForLowerResponse) return;
        if (this.cycle < this.pending.readyCycle) return;

        this._emitPendingResponse(bus);
    }

    receiveResponse(resp) {
        if (!this.pending?.waitingForLowerResponse) {
            console.warn(`[Cache:${this.name}] Unexpected lower-level response`);
            return;
        }

        if (this.pending.kind === 'miss') {
            this._finishMissTransaction(resp);
            return;
        }

        const originalReq = this.pending.originalReq;
        this.pending = {
            req: this._buildResponse(originalReq, resp.type, resp.data),
            readyCycle: this.cycle
        };
    }

    inCache(addr) {
        return this._findBlock(addr) !== null;
    }

    _shouldCacheRequest(req) {
        return req.cacheable !== false && this.isCacheable((req.address ?? 0) >>> 0);
    }

    _handleReadRequest(req) {
        this.statistics.numRead++;

        const address = req.address >>> 0;
        const block = this._findBlock(address);
        if (block) {
            this.statistics.numHit++;
            this._logHit('R', address, this.policy.hitLatency);
            this._touchBlock(block);

            const size = getTransferSizeLog2(req, 2);
            const data = this._readValueForRequest(req.type, address, size);
            this.statistics.totalCycles += this.policy.hitLatency;
            this._completeLocally({
                req,
                responseType: TL_D_Opcode.AccessAckData,
                data,
                cycles: this.policy.hitLatency
            });
            return;
        }

        this.statistics.numMiss++;
        const localCycles = this.policy.hitLatency + this.policy.missLatency;
        this._logMiss('R', address, localCycles);
        this._beginMissTransaction(req, {
            responseType: TL_D_Opcode.AccessAckData,
            refillCycles: this.policy.missLatency,
            finalizeResponse: () => {
                const size = getTransferSizeLog2(req, 2);
                return this._readValueForRequest(req.type, address, size);
            }
        });
    }

    _handleWriteRequest(req) {
        this.statistics.numWrite++;

        const address = req.address >>> 0;
        const block = this._findBlock(address);
        if (block) {
            this.statistics.numHit++;
            this._logHit('W', address, this.policy.hitLatency, req.value);
            this._writeByRequest(req);
            this.statistics.totalCycles += this.policy.hitLatency;
            this._completeLocally({
                req,
                responseType: TL_D_Opcode.AccessAck,
                data: null,
                cycles: this.policy.hitLatency
            });
            return;
        }

        this.statistics.numMiss++;
        const localCycles = this.policy.hitLatency + this.policy.missLatency;
        this._logMiss('W', address, localCycles, req.value);

        if (!this.writeAllocate) {
            this._writeThroughLower(req);
            this.statistics.totalCycles += localCycles;
            this._completeLocally({
                req,
                responseType: TL_D_Opcode.AccessAck,
                data: null,
                cycles: localCycles
            });
            return;
        }

        this._beginMissTransaction(req, {
            responseType: TL_D_Opcode.AccessAck,
            refillCycles: this.policy.missLatency,
            finalizeResponse: () => {
                this._writeByRequest(req);
                return null;
            }
        });
    }

    _handleAtomicRequest(req) {
        this.statistics.numRead++;
        this.statistics.numWrite++;

        const address = req.address >>> 0;
        const block = this._findBlock(address);
        if (block) {
            this.statistics.numHit++;
            this._touchBlock(block);

            const size = getTransferSizeLog2(req, 2);
            const oldValue = this._readValueBySize(address, size);
            const newValue = applyTileLinkAtomic(req, oldValue, size);
            this._writeValueBySize(address, newValue, size);
            this.statistics.totalCycles += this.policy.hitLatency;
            this._completeLocally({
                req,
                responseType: TL_D_Opcode.AccessAckData,
                data: oldValue,
                cycles: this.policy.hitLatency
            });
            return;
        }

        this.statistics.numMiss++;
        const localCycles = this.policy.hitLatency + this.policy.missLatency;
        this._logMiss('A', address, localCycles, req.value);
        this._beginMissTransaction(req, {
            responseType: TL_D_Opcode.AccessAckData,
            refillCycles: this.policy.missLatency,
            finalizeResponse: () => {
                const size = getTransferSizeLog2(req, 2);
                const oldValue = this._readValueBySize(address, size);
                const newValue = applyTileLinkAtomic(req, oldValue, size);
                this._writeValueBySize(address, newValue, size);
                return oldValue;
            }
        });
    }

    _serveBypassRequest(req) {
        const size = getTransferSizeLog2(req, 2);
        let responseType = TL_D_Opcode.AccessAck;
        let data = 0;

        if (isTileLinkRead(req.type)) {
            data = this._readLowerByRequest(req.address >>> 0, req.type, size);
            responseType = TL_D_Opcode.AccessAckData;
        } else if (isTileLinkWrite(req.type)) {
            this._writeLowerByRequest(req.address >>> 0, req.value ?? 0, req.type, size);
        } else if (isTileLinkAtomic(req.type)) {
            data = this._readLowerValue(req.address >>> 0, size);
            const newValue = applyTileLinkAtomic(req, data, size);
            this._writeLowerValue(req.address >>> 0, newValue, size);
            responseType = TL_D_Opcode.AccessAckData;
        }

        return {
            req,
            responseType,
            data,
            cycles: this.policy.hitLatency
        };
    }

    _forwardWithoutCaching(req) {
        const forwardedReq = this._buildForwardedRequest(req);
        this.pending = {
            originalReq: req,
            waitingForLowerResponse: true
        };

        this._dispatchToLower(forwardedReq, 'cache-off forwarding');
    }

    _beginMissTransaction(req, { responseType, refillCycles, finalizeResponse }) {
        this.pending = {
            kind: 'miss',
            originalReq: req,
            forwardedReq: this._buildForwardedRequest(req),
            responseType,
            finalizeResponse,
            startCycle: this.cycle,
            lookupReadyCycle: this.cycle + this.policy.hitLatency + 1,
            refillCycles,
            phase: 'lookup',
            waitingForLowerResponse: false
        };
    }

    _advanceMissTransaction() {
        const miss = this.pending;
        if (!miss || miss.kind !== 'miss') return;
        if (miss.phase !== 'lookup') return;
        if (this.cycle < miss.lookupReadyCycle) return;

        this._dispatchToLower(miss.forwardedReq, 'hierarchy miss');
        miss.phase = 'waiting-lower';
        miss.waitingForLowerResponse = true;
    }

    _finishMissTransaction(resp) {
        const miss = this.pending;
        const originalReq = miss.originalReq;

        this._ensureBlock(originalReq.address >>> 0);
        const data = miss.finalizeResponse(resp);

        this.pending = {
            req: this._buildResponse(originalReq, miss.responseType, data),
            readyCycle: this.cycle + miss.refillCycles
        };
        this.statistics.totalCycles += this.pending.readyCycle - miss.startCycle;
    }

    _completeLocally({ req, responseType, data, cycles }) {
        this.pending = {
            req: this._buildResponse(req, responseType, data),
            readyCycle: this.cycle + cycles
        };
    }

    _emitPendingResponse(bus) {
        console.log(
            `[Cache:${this.name}] RESP type=${getOpcodeName(TL_D_Opcode, this.pending.req.type)} ` +
            `addr=0x${(this.pending.req.address >>> 0).toString(16)} data=${formatLogNumber(this.pending.req.data)}`
        );

        if (this.pending.req.replyTo && typeof this.pending.req.replyTo.receiveResponse === 'function') {
            this.pending.req.replyTo.receiveResponse(this.pending.req);
        } else if (bus) {
            bus.sendResponse(this.pending.req);
        } else {
            throw new Error('Cache has no response path for pending request');
        }

        this.pending = null;
    }

    _dispatchToLower(forwardedReq, purpose) {
        if (this.lowerCache && typeof this.lowerCache.receiveRequest === 'function') {
            this.lowerCache.receiveRequest(forwardedReq);
            return;
        }

        if (this.lowerPort && typeof this.lowerPort.sendRequest === 'function') {
            this.lowerPort.sendRequest(this.name, forwardedReq);
            return;
        }

        if (this.lowerPort && typeof this.lowerPort.receiveRequest === 'function') {
            this.lowerPort.receiveRequest(forwardedReq);
            return;
        }

        this.pending = null;
        throw new Error(`[Cache:${this.name}] No lower path available for ${purpose}`);
    }

    _buildForwardedRequest(req) {
        return {
            ...req,
            from: this.name,
            replyTo: this
        };
    }

    _buildResponse(req, type, data) {
        return {
            from: 'cache',
            to: req.from,
            type,
            data,
            address: (req.virtualAddress ?? req.address) >>> 0,
            physicalAddress: req.address >>> 0,
            virtualAddress: req.virtualAddress ?? req.address,
            size: getTransferSizeLog2(req, 2),
            replyTo: req.replyTo ?? null
        };
    }

    _findBlock(addr) {
        const { setIndex, tag } = this._decodeAddress(addr);
        const { begin, end } = this._getSetBounds(setIndex);

        for (let index = begin; index < end; index++) {
            const block = this.blocks[index];
            if (block.valid && block.tag === tag) return block;
        }

        return null;
    }

    _ensureBlock(addr) {
        const existingBlock = this._findBlock(addr);
        if (existingBlock) {
            this._touchBlock(existingBlock);
            return existingBlock;
        }

        return this._fillBlockFromLower(addr, 'DEMAND FILL');
    }

    _fillBlockFromLower(addr, fillLabel) {
        const decoded = this._decodeAddress(addr);
        const victim = this._selectVictim(decoded.setIndex);

        if (victim.valid && victim.modified && this.writeBack) {
            console.log(`[Cache:${this.name}] EVICT dirty set=${decoded.setIndex} way=${this._getWayIndex(victim.id)} tag=0x${victim.tag.toString(16)}`);
            this._writeBlockToLowerLevel(victim);
        }

        const baseAddress = this._getBlockBase(addr);
        console.log(
            `[Cache:${this.name}] ${fillLabel} set=${decoded.setIndex} way=${this._getWayIndex(victim.id)} ` +
            `tag=0x${decoded.tag.toString(16)} base=0x${baseAddress.toString(16)}`
        );

        for (let offset = 0; offset < this.policy.blockSize; offset++) {
            victim.data[offset] = this._readByteLower(baseAddress + offset);
        }

        victim.valid = true;
        victim.modified = false;
        victim.tag = decoded.tag;
        this._touchBlock(victim);
        return victim;
    }

    _selectVictim(setIndex) {
        const { begin, end } = this._getSetBounds(setIndex);

        for (let index = begin; index < end; index++) {
            if (!this.blocks[index].valid) return this.blocks[index];
        }

        let oldestIndex = begin;
        for (let index = begin + 1; index < end; index++) {
            if (this.blocks[index].lastReference < this.blocks[oldestIndex].lastReference) {
                oldestIndex = index;
            }
        }

        return this.blocks[oldestIndex];
    }

    _writeBlockToLowerLevel(block) {
        const baseAddress = this._getAddressFromBlock(block);
        console.log(`[Cache:${this.name}] WRITEBACK base=0x${baseAddress.toString(16)} tag=0x${block.tag.toString(16)}`);

        for (let offset = 0; offset < block.size; offset++) {
            this._writeByteLower(baseAddress + offset, block.data[offset]);
        }

        block.modified = false;
    }

    _readLowerValue(addr, size) {
        if (this.lowerCache) return this.lowerCache._readValueBySize(addr, size);
        if (typeof this.lowerPort?.directRead === 'function') return this.lowerPort.directRead(addr, size, 'cache');
        if (this.lowerPort?.mem) return readSizedValue(this.lowerPort.mem, addr, size);
        if (typeof this.lowerPort?.memBytes === 'function') return readSizedValue(this.lowerPort.memBytes(), addr, size);
        return 0;
    }

    _writeLowerValue(addr, value, size) {
        if (this.lowerCache) {
            this.lowerCache._writeValueBySize(addr, value, size);
            return;
        }

        if (typeof this.lowerPort?.directWrite === 'function') {
            this.lowerPort.directWrite(addr, value, size, 'cache');
            return;
        }

        if (this.lowerPort?.mem) {
            writeSizedValue(this.lowerPort.mem, addr, value, size);
            return;
        }

        if (typeof this.lowerPort?.memBytes === 'function') {
            writeSizedValue(this.lowerPort.memBytes(), addr, value, size);
        }
    }

    _readLowerByRequest(address, type, size) {
        if (type === 'readByte') return this._readLowerValue(address, 0);
        if (type === 'readHalf') return this._readLowerValue(address, 1);
        return this._readLowerValue(address, size);
    }

    _writeLowerByRequest(address, value, type, size) {
        if (type === 'writeByte') {
            this._writeLowerValue(address, value, 0);
            return;
        }

        if (type === 'writeHalf') {
            this._writeLowerValue(address, value, 1);
            return;
        }

        this._writeLowerValue(address, value, size);
    }

    _readByteLower(addr) {
        return this._readLowerValue(addr, 0) & 0xFF;
    }

    _writeByteLower(addr, value) {
        this._writeLowerValue(addr, value & 0xFF, 0);
    }

    _readValueForRequest(type, addr, size) {
        if (type === 'readByte') return this._readByte(addr);
        if (type === 'readHalf') return this._readHalf(addr);
        if (type === 'fetch' || type === 'read') return this._readWord(addr);
        if (type === TL_A_Opcode.Get) return this._readValueBySize(addr, size);
        return this._readWord(addr);
    }

    _writeByRequest(req) {
        const address = req.address >>> 0;
        const size = getTransferSizeLog2(req, 2);
        const value = req.value ?? 0;

        if (req.type === TL_A_Opcode.PutFullData || req.type === TL_A_Opcode.PutPartialData) {
            this._writeValueBySize(address, value, size);
            return;
        }

        if (req.type === 'write') {
            this._writeWord(address, value);
            return;
        }

        if (req.type === 'writeHalf') {
            this._writeHalf(address, value);
            return;
        }

        if (req.type === 'writeByte') {
            this._writeByte(address, value);
        }
    }

    _writeThroughLower(req) {
        const address = req.address >>> 0;
        const size = getTransferSizeLog2(req, 2);
        this._writeLowerByRequest(address, req.value ?? 0, req.type, size);
    }

    _readByte(addr) {
        const block = this._ensureBlock(addr);
        const offset = this._getOffset(addr);
        this._touchBlock(block);
        return block.data[offset];
    }

    _readHalf(addr) {
        const byte0 = this._readByte(addr);
        const byte1 = this._readByte(addr + 1);
        return ((byte1 << 8) | byte0) & 0xFFFF;
    }

    _readWord(addr) {
        const byte0 = this._readByte(addr);
        const byte1 = this._readByte(addr + 1);
        const byte2 = this._readByte(addr + 2);
        const byte3 = this._readByte(addr + 3);
        return ((byte3 << 24) | (byte2 << 16) | (byte1 << 8) | byte0) >>> 0;
    }

    _readValueBySize(addr, size) {
        if (size === 0) return this._readByte(addr);
        if (size === 1) return this._readHalf(addr);
        return this._readWord(addr);
    }

    _writeValueBySize(addr, value, size) {
        if (size === 0) {
            this._writeByte(addr, value);
            return;
        }

        if (size === 1) {
            this._writeHalf(addr, value);
            return;
        }

        this._writeWord(addr, value);
    }

    _writeByte(addr, value) {
        const block = this._ensureBlock(addr);
        const offset = this._getOffset(addr);
        block.data[offset] = value & 0xFF;

        if (this.writeBack) {
            block.modified = true;
        } else {
            this._writeByteLower(addr, value);
        }

        this._touchBlock(block);
    }

    _writeHalf(addr, value) {
        this._writeByte(addr, value & 0xFF);
        this._writeByte(addr + 1, (value >> 8) & 0xFF);
    }

    _writeWord(addr, value) {
        this._writeByte(addr, value & 0xFF);
        this._writeByte(addr + 1, (value >> 8) & 0xFF);
        this._writeByte(addr + 2, (value >> 16) & 0xFF);
        this._writeByte(addr + 3, (value >> 24) & 0xFF);
    }

    _touchBlock(block) {
        block.lastReference = ++this.referenceCounter;
    }

    _logHit(kind, address, cycles, value = null) {
        const decoded = this._decodeAddress(address);
        const valueFragment = value === null || value === undefined ? '' : ` val=0x${(value >>> 0).toString(16)}`;
        console.log(`[Cache:${this.name}] HIT ${kind} addr=0x${address.toString(16)} set=${decoded.setIndex} tag=0x${decoded.tag.toString(16)}${valueFragment} cy=${cycles}`);
    }

    _logMiss(kind, address, cycles, value = null) {
        const decoded = this._decodeAddress(address);
        const valueFragment = value === null || value === undefined ? '' : ` val=0x${(value >>> 0).toString(16)}`;
        console.log(`[Cache:${this.name}] MISS ${kind} addr=0x${address.toString(16)} set=${decoded.setIndex} tag=0x${decoded.tag.toString(16)}${valueFragment} cy=${cycles}`);
    }

    _normalizePolicy(userPolicy) {
        const cacheSize = userPolicy.cacheSize ?? 4096;
        const blockSize = userPolicy.blockSize ?? 32;
        const associativity = userPolicy.associativity ?? 4;
        const blockNum = userPolicy.blockNum ?? (cacheSize / blockSize);
        const numSets = userPolicy.numSets ?? (blockNum / associativity);

        return {
            cacheSize,
            blockSize,
            associativity,
            blockNum,
            numSets,
            hitLatency: userPolicy.hitLatency ?? 1,
            missLatency: userPolicy.missLatency ?? 10
        };
    }

    _initializeBlocks() {
        if (!this._isPolicyValid()) throw new Error('Invalid cache policy');

        this.blocks = Array.from({ length: this.policy.blockNum }, (_, index) => ({
            valid: false,
            modified: false,
            tag: 0,
            id: index,
            size: this.policy.blockSize,
            lastReference: 0,
            data: new Uint8Array(this.policy.blockSize)
        }));
    }

    _decodeAddress(addr) {
        return {
            tag: this._getTag(addr),
            setIndex: this._getSetIndex(addr),
            offset: this._getOffset(addr)
        };
    }

    _getSetBounds(setIndex) {
        const begin = setIndex * this.policy.associativity;
        return {
            begin,
            end: begin + this.policy.associativity
        };
    }

    _getWayIndex(blockId) {
        return blockId % this.policy.associativity;
    }

    _getTag(addr) {
        return (addr >>> 0) >>> (this._offsetBits() + this._indexBits());
    }

    _getSetIndex(addr) {
        return ((addr >>> 0) >>> this._offsetBits()) & (this.policy.numSets - 1);
    }

    _getOffset(addr) {
        return (addr >>> 0) & (this.policy.blockSize - 1);
    }

    _getBlockBase(addr) {
        return (addr >>> 0) & ~(this.policy.blockSize - 1);
    }

    _getAddressFromBlock(block) {
        const setIndex = Math.floor(block.id / this.policy.associativity);
        return (block.tag << (this._indexBits() + this._offsetBits())) | (setIndex << this._offsetBits());
    }

    _offsetBits() {
        return Math.log2(this.policy.blockSize);
    }

    _indexBits() {
        return Math.log2(this.policy.numSets);
    }

    _isPolicyValid() {
        const policy = this.policy;
        const isPowerOfTwo = (value) => value > 0 && (value & (value - 1)) === 0;

        return isPowerOfTwo(policy.cacheSize) &&
            isPowerOfTwo(policy.blockSize) &&
            isPowerOfTwo(policy.associativity) &&
            isPowerOfTwo(policy.numSets) &&
            policy.cacheSize === policy.blockSize * policy.blockNum &&
            policy.blockNum === policy.numSets * policy.associativity;
    }
}
