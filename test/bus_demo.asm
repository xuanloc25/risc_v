    addi x1, x0, 0x200      # base address in memory
    lui  x2, 0x12345         # upper 20 bits -> 0x12345000
    addi x2, x2, 0x678       # lower 12 bits -> final word 0x12345678
    sw   x2, 0(x1)           # store through bus
    lw   x3, 0(x1)           # load back through bus

    beq  x3, x2, pass
    addi x4, x0, 1          # fail marker: should not execute
    addi x10, x0, 1         # exit code = fail
    addi x17, x0, 93
    ecall

pass:
    addi x4, x0, 2          # pass marker
    addi x10, x3, 0
    addi x17, x0, 93
    ecall
