import { LEDMatrix } from './led_matrix.js';
import { UART } from './uart.js';
import { MousePeripheral } from './mouse.js';
import { Keyboard } from './keyboard.js';
import { TileLink_UH } from './tilelink_UH.js';
import { TileLink_UL } from './tilelink_UL.js';
import { TileLinkBridge } from './tilelink_bridge.js';
import { Mem } from './mem.js';
import { CPU } from './cpu.js';
import { DMAController } from './dma.js';
import { Cache } from './cache.js';
import { MMU } from './mmu.js';
import {
    TL_D_Opcode,
    applyTileLinkAtomic,
    getTransferSizeLog2,
    isTileLinkAtomic,
    isTileLinkRead,
    isTileLinkWrite
} from './tilelink.js';

const LED_BASE_ADDRESS = 0xFF000000;
const LED_SIZE_BYTES = 32 * 32 * 4;
const UART_BASE_ADDRESS = 0x10000000;
const MOUSE_BASE_ADDRESS = 0xFF100000;
const KEYBOARD_BASE_ADDRESS = 0xFFFF0000;
const DMA_REG_BASE_ADDRESS = 0xFFED0000;

function inRange(addr, base, size) {
    const address = addr >>> 0;
    const start = base >>> 0;
    return address >= start && address < (start + size);
}

function createMMIOEndpoint(bus, name, { read, write }) {
    return {
        directRead(address, size, accessType) {
            void accessType;
            return typeof read === 'function' ? (read(address, size) ?? 0) : 0;
        },
        directWrite(address, value, size, accessType) {
            void size;
            void accessType;
            if (typeof write === 'function') write(address, value);
        },
        receiveRequest(req) {
            const size = getTransferSizeLog2(req, 2);
            let data = 0;
            let responseType = TL_D_Opcode.AccessAck;

            if (isTileLinkRead(req.type)) {
                data = this.directRead(req.address, size, req.type);
                responseType = TL_D_Opcode.AccessAckData;
            } else if (isTileLinkWrite(req.type)) {
                this.directWrite(req.address, req.value ?? 0, size, req.type);
            } else if (isTileLinkAtomic(req.type)) {
                data = this.directRead(req.address, size, req.type);
                const nextValue = applyTileLinkAtomic(req, data, size);
                this.directWrite(req.address, nextValue, size, req.type);
                responseType = TL_D_Opcode.AccessAckData;
            } else {
                console.warn(`[SoC] Unsupported request type ${req.type} for ${name}`);
            }

            bus.sendResponse({
                from: name,
                to: req.from,
                type: responseType,
                data,
                address: req.address >>> 0,
                size
            });
        }
    };
}

