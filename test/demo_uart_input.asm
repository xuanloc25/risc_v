    .text 0x00400000
    .globl _start
_start:
    # UART base 0x10000000
    lui   x1, 0x10000

    # Make UART fast for demo
    addi  x2, x0, 1
    sw    x2, 16(x1)       # UART_BAUD (offset 0x10)

echo_loop:
    # Wait for RX available (UART_STATUS bit1)
wait_rx:
    lw    x3, 8(x1)        # UART_STATUS
    andi  x3, x3, 2        # bit1 = RX available
    beq   x3, x0, wait_rx

    lw    x4, 4(x1)        # UART_RX -> x4 (read incoming char)

    # Echo received char back via UART_TX
    sw    x4, 0(x1)        # UART_TX

    # Wait until TX finished (UART_STATUS bit4 == 0)
wait_tx:
    lw    x3, 8(x1)
    andi  x3, x3, 16       # bit4 = TX busy
    bne   x3, x0, wait_tx

    # Exit on newline (ASCII 10), otherwise loop
    addi  x5, x0, 10
    beq   x4, x5, done
    j     echo_loop

done:
    addi  x17, x0, 93    # ecall: exit
    addi  x10, x0, 0     # exit code 0
    ecall
