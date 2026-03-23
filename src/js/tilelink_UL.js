import { TL_A_Opcode } from './tilelink.js';
import { TileLinkBase } from './tilelink_base.js';

export class TileLink_UL extends TileLinkBase {
    constructor(name = 'TileLink-UL') {
        super({
            name,
            variant: 'UL',
            allowedOpcodes: [
                TL_A_Opcode.PutFullData,
                TL_A_Opcode.PutPartialData,
                TL_A_Opcode.Get,
                TL_A_Opcode.Intent
            ]
        });
    }
}
