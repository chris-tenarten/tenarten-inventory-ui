import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createAuthenticatedReceivalAgent,type ReceivalAgentCaller,type ReceivalRuntimeSourceStore} from '../supabase/functions/_shared/tenbot-receival-runtime';
import {extractOriginalInvoiceDocument} from '../supabase/functions/_shared/tenbot-invoice-extraction';
import {emptyUsage,type AgentProvider,type AgentStep,type AgentStepRequest,type JsonValue} from '../supabase/functions/_shared/tenbot-agent';
import {createHostedReceivalContract,hostedInvoicePreparationEnabled,ordinaryTenbotSpendingAuthorized,preparationDocumentMatches,type HostedInvoicePreparationConfig} from '../supabase/functions/_shared/tenbot-receival-hosted';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- existing Node fixture uses an explicit .mts module.
// @ts-ignore -- tsx resolves the existing fixture module.
import {createHostedTenbotFixture} from './support/tenbot-hosted-fixture.mts';
import type {InvestigationDiagnostic} from '../supabase/functions/_shared/tenbot-investigation-diagnostics';
import type {InvoiceReceivalSource} from '../src/modules/inventory/invoice-receival-attachments';
import type {LocalReceivalDraft} from '../src/modules/tenbot/live-review';
import type {InvoiceCatalogRead} from '../supabase/functions/_shared/tenbot-invoice';
// OFFLINE only: real orchestration with scripted provider transport and simulated
// caller-scoped database/Storage replies. No API inference, JWT/RLS proof or writes.
type Row=Record<string,unknown>;
type Fixture={sourceId:string;sha256:string;originalPath:string;rawLines:string[];supplier:string;documentReference:string;catalog:InvoiceCatalogRead};
const fixture=JSON.parse(await readFile(new URL('./fixtures/tenbot-invoice-investigation.synthetic.json',import.meta.url),'utf8')) as Fixture;
const clone=<T,>(value:T):T=>structuredClone(value);
const owner='10282026-0000-4000-8000-000000000021',ref=(line:number)=>`${fixture.sourceId}:L${line}`;
const metadata={supplier:fixture.supplier,supplier_source_ref:ref(4),document_ref:fixture.documentReference,document_source_ref:ref(6)};
const extraction={source_ref:ref(8),description:'Alaska White',quantity:'1',unit:'Bag',size:'#0',vendor_sku:null};
const selection={selections:[{source_ref:ref(8),candidate_id:`standard:${fixture.catalog.standard[0].id}`}],exclusions:[]};
const document=()=>({filename:'synthetic-tendev-receival-20261030-01.pdf'});
const checks:string[]=[];
async function check(name:string,run:()=>Promise<void>){await run();checks.push(name);}

