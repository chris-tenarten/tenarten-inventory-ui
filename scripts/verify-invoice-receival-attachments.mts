import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createInvoiceReceivalAttachmentService,createInvoiceReceivalSourceStateWriter,cleanupExpiredInvoiceReceivalSources,invoiceOriginalSha256,invoiceReceivalSourceResponse,INVOICE_RECEIVAL_SOURCE_BUCKET,type InvoiceReceivalSource,type InvoiceReceivalStorageCaller,type InvoiceReceivalSourceState} from '../src/modules/inventory/invoice-receival-attachments';

// OFFLINE byte-integrity/client-contract checks. Storage/RPC replies below are
// explicit test doubles; actual Auth/RLS/Storage/transaction proof is separate.
const checks:string[]=[];
async function check(name:string,run:()=>void|Promise<void>){await run();checks.push(name);}
const original=new Blob(['%PDF-1.7\nSYNTHETIC INVOICE ONLY\n%%EOF'],{type:'application/pdf'});
const sha=createHash('sha256').update(Buffer.from(await original.arrayBuffer())).digest('hex');
const sourceId='10302026-0000-4000-8000-000000000801',owner='10302026-0000-4000-8000-000000000802';
const copy=<T,>(v:T):T=>structuredClone(v);
function setup(){
 const source:InvoiceReceivalSource={id:sourceId,ownerId:owner,filename:'synthetic-original.pdf',mediaType:'application/pdf',byteSize:original.size,sha256:sha,storageBucket:INVOICE_RECEIVAL_SOURCE_BUCKET,storagePath:`${owner}/${sourceId}/original`,state:'uploading',createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),version:0,verifiedAt:null,retainedAt:null,retainedDraftId:null,evidenceSha256:null,agentState:null};
 const events:{method:string;args:unknown}[]=[];let stored:Blob|null=null,denied=false,uncertainRemoval=false,claimed:unknown[]=[];
 const caller:InvoiceReceivalStorageCaller={
  async rpc(name,args={}){
   events.push({method:name,args:copy(args)});
   if(denied)return {data:null,error:{code:'42501',message:'Injected private server diagnostic must not leak'}};
   if(['get_invoice_receival_source','get_invoice_receival_source_for_draft'].includes(name))return {data:copy(source),error:null};
   if(name==='begin_invoice_receival_source'){assert.equal(args.p_sha256,sha);assert.equal(args.p_byte_size,original.size);return {data:copy(source),error:null};}
   if(name==='prepare_invoice_receival_source_removal'){
    if(source.state==='retained')return {data:null,error:{code:'42501'}};
    source.state='deleting';return {data:copy(source),error:null};
   }
   if(name==='finish_invoice_receival_source_removal'){
    if(stored)return {data:null,error:{code:'22023'}};
    source.state='deleted';return {data:copy(source),error:null};
   }
   if(name==='list_expired_invoice_receival_sources')return {data:claimed,error:null};
   if(name==='claim_expired_invoice_receival_sources')return {data:claimed,error:null};
   if(name==='finish_expired_invoice_receival_source_removal')return {data:null,error:null};
   if(name==='record_invoice_receival_source_state'){assert.equal(args.p_actor,owner);source.agentState=args.p_state as InvoiceReceivalSourceState;source.state='ready';source.version++;return {data:copy(source),error:null};}
   throw Error('Unexpected RPC '+name);
  },
  storage:{from(bucket){assert.equal(bucket,INVOICE_RECEIVAL_SOURCE_BUCKET);return {
   async upload(path,body,options){events.push({method:'storage.upload',args:{path,options}});assert.equal(path,source.storagePath);assert.deepEqual(options,{contentType:'application/pdf',upsert:false});if(stored)return {data:null,error:{statusCode:'409'}};stored=body;return {data:{path},error:null};},
   async download(path){events.push({method:'storage.download',args:{path}});assert.equal(path,source.storagePath);return {data:stored,error:stored?null:{statusCode:'404'}};},
   async remove(paths){events.push({method:'storage.remove',args:paths});assert.deepEqual(paths,[source.storagePath]);stored=null;return {data:[],error:uncertainRemoval?{statusCode:'503'}:null};},
  };}},
 };
 return {source,caller,events,service:createInvoiceReceivalAttachmentService(caller),setStored:(value:Blob)=>{stored=value;},deny:()=>{denied=true;},uncertain:()=>{uncertainRemoval=true;},claim:(value:unknown[])=>{claimed=value;}};
}
await check('original PDF bytes are hashed, independently of rendered preview bytes',async()=>{
 assert.equal(await invoiceOriginalSha256(original),sha);
 assert.notEqual(sha,createHash('sha256').update('rendered-image-placeholder').digest('hex'));
});
await check('unsupported MIME, magic and excessive original files fail before upload metadata',async()=>{
 const h=setup();await assert.rejects(h.service.upload(new Blob(['<svg/>'],{type:'image/svg+xml'}),'x.svg'),/invalid_invoice_source_file/);
 await assert.rejects(h.service.upload(new Blob(['not a pdf'],{type:'application/pdf'}),'x.pdf'),/signature/);
 await assert.rejects(h.service.upload(new Blob([new Uint8Array(12000001)],{type:'application/pdf'}),'x.pdf'),/file/);
 await assert.rejects(h.service.upload(original,'bad\nname.pdf'),/filename/);assert.equal(h.events.length,0);
});
await check('source responses reject public buckets, cross-source paths and malformed identities',()=>{
 const {source}=setup();for(const change of [{storageBucket:'public'},{storagePath:owner+'/another/original'},{ownerId:sourceId},{sha256:'forged'},{state:'retained'}])assert.throws(()=>invoiceReceivalSourceResponse({...source,...change}),/response/);
});
await check('upload uses one private immutable object, then authenticates and verifies its real bytes',async()=>{
 const h=setup(),source=await h.service.upload(original,'synthetic-original.pdf');assert.equal(source.sha256,sha);
 assert.deepEqual(h.events.map(e=>e.method),['begin_invoice_receival_source','storage.upload','get_invoice_receival_source','storage.download']);
 assert(!JSON.stringify(h.events).includes('publicUrl'));assert(!JSON.stringify(h.events).includes('signedUrl'));
});
await check('concurrent exact upload conflict reconciles the same original without upsert or extra copy',async()=>{
 const h=setup();h.setStored(original);await h.service.upload(original,'synthetic-original.pdf');
 assert.equal(h.events.filter(e=>e.method==='storage.upload').length,1);assert.equal(h.events.filter(e=>e.method==='begin_invoice_receival_source').length,1);
});
await check('ready original reuse avoids duplicate Storage uploads and verifies actual content',async()=>{
 const h=setup();h.source.state='ready';h.setStored(original);await h.service.upload(original,'synthetic-original.pdf');assert(!h.events.some(e=>e.method==='storage.upload'));
});
await check('tampered stored bytes and mismatched original metadata cannot reach extraction',async()=>{
 const h=setup();h.setStored(new Blob(['%PDF-1.7\nDIFFERENT CONTENT\n%%EOF'],{type:'application/pdf'}));await assert.rejects(h.service.download(sourceId),/integrity/);
 const bad=setup();bad.setStored(new Blob([await original.arrayBuffer()],{type:'image/jpeg'}));await assert.rejects(bad.service.download(sourceId),/integrity/);
});
await check('fresh permission denial fails before any Storage access without leaking server diagnostics',async()=>{
 const h=setup();h.setStored(original);h.deny();await assert.rejects(h.service.download(sourceId),e=>e instanceof Error&&e.message==='invoice_source_rejected:42501');assert(!h.events.some(e=>e.method.startsWith('storage.')));
});
await check('abandonment prepares revocation, removes through Storage API, then confirms physical absence',async()=>{
 const h=setup();h.setStored(original);const value=await h.service.abandon(sourceId);assert.equal(value.state,'deleted');assert.deepEqual(h.events.map(e=>e.method),['prepare_invoice_receival_source_removal','storage.remove','finish_invoice_receival_source_removal']);
 const protectedSource=setup();protectedSource.source.state='retained';await assert.rejects(protectedSource.service.abandon(sourceId),/42501/);assert(!protectedSource.events.some(e=>e.method==='storage.remove'));
});
await check('uncertain Storage deletion reconciles absence before retiring provenance metadata',async()=>{
 const h=setup();h.setStored(original);h.uncertain();assert.equal((await h.service.abandon(sourceId)).state,'deleted');assert.equal(h.events.at(-1)?.method,'finish_invoice_receival_source_removal');
});
await check('server state writer invokes only fixed metadata attestation and validates exact identity/version',async()=>{
 const h=setup(),writer=createInvoiceReceivalSourceStateWriter(h.caller);const state:InvoiceReceivalSourceState={version:'invoice-receival-state.v1',originalSha256:sha,visionSha256:sha,rawLines:['Synthetic'],sourceRows:[{lineId:sourceId+':L1',sourceText:'Synthetic',sourceQuantity:null}],draft:null,traceHash:null};
 await writer.record({actorId:owner,sourceId,expectedVersion:0,verifiedSha256:sha,state});assert.deepEqual(h.events.map(e=>e.method),['record_invoice_receival_source_state']);
 await assert.rejects(writer.record({actorId:'forged',sourceId,expectedVersion:0,verifiedSha256:sha,state}),/identity/);
 await assert.rejects(writer.record({actorId:owner,sourceId,expectedVersion:-1,verifiedSha256:sha,state}),/identity/);assert.equal(h.events.length,1);
});
await check('maintenance claims only generated invoice paths and retires metadata after fixed deletion',async()=>{
 const h=setup();h.claim([{id:sourceId,storageBucket:INVOICE_RECEIVAL_SOURCE_BUCKET,storagePath:h.source.storagePath}]);const paths:string[]=[];
 assert.deepEqual(await cleanupExpiredInvoiceReceivalSources(h.caller,async path=>{paths.push(path);},2),{removedSourceIds:[sourceId]});
 assert.deepEqual(paths,[h.source.storagePath]);assert.deepEqual(h.events.map(e=>e.method),['claim_expired_invoice_receival_sources','finish_expired_invoice_receival_source_removal']);
 const bad=setup();bad.claim([{id:sourceId,storageBucket:INVOICE_RECEIVAL_SOURCE_BUCKET,storagePath:'../unrelated'}]);await assert.rejects(cleanupExpiredInvoiceReceivalSources(bad.caller,async()=>{throw Error('must not delete');}),/response/);
 await assert.rejects(cleanupExpiredInvoiceReceivalSources(h.caller,async()=>{},21),/limit/);
});
console.log(JSON.stringify({passed:true,mode:'OFFLINE byte-integrity and fixed Storage/RPC wiring only; explicit mocked transport, not Auth/RLS/Storage/transaction proof',groups:checks.length,checks,inferenceCalls:0,databaseWrites:0},null,2));
