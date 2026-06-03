.data
msg:
    .ascii "Hello DMA\n"

.text
.globl _start
_start:
    # Load addresses
    la    t0, msg           # t0 = source address (in RAM .data)
    li    t1, 0x10000000    # t1 = UART TX register (dest)
    li    t2, 0xFFED0004    # t2 = DMA DESC register (write-only)
    li    t3, 0xFFED0000    # t3 = DMA CTRL register

    # Make UART very fast: set baud divisor = 1
    li    t4, 1
    sw    t4, 16(t1)        # UART_BAUD (offset 0x10)

    # Push descriptor: src, dst, config
    sw    t0, 0(t2)        # descriptor.word0 = source address
    sw    t1, 0(t2)        # descriptor.word1 = dest address (UART TX)

    # Config: srcMode=2 (increment by 1), dstMode=0 (fixed), bswap=0
    # config = (dstMode<<30) | (srcMode<<28) | (bswap<<27) | numElements
    # Config: srcMode=2, dstMode=0, numElements=10 -> 0x2000000A

    lui t5, 0x20000
    addi t5, t5, 10
    sw    t5, 0(t2)

    # Enable DMA (CTRL = 1)
    li    t4, 1
    sw    t4, 0(t3)

    # Start DMA (CTRL = 3 -> enable + start)
    li    t4, 3
    sw    t4, 0(t3)

wait_done:
    lw    t6, 0(t3)
    andi  t6, t6, 4        # check DONE bit (bit2)
    beq   t6, x0, wait_done

    # Ensure UART finished transmitting: wait for UART_STATUS.bit0 (TX ready)
wait_uart:
    lw    t6, 8(t1)       # read UART_STATUS (offset 0x08)
    andi  t6, t6, 0x10    # TX busy bit (bit4)
    bne   t6, x0, wait_uart

    # Exit (ecall)
    addi  x17, x0, 93
    addi  x10, x0, 0
    ecall
