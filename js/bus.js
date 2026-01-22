// TileLink-UL Bus implementation
export class TileLinkBus {
    constructor() {
        this.request = null;
        this.response = null;
    }

    tick(cpu, mem) {
        // Forward CPU request to memory when free
        if (this.request && !this.response) {
            mem.receiveRequest(this.request);
            this.request = null;
        }
        // Deliver memory response back to CPU
        if (this.response) {
            cpu.receiveResponse(this.response);
            this.response = null;
        }
    }

    sendRequest(req) {
        this.request = req;
    }

    sendResponse(resp) {
        this.response = resp;
    }
}
