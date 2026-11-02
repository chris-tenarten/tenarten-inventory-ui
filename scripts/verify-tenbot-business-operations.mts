/** Model-free composition checks with injected read-only sources. No network,
 * inference, Auth sign-in, database/Storage writes or transaction certification. */
import assert from 'node:assert/strict';
import {createBusinessOperations,createCallerBusinessLookup,callerBusinessDependencies,type BusinessPreparedAction,type BusinessOperationsDependencies,type BusinessDocumentRead} from '../supabase/functions/_shared/tenbot-business-operations';
import type {InvoiceReceivalSource} from '../src/modules/inventory/invoice-receival-attachments';
import {runTenbotAgent,emptyUsage,type AgentTool,type JsonValue,type AgentStep} from '../supabase/functions/_shared/tenbot-agent';
import type {JobToolCaller} from '../supabase/functions/_shared/tenbot-job-tools';

const owner='20000000-0000-4000-8000-000000000001',sourceId='20000000-0000-4000-8000-000000000002',catalogId='20000000-0000-4000-8000-000000000003',orderId='20000000-0000-4000-8000-000000000004';
const raw=['Supplier: T&M Supply','Invoice: SYN-BUSINESS-1','AW-1 | Alaska White | #1 | 100 LB (50 LB Bag)','Freight: 10 USD'];
const catalog={id:catalogId,vendor:'T&M Supply',vendor_sku:'AW-1',item_name:'Alaska White',size:'#1',category:'Aggregate',material_class:'Marble chips',unit:'50 LB Bag'};
const source:InvoiceReceivalSource={id:sourceId,ownerId:owner,filename:'synthetic-invoice.pdf',mediaType:'application/pdf',byteSize:20,sha256:'a'.repeat(64),storageBucket:'invoice-receival-originals',storagePath:`${owner}/${sourceId}/original`,state:'ready',createdAt:'2026-11-02T00:00:00Z',expiresAt:'2099-11-03T00:00:00Z',version:2,verifiedAt:'2026-11-02T00:01:00Z',retainedAt:null,retainedDraftId:null,evidenceSha256:'b'.repeat(64),agentState:{version:'invoice-receival-state.v1',originalSha256:'a'.repeat(64),visionSha256:'a'.repeat(64),rawLines:raw,sourceRows:[{lineId:`${sourceId}:L3`,sourceText:raw[2],sourceQuantity:{quantity:'100',unit:'LB'}}],draft:null,traceHash:null}};
const clone=<T,>(value:T):T=>structuredClone(value);
const context={callerId:owner,signal:AbortSignal.timeout(30000)};
const request:Record<string,JsonValue>={source_id:sourceId,supplier_source_ref:`${sourceId}:L1`,document_reference_source_ref:`${sourceId}:L2`,ordered_by:'Synthetic Employee',order_date:'2026-11-02',location:'Denton',lines:[{source_ref:`${sourceId}:L3`,catalog_source:'standard',catalog_id:catalogId,source_quantity:'100',source_unit:'LB',quantity_expected:'2',unit:'Bag',production_job_id:null}]};
function fixture(){
 let allowed=true;const calls:string[]=[],mutable={source:clone(source),receivals:[] as Record<string,unknown>[],catalog:[clone(catalog)],complete:true};
 const deps:BusinessOperationsDependencies={ownerId:owner,async can(cap){calls.push('can:'+cap);return allowed;},originals:{async download(id){calls.push('download');assert.equal(id,sourceId);return {source:clone(mutable.source),original:new Blob(['%PDF-synthetic source'],{type:'application/pdf'})};}},reader:{async searchCatalog(term){calls.push('search');assert(term.length);return {complete:mutable.complete,standard:clone(mutable.catalog),specialty:[]};},async readCatalog(_signal,ids){calls.push('readCatalog');return {complete:mutable.complete,standard:clone(mutable.catalog.filter(row=>ids?.some(id=>id.source==='standard'&&id.id===row.id))),specialty:[]};},async readReceivals(){calls.push('receivals');return {complete:mutable.complete,rows:clone(mutable.receivals)};}},lookup:{async suppliers(query){calls.push('suppliers');return {complete:true,suppliers:[{id:owner,name:query}]};},async getOrder(id){calls.push('order');assert.equal(id,orderId);return {status:'ok',complete:true,order:{id,po_number:'SYN-PO-1'},lines:[{material:'Alaska White',quantity:'2',unit:'Bag'}]};}}};
 return {deps,mutable,calls,tools:()=>createBusinessOperations(deps),revoke(){allowed=false;}};
}
function call(tools:AgentTool[],name:string,args:Record<string,JsonValue>,ctx=context){const tool=tools.find(t=>t.name===name);assert(tool,name);return tool.execute(args,ctx);}
const checks:string[]=[];
async function test(name:string,run:()=>Promise<void>){await run();checks.push(name);}
function action(result:{proposal?:JsonValue}){assert(result.proposal);return result.proposal as unknown as BusinessPreparedAction;}

