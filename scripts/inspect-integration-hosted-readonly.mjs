/** Existing credentials only. No user impersonation, writes, private content, or new credentials. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const env=Object.fromEntries(readFileSync('/Users/chrisngo/source/repos/tenarten-inventory-ui/.env.local','utf8').split('\n').filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const at=l.indexOf('=');return[l.slice(0,at),l.slice(at+1).trim().replace(/^(["'])(.*)\1$/,'$2')];}));
const base=env.NEXT_PUBLIC_SUPABASE_URL; if(!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(base))throw Error('Expected existing hosted project');
let tokenState={present:false,unexpired:false};try{const claims=JSON.parse(Buffer.from(env.TENOPS_DEMO_CHRIS_ACCESS_TOKEN.split('.')[1],'base64url'));tokenState={present:true,unexpired:claims.exp>Date.now()/1000,role:claims.role};}catch{}
const path='docs/project-memory/evidence/2026-10-19-integration-hosted-observations.json';
const results=process.argv.includes('--period-only')?JSON.parse(readFileSync(path)).results.filter(r=>!(r.table==='manpower_entries'&&Object.keys(r.filter).length)):[];
async function head(table,filter,kind){
 const credential=kind==='anonymous'?env.NEXT_PUBLIC_SUPABASE_ANON_KEY:env.SUPABASE_SERVICE_ROLE_KEY;if(!credential)return;
 const url=new URL(`/rest/v1/${table}`,base);url.searchParams.set('select','id');for(const [k,v]of Object.entries(filter))url.searchParams.set(k,v);
 const start=performance.now(),r=await fetch(url,{method:'HEAD',headers:{apikey:credential,authorization:'Bearer '+credential,Prefer:'count=exact'},redirect:'error',signal:AbortSignal.timeout(20000)});
 results.push({kind,table,filter,status:r.status,contentRange:r.headers.get('content-range'),elapsedMs:Math.round(performance.now()-start)});
}
if(!process.argv.includes('--period-only'))for(const table of ['manpower_entries','manpower_workers','manpower_tasks','manpower_reporting_groups','production_rework_cycles'])await head(table,{},'anonymous');
for(const [table,filter]of [['jobs',{archived_at:'is.null'}],['proposals',{}],['purchase_orders',{}],['manpower_entries',{}],['manpower_entries',{and:'(work_date.gte.2026-09-20,work_date.lte.2026-10-19)'}],['inventory_items',{}],['pending_receivals',{status:'in.(pending,partially_received,received)'}],['pending_receivals',{status:'in.(pending,partially_received)'}],['inventory_transactions',{}]]){if(process.argv.includes('--period-only')&&!filter.and)continue;await head(table,filter,'privileged-count-only');}
mkdirSync('docs/project-memory/evidence',{recursive:true});const report={measuredAt:new Date().toISOString(),existingUserToken:tokenState,authenticatedPerformanceComparisonAvailable:false,reason:tokenState.unexpired?'An unexpired token needs verification through the established guard before claiming user performance.':'Existing user token expired; no refresh credential accompanies it. No credentials requested or minted.',results,securityScope:'HEAD contains no business row bodies. Effective grants/policies checked separately via catalog-only SQL.',limitations:'Privileged HEAD timings/counts bypass user RLS; not user latency, SQL time, or baseline/candidate application measurements. No private message/task data queried.',businessWrites:0};
writeFileSync('docs/project-memory/evidence/2026-10-19-integration-hosted-observations.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
