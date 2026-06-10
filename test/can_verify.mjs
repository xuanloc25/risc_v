import assert from 'node:assert/strict';

import {
    CAN_CMD_BITS,
    CAN_CTRL_BITS,
    CAN_DEFAULT_BASE_ADDRESS,
    CAN_ERROR,
    CAN_INT_BITS,
    CAN_REGISTERS,
    CAN_SIZE_BYTES,
    CAN_STATUS_BITS,
    CANController
} from '../src/js/can.js';
import { TL_A_Opcode, TL_D_Opcode } from '../src/js/tilelink.js';

const BASE = CAN_DEFAULT_BASE_ADDRESS;

function reg(offset) {
    return (BASE + offset) >>> 0;
}

function statusField(status, shift) {
    return (status >>> shift) & 0xFF;
}

function tickUntil(can, predicate, maxTicks = 4096) {
    for (let i = 0; i < maxTicks; i++) {
        can.tick();
        if (predicate()) return i + 1;
    }
    throw new Error('Timed out waiting for CAN controller condition');
}

function withQuietLogs(fn) {
    const originalLog = console.log;
    const originalInfo = console.info;
    const originalWarn = console.warn;
    console.log = () => {};
    console.info = () => {};
    console.warn = () => {};
    try {
        return fn();
    } finally {
        console.log = originalLog;
        console.info = originalInfo;
        console.warn = originalWarn;
    }
}

async function withQuietLogsAsync(fn) {
    const originalLog = console.log;
    const originalInfo = console.info;
    const originalWarn = console.warn;
    console.log = () => {};
    console.info = () => {};
    console.warn = () => {};
    try {
        return await fn();
    } finally {
        console.log = originalLog;
        console.info = originalInfo;
        console.warn = originalWarn;
    }
}

function tickSocFabricUntil(simulator, predicate, maxTicks = 64) {
    for (let i = 0; i < maxTicks; i++) {
        simulator.tilelink_UH.tick();
        simulator.tilelink_UL.tick();
        if (predicate()) return i + 1;
    }
    throw new Error('Timed out waiting for SoC CAN MMIO route');
}

function tickUlUntil(tilelink_UL, predicate, maxTicks = 16) {
    for (let i = 0; i < maxTicks; i++) {
        tilelink_UL.tick();
        if (predicate()) return i + 1;
    }
    throw new Error('Timed out waiting for TileLink-UL CAN backpressure release');
}

function tickCacheUntil(cache, predicate, maxTicks = 32) {
    for (let i = 0; i < maxTicks; i++) {
        cache.tick();
        if (predicate()) return i + 1;
    }
    throw new Error('Timed out waiting for cache bypass CAN backpressure release');
}

