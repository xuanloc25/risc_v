const SVG_NS = 'http://www.w3.org/2000/svg';

export const SOC_NODES = {
    cpu: {
        name: 'RISC-V Core',
        x: 375.5,
        y: 24,
        w: 235,
        h: 56,
        group: 'compute',
        icon: 'memory',
        desc: 'RV32IMF execution engine',
        tooltip: 'RISC-V CPU Core: executes RV32IMF instructions. Fetches instructions and performs load/store operations through the MMU.',
        statusId: 'soc-status-cpu',
        status: 'PC: 0x00000000',
        targetTab: 'view-editor'
    },
    mmu: {
        name: 'MMU',
        x: 398,
        y: 124,
        w: 190,
        h: 56,
        group: 'memory',
        icon: 'device_hub',
        desc: 'VA -> PA translate',
        tooltip: 'Memory Management Unit (MMU): translates virtual addresses (VA) to physical addresses (PA). Features a set-associative translation lookaside buffer (TLB).',
        statusId: 'soc-status-mmu',
        status: 'Identity Mode',
        targetTab: 'view-mmu'
    },
    l1i: {
        name: 'L1I Cache',
        x: 80.5,
        y: 220,
        w: 205,
        h: 56,
        group: 'memory',
        icon: 'cached',
        desc: 'Instruction fetch',
        tooltip: 'L1 Instruction Cache: holds recently fetched instructions. Bypassed for non-cacheable/MMIO addresses.',
        statusId: 'soc-status-l1i',
        status: 'Hit Rate: 100%',
        targetTab: 'view-cache',
        cacheView: 'l1i'
    },
    l1d: {
        name: 'L1D Cache',
        x: 700.5,
        y: 220,
        w: 205,
        h: 56,
        group: 'memory',
        icon: 'cached',
        desc: 'Load/store data',
        tooltip: 'L1 Data Cache: caches CPU load/store data. Implements write-back and LRU eviction policies.',
        statusId: 'soc-status-l1d',
        status: 'Hit Rate: 100%',
        targetTab: 'view-cache',
        cacheView: 'l1d'
    },
    l2: {
        name: 'L2 Cache',
        x: 398,
        y: 220,
        w: 190,
        h: 56,
        group: 'memory',
        icon: 'dns',
        desc: 'Shared cache',
        tooltip: 'L2 Shared Cache: unified shared cache that serves L1 instruction and data cache misses before hitting the Main Memory.',
        statusId: 'soc-status-l2',
        status: 'Hit Rate: 100%',
        targetTab: 'view-cache',
        cacheView: 'l2'
    },
    dma: {
        name: 'DMA Controller',
        x: 885,
        y: 24,
        w: 180,
        h: 60,
        group: 'compute',
        icon: 'shuffle',
        desc: 'Regs 0xFFED0000',
        tooltip: 'DMA Controller: transfers data blocks directly between memory and peripherals independently, reducing CPU overhead.',
        statusId: 'soc-status-dma',
        status: 'Idle',
        logModule: 'dma'
    },
    'tl-uh': {
        name: 'TileLink-UH',
        x: 388,
        y: 370,
        w: 210,
        h: 60,
        group: 'bus',
        icon: 'swap_horiz',
        desc: 'High-speed coherent bus',
        tooltip: 'TileLink-UH Bus: high-speed coherent bus connecting the CPU via L2 cache and the DMA Controller to Main Memory and registers.',
        statusId: 'soc-status-tl-uh',
        status: 'Idle',
        logModule: 'tilelink'
    },
    memory: {
        name: 'Main Memory',
        x: 73,
        y: 370,
        w: 225,
        h: 60,
        group: 'memory',
        icon: 'storage',
        desc: 'RAM 0x00000000-0x0FFFFFFF',
        tooltip: 'Main RAM Memory: primary storage for program code and variables. Simulates a 20-cycle physical access latency.',
        statusId: 'soc-status-memory',
        status: 'Latency: 20c',
        targetTab: 'view-memory'
    },
    'tl-ul': {
        name: 'TileLink-UL',
        x: 897,
        y: 370,
        w: 210,
        h: 60,
        group: 'bus',
        icon: 'swap_horiz',
        desc: 'Low-speed MMIO bus',
        tooltip: 'TileLink-UL Bus: low-speed utility bus connecting MMIO peripherals (UART, LED, Keyboard, Mouse) via bridge adapters.',
        statusId: 'soc-status-tl-ul',
        status: 'Idle',
        logModule: 'tilelink',
        ports: {
            uart: { x: 34, y: 60, side: 'bottom' },
            led: { x: 79, y: 60, side: 'bottom' },
            keyboard: { x: 143, y: 60, side: 'bottom' },
            mouse: { x: 188, y: 60, side: 'bottom' }
        }
    },
    uart: {
        name: 'UART Console',
        x: 332.5,
        y: 544,
        w: 158,
        h: 54,
        group: 'peripheral',
        icon: 'terminal',
        desc: 'MMIO 0x10000000',
        tooltip: 'UART Console: character-based serial communication interface. Prints program output and receives console input.',
        statusId: 'soc-status-uart',
        status: 'TX: 0 / RX: 0',
        targetTab: 'view-io',
        focusId: 'uartInput',
        ports: {
            busTop: { x: 79, y: 0, side: 'top' }
        }
    },
    led: {
        name: 'LED Matrix',
        x: 544.5,
        y: 544,
        w: 165,
        h: 54,
        group: 'peripheral',
        icon: 'grid_on',
        desc: 'MMIO 0xFF000000',
        tooltip: 'LED Matrix: 32x32 color matrix. Writing words in the 0xFF000000 address range updates pixel colors (0x00RRGGBB).',
        statusId: 'soc-status-led',
        status: '32x32 Pixels',
        targetTab: 'view-io',
        focusId: 'ledMatrixCanvas',
        ports: {
            busTop: { x: 83, y: 0, side: 'top' }
        }
    },
    keyboard: {
        name: 'Keyboard',
        x: 769.5,
        y: 544,
        w: 165,
        h: 54,
        group: 'peripheral',
        icon: 'keyboard',
        desc: 'MMIO 0xFFFF0000',
        tooltip: 'Keyboard Peripheral: buffers keystrokes as ASCII values to be polled by program instructions.',
        statusId: 'soc-status-keyboard',
        status: 'Empty',
        targetTab: 'view-io',
        focusId: 'keyboardInput',
        ports: {
            busTop: { x: 83, y: 0, side: 'top' }
        }
    },
    mouse: {
        name: 'Mouse',
        x: 1002,
        y: 544,
        w: 165,
        h: 54,
        group: 'peripheral',
        icon: 'mouse',
        desc: 'MMIO 0xFF100000',
        tooltip: 'Mouse Peripheral: reports cursor coordinates (X, Y) and click status when interacting with the LED Matrix canvas.',
        statusId: 'soc-status-mouse',
        status: 'x=0, y=0',
        targetTab: 'view-io',
        focusId: 'ledMatrixCanvas',
        ports: {
            busTop: { x: 83, y: 0, side: 'top' }
        }
    }
};

