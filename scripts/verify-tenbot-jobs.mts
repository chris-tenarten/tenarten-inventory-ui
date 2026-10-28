// Real local PostgreSQL roles/RLS + deterministic five-tool contract checks.
// Uses the established review container; never resets history/feedback/usage.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createTenbotJobTools,type JobFindData,type JobSummaryData,type JobPlanningData,type JobLaborData,type JobOverviewData,type JobToolCaller,type TenbotJobToolName} from '../supabase/functions/_shared/tenbot-job-tools';
import {createTenbotJobCaller,prepareTenbotJobFixture,protectedTenbotState,jobFixture as f,TENBOT_JOB_DATABASE as container} from './support/tenbot-job-database.mjs';
import {sql,literal,admin} from './support/intake-materials-database.mjs';
import {handleTenbot} from '../supabase/functions/_shared/tenbot-handler';
import {MODEL,TenbotError,type InferenceInput,type InferenceProvider} from '../supabase/functions/_shared/tenbot-core';

const output=process.env.TENBOT_JOB_OUTPUT||'/private/tmp/tenops-tenbot-jobs-20261028';
mkdirSync(output,{recursive:true});
const prepared=prepareTenbotJobFixture(),preserved=protectedTenbotState();
const trace:Array<Record<string,unknown>>=[],checks:string[]=[];
const caller=createTenbotJobCaller(container,f.actor,{trace});
const tools=createTenbotJobTools(caller,{now:()=>new Date(f.now)});
const names:TenbotJobToolName[]=['find_jobs','get_job_summary','get_job_planning','get_job_labor_summary','get_production_overview'];
const pass=(message:string)=>{checks.push(message);};
const call=(name:TenbotJobToolName,args:Record<string,unknown>={})=>tools.execute(name,args);
const json=(value:unknown)=>JSON.stringify(value);

const found=await call('find_jobs',{query:'TB-2801'});
assert.equal(found.status,'ok');assert.equal((found.data as JobFindData).match,'exact');
assert.deepEqual((found.data as JobFindData).jobs.map(j=>j.job_id),[f.main]);
const uuidFound=await call('find_jobs',{query:f.main});assert.equal((uuidFound.data as JobFindData).jobs[0].job_id,f.main);
const ambiguous=await call('find_jobs',{query:'TenBot Review Shared Name'});
assert.deepEqual(new Set((ambiguous.data as JobFindData).jobs.map(j=>j.job_id)),new Set([f.ambiguousA,f.ambiguousB]));
pass('Canonical UUID/Job-number lookup and ambiguous exact names preserve all candidates');

const firstPage=await call('find_jobs',{query:'TenBot Review',limit:2});
const page=firstPage.data as JobFindData;assert.equal(page.jobs.length,2);assert.equal(page.has_more,true);assert.equal(page.next_cursor,'2');
const secondPage=await call('find_jobs',{query:'TenBot Review',limit:2,cursor:page.next_cursor});
assert(!(secondPage.data as JobFindData).jobs.some(j=>page.jobs.some(p=>p.job_id===j.job_id)));
assert.equal(((await call('find_jobs',{query:'TB-2806'})).data as JobFindData).jobs.length,0);
assert.equal((await call('find_jobs',{query:'TB-2806',include_archived:true})).status,'ok');
assert.equal(((await call('find_jobs',{query:'TB-2806',include_archived:true})).data as JobFindData).jobs[0].job_id,f.archived);
pass('Bounded result pagination has stable disjoint pages; archives require explicit inclusion');

const browse=await call('find_jobs');assert(!(browse.data as JobFindData).jobs.some(j=>j.job_id===f.devTest));
for(const query of [f.devTest,'DEV-TEST','TenBot dev-test fixture']){
 const value=await call('find_jobs',{query});assert.equal((value.data as JobFindData).jobs.length,0);
 const privileged=await createTenbotJobTools(createTenbotJobCaller(container,admin),{now:()=>new Date(f.now)}).execute('find_jobs',{query});
 assert.equal((privileged.data as JobFindData).jobs[0].job_id,f.devTest);
}
assert.equal((await call('get_job_summary',{job_id:f.devTest})).status,'not_found_or_not_authorized');
const adminOverview=await createTenbotJobTools(createTenbotJobCaller(container,admin),{now:()=>new Date(f.now)}).execute('get_production_overview');
assert(!(adminOverview.data as JobOverviewData).upcoming.some(j=>j.job_id===f.devTest));
pass('Exact controlled fixture UUID is excluded from defaults/overview and requires manageUsers for explicit lookup');

