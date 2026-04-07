// Wire an upstream component to the next downstream component in the path.
// Requests flow through the upstream component's lower port; responses come
// back through the downstream component's upper port.
export function connectPorts(upper, lower) {
    if (!upper || typeof upper.attachLowerPort !== 'function') {
        throw new Error('connectPorts expects the upper component to implement attachLowerPort()');
    }
    if (!lower || typeof lower.attachUpperPort !== 'function') {
        throw new Error('connectPorts expects the lower component to implement attachUpperPort()');
    }

    upper.attachLowerPort(lower);
    lower.attachUpperPort(upper);
}

// Configure a bus/interconnect that can have multiple upstream initiators and
// multiple downstream targets. This is intentionally separate from
// connectPorts(), which models a single point-to-point link.
export function attachPorts(target, { upper = [], lower = [], memory = null } = {}) {
    if (!target) {
        throw new Error('attachPorts expects a target bus/interconnect');
    }

    if (upper.length > 0 && typeof target.attachUpperPort !== 'function') {
        throw new Error('attachPorts expects the target to implement attachUpperPort()');
    }
    if (lower.length > 0 && typeof target.attachLowerPort !== 'function') {
        throw new Error('attachPorts expects the target to implement attachLowerPort()');
    }
    if (memory !== null && memory !== undefined && typeof target.attachMemoryPort !== 'function') {
        throw new Error('attachPorts expects the target to implement attachMemoryPort() when memory is provided');
    }

    for (const entry of upper) {
        target.attachUpperPort(...entry);
    }

    for (const entry of lower) {
        target.attachLowerPort(...entry);
    }

    if (memory !== null && memory !== undefined) {
        target.attachMemoryPort(memory);
    }
}
