import { UART } from './uart.js';
import { MousePeripheral } from './mouse.js';

// TileLink-UL Memory implementation
export class TileLinkULMemory {
    constructor({ ledMatrix = null, uart = null, mouse = null, keyboard = null, dma = null, cpu = null } = {}) {
        this.mem = {};
        this.pendingRequest = null;
        this._pendingDMA = null; // Reserved for future DMA trigger support

        // Peripherals are injected from simulator; keep fallback for standalone use
        this.ledMatrix = ledMatrix;
        this.uart = uart ?? new UART(0x10000000);
        this.mouse = mouse ?? new MousePeripheral(0xFF100000);
        this.keyboard = keyboard;

        this.dma = dma;
        this.cpu = cpu;
    }

    setDMA(dma) {
        this.dma = dma;
    }

    setCPU(cpu) {
        this.cpu = cpu;
    }

    receiveRequest(req) {
        this.pendingRequest = req;
    }

    tick(bus) {
        if (this.pendingRequest) {
            let data = null;
            const addr = this.pendingRequest.address >>> 0; // unsigned 32-bit address

            if (this.uart && this.uart.isUARTAddress(addr)) {
                if (this.pendingRequest.type === 'read') {
                    data = this.uart.readRegister(addr);
                } else if (this.pendingRequest.type === 'write') {
                    this.uart.writeRegister(addr, this.pendingRequest.value);
                    data = 0;
                }
            }
            else if (this.keyboard && this.keyboard.isKeyboardAddress(addr)) {
                if (this.pendingRequest.type === 'read') {
                    data = this.keyboard.readRegister(addr);
                } else if (this.pendingRequest.type === 'write') {
                    this.keyboard.writeRegister(addr, this.pendingRequest.value);
                    data = 0;
                }
            }
            else if (addr >= 0xFF000000 && addr < 0xFF001000) {
                if (this.ledMatrix) {
                    if (this.pendingRequest.type === 'write' || this.pendingRequest.type === 'writeByte') {
                        this.ledMatrix.writeWord(addr, this.pendingRequest.value);
                    }
                    data = 0;
                }
            }
            else if (this.mouse && this.mouse.isMouseAddress(addr)) {
                if (this.pendingRequest.type === 'read') {
                    data = this.mouse.readRegister(addr);
                } else if (this.pendingRequest.type === 'write') {
                    this.mouse.writeRegister(addr, this.pendingRequest.value);
                    data = 0;
                }
            }
            else if (addr >= 0xFFED0000 && addr <= 0xFFED0007) {
                if (this.dma) {
                    if (this.pendingRequest.type === 'read') {
                        data = this.dma.readRegister(addr);
                    } else if (this.pendingRequest.type === 'write') {
                        this.dma.writeRegister(addr, this.pendingRequest.value);
                        data = 0;
                    }
                } else {
                    console.warn(`[MEM] DMA not available for register access: 0x${this.pendingRequest.address.toString(16)}`);
                    data = 0;
                }
            }
            else if (this.pendingRequest.type === 'read') {
                data = ((this.mem[this.pendingRequest.address + 3] ?? 0) << 24) |
                    ((this.mem[this.pendingRequest.address + 2] ?? 0) << 16) |
                    ((this.mem[this.pendingRequest.address + 1] ?? 0) << 8) |
                    (this.mem[this.pendingRequest.address] ?? 0);
            } else if (this.pendingRequest.type === 'write') {
                this.mem[this.pendingRequest.address] = this.pendingRequest.value & 0xFF;
                this.mem[this.pendingRequest.address + 1] = (this.pendingRequest.value >> 8) & 0xFF;
                this.mem[this.pendingRequest.address + 2] = (this.pendingRequest.value >> 16) & 0xFF;
                this.mem[this.pendingRequest.address + 3] = (this.pendingRequest.value >> 24) & 0xFF;
            } else if (this.pendingRequest.type === 'readByte') {
                data = this.mem[this.pendingRequest.address] ?? 0;
            } else if (this.pendingRequest.type === 'writeByte') {
                this.mem[this.pendingRequest.address] = this.pendingRequest.value & 0xFF;
            }

            bus.sendResponse({ ...this.pendingRequest, data });
            this.pendingRequest = null;
        }

        if (!this.pendingRequest && this._pendingDMA && this.cpu && !this.cpu.waitingRequest && !this.cpu.pendingResponse) {
            const { src, dst, length } = this._pendingDMA;
            if (this.dma) {
                for (let i = 0; i < length; i++) {
                    const srcAddr = src + i;
                    console.log(`[CHECK BEFORE DMA] src[0x${srcAddr.toString(16)}]=0x${(this.mem[srcAddr] ?? 0).toString(16)}`);
                }
                this.dma.start(src, dst, length, () => {
                    console.log('DMA transfer completed!');
                    for (let i = 0; i < length; i++) {
                        const srcAddr = src + i;
                        const dstAddr = dst + i;
                        const srcVal = this.mem[srcAddr];
                        const dstVal = this.mem[dstAddr];
                        console.log(`Byte ${i}: src[0x${srcAddr.toString(16)}]=0x${(srcVal ?? 0).toString(16)}, dst[0x${dstAddr.toString(16)}]=0x${(dstVal ?? 0).toString(16)}`);
                    }
                    console.log('Kiểm tra trực tiếp vùng đích sau DMA:');
                    for (let i = 0; i < length; i++) {
                        const dstAddr = dst + i;
                        console.log(`mem[0x${dstAddr.toString(16)}]=0x${(this.mem[dstAddr] ?? 0).toString(16)}`);
                    }
                    this.cpu.isRunning = false;
                });
            }
            this._pendingDMA = null;
        }
    }

    loadMemoryMap(memoryMap) {
        this.mem = { ...memoryMap };
    }

    reset() {
        this.mem = {};
        this.pendingRequest = null;
        if (this.ledMatrix) this.ledMatrix.reset();
        if (this.uart) this.uart.reset();
        if (this.mouse) this.mouse.reset();
        if (this.keyboard) this.keyboard.reset();
    }
}