const summary=await call('get_job_summary',{job_id:f.main});const s=summary.data as JobSummaryData;
assert.equal(summary.status,'ok');assert.equal(s.counts.open_follow_ups,1);assert.equal(s.counts.rework_cycles,0);assert.equal(s.job.material_status,'ordered');
const rework=await call('get_job_summary',{job_id:f.terminal});const rw=rework.data as JobSummaryData;
assert.equal(rw.job.original.status,'complete');assert.equal(rw.job.effective.status,'in_production');assert.equal(rw.job.effective.lifecycle,'rework');
assert.equal(rw.job.effective.planned_end,'2026-11-02');assert.equal(rw.counts.rework_cycles,2);assert.equal(rw.counts.active_rework_cycles,1);
assert(summary.unknowns.some(t=>t.includes('do not establish physical readiness')));
pass('Summary counts only recorded unresolved follow-ups and preserves original versus active Rework lifecycle');

const unknown=await call('get_job_summary',{job_id:f.unknown});const u=unknown.data as JobSummaryData;
assert.equal(u.job.job_number,null);assert.equal(u.job.customer,null);assert.equal(u.job.original.planned_start,null);assert.equal(u.job.material_status,'unknown');assert(u.job.readiness.missing_fields.length>0);
const planningTraceStart=trace.length;const planning=await call('get_job_planning',{job_id:f.main});
assert.equal((planning.data as JobPlanningData).phases.availability,'disabled');assert.equal((planning.data as JobPlanningData).schedule_is_persisted,true);
assert(!trace.slice(planningTraceStart).some(t=>String(t.table).includes('planning')));
pass('Missing Job facts remain null; released-disabled Planning never queries phase/item records or invents progress');

const labor=await call('get_job_labor_summary',{job_id:f.main});const l=labor.data as JobLaborData;
assert.equal(labor.status,'ok');assert.equal(l.total_hours,8.3);assert.equal(l.entry_count,3);assert.equal(l.original_or_unclassified_hours,8.3);
assert.deepEqual(l.period,{start_date:'2026-09-29',end_date:'2026-10-28'});assert.equal(l.daily.length,30);
assert.equal(l.daily.find(d=>d.date==='2026-10-15')?.hours,0.3);assert.equal(l.latest_work_date,'2026-10-28');
assert.equal(labor.units.total_hours,'hours');assert(labor.unknowns.some(t=>t.includes('not proof of all labor')));
const singleDay=await call('get_job_labor_summary',{job_id:f.main,start_date:'2026-10-28',end_date:'2026-10-28'});
assert.equal((singleDay.data as JobLaborData).total_hours,4);assert.equal((singleDay.data as JobLaborData).entry_count,1);
const reworkLabor=await call('get_job_labor_summary',{job_id:f.terminal});const rl=reworkLabor.data as JobLaborData;
assert.equal(rl.total_hours,5);assert.equal(rl.original_or_unclassified_hours,2);
assert.deepEqual(rl.reworks.map(r=>[r.rework_cycle_id,r.sequence_number,r.hours,r.entry_count]),[[f.completedRework,1,2,1],[f.activeRework,2,1,1]]);
const zeroLabor=await call('get_job_labor_summary',{job_id:f.unknown});assert.equal((zeroLabor.data as JobLaborData).total_hours,0);assert.equal((zeroLabor.data as JobLaborData).entry_count,0);
const midnight=await createTenbotJobTools(caller,{now:()=>new Date('2026-10-29T02:00:00Z')}).execute('get_job_labor_summary',{job_id:f.main});assert.equal((midnight.data as JobLaborData).period.end_date,'2026-10-28');
pass('Labor uses integer hundredths, inclusive Chicago dates, canonical UUID and explicit Rework attribution; unlinked/other/out-of-period rows are excluded');

