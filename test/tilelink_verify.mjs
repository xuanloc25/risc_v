import assert from 'node:assert/strict';

import { TileLink_UH } from '../src/js/tilelink_UH.js';
import { TileLink_UL } from '../src/js/tilelink_UL.js';
import { Mem } from '../src/js/mem.js';
import { SimpleCache } from '../src/js/SimpleCache.js';
import { DMAController, DMADescriptor } from '../src/js/dma.js';
import { MMU } from '../src/js/mmu.js';
import { TileLinkBridge } from '../src/js/tilelink_bridge.js';
import { Port, attachPort } from '../src/js/port_link.js';
import { TL_A_Opcode, TL_D_Opcode, TL_Param_Arithmetic, TL_Param_Logical } from '../src/js/tilelink.js';

// Integration coverage for the on-chip fabric. Each case builds only the
// modules it needs so a failure points to one path: cache, DMA, MMIO bridge, or
// MMU-to-cache-to-bus routing.

function readWord(memMap, addr) {
    return ((memMap[addr + 3] ?? 0) << 24) |
        ((memMap[addr + 2] ?? 0) << 16) |
        ((memMap[addr + 1] ?? 0) << 8) |
        (memMap[addr] ?? 0);
}

function readBytes(memMap, addr, len) {
    return Array.from({ length: len }, (_, i) => memMap[addr + i] ?? 0);
}

function makeMaster() {
    return {
        upperPort: null,
        lowerPort: null,
        responses: [],
        attachUpperPort(upperPort) {
            this.upperPort = upperPort;
        },
        attachLowerPort(lowerPort) {
            this.lowerPort = lowerPort;
        },
        receiveResponse(resp) {
            this.responses.push({ ...resp });
        }
    };
}

function captureLogs(fn) {
    const originalLog = console.log;
    const logs = [];
    console.log = (...args) => {
        const line = args.map((arg) => String(arg)).join(' ');
        logs.push(line);
        originalLog(...args);
    };

    try {
        fn();
    } finally {
        console.log = originalLog;
    }

    return logs;
}

function createCache(options = {}) {
    return new SimpleCache({
        numSets: options.numSets ?? 4,
        numWays: options.numWays ?? 1,
        blockSize: options.blockSize ?? 16,
        hitLatency: options.hitLatency ?? 1,
        missLatency: options.missLatency ?? 1,
        name: options.name ?? 'test-cache',
        isCacheable: options.isCacheable ?? (() => true)
    });
}

function tickUntil(tilelink, target, predicate, maxTicks = 64) {
    for (let i = 0; i < maxTicks; i++) {
        tilelink.tick();
        target.tick(tilelink);
        tilelink.tick();
        if (predicate()) return i + 1;
    }
    throw new Error('Timed out waiting for bus response');
}

function tickCacheMemoryUntil(cache, mem, predicate, maxTicks = 64) {
    for (let i = 0; i < maxTicks; i++) {
        cache.tick();
        mem.tick(cache.lowerPort);
        cache.tick();
        if (predicate()) return i + 1;
    }
    throw new Error('Timed out waiting for cache/memory response');
}

function tickDmaMemoryUntil(dma, tilelink, mem, predicate, maxTicks = 128) {
    for (let i = 0; i < maxTicks; i++) {
        dma.tick();
        tilelink.tick();
        mem.tick(tilelink);
        tilelink.tick();
        if (predicate()) return i + 1;
    }
    throw new Error('Timed out waiting for DMA transfer');
}

function tickDmaFabricUntil({ dma, tilelink_UH, tilelink_UL, mem }, predicate, maxTicks = 128) {
    for (let i = 0; i < maxTicks; i++) {
        dma.tick();
        tilelink_UH.tick();
        tilelink_UL.tick();
        mem.tick(tilelink_UH);
        tilelink_UH.tick();
        tilelink_UL.tick();
        if (predicate()) return i + 1;
    }
    throw new Error('Timed out waiting for DMA fabric transfer');
}

