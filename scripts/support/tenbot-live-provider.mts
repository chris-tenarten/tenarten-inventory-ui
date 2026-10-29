// Local experiment only. All inference shares the existing, never-reset $5 journal.
// Importing this module performs no credential read, filesystem write or API call.
import {readFileSync,writeFileSync,mkdirSync,renameSync,rmdirSync,lstatSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {createOpenAIProvider,OPENAI_EXPERIMENT_PRICING,type OpenAIModel} from '../../supabase/functions/_shared/tenbot-openai';
import {AgentStepError,type AgentProvider,type AgentStepRequest} from '../../supabase/functions/_shared/tenbot-agent';

type Journal={reservedOrSpentUsd:number;attempts:number;settled:number};
type Attachment={bytes:Buffer;mediaType:'image/png'|'image/jpeg'};
const shared='/private/tmp/tenops-tenbot-agent-poc',directory='/private/tmp/tenops-tenbot-live-2026-10-29';
const journalPath=shared+'/openai-budget.json',lockPath=shared+'/openai-budget.lock',stopPath=shared+'/openai-budget.stop.json';
let journal:Journal|undefined,serialized:string|undefined,fatalReason:string|null=null;
let initialized=false,closed=false,busy=false,closeRequested=false,lastRequest=0;
const receipts:Record<string,unknown>[]=[];
function readJournal(){
 const stat=lstatSync(journalPath);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.uid!==process.getuid?.())throw Error('Existing owned budget journal required');
 const raw=readFileSync(journalPath,'utf8'),value=JSON.parse(raw) as Journal;
 if(!Number.isFinite(value.reservedOrSpentUsd)||value.reservedOrSpentUsd<0||value.reservedOrSpentUsd>5||!Number.isSafeInteger(value.attempts)||value.attempts<0||!Number.isSafeInteger(value.settled)||value.settled<0||value.settled>value.attempts)throw Error('Invalid preserved budget journal; inspect rather than reset');
 return {raw,value};
}
function initialize(){
 if(initialized)return;
 if(closed||existsSync(stopPath))throw Error('Live inference is stopped; inspect the preserved stop receipt');
 const configured=process.env.TENBOT_OPENAI_API_KEY||'';
 if(configured.length<16||process.env.TENBOT_OPENAI_SPEND_AUTHORIZED!=='true')throw Error('Server credential or spending authorization unavailable');
 const current=readJournal();
 mkdirSync(lockPath); // Atomic single writer, shared by benchmark and review server.
 initialized=true;serialized=current.raw;journal=current.value;
}
function publish(){if(initialized)writeFileSync(directory+'/network-live-'+process.pid+'.json',JSON.stringify({receipts,journal,fatalReason},null,2),{mode:0o600});}
function fatal(reason:string){
 fatalReason=reason;
 if(initialized&&!existsSync(stopPath))writeFileSync(stopPath,JSON.stringify({reason,at:new Date().toISOString(),journal},null,2),{mode:0o600,flag:'wx'});
 publish();
}
function save(){
 if(readFileSync(journalPath,'utf8')!==serialized){fatal('concurrent-budget-writer');throw Error('Concurrent budget journal change');}
 const temporary=journalPath+'.next';
 if(existsSync(temporary)){fatal('budget-recovery-required');throw Error('Budget recovery file already exists');}
 const next=JSON.stringify(journal,null,2);writeFileSync(temporary,next,{mode:0o600,flag:'wx'});renameSync(temporary,journalPath);serialized=next;
}
export function assertNoFatal(){
 if(fatalReason||closed||existsSync(stopPath))throw Error('Live inference stopped; inspect preserved evidence');
 // Honor local revocation even for an already-running server/provider. No secret
 // value is parsed or returned; the dedicated environment file stays server-only.
 const enabled=readFileSync('.env.tenbot.local','utf8').split(/\r?\n/).filter(line=>line.startsWith('TENBOT_OPENAI_SPEND_AUTHORIZED='));
 if(process.env.TENBOT_OPENAI_SPEND_AUTHORIZED!=='true'||enabled.length!==1||enabled[0].trim()!=='TENBOT_OPENAI_SPEND_AUTHORIZED=true')throw new AgentStepError('spending-not-authorized');
}
export function getJournal(){return {...(journal??readJournal().value)};}
export function getNetworkReceipts(){return structuredClone(receipts);}
export function closeBudget(){
 if(closed)return;
 if(busy){closeRequested=true;return;} // Never release a writer before its reservation settles.
 if(initialized){publish();rmdirSync(lockPath);}
 closed=true;
}
process.once('exit',()=>{if(!busy){try{closeBudget();}catch{/* Keep ambiguous lock/accounting. */}}});