const overview=await call('get_production_overview',{limit:1});const o=overview.data as JobOverviewData;
assert.equal(overview.status,'ok');assert(o.counts.jobs!==null&&o.counts.jobs>=5);assert.equal(o.upcoming.length,1);assert.equal(o.upcoming[0].job_id,f.terminal);
assert.equal(o.upcoming[0].lifecycle,'rework');assert.equal(o.upcoming[0].planned_end,'2026-11-02');assert.equal(o.has_more_upcoming,true);assert.equal(overview.truncated,true);
assert.equal(Object.values(o.counts.by_status).reduce<number>((total,n)=>total+(n??0),0),o.counts.jobs);
assert.equal((o.counts.scheduled??0)+(o.counts.unscheduled??0),o.counts.jobs);
pass('Overview reuses effective lifecycle, exact status/schedule counts and a bounded upcoming list');

assert.equal((await caller.from('jobs').select('id').eq('id',f.hidden).maybeSingle()).data,null);
for(const name of ['get_job_summary','get_job_planning','get_job_labor_summary'] as const)assert.equal((await call(name,{job_id:f.hidden})).status,'not_found_or_not_authorized');
assert.equal(((await call('find_jobs',{query:f.hidden})).data as JobFindData).jobs.length,0);
assert(!(browse.data as JobFindData).jobs.some(j=>j.job_id===f.hidden));
pass('Real authenticated PostgreSQL RLS hides the scoped Job across lookup/summary/planning/labor');

const deniedTrace:Array<Record<string,unknown>>=[];
const denied=createTenbotJobTools(createTenbotJobCaller(container,f.inactive,{trace:deniedTrace}),{now:()=>new Date(f.now)});
for(const name of names){assert.equal((await denied.execute(name,name.startsWith('get_job_')?{job_id:f.main}:{})).status,'not_found_or_not_authorized');}
assert(!deniedTrace.some(t=>t.kind==='query'));
const readOnly=await createTenbotJobTools(createTenbotJobCaller(container,f.readOnly),{now:()=>new Date(f.now)}).execute('get_job_summary',{job_id:f.main});assert.equal(readOnly.status,'ok');
try{
 sql(container,`update app_users set is_active=false where user_id=${literal(f.actor)}`);
 const start=trace.length;assert.equal((await call('get_job_summary',{job_id:f.main})).status,'not_found_or_not_authorized');assert(!trace.slice(start).some(t=>t.kind==='query'));
}finally{sql(container,`update app_users set is_active=true where user_id=${literal(f.actor)}`);}
assert.equal((await call('get_job_summary',{job_id:f.main})).status,'ok');
pass('Inactive/revoked memberships fail before record reads on every request; permitted read-only Guest can read');

const outage=createTenbotJobTools(createTenbotJobCaller(container,f.actor,{failTable:'job_updates'}),{now:()=>new Date(f.now)});
const partial=await outage.execute('get_job_summary',{job_id:f.main});assert.equal(partial.status,'partial');assert.equal((partial.data as JobSummaryData).counts.open_follow_ups,null);assert.equal((partial.data as JobSummaryData).job.job_id,f.main);
const unavailable=await createTenbotJobTools(createTenbotJobCaller(container,f.actor,{failTable:'manpower_entries'}),{now:()=>new Date(f.now)}).execute('get_job_labor_summary',{job_id:f.main});assert.equal(unavailable.status,'partial');assert.equal((unavailable.data as JobLaborData).total_hours,null);assert.equal((unavailable.data as JobLaborData).job.job_id,f.main);
// Deliberately incomplete transport over an actual authenticated query. This
// verifies that the contract refuses exact totals instead of accepting a slice.
function incomplete(table:string):JobToolCaller{
 return {rpc:caller.rpc,from(name){const q=caller.from(name);if(name!==table)return q;
  const originalThen=q.then.bind(q);q.then=(resolve,reject)=>originalThen(result=>({...result,count:table==='jobs'?1001:2001})).then(resolve,reject);return q;}};
}
const incompleteLabor=await createTenbotJobTools(incomplete('manpower_entries'),{now:()=>new Date(f.now)}).execute('get_job_labor_summary',{job_id:f.main});
assert.equal(incompleteLabor.status,'partial');assert.equal(incompleteLabor.truncated,true);assert.equal((incompleteLabor.data as JobLaborData).total_hours,null);assert.equal((incompleteLabor.data as JobLaborData).entry_count,null);
const incompleteOverview=await createTenbotJobTools(incomplete('jobs'),{now:()=>new Date(f.now)}).execute('get_production_overview');assert.equal(incompleteOverview.status,'partial');assert.equal((incompleteOverview.data as JobOverviewData).counts.jobs,null);
pass('Partial tools retain safe verified Job facts, unavailable labor invents no totals, and incomplete transport invalidates exact aggregates');

