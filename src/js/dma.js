import { TL_A_Opcode, TL_D_Opcode, getOpcodeName } from './tilelink.js';

function describeLink(link) {
    return link?.name ?? link?.signals?.label ?? link?.constructor?.name ?? 'TileLink';
}

function describeAOpcode(type) {
    return typeof type === 'number' ? getOpcodeName(TL_A_Opcode, type) : String(type);
}

function describeDOpcode(type) {
    return typeof type === 'number' ? getOpcodeName(TL_D_Opcode, type) : String(type);
}

function hex(value) {
    return `0x${(value >>> 0).toString(16)}`;
}

// DMA descriptor and controller implementation
export class DMADescriptor {
    constructor(sourceAddr = 0, destAddr = 0, configWord = 0) {
        this.sourceAddr = sourceAddr;
        this.destAddr = destAddr;
        this.configWord = configWord;
    }

    parseConfig() {
        const config = this.configWord >>> 0;
        return {
            dstMode: (config >>> 30) & 0x3,     // bits [31:30] destination address mode: 0=fixed,1=inc,2=dec
            srcMode: (config >>> 28) & 0x3,     // bits [29:28] source address mode
            srcWidth: (config >>> 26) & 0x3,    // bits [27:26] source element width: 0=8-bit,1=16-bit,2=32-bit
            dstWidth: (config >>> 24) & 0x3,    // bits [25:24] destination element width
            burstSize: (config >>> 21) & 0x7,   // bits [23:21] burst size code (0=1 beat, 1=4, 2=8, ...)
            bswap: (config >>> 20) & 0x1,       // bit 20: byte-swap (endian) enable
            reserved: (config >>> 16) & 0xF,    // bits [19:16] reserved (unused)
            numElements: config & 0xFFFF        // bits [15:0] number of destination elements (count)
        };
    }

    static createConfig(numElements, bswap = 0, srcMode = 3, dstMode = 3, srcWidth = 2, dstWidth = 2, burstSize = 0, reserved = 0) {
        if (numElements <= 0 || numElements > 0xFFFF) {
            throw new Error('Number of elements must be > 0 and <= 65535');
        }
        const cfg = ((dstMode & 0x3) << 30) |
            ((srcMode & 0x3) << 28) |
            ((srcWidth & 0x3) << 26) |
            ((dstWidth & 0x3) << 24) |
            ((burstSize & 0x7) << 21) |
            ((bswap & 0x1) << 20) |
            ((reserved & 0xF) << 16) |
            (numElements & 0xFFFF);

        return cfg >>> 0;
    }

    toString() {
        const config = this.parseConfig();
        return `DMADescriptor{src:0x${this.sourceAddr.toString(16)}, dst:0x${this.destAddr.toString(16)}, ` +
            `elements:${config.numElements}, srcMode:${config.srcMode}, dstMode:${config.dstMode}, ` +
            `srcWidth:${config.srcWidth}, dstWidth:${config.dstWidth}, burstSize:${config.burstSize}, bswap:${config.bswap}}`;
    }
}

export class DMARegisters {
    constructor() {
        this.enabled = false;
        this.startRequested = false;
        this.busy = false;
        this.done = false;
        this.error = false;
        this.descriptorFifo = [];
        this.fifoDepth = 8;
        this.currentDescriptorWords = [];

        // Data FIFO for payloads (separate from descriptor FIFO)
        this.dataFifo = [];
        this.dataFifoDepth = 64;

        console.log(`[DMA] Registers initialized. FIFO depth: ${this.fifoDepth}`);
    }

    // Descriptor FIFO computed helpers
    get fifoCount() {
        return this.descriptorFifo.length;
    }

    get fifoEmpty() {
        return this.descriptorFifo.length === 0;
    }

    get fifoFull() {
        return this.descriptorFifo.length >= this.fifoDepth;
    }

    // Data FIFO computed helpers
    get dataFifoCount() {
        return this.dataFifo.length;
    }

