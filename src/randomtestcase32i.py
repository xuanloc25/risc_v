from pathlib import Path
import random

# Tập lệnh cơ bản RV32I
instructions = [
    "addi {rd}, {rs1}, {imm}",
    "andi {rd}, {rs1}, {imm}",
    "ori {rd}, {rs1}, {imm}",
    "xori {rd}, {rs1}, {imm}",
    "slli {rd}, {rs1}, {shamt}",
    "srli {rd}, {rs1}, {shamt}",
    "srai {rd}, {rs1}, {shamt}",
    "add {rd}, {rs1}, {rs2}",
    "sub {rd}, {rs1}, {rs2}",
    "and {rd}, {rs1}, {rs2}",
    "or {rd}, {rs1}, {rs2}",
    "xor {rd}, {rs1}, {rs2}",
    "sll {rd}, {rs1}, {rs2}",
    "srl {rd}, {rs1}, {rs2}",
    "sra {rd}, {rs1}, {rs2}"
]

regs = [f"x{i}" for i in range(1, 32)]

def random_inst():
    inst = random.choice(instructions)
    rd = random.choice(regs)
    rs1 = random.choice(regs)
    rs2 = random.choice(regs)
    imm = random.randint(-2048, 2047)
    shamt = random.randint(0, 31)
    return inst.format(rd=rd, rs1=rs1, rs2=rs2, imm=imm, shamt=shamt)

# Sinh 10,000 lệnh + kết thúc bằng ecall
lines = [random_inst() for _ in range(10000)]
lines.append("li x10, 0\nli x17, 93\necall")

Path("test_rv32i_10000_full.S").write_text("\n".join(lines), encoding="utf-8")