let finalChecks=0;
const revokedAtFinish:JobToolCaller={from:caller.from,async rpc(name,args){
 if(name==='has_app_capability'&&args?.p_capability==='readOperationalData'&&++finalChecks===2)sql(container,`update app_users set is_active=false where user_id=${literal(f.actor)}`);
 return caller.rpc(name,args);
}};
try{
 const value=await createTenbotJobTools(revokedAtFinish,{now:()=>new Date(f.now)}).execute('get_job_summary',{job_id:f.main});
 assert.equal(value.status,'not_found_or_not_authorized');assert.equal(value.data,null);assert.deepEqual(value.sources,[]);
}finally{sql(container,`update app_users set is_active=true where user_id=${literal(f.actor)}`);}
const revokedRowAtFinish:JobToolCaller={rpc:caller.rpc,from(table){
 const q=caller.from(table),select=q.select.bind(q);
 q.select=(columns,options)=>{if(table==='jobs'&&columns==='id')sql(container,`alter policy tenbot_job_fixture_hidden on jobs using(auth.uid()<>${literal(f.actor)}::uuid or id not in (${literal(f.hidden)}::uuid,${literal(f.main)}::uuid))`);return select(columns,options);};
 return q;
}};
try{
 const value=await createTenbotJobTools(revokedRowAtFinish,{now:()=>new Date(f.now)}).execute('get_job_summary',{job_id:f.main});
 assert.equal(value.status,'not_found_or_not_authorized');assert.equal(value.data,null);assert.deepEqual(value.sources,[]);
}finally{sql(container,`alter policy tenbot_job_fixture_hidden on jobs using(auth.uid()<>${literal(f.actor)}::uuid or id<>${literal(f.hidden)}::uuid)`);}
const malformedLabor:JobToolCaller={rpc:caller.rpc,from(table){
 const q=caller.from(table);if(table!=='manpower_entries')return q;const original=q.then.bind(q);
 q.then=(resolve,reject)=>original(result=>({...result,data:Array.isArray(result.data)?result.data.map((row,index)=>index?row:{...row,am_hours:null}):result.data})).then(resolve,reject);return q;
}};
const malformed=await createTenbotJobTools(malformedLabor,{now:()=>new Date(f.now)}).execute('get_job_labor_summary',{job_id:f.main});assert.equal(malformed.status,'partial');assert.equal((malformed.data as JobLaborData).total_hours,null);
let signal:AbortSignal|null=null;
const hanging:JobToolCaller={rpc:async()=>({data:true,error:null}),from(table){const q=caller.from(table);q.abortSignal=provided=>{signal=provided;return q;};q.then=()=>new Promise<never>(()=>{});return q;}};
const started=Date.now(),timedOut=await createTenbotJobTools(hanging,{now:()=>new Date(f.now),deadlineMs:20}).execute('get_job_summary',{job_id:f.main});
assert.equal(timedOut.status,'unavailable');assert.equal(timedOut.data,null);assert(Date.now()-started<1000);assert(signal!==null&&(signal as AbortSignal).aborted);
pass('Final capability and scoped-row revocation discard previously fetched facts; malformed null labor suppresses totals and a hanging transport obeys the shared abort deadline');

