// assembler.js

export const assembler = {
    memory: {},        // Bộ nhớ ảo (virtual memory)
    labels: {},        // Bảng chứa các nhãn (labels) và giá trị, kiểm tra global
    currentSection: null, // Section hiện tại (.data hoặc .text)
    currentAddress: 0,   // Địa chỉ bộ nhớ hiện tại (tính bằng byte)
    instructions: [],     // Mảng chứa các lệnh đã được phân tích và kiểm tra
    binary: [],       //chứa mã nhị phân

    directives: { //tất cả các directives
       ".data": {
            minArgs: 0, maxArgs: 1,
            handler: handleDataDirective
        },
        ".text": {
            minArgs: 0, maxArgs: 1,
            handler: handleTextDirective
        },
        ".word": {
            minArgs: 1, maxArgs: Infinity,
            handler: handleWordDirective
        },
        ".half": { //thêm
            minArgs: 1, maxArgs: Infinity,
            handler: handleHalfDirective
        },
        ".byte": { //thêm
            minArgs: 1, maxArgs: Infinity,
            handler: handleByteDirective
        },
        ".ascii": { //thêm
            minArgs: 1, maxArgs: 1,
            handler: handleAsciiDirective
        },
        ".asciiz": {
            minArgs: 1, maxArgs: 1,
            handler: handleAsciizDirective
        },
        ".space": {
            minArgs: 1, maxArgs: 1,
            handler: handleSpaceDirective
        },
        ".align": {
            minArgs: 1, maxArgs: 1,
            handler: handleAlignDirective
        },
        ".global": {  // Hoặc .globl
            minArgs: 1, maxArgs: 1, // Tối đa 1 tham số (tên nhãn)
            handler: handleGlobalDirective
        },
        ".extern": {
            minArgs: 2, maxArgs: 2,
            handler: handleExternDirective
        },
        ".equ": { //thêm
            minArgs: 2,
            maxArgs: 2,
            handler: handleEquDirective
        },
    },

    instructionFormats: { //thêm các lệnh
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
        "LW":   { type: "I", opcode: "0000011", funct3: "010" },
        "ADDI": { type: "I", opcode: "0010011", funct3: "000" },
         "JALR": { type: "I", opcode: "1100111", funct3: "000"      },
         "LB": {type: "I", opcode: "0000011", funct3: "000"},
          "LH": {type: "I", opcode: "0000011", funct3: "001"},
          "LBU": { type: "I", opcode: "0000011", funct3: "100" },
          "LHU": { type: "I", opcode: "0000011", funct3: "101" },
          "SLTI": { type: "I", opcode: "0010011", funct3: "010" },
          "SLTIU": {type: "I", opcode: "0010011", funct3: "011"},
          "XORI": {type: "I", opcode: "0010011", funct3: "100"},
          "ORI": { type: "I", opcode: "0010011", funct3: "110" },
          "ANDI": { type: "I", opcode: "0010011", funct3: "111" },
          //S-type
        "SB": {type: "S", opcode: "0100011", funct3: "000"},
        "SH": {type: "S", opcode: "0100011", funct3: "001"},
        "SW": {type: "S", opcode: "0100011", funct3: "010"},
        //U-type
        "LUI": {type: "U", opcode: "0110111"},
        "AUIPC": {type: "U", opcode: "0010111"},
        //B-type
        "BEQ":  {type: "B", opcode: "1100011",funct3: "000"},
        "BNE":  {type: "B", opcode: "1100011",funct3: "001"},
        "BLT":  {type: "B", opcode: "1100011",funct3: "100"},
        "BGE":  {type: "B", opcode: "1100011",funct3: "101"},
        "BLTU": {type: "B", opcode: "1100011",funct3: "110"},
        "BGEU": {type: "B", opcode: "1100011",funct3: "111"},
        //J-type
        "JAL": {type: "J", opcode: "1101111"},
    },

    assemble(assemblyCode) {
      // Reset các biến
      this.memory = {};
      this.labels = {};
      this.currentSection = null;
      this.currentAddress = 0;
      this.instructions = [];
      this.binary = [];

        const lines = assemblyCode.split("\n");
        for (const line of lines) {
            try {
                const parsedLine = this.parseLine(line);
                if (parsedLine) {
                   this.instructions.push(parsedLine);
                }
            } catch (error) {
                console.error("Error assembling line:", line, error);
                throw error;  //ném lỗi
            }
        }
      //chuyển lệnh đã phân tích cú pháp thành mã nhị phân
        for (const instr of this.instructions) {
            if (instr.type === "instruction") {
                const mc = this.riscvToBinary(instr.line);
                if (mc) {
                    this.binary.push(mc);
                }
            }
        }
        return this.binary; // Return binary code
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
            const parts = line.split(/\s+/); //tách chuỗi bằng khoảng trắng
            const directive = parts[0].toLowerCase(); //chuyển tất cả thành chữ thường
            const args = parts.slice(1);

            if (this.directives[directive]) {
                const { minArgs, maxArgs, handler } = this.directives[directive];

                if (args.length < minArgs || args.length > maxArgs) {
                    throw new Error(`Invalid number of arguments for directive ${directive}. Expected ${minArgs}-${maxArgs}, got ${args.length}`);
                }

                handler.call(this, args);  // Gọi hàm xử lý, bind 'this' đến assembler
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
            this.labels[label] = {address: this.currentAddress, isGlobal: false};  // Lưu địa chỉ và global = false
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
      const parts = instruction.trim().toUpperCase().split(/[ ,]+/);
        const opcode = parts[0];

        if (!this.instructionFormats[opcode]) {
            throw new Error(`Invalid opcode: ${opcode}`);
        }

        const formatInfo = this.instructionFormats[opcode];
        const { type, opcode: binOpcode, funct3, funct7 } = formatInfo;

        let binaryInstruction = "";
        let rd, rs1, rs2, imm, rdEncoded, rs1Encoded, rs2Encoded, immEncoded;

      function encodeRegister(register) {
          const regNumber = parseInt(register.slice(1)); // Loại bỏ 'X' và chuyển thành số
          if (isNaN(regNumber) || regNumber < 0 || regNumber > 31) {
              throw new Error(`Invalid register: ${register}`);
          }
          return regNumber.toString(2).padStart(5, '0'); // Chuyển thành nhị phân 5-bit
      }

      function encodeImmediate(immediate, format) {
            let imm = parseInt(immediate, 10);

            if (isNaN(imm)) { //kiểm tra xem có phải số không, nếu không phải thì kiểm tra label
              if(assembler.labels[immediate]){
                imm = assembler.labels[immediate].address;
              }
              else throw new Error(`Invalid immediate value or label : ${immediate}`);
            }

            let maxBits;
            switch (format) {
                case "I": maxBits = 12; break;
                case "S": maxBits = 12; break;
                case "B": maxBits = 13; break;
                case "U": maxBits = 20; break;
                case "J": maxBits = 21; break;
                default: throw new Error(`Unsupported format for immediate encoding: ${format}`);
            }

            const limit = Math.pow(2, maxBits - 1);
            if (imm < -limit || imm >= limit) {
                throw new Error(`Immediate value ${imm} out of range for ${format}-type`);
            }

            if (imm < 0) {
                imm = (1 << maxBits) + imm; // 2^n + imm (two's complement)
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

                case "S":
                    rs2 = parts[1]
                    rs1 = parts[2]
                    imm = parts[3]

                    rs2Encoded = encodeRegister(rs2);
                    rs1Encoded = encodeRegister(rs1);
                    immEncoded = encodeImmediate(imm, type);

                    binaryInstruction = `${immEncoded.slice(0, 7)}${rs2Encoded}${rs1Encoded}${funct3}${immEncoded.slice(7)}${binOpcode}`;
                    break;
                case "U":
                    rd = parts[1];
                    imm = parts[2];

                    rdEncoded = encodeRegister(rd);
                    immEncoded = encodeImmediate(imm, type);
                    binaryInstruction = `${immEncoded}${rdEncoded}${binOpcode}`;
                    break;
                case "B":
                    rs1 = parts[1];
                    rs2 = parts[2];
                    imm = parts[3] //label

                    rs1Encoded = encodeRegister(rs1);
                    rs2Encoded = encodeRegister(rs2);

                    //xử lý nhãn
                    if(isNaN(parseInt(imm))){ //nếu không phải là số => label
                      let labelAddress = this.labels[imm];
                      if(labelAddress === undefined){
                        throw new Error(`Undefined label: ${imm}`);
                      }
                    //tính offset, trừ đi địa chỉ lệnh hiện tại
                      imm = labelAddress.address - this.currentAddress; //địa chỉ label - địa chỉ lệnh hiện tại
                    }

                    immEncoded = encodeImmediate(imm, type);
                    binaryInstruction = `${immEncoded.slice(0,1)}${immEncoded.slice(2,8)}${rs2Encoded}${rs1Encoded}${funct3}${immEncoded.slice(8,12)}${immEncoded.slice(1,2)}${binOpcode}`;
                    break;
                case "J":
                  rd = parts[1];
                  imm = parts[2];

                  rdEncoded = encodeRegister(rd);

                  // Handle labels for J-type
                  if (isNaN(parseInt(imm))) {
                      let labelAddress = this.labels[imm];
                       if(labelAddress === undefined){
                        throw new Error(`Undefined label: ${imm}`);
                      }
                      imm = labelAddress.address - this.currentAddress; // Relative address
                  }

                  immEncoded = encodeImmediate(imm, type);
                  binaryInstruction = `${immEncoded.slice(0, 1)}${immEncoded.slice(10, 20)}${immEncoded.slice(9, 10)}${immEncoded.slice(1, 10)}${rdEncoded}${binOpcode}`;
                  break;

                default:
                    throw new Error(`Unsupported instruction type: ${type}`);
            }
        } catch (error) {
            console.error(error.message);
            return `Error: ${error.message}`;  // Return error message
        }

        binaryInstruction = binaryInstruction.replace(/ /g, '');
        return binaryInstruction;
    },
};

// Các hàm xử lý chỉ thị
function handleDataDirective(args) {
  if (args.length === 1) { // .data address
      this.currentAddress = parseInt(args[0]);
  }
  this.currentSection = "data";
}

function handleTextDirective(args) {
    if (args.length === 1) { // .text address
        this.currentAddress = parseInt(args[0]);
    }
    this.currentSection = "text";
}

function handleWordDirective(args) {
  if (this.currentSection !== "data") {
    throw new Error(".word directive can only be used in .data section");
  }

  for (const arg of args) {
      let value; // Sử dụng let thay vì const

      if (isNaN(parseInt(arg))) { // Nếu không phải là số -> là label hoặc symbol
          if (this.labels[arg]) { // Kiểm tra xem label/symbol đã tồn tại belum
              value = this.labels[arg].address || this.labels[arg]; // Lấy giá trị, ưu tiên địa chỉ nếu có
          } else {
              throw new Error(`Undefined label or symbol: ${arg}`);
          }
      } else {
          value = parseInt(arg); // Chuyển đổi thành số nguyên
      }

      // Chuyển số thành 4 byte (little-endian) và lưu vào bộ nhớ
      const byte1 = value & 0xFF;
      const byte2 = (value >> 8) & 0xFF;
      const byte3 = (value >> 16) & 0xFF;
      const byte4 = (value >> 24) & 0xFF;

      this.memory[this.currentAddress++] = byte1;
      this.memory[this.currentAddress++] = byte2;
      this.memory[this.currentAddress++] = byte3;
      this.memory[this.currentAddress++] = byte4;
  }
}

function handleHalfDirective(args) {
  if (this.currentSection !== "data") {
    throw new Error(".half directive can only be used in .data section");
  }

    for (const arg of args) {
      let num = parseInt(arg);
        if (isNaN(num)) {
            // Xử lý trường hợp tham số là nhãn (label)
            if (this.labels[arg]) {
                num = this.labels[arg].address; //gán địa chỉ của label
            } else {
                throw new Error(`Undefined label: ${arg}`);
            }
        }

        // Chia số nguyên 16-bit thành 2 byte (little-endian)
        const byte1 = num & 0xFF;
        const byte2 = (num >> 8) & 0xFF;

        // Lưu vào bộ nhớ
        this.memory[this.currentAddress++] = byte1;
        this.memory[this.currentAddress++] = byte2;
    }
}

function handleByteDirective(args) {
    if (this.currentSection !== "data") {
        throw new Error(".byte directive can only be used in .data section");
    }

    for (const arg of args) {
      let num = parseInt(arg);
        if (isNaN(num)) {
          if (this.labels[arg]) {
                num = this.labels[arg].address;
            } else {
                throw new Error(`Undefined label: ${arg}`);
            }
        }

        if (num < -128 || num > 255) {
            throw new Error(`Byte value out of range: ${arg}`);
        }

        // Đảm bảo giá trị nằm trong phạm vi 8-bit
        const byte = num & 0xFF;

        // Lưu vào bộ nhớ
        this.memory[this.currentAddress++] = byte;
    }
}
function handleAsciiDirective(args) {
    if (this.currentSection !== "data") {
    throw new Error(".ascii directive can only be used in .data section");
  }
  const str = args[0].slice(1, -1); //xóa dấu nháy

    // Thêm các ký tự của chuỗi vào bộ nhớ
    for (let i = 0; i < str.length; i++) {
        this.memory[this.currentAddress++] = str.charCodeAt(i); //lấy giá trị của kí tự
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
    const label = args[0];
      let value = parseInt(args[1]);
     if (isNaN(value)) {
        if (this.labels[args[1]]) { //kiểm tra xem có phải label không
          value = this.labels[args[1]].address; //gán bằng địa chỉ của label đó
        }
        else
          throw new Error(`Undefined label: ${args[1]}`);
      }
      if (this.labels[label]) { //kiểm tra xem label đã tồn tại chưa
        throw new Error(`Duplicate label definition: ${label}`);
      }
      this.labels[label] = value; //gán giá trị cho label
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
