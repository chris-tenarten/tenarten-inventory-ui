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
export const LABOR_CAPABILITY={name:'get_labor_analytics',kind:'read' as const,description:'Reuse Manpower Reporting Analytics for historical recorded labor: ranked Product Categories, canonical Jobs, category-to-Job contributions and same-Job comparisons. Product means Manpower Product Category, not a SKU/fabrication item. Categories may span Jobs and unlinked work. period is "30" (default), "90" or "year" (trailing calendar year), inclusive work dates; never claim an all-time maximum. Empty job_id selects all authorized Jobs/unlinked work, including archives and original/Rework. Empty product_category_id selects all categories; use current report IDs or __uncategorized__ for missing attribution. Category selection narrows rankings, while overall totals retain all-product scope. limit1–5 bounds output, not source completeness. Disclose counts/has_more, ties and missing attribution. For follow-ups, re-read the earlier report objective/period to resolve current category/Job IDs, then compose report or existing Job reads; old answers are not evidence. Incomplete reads establish no ranking or zero.'};
const selector:StrictSchema={type:'string',maxLength:36};
const parameters:StrictSchema={type:'object',properties:{period:{type:'string',enum:['30','90','year']},job_id:selector,product_category_id:selector,limit:{type:'integer',minimum:1,maximum:5}},required:['period','job_id','product_category_id','limit'],additionalProperties:false};
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as JsonValue;
const clean=(text:string)=>text.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();
const hours=(n:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n);
type Fact={id:string;text:string;kind?:string};
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
  add(`product_jobs_${i+1}`,`Recorded Job contributions to ${label}: ${jobs||'none'}. Unlinked labor: ${hours(p.unlinked_hours)} hours. Showing ${p.contributing_jobs.length} of ${p.contributing_job_count} contributing Jobs${p.has_more_jobs?'; this Job breakdown is incomplete':''}.`);
 });
 if(d.products.length)add('product_ranking',`Product Category totals ordered by recorded hours, highest first: ${d.products.map(p=>`${clean(p.label)}: ${hours(p.hours)} hours`).join('; ')}. Showing ${d.products.length} of ${d.product_count} categories with positive hours${d.has_more_products?'; additional categories are omitted':''}. Equal totals are tied.`);
 else add('product_empty','No positive recorded Product Category hours match this report selection.');
 d.jobs.forEach((j,i)=>{
  add(`job_${i+1}`,`${clean(j.reference)}: ${hours(j.hours)} recorded hours${d.scope.product_category_id?' for the selected Product Category':''}.`);
  add(`job_products_${i+1}`,`Product Category breakdown for ${clean(j.reference)}: ${j.products.map(p=>`${clean(p.label)}: ${hours(p.hours)} hours`).join('; ')||'no positive hours'}. Showing ${j.products.length} of ${j.product_count} categories${j.has_more_products?'; additional categories are omitted':''}.`);
 });
 if(d.jobs.length)add('job_ranking',`Jobs ordered by recorded hours, highest first${d.scope.product_category_id?' for the selected Product Category':''}: ${d.jobs.map(j=>`${clean(j.reference)}: ${hours(j.hours)} hours`).join('; ')}. Showing ${d.jobs.length} of ${d.job_count} Jobs with positive hours${d.has_more_jobs?'; additional Jobs are omitted':''}. Equal totals are tied.`);
 else add('job_empty','No positive recorded hours are linked to a Job in this report selection.');
 add('scope',`Report period: ${period}; ${d.scope.job_id?clean(d.scope.job_reference??'selected Job'):'all authorized Jobs and unlinked work'}. Product means Manpower Product Category. Archived Jobs and original/Rework hours are included. Overall totals cover all products; a product selection narrows rankings only. This is recorded history, not all-time labor, staffing availability or a forecast.`,'limitation');
 return facts;
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