for(const [name,args] of [
 ['get_job_summary',{job_id:'not-a-uuid'}],['get_job_summary',{job_id:f.main,sql:'select * from jobs'}],
 ['find_jobs',{query:'x'.repeat(121)}],['find_jobs',{limit:21}],['find_jobs',{cursor:'1000'}],
 ['get_job_labor_summary',{job_id:f.main,start_date:'2026-02-30',end_date:'2026-10-28'}],
 ['get_job_labor_summary',{job_id:f.main,start_date:'2026-10-28'}],
 ['get_job_labor_summary',{job_id:f.main,start_date:'2025-10-01',end_date:'2026-10-28'}],
 ['get_production_overview',{start_date:'2026-11-01',end_date:'2026-10-28'}],
] as Array<[TenbotJobToolName,Record<string,unknown>]>)assert.equal((await call(name,args)).status,'invalid_request');
for(const query of ["';select pg_sleep(10);--",'TB-280_',`TB-2801\",id.neq.${f.main}`])assert.equal(((await call('find_jobs',{query})).data as JobFindData).jobs.length,0);
assert.throws(()=>caller.from('my_work_inbox_messages'),/allowlist/);assert.throws(()=>caller.from('jobs').select('contract_value'),/allowlist/);assert.throws(()=>caller.from('job_updates').select('body'),/allowlist/);
pass('Strict arguments/search escaping and the fixture bridge reject arbitrary SQL, extra projections, private tables and finance/body fields');

for(const value of [found,ambiguous,summary,rework,unknown,planning,labor,reworkLabor,overview,partial]){
 const serialized=json(value);for(const forbidden of [f.financialSentinel,f.notesSentinel,'SYNTHETIC-WORKER-NEVER-RETRIEVE','SYNTHETIC-AUTHOR-NEVER-RETRIEVE','987654.32'])assert(!serialized.includes(forbidden));
 assert.equal(value.version,'tenbot-job-read.v1');assert.equal(value.timezone,'America/Chicago');assert.equal(value.observed_at,f.now);assert(value.sources.every(s=>s.observed_at===f.now));
 assert.equal(value.consistency,'best_effort_multi_query');assert.equal(value.read_started_at,f.now);assert.equal(value.read_completed_at,f.now);
}
for(const query of trace.filter(t=>t.kind==='query')){
 assert.equal(query.role,'authenticated');assert(Number(query.limit)<=200||query.head===true||Number(query.limit)===2);
 assert(!(query.columns as string[]).some(column=>/contract|remarks|body|notes|worker|entered_by|scope_details|resolution_message/.test(column)));
}
assert.equal(protectedTenbotState(),preserved);
pass('All output carries units/time/source metadata and excludes stored finance/notes/employee sentinels; existing TenBot records are unchanged');

