/** Employee-facing wording over the existing caller-authorized results. No reads,
 * inference, calculations outside tool totals, or new business conclusions. */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Deno/Node shared source
// @ts-ignore -- Edge requires the explicit extension.
import type {JobToolResult,JobFacts,JobFindData,JobOverviewData,JobLaborData,JobSummaryData} from './tenbot-job-tools.ts';
const labels:Record<string,string>={not_started:'Not Started',on_deck:'On Deck',in_production:'In Production',on_hold:'On Hold',shipped:'Shipped',complete:'Complete',cancelled:'Cancelled'};
const safe=(value:string)=>value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,'').trim().slice(0,240);
const quantity=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0?new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n):null;
const date=(s:string)=>/^\d{4}-\d\d-\d\d$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(s+'T12:00:00Z')):'unspecified date';
const reference=(j:JobFacts)=>[safe(j.job_number??''),safe(j.name)].filter(Boolean).join(' — ')||'Unnamed Job';
const status=(j:JobFacts)=>(j.effective.lifecycle==='rework'?'Rework · ':'')+(labels[j.effective.status]??'Unknown status');
export function presentJobResult(result:JobToolResult,question='',maxCharacters=1400):string|null{
 if(!result.data||!['ok','partial'].includes(result.status))return null;
 const lines:string[]=[],q=question.toLowerCase(),exact=result.status==='ok'&&result.complete&&!result.truncated;
 if(result.tool==='get_production_overview'){
  const d=result.data as JobOverviewData,c=d.counts,selected=Array.isArray(result.filters.statuses)?result.filters.statuses.filter((s):s is string=>typeof s==='string'&&Object.hasOwn(labels,s)):[];
  if(result.status==='ok'&&result.complete){
   let field:unknown=c.jobs,label='Jobs';
   if(selected.length){field=c.jobs;label=selected.length===1?'Jobs '+(selected[0]==='in_production'?'currently in Production':'marked '+labels[selected[0]]):selected.length===4&&['not_started','on_deck','in_production','on_hold'].every(s=>selected.includes(s))?(result.filters.include_archived===true?'Jobs in active lifecycle statuses':'active Jobs'):'Jobs in the selected lifecycle statuses';}
   else if(/\bactive\b/.test(q)){field=c.active_jobs;label='active Jobs';}
   else if(/\bunscheduled\b/.test(q)){field=c.unscheduled;label='unscheduled Jobs';}
   else if(/\bscheduled\b/.test(q)){field=c.scheduled;label='scheduled Jobs';}
   else for(const [key,name]of Object.entries(labels))if(new RegExp('\\b'+name.replace(/ /g,'(?:\\s+|-)')+'\\b','i').test(q)){field=c.by_status[key];label='Jobs '+(key==='in_production'?'currently in Production':'marked '+name);break;}
   if(/\b(?:upcoming|finish|finishing|due|completion)\b/.test(q)){
    lines.push('Upcoming planned finishes'+(typeof result.filters.start_date==='string'&&typeof result.filters.end_date==='string'?` · ${date(result.filters.start_date)}–${date(result.filters.end_date)}`:'')+':');
    if(!d.upcoming.length)lines.push('No active Jobs have a saved planned finish in this window.');
    for(const j of d.upcoming.slice(0,8))lines.push(`• ${safe(j.reference)} — ${date(j.planned_end)}${j.lifecycle==='rework'?' (Rework)':''}`);
   }else if(quantity(field)!==null){
    lines.push(`There ${field===1?'is':'are'} ${quantity(field)} ${field===1?label.replace(/Jobs/,'Job'):label}.`);
    if(/\bby status\b/.test(q))for(const[k,n]of Object.entries(c.by_status))if(quantity(n)!==null&&labels[k])lines.push(`• ${labels[k]}: ${quantity(n)}`);
   }else lines.push('The current authorized Job count is unavailable. I cannot establish an exact total.');
   lines.push(result.filters.include_archived===true?'Includes archived Jobs you can access.':'Current Jobs you can access; archived Jobs excluded.');
  }else lines.push('The Production results are incomplete. I cannot give an exact Job count.');
 }else if(result.tool==='find_jobs'){
  const d=result.data as JobFindData;
  lines.push(exact?d.jobs.length?`${d.jobs.length} matching ${d.jobs.length===1?'Job':'Jobs'}${Number(result.filters.cursor)>0?' on this page':''}:`:Number(result.filters.cursor)>0?'No further Jobs are available on this page.':'No Jobs match this search within your current access.':'Here are the available matches; this is not a complete Job list.');
  for(const j of d.jobs.slice(0,20))lines.push(`• ${reference(j)} — ${status(j)}${j.archived?' · Archived':''}`);
 }else if(result.tool==='get_job_labor_summary'){
  const d=result.data as JobLaborData,total=quantity(d.total_hours);
  lines.push(total!==null&&result.status==='ok'&&result.complete?`${reference(d.job)} has ${total} ${d.total_hours===1?'hour':'hours'} of recorded labor.`:`An exact labor total is unavailable for ${reference(d.job)}.`);
  lines.push(d.scope==='all_recorded'?'All recorded work dates; includes Original and Rework and every Product Category/Uncategorized.':`Reporting period: ${date(d.period.start_date!)}–${date(d.period.end_date!)} (work dates).`);
  if(total!==null&&result.status==='ok'&&result.complete){
   if(d.entry_count!==null)lines.push(`${quantity(d.entry_count)} saved Manpower ${d.entry_count===1?'entry':'entries'}${d.latest_work_date?`; latest work date ${date(d.latest_work_date)}`:''}.`);
   if(/\b(?:break|original|rework|daily|per day)\b/.test(q)){
    if(d.original_or_unclassified_hours!==null)lines.push(`• Original / unclassified: ${quantity(d.original_or_unclassified_hours)} hours`);
    for(const r of d.reworks.slice(0,8))lines.push(`• Rework${r.sequence_number===null?'':` ${r.sequence_number}`}: ${quantity(r.hours)} hours`);
   }
  }
  lines.push('Recorded hours do not include unreported work or forecast remaining effort.');
 }else if(result.tool==='get_job_summary'||result.tool==='get_job_planning'){
  const d=result.data as JobSummaryData,j=d.job;
  lines.push(`${reference(j)} is ${status(j)}${j.archived?' (archived)':''}.`);
  if(result.tool==='get_job_planning'||/\b(?:schedule|dates|summary|overview)\b/.test(q))lines.push(j.effective.planned_start&&j.effective.planned_end?`Planned: ${date(j.effective.planned_start)}–${date(j.effective.planned_end)}.`:'A complete planned start/finish has not been saved.');
  if(/\b(?:material|ready|readiness|summary|overview)\b/.test(q)){
   const material:Record<string,string>={unknown:'Unknown',not_ready:'Not Ready',ordered:'Ordered',ready:'Ready'};
   lines.push(`Materials: ${material[j.material_status]??'Unknown'}. This recorded status does not establish physical readiness.`);
  }
  if(d.counts&&/\b(?:follow.?ups?|issues?|summary|overview)\b/.test(q)&&d.counts.open_follow_ups!==null)lines.push(`${quantity(d.counts.open_follow_ups)} unresolved recorded follow-ups.`);
 }
 if(!lines.length)return null;
 // Caveats survive rendering/truncation. Tool totals remain the authority.
 const warnings=[...new Set(result.unknowns.map(safe).filter(Boolean))];if(result.truncated)warnings.unshift(result.complete&&result.status==='ok'&&result.tool==='get_production_overview'?'The planned-finish list is limited; Job counts cover the complete authorized scope.':result.complete&&result.status==='ok'&&result.tool==='get_job_labor_summary'?'The Rework breakdown is limited; the total includes all recorded hours in the period.':'Some records are omitted; do not treat this as a complete total.');
 const tail=warnings.slice(0,4).join(' ').slice(0,Math.min(650,Math.max(0,maxCharacters)));
 const fit=(ending:string)=>{const budget=Math.max(0,maxCharacters-ending.length-2),body:string[]=[];let length=0;for(const line of lines){if(length+line.length+1>budget)break;body.push(line);length+=line.length+1;}return body;};
 let ending=tail,body=fit(ending);
 if(result.tool==='find_jobs'&&body.length<lines.length){
  // A complete tool page can still exceed the conversation's display budget.
  // Reserve its omission notice alongside, never instead of, tool caveats.
  ending=['Some matching Jobs are omitted from this message.',tail].filter(Boolean).join(' ').slice(0,Math.max(0,maxCharacters));body=fit(ending);
 }
 return [...body,...(ending?[ending]:[])].join('\n');
}
