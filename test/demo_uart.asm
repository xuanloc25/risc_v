.data
msg:
    .ascii "123456789a123456789a123456789a123456789a123456789a123456789a12345"
dst_buf:
    .space 128
.text 0x00400000
.globl _start
_start:
    # --- 1. KHỞI TẠO TẤT CẢ THANH GHI Ở ĐẦU CHƯƠNG TRÌNH ---
    # Việc gom hằng số lên đầu giúp CPU giải mã (Decode) ổn định, không bị bẫy timing cache
    la    t0, msg           # t0 = source address (address of the message)
    la    t1, dst_buf       # t1 = destination address (RAM buffer)
    li    t2, 0xFFED0004    # t2 = DMA DESC register (write-only)
    li    t3, 0xFFED0000    # t3 = DMA CTRL register
    # Configure DMA: src increment, dst increment, src=32-bit, dst=32-bit, 65 elements
    li    t5, 0x5A200005    # t5 = DMA config (65 bytes, src=word, dst=word)

    # No UART setup needed when writing to RAM

    # --- 2. ĐẨY DESCRIPTOR VÀO DMA FIFO ---
    # Word0 = source address
    sw    t0, 0(t2)
    
    # Word1 = destination address (UART TX register/base)
    sw    t1, 0(t2)
    
    # Word2 = config (Bây giờ lấy trực tiếp từ t5 an toàn tuyệt đối)
    sw    t5, 0(t2)         # Kích hoạt hoàn tất 3/3 từ khóa Descriptor!

    # --- 3. ĐIỀU KHIỂN HOẠT ĐỘNG DMA ---
    # Enable DMA (CTRL = 1)
    li    t4, 1
    sw    t4, 0(t3)

    # Start DMA (CTRL = 3 -> enable + start)
    li    t4, 3
    sw    t4, 0(t3)

wait_done:
    # Poll DMA CTRL for DONE bit (bit 2)
    lw    t6, 0(t3)
    andi  t6, t6, 4
    beq   t6, x0, wait_done

    # Exit (ecall)
    addi  x17, x0, 93
    addi  x10, x0, 0
    ecall