function tickMmuCacheBusUntil({ cache, tilelink_UH, tilelink_UL, mem }, predicate, maxTicks = 128) {
    // Keep the tick order aligned with src/js/soc.js so the test exercises the
    // same request/response timing as the simulator.
    for (let i = 0; i < maxTicks; i++) {
        cache.tick();
        tilelink_UH.tick();
        tilelink_UL.tick();
        mem.tick(tilelink_UH);
        tilelink_UH.tick();
        tilelink_UL.tick();
        cache.tick();
        if (predicate()) return i + 1;
    }
    throw new Error('Timed out waiting for MMU/cache/bus response');
}

function issueCacheRequest(cache, master, req) {
    cache.receiveRequest({
        ...req,
        from: 'cpu',
        replyTo: master
    });
}

function testSimpleCacheReadWriteThroughMemory() {
    const mem = new Mem({ burstBeatLatency: 0 });
    const cache = createCache();
    const master = makeMaster();
    attachPort(cache, mem, 'cache-to-mem');

    issueCacheRequest(cache, master, {
        type: TL_A_Opcode.PutFullData,
        address: 0x100,
        value: 0x11223344,
        size: 2
    });
    tickCacheMemoryUntil(cache, mem, () => master.responses.length === 1);

    issueCacheRequest(cache, master, {
        type: TL_A_Opcode.Get,
        address: 0x100,
        size: 2
    });
    tickCacheMemoryUntil(cache, mem, () => master.responses.length === 2);

    assert.equal(master.responses[0].type, TL_D_Opcode.AccessAck);
    assert.equal(master.responses[1].type, TL_D_Opcode.AccessAckData);
    assert.equal(master.responses[1].data >>> 0, 0x11223344);
    assert.equal(readWord(mem.mem, 0x100) >>> 0, 0x11223344);
    assert.equal(cache.statistics.numMiss, 1);
    assert.equal(cache.statistics.numHit, 1);
}

function testSimpleCachePartialWrite() {
    const mem = new Mem({ burstBeatLatency: 0 });
    const cache = createCache();
    const master = makeMaster();
    attachPort(cache, mem, 'cache-to-mem');

    mem.loadMemoryMap({
        0x120: 0x44,
        0x121: 0x33,
        0x122: 0x22,
        0x123: 0x11
    });

    issueCacheRequest(cache, master, {
        type: TL_A_Opcode.PutPartialData,
        address: 0x121,
        value: 0xAA,
        size: 0
    });
    tickCacheMemoryUntil(cache, mem, () => master.responses.length === 1);

    issueCacheRequest(cache, master, {
        type: TL_A_Opcode.Get,
        address: 0x120,
        size: 2
    });
    tickCacheMemoryUntil(cache, mem, () => master.responses.length === 2);

    assert.equal(master.responses[0].type, TL_D_Opcode.AccessAck);
    assert.equal(master.responses[1].data >>> 0, 0x1122AA44);
    assert.equal(readWord(mem.mem, 0x120) >>> 0, 0x1122AA44);
}

// Atomics committed through the SimpleCache write-through path (ADD then OR).
// NOTE: this connects the cache directly to Mem, so it does NOT exercise a
// TileLink-UH bus — the UH-allows-atomics / UL-rejects-atomics opcode rule is
// covered in test/tilelink_backpressure_verify.mjs.
function testAtomicsThroughSimpleCache() {
    const mem = new Mem({ burstBeatLatency: 0 });
    const cache = createCache();
    const master = makeMaster();
    attachPort(cache, mem, 'cache-to-mem');

    mem.loadMemoryMap({
        0x200: 0x05,
        0x201: 0x00,
        0x202: 0x00,
        0x203: 0x00
    });

    issueCacheRequest(cache, master, {
        type: TL_A_Opcode.ArithmeticData,
        param: TL_Param_Arithmetic.ADD,
        address: 0x200,
        value: 3,
        size: 2
    });
    tickCacheMemoryUntil(cache, mem, () => master.responses.length === 1);

    issueCacheRequest(cache, master, {
        type: TL_A_Opcode.LogicalData,
        param: TL_Param_Logical.OR,
        address: 0x200,
        value: 0x10,
        size: 2
    });
    tickCacheMemoryUntil(cache, mem, () => master.responses.length === 2);

    assert.equal(master.responses[0].type, TL_D_Opcode.AccessAckData);
    assert.equal(master.responses[0].data >>> 0, 5);
    assert.equal(master.responses[1].type, TL_D_Opcode.AccessAckData);
    assert.equal(master.responses[1].data >>> 0, 8);
    assert.equal(readWord(mem.mem, 0x200) >>> 0, 0x18);
}

