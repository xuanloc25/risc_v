// TileLink-UL Bus implementation with simple arbitration for CPU + DMA masters
export class TileLinkBus {
    constructor() {
        this.requestQueue = []; // queued requests from masters
        this.inFlight = null;    // request currently issued to memory
        this.responseQueue = []; // responses from memory waiting to be routed
    }

    /**
     * Bus tick: issue one queued request to memory (if none in-flight), then
     * route at most one response back to the originating master.
     */
    tick(cpu, mem, dma) {
        // Issue next request if memory is free
        if (!this.inFlight && this.requestQueue.length > 0) {
            this.inFlight = this.requestQueue.shift();
            console.log(`[BUS][A] issue from=${this.inFlight.from} type=${this.inFlight.type} addr=0x${(this.inFlight.address >>> 0).toString(16)} val=${this.inFlight.value ?? ''}`);
            mem.receiveRequest(this.inFlight);
        }

        // Route one response per tick
        if (this.responseQueue.length > 0) {
            const resp = this.responseQueue.shift();
            console.log(`[BUS][D] route to=${resp.from} type=${resp.type} addr=0x${(resp.address >>> 0).toString(16)} data=${resp.data ?? ''}`);
            if (resp.from === 'cpu') {
                cpu.receiveResponse(resp);
            } else if (resp.from === 'dma') {
                dma?.receiveResponse(resp);
            }
            // Current transaction completed; allow next issue
            this.inFlight = null;
        }
    }

    /** Queue a master request. `from` must identify the master (cpu|dma). */
    sendRequest(from, req) {
        this.requestQueue.push({ ...req, from });
    }

    /** Enqueue a memory response (called by memory). */
    sendResponse(resp) {
        this.responseQueue.push(resp);
    }
}
