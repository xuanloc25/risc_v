# CAN controller MMIO loopback demo.
#
# This uses the educational message-level CAN controller model. It verifies the
# controller/MMIO path only: no physical layer, bit-level arbitration, real CRC,
# ACK slot, or complete CAN error-frame behavior is modeled here.

.text
.globl _start

_start:
    li t0, 0xFF200000       # CAN base

    li t1, 5                # CTRL: EN | LOOPBACK
    sw t1, 0x00(t0)

    li t1, 0x123
    sw t1, 0x20(t0)         # TX_ID

    li t1, 8
    sw t1, 0x24(t0)         # TX_DLC

    li t1, 0x44332211
    sw t1, 0x28(t0)         # TX_DATA0

    li t1, 0x88776655
    sw t1, 0x2C(t0)         # TX_DATA1

    li t1, 1
    sw t1, 0x30(t0)         # CMD: SEND

wait_rx:
    lw t2, 0x04(t0)         # STATUS
    andi t2, t2, 2          # RX_AVAILABLE
    beq t2, x0, wait_rx

    lw t2, 0x40(t0)         # RX_ID
    li t3, 0x123
    bne t2, t3, fail_id

    lw t2, 0x44(t0)         # RX_DLC
    li t3, 8
    bne t2, t3, fail_dlc

    lw t2, 0x48(t0)         # RX_DATA0
    li t3, 0x44332211
    bne t2, t3, fail_data0

    lw t2, 0x4C(t0)         # RX_DATA1
    li t3, 0x88776655
    bne t2, t3, fail_data1

    li t1, 1
    sw t1, 0x50(t0)         # RX_POP

    lw t2, 0x04(t0)         # STATUS
    andi t2, t2, 2
    bne t2, x0, fail_pop

    li a0, 0
    li a7, 93
    ecall

fail_id:
    li a0, 1
    li a7, 93
    ecall

fail_dlc:
    li a0, 2
    li a7, 93
    ecall

fail_data0:
    li a0, 3
    li a7, 93
    ecall

fail_data1:
    li a0, 4
    li a7, 93
    ecall

fail_pop:
    li a0, 5
    li a7, 93
    ecall
