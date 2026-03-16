// TileLink Standard Definitions
export const TL_A_Opcode = {
    PutFullData: 0,
    PutPartialData: 1,
    ArithmeticData: 2,
    LogicalData: 3,
    Get: 4,
    Intent: 5 // Optional for Prefetching
};

export const TL_D_Opcode = {
    AccessAck: 0,
    AccessAckData: 1,
    HintAck: 2,
    Grant: 4,     // TLC
    GrantData: 5, // TLC
    ReleaseAck: 6 // TLC
};

export const TL_Param_Arithmetic = {
    MIN: 0,
    MAX: 1,
    MINU: 2,
    MAXU: 3,
    ADD: 4
};

export const TL_Param_Logical = {
    XOR: 0,
    OR: 1,
    AND: 2,
    SWAP: 3
};

// Helper for debugging logs
export function getOpcodeName(opcodeMap, value) {
    for (const [name, val] of Object.entries(opcodeMap)) {
        if (val === value) return name;
    }
    return `UNKNOWN(${value})`;
}
