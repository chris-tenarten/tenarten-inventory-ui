/** Durable display in existing assistant turns; never inference context. */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Deno/Node
// @ts-ignore -- explicit Edge extension
import type {KnowledgeProof} from './tenbot-agent-history-store.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Deno/Node
// @ts-ignore -- explicit Edge extension
import type {ContextRead} from './tenbot-conversation-context.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Deno/Node
// @ts-ignore -- explicit Edge extension
import type {JobTools} from './tenbot-job-session.ts';
export type EmployeeDisplay={id:string;question:string;message:string;createdAt:string;answeredAt:string;contentScope:'workflow'|'scope'|'operational-history';scopeDigest:string;sources:KnowledgeProof[];jobIds:string[]};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
export function employeeDisplayValid(x:unknown):x is EmployeeDisplay{
 if(!object(x)||Object.keys(x).sort().join(',')!==['id','question','message','createdAt','answeredAt','contentScope','scopeDigest','sources','jobIds'].sort().join(',')||!uuid.test(String(x.id))||typeof x.question!=='string'||!x.question.length||x.question.length>1200||typeof x.message!=='string'||!x.message.length||x.message.length>2400||typeof x.createdAt!=='string'||typeof x.answeredAt!=='string'||!/^\d{4}-\d\d-\d\dT/.test(x.createdAt)||!/^\d{4}-\d\d-\d\dT/.test(x.answeredAt)||!Number.isFinite(Date.parse(x.createdAt))||!Number.isFinite(Date.parse(x.answeredAt))||Date.parse(x.createdAt)>Date.parse(x.answeredAt)||!['workflow','scope','operational-history'].includes(String(x.contentScope))||typeof x.scopeDigest!=='string'||!(/^[a-f0-9]{64}$/).test(x.scopeDigest)||!Array.isArray(x.jobIds)||x.jobIds.length>1000||x.jobIds.some(id=>typeof id!=='string'||!uuid.test(id))||!Array.isArray(x.sources)||x.sources.length>12)return false;
 return x.sources.every(p=>object(p)&&Object.keys(p).sort().join(',')==='digest,id'&&typeof p.id==='string'&&p.id.length>0&&p.id.length<=160&&typeof p.digest==='string'&&/^[a-f0-9]{64}$/.test(p.digest));
}
export function employeeDisplay(reads:ContextRead[],value:Omit<EmployeeDisplay,'jobIds'>):EmployeeDisplay|null{
 // A real executor supplies the complete checked identity set, including the
 // count population. Missing coverage never silently becomes an empty set.
 if(reads.some(r=>r.result.data!==null&&!Array.isArray(r.result.accessRefs)))return null;
 const jobIds=[...new Set(reads.flatMap(r=>r.result.accessRefs??[]))];const turn={...value,jobIds};return employeeDisplayValid(turn)?turn:null;
}
export async function restoreEmployeePage(rows:EmployeeDisplay[],tools:JobTools,scope:string,conversationId:string,now:number,sourceCurrent:(p:KnowledgeProof)=>Promise<boolean>){
 const access=new Map<string,Promise<'authorized'|'denied'|'unavailable'>>(),turns=[];
 for(const r of rows){
  let reason:'access-or-evidence-changed'|'temporarily-unavailable'|null=employeeDisplayValid(r)&&r.scopeDigest===scope?null:'access-or-evidence-changed';
  if(!reason)for(const p of r.sources)if(!await sourceCurrent(p)){reason='access-or-evidence-changed';break;}
  if(!reason&&r.jobIds.length){const key=[...r.jobIds].sort().join(',');if(!access.has(key))access.set(key,tools.authorizeHistory?tools.authorizeHistory(r.jobIds).catch(()=>'unavailable' as const):Promise.resolve('unavailable'));const state=await access.get(key)!;if(state!=='authorized')reason=state==='unavailable'?'temporarily-unavailable':'access-or-evidence-changed';}
  if(!reason)for(const p of r.sources)if(!await sourceCurrent(p)){reason='access-or-evidence-changed';break;}
  turns.push({id:r.id,question:reason?'Previous private request':r.question,createdAt:r.createdAt,answeredAt:r.answeredAt,answer:{conversationId,mode:'assistant',contentScope:r.contentScope,message:reason?'':r.message,sources:[],snapshot:{revision:'tenbot-employee-history.v1',verifiedAt:r.answeredAt},summary:null,suggestionAllowed:false,notices:[],history:{persistent:true,state:reason?'redacted':'verified',...(reason?{reason}:{}),historical:true,observedAt:r.answeredAt,checkedAt:new Date(now).toISOString()}}});
 }
 return turns;
}
