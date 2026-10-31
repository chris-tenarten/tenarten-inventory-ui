import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createTenbotInvoiceTools,type InvoiceCatalogRead,type TenbotInvoiceDocument} from '../supabase/functions/_shared/tenbot-invoice';
import {createAuthenticatedReceivalAgent,type ReceivalAgentCaller,type ReceivalRuntimeSourceStore} from '../supabase/functions/_shared/tenbot-receival-runtime';
import {extractOriginalInvoiceDocument} from '../supabase/functions/_shared/tenbot-invoice-extraction';
import {emptyUsage,type AgentProvider,type AgentStep,type AgentStepRequest,type AgentTool,type JsonValue} from '../supabase/functions/_shared/tenbot-agent';
import type {InvestigationDiagnostic} from '../supabase/functions/_shared/tenbot-investigation-diagnostics';
import type {InvoiceReceivalSource} from '../src/modules/inventory/invoice-receival-attachments';
import type {LocalReceivalDraft} from '../src/modules/tenbot/live-review';

// OFFLINE REGRESSION. Actual runtime/session/tools; scripted model transport and
// simulated caller-scoped SELECT/Storage replies. No API, secrets, SQL, database,
// grants, approvals or Inventory writes. This does not certify JWT/RLS behavior.
type Row=Record<string,unknown>;
type Fixture={sourceId:string;sha256:string;originalPath:string;rawLines:string[];supplier:string;documentReference:string;catalog:InvoiceCatalogRead};
const fixture=JSON.parse(await readFile(new URL('./fixtures/tenbot-invoice-investigation.synthetic.json',import.meta.url),'utf8')) as Fixture;
const clone=<T,>(value:T):T=>structuredClone(value);
const owner='10282026-0000-4000-8000-000000000021';
const context={callerId:owner,signal:new AbortController().signal};
const ref=(line:number)=>`${fixture.sourceId}:L${line}`;
const metadata={supplier:fixture.supplier,supplier_source_ref:ref(4),document_ref:fixture.documentReference,document_source_ref:ref(6)};
const extraction={source_ref:ref(8),description:'Alaska White',quantity:'1',unit:'Bag',size:'#0',vendor_sku:null};
const selection={selections:[{source_ref:ref(8),candidate_id:`standard:${fixture.catalog.standard[0].id}`}],exclusions:[]};
const document=(lines=fixture.rawLines):TenbotInvoiceDocument=>({id:fixture.sourceId,filename:'synthetic-tendev-receival-20261030-01.pdf',mediaType:'text/plain',synthetic:true,recordSource:'caller-authorized',text:lines.join('\n')});
const checks:string[]=[];
async function check(name:string,run:()=>Promise<void>){await run();checks.push(name);}
function toolCall(tools:AgentTool[],name:string,args:Record<string,JsonValue>){const tool=tools.find(value=>value.name===name);assert.ok(tool,name);return tool.execute(args,context);}
function setup(lines=fixture.rawLines,factory=createTenbotInvoiceTools,complete=true){
 let receivalReads=0;
 const tools=factory({callerId:owner,document:document(lines),reader:{async searchCatalog(){return {...clone(fixture.catalog),complete};},async readReceivals(){receivalReads++;return {complete,rows:[]};}}});
 return {tools,receivalReads:()=>receivalReads};
}
async function register(tools:AgentTool[]){await toolCall(tools,'read_invoice',{});return toolCall(tools,'search_catalog',extraction);}
const receiptRoot='/private/tmp/tenops-tenbot-investigation-stop-20261030';
await mkdir(receiptRoot,{recursive:true});

// Optional exact historical artifact replay: --baseline-root /path/to/candidate.
// The accepted source remains untouched and is never a permanent test dependency.
const baselineIndex=process.argv.indexOf('--baseline-root');
if(baselineIndex>=0){
 const root=process.argv[baselineIndex+1];assert.ok(root,'--baseline-root requires a path');
 const modulePath=resolve(root,'supabase/functions/_shared/tenbot-invoice.ts');
 const historical=await import(pathToFileURL(modulePath).href) as {createTenbotInvoiceTools:typeof createTenbotInvoiceTools};
 const h=setup(fixture.rawLines,historical.createTenbotInvoiceTools);await register(h.tools);
 await assert.rejects(toolCall(h.tools,'check_receival_duplicates',metadata),/unsupported_invoice_metadata/);
 assert.equal(h.receivalReads(),0);
 await writeFile(`${receiptRoot}/baseline-metadata-replay.json`,JSON.stringify({mode:'offline deterministic replay; not the lost hosted trace',sourceArtifactSha256:createHash('sha256').update(await readFile(modulePath)).digest('hex'),documentSha256:fixture.sha256,catalog:'simulated canonical fixture',model:'no model invocation',catalogResult:'matched Alaska White #0; source 1 Bag',stage:'check_receival_duplicates',reason:'unsupported_invoice_metadata',receivalReadCalls:0,proposalProduced:false},null,2)+'\n');
 checks.push('exact accepted artifact reproduces unsupported_invoice_metadata before duplicate reads');
}

