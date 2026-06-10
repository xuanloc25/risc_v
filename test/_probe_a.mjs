import { simulator } from '../src/js/soc.js';
import { DMADescriptor } from '../src/js/dma.js';

// silence noisy logs
const realLog = console.log;
console.log = () => {};
console.warn = () => {};

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

const N = 4;
const SRC1 = 0x1000, DST1 = 0x2000;
const SRC2 = 0x3000, DST2 = 0x4000;
const src1 = [0x11111111, 0x22222222, 0x33333333, 0x44444444];
const src2 = [0xAAAAAAAA, 0xBBBBBBBB, 0xCCCCCCCC, 0xDDDDDDDD];
src1.forEach((w, i) => pokeWord(SRC1 + i * 4, w));
src2.forEach((w, i) => pokeWord(SRC2 + i * 4, w));

const cfg = DMADescriptor.createConfig(N, 0, 1, 1, 2, 2); // inc/inc word

simulator.dma.registers.writeCtrl(1); // enable
// descriptor 1
simulator.dma.registers.writeDescriptor(SRC1);
simulator.dma.registers.writeDescriptor(DST1);
simulator.dma.registers.writeDescriptor(cfg);
// descriptor 2 BEFORE any start
simulator.dma.registers.writeDescriptor(SRC2);
simulator.dma.registers.writeDescriptor(DST2);
simulator.dma.registers.writeDescriptor(cfg);

const fifoAfterQueue = simulator.dma.registers.fifoCount;

simulator.dma.registers.writeCtrl(3); // enable + start (ONE start)
const cyc1 = runUntilDone();

const r = simulator.dma.registers;
const dst1After = src1.map((_, i) => peekWord(DST1 + i * 4));
const dst2After = src2.map((_, i) => peekWord(DST2 + i * 4));
const fifoAfterFirstRun = r.fifoCount;
const progAfterFirst = simulator.dma.transferProgress;
const doneAfterFirst = r.done;
const busyAfterFirst = r.busy;

// Now issue a SECOND writeCtrl(3) to see if descriptor 2 then runs.
// NOTE: runUntilDone's guard is (cpu.isRunning || dma busy). After completion both
// are false, so we must prime at least one tick so canStartTransfer() can fire.
simulator.dma.registers.writeCtrl(3);
const enabledBeforePrime = simulator.dma.registers.enabled;
const startReqBeforePrime = simulator.dma.registers.startRequested;
const fifoEmptyBeforePrime = simulator.dma.registers.fifoEmpty;
const busyBeforePrime = simulator.dma.registers.busy;
const canStartBeforePrime = simulator.dma.registers.canStartTransfer();
simulator.tick(); // prime: this tick should startNextTransfer for descriptor 2
const busyAfterPrimeTick = simulator.dma.registers.busy;
// keep ticking explicitly regardless of guard, to drive descriptor 2 to completion
let cyc2 = 0;
while (cyc2 < 20000 && (simulator.dma.registers.busy || simulator.dma.registers.startRequested)) {
    simulator.tick();
    cyc2++;
}
const dst2AfterSecond = src2.map((_, i) => peekWord(DST2 + i * 4));
const fifoAfterSecond = r.fifoCount;
const doneAfterSecond = r.done;
const busyAfterSecond = r.busy;

console.log = realLog;
console.log(JSON.stringify({
    fifoAfterQueue,
    cyc1,
    fifoAfterFirstRun,
    progAfterFirst,
    doneAfterFirst,
    busyAfterFirst,
    dst1After: dst1After.map(v => v >>> 0),
    dst2After: dst2After.map(v => v >>> 0),
    dst1Match: dst1After.every((v, i) => (v >>> 0) === src1[i]),
    dst2MatchAfterFirst: dst2After.every((v, i) => (v >>> 0) === src2[i]),
    enabledBeforePrime,
    startReqBeforePrime,
    fifoEmptyBeforePrime,
    busyBeforePrime,
    canStartBeforePrime,
    busyAfterPrimeTick,
    cyc2,
    dst2AfterSecond: dst2AfterSecond.map(v => v >>> 0),
    dst2MatchAfterSecond: dst2AfterSecond.every((v, i) => (v >>> 0) === src2[i]),
    fifoAfterSecond,
    doneAfterSecond,
    busyAfterSecond,
}, null, 2));
