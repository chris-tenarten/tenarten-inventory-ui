// Read-only operational payload measurement. Never persists rows, names or notes.
import { readFileSync, writeFileSync } from 'node:fs';
import { ENTRY_FACT_COLUMNS } from '../src/modules/manpower/manpower';
import { aggregateLabor } from '../src/modules/manpower/analytics';
import type { ManpowerEntry } from '../src/modules/manpower/types';
const key=process.env.SUPABASE_SERVICE_ROLE_KEY!;
const base=process.env.NEXT_PUBLIC_SUPABASE_URL!;
if(!key||!base)throw new Error('Missing inspection credentials');
const originalColumns=readFileSync('src/modules/manpower/manpower.ts','utf8').match(/const ENTRY_COLUMNS = `([\s\S]*?)`;/)![1].replace(/\s/g,'');
const columns=process.env.PERF_FACTS==='1'?ENTRY_FACT_COLUMNS.replace(/\s/g,''):originalColumns;
const rows:ManpowerEntry[]=[];let bytes=0,requests=0;const start=performance.now();
while(true){
 const url=new URL(`${base}/rest/v1/manpower_entries`);url.searchParams.set('select',columns);url.searchParams.set('order','work_date.desc,created_at.desc,id');url.searchParams.set('offset',String(rows.length));url.searchParams.set('limit','500');
 const r=await fetch(url,{headers:{apikey:key,Authorization:`Bearer ${key}`,Prefer:'count=exact'}});
 if(!r.ok)throw new Error(`Read failed: ${r.status}`);
 const text=await r.text();bytes+=Buffer.byteLength(text);requests++;const page=JSON.parse(text);rows.push(...page);
 const count=Number(r.headers.get('content-range')?.split('/')[1]);if(rows.length===count)break;if(!page.length||rows.length>count)throw new Error('Incomplete snapshot');
}
const networkMs=Math.round(performance.now()-start);
const times:number[]=[];
for(let i=0;i<(process.env.PERF_FACTS==='1'?0:51);i++){const t=performance.now();aggregateLabor(rows,[],[],{days:30,start:'2026-08-27',end:'2026-09-25'},null);if(i)times.push(performance.now()-t);}
times.sort((a,b)=>a-b);
const report={rows:rows.length,jsonBytes:bytes,requests,networkMs,aggregationMs:{p50:times[25],p95:times[47]},note:process.env.PERF_FACTS==='1'?'Read-only facts payload; no CPU aggregation on unhydrated rows. No rows retained.':'One privileged read-only network sample; 50 warm local CPU samples. No rows retained. Empty label vocabularies; real operational entry distribution.'};
writeFileSync(process.env.PERF_FACTS==='1'?'/private/tmp/tenops-manpower-facts-measurement.json':'/private/tmp/tenops-manpower-measurement.json',JSON.stringify(report,null,2));console.log(report);
