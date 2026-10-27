import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {execFile,execFileSync} from 'node:child_process';
import {promisify} from 'node:util';
import {pilotCaps,pilotDirectory} from './support/tenbot-ai-pilot.mjs';
import {answer,cloudflareProvider,groundedProse,type InferenceInput,type InferenceProvider} from '../supabase/functions/_shared/tenbot-core';
import {retrieve,registry,snapshot,conversationGuides} from '../supabase/functions/_shared/tenbot-knowledge';
import {handleTenbot} from '../supabase/functions/_shared/tenbot-handler';
import {projectConversation} from '../supabase/functions/_shared/tenbot-privacy';
import {startIntakeDatabase,sql,docker,asUser,literal,json,admin,member} from './support/intake-materials-database.mjs';

const all=new Set(registry.flatMap(entry=>[entry.permission,...entry.additionalPermissions||[]]));
all.add('readOperationalData');
const readOnly=new Set(['readOperationalData']);
let reserved=0;
const reserve=async()=>{reserved++;};
const fixture=(output:unknown,inspect?:(input:InferenceInput)=>void):InferenceProvider=>({name:'local deterministic fixture',infer:async input=>{inspect?.(input);return output;}});
const noInference:InferenceProvider={name:'must remain local',infer:async()=>{throw Error('Unexpected external inference');}};
const groupQuestion='How do I create a group conversation?';
const manpowerQuestion='how do i filter by jobs in manpower reporting';
const reworkQuestion='how do i initiate a rework for a job?';
const customerEditQuestion='how do i edit a saved customers details';
const entry=(id:string)=>{const found=registry.find(candidate=>candidate.id===id);assert(found,id);return found;};
for(const action of ['delete','remove','export','import','predict','forecast','automate','sync','train','invite','approve']){
 assert.match(projectConversation(`How do I ${action} a group conversation?`,[]).question,new RegExp(`\\b${action}\\b`),'Unsupported action intent must survive privacy filtering');
}

// Every maintained example must retrieve its actual workflow first and remain
// usable through direct guide search when the provider is absent.
let corpusCases=0;
for(const expected of registry){
 assert.ok(readFileSync(expected.evidence.split('#')[0]));
 if(expected.route)assert.ok(readFileSync('src/app'+expected.route+'/page.tsx'));
 if(expected.status!=='deployed')assert.equal(expected.route,null);
 for(const sourceFile of expected.sourceFiles){
  assert.ok(readFileSync(sourceFile));
  execFileSync('git',['cat-file','-e',`${snapshot.revision}:${sourceFile}`],{stdio:'pipe'});
 }
 for(const question of expected.examples){
  assert.equal(retrieve(question,all)[0]?.id,expected.id,question);
  const fallback=await answer({action:'ask',question},all,null,reserve);
  assert.equal(fallback.sources[0]?.id,expected.id,`direct guide fallback: ${question}`);
  assert.equal(fallback.sources[0].guidance,expected.guidance);
  assert.equal('receipt' in fallback.snapshot,false);
  if(expected.availability==='unavailable')assert.equal(fallback.resolution,'unavailable');
  else if(expected.status==='unknown')assert.equal(fallback.resolution,'documentation-missing');
  else if(expected.status==='local'||expected.status==='planned')assert.equal(fallback.resolution,'unavailable');
  corpusCases++;
 }
}
assert(corpusCases>=89,`Expected the maintained 89-question coverage corpus, received ${corpusCases}`);
assert.equal(reserved,0,'Direct guide coverage must consume no inference budget');
for(const [question,id] of [[reworkQuestion,'production-rework-create'],[manpowerQuestion,'manpower-job-filter'],[customerEditQuestion,'customer-edit']] as const){
 assert.equal(retrieve(question,all)[0]?.id,id,question);
 const result=await answer({action:'ask',question},all,null,reserve);
 assert.equal(result.resolution,'available');assert.equal(result.sources[0].id,id);
}
assert.match(entry('production-rework-create').guidance,/completed|complete/);
assert.match(entry('production-rework-create').guidance,/same canonical Job/);
assert.match(entry('manpower-job-filter').guidance,/Job labor review/);
assert.match(entry('customer-edit').guidance,/Customer Inspector/);
assert.match(entry('customer-edit').guidance,/Existing Jobs and Proposals keep their captured information/);

