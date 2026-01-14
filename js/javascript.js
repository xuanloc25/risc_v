// javascript.js
// File này điều khiển giao diện người dùng, tương tác với assembler và simulator.

// --- Cấu hình cú pháp RISC-V cho CodeMirror ---
CodeMirror.defineSimpleMode("riscv", {
    start: [
        { regex: /#.*/, token: "comment" },
        { regex: /"(?:[^\\]|\\.)*?"/, token: "string" },
        { regex: /\.(?:text|data|globl|word|float|ascii|asciiz|space|align|eqv)\b/, token: "keyword" },
        { regex: /(?:la|li|mv|j|add|addi|sub|lw|sw|beq|bne|fadd\.s|flw|fsw|fsub\.s|ecall)\b/, token: "variable" },
        { regex: /(?:zero|ra|sp|gp|tp|t0|t1|t2|s0|fp|s1|a0|a1|a2|a3|a4|a5|s2|s3|s4|s5|fa0|fa1|fa2|x[0-9]+\b|f[0-9]+\b)/, token: "variable-2" },
        { regex: /[a-zA-Z_][\w]*:/, token: "tag" },
        { regex: /0x[a-f\d]+|[-+]?(?:\.\d+|\d+\.?\d*)/i, token: "number" },
    ]
});

import { assembler } from './assembler.js';
import { simulator } from './simulator.js';

// --- THAM CHIẾU DOM ---
let instructionInput; // Sẽ được khởi tạo bởi CodeMirror
const binaryOutput = document.getElementById('binaryOutput');

// Bảng Registers (Integer)
const registerTable = document.getElementById('registerTable');
const registerTableBody = registerTable?.querySelector('tbody');
const registerTableContainer = document.getElementById('registerTableContainer');

// Bảng Floating Point
const fpRegisterTable = document.getElementById('fpRegisterTable');
const fpRegisterTableBody = fpRegisterTable?.querySelector('tbody');
const fpRegisterTableContainer = document.getElementById('fpRegisterTableContainer');

// Tabs chuyển đổi Registers
const tabInteger = document.getElementById('tab-integer');
const tabFp = document.getElementById('tab-fp');

// Nút điều khiển Toolbar
const assembleButton = document.getElementById('assembleButton');
const runButton = document.getElementById('runButton');
const stepButton = document.getElementById('stepButton');
const resetButton = document.getElementById('resetButton');

// Thanh điều khiển tốc độ
const speedSlider = document.getElementById('speedSlider');
const speedValueLabel = document.getElementById('speedValue');
const clockRateDisplay = document.getElementById('clockRateDisplay');
// Data Segment Controls
const dataSegmentAddressInput = document.getElementById('dataSegmentAddressInput');
const goToDataSegmentAddressButton = document.getElementById('goToDataSegmentAddress');
const toggleDataSegmentModeButton = document.getElementById('toggleDataSegmentMode');
const dataSegmentBody = document.getElementById('dataSegmentBody');
const instructionViewBody = document.getElementById('instructionViewBody');

// --- BIẾN TRẠNG THÁI ---
let dataSegmentStartAddress = 0x10010000;
let dataSegmentDisplayMode = 'hex';
const dataSegmentRows = 8;
const bytesPerRow = 32;
const wordsPerRow = 8;
let currentRegisterView = 'integer';
let activeBreakpoints = new Set();

// --- HÀM QUẢN LÝ VIEW ---

/* Hàm chuyển đổi hiển thị bảng thanh ghi (Tabs Logic) */
function setRegisterView(view) {
    const isInteger = view === 'integer';
    currentRegisterView = view;

    // 1. Ẩn/Hiện Container của bảng
    if (registerTableContainer) registerTableContainer.style.display = isInteger ? 'block' : 'none';
    if (fpRegisterTableContainer) fpRegisterTableContainer.style.display = isInteger ? 'none' : 'block';

    // 2. Cập nhật trạng thái Active cho Tab
    if (tabInteger) {
        if (isInteger) tabInteger.classList.add('active');
        else tabInteger.classList.remove('active');
    }
    if (tabFp) {
        if (!isInteger) tabFp.classList.add('active');
        else tabFp.classList.remove('active');
    }
}

/* Tạo marker breakpoint (dấu chấm đỏ) */
function makeBreakpointMarker() {
    const marker = document.createElement("div");
    marker.style.color = "#e52d2d";
    marker.innerHTML = "●";
    return marker;
}

/* Cập nhật input địa chỉ data */
function setDataAddressValue(value) {
    if (dataSegmentAddressInput) {
        dataSegmentAddressInput.value = value;
    }
}

// --- HẰNG SỐ TÊN THANH GHI ---
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

// --- HÀM UI CƠ BẢN ---

function updateBreakpointUI() {
    const checkboxes = document.querySelectorAll('#instructionViewTable input[type="checkbox"]');
    checkboxes.forEach(cb => {
        const lineNum = parseInt(cb.dataset.lineNumber);
        cb.checked = activeBreakpoints.has(lineNum);
    });
}

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
}

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
                    return `${op} ${op.startsWith('f') ? `f${decoded.rd}` : rd}, ${decoded.imm}(${rs1})`;
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

            checkbox.addEventListener('click', (e) => {
                const lineNum = parseInt(e.currentTarget.dataset.lineNumber, 10);
                const cmLine = lineNum - 1;

                if (activeBreakpoints.has(lineNum)) {
                    if (instructionInput) instructionInput.setGutterMarker(cmLine, "breakpoints", null);
                    activeBreakpoints.delete(lineNum);
                } else {
                    if (instructionInput) instructionInput.setGutterMarker(cmLine, "breakpoints", makeBreakpointMarker());
                    activeBreakpoints.add(lineNum);
                }
                updateBreakpointUI();
            });
        } else {
            checkbox.disabled = true;
        }
        bkptCell.appendChild(checkbox);

        // Cột 2: Address, Code, ...
        row.insertCell().textContent = `0x${instr.address.toString(16).padStart(8, '0')}`;
        row.insertCell().textContent = instr.hex;
        row.insertCell().textContent = disassembleInstruction(parseInt(instr.hex, 16));

        const sourceCell = row.insertCell();
        if (sourceLine && sourceLine.lineNumber !== lastSourceLineNum) {
            sourceCell.textContent = `${sourceLine.lineNumber}: ${sourceLine.original.trim()}`;
            lastSourceLineNum = sourceLine.lineNumber;
        }
    });
}

