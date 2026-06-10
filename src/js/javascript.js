// javascript.js
// File này điều khiển giao diện người dùng, tương tác với assembler và simulator.

// --- Cấu hình cú pháp RISC-V cho CodeMirror ---
CodeMirror.defineSimpleMode("riscv", {
    start: [
        { regex: /#.*/, token: "comment" },
        { regex: /"(?:[^\\]|\\.)*?"/, token: "string" },
        { regex: /\.(?:text|data|globl|word|float|ascii|asciiz|space|align|eqv)\b/, token: "keyword" },
        { regex: /(?:la|li|mv|j|add|addi|sub|lw|sw|beq|bne|fadd\.s|flw|fsw|fsub\.s|ecall)\b/, token: "variable" },
        { regex: /(?:zero|ra|sp|gp|tp|t0|t1|t2|s0|fp|s1|a0|a1|a2|a3|a4|a5|s2|s3|s4|s5|fa0|fa1|fa2|x[0-9]+\b|f[0-9]+\b)/, token: "variable-2" },
        { regex: /[a-zA-Z_][\w]*:/, token: "tag" },
        { regex: /0x[a-f\d]+|[-+]?(?:\.\d+|\d+\.?\d*)/i, token: "number" },
    ]
});

import { assembler } from './assembler.js';
import { simulator } from './soc.js';
import { configureRiscvEditorHints } from './editor_hint.js';
import { SOC_NODES, renderSocDiagram, updateSocTraceHighlights } from './soc_diagram.js';
import {
    CAN_CMD_BITS,
    CAN_CTRL_BITS,
    CAN_DEFAULT_BASE_ADDRESS,
    CAN_REGISTERS,
    CAN_STATUS_BITS
} from './can.js';

// --- THAM CHIẾU DOM ---
let instructionInput; // Sẽ được khởi tạo bởi CodeMirror
const binaryOutput = document.getElementById('binaryOutput');

// Bảng Registers (Integer)
const registerTable = document.getElementById('registerTable');
const registerTableBody = registerTable?.querySelector('tbody');
const registerTableContainer = document.getElementById('registerTableContainer');

// Bảng Floating Point
const fpRegisterTable = document.getElementById('fpRegisterTable');
const fpRegisterTableBody = fpRegisterTable?.querySelector('tbody');
const fpRegisterTableContainer = document.getElementById('fpRegisterTableContainer');

// Tabs chuyển đổi Registers
const tabInteger = document.getElementById('tab-integer');
const tabFp = document.getElementById('tab-fp');

// Nút điều khiển Toolbar
const assembleButton = document.getElementById('assembleButton');
const runButton = document.getElementById('runButton');
const pauseButton = document.getElementById('pauseButton');
const stopButton = document.getElementById('stopButton');
const stepButton = document.getElementById('stepButton');
const resetButton = document.getElementById('resetButton');

// Thanh điều khiển tốc độ
const speedSlider = document.getElementById('speedSlider');
const speedValueLabel = document.getElementById('speedValue');
const clockRateDisplay = document.getElementById('clockRateDisplay');
const l1iCacheTableBody = document.getElementById('l1iCacheTableBody');
const l1dCacheTableBody = document.getElementById('l1dCacheTableBody');
const l2CacheTableBody = document.getElementById('l2CacheTableBody');
const l1iCacheStats = document.getElementById('l1iCacheStats');
const l1dCacheStats = document.getElementById('l1dCacheStats');
const l2CacheStats = document.getElementById('l2CacheStats');
const cacheTabL1i = document.getElementById('cache-tab-l1i');
const cacheTabL1d = document.getElementById('cache-tab-l1d');
const cacheTabL2 = document.getElementById('cache-tab-l2');
const cachePanelL1i = document.getElementById('cache-panel-l1i');
const cachePanelL1d = document.getElementById('cache-panel-l1d');
const cachePanelL2 = document.getElementById('cache-panel-l2');
const mmuOverviewStats = document.getElementById('mmuOverviewStats');
const mmuConfigTableBody = document.getElementById('mmuConfigTableBody');
const mmuAddressMapTableBody = document.getElementById('mmuAddressMapTableBody');
const mmuPageTableBody = document.getElementById('mmuPageTableBody');
const mmuTlbTableBody = document.getElementById('mmuTlbTableBody');
const mmuHistoryTableBody = document.getElementById('mmuHistoryTableBody');
const mmuTabOverview = document.getElementById('mmu-tab-overview');
const mmuTabPageTable = document.getElementById('mmu-tab-page-table');
const mmuTabTlb = document.getElementById('mmu-tab-tlb');
const mmuTabHistory = document.getElementById('mmu-tab-history');
const mmuPanelOverview = document.getElementById('mmu-panel-overview');
const mmuPanelPageTable = document.getElementById('mmu-panel-page-table');
const mmuPanelTlb = document.getElementById('mmu-panel-tlb');
const mmuPanelHistory = document.getElementById('mmu-panel-history');
const mmuRenderedValues = new Map();
// Data Segment Controls
const dataSegmentAddressInput = document.getElementById('dataSegmentAddressInput');
const goToDataSegmentAddressButton = document.getElementById('goToDataSegmentAddress');
const toggleDataSegmentModeButton = document.getElementById('toggleDataSegmentMode');
const dataSegmentBody = document.getElementById('dataSegmentBody');
const instructionViewBody = document.getElementById('instructionViewBody');

// --- BIẾN TRẠNG THÁI ---
let dataSegmentStartAddress = 0x10010000;
let dataSegmentDisplayMode = 'hex';
const dataSegmentRows = 8;
const bytesPerRow = 32;
const wordsPerRow = 8;
let currentRegisterView = 'integer';
let currentCacheView = 'l1i';
let currentMmuView = 'overview';
let activeBreakpoints = new Set();
const runState = {
    isRunning: false,
    isPaused: false,
    frameId: null,
    cycle: 0,
    maxCycles: 500000,
    breakpointAddresses: new Map(),
    lastTime: 0,
    cyclesInLastSecond: 0,
    programOutputStarted: false
};

const CAN_TX_LOG_LIMIT = 32;
const CAN_ERROR_NAMES = Object.freeze({
    0: 'NONE',
    1: 'DISABLED',
    2: 'INVALID_DLC',
    3: 'INVALID_ID',
    4: 'TX_FULL',
    5: 'RX_OVERRUN',
    6: 'EXT_DISABLED',
    7: 'INVALID_BITRATE'
});
let canTxLogFrames = [];
let canBoundController = null;
let canUiMessage = '';
let canUiMessageKind = '';

// --- SYSTEM LOG TERMINAL LOGIC ---
const logContent = document.getElementById('logContent');
const logToggleBtn = document.getElementById('logToggleBtn');
const logClearBtn = document.getElementById('logClearBtn');
const logExportBtn = document.getElementById('logExportBtn');
const logStats = document.getElementById('logStats');
const systemLogTerminal = document.getElementById('systemLogTerminal');
const logResizeHandle = document.getElementById('logResizeHandle');
const logSearchInput = document.getElementById('logSearchInput');
const logLevelFilter = document.getElementById('logLevelFilter');
const logModuleFilters = document.getElementById('logModuleFilters');
const logFilterResetBtn = document.getElementById('logFilterResetBtn');
const systemLogStore = window.__systemLogStore || {
    snapshot: () => [],
    size: () => 0,
    subscribe: () => () => { },
    clear: () => { },
    exportText: () => ''
};

let pendingLogEntries = [];
let isAutoScrollPaused = false;
let logFlushScheduled = false;
const MAX_DOM_LINES = 50000;
const MAX_LOGS_PER_FRAME = 500;
const LOG_HEIGHT_STORAGE_KEY = 'systemLogConsoleHeight';
const DEFAULT_LOG_HEIGHT = 300;
const MIN_LOG_HEIGHT = 180;
const TOP_SAFE_SPACE = 72;
const LOG_FILTER_STORAGE_KEY = 'systemLogFilters';
const KNOWN_LOG_MODULES = new Set([
    'cpu',
    'mmu',
    'cache',
    'tilelink',
    'dma',
    'memory',
    'io',
    'system',
    'other'
]);

function loadLogFilters() {
    const defaults = {
        search: '',
        level: 'all',
        modules: new Set()
    };

    try {
        const stored = JSON.parse(window.localStorage.getItem(LOG_FILTER_STORAGE_KEY));
        if (!stored || typeof stored !== 'object') return defaults;
        const modules = Array.isArray(stored.modules)
            ? stored.modules.filter((module) => KNOWN_LOG_MODULES.has(module))
            : [];

        return {
            search: typeof stored.search === 'string' ? stored.search : '',
            level: ['all', 'log', 'info', 'warn', 'error'].includes(stored.level) ? stored.level : 'all',
            modules: new Set(modules)
        };
    } catch (error) {
        return defaults;
    }
}

let logFilters = loadLogFilters();
let currentMatchingLogCount = 0;

function getMaxLogHeight() {
    return Math.max(MIN_LOG_HEIGHT, window.innerHeight - TOP_SAFE_SPACE);
}

function clampLogHeight(height) {
    if (!Number.isFinite(height)) return DEFAULT_LOG_HEIGHT;
    return Math.min(Math.max(height, MIN_LOG_HEIGHT), getMaxLogHeight());
}

function getStoredLogHeight() {
    try {
        return Number.parseFloat(window.localStorage.getItem(LOG_HEIGHT_STORAGE_KEY));
    } catch (error) {
        return NaN;
    }
}

function storeLogHeight(height) {
    try {
        window.localStorage.setItem(LOG_HEIGHT_STORAGE_KEY, String(Math.round(height)));
    } catch (error) {
        // Ignore storage failures in private/file contexts; resizing still works.
    }
}

function applyLogHeight(height, persist = false) {
    if (!systemLogTerminal) return DEFAULT_LOG_HEIGHT;
    const nextHeight = clampLogHeight(height);
    systemLogTerminal.style.setProperty('--system-log-expanded-height', `${nextHeight}px`);
    if (persist) storeLogHeight(nextHeight);
    return nextHeight;
}

function getCurrentLogHeight() {
    if (!systemLogTerminal) return DEFAULT_LOG_HEIGHT;
    const renderedHeight = systemLogTerminal.getBoundingClientRect().height;
    if (renderedHeight > MIN_LOG_HEIGHT) return renderedHeight;

    const cssHeight = getComputedStyle(systemLogTerminal).getPropertyValue('--system-log-expanded-height');
    return Number.parseFloat(cssHeight) || DEFAULT_LOG_HEIGHT;
}

function stripLogLevelPrefix(text) {
    return String(text).replace(/^\s*(?:\[(?:ERROR|WARN)\]\s*)?/i, '');
}

function getLogEntryText(entry) {
    return String(entry?.text ?? '');
}

function fallbackInferLogModules(text) {
    const rawText = stripLogLevelPrefix(text);
    const firstTag = (rawText.match(/^\[([^\]]+)\]/)?.[1] || '').toLowerCase();
    const lowerText = rawText.toLowerCase();
    const modules = new Set();

    if (firstTag.includes('soc') || firstTag.includes('arch') || firstTag.includes('ui') || firstTag.includes('syscall')) modules.add('system');
    if (firstTag.includes('io map') || firstTag.includes('uart') || firstTag.includes('can') || firstTag.includes('keyboard') || firstTag.includes('mouse')) modules.add('io');
    if (firstTag.includes('cpu') || firstTag.startsWith('cycle ')) modules.add('cpu');
    if (firstTag.includes('mmu')) modules.add('mmu');
    if (firstTag.includes('cache') || /\bl[12][id]?\s+cache\b/i.test(firstTag)) modules.add('cache');
    if (firstTag.includes('tilelink')) modules.add('tilelink');
    if (firstTag.includes('dma')) modules.add('dma');
    if (firstTag.includes('memory')) modules.add('memory');

    if (
        lowerText.includes('system reset') ||
        lowerText.includes('simulation halted') ||
        lowerText.includes('initializing app') ||
        lowerText.includes('assembly error') ||
        lowerText.includes('run error') ||
        lowerText.includes('step error') ||
        /\bsyscall\b/i.test(rawText)
    ) {
        modules.add('system');
    }

    if (lowerText.startsWith('[cycle ') || /\bcpu\b/i.test(rawText)) modules.add('cpu');
    if (/\bmmu\b/i.test(rawText)) modules.add('mmu');
    if (/\bcache\b/i.test(rawText) || /\bl[12][id]?\s+cache\b/i.test(rawText)) modules.add('cache');
    if (/\btilelink(?:-[a-z]+)?\b/i.test(rawText)) modules.add('tilelink');
    if (/\bdma\b/i.test(rawText)) modules.add('dma');
    if (/\bmain memory\b/i.test(rawText)) modules.add('memory');
    if (/\b(?:uart|keyboard|mouse)\b/i.test(rawText) || /\bcan controller\b/i.test(rawText) || lowerText.includes('led matrix') || lowerText.includes('io map')) modules.add('io');

    if (modules.size === 0) modules.add('other');
    return modules;
}

