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

assert.equal(entry.module, 'memory');
assert.deepEqual(Array.from(entry.modules), ['memory', 'cache', 'tilelink']);

console.log('System log filter verification passed.');
