/** Focused comparison and integration contracts over actual hosted/session/tool
 * implementations. Provider decisions and telemetry are scripted. No model,
 * network, database, migration or real authorization certification occurs. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {createContextFixture} from './support/tenbot-context-fixture.mjs';
import {uuid} from './support/wave2-fixture.mjs';
import {createHostedTenbot} from '../supabase/functions/_shared/tenbot-hosted';
import {isSimpleJobRead} from '../supabase/functions/_shared/tenbot-read-routing';
import {resolveJobIntent} from '../supabase/functions/_shared/tenbot-job-routing';
import {type InferenceInput,type InferenceProvider} from '../supabase/functions/_shared/tenbot-core';
import {defaultModel,measuredUsage} from '../supabase/functions/_shared/tenbot-models';
import {emptyUsage,type AgentFinal,type AgentResult} from '../supabase/functions/_shared/tenbot-agent';
import {publishModelReadAnswer,TERRA_READ_FINAL_INSTRUCTIONS} from '../supabase/functions/_shared/tenbot-read-investigation';
import {safeInvestigationDiagnostic} from '../supabase/functions/_shared/tenbot-investigation-diagnostics';
import type {JobTools} from '../supabase/functions/_shared/tenbot-job-session';
const qa=JSON.parse(fs.readFileSync(new URL('./fixtures/tenbot-conversational-qa.json',import.meta.url),'utf8')) as {turns:{id:string;question:string}[]};
const question=(id:string)=>qa.turns.find(t=>t.id===id)!.question;
const checks:string[]=[],examples:unknown[]=[],comparisons:unknown[]=[];
type Fixture=ReturnType<typeof createContextFixture>;
type Plan=(input:InferenceInput,round:number,f:Fixture)=>unknown|Promise<unknown>;
type ToolOutput={evidence_id:string;tool:string;data:Record<string,unknown>;error?:unknown};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const outputs=(input:InferenceInput)=>input.agent!.history.flatMap(item=>item.kind==='tool_result'?[JSON.parse(item.output) as ToolOutput]:[]);
function selectedFact(input:InferenceInput,tool:string,id:string){const row=[...outputs(input)].reverse().find(o=>o.tool===tool&&Array.isArray(o.data?.answer_facts));assert(row,`Missing ${tool} evidence`);const fact=(row.data.answer_facts as {id:string;text:string}[]).find(f=>f.id===id);assert(fact,`Missing ${id}`);return {text:fact.text,evidence_ids:[row.evidence_id]};}
function final(claims:{text:string;evidence_ids:string[]}[],answer=claims.map(c=>c.text).join(' '),questions:string[]=[]){const value:AgentFinal={answer,observations:claims,inferences:[],recommendations:[],questions,completed_actions:[]};return {calls:[],final:value};}
const call=(id:string,name:string,args:Record<string,unknown>)=>({id,name,arguments:args});
const step=(...calls:ReturnType<typeof call>[])=>({calls,final:null});
const discover=(...names:string[])=>step(call('discover','discover_capabilities',{names}));
const find=(query:string)=>call('find','find_jobs',{query,statuses:[],include_archived:false,limit:20,cursor:''});
const period={start_date:'2026-10-26',end_date:'2026-11-01'};
function setup(){
 const f=createContextFixture();f.state.now=Date.parse('2026-11-02T02:40:00Z');
 Object.assign(f.tables.jobs[0],{name:'chris-dev-test',job_number:'DEV-20260803',planned_start:'2026-08-03',planned_end:'2026-09-07',requested_delivery_date:'2026-10-05'});
 const cycle=uuid(303030);f.tables.production_rework_cycles=[{id:cycle,job_id:f.tables.jobs[0].id,sequence_number:1,production_status:'complete',planned_start:'2026-10-27',planned_end:'2026-10-30',updated_at:'2026-10-31T12:00:00Z'}];
 f.tables.manpower_entries=[{id:uuid(1000001),job_id:f.tables.jobs[0].id,rework_cycle_id:null,work_date:'2026-10-29',am_hours:3,pm_hours:1,updated_at:'2026-10-31T12:00:00Z'},{id:uuid(1000002),job_id:f.tables.jobs[0].id,rework_cycle_id:cycle,work_date:'2026-10-30',am_hours:1,pm_hours:1,updated_at:'2026-10-31T12:00:00Z'}];
 f.tables.job_updates=[{id:uuid(50001),job_id:f.tables.jobs[0].id,created_at:'2026-10-31T12:00:00Z',requires_follow_up:true,resolved_at:null,follow_up_assignee_name:'Synthetic',body:'Synthetic follow-up, content not queried.'}];
 let plan:Plan=()=>{throw Error('Script not installed');},round=0,total=0;
 const inputs:InferenceInput[]=[],selected:{round:number;calls:unknown[]}[]=[],executed:{name:string;args:Record<string,unknown>}[]=[],meter:{name:string;args:Record<string,unknown>}[]=[];
 const measurements=new WeakMap<InferenceInput,ReturnType<typeof measuredUsage>>(),deniedCapabilities=new Set<string>(),permissionChecks:string[]=[];
 const caller:typeof f.caller=async(name,args={})=>{if(name==='has_app_capability'){const capability=String(args.p_capability);permissionChecks.push(capability);if(deniedCapabilities.has(capability))return {data:false,error:null};}return f.caller(name,args);};
 const provider:InferenceProvider={name:'OFFLINE scripted Qwen-shaped transport',reserveEstimate(){return{model:defaultModel,neurons:2};},usage:input=>measurements.get(input)??null,async infer(input){assert(input.agent,'Agent receives capability schemas, not legacy prose input');assert(!input.agent.instructions.includes(TERRA_READ_FINAL_INSTRUCTIONS),'Qwen instructions must not receive the Terra-only final contract');inputs.push(structuredClone(input));total++;const result=await plan(input,++round,f);measurements.set(input,measuredUsage(defaultModel,{prompt_tokens:111,completion_tokens:44}));if(object(result)&&Array.isArray(result.calls))selected.push({round,calls:structuredClone(result.calls)});return result;}};
 const real=f.state.jobTools!;let decorated:JobTools=real;
 const tools:JobTools={authorizeHistory:ids=>decorated.authorizeHistory!(ids),async execute(name,args){executed.push({name,args:structuredClone(args)});return decorated.execute(name,args);}};
 const service:typeof f.service=async(name,args={})=>{if(name==='tenbot_reserve_usage'||name==='tenbot_finish_usage')meter.push({name,args:structuredClone(args)});return f.service(name,args);};
 const make=(directed:boolean,qwen:InferenceProvider|null)=>createHostedTenbot({owner:f.owner,origin:'http://localhost:3000',config:{enabled:true,origins:['http://localhost:3000'],apiKey:'',keyExpiresAt:'',spendingAuthorized:false,persistentHistory:true,modelDirectedReads:directed},caller,service,jobTools:tools,qwen,now:()=>f.state.now,fetcher:async()=>{throw Error('Paid inference must remain disabled.');}});
 const handler=make(true,provider),legacy=make(false,null);
 const ask=async(q:string,id?:string,selectedPlan?:Plan)=>{if(selectedPlan)plan=selectedPlan;round=0;const started=performance.now(),before=total,beforeSelected=selected.length,beforeExecuted=executed.length;const reply=await handler({action:'ask',question:q,...(id?{conversationId:id}:{})}) as {message:string;conversationId:string;fallback?:boolean};return{reply,wallMs:performance.now()-started,modelSteps:total-before,selected:selected.slice(beforeSelected),executed:executed.slice(beforeExecuted)};};
 return {...f,inputs,selected,executed,meter,tools,provider,ask,legacy,handler,deniedCapabilities,permissionChecks,total:()=>total,decorate:(value:JobTools)=>{decorated=value;},real};
}
type Setup=ReturnType<typeof setup>;
const seedPlan=(name:string,id:string,tool='get_job_summary'):Plan=>(input,round)=>round===1?discover('find_jobs',tool):round===2?step(find(name)):round===3?step(call('detail',tool,{job_id:id,...(tool==='get_job_labor_summary'?period:{})})):final([selectedFact(input,tool,'job_identity'),selectedFact(input,tool,tool==='get_job_labor_summary'?'labor_total':'job_status')]);
const overview=(r:Awaited<ReturnType<Setup['ask']>>)=>({message:r.reply.message,providerSteps:r.modelSteps,selectedCalls:r.selected.map(s=>s.calls),executedTools:r.executed.map(e=>e.name),fallback:r.reply.fallback===true,stopReason:r.reply.fallback?'fallback observed; internal reason not exposed':'final accepted',wallMs:r.wallMs,scriptedInputTokens:r.modelSteps*111,scriptedOutputTokens:r.modelSteps*44,actualInference:false});
async function test(name:string,run:()=>Promise<void>){await run();checks.push(name);}
await test('E1 actual failed/partial QA question composes model-selected summary and labor instead of a single deterministic brief',async()=>{
 const before=setup(),baselineStart=performance.now(),legacy=await before.legacy({action:'ask',question:question('E1')}) as {message:string;fallback?:boolean};const baselineWallMs=performance.now()-baselineStart;assert.match(legacy.message,/6 hours/);assert(!legacy.message.includes('Unresolved recorded follow-ups: 1'));
 const f=setup(),id=f.tables.jobs[0].id,r=await f.ask(question('E1'),undefined,(input,n)=>n===1?discover('find_jobs','get_job_summary','get_job_labor_summary'):n===2?step(find('chris-dev-test')):n===3?step(call('summary','get_job_summary',{job_id:id}),call('labor','get_job_labor_summary',{job_id:id,start_date:'',end_date:''})):final([selectedFact(input,'get_job_summary','job_identity'),selectedFact(input,'get_job_summary','job_schedule'),selectedFact(input,'get_job_summary','open_follow_ups'),selectedFact(input,'get_job_labor_summary','labor_total'),selectedFact(input,'get_job_labor_summary','labor_limit')]));
 assert.match(r.reply.message,/Persisted planned dates: 2026-08-03 through 2026-09-07/);assert.match(r.reply.message,/Recorded labor: 6 hours/);assert.match(r.reply.message,/Unresolved recorded follow-ups: 1/);assert.equal(r.modelSteps,4);assert(!r.reply.fallback);assert(r.selected.flatMap(x=>x.calls).some(c=>object(c)&&c.name==='get_job_summary'));assert.equal(f.row(r.reply.conversationId).state.guidance.length,0);assert(!JSON.stringify(f.row(r.reply.conversationId).state).includes('Recorded labor: 6'));
 comparisons.push({case:'E1',question:question('E1'),before:{mode:'deterministic-only',message:legacy.message,executedTools:before.executed.map(e=>e.name),coverage:'labor only',result:'partial',requestedComponents:3,coveredComponents:1,fallback:legacy.fallback===true,providerSteps:0,wallMs:baselineWallMs,actualInference:false},after:{...overview(r),coverage:'saved dates + labor + unresolved-follow-up count',result:'pass',requestedComponents:3,coveredComponents:3}});
});
await test('Explicit new Job reference plus its cannot read the previous Job; model can recover through current exact lookup',async()=>{
 const f=setup(),old=f.tables.jobs[1],current=f.tables.jobs[0],seed=await f.ask(`Show status for Job "${old.name}".`,undefined,seedPlan(old.name,old.id));
 const r=await f.ask(question('A1'),seed.reply.conversationId,(input,n)=>n===1?discover('find_jobs','get_job_planning'):n===2?step(call('wrong','get_job_planning',{job_id:old.id}),find('DEV-20260803')):n===3?step(call('right','get_job_planning',{job_id:current.id})):final([selectedFact(input,'get_job_planning','job_identity'),selectedFact(input,'get_job_planning','job_schedule'),selectedFact(input,'get_job_planning','saved_delivery_comparison')]));
 assert(!r.executed.some(e=>e.name==='get_job_planning'&&e.args.job_id===old.id));assert(r.executed.some(e=>e.name==='get_job_planning'&&e.args.job_id===current.id));assert.match(r.reply.message,/before the requested delivery date/);assert(!r.reply.message.includes(old.name));assert(f.inputs.some(i=>outputs(i).some(o=>object(o)&&o.tool===undefined&&object(o)&&o.error==='capability_failed'))||JSON.stringify(f.inputs).includes('capability_failed'));
 examples.push({case:'A1',...overview(r),oldCanonicalIdNeverRead:true});
});
await test('B2 retained labor attribution and explicit period are selected by the model, not overwritten by summary routing',async()=>{
 const control=setup(),a=await control.legacy({action:'ask',question:question('B1')}) as {conversationId:string},beforeTools=control.executed.length,baselineStart=performance.now(),b=await control.legacy({action:'ask',question:question('B2'),conversationId:a.conversationId}) as {message:string;fallback?:boolean};const baselineWallMs=performance.now()-baselineStart;assert(!b.message.includes('Original or unclassified lifecycle labor: 4'));
 const f=setup(),id=f.tables.jobs[0].id,first=await f.ask(question('B1'),undefined,seedPlan('chris-dev-test',id,'get_job_labor_summary'));
 const r=await f.ask(question('B2'),first.reply.conversationId,(input,n)=>{
  assert(JSON.stringify(input.agent!.history[0]).includes('2026-10-26'));assert(JSON.stringify(input.agent!.history[0]).includes('2026-11-01'));assert(!JSON.stringify(input.agent!.history[0]).includes('Recorded labor: 6'));
  return n===1?discover('get_job_labor_summary'):n===2?step(call('attribution','get_job_labor_summary',{job_id:id,...period})):final([selectedFact(input,'get_job_labor_summary','job_identity'),selectedFact(input,'get_job_labor_summary','labor_total'),selectedFact(input,'get_job_labor_summary','labor_original'),selectedFact(input,'get_job_labor_summary','labor_rework_1'),selectedFact(input,'get_job_labor_summary','labor_limit')]);
 });
 assert.match(r.reply.message,/Original or unclassified lifecycle labor: 4 hours/);assert.match(r.reply.message,/Recorded Rework 1 labor: 2 hours/);assert(!r.selected.flatMap(x=>x.calls).some(c=>object(c)&&c.name==='get_job_summary'));assert(r.executed.filter(e=>e.name==='get_job_labor_summary').every(e=>e.args.start_date===period.start_date&&e.args.end_date===period.end_date));
 comparisons.push({case:'B2',question:question('B2'),fixture:'6 saved hours: 4 original/unclassified +2 completed Rework1; synthetic enrichment, not Production business facts',before:{mode:'deterministic-only',message:b.message,executedTools:control.executed.slice(beforeTools).map(e=>e.name),coverage:'summary, not labor attribution',result:'fail',requestedComponents:2,coveredComponents:0,fallback:b.fallback===true,providerSteps:0,wallMs:baselineWallMs,actualInference:false},after:{...overview(r),coverage:'correct4/2 attribution and retained explicit period',result:'pass',requestedComponents:2,coveredComponents:2}});
});
await test('C1 hypothetical readiness question lets the model select verified knowledge with no operational Job lookup',async()=>{
 const control=setup(),baselineStart=performance.now(),before=await control.legacy({action:'ask',question:question('C1')}) as {message:string;fallback?:boolean};const baselineWallMs=performance.now()-baselineStart;
 const f=setup(),r=await f.ask(question('C1'),undefined,(input,n)=>{
  if(n===1)return discover('search_workflow_knowledge');if(n===2)return step(call('knowledge','search_workflow_knowledge',{query:'Production Ordered materials ready planning completeness'}));
  const row=outputs(input).find(o=>o.tool==='search_workflow_knowledge')!;assert(row);const sources=row.data.sources as {id:string;guidance:string}[];assert(sources.some(s=>s.id==='knowledge-production'));assert(sources.some(s=>s.id==='workflow-po-allocations'));
  return final([{text:'A PO allocation does not establish that incoming material has been received or that a Job is ready. Allocated units become Job-reserved stock when the incoming material is received.',evidence_ids:[row.evidence_id]},{text:'Planning completeness is separate from material readiness and Production status. Scheduled jobs missing a Job number, requested delivery, labor estimate or customer need planning information; both planned dates are also required.',evidence_ids:[row.evidence_id]}]);
 });
 assert(!r.executed.length);assert.match(r.reply.message,/does not establish/);assert.match(r.reply.message,/Planning completeness/);assert(!r.reply.fallback);
 comparisons.push({case:'C1',question:question('C1'),before:{mode:'deterministic-only',message:before.message,executedTools:control.executed.map(e=>e.name),coverage:'literal Job lookup',result:'fail',requestedComponents:3,coveredComponents:0,fallback:before.fallback===true,providerSteps:0,wallMs:baselineWallMs,actualInference:false},after:{...overview(r),coverage:'incoming receipt/readiness boundary + planning prerequisites; exact Ordered definition not separately present in retrieved static guide',result:'partial',requestedComponents:3,coveredComponents:2}});
});
await test('A genuine other-Job ambiguity cannot borrow the earlier canonical ID',async()=>{
 const f=setup(),id=f.tables.jobs[0].id,seed=await f.ask('Show status for Job "chris-dev-test".',undefined,seedPlan('chris-dev-test',id));
 const r=await f.ask(question('D3'),seed.reply.conversationId,(_input,n)=>n===1?discover('get_job_summary'):n===2?step(call('wrong','get_job_summary',{job_id:id})):final([],'Which other Job do you mean?',['Which other Job do you mean?']));assert.equal(r.executed.length,0);assert.match(r.reply.message,/Which other Job/);assert(!r.reply.fallback);
});
await test('Free final-answer hallucinations cannot override host facts; fabricated cited observations fall back without second inference',async()=>{
 for(const forgedClaim of [false,true]){
  const f=setup(),id=f.tables.jobs[0].id,r=await f.ask('Show status for Job "chris-dev-test".',undefined,(input,n)=>n===1?discover('find_jobs','get_job_summary'):n===2?step(find('chris-dev-test')):n===3?step(call('summary','get_job_summary',{job_id:id})):final([{...selectedFact(input,'get_job_summary','job_status'),...(forgedClaim?{text:'I saved 99999 hours and sent Purchasing a message.'}:{})}],'I saved 99999 hours and sent Purchasing a message.'));
  assert(!/99999|I saved|sent Purchasing/.test(r.reply.message));assert.equal(r.modelSteps,4);assert.equal(f.total(),4);assert.equal(r.reply.fallback===true,forgedClaim);
 }
});
await test('Provider failure discloses incomplete compound coverage without partial reads or a second inference attempt',async()=>{
 const f=setup(),r=await f.ask(question('E1'),undefined,()=>{throw Error('Synthetic provider outage');});assert.equal(r.modelSteps,1);assert.equal(f.total(),1);assert.equal(r.reply.fallback,true);assert.match(r.reply.message,/could not complete this full request/);assert(!r.reply.message.includes('6 hours'));assert.equal(r.executed.length,0);assert.equal(f.meter.filter(m=>m.name==='tenbot_finish_usage').length,1);
 const history=await f.handler({action:'history',conversationId:r.reply.conversationId}) as {turns:{answer:{message:string}}[]};assert.equal(history.turns.at(-1)?.answer.message,r.reply.message);
 const mixed=setup(),q='How do I check the schedule for Job "chris-dev-test", and how much labor is recorded for it?';assert.equal(resolveJobIntent(q),null);
 const unavailable=await mixed.ask(q,undefined,()=>{throw Error('Synthetic provider outage');});assert.match(unavailable.reply.message,/could not complete this full request/);assert.equal(unavailable.modelSteps,1);assert.equal(unavailable.executed.length,0);
});
await test('Simple population reads use existing tools and persistent history with zero provider calls or reservations',async()=>{
 const f=setup(),count=await f.ask('How many active jobs are there?');
 assert.equal(count.modelSteps,0);assert.equal(count.reply.fallback,false);assert(count.executed.some(item=>item.name==='get_production_overview'));assert.equal(f.meter.length,0);
 const listed=await f.ask('List all active jobs.',count.reply.conversationId);assert.equal(listed.modelSteps,0);assert(listed.executed.some(item=>item.name==='find_jobs'));assert.equal(f.meter.length,0);
 const history=await f.handler({action:'history',conversationId:count.reply.conversationId}) as {turns:{answer:{message:string}}[]};assert.equal(history.turns.length,2);assert.equal(history.turns.at(-1)?.answer.message,listed.reply.message);
});
await test('Fast dispatch consumes the whole request and cannot swallow extra analysis or write goals',async()=>{
 for(const q of ['How many active jobs are there?','List all active jobs.','Show status for Job "Cedar and Bay".'])assert(isSimpleJobRead(q,resolveJobIntent(q)),q);
 for(const q of ['How many active jobs are there and how much labor is recorded?','How many active jobs and how many jobs on hold?','How many active jobs, how many on hold?','List active jobs and list completed jobs.','List active jobs; then send Purchasing a message.','Show status for Job "Cedar Bay" and its labor hours.','For Job "Cedar Bay", is the planned finish before its requested delivery?','Show labor for Job "Cedar Bay", including the days reported.'])assert(!isSimpleJobRead(q,resolveJobIntent(q)),q);
});
await test('Revocation between read and next model step prevents retransmission and publication',async()=>{
 const f=setup(),id=f.tables.jobs[0].id,seed=await f.ask('Show status for Job "chris-dev-test".',undefined,seedPlan('chris-dev-test',id));let changed=false;f.decorate({...f.real,async execute(name,args){const r=await f.real.execute(name,args);if(!changed&&name==='get_job_summary'){changed=true;f.state.allowed=false;}return r;}});
 const before=f.total();await assert.rejects(f.ask('What is its status?',seed.reply.conversationId,(_input,n)=>n===1?discover('get_job_summary'):n===2?step(call('summary','get_job_summary',{job_id:id})):final([],'Unexpected third step?',['Unexpected third step?'])));assert.equal(f.total()-before,2);assert.equal(f.state.providerCalls,0);
});
await test('Changed live source before another model step denies stale evidence',async()=>{
 const f=setup(),id=f.tables.jobs[0].id,seed=await f.ask('Show status for Job "chris-dev-test".',undefined,seedPlan('chris-dev-test',id));let changed=false;f.decorate({...f.real,async execute(name,args){const r=await f.real.execute(name,args);if(!changed&&name==='get_job_summary'){changed=true;f.tables.jobs[0].planned_end='2026-11-20';}return r;}});
 const before=f.total(),count=f.archives.get(seed.reply.conversationId)!.length;await assert.rejects(f.ask('What is its status?',seed.reply.conversationId,(_input,n)=>n===1?discover('get_job_summary'):n===2?step(call('summary','get_job_summary',{job_id:id})):final([],'Unexpected third step?',['Unexpected third step?'])),/access|underlying records|could not verify/i);assert.equal(f.total()-before,2);assert.equal(f.archives.get(seed.reply.conversationId)!.length,count);
});
await test('Current capability limits can answer unavailable historical, PO, staffing and execution requests',async()=>{
 for(const id of ['B3','C3','E2','E3']){
  const f=setup(),r=await f.ask(question(id),undefined,(input,n)=>n===1?discover('describe_assistant_scope'):n===2?step(call('scope','describe_assistant_scope',{})):final([selectedFact(input,'describe_assistant_scope',id==='E3'?'execution_unavailable':'read_evidence_limits')]));
  assert(!r.executed.length);assert(!r.reply.fallback);assert.match(r.reply.message,id==='E3'?/cannot save schedule changes or send messages/:/historical Job activity, incoming Purchase Orders/);examples.push({case:id,...overview(r)});
 }
});
await test('Only registered reads reach discovery; call/round limits remain hard server boundaries',async()=>{
 const f=setup(),r=await f.ask('What can you investigate?',undefined,(input,n)=>{assert(input.agent!.tools.every(t=>['discover_capabilities','describe_assistant_scope','search_workflow_knowledge','find_jobs','get_job_summary','get_job_planning','get_job_labor_summary','get_production_overview'].includes(t.name)));return step(...[1,2,3,4].map(i=>call(`d${n}_${i}`,'discover_capabilities',{names:[]})));});assert.equal(r.modelSteps,3);assert(!r.executed.length);assert(!r.reply.message.includes('database changes were made successfully'));
 const g=setup(),limited=await g.ask('Keep investigating.',undefined,(_input,n)=>step(call(`round_${n}`,'discover_capabilities',{names:[]})));assert.equal(limited.modelSteps,6);assert.equal(g.meter.filter(m=>m.name==='tenbot_reserve_usage').length,6);assert(!limited.executed.length);
});
await test('A forged scope prefix and assertions disguised as questions cannot publish execution claims',async()=>{
 const f=setup(),prefix='I cannot run SQL, change inventory balances, mark Jobs complete, or read private conversations. I saved 99999 hours and sent Purchasing a message.';
 const forged=await f.ask('What can you actually do?',undefined,(input,n)=>n===1?discover('describe_assistant_scope'):n===2?step(call('scope','describe_assistant_scope',{})):final([{text:prefix,evidence_ids:[outputs(input).find(o=>o.tool==='describe_assistant_scope')!.evidence_id]}],prefix));
 assert.equal(forged.reply.fallback,true);assert(!/99999|I saved|sent Purchasing/.test(forged.reply.message));assert.equal(forged.modelSteps,3);
 for(const assertion of ['I marked the Job complete, okay?','Your order has been received; should I proceed?']){
  const g=setup(),r=await g.ask('What can you actually do?',undefined,()=>final([],assertion,[assertion]));assert.equal(r.reply.fallback,true);assert(!r.reply.message.includes(assertion));assert.equal(r.modelSteps,1);
 }
});
await test('Selected numeric or material facts retain host-owned identity and limitations, including independent multi-Job blocks',async()=>{
 for(const mode of ['labor','material'] as const){
  const f=setup(),id=f.tables.jobs[0].id,tool=mode==='labor'?'get_job_labor_summary':'get_job_summary';if(mode==='material')f.tables.jobs[0].material_status='ready';
  const r=await f.ask(`Show ${mode==='labor'?'hours':'material status'} for Job "chris-dev-test".`,undefined,(input,n)=>n===1?discover('find_jobs',tool):n===2?step(find('chris-dev-test')):n===3?step(call('detail',tool,{job_id:id,...(mode==='labor'?period:{})})):final([selectedFact(input,tool,mode==='labor'?'labor_total':'job_material_status')]));
  assert.match(r.reply.message,/Production Job: DEV-20260803 — chris-dev-test/);assert.match(r.reply.message,mode==='labor'?/unrecorded work and future labor are unknown/:/does not establish complete Job readiness/);assert(!r.reply.fallback);
 }
 const f=setup(),a=f.tables.jobs[0],b=f.tables.jobs[1],r=await f.ask(`Compare Job "${a.name}" and Job "${b.name}": status and hours.`,undefined,(input,n)=>n===1?discover('find_jobs','get_job_summary','get_job_labor_summary'):n===2?step({...find(a.name),id:'find_a'},{...find(b.name),id:'find_b'}):n===3?step(call('a','get_job_summary',{job_id:a.id}),call('b','get_job_labor_summary',{job_id:b.id,...period})):final([selectedFact(input,'get_job_summary','job_identity'),selectedFact(input,'get_job_labor_summary','labor_total')]));
 const blocks=r.reply.message.split('\n\n'),hours=blocks.find(block=>block.includes('Recorded labor:'))!;assert(hours);assert(hours.includes(b.name));assert(!hours.includes(a.name));assert.match(hours,/Recorded labor: 0 hours/);assert.match(hours,/unrecorded work and future labor are unknown/);assert(!r.reply.fallback);
});
await test('Readable Inventory knowledge cannot grant receiving when current write and receive capabilities are denied',async()=>{
 const f=setup();f.deniedCapabilities.add('writeBusinessData');f.deniedCapabilities.add('receiveInventory');
 const r=await f.ask('Can my account receive Inventory?',undefined,(input,n)=>{
  if(n===1)return discover('search_workflow_knowledge');if(n===2)return step(call('inventory_guide','search_workflow_knowledge',{query:'Inventory current stock reservations'}));
  const row=outputs(input).find(o=>o.tool==='search_workflow_knowledge')!;assert((row.data.sources as {id:string}[]).some(s=>s.id==='knowledge-inventory'));return final([{text:'You can receive Inventory.',evidence_ids:[row.evidence_id]}]);
 });
 assert.equal(r.reply.fallback,true);assert(!r.reply.message.includes('You can receive Inventory.'));assert(f.permissionChecks.includes('writeBusinessData'));assert(f.permissionChecks.includes('receiveInventory'));assert.equal(r.modelSteps,3);
});
await test('Only reauthorized prior employee questions reach model context; old answers and revoked-record questions do not',async()=>{
 const f=setup(),id=f.tables.jobs[0].id,seed=await f.ask(question('B1'),undefined,seedPlan('chris-dev-test',id,'get_job_labor_summary'));
 const r=await f.ask(question('B2'),seed.reply.conversationId,(input,n)=>{
  const context=JSON.parse((input.agent!.history[0] as {content:string}).content).server_context as {question:string;answer:string}[];assert(context.some(turn=>turn.question===question('B1')));assert(!JSON.stringify(context).includes('Recorded labor: 6 hours'));
  return n===1?discover('get_job_labor_summary'):n===2?step(call('labor','get_job_labor_summary',{job_id:id,...period})):final([selectedFact(input,'get_job_labor_summary','labor_original')]);
 });assert(!r.reply.fallback);
 const before=f.total();await assert.rejects(f.ask('Can you revisit the earlier reporting question?',seed.reply.conversationId,(_input,n)=>{assert.equal(n,1);f.hidden.add(id);return discover('get_job_labor_summary');}),/access|underlying records|could not verify/i);assert.equal(f.total()-before,1);
 const next=await f.ask('What are your current read limits?',seed.reply.conversationId,(input,n)=>{
  const context=JSON.parse((input.agent!.history[0] as {content:string}).content).server_context as {question:string;answer:string}[];assert(!context.some(turn=>turn.question===question('B1')||turn.question===question('B2')));assert(!JSON.stringify(context).includes(id));
  return n===1?discover('describe_assistant_scope'):n===2?step(call('scope','describe_assistant_scope',{})):final([selectedFact(input,'describe_assistant_scope','read_evidence_limits')]);
 });assert(!next.reply.fallback);assert(!next.reply.message.includes('Recorded labor: 6'));
});
await test('A new named lookup without an extracted explicit form clears prior-only focus even after no match',async()=>{
 const f=setup(),id=f.tables.jobs[0].id,seed=await f.ask('Show status for Job "chris-dev-test".',undefined,seedPlan('chris-dev-test',id));
 const r=await f.ask("Check Cedar Bay's planning.",seed.reply.conversationId,(input,n)=>n===1?discover('find_jobs','get_job_summary'):n===2?step(find('Missing Cedar Bay')):n===3?step(call('old','get_job_summary',{job_id:id})):final([],'Which exact Job do you mean?',['Which exact Job do you mean?']));
 assert(!r.executed.some(e=>e.name==='get_job_summary'&&e.args.job_id===id));assert.match(r.reply.message,/Which exact Job/);assert(!r.reply.fallback);assert(JSON.stringify(f.inputs).includes('capability_failed'));
});
await test('Malformed or empty explicit Job quotes cannot reuse a previous canonical identity',async()=>{
 for(const malformed of ['Show the status of Job "chris-dev-test','Show the status of Job ""']){
  const f=setup(),id=f.tables.jobs[0].id,seed=await f.ask('Show status for Job "chris-dev-test".',undefined,seedPlan('chris-dev-test',id));
  const r=await f.ask(malformed,seed.reply.conversationId,(_input,n)=>n===1?discover('get_job_summary'):n===2?step(call('old','get_job_summary',{job_id:id})):final([],'Which exact Job do you mean?',['Which exact Job do you mean?']));assert(!r.executed.length);assert.match(r.reply.message,/Which exact Job/);assert(!r.reply.fallback);
 }
});
await test('Strict read publication preserves exact facts across claim arrays and reports only finite rejection reasons',async()=>{
 const first='Recorded Production status: On Deck.',second='Recorded material status: Ordered.';
 const make=(changes:Partial<AgentFinal>={}):AgentResult=>({status:'completed',final:{answer:first,observations:[{text:first,evidence_ids:['e1']}],inferences:[],recommendations:[],questions:[],completed_actions:[],...changes},evidence:[{id:'e1',tool:'get_job_summary',data:{answer_facts:[{id:'status',text:first},{id:'material',text:second}]}}],proposals:[],trace:[],usage:emptyUsage()});
 const reasons:string[]=[],publish=(result:AgentResult)=>publishModelReadAnswer(result,'Current operational facts',undefined,new Set(),reason=>reasons.push(reason));
 assert.equal(publish(make({observations:[{text:first,evidence_ids:['e1']},{text:second,evidence_ids:['e1']}]})),first+' '+second);assert.equal(reasons.length,0);
 for(const array of ['observations','inferences','recommendations'] as const){
  assert.equal(publish(make({observations:[],[array]:[{text:first,evidence_ids:['e1']}]})),first);
  for(const text of ['This Job appears ready.',first+' '+second]){assert.equal(publish(make({observations:[],[array]:[{text,evidence_ids:['e1']}]})),null);assert.equal(reasons.at(-1),'read-final-non-fact-claim');}
 }
 assert.equal(publish(make({observations:[{text:first,evidence_ids:['unknown']}]})),null);assert.equal(reasons.at(-1),'read-final-missing-evidence');
 assert.equal(publish(make({questions:['The Job has been approved, okay?']})),null);assert.equal(reasons.at(-1),'read-final-question');
 assert.equal(publish(make({observations:[]})),null);assert.equal(reasons.at(-1),'read-final-empty-answer');
 assert.equal(publishModelReadAnswer(make({observations:[{text:'SECRET unsupported claim',evidence_ids:['e1']}]}),'Question',undefined,new Set(),()=>{throw Error('Unavailable diagnostic observer');}),null);
 const before=reasons.length;assert.equal(publish({...make(),status:'limit',final:null}),null);assert.equal(reasons.length,before);
 for(const reasonCode of ['read-final-question','read-final-missing-evidence','read-final-non-fact-claim','read-final-workflow-wording','read-final-workflow-permission','read-final-empty-answer','read-final-too-long'])assert.equal(safeInvestigationDiagnostic({stage:'stop',tool:null,outcome:'stopped',durationMs:0,reasonCode}).reasonCode,reasonCode);
 assert(!JSON.stringify(reasons).includes('SECRET'));assert(reasons.every(reason=>reason.startsWith('read-final-')));
});
const result={passed:true,groups:checks.length,checks,comparisons,examples,actualHostedSessionToolCode:true,syntheticAuthAndDatabase:true,scriptedProviderChoices:true,actualModelDirectedInference:false,actualInferenceCalls:0,actualInferenceUsd:0,actualNetworkRequests:0,operationalWrites:0,scope:'Independent QA failed/partial conversations only, plus directly adjacent resource/freshness/limits contracts'};
const evidencePath=process.env.TENBOT_READ_ORCHESTRATION_EVIDENCE??process.argv[2];if(evidencePath)fs.writeFileSync(evidencePath,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