    get dataFifoEmpty() {
        return this.dataFifo.length === 0;
    }

    get dataFifoFull() {
        return this.dataFifo.length >= this.dataFifoDepth;
    }

    // Return a snapshot of data FIFO contents (as unsigned 32-bit numbers)
    dumpDataFifo() {
        return this.dataFifo.map(v => v >>> 0);
    }

    writeDataFifo(word) {
        if (this.dataFifoFull) {
            return false;
        }
        this.dataFifo.push(word >>> 0);
        // Log FIFO snapshot to system log console
        try {
            const hexContents = this.dataFifo.map(v => '0x' + (v >>> 0).toString(16));
            console.log(`[DMA][DATAFIFO] PUSH value=0x${(word>>>0).toString(16)} count=${this.dataFifo.length} contents=${hexContents.join(',')}`);
        } catch (e) {
            console.log('[DMA][DATAFIFO] PUSH (error formatting contents)');
        }
        return true;
    }

    readDataFifo() {
        if (this.dataFifoEmpty) return null;
        const v = this.dataFifo.shift();
        // Log FIFO snapshot after pop
        try {
            const hexContents = this.dataFifo.map(x => '0x' + (x >>> 0).toString(16));
            console.log(`[DMA][DATAFIFO] POP value=0x${(v>>>0).toString(16)} count=${this.dataFifo.length} contents=${hexContents.join(',')}`);
        } catch (e) {
            console.log('[DMA][DATAFIFO] POP (error formatting contents)');
        }
        return v >>> 0;
    }

    readCtrl() {
        let ctrl = 0;
        if (this.enabled) ctrl |= 0x1;
        if (this.startRequested) ctrl |= 0x2;
        if (this.done) ctrl |= 0x4;

        const fifoDepthLog2 = Math.log2(this.fifoDepth);
        ctrl |= (fifoDepthLog2 & 0xF) << 16;

        if (this.fifoEmpty) ctrl |= (1 << 27);
        if (this.fifoFull) ctrl |= (1 << 28);
        // Data FIFO status: bits 24 = empty, 25 = full
        if (this.dataFifoEmpty) ctrl |= (1 << 24);
        if (this.dataFifoFull) ctrl |= (1 << 25);
        // Data FIFO count (8 bits) at bits [8..15]
        const dataCount = (this.dataFifo?.length ?? 0) & 0xFF;
        ctrl |= (dataCount << 8);
        if (this.error) ctrl |= (1 << 29);
        if (this.done) ctrl |= (1 << 30);
        if (this.busy) ctrl |= (1 << 31);

        return ctrl >>> 0;
    }

    writeCtrl(value) {
        console.log(`[DMA] Writing CTRL: 0x${value.toString(16)}`);

        const newEnabled = (value & 0x1) !== 0;
        if (newEnabled !== this.enabled) {
            this.enabled = newEnabled;
            if (!this.enabled) {
                this.reset();
                console.log('[DMA] DMA disabled and reset');
            } else {
                console.log('[DMA] DMA enabled');
            }
        }

        if (value & 0x2) {
            this.startRequested = true;
            console.log('[DMA] Start transfer requested');
        }

        if (value & (1 << 27)) {
            this.done = false;
            this.error = false;
            console.log('[DMA] Interrupts acknowledged');
        }

        return true;
    }

    writeDescriptor(word) {
        console.log(`[DMA DESC] Writing descriptor word: 0x${(word >>> 0).toString(16)}, currentWords=${this.currentDescriptorWords.length}`);
        if (this.fifoFull) {
            console.warn('[DMA] Cannot write descriptor: FIFO is full');
            return false;
        }

        this.currentDescriptorWords.push(word);
        console.log(`[DMA] Descriptor word ${this.currentDescriptorWords.length}/3: 0x${(word >>> 0).toString(16)}`);

        if (this.currentDescriptorWords.length === 3) {
            const descriptor = new DMADescriptor(
                this.currentDescriptorWords[0],
                this.currentDescriptorWords[1],
                this.currentDescriptorWords[2]
            );

            this.descriptorFifo.push(descriptor);
            this.currentDescriptorWords = [];

            // descriptor FIFO status is computed via getters

            console.log(`[DMA] Descriptor added: ${descriptor.toString()}`);
            console.log(`[DMA] FIFO status: ${this.descriptorFifo.length}/${this.fifoDepth} entries`);
        }

        return true;
    }

