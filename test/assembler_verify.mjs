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

expectAssembleError(
  `.text\nbeq x0, x0, 3`,
  /must be aligned to 2 bytes/
);

expectAssembleError(
  `.text\njal x1, 3000000`,
  /out of range/
);

console.log('Assembler verification passed.');
