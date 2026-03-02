# UART Divisor Examples
# Các ví dụ tính divisor giống UART thực tế

# Công thức:
# baud_rate = peripheral_clock / (oversampling × divisor)
# divisor = peripheral_clock / (oversampling × baud_rate)
#
# Với PCLK = 48 MHz, Oversampling = 16x:

.text
_start:
    li t5, 0x10000000    # UART base

# ========================================
# Example 1: 115200 baud (chuẩn high-speed)
# ========================================
example_115200:
    # divisor = 48,000,000 / (16 × 115200) = 26.04 ≈ 26
    li t0, 26
    sw t0, 16(t5)        # UART_BAUD
    # → Actual baud: 48M/(16×26) = 115,384 baud (error 0.16%)
    
    la t6, msg_115200
    jal print_string

# ========================================
# Example 2: 9600 baud (chuẩn low-speed)
# ========================================
example_9600:
    # divisor = 48,000,000 / (16 × 9600) = 312.5 ≈ 312
    li t0, 312
    sw t0, 16(t5)
    # → Actual baud: 48M/(16×312) = 9,615 baud (error 0.16%)
    
    la t6, msg_9600
    jal print_string

# ========================================
# Example 3: 3 Mbaud (maximum với divisor=1)
# ========================================
example_3mbaud:
    # divisor = 1 (minimum)
    li t0, 1
    sw t0, 16(t5)
    # → Actual baud: 48M/(16×1) = 3,000,000 baud
    
    la t6, msg_3mbaud
    jal print_string
    
    # Exit
    li a7, 93
    ecall

# ========================================
# Function: print_string
# Input: t6 = string address
# ========================================
print_string:
    mv s2, ra            # Save return address
    
ps_loop:
    lbu t1, 0(t6)
    beqz t1, ps_done
    
    # Wait TX ready
ps_wait:
    lw t2, 8(t5)
    andi t2, t2, 0x01
    beqz t2, ps_wait
    
    sw t1, 0(t5)
    addi t6, t6, 1
    j ps_loop
    
ps_done:
    mv ra, s2            # Restore return address
    ret

.data
msg_115200:
    .string "115200 baud (divisor=26)\n"
msg_9600:
    .string "9600 baud (divisor=312)\n"
msg_3mbaud:
    .string "3 Mbaud (divisor=1)\n"
