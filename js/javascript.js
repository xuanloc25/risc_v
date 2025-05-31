// javascript.js (Cập nhật cho bảng thanh ghi 2 cột)

import { assembler } from './assembler.js';
import { simulator } from './simulator.js';

// --- DOM Elements ---
const instructionInput = document.getElementById('instructionInput');
const binaryOutput = document.getElementById('binaryOutput');
const registerTableBody = document.getElementById('registerTable')?.querySelector('tbody');
const assembleButton = document.getElementById('assembleButton');
const runButton = document.getElementById('runButton');
const stepButton = document.getElementById('stepButton');
const resetButton = document.getElementById('resetButton');

// --- DOM Elements cho Data Segment ---
const dataSegmentAddressInput = document.getElementById('dataSegmentAddressInput');
const goToDataSegmentAddressButton = document.getElementById('goToDataSegmentAddress');
const toggleDataSegmentModeButton = document.getElementById('toggleDataSegmentMode');
const dataSegmentBody = document.getElementById('dataSegmentBody');

// --- Trạng thái cho Data Segment View ---
let dataSegmentStartAddress = 0x10010000; 
let dataSegmentDisplayMode = 'hex'; 
const dataSegmentRows = 8;          
const bytesPerRow = 32;       
const wordsPerRow = 8;          

// --- Register Table Init ---
const abiNames = [
    'zero', 'ra', 'sp', 'gp', 'tp', 't0', 't1', 't2',
    's0/fp', 's1', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5',
    'a6', 'a7', 's2', 's3', 's4', 's5', 's6', 's7',
    's8', 's9', 's10', 's11', 't3', 't4', 't5', 't6'
];

function initializeRegisterTable() {
    if (!registerTableBody) {
        console.error("Register table body ('tbody') not found!");
        return;
    }
    registerTableBody.innerHTML = ''; // Xóa nội dung cũ

    // Tạo 32 hàng cho các thanh ghi x0-x31
    for (let i = 0; i < 32; i++) {
        const row = registerTableBody.insertRow();
        row.id = `reg-${i}`;
        row.insertCell().textContent = `x${i} (${abiNames[i]})`; // Cột 0: Tên Register/ABI
        row.insertCell().textContent = '0x00000000';          // Cột 1: Giá trị Hex
        // Đã xóa cột Decimal và Binary
    }
    // Tạo hàng riêng cho PC
    const pcRow = registerTableBody.insertRow();
    pcRow.id = 'reg-pc';
    pcRow.insertCell().textContent = 'PC';                     // Cột 0: Tên PC
    pcRow.insertCell().textContent = '0x00000000';           // Cột 1: Giá trị Hex
    // Đã xóa cột Decimal và Binary cho PC
}

// --- Hàm render bảng Data Segment (không đổi) ---
function renderDataSegmentTable() {
    if (!dataSegmentBody || !simulator) {
        if (dataSegmentBody) dataSegmentBody.innerHTML = '<tr><td colspan="9">Simulator not ready or no data loaded.</td></tr>';
        return;
    }
    dataSegmentBody.innerHTML = ''; 

    for (let i = 0; i < dataSegmentRows; i++) {
        const rowBaseAddress = Math.max(0, dataSegmentStartAddress + i * bytesPerRow);
        const row = dataSegmentBody.insertRow();
        const addrCell = row.insertCell();
        addrCell.textContent = `0x${rowBaseAddress.toString(16).padStart(8, '0')}`;

        for (let j = 0; j < wordsPerRow; j++) {
            const wordStartAddress = rowBaseAddress + j * 4;
            let displayValue = '';
            let wordValue = 0;
            let bytes = [];
            let allBytesNull = true; 

            for (let k = 0; k < 4; k++) {
                const byteAddr = wordStartAddress + k;
                const byte = simulator.memory[byteAddr] ?? null; 
                bytes.push(byte);
                if (byte !== null) {
                    allBytesNull = false; 
                    wordValue |= (byte << (k * 8)); 
                }
            }

            if (dataSegmentDisplayMode === 'hex') {
                if (allBytesNull) {
                    displayValue = '........'; 
                } else {
                    displayValue = `0x${(wordValue >>> 0).toString(16).padStart(8, '0')}`;
                }
            } else { // 'ascii' mode
                displayValue = '';
                for (const byte of bytes) {
                    if (byte !== null && byte >= 32 && byte <= 126) { 
                        displayValue += String.fromCharCode(byte);
                    } else {
                        displayValue += '.'; 
                    }
                }
            }
            row.insertCell().textContent = displayValue;
        }
    }
}


