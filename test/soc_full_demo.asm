# soc_full_demo.asm
# Short SoC demo: CPU/MMU/cache/main memory, TileLink-UL peripherals, and DMA.

    .data
mem_word:
    .word 0x12345678

dma_pixels:
    .word 0x00FF0000, 0x0000FF00, 0x000000FF, 0x00FFFFFF

    .text 0x00400000
    .globl _start
_start:
    # 1) Main-memory path: Core -> MMU -> cache -> TileLink-UH -> Main Memory.
    la    t0, mem_word
    lw    t1, 0(t0)          # first read: expected cache miss/fill
    lw    t2, 0(t0)          # second read: expected cache hit
    beq   t1, t2, mem_ok
    li    a0, 1              # fail if RAM/cache returned inconsistent data
    j     exit

mem_ok:
    # 2) UART MMIO: Core -> MMU -> TileLink-UH -> bridge -> TileLink-UL -> UART.
    lui   s0, 0x10000        # UART base = 0x10000000
    li    t3, 83             # ASCII 'S'
    sw    t3, 0(s0)          # UART_TX
    lw    t4, 8(s0)          # UART_STATUS

    # 3) Keyboard MMIO: read control/data once, no blocking wait.
    lui   s1, 0xFFFF0        # Keyboard base = 0xFFFF0000
    lw    t5, 0(s1)          # KEYBOARD_CTRL
    lw    t5, 4(s1)          # KEYBOARD_DATA

    # 4) Mouse MMIO: read position/buttons/status, then clear event bits.
    lui   s2, 0xFF100        # Mouse base = 0xFF100000
    lw    t6, 0(s2)          # MOUSE_X
    lw    t6, 4(s2)          # MOUSE_Y
    lw    t6, 8(s2)          # MOUSE_BTN
    lw    t6, 12(s2)         # MOUSE_STATUS
    li    t4, 3
    sw    t4, 12(s2)         # clear move/click bits

    # 5) DMA: CPU programs DMA regs, DMA copies 4 words from RAM to LED Matrix.
    lui   t0, 0xFFED0        # DMA_CTRL = 0xFFED0000
    addi  t1, t0, 4          # DMA_DESC = 0xFFED0004
    la    t2, dma_pixels     # source in main memory
    lui   t3, 0xFF000        # destination LED base = 0xFF000000

    li    t4, 1
    sw    t4, 0(t0)          # enable DMA
    sw    t2, 0(t1)          # descriptor word 1: source
    sw    t3, 0(t1)          # descriptor word 2: destination
    li    t5, 0xF0000004     # dstMode=3, srcMode=3, length=4 words
    sw    t5, 0(t1)          # descriptor word 3: config
    li    t4, 3
    sw    t4, 0(t0)          # EN | START

wait_dma_done:
    lw    t6, 0(t0)          # poll DMA_CTRL
    li    t5, 0x40000000     # DONE bit
    and   t6, t6, t5
    beq   t6, x0, wait_dma_done

    li    a0, 0              # pass

exit:
    li    a7, 93
    ecall
