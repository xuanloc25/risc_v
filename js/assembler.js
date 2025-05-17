export const assembler = {
    // --- Trạng thái nội bộ (Internal State) ---
    memory: {},      // Bộ nhớ ảo (data + instructions)
    labels: {},      // Bảng nhãn { labelName: { address: number, isGlobal: boolean, type: 'data'|'instruction' } }
    equValues: {},   // Lưu trữ giá trị của các hằng số .equ
    currentSection: null, // Section hiện tại: 'data' hoặc 'text'
    currentAddress: 0,    // Địa chỉ bộ nhớ hiện tại (tính bằng byte)
    instructionLines: [], // Mảng lưu trữ thông tin các dòng lệnh đã phân tích
    binaryCode: [],       // Mảng các mã hex của lệnh (chủ yếu để hiển thị)
    textBaseAddress: 0x00400000, // Địa chỉ bắt đầu mặc định cho .text
    dataBaseAddress: 0x10010000, // Địa chỉ bắt đầu mặc định cho .data
    inDataSegment: false,        // Cờ cho biết có đang xử lý vùng .data hay không

    registerMapping: { // Ánh xạ tên thanh ghi sang tên chuẩn Xn
        '$ZERO': 'X0', '$0': 'X0', 'ZERO': 'X0',
        '$RA': 'X1', '$1': 'X1', 'RA': 'X1',
        '$SP': 'X2', '$2': 'X2', 'SP': 'X2',
        '$GP': 'X3', '$3': 'X3', 'GP': 'X3',
        '$TP': 'X4', '$4': 'X4', 'TP': 'X4',
        '$T0': 'X5', '$5': 'X5', 'T0': 'X5',
        '$T1': 'X6', '$6': 'X6', 'T1': 'X6',
        '$T2': 'X7', '$7': 'X7', 'T2': 'X7',
        '$S0': 'X8', '$8': 'X8', 'S0': 'X8', '$FP': 'X8', 'FP': 'X8',
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
        'X0': 'X0', 'X1': 'X1', 'X2': 'X2', 'X3': 'X3', 'X4': 'X4', 'X5': 'X5',
        'X6': 'X6', 'X7': 'X7', 'X8': 'X8', 'X9': 'X9', 'X10': 'X10', 'X11': 'X11',
        'X12': 'X12', 'X13': 'X13', 'X14': 'X14', 'X15': 'X15', 'X16': 'X16', 'X17': 'X17',
        'X18': 'X18', 'X19': 'X19', 'X20': 'X20', 'X21': 'X21', 'X22': 'X22', 'X23': 'X23',
        'X24': 'X24', 'X25': 'X25', 'X26': 'X26', 'X27': 'X27', 'X28': 'X28', 'X29': 'X29',
        'X30': 'X30', 'X31': 'X31'
    },

    directives: { // Định nghĩa các chỉ thị assembler
        '.text': function (operands) { this._handleTextDirective(operands); },
        '.data': function (operands) { this._handleDataDirective(operands); },
        '.word': function (operands) { this._handleWordDirective(operands); },
        '.half': function (operands) { this._handleHalfDirective(operands); },
        '.byte': function (operands) { this._handleByteDirective(operands); },
        '.ascii': function (operands) { this._handleStringDirective(operands, false); },
        '.asciiz': function (operands) { this._handleStringDirective(operands, true); },
        '.string': function (operands) { this._handleStringDirective(operands, true); },
        '.space': function (operands) { this._handleSpaceDirective(operands); },
        '.align': function (operands) { this._handleAlignDirective(operands); },
        '.globl': function (operands) { this._handleGlobalDirective(operands); },
        '.global': function (operands) { this._handleGlobalDirective(operands); },
        '.extern': function (operands) { this._handleExternDirective(operands); },
        '.equ': function (operands) { this._handleEquDirective(operands); },
        '.org': function (operands) { this._handleOrgDirective(operands); },
    },

    opcodes: { // Định nghĩa các lệnh RISC-V
        // ----- RV32I Base -----
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
        'ecall': { opcode: '1110011', funct3: '000', funct7: '0000000', type: 'I' }, // imm = 0
        'ebreak': { opcode: '1110011', funct3: '000', funct7: '0000001', type: 'I' }, // imm = 1
        // ----- RV32M Extension -----
        'mul': { opcode: '0110011', funct3: '000', funct7: '0000001', type: 'R' },
        'mulh': { opcode: '0110011', funct3: '001', funct7: '0000001', type: 'R' },
        'mulhsu': { opcode: '0110011', funct3: '010', funct7: '0000001', type: 'R' },
        'mulhu': { opcode: '0110011', funct3: '011', funct7: '0000001', type: 'R' },
        'div': { opcode: '0110011', funct3: '100', funct7: '0000001', type: 'R' },
        'divu': { opcode: '0110011', funct3: '101', funct7: '0000001', type: 'R' },
        'rem': { opcode: '0110011', funct3: '110', funct7: '0000001', type: 'R' },
        'remu': { opcode: '0110011', funct3: '111', funct7: '0000001', type: 'R' },
        // ----- Pseudo Instructions -----
        'nop': { type: 'Pseudo', expandsTo: 'addi', args: ['x0', 'x0', '0'] },
        'li': { type: 'Pseudo' }, 'mv': { type: 'Pseudo', expandsTo: 'addi', args: [null, null, '0'] },
        'j': { type: 'Pseudo', expandsTo: 'jal', args: ['x0', null] },
        'jr': { type: 'Pseudo', expandsTo: 'jalr', args: ['x0', null, '0'] },
        'ret': { type: 'Pseudo', expandsTo: 'jalr', args: ['x0', 'x1', '0'] },
        'call': { type: 'Pseudo' }, 'bnez': { type: 'Pseudo', expandsTo: 'bne', args: [null, 'x0', null] },
        'beqz': { type: 'Pseudo', expandsTo: 'beq', args: [null, 'x0', null] }, 'la': { type: 'Pseudo' },
    },

    // -------------- Main Assembly --------------
    assemble(assemblyCode) {
        this._reset(); // Đặt lại trạng thái assembler
        const lines = assemblyCode.split('\n');
        let currentPass1Address = this.textBaseAddress;
        this.inDataSegment = false;

        // --- Pass 1: Xây dựng bảng nhãn và tính toán địa chỉ ---
        for (let i = 0; i < lines.length; i++) {
            const originalLine = lines[i];
            let line = originalLine.trim();
            const lineNumber = i + 1;

            const commentIndex = line.indexOf('#');
            if (commentIndex !== -1) line = line.substring(0, commentIndex).trim();
            if (line.length === 0) {
                this.instructionLines.push({ original: originalLine, type: 'empty', lineNumber });
                continue;
            }

            let label = null;
            const labelMatch = line.match(/^([a-zA-Z_][\w]*)\s*:/);
            if (labelMatch) {
                label = labelMatch[1];
                line = line.substring(labelMatch[0].length).trim();
                if (!/^[a-zA-Z_][\w]*$/.test(label)) throw new Error(`Line ${lineNumber}: Invalid label name "${label}"`);
                if (this.labels[label] && this.labels[label].address !== undefined && !(this.labels[label].isGlobal && this.labels[label].address === undefined)) {
                    throw new Error(`Line ${lineNumber}: Duplicate label "${label}"`);
                }
                this.labels[label] = { ...this.labels[label], address: currentPass1Address, type: this.inDataSegment ? 'data' : 'instruction' };
            }

            if (line.length === 0) {
                if (label) this.instructionLines.push({ original: originalLine, type: 'label-only', label: label, address: currentPass1Address, lineNumber });
                else this.instructionLines.push({ original: originalLine, type: 'empty', lineNumber });
                continue;
            }

            const parts = line.split(/[\s]+/);
            const mnemonic = parts[0].trim().toLowerCase();
            const operandsString = line.substring(mnemonic.length).trim();
            const operands = this._parseOperandsSmart(operandsString);
            const lineInfo = { original: originalLine, mnemonic, operands, label, address: currentPass1Address, type: '', lineNumber, binary: null, size: 0 };

            if (mnemonic.startsWith('.')) { // Directive
                lineInfo.type = 'directive';
                const handler = this.directives[mnemonic];
                if (handler) {
                    try {
                        const addrBefore = currentPass1Address;
                        this.currentAddress = currentPass1Address;
                        handler.call(this, operands);
                        lineInfo.size = this.currentAddress - addrBefore;
                        currentPass1Address = this.currentAddress;
                    } catch (e) { throw new Error(`Pass 1 (Line ${lineNumber} - "${originalLine.trim()}"): Directive "${mnemonic}": ${e.message}`); }
                } else { throw new Error(`Line ${lineNumber}: Unknown directive "${mnemonic}"`); }
            } else if (this.opcodes[mnemonic]) { // Instruction
                if (this.inDataSegment && mnemonic !== ".equ") throw new Error(`Line ${lineNumber}: Instruction "${mnemonic}" in .data section.`); // .equ có thể ở bất cứ đâu
                const instrOpcodeInfo = this.opcodes[mnemonic]; // Lấy thông tin từ bảng opcodes
                lineInfo.type = instrOpcodeInfo.type === 'Pseudo' ? 'pseudo-instruction' : 'instruction';
                let instrSize = 4;
                if (instrOpcodeInfo.type === 'Pseudo') {
                    instrSize = this._estimatePseudoInstructionSize(mnemonic, operands, lineNumber, originalLine, true);
                }
                lineInfo.size = instrSize;
                currentPass1Address += instrSize;
            } else {
                throw new Error(`Line ${lineNumber}: Unknown mnemonic "${mnemonic}"`);
            }
            this.instructionLines.push(lineInfo);
        }

        // --- Pass 2: Sinh mã nhị phân ---
        this.binaryCode = []; // Mảng các chuỗi hex của lệnh
        // this.memory đã được dùng để lưu data directives ở Pass 1, giờ sẽ ghi instruction bytes vào
        for (const lineInfo of this.instructionLines) {
            if (lineInfo.type !== 'instruction' && lineInfo.type !== 'pseudo-instruction') continue;

            this.currentAddress = lineInfo.address; // Đặt địa chỉ hiện tại cho mã hóa
            try {
                const instrMnemonic = lineInfo.mnemonic.toLowerCase();
                const instrOpcodeInfo = this.opcodes[instrMnemonic]; // Lấy thông tin từ bảng opcodes

                if (!instrOpcodeInfo) { // Kiểm tra lại phòng trường hợp logic Pass 1 khác Pass 2
                    throw new Error(`Internal: Mnemonic "${instrMnemonic}" info missing in Pass 2.`);
                }
                // Tạo một bản copy của instrOpcodeInfo để tránh thay đổi global opcodes object
                const currentInstrInfo = { ...instrOpcodeInfo, mnemonic: instrMnemonic };


                let generatedBinaries = []; // Mảng các chuỗi binary (0101...)
                if (currentInstrInfo.type === 'Pseudo') {
                    generatedBinaries = this._expandAndEncodePseudo(lineInfo, currentInstrInfo);
                } else {
                    const binStr = this._encodeInstruction(currentInstrInfo, lineInfo.operands, lineInfo.address);
                    if (binStr && typeof binStr === 'string' && !binStr.startsWith("Error:")) {
                        generatedBinaries.push(binStr);
                    } else {
                        // Nếu binStr là lỗi hoặc không hợp lệ, ném lỗi rõ ràng hơn
                        throw new Error(binStr || `Encoding failed for ${instrMnemonic}. _encodeInstruction returned invalid/null data.`);
                    }
                }
                lineInfo.binary = generatedBinaries; // Lưu mảng các chuỗi binary
                generatedBinaries.forEach((bin, idx) => {
                    const hex = '0x' + this._binToHex(bin, 8);
                    this.binaryCode.push({ address: lineInfo.address + (idx * 4), binary: bin, hex: hex });
                    this._writeBinaryToMemory(lineInfo.address + (idx * 4), bin); // Ghi vào this.memory
                });
            } catch (e) {
                // Gói lỗi với thông tin dòng đầy đủ
                throw new Error(`Pass 2 (Line ${lineInfo.lineNumber} - "${lineInfo.original.trim()}"): ${e.message}`);
            }
        }

        // Xác định địa chỉ bắt đầu (ưu tiên _start, main, rồi đến địa chỉ lệnh đầu tiên)
        let startAddress = this.labels['_start']?.address ?? this.labels['main']?.address;
        if (startAddress === undefined) {
            const firstInstr = this.instructionLines.find(l => (l.type === 'instruction' || l.type === 'pseudo-instruction') && l.address !== undefined);
            startAddress = firstInstr ? firstInstr.address : this.textBaseAddress;
        }
        // Trả về memory chứa cả data và instructions, và startAddress
        return { memory: this.memory, startAddress: Number(startAddress) || 0, instructions: this.binaryCode };
    },

    _reset() { /* ... như cũ ... */
        this.memory = {}; this.labels = {}; this.equValues = {};
        this.currentSection = null; this.currentAddress = 0;
        this.instructionLines = []; this.binaryCode = [];
        this.inDataSegment = false;
    },
    _parseOperandsSmart(operandsPart) { /* ... như cũ ... */
        if (!operandsPart) return [];
        const operands = []; let currentOperand = ''; let inString = false; let parenLevel = 0;
        for (let i = 0; i < operandsPart.length; i++) {
            const char = operandsPart[i];
            if (char === '"' && (i === 0 || operandsPart[i - 1] !== '\\')) inString = !inString;
            if (char === '(' && !inString) parenLevel++; if (char === ')' && !inString) parenLevel--;
            if (char === ',' && !inString && parenLevel === 0) {
                if (currentOperand.trim().length > 0) operands.push(currentOperand.trim()); currentOperand = '';
            } else if (char === ' ' && !inString && parenLevel === 0 && currentOperand.trim().length === 0) { continue; }
            else { currentOperand += char; }
        }
        if (currentOperand.trim().length > 0) operands.push(currentOperand.trim());
        return operands.filter(op => op.length > 0);
    },

    // _normalizeRegisterNames(instruction) { // Hàm này có lỗi và không được sử dụng, tạm thời vô hiệu hóa
    //     let normalized = instruction;
    //     const aliases = Object.keys(this.registerMapping).sort((a, b) => b.length - a.length);
    //     for (const alias of aliases) {
    //         const regex = new RegExp(`\\b${alias.replace('$', '\\$')}\\b`, 'gi');
    //         normalized = normalized.replace(regex, this.registerMapping[alias]);
    //         // if (isNaN(decimal)) throw new Error // DÒNG NÀY BỊ LỖI
    //     }
    //     return normalized;
    // },

    _decToBin(decimal, length) { /* ... như cũ ... */
        let binary;
        if (decimal >= 0) { binary = decimal.toString(2); }
        else { binary = (Math.pow(2, length) + decimal).toString(2); } // Two's complement for negative
        if (binary.length > length) binary = binary.slice(-length); // Truncate if longer (e.g. from positive exceeding range)
        return binary.padStart(length, '0');
    },
    _binToHex(binary, nibbles) { /* ... như cũ ... */
        if (!/^[01]+$/.test(binary) || binary.length !== nibbles * 4) { binary = binary.padStart(nibbles * 4, '0'); }
        let hex = ''; for (let i = 0; i < binary.length; i += 4) { hex += parseInt(binary.substring(i, i + 4), 2).toString(16); }
        return hex.toUpperCase();
    },

    _parseImmediate(operand, bits, isRelative = false, isPass1 = false, instructionAddressForOffset = 0) {
        operand = operand.trim();
        let value = null;

        if (operand.match(/^[+-]?0x[0-9a-fA-F]+$/i)) { value = parseInt(operand, 16); }
        else if (operand.match(/^[+-]?0b[01]+$/i)) { value = parseInt(operand.replace(/^-?0b/, ''), 2) * (operand.startsWith('-') ? -1 : 1); }
        else if (operand.match(/^[+-]?\d+$/)) { value = parseInt(operand, 10); }

        if (value === null && this.equValues[operand] !== undefined) { value = this.equValues[operand]; }

        if (value === null && /^[a-zA-Z_][\w]*$/.test(operand)) { // Nếu là một tên (có thể là nhãn)
            if (this.labels[operand] && this.labels[operand].address !== undefined) {
                const labelAddress = this.labels[operand].address;
                if (isRelative) {
                    value = labelAddress - instructionAddressForOffset;
                    // Kiểm tra căn chỉnh cho branch/jump (offsets thường nhân 2)
                    if ((bits === 13 || bits === 21) && value % 2 !== 0) { // 13-bit cho B-type, 21-bit cho J-type (scaled)
                        throw new Error(`Branch/Jump offset ${value} to label "${operand}" (0x${labelAddress.toString(16)}) from 0x${instructionAddressForOffset.toString(16)} is not halfword aligned.`);
                    }
                } else { value = labelAddress; }
            } else if (isPass1) { return null; } // Ở Pass 1, nếu nhãn chưa có địa chỉ, trả về null để ước lượng
            else { throw new Error(`Undefined label "${operand}" used as immediate in Pass 2.`); }
        }

        if (value === null || isNaN(value)) {
            throw new Error(`Invalid immediate value or undefined symbol: "${operand}"`);
        }

        // Kiểm tra phạm vi giá trị cơ bản. Các kiểm tra cụ thể hơn (U/J type) sẽ do _encodeInstruction xử lý
        const minSigned = -(1 << (bits - 1));
        const maxSigned = (1 << (bits - 1)) - 1;
        // SỬA LỖI: Bỏ điều kiện formatInfo không xác định
        if (bits <= 12 && (value < minSigned || value > maxSigned)) { // Chỉ kiểm tra strict cho immediate <= 12 bit
            // Các immediate lớn hơn (U, J type) sẽ được _encodeInstruction xử lý phần bit cụ thể.
            console.warn(`Immediate value ${value} (0x${value.toString(16)}) might be out of typical signed ${bits}-bit range. Encoding will truncate if necessary.`);
            // Không ném lỗi ở đây nữa, để _decToBin và _encodeInstruction xử lý việc lấy bit.
        }
        return value;
    },

    getRegisterIndex(regNameWithX) { // Đổi tên để rõ hơn là nó mong đợi 'xN'
        const regName = regNameWithX.trim().toUpperCase(); // Chuẩn hóa về dạng XN
        const mappedName = this.registerMapping[regName] || regName; // Ưu tiên alias, nếu không thì dùng tên đã chuẩn hóa

        if (!/^X([0-9]|[12][0-9]|3[01])$/.test(mappedName)) { // Kiểm tra dạng X0-X31
            throw new Error(`Invalid register name: "${regNameWithX}" (normalized to "${mappedName}")`);
        }
        return parseInt(mappedName.slice(1));
    },

    _parseMemoryOperand(operand, isPass1 = false) { /* ... như cũ, nhưng gọi getRegisterIndex đúng hơn ... */
        operand = operand.trim();
        const match = operand.match(/^(-?\w+)\s*\(\s*([xX]?\w+)\s*\)$/); // Cho phép 'x' hoặc không ở tên thanh ghi
        if (!match) {
            if (this.labels[operand] || /^[a-zA-Z_][\w]*$/.test(operand)) {
                return { needsExpansion: true, label: operand, baseRegIndex: 0, offset: null };
            }
            throw new Error(`Invalid memory operand format: "${operand}". Expected offset(base_register).`);
        }
        const offsetPart = match[1];
        const basePart = match[2]; // basePart có thể là 't0' hoặc 'x5'
        const offsetValue = this._parseImmediate(offsetPart, 12, false, isPass1, this.currentAddress);
        if (offsetValue === null && !isPass1) {
            throw new Error(`Unresolved offset symbol "${offsetPart}" in Pass 2.`);
        }
        // getRegisterIndex mong đợi tên có 'x' hoặc ABI name, nó sẽ tự chuẩn hóa
        const baseRegIndex = this.getRegisterIndex(basePart);
        return { offset: offsetValue, baseRegIndex: baseRegIndex, needsExpansion: false };
    },

    _encodeInstruction(instrInfo, operands, instructionAddress) {
        const type = instrInfo.type;
        const mnemonic = instrInfo.mnemonic;
        let rdEncoded, rs1Encoded, rs2Encoded, immEncodedBits; // Đổi tên immEncoded thành immEncodedBits để rõ hơn
        let binaryInstruction = "";

        const encodeReg = (regStr) => this._decToBin(this.getRegisterIndex(regStr), 5);
        const parseAndEncodeImm = (immStr, bits, isRelative) => { // Đổi tên hàm helper nội bộ
            const immValue = this._parseImmediate(immStr, bits, isRelative, false, instructionAddress);
            if (immValue === null) throw new Error(`Internal Error: Unresolved immediate/label "${immStr}" for ${mnemonic}.`);
            return this._decToBin(immValue, bits); // _decToBin sẽ xử lý two's complement và cắt/đệm bit
        };

        try {
            switch (type) {
                case 'R':
                    if (operands.length !== 3) throw new Error(`R-type ${mnemonic} expects 3 registers (rd, rs1, rs2), got: ${operands.join(', ')}`);
                    rdEncoded = encodeReg(operands[0]);
                    rs1Encoded = encodeReg(operands[1]);
                    rs2Encoded = encodeReg(operands[2]);
                    binaryInstruction = instrInfo.funct7 + rs2Encoded + rs1Encoded + instrInfo.funct3 + rdEncoded + instrInfo.opcode;
                    break;
                case 'I':
                    if (mnemonic === 'ecall' || mnemonic === 'ebreak') {
                        if (operands.length !== 0) throw new Error(`${mnemonic.toUpperCase()} does not take operands.`);
                        rdEncoded = '00000'; rs1Encoded = '00000';
                        immEncodedBits = (mnemonic === 'ecall' ? '0'.repeat(12) : '0'.repeat(11) + '1');
                    } else { // Các lệnh I-type khác (addi, lw, jalr, etc.)
                        if (operands.length < 2) throw new Error(`I-type ${mnemonic} expects at least 2 operands.`);
                        rdEncoded = encodeReg(operands[0]);

                        // Dạng lw rd, offset(rs1) hoặc jalr rd, offset(rs1)
                        const memOpMatch = operands[1].match(/^(-?\w+)\s*\(\s*([xX]?\w+)\s*\)$/);
                        if (memOpMatch && (mnemonic === 'lw' || mnemonic === 'lh' || mnemonic === 'lb' || mnemonic === 'lhu' || mnemonic === 'lbu' || mnemonic === 'jalr')) {
                            if (operands.length !== 2) throw new Error(`${mnemonic} with offset(base) format expects 2 operands: rd, offset(base). Got ${operands.length}`);
                            const offsetStr = memOpMatch[1];
                            const baseRegStr = memOpMatch[2];
                            rs1Encoded = encodeReg(baseRegStr);
                            immEncodedBits = parseAndEncodeImm(offsetStr, 12, false);
                        } else { // Dạng addi rd, rs1, imm hoặc jalr rd, rs1, imm
                            if (operands.length !== 3) throw new Error(`I-type ${mnemonic} expects 3 operands (rd, rs1, imm). Got ${operands.length}: ${operands.join(',')}`);
                            rs1Encoded = encodeReg(operands[1]);
                            immEncodedBits = parseAndEncodeImm(operands[2], 12, false);
                        }
                    }
                    binaryInstruction = immEncodedBits.slice(-12) + rs1Encoded + instrInfo.funct3 + rdEncoded + instrInfo.opcode;
                    break;
                case 'I-shamt': // slli, srli, srai
                    if (operands.length !== 3) throw new Error(`I-shamt ${mnemonic} expects rd, rs1, shamt. Got: ${operands.join(', ')}`);
                    rdEncoded = encodeReg(operands[0]);
                    rs1Encoded = encodeReg(operands[1]);
                    const shamtVal = this._parseImmediate(operands[2], 5, false, false); // shamt là 5 bit
                    if (shamtVal === null || shamtVal < 0 || shamtVal > 31) throw new Error(`Invalid shift amount for ${mnemonic}: ${operands[2]} (must be 0-31)`);
                    immEncodedBits = this._decToBin(shamtVal, 5); // Chỉ 5 bit cuối của trường imm 12-bit
                    binaryInstruction = instrInfo.funct7 + immEncodedBits + rs1Encoded + instrInfo.funct3 + rdEncoded + instrInfo.opcode;
                    break;
                case 'S': // sb, sh, sw
                    if (operands.length !== 2) throw new Error(`S-type ${mnemonic} expects 2 operands (rs2, offset(rs1)). Got: ${operands.join(', ')}`);
                    rs2Encoded = encodeReg(operands[0]); // Giá trị để lưu trữ
                    const memOpS = this._parseMemoryOperand(operands[1], false); // parse offset(base)
                    if (memOpS.needsExpansion) throw new Error(`Absolute address requires pseudo-instruction for ${mnemonic}`);
                    if (memOpS.offset === null) throw new Error(`Unresolved offset symbol in memory operand for ${mnemonic}`);
                    rs1Encoded = this._decToBin(memOpS.baseRegIndex, 5);
                    immEncodedBits = parseAndEncodeImm(memOpS.offset.toString(), 12, false); // imm 12 bit
                    binaryInstruction = immEncodedBits.slice(0, 7) + rs2Encoded + rs1Encoded + instrInfo.funct3 + immEncodedBits.slice(7, 12) + instrInfo.opcode;
                    break;
                case "B": // beq, bne, ...
                    if (operands.length !== 3) throw new Error(`B-type ${mnemonic} expects 3 operands (rs1, rs2, label). Got: ${operands.join(', ')}`);
                    rs1Encoded = encodeReg(operands[0]);
                    rs2Encoded = encodeReg(operands[1]);
                    // Offset cho B-type là 13-bit, nhưng giá trị label/imm là byte offset, cần chia 2 vì lệnh phải align 2 byte
                    // Tuy nhiên, _parseImmediate và _decToBin sẽ xử lý giá trị byte offset. Việc sắp xếp bit sẽ xử lý LSB là 0.
                    const immBValue = this._parseImmediate(operands[2], 13, true, false, instructionAddress); // 13-bit signed offset
                    if (immBValue === null) throw new Error(`Unresolved label for ${mnemonic}: ${operands[2]}`);
                    if (immBValue % 2 !== 0) throw new Error(`Branch target offset ${immBValue} for ${mnemonic} must be even.`);
                    immEncodedBits = this._decToBin(immBValue, 13); // Mã hóa offset 13-bit đầy đủ
                    // Sắp xếp các bit của imm_12bit cho B-type: imm[12|10:5] + rs2 + rs1 + funct3 + imm[4:1|11] + opcode
                    binaryInstruction = immEncodedBits[0] +          // imm[12]
                        immEncodedBits.slice(2, 8) + // imm[10:5]
                        rs2Encoded + rs1Encoded + instrInfo.funct3 +
                        immEncodedBits.slice(8, 12) +// imm[4:1]
                        immEncodedBits[1] +          // imm[11]
                        instrInfo.opcode;
                    break;
                case "U": // lui, auipc
                    if (operands.length !== 2) throw new Error(`U-type ${mnemonic} expects 2 operands (rd, imm). Got: ${operands.join(', ')}`);
                    rdEncoded = encodeReg(operands[0]);
                    // Immediate cho U-type là 20 bit. Nó sẽ được đặt vào các bit 31-12 của lệnh.
                    // _parseImmediate sẽ trả về giá trị số. _decToBin sẽ lấy 20 bit (thấp nếu giá trị lớn).
                    // Đối với LUI, chúng ta muốn immediate này được hiểu là phần cao.
                    // Ví dụ: lui x1, 0xABCDE -> x1 = 0xABCDE000.
                    // Immediate trong lệnh là 0xABCDE.
                    const immUValue = this._parseImmediate(operands[1], 32, false, false); // Parse như số 32-bit để lấy giá trị đầy đủ
                    if (immUValue === null) throw new Error(`Unresolved immediate for ${mnemonic}: ${operands[1]}`);
                    // Lấy 20 bit cao của giá trị nếu nó được hiểu là địa chỉ 32 bit (cho AUIPC liên quan đến symbol)
                    // Hoặc chỉ đơn giản là giá trị 20-bit nếu người dùng nhập trực tiếp
                    // Nếu người dùng nhập "lui t0, 0x12345", thì 0x12345 chính là imm20.
                    // Nếu người dùng nhập "lui t0, MY_SYMBOL", MY_SYMBOL có thể là 0x12345000.
                    // Cách xử lý chuẩn: LUI sẽ load imm20 vào bits 31-12.
                    // Nếu immUValue từ _parseImmediate là giá trị đầy đủ (vd: 0xFFFFF000),
                    // thì chúng ta cần phần 20 bit mà LUI sẽ sử dụng (vd: 0xFFFFF).
                    // Hoặc nếu người dùng chỉ định 1 số 20-bit, nó được dùng trực tiếp.
                    // _decToBin(immUValue, 20) sẽ lấy 20 bit thấp nếu immUValue > 2^20-1.
                    // Đối với LUI, immediate trong assembly là giá trị 20-bit.
                    const imm20u = this._decToBin(immUValue, 20);
                    binaryInstruction = imm20u + rdEncoded + instrInfo.opcode;
                    break;
                case "J": // jal
                    if (operands.length !== 2) throw new Error(`J-type ${mnemonic} expects 2 operands (rd, label). Got: ${operands.join(', ')}`);
                    rdEncoded = encodeReg(operands[0]);
                    // Offset cho J-type là 21-bit signed, giá trị label/imm là byte offset
                    const immJValue = this._parseImmediate(operands[1], 21, true, false, instructionAddress); // 21-bit signed offset
                    if (immJValue === null) throw new Error(`Unresolved label for ${mnemonic}: ${operands[2]}`);
                    if (immJValue % 2 !== 0) throw new Error(`JAL target offset ${immJValue} for ${mnemonic} must be even.`);
                    immEncodedBits = this._decToBin(immJValue, 21); // Mã hóa offset 21-bit đầy đủ
                    // Sắp xếp các bit của imm_20bit cho J-type: imm[20|10:1|11|19:12] + rd + opcode
                    binaryInstruction = immEncodedBits[0] +           // imm[20]
                        immEncodedBits.slice(10, 20) +  // imm[10:1]
                        immEncodedBits[9] +           // imm[11]
                        immEncodedBits.slice(1, 9) +    // imm[19:12] -- CHÚ Ý: spec là 8 bit từ imm[19] xuống imm[12]
                        rdEncoded + instrInfo.opcode;
                    break;
                default:
                    throw new Error(`Internal Error: Unsupported instruction type "${type}" for mnemonic "${mnemonic}"`);
            }
        } catch (e) {
            // SỬA LỖI: Sử dụng thông tin lệnh cụ thể thay vì biến 'instruction' không xác định
            const instructionString = `${mnemonic} ${operands ? operands.join(', ') : ''}`;
            console.error(`Error during encoding of [${instructionString}]:`, e.stack || e.message); // Log stack nếu có
            throw new Error(`Encoding [${instructionString}]: ${e.message}`);
        }

        if (binaryInstruction.length !== 32) {
            const instructionString = `${mnemonic} ${operands ? operands.join(', ') : ''}`;
            const errMsg = `Internal Error: Encoded binary for "${instructionString}" is ${binaryInstruction.length} bits, expected 32. Binary: ${binaryInstruction}`;
            console.error(errMsg);
            throw new Error(errMsg);
        }
        return binaryInstruction;
    },

    _estimatePseudoInstructionSize(mnemonic, operands, lineNumber, originalLine, isPass1 = false) { /* ... như cũ ... */
        if (mnemonic === 'li') {
            if (operands.length !== 2) throw new Error(`Line ${lineNumber}: 'li' expects 2 operands.`);
            try {
                const immValue = this._parseImmediate(operands[1], 32, false, isPass1, 0);
                if (immValue === null && isPass1) return 8; // Nhãn chưa biết -> giả định 2 lệnh
                const imm12Min = -(1 << 11), imm12Max = (1 << 11) - 1;
                return (immValue >= imm12Min && immValue <= imm12Max) ? 4 : 8; // addi hoặc lui+addi
            } catch (e) { if (isPass1 && e.message.includes("Undefined label")) return 8; throw e; } // Nếu lỗi do nhãn chưa biết ở pass 1
        }
        if (mnemonic === 'call' || mnemonic === 'la') return 8; // auipc + jalr/addi
        return 4; // Hầu hết các lệnh giả khác mở rộng thành 1 lệnh thật
    },

    _expandAndEncodePseudo(lineInfo, instrInfo) { /* ... như cũ, nhưng gọi _encodeInstruction với currentExpansionAddress ... */
        const { mnemonic, operands, address, original, lineNumber } = lineInfo;
        let expandedInstructions = []; // Mảng { mnemonic, operands, address }
        let currentExpansionAddress = address;

        switch (mnemonic) {
            case 'nop': expandedInstructions.push({ mnemonic: 'addi', operands: ['x0', 'x0', '0'], address: currentExpansionAddress }); break;
            case 'mv':
                if (operands.length !== 2) throw new Error(`'mv' expects rd, rs1. Got ${operands}`);
                expandedInstructions.push({ mnemonic: 'addi', operands: [operands[0], operands[1], '0'], address: currentExpansionAddress });
                break;
            case 'li':
                if (operands.length !== 2) throw new Error(`'li' expects rd, immediate. Got ${operands}`);
                const rdLi = operands[0]; const immediateStrLi = operands[1];
                const immValueLi = this._parseImmediate(immediateStrLi, 32, false, false, currentExpansionAddress);
                if (immValueLi === null) throw new Error(`Unresolved symbol "${immediateStrLi}" in 'li'.`);
                const imm12Min = -(1 << 11), imm12Max = (1 << 11) - 1;
                if (immValueLi >= imm12Min && immValueLi <= imm12Max) {
                    expandedInstructions.push({ mnemonic: 'addi', operands: [rdLi, 'x0', immValueLi.toString()], address: currentExpansionAddress });
                } else {
                    let imm_hi = immValueLi >>> 12; const imm_lo = immValueLi & 0xFFF;
                    // Làm tròn cho LUI: nếu bit 11 của imm_lo là 1, cộng 1 vào imm_hi
                    if (imm_lo & 0x800) imm_hi = (imm_hi + 1) & 0xFFFFF; // Mask 20 bit cho imm_hi
                    const imm_lo_signed = (imm_lo >= 0x800) ? (imm_lo - 0x1000) : imm_lo;
                    expandedInstructions.push({ mnemonic: 'lui', operands: [rdLi, imm_hi.toString()], address: currentExpansionAddress });
                    if (imm_lo_signed !== 0 || (imm_hi === 0 && immValueLi === 0)) { // Chỉ thêm addi nếu cần thiết
                        expandedInstructions.push({ mnemonic: 'addi', operands: [rdLi, rdLi, imm_lo_signed.toString()], address: currentExpansionAddress + 4 });
                    }
                }
                break;
            case 'j': expandedInstructions.push({ mnemonic: 'jal', operands: ['x0', operands[0]], address: currentExpansionAddress }); break;
            case 'jr': expandedInstructions.push({ mnemonic: 'jalr', operands: ['x0', operands[0], '0'], address: currentExpansionAddress }); break;
            case 'ret': expandedInstructions.push({ mnemonic: 'jalr', operands: ['x0', 'x1', '0'], address: currentExpansionAddress }); break;
            case 'call': // auipc ra, offset_hi + jalr ra, ra, offset_lo
                if (operands.length !== 1) throw new Error(`'call' expects 1 operand (label).`);
                const targetLabelCall = operands[0];
                const targetAddressCall = this._parseImmediate(targetLabelCall, 32, false, false, currentExpansionAddress);
                if (targetAddressCall === null) throw new Error(`Unresolved symbol "${targetLabelCall}" for 'call'.`);
                const offsetCall = targetAddressCall - currentExpansionAddress; // Offset từ AUIPC
                let offset_hi_call = offsetCall >>> 12; const offset_lo_call = offsetCall & 0xFFF;
                if (offset_lo_call & 0x800) offset_hi_call = (offset_hi_call + 1) & 0xFFFFF;
                const offset_lo_signed_call = (offset_lo_call >= 0x800) ? (offset_lo_call - 0x1000) : offset_lo_call;
                expandedInstructions.push({ mnemonic: 'auipc', operands: ['ra', offset_hi_call.toString()], address: currentExpansionAddress });
                expandedInstructions.push({ mnemonic: 'jalr', operands: ['ra', 'ra', offset_lo_signed_call.toString()], address: currentExpansionAddress + 4 });
                break;
            case 'bnez': expandedInstructions.push({ mnemonic: 'bne', operands: [operands[0], 'x0', operands[1]], address: currentExpansionAddress }); break;
            case 'beqz': expandedInstructions.push({ mnemonic: 'beq', operands: [operands[0], 'x0', operands[1]], address: currentExpansionAddress }); break;
            case 'la': // la rd, symbol -> auipc rd, offset_hi + addi rd, rd, offset_lo
                if (operands.length !== 2) throw new Error(`'la' expects rd, symbol. Got ${operands}`);
                const rdLa = operands[0]; const symbolLa = operands[1];
                const symbolAddressLa = this._parseImmediate(symbolLa, 32, false, false, currentExpansionAddress);
                if (symbolAddressLa === null) throw new Error(`Unresolved symbol "${symbolLa}" in 'la'.`);
                const offsetLa = symbolAddressLa - currentExpansionAddress; // Offset từ AUIPC
                let imm_hi_la = offsetLa >>> 12; const imm_lo_la = offsetLa & 0xFFF;
                if (imm_lo_la & 0x800) imm_hi_la = (imm_hi_la + 1) & 0xFFFFF;
                const imm_lo_signed_la = (imm_lo_la >= 0x800) ? (imm_lo_la - 0x1000) : imm_lo_la;
                expandedInstructions.push({ mnemonic: 'auipc', operands: [rdLa, imm_hi_la.toString()], address: currentExpansionAddress });
                if (imm_lo_signed_la !== 0 || (imm_hi_la === 0 && symbolAddressLa === currentExpansionAddress)) { // Chỉ thêm addi nếu cần
                    expandedInstructions.push({ mnemonic: 'addi', operands: [rdLa, rdLa, imm_lo_signed_la.toString()], address: currentExpansionAddress + 4 });
                }
                break;
            default: throw new Error(`Expansion for pseudo instruction "${mnemonic}" not implemented.`);
        }

        const binaryResults = [];
        for (const expanded of expandedInstructions) {
            // Lấy thông tin đầy đủ cho lệnh thật (bao gồm type, funct3, funct7...)
            const realInstrOpcodeInfo = this.opcodes[expanded.mnemonic];
            if (!realInstrOpcodeInfo) throw new Error(`Internal: Pseudo expansion failed, unknown real instruction "${expanded.mnemonic}"`);
            // Tạo bản copy và gán mnemonic cho hàm encode
            const currentRealInstrInfo = { ...realInstrOpcodeInfo, mnemonic: expanded.mnemonic };
            const binary = this._encodeInstruction(currentRealInstrInfo, expanded.operands, expanded.address);
            if (binary && typeof binary === 'string' && !binary.startsWith("Error:")) binaryResults.push(binary);
            else throw new Error(`Failed to encode expanded instruction: ${expanded.mnemonic} ${expanded.operands.join(',')}. Reason: ${binary}`);
        }
        return binaryResults;
    },

    _writeBinaryToMemory(address, binaryString) { /* ... như cũ ... */
        // Chuyển chuỗi nhị phân 32-bit thành số nguyên để lưu từng byte
        // parseInt(binaryString, 2) có thể không xử lý đúng số âm lớn (bù 2) nếu không cẩn thận.
        // Cách an toàn hơn là xử lý byte-byte hoặc dùng BigInt nếu cần giá trị số đầy đủ.
        // Tuy nhiên, ở đây chỉ cần ghi 4 byte vào memory.
        if (binaryString.length !== 32) { console.error(`Invalid binary string length ${binaryString.length}`); return; }
        for (let i = 0; i < 4; i++) {
            const byteStr = binaryString.substring(i * 8, (i + 1) * 8);
            // Ghi little-endian: byte thấp ở địa chỉ thấp
            this.memory[address + i] = parseInt(byteStr, 2);
        }
        // Chỉnh lại: _writeBinaryToMemory nên ghi theo word, little-endian
        const value = parseInt(binaryString, 2); // Có thể không đúng cho số âm nếu > 31 bit
        // Tuy nhiên, binaryString đã là 32 bit.
        // Nếu bit đầu là 1, parseInt sẽ cho số dương.
        // Chúng ta cần giá trị byte.
        this.memory[address] = parseInt(binaryString.substring(24, 32), 2); // LSB
        this.memory[address + 1] = parseInt(binaryString.substring(16, 24), 2);
        this.memory[address + 2] = parseInt(binaryString.substring(8, 16), 2);
        this.memory[address + 3] = parseInt(binaryString.substring(0, 8), 2);   // MSB
    },
};

