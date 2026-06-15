import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assembler } from '../src/js/assembler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Example .asm programs live in test/ (full library) and test/demo/ (the
// curated set demoed at the defense). Scan both so none drift from the syntax.
const searchDirs = [__dirname, path.join(__dirname, 'demo')];
const assemblyFiles = searchDirs
  .flatMap((dir) =>
    readdirSync(dir)
      .filter((name) => name.endsWith('.asm'))
      .map((name) => ({ name, dir }))
  )
  .sort((a, b) => a.name.localeCompare(b.name));

assert.ok(assemblyFiles.length > 0, 'No assembly sample files found under test/ or test/demo/.');

const results = [];

for (const { name: fileName, dir } of assemblyFiles) {
  const sourcePath = path.join(dir, fileName);
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
