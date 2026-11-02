/** One authorized, isolated two-task Terra comparison. No ordinary spending gate,
 * hosted meter, fixture setup, SQL, business write or persistent history write.
 * Execute only from the pinned 179e74b archive with the reviewed evaluation delta.
 * Importing/planning this script does not read credentials or open the journal. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID,type BinaryLike} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import type {AgentProvider,AgentStep,AgentStepRequest} from '../supabase/functions/_shared/tenbot-agent';
import type {AgentSessionStore,StoredAgentState} from '../supabase/functions/_shared/tenbot-agent-history-store';
import type {JobToolCaller,JobFacts,JobToolResult,TenbotJobToolName} from '../supabase/functions/_shared/tenbot-job-tools';
import type {InvestigationDiagnostic} from '../supabase/functions/_shared/tenbot-investigation-diagnostics';
import {openScopedEvaluationBudget,FIXED_RUN_ID,FIXED_TASK_IDS} from './support/tenbot-scoped-evaluation-budget.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const ARCHIVE='/private/tmp/tenops-tenbot-terra-limited-evaluation-20261101/candidate';
const BASELINE='/private/tmp/tenops-tenbot-consolidated-production-20261101/candidate';
const ACCEPTED='179e74b91649fd9ea52ac79fdc8ed7518a7d8f75';
const PRODUCTION='e71bd981a583e0a4e706f9953c6cc1fcc4d576e1';
const REF='jltgxcfiprocydhbrahz',ORIGIN='https://'+REF+'.supabase.co';
const FIXTURE_CONFIG='/private/tmp/tenops-tenbot-hosted-adapter-20261029/free-project-credentials.private.json';
const KEY_FILE='/Users/chrisngo/source/repos/tenarten-inventory-ui/.env.tenbot.local';
const JOURNAL='/private/tmp/tenops-tenbot-agent-poc/openai-budget.json';
const MODEL='gpt-6.1-terra' as const,ENDPOINT='https://api.openai.com/v1/responses';
const LIMITS={maxRounds:6,maxCalls:10,maxCallsPerRound:4,maxOutputTokens:640,maxDurationMs:75000};
const PERIOD={start_date:'2026-10-01',end_date:'2026-10-31'};
const PINNED_PRICE={inputPerMillion:1,cachedInputPerMillion:0.05,cacheWritePerMillion:1.25,outputPerMillion:5};
// Full local runtime import closure, including the inert invoice helper imports.
const PINS:Record<string,string>={
 'supabase/functions/_shared/tenbot-agent-session.ts':'16bdfc1401ef8336f5011b3122be7e045d39a599f2d239bb97db1ea15ad5c367',
 'supabase/functions/_shared/tenbot-history-scope.ts':'0fe4161be9c6bb7e4ce73833eabdfc283356d29ca40b20b69dfd7b0833211201',
 'supabase/functions/_shared/tenbot-agent.ts':'f127eedc748afb81a953fd0c15603ccae30c66ddb58ece370f9ba774e576cf98',
 'supabase/functions/_shared/tenbot-investigation-diagnostics.ts':'84a4d315742e76458bdb6ff840fbaaa195089ac2ddec5184468847abde85379d',
 'supabase/functions/_shared/tenbot-agent-operations.ts':'6c2b95c2e47a8cd7b3c7ff65947a30ed3bc2c4bb766dd220e442db9ad78f22c8',
 'supabase/functions/_shared/tenbot-job-session.ts':'718205cdbd37b07c23ee467cfab61160464093b1aeb73b4a06728bfb39c6ad35',
 'supabase/functions/_shared/tenbot-job-routing.ts':'98d4d02ea068cfd4e829beabc04361dcdee3c7d4af6837513ba59f2ff956a384',
 'supabase/functions/_shared/tenbot-job-tools.ts':'5ab6a975b2295403cd712bf98db00f925896915f77c14be513ef608722a7dbea',
 'supabase/functions/_shared/production-job-facts.mjs':'ef01a0c8b341fca3c2762128f08fad3598678de007573abded12b8bc00b47f39',
 'supabase/functions/_shared/labor-hours.mjs':'fe42f91ba1e2610e4e771adc8f29721222dd9662919849df15088cd5c99261ab',
 'supabase/functions/_shared/tenbot-job-filters.ts':'7ec39eff8077d9663e4d02e42b3fe1dec150df8c985b4cbb9f9a8d7838e1a465',
 'supabase/functions/_shared/tenbot-conversation-context.ts':'209ec2c0ffea93b5891c65ea3a29efc4d7301c335fb9dd7df7ae29489790e077',
 'supabase/functions/_shared/tenbot-job-presentation.ts':'9bbe435ea42429aa71edf94fdd92f73815f4d4d64ddcda03451ce6c22f28084b',
 'supabase/functions/_shared/tenbot-knowledge.ts':'b145b092f1f54c367a0cf03ba0d3543cefa46290da356320a84027869f67599e',
 'supabase/functions/_shared/tenbot-knowledge-snapshot.ts':'18f2fe94caa69c85292ea91290a3a26ddb085a9757aed65730c437e8d01946b9',
 'supabase/functions/_shared/tenbot-workflow-supplement.ts':'7bed56259d1969c0c2cdc68ff68f6491d920dfb4d2d233b45b4a8223e35e4eec',
 'supabase/functions/_shared/tenbot-agent-knowledge.ts':'cf16874ea61a2ddc637561699826f4e37e024829c2b7beb450afcf3ddd8ef027',
 'supabase/functions/_shared/tenbot-read-investigation.ts':'632f906c0ae5d3c7b9e7c1b632dad2768ebf8e028598ec83adfcb7e2ba699ed1',
 'supabase/functions/_shared/tenbot-core.ts':'a29c355acb7705a244a96e2d7da4fcff2836d7aa12e7976b3de6986849b026ea',
 'supabase/functions/_shared/tenbot-privacy.ts':'0003b5a33f3a400f380cf923d7850bb6711755fcdaff8a37b4c1a616e8034ecf',
 'supabase/functions/_shared/tenbot-models.ts':'cbf127a0692b07053021e72e4331ced03ecf820e35b12a851a18554d813e915f',
 'supabase/functions/_shared/tenbot-invoice.ts':'9e60c5101092678155920c008691420100e69d032f1aa8c544e28499d52684d1',
 'src/modules/purchasing/catalog-records.ts':'7190bf30a6a1649f645c617ffdb897e58fc30973896f30eff330a219584a76b6',
 'src/modules/purchasing/types.ts':'a6be28e38ddae330d6de9f7642b37aafbd206a1e9dc9e40b723e4cee37679402',
 'supabase/functions/_shared/pdf-text-size.mjs':'b887ea8566d7bcfd21a694cc8b633aabd970090b7bc279f72621eae30629daef',
 'src/modules/inventory/invoice-quantity.ts':'6e694e30d1ad871568bf47a215e52b495fc504bb2de9c376f4b35eff70a5d92c',
 'supabase/functions/_shared/tenbot-agent-history-store.ts':'a4b504e0ed0d5a1591286c6f1bc85106e2de438cf19ae2e28a247d7eb1231481',
 'supabase/functions/_shared/tenbot-operational-history.ts':'4ff3e8caf4f9a33d6be6d8b1e518f95a7797a42b9bddb2d9240bcd0756a24c9a',
 'supabase/functions/_shared/tenbot-employee-history.ts':'f4d4661292b2f2e3c6dfc17eb29cbef9e120d3142538b3e09b5233101c7c5981',
 'supabase/functions/_shared/tenbot-openai.ts':'15beeaa80b55725f6984616d58fbc9253834ecc12939991250d20934327f846a',
};
const BASELINE_PINS:Record<string,string>=Object.fromEntries([
 'tenbot-job-tools.ts','production-job-facts.mjs','labor-hours.mjs','tenbot-job-filters.ts',
 'tenbot-conversation-context.ts','tenbot-job-session.ts','tenbot-job-presentation.ts',
].map(file=>['supabase/functions/_shared/'+file,PINS['supabase/functions/_shared/'+file]]));
BASELINE_PINS['supabase/functions/_shared/tenbot-job-routing.ts']='66a865ed7ecbe695966158ca322c3b26b7327aed70692433d49e2f92eb2df59d';
const hash=(value:BinaryLike)=>createHash('sha256').update(value).digest('hex');
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
class EvaluationStop extends Error {constructor(readonly reason:string){super(reason);}}
function requireThat(value:unknown,reason:string):asserts value {if(!value)throw new EvaluationStop(reason);}
function ownedFile(file:string,privateOnly=false){
 const st=fs.lstatSync(file);
 requireThat(st.isFile()&&!st.isSymbolicLink()&&st.uid===process.getuid?.()&&(!privateOnly||(st.mode&0o077)===0),'owned-file-required');
 return fs.readFileSync(file,'utf8');
}
function ownedJson(file:string){let value:unknown;try{value=JSON.parse(ownedFile(file,true));}catch{throw new EvaluationStop('owner-private-json-unavailable');}requireThat(object(value),'private-config-must-be-object');return value;}
function readCredential(){
 const values=new Map<string,string>();
 for(const line of ownedFile(KEY_FILE,true).split(/\r?\n/)){
  const match=/^\s*(?:export\s+)?(TENBOT_OPENAI_API_KEY|TENBOT_OPENAI_SPEND_AUTHORIZED)\s*=\s*(.*?)\s*$/.exec(line);
  if(!match)continue;requireThat(!values.has(match[1]),'duplicate-provider-configuration');
  const quoted=/^(["'])(.*)\1$/.exec(match[2]);values.set(match[1],quoted?quoted[2]:match[2]);
 }
 requireThat(values.get('TENBOT_OPENAI_SPEND_AUTHORIZED')==='false','ordinary-spending-must-remain-false');
 const key=values.get('TENBOT_OPENAI_API_KEY');requireThat(key&&key.length>=16&&!/[\r\n]/.test(key),'existing-server-credential-unavailable');return key;
}
const bounded=(value:unknown,limit=20000)=>{const raw=JSON.stringify(value??null);return raw.length<=limit?value??null:{omitted:true,bytes:Buffer.byteLength(raw),sha256:hash(raw)};};
const safeCode=(value:unknown)=>typeof value==='string'&&/^[a-zA-Z0-9_.:-]{1,160}$/.test(value)?value:null;
const canonicalArgs=(args:Record<string,unknown>)=>Object.fromEntries(Object.entries(args).filter(([k,v])=>!(v===''&&['query','cursor','start_date','end_date'].includes(k))).map(([k,v])=>[k,k==='job_id'&&typeof v==='string'&&UUID.test(v)?v.toLowerCase():v] as [string,unknown]).sort(([a],[b])=>a.localeCompare(b)));
const jsonEqual=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);

async function main(){
 const args=process.argv.slice(2);
 if(!args.includes('--run')){console.log(JSON.stringify({mode:'PLAN ONLY; no credential read, journal open or network',command:'node --import tsx scripts/evaluate-tenbot-terra-tools-live.mts --run --isolated-free-fixture --run-config=/absolute/owner-only.json',runId:FIXED_RUN_ID,taskIds:FIXED_TASK_IDS,maxUsd:0.25,ordinarySpendingAuthorized:false,limits:LIMITS}));return;}
 const configArgs=args.filter(arg=>arg.startsWith('--run-config='));
 requireThat(args.length===3&&args.includes('--isolated-free-fixture')&&configArgs.length===1,'explicit-run-and-isolated-fixture-config-required');
 const runConfigPath=configArgs[0].slice('--run-config='.length);
 requireThat(path.isAbsolute(runConfigPath),'absolute-private-run-config-required');
 requireThat(ROOT===ARCHIVE&&fs.realpathSync(ROOT)===ARCHIVE,'accepted-private-source-archive-required');
 for(const [file,pin]of Object.entries(PINS))requireThat(hash(ownedFile(path.join(ROOT,file)))===pin,'accepted-source-pin-mismatch');
 for(const [file,pin]of Object.entries(BASELINE_PINS))requireThat(hash(ownedFile(path.join(BASELINE,file)))===pin,'production-control-source-pin-mismatch');
 const runConfig=ownedJson(runConfigPath);
 requireThat(Object.keys(runConfig).length===3&&runConfig.runId===FIXED_RUN_ID&&jsonEqual(runConfig.taskIds,FIXED_TASK_IDS)&&typeof runConfig.expiresAt==='string','fixed-one-shot-run-config-required');
 const started=Date.now(),expiresAt=Date.parse(runConfig.expiresAt);
 requireThat(Number.isFinite(expiresAt)&&expiresAt>started&&expiresAt<=started+15*60000,'finite-fifteen-minute-run-window-required');
 const cfg=ownedJson(FIXTURE_CONFIG);
 requireThat(cfg.fixtureKind==='standalone-free'&&cfg.projectRef===REF&&cfg.branchRef===REF&&cfg.url===ORIGIN,'only-established-isolated-fixture-permitted');
 const actor=cfg.actors&&object(cfg.actors)?cfg.actors.employeeA:null;
 requireThat(object(actor)&&typeof actor.id==='string'&&UUID.test(actor.id)&&typeof actor.email==='string'&&typeof actor.password==='string'&&typeof cfg.anonKey==='string','existing-employee-a-credentials-unavailable');
 // Deliberately never access cfg.serviceRoleKey. No privileged client is created.
 const owner=actor.id,key=readCredential();
 const DIR=fs.mkdtempSync('/private/tmp/tenops-tenbot-terra-tools-live-');fs.chmodSync(DIR,0o700);
 const save=(name:string,value:unknown)=>fs.writeFileSync(path.join(DIR,name),JSON.stringify(value,null,2)+'\n',{mode:0o600});
 const events:Record<string,unknown>[]=[],reads:Record<string,unknown>[]=[],rounds:Record<string,unknown>[]=[],protocol:Record<string,unknown>[]=[],tasks:Record<string,unknown>[]=[],controls:Record<string,unknown>[]=[];
 let phase='preflight',taskId:string|null=null,safetyStop:string|null=null,modelCalls=0,activeRound:Record<string,unknown>|null=null;
 let pending:{id:string;name:string;arguments:Record<string,unknown>;used:boolean}[]=[];
 let budget:ReturnType<typeof openScopedEvaluationBudget>|undefined;
 const fatal=(reason:string)=>{safetyStop??=reason;return new EvaluationStop(safetyStop);};
 function check(){if(safetyStop)throw new EvaluationStop(safetyStop);if(Date.now()>=expiresAt)throw fatal('evaluation-window-expired');}
 function activeBudget(heldTask?:string){
  requireThat(budget,'scoped-budget-not-open');
  try{const snapshot=budget.snapshot();if(!snapshot.activeWindow||(heldTask===undefined?!snapshot.canReserve:!snapshot.dispatchAllowed||snapshot.activeTaskId!==heldTask))throw fatal('scoped-budget-dispatch-denied');return snapshot;}
  catch(error){if(error instanceof EvaluationStop)throw error;throw fatal('scoped-budget-integrity-unavailable');}
 }
 function budgetEvidence(){
  if(!budget)return null;
  try{return budget.snapshot();}catch{safetyStop??='scoped-budget-integrity-unavailable';return {snapshotUnavailable:true,reason:safetyStop};}
 }
 const flush=()=>{save('events.json',events);save('read-trace.json',reads);save('model-rounds.json',rounds);save('native-protocol.json',protocol);save('tasks.json',tasks);save('controls.json',controls);};
 const progress=(state:string)=>console.log(JSON.stringify({state,taskId,modelCalls,evidenceDirectory:DIR}));
 const shared=path.join(ROOT,'supabase/functions/_shared');
 // Hashes are checked before evaluating any application module.
 const [{createTenbotAgentSessions,HostedAgentUnavailable},{createOpenAIProvider,OPENAI_EXPERIMENT_PRICING,OPENAI_PRICING_SOURCE},{createTenbotJobTools},{validateStoredAgentState},{AgentStepError}]=await Promise.all([
  import(pathToFileURL(path.join(shared,'tenbot-agent-session.ts')).href) as Promise<typeof import('../supabase/functions/_shared/tenbot-agent-session')>,
  import(pathToFileURL(path.join(shared,'tenbot-openai.ts')).href) as Promise<typeof import('../supabase/functions/_shared/tenbot-openai')>,
  import(pathToFileURL(path.join(shared,'tenbot-job-tools.ts')).href) as Promise<typeof import('../supabase/functions/_shared/tenbot-job-tools')>,
  import(pathToFileURL(path.join(shared,'tenbot-agent-history-store.ts')).href) as Promise<typeof import('../supabase/functions/_shared/tenbot-agent-history-store')>,
  import(pathToFileURL(path.join(shared,'tenbot-agent.ts')).href) as Promise<typeof import('../supabase/functions/_shared/tenbot-agent')>,
 ]);
 requireThat(jsonEqual(OPENAI_EXPERIMENT_PRICING[MODEL],PINNED_PRICE),'canonical-terra-pricing-pin-mismatch');
 const baselineRouting=await import(pathToFileURL(path.join(BASELINE,'supabase/functions/_shared/tenbot-job-routing.ts')).href) as typeof import('../supabase/functions/_shared/tenbot-job-routing');
 const baselineSession=await import(pathToFileURL(path.join(BASELINE,'supabase/functions/_shared/tenbot-job-session.ts')).href) as typeof import('../supabase/functions/_shared/tenbot-job-session');
 const allowedReads=new Set(['/rest/v1/jobs','/rest/v1/production_rework_cycles','/rest/v1/job_updates','/rest/v1/manpower_entries']);
 const allowedRpc=new Set(['/rest/v1/rpc/has_app_capability','/rest/v1/rpc/tenbot_authorize_history_jobs']);
 const callerFetch:typeof fetch=async(input,init)=>{
  check();const request=input instanceof Request?input:null,url=new URL(request?.url??String(input));
  const method=(init?.method??request?.method??'GET').toUpperCase();
  if(url.origin!==ORIGIN||!(allowedReads.has(url.pathname)&&['GET','HEAD'].includes(method)||allowedRpc.has(url.pathname)&&method==='POST'||url.pathname==='/auth/v1/token'&&method==='POST'&&url.searchParams.get('grant_type')==='password'||url.pathname==='/auth/v1/user'&&method==='GET'))throw fatal('fixture-transport-outside-fixed-read-boundary');
  const before=Date.now();let status:number|null=null;
  try{const response=await fetch(input,{...init,redirect:'error',signal:AbortSignal.any([AbortSignal.timeout(8000),...(init?.signal?[init.signal]:[]),...(request?.signal?[request.signal]:[])])});status=response.status;if(!response.ok)throw fatal('fixture-http-'+status);return response;}
  catch(error){if(error instanceof EvaluationStop)throw error;throw fatal('fixture-read-transport-unavailable');}
  finally{events.push({kind:'caller-read-only',phase,taskId,method,path:url.pathname,status,durationMs:Date.now()-before});}
 };
 const client=createClient(ORIGIN,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:callerFetch}});
 async function can(id:string,capability:string){
  check();if(id!==owner)throw fatal('unexpected-owner');
  const value=await client.rpc('has_app_capability',{p_capability:capability});
  if(value.error)throw fatal('caller-capability-check-unavailable');
  if(capability==='readOperationalData'&&value.data!==true)throw fatal('caller-operational-access-denied');
  return value.data===true;
 }
 const rawTools=createTenbotJobTools(client as unknown as JobToolCaller,{deadlineMs:10000});
 const tracedTools={authorizeHistory:rawTools.authorizeHistory,async execute(name:TenbotJobToolName,args:Record<string,unknown>){
  check();const match=phase==='agent'?pending.find(call=>!call.used&&call.name===name&&jsonEqual(canonicalArgs(call.arguments),canonicalArgs(args))):undefined;
  if(match)match.used=true;
  const before=Date.now(),result=await rawTools.execute(name,args);
  reads.push({phase,taskId,origin:match?'model-selected':phase==='agent'?'host-freshness-reread':'host-preflight-or-control',...(match?{nativeCallId:match.id}:{}),name,args:bounded(args,1500),status:result.status,complete:result.complete,truncated:result.truncated,durationMs:Date.now()-before,result:bounded(result,24000)});
  check();if(result.status==='unavailable')throw fatal('authorized-job-read-unavailable');return result;
 }};
 function memoryStore():AgentSessionStore{
  const states=new Map<string,{owner:string;revision:number;claim:string|null;state:StoredAgentState}>();
  return {async claim(id,supplied){
   requireThat(id===owner,'memory-owner-mismatch');const key=supplied??randomUUID();let entry=states.get(key);
   if(supplied)requireThat(entry&&entry.owner===id,'unknown-owner-private-conversation');
   if(!entry){entry={owner:id,revision:0,claim:null,state:{guidance:[],display:[]}};states.set(key,entry);}
   requireThat(!entry.claim,'concurrent-private-memory-session');entry.claim=randomUUID();
   return {id:key,owner:id,revision:entry.revision,claim:entry.claim,expiresAt:Date.now()+120000,state:structuredClone(entry.state)};
  },async commit(lease,state){
   requireThat(validateStoredAgentState(state),'invalid-private-memory-state');const entry=states.get(lease.id);
   requireThat(entry&&entry.owner===lease.owner&&entry.revision===lease.revision&&entry.claim===lease.claim,'private-memory-cas-mismatch');
   entry.state=structuredClone(state);entry.revision++;entry.claim=null;
  },async release(lease){const entry=states.get(lease.id);if(entry?.claim===lease.claim)entry.claim=null;},async clear(id,key){requireThat(id===owner&&states.get(key)?.owner===id,'private-memory-clear-owner-mismatch');states.delete(key);}};
 }
 async function control(question:string){
  phase='deterministic-control';const begin=reads.length,before=Date.now();
  const intent=baselineRouting.resolveJobIntent(question,{jobId:''},new Date());
  const result=intent?await baselineSession.prepareJobRequest(intent,tracedTools,question):null;
  return {mode:'pinned-production-resolver-preparer-same-caller-current-tools-no-prose-inference',question,intent:bounded(intent,4000),message:result?.message??'No deterministic operational intent selected',durationMs:Date.now()-before,reads:reads.slice(begin),coverage:'Manual requested-field comparison required; an intent match can cover only part of a compound question.'};
 }
 async function readApiJson(response:Response,signal:AbortSignal){
  const body=response.body;requireThat(body,'provider-response-body-unavailable');const reader=body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){if(signal.aborted)throw fatal('provider-timeout');const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>96000)throw fatal('provider-response-too-large');chunks.push(next.value);}}
  finally{await reader.cancel().catch(()=>undefined);reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try{return JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(bytes)) as unknown;}catch{throw fatal('provider-json-unavailable');}
 }
 function safeUsage(value:unknown){
  if(!object(value))return null;
  const numeric=(record:Record<string,unknown>)=>Object.fromEntries(Object.entries(record).filter(([,v])=>typeof v==='number'&&Number.isFinite(v)&&v>=0));
  return {...numeric(value),...(object(value.input_tokens_details)?{input_tokens_details:{...numeric(value.input_tokens_details),...(object(value.input_tokens_details.cache_write_tokens_details)?{cache_write_tokens_details:numeric(value.input_tokens_details.cache_write_tokens_details)}:{})}}:{}),...(object(value.output_tokens_details)?{output_tokens_details:numeric(value.output_tokens_details)}:{})};
 }
 function nativeItems(items:unknown){
  requireThat(Array.isArray(items),'native-continuation-unavailable');
  return items.map(item=>{
   requireThat(object(item)&&typeof item.type==='string','native-continuation-item-invalid');
   if(item.type==='function_call')return {type:item.type,call_id:item.call_id,name:item.name,arguments:item.arguments,status:item.status};
   // Never log instructions, encrypted reasoning state or reasoning summaries.
   return {type:item.type,...(item.type==='reasoning'?{opaqueStateOmitted:true}:{})};
  });
 }
 function providerFor(id:string):AgentProvider{
  const issued=new Map<string,{name:string;arguments:Record<string,unknown>}>();
  const adapter=createOpenAIProvider({model:MODEL,apiKey:key,spendingAuthorized:true,pricing:PINNED_PRICE,timeoutMs:25000,requireResponseMetadata:true,
   reserveBudget:usd=>{check();requireThat(budget,'scoped-budget-not-open');return budget.reserveBudget(id,usd);},
   async fetcher(input,init){
    check();const url=input instanceof Request?input.url:String(input);
    if(url!==ENDPOINT||init?.method!=='POST'||typeof init.body!=='string')throw fatal('provider-endpoint-boundary');
    requireThat(activeRound&&taskId===id,'provider-step-without-active-task');
    const wire=JSON.parse(init.body) as Record<string,unknown>;
    requireThat(wire.model===MODEL&&wire.store===false&&wire.service_tier==='default'&&wire.max_output_tokens===LIMITS.maxOutputTokens&&wire.parallel_tool_calls===false,'native-request-contract-changed');
    const nativeInput=Array.isArray(wire.input)?wire.input:[];
    const outputs=nativeInput.filter(object).filter(item=>item.type==='function_call_output');
    const incomingResults=outputs.map(item=>({nativeCallId:item.call_id,output:bounded(typeof item.output==='string'?JSON.parse(item.output):item.output,24000)}));
    requireThat(incomingResults.every(item=>typeof item.nativeCallId==='string'&&issued.has(item.nativeCallId)),'native-result-without-issued-call');
    protocol.push({taskId:id,modelSequence:modelCalls+1,stage:'request',nativeResults:incomingResults,replayedProviderItems:nativeItems(nativeInput.filter(object).filter(item=>item.type==='function_call'||item.type==='reasoning'))});
    readCredential();await can(owner,'readOperationalData');check();
    activeBudget(id);
    const before=Date.now();let response:Response;
    modelCalls++;activeRound.modelSequence=modelCalls;activeRound.apiDispatchedAt=new Date().toISOString();
    try{response=await fetch(ENDPOINT,{...init,redirect:'error',signal:AbortSignal.any([AbortSignal.timeout(25000),...(init?.signal?[init.signal]:[])])});}
    catch{throw fatal('provider-transport-or-timeout');}
    activeRound.httpStatus=response.status;activeRound.requestId=safeCode(response.headers.get('x-request-id'));activeRound.fetchToHeadersMs=Date.now()-before;
    const payload=await readApiJson(response.clone(),init.signal??AbortSignal.timeout(25000));
    if(!response.ok){
     const error=object(payload)&&object(payload.error)?payload.error:{};
     activeRound.apiError={type:safeCode(error.type),code:safeCode(error.code),httpStatus:response.status,requestId:activeRound.requestId};
     safetyStop??='provider-http-'+response.status;return response;
    }
    requireThat(object(payload),'provider-response-not-object');
    activeRound.actualModel=typeof payload.model==='string'?safeCode(payload.model):null;
    activeRound.serviceTier=safeCode(payload.service_tier);activeRound.apiStatus=safeCode(payload.status);activeRound.rawUsage=safeUsage(payload.usage);
    if(payload.model!==MODEL||payload.service_tier!=='default')safetyStop??='provider-model-or-tier-mismatch';
    if(!object(payload.usage))safetyStop??='provider-usage-unavailable';
    if(Array.isArray(payload.output)){
     const calls=payload.output.filter(object).filter(item=>item.type==='function_call').map(item=>({nativeCallId:item.call_id,name:item.name,arguments:item.arguments}));
     activeRound.nativeCalls=calls;
     protocol.push({taskId:id,modelSequence:modelCalls,stage:'response',nativeContinuation:nativeItems(payload.output)});
    }
    return response;
   },
  });
  return {name:adapter.name,model:adapter.model,async step(request:AgentStepRequest){
   check();requireThat(taskId===id&&!activeRound,'provider-task-or-concurrency-mismatch');
   readCredential();activeBudget();
   const resultPairs=request.history.filter(item=>item.kind==='tool_result').map(item=>{
    const source=issued.get(item.callId);requireThat(source&&source.name===item.name,'native-result-name-or-id-mismatch');
    return {nativeCallId:item.callId,name:item.name,outputSha256:hash(item.output),output:bounded(JSON.parse(item.output),24000)};
   });
   requireThat(new Set(resultPairs.map(item=>item.nativeCallId)).size===resultPairs.length,'duplicate-native-result');
   protocol.push({taskId:id,stage:'provider-step-history',round:rounds.filter(row=>row.taskId===id).length+1,resultPairs});
   const row:Record<string,unknown>={taskId:id,round:rounds.filter(value=>value.taskId===id).length+1,requestedModel:MODEL,requestedServiceTier:'default',startedAt:new Date().toISOString()};
   rounds.push(row);activeRound=row;const before=Date.now();
   try{
    const step:AgentStep=await adapter.step(request);row.usage=step.usage;row.selectedCalls=step.calls;row.final=bounded(step.final,16000);
    const native=Array.isArray(row.nativeCalls)?row.nativeCalls:[];
    requireThat(native.length===step.calls.length,'native-call-count-mismatch');
    for(const [index,call]of step.calls.entries()){
     const original=native[index];requireThat(object(original)&&original.nativeCallId===call.id&&original.name===call.name&&typeof original.arguments==='string'&&jsonEqual(JSON.parse(original.arguments),call.arguments),'native-call-id-or-arguments-rewritten');
     if(issued.has(call.id))throw fatal('native-call-id-reused');issued.set(call.id,{name:call.name,arguments:call.arguments});
    }
    pending=step.calls.map(call=>({...call,used:false}));
    row.nativeContinuation=nativeItems(step.continuation);check();return step;
   }catch(error){
    if(error instanceof AgentStepError){row.providerFailure=error.code;row.usage=error.usage;
     // A measured incomplete/final-format response is a quality failure. Access,
     // HTTP, transport, unknown usage or budget/protocol faults stop both tasks.
     if(!['incomplete-provider-response','invalid-structured-output','invalid-provider-message','provider-refusal-or-invalid-content'].includes(error.code))safetyStop??='provider-'+error.code;
     throw new AgentStepError(error.code,error.usage,false);
    }
    row.providerFailure=error instanceof EvaluationStop?error.reason:'evaluation-provider-wrapper-failed';safetyStop??=String(row.providerFailure);throw new AgentStepError(safetyStop,undefined,false);
   }finally{row.durationMs=Date.now()-before;activeRound=null;save('model-rounds.json',rounds);save('native-protocol.json',protocol);}
  }};
 }
 const expectedRead=async(name:TenbotJobToolName,args:Record<string,unknown>)=>{const result=await tracedTools.execute(name,args);requireThat(result.status==='ok'&&result.complete,'complete-current-authorized-expectation-unavailable');return result;};
 const selectedNames=(rows:Record<string,unknown>[])=>rows.flatMap(row=>Array.isArray(row.selectedCalls)?row.selectedCalls.filter(object).map(call=>String(call.name)):[]);
 try{
  // Opening consumes the fixed run identity even if the Auth preflight fails.
  // The shared $5 writer lock and permanent state prevent retry/reset bypasses.
  budget=openScopedEvaluationBudget({journalPath:JOURNAL,sourceFiles:[KEY_FILE,runConfigPath,path.join(ROOT,'scripts/evaluate-tenbot-terra-tools-live.mts'),path.join(ROOT,'scripts/support/tenbot-scoped-evaluation-budget.mts'),...Object.keys(PINS).map(file=>path.join(ROOT,file)),...Object.keys(BASELINE_PINS).map(file=>path.join(BASELINE,file))],expiresAt:runConfig.expiresAt});
  save('scope.json',{runId:FIXED_RUN_ID,taskIds:FIXED_TASK_IDS,acceptedSource:ACCEPTED,productionControl:PRODUCTION,pins:PINS,baselinePins:BASELINE_PINS,fixture:REF,existingSyntheticCaller:true,limits:LIMITS,maxRunUsd:0.25,existingJournalCapUsd:5,ordinarySpendingAuthorized:false,canonicalPrice:PINNED_PRICE,pricingSource:OPENAI_PRICING_SOURCE,expiresAt:runConfig.expiresAt,startedAt:new Date(started).toISOString(),displayStore:'owner-scoped CAS memory only',scriptedModelResponses:false});
  progress('genuine-synthetic-auth-preflight');
  const signed=await client.auth.signInWithPassword({email:actor.email,password:actor.password});
  requireThat(!signed.error&&signed.data.user?.id===owner&&signed.data.session,'existing-synthetic-auth-unavailable');
  requireThat((signed.data.session.expires_at??0)*1000>expiresAt,'synthetic-jwt-expires-before-run-window');
  const verified=await client.auth.getUser();requireThat(!verified.error&&verified.data.user?.id===owner,'genuine-caller-jwt-verification-failed');
  requireThat(await can(owner,'readOperationalData'),'existing-synthetic-caller-access-denied');
  const discovery=await expectedRead('find_jobs',{include_archived:false,limit:20});
  requireThat(discovery.data&&'jobs'in discovery.data,'existing-synthetic-job-discovery-unavailable');
  const jobs=(discovery.data as {jobs:JobFacts[]}).jobs.filter(job=>typeof job.job_number==='string'&&job.job_number.length>0&&job.job_number.length<100);
  requireThat(jobs.length>0,'existing-numbered-synthetic-job-required-no-seeding');
  // Prefer saved dates using the authorized preflight result; never invent or
  // seed a Job. If all dates are absent, that real absence is the expected fact.
  const first=jobs.find(job=>job.effective.planned_start&&job.effective.planned_end)??jobs[0],second=jobs.find(job=>job.job_id!==first.job_id)??first;
  const examples=[
   {id:FIXED_TASK_IDS[0],job:first,question:`For Job "${first.job_number}", give its saved scheduled start and end dates AND its recorded labor hours for ${PERIOD.start_date} through ${PERIOD.end_date}. Include both parts; identify unsaved or unknown fields.`,required:['saved start and end dates, or explicit missing dates','recorded labor total in hours for the exact stated period','canonical numbered Job identity; no inferred remaining hours or operational action']},
   {id:FIXED_TASK_IDS[1],job:second,question:`Give a compound Production briefing: current counts of non-archived Jobs by every Production status, plus Job "${second.job_number}" saved planning (scheduled start and end, planning readiness and missing fields), recorded open follow-up count, and recorded labor hours for ${PERIOD.start_date} through ${PERIOD.end_date}. Cover every requested part and distinguish unknown fields.`,required:['complete non-archived current counts by every Production status','chosen Job saved dates, planning readiness and missing fields','chosen Job recorded open follow-up count','chosen Job recorded labor total and exact period','canonical Job identity; missing data distinct from verified zero; no physical readiness or remaining-work inference']},
  ];
  save('selected-existing-jobs.json',examples.map(test=>({taskId:test.id,jobId:test.job.job_id,jobNumber:test.job.job_number,question:test.question,manualCompletionCriteria:test.required})));
  for(const test of examples){
   check();taskId=test.id;phase='preflight';pending=[];
   const truth:{planning:JobToolResult;labor:JobToolResult;summary?:JobToolResult;overview?:JobToolResult}={planning:await expectedRead('get_job_planning',{job_id:test.job.job_id}),labor:await expectedRead('get_job_labor_summary',{job_id:test.job.job_id,...PERIOD})};
   if(test.id===FIXED_TASK_IDS[1]){truth.summary=await expectedRead('get_job_summary',{job_id:test.job.job_id});truth.overview=await expectedRead('get_production_overview',{include_archived:false});}
   const baseline=await control(test.question);controls.push({taskId:test.id,...baseline});save('controls.json',controls);
   const roundStart=rounds.length,readStart=reads.length,eventStart=events.length,before=Date.now();phase='agent';
   const session=createTenbotAgentSessions({mode:'openai',readOnlyHosted:true,modelDirectedReads:true,operationalHistory:false,sessionStore:memoryStore(),can,jobTools:id=>{requireThat(id===owner,'session-caller-owner-mismatch');return tracedTools;},provider:()=>providerFor(test.id),onDiagnostic(event:InvestigationDiagnostic){
    events.push({kind:'agent-diagnostic',taskId:test.id,...event});
    if(event.stage==='authorization'&&event.outcome!=='ok')safetyStop??='authorization-'+event.reasonCode;
    if(event.stage==='tool'&&event.outcome!=='ok'&&['invalid-call','invalid-arguments','capability-not-discovered','unknown-capability'].includes(event.reasonCode))safetyStop??='tool-protocol-'+event.reasonCode;
   }});
   let result:Record<string,unknown>={},errorReason:string|null=null;
   try{result=await session({action:'ask',question:test.question},owner) as Record<string,unknown>;}
   catch(error){
    errorReason=error instanceof HostedAgentUnavailable?error.reason:error instanceof EvaluationStop?error.reason:'session-rejected-see-safe-diagnostics';
    if(!(error instanceof HostedAgentUnavailable))safetyStop??=error instanceof EvaluationStop?error.reason:'uncertain-session-failure';
   }
   const lastStop=events.slice(eventStart).filter(event=>event.kind==='agent-diagnostic'&&event.stage==='stop').at(-1);
   const reason=errorReason??(typeof lastStop?.reasonCode==='string'?lastStop.reasonCode:'missing-stop-diagnostic');
   const knownQualityStops=['completed','round-limit','call-limit','deadline','context-limit','result-limit','invalid-final','unknown-evidence','missing-workflow-evidence','empty-provider-step','incomplete-provider-response','invalid-structured-output','invalid-provider-message','provider-refusal-or-invalid-content'];
   if(!knownQualityStops.includes(reason))safetyStop??='runtime-'+reason;
   const completed=!errorReason&&reason==='completed'&&lastStop?.outcome==='ok';
   const taskRounds=rounds.slice(roundStart),taskReads=reads.slice(readStart);
   const modelReads=taskReads.filter(read=>read.origin==='model-selected');
   const usages=taskRounds.map(row=>row.usage).filter(object);
   const costUsd=usages.reduce((sum,usage)=>sum+(typeof usage.costUsd==='number'?usage.costUsd:0),0);
   const snapshot=budgetEvidence(),reservations=snapshot&&'run'in snapshot?snapshot.run.reservations.filter(row=>row.taskId===test.id):null;
   const accountedUsd=reservations?reservations.reduce((sum,row)=>sum+(row.actualMicrousd??row.reservedMicrousd),0)/1000000:null;
   const measuredUsd=reservations&&reservations.every(row=>row.status==='measured')?accountedUsd:null;
   const taskCost={providerReportedOrHeldUsd:costUsd,accountedUsd,measuredUsd,billedCostUnavailable:measuredUsd===null,basis:measuredUsd===null?'Billed cost unavailable; preserve every unknown request reservation and its lock.':'Measured provider usage, rounded up per request by the shared journal.',rounding:'Each request is rounded up to integer microUSD by the shared journal.',reservations};
   tasks.push({taskId:test.id,question:test.question,expectedJobId:test.job.job_id,status:completed?'runtime-completed':'stopped',reason,safetyStop,sessionRejected:errorReason!==null,conversationId:typeof result.conversationId==='string'?result.conversationId:null,separateConversation:true,finalAnswer:bounded(result.message,16000),sessionResponse:bounded(result,32000),manualReview:{state:'required-not-automatically-scored',criteria:test.required,expectedCurrentAuthorizedFacts:truth,coverageEvidence:'Compare finalAnswer, model-selected reads and expected facts; runtime completion is not proof of complete or correct coverage.'},actualModelInference:taskRounds.some(row=>typeof row.apiDispatchedAt==='string'),modelCalls:taskRounds.filter(row=>typeof row.apiDispatchedAt==='string').length,selectedToolNames:selectedNames(taskRounds),modelSelectedReads:modelReads,hostFreshnessRereads:taskReads.filter(read=>read.origin==='host-freshness-reread'),durationMs:Date.now()-before,taskCost,usage:usages,budgetAfterTask:snapshot,deterministicControl:baseline});
   flush();progress('task-finished');
   // No fallback, additional "hello", scripted retry or allowance reset. A
   // safely measured quality failure may still leave the independent second
   // requested task eligible; every access/protocol/funding uncertainty stops.
   if(safetyStop)throw new EvaluationStop(safetyStop);
   activeBudget();
  }
  save('report.json',{evaluationFinished:true,runId:FIXED_RUN_ID,acceptedSource:ACCEPTED,productionControl:PRODUCTION,tasksAttempted:tasks.length,tasksNotRun:FIXED_TASK_IDS.filter(id=>!tasks.some(task=>task.taskId===id)),runtimeCompleted:tasks.filter(task=>task.status==='runtime-completed').length,manualQualityReview:'Required: inspect each final answer against its requested fields and same-caller expected facts.',modelCalls,elapsedMs:Date.now()-started,budget:budgetEvidence(),actualJwtRls:true,scriptedModelResponses:false,ordinarySpendingAuthorized:false,limitations:['Existing synthetic isolated fixture only; no Production business records accessed.','The pinned deterministic resolver/preparer can answer only part of a compound question; it is a measured control, not a model-routing decision.','No automated completeness claim or independent permission change/revocation test.','No browser/UI/provider-deployment proof from this command.']});progress('two-task-evaluation-finished');
 }catch(error){
  const reason=safetyStop??(error instanceof EvaluationStop?error.reason:'evaluation-failed-see-safe-trace');
  save('stop.json',{completed:false,reason,phase,taskId,modelCalls,tasksNotRun:FIXED_TASK_IDS.filter(id=>!tasks.some(task=>task.taskId===id)),elapsedMs:Date.now()-started,budget:budgetEvidence()});
  console.error(JSON.stringify({stopped:true,reason,evidenceDirectory:DIR}));process.exitCode=1;
 }finally{
  flush();let closeInvoked=false,closeReturned=false;
  try{if(budget){save('budget-final-before-close.json',budgetEvidence());closeInvoked=true;budget.close();closeReturned=true;}}
  finally{save('final-state.json',{runId:FIXED_RUN_ID,budgetCloseInvoked:closeInvoked,budgetCloseReturned:closeReturned,budgetLockRetained:fs.existsSync(path.join(path.dirname(JOURNAL),'openai-budget.lock')),modelCalls,ordinarySpendingAuthorized:false,operationalWrites:0,fixtureSetupWrites:0,historyDatabaseWrites:0,serviceCredentialUse:0,authUserMutations:0,grantActivations:0,enrollmentChanges:0,providerConfigurationChanges:0});}
 }
}
await main().catch(error=>{console.error(JSON.stringify({stopped:true,reason:error instanceof EvaluationStop?error.reason:'evaluation-preflight-unavailable'}));process.exitCode=1;});
