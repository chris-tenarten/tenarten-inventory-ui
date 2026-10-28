// Pure routing and presentation contracts. This module never queries a database,
// reads conversation prose, or grants access to a referenced Job.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared with Next and Deno
// @ts-ignore -- Deno requires explicit .ts imports; Next excludes Edge sources.
import type {JobToolResult,JobFacts,JobIdentity,TenbotJobToolName} from './tenbot-job-tools.ts';

export type JobContext={jobId:string};
export type JobIntent=
 | {kind:'blocked';message:string}
 | {kind:'overview';tool:'get_production_overview';args:Record<string,unknown>}
 | {kind:'search';tool:'find_jobs';args:Record<string,unknown>}
 | {kind:'job';tool:'get_job_summary'|'get_job_planning'|'get_job_labor_summary';reference:{jobId:string}|{query:string};args:Record<string,unknown>;includeArchived?:boolean}
 | {kind:'clarify';message:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const normalized=(value:string)=>value.trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');
const trimReference=(value:string)=>value.trim().replace(/^[#\s:]+|[?.!,;\s]+$/g,'').replace(/^(?:the\s+)?(?:job|project)\s+(?:number\s+)?#?\s*/i,'').replace(/["“”'‘’]$/,'').trim();
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
function validDate(value:string){return datePattern.test(value)&&Number.isFinite(Date.parse(`${value}T12:00:00Z`))&&new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;}
function chicagoDate(now:Date){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);return `${p.find(x=>x.type==='year')?.value}-${p.find(x=>x.type==='month')?.value}-${p.find(x=>x.type==='day')?.value}`;}
function shiftDate(date:string,days:number){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}

/** Returns only explicit, bounded reporting periods. Vague forecasts stay unknown. */
export function jobReportingPeriod(question:string,now=new Date()):{start_date:string;end_date:string}|null{
 const dates=[...question.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].map(match=>match[0]);
 if(dates.length){
  if(dates.length===1&&validDate(dates[0])&&new RegExp(`\\bon\\s+${dates[0]}\\b`,'i').test(question))return {start_date:dates[0],end_date:dates[0]};
  if(dates.length===2&&dates.every(validDate)&&dates[0]<=dates[1]&&Date.parse(`${dates[1]}T12:00:00Z`)-Date.parse(`${dates[0]}T12:00:00Z`)<366*86400000)return {start_date:dates[0],end_date:dates[1]};
  return null;
 }
 if(/\b(?:and|or)\s+(?:(?:this|next|last|past|previous)\s+(?:\d+\s+)?(?:day|week|month|year)|tomorrow|today)\b/i.test(question))return null;
 const today=chicagoDate(now),year=Number(today.slice(0,4));
 if(/\btomorrow\b/i.test(question)){const date=shiftDate(today,1);return {start_date:date,end_date:date};}
 const next=question.match(/\bnext\s+(\d+)\s+days?\b/i);if(next){const days=Number(next[1]);return Number.isSafeInteger(days)&&days>=1&&days<=366?{start_date:today,end_date:shiftDate(today,days-1)}:null;}
 if(/\bnext week\b/i.test(question)){const day=new Date(`${today}T12:00:00Z`).getUTCDay(),monday=shiftDate(today,7-((day+6)%7));return {start_date:monday,end_date:shiftDate(monday,6)};}
 if(/\bnext month\b/i.test(question)){const start=new Date(`${today.slice(0,7)}-01T12:00:00Z`);start.setUTCMonth(start.getUTCMonth()+1);const end=new Date(start);end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(0);return {start_date:start.toISOString().slice(0,10),end_date:end.toISOString().slice(0,10)};}
 if(/\bthis month\b/i.test(question))return {start_date:`${today.slice(0,7)}-01`,end_date:today};
 if(/\blast month\b/i.test(question)){const end=shiftDate(`${today.slice(0,7)}-01`,-1);return {start_date:`${end.slice(0,7)}-01`,end_date:end};}
 if(/\b(?:this|last) week\b/i.test(question)){const day=new Date(`${today}T12:00:00Z`).getUTCDay(),monday=shiftDate(today,-((day+6)%7));return /\blast week\b/i.test(question)?{start_date:shiftDate(monday,-7),end_date:shiftDate(monday,-1)}:{start_date:monday,end_date:today};}
 if(/\bthis year\b/i.test(question))return {start_date:`${year}-01-01`,end_date:today};
 const last=question.match(/\b(?:last|past)\s+(\d+)\s+days?\b/i);if(last){const days=Number(last[1]);return Number.isSafeInteger(days)&&days>=1&&days<=366?{start_date:shiftDate(today,1-days),end_date:today}:null;}
 if(/\btoday\b/i.test(question))return {start_date:today,end_date:today};
 return null;
}

/** Explicit canonical context is a lookup seed, never evidence or authorization. */
export function resolveJobIntent(question:string,context?:JobContext|null,now=new Date()):JobIntent|null{
 if(typeof question!=='string'||!question.trim()||question.length>1200)return null;
 const q=question.trim();
 // Employee-pasted text transformations and workflow questions retain the
 // existing knowledge/conversation system. Neither is a live-record request.
 if(/\b(?:summari[sz]e|rewrite|rephrase|translate|proofread|analy[sz]e|evaluate|explain|review)\b/i.test(q)&&(/\n/.test(q)||/\b(?:pasted|provided|following|this text|this note)\b/i.test(q)))return null;
 if(/\bhow\s+(?:do|can|should|would)\s+(?:i|we)\b|\bwhere\s+(?:do|can|should)\s+(?:i|we)\b/i.test(q)&&!/^\s*how\s+(?:much|many)\b/i.test(q))return null;
 const modulePattern='(?:Production(?:\\s+Pipeline)?|Inventory|Intake|Planning|Timeline|Manpower(?:\\s+Reporting)?|TenOps|Messaging|Rework|Purchasing|Samples?|Proposals?|Jobs?)';
 if(new RegExp(`^\\s*(?:what\\s+(?:does|do)|how\\s+(?:does|do))\\s+(?:the\\s+)?${modulePattern}\\s+(?:do|show|work|mean|support|include|offer|help|differ|handle|manage|track)\\b`,'i').test(q))return null;
 const hasJob=/\b(?:jobs?|production|projects?)\b/i.test(q)||Boolean(context&&uuid.test(context.jobId));
 const liveWords=/\b(?:current|status|scheduled?|unscheduled|planning|planned|completion|complete|finish|hours?|labor|labour|manpower|material|ready|readiness|shortage|incoming|rework|follow.up|blockers?|issues?|progress|overview|counts?|active|upcoming|recorded|find|show|list|tell me|what|which|how many|how much|analy[sz]e|evaluate)\b/i;
 if(!hasJob)return null;
 if(/\b(?:salary|salaries|payroll|wages?|profits?|margins?|costs?|prices?|contract value|deposit|financial|payment|employee names?|personal tasks?|private (?:messages?|DMs?)|direct messages?|who (?:is|was|are|worked|works)|workers? (?:names?|identit))\b/i.test(q))return {kind:'blocked',message:'Job intelligence does not retrieve financial information, private messages, personal tasks or individual employee details. I can help with recorded Job status, dates, labor totals and material status.'};
 if(!liveWords.test(q))return null;
 const includeArchived=/\b(?:include|including|show|list|find)\b[^.!?]{0,30}\barchived\b/i.test(q);
 const args:Record<string,unknown>=includeArchived?{include_archived:true}:{};
 const period=jobReportingPeriod(q,now);
 const requestedTemporal=/\b\d{4}-\d{2}-\d{2}\b|\b(?:tomorrow|yesterday|tonight|lifetime|all[\s-]+time|all history|ever|since)\b|\b(?:this|next|last|past|previous)\s+(?:(?:\d+|[a-z]+)\s+)?(?:days?|weeks?|months?|years?)\b/i.test(q);
 if(/\b(?:lifetime|all[\s-]+time|all history|ever|since|last year)\b/i.test(q)||requestedTemporal&&!period)return {kind:'clarify',message:'Please specify a supported calendar period of at most 366 days, two YYYY-MM-DD boundaries, or one date using “on YYYY-MM-DD”. Saved records cannot establish unrecorded work.'};
 const plural=/\b(?:jobs|production overview|production count|shop overview)\b/i.test(q);
 const overview=plural&&/\b(?:how many|counts?|overview|by status|scheduled|unscheduled|active|upcoming|completion|complete|finish|finishing|due)\b/i.test(q);
 if(plural&&period&&/\b(?:how many|counts?|completed|finished|shipped)\b/i.test(q)&&!/\b(?:labor|labour|hours|manpower)\b/i.test(q))return {kind:'clarify',message:'Production Job counts describe the current visible Jobs. Historical period counts and status transitions are outside this read-only contract; I can show current counts or upcoming persisted planned completion dates.'};
 if(/\bactive\s+jobs\s+(?:(?:that|which)\s+)?(?:are\s+)?(?:un)?scheduled\b|\b(?:active\s+(?:un)?scheduled|(?:un)?scheduled\s+active)\s+jobs\b/i.test(q))return {kind:'clarify',message:'I can report active Job counts and scheduled or unscheduled Job counts separately. The combined active-and-scheduled filter is outside this first read-only tool contract.'};
 if(overview)return {kind:'overview',tool:'get_production_overview',args:{...args,...period??{}}};
 const tool=/\b(?:labor|labour|manpower|hours?)\b/i.test(q)?'get_job_labor_summary':/\b(?:scheduled?|unscheduled|planning|planned|dates?|next|completion|finish)\b/i.test(q)?'get_job_planning':'get_job_summary';
 const detailArgs=tool==='get_job_labor_summary'&&period?period:{};
 const directUuid=q.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i)?.[0];
 if(directUuid)return {kind:'job',tool,reference:{jobId:directUuid},args:detailArgs,...(includeArchived?{includeArchived:true}:{})};
 // Quotes are the least ambiguous way to preserve a multiword Job name.
 const quoted=q.match(/["“]([^"”\n]{1,120})["”]/)?.[1];
 const numbered=q.match(/\bjob\s+(?:number\s+)?#?\s*([A-Za-z0-9]*\d[A-Za-z0-9._/-]*)\b/i)?.[1];
 const afterJob=q.match(/\b(?:jobs?|projects?)\s+(?:named\s+|called\s+|for\s+)?(.+?)(?=\s+(?:for|from|between|during|this|last|today|has|is|with|over|in|and)\b|[?!;]|$)/i)?.[1];
 const forTarget=q.match(/\b(?:for|about|of)\s+(?:(?:the\s+)?(?:job|project)\s+)?(.+?)(?=\s+(?:from|between|during|this|last|today|over|and)\b|[?!;]|$)/i)?.[1];
 const candidate=trimReference(quoted||numbered||afterJob||forTarget||'');
 if(context&&uuid.test(context.jobId)&&!quoted&&!numbered&&(/^(?:it|its|that|this|same)\b/i.test(candidate)||/\b(?:that|this|same)\s+job\b/i.test(q)&&/^(?:have|has|is|does|do|need|needs)$/i.test(candidate)))return {kind:'job',tool,reference:{jobId:context.jobId},args:detailArgs};
 const generic=/^(?:status|overview|counts?|planning|scheduled?|unscheduled|labor|labour|hours?|production|progress|readiness|material|materials|it|that|this|the job|job|jobs|all|all jobs|active jobs|archived jobs)$/i;
 if(candidate&&candidate.length<=120&&!generic.test(candidate)){
  const search=plural&&/\b(?:find|search|show|list)\b/i.test(q)&&!numbered&&!quoted;
  return search?{kind:'search',tool:'find_jobs',args:{...args,query:candidate}}:{kind:'job',tool,reference:{query:candidate},args:detailArgs,...(includeArchived?{includeArchived:true}:{})};
 }
 if(context&&uuid.test(context.jobId)&&/\b(?:it|its|that|this|same|job|hours|labor|labour|material|scheduled|planning|planned|dates|ready|readiness|next|status)\b/i.test(q))return {kind:'job',tool,reference:{jobId:context.jobId},args:detailArgs};
 if(plural&&/\b(?:find|show|list|search)\b/i.test(q))return {kind:'search',tool:'find_jobs',args};
 return {kind:'clarify',message:'Which Production Job do you mean? Enter its Job number or exact project name, or choose a Job from the results.'};
}

export type JobResolution={kind:'selected';jobId:string}|{kind:'choose';jobs:JobIdentity[]}|{kind:'missing'};
/** Never auto-select a merely similar or single fuzzy search result. */
export function resolveExactJobReference(query:string,jobs:JobIdentity[]):JobResolution{
 const key=normalized(query),exact=jobs.filter(job=>normalized(job.job_id)===key||job.job_number!==null&&normalized(job.job_number)===key||normalized(job.name)===key);
 return exact.length===1?{kind:'selected',jobId:exact[0].job_id}:jobs.length?{kind:'choose',jobs:jobs.slice(0,20)}:{kind:'missing'};
}

export type OperationalFact={id:string;kind:string;text:string;anchors:string[];sources:string[]};
export type JobEvidence={tool:TenbotJobToolName;observedAt:string;status:JobToolResult['status'];facts:OperationalFact[];unknowns:string[];complete:boolean;truncated:boolean;jobContext:JobContext|null};
const statuses:Record<string,string>={not_started:'Not Started',on_deck:'On Deck',in_production:'In Production',on_hold:'On Hold',shipped:'Shipped',complete:'Complete',cancelled:'Cancelled'};
const materials:Record<string,string>={unknown:'Unknown',not_ready:'Not Ready',ordered:'Ordered',ready:'Ready'};
const count=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?String(value):null;
const hours=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0?String(Math.round(value*100)/100):null;
const clean=(value:unknown,max=160)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max):'';
const object=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};

/** All factual sentences and units are constructed before any inference. */
export function buildJobEvidence(result:JobToolResult):JobEvidence{
 const facts:OperationalFact[]=[],data=object(result.data),job=object(data.job) as unknown as JobFacts;
 const add=(id:string,kind:string,text:string,anchors:string[])=>{if(facts.length<32)facts.push({id,kind,text,anchors,sources:result.sources.map(source=>typeof source==='string'?source:JSON.stringify(source)).slice(0,8)});};
 if(job&&typeof job.job_id==='string'){
  add('job_identity','identity',`Production Job: ${clean(job.reference)}.`,[clean(job.reference)]);
  const effective=job.effective,original=job.original;
  if(effective){
   const label=statuses[effective.status];if(label)add('job_status','status',`Recorded ${effective.lifecycle==='rework'?'Rework':'Production'} status: ${label}.`,[label,effective.lifecycle==='rework'?'Rework':'Production','status']);
   if(effective.lifecycle==='rework'&&count(effective.sequence_number)!==null)add('job_rework','rework',`The effective lifecycle is Rework ${effective.sequence_number}; the original Job status is ${statuses[original.status]??'Unknown'}.`,['Rework',statuses[original.status]??'Unknown','original']);
   if(effective.planned_start&&effective.planned_end)add('job_schedule','schedule',`Persisted planned dates: ${effective.planned_start} through ${effective.planned_end}.`,['Persisted','planned','dates']);
   else add('job_unscheduled','schedule','The effective Job lifecycle has no complete pair of persisted planned dates.',['no complete pair','persisted','planned','dates']);
  }
  if(job.requested_delivery_date)add('job_requested_delivery','schedule',`Requested delivery date: ${job.requested_delivery_date}.`,['Requested','delivery','date']);
  const material=materials[job.material_status];if(material)add('job_material_status','material',`Recorded material status: ${material}.`,['Recorded','material','status',material]);
  if(job.material_status==='ordered')add('job_material_ordered','limitation','Ordered means procurement has started; all required material has not been confirmed arrived.',['Ordered','procurement','not been confirmed']);
  if(job.material_status==='ready')add('job_material_ready','limitation','Ready describes the recorded material status; it does not establish complete Job readiness.',['Ready','material status','does not establish']);
  if(job.readiness?.label)add('job_planning_readiness','readiness',`Planning completeness: ${clean(job.readiness.label)}.`,['Planning completeness',clean(job.readiness.label)]);
  const missingLabels:Record<string,string>={job_number:'Job number',customer:'Customer',requested_delivery_date:'Requested delivery',estimated_man_hours:'Labor estimate',planned_start:'Planned start',planned_end:'Planned finish'};
  const missing=job.readiness?.missing_fields.map(field=>missingLabels[field]).filter(Boolean)??[];
  if(missing.length)add('job_planning_missing','readiness',`Missing recorded planning fields: ${missing.join(', ')}.`,['Missing','recorded','planning','fields',...missing]);
  if(job.archived)add('job_archived','archive','This Production Job is archived.',['Production Job','archived']);
 }
 if(result.tool==='find_jobs'&&Array.isArray(data.jobs))for(const [i,value] of data.jobs.slice(0,20).entries()){
  const item=object(value),effective=object(item.effective),label=statuses[String(effective.status)]??'Unknown';
  add(`match_${i+1}`,'identity',`Matching Production Job: ${clean(item.reference)}; recorded status: ${label}.`,[clean(item.reference),'status',label]);
 }
 if(result.tool==='find_jobs'&&Array.isArray(data.jobs)&&data.jobs.length===0&&result.complete)add('no_matches','limitation','No visible Production Jobs match the requested search scope.',['No','visible','Production Jobs','requested','search','scope']);
 if(result.tool==='get_job_summary'){
  const counts=object(data.counts);
  for(const [key,title] of [['rework_cycles','Recorded Rework cycles'],['active_rework_cycles','Active Rework cycles'],['open_follow_ups','Unresolved recorded follow-ups']] as const){const value=count(counts[key]);if(value!==null)add(key,'count',`${title}: ${value}.`,[title]);}
 }
 if(result.tool==='get_job_planning'){
  if(object(data.phases).availability==='disabled')add('planning_phases_unavailable','limitation','Planning phase detail is disabled in the released application; scheduled next work cannot be inferred from phases.',['Planning phase','disabled','cannot be inferred']);
  add('planning_scope','limitation','Planned dates describe saved scheduling; they do not prove completion or readiness.',['Planned dates','do not prove']);
 }
 if(result.tool==='get_job_labor_summary'){
  const period=object(data.period),start=clean(period.start_date,10),end=clean(period.end_date,10),total=hours(data.total_hours),entries=count(data.entry_count);
  if(total!==null)add('labor_total','labor',`Recorded labor: ${total} hours for ${start} through ${end}.`,['Recorded','labor','hours','through']);
  if(entries!==null)add('labor_entries','count',`Recorded labor entries in this reporting period: ${entries}.`,['Recorded','labor','entries','period']);
  const originalHours=hours(data.original_or_unclassified_hours);if(originalHours!==null)add('labor_original','labor',`Original or unclassified lifecycle labor: ${originalHours} hours.`,['Original','unclassified','labor','hours']);
  if(Array.isArray(data.reworks))for(const [i,value] of data.reworks.slice(0,8).entries()){const row=object(value),quantity=hours(row.hours),sequence=count(row.sequence_number);if(quantity!==null)add(`labor_rework_${i+1}`,'labor',`Recorded Rework${sequence===null?'':` ${sequence}`} labor: ${quantity} hours.`,['Recorded','Rework','labor','hours']);}
  if(data.latest_work_date)add('labor_latest','labor',`Latest recorded labor work date in this reporting period: ${clean(data.latest_work_date,10)}.`,['Latest','recorded','labor','date','period']);
  if(Array.isArray(data.daily))for(const [i,value] of data.daily.slice(-8).entries()){const row=object(value),quantity=hours(row.hours);if(quantity!==null)add(`labor_day_${i+1}`,'labor',`Recorded labor on ${clean(row.date,10)}: ${quantity} hours.`,['Recorded','labor','hours']);}
  add('labor_limit','limitation','Recorded hours reflect saved Manpower entries; unrecorded work and future labor are unknown.',['Recorded hours','saved','entries','unknown']);
 }
 if(result.tool==='get_production_overview'){
  const counts=object(data.counts);
  add('overview_scope','limitation','Production overview counts describe current visible Jobs in the selected archive scope; the date window applies only to upcoming persisted planned completions.',['current','visible Jobs','archive scope','only','upcoming','persisted','planned completions']);
  if(validDate(String(result.filters.start_date))&&validDate(String(result.filters.end_date)))add('overview_window','schedule',`Upcoming planned completion window: ${result.filters.start_date} through ${result.filters.end_date}, using America/Chicago calendar dates.`,['Upcoming','planned','completion','window','through','America/Chicago','calendar dates']);
  for(const [key,title] of [['jobs','Production Jobs in scope'],['active_jobs','Active Production Jobs'],['scheduled','Scheduled Production Jobs across all statuses in scope'],['unscheduled','Unscheduled Production Jobs across all statuses in scope']] as const){const value=count(counts[key]);if(value!==null)add(`overview_${key}`,'count',`${title}: ${value}.`,[title]);}
  for(const [status,value] of Object.entries(object(counts.by_status))){const quantity=count(value),label=statuses[status];if(quantity!==null&&label)add(`overview_status_${status}`,'count',`Production Jobs with recorded status ${label}: ${quantity}.`,['Production Jobs','status',label]);}
  if(Array.isArray(data.upcoming))for(const [i,value] of data.upcoming.slice(0,8).entries()){const row=object(value);add(`upcoming_${i+1}`,'schedule',`Upcoming persisted planned completion: ${clean(row.reference)} on ${clean(row.planned_end,10)}${row.lifecycle==='rework'?' for Rework':''}.`,['Upcoming','persisted','planned','completion',clean(row.reference),...(row.lifecycle==='rework'?['Rework']:[])]);}
 }
 const unknowns=result.unknowns.filter(value=>typeof value==='string').map(value=>clean(value,300)).slice(0,12);
 if(result.truncated)unknowns.push('The result is bounded and truncated; omitted records must not be treated as absent.');
 if(result.status==='not_found_or_not_authorized')unknowns.push('The requested Job was not found or is not authorized for this account.');
 if(result.status==='unavailable')unknowns.push('The operational data tool is unavailable; no conclusion can be drawn from missing results.');
 if(result.status==='invalid_request')unknowns.push('The operational request could not be validated.');
 const uniqueUnknowns=[...new Set(unknowns)];
 for(const [i,text] of uniqueUnknowns.slice(0,6).entries())add(`unknown_${i+1}`,'limitation',text,[text]);
 return {tool:result.tool,observedAt:result.observed_at,status:result.status,facts,unknowns:uniqueUnknowns,complete:result.complete,truncated:result.truncated,jobContext:job&&uuid.test(job.job_id)?{jobId:job.job_id}:null};
}

export type OperationalInferenceInput={question:string;context:string[];excerpts:{id:string;title:string;guidance:string;status:string}[];draft:false;operational:{facts:{id:string;text:string}[]}};
export function buildOperationalInferenceInput(question:string,evidence:JobEvidence):OperationalInferenceInput{
 return {question:question.slice(0,1200),context:[],excerpts:[],draft:false,operational:{facts:evidence.facts.map(fact=>({id:fact.id,text:fact.text}))}};
}

// Language freedom is deliberately limited to stylistic changes around each
// complete deterministic fact. These checks are conservative, not a semantic
// entailment model; rejected output uses the same useful deterministic facts.
const styleWords=new Set(('a an the this that these those is are be being has have in on at of for to from through with and or as it its here your you we our shows show showing currently reports report reporting lists list listed reflects reflect says say describes describe gives give during between about quick check overview summary details detail information note please see also result results').split(/\s+/));
const tokens=(text:string)=>text.toLocaleLowerCase('en-US').match(/[\p{L}\p{N}]+(?:[._/-][\p{L}\p{N}]+)*/gu)??[];
const quantitative=(text:string)=>text.match(/\b\d{4}-\d{2}-\d{2}\b|\b\d+(?:\.\d+)?\b/g)??[];
const sorted=(values:string[])=>[...values].sort().join('|');
const dangerous=/\b(?:because|therefore|thus|hence|since|unless|until|although|despite|enough|sufficient|insufficient|healthy|unhealthy|safe|unsafe|risk|risky|delayed|late|early|behind|ahead|bottleneck|overrun|under.?budget|cost|price|profit|margin|forecast|predict|prediction|expected|likely|probably|should|must|will|would|guarantee|guaranteed|percent|percentage|score|fully|finished|done|all set|blocked|unblocked|not ready to|ready to|on track|off track)\b|[%$€£]|https?:|www\.|[<>]/i;
export function validateOperationalExplanation(raw:unknown,evidence:JobEvidence):{message:string;factIds:string[]}|null{
 const output=object(raw);if(!Array.isArray(output.claims)||output.claims.length<1||output.claims.length>6||Object.keys(output).some(key=>!['claims','ids','summary','answer'].includes(key))||output.answer||output.summary)return null;
 const used=new Set<string>(),claims:string[]=[];
 for(const value of output.claims){
  const claim=object(value);if(Object.keys(claim).some(key=>!['fact_id','text'].includes(key))||typeof claim.fact_id!=='string'||typeof claim.text!=='string'||used.has(claim.fact_id))return null;
  const fact=evidence.facts.find(item=>item.id===claim.fact_id),text=claim.text.trim();if(!fact||text.length<8||text.length>400||/[\u0000-\u001f\u007f]/.test(text)||dangerous.test(text)&&text!==fact.text)return null;
  if(quantitative(text).join('|')!==quantitative(fact.text).join('|'))return null;
  const sourceTokens=new Set(tokens(fact.text));if(tokens(text).some(token=>!sourceTokens.has(token)&&!styleWords.has(token)))return null;
  // Preserve the complete factual vocabulary, including occurrence counts.
  // This prevents adding a second claim with familiar words, changing its
  // subject, or dropping a qualifier while keeping the same numeric value.
  const content=(value:string)=>tokens(value).filter(token=>!styleWords.has(token));
  if(sorted(content(text))!==sorted(content(fact.text)))return null;
  if(fact.anchors.some(anchor=>!normalized(text).includes(normalized(anchor))))return null;
  // Added/removed negation and semantic modifiers are not stylistic freedom.
  const semantic=(value:string)=>tokens(value).filter(token=>['no','not','cannot','unknown','unclassified','unresolved','original','rework','effective','archived','unrecorded','future','only','all','active','unscheduled','scheduled','latest'].includes(token));
  if(sorted(semantic(text))!==sorted(semantic(fact.text)))return null;
  const statusTokens=(value:string)=>Object.values(statuses).filter(label=>new RegExp(`\\b${label.replace(/ /g,'\\s+')}\\b`,'i').test(value));
  if(sorted(statusTokens(text))!==sorted(statusTokens(fact.text)))return null;
  used.add(fact.id);claims.push(text);
 }
 const message=claims.join(' ');return message.length<=1400?{message,factIds:[...used]}:null;
}

export function renderJobEvidence(evidence:JobEvidence,maxCharacters=1400):string{
 const sentences=evidence.facts.filter(fact=>!fact.id.startsWith('unknown_')).slice(0,16).map(fact=>fact.text),limitations=evidence.unknowns.slice(0,3);
 const caveat=limitations.join(' ').slice(0,Math.min(700,maxCharacters));
 let text='';for(const sentence of sentences){if(text.length+sentence.length+caveat.length+2>maxCharacters)break;text+=(text?' ':'')+sentence;}
 if(caveat)text+=(text?' ':'')+caveat;
 if(!text)text=evidence.status==='not_found_or_not_authorized'?'The requested Job was not found or is not authorized for your account.':'Live Job information is temporarily unavailable. TenOps and its workflow guidance remain available.';
 return text;
}
