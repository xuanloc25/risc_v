// TileLink-UL Memory implementation
export class Mem {
    constructor() {
        this.mem = {};
        this.pendingRequest = null;
        this.cycle = 0;
        this._pendingDMA = null; // Reserved for future DMA trigger support
    }

    receiveRequest(req) {
        // If a request is already in flight, drop the new one to keep model simple
        if (this.pendingRequest) return;
        this.pendingRequest = req;
    }

    tick(bus) {
        this.cycle++;
        if (!this.pendingRequest) return;

        let data = null;

        if (this.pendingRequest.type === 'read' || this.pendingRequest.type === 'fetch') {
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

    loadMemoryMap(memoryMap) {
        this.mem = { ...memoryMap };
    }

    reset() {
        this.mem = {};
        this.pendingRequest = null;
        this.cycle = 0;
    }
}
