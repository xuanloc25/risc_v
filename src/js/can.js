// Message-level educational CAN controller model.
//
// This peripheral is inspired by the structure of Classic CAN controllers, but
// it intentionally models frames at the controller/MMIO level only. It does not
// implement the physical layer, bit stuffing, real CRC, ACK slot behavior,
// bit-level arbitration, or complete CAN error frames, and should not be treated
// as an ISO-conformant CAN implementation.

export const CAN_DEFAULT_BASE_ADDRESS = 0xFF200000;
export const CAN_SIZE_BYTES = 0x100;

export const CAN_REGISTERS = Object.freeze({
    CTRL: 0x00,
    STATUS: 0x04,
    INT_STATUS: 0x08,
    INT_ENABLE: 0x0C,
    BITRATE: 0x10,
    TX_ID: 0x20,
    TX_DLC: 0x24,
    TX_DATA0: 0x28,
    TX_DATA1: 0x2C,
    CMD: 0x30,
    RX_ID: 0x40,
    RX_DLC: 0x44,
    RX_DATA0: 0x48,
    RX_DATA1: 0x4C,
    RX_POP: 0x50,
    ERR_STATUS: 0x60,
    VERSION: 0xF0,
    CAP: 0xF4
});

export const CAN_CTRL_BITS = Object.freeze({
    EN: 1 << 0,
    SOFT_RESET: 1 << 1,
    LOOPBACK: 1 << 2,
    SILENT: 1 << 3,
    EXT_ID_EN: 1 << 4
});

export const CAN_STATUS_BITS = Object.freeze({
    TX_READY: 1 << 0,
    RX_AVAILABLE: 1 << 1,
    TX_FULL: 1 << 2,
    RX_FULL: 1 << 3,
    RX_OVERRUN: 1 << 4,
    ERROR: 1 << 5
});

export const CAN_INT_BITS = Object.freeze({
    TX_DONE: 1 << 0,
    RX_NEW: 1 << 1,
    RX_OVERRUN: 1 << 2,
    ERROR: 1 << 3
});

export const CAN_CMD_BITS = Object.freeze({
    SEND: 1 << 0,
    CLEAR_TX: 1 << 1,
    CLEAR_RX: 1 << 2,
    CLEAR_ERROR: 1 << 3
});

export const CAN_ERROR = Object.freeze({
    NONE: 0,
    DISABLED: 1,
    INVALID_DLC: 2,
    INVALID_ID: 3,
    TX_FULL: 4,
    RX_OVERRUN: 5,
    EXTENDED_DISABLED: 6,
    INVALID_BITRATE: 7
});

function clampByte(value) {
    return (value ?? 0) & 0xFF;
}

