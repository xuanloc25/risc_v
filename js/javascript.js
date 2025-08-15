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
const instructionViewBody = document.getElementById('instructionViewBody');


// --- Các biến trạng thái của giao diện ---
let dataSegmentStartAddress = 0x10010000;
let dataSegmentDisplayMode = 'hex';
const dataSegmentRows = 8;
const bytesPerRow = 32;
const wordsPerRow = 8;
let currentRegisterView = 'integer';
let activeBreakpoints = new Set(); // Set để lưu các số dòng đang có breakpoint

// --- Các hằng số ---
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


// --- Các hàm quản lý Breakpoint và Editor ---

/**
 * Hàm tổng để bật/tắt breakpoint cho một dòng và cập nhật toàn bộ UI.
 * @param {number} lineNumber - Số dòng cần thay đổi trạng thái breakpoint.
 */
function toggleBreakpoint(lineNumber) {
    if (activeBreakpoints.has(lineNumber)) {
        activeBreakpoints.delete(lineNumber);
    } else {
        activeBreakpoints.add(lineNumber);
    }
    updateBreakpointUI();
}

/**
 * Đồng bộ hóa trạng thái breakpoint trên toàn bộ giao diện (gutter và bảng lệnh).
 */
function updateBreakpointUI() {
    // Cập nhật lề (gutter) của trình soạn thảo
    const gutterLines = document.querySelectorAll('#lineNumberGutter .line-number');
    gutterLines.forEach(lineEl => {
        const lineNum = parseInt(lineEl.dataset.lineNumber);
        if (activeBreakpoints.has(lineNum)) {
            lineEl.classList.add('breakpoint');
        } else {
            lineEl.classList.remove('breakpoint');
        }
    });

    // Cập nhật các checkbox trong bảng Instruction View
    const checkboxes = document.querySelectorAll('#instructionViewTable input[type="checkbox"]');
    checkboxes.forEach(cb => {
        const lineNum = parseInt(cb.dataset.lineNumber);
        cb.checked = activeBreakpoints.has(lineNum);
    });
}

/**
 * Cập nhật các số dòng trong lề của trình soạn thảo.
 */
function updateLineNumbers() {
    const lineNumberGutter = document.getElementById('lineNumberGutter');
    if (!instructionInput || !lineNumberGutter) return;

    lineNumberGutter.scrollTop = instructionInput.scrollTop; // Đồng bộ cuộn
    const lineCount = instructionInput.value.split('\n').length;
    lineNumberGutter.innerHTML = ''; // Xóa số dòng cũ

    for (let i = 1; i <= lineCount; i++) {
        const lineEl = document.createElement('div');
        lineEl.className = 'line-number';
        lineEl.textContent = i;
        lineEl.dataset.lineNumber = i;
        lineEl.addEventListener('click', () => toggleBreakpoint(i));
        lineNumberGutter.appendChild(lineEl);
    }
    updateBreakpointUI(); // Đảm bảo các breakpoint được tô màu đúng
}


// --- Các hàm khởi tạo và cập nhật giao diện (UI) ---

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

/**
 * Dịch ngược một từ mã máy 32-bit thành chuỗi lệnh assembly cơ bản.
 * @param {number} instructionWord - Từ mã máy 32-bit.
 * @returns {string} - Chuỗi lệnh assembly cơ bản.
 */
