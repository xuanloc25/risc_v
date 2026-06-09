.data
msg:
    .ascii "123456789a123456789a123456789a123456789a123456789a123456789a12345"
.text
.globl _start
_start:
    # --- 1. KHỞI TẠO TẤT CẢ THANH GHI Ở ĐẦU CHƯƠNG TRÌNH ---
    # Việc gom hằng số lên đầu giúp CPU giải mã (Decode) ổn định, không bị bẫy timing cache
    la    t0, msg           # t0 = source address (address of the message)
    li    t1, 0x10000000    # t1 = UART base address
    li    t2, 0xFFED0004    # t2 = DMA DESC register (write-only)
    li    t3, 0xFFED0000    # t3 = DMA CTRL register
    # Configure DMA: dst fixed (UART), src increment, src=32-bit, dst=8-bit, 65 elements
    li    t5, 0x18000041    # t5 = DMA config (65 bytes, src=word, dst=byte)

    # Make UART very fast: set baud divisor = 1
    li    t4, 1
    sw    t4, 16(t1)        # UART_BAUD (offset 0x10)

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

    # Wait until UART transmitter is idle (check TX busy at UART_STATUS offset 0x08)
wait_uart:
    lw    t6, 8(t1)
    andi  t6, t6, 0x10    # TX busy bit (bit4); loop while busy
    bne   t6, x0, wait_uart

    # Exit (ecall)
    addi  x17, x0, 93
    addi  x10, x0, 0
    ecall