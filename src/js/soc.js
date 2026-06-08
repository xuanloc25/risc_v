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
import { Port, attachPort, attachInstructionPort, attachDataPort } from './port_link.js';
import {
    TL_A_Opcode,
    TL_D_Opcode,
    applyTileLinkAtomic,
    getOpcodeName,
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

const LINK_COMPONENTS = {
    cpuToMmu: { src: 'CPU', dst: 'MMU' },
    mmuToL1I: { src: 'MMU', dst: 'L1I Cache' },
    mmuToL1D: { src: 'MMU', dst: 'L1D Cache' },
    l1iToL2: { src: 'L1I Cache', dst: 'L2 Cache' },
    l1dToL2: { src: 'L1D Cache', dst: 'L2 Cache' },
    l2ToUh: { src: 'L2 Cache', dst: 'TileLink-UH' },
    uhToMainMemory: { src: 'TileLink-UH', dst: 'Main Memory' },
    uhToDma: { src: 'DMA', dst: 'TileLink-UH' },
    uhToDmaRegs: { src: 'TileLink-UH', dst: 'DMA' },
    uhToUlBridge: { src: 'TileLink-UH', dst: 'Bridge (UH->UL)' },
    ulToUhBridge: { src: 'TileLink-UL', dst: 'Bridge (UL->UH)' },
    ulToUart: { src: 'TileLink-UL', dst: 'UART' },
    ulToLedMatrix: { src: 'TileLink-UL', dst: 'LED Matrix' },
    ulToKeyboard: { src: 'TileLink-UL', dst: 'Keyboard' },
    ulToMouse: { src: 'TileLink-UL', dst: 'Mouse' },
    ulToDma: { src: 'TileLink-UL', dst: 'DMA' }
};

const MMU_PAGE_SIZE_OPTIONS = [1024, 2048, 4096, 8192];
const MMU_TLB_SIZE_OPTIONS = [4, 8, 16, 32];
const MMU_TLB_WAY_OPTIONS = [2, 4, 'fully'];

function inRange(addr, base, size) {
    const address = addr >>> 0;
    const start = base >>> 0;
    return address >= start && address < (start + size);
}

function readStoredNumber(key, fallback, allowedValues) {
    if (typeof localStorage === 'undefined') return fallback;
    const value = Number.parseInt(localStorage.getItem(key) ?? '', 10);
    if (!Number.isFinite(value)) return fallback;
    if (Array.isArray(allowedValues) && !allowedValues.includes(value)) return fallback;
    return value;
}

function readStoredTlbWays(tlbSize) {
    if (typeof localStorage === 'undefined') return 4;
    const rawValue = localStorage.getItem('mmu_tlb_ways') ?? '4';
    const value = rawValue === 'fully' ? 'fully' : Number.parseInt(rawValue, 10);
    if (!MMU_TLB_WAY_OPTIONS.includes(value)) return 4;

    const waysValue = value === 'fully' ? tlbSize : value;
    if (waysValue > tlbSize || tlbSize % waysValue !== 0) return 4;
    return value;
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

let _stalledSince = null; // { pc } — tracks current stall for log dedup

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
        _stalledSince = null;
        const isBrowser = typeof document !== 'undefined';

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

        this.addressMap = [
            {
                name: 'Main Memory / RAM',
                description: 'All non-MMIO addresses',
                cacheable: true,
                fabric: 'TileLink-UH'
            },
            {
                name: 'UART',
                base: UART_BASE_ADDRESS,
                size: 0x14,
                cacheable: false,
                fabric: 'TileLink-UL'
            },
            {
                name: 'LED Matrix',
                base: LED_BASE_ADDRESS,
                size: LED_SIZE_BYTES,
                cacheable: false,
                fabric: 'TileLink-UL'
            },
            {
                name: 'Mouse',
                base: MOUSE_BASE_ADDRESS,
                size: 0x14,
                cacheable: false,
                fabric: 'TileLink-UL'
            },
            {
                name: 'Keyboard',
                base: KEYBOARD_BASE_ADDRESS,
                size: 0x08,
                cacheable: false,
                fabric: 'TileLink-UL'
            },
            {
                name: 'DMA Registers',
                base: DMA_REG_BASE_ADDRESS,
                size: 0x08,
                cacheable: false,
                fabric: 'TileLink-UH'
            }
        ];

        // CPU
        this.cpu = new CPU();

        // MMU
        const mmuPageSize = isBrowser
            ? readStoredNumber('mmu_page_size', 4096, MMU_PAGE_SIZE_OPTIONS)
            : 4096;
        const mmuTlbSize = isBrowser
            ? readStoredNumber('mmu_tlb_size', 8, MMU_TLB_SIZE_OPTIONS)
            : 8;
        const mmuTlbWays = isBrowser ? readStoredTlbWays(mmuTlbSize) : 4;
        this.mmu = new MMU(null, null, {
            pageSize: mmuPageSize,
            tlbSize: mmuTlbSize,
            tlbWays: mmuTlbWays,
            cacheabilityPredicate: isCacheableAddress
        });

        // Cache
        const CacheConfigL1 = {
            numSets: 16,
            numWays: 4,
            blockSize: 64,
            hitLatency: 1,
            missLatency: 5,
            isCacheable: isCacheableAddress
        };
        const CacheConfigL2 = {
            numSets: 64,
            numWays: 4,
            blockSize: 64,
            hitLatency: 2,
            missLatency: 10,
            isCacheable: isCacheableAddress
        };
        this.iCache = new SimpleCache({ ...CacheConfigL1, name: 'L1I Cache' });
        this.dCache = new SimpleCache({ ...CacheConfigL1, name: 'L1D Cache' });
        this.l2Cache = new SimpleCache({ ...CacheConfigL2, name: 'L2 Cache' });
        this.iCache.setEnabled(this.useCache);
        this.dCache.setEnabled(this.useCache);
        this.l2Cache.setEnabled(this.useCache);

        // TileLink-UH
        this.tilelink_UH = new TileLink_UH();

        // RAM, DMA, Bridge, TileLink-UL
        const mainMemoryLatency = 20;
        this.mem = new Mem({ latency: mainMemoryLatency, name: 'Main Memory' });
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

        // IO
        this.ledMatrix = isBrowser ? new LEDMatrix('ledMatrixCanvas', 32, 32, LED_BASE_ADDRESS) : null;
        this.uart = new UART(UART_BASE_ADDRESS);
        this.keyboard = new Keyboard(KEYBOARD_BASE_ADDRESS);
        this.mouse = new MousePeripheral(MOUSE_BASE_ADDRESS);
        this.cycleCount = 0;
        

        if (isBrowser) {
            const kbInput = document.getElementById('keyboardInput');
            if (kbInput) {
                if (!kbInput.__riscvKeyboardHandlerAttached) {
                    kbInput.addEventListener('keydown', (e) => {
                        e.preventDefault();
                        if (e.key.length === 1) {
                            this.keyboard.pressKey(e.key.charCodeAt(0));
                        } else if (e.key === 'Enter') {
                            this.keyboard.pressKey(10);
                        }
                    });
                    kbInput.__riscvKeyboardHandlerAttached = true;
                }

                this.keyboard.onUpdate = () => {
                    const statusSpan = document.getElementById('keyboardStatus');
                    if (statusSpan) {
                        statusSpan.textContent = this.keyboard.buffer.length > 0 ? 'Data Available' : 'Empty';
                        statusSpan.style.color = this.keyboard.buffer.length > 0 ? '#00b894' : '#666';
                    }
                };
            }
        }

        const uartEndpoint = createMMIOEndpoint(this.tilelink_UL, 'UART', {
            read: (addr) => this.uart.readRegister(addr),
            write: (addr, value) => this.uart.writeRegister(addr, value)
        });

        const ledEndpoint = createMMIOEndpoint(this.tilelink_UL, 'LED Matrix', {
            read: () => 0,
            write: (addr, value) => {
                if (this.ledMatrix) {
                    this.ledMatrix.writeWord(addr, value >>> 0);
                }
            }
        });

        const keyboardEndpoint = createMMIOEndpoint(this.tilelink_UL, 'Keyboard', {
            read: (addr) => this.keyboard.readRegister(addr),
            write: (addr, value) => this.keyboard.writeRegister(addr, value)
        });

        const mouseEndpoint = createMMIOEndpoint(this.tilelink_UL, 'Mouse', {
            read: (addr) => this.mouse.readRegister(addr),
            write: (addr, value) => this.mouse.writeRegister(addr, value)
        });

        this.ports = {
            cpuToMmu: attachPort(this.cpu, this.mmu, 'cpu-to-mmu'),
            mmuToL1I: attachInstructionPort(this.mmu, this.iCache, 'mmu-to-l1i'),
            mmuToL1D: attachDataPort(this.mmu, this.dCache, 'mmu-to-l1d'),
            l1iToL2: attachPort(this.iCache, this.l2Cache, 'l1i-to-l2'),
            l1dToL2: attachPort(this.dCache, this.l2Cache, 'l1d-to-l2'),
            l2ToUh: attachPort(this.l2Cache, this.tilelink_UH, 'l2-to-tilelink-uh'),
            uhToMainMemory: attachPort(this.tilelink_UH, Port.lower('Main Memory', this.mem, (addr) => isCacheableAddress(addr))),
            uhToDmaRegs: attachPort(this.tilelink_UH, Port.lower('DMA Controller', this.dma, (addr) => dmaRegRange(addr))),
            uhToUlBridge: attachPort(this.tilelink_UH, Port.lower('uh-to-ul-bridge', this.uhToUlBridge, (addr) => isUlPeripheralAddress(addr))),
            uhToDma: attachPort(this.tilelink_UH, Port.upper('dma', this.dma)),
            uhMemoryView: attachPort(this.tilelink_UH, Port.memory('main-memory-view', this.mem)),
            ulToUart: attachPort(this.tilelink_UL, Port.lower('UART', uartEndpoint, uartRange)),
            ulToLedMatrix: attachPort(this.tilelink_UL, Port.lower('LED Matrix', ledEndpoint, ledRange)),
            ulToKeyboard: attachPort(this.tilelink_UL, Port.lower('Keyboard', keyboardEndpoint, keyboardRange)),
            ulToMouse: attachPort(this.tilelink_UL, Port.lower('Mouse', mouseEndpoint, mouseRange)),
            ulToUhBridge: attachPort(this.tilelink_UL, Port.lower('ul-to-uh-bridge', this.ulToUhBridge, (addr) => !isUlPeripheralAddress(addr))),
            ulToDma: attachPort(this.tilelink_UL, Port.upper('dma', this.dma))
        };


        console.info('[ARCH] RISC-V Core -> MMU -> Cache -> TileLink-UH -> Main Memory');
        console.info('[CACHE] L1I: 16 sets x 4 ways, L1D: 16 sets x 4 ways, L2: 64 sets x 4 ways');
        console.info('[ARCH] TileLink-UH <-> TileLink-UL; DMA Controller attached to both links');
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

    stepInstruction(maxCycles = 100000) {
        if (!this.cpu.isRunning) {
            return {
                completed: false,
                cycles: 0,
                halted: true,
                instructionCount: this.cpu.instructionCount
            };
        }

        const startInstructionCount = this.cpu.instructionCount;
        let cycles = 0;

        while (this.cpu.isRunning && this.cpu.instructionCount === startInstructionCount) {
            this.tick();
            cycles++;

            if (cycles >= maxCycles) {
                throw new Error(`Step exceeded ${maxCycles} cycles before completing an instruction.`);
            }
        }

        return {
            completed: this.cpu.instructionCount > startInstructionCount,
            cycles,
            halted: !this.cpu.isRunning,
            instructionCount: this.cpu.instructionCount
        };
    },

    tick() {
        const cpuActive = this.cpu.isRunning;
        const dmaActive = this.dma?.registers?.busy;
        const currentCycle = this.cycleCount + 1;

        if (!cpuActive && !dmaActive) {
            console.log('Simulation halted.');
            return;
        }

        const pcNow = this.cpu.pc;
        const cycleLabel =
            `[Cycle ${currentCycle}] CPU active=${cpuActive} pc=0x${pcNow.toString(16)} ` +
            `| DMA busy=${this.dma?.registers?.busy ?? false} ` +
            `progress=${this.dma?.transferProgress ?? 0}/${this.dma?.numElements ?? 0}`;
        const isNewStall = _stalledSince === null || pcNow !== _stalledSince.pc;

        // Buffer component logs so we can print the cycle header only when needed
        const componentLogs = [];
        const origLog = console.log;
        console.log = (...args) => componentLogs.push(args.map(String).join(' '));

        // Tick order: upstream → downstream (request propagation)
        // CPU/DMA issue requests → L1 caches → L2 cache → TileLink buses → Memory/peripherals
        // This ensures each hop costs exactly 1 cycle, matching real hardware behaviour.

        try {
            if (cpuActive) {
                this.cpu.tick();
            }
        } catch (e) {
            console.log = origLog;
            this.cpu.isRunning = false;
            console.error(e);
            this.cycleCount++;
            return;
        }

        if (this.dma) {
            this.dma.tick();
        }

        this.iCache.tick();
        this.dCache.tick();
        this.l2Cache.tick();
        this.tilelink_UH.tick();
        this.tilelink_UL.tick();
        this.mem.tick(this.tilelink_UH);

        if (this.uart) {
            this.uart.tick();
        }

        console.log = origLog;

        // Print cycle header + buffered logs only when PC changed (new stall) or components logged
        if (isNewStall || componentLogs.length > 0) {
            origLog(cycleLabel);
            for (const line of componentLogs) {
                for (const subLine of String(line).split(/\r?\n/)) {
                    origLog('    ' + subLine);
                }
            }
        }

        if (isNewStall) {
            _stalledSince = { pc: pcNow };
        }

        this.cycleCount++;
    }
};

simulator.init();