export const SOC_EDGES = [
    { id: 'cpuToMmu', from: 'cpu:bottom', to: 'mmu:top', bus: 'core', markers: false },
    { id: 'mmuToL1I', from: 'mmu:bottom.30', to: 'l1i:top.50', bus: 'core', bidirectional: true },
    { id: 'mmuToL1D', from: 'mmu:bottom.70', to: 'l1d:top.50', bus: 'core', bidirectional: true },
    { id: 'l1iToL2', from: 'l1i:right', to: 'l2:left', bus: 'core', bidirectional: true },
    { id: 'l1dToL2', from: 'l1d:left', to: 'l2:right', bus: 'core', bidirectional: true },
    { id: 'l2ToUh', from: 'l2:bottom', to: 'tl-uh:top', bus: 'uh', bidirectional: true },
    { id: 'uhToMainMemory', from: 'tl-uh:left', to: 'memory:right', bus: 'uh', bidirectional: true },
    {
        id: 'uhToDma',
        from: 'tl-uh:top.85',
        to: 'dma:bottom.35',
        bus: 'dma',
        bidirectional: true,
        waypoints: [
            { x: 566.5, y: 320 },
            { x: 948, y: 320 },
            { x: 948, y: 84 }
        ]
    },
    {
        id: 'uhToDmaRegs',
        from: 'tl-uh:top.85',
        to: 'dma:bottom.35',
        bus: 'dma-regs',
        bidirectional: true,
        aliasFor: 'uhToDma',
        waypoints: [
            { x: 566.5, y: 320 },
            { x: 948, y: 320 },
            { x: 948, y: 84 }
        ]
    },
    {
        id: 'ulToDma',
        from: 'tl-ul:top.50',
        to: 'dma:bottom.65',
        bus: 'ul',
        bidirectional: true
    },
    { id: 'uhToUlBridge', from: 'tl-uh:right', to: 'tl-ul:left', bus: 'uh', bidirectional: true },
    {
        id: 'ulToUhBridge',
        from: 'tl-uh:right',
        to: 'tl-ul:left',
        bus: 'ul',
        bidirectional: true,
        aliasFor: 'uhToUlBridge'
    },
    {
        id: 'ulToUart',
        from: 'tl-ul:uart',
        to: 'uart:busTop',
        bus: 'ul',
        bidirectional: true,
        waypoints: [{ x: 931, y: 468 }, { x: 411.5, y: 468 }]
    },
    {
        id: 'ulToLedMatrix',
        from: 'tl-ul:led',
        to: 'led:busTop',
        bus: 'ul',
        bidirectional: true,
        waypoints: [{ x: 976, y: 486 }, { x: 627.5, y: 486 }]
    },
    {
        id: 'ulToKeyboard',
        from: 'tl-ul:keyboard',
        to: 'keyboard:busTop',
        bus: 'ul',
        bidirectional: true,
        waypoints: [{ x: 1040, y: 504 }, { x: 852.5, y: 504 }]
    },
    {
        id: 'ulToMouse',
        from: 'tl-ul:mouse',
        to: 'mouse:busTop',
        bus: 'ul',
        bidirectional: true
    }
];