// Legacy dma.start() path: start(src,dst,4) builds createConfig(4,0,1,1,2,2),
// i.e. four 32-bit WORDS (16 bytes), increment mode — NOT a byte transfer.
// Only the first source word is seeded, so only the first dst word is checked.
function testDmaLegacyWordTransfer() {
    const tilelink_UH = new TileLink_UH();
    const mem = new Mem();
    const dma = new DMAController(tilelink_UH);

    mem.loadMemoryMap({
        0x300: 1,
        0x301: 2,
        0x302: 3,
        0x303: 4
    });

    attachPort(tilelink_UH, Port.upper('dma', dma));
    attachPort(tilelink_UH, Port.lower('mem', mem, () => true));

    const logs = captureLogs(() => {
        dma.start(0x300, 0x400, 4);
        tickDmaMemoryUntil(dma, tilelink_UH, mem, () => !dma.isBusy && !dma.registers.startRequested);
    });

    assert.equal(dma.isBusy, false);
    assert.deepEqual(readBytes(mem.mem, 0x400, 4), [1, 2, 3, 4]);
    assert.ok(logs.some((line) => line.includes('[DMA] TileLink route src=0x300 via=TileLink-UH dst=0x400 via=TileLink-UH')), 'DMA route log is missing');
    assert.ok(logs.some((line) => line.includes('[DMA] ISSUE_READ via=TileLink-UH')), 'DMA read issue log is missing');
    assert.ok(logs.some((line) => line.includes('[DMA] ISSUE_WRITE via=TileLink-UH')), 'DMA write issue log is missing');
    assert.ok(logs.some((line) => line.includes('[DMA] RECEIVE_RESPONSE via=TileLink-UH')), 'DMA response log is missing');
}

function testDmaWordIncrementingTransfer() {
    const tilelink_UH = new TileLink_UH();
    const mem = new Mem();
    const dma = new DMAController(tilelink_UH);

    mem.loadMemoryMap({
        0x500: 0x44, 0x501: 0x33, 0x502: 0x22, 0x503: 0x11,
        0x504: 0x88, 0x505: 0x77, 0x506: 0x66, 0x507: 0x55
    });

    attachPort(tilelink_UH, Port.upper('dma', dma));
    attachPort(tilelink_UH, Port.lower('mem', mem, () => true));

    dma.registers.writeCtrl(1);
    dma.registers.writeDescriptor(0x500);
    dma.registers.writeDescriptor(0x600);
    dma.registers.writeDescriptor(DMADescriptor.createConfig(2, 0, 1, 1, 2, 2));
    dma.registers.writeCtrl(3);

    tickDmaMemoryUntil(dma, tilelink_UH, mem, () => !dma.isBusy && !dma.registers.startRequested);

    assert.equal(dma.isBusy, false);
    assert.equal(readWord(mem.mem, 0x600) >>> 0, 0x11223344);
    assert.equal(readWord(mem.mem, 0x604) >>> 0, 0x55667788);
}