function testLoopbackTxRxRegisters() {
    const can = new CANController(BASE);
    const transmitted = [];
    const received = [];
    can.onTransmit = (frame) => transmitted.push(frame);
    can.onReceive = (frame) => received.push(frame);

    assert.equal(can.readRegister(reg(CAN_REGISTERS.BITRATE)), 500000, 'default bitrate must be 500000');
    can.writeRegister(reg(CAN_REGISTERS.BITRATE), 100000000);
    can.writeRegister(reg(CAN_REGISTERS.CTRL), CAN_CTRL_BITS.EN | CAN_CTRL_BITS.LOOPBACK);
    can.writeRegister(reg(CAN_REGISTERS.TX_ID), 0x123);
    can.writeRegister(reg(CAN_REGISTERS.TX_DLC), 8);
    can.writeRegister(reg(CAN_REGISTERS.TX_DATA0), 0x44332211);
    can.writeRegister(reg(CAN_REGISTERS.TX_DATA1), 0x88776655);
    can.writeRegister(reg(CAN_REGISTERS.CMD), CAN_CMD_BITS.SEND);

    let status = can.readRegister(reg(CAN_REGISTERS.STATUS));
    assert.equal(statusField(status, 8), 1, 'TX_COUNT should include the queued frame');

    tickUntil(can, () => (can.readRegister(reg(CAN_REGISTERS.INT_STATUS)) & CAN_INT_BITS.TX_DONE) !== 0);

    assert.equal(transmitted.length, 1, 'onTransmit should fire once');
    assert.equal(received.length, 1, 'loopback should push one RX frame and call onReceive');
    assert.deepEqual(transmitted[0], {
        id: 0x123,
        dlc: 8,
        extended: false,
        data: [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]
    });

    status = can.readRegister(reg(CAN_REGISTERS.STATUS));
    assert.ok((status & CAN_STATUS_BITS.RX_AVAILABLE) !== 0, 'RX_AVAILABLE should be set after loopback');
    assert.equal(statusField(status, 16), 1, 'RX_COUNT should be 1 after loopback');
    assert.equal(can.readRegister(reg(CAN_REGISTERS.RX_ID)), 0x123);
    assert.equal(can.readRegister(reg(CAN_REGISTERS.RX_DLC)), 8);
    assert.equal(can.readRegister(reg(CAN_REGISTERS.RX_DATA0)) >>> 0, 0x44332211);
    assert.equal(can.readRegister(reg(CAN_REGISTERS.RX_DATA1)) >>> 0, 0x88776655);

    can.writeRegister(reg(CAN_REGISTERS.RX_POP), 1);
    status = can.readRegister(reg(CAN_REGISTERS.STATUS));
    assert.equal((status & CAN_STATUS_BITS.RX_AVAILABLE), 0, 'RX_POP should remove the frame');
    assert.equal(statusField(status, 16), 0, 'RX_COUNT should return to 0 after pop');

    can.writeRegister(reg(CAN_REGISTERS.INT_STATUS), CAN_INT_BITS.TX_DONE | CAN_INT_BITS.RX_NEW);
    assert.equal(can.readRegister(reg(CAN_REGISTERS.INT_STATUS)) & (CAN_INT_BITS.TX_DONE | CAN_INT_BITS.RX_NEW), 0);
}

function testValidationErrors() {
    const can = new CANController(BASE);
    can.writeRegister(reg(CAN_REGISTERS.CTRL), CAN_CTRL_BITS.EN);
    can.writeRegister(reg(CAN_REGISTERS.BITRATE), 100000000);

    can.writeRegister(reg(CAN_REGISTERS.TX_ID), 0x123);
    can.writeRegister(reg(CAN_REGISTERS.TX_DLC), 9);
    can.writeRegister(reg(CAN_REGISTERS.CMD), CAN_CMD_BITS.SEND);
    let status = can.readRegister(reg(CAN_REGISTERS.STATUS));
    assert.ok((status & CAN_STATUS_BITS.ERROR) !== 0, 'invalid DLC should set ERROR');
    assert.equal(statusField(status, 24), CAN_ERROR.INVALID_DLC);
    assert.equal(statusField(status, 8), 0, 'invalid DLC must not enqueue TX');

    can.writeRegister(reg(CAN_REGISTERS.CMD), CAN_CMD_BITS.CLEAR_ERROR);
    can.writeRegister(reg(CAN_REGISTERS.TX_ID), 0x800);
    can.writeRegister(reg(CAN_REGISTERS.TX_DLC), 0);
    can.writeRegister(reg(CAN_REGISTERS.CMD), CAN_CMD_BITS.SEND);
    status = can.readRegister(reg(CAN_REGISTERS.STATUS));
    assert.ok((status & CAN_STATUS_BITS.ERROR) !== 0, 'standard ID above 11 bits should set ERROR');
    assert.equal(statusField(status, 24), CAN_ERROR.INVALID_ID);

    can.writeRegister(reg(CAN_REGISTERS.CMD), CAN_CMD_BITS.CLEAR_ERROR);
    can.writeRegister(reg(CAN_REGISTERS.TX_ID), 0x1ABCDE);
    can.writeRegister(reg(CAN_REGISTERS.TX_DLC), 0x10);
    can.writeRegister(reg(CAN_REGISTERS.CMD), CAN_CMD_BITS.SEND);
    status = can.readRegister(reg(CAN_REGISTERS.STATUS));
    assert.ok((status & CAN_STATUS_BITS.ERROR) !== 0, 'extended send without EXT_ID_EN should set ERROR');
    assert.equal(statusField(status, 24), CAN_ERROR.EXTENDED_DISABLED);

    can.writeRegister(reg(CAN_REGISTERS.CMD), CAN_CMD_BITS.CLEAR_ERROR);
    can.writeRegister(reg(CAN_REGISTERS.CTRL), CAN_CTRL_BITS.EN | CAN_CTRL_BITS.LOOPBACK | CAN_CTRL_BITS.EXT_ID_EN);
    can.writeRegister(reg(CAN_REGISTERS.TX_ID), 0x1ABCDE);
    can.writeRegister(reg(CAN_REGISTERS.TX_DLC), 0x10 | 1);
    can.writeRegister(reg(CAN_REGISTERS.TX_DATA0), 0xAA);
    can.writeRegister(reg(CAN_REGISTERS.CMD), CAN_CMD_BITS.SEND);
    tickUntil(can, () => (can.readRegister(reg(CAN_REGISTERS.STATUS)) & CAN_STATUS_BITS.RX_AVAILABLE) !== 0);
    assert.equal(can.readRegister(reg(CAN_REGISTERS.RX_ID)), 0x1ABCDE);
    assert.equal(can.readRegister(reg(CAN_REGISTERS.RX_DLC)), 0x11);
}

