import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assembler } from '../src/js/assembler.js';
import { simulator } from '../src/js/soc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function main() {
    console.log('Running MMU Syscall Verification...');

    // Load and compile assembly source
    const sourcePath = path.join(__dirname, 'mmu_syscall_test.asm');
    const source = readFileSync(sourcePath, 'utf8');
    const programData = assembler.assemble(source);

    // Initialize SoC simulator
    simulator.reset();
    simulator.loadProgram(programData);

    // Tick simulator until CPU halts (isRunning = false) or takes too long
    let cycles = 0;
    const maxCycles = 1000;
    while (simulator.cpu.isRunning && cycles < maxCycles) {
        simulator.tick();
        cycles++;
    }

    if (simulator.cpu.isRunning) {
        throw new Error(`Execution timed out after ${maxCycles} cycles.`);
    }

    console.log(`Execution completed in ${cycles} cycles.`);

    // Verify registers and memory
    const exitCode = simulator.cpu.registers[10]; // a0 contains the return code (t2 value)
    console.log(`Exit code (a0): 0x${(exitCode >>> 0).toString(16)}`);
    assert.equal(exitCode >>> 0, 0x12345678, 'Register t2 value should be 0x12345678');

    // Verify direct memory (physical address 0x10010020)
    // simulator.mem.mem is addressable byte-by-byte
    const byte0 = simulator.mem.mem[0x10010020] ?? 0;
    const byte1 = simulator.mem.mem[0x10010021] ?? 0;
    const byte2 = simulator.mem.mem[0x10010022] ?? 0;
    const byte3 = simulator.mem.mem[0x10010023] ?? 0;
    const physicalVal = (byte0 | (byte1 << 8) | (byte2 << 16) | (byte3 << 24)) >>> 0;
    console.log(`Physical mem at 0x10010020: 0x${physicalVal.toString(16)}`);
    assert.equal(physicalVal, 0x12345678, 'Physical memory should contain the written value');

    // Verify MMU stats
    const stats = simulator.mmu.stats;
    console.log('MMU Stats:', JSON.stringify(stats));
    assert.ok(stats.translations >= 4, 'Should translate mapped and identity-fallback accesses');
    assert.ok(stats.pageTableHits >= 1, 'First mapped access should hit the page table');
    assert.ok(stats.tlbHits >= 1, 'Second mapped access should hit the TLB');
    assert.ok(stats.tlbMisses >= 1, 'First mapped access should miss the TLB');
    assert.ok(stats.tlbRefills >= 1, 'Mapped page-table hit should refill the TLB');
    assert.equal(simulator.mmu.pageTable.size, 0, 'ecall 102 should clear page table mappings');
    assert.equal(simulator.mmu.tlbBlocks.filter(block => block.valid).length, 0, 'ecall 102 should clear TLB slots');

    console.log('MMU Syscall Verification PASS!');
}

main();