// Handler integration uses the real established owner-history/metering RPCs.
// Only fixed procedure/argument names below are accepted; service callbacks
// cannot query operational tables or invent SQL supplied by a model.
const historyCalls:Array<{name:string;role:string}>=[],providerInputs:InferenceInput[]=[];
// A fresh task-owned local actor preserves previous usage receipts without
// allowing repeated fake-provider runs to collide with the account burst cap.
const integrationActor=randomUUID();
sql(container,`insert into app_users(user_id,display_name,role,is_active) values(${literal(integrationActor)},'Synthetic Job-handler verifier','member',true)`);
const rpcKeys:Record<string,string[]>={has_app_capability:['p_capability'],has_proposal_access:[],tenbot_load_conversation:['p_conversation_id'],tenbot_clear_conversation:['p_conversation_id'],tenbot_append_conversation_turn:['p_user','p_conversation_id','p_expected_version','p_question','p_answer'],tenbot_reserve_usage:['p_user','p_model','p_reserved_neurons'],tenbot_finish_usage:['p_id','p_outcome','p_model','p_input_tokens','p_output_tokens','p_estimated_neurons']};
const serviceNames=new Set(['tenbot_append_conversation_turn','tenbot_reserve_usage','tenbot_finish_usage']);
const rpc=(actor:string=integrationActor,service=false)=>async(name:string,args:Record<string,unknown>={})=>{
 const role=service?'service_role':'authenticated';historyCalls.push({name,role});
 if(!rpcKeys[name]||serviceNames.has(name)!==service||Object.keys(args).some(k=>!rpcKeys[name].includes(k)))throw Error('RPC is outside the local handler allowlist');
 const encode=(v:unknown)=>v===null?'null':typeof v==='boolean'||typeof v==='number'?String(v):typeof v==='object'?literal(JSON.stringify(v))+'::jsonb':literal(v);
 try{const raw=sql(container,`begin;set local role ${role};set local request.jwt.claim.sub=${literal(actor)};select to_jsonb(public.${name}(${Object.entries(args).map(([k,v])=>k+'=>'+encode(v)).join(',')}));commit;`);return {data:raw?JSON.parse(raw):null,error:null};}catch{return {data:null,error:{message:'Synthetic local handler operation unavailable'}};}
};
let providerMode:'valid'|'invalid'|'outage'|'revoke'='valid';
const denyMain=(deny:boolean)=>sql(container,`alter policy tenbot_job_fixture_hidden on jobs using(auth.uid() not in (${literal(f.actor)}::uuid${deny?','+literal(integrationActor)+'::uuid':''}) or id not in (${literal(f.hidden)}::uuid${deny?','+literal(f.main)+'::uuid':''}))`);
const provider:InferenceProvider={name:'Synthetic local claims provider',reserveEstimate:()=>({model:MODEL,neurons:1}),usage:()=>null,async infer(input){
 providerInputs.push(input);assert(input.operational);assert.deepEqual(input.context,[]);assert.deepEqual(input.excerpts,[]);
 for(const sentinel of [f.financialSentinel,f.notesSentinel,'SYNTHETIC-WORKER-NEVER-RETRIEVE'])assert(!JSON.stringify(input).includes(sentinel));
 if(providerMode==='outage')throw Error('Synthetic inference outage');
 if(providerMode==='revoke')denyMain(true);
 const fact=input.operational.facts.find(row=>row.id==='labor_total')??input.operational.facts.find(row=>row.id==='job_status')??input.operational.facts[0];assert(fact);
 return {claims:[{fact_id:fact.id,text:providerMode==='invalid'?'Recorded labor: 999 hours for 2026-09-29 through 2026-10-28.':fact.text}]};
}};
const invoke=async(body:Record<string,unknown>,ai:InferenceProvider|null=null,actor:string=integrationActor)=>await handleTenbot(body,actor,rpc(actor),rpc(actor,true),ai,undefined,createTenbotJobTools(createTenbotJobCaller(container,actor),{now:()=>new Date(f.now)})) as unknown as Record<string,unknown>;
const live=await invoke({action:'ask',question:'What is the current status of job TB-2801?'},provider);assert.equal(live.mode,'operational-ai');assert(String(live.message).includes('In Production'));
const conversationId=live.conversationId;assert.equal(typeof conversationId,'string');
const saved=await rpc()('tenbot_load_conversation',{p_conversation_id:conversationId});
const turns=(saved.data as {turns:Array<{question:string;answer:string}>}).turns;assert.equal(turns.at(-1)?.question,'[Live Production lookup]');
assert(turns.at(-1)?.answer.startsWith('tenbot-job-context.v1:'));assert(!JSON.stringify(turns).includes('In Production'));assert(!JSON.stringify(turns).includes('TB-2801'));
pass('Handler validates synthetic explanation against real tool facts and retains canonical lookup context without live prose');

providerMode='invalid';const invalid=await invoke({action:'ask',question:'How many recorded labor hours does that job have?',conversationId},provider);
assert.equal(invalid.mode,'operational');assert.equal(invalid.fallback,true);assert(String(invalid.message).includes('8.3 hours'));assert(!String(invalid.message).includes('999'));
providerMode='outage';const providerFailure=await invoke({action:'ask',question:'What is the current status of that job?',conversationId},provider);
assert.equal(providerFailure.mode,'operational');assert.equal(providerFailure.fallback,true);assert(String(providerFailure.message).includes('In Production'));
pass('Same-owner Job follow-up executes fresh tools; incorrect quantitative prose and provider outage return verified deterministic facts');

