/**
 * dma_verify.mjs — Kiểm tra DMA Controller qua 3 kịch bản
 *
 *  1. Copy memory-to-memory (JS API trực tiếp)
 *  2. Copy memory-to-memory bằng ASM (CPU ghi register DMA)
 *  3. Byte-swap transfer
 *
 * Chạy: node test/dma_verify.mjs
 */

import assert from 'node:assert/strict';

import { assembler } from '../src/js/assembler.js';
import { simulator }  from '../src/js/soc.js';

const SEP = '─'.repeat(60);

function hex(v, w = 8) { return `0x${(v >>> 0).toString(16).padStart(w, '0')}`; }

function peekWord(addr) {
    return simulator.tilelink_UH.peekWord(addr);
}

function pokeWord(addr, value) {
    simulator.tilelink_UH.pokeWord(addr, value);
}

function runUntilDone(maxCycles = 4000) {
    let cycles = 0;
    while ((simulator.cpu.isRunning || simulator.dma.isBusy || simulator.dma.registers.busy) && cycles < maxCycles) {
        simulator.tick();
        cycles++;
    }
    return cycles;
}

function header(title) {
    console.log(`\n${SEP}`);
    console.log(`  ${title}`);
    console.log(SEP);
}

// ════════════════════════════════════════════════════════════════
// Kịch bản 1: JS API — dma.start(src, dst, length)
//   • Chép 16 bytes từ 0x300 → 0x400
//   • Kiểm tra dữ liệu đích khớp nguồn
// ════════════════════════════════════════════════════════════════
header('Kịch bản 1 — JS API: dma.start(src=0x300, dst=0x400, len=16)');

const ECALL = 0x00000073;
const ecallProgram = { startAddress: 0x400000, memory: {
    0x400000: ECALL & 0xFF, 0x400001: (ECALL >> 8) & 0xFF,
    0x400002: (ECALL >> 16) & 0xFF, 0x400003: (ECALL >> 24) & 0xFF
}};

simulator.init();

// loadProgram TRƯỚC để loadMemoryMap không ghi đè data sau
simulator.loadProgram(ecallProgram);

// Ghi dữ liệu nguồn vào RAM SAU loadProgram
const srcWords1 = [0x11223344, 0x55667788, 0x99AABBCC, 0xDDEEFF00];
srcWords1.forEach((w, i) => pokeWord(0x300 + i * 4, w));

console.log('[Before]');
srcWords1.forEach((_, i) => {
    console.log(`  src[${i}] ${hex(0x300 + i*4)} = ${hex(peekWord(0x300 + i*4))}`);
    console.log(`  dst[${i}] ${hex(0x400 + i*4)} = ${hex(peekWord(0x400 + i*4))}`);
});

// Khởi động DMA qua JS API
simulator.dma.start(0x300, 0x400, 16);
const cycles1 = runUntilDone();

console.log(`\n[After — ${cycles1} cycles]`);
let pass1 = true;
srcWords1.forEach((expected, i) => {
    const got = peekWord(0x400 + i * 4);
    const ok = got === expected;
    if (!ok) pass1 = false;
    console.log(`  dst[${i}] ${hex(0x400 + i*4)} = ${hex(got)}  ${ok ? 'OK' : `FAIL (expected ${hex(expected)})`}`);
});
assert.equal(pass1, true, 'DMA JS API copy should preserve all source words.');
console.log(pass1 ? '[PASS] JS API copy OK' : '[FAIL]');

// ════════════════════════════════════════════════════════════════
// Kịch bản 2: ASM — CPU ghi trực tiếp vào DMA registers
//   • CPU ghi 3 descriptor words vào 0xFFED0004
//   • CPU bật EN+START → DMA tự chép 0x500 → 0x600
//   • CPU poll BUSY bit rồi exit
// ════════════════════════════════════════════════════════════════
header('Kịch bản 2 — ASM: CPU điều khiển DMA qua register (0xFFED0000)');

simulator.init();