// --- Hàm cập nhật giao diện chính ---
function updateUIGlobally() {
    if (!registerTableBody) return;

    const currentSimulator = simulator;

    // Cập nhật bảng thanh ghi x0-x31
    for (let i = 0; i < 32; i++) {
        const row = document.getElementById(`reg-${i}`);
        if (row && row.cells.length >= 2) { // Chỉ cần kiểm tra có ít nhất 2 ô
            const value = currentSimulator.registers[i]; // Lấy giá trị signed
            const cells = row.cells;
            
            // Giá trị Hex cũ là ở ô cells[1]
            const oldValueHex = cells[1].textContent; 
            // Hiển thị giá trị Hex dạng unsigned cho nhất quán
            const newValueHex = `0x${(value >>> 0).toString(16).padStart(8, '0')}`;

            if (newValueHex !== oldValueHex && document.body.contains(row)) {
                row.classList.add('highlight');
            } else if (document.body.contains(row)) {
                row.classList.remove('highlight');
            }
            // Cập nhật ô Hex (cells[1])
            cells[1].textContent = newValueHex;
            // Đã xóa cập nhật cho ô Decimal và Binary
        }
    }

    // Cập nhật PC
    const pcRowElement = document.getElementById('reg-pc');
    if (pcRowElement && pcRowElement.cells.length >= 2) { // Chỉ cần kiểm tra có ít nhất 2 ô
        const pcValue = currentSimulator.pc;
        const cells = pcRowElement.cells;

        // Giá trị Hex cũ là ở ô cells[1]
        const oldPcHex = cells[1].textContent;
        // Hiển thị giá trị Hex dạng unsigned
        const newPcHex = `0x${(pcValue >>> 0).toString(16).padStart(8, '0')}`;

        if (newPcHex !== oldPcHex && document.body.contains(pcRowElement)) {
            pcRowElement.classList.add('highlight');
        } else if (document.body.contains(pcRowElement)) {
            pcRowElement.classList.remove('highlight');
        }
        // Cập nhật ô Hex (cells[1])
        cells[1].textContent = newPcHex;
        // Đã xóa cập nhật cho ô Decimal và Binary của PC
    }

    // Cập nhật bảng Data Segment
    renderDataSegmentTable();

    // Xóa highlight sau một khoảng thời gian
    setTimeout(() => {
        registerTableBody?.querySelectorAll('tr.highlight').forEach(row => {
            row.classList.remove('highlight');
        });
        pcRowElement?.classList.remove('highlight');
    }, 500);
}
window.updateUIGlobally = updateUIGlobally; // Make accessible globally

// --- Event Handlers (không đổi nhiều, chỉ đảm bảo UI được cập nhật đúng) ---

