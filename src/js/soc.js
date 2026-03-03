// simulator.js rebuilt to only expose simulator and import modular components
import { LEDMatrix } from './led_matrix.js';
import { UART } from './uart.js';
import { MousePeripheral } from './mouse.js';
import { Keyboard } from './keyboard.js';
import { Bus } from './bus.js';
import { Mem } from './mem.js';
import { CPU } from './cpu.js';
import { DMAController } from './dma.js';
import { Cache } from './cache.js';

// --- Simulator ---
export const simulator = {
    cpu: null,
    bus: null,
    mem: null,
    cache: null,
    tilelinkMem: null, // Để tương thích với code cũ
    dma: null, // Thêm DMA controller
    ledMatrix: null,
    uart: null,
    mouse: null,
    keyboard: null,
    cycleCount: 0,
    useCache: true,
    memLatency: 5, // hệ số độ trễ RAM (chu kỳ)

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
        // SRAM-like main memory; latency modeled in cache miss path if needed
        this.mem = new Mem({ latency: this.memLatency });
        this.cache = new Cache(this.mem, {
            cacheSize: 4096,
            blockSize: 32,
            associativity: 4,
            hitLatency: 1,
            missLatency: 2 // 
        });
        this.tilelinkMem = this.mem; 
        this.dma = new DMAController(this.bus); // DMA now issues transfers through the bus

        // Helpers for address decode and MMIO registration
        const bus = this.bus;
        const inRange = (addr, base, size) => {
            const a = addr >>> 0;
            const b = base >>> 0;
            return a >= b && a < (b + size);
        };

        const uartRange = (addr) => inRange(addr, uart.baseAddress, 0x14);
        const mouseRange = (addr) => inRange(addr, mouse.baseAddress, 0x14);
        const keyboardRange = (addr) => keyboard ? inRange(addr, keyboard.baseAddress, 0x08) : false;
        const ledRange = (addr) => ledMatrix ? inRange(addr, ledMatrix.baseAddress, ledMatrix.sizeInBytes) : false;
        const dmaRegRange = (addr) => inRange(addr, 0xFFED0000, 0x8);

        const isPeripheralAddress = (addr) =>
            uartRange(addr) ||
            mouseRange(addr) ||
            keyboardRange(addr) ||
            ledRange(addr) ||
            dmaRegRange(addr);
            
        //cheat ready/valid, will update later
        const registerMMIOSlave = (name, matchFn, { read, write }) => {
            bus.registerSlave(name, {
                receiveRequest: (req) => {
                    let data = 0;
                    if (req.type === 'read' || req.type === 'fetch') {
                        data = typeof read === 'function' ? read(req.address, req.type) : 0;
                    } else if (req.type === 'write') {
                        if (typeof write === 'function') write(req.address, req.value, req.type);
                    } else if (req.type === 'readByte' || req.type === 'readHalf') {
                        data = typeof read === 'function' ? read(req.address, req.type) : 0;
                    } else if (req.type === 'writeByte' || req.type === 'writeHalf') {
                        if (typeof write === 'function') write(req.address, req.value, req.type);
                    } else {
                        console.warn(`[SoC] Unsupported request type ${req.type} for ${name}`);
                    }
                    bus.sendResponse({ ...req, data });
                }
            }, matchFn);
        };

        // Bus nắm quyền truy cập bộ nhớ, CPU chỉ đi qua bus
        if (this.useCache) {
            this.bus.registerSlave('cache', this.cache, (addr) => !isPeripheralAddress(addr));
        } else {
            this.bus.registerSlave('mem', this.mem, (addr) => !isPeripheralAddress(addr));
        }
        this.bus.registerSlave('dma-regs', this.dma, dmaRegRange);

        registerMMIOSlave('uart', uartRange, {
            read: (addr) => uart.readRegister(addr),
            write: (addr, val) => uart.writeRegister(addr, val)
        });

        registerMMIOSlave('mouse', mouseRange, {
            read: (addr) => mouse.readRegister(addr),
            write: (addr, val) => mouse.writeRegister(addr, val)
        });

        if (keyboard) {
            registerMMIOSlave('keyboard', keyboardRange, {
                read: (addr) => keyboard.readRegister(addr),
                write: (addr, val) => keyboard.writeRegister(addr, val)
            });
        }

        if (ledMatrix) {
            registerMMIOSlave('led-matrix', ledRange, {
                read: () => 0,
                write: (addr, val, type) => {
                    if (type === 'write') ledMatrix.writeWord(addr, val);
                }
            });
        }

        this.bus.registerMaster('cpu', this.cpu);
        this.bus.registerMaster('dma', this.dma);

        this.ledMatrix = ledMatrix;
        this.uart = uart;
        this.mouse = mouse;
        this.keyboard = keyboard;
        this.cycleCount = 0;

        // Ensure fresh peripheral state
        if (this.ledMatrix) this.ledMatrix.reset();
        if (this.uart) this.uart.reset();
        if (this.mouse) this.mouse.reset();
        if (this.keyboard) this.keyboard.reset();
        if (this.cache) this.cache.reset();

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
        const cycleId = this.cycleCount + 1;
        // Group logs per cycle (expanded by default to avoid missing logs)
        if (console.group) console.group(`[Cycle ${cycleId}]`);

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
        // Memory path: via cache or direct mem depending on flag
        if (this.useCache) {
            this.cache.tick(this.bus);
        } else {
            this.mem.tick(this.bus);
        }
        // Route memory response back to masters in the same cycle if available
        this.bus.tick();

        // Simple cycle log showing CPU and DMA status
        console.log(`[Cycle ${cycleId}] CPU active=${cpuActive} pc=0x${this.cpu.pc.toString(16)} | DMA busy=${this.dma?.registers?.busy ?? false} progress=${this.dma?.transferProgress ?? 0}/${this.dma?.numElements ?? 0}`);

        // Peripheral timing (UART)
        if (this.uart) {
            this.uart.tick();
        }

        this.cycleCount++;
        if (console.groupEnd) console.groupEnd();
    }
};

simulator.reset();
