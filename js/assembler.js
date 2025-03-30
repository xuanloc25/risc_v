// assembler.js
export const assembler = {
  memory: {},        // Bộ nhớ ảo (virtual memory)
  labels: {},        // Bảng chứa các nhãn (labels)
  currentSection: null, // Section hiện tại (.data hoặc .text)
  currentAddress: 0,   // Địa chỉ bộ nhớ hiện tại (tính bằng byte)
  instructions: [],     // Mảng chứa các lệnh đã được biên dịch
  binary : [], //chứa các lệnh đã được chuyển sang nhị phân
  directives: {       // Đối tượng chứa thông tin về các chỉ thị
    ".data": {
      minArgs: 0,
      maxArgs: 0,
      handler: handleDataDirective,
    },
    ".text": {
      minArgs: 0,
      maxArgs: 0,
      handler: handleTextDirective,
    },
    ".word": {
      minArgs: 1,
      maxArgs: Infinity, // Không giới hạn số lượng tham số
      handler: handleWordDirective,
    },
    ".asciiz": {
      minArgs: 1,
      maxArgs: 1,
      handler: handleAsciizDirective,
    },
    ".space": {
       minArgs: 1,
       maxArgs: 1,
       handler: handleSpaceDirective
    },
      ".global": {
          minArgs: 1,
          maxArgs: 1,
          handler: handleGlobalDirective,
      },
    ".equ": {
          minArgs: 2,
          maxArgs: 2,
          handler: handleEquDirective,
    },
    ".align": {
        minArgs: 1,
        maxArgs: 1,
        handler: handleAlignDirective
    }
  },
    instructionFormats : {
        "ADD":  { type: "R", opcode: "0110011", funct3: "000", funct7: "0000000" },
        "SUB":  { type: "R", opcode: "0110011", funct3: "000", funct7: "0100000" },
        "SLL":  { type: "R", opcode: "0110011", funct3: "001", funct7: "0000000" },
        "SLT":  { type: "R", opcode: "0110011", funct3: "010", funct7: "0000000" },
        "SLTU": { type: "R", opcode: "0110011", funct3: "011", funct7: "0000000" },
        "XOR":  { type: "R", opcode: "0110011", funct3: "100", funct7: "0000000" },
        "SRL":  { type: "R", opcode: "0110011", funct3: "101", funct7: "0000000" },
        "SRA":  { type: "R", opcode: "0110011", funct3: "101", funct7: "0100000" },
        "OR":   { type: "R", opcode: "0110011", funct3: "110", funct7: "0000000" },
        "AND":  { type: "R", opcode: "0110011", funct3: "111", funct7: "0000000" },
        "LW":   { type: "I", opcode: "0000011", funct3: "010"                  },
        "ADDI": { type: "I", opcode: "0010011", funct3: "000"                  },
        "JALR": { type: "I", opcode: "1100111", funct3: "000"      }
    },

  assemble(assemblyCode) {
      const lines = assemblyCode.split("\n");
      this.currentSection = null;
      this.currentAddress = 0;
      this.instructions = [];
      this.labels = {};
      this.memory = {};
      this.binary = [];
      for (const line of lines) {
          try {
              const parsedLine = this.parseLine(line);
              if (parsedLine) {
                  this.instructions.push(parsedLine); // Lưu các lệnh và chỉ thị đã phân tích
              }
          } catch (error) {
              console.error("Error assembling line:", line, error);
              throw error; // Re-throw để hiển thị lỗi ở giao diện
          }
      }

      console.log("Instructions:", this.instructions);
    //chuyển sang mã nhị phân tại đây
    for(const instr of this.instructions){
        if(instr.type === "instruction"){
          console.log("chuyển sang nhị phân" + instr.line)
          let mc = this.riscvToBinary(instr.line);
            if(mc){
              this.binary.push(mc)
            }
        }
    }

    console.log("Memory:", this.memory);
    console.log("Labels:", this.labels);
     console.log("Binary:", this.binary);
    return this.binary;
  },

  parseLine(line) {
      line = line.trim();
      if (!line) return null;

      const commentIndex = line.indexOf("#");
      if (commentIndex !== -1) {
          line = line.substring(0, commentIndex).trim();
      }
      if (!line) return null;

    if (line.startsWith(".")) {
      // Xử lý chỉ thị
      const parts = line.split(/\s+/);
      const directive = parts[0].toLowerCase();
      const args = parts.slice(1);

      if (this.directives[directive]) {
        const { minArgs, maxArgs, handler } = this.directives[directive];

        if (args.length < minArgs || args.length > maxArgs) {
          throw new Error(`Invalid number of arguments for directive ${directive}. Expected ${minArgs}-${maxArgs}, got ${args.length}`);
        }

        handler.call(this, args);  // Gọi hàm xử lý, bind 'this'
        return { type: "directive", line };
      } else {
        throw new Error(`Unknown directive: ${directive}`);
      }
    } else if (line.endsWith(":")) {
        // Xử lý nhãn
        const label = line.slice(0, -1).trim();
        if (this.labels[label]) {
          throw new Error(`Duplicate label definition: ${label}`);
        }
        this.labels[label] = this.currentAddress;  // Lưu địa chỉ của nhãn
        return { type: "label", line };

    } else {
        // Xử lý lệnh hợp ngữ
        if (this.currentSection === "text") {
           return { type: "instruction", line };
        }
      else {
        return null //bỏ qua lệnh nếu không ở trong section text
      }

    }
  },

  riscvToBinary(instruction) {
  //  instruction = normalizeRegisterNames(instruction); // Đã bỏ normalize ở đây
    const parts = instruction.trim().toUpperCase().split(/[ ,]+/);
    const opcode = parts[0];

    if (!this.instructionFormats[opcode]) {
        throw new Error(`Invalid opcode: ${opcode}`);
    }

    const formatInfo = this.instructionFormats[opcode];
    const { type, opcode: binOpcode, funct3, funct7 } = formatInfo;


    let binaryInstruction = "";
    let rd, rs1, rs2, imm, rdEncoded, rs1Encoded, rs2Encoded, immEncoded;

    //hàm chuyển từ thanh ghi x0, x1, x2, ... thành số nhị phân 00000, 00001, 00010
     function encodeRegister(register) {
        const regNumber = parseInt(register.slice(1)); // Loại bỏ 'X' và chuyển thành số
        if (isNaN(regNumber) || regNumber < 0 || regNumber > 31) {
          throw new Error(`Invalid register: ${register}`);
        }
        return regNumber.toString(2).padStart(5, '0'); // Chuyển thành nhị phân 5-bit
      }
     function encodeImmediate(immediate, format) {
        let imm = parseInt(immediate, 10);

        // Kiểm tra và xử lý số âm
        if (isNaN(imm)) {
            throw new Error(`Invalid immediate value: ${immediate}`);
        }

        // Xử lý số âm trong biểu diễn two's complement
        let maxBits; // Số bits tối đa cho giá trị immediate
        switch (format) {
            case "I": maxBits = 12; break;
            case "S": maxBits = 12; break;
            case "B": maxBits = 13; break; // Giá trị tức thời 12-bit + 1 bit dấu
            case "U": maxBits = 20; break;
            case "J": maxBits = 21; break; // Giá trị tức thời 20-bit + 1 bit dấu
            default: throw new Error(`Unsupported format for immediate encoding: ${format}`);
        }
        
        //giới hạn số bit
        const limit = Math.pow(2, maxBits -1)
        if(imm < -limit || imm >= limit){
          throw new Error(`Immediate value ${imm} out of range for ${format}-type`);
        }
      

        if (imm < 0) {
            // Chuyển đổi số âm sang two's complement
            imm = (1 << maxBits) + imm; //  2^n + imm
        }

        return imm.toString(2).padStart(maxBits, '0');
    }
    try {
      switch (type) {
        case "R":
           rd = parts[1];
           rs1 = parts[2];
           rs2 = parts[3];
           rdEncoded = encodeRegister(rd);
           rs1Encoded = encodeRegister(rs1);
           rs2Encoded = encodeRegister(rs2);
          binaryInstruction = `${funct7}${rs2Encoded}${rs1Encoded}${funct3}${rdEncoded}${binOpcode}`;
          break;
        case "I":
          rd = parts[1];
          rs1 = parts[2];
          imm = parts[3];

          rdEncoded = encodeRegister(rd);
          rs1Encoded = encodeRegister(rs1);
          immEncoded = encodeImmediate(imm, type);
          binaryInstruction = `${immEncoded}${rs1Encoded}${funct3}${rdEncoded}${binOpcode}`;
          break;
        // Thêm case khác
        default:
          throw new Error(`Unsupported instruction type: ${type}`);
      }
    } catch (error) {
      console.error(error.message);
      return null; // Hoặc ném lỗi
    }
    return binaryInstruction;
  }
};

