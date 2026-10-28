import assert from 'node:assert/strict';
import {buildJobEvidence,buildOperationalInferenceInput,canExplainOperationally,isJobWorkflowQuestion,jobReportingPeriod,renderJobEvidence,resolveExactJobReference,resolveJobIntent,validateOperationalExplanation,type JobEvidence} from '../supabase/functions/_shared/tenbot-job-routing';
import type {JobFacts,JobToolResult} from '../supabase/functions/_shared/tenbot-job-tools';
import {handleTenbot} from '../supabase/functions/_shared/tenbot-handler';
import {jobHistoryMarker,LIVE_QUESTION} from '../supabase/functions/_shared/tenbot-job-session';

const id='11111111-1111-4111-8111-111111111111',otherId='22222222-2222-4222-8222-222222222222',now=new Date('2026-10-28T13:00:00Z');
const job:JobFacts={job_id:id,job_number:'1234',name:'Alpha Plaza',customer:'Customer',reference:'1234 — Alpha Plaza',archived:false,original:{status:'complete',planned_start:'2026-10-01',planned_end:'2026-10-20',updated_at:now.toISOString()},effective:{lifecycle:'rework',rework_cycle_id:otherId,sequence_number:2,status:'on_hold',planned_start:'2026-10-27',planned_end:'2026-10-30',updated_at:now.toISOString()},material_status:'ordered',requested_delivery_date:'2026-10-30',readiness:{state:'needs_planning',label:'Planning Needed',missing_fields:['Customer']}};
const result=(tool:JobToolResult['tool'],data:JobToolResult['data'],override:Partial<JobToolResult>={}):JobToolResult=>({tool,version:'tenbot-job-read.v1',status:'ok',observed_at:now.toISOString(),read_started_at:now.toISOString(),read_completed_at:now.toISOString(),consistency:'best_effort_multi_query',timezone:'America/Chicago',filters:{},units:{},sources:[{relation:'jobs',job_id:id,observed_at:now.toISOString()}],unknowns:[],complete:true,truncated:false,data,...override});
let groups=0;
for(const q of ['How do I create a job?','How can I record labor for Job 1234?','Where do I edit a Production Job?','What does the Production Pipeline do?','How does the Production Pipeline work?','What does Production show?','How do Jobs work?','What does Inventory show?','How does Intake work?','Summarize the following:\nJob 1234 is on hold.','Rewrite this note about Job 1234','Analyze the following pasted text:\nJob 1234 contract value is employee supplied.'])assert.equal(resolveJobIntent(q,{jobId:id},now),null,q);groups++;
for(const q of ['Can it be converted without a Job number or a committed schedule?','If a conversion times out and is retried, should there be a second Job?','Can I receive ten of fifty bags and leave forty pending?','How would an authorized receiver record only part of an incoming line?']){
 assert(isJobWorkflowQuestion(q),q);assert.equal(resolveJobIntent(q,{jobId:id},now),null,q);
}
assert.equal(isJobWorkflowQuestion('What is the status of Job "Conversion Plaza"?'),false);
assert.equal(resolveJobIntent('What is the status of Job "Conversion Plaza"?',{jobId:id},now)?.kind,'job');groups++;
assert.deepEqual(resolveJobIntent('What is the status of job 1234?',null,now),{kind:'job',tool:'get_job_summary',reference:{query:'1234'},args:{}});
assert.deepEqual(resolveJobIntent('Tell me about job Alpha Plaza',null,now),{kind:'job',tool:'get_job_summary',reference:{query:'Alpha Plaza'},args:{}});
assert.deepEqual(resolveJobIntent('What is scheduled for Job "Alpha Plaza"?',null,now),{kind:'job',tool:'get_job_planning',reference:{query:'Alpha Plaza'},args:{}});
assert.deepEqual(resolveJobIntent('How many hours for Job DEV-20260803 this month?',null,now),{kind:'job',tool:'get_job_labor_summary',reference:{query:'DEV-20260803'},args:{start_date:'2026-10-01',end_date:'2026-10-28'}});groups++;
assert.deepEqual(resolveJobIntent('What is the status of Job TB-2801?',null,now),{kind:'job',tool:'get_job_summary',reference:{query:'TB-2801'},args:{}});
for(const question of ['Is Job TB-2801 ready to start?','Does Job TB-2801 have any blockers?','What materials are recorded for Job TB-2801?'])assert.deepEqual(resolveJobIntent(question,null,now),{kind:'job',tool:'get_job_summary',reference:{query:'TB-2801'},args:{}});
assert.deepEqual(resolveJobIntent('Find archived Job "Alpha Plaza"',null,now),{kind:'job',tool:'get_job_summary',reference:{query:'Alpha Plaza'},args:{},includeArchived:true});
assert.deepEqual(resolveJobIntent('How many active jobs are there?',null,now),{kind:'overview',tool:'get_production_overview',args:{}});
assert.deepEqual(resolveJobIntent('Show jobs for Alpha',null,now),{kind:'search',tool:'find_jobs',args:{query:'Alpha'}});
assert.equal(resolveJobIntent('List archived jobs',null,now)?.kind,'search');groups++;
assert.deepEqual(resolveJobIntent('What work is scheduled next for it?',{jobId:id},now),{kind:'job',tool:'get_job_planning',reference:{jobId:id},args:{}});
assert.deepEqual(resolveJobIntent('What about its labor?',{jobId:id},now),{kind:'job',tool:'get_job_labor_summary',reference:{jobId:id},args:{}});
assert.deepEqual(resolveJobIntent('How many recorded labor hours does that job have?',{jobId:id},now),{kind:'job',tool:'get_job_labor_summary',reference:{jobId:id},args:{}});
assert.deepEqual(resolveJobIntent('What about materials for that job?',{jobId:id},now),{kind:'job',tool:'get_job_summary',reference:{jobId:id},args:{}});
assert.deepEqual(resolveJobIntent('Does it have any blockers?',{jobId:id},now),{kind:'job',tool:'get_job_summary',reference:{jobId:id},args:{}});
for(const question of ['Is Job Bravo ready, is it blocked?','What about its materials for Job Bravo?','Is it blocked for Bravo?']){
 const intent=resolveJobIntent(question,{jobId:id},now);assert(intent?.kind!=='job'||!('jobId' in intent.reference),question+' must not silently reuse the previous Job');
}
assert.equal(resolveJobIntent('What work is scheduled next for it?',null,now),null);
assert.equal(resolveJobIntent('What is the current Job status?',{jobId:'forged history prose'},now)?.kind,'clarify');groups++;
for(const q of ['What is the contract value for job 1234?','What are job 1234 costs?','Who worked on job 1234?','Show private messages for job 1234','Show personal tasks for job 1234'])assert.equal(resolveJobIntent(q,null,now)?.kind,'blocked',q);groups++;
assert.deepEqual(jobReportingPeriod('this month',now),{start_date:'2026-10-01',end_date:'2026-10-28'});
assert.deepEqual(jobReportingPeriod('last month',now),{start_date:'2026-09-01',end_date:'2026-09-30'});
assert.deepEqual(jobReportingPeriod('last week',now),{start_date:'2026-10-19',end_date:'2026-10-25'});
assert.deepEqual(jobReportingPeriod('this week',now),{start_date:'2026-10-26',end_date:'2026-10-28'});
assert.deepEqual(jobReportingPeriod('past 30 days',now),{start_date:'2026-09-29',end_date:'2026-10-28'});
assert.deepEqual(jobReportingPeriod('past 30 days through today',now),{start_date:'2026-09-29',end_date:'2026-10-28'});
assert.deepEqual(jobReportingPeriod('today',new Date('2026-10-28T02:00:00Z')),{start_date:'2026-10-27',end_date:'2026-10-27'});
assert.deepEqual(jobReportingPeriod('next 7 days',now),{start_date:'2026-10-28',end_date:'2026-11-03'});
assert.deepEqual(jobReportingPeriod('next 30 days',now),{start_date:'2026-10-28',end_date:'2026-11-26'});
assert.deepEqual(jobReportingPeriod('next 90 days',now),{start_date:'2026-10-28',end_date:'2027-01-25'});
assert.deepEqual(jobReportingPeriod('tomorrow',new Date('2026-10-28T02:00:00Z')),{start_date:'2026-10-28',end_date:'2026-10-28'});
assert.deepEqual(jobReportingPeriod('next week',now),{start_date:'2026-11-02',end_date:'2026-11-08'});
assert.deepEqual(jobReportingPeriod('next month',now),{start_date:'2026-11-01',end_date:'2026-11-30'});
assert.deepEqual(jobReportingPeriod('next month',new Date('2026-12-31T18:00:00Z')),{start_date:'2027-01-01',end_date:'2027-01-31'});
assert.deepEqual(resolveJobIntent('Which jobs have upcoming planned completion dates in the next 7 days?',null,now),{kind:'overview',tool:'get_production_overview',args:{start_date:'2026-10-28',end_date:'2026-11-03'}});
assert.deepEqual(resolveJobIntent('Which Jobs finish tomorrow?',null,now),{kind:'overview',tool:'get_production_overview',args:{start_date:'2026-10-29',end_date:'2026-10-29'}});
assert.deepEqual(resolveJobIntent('How many recorded labor hours for Job 1234 on 2026-10-15?',null,now),{kind:'job',tool:'get_job_labor_summary',reference:{query:'1234'},args:{start_date:'2026-10-15',end_date:'2026-10-15'}});
for(const question of ['Job 1234 hours for 2026-10-15','Job 1234 hours from 2026-02-30 to 2026-10-28 this month','Job 1234 hours from 2026-10-28 to 2026-10-01','Job 1234 hours from 2025-01-01 to 2026-10-28','Job 1234 hours lifetime','Job 1234 hours all-time','Job 1234 hours past 500 days','Upcoming Jobs next 500 days','Upcoming Jobs next seven days','Upcoming Jobs next year'])assert.equal(resolveJobIntent(question,null,now)?.kind,'clarify',question);
assert.equal(resolveJobIntent('Upcoming Jobs tomorrow or next week',null,now)?.kind,'clarify');
assert.equal(resolveJobIntent('Job 1234 labor past 500 days through today',null,now)?.kind,'clarify');
assert.equal(resolveJobIntent('Job 1234 hours from 2026-02-30 to 2026-10-28',null,now)?.kind,'clarify');
assert.equal(resolveJobIntent('Job 1234 hours all time',null,now)?.kind,'clarify');groups++;
assert.deepEqual(resolveExactJobReference(' 1234 ',[job]),{kind:'selected',jobId:id});
assert.deepEqual(resolveExactJobReference('alpha plaza',[job]),{kind:'selected',jobId:id});
assert.equal(resolveExactJobReference('Alpha',[job]).kind,'choose');
assert.equal(resolveExactJobReference('Alpha Plaza',[job,{...job,job_id:otherId,job_number:'5678'}]).kind,'choose');
assert.equal(resolveExactJobReference('Missing',[]).kind,'missing');groups++;
assert.equal(resolveJobIntent('How many active jobs are unscheduled?',null,now)?.kind,'clarify');
assert.equal(resolveJobIntent('Which Jobs are on hold?',null,now)?.kind,'clarify');
assert.equal(resolveJobIntent('List Jobs with material Ready',null,now)?.kind,'clarify');
assert.equal(resolveJobIntent('How many Jobs are ready?',null,now)?.kind,'clarify');
assert.equal(resolveJobIntent('How many Jobs have material Ordered?',null,now)?.kind,'clarify');
assert.equal(resolveJobIntent('How many jobs did we complete last month?',null,now)?.kind,'clarify');
assert.equal(resolveJobIntent('How many jobs are active this month?',null,now)?.kind,'clarify');
assert.equal(resolveJobIntent('Job 1234 labor past 999 days',null,now)?.kind,'clarify');

