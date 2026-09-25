import assert from 'node:assert/strict';
import {rasterDimensions,validPreviewMetadata,generatePreview,fetchPreview,PREVIEW_MAX_BYTES} from '../src/modules/my-work/messaging/preview';
import {MessageTransfer,type Transport} from '../src/modules/my-work/messaging/transfer';
const p={path:'private',bytes:100,width:1280,height:720};
assert(validPreviewMetadata(p));for(const patch of [{bytes:PREVIEW_MAX_BYTES+1},{width:1281},{height:0},{bytes:1.1}])assert(!validPreviewMetadata({...p,...patch}));
const png=new Uint8Array(24);png.set([137,80,78,71,13,10,26,10]);const v=new DataView(png.buffer);v.setUint32(16,8193);v.setUint32(20,100);
assert.deepEqual(rasterDimensions(png),{width:8193,height:100});
assert.equal(await generatePreview(new File([png],'oversized.png',{type:'image/png'}),'image/png',new AbortController().signal),null);
assert.equal(await generatePreview(new File(['<html>'],'fake.png',{type:'image/png'}),'image/png',new AbortController().signal),null);
assert.equal(rasterDimensions(new Uint8Array([255,216,255,192,0,1])),null);
// Bounded response reader rejects malicious bytes before decoding/displaying them.
const originalFetch=globalThis.fetch;
try{
 globalThis.fetch=async()=>new Response(new Uint8Array(PREVIEW_MAX_BYTES+1));
 await assert.rejects(fetchPreview('http://local.invalid',p,new AbortController().signal),/bounds/);
 globalThis.fetch=async()=>new Response('<svg onload="alert(1)"></svg>');
 await assert.rejects(fetchPreview('http://local.invalid',p,new AbortController().signal),/invalid/);
}finally{globalThis.fetch=originalFetch;}
let finalized=0,previews=0;const completed:string[]=[];
const transport:Transport={begin:async()=>{},status:async()=>({status:'active',completed}),heartbeat:async()=>{},upload:async(_id,e)=>{completed.push(e.id);},preview:async()=>{previews++;throw Error('optional derivative failed');},finalize:async()=>{finalized++;},cancel:async()=>[],remove:async()=>{},discard:async()=>{}};
const transfer=new MessageTransfer([new File(['x'],'x.bin')],'peer','','',transport);await transfer.start();assert.equal(transfer.state.phase,'sent');assert.equal(finalized,1);assert.equal(previews,1);
console.log('PASS: preview byte/pixel bounds, malformed/active payload denial, oversized source skipped before decode, optional derivative failure cannot block sending.');