// --- Các hàm xử lý chỉ thị (Directive Handlers) ---
// Các hàm này được gán vào assembler object sau khi nó được định nghĩa.
// Đảm bảo 'this' trong các hàm này trỏ đúng đến assembler object.
assembler._handleDataDirective = function (operands) { /* ... như cũ ... */
    this.inDataSegment = true; this.currentSection = "data";
    let addr = this.dataBaseAddress; if (operands.length === 1) { addr = this._parseNumericArg(operands[0], '.data address'); }
    this.currentAddress = addr;
};
assembler._handleTextDirective = function (operands) { /* ... như cũ ... */
    this.inDataSegment = false; this.currentSection = "text";
    let addr = this.textBaseAddress; if (operands.length === 1) { addr = this._parseNumericArg(operands[0], '.text address'); }
    // Chỉ đặt currentAddress nếu đây là chỉ thị .text đầu tiên hoặc .org được dùng
    // Nếu đã có lệnh, currentAddress sẽ được cập nhật bởi Pass 1
    if (this.instructionLines.filter(l => l.type === 'instruction' || l.type === 'pseudo-instruction').length === 0) {
        this.currentAddress = addr;
    }
};
assembler._handleWordDirective = function (operands) { /* ... như cũ ... */
    this._ensureDataSection(".word"); this._alignAddress(4, ".word");
    for (const arg of operands) { let value = this._resolveSymbolOrValue(arg); this._storeValue(value, 4); }
};
assembler._handleHalfDirective = function (operands) { /* ... như cũ ... */
    this._ensureDataSection(".half"); this._alignAddress(2, ".half");
    for (const arg of operands) { let value = this._resolveSymbolOrValue(arg); if (value < -32768 || value > 65535) { console.warn(`Value ${value} for .half may be truncated.`); } this._storeValue(value, 2); }
};
assembler._handleByteDirective = function (operands) { /* ... như cũ ... */
    this._ensureDataSection(".byte");
    for (const arg of operands) {
        // Cho phép ký tự đơn dạng 'c'
        if (typeof arg === 'string' && arg.length === 3 && arg.startsWith("'") && arg.endsWith("'")) {
            let value = arg.charCodeAt(1);
            this._storeValue(value, 1);
        } else {
            let value = this._resolveSymbolOrValue(arg);
            if (value < -128 || value > 255) { throw new Error(`Byte value ${value} (from "${arg}") out of range (-128 to 255)`); }
            this._storeValue(value, 1);
        }
    }
};
assembler._handleStringDirective = function (operands, nullTerminated) { /* ... như cũ ... */
    this._ensureDataSection(nullTerminated ? ".asciiz" : ".ascii");
    const str = this._parseStringLiteral(operands.join(","), nullTerminated ? ".asciiz" : ".ascii"); // Nối lại nếu string chứa dấu phẩy
    for (let i = 0; i < str.length; i++) { this.memory[this.currentAddress++] = str.charCodeAt(i) & 0xFF; }
    if (nullTerminated) { this.memory[this.currentAddress++] = 0; }
};
assembler._handleSpaceDirective = function (operands) { /* ... như cũ ... */
    this._ensureDataSection(".space"); const bytes = this._parseNumericArg(operands[0], '.space size');
    if (bytes < 0) { throw new Error(`Invalid negative size for .space: ${bytes}`); }
    for (let i = 0; i < bytes; i++) { this.memory[this.currentAddress++] = 0; }
};
assembler._handleAlignDirective = function (operands) { /* ... như cũ ... */
    if (!this.currentSection) { throw new Error(".align directive must be within .data or .text section"); }
    const exponent = this._parseNumericArg(operands[0], '.align exponent');
    if (exponent < 0) { throw new Error(`Invalid negative exponent for .align: ${exponent}`); }
    const alignment = 1 << exponent; // Căn chỉnh theo 2^n byte
    this._alignAddress(alignment, ".align");
};
assembler._handleGlobalDirective = function (operands) { /* ... như cũ ... */
    const label = operands[0]; if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(label)) { throw new Error(`Invalid label name for .global: "${label}"`); }
    if (this.labels[label]) { this.labels[label].isGlobal = true; } else { this.labels[label] = { address: undefined, isGlobal: true }; }
};
assembler._handleExternDirective = function (operands) { /* ... như cũ ... */
    for (const label of operands) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(label)) { throw new Error(`Invalid label name for .extern: "${label}"`); }
        if (!this.labels[label]) { this.labels[label] = { address: undefined, isExternal: true }; } else { this.labels[label].isExternal = true; }
    }
};
assembler._handleEquDirective = function (operands) { /* ... như cũ ... */
    const label = operands[0]; const valueStr = operands[1];
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(label)) { throw new Error(`Invalid name for .equ: "${label}"`); }
    if (this.labels[label] !== undefined || this.equValues[label] !== undefined) { throw new Error(`Symbol "${label}" already defined`); }
    try {
        let value = this._resolveSymbolOrValue(valueStr); // Thử resolve giá trị trước
        if (typeof value !== 'number' || isNaN(value)) { throw new Error(`Value for .equ must resolve to a number, but "${valueStr}" did not.`); }
        this.equValues[label] = value;
    } catch (e) { throw new Error(`Cannot resolve value "${valueStr}" for .equ "${label}": ${e.message}`); }
};
assembler._handleOrgDirective = function (operands) { /* ... như cũ ... */
    if (operands.length !== 1) throw new Error(".org directive requires exactly one address operand.");
    const orgAddress = this._parseNumericArg(operands[0], '.org address');
    if (orgAddress === null || orgAddress < 0) throw new Error(".org address must be a non-negative resolved value.");
    this.currentAddress = orgAddress;
};