// Unknown module actions must never substitute a guide merely sharing Jobs,
// customers, or a generic action. Unknown does not imply an absent feature.
const unknownQuestions=[
 'How do I filter existing Jobs?',
 'How do I filter Jobs in Inventory?',
 'How do I export payroll in Manpower Reporting?',
 'How do I delete a customer in Contacts?',
 'How do I train a model in Samples?',
 'How do I approve a group conversation?',
 'How do I use telepathy in Manpower Reporting?',
];
for(const question of unknownQuestions){
 assert.deepEqual(retrieve(question,all),[],question);
 const before:number=reserved;
 const result=await answer({action:'ask',question},all,null,reserve);
 assert.equal(result.resolution,'documentation-missing',question);
 assert.deepEqual(result.sources,[]);assert.match(result.message,/verified|confirm|documentation/i);
 assert.doesNotMatch(result.message,/draft|suggestion|feature request/i);
 assert.equal(reserved,before);
 const clarified=await answer({action:'ask',question},all,fixture({ids:[],answer:'I cannot confirm that workflow from these sources. Which part of the module are you trying to use?'}),reserve);
 assert.equal(clarified.resolution,'documentation-missing',question);
 assert.deepEqual(clarified.sources,[]);assert.match(clarified.message,/cannot confirm/);
 assert.equal(clarified.suggestionAllowed,false);
}
for(const question of ['How do I update a Job?','How do I change my email address?','How do I find saved customers Jobs?']){
 assert(!retrieve(question,all).some(candidate=>candidate.id==='customer-edit'),question);
}
const crossModule=await answer({action:'ask',question:groupQuestion,context:['Current module: My Work']},all,null,reserve);
assert.equal(crossModule.sources[0].id,'group','Route context must not prevent explicit cross-module questions');

// Permission denial is deterministic, does not consume budget and supplies no
// restricted instructions. The exact Contacts conjunction remains enforced.
for(const id of ['customer-edit','production-rework-create','manpower-job-filter','sample-save','proposal-create','my-work-create','message-reply']){
 const workflow=entry(id);
 for(const missing of [workflow.permission,...workflow.additionalPermissions||[]]){
  const permissions=new Set([...all].filter(permission=>permission!==missing));
  assert(!retrieve(workflow.examples[0],permissions).some(candidate=>candidate.id===id));
  for(const provider of [null,noInference]){
   const before:number=reserved;
   const denied=await answer({action:'ask',question:workflow.examples[0]},permissions,provider,reserve);
   assert.equal(denied.resolution,'permission-denied',`${id}: ${missing}`);
   assert.deepEqual(denied.sources,[]);assert.match(denied.message,/permission|access/i);
   assert.doesNotMatch(denied.message,/Save Changes|Customer Inspector|feature request|suggestion/i);
   assert.equal(reserved,before);
  }
 }
}
for(const question of [reworkQuestion,manpowerQuestion,customerEditQuestion]){
 assert.equal((await answer({action:'ask',question},readOnly,noInference,reserve)).resolution,'permission-denied');
}
for(const id of ['planning-phase','planning-items']){
 const before:number=reserved;
 const result=await answer({action:'ask',question:entry(id).examples[0]},all,noInference,reserve);
 assert.equal(result.resolution,'unavailable');assert.equal(result.sources[0]?.availability,'unavailable');
 assert.equal(result.sources[0]?.route,null);assert.equal(reserved,before);
}
// A related permitted read guide must not authorize prose instructions for a
// denied edit workflow. The model receives only a safe existence/denial notice.
await assert.rejects(answer({action:'ask',question:"How do I edit customer details, and find a customer's previous Jobs?"},readOnly,fixture({ids:['customer-history'],answer:'Update the customer details, then save.'},input=>{
 const denied=input.excerpts.find(source=>source.id==='customer-edit');assert(denied);
 assert.match(denied.guidance,/permission denied/i);
 assert.doesNotMatch(denied.guidance,/Customer Inspector|Save Changes|Additional Information/);
 assert(input.excerpts.some(source=>source.id==='customer-history'));
}),reserve),/permission wording|verify|wording/i);