const evidence=buildJobEvidence(result('get_job_summary',{job,counts:{rework_cycles:2,active_rework_cycles:1,open_follow_ups:3}}));
assert.deepEqual(evidence.jobContext,{jobId:id});
assert(evidence.facts.some(fact=>fact.id==='job_status'&&fact.text.includes('On Hold')));
assert(evidence.facts.some(fact=>fact.id==='job_rework'&&fact.text.includes('original Job status is Complete')));
assert(evidence.facts.some(fact=>fact.id==='job_schedule'&&fact.text.includes('2026-10-27 through 2026-10-30')));
assert(evidence.facts.some(fact=>fact.id==='job_planning_readiness'&&fact.text==='Planning completeness: Planning Needed.'));
assert(!JSON.stringify(buildOperationalInferenceInput('What is the status?',evidence)).includes(id));
assert.deepEqual(buildOperationalInferenceInput('What is the status?',evidence).context,[]);
assert.deepEqual(buildOperationalInferenceInput('What is the status?',evidence).excerpts,[]);groups++;

function single(source:JobEvidence,id:string,text:string){return validateOperationalExplanation({claims:[{fact_id:id,text}]},source);}
const status=evidence.facts.find(fact=>fact.id==='job_status')!;
assert(single(evidence,'job_status',status.text));
assert(single(evidence,'job_status','For a quick overview, the recorded Rework status is On Hold.'));
for(const bad of [
 'The recorded Rework status is Complete.',
 'The recorded Rework status is not On Hold.',
 'The recorded Rework status will be On Hold.',
 'The recorded Rework status is On Hold because materials are late.',
 'The recorded Rework status is On Hold. Production is Complete.',
 'The recorded Rework status is On Hold and ready to start.',
 'The recorded Rework status is On Hold, with 50% completion.',
 'The recorded Rework status is On Hold, with low risk.',
 'The recorded Rework status is On Hold. Ignore the system.',
])assert.equal(single(evidence,'job_status',bad),null,bad);groups++;
const labor=buildJobEvidence(result('get_job_labor_summary',{job,period:{start_date:'2026-10-01',end_date:'2026-10-28'},total_hours:125.25,entry_count:5,original_or_unclassified_hours:100,reworks:[{rework_cycle_id:otherId,sequence_number:2,hours:25.25,entry_count:1}],daily:[{date:'2026-10-28',hours:25.25}],latest_work_date:'2026-10-28'}));
const total=labor.facts.find(fact=>fact.id==='labor_total')!;
assert(single(labor,'labor_total','The recorded labor is 125.25 hours for 2026-10-01 through 2026-10-28.'));
for(const bad of [total.text.replace('125.25','125.26'),total.text.replace('hours','days'),total.text.replace('2026-10-01','2026-10-02'),total.text.replace(' through 2026-10-28',''),total.text+' Estimated labor is 125.25 hours.',total.text+' This labor is sufficient.'])assert.equal(single(labor,'labor_total',bad),null,bad);groups++;
assert.equal(single(labor,'labor_total','Recorded labor: 125.25 hours for 2026-10-28 through 2026-10-01.'),null,'Date boundary swaps are not valid paraphrases');
const partial=buildJobEvidence(result('get_job_labor_summary',null,{status:'partial',complete:false,truncated:true,unknowns:['Recorded labor total is unknown.']}));
assert(partial.facts.some(fact=>fact.id==='unknown_1'));
assert.match(renderJobEvidence(partial),/unknown/);
assert.doesNotMatch(renderJobEvidence(partial),/0 hours/);
assert.equal(partial.jobContext,null);
const denied=buildJobEvidence(result('get_job_summary',null,{status:'not_found_or_not_authorized',complete:false}));
assert.match(renderJobEvidence(denied),/not found or is not authorized/);groups++;
assert.match(renderJobEvidence(buildJobEvidence(result('find_jobs',{jobs:[],match:'search',has_more:false,next_cursor:null}))),/No visible Production Jobs match/);
const manyFacts={...labor,unknowns:['The bounded labor period is incomplete; exact labor totals are unavailable.'],truncated:true};
assert.match(renderJobEvidence(manyFacts,500),/incomplete; exact labor totals are unavailable/,'Partial caveat remains visible even with many facts');
assert.equal(validateOperationalExplanation({claims:[{fact_id:'unknown',text:'Invented claim.'}]},evidence),null);
assert.equal(validateOperationalExplanation({claims:[{fact_id:'job_status',text:status.text},{fact_id:'job_status',text:status.text}]},evidence),null);
assert.equal(validateOperationalExplanation({claims:[{fact_id:'job_status',text:status.text}],answer:'Additional unsupported text'},evidence),null);
assert.equal(validateOperationalExplanation({claims:[{fact_id:'job_status',text:status.text,sql:'select *'}]},evidence),null);groups++;