await check('retained PDF layout binds adjacent supplier and exact invoice-reference column',async()=>{
 const h=setup();await register(h.tools);await toolCall(h.tools,'check_receival_duplicates',metadata);
 assert.equal(h.receivalReads(),1);
 const result=await toolCall(h.tools,'prepare_pending_receivals',selection),proposal=result.proposal as Row;
 const lines=proposal.ready_lines as Row[];assert.equal(lines.length,1);assert.deepEqual(proposal.held_lines,[]);
 const line=lines[0],value=line.proposal as Row;assert.deepEqual(line.sourceQuantity,{quantity:'1',unit:'Bag'});
 assert.equal(value.quantity_expected,'1');assert.equal(value.unit,'Bag');assert.equal(value.quantity_received,'0');
 assert.equal(value.status,'pending');assert.equal(value.order_date,null);assert.equal(proposal.execution_available,false);
 assert.equal(proposal.document_reference,fixture.documentReference);assert.equal(proposal.supplier,fixture.supplier);
});
await check('existing inline labeled metadata remains supported',async()=>{
 const lines=clone(fixture.rawLines);lines[3]='Supplier: T&M Supply';lines[5]=`Invoice: ${fixture.documentReference}`;
 const h=setup(lines);await register(h.tools);await toolCall(h.tools,'check_receival_duplicates',metadata);assert.equal(h.receivalReads(),1);
});
await check('explicit pipe table headers preserve column identity',async()=>{
 const lines=clone(fixture.rawLines);lines[4]='Invoice date | Invoice reference';lines[5]=`2026-10-30 | ${fixture.documentReference}`;
 const h=setup(lines);await register(h.tools);await toolCall(h.tools,'check_receival_duplicates',metadata);assert.equal(h.receivalReads(),1);
});
await check('wrong column/date, manufacturer, material, partial and foreign evidence remain rejected',async()=>{
 const badCases:{lines?:string[];args:Record<string,JsonValue>;reason:RegExp}[]=[
  {args:{...metadata,document_ref:'2026-10-30'},reason:/unsupported_invoice_metadata/},
  {args:{...metadata,document_ref:'SYN-TENDEV-RECEIVAL'},reason:/unsupported_invoice_metadata/},
  {args:{...metadata,supplier:'T&M'},reason:/unsupported_invoice_metadata/},
  {args:{...metadata,supplier:'Alaska White',supplier_source_ref:ref(8)},reason:/unsupported_invoice_metadata/},
  {args:{...metadata,supplier_source_ref:'foreign:L4'},reason:/invalid_invoice_evidence/},
  {args:{...metadata,document_source_ref:'foreign:L6'},reason:/invalid_invoice_evidence/},
  {lines:fixture.rawLines.map((value,index)=>index===2?'Manufacturer':value),args:metadata,reason:/unsupported_invoice_metadata/},
  {lines:fixture.rawLines.map((value,index)=>index===4?'Invoice date                                             Purchase order':value),args:metadata,reason:/unsupported_invoice_metadata/},
  {lines:fixture.rawLines.map((value,index)=>index===4?'Invoice reference                                             Invoice reference':value),args:metadata,reason:/unsupported_invoice_metadata/},
  {lines:fixture.rawLines.map((value,index)=>index===4?'Invoice reference':value),args:metadata,reason:/unsupported_invoice_metadata/},
  {lines:fixture.rawLines.map((value,index)=>index===4?'Invoice reference               Invoice date               Purchase order':value),args:metadata,reason:/unsupported_invoice_metadata/},
 ];
 for(const bad of badCases){const h=setup(bad.lines);await register(h.tools);await assert.rejects(toolCall(h.tools,'check_receival_duplicates',bad.args),bad.reason);assert.equal(h.receivalReads(),0);}
});
await check('catalog completeness and source quantity checks still fail closed',async()=>{
 const h=setup(fixture.rawLines,createTenbotInvoiceTools,false);await toolCall(h.tools,'read_invoice',{});await assert.rejects(toolCall(h.tools,'search_catalog',extraction),/invoice_read_incomplete/);
 const valid=setup();await toolCall(valid.tools,'read_invoice',{});await assert.rejects(toolCall(valid.tools,'search_catalog',{...extraction,quantity:'50'}),/unsupported_invoice_quantity_unit/);
});

