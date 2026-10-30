import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {createAuthenticatedReceivalAgent,type ReceivalAgentCaller} from './support/tenbot-receival-agent.mjs';
import {decodeInvoiceAttachment,extractInvoiceDocument} from './support/tenbot-invoice-attachment.mjs';
import {createScriptedTenbotAgentProvider} from './support/tenbot-agent-scripted.mjs';
import {emptyUsage,type AgentProvider} from '../supabase/functions/_shared/tenbot-agent';
import {editableRows,type LocalReceivalDraft} from '../src/modules/tenbot/live-review';
import {deriveInvoiceQuantity} from '../src/modules/inventory/invoice-quantity';
import {combinePurchasingCatalogRecords} from '../src/modules/purchasing/catalog-records';

// OFFLINE WIRING ONLY. Caller SELECT/RPC replies and image transcription are
// explicit test doubles. No key, environment file, paid provider, server,
// database or Docker is loaded. This does not certify JWT, RLS or transactions.
type Row=Record<string,unknown>;
const fixture=JSON.parse(readFileSync(new URL('./fixtures/tenbot-invoice.synthetic.json',import.meta.url),'utf8'));
const png=readFileSync(new URL('./fixtures/tenbot-invoice-live-demo.png',import.meta.url));
const owner='10282026-0000-4000-8000-000000000021',other='10282026-0000-4000-8000-000000000022';
const clone=<T,>(value:T):T=>structuredClone(value);
const standard:Row[]=(fixture.catalog.standard as Row[]).map((row,index):Row=>({...row,id:`10282026-0000-4000-8000-${String(index+101).padStart(12,'0')}`}));
const checks:string[]=[];
async function test(name:string,run:()=>void|Promise<void>){await run();checks.push(name);}
async function rejected(call:Promise<unknown>,status?:number){await assert.rejects(call,(error:unknown)=>{assert(error instanceof Error);if(status!==undefined)assert.equal((error as Error&{status:number}).status,status);assert(!error.message.includes(png.toString('base64')));return true;});}
function setup(options:{rawLines?:unknown;providerFailure?:boolean;prepareOwner?:string;receivals?:Row[];scopeOnly?:boolean}={}){
 let now=Date.parse('2026-10-29T15:00:00Z'),providers=0,steps=0,extractions=0;
 const denied=new Set<string>(),reads:{table:string;columns:string}[]=[],rpcCalls:{name:string;args:Row}[]=[];
 function callerFor(who:string):ReceivalAgentCaller{
  return {from(table:string){
   assert(['vendor_catalog','vendor_catalog_v2','pending_receivals','jobs','production_rework_cycles'].includes(table),'fixed read table');
   let columns='',start=0,end=249,term='',selectedIds:readonly string[]|undefined;
   const query={
    select(value:string){columns=value;reads.push({table,columns});assert(!value.includes('*'),'fixed bounded projection');return query;},
    eq(){return query;},is(){return query;},not(){return query;},in(column:string,ids:readonly string[]){if(column==='id')selectedIds=ids;return query;},gte(){return query;},lte(){return query;},or(filter:string){const pattern=filter.match(/\.ilike\.("(?:\\.|[^"])*")/);if(pattern)term=String(JSON.parse(pattern[1])).replace(/^%|%$/g,'').toLowerCase();return query;},order(){return query;},limit(){return query;},
    range(first:number,last:number){start=first;end=last;return query;},abortSignal(signal:AbortSignal){assert(!signal.aborted);return query;},
    then(resolve:(value:{data:Row[];count:number;error:null})=>unknown,reject?:(error:unknown)=>unknown){
     const source:Row[]=table==='vendor_catalog'?standard:table==='pending_receivals'?(options.receivals??fixture.receivals.rows):[];
     const selection=selectedIds,visible=selection?source.filter(row=>selection.includes(String(row.id))):source;
     const rows=term?visible.filter(row=>Object.values(row).some(value=>typeof value==='string'&&value.toLowerCase().includes(term))):visible;
     const projected=rows.slice(start,end+1).map(row=>Object.fromEntries(columns.split(',').map(key=>[key,row[key]??null])));
     return Promise.resolve({data:clone(projected),count:rows.length,error:null}).then(resolve,reject);
    },
   };return query;
  },async rpc(name:string,args:Row={}){
   rpcCalls.push({name,args:clone(args)});
   if(name==='has_app_capability')return {data:!denied.has(String(args.p_capability)),error:null};
   if(name==='revoke_invoice_receival_draft')return {data:{draftId:args.p_draft_id,hash:args.p_expected_hash,revoked:true},error:null};
   assert.equal(name,'prepare_invoice_receival_draft','no approval/execution or unrelated RPC is allowed by this offline caller');
   const offers=combinePurchasingCatalogRecords(standard,[]);
   const lines=(args.p_lines as Row[]).map(line=>{const catalog=standard.find(row=>row.id===line.catalogId),offer=offers.find(row=>row.id===line.catalogId);assert(catalog&&offer,'prepared line must map to existing fixture catalog');return {...line,vendor:catalog.vendor,material:catalog.item_name,size:catalog.size,category:catalog.category,jobLabel:null,catalogSnapshot:clone(catalog),vendorSnapshot:null,duplicateReview:null,quantityBasis:deriveInvoiceQuantity(line.sourceQuantity as {quantity:string;unit:string},{orderUnit:offer.orderUnit||offer.containerType,packageQuantity:offer.packageQuantity,packageMeasure:offer.packageMeasure,containerType:offer.containerType},String(line.sourceText))};});
   const normalized={schemaVersion:'invoice-receivals.v2',authorizationVersion:'e'.repeat(64),document:args.p_document,metadata:args.p_metadata,provenance:args.p_provenance,lines};
   return {data:{id:'10282026-0000-4000-8000-000000000301',hash:createHash('sha256').update(JSON.stringify(normalized)).digest('hex'),ownerId:options.prepareOwner??who,expiresAt:new Date(now+3600000).toISOString(),...normalized},error:null};
  }};
 }
 const handler=createAuthenticatedReceivalAgent({model:'offline-transport-double',now:()=>now,remainingUsd:()=>5,assertNoFatal(){},createProvider(_label,image){
  providers++;
  if(image)return {name:'OFFLINE transcription double, not live vision',model:'offline',async step(request){steps++;extractions++;assert.equal(request.tools.length,0);assert.equal(request.maxOutputTokens,1800);assert(request.instructions.includes('untrusted data'));if(options.providerFailure)throw Error('injected offline provider failure');return {calls:[],continuation:[],usage:emptyUsage(),final:{raw_lines:options.rawLines??fixture.document.text.split('\n')}};}} as AgentProvider;
  if(options.scopeOnly){let index=0;return {name:'OFFLINE scope lifecycle double',model:'offline',async step(){steps++;index++;return {calls:index===1?[{id:'discover',name:'discover_capabilities',arguments:{names:['describe_assistant_scope']}}]:index===2?[{id:'scope',name:'describe_assistant_scope',arguments:{}}]:[],continuation:[],usage:emptyUsage(),...(index===3?{final:{answer:'Explain the bounded scope.',observations:[{text:'No execution.',evidence_ids:['e1']}],inferences:[],recommendations:[],questions:[],completed_actions:[]}}:{})};}} as AgentProvider;}
  const scripted=createScriptedTenbotAgentProvider('invoice-preparation');return {...scripted,async step(request){steps++;return scripted.step(request);}};
 }});
 const invoke=(body:Row,who=owner)=>handler(body,who,callerFor(who)) as Promise<Row>;
 const attachment=(overrides:Row={})=>({filename:'approved-synthetic.png',mediaType:'image/png',dataBase64:png.toString('base64'),...overrides});
 const upload=(overrides:Row={})=>invoke({action:'upload',syntheticConfirmed:true,attachment:attachment(),...overrides});
 async function prepared(){const a=await upload(),answer=await invoke({action:'ask',attachmentId:a.attachmentId,question:'Prepare pending receivals from this synthetic invoice.',orderDetails:fixture.confirmedMetadataExample});const local=answer.localDemo as {draft:LocalReceivalDraft};assert(local.draft,'scripted tool fixture must produce a draft');return {attachmentId:a.attachmentId,answer,draft:local.draft};}
 const edits=(draft:LocalReceivalDraft)=>editableRows(draft).map(row=>({...row,excluded:row.excluded||Boolean(draft.rows.find(source=>source.lineId===row.lineId)?.reasons.length)}));
 const review=(draft:LocalReceivalDraft,body:Row={})=>invoke({action:'review',draftId:draft.id,revision:draft.revision,edits:edits(draft),orderDetails:fixture.confirmedMetadataExample,...body}) as Promise<Row&{draft:LocalReceivalDraft}>;
 return {invoke,attachment,upload,prepared,edits,review,reads,rpcCalls,denied,providers:()=>providers,steps:()=>steps,extractions:()=>extractions,advance(ms:number){now+=ms;}};
}

await test('missing caller and each required capability fail before provider creation or record reads',async()=>{
 const h=setup();await rejected(h.invoke({action:'status'},''),401);
 for(const cap of ['readOperationalData','writeBusinessData','adjustInventory']){const denied=setup();denied.denied.add(cap);await rejected(denied.upload(),403);assert.equal(denied.providers(),0);assert.equal(denied.reads.length,0);assert(denied.rpcCalls.every(call=>call.name==='has_app_capability'));}
});
await test('status uses fixed caller-read projections and explicitly disables real execution',async()=>{
 const h=setup(),status=await h.invoke({action:'status'});assert.equal(status.mode,'authenticated-receivals');assert.equal(status.simulation,false);assert.equal(status.executionEnabled,false);assert.equal((status.catalog as Row[]).length,5);assert.equal((status.jobs as Row[]).length,0);assert(String(status.blockedReason).includes('database-backed release gates'));assert.equal(h.providers(),0);assert(h.reads.length>0);assert(h.rpcCalls.every(call=>call.name==='has_app_capability'));
});
await test('read-only employees retain conversational help without acquiring invoice preparation',async()=>{
 const h=setup();h.denied.add('writeBusinessData');h.denied.add('adjustInventory');
 const status=await h.invoke({action:'status'});assert.equal(status.canPrepare,false);
 const answer=await h.invoke({action:'ask',question:'How do pending receivals differ from on-hand Inventory?'});
 assert(answer.agent);assert(h.providers()>0);assert.equal((answer.localDemo as Row).draft,null);
 assert(!h.rpcCalls.some(call=>call.name==='prepare_invoice_receival_draft'));
 await rejected(h.upload(),403);
});
await test('authenticated help history is owner-scoped and reauthorizes without inference or business-record reads',async()=>{
 const h=setup({scopeOnly:true});h.denied.add('writeBusinessData');h.denied.add('adjustInventory');
 const answer=await h.invoke({action:'ask',question:'Can you run SQL?'});assert.equal(answer.contentScope,'scope');assert.equal(h.reads.length,0);
 const before=h.providers(),steps=h.steps(),history=await h.invoke({action:'history',conversationId:answer.conversationId});
 assert.equal((history.turns as Row[]).length,1);assert.equal(((history.turns as Row[])[0].answer as Row).message,answer.message);assert.equal(h.providers(),before);assert.equal(h.steps(),steps);assert.equal(h.reads.length,0);
 assert(h.rpcCalls.every(call=>call.name==='has_app_capability'));
 await rejected(h.invoke({action:'history',conversationId:answer.conversationId},other),403);
 h.denied.add('readOperationalData');await rejected(h.invoke({action:'history',conversationId:answer.conversationId}),403);h.denied.delete('readOperationalData');
 await h.invoke({action:'clear',conversationId:answer.conversationId});await rejected(h.invoke({action:'history',conversationId:answer.conversationId}),403);
 assert.equal(h.providers(),before);assert.equal(h.reads.length,0);
});
await test('synthetic consent and strict upload fields are required without model calls',async()=>{
 const h=setup();for(const override of [{syntheticConfirmed:false},{syntheticConfirmed:'true'},{unexpected:'value'}])await rejected(h.upload(override));
 for(const change of [{mediaType:'application/pdf'},{filename:'bad\n.png'},{dataBase64:'AAAA'},{dataBase64:Buffer.alloc(90001).toString('base64')},{unexpected:true}])await rejected(h.upload({attachment:h.attachment(change)}));
 assert.equal(h.providers(),0);assert(h.rpcCalls.every(call=>call.name==='has_app_capability'));
});
await test('Sharp validates real PNG bytes, MIME, dimensions and deterministic source digest',async()=>{
 const h=setup(),decoded=await decodeInvoiceAttachment(h.attachment());assert.equal(decoded.bytes.length,png.length);assert.equal(decoded.sha256,createHash('sha256').update(png).digest('hex'));assert.equal(decoded.mediaType,'image/png');
 await rejected(decodeInvoiceAttachment(h.attachment({mediaType:'image/jpeg'})));
 const wide=await sharp({create:{width:1025,height:1,channels:3,background:'#ffffff'}}).png().toBuffer();await rejected(decodeInvoiceAttachment(h.attachment({dataBase64:wide.toString('base64')})));
 assert.equal(h.providers(),0);
});
await test('uploaded bytes are owner-isolated and clearing before ask prevents all inference',async()=>{
 const h=setup(),a=await h.upload();assert.equal(a.simulation,false);assert(!JSON.stringify(a).includes(png.toString('base64')));
 await rejected(h.invoke({action:'ask',attachmentId:a.attachmentId,question:'Read invoice.'},other),403);await rejected(h.invoke({action:'clear',attachmentId:a.attachmentId},other),403);
 const cleared=await h.invoke({action:'clear',attachmentId:a.attachmentId});assert.equal(cleared.cleared,true);await rejected(h.invoke({action:'ask',attachmentId:a.attachmentId,question:'Read invoice.'}),403);assert.equal(h.providers(),0);
});
await test('unknown drafts and attachment expiry fail before inference or canonical prepare',async()=>{
 const h=setup();await rejected(h.invoke({action:'review',draftId:'unknown'}),403);await rejected(h.invoke({action:'approve',draftId:'unknown'}),409);
 const a=await h.upload();h.advance(3600001);await rejected(h.invoke({action:'ask',attachmentId:a.attachmentId,question:'Read invoice.'}),403);assert.equal(h.providers(),0);assert(h.rpcCalls.every(call=>call.name==='has_app_capability'));
});
await test('offline extraction rejects tool calls or malformed output and propagates provider failure safely',async()=>{
 for(const options of [{rawLines:[]},{rawLines:['x'.repeat(401)]},{providerFailure:true}]){const h=setup(options),a=await h.upload();await rejected(h.invoke({action:'ask',attachmentId:a.attachmentId,question:'Prepare invoice.'}));assert.equal(h.providers(),1);assert(h.rpcCalls.every(call=>call.name==='has_app_capability'));}
 const h=setup(),image=await decodeInvoiceAttachment(h.attachment());await rejected(extractInvoiceDocument({id:'offline-document',filename:'test.png',image,model:'offline',remainingUsd:5,assertNoFatal(){},provider:{name:'offline invalid call fixture',model:'offline',async step(){return {calls:[{id:'not-allowed',name:'execute',arguments:{}}],continuation:[],usage:emptyUsage(),final:{raw_lines:['supplier']}};}}}),503);
});
await test('scripted reasoning traverses actual read/prepare tools, then exact canonical draft mapping',async()=>{
 const h=setup(),p=await h.prepared();assert.equal(h.extractions(),1);assert.equal(p.draft.simulation,false);assert.equal(p.draft.executionEnabled,false);assert.equal(p.draft.canApprove,false);assert.equal(p.draft.rows.length,6);assert.equal(p.draft.rows.filter(row=>!row.excluded&&!row.reasons.length).length,2,JSON.stringify(p.draft.rows));
 assert(h.reads.some(read=>read.table==='vendor_catalog'));assert(h.reads.some(read=>read.table==='pending_receivals'));
 const r=await h.review(p.draft),prepared=h.rpcCalls.filter(call=>call.name==='prepare_invoice_receival_draft');assert.equal(prepared.length,1);const args=prepared[0].args,lines=args.p_lines as Row[];assert.equal(lines.length,2);assert.deepEqual(lines.map(line=>line.quantityExpected),['2','1']);assert.deepEqual(lines.map(line=>line.unit),['Bag','Pail']);assert(lines.every(line=>line.catalogSource==='standard'&&standard.some(row=>row.id===line.catalogId)));assert(lines.every(line=>line.productionJobId===null));
 assert.deepEqual(args.p_metadata,fixture.confirmedMetadataExample);assert.equal((args.p_document as Row).sha256,createHash('sha256').update(png).digest('hex'));assert.equal((args.p_document as Row).reference,'SYN-INV-1042');assert.equal((args.p_provenance as Row).sourceMediaType,'image/png');assert.equal(r.draft.revision,2);assert(r.draft.durableDraftId&&r.draft.durableHash);assert.notEqual(r.draft.hash,r.draft.durableHash);assert.equal(r.draft.executionEnabled,false);assert.equal(r.draft.canApprove,true);assert(h.steps()>2);
});
await test('review requires owner, exact revision/rows and immutable pending-only source identity',async()=>{
 const h=setup(),p=await h.prepared();await rejected(h.invoke({action:'review',draftId:p.draft.id},other),403);await rejected(h.review(p.draft,{revision:0}),409);await rejected(h.review(p.draft,{edits:h.edits(p.draft).slice(1)}),409);
 const invalid=h.edits(p.draft);invalid[0].materialId='arbitrary';await rejected(h.review(p.draft,{edits:invalid}));const freight=h.edits(p.draft);freight.find(row=>row.lineId===p.draft.rows.find(row=>row.reasons.includes('non_material_line'))!.lineId)!.excluded=false;await rejected(h.review(p.draft,{edits:freight}));assert.equal(h.rpcCalls.filter(call=>call.name==='prepare_invoice_receival_draft').length,0);
});
await test('a received invalid edit revokes the old durable review before validation and blocks stale approval',async()=>{
 const h=setup(),p=await h.prepared(),saved=await h.review(p.draft),before=h.rpcCalls.length;
 const edits=h.edits(saved.draft),included=edits.find(row=>!row.excluded)!;included.quantity=String(Number(included.quantity)+1);
 await rejected(h.review(saved.draft,{edits}),409);
 const calls=h.rpcCalls.slice(before).filter(call=>call.name!=='has_app_capability');assert.equal(calls[0]?.name,'revoke_invoice_receival_draft');assert.equal(calls[0]?.args.p_draft_id,saved.draft.durableDraftId);assert(!calls.some(call=>/approve|execute|prepare/.test(call.name)));
 await rejected(h.invoke({action:'approve',draftId:saved.draft.id,revision:saved.draft.revision,hash:saved.draft.hash,confirmation:true,durableDraftId:saved.draft.durableDraftId,durableHash:saved.draft.durableHash}),409);
});
await test('clearing an unexecuted attachment revokes its durable approval before removing local state',async()=>{
 const h=setup(),p=await h.prepared(),saved=await h.review(p.draft),before=h.rpcCalls.length;
 await h.invoke({action:'clear',attachmentId:p.attachmentId});const calls=h.rpcCalls.slice(before).filter(call=>call.name!=='has_app_capability');assert.deepEqual(calls.map(call=>call.name),['revoke_invoice_receival_draft']);assert.equal(calls[0].args.p_draft_id,saved.draft.durableDraftId);
 await rejected(h.review(saved.draft),403);
});
await test('execution mode is host configuration and cannot be supplied by a client request',async()=>{
 const h=setup();await rejected(h.invoke({action:'status',executionEnabled:true}));assert(!h.rpcCalls.some(call=>/approve|execute|prepare/.test(call.name)));assert.equal(h.providers(),0);
});
await test('P1 authenticated held package quantities retain conversion and reject raw scalars before canonical prepare',async()=>{
 const receivals=[{...fixture.receivals.rows[0],id:'held-aw',material_name:'Alaska White',size:'#1',quantity_expected:'3'},{...fixture.receivals.rows[0],id:'held-res',material_name:'Clear Resin',size:'Part A',quantity_expected:'2',unit:'Pail'}],rawLines=fixture.document.text.replace('100 LB','150 LB').replace('5 GAL','10 GAL').split('\n'),h=setup({rawLines,receivals}),{draft}=await h.prepared(),target=(row:{materialId:string|null})=>row.materialId?.endsWith(String(standard[0].id))||row.materialId?.endsWith(String(standard[4].id)),targets=draft.rows.filter(target);
 assert.deepEqual(targets.map(row=>[row.quantity,row.unit,row.sourceQuantity]),[['3','Bag',{quantity:'150',unit:'LB'}],['2','Pail',{quantity:'10',unit:'GAL'}]]);assert(targets.every(row=>row.reasons.includes('potential_duplicate')));
 const edits=h.edits(draft);for(const row of edits){row.excluded=!target(row);if(target(row))row.quantity=row.materialId!.endsWith(String(standard[0].id))?'150':'10';}
 await rejected(h.review(draft,{edits}),409);assert.equal(h.rpcCalls.filter(call=>call.name==='prepare_invoice_receival_draft').length,0);
 for(const injection of [{sourceQuantity:{quantity:'150',unit:'Bag'}},{quantityBasis:{receivalQuantity:'150'}}])await rejected(h.review(draft,{edits:edits.map((row,index)=>index?row:{...row,...injection})}));
 assert.equal(h.rpcCalls.filter(call=>call.name==='prepare_invoice_receival_draft').length,0);assert(h.rpcCalls.every(call=>!['approve_invoice_receival_draft','execute_invoice_receival_draft'].includes(call.name)));
});
await test('permission revocation and a mismatched durable owner cannot publish an approved draft',async()=>{
 const revoked=setup(),a=await revoked.upload();revoked.denied.add('adjustInventory');await rejected(revoked.invoke({action:'ask',attachmentId:a.attachmentId,question:'Prepare invoice.'}),403);assert.equal(revoked.providers(),0);
 const h=setup({prepareOwner:other}),p=await h.prepared();await rejected(h.review(p.draft),403);assert.equal(h.rpcCalls.filter(call=>call.name==='prepare_invoice_receival_draft').length,1);assert(h.rpcCalls.every(call=>!['approve_invoice_receival_draft','execute_invoice_receival_draft'].includes(call.name)));
});
await test('exact explicit approval remains host-blocked before approval or execution RPC, including replay',async()=>{
 const h=setup(),p=await h.prepared(),r=await h.review(p.draft),draft=r.draft;
 const body={action:'approve',draftId:draft.id,revision:draft.revision,hash:draft.hash,durableDraftId:draft.durableDraftId,durableHash:draft.durableHash,confirmation:true};
 for(const change of [{confirmation:false},{hash:'stale'},{durableHash:'stale'}])await rejected(h.invoke({...body,...change}),409);
 for(let i=0;i<2;i++)await rejected(h.invoke(body),503);
 assert(h.rpcCalls.every(call=>!['approve_invoice_receival_draft','execute_invoice_receival_draft'].includes(call.name)));
 assert(h.reads.every(read=>!read.columns.includes('on_hand')));
});

await test('completed receipt retries reconcile later receiving/edits without another write, but initial mismatch and missing IDs fail closed',async()=>{
 const now=Date.parse('2026-10-30T15:00:00Z'),draftId='10282026-0000-4000-8000-000000000301',recordId='10282026-0000-4000-8000-000000000401',draftHash='d'.repeat(64),catalog=standard[0],offer=combinePurchasingCatalogRecords(standard,[]).find(item=>item.id===catalog.id)!;
 const sourceQuantity={quantity:'100',unit:'LB'},sourceText='Synthetic material 100 LB (50 LB Bag)';
 const line={sourceLineId:'retry:L1',catalogSource:'standard',catalogId:String(catalog.id),quantityExpected:'2',unit:'Bag',productionJobId:null,sourceQuantity,sourceText,newMaterial:null,duplicateAcknowledgement:null,vendor:catalog.vendor,material:catalog.item_name,size:catalog.size,category:catalog.category,jobLabel:null,catalogSnapshot:clone(catalog),vendorSnapshot:null,quantityBasis:deriveInvoiceQuantity(sourceQuantity,{orderUnit:offer.orderUnit||offer.containerType,packageQuantity:offer.packageQuantity,packageMeasure:offer.packageMeasure,containerType:offer.containerType},sourceText),duplicateReview:null};
 const receipt={draftId,hash:draftHash,createdRecordIds:[recordId],createdCatalogRecords:[],idempotent:true,executedAt:new Date(now-1000).toISOString()};
 const durable={schemaVersion:'invoice-receivals.v2',authorizationVersion:'e'.repeat(64),id:draftId,hash:draftHash,ownerId:owner,expiresAt:new Date(now+3600000).toISOString(),document:{sha256:'a'.repeat(64),supplier:String(catalog.vendor),reference:'OFFLINE-RETRY',documentDate:null},metadata:fixture.confirmedMetadataExample,provenance:{model:'offline',sourceMediaType:'image/png',extractionSha256:'b'.repeat(64),toolTraceSha256:'c'.repeat(64)},lines:[line]};
 const original={id:recordId,status:'pending',quantity_expected:'2',quantity_received:'0',unit:'Bag',vendor:catalog.vendor,material_name:catalog.item_name,size:catalog.size,production_job_id:null};
 async function run(rows:Row[],completed=true){
  const calls:string[]=[];
  const caller:ReceivalAgentCaller={async rpc(name,args={}){calls.push(name);if(name==='has_app_capability')return {data:true,error:null};if(name==='get_invoice_receival_draft')return {data:{...clone(durable),...(completed?{execution:receipt}:{})},error:null};if(name==='approve_invoice_receival_draft')return {data:{id:'10282026-0000-4000-8000-000000000501',draftId,hash:draftHash,expiresAt:durable.expiresAt},error:null};assert.equal(name,'execute_invoice_receival_draft');assert.equal(args.p_draft_id,draftId);return {data:{...receipt,idempotent:false},error:null};},from(table){assert.equal(table,'pending_receivals');return {select(columns:string){assert(!columns.includes('*'));return {in(column:string,ids:string[]){assert.equal(column,'id');assert.deepEqual(ids,[recordId]);return {abortSignal(signal:AbortSignal){assert(!signal.aborted);return Promise.resolve({data:clone(rows),error:null});}};}};}};}};
  const handler=createAuthenticatedReceivalAgent({model:'offline-no-inference',now:()=>now,remainingUsd:()=>0,assertNoFatal(){},createProvider(){throw Error('Reconciliation must not infer.');},execution:{enabled:true,databaseEnvironment:'isolated-test'}});
  const response=handler({action:'approve',draftId:'lost-local-review',revision:2,hash:'f'.repeat(64),durableDraftId:draftId,durableHash:draftHash,confirmation:true},owner,caller) as Promise<Row>;
  return {response,calls};
 }
 for(const changed of [{...original,status:'received',quantity_received:'2'},{...original,quantity_expected:'3',material_name:'Later authorized correction'}]){
  const r=await run([changed]),result=await r.response;assert.equal(result.idempotent,true);assert.equal(result.createdCount,0);assert.deepEqual(result.createdRecordIds,[recordId]);assert.deepEqual(result.receivals,[changed]);assert(String(result.notice).includes('changed since creation'));assert(!r.calls.some(name=>/^(approve|execute)_invoice_receival/.test(name)));
 }
 const fresh=await run([original],false);assert.equal((await fresh.response).createdCount,1);assert.equal(fresh.calls.filter(name=>name==='execute_invoice_receival_draft').length,1);
 const mismatch=await run([{...original,status:'received',quantity_received:'2'}],false);await rejected(mismatch.response,503);
 const hidden=await run([]);await rejected(hidden.response,503);assert(!hidden.calls.some(name=>/^(approve|execute)_invoice_receival/.test(name)));
 const wrong=await run([{...original,id:'10282026-0000-4000-8000-000000000402'}]);await rejected(wrong.response,503);
});

console.log(JSON.stringify({status:'pass',mode:'OFFLINE controller, attachment decode and caller-contract wiring only; scripted extraction/reasoning, simulated SELECT/RPC replies; no JWT/RLS/transaction claim',groups:checks.length,checks,inferenceCalls:0,databaseWrites:0},null,2));
