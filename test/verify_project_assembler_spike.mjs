import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembler } from '../src/js/assembler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

const DEFAULT_ISA = 'RV32IMF';
const DEFAULT_TIMEOUT_MS = 30_000;
const TEXT_START = 0x80000008;
const TOHOST_HI20 = '0x80001';

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
  return isWindows
    ? spawnSync('wsl', ['bash', '-lc', command], {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        ...options,
      })
    : spawnSync('bash', ['-lc', command], {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        ...options,
      });
}

function runUnixChecked(command) {
  const child = runUnix(command);
  if (child.status !== 0) return null;
  return child.stdout.trim();
}

function resolveSpike() {
  if (process.env.SPIKE) {
    const resolved = runUnixChecked(`test -x ${shQuote(process.env.SPIKE)} && printf '%s' ${shQuote(process.env.SPIKE)}`);
    if (resolved) return resolved;
  }

  const pathSpike = runUnixChecked('command -v spike');
  if (pathSpike) return pathSpike;

  const commonPathCommands = [
    'test -x "$HOME/riscv-tools/bin/spike" && printf "%s" "$HOME/riscv-tools/bin/spike"',
    'test -x /opt/riscv/bin/spike && printf "%s" /opt/riscv/bin/spike',
    'test -x /usr/local/bin/spike && printf "%s" /usr/local/bin/spike',
  ];

  for (const command of commonPathCommands) {
    const resolved = runUnixChecked(command);
    if (resolved) return resolved;
  }

  return null;
}

function requireUnixTool(tool) {
  if (!runUnixChecked(`command -v ${shQuote(tool)}`)) {
    throw new Error(`Không tìm thấy ${tool}. Hãy cài GNU binutils RISC-V hoặc thêm toolchain vào PATH.`);
  }
}

function tohostPassFailBlock() {
  return `
pass:
  lui t0, ${TOHOST_HI20}
  addi gp, zero, 1
  sw gp, 0(t0)
pass_loop:
  jal zero, pass_loop
fail:
  lui t0, ${TOHOST_HI20}
  addi gp, zero, 3
  sw gp, 0(t0)
fail_loop:
  jal zero, fail_loop
`;
}

const programs = [
  {
    name: 'integer-branch',
    source: `.text 0x${TEXT_START.toString(16)}
  addi x1, zero, 7
  addi x2, zero, 5
  add x3, x1, x2
  addi x4, zero, 12
  bne x3, x4, fail
  sub x5, x3, x2
  bne x5, x1, fail
  slli x6, x1, 2
  addi x7, zero, 28
  bne x6, x7, fail
  jal zero, pass
${tohostPassFailBlock()}`,
  },
  {
    name: 'multiply-divide',
    source: `.text 0x${TEXT_START.toString(16)}
  addi x1, zero, 6
  addi x2, zero, 7
  mul x3, x1, x2
  addi x4, zero, 42
  bne x3, x4, fail
  div x5, x4, x1
  bne x5, x2, fail
  rem x6, x4, x1
  bne x6, zero, fail
  jal zero, pass
${tohostPassFailBlock()}`,
  },
  {
    name: 'single-precision-float',
    source: `.text 0x${TEXT_START.toString(16)}
  li x1, 0x3f800000
  fmv.w.x f1, x1
  li x2, 0x40000000
  fmv.w.x f2, x2
  fadd.s f3, f1, f2
  fmv.x.w x3, f3
  li x4, 0x40400000
  bne x3, x4, fail
  fmul.s f5, f1, f2
  fmv.x.w x5, f5
  li x6, 0x40000000
  bne x5, x6, fail
  jal zero, pass
${tohostPassFailBlock()}`,
  },
];

function buildWrapperAssembly(projectWords) {
  const wordLines = projectWords.map((word) => `  .word ${word}`).join('\n');
  return `.option norvc
.section .text.init,"ax",@progbits
.globl _start
_start:
  .word 0x000062B7
  .word 0x3002A073
${wordLines}

.section .tohost,"aw",@progbits
.align 6
.globl tohost
tohost:
  .dword 0
.globl fromhost
fromhost:
  .dword 0
`;
}

