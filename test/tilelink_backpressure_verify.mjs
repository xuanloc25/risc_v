import assert from 'node:assert/strict';

import { TileLink_UH } from '../src/js/tilelink_UH.js';
import { TileLink_UL } from '../src/js/tilelink_UL.js';
import { TL_A_Opcode, TL_D_Opcode, TL_Param_Arithmetic } from '../src/js/tilelink.js';

// Unit coverage for the TileLink A-channel canAccept backpressure hook in
// src/js/tilelink_base.js, exercised on a bare bus with fake master/slave so a
// failure points only at the fabric (no SoC, cache, DMA, or memory involved).
//
// Tick model recap (tilelink_base.js tick()):
//   1. cycle++
//   2. signals.a.ready = !inFlight
//   3. if (!inFlight && requestQueue.length): shift, _validateRequest (throws on
//      disallowed numeric opcode), latch as inFlight, _inFlightForwarded=false,
//      _forwardAt = cycle + latency, snapshot A channel
//   4. if (inFlight && !_inFlightForwarded && cycle >= _forwardAt): select slave.
//      If slave.canAccept exists AND returns false -> signals.a.ready=false and
//      DO NOT forward (so _inFlightForwarded stays false, inFlight stays set).
//      Else trace + slave.receiveRequest(req) once + _inFlightForwarded=true.
//   5. if (!inFlight): clear A channel, a.ready=true
//   6. drain one response from responseQueue; if resp.lastBeat !== false, clear
//      inFlight.
// latency=0 is used throughout so the forward block runs on the SAME tick the
// request is latched, making cycle counts deterministic.

// A fake master that simply records every response routed back to it. Mirrors
// makeMaster() in tilelink_verify.mjs; the bus calls receiveResponse via
// _resolveResponseTarget (registered by name through attachUpperPort).
function makeMaster() {
    return {
        responses: [],
        receiveResponse(resp) {
            this.responses.push({ ...resp });
        }
    };
}

// A fake slave with a configurable canAccept gate and a counter of how many
// times the bus forwarded a request to it. When it does accept, it pushes an
// AccessAck (or AccessAckData for Get) onto the bus response queue so the
// response can be observed reaching the master.
function makeGatedSlave(bus, { canAccept } = {}) {
    const slave = {
        receiveCount: 0,
        lastReq: null,
        receiveRequest(req) {
            this.receiveCount++;
            this.lastReq = { ...req };
            const isGet = req.type === TL_A_Opcode.Get;
            bus.sendResponse({
                from: 'slave',
                to: req.from,
                type: isGet ? TL_D_Opcode.AccessAckData : TL_D_Opcode.AccessAck,
                data: isGet ? 0xCAFEBABE : 0,
                address: req.address,
                size: req.size
            });
        }
    };
    if (typeof canAccept === 'function') {
        slave.canAccept = canAccept;
    }
    return slave;
}

// Silence the very chatty per-cycle bus logging so the test output stays
// readable; the bus only writes via console.log.
function withQuietLogs(fn) {
    const originalLog = console.log;
    console.log = () => {};
    try {
        return fn();
    } finally {
        console.log = originalLog;
    }
}