// Các hàm xử lý chỉ thị
function handleDataDirective() {
    this.currentSection = "data";
     this.currentAddress = 0;
}

function handleTextDirective() {
    this.currentSection = "text";
    this.currentAddress = 0x400000;  // Địa chỉ bắt đầu của .text (ví dụ)
}
function handleWordDirective(args) {
     if (this.currentSection !== "data") {
        throw new Error(".word directive can only be used in .data section");
    }
    for (const arg of args) {
      let num = parseInt(arg)
      if (isNaN(num)) {
          num = this.labels[arg]; // Xử lý nhãn
            if (num === undefined) {
                throw new Error(`Invalid number or label in .word: ${arg}`);
            }
      }
      //tách số nguyên 32 bit thành các byte và lưu chúng vào bộ nhớ
        const byte1 = num & 0xFF; //lấy 8 bit thấp
        const byte2 = (num >> 8) & 0xFF;//dịch 8 bit, lấy 8 bit thấp
        const byte3 = (num >> 16) & 0xFF;//...
        const byte4 = (num >> 24) & 0xFF;

        // Lưu vào bộ nhớ (little-endian)
        this.memory[this.currentAddress++] = byte1;
        this.memory[this.currentAddress++] = byte2;
        this.memory[this.currentAddress++] = byte3;
        this.memory[this.currentAddress++] = byte4;
    }
}

