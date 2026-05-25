# DMA LED demo: dùng DMA copy pixel data từ RAM lên LED Matrix
#
# Devices:
#   DMA CTRL @ 0xFFED0000  (bit0 EN, bit1 START, bit31 BUSY)
#   DMA DESC @ 0xFFED0004  (3 words: src, dst, config)
#   LED Matrix @ 0xFF000000 (32x32 pixels, 4 bytes/pixel, row-major)
#
# Config word format:
#   bits[31:30] = dstMode   (0/1=fixed, 2=byte-incr, 3=word-incr)
#   bits[29:28] = srcMode   (0/1=fixed, 2=byte-incr, 3=word-incr)
#   bit[27]     = bswap
#   bits[23:0]  = numElements
#
# Ví dụ này dùng srcMode=3, dstMode=3 (word-increment, 4 bytes/transfer):
#   config = (3<<30)|(3<<28)|32 = 0xF0000020
#
# Kết quả: DMA tự copy 32 pixel màu xanh lên hàng đầu LED Matrix
# CPU đồng thời tính tổng pixel data (song song với DMA)

    .data
# 32 pixels màu xanh lá (format: 0x00RRGGBB → G=0xFF = xanh)
pixel_row:
    .word 0x0000FF00, 0x0000FF00, 0x0000FF00, 0x0000FF00
    .word 0x0000FF00, 0x0000FF00, 0x0000FF00, 0x0000FF00
    .word 0x0000FF00, 0x0000FF00, 0x0000FF00, 0x0000FF00
    .word 0x0000FF00, 0x0000FF00, 0x0000FF00, 0x0000FF00
    .word 0x0000FF00, 0x0000FF00, 0x0000FF00, 0x0000FF00
    .word 0x0000FF00, 0x0000FF00, 0x0000FF00, 0x0000FF00
    .word 0x0000FF00, 0x0000FF00, 0x0000FF00, 0x0000FF00
    .word 0x0000FF00, 0x0000FF00, 0x0000FF00, 0x0000FF00
    # 32 words × 4 bytes = 128 bytes = hàng đầu tiên (row 0) của LED 32×32

    .text 0x00400000
    .globl _start
_start:
    # --- Địa chỉ thiết bị ---
    lui   t0, 0xFFED0          # t0 = DMA base = 0xFFED0000
    addi  t1, t0, 4            # t1 = DMA DESC  = 0xFFED0004
    lui   t3, 0xFF000          # t3 = LED base  = 0xFF000000

    # --- Con trỏ nguồn ---
    la    t2, pixel_row        # t2 = địa chỉ pixel_row trong RAM

    # --- Bật DMA (bit0 = EN) ---
    li    t4, 1
    sw    t4, 0(t0)

    # --- Đẩy descriptor vào FIFO (3 lần SW vào cùng 1 địa chỉ DESC) ---
    sw    t2, 0(t1)            # word 1: source address = pixel_row
    sw    t3, 0(t1)            # word 2: dest address   = LED Matrix base
    li    t5, 0xF0000020       # word 3: config
    #   0xF0000020 = (dstMode=3 << 30) | (srcMode=3 << 28) | 32 elements
    #   → 32 lần đọc/ghi 4 bytes, src tăng 4 mỗi lần, dst tăng 4 mỗi lần
    sw    t5, 0(t1)

    # --- Kích hoạt transfer (EN | START) ---
    li    t4, 3
    sw    t4, 0(t0)

    # --- CPU làm việc song song: tính tổng pixel trong khi DMA chạy ---
    li    a0, 0                # a0 = accumulator
    li    a2, 32               # a2 = số word còn lại
    mv    a3, t2               # a3 = con trỏ đọc pixel (bản sao của t2)

do_work:
    lw    t6, 0(t0)            # đọc DMA CTRL
    li    t5, 0x80000000       # mask bit BUSY (bit31)
    and   t6, t6, t5
    beq   t6, x0, dma_done    # BUSY=0 → DMA xong

    beq   a2, x0, do_work     # không còn việc → tiếp tục poll
    lw    t5, 0(a3)            # đọc 1 pixel word từ RAM
    add   a0, a0, t5           # sum += pixel
    addi  a3, a3, 4            # con trỏ += 4 bytes
    addi  a2, a2, -1           # counter--
    j     do_work

dma_done:
    # Tại đây:
    #   → LED Matrix hàng 0 đã được DMA tô màu xanh lá
    #   → a0 = tổng giá trị 32 pixel (CPU tính song song)
    # Với 32 pixel màu 0x0000FF00:
    #   a0 = 32 × 0x0000FF00 = 0x00FF0000 × ... = 0x1FE00 (thực tế là 0x0000FF00 * 32)

    li    a7, 93               # syscall exit
    ecall
