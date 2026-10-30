/** Offline hosted dispatch/metadata boundary only. Real JWT/RLS, Storage and
 * transactions are verified separately against the isolated fixture. */
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createHostedReceivalContract,createHostedReceivalRuntime,hostedReceivalPilotEnabled,TENBOT_RECEIVAL_WORKSPACE as workspace} from '../supabase/functions/_shared/tenbot-receival-hosted';
import type {InvoiceReceivalSource,InvoiceReceivalSourceState} from '../src/modules/inventory/invoice-receival-attachments';
const uuid=(n:number)=>`10302026-0000-4000-8000-${String(n).padStart(12,'0')}`;
const owner=uuid(21),other=uuid(22),draftId=uuid(301),approvalId=uuid(302),recordId=uuid(303),permitId=uuid(304),hash='a'.repeat(64),now=Date.parse('2026-10-30T16:00:00Z');
const config={enabled:true,executionEnabled:true,origins:['https://tendev.pages.dev'],employeeIds:[owner],expiresAt:new Date(now+60000).toISOString()};
const checks:string[]=[];async function check(name:string,run:()=>Promise<void>|void){await run();checks.push(name);}
const rejected=async(call:Promise<unknown>,status:number)=>assert.rejects(call,e=>e instanceof Error&&'status' in e&&e.status===status);
function setup(){
 const calls:{authority:'caller'|'service';name:string;args:Record<string,unknown>}[]=[],denied=new Set<string>();let badPermit=false;
 const execution={draftId,hash,createdRecordIds:[recordId],createdCatalogRecords:[],idempotent:true,executedAt:new Date(now).toISOString()};
 const draft={id:draftId,hash,ownerId:owner,expiresAt:new Date(now+60000).toISOString(),schemaVersion:'invoice-receivals.v2',authorizationVersion:'b'.repeat(64),document:{sha256:'c'.repeat(64),supplier:'T&M Supply',reference:'SYN-HOSTED',documentDate:null},metadata:{orderedBy:'Synthetic employee',orderDate:'2026-10-30',location:'Denton'},provenance:{model:'OFFLINE transport fixture',sourceMediaType:'image/png',extractionSha256:'d'.repeat(64),toolTraceSha256:'e'.repeat(64)},lines:[{sourceLineId:'L1',catalogSource:'standard' as string|null,catalogId:uuid(101) as string|null,quantityExpected:'3',unit:'Bag',productionJobId:null,sourceQuantity:{quantity:'150',unit:'LB'},sourceText:'150 LB / 50 LB Bag',newMaterial:null as Record<string,unknown>|null,duplicateAcknowledgement:null,vendor:'T&M Supply',material:'Synthetic material',size:'#1',category:'Aggregate',jobLabel:null,catalogSnapshot:{id:uuid(101)},vendorSnapshot:null,duplicateReview:null,quantityBasis:{sourceKind:'material_total',packageCount:'3',perPackage:{quantity:'50',unit:'LB',container:'Bag'},totalMaterial:{quantity:'150',unit:'LB'},receivalQuantity:'3',receivalUnit:'Bag',inventoryStockingUnit:null,calculation:'exact_catalog_package_conversion',reasons:[]}}],revoked:false,superseded:false,execution:null as null|typeof execution};
 const caller={async rpc(name:string,args:Record<string,unknown>={}){
  calls.push({authority:'caller',name,args});
  if(name==='has_app_capability')return {data:!denied.has(String(args.p_capability)),error:null};
  if(name==='get_invoice_receival_draft')return {data:structuredClone(draft),error:null};
  if(name==='revoke_invoice_receival_draft')return {data:{draftId,hash,revoked:true},error:null};
  if(name==='approve_invoice_receival_draft')return {data:{id:approvalId,draftId,hash,expiresAt:new Date(now+60000).toISOString()},error:null};
  if(name==='execute_invoice_receival_draft'){draft.execution=execution;return {data:{...execution,idempotent:false},error:null};}
  throw Error('Unexpected caller RPC');
 }};
 const service=async(name:string,args:Record<string,unknown>)=>{calls.push({authority:'service',name,args});assert.equal(name,'tenbot_receival_mint_execution_permit');return {data:badPermit?{ok:false}:{ok:true,alreadyExecuted:false,permitId,draftId,hash,approvalId,policyVersion:1,expiresAt:new Date(now+60000).toISOString()},error:null};};
 const handler=(overrides:Record<string,unknown>={})=>createHostedReceivalContract({owner,origin:'https://tendev.pages.dev',config,caller,service,now:()=>now,...overrides});
 return {calls,denied,draft,execution,handler,badPermit:()=>{badPermit=true;}};
}
await check('pilot is default-off, exact TenDev, finite and employee allowlisted before any RPC',async()=>{
 for(const overrides of [{config:{...config,enabled:false}},{origin:'https://tenops.pages.dev'},{config:{...config,employeeIds:[other]}},{config:{...config,expiresAt:new Date(now).toISOString()}},{config:{...config,origins:['https://tendev.pages.dev','https://tenops.pages.dev']}},{config:{...config,employeeIds:[owner,'invalid']}}]){const f=setup();await rejected(f.handler(overrides)({workspace,action:'status'}),403);assert.equal(f.calls.length,0);}
 assert.equal(hostedReceivalPilotEnabled(config,owner,'https://tendev.pages.dev',now),true);
});
await check('status cannot enable execution or falsely claim the preparation runtime exists',async()=>{
 const f=setup(),r=await f.handler({config:{...config,executionEnabled:false}})({workspace,action:'status'}) as Record<string,unknown>;assert.equal(r.executionEnabled,false);assert.equal(r.preparationRuntimeAvailable,false);assert.equal(r.requiresPrivateOriginal,true);assert(f.calls.every(x=>x.name==='has_app_capability'));
});
await check('current read/write/receival capability is checked outside the model',async()=>{
 for(const cap of ['readOperationalData','writeBusinessData','adjustInventory']){const f=setup();f.denied.add(cap);await rejected(f.handler()({workspace,action:'get',draftId}),403);assert(f.calls.every(x=>x.name==='has_app_capability'));}
});
await check('new instances get only the exact owner durable review without inference or privilege',async()=>{
 const f=setup();for(let n=0;n<2;n++){const r=await f.handler()({workspace,action:'get',draftId}) as {draft:{id:string}};assert.equal(r.draft.id,draftId);}assert.equal(f.calls.filter(x=>x.name==='get_invoice_receival_draft').length,2);assert(!f.calls.some(x=>x.authority==='service'));
 f.draft.ownerId=other;await rejected(f.handler()({workspace,action:'get',draftId}),403);
});
await check('no generic prepare, SQL, tools or editable immutable source forwarding is exposed',async()=>{
 for(const body of [{action:'prepare',p_lines:[]},{action:'execute_sql',sql:'SELECT 1'},{action:'approve',draftId,hash,confirmation:true,sourceQuantity:'invented'},{action:'get',draftId,p_user:other}]){const f=setup();await assert.rejects(f.handler()({workspace,...body}));assert(f.calls.every(x=>x.name==='has_app_capability'));}
});
await check('explicit exact approval and independent catalog permission precede mutations',async()=>{
 for(const body of [{confirmation:false},{hash:'f'.repeat(64)}]){const f=setup();await rejected(f.handler()({workspace,action:'approve',draftId,hash,confirmation:true,...body}),body.confirmation===false?409:403);assert(!f.calls.some(x=>/approve|execute|mint/.test(x.name)));}
 const f=setup();f.draft.lines[0].catalogId=null;f.draft.lines[0].catalogSource=null;f.draft.lines[0].newMaterial={supplier:'T&M Supply',itemName:'Synthetic material',vendorSku:'NEW',materialType:'chip',size:'#1',unitSize:'50',unitSizeUom:'LB',packaging:'Bag',priceUnit:'Bag',notes:'',prepared:true};f.denied.add('manageVendorsCatalog');await rejected(f.handler()({workspace,action:'approve',draftId,hash,confirmation:true}),403);assert(!f.calls.some(x=>/approve|execute|mint/.test(x.name)));
});
await check('approval uses caller canonical RPCs and only fixed service metadata before execution',async()=>{
 const f=setup(),r=await f.handler()({workspace,action:'approve',draftId,hash,confirmation:true}) as {createdRecordIds:string[]};assert.deepEqual(r.createdRecordIds,[recordId]);
 assert.deepEqual(f.calls.filter(x=>x.name!=='has_app_capability').map(x=>[x.authority,x.name]),[['caller','get_invoice_receival_draft'],['caller','approve_invoice_receival_draft'],['service','tenbot_receival_mint_execution_permit'],['caller','execute_invoice_receival_draft']]);
 const p=f.calls.find(x=>x.authority==='service')!.args;assert.equal(p.p_user,owner);assert.equal(p.p_expected_hash,hash);assert.equal(p.p_approval_id,approvalId);assert.equal(p.p_origin,'https://tendev.pages.dev');
});
await check('metadata failures stop without execution or automatic retry',async()=>{
 const f=setup();f.badPermit();await rejected(f.handler()({workspace,action:'approve',draftId,hash,confirmation:true}),503);assert.equal(f.calls.filter(x=>x.authority==='service').length,1);assert(!f.calls.some(x=>x.name==='execute_invoice_receival_draft'));
});
await check('durable completed receipt reconciles without new approval, permit or Inventory write',async()=>{
 const f=setup();f.draft.execution=f.execution;const r=await f.handler()({workspace,action:'approve',draftId,hash,confirmation:true}) as {idempotent:boolean;createdRecordIds:string[]};assert.equal(r.idempotent,true);assert.deepEqual(r.createdRecordIds,[recordId]);assert(f.calls.every(x=>['get_invoice_receival_draft','has_app_capability'].includes(x.name)));
});
await check('revoked/superseded reviews and disabled execution cannot dispatch a write',async()=>{
 for(const changed of ['revoked','superseded'] as const){const f=setup();f.draft[changed]=true;await rejected(f.handler()({workspace,action:'approve',draftId,hash,confirmation:true}),409);assert(!f.calls.some(x=>/approve|execute|mint/.test(x.name)));}
 const f=setup();await rejected(f.handler({config:{...config,executionEnabled:false}})({workspace,action:'approve',draftId,hash,confirmation:true}),403);assert(f.calls.every(x=>x.name==='has_app_capability'));
});
await check('accepted shared runtime injection receives only the explicit workspace after outer authorization',async()=>{
 const f=setup();let received:unknown;const r=await f.handler({runtime:async(body:Record<string,unknown>,who:string)=>{assert.equal(who,owner);received=body;return {ready:true};}})({workspace,action:'ask',sourceId:uuid(401),question:'Prepare this invoice.'});assert.deepEqual(r,{ready:true});assert.deepEqual(received,{action:'ask',sourceId:uuid(401),question:'Prepare this invoice.'});assert(f.calls.every(x=>x.name==='has_app_capability'));
});
await check('private source permission, stale evidence and missing-source failures keep safe actionable status codes',async()=>{
 for(const [code,status]of [['42501',403],['22023',409],['23505',409],['P0002',404]] as const){const f=setup();await rejected(f.handler({runtime:async()=>{throw Error('invoice_source_rejected:'+code);}})({workspace,action:'review'}),status);}
});
function meteredRuntime(outage=false){
 const clock=Date.now(),bytes=readFileSync(new URL('./fixtures/tenbot-invoice-live-demo.png',import.meta.url)),blob=new Blob([new Uint8Array(bytes)],{type:'image/png'}),sourceId=uuid(401),digest=createHash('sha256').update(bytes).digest('hex');
 let source:InvoiceReceivalSource={id:sourceId,ownerId:owner,filename:'synthetic.png',mediaType:'image/png',byteSize:bytes.length,sha256:digest,storageBucket:'invoice-receival-originals',storagePath:owner+'/'+sourceId+'/original',state:'uploading',createdAt:new Date(clock).toISOString(),expiresAt:new Date(clock+3600000).toISOString(),version:0,verifiedAt:null,retainedAt:null,retainedDraftId:null,evidenceSha256:null,agentState:null};
 const requests:{path:string;body:Record<string,unknown>}[]=[],metadataCalls:{name:string;args:Record<string,unknown>}[]=[],reserves=new Map<string,number>();
 const caller={async rpc(name:string,args:Record<string,unknown>={}){assert(['has_app_capability','get_invoice_receival_source'].includes(name));if(name==='has_app_capability')return {data:true,error:null};assert.equal(args.p_source_id,sourceId);return {data:structuredClone(source),error:null};},from(){throw Error('No business lookup is needed for this protocol-only clarification');},storage:{from(bucket:string){assert.equal(bucket,'invoice-receival-originals');return {async download(path:string){assert.equal(path,source.storagePath);return {data:blob,error:null};},async upload(){throw Error('Source fixture is already uploaded');},async remove(){throw Error('No cleanup occurs during this read test');}};}}};
 const metadata=async(name:string,args:Record<string,unknown>)=>{metadataCalls.push({name,args});if(name==='record_invoice_receival_source_state'){assert.equal(args.p_actor,owner);assert.equal(args.p_verified_sha256,digest);source={...source,state:'ready',version:source.version+1,verifiedAt:new Date(clock).toISOString(),agentState:args.p_state as InvoiceReceivalSourceState};return {data:structuredClone(source),error:null};}if(name==='tenbot_openai_reserve'){assert.equal(args.p_user,owner);assert.equal(args.p_model,'gpt-6.1-terra');reserves.set(String(args.p_id),Number(args.p_reserved_microusd));return {data:{ok:true,id:args.p_id,requestId:args.p_request_id,reservedMicrousd:args.p_reserved_microusd},error:null};}assert.equal(name,'tenbot_openai_settle');const measured=args.p_actual_microusd!==null;return {data:{ok:true,id:args.p_id,state:measured?'measured':'uncertain',accountedMicrousd:measured?args.p_actual_microusd:reserves.get(String(args.p_id)),overrun:false},error:null};};
 const fetcher:typeof fetch=async(input,init)=>{const u=new URL(String(input));assert.equal(u.origin,'https://api.openai.com');const body=JSON.parse(String(init?.body));requests.push({path:u.pathname,body});if(u.pathname==='/v1/responses/input_tokens')return Response.json({object:'response.input_tokens',input_tokens:500});assert.equal(u.pathname,'/v1/responses');if(outage)return Response.json({error:{message:'Synthetic outage'}},{status:503});const vision=String(body.instructions).startsWith('Transcribe the submitted original'),final=vision?{raw_lines:['T&M Supply','Invoice SYN-PROTOCOL','AW-1 Alaska White 150 LB']}:{answer:'Which Job should these materials be associated with?',observations:[],inferences:[],recommendations:[],questions:['Which Job should these materials be associated with?'],completed_actions:[]};return Response.json({status:'completed',model:'gpt-6.1-terra',service_tier:'default',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(final)}]}],usage:{input_tokens:100,output_tokens:10,input_tokens_details:{cached_tokens:0,cache_write_tokens:0}}});};
 const runtime=createHostedReceivalRuntime({owner,origin:'https://tendev.pages.dev',pilot:{...config,expiresAt:new Date(clock+3600000).toISOString()},openAI:{enabled:true,origins:['https://tendev.pages.dev'],apiKey:'offline-invalid-key-never-sent-to-network',keyExpiresAt:new Date(clock+3600000).toISOString(),spendingAuthorized:true},caller,service:metadata,fetcher,now:()=>clock});
 return {runtime,sourceId,requests,metadataCalls,caller};
}
await check('one shared request meter covers original vision and later investigation, without assistant-history persistence',async()=>{
 const f=meteredRuntime();const r=await f.runtime({action:'ask',attachmentId:f.sourceId,question:'Prepare the invoice.',orderDetails:{}},owner,f.caller) as {agent:{status:string};localDemo:{draft:unknown}};
 assert.equal(r.agent.status,'completed');assert.equal(r.localDemo.draft,null);assert.equal(f.requests.filter(x=>x.path==='/v1/responses').length,2);assert.equal(f.requests.filter(x=>x.path.endsWith('/input_tokens')).length,1);
 const reserves=f.metadataCalls.filter(x=>x.name==='tenbot_openai_reserve'),settles=f.metadataCalls.filter(x=>x.name==='tenbot_openai_settle');assert.equal(reserves.length,2);assert.equal(new Set(reserves.map(x=>x.args.p_request_id)).size,1);assert.equal(settles.length,2);assert(settles.every(x=>x.args.p_actual_microusd===150));assert(f.metadataCalls.every(x=>['tenbot_openai_reserve','tenbot_openai_settle','record_invoice_receival_source_state'].includes(x.name)));
});
await check('uncertain original inference retains reservation and stops further model dispatch in the turn',async()=>{
 const f=meteredRuntime(true);const body={action:'ask',attachmentId:f.sourceId,question:'Prepare the invoice.',orderDetails:{}};await assert.rejects(f.runtime(body,owner,f.caller));assert.equal(f.requests.filter(x=>x.path==='/v1/responses').length,1);const settles=f.metadataCalls.filter(x=>x.name==='tenbot_openai_settle');assert.equal(settles.length,1);assert.equal(settles[0].args.p_actual_microusd,null);const count=f.requests.length;await assert.rejects(f.runtime(body,owner,f.caller));assert.equal(f.requests.length,count);assert(!f.metadataCalls.some(x=>x.name==='record_invoice_receival_source_state'));
});
const report={passed:true,groups:checks.length,checks,mode:'Offline hosted adapter/authorization-metadata/canonical RPC wiring doubles only',actualInference:false,actualDatabase:false,productionMutations:0};
const dir='/private/tmp/tenops-tenbot-receival-readiness-20261030';mkdirSync(dir,{recursive:true});writeFileSync(dir+'/hosted-contract-offline.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
