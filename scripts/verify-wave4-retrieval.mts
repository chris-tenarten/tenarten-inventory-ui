/* eslint-disable @typescript-eslint/no-explicit-any -- synthetic PostgREST evidence */
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {wave4Fixture,uuid} from './support/wave4-fixture.mjs';
import {fixtureResponse} from './retrieval-review-fixture.mjs';
let tables:Record<string,any[]>=wave4Fixture(),cap=500,fail='',drift=false,missing=false,duplicate=false;
let calls:any[]=[];
globalThis.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);assert.equal(url.hostname,'wave4-fixture.invalid');
 if(init?.signal?.aborted)throw new DOMException('Canceled','AbortError');
 const r=fixtureResponse(url,tables,cap),offset=Number(url.searchParams.get('offset')||0);
 if(fail===r.table)return new Response('{"message":"Controlled denial","code":"42501"}',{status:403,headers:r.headers});
 if(drift&&offset)r.headers['content-range']=`0-0/${r.count+1}`;
 if(missing&&offset)r.rows=[];
 if(duplicate&&offset&&r.rows[0])r.rows[0].id=tables[r.table][0].id;
 calls.push({table:r.table,rows:r.rows.length,bytes:Buffer.byteLength(JSON.stringify(r.rows)),url:url.pathname+url.search});return new Response(JSON.stringify(r.rows),{headers:r.headers});
};
const m=await import('../src/modules/manpower/manpower');
const i=await import('../src/modules/inventory/retrieval');
const {aggregateLabor,laborPeriod}=await import('../src/modules/manpower/analytics');
const targetsModule=await import('../src/modules/manpower/work-target');
const signal=()=>new AbortController().signal,measurements:any[]=[],checks:string[]=[];
async function measure(name:string,fn:()=>Promise<any>){calls=[];const start=performance.now();const data=await fn();measurements.push({name,requests:calls.length,rows:calls.reduce((n,r)=>n+r.rows,0),jsonBytes:calls.reduce((n,r)=>n+r.bytes,0),elapsedMs:performance.now()-start,calls:structuredClone(calls)});return data;}
const hydrate=(facts:any[])=>m.hydrateManpowerEntries(facts,tables.manpower_workers,tables.manpower_tasks,tables.manpower_reporting_groups);
const period=laborPeriod(30,'2026-10-19');
const report=await measure('selected report unchanged',()=>m.loadManpowerReportFacts(period,null));
await measure('Manpower history deferred until requested',()=>m.loadManpowerEntryFacts(signal()));
await measure('before initial receivals / after requested complete receivals',()=>i.loadReceivalRows(true,signal()));
await measure('after initial outstanding receivals',()=>i.loadReceivalRows(false,signal()));
await measure('stock unchanged',()=>i.loadInventoryRows(signal()));
await measure('complete Activity when opened',()=>i.loadInventoryTransactions(signal()));
assert.equal(report.filter((r:any)=>r.work_date>=period.start).length,1201);
cap=137;
const complete=hydrate(await m.loadManpowerEntryFacts(signal()));assert.equal(complete.length,12001);
for(const days of [30,90,'year'] as const)for(const job of [null,tables.jobs[0].id,uuid(999999)]){
 const p=laborPeriod(days,'2026-10-19'),subset=hydrate(await m.loadManpowerReportFacts(p,job,signal()));assert.deepEqual(aggregateLabor(subset,tables.manpower_product_categories,tables.manpower_tasks,p,job),aggregateLabor(complete,tables.manpower_product_categories,tables.manpower_tasks,p,job));
}
const choices=targetsModule.buildManpowerWorkTargetOptions(await m.loadManpowerJobs(),complete);
const archived=complete.find(e=>e.job?.archived_at&&!e.rework_cycle_id)!;
const preserved=choices.find(o=>o.value===targetsModule.manpowerEntryTargetValue(archived))!;
assert.equal(preserved.selectable,false);assert.deepEqual(targetsModule.manpowerIdentityForTarget(preserved.value,'',choices),{job_id:archived.job_id,rework_cycle_id:null,unlisted_work_label:null});
const historicalCycle={...archived,rework_cycle_id:uuid(880001),rework_cycle:{id:uuid(880001),job_id:archived.job_id!,sequence_number:1,production_status:'complete' as const}};
const cycleChoices=targetsModule.buildManpowerWorkTargetOptions([], [historicalCycle]);
assert(cycleChoices.every(choice=>!choice.selectable));assert.equal(targetsModule.manpowerIdentityForTarget(targetsModule.manpowerEntryTargetValue(historicalCycle),'',cycleChoices).rework_cycle_id,uuid(880001));
checks.push('archived ordinary Job identity remains saveable but unavailable as a new-entry choice');
checks.push('full/scoped totals and reporting structures equal for nine period/Job scopes, old and archived work preserved');
const allReceivals:any[]=await i.loadReceivalRows(true,signal()),outstanding:any[]=await i.loadReceivalRows(false,signal()),stock:any[]=await i.loadInventoryRows(signal()),transactions:any[]=await i.loadInventoryTransactions(signal());
assert.equal(allReceivals.length,1206);assert.equal(outstanding.length,5);assert.equal(transactions.length,1401);assert.equal(stock.length,1201);
assert.deepEqual(outstanding,allReceivals.filter(r=>r.status!=='received'));
assert.equal(stock.reduce((n,r)=>n+Number(r.quantity),0),tables.inventory_items.reduce((n,r)=>n+Number(r.quantity),0));
assert.deepEqual(stock.map(r=>[r.id,r.production_job_id,r.temporary_job_label,r.quantity]),tables.inventory_items.map(r=>[r.id,r.production_job_id,r.temporary_job_label,r.quantity]));
const numericStock=tables.inventory_items;tables.inventory_items=numericStock.map((row,index)=>({...row,id:index+1}));assert.equal((await i.loadInventoryRows(signal())).length,1201);tables.inventory_items=numericStock;
checks.push('complete Inventory quantities/reservations, outstanding vs history equality, and all 1401 audit transactions through provider cap 137');
for(const fn of [()=>i.loadInventoryRows(signal()),()=>i.loadReceivalRows(true,signal()),()=>i.loadInventoryTransactions(signal()),()=>m.loadManpowerEntryFacts(signal())]){
 for(const mode of ['drift','missing','duplicate']){drift=mode==='drift';missing=mode==='missing';duplicate=mode==='duplicate';await assert.rejects(fn);drift=missing=duplicate=false;}
}
for(const [table,fn] of [['inventory_items',()=>i.loadInventoryRows(signal())],['pending_receivals',()=>i.loadReceivalRows(true,signal())],['inventory_transactions',()=>i.loadInventoryTransactions(signal())],['manpower_entries',()=>m.loadManpowerReportFacts(period,null,signal())]] as const){fail=table;await assert.rejects(fn);fail='';}
checks.push('every changed complete reader rejects denial, changed counts, duplicates and incomplete pages');
const abort=new AbortController();abort.abort();await assert.rejects(()=>i.loadInventoryRows(abort.signal));await assert.rejects(()=>m.loadManpowerEntryFacts(abort.signal));
tables={...tables,inventory_items:[],pending_receivals:[],inventory_transactions:[],manpower_entries:[]};assert.deepEqual(await i.loadInventoryRows(signal()),[]);assert.deepEqual(await i.loadReceivalRows(true,signal()),[]);assert.deepEqual(await i.loadInventoryTransactions(signal()),[]);assert.deepEqual(await m.loadManpowerReportFacts(period,null,signal()),[]);
checks.push('empty and canceled reads do not publish partial data');
mkdirSync('docs/project-memory/evidence',{recursive:true});writeFileSync('docs/project-memory/evidence/2026-10-19-wave4-retrieval.json',JSON.stringify({fixture:true,hostedWrites:0,measurements,checks,note:'JSON bytes and local JS observations; no SQL, compression or Production latency measured. Before uses unchanged baseline projection and complete status scope, not a hosted comparison.'},null,2));console.log('PASS '+checks.join('; '));
