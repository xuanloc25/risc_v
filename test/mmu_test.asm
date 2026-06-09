.text
.globl _start
_start:
    li a0, 0x5000
    lui a1, 0x10010
    li a2, 15
    li a7, 100
    ecall
    li t0, 0x5020
    li t1, 0x12345678
    sw t1, 0(t0)
    lw t2, 0(t0)
    li a7, 0
    ecall