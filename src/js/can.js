// Minimal message-level Classic CAN controller.
//
// This models only an MMIO controller with one TX mailbox and one RX mailbox.
// It does not model the physical layer, bit stuffing, CRC, ACK, or bit-level arbitration.

export const CAN_DEFAULT_BASE_ADDRESS = 0xFF200000;
export const CAN_SIZE_BYTES = 0x100;

export const CAN_REGISTERS = Object.freeze({
    CTRL: 0x00,
    STATUS: 0x04,
    TX_ID: 0x20,
    TX_DLC: 0x24,
    TX_DATA0: 0x28,
    TX_DATA1: 0x2C,
    CMD: 0x30,
    RX_ID: 0x40,
    RX_DLC: 0x44,
    RX_DATA0: 0x48,
    RX_DATA1: 0x4C,
    RX_POP: 0x50
});

export const CAN_CTRL_BITS = Object.freeze({
    EN: 1 << 0,
    SOFT_RESET: 1 << 1,
    LOOPBACK: 1 << 2
});

export const CAN_STATUS_BITS = Object.freeze({
    TX_READY: 1 << 0,
    RX_AVAILABLE: 1 << 1,
    ERROR: 1 << 2
});

export const CAN_CMD_BITS = Object.freeze({
    SEND: 1 << 0,
    CLEAR_ERROR: 1 << 1
});

function byte(value) {
    return (value ?? 0) & 0xFF;
}

function wordToBytes(word) {
    const value = word >>> 0;
    return [
        value & 0xFF,
        (value >>> 8) & 0xFF,
        (value >>> 16) & 0xFF,
        (value >>> 24) & 0xFF
    ];
}

function bytesToWord(bytes, start) {
    return (
        byte(bytes[start]) |
        (byte(bytes[start + 1]) << 8) |
        (byte(bytes[start + 2]) << 16) |
        (byte(bytes[start + 3]) << 24)
    ) >>> 0;
}

function cloneFrame(frame) {
    return {
        id: frame.id,
        dlc: frame.dlc,
        data: frame.data.slice()
    };
}

export class CANController {
    constructor(baseAddress = CAN_DEFAULT_BASE_ADDRESS) {
        this.baseAddress = baseAddress >>> 0;
        this.onTransmit = null;
        this.onReceive = null;
        this.reset();
    }

    reset() {
        this.ctrl = 0;
        this.txId = 0;
        this.txDlc = 0;
        this.txData0 = 0;
        this.txData1 = 0;
        this.rxMailbox = null;
        this.error = false;
    }

    get enabled() {
        return (this.ctrl & CAN_CTRL_BITS.EN) !== 0;
    }

    get loopbackEnabled() {
        return (this.ctrl & CAN_CTRL_BITS.LOOPBACK) !== 0;
    }

    readRegister(address) {
        switch (this._offset(address)) {
            case CAN_REGISTERS.CTRL:
                return this.ctrl >>> 0;
            case CAN_REGISTERS.STATUS:
                return this._readStatus();
            case CAN_REGISTERS.TX_ID:
                return this.txId >>> 0;
            case CAN_REGISTERS.TX_DLC:
                return this.txDlc >>> 0;
            case CAN_REGISTERS.TX_DATA0:
                return this.txData0 >>> 0;
            case CAN_REGISTERS.TX_DATA1:
                return this.txData1 >>> 0;
            case CAN_REGISTERS.RX_ID:
                return this.rxMailbox?.id ?? 0;
            case CAN_REGISTERS.RX_DLC:
                return this.rxMailbox?.dlc ?? 0;
            case CAN_REGISTERS.RX_DATA0:
                return bytesToWord(this.rxMailbox?.data ?? [], 0);
            case CAN_REGISTERS.RX_DATA1:
                return bytesToWord(this.rxMailbox?.data ?? [], 4);
            default:
                return 0;
        }
    }

    writeRegister(address, value) {
        const data = value >>> 0;

        switch (this._offset(address)) {
            case CAN_REGISTERS.CTRL:
                if ((data & CAN_CTRL_BITS.SOFT_RESET) !== 0) {
                    this.reset();
                } else {
                    this.ctrl = data & (CAN_CTRL_BITS.EN | CAN_CTRL_BITS.LOOPBACK);
                }
                break;
            case CAN_REGISTERS.TX_ID:
                this.txId = data;
                break;
            case CAN_REGISTERS.TX_DLC:
                this.txDlc = data;
                break;
            case CAN_REGISTERS.TX_DATA0:
                this.txData0 = data;
                break;
            case CAN_REGISTERS.TX_DATA1:
                this.txData1 = data;
                break;
            case CAN_REGISTERS.CMD:
                if ((data & CAN_CMD_BITS.CLEAR_ERROR) !== 0) {
                    this.error = false;
                }
                if ((data & CAN_CMD_BITS.SEND) !== 0) {
                    this._send();
                }
                break;
            case CAN_REGISTERS.RX_POP:
                if ((data & 1) !== 0) {
                    this.rxMailbox = null;
                }
                break;
            default:
                break;
        }
    }

    injectFrame(frame) {
        const normalized = this._normalizeFrame(frame);
        if (!normalized) {
            this.error = true;
            return false;
        }
        return this._storeRxFrame(normalized);
    }

    _offset(address) {
        return ((address >>> 0) - this.baseAddress) >>> 0;
    }

    _readStatus() {
        return (
            (this.enabled ? CAN_STATUS_BITS.TX_READY : 0) |
            (this.rxMailbox ? CAN_STATUS_BITS.RX_AVAILABLE : 0) |
            (this.error ? CAN_STATUS_BITS.ERROR : 0)
        ) >>> 0;
    }

    _send() {
        if (!this.enabled) {
            this.error = true;
            return false;
        }

        const frame = this._buildTxFrame();
        if (!frame) {
            this.error = true;
            return false;
        }

        if (typeof this.onTransmit === 'function') {
            this.onTransmit(cloneFrame(frame));
        }

        if (this.loopbackEnabled) {
            this._storeRxFrame(frame);
        }
        return true;
    }

    _buildTxFrame() {
        if (this.txId > 0x7FF || this.txDlc > 8) {
            return null;
        }

        return {
            id: this.txId,
            dlc: this.txDlc,
            data: [...wordToBytes(this.txData0), ...wordToBytes(this.txData1)]
                .slice(0, this.txDlc)
        };
    }

    _normalizeFrame(frame) {
        if (!frame || typeof frame !== 'object') {
            return null;
        }

        const id = Number(frame.id);
        const sourceData = Array.isArray(frame.data) || ArrayBuffer.isView(frame.data)
            ? Array.from(frame.data)
            : [...wordToBytes(frame.data0 ?? 0), ...wordToBytes(frame.data1 ?? 0)];
        const dlc = frame.dlc === undefined ? Math.min(sourceData.length, 8) : Number(frame.dlc);

        if (!Number.isInteger(id) || id < 0 || id > 0x7FF) {
            return null;
        }
        if (!Number.isInteger(dlc) || dlc < 0 || dlc > 8) {
            return null;
        }

        const data = sourceData.slice(0, dlc).map(byte);
        while (data.length < dlc) data.push(0);

        return { id, dlc, data };
    }

    _storeRxFrame(frame) {
        if (this.rxMailbox) {
            this.error = true;
            return false;
        }

        this.rxMailbox = cloneFrame(frame);
        if (typeof this.onReceive === 'function') {
            this.onReceive(cloneFrame(frame));
        }
        return true;
    }
}
