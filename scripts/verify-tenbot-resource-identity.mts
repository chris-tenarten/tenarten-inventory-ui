/** Demonstrated identity regressions. Real bounded Job executor, synthetic
 * caller/data only. No database, provider, hosted calls or business writes. */
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {explicitJobReferences,resolveJobIntent} from '../supabase/functions/_shared/tenbot-job-routing';
import {prepareJobRequest} from '../supabase/functions/_shared/tenbot-job-session';
import type {ConversationContext} from '../supabase/functions/_shared/tenbot-conversation-context';
import {createContextFixture} from './support/tenbot-context-fixture.mjs';
const checks:string[]=[],examples:unknown[]=[],now=Date.parse('2026-11-01T20:00:00Z');
const old='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
const seed=(references:string[],subject='Job',pending=false,operation='get_job_planning'):ConversationContext=>({version:1,subject,operation,resultType:pending?'clarification':'record',references,selection:{query:'old query',includeArchived:false,statuses:[],startDate:'2026-10-26',endDate:'2026-11-01'},sources:[],awaitingClarification:pending,updatedAt:new Date(now).toISOString(),expiresAt:new Date(now+1800000).toISOString()});
const context=(s:ConversationContext)=>({jobId:s.references.length===1?s.references[0]:'',continuity:s});
const test=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks.push(name);};
const a1="Quick handoff on Job DEV-20260803: where's it at, and do the planned dates cover its delivery date?",a2='DEV-20260803 — the internal chris-dev-test Job.',a3='For Job "chris-dev-test", is the planned finish before its requested delivery?';
await test('A1 and A3 explicit number/name override no, zero, one different and multiple prior identities',()=>{
 for(const question of [a1,a3])for(const s of [null,seed([],'Production'),seed([old]),seed([old,other]),seed([],'Job',true)]){
  const intent=resolveJobIntent(question,s?context(s):null,new Date(now));assert(intent?.kind==='job');assert.equal(intent.tool,'get_job_planning');assert.deepEqual(intent.reference,{query:question===a1?'DEV-20260803':'chris-dev-test'});examples.push({question,prior:s?.references??null,intent});
 }
});
await test('A2 explanatory clarification normalizes explicit number and retains requested operation and period',()=>{
 const intent=resolveJobIntent(a2,context(seed([],'Job',true,'get_job_labor_summary')),new Date(now));assert(intent?.kind==='job');assert.deepEqual(intent.reference,{query:'DEV-20260803'});assert.equal(intent.tool,'get_job_labor_summary');assert.deepEqual(intent.args,{start_date:'2026-10-26',end_date:'2026-11-01'});
 const newRequest=resolveJobIntent('Job DEV-20260803 status',context(seed([],'Job',true)),new Date(now));assert(newRequest?.kind==='job');assert.equal(newRequest.tool,'get_job_summary');assert.deepEqual(newRequest.reference,{query:'DEV-20260803'});
});
await test('Unquoted names, quoted generic names and explicit UUIDs never borrow a previous Job',()=>{
 for(const [question,query] of [['What is the status of Job Context Alpha and its material status?','Context Alpha'],['What is the status of Job "status" and its materials?','status'],['What about "Context Alpha" and its dates?','Context Alpha'],['Show dates for Job "Job Beta" and its status','Job Beta']]){
  const intent=resolveJobIntent(question,context(seed([old])),new Date(now));assert(intent?.kind==='job',question);assert.deepEqual(intent.reference,{query},question);
 }
 const intent=resolveJobIntent(`Show the planned dates for Job ${other} and its status`,context(seed([old])),new Date(now));assert(intent?.kind==='job');assert.deepEqual(intent.reference,{jobId:other});
});
await test('Other/another/ordinal identities clarify; ordinary exact contextual follow-ups still work',()=>{
 for(const question of ['What about the other one?','Show another Job','What are the dates of the second Job?','Show Job "" and its dates','Show Job "Unfinished and its dates','Show Job "Alpha" and Job "" and its dates'])assert.equal(resolveJobIntent(question,context(seed([old])),new Date(now))?.kind,'clarify');
 const follow=resolveJobIntent('When is it scheduled?',context(seed([old])),new Date(now));assert(follow?.kind==='job');assert.deepEqual(follow.reference,{jobId:old});
 assert.equal(resolveJobIntent('What are its dates?',context(seed([old,other])),new Date(now))?.kind,'clarify');
 assert.equal(resolveJobIntent('Show dates for Job "Alpha" and Job "Beta"',context(seed([old])),new Date(now))?.kind,'clarify');
});
await test('Resource extraction is bounded and does not mistake report dates or workflow condition words for identities',()=>{
 assert.deepEqual(explicitJobReferences(a1),['DEV-20260803']);assert.deepEqual(explicitJobReferences(a2),['DEV-20260803']);assert.deepEqual(explicitJobReferences(a3),['chris-dev-test']);
 assert.deepEqual(explicitJobReferences('Show dates for Job "Alpha" and Job "Beta"'),['Alpha','Beta']);
 assert.deepEqual(explicitJobReferences('Show dates for Job Alpha and Job Beta'),['Alpha','Beta']);
 assert.deepEqual(explicitJobReferences('2026-10-26 through 2026-11-01'),[]);
 assert.deepEqual(explicitJobReferences("Suppose a PO is allocated to a test Job but hasn't been received. Does Ordered mean the shop can start?"),[]);
 assert.deepEqual(explicitJobReferences('x'.repeat(1201)),[]);
});
await test('Explicit lookup reads the newly selected canonical Job and effective Rework schedule, never the prior ID',async()=>{
 const f=createContextFixture(),target=f.tables.jobs[1],previous=f.tables.jobs[0];target.job_number='DEV-20260803';target.name='chris-dev-test';
 f.tables.production_rework_cycles.push({id:'10000000-0000-4000-8000-000000000099',job_id:target.id,sequence_number:1,production_status:'in_production',planned_start:'2026-11-02',planned_end:'2026-11-06',updated_at:'2026-11-01T12:00:00Z'});
 const calls:{name:string;args:Record<string,unknown>}[]=[],real=f.state.jobTools!;
 const tools={...real,async execute(name:Parameters<typeof real.execute>[0],args:Record<string,unknown>){calls.push({name,args});return real.execute(name,args);}};
 const intent=resolveJobIntent(a1,context(seed([previous.id])),new Date(now));assert(intent?.kind==='job');const result=await prepareJobRequest(intent,tools,a1);
 assert.equal(result.result?.status,'ok');assert(result.result?.data&&'job' in result.result.data);assert.equal(result.result.data.job.job_id,target.id);assert.equal(result.result.data.job.effective.lifecycle,'rework');assert.equal(result.result.data.job.effective.planned_end,'2026-11-06');assert(calls.some(c=>c.name==='find_jobs'&&c.args.query==='DEV-20260803'));assert(!calls.some(c=>c.args.job_id===previous.id));
 f.hidden.add(target.id);calls.length=0;const denied=await prepareJobRequest(intent,tools,a1);assert(!denied.result?.data||!('job' in denied.result.data));assert(!calls.some(c=>c.args.job_id===previous.id));assert.equal(f.state.providerCalls,0);
});
await test('Duplicate explicit names remain a choice and never silently fall back to the old canonical ID',async()=>{
 const f=createContextFixture();f.tables.jobs[1].name='Duplicate QA';f.tables.jobs[2].name='Duplicate QA';
 const intent=resolveJobIntent('Show the schedule for Job "Duplicate QA" and its status',context(seed([f.tables.jobs[0].id])),new Date(now));assert(intent?.kind==='job');const result=await prepareJobRequest(intent,f.state.jobTools!);assert.equal(result.choices?.length,2);assert.equal(result.result?.tool,'find_jobs');assert(!result.result?.data||!('job' in result.result.data));
});
const report={passed:true,groups:checks.length,checks,examples,actualInference:false,actualDatabase:false,hostedRequests:0,operationalWrites:0};
if(process.env.TENBOT_IDENTITY_EVIDENCE)writeFileSync(process.env.TENBOT_IDENTITY_EVIDENCE,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
