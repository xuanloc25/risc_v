import { TL_A_Opcode, TL_D_Opcode, TL_Param_Arithmetic } from './tilelink.js';

// TileLink-UL CPU implementation
export class CPU {
    constructor() {
        this.registers = new Int32Array(32);
        this.fregisters = new Float32Array(32);
        this.pc = 0;
        this.upperPort = null;
        this.lowerPort = null;
        this.isRunning = false;
        this.instructionCount = 0;
        this.maxSteps = 1000000;
        this.pendingResponse = null;
        this.waitingRequest = null;
        this.resolve = null;
        this.fetchPending = null;
        this.fetchWaiting = false;
        this.replayInstruction = null;
    }

    resetRegisters() {
        this.registers.fill(0);
        this.fregisters.fill(0.0);
    }

    reset() {
        this.resetRegisters();
        this.isRunning = false;
        this.instructionCount = 0;
        this.pendingResponse = null;
        this.waitingRequest = null;
        this.resolve = null;
        this.fetchPending = null;
        this.fetchWaiting = false;
        this.replayInstruction = null;
    }

    loadProgram(programData) {
        this.reset();
        this.pc = programData.startAddress || 0;
    }

    attachUpperPort(upperPort) {
        this.upperPort = upperPort;
    }

    attachLowerPort(lowerPort) {
        this.lowerPort = lowerPort;
    }

    _resolveBus(bus = this.lowerPort) {
        if (!bus) throw new Error('CPU has no attached lower port');
        return bus;
    }

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

        const rs3 = (instructionWord >> 27) & 0x1F;
        const fmt = (instructionWord >> 25) & 0x3;
        const fmtBin = fmt.toString(2).padStart(2, '0');

        let imm = 0;
        let type = null;
        let opName = 'UNKNOWN';
        let rm = funct3;