export function createMeasuredProvider(model:OpenAIModel,label:string,attachment?:Attachment):AgentProvider{
 assertNoFatal();
 if(!['gpt-6.1-sol','gpt-6.1-terra'].includes(model)||typeof label!=='string'||label.length>100)throw Error('Invalid local provider configuration');
 const bytes=attachment?Buffer.from(attachment.bytes):undefined,mediaType=attachment?.mediaType;
 if(bytes&&(!['image/png','image/jpeg'].includes(String(mediaType))||bytes.length<20||bytes.length>90000))throw Error('Bounded PNG/JPEG attachment required');
 let imageMetadata:{width:number;height:number}|undefined;
 let active:Record<string,unknown>|undefined;
 const provider=createOpenAIProvider({model,apiKey:process.env.TENBOT_OPENAI_API_KEY||'',spendingAuthorized:process.env.TENBOT_OPENAI_SPEND_AUTHORIZED==='true',pricing:OPENAI_EXPERIMENT_PRICING[model],
  async reserveBudget(usd){
   assertNoFatal();initialize();
   const extra=bytes?100000*OPENAI_EXPERIMENT_PRICING[model].cacheWritePerMillion/1000000:0,held=usd+extra;
   if(!Number.isFinite(held)||held<=0||journal!.reservedOrSpentUsd+held>5){fatal('cumulative-budget-cap');throw Error('Cumulative $5 budget unavailable');}
   journal!.reservedOrSpentUsd+=held;journal!.attempts++;save();if(active)active.reservedUsd=held;
   let settled=false;
   return {settle(actual?:number){
    if(settled)return;
    if(actual!==undefined){if(!Number.isFinite(actual)||actual<0||actual>held){fatal('reservation-bound-failure');throw Error('Invalid settlement bound');}journal!.reservedOrSpentUsd+=actual-held;journal!.settled++;}
    settled=true;save();if(active){active.accountedUsd=actual??held;active.costMeasured=actual!==undefined;}publish();
   }};
  },
  async fetcher(url,init){
   assertNoFatal();if(String(url)!=='https://api.openai.com/v1/responses')throw Error('Unexpected network endpoint');
   const delay=Math.max(0,lastRequest+2500-Date.now()),pacingStart=performance.now();if(delay)await new Promise(resolve=>setTimeout(resolve,delay));assertNoFatal();
   const timing={pacingWaitMs:Math.round(performance.now()-pacingStart),fetchToHeadersMs:0,metadataParseMs:0};
   if(active){const attempts=Array.isArray(active.transportTimings)?active.transportTimings:[];attempts.push(timing);active.transportTimings=attempts;}
   const request=JSON.parse(String(init?.body));request.service_tier='default';
   if(bytes){
    const last=request.input.filter((item:Record<string,unknown>)=>item.role==='user').at(-1);
    if(!last||typeof last.content!=='string'||Buffer.byteLength(JSON.stringify(request))>50000)throw Error('Bounded attachment prompt required');
    last.content=[{type:'input_text',text:last.content},{type:'input_image',image_url:`data:${mediaType};base64,${bytes.toString('base64')}`,detail:'high'}];
    if(active)active.attachment={type:'actual input_image',sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,...imageMetadata,extraReservedInputTokens:100000};
   }
   if(Buffer.byteLength(JSON.stringify(request))>180000)throw Error('Augmented request too large');
   lastRequest=Date.now();const fetchStart=performance.now(),response=await fetch(url,{...init,body:JSON.stringify(request)});timing.fetchToHeadersMs=Math.round(performance.now()-fetchStart);
   if(response.status>=400&&response.status<500)fatal('api-access-request-rate-or-spend-failure');
   if(active){active.httpStatus=response.status;active.requestId=response.headers.get('x-request-id');}
   const metadataStart=performance.now();try{const payload=await response.clone().json();
    if(response.ok){if(active){active.apiModel=payload.model;active.apiStatus=payload.status;active.serviceTier=payload.service_tier;active.rawUsage=payload.usage;}if(payload.service_tier!=='default')fatal('unexpected-service-tier');}
    else{const safe=(value:unknown)=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value)?value:null;if(active)active.apiError={type:safe(payload.error?.type),code:safe(payload.error?.code)};}
   }catch{if(active)active.responseMetadataUnavailable=true;}finally{timing.metadataParseMs=Math.round(performance.now()-metadataStart);}
   publish();return response;
  },
 });
 return {name:provider.name,model:provider.model,async step(request:AgentStepRequest){
  assertNoFatal();initialize();
  if(busy)throw new AgentStepError('local-provider-busy');
  busy=true;const row:Record<string,unknown>={model,label,startedAt:new Date().toISOString()};active=row;receipts.push(row);const start=performance.now();
  try{
   if(bytes){const metadata=await sharp(bytes,{limitInputPixels:1048576}).metadata();if(metadata.width===undefined||metadata.height===undefined||metadata.width>1024||metadata.height>1024||metadata.pages&&metadata.pages>1||metadata.format!==(mediaType==='image/png'?'png':'jpeg'))throw new AgentStepError('invalid-bounded-image');imageMetadata={width:metadata.width,height:metadata.height};}
   const result=await provider.step(request);row.durationMs=Math.round(performance.now()-start);row.calls=result.calls;row.final=result.final;row.usage=result.usage;publish();assertNoFatal();return result;
  }catch(error){row.durationMs=Math.round(performance.now()-start);row.providerFailure=(error as {code?:string}).code??'local-failure';row.usage=(error as {usage?:unknown}).usage;if(['missing-provider-usage','invalid-usage','request-budget-unavailable'].includes(String(row.providerFailure)))fatal('usage-or-budget-control-failure');publish();throw error;}
  finally{active=undefined;busy=false;if(closeRequested)closeBudget();}
 }};
}
