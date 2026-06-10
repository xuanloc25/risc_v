import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assembler } from '../src/js/assembler.js';
import {
    CAN_DEFAULT_BASE_ADDRESS,
    CAN_INT_BITS,
    CAN_REGISTERS,
    CAN_STATUS_BITS
} from '../src/js/can.js';
import { simulator } from '../src/js/soc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = CAN_DEFAULT_BASE_ADDRESS;

function reg(offset) {
    return (BASE + offset) >>> 0;
}

function captureConsole(fn) {
    const originalLog = console.log;
    const originalInfo = console.info;
    const originalWarn = console.warn;
    const logs = [];
    const collect = (...args) => logs.push(args.map(String).join(' '));

    console.log = collect;
    console.info = collect;
    console.warn = collect;
    try {
        fn();
    } finally {
        console.log = originalLog;
        console.info = originalInfo;
        console.warn = originalWarn;
    }

    return logs;
}

function runUntilHalt(maxCycles = 10000) {
    let cycles = 0;
    while (simulator.cpu.isRunning && cycles < maxCycles) {
        simulator.tick();
        cycles++;
    }

    if (simulator.cpu.isRunning) {
        throw new Error(`CAN MMIO CPU loopback timed out after ${maxCycles} cycles`);
    }

    return cycles;
}

const source = readFileSync(path.join(__dirname, 'can_loopback.asm'), 'utf8');
const program = assembler.assemble(source);

let cycles = 0;
const logs = captureConsole(() => {
    simulator.reset();
    simulator.loadProgram(program);
    cycles = runUntilHalt();
});

const exitCode = simulator.cpu.registers[10] >>> 0;
assert.equal(exitCode, 0, `can_loopback.asm exited with code ${exitCode}`);

const status = simulator.can.readRegister(reg(CAN_REGISTERS.STATUS));
assert.equal(status & CAN_STATUS_BITS.RX_AVAILABLE, 0, 'RX_POP should clear RX_AVAILABLE after CPU reads the frame');

const intStatus = simulator.can.readRegister(reg(CAN_REGISTERS.INT_STATUS));
assert.ok((intStatus & CAN_INT_BITS.TX_DONE) !== 0, 'TX_DONE interrupt flag should be raised');
assert.ok((intStatus & CAN_INT_BITS.RX_NEW) !== 0, 'RX_NEW interrupt flag should be raised');

assert.ok(
    simulator.mmu.translationHistory.some((entry) =>
        entry.physicalAddress >= BASE &&
        entry.physicalAddress < BASE + 0x100 &&
        entry.cacheable === false
    ),
    'MMU should classify CAN MMIO as non-cacheable'
);

assert.ok(
    logs.some((line) => line.includes('[MMU] REQUEST') && line.includes('pa=0xff200000') && line.includes('cacheable=false')),
    'CPU access should pass through MMU to CAN base as non-cacheable'
);
assert.ok(
    logs.some((line) => line.includes('[TileLink-UH] TileLink -> uh-to-ul-bridge DIRECT_WRITE')),
    'CPU data-cache bypass should reach the UH -> UL bridge'
);
assert.ok(
    logs.some((line) => line.includes('[uh-to-ul-bridge] BRIDGE_DIRECT_WRITE TileLink-UH->TileLink-UL')),
    'UH -> UL bridge should forward CAN writes'
);
assert.ok(
    logs.some((line) => line.includes('[TileLink-UL] TileLink -> CAN Controller DIRECT_WRITE')),
    'TileLink-UL should write the CAN MMIO endpoint'
);
assert.ok(
    logs.some((line) => line.includes('[TileLink-UL] TileLink -> CAN Controller DIRECT_READ')),
    'TileLink-UL should read the CAN MMIO endpoint'
);

console.log(`CAN CPU/MMIO loopback verification passed in ${cycles} cycles.`);
