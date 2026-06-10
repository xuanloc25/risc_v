/**
 * dma_datapath_verify.mjs — Kiểm tra các lỗ hổng datapath ưu tiên cao của DMA
 *
 * Mỗi kịch bản: simulator.init(); nạp chương trình ECALL tối thiểu; poke nguồn;
 * lập trình DMA qua register (createConfig với srcMode/dstMode TƯỜNG MINH);
 * chạy tới khi xong; assert. Mỗi giá trị kỳ vọng được suy ra từ spec/nguyên lý.
 *
 *   1. Lệch độ rộng src=word/dst=byte (inc/inc, n=8): byte-stream little-endian.
 *   2. Lệch độ rộng src=byte/dst=word (inc/inc, n=1): pack little-endian 4 byte.
 *   3. Nguồn cố định (srcMode=0) + đích tăng (dstMode=1), word, n=4: nhân bản 1 word.
 *   4. Đích cố định (dstMode=0) + nguồn tăng (srcMode=1), word, n=4: đích giữ word cuối.
 *   5. Đường lỗi mode-3 (address mode không hợp lệ): error=true, busy=false, không treo.
 *   6. Byte-swap halfword (bswap=1, n=2): mỗi halfword đích bị đảo 2 byte.
 *
 * Chạy: node test/dma_datapath_verify.mjs
 */

import assert from 'node:assert/strict';
import { simulator } from '../src/js/soc.js';
import { DMADescriptor } from '../src/js/dma.js';

const SEP = '─'.repeat(60);
function hex(v, w = 8) { return `0x${(v >>> 0).toString(16).padStart(w, '0')}`; }
function hexb(v) { return `0x${(v & 0xFF).toString(16).padStart(2, '0')}`; }

function peekWord(addr) { return simulator.tilelink_UH.peekWord(addr); }
function pokeWord(addr, value) { simulator.tilelink_UH.pokeWord(addr, value); }
function peekByte(addr) { return simulator.tilelink_UH.peekByte(addr); }

const ECALL = 0x00000073;
function loadEcall() {
    simulator.loadProgram({ startAddress: 0x400000, memory: {
        0x400000: ECALL & 0xFF, 0x400001: (ECALL >> 8) & 0xFF,
        0x400002: (ECALL >> 16) & 0xFF, 0x400003: (ECALL >> 24) & 0xFF
    }});
}

function runUntilDone(maxCycles = 8000) {
    let cycles = 0;
    while ((simulator.cpu.isRunning || simulator.dma.isBusy || simulator.dma.registers.busy) && cycles < maxCycles) {
        simulator.tick();
        cycles++;
    }
    return cycles;
}

// Lập trình DMA qua đúng đường register/CTRL (giống dma_verify.mjs / dma_burst_verify.mjs).
function programDma(srcAddr, dstAddr, cfg) {
    simulator.dma.registers.writeCtrl(1);            // enable
    simulator.dma.registers.writeDescriptor(srcAddr);
    simulator.dma.registers.writeDescriptor(dstAddr);
    simulator.dma.registers.writeDescriptor(cfg >>> 0);
    simulator.dma.registers.writeCtrl(3);            // enable + start
}

// Tắt log ồn ào của DMA trong lúc chạy nhưng vẫn dùng được cho header.
const realLog = console.log;
function quiet(fn) {
    console.log = () => {};
    try { return fn(); } finally { console.log = realLog; }
}
function header(title) {
    realLog(`\n${SEP}`);
    realLog(`  ${title}`);
    realLog(SEP);
}

const findings = [];

