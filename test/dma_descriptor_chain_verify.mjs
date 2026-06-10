/**
 * dma_descriptor_chain_verify.mjs — Hành vi descriptor FIFO của DMA
 *
 * Chốt HỢP ĐỒNG (contract) cho nhiều descriptor, đã kiểm chứng bằng cách chạy thật:
 *   1. MỘT xung start (writeCtrl bit START) xử lý ĐÚNG MỘT descriptor; descriptor
 *      thứ hai vẫn nằm trong FIFO. (startRequested bị xoá ngay sau khi một transfer
 *      bắt đầu, và completeTransfer KHÔNG tự bật lại — nên không có auto-chain.)
 *   2. Khi hệ vẫn còn chạy (CPU active để soc.tick tiếp tục tick), một xung start
 *      THỨ HAI sẽ kéo descriptor đang chờ chạy tới khi hoàn tất.
 *
 * SẮC CẠNH (đã kiểm chứng, ghi chú để khỏi hiểu lầm): soc.tick() return sớm khi
 * CPU và DMA CÙNG rảnh (!cpuActive && !dmaActive). Vì vậy nếu CPU đã halt VÀ DMA
 * đã xong descriptor trước, một xung start mới sẽ KHÔNG được phục vụ vì dma.tick()
 * không được gọi để tiêu thụ startRequested. Trong thực tế CPU luôn đang chạy/poll
 * khi phát start (như demo_uart_dma.asm) nên điều này không xảy ra; kịch bản 2 vì
 * thế giữ CPU "sống" bằng một chương trình vòng lặp vô hạn.
 *
 * Chạy: node test/dma_descriptor_chain_verify.mjs
 */

import assert from 'node:assert/strict';
import { simulator } from '../src/js/soc.js';
import { DMADescriptor } from '../src/js/dma.js';

const SEP = '─'.repeat(60);
function peekWord(addr) { return simulator.tilelink_UH.peekWord(addr) >>> 0; }
function pokeWord(addr, value) { simulator.tilelink_UH.pokeWord(addr, value); }

const realLog = console.log;
function quiet(fn) { console.log = () => {}; try { return fn(); } finally { console.log = realLog; } }
function header(t) { realLog(`\n${SEP}\n  ${t}\n${SEP}`); }

const ECALL = 0x00000073;
function ecallProgram() {
    // Halts the CPU on the first instruction (a no-op ECALL).
    return { startAddress: 0x400000, memory: {
        0x400000: ECALL & 0xFF, 0x400001: (ECALL >> 8) & 0xFF,
        0x400002: (ECALL >> 16) & 0xFF, 0x400003: (ECALL >> 24) & 0xFF
    }};
}
function spinProgram() {
    // JAL x0, 0 (= 0x0000006F): jump-to-self infinite loop. Keeps cpu.isRunning
    // true so soc.tick() never early-returns and dma.tick() runs every cycle.
    const JAL_SELF = 0x0000006F;
    return { startAddress: 0x400000, memory: {
        0x400000: JAL_SELF & 0xFF, 0x400001: (JAL_SELF >> 8) & 0xFF,
        0x400002: (JAL_SELF >> 16) & 0xFF, 0x400003: (JAL_SELF >> 24) & 0xFF
    }};
}

const N = 4;
const SRC1 = 0x1000, DST1 = 0x2000;
const SRC2 = 0x3000, DST2 = 0x4000;
const src1 = [0x11111111, 0x22222222, 0x33333333, 0x44444444];
const src2 = [0xAAAAAAAA, 0xBBBBBBBB, 0xCCCCCCCC, 0xDDDDDDDD];
const cfg = DMADescriptor.createConfig(N, 0, 1, 1, 2, 2); // inc/inc, word

function seedSources() {
    src1.forEach((w, i) => pokeWord(SRC1 + i * 4, w));
    src2.forEach((w, i) => pokeWord(SRC2 + i * 4, w));
}
function queueTwoDescriptors() {
    simulator.dma.registers.writeCtrl(1);               // enable
    simulator.dma.registers.writeDescriptor(SRC1);
    simulator.dma.registers.writeDescriptor(DST1);
    simulator.dma.registers.writeDescriptor(cfg);
    simulator.dma.registers.writeDescriptor(SRC2);
    simulator.dma.registers.writeDescriptor(DST2);
    simulator.dma.registers.writeDescriptor(cfg);
}
const regionMatches = (base, words) => words.every((w, i) => peekWord(base + i * 4) === (w >>> 0));
const regionZero = (base, words) => words.every((_, i) => peekWord(base + i * 4) === 0);