function disassembleInstruction(instructionWord) {
    if (!simulator) return "Simulator not ready";
    try {
        const decoded = simulator.cpu.decode(instructionWord);
        if (decoded.opName === 'UNKNOWN') return `(unknown: 0x${instructionWord.toString(16).padStart(8, '0')})`;

        const rd = `x${decoded.rd}`;
        const rs1 = `x${decoded.rs1}`;
        const rs2 = `x${decoded.rs2}`;
        const op = decoded.opName.toLowerCase();

        switch (decoded.type) {
            case 'R': return `${op} ${rd}, ${rs1}, ${rs2}`;
            case 'I':
                if (['lw', 'lb', 'lh', 'lbu', 'lhu', 'jalr', 'flw'].includes(op)) {
                    return `${op} ${op.startsWith('f') ? `f${decoded.rd}`: rd}, ${decoded.imm}(${rs1})`;
                }
                return `${op} ${rd}, ${rs1}, ${decoded.imm}`;
            case 'S': return `${op} ${rs2}, ${decoded.imm}(${rs1})`;
            case 'B': return `${op} ${rs1}, ${rs2}, ${decoded.imm}`;
            case 'U': return `${op} ${rd}, ${decoded.imm >>> 12}`;
            case 'J': return `${op} ${rd}, ${decoded.imm}`;
            case 'S-FP': return `${op} f${decoded.rs2}, ${decoded.imm}(${rs1})`;
            case 'R-FP': return `${op} f${decoded.rd}, f${decoded.rs1}, f${decoded.rs2}`;
            default: return `${op}`;
        }
    } catch (e) {
        return `(disassembly error)`;
    }
}

/**
 * Hiển thị bảng Instruction Memory View.
 */
function renderInstructionView() {
    if (!instructionViewBody || !assembler.binaryCode) {
        if (instructionViewBody) instructionViewBody.innerHTML = '';
        return;
    }

    instructionViewBody.innerHTML = '';
    const pc = simulator.cpu.pc;

    const sourceLineMap = new Map();
    assembler.instructionLines.forEach(lineInfo => {
        if (lineInfo.type === 'instruction' || lineInfo.type === 'pseudo-instruction') {
            sourceLineMap.set(lineInfo.address, lineInfo);
        }
    });

    let lastSourceLineNum = -1;

    assembler.binaryCode.forEach(instr => {
        const row = instructionViewBody.insertRow();
        row.dataset.address = instr.address;

        if (instr.address === pc) {
            row.classList.add('pc-highlight');
        }

        let sourceLine = sourceLineMap.get(instr.address);
        if (!sourceLine) {
            const closestAddress = Array.from(sourceLineMap.keys()).filter(addr => addr < instr.address).pop();
            if (closestAddress !== undefined) {
                const potentialSource = sourceLineMap.get(closestAddress);
                if (instr.address < potentialSource.address + potentialSource.size) {
                    sourceLine = potentialSource;
                }
            }
        }

        // Cột 1: Breakpoint
        const bkptCell = row.insertCell();
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        if (sourceLine) {
            checkbox.dataset.lineNumber = sourceLine.lineNumber;
            checkbox.checked = activeBreakpoints.has(sourceLine.lineNumber);
            checkbox.addEventListener('click', () => toggleBreakpoint(sourceLine.lineNumber));
        } else {
            checkbox.disabled = true;
        }
        bkptCell.appendChild(checkbox);

        // Cột 2: Address
        row.insertCell().textContent = `0x${instr.address.toString(16).padStart(8, '0')}`;
        // Cột 3: Code (Hex)
        row.insertCell().textContent = instr.hex;
        // Cột 4: Basic (Lệnh dịch ngược)
        row.insertCell().textContent = disassembleInstruction(parseInt(instr.hex, 16));
        // Cột 5: Source (Code gốc)
        const sourceCell = row.insertCell();
        if (sourceLine && sourceLine.lineNumber !== lastSourceLineNum) {
            sourceCell.textContent = `${sourceLine.lineNumber}: ${sourceLine.original.trim()}`;
            lastSourceLineNum = sourceLine.lineNumber;
        }
    });
}

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
            let allBytesNull = true;

            for (let k = 0; k < 4; k++) {
                const byte = simulator.tilelinkMem.mem[wordStartAddress + k] ?? null;
                if (byte !== null) {
                    allBytesNull = false;
                    wordValue |= (byte << (k * 8));
                }
            }
            if (dataSegmentDisplayMode === 'hex') {
                displayValue = allBytesNull ? '........' : `0x${(wordValue >>> 0).toString(16).padStart(8, '0')}`;
            } else {
                const bytes = [(wordValue & 0xff), (wordValue >> 8 & 0xff), (wordValue >> 16 & 0xff), (wordValue >> 24 & 0xff)];
                displayValue = bytes.map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
            }
            row.insertCell().textContent = displayValue;
        }
    }
}