// ════════════════════════════════════════════════════════════════
// Kịch bản 1: Lệch độ rộng src=word(2)/dst=byte(0), inc/inc, n=8
//   Dòng dữ liệu là BYTE STREAM. Mỗi source word đẩy little-endian vào readFifo,
//   chuyển sang writeFifo, rồi mỗi dst byte pop ra theo đúng thứ tự.
//   totalSrcBytesNeeded = ceil(8*1/4)*4 = 8 byte = 2 source word.
//   src word 0x44332211 -> bytes 0x11,0x22,0x33,0x44 (little-endian).
// ════════════════════════════════════════════════════════════════
header('Kịch bản 1 — Lệch độ rộng word->byte (n=8): byte stream little-endian');
let pass1 = quiet(() => {
    simulator.init();
    loadEcall();
    const SRC = 0x300, DST = 0x400;
    const srcWords = [0x44332211, 0xCCDDEE99];
    srcWords.forEach((w, i) => pokeWord(SRC + i * 4, w));
    // n=8 dst byte, bswap=0, srcMode=1(inc), dstMode=1(inc), srcWidth=2(word), dstWidth=0(byte)
    const cfg = DMADescriptor.createConfig(8, 0, 1, 1, 2, 0);
    programDma(SRC, DST, cfg);
    runUntilDone();

    // Kỳ vọng: byte little-endian của 2 word, theo thứ tự word0 rồi word1.
    const expected = [];
    srcWords.forEach(w => {
        expected.push(w & 0xFF, (w >>> 8) & 0xFF, (w >>> 16) & 0xFF, (w >>> 24) & 0xFF);
    });
    let ok = simulator.dma.registers.done && !simulator.dma.registers.error;
    for (let i = 0; i < 8; i++) {
        const got = peekByte(DST + i);
        const e = expected[i] & 0xFF;
        const cell = got === e;
        if (!cell) ok = false;
        if (i < 8) realLog(`  dst[${i}] ${hex(DST + i)} = ${hexb(got)}  ${cell ? 'OK' : `FAIL (expected ${hexb(e)})`}`);
    }
    return ok;
});
realLog(pass1 ? '[PASS] word->byte stream OK' : '[FAIL]');

// ════════════════════════════════════════════════════════════════
// Kịch bản 2: Lệch độ rộng src=byte(0)/dst=word(2), inc/inc, n=1
//   totalSrcBytesNeeded = ceil(1*4/1)*1 = 4 byte = 4 source byte.
//   Pack little-endian: dst word = b0 | b1<<8 | b2<<16 | b3<<24.
// ════════════════════════════════════════════════════════════════
header('Kịch bản 2 — Lệch độ rộng byte->word (n=1): pack little-endian 4 byte');
let pass2 = quiet(() => {
    simulator.init();
    loadEcall();
    const SRC = 0x300, DST = 0x400;
    const srcBytes = [0x11, 0x22, 0x33, 0x44];
    srcBytes.forEach((b, i) => simulator.tilelink_UH.pokeByte(SRC + i, b));
    // n=1 dst word, bswap=0, srcMode=1(inc), dstMode=1(inc), srcWidth=0(byte), dstWidth=2(word)
    const cfg = DMADescriptor.createConfig(1, 0, 1, 1, 0, 2);
    programDma(SRC, DST, cfg);
    runUntilDone();

    const expected = (srcBytes[0] | (srcBytes[1] << 8) | (srcBytes[2] << 16) | (srcBytes[3] << 24)) >>> 0;
    const got = peekWord(DST);
    realLog(`  dst ${hex(DST)} = ${hex(got)}  (expected ${hex(expected)})`);
    return simulator.dma.registers.done && !simulator.dma.registers.error && got === expected;
});
realLog(pass2 ? '[PASS] byte->word pack OK' : '[FAIL]');

