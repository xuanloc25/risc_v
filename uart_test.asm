# UART Test Program
# In "Hello World!" ra UART Console

.text
_start:
    li t0, 0xffff0004    # UART base address
    
    # Print 'H'
    li t1, 72
    sw t1, 0(t0)
    
    # Print 'e'
    li t1, 101
    sw t1, 0(t0)
    
    # Print 'l'
    li t1, 108
    sw t1, 0(t0)
    sw t1, 0(t0)         # 'l' again
    
    # Print 'o'
    li t1, 111
    sw t1, 0(t0)
    
    # Print ' ' (space)
    li t1, 32
    sw t1, 0(t0)
    
    # Print 'W'
    li t1, 87
    sw t1, 0(t0)
    
    # Print 'o'
    li t1, 111
    sw t1, 0(t0)
    
    # Print 'r'
    li t1, 114
    sw t1, 0(t0)
    
    # Print 'l'
    li t1, 108
    sw t1, 0(t0)
    
    # Print 'd'
    li t1, 100
    sw t1, 0(t0)
    
    # Print '!'
    li t1, 33
    sw t1, 0(t0)
    
    # Print newline
    li t1, 10
    sw t1, 0(t0)
    
    # Exit properly with syscall 93
    li a7, 93            # Syscall ID for exit
    li a0, 0             # Exit code 0
    ecall

loop:

# Echo: �?�?c từ UART và gửi lại
.text
_start:
    li t0, 0x10000000    # UART base

loop:
    # Ch�? có data
wait:
    lw t1, 8(t0)         # �?�?c STATUS
    andi t1, t1, 2       # Check RX Available (bit 1)
    beqz t1, wait        # Loop nếu chưa có
    
    # �?�?c ký tự
    lw t2, 4(t0)         # �?�?c từ RX
    
    # Echo lại
    sw t2, 0(t0)         # Ghi vào TX
    
    # Kiểm tra Enter (ASCII 10)
    li t3, 10
    beq t2, t3, exit
    
    j loop

exit:
    li a7, 93            # Syscall exit
    li a0, 0
    ecall

-----
       .data
message:
    .string "Hello World!\n"
   .text
_start:
    li t0, 0x10000000    # UART base
    la t6, message       # Địa chỉ chuỗi
    
print_loop:
    lbu t1, 0(t6)        # Load 1 byte từ message
    beqz t1, done        # Nếu null terminator → exit
    
    # *** KIỂM TRA STATUS REGISTER (0x08) ***
wait_tx_ready:
    lw t2, 8(t0)         # Đọc UART_STATUS (offset 0x08)
    andi t2, t2, 0x01    # Mask bit 0 (TX_READY flag)
    beqz t2, wait_tx_ready  # Nếu = 0 → chưa ready, đợi tiếp
    
    # TX ready → gửi ký tự
    sw t1, 0(t0)         # Ghi vào UART_TX
    
    addi t6, t6, 1       # Tới ký tự tiếp theo
    j print_loop
    
done:
    li a7, 93
    ecall

# --- UART_CTRL demo: bật bit TX/RX interrupt enable, gửi một ký tự ---
# Đổi entry sang _start_uart_ctrl nếu muốn chạy đoạn này
.text
.globl _start_uart_ctrl
_start_uart_ctrl:
    li t0, 0x10000000    # UART base
    li t1, 0x03          # Bit0 = TX_IE, Bit1 = RX_IE
    sw t1, 12(t0)        # Ghi UART_CTRL (offset 0x0C)

    lw t2, 12(t0)        # Đọc lại UART_CTRL (t2 = 0x03)
    lw t3, 8(t0)         # Đọc UART_STATUS, bit2/bit3 phản ánh enable

    li t4, 79            # 'O'
wait_tx_ready_ctrl:
    lw t5, 8(t0)
    andi t5, t5, 1       # TX Ready?
    beqz t5, wait_tx_ready_ctrl

    sw t4, 0(t0)         # Gửi ký tự để thấy TX_IE=1 vẫn hoạt động

    li a7, 93            # exit
    li a0, 0
    ecall

led---
# Vẽ 1 pixel màu đỏ tại tọa độ (5, 10)
li t0, 0xFF000000        # LED Matrix base address
li t1, 5                 # x = 5
li t2, 10                # y = 10
li t3, 32                # width = 32
mul t4, t2, t3           # offset_y = y * width
add t4, t4, t1           # offset = y*width + x = 10*32+5 = 325
slli t4, t4, 2           # byte_offset = offset * 4 = 1300
add t0, t0, t4           # address = base + byte_offset

li t5, 0x00FF0000        # Màu đỏ (0x00RRGGBB)
sw t5, 0(t0)             # Ghi vào memory → LED sáng đỏ!
