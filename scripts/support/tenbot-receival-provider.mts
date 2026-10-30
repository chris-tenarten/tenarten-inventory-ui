// Local isolated execution demonstration only. No import-time secret read or API call.
// The original localhost ledger stays frozen. This separately authorized $0.10
// slice plus the FULL hosted $4 allowance and original local usage stays <= $5.
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,mkdirSync,readFileSync,renameSync,rmdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import {AgentStepError,type AgentProvider,type AgentStepRequest} from '../../supabase/functions/_shared/tenbot-agent';
import {buildOpenAIRequest,createOpenAIProvider,OPENAI_EXPERIMENT_PRICING} from '../../supabase/functions/_shared/tenbot-openai';
import type {InvoiceImage} from './tenbot-invoice-attachment.mjs';

const MODEL='gpt-6.1-terra' as const;
const EXPIRES='2026-10-30T23:00:00Z';
const RESPONSES='https://api.openai.com/v1/responses',COUNT=RESPONSES+'/input_tokens';
const PRICE=OPENAI_EXPERIMENT_PRICING[MODEL];
type Ledger={version:1;authorizedMaximumUsd:.1;hostedMaximumUsd:4;legacyLocalUsd:number;overallMaximumUsd:5;expiresAt:typeof EXPIRES;reservedOrSpentUsd:number;attempts:number;settled:number;stopped:string|null};
type Options={authorized:boolean;directory?:string;credentialFile?:string;legacyJournal?:string;fetcher?:typeof fetch;now?:()=>number;verifyGitIgnore?:boolean};
const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function ownedFile(file:string){const s=lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||s.uid!==process.getuid?.()||(s.mode&0o077)!==0)throw Error('Owned server-only configuration required.');return readFileSync(file,'utf8');}
function frozen(file:string){const text=ownedFile(file),flags=text.split(/\r?\n/).filter(s=>s.startsWith('TENBOT_OPENAI_SPEND_AUTHORIZED='));if(flags.length!==1||flags[0].trim()!=='TENBOT_OPENAI_SPEND_AUTHORIZED=false')throw Error('Original localhost inference must remain frozen.');return text;}
function readKey(file:string){const text=frozen(file),rows=text.split(/\r?\n/).filter(s=>s.startsWith('TENBOT_OPENAI_API_KEY='));if(rows.length!==1)throw Error('Existing server credential unavailable.');let value=rows[0].slice(rows[0].indexOf('=')+1).trim();if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);if(value.length<16||/[\s\u0000-\u001f\u007f]/.test(value))throw Error('Existing server credential unavailable.');return value;}
function legacy(file:string){const v:unknown=JSON.parse(ownedFile(file));if(!object(v)||!Number.isFinite(v.reservedOrSpentUsd)||Number(v.reservedOrSpentUsd)<0||!Number.isSafeInteger(v.attempts)||v.attempts!==v.settled)throw Error('Original inference accounting requires reconciliation.');return Number(v.reservedOrSpentUsd);}