// ════════════════════════════════════════════════════════════════
// Kịch bản 3: Nguồn cố định (srcMode=0) + đích tăng (dstMode=1), word, n=4
//   calculateAddress mode 0 luôn trả baseAddr -> đọc CÙNG 1 word 4 lần.
//   -> cả 4 dst word đều bằng giá trị nguồn duy nhất.
// ════════════════════════════════════════════════════════════════
header('Kịch bản 3 — Nguồn cố định + đích tăng (n=4): nhân bản 1 word');
let pass3 = quiet(() => {
    simulator.init();
    loadEcall();
    const SRC = 0x300, DST = 0x400;
    const value = 0xDEADBEEF;
    pokeWord(SRC, value);
    // n=4 word, bswap=0, srcMode=0(fixed), dstMode=1(inc), srcWidth=2, dstWidth=2
    const cfg = DMADescriptor.createConfig(4, 0, 0, 1, 2, 2);
    programDma(SRC, DST, cfg);
    runUntilDone();

    let ok = simulator.dma.registers.done && !simulator.dma.registers.error;
    for (let i = 0; i < 4; i++) {
        const got = peekWord(DST + i * 4);
        const cell = got === value;
        if (!cell) ok = false;
        realLog(`  dst[${i}] ${hex(DST + i * 4)} = ${hex(got)}  ${cell ? 'OK' : `FAIL (expected ${hex(value)})`}`);
    }
    return ok;
});
realLog(pass3 ? '[PASS] fixed-source replicate OK' : '[FAIL]');

// ════════════════════════════════════════════════════════════════
// Kịch bản 4: Đích cố định (dstMode=0) + nguồn tăng (srcMode=1), word, n=4
//   calculateAddress mode 0 cho đích luôn trả baseAddr -> cả 4 lần ghi vào CÙNG
//   địa chỉ. Lần ghi cuối thắng -> đích giữ word NGUỒN CUỐI CÙNG.
// ════════════════════════════════════════════════════════════════
header('Kịch bản 4 — Đích cố định + nguồn tăng (n=4): đích giữ word cuối');
let pass4 = quiet(() => {
    simulator.init();
    loadEcall();
    const SRC = 0x300, DST = 0x400;
    const srcWords = [0x11111111, 0x22222222, 0x33333333, 0x44444444];
    srcWords.forEach((w, i) => pokeWord(SRC + i * 4, w));
    // n=4 word, bswap=0, srcMode=1(inc), dstMode=0(fixed), srcWidth=2, dstWidth=2
    const cfg = DMADescriptor.createConfig(4, 0, 1, 0, 2, 2);
    programDma(SRC, DST, cfg);
    runUntilDone();

    const expected = srcWords[srcWords.length - 1] >>> 0;
    const got = peekWord(DST);
    realLog(`  dst ${hex(DST)} = ${hex(got)}  (expected last source word ${hex(expected)})`);
    return simulator.dma.registers.done && !simulator.dma.registers.error && got === expected;
});
realLog(pass4 ? '[PASS] fixed-dest keeps last word OK' : '[FAIL]');

// ════════════════════════════════════════════════════════════════
// Kịch bản 5: Đường lỗi mode-3 (address mode không hợp lệ)
//   createConfig(2) để mặc định srcMode/dstMode=3. calculateAddress ném
//   "Invalid address mode: 3", performTransferStep bắt -> error=true, busy=false.
//   Tick có giới hạn cycle để chứng minh KHÔNG treo.
// ════════════════════════════════════════════════════════════════
header('Kịch bản 5 — Mode-3 invalid: error=true, busy=false, không treo');
let pass5 = quiet(() => {
    simulator.init();
    loadEcall();
    const SRC = 0x300, DST = 0x400;
    pokeWord(SRC, 0xCAFEBABE);
    pokeWord(SRC + 4, 0xFEEDFACE);
    // CẢNH BÁO: createConfig(2) -> srcMode/dstMode mặc định = 3 (INVALID).
    const cfg = DMADescriptor.createConfig(2);
    const parsed = new DMADescriptor(SRC, DST, cfg).parseConfig();
    realLog(`  config srcMode=${parsed.srcMode} dstMode=${parsed.dstMode} (kỳ vọng cả hai = 3)`);
    programDma(SRC, DST, cfg);

    // Tick BOUNDED — đủ để bắt lỗi nhưng giới hạn để phát hiện treo.
    const MAX = 200;
    let cycles = 0;
    while (cycles < MAX && !simulator.dma.registers.error && simulator.dma.registers.busy) {
        simulator.tick();
        cycles++;
    }
    // Tick thêm vài cycle để chắc chắn không có "busy" còn sót.
    for (let i = 0; i < 5; i++) simulator.tick();

    const err = simulator.dma.registers.error === true;
    const notBusy = simulator.dma.registers.busy === false;
    const notStuck = cycles < MAX;
    realLog(`  error=${simulator.dma.registers.error} busy=${simulator.dma.registers.busy} cyclesToError=${cycles} (<${MAX})`);
    return err && notBusy && notStuck;
});
realLog(pass5 ? '[PASS] mode-3 error path OK' : '[FAIL]');