    getNextDescriptor() {
        if (this.fifoEmpty) return null;

        const descriptor = this.descriptorFifo.shift();

        // descriptor FIFO status is computed via getters

        console.log(`[DMA] Retrieved descriptor: ${descriptor.toString()}`);
        console.log(`[DMA] FIFO entries remaining: ${this.descriptorFifo.length}`);

        return descriptor;
    }

    reset() {
        this.busy = false;
        this.done = false;
        this.error = false;
        this.startRequested = false;
        this.descriptorFifo = [];
        this.currentDescriptorWords = [];
        // clear data FIFO as well
        this.dataFifo = [];
        // reset prefetch progress/state
        this.readProgress = 0;
        this.prefetchMode = false;
        // FIFO status flags are computed; arrays cleared above
        console.log('[DMA] Reset completed');
    }

    canStartTransfer() {
        return this.enabled && !this.busy && !this.fifoEmpty && this.startRequested;
    }
}

function isTileLinkPort(value) {
    return !!value && typeof value.sendRequest === 'function' && typeof value.sendResponse === 'function';
}

export class DMAController {
    constructor(tileLinkOrPorts = null) {
        if (isTileLinkPort(tileLinkOrPorts)) {
            this.tilelink_UH = tileLinkOrPorts;
            this.tilelink_UL = tileLinkOrPorts;
            this.registerLink = tileLinkOrPorts;
            this.selectLinkForAddress = () => tileLinkOrPorts;
        } else {
            const ports = tileLinkOrPorts ?? {};
            this.tilelink_UH = ports.tilelink_UH ?? null;
            this.tilelink_UL = ports.tilelink_UL ?? ports.tilelink_UH ?? null;
            this.registerLink = ports.registerLink ?? ports.tilelink_UH ?? ports.tilelink_UL ?? null;
            this.selectLinkForAddress = ports.selectLinkForAddress ?? ((address) => {
                void address;
                return this.tilelink_UH ?? this.tilelink_UL ?? this.registerLink;
            });
        }

        this.defaultLink = this.registerLink ?? this.tilelink_UH ?? this.tilelink_UL;
        this.registers = new DMARegisters();

        this.currentDescriptor = null;
        this.transferProgress = 0;
        this.currentSrcAddr = 0;
        this.currentDstAddr = 0;

        this.numElements = 0;
        this.bswap = false;
        this.srcMode = 0;
        this.dstMode = 0;

        this.callback = null;

        // Queues to allow multiple outstanding requests/responses for bursting
        this.waitingRequests = [];
        this.pendingResponses = [];
        this.activeRequestLink = null;
        this.burstRemainingReads = 0;
        this.burstRemainingWrites = 0;
        this.pendingRegReq = null;

        this.isDraining = false; //Quản lý trạng thái ép xả cạn FIFO

        // Note: use `waitingRequests` array to hold queued requests so the send occurs next tick

        console.log('[DMA] Controller initialized');
    }

    setBuses({
        tilelink_UH = this.tilelink_UH,
        tilelink_UL = this.tilelink_UL,
        registerLink = this.registerLink,
        selectLinkForAddress = this.selectLinkForAddress
    } = {}) {
        this.tilelink_UH = tilelink_UH;
        this.tilelink_UL = tilelink_UL ?? tilelink_UH;
        this.registerLink = registerLink ?? tilelink_UH ?? tilelink_UL;
        this.selectLinkForAddress = selectLinkForAddress;
        this.defaultLink = this.registerLink ?? this.tilelink_UH ?? this.tilelink_UL;
    }

