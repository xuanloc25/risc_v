import { TileLink_UH } from '../src/js/tilelink_UH.js';
import { TileLink_UL } from '../src/js/tilelink_UL.js';
import { DMAController } from '../src/js/dma.js';
import { TileLinkBridge } from '../src/js/tilelink_bridge.js';
import { Port, attachPort } from '../src/js/port_link.js';
import { TL_A_Opcode } from '../src/js/tilelink.js';

function makeMaster(){return{upperPort:null,lowerPort:null,responses:[],attachUpperPort(p){this.upperPort=p;},attachLowerPort(p){this.lowerPort=p;},receiveResponse(r){this.responses.push({...r});}};}

const DMA_REG_BASE=0xFFED0000;
const dmaRegRange=(a)=>a>=DMA_REG_BASE&&a<DMA_REG_BASE+0x08;
const uh=new TileLink_UH(); const ul=new TileLink_UL();
const dma=new DMAController({tilelink_UH:uh,tilelink_UL:ul,registerLink:ul,selectLinkForAddress:()=>uh});
const master=makeMaster();
const bridge=new TileLinkBridge(uh,ul,{name:'uh-to-ul-bridge'});
attachPort(uh,Port.upper('cpu',master));
attachPort(uh,Port.lower('uh-to-ul-bridge',bridge,dmaRegRange));
attachPort(ul,Port.lower('DMA Controller',dma,dmaRegRange));

const orig=console.log; console.log=()=>{};
uh.sendRequest('cpu',{type:TL_A_Opcode.PutFullData,address:DMA_REG_BASE,value:1,size:2}); uh.tick();
uh.sendRequest('cpu',{type:TL_A_Opcode.Get,address:DMA_REG_BASE,size:2}); uh.tick();
console.log=orig;
const d=master.responses[1].data>>>0;
console.log('CTRL data = 0x'+d.toString(16));
console.log('expected  = 0x'+(0x9030001>>>0).toString(16));
console.log('match=', d===(0x9030001>>>0));
console.log('fifoDepthLog2 bits[19:16]=',(d>>>16)&0xF, ' (expect 3)');
console.log('dataFifoEmpty bit24=',(d>>>24)&1,' (expect 1)');
console.log('fifoEmpty bit27=',(d>>>27)&1,' (expect 1)');
console.log('enabled bit0=',d&1,' (expect 1)');
console.log('responses count=',master.responses.length);
