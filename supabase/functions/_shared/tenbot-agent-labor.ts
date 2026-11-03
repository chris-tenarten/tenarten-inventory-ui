/** Adapter over the existing Manpower report, not another calculation engine. */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit Edge extension.
import type {AgentTool,JsonValue,StrictSchema} from './tenbot-agent.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit Edge extension.
import type {JobTools} from './tenbot-job-session.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit Edge extension.
import type {LaborReportResult} from '../../../src/modules/manpower/labor-report.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit Edge extension.
import {AgentToolError} from './tenbot-investigation-diagnostics.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Edge/Node shared
// @ts-ignore -- explicit Edge extension
import {appendCompositionFacts,statement,qualification,businessDate,hourValue,type ReadAnswerFact} from './tenbot-read-composition.ts';
export const LABOR_CAPABILITY={name:'get_labor_analytics',kind:'read' as const,description:'Reuse Manpower Reporting Analytics for historical recorded labor: ranked Product Categories, canonical Jobs, category-to-Job contributions and same-Job comparisons. Product means Manpower Product Category, not a SKU/fabrication item. Categories may span Jobs and unlinked work. period is "30" (default), "90" or "year" (trailing calendar year), inclusive work dates; never claim an all-time maximum. Empty job_id selects all authorized Jobs/unlinked work, including archives and original/Rework. Empty product_category_id selects all categories; use current report IDs or __uncategorized__ for missing attribution. Category selection narrows rankings, while overall totals retain all-product scope. limit1–5 bounds output, not source completeness. Disclose counts/has_more, ties and missing attribution. For follow-ups, re-read the earlier report objective/period to resolve current category/Job IDs, then compose report or existing Job reads; old answers are not evidence. Incomplete reads establish no ranking or zero.'};
const selector:StrictSchema={type:'string',maxLength:36};
const parameters:StrictSchema={type:'object',properties:{period:{type:'string',enum:['30','90','year']},job_id:selector,product_category_id:selector,limit:{type:'integer',minimum:1,maximum:5}},required:['period','job_id','product_category_id','limit'],additionalProperties:false};
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as JsonValue;
const clean=(text:string)=>text.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();
const hours=(n:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n);
type Fact=ReadAnswerFact;
/** Existing calculation outputs remain the authority. These are independently
 * selectable relations, not employee-question templates or model calculations. */
