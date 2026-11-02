/** Opt-in live evaluation only. Genuine Qwen + existing synthetic Auth/JWT/RLS
 * reads and shared meter RPCs; no setup, SQL, history persistence or business writes.
 * Run from the pinned 16ccb2f archive with only reviewed evaluation infra overlaid. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID,type BinaryLike} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {createTenbotAgentSessions} from '../supabase/functions/_shared/tenbot-agent-session';
import {createQwenAgentProvider} from '../supabase/functions/_shared/tenbot-qwen-agent';
import {createTenbotJobTools,type JobToolCaller,type TenbotJobToolName,type JobFacts} from '../supabase/functions/_shared/tenbot-job-tools';
import type {InferenceInput,InferenceProvider} from '../supabase/functions/_shared/tenbot-core';
import type {AgentSessionStore,StoredAgentState} from '../supabase/functions/_shared/tenbot-agent-history-store';
import {validateStoredAgentState} from '../supabase/functions/_shared/tenbot-agent-history-store';
import type {InvestigationDiagnostic} from '../supabase/functions/_shared/tenbot-investigation-diagnostics';
import {defaultModel,type InferenceUsage} from '../supabase/functions/_shared/tenbot-models';
import {openPilotProvider} from './support/tenbot-ai-pilot.mjs';

assert.deepEqual(process.argv.slice(2).sort(),['--isolated-free-fixture','--run'],'Explicit live + isolated-fixture opt-in required');
const REF='jltgxcfiprocydhbrahz',ORIGIN='https://'+REF+'.supabase.co';
const CONFIG='/private/tmp/tenops-tenbot-hosted-adapter-20261029/free-project-credentials.private.json';
const BASELINE='/private/tmp/tenops-tenbot-consolidated-production-20261101/candidate';
const ROOT=path.resolve(import.meta.dirname,'..');
const SHA='16ccb2fdac836f8a9b1cb57177e0af775d0e0840';
const pins:Record<string,string>={
 'tenbot-agent.ts':'f127eedc748afb81a953fd0c15603ccae30c66ddb58ece370f9ba774e576cf98',
 'tenbot-agent-session.ts':'16bdfc1401ef8336f5011b3122be7e045d39a599f2d239bb97db1ea15ad5c367',
 'tenbot-qwen-agent.ts':'5b94998cbc47e0e4f4879ae4418e74d0fbb539de7b0d7342f49d86806b320138',
 'tenbot-agent-operations.ts':'6c2b95c2e47a8cd7b3c7ff65947a30ed3bc2c4bb766dd220e442db9ad78f22c8',
 'tenbot-job-routing.ts':'98d4d02ea068cfd4e829beabc04361dcdee3c7d4af6837513ba59f2ff956a384',
 'tenbot-job-tools.ts':'5ab6a975b2295403cd712bf98db00f925896915f77c14be513ef608722a7dbea',
};
const baselinePins:Record<string,string>={
 'tenbot-job-routing.ts':'66a865ed7ecbe695966158ca322c3b26b7327aed70692433d49e2f92eb2df59d',
 'tenbot-job-session.ts':'718205cdbd37b07c23ee467cfab61160464093b1aeb73b4a06728bfb39c6ad35',
 'tenbot-conversation-context.ts':'209ec2c0ffea93b5891c65ea3a29efc4d7301c335fb9dd7df7ae29489790e077',
};
const hash=(value:BinaryLike)=>createHash('sha256').update(value).digest('hex');
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const bounded=(value:unknown,limit=16000)=>{const text=JSON.stringify(value??null);return text.length<=limit?value??null:{omitted:true,bytes:Buffer.byteLength(text),sha256:hash(text)};};
for(const [file,digest] of Object.entries(pins))assert.equal(hash(fs.readFileSync(path.join(ROOT,'supabase/functions/_shared',file))),digest,'Accepted source pin mismatch: '+file);
for(const [file,digest] of Object.entries(baselinePins))assert.equal(hash(fs.readFileSync(path.join(BASELINE,'supabase/functions/_shared',file))),digest,'Production deterministic baseline pin mismatch: '+file);
const st=fs.lstatSync(CONFIG);assert(st.isFile()&&!st.isSymbolicLink()&&(st.mode&0o077)===0&&st.uid===process.getuid?.(),'Existing owner-only isolated credential file required');
const cfg=JSON.parse(fs.readFileSync(CONFIG,'utf8'));
assert(cfg.fixtureKind==='standalone-free'&&cfg.projectRef===REF&&cfg.branchRef===REF&&cfg.url===ORIGIN,'Only the established standalone Free fixture is allowed');
const actor=cfg.actors?.employeeA;
assert(object(actor)&&typeof actor.id==='string'&&uuid.test(actor.id)&&typeof actor.email==='string'&&typeof actor.password==='string','Existing synthetic employeeA credentials unavailable');
assert(typeof cfg.anonKey==='string'&&typeof cfg.serviceRoleKey==='string','Existing fixture keys unavailable');
const owner=actor.id as string,started=Date.now(),deadline=started+12*60000;
const DIR=fs.mkdtempSync('/private/tmp/tenops-tenbot-qwen-tools-live-');fs.chmodSync(DIR,0o700);
const events:Record<string,unknown>[]=[],turns:Record<string,unknown>[]=[],modelRounds:Record<string,unknown>[]=[],meterEvents:Record<string,unknown>[]=[],controls:Record<string,unknown>[]=[];
let phase='preflight',turnIndex=-1,lastDispatch=0,chargedNeurons=0,dispatches=0,disposed=false;
let pending:{id:string;name:string;arguments:Record<string,unknown>;used:boolean}[]=[];
const save=(name:string,value:unknown)=>fs.writeFileSync(path.join(DIR,name),JSON.stringify(value,null,2)+'\n',{mode:0o600});
const progress=(state:string)=>console.log(JSON.stringify({state,turn:turnIndex,dispatches,chargedNeurons:Math.round(chargedNeurons*1000)/1000,evidenceDirectory:DIR}));
function checkDeadline(){assert(Date.now()<deadline,'evaluation-deadline');}
const jobNames=new Set<TenbotJobToolName>(['find_jobs','get_job_summary','get_job_planning','get_job_labor_summary','get_production_overview']);
const readPaths=new Set(['/rest/v1/jobs','/rest/v1/production_rework_cycles','/rest/v1/job_updates','/rest/v1/manpower_entries']);
const callerRpcPaths=new Set(['/rest/v1/rpc/has_app_capability','/rest/v1/rpc/tenbot_authorize_history_jobs']);
const meterPaths=new Set(['/rest/v1/rpc/tenbot_reserve_usage','/rest/v1/rpc/tenbot_finish_usage']);
const makeFetch=(kind:'caller'|'meter'):typeof fetch=>async(input,init)=>{
 checkDeadline();const request=input instanceof Request?input:null,url=new URL(request?.url??String(input));
 assert.equal(url.origin,ORIGIN,'Only isolated fixture origin is permitted');
 const method=(init?.method??request?.method??'GET').toUpperCase();
 if(kind==='meter')assert(method==='POST'&&meterPaths.has(url.pathname),'Service credential restricted to existing meter RPCs');
 else assert(readPaths.has(url.pathname)&&['GET','HEAD'].includes(method)||callerRpcPaths.has(url.pathname)&&method==='POST'||url.pathname==='/auth/v1/token'&&method==='POST'||url.pathname==='/auth/v1/user'&&method==='GET','Caller transport is Auth + fixed read-only Job contracts only');
 const before=Date.now();let status:number|null=null;
 try{const response=await fetch(input,{...init,signal:AbortSignal.any([AbortSignal.timeout(8000),...(init?.signal?[init.signal]:[])])});status=response.status;return response;}
 finally{events.push({kind,phase,turn:turnIndex,method,path:url.pathname,status,durationMs:Date.now()-before});}
};
const client=createClient(ORIGIN,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:makeFetch('caller')}});
const meterFetch=makeFetch('meter');
async function can(id:string,capability:string){if(id!==owner)return false;const value=await client.rpc('has_app_capability',{p_capability:capability});return !value.error&&value.data===true;}
async function meter(name:string,args:Record<string,unknown>){
 assert(['tenbot_reserve_usage','tenbot_finish_usage'].includes(name),'Unexpected service RPC');
 if(name==='tenbot_reserve_usage')assert(args.p_user===owner&&args.p_model===defaultModel,'Meter scope mismatch');
 const before=Date.now(),response=await meterFetch(ORIGIN+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:cfg.serviceRoleKey,Authorization:'Bearer '+cfg.serviceRoleKey,'Content-Type':'application/json'},body:JSON.stringify(args)});
 const text=await response.text();assert(text.length<=4000,'Oversized meter response');let data:unknown=null;try{data=JSON.parse(text);}catch{}
 const code=object(data)&&typeof data.code==='string'&&/^[A-Z0-9_]{1,32}$/.test(data.code)?data.code:null;
 meterEvents.push({turn:turnIndex,name,status:response.status,code,durationMs:Date.now()-before,...(name==='tenbot_finish_usage'?{outcome:args.p_outcome,inputTokens:args.p_input_tokens,outputTokens:args.p_output_tokens,estimatedNeurons:args.p_estimated_neurons}:{reservedNeurons:args.p_reserved_neurons}),success:response.ok});
 return {data:response.ok?data:null,error:response.ok?null:{code:'fixture-meter-http-'+response.status}};
}
const canonicalArgs=(args:Record<string,unknown>)=>Object.fromEntries(Object.entries(args).filter(([k,v])=>!(v===''&&['query','cursor','start_date','end_date'].includes(k))).sort(([a],[b])=>a.localeCompare(b)));
const rawTools=createTenbotJobTools(client as unknown as JobToolCaller,{deadlineMs:10000});
const readTrace:Record<string,unknown>[]=[];
const tracedTools={authorizeHistory:rawTools.authorizeHistory,async execute(name:TenbotJobToolName,args:Record<string,unknown>){
 const match=phase==='agent'?pending.find(call=>!call.used&&call.name===name&&JSON.stringify(canonicalArgs(call.arguments))===JSON.stringify(canonicalArgs(args))):undefined;
 if(match)match.used=true;
 const start=Date.now(),result=await rawTools.execute(name,args);
 readTrace.push({phase,turn:turnIndex,origin:match?'model-selected':'host-preflight-or-reauthorization',...(match?{callId:match.id}:{}),name,args:bounded(args,1500),status:result.status,complete:result.complete,truncated:result.truncated,durationMs:Date.now()-start,result:bounded(result,16000)});
 return result;
}};
function memoryStore():AgentSessionStore{
 const states=new Map<string,{owner:string;revision:number;claim:string|null;state:StoredAgentState}>();
 return {async claim(id,supplied){assert.equal(id,owner);const key=supplied??randomUUID();let entry=states.get(key);if(supplied)assert(entry&&entry.owner===id,'Unknown owner-private in-memory conversation');if(!entry){entry={owner:id,revision:0,claim:null,state:{guidance:[],display:[]}};states.set(key,entry);}assert(!entry.claim,'Concurrent memory session');entry.claim=randomUUID();return {id:key,owner:id,revision:entry.revision,claim:entry.claim,expiresAt:Date.now()+120000,state:structuredClone(entry.state)};},async commit(lease,state){assert(validateStoredAgentState(state),'Invalid existing session state');const entry=states.get(lease.id);assert(entry&&entry.owner===lease.owner&&entry.revision===lease.revision&&entry.claim===lease.claim,'Memory lease mismatch');entry.state=structuredClone(state);entry.revision++;entry.claim=null;},async release(lease){const entry=states.get(lease.id);if(entry?.claim===lease.claim)entry.claim=null;},async clear(id,key){assert.equal(id,owner);assert.equal(states.get(key)?.owner,id);states.delete(key);}};
}
const baselineRouting=await import(pathToFileURL(path.join(BASELINE,'supabase/functions/_shared/tenbot-job-routing.ts')).href);
const baselineSession=await import(pathToFileURL(path.join(BASELINE,'supabase/functions/_shared/tenbot-job-session.ts')).href);
const baselineContext=await import(pathToFileURL(path.join(BASELINE,'supabase/functions/_shared/tenbot-conversation-context.ts')).href);
let controlContext:unknown=null;
async function control(question:string,reset=false){
 phase='deterministic-control';if(reset)controlContext=null;const begin=readTrace.length,start=Date.now();
 const current=controlContext as {references?:string[]}|null;
 const intent=baselineRouting.resolveJobIntent(question,{jobId:current?.references?.length===1?current.references[0]:'',continuity:controlContext??undefined},new Date());
 const result=intent?await baselineSession.prepareJobRequest(intent,tracedTools,question):null;
 const observed=readTrace.slice(begin).map(r=>({name:r.name,args:r.args,result:r.result}));
 if(result?.evidence)controlContext=baselineContext.contextFromReads(observed,question,Date.now(),controlContext,result.intent??undefined);
 return {mode:'production-deterministic-routing-no-prose-inference',intent:bounded(intent,2500),message:String(result?.message??'No deterministic operational intent selected'),durationMs:Date.now()-start,reads:readTrace.slice(begin)};
}
let opened:Awaited<ReturnType<typeof openPilotProvider>>|undefined;
try{
 progress('auth-preflight');const signed=await client.auth.signInWithPassword({email:actor.email as string,password:actor.password as string});
 assert(!signed.error&&signed.data.user?.id===owner&&signed.data.session,'existing-synthetic-auth-sign-in-unavailable');
 assert((signed.data.session.expires_at??0)*1000>deadline,'existing-synthetic-JWT-expires-before-evaluation-deadline');
 const verified=await client.auth.getUser();assert(!verified.error&&verified.data.user?.id===owner,'genuine-synthetic-jwt-verification-failed');
 assert(await can(owner,'readOperationalData'),'existing-synthetic-employee-lacks-readOperationalData');
 const found=await tracedTools.execute('find_jobs',{include_archived:false,limit:20});
 assert(found.status==='ok'&&found.complete&&found.data&&'jobs' in found.data,'existing-synthetic-job-read-unavailable');
 const jobs=(found.data as {jobs:JobFacts[]}).jobs;
 assert(jobs.length>=2,'need-two-existing-visible-synthetic-jobs-no-seeding-authorized');
 const chosen=jobs.filter(j=>j.job_number&&j.job_number.length<100).slice(0,2);assert(chosen.length===2,'existing-synthetic-Job-numbers-unavailable');
 const expectedOverview=await tracedTools.execute('get_production_overview',{statuses:['in_production'],include_archived:false});
 assert(expectedOverview.status==='ok'&&expectedOverview.complete,'complete-authorized-baseline-count-unavailable');
 save('scope.json',{candidate:SHA,pins,baseline:'e71bd981a583e0a4e706f9953c6cc1fcc4d576e1',baselinePins,fixture:REF,existingSyntheticIdentity:true,maxAdditionalNeurons:500,ordinarySpendingChanged:false,operationalWrites:0,fixtureSetupWrites:0,displayStore:'owner-scoped memory only',limits:{maxRounds:6,maxCalls:10,maxOutputTokens:640,maxDurationMs:75000},chosenJobs:chosen.map(j=>({job_id:j.job_id,job_number:j.job_number})),startedAt:new Date(started).toISOString()});
 opened=await openPilotProvider({model:defaultModel});
 const transport=opened.provider;
 const measured:InferenceProvider={name:transport.name,reserveEstimate:input=>{const estimate=transport.reserveEstimate?.(input);assert(estimate&&chargedNeurons+estimate.neurons<=500,'evaluation-500-neuron-bound');return estimate;},usage:input=>transport.usage?.(input)??null,async infer(input:InferenceInput,signal?:AbortSignal){
  checkDeadline();assert(input.agent,'Agent envelope required');const estimate=transport.reserveEstimate?.(input);
  assert(estimate&&estimate.model===defaultModel&&Number.isFinite(estimate.neurons)&&estimate.neurons>0,'request-reservation-unavailable');
  assert(chargedNeurons+estimate.neurons<=500,'evaluation-500-neuron-bound');
  chargedNeurons+=estimate.neurons;dispatches++;lastDispatch=Date.now();const start=Date.now();let value:unknown,usage:InferenceUsage|null=null;
  try{value=await transport.infer(input,signal);pending=object(value)&&Array.isArray(value.calls)?value.calls.filter(object).filter(call=>typeof call.id==='string'&&typeof call.name==='string'&&object(call.arguments)).map(call=>({id:call.id as string,name:call.name as string,arguments:call.arguments as Record<string,unknown>,used:false})):[];return value;}
  finally{usage=transport.usage?.(input)??null;if(usage){assert(usage.model===defaultModel&&usage.estimatedNeurons<=estimate.neurons,'actual-usage-exceeds-conservative-bound');chargedNeurons+=usage.estimatedNeurons-estimate.neurons;}modelRounds.push({turn:turnIndex,sequence:dispatches,transport:opened!.transport,latencyMs:Date.now()-start,reservedNeurons:estimate.neurons,usage,rawOutput:bounded(value??null,16000),uncertain:usage===null});save('model-rounds.json',modelRounds);}
 }};
 const sessions=createTenbotAgentSessions({mode:'openai',readOnlyHosted:true,modelDirectedReads:true,operationalHistory:false,sessionStore:memoryStore(),can,jobTools:id=>{assert.equal(id,owner);return tracedTools;},provider:()=>createQwenAgentProvider({provider:measured,owner,rpc:meter,can:()=>can(owner,'readOperationalData')}),onDiagnostic(event:InvestigationDiagnostic){events.push({turn:turnIndex,kind:'agent-diagnostic',...event});}});
 let conversationId:string|undefined;
 const cases=[
  {id:'production-count-proof',question:'How many Jobs are currently In Production?',reset:false},
  {id:'contextual-list',question:'Which Jobs are they?',reset:false},
  {id:'explicit-identity-compound',question:`For Job "${chosen[1].job_number}", give the saved scheduled dates, recorded labor hours for 2026-10-01 through 2026-10-31, and the number of recorded open follow-ups. Use the current Job rather than any previously discussed one. Distinguish unknown fields.`,reset:false},
  {id:'ambiguous-missing-information',question:'For that Job, when will it actually finish and how many labor hours remain? Explain what information is missing if that cannot be established.',reset:true},
 ];
 for(const [index,test] of cases.entries()){
  turnIndex=index;checkDeadline();if(index){while(Date.now()-lastDispatch<61000){progress('pacing-shared-six-round-per-minute-limit');await new Promise(resolve=>setTimeout(resolve,Math.min(10000,61000-(Date.now()-lastDispatch))));checkDeadline();}}
  const baseline=await control(test.question,test.reset);controls.push({id:test.id,...baseline});save('controls.json',controls);phase='agent';pending=[];const roundStart=modelRounds.length,readStart=readTrace.length,eventStart=events.length,start=Date.now();
  const result=await sessions({action:'ask',question:test.question,...(!test.reset&&conversationId?{conversationId}:{})},owner) as Record<string,unknown>;
  if(typeof result.conversationId==='string')conversationId=result.conversationId;
  const stop=events.slice(eventStart).filter(event=>event.kind==='agent-diagnostic'&&event.stage==='stop').at(-1);
  const status=stop?.reasonCode==='completed'&&stop.outcome==='ok'?'completed':'stopped';
  const selected=modelRounds.slice(roundStart).flatMap(round=>object(round.rawOutput)&&Array.isArray(round.rawOutput.calls)?round.rawOutput.calls:[]);
  const actualReads=readTrace.slice(readStart).filter(r=>r.origin==='model-selected');
  const record={id:test.id,actualModelInference:modelRounds.length>roundStart,status,reason:stop?.reasonCode??'missing-stop-diagnostic',deterministicFallback:false,message:bounded(result.message,6000),durationMs:Date.now()-start,modelCalls:modelRounds.length-roundStart,selectedCalls:selected,actualModelSelectedReads:actualReads,hostFreshnessReads:readTrace.slice(readStart).filter(r=>r.origin!=='model-selected'),sessionResponse:bounded(result,28000),baseline};
  turns.push(record);save('turns.json',turns);save('events.json',events);save('meter.json',meterEvents);progress('turn-complete');
  if(index===0)assert(modelRounds.length>roundStart&&actualReads.some(r=>jobNames.has(r.name as TenbotJobToolName)&&r.status==='ok'),'first-real-model-selected-read-proof-failed-stop');
  if(status!=='completed')break;
 }
 save('report.json',{evaluationFinished:true,allScenariosRuntimeCompleted:turns.length===cases.length&&turns.every(turn=>turn.status==='completed'),candidate:SHA,fixture:REF,actualModelInference:true,actualJwtRls:true,scriptedModelResponses:false,modelCalls:dispatches,chargedOrReservedNeurons:chargedNeurons,measuredUsage:modelRounds.map(r=>r.usage),turns:turns.length,latencyMs:Date.now()-started,actualUsd:0,usdBasis:'Existing verified Workers Free allowance; quota usage measured in Neurons, no paid activation',databaseWrites:'Only canonical shared inference reserve/finish accounting RPCs; zero business/history/Auth/profile writes',limitations:['Small existing synthetic fixture only; no Production data accessed.','Deterministic control uses the same authorized current tools and pinned Production router; no control prose inference.','Correctness requires inspecting recorded model answers, selected calls and same-caller control evidence; completion alone is not correctness.','No permission changes or new revoked-access scenarios executed; prior security evidence reused.','No hosted opt-in activation or Production routing changes.']});
 progress('evaluation-finished');
}catch(error){
 const stop=events.filter(event=>event.kind==='agent-diagnostic'&&event.stage==='stop').at(-1);
 const safe=error instanceof assert.AssertionError?error.message.slice(0,160):typeof stop?.reasonCode==='string'?stop.reasonCode:'live-evaluation-failed-see-safe-trace';
 save('stop.json',{completed:false,reason:safe,phase,turn:turnIndex,modelCalls:dispatches,chargedOrReservedNeurons:chargedNeurons,elapsedMs:Date.now()-started});save('turns.json',turns);save('model-rounds.json',modelRounds);save('events.json',events);save('meter.json',meterEvents);console.error(JSON.stringify({stopped:true,reason:safe,evidenceDirectory:DIR}));process.exitCode=1;
}finally{
 save('read-trace.json',readTrace);
 try{if(opened){await opened.dispose();disposed=true;}}
 finally{save('final-state.json',{disposed,modelCalls:dispatches,chargedOrReservedNeurons:chargedNeurons,grantActivations:0,enrollmentChanges:0,operationalWrites:0,fixtureSetupWrites:0,providerConfigurationChanges:0});}
}
