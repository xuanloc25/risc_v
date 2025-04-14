// import { assembler } from './assembler.js'; // Không cần import assembler ở đây

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

    /**
     * Nạp chương trình (dữ liệu và lệnh) vào bộ nhớ của trình mô phỏng.
     * @param {object} programData - Đối tượng chứa { dataMemory, instructions, startAddress }.
     */
    loadProgram(programData) {
        this.reset(); // Reset simulator trước khi load chương trình mới

        // 1. Nạp phần dữ liệu (từ .data section của assembler)
        if (programData.dataMemory) {
            console.log("Loading data memory...");
            for (const addrStr in programData.dataMemory) {
                const addr = parseInt(addrStr);
                // Chỉ nạp nếu địa chỉ hợp lệ và giá trị là byte (0-255)
                if (!isNaN(addr) && typeof programData.dataMemory[addrStr] === 'number' && programData.dataMemory[addrStr] >= 0 && programData.dataMemory[addrStr] <= 255) {
                    this.memory[addr] = programData.dataMemory[addrStr];
                } else {
                    console.warn(`Skipping invalid data memory entry at '${addrStr}':`, programData.dataMemory[addrStr]);
                }
            }
            console.log("Data memory loaded.");
        } else {
            console.log("No data memory section found to load.");
        }

        // 2. Nạp phần lệnh (từ .text section của assembler)
        if (programData.instructions && programData.instructions.length > 0) {
            console.log(`Loading ${programData.instructions.length} instructions into memory...`);
            for (const instr of programData.instructions) {
                const address = instr.address;
                const binaryString = instr.binary;

                if (typeof address !== 'number' || typeof binaryString !== 'string' || binaryString.length !== 32) {
                    console.warn("Skipping invalid instruction format in program data:", instr);
                    continue;
                }

                try {
                    // Chuyển chuỗi nhị phân 32-bit thành số nguyên
                    // Sử dụng unsigned right shift (>>> 0) để xử lý như số không dấu 32-bit khi parse
                    const instructionWordValue = parseInt(binaryString, 2);
                    if (isNaN(instructionWordValue)) {
                        console.warn(`Failed to parse binary string: "${binaryString}" at address 0x${address.toString(16)}`);
                        continue;
                    }

                    // Ghi 4 byte vào bộ nhớ (little-endian)
                    this.memory[address] = instructionWordValue & 0xFF;          // Byte 0 (LSB)
                    this.memory[address + 1] = (instructionWordValue >> 8) & 0xFF; // Byte 1
                    this.memory[address + 2] = (instructionWordValue >> 16) & 0xFF;// Byte 2
                    this.memory[address + 3] = (instructionWordValue >> 24) & 0xFF;// Byte 3 (MSB)

                    // console.log(`  Loaded instruction 0x${instructionWordValue.toString(16).padStart(8,'0')} at 0x${address.toString(16).padStart(8,'0')}`);

                } catch (e) {
                    console.error(`Error loading instruction binary "${binaryString}" at 0x${address.toString(16)}:`, e);
                }
            }
            console.log("Instructions loaded into memory.");
        } else {
            console.log("No instructions found to load.");
        }


        // 3. Đặt Program Counter
        this.pc = programData.startAddress || 0; // Dùng startAddress từ assembler hoặc 0
        console.log(`Simulator PC set to start address: 0x${this.pc.toString(16).padStart(8, '0')}`);
        console.log("Simulator ready.");
    },

    // --- Thực thi ---
    run() {
        this.isRunning = true;
        this.instructionCount = 0;
        console.log(`Starting simulation run from PC: 0x${this.pc.toString(16).padStart(8, '0')}`);

        const runLoop = () => {
            if (!this.isRunning) {
                console.log("Simulation halted.");
                if (typeof window !== 'undefined' && window.updateUIGlobally) window.updateUIGlobally(); // Cập nhật UI lần cuối
                return;
            }

            if (this.instructionCount >= this.maxSteps) {
                this.isRunning = false;
                console.warn(`Simulation stopped: Maximum instruction steps (${this.maxSteps}) reached.`);
                // Có thể ném lỗi hoặc chỉ dừng
                if (typeof window !== 'undefined' && window.updateUIGlobally) window.updateUIGlobally();
                alert(`Simulation stopped: Maximum instruction steps (${this.maxSteps}) reached.`);
                return;
            }

            try {
                const currentPc = this.pc;
                this.step(); // Thực thi một lệnh (step đã bao gồm update UI)

                // Kiểm tra điều kiện dừng (ví dụ: ECALL exit - cần thêm logic xử lý syscall)
                // if (this.stoppedBySyscall) { this.isRunning = false; }

                // Kiểm tra vòng lặp vô hạn đơn giản
                if (this.isRunning && this.pc === currentPc) {
                    // Lệnh có thể là nhảy tới chính nó, hoặc lỗi cập nhật PC
                    // console.warn(`PC did not change after instruction at 0x${currentPc.toString(16)}. Potential infinite loop.`);
                    // Dừng hoặc cho phép tiếp tục tùy theo thiết kế
                }

                // Lập lịch cho bước tiếp theo (không chặn UI)
                if (this.isRunning) {
                    setTimeout(runLoop, 0); // Chạy bước tiếp theo ngay khi có thể
                } else {
                    console.log(`Simulation run finished after ${this.instructionCount} instructions. Final PC: 0x${this.pc.toString(16).padStart(8, '0')}`);
                    if (typeof window !== 'undefined' && window.updateUIGlobally) window.updateUIGlobally();
                }

            } catch (error) {
                this.isRunning = false;
                console.error("Error during simulation run:", error);
                alert(`Runtime Error: ${error.message}`); // Thông báo lỗi cho người dùng
                if (typeof window !== 'undefined' && window.updateUIGlobally) window.updateUIGlobally(); // Cập nhật UI để thấy trạng thái lỗi
            }
        };

        setTimeout(runLoop, 0); // Bắt đầu vòng lặp chạy
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

        // 1. Fetch
        const instructionWord = this.fetch(currentPcForStep);

        // Kiểm tra fetch thành công *trước khi* sử dụng instructionWord
        if (instructionWord === undefined) {
            // Lỗi đã được log trong fetch()
            throw new Error(`Failed to fetch instruction at address 0x${currentPcForStep.toString(16).padStart(8, '0')}. Halting.`);
        }
        // Log sau khi đã chắc chắn instructionWord hợp lệ
        console.log(` Fetched instruction word: 0x${instructionWord.toString(16).padStart(8, '0')} (Decimal: ${instructionWord})`);


        // 2. Decode
        const decoded = this.decode(instructionWord);
        console.log("  Decoded instruction:", decoded);
        if (decoded.opName === 'UNKNOWN') {
            throw new Error(`Could not decode instruction word: 0x${instructionWord.toString(16).padStart(8, '0')} at PC 0x${currentPcForStep.toString(16).padStart(8, '0')}`);
        }

        // 3. Execute
        const executionResult = this.execute(decoded); // Thực thi và lấy kết quả (có thể chứa nextPc)

        // 4. Cập nhật PC
        // Ưu tiên nextPc từ execute (cho jumps/branches)
        if (executionResult && executionResult.nextPc !== undefined) {
            this.pc = executionResult.nextPc;
            console.log(`  Jump/Branch taken/calculated. New PC: 0x${this.pc.toString(16).padStart(8, '0')}`);
        } else {
            // Mặc định tăng PC lên 4
            this.pc = currentPcForStep + 4;
            console.log(`  Incrementing PC to: 0x${this.pc.toString(16).padStart(8, '0')}`);
        }

        // 5. Write Back (đã thực hiện trong execute) và các cập nhật khác
        this.registers[0] = 0; // Luôn đảm bảo thanh ghi x0 = 0 sau mỗi lệnh
        this.instructionCount++;

        // 6. Cập nhật UI (nếu có)
        if (typeof window !== 'undefined' && window.updateUIGlobally) {
            window.updateUIGlobally();
        }
    },

    // --- Lõi CPU ---
    fetch(address) {
        const addrInt = parseInt(address);
        if (isNaN(addrInt)) {
            console.error(`Fetch Error: Invalid address format ${address}`);
            return undefined;
        }
        // RISC-V yêu cầu địa chỉ lệnh phải căn chỉnh 4 byte (hoặc 2 byte cho Compressed)
        // if (addrInt % 4 !== 0) {
        //     console.error(`Fetch Error: Unaligned instruction access at address 0x${addrInt.toString(16)}`);
        //     return undefined; // Hoặc ném lỗi tùy theo spec
        // }

        // Đọc 4 byte từ bộ nhớ (little-endian)
        const byte1 = this.memory[addrInt];
        const byte2 = this.memory[addrInt + 1];
        const byte3 = this.memory[addrInt + 2];
        const byte4 = this.memory[addrInt + 3];

        // Kiểm tra xem tất cả các byte có tồn tại không
        if (byte1 === undefined || byte2 === undefined || byte3 === undefined || byte4 === undefined) {
            console.error(`Fetch Error: Failed to fetch 4 bytes at address 0x${addrInt.toString(16)}`);
            console.error(` Bytes found: [${byte1}, ${byte2}, ${byte3}, ${byte4}] (undefined means missing)`);
            return undefined; // Trả về undefined nếu không đủ byte
        }

        // Kết hợp 4 byte thành số nguyên 32-bit (dùng | 0 để đảm bảo là số)
        const instruction = ((byte4 | 0) << 24) | ((byte3 | 0) << 16) | ((byte2 | 0) << 8) | (byte1 | 0);
        return instruction; // Trả về số nguyên 32-bit
    },

    decode(instructionWord) {
        // Trích xuất các trường cơ bản
        const opcode = instructionWord & 0x7F;
        const rd = (instructionWord >> 7) & 0x1F;
        const funct3 = (instructionWord >> 12) & 0x7;
        const rs1 = (instructionWord >> 15) & 0x1F;
        const rs2 = (instructionWord >> 20) & 0x1F;
        const funct7 = (instructionWord >> 25) & 0x7F;

        // Chuyển sang dạng chuỗi nhị phân để dễ so khớp với instructionFormats
        const opcodeBin = opcode.toString(2).padStart(7, '0');
        const funct3Bin = funct3.toString(2).padStart(3, '0');
        const funct7Bin = funct7.toString(2).padStart(7, '0');

        let imm = 0;
        let type = null;
        let opName = "UNKNOWN";

        // --- Xác định loại lệnh và tên lệnh ---
        // Sử dụng instructionFormats từ assembler (cần cách truy cập hoặc copy định nghĩa)
        // Tạm thời copy lại phần định nghĩa instructionFormats ở đây hoặc import nếu tách file
        const instructionFormats = { // Copy từ assembler.js hoặc import
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
            "ECALL": { type: "I", opcode: "1110011", funct3: "000", immField: "000000000000" }, // Dùng immField để phân biệt với các I-type khác
            "EBREAK": { type: "I", opcode: "1110011", funct3: "000", immField: "000000000001" },
        };

        for (const name in instructionFormats) {
            const format = instructionFormats[name];
            let match = false;
            if (format.opcode === opcodeBin) {
                if (format.type === 'R') {
                    if (format.funct3 === funct3Bin && format.funct7 === funct7Bin) match = true;
                } else if (format.type === 'I') {
                    // Phân biệt I-type thường, shifts, và system calls
                    if (format.immField !== undefined) { // ECALL, EBREAK
                        if (format.funct3 === funct3Bin && (instructionWord >>> 20).toString(2).padStart(12, '0') === format.immField) {
                            match = true;
                        }
                    } else if (format.funct7 !== undefined) { // Shifts (SLLI, SRLI, SRAI)
                        if (format.funct3 === funct3Bin && format.funct7 === funct7Bin) { // So sánh cả funct7
                            match = true;
                        }
                    } else { // I-type thông thường (ADDI, LW, JALR, etc.)
                        if (format.funct3 === funct3Bin) {
                            match = true;
                        }
                    }
                } else if (format.type === 'S' || format.type === 'B') {
                    if (format.funct3 === funct3Bin) match = true;
                } else if (format.type === 'U' || format.type === 'J') {
                    match = true; // Chỉ cần opcode
                }
            }
            if (match) {
                opName = name;
                type = format.type;
                break;
            }
        }

        // --- Tính giá trị Immediate (Sign Extended) ---
        if (type) {
            switch (type) {
                case "I":
                    // imm[11:0] sign-extended
                    imm = instructionWord >> 20; // JS >> tự động sign-extend từ bit 31
                    break;
                case "S":
                    // imm[11:5] và imm[4:0] ghép lại, sign-extended
                    imm = (((instructionWord >> 25) & 0x7F) << 5) | ((instructionWord >> 7) & 0x1F);
                    // Sign extend từ bit 11 của immediate (bit 31 của instruction)
                    if ((instructionWord >> 31) & 1) imm |= 0xFFFFF000; // (~0 << 12)
                    break;
                case "B":
                    // imm[12|10:5] và imm[4:1|11] ghép lại, nhân 2, sign-extended
                    imm = (((instructionWord >> 31) & 0x1) << 12) | // imm[12]
                        (((instructionWord >> 7) & 0x1) << 11) |    // imm[11]
                        (((instructionWord >> 25) & 0x3F) << 5) |   // imm[10:5]
                        (((instructionWord >> 8) & 0xF) << 1);      // imm[4:1]
                    // Sign extend từ bit 12 của immediate
                    if ((instructionWord >> 31) & 1) imm |= 0xFFFFE000; // (~0 << 13)
                    break;
                case "U":
                    // imm[31:12] << 12 (không sign-extend)
                    imm = instructionWord & 0xFFFFF000;
                    break;
                case "J":
                    // imm[20|10:1|11|19:12] ghép lại, nhân 2, sign-extended
                    imm = (((instructionWord >> 31) & 0x1) << 20) |   // imm[20]
                        (((instructionWord >> 12) & 0xFF) << 12) |  // imm[19:12]
                        (((instructionWord >> 20) & 0x1) << 11) |   // imm[11]
                        (((instructionWord >> 21) & 0x3FF) << 1);  // imm[10:1]
                    // Sign extend từ bit 20 của immediate
                    if ((instructionWord >> 31) & 1) imm |= 0xFFE00000; // (~0 << 21)
                    break;
                // R-type không có immediate chính
            }
        } else {
            console.warn(`Could not determine instruction type for word: 0x${instructionWord.toString(16).padStart(8, '0')}`);
        }

        // Log kết quả decode
        // console.log("--- Decoded ---");
        // console.log(`  opName: ${opName}, type: ${type}`);
        // console.log(`  rd: x${rd}, rs1: x${rs1}, rs2: x${rs2}`);
        // console.log(`  funct3: ${funct3Bin}, funct7: ${funct7Bin}`);
        // console.log(`  imm: ${imm} (0x${(imm).toString(16)})`);
        // console.log("---------------");

        return { opName, type, opcode: opcodeBin, rd, rs1, rs2, funct3: funct3Bin, funct7: funct7Bin, imm };
    },

    execute(decoded) {
        const { opName, type, rd, rs1, rs2, funct3, funct7, imm } = decoded;

        // Đọc giá trị thanh ghi nguồn (x0 luôn là 0)
        // Dùng | 0 để đảm bảo kết quả là số nguyên 32-bit signed
        const val1 = (rs1 === 0) ? 0 : (this.registers[rs1] | 0);
        const val2 = (rs2 === 0) ? 0 : (this.registers[rs2] | 0);
        const pc = this.pc; // PC của lệnh hiện tại

        let result = undefined;    // Kết quả ghi vào rd
        let memoryAddress = 0;     // Địa chỉ load/store
        let memoryValue = 0;       // Giá trị đọc/ghi bộ nhớ
        let branchTaken = false;   // Cờ rẽ nhánh
        let nextPc = undefined;    // PC tiếp theo nếu có nhảy/rẽ nhánh

        console.log(`  Executing: ${opName} rd=x${rd}, rs1=x${rs1}(${val1}), rs2=x${rs2}(${val2}), imm=${imm}`);

        // --- Logic thực thi ---
        switch (opName) {
            // --- R-Type ---
            case 'ADD': result = (val1 + val2) | 0; break;
            case 'SUB': result = (val1 - val2) | 0; break;
            case 'SLL': result = (val1 << (val2 & 0x1F)) | 0; break; // Chỉ dùng 5 bit thấp của val2
            case 'SLT': result = (val1 < val2) ? 1 : 0; break;
            case 'SLTU': result = ((val1 >>> 0) < (val2 >>> 0)) ? 1 : 0; break; // So sánh không dấu
            case 'XOR': result = (val1 ^ val2) | 0; break;
            case 'SRL': result = val1 >>> (val2 & 0x1F); break; // Dịch logic không dấu
            case 'SRA': result = val1 >> (val2 & 0x1F); break; // Dịch số học có dấu
            case 'OR': result = (val1 | val2) | 0; break;
            case 'AND': result = (val1 & val2) | 0; break;

            // --- I-Type (Arithmetic/Logic) ---
            case 'ADDI': result = (val1 + imm) | 0; break;
            case 'SLTI': result = (val1 < imm) ? 1 : 0; break;
            case 'SLTIU': result = ((val1 >>> 0) < (imm >>> 0)) ? 1 : 0; break; // Imm coi như không dấu? (Spec: sign-extend imm then compare) -> Nên là (val1 >>> 0) < (imm | 0 >>> 0) ? KHÔNG, imm đã sign-extend, so sánh val1 unsigned với imm signed
                // Spec RVFI nói: x[rd] = (x[rs1] <u imm) ? 1 : 0. imm được sign-extend. Vậy so sánh unsigned của rs1 với imm đã sign-extend.
                result = ((val1 >>> 0) < (imm | 0)) ? 1 : 0; // Cách hiểu này có vẻ đúng hơn
                break;
            case 'XORI': result = (val1 ^ imm) | 0; break;
            case 'ORI': result = (val1 | imm) | 0; break;
            case 'ANDI': result = (val1 & imm) | 0; break;

            // --- I-Type (Shifts Immediate) ---
            // imm[4:0] là shamt
            case 'SLLI': result = (val1 << (imm & 0x1F)) | 0; break;
            case 'SRLI': result = val1 >>> (imm & 0x1F); break;
            case 'SRAI': result = val1 >> (imm & 0x1F); break;

            // --- I-Type (Load) ---
            case 'LB':
                memoryAddress = (val1 + imm) | 0;
                memoryValue = this.memory[memoryAddress];
                if (memoryValue === undefined) throw new Error(`Memory read error: No data at address 0x${memoryAddress.toString(16)}`);
                result = (memoryValue & 0x80) ? (memoryValue | 0xFFFFFF00) : (memoryValue & 0xFF); // Sign extend byte
                console.log(`   Load Byte from 0x${memoryAddress.toString(16)}: raw=0x${memoryValue.toString(16)}, sign-extended=0x${result.toString(16)} (${result})`);
                break;
            case 'LH':
                memoryAddress = (val1 + imm) | 0;
                const lh_byte1 = this.memory[memoryAddress];
                const lh_byte2 = this.memory[memoryAddress + 1];
                if (lh_byte1 === undefined || lh_byte2 === undefined) throw new Error(`Memory read error: Failed to fetch 2 bytes at address 0x${memoryAddress.toString(16)}`);
                memoryValue = ((lh_byte2 | 0) << 8) | (lh_byte1 | 0);
                result = (memoryValue & 0x8000) ? (memoryValue | 0xFFFF0000) : (memoryValue & 0xFFFF); // Sign extend half
                console.log(`   Load Half from 0x${memoryAddress.toString(16)}: raw=0x${memoryValue.toString(16)}, sign-extended=0x${result.toString(16)} (${result})`);
                break;
            case 'LW':
                memoryAddress = (val1 + imm) | 0;
                if (memoryAddress % 4 !== 0) console.warn(`LW: Unaligned memory access at 0x${memoryAddress.toString(16)}`); // Cảnh báo nếu không align
                const lw_byte1 = this.memory[memoryAddress];
                const lw_byte2 = this.memory[memoryAddress + 1];
                const lw_byte3 = this.memory[memoryAddress + 2];
                const lw_byte4 = this.memory[memoryAddress + 3];
                if (lw_byte1 === undefined || lw_byte2 === undefined || lw_byte3 === undefined || lw_byte4 === undefined) throw new Error(`Memory read error: Failed to fetch 4 bytes at address 0x${memoryAddress.toString(16)}`);
                result = ((lw_byte4 | 0) << 24) | ((lw_byte3 | 0) << 16) | ((lw_byte2 | 0) << 8) | (lw_byte1 | 0); // Little-endian load
                console.log(`   Load Word from 0x${memoryAddress.toString(16)}: value=0x${result.toString(16)} (${result})`);
                break;
            case 'LBU':
                memoryAddress = (val1 + imm) | 0;
                memoryValue = this.memory[memoryAddress];
                if (memoryValue === undefined) throw new Error(`Memory read error: No data at address 0x${memoryAddress.toString(16)}`);
                result = memoryValue & 0xFF; // Zero extend byte
                console.log(`   Load Byte Unsigned from 0x${memoryAddress.toString(16)}: value=0x${result.toString(16)} (${result})`);
                break;
            case 'LHU':
                memoryAddress = (val1 + imm) | 0;
                if (memoryAddress % 2 !== 0) console.warn(`LHU: Unaligned memory access at 0x${memoryAddress.toString(16)}`); // Cảnh báo nếu không align
                const lhu_byte1 = this.memory[memoryAddress];
                const lhu_byte2 = this.memory[memoryAddress + 1];
                if (lhu_byte1 === undefined || lhu_byte2 === undefined) throw new Error(`Memory read error: Failed to fetch 2 bytes at address 0x${memoryAddress.toString(16)}`);
                result = (((lhu_byte2 | 0) << 8) | (lhu_byte1 | 0)) & 0xFFFF; // Zero extend half
                console.log(`   Load Half Unsigned from 0x${memoryAddress.toString(16)}: value=0x${result.toString(16)} (${result})`);
                break;

            // --- I-Type (Jump and Link Register) ---
            case 'JALR':
                nextPc = (val1 + imm) & ~1; // Tính địa chỉ nhảy, đảm bảo bit cuối là 0 (align 2)
                result = pc + 4;            // Địa chỉ lệnh tiếp theo lưu vào rd
                console.log(`   JALR: Target=0x${nextPc.toString(16)}, Return Address (rd=x${rd})=0x${result.toString(16)}`);
                break;

            // --- S-Type (Store) ---
            case 'SB':
                memoryAddress = (val1 + imm) | 0;
                memoryValue = val2 & 0xFF; // Lấy byte thấp của rs2
                this.memory[memoryAddress] = memoryValue;
                result = undefined; // Store không ghi vào rd
                console.log(`   Store Byte: value=0x${memoryValue.toString(16)} to 0x${memoryAddress.toString(16)}`);
                break;
            case 'SH':
                memoryAddress = (val1 + imm) | 0;
                if (memoryAddress % 2 !== 0) console.warn(`SH: Unaligned memory access at 0x${memoryAddress.toString(16)}`);
                this.memory[memoryAddress] = val2 & 0xFF;         // Byte thấp
                this.memory[memoryAddress + 1] = (val2 >> 8) & 0xFF; // Byte cao
                result = undefined;
                console.log(`   Store Half: value=0x${(val2 & 0xFFFF).toString(16)} to 0x${memoryAddress.toString(16)}`);
                break;
            case 'SW':
                memoryAddress = (val1 + imm) | 0;
                if (memoryAddress % 4 !== 0) console.warn(`SW: Unaligned memory access at 0x${memoryAddress.toString(16)}`);
                this.memory[memoryAddress] = val2 & 0xFF;
                this.memory[memoryAddress + 1] = (val2 >> 8) & 0xFF;
                this.memory[memoryAddress + 2] = (val2 >> 16) & 0xFF;
                this.memory[memoryAddress + 3] = (val2 >> 24) & 0xFF;
                result = undefined;
                console.log(`   Store Word: value=0x${val2.toString(16)} (${val2}) to 0x${memoryAddress.toString(16)}`);
                break;

            // --- U-Type ---
            case 'LUI': // Load Upper Immediate
                result = imm; // imm đã là value << 12
                console.log(`   LUI: result=0x${result.toString(16)}`);
                break;
            case 'AUIPC': // Add Upper Immediate to PC
                result = (pc + imm) | 0;
                console.log(`   AUIPC: pc=0x${pc.toString(16)}, imm=0x${imm.toString(16)}, result=0x${result.toString(16)}`);
                break;

            // --- B-Type (Branch) ---
            case 'BEQ': branchTaken = (val1 === val2); break;
            case 'BNE': branchTaken = (val1 !== val2); break;
            case 'BLT': branchTaken = (val1 < val2); break;   // Signed compare
            case 'BGE': branchTaken = (val1 >= val2); break;  // Signed compare
            case 'BLTU': branchTaken = ((val1 >>> 0) < (val2 >>> 0)); break; // Unsigned compare
            case 'BGEU': branchTaken = ((val1 >>> 0) >= (val2 >>> 0)); break; // Unsigned compare

            // --- J-Type (Jump and Link) ---
            case 'JAL':
                nextPc = (pc + imm) | 0; // Tính địa chỉ nhảy tuyệt đối
                result = pc + 4;         // Lưu địa chỉ trả về vào rd
                console.log(`   JAL: Target=0x${nextPc.toString(16)}, Return Address (rd=x${rd})=0x${result.toString(16)}`);
                break;

            // --- System ---
            case 'ECALL':
                // TODO: Implement system call handling based on registers (e.g., a7, a0, a1)
                console.warn("ECALL encountered. Syscall handling not fully implemented.");
                // Tạm thời dừng mô phỏng như một ví dụ
                this.handleSyscall(); // Gọi hàm xử lý syscall
                result = undefined; // ECALL không ghi vào rd
                break;
            case 'EBREAK':
                console.warn("EBREAK encountered. Halting simulation (like a debugger breakpoint).");
                this.isRunning = false; // Dừng vòng lặp run
                // Có thể ném lỗi hoặc đặt cờ để debugger xử lý
                throw new Error("EBREAK instruction encountered.");
                result = undefined;
                break;

            default:
                console.error(`Execute: Instruction ${opName} (Type: ${type}) not implemented.`);
                throw new Error(`Execute: Instruction ${opName} not implemented.`);
        }

        // --- Write Back (Ghi kết quả vào thanh ghi đích) ---
        if (rd !== undefined && rd !== 0 && result !== undefined) {
            this.registers[rd] = result | 0; // Đảm bảo ghi giá trị 32-bit signed
            console.log(`   Write reg x${rd}: 0x${this.registers[rd].toString(16).padStart(8, '0')} (${this.registers[rd]})`);
        } else if (rd === 0 && result !== undefined) {
            console.log(`   Attempted to write to x0 (zero register). Write ignored. Value was: ${result}`);
        }

        // Xử lý PC cho lệnh Branch sau khi tính branchTaken
        if (type === 'B') {
            console.log(`   Branch Condition (${opName}): ${branchTaken}`);
            if (branchTaken) {
                nextPc = (pc + imm) | 0; // Tính địa chỉ rẽ nhánh nếu điều kiện đúng
                console.log(`   Branch taken to: 0x${nextPc.toString(16)}`);
            } else {
                console.log(`   Branch not taken.`);
                // nextPc sẽ là undefined, PC sẽ tự động +4
            }
            // Lệnh B không ghi vào rd, nên result không cần thiết
        }

        console.log("--- End Execute ---");
        // Trả về đối tượng chứa nextPc nếu có nhảy/rẽ nhánh thành công hoặc JAL/JALR
        return { nextPc };
    },

    // --- Xử lý Syscall (Ví dụ đơn giản) ---
    handleSyscall() {
        const syscallId = this.registers[17]; // a7 chứa mã syscall
        const arg0 = this.registers[10];      // a0
        const arg1 = this.registers[11];      // a1
        // ... các thanh ghi tham số khác nếu cần

        console.log(`Syscall requested: ID = ${syscallId} (a7), Arg0 = ${arg0} (a0)`);

        switch (syscallId) {
            case 93: // exit (chตาม RARS/Spim)
                console.log(`>>> Syscall exit(${arg0}) called. Halting simulation.`);
                this.isRunning = false; // Dừng vòng lặp run
                // Có thể hiển thị exit code arg0 trong UI
                alert(`Program exited with code: ${arg0}`);
                break;
            case 1: // print_int (theo RARS/Spim)
                console.log(`>>> Syscall print_int: ${arg0}`);
                alert(`Print Int: ${arg0}`); // Hiển thị tạm bằng alert
                break;
            case 4: // print_string (theo RARS/Spim)
                let str = "";
                let addr = arg0;
                let charByte;
                console.log(`>>> Syscall print_string at address 0x${addr.toString(16)}`);
                while (true) {
                    charByte = this.memory[addr];
                    if (charByte === undefined || charByte === 0) break; // Kết thúc chuỗi hoặc lỗi đọc
                    str += String.fromCharCode(charByte);
                    addr++;
                    if (str.length > 1000) { // Giới hạn độ dài để tránh treo
                        console.warn("Syscall print_string: String too long, truncated.");
                        str += "... (truncated)";
                        break;
                    }
                }
                console.log(`String content: "${str}"`);
                alert(`Print String:\n${str}`); // Hiển thị tạm
                break;
            case 10: // exit (theo Linux - thường dùng hơn)
                console.log(`>>> Syscall exit(${arg0}) called [Linux convention]. Halting simulation.`);
                this.isRunning = false;
                alert(`Program exited with code: ${arg0}`);
                break;
            case 64: // write (theo Linux) - a0=fd, a1=buf_addr, a2=count
                const fd = arg0;
                const bufAddr = this.registers[11]; // a1
                const count = this.registers[12];   // a2
                if (fd === 1) { // fd 1 là stdout
                    let outputStr = "";
                    console.log(`>>> Syscall write(fd=1, buf=0x${bufAddr.toString(16)}, count=${count})`);
                    for (let i = 0; i < count; i++) {
                        const byte = this.memory[bufAddr + i];
                        if (byte === undefined) {
                            console.warn(`Syscall write: Read undefined byte at 0x${(bufAddr + i).toString(16)}`);
                            break;
                        }
                        outputStr += String.fromCharCode(byte);
                    }
                    console.log(`String content: "${outputStr}"`);
                    alert(`Write to stdout:\n${outputStr}`); // Hiển thị tạm
                    // TODO: Ghi vào một ô output riêng biệt thay vì alert
                    this.registers[10] = outputStr.length; // Trả về số byte đã ghi vào a0
                } else {
                    console.warn(`Syscall write: Unsupported file descriptor ${fd}`);
                    this.registers[10] = -1; // Trả về lỗi trong a0
                }
                break;

            // Thêm các syscall khác nếu cần (read_int, read_string, sbrk, etc.)

            default:
                console.warn(`Unsupported syscall ID: ${syscallId}`);
            // Có thể dừng hoặc tiếp tục tùy theo yêu cầu
            // this.isRunning = false;
            // throw new Error(`Unsupported syscall ID: ${syscallId}`);
        }
    }
};