function inferLogModules(entry) {
    const rawText = stripLogLevelPrefix(getLogEntryText(entry));
    const modules = new Set();
    const classifierModules = window.__systemLogClassifier?.inferModules?.(rawText);

    if (Array.isArray(classifierModules)) {
        classifierModules.forEach((module) => {
            if (KNOWN_LOG_MODULES.has(module)) modules.add(module);
        });
    } else {
        fallbackInferLogModules(rawText).forEach((module) => modules.add(module));
    }

    if (Array.isArray(entry?.modules)) {
        entry.modules.forEach((module) => {
            if (KNOWN_LOG_MODULES.has(module)) modules.add(module);
        });
    } else if (KNOWN_LOG_MODULES.has(entry?.module)) {
        modules.add(entry.module);
    }

    if (modules.size > 1) modules.delete('other');
    if (modules.size === 0) modules.add('other');
    return modules;
}

function isLogFilterActive() {
    return logFilters.search.trim() !== '' || logFilters.level !== 'all' || logFilters.modules.size > 0;
}

function logEntryMatchesFilters(entry) {
    if (logFilters.level !== 'all' && (entry.level || 'log') !== logFilters.level) return false;
    if (logFilters.modules.size > 0) {
        const entryModules = inferLogModules(entry);
        const hasSelectedModule = Array.from(logFilters.modules).some((module) => entryModules.has(module));
        if (!hasSelectedModule) return false;
    }

    const search = logFilters.search.trim().toLowerCase();
    if (!search) return true;

    return getLogEntryText(entry).toLowerCase().includes(search);
}

function getFilteredLogEntries(entries = systemLogStore.snapshot()) {
    return entries.filter(logEntryMatchesFilters);
}

function exportLogEntries(entries) {
    return entries.map((entry) => getLogEntryText(entry)).join('\n');
}

function saveLogFilters() {
    try {
        window.localStorage.setItem(LOG_FILTER_STORAGE_KEY, JSON.stringify({
            search: logFilters.search,
            level: logFilters.level,
            modules: Array.from(logFilters.modules)
        }));
    } catch (error) {
        // Filters still work when storage is unavailable.
    }
}

function renderLogFilterControls() {
    if (logSearchInput && logSearchInput.value !== logFilters.search) {
        logSearchInput.value = logFilters.search;
    }
    if (logLevelFilter && logLevelFilter.value !== logFilters.level) {
        logLevelFilter.value = logFilters.level;
    }
    if (!logModuleFilters) return;

    const chips = logModuleFilters.querySelectorAll('[data-log-module]');
    chips.forEach((chip) => {
        const module = chip.dataset.logModule;
        const isAllChip = module === 'all';
        const active = isAllChip ? logFilters.modules.size === 0 : logFilters.modules.has(module);
        chip.classList.toggle('active', active);
        chip.setAttribute('aria-pressed', String(active));
    });
}

function updateLogFilters(nextFilters) {
    logFilters = {
        search: nextFilters.search ?? logFilters.search,
        level: nextFilters.level ?? logFilters.level,
        modules: nextFilters.modules ?? logFilters.modules
    };
    saveLogFilters();
    renderLogFilterControls();
    renderFilteredLogSnapshot();
}

function resetLogFilters() {
    updateLogFilters({
        search: '',
        level: 'all',
        modules: new Set()
    });
}

function keepLogScrolledToBottom() {
    if (!logContent || isAutoScrollPaused) return;
    window.requestAnimationFrame(() => {
        logContent.scrollTop = logContent.scrollHeight;
    });
}

function setLogExpanded(expanded) {
    if (!systemLogTerminal) return;
    systemLogTerminal.classList.toggle('expanded', expanded);
    if (logToggleBtn) logToggleBtn.setAttribute('aria-expanded', String(expanded));
    if (expanded) keepLogScrolledToBottom();
}

function updateLogStats() {
    if (!logStats) return;
    const visibleCount = logContent ? logContent.childElementCount : 0;
    const exportCount = typeof systemLogStore.size === 'function'
        ? systemLogStore.size()
        : systemLogStore.snapshot().length;
    const matchingCount = isLogFilterActive() ? Math.min(currentMatchingLogCount, exportCount) : exportCount;
    logStats.textContent = `Visible: ${visibleCount} / Match: ${matchingCount} / Total: ${exportCount}`;
}

function createLogLine(entry) {
    const line = document.createElement('div');
    line.className = 'log-line';
    const modules = Array.from(inferLogModules(entry));
    const level = entry.level || 'log';
    const text = getLogEntryText(entry);

    if (level === 'log') line.classList.add('log-debug');
    if (level === 'error') line.classList.add('log-error');
    if (level === 'warn') line.classList.add('log-warn');
    if (level === 'info') line.classList.add('log-info');
    if (text.startsWith('[Cycle ')) line.classList.add('log-cycle');

    line.dataset.logModule = modules.join(' ');
    line.title = `${level.toUpperCase()} / ${modules.map((module) => module.toUpperCase()).join(', ')}`;
    line.textContent = text;
    return line;
}

function trimLogDom() {
    if (!logContent) return;
    while (logContent.childElementCount > MAX_DOM_LINES) {
        logContent.removeChild(logContent.firstElementChild);
    }
    updateLogStats();
}

function flushPendingLogs() {
    logFlushScheduled = false;
    if (!logContent || pendingLogEntries.length === 0) return;

    const fragment = document.createDocumentFragment();
    const batch = pendingLogEntries.splice(0, MAX_LOGS_PER_FRAME);
    batch.forEach((entry) => fragment.appendChild(createLogLine(entry)));
    logContent.appendChild(fragment);

    trimLogDom();

    if (!isAutoScrollPaused) {
        logContent.scrollTop = logContent.scrollHeight;
    }

    if (pendingLogEntries.length > 0) {
        scheduleLogFlush();
    }
}

function scheduleLogFlush() {
    if (logFlushScheduled || !logContent) return;
    logFlushScheduled = true;
    window.requestAnimationFrame(flushPendingLogs);
}

function clearRenderedLogs() {
    pendingLogEntries = [];
    logFlushScheduled = false;
    if (logContent) logContent.textContent = '';
    updateLogStats();
}

function queueLogEntries(entries) {
    if (!logContent || entries.length === 0) return;
    pendingLogEntries.push(...entries);
    scheduleLogFlush();
}

function renderFilteredLogSnapshot() {
    const filteredEntries = getFilteredLogEntries(systemLogStore.snapshot());
    currentMatchingLogCount = filteredEntries.length;
    clearRenderedLogs();
    queueLogEntries(filteredEntries.slice(-MAX_DOM_LINES));
    updateLogStats();
    keepLogScrolledToBottom();
}

// Set up UI listeners for terminal
if (systemLogTerminal) {
    applyLogHeight(getStoredLogHeight());
    if (logToggleBtn) logToggleBtn.setAttribute('aria-expanded', 'false');
}

if (logToggleBtn && systemLogTerminal) {
    const logHeader = document.querySelector('.log-header');
    if (logHeader) {
        logHeader.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            setLogExpanded(!systemLogTerminal.classList.contains('expanded'));
        });
    }
    logToggleBtn.addEventListener('click', () => {
        setLogExpanded(!systemLogTerminal.classList.contains('expanded'));
    });
}

renderLogFilterControls();

if (logSearchInput) {
    logSearchInput.addEventListener('input', () => {
        updateLogFilters({ search: logSearchInput.value });
    });
}

if (logLevelFilter) {
    logLevelFilter.addEventListener('change', () => {
        updateLogFilters({ level: logLevelFilter.value });
    });
}

if (logModuleFilters) {
    logModuleFilters.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-log-module]');
        if (!chip) return;

        const module = chip.dataset.logModule;
        if (module === 'all') {
            updateLogFilters({ modules: new Set() });
            return;
        }

        const modules = new Set(logFilters.modules);
        if (modules.has(module)) modules.delete(module);
        else modules.add(module);
        updateLogFilters({ modules });
    });
}

if (logFilterResetBtn) {
    logFilterResetBtn.addEventListener('click', resetLogFilters);
}

if (logResizeHandle && systemLogTerminal) {
    let resizeState = null;

    const handleResizeMove = (event) => {
        if (!resizeState) return;
        event.preventDefault();
        const nextHeight = resizeState.startHeight + (resizeState.startY - event.clientY);
        applyLogHeight(nextHeight);
        keepLogScrolledToBottom();
    };

    const finishResize = (event) => {
        if (!resizeState) return;
        applyLogHeight(getCurrentLogHeight(), true);
        systemLogTerminal.classList.remove('resizing');
        document.body.style.cursor = '';
        document.removeEventListener('pointermove', handleResizeMove);
        document.removeEventListener('pointerup', finishResize);
        window.removeEventListener('blur', finishResize);
        const shouldReleaseCapture = event?.pointerId !== undefined && logResizeHandle.hasPointerCapture?.(event.pointerId);
        resizeState = null;
        if (shouldReleaseCapture) {
            logResizeHandle.releasePointerCapture(event.pointerId);
        }
        keepLogScrolledToBottom();
    };

    logResizeHandle.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        setLogExpanded(true);
        resizeState = {
            startY: event.clientY,
            startHeight: getCurrentLogHeight()
        };
        systemLogTerminal.classList.add('resizing');
        document.body.style.cursor = 'ns-resize';
        logResizeHandle.setPointerCapture?.(event.pointerId);
        document.addEventListener('pointermove', handleResizeMove);
        document.addEventListener('pointerup', finishResize);
        window.addEventListener('blur', finishResize);
    });

    logResizeHandle.addEventListener('pointermove', handleResizeMove);

    logResizeHandle.addEventListener('pointerup', finishResize);
    logResizeHandle.addEventListener('pointercancel', finishResize);
    logResizeHandle.addEventListener('lostpointercapture', finishResize);

    window.addEventListener('resize', () => {
        applyLogHeight(getCurrentLogHeight(), true);
    });
}

if (logClearBtn) {
    logClearBtn.addEventListener('click', () => {
        systemLogStore.clear();
    });
}

