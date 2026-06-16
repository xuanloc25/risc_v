(function initSystemLogStore(global) {
    const KNOWN_LOG_MODULES = [
        'cpu',
        'mmu',
        'cache',
        'tilelink',
        'dma',
        'memory',
        'io',
        'system',
        'other'
    ];

    function stripLevelPrefix(text) {
        return String(text).replace(/^\s*(?:\[(?:ERROR|WARN)\]\s*)?/i, '');
    }

    function addFirstTagModules(modules, firstTag) {
        if (!firstTag) return;

        if (firstTag.includes('soc') || firstTag.includes('arch') || firstTag.includes('ui') || firstTag.includes('syscall')) modules.add('system');
        if (firstTag.includes('io map') || firstTag.includes('uart') || firstTag.includes('keyboard') || firstTag.includes('mouse')) modules.add('io');
        if (firstTag.includes('cpu') || firstTag.startsWith('cycle ')) modules.add('cpu');
        if (firstTag.includes('mmu')) modules.add('mmu');
        if (firstTag.includes('cache') || /\bl[12][id]?\s+cache\b/i.test(firstTag)) modules.add('cache');
        if (firstTag.includes('tilelink')) modules.add('tilelink');
        if (firstTag.includes('dma')) modules.add('dma');
        if (firstTag.includes('memory')) modules.add('memory');
    }

    function addTextModules(modules, lowerText, normalized) {
        if (
            lowerText.includes('system reset') ||
            lowerText.includes('simulation halted') ||
            lowerText.includes('initializing app') ||
            lowerText.includes('assembly error') ||
            lowerText.includes('run error') ||
            lowerText.includes('step error') ||
            /\bsyscall\b/i.test(normalized)
        ) {
            modules.add('system');
        }

        if (lowerText.startsWith('[cycle ') || /\bcpu\b/i.test(normalized)) modules.add('cpu');
        if (/\bmmu\b/i.test(normalized)) modules.add('mmu');
        if (/\bcache\b/i.test(normalized) || /\bl[12][id]?\s+cache\b/i.test(normalized)) modules.add('cache');
        if (/\btilelink(?:-[a-z]+)?\b/i.test(normalized)) modules.add('tilelink');
        if (/\bdma\b/i.test(normalized)) modules.add('dma');
        if (/\bmain memory\b/i.test(normalized)) modules.add('memory');
        if (/\b(?:uart|keyboard|mouse)\b/i.test(normalized) || lowerText.includes('led matrix') || lowerText.includes('io map')) modules.add('io');
    }

    function inferLogModules(text) {
        const normalized = stripLevelPrefix(text);
        const bracketMatch = normalized.match(/^\[([^\]]+)\]/);
        const firstTag = (bracketMatch?.[1] || '').toLowerCase();
        const lowerText = normalized.toLowerCase();
        const modules = new Set();

        addFirstTagModules(modules, firstTag);
        addTextModules(modules, lowerText, normalized);

        if (modules.size === 0) modules.add('other');
        return Array.from(modules).filter((module) => KNOWN_LOG_MODULES.includes(module));
    }

    function getPrimaryLogModule(modules) {
        return modules.find((module) => module !== 'other') || 'other';
    }

    global.__systemLogClassifier = {
        inferModules: inferLogModules,
        knownModules: KNOWN_LOG_MODULES.slice()
    };

    if (global.__systemLogStore) return;

    const MAX_STORED_LINES = 200000;
    const subscribers = new Set();
    const history = [];
    let capturedCount = 0;
    let droppedCount = 0;
    let nextWriteIndex = 0;

    const originalConsole = {
        log: global.console.log.bind(global.console),
        warn: global.console.warn.bind(global.console),
        error: global.console.error.bind(global.console),
        info: global.console.info.bind(global.console),
        group: typeof global.console.group === 'function' ? global.console.group.bind(global.console) : null,
        groupCollapsed: typeof global.console.groupCollapsed === 'function' ? global.console.groupCollapsed.bind(global.console) : null,
        groupEnd: typeof global.console.groupEnd === 'function' ? global.console.groupEnd.bind(global.console) : null
    };
    let groupDepth = 0;

    function formatArg(arg) {
        if (arg instanceof Error) {
            return arg.stack || arg.message || String(arg);
        }
        if (typeof arg === 'string') return arg;
        if (typeof arg === 'object' && arg !== null) {
            try {
                return JSON.stringify(arg);
            } catch (error) {
                return String(arg);
            }
        }
        return String(arg);
    }

    function getStats() {
        return {
            captured: capturedCount,
            stored: history.length,
            dropped: droppedCount,
            maxStored: MAX_STORED_LINES
        };
    }

    function notifySubscribers(event) {
        subscribers.forEach((notify) => notify(event));
    }

    function getDropNotice() {
        if (droppedCount <= 0) return '';
        return `[SYSTEM LOG] Dropped ${droppedCount} oldest log line(s); showing ${history.length} stored line(s) out of ${capturedCount} captured.`;
    }

    function orderedHistory() {
        if (droppedCount <= 0 || history.length < MAX_STORED_LINES) {
            return history.slice();
        }
        return history.slice(nextWriteIndex).concat(history.slice(0, nextWriteIndex));
    }

    function appendRaw(level, text, options = {}) {
        const entry = {
            level,
            text: String(text)
        };

        capturedCount++;
        let trimmed = false;
        if (history.length < MAX_STORED_LINES) {
            history.push(entry);
        } else {
            history[nextWriteIndex] = entry;
            nextWriteIndex = (nextWriteIndex + 1) % MAX_STORED_LINES;
            droppedCount++;
            trimmed = true;
        }

        if (options.notify !== false) {
            const stats = getStats();
            if (trimmed) notifySubscribers({ type: 'trim', stats });
            notifySubscribers({ type: 'entry', entry, stats });
        }

        return entry;
    }

    function pushEntry(level, args) {
        let prefix = '';
        if (level === 'error') prefix = '[ERROR] ';
        if (level === 'warn') prefix = '[WARN] ';

        const indent = '  '.repeat(groupDepth);
        const text = indent + prefix + Array.from(args).map(formatArg).join(' ');
        appendRaw(level, text);
    }

    global.__systemLogStore = {
        snapshot() {
            return orderedHistory();
        },
        size() {
            return history.length;
        },
        subscribe(notify) {
            subscribers.add(notify);
            return () => subscribers.delete(notify);
        },
        clear() {
            history.length = 0;
            capturedCount = 0;
            droppedCount = 0;
            nextWriteIndex = 0;
            notifySubscribers({ type: 'clear', stats: getStats() });
        },
        exportText() {
            const lines = orderedHistory().map((entry) => entry.text);
            const notice = getDropNotice();
            if (notice) lines.unshift(notice);
            return lines.join('\n');
        },
        appendRaw(level, text, options = {}) {
            return appendRaw(level, text, options);
        },
        stats() {
            return getStats();
        },
        dropNotice() {
            return getDropNotice();
        },
        limits: {
            maxStoredLines: MAX_STORED_LINES,
            maxExportLines: MAX_STORED_LINES
        },
        originalConsole
    };

    ['log', 'warn', 'error', 'info'].forEach((level) => {
        global.console[level] = function (...args) {
            originalConsole[level](...args);
            pushEntry(level, args);
        };
    });

    const pushGroupHeader = (args, collapsed = false) => {
        const label = Array.from(args).map(formatArg).join(' ');
        const marker = collapsed ? '[+] ' : '[-] ';
        const text = '  '.repeat(groupDepth) + marker + label;
        appendRaw('info', text);
        groupDepth++;
    };

    global.console.group = function (...args) {
        if (originalConsole.group) originalConsole.group(...args);
        pushGroupHeader(args, false);
    };

    global.console.groupCollapsed = function (...args) {
        if (originalConsole.groupCollapsed) originalConsole.groupCollapsed(...args);
        else if (originalConsole.group) originalConsole.group(...args);
        pushGroupHeader(args, true);
    };

    global.console.groupEnd = function () {
        if (originalConsole.groupEnd) originalConsole.groupEnd();
        groupDepth = Math.max(0, groupDepth - 1);
    };
})(window);
