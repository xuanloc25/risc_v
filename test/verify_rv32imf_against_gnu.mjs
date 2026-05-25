import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembler } from '../src/js/assembler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

const GNU_AS = 'riscv64-unknown-elf-as';
const GNU_OBJCOPY = 'riscv64-unknown-elf-objcopy';
const GNU_OBJDUMP = 'riscv64-unknown-elf-objdump';
// The small local corpus is cheap compared with riscv-tests and catches
// assembler syntax paths that objdump artifacts may skip. Set
// INCLUDE_LOCAL_CORPUS=0 only when debugging the riscv-tests pass alone.
const INCLUDE_LOCAL_CORPUS = process.env.INCLUDE_LOCAL_CORPUS !== '0';

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function toUnixPath(filePath) {
  const absolute = path.resolve(filePath);
  if (!isWindows) return absolute;
  return absolute
    .replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`)
    .replace(/\\/g, '/');
}

function runUnix(command, options = {}) {
  const child = isWindows
    ? spawnSync('wsl', ['bash', '-lc', command], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        ...options,
      })
    : spawnSync('bash', ['-lc', command], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        ...options,
      });

  if (child.status !== 0) {
    const details = [child.stderr, child.stdout].filter(Boolean).join('\n').trim();
    throw new Error(details || `Command failed: ${command}`);
  }

  return child.stdout;
}

function commandExists(command) {
  try {
    runUnix(`command -v ${shQuote(command)} >/dev/null`);
    return true;
  } catch {
    return false;
  }
}

function normalizeHex(value) {
  return `0x${String(value).replace(/^0x/i, '').toUpperCase().padStart(8, '0')}`;
}

function wordsFromLittleEndianText(bytes) {
  const words = [];
  for (let offset = 0; offset < bytes.length; offset += 4) {
    if (offset + 4 > bytes.length) {
      throw new Error(`GNU .text size is not a multiple of 4 bytes: ${bytes.length}`);
    }
    words.push(normalizeHex(bytes.readUInt32LE(offset).toString(16)));
  }
  return words;
}

function splitOperands(operandText) {
  if (!operandText.trim()) return [];
  const operands = [];
  let current = '';
  let parenDepth = 0;

  for (const char of operandText) {
    if (char === '(') parenDepth++;
    if (char === ')') parenDepth--;

    if (char === ',' && parenDepth === 0) {
      operands.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) operands.push(current.trim());
  return operands;
}

function assembleWithProject(source) {
  return assembler.assemble(source).instructions.map((instruction) => normalizeHex(instruction.hex));
}

function assembleTextWithGnu(source, testName) {
  const workDir = mkdtempSync(path.join(tmpdir(), 'rv32imf-gnu-'));
  const sourcePath = path.join(workDir, `${testName}.S`);
  const objectPath = path.join(workDir, `${testName}.o`);
  const textPath = path.join(workDir, `${testName}.text.bin`);

  try {
    writeFileSync(sourcePath, source, 'utf8');
    runUnix(
      [
        GNU_AS,
        '-march=rv32imf',
        '-mabi=ilp32f',
        shQuote(toUnixPath(sourcePath)),
        '-o',
        shQuote(toUnixPath(objectPath)),
      ].join(' ')
    );
    runUnix(
      [
        GNU_OBJCOPY,
        '-O',
        'binary',
        '-j',
        '.text',
        shQuote(toUnixPath(objectPath)),
        shQuote(toUnixPath(textPath)),
      ].join(' ')
    );
    return wordsFromLittleEndianText(readFileSync(textPath));
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

const corpus = [
  {
    name: 'rv32i-r-type',
    source: `.text
add x1, x2, x3
sub x4, x5, x6
sll x7, x8, x9
slt x10, x11, x12
sltu x13, x14, x15
xor x16, x17, x18
srl x19, x20, x21
sra x22, x23, x24
or x25, x26, x27
and x28, x29, x30
`,
  },
  {
    name: 'rv32i-i-type',
    source: `.text
addi x1, x2, -2048
slti x3, x4, 2047
sltiu x5, x6, 15
xori x7, x8, -1
ori x9, x10, 0x7f
andi x11, x12, 0x55
slli x13, x14, 31
srli x15, x16, 1
srai x17, x18, 7
`,
  },
  {
    name: 'rv32i-load-store',
    source: `.text
lb x1, -16(x2)
lh x3, -12(x4)
lw x5, 0(x6)
lbu x7, 12(x8)
lhu x9, 16(x10)
sb x11, -20(x12)
sh x13, 20(x14)
sw x15, 24(x16)
`,
  },
  {
    name: 'rv32i-control-system',
    source: `.text
start:
beq x1, x2, target
bne x3, x4, start
blt x5, x6, target
bge x7, x8, start
bltu x9, x10, target
bgeu x11, x12, start
jal x1, target
jalr x2, 0(x3)
lui x4, 0x12345
auipc x5, 0x23456
ecall
ebreak
fence
fence rw, rw
target:
addi x0, x0, 0
`,
  },
  {
    name: 'rv32m',
    source: `.text
mul x1, x2, x3
mulh x4, x5, x6
mulhsu x7, x8, x9
mulhu x10, x11, x12
div x13, x14, x15
divu x16, x17, x18
rem x19, x20, x21
remu x22, x23, x24
`,
  },
  {
    name: 'rv32f',
    source: `.text
flw f1, -16(x2)
fsw f3, 20(x4)
fmadd.s f5, f6, f7, f8
fmsub.s f9, f10, f11, f12
fnmsub.s f13, f14, f15, f16
fnmadd.s f17, f18, f19, f20
fadd.s f1, f2, f3
fsub.s f4, f5, f6
fmul.s f7, f8, f9
fdiv.s f10, f11, f12
fsqrt.s f13, f14
fmin.s f15, f16, f17
fmax.s f18, f19, f20
fsgnj.s f21, f22, f23
fsgnjn.s f24, f25, f26
fsgnjx.s f27, f28, f29
fcvt.w.s x1, f2
fcvt.wu.s x3, f4
fcvt.s.w f5, x6
fcvt.s.wu f7, x8
feq.s x9, f10, f11
flt.s x12, f13, f14
fle.s x15, f16, f17
fclass.s x18, f19
fmv.x.w x20, f21
fmv.w.x f22, x23
`,
  },
  {
    name: 'rv32f-rounding-modes',
    source: `.text
fadd.s f1, f2, f3, rne
fsub.s f4, f5, f6, rtz
fmul.s f7, f8, f9, rdn
fdiv.s f10, f11, f12, rup
fsqrt.s f13, f14, rmm
fcvt.w.s x1, f2, dyn
fmadd.s f3, f4, f5, f6, rne
`,
  },
];

function runCorpusComparison() {
  const failures = [];
  let checkedWords = 0;

  for (const testCase of corpus) {
    const expected = assembleTextWithGnu(testCase.source, testCase.name);
    const actual = assembleWithProject(testCase.source);
    checkedWords += expected.length;

    if (expected.length !== actual.length || expected.some((word, index) => word !== actual[index])) {
      failures.push({ name: testCase.name, expected, actual });
    }
  }

  return { checkedWords, failures };
}

const pcRelativeMnemonics = new Set(['beq', 'bne', 'blt', 'bge', 'bltu', 'bgeu', 'jal']);

function normalizeObjdumpInstruction(address, mnemonic, operands) {
  if (pcRelativeMnemonics.has(mnemonic)) {
    const targetIndex = mnemonic === 'jal' ? 1 : 2;
    const targetMatch = operands[targetIndex]?.match(/^([0-9a-f]+)\b/i);
    if (!targetMatch) return null;
    operands[targetIndex] = String(parseInt(targetMatch[1], 16) - address);
  }

  return `${mnemonic}${operands.length ? ` ${operands.join(', ')}` : ''}`;
}

function listBuiltRiscvTests() {
  const isaDir = path.join(repoRoot, 'riscv-tests', 'isa');
  try {
    return readdirSync(isaDir)
      .filter((name) => /^(rv32ui|rv32um|rv32uf)-p-[^.]+$/.test(name))
      .filter((name) => statSync(path.join(isaDir, name)).isFile())
      .sort();
  } catch {
    return [];
  }
}

function runRiscvTestsArtifactComparison() {
  const isaDir = path.join(repoRoot, 'riscv-tests', 'isa');
  const artifacts = listBuiltRiscvTests();
  const unsupportedMnemonics = new Map();
  const failures = [];
  let checkedInstructions = 0;
  let skippedInstructions = 0;

  for (const artifact of artifacts) {
    const artifactPath = path.join(isaDir, artifact);
    const dump = runUnix(
      [
        GNU_OBJDUMP,
        '-d',
        '-M',
        'no-aliases',
        shQuote(toUnixPath(artifactPath)),
      ].join(' ')
    );

    for (const line of dump.split('\n')) {
      const match = line.match(/^\s*([0-9a-f]+):\s*([0-9a-f]{8})\s+(.+)$/i);
      if (!match) continue;

      const address = parseInt(match[1], 16);
      const expectedWord = normalizeHex(match[2]);
      const instructionText = match[3].replace(/#.*$/, '').trim();
      const instructionMatch = instructionText.match(/^([^\s]+)\s*(.*)$/);
      if (!instructionMatch) continue;

      const mnemonic = instructionMatch[1].toLowerCase();
      const operands = splitOperands(instructionMatch[2]);

      if (!assembler.opcodes[mnemonic]) {
        skippedInstructions++;
        unsupportedMnemonics.set(mnemonic, (unsupportedMnemonics.get(mnemonic) || 0) + 1);
        continue;
      }

      const normalizedInstruction = normalizeObjdumpInstruction(address, mnemonic, operands);
      if (!normalizedInstruction) {
        skippedInstructions++;
        continue;
      }

      try {
        const actual = assembleWithProject(`.text 0x${address.toString(16)}\n${normalizedInstruction}`);
        if (actual.length !== 1 || actual[0] !== expectedWord) {
          failures.push({
            artifact,
            address: normalizeHex(address.toString(16)),
            instruction: normalizedInstruction,
            expected: expectedWord,
            actual: actual.join(', '),
          });
        } else {
          checkedInstructions++;
        }
      } catch (error) {
        failures.push({
          artifact,
          address: normalizeHex(address.toString(16)),
          instruction: normalizedInstruction,
          expected: expectedWord,
          actual: error.message,
        });
      }
    }
  }

  return {
    artifacts,
    checkedInstructions,
    skippedInstructions,
    unsupportedMnemonics,
    failures,
  };
}

function printFailures(title, failures) {
  if (failures.length === 0) return;

  console.error(`\n${title}`);
  for (const failure of failures.slice(0, 10)) {
    if (failure.name) {
      console.error(`- ${failure.name}`);
      for (let index = 0; index < Math.max(failure.expected.length, failure.actual.length); index++) {
        if (failure.expected[index] !== failure.actual[index]) {
          console.error(`  [${index}] expected ${failure.expected[index] ?? '<missing>'}, got ${failure.actual[index] ?? '<missing>'}`);
        }
      }
    } else {
      console.error(`- ${failure.artifact} ${failure.address}: ${failure.instruction}`);
      console.error(`  expected ${failure.expected}, got ${failure.actual}`);
    }
  }

  if (failures.length > 10) {
    console.error(`... ${failures.length - 10} more failure(s) omitted`);
  }
}

function printUnsupportedSummary(unsupportedMnemonics) {
  const topUnsupported = [...unsupportedMnemonics.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (topUnsupported.length === 0) return;
  const summary = topUnsupported.map(([mnemonic, count]) => `${mnemonic}:${count}`).join(', ');
  console.log(`  skipped unsupported objdump mnemonics: ${summary}`);
}

function main() {
  const missingTools = [GNU_AS, GNU_OBJCOPY, GNU_OBJDUMP].filter((tool) => !commandExists(tool));
  if (missingTools.length > 0) {
    console.error(`Missing required RISC-V GNU tool(s): ${missingTools.join(', ')}`);
    console.error('Install binutils-riscv64-unknown-elf, or add your RISC-V GNU toolchain to PATH.');
    process.exit(1);
  }

  console.log('RV32IMF differential verification');
  console.log('Reference: riscv64-unknown-elf-as/objcopy/objdump');

  const corpusResult = INCLUDE_LOCAL_CORPUS ? runCorpusComparison() : { failures: [] };
  if (INCLUDE_LOCAL_CORPUS) {
    if (corpusResult.failures.length === 0) {
      console.log(`- Local developer corpus: PASS (${corpus.length} groups, ${corpusResult.checkedWords} instruction words)`);
    } else {
      console.log(`- Local developer corpus: FAIL (${corpusResult.failures.length} group mismatch(es))`);
    }
  }

  const riscvTestsResult = runRiscvTestsArtifactComparison();
  if (riscvTestsResult.artifacts.length === 0) {
    console.log('- riscv-tests artifacts: SKIP (no rv32ui/rv32um/rv32uf p-test ELF files found under riscv-tests/isa)');
    console.log('  Build them with: cd riscv-tests && make isa XLEN=32');
  } else if (riscvTestsResult.failures.length === 0) {
    console.log(
      `- riscv-tests artifacts: PASS (${riscvTestsResult.artifacts.length} ELF file(s), ` +
      `${riscvTestsResult.checkedInstructions} supported instruction word(s), ` +
      `${riscvTestsResult.skippedInstructions} skipped)`
    );
    printUnsupportedSummary(riscvTestsResult.unsupportedMnemonics);
  } else {
    console.log(`- riscv-tests artifacts: FAIL (${riscvTestsResult.failures.length} mismatch(es))`);
  }

  printFailures('Local developer corpus mismatches:', corpusResult.failures);
  printFailures('riscv-tests artifact mismatches:', riscvTestsResult.failures);

  if (corpusResult.failures.length > 0 || riscvTestsResult.failures.length > 0) {
    process.exit(1);
  }
}

main();
