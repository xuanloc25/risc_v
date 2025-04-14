import { assembler } from './assembler.js';
import { simulator } from './simulator.js';

// --- DOM Elements ---
const instructionInput = document.getElementById('instructionInput');
const binaryOutput = document.getElementById('binaryOutput');
// const memoryOutput = document.getElementById('memoryOutput'); // Không dùng nữa
const registerTableBody = document.getElementById('registerTable')?.querySelector('tbody');
const assembleButton = document.getElementById('assembleButton');
const runButton = document.getElementById('runButton');
const stepButton = document.getElementById('stepButton');
const resetButton = document.getElementById('resetButton');

// --- THÊM: DOM Elements cho Data Segment ---
const dataSegmentAddressInput = document.getElementById('dataSegmentAddressInput');
const goToDataSegmentAddressButton = document.getElementById('goToDataSegmentAddress');
const toggleDataSegmentModeButton = document.getElementById('toggleDataSegmentMode');
const dataSegmentBody = document.getElementById('dataSegmentBody');

// --- THÊM: Trạng thái cho Data Segment View ---
let dataSegmentStartAddress = 0x10010000; // Địa chỉ bắt đầu mặc định (data section)
let dataSegmentDisplayMode = 'hex'; // 'hex' hoặc 'ascii'
const dataSegmentRows = 8;          // Số hàng hiển thị
const bytesPerRow = 32;         // Số byte trên mỗi hàng (8 words * 4 bytes/word)
const wordsPerRow = 8;          // Số word (cột giá trị) trên mỗi hàng

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
        row.insertCell().textContent = `x${i} (${abiNames[i]})`; // Name/ABI
        row.insertCell().textContent = '0';                      // Decimal
        row.insertCell().textContent = '0x00000000';             // Hex
        row.insertCell().textContent = '0'.repeat(32);           // Binary
    }
    // Tạo hàng riêng cho PC
    const pcRow = registerTableBody.insertRow();
    pcRow.id = 'reg-pc';
    pcRow.insertCell().textContent = 'PC';
    pcRow.insertCell().textContent = '0';
    pcRow.insertCell().textContent = '0x00000000';
    pcRow.insertCell().textContent = '0'.repeat(32);
}

// --- THÊM: Hàm render bảng Data Segment ---
function renderDataSegmentTable() {
    if (!dataSegmentBody || !simulator) {
        // console.warn("Data segment body or simulator not ready for rendering.");
        if (dataSegmentBody) dataSegmentBody.innerHTML = '<tr><td colspan="9">Simulator not ready or no data loaded.</td></tr>';
        return;
    }

    // console.log(`Rendering Data Segment from 0x${dataSegmentStartAddress.toString(16)} in ${dataSegmentDisplayMode} mode`);
    dataSegmentBody.innerHTML = ''; // Xóa nội dung cũ

    for (let i = 0; i < dataSegmentRows; i++) {
        // Đảm bảo địa chỉ không âm
        const rowBaseAddress = Math.max(0, dataSegmentStartAddress + i * bytesPerRow);
        const row = dataSegmentBody.insertRow();

        // 1. Thêm ô địa chỉ
        const addrCell = row.insertCell();
        addrCell.textContent = `0x${rowBaseAddress.toString(16).padStart(8, '0')}`;

        // 2. Thêm các ô giá trị (8 words)
        for (let j = 0; j < wordsPerRow; j++) {
            const wordStartAddress = rowBaseAddress + j * 4;
            let displayValue = '';
            let wordValue = 0;
            let bytes = [];
            let allBytesNull = true; // Cờ kiểm tra xem có byte nào tồn tại không

            // Đọc 4 byte (little-endian)
            for (let k = 0; k < 4; k++) {
                const byteAddr = wordStartAddress + k;
                const byte = simulator.memory[byteAddr] ?? null; // Dùng null để phân biệt 0 và không có
                bytes.push(byte);
                if (byte !== null) {
                    allBytesNull = false; // Tìm thấy ít nhất một byte
                    wordValue |= (byte << (k * 8)); // Ghép thành word (little-endian)
                }
            }

            // Định dạng giá trị hiển thị
            if (dataSegmentDisplayMode === 'hex') {
                if (allBytesNull) {
                    displayValue = '........'; // Hiển thị nếu không có byte nào
                } else {
                    // Hiển thị hex unsigned 32-bit
                    displayValue = `0x${(wordValue >>> 0).toString(16).padStart(8, '0')}`;
                }
            } else { // 'ascii' mode
                displayValue = '';
                for (const byte of bytes) {
                    if (byte !== null && byte >= 32 && byte <= 126) { // Ký tự in được ASCII
                        displayValue += String.fromCharCode(byte);
                    } else {
                        displayValue += '.'; // Ký tự thay thế cho null hoặc không in được
                    }
                }
            }

            // Thêm ô giá trị vào hàng
            row.insertCell().textContent = displayValue;
        }
    }
}