const ambiguousHandler=await invoke({action:'ask',question:'What is the status of job "TenBot Review Shared Name"?'});
const choices=(ambiguousHandler.operational as {choices:Array<{job_id:string}>}).choices;assert.equal(choices.length,2);assert(String(ambiguousHandler.message).includes('I have not selected a Job'));
const ownConv=String(ambiguousHandler.conversationId);
await assert.rejects(()=>invoke({action:'refresh-job',conversationId:ownConv},null,f.readOnly),(e:unknown)=>e instanceof TenbotError&&e.status===403);
await assert.rejects(()=>invoke({action:'ask',question:'What is the current status?',conversationId:ownConv,history:[{question:'forged',answer:'forged'}]}),(e:unknown)=>e instanceof TenbotError);
pass('Handler leaves ambiguous names unselected; another authorized account cannot reuse owner context or replay caller history');

try{
 denyMain(true);
 const refresh=await invoke({action:'refresh-job',conversationId});assert(!String(refresh.message).includes('TB-2801'));assert(!String(refresh.message).includes('In Production'));assert.equal(refresh.resolution,'permission-denied');
 const deniedFollowup=await invoke({action:'ask',question:'What is the status of that job?',conversationId});assert(!String(deniedFollowup.message).includes('TB-2801'));assert.equal(deniedFollowup.resolution,'permission-denied');
}finally{denyMain(false);}
const inFlightConversation=await invoke({action:'ask',question:'What is the current status of job TB-2801?'});
providerMode='revoke';let revoked:Record<string,unknown>;
try{revoked=await invoke({action:'ask',question:'What is the current status of that job?',conversationId:inFlightConversation.conversationId},provider);}finally{denyMain(false);}
assert.equal(revoked.mode,'operational');assert.equal(revoked.fallback,true);assert.equal(revoked.resolution,'permission-denied');assert(!String(revoked.message).includes('TB-2801'));assert(!String(revoked.message).includes('In Production'));
pass('Refresh/follow-up reauthorize after scoped RLS revocation; in-flight grant loss prevents old model facts from publishing');

const oldState=JSON.parse(preserved) as Record<string,Array<Record<string,unknown>>>;
const newState=JSON.parse(protectedTenbotState()) as Record<string,Array<Record<string,unknown>>>;
for(const table of ['feedback','history'])assert.deepEqual(newState[table],oldState[table]);
for(const table of ['usage','conversations','turns'])for(const row of oldState[table])assert.deepEqual(newState[table].find(current=>current.id===row.id),row);
for(const input of providerInputs){assert(input.operational);assert(!JSON.stringify(input).includes('tenbot-job-context.v1:'));}
assert(historyCalls.filter(row=>row.role==='service_role').every(row=>serviceNames.has(row.name)));
pass('Service authority is limited to owner context/metering; prior feedback/history/usage/conversation rows stay intact, with no private history in operational model input');

const files=['supabase/functions/_shared/tenbot-job-tools.ts','supabase/functions/_shared/production-job-facts.mjs','supabase/functions/_shared/labor-hours.mjs','supabase/functions/_shared/tenbot-handler.ts','supabase/functions/_shared/tenbot-job-session.ts','scripts/support/tenbot-job-database.mjs','scripts/verify-tenbot-jobs.mts'];
const report={passed:true,checks,checkCount:checks.length,realPostgreSQL:true,container,roles:['authenticated'],externalModelCalls:0,hostedCalls:0,prepared,queryCount:trace.filter(t=>t.kind==='query').length,protectedTenbotRecordsPreserved:true,
 scope:'Five read-only Job tools with real local PostgreSQL capability and row authorization; deliberately incomplete transport cases are identified separately.',
 limitations:['SET ROLE/JWT-sub fixture is not hosted HTTP Auth transport','No live Production records or hosted query plans inspected','No actual external inference calls','Planning phases/items remain released-disabled'],
 handlerProviderCalls:providerInputs.length,handlerRpcCalls:historyCalls.length,newTaskUsageRows:newState.usage.length-oldState.usage.length,newTaskConversations:newState.conversations.length-oldState.conversations.length,
 sources:files.map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}))};
writeFileSync(output+'/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:true,checks:checks.length,queryCount:report.queryCount,evidence:output+'/report.json',externalModelCalls:0,hostedCalls:0},null,2));