    receiveRequest(req) {
        const registerLink = this.registerLink ?? this.defaultLink;
        console.log(
            `[DMA] REGISTER_REQUEST via=${describeLink(registerLink)} ` +
            `from=${req.from} type=${describeAOpcode(req.type)} addr=${hex(req.address)} value=${req.value ?? ''}`
        );
        this.pendingRegReq = req;
    }

    readRegister(address) {
        switch (address) {
            case 0xFFED0000: {
                const ctrl = this.registers.readCtrl();
                console.log(`[DMA] Read CTRL: 0x${ctrl.toString(16)}`);
                return ctrl;
            }
            case 0xFFED0004:
                console.warn('[DMA] DESC register is write-only');
                return 0;
            default:
                console.warn(`[DMA] Read from unknown register: 0x${address.toString(16)}`);
                return 0;
        }
    }

    writeRegister(address, value) {
        console.log(`[DMA DEBUG] Write to 0x${(address >>> 0).toString(16)} = 0x${(value >>> 0).toString(16)}`);
        switch (address) {
            case 0xFFED0000:
                console.log(`[DMA DEBUG] CTRL write: enabled=${!!(value & 1)}, start=${!!(value & 2)}`);
                return this.registers.writeCtrl(value);
            case 0xFFED0004:
                return this.registers.writeDescriptor(value);
            default:
                console.warn(`[DMA] Write to unknown register: 0x${address.toString(16)}`);
                return false;
        }
    }

    start(src, dst, length, callback) {
        console.log(`[DMA] Legacy start: src=0x${src.toString(16)}, dst=0x${dst.toString(16)}, length=${length}`);

        this.registers.writeCtrl(1);

        // Legacy start: use incrementing addresses and 32-bit widths by default
        const config = DMADescriptor.createConfig(length, 0, 1, 1, 2, 2);
        this.registers.writeDescriptor(src);
        this.registers.writeDescriptor(dst);
        this.registers.writeDescriptor(config);
        this.registers.writeCtrl(3);

        this.callback = callback;
    }

    tick() {

        // Send any queued requests (allow multiple outstanding to pipeline bursts)
        if (this.waitingRequests && this.waitingRequests.length > 0) {
            for (const w of this.waitingRequests) {
                if (w && w.req && !w.__sent) {
                    try {
                        w.link.sendRequest(w.from, w.req);
                        w.__sent = true;
                        this.activeRequestLink = w.link;
                    } catch (e) {
                        console.error('[DMA] Error sending queued request', e);
                    }
                }
            }
        }

        if (this.registers.canStartTransfer()) {
            this.startNextTransfer();
            this.registers.startRequested = false;
        }

        if (this.registers.busy && this.currentDescriptor) {
            this.performTransferStep();
        }

        if (this.pendingRegReq) {
            const { address, type, value } = this.pendingRegReq;
            let data = 0;
            let responseType = TL_D_Opcode.AccessAck;

            if (address === 0xFFED0000) {
                if (type === TL_A_Opcode.Get || type === 'read') {
                    data = this.registers.readCtrl();
                    responseType = TL_D_Opcode.AccessAckData;
                } else if (type === TL_A_Opcode.PutFullData || type === TL_A_Opcode.PutPartialData || type === 'write') {
                    this.registers.writeCtrl(value);
                }
            } else if (address === 0xFFED0004) {
                if (type === TL_A_Opcode.Get || type === 'read') {
                    responseType = TL_D_Opcode.AccessAckData;
                } else if (type === TL_A_Opcode.PutFullData || type === TL_A_Opcode.PutPartialData || type === 'write') {
                    this.registers.writeDescriptor(value);
                }
            } else {
                console.warn(`[DMA] Unknown register access at 0x${address.toString(16)}`);
            }

            const registerLink = this.registerLink ?? this.defaultLink;
            if (registerLink) {
                console.log(
                    `[DMA] REGISTER_RESPONSE via=${describeLink(registerLink)} ` +
                    `to=${this.pendingRegReq.from} type=${describeDOpcode(responseType)} ` +
                    `addr=${hex(address)} data=${data ?? ''}`
                );
                registerLink.sendResponse({
                    from: 'dma-regs',
                    to: this.pendingRegReq.from,
                    type: responseType,
                    data,
                    address,
                    size: this.pendingRegReq.size
                });
            }

            this.pendingRegReq = null;
            return;
        }
    }

