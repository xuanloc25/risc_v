import {
    TL_A_Opcode,
    TL_D_Opcode,
    applyTileLinkAtomic,
    getOpcodeName,
    getTransferSizeLog2,
    isTileLinkAtomic,
    isTileLinkRead,
    isTileLinkWrite,
    readSizedValue,
    writeSizedValue
} from './tilelink.js';

function describeAOpcode(type) {
    return typeof type === 'number' ? getOpcodeName(TL_A_Opcode, type) : type;
}

function describeDOpcode(type) {
    return typeof type === 'number' ? getOpcodeName(TL_D_Opcode, type) : type;
}

// TileLink-UL / UH Memory implementation
export class Mem {
    constructor({ latency = 0, burstBeatLatency = 1, name = 'Main Memory' } = {}) {
        this.name = name;
        this.mem = {};
        this.pendingRequest = null;
        this.cycle = 0;
        this.upperPorts = [];
        this._pendingDMA = null;
        this.latency = latency;
        this.burstBeatLatency = burstBeatLatency;

        this.burstState = null;
    }

    attachUpperPort(upperPort) {
        if (upperPort && !this.upperPorts.includes(upperPort)) {
            this.upperPorts.push(upperPort);
        }
    }

    receiveRequest(req) {
        if (this.pendingRequest || this.burstState) return;
        console.log(
            `[${this.name}] RECEIVE_REQUEST from=${req.from} type=${describeAOpcode(req.type)} ` +
            `addr=0x${(req.address >>> 0).toString(16)} size=${getTransferSizeLog2(req, 2)}`
        );
        this.pendingRequest = {
            req,
            readyCycle: this.cycle + this.latency
        };
    }

    sendRequest(from, req) {
        this.receiveRequest({
            ...req,
            from
        });
    }

    directRead(address, size = 2) {
        const value = readSizedValue(this.mem, address, size);
        console.log(
            `[${this.name}] DIRECT_READ addr=0x${(address >>> 0).toString(16)} ` +
            `size=${size} data=${value ?? 0}`
        );
        return value;
    }

    directWrite(address, value, size = 2) {
        console.log(
            `[${this.name}] DIRECT_WRITE addr=0x${(address >>> 0).toString(16)} ` +
            `size=${size} data=${value ?? 0}`
        );
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
                refillBeat: req.type === 'fill',
                blockBase: (req.blockBase ?? req.address) >>> 0,
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

        console.log(
            `[${this.name}] ${this.name} -> ${bus?.name ?? 'TileLink'} RESPONSE ` +
            `to=${req.from} type=${describeDOpcode(opD)} addr=0x${(req.address >>> 0).toString(16)} data=${data ?? 0}`
        );

        bus.sendResponse({
            from: this.name,
            to: req.from,
            type: opD,
            data,
            address: req.address >>> 0,
            size: sizeLog2,
            refillBeat: req.type === 'fill',
            blockBase: (req.blockBase ?? req.address) >>> 0,
            beatIndex: 0,
            beatCount: 1,
            lastBeat: true
        });

        this.pendingRequest = null;
    }

    _processBurstBeat(bus) {
        const state = this.burstState;

        if (!state.isWrite) {
            const addr = state.currentAddr >>> 0;
            const data = this.directRead(addr, 2);
            const beatIndex = ((state.totalBytes - state.bytesRemaining) / 4) >>> 0;
            const beatCount = Math.ceil(state.totalBytes / 4);
            const lastBeat = (state.bytesRemaining - 4) <= 0;

            console.log(
                `[${this.name}] ${this.name} -> ${bus?.name ?? 'TileLink'} RESPONSE_BEAT ` +
                `to=${state.req.from} addr=0x${addr.toString(16)} data=${data ?? 0} ` +
                `${beatIndex + 1}/${beatCount}`
            );

            bus.sendResponse({
                from: this.name,
                to: state.req.from,
                type: TL_D_Opcode.AccessAckData,
                data,
                address: addr,
                size: 2,
                refillBeat: state.refillBeat,
                blockBase: state.blockBase,
                beatIndex,
                beatCount,
                lastBeat
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