export const simulator = {
    cpu: null,
    mmu: null,
    cache: null,
    mem: null,
    dma: null,
    tilelink_UH: null,
    tilelink_UL: null,
    uhToUlBridge: null,
    ulToUhBridge: null,
    ledMatrix: null,
    uart: null,
    mouse: null,
    keyboard: null,
    cycleCount: 0,
    useCache: true,

    setCacheEnabled(enabled) {
        this.useCache = !!enabled;
        this.reset();
    },

    reset() {
        const isBrowser = typeof document !== 'undefined';

        let ledMatrix = null;
        if (isBrowser) {
            ledMatrix = new LEDMatrix('ledMatrixCanvas', 32, 32, LED_BASE_ADDRESS);
        }

        const keyboard = new Keyboard(KEYBOARD_BASE_ADDRESS);
        if (isBrowser) {
            const kbInput = document.getElementById('keyboardInput');
            if (kbInput) {
                kbInput.addEventListener('keydown', (e) => {
                    e.preventDefault();
                    if (e.key.length === 1) {
                        keyboard.pressKey(e.key.charCodeAt(0));
                    } else if (e.key === 'Enter') {
                        keyboard.pressKey(10);
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

        const uart = new UART(UART_BASE_ADDRESS);
        const mouse = new MousePeripheral(MOUSE_BASE_ADDRESS);

        this.cpu = new CPU();
        this.tilelink_UH = new TileLink_UH();
        this.tilelink_UL = new TileLink_UL();

        const mainMemoryLatency = 5;
        this.mem = new Mem({ latency: mainMemoryLatency });

        const uartRange = (addr) => inRange(addr, UART_BASE_ADDRESS, 0x14);
        const mouseRange = (addr) => inRange(addr, MOUSE_BASE_ADDRESS, 0x14);
        const keyboardRange = (addr) => inRange(addr, KEYBOARD_BASE_ADDRESS, 0x08);
        const ledRange = (addr) => inRange(addr, LED_BASE_ADDRESS, LED_SIZE_BYTES);
        const dmaRegRange = (addr) => inRange(addr, DMA_REG_BASE_ADDRESS, 0x08);

        const isUlPeripheralAddress = (addr) =>
            uartRange(addr) ||
            mouseRange(addr) ||
            keyboardRange(addr) ||
            ledRange(addr);

        const isCacheableAddress = (addr) =>
            !isUlPeripheralAddress(addr) && !dmaRegRange(addr);

        const cacheConfig = {
            cacheSize: 1024,
            blockSize: 16,
            associativity: 2,
            numSets: 32,
            hitLatency: 1,
            missLatency: mainMemoryLatency
        };

        this.cache = new Cache(this.tilelink_UH, cacheConfig, null, {
            writeBack: false,
            writeAllocate: true,
            isCacheable: isCacheableAddress
        });
        this.cache.setEnabled(this.useCache);

        this.mmu = new MMU(this.cpu, this.cache, {
            cacheabilityPredicate: isCacheableAddress
        });

        this.dma = new DMAController({
            tilelink_UH: this.tilelink_UH,
            tilelink_UL: this.tilelink_UL,
            registerLink: this.tilelink_UH,
            selectLinkForAddress: (addr) => isUlPeripheralAddress(addr) ? this.tilelink_UL : this.tilelink_UH
        });

        this.uhToUlBridge = new TileLinkBridge(this.tilelink_UH, this.tilelink_UL, {
            name: 'uh-to-ul-bridge'
        });
        this.ulToUhBridge = new TileLinkBridge(this.tilelink_UL, this.tilelink_UH, {
            name: 'ul-to-uh-bridge'
        });

        const uartEndpoint = createMMIOEndpoint(this.tilelink_UL, 'uart', {
            read: (addr) => uart.readRegister(addr),
            write: (addr, value) => uart.writeRegister(addr, value)
        });

        const mouseEndpoint = createMMIOEndpoint(this.tilelink_UL, 'mouse', {
            read: (addr) => mouse.readRegister(addr),
            write: (addr, value) => mouse.writeRegister(addr, value)
        });

        const keyboardEndpoint = createMMIOEndpoint(this.tilelink_UL, 'keyboard', {
            read: (addr) => keyboard.readRegister(addr),
            write: (addr, value) => keyboard.writeRegister(addr, value)
        });

        const ledEndpoint = createMMIOEndpoint(this.tilelink_UL, 'led-matrix', {
            read: () => 0,
            write: (addr, value) => {
                if (ledMatrix) {
                    ledMatrix.writeWord(addr, value >>> 0);
                }
            }
        });

        this.tilelink_UH.registerSlave('main-memory', this.mem, (addr) => isCacheableAddress(addr));
        this.tilelink_UH.registerSlave('dma-regs', this.dma, (addr) => dmaRegRange(addr));
        this.tilelink_UH.registerSlave('uh-to-ul-bridge', this.uhToUlBridge, (addr) => isUlPeripheralAddress(addr));
        this.tilelink_UH.attachMemoryTarget(this.mem);

        this.tilelink_UL.registerSlave('uart', uartEndpoint, uartRange);
        this.tilelink_UL.registerSlave('mouse', mouseEndpoint, mouseRange);
        this.tilelink_UL.registerSlave('keyboard', keyboardEndpoint, keyboardRange);
        this.tilelink_UL.registerSlave('led-matrix', ledEndpoint, ledRange);
        this.tilelink_UL.registerSlave('ul-to-uh-bridge', this.ulToUhBridge, (addr) => !isUlPeripheralAddress(addr));
        this.tilelink_UL.attachMemoryTarget(this.mem);

        this.tilelink_UH.registerMaster('dma', this.dma);
        this.tilelink_UL.registerMaster('dma', this.dma);

        this.cpu.bus = this.mmu;
        this.mmu.attachCPU(this.cpu);
        this.mmu.attachLowerPort(this.cache);

        this.ledMatrix = ledMatrix;
        this.uart = uart;
        this.mouse = mouse;
        this.keyboard = keyboard;
        this.cycleCount = 0;

        if (this.ledMatrix) this.ledMatrix.reset();
        if (this.uart) this.uart.reset();
        if (this.mouse) this.mouse.reset();
        if (this.keyboard) this.keyboard.reset();
        if (this.cache) this.cache.reset();
        if (this.mmu) this.mmu.reset();

        console.info('[ARCH] CPU -> MMU -> L1 Cache -> TileLink-UH');
        console.info('[ARCH] TileLink-UH <-> TileLink-UL through bus bridge');
        console.info('[ARCH] DMA Controller attached to both TileLink-UH and TileLink-UL');
        console.info('[IO MAP] LED Matrix: 0xFF000000-0xFF000FFF');
        console.info('[IO MAP] Mouse:      0xFF100000-0xFF100013');
        console.info('[IO MAP] UART:       0x10000000-0x10000013');
        console.info('[IO MAP] Keyboard:   0xFFFF0000-0xFFFF0007');
        console.info('[IO MAP] DMA Regs:   0xFFED0000-0xFFED0007');
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
            console.log('Simulation halted.');
            return;
        }

        try {
            if (cpuActive) {
                this.cpu.tick(this.mmu);
            }
        } catch (e) {
            this.cpu.isRunning = false;
            console.error(e);
        }

        if (this.dma) {
            this.dma.tick();
        }

        this.tilelink_UH.tick();
        this.tilelink_UL.tick();
        this.mem.tick(this.tilelink_UH);
        this.cache.tick();
        this.tilelink_UH.tick();
        this.tilelink_UL.tick();

        console.log(
            `[Cycle ${this.cycleCount + 1}] CPU active=${cpuActive} pc=0x${this.cpu.pc.toString(16)} ` +
            `| DMA busy=${this.dma?.registers?.busy ?? false} ` +
            `progress=${this.dma?.transferProgress ?? 0}/${this.dma?.numElements ?? 0}`
        );

        if (this.uart) {
            this.uart.tick();
        }

        this.cycleCount++;
    }
};

simulator.reset();
