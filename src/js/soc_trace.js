// soc_trace.js
// Lớp trực quan hóa giao dịch (trace/animation) cho sơ đồ SoC.
//
// Tách rời khỏi soc.js để soc.js chỉ còn mô hình phần cứng thuần. Module này
// "gắn thêm" khả năng theo dõi giao dịch lên simulator mà KHÔNG cần sửa soc.js:
// nó bọc lại simulator.init() để sau mỗi lần init()/reset()/đổi cache (đều gọi
// init() bên trong), hệ thống trace tự gắn lại lên các port và bus vừa dựng mới.
//
// Lớp UI đọc simulator.trace để vẽ:
//   - bộ đếm Read/Write của Main Memory, bộ đếm Writes của LED  (javascript.js)
//   - log "Last Transaction" trong tooltip mỗi khối              (javascript.js)
//   - tô sáng + pulse các đường bus đang hoạt động               (soc_diagram.js: updateSocTraceHighlights)

import {
    TL_A_Opcode,
    TL_D_Opcode,
    getOpcodeName,
    isTileLinkAtomic,
    isTileLinkWrite
} from './tilelink.js';
import { simulator } from './soc.js';

// Thời gian (ms) một liên kết còn được coi là "đang hoạt động" sau một giao dịch,
// và các ngưỡng tiết lưu (throttle) để log giao dịch không bị spam.
const TRACE_ACTIVE_MS = 450;
const TRACE_ACTIVE_REFRESH_MS = 90;
const TRACE_TRANSACTION_THROTTLE_MS = 120;
const TRACE_TRANSACTION_LIMIT = 6;