function handleAssemble() {
    if (!assembler || !simulator || !binaryOutput || !instructionInput) return;
    binaryOutput.textContent = "Assembling...";
    if (dataSegmentBody) dataSegmentBody.innerHTML = '<tr><td colspan="9">Resetting simulator...</td></tr>';

    // Reset simulator trước, sau đó cập nhật UI ban đầu (có thể regs về 0)
    simulator.reset(); 
    // initializeRegisterTable(); // Đã gọi ở DOMContentLoaded, reset() của simulator không xóa cấu trúc bảng
    updateUIGlobally(); // Cập nhật regs về 0, PC về 0

    setTimeout(() => {
        try {
            const assemblyCode = instructionInput.value;
            // Output từ assembler.js đã sửa: { memory: object, startAddress: number, instructions: array }
            const programData = assembler.assemble(assemblyCode); 

            // Hiển thị Binary Output (từ programData.instructions là mảng các {address, binary, hex})
            const binaryHexStrings = programData.instructions.map(instr => `${instr.hex}  (${instr.binary})`);
            binaryOutput.textContent = binaryHexStrings.join('\n');
            if (binaryHexStrings.length === 0 && !assemblyCode.trim().startsWith('.data')) { // Nếu có .data nhưng không có lệnh
                 if (Object.keys(programData.memory).length > 0 && assemblyCode.trim().startsWith('.data')){
                    binaryOutput.textContent = "(Data segment assembled, no executable instructions)";
                 } else {
                    binaryOutput.textContent = "(No instructions assembled)";
                 }
            }


            // Simulator.loadProgram giờ sẽ nhận programData.memory đã chứa cả data và instructions
            simulator.loadProgram({ 
                memory: programData.memory, // memory từ assembler giờ chứa cả data và code
                startAddress: programData.startAddress 
                // không cần truyền programData.instructions riêng nếu assembler đã ghi lệnh vào memory của nó
            });

            let dataStartAddrFound = false;
            if (programData.memory && Object.keys(programData.memory).length > 0) {
                const dataAddresses = [];
                // Tìm vùng nhớ có địa chỉ >= dataBaseAddress của assembler để gợi ý cho data segment view
                const defaultDataBaseAddr = assembler.dataBaseAddress || 0x10010000; 
                for (const addrStr in programData.memory) {
                    const addr = parseInt(addrStr);
                    // Ưu tiên tìm địa chỉ trong khoảng data segment dự kiến
                    // Hoặc đơn giản là lấy địa chỉ nhỏ nhất không thuộc vùng text (nếu có cách phân biệt)
                    // Hiện tại, assembler.memory không phân biệt rõ data và text sau khi trộn.
                    // Chúng ta có thể tìm địa chỉ đầu tiên >= defaultDataBaseAddr
                    if (addr >= defaultDataBaseAddr) {
                        dataAddresses.push(addr);
                    }
                }
                if (dataAddresses.length > 0) {
                     dataSegmentStartAddress = Math.min(...dataAddresses);
                     dataStartAddrFound = true;
                } else { // Nếu không có gì trong vùng data mặc định, thử tìm địa chỉ nhỏ nhất trong memory
                    const allAddresses = Object.keys(programData.memory).map(Number).filter(addr => !isNaN(addr));
                    if(allAddresses.length > 0) {
                        dataSegmentStartAddress = Math.min(...allAddresses);
                        dataStartAddrFound = true;
                    }
                }
            }
            
            if (!dataStartAddrFound) {
                dataSegmentStartAddress = assembler.dataBaseAddress || 0x10010000;
            }
            dataSegmentStartAddress = Math.max(0, Math.floor(dataSegmentStartAddress / bytesPerRow) * bytesPerRow);
            if (dataSegmentAddressInput) dataSegmentAddressInput.value = `0x${dataSegmentStartAddress.toString(16)}`;
            
            updateUIGlobally(); // Cập nhật tất cả UI sau khi load xong (Regs, PC, Data Segment)

            // Tự động thực hiện bước đầu tiên nếu có lệnh
            // programData.instructions giờ là mảng {address, binary, hex}
            if (programData.instructions && programData.instructions.length > 0) {
                try {
                    simulator.step(); // step() sẽ tự gọi updateUIGlobally()
                } catch (stepError) {
                    console.error("Error during initial step execution:", stepError);
                    binaryOutput.textContent += `\n\nError during initial step: ${stepError.message}`;
                    updateUIGlobally(); 
                }
            }

        } catch (error) {
            console.error("Assembly or Loading Error:", error, error.stack);
            binaryOutput.textContent = `Error:\n${error.message}\n\n(Check console for details)`;
            if (dataSegmentBody) dataSegmentBody.innerHTML = '<tr><td colspan="9">Assembly/Loading failed.</td></tr>';
            // Reset lại bảng thanh ghi về 0 khi có lỗi assemble
            initializeRegisterTable(); 
            const pcRow = document.getElementById('reg-pc');
            if(pcRow && pcRow.cells[1]) pcRow.cells[1].textContent = '0x00000000';

        }
    }, 10);
}

function handleRun() {
    if (!simulator) return;
    binaryOutput.textContent += "\n\n--- Running ---";
    try {
        simulator.run(); 
    } catch (e) {
        console.error("Error starting run:", e);
        alert(`Error starting run: ${e.message}`);
        updateUIGlobally();
    }
}