function cloneFrame(frame) {
    return {
        id: frame.id >>> 0,
        dlc: frame.dlc & 0xF,
        extended: !!frame.extended,
        data: frame.data.slice(0, frame.dlc & 0xF)
    };
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

function bytesToWord(bytes, start = 0) {
    return (
        clampByte(bytes[start]) |
        (clampByte(bytes[start + 1]) << 8) |
        (clampByte(bytes[start + 2]) << 16) |
        (clampByte(bytes[start + 3]) << 24)
    ) >>> 0;
}

export class CANController {
    constructor(baseAddress = CAN_DEFAULT_BASE_ADDRESS) {
        this.baseAddress = baseAddress >>> 0;
        this.txFifoDepth = 16;
        this.rxFifoDepth = 16;
        this.cpuFrequency = 100000000;
        this.maxTxDelayCycles = 1000000;
        this.onTransmit = null;
        this.onReceive = null;
        this.reset();
    }

    reset() {
        this.ctrl = 0;
        this.intStatus = 0;
        this.intEnable = 0;
        this.bitrate = 500000;

        this.txId = 0;
        this.txDlc = 0;
        this.txData0 = 0;
        this.txData1 = 0;

        this.txFifo = [];
        this.rxFifo = [];
        this.currentTx = null;
        this.txCyclesRemaining = 0;

        this.error = false;
        this.rxOverrun = false;
        this.lastError = CAN_ERROR.NONE;
        this.txErrorCount = 0;
        this.rxErrorCount = 0;
    }

    get enabled() {
        return (this.ctrl & CAN_CTRL_BITS.EN) !== 0;
    }

    get loopbackEnabled() {
        return (this.ctrl & CAN_CTRL_BITS.LOOPBACK) !== 0;
    }

    get listenOnly() {
        return (this.ctrl & CAN_CTRL_BITS.SILENT) !== 0;
    }

    get extendedIdEnabled() {
        return (this.ctrl & CAN_CTRL_BITS.EXT_ID_EN) !== 0;
    }

    get interruptPending() {
        return (this.intStatus & this.intEnable) !== 0;
    }

    readRegister(address) {
        const offset = this._offset(address);

        switch (offset) {
            case CAN_REGISTERS.CTRL:
                return this.ctrl >>> 0;
            case CAN_REGISTERS.STATUS:
                return this._readStatus();
            case CAN_REGISTERS.INT_STATUS:
                return this.intStatus >>> 0;
            case CAN_REGISTERS.INT_ENABLE:
                return this.intEnable >>> 0;
            case CAN_REGISTERS.BITRATE:
                return this.bitrate >>> 0;
            case CAN_REGISTERS.TX_ID:
                return this.txId >>> 0;
            case CAN_REGISTERS.TX_DLC:
                return this.txDlc >>> 0;
            case CAN_REGISTERS.TX_DATA0:
                return this.txData0 >>> 0;
            case CAN_REGISTERS.TX_DATA1:
                return this.txData1 >>> 0;
            case CAN_REGISTERS.RX_ID:
                return this._peekRxFrame()?.id ?? 0;
            case CAN_REGISTERS.RX_DLC: {
                const frame = this._peekRxFrame();
                if (!frame) return 0;
                return (frame.dlc & 0xF) | (frame.extended ? 0x10 : 0);
            }
            case CAN_REGISTERS.RX_DATA0:
                return bytesToWord(this._peekRxFrame()?.data ?? [], 0);
            case CAN_REGISTERS.RX_DATA1:
                return bytesToWord(this._peekRxFrame()?.data ?? [], 4);
            case CAN_REGISTERS.ERR_STATUS:
                return this._readErrorStatus();
            case CAN_REGISTERS.VERSION:
                return 0x43414E01;
            case CAN_REGISTERS.CAP:
                return (
                    (this.txFifoDepth & 0xFF) |
                    ((this.rxFifoDepth & 0xFF) << 8) |
                    (1 << 16)
                ) >>> 0;
            default:
                return 0;
        }
    }

    writeRegister(address, value) {
        const offset = this._offset(address);
        const data = value >>> 0;

        switch (offset) {
            case CAN_REGISTERS.CTRL:
                this._writeCtrl(data);
                break;
            case CAN_REGISTERS.INT_STATUS:
                this.intStatus &= ~data;
                break;
            case CAN_REGISTERS.INT_ENABLE:
                this.intEnable = data & 0xF;
                break;
            case CAN_REGISTERS.BITRATE:
                this._writeBitrate(data);
                break;
            case CAN_REGISTERS.TX_ID:
                this.txId = data;
                break;
            case CAN_REGISTERS.TX_DLC:
                this.txDlc = data & 0x1F;
                break;
            case CAN_REGISTERS.TX_DATA0:
                this.txData0 = data;
                break;
            case CAN_REGISTERS.TX_DATA1:
                this.txData1 = data;
                break;
            case CAN_REGISTERS.CMD:
                this._writeCommand(data);
                break;
            case CAN_REGISTERS.RX_POP:
                if ((data & 0x1) !== 0) this.rxFifo.shift();
                break;
            default:
                break;
        }
    }

    canAcceptTx() {
        return this.txFifo.length < this.txFifoDepth;
    }

    canAcceptCommand(value) {
        const command = value >>> 0;
        if ((command & CAN_CMD_BITS.SEND) === 0) return true;
        if ((command & CAN_CMD_BITS.CLEAR_TX) !== 0) return true;
        return this.canAcceptTx();
    }

    tick(cycles = 1) {
        const steps = Math.max(1, cycles | 0);

        for (let i = 0; i < steps; i++) {
            if (!this.currentTx && this.txFifo.length > 0) {
                this.currentTx = this.txFifo.shift();
                this.txCyclesRemaining = this._computeTransmitDelay(this.currentTx);
            }

            if (!this.currentTx) continue;

            this.txCyclesRemaining--;
            if (this.txCyclesRemaining <= 0) {
                this._finishTransmit();
            }
        }
    }

    injectFrame(frame) {
        const normalized = this._normalizeFrame(frame, 'rx');
        if (!normalized) return false;
        return this._pushRxFrame(normalized);
    }

    _offset(address) {
        return ((address >>> 0) - this.baseAddress) >>> 0;
    }

    _writeCtrl(value) {
        if ((value & CAN_CTRL_BITS.SOFT_RESET) !== 0) {
            this.reset();
            return;
        }

        this.ctrl = value & (
            CAN_CTRL_BITS.EN |
            CAN_CTRL_BITS.LOOPBACK |
            CAN_CTRL_BITS.SILENT |
            CAN_CTRL_BITS.EXT_ID_EN
        );
    }

    _writeBitrate(value) {
        if (!Number.isFinite(value) || value === 0) {
            this._setError(CAN_ERROR.INVALID_BITRATE, 'tx');
            return;
        }
        this.bitrate = value >>> 0;
    }

    _writeCommand(command) {
        if ((command & CAN_CMD_BITS.CLEAR_TX) !== 0) {
            this.txFifo = [];
            this.currentTx = null;
            this.txCyclesRemaining = 0;
        }

        if ((command & CAN_CMD_BITS.CLEAR_RX) !== 0) {
            this.rxFifo = [];
        }

        if ((command & CAN_CMD_BITS.CLEAR_ERROR) !== 0) {
            this.error = false;
            this.rxOverrun = false;
            this.lastError = CAN_ERROR.NONE;
            this.intStatus &= ~(CAN_INT_BITS.RX_OVERRUN | CAN_INT_BITS.ERROR);
        }

        if ((command & CAN_CMD_BITS.SEND) !== 0) {
            this._sendTxFrame();
        }
    }

    _sendTxFrame() {
        if (!this.enabled) {
            this._setError(CAN_ERROR.DISABLED, 'tx');
            return false;
        }

        if (!this.canAcceptTx()) {
            this._setError(CAN_ERROR.TX_FULL, 'tx');
            return false;
        }

        const frame = this._buildTxFrame();
        if (!frame) return false;

        this.txFifo.push(frame);
        return true;
    }

    _buildTxFrame() {
        const dlc = this.txDlc & 0xF;
        const extended = (this.txDlc & 0x10) !== 0;

        if (dlc > 8) {
            this._setError(CAN_ERROR.INVALID_DLC, 'tx');
            return null;
        }

        if (extended && !this.extendedIdEnabled) {
            this._setError(CAN_ERROR.EXTENDED_DISABLED, 'tx');
            return null;
        }

        const maxId = extended ? 0x1FFFFFFF : 0x7FF;
        if ((this.txId >>> 0) > maxId) {
            this._setError(CAN_ERROR.INVALID_ID, 'tx');
            return null;
        }

        const data = [...wordToBytes(this.txData0), ...wordToBytes(this.txData1)].slice(0, dlc);
        return {
            id: this.txId >>> 0,
            dlc,
            extended,
            data
        };
    }

    _normalizeFrame(frame, errorKind = 'rx') {
        if (!frame || typeof frame !== 'object') {
            this._setError(CAN_ERROR.INVALID_ID, errorKind);
            return null;
        }

        const extended = !!(frame.extended ?? frame.xtd);
        const sourceData = Array.isArray(frame.data) || ArrayBuffer.isView(frame.data)
            ? Array.from(frame.data)
            : [...wordToBytes(frame.data0 ?? 0), ...wordToBytes(frame.data1 ?? 0)];
        const dlc = Number.isInteger(frame.dlc) ? frame.dlc : Math.min(sourceData.length, 8);

        if (dlc < 0 || dlc > 8) {
            this._setError(CAN_ERROR.INVALID_DLC, errorKind);
            return null;
        }

        if (extended && !this.extendedIdEnabled) {
            this._setError(CAN_ERROR.EXTENDED_DISABLED, errorKind);
            return null;
        }

        const id = Number(frame.id);
        const maxId = extended ? 0x1FFFFFFF : 0x7FF;
        if (!Number.isFinite(id) || id < 0 || id > maxId) {
            this._setError(CAN_ERROR.INVALID_ID, errorKind);
            return null;
        }

        return {
            id: id >>> 0,
            dlc,
            extended,
            data: sourceData.slice(0, dlc).map(clampByte)
        };
    }

    _pushRxFrame(frame) {
        if (this.rxFifo.length >= this.rxFifoDepth) {
            this.rxOverrun = true;
            this._setError(CAN_ERROR.RX_OVERRUN, 'rx');
            this._setInterrupt(CAN_INT_BITS.RX_OVERRUN);
            return false;
        }

        const stored = cloneFrame(frame);
        this.rxFifo.push(stored);
        this._setInterrupt(CAN_INT_BITS.RX_NEW);

        if (typeof this.onReceive === 'function') {
            this.onReceive(cloneFrame(stored));
        }

        return true;
    }

    _finishTransmit() {
        const frame = this.currentTx;
        this.currentTx = null;
        this.txCyclesRemaining = 0;

        this._setInterrupt(CAN_INT_BITS.TX_DONE);
        if (typeof this.onTransmit === 'function') {
            this.onTransmit(cloneFrame(frame));
        }

        if (this.loopbackEnabled) {
            this._pushRxFrame(frame);
        }
    }

    _computeTransmitDelay(frame) {
        const arbitrationBits = frame.extended ? 32 : 14;
        const overheadBits = 33;
        const frameBits = arbitrationBits + overheadBits + frame.dlc * 8;
        const cycles = Math.ceil((frameBits * this.cpuFrequency) / Math.max(1, this.bitrate));
        return Math.max(1, Math.min(this.maxTxDelayCycles, cycles));
    }

    _peekRxFrame() {
        return this.rxFifo[0] ?? null;
    }

    _readStatus() {
        const txOutstanding = this.txFifo.length + (this.currentTx ? 1 : 0);
        const txFull = this.txFifo.length >= this.txFifoDepth;
        const rxFull = this.rxFifo.length >= this.rxFifoDepth;

        return (
            (this.enabled && !txFull ? CAN_STATUS_BITS.TX_READY : 0) |
            (this.rxFifo.length > 0 ? CAN_STATUS_BITS.RX_AVAILABLE : 0) |
            (txFull ? CAN_STATUS_BITS.TX_FULL : 0) |
            (rxFull ? CAN_STATUS_BITS.RX_FULL : 0) |
            (this.rxOverrun ? CAN_STATUS_BITS.RX_OVERRUN : 0) |
            (this.error ? CAN_STATUS_BITS.ERROR : 0) |
            ((Math.min(txOutstanding, 0xFF) & 0xFF) << 8) |
            ((Math.min(this.rxFifo.length, 0xFF) & 0xFF) << 16) |
            ((this.lastError & 0xFF) << 24)
        ) >>> 0;
    }

    _readErrorStatus() {
        return (
            (this.error ? 1 : 0) |
            (this.rxOverrun ? 2 : 0) |
            ((this.lastError & 0xFF) << 8) |
            ((this.txErrorCount & 0xFF) << 16) |
            ((this.rxErrorCount & 0xFF) << 24)
        ) >>> 0;
    }

    _setInterrupt(bit) {
        this.intStatus |= bit & 0xF;
    }

    _setError(code, kind = 'tx') {
        this.error = true;
        this.lastError = code & 0xFF;
        if (code === CAN_ERROR.RX_OVERRUN) {
            this.rxOverrun = true;
            this._setInterrupt(CAN_INT_BITS.RX_OVERRUN);
        }
        if (kind === 'rx') this.rxErrorCount = (this.rxErrorCount + 1) & 0xFF;
        else this.txErrorCount = (this.txErrorCount + 1) & 0xFF;
        this._setInterrupt(CAN_INT_BITS.ERROR);
    }
}
