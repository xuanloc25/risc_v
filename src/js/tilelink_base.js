import {
    TL_A_Opcode,
    TL_D_Opcode,
    computeTileLinkMask,
    createTileLinkSignals,
    getOpcodeName,
    getTransferSizeLog2,
    readSizedValue,
    resetTileLinkSignals,
    snapshotAChannel,
    snapshotDChannel,
    writeSizedValue
} from './tilelink.js';

function clearChannel(channel, defaults) {
    Object.assign(channel, defaults);
}

function makeChannelDefaults(signals) {
    return {
        a: { ...signals.a },
        d: { ...signals.d }
    };
}

function isFiniteAddress(address) {
    return typeof address === 'number' && Number.isFinite(address);
}

export class TileLinkBase {
    constructor({ name = 'TileLink', variant = 'UL', allowedOpcodes = [] } = {}) {
        this.name = name;
        this.variant = variant;
        this.allowedOpcodes = new Set(allowedOpcodes);

        this.requestQueue = [];
        this.inFlight = null;
        this.responseQueue = [];
        this.masters = {};
        this.slaves = [];
        this.upperPorts = [];

        this.signals = createTileLinkSignals(`${name} (${variant})`);
        this.signalDefaults = makeChannelDefaults(this.signals);
        this.memoryTarget = null;
    }

    attachUpperPort(nameOrTarget, target = null) {
        // For point-to-point helpers, TileLink can remember which upstream
        // component is connected to it even though requests still use named
        // master registration internally.
        if (typeof nameOrTarget !== 'string') {
            if (nameOrTarget && !this.upperPorts.includes(nameOrTarget)) {
                this.upperPorts.push(nameOrTarget);
            }
            return;
        }

        this.masters[nameOrTarget] = target;
    }

    registerMaster(name, target) {
        this.attachUpperPort(name, target);
    }

    attachLowerPort(name, target, matchFn = () => true) {
        this.slaves.push({ name, target, match: matchFn });
        if (!this.memoryTarget && (target?.mem || typeof target?.memBytes === 'function')) {
            this.memoryTarget = target;
        }
    }

    registerSlave(name, target, matchFn = () => true) {
        this.attachLowerPort(name, target, matchFn);
    }

    attachMemoryPort(target) {
        this.memoryTarget = target;
    }

    attachMemoryTarget(target) {
        this.attachMemoryPort(target);
    }

    tick() {
        if (this.slaves.length === 0) {
            throw new Error(`${this.name} has no attached slave`);
        }

        this.signals.a.ready = !this.inFlight;
        this.signals.d.ready = true;

        if (!this.inFlight && this.requestQueue.length > 0) {
            const nextReq = this.requestQueue.shift();
            this._validateRequest(nextReq);

            this.inFlight = nextReq;
            Object.assign(this.signals.a, snapshotAChannel(nextReq));

            const opcodeName = typeof nextReq.type === 'number'
                ? getOpcodeName(TL_A_Opcode, nextReq.type)
                : nextReq.type;
            console.log(
                `[${this.name}][A] issue from=${nextReq.from} type=${opcodeName} ` +
                `addr=0x${(nextReq.address >>> 0).toString(16)} val=${nextReq.value ?? ''}`
            );

            const slave = this._selectSlave(nextReq.address);
            slave.receiveRequest(nextReq);
        } else if (!this.inFlight) {
            clearChannel(this.signals.a, this.signalDefaults.a);
            this.signals.a.ready = true;
        }

        if (this.responseQueue.length > 0) {
            const resp = this.responseQueue.shift();
            Object.assign(this.signals.d, snapshotDChannel(resp));

            const opcodeName = typeof resp.type === 'number'
                ? getOpcodeName(TL_D_Opcode, resp.type)
                : resp.type;
            console.log(
                `[${this.name}][D] route to=${resp.to} type=${opcodeName} ` +
                `addr=0x${(resp.address >>> 0).toString(16)} data=${resp.data ?? ''}`
            );

            const target = this.masters[resp.to];
            if (target && typeof target.receiveResponse === 'function') {
                target.receiveResponse(resp);
            } else {
                console.warn(`[${this.name}] No master registered for ${resp.to}`);
            }

            this.inFlight = null;
        } else {
            clearChannel(this.signals.d, this.signalDefaults.d);
            this.signals.d.ready = true;
        }
    }

    sendRequest(from, req) {
        const request = {
            ...req,
            from,
            size: getTransferSizeLog2(req, 2),
            mask: req.mask ?? computeTileLinkMask(req.address, getTransferSizeLog2(req, 2))
        };
        this.requestQueue.push(request);
    }

    sendResponse(resp) {
        this.responseQueue.push(resp);
    }

    directRead(address, size = 2, accessType = 'direct') {
        const target = this._selectSlave(address);
        return this._readFromTarget(target, address, size, accessType);
    }

    directWrite(address, value, size = 2, accessType = 'direct') {
        const target = this._selectSlave(address);
        this._writeToTarget(target, address, value, size, accessType);
    }

    memBytes() {
        if (this.memoryTarget?.mem) return this.memoryTarget.mem;
        if (typeof this.memoryTarget?.memBytes === 'function') return this.memoryTarget.memBytes();

        const discoveredTarget = this.slaves
            .map((entry) => entry.target)
            .find((target) => target?.mem || typeof target?.memBytes === 'function');

        if (!discoveredTarget) {
            throw new Error(`${this.name} has no attached memory target`);
        }

        return discoveredTarget.mem ?? discoveredTarget.memBytes();
    }

    peekByte(address) {
        return this.directRead(address, 0, 'peek') & 0xFF;
    }

    peekWord(address) {
        return this.directRead(address, 2, 'peek') >>> 0;
    }

    pokeByte(address, value) {
        this.directWrite(address, value, 0, 'poke');
    }

    pokeWord(address, value) {
        this.directWrite(address, value, 2, 'poke');
    }

    resetSignals() {
        resetTileLinkSignals(this.signals);
    }

    _validateRequest(req) {
        if (!isFiniteAddress(req?.address)) {
            throw new Error(`[${this.name}] Invalid address in request`);
        }

        if (typeof req.type !== 'number') return;
        if (this.allowedOpcodes.size > 0 && !this.allowedOpcodes.has(req.type)) {
            const opcodeName = getOpcodeName(TL_A_Opcode, req.type);
            throw new Error(`[${this.name}] ${opcodeName} is not supported on TileLink-${this.variant}`);
        }
    }

    _selectSlave(address) {
        const addr = address >>> 0;
        const entry = this.slaves.find((slave) => slave.match(addr));
        if (!entry) {
            throw new Error(`[${this.name}] No slave matched address 0x${addr.toString(16)}`);
        }
        return entry.target;
    }

    _readFromTarget(target, address, size, accessType) {
        if (typeof target?.directRead === 'function') {
            return target.directRead(address, size, accessType);
        }

        if (typeof target?.readRegister === 'function') {
            return target.readRegister(address, accessType, size);
        }

        if (target?.mem) {
            return readSizedValue(target.mem, address, size);
        }

        throw new Error(`[${this.name}] Target cannot service direct reads`);
    }

    _writeToTarget(target, address, value, size, accessType) {
        if (typeof target?.directWrite === 'function') {
            target.directWrite(address, value, size, accessType);
            return;
        }

        if (typeof target?.writeRegister === 'function') {
            target.writeRegister(address, value, accessType, size);
            return;
        }

        if (target?.mem) {
            writeSizedValue(target.mem, address, value, size);
            return;
        }

        throw new Error(`[${this.name}] Target cannot service direct writes`);
    }
}
