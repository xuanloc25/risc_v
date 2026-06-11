.text
.globl _start

# MMU smoke test: map một page VA, truy cập dữ liệu qua VA, rồi halt để quan sát access path đã map trong log MMU/TLB.
_start:
    # Map page VA 0x5000 sang page PA 0x10010000.
    li a0, 0x5000          # base của page VA
    lui a1, 0x10010        # base của page PA
    li a2, 15              # R | W | X | cacheable
    li a7, 100             # MMU map-page syscall
    ecall

    # Truy cập một địa chỉ bên trong page đã map. Translation phải đưa word này tới PA 0x10010020 thay vì địa chỉ literal 0x5020.
    li t0, 0x5020          # VA = 0x5000 + 0x20
    li t1, 0x12345678      # test pattern dễ nhận diện
    sw t1, 0(t0)
    lw t2, 0(t0)           # read back qua cùng VA

    li a7, 0               # implicit halt của simulator
    ecall