async function exercise(revokeBeforeFinal:boolean){
 const original=await readFile(resolve(fixture.originalPath));assert.equal(createHash('sha256').update(original).digest('hex'),fixture.sha256);
 let allowed=true;
 const now=Date.parse('2026-10-31T02:00:00Z'),rpcNames:string[]=[],readTables:string[]=[],providerModes:string[]=[],toolTrace:string[]=[],diagnostics:InvestigationDiagnostic[]=[];
 let source:InvoiceReceivalSource={id:fixture.sourceId,ownerId:owner,filename:document().filename,mediaType:'application/pdf',byteSize:original.length,sha256:fixture.sha256,storageBucket:'invoice-receival-originals',storagePath:`${owner}/${fixture.sourceId}/original`,state:'uploading',createdAt:new Date(now).toISOString(),expiresAt:new Date(now+86400000).toISOString(),version:1,verifiedAt:null,retainedAt:null,retainedDraftId:null,evidenceSha256:null,agentState:null};
 const store:ReceivalRuntimeSourceStore={async get(id){assert.equal(id,source.id);return clone(source);},async download(id){assert.equal(id,source.id);return {source:clone(source),original:new Blob([original],{type:'application/pdf'})};},async record(input){assert.equal(input.actorId,owner);assert.equal(input.sourceId,source.id);assert.equal(input.expectedVersion,source.version);assert.equal(input.verifiedSha256,fixture.sha256);source={...source,state:'ready',verifiedAt:new Date(now).toISOString(),version:source.version+1,agentState:clone(input.state)};return clone(source);},async abandon(){throw Error('No abandonment allowed in this regression');}};
 const caller={from(table:string){assert(['vendor_catalog','vendor_catalog_v2','pending_receivals'].includes(table));readTables.push(table);let columns='',first=0,last=249;
  const query={select(value:string){columns=value;return query;},eq(){return query;},in(){return query;},or(){return query;},order(){return query;},range(start:number,end:number){first=start;last=end;return query;},abortSignal(signal:AbortSignal){assert.equal(signal.aborted,false);return query;},then(resolve:(value:unknown)=>unknown,reject?:(error:unknown)=>unknown){const rows=table==='vendor_catalog'?fixture.catalog.standard:[];return Promise.resolve({data:rows.slice(first,last+1).map(row=>Object.fromEntries(columns.split(',').map(key=>[key,row[key]??null]))),count:rows.length,error:null}).then(resolve,reject);}};return query;
 },async rpc(name:string,args:Row={}){rpcNames.push(name);if(name==='can_prepare_invoice_receival')return {data:allowed,error:null};assert.equal(name,'has_app_capability','No business mutation RPC may be called');return {data:args.p_capability==='readOperationalData',error:null};}} as unknown as ReceivalAgentCaller;
 const call=(id:string,name:string,args:Record<string,JsonValue>={}):AgentStep['calls'][number]=>({id,name,arguments:args});
 const steps:AgentStep[]=[
  {calls:[call('discover','discover_capabilities',{names:['read_invoice','search_catalog','check_receival_duplicates','prepare_pending_receivals']})],continuation:[],usage:emptyUsage()},
  {calls:[call('invoice','read_invoice')],continuation:[],usage:emptyUsage()},
  {calls:[call('catalog','search_catalog',extraction)],continuation:[],usage:emptyUsage()},
  {calls:[call('duplicates','check_receival_duplicates',metadata)],continuation:[],usage:emptyUsage()},
  {calls:[call('prepare','prepare_pending_receivals',selection)],continuation:[],usage:emptyUsage()},
  {calls:[],continuation:[],usage:emptyUsage(),final:{answer:'One synthetic pending-receival draft is ready for employee review. No records were created.',observations:[{text:'Alaska White #0: 1 Bag.',evidence_ids:['e4']}],inferences:[],recommendations:[],questions:[],completed_actions:[]}},
 ];
 const handler=createAuthenticatedReceivalAgent({model:'offline-scripted-not-live',preparationOnly:true,execution:{enabled:true,databaseEnvironment:'isolated-test'},now:()=>now,onDiagnostic:event=>diagnostics.push(event),sourceStore:()=>store,decodeAttachment:async()=>{throw Error('Private original path required');},extractDocument:extractOriginalInvoiceDocument,remainingUsd:()=>.25,assertNoFatal(){},createProvider(label,image){providerModes.push(label);
  if(image){assert.equal(createHash('sha256').update(image.bytes).digest('hex'),fixture.sha256);return {name:'OFFLINE retained transcription replay, not live vision',model:'offline-scripted-not-live',async step(request:AgentStepRequest){assert.deepEqual(request.tools,[]);return {calls:[],continuation:[],usage:emptyUsage(),final:{raw_lines:clone(fixture.rawLines)}};}} as AgentProvider;}
  let index=0;return {name:'OFFLINE explicit tool-sequence transport, not model reasoning',model:'offline-scripted-not-live',async step(request:AgentStepRequest){const step=steps[index++];assert.ok(step,'unexpected continuation');for(const item of step.calls){assert.ok(request.tools.some(tool=>tool.name===item.name));toolTrace.push(item.name);}if(revokeBeforeFinal&&step.final)allowed=false;return clone(step);}} as AgentProvider;
 }});
 const upload=await handler({action:'upload',sourceId:fixture.sourceId,syntheticConfirmed:true},owner,caller) as Row;
 if(revokeBeforeFinal){await assert.rejects(handler({action:'ask',attachmentId:upload.attachmentId,question:'Prepare the approved synthetic invoice.'},owner,caller),/permissions/);assert.equal(source.agentState?.draft,null);assert(rpcNames.every(n=>['has_app_capability','can_prepare_invoice_receival'].includes(n)));return;}
 const answer=await handler({action:'ask',attachmentId:upload.attachmentId,question:'Prepare pending receivals for this approved synthetic invoice.'},owner,caller) as Row;
 assert.equal((answer.agent as Row).status,'completed');const draft=(answer.localDemo as Row).draft as LocalReceivalDraft;assert.ok(draft);assert.equal(draft.rows.length,1);
 assert.deepEqual(draft.rows[0].sourceQuantity,{quantity:'1',unit:'Bag'});assert.equal(draft.rows[0].quantity,'1');assert.equal(draft.rows[0].unit,'Bag');assert.deepEqual(draft.rows[0].reasons,[]);
 assert.equal(draft.executionEnabled,false);assert.equal(draft.canApprove,false);assert.equal(draft.status,'review_required');assert.equal(draft.provenance?.documentReference,fixture.documentReference);
 assert.equal(source.agentState?.draft?.id,draft.id);assert.equal(source.agentState?.originalSha256,fixture.sha256);assert.deepEqual(source.agentState?.rawLines,fixture.rawLines);assert.ok(source.agentState?.traceHash);
 assert.deepEqual(providerModes,['authenticated-invoice-vision','authenticated-invoice-investigation']);assert(readTables.includes('pending_receivals'));assert(rpcNames.every(name=>['has_app_capability','can_prepare_invoice_receival'].includes(name)));
 assert(diagnostics.some(event=>event.stage==='extraction'&&event.outcome==='ok'));
 assert.deepEqual(diagnostics.filter(event=>event.stage==='tool'&&event.outcome==='ok').map(event=>event.tool),toolTrace);
 assert(diagnostics.some(event=>event.stage==='draft'&&event.reasonCode==='completed'));
 for(const event of diagnostics)assert.deepEqual(Object.keys(event).sort(),['durationMs','outcome','reasonCode','stage','tool']);
 const logged=JSON.stringify(diagnostics);for(const privateValue of [fixture.sha256,fixture.documentReference,fixture.supplier,owner,fixture.sourceId])assert.equal(logged.includes(privateValue),false);
 for(const action of ['review','approve','execute','revoke','clear'])await assert.rejects(handler({action,draftId:draft.id},owner,caller),/prepares drafts only/);
 assert(rpcNames.every(n=>['has_app_capability','can_prepare_invoice_receival'].includes(n)));

}

