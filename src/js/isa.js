// isa.js
// Nguồn chuẩn duy nhất (single source of truth) cho bảng định nghĩa lệnh RV32IMF(+A),
// dùng chung giữa assembler (mã hóa) và CPU (giải mã).
//
// - OPCODES: bảng định nghĩa lệnh theo schema của assembler (key chữ thường),
//   chứa toàn bộ dữ liệu mã hóa gốc và các pseudo instruction.
// - INSTRUCTION_FORMATS: bảng giải mã của CPU (key CHỮ HOA), được dẫn xuất tự động
//   từ OPCODES + DECODE_OVERRIDES, build đúng một lần khi module được nạp.
//
// Khi thêm lệnh mới: chỉ cần thêm vào OPCODES, lệnh sẽ tự xuất hiện ở cả hai phía.
// Chỉ khi decode cần cách match đặc biệt (matcher) mới phải thêm DECODE_OVERRIDES.

export const OPCODES = {
    // ----- RV32I Base Integer Instructions -----
    'lb': { opcode: '0000011', funct3: '000', type: 'I' }, 'lh': { opcode: '0000011', funct3: '001', type: 'I' },
    'lw': { opcode: '0000011', funct3: '010', type: 'I' }, 'lbu': { opcode: '0000011', funct3: '100', type: 'I' },
    'lhu': { opcode: '0000011', funct3: '101', type: 'I' }, 'sb': { opcode: '0100011', funct3: '000', type: 'S' },
    'sh': { opcode: '0100011', funct3: '001', type: 'S' }, 'sw': { opcode: '0100011', funct3: '010', type: 'S' },
    'addi': { opcode: '0010011', funct3: '000', type: 'I' }, 'slti': { opcode: '0010011', funct3: '010', type: 'I' },
    'sltiu': { opcode: '0010011', funct3: '011', type: 'I' }, 'xori': { opcode: '0010011', funct3: '100', type: 'I' },
    'ori': { opcode: '0010011', funct3: '110', type: 'I' }, 'andi': { opcode: '0010011', funct3: '111', type: 'I' },
    'slli': { opcode: '0010011', funct3: '001', funct7: '0000000', type: 'I-shamt' },
    'srli': { opcode: '0010011', funct3: '101', funct7: '0000000', type: 'I-shamt' },
    'srai': { opcode: '0010011', funct3: '101', funct7: '0100000', type: 'I-shamt' },
    'add': { opcode: '0110011', funct3: '000', funct7: '0000000', type: 'R' },
    'sub': { opcode: '0110011', funct3: '000', funct7: '0100000', type: 'R' },
    'sll': { opcode: '0110011', funct3: '001', funct7: '0000000', type: 'R' },
    'slt': { opcode: '0110011', funct3: '010', funct7: '0000000', type: 'R' },
    'sltu': { opcode: '0110011', funct3: '011', funct7: '0000000', type: 'R' },
    'xor': { opcode: '0110011', funct3: '100', funct7: '0000000', type: 'R' },
    'srl': { opcode: '0110011', funct3: '101', funct7: '0000000', type: 'R' },
    'sra': { opcode: '0110011', funct3: '101', funct7: '0100000', type: 'R' },
    'or': { opcode: '0110011', funct3: '110', funct7: '0000000', type: 'R' },
    'and': { opcode: '0110011', funct3: '111', funct7: '0000000', type: 'R' },
    'lui': { opcode: '0110111', type: 'U' }, 'auipc': { opcode: '0010111', type: 'U' },
    'jal': { opcode: '1101111', type: 'J' }, 'jalr': { opcode: '1100111', funct3: '000', type: 'I' },
    'beq': { opcode: '1100011', funct3: '000', type: 'B' }, 'bne': { opcode: '1100011', funct3: '001', type: 'B' },
    'blt': { opcode: '1100011', funct3: '100', type: 'B' }, 'bge': { opcode: '1100011', funct3: '101', type: 'B' },
    'bltu': { opcode: '1100011', funct3: '110', type: 'B' }, 'bgeu': { opcode: '1100011', funct3: '111', type: 'B' },
    'ecall': { opcode: '1110011', funct3: '000', funct7: '0000000', type: 'I' },
    'ebreak': { opcode: '1110011', funct3: '000', funct7: '0000001', type: 'I' },
    'fence': { opcode: '0001111', funct3: '000', type: 'I' },

    // ----- RV32M Standard Extension (Multiply/Divide) -----
    'mul': { opcode: '0110011', funct3: '000', funct7: '0000001', type: 'R' },
    'mulh': { opcode: '0110011', funct3: '001', funct7: '0000001', type: 'R' },
    'mulhsu': { opcode: '0110011', funct3: '010', funct7: '0000001', type: 'R' },
    'mulhu': { opcode: '0110011', funct3: '011', funct7: '0000001', type: 'R' },
    'div': { opcode: '0110011', funct3: '100', funct7: '0000001', type: 'R' },
    'divu': { opcode: '0110011', funct3: '101', funct7: '0000001', type: 'R' },
    'rem': { opcode: '0110011', funct3: '110', funct7: '0000001', type: 'R' },
    'remu': { opcode: '0110011', funct3: '111', funct7: '0000001', type: 'R' },

    // ----- RV32F Standard Extension (Single-Precision Floating-Point) -----
    'flw': { opcode: '0000111', funct3: '010', type: 'I-FP' },
    'fsw': { opcode: '0100111', funct3: '010', type: 'S-FP' },

    'fmadd.s': { opcode: '1000011', fmt: '00', type: 'R4-FP' },
    'fmsub.s': { opcode: '1000111', fmt: '00', type: 'R4-FP' },
    'fnmsub.s': { opcode: '1001011', fmt: '00', type: 'R4-FP' },
    'fnmadd.s': { opcode: '1001111', fmt: '00', type: 'R4-FP' },

    'fadd.s': { opcode: '1010011', funct7: '0000000', type: 'R-FP' },
    'fsub.s': { opcode: '1010011', funct7: '0000100', type: 'R-FP' },
    'fmul.s': { opcode: '1010011', funct7: '0001000', type: 'R-FP' },
    'fdiv.s': { opcode: '1010011', funct7: '0001100', type: 'R-FP' },
    'fsqrt.s': { opcode: '1010011', funct7: '0101100', rs2_subfield: '00000', type: 'R-FP-CVT' },
    'fmin.s': { opcode: '1010011', funct3: '000', funct7: '0010100', type: 'R-FP' },
    'fmax.s': { opcode: '1010011', funct3: '001', funct7: '0010100', type: 'R-FP' },

    'fsgnj.s': { opcode: '1010011', funct3: '000', funct7: '0010000', type: 'R-FP' },
    'fsgnjn.s': { opcode: '1010011', funct3: '001', funct7: '0010000', type: 'R-FP' },
    'fsgnjx.s': { opcode: '1010011', funct3: '010', funct7: '0010000', type: 'R-FP' },

    'fcvt.w.s': { opcode: '1010011', funct7: '1100000', rs2_subfield: '00000', type: 'R-FP-CVT', dest_is_int: true, src1_is_fp: true },
    'fcvt.wu.s': { opcode: '1010011', funct7: '1100000', rs2_subfield: '00001', type: 'R-FP-CVT', dest_is_int: true, src1_is_fp: true },
    'fcvt.s.w': { opcode: '1010011', funct7: '1101000', rs2_subfield: '00000', type: 'R-FP-CVT', dest_is_fp: true, src1_is_int: true },
    'fcvt.s.wu': { opcode: '1010011', funct7: '1101000', rs2_subfield: '00001', type: 'R-FP-CVT', dest_is_fp: true, src1_is_int: true },

    'feq.s': { opcode: '1010011', funct3: '010', funct7: '1010000', type: 'R-FP-CMP', dest_is_int: true },
    'flt.s': { opcode: '1010011', funct3: '001', funct7: '1010000', type: 'R-FP-CMP', dest_is_int: true },
    'fle.s': { opcode: '1010011', funct3: '000', funct7: '1010000', type: 'R-FP-CMP', dest_is_int: true },
    'fclass.s': { opcode: '1010011', funct3: '001', funct7: '1110000', rs2_subfield: '00000', type: 'R-FP-CVT', dest_is_int: true, src1_is_fp: true },

    'fmv.x.w': { opcode: '1010011', funct3: '000', funct7: '1110000', rs2_subfield: '00000', type: 'R-FP-CVT', dest_is_int: true, src1_is_fp: true },
    'fmv.w.x': { opcode: '1010011', funct3: '000', funct7: '1111000', rs2_subfield: '00000', type: 'R-FP-CVT', dest_is_fp: true, src1_is_int: true },

    // ----- RV32A Standard Extension (Atomic Instructions) -----
    'amoadd.w': { opcode: '0101111', funct3: '010', funct7: '0000000', type: 'R-AMO' },

    // ----- Pseudo Instructions -----
    'nop': { type: 'Pseudo', expandsTo: 'addi', args: ['x0', 'x0', '0'] },
    'li': { type: 'Pseudo' },
    'mv': { type: 'Pseudo', expandsTo: 'addi', args: [null, null, '0'] },
    'j': { type: 'Pseudo', expandsTo: 'jal', args: ['x0', null] },
    'jr': { type: 'Pseudo', expandsTo: 'jalr', args: ['x0', null, '0'] },
    'ret': { type: 'Pseudo', expandsTo: 'jalr', args: ['x0', 'x1', '0'] },
    'call': { type: 'Pseudo' },
    'bnez': { type: 'Pseudo', expandsTo: 'bne', args: [null, 'x0', null] },
    'beqz': { type: 'Pseudo', expandsTo: 'beq', args: [null, 'x0', null] },
    'la': { type: 'Pseudo' },
    'fmv.s': { type: 'Pseudo', expandsTo: 'fsgnj.s', args: [null, null, null] },
    'fabs.s': { type: 'Pseudo', expandsTo: 'fsgnjx.s', args: [null, null, null] },
    'fneg.s': { type: 'Pseudo', expandsTo: 'fsgnjn.s', args: [null, null, null] },
};