// --- Hàm cập nhật giao diện chính ---
function updateUIGlobally() {
    if (!registerTableBody) return;
    // console.log("Updating UI...");

    const currentSimulator = simulator;

    // Cập nhật bảng thanh ghi x0-x31
    for (let i = 0; i < 32; i++) {
        const row = document.getElementById(`reg-${i}`);
        if (row && row.cells.length >= 4) {
            const value = currentSimulator.registers[i] | 0;
            const cells = row.cells;
            const oldValueHex = cells[2].textContent;
            const newValueHex = `0x${value.toString(16).padStart(8, '0')}`;
            const newValueBin = (value >>> 0).toString(2).padStart(32, '0'); // Unsigned binary

            if (newValueHex !== oldValueHex && document.body.contains(row)) {
                row.classList.add('highlight');
            } else if (document.body.contains(row)) {
                row.classList.remove('highlight');
            }
            cells[1].textContent = value; // Decimal (signed)
            cells[2].textContent = newValueHex;
            cells[3].textContent = newValueBin;
        }
    }

    // Cập nhật PC
    const pcRowElement = document.getElementById('reg-pc');
    if (pcRowElement && pcRowElement.cells.length >= 4) {
        const pcValue = currentSimulator.pc | 0;
        const cells = pcRowElement.cells;
        const oldPcHex = cells[2].textContent;
        const newPcHex = `0x${pcValue.toString(16).padStart(8, '0')}`;
        const newPcBin = (pcValue >>> 0).toString(2).padStart(32, '0'); // Unsigned binary

        if (newPcHex !== oldPcHex && document.body.contains(pcRowElement)) {
            pcRowElement.classList.add('highlight');
        } else if (document.body.contains(pcRowElement)) {
            pcRowElement.classList.remove('highlight');
        }
        cells[1].textContent = pcValue;
        cells[2].textContent = newPcHex;
        cells[3].textContent = newPcBin;
    }

    // --- THÊM: Cập nhật bảng Data Segment ---
    renderDataSegmentTable();
    // --------------------------------------

    // Xóa highlight
    setTimeout(() => {
        registerTableBody?.querySelectorAll('tr.highlight').forEach(row => {
            row.classList.remove('highlight');
        });
        pcRowElement?.classList.remove('highlight');
    }, 500);
}
window.updateUIGlobally = updateUIGlobally; // Make accessible globally

// --- Event Handlers ---

