import assert from 'node:assert/strict';
import { assembler } from '../src/js/assembler.js';

function assemble(source) {
  return assembler.assemble(source).instructions.map((item) => item.hex);
}

function expectAssembleError(source, pattern) {
  assert.throws(
    () => assembler.assemble(source),
    (error) => pattern.test(error.message)
  );
}

assert.deepEqual(
  assemble(`.text\njalr x1, 0(x5)`),
  ['0x000280E7']
);

assert.deepEqual(
  assemble(`.text\njalr x1, x5, 0`),
  ['0x000280E7']
);

assert.deepEqual(
  assemble(`.text\njr ra`),
  ['0x00008067']
);

assert.deepEqual(
  assemble(`.text\nret`),
  ['0x00008067']
);

assert.deepEqual(
  assemble(`.text\ncall target\nnop\ntarget:\nnop`),
  ['0x00000097', '0x00C080E7', '0x00000013', '0x00000013']
);

assert.deepEqual(
  assemble(`.text\ntarget:\nnop\ncall target`),
  ['0x00000013', '0x00000097', '0xFFC080E7']
);

assert.deepEqual(
  assemble(`.text\nfence\nfence rw, rw`),
  ['0x0FF0000F', '0x0330000F']
);

assert.deepEqual(
  assemble(`.text\nfadd.s f1, f2, f3\nfadd.s f1, f2, f3, rne`),
  ['0x003170D3', '0x003100D3']
);

assert.deepEqual(
  assemble(`.text\nfmin.s f15, f16, f17\nfmax.s f18, f19, f20`),
  ['0x291807D3', '0x29499953']
);

expectAssembleError(
  `.text\nbeq x0, x0, 3`,
  /must be aligned to 2 bytes/
);

expectAssembleError(
  `.text\njal x1, 3000000`,
  /out of range/
);

console.log('Assembler verification passed.');
