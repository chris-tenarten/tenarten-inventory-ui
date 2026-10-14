/* eslint-disable @typescript-eslint/no-explicit-any -- Heterogeneous synthetic PostgREST fixture rows. */
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { makeRetrievalFixture, fixtureResponse, uuid } from './retrieval-review-fixture.mjs';
const tables: Record<string, any[]> = makeRetrievalFixture();
let cap = 500, delay = 0, failure = '', drift = false;
let calls: Array<{table:string;rows:number;bytes:number;url:string;ms:number}> = [];
globalThis.fetch = async (input) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  assert.equal(url.hostname, 'retrieval-fixture.invalid');
  const start = performance.now();
  const result = fixtureResponse(url, tables, cap);
  if (failure && result.table === failure) return new Response(JSON.stringify({message:'Fixture denied',code:'42501'}), {status:403,headers:{'content-type':'application/json'}});
  if (drift && Number(url.searchParams.get('offset')) > 0) result.headers['content-range'] = `0-0/${result.count + 1}`;
  const body = JSON.stringify(result.rows);
  if (delay) await new Promise(resolve => setTimeout(resolve, delay));
  calls.push({table:result.table,rows:result.rows.length,bytes:Buffer.byteLength(body),url:url.pathname+url.search,ms:performance.now()-start});
  return new Response(body,{status:200,headers:result.headers});
};
const root = process.env.RETRIEVAL_BASELINE_ROOT;
const m = await import(root ? `${root}/src/modules/manpower/manpower.ts` : '../src/modules/manpower/manpower');
const p = await import(root ? `${root}/src/modules/production/jobs.ts` : '../src/modules/production/jobs');
const {aggregateLabor,laborPeriod} = await import('../src/modules/manpower/analytics');
const {loadCompleteRows} = await import('../src/lib/complete-rows');
const hydrate = (facts: any[]) => m.hydrateManpowerEntries(facts,tables.manpower_workers,tables.manpower_tasks,tables.manpower_reporting_groups);
const scope = tables.jobs.filter((j:any)=>!j.archived_at).map((j:any)=>j.id);
const measurements: unknown[] = [];
async function measure(name:string,work:()=>Promise<unknown>){calls=[];const start=performance.now();const data=await work();measurements.push({name,elapsedMs:performance.now()-start,requests:calls.length,rows:calls.reduce((n,c)=>n+c.rows,0),bytes:calls.reduce((n,c)=>n+c.bytes,0),calls:structuredClone(calls)});return data;}
cap=500;delay=20;
await measure(root?'before-manpower-critical':'after-manpower-critical',()=>root?m.loadManpowerEntryFacts():m.loadManpowerReportFacts(laborPeriod(30,'2026-10-14'),null));
// Legacy material reader is capped at 1,000; corrected reader pages completely.
cap=1000;
await measure(root?'before-production-enrichment':'after-production-enrichment',()=>root?p.loadProductionIntegrationSummaries():p.loadProductionIntegrationSummaries(scope));
delay=0;cap=137;
if(!root){
  const full=hydrate(await m.loadManpowerEntryFacts());
  for(const days of [30,90,'year'] as const)for(const job of [null,tables.jobs[0].id,uuid(999999)]){
    const period=laborPeriod(days,'2026-10-14');
    const selected=hydrate(await m.loadManpowerReportFacts(period,job));
    assert.deepEqual(aggregateLabor(selected,tables.manpower_product_categories,tables.manpower_tasks,period,job),aggregateLabor(full,tables.manpower_product_categories,tables.manpower_tasks,period,job));
  }
  const period=laborPeriod(30,'2026-10-14');
  assert.equal((await m.loadManpowerReportFacts(period,null)).filter((e:any)=>e.work_date>=period.start).length,1201);
  const savedJobs=tables.jobs, savedRework=tables.production_rework_cycles;
  tables.jobs=Array.from({length:1201},(_,i)=>({...savedJobs[0],id:uuid(300000+i),name:`Job ${String(i).padStart(5,'0')}`}));
  tables.production_rework_cycles=Array.from({length:1201},(_,i)=>({id:uuid(400000+i),job_id:tables.jobs[i].id,sequence_number:1,production_status:'in_production'}));
  const choices=await m.loadManpowerJobs();assert.equal(choices.length,1201);assert(choices.every((j:any)=>j.active_rework_cycle));
  const core=await p.loadProductionJobs();assert.equal(core.length,1201);assert.deepEqual(core.map((j:any)=>j.id),tables.jobs.map((j:any)=>j.id));
  tables.jobs=savedJobs;tables.production_rework_cycles=savedRework;
  const enriched=await p.loadProductionIntegrationSummaries(scope);
  assert.equal(enriched[scope[0]].materialReportDates.length,1201);
  for(const id of scope){const rows=tables.manpower_entries.filter((e:any)=>e.job_id===id);assert.equal(enriched[id].laborEntryCount,rows.length);assert.equal(enriched[id].actualHours,rows.reduce((n:number,e:any)=>n+e.am_hours+e.pm_hours,0));}
  assert.deepEqual(await p.loadProductionIntegrationSummaries([]),{});
  const ids=Array.from({length:205},(_,i)=>uuid(600000+i));
  tables.material_usage_reports=ids.map((job_id:string,i:number)=>({id:uuid(700000+i),job_id,report_date:'2024-01-01'}));
  assert.equal(Object.keys(await p.loadProductionIntegrationSummaries([...ids,ids[0]])).length,205);
  assert(calls.filter(c=>c.table==='material_usage_reports'&&c.url.includes('600')).length>0);
  // Inclusive boundaries, future rows, unlinked work, inactive labels and Rework
  // all retain the original accounting and historical presentation.
  const example=tables.manpower_entries[0];
  tables.manpower_product_categories[0].is_active=false;
  tables.manpower_entries.push(
    {...example,id:uuid(800001),work_date:period.start,job_id:null,job:null,unlisted_work_label:'Unlinked work'},
    {...example,id:uuid(800002),work_date:period.end,rework_cycle_id:uuid(810001),rework_cycle:{id:uuid(810001),job_id:example.job_id,sequence_number:2,production_status:'in_production'}},
    {...example,id:uuid(800003),work_date:'2026-10-15',am_hours:20},
  );
  const edgeFull=hydrate(await m.loadManpowerEntryFacts());
  for(const days of [30,90,'year'] as const){const range=laborPeriod(days,'2026-10-14');assert.deepEqual(aggregateLabor(hydrate(await m.loadManpowerReportFacts(range,null)),tables.manpower_product_categories,tables.manpower_tasks,range,null),aggregateLabor(edgeFull,tables.manpower_product_categories,tables.manpower_tasks,range,null));}
  failure='manpower_entries';await assert.rejects(m.loadManpowerReportFacts(period,null));await assert.rejects(p.loadProductionIntegrationSummaries(scope));failure='';
  drift=true;await assert.rejects(m.loadManpowerReportFacts(period,null),/changed/);drift=false;
  await assert.rejects(loadCompleteRows(async()=>({data:[{id:'same'}],count:2,error:null})),/changed/);
  await assert.rejects(loadCompleteRows(async(from:number)=>({data:from?[]:[{id:'a'}],count:2,error:null})),/incomplete/);
  // No retained response cache: a subsequent authorized dataset cannot reuse A's rows.
  tables.manpower_entries=[];assert.deepEqual(await m.loadManpowerReportFacts(period,null),[]);
  tables.material_usage_reports=[];assert.deepEqual(await p.loadProductionIntegrationSummaries(scope),{});
}
mkdirSync('docs/project-memory/evidence',{recursive:true});
const output=process.env.RETRIEVAL_EVIDENCE||`docs/project-memory/evidence/2026-10-14-retrieval-${root?'before':'after'}.json`;
writeFileSync(output,JSON.stringify({mode:root?'baseline':'candidate',note:'Actual loaders; synthetic 20ms fetch delay, exact selected-column projection. Not database/browser latency. Baseline material rows intentionally reflect provider truncation.',measurements,fixturesPassed:!root},null,2));
console.log(JSON.stringify(measurements.map((measurement:any)=>({name:measurement.name,elapsedMs:measurement.elapsedMs,requests:measurement.requests,rows:measurement.rows,bytes:measurement.bytes})),null,2));
if(!root)console.log('PASS: 1201 period facts/Job choices/Reworks/material rows, 137-row cap, 205 Job scopes, identical full/period analytics (30/90/year, selected/empty Job), core ordering, lifetime enrichment, denied/drift/duplicate/incomplete reads, no retained dataset cache.');