// Headline TileLink-UH feature: genuine multi-beat bursts. burstSize=1 =>
// maxBurstBeats = 4, so 8 increment-mode words become TWO 4-beat Get/PutFullData
// transactions (not a single-element loop). Verifies both the copied data AND
// that real multi-beat transactions were issued.
function testDmaMultiBeatBurst() {
    const tilelink_UH = new TileLink_UH();
    const mem = new Mem();
    const dma = new DMAController(tilelink_UH);

    const srcWords = [
        0x11223344, 0x55667788, 0x99aabbcc, 0xddeeff00,
        0x0a0b0c0d, 0x1a2b3c4d, 0xdeadbeef, 0xcafebabe
    ];
    const srcBase = 0x700, dstBase = 0x800;
    const memMap = {};
    srcWords.forEach((w, i) => {
        memMap[srcBase + i * 4] = w & 0xFF;
        memMap[srcBase + i * 4 + 1] = (w >>> 8) & 0xFF;
        memMap[srcBase + i * 4 + 2] = (w >>> 16) & 0xFF;
        memMap[srcBase + i * 4 + 3] = (w >>> 24) & 0xFF;
    });
    mem.loadMemoryMap(memMap);

    attachPort(tilelink_UH, Port.upper('dma', dma));
    attachPort(tilelink_UH, Port.lower('mem', mem, () => true));

    const logs = captureLogs(() => {
        dma.registers.writeCtrl(1);
        dma.registers.writeDescriptor(srcBase);
        dma.registers.writeDescriptor(dstBase);
        // numElements=8, inc/inc, word/word, burstSize=1 (=> 4 beats per burst)
        dma.registers.writeDescriptor(DMADescriptor.createConfig(8, 0, 1, 1, 2, 2, 1));
        dma.registers.writeCtrl(3);
        tickDmaMemoryUntil(dma, tilelink_UH, mem, () => !dma.isBusy && !dma.registers.startRequested);
    });

    assert.equal(dma.isBusy, false);
    // Every one of the 8 words must land contiguously at the destination.
    srcWords.forEach((w, i) => {
        assert.equal(readWord(mem.mem, dstBase + i * 4) >>> 0, w >>> 0, `burst word ${i} mismatch`);
    });
    // Prove genuine multi-beat transactions were issued (beats=4), not a fallback
    // loop of single-element transfers: 8 words / 4-beat bursts = 2 read + 2 write.
    const multiBeatReads = logs.filter((l) => l.includes('ISSUE_READ') && l.includes('beats=4')).length;
    const multiBeatWrites = logs.filter((l) => l.includes('ISSUE_WRITE') && l.includes('multi-beat')).length;
    assert.equal(multiBeatReads, 2, '8 words / 4-beat bursts = 2 multi-beat READ transactions on UH');
    assert.equal(multiBeatWrites, 2, '8 words / 4-beat bursts = 2 multi-beat WRITE transactions on UH');
}

