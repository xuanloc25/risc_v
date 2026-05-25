# Cache smoke program.
#
# Goal: touch several addresses that map to the same L1 set, then read the
# first address again. The simulator logs should show L1 pressure while the
# final value proves the memory path still returns the original word.

.text
.globl _start
_start:
    li   x1, 0x0000      # addr0: set 0
    li   x2, 0x1000      # same L1 set, different tag
    li   x3, 0x2000      # same L1 set, different tag
    li   x4, 0x3000      # same L1 set, different tag
    li   x5, 0x4000      # same L1 set, can evict addr0 in a 4-way L1

    li   t0, 0x11223344

    # Fill addr0 first so the later read has a known expected value.
    sw   t0, 0(x1)

    # Fill more blocks from the same L1 set to exercise replacement behavior.
    sw   t0, 0(x2)
    sw   t0, 0(x3)
    sw   t0, 0(x4)
    sw   t0, 0(x5)

    # Read addr0 after cache pressure. The value is returned as the exit code
    # for quick manual inspection, while asm_programs_verify.mjs checks that
    # this sample continues to assemble.
    lw   t1, 0(x1)
    addi a0, t1, 0
    li   a7, 93
    ecall

# Expected log shape when run in the simulator:
# - first store to addr0 misses and allocates a block
# - stores to x2..x5 create more misses in the same L1 set
# - the final load of addr0 should still return 0x11223344
