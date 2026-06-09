# fig_4_13_socdiagram_demo.asm
# Demo phục vụ chụp Hình 4.13 — "Khung nhìn sơ đồ SoC với làm nổi bật giao dịch".
#
# Chương trình CHẠY VÔ HẠN: khi bấm Run liên tục, sơ đồ SoC luôn có giao dịch
# "sống" trên NHIỀU đường bus cùng lúc, nên chụp lúc nào cũng thấy nhiều đường
# được tô sáng (active / active-write) và các badge trạng thái có số liệu:
#   (1) CPU -> MMU -> L1/L2 -> TileLink-UH -> Main Memory   (vòng đọc/ghi bộ nhớ)
#   (2) DMA copy RAM -> LED Matrix   (TileLink-UH + cầu nối + TileLink-UL + LED)
#   (3) UART TX                      (TileLink-UH -> cầu nối -> TileLink-UL -> UART)
#
# CÁCH CHỤP:
#   - Assemble -> Run.
#   - Để thanh Speed ở mức VỪA (~30-60) để thấy chấm "pulse" chạy dọc đường bus.
#   - Mở khung nhìn "SoC" rồi chụp NGAY KHI ĐANG CHẠY.
#     (Bấm Stop/Pause sẽ làm các highlight tắt dần — phải chụp lúc đang chạy.)

    .data
pixel_row:
    .word 0x00FF0000, 0x0000FF00, 0x000000FF, 0x00FFFF00
    .word 0x00FF00FF, 0x0000FFFF, 0x00FFFFFF, 0x00FF8000
    .word 0x0080FF00, 0x008000FF, 0x00FF0080, 0x0000FF80
    .word 0x00FF4040, 0x004040FF, 0x0040FF40, 0x00FFFF80
    .word 0x00FF0000, 0x0000FF00, 0x000000FF, 0x00FFFF00
    .word 0x00FF00FF, 0x0000FFFF, 0x00FFFFFF, 0x00FF8000
    .word 0x0080FF00, 0x008000FF, 0x00FF0080, 0x0000FF80
    .word 0x00FF4040, 0x004040FF, 0x0040FF40, 0x00FFFF80
work_buf:
    .space 256

    .text 0x00400000
    .globl _start
_start:
    lui   s0, 0x10000        # s0 = UART base = 0x10000000
    lui   s1, 0xFFED0        # s1 = DMA_CTRL  = 0xFFED0000
    addi  s2, s1, 4          # s2 = DMA_DESC  = 0xFFED0004
    la    s3, pixel_row      # s3 = nguồn DMA trong RAM
    lui   s4, 0xFF000        # s4 = LED base  = 0xFF000000
    li    s5, 65             # s5 = ký tự 'A'

    li    t4, 1
    sw    t4, 0(s1)          # bật DMA (enable) một lần

loop:
    # (1) Lưu lượng bộ nhớ/cache: ghi rồi đọc lại 32 word -> CPU/MMU/cache/UH/RAM
    la    t0, work_buf
    li    t1, 0
    li    t2, 32
fill:
    sw    t1, 0(t0)
    lw    t3, 0(t0)
    addi  t0, t0, 4
    addi  t1, t1, 1
    bne   t1, t2, fill

    # (2) DMA copy 32 pixel RAM -> LED Matrix -> DMA/UH/cầu nối/UL/LED
    li    t4, 0x08000001     # ack cờ done, vẫn giữ enable
    sw    t4, 0(s1)
    sw    s3, 0(s2)          # desc word1: source
    sw    s4, 0(s2)          # desc word2: destination
    li    t5, 0xF0000020     # desc word3: dstMode=3, srcMode=3, 32 phần tử (word-incr)
    sw    t5, 0(s2)
    li    t4, 3
    sw    t4, 0(s1)          # EN | START
wait_dma:
    lw    t6, 0(s1)
    li    t5, 0x40000000     # cờ DONE (bit 30)
    and   t6, t6, t5
    beq   t6, x0, wait_dma

    # (3) UART phát một ký tự -> UH/cầu nối/UL/UART
    sw    s5, 0(s0)

    j     loop