const TRACE_EDGE_IDS = [
    'cpuToMmu',
    'mmuToL1I',
    'mmuToL1D',
    'l1iToL2',
    'l1dToL2',
    'l2ToUh',
    'uhToMainMemory',
    'uhToDma',
    'uhToDmaRegs',
    'ulToDma',
    'uhToUlBridge',
    'ulToUhBridge',
    'ulToUart',
    'ulToLedMatrix',
    'ulToKeyboard',
    'ulToMouse'
];

export const SOC_EDGE_ALIASES = {
    uhToDmaRegs: 'uhToDma',
    ulToUhBridge: 'uhToUlBridge'
};

const lastPulseAtByEdge = new Map();

function formatCoordinate(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function parsePort(port = 'center') {
    const [side = 'center', offsetToken] = String(port).split('.');
    let fraction = 0.5;

    if (offsetToken !== undefined) {
        const normalized = offsetToken.includes('.')
            ? Number(offsetToken)
            : Number(`0.${offsetToken}`);
        if (Number.isFinite(normalized)) {
            fraction = Math.min(Math.max(normalized, 0), 1);
        }
    }

    return { side, fraction };
}

function resolveCustomPort(node, port) {
    const customPort = node.ports?.[port];
    if (!customPort) return null;

    return {
        x: customPort.absolute ? customPort.x : node.x + customPort.x,
        y: customPort.absolute ? customPort.y : node.y + customPort.y,
        side: customPort.side || 'custom'
    };
}

export function getPortCoordinates(node, port = 'center') {
    if (!node) {
        throw new Error(`Unknown SoC node for port "${port}"`);
    }

    const customPort = resolveCustomPort(node, port);
    if (customPort) return customPort;

    const { side, fraction } = parsePort(port);
    const x = node.x;
    const y = node.y;
    const w = node.w;
    const h = node.h;

    if (side === 'top') return { x: x + w * fraction, y, side };
    if (side === 'bottom') return { x: x + w * fraction, y: y + h, side };
    if (side === 'left') return { x, y: y + h * fraction, side };
    if (side === 'right') return { x: x + w, y: y + h * fraction, side };

    return { x: x + w / 2, y: y + h / 2, side: 'center' };
}

function resolveEndpoint(endpoint, nodes) {
    const [nodeId, port = 'center'] = String(endpoint).split(':');
    const node = nodes[nodeId];

    if (!node) {
        throw new Error(`Unknown SoC node "${nodeId}" in endpoint "${endpoint}"`);
    }

    return {
        ...getPortCoordinates(node, port),
        nodeId,
        port
    };
}

function pushOrthogonalSegment(commands, cursor, target, preference = 'horizontal') {
    if (Math.abs(cursor.x - target.x) < 0.001 && Math.abs(cursor.y - target.y) < 0.001) {
        return target;
    }

    if (Math.abs(cursor.x - target.x) < 0.001) {
        commands.push(`V ${formatCoordinate(target.y)}`);
        return target;
    }

    if (Math.abs(cursor.y - target.y) < 0.001) {
        commands.push(`H ${formatCoordinate(target.x)}`);
        return target;
    }

    if (preference === 'vertical') {
        commands.push(`V ${formatCoordinate(target.y)}`, `H ${formatCoordinate(target.x)}`);
    } else {
        commands.push(`H ${formatCoordinate(target.x)}`, `V ${formatCoordinate(target.y)}`);
    }

    return target;
}

function inferFinalRoute(edge, start, end) {
    if (Math.abs(start.x - end.x) < 0.001 || Math.abs(start.y - end.y) < 0.001) {
        return [end];
    }

    if (Number.isFinite(edge.midX)) {
        return [
            { x: edge.midX, y: start.y },
            { x: edge.midX, y: end.y },
            end
        ];
    }

    if (Number.isFinite(edge.midY)) {
        return [
            { x: start.x, y: edge.midY },
            { x: end.x, y: edge.midY },
            end
        ];
    }

    const startVertical = start.side === 'top' || start.side === 'bottom';
    const endVertical = end.side === 'top' || end.side === 'bottom';

    if (startVertical && endVertical) {
        const midY = (start.y + end.y) / 2;
        return [
            { x: start.x, y: midY },
            { x: end.x, y: midY },
            end
        ];
    }

    if (!startVertical && !endVertical) {
        const midX = (start.x + end.x) / 2;
        return [
            { x: midX, y: start.y },
            { x: midX, y: end.y },
            end
        ];
    }

    return startVertical
        ? [{ x: start.x, y: end.y }, end]
        : [{ x: end.x, y: start.y }, end];
}

export function generateOrthogonalPath(edge, nodes = SOC_NODES) {
    const start = resolveEndpoint(edge.from, nodes);
    const end = resolveEndpoint(edge.to, nodes);
    const commands = [`M ${formatCoordinate(start.x)} ${formatCoordinate(start.y)}`];
    let cursor = start;

    (edge.waypoints || []).forEach((waypoint) => {
        const target = {
            x: Number.isFinite(waypoint.x) ? waypoint.x : cursor.x,
            y: Number.isFinite(waypoint.y) ? waypoint.y : cursor.y
        };
        cursor = pushOrthogonalSegment(commands, cursor, target, edge.waypointAxis || 'horizontal');
    });

    inferFinalRoute(edge, cursor, end).forEach((point) => {
        cursor = pushOrthogonalSegment(commands, cursor, point, edge.finalAxis || 'horizontal');
    });

    return commands.join(' ');
}

function createSvgElement(tagName, attributes = {}) {
    const element = document.createElementNS(SVG_NS, tagName);
    Object.entries(attributes).forEach(([name, value]) => {
        if (value !== null && value !== undefined) {
            element.setAttribute(name, String(value));
        }
    });
    return element;
}

function createMarkerDefs() {
    const defs = createSvgElement('defs');
    const marker = createSvgElement('marker', {
        id: 'arrow-flow',
        markerWidth: 8,
        markerHeight: 8,
        viewBox: '0 0 10 10',
        refX: 8.2,
        refY: 5,
        orient: 'auto-start-reverse',
        markerUnits: 'userSpaceOnUse'
    });
    const arrow = createSvgElement('path', {
        d: 'M 0 0 L 10 5 L 0 10 z',
        class: 'arrow-head'
    });

    marker.appendChild(arrow);
    defs.appendChild(marker);
    return defs;
}

function createSocNode(nodeId, node) {
    const foreignObject = createSvgElement('foreignObject', {
        x: node.x,
        y: node.y,
        width: node.w,
        height: node.h
    });
    const block = document.createElement('div');
    const icon = document.createElement('i');
    const content = document.createElement('div');
    const name = document.createElement('span');
    const status = document.createElement('span');
    const address = document.createElement('span');

    block.className = `soc-block group-${node.group}`;
    block.id = `block-${nodeId}`;
    block.dataset.socNode = nodeId;
    block.setAttribute('role', 'button');
    block.setAttribute('tabindex', '0');
    block.setAttribute('aria-label', node.name);

    icon.className = 'material-icons';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = node.icon;

    content.className = 'soc-block-content';
    name.className = 'soc-block-name';
    name.textContent = node.name;
    status.className = 'soc-block-status';
    status.id = node.statusId;
    status.textContent = node.status || '';
    address.className = 'soc-block-address';
    address.textContent = node.desc || '';

    content.append(name, status, address);
    block.append(icon, content);
    foreignObject.appendChild(block);

    return foreignObject;
}

export function renderSocDiagram(containerOrSvg, simulator) {
    const svg = containerOrSvg?.matches?.('svg')
        ? containerOrSvg
        : containerOrSvg?.querySelector?.('.soc-svg');

    if (!svg) return null;
    if (svg.dataset.socRendered === 'true') return svg;

    if (simulator) {
        svg.dataset.simulatorBound = 'true';
    }

    svg.replaceChildren();
    svg.setAttribute('viewBox', '0 0 1180 620');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'RISC-V SoC block diagram');

    const edgeLayer = createSvgElement('g', { class: 'soc-edge-layer' });
    const pulseLayer = createSvgElement('g', { class: 'soc-pulse-layer' });
    const nodeLayer = createSvgElement('g', { class: 'soc-node-layer' });

    SOC_EDGES.forEach((edge) => {
        const isBidirectional = edge.bidirectional !== false;
        const showMarkers = edge.markers !== false;
        const path = createSvgElement('path', {
            d: generateOrthogonalPath(edge, SOC_NODES),
            class: `flow-line flow-${edge.bus}${edge.aliasFor ? ' flow-alias' : ''}`,
            id: `path-${edge.id}`,
            'data-edge-id': edge.id,
            'data-alias-for': edge.aliasFor || null,
            'marker-end': showMarkers ? 'url(#arrow-flow)' : null,
            'marker-start': showMarkers && isBidirectional ? 'url(#arrow-flow)' : null
        });
        edgeLayer.appendChild(path);
    });

    Object.entries(SOC_NODES).forEach(([nodeId, node]) => {
        nodeLayer.appendChild(createSocNode(nodeId, node));
    });

    svg.append(createMarkerDefs(), nodeLayer, edgeLayer, pulseLayer);
    svg.dataset.socRendered = 'true';
    return svg;
}

