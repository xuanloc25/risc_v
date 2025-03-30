import { assembler } from './js/assembler.js';

function assembleAndShow() {
    console.log("assembleAndShow called!");
    const instructionInput = document.getElementById('instructionInput').value;
    const binaryOutput = document.getElementById('binaryOutput');
    const memoryOutput = document.getElementById('memoryOutput');

    try {
        const assembledCode = assembler.assemble(instructionInput);
        binaryOutput.textContent = assembledCode.join('\n');

         // Hiển thị bộ nhớ (dạng hex)
        let memoryString = "";
        for (const address in assembler.memory) {
            const hexValue = assembler.memory[address].toString(16).padStart(2, '0');
            memoryString += `${address.toString(16).padStart(8, '0')}: ${hexValue}\n`;
        }
        memoryOutput.textContent = memoryString;

    } catch (error) {
        binaryOutput.textContent = `Error: ${error.message}`;
        memoryOutput.textContent = ""; // Xóa nội dung bộ nhớ khi có lỗi
    }
}

document.getElementById('assembleButton').addEventListener('click', assembleAndShow);
