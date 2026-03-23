import assert from 'node:assert/strict';

import { TileLink_UH } from '../src/js/tilelink_UH.js';
import { TileLink_UL } from '../src/js/tilelink_UL.js';
import { Mem } from '../src/js/mem.js';
import { Cache } from '../src/js/cache.js';
import { DMAController, DMADescriptor } from '../src/js/dma.js';
import { MMU } from '../src/js/mmu.js';
import { TileLinkBridge } from '../src/js/tilelink_bridge.js';
import { TL_A_Opcode, TL_D_Opcode, TL_Param_Arithmetic, TL_Param_Logical } from '../src/js/tilelink.js';

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
        responses: [],
        receiveResponse(resp) {
            this.responses.push({ ...resp });
        }
    };
}

function tickPath(tilelink, target, count = 1) {
    for (let i = 0; i < count; i++) {
        tilelink.tick();
        target.tick(tilelink);
        tilelink.tick();
    }
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

function tickCacheUntil(cache, predicate, maxTicks = 16) {
    for (let i = 0; i < maxTicks; i++) {
        cache.tick();
        if (predicate()) return i + 1;
    }
    throw new Error('Timed out waiting for cache/MMU response');
}

function testUlReadWriteThroughCache() {
    const tilelink_UH = new TileLink_UH();
    const mem = new Mem();
    const cache = new Cache(mem, { cacheSize: 64, blockSize: 16, associativity: 1, numSets: 4, hitLatency: 1, missLatency: 1 }, null, { writeBack: false, writeAllocate: false });
    const master = makeMaster();

    tilelink_UH.registerMaster('m', master);
    tilelink_UH.registerSlave('cache', cache, () => true);

    tilelink_UH.sendRequest('m', { type: TL_A_Opcode.PutFullData, address: 0x100, value: 0x11223344, size: 2 });
    tickPath(tilelink_UH, cache, 4);
    tilelink_UH.sendRequest('m', { type: TL_A_Opcode.Get, address: 0x100, size: 2 });
    tickPath(tilelink_UH, cache, 4);

    assert.equal(master.responses[0].type, TL_D_Opcode.AccessAck);
    assert.equal(master.responses[1].type, TL_D_Opcode.AccessAckData);
    assert.equal(master.responses[1].data >>> 0, 0x11223344);
    assert.equal(readWord(mem.mem, 0x100) >>> 0, 0x11223344);
}

function testUlPartialWrite() {
    const tilelink_UH = new TileLink_UH();
    const mem = new Mem();
    const cache = new Cache(mem, { cacheSize: 64, blockSize: 16, associativity: 1, numSets: 4, hitLatency: 1, missLatency: 1 }, null, { writeBack: false, writeAllocate: false });
    const master = makeMaster();

    mem.loadMemoryMap({
        0x120: 0x44,
        0x121: 0x33,
        0x122: 0x22,
        0x123: 0x11
    });

    tilelink_UH.registerMaster('m', master);
    tilelink_UH.registerSlave('cache', cache, () => true);

    tilelink_UH.sendRequest('m', { type: TL_A_Opcode.PutPartialData, address: 0x121, value: 0xAA, size: 0 });
    tickPath(tilelink_UH, cache, 4);
    tilelink_UH.sendRequest('m', { type: TL_A_Opcode.Get, address: 0x120, size: 2 });
    tickPath(tilelink_UH, cache, 4);

    assert.equal(master.responses[0].type, TL_D_Opcode.AccessAck);
    assert.equal(master.responses[1].data >>> 0, 0x1122AA44);
}

function testUhAtomicsThroughCache() {
    const tilelink_UH = new TileLink_UH();
    const mem = new Mem();
    const cache = new Cache(mem, { cacheSize: 64, blockSize: 16, associativity: 1, numSets: 4, hitLatency: 1, missLatency: 1 }, null, { writeBack: false, writeAllocate: false });
    const master = makeMaster();

    mem.loadMemoryMap({
        0x200: 0x05,
        0x201: 0x00,
        0x202: 0x00,
        0x203: 0x00
    });

    tilelink_UH.registerMaster('m', master);
    tilelink_UH.registerSlave('cache', cache, () => true);

    tilelink_UH.sendRequest('m', { type: TL_A_Opcode.ArithmeticData, param: TL_Param_Arithmetic.ADD, address: 0x200, value: 3, size: 2 });
    tickPath(tilelink_UH, cache, 4);
    tilelink_UH.sendRequest('m', { type: TL_A_Opcode.LogicalData, param: TL_Param_Logical.OR, address: 0x200, value: 0x10, size: 2 });
    tickPath(tilelink_UH, cache, 4);

    assert.equal(master.responses[0].type, TL_D_Opcode.AccessAckData);
    assert.equal(master.responses[0].data >>> 0, 5);
    assert.equal(master.responses[1].type, TL_D_Opcode.AccessAckData);
    assert.equal(master.responses[1].data >>> 0, 8);
    assert.equal(readWord(mem.mem, 0x200) >>> 0, 0x18);
}

function testDmaByteTransfer() {
    const tilelink_UH = new TileLink_UH();
    const mem = new Mem();
    const cache = new Cache(mem, { cacheSize: 64, blockSize: 16, associativity: 1, numSets: 4, hitLatency: 1, missLatency: 1 }, null, { writeBack: false, writeAllocate: false });
    const dma = new DMAController(tilelink_UH);

    mem.loadMemoryMap({
        0x300: 1,
        0x301: 2,
        0x302: 3,
        0x303: 4
    });

    tilelink_UH.registerMaster('dma', dma);
    tilelink_UH.registerSlave('cache', cache, () => true);

    dma.start(0x300, 0x400, 4);

    for (let i = 0; i < 64 && (dma.isBusy || dma.registers.startRequested); i++) {
        dma.tick();
        tilelink_UH.tick();
        cache.tick(tilelink_UH);
        tilelink_UH.tick();
    }

    assert.equal(dma.isBusy, false);
    assert.deepEqual(readBytes(mem.mem, 0x400, 4), [1, 2, 3, 4]);
}

function testDmaWordIncrementingTransfer() {
    const tilelink_UH = new TileLink_UH();
    const mem = new Mem();
    const cache = new Cache(mem, { cacheSize: 128, blockSize: 16, associativity: 1, numSets: 8, hitLatency: 1, missLatency: 1 }, null, { writeBack: false, writeAllocate: false });
    const dma = new DMAController(tilelink_UH);

    mem.loadMemoryMap({
        0x500: 0x44, 0x501: 0x33, 0x502: 0x22, 0x503: 0x11,
        0x504: 0x88, 0x505: 0x77, 0x506: 0x66, 0x507: 0x55
    });

    tilelink_UH.registerMaster('dma', dma);
    tilelink_UH.registerSlave('cache', cache, () => true);

    dma.registers.writeCtrl(1);
    dma.registers.writeDescriptor(0x500);
    dma.registers.writeDescriptor(0x600);
    dma.registers.writeDescriptor(DMADescriptor.createConfig(2, 0, 3, 3));
    dma.registers.writeCtrl(3);

    for (let i = 0; i < 64 && (dma.isBusy || dma.registers.startRequested); i++) {
        dma.tick();
        tilelink_UH.tick();
        cache.tick(tilelink_UH);
        tilelink_UH.tick();
    }

    assert.equal(dma.isBusy, false);
    assert.equal(readWord(mem.mem, 0x600) >>> 0, 0x11223344);
    assert.equal(readWord(mem.mem, 0x604) >>> 0, 0x55667788);
}

function testDmaRegisterMmio() {
    const tilelink_UH = new TileLink_UH();
    const dma = new DMAController(tilelink_UH);
    const master = makeMaster();

    tilelink_UH.registerMaster('cpu', master);
    tilelink_UH.registerSlave('dma-regs', dma, () => true);

    tilelink_UH.sendRequest('cpu', { type: TL_A_Opcode.PutFullData, address: 0xFFED0000, value: 1, size: 2 });
    tilelink_UH.tick();
    dma.tick();
    tilelink_UH.tick();

    tilelink_UH.sendRequest('cpu', { type: TL_A_Opcode.Get, address: 0xFFED0000, size: 2 });
    tilelink_UH.tick();
    dma.tick();
    tilelink_UH.tick();

    assert.equal(master.responses[0].type, TL_D_Opcode.AccessAck);
    assert.equal(master.responses[1].type, TL_D_Opcode.AccessAckData);
    assert.equal(master.responses[1].data & 0x1, 1);
}

function testWriteBackDirtyEviction() {
    const tilelink_UH = new TileLink_UH();
    const mem = new Mem();
    const cache = new Cache(mem, { cacheSize: 32, blockSize: 16, associativity: 1, numSets: 2, hitLatency: 1, missLatency: 2 }, null, { writeBack: true, writeAllocate: true });
    const master = makeMaster();

    tilelink_UH.registerMaster('m', master);
    tilelink_UH.registerSlave('cache', cache, () => true);

    tilelink_UH.sendRequest('m', { type: TL_A_Opcode.PutFullData, address: 0x000, value: 0xAABBCCDD, size: 2 });
    const firstWriteTicks = tickUntil(tilelink_UH, cache, () => master.responses.length === 1);

    assert.equal(firstWriteTicks, 3);
    assert.equal(master.responses[0].type, TL_D_Opcode.AccessAck);
    assert.equal(readWord(mem.mem, 0x000) >>> 0, 0x00000000);

    tilelink_UH.sendRequest('m', { type: TL_A_Opcode.Get, address: 0x020, size: 2 });
    const evictionReadTicks = tickUntil(tilelink_UH, cache, () => master.responses.length === 2);

    assert.equal(evictionReadTicks, 5);
    assert.equal(master.responses[1].type, TL_D_Opcode.AccessAckData);
    assert.equal(master.responses[1].data >>> 0, 0x00000000);
    assert.equal(readWord(mem.mem, 0x000) >>> 0, 0xAABBCCDD);
    assert.equal(cache.statistics.totalCycles, 8);
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

    tilelink_UH.registerMaster('m', master);
    tilelink_UH.registerSlave('mem', mem, () => true);

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
    const mem = new Mem();
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

    tilelink_UH.registerSlave('mem', mem, (addr) => !uartRange(addr));
    tilelink_UH.registerSlave('uh-to-ul-bridge', uhToUlBridge, uartRange);
    tilelink_UH.attachMemoryTarget(mem);

    tilelink_UL.registerSlave('uart', uartEndpoint, uartRange);
    tilelink_UL.registerSlave('ul-to-uh-bridge', ulToUhBridge, (addr) => !uartRange(addr));
    tilelink_UL.attachMemoryTarget(mem);

    const cache = new Cache(tilelink_UH, { cacheSize: 64, blockSize: 16, associativity: 1, numSets: 4, hitLatency: 1, missLatency: 1 }, null, {
        writeBack: false,
        writeAllocate: false,
        isCacheable: (addr) => !uartRange(addr)
    });
    const mmu = new MMU(cpu, cache, { cacheabilityPredicate: (addr) => !uartRange(addr) });

    mmu.sendRequest('cpu', { type: TL_A_Opcode.Get, address: 0x40, size: 2 });
    tickCacheUntil(cache, () => cpu.responses.length === 1);

    mmu.sendRequest('cpu', { type: TL_A_Opcode.PutFullData, address: UART_BASE + 0x0C, value: 0x3, size: 2 });
    tickCacheUntil(cache, () => cpu.responses.length === 2);

    mmu.sendRequest('cpu', { type: TL_A_Opcode.Get, address: UART_BASE + 0x0C, size: 2 });
    tickCacheUntil(cache, () => cpu.responses.length === 3);

    assert.equal(cpu.responses[0].type, TL_D_Opcode.AccessAckData);
    assert.equal(cpu.responses[0].data >>> 0, 0x12345678);
    assert.equal(cpu.responses[1].type, TL_D_Opcode.AccessAck);
    assert.equal(cpu.responses[2].type, TL_D_Opcode.AccessAckData);
    assert.equal(cpu.responses[2].data >>> 0, 0x3);
}

testUlReadWriteThroughCache();
testUlPartialWrite();
testUhAtomicsThroughCache();
testDmaByteTransfer();
testDmaWordIncrementingTransfer();
testDmaRegisterMmio();
testWriteBackDirtyEviction();
testDirectMemoryLatency();
testMmuAndSplitBusRouting();

console.log('TileLink UL/UH verification passed.');
