// TileLink-UL Memory implementation
export class Mem {
    constructor({ latency = 1 } = {}) {
        this.mem = {};
        this.pendingRequest = null; // { req, readyCycle }
        this.cycle = 0;
        this.latency = Math.max(1, latency);
        this._pendingDMA = null; // Reserved for future DMA trigger support
    }

    receiveRequest(req) {
        // If a request is already in flight, drop the new one to keep model simple
        if (this.pendingRequest) return;
        this.pendingRequest = { req, readyCycle: this.cycle + this.latency };
    }

    tick(bus) {
        this.cycle++;
        if (!this.pendingRequest) return;
        if (this.cycle < this.pendingRequest.readyCycle) return;

        const pending = this.pendingRequest.req;
        let data = null;

        if (pending.type === 'read' || pending.type === 'fetch') {
            data = ((this.mem[pending.address + 3] ?? 0) << 24) |
                ((this.mem[pending.address + 2] ?? 0) << 16) |
                ((this.mem[pending.address + 1] ?? 0) << 8) |
                (this.mem[pending.address] ?? 0);
        } else if (pending.type === 'readHalf') {
            data = ((this.mem[pending.address + 1] ?? 0) << 8) |
                (this.mem[pending.address] ?? 0);
        } else if (pending.type === 'write') {
            this.mem[pending.address] = pending.value & 0xFF;
            this.mem[pending.address + 1] = (pending.value >> 8) & 0xFF;
            this.mem[pending.address + 2] = (pending.value >> 16) & 0xFF;
            this.mem[pending.address + 3] = (pending.value >> 24) & 0xFF;
        } else if (pending.type === 'writeHalf') {
            this.mem[pending.address] = pending.value & 0xFF;
            this.mem[pending.address + 1] = (pending.value >> 8) & 0xFF;
        } else if (pending.type === 'readByte') {
            data = this.mem[pending.address] ?? 0;
        } else if (pending.type === 'writeByte') {
            this.mem[pending.address] = pending.value & 0xFF;
        }

        bus.sendResponse({ ...pending, data });
        this.pendingRequest = null;
    }

    loadMemoryMap(memoryMap) {
        this.mem = { ...memoryMap };
    }

    reset() {
        this.mem = {};
        this.pendingRequest = null;
        this.cycle = 0;
    }
}
