import { CPU } from './cpu.js';
import { MMU } from './mmu.js';
import { SimpleCache } from './SimpleCache.js';
import { TileLink_UH } from './tilelink_UH.js';
import { Mem } from './mem.js';
import { TileLink_UL } from './tilelink_UL.js';
import { DMAController } from './dma.js';
import { TileLinkBridge } from './tilelink_bridge.js';
import { UART } from './uart.js';
import { LEDMatrix } from './led_matrix.js';
import { Keyboard } from './keyboard.js';
import { MousePeripheral } from './mouse.js';
import { Port, attachPort } from './port_link.js';
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
    iCache: null,
    dCache: null,
    l2Cache: null,
    tilelink_UH: null,
    mem: null,
    tilelink_UL: null,
    dma: null,
    uhToUlBridge: null,
    ulToUhBridge: null,
    uart: null,
    ledMatrix: null,
    keyboard: null,
    mouse: null,
    ports: null,
    cycleCount: 0,
    useCache: true,

    setCacheEnabled(enabled) {
        this.useCache = !!enabled;
        this.init();
    },

    init() {
        const isBrowser = typeof document !== 'undefined';

        let ledMatrix = null;
        if (isBrowser) {
            ledMatrix = new LEDMatrix('ledMatrixCanvas', 32, 32, LED_BASE_ADDRESS);
        }

        const uart = new UART(UART_BASE_ADDRESS);
        const keyboard = new Keyboard(KEYBOARD_BASE_ADDRESS);
        const mouse = new MousePeripheral(MOUSE_BASE_ADDRESS);

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

        const mainMemoryLatency = 20;
        const uartRange = (addr) => inRange(addr, UART_BASE_ADDRESS, 0x14);
        const ledRange = (addr) => inRange(addr, LED_BASE_ADDRESS, LED_SIZE_BYTES);
        const keyboardRange = (addr) => inRange(addr, KEYBOARD_BASE_ADDRESS, 0x08);
        const mouseRange = (addr) => inRange(addr, MOUSE_BASE_ADDRESS, 0x14);
        const dmaRegRange = (addr) => inRange(addr, DMA_REG_BASE_ADDRESS, 0x08);

        const isUlPeripheralAddress = (addr) =>
            uartRange(addr) ||
            ledRange(addr) ||
            keyboardRange(addr) ||
            mouseRange(addr);

        const isCacheableAddress = (addr) =>
            !isUlPeripheralAddress(addr) && !dmaRegRange(addr);

        this.tilelink_UH = new TileLink_UH();
        this.mem = new Mem({ latency: mainMemoryLatency });
        this.tilelink_UL = new TileLink_UL();

        // DMA and bridge sit beside the core path and connect into both fabrics.
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

        this.cpu = new CPU();
        this.mmu = new MMU(null, null, {
            cacheabilityPredicate: isCacheableAddress
        });
        const CacheConfigL1 = {
            numSets: 16,
            numWays: 4,
            blockSize: 16,
            hitLatency: 1,
            missLatency: 5,
            isCacheable: isCacheableAddress
        };
        const CacheConfigL2 = {
            numSets: 64,
            numWays: 4,
            blockSize: 16,
            hitLatency: 2,
            missLatency: 10,
            isCacheable: isCacheableAddress
        };
        this.iCache = new SimpleCache({
            ...CacheConfigL1,
            name: 'l1i-cache'
        });
        this.dCache = new SimpleCache({
            ...CacheConfigL1,
            name: 'l1d-cache'
        });
        this.l2Cache = new SimpleCache({
            ...CacheConfigL2,
            name: 'l2-cache'
        });

        //const l1iToL2Port = this.l2Cache;
        //const l1dToL2Port = this.l2Cache;
        const cpuToMmuPort = attachPort(this.cpu, this.mmu, 'cpu-to-mmu');
        const l2ToUhPort = attachPort(this.l2Cache, this.tilelink_UH, 'l2-to-uh');

        this.iCache.attachLowerPort(this.l2Cache);
        this.dCache.attachLowerPort(this.l2Cache);
        this.iCache.setEnabled(this.useCache);
        this.dCache.setEnabled(this.useCache);
        this.l2Cache.setEnabled(this.useCache);

        // MMU route riêng luồng fetch và data access xuống hai L1 độc lập.
        this.mmu.attachInstructionLowerPort(this.iCache);
        this.mmu.attachDataLowerPort(this.dCache);

        const uartEndpoint = createMMIOEndpoint(this.tilelink_UL, 'uart', {
            read: (addr) => uart.readRegister(addr),
            write: (addr, value) => uart.writeRegister(addr, value)
        });

        const ledEndpoint = createMMIOEndpoint(this.tilelink_UL, 'led-matrix', {
            read: () => 0,
            write: (addr, value) => {
                if (ledMatrix) {
                    ledMatrix.writeWord(addr, value >>> 0);
                }
            }
        });

        const keyboardEndpoint = createMMIOEndpoint(this.tilelink_UL, 'keyboard', {
            read: (addr) => keyboard.readRegister(addr),
           
            write: (addr, value) => keyboard.writeRegister(addr, value)
        });

        const mouseEndpoint = createMMIOEndpoint(this.tilelink_UL, 'mouse', {
            read: (addr) => mouse.readRegister(addr),
            write: (addr, value) => mouse.writeRegister(addr, value)
        });

        this.ports = {
            cpuToMmu: cpuToMmuPort,
            mmuToL1I: this.iCache,
            mmuToL1D: this.dCache,
            l1iToL2: this.l2Cache,
            l1dToL2: this.l2Cache,
            l2ToUh: l2ToUhPort,
            uhToMainMemory: attachPort(this.tilelink_UH, Port.lower('main-memory', this.mem, (addr) => isCacheableAddress(addr))),
            uhToDmaRegs: attachPort(this.tilelink_UH, Port.lower('dma-regs', this.dma, (addr) => dmaRegRange(addr))),
            uhToUlBridge: attachPort(this.tilelink_UH, Port.lower('uh-to-ul-bridge', this.uhToUlBridge, (addr) => isUlPeripheralAddress(addr))),
            uhToDma: attachPort(this.tilelink_UH, Port.upper('dma', this.dma)),
            uhMemoryView: attachPort(this.tilelink_UH, Port.memory('main-memory-view', this.mem)),
            ulToUart: attachPort(this.tilelink_UL, Port.lower('uart', uartEndpoint, uartRange)),
            ulToLedMatrix: attachPort(this.tilelink_UL, Port.lower('led-matrix', ledEndpoint, ledRange)),
            ulToKeyboard: attachPort(this.tilelink_UL, Port.lower('keyboard', keyboardEndpoint, keyboardRange)),
            ulToMouse: attachPort(this.tilelink_UL, Port.lower('mouse', mouseEndpoint, mouseRange)),
            ulToUhBridge: attachPort(this.tilelink_UL, Port.lower('ul-to-uh-bridge', this.ulToUhBridge, (addr) => !isUlPeripheralAddress(addr))),
            ulToDma: attachPort(this.tilelink_UL, Port.upper('dma', this.dma))
        };

        this.uart = uart;
        this.ledMatrix = ledMatrix;
        this.keyboard = keyboard;
        this.mouse = mouse;
        this.cycleCount = 0;

        // Khôi phục trạng thái ban đầu cho các module và thiết bị ngoại vi
        if (this.ledMatrix) this.ledMatrix.reset();
        if (this.uart) this.uart.reset();
        if (this.mouse) this.mouse.reset();
        if (this.keyboard) this.keyboard.reset();
        if (this.iCache) this.iCache.reset();
        if (this.dCache) this.dCache.reset();
        if (this.l2Cache) this.l2Cache.reset();
        if (this.mmu) this.mmu.reset();

        console.info('[ARCH] CPU -> MMU -> L1I/L1D -> L2 cache -> memory/MMIO');
        console.info('[CACHE] L1I: 16 sets x 4 ways, L1D: 16 sets x 4 ways, L2: 64 sets x 4 ways');
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
        const currentCycle = this.cycleCount + 1;

        if (!cpuActive && !dmaActive) {
            console.log('Simulation halted.');
            return;
        }

        console.log(
            `[Cycle ${currentCycle}] CPU active=${cpuActive} pc=0x${this.cpu.pc.toString(16)} ` +
            `| DMA busy=${this.dma?.registers?.busy ?? false} ` +
            `progress=${this.dma?.transferProgress ?? 0}/${this.dma?.numElements ?? 0}`
        );

        try {
            if (cpuActive) {
                this.cpu.tick();
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
        this.iCache.tick();
        this.dCache.tick();
        this.l2Cache.tick();
        this.tilelink_UH.tick();
        this.tilelink_UL.tick();

        if (this.uart) {
            this.uart.tick();
        }

        this.cycleCount++;
    }
};

simulator.init();