// Only existing server RPC decisions grant Proposal access; client claims and
// made-up app-capability aliases must have no effect.
for(const [proposalAccess,writable] of [[true,true],[false,true],[true,false]] as const){
 const calls:{name:string;permission?:string}[]=[];
 const result=await handleTenbot({action:'ask',question:'How do I create a Proposal?',permissions:[...all]},admin,async(name,args)=>{
  calls.push({name,permission:args?.p_capability as string|undefined});
  if(name==='has_proposal_access')return {data:proposalAccess,error:null};
  assert.equal(name,'has_app_capability');assert.notEqual(args?.p_capability,'proposal.access');
  return {data:args?.p_capability!=='writeBusinessData'||writable,error:null};
 },async()=>{throw Error('No provider means no reservation');},null,.2);
 assert(calls.some(call=>call.name==='has_proposal_access'));
 assert(calls.some(call=>call.permission==='writeBusinessData'));
 assert.equal((result as Awaited<ReturnType<typeof answer>>).resolution,proposalAccess&&writable?'available':'permission-denied');
}
const permissionChecks:string[]=[];
const deniedHandler=await handleTenbot({action:'ask',question:customerEditQuestion,permissions:[...all]},admin,async(name,args)=>{
 assert.equal(name,'has_app_capability');const permission=String(args?.p_capability);permissionChecks.push(permission);return {data:permission!=='writeBusinessData',error:null};
},async()=>{throw Error('Denied handler must not reserve');},null,.2);
assert.equal((deniedHandler as Awaited<ReturnType<typeof answer>>).resolution,'permission-denied');
assert(permissionChecks.includes('writeBusinessData')&&permissionChecks.includes('editProductionJobDetails'));
assert(!permissionChecks.includes('proposal.access'));

// Actual filtered wording and this account's bounded assistant dialogue reach
// the provider. They are not replaced with a canned guide title.
const prose='You can start the conversation right from Messaging. Choose New group, give it a name, select another participant, and then choose Create group.';
const conversationalQuestion='How do I create a group conversation? Explain the steps, please.';
const spoken=await answer({action:'ask',question:conversationalQuestion,context:['Current module: My Work']},all,fixture({ids:['group'],answer:prose,summary:''},input=>{
 assert.match(input.question,/how do i create a group conversation/i);
 assert.match(input.question,/explain the steps please/i);
 assert.notEqual(input.question,entry('group').title);assert.deepEqual(input.context,['Current module: My Work']);
 assert(input.excerpts.some(source=>source.id==='group'));assert(input.excerpts.length<=3);
}),reserve);
assert.equal(spoken.message,prose);assert.equal(spoken.sources[0].availability,'available');
assert(spoken.sources[0].constraints.some(rule=>rule.startsWith('Only the creator')));

const multiQuestion='How do I initiate Rework for a Job, and filter by Jobs in Manpower Reporting?';
const multiProse='For Rework, open the completed Job in Production and choose Create Rework. For labor, open Manpower Reporting and choose the Job in Job labor review. These are separate workflows on the same Job.';
const multi=await answer({action:'ask',question:multiQuestion},all,fixture({ids:['production-rework-create','manpower-job-filter'],answer:multiProse},input=>{
 assert.match(input.question,/rework/i);assert.match(input.question,/manpower reporting/i);
 assert(input.excerpts.some(source=>source.id==='production-rework-create'));
 assert(input.excerpts.some(source=>source.id==='manpower-job-filter'));
 assert(input.excerpts.length<=3);
}),reserve);
assert.equal(multi.message,multiProse);
for(const id of ['production-rework-create','manpower-job-filter'])assert(multi.sources.some(source=>source.id===id));
const ownExchange='Conversation context:\nEmployee: How do I initiate Rework for a Job?\nTenBot: Open the completed Job in Production and choose Create Rework.';
assert(conversationGuides('What if I do not see that button?',['Current module: Production',ownExchange]).some(candidate=>candidate.id==='production-rework-create'));
const followup=await answer({action:'ask',question:'What if I do not see that button?',context:['Current module: Production',ownExchange]},all,fixture({ids:['production-rework-create'],answer:'Check that the Job is complete, unarchived, and has no active Rework cycle. If those conditions are met, ask an administrator to review your access.'},input=>{
 assert.equal(input.question,'what if i do not see that button');
 assert(input.context.some(text=>text.startsWith('Conversation context:\nEmployee: how do i initiate rework')));
 assert(input.excerpts.some(source=>source.id==='production-rework-create'));
}),reserve);
assert.match(followup.message,/unarchived/);
const clarification=await answer({action:'ask',question:groupQuestion},all,fixture({ids:[],answer:'Are you starting a new group or trying to add someone to an existing DM?'}),reserve);
assert.match(clarification.message,/\?$/);
await assert.rejects(answer({action:'ask',question:groupQuestion},all,fixture({ids:[],answer:'Choose Export payroll and download the invoices.'}),reserve),/verify|ungrounded|wording/i);

