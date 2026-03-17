import { TL_A_Opcode, TL_D_Opcode, getOpcodeName } from './tilelink.js';

// TileLink-UL Bus implementation with simple arbitration for CPU + DMA masters
export class Bus {
    constructor() {
        this.requestQueue = []; // queued requests from masters
        this.inFlight = null;    // request currently issued to memory
        this.responseQueue = []; // responses from memory waiting to be routed
        this.masters = {};       // name -> target with receiveResponse()
        this.slaves = {};        // name -> { target, match(addr) }
    }

    /** Register a master endpoint so responses can be routed back. */
    registerMaster(name, target) {
        this.masters[name] = target;
    }

    /** Register a slave/target with optional address match predicate. */
    registerSlave(name, target, matchFn = () => true) {
        this.slaves[name] = { name, target, match: matchFn };
    }

    /**
     * Bus tick: issue one queued request to memory (if none in-flight), then
     * route at most one response back to the originating master.
     */
    tick() {
        if (Object.keys(this.slaves).length === 0) throw new Error('Bus has no attached slave');

        // Issue next request if memory is free
        if (!this.inFlight && this.requestQueue.length > 0) {
            this.inFlight = this.requestQueue.shift();
            console.log(`[BUS][A] issue from=${this.inFlight.from} type=${getOpcodeName(TL_A_Opcode, this.inFlight.type)} addr=0x${(this.inFlight.address >>> 0).toString(16)} val=${this.inFlight.value ?? ''}`);
            const slave = this._selectSlave(this.inFlight.address);
            slave.receiveRequest(this.inFlight);
        }

        // Route one response per tick
        if (this.responseQueue.length > 0) {
            const resp = this.responseQueue.shift();
            // Burst multi-beat response sets resp.beats and doesn't clear inFlight if expecting more (handled in DMA masters usually, but currently handled master-side)
            console.log(`[BUS][D] route to=${resp.to} type=${getOpcodeName(TL_D_Opcode, resp.type)} addr=0x${(resp.address >>> 0).toString(16)} data=${resp.data ?? ''}`);
            const target = this.masters[resp.to];
            if (target && typeof target.receiveResponse === 'function') {
                target.receiveResponse(resp);
            } else {
                console.warn(`[BUS] No master registered for ${resp.to}`);
            }
            // Current transaction completed; allow next issue
            this.inFlight = null;
        }
    }

    _selectSlave(address) {
        const entry = Object.values(this.slaves).find(s => s.match(address));
        if (!entry) throw new Error(`No slave matched address 0x${(address >>> 0).toString(16)}`);
        return entry.target;
    }

    /** Queue a master request. `from` must identify the master (cpu|dma). */
    sendRequest(from, req) {
        this.requestQueue.push({ ...req, from });
    }

    /** Enqueue a memory response (called by memory). */
    sendResponse(resp) {
        this.responseQueue.push(resp);
    }

    // Direct peek/poke helpers used by CPU for instruction fetch and syscall strings.
    _memBytes() {
        // Legacy helper: use first registered slave (assumed memory map)
        const first = Object.values(this.slaves)[0];
        const target = first?.target;
        if (!target) throw new Error('Bus has no attached slave');
        return target.mem ?? target; // fallback for raw map
    }

    memBytes() {
        return this._memBytes();
    }

    peekByte(address) {
        const mem = this._memBytes();
        return mem[address] ?? 0;
    }

    peekWord(address) {
        const mem = this._memBytes();
        return ((mem[address + 3] ?? 0) << 24) |
            ((mem[address + 2] ?? 0) << 16) |
            ((mem[address + 1] ?? 0) << 8) |
            (mem[address] ?? 0);
    }

    pokeByte(address, value) {
        const mem = this._memBytes();
        mem[address] = value & 0xFF;
    }

    pokeWord(address, value) {
        const mem = this._memBytes();
        mem[address] = value & 0xFF;
        mem[address + 1] = (value >> 8) & 0xFF;
        mem[address + 2] = (value >> 16) & 0xFF;
        mem[address + 3] = (value >> 24) & 0xFF;
    }
}
