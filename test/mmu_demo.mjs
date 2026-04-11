import { MMU } from '../src/js/mmu.js';
import {
    TL_A_Opcode,
    TL_D_Opcode,
    getOpcodeName,
    getTransferSizeLog2,
    isTileLinkRead,
    isTileLinkWrite,
    readSizedValue,
    writeSizedValue
} from '../src/js/tilelink.js';

function hex(value, width = 8) {
    return `0x${(value >>> 0).toString(16).padStart(width, '0')}`;
}

function formatValue(value) {
    if (value === null || value === undefined || value === '') return '';
    return `${value >>> 0} (${hex(value)})`;
}

function formatReqType(type) {
    return typeof type === 'number' ? getOpcodeName(TL_A_Opcode, type) : String(type);
}

function formatRespType(type) {
    return typeof type === 'number' ? getOpcodeName(TL_D_Opcode, type) : String(type);
}

function cloneStats(stats) {
    return { ...stats };
}

function logStats(mmu) {
    const { translations, tlbHits, pageTableHits, identityFallbacks } = mmu.stats;
    console.log(
        `[MMU STATS] translations=${translations} tlbHits=${tlbHits} ` +
        `pageTableHits=${pageTableHits} identityFallbacks=${identityFallbacks}`
    );
}

function buildMemory(initialWords = {}) {
    const mem = {};
    for (const [address, value] of Object.entries(initialWords)) {
        writeSizedValue(mem, Number(address), Number(value), 2);
    }
    return mem;
}

function createLowerPort(memory) {
    return {
        lastReq: null,

        receiveRequest(req) {
            this.lastReq = { ...req };

            const visibleAddress = (req.virtualAddress ?? req.address) >>> 0;
            const physicalAddress = req.address >>> 0;
            const size = getTransferSizeLog2(req, 2);
            const reqType = formatReqType(req.type);

            console.log(
                `[Cache] REQ type=${reqType} addr=${hex(visibleAddress)} ` +
                `value=${formatValue(req.value)}`
            );
            console.log(
                `[MMU] DOWNSTREAM va=${hex(visibleAddress)} pa=${hex(physicalAddress)} ` +
                `mode=${req.translation?.mode ?? 'unknown'} cacheable=${req.cacheable}`
            );

            let respType = TL_D_Opcode.AccessAck;
            let data = 0;

            if (isTileLinkRead(req.type)) {
                data = readSizedValue(memory, physicalAddress, size);
                respType = TL_D_Opcode.AccessAckData;
                console.log(
                    `[Mem] READ pa=${hex(physicalAddress)} size=${1 << size}B ` +
                    `data=${formatValue(data)}`
                );
            } else if (isTileLinkWrite(req.type)) {
                writeSizedValue(memory, physicalAddress, req.value ?? 0, size);
                console.log(
                    `[Mem] WRITE pa=${hex(physicalAddress)} size=${1 << size}B ` +
                    `data=${formatValue(req.value ?? 0)}`
                );
            }

            console.log(
                `[Cache] RESP type=${formatRespType(respType)} addr=${hex(visibleAddress)} ` +
                `data=${respType === TL_D_Opcode.AccessAckData ? formatValue(data) : ''}`
            );

            req.replyTo.receiveResponse({
                from: 'cache',
                to: req.from,
                type: respType,
                data,
                address: physicalAddress,
                virtualAddress: visibleAddress,
                size
            });
        }
    };
}

function createUpperPort() {
    return {
        receiveResponse(resp) {
            console.log(
                `[CPU] RESP type=${formatRespType(resp.type)} addr=${hex(resp.address)} ` +
                `data=${resp.type === TL_D_Opcode.AccessAckData ? formatValue(resp.data) : ''}`
            );
        }
    };
}

function describeOutcome(mmu, beforeStats, requestAddress) {
    const vpn = mmu._getPageNumber(requestAddress >>> 0);
    const offset = (requestAddress >>> 0) & (mmu.pageSize - 1);

    if (mmu.stats.identityFallbacks > beforeStats.identityFallbacks) {
        console.log(
            `[MMU] TRANSLATE vpn=${hex(vpn)} offset=${hex(offset)} -> ` +
            `IDENTITY FALLBACK`
        );
        return;
    }

    if (mmu.stats.pageTableHits > beforeStats.pageTableHits) {
        console.log(
            `[MMU] TRANSLATE vpn=${hex(vpn)} offset=${hex(offset)} -> ` +
            `TLB MISS, PAGE TABLE HIT, REFILL`
        );
        return;
    }

    if (mmu.stats.tlbHits > beforeStats.tlbHits) {
        console.log(
            `[MMU] TRANSLATE vpn=${hex(vpn)} offset=${hex(offset)} -> TLB HIT`
        );
        return;
    }

    console.log(
        `[MMU] TRANSLATE vpn=${hex(vpn)} offset=${hex(offset)} -> no special event`
    );
}