// An input rejected by privacy projection must fall back locally without a
// provider call or reservation. No record/credential content enters inference.
const beforePrivate:number=reserved;
const privateQuestion='How do I create a group conversation?\nCustomer: Synthetic Acme\nInvoice: 8821';
const privateResult=await answer({action:'ask',question:privateQuestion},all,noInference,reserve);
assert.notEqual(privateResult.mode,'ai');assert.equal(reserved,beforePrivate);
assert.deepEqual(retrieve('How do I edit my password in Contacts?',all),[]);
const credentialResult=await answer({action:'ask',question:'How do I edit my password in Contacts?'},all,noInference,reserve);
assert.equal(credentialResult.resolution,'documentation-missing');assert.deepEqual(credentialResult.sources,[]);
assert.match(credentialResult.message,/credentials|verified|confirm/i);assert.equal(reserved,beforePrivate);

// Output guards permit ordinary reasoning but reject bad source references,
// invented controls/links/metadata, privilege reversals and execution claims.
for(const output of [
 {ids:['private-secret'],answer:prose},
 {ids:['group','group'],answer:prose},
 {ids:['group','dm','notifications','customer-edit'],answer:prose},
 {ids:['group'],answer:'All participants can rename the group.'},
 {ids:['group'],answer:'Any member can add or remove group participants.'},
 {ids:['group'],answer:'Removed members can still read the full history.'},
 {ids:['group'],answer:'Not only creators, all participants can rename the group.'},
 {ids:['group'],answer:'Choose Export payroll to download every invoice.'},
 {ids:['group'],answer:'Click the "Admin Override" button.'},
 {ids:['group'],answer:'Open https://private.example/invented.'},
 {ids:['group'],answer:'Open /invented-route.'},
 {ids:['group'],answer:'Open (/invented-route).'},
 {ids:['group'],answer:'The UUID is 9b160e46-b65b-487e-912a-3794dd09a75c.'},
 {ids:['group'],answer:'The commit is bc628bd.'},
 {ids:['group'],answer:'I have created the group and granted you administrator access.'},
 {ids:['group'],answer:'I already sent the message to every employee.'},
 {ids:['group'],answer:'<script>alert(1)</script>'},
 {ids:['group'],answer:'x'.repeat(1401)},
 {ids:['group'],answer:null},
])await assert.rejects(answer({action:'ask',question:groupQuestion},all,fixture(output),reserve),/verify|ungrounded|wording/i);
assert.equal(groundedProse('Start with the group name, then choose the people you want to talk with. Once you are ready, choose Create group.',entry('group')).startsWith('Start'),true);
assert.equal(groundedProse(multiProse,[entry('production-rework-create'),entry('manpower-job-filter')]),multiProse);
const breadcrumbProse='Open the Job in Production, select Create Rework, enter the intake/return date, then select Create Rework. For labor, open Reporting > Manpower Reporting and choose the Job in Job labor review.';
assert.equal(groundedProse(breadcrumbProse,[entry('production-rework-create'),entry('manpower-job-filter')]),breadcrumbProse);
const incorrectDmProse='You can add someone to an existing personal DM by creating a new group and inviting the person.';
const accurateDmProse='You cannot add a person to a DM; create a new group instead. The old DM stays private.';
assert.throws(()=>groundedProse(incorrectDmProse,entry('dm')),/wording|verify/i);
assert.equal(groundedProse(accurateDmProse,entry('dm')),accurateDmProse);
await assert.rejects(answer({action:'ask',question:'Can I add someone to an existing personal DM?'},all,fixture({ids:['dm'],answer:incorrectDmProse}),reserve),/wording|verify/i);
const accurateDm=await answer({action:'ask',question:'Can I add someone to an existing personal DM?'},all,fixture({ids:['dm'],answer:accurateDmProse}),reserve);
assert.equal(accurateDm.message,accurateDmProse);assert.equal(accurateDm.resolution,'partial');
assert.throws(()=>groundedProse('Device registration guarantees notifications.',entry('notifications')),/wording|verify/i);
assert.throws(()=>groundedProse('Historical customer text establishes a Job link.',entry('customer-history')),/wording|verify/i);
await assert.rejects(answer({action:'ask',question:groupQuestion},all,{name:'failed',infer:async()=>{throw Error('synthetic private credential');}},reserve),/unavailable/);
await assert.rejects(answer({action:'ask',question:groupQuestion},all,fixture({ids:['group'],answer:prose}),async()=>{throw Error('budget exhausted');}),/budget/);
await assert.rejects(answer({action:'ask',question:'x'.repeat(1201)},all,null,reserve),/shorten/);

