import { UART } from './uart.js';
import { MousePeripheral } from './mouse.js';

// TileLink-UL Memory implementation
export class Mem {
    constructor({ ledMatrix = null, uart = null, mouse = null, keyboard = null } = {}) {
        this.mem = {};
        this.pendingRequest = null;
        this._pendingDMA = null; // Reserved for future DMA trigger support

        // Peripherals are injected from simulator; keep fallback for standalone use
        this.ledMatrix = ledMatrix;
        this.uart = uart ?? new UART(0x10000000);
        this.mouse = mouse ?? new MousePeripheral(0xFF100000);
        this.keyboard = keyboard;

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
            else if (this.pendingRequest.type === 'read' || this.pendingRequest.type === 'fetch') {
                data = ((this.mem[this.pendingRequest.address + 3] ?? 0) << 24) |
                    ((this.mem[this.pendingRequest.address + 2] ?? 0) << 16) |
                    ((this.mem[this.pendingRequest.address + 1] ?? 0) << 8) |
                    (this.mem[this.pendingRequest.address] ?? 0);
            } else if (this.pendingRequest.type === 'readHalf') {
                data = ((this.mem[this.pendingRequest.address + 1] ?? 0) << 8) |
                    (this.mem[this.pendingRequest.address] ?? 0);
            } else if (this.pendingRequest.type === 'write') {
                this.mem[this.pendingRequest.address] = this.pendingRequest.value & 0xFF;
                this.mem[this.pendingRequest.address + 1] = (this.pendingRequest.value >> 8) & 0xFF;
                this.mem[this.pendingRequest.address + 2] = (this.pendingRequest.value >> 16) & 0xFF;
                this.mem[this.pendingRequest.address + 3] = (this.pendingRequest.value >> 24) & 0xFF;
            } else if (this.pendingRequest.type === 'writeHalf') {
                this.mem[this.pendingRequest.address] = this.pendingRequest.value & 0xFF;
                this.mem[this.pendingRequest.address + 1] = (this.pendingRequest.value >> 8) & 0xFF;
            } else if (this.pendingRequest.type === 'readByte') {
                data = this.mem[this.pendingRequest.address] ?? 0;
            } else if (this.pendingRequest.type === 'writeByte') {
                this.mem[this.pendingRequest.address] = this.pendingRequest.value & 0xFF;
            }

            bus.sendResponse({ ...this.pendingRequest, data });
            this.pendingRequest = null;
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
