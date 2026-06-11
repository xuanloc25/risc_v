# Comprehensive RV32F instruction smoke test
# Stores results to memory so you can inspect them in the simulator UI

.data
val_a: .float 1.5
val_b: .float 2.0
val_c: .float 3.5
val_d: .float -4.25

# Reserve space for results (in bytes)
results: .space 128

.text 0x00400000
_start:
    # Load test operands into FP registers
    la x1, val_a          # load address of val_a vào x1
    flw f1, 0(x1)         # load float tại [x1+0] vào f1  (f1 = 1.5)

    la x1, val_b          # load address của val_b vào x1
    flw f2, 0(x1)         # load float tại [x1+0] vào f2  (f2 = 2.0)

    la x1, val_c          # load address của val_c vào x1
    flw f3, 0(x1)         # load float tại [x1+0] vào f3  (f3 = 3.5)

    la x1, val_d          # load address của val_d vào x1
    flw f4, 0(x1)         # load float tại [x1+0] vào f4  (f4 = -4.25)

    la x10, results       # nạp địa chỉ base của buffer results vào x10

    # R4-FP (fmadd/fmsub/fnmsub/fnmadd) - 4-operand fused ops
    fmadd.s f5, f1, f2, f3    # f5 = (f1 * f2) + f3  (fused multiply-add)
    fsw f5, 0(x10)            # lưu f5 vào results+0

    fmsub.s f6, f1, f2, f3    # f6 = (f1 * f2) - f3
    fsw f6, 4(x10)            # lưu f6 vào results+4

    fnmsub.s f7, f1, f2, f3   # f7 = -(f1 * f2) + f3  (ưu tiên dấu theo mô tả simulator)
    fsw f7, 8(x10)            # lưu f7 vào results+8

    fnmadd.s f8, f1, f2, f3   # f8 = -(f1 * f2) - f3
    fsw f8, 12(x10)           # lưu f8 vào results+12

    # Phép toán FP cơ bản (add/sub/mul/div/sqrt/min/max)
    fadd.s f9, f1, f2         # f9 = f1 + f2
    fsw f9, 16(x10)           # lưu f9 vào results+16

    fsub.s f10, f2, f1        # f10 = f2 - f1
    fsw f10, 20(x10)          # lưu f10 vào results+20

    fmul.s f11, f1, f3        # f11 = f1 * f3
    fsw f11, 24(x10)          # lưu f11 vào results+24

    fdiv.s f12, f3, f2        # f12 = f3 / f2
    fsw f12, 28(x10)          # lưu f12 vào results+28

    fsqrt.s f13, f3           # f13 = sqrt(f3)
    fsw f13, 32(x10)          # lưu f13 vào results+32

    fmin.s f14, f1, f2        # f14 = min(f1, f2)
    fsw f14, 36(x10)          # lưu f14 vào results+36

    fmax.s f15, f1, f2        # f15 = max(f1, f2)
    fsw f15, 40(x10)          # lưu f15 vào results+40

    # Sign-injection (điều khiển bit dấu)
    fsgnj.s f16, f1, f4       # f16 = magnitude(f1) with sign of f4
    fsw f16, 44(x10)          # lưu f16 vào results+44

    fsgnjn.s f17, f1, f4      # f17 = magnitude(f1) with inverted sign of f4
    fsw f17, 48(x10)          # lưu f17 vào results+48

    fsgnjx.s f18, f1, f4      # f18 = magnitude(f1) with sign = sign(f1) XOR sign(f4)
    fsw f18, 52(x10)          # lưu f18 vào results+52

    # Chuyển đổi giữa FP và integer (convert)
    fcvt.w.s x5, f5           # chuyển f5 -> signed 32-bit integer, kết quả vào x5
    sw x5, 56(x10)            # lưu x5 vào results+56

    fcvt.wu.s x6, f5          # chuyển f5 -> unsigned 32-bit integer, vào x6
    sw x6, 60(x10)            # lưu x6 vào results+60

    li x7, 123                # load immediate 123 vào x7
    fcvt.s.w f19, x7          # chuyển signed int x7 -> float f19
    fsw f19, 64(x10)          # lưu f19 vào results+64

    li x8, 200                # load immediate 200 vào x8
    fcvt.s.wu f20, x8         # chuyển unsigned int x8 -> float f20
    fsw f20, 68(x10)          # lưu f20 vào results+68

    # Phân loại số và so sánh
    fclass.s x21, f1          # trả về bitmask kiểu số của f1, lưu vào x21
    sw x21, 72(x10)           # lưu x21 vào results+72

    feq.s x22, f1, f2         # x22 = (f1 == f2) ? 1 : 0 (NaN -> 0)
    sw x22, 76(x10)           # lưu x22 vào results+76

    flt.s x23, f1, f2         # x23 = (f1 < f2) ? 1 : 0 (NaN -> 0)
    sw x23, 80(x10)           # lưu x23 vào results+80

    fle.s x24, f1, f2         # x24 = (f1 <= f2) ? 1 : 0 (NaN -> 0)
    sw x24, 84(x10)           # lưu x24 vào results+84

    # Di chuyển / reinterpret bit (bitcast giữa float và int)
    fmv.x.w x25, f5           # copy bit pattern của f5 vào x25 (int)
    sw x25, 88(x10)           # lưu x25 vào results+88

    fmv.w.x f26, x25          # interpret x25 là bit pattern float -> lưu vào f26
    fsw f26, 92(x10)          # lưu f26 vào results+92

    # FLW/FSW round-trip: ghi rồi đọc lại để kiểm tra consistency
    fsw f1, 96(x10)           # ghi f1 vào results+96
    flw f27, 96(x10)          # đọc lại từ results+96 vào f27
    fsw f27, 100(x10)         # ghi f27 vào results+100

    # Kết thúc test: trap/ebreak để dừng simulator hoặc vào debugger
    ebreak
