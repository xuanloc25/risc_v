// Kiểm tra tính nhất quán giữa assembler (mã hóa) và CPU (giải mã) thông qua
// bảng ISA dùng chung trong src/js/isa.js:
//   - Mỗi mnemonic thật trong OPCODES phải assemble được và decode ra đúng tên/type.
//   - Mỗi pseudo instruction phải nở ra lệnh thật và decode ra đúng lệnh đích.
//   - INSTRUCTION_FORMATS phải phủ đúng tập mnemonic thật (trừ fence — CPU chưa decode).
// Khi thêm lệnh mới vào OPCODES, test này sẽ fail cho tới khi bổ sung sample tương ứng.
import assert from 'node:assert/strict';

import { assembler } from '../src/js/assembler.js';
import { CPU } from '../src/js/cpu.js';
import { OPCODES, INSTRUCTION_FORMATS } from '../src/js/isa.js';

// CPU hiện không giải mã fence (decode trả về UNKNOWN) — hành vi có chủ đích.
const DECODE_EXCLUDED = new Set(['fence']);

const samples = {
  lb: 'lb x1, 4(x2)', lh: 'lh x1, 4(x2)', lw: 'lw x1, 4(x2)', lbu: 'lbu x1, 4(x2)', lhu: 'lhu x1, 4(x2)',
  sb: 'sb x1, 4(x2)', sh: 'sh x1, 4(x2)', sw: 'sw x1, 4(x2)',
  addi: 'addi x1, x2, -5', slti: 'slti x1, x2, 7', sltiu: 'sltiu x1, x2, 7', xori: 'xori x1, x2, 7',
  ori: 'ori x1, x2, 7', andi: 'andi x1, x2, 7',
  slli: 'slli x1, x2, 3', srli: 'srli x1, x2, 3', srai: 'srai x1, x2, 3',
  add: 'add x1, x2, x3', sub: 'sub x1, x2, x3', sll: 'sll x1, x2, x3', slt: 'slt x1, x2, x3',
  sltu: 'sltu x1, x2, x3', xor: 'xor x1, x2, x3', srl: 'srl x1, x2, x3', sra: 'sra x1, x2, x3',
  or: 'or x1, x2, x3', and: 'and x1, x2, x3',
  lui: 'lui x1, 0x12345', auipc: 'auipc x1, 0x12345',
  jal: 'jal x1, 8', jalr: 'jalr x1, 0(x5)',
  beq: 'beq x1, x2, 8', bne: 'bne x1, x2, 8', blt: 'blt x1, x2, 8',
  bge: 'bge x1, x2, 8', bltu: 'bltu x1, x2, 8', bgeu: 'bgeu x1, x2, 8',
  ecall: 'ecall', ebreak: 'ebreak', fence: 'fence',
  mul: 'mul x1, x2, x3', mulh: 'mulh x1, x2, x3', mulhsu: 'mulhsu x1, x2, x3', mulhu: 'mulhu x1, x2, x3',
  div: 'div x1, x2, x3', divu: 'divu x1, x2, x3', rem: 'rem x1, x2, x3', remu: 'remu x1, x2, x3',
  flw: 'flw f1, 0(x2)', fsw: 'fsw f1, 0(x2)',
  'fmadd.s': 'fmadd.s f1, f2, f3, f4', 'fmsub.s': 'fmsub.s f1, f2, f3, f4',
  'fnmsub.s': 'fnmsub.s f1, f2, f3, f4', 'fnmadd.s': 'fnmadd.s f1, f2, f3, f4',
  'fadd.s': 'fadd.s f1, f2, f3', 'fsub.s': 'fsub.s f1, f2, f3', 'fmul.s': 'fmul.s f1, f2, f3',
  'fdiv.s': 'fdiv.s f1, f2, f3', 'fsqrt.s': 'fsqrt.s f1, f2',
  'fmin.s': 'fmin.s f1, f2, f3', 'fmax.s': 'fmax.s f1, f2, f3',
  'fsgnj.s': 'fsgnj.s f1, f2, f3', 'fsgnjn.s': 'fsgnjn.s f1, f2, f3', 'fsgnjx.s': 'fsgnjx.s f1, f2, f3',
  'fcvt.w.s': 'fcvt.w.s x1, f2', 'fcvt.wu.s': 'fcvt.wu.s x1, f2',
  'fcvt.s.w': 'fcvt.s.w f1, x2', 'fcvt.s.wu': 'fcvt.s.wu f1, x2',
  'feq.s': 'feq.s x1, f2, f3', 'flt.s': 'flt.s x1, f2, f3', 'fle.s': 'fle.s x1, f2, f3',
  'fclass.s': 'fclass.s x1, f2', 'fmv.x.w': 'fmv.x.w x1, f2', 'fmv.w.x': 'fmv.w.x f1, x2',
  'amoadd.w': 'amoadd.w x1, x2, (x3)',
  nop: 'nop', li: 'li x1, 42', mv: 'mv x1, x2', j: 'j 8', jr: 'jr x5', ret: 'ret',
  call: 'call 8', bnez: 'bnez x1, 8', beqz: 'beqz x1, 8', la: 'la x1, data_word',
  'fmv.s': 'fmv.s f1, f2', 'fabs.s': 'fabs.s f1, f2', 'fneg.s': 'fneg.s f1, f2',
};