await test('catalog search is independent of document reading and has no creation side effect',async()=>{const f=fixture(),r=await call(f.tools(),'search_material_catalog',{query:'AW-1'});assert(JSON.stringify(r.data).includes('Alaska White'));assert(!r.proposal);assert(!f.calls.includes('download'));assert(!f.calls.includes('receivals'));});
await test('comparison objective composes document, catalog, order and receival reads without preparing an action',async()=>{const f=fixture(),tools=f.tools();const results=[];results.push(await call(tools,'read_supplied_document',{source_id:sourceId}));results.push(await call(tools,'get_order',{order_id:orderId}));results.push(await call(tools,'search_material_catalog',{query:'AW-1'}));results.push(await call(tools,'find_receivals',{supplier:'T&M Supply',material:'Alaska White'}));assert(results.every(r=>!r.proposal));assert(JSON.stringify(results).includes('100 LB'));assert(!f.calls.includes('readCatalog'));});
await test('document reads expose only the exact line-bound attested quantity and keep blank preparation held',async()=>{
 const f=fixture(),tools=f.tools(),read=await call(tools,'read_supplied_document',{source_id:sourceId});
 const data=read.data as {sources:Array<{source_ref:string;text:string;source_quantity:unknown}>};
 assert.deepEqual(data.sources,raw.map((text,index)=>({source_ref:`${sourceId}:L${index+1}`,text,source_quantity:index===2?{quantity:'100',unit:'LB'}:null})));
 const quantity=data.sources[2].source_quantity as {quantity:string;unit:string};quantity.quantity='50';
 assert.equal(f.mutable.source.agentState!.sourceRows[0].sourceQuantity!.quantity,'100','Model-visible evidence is a fresh projection.');
 const input=clone(request);Object.assign((input.lines as Record<string,JsonValue>[])[0],{source_quantity:'',source_unit:'',quantity_expected:'',unit:''});
 const prepared=action(await call(tools,'prepare_pending_receivals',input));
 assert(prepared.review.issues.some(issue=>issue.code==='source_evidence_unverified'&&issue.blocking));
 assert.deepEqual((prepared.parameters.lines as Record<string,JsonValue>[])[0].sourceQuantity,{quantity:'',unit:''});
 assert.equal((prepared.parameters.lines as Record<string,JsonValue>[])[0].quantityExpected,'','Reading does not auto-fill preparation.');
});
await test('mismatched, stale, absent, duplicate and malformed source quantity evidence stays unavailable on every fresh read',async()=>{
 for(const scenario of ['line_text','line_id','original_hash','no_evidence','no_quantity','no_row','duplicate','zero','exponent','unknown_unit','padded_unit','non_string_quantity'] as const){
  const f=fixture(),tools=f.tools();await call(tools,'read_supplied_document',{source_id:sourceId});
  const state=f.mutable.source.agentState!,row=state.sourceRows[0];
  if(scenario==='line_text')row.sourceText='Different original line';
  if(scenario==='line_id')row.lineId=`${sourceId}:L4`;
  if(scenario==='original_hash')state.originalSha256='c'.repeat(64);
  if(scenario==='no_evidence')f.mutable.source.evidenceSha256=null;
  if(scenario==='no_quantity')row.sourceQuantity=null;
  if(scenario==='no_row')state.sourceRows=[];
  if(scenario==='duplicate')state.sourceRows.push(clone(row));
  if(scenario==='zero')row.sourceQuantity={quantity:'0',unit:'LB'};
  if(scenario==='exponent')row.sourceQuantity={quantity:'1e2',unit:'LB'};
  if(scenario==='unknown_unit')row.sourceQuantity={quantity:'100',unit:'unknown'};
  if(scenario==='padded_unit')row.sourceQuantity={quantity:'100',unit:' LB '};
  if(scenario==='non_string_quantity')Object.assign(row,{sourceQuantity:{quantity:100,unit:'LB'}});
  const result=await call(tools,'read_supplied_document',{source_id:sourceId}),data=result.data as {sources:Array<{source_quantity:unknown}>};
  assert(data.sources.every(line=>line.source_quantity===null),scenario);
  assert.equal(f.calls.filter(call=>call==='download').length,2,'Evidence must be fetched again, not cached from the earlier read.');
 }
});
await test('attested total equal to its parenthetical package size remains held by the unchanged canonical quantity guard',async()=>{
 const f=fixture(),state=f.mutable.source.agentState!,line='AW-1 | Alaska White | #1 | 50 LB (50 LB Bag)';
 state.rawLines[2]=line;state.sourceRows[0]={lineId:`${sourceId}:L3`,sourceText:line,sourceQuantity:{quantity:'50',unit:'LB'}};
 const tools=f.tools(),read=await call(tools,'read_supplied_document',{source_id:sourceId});
 assert.deepEqual((read.data as {sources:Array<{source_quantity:unknown}>}).sources[2].source_quantity,{quantity:'50',unit:'LB'});
 const input=clone(request);Object.assign((input.lines as Record<string,JsonValue>[])[0],{source_quantity:'50',quantity_expected:'1'});
 const prepared=action(await call(tools,'prepare_pending_receivals',input));
 assert(!prepared.review.issues.some(issue=>issue.code==='source_evidence_unverified'));
 assert(prepared.review.issues.some(issue=>issue.code==='source_quantity_is_package_size'&&issue.blocking));
 assert(prepared.review.issues.some(issue=>issue.code==='quantity_unresolved'&&issue.blocking));
});
await test('creation objective uses the same operations and direct independent preparation returns exact canonical parameters',async()=>{const f=fixture(),result=await call(f.tools(),'prepare_pending_receivals',clone(request)),p=action(result);assert.equal(p.operation,'inventory.create_pending_receivals');assert.deepEqual(p.review.issues,[]);assert.equal(p.parameters.sourceId,sourceId);const lines=p.parameters.lines as Record<string,JsonValue>[];assert.equal(lines[0].quantityExpected,'2');assert.equal(lines[0].unit,'Bag');assert.deepEqual(lines[0].sourceQuantity,{quantity:'100',unit:'LB'});assert.equal(lines[0].newMaterial,null);assert(p.review.fields.every(field=>field.editable===false));assert(!f.calls.includes('search'));assert(!JSON.stringify(result.data).includes('toolTraceSha256'));assert(!JSON.stringify(result.data).includes('parameters'));assert(JSON.stringify(result.data).includes('Received Inventory quantities will not change'));});
await test('missing-information objective reuses source and catalog without inferred metadata',async()=>{const f=fixture(),tools=f.tools();await call(tools,'read_supplied_document',{source_id:sourceId});await call(tools,'search_material_catalog',{query:'Alaska White'});const p=action(await call(tools,'prepare_pending_receivals',{...request,ordered_by:'',order_date:'',location:''}));assert.deepEqual(p.review.issues.map(i=>i.code),['missing_orderedBy','missing_orderDate','missing_location']);assert.deepEqual(p.parameters.metadata,{orderedBy:'',orderDate:'',location:''});});
await test('unready source stays read-only and cannot become an executable proposal through model extraction',async()=>{const f=fixture();f.mutable.source.state='uploading';f.mutable.source.evidenceSha256=null;f.mutable.source.agentState=null;let extractions=0;f.deps.extractDocument=async()=>{extractions++;return {id:sourceId,filename:'specification.pdf',mediaType:'text/plain',synthetic:true,text:raw.join('\n')};};const tools=f.tools();const read=await call(tools,'read_supplied_document',{source_id:sourceId});assert(JSON.stringify(read.data).includes('content_is_untrusted_data'));const p=action(await call(tools,'prepare_pending_receivals',clone(request)));assert(p.review.issues.some(i=>i.code==='source_not_ready'&&i.blocking));assert(p.review.issues.some(i=>i.code==='source_evidence_unverified'));assert.equal(f.mutable.source.agentState,null);assert.equal(extractions,2);});
await test('source quantities and units cannot silently become package totals or another measure',async()=>{for(const edit of [{quantity_expected:'100'},{unit:'KG'},{source_quantity:'50'}]){const f=fixture(),input=clone(request),lines=input.lines as Record<string,JsonValue>[];Object.assign(lines[0],edit);const p=action(await call(f.tools(),'prepare_pending_receivals',input));assert(p.review.issues.length);assert(p.review.issues.every(i=>i.blocking));}});
await test('missing catalog IDs produce held records without fabricated catalog identity',async()=>{const f=fixture(),input=clone(request),lines=input.lines as Record<string,JsonValue>[];lines[0].catalog_id=null;lines[0].catalog_source=null;const p=action(await call(f.tools(),'prepare_pending_receivals',input));assert(p.review.issues.some(i=>i.code==='catalog_match_missing'));assert.equal((p.parameters.lines as Record<string,JsonValue>[])[0].catalogId,null);});
await test('possible duplicates remain held without inventing canonical acknowledgement',async()=>{const f=fixture();f.mutable.receivals.push({id:orderId,vendor:'T&M Supply',material_name:'Alaska White',size:'#1',quantity_expected:'2',quantity_received:'0',unit:'Bag',status:'pending'});const p=action(await call(f.tools(),'prepare_pending_receivals',clone(request)));assert(p.review.issues.some(i=>i.code==='potential_duplicate'));assert.equal((p.parameters.lines as Record<string,JsonValue>[])[0].duplicateAcknowledgement,null);});
await test('unverified Job associations and conflicting supplier evidence block execution',async()=>{const f=fixture(),input=clone(request);(input.lines as Record<string,JsonValue>[])[0].production_job_id=orderId;f.mutable.source.agentState!.rawLines[0]='Supplier: Other Supply';const p=action(await call(f.tools(),'prepare_pending_receivals',input));assert(p.review.issues.some(i=>i.code==='job_review_required'));assert(p.review.issues.some(i=>i.code==='supplier_conflict'));});
await test('foreign source references, repeated lines and arbitrary arguments are rejected',async()=>{for(const edit of [{source_id:owner},{lines:[...(request.lines as JsonValue[]),...(request.lines as JsonValue[])]},{sql:'select 1'}] as Record<string,JsonValue>[]){const f=fixture();await assert.rejects(call(f.tools(),'prepare_pending_receivals',{...clone(request),...edit}),/invalid-arguments|AssertionError/);}});
await test('every read rechecks employee identity and permission before and after I/O',async()=>{const f=fixture();await assert.rejects(call(f.tools(),'search_material_catalog',{query:'AW-1'},{...context,callerId:orderId}),/invoice_session_not_authorized/);assert.equal(f.calls.length,0);const download=f.deps.originals.download;f.deps.originals.download=async id=>{const result=await download(id);f.revoke();return result;};await assert.rejects(call(f.tools(),'read_supplied_document',{source_id:sourceId}),/invoice_session_not_authorized/);});
await test('trusted document handoff occurs once after final authorization with cloned original evidence only',async()=>{
 const f=fixture(),reads:BusinessDocumentRead[]=[];let permissionChecks=0;f.deps.can=async()=>{permissionChecks++;return true;};f.deps.onDocumentRead=input=>{assert.equal(permissionChecks,4,'Handoff follows the final read permission check');reads.push(clone(input));input.lines[0].text='Callback cannot mutate model evidence';};
 const result=await call(f.tools(),'read_supplied_document',{source_id:sourceId});assert.equal(reads.length,1);assert.deepEqual(reads[0],{sourceId,ownerId:owner,lines:raw.map((text,index)=>({source_ref:`${sourceId}:L${index+1}`,text}))});assert(JSON.stringify(result.data).includes('Supplier: T&M Supply'));assert(!JSON.stringify(result.data).includes('Callback cannot mutate'));await call(f.tools(),'prepare_pending_receivals',clone(request));assert.equal(reads.length,1,'Preparation does not register a second document read');
});
await test('revoked final permission, foreign caller and foreign original never reach trusted document handoff',async()=>{
 for(const scenario of ['revoked','foreign_caller','foreign_original'] as const){const f=fixture();let callbacks=0,checks=0;f.deps.onDocumentRead=()=>{callbacks++;};if(scenario==='revoked')f.deps.can=async()=>++checks<4;if(scenario==='foreign_original')f.mutable.source.ownerId=orderId;
  await assert.rejects(call(f.tools(),'read_supplied_document',{source_id:sourceId},scenario==='foreign_caller'?{...context,callerId:orderId}:context),/invoice_session_not_authorized|invalid_invoice_evidence/);assert.equal(callbacks,0);
 }
});
await test('incomplete catalog or receival reads cannot certify absence or readiness',async()=>{const f=fixture();f.mutable.complete=false;await assert.rejects(call(f.tools(),'search_material_catalog',{query:'AW-1'}),/invoice_read_incomplete/);await assert.rejects(call(f.tools(),'prepare_pending_receivals',clone(request)),/invoice_read_incomplete/);});
await test('lookup adapter exposes only bounded fixed SELECTs and source factory has no write or execution tool',async()=>{
 const reads:{table:string;columns:string}[]=[],rpcNames:string[]=[];
 const caller={from(table:string){let columns='';const q={select(value:string){columns=value;return q;},eq(){return q;},or(){return q;},order(){return q;},range(){return q;},abortSignal(){return q;},then(resolve:(v:unknown)=>unknown){reads.push({table,columns});const data=table==='purchase_orders'?[{id:orderId,po_number:'SYN-PO-1'}]:table==='vendors'?[{id:owner,name:'T&M Supply'}]:[];return Promise.resolve({data,count:data.length,error:null}).then(resolve);}};return q;},async rpc(name:string){rpcNames.push(name);return {data:true,error:null};},storage:{from(){return {async download(){throw Error('No download requested');}};}}} as unknown as JobToolCaller&Parameters<typeof callerBusinessDependencies>[0];
 const lookup=createCallerBusinessLookup(caller);await lookup.suppliers('T&M',context.signal);await lookup.getOrder(orderId,context.signal);assert.deepEqual(reads.map(r=>r.table),['vendors','purchase_orders','purchase_order_lines','purchase_order_issuances']);assert(reads.every(r=>!r.columns.includes('*')));assert.equal(rpcNames.length,0);const tools=createBusinessOperations(callerBusinessDependencies(caller,owner));assert(tools.every(t=>t.kind==='read'||t.kind==='prepare'));assert(!tools.some(t=>/approve|execute|upload|receive_inventory/.test(t.name)));await call(tools,'find_suppliers',{query:'T&M'});assert(rpcNames.every(n=>n==='has_app_capability'));
});
await test('existing agent runtime discovers and composes the same operations for comparison, creation and missing-information objectives',async()=>{
 for(const objective of ['compare','create','missing'] as const){const f=fixture(),tools=f.tools(),names=tools.map(t=>t.name);let round=0;
  const requests=objective==='compare'?[{name:'read_supplied_document',arguments:{source_id:sourceId}},{name:'search_material_catalog',arguments:{query:'AW-1'}},{name:'get_order',arguments:{order_id:orderId}}]:[{name:'search_material_catalog',arguments:{query:'AW-1'}},{name:'read_supplied_document',arguments:{source_id:sourceId}},{name:'prepare_pending_receivals',arguments:objective==='missing'?{...request,location:''}:clone(request)}];
  const result=await runTenbotAgent({question:objective==='compare'?'Compare this invoice with my existing order.':objective==='create'?'Prepare the incoming materials for review.':'Find the missing material and order information.'},{callerId:owner,tools,authorize:async()=>true,provider:{name:'explicit scripted composition, not model reasoning',model:'offline',async step(input):Promise<AgentStep>{round++;if(round===1){assert.deepEqual(input.tools.map(t=>t.name),['discover_capabilities']);return {calls:[{id:'discovery',name:'discover_capabilities',arguments:{names}}],continuation:[],usage:emptyUsage()};}if(round===2){assert(requests.every(r=>input.tools.some(t=>t.name===r.name)));return {calls:requests.map((r,i)=>({...r,id:'operation_'+i,arguments:r.arguments as Record<string,JsonValue>})),continuation:[],usage:emptyUsage()};}
   assert.equal(round,3);assert(!JSON.stringify(input.history).includes('toolTraceSha256'),'Server proposal must not reenter model context');return {calls:[],continuation:[],usage:emptyUsage(),final:{answer:'The supplied information is ready for employee review. No records were created.',observations:[{text:'The authorized operations returned current evidence.',evidence_ids:['e1','e2','e3']}],inferences:[],recommendations:[],questions:[],completed_actions:[]}};
  }}});
  assert.equal(result.status,'completed',JSON.stringify(result.trace));assert.equal(result.proposals.length,objective==='compare'?0:1);assert.equal(result.evidence.length,3);assert.equal(result.usage.costUsd,0);assert(result.trace.filter(t=>t.event==='tool').every(t=>t.outcome==='ok'));
 }
});
console.log(JSON.stringify({mode:'model-free injected reads; no database transaction or live inference claim',groupsPassed:checks.length,checks,inferenceCalls:0,operationalWrites:0},null,2));