/**
 * Cập nhật toàn bộ giao diện người dùng (thanh ghi, bộ nhớ, PC highlight).
 */
function updateUIGlobally() {
    const currentSimulator = simulator;

    // Cập nhật bảng thanh ghi số nguyên
    if (registerTableBody) {
        for (let i = 0; i < 32; i++) {
            const row = document.getElementById(`reg-${i}`);
            const value = currentSimulator.cpu.registers[i];
            if (row && row.cells.length >= 3) {
                const hex = `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
                if (hex !== row.cells[1].textContent) row.classList.add('highlight');
                else row.classList.remove('highlight');
                row.cells[1].textContent = hex;
                row.cells[2].textContent = value.toString();
            }
        }
        const pcRow = document.getElementById('reg-pc');
        if (pcRow && pcRow.cells.length >= 3) {
            const pc = currentSimulator.cpu.pc;
            const hex = `0x${(pc >>> 0).toString(16).padStart(8, '0')}`;
            if (hex !== pcRow.cells[1].textContent) pcRow.classList.add('highlight');
            else pcRow.classList.remove('highlight');
            pcRow.cells[1].textContent = hex;
            pcRow.cells[2].textContent = pc.toString();
        }
    }

    // Cập nhật bảng thanh ghi dấu phẩy động
    if (fpRegisterTableBody && currentSimulator.cpu?.fregisters) {
        for (let i = 0; i < 32; i++) {
            const row = document.getElementById(`freg-${i}`);
            const value = currentSimulator.cpu.fregisters[i];
            const buffer = new ArrayBuffer(4);
            const view = new DataView(buffer);
            view.setFloat32(0, value, true);
            const floatStr = value.toPrecision(7);

            if (row && row.cells.length >= 3) {
                if (floatStr !== row.cells[1].textContent) row.classList.add('highlight');
                else row.classList.remove('highlight');
                row.cells[1].textContent = floatStr;
                row.cells[2].textContent = `0x${(view.getInt32(0, true) >>> 0).toString(16).padStart(8, '0')}`;
            }
        }
    }

    // Vẽ lại các bảng bộ nhớ
    renderDataSegmentTable();
    renderInstructionView();

    // Xóa hiệu ứng highlight sau một khoảng thời gian ngắn
    setTimeout(() => {
        document.querySelectorAll('tr.highlight').forEach(row => row.classList.remove('highlight'));
    }, 500);
}

window.updateUIGlobally = updateUIGlobally;

// --- Các hàm xử lý sự kiện cho nút điều khiển ---

function handleAssemble() {
    if (!assembler || !simulator || !binaryOutput || !instructionInput) return;
    binaryOutput.textContent = "Assembling...";
    if (dataSegmentBody) dataSegmentBody.innerHTML = '<tr><td colspan="9">Resetting simulator...</td></tr>';
    if (instructionViewBody) instructionViewBody.innerHTML = '';

    simulator.reset();

    setTimeout(() => {
        try {
            const assemblyCode = instructionInput.value;
            const programData = assembler.assemble(assemblyCode);

            const binaryHexStrings = programData.instructions.map(instr => `${instr.hex}  (${instr.binary})`);
            binaryOutput.textContent = binaryHexStrings.join('\n');
            if (binaryHexStrings.length === 0) {
                binaryOutput.textContent = "(No executable instructions assembled)";
            }

            simulator.loadProgram(programData);

            let dataStartAddrFound = false;
            if (programData.memory && Object.keys(programData.memory).length > 0) {
                const dataAddresses = Object.keys(programData.memory)
                    .map(addr => parseInt(addr))
                    .filter(addr => addr >= (assembler.dataBaseAddress || 0x10010000));

                if (dataAddresses.length > 0) {
                    dataSegmentStartAddress = Math.min(...dataAddresses);
                    dataStartAddrFound = true;
                }
            }
            if (!dataStartAddrFound) {
                dataSegmentStartAddress = assembler.dataBaseAddress || 0x10010000;
            }
            dataSegmentStartAddress = Math.max(0, Math.floor(dataSegmentStartAddress / bytesPerRow) * bytesPerRow);
            if (dataSegmentAddressInput) dataSegmentAddressInput.value = `0x${dataSegmentStartAddress.toString(16)}`;

            updateUIGlobally();

        } catch (error) {
            console.error("Assembly or Loading Error:", error, error.stack);
            binaryOutput.textContent = `Error:\n${error.message}\n\n(Check console for details)`;
            if (dataSegmentBody) dataSegmentBody.innerHTML = '<tr><td colspan="9">Assembly/Loading failed.</td></tr>';
            initializeRegisterTable();
            initializeFPRegisterTable();
            updateUIGlobally();
        }
    }, 10);
}

function handleRun() {
    if (!simulator) return;
    binaryOutput.textContent += "\n\n--- Running ---";

    let breakpointAddress = null;
    if (activeBreakpoints.size > 0) {
        const firstBreakpointLine = Math.min(...activeBreakpoints);
        const instructionLineInfo = assembler.instructionLines.find(
            line => line.lineNumber === firstBreakpointLine && (line.type === 'instruction' || line.type === 'pseudo-instruction')
        );

        if (instructionLineInfo) {
            breakpointAddress = instructionLineInfo.address;
            binaryOutput.textContent += `\n(Running until breakpoint at Line ${firstBreakpointLine} - Addr 0x${breakpointAddress.toString(16)})`;
        } else {
            binaryOutput.textContent += `\n⚠ Warning: No executable instruction found on breakpoint line ${firstBreakpointLine}.`;
        }
    }

    let running = true;
    const maxCycles = 50000;
    let cycle = 0;

    function runLoop() {
        if (!running || !simulator.cpu.isRunning || cycle++ > maxCycles) {
            if (cycle > maxCycles) {
                binaryOutput.textContent += `\n\n⚠ Halted: Exceeded maximum cycle limit.`;
            }
            updateUIGlobally();
            return;
        }

        if (breakpointAddress !== null && simulator.cpu.pc === breakpointAddress) {
            running = false;
            binaryOutput.textContent += `\n🔴 Breakpoint hit at PC = 0x${breakpointAddress.toString(16)}`;
            updateUIGlobally();
            return;
        }

        try {
            simulator.tick();
            requestAnimationFrame(runLoop);
        } catch (e) {
            running = false;
            console.error("Error during run:", e);
            binaryOutput.textContent += `\n\nRun Error: ${e.message}`;
            updateUIGlobally();
        }
    }

    updateUIGlobally();
    requestAnimationFrame(runLoop);
}

function handleStep() {
    if (!simulator) return;
    try {
        simulator.tick();
        updateUIGlobally();
    } catch (e) {
        console.error("Error during step:", e);
        const currentBinaryOutput = binaryOutput.textContent.split('\n\nStep Error:')[0];
        binaryOutput.textContent = currentBinaryOutput + `\n\nStep Error: ${e.message}`;
        updateUIGlobally();
    }
}

function handleReset() {
    if (!simulator || !instructionInput || !binaryOutput || !dataSegmentBody) return;

    simulator.reset();

    instructionInput.value = "";
    binaryOutput.textContent = "";

    activeBreakpoints.clear();
    updateLineNumbers();

    dataSegmentStartAddress = assembler.dataBaseAddress || 0x10010000;
    if (dataSegmentAddressInput) dataSegmentAddressInput.value = `0x${dataSegmentStartAddress.toString(16)}`;

    updateUIGlobally();

    if (registerTable && fpRegisterTable && toggleRegisterViewButton) {
        registerTable.classList.add('active-table');
        fpRegisterTable.classList.remove('active-table');
        toggleRegisterViewButton.textContent = "View Floating-Point Registers";
        currentRegisterView = 'integer';
    }
    console.log("System reset complete.");
}

// --- Khởi tạo và gắn các trình xử lý sự kiện khi DOM đã sẵn sàng ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded. Initializing UI components...");

    initializeRegisterTable();
    initializeFPRegisterTable();

    // Khởi tạo trình soạn thảo code
    if (instructionInput) {
        // Cập nhật số dòng khi nhập liệu hoặc cuộn
        instructionInput.addEventListener('input', updateLineNumbers);
        instructionInput.addEventListener('scroll', updateLineNumbers);
        updateLineNumbers(); // Cập nhật lần đầu

        // ✅ Bổ sung xử lý phím Tab để thụt lề
        instructionInput.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                // 1. Ngăn hành vi mặc định (chuyển focus)
                e.preventDefault();

                const start = this.selectionStart;
                const end = this.selectionEnd;

                // 2. Chèn 4 dấu cách (bạn có thể đổi thành '\t' nếu muốn)
                const tabCharacter = '    ';
                this.value = this.value.substring(0, start) +
                    tabCharacter +
                    this.value.substring(end);

                // 3. Di chuyển con trỏ đến sau ký tự tab vừa chèn
                this.selectionStart = this.selectionEnd = start + tabCharacter.length;
            }
        });
    }

    // Gắn sự kiện cho nút chuyển đổi bảng thanh ghi
    toggleRegisterViewButton?.addEventListener('click', () => {
        currentRegisterView = (currentRegisterView === 'integer') ? 'fp' : 'integer';
        registerTable.classList.toggle('active-table');
        fpRegisterTable.classList.toggle('active-table');
        toggleRegisterViewButton.textContent = (currentRegisterView === 'integer')
            ? "View Floating-Point Registers"
            : "View Integer Registers";
    });

    // Gắn sự kiện cho nút chuyển đổi chế độ xem Data Segment
    toggleDataSegmentModeButton?.addEventListener('click', () => {
        dataSegmentDisplayMode = (dataSegmentDisplayMode === 'hex') ? 'ascii' : 'hex';
        renderDataSegmentTable();
    });

    // Gắn sự kiện cho việc đi đến địa chỉ trong Data Segment
    if (goToDataSegmentAddressButton && dataSegmentAddressInput) {
        const goToAddress = () => {
            const addrStr = dataSegmentAddressInput.value.trim();
            if (addrStr === '') return;
            try {
                const newAddr = addrStr.toLowerCase().startsWith('0x') ? parseInt(addrStr, 16) : parseInt(addrStr, 10);
                if (!isNaN(newAddr) && newAddr >= 0) {
                    dataSegmentStartAddress = Math.max(0, Math.floor(newAddr / bytesPerRow) * bytesPerRow);
                    renderDataSegmentTable();
                    dataSegmentAddressInput.value = `0x${dataSegmentStartAddress.toString(16)}`;
                } else {
                    alert(`Invalid address format: "${addrStr}"`);
                }
            } catch (e) {
                alert(`Error parsing address: "${addrStr}"`);
            }
        };
        goToDataSegmentAddressButton.addEventListener('click', goToAddress);
        dataSegmentAddressInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') goToAddress();
        });
    }

    // Khởi tạo simulator và UI lần đầu
    if (typeof simulator !== 'undefined') {
        simulator.reset();
        if (dataSegmentAddressInput) dataSegmentAddressInput.value = `0x${dataSegmentStartAddress.toString(16)}`;
        updateUIGlobally();
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
