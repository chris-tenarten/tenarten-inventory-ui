import assert from 'node:assert/strict';
import { normalizePlanning, planningForMode } from '../src/modules/pre-production/planning-model';
import type { Bid } from '../src/modules/pre-production/types';
import type { ProductionJob } from '../src/modules/production/types';
import type { BidPlanning } from '../src/modules/pre-production/planning';
import type { PlanningPhase } from '../src/modules/planning/types';
import { loadCompleteRows } from '../src/lib/complete-rows';
async function main(){
const bids=[{id:'a',projectName:'A',status:'active'},{id:'lost',status:'lost'},{id:'converted',status:'won'},{id:'undated',projectName:'U',status:'won'}] as Bid[];
const windows=bids.map(b=>({id:b.id,projected_production_start:b.id==='undated'?null:'2026-09-02',projected_production_end:b.id==='undated'?null:'2026-09-03',production_job_id:b.id==='converted'?'canonical':null,updated_at:'stamp'})) as BidPlanning[];
const jobs=[{id:'j',name:'Job',lifecycle_key:'rework:r',production_status:'in_production',planned_start:'2026-09-01',planned_end:'2026-09-05',rework_cycle:{id:'r',sequence_number:2}}] as unknown as ProductionJob[];
const model=normalizePlanning(bids,windows,jobs,[]);
assert.deepEqual(model.map(r=>r.key),['rework:r','intake:a','intake:undated']);assert.equal(planningForMode(model,'production').length,1);
const tied=normalizePlanning([{...bids[0]}],[{...windows[0],projected_production_start:'2026-09-01'}],jobs,[]);assert.equal(tied[0].source,'production');
// Scrambled fixtures exercise all sorting keys, not incidental query order.
const sortedBids=[
 {id:'undated',projectName:'Undated',start:null,end:null},
 {id:'late',projectName:'Late',start:'2026-10-15',end:'2026-10-16'},
 {id:'z',projectName:'zebra',start:'2026-10-05',end:'2026-10-09'},
 {id:'b',projectName:' Alpha ',start:'2026-10-05',end:'2026-10-09'},
 {id:'a',projectName:'alpha',start:'2026-10-05',end:'2026-10-09'},
 {id:'short',projectName:'Z',start:'2026-10-05',end:'2026-10-06'},
 {id:'early',projectName:'Early',start:'2026-10-01',end:'2026-10-02'},
];
const sourceBids=sortedBids.map(b=>({...b,status:'active'})) as unknown as Bid[];
const sourceWindows=sortedBids.map(b=>({id:b.id,projected_production_start:b.start,projected_production_end:b.end,production_job_id:null})) as BidPlanning[];
const sourceJobs=[
 {...jobs[0],id:'late-job',lifecycle_key:'original:late-job',planned_start:'2026-10-20',planned_end:'2026-10-21'},
 {...jobs[0],id:'undated-job',lifecycle_key:'original:undated-job',planned_start:null,planned_end:null},
 {...jobs[0],id:'rework',lifecycle_key:'rework:active',planned_start:'2026-10-03',planned_end:'2026-10-04'},
 {...jobs[0],id:'tie',lifecycle_key:'original:tie',planned_start:'2026-10-05',planned_end:'2026-10-30'},
] as ProductionJob[];
const phases=[
 {id:'z',job_id:'tie',start_date:'2026-10-07',end_date:'2026-10-08'},
 {id:'b',job_id:'tie',start_date:'2026-10-06',end_date:'2026-10-08'},
 {id:'a',job_id:'tie',start_date:'2026-10-06',end_date:'2026-10-08'},
 {id:'early',job_id:'tie',start_date:'2026-10-05',end_date:'2026-10-09'},
 {id:'undated',job_id:'tie',start_date:null,end_date:null},
] as PlanningPhase[];
const sorted=normalizePlanning(sourceBids,sourceWindows,sourceJobs,phases);
assert.deepEqual(planningForMode(sorted,'intake').map(r=>r.key),['early','short','a','b','z','late','undated'].map(id=>'intake:'+id));
assert.deepEqual(planningForMode(sorted,'production').map(r=>r.key),['rework:active','original:tie','original:late-job','original:undated-job']);
assert.deepEqual(sorted.map(r=>r.key),['intake:early','rework:active','original:tie','intake:short','intake:a','intake:b','intake:z','intake:late','original:late-job','original:undated-job','intake:undated']);
const phaseJob=sorted.find(r=>r.key==='original:tie');assert(phaseJob?.source==='production');
assert.deepEqual(phaseJob.phases.map(p=>p.id),['early','a','b','z','undated']);
assert.deepEqual(sorted,normalizePlanning([...sourceBids].reverse(),[...sourceWindows].reverse(),[...sourceJobs].reverse(),[...phases].reverse()));
const data=Array.from({length:1201},(_,i)=>({id:String(i)}));let calls=0;
assert.deepEqual(await loadCompleteRows(async from=>{calls++;return {data:data.slice(from,from+200),error:null,count:data.length};}),data);assert.equal(calls,7);
await assert.rejects(loadCompleteRows(async()=>({data:null,error:null,count:1})),/incomplete/);
await assert.rejects(loadCompleteRows(async()=>({data:[{id:'same'}],error:null,count:3})),/changed/);
await assert.rejects(loadCompleteRows(async()=>({data:[],error:null,count:null})),/complete/);
let page=0;await assert.rejects(loadCompleteRows(async()=>({data:[{id:String(page++)}],error:null,count:page===1?3:4})),/changed/);
console.log('PASS Timeline model, eligibility, effective lifecycle identity, complete loading and fail-closed cases.');
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