// --- Các hàm helper cho directives ---
assembler._ensureDataSection = function (directiveName) { /* ... như cũ ... */
    if (this.currentSection !== "data") { this._handleDataDirective([]); }
};
assembler._alignAddress = function (alignmentBytes, context = "alignment") {
    if (alignmentBytes <= 0 || (alignmentBytes & (alignmentBytes - 1)) !== 0) { // Phải là lũy thừa của 2
        throw new Error(`Invalid alignment ${alignmentBytes} for ${context}. Must be a positive power of 2.`);
    }
    const remainder = this.currentAddress % alignmentBytes;
    if (remainder !== 0) {
        const padding = alignmentBytes - remainder;
        if (this.inDataSegment) { // Nếu trong .data, điền 0 vào padding
            for (let i = 0; i < padding; i++) { this.memory[this.currentAddress++] = 0; }
        } else { // Nếu trong .text, thường điền NOPs, nhưng ở Pass 1 chỉ cần tăng địa chỉ
            this.currentAddress += padding;
        }
    }
};
assembler._parseNumericArg = function (arg, context) { /* ... như cũ ... */
    try { const value = this._resolveSymbolOrValue(arg); if (typeof value !== 'number' || isNaN(value)) { throw new Error(`Not a number.`); } return value; }
    catch (e) { throw new Error(`Invalid numeric or symbolic value for ${context}: "${arg}" (${e.message})`); }
};
assembler._resolveSymbolOrValue = function (symbolOrValue) { /* ... như cũ, có thể cải thiện biểu thức ... */
    const trimmed = symbolOrValue.trim(); let value;
    if (/^'.*'$/.test(trimmed) && trimmed.length === 3) { return trimmed.charCodeAt(1); } // Ký tự đơn 'c'
    if (/^-?0x[0-9a-f]+$/i.test(trimmed)) { value = parseInt(trimmed, 16); }
    else if (/^-?0b[01]+$/i.test(trimmed)) { value = parseInt(trimmed.replace(/^-?0b/, ''), 2) * (trimmed.startsWith('-') ? -1 : 1); }
    else if (/^-?\d+$/.test(trimmed)) { value = parseInt(trimmed, 10); }
    if (value !== undefined && !isNaN(value)) return value;
    if (this.equValues[trimmed] !== undefined) return this.equValues[trimmed];
    // Cho phép label + offset hoặc label - offset
    const exprMatch = trimmed.match(/^([a-zA-Z_][\w]*)\s*([+-])\s*(0x[0-9a-fA-F]+|[0-9]+)$/i);
    if (exprMatch) {
        const [, labelName, operator, offsetStr] = exprMatch;
        const labelInfo = this.labels[labelName];
        if (labelInfo && labelInfo.address !== undefined) {
            const baseAddr = labelInfo.address;
            const offset = parseInt(offsetStr); // offsetStr có thể là hex hoặc dec
            if (isNaN(offset)) throw new Error(`Invalid offset in expression "${trimmed}"`);
            return operator === '+' ? baseAddr + offset : baseAddr - offset;
        } else { throw new Error(`Label "${labelName}" in expression "${trimmed}" not defined or address not resolved.`); }
    }
    if (this.labels[trimmed] && this.labels[trimmed].address !== undefined) return this.labels[trimmed].address;
    throw new Error(`Undefined symbol, label, or invalid value: "${trimmed}"`);
};
assembler._storeValue = function (value, bytes) { /* ... như cũ, little-endian ... */
    value = Math.trunc(value); // Đảm bảo là số nguyên
    for (let i = 0; i < bytes; i++) { this.memory[this.currentAddress + i] = (value >> (i * 8)) & 0xFF; }
    this.currentAddress += bytes;
};
assembler._parseStringLiteral = function (arg, directiveName) { /* ... như cũ ... */
    const trimmedArg = arg.trim();
    if (!trimmedArg.startsWith('"') || !trimmedArg.endsWith('"')) { throw new Error(`Invalid string literal for ${directiveName}: ${arg}. Must be in double quotes.`); }
    return trimmedArg.slice(1, -1).replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, '\\').replace(/\\0/g, '\0');
};
