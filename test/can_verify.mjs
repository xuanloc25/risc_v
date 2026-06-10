import assert from 'node:assert/strict';

import {
    CAN_CMD_BITS,
    CAN_CTRL_BITS,
    CAN_DEFAULT_BASE_ADDRESS,
    CAN_REGISTERS,
    CAN_STATUS_BITS,
    CANController
} from '../src/js/can.js';

const BASE = CAN_DEFAULT_BASE_ADDRESS;
const reg = (offset) => (BASE + offset) >>> 0;
const read = (can, offset) => can.readRegister(reg(offset)) >>> 0;
const write = (can, offset, value) => can.writeRegister(reg(offset), value);

function assertDefaultState(can) {
    assert.equal(read(can, CAN_REGISTERS.CTRL), 0);
    assert.equal(read(can, CAN_REGISTERS.STATUS), 0);
    assert.equal(read(can, CAN_REGISTERS.TX_ID), 0);
    assert.equal(read(can, CAN_REGISTERS.TX_DLC), 0);
    assert.equal(read(can, CAN_REGISTERS.RX_ID), 0);
    assert.equal(read(can, CAN_REGISTERS.RX_DLC), 0);
}

const can = new CANController(BASE);
assertDefaultState(can);

const transmitted = [];
can.onTransmit = (frame) => transmitted.push(frame);
write(can, CAN_REGISTERS.CTRL, CAN_CTRL_BITS.EN | CAN_CTRL_BITS.LOOPBACK);
assert.equal(
    read(can, CAN_REGISTERS.STATUS) & CAN_STATUS_BITS.TX_READY,
    CAN_STATUS_BITS.TX_READY
);

write(can, CAN_REGISTERS.TX_ID, 0x123);
write(can, CAN_REGISTERS.TX_DLC, 8);
write(can, CAN_REGISTERS.TX_DATA0, 0x44332211);
write(can, CAN_REGISTERS.TX_DATA1, 0x88776655);
write(can, CAN_REGISTERS.CMD, CAN_CMD_BITS.SEND);

assert.deepEqual(transmitted, [{
    id: 0x123,
    dlc: 8,
    data: [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]
}]);
assert.equal(
    read(can, CAN_REGISTERS.STATUS) & CAN_STATUS_BITS.RX_AVAILABLE,
    CAN_STATUS_BITS.RX_AVAILABLE
);
assert.equal(read(can, CAN_REGISTERS.RX_ID), 0x123);
assert.equal(read(can, CAN_REGISTERS.RX_DLC), 8);
assert.equal(read(can, CAN_REGISTERS.RX_DATA0), 0x44332211);
assert.equal(read(can, CAN_REGISTERS.RX_DATA1), 0x88776655);

write(can, CAN_REGISTERS.RX_POP, 1);
assert.equal(read(can, CAN_REGISTERS.STATUS) & CAN_STATUS_BITS.RX_AVAILABLE, 0);

write(can, CAN_REGISTERS.TX_ID, 0x800);
write(can, CAN_REGISTERS.TX_DLC, 0);
write(can, CAN_REGISTERS.CMD, CAN_CMD_BITS.SEND);
assert.equal(read(can, CAN_REGISTERS.STATUS) & CAN_STATUS_BITS.ERROR, CAN_STATUS_BITS.ERROR);
assert.equal(transmitted.length, 1);

write(can, CAN_REGISTERS.CMD, CAN_CMD_BITS.CLEAR_ERROR);
write(can, CAN_REGISTERS.TX_ID, 0x123);
write(can, CAN_REGISTERS.TX_DLC, 9);
write(can, CAN_REGISTERS.CMD, CAN_CMD_BITS.SEND);
assert.equal(read(can, CAN_REGISTERS.STATUS) & CAN_STATUS_BITS.ERROR, CAN_STATUS_BITS.ERROR);
assert.equal(transmitted.length, 1);

const injected = new CANController(BASE);
assert.equal(injected.injectFrame({ id: 0x321, dlc: 3, data: [1, 2, 3] }), true);
assert.equal(read(injected, CAN_REGISTERS.RX_ID), 0x321);
assert.equal(read(injected, CAN_REGISTERS.RX_DLC), 3);
assert.equal(read(injected, CAN_REGISTERS.RX_DATA0), 0x00030201);
assert.equal(injected.injectFrame({ id: 0x456, dlc: 0, data: [] }), false);
assert.equal(
    read(injected, CAN_REGISTERS.STATUS) & CAN_STATUS_BITS.ERROR,
    CAN_STATUS_BITS.ERROR
);
assert.equal(read(injected, CAN_REGISTERS.RX_ID), 0x321);

can.reset();
assertDefaultState(can);

console.log('Minimal CAN controller verification passed.');