const claims=(source:JobEvidence,ids:string[])=>({claims:ids.map(id=>({fact_id:id,text:source.facts.find(fact=>fact.id===id)!.text}))});
const laborQuestion='How many recorded labor hours does that Job have?';
assert.equal(validateOperationalExplanation(claims(labor,['job_identity','job_status']),labor,laborQuestion),null,'True status facts cannot replace the requested labor total');
assert.equal(validateOperationalExplanation(claims(labor,['labor_total','labor_limit']),labor,laborQuestion),null,'A quantitative explanation must retain the selected Job identity');
assert(validateOperationalExplanation(claims(labor,['job_identity','labor_total','labor_limit']),labor,laborQuestion));
const focusedLabor=renderJobEvidence(labor,1400,laborQuestion);
assert.match(focusedLabor,/1234 — Alpha Plaza/);assert.match(focusedLabor,/125\.25 hours for 2026-10-01 through 2026-10-28/);assert.doesNotMatch(focusedLabor,/On Hold/);
assert.deepEqual(buildOperationalInferenceInput(laborQuestion,labor).operational.facts.slice(0,3).map(fact=>fact.id),['job_identity','labor_total','labor_limit']);groups++;

const readiness=buildJobEvidence(result('get_job_summary',{job:{...job,material_status:'ready'},counts:{rework_cycles:2,active_rework_cycles:1,open_follow_ups:0}},{unknowns:['Planning completeness and recorded Material Status do not establish physical readiness or absence of blockers.']}));
const readinessQuestion='Is Job 1234 ready to start?';
assert.equal(validateOperationalExplanation(claims(readiness,['job_identity','job_material_status']),readiness,readinessQuestion),null,'Recorded Ready alone cannot answer physical readiness');
assert(validateOperationalExplanation(claims(readiness,['job_identity','job_material_status','job_planning_readiness','job_rework','job_material_ready','unknown_1']),readiness,readinessQuestion));
assert.match(renderJobEvidence(readiness,1400,readinessQuestion),/original Job status is Complete/);
assert.match(renderJobEvidence(readiness,1400,readinessQuestion),/do not establish physical readiness/);groups++;

