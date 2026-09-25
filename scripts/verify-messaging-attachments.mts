import assert from 'node:assert/strict';
import {BINARY_TYPE,canPreview,downloadUrl,previewType,resumableEndpoint,validateFiles} from '../src/modules/my-work/messaging/files';
import {MessageTransfer,type Draft,type Transport} from '../src/modules/my-work/messaging/transfer';

assert.equal(validateFiles([{name:'a.exe',size:250_000_000},{name:'a.7z',size:250_000_000}]),500_000_000);
for(const files of [[{name:'a',size:250_000_001}],[{name:'a',size:250_000_000},{name:'b',size:250_000_000},{name:'c',size:1}],[{name:'a',size:-1}]])assert.throws(()=>validateFiles(files));
for(const name of ['a.html','a.svg','a.exe','a.dwg','a.dxf','a.zip','a.7z','a','😀 & #?.xyz']){
  const file=new File(['<script>alert(1)</script>'],name,{type:'image/png'});
  assert.equal(await previewType(file),BINARY_TYPE);
}
const png=new File([new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])],'image.png',{type:'image/png'});
assert.equal(await previewType(png),'image/png');
assert(canPreview({originalFilename:'image.png',contentType:'image/png',byteSize:12}));
assert(!canPreview({originalFilename:'image.svg',contentType:'image/svg+xml',byteSize:12}));
assert(!canPreview({originalFilename:'image.png',contentType:'image/png',byteSize:20_000_001}));
const unusual='a & # + % 😀.dwg',url=new URL(downloadUrl('https://example.invalid/object?token=abc',unusual));
assert.equal(url.searchParams.get('download'),unusual);assert.equal(url.searchParams.get('token'),'abc');
assert.equal(resumableEndpoint('https://test.supabase.co'),'https://test.storage.supabase.co/storage/v1/upload/resumable');
assert.equal(resumableEndpoint('http://127.0.0.1:54321'),'http://127.0.0.1:54321/storage/v1/upload/resumable');
function fixture(){
  let draft:Draft|undefined,ready=false,canceling=false,failUpload=false,loseFinalize=false,failRemove=false,finalizes=0,uploads=0,removals=0;
  const completed=new Set<string>();
  const api:Transport={
    begin:async value=>{if(draft)assert.deepEqual(value,draft);else draft=structuredClone(value);},
    status:async()=>({status:ready?'ready':canceling?'canceling':'active',completed:[...completed]}),
    heartbeat:async()=>{},
    upload:async(_id,entry,_file,signal,progress)=>{uploads++;progress(1);if(signal.aborted||failUpload)throw Error('network');completed.add(entry.id);progress(entry.size);},
    finalize:async()=>{assert(!canceling);if(!ready){ready=true;finalizes++;}if(loseFinalize)throw Error('response lost');},
    cancel:async()=>{assert(!ready);canceling=true;return [...completed];},
    remove:async()=>{removals++;if(failRemove)throw Error('cleanup network');completed.clear();},
    discard:async()=>{assert.equal(completed.size,0);},
  };
  return{api,get draft(){return draft;},get uploads(){return uploads;},get removals(){return removals;},get finalizes(){return finalizes;},set failUpload(v:boolean){failUpload=v;},set loseFinalize(v:boolean){loseFinalize=v;},set failRemove(v:boolean){failRemove=v;}};
}
const files=[png,new File(['binary'],'installer.exe')];
{
 const f=fixture();f.loseFinalize=true;const t=new MessageTransfer(files,'recipient','body','',f.api);let progress=0;t.subscribe(()=>{progress=Math.max(progress,t.state.uploaded);});
 await t.start();assert.equal(t.state.phase,'failed');assert.equal(f.removals,0);const id=t.draft.id;
 await t.start();assert.equal(t.state.phase,'sent');assert.equal(t.draft.id,id);assert.equal(f.finalizes,1);assert.equal(f.uploads,2);assert.equal(progress,18);
}
{
 const f=fixture();f.failUpload=true;const t=new MessageTransfer(files,'recipient','body','',f.api);await t.start();assert.equal(t.state.phase,'failed');f.failUpload=false;await t.start();assert.equal(t.state.phase,'sent');
}
{
 const f=fixture();f.api.finalize=async()=>{throw Error('not sent');};const t=new MessageTransfer(files,'recipient','body','',f.api);await t.start();f.failRemove=true;await t.cancel();assert.equal(t.state.phase,'failed');f.failRemove=false;await t.cancel();assert.equal(t.state.phase,'canceled');
}
{
 const f=fixture();let started!:()=>void;const gate=new Promise<void>(r=>{started=r;});
 f.api.upload=async(_id,_entry,_file,signal)=>{started();await new Promise<void>((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));};
 const t=new MessageTransfer(files,'recipient','body','',f.api);const run=t.start();await gate;await t.cancel();await run;assert.equal(t.state.phase,'canceled');assert.equal(f.finalizes,0);
}
console.log('PASS: byte limits; universal/mismatched formats; bounded raster classification; filename query encoding; progress; lost finalize response; same-identity retry; cancel during upload; cleanup retry.');

