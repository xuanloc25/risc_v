import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bootstrapPath = resolve(__dirname, '../src/js/system_log_bootstrap.js');
const bootstrapCode = readFileSync(bootstrapPath, 'utf8');

function createWindow() {
    const nativeConsole = {
        log() {},
        warn() {},
        error() {},
        info() {},
        group() {},
        groupCollapsed() {},
        groupEnd() {}
    };
    const sandbox = { console: nativeConsole };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(bootstrapCode, sandbox, { filename: bootstrapPath });
    return sandbox;
}

function assertHasModules(classifier, line, expectedModules) {
    const modules = classifier.inferModules(line);
    for (const module of expectedModules) {
        assert.ok(
            modules.includes(module),
            `Expected "${line}" to match ${module}; got ${modules.join(', ')}`
        );
    }
}

const win = createWindow();
const classifier = win.__systemLogClassifier;

// Representative simulator logs often mention several components in one line.
// The classifier should keep every useful module tag so UI filters can show the
// same entry under memory, cache, and TileLink views.
assertHasModules(
    classifier,
    '[Main Memory] Main Memory -> TileLink-UH RESPONSE_BEAT to=L2 Cache addr=0x400000 data=536871059 1/4',
    ['memory', 'tilelink', 'cache']
);

assertHasModules(
    classifier,
    '[TileLink-UH] TileLink -> Main Memory REQUEST from=L2 Cache type=Get addr=0x400000',
    ['tilelink', 'memory', 'cache']
);

assertHasModules(
    classifier,
    '[MMU] REQUEST from=cpu type=Get addr=0x400000',
    ['mmu', 'cpu']
);

assertHasModules(
    classifier,
    '[Cycle 34] CPU active=true pc=0x400000 | DMA busy=false progress=0/0',
    ['cpu', 'dma']
);

assertHasModules(classifier, '[UART] Transmitting 0x41', ['io']);
assertHasModules(classifier, 'System reset.', ['system']);

win.console.log('[Main Memory] Main Memory -> TileLink-UH RESPONSE_BEAT to=L2 Cache addr=0x400000 data=536871059 1/4');
const [entry] = win.__systemLogStore.snapshot();

// The store captures raw entries first; UI filtering classifies lazily when it
// renders, searches, or exports.
assert.equal(entry.module, undefined);
assert.equal(entry.modules, undefined);
assert.deepEqual(
    Array.from(classifier.inferModules(entry.text)),
    ['memory', 'cache', 'tilelink']
);

let notified = 0;
const unsubscribe = win.__systemLogStore.subscribe(() => {
    notified++;
});
win.__systemLogStore.appendRaw('log', '[Cycle 99] CPU active=true pc=0x400000 | DMA busy=false progress=0/0', { notify: false });
unsubscribe();

assert.equal(notified, 0);
assert.equal(win.__systemLogStore.stats().captured, 2);
assert.equal(win.__systemLogStore.stats().stored, 2);

const cappedWin = createWindow();
const maxStoredLines = cappedWin.__systemLogStore.limits.maxStoredLines;
for (let i = 0; i <= maxStoredLines; i++) {
    cappedWin.__systemLogStore.appendRaw('log', `line ${i}`, { notify: false });
}

const cappedStats = cappedWin.__systemLogStore.stats();
const cappedSnapshot = cappedWin.__systemLogStore.snapshot();
assert.equal(cappedStats.captured, maxStoredLines + 1);
assert.equal(cappedStats.stored, maxStoredLines);
assert.equal(cappedStats.dropped, 1);
assert.equal(cappedSnapshot[0].text, 'line 1');
assert.equal(cappedSnapshot[cappedSnapshot.length - 1].text, `line ${maxStoredLines}`);
assert.match(cappedWin.__systemLogStore.dropNotice(), /Dropped 1 oldest log line/);

console.log('System log filter verification passed.');
