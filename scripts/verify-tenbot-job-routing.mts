import assert from 'node:assert/strict';
import {buildJobEvidence,buildOperationalInferenceInput,jobReportingPeriod,renderJobEvidence,resolveExactJobReference,resolveJobIntent,validateOperationalExplanation,type JobEvidence} from '../supabase/functions/_shared/tenbot-job-routing';
import type {JobFacts,JobToolResult} from '../supabase/functions/_shared/tenbot-job-tools';

const id='11111111-1111-4111-8111-111111111111',otherId='22222222-2222-4222-8222-222222222222',now=new Date('2026-10-28T13:00:00Z');
const job:JobFacts={job_id:id,job_number:'1234',name:'Alpha Plaza',customer:'Customer',reference:'1234 — Alpha Plaza',archived:false,original:{status:'complete',planned_start:'2026-10-01',planned_end:'2026-10-20',updated_at:now.toISOString()},effective:{lifecycle:'rework',rework_cycle_id:otherId,sequence_number:2,status:'on_hold',planned_start:'2026-10-27',planned_end:'2026-10-30',updated_at:now.toISOString()},material_status:'ordered',requested_delivery_date:'2026-10-30',readiness:{state:'needs_planning',label:'Planning Needed',missing_fields:['Customer']}};
const result=(tool:JobToolResult['tool'],data:JobToolResult['data'],override:Partial<JobToolResult>={}):JobToolResult=>({tool,version:'tenbot-job-read.v1',status:'ok',observed_at:now.toISOString(),read_started_at:now.toISOString(),read_completed_at:now.toISOString(),consistency:'best_effort_multi_query',timezone:'America/Chicago',filters:{},units:{},sources:[{relation:'jobs',job_id:id,observed_at:now.toISOString()}],unknowns:[],complete:true,truncated:false,data,...override});
let groups=0;
for(const q of ['How do I create a job?','How can I record labor for Job 1234?','Where do I edit a Production Job?','What does the Production Pipeline do?','How does the Production Pipeline work?','What does Production show?','How do Jobs work?','What does Inventory show?','How does Intake work?','Summarize the following:\nJob 1234 is on hold.','Rewrite this note about Job 1234','Analyze the following pasted text:\nJob 1234 contract value is employee supplied.'])assert.equal(resolveJobIntent(q,{jobId:id},now),null,q);groups++;
assert.deepEqual(resolveJobIntent('What is the status of job 1234?',null,now),{kind:'job',tool:'get_job_summary',reference:{query:'1234'},args:{}});
assert.deepEqual(resolveJobIntent('Tell me about job Alpha Plaza',null,now),{kind:'job',tool:'get_job_summary',reference:{query:'Alpha Plaza'},args:{}});
assert.deepEqual(resolveJobIntent('What is scheduled for Job "Alpha Plaza"?',null,now),{kind:'job',tool:'get_job_planning',reference:{query:'Alpha Plaza'},args:{}});
assert.deepEqual(resolveJobIntent('How many hours for Job DEV-20260803 this month?',null,now),{kind:'job',tool:'get_job_labor_summary',reference:{query:'DEV-20260803'},args:{start_date:'2026-10-01',end_date:'2026-10-28'}});groups++;
assert.deepEqual(resolveJobIntent('What is the status of Job TB-2801?',null,now),{kind:'job',tool:'get_job_summary',reference:{query:'TB-2801'},args:{}});
assert.deepEqual(resolveJobIntent('Find archived Job "Alpha Plaza"',null,now),{kind:'job',tool:'get_job_summary',reference:{query:'Alpha Plaza'},args:{},includeArchived:true});
assert.deepEqual(resolveJobIntent('How many active jobs are there?',null,now),{kind:'overview',tool:'get_production_overview',args:{}});
assert.deepEqual(resolveJobIntent('Show jobs for Alpha',null,now),{kind:'search',tool:'find_jobs',args:{query:'Alpha'}});
assert.equal(resolveJobIntent('List archived jobs',null,now)?.kind,'search');groups++;
assert.deepEqual(resolveJobIntent('What work is scheduled next for it?',{jobId:id},now),{kind:'job',tool:'get_job_planning',reference:{jobId:id},args:{}});
assert.deepEqual(resolveJobIntent('What about its labor?',{jobId:id},now),{kind:'job',tool:'get_job_labor_summary',reference:{jobId:id},args:{}});
assert.deepEqual(resolveJobIntent('How many recorded labor hours does that job have?',{jobId:id},now),{kind:'job',tool:'get_job_labor_summary',reference:{jobId:id},args:{}});
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
console.log(`TenBot operational routing/evidence: ${groups} focused groups passed; no database, hosted calls, records or model inference.`);
