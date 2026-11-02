import assert from 'node:assert/strict';
import {createProposalOperations,buildProposalPreview,type ProposalOperationDependencies} from '../supabase/functions/_shared/tenbot-proposal-operations';
import {normalizePreparedAction} from '../supabase/functions/_shared/tenbot-actions';
import {runTenbotAgent,validateStrictSchema,type AgentTool,type AgentProvider,type AgentStep,type JsonValue} from '../supabase/functions/_shared/tenbot-agent';
import {buildProposalPdfModel} from '../supabase/functions/generate-proposal-pdf/proposal-pdf-model';
import {createCallerReviewedOperations} from '../supabase/functions/_shared/tenbot-reviewed-operations';
import type {BusinessOperationsDependencies} from '../supabase/functions/_shared/tenbot-business-operations';
import type {InvoiceReceivalSource} from '../src/modules/inventory/invoice-receival-attachments';

// Model-free, no credentials, no network, no database or business writes.
const owner='10000000-0000-4000-8000-000000000001';
const companyId='20000000-0000-4000-8000-000000000001';
const contactId='30000000-0000-4000-8000-000000000001';
const company={id:companyId,name:'Synthetic Construction',phone:'214-555-0100',email:'office@example.invalid',mailing_address:'10 Test Lane',updated_at:'2026-11-02T12:00:00Z',archived_at:null,notes:'PRIVATE DIRECTORY NOTES'};
const contact={id:contactId,company_id:companyId,name:'Synthetic Buyer',phone:'214-555-0101',email:'buyer@example.invalid',title:'Buyer',updated_at:'2026-11-02T12:00:00Z',notes:'PRIVATE CONTACT NOTES'};
const sources=[{id:'employee:current',text:'Customer Synthetic Construction. Project Atrium Steps. Quantity 12 ea. Description white terrazzo tread. Quote unit price $125.50. Requested delivery 2026-12-10. Length 48 inches.'},{id:'spec:page1',text:'White terrazzo tread: Qty 12 ea. Length 48 inches. COLOR PLATE A26-TEST.'},{id:'catalog:offer',text:'white terrazzo tread catalog purchase cost $88. Quote rate $125.50.'}];
const readRpcs=new Set(['has_app_capability','has_proposal_access','search_production_customers','get_production_customer','search_production_contacts','get_production_contact']);
type MockOptions={operational?:boolean;proposal?:boolean;result?:(name:string,args:Record<string,JsonValue>)=>unknown;revokeAfterRead?:boolean;fail?:boolean};
function fixture(options:MockOptions={}){
 const calls:Array<{name:string;args:Record<string,JsonValue>}>=[];
 let revoked=false;
 const deps:ProposalOperationDependencies={callerId:owner,sources,now:()=>new Date('2026-11-02T01:00:00Z'),async rpc(name,args){
  assert(readRpcs.has(name),'No mutation RPC is permitted');calls.push({name,args});
  if(options.fail)return {data:null,error:{message:'PRIVATE raw SQL detail'}};
  if(name==='has_app_capability')return {data:options.operational!==false&&!revoked};
  if(name==='has_proposal_access')return {data:options.proposal!==false};
  const result=options.result?options.result(name,args):name.startsWith('search_')?[{company,contact}]:{company,contact:name==='get_production_contact'&&args.p_contact_id===null?null:contact};
  if(options.revokeAfterRead)revoked=true;
  return {data:result};
 }};
 const tools=createProposalOperations(deps);
 const execute=(name:string,args:Record<string,JsonValue>,callerId=owner,signal=new AbortController().signal)=>{
  const tool=tools.find(tool=>tool.name===name);assert(tool);return tool.execute(args,{callerId,signal});
 };
 return {calls,tools,execute,deps};
}
const evidence=(path:string,value:string,source_ref='employee:current')=>({path,value,source_ref});
const request=(rate=true):Record<string,JsonValue>=>({customer_company_id:companyId,customer_contact_id:contactId,fields:[evidence('project_name','Atrium Steps'),evidence('requested_delivery','2026-12-10')],lines:[{line_type:'product',fields:[evidence('description','white terrazzo tread'),evidence('quantity','12'),evidence('unit','ea'),evidence('length','48','spec:page1'),...(rate?[evidence('rate','125.50')]:[])]}]});
const checks:string[]=[];
async function check(name:string,action:()=>void|Promise<void>){await action();checks.push(name);}
const proposed=async(f:ReturnType<typeof fixture>,input=request())=>{
 const result=await f.execute('prepare_proposal_draft',input);
 assert(result.proposal);return {result,action:normalizePreparedAction(result.proposal)};
};
const header=(action:Awaited<ReturnType<typeof proposed>>['action'])=>action.parameters.p_proposal as Record<string,JsonValue>;
const lines=(action:Awaited<ReturnType<typeof proposed>>['action'])=>action.parameters.p_lines as Array<Record<string,JsonValue>>;

