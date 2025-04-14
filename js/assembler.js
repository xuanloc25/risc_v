export const assembler = {
    memory: {},        // Bộ nhớ ảo (địa chỉ byte -> giá trị byte) - CHỈ CHO DATA
    labels: {},        // Bảng nhãn { labelName: { address: number, isGlobal: boolean } | number (cho .equ) }
    equValues: {},     // Lưu trữ giá trị của các hằng số .equ riêng biệt
    currentSection: null, // Section hiện tại: 'data' hoặc 'text'
    currentAddress: 0,   // Địa chỉ bộ nhớ hiện tại (tính bằng byte)
    instructionLines: [], // Mảng lưu trữ các dòng gốc và thông tin tạm thời (địa chỉ)

    // Ánh xạ tên thanh ghi (ABI Names và MIPS-style) sang tên RISC-V chuẩn (Xn)
    registerMapping: {
        '$ZERO': 'X0', '$0': 'X0', 'ZERO': 'X0',
        '$RA': 'X1', '$1': 'X1', 'RA': 'X1',
        '$SP': 'X2', '$2': 'X2', 'SP': 'X2',
        '$GP': 'X3', '$3': 'X3', 'GP': 'X3',
        '$TP': 'X4', '$4': 'X4', 'TP': 'X4',
        '$T0': 'X5', '$5': 'X5', 'T0': 'X5',
        '$T1': 'X6', '$6': 'X6', 'T1': 'X6',
        '$T2': 'X7', '$7': 'X7', 'T2': 'X7',
        '$S0': 'X8', '$8': 'X8', 'S0': 'X8', '$FP': 'X8', 'FP': 'X8', // FP là alias của S0
        '$S1': 'X9', '$9': 'X9', 'S1': 'X9',
        '$A0': 'X10', '$10': 'X10', 'A0': 'X10',
        '$A1': 'X11', '$11': 'X11', 'A1': 'X11',
        '$A2': 'X12', '$12': 'X12', 'A2': 'X12',
        '$A3': 'X13', '$13': 'X13', 'A3': 'X13',
        '$A4': 'X14', '$14': 'X14', 'A4': 'X14',
        '$A5': 'X15', '$15': 'X15', 'A5': 'X15',
        '$A6': 'X16', '$16': 'X16', 'A6': 'X16',
        '$A7': 'X17', '$17': 'X17', 'A7': 'X17',
        '$S2': 'X18', '$18': 'X18', 'S2': 'X18',
        '$S3': 'X19', '$19': 'X19', 'S3': 'X19',
        '$S4': 'X20', '$20': 'X20', 'S4': 'X20',
        '$S5': 'X21', '$21': 'X21', 'S5': 'X21',
        '$S6': 'X22', '$22': 'X22', 'S6': 'X22',
        '$S7': 'X23', '$23': 'X23', 'S7': 'X23',
        '$S8': 'X24', '$24': 'X24', 'S8': 'X24',
        '$S9': 'X25', '$25': 'X25', 'S9': 'X25',
        '$S10': 'X26', '$26': 'X26', 'S10': 'X26',
        '$S11': 'X27', '$27': 'X27', 'S11': 'X27',
        '$T3': 'X28', '$28': 'X28', 'T3': 'X28',
        '$T4': 'X29', '$29': 'X29', 'T4': 'X29',
        '$T5': 'X30', '$30': 'X30', 'T5': 'X30',
        '$T6': 'X31', '$31': 'X31', 'T6': 'X31',
        // Thêm cả tên X0, X1,... để chuẩn hóa cả trường hợp viết hoa/thường
        'X0': 'X0', 'X1': 'X1', 'X2': 'X2', 'X3': 'X3', 'X4': 'X4', 'X5': 'X5',
        'X6': 'X6', 'X7': 'X7', 'X8': 'X8', 'X9': 'X9', 'X10': 'X10', 'X11': 'X11',
        'X12': 'X12', 'X13': 'X13', 'X14': 'X14', 'X15': 'X15', 'X16': 'X16', 'X17': 'X17',
        'X18': 'X18', 'X19': 'X19', 'X20': 'X20', 'X21': 'X21', 'X22': 'X22', 'X23': 'X23',
        'X24': 'X24', 'X25': 'X25', 'X26': 'X26', 'X27': 'X27', 'X28': 'X28', 'X29': 'X29',
        'X30': 'X30', 'X31': 'X31'
    },

    // Định nghĩa các chỉ thị assembler
    directives: {
        ".data": { minArgs: 0, maxArgs: 1, handler: function (args) { this._handleDataDirective(args); } },
        ".text": { minArgs: 0, maxArgs: 1, handler: function (args) { this._handleTextDirective(args); } },
        ".word": { minArgs: 1, maxArgs: Infinity, handler: function (args) { this._handleWordDirective(args); } },
        ".half": { minArgs: 1, maxArgs: Infinity, handler: function (args) { this._handleHalfDirective(args); } },
        ".byte": { minArgs: 1, maxArgs: Infinity, handler: function (args) { this._handleByteDirective(args); } },
        ".ascii": { minArgs: 1, maxArgs: 1, handler: function (args) { this._handleAsciiDirective(args); } },
        ".asciiz": { minArgs: 1, maxArgs: 1, handler: function (args) { this._handleAsciizDirective(args); } },
        ".string": { minArgs: 1, maxArgs: 1, handler: function (args) { this._handleAsciizDirective(args); } }, //alias cho .asciiz 
        ".space": { minArgs: 1, maxArgs: 1, handler: function (args) { this._handleSpaceDirective(args); } },
        ".align": { minArgs: 1, maxArgs: 1, handler: function (args) { this._handleAlignDirective(args); } },
        ".global": { minArgs: 1, maxArgs: 1, handler: function (args) { this._handleGlobalDirective(args); } },
        ".globl": { minArgs: 1, maxArgs: 1, handler: function (args) { this._handleGlobalDirective(args); } }, // alias
        ".extern": { minArgs: 1, maxArgs: Infinity, handler: function (args) { this._handleExternDirective(args); } }, // Cho phép nhiều externals
        ".equ": { minArgs: 2, maxArgs: 2, handler: function (args) { this._handleEquDirective(args); } },
    },

    // Định nghĩa định dạng các lệnh RISC-V
    instructionFormats: {
        // R-Type
        "ADD": { type: "R", opcode: "0110011", funct3: "000", funct7: "0000000" },
        "SUB": { type: "R", opcode: "0110011", funct3: "000", funct7: "0100000" },
        "SLL": { type: "R", opcode: "0110011", funct3: "001", funct7: "0000000" },
        "SLT": { type: "R", opcode: "0110011", funct3: "010", funct7: "0000000" },
        "SLTU": { type: "R", opcode: "0110011", funct3: "011", funct7: "0000000" },
        "XOR": { type: "R", opcode: "0110011", funct3: "100", funct7: "0000000" },
        "SRL": { type: "R", opcode: "0110011", funct3: "101", funct7: "0000000" },
        "SRA": { type: "R", opcode: "0110011", funct3: "101", funct7: "0100000" },
        "OR": { type: "R", opcode: "0110011", funct3: "110", funct7: "0000000" },
        "AND": { type: "R", opcode: "0110011", funct3: "111", funct7: "0000000" },
        // I-Type
        "LW": { type: "I", opcode: "0000011", funct3: "010" },
        "LH": { type: "I", opcode: "0000011", funct3: "001" },
        "LB": { type: "I", opcode: "0000011", funct3: "000" },
        "LHU": { type: "I", opcode: "0000011", funct3: "101" },
        "LBU": { type: "I", opcode: "0000011", funct3: "100" },
        "ADDI": { type: "I", opcode: "0010011", funct3: "000" },
        "SLTI": { type: "I", opcode: "0010011", funct3: "010" },
        "SLTIU": { type: "I", opcode: "0010011", funct3: "011" },
        "XORI": { type: "I", opcode: "0010011", funct3: "100" },
        "ORI": { type: "I", opcode: "0010011", funct3: "110" },
        "ANDI": { type: "I", opcode: "0010011", funct3: "111" },
        "SLLI": { type: "I", opcode: "0010011", funct3: "001", funct7: "0000000" },
        "SRLI": { type: "I", opcode: "0010011", funct3: "101", funct7: "0000000" },
        "SRAI": { type: "I", opcode: "0010011", funct3: "101", funct7: "0100000" },
        "JALR": { type: "I", opcode: "1100111", funct3: "000" },
        // S-Type
        "SW": { type: "S", opcode: "0100011", funct3: "010" },
        "SH": { type: "S", opcode: "0100011", funct3: "001" },
        "SB": { type: "S", opcode: "0100011", funct3: "000" },
        // B-Type
        "BEQ": { type: "B", opcode: "1100011", funct3: "000" },
        "BNE": { type: "B", opcode: "1100011", funct3: "001" },
        "BLT": { type: "B", opcode: "1100011", funct3: "100" },
        "BGE": { type: "B", opcode: "1100011", funct3: "101" },
        "BLTU": { type: "B", opcode: "1100011", funct3: "110" },
        "BGEU": { type: "B", opcode: "1100011", funct3: "111" },
        // U-Type
        "LUI": { type: "U", opcode: "0110111" },
        "AUIPC": { type: "U", opcode: "0010111" },
        // J-Type
        "JAL": { type: "J", opcode: "1101111" },
        // System
        "ECALL": { type: "I", opcode: "1110011", funct3: "000", immField: "000000000000" },
        "EBREAK": { type: "I", opcode: "1110011", funct3: "000", immField: "000000000001" },
    },

    assemble(assemblyCode) {
        this._reset();
        const lines = assemblyCode.split("\n");
        let assembledInstructions = [];

        console.log("Starting Assembly Pass 1...");
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            try {
                const parsedLine = this._parseLine(line, i);
                if (parsedLine) {
                    if (parsedLine.type === 'instruction') {
                        if (this.currentSection !== 'text') {
                            if (this.currentSection === null) {
                                console.warn(`Instruction "${parsedLine.line}" found outside explicit section. Assuming .text at default address.`);
                                this._handleTextDirective([]);
                            } else {
                                throw new Error(`Instruction "${parsedLine.line}" found in .${this.currentSection} section.`);
                            }
                        }
                        parsedLine.address = this.currentAddress;
                        this.instructionLines.push(parsedLine);
                        this.currentAddress += 4;
                    }
                }
            } catch (error) {
                console.error(`Error assembling line ${i + 1}: ${line}\n`, error);
                throw new Error(`Line ${i + 1}: ${error.message}`);
            }
        }
        console.log("Assembly Pass 1 Finished.");
        console.log("  Labels:", this.labels);
        console.log("  Data Memory (Initial):", this.memory);
        console.log("  Instruction Lines for Pass 2:", this.instructionLines);

        console.log("Starting Assembly Pass 2...");
        for (const instrInfo of this.instructionLines) {
            if (instrInfo.type === "instruction" && instrInfo.address !== undefined) {
                const mc = this._riscvToBinary(instrInfo.line, instrInfo.address);
                if (mc && typeof mc === 'string' && !mc.startsWith('Error:')) {
                    assembledInstructions.push({ address: instrInfo.address, binary: mc });
                } else if (mc && mc.startsWith('Error:')) {
                    throw new Error(`Instruction "${instrInfo.line}" at address 0x${instrInfo.address.toString(16)}: ${mc.substring(7)}`);
                }
            }
        }
        console.log("Assembly Pass 2 Finished.");
        console.log("  Assembled Instructions:", assembledInstructions);

        let startAddress = this.labels['main']?.address;
        if (startAddress === undefined) {
            const firstInstruction = assembledInstructions[0];
            startAddress = firstInstruction ? firstInstruction.address : 0x00400000; // Default nếu không có lệnh nào
        }
        startAddress = Number(startAddress) || 0;
        console.log(`Determined Start Address: 0x${startAddress.toString(16).padStart(8, '0')}`);

        return {
            dataMemory: this.memory,
            instructions: assembledInstructions,
            startAddress: startAddress
        };
    },

    _reset() {
        this.memory = {};
        this.labels = {};
        this.equValues = {};
        this.currentSection = null;
        this.currentAddress = 0;
        this.instructionLines = [];
        console.log("Assembler state reset.");
    },

    _parseLine(line, lineNumber) {
        line = line.trim();
        const originalLine = line;
        if (!line) return null;

        const commentIndex = line.indexOf("#");
        if (commentIndex !== -1) {
            line = line.substring(0, commentIndex).trim();
        }
        if (!line) return null;

        // Xử lý nhãn
        if (line.includes(':') && !line.startsWith('.')) {
            const labelEndIndex = line.indexOf(':');
            const label = line.substring(0, labelEndIndex).trim();
            const remainingLine = line.substring(labelEndIndex + 1).trim();

            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(label)) {
                throw new Error(`Invalid label name: "${label}"`);
            }
            // Kiểm tra định nghĩa trùng lặp (cho phép cập nhật nếu là global chưa có địa chỉ)
            if (this.labels[label] && this.labels[label].address !== undefined && !(this.labels[label].isGlobal && this.labels[label].address === undefined)) {
                throw new Error(`Duplicate label definition: "${label}"`);
            }
            // Gán địa chỉ hiện tại (sẽ được cập nhật đúng trong Pass 1 khi xử lý directive/instruction)
            const currentLabelAddress = this.currentAddress;
            this.labels[label] = { ...this.labels[label], address: currentLabelAddress };
            console.log(` Pass 1: Found label "${label}" at potential address 0x${currentLabelAddress.toString(16)}`);

            // Xử lý phần còn lại trên cùng dòng nếu có
            if (remainingLine) {
                return this._parseLine(remainingLine, lineNumber);
            } else {
                return { type: "label", name: label, address: currentLabelAddress };
            }

            // Xử lý chỉ thị
        } else if (line.startsWith(".")) {
            const parts = line.match(/(?:[^\s"]+|"[^"]*")+/g) || []; // Tách tốt hơn
            const directive = parts[0]?.toLowerCase();
            if (!directive) return null;

            let args = parts.slice(1);
            // Xử lý đặc biệt cho chuỗi trong .ascii/.asciiz
            if ((directive === '.ascii' || directive === '.asciiz')) {
                const fullLineMatch = originalLine.match(/^\s*\.(?:ascii|asciiz)\s+(.*)/i);
                if (fullLineMatch && fullLineMatch[1]) {
                    const potentialString = fullLineMatch[1].trim();
                    // Chỉ coi là chuỗi nếu nó bắt đầu và kết thúc bằng dấu nháy kép
                    if (potentialString.startsWith('"') && potentialString.endsWith('"')) {
                        args = [potentialString]; // Một arg duy nhất là chuỗi
                    } else {
                        // Nếu không, coi như là danh sách các giá trị byte (có thể là số hoặc ký tự đơn)
                        args = potentialString.split(',').map(a => a.trim()).filter(a => a);
                    }
                } else {
                    args = []; // Không có tham số
                }
            } else {
                // Tách tham số thông thường bằng dấu phẩy
                args = parts.slice(1).join(' ').split(',').map(arg => arg.trim()).filter(arg => arg !== '');
            }

            if (this.directives[directive]) {
                const { minArgs, maxArgs, handler } = this.directives[directive];
                if (args.length < minArgs || (maxArgs !== Infinity && args.length > maxArgs)) {
                    throw new Error(`Invalid number of arguments for directive ${directive}. Expected ${minArgs}${maxArgs === Infinity ? '+' : '-' + maxArgs}, got ${args.length} (${args.join(', ')})`);
                }
                const addressBeforeHandling = this.currentAddress;
                handler.call(this, args); // Gọi handler để cập nhật trạng thái assembler
                // Trả về thông tin directive, bao gồm địa chỉ *trước khi* handler chạy
                return { type: "directive", name: directive, args: args, address: addressBeforeHandling };
            } else {
                throw new Error(`Unknown directive: "${directive}"`);
            }
            // Xử lý lệnh
        } else {
            // Chỉ trả về dòng lệnh gốc, Pass 2 sẽ xử lý chi tiết
            return { type: "instruction", line: line };
        }
    },

    _riscvToBinary(instruction, currentInstructionAddress) {
        const normalizedInstruction = this._normalizeRegisterNames(instruction);

        let parts;
        // Regex linh hoạt hơn cho offset: số, hex, bin, label, label+/-offset
        const loadStoreMatch = normalizedInstruction.match(/^(\w+)\s+([^,]+),\s*(-?(?:0x[0-9a-f]+|0b[01]+|\d+|[a-zA-Z_][a-zA-Z0-9_]*(?:\s*[+-]\s*\d+)?))\(([^)]+)\)$/i);
        if (loadStoreMatch) {
            parts = [loadStoreMatch[1], loadStoreMatch[2], loadStoreMatch[4], loadStoreMatch[3]]; // opcode, rd/rs2, rs1, imm(offset)
        } else {
            // Tách thông thường, giữ lại các phần tử có nghĩa
            parts = normalizedInstruction.trim().split(/[\s,()]+/).filter(p => p);
        }

        const opcode = parts[0].toUpperCase();

        if (!this.instructionFormats[opcode]) {
            throw new Error(`Invalid or unsupported opcode: "${opcode}" in instruction "${instruction}"`);
        }

        const formatInfo = this.instructionFormats[opcode];
        const { type, opcode: binOpcode, funct3, funct7 } = formatInfo;

        let binaryInstruction = "";
        let rd, rs1, rs2, imm, rdEncoded, rs1Encoded, rs2Encoded, immEncoded;

        // Hàm helper để mã hóa thanh ghi
        const encodeRegister = (register) => {
            if (!register) throw new Error(`Missing register operand in "${instruction}"`);
            const regName = this.registerMapping[register.toUpperCase()];
            if (!regName) throw new Error(`Invalid register name: "${register}" in "${instruction}"`);
            const regNumber = parseInt(regName.slice(1));
            if (isNaN(regNumber) || regNumber < 0 || regNumber > 31) throw new Error(`Invalid register number for: "${register}"`);
            return regNumber.toString(2).padStart(5, '0');
        };

        // Hàm helper để mã hóa immediate (đã cập nhật)
        const encodeImmediate = (immediateStr, formatType, instructionAddr) => {
            let immValue;
            const trimmedImm = immediateStr.trim();
            let isLiteralNumber = false;

            // 1. Parse số literal (dec, hex, bin)
            if (/^-?0x[0-9a-f]+$/i.test(trimmedImm)) {
                immValue = parseInt(trimmedImm, 16);
                isLiteralNumber = true;
            } else if (/^-?0b[01]+$/i.test(trimmedImm)) {
                const isNegative = trimmedImm.startsWith('-');
                const binPart = trimmedImm.replace(/^-?0b/, '');
                immValue = parseInt(binPart, 2);
                if (isNegative) immValue = -immValue;
                isLiteralNumber = true;
            } else if (/^-?\d+$/.test(trimmedImm)) {
                immValue = parseInt(trimmedImm, 10);
                isLiteralNumber = true;
            }

            // 2. Resolve symbol nếu không phải literal
            if (!isLiteralNumber) {
                try {
                    immValue = this._resolveSymbolOrValue(trimmedImm); // Dùng hàm đã sửa
                } catch (e) {
                    throw new Error(`Cannot resolve immediate "${trimmedImm}": ${e.message}`);
                }
            }

            if (immValue === undefined || isNaN(immValue)) {
                throw new Error(`Could not resolve immediate value: "${trimmedImm}"`);
            }

            // 3. Tính offset tương đối nếu là B/J và không phải literal
            if (!isLiteralNumber && (formatType === "B" || formatType === "J")) {
                if (instructionAddr === undefined) throw new Error(`Internal error: instructionAddr needed for relative offset for symbol "${trimmedImm}"`);
                immValue = immValue - instructionAddr;
                if (immValue % 2 !== 0) throw new Error(`Branch/Jump offset to symbol "${trimmedImm}" (${immValue}) is not halfword aligned.`);
            }

            // 4. Kiểm tra giới hạn và tạo binary two's complement
            let maxBits, minVal, maxVal;
            switch (formatType) {
                case "I": maxBits = 12; minVal = -2048; maxVal = 2047; break;
                case "S": maxBits = 12; minVal = -2048; maxVal = 2047; break;
                case "B":
                    maxBits = 13; minVal = -4096; maxVal = 4094;
                    if (immValue % 2 !== 0) throw new Error(`Branch target offset ${immValue} must be even.`);
                    break;
                case "U":
                    maxBits = 20; minVal = 0; maxVal = (1 << 20) - 1;
                    if (isLiteralNumber) {
                        // Immediate literal cho LUI/AUIPC phải nằm trong 20 bit không dấu
                        if (immValue < minVal || immValue > maxVal) {
                            throw new Error(`U-type immediate literal 0x${immValue.toString(16)} out of 20-bit range [0, 0x${maxVal.toString(16)}]`);
                        }
                    } else { // Giá trị từ symbol (địa chỉ 32 bit)
                        // Lấy 20 bit cao (có thể cộng 0x800 để làm tròn cho %hi)
                        // immValue = ((immValue + 0x800) >>> 12) & 0xFFFFF; // %hi
                        immValue = (immValue >>> 12) & 0xFFFFF; // Chỉ lấy 20 bit cao
                    }
                    // immValue bây giờ phải là giá trị 20 bit
                    if (immValue < minVal || immValue > maxVal) {
                        throw new Error(`Internal error: Processed U-type immediate 0x${immValue.toString(16)} out of 20-bit range.`);
                    }
                    break;
                case "J":
                    maxBits = 21; minVal = -1048576; maxVal = 1048574;
                    if (immValue % 2 !== 0) throw new Error(`Jump target offset ${immValue} must be even.`);
                    break;
                default: throw new Error(`Unsupported format type for immediate: ${formatType}`);
            }

            // Kiểm tra range cuối cùng
            if (immValue < minVal || immValue > maxVal) {
                if (formatType !== "U") { // U-type đã kiểm tra bên trong
                    throw new Error(`Immediate value ${immValue} (0x${immValue.toString(16)}) out of range [${minVal}, ${maxVal}] for ${formatType}-type encoding`);
                }
            }

            // Tạo chuỗi binary two's complement
            let binaryImm = "";
            if ((formatType === "I" || formatType === "S" || formatType === "B" || formatType === "J") && immValue < 0) {
                binaryImm = ((1 << maxBits) + immValue).toString(2);
                if (binaryImm.length > maxBits) binaryImm = binaryImm.slice(-maxBits);
                else if (binaryImm.length < maxBits) binaryImm = binaryImm.padStart(maxBits, '1');
            } else {
                binaryImm = immValue.toString(2).padStart(maxBits, '0');
            }
            return binaryImm;
        };
        // --- Kết thúc encodeImmediate ---

        // Mã hóa các phần của lệnh dựa trên type
        try {
            switch (type) {
                case "R": // rd, rs1, rs2
                    if (parts.length !== 4) throw new Error(`R-type expects 3 registers (rd, rs1, rs2), got: ${parts.slice(1).join(', ')}`);
                    rd = parts[1]; rs1 = parts[2]; rs2 = parts[3];
                    rdEncoded = encodeRegister(rd);
                    rs1Encoded = encodeRegister(rs1);
                    rs2Encoded = encodeRegister(rs2);
                    binaryInstruction = funct7 + rs2Encoded + rs1Encoded + funct3 + rdEncoded + binOpcode;
                    break;

                case "I": // rd, rs1, imm | rd, imm(rs1)
                    if (parts.length !== 4) throw new Error(`I-type expects rd, rs1, imm or rd, imm(rs1), got: ${parts.slice(1).join(', ')}`);
                    rd = parts[1];
                    if (loadStoreMatch) { rs1 = parts[2]; imm = parts[3]; } // Dạng load/store
                    else { rs1 = parts[2]; imm = parts[3]; } // Dạng tính toán
                    rdEncoded = encodeRegister(rd);
                    rs1Encoded = encodeRegister(rs1);
                    immEncoded = encodeImmediate(imm, type, currentInstructionAddress);

                    if (opcode === 'SLLI' || opcode === 'SRLI' || opcode === 'SRAI') {
                        const shamtVal = parseInt(imm); // Imm cho shift phải là số literal
                        if (isNaN(shamtVal) || shamtVal < 0 || shamtVal > 31) { // RV32 shamt 5 bits
                            throw new Error(`Shift amount for ${opcode} must be a literal number 0-31, got ${imm}`);
                        }
                        const shamtBin = (shamtVal & 0x1F).toString(2).padStart(5, '0');
                        // funct7 của SRAI khác SRLI/SLLI
                        const actualFunct7 = instructionFormats[opcode].funct7;
                        binaryInstruction = actualFunct7 + shamtBin + rs1Encoded + funct3 + rdEncoded + binOpcode;
                    } else {
                        // imm[11:0] + rs1 + funct3 + rd + opcode
                        binaryInstruction = immEncoded.slice(-12) + rs1Encoded + funct3 + rdEncoded + binOpcode;
                    }
                    break;

                case "S": // rs2, imm(rs1)
                    if (!loadStoreMatch || parts.length !== 4) throw new Error(`S-type expects rs2, imm(rs1), got: ${instruction}`);
                    rs2 = parts[1]; rs1 = parts[2]; imm = parts[3];
                    rs1Encoded = encodeRegister(rs1);
                    rs2Encoded = encodeRegister(rs2);
                    immEncoded = encodeImmediate(imm, type, currentInstructionAddress); // 12 bit
                    // imm[11:5] + rs2 + rs1 + funct3 + imm[4:0] + opcode
                    binaryInstruction = immEncoded.slice(0, 7) + rs2Encoded + rs1Encoded + funct3 + immEncoded.slice(7) + binOpcode;
                    break;

                case "B": // rs1, rs2, label/offset
                    if (parts.length !== 4) throw new Error(`B-type expects rs1, rs2, label/offset, got: ${parts.slice(1).join(', ')}`);
                    rs1 = parts[1]; rs2 = parts[2]; imm = parts[3];
                    rs1Encoded = encodeRegister(rs1);
                    rs2Encoded = encodeRegister(rs2);
                    immEncoded = encodeImmediate(imm, type, currentInstructionAddress); // 13 bit offset
                    // imm[12] imm[10:5] rs2 rs1 funct3 imm[4:1] imm[11] opcode
                    binaryInstruction =
                        immEncoded.slice(0, 1) +   // imm[12]
                        immEncoded.slice(2, 8) +   // imm[10:5]
                        rs2Encoded + rs1Encoded + funct3 +
                        immEncoded.slice(8, 12) +  // imm[4:1]
                        immEncoded.slice(1, 2) +   // imm[11]
                        binOpcode;
                    break;

                case "U": // rd, imm
                    if (parts.length !== 3) throw new Error(`U-type expects rd, imm, got: ${parts.slice(1).join(', ')}`);
                    rd = parts[1]; imm = parts[2];
                    rdEncoded = encodeRegister(rd);
                    immEncoded = encodeImmediate(imm, type, currentInstructionAddress); // 20 bit
                    // imm[31:12] (20 bits) + rd + opcode
                    binaryInstruction = immEncoded + rdEncoded + binOpcode;
                    break;

                case "J": // rd, label/offset
                    if (parts.length !== 3) throw new Error(`J-type expects rd, label/offset, got: ${parts.slice(1).join(', ')}`);
                    rd = parts[1]; imm = parts[2];
                    rdEncoded = encodeRegister(rd);
                    immEncoded = encodeImmediate(imm, type, currentInstructionAddress); // 21 bit offset
                    // imm[20] imm[10:1] imm[11] imm[19:12] rd opcode
                    binaryInstruction =
                        immEncoded.slice(0, 1) +   // imm[20]
                        immEncoded.slice(10, 20) + // imm[10:1] (10 bits)
                        immEncoded.slice(9, 10) +  // imm[11] (1 bit)
                        immEncoded.slice(1, 9) +   // imm[19:12] (8 bits)
                        rdEncoded + binOpcode;
                    break;

                default: throw new Error(`Unsupported instruction type: "${type}"`);
            }
        } catch (error) {
            console.error(`Error encoding instruction "${instruction}" at 0x${currentInstructionAddress?.toString(16)}:`, error);
            return `Error: ${error.message}`;
        }

        if (binaryInstruction.length !== 32) {
            console.error(`Internal Error: Generated binary length is not 32 bits for "${instruction}": Length=${binaryInstruction.length}, Binary=${binaryInstruction}`);
            return `Error: Internal error during binary generation (length != 32)`;
        }
        return binaryInstruction;
    },

    _normalizeRegisterNames(instruction) {
        let normalized = instruction;
        const aliases = Object.keys(this.registerMapping).sort((a, b) => b.length - a.length);
        for (const alias of aliases) {
            const regex = new RegExp(`\\b${alias.replace('$', '\\$')}\\b`, 'gi');
            normalized = normalized.replace(regex, this.registerMapping[alias]);
        }
        return normalized;
    },

    // --- Directive Handlers ---
    _handleDataDirective(args) {
        this.currentSection = "data";
        let addr = 0x10010000; // Default data address
        if (args.length === 1) {
            try { addr = this._parseNumericArg(args[0], '.data address'); }
            catch (e) { throw new Error(`Invalid address for .data: ${args[0]} - ${e.message}`); }
        }
        this.currentAddress = addr;
        console.log(` Switched to .data section at address 0x${this.currentAddress.toString(16)}`);
    },
    _handleTextDirective(args) {
        this.currentSection = "text";
        let addr = 0x00400000; // Default text address
        if (args.length === 1) {
            try { addr = this._parseNumericArg(args[0], '.text address'); }
            catch (e) { throw new Error(`Invalid address for .text: ${args[0]} - ${e.message}`); }
        }
        this.currentAddress = addr;
        console.log(` Switched to .text section at address 0x${this.currentAddress.toString(16)}`);
    },
    _handleWordDirective(args) {
        this._ensureDataSection(".word");
        this._alignAddress(4, ".word");
        for (const arg of args) {
            let value = this._resolveSymbolOrValue(arg);
            this._storeValue(value, 4);
        }
    },
    _handleHalfDirective(args) {
        this._ensureDataSection(".half");
        this._alignAddress(2, ".half");
        for (const arg of args) {
            let value = this._resolveSymbolOrValue(arg);
            if (value < -32768 || value > 65535) { console.warn(`Value ${value} for .half may be truncated.`); }
            this._storeValue(value, 2);
        }
    },
    _handleByteDirective(args) {
        this._ensureDataSection(".byte");
        for (const arg of args) {
            let value = this._resolveSymbolOrValue(arg);
            if (value < -128 || value > 255) { throw new Error(`Byte value ${value} out of range (-128 to 255)`); }
            this._storeValue(value, 1);
        }
    },
    _handleAsciiDirective(args) {
        this._ensureDataSection(".ascii");
        // args[0] nên là chuỗi literal đã được trích xuất bởi _parseLine
        const str = this._parseStringLiteral(args[0], '.ascii');
        for (let i = 0; i < str.length; i++) { this.memory[this.currentAddress++] = str.charCodeAt(i) & 0xFF; }
    },
    _handleAsciizDirective(args) {
        this._ensureDataSection(".asciiz");
        const str = this._parseStringLiteral(args[0], '.asciiz');
        for (let i = 0; i < str.length; i++) { this.memory[this.currentAddress++] = str.charCodeAt(i) & 0xFF; }
        this.memory[this.currentAddress++] = 0; // Null terminator
    },
    _handleSpaceDirective(args) {
        this._ensureDataSection(".space");
        const bytes = this._parseNumericArg(args[0], '.space size');
        if (bytes < 0) { throw new Error(`Invalid negative size for .space: ${bytes}`); }
        for (let i = 0; i < bytes; i++) { this.memory[this.currentAddress++] = 0; }
    },
    _handleAlignDirective(args) {
        if (!this.currentSection) { throw new Error(".align directive must be within .data or .text section"); }
        const exponent = this._parseNumericArg(args[0], '.align exponent');
        if (exponent < 0) { throw new Error(`Invalid negative exponent for .align: ${exponent}`); }
        this._alignAddress(1 << exponent); // Căn chỉnh theo 2^n
    },
    _handleGlobalDirective(args) {
        const label = args[0];
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(label)) { throw new Error(`Invalid label name for .global: "${label}"`); }
        if (this.labels[label]) { this.labels[label].isGlobal = true; }
        else { this.labels[label] = { address: undefined, isGlobal: true }; }
        console.log(` Label "${label}" marked as global.`);
    },
    _handleExternDirective(args) {
        for (const label of args) {
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(label)) { throw new Error(`Invalid label name for .extern: "${label}"`); }
            console.warn(`.extern directive noted for label "${label}" (no action taken).`);
            if (!this.labels[label]) { this.labels[label] = { address: undefined, isExternal: true }; }
            else { this.labels[label].isExternal = true; }
        }
    },
    _handleEquDirective(args) {
        const label = args[0];
        const valueStr = args[1];
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(label)) { throw new Error(`Invalid name for .equ: "${label}"`); }
        if (this.labels[label] !== undefined || this.equValues[label] !== undefined) { throw new Error(`Symbol "${label}" already defined`); }
        try {
            // Phân giải giá trị ngay lập tức, nó phải là số hoặc .equ khác đã định nghĩa
            let value = this._resolveSymbolOrValue(valueStr);
            // Kiểm tra lại kết quả resolve có phải là số không
            if (typeof value !== 'number' || isNaN(value)) {
                throw new Error(`Value for .equ must resolve to a number, but "${valueStr}" did not.`);
            }
            this.equValues[label] = value;
            console.log(` Defined .equ "${label}" = ${value} (0x${value.toString(16)})`);
        } catch (e) {
            throw new Error(`Cannot resolve value "${valueStr}" for .equ "${label}": ${e.message}`);
        }
    },

    // --- Helpers ---
    _ensureDataSection(directiveName) {
        if (this.currentSection !== "data") {
            console.warn(`${directiveName} used outside .data section. Assuming .data at default address.`);
            this._handleDataDirective([]); // Tự động chuyển sang .data
        }
    },
    _alignAddress(alignment, directiveName = ".align") {
        if (alignment <= 0 || (alignment & (alignment - 1)) !== 0) { throw new Error(`Invalid alignment value ${alignment} for ${directiveName}. Must be a positive power of 2.`); }
        const remainder = this.currentAddress % alignment;
        if (remainder !== 0) {
            const padding = alignment - remainder;
            console.log(` Aligning address 0x${this.currentAddress.toString(16)} to ${alignment} bytes (padding ${padding} bytes)`);
            for (let i = 0; i < padding; i++) {
                if (this.currentSection === 'data') { this.memory[this.currentAddress++] = 0; } // Ghi 0 vào data
                else { this.currentAddress++; } // Chỉ tăng địa chỉ trong text
            }
        }
    },
    // Hàm này giờ chỉ dùng cho các directive cần giá trị số tường minh
    _parseNumericArg(arg, context) {
        try {
            const value = this._resolveSymbolOrValue(arg); // Thử resolve
            // Kiểm tra kết quả có phải là số không
            if (typeof value !== 'number' || isNaN(value)) {
                throw new Error(`Resolved value for "${arg}" is not a number.`);
            }
            return value;
        } catch (e) {
            throw new Error(`Invalid numeric or symbolic value for ${context}: "${arg}" (${e.message})`);
        }
    },
    // Hàm chính để phân giải giá trị (số literal, .equ, label, biểu thức đơn giản)
    _resolveSymbolOrValue(symbolOrValue) {
        const trimmed = symbolOrValue.trim();
        let value;

        // 1. Thử parse số literal (hex, bin, dec)
        if (/^-?0x[0-9a-f]+$/i.test(trimmed)) {
            value = parseInt(trimmed, 16);
        } else if (/^-?0b[01]+$/i.test(trimmed)) {
            const isNegative = trimmed.startsWith('-');
            const binPart = trimmed.replace(/^-?0b/, '');
            value = parseInt(binPart, 2);
            if (isNegative) value = -value;
        } else if (/^-?\d+$/.test(trimmed)) {
            value = parseInt(trimmed, 10);
        }

        // Nếu là số literal, trả về
        if (value !== undefined && !isNaN(value)) {
            return value;
        }

        // 2. Thử là .equ
        if (this.equValues[trimmed] !== undefined) {
            return this.equValues[trimmed];
        }

        // 3. Thử là label
        if (this.labels[trimmed] !== undefined && this.labels[trimmed].address !== undefined) {
            return this.labels[trimmed].address;
        }

        // 4. Thử biểu thức label +/- offset (chỉ hỗ trợ offset thập phân)
        const exprMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*([+-])\s*(\d+)$/);
        if (exprMatch) {
            const [, label, op, offsetStr] = exprMatch;
            const offset = parseInt(offsetStr);
            if (this.labels[label]?.address !== undefined && !isNaN(offset)) {
                const baseAddr = this.labels[label].address;
                return op === '+' ? baseAddr + offset : baseAddr - offset;
            } else {
                throw new Error(`Cannot resolve label "${label}" or offset in expression "${trimmed}"`);
            }
        }

        // 5. Không phân giải được
        throw new Error(`Undefined symbol, label, or invalid value: "${trimmed}"`);
    },
    _storeValue(value, bytes) {
        value = Math.trunc(value); // Đảm bảo là số nguyên
        console.log(` Storing value ${value} (0x${value.toString(16)}) (${bytes} bytes) at address 0x${this.currentAddress.toString(16)}`);
        for (let i = 0; i < bytes; i++) {
            const byte = (value >> (i * 8)) & 0xFF; // Little-endian
            this.memory[this.currentAddress++] = byte;
        }
    },
    _parseStringLiteral(arg, directiveName) {
        const trimmedArg = arg.trim();
        // Kiểm tra chặt chẽ hơn: phải bắt đầu và kết thúc bằng "
        if (!trimmedArg.startsWith('"') || !trimmedArg.endsWith('"')) {
            // Nếu là .byte hoặc .word, có thể là ký tự đơn 'A'
            if ((directiveName === '.byte' || directiveName === '.word' || directiveName === '.half') && trimmedArg.length === 3 && trimmedArg.startsWith("'") && trimmedArg.endsWith("'")) {
                return trimmedArg.charCodeAt(1); // Trả về mã ASCII của ký tự đơn
            }
            throw new Error(`Invalid string literal for ${directiveName}: ${arg}. Must be enclosed in double quotes.`);
        }
        // Xử lý escape sequences
        return trimmedArg.slice(1, -1)
            .replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"')
            .replace(/\\'/g, "'").replace(/\\\\/g, '\\').replace(/\\0/g, '\0');
    },
};
