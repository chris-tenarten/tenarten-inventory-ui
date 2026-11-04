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
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit Edge extension.
import {JOB_LIFECYCLE_STATUSES,parseJobStatuses} from './tenbot-job-filters.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit Edge extension, type-only dependency.
import type {JobIntent} from './tenbot-job-routing.ts';

export const CONTEXT_TTL_MS=30*60*1000;
const subjects=['Production','Job','Intake','Inventory','Purchasing','Planning','Messaging','My Work','Settings','Contacts','Samples','Proposals','Manpower Reporting','TenOps'];
const operations=['get_production_overview','find_jobs','get_job_summary','get_job_planning','get_job_labor_summary','guidance','scope'];
const statuses:readonly string[]=JOB_LIFECYCLE_STATUSES;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const keys=(x:Record<string,unknown>,names:string[])=>Object.keys(x).length===names.length&&Object.keys(x).every(k=>names.includes(k));
const date=(x:unknown)=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
const stamp=(x:unknown)=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT/.test(x)&&Number.isFinite(Date.parse(x));
export type ConversationContext={version:1;subject:string;operation:string;resultType:'count'|'collection'|'record'|'guidance'|'scope'|'clarification';references:string[];selection:{query:string;includeArchived:boolean;statuses:string[];startDate:string|null;endDate:string|null;laborScope?:'all_recorded'};sources:{id:string;digest:string}[];awaitingClarification:boolean;updatedAt:string;expiresAt:string};
export type ContextRead={name:TenbotJobToolName;args:Record<string,unknown>;result:JobToolResult};
export function validConversationContext(value:unknown):value is ConversationContext{
 if(!object(value)||!keys(value,['version','subject','operation','resultType','references','selection','sources','awaitingClarification','updatedAt','expiresAt'])||JSON.stringify(value).length>4096||value.version!==1||!subjects.includes(String(value.subject))||!operations.includes(String(value.operation))||!['count','collection','record','guidance','scope','clarification'].includes(String(value.resultType))||typeof value.awaitingClarification!=='boolean'||!stamp(value.updatedAt)||!stamp(value.expiresAt))return false;
 const delta=Date.parse(String(value.expiresAt))-Date.parse(String(value.updatedAt));if(delta<=0||delta>CONTEXT_TTL_MS)return false;
 if(!Array.isArray(value.references)||value.references.length>4||value.references.some(x=>typeof x!=='string'||!uuid.test(x))||new Set(value.references).size!==value.references.length)return false;
 const s=value.selection;if(!object(s)||!keys(s,['query','includeArchived','statuses','startDate','endDate',...(s.laborScope===undefined?[]:['laborScope'])])||s.laborScope!==undefined&&(s.laborScope!=='all_recorded'||s.startDate!==null||s.endDate!==null)||typeof s.query!=='string'||s.query.length>120||/[\u0000-\u001f\u007f]/.test(s.query)||typeof s.includeArchived!=='boolean'||!Array.isArray(s.statuses)||s.statuses.length>7||s.statuses.some(x=>!statuses.includes(String(x)))||new Set(s.statuses).size!==s.statuses.length)return false;
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
 const q=question.toLowerCase().replace(/\s+/g,' ');
 // These are existing canonical lifecycle labels, not an extensible intent router.
 const selected=statuses.filter(s=>new RegExp('\\b'+s.replaceAll('_','[ -]')+'\\b','i').test(q));
 if(/\bactive\b/.test(q)){const narrowed=selected.filter(s=>s!=='in_production');return narrowed.length&&narrowed.every(s=>ACTIVE_PRODUCTION_STATUSES.includes(s))?narrowed:[...ACTIVE_PRODUCTION_STATUSES];}
 return selected;
}
function collectionReferences(result:JobToolResult):string[]{
 const data:unknown=result.data;
 if(result.tool!=='find_jobs'||result.status!=='ok'||!result.complete||result.truncated||Number(result.filters.cursor??0)!==0||!object(data)||data.has_more!==false||data.next_cursor!==null||!Array.isArray(data.jobs)||data.jobs.length>4)return [];
 // Named results narrowed by a generated lifecycle filter cannot establish
 // name uniqueness or seed a later detail read that skips fresh resolution.
 if(result.filters.query&&Array.isArray(result.filters.statuses)&&result.filters.statuses.length)return [];
 const ids=data.jobs.map(j=>object(j)&&typeof j.job_id==='string'&&uuid.test(j.job_id)?j.job_id:null);
 return ids.every((id):id is string=>id!==null)&&new Set(ids).size===ids.length?ids:[];
}
const detailTools=['get_job_summary','get_job_planning','get_job_labor_summary'];
export function contextFromReads(reads:ContextRead[],question:string,now:number,previous:ConversationContext|null=null,requested?:JobIntent):ConversationContext|null{
 // The deployed SQL context is exactly five selector fields. A schedule
 // population cannot be represented there: clear it instead of retaining a
 // falsely unfiltered collection. Prior employee questions remain separately
 // owner-authorized context for a fresh model-selected lookup after reload.
 if(reads.some(r=>[r.args.schedule,r.result.filters.schedule].some(s=>s!==undefined&&s!=='all')))return null;
 // A partial batch must not turn its last successful record into the group's
 // focus, or retain IDs from a denied/missing detail operation.
 if(reads.some(r=>detailTools.includes(r.name)&&(r.result.status!=='ok'||!r.result.complete||!resultJobId(r.result))))return null;
 const successful=reads.filter(x=>x.result.status==='ok'&&x.result.complete&&x.result.data);if(!successful.length)return null;
 const requestedDetail=requested&&(requested.kind==='job'||requested.kind==='jobs')?requested.tool:null;
 // Auxiliary lookups must not replace the operation the employee requested.
 const last=(requestedDetail?[...successful].reverse().find(r=>r.name===requestedDetail):undefined)??successful.at(-1)!,isDetail=detailTools.includes(last.name),details=successful.filter(x=>resultJobId(x.result));
 const references=isDetail?[...new Set(details.map(x=>resultJobId(x.result)!) )]:last.name==='find_jobs'?collectionReferences(last.result):[];
 if(references.length>4)return null;
 const pending=requested?.kind==='job'&&last.name==='find_jobs';
 const f=last.result.filters,a=last.args,periodArgs=pending?requested.args:a,period=typeof periodArgs.start_date==='string'&&periodArgs.start_date&&typeof periodArgs.end_date==='string'&&periodArgs.end_date?{startDate:periodArgs.start_date,endDate:periodArgs.end_date}:last.name==='get_job_labor_summary'&&typeof f.start_date==='string'&&typeof f.end_date==='string'?{startDate:f.start_date,endDate:f.end_date}:{startDate:null,endDate:null};
 // A complete unique named lookup has established a canonical subject, not
 // an instruction to repeat the previous search for every new objective.
 const namedRecord=last.name==='find_jobs'&&references.length===1&&typeof f.query==='string'&&f.query.trim().length>0;
 const record=isDetail||namedRecord;
 const value:ConversationContext={version:1,subject:record||pending?'Job':'Production',operation:pending?requested.tool:last.name,resultType:pending?'clarification':record?'record':last.name==='get_production_overview'?'count':'collection',references,selection:{query:record?'':typeof f.query==='string'?f.query:typeof a.query==='string'?a.query:'',includeArchived:f.include_archived===undefined?a.include_archived===true:f.include_archived===true,statuses:record?[]:f.statuses===undefined?requestedJobStatuses(question):parseJobStatuses(f.statuses)??[],...period,...(last.name==='get_job_labor_summary'&&f.scope==='all_recorded'?{laborScope:'all_recorded' as const}:{})},sources:[],awaitingClarification:pending,updatedAt:new Date(now).toISOString(),expiresAt:new Date(now+CONTEXT_TTL_MS).toISOString()};
 if(value.subject==='Job'&&previous?.subject==='Job'&&JSON.stringify(previous.references)===JSON.stringify(references)&&!value.selection.startDate&&last.name!=='get_job_labor_summary'){
  value.selection.startDate=previous.selection.startDate;value.selection.endDate=previous.selection.endDate;if(previous.selection.laborScope)value.selection.laborScope=previous.selection.laborScope;
 }
 if(!record&&last.name==='find_jobs'&&previous?.subject==='Production'&&f.statuses===undefined&&!value.selection.statuses.length)value.selection.statuses=[...previous.selection.statuses];
 // Overview dates bound upcoming completions, never the current count population.
 if(last.name==='get_production_overview'&&!/\b(?:upcoming|finish|finishing|due|completion dates?)\b/i.test(question)){value.selection.startDate=null;value.selection.endDate=null;}
 return validConversationContext(value)?value:null;
}
export function workflowConversationContext(subject:string,sources:ConversationContext['sources'],clarify:boolean,now:number):ConversationContext{
 return {version:1,subject:subjects.find(x=>x.toLowerCase()===subject.toLowerCase())??'TenOps',operation:'guidance',resultType:clarify?'clarification':'guidance',references:[],selection:{query:'',includeArchived:false,statuses:[],startDate:null,endDate:null},sources:structuredClone(sources),awaitingClarification:clarify,updatedAt:new Date(now).toISOString(),expiresAt:new Date(now+CONTEXT_TTL_MS).toISOString()};
}
export function conversationContextHint(context:ConversationContext){const {subject,operation,resultType,references,selection,awaitingClarification}=context;return 'Conversation subject and lookup selectors only (not current facts or permission): '+JSON.stringify({subject,operation,resultType,references,selection,awaitingClarification})+'. The latest employee question determines the objective. operation and resultType describe the previous turn, not which tool or facts to repeat now. Preserve a resolved Job subject while choosing and querying current tools for the new objective. Do not treat the prior count, statuses or hours as known. References identify only previously resolved canonical Jobs, never authorization. A complete small collection may retain up to four IDs while its subject stays Production. A singular reference requires exactly one current ID; explicit plural detail requests may use the whole retained set. Partial/paginated collections do not imply a unique Job. A pending clarification retains only the requested operation and period until an exact Job selection is authorized. Never invent Bid/material relationships: no Bid or live Inventory read tool is available. Verified prior workflow dialogue describes the walkthrough step, not a completed database action.';}