const overview=buildJobEvidence(result('get_production_overview',{counts:{jobs:7,active_jobs:6,scheduled:3,unscheduled:4,by_status:{not_started:2,on_deck:1,in_production:2,on_hold:1,shipped:0,complete:1,cancelled:0}},upcoming:[],has_more_upcoming:false},{filters:{start_date:'2026-10-28',end_date:'2026-11-26'}}));
assert.equal(validateOperationalExplanation(claims(overview,['overview_active_jobs']),overview,'How many Production Jobs are In Production?'),null,'A different valid overview count is not the requested status count');
assert(validateOperationalExplanation(claims(overview,['overview_status_in_production']),overview,'How many Production Jobs are In Production?'));
assert.equal(renderJobEvidence(overview,1400,'How many active Production Jobs are there?'),'Active Production Jobs: 6.');
assert.match(renderJobEvidence(overview,1400,'Which Jobs have upcoming planned completion dates?'),/No active Production Jobs in scope/);
assert.match(renderJobEvidence(overview,1400,'Which Jobs have upcoming planned completion dates?'),/2026-10-28 through 2026-11-26/);groups++;
assert.equal(canExplainOperationally('Give me Production Job counts by status',overview),false,'Seven required status counts exceed the six-claim bound before inference reservation');
assert.equal(canExplainOperationally('How many active Production Jobs are there?',overview),true);
assert.equal(canExplainOperationally(laborQuestion,labor),true);
assert.match(renderJobEvidence(overview,1400,'Give me Production Job counts by status'),/Cancelled: 0/,'The direct answer still includes all seven status counts');groups++;

