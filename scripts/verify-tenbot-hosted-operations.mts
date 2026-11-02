/** Real adapter composition over injected local Auth/Storage/query doubles.
 * No model inference, credentials, network, uploads or business persistence. */
import assert from 'node:assert/strict';
import {createHostedOperations,authorizeHostedOperationHistory,type HostedOperationsDependencies} from '../supabase/functions/_shared/tenbot-hosted-operations';
import {runTenbotAgent,emptyUsage,type AgentProvider,type AgentStep,type JsonValue} from '../supabase/functions/_shared/tenbot-agent';
import {publishModelReadAnswer} from '../supabase/functions/_shared/tenbot-read-investigation';
import type {InvoiceReceivalSource} from '../src/modules/inventory/invoice-receival-attachments';
import type {ActionCard,ActionReference} from '../supabase/functions/_shared/tenbot-actions';

const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const owner=id(1),sourceId=id(2),sessionId=id(3),catalogId=id(4),conversation=id(5);
const bytes=new Blob(['%PDF-local injected original'],{type:'application/pdf'});
const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await bytes.arrayBuffer()))].map(value=>value.toString(16).padStart(2,'0')).join('');
const raw=['Supplier: Synthetic Supply','Invoice: SYN-1','AW-1 | White aggregate | #1 | 100 LB (50 LB Bag)','Quote unit price $12.50'];
const original:InvoiceReceivalSource={id:sourceId,ownerId:owner,filename:'specification.pdf',mediaType:'application/pdf',byteSize:bytes.size,sha256:sha,storageBucket:'invoice-receival-originals',storagePath:`${owner}/${sourceId}/original`,state:'ready',createdAt:'2026-11-02T00:00:00Z',expiresAt:'2099-11-03T00:00:00Z',version:2,verifiedAt:'2026-11-02T00:01:00Z',retainedAt:null,retainedDraftId:null,evidenceSha256:'b'.repeat(64),agentState:{version:'invoice-receival-state.v1',originalSha256:sha,visionSha256:sha,rawLines:raw,sourceRows:[{lineId:`${sourceId}:L3`,sourceText:raw[2],sourceQuantity:{quantity:'100',unit:'LB'}}],draft:null,traceHash:null}};
const catalog={id:catalogId,vendor:'Synthetic Supply',vendor_sku:'AW-1',item_name:'White aggregate',size:'#1',category:'Aggregate',material_class:'Marble chips',unit:'50 LB Bag'};
const ref:ActionReference={id:id(6),revision:1,hash:'c'.repeat(64),expiresAt:'2099-11-03T00:00:00Z'};
const question='Prepare a Proposal for Sample Customer at Lobby using the supplied document.';
const ev=(path:string,value:string,source_ref='employee')=>({path,value,source_ref});
const proposalArgs:Record<string,JsonValue>={customer_company_id:null,customer_contact_id:null,fields:[ev('customer_name','Sample Customer'),ev('project_name','Lobby')],lines:[{line_type:'product',fields:[ev('description','White aggregate',`${sourceId}:L3`),ev('quantity','100',`${sourceId}:L3`),ev('unit','LB',`${sourceId}:L3`),ev('rate','12.50',`${sourceId}:L4`)]}]};
function fixture(){
 const state={allowed:true,proposal:true,source:structuredClone(original),blob:bytes,catalog:[structuredClone(catalog)],receivals:[] as Record<string,unknown>[],publications:[] as Record<string,unknown>[],reads:[] as string[],revoked:[] as string[],afterPrepare:null as (()=>void)|null,uncertainPrepare:false};
 const caller={
  async rpc(name:string,args:Record<string,unknown>={}){
   state.reads.push(name);
   if(name==='has_app_capability')return {data:state.allowed,error:null};
   if(name==='has_proposal_access')return {data:state.proposal,error:null};
   if(name==='get_invoice_receival_source'){assert.equal(args.p_source_id,sourceId);return {data:structuredClone(state.source),error:null};}
   if(name==='revoke_tenbot_reviewed_action'){state.revoked.push(String(args.p_action_id));return {data:{id:args.p_action_id,revoked:true},error:null};}
   throw Error('Unexpected caller RPC '+name);
  },
  storage:{from(bucket:string){assert.equal(bucket,'invoice-receival-originals');return {async download(path:string){assert.equal(path,original.storagePath);state.reads.push('download');return {data:state.blob,error:null};},async upload(){throw Error('No uploads allowed');},async remove(){throw Error('No deletion allowed');}};}},
  from(table:string){
   let scope:unknown[]|undefined,column='';
   const query={select(projection:string){assert(projection.length);return query;},eq(){return query;},or(){return query;},order(){return query;},range(){return query;},abortSignal(signal:AbortSignal){assert(!signal.aborted);return query;},in(key:string,values:unknown[]){if(key==='id'){column=key;scope=values;}return query;},then(resolve:(value:unknown)=>unknown){
    state.reads.push('table:'+table);let rows=table==='vendor_catalog'?state.catalog:table==='pending_receivals'?state.receivals:[];
    if(scope&&column==='id')rows=rows.filter(row=>scope!.includes(row.id));return Promise.resolve({data:structuredClone(rows),count:rows.length,error:null}).then(resolve);
   }};return query;
  },
 } as unknown as HostedOperationsDependencies['caller'];
 const deps:HostedOperationsDependencies={owner,question,documentIds:[sourceId],caller,sessionId,async can(){return state.allowed;},service:{async rpc(name,args){assert.equal(name,'prepare_tenbot_reviewed_action');assert.equal(args.p_owner,owner);assert.equal(args.p_session_id,sessionId);state.publications.push(args);if(state.uncertainPrepare)throw Error('Synthetic unknown metadata outcome');state.afterPrepare?.();const intent=args.p_intent as {operation:ActionCard['operation'];review:ActionCard['review']};return {data:{kind:'proposed_action',contract:'tenbot.actions.v1',reference:ref,operation:intent.operation,review:intent.review,confirmation:{kind:'account_password',available:false}},error:null};}}};
 return {state,deps,operations:createHostedOperations(deps)};
}
const checks:string[]=[];
async function check(name:string,run:()=>unknown|Promise<unknown>){await run();checks.push(name);}
function execute(f:ReturnType<typeof fixture>,name:string,args:Record<string,JsonValue>){const tool=f.operations.tools.find(item=>item.name===name);assert(tool,name);return tool.execute(args,{callerId:owner,signal:new AbortController().signal});}
const read=async(f:ReturnType<typeof fixture>)=>execute(f,'read_supplied_document',{source_id:sourceId});