        const instructionFormats = {
            'ADD': { type: 'R', opcode: '0110011', funct3: '000', funct7: '0000000' },
            'SUB': { type: 'R', opcode: '0110011', funct3: '000', funct7: '0100000' },
            'SLL': { type: 'R', opcode: '0110011', funct3: '001', funct7: '0000000' },
            'SLT': { type: 'R', opcode: '0110011', funct3: '010', funct7: '0000000' },
            'SLTU': { type: 'R', opcode: '0110011', funct3: '011', funct7: '0000000' },
            'XOR': { type: 'R', opcode: '0110011', funct3: '100', funct7: '0000000' },
            'SRL': { type: 'R', opcode: '0110011', funct3: '101', funct7: '0000000' },
            'SRA': { type: 'R', opcode: '0110011', funct3: '101', funct7: '0100000' },
            'OR': { type: 'R', opcode: '0110011', funct3: '110', funct7: '0000000' },
            'AND': { type: 'R', opcode: '0110011', funct3: '111', funct7: '0000000' },
            'ADDI': { type: 'I', opcode: '0010011', funct3: '000' },
            'SLTI': { type: 'I', opcode: '0010011', funct3: '010' },
            'SLTIU': { type: 'I', opcode: '0010011', funct3: '011' },
            'XORI': { type: 'I', opcode: '0010011', funct3: '100' },
            'ORI': { type: 'I', opcode: '0010011', funct3: '110' },
            'ANDI': { type: 'I', opcode: '0010011', funct3: '111' },
            'SLLI': { type: 'I-shamt', opcode: '0010011', funct3: '001', funct7Matcher: '0000000' },
            'SRLI': { type: 'I-shamt', opcode: '0010011', funct3: '101', funct7Matcher: '0000000' },
            'SRAI': { type: 'I-shamt', opcode: '0010011', funct3: '101', funct7Matcher: '0100000' },
            'LW': { type: 'I', opcode: '0000011', funct3: '010' },
            'LH': { type: 'I', opcode: '0000011', funct3: '001' },
            'LB': { type: 'I', opcode: '0000011', funct3: '000' },
            'LHU': { type: 'I', opcode: '0000011', funct3: '101' },
            'LBU': { type: 'I', opcode: '0000011', funct3: '100' },
            'SW': { type: 'S', opcode: '0100011', funct3: '010' },
            'SH': { type: 'S', opcode: '0100011', funct3: '001' },
            'SB': { type: 'S', opcode: '0100011', funct3: '000' },
            'LUI': { type: 'U', opcode: '0110111' },
            'AUIPC': { type: 'U', opcode: '0010111' },
            'JAL': { type: 'J', opcode: '1101111' },
            'JALR': { type: 'I', opcode: '1100111', funct3: '000' },
            'BEQ': { type: 'B', opcode: '1100011', funct3: '000' },
            'BNE': { type: 'B', opcode: '1100011', funct3: '001' },
            'BLT': { type: 'B', opcode: '1100011', funct3: '100' },
            'BGE': { type: 'B', opcode: '1100011', funct3: '101' },
            'BLTU': { type: 'B', opcode: '1100011', funct3: '110' },
            'BGEU': { type: 'B', opcode: '1100011', funct3: '111' },
            'ECALL': { type: 'I', opcode: '1110011', funct3: '000', immFieldMatcher: '000000000000' },
            'EBREAK': { type: 'I', opcode: '1110011', funct3: '000', immFieldMatcher: '000000000001' },
            'MUL': { type: 'R', opcode: '0110011', funct3: '000', funct7: '0000001' },
            'MULH': { type: 'R', opcode: '0110011', funct3: '001', funct7: '0000001' },
            'MULHSU': { type: 'R', opcode: '0110011', funct3: '010', funct7: '0000001' },
            'MULHU': { type: 'R', opcode: '0110011', funct3: '011', funct7: '0000001' },
            'DIV': { type: 'R', opcode: '0110011', funct3: '100', funct7: '0000001' },
            'DIVU': { type: 'R', opcode: '0110011', funct3: '101', funct7: '0000001' },
            'REM': { type: 'R', opcode: '0110011', funct3: '110', funct7: '0000001' },
            'REMU': { type: 'R', opcode: '0110011', funct3: '111', funct7: '0000001' },
            'FLW': { type: 'I-FP', opcode: '0000111', funct3: '010' },
            'FSW': { type: 'S-FP', opcode: '0100111', funct3: '010' },
            'FMADD.S': { type: 'R4-FP', opcode: '1000011', funct3: '000', fmt: '00' },
            'FMSUB.S': { type: 'R4-FP', opcode: '1000111', funct3: '000', fmt: '00' },
            'FNMSUB.S': { type: 'R4-FP', opcode: '1001011', funct3: '000', fmt: '00' },
            'FNMADD.S': { type: 'R4-FP', opcode: '1001111', funct3: '000', fmt: '00' },
            'FADD.S': { type: 'R-FP', opcode: '1010011', funct3: '000', funct7: '0000000' },
            'FSUB.S': { type: 'R-FP', opcode: '1010011', funct3: '000', funct7: '0000100' },
            'FMUL.S': { type: 'R-FP', opcode: '1010011', funct3: '000', funct7: '0001000' },
            'FDIV.S': { type: 'R-FP', opcode: '1010011', funct3: '000', funct7: '0001100' },
            'FSQRT.S': { type: 'R-FP-CVT', opcode: '1010011', funct7: '0101100', rs2_subfield: '00000' },
            'FMIN.S': { type: 'R-FP', opcode: '1010011', funct3: '001', funct7: '0010100' },
            'FMAX.S': { type: 'R-FP', opcode: '1010011', funct3: '000', funct7: '0010100' },
            'FSGNJ.S': { type: 'R-FP', opcode: '1010011', funct3: '000', funct7: '0010000' },
            'FSGNJN.S': { type: 'R-FP', opcode: '1010011', funct3: '001', funct7: '0010000' },
            'FSGNJX.S': { type: 'R-FP', opcode: '1010011', funct3: '010', funct7: '0010000' },
            'FCVT.W.S': { type: 'R-FP-CVT', opcode: '1010011', funct7: '1100000', rs2_subfield: '00000' },
            'FCVT.WU.S': { type: 'R-FP-CVT', opcode: '1010011', funct7: '1100000', rs2_subfield: '00001' },
            'FCVT.S.W': { type: 'R-FP-CVT', opcode: '1010011', funct7: '1101000', rs2_subfield: '00000' },
            'FCVT.S.WU': { type: 'R-FP-CVT', opcode: '1010011', funct7: '1101000', rs2_subfield: '00001' },
            'FCLASS.S': { type: 'R-FP-CVT', opcode: '1010011', funct3_fixed: '001', funct7: '1110000', rs2_subfield: '00000' },
            'FEQ.S': { type: 'R-FP-CMP', opcode: '1010011', funct3: '010', funct7_prefix: '10100' },
            'FLT.S': { type: 'R-FP-CMP', opcode: '1010011', funct3: '001', funct7_prefix: '10100' },
            'FLE.S': { type: 'R-FP-CMP', opcode: '1010011', funct3: '000', funct7_prefix: '10100' },
            'FMV.X.W': { type: 'R-FP-CVT', opcode: '1010011', funct7: '1110000', rs2_subfield: '00000', funct3_fixed: '000' },
            'FMV.W.X': { type: 'R-FP-CVT', opcode: '1010011', funct7: '1111000', rs2_subfield: '00000', funct3_fixed: '000' },
            'AMOADD.W': { type: 'R-AMO', opcode: '0101111', funct3: '010', funct7: '0000000' }
        };

