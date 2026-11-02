// Local Product pilot only. Wrangler credentials never enter the binding payload.
import {readFileSync,writeFileSync,mkdirSync,appendFileSync,readdirSync,existsSync,renameSync,unlinkSync,rmdirSync} from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {inferenceRequest} from '../../supabase/functions/_shared/tenbot-core.ts';
import {allowedModels,defaultModel,isAllowedModel,measuredUsage,reserveForRequest,usagePolicy} from '../../supabase/functions/_shared/tenbot-models.ts';
import {worker,validPilotInput} from '../tenbot-ai/worker.ts';
export const pilotDirectory='/private/tmp/tenops-tenbot-review/ai-pilot';
export const pilotAccount='1c3296a9dced221746eb605be66df0f3';
export const pilotModel=defaultModel;
export const pilotCaps={...usagePolicy,totalDay:usagePolicy.sharedDayLimit,perMinute:usagePolicy.perAccountMinuteLimit,monthlyUsd:0};
function freshConfirmation(value){const stamp=Date.parse(value);return Number.isFinite(stamp)&&stamp<=Date.now()&&Date.now()-stamp<=8*60*60*1000;}
export function existingWrangler(){
 const root='/Users/chrisngo/.npm/_npx';
 for(const id of readdirSync(root)){const dir=path.join(root,id,'node_modules/wrangler');if(existsSync(path.join(dir,'package.json'))&&JSON.parse(readFileSync(path.join(dir,'package.json'),'utf8')).version==='4.151.0')return path.join(dir,'bin/wrangler.js');}
 throw Error('Existing Wrangler 4.151.0 unavailable; no package installed automatically');
}
export function oauthToken(){
 const file='/Users/chrisngo/.wrangler/config/default.toml';let text=readFileSync(file,'utf8');
 const fresh=()=>Date.parse(text.match(/^expiration_time\s*=\s*"([^"]+)"/m)?.[1])>Date.now()+5000;
 if(!fresh()){
  // Use Wrangler's existing refresh flow; never implement or log credentials.
  // Four seconds leaves room for quota/inference/fallback inside the UI deadline.
  execFileSync(process.execPath,[existingWrangler(),'whoami'],{stdio:'ignore',timeout:4000,env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'}});
  text=readFileSync(file,'utf8');if(!fresh())throw Error('Wrangler authentication unavailable');
 }
 const token=text.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];if(!token)throw Error('Wrangler login unavailable');return token;
}
async function cloudflare(route,body,timeoutMs=10000){
 // Use Cloudflare's documented per-account analytics bucket so unrelated
 // traffic sharing the Wrangler credential cannot consume this read quota.
 const response=await fetch('https://api.cloudflare.com/client/v4/'+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+oauthToken(),...(route==='graphql'?{'X-Rate-Limit-Type':'account-based'}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(timeoutMs)});
 const value=await response.json();if(!response.ok||value.success===false||value.errors?.length)throw Error('Cloudflare verification unavailable (HTTP '+response.status+'; '+(value.errors||[]).map(error=>String(error.message||error.code||'unknown').slice(0,240)).join('; ')+')');return value;
}
export async function dailyAiUsage(timeoutMs=10000){
 const now=new Date(),start=new Date(now);start.setUTCHours(0,0,0,0);
 const query=`{viewer{accounts(filter:{accountTag:"${pilotAccount}"}){aiInferenceAdaptiveGroups(limit:1,filter:{datetime_geq:"${start.toISOString()}",datetime_lt:"${now.toISOString()}"}){count sum{totalNeurons totalInputTokens totalOutputTokens}}}}}`;
 const value=await cloudflare('graphql',{query},timeoutMs);const accounts=value.data?.viewer?.accounts;
 if(!Array.isArray(accounts)||accounts.length!==1||!Array.isArray(accounts[0].aiInferenceAdaptiveGroups))throw Error('Usage verification unavailable');
 const rows=accounts[0].aiInferenceAdaptiveGroups;
 if(rows.some(row=>!Number.isFinite(row.sum?.totalNeurons)||row.sum.totalNeurons<0))throw Error('Invalid usage response');
 const neurons=rows.reduce((n,row)=>n+row.sum.totalNeurons,0);
 return {checkedAt:now.toISOString(),dayStart:start.toISOString(),reportedNeurons:neurons,reportedRequests:rows.reduce((n,row)=>n+row.count,0),nominalRemainingNeurons:Math.max(0,10000-neurons)};
}
// Analytics has its own small API cost budget. Cache verified account telemetry
// for at most five minutes and journal every dispatch before inference. Keep
// local charges even after analytics refresh (safe double-counting, rather than
// guessing which delayed account aggregates include a particular request).
export function createAccountAllowanceGuard({directory=pilotDirectory,loadUsage=()=>dailyAiUsage(4000),now=()=>Date.now()}={}){
 const file=path.join(directory,'account-allowance.json'),lock=path.join(directory,'account-allowance.lock'),ttl=300000;
 const day=stamp=>new Date(stamp).toISOString().slice(0,10)+'T00:00:00.000Z';
 const validUsage=(usage,stamp)=>usage&&usage.dayStart===day(stamp)&&Number.isFinite(Date.parse(usage.checkedAt))&&Date.parse(usage.checkedAt)<=stamp&&stamp-Date.parse(usage.checkedAt)<=ttl&&Number.isFinite(usage.reportedNeurons)&&usage.reportedNeurons>=0&&Number.isSafeInteger(usage.reportedRequests)&&usage.reportedRequests>=0;
 async function exclusive(operation){
  mkdirSync(directory,{recursive:true,mode:0o700});
  try{mkdirSync(lock,{mode:0o700});}catch{throw Error('Free allowance guard busy; use direct search');}
  try{writeFileSync(path.join(lock,'owner.json'),JSON.stringify({pid:process.pid,startedAt:new Date(now()).toISOString()}),{mode:0o600});return await operation();}
  finally{unlinkSync(path.join(lock,'owner.json'));rmdirSync(lock);}
 }
 function read(){
  let state;
  try{state=JSON.parse(readFileSync(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw Error('Free allowance journal unavailable');state={version:1,dayStart:day(now()),usage:null,entries:[]};}
  if(state.version!==1||!Array.isArray(state.entries)||state.entries.length>1000||state.entries.some(entry=>typeof entry.id!=='string'||!Number.isFinite(Date.parse(entry.startedAt))||!Number.isFinite(entry.reservedNeurons)||entry.reservedNeurons<=0||!Number.isFinite(entry.chargedNeurons)||entry.chargedNeurons<0))throw Error('Free allowance journal invalid');
  if(state.dayStart!==day(now())){
   // A request still uncertain around midnight remains conservatively charged
   // during the next cache window. Older completed UTC-day charges can retire.
   state.entries=state.entries.filter(entry=>!entry.settledAt&&Date.parse(entry.startedAt)>=now()-ttl);
   state.dayStart=day(now());state.usage=null;
  }
  return state;
 }
 function write(state){const temp=file+'.'+randomUUID()+'.tmp';writeFileSync(temp,JSON.stringify(state),{mode:0o600});renameSync(temp,file);}
 function snapshot(state){
  if(!validUsage(state.usage,now()))throw Error('Verified free allowance cache expired');
  const charged=state.entries.reduce((sum,entry)=>sum+entry.chargedNeurons,0);
  return {...state.usage,cached:true,cacheExpiresAt:new Date(Date.parse(state.usage.checkedAt)+ttl).toISOString(),guardJournalNeurons:charged,guardedRemainingNeurons:Math.max(0,usagePolicy.freeDailyNeurons-state.usage.reportedNeurons-charged-usagePolicy.neuronHeadroom)};
 }
 return {
  async seed(usage){return exclusive(()=>{if(!validUsage(usage,now()))throw Error('Verified free allowance is stale');const state=read();state.usage=usage;state.refreshBlockedUntil=null;write(state);return snapshot(state);});},
  async snapshot(){return exclusive(()=>snapshot(read()));},
  async reserve(model,neurons){return exclusive(async()=>{
   if(!isAllowedModel(model)||!Number.isFinite(neurons)||neurons<=0)throw Error('Invalid free allowance reservation');
   const state=read();
   if(!validUsage(state.usage,now())){
    if(Date.parse(state.refreshBlockedUntil)>now())throw Error('Free allowance verification cooling down; use direct search');
    try{const usage=await loadUsage();if(!validUsage(usage,now()))throw Error('Free allowance verification unavailable');state.usage=usage;state.refreshBlockedUntil=null;}
    catch(error){state.refreshBlockedUntil=new Date(now()+ttl).toISOString();write(state);throw error;}
   }
   const account=snapshot(state);
   if(neurons>account.guardedRemainingNeurons)throw Error('Free allowance headroom reached');
   if(state.entries.length>=1000)throw Error('Free allowance journal full');
   const id=randomUUID();state.entries.push({id,startedAt:new Date(now()).toISOString(),model,reservedNeurons:neurons,chargedNeurons:neurons,settledAt:null});write(state);return {id,account};
  });},
  async settle(id,measurement){return exclusive(()=>{
   const state=read(),entry=state.entries.find(item=>item.id===id);
   if(!entry)throw Error('Free allowance reservation unavailable');
   if(entry.settledAt)throw Error('Free allowance reservation already settled');
   if(measurement&&measurement.model===entry.model&&Number.isFinite(measurement.estimatedNeurons)&&measurement.estimatedNeurons>=0)entry.chargedNeurons=measurement.estimatedNeurons;
   // Unknown usage keeps its bound, including timeouts and provider failures.
   entry.settledAt=new Date(now()).toISOString();write(state);
  });},
 };
}
const accountAllowance=createAccountAllowanceGuard();
export const cachedAiUsage=()=>accountAllowance.snapshot();
export async function verifyPilot({confirmFree=false}={}){
 mkdirSync(pilotDirectory,{recursive:true});
 let prior=null;try{prior=JSON.parse(readFileSync(path.join(pilotDirectory,'ready.json'),'utf8'));}catch{}
 // The OAuth session lacks Billing Read. Chris must confirm the actual Workers
 // Free plan in Billing; no inference is allowed from an unknown or Paid plan.
 const confirmedAt=confirmFree?new Date().toISOString():prior?.freePlanConfirmedAt;
 if(!freshConfirmation(confirmedAt))throw Error('Current Workers Free dashboard confirmation required');
 const catalog=await Promise.all(allowedModels.map(async model=>{
  const result=await cloudflare(`accounts/${pilotAccount}/ai/models/search?search=${encodeURIComponent(model.split('/').at(-1))}`);
  return {model,listed:result.result?.some(entry=>entry.name===model)===true};
 }));
 if(!catalog.some(entry=>entry.model===pilotModel&&entry.listed))throw Error('Selected model unavailable');
 const usage=await dailyAiUsage();
 if(usage.nominalRemainingNeurons<pilotCaps.neuronHeadroom+500)throw Error('Insufficient conservative free headroom');
 await accountAllowance.seed(usage);
 const ready={ready:true,model:pilotModel,availableModels:catalog.filter(entry=>entry.listed).map(entry=>entry.model),catalog,plan:'Workers Free',planEvidence:'Chris confirmed Workers Free in current Product request',freePlanConfirmedAt:confirmedAt,...usage,caps:pilotCaps};
 writeFileSync(path.join(pilotDirectory,'ready.json'),JSON.stringify(ready,null,2),{mode:0o600});return ready;
}
export function prepareBindingConfig(){
 const config=JSON.parse(readFileSync('scripts/tenbot-ai/wrangler.jsonc','utf8'));
 config.main=path.resolve('scripts/tenbot-ai/worker.ts');
 const key=randomBytes(32).toString('hex');
 writeFileSync(path.join(pilotDirectory,'wrangler.jsonc'),JSON.stringify(config,null,2),{mode:0o600});
 writeFileSync(path.join(pilotDirectory,'.dev.vars'),'TENBOT_PILOT_BRIDGE_KEY='+key+'\n',{mode:0o600});
 writeFileSync(path.join(pilotDirectory,'bridge.json'),JSON.stringify({key,url:'http://127.0.0.1:55594'}),{mode:0o600});
 return path.join(pilotDirectory,'wrangler.jsonc');
}
let pilotActive=false;
export function pilotProvider({model=pilotModel,dispatch,directory=pilotDirectory,allowance=accountAllowance,deadlineMs=25000}={}){
 if(!isAllowedModel(model))throw Error('Model not allowed');
 if(!Number.isSafeInteger(deadlineMs)||deadlineMs<1||deadlineMs>25000)throw Error('Invalid pilot deadline');
 const measurements=new WeakMap();
 return {name:'Cloudflare Workers AI remote binding',
  reserveEstimate(input){measurements.delete(input);return reserveForRequest(model,inferenceRequest(guideOnlyInput(input),model));},
  usage(input){return measurements.get(input)??null;},
  async infer(input,signal){
  measurements.delete(input);
  if(pilotActive)throw Error('One pilot request at a time');
  pilotActive=true;
  let allowanceReservation=null;
  try{
   const safe=guideOnlyInput(input),reservation=reserveForRequest(model,inferenceRequest(safe,model));
   const ready=JSON.parse(readFileSync(path.join(directory,'ready.json'),'utf8'));
   if(ready.plan!=='Workers Free'||!freshConfirmation(ready.freePlanConfirmedAt)||!ready.availableModels?.includes(model))throw Error('Free-only model verification unavailable or expired');
   allowanceReservation=await allowance.reserve(model,reservation.neurons);
   signal?.throwIfAborted();
   const started=Date.now(),deadline=signal?AbortSignal.any([signal,AbortSignal.timeout(deadlineMs)]):AbortSignal.timeout(deadlineMs);
   let value;
   if(dispatch)value=await withDeadline(dispatch(safe,model,deadline),deadline);
   else{
    // Legacy consumers may still use the authenticated local bridge. The
    // owned in-process evaluation path never reads or creates its credential.
    const bridge=JSON.parse(readFileSync(path.join(directory,'bridge.json'),'utf8'));
    const response=await fetch(bridge.url+'/infer',{method:'POST',headers:{'Content-Type':'application/json','x-tenbot-pilot-key':bridge.key,'x-tenbot-model':model},body:JSON.stringify(safe),signal:deadline});
    if(!response.ok)throw Error('Remote binding unavailable (HTTP '+response.status+')');
    const text=await response.text();if(Buffer.byteLength(text)>16000)throw Error('Oversized binding result');value=JSON.parse(text);
   }
   const metering=measuredUsage(model,value.usage);if(metering)measurements.set(input,metering);
   appendFileSync(path.join(directory,'usage.jsonl'),JSON.stringify({at:new Date().toISOString(),model,durationMs:Date.now()-started,usage:value.usage||{},estimatedNeurons:metering?.estimatedNeurons??null,reservedNeurons:reservation.neurons})+'\n',{mode:0o600});
   return value.output;
  }finally{
   try{if(allowanceReservation)await allowance.settle(allowanceReservation.id,measurements.get(input)??null);}
   finally{pilotActive=false;}
  }
 }};
}
// This server-only provider receives handler-authorized owner history, never
// caller-replayed turns or independently retrieved business records.
export function guideOnlyInput(input){
 if(input.draft)throw Error('Feature drafts remain employee-written in this pilot');
 if(input.operational&&(!Array.isArray(input.context)||input.context.length||!Array.isArray(input.excerpts)||input.excerpts.length||!Array.isArray(input.operational.facts)||input.operational.facts.length>40||JSON.stringify(input.operational).length>8000))throw Error('Invalid operational evidence');
 if(!validPilotInput(input))throw Error('Invalid assistant input');
 return {question:input.question,context:input.context,draft:false,excerpts:input.excerpts,...(input.operational?{operational:input.operational}:{}),...(input.agent?{agent:input.agent}:{})};
}

function withDeadline(promise,signal){
 signal.throwIfAborted();
 return new Promise((resolve,reject)=>{
  const abort=()=>reject(Error('Pilot remote binding deadline exceeded'));
  signal.addEventListener('abort',abort,{once:true});
  Promise.resolve(promise).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
 });
}

// Supported Wrangler Node API, with an owned remote AI binding and explicit
// disposal. This opens no unattended HTTP inference bridge and loads no env
// files. The existing OAuth session, Free verification and both meters remain
// authoritative; no Worker deployment, token creation or paid activation.
export async function openPilotProvider({model=pilotModel}={}){
 if(!isAllowedModel(model))throw Error('Model not allowed');
 const ready=JSON.parse(readFileSync(path.join(pilotDirectory,'ready.json'),'utf8'));
 if(ready.plan!=='Workers Free'||!freshConfirmation(ready.freePlanConfirmedAt)||!ready.availableModels?.includes(model))throw Error('Free-only model verification unavailable or expired');
 // reserve() refreshes stale account telemetry before each dispatch. A stale
 // cache alone must not block opening a binding that has not spent anything.
 process.env.WRANGLER_SEND_METRICS='false';
 const wranglerApi=await import(pathToFileURL(path.join(path.dirname(path.dirname(existingWrangler())),'wrangler-dist/cli.js')).href);
 const setup=wranglerApi.getPlatformProxy({configPath:path.resolve('scripts/tenbot-ai/wrangler.jsonc'),remoteBindings:true,persist:false,envFiles:[]});
 let expired=false,proxy;
 try{proxy=await withDeadline(setup,AbortSignal.timeout(30000));}
 catch{expired=true;void setup.then(value=>value.dispose()).catch(()=>{});throw Error('Pilot remote binding setup unavailable or timed out');}
 let disposed=false,poisoned=false;
 const dispose=async()=>{if(disposed)return;disposed=true;await withDeadline(proxy.dispose(),AbortSignal.timeout(5000));};
 const key=randomBytes(32).toString('hex');
 const provider=pilotProvider({model,async dispatch(input,selected,signal){
  if(expired||disposed||poisoned)throw Error('Pilot remote binding closed');
  const request=new Request('http://127.0.0.1/infer',{method:'POST',headers:{'Content-Type':'application/json','x-tenbot-pilot-key':key,'x-tenbot-model':selected},body:JSON.stringify(input)});
  try{
   // Reuse exactly the same authenticated worker admission and output bounds,
   // invoking its handler in-process rather than over an unmanaged HTTP port.
   const response=await withDeadline(worker.fetch(request,{AI:proxy.env.AI,TENBOT_PILOT_BRIDGE_KEY:key}),signal);
   if(!response.ok)throw Error('Pilot remote inference unavailable (HTTP '+response.status+')');
   const text=await response.text();if(Buffer.byteLength(text)>16000)throw Error('Oversized binding result');return JSON.parse(text);
  }catch(error){
   // A timed-out backend may still be completing. Never dispatch another call
   // through that session; the allowance journal retains the uncertain bound.
   poisoned=true;throw error;
  }
 }});
 return {provider,dispose,transport:'wrangler-remote-ai-binding'};
}
