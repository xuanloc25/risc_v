# LED matrix demo: fill 32x32 with a simple gradient pattern
# LED VRAM base: 0xFF000000, word-per-pixel 0x00RRGGBB
# Color = (row << 16) | (col << 8) | 0x40 for visibility

    .text
    .globl _start
_start:
    lui   t0, 0xFF000          # t0 = LED base 0xFF000000
    li    t1, 0                # row = 0
    li    t6, 32               # limit = 32

row_loop:
    bge   t1, t6, done         # if row >= 32, finish
    li    t2, 0                # col = 0

col_loop:
    bge   t2, t6, next_row     # if col >= 32, next row

    # offset = ((row * 32) + col) * 4
    slli  t4, t1, 5            # row * 32
    add   t4, t4, t2           # row*32 + col
    slli  t4, t4, 2            # *4 bytes per pixel

    # color = (row << 16) | (col << 8) | 0x40
    slli  t3, t1, 16
    slli  t5, t2, 8
    or    t3, t3, t5
    ori   t3, t3, 0x40

    add   t5, t0, t4           # address = base + offset
    sw    t3, 0(t5)            # store color

    addi  t2, t2, 1            # col++
    j     col_loop

next_row:
    addi  t1, t1, 1            # row++
    j     row_loop

done:
    li    a0, 0
    li    a7, 93               # exit
    ecall