if (logExportBtn) {
    logExportBtn.addEventListener('click', () => {
        const exportEntries = getFilteredLogEntries(systemLogStore.snapshot());
        const blob = new Blob([exportLogEntries(exportEntries)], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = isLogFilterActive() ? 'simulator_logs_filtered.txt' : 'simulator_logs.txt';
        a.click();
        URL.revokeObjectURL(url);
    });
}

// Track scrolling to pause auto-scroll
if (logContent) {
    logContent.addEventListener('scroll', () => {
        const isAtBottom = Math.abs((logContent.scrollHeight - logContent.scrollTop) - logContent.clientHeight) < 10;
        isAutoScrollPaused = !isAtBottom;
    });

    renderFilteredLogSnapshot();
    systemLogStore.subscribe((event) => {
        if (event.type === 'clear') {
            currentMatchingLogCount = 0;
            clearRenderedLogs();
            return;
        }
        if (event.type === 'entry') {
            const matchesFilters = logEntryMatchesFilters(event.entry);
            if (matchesFilters) {
                currentMatchingLogCount++;
                queueLogEntries([event.entry]);
            }
            updateLogStats();
        }
    });
} else {
    updateLogStats();
}

// --- HÀM QUẢN LÝ VIEW ---

/* Hàm chuyển đổi hiển thị bảng thanh ghi (Tabs Logic) */
function setRegisterView(view) {
    const isInteger = view === 'integer';
    currentRegisterView = view;

    // 1. Ẩn/Hiện Container của bảng
    if (registerTableContainer) registerTableContainer.style.display = isInteger ? 'block' : 'none';
    if (fpRegisterTableContainer) fpRegisterTableContainer.style.display = isInteger ? 'none' : 'block';

    // 2. Cập nhật trạng thái Active cho Tab
    if (tabInteger) {
        if (isInteger) tabInteger.classList.add('active');
        else tabInteger.classList.remove('active');
    }
    if (tabFp) {
        if (!isInteger) tabFp.classList.add('active');
        else tabFp.classList.remove('active');
    }
}

/* Tạo marker breakpoint (dấu chấm đỏ) */
function makeBreakpointMarker() {
    const marker = document.createElement("div");
    marker.style.color = "#e52d2d";
    marker.innerHTML = "●";
    return marker;
}

/* Cập nhật input địa chỉ data */
function setDataAddressValue(value) {
    if (dataSegmentAddressInput) {
        dataSegmentAddressInput.value = value;
    }
}

// --- HẰNG SỐ TÊN THANH GHI ---
const abiNames = [
    'zero', 'ra', 'sp', 'gp', 'tp', 't0', 't1', 't2',
    's0/fp', 's1', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5',
    'a6', 'a7', 's2', 's3', 's4', 's5', 's6', 's7',
    's8', 's9', 's10', 's11', 't3', 't4', 't5', 't6'
];

const fpAbiNames = [
    'ft0', 'ft1', 'ft2', 'ft3', 'ft4', 'ft5', 'ft6', 'ft7',
    'fs0', 'fs1', 'fa0', 'fa1', 'fa2', 'fa3', 'fa4', 'fa5',
    'fa6', 'fa7', 'fs2', 'fs3', 'fs4', 'fs5', 'fs6', 'fs7',
    'fs8', 'fs9', 'fs10', 'fs11', 'ft8', 'ft9', 'ft10', 'ft11'
];

// --- HÀM UI CƠ BẢN ---

function updateBreakpointUI() {
    const checkboxes = document.querySelectorAll('#instructionViewTable input[type="checkbox"]');
    checkboxes.forEach(cb => {
        const lineNum = parseInt(cb.dataset.lineNumber);
        cb.checked = activeBreakpoints.has(lineNum);
    });
}

function initializeRegisterTable() {
    if (!registerTableBody) return;
    registerTableBody.innerHTML = '';
    for (let i = 0; i < 32; i++) {
        const row = registerTableBody.insertRow();
        row.id = `reg-${i}`;
        row.insertCell().textContent = `x${i} (${abiNames[i]})`;
        row.insertCell().textContent = '0x00000000';
        row.insertCell().textContent = '0';
    }
    const pcRow = registerTableBody.insertRow();
    pcRow.id = 'reg-pc';
    pcRow.insertCell().textContent = 'PC';
    pcRow.insertCell().textContent = '0x00000000';
    pcRow.insertCell().textContent = '0';
}

function initializeFPRegisterTable() {
    if (!fpRegisterTableBody) return;
    fpRegisterTableBody.innerHTML = '';
    for (let i = 0; i < 32; i++) {
        const row = fpRegisterTableBody.insertRow();
        row.id = `freg-${i}`;
        row.insertCell().textContent = `f${i} (${fpAbiNames[i] || '?'})`;
        row.insertCell().textContent = '0.0';
        row.insertCell().textContent = '0x00000000';
    }
}

function disassembleInstruction(instructionWord) {
    if (!simulator) return "Simulator not ready";
    try {
        const decoded = simulator.cpu.decode(instructionWord);
        if (decoded.opName === 'UNKNOWN') return `(unknown: 0x${instructionWord.toString(16).padStart(8, '0')})`;

        const rd = `x${decoded.rd}`;
        const rs1 = `x${decoded.rs1}`;
        const rs2 = `x${decoded.rs2}`;
        const op = decoded.opName.toLowerCase();

        if (op === 'ecall' || op === 'ebreak') return op;

        switch (decoded.type) {
            case 'R': return `${op} ${rd}, ${rs1}, ${rs2}`;
            case 'I':
                if (['lw', 'lb', 'lh', 'lbu', 'lhu', 'jalr', 'flw'].includes(op)) {
                    return `${op} ${op.startsWith('f') ? `f${decoded.rd}` : rd}, ${decoded.imm}(${rs1})`;
                }
                return `${op} ${rd}, ${rs1}, ${decoded.imm}`;
            case 'S': return `${op} ${rs2}, ${decoded.imm}(${rs1})`;
            case 'B': return `${op} ${rs1}, ${rs2}, ${decoded.imm}`;
            case 'U': return `${op} ${rd}, ${decoded.imm >>> 12}`;
            case 'J': return `${op} ${rd}, ${decoded.imm}`;
            case 'S-FP': return `${op} f${decoded.rs2}, ${decoded.imm}(${rs1})`;
            case 'R-FP': return `${op} f${decoded.rd}, f${decoded.rs1}, f${decoded.rs2}`;
            default: return `${op}`;
        }
    } catch (e) {
        return `(disassembly error)`;
    }
}

function renderInstructionView() {
    if (!instructionViewBody || !assembler.binaryCode) {
        if (instructionViewBody) instructionViewBody.innerHTML = '';
        return;
    }

    instructionViewBody.innerHTML = '';
    const pc = simulator.cpu.pc;

    if (assembler.binaryCode.length === 0) {
        const row = instructionViewBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 5;
        cell.textContent = 'No instructions assembled.';
        return;
    }

    const sourceLineMap = new Map();
    assembler.instructionLines.forEach(lineInfo => {
        if (lineInfo.type === 'instruction' || lineInfo.type === 'pseudo-instruction') {
            sourceLineMap.set(lineInfo.address, lineInfo);
        }
    });

    let lastSourceLineNum = -1;

    assembler.binaryCode.forEach(instr => {
        const row = instructionViewBody.insertRow();
        row.dataset.address = instr.address;

        if (instr.address === pc) {
            row.classList.add('pc-highlight');
        }

        let sourceLine = sourceLineMap.get(instr.address);
        if (!sourceLine) {
            const closestAddress = Array.from(sourceLineMap.keys()).filter(addr => addr < instr.address).pop();
            if (closestAddress !== undefined) {
                const potentialSource = sourceLineMap.get(closestAddress);
                if (instr.address < potentialSource.address + potentialSource.size) {
                    sourceLine = potentialSource;
                }
            }
        }

        // Cột 1: Breakpoint
        const bkptCell = row.insertCell();
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        if (sourceLine) {
            checkbox.dataset.lineNumber = sourceLine.lineNumber;
            checkbox.checked = activeBreakpoints.has(sourceLine.lineNumber);

            checkbox.addEventListener('click', (e) => {
                const lineNum = parseInt(e.currentTarget.dataset.lineNumber, 10);
                const cmLine = lineNum - 1;

                if (activeBreakpoints.has(lineNum)) {
                    if (instructionInput) instructionInput.setGutterMarker(cmLine, "breakpoints", null);
                    activeBreakpoints.delete(lineNum);
                } else {
                    if (instructionInput) instructionInput.setGutterMarker(cmLine, "breakpoints", makeBreakpointMarker());
                    activeBreakpoints.add(lineNum);
                }
                updateBreakpointUI();
            });
        } else {
            checkbox.disabled = true;
        }
        bkptCell.appendChild(checkbox);

        // Cột 2: Address, Code, ...
        row.insertCell().textContent = `0x${instr.address.toString(16).padStart(8, '0')}`;
        row.insertCell().textContent = instr.hex;
        row.insertCell().textContent = disassembleInstruction(parseInt(instr.hex, 16));

        const sourceCell = row.insertCell();
        if (sourceLine && sourceLine.lineNumber !== lastSourceLineNum) {
            sourceCell.textContent = `${sourceLine.lineNumber}: ${sourceLine.original.trim()}`;
            lastSourceLineNum = sourceLine.lineNumber;
        }
    });
}

function renderDataSegmentTable() {
    if (!dataSegmentBody || !simulator) {
        if (dataSegmentBody) dataSegmentBody.innerHTML = '<tr><td colspan="9">Simulator not ready.</td></tr>';
        return;
    }
    dataSegmentBody.innerHTML = '';

    for (let i = 0; i < dataSegmentRows; i++) {
        const rowBaseAddress = Math.max(0, dataSegmentStartAddress + i * bytesPerRow);
        const row = dataSegmentBody.insertRow();
        const addrCell = row.insertCell();
        addrCell.textContent = `0x${rowBaseAddress.toString(16).padStart(8, '0')}`;

        for (let j = 0; j < wordsPerRow; j++) {
            const wordStartAddress = rowBaseAddress + j * 4;
            let displayValue = '';
            let wordValue = 0;
            let allBytesNull = true;

            for (let k = 0; k < 4; k++) {
                const byte = simulator.mem.mem[wordStartAddress + k] ?? null;
                if (byte !== null) {
                    allBytesNull = false;
                    wordValue |= (byte << (k * 8));
                }
            }
            if (dataSegmentDisplayMode === 'hex') {
                displayValue = allBytesNull ? '........' : `0x${(wordValue >>> 0).toString(16).padStart(8, '0')}`;
            } else {
                const bytes = [(wordValue & 0xff), (wordValue >> 8 & 0xff), (wordValue >> 16 & 0xff), (wordValue >> 24 & 0xff)];
                displayValue = bytes.map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
            }
            row.insertCell().textContent = displayValue;
        }
    }
}

function getCANBase(can = simulator?.can) {
    return (can?.baseAddress ?? CAN_DEFAULT_BASE_ADDRESS) >>> 0;
}

function formatCANHex(value, pad = 0) {
    return `0x${(value >>> 0).toString(16).toUpperCase().padStart(pad, '0')}`;
}

function formatCANByte(value) {
    return (value & 0xFF).toString(16).toUpperCase().padStart(2, '0');
}

function formatCANFrame(frame) {
    if (!frame) return 'No frame';
    const dlc = Math.max(0, Math.min(8, frame.dlc ?? 0));
    const idPad = frame.extended ? 8 : 3;
    const data = Array.isArray(frame.data) || ArrayBuffer.isView(frame.data)
        ? Array.from(frame.data).slice(0, dlc)
        : [];
    const payload = data.length > 0 ? data.map(formatCANByte).join(' ') : '(none)';
    return `${frame.extended ? 'EXT' : 'STD'} ID=${formatCANHex(frame.id ?? 0, idPad)} DLC=${dlc} DATA=${payload}`;
}

function setCANMessage(message = '', kind = '') {
    canUiMessage = message;
    canUiMessageKind = kind;
}

function renderCANFrameList(container, frames, emptyText, limit = 6) {
    if (!container) return;
    const list = Array.isArray(frames) ? frames : [];
    if (list.length === 0) {
        container.textContent = emptyText;
        return;
    }

    container.textContent = list
        .slice(0, limit)
        .map((frame, index) => `${index + 1}. ${formatCANFrame(frame)}`)
        .join('\n');
}

function renderCANView() {
    const can = simulator?.can;
    const statusEn = document.getElementById('canStatusEn');
    const statusLoopback = document.getElementById('canStatusLoopback');
    const statusTxCount = document.getElementById('canStatusTxCount');
    const statusRxCount = document.getElementById('canStatusRxCount');
    const statusError = document.getElementById('canStatusError');
    const txLog = document.getElementById('canTxLog');
    const rxPreview = document.getElementById('canRxPreview');
    const injectStatus = document.getElementById('canInjectStatus');

    if (!statusEn && !statusLoopback && !txLog && !rxPreview && !injectStatus) return;

    if (!can) {
        if (statusEn) statusEn.textContent = 'OFF';
        if (statusLoopback) statusLoopback.textContent = 'OFF';
        if (statusTxCount) statusTxCount.textContent = '0';
        if (statusRxCount) statusRxCount.textContent = '0';
        if (statusError) statusError.textContent = 'No CAN';
        renderCANFrameList(txLog, [], 'No transmitted frames yet.');
        renderCANFrameList(rxPreview, [], 'RX FIFO is empty.');
        return;
    }

    const base = getCANBase(can);
    const ctrl = can.readRegister(base + CAN_REGISTERS.CTRL) >>> 0;
    const status = can.readRegister(base + CAN_REGISTERS.STATUS) >>> 0;
    const txCount = (status >>> 8) & 0xFF;
    const rxCount = (status >>> 16) & 0xFF;
    const lastError = (status >>> 24) & 0xFF;
    const rxOverrun = (status & CAN_STATUS_BITS.RX_OVERRUN) !== 0;
    const hasError = (status & CAN_STATUS_BITS.ERROR) !== 0;

    if (statusEn) statusEn.textContent = (ctrl & CAN_CTRL_BITS.EN) ? 'ON' : 'OFF';
    if (statusLoopback) statusLoopback.textContent = (ctrl & CAN_CTRL_BITS.LOOPBACK) ? 'ON' : 'OFF';
    if (statusTxCount) statusTxCount.textContent = `${txCount} pending / ${canTxLogFrames.length} sent`;
    if (statusRxCount) statusRxCount.textContent = `${rxCount} queued`;
    if (statusError) {
        if (!rxOverrun && !hasError) {
            statusError.textContent = 'OK';
        } else {
            const parts = [];
            if (rxOverrun) parts.push('RX_OVERRUN');
            if (hasError) parts.push(CAN_ERROR_NAMES[lastError] || `ERR_${lastError}`);
            statusError.textContent = parts.join(' / ');
        }
    }

    renderCANFrameList(txLog, canTxLogFrames, 'No transmitted frames yet.', 10);
    renderCANFrameList(rxPreview, can.rxFifo || [], 'RX FIFO is empty.', 5);

    if (injectStatus) {
        injectStatus.textContent = canUiMessage;
        injectStatus.classList.toggle('ok', canUiMessageKind === 'ok');
        injectStatus.classList.toggle('error', canUiMessageKind === 'error');
    }
}

function parseCANHexInteger(rawValue, label) {
    const text = String(rawValue ?? '').trim();
    if (!text) throw new Error(`${label} is required.`);
    const hex = text.replace(/^0x/i, '');
    if (!/^[0-9a-f]+$/i.test(hex)) {
        throw new Error(`${label} must be a hexadecimal value.`);
    }
    const value = Number.parseInt(hex, 16);
    if (!Number.isFinite(value)) throw new Error(`${label} is invalid.`);
    return value >>> 0;
}

function parseCANPayloadBytes(rawValue) {
    const text = String(rawValue ?? '').trim();
    if (!text) return [];

    const tokens = text.split(/[\s,]+/).filter(Boolean);
    if (tokens.length > 8) {
        throw new Error('Payload has more than 8 bytes.');
    }

    return tokens.map((token) => {
        const hex = token.replace(/^0x/i, '');
        if (!/^[0-9a-f]{1,2}$/i.test(hex)) {
            throw new Error(`Invalid payload byte "${token}". Use hex bytes like 11 22 AA.`);
        }
        return Number.parseInt(hex, 16) & 0xFF;
    });
}

function injectCANFrameFromUI() {
    const can = simulator?.can;
    const idInput = document.getElementById('canInjectId');
    const extendedInput = document.getElementById('canInjectExtended');
    const dlcInput = document.getElementById('canInjectDlc');
    const payloadInput = document.getElementById('canInjectPayload');

    if (!can || !idInput || !extendedInput || !dlcInput || !payloadInput) return;

    try {
        const extended = !!extendedInput.checked;
        const id = parseCANHexInteger(idInput.value, 'CAN ID');
        const maxId = extended ? 0x1FFFFFFF : 0x7FF;
        if (id > maxId) {
            throw new Error(`${extended ? 'Extended' : 'Standard'} CAN ID must be <= ${formatCANHex(maxId)}.`);
        }

        const dlc = Number.parseInt(dlcInput.value, 10);
        if (!Number.isInteger(dlc) || dlc < 0 || dlc > 8) {
            throw new Error('DLC must be an integer from 0 to 8.');
        }

        const payload = parseCANPayloadBytes(payloadInput.value);
        if (payload.length > dlc) {
            throw new Error('Payload has more bytes than DLC.');
        }

        const paddedPayload = payload.slice();
        while (paddedPayload.length < dlc) paddedPayload.push(0);

        const frame = { id, extended, dlc, data: paddedPayload };
        const accepted = can.injectFrame(frame);
        if (!accepted) {
            setCANMessage('CAN rejected frame. Check RX FIFO space and CTRL EXT_ID_EN for extended IDs.', 'error');
        } else {
            const paddingNote = paddedPayload.length > payload.length ? ' Missing bytes padded with 00.' : '';
            setCANMessage(`Injected ${formatCANFrame(frame)}.${paddingNote}`, 'ok');
        }
    } catch (error) {
        setCANMessage(error.message, 'error');
    }

    renderCANView();
    renderSocView();
}

function clearCANLogAndStatus() {
    canTxLogFrames = [];
    const can = simulator?.can;
    if (can) {
        can.writeRegister(getCANBase(can) + CAN_REGISTERS.CMD, CAN_CMD_BITS.CLEAR_ERROR);
    }
    setCANMessage('Cleared CAN UI log and sticky error status.', 'ok');
    renderCANView();
    renderSocView();
}

function updateUIGlobally() {
    const currentSimulator = simulator;

    if (registerTableBody) {
        for (let i = 0; i < 32; i++) {
            const row = document.getElementById(`reg-${i}`);
            const value = currentSimulator.cpu.registers[i];
            if (row && row.cells.length >= 3) {
                const hex = `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
                if (hex !== row.cells[1].textContent) row.classList.add('highlight');
                else row.classList.remove('highlight');
                row.cells[1].textContent = hex;
                row.cells[2].textContent = (value >>> 0).toString();
            }
        }
        const pcRow = document.getElementById('reg-pc');
        if (pcRow && pcRow.cells.length >= 3) {
            const pc = currentSimulator.cpu.pc;
            const hex = `0x${(pc >>> 0).toString(16).padStart(8, '0')}`;
            if (hex !== pcRow.cells[1].textContent) pcRow.classList.add('highlight');
            else pcRow.classList.remove('highlight');
            pcRow.cells[1].textContent = hex;
            pcRow.cells[2].textContent = (pc >>> 0).toString();
        }
    }

    if (fpRegisterTableBody && currentSimulator.cpu?.fregisters) {
        for (let i = 0; i < 32; i++) {
            const row = document.getElementById(`freg-${i}`);
            const value = currentSimulator.cpu.fregisters[i];
            const buffer = new ArrayBuffer(4);
            const view = new DataView(buffer);
            view.setFloat32(0, value, true);
            const floatStr = value.toPrecision(7);

            if (row && row.cells.length >= 3) {
                if (floatStr !== row.cells[1].textContent) row.classList.add('highlight');
                else row.classList.remove('highlight');
                row.cells[1].textContent = floatStr;
                row.cells[2].textContent = `0x${(view.getInt32(0, true) >>> 0).toString(16).padStart(8, '0')}`;
            }
        }
    }

    renderDataSegmentTable();
    renderInstructionView();
    renderCacheView();
    renderMMUView();
    renderSocView();
    renderCANView();

    setTimeout(() => {
        document.querySelectorAll('tr.highlight').forEach(row => row.classList.remove('highlight'));
    }, 500);
}

function escapeSocTooltipHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function renderSocView() {
    const socContainer = document.querySelector('.soc-view-container');
    if (!socContainer || !simulator) return;
    renderSocDiagram(socContainer, simulator);

    // 1. Update RISC-V Core Status
    const cpuStatusText = document.getElementById('soc-status-cpu');
    if (cpuStatusText && simulator.cpu) {
        const pcHex = '0x' + (simulator.cpu.pc >>> 0).toString(16).padStart(8, '0');
        let instrText = 'NOP';
        if (assembler && assembler.binaryCode) {
            const instr = assembler.binaryCode.find(i => i.address === simulator.cpu.pc);
            if (instr) {
                instrText = disassembleInstruction(parseInt(instr.hex, 16));
            }
        }
        cpuStatusText.textContent = `${pcHex} (${instrText})`;
    }

    // 2. Update MMU Status
    const mmuStatusText = document.getElementById('soc-status-mmu');
    if (mmuStatusText && simulator.mmu) {
        const mmu = simulator.mmu;
        if (mmu.lastTranslation) {
            const lt = mmu.lastTranslation;
            const resultText = lt.result === 'ok' ? '' : ` (${lt.result})`;
            mmuStatusText.textContent = `0x${lt.virtualAddress.toString(16)} -> 0x${lt.physicalAddress.toString(16)}${resultText}`;
        } else {
            mmuStatusText.textContent = mmu.pageTable && mmu.pageTable.size > 0 ? 'Mapped Mode' : 'Identity Mode';
        }
    }

    // 3. Update Caches Status
    const l1iStatusText = document.getElementById('soc-status-l1i');
    if (l1iStatusText && simulator.iCache) {
        const s = simulator.iCache.statistics;
        const total = s.numHit + s.numMiss;
        const hitRate = total > 0
            ? `${((s.numHit / total) * 100).toFixed(1)}%`
            : '100%';
        l1iStatusText.textContent = `Hit Rate: ${hitRate}`;
    }

    const l1dStatusText = document.getElementById('soc-status-l1d');
    if (l1dStatusText && simulator.dCache) {
        const s = simulator.dCache.statistics;
        const total = s.numHit + s.numMiss;
        const hitRate = total > 0
            ? `${((s.numHit / total) * 100).toFixed(1)}%`
            : '100%';
        l1dStatusText.textContent = `Hit Rate: ${hitRate}`;
    }

    const l2StatusText = document.getElementById('soc-status-l2');
    if (l2StatusText && simulator.l2Cache) {
        const s = simulator.l2Cache.statistics;
        const total = s.numHit + s.numMiss;
        const hitRate = total > 0
            ? `${((s.numHit / total) * 100).toFixed(1)}%`
            : '100%';
        l2StatusText.textContent = `Hit Rate: ${hitRate}`;
    }

    // 4. Update DMA Controller Status
    const dmaStatusText = document.getElementById('soc-status-dma');
    if (dmaStatusText && simulator.dma) {
        const dma = simulator.dma;
        if (dma.registers && dma.registers.busy) {
            dmaStatusText.textContent = `Busy: ${dma.transferProgress}/${dma.numElements}`;
        } else {
            dmaStatusText.textContent = 'Idle';
        }
    }

    // 5. Update Buses Status
    const tlUhStatusText = document.getElementById('soc-status-tl-uh');
    if (tlUhStatusText && simulator.tilelink_UH) {
        const isBusy = simulator.tilelink_UH.requestQueue.length > 0 || simulator.tilelink_UH.inFlight;
        tlUhStatusText.textContent = isBusy ? `Busy (Queue: ${simulator.tilelink_UH.requestQueue.length})` : 'Idle';
    }

    const tlUlStatusText = document.getElementById('soc-status-tl-ul');
    if (tlUlStatusText && simulator.tilelink_UL) {
        const isBusy = simulator.tilelink_UL.requestQueue.length > 0 || simulator.tilelink_UL.inFlight;
        tlUlStatusText.textContent = isBusy ? `Busy (Queue: ${simulator.tilelink_UL.requestQueue.length})` : 'Idle';
    }

    // 6. Update Main Memory Status
    const memoryStatusText = document.getElementById('soc-status-memory');
    if (memoryStatusText && simulator.trace) {
        memoryStatusText.textContent = `Read: ${simulator.trace.memoryReadCount} / Write: ${simulator.trace.memoryWriteCount}`;
    }

    // 7. Update UART Status
    const uartStatusText = document.getElementById('soc-status-uart');
    if (uartStatusText && simulator.uart) {
        uartStatusText.textContent = `TX: ${simulator.uart.txBuffer?.length || 0} / RX: ${simulator.uart.rxBuffer?.length || 0}`;
    }

    // 7b. Update CAN Status
    const canStatusText = document.getElementById('soc-status-can');
    if (canStatusText && simulator.can) {
        const can = simulator.can;
        const status = can.readRegister(getCANBase(can) + CAN_REGISTERS.STATUS) >>> 0;
        const txCount = (status >>> 8) & 0xFF;
        const rxCount = (status >>> 16) & 0xFF;
        const hasError = (status & CAN_STATUS_BITS.ERROR) !== 0;
        const rxOverrun = (status & CAN_STATUS_BITS.RX_OVERRUN) !== 0;
        canStatusText.textContent = `TX:${txCount} RX:${rxCount}${rxOverrun ? ' OVR' : ''}${hasError ? ' ERR' : ''}`;
    }

    // 8. Update LED Matrix Status
    const ledStatusText = document.getElementById('soc-status-led');
    if (ledStatusText && simulator.trace) {
        ledStatusText.textContent = `Writes: ${simulator.trace.ledWriteCount} words`;
    }

    // 9. Update Keyboard Status
    const keyboardStatusText = document.getElementById('soc-status-keyboard');
    if (keyboardStatusText && simulator.keyboard) {
        const count = simulator.keyboard.buffer?.length || 0;
        keyboardStatusText.textContent = count > 0 ? `Buffer: ${count} keys` : 'Empty';
    }

    // 10. Update Mouse Status
    const mouseStatusText = document.getElementById('soc-status-mouse');
    if (mouseStatusText && simulator.mouse) {
        mouseStatusText.textContent = `x=${simulator.mouse.x || 0}, y=${simulator.mouse.y || 0}`;
    }

    const trace = simulator.trace;
    if (trace) {
        updateSocTraceHighlights(trace);
    }
}

function setupSocInteractivity() {
    const tooltip = document.getElementById('soc-tooltip');
    const tooltipText = document.getElementById('soc-tooltip-text');

    Object.entries(SOC_NODES).forEach(([id, node]) => {
        const element = document.getElementById(`block-${id}`);
        if (!element) return;
        if (element.dataset.socInteractiveBound === 'true') return;
        element.dataset.socInteractiveBound = 'true';

        // Hover event for tooltips
        element.addEventListener('mouseenter', () => {
            const description = node.tooltip || node.desc;
            if (tooltip && tooltipText && description) {
                let extra = '';
                if (simulator && simulator.trace) {
                    const lastTx = simulator.trace.lastTransactions
                        .filter(tx => {
                            if (id === 'cpu') return tx.linkName === 'cpuToMmu';
                            if (id === 'mmu') return tx.linkName === 'cpuToMmu' || tx.linkName.startsWith('mmu');
                            if (id === 'l1i') return tx.linkName === 'mmuToL1I' || tx.linkName === 'l1iToL2';
                            if (id === 'l1d') return tx.linkName === 'mmuToL1D' || tx.linkName === 'l1dToL2';
                            if (id === 'l2') return tx.linkName === 'l1iToL2' || tx.linkName === 'l1dToL2' || tx.linkName === 'l2ToUh';
                            if (id === 'tl-uh') return tx.linkName.startsWith('uh');
                            if (id === 'tl-ul') return tx.linkName.startsWith('ul') || tx.linkName.endsWith('ulBridge');
                            if (id === 'memory') return tx.linkName === 'uhToMainMemory';
                            if (id === 'dma') return tx.linkName.toLowerCase().includes('dma');
                            if (id === 'uart') return tx.linkName === 'ulToUart';
                            if (id === 'can') return tx.linkName === 'ulToCan';
                            if (id === 'led') return tx.linkName === 'ulToLedMatrix';
                            if (id === 'keyboard') return tx.linkName === 'ulToKeyboard';
                            if (id === 'mouse') return tx.linkName === 'ulToMouse';
                            return false;
                        })
                        .pop(); // Get most recent transaction
                    if (lastTx) {
                        extra = `<br><span style="color:#00ff00;font-family:monospace;font-size:0.75rem;">Last Transaction: ${escapeSocTooltipHtml(lastTx.description)}</span>`;
                    }
                }

                const blockName = node.name || element.querySelector('.soc-block-name')?.textContent || id;
                tooltipText.innerHTML = `<strong>${escapeSocTooltipHtml(blockName)}:</strong> ${escapeSocTooltipHtml(description)}${extra}`;
                tooltip.classList.add('visible');
            }
        });

        element.addEventListener('mouseleave', () => {
            if (tooltip) tooltip.classList.remove('visible');
        });

        // Click event for navigation or log filtering
        element.addEventListener('click', () => {
            const tab = node.targetTab;
            const cacheView = node.cacheView;
            const logModule = node.logModule;
            const focusId = node.focusId;

            if (tab) {
                // Switch sidebar tab
                const sidebarItem = document.querySelector(`.sidebar-item[data-target="${tab}"]`);
                if (sidebarItem) sidebarItem.click();

                // If cache, also switch to corresponding L1I/L1D/L2 tab
                if (cacheView) {
                    setCacheView(cacheView);
                }

                // If peripheral, focus input element
                if (focusId) {
                    setTimeout(() => {
                        const targetInput = document.getElementById(focusId);
                        if (targetInput) targetInput.focus();
                    }, 50);
                }
            } else if (logModule) {
                // Set Systems Log module filter
                const filterBtn = document.querySelector(`.log-filter-chip[data-log-module="${logModule}"]`);
                if (filterBtn) {
                    // Open the log terminal drawer if it is closed
                    const logTerminal = document.getElementById('systemLogTerminal');
                    if (logTerminal && !logTerminal.classList.contains('expanded')) {
                        const toggleBtn = document.getElementById('logToggleBtn');
                        if (toggleBtn) toggleBtn.click();
                    }
                    filterBtn.click();
                }
            }
        });

        element.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            element.click();
        });
    });
}

function renderMMUView() {
    if (!mmuOverviewStats || !mmuConfigTableBody || !mmuPageTableBody || !mmuTlbTableBody || !mmuHistoryTableBody) return;

    const mmu = simulator.mmu;
    const formatHex = (value, pad = 8) => {
        if (value === null || value === undefined) return '-';
        return '0x' + (value >>> 0).toString(16).padStart(pad, '0');
    };
    const formatId = (value) => value === null || value === undefined ? '-' : '0x' + (value >>> 0).toString(16);
    const formatBool = (value) => value
        ? '<span class="mmu-status mmu-status-on">Yes</span>'
        : '<span class="mmu-status mmu-status-off">No</span>';
    const endpointName = (port, fallback) => port?.lower?.name ?? port?.name ?? port?.constructor?.name ?? fallback;
    const permissionText = (entry) => `${entry.read ? 'R' : '-'}${entry.write ? 'W' : '-'}${entry.execute ? 'X' : '-'}`;
    const insertEmptyRow = (body, colspan, text) => {
        body.innerHTML = '';
        const row = body.insertRow();
        const cell = row.insertCell();
        cell.colSpan = colspan;
        cell.textContent = text;
    };
    const markMmuChanged = (element, key, value) => {
        if (!element || !key) return;
        const nextValue = String(value);
        const previousValue = mmuRenderedValues.get(key);
        if (previousValue !== undefined && previousValue !== nextValue) {
            element.classList.remove('mmu-value-changed');
            void element.offsetWidth;
            element.classList.add('mmu-value-changed');
        }
        mmuRenderedValues.set(key, nextValue);
    };
    const insertTrackedCell = (row, key, value, { html = false } = {}) => {
        const cell = row.insertCell();
        if (html) {
            cell.innerHTML = value;
        } else {
            cell.textContent = value;
        }
        markMmuChanged(cell, key, value);
        return cell;
    };

    if (!mmu) {
        mmuRenderedValues.clear();
        insertEmptyRow(mmuConfigTableBody, 2, 'MMU not initialized.');
        insertEmptyRow(mmuPageTableBody, 8, 'MMU not initialized.');
        insertEmptyRow(mmuTlbTableBody, 7, 'MMU not initialized.');
        insertEmptyRow(mmuHistoryTableBody, 11, 'MMU not initialized.');
        mmuOverviewStats.textContent = 'MMU not initialized';
        return;
    }

    const pageSize = mmu.pageSize ?? 4096;
    const offsetBits = Math.log2(pageSize);
    const vpnBits = 32 - offsetBits;
    const pageTableEntries = Array.from(mmu.pageTable?.entries?.() ?? []).sort(([a], [b]) => a - b);
    const historyEntries = Array.isArray(mmu.translationHistory) ? mmu.translationHistory : [];
    const s = mmu.stats ?? {};
    const translations = s.translations ?? 0;
    const tlbHits = s.tlbHits ?? 0;
    const tlbMisses = s.tlbMisses ?? 0;
    const hitRate = translations > 0 ? `${((tlbHits / translations) * 100).toFixed(1)}%` : '0.0%';

    const overviewMetrics = [
        ['Translations', translations],
        ['TLB Hits', tlbHits],
        ['TLB Misses', tlbMisses],
        ['TLB Hit Rate', hitRate]
    ];

    mmuOverviewStats.innerHTML = `
        <div class="mmu-metric-row">
            ${overviewMetrics.map(([label, value]) => `
                <div class="mmu-metric"><span>${label}</span><strong>${value}</strong></div>
            `).join('')}
        </div>
    `;
    mmuOverviewStats.querySelectorAll('.mmu-metric strong').forEach((metric, index) => {
        const [label, value] = overviewMetrics[index];
        markMmuChanged(metric, `overview:${label}`, value);
    });

    const configRows = [
        ['Page size', `${pageSize} bytes (${formatHex(pageSize, 4)})`],
        ['TLB', `${mmu.tlbSize} entries, ${mmu.tlbSets} sets x ${mmu.tlbWays} ways, LRU`],
        ['Permission checks', 'Read / Write / Execute'],
        ['Identity fallback', 'Enabled (bare-metal)']
    ];

    mmuConfigTableBody.innerHTML = '';
    configRows.forEach(([name, value]) => {
        const row = mmuConfigTableBody.insertRow();
        row.insertCell().textContent = name;
        insertTrackedCell(row, `config:${name}`, value);
    });

    if (mmuAddressMapTableBody) {
        const addressMap = simulator.addressMap ?? [];
        if (addressMap.length === 0) {
            insertEmptyRow(mmuAddressMapTableBody, 4, 'Address map metadata is not available.');
        } else {
            mmuAddressMapTableBody.innerHTML = '';
            addressMap.forEach(region => {
                const row = mmuAddressMapTableBody.insertRow();
                const range = region.description
                    ? region.description
                    : `${formatHex(region.base)} - ${formatHex((region.base + region.size - 1) >>> 0)}`;
                const regionKey = `address:${region.name}`;
                insertTrackedCell(row, `${regionKey}:name`, region.name);
                insertTrackedCell(row, `${regionKey}:range`, range);
                insertTrackedCell(row, `${regionKey}:cacheable`, formatBool(region.cacheable), { html: true });
                insertTrackedCell(row, `${regionKey}:fabric`, region.fabric ?? '-');
            });
        }
    }

    if (pageTableEntries.length === 0) {
        insertEmptyRow(mmuPageTableBody, 8, 'No mapped pages. Current program will use identity fallback unless pages are mapped in code/tests.');
    } else {
        mmuPageTableBody.innerHTML = '';
        pageTableEntries.forEach(([vpn, entry]) => {
            const row = mmuPageTableBody.insertRow();
            const ppn = Math.floor((entry.physicalBase >>> 0) / pageSize);
            const entryKey = `page-table:${vpn}`;
            insertTrackedCell(row, `${entryKey}:vpn`, formatId(vpn));
            insertTrackedCell(row, `${entryKey}:va`, formatHex(entry.virtualBase));
            insertTrackedCell(row, `${entryKey}:ppn`, formatId(ppn));
            insertTrackedCell(row, `${entryKey}:pa`, formatHex(entry.physicalBase));
            insertTrackedCell(row, `${entryKey}:perms`, permissionText(entry));
            insertTrackedCell(row, `${entryKey}:cacheable`, formatBool(entry.cacheable), { html: true });
            insertTrackedCell(row, `${entryKey}:in-tlb`, formatBool(mmu.tlb?.has?.(vpn)), { html: true });
            insertTrackedCell(row, `${entryKey}:last-ref`, entry.lastReference ?? 0);
        });
    }

    const validTlbBlocks = (mmu.tlbBlocks ?? []).filter(block => block.valid);
    if (validTlbBlocks.length === 0) {
        insertEmptyRow(mmuTlbTableBody, 6, 'TLB is empty. A mapped page-table hit will refill it.');
    } else {
        mmuTlbTableBody.innerHTML = '';
        validTlbBlocks.forEach((block) => {
            const row = mmuTlbTableBody.insertRow();
            const isLastTranslated = mmu.lastTranslation &&
                                     mmu.lastTranslation.mode === 'mapped' &&
                                     mmu.lastTranslation.vpn === block.vpn;
            if (isLastTranslated) {
                row.classList.add('tlb-highlight');
            }

            const blockKey = `tlb:${block.set}:${block.way}`;
            const ppn = Math.floor((block.physicalBase >>> 0) / pageSize);
            insertTrackedCell(row, `${blockKey}:vpn`, formatId(block.vpn));
            insertTrackedCell(row, `${blockKey}:va`, formatHex(block.virtualBase));
            insertTrackedCell(row, `${blockKey}:ppn`, formatId(ppn));
            insertTrackedCell(row, `${blockKey}:pa`, formatHex(block.physicalBase));
            insertTrackedCell(row, `${blockKey}:perms`, permissionText(block));
            insertTrackedCell(row, `${blockKey}:cacheable`, formatBool(block.cacheable), { html: true });
        });
    }

    if (historyEntries.length === 0) {
        insertEmptyRow(mmuHistoryTableBody, 11, 'No translations yet. Assemble and step/run a program to populate this table.');
    } else {
        mmuHistoryTableBody.innerHTML = '';
        historyEntries.forEach(record => {
            const row = mmuHistoryTableBody.insertRow();
            const historyKey = `history:${record.lastReference ?? historyEntries.indexOf(record)}`;
            insertTrackedCell(row, `${historyKey}:ref`, record.lastReference ?? '-');
            insertTrackedCell(row, `${historyKey}:source`, record.source ?? '-');
            insertTrackedCell(row, `${historyKey}:access`, record.accessType ?? '-');
            insertTrackedCell(row, `${historyKey}:mode`, record.mode ?? '-');
            insertTrackedCell(row, `${historyKey}:va`, formatHex(record.virtualAddress));
            insertTrackedCell(row, `${historyKey}:vpn`, formatId(record.vpn));
            insertTrackedCell(row, `${historyKey}:offset`, formatHex(record.offset, 3));
            insertTrackedCell(row, `${historyKey}:pa`, formatHex(record.physicalAddress));
            insertTrackedCell(row, `${historyKey}:ppn`, formatId(record.ppn));
            insertTrackedCell(row, `${historyKey}:cacheable`, formatBool(record.cacheable), { html: true });
            const resultText = record.result === 'ok' ? 'OK' : (record.result ?? 'Fault');
            insertTrackedCell(
                row,
                `${historyKey}:result`,
                `<span class="mmu-status ${record.result === 'ok' ? 'mmu-status-on' : 'mmu-status-fault'}">${resultText}</span>`,
                { html: true }
            );
        });
    }
}

function renderCacheView() {
    if (!l1iCacheTableBody || !l1dCacheTableBody || !l2CacheTableBody) return;

    const panels = [
        { cache: simulator.iCache, tableBody: l1iCacheTableBody, statsNode: l1iCacheStats, label: 'L1I' },
        { cache: simulator.dCache, tableBody: l1dCacheTableBody, statsNode: l1dCacheStats, label: 'L1D' },
        { cache: simulator.l2Cache, tableBody: l2CacheTableBody, statsNode: l2CacheStats, label: 'L2' }
    ];

    const formatHex = (v, pad = 0) => '0x' + (v >>> 0).toString(16).padStart(pad, '0');

    function renderCachePanel({ cache, tableBody, statsNode, label }) {
        tableBody.innerHTML = '';

        if (!simulator.useCache) {
            tableBody.innerHTML = '<tr><td colspan="4">Cache disabled.</td></tr>';
            if (statsNode) statsNode.textContent = `${label} disabled`;
            return;
        }

        if (!cache) {
            tableBody.innerHTML = '<tr><td colspan="4">Cache not initialized.</td></tr>';
            if (statsNode) statsNode.textContent = `${label} not initialized`;
            return;
        }

        const assoc = cache.policy?.numWays ?? cache.numWays ?? 1;
        let validCount = 0;
        cache.blocks.forEach(block => {
            if (!block.valid) return;
            validCount++;
            const row = tableBody.insertRow();
            row.insertCell().textContent = Math.floor(block.id / assoc);
            row.insertCell().textContent = block.id % assoc;
            row.insertCell().textContent = formatHex(block.tag);
            row.insertCell().textContent = block.modified ? '1' : '0';
        });
        if (validCount === 0) {
            tableBody.innerHTML = '<tr><td colspan="4">No cached blocks yet.</td></tr>';
        }

        if (statsNode) {
            const s = cache.statistics;
            statsNode.innerHTML = `
                <div>Reads: ${s.numRead} | Writes: ${s.numWrite}</div>
                <div>Hits: ${s.numHit} | Misses: ${s.numMiss}</div>
                <div>Total Cycles: ${s.totalCycles}</div>
            `;
        }
    }

    panels.forEach(renderCachePanel);
}

function setCacheView(view) {
    currentCacheView = view;

    const tabs = [
        { node: cacheTabL1i, active: view === 'l1i' },
        { node: cacheTabL1d, active: view === 'l1d' },
        { node: cacheTabL2, active: view === 'l2' }
    ];
    tabs.forEach(({ node, active }) => node?.classList.toggle('active', active));

    cachePanelL1i?.classList.toggle('active-cache-panel', view === 'l1i');
    cachePanelL1d?.classList.toggle('active-cache-panel', view === 'l1d');
    cachePanelL2?.classList.toggle('active-cache-panel', view === 'l2');
}

if (cacheTabL1i) cacheTabL1i.addEventListener('click', () => setCacheView('l1i'));
if (cacheTabL1d) cacheTabL1d.addEventListener('click', () => setCacheView('l1d'));
if (cacheTabL2) cacheTabL2.addEventListener('click', () => setCacheView('l2'));
setCacheView(currentCacheView);

function setMMUView(view) {
    currentMmuView = view;

    const tabs = [
        { node: mmuTabOverview, active: view === 'overview' },
        { node: mmuTabPageTable, active: view === 'page-table' },
        { node: mmuTabTlb, active: view === 'tlb' },
        { node: mmuTabHistory, active: view === 'history' }
    ];
    tabs.forEach(({ node, active }) => node?.classList.toggle('active', active));

    mmuPanelOverview?.classList.toggle('active-mmu-panel', view === 'overview');
    mmuPanelPageTable?.classList.toggle('active-mmu-panel', view === 'page-table');
    mmuPanelTlb?.classList.toggle('active-mmu-panel', view === 'tlb');
    mmuPanelHistory?.classList.toggle('active-mmu-panel', view === 'history');
}

if (mmuTabOverview) mmuTabOverview.addEventListener('click', () => setMMUView('overview'));
if (mmuTabPageTable) mmuTabPageTable.addEventListener('click', () => setMMUView('page-table'));
if (mmuTabTlb) mmuTabTlb.addEventListener('click', () => setMMUView('tlb'));
if (mmuTabHistory) mmuTabHistory.addEventListener('click', () => setMMUView('history'));
setMMUView(currentMmuView);

window.updateUIGlobally = updateUIGlobally;

// --- SETUP UART CALLBACKS ---
function setupUARTCallbacks() {
    const uartOutput = document.getElementById('uartOutput');
    if (typeof simulator !== 'undefined' && simulator.uart && uartOutput) {
        const uart = simulator.uart;

        // Callback khi UART transmit (CPU gửi dữ liệu)
        uart.onTransmit = function (charCode) {
            const char = String.fromCharCode(charCode);
            uartOutput.textContent += char;
            // Auto scroll to bottom
            uartOutput.scrollTop = uartOutput.scrollHeight;
            console.log(`[UART TX] '${char}' (0x${charCode.toString(16)})`);
        };

        console.log('[UART] Callbacks setup successfully');
    }
}

// --- EVENT HANDLERS (Nút điều khiển) ---

function setupCANCallbacks() {
    if (typeof simulator === 'undefined' || !simulator.can) return;

    const can = simulator.can;
    if (canBoundController !== can) {
        canBoundController = can;
        canTxLogFrames = [];
        setCANMessage('', '');
    }

    can.onTransmit = (frame) => {
        canTxLogFrames.push(frame);
        if (canTxLogFrames.length > CAN_TX_LOG_LIMIT) {
            canTxLogFrames = canTxLogFrames.slice(-CAN_TX_LOG_LIMIT);
        }
        renderCANView();
    };

    can.onReceive = () => {
        renderCANView();
    };

    renderCANView();
}

function setupCANControls() {
    const injectButton = document.getElementById('canInjectButton');
    const clearButton = document.getElementById('canClearButton');
    const payloadInput = document.getElementById('canInjectPayload');

    if (injectButton && injectButton.dataset.canBound !== 'true') {
        injectButton.dataset.canBound = 'true';
        injectButton.addEventListener('click', injectCANFrameFromUI);
    }

    if (clearButton && clearButton.dataset.canBound !== 'true') {
        clearButton.dataset.canBound = 'true';
        clearButton.addEventListener('click', clearCANLogAndStatus);
    }

    if (payloadInput && payloadInput.dataset.canBound !== 'true') {
        payloadInput.dataset.canBound = 'true';
        payloadInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                injectCANFrameFromUI();
            }
        });
    }
}

function scrollBinaryOutputToBottom() {
    if (binaryOutput) binaryOutput.scrollTop = binaryOutput.scrollHeight;
}

function appendProgramOutput(text) {
    if (!binaryOutput) return;
    if (!runState.programOutputStarted) {
        if (binaryOutput.textContent && !binaryOutput.textContent.endsWith('\n')) {
            binaryOutput.textContent += '\n';
        }
        runState.programOutputStarted = true;
    }
    binaryOutput.textContent += text;
    scrollBinaryOutputToBottom();
}

function appendProgramStatus(message) {
    if (!binaryOutput) return;
    if (binaryOutput.textContent && !binaryOutput.textContent.endsWith('\n')) {
        binaryOutput.textContent += '\n';
    }
    binaryOutput.textContent += message;
    scrollBinaryOutputToBottom();
}

function setupSyscallCallbacks() {
    if (typeof simulator === 'undefined' || !simulator.cpu) return;
    simulator.cpu.onSyscallOutput = appendProgramOutput;
    simulator.cpu.onSyscallExit = (code) => appendProgramStatus(`[Program exited with code ${code}]`);
    simulator.cpu.onSyscallError = (message) => appendProgramStatus(`[Syscall error] ${message}`);
}

function handleAssemble() {
    if (!assembler || !simulator || !binaryOutput || !instructionInput) return;
    if (runState.isRunning) finishRun();
    binaryOutput.textContent = "Assembling...";
    runState.programOutputStarted = false;

    if (instructionViewBody) instructionViewBody.innerHTML = '';
    simulator.init();
    setupSyscallCallbacks();
    setupUARTCallbacks(); // Setup lại UART callbacks sau reset
    setupCANCallbacks();

    setTimeout(() => {
        try {
            const assemblyCode = instructionInput.getValue();
            const programData = assembler.assemble(assemblyCode);

            const binaryHexStrings = programData.instructions.map(instr => `${instr.hex}  (${instr.binary})`);
            binaryOutput.textContent = binaryHexStrings.join('\n');
            if (binaryHexStrings.length === 0) {
                binaryOutput.textContent = "(No executable instructions assembled)";
            }

            simulator.loadProgram(programData);
            setupSyscallCallbacks();
            setupUARTCallbacks(); // Setup lại callbacks sau load program
            setupCANCallbacks();

            let dataStartAddrFound = false;
            if (programData.memory && Object.keys(programData.memory).length > 0) {
                const dataAddresses = Object.keys(programData.memory)
                    .map(addr => parseInt(addr))
                    .filter(addr => addr >= (assembler.dataBaseAddress || 0x10010000));

                if (dataAddresses.length > 0) {
                    dataSegmentStartAddress = Math.min(...dataAddresses);
                    dataStartAddrFound = true;
                }
            }
            if (!dataStartAddrFound) {
                dataSegmentStartAddress = assembler.dataBaseAddress || 0x10010000;
            }
            dataSegmentStartAddress = Math.max(0, Math.floor(dataSegmentStartAddress / bytesPerRow) * bytesPerRow);
            setDataAddressValue(`0x${dataSegmentStartAddress.toString(16)}`);

            updateUIGlobally();

        } catch (error) {
            console.error("Assembly Error:", error);
            binaryOutput.textContent = `Error:\n${error.message}`;
            assembler._reset();
            updateUIGlobally();
        }
    }, 10);
}

function collectBreakpointAddresses() {
    const breakpointAddresses = new Map();
    if (!assembler?.instructionLines || activeBreakpoints.size === 0) {
        return breakpointAddresses;
    }

    assembler.instructionLines.forEach((lineInfo) => {
        const isExecutableLine = lineInfo.type === 'instruction' || lineInfo.type === 'pseudo-instruction';
        if (!isExecutableLine || !activeBreakpoints.has(lineInfo.lineNumber)) return;

        const size = Math.max(4, lineInfo.size || 4);
        for (let offset = 0; offset < size; offset += 4) {
            breakpointAddresses.set((lineInfo.address + offset) >>> 0, lineInfo.lineNumber);
        }
    });

    return breakpointAddresses;
}

function cancelRunFrame() {
    if (runState.frameId !== null) {
        cancelAnimationFrame(runState.frameId);
        runState.frameId = null;
    }
}

function updateRunControlUI() {
    if (runButton) runButton.disabled = runState.isRunning && !runState.isPaused;
    if (pauseButton) {
        pauseButton.disabled = !runState.isRunning;
        const label = pauseButton.querySelector('.mdc-button__label');
        const icon = pauseButton.querySelector('.material-icons');
        if (label) label.textContent = runState.isPaused ? 'Resume' : 'Pause';
        if (icon) icon.textContent = runState.isPaused ? 'play_arrow' : 'pause';
    }
    if (stopButton) stopButton.disabled = !runState.isRunning;
    if (stepButton) stepButton.disabled = runState.isRunning && !runState.isPaused;
}

function finishRun({ message = '', drainDma = false, resetClock = true } = {}) {
    cancelRunFrame();
    runState.isRunning = false;
    runState.isPaused = false;

    if (message && binaryOutput) {
        binaryOutput.textContent += message;
    }

    if (drainDma) {
        while (simulator?.dma && simulator.dma.isBusy) simulator.tick();
    }

    if (resetClock && clockRateDisplay) clockRateDisplay.textContent = "0 Hz";
    updateRunControlUI();
    updateUIGlobally();
}

function scheduleRunLoop() {
    if (!runState.isRunning || runState.isPaused || runState.frameId !== null) return;
    runState.frameId = requestAnimationFrame(runLoop);
}

function runLoop() {
    runState.frameId = null;

    if (!runState.isRunning || runState.isPaused) return;

    if (!simulator.cpu.isRunning || runState.cycle > runState.maxCycles) {
        const message = runState.cycle > runState.maxCycles ? `\n\nHalted: Exceeded max cycles.` : '';
        finishRun({ message, drainDma: true, resetClock: false });
        return;
    }

    let cyclesPerFrame = 1;
    if (speedSlider) {
        cyclesPerFrame = parseInt(speedSlider.value, 10);
        if (cyclesPerFrame === 100) cyclesPerFrame = 1000;
    }

    let executedThisFrame = 0;
    for (let i = 0; i < cyclesPerFrame; i++) {
        const currentPc = simulator.cpu.pc >>> 0;
        if (runState.breakpointAddresses.has(currentPc)) {
            const breakpointLine = runState.breakpointAddresses.get(currentPc);
            finishRun({
                message: `\nBreakpoint hit at line ${breakpointLine}, PC = 0x${currentPc.toString(16)}`,
                resetClock: false
            });
            return;
        }

        if (!simulator.cpu.isRunning) {
            finishRun({ drainDma: true, resetClock: false });
            return;
        }

        try {
            simulator.tick();
            runState.cycle++;
            executedThisFrame++;

            if (runState.cycle > runState.maxCycles) {
                finishRun({ message: `\n\nHalted: Exceeded max cycles.`, resetClock: false });
                return;
            }
        } catch (e) {
            console.error("Run Error:", e);
            finishRun({ message: `\n\nRun Error: ${e.message}` });
            return;
        }
    }

    runState.cyclesInLastSecond += executedThisFrame;
    const now = performance.now();
    const elapsed = now - runState.lastTime;

    if (elapsed >= 500) {
        const hz = Math.round((runState.cyclesInLastSecond / elapsed) * 1000);
        if (clockRateDisplay) clockRateDisplay.textContent = hz.toLocaleString() + " Hz";
        runState.cyclesInLastSecond = 0;
        runState.lastTime = now;
    }

    updateUIGlobally();
    scheduleRunLoop();
}

function resumeRun() {
    if (!runState.isRunning || !runState.isPaused) return;
    runState.isPaused = false;
    runState.lastTime = performance.now();
    runState.cyclesInLastSecond = 0;
    if (binaryOutput) binaryOutput.textContent += "\n--- Resumed ---";
    updateRunControlUI();
    scheduleRunLoop();
}

// --- [CẬP NHẬT] HÀM RUN MỚI HỖ TRỢ TỐC ĐỘ ---
function handleRun() {
    if (!simulator) return;

    if (runState.isRunning) {
        if (runState.isPaused) {
            resumeRun();
        } else if (binaryOutput) {
            binaryOutput.textContent += "\n(Run is already active.)";
        }
        return;
    }

    runState.programOutputStarted = false;
    binaryOutput.textContent += "\n\n--- Running ---\n";

    runState.breakpointAddresses = collectBreakpointAddresses();
    if (runState.breakpointAddresses.size > 0) {
        const breakpointLines = [...new Set(runState.breakpointAddresses.values())].sort((a, b) => a - b);
        binaryOutput.textContent += `\n(Running with ${runState.breakpointAddresses.size} breakpoint address(es) from line(s): ${breakpointLines.join(', ')})`;
    } else if (activeBreakpoints.size > 0) {
        binaryOutput.textContent += `\n(No executable breakpoint addresses found. Running normally.)`;
    }

    runState.isRunning = true;
    runState.isPaused = false;
    runState.cycle = 0;
    runState.lastTime = performance.now();
    runState.cyclesInLastSecond = 0;
    updateRunControlUI();
    scheduleRunLoop();
}

function handlePause() {
    if (!runState.isRunning) return;

    if (runState.isPaused) {
        resumeRun();
        return;
    }

    runState.isPaused = true;
    cancelRunFrame();
    if (clockRateDisplay) clockRateDisplay.textContent = "0 Hz";
    if (binaryOutput) binaryOutput.textContent += "\n--- Paused ---";
    updateRunControlUI();
    updateUIGlobally();
}

function handleStop() {
    if (!runState.isRunning) return;
    finishRun({ message: "\n--- Stopped ---" });
}

function handleStep() {
    if (!simulator) return;
    if (runState.isRunning && !runState.isPaused) {
        if (binaryOutput) binaryOutput.textContent += "\n(Pause or stop the active run before stepping.)";
        return;
    }

    try {
        simulator.stepInstruction();
        updateUIGlobally();
    } catch (e) {
        console.error("Step Error:", e);
        binaryOutput.textContent += `\n\nStep Error: ${e.message}`;
        updateUIGlobally();
    }
}

function handleReset() {
    if (!simulator || !instructionInput) return;

    if (runState.isRunning) finishRun();
    simulator.init();
    setupUARTCallbacks();
    setupCANCallbacks();
    setupSyscallCallbacks();

    if (assembler && typeof assembler._reset === 'function') {
        assembler._reset();
    }

    // instructionInput.setValue(""); // [FIX] Không xóa code khi reset
    try { instructionInput.clearGutter("breakpoints"); } catch { }
    binaryOutput.textContent = "";
    runState.programOutputStarted = false;
    if (clockRateDisplay) clockRateDisplay.textContent = "0 Hz"; // [FIX] Reset IPS display

    // [FIX] Reset Keyboard UI
    const kbInput = document.getElementById('keyboardInput');
    const kbStatus = document.getElementById('keyboardStatus');
    if (kbInput) kbInput.value = "";
    if (kbStatus) {
        kbStatus.textContent = "Empty";
        kbStatus.style.color = "#666";
    }

    activeBreakpoints.clear();

    dataSegmentStartAddress = assembler.dataBaseAddress || 0x10010000;
    setDataAddressValue(`0x${dataSegmentStartAddress.toString(16)}`);

    updateUIGlobally();
    setRegisterView('integer');
    console.log("System reset.");
}

// --- KHỞI TẠO KHI DOM LOADED ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Initializing App...");

    initializeRegisterTable();
    initializeFPRegisterTable();

    instructionInput = CodeMirror.fromTextArea(document.getElementById('instructionInput'), {
        lineNumbers: true,
        mode: "riscv",
        theme: "default",
        gutters: ["CodeMirror-linenumbers", "breakpoints"]
    });
    configureRiscvEditorHints(instructionInput, { assembler });

    instructionInput.on("gutterClick", function (cm, n) {
        const lineNumber = n + 1;
        const info = cm.lineInfo(n);
        if (info.gutterMarkers) {
            cm.setGutterMarker(n, "breakpoints", null);
            activeBreakpoints.delete(lineNumber);
        } else {
            cm.setGutterMarker(n, "breakpoints", makeBreakpointMarker());
            activeBreakpoints.add(lineNumber);
        }
        updateBreakpointUI();
    });

    if (tabInteger && tabFp) {
        tabInteger.addEventListener('click', () => setRegisterView('integer'));
        tabFp.addEventListener('click', () => setRegisterView('fp'));
    }

    toggleDataSegmentModeButton?.addEventListener('click', () => {
        dataSegmentDisplayMode = (dataSegmentDisplayMode === 'hex') ? 'ascii' : 'hex';
        renderDataSegmentTable();
    });

    if (goToDataSegmentAddressButton && dataSegmentAddressInput) {
        const goToAddress = () => {
            const addrStr = dataSegmentAddressInput.value.trim();
            if (!addrStr) return;
            try {
                const newAddr = addrStr.toLowerCase().startsWith('0x') ? parseInt(addrStr, 16) : parseInt(addrStr, 10);
                if (!isNaN(newAddr) && newAddr >= 0) {
                    dataSegmentStartAddress = Math.max(0, Math.floor(newAddr / bytesPerRow) * bytesPerRow);
                    renderDataSegmentTable();
                    setDataAddressValue(`0x${dataSegmentStartAddress.toString(16)}`);
                } else {
                    alert("Invalid address");
                }
            } catch (e) { alert("Error parsing address"); }
        };
        goToDataSegmentAddressButton.addEventListener('click', goToAddress);
        dataSegmentAddressInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') goToAddress();
        });
    }

    assembleButton?.addEventListener('click', handleAssemble);
    runButton?.addEventListener('click', handleRun);
    pauseButton?.addEventListener('click', handlePause);
    stopButton?.addEventListener('click', handleStop);
    stepButton?.addEventListener('click', handleStep);
    resetButton?.addEventListener('click', handleReset);
    setupCANControls();
    updateRunControlUI();

    // [MỚI] Sự kiện thanh trượt tốc độ
    if (speedSlider && speedValueLabel) {
        speedSlider.addEventListener('input', () => {
            let val = speedSlider.value;
            if (val == 100) speedValueLabel.textContent = "Max";
            else speedValueLabel.textContent = val + "x";
        });
    }

    if (typeof mdc !== 'undefined') {
        mdc.autoInit();
        document.querySelectorAll('.mdc-button').forEach(btn => new mdc.ripple.MDCRipple(btn));
    }

    if (typeof simulator !== 'undefined') {
        simulator.init();
        setupSyscallCallbacks();
        setDataAddressValue(`0x${dataSegmentStartAddress.toString(16)}`);
        setRegisterView('integer');
        updateUIGlobally();
        setupUARTCallbacks(); // Setup UART callbacks lần đầu
        setupCANCallbacks();
        setupSocInteractivity(); // Initialize SoC diagram tooltips and navigation
    }

    const sidebarItems = document.querySelectorAll('.sidebar-item');
    const viewSections = document.querySelectorAll('.view-section');

    const activateView = (targetId) => {
        sidebarItems.forEach(i => i.classList.remove('active'));
        viewSections.forEach(v => v.classList.remove('active'));

        const activeItem = document.querySelector(`.sidebar-item[data-target="${targetId}"]`);
        if (activeItem) activeItem.classList.add('active');

        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        if (targetId === 'view-editor' && instructionInput) {
            setTimeout(() => {
                instructionInput.refresh();
            }, 10);
        }
    };

    sidebarItems.forEach(item => {
        item.addEventListener('click', () => {
            activateView(item.getAttribute('data-target'));
        });
    });

    // Help view interactions: search, local navigation, and loading examples into CodeMirror.
    const helpContent = document.getElementById('helpContent');
    const helpSearchInput = document.getElementById('helpSearchInput');
    const helpSections = Array.from(document.querySelectorAll('[data-help-section]'));
    const helpNavItems = Array.from(document.querySelectorAll('.help-nav-item'));
    const helpEmptyState = document.getElementById('helpEmptyState');

    const setActiveHelpNav = (targetId) => {
        helpNavItems.forEach(navItem => {
            navItem.classList.toggle('active', navItem.dataset.helpTarget === targetId);
        });
    };

    helpNavItems.forEach(navItem => {
        navItem.addEventListener('click', () => {
            const target = document.getElementById(navItem.dataset.helpTarget);
            if (!target || !helpContent) return;
            setActiveHelpNav(navItem.dataset.helpTarget);
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    if (helpSearchInput) {
        const normalizeHelpText = (text) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        helpSearchInput.addEventListener('input', () => {
            const query = normalizeHelpText(helpSearchInput.value.trim());
            let firstVisibleId = null;
            let visibleCount = 0;

            helpSections.forEach(section => {
                const navItem = helpNavItems.find(item => item.dataset.helpTarget === section.id);
                const visible = !query || normalizeHelpText(section.textContent).includes(query);
                section.classList.toggle('hidden', !visible);
                if (navItem) navItem.hidden = !visible;
                if (visible) {
                    visibleCount++;
                    if (!firstVisibleId) firstVisibleId = section.id;
                }
            });

            if (helpEmptyState) helpEmptyState.hidden = visibleCount > 0;
            if (firstVisibleId) setActiveHelpNav(firstVisibleId);
            if (helpContent) helpContent.scrollTop = 0;
        });
    }

    if (helpContent && helpSections.length > 0) {
        helpContent.addEventListener('scroll', () => {
            const containerTop = helpContent.getBoundingClientRect().top;
            let currentId = null;

            helpSections.forEach(section => {
                if (section.classList.contains('hidden')) return;
                const sectionTop = section.getBoundingClientRect().top - containerTop;
                if (sectionTop <= 80) currentId = section.id;
            });

            if (currentId) setActiveHelpNav(currentId);
        });
    }

    document.querySelectorAll('.help-sample-button[data-sample-template]').forEach(button => {
        button.addEventListener('click', () => {
            const template = document.getElementById(button.dataset.sampleTemplate);
            if (!template || !instructionInput) return;
            const code = template.content.textContent.trim();

            if (runState.isRunning) finishRun();
            activateView('view-editor');
            instructionInput.setValue(code);
            instructionInput.clearGutter("breakpoints");
            activeBreakpoints.clear();
            if (binaryOutput) {
                binaryOutput.textContent = "Sample loaded from Help. Click Assemble to build it.";
            }
            setTimeout(() => instructionInput.refresh(), 10);
        });
    });

    // Hiển thị tọa độ chuột trên LED Matrix Canvas và bơm vào peripheral mouse (MMIO)
    const ledCanvas = document.getElementById('ledMatrixCanvas');
    const mouseCoordinatesDisplay = document.getElementById('mouseCoordinates');

    const sendMouseToPeripheral = (x, y, buttonMask, isClick = false) => {
        if (typeof simulator !== 'undefined' && simulator.mouse) {
            simulator.mouse.reportEvent(x, y, buttonMask, isClick);
        }
    };

    if (ledCanvas && mouseCoordinatesDisplay) {
        // Pointer move event
        ledCanvas.addEventListener('pointermove', (event) => {
            const rect = ledCanvas.getBoundingClientRect();
            const x = Math.floor(event.clientX - rect.left);
            const y = Math.floor(event.clientY - rect.top);
            mouseCoordinatesDisplay.textContent = `x=${x}, y=${y}`;
            sendMouseToPeripheral(x, y, event.buttons & 0x7, false);
        });

        // Pointer down event - hiển thị tọa độ và log ra console
        ledCanvas.addEventListener('pointerdown', (event) => {
            const rect = ledCanvas.getBoundingClientRect();
            const x = Math.floor(event.clientX - rect.left);
            const y = Math.floor(event.clientY - rect.top);

            // Hiển thị trong UI
            mouseCoordinatesDisplay.textContent = `x=${x}, y=${y} (Clicked!)`;
            mouseCoordinatesDisplay.style.color = '#d63031';

            // Log ra console
            console.log(`Mouse clicked at: x=${x}, y=${y}`);

            // Map event.button (0:left, 1:middle, 2:right) to mask bits (bit0/bit2/bit1)
            const buttonMask = event.button === 0 ? 0x1 : event.button === 1 ? 0x4 : event.button === 2 ? 0x2 : 0;
            sendMouseToPeripheral(x, y, buttonMask, true);

            // Reset màu sau 500ms
            setTimeout(() => {
                mouseCoordinatesDisplay.style.color = '#0984e3';
            }, 500);
        });

        ledCanvas.addEventListener('pointerup', (event) => {
            const rect = ledCanvas.getBoundingClientRect();
            const x = Math.floor(event.clientX - rect.left);
            const y = Math.floor(event.clientY - rect.top);
            sendMouseToPeripheral(x, y, 0, false);
        });

        // Pointer leave event - reset display
        ledCanvas.addEventListener('pointerleave', (event) => {
            if (event.pointerType !== 'mouse') return;
            mouseCoordinatesDisplay.textContent = 'x=0, y=0';
            mouseCoordinatesDisplay.style.color = '#0984e3';
            sendMouseToPeripheral(0, 0, 0, false);
        });
    }

    // [MỚI] UART Console handlers
    const uartOutput = document.getElementById('uartOutput');
    const uartInput = document.getElementById('uartInput');
    const uartSendButton = document.getElementById('uartSendButton');
    const uartClearButton = document.getElementById('uartClearButton');

    // Setup UART callbacks
    if (typeof simulator !== 'undefined' && simulator.uart) {
        const uart = simulator.uart;

        // Callback khi UART transmit (CPU gửi dữ liệu)
        uart.onTransmit = function (charCode) {
            if (uartOutput) {
                const char = String.fromCharCode(charCode);
                uartOutput.textContent += char;
                // Auto scroll to bottom
                uartOutput.scrollTop = uartOutput.scrollHeight;
            }
        };
    }

    // Send button handler
    if (uartSendButton && uartInput) {
        uartSendButton.addEventListener('click', () => {
            const text = uartInput.value;
            if (text && simulator.uart) {
                simulator.uart.addStringToRxBuffer(text + '\n');
                uartInput.value = '';
                console.log(`[UART] Sent to RX buffer: "${text}"`);
            }
        });
    }

    // Enter key to send
    if (uartInput) {
        uartInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' && simulator.uart) {
                const text = uartInput.value;
                simulator.uart.addStringToRxBuffer(text + '\n');
                uartInput.value = '';
                console.log(`[UART] Sent to RX buffer: "${text}"`);
            }
        });
    }

    // Clear button handler
    if (uartClearButton && uartOutput) {
        uartClearButton.addEventListener('click', () => {
            uartOutput.textContent = '';
            if (simulator.uart) {
                simulator.uart.clearTxBuffer();
            }
        });
    }

    // MMU Settings initialization and apply handler
    const mmuPageSizeSelect = document.getElementById('mmuPageSizeSelect');
    const mmuTlbSizeSelect = document.getElementById('mmuTlbSizeSelect');
    const mmuTlbWaysSelect = document.getElementById('mmuTlbWaysSelect');
    const applyMmuSettingsBtn = document.getElementById('applyMmuSettingsBtn');
    const setSelectValue = (select, storedValue, fallbackValue) => {
        if (!select) return;
        const optionValues = Array.from(select.options).map(option => option.value);
        select.value = optionValues.includes(storedValue) ? storedValue : fallbackValue;
    };

    setSelectValue(mmuPageSizeSelect, localStorage.getItem('mmu_page_size') ?? '4096', '4096');
    setSelectValue(mmuTlbSizeSelect, localStorage.getItem('mmu_tlb_size') ?? '8', '8');
    setSelectValue(mmuTlbWaysSelect, localStorage.getItem('mmu_tlb_ways') ?? '2', '2');

    if (applyMmuSettingsBtn && mmuPageSizeSelect && mmuTlbSizeSelect && mmuTlbWaysSelect) {
        applyMmuSettingsBtn.addEventListener('click', () => {
            const pageSize = parseInt(mmuPageSizeSelect.value, 10);
            const tlbSize = parseInt(mmuTlbSizeSelect.value, 10);
            const tlbWays = mmuTlbWaysSelect.value;

            // Validate settings before applying
            const tlbWaysVal = tlbWays === 'fully' ? tlbSize : parseInt(tlbWays, 10);
            if (tlbSize % tlbWaysVal !== 0) {
                alert(`Cấu hình TLB không hợp lệ: Kích thước TLB (${tlbSize}) phải chia hết cho số Way (${tlbWaysVal}).`);
                return;
            }
            if (tlbWaysVal > tlbSize) {
                alert(`Cấu hình TLB không hợp lệ: Số Way (${tlbWaysVal}) không được vượt quá kích thước TLB (${tlbSize}).`);
                return;
            }

            localStorage.setItem('mmu_page_size', pageSize.toString());
            localStorage.setItem('mmu_tlb_size', tlbSize.toString());
            localStorage.setItem('mmu_tlb_ways', tlbWays);

            console.log(`[MMU Settings] Applied configuration: Page Size = ${pageSize}B, TLB Size = ${tlbSize}, Associativity = ${tlbWays}`);

            // Re-assemble and reset simulator
            handleAssemble();
        });
    }
});
