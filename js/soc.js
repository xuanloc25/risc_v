// simulator.js rebuilt to only expose simulator and import modular components
import { LEDMatrix } from './led_matrix.js';
import { UART } from './uart.js';
import { MousePeripheral } from './mouse.js';
import { Keyboard } from './keyboard.js';
import { TileLinkBus } from './bus.js';
import { TileLinkULMemory } from './mem.js';
import { TileLinkCPU } from './cpu.js';
import { DMAController } from './dma.js';

// --- Simulator ---
export const simulator = {
    cpu: null,
    bus: null,
    mem: null,
    tilelinkMem: null, // Để tương thích với code cũ
    dma: null, // Thêm DMA controller
    ledMatrix: null,
    uart: null,
    mouse: null,
    keyboard: null,
    cycleCount: 0,

    reset() {
        // Khởi tạo ngoại vi và gắn lên simulator để dễ truy cập bên ngoài
        const isBrowser = typeof document !== 'undefined';

        let ledMatrix = null;
        let keyboard = null;

        if (isBrowser) {
            ledMatrix = new LEDMatrix('ledMatrixCanvas', 32, 32, 0xFF000000);
            keyboard = new Keyboard(0xFFFF0000);

            const kbInput = document.getElementById('keyboardInput');
            if (kbInput) {
                kbInput.addEventListener('keydown', (e) => {
                    e.preventDefault();
                    if (e.key.length === 1) {
                        keyboard.pressKey(e.key.charCodeAt(0));
                    } else if (e.key === 'Enter') {
                        keyboard.pressKey(10); // \n
                    }
                });

                keyboard.onUpdate = () => {
                    const statusSpan = document.getElementById('keyboardStatus');
                    if (statusSpan) {
                        statusSpan.textContent = keyboard.buffer.length > 0 ? 'Data Available' : 'Empty';
                        statusSpan.style.color = keyboard.buffer.length > 0 ? '#00b894' : '#666';
                    }
                };
            }
        }

        const uart = new UART(0x10000000);
        const mouse = new MousePeripheral(0xFF100000);

        this.cpu = new TileLinkCPU();
        this.bus = new TileLinkBus();
        this.mem = new TileLinkULMemory({ ledMatrix, uart, mouse, keyboard });
        this.tilelinkMem = this.mem; // Cho phép code cũ truy cập simulator.tilelinkMem
        this.dma = new DMAController(this.mem.mem); // Khởi tạo DMA controller
        this.ledMatrix = ledMatrix;
        this.uart = uart;
        this.mouse = mouse;
        this.keyboard = keyboard;
        this.cycleCount = 0;

        console.info('[IO MAP] LED Matrix: 0xFF000000-0xFF000FFF (write VRAM)');
        console.info('[IO MAP] Mouse:      0xFF100000-0xFF100013 (X/Y/BTN/STATUS/CTRL)');
        console.info('[IO MAP] UART:       0x10000000-0x10000013 (TX/RX/STATUS/CTRL/BAUD)');
    },
    loadProgram(programData) {
        this.cpu.loadProgram(programData, this.mem);
        this.cpu.isRunning = true;
        this.dma.memory = this.mem.mem; // Đảm bảo DMA dùng vùng nhớ mới nhất
    },
    tick() {
        // Nếu CPU dừng và DMA không chạy thì dừng hoàn toàn
        if (this.cpu.isRunning === false && (!this.dma || !this.dma.registers?.busy)) {
            console.log("Simulation halted.");
            return;
        }
        // Nếu CPU dừng nhưng DMA vẫn đang chạy thì chỉ tick DMA
        if (this.cpu.isRunning === false && this.dma && this.dma.registers?.busy) {
            this.dma.tick();
            this.cycleCount++;
            return;
        }
        try {
            if (this.cpu.isRunning) {
                this.cpu.tick(this.bus);
                console.log(`[Cycle ${this.cycleCount + 1}] BUS request:`, this.bus.request, "BUS response:", this.bus.response);
                this.bus.tick(this.cpu, this.mem);
                console.log(`[Cycle ${this.cycleCount + 1}] MEM pendingRequest:`, this.mem.pendingRequest);
                this.mem.tick(this.bus);
                console.log(`[Cycle ${this.cycleCount + 1}] CPU waitingRequest:`, this.cpu.waitingRequest, "CPU pendingResponse:", this.cpu.pendingResponse);
            }
        } catch (e) {
            this.cpu.isRunning = false;
            console.error(e);
        }
        
        // Tick UART TRƯỚC khi tick DMA (để update timing mỗi cycle)
        if (this.mem && this.mem.uart) {
            this.mem.uart.tick();
        }
        
        if (this.cpu.isRunning && this.dma) {
            console.log(`[SIMULATOR] DMA tick: busy=${this.dma.registers?.busy}, enabled=${this.dma.registers?.enabled}`);
            this.dma.tick();
        }
        
        this.cycleCount++;
    }
};

simulator.reset();
console.log("DMA memory === MEM memory:", simulator.dma.memory === simulator.mem.mem);
console.log("MEM memory === tilelinkMem memory:", simulator.mem.mem === simulator.tilelinkMem.mem);