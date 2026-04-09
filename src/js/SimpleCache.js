import {
    TL_D_Opcode,
    applyTileLinkAtomic,
    getTransferSizeLog2,
    isTileLinkAtomic,
    isTileLinkRead,
    isTileLinkWrite
} from './tilelink.js';

const REFILL_TRANSFER_LATENCY = 1;

function isReadResponse(type) {
    return isTileLinkRead(type) || isTileLinkAtomic(type);
}

function createStats() {
    return {
        numRead: 0,
        numWrite: 0,
        numHit: 0,
        numMiss: 0,
        totalCycles: 0
    };
}

export default class SimpleCache {
    constructor({
        numSets = 16,
        numWays = 4,
        blockSize = 16,
        hitLatency = 1,
        missLatency = 5,
        name = 'simple-cache',
        isCacheable = () => true
    } = {}) {
        this.name = name;
        this.numSets = numSets;
        this.numWays = numWays;
        this.blockSize = blockSize;
        this.hitLatency = hitLatency;
        this.missLatency = missLatency;
        this.isCacheable = isCacheable;
        this.enabled = true;

        this.upperPort = null;
        this.lowerPort = null;
        this.cycle = 0;
        this.referenceCounter = 0;
        this.pendingRequest = null;
        this.pendingResponse = null;
        this.pendingFill = null;
        this.statistics = createStats();
        this.policy = {
            associativity: numWays,
            numSets,
            blockSize
        };

        this.blocks = Array.from({ length: numSets * numWays }, (_, id) => ({
            id,
            valid: false,
            modified: false,
            tag: 0,
            lastReference: 0,
            data: new Uint8Array(blockSize)
        }));
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
        this.cycle = 0;
        this.referenceCounter = 0;
        this.pendingRequest = null;
        this.pendingResponse = null;
        this.pendingFill = null;
        this.statistics = createStats();

        for (const block of this.blocks) {
            block.valid = false;
            block.modified = false;
            block.tag = 0;
            block.lastReference = 0;
            block.data.fill(0);
        }
    }

    memBytes() {
        if (this.lowerPort?.mem) return this.lowerPort.mem;
        if (typeof this.lowerPort?.memBytes === 'function') return this.lowerPort.memBytes();
        return {};
    }

    receiveRequest(req) {
        if (this.pendingRequest || this.pendingFill) return;

        if (isReadResponse(req.type)) this.statistics.numRead++;
        else this.statistics.numWrite++;

        const shouldCache = this.enabled && req.cacheable !== false && this.isCacheable(req.address >>> 0);
        const latency = shouldCache ? this._handleCacheRequest(req) : this._handleBypassRequest(req);

        this.pendingRequest = {
            req,
            readyCycle: this.cycle + latency
        };
    }

    receiveResponse(resp) {
        void resp;
    }

    tick() {
        this.cycle++;

        if (this.pendingFill) {
            this._advancePendingFill();
        }

        if (!this.pendingRequest || this.cycle < this.pendingRequest.readyCycle || !this.pendingResponse) return;

        const target = this.pendingRequest.req.replyTo ?? this.upperPort;
        if (target && typeof target.receiveResponse === 'function') {
            target.receiveResponse(this.pendingResponse);
        }

        this.pendingRequest = null;
        this.pendingResponse = null;
    }

    _handleCacheRequest(req) {
        const address = req.address >>> 0;
        const size = getTransferSizeLog2(req, 2);
        const setIndex = this._getSetIndex(address);
        const tag = this._getTag(address);
        const blockBase = this._getBlockBase(address);
        const offset = address - blockBase;
        const block = this._findBlock(setIndex, tag);
        const opType = req.type === 'fetch' ? 'FETCH' : (isTileLinkRead(req.type) ? 'READ' : 'WRITE');

        if (block) {
            this.statistics.numHit++;
            this.statistics.totalCycles += this.hitLatency;
            this._touchBlock(block);
            console.log(`[${this.name}] HIT  ${opType} addr=0x${address.toString(16)} set=${setIndex} tag=0x${tag.toString(16)}`);
            this.pendingResponse = this._buildResponse(req, this._serveRequest(block, offset, size, req));
            return this.hitLatency;
        }

        this.statistics.numMiss++;
        this.statistics.totalCycles += this.missLatency;

        const victim = this._selectVictim(setIndex);
        console.log(`[${this.name}] MISS ${opType} addr=0x${address.toString(16)} set=${setIndex} tag=0x${tag.toString(16)}`);
        let totalLatency = this.missLatency;
        let refillPlan = null;

        // Build an async refill plan for lower hierarchy.
        if (typeof this.lowerPort?.beginBlockFill === 'function') {
            refillPlan = this.lowerPort.beginBlockFill(blockBase, this.cycle + this.missLatency);
            const bypassLatency = refillPlan.bypassLatency;
            totalLatency += refillPlan.totalLatency + bypassLatency + REFILL_TRANSFER_LATENCY;
        }

        this.pendingFill = {
            victim,
            blockBase,
            tag,
            offset,
            size,
            req,
            refillPlan,
            readyCycle: this.cycle + totalLatency,
            loggedEvents: 0
        };

        // Response will be created only after the refill reaches its ready cycle.
        this.pendingResponse = null;
        return totalLatency;
    }

