import { TL_A_Opcode, TL_D_Opcode, TL_Param_Arithmetic, TL_Param_Logical, getOpcodeName } from './tilelink.js';

function formatLogNumber(value) {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value !== 'number' || Number.isNaN(value)) return String(value);
    return `${value} (0x${(value >>> 0).toString(16)})`;
}

// Cache simulator modeled after cache.h: set-associative, write-back/write-allocate optional,
// blocking (one outstanding request), with hit/miss latency accounting and simple LRU.
export class Cache {
    constructor(backingMem, policy = {}, lowerCache = null, { writeBack = true, writeAllocate = true } = {}) {
        this.backing = backingMem;
        this.lowerCache = lowerCache;
        this.policy = this._normalizePolicy(policy);
        this.writeBack = writeBack; // write-through/write-back
        this.writeAllocate = writeAllocate; // write-to-lowermem/write-to-cache

        this.blocks = [];
        this.referenceCounter = 0;
        this.statistics = {
            numRead: 0,
            numWrite: 0,
            numHit: 0,
            numMiss: 0,
            totalCycles: 0
        };

        this.pending = null; // { req, readyCycle }
        this.cycle = 0;

        this._initCache();
    }

    get mem() {
        return this.backing.mem;
    }

    reset() {
        for (const b of this.blocks) {
            b.valid = false;
            b.modified = false;
            b.tag = 0;
            b.lastReference = 0;
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

    // Bus entry point
    receiveRequest(req) {
        if (this.pending) {
            console.warn('[Cache] Busy; request dropped');
            return;
        }

        console.log(`[Cache] REQ type=${getOpcodeName(TL_A_Opcode, req.type)} addr=0x${req.address.toString(16)} value=${formatLogNumber(req.value)}`);

        if (req.type === TL_A_Opcode.Get || req.type === 'read' || req.type === 'fetch' || req.type === 'readHalf' || req.type === 'readByte') {
            const { data, cycles } = this._handleRead(req);
            this.pending = { req: { from: 'cache', to: req.from, type: TL_D_Opcode.AccessAckData, address: req.address, data, size: req.size }, readyCycle: this.cycle + cycles };
        } else if (req.type === TL_A_Opcode.PutFullData || req.type === TL_A_Opcode.PutPartialData || req.type === 'write' || req.type === 'writeHalf' || req.type === 'writeByte') {
            const cycles = this._handleWrite(req);
            this.pending = { req: { from: 'cache', to: req.from, type: TL_D_Opcode.AccessAck, address: req.address, data: null, size: req.size }, readyCycle: this.cycle + cycles };
        } else if (req.type === TL_A_Opcode.ArithmeticData || req.type === TL_A_Opcode.LogicalData) {
            const { data, cycles } = this._handleAtomic(req);
            this.pending = { req: { from: 'cache', to: req.from, type: TL_D_Opcode.AccessAckData, address: req.address, data, size: req.size }, readyCycle: this.cycle + cycles };
        } else {
            console.warn(`[Cache] Unsupported request type ${req.type}`);
        }
    }

    tick(bus) {
        this.cycle++;
        if (!this.pending) return;

        if (this.cycle >= this.pending.readyCycle) {
            console.log(`[Cache] RESP type=${getOpcodeName(TL_D_Opcode, this.pending.req.type)} addr=0x${this.pending.req.address.toString(16)} data=${formatLogNumber(this.pending.req.data)}`);
            bus.sendResponse(this.pending.req);
            this.pending = null;
        }
    }

    inCache(addr) {
        return this._findBlock(addr) !== null;
    }

    // --- Internal helpers ---
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
            missLatency: userPolicy.missLatency ?? 2// 
        };
    }

