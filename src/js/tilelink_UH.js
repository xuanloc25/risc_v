import { TL_A_Opcode } from './tilelink.js';
import { TileLinkBase } from './tilelink_base.js';

export class TileLink_UH extends TileLinkBase {
    constructor(name = 'TileLink-UH') {
        super({
            name,
            variant: 'UH',
            allowedOpcodes: [
                TL_A_Opcode.PutFullData,
                TL_A_Opcode.PutPartialData,
                TL_A_Opcode.ArithmeticData,
                TL_A_Opcode.LogicalData,
                TL_A_Opcode.Get,
                TL_A_Opcode.Intent
            ]
        });
    }
}
