/** Default-off expiry maintenance. Public queues carry only a short-lived,
 * single-use HMAC wake; the service credential stays inside the Edge entry. */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- explicit local extension is required by Edge bundling.
import {cleanupExpiredInvoiceReceivalSources} from '../../../src/modules/inventory/invoice-receival-attachments.ts';
import type {InvoiceReceivalCaller} from '../../../src/modules/inventory/invoice-receival-service.ts';
export const RECEIVAL_CLEANUP_PURPOSE='invoice-original-expiry' as const;
export type ReceivalCleanupWake={v:1;purpose:typeof RECEIVAL_CLEANUP_PURPOSE;run_id:string;exp:number;limit:number;sig:string};
type RpcResult=Awaited<ReturnType<InvoiceReceivalCaller['rpc']>>;
type CleanupDependencies={
 enabled:boolean;wakeSecret:string;
 rpc:(name:string,args:Record<string,unknown>,signal:AbortSignal)=>PromiseLike<RpcResult>;
 remove:(paths:string[],signal:AbortSignal)=>Promise<{error:unknown}>;
 now?:()=>number;
};
const cleanupRpcs=new Set(['claim_expired_invoice_receival_sources','finish_expired_invoice_receival_source_removal']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply=(status:number,value:Record<string,unknown>)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export const receivalCleanupWakeText=(wake:Omit<ReceivalCleanupWake,'sig'>)=>`v1\n${wake.purpose}\n${wake.run_id}\n${wake.exp}\n${wake.limit}`;
function wakeShape(value:unknown):value is ReceivalCleanupWake{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>;
 return Object.keys(v).length===6&&Object.keys(v).every(k=>['v','purpose','run_id','exp','limit','sig'].includes(k))&&v.v===1&&v.purpose===RECEIVAL_CLEANUP_PURPOSE
  &&typeof v.run_id==='string'&&uuid.test(v.run_id)&&Number.isSafeInteger(v.exp)&&Number.isSafeInteger(v.limit)&&Number(v.limit)>=1&&Number(v.limit)<=20&&typeof v.sig==='string'&&/^[a-f0-9]{64}$/.test(v.sig);
}
export async function verifyReceivalCleanupWake(value:unknown,secret:string,now=Date.now()):Promise<boolean>{
 if(!wakeShape(value)||secret.length<32||secret.length>256||/[\u0000-\u001f\u007f]/.test(secret)||value.exp<now/1000||value.exp>now/1000+120)return false;
 try{
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  return await crypto.subtle.verify('HMAC',key,Uint8Array.from(value.sig.match(/../g)!,part=>parseInt(part,16)),new TextEncoder().encode(receivalCleanupWakeText(value)));
 }catch{return false;}
}
async function boundedBody(request:Request):Promise<string>{
 const declared=request.headers.get('content-length');if(declared&&(!/^\d+$/.test(declared)||Number(declared)>1024))throw Error('body_too_large');
 const reader=request.body?.getReader();if(!reader)throw Error('invalid_body');
 let size=0,timer:ReturnType<typeof setTimeout>|undefined;const chunks:Uint8Array[]=[];
 const abort=new AbortController(),cancel=()=>abort.abort();request.signal.addEventListener('abort',cancel,{once:true});
 try{
  return await Promise.race([(async()=>{for(;;){if(request.signal.aborted)throw Error('cleanup_cancelled');const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>1024)throw Error('body_too_large');chunks.push(part.value);}const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.byteLength;}return new TextDecoder('utf-8',{fatal:true}).decode(bytes);})(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('body_timeout')),2000);abort.signal.addEventListener('abort',()=>reject(Error('cleanup_cancelled')),{once:true});})]);
 }finally{if(timer)clearTimeout(timer);request.signal.removeEventListener('abort',cancel);void reader.cancel().catch(()=>{}).finally(()=>{try{reader.releaseLock();}catch{/* A cancelled pending read must not extend the body deadline. */}});}
}
async function untilAbort<T>(operation:PromiseLike<T>,signal:AbortSignal):Promise<T>{
 if(signal.aborted)throw Error('cleanup_cancelled');
 let stop:(()=>void)|undefined;
 try{return await Promise.race([Promise.resolve(operation),new Promise<never>((_,reject)=>{stop=()=>reject(Error('cleanup_cancelled'));signal.addEventListener('abort',stop,{once:true});})]);}
 finally{if(stop)signal.removeEventListener('abort',stop);}
}
export function createTenbotReceivalCleanupHandler(deps:CleanupDependencies){
 const now=deps.now??Date.now;
 return async(request:Request):Promise<Response>=>{
  if(request.method!=='POST')return reply(405,{error:'method_not_allowed'});
  if(deps.enabled!==true)return reply(503,{error:'cleanup_disabled'});
  if(deps.wakeSecret.length<32||deps.wakeSecret.length>256||/[\u0000-\u001f\u007f]/.test(deps.wakeSecret))return reply(503,{error:'cleanup_unavailable'});
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')??''))return reply(415,{error:'json_required'});
  let body:unknown;
  try{body=JSON.parse(await boundedBody(request));}catch(error){return reply(error instanceof Error&&error.message==='body_too_large'?413:error instanceof Error&&error.message==='cleanup_cancelled'?408:400,{error:'invalid_cleanup_request'});}
  if(!wakeShape(body))return reply(400,{error:'invalid_cleanup_request'});
  if(!await verifyReceivalCleanupWake(body,deps.wakeSecret,now()))return reply(401,{error:'unauthorized'});
  if(request.signal.aborted)return reply(408,{error:'cleanup_cancelled'});
  const wake=body,deadline=now()+90000,signal=AbortSignal.any([request.signal,AbortSignal.timeout(90000)]);
  const checkpoint=()=>{if(signal.aborted||now()>deadline)throw Error('cleanup_cancelled');};
  const call=async(name:string,args:Record<string,unknown>)=>{checkpoint();const result=await untilAbort(deps.rpc(name,args,signal),signal);checkpoint();return result;};
  let consumed=false;
  async function finish(status:'succeeded'|'failed'|'cancelled',removed:number|null){
   // Count-only final status may outlive a cancelled request by at most5seconds;
   // this cannot claim/delete a source or authorize another cleanup invocation.
   const statusSignal=AbortSignal.timeout(5000),result=await untilAbort(deps.rpc('finish_invoice_receival_cleanup_run',{p_id:wake.run_id,p_status:status,p_removed_count:removed},statusSignal),statusSignal);
   if(result.error||result.data!==true)throw Error('cleanup_status_incomplete');
  }
  try{
   checkpoint();const accepted=await untilAbort(deps.rpc('consume_invoice_receival_cleanup_run',{p_id:wake.run_id,p_exp:wake.exp,p_limit:wake.limit},signal),signal);
   if(accepted.error)throw Error('cleanup_consume_uncertain');
   if(accepted.data!==true)return reply(409,{error:'cleanup_replayed_or_unavailable'});
   consumed=true;checkpoint();
   const result=await cleanupExpiredInvoiceReceivalSources({rpc:(name,args)=>{if(!cleanupRpcs.has(name))throw Error('unsupported_cleanup_rpc');return call(name,args);}},async(path)=>{checkpoint();if((await untilAbort(deps.remove([path],signal),signal)).error)throw Error('cleanup_delete_failed');checkpoint();},wake.limit);
   checkpoint();await finish('succeeded',result.removedSourceIds.length);
   return reply(200,{removedCount:result.removedSourceIds.length});
  }catch{
   if(consumed){try{await finish(signal.aborted||now()>deadline?'cancelled':'failed',null);}catch{/* Private run remains unfinished; monitoring must flag it. */}}
   return reply(signal.aborted||request.signal.aborted||now()>deadline?408:503,{error:signal.aborted||request.signal.aborted||now()>deadline?'cleanup_cancelled':'cleanup_incomplete'});
  }
 };
}