function triggerSocPulse(edgeId, isWrite) {
    const path = document.getElementById(`path-${edgeId}`);
    if (!path || path.classList.contains('flow-alias')) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const lastPulseAt = lastPulseAtByEdge.get(edgeId) || 0;
    if (now - lastPulseAt < 320) return;

    const pulseLayer = path.ownerSVGElement?.querySelector('.soc-pulse-layer');
    if (!pulseLayer) return;

    lastPulseAtByEdge.set(edgeId, now);

    const pulse = createSvgElement('circle', {
        r: 4,
        class: `soc-pulse${isWrite ? ' soc-pulse-write' : ''}`
    });
    const motion = createSvgElement('animateMotion', {
        dur: '0.65s',
        fill: 'freeze',
        path: path.getAttribute('d') || ''
    });

    pulse.appendChild(motion);
    pulseLayer.appendChild(pulse);

    const cleanup = () => pulse.remove();
    motion.addEventListener('endEvent', cleanup, { once: true });
    window.setTimeout(cleanup, 760);

    try {
        motion.beginElement();
    } catch (error) {
        cleanup();
    }
}

export function updateSocTraceHighlights(trace) {
    if (!trace) return;

    const pathStates = new Map();

    TRACE_EDGE_IDS.forEach((edgeId) => {
        const targetId = SOC_EDGE_ALIASES[edgeId] || edgeId;
        const state = pathStates.get(targetId) || { active: false, isWrite: false };
        const active = trace.isLinkActive(edgeId);

        state.active = state.active || active;
        state.isWrite = state.isWrite || (active && trace.isLinkWrite(edgeId));
        pathStates.set(targetId, state);

        const aliasPath = document.getElementById(`path-${edgeId}`);
        if (SOC_EDGE_ALIASES[edgeId] && aliasPath) {
            aliasPath.classList.remove('active', 'active-write');
        }
    });

    pathStates.forEach((state, edgeId) => {
        const pathElement = document.getElementById(`path-${edgeId}`);
        if (!pathElement) return;

        pathElement.classList.toggle('active', state.active);
        pathElement.classList.toggle('active-write', state.active && state.isWrite);

        if (state.active) {
            triggerSocPulse(edgeId, state.isWrite);
        }
    });
}
