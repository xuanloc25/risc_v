# Mouse demo: map mouse position to a pixel on 32x32 LED matrix
# - Move mouse: pixel follows cursor (wrapped to 32x32)
# - Left click => red, Right click => blue, otherwise green
# Memory-mapped ranges:
#   Mouse  base: 0xFF100000 (X,Y,BTN,STATUS,CTRL)
#   LED    base: 0xFF000000 (VRAM word-per-pixel 0x00RRGGBB)

    .text
    .globl _start
_start:
    # t0 = mouse base, a0 = LED base (upper part set later per pixel)
    lui   t0, 0xFF100       # 0xFF100000

loop:
    lw    t1, 0(t0)         # t1 = mouse X
    lw    t2, 4(t0)         # t2 = mouse Y
    lw    t3, 8(t0)         # t3 = button bitmap (bit0 L, bit1 R, bit2 M)
    lw    t4, 12(t0)        # t4 = status (bit0 move, bit1 click)

    # Clear status bits we consumed (move/click)
    li    t5, 0x3
    sw    t5, 12(t0)

    # Wrap to 0..31 for 32x32 LED grid
    andi  t1, t1, 31        # x
    andi  t2, t2, 31        # y

    # Pick color based on button
    li    t6, 0x0000FF00    # green default
    andi  t5, t3, 1         # left button?
    bne   t5, x0, set_red
    andi  t5, t3, 2         # right button?
    bne   t5, x0, set_blue
    j     have_color
set_red:
    li    t6, 0x00FF0000
    j     have_color
set_blue:
    li    t6, 0x000000FF
have_color:

    # offset = (y*32 + x) * 4
    slli  t4, t2, 5         # y*32
    add   t4, t4, t1        # y*32 + x
    slli  t4, t4, 2         # *4 bytes per pixel

    lui   a0, 0xFF000       # LED base upper 20 bits (0xFF000000)
    add   a0, a0, t4
    sw    t6, 0(a0)         # write color to VRAM

    j     loop              # run forever