// ── Kịch bản 1: MỘT start = MỘT descriptor ──────────────────────────────────
header('Kịch bản 1 — Một xung start chỉ xử lý một descriptor');
const s1 = quiet(() => {
    simulator.init();
    simulator.loadProgram(ecallProgram());
    seedSources();
    queueTwoDescriptors();
    const fifoAfterQueue = simulator.dma.registers.fifoCount;
    simulator.dma.registers.writeCtrl(3);               // MỘT xung start (enable|start)

    // soc.tick chạy chừng nào CPU còn chạy HOẶC DMA còn busy; descriptor 1 chạy
    // tới khi xong nhờ dma.isBusy, sau đó hệ dừng.
    let cycles = 0;
    while ((simulator.cpu.isRunning || simulator.dma.isBusy) && cycles < 20000) {
        simulator.tick(); cycles++;
    }
    return {
        fifoAfterQueue,
        dst1Ok: regionMatches(DST1, src1),
        dst2Untouched: regionZero(DST2, src2),
        fifoLeft: simulator.dma.registers.fifoCount,
        done: simulator.dma.registers.done,
        busy: simulator.dma.registers.busy,
    };
});
realLog(`  queued=${s1.fifoAfterQueue}, dst1 copied=${s1.dst1Ok}, dst2 untouched=${s1.dst2Untouched}, fifo left=${s1.fifoLeft}, done=${s1.done}, busy=${s1.busy}`);
assert.equal(s1.fifoAfterQueue, 2, 'Phải xếp hàng đủ 2 descriptor trước khi start.');
assert.equal(s1.dst1Ok, true, 'Descriptor 1 phải được sao chép đúng.');
assert.equal(s1.dst2Untouched, true, 'Descriptor 2 KHÔNG được chạy chỉ với một xung start.');
assert.equal(s1.fifoLeft, 1, 'Descriptor 2 phải còn nằm trong FIFO.');
assert.equal(s1.busy, false, 'DMA phải rảnh sau khi xong descriptor 1.');
realLog('  [PASS] một start = một descriptor; descriptor 2 còn chờ trong FIFO');

// ── Kịch bản 2: start thứ hai (CPU còn chạy) chạy nốt descriptor đang chờ ────
header('Kịch bản 2 — Start thứ hai (hệ còn chạy) chạy nốt descriptor đang chờ');
const s2 = quiet(() => {
    simulator.init();
    simulator.loadProgram(spinProgram());               // CPU spin -> soc.tick luôn tick dma
    seedSources();
    queueTwoDescriptors();
    const r = simulator.dma.registers;
    const tickUntil = (pred, max = 20000) => { let c = 0; while (!pred() && c < max) { simulator.tick(); c++; } return c; };

    r.writeCtrl(3);                                      // start descriptor 1
    tickUntil(() => r.done && r.fifoCount === 1);        // desc1 xong, desc2 còn chờ
    const dst1Ok = regionMatches(DST1, src1);
    const dst2BeforeSecond = regionZero(DST2, src2);

    r.writeCtrl(3);                                      // start descriptor 2
    tickUntil(() => r.done && r.fifoCount === 0);        // desc2 xong, FIFO rỗng
    const dst2Ok = regionMatches(DST2, src2);
    return { dst1Ok, dst2BeforeSecond, dst2Ok, fifoLeft: r.fifoCount };
});
realLog(`  dst1 copied=${s2.dst1Ok}, dst2 chưa chạy trước start#2=${s2.dst2BeforeSecond}, dst2 copied sau start#2=${s2.dst2Ok}, fifo left=${s2.fifoLeft}`);
assert.equal(s2.dst1Ok, true, 'Descriptor 1 phải đúng.');
assert.equal(s2.dst2BeforeSecond, true, 'Descriptor 2 chưa chạy trước xung start thứ hai.');
assert.equal(s2.dst2Ok, true, 'Descriptor 2 phải chạy đúng sau xung start thứ hai.');
assert.equal(s2.fifoLeft, 0, 'FIFO phải rỗng sau khi cả hai descriptor xong.');
realLog('  [PASS] start thứ hai kéo nốt descriptor đang chờ; cả hai vùng đều đúng');

realLog(`\n${SEP}`);
realLog('  Tất cả kịch bản descriptor FIFO đều PASS (một start = một descriptor; nối được khi có start mới).');
realLog(SEP);
