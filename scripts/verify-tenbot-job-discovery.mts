/** Focused discovery regression over real Job/hosted-session code. The database,
 * caller authorization and provider choices are synthetic; no paid inference,
 * network, shared data, migration or JWT/RLS certification occurs. Run copies
 * against the pinned deployed runtime, never an unrelated dirty agent loop. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createContextFixture} from './support/tenbot-context-fixture.mjs';
import {uuid} from './support/wave2-fixture.mjs';
import {explicitJobReferences,resolveJobIntent,buildJobEvidence,completeJobLookup} from '../supabase/functions/_shared/tenbot-job-routing';
import {createTenbotAgentJobTools,createTenbotAgentKnowledgeTools,createTenbotAgentScopeTool} from '../supabase/functions/_shared/tenbot-agent-operations';
import {canonicalHistoryScope} from '../supabase/functions/_shared/tenbot-history-scope';
import {publishModelReadAnswer} from '../supabase/functions/_shared/tenbot-read-investigation';
import {contextFromReads,validConversationContext} from '../supabase/functions/_shared/tenbot-conversation-context';
import {operationalReceipt} from '../supabase/functions/_shared/tenbot-operational-history';
import {jobHistoryMarker,retainedJobIntent,type JobTools} from '../supabase/functions/_shared/tenbot-job-session';
import {createHostedTenbot} from '../supabase/functions/_shared/tenbot-hosted';
import {defaultModel,measuredUsage} from '../supabase/functions/_shared/tenbot-models';
import type {InferenceInput,InferenceProvider} from '../supabase/functions/_shared/tenbot-core';
import type {AgentFinal,AgentResult} from '../supabase/functions/_shared/tenbot-agent';
import type {JobFindData,JobOverviewData,JobToolResult} from '../supabase/functions/_shared/tenbot-job-tools';

const before=process.argv.includes('--before'),checks:string[]=[],examples:unknown[]=[];
const question='whats going on with the cedar bay job right now';
const ctx={callerId:uuid(9000),signal:new AbortController().signal};
const find=(query='',schedule='all',limit=20,cursor='',statuses:string[]=[])=>({query,schedule,statuses,include_archived:false,limit,cursor});
function fixture(){const f=createContextFixture();Object.assign(f.tables.jobs[0],{name:'Lincoln Rd. – Cedar Bay',job_number:'25-1121'});return f;}
function registry(f:ReturnType<typeof fixture>,q:string){return createTenbotAgentJobTools(f.state.jobTools!,undefined,{question:q,context:null,references:explicitJobReferences(q)});}
const tool=(r:ReturnType<typeof createTenbotAgentJobTools>,name:string)=>r.tools.find(t=>t.name===name)!;
const rows=(r:JobToolResult)=>(r.data as JobFindData).jobs;
const step=(...calls:{id:string;name:string;arguments:Record<string,unknown>}[])=>({calls,final:null});
const call=(name:string,args:Record<string,unknown>)=>({id:name,name,arguments:args});
const discover=(...names:string[])=>step(call('discover_capabilities',{names}));
const outputs=(i:InferenceInput)=>i.agent!.history.flatMap(x=>x.kind==='tool_result'?[JSON.parse(x.output)]:[]);
function final(i:InferenceInput,name:string,ids?:string[]){const row=outputs(i).filter(x=>x.tool===name).at(-1);assert(row);const grouped=row.data.answer_facts.some((x:{id:string})=>x.id.startsWith('matches_'));const facts=row.data.answer_facts.filter((x:{id:string})=>ids?ids.includes(x.id):x.id.startsWith(grouped?'matches_':'match_'));const value:AgentFinal={answer:facts.map((x:{text:string})=>x.text).join(' '),observations:facts.map((x:{text:string})=>({text:x.text,evidence_ids:[row.evidence_id]})),inferences:[],recommendations:[],questions:[],completed_actions:[]};return{calls:[],final:value};}

if(before){
 assert.deepEqual(explicitJobReferences(question),['right now']);
 assert.deepEqual(explicitJobReferences('what is going on with the cedar bay project right now?'),['right now']);
 const f=fixture(),r=registry(f,question),start=f.trace.length;
 await assert.rejects(tool(r,'find_jobs').execute(find('cedar bay'),ctx));assert.equal(f.trace.length,start);
 checks.push('Both ordinary prenominal-name requests are constrained to a false temporal identity and the intended search is rejected before the real executor');
 const partial=registry(f,'Check Cedar Bay planning');await tool(partial,'find_jobs').execute(find('Cedar Bay'),ctx);
 await assert.rejects(tool(partial,'get_job_planning').execute({job_id:f.tables.jobs[0].id},ctx));
 checks.push('A complete unique partial-name result cannot bind its canonical Job for details');
 assert.equal(tool(r,'find_jobs').parameters.properties?.schedule,undefined);
 assert.equal((await f.state.jobTools!.execute('find_jobs',{schedule:'unscheduled'})).status,'invalid_request');
 checks.push('The deployed tool schema/executor lack schedule population selection');
 const lookup=await f.state.jobTools!.execute('find_jobs',{query:'Cedar Bay'}),seed=contextFromReads([{name:'find_jobs',args:{query:'Cedar Bay'},result:lookup}],'Find our Cedar Bay project',f.state.now)!;
 assert.equal(seed.subject,'Production');assert.equal(seed.resultType,'collection');assert.equal(seed.selection.query,'Cedar Bay');assert.equal(resolveJobIntent('When is the delivery date?',{jobId:seed.references[0],continuity:seed}),null);
 checks.push('A unique named lookup retains the prior collection search and an implicit new date objective has no canonical record intent');
}else{
 for(const q of [question,'what is going on with the cedar bay project right now?','How is the Harbor Point project doing?','Check the Willow Grove job status','Show status for Job Cedar Bay right now']){
  const expected=/harbor/i.test(q)?'Harbor Point':/willow/i.test(q)?'Willow Grove':'Cedar Bay';assert.deepEqual(explicitJobReferences(q).map(x=>x.toLowerCase()),[expected.toLowerCase()]);
 }
 for(const q of ['What is the Job status right now?','Show the active job','Which jobs are unscheduled?','Show status for Job ""','What is the job number for our project on Lincoln Road for Drexel?'])assert.deepEqual(explicitJobReferences(q),[]);
 assert.deepEqual(explicitJobReferences('Show status for Job "Right Now"'),['Right Now']);
 checks.push('Generic names before/after Job/project resolve without capturing request prose or temporal suffixes');
 for(const q of [question,'what is going on with the cedar bay project right now?','Show status for Job 25-1121']){
  const f=fixture(),r=registry(f,q),query=explicitJobReferences(q)[0];await tool(r,'find_jobs').execute(find(query),ctx);await tool(r,'get_job_planning').execute({job_id:f.tables.jobs[0].id},ctx);
 }
 checks.push('Complete unique partial names and direct Job numbers bind the current canonical Job through real authorized executors');
 for(const mode of ['ambiguous','missing','paged','partial'] as const){
  const f=fixture();if(mode==='ambiguous'||mode==='paged')Object.assign(f.tables.jobs[1],{name:'Cedar Bay Annex'});
  const actual=f.state.jobTools!,tools:JobTools=mode==='partial'?{execute:async(n,a)=>{const result=await actual.execute(n,a);return n==='find_jobs'?{...result,status:'partial',complete:false}:result;}}:actual;
  const q=mode==='missing'?'Show status for Job Absent Place':'Show status for Job Cedar Bay',r=createTenbotAgentJobTools(tools,undefined,{question:q,context:null,references:explicitJobReferences(q)});
  await tool(r,'find_jobs').execute(find(mode==='missing'?'Absent Place':'Cedar Bay','all',mode==='paged'?1:20),ctx);
  await assert.rejects(tool(r,'get_job_planning').execute({job_id:f.tables.jobs[0].id},ctx));
 }
 checks.push('Ambiguous, missing, partial and paginated name searches never select a canonical detail Job');
 for(const filter of ['status','schedule']){
  const f=fixture();Object.assign(f.tables.jobs[1],{name:'Cedar Bay Annex',production_status:'on_deck',planned_start:null});
  const priorRead=await f.state.jobTools!.execute('find_jobs',{statuses:['on_deck']}),prior=contextFromReads([{name:'find_jobs',args:{statuses:['on_deck']},result:priorRead}],'Which Jobs are On Deck?',f.state.now);
  const r=createTenbotAgentJobTools(f.state.jobTools!,undefined,{question,context:prior,references:explicitJobReferences(question)}),args=filter==='status'?find('Cedar Bay','all',20,'',['on_deck']):find('Cedar Bay','unscheduled');
  await tool(r,'find_jobs').execute(args,ctx);await assert.rejects(tool(r,'get_job_planning').execute({job_id:f.tables.jobs[1].id},ctx));
  const read=r.reads()[0],retained=contextFromReads([read],question,f.state.now,prior);assert(!retained?.references.length);
  await tool(r,'find_jobs').execute(find('Cedar Bay'),ctx);await assert.rejects(tool(r,'get_job_planning').execute({job_id:f.tables.jobs[1].id},ctx));
  f.tables.jobs[1].name='Other Project';const fresh=createTenbotAgentJobTools(f.state.jobTools!,undefined,{question,context:prior,references:explicitJobReferences(question)});await tool(fresh,'find_jobs').execute(find('Cedar Bay'),ctx);await tool(fresh,'get_job_planning').execute({job_id:f.tables.jobs[0].id},ctx);
 }
 checks.push('A status/schedule filter cannot hide another partial-name match and authorize details; old population focus cannot replace fresh unfiltered identity resolution');
 const f=fixture(),template=f.tables.jobs[0];f.tables.jobs=Array.from({length:30},(_,i)=>({...template,id:uuid(10000+i),name:`Planning ${i+1}`,job_number:`P-${i+1}`,production_status:i===27?'complete':i===28?'cancelled':i===29?'shipped':i%2?'on_deck':'in_production',archived_at:i===26?'2026-10-01T12:00:00Z':null,planned_start:i<17?null:'2026-10-01',planned_end:'2026-11-15'}));
 f.tables.production_rework_cycles=[{id:uuid(30000),job_id:f.tables.jobs[24].id,sequence_number:1,production_status:'on_deck',planned_start:'2026-10-01',planned_end:null,updated_at:'2026-11-01T12:00:00Z'}];
 const all=await f.state.jobTools!.execute('find_jobs',{schedule:'unscheduled',limit:20});assert.equal(all.status,'ok');assert(completeJobLookup(all));assert.equal(rows(all).length,18);assert(rows(all).some(j=>j.job_id===f.tables.jobs[24].id&&j.effective.lifecycle==='rework'));
 const expected=rows(all).map(j=>j.job_id),paged:string[]=[];let cursor:string|undefined;
 do{const r=await f.state.jobTools!.execute('find_jobs',{schedule:'unscheduled',limit:3,...(cursor?{cursor}:{})});assert.equal(r.status,'ok');paged.push(...rows(r).map(j=>j.job_id));const facts=buildJobEvidence(r).facts;assert(facts.some(x=>x.id==='list_completeness'&&/not a complete/.test(x.text)));cursor=(r.data as JobFindData).next_cursor??undefined;}while(cursor);
 assert.deepEqual(paged,expected);const count=await f.state.jobTools!.execute('get_production_overview',{schedule:'unscheduled'});assert.equal((count.data as JobOverviewData).counts.jobs,expected.length);assert.equal((count.data as JobOverviewData).counts.unscheduled,expected.length);assert.equal((count.data as JobOverviewData).counts.scheduled,0);
 for(const schedule of ['all','scheduled','unscheduled'])for(const statuses of [[],['on_deck'],['not_started','on_deck','in_production','on_hold','shipped']])for(const include_archived of [false,true]){
  const r=await f.state.jobTools!.execute('find_jobs',{schedule,statuses,include_archived,limit:20});const ids=rows(r).map(j=>j.job_id);let next=(r.data as JobFindData).next_cursor;while(next){const page=await f.state.jobTools!.execute('find_jobs',{schedule,statuses,include_archived,limit:20,cursor:next});ids.push(...rows(page).map(j=>j.job_id));next=(page.data as JobFindData).next_cursor;}
  const overview=await f.state.jobTools!.execute('get_production_overview',{schedule,statuses,include_archived});assert.equal((overview.data as JobOverviewData).counts.jobs,ids.length);
 }
 const attention=await f.state.jobTools!.execute('find_jobs',{statuses:['not_started','on_deck','in_production','on_hold','shipped'],schedule:'scheduled',limit:20});assert(rows(attention).some(j=>j.job_id===f.tables.jobs[29].id));assert(!rows(attention).some(j=>[f.tables.jobs[27].id,f.tables.jobs[28].id].includes(j.job_id)));
 checks.push('Schedule/status/archive filters compose before pagination, preserve count/list equality and use active Rework dates; Pipeline attention excludes Complete/Cancelled while retaining Shipped');
 for(const schedule of [null,'missing',true,[],{}])for(const name of ['find_jobs','get_production_overview'] as const)assert.equal((await f.state.jobTools!.execute(name,{schedule})).status,'invalid_request');
 const legacy=await f.state.jobTools!.execute('find_jobs',{limit:20}),explicitAll=await f.state.jobTools!.execute('find_jobs',{schedule:'all',limit:20});assert.deepEqual(legacy,explicitAll);
 const facts=buildJobEvidence(all).facts;assert.equal(facts.filter(x=>x.id.startsWith('match_')).length,18);assert(facts.every(x=>!x.id.startsWith('match_')||/unscheduled/.test(x.text)));assert(facts.some(x=>x.id==='population_scope'&&/all lifecycle statuses, including terminal statuses/.test(x.text)));assert(facts.some(x=>x.id==='list_completeness'&&/This is the complete/.test(x.text)));
 const read={name:'find_jobs' as const,args:{schedule:'unscheduled',limit:20},result:all};assert.equal(contextFromReads([read],'Which Jobs are unscheduled?',f.state.now),null);
 assert.equal(await operationalReceipt([read],'Which Jobs are unscheduled?','Synthetic answer',new Date(f.state.now).toISOString(),f.state.now,'a'.repeat(64)),null);
 assert.equal(retainedJobIntent([{question:'[Live Production lookup]',answer:jobHistoryMarker({kind:'overview',tool:'get_production_overview',args:{schedule:'unscheduled'}})}]),null);
 const ordinary=contextFromReads([{name:'find_jobs',args:{limit:20},result:legacy}],'List Jobs',f.state.now);assert(ordinary&&validConversationContext(ordinary));assert.equal(Object.keys(ordinary.selection).length,5);
 const intent=resolveJobIntent('Which jobs are unscheduled?');assert(intent?.kind==='search');assert.equal(intent.args.schedule,'unscheduled');assert.equal(intent.args.query,undefined);
 checks.push('Classified list/scope/completeness facts are host-owned; invalid selectors fail; all/omitted are compatible; unsupported typed context/legacy receipts decline without changing SQL contracts');
 const empty=fixture();empty.tables.jobs=[];const emptyList=await empty.state.jobTools!.execute('find_jobs',{schedule:'unscheduled'}),emptyCount=await empty.state.jobTools!.execute('get_production_overview',{schedule:'unscheduled'});assert(completeJobLookup(emptyList));assert.equal(rows(emptyList).length,0);assert.equal((emptyCount.data as JobOverviewData).counts.jobs,0);
 const bounded=fixture(),row=bounded.tables.jobs[0];bounded.tables.jobs=Array.from({length:1001},(_,i)=>({...row,id:uuid(40000+i),planned_start:null}));for(const name of ['find_jobs','get_production_overview'] as const){const unavailable=await bounded.state.jobTools!.execute(name,{schedule:'unscheduled'});assert.equal(unavailable.status,'partial');assert.equal(unavailable.complete,false);assert.equal(unavailable.truncated,true);assert(!buildJobEvidence(unavailable).facts.some(x=>x.id==='no_matches'));}
 checks.push('An empty authorized population is a complete zero; a bounded incomplete scan never becomes zero or a complete list');
 // Real persistent hosted-session path with scripted model choices. Reload
 // retains display, not a falsely unfiltered typed population selector.
 type Plan=(input:InferenceInput,round:number)=>unknown;let plan:Plan=()=>null,round=0;const inputs:InferenceInput[]=[],executed:{name:string;args:Record<string,unknown>}[]=[];
 const measurements=new WeakMap<InferenceInput,ReturnType<typeof measuredUsage>>(),provider:InferenceProvider={name:'OFFLINE scripted provider',reserveEstimate:()=>({model:defaultModel,neurons:2}),usage:i=>measurements.get(i)??null,async infer(i){inputs.push(structuredClone(i));measurements.set(i,measuredUsage(defaultModel,{prompt_tokens:100,completion_tokens:50}));return plan(i,++round);}};
 const actual=f.state.jobTools!,tracked:JobTools={authorizeHistory:ids=>actual.authorizeHistory!(ids),execute:async(name,args)=>{executed.push({name,args:structuredClone(args)});return actual.execute(name,args);}};
 const handler=()=>createHostedTenbot({owner:f.owner,origin:'http://localhost:3000',config:{enabled:true,origins:['http://localhost:3000'],apiKey:'',keyExpiresAt:'',spendingAuthorized:false,persistentHistory:true,modelDirectedReads:true},caller:f.caller,service:f.service,jobTools:tracked,qwen:provider,now:()=>f.state.now,fetcher:async()=>{throw Error('No external inference authorized');}});
 const ask=async(q:string,id?:string)=>{round=0;return await handler()({action:'ask',question:q,...(id?{conversationId:id}:{})}) as {conversationId:string;message:string;fallback?:boolean};};
 plan=(i,n)=>n===1?discover('find_jobs'):n===2?step(call('find_jobs',find('','unscheduled'))):final(i,'find_jobs');
 const first=await ask('Which jobs are unscheduled?');assert(!first.fallback,JSON.stringify(first));assert(first.message.includes('P-25'));assert(first.message.includes('complete matching Job list'));for(const id of [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,25])assert(first.message.includes(`P-${id} —`));assert.equal(f.row(first.conversationId).state.context??null,null);
 const history=await handler()({action:'history',conversationId:first.conversationId}) as {turns:{answer:{message:string}}[]};assert(history.turns.some(t=>t.answer.message===first.message));
 plan=(i,n)=>{assert(JSON.stringify(i.agent!.history[0]).includes('Which jobs are unscheduled?'));return n===1?discover('find_jobs'):n===2?step(call('find_jobs',find('','unscheduled',20,'',['on_deck']))):final(i,'find_jobs');};
 const next=await ask('Which of those are On Deck?',first.conversationId);assert(!next.fallback);assert(next.message.includes('only unscheduled Jobs'));assert(executed.filter(x=>x.name==='find_jobs').at(-1)?.args.schedule==='unscheduled');assert.equal(f.row(first.conversationId).state.context??null,null);
 Object.assign(f.tables.jobs[29],{name:'Harbor Point',job_number:'HP-30'});const target=f.tables.jobs[29];
 plan=(i,n)=>n===1?discover('find_jobs','get_job_planning'):n===2?step(call('find_jobs',find('Harbor Point'))):n===3?step(call('get_job_planning',{job_id:target.id})):final(i,'get_job_planning',['job_identity','job_schedule']);
 const changed=await ask('What is going on with the Harbor Point project right now?',first.conversationId);assert(!changed.fallback);assert(changed.message.includes('Harbor Point'));assert.deepEqual(f.row(first.conversationId).state.context?.references,[target.id]);
 examples.push({question:'Which jobs are unscheduled?',message:first.message},{question:'Which of those are On Deck?',message:next.message},{question:'What is going on with the Harbor Point project right now?',message:changed.message});
 checks.push('Scripted real hosted-session publication lists18 classified Jobs, persists/reloads private display, requeries unscheduled follow-up from authorized prior question, and resets to an explicit new Job');
 Object.assign(target,{requested_delivery_date:'2026-12-01'});
 plan=(i,n)=>n===1?discover('find_jobs'):n===2?step(call('find_jobs',find('Harbor Point'))):final(i,'find_jobs');
 const identity=await ask('What is the Job number for our project on Harbor Point?',first.conversationId),identityContext=f.row(identity.conversationId).state.context!;assert(!identity.fallback);assert.equal(identityContext.subject,'Job');assert.equal(identityContext.resultType,'record');assert.equal(identityContext.selection.query,'');assert.deepEqual(identityContext.references,[target.id]);
 await handler()({action:'history',conversationId:identity.conversationId});
 for(const [q,name,ids,expected]of [
  ['When is the delivery date?','get_job_planning',['job_requested_delivery','job_schedule'],'Requested delivery date: 2026-12-01'],
  ['How many labor hours are recorded?','get_job_labor_summary',['labor_total'],'Recorded labor: 0 hours'],
  ['What is the material status?','get_job_summary',['job_material_status'],'Recorded material status: Unknown'],
  ['What is the current status?','get_job_summary',['job_status'],'Recorded Production status: Shipped'],
  ['What is the progress?','get_job_summary',['job_status'],'Phase/Item progress']
 ]as const){
  const seed=f.row(identity.conversationId).state.context!,intent=resolveJobIntent(q,{jobId:target.id,continuity:seed});assert(intent?.kind==='job'&&'jobId'in intent.reference);assert.equal(intent.reference.jobId,target.id);assert.equal(intent.tool,name);
  plan=(i,n)=>n===1?discover(name):n===2?step(call(name,{job_id:target.id,...(name==='get_job_labor_summary'?{start_date:'',end_date:''}:{})})):final(i,name,[...ids]);
  const answer=await ask(q,identity.conversationId);assert(!answer.fallback);assert(answer.message.includes(expected),JSON.stringify({q,expected,answer}));assert(answer.message.includes('Harbor Point'));if(name==='get_job_planning'){assert(answer.message.includes('2026-10-01 through 2026-11-15'));assert(answer.message.includes('do not provide actual delivery or completion dates'));examples.push({question:q,message:answer.message});}
 }
 target.requested_delivery_date=null;const missing=await actual.execute('get_job_planning',{job_id:target.id});assert(buildJobEvidence(missing).facts.some(x=>x.id==='job_requested_delivery_missing'));
 checks.push('Unique identity lookup survives reload as a canonical subject; generic implicit date/labor/material/status/progress objectives select fresh record reads, with requested/planned/actual-date distinctions');
 const oversized=fixture();oversized.tables.jobs=Array.from({length:20},(_,i)=>({...oversized.tables.jobs[0],id:uuid(50000+i),name:`Project ${i} `+'Long project name '.repeat(12),planned_start:null}));const long=await oversized.state.jobTools!.execute('find_jobs',{schedule:'unscheduled'});assert(completeJobLookup(long));const longFacts=buildJobEvidence(long).facts.filter(x=>x.id.startsWith('matches_'));assert(longFacts.every(x=>x.text.length<=1600));assert(longFacts.map(x=>x.text).join(' ').length>2400);
 const oversizedFinal:AgentFinal={answer:'The matching Jobs are in the cited evidence.',observations:longFacts.map(x=>({text:x.text,evidence_ids:['e1']})),inferences:[],recommendations:[],questions:[],completed_actions:[]},reasons:string[]=[];
 assert.equal(publishModelReadAnswer({status:'completed',final:oversizedFinal,evidence:[{id:'e1',tool:'find_jobs',data:{data:long.data,answer_facts:buildJobEvidence(long).facts}}],trace:[],proposals:[]}as unknown as AgentResult,'Which jobs are unscheduled?',undefined,new Set(),reason=>{reasons.push(reason);}),null);assert.deepEqual(reasons,['read-final-too-long']);
 const firstArchive=f.archives.get(identity.conversationId)![0].turn;assert.deepEqual(new Set(firstArchive.jobIds as string[]),new Set(expected));
 checks.push('Long-name grouped facts respect1600-character claims; an answer exceeding2400 is rejected without silent member omission, and persisted references cover the entire published page');
 const archive=f.archives.get(identity.conversationId)!.at(-1)!.turn;assert(Array.isArray(archive.jobIds)&&archive.jobIds.includes(target.id));f.hidden.add(target.id);const revoked=await handler()({action:'history',conversationId:identity.conversationId})as{turns:{answer:{message:string}}[]};assert(!revoked.turns.some(t=>t.answer.message.includes('Harbor Point')));f.hidden.clear();
 checks.push('Persistent display retains canonical access references and current record revocation redacts the affected saved conversation turns');
 f.state.allowed=false;const denied=await actual.execute('find_jobs',{schedule:'unscheduled'});assert.equal(denied.status,'not_found_or_not_authorized');assert.equal(denied.data,null);
 checks.push('Current capability denial remains fail-closed for filtered reads');
}
const scopeFixture=fixture(),scope=(await createTenbotAgentScopeTool([...createTenbotAgentJobTools(scopeFixture.state.jobTools!).tools,...createTenbotAgentKnowledgeTools(async()=>true)]).execute({},ctx)).data;
const scopeDigest=(value:unknown)=>createHash('sha256').update(JSON.stringify({snapshot:'tenbot-agent-display-scope.v1',source:value})).digest('hex');
const legacyScopeDigest='644df6bbb7eaf5fec678f6775fe7e5b55ef3de9e442b41730992e358a68d550d';assert.equal(scopeDigest(canonicalHistoryScope(scope)),legacyScopeDigest);
for(const change of ['name','kind','description','boundary']){const changed=structuredClone(scope)as unknown as{capabilities:{name:string;kind:string;description:string}[];sql:boolean};if(change==='boundary')changed.sql=true;else changed.capabilities[0][change as 'name'|'kind'|'description']+=' unknown';assert.notEqual(scopeDigest(canonicalHistoryScope(changed)),legacyScopeDigest);}
checks.push('Only exact known additive descriptions preserve the accepted history digest; unknown descriptors, identity/kind and authority changes still invalidate it');
const agentSha256=createHash('sha256').update(readFileSync(new URL('../supabase/functions/_shared/tenbot-agent.ts',import.meta.url))).digest('hex');
const result={passed:true,phase:before?'before':'after',groups:checks.length,checks,examples,agentSha256,legacyScopeDigest,scriptedProviderChoices:true,actualInference:false,actualJwtRls:false,actualPostgreSQL:false,externalNetworkRequests:0,paidInferenceUsd:0,sharedMutations:0};
if(process.env.TENBOT_DISCOVERY_EVIDENCE){mkdirSync(process.env.TENBOT_DISCOVERY_EVIDENCE,{recursive:true});writeFileSync(`${process.env.TENBOT_DISCOVERY_EVIDENCE}/${before?'before':'after'}.json`,JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result,null,2));
