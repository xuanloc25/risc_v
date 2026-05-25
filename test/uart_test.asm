# UART sample programs.
#
# Default entry: _start prints "Hello World!\n" through the UART TX register.
# Extra entries are kept as assemble-checked examples for manual simulator use.

.data
message:
    .string "Hello World!\n"

.text 0x00400000
.globl _start
_start:
    li t0, 0x10000000    # UART base
    la t6, message       # Pointer to the null-terminated message

print_loop:
    lbu t1, 0(t6)
    beqz t1, print_done

wait_tx_ready:
    lw t2, 8(t0)         # UART_STATUS
    andi t2, t2, 0x01    # Bit 0: TX ready
    beqz t2, wait_tx_ready

    sw t1, 0(t0)         # UART_TX
    addi t6, t6, 1
    j print_loop

print_done:
    li a0, 0
    li a7, 93
    ecall

# Optional echo demo. Change the entry point to _start_echo when debugging RX.
.globl _start_echo
_start_echo:
    li t0, 0x10000000    # UART base

echo_loop:
    lw t1, 8(t0)         # UART_STATUS
    andi t1, t1, 0x02    # Bit 1: RX available
    beqz t1, echo_loop

    lw t2, 4(t0)         # UART_RX
    sw t2, 0(t0)         # Echo back through UART_TX

    li t3, 10            # Stop after Enter/newline
    beq t2, t3, echo_done
    j echo_loop

echo_done:
    li a0, 0
    li a7, 93
    ecall

# Optional control-register demo: enable TX/RX interrupt bits and send 'O'.
.globl _start_uart_ctrl
_start_uart_ctrl:
    li t0, 0x10000000    # UART base
    li t1, 0x03          # Bit0 = TX_IE, bit1 = RX_IE
    sw t1, 12(t0)        # UART_CTRL

wait_tx_ready_ctrl:
    lw t5, 8(t0)
    andi t5, t5, 1
    beqz t5, wait_tx_ready_ctrl

    li t4, 79            # ASCII 'O'
    sw t4, 0(t0)

    li a0, 0
    li a7, 93
    ecall

# Optional LED pixel demo. It is intentionally not the default entry because
# this file is primarily a UART sample, but it still assembles with the rest.
.globl _start_led_pixel
_start_led_pixel:
    li t0, 0xFF000000    # LED matrix base
    li t1, 5             # x
    li t2, 10            # y
    li t3, 32            # width
    mul t4, t2, t3
    add t4, t4, t1
    slli t4, t4, 2
    add t0, t0, t4

    li t5, 0x00FF0000    # Red in 0x00RRGGBB
    sw t5, 0(t0)

    li a0, 0
    li a7, 93
    ecall