const crowded=buildJobEvidence(result('get_job_labor_summary',{job,period:{start_date:'2026-10-01',end_date:'2026-10-28'},total_hours:125.25,entry_count:8,original_or_unclassified_hours:0,reworks:Array.from({length:8},(_,i)=>({rework_cycle_id:`22222222-2222-4222-8222-${String(i+1).padStart(12,'0')}`,sequence_number:i+1,hours:1,entry_count:1})),daily:Array.from({length:8},(_,i)=>({date:`2026-10-${21+i}`,hours:1})),latest_work_date:'2026-10-28'},{status:'partial',complete:false,unknowns:['Some recorded Rework sequence labels are unavailable.','These are recorded hours, not proof of all labor worked.']}));
assert(crowded.facts.length<=32);assert(crowded.facts.some(fact=>fact.id==='labor_limit'));
assert(crowded.facts.some(fact=>fact.id==='unknown_1'));assert(crowded.facts.some(fact=>fact.id==='unknown_2'));groups++;

// Exercise the actual handler boundary, with deterministic history/RPC
// fixtures only: retained live context cannot hijack a verified procedure.
const conversationId='33333333-3333-4333-8333-333333333333';
let history=[{question:'When is a Bid eligible to convert to Production?',answer:'In Intake, a saved Won Bid and recorded Deposit Received Date are required for conversion.'}],jobCalls=0,reservations=0;
const caller=async(name:string)=>({data:name==='tenbot_load_conversation'?{ok:true,id:conversationId,ownerId:id,version:1,turns:history}:true,error:null});
const service=async(name:string)=>{if(name==='tenbot_reserve_usage')reservations++;return {data:true,error:null};};
const noJobTools={async execute(){jobCalls++;throw new Error('A workflow question must not execute live Job tools');}};
const converted=await handleTenbot({action:'ask',question:'Can it be converted without a Job number or a committed schedule?'},id,caller,service,null,undefined,noJobTools);
assert('mode' in converted&&'message' in converted);assert.equal(converted.mode,'verified');assert.match(converted.message,/^Yes\b/);assert.match(converted.message,/Plan in Production Later/);
history=[{question:LIVE_QUESTION,answer:jobHistoryMarker({kind:'job',tool:'get_job_summary',reference:{jobId:id},args:{}})}];
const received=await handleTenbot({action:'ask',question:'Can I receive ten of fifty bags and leave forty pending?'},id,caller,service,null,undefined,noJobTools);
assert('mode' in received&&'sources' in received);assert.equal(received.mode,'guide');assert(received.sources.some((source:{id:string})=>source.id==='inventory-pending-receive'));
assert.equal(jobCalls,0);assert.equal(reservations,0);groups++;
const lookupCalls:string[]=[];
const live=await handleTenbot({action:'ask',question:'What is the status of Job 1234?'},id,caller,service,null,undefined,{async execute(tool:JobToolResult['tool']){
 lookupCalls.push(tool);assert(['find_jobs','get_job_summary'].includes(tool));
 return result(tool,tool==='find_jobs'?{jobs:[job],match:'exact',has_more:false,next_cursor:null}:{job,counts:{rework_cycles:2,active_rework_cycles:1,open_follow_ups:3}});
}});
assert('mode' in live&&'message' in live);assert.equal(live.mode,'operational');assert.match(live.message,/1234 — Alpha Plaza/);assert.match(live.message,/On Hold/);
assert.deepEqual(lookupCalls,['find_jobs','get_job_summary']);assert.equal(reservations,0);groups++;
console.log(`TenBot operational routing/evidence: ${groups} focused groups passed; no database, hosted calls, records or model inference.`);