    startNextTransfer() {
        this.currentDescriptor = this.registers.getNextDescriptor();
        if (!this.currentDescriptor) {
            console.warn('[DMA] No descriptors available to start');
            return false;
        }

        const config = this.currentDescriptor.parseConfig();

        this.numElements = config.numElements;
        this.bswap = config.bswap !== 0;
        this.srcMode = config.srcMode;
        this.dstMode = config.dstMode;
        this.srcWidth = config.srcWidth;
        this.dstWidth = config.dstWidth;
        this.burstSize = config.burstSize;
        this.currentSrcAddr = this.currentDescriptor.sourceAddr;
        this.currentDstAddr = this.currentDescriptor.destAddr;
        this.transferProgress = 0; // counts destination elements written
        this.transferStage = null;
        // track read-prefetch progress separately from write progress
        this.readProgress = 0;
        // if FIFO can hold the whole transfer, enable strict prefetch mode
        this.prefetchMode = (this.registers.dataFifoDepth >= this.numElements);
        this.waitingRequests = [];
        this.pendingResponses = [];
        this.activeRequestLink = null;
        this.burstRemainingReads = 0;
        this.burstRemainingWrites = 0;

        this.registers.busy = true;
        this.registers.done = false;
        this.registers.error = false;

        this.isDraining = false;

        console.log(`[DMA] Transfer started: ${this.currentDescriptor.toString()}`);
        console.log(`[DMA] Config: elements=${this.numElements}, bswap=${this.bswap}, srcMode=${this.srcMode}, dstMode=${this.dstMode}, srcWidth=${this.srcWidth}, dstWidth=${this.dstWidth}`);
        console.log(
            `[DMA] TileLink route src=${hex(this.currentSrcAddr)} via=${describeLink(this._resolveLink(this.currentSrcAddr))} ` +
            `dst=${hex(this.currentDstAddr)} via=${describeLink(this._resolveLink(this.currentDstAddr))}`
        );
        return true;
    }