export function createReceivalLiveProviders(options:Options){
 const directory=options.directory??'/private/tmp/tenops-tenbot-receival-execution-20261030',credential=options.credentialFile??'.env.tenbot.local',oldJournal=options.legacyJournal??'/private/tmp/tenops-tenbot-agent-poc/openai-budget.json',fetcher=options.fetcher??fetch,now=options.now??Date.now;
 const journalPath=directory+'/inference-budget.json',lock=directory+'/inference-budget.lock',receiptPath=directory+'/inference-receipts.private.json';
 let ledger:Ledger|undefined,serialized:string|undefined,key:string|undefined,locked=false,closed=false,busy=false,closeRequested=false;
 const receipts:Record<string,unknown>[]=[];
 function initialize(){
  if(ledger)return;if(options.authorized!==true||closed||now()>=Date.parse(EXPIRES))throw new AgentStepError('spending-not-authorized');
  if(options.verifyGitIgnore!==false)try{execFileSync('git',['check-ignore','--quiet','--',credential],{stdio:'ignore',timeout:3000});}catch{throw Error('Server credential file must be Git-ignored.');}
  const baseline=legacy(oldJournal);if(baseline+4+.1>5+1e-9)throw Error('Original cumulative $5 authorization has no safe local headroom.');
  key=readKey(credential);mkdirSync(directory,{recursive:true});mkdirSync(lock);locked=true;
  try{
   if(existsSync(journalPath)){serialized=ownedFile(journalPath);ledger=JSON.parse(serialized) as Ledger;
    if(ledger.version!==1||ledger.authorizedMaximumUsd!==.1||ledger.hostedMaximumUsd!==4||ledger.overallMaximumUsd!==5||ledger.legacyLocalUsd!==baseline||ledger.expiresAt!==EXPIRES||!Number.isFinite(ledger.reservedOrSpentUsd)||ledger.reservedOrSpentUsd<0||ledger.reservedOrSpentUsd>.1||Math.abs(ledger.reservedOrSpentUsd*1000000-Math.round(ledger.reservedOrSpentUsd*1000000))>1e-6||!Number.isSafeInteger(ledger.attempts)||!Number.isSafeInteger(ledger.settled)||ledger.settled>ledger.attempts||!(ledger.stopped===null||typeof ledger.stopped==='string'))throw Error('Local inference ledger requires review; never reset it.');
   }else{ledger={version:1,authorizedMaximumUsd:.1,hostedMaximumUsd:4,legacyLocalUsd:baseline,overallMaximumUsd:5,expiresAt:EXPIRES,reservedOrSpentUsd:0,attempts:0,settled:0,stopped:null};save();}
  }catch(e){if(locked){rmdirSync(lock);locked=false;}ledger=undefined;throw e;}
 }
 function save(){
  if(!ledger)throw Error('Inference budget unavailable.');
  if(serialized!==undefined&&readFileSync(journalPath,'utf8')!==serialized)throw Error('Concurrent local inference accounting change.');
  const next=JSON.stringify(ledger,null,2)+'\n',temp=journalPath+'.next';writeFileSync(temp,next,{mode:0o600,flag:'wx'});renameSync(temp,journalPath);serialized=next;
 }
 function publish(){if(ledger)writeFileSync(receiptPath,JSON.stringify({receipts,budget:ledger},null,2)+'\n',{mode:0o600});}
 function stop(code:string){if(ledger){ledger.stopped=code;save();publish();}}
 function assertNoFatal(){
  if(options.authorized!==true||closed||now()>=Date.parse(EXPIRES))throw new AgentStepError('spending-not-authorized');
  frozen(credential);
  if(ledger?.stopped)throw new AgentStepError('local-inference-stopped');
  if(ledger&&legacy(oldJournal)!==ledger.legacyLocalUsd)throw new AgentStepError('local-accounting-reconciliation-required');
 }
 function remainingUsd(){return Math.max(0,.1-(ledger?.reservedOrSpentUsd??(existsSync(journalPath)?Number((JSON.parse(ownedFile(journalPath)) as Ledger).reservedOrSpentUsd):0)));}
 function close(){if(busy){closeRequested=true;return;}if(closed)return;publish();if(locked){rmdirSync(lock);locked=false;}key=undefined;closed=true;}
 function getBudget(){return ledger?structuredClone(ledger):{authorizedMaximumUsd:.1,reservedOrSpentUsd:0,attempts:0,settled:0,stopped:null};}
 function createProvider(label:string,image?:InvoiceImage):AgentProvider{
  if(typeof label!=='string'||label.length>100)throw Error('Invalid provider label.');
  return {name:'OpenAI Responses / isolated receival demo',model:MODEL,async step(request:AgentStepRequest){
   assertNoFatal();initialize();assertNoFatal();if(busy)throw new AgentStepError('local-provider-busy');if(ledger!.attempts!==ledger!.settled)throw new AgentStepError('unmeasured-charge-requires-review');if(request.maxOutputTokens*PRICE.outputPerMillion/1000000>remainingUsd())throw new AgentStepError('request-budget-unavailable');busy=true;
   const started=performance.now(),row:Record<string,unknown>={model:MODEL,label,startedAt:new Date(now()).toISOString()};receipts.push(row);
   try{
    const body=buildOpenAIRequest(MODEL,request);let extraInputTokens=0;
    if(image){
     if(image.bytes.length>90000)throw new AgentStepError('oversized-image');
     const metadata=await sharp(image.bytes,{limitInputPixels:1048576}).metadata();
     if(!metadata.width||!metadata.height||metadata.width>1024||metadata.height>1024||metadata.pages&&metadata.pages>1||metadata.format!==(image.mediaType==='image/png'?'png':'jpeg'))throw new AgentStepError('invalid-bounded-image');
     const input=body.input as Record<string,unknown>[],last=input.filter(item=>item.role==='user').at(-1);
     if(!last||typeof last.content!=='string')throw new AgentStepError('invalid-image-prompt');
     last.content=[{type:'input_text',text:last.content},{type:'input_image',image_url:`data:${image.mediaType};base64,${image.bytes.toString('base64')}`,detail:'high'}];
     // Exact model token counting supports images. Count the whole visible
     // input, then ADD that conservative bound to the ordinary byte-based hold.
     // This deliberately double-counts text; it never guesses Terra's patch rate.
     const countStart=performance.now(),count=await fetcher(COUNT,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,instructions:body.instructions,input:body.input,tools:body.tools}),signal:AbortSignal.any([request.signal,AbortSignal.timeout(10000)])});
     row.tokenCountDurationMs=Math.round(performance.now()-countStart);row.tokenCountStatus=count.status;
     if(!count.ok){stop('token-count-http-'+count.status);throw new AgentStepError('token-count-unavailable');}
     const rawCount=await count.text();if(rawCount.length>10000){stop('invalid-token-count');throw new AgentStepError('invalid-token-count');}let counted:unknown;try{counted=JSON.parse(rawCount);}catch{stop('invalid-token-count');throw new AgentStepError('invalid-token-count');}if(!object(counted)||counted.object!=='response.input_tokens'||!Number.isSafeInteger(counted.input_tokens)||Number(counted.input_tokens)<=0||Number(counted.input_tokens)>50000){stop('invalid-token-count');throw new AgentStepError('invalid-token-count');}
     extraInputTokens=Number(counted.input_tokens);row.countedInputTokens=extraInputTokens;
     row.attachment={sha256:createHash('sha256').update(image.bytes).digest('hex'),bytes:image.bytes.length,width:metadata.width,height:metadata.height,mediaType:image.mediaType,actualImage:true};
    }
    if(Buffer.byteLength(JSON.stringify(body))>180000)throw new AgentStepError('oversized-request');
    let held=0;
    const provider=createOpenAIProvider({model:MODEL,apiKey:key!,spendingAuthorized:true,pricing:PRICE,requireResponseMetadata:true,timeoutMs:30000,
     async reserveBudget(usd){
      assertNoFatal();held=Math.ceil((usd+extraInputTokens*PRICE.cacheWritePerMillion/1000000)*1000000)/1000000;
      const heldMicro=Math.round(held*1000000),usedMicro=Math.round(ledger!.reservedOrSpentUsd*1000000);
      if(!Number.isFinite(held)||heldMicro<=0||usedMicro+heldMicro>100000)throw new AgentStepError('request-budget-unavailable');
      ledger!.reservedOrSpentUsd=(usedMicro+heldMicro)/1000000;ledger!.attempts++;save();row.reservedUsd=held;let settled=false;
      return {settle(actual?:number){if(settled)return;if(actual!==undefined){const actualMicro=Math.ceil(actual*1000000);if(!Number.isFinite(actual)||actual<0||actualMicro>heldMicro){stop('reservation-bound-failure');throw Error('Inference charge exceeded its reservation.');}ledger!.reservedOrSpentUsd=(Math.round(ledger!.reservedOrSpentUsd*1000000)-heldMicro+actualMicro)/1000000;ledger!.settled++;row.measuredCostUsd=actual;row.accountedUsd=actualMicro/1000000;row.costMeasured=true;}else{row.accountedUsd=held;row.costMeasured=false;}settled=true;save();publish();}};
     },
     async fetcher(url,init){
      assertNoFatal();if(String(url)!==RESPONSES)throw new AgentStepError('unexpected-provider-endpoint');
      const start=performance.now(),response=await fetcher(RESPONSES,{...init,body:JSON.stringify(body)});row.httpStatus=response.status;row.requestId=response.headers.get('x-request-id');row.fetchToHeadersMs=Math.round(performance.now()-start);
      if(response.status>=400&&response.status<500)stop('provider-http-'+response.status);
      return response;
     },
    });
    const result=await provider.step({...request,remainingUsd:Math.min(request.remainingUsd,remainingUsd())});
    row.calls=result.calls;row.final=result.final;row.usage=result.usage;row.durationMs=Math.round(performance.now()-started);publish();assertNoFatal();return result;
   }catch(error){row.durationMs=Math.round(performance.now()-started);row.failure=error instanceof AgentStepError?error.code:'local-provider-failure';if(ledger!.attempts!==ledger!.settled&&!ledger!.stopped)stop('unmeasured-charge-requires-review');publish();throw error;}
   finally{busy=false;if(closeRequested)close();}
  }};
 }
 return {createProvider,remainingUsd,assertNoFatal,getBudget,getReceipts:()=>structuredClone(receipts),close};
}
