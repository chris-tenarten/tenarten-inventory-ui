import assert from 'node:assert/strict';
// No credentials or network: exercise the real query builders against an in-memory REST transport.
async function main(){
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://planning.invalid';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='offline-fixture';
  const calls:URL[]=[];
  const jobs=Array.from({length:1201},(_,i)=>({id:`job-${i}`,name:`Job ${i}`,production_status:'not_started',planned_start:'2026-10-01',planned_end:'2026-10-02',updated_at:'2026-09-25'}));
  const cycles=jobs.map((j,i)=>({id:`cycle-${i}`,job_id:j.id,sequence_number:1,production_status:'in_progress',planned_start:'2026-11-01',planned_end:'2026-11-02',updated_at:'2026-09-25'}));
  const bids=jobs.map((j,i)=>({id:`bid-${i}`,project_name:j.name,status:'active',customer:'Fixture'}));
  const phases=jobs.map((j,i)=>({id:`phase-${i}`,job_id:j.id,updated_at:'2026-09-25'}));
  globalThis.fetch=async(input,init)=>{
    const url=new URL(String(input));assert.equal(url.origin,'https://planning.invalid');calls.push(url);
    assert.match(new Headers(init?.headers).get('prefer')??'',/count=exact/);
    const name=url.pathname.split('/').at(-1);let rows:Array<{id:string}>=name==='jobs'?jobs:name==='production_rework_cycles'?cycles:name==='list_bids'?bids:phases;
    if(name==='planning_phases'&&url.searchParams.has('job_id')){const ids=url.searchParams.get('job_id')!.slice(4,-1).split(',');rows=phases.filter(p=>ids.includes(p.job_id));}
    const start=Number(url.searchParams.get('offset')??0),limit=Math.min(200,Number(url.searchParams.get('limit')??500));
    const page=rows.slice(start,start+limit);
    return new Response(JSON.stringify(page),{status:200,headers:{'Content-Type':'application/json','Content-Range':`${start}-${start+page.length-1}/${rows.length}`}});
  };
  const {loadProductionJobs}=await import('../src/modules/production/jobs');
  const {loadBids}=await import('../src/modules/pre-production/queries');
  const {loadPlanningPhases}=await import('../src/modules/planning/data');
  const loaded=await loadProductionJobs();assert.equal(loaded.length,1201);assert(loaded.every(j=>j.planned_start==='2026-11-01'&&j.lifecycle_key?.startsWith('rework:')));
  assert.equal((await loadBids()).length,1201);
  assert.equal((await loadPlanningPhases()).length,1201);
  assert.equal((await loadPlanningPhases(jobs.map(j=>j.id))).length,1201);
  const before=calls.length;assert.deepEqual(await loadPlanningPhases([]),[]);assert.equal(calls.length,before);
  for(const name of ['jobs','production_rework_cycles','list_bids'])assert.equal(calls.filter(c=>c.pathname.endsWith('/'+name)).length,7);
  console.log('PASS real Bid/Job/active-Rework/phase query builders: 1,201 rows, lower server cap, scoped phase chunks, effective Rework dates, empty scope; zero network.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
