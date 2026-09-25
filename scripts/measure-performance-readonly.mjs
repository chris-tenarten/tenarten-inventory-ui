// Read-only cardinalities and lean, non-private operational projections. No RPCs or writes.
import { writeFileSync } from 'node:fs';
const base=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!base||!key)throw new Error('Missing read-only inspection credentials');
const headers={apikey:key,Authorization:`Bearer ${key}`,Prefer:'count=exact'};
const results=[];
for(const table of ['jobs','manpower_entries','manpower_reporting_groups','inventory_items','pending_receivals','inventory_transactions','vendor_catalog_v2','bids','planning_phases','planning_items','job_updates','job_attachments','material_usage_reports']){
 const start=performance.now();const r=await fetch(`${base}/rest/v1/${table}?select=id`,{method:'HEAD',headers});
 results.push({table,status:r.status,count:r.headers.get('content-range'),elapsedMs:Math.round(performance.now()-start)});
}
async function rows(table,select,filter=''){
 let all=[],bytes=0,requests=0,ms=0;
 for(let offset=0;;offset+=500){const start=performance.now();const r=await fetch(`${base}/rest/v1/${table}?select=${select}&order=id&offset=${offset}&limit=500${filter}`,{headers});if(!r.ok)throw new Error(`${table}: ${r.status}`);const body=await r.text();ms+=performance.now()-start;bytes+=Buffer.byteLength(body);requests++;const data=JSON.parse(body);all.push(...data);const total=Number(r.headers.get('content-range')?.split('/')[1]);if(all.length>=total||data.length===0)break;}
 return {all,bytes,requests,elapsedMs:Math.round(ms)};
}
const jobs=await rows('jobs','id,archived_at,production_status');
const labor=await rows('manpower_entries','id,job_id,am_hours,pm_hours','&job_id=not.is.null');
const visible=new Set(jobs.all.filter(x=>!x.archived_at).map(x=>x.id));
const relevant=labor.all.filter(x=>visible.has(x.job_id));
const report={measuredAt:new Date().toISOString(),note:'Privileged read-only counts; not RLS/user latency proof. No names, messages, file bytes, or private task contents retrieved.',counts:results,production:{jobs:jobs.all.length,currentJobs:visible.size,statusCounts:Object.fromEntries([...new Set(jobs.all.map(x=>x.production_status))].map(s=>[s,jobs.all.filter(x=>x.production_status===s).length])),laborRows:labor.all.length,laborBytes:labor.bytes,laborRequests:labor.requests,laborElapsedMs:labor.elapsedMs,currentJobLaborRows:relevant.length,currentJobLaborJsonBytes:Buffer.byteLength(JSON.stringify(relevant))}};
writeFileSync('/private/tmp/tenops-performance-hosted.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
