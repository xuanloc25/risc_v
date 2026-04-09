import { CPU } from './cpu.js';
import { MMU } from './mmu.js';
import SimpleCache from './SimpleCache.js';
import { TileLink_UH } from './tilelink_UH.js';
import { Mem } from './mem.js';
import { TileLink_UL } from './tilelink_UL.js';
import { DMAController } from './dma.js';
import { TileLinkBridge } from './tilelink_bridge.js';
import { UART } from './uart.js';
import { LEDMatrix } from './led_matrix.js';
import { Keyboard } from './keyboard.js';
import { MousePeripheral } from './mouse.js';
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

function createSimpleCacheLowerPort(cache, cacheName = 'cache', upperCacheName = null) {
    const REFILL_TRANSFER_LATENCY = 1;
    const isRefillAccess = (accessType) => accessType === 'fill' || accessType === 'fill-bypass';
    const pushRefillEvent = (events, targetName, cycle, blockBase) => {
        if (!targetName) return;
        events.push({
            cycle,
            message: `[${targetName}] REFILL(fill) addr=0x${blockBase.toString(16)}`
        });
    };
    const pushForwardEvent = (events, targetName, cycle, blockBase, bypassLatency) => {
        if (!targetName) return;
        events.push({
            cycle,
            message: `[${targetName}] FORWARD(fill) addr=0x${blockBase.toString(16)} (+${bypassLatency}cy refill latency)`
        });
    };

    return {
        get mem() {
            return cache.memBytes();
        },
        memBytes: () => cache.memBytes(),
        // Build an async fill plan for a lower cache.
        // The caller provides the absolute cycle when this lower cache is first consulted.
        beginBlockFill(blockBase, startCycle) {
            const setIndex = cache._getSetIndex(blockBase);
            const tag = cache._getTag(blockBase);
            const block = cache._findBlock(setIndex, tag);
            const plan = {
                blockBase,
                setIndex,
                tag,
                startCycle,
                totalLatency: 0,
                hit: !!block,
                lowerPlan: null,
                events: [],
                bypassLatency: REFILL_TRANSFER_LATENCY
            };

            const checkCycle = startCycle + 1;

            cache.statistics.numRead++;

            if (block) {
                cache.statistics.numHit++;
                cache.statistics.totalCycles += cache.hitLatency;
                plan.totalLatency = 1;
                plan.events.push({
                    cycle: checkCycle,
                    message: `[${cacheName}] HIT(fill) addr=0x${blockBase.toString(16)} set=${setIndex} tag=0x${tag.toString(16)}`
                });
                pushRefillEvent(plan.events, upperCacheName, startCycle + plan.totalLatency + REFILL_TRANSFER_LATENCY, blockBase);
                return plan;
            }

            cache.statistics.numMiss++;
            cache.statistics.totalCycles += cache.missLatency;
            plan.events.push({
                cycle: checkCycle,
                message: `[${cacheName}] MISS(fill) addr=0x${blockBase.toString(16)} set=${setIndex} tag=0x${tag.toString(16)}`
            });

            if (typeof cache.lowerPort?.beginBlockFill === 'function') {
                const lowerStartCycle = checkCycle + cache.missLatency;
                plan.lowerPlan = cache.lowerPort.beginBlockFill(blockBase, lowerStartCycle);
                // totalLatency excludes the final hop to the upper cache.
                plan.totalLatency = (lowerStartCycle - startCycle)
                    + plan.lowerPlan.totalLatency
                    + (plan.lowerPlan.bypassLatency ?? 0);
                plan.events.push(...plan.lowerPlan.events);
                pushRefillEvent(plan.events, cacheName, startCycle + plan.totalLatency - REFILL_TRANSFER_LATENCY, blockBase);
                plan.events.push({
                    cycle: startCycle + plan.totalLatency,
                    message: `[${cacheName}] FORWARD(fill) addr=0x${blockBase.toString(16)} (+${REFILL_TRANSFER_LATENCY}cy refill latency)`
                });
                pushRefillEvent(plan.events, upperCacheName, startCycle + plan.totalLatency + REFILL_TRANSFER_LATENCY, blockBase);
                return plan;
            }

            const ramLatency = cache.lowerPort?.memoryTarget?.latency ?? cache.lowerPort?.latency ?? 20;
            const ramRequestCycle = checkCycle + cache.missLatency;
            const ramReturnCycle = ramRequestCycle + ramLatency;
            plan.totalLatency = (ramRequestCycle - startCycle) + ramLatency + REFILL_TRANSFER_LATENCY;
            plan.events.push({
                cycle: ramRequestCycle,
                message: `[RAM] REQUEST addr=0x${blockBase.toString(16)}`
            });
            plan.events.push({
                cycle: ramReturnCycle,
                message: `[RAM] RETURN addr=0x${blockBase.toString(16)} (+${ramLatency}cy)`
            });
            pushRefillEvent(plan.events, cacheName, startCycle + plan.totalLatency - REFILL_TRANSFER_LATENCY, blockBase);
            plan.events.push({
                cycle: startCycle + plan.totalLatency,
                message: `[${cacheName}] FORWARD(fill) addr=0x${blockBase.toString(16)} (+${REFILL_TRANSFER_LATENCY}cy refill latency)`
            });
            pushRefillEvent(plan.events, upperCacheName, startCycle + plan.totalLatency + REFILL_TRANSFER_LATENCY, blockBase);
            return plan;
        },
        // Finish the refill only when the async plan reaches its ready cycle.
        finishBlockFill(plan) {
            if (!plan) return null;

            let block = cache._findBlock(plan.setIndex, plan.tag);
            if (!block) {
                block = cache._selectVictim(plan.setIndex);

                if (plan.lowerPlan && typeof cache.lowerPort?.finishBlockFill === 'function') {
                    const lowerBlockData = cache.lowerPort.finishBlockFill(plan.lowerPlan);
                    cache._installBlockData(block, plan.tag, lowerBlockData);
                } else {
                    cache._fillBlock(block, plan.blockBase, plan.tag);
                }
            }

            cache._touchBlock(block);
            const blockCopy = new Uint8Array(cache.blockSize);
            blockCopy.set(block.data);
            return blockCopy;
        },
        directRead(address, size, accessType) {
            // All timed cache behaviour is modeled through receiveRequest()/beginBlockFill().
            // directRead should not allocate or satisfy cacheable accesses synchronously.
            return cache.lowerPort.directRead(address >>> 0, size, accessType);
        },
        directWrite(address, value, size, accessType) {
            const physicalAddress = address >>> 0;
            const shouldLogWrite = !isRefillAccess(accessType) && accessType !== 'write-through';
            const shouldCache = cache.enabled && cache.isCacheable(physicalAddress);
            if (!shouldCache) {
                cache.lowerPort.directWrite(physicalAddress, value, size, accessType);
                return;
            }

            cache.statistics.numWrite++;

            const setIndex = cache._getSetIndex(physicalAddress);
            const tag = cache._getTag(physicalAddress);
            const blockBase = cache._getBlockBase(physicalAddress);
            const offset = physicalAddress - blockBase;

            let block = cache._findBlock(setIndex, tag);
            if (!block) {
                cache.statistics.numMiss++;
                cache.statistics.totalCycles += cache.missLatency;
                block = cache._selectVictim(setIndex);
                cache._fillBlock(block, blockBase, tag);
                if (shouldLogWrite) {
                    console.log(`[${cacheName}] MISS WR addr=0x${physicalAddress.toString(16)} set=${setIndex} tag=0x${tag.toString(16)} val=0x${(value >>> 0).toString(16)}`);
                }
            } else {
                cache.statistics.numHit++;
                cache.statistics.totalCycles += cache.hitLatency;
                if (shouldLogWrite) {
                    console.log(`[${cacheName}] HIT  WR addr=0x${physicalAddress.toString(16)} set=${setIndex} tag=0x${tag.toString(16)} val=0x${(value >>> 0).toString(16)}`);
                }
            }

            cache._touchBlock(block);
            cache._writeBlockValue(block, offset, value ?? 0, size);
            block.modified = true;
            cache.lowerPort.directWrite(physicalAddress, value ?? 0, size, accessType);
        }
    };
}

