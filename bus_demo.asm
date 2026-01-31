    addi x1, x0, 0x200      # base address in memory
    lui  x2, 0x12345         # upper 20 bits -> 0x12345000
    addi x2, x2, 0x678       # lower 12 bits -> final word 0x12345678
    sw   x2, 0(x1)           # store through bus
    lw   x3, 0(x1)           # load back through bus

    addi x10, x3, 0          # a0 = loaded value (for visibility)
    addi x17, x0, 93         # a7 = exit syscall
    ecall                    # exit(loaded_value)