// Provider abstraction, feedback confirmation entry point and administrator
// aggregate usage remain intact. No fixture performs a real network call.
const fakeFetch=(async(_url,options)=>{const request=JSON.parse(String(options?.body));assert.equal(request.max_tokens,384);assert.equal(request.messages.length,2);assert(!String(options?.body).includes('service_role'));return Response.json({success:true,result:{response:JSON.stringify({ids:['group'],summary:''})}});}) as typeof fetch;
assert.deepEqual(await cloudflareProvider('fixture','not-a-secret',fakeFetch).infer({question:'group',context:[],excerpts:[],draft:false}),{ids:['group'],summary:''});
const draft=await answer({action:'draft',question:'group conversation'},all,fixture({ids:['group'],summary:'Create a clearer group entry point.'}),reserve);
assert.equal(draft.summary,'Create a clearer group entry point.');
await assert.rejects(handleTenbot({action:'list'},admin,async()=>({data:false,error:null}),async()=>({data:null,error:null}),null,0),/not authorized/);
const forbiddenCalls:string[]=[];
await assert.rejects(handleTenbot({action:'usage'},member,async(name,args)=>{forbiddenCalls.push(name);return {data:name==='has_app_capability'&&args?.p_capability==='readOperationalData',error:null};},async()=>({data:null,error:null}),null,.2),/not authorized/);
assert.deepEqual(forbiddenCalls,['has_app_capability','has_app_capability']);
const usage=await handleTenbot({action:'usage',budget:100},admin,async(name)=>({data:name==='has_app_capability'?true:{sharedDayUsed:4,sharedDayLimit:20},error:null}),async()=>({data:null,error:null}),null,.2);
assert.deepEqual(usage,{usage:{sharedDayUsed:4,sharedDayLimit:20,monthlyBudgetUsd:.2}});
console.log(`${corpusCases} maintained workflow examples passed primary retrieval, direct-search fallback and released source-file provenance checks.`);
console.log('Exact Rework, Manpower and Contacts regressions, unknown/permission/unavailable distinctions, Proposal RPC isolation, actual filtered conversational input, multiple sources, own-dialogue follow-up, clarification and bounded output/failure guards passed. No real inference or hosted verification claimed.');
if(process.argv.includes('--core-only'))process.exit(0);
if(process.argv.includes('--pilot-local-only')){
 // Existing task-owned local fixture only. Seeded cap rows are always rolled
 // back or removed by their exact generated IDs; real reservations stay intact.
 const local='tenops-tenbot-review',before=sql(local,'select count(*) from tenbot_usage');
 for(const user of [admin,member]){
  assert.throws(()=>sql(local,`begin;delete from tenbot_usage;insert into tenbot_usage(user_id,reserved_usd,created_at) select ${literal(user)}::uuid,0.01,now()-interval '2 minutes' from generate_series(1,${pilotCaps.totalDay});${asUser(`select tenbot_reserve_usage(${literal(user)},1)`,admin,'service_role')};rollback;`),/shared daily pool/);
  assert.equal(sql(local,'select count(*) from tenbot_usage'),before);
 }
 // A single account may use more than the superseded 12/day allocation.
 const shared=sql(local,`begin;delete from tenbot_usage;insert into tenbot_usage(user_id,reserved_usd,created_at) select ${literal(member)}::uuid,0.01,now()-interval '2 minutes' from generate_series(1,13);${asUser(`select tenbot_reserve_usage(${literal(member)},1)`,admin,'service_role')};reset role;select count(*) from tenbot_usage;rollback;`);
 assert.equal(shared.trim().split('\n').at(-1),'14');
 assert.equal(sql(local,'select count(*) from tenbot_usage'),before);
 const ids=Array.from({length:pilotCaps.totalDay},()=>randomUUID());
 const lines=()=>{try{return readFileSync(pilotDirectory+'/usage.jsonl','utf8').trim().split('\n').length;}catch{return 0;}};
 const calls=lines();
 const token='local.'+Buffer.from(JSON.stringify({sub:admin})).toString('base64url')+'.local';
 const invoke=async(auth=token,origin='http://localhost:3000')=>fetch('http://localhost:55593/',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+auth,'Content-Type':'application/json'},body:JSON.stringify({action:'ask',question:'How do I create a group conversation?'})});
 try{
  sql(local,`insert into tenbot_usage(id,user_id,reserved_usd,created_at) values ${ids.map(id=>`(${literal(id)},${literal(admin)},0.01,now()-interval '2 minutes')`).join(',')}`);
  const response=await invoke();assert.equal(response.status,200);const result=await response.json();assert.equal(result.mode,'guide');assert.equal(result.fallback,true);assert.equal(result.sources[0].id,'group');
  assert.equal(lines(),calls,'A capped request must not invoke remote inference');
  assert.equal((await invoke('invalid')).status,401);assert.equal((await invoke(token,'http://untrusted.local')).status,403);
 }finally{sql(local,`delete from tenbot_usage where id in (${ids.map(literal).join(',')})`);}
 assert.equal(sql(local,'select count(*) from tenbot_usage'),before);
 console.log('Persistent shared UTC-day pool, no per-user daily allocation, atomic rollback, direct-guide fallback, no remote call on cap, local auth/origin isolation and fixture preservation passed.');
 process.exit(0);
}
const name='tenops-tenbot-verify-'+process.pid;
try{startIntakeDatabase(name);sql(name,readFileSync('supabase/migrations/20261027120000_tenbot_feedback_usage.sql','utf8'));sql(name,readFileSync('supabase/migrations/20261027130000_tenbot_shared_usage_pool.sql','utf8'));
 const run=(statement:string,id=admin,role='authenticated')=>sql(name,asUser(statement,id,role));
 const draft={capability:'Recurring task',problem:'Repeat manual entry',desired:'Weekly schedule',module:'My Work',original:'can I repeat a task?',summary:'Weekly tasks',summaryKind:'Employee-written',context:''};
 assert.throws(()=>run(`select tenbot_submit_feedback(${json(draft)},false)`),/Confirmed/);
 assert.throws(()=>run(`select tenbot_submit_feedback(${json({...draft,submitter_id:admin})},true)`),/Unknown/);
 assert.throws(()=>run(`select tenbot_submit_feedback(${json({...draft,summary:{unexpected:'object'}})},true)`),/must be text/);
 const id=run(`select tenbot_submit_feedback(${json(draft)},true)`,member);
 assert.equal(run(`select to_jsonb(submitter_id) from tenbot_feedback where id=${literal(id)}`,admin,'postgres').trim(),JSON.stringify(member));
 assert.throws(()=>run(`select tenbot_list_feedback('','')`,member),/Not authorized/);
 assert.throws(()=>run(`select tenbot_review_feedback(${literal(id)},'Shipped','')`,member),/Not authorized/);
 assert.throws(()=>run('select * from tenbot_feedback',member),/permission denied/);
 assert.throws(()=>run('select * from tenbot_feedback_history',member),/permission denied/);
 assert.throws(()=>run('select * from tenbot_usage',member),/permission denied/);
 assert.throws(()=>run(`select tenbot_reserve_usage(${literal(member)},1)`,member),/permission denied/);
 assert.throws(()=>run(`select tenbot_list_feedback('','')`,admin,'anon'),/permission denied/);
 run(`select tenbot_review_feedback(${literal(id)},'Under Consideration','Needs Product review')`);
 const listed=JSON.parse(run(`select tenbot_list_feedback('Under Consideration','My Work')`));assert.equal(listed.length,1);assert.equal(listed[0].history.length,2);assert.equal(listed[0].draft.original,draft.original);
 assert.throws(()=>run(`select tenbot_review_feedback(${literal(id)},'Approved','')`),/Invalid/);
 run(`select tenbot_reserve_usage(${literal(member)},0.01)`,admin,'service_role');
 assert.throws(()=>run(`select tenbot_reserve_usage(${literal(member)},0.01)`,admin,'service_role'),/budget exhausted/);
 for(let i=0;i<5;i++)run(`select tenbot_reserve_usage(${literal(member)},1)`,admin,'service_role');
 assert.throws(()=>run(`select tenbot_reserve_usage(${literal(member)},1)`,admin,'service_role'),/rate limit/);
 // Burst protection belongs to each account; it does not block another account.
 run(`select tenbot_reserve_usage(${literal(admin)},1)`,admin,'service_role');
 assert.throws(()=>run('select tenbot_usage_summary()',member),/Not authorized/);
 assert.throws(()=>run('select tenbot_usage_summary()',admin,'anon'),/permission denied/);
 assert.throws(()=>run('select tenbot_usage_summary()',admin,'service_role'),/permission denied/);
 const initialUsage=JSON.parse(run('select tenbot_usage_summary()'));
 assert.equal(initialUsage.sharedDayUsed,7);assert.equal(initialUsage.sharedDayRemaining,13);assert.equal(initialUsage.monthReservedUsd,.07);
 assert.equal(/user_id|submitter|draft|00000000/.test(JSON.stringify(initialUsage)),false);
 // Existing reservations count toward one pool. Both users can consume the
 // final entries even when one has already used more than the old allocation.
 sql(name,`delete from tenbot_usage;insert into tenbot_usage(user_id,reserved_usd,created_at) select ${literal(member)}::uuid,0.01,now()-interval '2 minutes' from generate_series(1,13);insert into tenbot_usage(user_id,reserved_usd,created_at) select ${literal(admin)}::uuid,0.01,now()-interval '2 minutes' from generate_series(1,5);`);
 run(`select tenbot_reserve_usage(${literal(member)},1)`,admin,'service_role');
 run(`select tenbot_reserve_usage(${literal(admin)},1)`,admin,'service_role');
 for(const user of [admin,member])assert.throws(()=>run(`select tenbot_reserve_usage(${literal(user)},1)`,admin,'service_role'),/shared daily pool/);
 const exhausted=JSON.parse(run('select tenbot_usage_summary()'));assert.equal(exhausted.sharedDayUsed,20);assert.equal(exhausted.sharedDayRemaining,0);assert.equal(exhausted.monthReservedUsd,.20);
 // Concurrent callers compete for the same final slot under the SQL lock.
 sql(name,"delete from tenbot_usage where id=(select id from tenbot_usage order by created_at limit 1)");
 const compete=await Promise.allSettled([admin,member].map(user=>promisify(execFile)('docker',['exec',name,'psql','-qAt','-U','postgres','-v','ON_ERROR_STOP=1','-c',asUser(`select tenbot_reserve_usage(${literal(user)},1)`,admin,'service_role')])));
 assert.equal(compete.filter(result=>result.status==='fulfilled').length,1);
 const denied=compete.find(result=>result.status==='rejected') as PromiseRejectedResult;
 assert.match(denied.reason.stderr,/shared daily pool/);
 assert.equal(JSON.parse(run('select tenbot_usage_summary()')).sharedDayUsed,20);
 // Previous-day attempts release daily capacity but retain monthly accounting.
 sql(name,"update tenbot_usage set created_at=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'-interval '1 second'");
 if(new Date().getUTCDate()>1)assert.throws(()=>run(`select tenbot_reserve_usage(${literal(admin)},.20)`,admin,'service_role'),/monthly budget/);
 run(`select tenbot_reserve_usage(${literal(member)},1)`,admin,'service_role');
 assert.equal(JSON.parse(run('select tenbot_usage_summary()')).sharedDayUsed,1);
 sql(name,`update app_users set is_active=false where user_id=${literal(member)}`);
 assert.throws(()=>run(`select tenbot_submit_feedback(${json(draft)},true)`,member),/Not authorized/);
 console.log('PostgreSQL migrations, identity, confirmation, bounded draft, role isolation, history, filters, inactive membership, shared day pool, administrator-only aggregate usage, UTC reset, monthly budget and per-account burst gates passed.');
}finally{docker(['stop',name]);}