    _advancePendingFill() {
        const fill = this.pendingFill;
        if (!fill) return;

        const events = fill.refillPlan?.events ?? [];
        while (fill.loggedEvents < events.length && this.cycle >= events[fill.loggedEvents].cycle) {
            console.log(events[fill.loggedEvents].message);
            fill.loggedEvents++;
        }

        if (this.cycle < fill.readyCycle) return;

        let blockData = null;
        if (fill.refillPlan && typeof this.lowerPort?.finishBlockFill === 'function') {
            blockData = this.lowerPort.finishBlockFill(fill.refillPlan);
        }

        if (blockData) {
            this._installBlockData(fill.victim, fill.tag, blockData);
        } else {
            // Fallback path for lower ports without async fill-plan support.
            this._fillBlock(fill.victim, fill.blockBase, fill.tag);
        }

        this._touchBlock(fill.victim);
        console.log(`[CPU] RECEIVE(fill) addr=0x${(fill.req.address >>> 0).toString(16)}`);
        this.pendingResponse = this._buildResponse(fill.req, this._serveRequest(fill.victim, fill.offset, fill.size, fill.req));
        this.pendingFill = null;
    }

    _handleBypassRequest(req) {
        const address = req.address >>> 0;
        const size = getTransferSizeLog2(req, 2);
        let data = 0;
        let type = TL_D_Opcode.AccessAck;

        if (isTileLinkRead(req.type)) {
            data = this.lowerPort.directRead(address, size, req.type) >>> 0;
            type = TL_D_Opcode.AccessAckData;
        } else if (isTileLinkWrite(req.type)) {
            this.lowerPort.directWrite(address, req.value ?? 0, size, req.type);
        } else if (isTileLinkAtomic(req.type)) {
            data = this.lowerPort.directRead(address, size, req.type) >>> 0;
            const nextValue = applyTileLinkAtomic(req, data, size);
            this.lowerPort.directWrite(address, nextValue, size, req.type);
            type = TL_D_Opcode.AccessAckData;
        }

        this.statistics.totalCycles += this.missLatency;
        this.pendingResponse = {
            from: this.name,
            to: req.from,
            type,
            data,
            address,
            virtualAddress: req.virtualAddress,
            size
        };
        return this.missLatency;
    }

    _serveRequest(block, offset, size, req) {
        if (isTileLinkRead(req.type)) {
            return this._readBlockValue(block, offset, size);
        }

        if (isTileLinkWrite(req.type)) {
            this._writeBlockValue(block, offset, req.value ?? 0, size);
            this.lowerPort.directWrite(req.address >>> 0, req.value ?? 0, size, 'write-through');
            block.modified = true;
            return 0;
        }

        if (isTileLinkAtomic(req.type)) {
            const oldValue = this._readBlockValue(block, offset, size);
            const nextValue = applyTileLinkAtomic(req, oldValue, size);
            this._writeBlockValue(block, offset, nextValue, size);
            this.lowerPort.directWrite(req.address >>> 0, nextValue, size, 'write-through');
            block.modified = true;
            return oldValue;
        }

        return 0;
    }

    _buildResponse(req, data) {
        return {
            from: this.name,
            to: req.from,
            type: isReadResponse(req.type) ? TL_D_Opcode.AccessAckData : TL_D_Opcode.AccessAck,
            data,
            address: req.address >>> 0,
            virtualAddress: req.virtualAddress,
            size: getTransferSizeLog2(req, 2)
        };
    }

    _fillBlock(block, blockBase, tag) {
        block.valid = true;
        block.modified = false;
        block.tag = tag >>> 0;
        
        // Fetch block byte-by-byte từ lower level
        for (let i = 0; i < this.blockSize; i++) {
            block.data[i] = this.lowerPort.directRead((blockBase + i) >>> 0, 0, 'fill') & 0xFF;
        }
    }

    _installBlockData(block, tag, blockData) {
        block.valid = true;
        block.modified = false;
        block.tag = tag >>> 0;
        block.data.fill(0);
        for (let i = 0; i < this.blockSize; i++) {
            block.data[i] = blockData[i] & 0xFF;
        }
    }

    _findBlock(setIndex, tag) {
        for (let way = 0; way < this.numWays; way++) {
            const block = this.blocks[setIndex * this.numWays + way];
            if (block.valid && block.tag === (tag >>> 0)) return block;
        }
        return null;
    }

    _selectVictim(setIndex) {
        let victim = null;
        for (let way = 0; way < this.numWays; way++) {
            const block = this.blocks[setIndex * this.numWays + way];
            if (!block.valid) return block;
            if (!victim || block.lastReference < victim.lastReference) victim = block;
        }
        return victim;
    }

    _touchBlock(block) {
        this.referenceCounter++;
        block.lastReference = this.referenceCounter;
    }

    _readBlockValue(block, offset, size) {
        let value = block.data[offset] ?? 0;
        if (size >= 1) value |= (block.data[offset + 1] ?? 0) << 8;
        if (size >= 2) {
            value |= (block.data[offset + 2] ?? 0) << 16;
            value |= (block.data[offset + 3] ?? 0) << 24;
        }
        return value >>> 0;
    }

    _writeBlockValue(block, offset, value, size) {
        const normalized = value >>> 0;
        block.data[offset] = normalized & 0xFF;
        if (size >= 1) block.data[offset + 1] = (normalized >>> 8) & 0xFF;
        if (size >= 2) {
            block.data[offset + 2] = (normalized >>> 16) & 0xFF;
            block.data[offset + 3] = (normalized >>> 24) & 0xFF;
        }
    }

    _getBlockBase(address) {
        const addr = address >>> 0;
        return Math.floor(addr / this.blockSize) * this.blockSize;
    }

    _getSetIndex(address) {
        return Math.floor((address >>> 0) / this.blockSize) % this.numSets;
    }

    _getTag(address) {
        return Math.floor((address >>> 0) / this.blockSize / this.numSets);
    }
}
