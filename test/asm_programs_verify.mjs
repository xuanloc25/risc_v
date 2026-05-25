import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assembler } from '../src/js/assembler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The .asm files in test/ are executable examples, not just notes. This
// guard keeps them from drifting away from the assembler syntax over time.
const assemblyFiles = readdirSync(__dirname)
  .filter((name) => name.endsWith('.asm'))
  .sort();

assert.ok(assemblyFiles.length > 0, 'No assembly sample files found under test/.');

const results = [];

for (const fileName of assemblyFiles) {
  const sourcePath = path.join(__dirname, fileName);
  const source = readFileSync(sourcePath, 'utf8');
  const assembled = assembler.assemble(source);

  assert.ok(
    assembled.instructions.length > 0,
    `${fileName} assembled without producing any instructions.`
  );
  assert.equal(
    Number.isFinite(assembled.startAddress),
    true,
    `${fileName} did not produce a finite start address.`
  );
  assert.equal(
    assembled.startAddress,
    0x00400000,
    `${fileName} should start from the simulator text base. Use ".text 0x00400000" after data sections.`
  );

  results.push({
    fileName,
    instructionCount: assembled.instructions.length,
    startAddress: `0x${assembled.startAddress.toString(16)}`,
  });
}

for (const result of results) {
  console.log(
    `PASS ${result.fileName}: ${result.instructionCount} instruction(s), start=${result.startAddress}`
  );
}

console.log(`Assembly sample verification passed (${results.length} file(s)).`);
