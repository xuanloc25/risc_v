# UART Test Program
# In "Hello World!" ra UART Console

.text
_start:
    li t0, 0x10000000    # UART base address
    
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

# Echo: Đọc từ UART và gửi lại
.text
_start:
    li t0, 0x10000000    # UART base

loop:
    # Chờ có data
wait:
    lw t1, 8(t0)         # Đọc STATUS
    andi t1, t1, 2       # Check RX Available (bit 1)
    beqz t1, wait        # Loop nếu chưa có
    
    # Đọc ký tự
    lw t2, 4(t0)         # Đọc từ RX
    
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