await check('existing eleven tools remain read/prepare; selected documents and caller identity bound',async()=>{
 const f=fixture();assert.equal(f.operations.tools.length,11);assert(f.operations.tools.every(tool=>tool.kind==='read'||tool.kind==='prepare'));
 await assert.rejects(execute(f,'read_supplied_document',{source_id:id(99)}));
 await assert.rejects(f.operations.tools[0].execute({source_id:sourceId},{callerId:id(99),signal:new AbortController().signal}));assert.equal(f.state.reads.length,0);
});
await check('document and catalog facts are host-derived, human-readable and preserve source-only qualification',async()=>{
 const f=fixture(),document=await read(f),catalog=await execute(f,'search_material_catalog',{query:'White aggregate'});
 for(const result of [document,catalog]){const facts=(result.data as Record<string,JsonValue>).answer_facts as Array<Record<string,JsonValue>>;assert(facts.length);assert(facts.every(fact=>typeof fact.text==='string'&&!fact.text.includes(sourceId)&&!fact.text.includes('read_supplied_document')));}
 assert(JSON.stringify(document.data).includes('The supplied document says: Supplier: Synthetic Supply'));assert(JSON.stringify(catalog.data).includes('Catalog purchase information does not establish a customer quote price.'));
 const offerFacts=(catalog.data as Record<string,JsonValue>).answer_facts;assert(JSON.stringify(offerFacts).includes('White aggregate (#1) is offered by Synthetic Supply in Bag.'));
 assert.deepEqual(f.operations.access(),{documentIds:[sourceId],proposalAccess:false});assert.equal(await f.operations.fresh(),true);
});
await check('actual runtime lazy discovery composes source, catalog and Proposal with strict publication facts and trusted cards',async()=>{
 const f=fixture();let round=0;
 const requests=[{name:'read_supplied_document',arguments:{source_id:sourceId}},{name:'search_material_catalog',arguments:{query:'White aggregate'}},{name:'prepare_proposal_draft',arguments:proposalArgs}];
 const provider:AgentProvider={name:'scripted real adapters',model:'no inference',async step(input):Promise<AgentStep>{
  round++;if(round===1){assert.deepEqual(input.tools.map(tool=>tool.name),['discover_capabilities']);return {calls:[{id:'discover',name:'discover_capabilities',arguments:{names:requests.map(request=>request.name)}}],continuation:[],usage:emptyUsage()};}
  if(round<=4){const request=requests[round-2];assert(input.tools.some(tool=>tool.name===request.name));return {calls:[{id:'operation'+round,...request,arguments:request.arguments as Record<string,JsonValue>}],continuation:[],usage:emptyUsage()};}
  const last=input.history.filter(item=>item.kind==='tool_result').at(-1);assert(last&&last.kind==='tool_result');const output=JSON.parse(last.output);assert(output.data,JSON.stringify(input.history));assert(!JSON.stringify(input.history).includes('p_estimate_overrides'),'Prepared parameters remain outside model context');
  return {calls:[],continuation:[],usage:emptyUsage(),final:{answer:output.data.summary,observations:[{text:output.data.answer_facts[0].text,evidence_ids:[output.evidence_id]}],inferences:[],recommendations:[],questions:[],completed_actions:[]}};
 }};
 const result=await runTenbotAgent({question},{callerId:owner,provider,tools:f.operations.tools,authorize:async()=>f.operations.fresh()});
 assert.equal(result.status,'completed',JSON.stringify(result.trace));assert.equal(result.proposals.length,1);assert.equal(result.usage.costUsd,0);
 assert(publishModelReadAnswer(result,question));assert.equal(f.state.publications.length,0);
 const cards=await f.operations.publish(result,conversation,ref);assert.equal(cards.length,1);assert.equal(cards[0].contract,'tenbot.actions.v1');assert.equal(f.state.publications.length,1);assert.equal(f.state.publications[0].p_supersedes_id,ref.id);
 assert.deepEqual(f.operations.access(),{documentIds:[sourceId],proposalAccess:true});
});
await check('Pending preparation facts preserve held issues and zero received stock consequence without persistence',async()=>{
 const f=fixture();await read(f);
 const result=await execute(f,'prepare_pending_receivals',{source_id:sourceId,supplier_source_ref:`${sourceId}:L1`,document_reference_source_ref:`${sourceId}:L2`,ordered_by:'Synthetic Employee',order_date:'2026-11-02',location:'',lines:[{source_ref:`${sourceId}:L3`,catalog_source:'standard',catalog_id:catalogId,source_quantity:'100',source_unit:'LB',quantity_expected:'2',unit:'Bag',production_job_id:null}]});
 const facts=(result.data as Record<string,JsonValue>).answer_facts;assert(JSON.stringify(facts).includes('Nothing has been created yet'));assert(JSON.stringify(facts).includes('destination location'));assert(JSON.stringify(facts).includes('does not increase Inventory quantities'));assert.equal(f.state.publications.length,0);assert.equal(await f.operations.fresh(),true);
});
await check('freshness catches current permissions, changed catalog evidence and original lifecycle/integrity',async()=>{
 for(const change of ['permission','catalog','deleted','bytes','owner'] as const){const f=fixture();await read(f);await execute(f,'search_material_catalog',{query:'White aggregate'});
  if(change==='permission')f.state.allowed=false;if(change==='catalog')f.state.catalog[0].unit='25 LB Bag';if(change==='deleted')f.state.source.state='deleted';if(change==='bytes')f.state.blob=new Blob(['changed original'],{type:'application/pdf'});if(change==='owner')f.state.source.ownerId=id(99);
  assert.equal(await f.operations.fresh(),false,change);
 }
});
await check('history rechecks private original access and Proposal access without returning data or writing',async()=>{
 const f=fixture(),refs={documentIds:[sourceId],proposalAccess:true};assert.equal(await authorizeHostedOperationHistory(f.deps,refs),true);
 f.state.proposal=false;assert.equal(await authorizeHostedOperationHistory(f.deps,refs),false);f.state.proposal=true;
 f.state.source.state='deleted';assert.equal(await authorizeHostedOperationHistory(f.deps,refs),false);assert.equal(f.state.publications.length,0);
 assert.equal(await authorizeHostedOperationHistory(f.deps,{documentIds:[sourceId,sourceId],proposalAccess:false}),false);
});
await check('fresh screenshot transcription is unavailable without an authorized extractor; employee source remains usable',async()=>{
 const f=fixture();f.state.source.agentState=null;await assert.rejects(read(f));
 const textOnly=fixture(),input=structuredClone(proposalArgs);input.lines=[{line_type:'product',fields:[]}];const result=await execute(textOnly,'prepare_proposal_draft',input);assert(result.proposal);assert.deepEqual(textOnly.operations.access(),{documentIds:[],proposalAccess:true});
 textOnly.state.proposal=false;assert.equal(await textOnly.operations.fresh(),false);
});
await check('unpublished known cards are revoked after final freshness failure; unknown metadata outcome is never retried',async()=>{
 for(const scenario of ['changed_after_prepare','unknown_prepare'] as const){
  const f=fixture();await read(f);await execute(f,'search_material_catalog',{query:'White aggregate'});const value=await execute(f,'prepare_proposal_draft',proposalArgs);assert(value.proposal);
  const result={status:'completed' as const,final:{answer:'Review the prepared draft.',observations:[{text:'Review the prepared draft.',evidence_ids:['e1']}],inferences:[],recommendations:[],questions:[],completed_actions:[] as []},evidence:[{id:'e1',tool:'prepare_proposal_draft',data:value.data}],proposals:[{evidenceId:'e1',tool:'prepare_proposal_draft',proposal:value.proposal}],trace:[],usage:emptyUsage()};
  if(scenario==='changed_after_prepare')f.state.afterPrepare=()=>{f.state.catalog[0].unit='25 LB Bag';};else f.state.uncertainPrepare=true;
  await assert.rejects(()=>f.operations.publish(result,conversation));assert.equal(f.state.publications.length,1);assert.equal(f.state.revoked.length,scenario==='changed_after_prepare'?1:0);
 }
});
console.log(`Hosted operations: ${checks.length} focused model-free groups passed.`);
