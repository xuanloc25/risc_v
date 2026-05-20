import assert from 'node:assert/strict';
import { assembler } from '../src/js/assembler.js';
import { simulator } from '../src/js/soc.js';

const source = `.data
msg:
    .asciiz "Hello from syscall!\\n"

.text
.globl _start
_start:
    la a0, msg
    li a7, 4
    ecall

    li a0, 0
    li a7, 93
    ecall`;

const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn
};

let stdout = '';
let exitCode = null;

try {
    console.log = () => {};
    console.info = () => {};
    console.warn = () => {};

    simulator.init();
    simulator.cpu.onSyscallOutput = (text) => {
        stdout += text;
    };
    simulator.cpu.onSyscallExit = (code) => {
        exitCode = code;
    };

    simulator.loadProgram(assembler.assemble(source));

    let cycles = 0;
    while (simulator.cpu.isRunning && cycles < 10000) {
        simulator.tick();
        cycles++;
    }
} finally {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
}

assert.equal(stdout, 'Hello from syscall!\n');
assert.equal(exitCode, 0);
assert.equal(simulator.cpu.isRunning, false);

console.log('Syscall output verification passed.');
