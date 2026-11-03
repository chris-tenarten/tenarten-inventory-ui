/** Focused integrated report/discovery/publication checks. Provider choices,
 * RPC storage and source rows are synthetic. No network, inference spend or
 * JWT/RLS/PostgreSQL certification. Run against the pinned clean agent loop. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createContextFixture} from './support/tenbot-context-fixture.mjs';
import {createTenbotAgentSessions} from '../supabase/functions/_shared/tenbot-agent-session';
import {createTenbotAgentHistoryStore} from '../supabase/functions/_shared/tenbot-agent-history-store';
import {emptyUsage,validateStrictSchema,type AgentFinal,type AgentStep,type AgentStepRequest,type AgentTool,type JsonValue} from '../supabase/functions/_shared/tenbot-agent';
import type {JobTools} from '../supabase/functions/_shared/tenbot-job-session';
import type {LaborReportResult} from '../src/modules/manpower/labor-report';

const releasedAgentSha='f127eedc748afb81a953fd0c15603ccae30c66ddb58ece370f9ba774e576cf98';
assert.equal(createHash('sha256').update(readFileSync(new URL('../supabase/functions/_shared/tenbot-agent.ts',import.meta.url))).digest('hex'),releasedAgentSha,'Run the task-private clean released agent; do not include unrelated dirty agent work.');
const before=process.argv.includes('--before'),checks:string[]=[],examples:Record<string,unknown>[]=[];
const originalQuestion='Which product have we spent the most hours of labor on, and which job was it for?';
const comparativeFollowup='Which Job contributed the most hours to that product category, and how do its other product categories compare?';
const oldDisclaimer='The registered tools read saved records and supplied documents. They do not establish future staffing capacity, physical readiness, or a completion forecast.';
const call=(id:string,name:string,args:Record<string,JsonValue>)=>({id,name,arguments:args});
const step=(...calls:AgentStep['calls']):AgentStep=>({calls,continuation:[],usage:emptyUsage()});
const discover=(...names:string[])=>step(call('discover','discover_capabilities',{names}));
type Output={tool:string;evidence_id:string;data:{answer_facts:{id:string;text:string;kind?:string}[];data?:LaborReportResult['data'];capabilities?:{name:string}[]}};
const output=(request:AgentStepRequest,name:string):Output=>{for(const item of [...request.history].reverse())if(item.kind==='tool_result'){const value=JSON.parse(item.output);if(value.tool===name)return value;}throw Error('Expected authorized current tool result: '+name);};
function selectedFinal(row:Output,ids:string[]):AgentStep&{final:AgentFinal}{
 const facts=ids.map(id=>{const fact=row.data.answer_facts.find(f=>f.id===id);assert(fact,'Missing host fact '+id);return fact;});
 return {...step(),final:{answer:facts.map(f=>f.text).join(' '),observations:facts.map(f=>({text:f.text,evidence_ids:[row.evidence_id]})),inferences:[],recommendations:[],questions:[],completed_actions:[]}};
}
function literalFinal(row:Output,text:string):AgentStep{return {...step(),final:{answer:text,observations:[{text,evidence_ids:[row.evidence_id]}],inferences:[],recommendations:[],questions:[],completed_actions:[]}};}
type Plan=(request:AgentStepRequest,round:number)=>AgentStep;
type Reply={conversationId:string;message:string;turns?:{question:string;answer:{message:string;history?:{state:string}}}[]};
const noWriteCopy=(message:string)=>assert(!/Nothing has been saved|Nothing has been added|PRIVATE_|I (?:saved|issued|created)/i.test(message),message);
async function check(name:string,run:()=>Promise<void>|void){await run();checks.push(name);}
function sessions(f:ReturnType<typeof createContextFixture>,jobTools:JobTools){
 const requests:AgentStepRequest[]=[];let actionCalls=0;
 const prepare:AgentTool={name:'prepare_proposal_draft',kind:'prepare',description:'Existing preparation registration; this verifier never calls it.',parameters:{type:'object',properties:{},required:[],additionalProperties:false},async execute(){actionCalls++;throw Error('No action is authorized by this read-only verifier');}};
 const make=(plan:Plan)=>{let round=0;return createTenbotAgentSessions({readOnlyHosted:true,modelDirectedReads:true,mode:'openai',sessionStore:createTenbotAgentHistoryStore(f.caller,f.service,{persistent:true}),can:async()=>f.state.allowed,jobTools:()=>jobTools,now:()=>f.state.now,provider:()=>({name:'OFFLINE scripted labor acceptance',model:'gpt-6.1-terra',async step(request){requests.push({...request,history:structuredClone(request.history),tools:structuredClone(request.tools)});return plan(request,++round);}}),reviewedOperations:async()=>({tools:[prepare],fresh:async()=>true,access:()=>({documentIds:[],proposalAccess:false}),publish:async()=>{actionCalls++;throw Error('No synthetic action may be published');},revoke:async()=>{throw Error('No synthetic action may exist');}}),operationHistory:{authorizeAccess:async()=>true,getAction:async()=>{throw Error('No synthetic action may exist');}}});};
 const ask=(plan:Plan,question=originalQuestion,conversationId?:string)=>make(plan)({action:'ask',question,...(conversationId?{conversationId}:{})},f.owner) as Promise<Reply>;
 const reopen=(conversationId:string)=>make(()=>{throw Error('History must never invoke the provider');})({action:'history',conversationId},f.owner) as Promise<Reply>;
 return{ask,reopen,requests,actionCalls:()=>actionCalls};
}

if(before){
 const f=createContextFixture(),s=sessions(f,f.state.jobTools!);
 const reply=await s.ask((request,n)=>n===1?discover('describe_assistant_scope'):n===2?step(call('scope','describe_assistant_scope',{})):literalFinal(output(request,'describe_assistant_scope'),oldDisclaimer));
 assert.equal(reply.message,oldDisclaimer);assert.equal(s.actionCalls(),0);
 const scope=output(s.requests.at(-1)!,'describe_assistant_scope');assert(!scope.data.capabilities?.some(t=>t.name==='get_labor_analytics'));
 assert.equal((await s.reopen(reply.conversationId)).turns?.at(-1)?.answer.message,oldDisclaimer);
 console.log(JSON.stringify({passed:true,before:true,groups:1,checks:['Released registry lacks historical Analytics; exact globally issued future-staffing fact can publish and persist for historical product/Job labor question.'],question:originalQuestion,message:reply.message,releasedAgentSha,actualInference:false,networkCalls:0},null,2));
 process.exit(0);
}

// Deferred imports let --before exercise the old released modules without
// copying the new adapter into its source boundary.
const {executeLaborReport}=await import('../src/modules/manpower/labor-report');
const {aggregateLabor,laborPeriod}=await import('../src/modules/manpower/analytics');
const {createTenbotAgentLaborTools,LABOR_CAPABILITY}=await import('../supabase/functions/_shared/tenbot-agent-labor');
const {createTenbotAgentJobTools,createTenbotAgentScopeTool}=await import('../supabase/functions/_shared/tenbot-agent-operations');
const {explicitJobReferences}=await import('../supabase/functions/_shared/tenbot-job-routing');
const {canonicalHistoryScope}=await import('../supabase/functions/_shared/tenbot-history-scope');
const {fixture:laborFixture,entries,categories,tasks,A,B,SLAB,job}=await import('./support/tenbot-labor-fixture.mjs');
type LaborOptions=Parameters<typeof laborFixture>[0];
const analyticsArgs=(period='30',job_id='',product_category_id='',limit=5):Record<string,JsonValue>=>({period,job_id,product_category_id,limit});
function fixture(options:LaborOptions={}){
 const f=createContextFixture();f.state.now=Date.parse('2026-11-02T18:00:00Z');
 Object.assign(f.tables.jobs[0],job(A));Object.assign(f.tables.jobs[1],job(B));
 f.tables.manpower_entries[0].job_id=A;
 const source=laborFixture(options),real=f.state.jobTools!,reads:{args:Record<string,unknown>;result:LaborReportResult}[]=[];let reportAllowed=true;
 const jobTools:JobTools={authorizeHistory:real.authorizeHistory,execute:real.execute,async laborReport(args,signal){
  const result=await executeLaborReport(source.caller,args,{today:'2026-11-02',now:()=>new Date(f.state.now),signal,hasCapability:async()=>f.state.allowed&&reportAllowed});
  reads.push({args:structuredClone(args),result:structuredClone(result)});return result;
 }};
 return{...f,...sessions(f,jobTools),jobTools,source,reads,setReportAllowed(value:boolean){reportAllowed=value;}};
}
const analyticsPlan=(ids:string[],args=analyticsArgs()):Plan=>(request,n)=>n===1?discover('get_labor_analytics'):n===2?step(call('labor','get_labor_analytics',args)):selectedFinal(output(request,'get_labor_analytics'),ids);

await check('Report exposure is conditional; closed schema advertises historical category/Job reuse without SQL or forecast authority',()=>{
 const f=fixture(),registry=createTenbotAgentLaborTools(f.jobTools),tool=registry.tools[0];
 assert.equal(tool.name,'get_labor_analytics');assert.equal(tool.kind,'read');assert.equal(createTenbotAgentLaborTools({execute:f.jobTools.execute}).tools.length,0);
 assert.deepEqual(tool.parameters.required,['period','job_id','product_category_id','limit']);assert.equal(tool.parameters.additionalProperties,false);
 for(const args of [analyticsArgs(),analyticsArgs('90',A,SLAB,1),analyticsArgs('year','','__uncategorized__',5)])assert(validateStrictSchema(args,tool.parameters));
 for(const args of [{...analyticsArgs(),period:'all-time'},{...analyticsArgs(),limit:6},{...analyticsArgs(),sql:'select *'},{}])assert(!validateStrictSchema(args,tool.parameters));
 assert.match(LABOR_CAPABILITY.description,/Manpower Reporting Analytics/);assert.match(LABOR_CAPABILITY.description,/historical recorded labor/);assert.match(LABOR_CAPABILITY.description,/follow-ups.*re-read.*report/i);assert(LABOR_CAPABILITY.description.length<=1200);
});
await check('Analytics shares canonical Job binding: named objectives cannot read another authorized Job or silently broaden globally',async()=>{
 assert.deepEqual(explicitJobReferences(originalQuestion),[]);
 const question='Which products have most hours on the Alpha job?';assert.deepEqual(explicitJobReferences(question),['Alpha']);
 const f=fixture(),ctx={callerId:f.owner,signal:new AbortController().signal},named=createTenbotAgentJobTools(f.jobTools,undefined,{question,context:null,references:explicitJobReferences(question)}),labor=createTenbotAgentLaborTools(f.jobTools,named.recordBinding),start=f.source.calls.length;
 for(const args of [analyticsArgs('30',A),analyticsArgs('30',B),analyticsArgs()])await assert.rejects(labor.tools[0].execute(args,ctx));assert.equal(f.source.calls.length,start);
 await named.tools.find(t=>t.name==='find_jobs')!.execute({query:'Alpha',statuses:[],schedule:'all',include_archived:false,limit:20,cursor:''},ctx);
 const read=await labor.tools[0].execute(analyticsArgs('30',A),ctx),data=(read.data as unknown as LaborReportResult).data;assert.equal(data?.scope.job_id,A);
 await assert.rejects(labor.tools[0].execute(analyticsArgs('30',B),ctx));await assert.rejects(labor.tools[0].execute(analyticsArgs(),ctx));
 const global=createTenbotAgentJobTools(f.jobTools,undefined,{question:'Rank recorded labor by product.',context:null,references:[]}),globalLabor=createTenbotAgentLaborTools(f.jobTools,global.recordBinding);
 await globalLabor.tools[0].execute(analyticsArgs(),ctx);const detail=await global.tools.find(t=>t.name==='get_job_summary')!.execute({job_id:B},ctx);assert.equal((detail.data as unknown as {data:{job:{job_id:string}}}).data.job.job_id,B);
});
await check('Only the exact approved additive read descriptor preserves history scope; changed description, kind or authority invalidates it',async()=>{
 const f=fixture(),job=createTenbotAgentJobTools(f.jobTools),labor=createTenbotAgentLaborTools(f.jobTools),scope=(await createTenbotAgentScopeTool([...job.tools,...labor.tools]).execute({},{callerId:f.owner,signal:new AbortController().signal})).data as unknown as {capabilities:Record<string,unknown>[]};
 const legacy={...scope,capabilities:scope.capabilities.filter(c=>c.name!=='get_labor_analytics')},canonical=canonicalHistoryScope(legacy),entry=scope.capabilities.find(c=>c.name==='get_labor_analytics')!;assert.deepEqual(canonicalHistoryScope(scope),canonical);
 for(const changed of [{...entry,description:String(entry.description)+' Unreviewed scope change.'},{...entry,kind:'prepare'},{...entry,authority:'writeBusinessData'},{...entry,name:'other_labor_analytics'}])assert.notDeepEqual(canonicalHistoryScope({...legacy,capabilities:[...legacy.capabilities,changed]}),canonical);
 // A future live descriptor edit must not silently update its own history
 // approval pin. Restore this local metadata mutation before other checks.
 const approved=LABOR_CAPABILITY.description;
 try{LABOR_CAPABILITY.description=approved+' Unreviewed future descriptor.';assert.notDeepEqual(canonicalHistoryScope({...legacy,capabilities:[...legacy.capabilities,{...entry,description:LABOR_CAPABILITY.description}]}),canonical);}finally{LABOR_CAPABILITY.description=approved;}
});
await check('Adapter results exactly preserve dashboard aggregation, period, canonical category/Job identity and integer-hour semantics',async()=>{
 const f=fixture(),r=createTenbotAgentLaborTools(f.jobTools),value=await r.tools[0].execute(analyticsArgs(),{callerId:f.owner,signal:new AbortController().signal}),body=value.data as unknown as LaborReportResult&{answer_facts:{id:string;text:string}[]};
 assert(body.data);const expected=aggregateLabor(entries.map(e=>({...e,task:{display_name:'Finishing'}})),categories,tasks,laborPeriod(30,'2026-11-02'),null),d=body.data;
 assert.equal(d.total_hours,expected.total/100);assert.equal(d.total_hours,24);assert.equal(d.uncategorized_hours,10);assert.equal(d.unlinked_hours,.5);assert.equal(d.period.start,'2026-10-04');
 assert.equal(d.products.find(p=>p.id===SLAB)?.hours,8);assert.equal(d.jobs.find(j=>j.job_id===A)?.hours,9.5);assert.equal(d.jobs.find(j=>j.job_id===B)?.hours,14);
 assert.equal(body.answer_facts.find(f=>f.id==='product_1')?.text,'Uncategorized labor: 10 recorded hours. These entries have no saved Product Category and do not identify a product.');
 assert(!JSON.stringify(value).includes('PRIVATE_'));assert(!JSON.stringify(value).includes('accessRefs'));assert.deepEqual(r.reads()[0].result.accessRefs,[A,B]);assert(await r.fresh());
});
await check('The old unrelated future-staffing sentence is no longer issued or publishable for the historical question',async()=>{
 const f=fixture(),reply=await f.ask((request,n)=>n===1?discover('describe_assistant_scope'):n===2?step(call('scope','describe_assistant_scope',{})):literalFinal(output(request,'describe_assistant_scope'),oldDisclaimer));
 assert(f.requests.length>0,JSON.stringify({message:reply.message,reads:f.reads.length}));
 const scope=output(f.requests.at(-1)!,'describe_assistant_scope');assert(!scope.data.answer_facts.some(f=>f.text===oldDisclaimer));assert.notEqual(reply.message,oldDisclaimer);assert.match(reply.message,/verify.*reliable|couldn.t.*verify|clarify/i);noWriteCopy(reply.message);
});
await check('Multiple historical phrasings discover the same reusable Analytics operation and publish authoritative category/Job facts',async()=>{
 for(const question of [originalQuestion,'Which product has consumed the most labor hours?','Show me the products with the highest recorded labor.']){
  const f=fixture(),reply=await f.ask(analyticsPlan(['product_1','product_2','product_jobs_2']),question);
  assert.match(reply.message,/Uncategorized.*10 recorded hours/);assert.match(reply.message,/Slabs: 8 recorded hours/);assert.match(reply.message,/26-002.*Beta.*4 hours/);assert.match(reply.message,/26-001.*Alpha.*3.5 hours/);assert.match(reply.message,/Unlinked labor: 0.5 hours/);assert.match(reply.message,/2026-10-04 through 2026-11-02/);
  assert(!reply.message.includes(oldDisclaimer));noWriteCopy(reply.message);assert.equal(f.actionCalls(),0);assert(f.reads.length>=2);assert(f.reads.every(r=>r.args.period===30));examples.push({question,message:reply.message,actualModel:false});
 }
});
await check('Product→Job follow-up re-resolves current category after history reload and preserves multiple Jobs plus unlinked attribution',async()=>{
 const f=fixture(),first=await f.ask(analyticsPlan(['product_2','product_jobs_2']));assert.match(first.message,/Slabs/);
 const reopened=await f.reopen(first.conversationId);assert.equal(reopened.turns?.at(-1)?.answer.message,first.message);const start=f.reads.length;
 const followup=await f.ask((request,n)=>{
  if(n===1){assert(JSON.stringify(request.history).includes(originalQuestion));assert(!JSON.stringify(request.history).includes(first.message));return discover('get_labor_analytics');}
  if(n===2)return step(call('resolve-category','get_labor_analytics',analyticsArgs()));
  if(n===3){const row=output(request,'get_labor_analytics'),selected=row.data.data?.products.find(p=>p.label==='Slabs');assert.equal(selected?.id,SLAB);return step(call('category-jobs','get_labor_analytics',analyticsArgs('30','',selected!.id)));}
  return selectedFinal(output(request,'get_labor_analytics'),['product_1','product_jobs_1']);
 },'Which Jobs was that product for?',first.conversationId);
 assert.match(followup.message,/26-002.*Beta.*4 hours/);assert.match(followup.message,/26-001.*Alpha.*3.5 hours/);assert.match(followup.message,/Unlinked labor: 0.5 hours/);assert(f.reads.slice(start).some(r=>r.args.product_category_id===SLAB));
 assert.equal((await f.reopen(followup.conversationId)).turns?.at(-1)?.answer.message,followup.message);examples.push({question:'Which Jobs was that product for?',message:followup.message,actualModel:false});
 const comparison=await f.ask((request,n)=>n===1?discover('find_jobs','get_labor_analytics'):n===2?step(call('resolve-job','find_jobs',{query:'26-002',statuses:[],schedule:'all',include_archived:true,limit:20,cursor:''})):n===3?step(call('compare-products','get_labor_analytics',analyticsArgs('30',B))):selectedFinal(output(request,'get_labor_analytics'),['job_products_1']),'How does that compare with the other products on Job 26-002?',first.conversationId);
 assert.match(comparison.message,/26-002.*Beta/);assert.match(comparison.message,/Uncategorized: 10 hours/);assert.match(comparison.message,/Slabs: 4 hours/);assert(!comparison.message.includes('Alpha'));assert(f.reads.some(r=>r.args.job_id===B&&r.args.product_category_id===undefined));examples.push({question:'How does that compare with the other products on Job 26-002?',message:comparison.message,actualModel:false});
});
await check('The exact original→comparative follow-up discovers the leading category contributor and compares its other categories without a fabricated Job identity',async()=>{
 assert.deepEqual(explicitJobReferences(comparativeFollowup),[]);
 const f=fixture(),first=await f.ask(analyticsPlan(['product_1','product_2','product_jobs_2']),originalQuestion);
 assert.equal((await f.reopen(first.conversationId)).turns?.at(-1)?.answer.message,first.message);
 const start=f.reads.length;let categoryRow:Output|undefined;
 const followup=await f.ask((request,n)=>{
  if(n===1){assert(JSON.stringify(request.history).includes(originalQuestion));assert(!JSON.stringify(request.history).includes(first.message));return discover('get_labor_analytics');}
  if(n===2)return step(call('resolve-current-category','get_labor_analytics',analyticsArgs()));
  if(n===3){const report=output(request,'get_labor_analytics').data.data!;assert.equal(report.period.start,'2026-10-04');const category=report.products.find(p=>p.id!=='__uncategorized__');assert.equal(category?.id,SLAB);return step(call('category-contributors','get_labor_analytics',analyticsArgs('30','',category!.id)));}
  if(n===4){categoryRow=output(request,'get_labor_analytics');const category=categoryRow.data.data!.products[0];assert.equal(category.id,SLAB);assert.equal(category.contributing_jobs[0].job_id,B);assert.equal(category.contributing_jobs[0].hours,4);return step(call('compare-contributor-categories','get_labor_analytics',analyticsArgs('30',category.contributing_jobs[0].job_id)));}
  assert(categoryRow);const contributors=selectedFinal(categoryRow,['product_jobs_1']).final!,comparison=selectedFinal(output(request,'get_labor_analytics'),['job_products_1']).final!;
  return {...step(),final:{...comparison,answer:contributors.answer+' '+comparison.answer,observations:[...contributors.observations,...comparison.observations]}};
 },comparativeFollowup,first.conversationId);
 assert.match(followup.message,/26-002.*Beta.*4 hours/);assert.match(followup.message,/26-001.*Alpha.*3.5 hours/);assert.match(followup.message,/Unlinked labor: 0.5 hours/);
 assert.match(followup.message,/Product Category breakdown for 26-002.*Beta.*Uncategorized: 10 hours; Slabs: 4 hours/);assert.match(followup.message,/2026-10-04 through 2026-11-02/);
 const current=f.reads.slice(start);assert(current.some(r=>r.args.product_category_id===SLAB&&r.args.job_id===undefined));assert(current.some(r=>r.args.job_id===B&&r.args.product_category_id===undefined));assert(current.every(r=>r.args.period===30));
 assert.equal((await f.reopen(followup.conversationId)).turns?.at(-1)?.answer.message,followup.message);assert.equal(f.actionCalls(),0);noWriteCopy(followup.message);
 examples.push({question:originalQuestion,message:first.message,actualModel:false},{question:comparativeFollowup,message:followup.message,actualModel:false});
});
await check('An empty selected Job report retains canonical identity and access references so revoked Job history cannot leak its zero',async()=>{
 const f=fixture({entries:[]}),result=await f.jobTools.laborReport!({period:30,job_id:A,limit:5});assert.equal(result.status,'ok');assert.equal(result.data?.total_hours,0);assert.equal(result.data?.scope.job_reference,'26-001 — Alpha');assert.deepEqual(result.accessRefs,[A]);
 const reply=await f.ask((request,n)=>n===1?discover('find_jobs','get_labor_analytics'):n===2?step(call('resolve-job','find_jobs',{query:'26-001',statuses:[],schedule:'all',include_archived:false,limit:20,cursor:''})):n===3?step(call('empty-job','get_labor_analytics',analyticsArgs('30',A))):selectedFinal(output(request,'get_labor_analytics'),['summary','job_empty']),'Show recorded labor for Job 26-001 in the last 30 days.');
 assert.match(reply.message,/0 hours/);assert.match(reply.message,/26-001.*Alpha/);assert.equal((await f.reopen(reply.conversationId)).turns?.at(-1)?.answer.message,reply.message);
 f.hidden.add(A);const hidden=await f.reopen(reply.conversationId);assert(!hidden.turns?.some(t=>t.answer.message===reply.message&&t.answer.history?.state==='verified'));
});
await check('Cross-Job hours and alternative periods reuse the same report rather than adding question handlers',async()=>{
 const f=fixture(),reply=await f.ask(analyticsPlan(['job_ranking'],analyticsArgs('90')),'Which Jobs have the most recorded hours in the last 90 days?');
 assert.match(reply.message,/26-001.*Alpha.*29.5 hours/);assert.match(reply.message,/26-002.*Beta.*14 hours/);assert.match(reply.message,/2026-08-05 through 2026-11-02/);assert(f.reads.every(r=>r.args.period===90));noWriteCopy(reply.message);examples.push({question:'Which Jobs have the most recorded hours in the last 90 days?',message:reply.message,actualModel:false});
});
await check('Incomplete, empty and inaccessible report selections stay distinct and cannot fabricate a maximum',async()=>{
 for(const f of [fixture({fault:'short'}),fixture({entries:[]})]){
  const incomplete=await f.jobTools.laborReport!({period:30,limit:5});const expected=incomplete.complete?['product_empty']:['labor_unavailable'];
  const reply=await f.ask(analyticsPlan(expected),'Show the highest recorded Product Category labor.');
  assert(!/Product Category Slabs:|Beta: 0|highest.*0/i.test(reply.message));assert.match(reply.message,incomplete.complete?/No positive recorded/:/could not verify complete|complete.*could not/i);noWriteCopy(reply.message);
 }
 const missing=fixture();await assert.rejects(missing.ask(analyticsPlan(['labor_unavailable'],analyticsArgs('30','', '10000000-0000-4000-8000-000000999999')),'Read this unavailable reporting category.'),/permissions|access|underlying records/i);
});
await check('Permission loss or revoked contributing Job access prevents publication and later private-history disclosure',async()=>{
 const f=fixture();await assert.rejects(f.ask((request,n)=>{if(n===1)return discover('get_labor_analytics');if(n===2)return step(call('labor','get_labor_analytics',analyticsArgs()));f.setReportAllowed(false);return selectedFinal(output(request,'get_labor_analytics'),['product_2']);}),/access|authorized|underlying records/i);
 const revoked=fixture(),reply=await revoked.ask(analyticsPlan(['product_2']));revoked.hidden.add(B);const restored=await revoked.reopen(reply.conversationId);assert(!restored.turns?.some(t=>t.answer.message===reply.message&&t.answer.history?.state==='verified'));
 const stale=fixture(),registry=createTenbotAgentLaborTools(stale.jobTools);await registry.tools[0].execute(analyticsArgs(),{callerId:stale.owner,signal:new AbortController().signal});stale.setReportAllowed(false);assert.equal(await registry.fresh(),false);
});
await check('Existing Job reads and action registration remain compatible without executing or broadening business actions',async()=>{
 const f=fixture(),reply=await f.ask((request,n)=>n===1?discover('find_jobs','get_job_summary'):n===2?step(call('lookup','find_jobs',{query:'26-001',statuses:[],schedule:'all',include_archived:false,limit:20,cursor:''})):n===3?step(call('summary','get_job_summary',{job_id:A})):selectedFinal(output(request,'get_job_summary'),['job_status']),'What is the current status of Job 26-001?');
 assert.match(reply.message,/26-001.*Alpha/);assert.match(reply.message,/Complete/);assert.equal(f.actionCalls(),0);assert.equal(f.reads.length,0);
 const scope=await f.ask((request,n)=>{if(n===1)return discover('describe_assistant_scope');if(n===2)return step(call('scope','describe_assistant_scope',{}));const row=output(request,'describe_assistant_scope');assert(row.data.answer_facts.length);return selectedFinal(row,[row.data.answer_facts[0].id]);},'What can you execute?');void scope;
 const registered=output(f.requests.at(-1)!,'describe_assistant_scope').data.capabilities??[];assert(registered.some(t=>t.name==='prepare_proposal_draft'));assert(registered.some(t=>t.name==='get_labor_analytics'));assert.equal(f.actionCalls(),0);
});

console.log(JSON.stringify({passed:true,before:false,groups:checks.length,checks,examples,releasedAgentSha,actualInference:false,paidRequests:0,networkCalls:0,databaseCalls:0,limitation:'Scripted provider choices exercise real existing registry, report calculation, publication and private-history code over synthetic RPC/query fixtures. This does not prove genuine Terra operation selection, hosted Auth/RLS or database state.'},null,2));
