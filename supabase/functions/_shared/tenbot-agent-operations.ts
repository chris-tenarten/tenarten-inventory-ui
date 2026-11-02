// Shared allowlisted operations for local and hosted read-only orchestration.
// The provider receives schemas and bounded data, never a database client.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Deno/Node source
// @ts-ignore -- Deno requires explicit extensions.
import type {AgentTool,JsonValue,StrictSchema} from './tenbot-agent.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit Deno extension.
import {AgentToolError} from './tenbot-investigation-diagnostics.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Deno/Node source
// @ts-ignore -- Deno requires explicit extensions.
import type {JobTools} from './tenbot-job-session.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Deno/Node source
// @ts-ignore -- Deno requires explicit extensions.
import type {TenbotJobToolName,JobToolResult} from './tenbot-job-tools.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit Edge extension.
import {JOB_LIFECYCLE_STATUSES} from './tenbot-job-filters.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Deno/Node source
// @ts-ignore -- Deno requires explicit extensions.
import {hasGuidePermission,publishedKnowledgeSource,type CapabilityEntry} from './tenbot-knowledge.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Deno/Node source
// @ts-ignore -- Deno requires explicit extensions.
import {agentKnowledgeEntries,agentKnowledgeSnapshot as snapshot} from './tenbot-agent-knowledge.ts';

type Capability=(capability:string)=>Promise<boolean>;
const string=(maxLength:number):StrictSchema=>({type:'string',maxLength});
const object=(properties:Record<string,StrictSchema>):StrictSchema=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const jobId={type:'string',minLength:36,maxLength:36} as const;
const period={start_date:string(10),end_date:string(10)};
const statuses:StrictSchema={type:'array',items:{type:'string',enum:[...JOB_LIFECYCLE_STATUSES]},maxItems:JOB_LIFECYCLE_STATUSES.length};
const specifications:{name:TenbotJobToolName;description:string;parameters:StrictSchema}[]=[
 {name:'find_jobs',description:'List/search caller-visible canonical Production Jobs. statuses selects a union of current effective lifecycle statuses, including active Rework; [] means all statuses. Use query "" to enumerate by status; query is only a Job number/name/customer search, never a status label. The same statuses/include_archived population is available to get_production_overview. include_archived=false excludes archives; true includes them. Filter before pagination, limit 1–20; cursor "" starts. Follow next_cursor until has_more=false. A 1,000-Job scan/deadline bound can make results incomplete; never report incomplete retrieval as zero. Never choose an ambiguous identity.',parameters:object({query:string(120),statuses,include_archived:{type:'boolean'},limit:{type:'integer',minimum:1,maximum:20},cursor:string(300)})},
 {name:'get_job_summary',description:'Read one exact authorized Job: lifecycle/Rework, saved dates, material status, planning completeness and structured follow-up counts. Counts are not raw issues; material status does not establish physical sufficiency.',parameters:object({job_id:jobId})},
 {name:'get_job_planning',description:'Read persisted schedule and planning setup for one exact authorized Job. Phase/item planning detail is disabled. Saved dates are not forecasts.',parameters:object({job_id:jobId})},
 {name:'get_job_labor_summary',description:'Read deterministic recorded labor totals for one exact Job. Use both YYYY-MM-DD dates or both empty for the canonical trailing 30 Chicago dates. Recorded hours do not establish remaining work.',parameters:object({job_id:jobId,...period})},
 {name:'get_production_overview',description:'Count the same current caller-visible canonical Job population as find_jobs: identical statuses/include_archived selectors, effective active-Rework status, [] means all statuses; include_archived=false excludes archives and true includes them. counts.jobs is the selected population; unselected by_status entries are null, never global zero. Active Jobs exclude archives and terminal statuses. A 1,000-Job scan/deadline bound can prevent exact counts; preserve incomplete/unknown results. Dates affect only upcoming saved finishes (both empty uses Chicago window), not historical status events; limit bounds upcoming rows, not counts.',parameters:object({statuses,include_archived:{type:'boolean'},...period,limit:{type:'integer',minimum:1,maximum:20}})},
];
const json=(value:unknown):JsonValue=>JSON.parse(JSON.stringify(value)) as JsonValue;
function argsFor(name:TenbotJobToolName,args:Record<string,JsonValue>){
 const values:Record<string,unknown>={...args};
 for(const key of ['query','cursor','start_date','end_date'])if(values[key]==='')delete values[key];
 // All existing canonical argument validation still runs inside execute.
 if(name==='get_job_summary'||name==='get_job_planning')return {job_id:values.job_id};
 return values;
}
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit extension for Deno.
import {prepareJobRequest,type PreparedJobRequest} from './tenbot-job-session.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit extension for Deno.
import {resolveExactJobReference,completeJobLookup,type JobIntent} from './tenbot-job-routing.ts';
function comparable(result:JobToolResult){return JSON.stringify({data:result.data,status:result.status,complete:result.complete,truncated:result.truncated,unknowns:result.unknowns,filters:result.filters});}