function testDmaRegisterMmio() {
    const DMA_REG_BASE = 0xFFED0000;
    const dmaRegRange = (addr) => addr >= DMA_REG_BASE && addr < DMA_REG_BASE + 0x08;
    const tilelink_UH = new TileLink_UH();
    const tilelink_UL = new TileLink_UL();
    const dma = new DMAController({
        tilelink_UH,
        tilelink_UL,
        registerLink: tilelink_UL,
        selectLinkForAddress: () => tilelink_UH
    });
    const master = makeMaster();
    const uhToUlBridge = new TileLinkBridge(tilelink_UH, tilelink_UL, { name: 'uh-to-ul-bridge' });

    attachPort(tilelink_UH, Port.upper('cpu', master));
    attachPort(tilelink_UH, Port.lower('uh-to-ul-bridge', uhToUlBridge, dmaRegRange));
    attachPort(tilelink_UL, Port.lower('DMA Controller', dma, dmaRegRange));

    const logs = captureLogs(() => {
        tilelink_UH.sendRequest('cpu', { type: TL_A_Opcode.PutFullData, address: DMA_REG_BASE, value: 1, size: 2 });
        tilelink_UH.tick();

        tilelink_UH.sendRequest('cpu', { type: TL_A_Opcode.Get, address: DMA_REG_BASE, size: 2 });
        tilelink_UH.tick();
    });

    assert.equal(master.responses[0].type, TL_D_Opcode.AccessAck);
    assert.equal(master.responses[1].type, TL_D_Opcode.AccessAckData);
    // Decode the CTRL word (readCtrl in dma.js) instead of only the enable bit,
    // so a regression in any encoded field is caught. After a bare CTRL=1 write
    // (enable, no descriptor, no transfer): enabled=1 (bit0), fifoDepthLog2=3
    // (bits 16..19, log2 of the depth-8 descriptor FIFO), dataFifoEmpty=1
    // (bit24, no payload buffered), descriptor-FIFO-empty=1 (bit27).
    const ctrl = master.responses[1].data >>> 0;
    assert.equal(ctrl & 0x1, 1, 'CTRL enabled bit');
    assert.equal((ctrl >>> 16) & 0xF, 3, 'CTRL fifoDepthLog2 = log2(8) = 3');
    assert.equal((ctrl >>> 24) & 0x1, 1, 'CTRL dataFifoEmpty bit');
    assert.equal((ctrl >>> 27) & 0x1, 1, 'CTRL descriptor-FIFO-empty bit');
    assert.ok(logs.some((line) => line.includes('[uh-to-ul-bridge] BRIDGE_REQUEST TileLink-UH->TileLink-UL')), 'DMA config UH -> UL bridge request log is missing');
    assert.ok(logs.some((line) => line.includes('[TileLink-UL] TileLink -> DMA Controller DIRECT_WRITE')), 'DMA config UL -> DMA direct write log is missing');
    assert.ok(logs.some((line) => line.includes('[TileLink-UL] TileLink -> DMA Controller DIRECT_READ')), 'DMA config UL -> DMA direct read log is missing');
}

function testDmaIoUsesUhUlBridge() {
    const LED_BASE = 0xFF000000;
    const ledRange = (addr) => addr >= LED_BASE && addr < LED_BASE + 0x10;
    const tilelink_UH = new TileLink_UH();
    const tilelink_UL = new TileLink_UL();
    const mem = new Mem({ burstBeatLatency: 0, name: 'Main Memory' });
    const dma = new DMAController({
        tilelink_UH,
        tilelink_UL,
        registerLink: tilelink_UL,
        selectLinkForAddress: () => tilelink_UH
    });
    const ledWrites = [];
    const ledEndpoint = {
        directRead() {
            return 0;
        },
        directWrite(address, value, size, accessType) {
            ledWrites.push({ address: address >>> 0, value: value >>> 0, size, accessType });
        }
    };
    const uhToUlBridge = new TileLinkBridge(tilelink_UH, tilelink_UL, { name: 'uh-to-ul-bridge' });

    mem.loadMemoryMap({
        0x300: 0x44,
        0x301: 0x33,
        0x302: 0x22,
        0x303: 0x11
    });

    attachPort(tilelink_UH, Port.upper('dma', dma));
    attachPort(tilelink_UH, Port.lower('uh-to-ul-bridge', uhToUlBridge, ledRange));
    attachPort(tilelink_UH, Port.lower('Main Memory', mem, (addr) => !ledRange(addr)));

    attachPort(tilelink_UL, Port.lower('LED Matrix', ledEndpoint, ledRange));

    const logs = captureLogs(() => {
        dma.registers.writeCtrl(1);
        dma.registers.writeDescriptor(0x300);
        dma.registers.writeDescriptor(LED_BASE);
        dma.registers.writeDescriptor(DMADescriptor.createConfig(1, 0, 1, 1, 2, 2));
        dma.registers.writeCtrl(3);
        tickDmaFabricUntil({ dma, tilelink_UH, tilelink_UL, mem }, () => !dma.isBusy && ledWrites.length === 1);
    });

    assert.equal(ledWrites.length, 1);
    assert.equal(ledWrites[0].address >>> 0, LED_BASE >>> 0);
    assert.equal(ledWrites[0].value >>> 0, 0x11223344);
    assert.ok(logs.some((line) => line.includes('[DMA] TileLink route src=0x300 via=TileLink-UH dst=0xff000000 via=TileLink-UH')), 'DMA IO route should start on TileLink-UH');
    assert.ok(logs.some((line) => line.includes('[TileLink-UH] TileLink -> uh-to-ul-bridge REQUEST from=dma')), 'DMA IO UH -> UL bridge request log is missing');
    assert.ok(logs.some((line) => line.includes('[uh-to-ul-bridge] BRIDGE_DIRECT_WRITE TileLink-UH->TileLink-UL')), 'DMA IO UH -> UL direct write log is missing');
    assert.ok(logs.some((line) => line.includes('[TileLink-UL] TileLink -> LED Matrix DIRECT_WRITE')), 'DMA IO UL peripheral write log is missing');
    assert.ok(logs.some((line) => line.includes('[uh-to-ul-bridge] BRIDGE_RESPONSE TileLink-UL->TileLink-UH')), 'DMA IO UL -> UH bridge response log is missing');
    assert.ok(logs.some((line) => line.includes('[DMA] RECEIVE_RESPONSE via=TileLink-UH')), 'DMA IO response should return via TileLink-UH');
}