    _initCache() {
        if (!this._isPolicyValid()) throw new Error('Invalid cache policy');
        this.blocks = Array.from({ length: this.policy.blockNum }, (_, i) => ({
            valid: false,
            modified: false,
            tag: 0,
            id: i,
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
        let value = 0;

        if (block) {
            this.statistics.numHit++;
            console.log(`[Cache] HIT R type=${req.type} addr=0x${addr.toString(16)} set=${this._getSetIndex(addr)} tag=0x${this._getTag(addr).toString(16)} cy=${cycles}`);
            this._touchBlock(block);
        } else {
            this.statistics.numMiss++;
            cycles += this.policy.missLatency;
            console.log(`[Cache] MISS R type=${req.type} addr=0x${addr.toString(16)} set=${this._getSetIndex(addr)} tag=0x${this._getTag(addr).toString(16)} cy=${cycles}`);
            cycles += this._loadBlock(addr);
        }

        if (req.type === TL_A_Opcode.Get) {
            if (req.size === 0) value = this._readByte(addr);
            else if (req.size === 1) value = this._readHalf(addr);
            else value = this._readWord(addr);
        } else if (req.type === 'fetch') {
            value = this._readWord(addr);
        } else if (req.type === 'readByte') {
            value = this._readByte(addr);
        } else if (req.type === 'readHalf') {
            value = this._readHalf(addr);
        } else if (req.type === 'read') {
            value = this._readWord(addr);
        }

        this.statistics.totalCycles += cycles;
        return { data: value, cycles };
    }

    _handleWrite(req) {
        this.statistics.numWrite++;
        const addr = req.address >>> 0;
        const isHit = this._findBlock(addr) !== null;
        let cycles = this.policy.hitLatency;

        if (isHit) {
            this.statistics.numHit++;
            console.log(`[Cache] HIT W type=${req.type} addr=0x${addr.toString(16)} set=${this._getSetIndex(addr)} tag=0x${this._getTag(addr).toString(16)} val=0x${(req.value >>> 0).toString(16)} cy=${cycles}`);
            this._writeByType(req);
        } else {
            this.statistics.numMiss++;
            cycles += this.policy.missLatency;
            console.log(`[Cache] MISS W type=${req.type} addr=0x${addr.toString(16)} set=${this._getSetIndex(addr)} tag=0x${this._getTag(addr).toString(16)} val=0x${(req.value >>> 0).toString(16)} cy=${cycles}`);
            if (this.writeAllocate) {
                cycles += this._loadBlock(addr);
                this._writeByType(req);
            } else {
                this._writeThroughBacking(req);
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

        const size = req.size ?? 2;
        const oldValue = this._readValueBySize(addr, size);
        const newValue = this._applyAtomic(req, oldValue, size);
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
            const b = this.blocks[i];
            if (b.valid && b.tag === tag) return b;
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
        console.log(`[Cache] FILL set=${set} way=${victimId - begin} tag=0x${this._getTag(addr).toString(16)} base=0x${base.toString(16)}`);
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

    _readByteLower(addr) {
        if (this.lowerCache) return this.lowerCache._readByte(addr);
        return this.backing.mem[addr] ?? 0;
    }

    _writeByteLower(addr, value) {
        if (this.lowerCache) {
            this.lowerCache._writeByte(addr, value & 0xFF);
        } else {
            this.backing.mem[addr] = value & 0xFF;
        }
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
        return (b1 << 8) | b0;
    }

    _readWord(addr) {
        const b0 = this._readByte(addr);
        const b1 = this._readByte(addr + 1);
        const b2 = this._readByte(addr + 2);
        const b3 = this._readByte(addr + 3);
        return (b3 << 24) | (b2 << 16) | (b1 << 8) | b0;
    }

    _readValueBySize(addr, size) {
        if (size === 0) return this._readByte(addr);
        if (size === 1) return this._readHalf(addr);
        return this._readWord(addr);
    }

    _writeValueBySize(addr, value, size) {
        if (size === 0) this._writeByte(addr, value);
        else if (size === 1) this._writeHalf(addr, value);
        else this._writeWord(addr, value);
    }

    _applyAtomic(req, data, size) {
        const unsignedData = size === 0 ? (data & 0xFF) : size === 1 ? (data & 0xFFFF) : (data >>> 0);
        const unsignedValue = size === 0 ? ((req.value ?? 0) & 0xFF) : size === 1 ? ((req.value ?? 0) & 0xFFFF) : ((req.value ?? 0) >>> 0);
        const signedData = size === 0 ? ((unsignedData << 24) >> 24) : size === 1 ? ((unsignedData << 16) >> 16) : (data | 0);
        const signedValue = size === 0 ? ((unsignedValue << 24) >> 24) : size === 1 ? ((unsignedValue << 16) >> 16) : ((req.value ?? 0) | 0);

        let result = unsignedData;
        if (req.type === TL_A_Opcode.ArithmeticData) {
            if (req.param === TL_Param_Arithmetic.MIN) result = Math.min(signedData, signedValue);
            else if (req.param === TL_Param_Arithmetic.MAX) result = Math.max(signedData, signedValue);
            else if (req.param === TL_Param_Arithmetic.MINU) result = Math.min(unsignedData, unsignedValue);
            else if (req.param === TL_Param_Arithmetic.MAXU) result = Math.max(unsignedData, unsignedValue);
            else if (req.param === TL_Param_Arithmetic.ADD) {
                if (size === 0) result = (unsignedData + unsignedValue) & 0xFF;
                else if (size === 1) result = (unsignedData + unsignedValue) & 0xFFFF;
                else result = (signedData + signedValue) | 0;
            }
        } else if (req.type === TL_A_Opcode.LogicalData) {
            if (req.param === TL_Param_Logical.XOR) result = unsignedData ^ unsignedValue;
            else if (req.param === TL_Param_Logical.OR) result = unsignedData | unsignedValue;
            else if (req.param === TL_Param_Logical.AND) result = unsignedData & unsignedValue;
            else if (req.param === TL_Param_Logical.SWAP) result = unsignedValue;
        }

        if (size === 0) return result & 0xFF;
        if (size === 1) return result & 0xFFFF;
        return result >>> 0;
    }

    _writeByType(req) {
        const addr = req.address;
        
        if (req.type === TL_A_Opcode.PutFullData || req.type === TL_A_Opcode.PutPartialData) {
            if (req.size === 2) this._writeWord(addr, req.value);
            else if (req.size === 1) this._writeHalf(addr, req.value);
            else if (req.size === 0) this._writeByte(addr, req.value);
        } else if (req.type === 'write') {
            this._writeWord(addr, req.value);
        } else if (req.type === 'writeHalf') {
            this._writeHalf(addr, req.value);
        } else if (req.type === 'writeByte') {
            this._writeByte(addr, req.value);
        }
    }

    _writeThroughBacking(req) {
        const addr = req.address;
        if (req.type === TL_A_Opcode.PutFullData || req.type === TL_A_Opcode.PutPartialData) {
            this._writeByteLower(addr, req.value & 0xFF);
            if (req.size >= 1) this._writeByteLower(addr + 1, (req.value >> 8) & 0xFF);
            if (req.size === 2) {
                this._writeByteLower(addr + 2, (req.value >> 16) & 0xFF);
                this._writeByteLower(addr + 3, (req.value >> 24) & 0xFF);
            }
        } else if (req.type === 'write') {
            this._writeByteLower(addr, req.value & 0xFF);
            this._writeByteLower(addr + 1, (req.value >> 8) & 0xFF);
            this._writeByteLower(addr + 2, (req.value >> 16) & 0xFF);
            this._writeByteLower(addr + 3, (req.value >> 24) & 0xFF);
        } else if (req.type === 'writeHalf') {
            this._writeByteLower(addr, req.value & 0xFF);
            this._writeByteLower(addr + 1, (req.value >> 8) & 0xFF);
        } else if (req.type === 'writeByte') {
            this._writeByteLower(addr, req.value & 0xFF);
        }
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
        if (!block) {
            const set = this._getSetIndex(addr);
            const begin = set * this.policy.associativity;
            const end = begin + this.policy.associativity;
            const victimId = this._getReplacementBlockId(begin, end);
            block = this.blocks[victimId];
            if (block.valid && block.modified && this.writeBack) {
                this._writeBlockToLowerLevel(block);
            }
            const base = this._getBlockBase(addr);
            console.log(`[Cache] DEMAND FILL set=${set} way=${victimId - begin} tag=0x${this._getTag(addr).toString(16)} base=0x${base.toString(16)}`);
            for (let i = 0; i < this.policy.blockSize; i++) {
                block.data[i] = this._readByteLower(base + i);
            }
            block.valid = true;
            block.modified = false;
            block.tag = this._getTag(addr);
        }
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
        const pow2 = (n) => (n & (n - 1)) === 0;
        return pow2(p.cacheSize) && pow2(p.blockSize) && pow2(p.associativity) && pow2(p.numSets) &&
            p.cacheSize === p.blockSize * p.blockNum && p.blockNum === p.numSets * p.associativity;
    }
}
