# Test for RV32F FMA, Sign Injection, and Conversions

.data
val1: .float 1.5
val2: .float 2.0
val3: .float 3.5

.text
_start:
    # Load values into floating point registers
    la x10, val1
    flw f1, 0(x10)       # f1 = 1.5
    
    la x10, val2
    flw f2, 0(x10)       # f2 = 2.0
    
    la x10, val3
    flw f3, 0(x10)       # f3 = 3.5

    # 1. Test FMA (f1 * f2) + f3 = (1.5 * 2.0) + 3.5 = 6.5
    fmadd.s f4, f1, f2, f3

    # 2. Test Sign Injection
    # fsgnj.s f5, f4, f4 (Move 6.5)
    fsgnj.s f5, f4, f4
    
    # fsgnjn.s f6, f4, f4 (Negate 6.5 -> -6.5)
    fsgnjn.s f6, f4, f4

    # 3. Test Cross-Register Write-Backs
    # fclass.s should write to integer register x5
    fclass.s x5, f6
    
    # fcvt.w.s should write integer representation of f4 (6.5 -> 6) to x6
    fcvt.w.s x6, f4
    
    # fcvt.s.w should write float representation of x7 (let's say 10) to f7
    li x7, 10
    fcvt.s.w f7, x7

    # End
    ebreak
