.globl _start
_start:
    # UART base 0x10000000
    lui   x1, 0x10000

    # Increase UART speed: set baud divisor to 1 (very fast)
    addi  x2, x0, 1
    sw    x2, 16(x1)       # UART_BAUD (offset 0x10)

    # Send 'A'
    addi  x2, x0, 65       # 'A'
    sw    x2, 0(x1)        # TX

wait_tx_ready_A:
    lw    x3, 8(x1)        # UART_STATUS
    andi  x3, x3, 1        # bit0 = TX ready
    beq   x3, x0, wait_tx_ready_A

    # Send 'B'
    addi  x2, x0, 66       # 'B'
    sw    x2, 0(x1)        # TX

wait_tx_ready_B:
    lw    x3, 8(x1)        # UART_STATUS
    andi  x3, x3, 1        # bit0 = TX ready
    beq   x3, x0, wait_tx_ready_B

    # Send 'C'
    addi  x2, x0, 67       # 'C'
    sw    x2, 0(x1)        # TX

wait_tx_ready_C:
    lw    x3, 8(x1)        # UART_STATUS
    andi  x3, x3, 1        # bit0 = TX ready
    beq   x3, x0, wait_tx_ready_C

    addi  x17, x0, 93    # ecall: exit
    addi  x10, x0, 0     # exit code 0
    ecall
