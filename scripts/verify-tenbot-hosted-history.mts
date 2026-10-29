import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTenbotAgentSessions,HostedAgentUnavailable} from '../supabase/functions/_shared/tenbot-agent-session';
import {createTenbotAgentHistoryStore,validateStoredAgentState,type AgentHistoryRpc,type StoredAgentState} from '../supabase/functions/_shared/tenbot-agent-history-store';
import {AgentStepError,type AgentProvider,type AgentStep,type AgentFinal,type AgentStepRequest} from '../supabase/functions/_shared/tenbot-agent';
import type {JobToolResult} from '../supabase/functions/_shared/tenbot-job-tools';
// Offline API/state-machine doubles only. Not PostgreSQL/RLS certification.
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',jobId='33333333-3333-4333-8333-333333333333';
const checks:string[]=[];const check=async(name:string,run:()=>Promise<void>)=>{await run();checks.push(name);};
const copy=<T,>(value:T):T=>structuredClone(value);
let clock=Date.now();
type Row={owner:string;state:StoredAgentState;revision:number;claim:string|null;until:number;expires:number};
class Fixture{
 rows=new Map<string,Row>();calls:{kind:string;name:string;args:Record<string,unknown>}[]=[];deny=false;failCommit=false;failRelease=false;afterCommit:(()=>void)|undefined;
 rpc(actor:string,kind:'caller'|'service'):AgentHistoryRpc{return async(name,args={})=>{
  this.calls.push({kind,name,args:copy(args)});const id=String(args.p_conversation_id),row=this.rows.get(id);const ok=(data:unknown)=>({data,error:null});
  if(name==='tenbot_agent_claim'){
   assert.equal(kind,'caller');if(this.deny)return ok({ok:false});
   let key=id,current=row;
   if(args.p_conversation_id===null){key=crypto.randomUUID();current={owner:actor,state:{guidance:[],display:[]},revision:0,claim:null,until:0,expires:clock+3600000};this.rows.set(key,current);}
   if(!current||current.owner!==actor||current.expires<=clock)return ok({ok:false});
   if(current.claim&&current.until>clock)return ok({ok:false,reason:'busy'});
   current.claim=crypto.randomUUID();current.until=clock+120000;
   return ok({ok:true,id:key,ownerId:actor,revision:current.revision,claim:current.claim,expiresAt:new Date(current.expires).toISOString()});
  }
  if(name==='tenbot_agent_load'){assert.equal(kind,'service');return ok(row&&row.owner===args.p_user&&row.claim===args.p_claim&&row.revision===args.p_revision&&row.until>clock&&!this.deny?copy(row.state):null);}
  if(name==='tenbot_agent_commit'){
   assert.equal(kind,'service');if(this.deny||this.failCommit||!row||row.owner!==args.p_user||!row.claim||row.claim!==args.p_claim||row.revision!==args.p_revision||row.until<=clock)return ok(false);
   assert.ok(validateStoredAgentState(args.p_state));row.state=copy(args.p_state);row.revision++;row.claim=null;if(args.p_renew)row.expires=clock+3600000;this.afterCommit?.();return ok(true);
  }
  if(name==='tenbot_agent_release'){assert.equal(kind,'caller');if(this.failRelease||this.deny)return ok(false);if(!row||row.owner!==actor)return ok(true);if(row.claim===args.p_claim&&row.revision===args.p_revision){row.claim=null;return ok(true);}return ok(row.claim===null);}
  if(name==='tenbot_agent_clear'){assert.equal(kind,'caller');if(!row||row.owner!==actor||this.deny)return ok(false);this.rows.delete(id);return ok(true);}
  throw Error('Unexpected RPC '+name);
 };}
 store(actor=owner){return createTenbotAgentHistoryStore(this.rpc(actor,'caller'),this.rpc(actor,'service'));}
}
const usage={inputTokens:1,cachedInputTokens:0,outputTokens:1,costUsd:0,reservedUsd:0};
const final=(answer='Choose New group from Messaging.'):AgentFinal=>({answer,observations:[{text:answer,evidence_ids:['e1']}],inferences:[],recommendations:[],questions:[],completed_actions:[]});
const modelStep=(calls:AgentStep['calls'],value?:AgentFinal):AgentStep=>({calls,...(value?{final:value}:{}),continuation:[{opaque:'UNRETAINED_NATIVE_CONTINUATION'}],usage});
const call=(id:string,name:string,args:Record<string,string|string[]>={})=>({id,name,arguments:args});
let providerCalls=0;const seen:AgentStepRequest[]=[];
const provider=(kind:'knowledge'|'job'|'unavailable'='knowledge'):AgentProvider=>{
 let index=0;
 return {name:'Offline hosted history verifier',model:'offline-no-inference',async step(request){
  providerCalls++;seen.push({...request,history:copy(request.history),tools:copy(request.tools)});if(kind==='unavailable')throw new AgentStepError('provider-http-error');
  const tool=kind==='job'?'get_job_summary':'search_workflow_knowledge';
  if(++index===1)return modelStep([call('discover','discover_capabilities',{names:[tool]})]);
  if(index===2)return modelStep([call('read',tool,kind==='job'?{job_id:jobId}:{query:'create group conversation'})]);
  return modelStep([],final(kind==='job'?'PRIVATE_JOB_EVIDENCE':'Choose New group from Messaging.'));
 }};
};
const jobResult={tool:'get_job_summary',version:'tenbot-job-read.v1',status:'ok',complete:true,truncated:false,unknowns:[],filters:{},data:{job:{job_id:jobId,name:'PRIVATE_JOB_EVIDENCE'}}} as unknown as JobToolResult;
const make=(fixture:Fixture,options:{actor?:string;kind?:'knowledge'|'job'|'unavailable';can?:(cap:string)=>boolean;job?:()=>JobToolResult;provider?:()=>AgentProvider}={})=>createTenbotAgentSessions({mode:'openai',readOnlyHosted:true,sessionStore:fixture.store(options.actor),can:async(_owner,cap)=>!fixture.deny&&(options.can?.(cap)??true),jobTools:()=>({async execute(){return copy(options.job?.()??jobResult);}}),provider:options.provider??(()=>provider(options.kind)),now:()=>clock});
const ask=(run:ReturnType<typeof make>,conversationId?:string,actor=owner)=>run({action:'ask',question:'Help me use Messaging',context:[],...(conversationId?{conversationId}:{})},actor) as Promise<Record<string,unknown>>;
await check('claims expose only metadata; proof-bearing raw history loads through service-only RPC',async()=>{
 const db=new Fixture(),store=db.store(),lease=await store.claim(owner);assert.equal(lease.owner,owner);assert.deepEqual(lease.state,{guidance:[],display:[]});
 assert.deepEqual(db.calls.map(item=>[item.kind,item.name]),[['caller','tenbot_agent_claim'],['service','tenbot_agent_load']]);await store.release(lease);
});
await check('eligible answer survives a different server instance and history invokes no inference or expiry renewal',async()=>{
 const db=new Fixture(),first=await ask(make(db)),id=String(first.conversationId);assert.equal(first.mode,'assistant');assert.equal(first.contentScope,'workflow');
 for(const key of ['agent','modelSteps','invoiceAttached','executionAvailable'])assert.ok(!(key in first));
 const expiry=db.rows.get(id)!.expires,before=providerCalls;clock+=1000;
 const restored=await make(db)({action:'history',conversationId:id},owner) as {mode:string;turns:{answer:{message:string}}[]};
 assert.equal(restored.mode,'assistant');assert.equal(restored.turns[0].answer.message,first.message);assert.equal(providerCalls,before);assert.equal(db.rows.get(id)!.expires,expiry);
 const native=JSON.stringify(db.rows.get(id)!.state);assert.ok(!native.includes('UNRETAINED_NATIVE_CONTINUATION'));
});
await check('live Job results, questions, lookup seeds and provider-native state are absent from durable history',async()=>{
 const db=new Fixture(),first=await ask(make(db,{kind:'job'}));assert.equal(first.contentScope,'volatile');const state=db.rows.get(String(first.conversationId))!.state;
 assert.deepEqual(state,{guidance:[],display:[]});assert.ok(!JSON.stringify(state).includes('PRIVATE_JOB_EVIDENCE'));assert.ok(!JSON.stringify(state).includes(jobId));
});
await check('cross-owner access and revoked base permission cannot hydrate history',async()=>{
 const db=new Fixture(),first=await ask(make(db)),id=String(first.conversationId);
 await assert.rejects(make(db,{actor:other})({action:'history',conversationId:id},other),/unavailable/);db.deny=true;
 await assert.rejects(make(db)({action:'history',conversationId:id},owner),/not authorized/);
});
await check('source proof changes are pruned across instances before display and model context',async()=>{
 const db=new Fixture(),first=await ask(make(db)),id=String(first.conversationId),row=db.rows.get(id)!;
 row.state.display[0].sources[0].digest='f'.repeat(64);row.state.guidance[0].sources[0].digest='f'.repeat(64);
 const restored=await make(db)({action:'history',conversationId:id},owner) as {turns:unknown[]};assert.deepEqual(restored.turns,[]);
 const before=seen.length;await ask(make(db),id);assert.ok(!JSON.stringify(seen[before].history).includes('Prior assistant workflow guidance'));
});
await check('concurrent claim refuses a second instance and lease/revision replay cannot commit',async()=>{
 const db=new Fixture(),a=db.store(),b=db.store(),first=await a.claim(owner);await assert.rejects(b.claim(owner,first.id),/already running/);
 clock+=120001;const second=await b.claim(owner,first.id);await assert.rejects(a.commit(first,{guidance:[],display:[]},true),/changed or access expired/);
 await b.commit(second,{guidance:[],display:[]},true);await assert.rejects(b.commit(second,{guidance:[],display:[]},true),/changed or access expired/);
});
await check('clear invalidates in-flight immutable claim and late completion cannot resurrect a conversation',async()=>{
 const db=new Fixture(),a=db.store(),lease=await a.claim(owner);await db.store().clear(owner,lease.id);
 await assert.rejects(a.commit(lease,{guidance:[],display:[]},true),/changed or access expired/);assert.equal(db.rows.size,0);await a.release(lease);
});
await check('provider fallback error is thrown only after lease release; persistence failure never becomes fallback',async()=>{
 const db=new Fixture();let error:unknown;try{await ask(make(db,{kind:'unavailable'}));}catch(value){error=value;}
 assert.ok(error instanceof HostedAgentUnavailable);assert.equal(db.rows.get(error.conversationId)!.claim,null);assert.equal(error.reason,'provider-http-error');
 db.failCommit=true;await assert.rejects(ask(make(db)),value=>value instanceof Error&&!(value instanceof HostedAgentUnavailable)&&/changed or access expired/.test(value.message));
 const releaseFailed=new Fixture();releaseFailed.failRelease=true;await assert.rejects(ask(make(releaseFailed,{kind:'unavailable'})),value=>value instanceof Error&&!(value instanceof HostedAgentUnavailable)&&/release is unavailable/.test(value.message));
});
await check('one-hour expiry remains strict and hosted requests cannot acquire invoice or execution capabilities',async()=>{
 const db=new Fixture(),first=await ask(make(db)),id=String(first.conversationId);clock+=3600001;
 await assert.rejects(make(db)({action:'history',conversationId:id},owner),/unavailable/);
 for(const body of [{action:'approve'},{action:'ask',question:'Create entries',invoiceId:'synthetic'},{action:'ask',question:'Approved',orderDetails:{}},{action:'ask',question:'Hi',history:[]}])await assert.rejects(make(db)(body,owner),/Invalid|No execution/);
 assert.ok(seen.every(request=>!request.instructions.includes('"name":"prepare_pending_receivals"')&&!request.instructions.includes('"name":"search_catalog"')));
});
await check('an account revoked while ask/history commit returns cannot receive an answer or fallback',async()=>{
 for(const action of ['ask','history']){
  const db=new Fixture(),first=action==='history'?await ask(make(db)):null,before=providerCalls;
  db.afterCommit=()=>{db.deny=true;};
  await assert.rejects(action==='ask'?ask(make(db)):make(db)({action:'history',conversationId:String(first!.conversationId)},owner),value=>value instanceof Error&&!(value instanceof HostedAgentUnavailable)&&'status' in value&&value.status===403&&/No answer was published/.test(value.message));
  if(action==='history')assert.equal(providerCalls,before);
 }
});
await check('source grants revoked during ask/history commit cannot publish source-derived prose',async()=>{
 for(const action of ['ask','history']){
  let sourceAllowed=true;const db=new Fixture(),options={can:(cap:string)=>cap==='readOperationalData'||sourceAllowed};
  const first=action==='history'?await ask(make(db,options)):null;db.afterCommit=()=>{sourceAllowed=false;};
  await assert.rejects(action==='ask'?ask(make(db,options)):make(db,options)({action:'history',conversationId:String(first!.conversationId)},owner),value=>value instanceof Error&&!(value instanceof HostedAgentUnavailable)&&'status' in value&&value.status===403);
 }
});
await check('Job facts changed while durable commit returns are re-read and cannot be published',async()=>{
 const db=new Fixture();let changed=false,reads=0;db.afterCommit=()=>{changed=true;};
 await assert.rejects(ask(make(db,{kind:'job',job:()=>{reads++;const result=copy(jobResult);if(changed)(result.data as {job:{name:string}}).job.name='CHANGED_AFTER_COMMIT';return result;}})),value=>value instanceof Error&&!(value instanceof HostedAgentUnavailable)&&'status' in value&&value.status===403);
 assert.equal(reads,3);assert.deepEqual([...db.rows.values()][0].state,{guidance:[],display:[]});
});
await check('schema contracts prohibit raw client state publication and bind service writes to active owner/claim/revision',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20261029221000_tenbot_agent_history.sql',import.meta.url),'utf8');
 assert.match(sql,/references public\.tenbot_conversations\(id\) on delete cascade/);assert.match(sql,/revoke all on public\.tenbot_agent_history from public,anon,authenticated,service_role/);
 assert.match(sql,/grant execute on function public\.tenbot_agent_load\(uuid,uuid,uuid,integer\),public\.tenbot_agent_commit.*to service_role/);
 assert.match(sql,/set lock_timeout='2s'/);assert.ok(!sql.includes('now()'));assert.match(sql,/c\.version is distinct from p_revision/);assert.match(sql,/s\.claim_token is distinct from p_claim/);assert.match(sql,/u\.is_active and rc\.capability='readOperationalData'/);
 const claim=sql.slice(sql.indexOf('create function public.tenbot_agent_claim'),sql.indexOf('create function public.tenbot_agent_load'));assert.ok(!claim.includes("'state',s.state"));
 assert.equal(validateStoredAgentState({guidance:[],display:[],tool_result:'private'}),false);
});
console.log(JSON.stringify({status:'pass',groups:checks.length,checks,mode:'offline server/store contract doubles and schema inspection; not hosted JWT/RLS/database certification',inference_calls:0,database_writes:0},null,2));
