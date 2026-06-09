import assert from 'node:assert/strict';

import { assembler } from '../src/js/assembler.js';
import { CPU } from '../src/js/cpu.js';

const rv32fDecodeCases = [
  ['flw f1, 0(x2)', 'FLW'],
  ['fsw f1, 0(x2)', 'FSW'],
  ['fmadd.s f1, f2, f3, f4', 'FMADD.S'],
  ['fmsub.s f1, f2, f3, f4', 'FMSUB.S'],
  ['fnmsub.s f1, f2, f3, f4', 'FNMSUB.S'],
  ['fnmadd.s f1, f2, f3, f4', 'FNMADD.S'],
  ['fadd.s f1, f2, f3', 'FADD.S'],
  ['fsub.s f1, f2, f3', 'FSUB.S'],
  ['fmul.s f1, f2, f3', 'FMUL.S'],
  ['fdiv.s f1, f2, f3', 'FDIV.S'],
  ['fsqrt.s f1, f2', 'FSQRT.S'],
  ['fsgnj.s f1, f2, f3', 'FSGNJ.S'],
  ['fsgnjn.s f1, f2, f3', 'FSGNJN.S'],
  ['fsgnjx.s f1, f2, f3', 'FSGNJX.S'],
  ['fmin.s f1, f2, f3', 'FMIN.S'],
  ['fmax.s f1, f2, f3', 'FMAX.S'],
  ['fcvt.w.s x1, f2', 'FCVT.W.S'],
  ['fcvt.wu.s x1, f2', 'FCVT.WU.S'],
  ['fmv.x.w x1, f2', 'FMV.X.W'],
  ['feq.s x1, f2, f3', 'FEQ.S'],
  ['flt.s x1, f2, f3', 'FLT.S'],
  ['fle.s x1, f2, f3', 'FLE.S'],
  ['fclass.s x1, f2', 'FCLASS.S'],
  ['fcvt.s.w f1, x2', 'FCVT.S.W'],
  ['fcvt.s.wu f1, x2', 'FCVT.S.WU'],
  ['fmv.w.x f1, x2', 'FMV.W.X'],
];

function firstWord(source) {
  return parseInt(assembler.assemble(`.text\n${source}`).instructions[0].hex);
}

function decodeName(source) {
  return new CPU().decode(firstWord(source)).opName;
}

for (const [source, expectedName] of rv32fDecodeCases) {
  assert.equal(decodeName(source), expectedName, source);
}

function registerIndex(name) {
  return Number(name.slice(1));
}

function executeFp(source, init, destination) {
  const cpu = new CPU();
  cpu.pc = 0x00400000;

  for (const [registerName, value] of Object.entries(init)) {
    if (registerName.startsWith('f')) {
      cpu.fregisters[registerIndex(registerName)] = value;
    } else {
      cpu.registers[registerIndex(registerName)] = value | 0;
    }
  }

  const decoded = cpu.decode(firstWord(source));
  cpu.execute(decoded, { memBytes() { return {}; } });

  return destination.startsWith('f')
    ? cpu.fregisters[registerIndex(destination)]
    : cpu.registers[registerIndex(destination)];
}

assert.equal(
  executeFp('fadd.s f1, f2, f3', { f2: 1.25, f3: 2.5 }, 'f1'),
  3.75,
  'default dyn rounding should decode and execute fadd.s'
);

assert.equal(
  executeFp('fmadd.s f1, f2, f3, f4', { f2: 2, f3: 3, f4: 4 }, 'f1'),
  10,
  'default dyn rounding should decode and execute fmadd.s'
);

assert.equal(
  executeFp('fmin.s f1, f2, f3', { f2: 1, f3: 2 }, 'f1'),
  1,
  'fmin.s should select the smaller operand'
);

assert.equal(
  executeFp('fmax.s f1, f2, f3', { f2: 1, f3: 2 }, 'f1'),
  2,
  'fmax.s should select the larger operand'
);

console.log('CPU RV32F verification passed.');
