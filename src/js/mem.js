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
        this.pendingRequest = {
            req,
            readyCycle: this.cycle + this.latency
        };
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

        const { req } = this.pendingRequest;
        let sizeLog2 = req.size ?? 2; // Default to word (2^2 = 4 bytes)
        const bytesRequested = 1 << sizeLog2;
        
        // If it's a multi-beat burst (size > 2, meaning > 4 bytes requested but data path is 32-bit/4-byte)
        if (bytesRequested > 4) {
            this.burstState = {
                req: req,
                totalBytes: bytesRequested,
                bytesRemaining: bytesRequested,
                currentAddr: req.address,
                isWrite: (req.type === TL_A_Opcode.PutFullData)
            };
            this.pendingRequest = null;
            this._processBurstBeat(bus);
            return;
        }

        // Single beat processing (< 4 bytes)
        let data = 0;
        let opA = req.type;
        let addr = req.address;
        let value = req.value ?? 0;
        let opD = TL_D_Opcode.AccessAck;

        // Fetch current data based on size
        if (sizeLog2 === 2) {
            data = ((this.mem[addr + 3] ?? 0) << 24) |
                   ((this.mem[addr + 2] ?? 0) << 16) |
                   ((this.mem[addr + 1] ?? 0) << 8) |
                   (this.mem[addr] ?? 0);
        } else if (sizeLog2 === 1) {
            data = ((this.mem[addr + 1] ?? 0) << 8) | (this.mem[addr] ?? 0);
            data = (data << 16) >> 16; // Sign extend if needed by requester later
        } else if (sizeLog2 === 0) {
            data = this.mem[addr] ?? 0;
            data = (data << 24) >> 24; // Sign extend
        }

        // Processing TileLink A messages
        if (opA === TL_A_Opcode.Get || req.type === 'fetch' || req.type === 'read' || req.type === 'readHalf' || req.type === 'readByte') {
            opD = TL_D_Opcode.AccessAckData;
            // Legacy fallbacks
            if (req.type === 'readHalf') { data = ((this.mem[addr + 1] ?? 0) << 8) | (this.mem[addr] ?? 0); }
            if (req.type === 'readByte') { data = this.mem[addr] ?? 0; }
        } else if (opA === TL_A_Opcode.PutFullData || req.type === 'write' || req.type === 'writeHalf' || req.type === 'writeByte') {
            let writeSize = sizeLog2;
            if (req.type === 'writeHalf') writeSize = 1;
            if (req.type === 'writeByte') writeSize = 0;
            
            this.mem[addr] = value & 0xFF;
            if (writeSize >= 1) this.mem[addr + 1] = (value >> 8) & 0xFF;
            if (writeSize === 2) {
                this.mem[addr + 2] = (value >> 16) & 0xFF;
                this.mem[addr + 3] = (value >> 24) & 0xFF;
            }
        } else if (opA === TL_A_Opcode.ArithmeticData || opA === TL_A_Opcode.LogicalData) {
            // TileLink UH: Atomic Memory Operations
            opD = TL_D_Opcode.AccessAckData; // Returns the OLD data
            let newData = data; // operates on word by default in this sim
            
            if (opA === TL_A_Opcode.ArithmeticData) {
                const p = req.param;
                if (p === TL_Param_Arithmetic.MIN) newData = Math.min(data | 0, value | 0);
                else if (p === TL_Param_Arithmetic.MAX) newData = Math.max(data | 0, value | 0);
                else if (p === TL_Param_Arithmetic.MINU) newData = Math.min(data >>> 0, value >>> 0);
                else if (p === TL_Param_Arithmetic.MAXU) newData = Math.max(data >>> 0, value >>> 0);
                else if (p === TL_Param_Arithmetic.ADD) newData = ((data | 0) + (value | 0)) | 0;
            } else {
                const p = req.param;
                if (p === TL_Param_Logical.XOR) newData = data ^ value;
                else if (p === TL_Param_Logical.OR) newData = data | value;
                else if (p === TL_Param_Logical.AND) newData = data & value;
                else if (p === TL_Param_Logical.SWAP) newData = value;
            }
            
            this.mem[addr] = newData & 0xFF;
            this.mem[addr + 1] = (newData >> 8) & 0xFF;
            this.mem[addr + 2] = (newData >> 16) & 0xFF;
            this.mem[addr + 3] = (newData >> 24) & 0xFF;
        }

        bus.sendResponse({
            from: 'mem',
            to: req.from,
            type: opD,
            address: addr,
            size: sizeLog2,
            data: opD === TL_D_Opcode.AccessAckData ? data : null
        });
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
        this.burstState = null;
        this.cycle = 0;
    }
}