// Các field của OPCODES có ý nghĩa với giải mã; field chỉ dành cho assembler
// (dest_is_int, src1_is_fp, expandsTo, args, ...) không được mang sang bảng CPU.
const DECODE_FIELDS = ['type', 'opcode', 'funct3', 'funct7', 'fmt', 'rs2_subfield'];

// Lệnh assembler hỗ trợ nhưng CPU hiện không giải mã: fence được assemble
// bình thường nhưng decode trả về UNKNOWN (giữ nguyên hành vi trước refactor).
const DECODE_EXCLUDE = new Set(['fence']);

// Khác biệt giữa thông tin MÃ HÓA (assembler) và matcher GIẢI MÃ (CPU).
// rename: đổi tên field; drop: bỏ field; set: thêm/ghi đè field decode-đặc-thù.
const DECODE_OVERRIDES = {
    // I-shamt: decode phân biệt srli/srai bằng funct7 qua tên funct7Matcher
    'slli': { rename: { funct7: 'funct7Matcher' } },
    'srli': { rename: { funct7: 'funct7Matcher' } },
    'srai': { rename: { funct7: 'funct7Matcher' } },
    // ecall/ebreak phân biệt bằng toàn bộ trường imm 12 bit (imm[11:0])
    'ecall': { drop: ['funct7'], set: { immFieldMatcher: '000000000000' } },
    'ebreak': { drop: ['funct7'], set: { immFieldMatcher: '000000000001' } },
    // R4-FP/R-FP: funct3 là rounding mode nên decode chấp nhận mọi giá trị
    'fmadd.s': { set: { funct3: 'ANY' } },
    'fmsub.s': { set: { funct3: 'ANY' } },
    'fnmsub.s': { set: { funct3: 'ANY' } },
    'fnmadd.s': { set: { funct3: 'ANY' } },
    'fadd.s': { set: { funct3: 'ANY' } },
    'fsub.s': { set: { funct3: 'ANY' } },
    'fmul.s': { set: { funct3: 'ANY' } },
    'fdiv.s': { set: { funct3: 'ANY' } },
    // R-FP-CMP: decode match theo 5 bit đầu của funct7
    'feq.s': { drop: ['funct7'], set: { funct7_prefix: '10100' } },
    'flt.s': { drop: ['funct7'], set: { funct7_prefix: '10100' } },
    'fle.s': { drop: ['funct7'], set: { funct7_prefix: '10100' } },
    // R-FP-CVT có funct3 cố định (không phải rounding mode)
    'fclass.s': { rename: { funct3: 'funct3_fixed' } },
    'fmv.x.w': { rename: { funct3: 'funct3_fixed' } },
    'fmv.w.x': { rename: { funct3: 'funct3_fixed' } },
};

