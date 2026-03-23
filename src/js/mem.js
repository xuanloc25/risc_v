import {
    TL_D_Opcode,
    applyTileLinkAtomic,
    getTransferSizeLog2,
    isTileLinkAtomic,
    isTileLinkRead,
    isTileLinkWrite,
    readSizedValue,
    writeSizedValue
} from './tilelink.js';

// TileLink-UL / UH Memory implementation
export class Mem {
    constructor({ latency = 0, burstBeatLatency = latency } = {}) {
        this.mem = {};
        this.pendingRequest = null;
        this.cycle = 0;
        this._pendingDMA = null;
        this.latency = latency;
        this.burstBeatLatency = burstBeatLatency;

        this.burstState = null;
    }

    receiveRequest(req) {
        if (this.pendingRequest || this.burstState) return;
        this.pendingRequest = {
            req,
            readyCycle: this.cycle + this.latency
        };
    }

    directRead(address, size = 2) {
        return readSizedValue(this.mem, address, size);
    }

    directWrite(address, value, size = 2) {
        writeSizedValue(this.mem, address, value, size);
    }

    tick(bus) {
        this.cycle++;

        if (this.burstState) {
            if (this.cycle < this.burstState.readyCycle) return;
            this._processBurstBeat(bus);
            return;
        }

        if (!this.pendingRequest) return;
        if (this.cycle < this.pendingRequest.readyCycle) return;

        const req = this.pendingRequest.req;
        const sizeLog2 = getTransferSizeLog2(req, 2);
        const bytesRequested = 1 << sizeLog2;

        if (bytesRequested > 4) {
            this.burstState = {
                req,
                totalBytes: bytesRequested,
                bytesRemaining: bytesRequested,
                currentAddr: req.address >>> 0,
                isWrite: isTileLinkWrite(req.type),
                readyCycle: this.cycle + this.burstBeatLatency
            };
            this.pendingRequest = null;
            if (this.burstBeatLatency === 0) {
                this._processBurstBeat(bus);
            }
            return;
        }

        let data = this.directRead(req.address, sizeLog2);
        let opD = TL_D_Opcode.AccessAck;

        if (isTileLinkRead(req.type)) {
            opD = TL_D_Opcode.AccessAckData;
        } else if (isTileLinkWrite(req.type)) {
            this.directWrite(req.address, req.value ?? 0, sizeLog2);
        } else if (isTileLinkAtomic(req.type)) {
            opD = TL_D_Opcode.AccessAckData;
            const newValue = applyTileLinkAtomic(req, data, sizeLog2);
            this.directWrite(req.address, newValue, sizeLog2);
        }

        bus.sendResponse({
            from: 'mem',
            to: req.from,
            type: opD,
            data,
            address: req.address >>> 0,
            size: sizeLog2
        });

        this.pendingRequest = null;
    }

    _processBurstBeat(bus) {
        const state = this.burstState;

        if (!state.isWrite) {
            const addr = state.currentAddr >>> 0;
            const data = this.directRead(addr, 2);

            bus.sendResponse({
                from: 'mem',
                to: state.req.from,
                type: TL_D_Opcode.AccessAckData,
                data,
                address: addr,
                size: 2
            });

            state.bytesRemaining -= 4;
            state.currentAddr += 4;

            if (state.bytesRemaining <= 0) {
                this.burstState = null;
            } else {
                state.readyCycle = this.cycle + this.burstBeatLatency;
            }
        } else {
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
