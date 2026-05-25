import assert from 'node:assert/strict';

import { assembler } from '../src/js/assembler.js';

function assemble(source) {
  return assembler.assemble(source);
}

function instructionHex(source) {
  return assemble(source).instructions.map((item) => item.hex);
}

function expectInstructions(name, source, expectedHex) {
  assert.deepEqual(instructionHex(source), expectedHex, name);
}

function expectAssembleError(source, pattern) {
  assert.throws(
    () => assembler.assemble(source),
    (error) => pattern.test(error.message)
  );
}

function memoryBytes(program, start, length) {
  return Array.from({ length }, (_, offset) => program.memory[start + offset] ?? 0);
}

// These cases are small by design. The heavyweight GNU/Spike scripts cover the
// broad RV32IMF corpus; this file guards local syntax, pseudo-op expansion, and
// directive behavior that developers touch frequently.

expectInstructions(
  'jalr accepts both canonical memory syntax and legacy rd, rs1, imm syntax',
  `.text
jalr x1, 0(x5)
jalr x1, x5, 0`,
  ['0x000280E7', '0x000280E7']
);

expectInstructions(
  'return-oriented aliases expand to jalr x0, ra, 0',
  `.text
jr ra
ret`,
  ['0x00008067', '0x00008067']
);

expectInstructions(
  'forward call uses auipc/jalr and lands after the padding instruction',
  `.text
call target
nop
target:
nop`,
  ['0x00000097', '0x00C080E7', '0x00000013', '0x00000013']
);

expectInstructions(
  'backward call keeps a negative low immediate',
  `.text
target:
nop
call target`,
  ['0x00000013', '0x00000097', '0xFFC080E7']
);

expectInstructions(
  'li uses one instruction for signed 12-bit immediates and two for wider constants',
  `.text
li t0, -1
li t1, 0x12345678`,
  ['0xFFF00293', '0x12345337', '0x67830313']
);

expectInstructions(
  'fence operands and RV32F rounding aliases keep stable encodings',
  `.text
fence
fence rw, rw
fadd.s f1, f2, f3
fadd.s f1, f2, f3, rne`,
  ['0x0FF0000F', '0x0330000F', '0x003170D3', '0x003100D3']
);

expectInstructions(
  'floating min/max use funct3 to distinguish min from max',
  `.text
fmin.s f15, f16, f17
fmax.s f18, f19, f20`,
  ['0x291807D3', '0x29499953']
);

{
  const program = assemble(`.data
value:
  .word 0x11223344
  .half 0x5566
  .byte 0x77
  .asciiz "A"
.text 0x00400000
_start:
  la a0, value
  ret`);

  // Data directives must stay little-endian because the simulator memory map is
  // byte-addressed and CPU loads read bytes back in this order.
  assert.deepEqual(
    memoryBytes(program, 0x10010000, 9),
    [0x44, 0x33, 0x22, 0x11, 0x66, 0x55, 0x77, 0x41, 0x00]
  );
  assert.equal(program.startAddress, 0x00400000);
  assert.deepEqual(
    program.instructions.map((instruction) => instruction.hex),
    ['0x0FC10517', '0x00050513', '0x00008067']
  );
}

expectAssembleError(
  `.text
beq x0, x0, 3`,
  /must be aligned to 2 bytes/
);

expectAssembleError(
  `.text
jal x1, 3000000`,
  /out of range/
);

console.log('Assembler verification passed.');
