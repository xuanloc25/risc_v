# AMOADD.W demo
# Ghi chú: `amoadd.w rd, rs2, offset(base)`
# - rd := old memory word
# - memory[base+offset] := old + rs2

.data
amo_var: .word 10         # biến dùng cho atomic add (ban đầu = 10)
results: .space 16        # lưu old/new values để kiểm tra

.text 0x00400000
_start:
    la x10, amo_var       # x10 = address của amo_var
    li x11, 7             # x11 = 7 (giá trị sẽ cộng vào memory)

    amoadd.w x5, x11, 0(x10)   # x5 = old (10); mem -> 10 + 7 = 17
    lw x6, 0(x10)              # x6 = new mem (17)

    la x12, results
    sw x5, 0(x12)          # lưu old vào results+0
    sw x6, 4(x12)          # lưu new vào results+4

    # Thử atomic add lần nữa (giá trị âm)
    li x11, -3
    amoadd.w x7, x11, 0(x10)   # x7 = old (17); mem -> 17 + (-3) = 14
    lw x8, 0(x10)              # x8 = new mem (14)
    sw x7, 8(x12)          # lưu old vào results+8
    sw x8, 12(x12)         # lưu new vào results+12

    # Kết thúc test: ebreak để dừng simulator
    ebreak