        for (const name in instructionFormats) {
            const format = instructionFormats[name];
            let match = false;
            if (format.opcode === opcodeBin) {
                if (format.type === 'R' || format.type === 'R-FP' || format.type === 'R-FP-CMP' || format.type === 'R-AMO') {
                    if (format.funct3 === funct3Bin || format.funct3_fixed === funct3Bin || format.funct3 === 'ANY' || format.funct3_cmp === funct3Bin) {
                        if (format.funct7 === funct7Bin || format.funct7_op === funct7Bin || format.funct7_prefix === funct7Bin.substring(0, 5)) {
                            if (format.rs2_fmt && format.rs2_fmt !== rs2.toString(2).padStart(5, '0').substring(0, format.rs2_fmt.length)) {
                                // not matched
                            }
                            match = true;
                        }
                    }
                } else if (format.type === 'R-FP-CVT') {
                    if (format.funct3_rm === funct3Bin || format.funct3_rm === 'ANY' || format.funct3_fixed === funct3Bin || (!format.funct3_rm && !format.funct3_fixed)) {
                        if (format.funct7 === funct7Bin || format.funct7_op === funct7Bin) {
                            if (format.rs2_subfield && format.rs2_subfield !== rs2.toString(2).padStart(5, '0').substring(0, format.rs2_subfield.length)) {
                                // not matched
                            } else {
                                match = true;
                            }
                        }
                    }
                } else if (format.type === 'R4-FP') {
                    if (format.funct3 === 'ANY' || format.funct3 === funct3Bin || !format.funct3) {
                        if (format.fmt === fmtBin) {
                            match = true;
                        }
                    }
                } else if (format.type === 'I' || format.type === 'I-FP' || format.type === 'I-shamt') {
                    if (format.funct3 === funct3Bin) {
                        if (format.immFieldMatcher !== undefined) {
                            if ((instructionWord >>> 20).toString(2).padStart(12, '0') === format.immFieldMatcher) match = true;
                        } else if (format.funct7Matcher !== undefined) {
                            if (funct7Bin === format.funct7Matcher) match = true;
                        } else {
                            match = true;
                        }
                    }
                } else if (format.type === 'S' || format.type === 'S-FP' || format.type === 'B') {
                    if (format.funct3 === funct3Bin) match = true;
                } else if (format.type === 'U' || format.type === 'J') {
                    match = true;
                }
            }
            if (match) {
                opName = name;
                type = format.type;
                if (type.startsWith('R-FP') && !type.endsWith('CMP') && format.funct3_fixed === undefined) {
                    rm = funct3;
                } else if (type.startsWith('R-FP-CVT') && format.funct3_fixed === undefined) {
                    rm = funct3;
                }
                break;
            }
        }

        if (type) {
            switch (type) {
                case 'I':
                case 'I-FP':
                    imm = instructionWord >> 20;
                    break;
                case 'I-shamt':
                    imm = (instructionWord >> 20) & 0x1F;
                    break;
                case 'S':
                case 'S-FP':
                    imm = (((instructionWord >> 25) & 0x7F) << 5) | ((instructionWord >> 7) & 0x1F);
                    if ((instructionWord >> 31) & 1) imm |= 0xFFFFF000;
                    break;
                case 'B':
                    imm = (((instructionWord >> 31) & 0x1) << 12) |
                        (((instructionWord >> 7) & 0x1) << 11) |
                        (((instructionWord >> 25) & 0x3F) << 5) |
                        (((instructionWord >> 8) & 0xF) << 1);
                    if ((instructionWord >> 31) & 1) imm |= 0xFFFFE000;
                    break;
                case 'U':
                    imm = instructionWord >>> 12;
                    break;
                case 'J':
                    imm = (((instructionWord >> 31) & 0x1) << 20) |
                        (((instructionWord >> 12) & 0xFF) << 12) |
                        (((instructionWord >> 20) & 0x1) << 11) |
                        (((instructionWord >> 21) & 0x3FF) << 1);
                    if ((instructionWord >> 31) & 1) imm |= 0xFFE00000;
                    break;
            }
        }