    performTransferStep() {
        if (this.transferProgress >= this.numElements) {
            this.completeTransfer();
            return;
        }

        try {
            const srcElemSize = this.getElementSize(this.srcWidth);
            const dstElemSize = this.getElementSize(this.dstWidth);
            
            // Tổng số byte cần đọc từ nguồn để phục vụ đủ nhu cầu ghi ở đích
            const totalSrcBytesNeeded = Math.ceil((this.numElements * dstElemSize) / srcElemSize) * srcElemSize;
            
            // Định nghĩa độ dài chuỗi Burst dựa trên burstSize: 0 -> 1 beat, 1 -> 4 beats, 2 -> 8 beats, 3 -> 16 beats...
            const maxBurstBeats = this.burstSize === 0 ? 1 : (1 << (this.burstSize + 1));

            // --- 1. KHỞI TẠO CHU KỲ BURST MỚI KHI CẢ HAI TRẠNG THÁI VỀ 0 ---
            if (this.burstRemainingReads === 0 && this.burstRemainingWrites === 0) {
                const remainingSrcBeats = Math.ceil((totalSrcBytesNeeded - this.readProgress) / srcElemSize);
                const freeSpaceBytes = this.registers.dataFifoDepth - this.registers.dataFifo.length;
                const maxReadsForFifo = Math.floor(freeSpaceBytes / srcElemSize);

                // --- LOGIC ĐIỀU KHIỂN LUỒNG HYSTERESIS (CHỐNG PING-PONG) ---
                if (this.registers.dataFifoFull) {
                    // Khi FIFO đầy khít, bật chế độ ÉP XẢ (Draining Mode) để khóa mạch READ lại
                    this.isDraining = true;
                    console.log(`[DMA][FLOW CONTROL] FIFO FULL (${this.registers.dataFifo.length}/${this.registers.dataFifoDepth}). Kích hoạt Draining Mode: Chặn READ, ép WRITE liên tục!`);
                } else if (this.registers.dataFifoEmpty) {
                    // Chỉ khi nào xả cạn sạch hoàn toàn (Empty), mới giải phóng cờ để cho phép READ tiếp
                    this.isDraining = false;
                }

                // ĐIỀU KIỆN READ: Phải còn dữ liệu nguồn, FIFO còn chỗ VÀ KHÔNG nằm trong chế độ ép xả (!this.isDraining)
                if (remainingSrcBeats > 0 && maxReadsForFifo > 0 && !this.isDraining) {
                    this.burstRemainingReads = Math.min(maxBurstBeats, maxReadsForFifo, remainingSrcBeats);
                    console.log(`[DMA] >>> Starting READ BURST: ${this.burstRemainingReads} beats consecutive`);
                }
                // Ngược lại, chuyển sang kích hoạt WRITE BURST để xả dữ liệu từ FIFO ra ngoại vi 
                else {
                    const availableDstElements = Math.floor(this.registers.dataFifo.length / dstElemSize);
                    const remainingDstElements = this.numElements - this.transferProgress;

                    if (remainingDstElements > 0 && availableDstElements > 0) {
                        this.burstRemainingWrites = Math.min(maxBurstBeats, availableDstElements, remainingDstElements);
                        console.log(`[DMA] >>> Starting WRITE BURST: ${this.burstRemainingWrites} beats consecutive`);
                    } else if (remainingDstElements > 0 && availableDstElements === 0 && remainingSrcBeats === 0) {
                        // Trường hợp đặc biệt: Hết dữ liệu nguồn để đọc nhưng dữ liệu dư trong FIFO không đủ tạo thành 1 phần tử đích
                        console.warn(`[DMA] Stalling: Trailing bytes in FIFO cannot form a complete destination element.`);
                        this.completeTransfer();
                        return;
                    } else {
                        if (this.transferProgress >= this.numElements) {
                            this.completeTransfer();
                        }
                        return;
                    }
                }
            }

            // --- 2. THỰC THI CHUỖI READ BURST (ĐỌC LIÊN TIẾP TỪ RAM) ---
            if (this.burstRemainingReads > 0) {
                // If no outstanding read request enqueued for this burst, create a single multi-beat GET
                if (this.waitingRequests.length === 0) {
                    const readsToEnqueue = this.burstRemainingReads;
                    const startAddr = this.calculateAddress(this.currentSrcAddr, this.readProgress / srcElemSize, this.srcMode, srcElemSize);
                    const totalBytes = readsToEnqueue * srcElemSize;
                    const sizeLog2 = Math.log2(totalBytes) >>> 0;
                    const readReq = { type: TL_A_Opcode.Get, address: startAddr, size: sizeLog2 };
                    const requestLink = this._resolveLink(startAddr);
                    // expectedBeats helps us know when the burst completes
                    this.waitingRequests.push({ req: readReq, link: requestLink, from: 'dma', __sent: false, expectedBeats: readsToEnqueue });
                    console.log(`[DMA] Enqueued multi-beat READ addr=0x${startAddr.toString(16)} bytes=${totalBytes} size=${sizeLog2}`);
                    return; // let tick() send the queued request(s)
                }

                // Process pending beat responses from memory
                if (this.pendingResponses.length > 0) {
                    const resp = this.pendingResponses.shift();
                    let data = resp.data >>> 0;
                    if (this.bswap) data = this.swapBytes(data, srcElemSize);

                    if (this.srcWidth === 2) { // 32-bit Word
                        this.registers.writeDataFifo(data & 0xFF);
                        this.registers.writeDataFifo((data >>> 8) & 0xFF);
                        this.registers.writeDataFifo((data >>> 16) & 0xFF);
                        this.registers.writeDataFifo((data >>> 24) & 0xFF);
                    } else if (this.srcWidth === 1) { // 16-bit Halfword
                        this.registers.writeDataFifo(data & 0xFF);
                        this.registers.writeDataFifo((data >>> 8) & 0xFF);
                    } else { // 8-bit Byte
                        this.registers.writeDataFifo(data & 0xFF);
                    }

                    this.activeRequestLink = null;
                    this.readProgress += srcElemSize;
                    this.burstRemainingReads--; // one beat satisfied

                    // If this response marks the end of the multi-beat (lastBeat) or we've satisfied all expected beats, remove queued request
                    const queued = this.waitingRequests[0];
                    if (resp.lastBeat || (queued && typeof queued.expectedBeats === 'number' && this.burstRemainingReads <= 0)) {
                        this.waitingRequests.shift();
                    }

                    return;
                }

                return;
            }

            // --- 3. THỰC THI CHUỖI WRITE BURST (GHI LIÊN TIẾP RA ĐÍCH) ---
            if (this.burstRemainingWrites > 0) {
                // enqueue a sequence of write beats for this burst if none queued yet
                if (this.waitingRequests.length === 0) {
                    const writesToEnqueue = this.burstRemainingWrites;
                    for (let i = 0; i < writesToEnqueue; i++) {
                        let dataToWrite = 0;
                        // pack bytes from FIFO for each destination element
                        if (this.dstWidth === 2) {
                            const b0 = this.registers.readDataFifo();
                            const b1 = this.registers.readDataFifo();
                            const b2 = this.registers.readDataFifo();
                            const b3 = this.registers.readDataFifo();
                            dataToWrite = b0 | (b1 << 8) | (b2 << 16) | (b3 << 24);
                        } else if (this.dstWidth === 1) {
                            const b0 = this.registers.readDataFifo();
                            const b1 = this.registers.readDataFifo();
                            dataToWrite = b0 | (b1 << 8);
                        } else {
                            dataToWrite = this.registers.readDataFifo();
                        }

                        const addr = this.calculateAddress(this.currentDstAddr, this.transferProgress + i, this.dstMode, dstElemSize);
                        const writeReq = this.buildWriteRequest(addr, dataToWrite, this.dstWidth);
                        const requestLink = this._resolveLink(addr);
                        this.waitingRequests.push({ req: writeReq, link: requestLink, from: 'dma', __sent: false });
                        console.log(
                            `[DMA] BURST_WRITE queued via=${describeLink(requestLink)} ` +
                            `element=${this.transferProgress + i + 1}/${this.numElements} ` +
                            `addr=0x${addr.toString(16)} data=0x${dataToWrite.toString(16)}`
                        );
                        console.log(`[DMA] Sending queued request via=${describeLink(requestLink)} addr=0x${addr.toString(16)} (queued)`);
                    }
                    return;
                }

                // process any incoming write ack
                if (this.pendingResponses.length > 0) {
                    this.pendingResponses.shift();
                    if (this.waitingRequests.length > 0) this.waitingRequests.shift();
                    this.activeRequestLink = null;
                    this.transferProgress++;
                    this.burstRemainingWrites--; // Giảm số lượng beat cần ghi của chuỗi burst hiện tại
                    console.log(`[DMA] Progress: ${this.transferProgress}/${this.numElements}`);

                    if (this.transferProgress >= this.numElements) {
                        this.completeTransfer();
                    }
                    return;
                }
            }
        } catch (error) {
            console.error(`[DMA] Transfer error: ${error.message}`);
            this.registers.error = true;
            this.registers.busy = false;
            this.currentDescriptor = null;
        }
    }

