// simulator.js

export const simulator = {
    registers: new Int32Array(32),  // Thanh ghi 32-bit signed
    memory: {},                     // Bộ nhớ (byte addressable: address -> byte value)
    pc: 0,                          // Program Counter
    isRunning: false,               // Cờ chạy tự động
    instructionCount: 0,            // Đếm số lệnh đã thực thi
    maxSteps: 1000000,              // Giới hạn chạy tự động

    // --- Quản lý trạng thái ---
    resetRegisters() {
        this.registers.fill(0);
        this.pc = 0;
        console.log("Simulator registers reset.");
    },
    resetMemory() {
        this.memory = {};
        console.log("Simulator memory reset.");
    },
    reset() {
        this.resetRegisters();
        this.resetMemory();
        this.isRunning = false;
        this.instructionCount = 0;
        console.log("Simulator state reset completely.");
    },

    loadProgram(programData) {
        this.reset();

        if (programData.memory) { // Sửa tên thuộc tính cho nhất quán với assembler output
            console.log("Loading data memory (from assembler's memory map)...");
            for (const addrStr in programData.memory) {
                const addr = parseInt(addrStr);
                if (!isNaN(addr) && typeof programData.memory[addrStr] === 'number' &&
                    programData.memory[addrStr] >= 0 && programData.memory[addrStr] <= 255) {
                    this.memory[addr] = programData.memory[addrStr];
                } else {
                    console.warn(`Skipping invalid data memory entry at '${addrStr}':`, programData.memory[addrStr]);
                }
            }
            console.log("Data memory loaded.");
        } else {
            console.log("No general memory map (expected from assembler.memory) found to load initial data.");
        }

        // Nạp mã lệnh đã được assembler ghi vào memory vào simulator.memory
        // Nếu assembler đã ghi lệnh vào programData.memory thì không cần bước này nữa
        // Tuy nhiên, nếu programData.instructions được truyền riêng (từ output cũ) thì cần giữ lại
        // Giả sử assembler mới sẽ ghi thẳng lệnh vào programData.memory.
        // Nếu `assembler.js` của bạn trả về `binaryCode` dưới dạng một mảng các { address, binary }
        // thì bạn cần xử lý nó ở đây để ghi vào `this.memory`.
        // Đoạn code dưới đây giả định `programData.instructions` là mảng {address, binary}
        // mà `javascript.js` đã chuẩn bị sẵn (từ `assembler.assemble().binaryCode` có thể là mảng string hex)
        // và `assembler.js` đã ghi thẳng instruction words vào `programData.memory`.
        // Vì vậy, bước nạp lệnh riêng biệt có thể không cần thiết nếu assembler đã làm.
        // Chúng ta sẽ giữ lại logic nạp lệnh từ một cấu trúc `programData.instructions` (mảng hex strings)
        // như trong `javascript.js` có thể đã làm, hoặc điều chỉnh nếu `assembler` đã ghi byte.

        // Trong `javascript.js`, `programData.instructions` được tạo từ assembler:
        // const binaryStrings = programData.instructions.map(instr => instr.binary);
        // Và `programData` đưa vào simulator.loadProgram có dạng:
        // { binaryCode: string[], memory: object, startAddress: number }
        // Do đó, chúng ta cần nạp `binaryCode` vào bộ nhớ lệnh.
        // `assembler.js` mới của bạn có vẻ ghi lệnh vào `this.memory` của nó,
        // và `javascript.js` sẽ truyền `assembler.memory` vào `simulator.loadProgram` dưới dạng `programData.memory`.

        // Nếu assembler.js của bạn (đã gửi) ghi cả data và instruction vào `this.memory` của nó,
        // và `javascript.js` truyền `assembler.memory` cho `programData.memory` ở đây,
        // thì không cần thêm vòng lặp nạp lệnh nữa. Phần `programData.memory` đã chứa tất cả.

        this.pc = programData.startAddress || 0;
        console.log(`Simulator PC set to start address: 0x${this.pc.toString(16).padStart(8, '0')}`);
        console.log("Simulator ready (memory contains data & instructions from assembler).");
    },

    // --- Thực thi ---
    run() {
        this.isRunning = true;
        this.instructionCount = 0;
        console.log(`Starting simulation run from PC: 0x${this.pc.toString(16).padStart(8, '0')}`);

        const runLoop = () => {
            if (!this.isRunning) {
                console.log("Simulation halted.");
                if (typeof window !== 'undefined' && window.updateUIGlobally) window.updateUIGlobally();
                return;
            }

            if (this.instructionCount >= this.maxSteps) {
                this.isRunning = false;
                console.warn(`Simulation stopped: Maximum instruction steps (${this.maxSteps}) reached.`);
                if (typeof window !== 'undefined' && window.updateUIGlobally) window.updateUIGlobally();
                alert(`Simulation stopped: Maximum instruction steps (${this.maxSteps}) reached.`);
                return;
            }

            try {
                this.step();

                if (this.isRunning) {
                    setTimeout(runLoop, 0);
                } else {
                    console.log(`Simulation run finished after ${this.instructionCount} instructions. Final PC: 0x${this.pc.toString(16).padStart(8, '0')}`);
                    if (typeof window !== 'undefined' && window.updateUIGlobally) window.updateUIGlobally();
                }

            } catch (error) {
                this.isRunning = false;
                console.error("Error during simulation run:", error);
                alert(`Runtime Error: ${error.message}`);
                if (typeof window !== 'undefined' && window.updateUIGlobally) window.updateUIGlobally();
            }
        };

        setTimeout(runLoop, 0);
    },

    stop() {
        this.isRunning = false;
        console.log("Simulation run stop requested by user.");
    },

    step() {
        if (this.pc === null || this.pc === undefined) {
            throw new Error("Cannot execute step: Program Counter (PC) is not set.");
        }
        const currentPcForStep = this.pc;
        console.log(`Executing step at PC: 0x${currentPcForStep.toString(16).padStart(8, '0')}`);

        const instructionWord = this.fetch(currentPcForStep);

        if (instructionWord === undefined) {
            throw new Error(`Failed to fetch instruction at address 0x${currentPcForStep.toString(16).padStart(8, '0')}. Halting.`);
        }
        console.log(` Fetched instruction word: 0x${instructionWord.toString(16).padStart(8, '0')} (Decimal: ${instructionWord})`);

        const decoded = this.decode(instructionWord);
        console.log("  Decoded instruction:", decoded);
        if (decoded.opName === 'UNKNOWN') {
            throw new Error(`Could not decode instruction word: 0x${instructionWord.toString(16).padStart(8, '0')} at PC 0x${currentPcForStep.toString(16).padStart(8, '0')}`);
        }

        const executionResult = this.execute(decoded);

        if (executionResult && executionResult.nextPc !== undefined) {
            this.pc = executionResult.nextPc;
            console.log(`  Jump/Branch taken/calculated. New PC: 0x${this.pc.toString(16).padStart(8, '0')}`);
        } else {
            this.pc = currentPcForStep + 4;
            console.log(`  Incrementing PC to: 0x${this.pc.toString(16).padStart(8, '0')}`);
        }

        this.registers[0] = 0;
        this.instructionCount++;

        if (typeof window !== 'undefined' && window.updateUIGlobally) {
            window.updateUIGlobally();
        }
    },

    // --- Lõi CPU ---
    fetch(address) {
        const addrInt = parseInt(address);
        if (isNaN(addrInt)) {
            console.error(`Workspace Error: Invalid address format ${address}`);
            return undefined;
        }
        // RISC-V yêu cầu địa chỉ lệnh phải căn chỉnh 4 byte (hoặc 2 byte cho Compressed)
        // if (addrInt % 4 !== 0) { // Bỏ qua kiểm tra unaligned cứng, có thể cảnh báo ở execute
        //     console.error(`Workspace Error: Unaligned instruction access at address 0x${addrInt.toString(16)}`);
        //     return undefined; 
        // }

        const byte1 = this.memory[addrInt];
        const byte2 = this.memory[addrInt + 1];
        const byte3 = this.memory[addrInt + 2];
        const byte4 = this.memory[addrInt + 3];

        if (byte1 === undefined || byte2 === undefined || byte3 === undefined || byte4 === undefined) {
            console.error(`Workspace Error: Failed to fetch 4 bytes at address 0x${addrInt.toString(16)}`);
            console.error(` Bytes found: [${byte1}, ${byte2}, ${byte3}, ${byte4}] (undefined means missing)`);
            return undefined;
        }

        const instruction = ((byte4 | 0) << 24) | ((byte3 | 0) << 16) | ((byte2 | 0) << 8) | (byte1 | 0);
        return instruction;
    },

    decode(instructionWord) {
        const opcode = instructionWord & 0x7F;
        const rd = (instructionWord >> 7) & 0x1F;
        const funct3 = (instructionWord >> 12) & 0x7;
        const rs1 = (instructionWord >> 15) & 0x1F;
        const rs2 = (instructionWord >> 20) & 0x1F;
        const funct7 = (instructionWord >> 25) & 0x7F;

        const opcodeBin = opcode.toString(2).padStart(7, '0');
        const funct3Bin = funct3.toString(2).padStart(3, '0');
        const funct7Bin = funct7.toString(2).padStart(7, '0');

        let imm = 0;
        let type = null;
        let opName = "UNKNOWN";

        // GỢI Ý: Nên chia sẻ định nghĩa này với assembler.js
        const instructionFormats = {
            // RV32I Base
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
            "SLLI": { type: "I", opcode: "0010011", funct3: "001", funct7Matcher: "0000000" }, // Dùng funct7Matcher để không lẫn với SLL
            "SRLI": { type: "I", opcode: "0010011", funct3: "101", funct7Matcher: "0000000" },
            "SRAI": { type: "I", opcode: "0010011", funct3: "101", funct7Matcher: "0100000" },
            "JALR": { type: "I", opcode: "1100111", funct3: "000" },
            "SW": { type: "S", opcode: "0100011", funct3: "010" },
            "SH": { type: "S", opcode: "0100011", funct3: "001" },
            "SB": { type: "S", opcode: "0100011", funct3: "000" },
            "BEQ": { type: "B", opcode: "1100011", funct3: "000" },
            "BNE": { type: "B", opcode: "1100011", funct3: "001" },
            "BLT": { type: "B", opcode: "1100011", funct3: "100" },
            "BGE": { type: "B", opcode: "1100011", funct3: "101" },
            "BLTU": { type: "B", opcode: "1100011", funct3: "110" },
            "BGEU": { type: "B", opcode: "1100011", funct3: "111" },
            "LUI": { type: "U", opcode: "0110111" },
            "AUIPC": { type: "U", opcode: "0010111" },
            "JAL": { type: "J", opcode: "1101111" },
            "ECALL": { type: "I", opcode: "1110011", funct3: "000", immFieldMatcher: "000000000000" },
            "EBREAK": { type: "I", opcode: "1110011", funct3: "000", immFieldMatcher: "000000000001" },
            // RV32M Extension
            "MUL": { type: "R", opcode: "0110011", funct3: "000", funct7: "0000001" },
            "MULH": { type: "R", opcode: "0110011", funct3: "001", funct7: "0000001" },
            "MULHSU": { type: "R", opcode: "0110011", funct3: "010", funct7: "0000001" },
            "MULHU": { type: "R", opcode: "0110011", funct3: "011", funct7: "0000001" },
            "DIV": { type: "R", opcode: "0110011", funct3: "100", funct7: "0000001" },
            "DIVU": { type: "R", opcode: "0110011", funct3: "101", funct7: "0000001" },
            "REM": { type: "R", opcode: "0110011", funct3: "110", funct7: "0000001" },
            "REMU": { type: "R", opcode: "0110011", funct3: "111", funct7: "0000001" },
        };

        for (const name in instructionFormats) {
            const format = instructionFormats[name];
            let match = false;
            if (format.opcode === opcodeBin) {
                if (format.type === 'R') {
                    if (format.funct3 === funct3Bin && format.funct7 === funct7Bin) match = true;
                } else if (format.type === 'I') {
                    if (format.immFieldMatcher !== undefined) { // ECALL, EBREAK
                        if (format.funct3 === funct3Bin && (instructionWord >>> 20).toString(2).padStart(12, '0') === format.immFieldMatcher) {
                            match = true;
                        }
                    } else if (format.funct7Matcher !== undefined) { // Shifts (SLLI, SRLI, SRAI)
                        // funct7 trong word gốc, không phải funct7Matcher
                        if (format.funct3 === funct3Bin && funct7Bin === format.funct7Matcher) {
                            match = true;
                        }
                    } else { // I-type thông thường
                        if (format.funct3 === funct3Bin) {
                            match = true;
                        }
                    }
                } else if (format.type === 'S' || format.type === 'B') {
                    if (format.funct3 === funct3Bin) match = true;
                } else if (format.type === 'U' || format.type === 'J') {
                    match = true;
                }
            }
            if (match) {
                opName = name;
                type = format.type;
                break;
            }
        }

        if (type) {
            switch (type) {
                case "I":
                    imm = instructionWord >> 20;
                    // Đối với SLLI, SRLI, SRAI, imm thực chất là shamt (5 bit thấp của trường imm 12-bit)
                    // và funct7 (7 bit cao của trường imm 12-bit) để phân biệt.
                    // Decode ở trên đã xử lý funct7Matcher. Giá trị shamt sẽ lấy từ (instructionWord >> 20) & 0x1F
                    if (opName === "SLLI" || opName === "SRLI" || opName === "SRAI") {
                        imm = (instructionWord >> 20) & 0x1F; // shamt is last 5 bits
                    }
                    break;
                case "S":
                    imm = (((instructionWord >> 25) & 0x7F) << 5) | ((instructionWord >> 7) & 0x1F);
                    if ((instructionWord >> 31) & 1) imm |= 0xFFFFF000;
                    break;
                case "B":
                    imm = (((instructionWord >> 31) & 0x1) << 12) |
                        (((instructionWord >> 7) & 0x1) << 11) |
                        (((instructionWord >> 25) & 0x3F) << 5) |
                        (((instructionWord >> 8) & 0xF) << 1);
                    if ((instructionWord >> 31) & 1) imm |= 0xFFFFE000;
                    break;
                case "U":
                    imm = instructionWord & 0xFFFFF000;
                    break;
                case "J":
                    imm = (((instructionWord >> 31) & 0x1) << 20) |
                        (((instructionWord >> 12) & 0xFF) << 12) |
                        (((instructionWord >> 20) & 0x1) << 11) |
                        (((instructionWord >> 21) & 0x3FF) << 1);
                    if ((instructionWord >> 31) & 1) imm |= 0xFFE00000;
                    break;
            }
        } else {
            console.warn(`Could not determine instruction type for word: 0x${instructionWord.toString(16).padStart(8, '0')}`);
        }
        return { opName, type, opcode: opcodeBin, rd, rs1, rs2, funct3: funct3Bin, funct7: funct7Bin, imm };
    },

    execute(decoded) {
        const { opName, type, rd, rs1, rs2, funct3, funct7, imm } = decoded;

        const val1 = (rs1 === 0) ? 0 : (this.registers[rs1] | 0);
        const val2 = (rs2 === 0) ? 0 : (this.registers[rs2] | 0);
        const pc = this.pc;

        let result = undefined;
        let memoryAddress = 0;
        let memoryValue = 0;
        let branchTaken = false;
        let nextPc = undefined;

        const INT32_MIN = -2147483648;
        const INT32_MAX = 2147483647;
        const UINT32_MAX_AS_SIGNED = -1; // All 1s for unsigned max

        console.log(`  Executing: ${opName} rd=x${rd}, rs1=x${rs1}(${val1}), rs2=x${rs2}(${val2}), imm=${imm}`);

        switch (opName) {
            // --- R-Type (RV32I) ---
            case 'ADD': result = (val1 + val2) | 0; break;
            case 'SUB': result = (val1 - val2) | 0; break;
            case 'SLL': result = (val1 << (val2 & 0x1F)) | 0; break;
            case 'SLT': result = (val1 < val2) ? 1 : 0; break;
            case 'SLTU': result = ((val1 >>> 0) < (val2 >>> 0)) ? 1 : 0; break;
            case 'XOR': result = (val1 ^ val2) | 0; break;
            case 'SRL': result = val1 >>> (val2 & 0x1F); break;
            case 'SRA': result = val1 >> (val2 & 0x1F); break;
            case 'OR': result = (val1 | val2) | 0; break;
            case 'AND': result = (val1 & val2) | 0; break;

            // --- R-Type (RV32M) ---
            case 'MUL':
                result = Math.imul(val1, val2);
                break;
            case 'MULH': // (signed rs1 * signed rs2) >> 32
                result = Number((BigInt(val1) * BigInt(val2)) >> 32n);
                break;
            case 'MULHSU': // (signed rs1 * unsigned rs2) >> 32
                result = Number((BigInt(val1) * BigInt(val2 >>> 0)) >> 32n);
                break;
            case 'MULHU': // (unsigned rs1 * unsigned rs2) >> 32
                result = Number((BigInt(val1 >>> 0) * BigInt(val2 >>> 0)) >> 32n);
                break;
            case 'DIV':
                if (val2 === 0) {
                    result = UINT32_MAX_AS_SIGNED; // All 1s (-1)
                } else if (val1 === INT32_MIN && val2 === -1) {
                    result = INT32_MIN; // Overflow, result is dividend
                } else {
                    result = (val1 / val2) | 0; // Truncates towards zero
                }
                break;
            case 'DIVU':
                if (val2 === 0) {
                    result = UINT32_MAX_AS_SIGNED; // All 1s (0xFFFFFFFF)
                } else {
                    result = ((val1 >>> 0) / (val2 >>> 0)) | 0;
                }
                break;
            case 'REM':
                if (val2 === 0) {
                    result = val1; // Remainder is dividend
                } else if (val1 === INT32_MIN && val2 === -1) {
                    result = 0; // Overflow case for remainder
                } else {
                    result = val1 % val2; // JS % behaves as specified for sign
                }
                break;
            case 'REMU':
                if (val2 === 0) {
                    result = val1 >>> 0; // Remainder is dividend (unsigned)
                } else {
                    result = (val1 >>> 0) % (val2 >>> 0);
                }
                break;

            // --- I-Type (Arithmetic/Logic) ---
            case 'ADDI': result = (val1 + imm) | 0; break;
            case 'SLTI': result = (val1 < imm) ? 1 : 0; break;
            case 'SLTIU':
                result = ((val1 >>> 0) < (imm >>> 0)) ? 1 : 0; // Compare rs1 unsigned with sign-extended imm treated as unsigned
                break;
            case 'XORI': result = (val1 ^ imm) | 0; break;
            case 'ORI': result = (val1 | imm) | 0; break;
            case 'ANDI': result = (val1 & imm) | 0; break;

            // --- I-Type (Shifts Immediate) ---
            // imm here is shamt (0-31) after decode step specific for shifts
            case 'SLLI': result = (val1 << imm) | 0; break;
            case 'SRLI': result = val1 >>> imm; break;
            case 'SRAI': result = val1 >> imm; break;

            // --- I-Type (Load) ---
            case 'LB':
                memoryAddress = (val1 + imm) | 0;
                memoryValue = this.memory[memoryAddress];
                if (memoryValue === undefined) throw new Error(`Memory read error: No data at address 0x${memoryAddress.toString(16)}`);
                result = (memoryValue & 0x80) ? (memoryValue | 0xFFFFFF00) : (memoryValue & 0xFF);
                console.log(`   Load Byte from 0x${memoryAddress.toString(16)}: raw=0x${memoryValue.toString(16)}, sign-extended=0x${result.toString(16)} (${result})`);
                break;
            case 'LH':
                memoryAddress = (val1 + imm) | 0;
                // if (memoryAddress % 2 !== 0) console.warn(`LH: Unaligned memory access at 0x${memoryAddress.toString(16)}`);
                const lh_byte1 = this.memory[memoryAddress];
                const lh_byte2 = this.memory[memoryAddress + 1];
                if (lh_byte1 === undefined || lh_byte2 === undefined) throw new Error(`Memory read error: Failed to fetch 2 bytes at address 0x${memoryAddress.toString(16)}`);
                memoryValue = ((lh_byte2 | 0) << 8) | (lh_byte1 | 0);
                result = (memoryValue & 0x8000) ? (memoryValue | 0xFFFF0000) : (memoryValue & 0xFFFF);
                console.log(`   Load Half from 0x${memoryAddress.toString(16)}: raw=0x${memoryValue.toString(16)}, sign-extended=0x${result.toString(16)} (${result})`);
                break;
            case 'LW':
                memoryAddress = (val1 + imm) | 0;
                // if (memoryAddress % 4 !== 0) console.warn(`LW: Unaligned memory access at 0x${memoryAddress.toString(16)}`);
                const lw_byte1 = this.memory[memoryAddress];
                const lw_byte2 = this.memory[memoryAddress + 1];
                const lw_byte3 = this.memory[memoryAddress + 2];
                const lw_byte4 = this.memory[memoryAddress + 3];
                if (lw_byte1 === undefined || lw_byte2 === undefined || lw_byte3 === undefined || lw_byte4 === undefined) throw new Error(`Memory read error: Failed to fetch 4 bytes at address 0x${memoryAddress.toString(16)}`);
                result = ((lw_byte4 | 0) << 24) | ((lw_byte3 | 0) << 16) | ((lw_byte2 | 0) << 8) | (lw_byte1 | 0);
                console.log(`   Load Word from 0x${memoryAddress.toString(16)}: value=0x${result.toString(16)} (${result})`);
                break;
            case 'LBU':
                memoryAddress = (val1 + imm) | 0;
                memoryValue = this.memory[memoryAddress];
                if (memoryValue === undefined) throw new Error(`Memory read error: No data at address 0x${memoryAddress.toString(16)}`);
                result = memoryValue & 0xFF;
                console.log(`   Load Byte Unsigned from 0x${memoryAddress.toString(16)}: value=0x${result.toString(16)} (${result})`);
                break;
            case 'LHU':
                memoryAddress = (val1 + imm) | 0;
                // if (memoryAddress % 2 !== 0) console.warn(`LHU: Unaligned memory access at 0x${memoryAddress.toString(16)}`);
                const lhu_byte1 = this.memory[memoryAddress];
                const lhu_byte2 = this.memory[memoryAddress + 1];
                if (lhu_byte1 === undefined || lhu_byte2 === undefined) throw new Error(`Memory read error: Failed to fetch 2 bytes at address 0x${memoryAddress.toString(16)}`);
                result = (((lhu_byte2 | 0) << 8) | (lhu_byte1 | 0)) & 0xFFFF;
                console.log(`   Load Half Unsigned from 0x${memoryAddress.toString(16)}: value=0x${result.toString(16)} (${result})`);
                break;

            case 'JALR':
                nextPc = (val1 + imm) & ~1;
                result = pc + 4;
                console.log(`   JALR: Target=0x${nextPc.toString(16)}, Return Address (rd=x${rd})=0x${result.toString(16)}`);
                break;

            case 'SB':
                memoryAddress = (val1 + imm) | 0;
                memoryValue = val2 & 0xFF;
                this.memory[memoryAddress] = memoryValue;
                result = undefined;
                console.log(`   Store Byte: value=0x${memoryValue.toString(16)} to 0x${memoryAddress.toString(16)}`);
                break;
            case 'SH':
                memoryAddress = (val1 + imm) | 0;
                // if (memoryAddress % 2 !== 0) console.warn(`SH: Unaligned memory access at 0x${memoryAddress.toString(16)}`);
                this.memory[memoryAddress] = val2 & 0xFF;
                this.memory[memoryAddress + 1] = (val2 >> 8) & 0xFF;
                result = undefined;
                console.log(`   Store Half: value=0x${(val2 & 0xFFFF).toString(16)} to 0x${memoryAddress.toString(16)}`);
                break;
            case 'SW':
                memoryAddress = (val1 + imm) | 0;
                // if (memoryAddress % 4 !== 0) console.warn(`SW: Unaligned memory access at 0x${memoryAddress.toString(16)}`);
                this.memory[memoryAddress] = val2 & 0xFF;
                this.memory[memoryAddress + 1] = (val2 >> 8) & 0xFF;
                this.memory[memoryAddress + 2] = (val2 >> 16) & 0xFF;
                this.memory[memoryAddress + 3] = (val2 >> 24) & 0xFF;
                result = undefined;
                console.log(`   Store Word: value=0x${val2.toString(16)} (${val2}) to 0x${memoryAddress.toString(16)}`);
                break;

            case 'LUI':
                result = imm;
                console.log(`   LUI: result=0x${result.toString(16)}`);
                break;
            case 'AUIPC':
                result = (pc + imm) | 0;
                console.log(`   AUIPC: pc=0x${pc.toString(16)}, imm=0x${imm.toString(16)}, result=0x${result.toString(16)}`);
                break;

            case 'BEQ': branchTaken = (val1 === val2); break;
            case 'BNE': branchTaken = (val1 !== val2); break;
            case 'BLT': branchTaken = (val1 < val2); break;
            case 'BGE': branchTaken = (val1 >= val2); break;
            case 'BLTU': branchTaken = ((val1 >>> 0) < (val2 >>> 0)); break;
            case 'BGEU': branchTaken = ((val1 >>> 0) >= (val2 >>> 0)); break;

            case 'JAL':
                nextPc = (pc + imm) | 0;
                result = pc + 4;
                console.log(`   JAL: Target=0x${nextPc.toString(16)}, Return Address (rd=x${rd})=0x${result.toString(16)}`);
                break;

            case 'ECALL':
                console.warn("ECALL encountered.");
                this.handleSyscall();
                result = undefined;
                break;
            case 'EBREAK':
                console.warn("EBREAK encountered. Halting simulation.");
                this.isRunning = false;
                throw new Error("EBREAK instruction encountered."); // Hoặc chỉ dừng isRunning và không throw
                // result = undefined; // Không cần thiết vì đã throw
                break;

            default:
                console.error(`Execute: Instruction ${opName} (Type: ${type}) not implemented.`);
                throw new Error(`Execute: Instruction ${opName} not implemented.`);
        }

        if (rd !== undefined && rd !== 0 && result !== undefined) {
            this.registers[rd] = result | 0;
            console.log(`   Write reg x${rd}: 0x${this.registers[rd].toString(16).padStart(8, '0')} (${this.registers[rd]})`);
        } else if (rd === 0 && result !== undefined && result !== 0) { // Thêm điều kiện result !== 0 để tránh log khi x0 = 0
            console.log(`   Attempted to write to x0 (zero register) with value ${result}. Write ignored.`);
        }

        if (type === 'B') {
            console.log(`   Branch Condition (${opName}): ${branchTaken}`);
            if (branchTaken) {
                nextPc = (pc + imm) | 0;
                console.log(`   Branch taken to: 0x${nextPc.toString(16)}`);
            } else {
                console.log(`   Branch not taken.`);
            }
        }
        console.log("--- End Execute ---");
        return { nextPc };
    },

    handleSyscall() {
        const syscallId = this.registers[17]; // a7
        const arg0 = this.registers[10];      // a0
        const arg1 = this.registers[11];      // a1
        const arg2 = this.registers[12];      // a2

        console.log(`Syscall requested: ID = ${syscallId} (a7), Arg0 = ${arg0} (a0), Arg1 = ${arg1} (a1), Arg2 = ${arg2} (a2)`);

        switch (syscallId) {
            case 93: // exit (RARS/Spim convention)
            case 60: // exit (Linux convention often uses 60 for x86_64, RISC-V Linux uses 93)
                console.log(`>>> Syscall exit(${arg0}) called. Halting simulation.`);
                this.isRunning = false;
                alert(`Program exited with code: ${arg0}`);
                // Update a0 with exit code (though program is halting)
                if (this.registers[10] !== undefined) this.registers[10] = arg0;
                break;
            case 1: // print_int (RARS/Spim)
                console.log(`>>> Syscall print_int: ${arg0}`);
                alert(`Print Int: ${arg0}`);
                break;
            case 4: // print_string (RARS/Spim)
                let str = "";
                let addr = arg0;
                let charByte;
                console.log(`>>> Syscall print_string at address 0x${addr.toString(16)}`);
                while (true) {
                    charByte = this.memory[addr];
                    if (charByte === undefined || charByte === 0) break;
                    str += String.fromCharCode(charByte);
                    addr++;
                    if (str.length > 1000) {
                        console.warn("Syscall print_string: String too long, truncated.");
                        str += "... (truncated)";
                        break;
                    }
                }
                console.log(`String content: "${str}"`);
                alert(`Print String:\n${str}`);
                break;

            // Linux-like syscalls (RISC-V specific numbers)
            case 64: // write (Linux: riscv64) - fd in a0, buf_addr in a1, count in a2
                const fd_write = arg0;    // fd from a0
                const bufAddr_write = arg1; // buf_addr from a1
                const count_write = arg2;   // count from a2

                if (fd_write === 1) { // fd 1 is stdout
                    let outputStr = "";
                    console.log(`>>> Syscall write(fd=1, buf=0x${bufAddr_write.toString(16)}, count=${count_write})`);
                    for (let i = 0; i < count_write; i++) {
                        const byte = this.memory[bufAddr_write + i];
                        if (byte === undefined) {
                            console.warn(`Syscall write: Read undefined byte at 0x${(bufAddr_write + i).toString(16)}`);
                            this.registers[10] = i; // Return bytes written so far
                            return;
                        }
                        outputStr += String.fromCharCode(byte);
                    }
                    console.log(`Stdout content: "${outputStr}"`);
                    alert(`Write to stdout:\n${outputStr}`);
                    this.registers[10] = outputStr.length; // Return bytes written to a0
                } else {
                    console.warn(`Syscall write: Unsupported file descriptor ${fd_write}`);
                    this.registers[10] = -1; // Return error in a0 (e.g., -EBADF)
                }
                break;

            default:
                console.warn(`Unsupported syscall ID: ${syscallId}`);
            // For undefined syscalls, it's common to return an error code in a0, e.g., -ENOSYS
            // this.registers[10] = -38; // -ENOSYS
        }
    }
};