        return { opName, type, opcode: opcodeBin, rd, rs1, rs2, rs3, fmt: fmtBin, funct3: funct3Bin, funct7: funct7Bin, imm, rm };
    }

    execute(decoded, bus) {
        if (!bus || typeof bus.memBytes !== 'function') throw new Error('Bus has no attached memory');

        const { opName, type, rd, rs1, rs2, funct3, funct7, imm, rm } = decoded;

        const val1_int = (rs1 === 0 && type !== 'R-FP-CVT' && type !== 'FMV.W.X') ? 0 : (this.registers[rs1] | 0);
        const val2_int = (rs2 === 0 && type !== 'R-FP-CVT') ? 0 : (this.registers[rs2] | 0);

        const val1_fp = this.fregisters[rs1];
        const val2_fp = this.fregisters[rs2];
        const val3_fp = decoded.rs3 !== undefined ? this.fregisters[decoded.rs3] : 0;

        const pc = this.pc;

        let result_int = undefined;
        let result_fp = undefined;
        let memoryAddress = 0;
        let memoryValue = 0;
        let branchTaken = false;
        let nextPc = undefined;

        const INT32_MIN = -2147483648;
        const UINT32_MAX_AS_SIGNED = -1;

        switch (opName) {
            case 'ADD': result_int = (val1_int + val2_int) | 0; break;
            case 'SUB': result_int = (val1_int - val2_int) | 0; break;
            case 'SLL': result_int = (val1_int << (val2_int & 0x1F)) | 0; break;
            case 'SLT': result_int = (val1_int < val2_int) ? 1 : 0; break;
            case 'SLTU': result_int = ((val1_int >>> 0) < (val2_int >>> 0)) ? 1 : 0; break;
            case 'XOR': result_int = (val1_int ^ val2_int) | 0; break;
            case 'SRL': result_int = val1_int >>> (val2_int & 0x1F); break;
            case 'SRA': result_int = val1_int >> (val2_int & 0x1F); break;
            case 'OR': result_int = (val1_int | val2_int) | 0; break;
            case 'AND': result_int = (val1_int & val2_int) | 0; break;
            case 'MUL': result_int = Math.imul(val1_int, val2_int); break;
            case 'MULH': result_int = Number((BigInt(val1_int) * BigInt(val2_int)) >> 32n); break;
            case 'MULHSU': result_int = Number((BigInt(val1_int) * BigInt(val2_int >>> 0)) >> 32n); break;
            case 'MULHU': result_int = Number((BigInt(val1_int >>> 0) * BigInt(val2_int >>> 0)) >> 32n); break;
            case 'DIV':
                if (val2_int === 0) result_int = UINT32_MAX_AS_SIGNED;
                else if (val1_int === INT32_MIN && val2_int === -1) result_int = INT32_MIN;
                else result_int = (val1_int / val2_int) | 0;
                break;
            case 'DIVU':
                if (val2_int === 0) result_int = UINT32_MAX_AS_SIGNED;
                else result_int = ((val1_int >>> 0) / (val2_int >>> 0)) | 0;
                break;
            case 'REM':
                if (val2_int === 0) result_int = val1_int;
                else if (val1_int === INT32_MIN && val2_int === -1) result_int = 0;
                else result_int = val1_int % val2_int;
                break;
            case 'REMU':
                if (val2_int === 0) result_int = val1_int >>> 0;
                else result_int = (val1_int >>> 0) % (val2_int >>> 0);
                break;
            case 'ADDI': result_int = (val1_int + imm) | 0; break;
            case 'SLTI': result_int = (val1_int < imm) ? 1 : 0; break;
            case 'SLTIU': result_int = ((val1_int >>> 0) < (imm >>> 0)) ? 1 : 0; break;
            case 'XORI': result_int = (val1_int ^ imm) | 0; break;
            case 'ORI': result_int = (val1_int | imm) | 0; break;
            case 'ANDI': result_int = (val1_int & imm) | 0; break;
            case 'SLLI': result_int = (val1_int << imm) | 0; break;
            case 'SRLI': result_int = val1_int >>> imm; break;
            case 'SRAI': result_int = val1_int >> imm; break;
            case 'LB':
                memoryAddress = (val1_int + imm) | 0;
                if (!this.waitingRequest && !this.pendingResponse) {
                    this.readByteAsync(memoryAddress, bus);
                    this._logLoadWait('LB', memoryAddress, rd);
                    return { nextPc: this.pc };
                }
                if (this.pendingResponse) {
                    memoryValue = this.pendingResponse.data;
                    this.waitingRequest = null;
                    this.pendingResponse = null;
                    result_int = (memoryValue & 0x80) ? (memoryValue | 0xFFFFFF00) : (memoryValue & 0xFF);
                    if (rd !== 0) this.registers[rd] = result_int | 0;
                    this._logLoadCommit('LB', rd, result_int, memoryAddress);
                    return {};
                }
                return { nextPc: this.pc };
            case 'LH':
                memoryAddress = (val1_int + imm) | 0;
                if (!this.waitingRequest && !this.pendingResponse) {
                    this.readHalfAsync(memoryAddress, bus);
                    this._logLoadWait('LH', memoryAddress, rd);
                    return { nextPc: this.pc };
                }
                if (this.pendingResponse) {
                    memoryValue = this.pendingResponse.data & 0xFFFF;
                    this.waitingRequest = null;
                    this.pendingResponse = null;
                    result_int = (memoryValue & 0x8000) ? (memoryValue | 0xFFFF0000) : memoryValue;
                    if (rd !== 0) this.registers[rd] = result_int | 0;
                    this._logLoadCommit('LH', rd, result_int, memoryAddress);
                    return {};
                }
                return { nextPc: this.pc };
            case 'LW':
                memoryAddress = (val1_int + imm) | 0;
                if (!this.waitingRequest && !this.pendingResponse) {
                    this.readWordAsync(memoryAddress, bus);
                    this._logLoadWait('LW', memoryAddress, rd);
                    return { nextPc: this.pc };
                }
                if (this.pendingResponse) {
                    result_int = this.pendingResponse.data;
                    this.waitingRequest = null;
                    this.pendingResponse = null;
                    if (rd !== 0) this.registers[rd] = result_int | 0;
                    this._logLoadCommit('LW', rd, result_int, memoryAddress);
                    return {};
                }
                return { nextPc: this.pc };
            case 'LBU':
                memoryAddress = (val1_int + imm) | 0;
                if (!this.waitingRequest && !this.pendingResponse) {
                    this.readByteAsync(memoryAddress, bus);
                    this._logLoadWait('LBU', memoryAddress, rd);
                    return { nextPc: this.pc };
                }
                if (this.pendingResponse) {
                    memoryValue = this.pendingResponse.data & 0xFF;
                    this.waitingRequest = null;
                    this.pendingResponse = null;
                    result_int = memoryValue;
                    if (rd !== 0) this.registers[rd] = result_int | 0;
                    this._logLoadCommit('LBU', rd, result_int, memoryAddress);
                    return {};
                }
                return { nextPc: this.pc };
            case 'LHU':
                memoryAddress = (val1_int + imm) | 0;
                if (!this.waitingRequest && !this.pendingResponse) {
                    this.readHalfAsync(memoryAddress, bus);
                    this._logLoadWait('LHU', memoryAddress, rd);
                    return { nextPc: this.pc };
                }
                if (this.pendingResponse) {
                    memoryValue = this.pendingResponse.data & 0xFFFF;
                    this.waitingRequest = null;
                    this.pendingResponse = null;
                    result_int = memoryValue;
                    if (rd !== 0) this.registers[rd] = result_int | 0;
                    this._logLoadCommit('LHU', rd, result_int, memoryAddress);
                    return {};
                }
                return { nextPc: this.pc };
            case 'SB':
                memoryAddress = (val1_int + imm) | 0;
                if (!this.waitingRequest && !this.pendingResponse) {
                    this.writeByteAsync(memoryAddress, val2_int & 0xFF, bus);
                    return { nextPc: this.pc };
                }
                if (this.pendingResponse) {
                    this.waitingRequest = null;
                    this.pendingResponse = null;
                    console.log(`[CPU] SB response: PC=0x${this.pc.toString(16)}`);
                    return {};
                }
                return { nextPc: this.pc };
            case 'SH':
                memoryAddress = (val1_int + imm) | 0;
                if (!this.waitingRequest && !this.pendingResponse) {
                    this.writeHalfAsync(memoryAddress, val2_int & 0xFFFF, bus);
                    return { nextPc: this.pc };
                }
                if (this.pendingResponse) {
                    this.waitingRequest = null;
                    this.pendingResponse = null;
                    return {};
                }
                return { nextPc: this.pc };
            case 'SW':
                memoryAddress = (val1_int + imm) | 0;
                console.log(`[CPU] SW: Ghi value=0x${val2_int.toString(16)} vao dia chi 0x${memoryAddress.toString(16)}`);
                if (memoryAddress >= 0x100 && memoryAddress < 0x104) {
                    console.warn(`[CANH BAO] SW dang ghi vao vung nguon DMA tai dia chi 0x${memoryAddress.toString(16)}!`);
                }
                if (!this.waitingRequest && !this.pendingResponse) {
                    this.writeWordAsync(memoryAddress, val2_int, bus);
                    return { nextPc: this.pc };
                }
                if (this.pendingResponse) {
                    this.waitingRequest = null;
                    this.pendingResponse = null;
                    console.log(`[CPU] SW response: PC=0x${this.pc.toString(16)}`);
                    return {};
                }
                return { nextPc: this.pc };
            case 'LUI': this.registers[decoded.rd] = decoded.imm << 12; break;
            case 'AUIPC': result_int = (pc + imm) | 0; break;
            case 'JAL': result_int = pc + 4; nextPc = (pc + imm) | 0; break;
            case 'JALR': result_int = pc + 4; nextPc = (val1_int + imm) & ~1; break;
            case 'BEQ': if (val1_int === val2_int) branchTaken = true; break;
            case 'BNE': if (val1_int !== val2_int) branchTaken = true; break;
            case 'BLT': if (val1_int < val2_int) branchTaken = true; break;
            case 'BGE': if (val1_int >= val2_int) branchTaken = true; break;
            case 'BLTU': if ((val1_int >>> 0) < (val2_int >>> 0)) branchTaken = true; break;
            case 'BGEU': if ((val1_int >>> 0) >= (val2_int >>> 0)) branchTaken = true; break;
            case 'ECALL': this.handleSyscall(bus); break;
            case 'EBREAK': this.isRunning = false; throw new Error('EBREAK instruction encountered.');
            case 'FLW':
                memoryAddress = (val1_int + imm) | 0;
                if (!this.waitingRequest && !this.pendingResponse) {
                    this.readWordAsync(memoryAddress, bus);
                    return { nextPc: this.pc };
                }
                if (this.pendingResponse) {
                    const flw_buffer = new ArrayBuffer(4);
                    const flw_view = new DataView(flw_buffer);
                    flw_view.setUint32(0, this.pendingResponse.data >>> 0, true);
                    result_fp = flw_view.getFloat32(0, true);
                    this.waitingRequest = null;
                    this.pendingResponse = null;
                    if (rd !== 0) this.fregisters[rd] = result_fp;
                    return {};
                }
                return { nextPc: this.pc };
            case 'FSW':
                memoryAddress = (val1_int + imm) | 0;
                if (!this.waitingRequest && !this.pendingResponse) {
                    const fsw_buffer = new ArrayBuffer(4);
                    const fsw_view = new DataView(fsw_buffer);
                    fsw_view.setFloat32(0, val2_fp, true);
                    const wordVal = fsw_view.getUint32(0, true);
                    this.writeWordAsync(memoryAddress, wordVal, bus);
                    return { nextPc: this.pc };
                }
                if (this.pendingResponse) {
                    this.waitingRequest = null;
                    this.pendingResponse = null;
                    return {};
                }
                return { nextPc: this.pc };
            case 'FADD.S': result_fp = val1_fp + val2_fp; break;
            case 'FSUB.S': result_fp = val1_fp - val2_fp; break;
            case 'FMUL.S': result_fp = val1_fp * val2_fp; break;
            case 'FDIV.S':
                if (val2_fp === 0.0) {
                    result_fp = (val1_fp > 0.0 ? Infinity : (val1_fp < 0.0 ? -Infinity : NaN));
                } else {
                    result_fp = val1_fp / val2_fp;
                }
                break;
            case 'FMADD.S': result_fp = (val1_fp * val2_fp) + val3_fp; break;
            case 'FMSUB.S': result_fp = (val1_fp * val2_fp) - val3_fp; break;
            case 'FNMSUB.S': result_fp = -(val1_fp * val2_fp) + val3_fp; break;
            case 'FNMADD.S': result_fp = -(val1_fp * val2_fp) - val3_fp; break;
            case 'FSQRT.S': result_fp = val1_fp < 0.0 ? NaN : Math.sqrt(val1_fp); break;
            case 'FMIN.S':
                if (isNaN(val1_fp) && isNaN(val2_fp)) result_fp = NaN;
                else if (isNaN(val1_fp)) result_fp = val2_fp;
                else if (isNaN(val2_fp)) result_fp = val1_fp;
                else result_fp = Math.min(val1_fp, val2_fp);
                break;
            case 'FMAX.S':
                if (isNaN(val1_fp) && isNaN(val2_fp)) result_fp = NaN;
                else if (isNaN(val1_fp)) result_fp = val2_fp;
                else if (isNaN(val2_fp)) result_fp = val1_fp;
                else result_fp = Math.max(val1_fp, val2_fp);
                break;
            case 'FSGNJ.S':
            case 'FSGNJN.S':
            case 'FSGNJX.S':
                const fsgnj_buf = new ArrayBuffer(8);
                const fsgnj_view = new DataView(fsgnj_buf);
                fsgnj_view.setFloat32(0, val1_fp, true);
                fsgnj_view.setFloat32(4, val2_fp, true);
                const bits1 = fsgnj_view.getUint32(0, true);
                const bits2 = fsgnj_view.getUint32(4, true);
                let finalBits = 0;
                if (opName === 'FSGNJ.S') {
                    finalBits = (bits1 & 0x7FFFFFFF) | (bits2 & 0x80000000);
                } else if (opName === 'FSGNJN.S') {
                    finalBits = (bits1 & 0x7FFFFFFF) | ((~bits2) & 0x80000000);
                } else if (opName === 'FSGNJX.S') {
                    finalBits = bits1 ^ (bits2 & 0x80000000);
                }
                fsgnj_view.setUint32(0, finalBits, true);
                result_fp = fsgnj_view.getFloat32(0, true);
                break;
            case 'FCVT.W.S':
                let rounded_w;
                switch (rm) {
                    case 0b000: rounded_w = Math.round(val1_fp); break;
                    case 0b001: rounded_w = Math.trunc(val1_fp); break;
                    default: rounded_w = Math.round(val1_fp);
                }
                if (isNaN(val1_fp) || val1_fp > 2147483647.0) rounded_w = 2147483647;
                else if (val1_fp < -2147483648.0) rounded_w = -2147483648;
                result_int = rounded_w | 0;
                break;
            case 'FCVT.WU.S':
                let rounded_wu;
                switch (rm) {
                    case 0b000: rounded_wu = Math.round(val1_fp); break;
                    case 0b001: rounded_wu = Math.trunc(val1_fp); break;
                    default: rounded_wu = Math.round(val1_fp);
                }
                if (isNaN(val1_fp) || val1_fp > 4294967295.0) rounded_wu = 4294967295;
                else if (val1_fp < 0.0) rounded_wu = 0;
                result_int = rounded_wu >>> 0;
                break;
            case 'FCVT.S.W':
                result_fp = Number(val1_int);
                break;
            case 'FCVT.S.WU':
                result_fp = Number(val1_int >>> 0); // Convert unsigned 32-bit int to float
                break;
            case 'FCLASS.S':
                const fclass_buf = new ArrayBuffer(4);
                const fclass_view = new DataView(fclass_buf);
                fclass_view.setFloat32(0, val1_fp, true);
                const fclass_bits = fclass_view.getUint32(0, true);
                const is_neg = (fclass_bits >>> 31) === 1;
                const exp = (fclass_bits >>> 23) & 0xFF;
                const frac = fclass_bits & 0x7FFFFF;
                if (exp === 0x00 && frac === 0) result_int = is_neg ? (1 << 3) : (1 << 4);
                else if (exp === 0x00 && frac !== 0) result_int = is_neg ? (1 << 2) : (1 << 5);
                else if (exp === 0xFF && frac === 0) result_int = is_neg ? (1 << 0) : (1 << 7);
                else if (exp === 0xFF && frac !== 0) {
                    if ((frac & 0x400000) === 0) result_int = (1 << 8); // sNaN
                    else result_int = (1 << 9); // qNaN
                } else result_int = is_neg ? (1 << 1) : (1 << 6);
                break;
            case 'FEQ.S':
                if (isNaN(val1_fp) || isNaN(val2_fp)) result_int = 0;
                else result_int = (val1_fp === val2_fp) ? 1 : 0;
                break;
            case 'FLT.S':
                if (isNaN(val1_fp) || isNaN(val2_fp)) result_int = 0;
                else result_int = (val1_fp < val2_fp) ? 1 : 0;
                break;
            case 'FLE.S':
                if (isNaN(val1_fp) || isNaN(val2_fp)) result_int = 0;
                else result_int = (val1_fp <= val2_fp) ? 1 : 0;
                break;
            case 'FMV.X.W':
                const fmvxw_buffer = new ArrayBuffer(4);
                const fmvxw_view = new DataView(fmvxw_buffer);
                fmvxw_view.setFloat32(0, val1_fp, true);
                result_int = fmvxw_view.getInt32(0, true);
                break;
            case 'FMV.W.X':
                const fmvwx_buffer = new ArrayBuffer(4);
                const fmvwx_view = new DataView(fmvwx_buffer);
                fmvwx_view.setInt32(0, val1_int, true);
                result_fp = fmvwx_view.getFloat32(0, true);
                break;
            case 'AMOADD.W':
                memoryAddress = val1_int | 0; // rs1 contains address
                if (!this.waitingRequest && !this.pendingResponse) {
                    this.amoAddAsync(memoryAddress, val2_int, bus);
                    this._logAtomicWait('AMOADD.W', memoryAddress, rd, val2_int);
                    return { nextPc: this.pc };
                }
                if (this.pendingResponse) {
                    result_int = this.pendingResponse.data;
                    this.waitingRequest = null;
                    this.pendingResponse = null;
                    if (rd !== 0) this.registers[rd] = result_int | 0;
                    this._logAtomicCommit('AMOADD.W', rd, result_int, memoryAddress, val2_int);
                    return {};
                }
                return { nextPc: this.pc };
            default:
                throw new Error(`Execute: Instruction ${opName} (Type: ${type}) is not implemented in the simulator.`);
        }

        // Determine destination register file
        const writes_to_int = !type.includes('FP') || ['FCLASS.S', 'FEQ.S', 'FLT.S', 'FLE.S', 'FCVT.W.S', 'FCVT.WU.S', 'FMV.X.W'].includes(opName);
        const writes_to_fp = type.includes('FP') && !writes_to_int;

        if (writes_to_int) {
            if (rd !== 0 && result_int !== undefined) {
                this.registers[rd] = result_int | 0;
            }
        }
        if (writes_to_fp) {
            if (result_fp !== undefined) {
                this.fregisters[rd] = result_fp;
            }
        }

        if (type === 'B' && branchTaken) {
            nextPc = (pc + imm) | 0;
        }
        return { nextPc };
    }

    handleSyscall(bus) {
        const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

        const syscallId = this.registers[17];
        const arg0 = this.registers[10];
        const arg1 = this.registers[11];
        const arg2 = this.registers[12];

        switch (syscallId) {
            case 93:
                this.isRunning = false;
                if (isBrowser) {
                    alert(`Program exited with code: ${arg0}`);
                } else {
                    console.log(`\n[Syscall] Program exited with code: ${arg0}`);
                }
                if (this.registers[10] !== undefined) this.registers[10] = arg0;
                break;
            case 1:
                if (isBrowser) {
                    alert(`Print Int: ${arg0}`);
                } else {
                    console.log(`\n[Syscall] Print Int: ${arg0}`);
                }
                break;
            case 4:
                const memForStr = this.getMemBytes(bus);
                let str = '';
                let addr = arg0;
                let charByte;
                while (true) {
                    charByte = memForStr[addr];
                    if (charByte === undefined || charByte === 0) break;
                    str += String.fromCharCode(charByte);
                    addr++;
                    if (str.length > 1000) {
                        str += '... (truncated)';
                        break;
                    }
                }
                if (isBrowser) {
                    alert(`Print String:\n${str}`);
                } else {
                    console.log(`\n[Syscall] Print String: ${str}`);
                }
                break;
            case 64:
                const fd_write = arg0;
                const bufAddr_write = arg1;
                const count_write = arg2;
                if (fd_write === 1) {
                    let outputStr = '';
                    const memForWrite = this.getMemBytes(bus);
                    for (let i = 0; i < count_write; i++) {
                        const byte = memForWrite[bufAddr_write + i];
                        if (byte === undefined) {
                            this.registers[10] = i;
                            return;
                        }
                        outputStr += String.fromCharCode(byte);
                    }
                    if (isBrowser) {
                        alert(`Write to stdout:\n${outputStr}`);
                    } else {
                        console.log(`\n[Syscall] Write to stdout: ${outputStr}`);
                    }
                    this.registers[10] = outputStr.length;
                } else {
                    const errorMsg = `Syscall write: Unsupported file descriptor ${fd_write}`;
                    if (isBrowser) {
                        alert(errorMsg);
                    } else {
                        console.warn(`\n[Syscall] ${errorMsg}`);
                    }
                    this.registers[10] = -1;
                }
                break;
            case 0:
                console.log('[Syscall] ecall with ID 0 (no operation or implicit halt)');
                this.isRunning = false;
                break;
            default:
                const errorMsg = `Unsupported syscall ID: ${syscallId}`;
                console.warn(`\n[Syscall] ${errorMsg}`);
                this.isRunning = false;
        }
    }

    tick(bus = this.lowerPort) {
        bus = this._resolveBus(bus);
        if (this.waitingRequest && !this.pendingResponse) {
            return;
        }

        const shouldReplayInstruction = !!(this.waitingRequest && this.pendingResponse && this.replayInstruction);

        if (!shouldReplayInstruction) {
            // Issue instruction fetch if none in flight and no pending inst
            if (!this.fetchWaiting && !this.fetchPending) {
                this.readInstructionAsync(this.pc, bus);
                return;
            }

            // Wait for instruction fetch
            if (!this.fetchPending) return;
        }

        const oldPc = this.pc;
        const pc = this.pc;
        const inst = shouldReplayInstruction ? this.replayInstruction.data : this.fetchPending.data;
        if (!shouldReplayInstruction) {
            this.fetchPending = null;
        }

        const decoded = this.decode(inst);
        const { nextPc } = this.execute(decoded, bus);

        if (this.waitingRequest) {
            this.replayInstruction = { pc, data: inst };
        } else {
            this.replayInstruction = null;
        }

        if (nextPc !== undefined) {
            this.pc = nextPc;
        } else {
            this.pc += 4;
        }
        if (this.pc !== oldPc) {
            console.log(`[CPU] PC: 0x${oldPc.toString(16)} -> 0x${this.pc.toString(16)}, Executed: ${decoded.opName}`);
        }
    }

    readInstructionAsync(address, bus = this.lowerPort) {
        bus = this._resolveBus(bus);
        this.fetchWaiting = true;
        bus.sendRequest('cpu', { type: 'fetch', address: address | 0 });
    }

    receiveResponse(resp) {
        if (resp.type === 'fetch') { // Legacy support if needed
            this.fetchPending = resp;
            this.fetchWaiting = false;
            this._logFetchReady(resp);
        } else if (this.fetchWaiting && (resp.type === TL_D_Opcode.AccessAckData)) {
            // Assume if fetchWaiting is true, the first incoming Get response is the fetch
            this.fetchPending = resp;
            this.fetchWaiting = false;
            this._logFetchReady(resp);
        } else {
            this.pendingResponse = resp;
        }
    }

    _logFetchReady(resp) {
        console.log(`[CPU] FETCH_READY pc=0x${this.pc.toString(16)} addr=0x${(resp.address >>> 0).toString(16)}`);
    }

    _logLoadWait(opName, address, rd) {
        console.log(`[CPU] LOAD_WAIT op=${opName} pc=0x${this.pc.toString(16)} addr=0x${(address >>> 0).toString(16)} rd=x${rd}`);
    }

    _logLoadCommit(opName, rd, value, address) {
        console.log(`[CPU] LOAD_COMMIT op=${opName} pc=0x${this.pc.toString(16)} rd=x${rd} addr=0x${(address >>> 0).toString(16)} value=${value | 0}`);
    }

    _logAtomicWait(opName, address, rd, operand) {
        console.log(`[CPU] ATOMIC_WAIT op=${opName} pc=0x${this.pc.toString(16)} addr=0x${(address >>> 0).toString(16)} rd=x${rd} operand=${operand | 0}`);
    }

    _logAtomicCommit(opName, rd, oldValue, address, operand) {
        console.log(`[CPU] ATOMIC_COMMIT op=${opName} pc=0x${this.pc.toString(16)} rd=x${rd} addr=0x${(address >>> 0).toString(16)} old_value=${oldValue | 0} operand=${operand | 0}`);
    }

    getMemBytes(bus = this.lowerPort) {
        bus = this._resolveBus(bus);
        if (!bus || typeof bus.memBytes !== 'function') throw new Error('Bus has no attached memory');
        return bus.memBytes();
    }

    readWordAsync(address, bus = this.lowerPort) {
        bus = this._resolveBus(bus);
        this.waitingRequest = { type: TL_A_Opcode.Get, address: address | 0, size: 2 };
        bus.sendRequest('cpu', this.waitingRequest);
    }

    readByteAsync(address, bus = this.lowerPort) {
        bus = this._resolveBus(bus);
        this.waitingRequest = { type: TL_A_Opcode.Get, address: address | 0, size: 0 };
        bus.sendRequest('cpu', this.waitingRequest);
    }

    readHalfAsync(address, bus = this.lowerPort) {
        bus = this._resolveBus(bus);
        this.waitingRequest = { type: TL_A_Opcode.Get, address: address | 0, size: 1 };
        bus.sendRequest('cpu', this.waitingRequest);
    }

    writeWordAsync(address, value, bus = this.lowerPort) {
        bus = this._resolveBus(bus);
        this.waitingRequest = { type: TL_A_Opcode.PutFullData, address: address | 0, value, size: 2 };
        bus.sendRequest('cpu', this.waitingRequest);
    }

    writeByteAsync(address, value, bus = this.lowerPort) {
        bus = this._resolveBus(bus);
        this.waitingRequest = { type: TL_A_Opcode.PutPartialData, address: address | 0, value, size: 0 };
        bus.sendRequest('cpu', this.waitingRequest);
    }

    writeHalfAsync(address, value, bus = this.lowerPort) {
        bus = this._resolveBus(bus);
        this.waitingRequest = { type: TL_A_Opcode.PutPartialData, address: address | 0, value, size: 1 };
        bus.sendRequest('cpu', this.waitingRequest);
    }

    amoAddAsync(address, value, bus = this.lowerPort) {
        bus = this._resolveBus(bus);
        this.waitingRequest = {
            type: TL_A_Opcode.ArithmeticData,
            param: TL_Param_Arithmetic.ADD,
            address: address | 0,
            value: value,
            size: 2 // 32-bit word
        };
        bus.sendRequest('cpu', this.waitingRequest);
    }
}


