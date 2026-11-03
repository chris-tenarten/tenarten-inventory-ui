// Live facts never enter retained assistant prose. Only this server-authored
// lookup marker survives a turn; every use executes fresh caller-authorized reads.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared with Next and Deno
// @ts-ignore -- Deno requires explicit .ts imports.
import {buildJobEvidence,renderJobEvidence,resolveExactJobReference,completeJobLookup,isJobDetailTool,type JobEvidence,type JobIntent} from './tenbot-job-routing.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared with Next and Deno
// @ts-ignore -- Deno requires explicit .ts imports.
import type {JobToolResult,JobIdentity,TenbotJobToolName} from './tenbot-job-tools.ts';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit Deno import.
import {presentJobResult} from './tenbot-job-presentation.ts';
const present=(result:JobToolResult,evidence:JobEvidence,question='')=>presentJobResult(result,question)??renderJobEvidence(evidence,1400,question);

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit Edge extension.
import type {LaborReportResult} from '../../../src/modules/manpower/labor-report.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node
// @ts-ignore -- explicit Edge extension
import type {JobActivityReader} from './tenbot-job-activity.ts';
export type JobTools={activity?:JobActivityReader;authorizeHistory?(ids:string[]):Promise<'authorized'|'denied'|'unavailable'>;execute(name:TenbotJobToolName,args:Record<string,unknown>):Promise<JobToolResult>;laborReport?(args:Record<string,unknown>,signal?:AbortSignal):Promise<LaborReportResult>};
export const LIVE_QUESTION='[Live Production lookup]';
const marker='tenbot-job-context.v1:';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function retainedJobIntent(turns:{question:string;answer:string}[]):JobIntent|null{
 const turn=turns.at(-1);if(!turn||turn.question!==LIVE_QUESTION||!turn.answer.startsWith(marker))return null;
 try{
  const intent=JSON.parse(turn.answer.slice(marker.length));
  if(intent.kind==='job'&&['get_job_summary','get_job_planning','get_job_labor_summary'].includes(intent.tool)&&uuid.test(intent.reference?.jobId)&&intent.args&&typeof intent.args==='object')return intent;
  if(intent.kind==='jobs'&&isJobDetailTool(intent.tool)&&Array.isArray(intent.references)&&intent.references.length>0&&intent.references.length<=4&&intent.references.every((id:unknown)=>typeof id==='string'&&uuid.test(id))&&new Set(intent.references).size===intent.references.length&&intent.args&&typeof intent.args==='object')return intent;
  if(['overview','search'].includes(intent.kind)&&['get_production_overview','find_jobs'].includes(intent.tool)&&intent.args&&typeof intent.args==='object')return intent;
 }catch{}
 return null;
}
export function jobHistoryMarker(intent:JobIntent|null):string{
 // Do not make the older marker a parallel persistence format for a selector
 // the deployed typed context cannot retain.
 const unrepresentable=intent&&'args' in intent&&intent.args?.schedule!==undefined&&intent.args.schedule!=='all';
 return marker+JSON.stringify(!unrepresentable&&(intent?.kind==='job'&&'jobId' in intent.reference||intent?.kind==='overview'||intent?.kind==='jobs')?intent:null);
}
export function withoutLiveHistory(turns:{question:string;answer:string}[]){return turns.filter(turn=>turn.question!==LIVE_QUESTION&&!turn.answer.startsWith(marker));}
export type PreparedJobRequest={intent:JobIntent|null;result:JobToolResult|null;results?:JobToolResult[];evidence:JobEvidence|null;message:string;choices?:{job_id:string;reference:string}[]};
export async function prepareJobRequest(intent:JobIntent,tools:JobTools,question=''):Promise<PreparedJobRequest>{
 if(intent.kind==='blocked'||intent.kind==='clarify')return {intent:null,result:null,evidence:null,message:intent.message};
 if(intent.kind==='jobs'){
  const group=intent;
  if(!isJobDetailTool(intent.tool)||!Array.isArray(intent.references)||!intent.references.length||intent.references.length>4||intent.references.some(id=>!uuid.test(id))||new Set(intent.references).size!==intent.references.length)return {intent:null,result:null,evidence:null,message:'Choose up to four distinct exact Production Jobs before requesting their details.'};
  const results:JobToolResult[]=[];
  const suppressed=(status:JobToolResult['status'],message:string):PreparedJobRequest=>({intent:null,result:null,results,evidence:{tool:group.tool,observedAt:results.at(-1)?.observed_at??new Date().toISOString(),status,facts:[],unknowns:[message],complete:false,truncated:results.some(r=>r.truncated),jobContext:null},message});
  for(const id of intent.references){
   const result=await tools.execute(intent.tool,{...intent.args,job_id:id});results.push(result);
   if(result.status!=='ok'||!result.complete)return suppressed(result.status==='ok'?'partial':result.status,'I could not verify every requested Job. No grouped answer is shown; choose an exact Job or retry after access and data availability are confirmed.');
  }
  if(tools.authorizeHistory){const access=await tools.authorizeHistory(intent.references).catch(()=>'unavailable' as const);if(access!=='authorized')return suppressed(access==='denied'?'not_found_or_not_authorized':'unavailable','The selected Jobs could not all be reauthorized. No grouped answer is shown.');}
  const evidence=results.map(buildJobEvidence),messages=results.map((result,index)=>`${index+1}. ${present(result,evidence[index],question)}`),message=messages.join('\n\n');
  if(message.length>2400)return suppressed('partial','The verified group is too long for one complete answer. Please request fewer Jobs; no partial grouped answer is shown.');
  const grouped:JobEvidence={tool:intent.tool,observedAt:results.at(-1)!.observed_at,status:'ok',facts:evidence.flatMap((e,index)=>e.facts.map(f=>({...f,id:`job_${index+1}_${f.id}`}))),unknowns:evidence.flatMap((e,index)=>e.unknowns.map(text=>`Job ${index+1}: ${text}`)),complete:true,truncated:results.some(r=>r.truncated),jobContext:null};
  return {intent,result:null,results,evidence:grouped,message};
 }

 if(intent.kind==='job'&&'query' in intent.reference){
  const found=await tools.execute('find_jobs',{query:intent.reference.query,include_archived:intent.includeArchived===true});
  const rows=(found.data as {jobs?:JobIdentity[]}|null)?.jobs??[];
  const resolution=resolveExactJobReference(intent.reference.query,rows);
  if(completeJobLookup(found)&&resolution.kind==='selected')intent={...intent,reference:{jobId:resolution.jobId}};
  else{
   const evidence=buildJobEvidence(found),choices=rows.map(job=>({job_id:job.job_id,reference:job.reference}));
   return {intent:{kind:'search',tool:'find_jobs',args:{query:intent.reference.query,include_archived:intent.includeArchived===true}},result:found,evidence,
    message:choices.length?'Choose the exact Job number or full project name from the matching Jobs. I have not selected a Job. '+present(found,evidence,question):present(found,evidence,question),choices};
  }
 }
 // Status selection is a native contract of both population tools. Retain
 // old server-authored search seeds without keeping a second paging engine.
 if(intent.kind==='search'&&intent.selection?.statuses.length&&intent.args.statuses===undefined)intent={...intent,args:{...intent.args,statuses:intent.selection.statuses}};
 const result=await tools.execute(intent.tool,intent.kind==='job'?{...intent.args,job_id:'jobId' in intent.reference?intent.reference.jobId:''}:intent.args);
 const evidence=buildJobEvidence(result);
 return {intent,result,evidence,message:present(result,evidence,question)};
}
export function operationalReply(prepared:PreparedJobRequest,message=prepared.message,ai=false,fallback=false){
 const evidence=prepared.evidence;
 return {mode:ai?'operational-ai':'operational',message,resolution:evidence?.status==='not_found_or_not_authorized'?'permission-denied':evidence?.complete?'available':'partial',
  sources:[],snapshot:{revision:'tenbot-job-read.v1',verifiedAt:evidence?.observedAt??new Date().toISOString()},summary:null,notices:evidence?.unknowns??[],suggestionAllowed:false,fallback,
  operational:{tool:evidence?.tool??null,observedAt:evidence?.observedAt??null,complete:evidence?.complete??false,truncated:evidence?.truncated??false,
   facts:evidence?.facts.map(fact=>({id:fact.id,text:fact.text}))??[],sources:prepared.results?(evidence?.complete?prepared.results.flatMap(result=>result.sources):[]):prepared.result?.sources??[],choices:prepared.choices??[],refreshable:prepared.intent!==null}};
}
