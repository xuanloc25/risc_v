// web/assembler/js/run_my_sim.js
// Kịch bản này dùng để chạy trình mô phỏng ở chế độ dòng lệnh (Node.js)
// và in ra trạng thái hệ thống để kịch bản Python có thể so sánh.

import fs from 'fs';
import path from 'path';
import { assembler } from './assembler.js';
import { simulator } from './simulator.js';

/**
 * In ra trạng thái hiện tại của simulator theo một định dạng chuẩn, có cấu trúc.
 * @param {object} sim - Đối tượng simulator.
 * @param {Map<number, object>} sourceMap - Map từ địa chỉ lệnh sang thông tin dòng code gốc.
 * @param {number} step - Số thứ tự của bước thực thi.
 */
function printState(sim, sourceMap, step) {
    const pc = sim.cpu.pc;
    const sourceInfo = sourceMap.get(pc);
    const sourceLine = sourceInfo ? `${sourceInfo.lineNumber}: ${sourceInfo.original.trim()}` : '(unknown source)';
    
    console.log(`--- STEP ${step} ---`);
    console.log(`PC: 0x${pc.toString(16).padStart(8, '0')}`);
    console.log(`SOURCE: ${sourceLine}`);
    console.log("REGS:");

    // ✅ Sửa lỗi x{i} thành x${i}
    for (let i = 0; i < 32; i++) {
        const reg_val_hex = `0x${(sim.cpu.registers[i] >>> 0).toString(16).padStart(8, '0')}`;
        console.log(`x${i} ${reg_val_hex}`);
    }
}

// Hàm chính, được thực thi khi chạy file bằng Node.js
function main() {
    const args = process.argv;
    if (args.length < 3) {
        console.error("Cách dùng: node js/run_my_sim.js <path_to_assembly_file>");
        process.exit(1);
    }

    const filePath = path.resolve(args[2]);
    if (!fs.existsSync(filePath)) {
        console.error(`Không tìm thấy file: ${filePath}`);
        process.exit(1);
    }

    try {
        const assemblyCode = fs.readFileSync(filePath, 'utf-8');
        const programData = assembler.assemble(assemblyCode);
        simulator.loadProgram(programData);

        // Tạo map từ địa chỉ lệnh tới thông tin dòng code gốc để tra cứu
        const sourceLineMap = new Map();
        assembler.instructionLines.forEach(line => {
            if (line.type === 'instruction' || line.type === 'pseudo-instruction') {
                sourceLineMap.set(line.address, line);
            }
        });

        // ✅ Chạy bằng vòng lặp while với giới hạn lớn hơn và điều kiện dừng an toàn
        let step = 0;
        const MAX_STEPS = 20000; // Giới hạn số bước để tránh treo máy
        
        // In trạng thái ban đầu (trước khi chạy lệnh đầu tiên)
        printState(simulator, sourceLineMap, step);

        while (simulator.cpu.isRunning && step < MAX_STEPS) {
            step++;
            simulator.tick();
            printState(simulator, sourceLineMap, step);
            
            // Heuristic để dừng các test case có vòng lặp vô tận ở cuối
            if (step > 1 && simulator.cpu.pc === simulator.cpu.oldPc) {
                 if (sourceLineMap.has(simulator.cpu.pc) && sourceLineMap.get(simulator.cpu.pc).mnemonic === 'jal') {
                    break;
                 }
            }
        }

    } catch (error) {
        console.error("Lỗi khi mô phỏng:", error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();