function testDirectMemoryLatency() {
    const tilelink_UH = new TileLink_UH();
    const mem = new Mem({ latency: 3 });
    const master = makeMaster();

    mem.loadMemoryMap({
        0x80: 0x78,
        0x81: 0x56,
        0x82: 0x34,
        0x83: 0x12
    });

    attachPort(tilelink_UH, Port.upper('m', master));
    attachPort(tilelink_UH, Port.lower('mem', mem, () => true));

    tilelink_UH.sendRequest('m', { type: TL_A_Opcode.Get, address: 0x80, size: 2 });
    const readTicks = tickUntil(tilelink_UH, mem, () => master.responses.length === 1);

    assert.equal(readTicks, 3);
    assert.equal(master.responses[0].type, TL_D_Opcode.AccessAckData);
    assert.equal(master.responses[0].data >>> 0, 0x12345678);
}

function testMmuAndSplitBusRouting() {
    const UART_BASE = 0x10000000;
    const uartRange = (addr) => addr >= UART_BASE && addr < UART_BASE + 0x14;

    const tilelink_UH = new TileLink_UH();
    const tilelink_UL = new TileLink_UL();
    const mem = new Mem({ burstBeatLatency: 0 });
    const cpu = makeMaster();

    let uartCtrl = 0;
    const uartEndpoint = {
        directRead(address) {
            const offset = (address >>> 0) - UART_BASE;
            if (offset === 0x0C) return uartCtrl >>> 0;
            return 0;
        },
        directWrite(address, value) {
            const offset = (address >>> 0) - UART_BASE;
            if (offset === 0x0C) uartCtrl = value >>> 0;
        },
        receiveRequest(req) {
            if (req.type === TL_A_Opcode.Get) {
                tilelink_UL.sendResponse({
                    from: 'uart',
                    to: req.from,
                    type: TL_D_Opcode.AccessAckData,
                    data: this.directRead(req.address),
                    address: req.address,
                    size: req.size
                });
            } else {
                this.directWrite(req.address, req.value ?? 0);
                tilelink_UL.sendResponse({
                    from: 'uart',
                    to: req.from,
                    type: TL_D_Opcode.AccessAck,
                    data: 0,
                    address: req.address,
                    size: req.size
                });
            }
        }
    };

    mem.loadMemoryMap({
        0x40: 0x78,
        0x41: 0x56,
        0x42: 0x34,
        0x43: 0x12
    });

    const uhToUlBridge = new TileLinkBridge(tilelink_UH, tilelink_UL, { name: 'uh-to-ul-bridge' });
    const ulToUhBridge = new TileLinkBridge(tilelink_UL, tilelink_UH, { name: 'ul-to-uh-bridge' });

    attachPort(tilelink_UH, Port.lower('mem', mem, (addr) => !uartRange(addr)));
    attachPort(tilelink_UH, Port.lower('uh-to-ul-bridge', uhToUlBridge, uartRange));
    attachPort(tilelink_UH, Port.memory('main-memory-view', mem));

    attachPort(tilelink_UL, Port.lower('uart', uartEndpoint, uartRange));
    attachPort(tilelink_UL, Port.lower('ul-to-uh-bridge', ulToUhBridge, (addr) => !uartRange(addr)));

    const cache = createCache({
        name: 'l1d-test',
        isCacheable: (addr) => !uartRange(addr)
    });
    const mmu = new MMU(null, null, { cacheabilityPredicate: (addr) => !uartRange(addr) });
    attachPort(cpu, mmu, 'cpu-to-mmu');
    attachPort(mmu, cache, 'mmu-to-cache');
    attachPort(cache, tilelink_UH, 'cache-to-uh');

    mmu.sendRequest('cpu', { type: TL_A_Opcode.Get, address: 0x40, size: 2 });
    tickMmuCacheBusUntil({ cache, tilelink_UH, tilelink_UL, mem }, () => cpu.responses.length === 1);

    mmu.sendRequest('cpu', { type: TL_A_Opcode.PutFullData, address: UART_BASE + 0x0C, value: 0x3, size: 2 });
    tickMmuCacheBusUntil({ cache, tilelink_UH, tilelink_UL, mem }, () => cpu.responses.length === 2);

    mmu.sendRequest('cpu', { type: TL_A_Opcode.Get, address: UART_BASE + 0x0C, size: 2 });
    tickMmuCacheBusUntil({ cache, tilelink_UH, tilelink_UL, mem }, () => cpu.responses.length === 3);

    assert.equal(cpu.responses[0].type, TL_D_Opcode.AccessAckData);
    assert.equal(cpu.responses[0].data >>> 0, 0x12345678);
    assert.equal(cpu.responses[1].type, TL_D_Opcode.AccessAck);
    assert.equal(cpu.responses[2].type, TL_D_Opcode.AccessAckData);
    assert.equal(cpu.responses[2].data >>> 0, 0x3);
}

