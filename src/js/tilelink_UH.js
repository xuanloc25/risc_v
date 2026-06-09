import { TL_A_Opcode } from './tilelink.js';
import { TileLinkBase } from './tilelink_base.js';

export class TileLink_UH extends TileLinkBase {
    // TL-UH is the high-performance fabric and supports a configurable
    // transaction latency so memory/DMA traffic on the UH bus is not serviced
    // in zero time. The latency is a system-level setting (configured by the
    // SoC); it defaults to 0 here so protocol-level unit tests that tick the
    // bus a fixed number of times keep their synchronous behaviour.
    constructor(name = 'TileLink-UH', { latency = 0 } = {}) {
        super({
            name,
            variant: 'UH',
            latency,
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
