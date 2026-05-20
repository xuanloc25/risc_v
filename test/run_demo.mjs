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

console.log('TileLink UH/UL bridge demo:');
simulator.tilelink_UH.pokeWord(0x1000000C, 0x3);
console.log('UART CTRL via UH->UL:', `0x${simulator.tilelink_UH.peekWord(0x1000000C).toString(16)}`);
console.log('Memory word via UL->UH:', `0x${simulator.tilelink_UL.peekWord(0x200).toString(16)}`);