await check('actual authenticated controller/session/tool path creates one review draft with writes disabled',async()=>{
 const original=await readFile(resolve(fixture.originalPath));assert.equal(createHash('sha256').update(original).digest('hex'),fixture.sha256);
 const now=Date.parse('2026-10-31T02:00:00Z'),rpcNames:string[]=[],readTables:string[]=[],providerModes:string[]=[],toolTrace:string[]=[],diagnostics:InvestigationDiagnostic[]=[];
 let source:InvoiceReceivalSource={id:fixture.sourceId,ownerId:owner,filename:document().filename,mediaType:'application/pdf',byteSize:original.length,sha256:fixture.sha256,storageBucket:'invoice-receival-originals',storagePath:`${owner}/${fixture.sourceId}/original`,state:'uploading',createdAt:new Date(now).toISOString(),expiresAt:new Date(now+86400000).toISOString(),version:1,verifiedAt:null,retainedAt:null,retainedDraftId:null,evidenceSha256:null,agentState:null};
 const store:ReceivalRuntimeSourceStore={async get(id){assert.equal(id,source.id);return clone(source);},async download(id){assert.equal(id,source.id);return {source:clone(source),original:new Blob([original],{type:'application/pdf'})};},async record(input){assert.equal(input.actorId,owner);assert.equal(input.sourceId,source.id);assert.equal(input.expectedVersion,source.version);assert.equal(input.verifiedSha256,fixture.sha256);source={...source,state:'ready',verifiedAt:new Date(now).toISOString(),version:source.version+1,agentState:clone(input.state)};return clone(source);},async abandon(){throw Error('No abandonment allowed in this regression');}};
 const caller={from(table:string){assert(['vendor_catalog','vendor_catalog_v2','pending_receivals'].includes(table));readTables.push(table);let columns='',first=0,last=249;
  const query={select(value:string){columns=value;return query;},eq(){return query;},in(){return query;},or(){return query;},order(){return query;},range(start:number,end:number){first=start;last=end;return query;},abortSignal(signal:AbortSignal){assert.equal(signal.aborted,false);return query;},then(resolve:(value:unknown)=>unknown,reject?:(error:unknown)=>unknown){const rows=table==='vendor_catalog'?fixture.catalog.standard:[];return Promise.resolve({data:rows.slice(first,last+1).map(row=>Object.fromEntries(columns.split(',').map(key=>[key,row[key]??null]))),count:rows.length,error:null}).then(resolve,reject);}};return query;
 },async rpc(name:string,args:Row={}){rpcNames.push(name);assert.equal(name,'has_app_capability','controller must not prepare/approve/execute any durable business mutation');return {data:['readOperationalData','writeBusinessData','adjustInventory'].includes(String(args.p_capability)),error:null};}} as unknown as ReceivalAgentCaller;
 const call=(id:string,name:string,args:Record<string,JsonValue>={}):AgentStep['calls'][number]=>({id,name,arguments:args});
 const steps:AgentStep[]=[
  {calls:[call('discover','discover_capabilities',{names:['read_invoice','search_catalog','check_receival_duplicates','prepare_pending_receivals']})],continuation:[],usage:emptyUsage()},
  {calls:[call('invoice','read_invoice')],continuation:[],usage:emptyUsage()},
  {calls:[call('catalog','search_catalog',extraction)],continuation:[],usage:emptyUsage()},
  {calls:[call('duplicates','check_receival_duplicates',metadata)],continuation:[],usage:emptyUsage()},
  {calls:[call('prepare','prepare_pending_receivals',selection)],continuation:[],usage:emptyUsage()},
  {calls:[],continuation:[],usage:emptyUsage(),final:{answer:'One synthetic pending-receival draft is ready for employee review. No records were created.',observations:[{text:'Alaska White #0: 1 Bag.',evidence_ids:['e4']}],inferences:[],recommendations:[],questions:[],completed_actions:[]}},
 ];
 const handler=createAuthenticatedReceivalAgent({model:'offline-scripted-not-live',now:()=>now,onDiagnostic:event=>diagnostics.push(event),sourceStore:()=>store,decodeAttachment:async()=>{throw Error('Private original path required');},extractDocument:extractOriginalInvoiceDocument,remainingUsd:()=>.25,assertNoFatal(){},createProvider(label,image){providerModes.push(label);
  if(image){assert.equal(createHash('sha256').update(image.bytes).digest('hex'),fixture.sha256);return {name:'OFFLINE retained transcription replay, not live vision',model:'offline-scripted-not-live',async step(request:AgentStepRequest){assert.deepEqual(request.tools,[]);return {calls:[],continuation:[],usage:emptyUsage(),final:{raw_lines:clone(fixture.rawLines)}};}} as AgentProvider;}
  let index=0;return {name:'OFFLINE explicit tool-sequence transport, not model reasoning',model:'offline-scripted-not-live',async step(request:AgentStepRequest){const step=steps[index++];assert.ok(step,'unexpected continuation');for(const item of step.calls){assert.ok(request.tools.some(tool=>tool.name===item.name));toolTrace.push(item.name);}return clone(step);}} as AgentProvider;
 }});
 const upload=await handler({action:'upload',sourceId:fixture.sourceId,syntheticConfirmed:true},owner,caller) as Row;
 const answer=await handler({action:'ask',attachmentId:upload.attachmentId,question:'Prepare pending receivals for this approved synthetic invoice.'},owner,caller) as Row;
 assert.equal((answer.agent as Row).status,'completed');const draft=(answer.localDemo as Row).draft as LocalReceivalDraft;assert.ok(draft);assert.equal(draft.rows.length,1);
 assert.deepEqual(draft.rows[0].sourceQuantity,{quantity:'1',unit:'Bag'});assert.equal(draft.rows[0].quantity,'1');assert.equal(draft.rows[0].unit,'Bag');assert.deepEqual(draft.rows[0].reasons,[]);
 assert.equal(draft.executionEnabled,false);assert.equal(draft.canApprove,false);assert.equal(draft.status,'review_required');assert.equal(draft.provenance?.documentReference,fixture.documentReference);
 assert.equal(source.agentState?.draft?.id,draft.id);assert.equal(source.agentState?.originalSha256,fixture.sha256);assert.deepEqual(source.agentState?.rawLines,fixture.rawLines);assert.ok(source.agentState?.traceHash);
 assert.deepEqual(providerModes,['authenticated-invoice-vision','authenticated-invoice-investigation']);assert(readTables.includes('pending_receivals'));assert(rpcNames.every(name=>name==='has_app_capability'));
 assert(diagnostics.some(event=>event.stage==='extraction'&&event.outcome==='ok'));
 assert.deepEqual(diagnostics.filter(event=>event.stage==='tool'&&event.outcome==='ok').map(event=>event.tool),toolTrace);
 assert(diagnostics.some(event=>event.stage==='draft'&&event.reasonCode==='completed'));
 for(const event of diagnostics)assert.deepEqual(Object.keys(event).sort(),['durationMs','outcome','reasonCode','stage','tool']);
 const logged=JSON.stringify(diagnostics);for(const privateValue of [fixture.sha256,fixture.documentReference,fixture.supplier,owner,fixture.sourceId])assert.equal(logged.includes(privateValue),false);
 await writeFile(`${receiptRoot}/corrected-investigation-replay.json`,JSON.stringify({mode:'offline actual runtime/session/tools; explicitly scripted model transport; simulated caller reads/storage',modelInference:false,databaseSecurityProof:false,documentSha256:fixture.sha256,stages:providerModes,toolTrace,diagnostics,status:(answer.agent as Row).status,draft:{rows:1,sourceQuantity:draft.rows[0].sourceQuantity,quantity:draft.rows[0].quantity,unit:draft.rows[0].unit,reasons:draft.rows[0].reasons,executionEnabled:draft.executionEnabled,canApprove:draft.canApprove,persistedInSimulatedPrivateSource:Boolean(source.agentState?.draft)},businessMutationRpcCalls:rpcNames.filter(name=>name!=='has_app_capability'),inferenceCostUsd:0},null,2)+'\n');
});

await writeFile(`${receiptRoot}/regressions.json`,JSON.stringify({mode:'offline focused regression',passed:checks.length,checks,inferenceCostUsd:0,operationalWrites:0},null,2)+'\n');
console.log(JSON.stringify({passed:checks.length,checks,inferenceCostUsd:0,operationalWrites:0,evidence:receiptRoot},null,2));