function testTileLinkBridgeInteractionLogs() {
    const UART_BASE = 0x10000000;
    const uartRange = (addr) => addr >= UART_BASE && addr < UART_BASE + 0x14;

    const tilelink_UH = new TileLink_UH();
    const tilelink_UL = new TileLink_UL();
    const mem = new Mem({ burstBeatLatency: 0, name: 'Main Memory' });
    const uhMaster = makeMaster();
    const ulMaster = makeMaster();
    let uartCtrl = 0;

    const uartEndpoint = {
        directRead(address) {
            const offset = (address >>> 0) - UART_BASE;
            if (offset === 0x0C) return uartCtrl >>> 0;
            return 0;
        },
        directWrite(address, value) {
            const offset = (address >>> 0) - UART_BASE;
            if (offset === 0x0C) uartCtrl = value >>> 0;
        }
    };

    mem.loadMemoryMap({
        0x40: 0x78,
        0x41: 0x56,
        0x42: 0x34,
        0x43: 0x12
    });

    const uhToUlBridge = new TileLinkBridge(tilelink_UH, tilelink_UL, { name: 'uh-to-ul-bridge' });
    const ulToUhBridge = new TileLinkBridge(tilelink_UL, tilelink_UH, { name: 'ul-to-uh-bridge' });

    attachPort(tilelink_UH, Port.upper('cpu', uhMaster));
    attachPort(tilelink_UH, Port.lower('uh-to-ul-bridge', uhToUlBridge, uartRange));
    attachPort(tilelink_UH, Port.lower('Main Memory', mem, (addr) => !uartRange(addr)));

    attachPort(tilelink_UL, Port.upper('ul-master', ulMaster));
    attachPort(tilelink_UL, Port.lower('UART', uartEndpoint, uartRange));
    attachPort(tilelink_UL, Port.lower('ul-to-uh-bridge', ulToUhBridge, (addr) => !uartRange(addr)));

    const logs = captureLogs(() => {
        tilelink_UH.sendRequest('cpu', { type: TL_A_Opcode.PutFullData, address: UART_BASE + 0x0C, value: 0x3, size: 2 });
        tilelink_UH.tick();

        tilelink_UL.sendRequest('ul-master', { type: TL_A_Opcode.Get, address: 0x40, size: 2 });
        tilelink_UL.tick();
    });

    assert.equal(uartCtrl >>> 0, 0x3);
    assert.equal(uhMaster.responses[0].type, TL_D_Opcode.AccessAck);
    assert.equal(ulMaster.responses[0].type, TL_D_Opcode.AccessAckData);
    assert.equal(ulMaster.responses[0].data >>> 0, 0x12345678);
    assert.ok(logs.some((line) => line.includes('[uh-to-ul-bridge] BRIDGE_REQUEST TileLink-UH->TileLink-UL')), 'UH -> UL bridge request log is missing');
    assert.ok(logs.some((line) => line.includes('[uh-to-ul-bridge] BRIDGE_DIRECT_WRITE TileLink-UH->TileLink-UL')), 'UH -> UL direct write log is missing');
    assert.ok(logs.some((line) => line.includes('[ul-to-uh-bridge] BRIDGE_REQUEST TileLink-UL->TileLink-UH')), 'UL -> UH bridge request log is missing');
    assert.ok(logs.some((line) => line.includes('[ul-to-uh-bridge] BRIDGE_DIRECT_READ TileLink-UL->TileLink-UH')), 'UL -> UH direct read log is missing');
}

