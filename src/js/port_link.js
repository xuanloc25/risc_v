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
            requireMethod(host, 'attachUpperPort', 'Port.upper expects the host to implement attachUpperPort()');
            host.attachUpperPort(this.name, this.target);
            return this;
        }

        if (this.kind === 'lower') {
            requireMethod(host, 'attachLowerPort', 'Port.lower expects the host to implement attachLowerPort()');
            host.attachLowerPort(this.name, this.target, this.match);
            return this;
        }

        if (this.kind === 'memory') {
            requireMethod(host, 'attachMemoryPort', 'Port.memory expects the host to implement attachMemoryPort()');
            host.attachMemoryPort(this.target);
            return this;
        }

        throw new Error(`Unknown port kind: ${this.kind}`);
    }

    sendRequest(from, req) {
        if (typeof this.lower?.sendRequest === 'function') {
            return this.lower.sendRequest(from, req);
        }
        if (typeof this.lower?.receiveRequest === 'function') {
            return this.lower.receiveRequest({
                ...req,
                from
            });
        }
        throw new Error(`Port "${this.name}" cannot forward sendRequest()`);
    }

    receiveRequest(req) {
        if (typeof this.lower?.receiveRequest === 'function') {
            return this.lower.receiveRequest(req);
        }
        if (typeof this.lower?.sendRequest === 'function') {
            return this.lower.sendRequest(req.from, req);
        }
        throw new Error(`Port "${this.name}" cannot forward receiveRequest()`);
    }

    receiveResponse(resp) {
        if (typeof this.upper?.receiveResponse === 'function') {
            return this.upper.receiveResponse(resp);
        }
        if (typeof this.upper?.sendResponse === 'function') {
            return this.upper.sendResponse(resp);
        }
        throw new Error(`Port "${this.name}" cannot forward receiveResponse()`);
    }

    sendResponse(resp) {
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
        if (typeof this.lower?.memBytes === 'function') return this.lower.memBytes();
        if (this.lower?.mem) return this.lower.mem;
        throw new Error(`Port "${this.name}" cannot expose memory bytes`);
    }
}

export function attachPort(hostOrUpper, portOrLower, name = '') {
    if (isPortDescriptor(portOrLower)) {
        return portOrLower.attach(hostOrUpper);
    }

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