    calculateAddress(baseAddr, progress, mode, elementSize) {
        // mode: 0 = Fixed, 1 = Increment, 2 = Decrement
        switch (mode) {
            case 0: // Fixed
                return baseAddr;
            case 1: // Increment
                return baseAddr + (progress * elementSize);
            case 2: // Decrement
                return baseAddr - (progress * elementSize);
            default:
                throw new Error(`Invalid address mode: ${mode}`);
        }
    }

    getElementSize(width) {
        // width: 0 = 8-bit, 1 = 16-bit, 2 = 32-bit
        switch (width) {
            case 0:
                return 1;
            case 1:
                return 2;
            case 2:
                return 4;
            default:
                return 1;
        }
    }

    buildReadRequest(address, width) {
        // width -> TL size field: 0=byte,1=halfword,2=word
        let size = 0;
        switch (width) {
            case 0: size = 0; break;
            case 1: size = 1; break;
            case 2: size = 2; break;
            default: size = 0;
        }
        return { type: TL_A_Opcode.Get, address, size };
    }

    buildWriteRequest(address, data, width) {
        // width -> TL size and opcode
        switch (width) {
            case 0: // byte
                return { type: TL_A_Opcode.PutPartialData, address, value: data & 0xFF, size: 0 };
            case 1: // halfword
                return { type: TL_A_Opcode.PutPartialData, address, value: data & 0xFFFF, size: 1 };
            case 2: // word
                return { type: TL_A_Opcode.PutFullData, address, value: data >>> 0, size: 2 };
            default:
                throw new Error(`Invalid write width: ${width}`);
        }
    }