// ════════════════════════════════════════════════════════════════
// Kịch bản 6: Byte-swap halfword (bswap=1), src=hw/dst=hw, inc, n=2
//   Ở đường đọc, swapBytes(size=2) đảo 2 byte NGAY khi nhận response, rồi đẩy
//   little-endian vào readFifo và đóng gói little-endian thành halfword đích.
//   -> halfword đích = byte-swap của halfword nguồn (0xAABB -> 0xBBAA).
// ════════════════════════════════════════════════════════════════
header('Kịch bản 6 — Byte-swap halfword (bswap=1, n=2): đảo 2 byte mỗi halfword');
let pass6 = quiet(() => {
    simulator.init();
    loadEcall();
    const SRC = 0x300, DST = 0x400;
    // Nguồn: 2 halfword liền nhau trong 1 word little-endian (0xBBAA tại offset 0, 0xDDCC tại offset 2).
    const srcHalfwords = [0xAABB, 0xCCDD];
    // Đặt vào RAM: halfword little-endian. word = hw0 | hw1<<16.
    pokeWord(SRC, (srcHalfwords[0] | (srcHalfwords[1] << 16)) >>> 0);
    // n=2 halfword, bswap=1, srcMode=1(inc), dstMode=1(inc), srcWidth=1(hw), dstWidth=1(hw)
    const cfg = DMADescriptor.createConfig(2, 1, 1, 1, 1, 1);
    programDma(SRC, DST, cfg);
    runUntilDone();

    const swap16 = (v) => (((v & 0xFF) << 8) | ((v >>> 8) & 0xFF)) & 0xFFFF;
    let ok = simulator.dma.registers.done && !simulator.dma.registers.error;
    for (let i = 0; i < 2; i++) {
        // Đọc halfword đích: 2 byte little-endian tại DST + i*2.
        const lo = peekByte(DST + i * 2);
        const hi = peekByte(DST + i * 2 + 1);
        const got = (lo | (hi << 8)) & 0xFFFF;
        const e = swap16(srcHalfwords[i]);
        const cell = got === e;
        if (!cell) ok = false;
        realLog(`  dst hw[${i}] ${hex(DST + i * 2)} = 0x${got.toString(16).padStart(4, '0')}  (src 0x${srcHalfwords[i].toString(16).padStart(4, '0')} -> expected 0x${e.toString(16).padStart(4, '0')})  ${cell ? 'OK' : 'FAIL'}`);
    }
    return ok;
});
realLog(pass6 ? '[PASS] halfword byte-swap OK' : '[FAIL]');

// ════════════════════════════════════════════════════════════════
realLog(`\n${SEP}`);
const all = [pass1, pass2, pass3, pass4, pass5, pass6];
const allPass = all.every(Boolean);
realLog(allPass
    ? '  Tất cả 6 kịch bản DMA datapath đều PASS'
    : '  Có kịch bản FAIL — kiểm tra log bên trên');
if (findings.length) {
    realLog('  Ghi chú khác biệt với spec:');
    findings.forEach(f => realLog(`   - ${f}`));
}
realLog(SEP);

// Assert một lần ở cuối để không kịch bản nào bị che bởi lỗi kịch bản trước.
assert.equal(allPass, true,
    `Có kịch bản DMA datapath FAIL — ` +
    `p1=${pass1} p2=${pass2} p3=${pass3} p4=${pass4} p5=${pass5} p6=${pass6}`);