// Tên hiển thị (src -> dst) cho từng đường liên kết, dùng để mô tả giao dịch.
const LINK_COMPONENTS = {
    cpuToMmu: { src: 'CPU', dst: 'MMU' },
    mmuToL1I: { src: 'MMU', dst: 'L1I Cache' },
    mmuToL1D: { src: 'MMU', dst: 'L1D Cache' },
    l1iToL2: { src: 'L1I Cache', dst: 'L2 Cache' },
    l1dToL2: { src: 'L1D Cache', dst: 'L2 Cache' },
    l2ToUh: { src: 'L2 Cache', dst: 'TileLink-UH' },
    uhToMainMemory: { src: 'TileLink-UH', dst: 'Main Memory' },
    uhToDma: { src: 'DMA', dst: 'TileLink-UH' },
    uhToDmaRegs: { src: 'TileLink-UH', dst: 'DMA' },
    uhToUlBridge: { src: 'TileLink-UH', dst: 'Bridge (UH->UL)' },
    ulToUhBridge: { src: 'TileLink-UL', dst: 'Bridge (UL->UH)' },
    ulToUart: { src: 'TileLink-UL', dst: 'UART' },
    ulToCan: { src: 'TileLink-UL', dst: 'CAN Controller' },
    ulToLedMatrix: { src: 'TileLink-UL', dst: 'LED Matrix' },
    ulToKeyboard: { src: 'TileLink-UL', dst: 'Keyboard' },
    ulToMouse: { src: 'TileLink-UL', dst: 'Mouse' },
    ulToDma: { src: 'TileLink-UL', dst: 'DMA' }
};

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// Tạo object trace gắn với một simulator cụ thể. record() đọc sim.cycleCount qua
// closure; các method còn lại thao tác trên chính object (this).
function createTrace(sim) {
    return {
        __socTrace: true,
        activeLinks: {},
        lastTransactions: [],
        memoryReadCount: 0,
        memoryWriteCount: 0,
        ledWriteCount: 0,
        _lastTransactionKey: '',
        _lastTransactionAt: 0,
        _lastTransactionAtByLink: {},

        record(linkName, details = null) {
            const t = now();
            const isWrite = !!details?.isWrite;

            const activeEntry = this.activeLinks[linkName];
            if (!activeEntry || activeEntry.isWrite !== isWrite || t - (activeEntry.updatedAt || 0) >= TRACE_ACTIVE_REFRESH_MS) {
                this.activeLinks[linkName] = {
                    cycle: sim.cycleCount,
                    expiresAt: t + TRACE_ACTIVE_MS,
                    isWrite,
                    updatedAt: t
                };
            } else {
                activeEntry.expiresAt = Math.max(activeEntry.expiresAt, t + TRACE_ACTIVE_MS * 0.5);
            }

            // Stalled beats (A-channel held by backpressure) keep the link visually
            // active but must not inflate completed-transfer counters.
            if (!details?.stalled) {
                if (linkName === 'uhToMainMemory') {
                    if (isWrite) this.memoryWriteCount++;
                    else this.memoryReadCount++;
                } else if (linkName === 'ulToLedMatrix' && isWrite) {
                    this.ledWriteCount++;
                }
            }

            if (!details) return;
            if (details.type === 'directRead' || details.type === 'directWrite') return;

            // Stalled retries throttle under their own key: a long backpressure
            // stall fires every cycle, and sharing the key would shadow the real
            // completion entry that lands right after the stall clears.
            const throttleKey = details.stalled ? `${linkName}:stalled` : linkName;
            const lastLinkTransactionAt = this._lastTransactionAtByLink[throttleKey] || 0;
            if (t - lastLinkTransactionAt < TRACE_TRANSACTION_THROTTLE_MS) return;
            this._lastTransactionAtByLink[throttleKey] = t;

            const addrHex = details.address !== undefined
                ? `0x${(details.address >>> 0).toString(16).toUpperCase()}`
                : '';
            const comps = LINK_COMPONENTS[linkName] || {
                src: details.from || 'Bus',
                dst: details.slaveName || linkName
            };

            let description = '';
            if (details.type === 'request') {
                const opName = typeof details.opcode === 'number'
                    ? getOpcodeName(TL_A_Opcode, details.opcode)
                    : (details.opcode || 'Access');
                description = `${comps.src} ${opName} ${addrHex} -> ${comps.dst}${details.stalled ? ' (stalled)' : ''}`;
            } else if (details.type === 'response') {
                const opName = typeof details.opcode === 'number'
                    ? getOpcodeName(TL_D_Opcode, details.opcode)
                    : (details.opcode || 'Ack');
                description = `${comps.dst} ${opName} -> ${comps.src}`;
            } else if (details.type === 'directRead') {
                description = `Direct read ${addrHex} -> ${comps.dst}`;
            } else if (details.type === 'directWrite') {
                description = `Direct write ${addrHex} -> ${comps.dst}`;
            } else {
                description = details.description || `${details.from || 'Bus'} access ${addrHex}`.trim();
            }

            const transactionKey = `${linkName}:${description}`;
            if (
                transactionKey === this._lastTransactionKey &&
                t - this._lastTransactionAt < TRACE_TRANSACTION_THROTTLE_MS
            ) {
                return;
            }

            this._lastTransactionKey = transactionKey;
            this._lastTransactionAt = t;
            this.lastTransactions.push({
                time: t,
                linkName,
                description
            });

            while (this.lastTransactions.length > TRACE_TRANSACTION_LIMIT) {
                this.lastTransactions.shift();
            }
        },

        isLinkActive(linkName) {
            const entry = this.activeLinks[linkName];
            if (!entry) return false;

            if (now() < entry.expiresAt) return true;

            delete this.activeLinks[linkName];
            return false;
        },

        isLinkWrite(linkName) {
            return !!this.activeLinks[linkName]?.isWrite;
        },

        clear() {
            this.activeLinks = {};
            this.lastTransactions = [];
            this.memoryReadCount = 0;
            this.memoryWriteCount = 0;
            this.ledWriteCount = 0;
            this._lastTransactionKey = '';
            this._lastTransactionAt = 0;
            this._lastTransactionAtByLink = {};
        }
    };
}

// Bọc 4 method của một port để mỗi request/response được ghi lại vào trace.
// Idempotent: đã bọc thì bỏ qua (port được dựng mới mỗi init nên cờ tự reset).
function wrapPortForTrace(sim, port, linkName) {
    if (!port || port.__socTraceWrapped) return;
    port.__socTraceWrapped = true;

    const origSendRequest = port.sendRequest;
    const origReceiveRequest = port.receiveRequest;
    const origSendResponse = port.sendResponse;
    const origReceiveResponse = port.receiveResponse;

    const recordRequest = (from, req) => {
        sim.trace.record(linkName, {
            type: 'request',
            from,
            address: req?.address,
            isWrite: req && (isTileLinkWrite(req.type) || isTileLinkAtomic(req.type)),
            opcode: req?.type,
            value: req?.value
        });
    };

    const recordResponse = (resp) => {
        sim.trace.record(linkName, {
            type: 'response',
            from: resp?.from,
            to: resp?.to,
            address: resp?.address,
            isWrite: false,
            opcode: resp?.type,
            data: resp?.data
        });
    };

    port.sendRequest = (from, req) => {
        recordRequest(from, req);
        return origSendRequest.call(port, from, req);
    };

    port.receiveRequest = (req) => {
        recordRequest(req?.from, req);
        return origReceiveRequest.call(port, req);
    };

    port.sendResponse = (resp) => {
        recordResponse(resp);
        return origSendResponse.call(port, resp);
    };

    port.receiveResponse = (resp) => {
        recordResponse(resp);
        return origReceiveResponse.call(port, resp);
    };
}