        // Note: requests are queued by pushing `{ req, link, from, __sent:false }` into `this.waitingRequests`.

    receiveResponse(resp) {
        console.log(
            `[DMA] RECEIVE_RESPONSE via=${describeLink(this.activeRequestLink ?? this.defaultLink)} ` +
            `from=${resp.from} type=${describeDOpcode(resp.type)} addr=${hex(resp.address)}${resp.data != null ? ` data=0x${(resp.data >>> 0).toString(16)}` : ''}`
        );
        // enqueue response for processing by performTransferStep
        this.pendingResponses.push(resp);
    }

    swapBytes(data, size) {
        if (size === 1) {
            return data;
        }
        if (size === 2) {
            return ((data & 0xFF) << 8) |
                ((data >> 8) & 0xFF);
        }
        if (size === 4) {
            return ((data & 0xFF) << 24) |
                (((data >> 8) & 0xFF) << 16) |
                (((data >> 16) & 0xFF) << 8) |
                ((data >> 24) & 0xFF);
        }
        return data;
    }

    completeTransfer() {
        this.registers.busy = false;
        this.registers.done = true;

        this.transferStage = null;
        this.waitingRequests = [];
        this.pendingResponses = [];
        this.activeRequestLink = null;

        console.log(`[DMA] Transfer completed successfully: ${this.transferProgress} elements transferred`);

        if (typeof this.callback === 'function') {
            this.callback();
            this.callback = null;
        }

        this.currentDescriptor = null;
        this.transferProgress = 0;

        if (!this.registers.fifoEmpty) {
            console.log('[DMA] More descriptors in FIFO, will start next transfer on next tick');
        }
    }

    getStatus() {
        return {
            enabled: this.registers.enabled,
            busy: this.registers.busy,
            done: this.registers.done,
            error: this.registers.error,
            fifoEmpty: this.registers.fifoEmpty,
            fifoFull: this.registers.fifoFull,
            fifoCount: this.registers.descriptorFifo.length,
            currentTransfer: this.currentDescriptor ? {
                progress: this.transferProgress,
                total: this.numElements,
                srcAddr: this.currentSrcAddr,
                dstAddr: this.currentDstAddr
            } : null
        };
    }

    get isBusy() {
        return this.registers.busy;
    }

    _resolveLink(address) {
        const selected = typeof this.selectLinkForAddress === 'function'
            ? this.selectLinkForAddress(address)
            : null;
        const tileLink = selected ?? this.tilelink_UH ?? this.tilelink_UL ?? this.registerLink;
        if (!tileLink) {
            throw new Error('DMA has no available TileLink link');
        }
        return tileLink;
    }
}