const src2 = `
.text
.globl _start
_start:
    # t0 = DMA_CTRL  (0xFFED0000)
    # t1 = DMA_DESC  (0xFFED0004)
    lui   t0, 0xFFED0           # t0 = 0xFFED0000
    addi  t1, t0, 4             # t1 = 0xFFED0004

    # Bước 1: Enable DMA (bit0 = 1)
    li    t4, 1
    sw    t4, 0(t0)

    # Bước 2: Ghi descriptor (3 words)
    li    t2, 0x500             # t2 = src address
    li    t3, 0x600             # t3 = dst address

    sw    t2, 0(t1)             # src addr
    sw    t3, 0(t1)             # dst addr
    li    t5, 0xAA000010        # config: dstMode=2,srcMode=2,srcWidth=2,dstWidth=2,len=16 (new mapping)
    sw    t5, 0(t1)             # config word

    # Bước 3: Enable + Start (bit0|bit1 = 3)
    li    t4, 3
    sw    t4, 0(t0)

poll:
    lw    t6, 0(t0)             # đọc CTRL
    srli  t6, t6, 31            # lấy bit31 (BUSY)
    bne   t6, x0, poll          # loop nếu còn busy

    li    a0, 0
    li    a7, 93
    ecall
`;

simulator.loadProgram(assembler.assemble(src2));

// Ghi dữ liệu nguồn SAU loadProgram
const srcWords2 = [0xAABBCCDD, 0x12345678, 0xDEADBEEF, 0xCAFEBABE];
srcWords2.forEach((w, i) => pokeWord(0x500 + i * 4, w));
console.log('[Source data tại 0x500]');
srcWords2.forEach((w, i) => console.log(`  [${i}] ${hex(0x500 + i*4)} = ${hex(w)}`));

const cycles2 = runUntilDone(8000);

console.log(`\n[After — ${cycles2} cycles]`);
let pass2 = true;
srcWords2.forEach((expected, i) => {
    const got = peekWord(0x600 + i * 4);
    const ok = got === expected;
    if (!ok) pass2 = false;
    console.log(`  dst[${i}] ${hex(0x600 + i*4)} = ${hex(got)}  ${ok ? 'OK' : `FAIL (expected ${hex(expected)})`}`);
});
assert.equal(pass2, true, 'CPU-driven DMA register copy should preserve all source words.');
console.log(pass2 ? '[PASS] ASM DMA copy OK' : '[FAIL]');

// ════════════════════════════════════════════════════════════════
// Kịch bản 3: Byte-swap (bswap=1)
//   • Nguồn: 0x11223344 → đích phải là 0x44332211
// ════════════════════════════════════════════════════════════════
header('Kịch bản 3 — Byte-swap transfer (bswap=1)');

simulator.init();
simulator.loadProgram(ecallProgram);

// Ghi dữ liệu nguồn SAU loadProgram
pokeWord(0x700, 0x11223344);
pokeWord(0x704, 0xAABBCCDD);
console.log(`[Source] 0x700 = ${hex(peekWord(0x700))}`);
console.log(`[Source] 0x704 = ${hex(peekWord(0x704))}`);

// config: dstMode=3 (word-stride), srcMode=3 (word-stride), bswap=1, numElements=2 (2×4-byte words = 8 bytes)
// Using new mapping: bits dstMode/srcMode/srcWidth/dstWidth/bswap/numElements
const bswapConfig = (3 << 30) | (3 << 28) | (2 << 26) | (2 << 24) | (1 << 20) | 2;
simulator.dma.start(0x700, 0x800, 2);   // 2 elements placeholder, configWord overridden below
simulator.dma.registers.descriptorFifo[0].configWord = bswapConfig >>> 0;
const cycles3 = runUntilDone();

const got3a = peekWord(0x800);
const got3b = peekWord(0x804);
console.log(`\n[After — ${cycles3} cycles]`);
console.log(`  dst 0x800 = ${hex(got3a)}  (expected ${hex(0x44332211)})`);
console.log(`  dst 0x804 = ${hex(got3b)}  (expected ${hex(0xDDCCBBAA)})`);
const pass3 = got3a === 0x44332211 && got3b === 0xDDCCBBAA;
assert.equal(pass3, true, 'DMA byte-swap should reverse bytes within each 32-bit word.');
console.log(pass3 ? '[PASS] Byte-swap OK' : '[FAIL]');

// ════════════════════════════════════════════════════════════════
console.log(`\n${SEP}`);
const allPass = pass1 && pass2 && pass3;
assert.equal(allPass, true, 'At least one DMA scenario failed.');
console.log(allPass
    ? '  Tất cả 3 kịch bản DMA đều PASS'
    : '  Có kịch bản FAIL — kiểm tra log bên trên');
console.log(SEP);
