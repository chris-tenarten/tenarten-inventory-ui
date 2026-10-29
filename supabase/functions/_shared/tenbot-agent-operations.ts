// Optional experimental operations. No hosted entry point imports this module.
// The provider receives schemas and bounded data, never a database client.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Deno/Node source
// @ts-ignore -- Deno requires explicit extensions.
import type {AgentTool,JsonValue,StrictSchema} from './tenbot-agent.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Deno/Node source
// @ts-ignore -- Deno requires explicit extensions.
import type {JobTools} from './tenbot-job-session.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Deno/Node source
// @ts-ignore -- Deno requires explicit extensions.
import type {TenbotJobToolName,JobToolResult} from './tenbot-job-tools.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Deno/Node source
// @ts-ignore -- Deno requires explicit extensions.
import {knowledgeEntries,registry,hasGuidePermission,snapshot,type CapabilityEntry} from './tenbot-knowledge.ts';

type Capability=(capability:string)=>Promise<boolean>;
const string=(maxLength:number):StrictSchema=>({type:'string',maxLength});
const object=(properties:Record<string,StrictSchema>):StrictSchema=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const jobId={type:'string',minLength:36,maxLength:36} as const;
const period={start_date:string(10),end_date:string(10)};
const specifications:{name:TenbotJobToolName;description:string;parameters:StrictSchema}[]=[
 {name:'find_jobs',description:'Find caller-visible canonical Production Jobs by exact number/name or bounded search. Never choose an ambiguous match. Empty query/cursor means browse/start; limit 1–20; archived only when explicitly requested.',parameters:object({query:string(120),include_archived:{type:'boolean'},limit:{type:'integer',minimum:1,maximum:20},cursor:string(300)})},
 {name:'get_job_summary',description:'Read one exact authorized Job: lifecycle/Rework, saved dates, material status, planning completeness and structured follow-up counts. Counts are not raw issues; material status does not establish physical sufficiency.',parameters:object({job_id:jobId})},
 {name:'get_job_planning',description:'Read persisted schedule and planning setup for one exact authorized Job. Phase/item planning detail is disabled. Saved dates are not forecasts.',parameters:object({job_id:jobId})},
 {name:'get_job_labor_summary',description:'Read deterministic recorded labor totals for one exact Job. Use both YYYY-MM-DD dates or both empty for the canonical trailing 30 Chicago dates. Recorded hours do not establish remaining work.',parameters:object({job_id:jobId,...period})},
 {name:'get_production_overview',description:'Read bounded caller-visible current Job counts, active statuses and upcoming saved finishes. Empty dates use canonical upcoming Chicago window. Counts are current, not historical completion events.',parameters:object({include_archived:{type:'boolean'},...period,limit:{type:'integer',minimum:1,maximum:20}})},
];
const json=(value:unknown):JsonValue=>JSON.parse(JSON.stringify(value)) as JsonValue;
function argsFor(name:TenbotJobToolName,args:Record<string,JsonValue>){
 const values:Record<string,unknown>={...args};
 for(const key of ['query','cursor','start_date','end_date'])if(values[key]==='')delete values[key];
 // All existing canonical argument validation still runs inside execute.
 if(name==='get_job_summary'||name==='get_job_planning')return {job_id:values.job_id};
 return values;
}
function comparable(result:JobToolResult){return JSON.stringify({data:result.data,status:result.status,complete:result.complete,truncated:result.truncated,unknowns:result.unknowns,filters:result.filters});}

/** Reuses the five real authorized executors; freshness is a caller check, never model policy. */
export function createTenbotAgentJobTools(jobTools:JobTools){
 const reads=new Map<string,{name:TenbotJobToolName;args:Record<string,unknown>;result:JobToolResult}>();
 let inconsistent=false;
 const tools:AgentTool[]=specifications.map(spec=>({...spec,kind:'read',async execute(args){
  const canonical=argsFor(spec.name,args),result=await jobTools.execute(spec.name,canonical);
  const key=JSON.stringify([spec.name,canonical]),previous=reads.get(key);
  if(previous&&comparable(previous.result)!==comparable(result))inconsistent=true;
  if(!previous)reads.set(key,{name:spec.name,args:canonical,result});
  return {data:json(result)};
 }}));
 return {tools,async fresh(){
  if(inconsistent)return false;
  for(const read of reads.values()){
   const current=await jobTools.execute(read.name,read.args);
   if(current.status==='not_found_or_not_authorized'||comparable(current)!==comparable(read.result))return false;
  }
  return true;
 }};
}

/** Published workflow knowledge is a separate channel from current operational data. */
export function createTenbotAgentKnowledgeTools(can:Capability):AgentTool[]{
 const allowed=async(entry:CapabilityEntry)=>{
  const permissions=new Set<string>();
  for(const name of [entry.permission,...entry.additionalPermissions??[]])if(await can(name))permissions.add(name);
  return hasGuidePermission(entry,permissions);
 };
 return [{name:'search_workflow_knowledge',kind:'read',description:'Search published, versioned employee workflow knowledge. This is application documentation, not live records, approved new scope or authority to perform actions. Query short relevant terms; returns at most four permitted sources.',parameters:object({query:{type:'string',minLength:2,maxLength:160}}),async execute(args){
  const terms=String(args.query).toLocaleLowerCase('en-US').match(/[\p{L}\p{N}]+/gu)??[];
  // Reuse the same precise published guides as the existing help desk, alongside
  // module summaries. The experimental search previously omitted the guides.
  const entries=[...new Map([...registry,...knowledgeEntries].map(entry=>[entry.id,entry])).values()];
  const scored=entries.map(entry=>({entry,score:terms.filter(term=>(entry.title+' '+entry.terms+' '+entry.modules.join(' ')).toLocaleLowerCase('en-US').includes(term)).length})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.entry.id.localeCompare(b.entry.id));
  const sources=[];
  for(const {entry} of scored){
   if(entry.status!=='deployed'||!await allowed(entry))continue;
   sources.push({id:entry.id,title:entry.title,status:entry.status,availability:entry.availability??'available',guidance:entry.guidance,path:entry.path,route:entry.route});
   if(sources.length===4)break;
  }
  return {data:json({snapshot,sources,complete:false,limitation:'Bounded documentation search. Missing documentation does not mean a feature is unavailable. No raw repository files, private conversations or current operational records are searched.'})};
 }}];
}
