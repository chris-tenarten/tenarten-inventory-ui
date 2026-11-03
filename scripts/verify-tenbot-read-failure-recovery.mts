/** Focused scripted recovery/publication checks over the existing private
 * context fixture. Run in the task-private released-runtime validation tree. */
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {createContextFixture} from './support/tenbot-context-fixture.mjs';
import {createTenbotAgentSessions} from '../supabase/functions/_shared/tenbot-agent-session';
import {createTenbotAgentHistoryStore} from '../supabase/functions/_shared/tenbot-agent-history-store';
import {AgentStepError,emptyUsage,type AgentResult,type AgentStep,type AgentStepRequest,type AgentTool,type JsonValue} from '../supabase/functions/_shared/tenbot-agent';
import {reviewedOperationRecovery,readInvestigationRecovery,publishModelReadAnswer,modelReadFacts,modelScopeFacts,MODEL_READ_INSTRUCTIONS} from '../supabase/functions/_shared/tenbot-read-investigation';
import {AgentToolError,type InvestigationDiagnostic} from '../supabase/functions/_shared/tenbot-investigation-diagnostics';
import type {JobToolResult} from '../supabase/functions/_shared/tenbot-job-tools';
const releasedAgentSha='f127eedc748afb81a953fd0c15603ccae30c66ddb58ece370f9ba774e576cf98';
assert.equal(createHash('sha256').update(readFileSync(new URL('../supabase/functions/_shared/tenbot-agent.ts',import.meta.url))).digest('hex'),releasedAgentSha,'Use the task-private released runtime; preserve the unrelated dirty generic agent');
const checks:string[]=[],examples:Record<string,unknown>[]=[];
async function check(name:string,run:()=>Promise<void>|void){await run();checks.push(name);}
const stopped=(reason:string,status:AgentResult['status']='provider-unavailable'):AgentResult=>({status,reason,final:null,evidence:[],proposals:[],trace:[],usage:emptyUsage()});
const trace=(name:string,outcome='error')=>({event:'tool' as const,round:1,name,outcome,durationMs:1});
const registered=[{name:'prepare_proposal_draft',kind:'prepare' as const},{name:'prepare_pending_receivals',kind:'prepare' as const},{name:'read_supplied_document',kind:'read' as const}];
const noWriteCopy=(message:string)=>assert(!/nothing.*(?:saved|added)|prepar|issued|inventory|receival/i.test(message),message);
await check('typed read failures stay distinct, do not echo private error text and never imply attempted writes',()=>{
 const cases:[AgentResult,Parameters<typeof readInvestigationRecovery>[1],RegExp][]=[
  [stopped('authorization-denied','blocked'),{},/access|underlying information/],
  [stopped('provider-error'),{reads:[{status:'not_found_or_not_authorized'} as JobToolResult]},/current access/],
  [stopped('error-limit','limit'),{reasonCodes:['invalid-arguments']},/lookup.*details/],
  [stopped('provider-error'),{reads:[{status:'unavailable'} as JobToolResult]},/retrieve.*right now/],
  [stopped('invalid-final'),{reads:[{status:'partial',truncated:true} as JobToolResult]},/complete answer/],
  [stopped('invalid-final'),{},/verify a reliable answer/],
  [stopped('round-limit','limit'),{},/within its limits/],
  [stopped('budget-exhausted'),{},/inference allowance/],
  [stopped('PRIVATE-SQL-TOKEN-DETAIL'),{},/AI service/],
 ];
 for(const [result,evidence,expected] of cases){result.trace=[trace('find_jobs','ok')];const message=reviewedOperationRecovery(result,registered,evidence);assert.match(message,expected);noWriteCopy(message);assert(!message.includes('PRIVATE-SQL-TOKEN-DETAIL'));}
});
await check('A truncated display with complete overview totals is not described as an unknown exact total',()=>{
 const message=readInvestigationRecovery(stopped('invalid-final'),{reads:[{tool:'get_production_overview',status:'ok',complete:true,truncated:true,data:{counts:{jobs:27,scheduled:20,unscheduled:7}}} as unknown as JobToolResult]});
 assert.match(message,/complete answer/);assert(!/unknown|cannot.*total|can’t.*total|exact total|no matching|\b0\b/i.test(message));noWriteCopy(message);
});
await check('only actual prepare attempts receive unsaved-state wording; document reads alone remain read-only',()=>{
 const base=stopped('error-limit','limit');
 const readOnly={...base,trace:[trace('read_supplied_document','ok')]};noWriteCopy(reviewedOperationRecovery(readOnly,registered));
 const proposal=reviewedOperationRecovery({...base,trace:[trace('read_supplied_document','ok'),trace('prepare_proposal_draft')]},registered);
 assert.match(proposal,/I read the supplied document.*preparing that Proposal.*Nothing has been saved or issued/);
 assert.match(reviewedOperationRecovery({...base,trace:[trace('prepare_pending_receivals')]},registered),/preparing the receiving entries.*Nothing has been added to Pending Receivals/);
 assert.match(reviewedOperationRecovery({...base,trace:[trace('prepare_proposal_draft'),trace('prepare_pending_receivals')]},registered),/all the requested changes.*Nothing has been saved or added/);
 noWriteCopy(reviewedOperationRecovery({...base,trace:[trace('prepare_proposal_draft')]},[{name:'prepare_proposal_draft',kind:'read'}]));
});
type Reply={conversationId:string;message:string;turns?:{answer:{message:string}}[];actionStatuses?:unknown[]};
type Plan=(request:AgentStepRequest,round:number)=>AgentStep;
const call=(id:string,name:string,args:Record<string,JsonValue>)=>({id,name,arguments:args});
const step=(...calls:AgentStep['calls']):AgentStep=>({calls,continuation:[],usage:emptyUsage()});
const discover=(...names:string[])=>step(call('discover','discover_capabilities',{names}));
const lookup=()=>call('lookup','find_jobs',{query:'Context Alpha',statuses:[],schedule:'all',include_archived:false,limit:20,cursor:''});
function final(text:string,evidence='e1'):AgentStep{return{...step(),final:{answer:text,observations:[{text,evidence_ids:[evidence]}],inferences:[],recommendations:[],questions:[],completed_actions:[]}};}
function fact(request:AgentStepRequest,tool:string,id:string){for(const h of [...request.history].reverse())if(h.kind==='tool_result'){const o=JSON.parse(h.output);if(o.tool===tool&&o.data?.answer_facts){const f=o.data.answer_facts.find((x:{id:string})=>x.id===id);if(f)return{text:f.text,evidence:o.evidence_id};}}throw Error('Expected host fact missing');}
function fixture(readState?:JobToolResult['status'],rejectDiagnostics=false){
 const f=createContextFixture();f.state.now=Date.now();f.tables.jobs[0].requested_delivery_date='2026-11-20';
 const requests:AgentStepRequest[]=[],diagnostics:InvestigationDiagnostic[]=[],real=f.state.jobTools!;
 const jobTools={authorizeHistory:real.authorizeHistory,async execute(...args:Parameters<typeof real.execute>){const value=await real.execute(...args);return readState?{...value,status:readState,complete:false,truncated:readState==='partial',data:null,accessRefs:[],sources:[]}:value;}};
 const tools:AgentTool[]=registered.map(t=>({...t,description:'Synthetic recovery regression only.',parameters:{type:'object',properties:{},required:[],additionalProperties:false},async execute(){if(t.kind==='prepare')throw new AgentToolError('proposal_invalid_schema');return{data:{status:'ok'}};}}));
 function session(plan:Plan){let round=0;return createTenbotAgentSessions({readOnlyHosted:true,modelDirectedReads:true,mode:'openai',sessionStore:createTenbotAgentHistoryStore(f.caller,f.service,{persistent:true}),can:async()=>f.state.allowed,jobTools:()=>jobTools,now:()=>f.state.now,onDiagnostic:event=>{diagnostics.push(event);if(rejectDiagnostics)return Promise.reject(Error('PRIVATE-DIAGNOSTIC-FAILURE'));},provider:()=>({name:'Scripted local recovery',model:'gpt-6.1-terra',async step(request){requests.push({...request,history:structuredClone(request.history),tools:structuredClone(request.tools)});return plan(request,++round);}}),reviewedOperations:async()=>({tools,async fresh(){return true;},access:()=>({documentIds:[],proposalAccess:false}),async publish(){throw Error('No synthetic action may be published');},async revoke(){throw Error('No synthetic action may exist');}}),operationHistory:{async authorizeAccess(){return true;},async getAction(){throw Error('No synthetic action may exist');}}});}
 async function ask(plan:Plan,question='Investigate the current Production Jobs for me.',conversationId?:string){return session(plan)({action:'ask',question,...(conversationId?{conversationId}:{})},f.owner) as Promise<Reply>;}
 async function reopen(id:string){return session(()=>{throw Error('History must not invoke a provider');})({action:'history',conversationId:id},f.owner) as Promise<Reply>;}
 return{...f,requests,diagnostics,ask,reopen,jobTools};
}
await check('Job-only invalid arguments recover through actual agent diagnostics without business wording',async()=>{
 const f=fixture(),reply=await f.ask((_request,n)=>n===1?discover('find_jobs'):step(call('invalid'+n,'find_jobs',{})));
 assert.equal(f.requests.length,4,JSON.stringify({message:reply.message,diagnostics:f.diagnostics}));assert.match(reply.message,/lookup.*details/);noWriteCopy(reply.message);assert.equal(reply.actionStatuses,undefined);assert.equal((await f.reopen(reply.conversationId)).turns?.at(-1)?.answer.message,reply.message);examples.push({case:'read-invalid-arguments',message:reply.message});
});
await check('Best-effort asynchronous diagnostic failures cannot change recovery or expose their payload',async()=>{
 const f=fixture(undefined,true),reply=await f.ask((_request,n)=>n===1?discover('find_jobs'):step(call('invalid'+n,'find_jobs',{})));
 assert.match(reply.message,/lookup.*details/);assert(!reply.message.includes('PRIVATE-DIAGNOSTIC'));assert.equal(f.requests.length,4);
});
await check('Publication rejection is classified after successful reads, with no forged prose or lost private retry history',async()=>{
 const f=fixture(),reply=await f.ask((_request,n)=>n===1?discover('find_jobs'):n===2?step(lookup()):final('PRIVATE-UNSUPPORTED-I-saved-a-record'));
 assert.equal(f.requests.length,3);assert.match(reply.message,/verify a reliable answer/);noWriteCopy(reply.message);assert(!reply.message.includes('PRIVATE-UNSUPPORTED'));assert.equal((await f.reopen(reply.conversationId)).turns?.at(-1)?.answer.message,reply.message);examples.push({case:'read-grounding',message:reply.message});
});
await check('Incomplete and unavailable read results preserve uncertainty rather than becoming zero or write failures',async()=>{
 for(const status of ['partial','unavailable'] as const){const f=fixture(status),reply=await f.ask((_request,n)=>{if(n===1)return discover('find_jobs');if(n===2)return step(lookup());throw new AgentStepError('provider-error');});noWriteCopy(reply.message);assert(!/\b0\b|no (?:matching )?jobs/i.test(reply.message));assert.match(reply.message,status==='partial'?/complete answer/:/retrieve.*right now/);}
 const denied=fixture('not_found_or_not_authorized');await assert.rejects(denied.ask((_request,n)=>n===1?discover('find_jobs'):step(lookup())),/access or the underlying records changed/);
});
await check('Real bounded session and allowance stops use their known read failure classes',async()=>{
 const allowance=fixture(),denied=await allowance.ask(()=>{throw new AgentStepError('budget-exhausted');});assert.match(denied.message,/inference allowance/);noWriteCopy(denied.message);assert.equal(allowance.requests.length,1);
 const limit=fixture(),stopped=await limit.ask((_request,n)=>n===1?discover('describe_assistant_scope'):step(call('scope'+n,'describe_assistant_scope',{})));assert.equal(limit.requests.length,8);assert.match(stopped.message,/within its limits/);noWriteCopy(stopped.message);
});
await check('Actual preparation failure still tells the employee that no business record was saved',async()=>{
 const f=fixture(),reply=await f.ask((_request,n)=>n===1?discover('read_supplied_document','prepare_proposal_draft'):n===2?step(call('document','read_supplied_document',{})):step(call('prepare'+n,'prepare_proposal_draft',{})),'Prepare the requested business draft.');
 assert.equal(f.requests.length,5);assert.match(reply.message,/I read the supplied document.*preparing that Proposal.*Nothing has been saved or issued/);assert.equal(reply.actionStatuses,undefined);assert.equal((await f.reopen(reply.conversationId)).turns?.at(-1)?.answer.message,reply.message);examples.push({case:'actual-prepare-failure',message:reply.message});
});
await check('Population and scope caveats cannot substitute for same-record detail evidence',async()=>{
 const f=fixture(),id=f.tables.jobs[0].id,found=await f.jobTools.execute('find_jobs',{query:'Context Alpha',statuses:[],schedule:'all',include_archived:false,limit:20}),facts=modelReadFacts(found);
 const identity=facts.find(x=>x.id==='match_1')!,population=facts.find(x=>x.kind==='limitation')!;assert(identity&&population);
 const publication=(tool:string,data:JsonValue,texts:string[]):AgentResult=>({...stopped(''),status:'completed',final:{answer:texts.join(' '),observations:texts.map(text=>({text,evidence_ids:['e1']})),inferences:[],recommendations:[],questions:[],completed_actions:[]},evidence:[{id:'e1',tool,data}]});
 const data={...found,answer_facts:facts} as unknown as JsonValue,bad=publication('find_jobs',data,[identity.text,population.text]);
 assert.equal(publishModelReadAnswer(bad,'When is the delivery date?',undefined,new Set(),undefined,{jobIds:[id]}),null);
 assert(publishModelReadAnswer(bad,'Which Job number matches?'));
 const scopeFacts=modelScopeFacts({execution:false,capabilities:[{name:'find_jobs'}]}),scopeFact=scopeFacts.find(x=>x.id==='read_evidence_limits')!,scope=publication('describe_assistant_scope',{answer_facts:scopeFacts} as unknown as JsonValue,[scopeFact.text]);
 assert.equal(publishModelReadAnswer(scope,'When is the delivery date?',undefined,new Set(),undefined,{jobIds:[id]}),null);assert(publishModelReadAnswer(scope,'What information can you read?'));
 f.tables.jobs[0].requested_delivery_date=null;const detail=await f.jobTools.execute('get_job_summary',{job_id:id}),recordFacts=modelReadFacts(detail),recordData={...detail,answer_facts:recordFacts} as unknown as JsonValue;
 for(const factId of ['job_requested_delivery_missing','job_date_limits']){const selected=recordFacts.find(x=>x.id===factId)!;assert(selected);const good=publication('get_job_summary',recordData,[selected.text]);assert(publishModelReadAnswer(good,'Which dates can be verified for this Job?',undefined,new Set(),undefined,{jobIds:[id]}));}
});
await check('Latest objective stays separate from prior lookup context and existing detail facts can answer a saved-date follow-up',async()=>{
 const f=fixture(),id=f.tables.jobs[0].id,first=await f.ask((request,n)=>{if(n===1)return discover('find_jobs');if(n===2)return step(lookup());const selected=fact(request,'find_jobs','match_1');return final(selected.text,selected.evidence);},'Find the Job number for the Context Alpha project.');
 assert.match(first.message,/CTX-1.*Context Alpha/);
 const rejected=await f.ask((request,n)=>{if(n===1)return discover('find_jobs');if(n===2)return step(lookup());const selected=fact(request,'find_jobs','match_1');return final(selected.text,selected.evidence);},'When is the delivery date?',first.conversationId);
 assert.match(rejected.message,/verify a reliable answer/);assert(!rejected.message.includes('CTX-1'));noWriteCopy(rejected.message);
 const start=f.requests.length;
 const second=await f.ask((request,n)=>{assert(request.instructions.includes('The latest employee question defines the current objective.'));const input=JSON.parse(request.history.find(h=>h.kind==='user')!.content);assert.equal(input.question,'When is the delivery date?');assert(JSON.stringify(input.server_context).includes('latest question remains the current objective'));assert(!JSON.stringify(input.server_context).includes(first.message));if(n===1)return discover('get_job_planning');if(n===2)return step(call('planning','get_job_planning',{job_id:id}));const selected=fact(request,'get_job_planning','job_requested_delivery');return final(selected.text,selected.evidence);},'When is the delivery date?',first.conversationId);
 assert.equal(f.requests.length-start,3);assert.match(second.message,/Requested delivery date: 2026-11-20/);assert(!second.message.includes('Persisted planned dates: 2026-10-01 through 2026-11-15'));assert.equal((await f.reopen(second.conversationId)).turns?.at(-1)?.answer.message,second.message);assert(MODEL_READ_INSTRUCTIONS.includes('they do not replace that objective'));examples.push({case:'latest-objective-scripted-selection',message:second.message,actualModel:false});
 f.tables.jobs[0].requested_delivery_date=null;
 const missing=await f.ask((request,n)=>{if(n===1)return discover('get_job_summary');if(n===2)return step(call('summary','get_job_summary',{job_id:id}));const selected=fact(request,'get_job_summary','job_requested_delivery_missing');return final(selected.text,selected.evidence);},'What requested date is saved for that Job?',first.conversationId);
 assert.match(missing.message,/No requested delivery date is saved/);assert.match(missing.message,/do not provide actual delivery or completion dates/);assert(!missing.message.includes('2026-11-15'));assert.equal((await f.reopen(missing.conversationId)).turns?.at(-1)?.answer.message,missing.message);examples.push({case:'missing-requested-date-via-summary',message:missing.message,actualModel:false});
});
console.log(JSON.stringify({passed:true,groups:checks.length,checks,examples,releasedAgentSha,actualInference:false,networkCalls:0,databaseCalls:0,limitation:'Provider choices and storage are scripted existing fixtures. This proves local recovery/publication contracts, not live Terra objective selection or genuine Auth/RLS.'},null,2));
