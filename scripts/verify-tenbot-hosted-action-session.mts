/** Focused real session/hosted-constructor integration over existing private
 * history fixtures and local provider doubles. No network, inference or SQL. */
import assert from 'node:assert/strict';
import {createContextFixture} from './support/tenbot-context-fixture.mjs';
import {createTenbotAgentSessions} from '../supabase/functions/_shared/tenbot-agent-session';
import {createTenbotAgentHistoryStore} from '../supabase/functions/_shared/tenbot-agent-history-store';
import {createHostedTenbot,type HostedRpc} from '../supabase/functions/_shared/tenbot-hosted';
import {createHostedOperations,authorizeHostedOperationHistory,type HostedOperationsDependencies} from '../supabase/functions/_shared/tenbot-hosted-operations';
import {createReviewedActionService,type ActionCard,type ActionReference,type ActionStatus} from '../supabase/functions/_shared/tenbot-actions';
import {employeeDisplayValid,type EmployeeDisplay} from '../supabase/functions/_shared/tenbot-employee-history';
import {AgentStepError,emptyUsage,type AgentProvider,type AgentStep,type AgentStepRequest,type JsonValue} from '../supabase/functions/_shared/tenbot-agent';
import type {InvoiceReceivalSource} from '../src/modules/inventory/invoice-receival-attachments';