// Scenario 1: a slave that is gated (canAccept=false) for the first N ticks,
// then opens up. While gated, the bus must hold the request on the fabric:
// receiveRequest is never called, a.ready stays false, inFlight stays set. On
// the cycle the gate opens, receiveRequest fires exactly once and the response
// reaches the master.
function testGatedSlaveHoldsThenForwards() {
    const GATED_TICKS = 3; // canAccept returns false for ticks 1..3, true from 4
    const bus = new TileLink_UH('TileLink-UH-bp', { latency: 0 });
    const master = makeMaster();
    let canAcceptCalls = 0;
    const slave = makeGatedSlave(bus, {
        canAccept() {
            canAcceptCalls++;
            // bus.cycle was already incremented at the top of tick() before the
            // forward block calls canAccept, so cycle 1..GATED_TICKS are gated.
            return bus.cycle > GATED_TICKS;
        }
    });

    bus.attachUpperPort('m', master);
    bus.attachLowerPort('gated', slave, () => true);

    bus.sendRequest('m', { type: TL_A_Opcode.PutFullData, address: 0x100, value: 0x11223344, size: 2 });

    withQuietLogs(() => {
        // Tick through the gated window. Each tick the bus should retry the
        // forward, find canAccept false, and stall.
        for (let t = 1; t <= GATED_TICKS; t++) {
            bus.tick();
            assert.equal(slave.receiveCount, 0, `slave must not receive while gated (tick ${t})`);
            assert.equal(bus.signals.a.ready, false, `a.ready must be deasserted while gated (tick ${t})`);
            assert.ok(bus.inFlight !== null, `request must stay inFlight while gated (tick ${t})`);
            assert.equal(bus.inFlight.type, TL_A_Opcode.PutFullData, `the held request is the original Put (tick ${t})`);
            assert.equal(master.responses.length, 0, `no response while gated (tick ${t})`);
        }

        // The cycle the gate opens (cycle GATED_TICKS+1): forward fires once.
        bus.tick();
    });

    // Forward happened exactly once even though canAccept was polled every tick.
    assert.equal(slave.receiveCount, 1, 'slave.receiveRequest must fire exactly once after gate opens');
    assert.equal(slave.lastReq.type, TL_A_Opcode.PutFullData);
    assert.equal(slave.lastReq.address >>> 0, 0x100);
    // canAccept was polled GATED_TICKS times (false) + 1 (true) = GATED_TICKS+1.
    assert.equal(canAcceptCalls, GATED_TICKS + 1, 'canAccept polled once per tick until it opens');

    // The slave queued a response on the same tick it forwarded; the response
    // queue is drained later in that very tick (step 6 runs after forwarding),
    // so the master already has its AccessAck.
    assert.equal(master.responses.length, 1, 'response reaches the master once the gate opens');
    assert.equal(master.responses[0].type, TL_D_Opcode.AccessAck);
    // After lastBeat response, inFlight is cleared.
    assert.equal(bus.inFlight, null, 'inFlight cleared after the (lastBeat) response drains');
}

// Scenario 2: an ungated slave with NO canAccept method is forwarded
// immediately, proving the hook is opt-in (the typeof check in tick() is the
// guard).
function testUngatedSlaveForwardsImmediately() {
    const bus = new TileLink_UH('TileLink-UH-open', { latency: 0 });
    const master = makeMaster();
    const slave = makeGatedSlave(bus); // no canAccept passed -> property absent

    assert.equal(typeof slave.canAccept, 'undefined', 'precondition: slave has no canAccept');

    bus.attachUpperPort('m', master);
    bus.attachLowerPort('open', slave, () => true);

    bus.sendRequest('m', { type: TL_A_Opcode.PutFullData, address: 0x200, value: 0xDEADBEEF, size: 2 });

    withQuietLogs(() => {
        bus.tick(); // latency=0 -> latch + forward + drain response all in one tick
    });

    assert.equal(slave.receiveCount, 1, 'slave without canAccept is forwarded on the first tick');
    assert.equal(slave.lastReq.address >>> 0, 0x200);
    assert.equal(master.responses.length, 1, 'response reaches the master on the same tick');
    assert.equal(master.responses[0].type, TL_D_Opcode.AccessAck);
    assert.equal(bus.inFlight, null, 'inFlight cleared after immediate forward + response');
}