function buildElfFromProjectWords(programName, projectWords, workDir) {
  const wrapperPath = path.join(workDir, `${programName}.S`);
  const objectPath = path.join(workDir, `${programName}.o`);
  const elfPath = path.join(workDir, `${programName}.elf`);
  const linkerScript = path.join(repoRoot, 'riscv-tests', 'env', 'p', 'link.ld');

  writeFileSync(wrapperPath, buildWrapperAssembly(projectWords), 'utf8');

  const asResult = runUnix(
    [
      'riscv64-unknown-elf-as',
      '-march=rv32imf',
      '-mabi=ilp32f',
      shQuote(toUnixPath(wrapperPath)),
      '-o',
      shQuote(toUnixPath(objectPath)),
    ].join(' ')
  );
  if (asResult.status !== 0) throw new Error(asResult.stderr || asResult.stdout);

  const ldResult = runUnix(
    [
      'riscv64-unknown-elf-ld',
      '-m',
      'elf32lriscv',
      '-T',
      shQuote(toUnixPath(linkerScript)),
      shQuote(toUnixPath(objectPath)),
      '-o',
      shQuote(toUnixPath(elfPath)),
    ].join(' ')
  );
  if (ldResult.status !== 0) throw new Error(ldResult.stderr || ldResult.stdout);

  return elfPath;
}

function runSpike(spikePath, elfPath, isa) {
  return runUnix(
    `${shQuote(spikePath)} --isa=${shQuote(isa)} ${shQuote(toUnixPath(elfPath))}`,
    { timeout: DEFAULT_TIMEOUT_MS }
  );
}

function tail(text, lines = 12) {
  return text.trim().split('\n').slice(-lines).join('\n');
}

function main() {
  const isa = process.env.SPIKE_ISA || DEFAULT_ISA;
  const spikePath = resolveSpike();

  console.log('Project assembler Spike verification');
  console.log(`Reference: ${spikePath || '<not found>'}`);
  console.log(`ISA: ${isa}`);

  if (!spikePath) {
    console.error('Không tìm thấy Spike. Hãy thêm spike vào PATH hoặc đặt biến môi trường SPIKE=/duong/dan/toi/spike.');
    process.exit(1);
  }

  try {
    requireUnixTool('riscv64-unknown-elf-as');
    requireUnixTool('riscv64-unknown-elf-ld');
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const workDir = mkdtempSync(path.join(tmpdir(), 'project-assembler-spike-'));
  const results = [];

  try {
    for (const program of programs) {
      const projectWords = assembler.assemble(program.source).instructions.map((instruction) => instruction.hex);
      const elfPath = buildElfFromProjectWords(program.name, projectWords, workDir);
      const startedAt = Date.now();
      const child = runSpike(spikePath, elfPath, isa);
      results.push({
        name: program.name,
        words: projectWords.length,
        status: child.status,
        signal: child.signal,
        timedOut: child.error?.code === 'ETIMEDOUT',
        durationMs: Date.now() - startedAt,
        stdout: child.stdout || '',
        stderr: child.stderr || '',
      });
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }

  const failures = results.filter((result) => result.status !== 0 || result.signal || result.timedOut);
  const passed = results.length - failures.length;

  console.log(`- project assembler machine code: ${failures.length === 0 ? 'PASS' : 'FAIL'} (${passed}/${results.length} program pass)`);
  for (const result of results) {
    const state = result.status === 0 && !result.signal && !result.timedOut ? 'PASS' : 'FAIL';
    console.log(`  ${state} ${result.name} (${result.words} word(s), ${result.durationMs} ms)`);
  }

  if (failures.length > 0) {
    console.error('\nSpike failures:');
    for (const failure of failures) {
      console.error(`- ${failure.name}`);
      if (failure.timedOut) console.error(`  timed out after ${DEFAULT_TIMEOUT_MS} ms`);
      if (failure.signal) console.error(`  signal: ${failure.signal}`);
      if (failure.status !== null) console.error(`  exit status: ${failure.status}`);
      if (failure.stderr.trim()) console.error(`  stderr:\n${tail(failure.stderr)}`);
      if (failure.stdout.trim()) console.error(`  stdout:\n${tail(failure.stdout)}`);
    }
    process.exit(1);
  }
}

main();
