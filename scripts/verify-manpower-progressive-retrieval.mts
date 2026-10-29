import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
import {progressiveManpowerFixture,progressiveResponse,uuid} from './support/manpower-progressive-fixture.mjs';
import {readCompleteGroupBatch,nextHistoryBatch,orderHistoryGroups,UNGROUPED_HISTORY_KEY,HISTORY_GROUP_BATCH_SIZE} from '../src/modules/manpower/progressive-history';
import {sortReportingGroups} from '../src/modules/manpower/group-presentation';
const tables=progressiveManpowerFixture(),calls:URL[]=[],checks:string[]=[];
const original=globalThis.fetch;
globalThis.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(init?.signal?.aborted)throw new DOMException('Aborted','AbortError');calls.push(url);const result=progressiveResponse(url,tables,137);return new Response(init?.method==='HEAD'?null:JSON.stringify(result.rows),{status:200,headers:result.headers});};
try{
 const {loadManpowerGroupFacts,loadManpowerEntryCount,loadManpowerReportingGroups}=await import('../src/modules/manpower/manpower');
 const groups=await loadManpowerReportingGroups();assert.equal(groups.length,1013);checks.push('Complete group metadata above 1000/provider cap');
 const keys=Array.from({length:8},(_,i)=>uuid(51000+i)),batch=await loadManpowerGroupFacts(keys);assert.equal(batch.length,1207);assert.equal(new Set(batch.map(row=>row.id)).size,1207);
 for(const key of keys){const actual=batch.filter(row=>row.reporting_group_id===key),expected=tables.manpower_entries.filter(row=>row.reporting_group_id===key);assert.equal(actual.length,expected.length);assert.equal(actual.reduce((n,row)=>n+row.am_hours+row.pm_hours,0),expected.length*3.75);}
 assert.equal(batch.filter(row=>row.reporting_group_id===keys[0]).length,157);checks.push('Cross-period recent group: all 157 members and archived Jobs, exact AM/PM totals');
 const large=await loadManpowerGroupFacts([uuid(51008)]);assert.equal(large.length,1501);assert.equal(large.reduce((n,row)=>n+row.am_hours+row.pm_hours,0),5628.75);assert(large.every((row,index)=>index===0||row.id>large[index-1].id));checks.push('1501-member group complete with immutable id cursors and capped provider');
 const ungrouped=await loadManpowerGroupFacts([UNGROUPED_HISTORY_KEY]);assert.equal(ungrouped.length,140);assert.equal(await loadManpowerEntryCount(),12888);checks.push('Complete ungrouped scope and final counted coverage');
 const groupCalls=calls.filter(url=>url.searchParams.has('reporting_group_id'));assert(groupCalls.every(url=>url.searchParams.get('order')==='id.asc'&&url.searchParams.get('limit')==='500'&&!url.searchParams.has('offset')));assert(groupCalls.some(url=>url.searchParams.has('id')));checks.push('No raw-row offset paging, mutable-date cursor or global history GET');
 const ordered=orderHistoryGroups(groups);const priority=new Set([ordered[2],UNGROUPED_HISTORY_KEY]);const next=nextHistoryBatch([...ordered,UNGROUPED_HISTORY_KEY],priority,new Set());assert.equal(next[0],ordered[2]);assert(next.length<=HISTORY_GROUP_BATCH_SIZE);const complete=new Set(next);assert.deepEqual(nextHistoryBatch([...ordered,UNGROUPED_HISTORY_KEY],priority,complete),[UNGROUPED_HISTORY_KEY]);checks.push('Recent priority, bounded group batches and ungrouped priority');
 await assert.rejects(loadManpowerGroupFacts(Array.from({length:9},(_,i)=>uuid(i))),/Invalid/);await assert.rejects(loadManpowerGroupFacts([UNGROUPED_HISTORY_KEY,keys[0]]),/Invalid/);
 let n=0;await assert.rejects(readCompleteGroupBatch(async()=>++n===1?{data:[{id:'a'}],count:3,error:null}:{data:[{id:'b'}],count:3,error:null}),/membership changed/);
 n=0;await assert.rejects(readCompleteGroupBatch(async()=>++n===1?{data:[{id:'a'}],count:2,error:null}:{data:[{id:'a'}],count:1,error:null}),/pagination changed/);
 await assert.rejects(readCompleteGroupBatch(async()=>({data:[],count:1,error:null})),/incomplete/);await assert.rejects(readCompleteGroupBatch(async()=>({data:[],count:null,error:null})),/verify/);
 await assert.rejects(readCompleteGroupBatch(async()=>({data:[],count:0,error:{message:'Denied'}})),/Denied/);checks.push('Count drift, duplicate cursor, empty/truncated page, missing count and denial reject before publication');
 const controller=new AbortController();controller.abort();await assert.rejects(loadManpowerGroupFacts(keys,controller.signal));checks.push('Aborted group read rejects');
 if(process.env.MANPOWER_DEFAULT_VIEW_CHECK==='true'){
  const metadata=(id:string,name:string,created:string)=>({id,display_name:name,created_at:created,updated_at:'2026-10-29'});
  const entry=(date:string,job:string)=>({...tables.manpower_entries[0],work_date:date,job:{...tables.jobs[0],name:job}});
  const g=[
   {key:'older',group:metadata('a','07/01/2026 Older','2026-10-29'),label:'Older',entries:[entry('2026-10-28','Zebra')]},
   {key:'newer',group:metadata('b','10/28/2026 Newer','2026-07-01'),label:'Newer',entries:[entry('2025-01-01','Alpha'),entry('2024-01-01','Zulu')]},
   {key:'undated-old',group:metadata('c','Undated old','2026-07-01'),label:'Undated old',entries:[]},
   {key:'undated-new',group:metadata('d','Undated new','2026-10-01'),label:'Undated new',entries:[]},
   {key:'ungrouped',group:null,label:'Ungrouped entries',entries:[]},
  ];
  assert.deepEqual(sortReportingGroups(g,'reporting-date').map(x=>x.key),['newer','older','undated-new','undated-old','ungrouped']);checks.push('Historical reporting-date/default, creation fallback, ungrouped last; recent edits do not override date');
  assert.deepEqual(sortReportingGroups(g,'work-date').slice(0,2).map(x=>x.key),['older','newer']);checks.push('Work-date uses latest member date across complete membership');
  assert.deepEqual(sortReportingGroups(g,'job-name').slice(0,2).map(x=>x.key),['newer','older']);assert.equal(g[0].key,'older');checks.push('Job name uses first alphabetical complete-group name, deterministic ties, no input mutation');
 }
 writeFileSync(process.env.MANPOWER_DEFAULT_VIEW_CHECK==='true'?'docs/project-memory/evidence/2026-10-29-manpower-default-retrieval.json':'docs/project-memory/evidence/2026-10-20-manpower-progressive-retrieval.json',JSON.stringify({checks,synthetic:true,hostedReads:0,hostedWrites:0,providerCap:137},null,2));console.log(checks.map(check=>'PASS '+check).join('\n'));
}finally{globalThis.fetch=original;}