// Scenario 3: selective gating. The slave accepts reads (Get) but holds writes
// (PutFullData) targeting a specific address. Models a UART that is TX-blocked
// but still readable. A read must be forwarded while a write to that address is
// held.
function testSelectiveGatingByRequestKind() {
    const TX_ADDR = 0x10000000; // models a UART TX data register
    const bus = new TileLink_UH('TileLink-UH-selective', { latency: 0 });
    const master = makeMaster();

    // canAccept: block only writes to TX_ADDR; everything else (incl. reads) ok.
    const slave = makeGatedSlave(bus, {
        canAccept(req) {
            const isWrite = req.type === TL_A_Opcode.PutFullData || req.type === TL_A_Opcode.PutPartialData;
            if (isWrite && (req.address >>> 0) === (TX_ADDR >>> 0)) {
                return false; // TX FIFO full -> hold the write
            }
            return true;
        }
    });

    bus.attachUpperPort('m', master);
    bus.attachLowerPort('uart', slave, () => true);

    // First a read to TX_ADDR: must be forwarded immediately.
    bus.sendRequest('m', { type: TL_A_Opcode.Get, address: TX_ADDR, size: 2 });
    withQuietLogs(() => {
        bus.tick();
    });
    assert.equal(slave.receiveCount, 1, 'read is forwarded despite TX-only gating');
    assert.equal(slave.lastReq.type, TL_A_Opcode.Get);
    assert.equal(master.responses.length, 1, 'read response returns to master');
    assert.equal(master.responses[0].type, TL_D_Opcode.AccessAckData);
    assert.equal(master.responses[0].data >>> 0, 0xCAFEBABE);
    assert.equal(bus.inFlight, null, 'fabric idle again after the read completes');

    // Now a write to TX_ADDR: must be held (canAccept=false), so receiveCount
    // stays 1 and a.ready stays false while the request sits inFlight.
    bus.sendRequest('m', { type: TL_A_Opcode.PutFullData, address: TX_ADDR, value: 0x41, size: 2 });
    withQuietLogs(() => {
        for (let t = 0; t < 4; t++) {
            bus.tick();
            assert.equal(slave.receiveCount, 1, `write to TX_ADDR stays held (tick ${t})`);
            assert.equal(bus.signals.a.ready, false, `a.ready deasserted while write held (tick ${t})`);
            assert.ok(bus.inFlight !== null, `held write stays inFlight (tick ${t})`);
            assert.equal(bus.inFlight.type, TL_A_Opcode.PutFullData);
            assert.equal(master.responses.length, 1, `no new response while write held (tick ${t})`);
        }
    });
}

// Scenario 4: opcode validation in _validateRequest, plus the string-type
// bypass.
function testOpcodeValidationRules() {
    // 4a. UL rejects ArithmeticData (atomic) -> tick() throws.
    {
        const bus = new TileLink_UL('TileLink-UL-atomic');
        const master = makeMaster();
        const slave = makeGatedSlave(bus);
        bus.attachUpperPort('m', master);
        bus.attachLowerPort('mem', slave, () => true);

        bus.sendRequest('m', {
            type: TL_A_Opcode.ArithmeticData,
            param: TL_Param_Arithmetic.ADD,
            address: 0x300,
            value: 1,
            size: 2
        });

        withQuietLogs(() => {
            assert.throws(
                () => bus.tick(),
                /not supported on TileLink-UL/,
                'UL must reject an atomic A-channel opcode'
            );
        });
        // The throw happens during latch (step 3) before forwarding, so the
        // slave never sees the request.
        assert.equal(slave.receiveCount, 0, 'rejected atomic never reaches the slave');
    }

    // 4b. The same atomic on a UH bus does NOT throw (UH allows all six).
    {
        const bus = new TileLink_UH('TileLink-UH-atomic', { latency: 0 });
        const master = makeMaster();
        const slave = makeGatedSlave(bus);
        bus.attachUpperPort('m', master);
        bus.attachLowerPort('mem', slave, () => true);

        bus.sendRequest('m', {
            type: TL_A_Opcode.ArithmeticData,
            param: TL_Param_Arithmetic.ADD,
            address: 0x300,
            value: 1,
            size: 2
        });

        withQuietLogs(() => {
            assert.doesNotThrow(() => bus.tick(), 'UH accepts the atomic opcode');
        });
        assert.equal(slave.receiveCount, 1, 'UH forwards the atomic to the slave');
        assert.equal(slave.lastReq.type, TL_A_Opcode.ArithmeticData);
    }

    // 4c. A string-typed request (type:"write") bypasses opcode validation even
    // on UL: _validateRequest returns early when typeof req.type !== 'number'.
    {
        const bus = new TileLink_UL('TileLink-UL-stringtype');
        const master = makeMaster();
        const slave = makeGatedSlave(bus);
        bus.attachUpperPort('m', master);
        bus.attachLowerPort('mem', slave, () => true);

        bus.sendRequest('m', { type: 'write', address: 0x300, value: 0x99, size: 2 });

        withQuietLogs(() => {
            assert.doesNotThrow(() => bus.tick(), 'string-typed request bypasses opcode validation on UL');
        });
        assert.equal(slave.receiveCount, 1, 'string-typed request is forwarded to the slave');
        assert.equal(slave.lastReq.type, 'write');
    }
}

testGatedSlaveHoldsThenForwards();
testUngatedSlaveForwardsImmediately();
testSelectiveGatingByRequestKind();
testOpcodeValidationRules();

console.log('TileLink A-channel backpressure verification passed.');
