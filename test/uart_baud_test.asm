# UART Baud Rate Test (Realistic Mode)
# Test với DIVISOR giống UART thực tế (STM32/ESP32)

.text
_start:
    li t5, 0x10000000    # UART base address
    
    # Tính divisor để có đúng 100 CPU cycles delay:
    # 
    # Công thức UART thực:
    # baud_rate = peripheral_clock / (oversampling × divisor)
    # 
    # Mục tiêu: 100 CPU cycles @ 100MHz = 1 μs
    # → baud_rate cần = (10 bits × 100MHz) / 100 = 10,000,000 baud
    # 
    # Giải cho divisor:
    # divisor = peripheral_clock / (oversampling × baud_rate)
    #         = 48,000,000 / (16 × 10,000,000)
    #         = 48,000,000 / 160,000,000
    #         = 0.3 → KHÔNG HỢP LỆ!
    #
    # Vì divisor < 1 không khả thi, dùng divisor = 1:
    # → baud_rate = 48,000,000 / (16 × 1) = 3,000,000 baud
    # → CPU cycles = (10 × 100,000,000) / 3,000,000 = 333 cycles
    
    li t0, 1             # Divisor = 1 (minimum)
    sw t0, 16(t5)        # UART_BAUD register (ghi DIVISOR, không phải baud!)
    
    # Gửi ký tự 'A'
    li t1, 65            # ASCII 'A'
    sw t1, 0(t5)         # UART_TX
    # → TX_READY = 0, txCyclesRemaining = 333
    
    # Polling loop - đợi TX_READY = 1
wait_tx_ready:
    lw t2, 8(t5)         # Đọc UART_STATUS
    andi t2, t2, 0x01    # Mask bit 0 (TX_READY)
    beqz t2, wait_tx_ready  # Nếu = 0 thì loop tiếp
    
    # TX ready lại → gửi 'B'
    li t1, 66            # ASCII 'B'
    sw t1, 0(t5)         # UART_TX
    
    # Exit
    li a7, 93
    ecall
