/** Owner-scoped query selectors, never retained operational answers or tool data. */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit extension required by Deno.
import type {JobTools} from './tenbot-job-session.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit extension required by Deno.
import type {JobToolResult,TenbotJobToolName} from './tenbot-job-tools.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit extension required by Deno.
import {ACTIVE_PRODUCTION_STATUSES} from './production-job-facts.mjs';

export const CONTEXT_TTL_MS=30*60*1000;
const subjects=['Production','Job','Intake','Inventory','Purchasing','Planning','Messaging','My Work','Settings','Contacts','Samples','Proposals','Manpower Reporting','TenOps'];
const operations=['get_production_overview','find_jobs','get_job_summary','get_job_planning','get_job_labor_summary','guidance','scope'];
const statuses=['not_started','on_deck','in_production','on_hold','shipped','complete','cancelled'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const keys=(x:Record<string,unknown>,names:string[])=>Object.keys(x).length===names.length&&Object.keys(x).every(k=>names.includes(k));
const date=(x:unknown)=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
const stamp=(x:unknown)=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT/.test(x)&&Number.isFinite(Date.parse(x));
export type ConversationContext={version:1;subject:string;operation:string;resultType:'count'|'collection'|'record'|'guidance'|'scope'|'clarification';references:string[];selection:{query:string;includeArchived:boolean;statuses:string[];startDate:string|null;endDate:string|null};sources:{id:string;digest:string}[];awaitingClarification:boolean;updatedAt:string;expiresAt:string};
export type ContextRead={name:TenbotJobToolName;args:Record<string,unknown>;result:JobToolResult};
export function validConversationContext(value:unknown):value is ConversationContext{
 if(!object(value)||!keys(value,['version','subject','operation','resultType','references','selection','sources','awaitingClarification','updatedAt','expiresAt'])||JSON.stringify(value).length>4096||value.version!==1||!subjects.includes(String(value.subject))||!operations.includes(String(value.operation))||!['count','collection','record','guidance','scope','clarification'].includes(String(value.resultType))||typeof value.awaitingClarification!=='boolean'||!stamp(value.updatedAt)||!stamp(value.expiresAt))return false;
 const delta=Date.parse(String(value.expiresAt))-Date.parse(String(value.updatedAt));if(delta<=0||delta>CONTEXT_TTL_MS)return false;
 if(!Array.isArray(value.references)||value.references.length>4||value.references.some(x=>typeof x!=='string'||!uuid.test(x))||new Set(value.references).size!==value.references.length)return false;
 const s=value.selection;if(!object(s)||!keys(s,['query','includeArchived','statuses','startDate','endDate'])||typeof s.query!=='string'||s.query.length>120||/[\u0000-\u001f\u007f]/.test(s.query)||typeof s.includeArchived!=='boolean'||!Array.isArray(s.statuses)||s.statuses.length>7||s.statuses.some(x=>!statuses.includes(String(x)))||new Set(s.statuses).size!==s.statuses.length)return false;
 if(s.startDate!==null||s.endDate!==null){if(!date(s.startDate)||!date(s.endDate)||String(s.startDate)>String(s.endDate)||Date.parse(String(s.endDate))-Date.parse(String(s.startDate))>=366*86400000)return false;}
 return Array.isArray(value.sources)&&value.sources.length<=12&&value.sources.every(x=>object(x)&&keys(x,['id','digest'])&&typeof x.id==='string'&&x.id.length>0&&x.id.length<=160&&typeof x.digest==='string'&&/^[a-f0-9]{64}$/.test(x.digest));
}
export const contextLive=(value:unknown,now:number):value is ConversationContext=>validConversationContext(value)&&Date.parse(value.updatedAt)<=now&&Date.parse(value.expiresAt)>now;
function resultJobId(result:JobToolResult):string|null{const data:unknown=result.data;return object(data)&&object(data.job)&&typeof data.job.job_id==='string'&&uuid.test(data.job.job_id)?data.job.job_id:null;}
/** A reference grants nothing. Check current caller-visible records before using
 * a seed, even when it came from this owner's previous authorized turn. */
export async function currentConversationContext(value:unknown,now:number,tools:JobTools,sourceCurrent:(p:{id:string;digest:string})=>Promise<boolean>,persistent=false):Promise<ConversationContext|null>{
 if(!validConversationContext(value)||Date.parse(value.updatedAt)>now||!persistent&&Date.parse(value.expiresAt)<=now)return null;
 for(const proof of value.sources)if(!await sourceCurrent(proof))return null;
 if(persistent&&value.references.length&&tools.authorizeHistory){
  const access=await tools.authorizeHistory(value.references);
  if(access==='unavailable')throw new Error('Current conversation access could not be verified.');
  if(access!=='authorized')return null;
 }else for(const id of value.references){const r=await tools.execute('get_job_summary',{job_id:id});if(r.status!=='ok'||!r.complete||resultJobId(r)!==id)return null;}
 return persistent?{...structuredClone(value),updatedAt:new Date(now).toISOString(),expiresAt:new Date(now+CONTEXT_TTL_MS).toISOString()}:structuredClone(value);
}
export function requestedJobStatuses(question:string):string[]{
 const q=question.toLowerCase().replace(/\s+/g,' ');if(/\bactive\b/.test(q))return [...ACTIVE_PRODUCTION_STATUSES];
 // These are existing canonical lifecycle labels, not an extensible intent router.
 return statuses.filter(s=>new RegExp('\\b'+s.replaceAll('_','[ -]')+'\\b','i').test(q));
}
export function contextFromReads(reads:ContextRead[],question:string,now:number,previous:ConversationContext|null=null):ConversationContext|null{
 const successful=reads.filter(x=>x.result.status==='ok'&&x.result.complete&&x.result.data);if(!successful.length)return null;
 const last=successful.at(-1)!,details=successful.filter(x=>resultJobId(x.result));
 const references=[...new Set(details.map(x=>resultJobId(x.result)!))];
 // Do not turn a multi-record comparison into an arbitrary last-record focus.
 if(references.length>4)return null;
 const f=last.result.filters,a=last.args,period=typeof a.start_date==='string'&&a.start_date&&typeof a.end_date==='string'&&a.end_date?{startDate:a.start_date,endDate:a.end_date}:last.name==='get_job_labor_summary'&&typeof f.start_date==='string'&&typeof f.end_date==='string'?{startDate:f.start_date,endDate:f.end_date}:{startDate:null,endDate:null};
 const value:ConversationContext={version:1,subject:details.length?'Job':'Production',operation:last.name,resultType:details.length?'record':last.name==='get_production_overview'?'count':'collection',references,selection:{query:typeof a.query==='string'?a.query:'',includeArchived:a.include_archived===true,statuses:requestedJobStatuses(question),...period},sources:[],awaitingClarification:false,updatedAt:new Date(now).toISOString(),expiresAt:new Date(now+CONTEXT_TTL_MS).toISOString()};
 if(value.subject==='Job'&&previous?.subject==='Job'&&JSON.stringify(previous.references)===JSON.stringify(references)&&!value.selection.startDate&&last.name!=='get_job_labor_summary'){
  value.selection.startDate=previous.selection.startDate;value.selection.endDate=previous.selection.endDate;
 }
 if(last.name==='find_jobs'&&previous?.subject==='Production'&&!value.selection.statuses.length)value.selection.statuses=[...previous.selection.statuses];
 // Overview dates bound upcoming completions, never the current count population.
 if(last.name==='get_production_overview'&&!/\b(?:upcoming|finish|finishing|due|completion dates?)\b/i.test(question)){value.selection.startDate=null;value.selection.endDate=null;}
 return validConversationContext(value)?value:null;
}
export function workflowConversationContext(subject:string,sources:ConversationContext['sources'],clarify:boolean,now:number):ConversationContext{
 return {version:1,subject:subjects.find(x=>x.toLowerCase()===subject.toLowerCase())??'TenOps',operation:'guidance',resultType:clarify?'clarification':'guidance',references:[],selection:{query:'',includeArchived:false,statuses:[],startDate:null,endDate:null},sources:structuredClone(sources),awaitingClarification:clarify,updatedAt:new Date(now).toISOString(),expiresAt:new Date(now+CONTEXT_TTL_MS).toISOString()};
}
export function conversationContextHint(context:ConversationContext){const {subject,operation,resultType,references,selection,awaitingClarification}=context;return 'Conversation subject and lookup selectors only (not current facts or permission): '+JSON.stringify({subject,operation,resultType,references,selection,awaitingClarification})+'. Requery current tools before answering operational follow-ups. Do not treat the prior count, statuses or hours as known. Multiple references require a clear selection. Never invent Bid/material relationships: no Bid or live Inventory read tool is available. Verified prior workflow dialogue describes the walkthrough step, not a completed database action.';}
