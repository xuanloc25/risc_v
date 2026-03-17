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
        info: global.console.info.bind(global.console)
    };

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

        const entry = {
            level,
            text: prefix + Array.from(args).map(formatArg).join(' ')
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
})(window);
