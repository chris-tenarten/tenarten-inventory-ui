// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit Deno extension
import {parseJobStatuses} from './tenbot-job-filters.ts';
/** Short-lived private rendered answers, never model context or tool snapshots.
 * Restore only after the exact existing caller-authorized reads still match. */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Edge/Node shared source
// @ts-ignore -- Deno requires explicit extensions.
import type {JobTools} from './tenbot-job-session.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Edge/Node shared source
// @ts-ignore -- Deno requires explicit extensions.
import type {ContextRead} from './tenbot-conversation-context.ts';
export const OPERATIONAL_HISTORY_TTL=10*60*1000;
const names=['find_jobs','get_production_overview','get_job_summary','get_job_planning','get_job_labor_summary'];
const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const exact=(x:Record<string,unknown>,keys:string[])=>Object.keys(x).length===keys.length&&Object.keys(x).every(k=>keys.includes(k));
const text=(x:unknown,n:number)=>typeof x==='string'&&x.length>0&&x.length<=n;
const stamp=(x:unknown)=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT/.test(x)&&Number.isFinite(Date.parse(x));
const digest=(x:unknown)=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const uuid=(x:unknown)=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x);
export type OperationalReceipt={id:string;question:string;message:string;createdAt:string;answeredAt:string;expiresAt:string;scopeDigest:string;sources:{id:string;digest:string}[];reads:{name:ContextRead['name'];args:Record<string,unknown>;digest:string}[]};
export function validOperationalReceipt(x:unknown):x is OperationalReceipt{
 if(!record(x)||!exact(x,['id','question','message','createdAt','answeredAt','expiresAt','scopeDigest','sources','reads'])||!uuid(x.id)||!text(x.question,1200)||!text(x.message,2400)||!stamp(x.createdAt)||!stamp(x.answeredAt)||!stamp(x.expiresAt)||!digest(x.scopeDigest)||Date.parse(String(x.createdAt))>Date.parse(String(x.answeredAt))||Date.parse(String(x.expiresAt))<=Date.parse(String(x.answeredAt))||Date.parse(String(x.expiresAt))-Date.parse(String(x.answeredAt))>OPERATIONAL_HISTORY_TTL||!Array.isArray(x.sources)||x.sources.length>12||x.sources.some(p=>!record(p)||!exact(p,['id','digest'])||!text(p.id,160)||!digest(p.digest))||!Array.isArray(x.reads)||x.reads.length<1||x.reads.length>4)return false;
 return x.reads.every(r=>{
  if(!record(r)||!exact(r,['name','args','digest'])||!names.includes(String(r.name))||!digest(r.digest)||!record(r.args)||JSON.stringify(r.args).length>512)return false;
  const allowed=r.name==='find_jobs'?['query','include_archived','limit','cursor','statuses']:r.name==='get_production_overview'?['include_archived','start_date','end_date','limit','statuses']:r.name==='get_job_labor_summary'?['job_id','start_date','end_date','scope']:['job_id'];
  if(Object.keys(r.args).some(k=>!allowed.includes(k)))return false;
  for(const[k,v]of Object.entries(r.args)){if(k==='statuses'&&(!Array.isArray(v)||parseJobStatuses(v)===null)||k==='scope'&&v!=='all_recorded'||k==='job_id'&&!uuid(v)||k==='include_archived'&&typeof v!=='boolean'||k==='limit'&&(!Number.isInteger(v)||Number(v)<1||Number(v)>20)||k==='query'&&(typeof v!=='string'||v.length>120||/[\u0000-\u001f\u007f]/.test(v))||k==='cursor'&&(typeof v!=='string'||!/^\d{1,4}$/.test(v))||['start_date','end_date'].includes(k)&&(typeof v!=='string'||!/^\d{4}-\d\d-\d\d$/.test(v)))return false;}
  return !String(r.name).startsWith('get_job_')||uuid(r.args.job_id);
 });
}
export async function operationalDigest(result:ContextRead['result']){const bytes=new TextEncoder().encode(JSON.stringify({data:result.data,status:result.status,complete:result.complete,truncated:result.truncated,unknowns:result.unknowns,filters:result.filters}));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');}
export async function operationalReceipt(reads:ContextRead[],question:string,message:string,createdAt:string,now:number,scopeDigest:string,sources:OperationalReceipt['sources']=[]):Promise<OperationalReceipt|null>{
 if(!reads.length||reads.length>4||reads.some(r=>r.result.status!=='ok'||!r.result.complete))return null;
 const value={id:crypto.randomUUID(),question,message:message.slice(0,2400),createdAt,answeredAt:new Date(now).toISOString(),expiresAt:new Date(now+OPERATIONAL_HISTORY_TTL).toISOString(),scopeDigest,sources:structuredClone(sources),reads:await Promise.all(reads.map(async r=>({name:r.name,args:structuredClone(r.args),digest:await operationalDigest(r.result)})))};
 return validOperationalReceipt(value)?value:null;
}
export const operationalHistoryMeta=(r:OperationalReceipt,now:number,historical=true)=>({state:'verified' as const,historical,observedAt:r.answeredAt,checkedAt:new Date(now).toISOString(),expiresAt:r.expiresAt});
/** At most sixteen distinct existing read calls (four receipts × four reads) per hydration, with request-local
 * deduplication only. Neither receipt prose nor digests reach model prompts. */
export async function restoreOperationalHistory(rows:OperationalReceipt[],tools:JobTools,now:number,scope:string,conversationId:string,mode:string,sourceCurrent:(proof:{id:string;digest:string})=>Promise<boolean>){
 const cache=new Map<string,Promise<{digest:string|null;retryable:boolean}>>(),kept:OperationalReceipt[]=[],retained:OperationalReceipt[]=[],turns=[];
 // Newest first, but every valid receipt fits the strict four-by-four bound.
 for(const r of rows.slice(-4).reverse()){
  let reason:'expired'|'access-or-evidence-changed'|'temporarily-unavailable'|null=null;
  if(!validOperationalReceipt(r)||Date.parse(r.expiresAt)<=now||Date.parse(r.answeredAt)>now)reason='expired';
  else if(r.scopeDigest!==scope)reason='access-or-evidence-changed';
  if(!reason)for(const proof of r.sources)if(!await sourceCurrent(proof)){reason='access-or-evidence-changed';break;}
  if(!reason)for(const read of r.reads){
   const key=JSON.stringify([read.name,read.args]);
   if(!cache.has(key)){
    if(cache.size>=16){reason='temporarily-unavailable';break;}
    cache.set(key,(async()=>{try{const result=await tools.execute(read.name,read.args);return {digest:result.status==='ok'&&result.complete?await operationalDigest(result):null,retryable:result.status==='unavailable'||result.status==='partial'};}catch{return {digest:null,retryable:true};}})());
   }
   const checked=await cache.get(key)!;
   if(checked.digest!==read.digest){reason=checked.retryable?'temporarily-unavailable':'access-or-evidence-changed';break;}
  }
  if(!reason)for(const proof of r.sources)if(!await sourceCurrent(proof)){reason='access-or-evidence-changed';break;}
  if(!reason)kept.push(r);
  // A failed read cannot authorize display, nor does it prove revocation. Keep
  // only the already bounded private receipt for a later *fresh* read. It never
  // enters a prompt or an HTTP response until all checks succeed again.
  if(!reason||reason==='temporarily-unavailable')retained.push(r);
  turns.push({id:r.id,question:reason?'Previous operational request':r.question,createdAt:r.createdAt,answeredAt:r.answeredAt,answer:{conversationId,mode,contentScope:'operational-history',message:reason?'':r.message,sources:[],snapshot:{revision:'tenbot-job-read.v1',verifiedAt:r.answeredAt},summary:null,suggestionAllowed:false,notices:[],history:reason?{state:'redacted' as const,reason,historical:true,observedAt:r.answeredAt,checkedAt:new Date(now).toISOString(),expiresAt:r.expiresAt}:operationalHistoryMeta(r,now)}});
 }
 const chronological=(a:OperationalReceipt,b:OperationalReceipt)=>a.createdAt.localeCompare(b.createdAt);
 return {kept:kept.sort(chronological),retained:retained.sort(chronological),turns:turns.sort((a,b)=>a.createdAt.localeCompare(b.createdAt))};
}
