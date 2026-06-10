import { simulator } from '../src/js/soc.js';
import { DMADescriptor } from '../src/js/dma.js';

const logLines = [];
const realLog = console.log;
console.log = (...args) => { logLines.push(args.map(String).join(' ')); };

function peekWord(addr) { return simulator.tilelink_UH.peekWord(addr); }
function pokeWord(addr, value) { simulator.tilelink_UH.pokeWord(addr, value); }

function runUntilDone(maxCycles = 20000) {
    let cycles = 0;
    while ((simulator.cpu.isRunning || simulator.dma.isBusy || simulator.dma.registers.busy) && cycles < maxCycles) {
        simulator.tick();
        cycles++;
    }
    return cycles;
}

simulator.init();
const ECALL = 0x00000073;
simulator.loadProgram({ startAddress: 0x400000, memory: {
    0x400000: ECALL & 0xFF, 0x400001: (ECALL >> 8) & 0xFF,
    0x400002: (ECALL >> 16) & 0xFF, 0x400003: (ECALL >> 24) & 0xFF
}});

const N = 16;
const SRC = 0x1000;
const DST = 0x2000;
for (let i = 0; i < N; i++) pokeWord(SRC + i * 4, (0x1000 + i * 0x111) >>> 0);

const cfg = DMADescriptor.createConfig(N, 0, 1, 1, 2, 2, 1);
simulator.dma.registers.writeCtrl(1);
simulator.dma.registers.writeDescriptor(SRC);
simulator.dma.registers.writeDescriptor(DST);
simulator.dma.registers.writeDescriptor(cfg);
simulator.dma.registers.writeCtrl(3);

runUntilDone();
console.log = realLog;

const allResponseBeat = logLines.filter(l => l.includes('RESPONSE_BEAT'));
const dmaResponseBeat = logLines.filter(l => l.includes('RESPONSE_BEAT') && l.includes('to=dma'));
const allWriteBeat = logLines.filter(l => l.includes('WRITE_BEAT'));
const dmaWriteBeat = logLines.filter(l => l.includes('WRITE_BEAT') && l.includes('to=dma'));
const issueReadMulti = logLines.filter(l => l.includes('ISSUE_READ') && l.includes('beats=4'));
const issueWriteMulti = logLines.filter(l => l.includes('ISSUE_WRITE') && l.includes('multi-beat'));
const allFabricLatency = logLines.filter(l => l.includes('fabric latency=2'));
const uhFabricLatency = logLines.filter(l => l.includes('[TileLink-UH][A]') && l.includes('fabric latency=2'));

console.log('=== PROBE RESULTS ===');
console.log('RESPONSE_BEAT all      =', allResponseBeat.length);
console.log('RESPONSE_BEAT to=dma   =', dmaResponseBeat.length);
console.log('WRITE_BEAT all         =', allWriteBeat.length);
console.log('WRITE_BEAT to=dma      =', dmaWriteBeat.length);
console.log('ISSUE_READ beats=4     =', issueReadMulti.length);
console.log('ISSUE_WRITE multi-beat =', issueWriteMulti.length);
console.log('fabric latency=2 all   =', allFabricLatency.length);
console.log('UH fabric latency=2    =', uhFabricLatency.length);
console.log('tilelink_UH.latency    =', simulator.tilelink_UH.latency);

console.log('--- sample non-dma RESPONSE_BEAT lines (first 5) ---');
for (const l of allResponseBeat.filter(x => !x.includes('to=dma')).slice(0, 5)) console.log('   ', l);
console.log('--- all ISSUE_READ lines ---');
for (const l of logLines.filter(l => l.includes('ISSUE_READ'))) console.log('   ', l);
console.log('--- all ISSUE_WRITE lines ---');
for (const l of logLines.filter(l => l.includes('ISSUE_WRITE'))) console.log('   ', l);
const dmaUhFabricLatency = logLines.filter(l => l.includes('issue from=dma') && l.includes('fabric latency=2'));
console.log('DMA UH issue w/ latency=', dmaUhFabricLatency.length);
console.log('--- DMA UH issue-with-latency lines ---');
for (const l of dmaUhFabricLatency) console.log('   ', l);
console.log('--- distinct [A] issue bus names with fabric latency ---');
const busNames = {};
for (const l of allFabricLatency) {
    const m = l.match(/^\[([^\]]+)\]\[A\]/);
    const key = m ? m[1] : l.slice(0, 30);
    busNames[key] = (busNames[key] || 0) + 1;
}
console.log('   ', JSON.stringify(busNames));