function testRxOverrunAndTxBackpressureState() {
    const can = new CANController(BASE);
    can.writeRegister(reg(CAN_REGISTERS.CTRL), CAN_CTRL_BITS.EN);

    for (let i = 0; i < 16; i++) {
        assert.equal(can.injectFrame({ id: i, dlc: 1, data: [i] }), true);
    }

    let status = can.readRegister(reg(CAN_REGISTERS.STATUS));
    assert.ok((status & CAN_STATUS_BITS.RX_FULL) !== 0, 'RX_FULL should be set at depth 16');
    assert.equal(statusField(status, 16), 16);
    assert.equal(can.injectFrame({ id: 0x7FF, dlc: 0, data: [] }), false, 'full RX FIFO should reject new frame');

    status = can.readRegister(reg(CAN_REGISTERS.STATUS));
    assert.ok((status & CAN_STATUS_BITS.RX_OVERRUN) !== 0, 'RX overrun flag should be sticky');
    assert.ok((status & CAN_STATUS_BITS.ERROR) !== 0, 'RX overrun should set ERROR');
    assert.equal(statusField(status, 24), CAN_ERROR.RX_OVERRUN);
    assert.equal(statusField(status, 16), 16, 'RX overrun must preserve existing FIFO content');

    can.writeRegister(reg(CAN_REGISTERS.CMD), CAN_CMD_BITS.CLEAR_RX | CAN_CMD_BITS.CLEAR_ERROR);
    for (let i = 0; i < 16; i++) {
        can.writeRegister(reg(CAN_REGISTERS.TX_ID), i);
        can.writeRegister(reg(CAN_REGISTERS.TX_DLC), 0);
        can.writeRegister(reg(CAN_REGISTERS.CMD), CAN_CMD_BITS.SEND);
    }

    status = can.readRegister(reg(CAN_REGISTERS.STATUS));
    assert.ok((status & CAN_STATUS_BITS.TX_FULL) !== 0, 'TX_FULL should be set at depth 16');
    assert.equal(statusField(status, 8), 16);
    assert.equal(can.canAcceptCommand(CAN_CMD_BITS.SEND), false, 'SEND must not be accepted while TX FIFO is full');

    can.writeRegister(reg(CAN_REGISTERS.CMD), CAN_CMD_BITS.SEND);
    status = can.readRegister(reg(CAN_REGISTERS.STATUS));
    assert.equal(statusField(status, 8), 16, 'direct full-FIFO SEND must not drop or enqueue a 17th frame');
    assert.equal(statusField(status, 24), CAN_ERROR.TX_FULL);

    can.writeRegister(reg(CAN_REGISTERS.CMD), CAN_CMD_BITS.CLEAR_TX | CAN_CMD_BITS.CLEAR_ERROR);
    status = can.readRegister(reg(CAN_REGISTERS.STATUS));
    assert.equal(statusField(status, 8), 0);
    assert.equal((status & CAN_STATUS_BITS.ERROR), 0);
    assert.equal(can.canAcceptCommand(CAN_CMD_BITS.SEND), true);
}

