import {
    TL_D_Opcode,
    applyTileLinkAtomic,
    getTransferSizeLog2,
    isTileLinkAtomic,
    isTileLinkRead,
    isTileLinkWrite
} from './tilelink.js';

export class TileLinkBridge {
    constructor(upstreamBus, downstreamBus, { name = 'TileLink Bridge' } = {}) {
        this.upstreamBus = upstreamBus;
        this.downstreamBus = downstreamBus;
        this.name = name;
    }

    receiveRequest(req) {
        const size = getTransferSizeLog2(req, 2);
        let data = 0;
        let responseType = TL_D_Opcode.AccessAck;

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
        return this.downstreamBus.directRead(address, size, accessType);
    }

    directWrite(address, value, size = 2, accessType = 'bridge') {
        this.downstreamBus.directWrite(address, value, size, accessType);
    }
}
