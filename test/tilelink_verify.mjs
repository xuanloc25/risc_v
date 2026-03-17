import assert from 'node:assert/strict';

import { Bus } from '../src/js/bus.js';
import { Mem } from '../src/js/mem.js';
import { Cache } from '../src/js/cache.js';
import { DMAController, DMADescriptor } from '../src/js/dma.js';
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

function tickPath(bus, target, count = 1) {
    for (let i = 0; i < count; i++) {
        bus.tick();
        target.tick(bus);
        bus.tick();
    }
}

function testUlReadWriteThroughCache() {
    const bus = new Bus();
    const mem = new Mem();
    const cache = new Cache(mem, { cacheSize: 64, blockSize: 16, associativity: 1, numSets: 4, hitLatency: 1, missLatency: 1 }, null, { writeBack: false, writeAllocate: false });
    const master = makeMaster();

    bus.registerMaster('m', master);
    bus.registerSlave('cache', cache, () => true);

    bus.sendRequest('m', { type: TL_A_Opcode.PutFullData, address: 0x100, value: 0x11223344, size: 2 });
    tickPath(bus, cache, 4);
    bus.sendRequest('m', { type: TL_A_Opcode.Get, address: 0x100, size: 2 });
    tickPath(bus, cache, 4);

    assert.equal(master.responses[0].type, TL_D_Opcode.AccessAck);
    assert.equal(master.responses[1].type, TL_D_Opcode.AccessAckData);
    assert.equal(master.responses[1].data >>> 0, 0x11223344);
    assert.equal(readWord(mem.mem, 0x100) >>> 0, 0x11223344);
}

function testUlPartialWrite() {
    const bus = new Bus();
    const mem = new Mem();
    const cache = new Cache(mem, { cacheSize: 64, blockSize: 16, associativity: 1, numSets: 4, hitLatency: 1, missLatency: 1 }, null, { writeBack: false, writeAllocate: false });
    const master = makeMaster();

    mem.loadMemoryMap({
        0x120: 0x44,
        0x121: 0x33,
        0x122: 0x22,
        0x123: 0x11
    });

    bus.registerMaster('m', master);
    bus.registerSlave('cache', cache, () => true);

    bus.sendRequest('m', { type: TL_A_Opcode.PutPartialData, address: 0x121, value: 0xAA, size: 0 });
    tickPath(bus, cache, 4);
    bus.sendRequest('m', { type: TL_A_Opcode.Get, address: 0x120, size: 2 });
    tickPath(bus, cache, 4);

    assert.equal(master.responses[0].type, TL_D_Opcode.AccessAck);
    assert.equal(master.responses[1].data >>> 0, 0x1122AA44);
}

function testUhAtomicsThroughCache() {
    const bus = new Bus();
    const mem = new Mem();
    const cache = new Cache(mem, { cacheSize: 64, blockSize: 16, associativity: 1, numSets: 4, hitLatency: 1, missLatency: 1 }, null, { writeBack: false, writeAllocate: false });
    const master = makeMaster();

    mem.loadMemoryMap({
        0x200: 0x05,
        0x201: 0x00,
        0x202: 0x00,
        0x203: 0x00
    });

    bus.registerMaster('m', master);
    bus.registerSlave('cache', cache, () => true);

    bus.sendRequest('m', { type: TL_A_Opcode.ArithmeticData, param: TL_Param_Arithmetic.ADD, address: 0x200, value: 3, size: 2 });
    tickPath(bus, cache, 4);
    bus.sendRequest('m', { type: TL_A_Opcode.LogicalData, param: TL_Param_Logical.OR, address: 0x200, value: 0x10, size: 2 });
    tickPath(bus, cache, 4);

    assert.equal(master.responses[0].type, TL_D_Opcode.AccessAckData);
    assert.equal(master.responses[0].data >>> 0, 5);
    assert.equal(master.responses[1].type, TL_D_Opcode.AccessAckData);
    assert.equal(master.responses[1].data >>> 0, 8);
    assert.equal(readWord(mem.mem, 0x200) >>> 0, 0x18);
}

function testDmaByteTransfer() {
    const bus = new Bus();
    const mem = new Mem();
    const cache = new Cache(mem, { cacheSize: 64, blockSize: 16, associativity: 1, numSets: 4, hitLatency: 1, missLatency: 1 }, null, { writeBack: false, writeAllocate: false });
    const dma = new DMAController(bus);

    mem.loadMemoryMap({
        0x300: 1,
        0x301: 2,
        0x302: 3,
        0x303: 4
    });

    bus.registerMaster('dma', dma);
    bus.registerSlave('cache', cache, () => true);

    dma.start(0x300, 0x400, 4);

    for (let i = 0; i < 64 && (dma.isBusy || dma.registers.startRequested); i++) {
        dma.tick();
        bus.tick();
        cache.tick(bus);
        bus.tick();
    }

    assert.equal(dma.isBusy, false);
    assert.deepEqual(readBytes(mem.mem, 0x400, 4), [1, 2, 3, 4]);
}

function testDmaWordIncrementingTransfer() {
    const bus = new Bus();
    const mem = new Mem();
    const cache = new Cache(mem, { cacheSize: 128, blockSize: 16, associativity: 1, numSets: 8, hitLatency: 1, missLatency: 1 }, null, { writeBack: false, writeAllocate: false });
    const dma = new DMAController(bus);

    mem.loadMemoryMap({
        0x500: 0x44, 0x501: 0x33, 0x502: 0x22, 0x503: 0x11,
        0x504: 0x88, 0x505: 0x77, 0x506: 0x66, 0x507: 0x55
    });

    bus.registerMaster('dma', dma);
    bus.registerSlave('cache', cache, () => true);

    dma.registers.writeCtrl(1);
    dma.registers.writeDescriptor(0x500);
    dma.registers.writeDescriptor(0x600);
    dma.registers.writeDescriptor(DMADescriptor.createConfig(2, 0, 3, 3));
    dma.registers.writeCtrl(3);

    for (let i = 0; i < 64 && (dma.isBusy || dma.registers.startRequested); i++) {
        dma.tick();
        bus.tick();
        cache.tick(bus);
        bus.tick();
    }

    assert.equal(dma.isBusy, false);
    assert.equal(readWord(mem.mem, 0x600) >>> 0, 0x11223344);
    assert.equal(readWord(mem.mem, 0x604) >>> 0, 0x55667788);
}

function testDmaRegisterMmio() {
    const bus = new Bus();
    const dma = new DMAController(bus);
    const master = makeMaster();

    bus.registerMaster('cpu', master);
    bus.registerSlave('dma-regs', dma, () => true);

    bus.sendRequest('cpu', { type: TL_A_Opcode.PutFullData, address: 0xFFED0000, value: 1, size: 2 });
    bus.tick();
    dma.tick();
    bus.tick();

    bus.sendRequest('cpu', { type: TL_A_Opcode.Get, address: 0xFFED0000, size: 2 });
    bus.tick();
    dma.tick();
    bus.tick();

    assert.equal(master.responses[0].type, TL_D_Opcode.AccessAck);
    assert.equal(master.responses[1].type, TL_D_Opcode.AccessAckData);
    assert.equal(master.responses[1].data & 0x1, 1);
}

testUlReadWriteThroughCache();
testUlPartialWrite();
testUhAtomicsThroughCache();
testDmaByteTransfer();
testDmaWordIncrementingTransfer();
testDmaRegisterMmio();

console.log('TileLink UL/UH verification passed.');
