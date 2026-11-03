import assert from 'node:assert/strict';
import { executeLaborReport, LABOR_REPORT_LIMITS, type LaborReportOptions } from '../src/modules/manpower/labor-report.ts';
import { aggregateLabor, laborPeriod, type LaborAnalyticsEntry } from '../src/modules/manpower/analytics.ts';
import { fixture, entries, categories, tasks, id, A, B, SLAB, STAIR, ref, entry, type LaborFixtureOptions } from './support/tenbot-labor-fixture.mts';

const defaults={period:30 as const,limit:5};
const config:LaborReportOptions={hasCapability:async()=>true,today:'2026-11-02',now:()=>new Date('2026-11-02T20:00:00Z')};
const execute=async(options:LaborFixtureOptions={},args:unknown=defaults,settings:Partial<LaborReportOptions>={})=>{const f=fixture(options);return{...f,result:await executeLaborReport(f.caller,args,{...config,...settings})};};
let groups=0;
async function check(name:string,run:()=>Promise<void>|void){await run();groups++;console.log('PASS '+name);}

await check('Authoritative dashboard agreement, decimal rounding, archived Jobs, original/Rework, Uncategorized and unlinked',async()=>{
  const {result}=await execute();assert.equal(result.status,'ok');const data=result.data!;
  const authoritative=aggregateLabor(entries.map(e=>({...e,task:{display_name:'Finishing'}})) as LaborAnalyticsEntry[],categories,tasks,laborPeriod(30,'2026-11-02'),null);
  assert.equal(data.total_hours,authoritative.total/100);assert.equal(data.total_hours,24);assert.equal(data.uncategorized_hours,10);assert.equal(data.unlinked_hours,.5);assert.equal(data.entry_count,6);
  assert.deepEqual(data.products.map(p=>[p.id,p.hours]),[["__uncategorized__",10],[SLAB,8],[STAIR,6]]);
  assert.equal(data.products[1].contributing_job_count,2);assert.equal(data.products[1].contributing_jobs[0].job_id,B);assert.equal(data.products[1].unlinked_hours,.5);assert.match(data.products[2].label,/Inactive/);
  assert.deepEqual(data.jobs.map(j=>[j.job_id,j.hours]),authoritative.jobs.map(j=>[j.id,j.units/100]));assert.deepEqual(result.accessRefs,[A,B]);assert.equal(JSON.stringify(result).includes('PRIVATE_SENTINEL'),false);
});
await check('Category→Job projection keeps all-product dashboard totals and ranks category contributions',async()=>{
  const {result}=await execute({}, {...defaults,product_category_id:SLAB});const data=result.data!;assert.equal(result.status,'ok');assert.equal(data.total_hours,24);assert.equal(data.selected_product_hours,8);assert.equal(data.scope.totals,'all_products');assert.deepEqual(data.jobs.map(j=>[j.job_id,j.hours]),[[B,4],[A,3.5]]);assert.equal(data.products.length,1);assert.deepEqual(result.accessRefs,[A,B]);
});
await check('Selected canonical Job comparison and stable product identities',async()=>{
  const {result}=await execute({}, {...defaults,job_id:A});const data=result.data!;assert.equal(data.total_hours,9.5);assert.deepEqual(data.products.map(p=>[p.id,p.hours]),[[STAIR,6],[SLAB,3.5]]);assert.deepEqual(result.accessRefs,[A]);assert.equal(data.scope.job_id,A);
});
await check('Selected empty Job is currently authorized, named and retained; hidden/missing Job cannot become zero labor',async()=>{
  const {result,calls}=await execute({entries:[]},{...defaults,job_id:A});assert.equal(result.status,'ok');assert.equal(result.data!.entry_count,0);assert.equal(result.data!.total_hours,0);assert.equal(result.data!.scope.job_reference,'26-001 — Alpha');assert.deepEqual(result.accessRefs,[A]);assert.equal(calls[0].table,'jobs');assert.equal(calls[0].columns,'id,name,job_number,production_status,archived_at');
  const hidden=await execute({entries:[],jobs:[]},{...defaults,job_id:A});assert.equal(hidden.result.status,'not_authorized');assert.equal(hidden.result.data,null);assert.deepEqual(hidden.result.accessRefs,[]);assert.equal(hidden.calls.length,1);
  const missing=await execute({entries:[]},{...defaults,job_id:id(999)});assert.equal(missing.result.status,'not_authorized');
});
await check('Year boundary and available-history semantics exactly match dashboard',async()=>{
  const {result}=await execute({}, {...defaults,period:'year'});const authoritative=aggregateLabor(entries.map(e=>({...e,task:{display_name:'Finishing'}})) as LaborAnalyticsEntry[],categories,tasks,laborPeriod('year','2026-11-02'),null);
  assert.equal(result.status,'ok');assert.deepEqual(result.data!.period,authoritative.period);assert.deepEqual(result.data!.requestedPeriod,authoritative.requestedPeriod);assert.equal(result.data!.total_hours,44);assert.equal(result.data!.period.start,'2026-09-01');assert.deepEqual(laborPeriod('year','2024-02-29'),{start:'2023-03-01',end:'2024-02-29',days:'year'});
});
await check('Top-N and contribution truncation are disclosed while aggregate remains complete',async()=>{
  const {result}=await execute({}, {period:30,limit:1,product_category_id:SLAB});assert.equal(result.complete,true);assert.equal(result.data!.product_count,1);assert.equal(result.data!.products[0].has_more_jobs,true);assert.equal(result.data!.products[0].contributing_job_count,2);assert.equal(result.data!.has_more_jobs,true);assert.equal(result.data!.products[0].hours,8);assert.deepEqual(result.accessRefs,[A,B]);
});
const paged=Array.from({length:1201},(_,i)=>entry(10000+i,A,SLAB,.01));
await check('Complete multi-page counts and original integer-hundredth accounting',async()=>{const {result,calls}=await execute({entries:paged});assert.equal(result.status,'ok');assert.equal(result.data!.entry_count,1201);assert.equal(result.data!.total_hours,12.01);assert.deepEqual(calls.filter(c=>c.table==='manpower_entries'&&c.limit===null).map(c=>c.from),[0,500,1000]);});
await check('Count drift, duplicate identity, short page and source errors withhold all rankings',async()=>{for(const fault of ['count','duplicate','short','error'] as const){const {result}=await execute({entries:paged,fault});assert.equal(result.status,'incomplete',fault);assert.equal(result.data,null);assert.deepEqual(result.accessRefs,[]);assert.equal(JSON.stringify(result).includes('PRIVATE_PROVIDER_ERROR'),false);}});
await check('5000-entry and reference caps fail closed',async()=>{const {result}=await execute({entries:Array.from({length:LABOR_REPORT_LIMITS.entries+1},(_,i)=>entry(20000+i,A,SLAB,.01))});assert.equal(result.status,'incomplete');assert.equal(result.data,null);const refs=await execute({categories:Array.from({length:501},(_,i)=>ref(30000+i,'Category'+i))});assert.equal(refs.result.status,'incomplete');});
await check('Missing current product/Job/task joins and inconsistent current Job labels fail closed',async()=>{
  const hidden=structuredClone(entries);hidden[0].job=null;assert.equal((await execute({entries:hidden})).result.status,'incomplete');
  assert.equal((await execute({categories:categories.filter(c=>c.id!==SLAB)})).result.status,'incomplete');assert.equal((await execute({tasks:[]})).result.status,'incomplete');
  const drift=structuredClone(entries);drift[1].job!.name='Changed';assert.equal((await execute({entries:drift})).result.status,'incomplete');
});
await check('Existing capability checked before and after; revocation does not publish retained facts',async()=>{let checks=0;const denied=await execute({},defaults,{hasCapability:async()=>false});assert.equal(denied.result.status,'not_authorized');assert.equal(denied.calls.length,0);const revoked=await execute({},defaults,{hasCapability:async()=>++checks===1});assert.equal(checks,2);assert.equal(revoked.result.status,'not_authorized');assert.equal(revoked.result.data,null);assert.deepEqual(revoked.result.accessRefs,[]);});
await check('Input is fixed, empty authorized data is complete, unknown selected categories do not fabricate',async()=>{
  for(const args of [{period:30,limit:5,sql:'select *'}, {period:7,limit:1},{period:30,limit:6},{period:30,limit:1,job_id:'26-001'}]){const {result,calls}=await execute({},args);assert.equal(result.status,'invalid_request');assert.equal(calls.length,0);}
  const empty=await execute({entries:[]});assert.equal(empty.result.status,'ok');assert.equal(empty.result.data!.total_hours,0);assert.deepEqual(empty.result.data!.products,[]);
  assert.equal((await execute({}, {...defaults,product_category_id:id(999)})).result.status,'not_authorized');
});
await check('Abort/deadline bounded and caller-visible fixture parity',async()=>{
  const abort=new AbortController();abort.abort();const aborted=await execute({},defaults,{signal:abort.signal});assert.equal(aborted.result.status,'incomplete');assert.equal(aborted.calls.length,0);
  const stalled=await execute({fault:'stall'},defaults,{deadlineMs:5});assert.equal(stalled.result.status,'incomplete');assert.equal(stalled.result.data,null);
  const admin='cba79566-3fde-4910-9cf6-45687db70b01';const {result}=await execute({entries:[entry(100,admin,SLAB,2)]});assert.equal(result.status,'ok');assert.equal(result.data!.total_hours,2);assert.deepEqual(result.accessRefs,[admin]);assert.equal(result.data!.scope.fixture,'caller_visible');
});
console.log(JSON.stringify({passed:true,groups,provider:'deterministic service fixture; no inference or network',calculations:'same aggregateLabor/laborPeriod as dashboard'}));
