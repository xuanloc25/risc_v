    addi x1, x0, 0x200      # base address in memory
    lui  x2, 0x12345         # upper 20 bits -> 0x12345000
    addi x2, x2, 0x678       # lower 12 bits -> final word 0x12345678
    sw   x2, 0(x1)           # store through bus
    lw   x3, 0(x1)           # load back through bus

    addi x10, x3, 0          # a0 = loaded value (for visibility)
    addi x17, x0, 93         # a7 = exit syscall
    ecall                    # exit(loaded_value)

//cache atomic

addi x1, x0, 0x200      # x1 = 0x200
addi x3, x0, 0x10       # Giá trị ban đầu trong RAM là 16 (0x10)
sw   x3, 0(x1)          # Lưu 0x10 vào địa chỉ 0x200

addi x2, x0, 0x5        # x2 = 5 (giá trị cộng thêm)
amoadd.w x4, x2, (x1)   # 1. Đọc giá trị cũ (0x10) từ 0x200 vào x4
                        # 2. Tính toán: 0x10 + 0x5 = 0x15
                        # 3. Ghi giá trị mới (0x15) ngược lại 0x200