# DMA demo: copy 16 bytes from src_data to dst_data using the DMA controller
# Devices:
#   DMA CTRL @ 0xFFED0000 (bit0 EN, bit1 START, bit31 BUSY, bit30 DONE)
#   DMA DESC @ 0xFFED0004 (write three words: src, dst, config)
# Config used: incrementing byte for src/dst, length 16 bytes, no byte-swap
    .data
src_data:
    .word 0x11223344, 0x55667788, 0x99AABBCC, 0xDDEEFF00

dst_data:
    .space 16                  # destination buffer for DMA

    .text
    .globl _start
_start:
    # Load device base addresses
    lui   t0, 0xFFED0          # t0 = DMA base 0xFFED0000
    addi  t1, t0, 4            # t1 = DESC register addr

    # Load src/dst pointers (use la pseudo for correct absolute addresses)
    la    t2, src_data
    la    t3, dst_data

    # Enable DMA (bit0)
    li    t4, 1
    sw    t4, 0(t0)

    # Queue descriptor: src, dst, config
    sw    t2, 0(t1)            # source address
    sw    t3, 0(t1)            # destination address
    li    t5, 0xA0000010       # config: dstMode=2, srcMode=2, len=16 bytes
    sw    t5, 0(t1)

    # Start transfer: EN|START
    li    t4, 3
    sw    t4, 0(t0)

poll_busy:
    lw    t6, 0(t0)            # read CTRL
    li    t5, 0x80000000       # BUSY bit
    and   t6, t6, t5
    bne   t6, x0, poll_busy    # wait while busy

    # (Optional) check DONE bit if needed

    # Exit with code 0
    li    a0, 0
    li    a7, 93
    ecall