const id=(n:number)=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sourceId=id(2),sessionId=id(3),question='Prepare a Proposal for Sample Customer on Atrium: quote unit price $10, quantity 2 ea of white tread.';
const summary="I've prepared 1 Proposal line for Sample Customer for review. Nothing has been saved or issued.";
const field=(path:string,value:string,source_ref='employee')=>({path,value,source_ref});
const proposal=(document=false):Record<string,JsonValue>=>({customer_company_id:null,customer_contact_id:null,fields:[field('customer_name','Sample Customer'),field('project_name','Atrium')],lines:[{line_type:'product',fields:[field('description','white tread',document?`${sourceId}:L1`:'employee'),field('quantity','2'),field('unit','ea'),field('rate','10')]}]});
const blob=new Blob(['%PDF-local session source'],{type:'application/pdf'}),sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(value=>value.toString(16).padStart(2,'0')).join('');
type Reply=Record<string,unknown>&{conversationId:string;message:string;actionStatuses?:ActionStatus[];historyTurns?:Array<{question:string;answer:Reply}>;turns?:Array<{question:string;answer:Reply}>};
type PlanOptions={finalQuestion?:string;failBeforeTools?:boolean;scopeReads?:number};
function fixture(){
 const f=createContextFixture();f.state.now=Date.now();
 const source:InvoiceReceivalSource={id:sourceId,ownerId:f.owner,filename:'private-specification.pdf',mediaType:'application/pdf',byteSize:blob.size,sha256:sha,storageBucket:'invoice-receival-originals',storagePath:`${f.owner}/${sourceId}/original`,state:'ready',createdAt:'2026-11-02T00:00:00Z',expiresAt:'2099-11-03T00:00:00Z',version:2,verifiedAt:'2026-11-02T00:01:00Z',retainedAt:null,retainedDraftId:null,evidenceSha256:'b'.repeat(64),agentState:{version:'invoice-receival-state.v1',originalSha256:sha,visionSha256:sha,rawLines:['white tread: private supplied specifications'],sourceRows:[],draft:null,traceHash:null}};
 const statuses=new Map<string,ActionStatus>(),published:Record<string,unknown>[]=[],requests:unknown[]=[];
 let failCommit=false;
 const caller:HostedRpc=async(name,args={})=>{
  if(name==='get_invoice_receival_source')return {data:structuredClone(source),error:null};
  if(name==='get_tenbot_reviewed_action'){const status=statuses.get(String(args.p_action_id));return {data:status?structuredClone(status):null,error:null};}
  if(name==='revoke_tenbot_reviewed_action'){const status=statuses.get(String(args.p_action_id));if(status){status.state='revoked';status.card.confirmation.available=false;}return {data:{id:args.p_action_id,revoked:true},error:null};}
  return f.caller(name,args);
 };
 const service:HostedRpc=async(name,args={})=>{
  if(name==='prepare_tenbot_reviewed_action'){
   assert.equal(args.p_owner,f.owner);assert.equal(args.p_session_id,sessionId);published.push(structuredClone(args));
   const previous=args.p_supersedes_id?statuses.get(String(args.p_supersedes_id)):undefined;if(previous){previous.state='revoked';previous.card.confirmation.available=false;}
   const intent=args.p_intent as {operation:ActionCard['operation'];review:ActionCard['review']};
   const reference:ActionReference={id:crypto.randomUUID(),revision:(previous?.card.reference.revision??0)+1,hash:String(published.length).padStart(64,'a'),expiresAt:'2099-11-03T00:00:00Z'};
   const card:ActionCard={kind:'proposed_action',contract:'tenbot.actions.v1',reference,operation:intent.operation,review:intent.review,confirmation:{kind:'account_password',available:false}};
   statuses.set(reference.id,{contract:'tenbot.actions.v1',card,state:'prepared',receipt:null});return {data:card,error:null};
  }
  if(failCommit&&name==='tenbot_employee_commit')return {data:false,error:null};
  return f.service(name,args);
 };
 const reviewedCaller={rpc:(name:string,args?:Record<string,unknown>)=>caller(name,args),from(){throw Error('Unexpected table read in session test');},storage:{from(){return {async download(){return {data:blob,error:null};},async upload(){throw Error('No upload');},async remove(){throw Error('No deletion');}};}}} as unknown as HostedOperationsDependencies['caller'];
 const can=async()=>f.state.allowed;
 const actionCaller={async rpc(name:string,args:Record<string,unknown>){const result=await caller(name,args);return {data:result.data,error:result.error?{code:'unavailable'}:null};}};
 const operationHistory={authorizeAccess:(refs:Parameters<typeof authorizeHostedOperationHistory>[1])=>authorizeHostedOperationHistory({owner:f.owner,caller:reviewedCaller,can},refs),getAction:(reference:ActionReference)=>createReviewedActionService(actionCaller).get(reference)};
 const operations=(input:{question:string;documentIds:string[]})=>createHostedOperations({owner:f.owner,...input,caller:reviewedCaller,service:{async rpc(name,args){const result=await service(name,args);return {data:result.data,error:result.error?{code:'unavailable'}:null};}},sessionId,can});
 function plan(document=false,clarify=false,scopeReads=0,scopeOnly=false,options:PlanOptions={}){
  const calls=clarify?[]:[...Array.from({length:scopeReads},()=>({name:'describe_assistant_scope',arguments:{}})),...(!scopeOnly?[...(document?[{name:'read_supplied_document',arguments:{source_id:sourceId}}]:[]),{name:'prepare_proposal_draft',arguments:proposal(document)}]:[])];let index=0;
  return (request?:AgentStepRequest):AgentStep=>{
   if(request)requests.push(structuredClone({instructions:request.instructions,history:request.history,tools:request.tools}));
   if(options.failBeforeTools)throw new AgentStepError('budget-exhausted');
   index++;if(!clarify&&index===1)return {calls:[{id:'discover',name:'discover_capabilities',arguments:{names:[...new Set(calls.map(call=>call.name))]}}],continuation:[],usage:emptyUsage()};
   if(!clarify&&index<=calls.length+1){const call=calls[index-2];return {calls:[{id:'operation'+index,...call,arguments:call.arguments as Record<string,JsonValue>}],continuation:[],usage:emptyUsage()};}
   const text=clarify?'Which Proposal details should I use?':summary;
   return {calls:[],continuation:[],usage:emptyUsage(),final:{answer:options.finalQuestion?'Untrusted model completion wording.':text,observations:clarify?[]:[{text,evidence_ids:['e'+calls.length]}],inferences:[],recommendations:[],questions:options.finalQuestion?[options.finalQuestion]:clarify?[text]:[],completed_actions:[]}};
  };
 }
 function session(document=false,clarify=false,options:PlanOptions={}){
  const step=plan(document,clarify,options.scopeReads,undefined,options),provider:AgentProvider={name:'local injected session provider',model:'offline-scripted',async step(request){return step(request);}};
  return createTenbotAgentSessions({readOnlyHosted:true,modelDirectedReads:true,mode:'openai',sessionStore:createTenbotAgentHistoryStore(caller,service,{persistent:true}),can:async()=>f.state.allowed,jobTools:()=>f.state.jobTools!,provider:()=>provider,now:()=>f.state.now,reviewedOperations:operations,operationHistory});
 }
 function hosted(options:{enabled?:boolean;employeeEligible?:boolean;origin?:string;document?:boolean;clarify?:boolean;scopeReads?:number;scopeOnly?:boolean}={}){
  const step=plan(options.document,options.clarify,options.scopeReads,options.scopeOnly),fetcher:typeof fetch=async(_url,init)=>{
   const request=JSON.parse(String(init?.body));requests.push(request);f.state.providerCalls++;assert.equal(request.model,'gpt-6.1-terra');
   const response=step();return Response.json({status:'completed',model:'gpt-6.1-terra',service_tier:'default',usage:{input_tokens:80,output_tokens:10,total_tokens:90,input_tokens_details:{cached_tokens:0,cache_write_tokens:0}},output:response.calls.length?response.calls.map(call=>({type:'function_call',call_id:call.id,name:call.name,arguments:JSON.stringify(call.arguments)})):[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(response.final)}]}]});
  };
  return createHostedTenbot({owner:f.owner,origin:options.origin??'https://tendev.pages.dev',config:{enabled:true,normalEmployeeAuthorized:options.employeeEligible??true,origins:['https://tendev.pages.dev','https://tenops.pages.dev'],persistentHistory:true,modelDirectedReads:true,reviewedOperationsEnabled:options.enabled??true,apiKey:'offline-provider-placeholder',keyExpiresAt:'2099-11-03T00:00:00Z',spendingAuthorized:true},caller,service,reviewedCaller,actionSessionId:sessionId,jobTools:f.state.jobTools!,qwen:null,fetcher,now:()=>f.state.now});
 }
 return {...f,source,statuses,published,requests,session,hosted,failCommit(){failCommit=true;}};
}
const checks:string[]=[];
async function check(name:string,run:()=>unknown|Promise<unknown>){await run();checks.push(name);}
await check('ordinary persistent session publishes trusted statuses and hydrates exact references in current answer/history',async()=>{
 const f=fixture(),reply=await f.session()({action:'ask',question},f.owner) as Reply;assert(reply.message.startsWith(summary));assert(reply.message.includes('existing TenOps password'));assert.equal(reply.actionStatuses?.length,1);assert.equal(reply.actionStatuses?.[0].card.contract,'tenbot.actions.v1');
 assert.equal(reply.historyTurns?.at(-1)?.answer.actionStatuses?.length,1);const before=f.requests.length;
 const history=await f.session()({action:'history',conversationId:reply.conversationId},f.owner) as Reply;assert.equal(history.turns?.at(-1)?.answer.actionStatuses?.length,1);assert.equal(f.requests.length,before);
 const stored=f.archives.get(reply.conversationId)!.at(-1)!.turn as unknown as EmployeeDisplay;assert(employeeDisplayValid(stored));assert.equal(stored.actionReferences?.length,1);assert.deepEqual(stored.operationAccess,{documentIds:[],proposalAccess:true});
 const raw=JSON.stringify([...f.rows.values()].map(row=>row.state));assert(!raw.includes('actionStatuses')&&!raw.includes('p_estimate_inputs')&&!raw.includes('actionReferences'));
 assert(!JSON.stringify(f.requests).includes('"contract":"tenbot.actions.v1"'));assert(!JSON.stringify(f.requests).includes('p_estimate_inputs'));assert.equal(f.published.length,1);
});
await check('actual hosted constructor/provider discovers the authorized registry on TenDev and Production; gate OFF/ineligible reject additions',async()=>{
 const f=fixture(),reply=await f.hosted()({action:'ask',question}) as Reply;assert.equal(reply.actionStatuses?.length,1);assert(f.state.providerCalls>0);assert.equal(f.published.length,1);
 const serialized=JSON.stringify(f.requests);assert(serialized.includes('prepare_proposal_draft'));assert(serialized.includes('Employee-provided text uses source_ref employee'));assert(!serialized.includes('"contract":"tenbot.actions.v1"'));
 const production=fixture(),productionReply=await production.hosted({origin:'https://tenops.pages.dev'})({action:'ask',question}) as Reply;assert.equal(productionReply.actionStatuses?.length,1);assert(production.state.providerCalls>0);
 for(const options of [{enabled:false},{enabled:true,employeeEligible:false},{enabled:true,origin:'https://tenops.pages.dev.evil.test'},{enabled:true,origin:'https://tenops.pages.dev/'}]){const denied=fixture();await assert.rejects(denied.hosted(options)({action:'ask',question,documentIds:[sourceId]}));await assert.rejects(denied.hosted(options)({action:'ask',question,supersedes:reply.actionStatuses![0].card.reference}));assert.equal(denied.state.providerCalls,0);assert.equal(denied.published.length,0);}
 for(const extra of [{password:'PRIVATE-AUTH-PASSWORD'},{parameters:{}},{actionCards:[]}])await assert.rejects(f.hosted()({action:'ask',question,...extra}),/Invalid read-only/);
});
await check('hosted operations can finish after six sequential tool rounds while both round limits remain finite',async()=>{
 // Reproduce the six successful tool-round shape, using the existing actual
 // scope/document/Proposal adapters and a free scripted provider transport.
 const f=fixture(),reply=await f.hosted({document:true,scopeReads:3})({action:'ask',question,documentIds:[sourceId]}) as Reply;
 assert.equal(f.state.providerCalls,7);assert.equal(reply.actionStatuses?.length,1);assert(reply.message.startsWith(summary));assert.equal(f.published.length,1);
 const requests=f.requests as Array<{max_output_tokens:number}>;
 assert.equal(requests[0].max_output_tokens,640);assert(requests.slice(1).every(request=>request.max_output_tokens===1800));
 for(const enabled of [true,false]){
  const bounded=fixture(),stopped=await bounded.hosted({enabled,scopeReads:9,scopeOnly:true})({action:'ask',question:'Explain the available assistant scope and its boundaries.'}) as Reply;
  assert.equal(bounded.state.providerCalls,enabled?8:6);assert.equal(bounded.published.length,0);assert.equal(stopped.actionStatuses,undefined);
  assert((bounded.requests as Array<{max_output_tokens:number}>).every(request=>request.max_output_tokens===640));
 }
});
await check('prepared review uses only trusted card facts even when model clarification wording fails read publication',async()=>{
 const f=fixture(),modelQuestion='Before I continue, is that okay?',reply=await f.session(false,false,{finalQuestion:modelQuestion})({action:'ask',question},f.owner) as Reply;
 assert.equal(reply.actionStatuses?.length,1);assert.equal(f.published.length,1);assert(reply.message.startsWith(reply.actionStatuses![0].card.review.summary));assert(reply.message.includes('Nothing has been saved or issued.'));assert(reply.message.includes('existing TenOps password'));assert(!reply.message.includes(modelQuestion));assert(!reply.message.includes('Untrusted model'));
 const stored=f.archives.get(reply.conversationId)!.at(-1)!.turn as unknown as EmployeeDisplay;assert.equal(stored.actionReferences?.[0].id,reply.actionStatuses![0].card.reference.id);
});
await check('clarification without preparation remains a question and unsafe clarification cannot fabricate a card',async()=>{
 const f=fixture(),reply=await f.session(false,true)({action:'ask',question:'Help me prepare a Proposal'},f.owner) as Reply;
 assert.equal(reply.message,'Which Proposal details should I use?');assert.equal(reply.actionStatuses,undefined);assert.equal(f.published.length,0);
 const unsafe=fixture(),stopped=await unsafe.session(false,true,{finalQuestion:'Before I continue, is that okay?'})({action:'ask',question:'Help me prepare a Proposal'},unsafe.owner) as Reply;
 assert.equal(stopped.message,'I couldn\u2019t finish this request. Nothing has been saved. Please try again.');assert.equal(stopped.actionStatuses,undefined);assert.equal(unsafe.published.length,0);
});
await check('partial preparation and allowance exhaustion recover truthfully, publish no card and keep private retry history',async()=>{
 const f=fixture(),reply=await f.session(true,false,{scopeReads:5})({action:'ask',question,documentIds:[sourceId]},f.owner) as Reply;
 assert.equal(f.requests.length,8);assert(reply.message.includes('I read the supplied document'));assert(reply.message.includes('preparing that Proposal'));assert(reply.message.includes('Nothing has been saved or issued.'));assert(!reply.message.includes('Job'));assert.equal(reply.actionStatuses,undefined);assert.equal(f.published.length,0);
 const stored=f.archives.get(reply.conversationId)!.at(-1)!.turn as unknown as EmployeeDisplay;assert(employeeDisplayValid(stored));assert.equal(stored.question,question);assert.equal(stored.actionReferences,undefined);assert.deepEqual(stored.operationAccess,{documentIds:[sourceId],proposalAccess:true});
 const before=f.requests.length,history=await f.session()({action:'history',conversationId:reply.conversationId},f.owner) as Reply;assert.equal(history.turns?.at(-1)?.answer.message,reply.message);assert.equal(f.requests.length,before);
 f.source.state='deleted';const redacted=await f.session()({action:'history',conversationId:reply.conversationId},f.owner) as Reply;assert.equal(redacted.turns?.at(-1)?.question,'Previous private request');assert.equal(redacted.turns?.at(-1)?.answer.message,'');
 const noAttempt=fixture(),exhausted=await noAttempt.session(false,false,{failBeforeTools:true})({action:'ask',question},noAttempt.owner) as Reply;
 assert.equal(exhausted.message,'I couldn\u2019t finish this request. Nothing has been saved. Please try again.');assert.equal(exhausted.actionStatuses,undefined);assert.equal(noAttempt.published.length,0);assert.equal(noAttempt.requests.length,1);assert.equal(noAttempt.archives.get(exhausted.conversationId)!.at(-1)!.turn.question,question);
});
await check('private original revocation redacts the saved action and question, blocks later retransmission and needs no inference for history',async()=>{
 const f=fixture(),reply=await f.session(true)({action:'ask',question,documentIds:[sourceId]},f.owner) as Reply;assert.equal(reply.actionStatuses?.length,1);f.source.state='deleted';const before=f.requests.length;
 const history=await f.session()({action:'history',conversationId:reply.conversationId},f.owner) as Reply;const previous=history.turns?.at(-1);assert.equal(previous?.question,'Previous private request');assert.equal(previous?.answer.message,'');assert.equal(previous?.answer.actionStatuses,undefined);assert.equal(f.requests.length,before);
 await f.session(false,true)({action:'ask',question:'Help me continue this task',conversationId:reply.conversationId},f.owner);
 const newest=JSON.stringify(f.requests.slice(before));assert(!newest.includes('Sample Customer'));assert(!newest.includes(sourceId));
});
await check('superseding reference stays host-only, old review is revoked, and history retains original references',async()=>{
 const f=fixture(),first=await f.session()({action:'ask',question},f.owner) as Reply,reference=first.actionStatuses![0].card.reference;
 const second=await f.session()({action:'ask',question,conversationId:first.conversationId,supersedes:reference},f.owner) as Reply;
 assert.equal(second.actionStatuses?.[0].card.reference.revision,2);assert.equal(f.statuses.get(reference.id)?.state,'revoked');assert.equal(f.published[1].p_supersedes_id,reference.id);assert(!JSON.stringify(f.requests).includes(reference.hash));
 const archived=f.archives.get(first.conversationId)!;assert.equal((archived[0].turn.actionReferences as ActionReference[])[0].id,reference.id);assert.notEqual((archived[1].turn.actionReferences as ActionReference[])[0].id,reference.id);
});
await check('unpublished card is revoked when private history commit fails',async()=>{
 const f=fixture();f.failCommit();await assert.rejects(f.session()({action:'ask',question},f.owner),/changed or access expired/);assert.equal(f.published.length,1);assert([...f.statuses.values()].every(status=>status.state==='revoked'));
});
await check('old display rows and deterministic Job/history/Qwen fallback remain compatible',async()=>{
 const f=createContextFixture(),run=f.handler('https://tendev.pages.dev',{spendingAuthorized:false,persistentHistory:true,modelDirectedReads:true,reviewedOperationsEnabled:false});
 const answer=await run({action:'ask',question:'How many Jobs are currently in Production?'}) as Reply;assert(String(answer.message).includes('8'));assert.equal(answer.actionStatuses,undefined);
 const old=f.archives.get(answer.conversationId)!.at(-1)!.turn;assert(employeeDisplayValid(old));assert(!Object.hasOwn(old,'operationAccess'));assert(!Object.hasOwn(old,'actionReferences'));
 const history=await run({action:'history',conversationId:answer.conversationId}) as Reply;assert(history.turns?.some(turn=>turn.answer.message===answer.message));
 const fallback=createContextFixture(),reply=await fallback.handler('https://tendev.pages.dev',{spendingAuthorized:false,persistentHistory:true})({action:'ask',question:'How do I create a group conversation?'}) as Reply;assert.equal(reply.fallback,true);assert.equal(fallback.state.providerCalls,0);assert.equal(fallback.state.qwenCalls,1);assert.equal(reply.actionStatuses,undefined);
});
console.log(`Hosted action sessions: ${checks.length} focused injected-store/provider groups passed; no actual inference or database.`);
