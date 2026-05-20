import {
    TL_A_Opcode,
    TL_D_Opcode,
    applyTileLinkAtomic,
    getOpcodeName,
    getTransferSizeLog2,
    isTileLinkAtomic,
    isTileLinkRead,
    isTileLinkWrite
} from './tilelink.js';

function describeBus(bus) {
    return bus?.name ?? bus?.signals?.label ?? bus?.constructor?.name ?? 'TileLink';
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

export class TileLinkBridge {
    constructor(upstreamBus, downstreamBus, { name = 'TileLink Bridge' } = {}) {
        this.upstreamBus = upstreamBus;
        this.downstreamBus = downstreamBus;
        this.name = name;
    }

    receiveRequest(req) {
        const size = getTransferSizeLog2(req, 2);
        const upstreamName = describeBus(this.upstreamBus);
        const downstreamName = describeBus(this.downstreamBus);
        let data = 0;
        let responseType = TL_D_Opcode.AccessAck;

        console.log(
            `[${this.name}] BRIDGE_REQUEST ${upstreamName}->${downstreamName} ` +
            `from=${req.from} type=${describeAOpcode(req.type)} addr=${hex(req.address)} size=${1 << size}B`
        );

        if (isTileLinkRead(req.type)) {
            data = this.directRead(req.address, size, req.type);
            responseType = TL_D_Opcode.AccessAckData;
        } else if (isTileLinkWrite(req.type)) {
            this.directWrite(req.address, req.value ?? 0, size, req.type);
        } else if (isTileLinkAtomic(req.type)) {
            data = this.directRead(req.address, size, req.type);
            const newValue = applyTileLinkAtomic(req, data, size);
            this.directWrite(req.address, newValue, size, req.type);
            responseType = TL_D_Opcode.AccessAckData;
        }

        console.log(
            `[${this.name}] BRIDGE_RESPONSE ${downstreamName}->${upstreamName} ` +
            `to=${req.from} type=${describeDOpcode(responseType)} addr=${hex(req.address)} data=${data ?? ''}`
        );

        this.upstreamBus.sendResponse({
            from: this.name,
            to: req.from,
            type: responseType,
            data,
            address: req.address >>> 0,
            size
        });
    }

    directRead(address, size = 2, accessType = 'bridge') {
        console.log(
            `[${this.name}] BRIDGE_DIRECT_READ ${describeBus(this.upstreamBus)}->${describeBus(this.downstreamBus)} ` +
            `addr=${hex(address)} size=${1 << size}B access=${describeAOpcode(accessType)}`
        );
        const data = this.downstreamBus.directRead(address, size, accessType);
        console.log(
            `[${this.name}] BRIDGE_DIRECT_READ_DATA ${describeBus(this.downstreamBus)}->${describeBus(this.upstreamBus)} ` +
            `addr=${hex(address)} data=${data ?? 0}`
        );
        return data;
    }

    directWrite(address, value, size = 2, accessType = 'bridge') {
        console.log(
            `[${this.name}] BRIDGE_DIRECT_WRITE ${describeBus(this.upstreamBus)}->${describeBus(this.downstreamBus)} ` +
            `addr=${hex(address)} size=${1 << size}B access=${describeAOpcode(accessType)} data=${hex(value ?? 0)}`
        );
        this.downstreamBus.directWrite(address, value, size, accessType);
        console.log(
            `[${this.name}] BRIDGE_DIRECT_WRITE_ACK ${describeBus(this.downstreamBus)}->${describeBus(this.upstreamBus)} ` +
            `addr=${hex(address)}`
        );
    }
}