async function testSocMmioRouteAndTileLinkBackpressure() {
    const { simulator } = await withQuietLogsAsync(() => import('../src/js/soc.js'));
    withQuietLogs(() => simulator.init());

    const canRegion = simulator.addressMap.find((region) => region.name === 'CAN Controller');
    assert.ok(canRegion, 'SoC address map should include CAN Controller');
    assert.equal(canRegion.base >>> 0, BASE >>> 0);
    assert.equal(canRegion.size, CAN_SIZE_BYTES);
    assert.equal(canRegion.cacheable, false);
    assert.equal(canRegion.fabric, 'TileLink-UL');
    assert.ok(simulator.ports.ulToCan, 'SoC should expose a ulToCan port');

    const ctrlValue = withQuietLogs(() => {
        simulator.tilelink_UL.directWrite(reg(CAN_REGISTERS.CTRL), CAN_CTRL_BITS.EN | CAN_CTRL_BITS.LOOPBACK, 2, 'test');
        return simulator.tilelink_UL.directRead(reg(CAN_REGISTERS.CTRL), 2, 'test');
    });
    assert.equal(ctrlValue & (CAN_CTRL_BITS.EN | CAN_CTRL_BITS.LOOPBACK), CAN_CTRL_BITS.EN | CAN_CTRL_BITS.LOOPBACK);

    const uhMaster = {
        responses: [],
        receiveResponse(resp) {
            this.responses.push({ ...resp });
        }
    };
    simulator.tilelink_UH.attachUpperPort('can-test', uhMaster);

    withQuietLogs(() => {
        simulator.tilelink_UH.sendRequest('can-test', {
            type: TL_A_Opcode.PutFullData,
            address: reg(CAN_REGISTERS.TX_ID),
            value: 0x321,
            size: 2
        });
        tickSocFabricUntil(simulator, () => uhMaster.responses.length === 1);

        simulator.tilelink_UH.sendRequest('can-test', {
            type: TL_A_Opcode.Get,
            address: reg(CAN_REGISTERS.VERSION),
            size: 2
        });
        tickSocFabricUntil(simulator, () => uhMaster.responses.length === 2);
    });

    assert.equal(uhMaster.responses[0].type, TL_D_Opcode.AccessAck);
    assert.equal(simulator.can.readRegister(reg(CAN_REGISTERS.TX_ID)), 0x321);
    assert.equal(uhMaster.responses[1].type, TL_D_Opcode.AccessAckData);
    assert.equal(uhMaster.responses[1].data >>> 0, 0x43414E01);

    simulator.can.writeRegister(reg(CAN_REGISTERS.CMD), CAN_CMD_BITS.CLEAR_TX | CAN_CMD_BITS.CLEAR_ERROR);
    simulator.can.writeRegister(reg(CAN_REGISTERS.CTRL), CAN_CTRL_BITS.EN);
    for (let i = 0; i < 16; i++) {
        simulator.can.writeRegister(reg(CAN_REGISTERS.TX_ID), i);
        simulator.can.writeRegister(reg(CAN_REGISTERS.TX_DLC), 0);
        simulator.can.writeRegister(reg(CAN_REGISTERS.CMD), CAN_CMD_BITS.SEND);
    }

    const ulMaster = {
        responses: [],
        receiveResponse(resp) {
            this.responses.push({ ...resp });
        }
    };
    simulator.tilelink_UL.attachUpperPort('ul-can-test', ulMaster);
    simulator.tilelink_UL.sendRequest('ul-can-test', {
        type: TL_A_Opcode.PutFullData,
        address: reg(CAN_REGISTERS.CMD),
        value: CAN_CMD_BITS.SEND,
        size: 2
    });

    withQuietLogs(() => {
        for (let i = 0; i < 3; i++) simulator.tilelink_UL.tick();
    });
    assert.equal(ulMaster.responses.length, 0, 'TileLink-UL must stall SEND while CAN TX FIFO is full');
    assert.ok(simulator.tilelink_UL.inFlight, 'full-FIFO SEND should stay in flight');
    assert.equal(simulator.tilelink_UL.signals.a.ready, false, 'a.ready should be deasserted during CAN backpressure');

    simulator.can.writeRegister(reg(CAN_REGISTERS.CMD), CAN_CMD_BITS.CLEAR_TX);
    withQuietLogs(() => tickUlUntil(simulator.tilelink_UL, () => ulMaster.responses.length === 1));
    assert.equal(ulMaster.responses[0].type, TL_D_Opcode.AccessAck);

    withQuietLogs(() => simulator.init());
    simulator.can.writeRegister(reg(CAN_REGISTERS.CTRL), CAN_CTRL_BITS.EN);
    for (let i = 0; i < 16; i++) {
        simulator.can.writeRegister(reg(CAN_REGISTERS.TX_ID), i);
        simulator.can.writeRegister(reg(CAN_REGISTERS.TX_DLC), 0);
        simulator.can.writeRegister(reg(CAN_REGISTERS.CMD), CAN_CMD_BITS.SEND);
    }

    const bridgeMaster = {
        responses: [],
        receiveResponse(resp) {
            this.responses.push({ ...resp });
        }
    };
    simulator.tilelink_UH.attachUpperPort('can-bridge-test', bridgeMaster);
    simulator.tilelink_UH.sendRequest('can-bridge-test', {
        type: TL_A_Opcode.PutFullData,
        address: reg(CAN_REGISTERS.CMD),
        value: CAN_CMD_BITS.SEND,
        size: 2
    });

    withQuietLogs(() => {
        for (let i = 0; i < 3; i++) {
            simulator.tilelink_UH.tick();
            simulator.tilelink_UL.tick();
        }
    });
    assert.equal(bridgeMaster.responses.length, 0, 'UH->UL bridge must propagate CAN SEND backpressure');
    assert.ok(simulator.tilelink_UH.inFlight, 'UH request should remain in flight while CAN is full');
    assert.equal(simulator.tilelink_UH.signals.a.ready, false, 'UH a.ready should be deasserted by downstream CAN backpressure');

    simulator.can.writeRegister(reg(CAN_REGISTERS.CMD), CAN_CMD_BITS.CLEAR_TX);
    withQuietLogs(() => tickSocFabricUntil(simulator, () => bridgeMaster.responses.length === 1));
    assert.equal(bridgeMaster.responses[0].type, TL_D_Opcode.AccessAck);

    withQuietLogs(() => simulator.init());
    simulator.can.writeRegister(reg(CAN_REGISTERS.CTRL), CAN_CTRL_BITS.EN);
    for (let i = 0; i < 16; i++) {
        simulator.can.writeRegister(reg(CAN_REGISTERS.TX_ID), i);
        simulator.can.writeRegister(reg(CAN_REGISTERS.TX_DLC), 0);
        simulator.can.writeRegister(reg(CAN_REGISTERS.CMD), CAN_CMD_BITS.SEND);
    }

    const cpuBypassMaster = {
        responses: [],
        receiveResponse(resp) {
            this.responses.push({ ...resp });
        }
    };

    withQuietLogs(() => simulator.dCache.receiveRequest({
        from: 'cpu',
        replyTo: cpuBypassMaster,
        type: TL_A_Opcode.PutFullData,
        address: reg(CAN_REGISTERS.CMD),
        value: CAN_CMD_BITS.SEND,
        size: 2,
        cacheable: false
    }));

    withQuietLogs(() => {
        for (let i = 0; i < 3; i++) simulator.dCache.tick();
    });
    assert.equal(cpuBypassMaster.responses.length, 0, 'CPU non-cacheable bypass must stall SEND while CAN TX FIFO is full');
    assert.equal(simulator.dCache.pendingRequest?.retryBypass, true, 'D-cache bypass should hold and retry the full-FIFO SEND');

    simulator.can.writeRegister(reg(CAN_REGISTERS.CMD), CAN_CMD_BITS.CLEAR_TX);
    withQuietLogs(() => tickCacheUntil(simulator.dCache, () => cpuBypassMaster.responses.length === 1));
    assert.equal(cpuBypassMaster.responses[0].type, TL_D_Opcode.AccessAck);
    assert.equal(statusField(simulator.can.readRegister(reg(CAN_REGISTERS.STATUS)), 8), 1, 'released CPU bypass SEND should enqueue one CAN frame');
}

testLoopbackTxRxRegisters();
testValidationErrors();
testRxOverrunAndTxBackpressureState();
await testSocMmioRouteAndTileLinkBackpressure();

console.log('CAN controller and SoC MMIO verification passed.');
