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

function hex(value) {
    return `0x${(value >>> 0).toString(16)}`;
}

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

function describeTarget(entryOrTarget) {
    const target = entryOrTarget?.target ?? entryOrTarget;
    return entryOrTarget?.name ?? target?.name ?? target?.constructor?.name ?? 'target';
}

function describeAOpcode(type) {
    return typeof type === 'number' ? getOpcodeName(TL_A_Opcode, type) : type;
}

function describeDOpcode(type) {
    return typeof type === 'number' ? getOpcodeName(TL_D_Opcode, type) : type;
}

export class TileLinkBase {
    constructor({ name = 'TileLink', variant = 'UL', allowedOpcodes = [], latency = 0 } = {}) {
        this.name = name;
        this.variant = variant;
        this.allowedOpcodes = new Set(allowedOpcodes);

        // Transaction latency: number of bus cycles a request is held on the
        // fabric before it is forwarded to the slave. latency = 0 reproduces the
        // original same-cycle forwarding behaviour.
        this.latency = latency;
        this.cycle = 0;
        this._inFlightForwarded = false;
        this._forwardAt = 0;

        this.requestQueue = [];
        this.inFlight = null;
        this.responseQueue = [];
        this.masters = {};
        this.slaves = [];
        this.upperPorts = [];

        this.signals = createTileLinkSignals(`${name} (${variant})`);
        this.signalDefaults = makeChannelDefaults(this.signals);
        this.memoryTarget = null;
        this.onTraceTransaction = null;
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

        this.cycle++;

        this.signals.a.ready = !this.inFlight;
        this.signals.d.ready = true;

        // Accept the next request from the queue when the fabric is idle. The
        // request is latched immediately but only forwarded to the slave after
        // `latency` cycles, modelling TileLink fabric latency.
        if (!this.inFlight && this.requestQueue.length > 0) {
            const nextReq = this.requestQueue.shift();
            this._validateRequest(nextReq);

            this.inFlight = nextReq;
            this._inFlightForwarded = false;
            this._forwardAt = this.cycle + this.latency;
            Object.assign(this.signals.a, snapshotAChannel(nextReq));

            const opcodeName = describeAOpcode(nextReq.type);
            console.log(
                `[${this.name}][A] issue from=${nextReq.from} type=${opcodeName} ` +
                `addr=0x${(nextReq.address >>> 0).toString(16)} val=${hex(nextReq.value ?? '')}` +
                (this.latency > 0 ? ` (fabric latency=${this.latency})` : '')
            );
        }

        // Forward the latched request to the slave once its latency has elapsed.
        if (this.inFlight && !this._inFlightForwarded && this.cycle >= this._forwardAt) {
            const nextReq = this.inFlight;
            const slaveEntry = this._selectSlaveEntry(nextReq.address);

            // A-channel backpressure: if the slave cannot accept this beat yet
            // (e.g. UART TX FIFO full), keep a_ready deasserted and hold the
            // request on the fabric. It is retried every cycle until accepted,
            // so the master (DMA/CPU) stalls instead of losing the beat.
            if (typeof slaveEntry.target.canAccept === 'function' && !slaveEntry.target.canAccept(nextReq)) {
                this.signals.a.ready = false;
                // Report the held beat so the SoC diagram shows the link as busy
                // instead of going dark for the whole stall (e.g. UART TX FIFO full).
                if (typeof this.onTraceTransaction === 'function') {
                    this.onTraceTransaction('request', {
                        from: nextReq.from,
                        type: nextReq.type,
                        address: nextReq.address,
                        value: nextReq.value,
                        slaveName: slaveEntry.name,
                        stalled: true
                    });
                }
            } else {
                const opcodeName = describeAOpcode(nextReq.type);
                if (typeof this.onTraceTransaction === 'function') {
                    this.onTraceTransaction('request', {
                        from: nextReq.from,
                        type: nextReq.type,
                        address: nextReq.address,
                        value: nextReq.value,
                        slaveName: slaveEntry.name
                    });
                }
                console.log(
                    `[${this.name}] TileLink -> ${describeTarget(slaveEntry)} REQUEST ` +
                    `from=${nextReq.from} type=${opcodeName} addr=0x${(nextReq.address >>> 0).toString(16)}`
                );
                slaveEntry.target.receiveRequest(nextReq);
                this._inFlightForwarded = true;
            }
        }

        if (!this.inFlight) {
            clearChannel(this.signals.a, this.signalDefaults.a);
            this.signals.a.ready = true;
        }

        if (this.responseQueue.length > 0) {
            const resp = this.responseQueue.shift();
            Object.assign(this.signals.d, snapshotDChannel(resp));

            const opcodeName = describeDOpcode(resp.type);
            const hasData = resp.type === TL_D_Opcode.AccessAckData;
            const dataStr = hasData ? ` data=0x${(resp.data >>> 0).toString(16)}` : '';
            console.log(
                `[${this.name}] ${resp.from} -> TileLink RESPONSE ` +
                `to=${resp.to} type=${opcodeName} addr=0x${(resp.address >>> 0).toString(16)}${dataStr}`
            );
            console.log(
                `[${this.name}][D] route to=${resp.to} type=${opcodeName} ` +
                `addr=0x${(resp.address >>> 0).toString(16)}${dataStr}`
            );

            const target = this._resolveResponseTarget(resp.to);
            if (typeof this.onTraceTransaction === 'function') {
                this.onTraceTransaction('response', {
                    to: resp.to,
                    from: resp.from,
                    type: resp.type,
                    address: resp.address,
                    data: resp.data
                });
            }
            if (target && typeof target.receiveResponse === 'function') {
                console.log(
                    `[${this.name}] TileLink -> ${resp.to} RESPONSE ` +
                    `type=${opcodeName} addr=0x${(resp.address >>> 0).toString(16)}${dataStr}`
                );
                target.receiveResponse(resp);
            } else {
                console.warn(`[${this.name}] No master registered for ${resp.to}`);
            }

            if (resp.lastBeat !== false) {
                this.inFlight = null;
            }
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

    receiveRequest(req) {
        this.sendRequest(req.from, req);
    }

    sendResponse(resp) {
        this.responseQueue.push(resp);
    }

    receiveResponse(resp) {
        this.sendResponse(resp);
    }

    canAccept(req) {
        if (!isFiniteAddress(req?.address)) return true;

        const entry = this._selectSlaveEntry(req.address);
        if (typeof entry.target?.canAccept === 'function') {
            return entry.target.canAccept(req);
        }
        return true;
    }

    directRead(address, size = 2, accessType = 'direct') {
        const entry = this._selectSlaveEntry(address);
        const isRuntime = accessType !== 'peek' && accessType !== 'poke' && accessType !== 'view' && accessType !== 'debug' && accessType !== 'direct-debug' && accessType !== 'peek-word';
        if (isRuntime && typeof this.onTraceTransaction === 'function') {
            this.onTraceTransaction('directRead', {
                address,
                slaveName: entry.name,
                size
            });
        }
        console.log(
            `[${this.name}] TileLink -> ${describeTarget(entry)} DIRECT_READ ` +
            `addr=0x${(address >>> 0).toString(16)} size=${size} access=${accessType}`
        );
        const value = this._readFromTarget(entry.target, address, size, accessType);
        console.log(
            `[${this.name}] ${describeTarget(entry)} -> TileLink DIRECT_READ_DATA ` +
            `addr=0x${(address >>> 0).toString(16)} data=${value ?? 0}`
        );
        return value;
    }

    directWrite(address, value, size = 2, accessType = 'direct') {
        const entry = this._selectSlaveEntry(address);
        const isRuntime = accessType !== 'peek' && accessType !== 'poke' && accessType !== 'view' && accessType !== 'debug' && accessType !== 'direct-debug' && accessType !== 'peek-word';
        if (isRuntime && typeof this.onTraceTransaction === 'function') {
            this.onTraceTransaction('directWrite', {
                address,
                value,
                slaveName: entry.name,
                size
            });
        }
        console.log(
            `[${this.name}] TileLink -> ${describeTarget(entry)} DIRECT_WRITE ` +
            `addr=0x${(address >>> 0).toString(16)} size=${size} access=${accessType} data=0x${((value ?? 0) >>> 0).toString(16)}`
        );
        this._writeToTarget(entry.target, address, value, size, accessType);
        console.log(
            `[${this.name}] ${describeTarget(entry)} -> TileLink DIRECT_WRITE_ACK ` +
            `addr=0x${(address >>> 0).toString(16)}`
        );
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

    _resolveResponseTarget(targetName) {
        if (targetName && this.masters[targetName]) {
            return this.masters[targetName];
        }

        if (targetName) {
            const linkedUpper = this.upperPorts.find((port) => port?.name === targetName || port?.constructor?.name === targetName);
            if (linkedUpper) return linkedUpper;
        }

        return this.upperPorts[0] ?? null;
    }

    _selectSlave(address) {
        return this._selectSlaveEntry(address).target;
    }

    _selectSlaveEntry(address) {
        const addr = address >>> 0;
        const entry = this.slaves.find((slave) => slave.match(addr));
        if (!entry) {
            throw new Error(`[${this.name}] No slave matched address 0x${addr.toString(16)}`);
        }
        return entry;
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