export const simulator = {
    cpu: null,
    mmu: null,
    iCache: null,
    dCache: null,
    l2Cache: null,
    cache: null,
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
        this.cache = new SimpleCache({
            ...CacheConfigL1,
            name: 'l1-cache'
        });
        this.l2Cache = new SimpleCache({
            ...CacheConfigL2,
            name: 'l2-cache'
        });

        this.l2Cache.attachLowerPort(this.tilelink_UH);
        this.cache.attachLowerPort(createSimpleCacheLowerPort(this.l2Cache, 'L2-cache', 'l1-cache'));
        this.cache.attachUpperPort(this.mmu);
        this.cache.setEnabled(this.useCache);
        this.l2Cache.setEnabled(this.useCache);

        this.cpu.attachLowerPort(this.mmu);
        this.mmu.attachUpperPort(this.cpu);
        this.mmu.attachInstructionLowerPort(this.cache);
        this.mmu.attachDataLowerPort(this.cache);

        // Giữ alias để UI cũ không bị vỡ.
        this.iCache = this.cache;
        this.dCache = this.cache;

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

        this.tilelink_UH.registerSlave('main-memory', this.mem, (addr) => isCacheableAddress(addr));
        this.tilelink_UH.registerSlave('dma-regs', this.dma, (addr) => dmaRegRange(addr));
        this.tilelink_UH.registerSlave('uh-to-ul-bridge', this.uhToUlBridge, (addr) => isUlPeripheralAddress(addr));
        this.tilelink_UH.attachMemoryTarget(this.mem);

        this.tilelink_UL.registerSlave('uart', uartEndpoint, uartRange);
        this.tilelink_UL.registerSlave('led-matrix', ledEndpoint, ledRange);
        this.tilelink_UL.registerSlave('keyboard', keyboardEndpoint, keyboardRange);
        this.tilelink_UL.registerSlave('mouse', mouseEndpoint, mouseRange);
        this.tilelink_UL.registerSlave('ul-to-uh-bridge', this.ulToUhBridge, (addr) => !isUlPeripheralAddress(addr));
        this.tilelink_UL.attachMemoryTarget(this.mem);

        this.tilelink_UH.registerMaster('dma', this.dma);
        this.tilelink_UL.registerMaster('dma', this.dma);

        this.uart = uart;
        this.ledMatrix = ledMatrix;
        this.keyboard = keyboard;
        this.mouse = mouse;
        this.cycleCount = 0;

        if (this.ledMatrix) this.ledMatrix.reset();
        if (this.uart) this.uart.reset();
        if (this.mouse) this.mouse.reset();
        if (this.keyboard) this.keyboard.reset();
        if (this.cache) this.cache.reset();
        if (this.l2Cache) this.l2Cache.reset();
        if (this.mmu) this.mmu.reset();

        console.info('[ARCH] CPU -> MMU -> L1 cache -> L2 cache -> memory/MMIO');
        console.info('[CACHE] L1: 16 sets x 4 ways, L2: 16 sets x 4 ways');
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
        this.cache.tick();
        this.l2Cache.tick();
        this.tilelink_UH.tick();
        this.tilelink_UL.tick();

        if (this.uart) {
            this.uart.tick();
        }

        this.cycleCount++;
    }
};

simulator.reset();
