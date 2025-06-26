// javascript.js
// File này điều khiển giao diện người dùng, tương tác với assembler và simulator.

import { assembler } from './assembler.js';
import { simulator } from './simulator.js';

// --- Tham chiếu đến các phần tử DOM ---
const instructionInput = document.getElementById('instructionInput');
const binaryOutput = document.getElementById('binaryOutput');
const registerTable = document.getElementById('registerTable');
const registerTableBody = registerTable?.querySelector('tbody');
const fpRegisterTable = document.getElementById('fpRegisterTable');
const fpRegisterTableBody = fpRegisterTable?.querySelector('tbody');
const toggleRegisterViewButton = document.getElementById('toggleRegisterViewButton');

const assembleButton = document.getElementById('assembleButton');
const runButton = document.getElementById('runButton');
const stepButton = document.getElementById('stepButton');
const resetButton = document.getElementById('resetButton');

const dataSegmentAddressInput = document.getElementById('dataSegmentAddressInput');
const goToDataSegmentAddressButton = document.getElementById('goToDataSegmentAddress');
const toggleDataSegmentModeButton = document.getElementById('toggleDataSegmentMode');
const dataSegmentBody = document.getElementById('dataSegmentBody');

let dataSegmentStartAddress = 0x10010000;
let dataSegmentDisplayMode = 'hex';
const dataSegmentRows = 8;
const bytesPerRow = 32;
const wordsPerRow = 8;

let currentRegisterView = 'integer';

const abiNames = [
    'zero', 'ra', 'sp', 'gp', 'tp', 't0', 't1', 't2',
    's0/fp', 's1', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5',
    'a6', 'a7', 's2', 's3', 's4', 's5', 's6', 's7',
    's8', 's9', 's10', 's11', 't3', 't4', 't5', 't6'
];

const fpAbiNames = [
    'ft0', 'ft1', 'ft2', 'ft3', 'ft4', 'ft5', 'ft6', 'ft7', 
    'fs0', 'fs1', 'fa0', 'fa1', 'fa2', 'fa3', 'fa4', 'fa5',
    'fa6', 'fa7', 'fs2', 'fs3', 'fs4', 'fs5', 'fs6', 'fs7',
    'fs8', 'fs9', 'fs10', 'fs11', 'ft8', 'ft9', 'ft10', 'ft11'
];

function initializeRegisterTable() {
    if (!registerTableBody) return;
    registerTableBody.innerHTML = '';

    for (let i = 0; i < 32; i++) {
        const row = registerTableBody.insertRow();
        row.id = `reg-${i}`;
        row.insertCell().textContent = `x${i} (${abiNames[i]})`;
        row.insertCell().textContent = '0x00000000';
        row.insertCell().textContent = '0';
    }
    const pcRow = registerTableBody.insertRow();
    pcRow.id = 'reg-pc';
    pcRow.insertCell().textContent = 'PC';
    pcRow.insertCell().textContent = '0x00000000';
    pcRow.insertCell().textContent = '0';
    registerTable.querySelector('thead').innerHTML = '<tr><th>Name</th><th>Hex</th><th>Dec</th></tr>';
}

function initializeFPRegisterTable() {
    if (!fpRegisterTableBody) return;
    fpRegisterTableBody.innerHTML = '';
    for (let i = 0; i < 32; i++) {
        const row = fpRegisterTableBody.insertRow();
        row.id = `freg-${i}`;
        row.insertCell().textContent = `f${i} (${fpAbiNames[i] || '?'})`;
        row.insertCell().textContent = '0.0';
        row.insertCell().textContent = '0x00000000';
    }
    fpRegisterTable.querySelector('thead').innerHTML = '<tr><th>Register</th><th>Float Value</th><th>Hex (Bits)</th></tr>';
}