/** Reuses the five real authorized executors; freshness is a caller check, never model policy. */
export function createTenbotAgentJobTools(jobTools:JobTools,followup?:{intent:JobIntent;question:string}){
 const reads=new Map<string,{name:TenbotJobToolName;args:Record<string,unknown>;result:JobToolResult}>();
 let inconsistent=false,scoped:PreparedJobRequest|undefined;
 const execute:JobTools['execute']=async(name,canonical)=>{
  const result=await jobTools.execute(name,canonical);
  const key=JSON.stringify([name,canonical]),previous=reads.get(key);
  if(previous&&comparable(previous.result)!==comparable(result))inconsistent=true;
  if(!previous)reads.set(key,{name,args:canonical,result});
  return result;
 };
 const tools:AgentTool[]=specifications.map(spec=>({...spec,kind:'read',async execute(args){
  // The model still chooses tools and pages. Only the employee's compiled
  // population selectors override model guesses, for count and list alike.
  let result:JobToolResult;const canonical=argsFor(spec.name,args);
  const intent=followup?.intent;
  let references=intent?.kind==='job'&&'jobId' in intent.reference?[intent.reference.jobId]:intent?.kind==='jobs'?intent.references:[];
  if(intent?.kind==='clarify'||intent?.kind==='blocked')throw new AgentToolError('invalid-arguments');
  if(intent?.kind==='job'&&'query' in intent.reference){
   const query=intent.reference.query;
   if(spec.name==='find_jobs'){canonical.query=query;canonical.statuses=[];canonical.include_archived=intent.includeArchived===true;}
   else if(spec.name==='get_production_overview')throw new AgentToolError('invalid-arguments');
   else{const found=[...reads.values()].find(r=>r.name==='find_jobs'&&r.args.query===query)?.result;
    if(!found||!completeJobLookup(found)||!found.data||!('jobs' in found.data))throw new AgentToolError('invalid-arguments');
    const resolved=resolveExactJobReference(query,found.data.jobs);if(resolved.kind!=='selected')throw new AgentToolError('invalid-arguments');references=[resolved.jobId];
   }
  }

  if(references.length){
   if(['find_jobs','get_production_overview'].includes(spec.name))throw new AgentToolError('invalid-arguments');
   if(references.length===1)canonical.job_id=references[0];
   else if(!references.includes(String(canonical.job_id)))throw new AgentToolError('invalid-arguments');
   if(spec.name==='get_job_labor_summary'&&intent&&(intent.kind==='job'||intent.kind==='jobs')&&intent.tool===spec.name){for(const key of ['start_date','end_date']){delete canonical[key];if(typeof intent.args[key]==='string'&&intent.args[key])canonical[key]=intent.args[key];}}
   // Population filters never flow into an exact identity read. The original
   // executor still validates arguments and authorizes the caller each time.
  }
  if(followup&&(intent?.kind==='search'||intent?.kind==='overview')&&['find_jobs','get_production_overview'].includes(spec.name)){
   const selected=intent.args,query=intent.kind==='search'&&typeof selected.query==='string'?selected.query:'';
   const population={statuses:selected.statuses??(intent.kind==='search'?intent.selection?.statuses:undefined)??[],include_archived:selected.include_archived===true};
   if(spec.name==='find_jobs'){
    const prepared=await prepareJobRequest({kind:'search',tool:'find_jobs',args:{...canonical,...population,query}},{execute},followup.question);
    // Preserve the first scoped page's has_more/unknowns; a later final page
    // cannot make the first displayed subset look like a complete population.
    if(!scoped)scoped=prepared;
    result=prepared.result!;
   }else{
    if(query)throw new Error('Production overview cannot preserve a retained Job search; use find_jobs.');
    result=await execute(spec.name,{...canonical,...population});
   }
  }else result=await execute(spec.name,canonical);
  const {accessRefs:_references,...modelResult}=result;void _references;return {data:json(modelResult)};
 }}));
 return {tools,execute,scoped:()=>scoped,reads:()=>structuredClone([...reads.values()]),async fresh(){
  if(inconsistent)return false;
  for(const read of reads.values()){
   const current=await jobTools.execute(read.name,read.args);
   if(current.status==='not_found_or_not_authorized'||comparable(current)!==comparable(read.result))return false;
  }
  return true;
 }};
}