function handleAsciizDirective(args) {
    if (this.currentSection !== "data") {
    throw new Error(".asciiz directive can only be used in .data section");
  }
  const str = args[0].slice(1, -1); //xóa dấu nháy

    // Thêm các ký tự của chuỗi vào bộ nhớ
    for (let i = 0; i < str.length; i++) {
        this.memory[this.currentAddress++] = str.charCodeAt(i); //lấy giá trị của kí tự
    }

    // Thêm ký tự null kết thúc chuỗi
    this.memory[this.currentAddress++] = 0;
}

function handleSpaceDirective(args) {
    if (this.currentSection !== "data") {
        throw new Error(".space directive can only be used in .data section");
    }
      const bytes = parseInt(args[0]);
        if (isNaN(bytes)) {
            throw new Error(`Invalid number of bytes in .space: ${args[0]}`);
        }

    this.currentAddress += bytes; //tăng biến đếm địa chỉ
}

function handleGlobalDirective(args) {
    const label = args[0];
    // Đánh dấu label là global (có thể lưu trong một thuộc tính của đối tượng labels)
    // Ví dụ:
    if(this.labels[label] !== undefined) {
      this.labels[label].isGlobal = true; // Bạn cần tự thêm thuộc tính isGlobal
    } else {
      this.labels[label] = {address: null, isGlobal: true};  // Định nghĩa trước, chưa có địa chỉ
    }

}

function handleEquDirective(args) {
    //ví dụ .equ    PI, 314159
    const label = args[0];
    const value = parseInt(args[1]);

    if (isNaN(value)) {
        throw new Error(`Invalid value for .equ: ${args[1]}`);
    }

    if (this.labels[label]) {
        throw new Error(`Duplicate label definition: ${label}`);
    }
     this.labels[label] = value;
}

function handleAlignDirective(args) {
   if (this.currentSection !== "data") {
    throw new Error(".align directive can only be used in .data section");
    }
    const n = parseInt(args[0]);
      if (isNaN(n) || n < 0) {
        throw new Error(`Invalid alignment value: ${args[0]}`);
    }
    const align = 2**n;
    let remainder = this.currentAddress % align;
    if(remainder != 0){
      this.currentAddress += align - remainder;
    }
}
