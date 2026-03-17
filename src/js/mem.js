import { TL_A_Opcode, TL_D_Opcode, TL_Param_Arithmetic, TL_Param_Logical } from './tilelink.js';

// TileLink-UL / UH Memory implementation
export class Mem {
    constructor({ latency = 1 } = {}) {
        this.mem = {};
        this.pendingRequest = null; // { req, readyCycle }
        this.cycle = 0;
        this.latency = Math.max(1, latency);
        this._pendingDMA = null; // Reserved for future DMA trigger support
        
        // Multi-beat Burst state
        this.burstState = null; // { req, totalBytes, bytesRemaining, currentAddr, isWrite }
    }

    receiveRequest(req) {
        // If a request is already in flight, drop the new one to keep model simple
        if (this.pendingRequest) return;
        this.pendingRequest = req;
    }

    tick(bus) {
        this.cycle++;
        
        // Handle ongoing Burst
        if (this.burstState) {
            this._processBurstBeat(bus);
            return;
        }
        
        if (!this.pendingRequest) return;
        if (this.cycle < this.pendingRequest.readyCycle) return;

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

    _processBurstBeat(bus) {
        const state = this.burstState;
        
        if (!state.isWrite) {
            // Processing a Read Beat (Get)
            const addr = state.currentAddr;
            let data = ((this.mem[addr + 3] ?? 0) << 24) |
                       ((this.mem[addr + 2] ?? 0) << 16) |
                       ((this.mem[addr + 1] ?? 0) << 8) |
                       (this.mem[addr] ?? 0);
            
            bus.sendResponse({
                from: 'mem',
                to: state.req.from,
                type: TL_D_Opcode.AccessAckData,
                data: data,
                address: addr,
                size: 2 // We return 4 byte chunks
            });
            
            state.bytesRemaining -= 4;
            state.currentAddr += 4;
            
            if (state.bytesRemaining <= 0) {
                this.burstState = null;
            }
        } else {
            // Simple Burst Write logic (assumes master sends data one by one, which our DMA actually does natively anyway)
            // Properly, DMA would send multiple PutFullData requests, so this branch might be unused if DMA never sends a Get size > 2.
            // But we keep it as a placeholder.
            this.burstState = null;
        }
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
