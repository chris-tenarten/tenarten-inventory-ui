/** Focused A–H regression. Real hosted/session/tool implementations, synthetic
 * RPC/PostgREST/model transport. Not live inference or new JWT/RLS certification. */
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {uuid} from './support/wave2-fixture.mjs';
import {createContextFixture as fixture} from './support/tenbot-context-fixture.mjs';
import {contextFromReads,contextLive,validConversationContext,CONTEXT_TTL_MS} from '../supabase/functions/_shared/tenbot-conversation-context';
import {validateStoredAgentState} from '../supabase/functions/_shared/tenbot-agent-history-store';
import {createTenbotAgentSessions} from '../supabase/functions/_shared/tenbot-agent-session';
import type {AgentProvider,AgentStep} from '../supabase/functions/_shared/tenbot-agent';
const checks:string[]=[],examples:unknown[]=[];const check=async(name:string,run:()=>Promise<void>)=>{await run();checks.push(name);};
await check('A Production count → Which ones reuses scope and freshly reads actual five-tool executor',async()=>{
 const f=fixture(),a=await f.ask('How many active jobs are in Production?'),id=String(a.conversationId);assert.match(String(a.message),/8/);assert.equal(f.row(id).state.context?.subject,'Production');
 const before=f.trace.length,b=await f.ask('Which ones?',id);assert(f.trace.slice(before).some(x=>x.table==='jobs'));assert.match(String(b.message),/CTX-1/);assert(!String(b.message).includes('CTX-9'));assert(!String(b.message).includes('Which Production Job'));
 const saved=JSON.stringify(f.row(id).state);assert(!saved.includes('Context Alpha'));assert(!saved.includes('Active Production Jobs: 8'));assert.equal(f.state.providerCalls,0);examples.push({case:'A',first:a.message,followUp:b.message});
});
await check('B named Job → labor retains canonical identity, requeries totals and never retains results',async()=>{
 const f=fixture(),a=await f.ask('What is the status of Job "Context Alpha"?'),id=String(a.conversationId);assert.deepEqual(f.row(id).state.context?.references,[f.tables.jobs[0].id]);
 const b=await f.ask('How many hours on that job?',id);assert.match(String(b.message),/5/);assert(f.trace.some(x=>x.table==='manpower_entries'));const saved=JSON.stringify(f.row(id).state);assert(!saved.includes('total_hours'));assert(!saved.includes('Context Alpha'));examples.push({case:'B',followUp:b.message});
 await f.ask('How many hours on that job on 2026-10-30?',id);await f.ask('Is it still on hold?',id);assert.equal(f.row(id).state.context?.selection.startDate,'2026-10-30');const again=await f.ask('Can you break its labor down?',id);assert.match(String(again.message),/2026-10-30 through 2026-10-30/);
});
await check('C original Bid remains a knowledge follow-up, never an invented relationship/tool',async()=>{
 const f=fixture(),a=await f.ask('What is the status of Job "Context Alpha"?'),before=f.trace.length,b=await f.ask('What about the original Bid?',String(a.conversationId));
 assert(!String(b.message).includes('Which Production Job'));assert(f.trace.slice(before).every(x=>['jobs','production_rework_cycles','job_updates','has_app_capability'].includes(x.table)));assert.deepEqual(f.row(String(a.conversationId)).state.context?.references,[f.tables.jobs[0].id]);assert(!JSON.stringify(f.row(String(a.conversationId)).state).includes('bid_id'));examples.push({case:'C',answer:b.message,relationshipReadAvailable:false});
});
await check('D Intake walkthrough and next-step context restore without provider invocation',async()=>{
 const f=fixture(),a=await f.ask('How do I convert a Won Bid to Production?'),id=String(a.conversationId);assert.equal(f.row(id).state.context?.subject,'Intake');const old=f.state.qwenCalls;
 const h=await f.run()({action:'history',conversationId:id}) as {turns:unknown[]};assert(h.turns.length>0);assert.equal(f.state.qwenCalls,old);
 await f.ask("What's next?",id);const sent=JSON.stringify(f.state.qwenRequests.at(-1));assert.match(sent,/Intake/);assert.match(sent,/Conversation context/);assert(!sent.includes('total_hours'));
});
await check('E Inventory → incoming retains verified module context without enabling inventory reads/writes',async()=>{
 const f=fixture(),a=await f.ask('What does Inventory show?'),id=String(a.conversationId);assert.equal(f.row(id).state.context?.subject,'Inventory');await f.ask('What about the incoming?',id);assert.equal(f.trace.length,0);assert.match(JSON.stringify(f.state.qwenRequests.at(-1)),/Inventory/);
});
await check('F reopening on another handler preserves topic, identity and TTL without inference',async()=>{
 const f=fixture(),a=await f.ask('What is the status of Job "Context Alpha"?'),id=String(a.conversationId),expiry=f.row(id).state.context!.expiresAt,calls=f.state.qwenCalls;
 f.state.now+=1000;await f.run()({action:'history',conversationId:id});assert.equal(f.state.qwenCalls,calls);assert.equal(f.row(id).state.context!.expiresAt,expiry);
 const b=await f.ask('Is it still on hold?',id);assert(!String(b.message).includes('Which Production Job'));assert.match(String(b.message),/In Production/);
});
await check('G record and account revocation clear seeds or deny; legacy markers cannot resurrect them',async()=>{
 const f=fixture(),a=await f.ask('What is the status of Job "Context Alpha"?'),id=String(a.conversationId);f.hidden.add(f.tables.jobs[0].id);
 const b=await f.ask('How many hours on that job?',id);assert(!String(b.message).includes('Context Alpha'));assert(!f.row(id).state.context?.references.length);f.state.allowed=false;await assert.rejects(f.run()({action:'history',conversationId:id}),/not authorized/);
});
await check('H expired references, ambiguity, untrusted fields and arbitrary live payloads fail closed',async()=>{
 const f=fixture(),a=await f.ask('What is the status of Job "Context Alpha"?'),id=String(a.conversationId);f.state.now+=CONTEXT_TTL_MS+1;const b=await f.ask('How many hours on that job?',id);assert.match(String(b.message),/Which Production Job/);assert(!f.row(id).state.context);
 await assert.rejects(f.run()({action:'ask',question:'Which ones?',conversationContext:{subject:'Job',references:[f.tables.jobs[0].id]}}),/Invalid/);
 const c=contextFromReads([{name:'get_job_summary',args:{job_id:uuid(1)},result:{status:'ok',complete:true,data:{job:{job_id:uuid(1)}},filters:{}} as never}], 'status',f.state.now)!;
 assert(validConversationContext(c));assert(!validConversationContext({...c,liveFacts:{hours:5}}));assert(!validConversationContext({...c,expiresAt:new Date(f.state.now+CONTEXT_TTL_MS+1).toISOString()}));assert(!contextLive(structuredClone(c),f.state.now+CONTEXT_TTL_MS));assert(!validateStoredAgentState({guidance:[],display:[],context:{...c,sql:'select *'}}));
 f.row(id).state.context={...c,references:[f.tables.jobs[0].id,f.tables.jobs[1].id]};f.row(id).expires=f.state.now+3600000;f.hidden.clear();const ambiguous=await f.ask('How many hours on that job?',id);assert.match(String(ambiguous.message),/Which of the previously discussed/);
});
await check('retained collection context cannot bypass financial restrictions or persistence failures',async()=>{
 const f=fixture(),a=await f.ask('How many active Jobs are there?'),id=String(a.conversationId),before=f.trace.length;
 const b=await f.ask('Which ones have private costs?',id);assert.match(String(b.message),/does not retrieve financial/);assert.equal(f.trace.length,before);
 const failed=fixture();failed.state.commitFailure=true;await assert.rejects(failed.ask('How many active Jobs are there?'),/changed or access expired/);assert.equal([...failed.rows.values()][0].claim,null);assert.equal(failed.state.providerCalls,0);
});
await check('Qwen source permission revoked during inference cannot publish or retain its answer',async()=>{
 const f=fixture();f.state.qwenPause=async()=>{f.state.groupAllowed=false;};
 await assert.rejects(f.ask('How do I create a group conversation?'),/No answer was published/);const row=[...f.rows.values()][0];assert.equal(row.claim,null);assert.deepEqual(row.state.display,[]);assert.deepEqual(row.state.guidance,[]);assert.equal(f.state.providerCalls,0);
});
await check('Terra orchestration receives only selectors after instance restoration, not prior live answers',async()=>{
 const f=fixture();let step=0;const seen:string[]=[];const usage={inputTokens:0,cachedInputTokens:0,outputTokens:0,costUsd:0,reservedUsd:0};
 const provider:AgentProvider={name:'OFFLINE context transport',model:'offline-no-inference',async step(request){seen.push(JSON.stringify(request.history));step++;const call=(name:string,args:Record<string,unknown>)=>({calls:[{id:crypto.randomUUID(),name,arguments:args as never}],continuation:[],usage});
  if(step%3===1)return call('discover_capabilities',{names:['get_job_summary']});if(step%3===2)return call('get_job_summary',{job_id:f.tables.jobs[0].id});return{calls:[],continuation:[],usage,final:{answer:'LIVE_PRIVATE_SENTINEL',observations:[{text:'LIVE_PRIVATE_SENTINEL',evidence_ids:['e1']}],inferences:[],recommendations:[],questions:[],completed_actions:[]}} as AgentStep;
 }};
 const {createTenbotAgentHistoryStore}=await import('../supabase/functions/_shared/tenbot-agent-history-store');const run=()=>createTenbotAgentSessions({mode:'openai',readOnlyHosted:true,sessionStore:createTenbotAgentHistoryStore(f.caller,f.service),can:async()=>true,jobTools:()=>f.state.jobTools!,provider:()=>provider,now:()=>f.state.now});
 const a=await run()({action:'ask',question:'Status of Context Alpha'},f.owner) as {conversationId:string};await run()({action:'ask',question:'How many hours on that job?',conversationId:a.conversationId},f.owner);
 assert(seen[3].includes(f.tables.jobs[0].id));assert(!seen[3].includes('LIVE_PRIVATE_SENTINEL'));assert(!JSON.stringify(f.row(a.conversationId).state).includes('LIVE_PRIVATE_SENTINEL'));assert.equal(f.state.providerCalls,0);
});
const result={passed:true,groups:checks.length,checks,examples,mode:'actual hosted/session and authorized tool implementations with synthetic RPC/PostgREST and scripted model transports',actualPaidInference:false,realDatabase:false,productionCalls:0};if(process.env.TENBOT_CONTEXT_EVIDENCE)writeFileSync(process.env.TENBOT_CONTEXT_EVIDENCE,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