await check('five strict discoverable read/prepare tools; no execution tool',()=>{
 const f=fixture();assert.deepEqual(f.tools.map(tool=>[tool.name,tool.kind]),[['search_customers','read'],['get_customer','read'],['search_contacts','read'],['get_contact','read'],['prepare_proposal_draft','prepare']]);
 for(const tool of f.tools)assert.equal(tool.parameters.additionalProperties,false);
 assert(validateStrictSchema(request(),f.tools.at(-1)!.parameters));
});
await check('customer and contact reads independently reuse existing caller RPCs',async()=>{
 const f=fixture({proposal:false});
 const search=await f.execute('search_customers',{query:'Synthetic',offset:0});
 await f.execute('search_contacts',{query:'Buyer',offset:20});
 await f.execute('get_customer',{company_id:companyId});
 await f.execute('get_contact',{company_id:companyId,contact_id:contactId});
 assert.equal(f.calls.filter(call=>call.name==='has_proposal_access').length,0);
 assert(!JSON.stringify(search).includes('PRIVATE'));
 assert.deepEqual(f.calls.find(call=>call.name==='search_production_contacts')?.args,{p_search:'Buyer',p_offset:20});
});
await check('directory permission, caller binding and cancelled reads fail before data access',async()=>{
 const f=fixture({operational:false});await assert.rejects(()=>f.execute('get_customer',{company_id:companyId}));assert.equal(f.calls.length,1);
 const wrong=fixture();await assert.rejects(()=>wrong.execute('get_customer',{company_id:companyId},'another-owner'));assert.equal(wrong.calls.length,0);
 const aborted=fixture(),controller=new AbortController();controller.abort();await assert.rejects(()=>aborted.execute('get_customer',{company_id:companyId},owner,controller.signal));assert.equal(aborted.calls.length,0);
});
await check('Proposal preparation needs separate Proposal access; read access alone grants none',async()=>{
 const f=fixture({proposal:false});await assert.rejects(()=>proposed(f));assert.deepEqual(f.calls.map(call=>call.name),['has_app_capability','has_proposal_access']);
});
await check('rechecked revocation suppresses results and RPC errors never leak',async()=>{
 const f=fixture({revokeAfterRead:true});await assert.rejects(()=>f.execute('get_customer',{company_id:companyId}));
 const error=await fixture({fail:true}).execute('get_customer',{company_id:companyId}).catch(error=>error);assert(!String(error).includes('PRIVATE'));
});
await check('strict fields reject injected persistence identities and malformed selectors',async()=>{
 for(const input of [{...request(),job_id:companyId},{...request(),id:companyId},{...request(),customer_contact_id:contactId,customer_company_id:null},{...request(),customer_company_id:'not-a-canonical-uuid----------------'}])await assert.rejects(()=>proposed(fixture(),input));
 await assert.rejects(()=>fixture().execute('search_customers',{query:'Synthetic',offset:-1}));
 await assert.rejects(()=>fixture().execute('get_customer',{company_id:companyId,sql:'select everything'}));
});
await check('source evidence is host-bound; duplicates, absent refs and partial numeric matches fail',async()=>{
 for(const field of [evidence('project_name','Invented Project'),evidence('project_name','Atrium Steps','model:invented'),evidence('project_number','1')]){
  const input=request();input.fields=[field];await assert.rejects(()=>proposed(fixture(),input));
 }
 const duplicate=request();duplicate.fields=[evidence('project_name','Atrium Steps'),evidence('project_name','Atrium Steps')];await assert.rejects(()=>proposed(fixture(),duplicate));
});
await check('customer/contact identities are fetched, validated, projected and copied as snapshots',async()=>{
 const {action}=await proposed(fixture());assert.equal(header(action).customer_name,company.name);assert.equal(header(action).customer_email,contact.email);
 assert.equal(header(action).customer_street,company.mailing_address);assert(!JSON.stringify(action).includes('PRIVATE'));
 assert(action.sourceReferences?.some(source=>source.kind==='customer'&&source.id===companyId));
 const mismatch=request();mismatch.fields=[evidence('customer_name','Atrium Steps')];await assert.rejects(()=>proposed(fixture(),mismatch));
 for(const result of [{company:{...company,id:'20000000-0000-4000-8000-000000000099'},contact},{company:{...company,archived_at:'2026-11-01'},contact},{company,contact:{...contact,company_id:'20000000-0000-4000-8000-000000000099'}}])await assert.rejects(()=>proposed(fixture({result:()=>result})));
});
await check('nonpersistent preparation maps exact canonical save contract without allocating a number or Job',async()=>{
 const f=fixture(),{action}=await proposed(f);
 assert.deepEqual(Object.keys(action.parameters),['p_proposal','p_lines','p_estimate_inputs','p_estimate_overrides']);assert.equal(action.operation,'proposal.save_draft');
 assert.equal(header(action).tax_enabled,false);assert.equal(header(action).tax_rate,'0','Disabled tax must use the existing non-null canonical rate, without substituting a customer line price.');
 assert(action.review.fields.some(field=>field.path==='p_proposal.tax_rate'&&field.value==='0'));
 for(const key of ['id','job_id','bid_id','estimate_number','status','issued_snapshot'])assert(!Object.hasOwn(header(action),key));
 assert.equal(header(action).proposal_date,'2026-11-01','default date must follow Chicago, not UTC');assert.equal(lines(action)[0].rate,'125.50');
 assert.equal((action.parameters.p_estimate_inputs as Record<string,JsonValue>).customerQuantity,null);
 assert(f.calls.every(call=>readRpcs.has(call.name)));assert(action.review.fields.every(field=>field.editable===false));
 const provenance=header(action).proposal_field_sources as Record<string,JsonValue>;assert(provenance.project_name);
});
await check('unknown quote rates stay null, incomplete draft remains saveable, misleading zero PDF is unavailable',async()=>{
 const {action,result}=await proposed(fixture(),request(false));
 assert.equal(lines(action)[0].rate,null);assert(action.review.issues.some(issue=>issue.code==='missing_quote_rate'&&!issue.blocking));
 assert.equal(action.review.preview,undefined);assert.equal((result.data as Record<string,JsonValue>).can_save_incomplete_draft,true);
 assert.equal(action.review.fields.find(field=>field.path==='p_lines.0.amount')?.value,null);assert.throws(()=>buildProposalPreview(action.parameters));
});
await check('catalog cost is never substituted for a quote rate even when source also contains a quote',async()=>{
 const input=request();(input.lines as Array<Record<string,JsonValue>>)[0].fields=[evidence('description','white terrazzo tread','catalog:offer'),evidence('rate','88','catalog:offer')];
 await assert.rejects(()=>proposed(fixture(),input));
});
await check('currency precision, unsupported numeric representations and invalid dates fail closed',async()=>{
 for(const field of [evidence('rate','-125.50'),evidence('quantity','1e1'),evidence('quantity','Infinity'),evidence('quantity','12.00000')]){
  const input=request();(input.lines as Array<Record<string,JsonValue>>)[0].fields=[field];await assert.rejects(()=>proposed(fixture(),input));
 }
 const input=request();input.fields=[evidence('proposal_date','2026-02-30')];await assert.rejects(()=>proposed(fixture(),input));
});
await check('known Proposal PDF snapshot reuses official model and amount calculations without issuance',async()=>{
 const {action}=await proposed(fixture());assert.deepEqual(action.review.preview,{kind:'proposal_pdf'});
 const snapshot=buildProposalPreview(action.parameters) as Record<string,JsonValue>;assert.equal(snapshot.estimate_number,'UNSAVED DRAFT');assert.equal(snapshot.status,'draft');
 const model=buildProposalPdfModel(snapshot);assert.equal(model.total,1506);assert.equal(model.lines[0].quantity,'12');assert.equal(model.customerName,company.name);
 assert.equal((snapshot.lines as Array<Record<string,JsonValue>>)[0].length,'48');
 assert.throws(()=>buildProposalPreview({...action.parameters,p_proposal:{...header(action),job_id:companyId}}));
});
await check('page boundary preserves has-more and fails malformed directory evidence',async()=>{
 const f=fixture({result:()=>Array.from({length:21},()=>({company,contact:null}))});
 const data=(await f.execute('search_customers',{query:'Synthetic',offset:0})).data as Record<string,JsonValue>;assert.equal(data.has_more,true);assert.equal(data.next_offset,20);assert.equal((data.items as JsonValue[]).length,20);
 await assert.rejects(()=>fixture({result:()=>({company,contact})}).execute('search_customers',{query:'Synthetic',offset:0}));
});
await check('same read operations support lookup and Proposal preparation without forced workflow state',async()=>{
 const f=fixture();await f.execute('get_contact',{company_id:companyId,contact_id:contactId});await f.execute('search_customers',{query:'Synthetic',offset:0});
 const first=await proposed(f),second=await proposed(f);assert.deepEqual(first.action,second.action);assert(f.calls.every(call=>readRpcs.has(call.name)));
 const prepare=fixture().tools.at(-1)! as AgentTool;assert.equal(prepare.kind,'prepare');
});
await check('actual existing agent runtime discovers and composes directory tools for distinct objectives',async()=>{
 for(const goal of ['read_customer','prepare_customer_proposal']){
  const f=fixture();let round=0;
  const usage={inputTokens:0,cachedInputTokens:0,outputTokens:0,costUsd:0,reservedUsd:0};
  const call=(name:string,args:Record<string,JsonValue>):AgentStep=>({calls:[{id:'call'+round,name,arguments:args}],continuation:[],usage});
  const provider:AgentProvider={name:'offline scripted double',model:'no-inference',async step(input){
   switch(round++){
    case 0:return call('discover_capabilities',{names:['search_customers','get_customer',...(goal==='prepare_customer_proposal'?['prepare_proposal_draft']:[])]});
    case 1:assert(input.tools.some(tool=>tool.name==='search_customers'));return call('search_customers',{query:'Synthetic',offset:0});
    case 2:return call('get_customer',{company_id:companyId});
    case 3:if(goal==='prepare_customer_proposal')return call('prepare_proposal_draft',request());
   }
   const result=input.history.filter(item=>item.kind==='tool_result').at(-1);assert(result&&result.kind==='tool_result');
   const data=JSON.parse(result.output);assert(data.data,'The actual runtime must accept the tool result');
   return {calls:[],continuation:[],usage,final:{answer:data.data.answer_facts[0].text,observations:[{text:data.data.answer_facts[0].text,evidence_ids:[data.evidence_id]}],inferences:[],recommendations:[],questions:[],completed_actions:[]}};
  }};
  const result=await runTenbotAgent({question:goal==='read_customer'?'Find this saved customer and contact.':'Prepare a Proposal for this saved customer.'},{callerId:owner,provider,tools:f.tools,authorize:async()=>true});
  assert.equal(result.status,'completed',JSON.stringify(result.trace));assert.equal(result.proposals.length,goal==='read_customer'?0:1);
  assert(result.trace.some(trace=>trace.name==='search_customers'&&trace.outcome==='ok'));assert(result.trace.some(trace=>trace.name==='get_customer'&&trace.outcome==='ok'));
  if(goal==='prepare_customer_proposal')assert.equal(normalizePreparedAction(result.proposals[0].proposal).operation,'proposal.save_draft');
  assert(f.calls.every(item=>readRpcs.has(item.name)));assert.equal(result.usage.costUsd,0);
 }
});
await check('common multi-line artifact stays inside actual runtime result limit',async()=>{
 const f=fixture(),input=request(),line=(input.lines as JsonValue[])[0];input.lines=[line,line,line];
 const {result,action}=await proposed(f,input);assert.equal(lines(action).length,3);assert(new TextEncoder().encode(JSON.stringify(result)).byteLength<24000);
 const tooLarge=request();tooLarge.lines=Array.from({length:21},()=>line);await assert.rejects(()=>proposed(f,tooLarge));
});
function combinedFixture(){
 const f=fixture(),sourceId='40000000-0000-4000-8000-000000000001',catalogId='50000000-0000-4000-8000-000000000001';
 const raw=['Project Atrium Steps','white terrazzo tread: Quantity 12 ea; Length 48 inches.','Quote unit price $125.50'];
 const source:InvoiceReceivalSource={id:sourceId,ownerId:owner,filename:'specification.pdf',mediaType:'application/pdf',byteSize:20,sha256:'a'.repeat(64),storageBucket:'invoice-receival-originals',storagePath:`${owner}/${sourceId}/original`,state:'ready',createdAt:'2026-11-02T00:00:00Z',expiresAt:'2099-11-03T00:00:00Z',version:2,verifiedAt:'2026-11-02T00:01:00Z',retainedAt:null,retainedDraftId:null,evidenceSha256:'b'.repeat(64),agentState:{version:'invoice-receival-state.v1',originalSha256:'a'.repeat(64),visionSha256:'a'.repeat(64),rawLines:raw,sourceRows:[],draft:null,traceHash:null}};
 const mutable={source,allowed:true},calls:string[]=[];
 const business:BusinessOperationsDependencies={ownerId:owner,async can(capability){calls.push('can:'+capability);return mutable.allowed;},originals:{async download(id){assert.equal(id,sourceId);calls.push('download');return {source:structuredClone(mutable.source),original:new Blob(['%PDF-test original'],{type:'application/pdf'})};}},reader:{async searchCatalog(query){assert.equal(query,'white terrazzo tread');calls.push('catalog');return {complete:true,standard:[{id:catalogId,vendor:'Synthetic Supply',item_name:'white terrazzo tread',size:'#1',category:'Aggregate',material_class:'Chip',unit:'50 LB Bag',price:88}],specialty:[]};},async readReceivals(){return {complete:true,rows:[]};}}};
 const input=request();input.fields=[evidence('project_name','Atrium Steps',`${sourceId}:L1`)];input.lines=[{line_type:'product',fields:[evidence('description','white terrazzo tread',`${sourceId}:L2`),evidence('quantity','12',`${sourceId}:L2`),evidence('unit','ea',`${sourceId}:L2`),evidence('length','48',`${sourceId}:L2`),evidence('rate','125.50',`${sourceId}:L3`)]}];
 return {sourceId,mutable,calls,business,proposal:f.deps,input,registry:()=>createCallerReviewedOperations({proposal:f.deps,business})};
}
await check('actual document and catalog adapters compose into Proposal preparation through trusted run-scoped evidence',async()=>{
 const f=combinedFixture(),registry=f.registry();let round=0;
 const operations=[{name:'read_supplied_document',arguments:{source_id:f.sourceId}},{name:'search_material_catalog',arguments:{query:'white terrazzo tread'}},{name:'prepare_proposal_draft',arguments:f.input}];
 const provider:AgentProvider={name:'scripted real-adapter composition',model:'no-inference',async step(input){
  const usage={inputTokens:0,cachedInputTokens:0,outputTokens:0,costUsd:0,reservedUsd:0};
  if(round++===0)return {calls:[{id:'discover',name:'discover_capabilities',arguments:{names:operations.map(item=>item.name)}}],continuation:[],usage};
  if(round<=4){const operation=operations[round-2];return {calls:[{id:'operation'+round,...operation,arguments:operation.arguments as Record<string,JsonValue>}],continuation:[],usage};}
  const last=input.history.filter(item=>item.kind==='tool_result').at(-1);assert(last&&last.kind==='tool_result');const output=JSON.parse(last.output);assert(output.data,JSON.stringify(input.history));
  return {calls:[],continuation:[],usage,final:{answer:output.data.summary,observations:[{text:output.data.summary,evidence_ids:[output.evidence_id]}],inferences:[],recommendations:[],questions:[],completed_actions:[]}};
 }};
 const result=await runTenbotAgent({question:'Use these specifications and available materials to prepare a Proposal.'},{callerId:owner,provider,tools:registry.tools,authorize:async()=>true});
 assert.equal(result.status,'completed',JSON.stringify(result.trace));assert.equal(result.proposals.length,1);assert.equal(result.evidence.length,3);assert.equal(result.usage.costUsd,0);
 const action=normalizePreparedAction(result.proposals[0].proposal);assert.equal(header(action).project_name,'Atrium Steps');assert.equal(lines(action)[0].rate,'125.50');assert.equal(lines(action)[0].length,'48');assert(f.calls.includes('catalog'));assert(f.calls.filter(call=>call==='download').length>=2);
 assert(action.sourceReferences?.some(source=>source.id===`${f.sourceId}:L3`));assert(!JSON.stringify(result.final).includes('session'));
});
await check('dynamic document evidence requires this run and current original access; deletion and revocation suppress preparation',async()=>{
 for(const scenario of ['not_read','new_run','deleted','revoked','foreign_original'] as const){
  const f=combinedFixture(),registry=f.registry(),context={callerId:owner,signal:new AbortController().signal};
  if(scenario!=='not_read')await registry.tools.find(tool=>tool.name==='read_supplied_document')!.execute({source_id:f.sourceId},context);
  if(scenario==='deleted')f.mutable.source.state='deleted';
  if(scenario==='revoked')f.mutable.allowed=false;
  if(scenario==='foreign_original')f.mutable.source.ownerId=companyId;
  const selected=scenario==='new_run'?f.registry():registry;
  await assert.rejects(()=>selected.tools.find(tool=>tool.name==='prepare_proposal_draft')!.execute(f.input,context));
 }
});
console.log(`Proposal operations: ${checks.length} focused model-free groups passed.`);