const {AttachmentQueue,clipboardNames,exposedFiles}=await import('../src/modules/my-work/messaging/queue');
const queue=new AttachmentQueue();
const now=new Date(2026,8,25,9,15,32);
queue.add([new File(['picker'],'plan.dwg')],'picker');
const event={};const clipboard=new File(['png'],'image.png',{type:'image/png'});
queue.add([clipboard,clipboard],'paste',event,now);queue.add([clipboard],'paste',event,now);
queue.add([new File(['drop'],'archive.7z')],'drop');
assert.equal(queue.files.length,4);assert.equal(queue.files[1].name,'Screenshot 2026-09-25 09.15.32.png');assert.equal(queue.files[2].name,'Screenshot 2026-09-25 09.15.32 (2).png');
assert.equal(clipboardNames([new File(['x'],'',{type:'image/png'})],[],now)[0].name,'Screenshot 2026-09-25 09.15.32.png');
const dt={items:[{kind:'file',getAsFile:()=>clipboard}],files:[clipboard]} as unknown as DataTransfer;
assert.equal(exposedFiles(dt).length,1);
assert.equal(exposedFiles({items:[{kind:'file',getAsFile:()=>null}],files:[]} as unknown as DataTransfer).length,0);
// Metadata-only stand-ins ensure validation happens without reading/allocating huge bodies.
const large={name:'large.bin',size:250_000_000} as File;
const limits=new AttachmentQueue();limits.add([large],'picker');limits.add([large],'drop');
assert.throws(()=>limits.add([new File(['x'],'extra.txt')],'paste'));
assert.equal(limits.files.length,2);assert.throws(()=>limits.add([{name:'too-large',size:250_000_001} as File],'drop'));
console.log('PASS: shared picker/paste/drop queue, combined aggregate limit, atomic rejected additions, screenshot naming, multiple clipboard files, unsupported file fallback, duplicate-event protection.');
{
 const f=fixture();f.loseFinalize=true;const t=new MessageTransfer(files,'recipient','body','',f.api);await t.start();
 const recovered=new MessageTransfer([],'recipient','body','',f.api,t.draft);await recovered.start();assert.equal(recovered.state.phase,'sent');assert.equal(f.uploads,2);
}
{
 const f=fixture();f.failUpload=true;const t=new MessageTransfer(files,'recipient','body','',f.api);await t.start();
 const recovered=new MessageTransfer([],'recipient','body','',f.api,t.draft);await recovered.start();assert.equal(recovered.state.phase,'failed');assert(recovered.needsFiles);
 assert.throws(()=>recovered.supplyFiles([new File(['wrong'],'wrong.png')]));recovered.supplyFiles(files);f.failUpload=false;await recovered.start();assert.equal(recovered.state.phase,'sent');assert.equal(recovered.draft.id,t.draft.id);
}
console.log('PASS: recovered ready result without file bytes; original-file reselection validation; stable-ID reload recovery.');
