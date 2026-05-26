.text
.globl _start

_start:
    # ecall 100: map VA page 0x5000 to PA page 0x10010000.
    li a0, 0x5000
    lui a1, 0x10010
    li a2, 15              # R=1, W=2, X=4, cacheable=8
    li a7, 100
    ecall

    # Store through the virtual address and read it back through the mapping.
    li t0, 0x5020
    li t1, 0x12345678
    sw t1, 0(t0)
    lw t2, 0(t0)
    bne t2, t1, fail_map

    # ecall 101: unmap the VA page. Reading 0x5020 should now use identity
    # fallback, not the previous PA page.
    li a0, 0x5000
    li a7, 101
    ecall
    lw t3, 0(t0)
    bne t3, t1, unmap_ok
    j fail_unmap

unmap_ok:
    # Map again, then ecall 102 clears all mappings. The same VA should again
    # fall back to identity and must not read the mapped physical value.
    li a0, 0x5000
    lui a1, 0x10010
    li a2, 15
    li a7, 100
    ecall

    li a7, 102
    ecall
    lw t4, 0(t0)
    bne t4, t1, pass
    j fail_clear

pass:
    mv a0, t2
    li a7, 93
    ecall

fail_map:
    li a0, 0xBAD001
    li a7, 93
    ecall

fail_unmap:
    li a0, 0xBAD002
    li a7, 93
    ecall

fail_clear:
    li a0, 0xBAD003
    li a7, 93
    ecall
