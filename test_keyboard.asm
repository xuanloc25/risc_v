# test_keyboard.asm
# Tests Keyboard I/O by polling for input and echoing to UART
# Keyboard Control: 0xFFFF0000 (Bit 0 = Ready)
# Keyboard Data:    0xFFFF0004 (ASCII char)
# UART TX:          0x10000000 (Write char)

.text
.globl main

main:
    li s0, 0xFFFF0000   # Keyboard Control Address
    li s1, 0xFFFF0004   # Keyboard Data Address
    li s2, 0x10000000   # UART TX Address

    j loop_start

loop_start:
    # Poll Keyboard Control
    lw t0, 0(s0)
    andi t0, t0, 1      # Mask bit 0 (Ready bit)
    beqz t0, loop_start # If 0, keep waiting

    # Data available, read it
    lw t1, 0(s1)        # Read ASCII char
    
    # Echo to UART
    sw t1, 0(s2)
    
    # Loop back
    j loop_start
