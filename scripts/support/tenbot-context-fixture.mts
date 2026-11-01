/** Synthetic RPC/PostgREST fixture; runs actual hosted history and Job tools.
 * No external services, secrets, live inference or database security proof. */
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {createHostedTenbotFixture} from './tenbot-hosted-fixture.mjs';
import {wave2Tables,wave2Response,uuid} from './wave2-fixture.mjs';
import {createTenbotJobTools,type JobToolCaller} from '../../supabase/functions/_shared/tenbot-job-tools';
export function createContextFixture(owner?:string){
 const f=createHostedTenbotFixture(owner),tables=wave2Tables(1) as Omit<ReturnType<typeof wave2Tables>,'jobs'|'manpower_entries'>&{jobs:(Omit<ReturnType<typeof wave2Tables>['jobs'][number],'planned_start'|'planned_end'>&{planned_start:string|null;planned_end:string|null;requested_delivery_date?:string|null})[];manpower_entries:Record<string,unknown>[]},hidden=new Set<string>(),trace:{table:string;path:string}[]=[];
 f.state.now=Date.parse('2026-10-31T18:00:00Z');
 tables.jobs=tables.jobs.slice(0,10).map((j,i)=>({...j,name:i===0?'Context Alpha':`Context Job ${i+1}`,job_number:`CTX-${i+1}`,archived_at:null,production_status:i<8?'in_production':'complete',requested_delivery_date:null,planned_start:'2026-10-01',planned_end:'2026-11-15',updated_at:'2026-10-31T12:00:00Z'}));
 tables.production_rework_cycles=[];tables.job_updates=[];tables.manpower_entries=[{id:uuid(1000001),job_id:tables.jobs[0].id,rework_cycle_id:null,work_date:'2026-10-30',am_hours:3,pm_hours:2,updated_at:'2026-10-31T12:00:00Z'}];
 const client=createClient('https://context.fixture.invalid','synthetic-public-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{
  const url=new URL(String(input)),table=url.pathname.split('/').at(-1)!;trace.push({table,path:url.pathname});
  if(url.pathname.includes('/rpc/')){const args=JSON.parse(String(init?.body??'{}'));return Response.json(f.state.allowed&&(!url.pathname.endsWith('tenbot_authorize_history_jobs')||(args.p_ids??[]).every((id:string)=>!hidden.has(id))));}
  assert(['jobs','production_rework_cycles','job_updates','manpower_entries'].includes(table),'Unexpected operational capability');
  const filtered={...tables,jobs:tables.jobs.filter((j:{id:string})=>!hidden.has(j.id))};const r=wave2Response(url,filtered,200);return Response.json(r.rows,{headers:r.headers});
 }} });
 f.state.jobTools=createTenbotJobTools(client as unknown as JobToolCaller,{now:()=>new Date(f.state.now)});
 const run=()=>f.handler('https://tendev.pages.dev',{spendingAuthorized:false,persistentHistory:false});
 const ask=(question:string,id?:string)=>run()({action:'ask',question,...(id?{conversationId:id}:{})}) as Promise<Record<string,unknown>>;
 const row=(id:string)=>f.rows.get(id)!;
 return {...f,tables,hidden,trace,run,ask,row};
}