// Map tên slave (truy cập trực tiếp) -> tên đường liên kết của sơ đồ.
function traceDirectLink(details) {
    if (details.slaveName === 'Main Memory') return 'uhToMainMemory';
    if (details.slaveName === 'DMA Controller') return 'uhToDmaRegs';
    if (details.slaveName === 'uh-to-ul-bridge') return 'uhToUlBridge';
    if (details.slaveName === 'ul-to-uh-bridge') return 'ulToUhBridge';
    if (details.slaveName === 'UART') return 'ulToUart';
    if (details.slaveName === 'CAN Controller') return 'ulToCan';
    if (details.slaveName === 'LED Matrix') return 'ulToLedMatrix';
    if (details.slaveName === 'Keyboard') return 'ulToKeyboard';
    if (details.slaveName === 'Mouse') return 'ulToMouse';
    return null;
}

// Map tên endpoint (request/response) -> tên đường liên kết của sơ đồ.
function traceEndpointLink(name) {
    if (name === 'Main Memory') return 'uhToMainMemory';
    if (name === 'DMA Controller') return 'uhToDmaRegs';
    if (name === 'uh-to-ul-bridge') return 'uhToUlBridge';
    if (name === 'ul-to-uh-bridge') return 'ulToUhBridge';
    if (name === 'UART') return 'ulToUart';
    if (name === 'CAN Controller') return 'ulToCan';
    if (name === 'LED Matrix') return 'ulToLedMatrix';
    if (name === 'Keyboard') return 'ulToKeyboard';
    if (name === 'Mouse') return 'ulToMouse';
    return null;
}

// Handler gắn vào bus.onTraceTransaction: chuyển sự kiện bus thành bản ghi trace.
function handleTileLinkTrace(sim, type, details = {}) {
    let linkName = null;
    let isWrite = false;

    if (type === 'request') {
        isWrite = isTileLinkWrite(details.type) || isTileLinkAtomic(details.type);
        linkName = traceEndpointLink(details.slaveName);
    } else if (type === 'response') {
        linkName = traceEndpointLink(details.from);
    } else if (type === 'directRead' || type === 'directWrite') {
        isWrite = type === 'directWrite';
        linkName = traceDirectLink(details);
    }

    if (!linkName) return;

    sim.trace.record(linkName, {
        type,
        from: details.from,
        to: details.to,
        address: details.address,
        isWrite,
        opcode: details.type,
        value: details.value !== undefined ? details.value : details.data,
        stalled: details.stalled === true
    });
}

// Gắn (hoặc gắn lại) toàn bộ hệ thống trace lên simulator. Gọi sau mỗi init().
export function attachSocTrace(sim) {
    if (!sim) return;

    // Tạo object trace một lần, tái sử dụng + clear qua mỗi init()/reset().
    if (!sim.trace || !sim.trace.__socTrace) {
        sim.trace = createTrace(sim);
    }
    sim.trace.clear();

    // Bọc các port vừa dựng (idempotent nhờ cờ __socTraceWrapped trên từng port mới).
    if (sim.ports) {
        Object.entries(sim.ports).forEach(([linkName, port]) => {
            wrapPortForTrace(sim, port, linkName);
        });
    }

    // Hook trace mức bus cho truy cập trực tiếp / endpoint.
    if (sim.tilelink_UH) {
        sim.tilelink_UH.onTraceTransaction = (type, details) => handleTileLinkTrace(sim, type, details);
    }
    if (sim.tilelink_UL) {
        sim.tilelink_UL.onTraceTransaction = (type, details) => handleTileLinkTrace(sim, type, details);
    }
}

// --- Tự gắn vào vòng đời simulator mà không sửa soc.js ---
// reset() và setCacheEnabled() đều gọi nội bộ init(), nên chỉ cần bọc init() là
// trace được gắn lại sau mọi lần (re)dựng SoC.
if (!simulator.__socTracePatched) {
    simulator.__socTracePatched = true;
    const origInit = simulator.init.bind(simulator);
    simulator.init = function patchedInit(...args) {
        const result = origInit(...args);
        attachSocTrace(simulator);
        return result;
    };

    // Nếu init() đã chạy trước khi module này được nạp, gắn ngay.
    if (simulator.ports) {
        attachSocTrace(simulator);
    }
}
