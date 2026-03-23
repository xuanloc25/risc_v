// TileLink Standard Definitions
export const TL_A_Opcode = {
    PutFullData: 0,
    PutPartialData: 1,
    ArithmeticData: 2,
    LogicalData: 3,
    Get: 4,
    Intent: 5
};

export const TL_D_Opcode = {
    AccessAck: 0,
    AccessAckData: 1,
    HintAck: 2,
    Grant: 4,
    GrantData: 5,
    ReleaseAck: 6
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

const TL_A_CHANNEL_DEFAULTS = Object.freeze({
    valid: false,
    ready: true,
    opcode: null,
    param: 0,
    size: 0,
    source: null,
    address: 0,
    mask: 0,
    data: 0,
    corrupt: false
});

const TL_D_CHANNEL_DEFAULTS = Object.freeze({
    valid: false,
    ready: true,
    opcode: null,
    param: 0,
    size: 0,
    source: null,
    sink: null,
    denied: false,
    data: 0,
    corrupt: false
});

function cloneDefaults(defaults) {
    return { ...defaults };
}

export function createTileLinkSignals(label = 'TileLink') {
    return {
        label,
        a: cloneDefaults(TL_A_CHANNEL_DEFAULTS),
        d: cloneDefaults(TL_D_CHANNEL_DEFAULTS)
    };
}

export function resetTileLinkSignals(signals) {
    Object.assign(signals.a, TL_A_CHANNEL_DEFAULTS);
    Object.assign(signals.d, TL_D_CHANNEL_DEFAULTS);
    return signals;
}

export function computeTileLinkMask(address, size = 2) {
    const lane = (address >>> 0) & 0x3;
    if (size === 0) return (0x1 << lane) & 0xF;
    if (size === 1) return (lane & 0x2) === 0 ? 0x3 : 0xC;
    return 0xF;
}

export function getTransferSizeLog2(req, fallback = 2) {
    if (typeof req?.size === 'number') return req.size;
    if (req?.type === 'readByte' || req?.type === 'writeByte') return 0;
    if (req?.type === 'readHalf' || req?.type === 'writeHalf') return 1;
    return fallback;
}

export function isTileLinkRead(type) {
    return type === TL_A_Opcode.Get ||
        type === 'fetch' ||
        type === 'read' ||
        type === 'readHalf' ||
        type === 'readByte';
}

export function isTileLinkWrite(type) {
    return type === TL_A_Opcode.PutFullData ||
        type === TL_A_Opcode.PutPartialData ||
        type === 'write' ||
        type === 'writeHalf' ||
        type === 'writeByte';
}

export function isTileLinkAtomic(type) {
    return type === TL_A_Opcode.ArithmeticData || type === TL_A_Opcode.LogicalData;
}

export function readSizedValue(memoryMap, address, size = 2) {
    const addr = address >>> 0;
    const b0 = memoryMap[addr] ?? 0;
    if (size === 0) return b0 & 0xFF;

    const b1 = memoryMap[addr + 1] ?? 0;
    if (size === 1) return ((b1 << 8) | b0) & 0xFFFF;

    const b2 = memoryMap[addr + 2] ?? 0;
    const b3 = memoryMap[addr + 3] ?? 0;
    return ((b3 << 24) | (b2 << 16) | (b1 << 8) | b0) >>> 0;
}

export function writeSizedValue(memoryMap, address, value, size = 2) {
    const addr = address >>> 0;
    const data = value >>> 0;
    memoryMap[addr] = data & 0xFF;
    if (size >= 1) memoryMap[addr + 1] = (data >> 8) & 0xFF;
    if (size >= 2) {
        memoryMap[addr + 2] = (data >> 16) & 0xFF;
        memoryMap[addr + 3] = (data >> 24) & 0xFF;
    }
}

function normalizeValueForSize(value, size) {
    if (size === 0) return value & 0xFF;
    if (size === 1) return value & 0xFFFF;
    return value >>> 0;
}

function toSignedBySize(value, size) {
    if (size === 0) return (value << 24) >> 24;
    if (size === 1) return (value << 16) >> 16;
    return value | 0;
}

export function applyTileLinkAtomic(req, oldValue, size = 2) {
    const unsignedData = normalizeValueForSize(oldValue, size);
    const unsignedValue = normalizeValueForSize(req.value ?? 0, size);
    const signedData = toSignedBySize(unsignedData, size);
    const signedValue = toSignedBySize(unsignedValue, size);

    let result = unsignedData;

    if (req.type === TL_A_Opcode.ArithmeticData) {
        if (req.param === TL_Param_Arithmetic.MIN) result = Math.min(signedData, signedValue);
        else if (req.param === TL_Param_Arithmetic.MAX) result = Math.max(signedData, signedValue);
        else if (req.param === TL_Param_Arithmetic.MINU) result = Math.min(unsignedData, unsignedValue);
        else if (req.param === TL_Param_Arithmetic.MAXU) result = Math.max(unsignedData, unsignedValue);
        else if (req.param === TL_Param_Arithmetic.ADD) {
            if (size === 0) result = (unsignedData + unsignedValue) & 0xFF;
            else if (size === 1) result = (unsignedData + unsignedValue) & 0xFFFF;
            else result = (signedData + signedValue) >>> 0;
        }
    } else if (req.type === TL_A_Opcode.LogicalData) {
        if (req.param === TL_Param_Logical.XOR) result = unsignedData ^ unsignedValue;
        else if (req.param === TL_Param_Logical.OR) result = unsignedData | unsignedValue;
        else if (req.param === TL_Param_Logical.AND) result = unsignedData & unsignedValue;
        else if (req.param === TL_Param_Logical.SWAP) result = unsignedValue;
    }

    return normalizeValueForSize(result, size);
}

export function snapshotAChannel(req) {
    return {
        valid: true,
        ready: true,
        opcode: req.type,
        param: req.param ?? 0,
        size: getTransferSizeLog2(req, 2),
        source: req.from ?? null,
        address: req.address >>> 0,
        mask: req.mask ?? computeTileLinkMask(req.address, getTransferSizeLog2(req, 2)),
        data: req.value ?? 0,
        corrupt: !!req.corrupt
    };
}

export function snapshotDChannel(resp) {
    return {
        valid: true,
        ready: true,
        opcode: resp.type,
        param: resp.param ?? 0,
        size: typeof resp.size === 'number' ? resp.size : 2,
        source: resp.to ?? null,
        sink: resp.from ?? null,
        denied: !!resp.denied,
        data: resp.data ?? 0,
        corrupt: !!resp.corrupt
    };
}

// Helper for debugging logs
export function getOpcodeName(opcodeMap, value) {
    for (const [name, val] of Object.entries(opcodeMap)) {
        if (val === value) return name;
    }
    return `UNKNOWN(${value})`;
}