function renderDataSegmentTable() {
    if (!dataSegmentBody || !simulator) {
        if (dataSegmentBody) dataSegmentBody.innerHTML = '<tr><td colspan="9">Simulator not ready.</td></tr>';
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

function updateUIGlobally() {
    const currentSimulator = simulator;

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

    renderDataSegmentTable();
    renderInstructionView();

    setTimeout(() => {
        document.querySelectorAll('tr.highlight').forEach(row => row.classList.remove('highlight'));
    }, 500);
}

window.updateUIGlobally = updateUIGlobally;

// --- SETUP UART CALLBACKS ---
function setupUARTCallbacks() {
    const uartOutput = document.getElementById('uartOutput');
    if (typeof simulator !== 'undefined' && simulator.mem && simulator.mem.uart && uartOutput) {
        const uart = simulator.mem.uart;

        // Callback khi UART transmit (CPU gửi dữ liệu)
        uart.onTransmit = function (charCode) {
            const char = String.fromCharCode(charCode);
            uartOutput.textContent += char;
            // Auto scroll to bottom
            uartOutput.scrollTop = uartOutput.scrollHeight;
            console.log(`[UART TX] '${char}' (0x${charCode.toString(16)})`);
        };

        console.log('[UART] Callbacks setup successfully');
    }
}

// --- EVENT HANDLERS (Nút điều khiển) ---

function handleAssemble() {
    if (!assembler || !simulator || !binaryOutput || !instructionInput) return;
    binaryOutput.textContent = "Assembling...";

    if (instructionViewBody) instructionViewBody.innerHTML = '';
    simulator.reset();
    setupUARTCallbacks(); // Setup lại UART callbacks sau reset

    setTimeout(() => {
        try {
            const assemblyCode = instructionInput.getValue();
            const programData = assembler.assemble(assemblyCode);

            const binaryHexStrings = programData.instructions.map(instr => `${instr.hex}  (${instr.binary})`);
            binaryOutput.textContent = binaryHexStrings.join('\n');
            if (binaryHexStrings.length === 0) {
                binaryOutput.textContent = "(No executable instructions assembled)";
            }

            simulator.loadProgram(programData);
            setupUARTCallbacks(); // Setup lại callbacks sau load program

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
            setDataAddressValue(`0x${dataSegmentStartAddress.toString(16)}`);

            updateUIGlobally();

        } catch (error) {
            console.error("Assembly Error:", error);
            binaryOutput.textContent = `Error:\n${error.message}`;
            assembler._reset();
            updateUIGlobally();
        }
    }, 10);
}

// --- [CẬP NHẬT] HÀM RUN MỚI HỖ TRỢ TỐC ĐỘ ---
function handleRun() {
    if (!simulator) return;
    binaryOutput.textContent += "\n\n--- Running ---";

    // 1. Logic Breakpoint (Giữ nguyên)
    let breakpointAddress = null;
    if (activeBreakpoints.size > 0) {
        const firstBreakpointLine = Math.min(...activeBreakpoints);
        const instructionLineInfo = assembler.instructionLines.find(
            line => line.lineNumber === firstBreakpointLine &&
                (line.type === 'instruction' || line.type === 'pseudo-instruction')
        );
        if (instructionLineInfo) {
            breakpointAddress = instructionLineInfo.address;
            binaryOutput.textContent += `\n(Running until breakpoint at Line ${firstBreakpointLine})`;
        }
    }

    let running = true;
    const maxCycles = 500000;
    let cycle = 0;

    // [MỚI] Biến dùng để đo tốc độ
    let lastTime = performance.now();
    let cyclesInLastSecond = 0;

    function runLoop() {
        // Kiểm tra dừng
        if (!running || !simulator.cpu.isRunning || cycle > maxCycles) {
            if (cycle > maxCycles) binaryOutput.textContent += `\n\n⚠ Halted: Exceeded max cycles.`;
            while (simulator.dma && simulator.dma.isBusy) simulator.tick();
            updateUIGlobally();
            return;
        }

        // Lấy tốc độ từ Slider
        let cyclesPerFrame = 1;
        if (speedSlider) {
            cyclesPerFrame = parseInt(speedSlider.value, 10);
            if (cyclesPerFrame === 100) cyclesPerFrame = 1000; // Tăng tốc cực đại lên 1000
        }

        // Vòng lặp thực thi
        let executedThisFrame = 0;
        for (let i = 0; i < cyclesPerFrame; i++) {
            if (breakpointAddress !== null && simulator.cpu.pc === breakpointAddress) {
                running = false;
                binaryOutput.textContent += `\n🔴 Breakpoint hit at PC = 0x${breakpointAddress.toString(16)}`;
                break;
            }
            if (!simulator.cpu.isRunning) {
                running = false;
                break;
            }

            try {
                simulator.tick();
                cycle++;
                executedThisFrame++; // Đếm số lệnh chạy được trong frame này

                if (cycle > maxCycles) {
                    running = false;
                    break;
                }
            } catch (e) {
                running = false;
                console.error("Run Error:", e);
                binaryOutput.textContent += `\n\nRun Error: ${e.message}`;
                break;
            }
        }

        // [MỚI] Tính toán tốc độ Hz (Instructions Per Second)
        cyclesInLastSecond += executedThisFrame;
        const now = performance.now();
        const elapsed = now - lastTime;

        // Cập nhật mỗi 500ms (nửa giây) để số nhảy cho mượt
        if (elapsed >= 500) {
            // Công thức: (Số lệnh / Số mili giây) * 1000 = Số lệnh/giây
            const hz = Math.round((cyclesInLastSecond / elapsed) * 1000);

            if (clockRateDisplay) {
                // Định dạng số có dấu phẩy (ví dụ: 1,200 Hz)
                clockRateDisplay.textContent = hz.toLocaleString() + " Hz";
            }

            // Reset bộ đếm
            cyclesInLastSecond = 0;
            lastTime = now;
        }

        updateUIGlobally();

        if (running && simulator.cpu.isRunning) {
            requestAnimationFrame(runLoop);
        }
    }

    requestAnimationFrame(runLoop);
}

function handleStep() {
    if (!simulator) return;
    try {
        simulator.tick();
        updateUIGlobally();
    } catch (e) {
        console.error("Step Error:", e);
        binaryOutput.textContent += `\n\nStep Error: ${e.message}`;
        updateUIGlobally();
    }
}

function handleReset() {
    if (!simulator || !instructionInput) return;

    simulator.reset();

    if (assembler && typeof assembler._reset === 'function') {
        assembler._reset();
    }

    // instructionInput.setValue(""); // [FIX] Không xóa code khi reset
    try { instructionInput.clearGutter("breakpoints"); } catch { }
    binaryOutput.textContent = "";
    if (clockRateDisplay) clockRateDisplay.textContent = "0 Hz"; // [FIX] Reset IPS display

    // [FIX] Reset Keyboard UI
    const kbInput = document.getElementById('keyboardInput');
    const kbStatus = document.getElementById('keyboardStatus');
    if (kbInput) kbInput.value = "";
    if (kbStatus) {
        kbStatus.textContent = "Empty";
        kbStatus.style.color = "#666";
    }

    activeBreakpoints.clear();

    dataSegmentStartAddress = assembler.dataBaseAddress || 0x10010000;
    setDataAddressValue(`0x${dataSegmentStartAddress.toString(16)}`);

    updateUIGlobally();
    setRegisterView('integer');
    console.log("System reset.");
}

// --- KHỞI TẠO KHI DOM LOADED ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Initializing App...");

    initializeRegisterTable();
    initializeFPRegisterTable();

    instructionInput = CodeMirror.fromTextArea(document.getElementById('instructionInput'), {
        lineNumbers: true,
        mode: "riscv",
        theme: "default",
        gutters: ["CodeMirror-linenumbers", "breakpoints"]
    });

    instructionInput.on("gutterClick", function (cm, n) {
        const lineNumber = n + 1;
        const info = cm.lineInfo(n);
        if (info.gutterMarkers) {
            cm.setGutterMarker(n, "breakpoints", null);
            activeBreakpoints.delete(lineNumber);
        } else {
            cm.setGutterMarker(n, "breakpoints", makeBreakpointMarker());
            activeBreakpoints.add(lineNumber);
        }
        updateBreakpointUI();
    });

    if (tabInteger && tabFp) {
        tabInteger.addEventListener('click', () => setRegisterView('integer'));
        tabFp.addEventListener('click', () => setRegisterView('fp'));
    }

    toggleDataSegmentModeButton?.addEventListener('click', () => {
        dataSegmentDisplayMode = (dataSegmentDisplayMode === 'hex') ? 'ascii' : 'hex';
        renderDataSegmentTable();
    });

    if (goToDataSegmentAddressButton && dataSegmentAddressInput) {
        const goToAddress = () => {
            const addrStr = dataSegmentAddressInput.value.trim();
            if (!addrStr) return;
            try {
                const newAddr = addrStr.toLowerCase().startsWith('0x') ? parseInt(addrStr, 16) : parseInt(addrStr, 10);
                if (!isNaN(newAddr) && newAddr >= 0) {
                    dataSegmentStartAddress = Math.max(0, Math.floor(newAddr / bytesPerRow) * bytesPerRow);
                    renderDataSegmentTable();
                    setDataAddressValue(`0x${dataSegmentStartAddress.toString(16)}`);
                } else {
                    alert("Invalid address");
                }
            } catch (e) { alert("Error parsing address"); }
        };
        goToDataSegmentAddressButton.addEventListener('click', goToAddress);
        dataSegmentAddressInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') goToAddress();
        });
    }

    assembleButton?.addEventListener('click', handleAssemble);
    runButton?.addEventListener('click', handleRun);
    stepButton?.addEventListener('click', handleStep);
    resetButton?.addEventListener('click', handleReset);

    // [MỚI] Sự kiện thanh trượt tốc độ
    if (speedSlider && speedValueLabel) {
        speedSlider.addEventListener('input', () => {
            let val = speedSlider.value;
            if (val == 100) speedValueLabel.textContent = "Max";
            else speedValueLabel.textContent = val + "x";
        });
    }

    if (typeof mdc !== 'undefined') {
        mdc.autoInit();
        document.querySelectorAll('.mdc-button').forEach(btn => new mdc.ripple.MDCRipple(btn));
    }

    if (typeof simulator !== 'undefined') {
        simulator.reset();
        setDataAddressValue(`0x${dataSegmentStartAddress.toString(16)}`);
        setRegisterView('integer');
        updateUIGlobally();
        setupUARTCallbacks(); // Setup UART callbacks lần đầu
    }

    const sidebarItems = document.querySelectorAll('.sidebar-item');
    const viewSections = document.querySelectorAll('.view-section');

    sidebarItems.forEach(item => {
        item.addEventListener('click', () => {
            sidebarItems.forEach(i => i.classList.remove('active'));
            viewSections.forEach(v => v.classList.remove('active'));

            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');
            }

            if (targetId === 'view-editor' && instructionInput) {
                setTimeout(() => {
                    instructionInput.refresh();
                }, 10);
            }
        });
    });

    // Hiển thị tọa độ chuột trên LED Matrix Canvas
    const ledCanvas = document.getElementById('ledMatrixCanvas');
    const mouseCoordinatesDisplay = document.getElementById('mouseCoordinates');

    if (ledCanvas && mouseCoordinatesDisplay) {
        // Mouse move event
        ledCanvas.addEventListener('mousemove', (event) => {
            const rect = ledCanvas.getBoundingClientRect();
            const x = Math.floor(event.clientX - rect.left);
            const y = Math.floor(event.clientY - rect.top);
            mouseCoordinatesDisplay.textContent = `x=${x}, y=${y}`;
        });

        // Mouse click event - hiển thị tọa độ và log ra console
        ledCanvas.addEventListener('click', (event) => {
            const rect = ledCanvas.getBoundingClientRect();
            const x = Math.floor(event.clientX - rect.left);
            const y = Math.floor(event.clientY - rect.top);

            // Hiển thị trong UI
            mouseCoordinatesDisplay.textContent = `x=${x}, y=${y} (Clicked!)`;
            mouseCoordinatesDisplay.style.color = '#d63031';

            // Log ra console
            console.log(`Mouse clicked at: x=${x}, y=${y}`);

            // Reset màu sau 500ms
            setTimeout(() => {
                mouseCoordinatesDisplay.style.color = '#0984e3';
            }, 500);
        });

        // Mouse leave event - reset display
        ledCanvas.addEventListener('mouseleave', () => {
            mouseCoordinatesDisplay.textContent = 'x=0, y=0';
            mouseCoordinatesDisplay.style.color = '#0984e3';
        });
    }

    // [MỚI] UART Console handlers
    const uartOutput = document.getElementById('uartOutput');
    const uartInput = document.getElementById('uartInput');
    const uartSendButton = document.getElementById('uartSendButton');
    const uartClearButton = document.getElementById('uartClearButton');

    // Setup UART callbacks
    if (typeof simulator !== 'undefined' && simulator.mem && simulator.mem.uart) {
        const uart = simulator.mem.uart;

        // Callback khi UART transmit (CPU gửi dữ liệu)
        uart.onTransmit = function (charCode) {
            if (uartOutput) {
                const char = String.fromCharCode(charCode);
                uartOutput.textContent += char;
                // Auto scroll to bottom
                uartOutput.scrollTop = uartOutput.scrollHeight;
            }
        };
    }

    // Send button handler
    if (uartSendButton && uartInput) {
        uartSendButton.addEventListener('click', () => {
            const text = uartInput.value;
            if (text && simulator.mem && simulator.mem.uart) {
                simulator.mem.uart.addStringToRxBuffer(text + '\n');
                uartInput.value = '';
                console.log(`[UART] Sent to RX buffer: "${text}"`);
            }
        });
    }

    // Enter key to send
    if (uartInput) {
        uartInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' && simulator.mem && simulator.mem.uart) {
                const text = uartInput.value;
                simulator.mem.uart.addStringToRxBuffer(text + '\n');
                uartInput.value = '';
                console.log(`[UART] Sent to RX buffer: "${text}"`);
            }
        });
    }

    // Clear button handler
    if (uartClearButton && uartOutput) {
        uartClearButton.addEventListener('click', () => {
            uartOutput.textContent = '';
            if (simulator.mem && simulator.mem.uart) {
                simulator.mem.uart.clearTxBuffer();
            }
        });
    }
});