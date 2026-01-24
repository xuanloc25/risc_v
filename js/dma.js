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
        this.fifoFull = false;
        this.fifoEmpty = true;

        this.descriptorFifo = [];
        this.fifoDepth = 8;
        this.currentDescriptorWords = [];

        console.log(`[DMA] Registers initialized. FIFO depth: ${this.fifoDepth}`);
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
        console.log(`[DMA DESC] Writing descriptor word: 0x${word.toString(16)}, currentWords=${this.currentDescriptorWords.length}`);
        if (this.fifoFull) {
            console.warn('[DMA] Cannot write descriptor: FIFO is full');
            return false;
        }

        this.currentDescriptorWords.push(word);
        console.log(`[DMA] Descriptor word ${this.currentDescriptorWords.length}/3: 0x${word.toString(16)}`);

        if (this.currentDescriptorWords.length === 3) {
            const descriptor = new DMADescriptor(
                this.currentDescriptorWords[0],
                this.currentDescriptorWords[1],
                this.currentDescriptorWords[2]
            );

            this.descriptorFifo.push(descriptor);
            this.currentDescriptorWords = [];

            this.fifoEmpty = false;
            this.fifoFull = (this.descriptorFifo.length >= this.fifoDepth);

            console.log(`[DMA] Descriptor added: ${descriptor.toString()}`);
            console.log(`[DMA] FIFO status: ${this.descriptorFifo.length}/${this.fifoDepth} entries`);
        }

        return true;
    }

    getNextDescriptor() {
        if (this.fifoEmpty) return null;

        const descriptor = this.descriptorFifo.shift();

        this.fifoEmpty = (this.descriptorFifo.length === 0);
        this.fifoFull = false;

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
        this.fifoEmpty = true;
        this.fifoFull = false;
        console.log('[DMA] Reset completed');
    }

    canStartTransfer() {
        return this.enabled && !this.busy && !this.fifoEmpty && this.startRequested;
    }
}

export class DMAController {
    constructor(bus) {
        this.bus = bus;
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

        // Async bus state
        this.waitingRequest = null;
        this.pendingResponse = null;
        this.transferStage = null; // 'read' | 'write'
        this.latchedData = 0;
        this.latchedSrcAddr = 0;
        this.latchedDstAddr = 0;

        console.log('[DMA] Controller initialized');
    }

    readRegister(address) {
        switch (address) {
            case 0xFFED0000:
                const ctrl = this.registers.readCtrl();
                console.log(`[DMA] Read CTRL: 0x${ctrl.toString(16)}`);
                return ctrl;
            case 0xFFED0004:
                console.warn('[DMA] DESC register is write-only');
                return 0;
            default:
                console.warn(`[DMA] Read from unknown register: 0x${address.toString(16)}`);
                return 0;
        }
    }

    writeRegister(address, value) {
        console.log(`[DMA DEBUG] Write to 0x${address.toString(16)} = 0x${value.toString(16)}`);
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
        console.log(`[DMA DEBUG] Tick: busy=${this.registers.busy}, progress=${this.transferProgress}/${this.numElements}`);
        if (this.registers.canStartTransfer()) {
            this.startNextTransfer();
            this.registers.startRequested = false;
        }

        if (this.registers.busy && this.currentDescriptor) {
            this.performTransferStep();
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

        this.registers.busy = true;
        this.registers.done = false;
        this.registers.error = false;

        console.log(`[DMA] Transfer started: ${this.currentDescriptor.toString()}`);
        console.log(`[DMA] Config: elements=${this.numElements}, bswap=${this.bswap}, srcMode=${this.srcMode}, dstMode=${this.dstMode}`);

        return true;
    }

    performTransferStep() {
        console.log(`[DMA DEBUG] Transfer step: ${this.transferProgress}/${this.numElements}`);
        if (this.transferProgress >= this.numElements) {
            this.completeTransfer();
            return;
        }

        try {
            // If no stage is active, prepare new element
            if (!this.transferStage) {
                this.latchedSrcAddr = this.calculateAddress(this.currentSrcAddr, this.transferProgress, this.srcMode);
                this.latchedDstAddr = this.calculateAddress(this.currentDstAddr, this.transferProgress, this.dstMode);
                this.transferStage = 'read';
            }

            if (this.transferStage === 'read') {
                // Issue read if none in flight
                if (!this.waitingRequest && !this.pendingResponse) {
                    const readReq = this.buildReadRequest(this.latchedSrcAddr, this.srcMode);
                    this.waitingRequest = readReq;
                    this.bus.sendRequest('dma', readReq);
                    return;
                }
                // Await response
                if (this.pendingResponse) {
                    let data = this.pendingResponse.data >>> 0;
                    this.pendingResponse = null;
                    this.waitingRequest = null;
                    // Byte swap if requested (only meaningful for word-size)
                    if (this.bswap) {
                        data = this.swapBytes(data, this.getElementSize(this.srcMode));
                    }
                    this.latchedData = data;
                    this.transferStage = 'write';
                }
                return;
            }

            if (this.transferStage === 'write') {
                if (!this.waitingRequest && !this.pendingResponse) {
                    const writeReq = this.buildWriteRequest(this.latchedDstAddr, this.latchedData, this.dstMode);
                    this.waitingRequest = writeReq;
                    this.bus.sendRequest('dma', writeReq);
                    return;
                }
                if (this.pendingResponse) {
                    // Write completed
                    this.pendingResponse = null;
                    this.waitingRequest = null;
                    this.transferStage = null;
                    this.transferProgress++;
                    console.log(`[DMA] Progress: ${this.transferProgress}/${this.numElements}, src=0x${this.latchedSrcAddr.toString(16)}, dst=0x${this.latchedDstAddr.toString(16)}, data=0x${this.latchedData.toString(16)}`);
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
            case 0: // constant byte
            case 2: // incrementing byte
                return { type: 'readByte', address };
            case 1: // constant word
            case 3: // incrementing word
                return { type: 'read', address };
            default:
                throw new Error(`Invalid read mode: ${mode}`);
        }
    }

    buildWriteRequest(address, data, mode) {
        switch (mode) {
            case 0: // constant byte
            case 2: // incrementing byte
                return { type: 'writeByte', address, value: data & 0xFF };
            case 1: // constant word
            case 3: // incrementing word
                return { type: 'write', address, value: data >>> 0 };
            default:
                throw new Error(`Invalid write mode: ${mode}`);
        }
    }

    receiveResponse(resp) {
        this.pendingResponse = resp;
    }

    swapBytes(data, size) {
        if (size === 1) {
            return data;
        } else if (size === 4) {
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

        // Clear in-flight DMA bus state
        this.transferStage = null;
        this.waitingRequest = null;
        this.pendingResponse = null;

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
}
