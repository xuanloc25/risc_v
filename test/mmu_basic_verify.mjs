import assert from 'node:assert/strict';

import { MMU } from '../src/js/mmu.js';
import { TL_A_Opcode, TL_D_Opcode } from '../src/js/tilelink.js';

function testIdentityFallback() {
    const mmu = new MMU(null, null, {
        cacheabilityPredicate: (addr) => addr < 0x80000000
    });

    const translated = mmu.translateAddress(0x1234, 'read');

    assert.equal(translated.mode, 'identity');
    assert.equal(translated.virtualAddress >>> 0, 0x1234);
    assert.equal(translated.physicalAddress >>> 0, 0x1234);
    assert.equal(translated.cacheable, true);
    assert.equal(mmu.stats.translations, 1);
    assert.equal(mmu.stats.identityFallbacks, 1);

    console.log('[MMU] identity fallback test passed');
}

function testMappedTranslationWithTlbRefill() {
    const mmu = new MMU();

    mmu.mapPage(0x4000, 0x8000, {
        read: true,
        write: true,
        execute: true,
        cacheable: true
    });

    // Clear the TLB but keep the page table so the first access becomes
    // a software page-table hit and refills the tiny TLB.
    mmu.reset();

    const first = mmu.translateAddress(0x4123, 'read');
    assert.equal(first.mode, 'mapped');
    assert.equal(first.physicalAddress >>> 0, 0x8123);
    assert.equal(mmu.stats.pageTableHits, 1);
    assert.equal(mmu.stats.tlbHits, 0);

    const second = mmu.translateAddress(0x4128, 'read');
    assert.equal(second.mode, 'mapped');
    assert.equal(second.physicalAddress >>> 0, 0x8128);
    assert.equal(mmu.stats.pageTableHits, 1);
    assert.equal(mmu.stats.tlbHits, 1);

    console.log('[MMU] mapped translation + TLB refill test passed');
}

function testPermissionFaults() {
    const mmu = new MMU();

    mmu.mapPage(0x9000, 0xA000, {
        read: true,
        write: false,
        execute: false
    });

    assert.throws(
        () => mmu.translateAddress(0x9004, 'write'),
        /MMU write fault/
    );

    assert.throws(
        () => mmu.translateAddress(0x9008, 'execute'),
        /MMU execute fault/
    );

    const allowedRead = mmu.translateAddress(0x900C, 'read');
    assert.equal(allowedRead.physicalAddress >>> 0, 0xA00C);

    console.log('[MMU] permission fault test passed');
}

function testRequestAndResponsePath() {
    const captured = {
        lowerReq: null,
        upperResp: null
    };

    const lowerPort = {
        receiveRequest(req) {
            captured.lowerReq = { ...req };
        }
    };

    const upperPort = {
        receiveResponse(resp) {
            captured.upperResp = { ...resp };
        }
    };

    const mmu = new MMU(upperPort, lowerPort, {
        cacheabilityPredicate: (addr) => addr < 0x10000000
    });

    mmu.mapPage(0x1000, 0x2000, {
        read: true,
        write: true,
        execute: true,
        cacheable: true
    });

    mmu.sendRequest('cpu', {
        type: TL_A_Opcode.Get,
        address: 0x1010,
        size: 2
    });

    assert.ok(captured.lowerReq);
    assert.equal(captured.lowerReq.from, 'cpu');
    assert.equal(captured.lowerReq.virtualAddress >>> 0, 0x1010);
    assert.equal(captured.lowerReq.address >>> 0, 0x2010);
    assert.equal(captured.lowerReq.cacheable, true);
    assert.equal(captured.lowerReq.replyTo, mmu);
    assert.equal(captured.lowerReq.translation.mode, 'mapped');

    mmu.receiveResponse({
        from: 'memory',
        to: 'cpu',
        type: TL_D_Opcode.AccessAckData,
        data: 0xDEADBEEF,
        address: 0x2010,
        virtualAddress: 0x1010,
        size: 2
    });

    assert.ok(captured.upperResp);
    assert.equal(captured.upperResp.type, TL_D_Opcode.AccessAckData);
    assert.equal(captured.upperResp.data >>> 0, 0xDEADBEEF);
    assert.equal(captured.upperResp.address >>> 0, 0x1010);

    console.log('[MMU] request/response path test passed');
}

function testAttachCpuConnectsBothDirections() {
    const cpu = {
        upperPort: null,
        lowerPort: null,
        attachUpperPort(upperPort) {
            this.upperPort = upperPort;
        },
        attachLowerPort(lowerPort) {
            this.lowerPort = lowerPort;
        },
        receiveResponse() {}
    };

    const mmu = new MMU();

    mmu.attachCPU(cpu);

    assert.ok(cpu.lowerPort);
    assert.equal(cpu.lowerPort.lower, mmu);
    assert.equal(mmu.upperPort, cpu.lowerPort);
    assert.equal(mmu.upperPort.upper, cpu);

    console.log('[MMU] attachCPU bi-directional wiring test passed');
}

function main() {
    testIdentityFallback();
    testMappedTranslationWithTlbRefill();
    testPermissionFaults();
    testRequestAndResponsePath();
    testAttachCpuConnectsBothDirections();

    console.log('Basic MMU verification passed.');
}

main();
