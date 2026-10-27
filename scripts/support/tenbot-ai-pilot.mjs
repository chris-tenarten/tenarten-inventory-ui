// Local Product pilot only. Wrangler credentials never enter the binding payload.
import {readFileSync,writeFileSync,mkdirSync,appendFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
export const pilotDirectory='/private/tmp/tenops-tenbot-review/ai-pilot';
export const pilotAccount='1c3296a9dced221746eb605be66df0f3';
export const pilotModel='@cf/meta/llama-3.1-8b-instruct-fp8';
export const pilotCaps={perUserDay:12,totalDay:20,perMinute:6,monthlyUsd:0.20,neuronHeadroom:2000,conservativeNeuronsPerRequest:200};
// Called only with the server's fixed fixture identity and server-built SQL.
export function pilotReservationQuery(query,user){
 if(!/^[0-9a-f-]{36}$/.test(user))throw Error('Invalid local identity');
 return `begin; do $$ begin perform pg_advisory_xact_lock(27120001); if (select count(*) from public.tenbot_usage where created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC') >= ${pilotCaps.totalDay} or (select count(*) from public.tenbot_usage where user_id='${user}'::uuid and created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC') >= ${pilotCaps.perUserDay} then raise exception 'Local pilot daily cap reached'; end if; end $$; ${query}; commit;`;
}
function freshConfirmation(value){const stamp=Date.parse(value);return Number.isFinite(stamp)&&stamp<=Date.now()&&Date.now()-stamp<=8*60*60*1000;}
export function oauthToken(){const text=readFileSync('/Users/chrisngo/.wrangler/config/default.toml','utf8');const token=text.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];if(!token)throw Error('Wrangler login unavailable');return token;}
async function cloudflare(route,body,timeoutMs=10000){
 const response=await fetch('https://api.cloudflare.com/client/v4/'+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+oauthToken(),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(timeoutMs)});
 const value=await response.json();if(!response.ok||value.success===false||value.errors?.length)throw Error('Cloudflare verification unavailable');return value;
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
export async function verifyPilot({confirmFree=false}={}){
 mkdirSync(pilotDirectory,{recursive:true});
 let prior=null;try{prior=JSON.parse(readFileSync(path.join(pilotDirectory,'ready.json'),'utf8'));}catch{}
 // The OAuth session lacks Billing Read. Chris must confirm the actual Workers
 // Free plan in Billing; no inference is allowed from an unknown or Paid plan.
 const confirmedAt=confirmFree?new Date().toISOString():prior?.freePlanConfirmedAt;
 if(!freshConfirmation(confirmedAt))throw Error('Current Workers Free dashboard confirmation required');
 const result=await cloudflare(`accounts/${pilotAccount}/ai/models/search?search=llama-3.1-8b-instruct-fp8`);
 if(!result.result?.some(model=>model.name===pilotModel))throw Error('Selected model unavailable');
 const usage=await dailyAiUsage();
 if(usage.nominalRemainingNeurons<pilotCaps.neuronHeadroom+pilotCaps.totalDay*pilotCaps.conservativeNeuronsPerRequest)throw Error('Insufficient conservative free headroom');
 const ready={ready:true,model:pilotModel,plan:'Workers Free',planEvidence:'Chris confirmed in Billing dashboard',freePlanConfirmedAt:confirmedAt,...usage,caps:pilotCaps};
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
export function pilotProvider(){
 const bridge=JSON.parse(readFileSync(path.join(pilotDirectory,'bridge.json'),'utf8'));
 let active=false;
 return {name:'Cloudflare Workers AI remote binding',async infer(input){
  if(active)throw Error('One pilot request at a time');
  active=true;
  try{
  const ready=JSON.parse(readFileSync(path.join(pilotDirectory,'ready.json'),'utf8'));
  if(ready.plan!=='Workers Free'||!freshConfirmation(ready.freePlanConfirmedAt))throw Error('Free-only verification expired');
  // Leave time for direct search before the existing browser's 20s deadline.
  const usage=await dailyAiUsage(4000);if(usage.nominalRemainingNeurons<pilotCaps.neuronHeadroom+pilotCaps.conservativeNeuronsPerRequest)throw Error('Free allowance headroom reached');
  const safe=guideOnlyInput(input);
  const started=Date.now();const response=await fetch(bridge.url+'/infer',{method:'POST',headers:{'Content-Type':'application/json','x-tenbot-pilot-key':bridge.key},body:JSON.stringify(safe),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Remote binding unavailable');
  const text=await response.text();if(text.length>16000)throw Error('Oversized binding result');const value=JSON.parse(text);
  appendFileSync(path.join(pilotDirectory,'usage.jsonl'),JSON.stringify({at:new Date().toISOString(),model:pilotModel,durationMs:Date.now()-started,usage:value.usage||{}})+'\n',{mode:0o600});
  return value.output;
  }finally{active=false;}
 }};
}
// Retrieval stays local. Neither raw employee wording nor previous chat leaves
// this process, including names, record contents, arbitrary secrets or URLs.
// This pilot evaluates model selection of vetted guidance, not free-form prose.
export function guideOnlyInput(input){
 if(input.draft)throw Error('Feature drafts remain employee-written in this pilot');
 return {question:input.excerpts[0]?.title||'No verified guide match',draft:false,excerpts:input.excerpts,context:input.context.filter(text=>/^Current module: (TenOps|Production|My Work|Settings|Contacts|Intake|Samples|Inventory|Purchasing)$/.test(text))};
}