// Dẫn xuất bảng giải mã của CPU từ OPCODES (bỏ pseudo, áp DECODE_OVERRIDES).
export function buildInstructionFormats(opcodes = OPCODES) {
    const formats = {};
    for (const name in opcodes) {
        const entry = opcodes[name];
        if (entry.type === 'Pseudo' || DECODE_EXCLUDE.has(name)) continue;

        const format = {};
        for (const field of DECODE_FIELDS) {
            if (entry[field] !== undefined) format[field] = entry[field];
        }

        const override = DECODE_OVERRIDES[name];
        if (override) {
            if (override.rename) {
                for (const [from, to] of Object.entries(override.rename)) {
                    if (format[from] !== undefined) {
                        format[to] = format[from];
                        delete format[from];
                    }
                }
            }
            for (const field of override.drop || []) delete format[field];
            Object.assign(format, override.set);
        }

        formats[name.toUpperCase()] = format;
    }
    return formats;
}

export const INSTRUCTION_FORMATS = buildInstructionFormats();

// Đóng băng (deep-freeze) hai bảng dùng chung: trước refactor bảng decode được
// tạo mới ở mỗi lần decode() nên miễn nhiễm với mutation; giờ là singleton
// module-level nên freeze để mọi mutation vô tình ném lỗi ngay thay vì rò rỉ
// âm thầm giữa assembler và CPU.
function deepFreeze(obj) {
    for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (value !== null && typeof value === 'object') deepFreeze(value);
    }
    return Object.freeze(obj);
}
deepFreeze(OPCODES);
deepFreeze(INSTRUCTION_FORMATS);
