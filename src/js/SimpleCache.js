import {
    TL_D_Opcode,
    applyTileLinkAtomic,
    getTransferSizeLog2,
    isTileLinkAtomic,
    isTileLinkRead,
    isTileLinkWrite
} from './tilelink.js';

const REFILL_TRANSFER_LATENCY = 1;
const REFILL_BEAT_BYTES = 4;

// Kiểm tra xem request là read hay atomic (có trả dữ liệu về).
function isReadResponse(type) {
    return isTileLinkRead(type) || isTileLinkAtomic(type);
}

// Khởi tạo bộ đếm thống kê cache.
function createStats() {
    return {
        numRead: 0,
        numWrite: 0,
        numHit: 0,
        numMiss: 0,
        totalCycles: 0
    };
}

function describeLowerPort(port) {
    return port?.lower?.name ?? port?.name ?? port?.constructor?.name ?? 'lower';
}

export class SimpleCache {
    constructor({ numSets, numWays, blockSize, hitLatency, missLatency, name, isCacheable = () => true} = {}) {
        // Thông số cấu hình cache.
        this.name = name;
        this.numSets = numSets;
        this.numWays = numWays;
        this.blockSize = blockSize;
        this.hitLatency = hitLatency;
        this.missLatency = missLatency;
        this.isCacheable = isCacheable;
        this.enabled = true;

        // Kết nối với tầng trên/dưới và trạng thái runtime.
        this.upperPort = null;
        this.lowerPort = null;
        this.cycle = 0;
        this.referenceCounter = 0;
        
        this.pendingRequest = null; // pendingRequest: request đang chờ hoàn tất (hit/bypass).
        this.pendingResponse = null; // pendingResponse: dữ liệu đã sẵn sàng trả về.
        this.pendingFill = null; // pendingFill: request đang trong quá trình refill từ lower level.
        this.pendingBurstResponse = null; // pendingBurstResponse: burst line data đang trả về upper cache.
        this.statistics = createStats();
        this.policy = {
            numWays,
            numSets,
            blockSize
        };

        // Khởi tạo toàn bộ block vật lý của cache với policy đã chỉ định.
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

    // Toggle enable/disable cache; khi off thì bypass trực tiếp.
    setEnabled(enabled) {
        this.enabled = !!enabled;
    }

    reset() {
        // Reset chỉ xóa state runtime, không đổi cấu hình.
        this.cycle = 0;
        this.referenceCounter = 0;
        this.pendingRequest = null;
        this.pendingResponse = null;
        this.pendingFill = null;
        this.pendingBurstResponse = null;
        this.statistics = createStats();

        for (const block of this.blocks) {
            block.valid = false;
            block.modified = false;
            block.tag = 0;
            block.lastReference = 0;
            block.data.fill(0);
        }
    }

    directRead(address, size, accessType) {
        console.log(
            `[${this.name}] ${this.name} -> ${describeLowerPort(this.lowerPort)} DIRECT_READ ` +
            `addr=0x${(address >>> 0).toString(16)} size=${size} access=${accessType}`
        );
        const value = this.lowerPort.directRead(address >>> 0, size, accessType);
        console.log(
            `[${this.name}] ${describeLowerPort(this.lowerPort)} -> ${this.name} DIRECT_READ_DATA ` +
            `addr=0x${(address >>> 0).toString(16)} data=${value ?? 0}`
        );
        return value;
    }

    directWrite(address, value, size, accessType) {
        const physicalAddress = address >>> 0;
        const shouldLogWrite = accessType !== 'fill' && accessType !== 'fill-bypass' && accessType !== 'write-through';
        const shouldCache = this.enabled && this.isCacheable(physicalAddress);
        if (!shouldCache) {
            console.log(
                `[${this.name}] ${this.name} -> ${describeLowerPort(this.lowerPort)} DIRECT_WRITE ` +
                `addr=0x${physicalAddress.toString(16)} size=${size} access=${accessType} data=${value ?? 0}`
            );
            this.lowerPort.directWrite(physicalAddress, value, size, accessType);
            return;
        }

        this.statistics.numWrite++;

        const setIndex = this._getSetIndex(physicalAddress);
        const tag = this._getTag(physicalAddress);
        const blockBase = this._getBlockBase(physicalAddress);
        const offset = physicalAddress - blockBase;

        let block = this._findBlock(setIndex, tag);
        if (!block) {
            this.statistics.numMiss++;
            this.statistics.totalCycles += this.missLatency;
            block = this._selectVictim(setIndex);
            this._fillBlock(block, blockBase, tag);
            if (shouldLogWrite) {
                console.log(`[${this.name}] MISS WR addr=0x${physicalAddress.toString(16)} set=${setIndex} tag=0x${tag.toString(16)} val=0x${(value >>> 0).toString(16)}`);
            }
        } else {
            this.statistics.numHit++;
            this.statistics.totalCycles += this.hitLatency;
            if (shouldLogWrite) {
                console.log(`[${this.name}] HIT  WR addr=0x${physicalAddress.toString(16)} set=${setIndex} tag=0x${tag.toString(16)} val=0x${(value >>> 0).toString(16)}`);
            }
        }

        this._touchBlock(block);
        this._writeBlockValue(block, offset, value ?? 0, size);
        block.modified = true;
        console.log(
            `[${this.name}] ${this.name} -> ${describeLowerPort(this.lowerPort)} DIRECT_WRITE ` +
            `addr=0x${physicalAddress.toString(16)} size=${size} access=${accessType} data=${value ?? 0}`
        );
        this.lowerPort.directWrite(physicalAddress, value ?? 0, size, accessType);
    }

    // Nhận request từ upper level; cache chỉ xử lý một request tại một thời điểm.
    receiveRequest(req) {
        if (this.pendingRequest || this.pendingFill || this.pendingBurstResponse) return;

        if (req.type === 'fill') {
            this._handleFillRequest(req);
            return;
        }

        if (isReadResponse(req.type)) this.statistics.numRead++;
        else this.statistics.numWrite++;

        const shouldCache = this.enabled && req.cacheable !== false && this.isCacheable(req.address >>> 0);
        const latency = shouldCache ? this._handleCacheRequest(req) : this._handleBypassRequest(req);

        this.pendingRequest = {
            req,
            readyCycle: this.cycle + latency
        };
    }

    sendRequest(from, req) {
        this.receiveRequest({
            ...req,
            from
        });
    }

    receiveResponse(resp) {
        if (!resp?.refillBeat || !this.pendingFill) return;

        const fill = this.pendingFill;
        if ((resp.blockBase >>> 0) !== fill.blockBase) return;

        console.log(
            `[${this.name}] ${describeLowerPort(this.lowerPort)} -> ${this.name} RESPONSE_BEAT ` +
            `addr=0x${(resp.address >>> 0).toString(16)} data=${resp.data ?? 0} ` +
            `${(resp.beatIndex ?? fill.beatsReceived) + 1}/${resp.beatCount ?? fill.beatsExpected}`
        );
        this._writeBlockValue(fill.victim, (resp.address >>> 0) - fill.blockBase, resp.data, this._sizeToBytes(resp.size));
        fill.beatsReceived++;

        if (fill.beatsReceived >= fill.beatsExpected) {
            fill.victim.valid = true;
            fill.lineReadyCycle = this.cycle + REFILL_TRANSFER_LATENCY;
        }
    }

    // Mỗi tick tiến trạng thái refill và trả response khi sẵn sàng.
    tick() {
        this.cycle++;

        if (this.pendingFill) {
            this._advancePendingFill();
        }

        if (this.pendingBurstResponse) {
            this._advancePendingBurstResponse();
        }

        if (!this.pendingRequest || this.cycle < this.pendingRequest.readyCycle || !this.pendingResponse) return;

        const target = this.pendingRequest.req.replyTo ?? this.upperPort;
        if (target && typeof target.receiveResponse === 'function') {
            console.log(
                `[${this.name}] ${this.name} -> ${this.pendingRequest.req.from} RESPONSE ` +
                `addr=0x${(this.pendingResponse.address >>> 0).toString(16)} data=${this.pendingResponse.data ?? 0}`
            );
            target.receiveResponse(this.pendingResponse);
        }

        this.pendingRequest = null;
        this.pendingResponse = null;
    }

    // Xử lý request: hit trả dữ liệu ngay, miss khởi động refill bất đồng bộ.
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
            // Cache hit: tính thêm hitLatency rồi trả response ngay.
            this.statistics.numHit++;
            this.statistics.totalCycles += this.hitLatency;
            this._touchBlock(block);
            console.log(`[${this.name}] HIT  ${opType} addr=0x${address.toString(16)} set=${setIndex} tag=0x${tag.toString(16)}`);
            this.pendingResponse = this._buildResponse(req, this._serveRequest(block, offset, size, req));
            return this.hitLatency;
        }

