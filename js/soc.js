// simulator.js rebuilt to only expose simulator and import modular components
import { LEDMatrix } from './led_matrix.js';
import { UART } from './uart.js';
import { MousePeripheral } from './mouse.js';
import { Keyboard } from './keyboard.js';
import { Bus } from './bus.js';
import { Mem } from './mem.js';
import { CPU } from './cpu.js';
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

        this.cpu = new CPU();
        this.bus = new Bus();
        this.mem = new Mem({ ledMatrix, uart, mouse, keyboard });
        this.tilelinkMem = this.mem; // Cho phép code cũ truy cập simulator.tilelinkMem
        this.dma = new DMAController(this.bus); // DMA now issues transfers through the bus

        // Bus nắm quyền truy cập bộ nhớ, CPU chỉ đi qua bus
        this.bus.registerSlave('mem', this.mem, () => true);
        this.bus.registerSlave('dma-regs', this.dma, (addr) => (addr >>> 0) >= 0xFFED0000 && (addr >>> 0) <= 0xFFED0007);
        this.bus.registerMaster('cpu', this.cpu);
        this.bus.registerMaster('dma', this.dma);

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
        if (programData.memory) {
            this.mem.loadMemoryMap(programData.memory);
        }
        this.cpu.loadProgram(programData);
        this.cpu.isRunning = true;
    },
    tick() {
        const cpuActive = this.cpu.isRunning;
        const dmaActive = this.dma?.registers?.busy;

        if (!cpuActive && !dmaActive) {
            console.log("Simulation halted.");
            return;
        }

        try {
            if (cpuActive) {
                this.cpu.tick(this.bus);
            }
        } catch (e) {
            this.cpu.isRunning = false;
            console.error(e);
        }

        // DMA produces bus traffic even when CPU is idle
        if (this.dma) {
            this.dma.tick();
        }

        // First arbitration/issue stage
        this.bus.tick();
        // Memory services the issued request
        this.mem.tick(this.bus);
        // Route memory response back to masters in the same cycle if available
        this.bus.tick();

        // Simple cycle log showing CPU and DMA status
        console.log(`[Cycle ${this.cycleCount + 1}] CPU active=${cpuActive} pc=0x${this.cpu.pc.toString(16)} | DMA busy=${this.dma?.registers?.busy ?? false} progress=${this.dma?.transferProgress ?? 0}/${this.dma?.numElements ?? 0}`);

        // Peripheral timing (UART)
        if (this.mem && this.mem.uart) {
            this.mem.uart.tick();
        }

        this.cycleCount++;
    }
};

simulator.reset();
