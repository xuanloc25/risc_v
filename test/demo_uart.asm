.globl _start
_start:
    # UART base 0x10000000
    lui   x1, 0x10000

    addi  x2, x0, 65       # 'A'
    sw    x2, 0(x1)        # TX

wait_tx_ready:
    lw    x3, 8(x1)        # UART_STATUS
    andi  x3, x3, 1        # bit0 = TX ready
    beq   x3, x0, wait_tx_ready

    addi  x2, x0, 66       # 'B'
    sw    x2, 0(x1)        # TX

    addi  x17, x0, 93    # ecall: exit
    addi  x10, x0, 0     # exit code 0
    ecall