function testMmuL2TileLinkMemoryLogs() {
    const tilelink_UH = new TileLink_UH();
    const mem = new Mem({ burstBeatLatency: 0, name: 'Main Memory' });
    const cpu = makeMaster();
    const mmu = new MMU();
    const l2Cache = createCache({ name: 'L2 Cache' });

    mem.loadMemoryMap({
        0x40: 0x78,
        0x41: 0x56,
        0x42: 0x34,
        0x43: 0x12
    });

    attachPort(cpu, mmu, 'cpu-to-mmu');
    attachPort(mmu, l2Cache, 'mmu-to-l2');
    attachPort(l2Cache, tilelink_UH, 'l2-to-tilelink-uh');
    attachPort(tilelink_UH, Port.lower('Main Memory', mem, () => true));

    const logs = captureLogs(() => {
        mmu.sendRequest('cpu', { type: TL_A_Opcode.Get, address: 0x40, size: 2 });
        tickMmuCacheBusUntil({ cache: l2Cache, tilelink_UH, tilelink_UL: { tick() {} }, mem }, () => cpu.responses.length === 1);
    });

    assert.ok(logs.some((line) => line.includes('[MMU] REQUEST')), 'MMU request log is missing');
    assert.ok(logs.some((line) => line.includes('REFILL_REQUEST')), 'L2 -> TileLink request log is missing');
    assert.ok(logs.some((line) => line.includes('TileLink -> Main Memory REQUEST')), 'TileLink -> Main Memory request log is missing');
    assert.ok(logs.some((line) => line.includes('Main Memory -> TileLink-UH RESPONSE')), 'Main Memory -> TileLink response log is missing');
    assert.ok(logs.some((line) => line.includes('TileLink -> L2 Cache RESPONSE')), 'TileLink -> L2 response log is missing');
    assert.ok(logs.some((line) => line.includes('[MMU] RESPONSE')), 'MMU response log is missing');

    assert.equal(cpu.responses[0].data >>> 0, 0x12345678);
}

testSimpleCacheReadWriteThroughMemory();
testSimpleCachePartialWrite();
testAtomicsThroughSimpleCache();
testDmaLegacyWordTransfer();
testDmaWordIncrementingTransfer();
testDmaMultiBeatBurst();
testDmaRegisterMmio();
testDmaIoUsesUhUlBridge();
testDirectMemoryLatency();
testMmuAndSplitBusRouting();
testTileLinkBridgeInteractionLogs();
testMmuL2TileLinkMemoryLogs();

console.log('TileLink UL/UH verification passed.');