/** Published workflow knowledge is a separate channel from current operational data. */
export function createTenbotAgentKnowledgeTools(can:Capability,registeredTools:()=>readonly Pick<AgentTool,'name'|'kind'>[]=()=>[]):AgentTool[]{
 return [{name:'search_workflow_knowledge',kind:'read',description:'Search published workflow and structured architecture knowledge, including bounded related records. Returns at most four permitted sources within a byte limit. Facts distinguish repository contracts, Product conventions and released-source rules; none establish current operational evidence. capability_links names only tools registered in this session. Application services remain guidance-only unless separately exposed.',parameters:object({query:{type:'string',minLength:2,maxLength:160}}),async execute(args){
  const checks=new Map<string,Promise<boolean>>();
  const allowed=async(entry:CapabilityEntry)=>{
   const permissions=new Set<string>();
   for(const name of [entry.permission,...entry.additionalPermissions??[]]){
    if(!checks.has(name))checks.set(name,can(name));
    if(await checks.get(name))permissions.add(name);
   }
   return hasGuidePermission(entry,permissions);
  };
  return {data:json(await searchPublishedKnowledge(String(args.query),agentKnowledgeEntries(),allowed,registeredTools()))};
 }}];
}

/** Deterministic ranking and one-hop dependencies over the existing registry. */
function equivalentKnowledgeKey(entry:CapabilityEntry){
 // Aliases may have different IDs, titles, search terms and identity-derived
 // digests. Every other field remains significant, including unpublished
 // source authority, grants, release bindings, related records and tool names.
 // Equal prose alone must never erase independent structured evidence.
 const content:Record<string,unknown>={...entry};
 for(const key of ['id','title','terms','requiredTerms','examples','recordDigest'])delete content[key];
 content.guidance=entry.guidance.replace(/\s+/g,' ').trim();
 const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical)
  :value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)])):value;
 return JSON.stringify(canonical(content));
}
export async function searchPublishedKnowledge(query:string,entries:CapabilityEntry[],allowed:(entry:CapabilityEntry)=>Promise<boolean>,tools:readonly Pick<AgentTool,'name'|'kind'>[]=[]){
 if(query.length<2||query.length>160)throw new Error('Invalid knowledge query.');
 const words=(text:string)=>[...new Set((text.toLocaleLowerCase('en-US').match(/[\p{L}\p{N}]+/gu)??[]).map(word=>word.length>4&&word.endsWith('s')?word.slice(0,-1):word))];
 const stop=new Set('a an and are as at be can do does for from how i in is it me my of on or our please that the their then this to we what when which will with you'.split(' '));
 const terms=words(query).filter(word=>word.length>1&&!stop.has(word));
 const documents=entries.map(entry=>({entry,title:words(entry.title),tags:words(entry.terms+' '+entry.modules.join(' ')+' '+(entry.architecture?.entities.join(' ')??'')),facts:words(entry.architecture?JSON.stringify(entry.architecture):'')}));
 const contains=(tokens:string[],term:string)=>tokens.some(token=>token===term||(term.length>=5&&token.startsWith(term)));
 const weight=(term:string)=>1+Math.log(1+entries.length/(1+documents.filter(doc=>contains([...doc.title,...doc.tags],term)).length));
 const scored=documents.map(doc=>({entry:doc.entry,score:terms.reduce((score,term)=>score+weight(term)*(contains(doc.title,term)?3:contains(doc.tags,term)?2:contains(doc.facts,term)?0.35:0),0)})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.entry.id.localeCompare(b.entry.id));
 let accessLimited=false,contextLimited=false;
 const authorized=new Map<string,boolean>();
 const permit=async(entry:CapabilityEntry)=>{
  if(entry.status!=='deployed')return false;
  if(!authorized.has(entry.id))authorized.set(entry.id,await allowed(entry));
  if(!authorized.get(entry.id))accessLimited=true;
  return authorized.get(entry.id)===true;
 };
 const direct:typeof scored=[],directKeys=new Set<string>();
 for(const item of scored.slice(0,24)){
  if(!await permit(item.entry))continue;
  const key=equivalentKnowledgeKey(item.entry);
  if(directKeys.has(key))continue;
  directKeys.add(key);direct.push(item);
  if(direct.length===4)break;
 }
 const byId=new Map(entries.map(entry=>[entry.id,entry]));
 const related=new Map<string,{entry:CapabilityEntry;score:number}>();
 // Two direct seeds, one hop, eight edges per seed; cycles never recurse.
 for(const seed of direct.slice(0,2))for(const id of (seed.entry.relatedRecordIds??[]).slice(0,8)){
  const entry=byId.get(id);
  if(!entry||entry.id===seed.entry.id||!await permit(entry))continue;
  related.set(id,{entry,score:(scored.find(item=>item.entry.id===id)?.score??0)+1});
 }
 const ordered=[...direct.slice(0,2),...[...related.values()].sort((a,b)=>b.score-a.score||a.entry.id.localeCompare(b.entry.id)),...direct.slice(2)];
 const sources:ReturnType<typeof publishedKnowledgeSource>[]=[],selected:CapabilityEntry[]=[],visited=new Set<string>(),selectedKeys=new Set<string>();
 for(const {entry} of ordered){
  if(visited.has(entry.id))continue;visited.add(entry.id);
  const key=equivalentKnowledgeKey(entry);
  if(selectedKeys.has(key))continue;
  const source=publishedKnowledgeSource(entry);
  if(new TextEncoder().encode(JSON.stringify([...sources,source])).byteLength>16000){contextLimited=true;continue;}
  sources.push(source);selected.push(entry);selectedKeys.add(key);
  if(sources.length===4)break;
 }
 const registered=new Map(tools.filter(tool=>tool.kind==='read'||tool.kind==='prepare').map(tool=>[tool.name,tool]));
 const capabilityLinks=selected.map(entry=>({source_id:entry.id,tools:(entry.toolNames??[]).slice(0,5).flatMap(name=>{
  const tool=registered.get(name);return tool?[{name:tool.name,kind:tool.kind}]:[];
 }),execution:false}));
 return {snapshot,sources,capability_links:capabilityLinks,access_limited:accessLimited,context_limited:contextLimited,complete:false,
  limitation:'Bounded permission-filtered documentation and related-record search; results are incomplete. Access-limited guidance is outside current grants, not proof of an absent feature. Schema contracts are repository evidence, not a fresh hosted attestation. Current facts require authenticated tools. No raw repository, private conversation or live business records are searched; knowledge grants no execution authority.'};
}

/** Host-owned scope evidence. Descriptions disclose no credentials or records. */
export function createTenbotAgentScopeTool(tools:AgentTool[]):AgentTool{
 const capabilities=tools.map(tool=>({name:tool.name,kind:tool.kind,description:tool.description}));
 return {name:'describe_assistant_scope',kind:'read',description:'Explain this assistant’s actual allowlisted read/prepare capabilities and hard limits. Use for requests for SQL, shell, private conversations or execution; this is not evidence for UI walkthroughs or live business facts.',parameters:object({}),async execute(){return {data:json({capabilities,sql:false,shell:false,arbitrary_http:false,private_messages:false,execution:false,completed_actions:[],limitation:'Only listed, separately authorized read and prepare tools are available. No database changes can be performed by this agent. Draft preparation is separate from employee approval and a future authorized execution service.'})};}};
}