function handleAssemble() {
    if (!assembler || !simulator || !binaryOutput || !instructionInput) return;
    console.log("Assemble button clicked!");
    binaryOutput.textContent = "Assembling...";
    // Hiển thị trạng thái reset cho bảng data
    if (dataSegmentBody) dataSegmentBody.innerHTML = '<tr><td colspan="9">Resetting simulator...</td></tr>';


    simulator.reset();
    // Không gọi updateUIGlobally() ngay vì bảng data sẽ trống rỗng, đợi load xong
    // initializeRegisterTable(); // Chỉ cần gọi khi DOM load, không cần ở đây

    setTimeout(() => {
        try {
            const assemblyCode = instructionInput.value;
            const programData = assembler.assemble(assemblyCode);

            // Hiển thị Binary Output (chỉ mã nhị phân)
            const binaryStrings = programData.instructions.map(instr => instr.binary);
            binaryOutput.textContent = binaryStrings.join('\n');
            if (binaryStrings.length === 0) {
                binaryOutput.textContent = "(No instructions assembled)";
            }

            console.log("Loading program into simulator...");
            simulator.loadProgram(programData); // Nạp data và instructions

            // Cập nhật địa chỉ bắt đầu cho Data Segment View
            // Ưu tiên bắt đầu từ .data section nếu có
            let dataStartAddrFound = false;
            if (assembler.memory && Object.keys(assembler.memory).length > 0) {
                // Tìm địa chỉ nhỏ nhất trong memory của assembler (thường là bắt đầu .data)
                const dataAddresses = Object.keys(assembler.memory).map(Number).filter(addr => !isNaN(addr));
                if (dataAddresses.length > 0) {
                    dataSegmentStartAddress = Math.min(...dataAddresses);
                    dataStartAddrFound = true;
                }
            }
            // Nếu không tìm thấy .data, dùng địa chỉ mặc định cũ
            if (!dataStartAddrFound) {
                dataSegmentStartAddress = 0x10010000;
            }
            // Căn chỉnh xuống địa chỉ bắt đầu hàng gần nhất
            dataSegmentStartAddress = Math.floor(dataSegmentStartAddress / bytesPerRow) * bytesPerRow;
            if (dataSegmentAddressInput) dataSegmentAddressInput.value = `0x${dataSegmentStartAddress.toString(16)}`; // Cập nhật ô tìm kiếm


            console.log(`Program loaded. Data Segment view starting from 0x${dataSegmentStartAddress.toString(16)}`);

            updateUIGlobally(); // Cập nhật tất cả UI (Regs, PC, Data Segment) sau khi load
            console.log("UI updated after loading.");

            // Optional: Execute first step
            if (programData.instructions.length > 0) {
                try {
                    console.log("Executing single step after assembly...");
                    simulator.step(); // step() sẽ tự gọi updateUIGlobally()
                    console.log("Single step executed.");
                } catch (stepError) {
                    console.error("Error during initial step execution:", stepError);
                    binaryOutput.textContent += `\n\nError during initial step: ${stepError.message}`;
                    updateUIGlobally(); // Cập nhật UI để thấy lỗi (nếu có)
                }
            } else {
                console.log("No instructions to execute.");
            }

        } catch (error) {
            console.error("Assembly or Loading Error:", error);
            binaryOutput.textContent = `Error:\n${error.message}\n\n(Check console for details)`;
            if (dataSegmentBody) dataSegmentBody.innerHTML = '<tr><td colspan="9">Assembly/Loading failed.</td></tr>'; // Hiển thị lỗi trên bảng data
            // Cập nhật regs/PC về trạng thái reset
            initializeRegisterTable(); // Vẽ lại bảng regs về 0
            const pcRowElement = document.getElementById('reg-pc');
            if (pcRowElement) {
                pcRowElement.cells[1].textContent = '0';
                pcRowElement.cells[2].textContent = '0x00000000';
                pcRowElement.cells[3].textContent = '0'.repeat(32);
            }
        }
    }, 10);
}

function handleRun() {
    if (!simulator) return;
    console.log("Run button clicked");
    binaryOutput.textContent += "\n\n--- Running ---";
    try {
        simulator.run(); // Bắt đầu chạy bất đồng bộ
    } catch (e) {
        console.error("Error starting run:", e);
        alert(`Error starting run: ${e.message}`);
        updateUIGlobally();
    }
}

