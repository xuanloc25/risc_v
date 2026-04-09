    # L1: 16 set x 4 way, L2: 64 set x 4 way
    # Địa chỉ A = 0x0000, cùng set với các địa chỉ cách nhau 0x100 (L1: 16 set, block size 16)
    # Đảm bảo evict khỏi L1 nhưng không khỏi L2

    li   x1, 0x0000      # addr0 = 0x0000 (set 0)
    li   x2, 0x1000      # addr1 = 0x1000 (set 0)
    li   x3, 0x2000      # addr2 = 0x2000 (set 0)
    li   x4, 0x3000      # addr3 = 0x3000 (set 0)
    li   x5, 0x4000      # addr4 = 0x4000 (set 0, sẽ evict addr0 khỏi L1 nếu 4-way)

    li   t0, 0x11223344

    # Bước 1: Nạp block 0x0000 vào L1/L2
    sw   t0, 0(x1)       # miss, allocate vào L1/L2

    # Bước 2: Đầy L1 set 0 bằng 4 block khác
    sw   t0, 0(x2)       # miss, allocate
    sw   t0, 0(x3)       # miss, allocate
    sw   t0, 0(x4)       # miss, allocate

    # Bước 3: Truy cập lại addr0, L1 đã bị evict, L2 vẫn còn (vì L2 64 set, 4 way)
    lw   t1, 0(x1)       # L1 miss, L2 hit

    addi a0, t1, 0
    li   a7, 93
    ecall