/** Small host-issued statements and explicit material dependencies. This is a
 * presentation projection, never authorization, retrieval or model arithmetic. */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Edge/Node shared
// @ts-ignore -- explicit Edge extension
import type {JobToolResult,JobFacts,JobFindData,JobOverviewData,JobLaborData} from './tenbot-job-tools.ts';
export type ReadAnswerFact={id:string;text:string;kind?:string;workflowSourceId?:string;composition?:{role:'statement'|'qualification';requires:string[];key?:string;exclusive?:string}};
export const statement=(id:string,text:string,requires:string[]=[],kind='detail'):ReadAnswerFact=>({id,text,kind,composition:{role:'statement',requires}});
export const qualification=(id:string,key:string,text:string,exclusive?:string):ReadAnswerFact=>({id,text,kind:'limitation',composition:{role:'qualification',requires:[],key,...(exclusive?{exclusive}:{})}});
export const businessLabel=(s:string)=>s.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();
export const businessNumber=(n:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n);
export const businessDate=(s:string)=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(s+'T12:00:00Z'));
export const hourValue=(n:number)=>`${businessNumber(n)} ${n===1?'hour':'hours'}`;
/** Keep the existing 24KB tool-result ceiling. A statement is exposed only
 * with its complete dependency closure; large legacy results stay unchanged. */
export function appendCompositionFacts(payload:unknown,legacy:ReadAnswerFact[],extra:ReadAnswerFact[]):ReadAnswerFact[]{
 const facts=[...legacy],byId=new Map(extra.map(f=>[f.id,f]));
 const size=()=>new TextEncoder().encode(JSON.stringify({...payload as object,answer_facts:facts})).length;
 for(const fact of extra.filter(f=>f.composition?.role==='statement')){
  const bundle=[...fact.composition!.requires.map(id=>byId.get(id)),fact];
  if(bundle.some(f=>!f)||fact.composition!.requires.length>12)continue;
  const additions=(bundle as ReadAnswerFact[]).filter(f=>!facts.some(x=>x.id===f.id));
  facts.push(...additions);if(size()>23000)facts.splice(facts.length-additions.length,additions.length);
 }
 return facts;
}
/** Resolve only references to current host facts. Dependency text is not
 * employee/model supplied, and malformed, cyclic or conflicting graphs fail. */
export function compositionSelection(facts:unknown[],selected:ReadAnswerFact):{text:string;qualifications:{key:string;text:string;exclusive?:string}[]}|null{
 const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
 const seen=new Set<string>(),active=new Set<string>(),limits:{key:string;text:string;exclusive?:string}[]=[];
 function visit(f:unknown,root=false):boolean{
  if(!object(f)||typeof f.id!=='string'||typeof f.text!=='string'||!f.text.trim()||f.text.length>1400||!object(f.composition))return false;
  const c=f.composition;if(!['statement','qualification'].includes(String(c.role))||!Array.isArray(c.requires)||c.requires.length>12||c.requires.some(x=>typeof x!=='string')||(!root&&c.role!=='qualification'))return false;
  if(active.has(f.id)||seen.size>20)return false;if(seen.has(f.id))return true;active.add(f.id);
  for(const id of c.requires){const matches=facts.filter(x=>object(x)&&x.id===id);if(matches.length!==1||!visit(matches[0]))return false;}
  active.delete(f.id);seen.add(f.id);
  if(c.role==='qualification'){if(typeof c.key!=='string'||!c.key||c.key.length>1600||c.exclusive!==undefined&&(typeof c.exclusive!=='string'||!/^[-a-z0-9_]{1,80}$/.test(c.exclusive)))return false;limits.push({key:c.key,text:f.text,...(typeof c.exclusive==='string'?{exclusive:c.exclusive}:{})});}
  return true;
 }
 return visit(selected,true)?{text:selected.composition?.role==='statement'?selected.text:'',qualifications:limits}:null;
}
const statusLabels:Record<string,string>={not_started:'Not Started',on_deck:'On Deck',in_production:'In Production',on_hold:'On Hold',shipped:'Shipped',complete:'Complete',cancelled:'Cancelled'};
const ref=(j:JobFacts)=>businessLabel(j.reference);
/** These fixed source caveats qualify fields, not every fact in a result.
 * Unrecognized/new warnings always remain mandatory (fail conservative). */
