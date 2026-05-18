import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

const DEFAULT_ISA = 'RV32IMF_zicclsm';
const DEFAULT_TIMEOUT_MS = 30_000;

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

function listBuiltRiscvTests() {
  const isaDir = path.join(repoRoot, 'riscv-tests', 'isa');
  try {
    return readdirSync(isaDir)
      .filter((name) => /^(rv32ui|rv32um|rv32uf)-p-[^.]+$/.test(name))
      .filter((name) => statSync(path.join(isaDir, name)).isFile())
      .sort()
      .map((name) => path.join(isaDir, name));
  } catch {
    return [];
  }
}

function tail(text, lines = 12) {
  return text.trim().split('\n').slice(-lines).join('\n');
}

function runSpikeTest(spikePath, elfPath, isa) {
  const command = `${shQuote(spikePath)} --isa=${shQuote(isa)} ${shQuote(toUnixPath(elfPath))}`;
  const startedAt = Date.now();
  const child = runUnix(command, { timeout: DEFAULT_TIMEOUT_MS });
  const durationMs = Date.now() - startedAt;

  return {
    elf: path.basename(elfPath),
    status: child.status,
    signal: child.signal,
    timedOut: child.error?.code === 'ETIMEDOUT',
    durationMs,
    stdout: child.stdout || '',
    stderr: child.stderr || '',
  };
}

function main() {
  const isa = process.env.SPIKE_ISA || DEFAULT_ISA;
  const spikePath = resolveSpike();

  console.log('Spike execution verification');
  console.log(`Reference: ${spikePath || '<not found>'}`);
  console.log(`ISA: ${isa}`);

  if (!spikePath) {
    console.error('Không tìm thấy Spike. Hãy thêm spike vào PATH hoặc đặt biến môi trường SPIKE=/duong/dan/toi/spike.');
    process.exit(1);
  }

  const tests = listBuiltRiscvTests();
  if (tests.length === 0) {
    console.log('SKIP: chưa có ELF rv32ui/rv32um/rv32uf trong riscv-tests/isa.');
    console.log('Gợi ý build: cd riscv-tests && make isa XLEN=32');
    return;
  }

  const results = tests.map((elfPath) => runSpikeTest(spikePath, elfPath, isa));
  const failures = results.filter((result) => result.status !== 0 || result.signal || result.timedOut);
  const passed = results.length - failures.length;

  console.log(`- riscv-tests Spike: ${failures.length === 0 ? 'PASS' : 'FAIL'} (${passed}/${results.length} ELF pass)`);

  for (const result of results) {
    const state = result.status === 0 && !result.signal && !result.timedOut ? 'PASS' : 'FAIL';
    console.log(`  ${state} ${result.elf} (${result.durationMs} ms)`);
  }

  if (failures.length > 0) {
    console.error('\nSpike failures:');
    for (const failure of failures.slice(0, 10)) {
      console.error(`- ${failure.elf}`);
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
