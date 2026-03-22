    addi x1, x0, 0x200      # base address in memory
    lui  x2, 0x12345         # upper 20 bits -> 0x12345000
    addi x2, x2, 0x678       # lower 12 bits -> final word 0x12345678
    sw   x2, 0(x1)           # store through bus
    lw   x3, 0(x1)           # load back through bus

    addi x10, x3, 0          # a0 = loaded value (for visibility)
    addi x17, x0, 93         # a7 = exit syscall
    ecall                    # exit(loaded_value)

//cache 

    addi x1, x0, 0x200      # A = 0x200
    lui  x2, 0x11111
    addi x2, x2, 0x111
    sw   x2, 0(x1)          # miss -> nạp block A vào cache

    addi x3, x0, 0x400      # B = 0x400
    lui  x4, 0x22222
    addi x4, x4, 0x222
    sw   x4, 0(x3)          # miss -> nạp block B vào cùng set

    addi x5, x0, 0x600      # C = 0x600
    lui  x6, 0x33333
    addi x6, x6, 0x333
    sw   x6, 0(x5)          # miss -> cùng set nữa, gây eviction

    lw   x7, 0(x1)         
    lw   x8, 0(x3)          
    lw   x9, 0(x5)          

    addi x17, x0, 93
    ecall