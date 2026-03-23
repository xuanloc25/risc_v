# Cache exercise program for the SoC default cache:
# - 2-way set associative, 16-byte blocks, 32 sets
# - Write-through + write-allocate
# - Congruent addresses are spaced by 0x200 bytes
#
# Sequence:
# - Write to addr0, then read twice (hit then hit, because write miss allocates)
# - Touch two more congruent addresses to fill and evict the set
# - Read addr0 again (should miss after eviction)

    li   x1, 0x0000      # addr0 = 0x0000
    li   x2, 0x0200      # addr1 = 0x0200 (same set)
    li   x5, 0x0400      # addr2 = 0x0400 (same set, causes eviction)

    li   x3, 0x12345678  # data word

    sw   x3, 0(x1)       # write addr0 (miss + allocate)
    lw   x4, 0(x1)       # read addr0 (hit)
    lw   x4, 0(x1)       # read addr0 (hit)

    lw   x4, 0(x2)       # miss, fills 2nd way in same set
    lw   x4, 0(x5)       # miss, evicts the least-recently-used line

    lw   x4, 0(x1)       # miss again if addr0 was evicted

    ecall                # stop