function handleStep() {
    if (!simulator) return;
    console.log("Step button clicked");
    try {
        simulator.step(); // Thực thi 1 lệnh, step() sẽ gọi updateUIGlobally()
    } catch (e) {
        console.error("Error during step:", e);
        binaryOutput.textContent += `\n\nStep Error: ${e.message}`;
        alert(`Step Error: ${e.message}`);
        updateUIGlobally(); // Cập nhật UI để thấy trạng thái lỗi
    }
}

function handleReset() {
    if (!simulator || !instructionInput || !binaryOutput || !dataSegmentBody) return;
    console.log("Reset button clicked!");

    simulator.stop();
    simulator.reset();

    instructionInput.value = "";
    binaryOutput.textContent = "";
    dataSegmentStartAddress = 0x10010000; // Reset địa chỉ view data
    if (dataSegmentAddressInput) dataSegmentAddressInput.value = `0x${dataSegmentStartAddress.toString(16)}`; // Cập nhật ô tìm kiếm

    updateUIGlobally(); // Cập nhật UI về trạng thái reset (Regs, PC, Data Segment)

    console.log("System reset complete.");
}


// --- Attach Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded. Initializing...");

    initializeRegisterTable(); // Tạo cấu trúc bảng regs

    // Gắn sự kiện cho các nút của Data Segment
    if (toggleDataSegmentModeButton) {
        toggleDataSegmentModeButton.addEventListener('click', () => {
            dataSegmentDisplayMode = (dataSegmentDisplayMode === 'hex') ? 'ascii' : 'hex';
            console.log("Toggled data segment display mode to:", dataSegmentDisplayMode);
            renderDataSegmentTable(); // Vẽ lại bảng data segment
        });
    } else { console.error("Toggle button not found"); }

    if (goToDataSegmentAddressButton && dataSegmentAddressInput) {
        const goToAddress = () => { // Tách thành hàm riêng
            const addrStr = dataSegmentAddressInput.value.trim();
            let newAddr;
            try {
                if (addrStr.toLowerCase().startsWith('0x')) {
                    newAddr = parseInt(addrStr, 16);
                } else if (addrStr === '') {
                    newAddr = dataSegmentStartAddress; // Giữ nguyên nếu rỗng
                } else {
                    newAddr = parseInt(addrStr, 10); // Thử parse dec
                }

                if (!isNaN(newAddr) && newAddr >= 0) {
                    // Căn chỉnh địa chỉ xuống đầu hàng gần nhất
                    dataSegmentStartAddress = Math.floor(newAddr / bytesPerRow) * bytesPerRow;
                    console.log(`Go to address requested: 0x${newAddr.toString(16)}, displaying from 0x${dataSegmentStartAddress.toString(16)}`);
                    renderDataSegmentTable(); // Vẽ lại bảng data segment
                    dataSegmentAddressInput.value = `0x${dataSegmentStartAddress.toString(16)}`; // Cập nhật lại input box với địa chỉ đã căn chỉnh
                } else {
                    alert(`Invalid address format: "${addrStr}"`);
                    // Khôi phục giá trị input box về địa chỉ hiện tại
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
                goToAddress(); // Gọi hàm xử lý khi nhấn Enter
            }
        });

    } else { console.error("Address search elements not found"); }

    // Khởi tạo simulator và UI ban đầu
    if (typeof simulator !== 'undefined') {
        simulator.reset();
        if (dataSegmentAddressInput) dataSegmentAddressInput.value = `0x${dataSegmentStartAddress.toString(16)}`; // Đặt giá trị ban đầu cho ô tìm kiếm
        updateUIGlobally(); // Cập nhật UI ban đầu (gồm cả data segment)
    } else {
        console.error("Simulator module not loaded!");
        if (dataSegmentBody) dataSegmentBody.innerHTML = '<tr><td colspan="9">Error: Simulator not loaded.</td></tr>';
    }

    // Gắn listener cho các nút điều khiển chính
    assembleButton?.addEventListener('click', handleAssemble);
    runButton?.addEventListener('click', handleRun);
    stepButton?.addEventListener('click', handleStep);
    resetButton?.addEventListener('click', handleReset);

    console.log("Event listeners attached.");
});