function issueCpuRequest(mmu, req) {
    const beforeStats = cloneStats(mmu.stats);
    const reqType = formatReqType(req.type);
    const size = getTransferSizeLog2(req, 2);

    console.log(
        `[CPU] issue type=${reqType} va=${hex(req.address)} ` +
        `size=${1 << size}B value=${formatValue(req.value)}`
    );

    try {
        mmu.sendRequest('cpu', req);
        describeOutcome(mmu, beforeStats, req.address);
    } catch (error) {
        console.log(`[MMU] FAULT ${error.message}`);
    }

    logStats(mmu);
}

function demoIdentityFallback() {
    console.info('\n[MMU DEMO] Scenario 1: identity fallback');

    const memory = buildMemory({
        0x1234: 0x11112222
    });
    const lowerPort = createLowerPort(memory);
    const upperPort = createUpperPort();
    const mmu = new MMU(upperPort, lowerPort, {
        cacheabilityPredicate: (addr) => addr < 0x80000000
    });

    issueCpuRequest(mmu, {
        type: TL_A_Opcode.Get,
        address: 0x1234,
        size: 2
    });
}

function demoMappedTranslationAndTlb() {
    console.info('\n[MMU DEMO] Scenario 2: mapped translation and TLB refill');

    const memory = buildMemory({
        0x8120: 0xCAFEBABE,
        0x8124: 0x0BADF00D
    });
    const lowerPort = createLowerPort(memory);
    const upperPort = createUpperPort();
    const mmu = new MMU(upperPort, lowerPort);

    mmu.mapPage(0x4000, 0x8000, {
        read: true,
        write: true,
        execute: true,
        cacheable: true
    });

    console.info(
        `[MMU DEMO] mapPage VA=${hex(0x4000)} -> PA=${hex(0x8000)} perms=RWX cacheable=true`
    );
    console.info('[MMU DEMO] reset() clears TLB entries and counters, but keeps the page table');
    mmu.reset();

    issueCpuRequest(mmu, {
        type: TL_A_Opcode.Get,
        address: 0x4120,
        size: 2
    });

    issueCpuRequest(mmu, {
        type: TL_A_Opcode.Get,
        address: 0x4124,
        size: 2
    });
}

function demoPermissionChecks() {
    console.info('\n[MMU DEMO] Scenario 3: permission checks');

    const memory = buildMemory({
        0xA00C: 0xDEADC0DE
    });
    const lowerPort = createLowerPort(memory);
    const upperPort = createUpperPort();
    const mmu = new MMU(upperPort, lowerPort);

    mmu.mapPage(0x9000, 0xA000, {
        read: true,
        write: false,
        execute: false,
        cacheable: true
    });

    console.info(
        `[MMU DEMO] mapPage VA=${hex(0x9000)} -> PA=${hex(0xA000)} perms=R-- cacheable=true`
    );

    issueCpuRequest(mmu, {
        type: TL_A_Opcode.Get,
        address: 0x900C,
        size: 2
    });

    issueCpuRequest(mmu, {
        type: TL_A_Opcode.PutFullData,
        address: 0x9004,
        value: 0xAAAAAAAA,
        size: 2
    });

    issueCpuRequest(mmu, {
        type: 'fetch',
        address: 0x9008,
        size: 2
    });
}

function demoNonCacheableMapping() {
    console.info('\n[MMU DEMO] Scenario 4: mapped MMIO / non-cacheable access');

    const memory = buildMemory({
        0x10000000: 0x00000003
    });
    const lowerPort = createLowerPort(memory);
    const upperPort = createUpperPort();
    const mmu = new MMU(upperPort, lowerPort, {
        cacheabilityPredicate: (addr) => addr < 0x10000000
    });

    mmu.mapPage(0x5000, 0x10000000, {
        read: true,
        write: true,
        execute: false,
        cacheable: true
    });

    console.info(
        `[MMU DEMO] mapPage VA=${hex(0x5000)} -> PA=${hex(0x10000000)} perms=RW- cacheable=true`
    );
    console.info('[MMU DEMO] predicate marks PA >= 0x10000000 as non-cacheable');

    issueCpuRequest(mmu, {
        type: TL_A_Opcode.Get,
        address: 0x5000,
        size: 2
    });
}

function main() {
    console.log('Initializing App...');
    console.info('[ARCH] CPU -> MMU -> Fake Cache -> Fake Memory');
    console.info('[ARCH] Demo goal: print MMU behavior in the same console style used by the web app');

    demoIdentityFallback();
    demoMappedTranslationAndTlb();
    demoPermissionChecks();
    demoNonCacheableMapping();

    console.log('\nMMU demo complete.');
}

main();