const actualOwner='3785f6b9-742e-452f-af6c-31613a983633',origin='https://tendev.pages.dev',now=Date.parse('2026-10-31T02:00:00Z');
const preparation:HostedInvoicePreparationConfig={enabled:true,spendingAuthorized:true,startsAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+14*60000).toISOString()};
await check('default OFF, exact caller/origin and independent finite <=15-minute expiry fail closed',async()=>{
 assert(hostedInvoicePreparationEnabled(preparation,actualOwner,origin,now));
 for(const [config,id,url,time] of [[{...preparation,enabled:false},actualOwner,origin,now],[preparation,owner,origin,now],[preparation,actualOwner,'https://tenops.pages.dev',now],[preparation,actualOwner,origin,Date.parse(preparation.expiresAt)],[{...preparation,expiresAt:new Date(now+16*60000).toISOString()},actualOwner,origin,now]] as const)assert.equal(hostedInvoicePreparationEnabled(config,id,url,time),false);
});
await check('verified original scope rejects wrong hash, owner, byte count, media type and retained/deleted sources',async()=>{
 const source={ownerId:actualOwner,sha256:fixture.sha256,byteSize:2877,mediaType:'application/pdf',state:'ready'} as InvoiceReceivalSource;assert(preparationDocumentMatches(source,actualOwner));
 for(const change of [{sha256:'a'.repeat(64)},{ownerId:owner},{byteSize:2878},{mediaType:'image/png'},{state:'retained'},{state:'deleted'}])assert.equal(preparationDocumentMatches({...source,...change} as InvoiceReceivalSource,actualOwner),false);
});
await check('preparation contract needs read-helper only and rejects every approval/write action without touching runtime',async()=>{
 let allowed=true,runs=0;const calls:string[]=[];
 const caller={async rpc(name:string){calls.push(name);assert.equal(name,'can_prepare_invoice_receival');return {data:allowed,error:null};}};
 const contract=createHostedReceivalContract({owner:actualOwner,origin,config:{enabled:false,executionEnabled:false,origins:[],employeeIds:[],expiresAt:''},preparation,caller,service:async()=>{throw Error('No service mutation');},runtime:async()=>{runs++;return {preparationOnly:true,executionEnabled:false};},now:()=>now});
 assert.deepEqual(await contract({workspace:'invoice-receivals.v1',action:'status'}),{preparationOnly:true,executionEnabled:false});assert.equal(runs,1);
 for(const action of ['review','approve','execute','get','revoke','clear'])await assert.rejects(contract({workspace:'invoice-receivals.v1',action}),/prepares non-executing drafts only/);
 assert.equal(runs,1);allowed=false;await assert.rejects(contract({workspace:'invoice-receivals.v1',action:'status'}),/permissions/);assert.equal(runs,1);assert(calls.every(n=>n==='can_prepare_invoice_receival'));
});
await check('ordinary employees cannot spend prep allowance even when general authorization and shared meter are available',async()=>{
 for(const config of [preparation,{...preparation,expiresAt:new Date(now-1).toISOString()}]){
  const f=createHostedTenbotFixture();assert.equal(f.state.budget,true);
  const ordinary=f.handler(origin,{spendingAuthorized:ordinaryTenbotSpendingAuthorized(true,config)});
  await ordinary({action:'ask',question:'How do I create a group?'});
  assert.equal(f.state.providerCalls,0);assert.equal(f.reservations.size,0);assert.equal(f.state.qwenCalls,1);
 }
 assert.equal(ordinaryTenbotSpendingAuthorized(true,{...preparation,enabled:false}),true);
 const edge=await readFile(new URL('../supabase/functions/tenbot/index.ts',import.meta.url),'utf8');assert(edge.includes("spendingAuthorized:ordinaryTenbotSpendingAuthorized(Deno.env.get('TENBOT_OPENAI_SPEND_AUTHORIZED')==='true',preparation)"));
});
await check('real runtime creates one 1 Bag non-executing draft with both write capabilities false',()=>exercise(false));
await check('fresh preparation authorization revocation blocks publication after model continuation',()=>exercise(true));
const receipt={mode:'offline scripted provider and simulated database/Storage only; not live inference or JWT/RLS proof',passed:checks.length,checks,inferenceCalls:0,inferenceCostUsd:0,operationalWrites:0};
const output=process.argv.indexOf('--output');if(output>=0){assert(process.argv[output+1]);await writeFile(resolve(process.argv[output+1]),JSON.stringify(receipt,null,2)+'\n');}
console.log(JSON.stringify(receipt,null,2));