function compositionFacts(result:LaborReportResult):Fact[]{
 if(result.status!=='ok'||!result.complete||!result.data)return [];
 const d=result.data,facts:Fact[]=[],required:string[]=[];
 const q=(id:string,key:string,text:string,exclusive?:string)=>{facts.push(qualification(id,key,text,exclusive));return id;};
 required.push(q('brief_period',`labor-period:${d.period.start}:${d.period.end}`,`Recorded hours, ${businessDate(d.period.start)} through ${businessDate(d.period.end)}.`,'labor-period'));
 required.push(q('brief_lifecycles','labor-lifecycles','Includes archived Jobs and Rework.'));
 const missingScope=d.scope.job_reference?`For ${clean(d.scope.job_reference)}, across all categories,`:'Across all Jobs and categories,';
 if(d.uncategorized_hours>0)required.push(q('brief_uncategorized',`uncategorized:${d.scope.job_id??'all'}:${d.period.start}:${d.period.end}`,`${missingScope} ${hourValue(d.uncategorized_hours)} ${d.uncategorized_hours===1?'has':'have'} no saved Product Category.`));
 if(d.unlinked_hours>0)required.push(q('brief_unlinked',`unlinked:${d.scope.job_id??'all'}:${d.period.start}:${d.period.end}`,`${missingScope} ${hourValue(d.unlinked_hours)} ${d.unlinked_hours===1?'is':'are'} not linked to a Job.`));
 // These existing report notes are already expressed by typed scope/attribution
 // and bounded-list dependencies below. Unknown/new warnings stay mandatory.
 const represented=new Set(['Recorded Manpower hours, not forecasts, staffing capacity or remaining-work estimates. Product means reporting Product Category, not an individual production item.','All-product totals include Uncategorized and unlinked work; selected product narrows ranked projections only. Saved original and Rework hours are combined; archived Jobs are included.','Ranked output is limited; omitted members remain included in complete aggregate totals and the reported matching counts.']);
 for(const [i,text] of result.unknowns.entries())if(!represented.has(text))required.push(q('brief_unknown_'+i,'unknown:'+text,text));
 const jobScope=d.scope.job_id?[q('brief_job_scope','labor-job:'+d.scope.job_id,`For ${clean(d.scope.job_reference??'the selected Job')}.`)]:[];
 const categoryScope=d.scope.product_category_id?[q('brief_category_scope','selected-category:'+d.scope.product_category_id,'Category breakdowns show only the selected Product Category; overall totals include all categories.')]:[];
 const add=(id:string,text:string,deps:string[]=[],selfIdentifiedJob=false)=>facts.push(statement('brief_'+id,text,[...required,...categoryScope,...(selfIdentifiedJob?[]:jobScope),...deps],'labor'));
 const attribution=new Map(d.products.filter(p=>p.unlinked_hours>0).map((p,i)=>[p.id,[q('brief_product_unlinked_'+i,`product-unlinked:${p.id}:${d.period.start}:${d.period.end}`,`${clean(p.label)} includes ${hourValue(p.unlinked_hours)} without a Job link.`)]]));
 add('total',`${d.scope.job_reference?clean(d.scope.job_reference)+' across all Product Categories':'All categories combined'}: ${hourValue(d.total_hours)} of recorded labor.`,[],Boolean(d.scope.job_reference));
 const named=d.products.filter(p=>p.id!=='__uncategorized__');
 if(!d.scope.product_category_id&&named.length){
  const top=named[0],tied=named.filter(p=>p.hours===top.hours);
  add('product_leader',d.has_more_products?`${clean(top.label)} is a leading named Product Category, with ${hourValue(top.hours)} of recorded labor.`:tied.length>1?`${tied.map(p=>clean(p.label)).join(' and ')} are tied for the most recorded labor${d.uncategorized_hours>0?' among saved Product Categories':''}, at ${hourValue(top.hours)} each.`:`${clean(top.label)} has the most recorded labor${d.uncategorized_hours>0?' among saved Product Categories':''}: ${hourValue(top.hours)}.`,tied.flatMap(p=>attribution.get(p.id)??[]));
 }
 for(const [i,p] of d.products.entries()){
  const n=i+1,label=clean(p.label),bounds=[...(attribution.get(p.id)??[]),...(p.has_more_jobs?[q('brief_product_bounds_'+n,`product-jobs:${p.id}:${d.scope.job_id??'all'}:${d.period.start}:${d.period.end}`,`Only ${p.contributing_jobs.length} of ${p.contributing_job_count} contributing Jobs are shown for ${label}.`)]:[])];
  add('product_'+n,p.id==='__uncategorized__'?`${hourValue(p.hours)} ${p.hours===1?'is':'are'} Uncategorized; ${p.hours===1?'it does':'they do'} not identify a product.`:`${label}: ${hourValue(p.hours)} of recorded labor.`,attribution.get(p.id)??[]);
  if(p.contributing_jobs.length){
   add('contributors_'+n,`${label} labor by Job: ${p.contributing_jobs.map(j=>`${clean(j.reference)} (${hourValue(j.hours)})`).join('; ')}.`,bounds);
   const lead=p.contributing_jobs[0],ties=p.contributing_jobs.filter(j=>j.hours===lead.hours);
   add('contributor_leader_'+n,`${clean(lead.reference)} ${ties.length>1||p.has_more_jobs?'is a leading contributor of':'contributed the most'} ${label} labor: ${hourValue(lead.hours)}.`,bounds);
   for(const [k,j] of p.contributing_jobs.entries())add(`contribution_${n}_${k+1}`,`${clean(j.reference)} contributed ${hourValue(j.hours)} to ${label}.`);
  }
 }
 for(const [i,j] of d.jobs.entries()){
  const n=i+1,bounds=j.has_more_products?[q('brief_job_bounds_'+n,`job-products:${j.job_id}:${d.period.start}:${d.period.end}`,`Only ${j.products.length} of ${j.product_count} Product Categories are shown for ${clean(j.reference)}.`)]:[];
  add('job_products_'+n,`${clean(j.reference)} — ${j.products.map(p=>`${clean(p.label)}: ${hourValue(p.hours)}`).join('; ')||'no positive recorded hours'}.`,bounds,true);
  if(!d.scope.product_category_id&&j.product_count===1&&!j.has_more_products&&j.products.length===1&&j.products[0].id!=='__uncategorized__'&&j.products[0].hours===j.hours){
   add('job_only_product_'+n,`${j.hours===1?'The':'All'} ${hourValue(j.hours)} recorded for ${clean(j.reference)} ${j.hours===1?'is':'are'} attributed to ${clean(j.products[0].label)}.`,[],true);
   add('job_no_other_products_'+n,`No other Product Categories have recorded hours on ${clean(j.reference)} in this period.`,[],true);
  }
 }
 if(!d.products.length)add('no_products',`No positive Product Category hours are recorded${d.scope.job_reference?' for '+clean(d.scope.job_reference):''} in this period.`);
 return facts;
}
/** Facts are report projections. No model arithmetic or question-specific copy. */
export function laborReportFacts(result:LaborReportResult):Fact[]{
 if(result.status!=='ok'||!result.complete||!result.data)return [{id:'labor_unavailable',kind:'limitation',text:result.status==='not_authorized'?'Historical labor analysis is not available under your current permissions.':result.status==='invalid_request'?'Historical labor reporting supports the last 30 days, 90 days or trailing calendar year, with valid Product Category and Job selections.':'I could not verify complete authorized historical labor. No ranking, maximum or zero total is established.'}];
 const d=result.data,facts:Fact[]=[],add=(id:string,text:string,kind?:string)=>{if(text.length<=1400)facts.push({id,text,...(kind?{kind}:{})});};
 const period=`${d.period.start} through ${d.period.end}`;
 add('summary',`Recorded labor for ${period}: ${hours(d.total_hours)} hours across ${d.entry_count} entries. All-product totals include ${hours(d.uncategorized_hours)} Uncategorized hours and ${hours(d.unlinked_hours)} hours not linked to a Job.`);
 d.products.forEach((p,i)=>{
  const label=clean(p.label);
  add(`product_${i+1}`,p.id==='__uncategorized__'?`Uncategorized labor: ${hours(p.hours)} recorded hours. These entries have no saved Product Category and do not identify a product.`:`Product Category ${label}: ${hours(p.hours)} recorded hours.`);
  const jobs=p.contributing_jobs.map(j=>`${clean(j.reference)}: ${hours(j.hours)} hours`).join('; ');
  add(`product_jobs_${i+1}`,`${label} totals ${hours(p.hours)} recorded hours. By Job: ${jobs||'none'}. Unlinked labor: ${hours(p.unlinked_hours)} hours. Showing ${p.contributing_jobs.length} of ${p.contributing_job_count} contributing Jobs${p.has_more_jobs?'; this Job breakdown is incomplete':''}.`);
 });
 if(d.products.length){
  const named=d.products.filter(p=>p.id!=='__uncategorized__'),leader=named[0],uncategorized=d.products.find(p=>p.id==='__uncategorized__');
  const lead=leader?`${clean(leader.label)} ${d.scope.product_category_id?'has':'has the most recorded labor among saved Product Categories at'} ${hours(leader.hours)}${d.scope.product_category_id?' recorded':''} hours.`:'No saved Product Category is identified in the results shown.';
  const other=named.slice(1).map(p=>`${clean(p.label)}: ${hours(p.hours)} hours`).join('; ');
  add('product_ranking',[lead,...(other?[`Other Product Categories, highest first: ${other}.`]:[]),...(uncategorized?[`Uncategorized: ${hours(uncategorized.hours)} hours with no saved Product Category; these do not identify a product.`]:[]),`Showing ${d.products.length} of ${d.product_count} categories with positive hours${d.has_more_products?'; additional categories are omitted':''}. Equal totals are tied.`].join(' '));
 }
 else add('product_empty','No positive recorded Product Category hours match this report selection.');
 d.jobs.forEach((j,i)=>{
  add(`job_${i+1}`,`${clean(j.reference)}: ${hours(j.hours)} recorded hours${d.scope.product_category_id?' for the selected Product Category':''}.`);
  add(`job_products_${i+1}`,`For ${clean(j.reference)}, recorded labor by Product Category is ${j.products.map(p=>`${clean(p.label)}: ${hours(p.hours)} hours`).join('; ')||'no positive hours'}. Showing ${j.products.length} of ${j.product_count} categories${j.has_more_products?'; additional categories are omitted':''}.`);
 });
 if(d.jobs.length)add('job_ranking',`Jobs ordered by recorded hours, highest first${d.scope.product_category_id?' for the selected Product Category':''}: ${d.jobs.map(j=>`${clean(j.reference)}: ${hours(j.hours)} hours`).join('; ')}. Showing ${d.jobs.length} of ${d.job_count} Jobs with positive hours${d.has_more_jobs?'; additional Jobs are omitted':''}. Equal totals are tied.`);
 else add('job_empty','No positive recorded hours are linked to a Job in this report selection.');
 add('scope',`Recorded labor for ${period}; ${d.scope.job_id?clean(d.scope.job_reference??'selected Job'):'all authorized Jobs and unlinked work'}. Includes archived Jobs and original/Rework hours.${d.scope.product_category_id?' Overall totals cover all products; rankings use the selected Product Category.':''}`,'limitation');
 return appendCompositionFacts(result,facts,compositionFacts(result));
}
const comparable=(r:LaborReportResult)=>JSON.stringify({status:r.status,complete:r.complete,truncated:r.truncated,data:r.data,unknowns:r.unknowns,accessRefs:r.accessRefs});
export function createTenbotAgentLaborTools(jobTools:JobTools,binding?:{allowRead(id:string|null):boolean;bindReport(ids:string[]):void}){
 const reads=new Map<string,{args:Record<string,unknown>;result:LaborReportResult}>();let inconsistent=false;
 const tools:AgentTool[]=jobTools.laborReport?[{...LABOR_CAPABILITY,parameters,async execute(args,context){
  const values:Record<string,unknown>={period:args.period==='year'?'year':Number(args.period),limit:args.limit};
  for(const k of ['job_id','product_category_id'])if(args[k]!=='')values[k]=args[k];
  if(binding&&!binding.allowRead(typeof values.job_id==='string'?values.job_id:null))throw new AgentToolError('invalid-arguments');
  const result=await jobTools.laborReport!(values,context.signal),key=JSON.stringify(values),previous=reads.get(key);
  if(previous&&comparable(previous.result)!==comparable(result))inconsistent=true;
  if(!previous)reads.set(key,{args:values,result:structuredClone(result)});
  if(result.status==='ok'&&result.complete&&result.data)binding?.bindReport([...new Set([...result.data.jobs.map(j=>j.job_id),...result.data.products.flatMap(p=>p.contributing_jobs.map(j=>j.job_id))])]);
  const {accessRefs:_refs,...published}=result;void _refs;
  return {data:json({...published,answer_facts:laborReportFacts(result)})};
 }}]:[];
 return {tools,reads:()=>structuredClone([...reads.values()]),async fresh(){
  if(inconsistent)return false;
  for(const r of reads.values()){const current=await jobTools.laborReport!(r.args);if(current.status==='not_authorized'||comparable(current)!==comparable(r.result))return false;}
  return true;
 }};
}
