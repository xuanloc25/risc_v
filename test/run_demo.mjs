import assert from 'node:assert/strict';

import { simulator } from '../src/js/soc.js';

function makeProgram() {
    const ECALL = 0x00000073;
    return {
        startAddress: 0,
        memory: {
            0: ECALL & 0xFF,
            1: (ECALL >> 8) & 0xFF,
            2: (ECALL >> 16) & 0xFF,
            3: (ECALL >> 24) & 0xFF
        }
    };
}

function dumpBytes(tilelink, addr, len) {
    const out = [];
    for (let i = 0; i < len; i++) {
        const b = tilelink.peekByte(addr + i) & 0xFF;
        out.push(`0x${b.toString(16).padStart(2, '0')}`);
    }
    return out.join(' ');
}

function readBytes(tilelink, addr, len) {
    return Array.from({ length: len }, (_, i) => tilelink.peekByte(addr + i) & 0xFF);
}

simulator.reset();
simulator.loadProgram(makeProgram());

[1, 2, 3, 4].forEach((b, i) => simulator.tilelink_UH.pokeByte(0x200 + i, b));

console.log('Before DMA:');
console.log('src 0x200:', dumpBytes(simulator.tilelink_UH, 0x200, 4));
console.log('dst 0x300:', dumpBytes(simulator.tilelink_UH, 0x300, 4));

simulator.dma.start(0x200, 0x300, 4);

let cycles = 0;
const maxCycles = 512;
while ((simulator.cpu.isRunning || simulator.dma.isBusy) && cycles < maxCycles) {
    simulator.tick();
    cycles++;
}

if (simulator.dma.isBusy) {
    throw new Error(`DMA did not finish within ${maxCycles} cycles`);
}

console.log('After DMA:');
console.log('src 0x200:', dumpBytes(simulator.tilelink_UH, 0x200, 4));
console.log('dst 0x300:', dumpBytes(simulator.tilelink_UH, 0x300, 4));

// This demo is also used as a smoke test: the copy must complete, not just log.
assert.deepEqual(readBytes(simulator.tilelink_UH, 0x300, 4), [1, 2, 3, 4]);

console.log('TileLink UH/UL bridge demo:');
simulator.tilelink_UH.pokeWord(0x1000000C, 0x3);
const uartCtrl = simulator.tilelink_UH.peekWord(0x1000000C);
const memoryWord = simulator.tilelink_UL.peekWord(0x200);

console.log('UART CTRL via UH->UL:', `0x${uartCtrl.toString(16)}`);
console.log('Memory word via UL->UH:', `0x${memoryWord.toString(16)}`);

// The two checks below make sure both bridge directions remain usable:
// UH -> UL reaches UART MMIO, and UL -> UH reaches main memory.
assert.equal(uartCtrl >>> 0, 0x3);
assert.equal(memoryWord >>> 0, 0x04030201);

console.log('Run demo smoke verification passed.');
