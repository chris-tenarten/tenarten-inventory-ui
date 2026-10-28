// Live facts never enter retained assistant prose. Only this server-authored
// lookup marker survives a turn; every use executes fresh caller-authorized reads.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared with Next and Deno
// @ts-ignore -- Deno requires explicit .ts imports.
import {buildJobEvidence,renderJobEvidence,resolveExactJobReference,type JobEvidence,type JobIntent} from './tenbot-job-routing.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared with Next and Deno
// @ts-ignore -- Deno requires explicit .ts imports.
import type {JobToolResult,JobIdentity,TenbotJobToolName} from './tenbot-job-tools.ts';

export type JobTools={execute(name:TenbotJobToolName,args:Record<string,unknown>):Promise<JobToolResult>};
export const LIVE_QUESTION='[Live Production lookup]';
const marker='tenbot-job-context.v1:';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function retainedJobIntent(turns:{question:string;answer:string}[]):JobIntent|null{
 const turn=turns.at(-1);if(!turn||turn.question!==LIVE_QUESTION||!turn.answer.startsWith(marker))return null;
 try{
  const intent=JSON.parse(turn.answer.slice(marker.length));
  if(intent.kind==='job'&&['get_job_summary','get_job_planning','get_job_labor_summary'].includes(intent.tool)&&uuid.test(intent.reference?.jobId)&&intent.args&&typeof intent.args==='object')return intent;
  if(['overview','search'].includes(intent.kind)&&['get_production_overview','find_jobs'].includes(intent.tool)&&intent.args&&typeof intent.args==='object')return intent;
 }catch{}
 return null;
}
export function jobHistoryMarker(intent:JobIntent|null):string{return marker+JSON.stringify(intent?.kind==='job'&&'jobId' in intent.reference||intent?.kind==='overview'?intent:null);}
export function withoutLiveHistory(turns:{question:string;answer:string}[]){return turns.filter(turn=>turn.question!==LIVE_QUESTION&&!turn.answer.startsWith(marker));}
export type PreparedJobRequest={intent:JobIntent|null;result:JobToolResult|null;evidence:JobEvidence|null;message:string;choices?:{job_id:string;reference:string}[]};
export async function prepareJobRequest(intent:JobIntent,tools:JobTools):Promise<PreparedJobRequest>{
 if(intent.kind==='blocked'||intent.kind==='clarify')return {intent:null,result:null,evidence:null,message:intent.message};
 if(intent.kind==='job'&&'query' in intent.reference){
  const found=await tools.execute('find_jobs',{query:intent.reference.query,include_archived:intent.includeArchived===true});
  const rows=(found.data as {jobs?:JobIdentity[]}|null)?.jobs??[];
  const resolution=resolveExactJobReference(intent.reference.query,rows);
  if(found.complete&&resolution.kind==='selected')intent={...intent,reference:{jobId:resolution.jobId}};
  else{
   const evidence=buildJobEvidence(found),choices=rows.map(job=>({job_id:job.job_id,reference:job.reference}));
   return {intent:{kind:'search',tool:'find_jobs',args:{query:intent.reference.query,include_archived:intent.includeArchived===true}},result:found,evidence,
    message:choices.length?'Choose the exact Job number or full project name from the matching Jobs. I have not selected a Job. '+renderJobEvidence(evidence):renderJobEvidence(evidence),choices};
  }
 }
 const result=await tools.execute(intent.tool,intent.kind==='job'?{...intent.args,job_id:'jobId' in intent.reference?intent.reference.jobId:''}:intent.args);
 const evidence=buildJobEvidence(result);
 return {intent,result,evidence,message:renderJobEvidence(evidence)};
}
export function operationalReply(prepared:PreparedJobRequest,message=prepared.message,ai=false,fallback=false){
 const evidence=prepared.evidence;
 return {mode:ai?'operational-ai':'operational',message,resolution:evidence?.status==='not_found_or_not_authorized'?'permission-denied':evidence?.complete?'available':'partial',
  sources:[],snapshot:{revision:'tenbot-job-read.v1',verifiedAt:evidence?.observedAt??new Date().toISOString()},summary:null,notices:evidence?.unknowns??[],suggestionAllowed:false,fallback,
  operational:{tool:evidence?.tool??null,observedAt:evidence?.observedAt??null,complete:evidence?.complete??false,truncated:evidence?.truncated??false,
   facts:evidence?.facts.map(fact=>({id:fact.id,text:fact.text}))??[],sources:prepared.result?.sources??[],choices:prepared.choices??[],refreshable:prepared.intent!==null}};
}
