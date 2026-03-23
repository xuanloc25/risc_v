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

// Cache simulator modeled after cache.h: set-associative, optional write-back/write-allocate,
// blocking (one outstanding request), with simple LRU.
export class Cache {
    constructor(lowerLevel, policy = {}, lowerCache = null, { writeBack = true, writeAllocate = true, isCacheable = () => true } = {}) {
        this.lowerLevel = lowerLevel;
        this.lowerCache = lowerCache;
        this.policy = this._normalizePolicy(policy);
        this.writeBack = writeBack;
        this.writeAllocate = writeAllocate;
        this.isCacheable = isCacheable;
        this.enabled = true;

        this.blocks = [];
        this.referenceCounter = 0;
        this.statistics = {
            numRead: 0,
            numWrite: 0,
            numHit: 0,
            numMiss: 0,
            totalCycles: 0
        };

        this.pending = null;
        this.cycle = 0;

        this._initCache();
    }

    get mem() {
        if (this.lowerCache?.mem) return this.lowerCache.mem;
        if (this.lowerLevel?.mem) return this.lowerLevel.mem;
        if (typeof this.lowerLevel?.memBytes === 'function') return this.lowerLevel.memBytes();
        return {};
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
        this.statistics = {
            numRead: 0,
            numWrite: 0,
            numHit: 0,
            numMiss: 0,
            totalCycles: 0
        };
        this.pending = null;
        this.cycle = 0;
    }

    receiveRequest(req) {
        if (this.pending) {
            console.warn('[Cache] Busy; request dropped');
            return;
        }

        const reqAddress = (req.virtualAddress ?? req.address) >>> 0;
        console.log(
            `[Cache] REQ type=${typeof req.type === 'number' ? getOpcodeName(TL_A_Opcode, req.type) : req.type} ` +
            `addr=0x${reqAddress.toString(16)} value=${formatLogNumber(req.value)}`
        );

        const cacheable = this.enabled && req.cacheable !== false && this.isCacheable(req.address >>> 0);
        if (!cacheable) {
            const bypass = this._handleBypass(req);
            this.pending = {
                req: this._buildResponse(req, bypass.responseType, bypass.data),
                readyCycle: this.cycle + bypass.cycles
            };
            return;
        }

        if (isTileLinkRead(req.type)) {
            const { data, cycles } = this._handleRead(req);
            this.pending = {
                req: this._buildResponse(req, TL_D_Opcode.AccessAckData, data),
                readyCycle: this.cycle + cycles
            };
        } else if (isTileLinkWrite(req.type)) {
            const cycles = this._handleWrite(req);
            this.pending = {
                req: this._buildResponse(req, TL_D_Opcode.AccessAck, null),
                readyCycle: this.cycle + cycles
            };
        } else if (isTileLinkAtomic(req.type)) {
            const { data, cycles } = this._handleAtomic(req);
            this.pending = {
                req: this._buildResponse(req, TL_D_Opcode.AccessAckData, data),
                readyCycle: this.cycle + cycles
            };
        } else {
            console.warn(`[Cache] Unsupported request type ${req.type}`);
        }
    }

