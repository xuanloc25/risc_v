/**
 * dma_burst_verify.mjs — Kiểm tra 3 yêu cầu giảng viên trên DMA + TileLink-UH:
 *
 *   1. Buffer DMA độc lập đọc/ghi (readFifo tách khỏi writeFifo).
 *   2. DMA dùng burst transfer thật của TileLink-UH cho CẢ đọc lẫn ghi
 *      (một giao dịch Get/PutFullData nhiều beat, không phải loop lệnh đơn).
 *   3. TileLink-UH có latency giao dịch (không trả lời tức thì).
 *
 * Cấu hình: copy 16 word (64 byte) tăng dần, burstSize=1 (=> 4 beat/burst).
 *
 * Chạy: node test/dma_burst_verify.mjs
 */

import assert from 'node:assert/strict';
import { simulator } from '../src/js/soc.js';
import { DMADescriptor } from '../src/js/dma.js';

const SEP = '─'.repeat(60);
function hex(v, w = 8) { return `0x${(v >>> 0).toString(16).padStart(w, '0')}`; }

// Bắt mọi dòng log để kiểm tra bằng chứng burst/latency sau khi chạy.
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

function countLines(substr) {
    return logLines.filter(l => l.includes(substr)).length;
}

simulator.init();

// Chương trình tối thiểu: chỉ một ECALL để CPU dừng ngay, nhường sân cho DMA.
const ECALL = 0x00000073;
simulator.loadProgram({ startAddress: 0x400000, memory: {
    0x400000: ECALL & 0xFF, 0x400001: (ECALL >> 8) & 0xFF,
    0x400002: (ECALL >> 16) & 0xFF, 0x400003: (ECALL >> 24) & 0xFF
}});

const N = 16;
const SRC = 0x1000;
const DST = 0x2000;
const srcWords = [];
for (let i = 0; i < N; i++) {
    const w = (0x1000 + i * 0x111) >>> 0;
    srcWords.push(w);
    pokeWord(SRC + i * 4, w);
}

// numElements=16, bswap=0, srcMode=1(inc), dstMode=1(inc), srcWidth=2(word), dstWidth=2(word), burstSize=1(=>4 beats)
const cfg = DMADescriptor.createConfig(N, 0, 1, 1, 2, 2, 1);
simulator.dma.registers.writeCtrl(1);            // enable
simulator.dma.registers.writeDescriptor(SRC);
simulator.dma.registers.writeDescriptor(DST);
simulator.dma.registers.writeDescriptor(cfg);
simulator.dma.registers.writeCtrl(3);            // enable + start

// Bằng chứng buffer độc lập: hai mảng tách biệt.
const regs = simulator.dma.registers;
const buffersIndependent = Array.isArray(regs.readFifo) && Array.isArray(regs.writeFifo) && regs.readFifo !== regs.writeFifo;

const cycles = runUntilDone();

console.log = realLog; // khôi phục in ra màn hình

console.log(`\n${SEP}`);
console.log('  DMA + TileLink-UH burst/latency verification');
console.log(SEP);

// ── Yêu cầu 1: copy đúng dữ liệu (chứng minh datapath read->write buffer hoạt động) ──
let dataOk = true;
for (let i = 0; i < N; i++) {
    const got = peekWord(DST + i * 4);
    const ok = got === srcWords[i];
    if (!ok) dataOk = false;
    if (i < 4 || !ok) {
        console.log(`  dst[${i}] ${hex(DST + i * 4)} = ${hex(got)}  ${ok ? 'OK' : `FAIL (expected ${hex(srcWords[i])})`}`);
    }
}
console.log(`  ... (${N} words total)`);
assert.equal(dataOk, true, 'Burst copy phải bảo toàn toàn bộ dữ liệu nguồn.');

// ── Yêu cầu 1 (tiếp): buffer đọc/ghi độc lập ──
assert.equal(buffersIndependent, true, 'readFifo và writeFifo phải là hai buffer độc lập.');
const datapathMoves = countLines('[DMA][DATAPATH] moved');
assert.ok(datapathMoves > 0, 'Phải có datapath chuyển byte từ read buffer sang write buffer.');

// ── Yêu cầu 2: burst transfer thật cho cả đọc và ghi ──
const multiReadBursts  = logLines.filter(l => l.includes('ISSUE_READ') && l.includes('beats=4')).length;
const multiWriteBursts = logLines.filter(l => l.includes('ISSUE_WRITE') && l.includes('multi-beat')).length;
const readBeats  = countLines('RESPONSE_BEAT');   // Mem phát beat đọc
const writeBeats = countLines('WRITE_BEAT');       // Mem ghi từng beat
assert.ok(multiReadBursts >= 1,  'Phải có ít nhất 1 giao dịch READ burst nhiều beat trên UH.');
assert.ok(multiWriteBursts >= 1, 'Phải có ít nhất 1 giao dịch WRITE burst nhiều beat trên UH.');
assert.ok(readBeats >= 4,  'Mem phải phát nhiều beat đọc (multibeat).');
assert.ok(writeBeats >= 4, 'Mem phải ghi nhiều beat (multibeat write).');