// Hiển thị nội dung của vùng nhớ Data Segment
function renderDataSegmentTable() {
    if (!dataSegmentBody || !simulator) {
        if (dataSegmentBody) dataSegmentBody.innerHTML = '<tr><td colspan="9">Simulator not ready or no data loaded.</td></tr>';
        return;
    }
    dataSegmentBody.innerHTML = ''; // Xóa nội dung cũ

    // Lặp qua số hàng cần hiển thị
    for (let i = 0; i < dataSegmentRows; i++) {
        const rowBaseAddress = Math.max(0, dataSegmentStartAddress + i * bytesPerRow); // Địa chỉ bắt đầu của hàng
        const row = dataSegmentBody.insertRow();
        const addrCell = row.insertCell(); // Ô hiển thị địa chỉ
        addrCell.textContent = `0x${rowBaseAddress.toString(16).padStart(8, '0')}`;

        // Lặp qua các word trên mỗi hàng
        for (let j = 0; j < wordsPerRow; j++) {
            const wordStartAddress = rowBaseAddress + j * 4; // Địa chỉ bắt đầu của word
            let displayValue = '';
            let wordValue = 0;      // Giá trị số nguyên của word
            let bytes = [];         // Mảng chứa các byte của word
            let allBytesNull = true; // Cờ kiểm tra xem word có hoàn toàn là null không

            // Đọc 4 byte cho mỗi word (little-endian)
            for (let k = 0; k < 4; k++) {
                const byteAddr = wordStartAddress + k;
                //const byte = simulator.tilelinkMem.readByte[byteAddr] ?? null; // Lấy byte từ memory, nếu không có thì là null
                let byte;
                try {
                    byte = simulator.tilelinkMem.mem[byteAddr] ?? null;
                } catch {
                    byte = null;    
                }
                bytes.push(byte);
                if (byte !== null) {
                    allBytesNull = false;
                    wordValue |= (byte << (k * 8)); // Ghép các byte thành word (little-endian)
                }
            }

            // Định dạng giá trị hiển thị tùy theo chế độ (hex hoặc ascii)
            if (dataSegmentDisplayMode === 'hex') {
                if (allBytesNull) {
                    displayValue = '........'; // Nếu word không có dữ liệu
                } else {
                    // Hiển thị dạng hex không dấu 32-bit
                    displayValue = `0x${(wordValue >>> 0).toString(16).padStart(8, '0')}`;
                }
            } else { // Chế độ 'ascii'
                displayValue = '';
                for (const byte of bytes) {
                    if (byte !== null && byte >= 32 && byte <= 126) { // Ký tự ASCII in được
                        displayValue += String.fromCharCode(byte);
                    } else {
                        displayValue += '.'; // Ký tự thay thế cho byte không in được hoặc null
                    }
                }
            }
            row.insertCell().textContent = displayValue; // Thêm ô giá trị vào hàng
        }
    }
}
// Cập nhật toàn bộ giao diện người dùng với trạng thái hiện tại của simulator
function updateUIGlobally() {
    const currentSimulator = simulator;

    if (registerTableBody) {
        for (let i = 0; i < 32; i++) {
            const row = document.getElementById(`reg-${i}`);
            const value = currentSimulator.cpu.registers[i];
            if (row && row.cells.length >= 3) {
                const hex = `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
                const dec = value.toString();
                const oldHex = row.cells[1].textContent;

                if (hex !== oldHex && document.body.contains(row)) {
                    row.classList.add('highlight');
                } else {
                    row.classList.remove('highlight');
                }

                row.cells[1].textContent = hex;
                row.cells[2].textContent = dec;
            }
        }

        const pcRow = document.getElementById('reg-pc');
        if (pcRow && pcRow.cells.length >= 3) {
            const pc = currentSimulator.cpu.pc;
            const hex = `0x${(pc >>> 0).toString(16).padStart(8, '0')}`;
            const dec = pc.toString();
            const oldHex = pcRow.cells[1].textContent;

            if (hex !== oldHex && document.body.contains(pcRow)) {
                pcRow.classList.add('highlight');
            } else {
                pcRow.classList.remove('highlight');
            }

            pcRow.cells[1].textContent = hex;
            pcRow.cells[2].textContent = dec;
        }
    }

    if (fpRegisterTableBody && currentSimulator.cpu?.fregisters) {
        for (let i = 0; i < 32; i++) {
            const row = document.getElementById(`freg-${i}`);
            const value = currentSimulator.cpu.fregisters[i];
            const buffer = new ArrayBuffer(4);
            const view = new DataView(buffer);
            view.setFloat32(0, value, true);
            const bits = view.getInt32(0, true);
            const hex = `0x${(bits >>> 0).toString(16).padStart(8, '0')}`;
            const floatStr = value.toPrecision(7);

            if (row && row.cells.length >= 3) {
                const oldFloat = row.cells[1].textContent;
                if (floatStr !== oldFloat && document.body.contains(row)) {
                    row.classList.add('highlight');
                } else {
                    row.classList.remove('highlight');
                }

                row.cells[1].textContent = floatStr;
                row.cells[2].textContent = hex;
            }
        }
    }

    renderDataSegmentTable();

    setTimeout(() => {
        document.querySelectorAll('tr.highlight').forEach(row => row.classList.remove('highlight'));
    }, 500);
}


// Đưa hàm updateUIGlobally ra phạm vi toàn cục để simulator có thể gọi khi cần (ví dụ sau khi chạy bất đồng bộ)
window.updateUIGlobally = updateUIGlobally;

// --- Xử lý sự kiện cho các nút điều khiển ---
// Xử lý sự kiện khi nhấn nút "Assemble"
function handleAssemble() {
    if (!assembler || !simulator || !binaryOutput || !instructionInput) return;
    binaryOutput.textContent = "Assembling..."; // Thông báo đang biên dịch
    if (dataSegmentBody) dataSegmentBody.innerHTML = '<tr><td colspan="9">Resetting simulator...</td></tr>';

    simulator.reset();      // Reset trạng thái simulator (bao gồm cả thanh ghi FP nếu có)
    //updateUIGlobally();     // Cập nhật UI để hiển thị trạng thái đã reset (các thanh ghi về 0)

    // Dùng setTimeout để UI có thời gian cập nhật trước khi thực hiện tác vụ nặng (assemble)
    setTimeout(() => {
        try {
            const assemblyCode = instructionInput.value; // Lấy mã assembly từ ô nhập liệu
            const programData = assembler.assemble(assemblyCode); // Gọi hàm assemble từ assembler.js
            console.log(programData.startAddress);

            // Hiển thị mã nhị phân (và hex) đã biên dịch
            const binaryHexStrings = programData.instructions.map(instr => `${instr.hex}  (${instr.binary})`);
            binaryOutput.textContent = binaryHexStrings.join('\n');
            if (binaryHexStrings.length === 0 && !assemblyCode.trim().startsWith('.data')) {
                 if (Object.keys(programData.memory).length > 0 && assemblyCode.trim().startsWith('.data')){
                    binaryOutput.textContent = "(Data segment assembled, no executable instructions)";
                 } else {
                    binaryOutput.textContent = "(No instructions assembled)";
                 }
            }

            // Nạp chương trình đã biên dịch vào simulator
            simulator.loadProgram({
                memory: programData.memory,         // Bộ nhớ đã chứa cả data và instructions
                startAddress: programData.startAddress
            });

            // Cập nhật địa chỉ bắt đầu cho Data Segment View, ưu tiên vùng .data
            let dataStartAddrFound = false;
            if (programData.memory && Object.keys(programData.memory).length > 0) {
                const dataAddresses = [];
                const defaultDataBaseAddr = assembler.dataBaseAddress || 0x10010000;
                
                for (const addrStr in programData.memory) {
                    const addr = parseInt(addrStr);
                    if (addr >= defaultDataBaseAddr) { 
                        dataAddresses.push(addr); 
                    }
                }
                
                if (dataAddresses.length > 0) {
                    dataSegmentStartAddress = Math.min(...dataAddresses);
                    dataStartAddrFound = true;
                } 
            }
            if (!dataStartAddrFound) {
                dataSegmentStartAddress = assembler.dataBaseAddress || 0x10010000;
            }
            dataSegmentStartAddress = Math.max(0, Math.floor(dataSegmentStartAddress / bytesPerRow) * bytesPerRow); // Căn chỉnh địa chỉ
            if (dataSegmentAddressInput) dataSegmentAddressInput.value = `0x${dataSegmentStartAddress.toString(16)}`; // Cập nhật ô input địa chỉ

            updateUIGlobally(); // Cập nhật lại toàn bộ UI sau khi nạp chương trình

            // Tùy chọn: Thực thi lệnh đầu tiên ngay sau khi assemble
            if (programData.instructions && programData.instructions.length > 0) {
                try {
                    simulator.tick();
                    updateUIGlobally();
                } catch (stepError) {
                    console.error("Error during initial step execution:", stepError);
                    binaryOutput.textContent += `\n\nError during initial step: ${stepError.message}`;
                    updateUIGlobally(); // Cập nhật UI nếu có lỗi ở bước đầu
                }
            }else {
                // Nếu không có lệnh nào, chỉ cập nhật UI về 0
                updateUIGlobally();
            }

        } catch (error) { // Bắt lỗi từ quá trình assemble hoặc load
            console.error("Assembly or Loading Error:", error, error.stack);
            binaryOutput.textContent = `Error:\n${error.message}\n\n(Check console for details)`;
            if (dataSegmentBody) dataSegmentBody.innerHTML = '<tr><td colspan="9">Assembly/Loading failed.</td></tr>';
            
            // Reset lại cấu trúc và giá trị bảng thanh ghi khi có lỗi nghiêm trọng
            initializeRegisterTable();
            initializeFPRegisterTable(); 
            const pcRow = document.getElementById('reg-pc');
            if(pcRow && pcRow.cells.length > 1) pcRow.cells[1].textContent = '0x00000000'; // Đảm bảo ô giá trị PC tồn tại
            updateUIGlobally(); // <-- Thêm dòng này để UI luôn đồng bộ sau khi bắt lỗi
        }
    }, 10); // Độ trễ nhỏ để UI kịp cập nhật
}

// Xử lý sự kiện khi nhấn nút "Run"
function handleRun() {
    if (!simulator) return;
    binaryOutput.textContent += "\n\n--- Running ---";

    let running = true;

    // 🧠 Đọc giá trị Breakpoint từ input
    let breakpointPC = null;
    const bpInput = document.getElementById('breakpointInput');
    if (bpInput && bpInput.value.trim()) {
        const val = bpInput.value.trim();
        breakpointPC = val.startsWith('0x') ? parseInt(val, 16) : parseInt(val, 10);
        if (isNaN(breakpointPC)) {
            binaryOutput.textContent += `\n⚠ Invalid breakpoint address: "${val}"`;
            breakpointPC = null;
        }
    }

    function runLoop() {
        if (!running) return;

        try {
            // 🛑 Dừng nếu PC đang ở breakpoint (trước khi tick)
            if (breakpointPC !== null && simulator.cpu.pc === breakpointPC) {
                running = false;
                binaryOutput.textContent += `\n🔴 Breakpoint hit at PC = 0x${breakpointPC.toString(16)}`;
                updateUIGlobally();
                return;
            }

            simulator.tick(); // chỉ chạy nếu không phải breakpoint
            updateUIGlobally();

            setTimeout(runLoop, 0); // tiếp tục loop

        } catch (e) {
            running = false;
            console.error("Error during run:", e);
            binaryOutput.textContent += `\n\nRun Error: ${e.message}`;
            updateUIGlobally();
        }
    }

    runLoop();
}



// Xử lý sự kiện khi nhấn nút "Step"
function handleStep() {
    if (!simulator) return;
    try {
        simulator.tick();
        updateUIGlobally();
    } catch (e) {
        console.error("Error during step:", e);
        const currentBinaryOutput = binaryOutput.textContent.split('\n\nStep Error:')[0]; // Tránh lặp lại thông báo lỗi cũ
        binaryOutput.textContent = currentBinaryOutput + `\n\nStep Error: ${e.message}`;
        updateUIGlobally(); // Cập nhật UI để phản ánh trạng thái sau lỗi
    }
}

// Xử lý sự kiện khi nhấn nút "Reset"
function handleReset() {
    if (!simulator || !instructionInput || !binaryOutput || !dataSegmentBody) return;

    simulator.reset();   // Reset trạng thái của simulator (thanh ghi, bộ nhớ, PC)

    // Xóa các ô input và output
    instructionInput.value = "";
    binaryOutput.textContent = "";
    // Đặt lại địa chỉ xem Data Segment
    dataSegmentStartAddress = assembler.dataBaseAddress || 0x10010000;
    if (dataSegmentAddressInput) dataSegmentAddressInput.value = `0x${dataSegmentStartAddress.toString(16)}`;

    updateUIGlobally(); // Cập nhật UI để hiển thị trạng thái đã reset

    // Đảm bảo bảng thanh ghi số nguyên được hiển thị mặc định sau khi reset
    if (registerTable && fpRegisterTable && toggleRegisterViewButton) {
        registerTable.classList.add('active-table');
        fpRegisterTable.classList.remove('active-table');
        toggleRegisterViewButton.textContent = "View Floating-Point Registers";
        currentRegisterView = 'integer';
    }
    console.log("System reset complete.");
}


// --- Gắn các trình xử lý sự kiện khi DOM đã sẵn sàng ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded. Initializing UI components...");

    // Khởi tạo cấu trúc ban đầu cho cả hai bảng thanh ghi
    initializeRegisterTable();
    initializeFPRegisterTable();

    // Gắn sự kiện cho nút chuyển đổi chế độ xem thanh ghi
    if (toggleRegisterViewButton && registerTable && fpRegisterTable) {
        toggleRegisterViewButton.addEventListener('click', () => {
            if (currentRegisterView === 'integer') {
                registerTable.classList.remove('active-table'); // Ẩn bảng integer
                fpRegisterTable.classList.add('active-table');    // Hiện bảng FP
                toggleRegisterViewButton.textContent = "View Integer Registers";
                currentRegisterView = 'fp';
            } else {
                fpRegisterTable.classList.remove('active-table'); // Ẩn bảng FP
                registerTable.classList.add('active-table');    // Hiện bảng integer
                toggleRegisterViewButton.textContent = "View Floating-Point Registers";
                currentRegisterView = 'integer';
            }
        });
    } else {
        console.error("Toggle register view button or register tables not found in DOM.");
    }

    // Gắn sự kiện cho nút chuyển đổi chế độ xem Data Segment (Hex/ASCII)
    if (toggleDataSegmentModeButton) {
        toggleDataSegmentModeButton.addEventListener('click', () => {
            dataSegmentDisplayMode = (dataSegmentDisplayMode === 'hex') ? 'ascii' : 'hex';
            renderDataSegmentTable(); // Vẽ lại bảng Data Segment với chế độ mới
        });
    } else { console.error("Data segment toggle mode button not found."); }

    // Gắn sự kiện cho việc đi đến địa chỉ trong Data Segment
    if (goToDataSegmentAddressButton && dataSegmentAddressInput) {
        const goToAddress = () => {
            const addrStr = dataSegmentAddressInput.value.trim(); // Lấy địa chỉ từ input
            let newAddr;
            try {
                // Parse địa chỉ (hỗ trợ cả hex và decimal)
                if (addrStr.toLowerCase().startsWith('0x')) {
                    newAddr = parseInt(addrStr, 16);
                } else if (addrStr === '') { // Nếu rỗng, giữ nguyên địa chỉ hiện tại
                    newAddr = dataSegmentStartAddress;
                } else {
                    newAddr = parseInt(addrStr, 10);
                }

                if (!isNaN(newAddr) && newAddr >= 0) { // Nếu địa chỉ hợp lệ
                    // Căn chỉnh địa chỉ về đầu hàng và vẽ lại bảng
                    dataSegmentStartAddress = Math.max(0, Math.floor(newAddr / bytesPerRow) * bytesPerRow);
                    renderDataSegmentTable();
                    dataSegmentAddressInput.value = `0x${dataSegmentStartAddress.toString(16)}`; // Cập nhật lại ô input
                } else {
                    alert(`Invalid address format: "${addrStr}"`);
                    dataSegmentAddressInput.value = `0x${dataSegmentStartAddress.toString(16)}`; // Khôi phục giá trị cũ
                }
            } catch (e) {
                alert(`Error parsing address: "${addrStr}"`);
                dataSegmentAddressInput.value = `0x${dataSegmentStartAddress.toString(16)}`; // Khôi phục
            }
        };
        goToDataSegmentAddressButton.addEventListener('click', goToAddress);
        dataSegmentAddressInput.addEventListener('keypress', function (e) { // Cho phép nhấn Enter
            if (e.key === 'Enter') {
                goToAddress();
            }
        });
    } else { console.error("Data segment address search elements not found."); }

    // Khởi tạo simulator và cập nhật UI lần đầu
    if (typeof simulator !== 'undefined') {
        simulator.reset(); // Reset trạng thái simulator
        if (dataSegmentAddressInput) dataSegmentAddressInput.value = `0x${dataSegmentStartAddress.toString(16)}`;
        updateUIGlobally(); // Cập nhật toàn bộ UI (thanh ghi về 0, data segment trống)
    } else {
        console.error("Simulator module not loaded!");
        if (dataSegmentBody) dataSegmentBody.innerHTML = '<tr><td colspan="9">Error: Simulator not loaded.</td></tr>';
    }

    // Gắn sự kiện cho các nút điều khiển chính
    assembleButton?.addEventListener('click', handleAssemble);
    runButton?.addEventListener('click', handleRun);
    stepButton?.addEventListener('click', handleStep);
    resetButton?.addEventListener('click', handleReset);

    console.log("Event listeners attached. UI is ready.");
});