    tick(bus = null) {
        this.cycle++;
        if (!this.pending) return;
        if (this.cycle < this.pending.readyCycle) return;

        console.log(
            `[Cache] RESP type=${getOpcodeName(TL_D_Opcode, this.pending.req.type)} ` +
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

    inCache(addr) {
        return this._findBlock(addr) !== null;
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

    _handleBypass(req) {
        const cycles = this.policy.hitLatency;
        const size = getTransferSizeLog2(req, 2);
        let data = 0;
        let responseType = TL_D_Opcode.AccessAck;

        if (isTileLinkRead(req.type)) {
            data = this._readLowerByReq(req.address, req.type, size);
            responseType = TL_D_Opcode.AccessAckData;
        } else if (isTileLinkWrite(req.type)) {
            this._writeLowerByReq(req.address, req.value ?? 0, req.type, size);
        } else if (isTileLinkAtomic(req.type)) {
            data = this._readLowerValue(req.address, size);
            const newValue = applyTileLinkAtomic(req, data, size);
            this._writeLowerValue(req.address, newValue, size);
            responseType = TL_D_Opcode.AccessAckData;
        }

        return { data, cycles, responseType };
    }

    _normalizePolicy(userPolicy) {
        const cacheSize = userPolicy.cacheSize ?? 4096;
        const blockSize = userPolicy.blockSize ?? 32;
        const associativity = userPolicy.associativity ?? 4;
        const blockNum = userPolicy.blockNum ?? (cacheSize / blockSize);
        const numSets = blockNum / associativity;
        return {
            cacheSize,
            blockSize,
            blockNum,
            associativity,
            numSets,
            hitLatency: userPolicy.hitLatency ?? 1,
            missLatency: userPolicy.missLatency ?? 10
        };
    }

    _initCache() {
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

    _handleRead(req) {
        this.statistics.numRead++;
        const addr = req.address >>> 0;
        const block = this._findBlock(addr);
        let cycles = this.policy.hitLatency;

        if (block) {
            this.statistics.numHit++;
            console.log(
                `[Cache] HIT R addr=0x${addr.toString(16)} set=${this._getSetIndex(addr)} ` +
                `tag=0x${this._getTag(addr).toString(16)} cy=${cycles}`
            );
            this._touchBlock(block);
        } else {
            this.statistics.numMiss++;
            cycles += this.policy.missLatency;
            console.log(
                `[Cache] MISS R addr=0x${addr.toString(16)} set=${this._getSetIndex(addr)} ` +
                `tag=0x${this._getTag(addr).toString(16)} cy=${cycles}`
            );
            cycles += this._loadBlock(addr);
        }

        const data = this._readValueByReqType(req.type, addr, getTransferSizeLog2(req, 2));
        this.statistics.totalCycles += cycles;
        return { data, cycles };
    }

    _handleWrite(req) {
        this.statistics.numWrite++;
        const addr = req.address >>> 0;
        const isHit = this._findBlock(addr) !== null;
        let cycles = this.policy.hitLatency;

        if (isHit) {
            this.statistics.numHit++;
            console.log(
                `[Cache] HIT W addr=0x${addr.toString(16)} set=${this._getSetIndex(addr)} ` +
                `tag=0x${this._getTag(addr).toString(16)} val=0x${(req.value >>> 0).toString(16)} cy=${cycles}`
            );
            this._writeByType(req);
        } else {
            this.statistics.numMiss++;
            cycles += this.policy.missLatency;
            console.log(
                `[Cache] MISS W addr=0x${addr.toString(16)} set=${this._getSetIndex(addr)} ` +
                `tag=0x${this._getTag(addr).toString(16)} val=0x${(req.value >>> 0).toString(16)} cy=${cycles}`
            );
            if (this.writeAllocate) {
                cycles += this._loadBlock(addr);
                this._writeByType(req);
            } else {
                this._writeThroughLower(req);
            }
        }

        this.statistics.totalCycles += cycles;
        return cycles;
    }

    _handleAtomic(req) {
        this.statistics.numRead++;
        this.statistics.numWrite++;

        const addr = req.address >>> 0;
        const block = this._findBlock(addr);
        let cycles = this.policy.hitLatency;

        if (block) {
            this.statistics.numHit++;
            this._touchBlock(block);
        } else {
            this.statistics.numMiss++;
            cycles += this.policy.missLatency;
            cycles += this._loadBlock(addr);
        }

        const size = getTransferSizeLog2(req, 2);
        const oldValue = this._readValueBySize(addr, size);
        const newValue = applyTileLinkAtomic(req, oldValue, size);
        this._writeValueBySize(addr, newValue, size);

        this.statistics.totalCycles += cycles;
        return { data: oldValue, cycles };
    }

    _findBlock(addr) {
        const tag = this._getTag(addr);
        const set = this._getSetIndex(addr);
        const begin = set * this.policy.associativity;
        const end = begin + this.policy.associativity;

        for (let i = begin; i < end; i++) {
            const block = this.blocks[i];
            if (block.valid && block.tag === tag) return block;
        }

        return null;
    }

    _loadBlock(addr) {
        const set = this._getSetIndex(addr);
        const begin = set * this.policy.associativity;
        const end = begin + this.policy.associativity;
        const victimId = this._getReplacementBlockId(begin, end);
        const victim = this.blocks[victimId];
        let extraCycles = 0;

        if (victim.valid && victim.modified && this.writeBack) {
            console.log(`[Cache] EVICT dirty set=${set} way=${victimId - begin} tag=0x${victim.tag.toString(16)}`);
            this._writeBlockToLowerLevel(victim);
            extraCycles += this.policy.missLatency;
        }

        const base = this._getBlockBase(addr);
        console.log(
            `[Cache] FILL set=${set} way=${victimId - begin} tag=0x${this._getTag(addr).toString(16)} ` +
            `base=0x${base.toString(16)}`
        );

        for (let i = 0; i < this.policy.blockSize; i++) {
            victim.data[i] = this._readByteLower(base + i);
        }

        victim.valid = true;
        victim.modified = false;
        victim.tag = this._getTag(addr);
        this._touchBlock(victim);

        return extraCycles;
    }

    _writeBlockToLowerLevel(block) {
        const baseAddr = this._getAddr(block);
        console.log(`[Cache] WRITEBACK base=0x${baseAddr.toString(16)} tag=0x${block.tag.toString(16)}`);

        for (let i = 0; i < block.size; i++) {
            this._writeByteLower(baseAddr + i, block.data[i]);
        }

        block.modified = false;
    }

    _getReplacementBlockId(begin, end) {
        for (let i = begin; i < end; i++) {
            if (!this.blocks[i].valid) return i;
        }

        let oldest = begin;
        for (let i = begin + 1; i < end; i++) {
            if (this.blocks[i].lastReference < this.blocks[oldest].lastReference) {
                oldest = i;
            }
        }

        return oldest;
    }

    _touchBlock(block) {
        block.lastReference = ++this.referenceCounter;
    }

    _readLowerValue(addr, size) {
        if (this.lowerCache) return this.lowerCache._readValueBySize(addr, size);
        if (typeof this.lowerLevel?.directRead === 'function') return this.lowerLevel.directRead(addr, size, 'cache');
        if (this.lowerLevel?.mem) return readSizedValue(this.lowerLevel.mem, addr, size);
        if (typeof this.lowerLevel?.memBytes === 'function') return readSizedValue(this.lowerLevel.memBytes(), addr, size);
        return 0;
    }

    _writeLowerValue(addr, value, size) {
        if (this.lowerCache) {
            this.lowerCache._writeValueBySize(addr, value, size);
            return;
        }

        if (typeof this.lowerLevel?.directWrite === 'function') {
            this.lowerLevel.directWrite(addr, value, size, 'cache');
            return;
        }

        if (this.lowerLevel?.mem) {
            writeSizedValue(this.lowerLevel.mem, addr, value, size);
            return;
        }

        if (typeof this.lowerLevel?.memBytes === 'function') {
            writeSizedValue(this.lowerLevel.memBytes(), addr, value, size);
        }
    }

    _readLowerByReq(address, type, size) {
        if (type === 'readByte') return this._readLowerValue(address, 0);
        if (type === 'readHalf') return this._readLowerValue(address, 1);
        return this._readLowerValue(address, size);
    }

    _writeLowerByReq(address, value, type, size) {
        if (type === 'writeByte') this._writeLowerValue(address, value, 0);
        else if (type === 'writeHalf') this._writeLowerValue(address, value, 1);
        else this._writeLowerValue(address, value, size);
    }

    _readByteLower(addr) {
        return this._readLowerValue(addr, 0) & 0xFF;
    }

    _writeByteLower(addr, value) {
        this._writeLowerValue(addr, value & 0xFF, 0);
    }

    _readByte(addr) {
        const block = this._ensureBlock(addr);
        const offset = this._getOffset(addr);
        this._touchBlock(block);
        return block.data[offset];
    }

    _readHalf(addr) {
        const b0 = this._readByte(addr);
        const b1 = this._readByte(addr + 1);
        return ((b1 << 8) | b0) & 0xFFFF;
    }

    _readWord(addr) {
        const b0 = this._readByte(addr);
        const b1 = this._readByte(addr + 1);
        const b2 = this._readByte(addr + 2);
        const b3 = this._readByte(addr + 3);
        return ((b3 << 24) | (b2 << 16) | (b1 << 8) | b0) >>> 0;
    }

    _readValueBySize(addr, size) {
        if (size === 0) return this._readByte(addr);
        if (size === 1) return this._readHalf(addr);
        return this._readWord(addr);
    }

    _readValueByReqType(type, addr, size) {
        if (type === 'readByte') return this._readByte(addr);
        if (type === 'readHalf') return this._readHalf(addr);
        if (type === 'fetch' || type === 'read') return this._readWord(addr);
        if (type === TL_A_Opcode.Get) return this._readValueBySize(addr, size);
        return this._readWord(addr);
    }

    _writeValueBySize(addr, value, size) {
        if (size === 0) this._writeByte(addr, value);
        else if (size === 1) this._writeHalf(addr, value);
        else this._writeWord(addr, value);
    }

    _writeByType(req) {
        const addr = req.address >>> 0;
        const size = getTransferSizeLog2(req, 2);

        if (req.type === TL_A_Opcode.PutFullData || req.type === TL_A_Opcode.PutPartialData) {
            this._writeValueBySize(addr, req.value ?? 0, size);
        } else if (req.type === 'write') {
            this._writeWord(addr, req.value ?? 0);
        } else if (req.type === 'writeHalf') {
            this._writeHalf(addr, req.value ?? 0);
        } else if (req.type === 'writeByte') {
            this._writeByte(addr, req.value ?? 0);
        }
    }

    _writeThroughLower(req) {
        const addr = req.address >>> 0;
        const size = getTransferSizeLog2(req, 2);
        this._writeLowerByReq(addr, req.value ?? 0, req.type, size);
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

    _ensureBlock(addr) {
        let block = this._findBlock(addr);
        if (block) {
            this._touchBlock(block);
            return block;
        }

        const set = this._getSetIndex(addr);
        const begin = set * this.policy.associativity;
        const end = begin + this.policy.associativity;
        const victimId = this._getReplacementBlockId(begin, end);
        block = this.blocks[victimId];

        if (block.valid && block.modified && this.writeBack) {
            this._writeBlockToLowerLevel(block);
        }

        const base = this._getBlockBase(addr);
        console.log(
            `[Cache] DEMAND FILL set=${set} way=${victimId - begin} tag=0x${this._getTag(addr).toString(16)} ` +
            `base=0x${base.toString(16)}`
        );

        for (let i = 0; i < this.policy.blockSize; i++) {
            block.data[i] = this._readByteLower(base + i);
        }

        block.valid = true;
        block.modified = false;
        block.tag = this._getTag(addr);
        this._touchBlock(block);
        return block;
    }

    _getTag(addr) {
        return addr >>> (this._offsetBits() + this._indexBits());
    }

    _getSetIndex(addr) {
        return (addr >>> this._offsetBits()) & (this.policy.numSets - 1);
    }

    _getOffset(addr) {
        return addr & (this.policy.blockSize - 1);
    }

    _getBlockBase(addr) {
        return addr & ~(this.policy.blockSize - 1);
    }

    _getAddr(block) {
        const set = Math.floor(block.id / this.policy.associativity);
        return (block.tag << (this._indexBits() + this._offsetBits())) | (set << this._offsetBits());
    }

    _offsetBits() {
        return Math.log2(this.policy.blockSize);
    }

    _indexBits() {
        return Math.log2(this.policy.numSets);
    }

    _isPolicyValid() {
        const p = this.policy;
        const isPow2 = (n) => (n & (n - 1)) === 0;
        return isPow2(p.cacheSize) &&
            isPow2(p.blockSize) &&
            isPow2(p.associativity) &&
            isPow2(p.numSets) &&
            p.cacheSize === p.blockSize * p.blockNum &&
            p.blockNum === p.numSets * p.associativity;
    }
}
