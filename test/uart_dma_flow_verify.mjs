/**
 * uart_dma_flow_verify.mjs — DMA -> UART flow control (backpressure)
 *
 * Trước đây DMA ghi 65 byte ra UART nhanh hơn tốc độ phát, nên FIFO TX (16 byte)
 * đầy và các byte thừa bị "dropping" — chỉ ~16/65 byte thực sự ra ngoài.
 *
 * Sau khi thêm backpressure ở kênh A của TileLink (slave.canAccept), DMA sẽ:
 *   - đẩy byte vào UART cho tới khi FIFO đầy (16),
 *   - stall (giữ request trên bus, a_ready = 0),
 *   - UART phát xong 1 byte (FIFO còn 15) -> DMA đẩy tiếp ngay,
 *   - lặp lại cho tới khi đủ 65 byte, KHÔNG mất byte nào.
 *
 * Chạy: node test/uart_dma_flow_verify.mjs
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assembler } from '../src/js/assembler.js';
import { simulator } from '../src/js/soc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Lấy chuỗi msg trực tiếp từ file demo để test luôn khớp với chương trình thật.
const source = readFileSync(path.join(__dirname, 'demo_uart_dma.asm'), 'utf8');
const asciiMatch = source.match(/\.ascii\s+"([^"]*)"/);
assert.ok(asciiMatch, 'Không tìm thấy chuỗi .ascii trong demo_uart_dma.asm');
const MESSAGE = asciiMatch[1];
console.log(`Message: "${MESSAGE}" (${MESSAGE.length} bytes)`);

simulator.init();
simulator.loadProgram(assembler.assemble(source));

// Đếm số byte bị UART loại bỏ (drop). Backpressure đúng => phải = 0.
let droppedBytes = 0;
const origWarn = console.warn;
console.warn = (...args) => {
    if (String(args[0] ?? '').includes('TX queue full')) droppedBytes++;
    return origWarn.apply(console, args);
};

// Theo dõi: có thực sự xảy ra stall do FIFO đầy hay không, và mức FIFO cao nhất.
let fifoHighWater = 0;
let sawFullStall = false;
let prevProgress = 0;
let stalledWhileFullCycles = 0;

const maxCycles = 300000;
let cycles = 0;
while ((simulator.cpu.isRunning || simulator.dma.isBusy) && cycles < maxCycles) {
    simulator.tick();
    cycles++;

    const queued = simulator.uart.txQueue.length;
    if (queued > fifoHighWater) fifoHighWater = queued;

    const fifoFull = !simulator.uart.canAcceptTx();
    const progress = simulator.dma.transferProgress;
    if (fifoFull) sawFullStall = true;
    // DMA đang bận, FIFO đầy, mà tiến độ không tăng => đó chính là lúc DMA stall.
    if (simulator.dma.isBusy && fifoFull && progress === prevProgress) {
        stalledWhileFullCycles++;
    }
    prevProgress = progress;
}

console.warn = origWarn;

assert.ok(cycles < maxCycles, `Mô phỏng không kết thúc trong ${maxCycles} cycle (cycles=${cycles}).`);

const transmitted = simulator.uart.getTransmittedText();
console.log(`\n[Kết quả sau ${cycles} cycle]`);
console.log(`  Bytes transmitted : ${simulator.uart.txBuffer.length}/${MESSAGE.length}`);
console.log(`  Bytes dropped     : ${droppedBytes}`);
console.log(`  FIFO high-water   : ${fifoHighWater}/${simulator.uart.txQueueDepth}`);
console.log(`  Stall-while-full  : ${sawFullStall ? 'yes' : 'no'} (${stalledWhileFullCycles} cycle)`);
console.log(`  Transmitted text  : "${transmitted}"`);

// 1) Không được mất byte nào.
assert.equal(droppedBytes, 0, 'UART vẫn còn drop byte — backpressure chưa chặn được.');

// 2) Phải phát ĐỦ cả 65 byte, đúng nội dung.
assert.equal(
    simulator.uart.txBuffer.length,
    MESSAGE.length,
    `Chỉ phát ${simulator.uart.txBuffer.length}/${MESSAGE.length} byte ra UART.`
);
assert.equal(transmitted, MESSAGE, 'Nội dung phát ra UART không khớp message nguồn.');

// 3) Phải thực sự đã đầy FIFO và stall (chứng minh đúng cơ chế fill->stall->drain).
//
// PHỤ THUỘC NGẦM: hai assertion cơ chế bên dưới (FIFO high-water === txQueueDepth
// và stalledWhileFullCycles > 0) CHỈ đúng khi UART phát thật nhanh để FIFO kịp đầy.
// demo_uart_dma.asm đạt điều này bằng cách ghi BAUD divisor = 1
// (li t4, 1 ; sw t4, 16(t1) -> UART_BAUD offset 0x10). Mặc định divisor = 26 (chậm),
// nếu chậm thì FIFO drain kịp, không bao giờ đầy -> không stall -> các assertion dưới SAI.
// Vì vậy phải kiểm tra divisor === 1 TRƯỚC, để một lần sửa baud trong asm sau này
// (vô tình làm UART chậm lại) sẽ bị bắt ngay tại đây thay vì âm thầm vô hiệu hoá cơ chế.
assert.equal(
    simulator.uart.baudDivisor,
    1,
    `UART baud divisor = ${simulator.uart.baudDivisor} (kỳ vọng 1). ` +
    `demo_uart_dma.asm phải ghi divisor = 1 để FIFO TX kịp đầy và DMA stall. ` +
    `Nếu sửa dòng baud trong asm làm UART chậm lại, các assertion cơ chế ` +
    `(FIFO high-water === txQueueDepth, stalledWhileFullCycles > 0) sẽ không còn ý nghĩa.`
);
assert.equal(fifoHighWater, simulator.uart.txQueueDepth, 'FIFO TX chưa từng đầy — luồng không như mô tả.');
assert.ok(sawFullStall && stalledWhileFullCycles > 0, 'DMA không hề stall khi FIFO đầy.');

console.log('\n[PASS] DMA -> UART flow control: đủ 65 byte, 0 byte mất, có fill/stall/drain đúng.');