        // Cache miss: lập kế hoạch refill từ lower level rồi chọn victim.
        this.statistics.numMiss++;
        this.statistics.totalCycles += this.missLatency;

        const victim = this._selectVictim(setIndex);
        this._prepareVictimForRefill(victim, tag);
        console.log(`[${this.name}] MISS ${opType} addr=0x${address.toString(16)} set=${setIndex} tag=0x${tag.toString(16)}`);
        // Lưu trạng thái refill đang chờ nhận burst responses / direct beats.
        this.pendingFill = {
            mode: 'request', 
            victim, 
            blockBase, 
            tag,
            offset,
            size, 
            req, 
            beatsExpected: this._getBeatCount(), // Tổng số beat cần nhận để lấp đầy toàn bộ cache line.
            beatsReceived: 0, // Số beat đã nhận xong từ lower level cho line hiện tại.
            issued: false, // Đánh dấu refill request đã được phát xuống lower level hay chưa.
            issueCycle: this.cycle + this.missLatency, // Chu kỳ bắt đầu phát refill request sau khi trả đủ miss latency.
            lineReadyCycle: null // Chu kỳ line được coi là hợp lệ và có thể dùng để phục vụ request/burst tiếp.
        };
        
        this.pendingResponse = null;
        return this.missLatency;
    }

    // Tiến quá trình refill: issue request xuống lower level, nhận beat responses, và hoàn tất line.
    _advancePendingFill() {
        const fill = this.pendingFill;
        if (!fill) return;

        if (!fill.issued && this.cycle >= fill.issueCycle) {
            if (this._supportsBurstRefill()) {
                console.log(
                    `[${this.name}] ${this.name} -> ${describeLowerPort(this.lowerPort)} REQUEST ` +
                    `type=fill addr=0x${fill.blockBase.toString(16)} beats=${fill.beatsExpected}`
                );
                this.lowerPort.receiveRequest({
                    type: 'fill', 
                    from: this.name, 
                    replyTo: this, 
                    address: fill.blockBase, 
                    blockBase: fill.blockBase, 
                    size: this._getBlockSizeLog2(), 
                    beatBytes: REFILL_BEAT_BYTES // Số byte trên mỗi beat burst, đang cấu hình là 4 byte/beat.
                });
                console.log(`[${this.name}] REFILL_REQUEST addr=0x${fill.blockBase.toString(16)} beats=${fill.beatsExpected}`);
            }
            fill.issued = true;
        }

        if (fill.lineReadyCycle === null || this.cycle < fill.lineReadyCycle) return;

        this._touchBlock(fill.victim);
        if (fill.mode === 'request') {
            console.log(`[${this.name}] RECEIVE_COMPLETE addr=0x${fill.blockBase.toString(16)} ${fill.beatsExpected}/${fill.beatsExpected}`);
            console.log(`[CPU] RECEIVE(fill) addr=0x${(fill.req.address >>> 0).toString(16)}`);
            this.pendingResponse = this._buildResponse(fill.req, this._serveRequest(fill.victim, fill.offset, fill.size, fill.req));
        } else {
            this.pendingBurstResponse = this._createBurstResponse(fill.req, fill.victim, fill.blockBase);
        }
        this.pendingFill = null;
    }

    // Xử lý request không cacheable hoặc khi cache off: bypass trực tiếp.
    _handleBypassRequest(req) {
        const address = req.address >>> 0;
        const size = getTransferSizeLog2(req, 2);
        const lowerLatency = req.cacheable === false ? 0: (this.lowerPort?.memoryTarget?.latency ?? this.lowerPort?.latency );
        const bypassLatency = this.missLatency + lowerLatency;
        let data = 0;
        let type = TL_D_Opcode.AccessAck;

        if (isTileLinkRead(req.type)) {
            // Log latency breakdown: miss phase + RAM latency
            console.log(`[${this.name}] BYPASS_READ addr=0x${address.toString(16)} latency=${bypassLatency}cy (miss_phase=${this.missLatency}cy + RAM_latency=${lowerLatency}cy)`);
            console.log(
                `[${this.name}] ${this.name} -> ${describeLowerPort(this.lowerPort)} DIRECT_READ ` +
                `addr=0x${address.toString(16)} size=${size} access=${req.type}`
            );
            data = this.lowerPort.directRead(address, size, req.type) >>> 0;
            console.log(
                `[${this.name}] ${describeLowerPort(this.lowerPort)} -> ${this.name} DIRECT_READ_DATA ` +
                `addr=0x${address.toString(16)} data=${data}`
            );
            type = TL_D_Opcode.AccessAckData;
        } else if (isTileLinkWrite(req.type)) {
            console.log(`[${this.name}] BYPASS_WRITE addr=0x${address.toString(16)} latency=${bypassLatency}cy (miss_phase=${this.missLatency}cy + RAM_latency=${lowerLatency}cy)`);
            console.log(
                `[${this.name}] ${this.name} -> ${describeLowerPort(this.lowerPort)} DIRECT_WRITE ` +
                `addr=0x${address.toString(16)} size=${size} access=${req.type} data=${req.value ?? 0}`
            );
            this.lowerPort.directWrite(address, req.value ?? 0, size, req.type);
        } else if (isTileLinkAtomic(req.type)) {
            console.log(`[${this.name}] BYPASS_ATOMIC addr=0x${address.toString(16)} latency=${bypassLatency}cy (miss_phase=${this.missLatency}cy + RAM_latency=${lowerLatency}cy)`);
            console.log(
                `[${this.name}] ${this.name} -> ${describeLowerPort(this.lowerPort)} DIRECT_READ ` +
                `addr=0x${address.toString(16)} size=${size} access=${req.type}`
            );
            data = this.lowerPort.directRead(address, size, req.type) >>> 0;
            const nextValue = applyTileLinkAtomic(req, data, size);
            console.log(
                `[${this.name}] ${this.name} -> ${describeLowerPort(this.lowerPort)} DIRECT_WRITE ` +
                `addr=0x${address.toString(16)} size=${size} access=${req.type} data=${nextValue}`
            );
            this.lowerPort.directWrite(address, nextValue, size, req.type);
            type = TL_D_Opcode.AccessAckData;
        }

        this.statistics.totalCycles += bypassLatency;
        this.pendingResponse = {
            from: this.name,
            to: req.from,
            type,
            data,
            address,
            virtualAddress: req.virtualAddress,
            size
        };
        return bypassLatency;
    }

    // Phục vụ dữ liệu từ block: read trả giá trị, write cập nhật block và write-through xuống lower.
    _serveRequest(block, offset, size, req) {
        if (isTileLinkRead(req.type)) {
            return this._readBlockValue(block, offset, size);
        }

        if (isTileLinkWrite(req.type)) {
            this._writeBlockValue(block, offset, req.value ?? 0, size);
            // Write-through: ghi xuống lower level đồng thời.
            console.log(
                `[${this.name}] ${this.name} -> ${describeLowerPort(this.lowerPort)} DIRECT_WRITE ` +
                `addr=0x${(req.address >>> 0).toString(16)} size=${size} access=write-through data=${req.value ?? 0}`
            );
            this.lowerPort.directWrite(req.address >>> 0, req.value ?? 0, size, 'write-through');
            return 0;
        }

        if (isTileLinkAtomic(req.type)) {
            const oldValue = this._readBlockValue(block, offset, size);
            const nextValue = applyTileLinkAtomic(req, oldValue, size);
            this._writeBlockValue(block, offset, nextValue, size);
            console.log(
                `[${this.name}] ${this.name} -> ${describeLowerPort(this.lowerPort)} DIRECT_WRITE ` +
                `addr=0x${(req.address >>> 0).toString(16)} size=${size} access=write-through data=${nextValue}`
            );
            this.lowerPort.directWrite(req.address >>> 0, nextValue, size, 'write-through');
            return oldValue;
        }

        return 0;
    }

    // Tạo response packet với dữ liệu, địa chỉ và metadata.
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

    // Nạp toàn bộ block byte-by-byte từ lower level.
    _fillBlock(block, blockBase, tag) {
        block.valid = true;
        block.modified = false;
        block.tag = tag >>> 0;
        
        for (let i = 0; i < this.blockSize; i++) {
            block.data[i] = this.lowerPort.directRead((blockBase + i) >>> 0, 0, 'fill') & 0xFF;
        }
    }

    _handleFillRequest(req) {
        const blockBase = (req.blockBase ?? req.address) >>> 0;
        const setIndex = this._getSetIndex(blockBase);
        const tag = this._getTag(blockBase);
        const block = this._findBlock(setIndex, tag);

        this.statistics.numRead++;

        if (block) {
            this.statistics.numHit++;
            this.statistics.totalCycles += this.hitLatency;
            console.log(`[${this.name}] HIT  FILL addr=0x${blockBase.toString(16)} set=${setIndex} tag=0x${tag.toString(16)}`);
            this.pendingBurstResponse = this._createBurstResponse(req, block, blockBase, this.cycle + this.hitLatency);
            return;
        }

        this.statistics.numMiss++;
        this.statistics.totalCycles += this.missLatency;
        const victim = this._selectVictim(setIndex);
        this._prepareVictimForRefill(victim, tag);
        console.log(`[${this.name}] MISS FILL addr=0x${blockBase.toString(16)} set=${setIndex} tag=0x${tag.toString(16)}`);
        this.pendingFill = {
                mode: 'forward', 
                victim, 
                blockBase, 
                tag, 
                req, 
                beatsExpected: this._getBeatCount(), // Số beat cần có để hoàn chỉnh line.
                beatsReceived: 0, // Số beat refill đã nhận từ lower level.
                issued: false, // Đã gửi fill request xuống lower level hay chưa.
                issueCycle: this.cycle + this.missLatency, // Thời điểm bắt đầu issue refill sau miss latency.
                lineReadyCycle: null // Khi đủ beat, line sẽ usable từ chu kỳ này trở đi.
        };
    }

    _advancePendingBurstResponse() {
        const burst = this.pendingBurstResponse;
        if (!burst || this.cycle < burst.readyCycle) return;

        const beatAddress = (burst.blockBase + (burst.nextBeatIndex * REFILL_BEAT_BYTES)) >>> 0;
        const beatBytes = Math.min(REFILL_BEAT_BYTES, this.blockSize - (burst.nextBeatIndex * REFILL_BEAT_BYTES));
        const beatSize = this._bytesToSize(beatBytes);
        const beatData = this._readBlockValue(burst.block, burst.nextBeatIndex * REFILL_BEAT_BYTES, beatBytes);

        burst.replyTo?.receiveResponse?.({
            from: this.name, 
            to: burst.req.from, // Đích logic ban đầu của fill request, thường là cache tầng trên.
            type: TL_D_Opcode.AccessAckData, 
            data: beatData, 
            address: beatAddress, 
            size: beatSize, 
            blockBase: burst.blockBase, 
            refillBeat: true, // Cờ cho biết đây là một beat của quá trình refill, không phải response đơn lẻ bình thường.
            beatIndex: burst.nextBeatIndex, // Thứ tự beat hiện tại trong line, bắt đầu từ 0.
            beatCount: burst.beatCount // Tổng số beat của line, để bên nhận biết khi nào đã nhận đủ.
        });
        console.log(`[${this.name}] SEND_BEAT addr=0x${beatAddress.toString(16)} ${burst.nextBeatIndex + 1}/${burst.beatCount}`);

        burst.nextBeatIndex++;
        if (burst.nextBeatIndex >= burst.beatCount) {
            this.pendingBurstResponse = null;
            return;
        }

        burst.readyCycle = this.cycle + REFILL_TRANSFER_LATENCY;
    }

    _createBurstResponse(req, block, blockBase, readyCycle = this.cycle + REFILL_TRANSFER_LATENCY) {
        return {
            req,
            block,
            blockBase,
            replyTo: req.replyTo,
            nextBeatIndex: 0,
            beatCount: this._getBeatCount(),
            readyCycle
        };
    }

    _supportsBurstRefill() {
        return typeof this.lowerPort?.receiveRequest === 'function';
    }

    _getBeatCount() {
        return Math.ceil(this.blockSize / REFILL_BEAT_BYTES);
    }

    _getBlockSizeLog2() {
        return Math.log2(this.blockSize);
    }

    _prepareVictimForRefill(block, tag) {
        block.valid = false;
        block.modified = false;
        block.tag = tag >>> 0;
        block.data.fill(0);
    }

    _bytesToSize(byteCount) {
        if (byteCount <= 1) return 0;
        if (byteCount <= 2) return 1;
        return 2;
    }

    _sizeToBytes(size) {
        return 1 << (size ?? 2);
    }

    // Tìm block hit trong set cụ thể dựa trên tag.
    _findBlock(setIndex, tag) {
        for (let way = 0; way < this.numWays; way++) {
            const block = this.blocks[setIndex * this.numWays + way];
            if (block.valid && block.tag === (tag >>> 0)) return block;
        }
        return null;
    }

    // Chọn victim theo LRU (block có lastReference nhỏ nhất).
    _selectVictim(setIndex) {
        let victim = null;
        for (let way = 0; way < this.numWays; way++) {
            const block = this.blocks[setIndex * this.numWays + way];
            if (!block.valid) return block;
            if (!victim || block.lastReference < victim.lastReference) victim = block;
        }
        return victim;
    }

    // Cập nhật timestamp LRU của block.
    _touchBlock(block) {
        this.referenceCounter++;
        block.lastReference = this.referenceCounter;
    }

    // Đọc giá trị từ block theo kích thước (byte, half, word).
    _readBlockValue(block, offset, size) {
        let value = block.data[offset] ?? 0;
        if (size >= 1) value |= (block.data[offset + 1] ?? 0) << 8;
        if (size >= 2) {
            value |= (block.data[offset + 2] ?? 0) << 16;
            value |= (block.data[offset + 3] ?? 0) << 24;
        }
        return value >>> 0;
    }

    // Ghi giá trị vào block theo kích thước.
    _writeBlockValue(block, offset, value, size) {
        const normalized = value >>> 0;
        block.data[offset] = normalized & 0xFF;
        if (size >= 1) block.data[offset + 1] = (normalized >>> 8) & 0xFF;
        if (size >= 2) {
            block.data[offset + 2] = (normalized >>> 16) & 0xFF;
            block.data[offset + 3] = (normalized >>> 24) & 0xFF;
        }
    }

    // Cấu trúc địa chỉ nhị phân: [TAG][SET_INDEX][OFFSET]
    // địa chỉ: block base = căn lề blockSize (xóa offset bits).
    _getBlockBase(address) {
        const addr = address >>> 0;
        const offsetMask = ~(this.blockSize - 1);
        return addr & offsetMask;
    }

    // địa chỉ: set index = bits giữa (sau offset, trước tag).
    _getSetIndex(address) {
        const addr = address >>> 0;
        const offsetBits = Math.log2(this.blockSize);  // 4 bits (blockSize=16)
        return (addr >> offsetBits) & (this.numSets - 1);
    }

    // địa chỉ: tag = bits cao nhất (sau offset + set index).
    _getTag(address) {
        const addr = address >>> 0;
        const offsetBits = Math.log2(this.blockSize);   // 4 bits
        const setIndexBits = Math.log2(this.numSets);   // 4 bits
        return addr >> (offsetBits + setIndexBits);
    }
}
