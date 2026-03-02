# Cache exercise program
# - Write to addr0, read twice (miss then hit)
# - Touch four more congruent addresses to fill the 4-way set
# - Touch a fifth to evict the first
# - Read addr0 again (should miss after eviction)

    addi x1, x0, 0       # addr0 = 0x0000
    lui  x2, 0x0
    addi x2, x2, 0x400   # addr1 = 0x0400 (same set)
    lui  x5, 0x0
    addi x5, x5, 0x800   # addr2 = 0x0800 (same set)
    lui  x6, 0x0
    addi x6, x6, 0xC00   # addr3 = 0x0C00 (same set)
    lui  x7, 0x0
    addi x7, x7, 0x1000  # addr4 = 0x1000 (same set, causes eviction)

    addi x3, x0, 0x1234  # data word

    sw   x3, 0(x1)       # write addr0 (miss + allocate)
    lw   x4, 0(x1)       # read addr0 (hit after fill)
    lw   x4, 0(x1)       # read addr0 (hit)

    lw   x4, 0(x2)       # miss set fill 1
    lw   x4, 0(x5)       # miss set fill 2
    lw   x4, 0(x6)       # miss set fill 3
    lw   x4, 0(x7)       # miss set fill 4 (evicts one)

    lw   x4, 0(x1)       # likely miss (evicted)

    ecall                # stop
