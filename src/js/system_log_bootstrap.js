(function initSystemLogStore(global) {
    if (global.__systemLogStore) return;

    const MAX_EXPORT_LINES = 10000;
    const EXPORT_TRIM_BATCH = 500;
    const subscribers = new Set();
    const history = [];

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

    function trimHistoryIfNeeded() {
        if (history.length <= MAX_EXPORT_LINES + EXPORT_TRIM_BATCH) return;
        history.splice(0, history.length - MAX_EXPORT_LINES);
    }

    function pushEntry(level, args) {
        let prefix = '';
        if (level === 'error') prefix = '[ERROR] ';
        if (level === 'warn') prefix = '[WARN] ';

        const indent = '  '.repeat(groupDepth);

        const entry = {
            level,
            text: indent + prefix + Array.from(args).map(formatArg).join(' ')
        };

        history.push(entry);
        trimHistoryIfNeeded();

        subscribers.forEach((notify) => notify({ type: 'entry', entry }));
    }

    global.__systemLogStore = {
        snapshot() {
            return history.slice();
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
            subscribers.forEach((notify) => notify({ type: 'clear' }));
        },
        exportText() {
            return history.map((entry) => entry.text).join('\n');
        },
        limits: {
            maxExportLines: MAX_EXPORT_LINES
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
        const entry = {
            level: 'info',
            text: '  '.repeat(groupDepth) + marker + label
        };

        history.push(entry);
        trimHistoryIfNeeded();
        subscribers.forEach((notify) => notify({ type: 'entry', entry }));
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