const readinessWarning='Planning completeness and recorded Material Status do not establish physical readiness or absence of blockers.';
const progressWarning='Phase/Item progress and a complete remaining-work list are unavailable. Unsaved schedule proposals are excluded.';
const hoursWarning='These are recorded hours in the stated work-date period, not proof of all labor worked, a remaining-hours estimate or a forecast. Null Rework attribution is Original Production / Legacy Unclassified.';
export function jobCompositionFacts(result:JobToolResult,legacy:ReadAnswerFact[]):ReadAnswerFact[]{
 if(!result.data||!['ok','partial'].includes(result.status))return [];
 const extra:ReadAnswerFact[]=[],required:string[]=[];
 const q=(id:string,key:string,text:string,exclusive?:string)=>{extra.push(qualification(id,key,text,exclusive));return id;};
 for(const [i,text] of result.unknowns.entries())if(![readinessWarning,progressWarning,hoursWarning].includes(text))required.push(q(`brief_unknown_${i}`,`unknown:${text}`,text));
 if(result.status==='partial'||result.truncated)required.push(q('brief_partial','incomplete:'+result.tool,'Some results are missing; this is not a complete list or total.'));
 const add=(id:string,text:string,dependencies:string[]=[],kind='detail')=>extra.push(statement('brief_'+id,text,[...required,...dependencies],kind));
 if('job' in result.data){
  const j=result.data.job,identity=ref(j),base:string[]=[];
  if(j.archived)base.push(q('brief_archived','archived:'+j.job_id,`${identity} is archived.`));
  if(j.effective.lifecycle==='rework')base.push(q('brief_rework','rework:'+j.job_id,`This is Rework${j.effective.sequence_number===null?'':' '+j.effective.sequence_number}; the original Job is ${statusLabels[j.original.status]??'of unknown status'}.`));
  add('status',`${identity} is ${statusLabels[j.effective.status]??'of unknown status'}.`,base,'status');
  // The Pipeline displays this same saved jobs field; it is not derived from
  // recorded labor or the effective Rework lifecycle. Absent legacy metadata
  // is not evidence of a missing estimate, and null is never a verified zero.
  const estimate=typeof j.estimated_man_hours==='number'&&Number.isFinite(j.estimated_man_hours)&&j.estimated_man_hours>=0?j.estimated_man_hours:null;
  const estimateScope=j.effective.lifecycle==='rework'?[q('brief_estimate_scope','whole-job-estimate:'+j.job_id,'This is the estimate for the whole Job, not a separate Rework estimate.')]:[];
  if(estimate!==null)add('labor_estimate',`${identity} has a saved labor estimate of ${hourValue(estimate)}.`,[...base,...estimateScope],'labor');
  else if(j.estimated_man_hours===null)add('labor_estimate_missing',`No labor estimate is saved for ${identity}.`,base,'labor');
  const dateLimit=q('brief_saved_dates','saved-date-targets','Planned and requested dates are targets; actual completion and delivery dates are unavailable.');
  if(j.effective.planned_start&&j.effective.planned_end)add('schedule',`${identity} has a saved schedule of ${businessDate(j.effective.planned_start)} through ${businessDate(j.effective.planned_end)}.`,[...base,dateLimit],'schedule');
  else add('schedule',`${identity} has no complete saved start-and-finish schedule.`,base,'schedule');
  add('delivery',j.requested_delivery_date?`${identity} has a requested delivery date of ${businessDate(j.requested_delivery_date)}.`:`No requested delivery date is saved for ${identity}.`,j.requested_delivery_date?[...base,dateLimit]:base,'schedule');
  if(j.effective.planned_end&&j.requested_delivery_date)add('date_comparison',`${identity} has a saved planned finish of ${businessDate(j.effective.planned_end)}, ${j.effective.planned_end<j.requested_delivery_date?'before':j.effective.planned_end>j.requested_delivery_date?'after':'on'} its requested delivery date of ${businessDate(j.requested_delivery_date)}.`,[...base,dateLimit],'schedule');
  if(['get_job_summary','get_job_planning'].includes(result.tool)){
   const materialLabels:Record<string,string>={unknown:'Unknown',not_ready:'Not Ready',ordered:'Ordered',ready:'Ready'};
   const materialLimit=q('brief_material_limit','physical-readiness','Recorded material and planning statuses do not confirm physical readiness or the absence of blockers.');
   add('material',`${identity} has material status ${materialLabels[j.material_status]??'Unknown'}.`,[...base,materialLimit,...(j.material_status==='ordered'?[q('brief_ordered','ordered-not-arrived','Ordered materials have not been confirmed as arrived.')]:[])],'material');
   const progress=legacy.find(f=>f.id==='job_progress_limits'||f.id==='planning_phases_unavailable');if(progress)add('progress_unavailable',`${identity}: ${progress.text}`,base,'limitation');
   if(j.readiness.missing_fields.length){const missing=legacy.find(f=>f.id==='job_planning_missing');if(missing)add('planning_missing',`${identity}: ${missing.text}`,[...base,materialLimit],'readiness');}
  }
  if(result.tool==='get_job_labor_summary'){
   const d=result.data as JobLaborData;
   if(result.complete&&result.status==='ok'&&d.total_hours!==null){
    const period=q('brief_period',`labor-period:${d.period.start_date}:${d.period.end_date}`,d.scope==='all_recorded'?'All recorded work dates; includes Original and Rework labor across every Product Category and Uncategorized.':`Recorded hours, ${businessDate(d.period.start_date!)} through ${businessDate(d.period.end_date!)}.`,'labor-period');
    const recorded=q('brief_recorded','recorded-hours','Unreported work and remaining effort are unknown.');
    add('labor',`${identity} has ${hourValue(d.total_hours)} of recorded labor.`,[...base,period,recorded],'labor');
    // Compare a whole-Job estimate only against a complete all-recorded read.
    // This is host-issued subtraction at the existing hundredth-hour display
    // precision, never model arithmetic or a forecast of remaining work.
    if(!result.truncated&&d.scope==='all_recorded'&&d.period.start_date===null&&d.period.end_date===null&&estimate!==null&&Number.isFinite(d.total_hours)&&d.total_hours>=0&&Number.isSafeInteger(d.entry_count)&&Number(d.entry_count)>=0){
     const estimatedUnits=Math.round(estimate*100),recordedUnits=Math.round(d.total_hours*100),difference=estimatedUnits-recordedUnits;
     if(Number.isSafeInteger(estimatedUnits)&&Number.isSafeInteger(recordedUnits)&&Number.isSafeInteger(difference)){
      const limit=q('brief_labor_comparison_limit','labor-estimate-comparison','The difference does not establish remaining work, completion or final labor.');
      add('labor_comparison',`${identity} has ${hourValue(d.total_hours)} of recorded labor against a saved estimate of ${hourValue(estimate)}; recorded hours ${difference===0?'match the estimate':`are ${hourValue(Math.abs(difference)/100)} ${difference>0?'below':'above'} the estimate`}.`,[...base,...estimateScope,period,limit],'labor');
     }
    }
    if(d.original_or_unclassified_hours!==null)add('labor_original',`${identity}: Original or unclassified labor accounts for ${hourValue(d.original_or_unclassified_hours)}.`,[...base,period,recorded],'labor');
    // Reuse the report's verified measurement; an empty array alone is no proof.
    if(legacy.some(f=>f.id==='labor_linked_rework'))add('labor_linked_rework',`${identity} has 0 recorded hours linked to Rework.`,[...base,period,recorded],'labor');
    for(const [i,rework] of d.reworks.slice(0,8).entries())add('labor_rework_'+(i+1),`${identity}: Rework${rework.sequence_number===null?'':' '+rework.sequence_number} accounts for ${hourValue(rework.hours)}.`,[...base,period,recorded],'labor');
   }
  }
 }else if(result.tool==='find_jobs'){
  const d=result.data as JobFindData,complete=result.complete&&!result.truncated&&result.status==='ok'&&Number(result.filters.cursor??0)===0&&!d.has_more&&d.next_cursor===null;
  const selected=Array.isArray(result.filters.statuses)?result.filters.statuses.map(s=>statusLabels[String(s)]).filter(Boolean):[];
  const population=q('brief_population',`population:${JSON.stringify(result.filters)}`,`${selected.length?'Statuses: '+selected.join(', ')+'. ':'All Job statuses. '}${result.filters.include_archived===true?'Includes archived Jobs.':'Archived Jobs excluded.'}${result.filters.schedule==='unscheduled'?' Unscheduled means a start or finish date is missing.':result.filters.schedule==='scheduled'?' Scheduled means both saved dates exist.':''}`);
  const bounds=complete?[]:[q('brief_list_bounds',`list-bounds:${JSON.stringify(result.filters)}`,'More matches may exist outside these results.')];
  // Identity and current status are record facts, not enumeration claims.
  // Population/list bounds remain attached to match/count facts only.
  for(const [i,j] of d.jobs.entries()){
   const base:string[]=[];
   if(j.archived)base.push(q(`brief_subject_archived_${i+1}`,`archived:${j.job_id}`,`${ref(j)} is archived.`));
   if(j.effective.lifecycle==='rework')base.push(q(`brief_subject_rework_${i+1}`,`rework:${j.job_id}`,`This is Rework${j.effective.sequence_number===null?'':' '+j.effective.sequence_number}; the original Job is ${statusLabels[j.original.status]??'of unknown status'}.`));
   add('subject_'+(i+1),`${ref(j)}.`,base,'identity');
   add('record_status_'+(i+1),`${ref(j)} is ${statusLabels[j.effective.status]??'of unknown status'}.`,base,'status');
  }
  for(const [i,j] of d.jobs.entries())add('match_'+(i+1),`${ref(j)} — ${statusLabels[j.effective.status]??'Unknown status'}${j.effective.lifecycle==='rework'?' (Rework)':''}${j.archived?' (archived)':''}; ${j.effective.planned_start&&j.effective.planned_end?'scheduled':'unscheduled'}.`,[population,...bounds],'identity');
  if(!d.jobs.length&&complete)add('no_matches','No matching Jobs were found.',[population],'limitation');
 }else if(result.tool==='get_production_overview'&&result.complete&&result.status==='ok'){
  const d=result.data as JobOverviewData,population=legacy.find(f=>f.id==='population_scope')!;
  const scope=q('brief_population',`population:${JSON.stringify(result.filters)}`,population.text);
  for(const [key,label] of [['jobs','Jobs'],['active_jobs','Jobs in active statuses'],['scheduled','scheduled Jobs'],['unscheduled','unscheduled Jobs']] as const){const n=d.counts[key];if(n!==null)add('count_'+key,`There ${n===1?'is':'are'} ${businessNumber(n)} ${n===1?label.replace(/Jobs/,'Job'):label}.`,[scope],'count');}
 }
 return extra;
}
