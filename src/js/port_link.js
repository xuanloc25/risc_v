function requireMethod(target, method, message) {
    if (!target || typeof target[method] !== 'function') {
        throw new Error(message);
    }
}

function isPortDescriptor(value) {
    return value instanceof Port;
}

export class Port {
    constructor(name, { kind = 'link', upper = null, lower = null, target = null, match = () => true } = {}) {
        // Port la doi tuong trung gian dung de noi 2 thanh phan voi nhau,
        // hoac dang ky mot endpoint vao bus/interconnect.
        this.name = name ?? '';
        this.kind = kind;
        this.upper = upper;
        this.lower = lower;
        this.target = target;
        this.match = match;
    }

    static link(name, upper, lower) {
        return new Port(name, {
            kind: 'link',
            upper,
            lower
        });
    }

    static upper(name, target) {
        return new Port(name, {
            kind: 'upper',
            target
        });
    }

    static lower(name, target, match = () => true) {
        return new Port(name, {
            kind: 'lower',
            target,
            match
        });
    }

    static memory(name, target) {
        return new Port(name, {
            kind: 'memory',
            target
        });
    }

    attach(host = null) {
        if (this.kind === 'link') {
            // Noi truc tiep 2 module point-to-point:
            // upper giu tham chieu xuong lower thong qua Port nay.
            requireMethod(this.upper, 'attachLowerPort', 'Port.link expects the upper component to implement attachLowerPort()');
            requireMethod(this.lower, 'attachUpperPort', 'Port.link expects the lower component to implement attachUpperPort()');

            this.upper.attachLowerPort(this);
            this.lower.attachUpperPort(this);
            return this;
        }

        if (!host) {
            throw new Error(`Port "${this.name}" requires a host bus/interconnect`);
        }

        if (this.kind === 'upper') {
            // Dang ky mot master / requester len host bus.
            requireMethod(host, 'attachUpperPort', 'Port.upper expects the host to implement attachUpperPort()');
            host.attachUpperPort(this.name, this.target);
            return this;
        }

        if (this.kind === 'lower') {
            // Dang ky mot slave / target xuong host bus, kem ham match
            // de host quyet dinh dia chi nao se duoc route vao target nay.
            requireMethod(host, 'attachLowerPort', 'Port.lower expects the host to implement attachLowerPort()');
            host.attachLowerPort(this.name, this.target, this.match);
            return this;
        }

        if (this.kind === 'memory') {
            // Mot so bus can giu "memory view" rieng de debug hoac truy cap truc tiep.
            requireMethod(host, 'attachMemoryPort', 'Port.memory expects the host to implement attachMemoryPort()');
            host.attachMemoryPort(this.target);
            return this;
        }

        throw new Error(`Unknown port kind: ${this.kind}`);
    }

    sendRequest(from, req) {
        // Day request tu phia upper xuong lower bang API receiveRequest()
        // thong nhat; cac bus/master cu van co the dung sendRequest().
        if (typeof this.lower?.receiveRequest === 'function') {
            return this.lower.receiveRequest({
                ...req,
                from
            });
        }
        if (typeof this.lower?.sendRequest === 'function') {
            return this.lower.sendRequest(from, req);
        }
        throw new Error(`Port "${this.name}" cannot forward sendRequest()`);
    }

    receiveRequest(req) {
        // Cho phep Port dong vai tro adaptor khi host goi vao theo kieu receiveRequest().
        if (typeof this.lower?.receiveRequest === 'function') {
            return this.lower.receiveRequest(req);
        }
        if (typeof this.lower?.sendRequest === 'function') {
            return this.lower.sendRequest(req.from, req);
        }
        throw new Error(`Port "${this.name}" cannot forward receiveRequest()`);
    }

    receiveResponse(resp) {
        // Dua response nguoc tro lai phia upper.
        if (typeof this.upper?.receiveResponse === 'function') {
            return this.upper.receiveResponse(resp);
        }
        if (typeof this.upper?.sendResponse === 'function') {
            return this.upper.sendResponse(resp);
        }
        throw new Error(`Port "${this.name}" cannot forward receiveResponse()`);
    }

    sendResponse(resp) {
        // Mot so module tra response bang sendResponse(), so khac bang
        // receiveResponse(); Port co gang noi duoc ca hai kieu API.
        if (typeof this.upper?.sendResponse === 'function') {
            return this.upper.sendResponse(resp);
        }
        if (typeof this.lower?.sendResponse === 'function') {
            return this.lower.sendResponse(resp);
        }
        if (typeof this.upper?.receiveResponse === 'function') {
            return this.upper.receiveResponse(resp);
        }
        throw new Error(`Port "${this.name}" cannot forward sendResponse()`);
    }

    directRead(address, size = 2, accessType = 'port') {
        // Forward helper cho cac endpoint MMIO / memory truy cap truc tiep.
        if (typeof this.lower?.directRead === 'function') {
            return this.lower.directRead(address, size, accessType);
        }
        throw new Error(`Port "${this.name}" cannot forward directRead()`);
    }

    directWrite(address, value, size = 2, accessType = 'port') {
        if (typeof this.lower?.directWrite === 'function') {
            this.lower.directWrite(address, value, size, accessType);
            return;
        }
        throw new Error(`Port "${this.name}" cannot forward directWrite()`);
    }

    memBytes() {
        // Tra ve backing store de test/debug co the nhin thay bo nho that phia duoi.
        if (typeof this.lower?.memBytes === 'function') return this.lower.memBytes();
        if (this.lower?.mem) return this.lower.mem;
        throw new Error(`Port "${this.name}" cannot expose memory bytes`);
    }
}

export function attachPort(hostOrUpper, portOrLower, name = '') {
    if (isPortDescriptor(portOrLower)) {
        // Truong hop host + mo ta Port da duoc tao san.
        return portOrLower.attach(hostOrUpper);
    }

    // Truong hop don gian: noi truc tiep 2 module voi nhau.
    return Port.link(name, hostOrUpper, portOrLower).attach();
}

export function connectPorts(upper, lower, name = '') {
    return attachPort(upper, lower, name);
}

export function attachPorts(target, { upper = [], lower = [], memory = null } = {}) {
    const attached = [];

    for (const entry of upper) {
        attached.push(attachPort(target, Port.upper(...entry)));
    }

    for (const entry of lower) {
        attached.push(attachPort(target, Port.lower(...entry)));
    }

    if (memory !== null && memory !== undefined) {
        attached.push(attachPort(target, Port.memory('memory', memory)));
    }

    return attached;
}
