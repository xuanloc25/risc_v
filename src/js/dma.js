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
        const config = this.configWord;
        return {
            numElements: config & 0xFFFFFF,
            reserved: (config >> 24) & 0x7,
            bswap: (config >> 27) & 0x1,
            srcMode: (config >> 28) & 0x3,
            dstMode: (config >> 30) & 0x3
        };
    }

    static createConfig(numElements, bswap = 0, srcMode = 2, dstMode = 2) {
        if (numElements <= 0 || numElements > 0xFFFFFF) {
            throw new Error('Number of elements must be > 0 and <= 16777215');
        }
        return (dstMode << 30) | (srcMode << 28) | (bswap << 27) | numElements;
    }

    toString() {
        const config = this.parseConfig();
        return `DMADescriptor{src:0x${this.sourceAddr.toString(16)}, dst:0x${this.destAddr.toString(16)}, ` +
            `elements:${config.numElements}, srcMode:${config.srcMode}, dstMode:${config.dstMode}, bswap:${config.bswap}}`;
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

        this.waitingRequest = null;
        this.pendingResponse = null;
        this.activeRequestLink = null;
        this.latchedData = 0;
        this.latchedSrcAddr = 0;
        this.latchedDstAddr = 0;
        this.burstRemainingReads = 0;
        this.burstRemainingWrites = 0;
        this.burstDataBuffer = [];
        this.pendingRegReq = null;

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

        const config = DMADescriptor.createConfig(length, 0, 2, 2);
        this.registers.writeDescriptor(src);
        this.registers.writeDescriptor(dst);
        this.registers.writeDescriptor(config);
        this.registers.writeCtrl(3);

        this.callback = callback;
    }

    tick() {

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
        this.currentSrcAddr = this.currentDescriptor.sourceAddr;
        this.currentDstAddr = this.currentDescriptor.destAddr;
        this.transferProgress = 0;
        this.transferStage = null;
        this.waitingRequest = null;
        this.pendingResponse = null;
        this.activeRequestLink = null;
        this.latchedData = 0;
        this.burstRemainingReads = 0;
        this.burstRemainingWrites = 0;
        this.burstDataBuffer = [];

        this.registers.busy = true;
        this.registers.done = false;
        this.registers.error = false;

        console.log(`[DMA] Transfer started: ${this.currentDescriptor.toString()}`);
        console.log(`[DMA] Config: elements=${this.numElements}, bswap=${this.bswap}, srcMode=${this.srcMode}, dstMode=${this.dstMode}`);
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
            if (!this.transferStage) {
                this.latchedSrcAddr = this.calculateAddress(this.currentSrcAddr, this.transferProgress, this.srcMode);
                this.latchedDstAddr = this.calculateAddress(this.currentDstAddr, this.transferProgress, this.dstMode);
                this.transferStage = 'read';
            }

            if (this.transferStage === 'read') {
                if (!this.waitingRequest && !this.pendingResponse) {
                    const readReq = this.buildReadRequest(this.latchedSrcAddr, this.srcMode);
                    const requestLink = this._resolveLink(this.latchedSrcAddr);
                    this.waitingRequest = readReq;
                    this.activeRequestLink = requestLink;
                    console.log(
                        `[DMA] ISSUE_READ via=${describeLink(requestLink)} ` +
                        `element=${this.transferProgress + 1}/${this.numElements} ` +
                        `type=${describeAOpcode(readReq.type)} addr=${hex(readReq.address)} size=${1 << readReq.size}B`
                    );
                    requestLink.sendRequest('dma', readReq);
                    return;
                }

                if (this.pendingResponse) {
                    let data = this.pendingResponse.data >>> 0;
                    if (this.bswap) {
                        data = this.swapBytes(data, this.getElementSize(this.srcMode));
                    }
                    // Push payload into data FIFO; stall if FIFO is full
                    if (!this.registers.writeDataFifo(data)) {
                        console.log('[DMA] Data FIFO full, stalling read completion');
                        return;
                    }
                    this.pendingResponse = null;
                    this.waitingRequest = null;
                    this.activeRequestLink = null;
                    this.transferStage = 'write';
                }
                return;
            }

            if (this.transferStage === 'write') {
                if (!this.waitingRequest && !this.pendingResponse) {
                    const dataToWrite = this.registers.readDataFifo();
                    if (dataToWrite == null) {
                        console.log('[DMA] Data FIFO empty, stalling write');
                        return;
                    }
                    const writeReq = this.buildWriteRequest(this.latchedDstAddr, dataToWrite, this.dstMode);
                    const requestLink = this._resolveLink(this.latchedDstAddr);
                    this.waitingRequest = writeReq;
                    this.activeRequestLink = requestLink;
                    console.log(
                        `[DMA] ISSUE_WRITE via=${describeLink(requestLink)} ` +
                        `element=${this.transferProgress + 1}/${this.numElements} ` +
                        `type=${describeAOpcode(writeReq.type)} addr=${hex(writeReq.address)} ` +
                        `size=${1 << writeReq.size}B data=${hex(writeReq.value ?? 0)}`
                    );
                    requestLink.sendRequest('dma', writeReq);
                    return;
                }

                if (this.pendingResponse) {
                    this.pendingResponse = null;
                    this.waitingRequest = null;
                    this.activeRequestLink = null;
                    this.transferProgress++;
                    this.transferStage = null;
                    console.log(`[DMA] Progress: ${this.transferProgress}/${this.numElements}`);
                    if (this.transferProgress >= this.numElements) {
                        this.completeTransfer();
                    }
                }
            }
        } catch (error) {
            console.error(`[DMA] Transfer error: ${error.message}`);
            this.registers.error = true;
            this.registers.busy = false;
            this.currentDescriptor = null;
        }
    }

    calculateAddress(baseAddr, progress, mode) {
        switch (mode) {
            case 0:
            case 1:
                return baseAddr;
            case 2:
                return baseAddr + progress;
            case 3:
                return baseAddr + (progress * 4);
            default:
                throw new Error(`Invalid address mode: ${mode}`);
        }
    }

    getElementSize(mode) {
        switch (mode) {
            case 0:
            case 2:
                return 1;
            case 1:
            case 3:
                return 4;
            default:
                return 1;
        }
    }

    buildReadRequest(address, mode) {
        switch (mode) {
            case 0:
            case 2:
                return { type: TL_A_Opcode.Get, address, size: 0 };
            case 1:
            case 3:
                return { type: TL_A_Opcode.Get, address, size: 2 };
            default:
                throw new Error(`Invalid read mode: ${mode}`);
        }
    }

    buildWriteRequest(address, data, mode) {
        switch (mode) {
            case 0:
            case 2:
                return { type: TL_A_Opcode.PutPartialData, address, value: data & 0xFF, size: 0 };
            case 1:
            case 3:
                return { type: TL_A_Opcode.PutFullData, address, value: data >>> 0, size: 2 };
            default:
                throw new Error(`Invalid write mode: ${mode}`);
        }
    }

    receiveResponse(resp) {
        console.log(
            `[DMA] RECEIVE_RESPONSE via=${describeLink(this.activeRequestLink ?? this.defaultLink)} ` +
            `from=${resp.from} type=${describeDOpcode(resp.type)} addr=${hex(resp.address)}${resp.data != null ? ` data=0x${(resp.data >>> 0).toString(16)}` : ''}`
        );
        this.pendingResponse = resp;
    }

    swapBytes(data, size) {
        if (size === 1) {
            return data;
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
        this.waitingRequest = null;
        this.pendingResponse = null;
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
