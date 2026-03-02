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

function dumpBytes(bus, addr, len) {
    const out = [];
    for (let i = 0; i < len; i++) {
        const b = bus.peekByte(addr + i) & 0xFF;
        out.push(`0x${b.toString(16).padStart(2, '0')}`);
    }
    return out.join(' ');
}

simulator.reset();
simulator.loadProgram(makeProgram());

[1, 2, 3, 4].forEach((b, i) => simulator.bus.pokeByte(0x200 + i, b));

console.log('Before DMA:');
console.log('src 0x200:', dumpBytes(simulator.bus, 0x200, 4));
console.log('dst 0x300:', dumpBytes(simulator.bus, 0x300, 4));

simulator.dma.start(0x200, 0x300, 4);

for (let i = 0; i < 18; i++) simulator.tick();

console.log('After DMA:');
console.log('src 0x200:', dumpBytes(simulator.bus, 0x200, 4));
console.log('dst 0x300:', dumpBytes(simulator.bus, 0x300, 4));