// Lệnh thật mà pseudo (không khai báo expandsTo) sẽ nở ra, để đối chiếu decode.
const pseudoExpansionTargets = { li: 'ADDI', call: 'JALR', la: 'ADDI' };

// Mọi mnemonic trong OPCODES đều phải có sample (ép cập nhật test khi thêm lệnh mới).
const missing = Object.keys(OPCODES).filter((name) => !(name in samples));
assert.deepEqual(missing, [], `Mnemonic chưa có sample trong test: ${missing.join(', ')}`);

// assembler phải dùng đúng bảng chung, không giữ bản sao riêng.
assert.equal(assembler.opcodes, OPCODES);

// INSTRUCTION_FORMATS phủ đúng tập lệnh thật (trừ fence), key viết hoa.
const realMnemonics = Object.keys(OPCODES)
  .filter((name) => OPCODES[name].type !== 'Pseudo' && !DECODE_EXCLUDED.has(name));
assert.deepEqual(
  Object.keys(INSTRUCTION_FORMATS).sort(),
  realMnemonics.map((name) => name.toUpperCase()).sort()
);

const cpu = new CPU();

function lastWord(source) {
  const program = `.data\ndata_word: .word 0x1234\n.text\n${source}`;
  const { instructions } = assembler.assemble(program);
  assert.ok(instructions.length >= 1, `"${source}" không sinh ra lệnh nào`);
  return parseInt(instructions[instructions.length - 1].hex);
}

for (const [mnemonic, source] of Object.entries(samples)) {
  const entry = OPCODES[mnemonic];
  const decoded = cpu.decode(lastWord(source));

  if (DECODE_EXCLUDED.has(mnemonic)) {
    assert.equal(decoded.opName, 'UNKNOWN', `${mnemonic}: kỳ vọng CPU chưa decode`);
    continue;
  }
  if (entry.type === 'Pseudo') {
    const expected = (entry.expandsTo ?? '').toUpperCase() || pseudoExpansionTargets[mnemonic];
    assert.ok(expected, `${mnemonic}: thiếu lệnh đích kỳ vọng cho pseudo`);
    assert.equal(decoded.opName, expected, `pseudo ${mnemonic} phải nở ra ${expected}`);
    continue;
  }
  assert.equal(decoded.opName, mnemonic.toUpperCase(), `decode sai tên cho ${mnemonic}`);
  assert.equal(decoded.type, entry.type, `decode sai type cho ${mnemonic}`);
}

console.log(`[PASS] Round-trip assembler -> CPU nhất quán cho ${Object.keys(samples).length} mnemonic (${realMnemonics.length} lệnh thật decode đúng tên/type).`);