function handleStep() {
    if (!simulator) return;
    try {
        simulator.step(); 
    } catch (e) {
        console.error("Error during step:", e);
        const currentBinaryOutput = binaryOutput.textContent.split('\n\nError during step:')[0]; // Giữ lại output cũ, tránh lặp lỗi
        binaryOutput.textContent = currentBinaryOutput + `\n\nStep Error: ${e.message}`;
        // alert(`Step Error: ${e.message}`); // Có thể bỏ alert nếu lỗi hiển thị ở binaryOutput
        updateUIGlobally(); 
    }
}

function handleReset() {
    if (!simulator || !instructionInput || !binaryOutput || !dataSegmentBody) return;

    simulator.stop(); // Dừng nếu đang chạy
    simulator.reset(); // Reset trạng thái simulator (regs, memory, pc)

    instructionInput.value = "";
    binaryOutput.textContent = "";
    dataSegmentStartAddress = assembler.dataBaseAddress || 0x10010000; 
    if (dataSegmentAddressInput) dataSegmentAddressInput.value = `0x${dataSegmentStartAddress.toString(16)}`; 

    // initializeRegisterTable(); // Gọi lại để đảm bảo bảng thanh ghi được vẽ lại đúng cấu trúc và giá trị 0
    // updateUIGlobally sẽ cập nhật giá trị từ simulator.registers (đã được reset về 0)
    updateUIGlobally(); 

    console.log("System reset complete.");
}


// --- Attach Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded. Initializing...");

    initializeRegisterTable(); // Tạo cấu trúc bảng regs và giá trị ban đầu là 0

    if (toggleDataSegmentModeButton) {
        toggleDataSegmentModeButton.addEventListener('click', () => {
            dataSegmentDisplayMode = (dataSegmentDisplayMode === 'hex') ? 'ascii' : 'hex';
            renderDataSegmentTable(); 
        });
    } else { console.error("Toggle button not found"); }

    if (goToDataSegmentAddressButton && dataSegmentAddressInput) {
        const goToAddress = () => { 
            const addrStr = dataSegmentAddressInput.value.trim();
            let newAddr;
            try {
                if (addrStr.toLowerCase().startsWith('0x')) {
                    newAddr = parseInt(addrStr, 16);
                } else if (addrStr === '') {
                    newAddr = dataSegmentStartAddress; 
                } else {
                    newAddr = parseInt(addrStr, 10); 
                }

                if (!isNaN(newAddr) && newAddr >= 0) {
                    dataSegmentStartAddress = Math.max(0, Math.floor(newAddr / bytesPerRow) * bytesPerRow);
                    renderDataSegmentTable(); 
                    dataSegmentAddressInput.value = `0x${dataSegmentStartAddress.toString(16)}`; 
                } else {
                    alert(`Invalid address format: "${addrStr}"`);
                    dataSegmentAddressInput.value = `0x${dataSegmentStartAddress.toString(16)}`;
                }
            } catch (e) {
                alert(`Error parsing address: "${addrStr}"`);
                dataSegmentAddressInput.value = `0x${dataSegmentStartAddress.toString(16)}`;
            }
        };

        goToDataSegmentAddressButton.addEventListener('click', goToAddress);
        dataSegmentAddressInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                goToAddress(); 
            }
        });

    } else { console.error("Address search elements not found"); }

    if (typeof simulator !== 'undefined') {
        simulator.reset(); // Reset simulator
        if (dataSegmentAddressInput) dataSegmentAddressInput.value = `0x${dataSegmentStartAddress.toString(16)}`;
        updateUIGlobally(); // Cập nhật UI ban đầu (regs về 0, data segment trống)
    } else {
        console.error("Simulator module not loaded!");
        if (dataSegmentBody) dataSegmentBody.innerHTML = '<tr><td colspan="9">Error: Simulator not loaded.</td></tr>';
    }

    assembleButton?.addEventListener('click', handleAssemble);
    runButton?.addEventListener('click', handleRun);
    stepButton?.addEventListener('click', handleStep);
    resetButton?.addEventListener('click', handleReset);

    console.log("Event listeners attached.");
});