// ── Yêu cầu 3: TileLink-UH có latency ──
const latencyHits = countLines('fabric latency=2');
assert.ok(simulator.tilelink_UH.latency >= 1, 'TileLink-UH phải có latency > 0.');
assert.ok(latencyHits > 0, 'Log của UH phải thể hiện fabric latency đang áp dụng.');

console.log(`\n  [1] Buffer độc lập:   readFifo≠writeFifo=${buffersIndependent}, datapath moves=${datapathMoves}`);
console.log(`  [2] Burst UH:         READ bursts=${multiReadBursts} (beats=${readBeats}), WRITE bursts=${multiWriteBursts} (beats=${writeBeats})`);
console.log(`  [3] Latency UH:       latency=${simulator.tilelink_UH.latency} cycle, log hits=${latencyHits}`);
console.log(`  Hoàn tất trong ${cycles} cycle.`);

// ── Regression: tính đúng dữ liệu trên ma trận cấu hình ─────────────────────
// Bao gồm số phần tử KHÔNG phải lũy thừa 2 (burst phải kẹp về lũy thừa 2, phần
// dư ghi sau) và các bề rộng sub-word (byte/halfword) đi qua đường đọc-từng-element.
const sink = () => {};
function dataCopyOk(num, srcMode, dstMode, srcW, dstW, burst) {
    const realLog2 = console.log; console.log = sink;
    simulator.init();
    simulator.loadProgram({ startAddress: 0x400000, memory: {
        0x400000: ECALL & 0xFF, 0x400001: (ECALL >> 8) & 0xFF,
        0x400002: (ECALL >> 16) & 0xFF, 0x400003: (ECALL >> 24) & 0xFF
    }});
    const S = 0x1000, D = 0x9000;
    const sElem = srcW === 0 ? 1 : srcW === 1 ? 2 : 4;
    const dElem = dstW === 0 ? 1 : dstW === 1 ? 2 : 4;
    for (let b = 0; b < num * Math.max(sElem, dElem) + 8; b += 4) {
        pokeWord(S + b, ((0xC0 + (b & 0x3F)) | ((0xC1 + b) << 8) | ((0xC2 + b) << 16) | ((0xC3 + b) << 24)) >>> 0);
    }
    const cfg = DMADescriptor.createConfig(num, 0, srcMode, dstMode, srcW, dstW, burst);
    simulator.dma.registers.writeCtrl(1);
    simulator.dma.registers.writeDescriptor(S);
    simulator.dma.registers.writeDescriptor(D);
    simulator.dma.registers.writeDescriptor(cfg);
    simulator.dma.registers.writeCtrl(3);
    runUntilDone();
    // Element-wise compare honouring the address mode (0=fixed,1=inc,2=dec).
    // All matrix cases use srcWidth===dstWidth, so dst element i == src element i.
    const calc = (base, i, mode, esz) => mode === 2 ? base - i * esz : mode === 0 ? base : base + i * esz;
    const mask = (esz) => esz === 1 ? 0xFF : esz === 2 ? 0xFFFF : 0xFFFFFFFF;
    let ok = simulator.dma.registers.done && !simulator.dma.registers.error;
    for (let i = 0; i < num && ok; i++) {
        const sv = (peekWord(calc(S, i, srcMode, sElem)) & mask(sElem)) >>> 0;
        const dv = (peekWord(calc(D, i, dstMode, dElem)) & mask(dElem)) >>> 0;
        if (sv !== dv) ok = false;
    }
    console.log = realLog2;
    return ok;
}

const matrix = [
    // [numElements, srcMode, dstMode, srcWidth, dstWidth, burstSize] — word, non-pow2 counts
    [3,1,1,2,2,1], [5,1,1,2,2,2], [6,1,1,2,2,2], [7,1,1,2,2,2],
    [11,1,1,2,2,2], [13,1,1,2,2,3], [30,1,1,2,2,2],
    // sub-word widths with burst (read-per-element path)
    [16,1,1,0,0,2], [8,1,1,1,1,2],
    // non-increment word (single-element path)
    [8,1,2,2,2,2],
];
let regressFails = 0;
for (const [n, sm, dm, sw, dw, bs] of matrix) {
    const ok = dataCopyOk(n, sm, dm, sw, dw, bs);
    if (!ok) regressFails++;
    console.log(`  regress N=${n} src/dstMode=${sm}/${dm} w=${sw}/${dw} burst=${bs}: ${ok ? 'OK' : 'FAIL'}`);
    assert.ok(ok, `Regression config N=${n}, modes ${sm}/${dm}, widths ${sw}/${dw}, burst ${bs} phải copy đúng.`);
}
assert.equal(regressFails, 0, 'Toàn bộ ma trận regression phải PASS.');

console.log(`\n${SEP}`);
console.log('  Tất cả kiểm tra ĐỀU PASS');
console.log(SEP);
