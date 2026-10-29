// Local-only Job-tool fixture and strict Supabase-shaped SQL bridge. Never hosted.
// Reuses the existing TenBot review container without resetting feedback/history/usage.
import {readFileSync} from 'node:fs';
import {literal} from './intake-materials-database.mjs';
import {sql} from './tenbot-fixture-health.mjs';

export const TENBOT_JOB_DATABASE='tenops-tenbot-review';
const uuid=n=>`10282026-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const jobFixture={
 now:'2026-10-28T18:00:00.000Z',
 actor:uuid(1),inactive:uuid(2),readOnly:uuid(3),
 main:uuid(101),ambiguousA:uuid(102),ambiguousB:uuid(103),unknown:uuid(104),
 terminal:uuid(105),archived:uuid(106),hidden:uuid(107),
 devTest:'cba79566-3fde-4910-9cf6-45687db70b01',
 completedRework:uuid(201),activeRework:uuid(202),worker:uuid(301),task:uuid(302),
 financialSentinel:'SYNTHETIC-FINANCIAL-NEVER-RETRIEVE',
 notesSentinel:'SYNTHETIC-NOTES-NEVER-RETRIEVE',
};
const readMigration=name=>readFileSync('supabase/migrations/'+name,'utf8');
const exists=(container,table)=>Boolean(sql(container,`select to_regclass(${literal('public.'+table)})`));
export function protectedTenbotState(container=TENBOT_JOB_DATABASE){
 return sql(container,"select jsonb_build_object('feedback',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from tenbot_feedback t),'history',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from tenbot_feedback_history t),'usage',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from tenbot_usage t),'conversations',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from tenbot_conversations t),'turns',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from tenbot_conversation_turns t))");
}

export function prepareTenbotJobFixture(container=TENBOT_JOB_DATABASE){
 if(container!==TENBOT_JOB_DATABASE)throw Error('Use the established disposable TenBot review database.');
 if(!exists(container,'tenbot_conversations'))throw Error('Existing initialized TenBot database required; do not reset it.');
 const preserved=protectedTenbotState(container),applied=[];
 const apply=name=>{sql(container,readMigration(name));applied.push(name);};
 if(!exists(container,'production_rework_cycles'))apply('20260817_003_production_rework_cycles.sql');
 if(!exists(container,'manpower_entries')){
  apply('20260714_001_manpower_reporting_mvp.sql');
  apply('20260714_002_manpower_reporting_groups_and_import_correction.sql');
  apply('20260824_002_manpower_rework_attribution.sql');
  // Only the canonical Manpower compatibility section; no unrelated policies.
  const source=readMigration('20260818_003_rbac_compatibility_authenticated_access.sql');
  sql(container,'begin;'+source.slice(source.indexOf('-- Manpower reporting')));
 }
 if(!exists(container,'job_updates'))apply('20260727_001_production_job_updates.sql');
 // Match the existing released ordered-material enum if this fixture predates it.
 if(!sql(container,"select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.jobs'::regclass and conname='jobs_material_status_check'").includes('ordered'))apply('20260716_001_add_ordered_material_status.sql');
 const f=jobFixture;
 sql(container,`begin;
 insert into app_users(user_id,display_name,role,is_active,read_only) values
 (${literal(f.actor)},'Synthetic Job-tools Member','member',true,false),
 (${literal(f.inactive)},'Synthetic Job-tools Inactive','member',false,false),
 (${literal(f.readOnly)},'Synthetic Job-tools Read-only','guest',true,true)
 on conflict(user_id) do nothing;
 insert into jobs(id,name,customer,job_number,production_status,material_status,planned_start,planned_end,requested_delivery_date,estimated_man_hours,archived_at,contract_value,remarks,updated_at) values
 (${literal(f.main)},'TenBot Review North Countertops','Synthetic Studio','TB-2801','in_production','ordered','2026-10-28','2026-11-04','2026-11-06',40,null,987654.32,${literal(f.financialSentinel+' '+f.notesSentinel)},'2026-10-28T17:00:00Z'),
 (${literal(f.ambiguousA)},'TenBot Review Shared Name','Synthetic North','TB-2802','on_deck','ready','2026-10-29','2026-11-03','2026-11-05',20,null,10,${literal(f.notesSentinel)},'2026-10-28T17:00:00Z'),
 (${literal(f.ambiguousB)},'TenBot Review Shared Name','Synthetic South','TB-2803','on_hold','not_ready',null,null,null,null,null,10,${literal(f.notesSentinel)},'2026-10-28T17:00:00Z'),
 (${literal(f.unknown)},'TenBot Review Unknowns',null,null,'not_started','unknown',null,null,null,null,null,10,${literal(f.notesSentinel)},'2026-10-28T17:00:00Z'),
 (${literal(f.terminal)},'TenBot Review Completed With Rework','Synthetic Studio','TB-2805','complete','ready','2026-10-01','2026-10-07','2026-10-09',30,null,10,${literal(f.notesSentinel)},'2026-10-28T17:00:00Z'),
 (${literal(f.archived)},'TenBot Review Archived','Synthetic Archive','TB-2806','shipped','ready','2026-09-01','2026-09-07','2026-09-09',30,'2026-10-01T12:00:00Z',10,${literal(f.notesSentinel)},'2026-10-28T17:00:00Z'),
 (${literal(f.hidden)},'TenBot Review Hidden By RLS','Synthetic Hidden','TB-2807','not_started','unknown',null,null,null,null,null,10,${literal(f.notesSentinel)},'2026-10-28T17:00:00Z'),
 (${literal(f.devTest)},'TenBot dev-test fixture','Synthetic Fixture','DEV-TEST','not_started','unknown',null,null,null,null,null,10,${literal(f.notesSentinel)},'2026-10-28T17:00:00Z')
 on conflict(id) do nothing;
 insert into production_rework_cycles(id,job_id,sequence_number,reason_category,scope_details,intake_date,planned_start,planned_end,production_status,completed_at,updated_at) values
 (${literal(f.completedRework)},${literal(f.terminal)},1,'other',${literal(f.notesSentinel)},'2026-10-10','2026-10-11','2026-10-12','complete','2026-10-12T17:00:00Z','2026-10-12T17:00:00Z'),
 (${literal(f.activeRework)},${literal(f.terminal)},2,'quality_qc',${literal(f.notesSentinel)},'2026-10-27','2026-10-29','2026-11-02','in_production',null,'2026-10-28T17:00:00Z')
 on conflict(id) do nothing;
 insert into manpower_workers(id,display_name,sort_order) values(${literal(f.worker)},'SYNTHETIC-WORKER-NEVER-RETRIEVE',9000) on conflict(id) do nothing;
 insert into manpower_tasks(id,display_name,sort_order) values(${literal(f.task)},'Synthetic Job-tools Task',9000) on conflict(id) do nothing;
 insert into manpower_entries(id,job_id,rework_cycle_id,work_date,worker_id,task_id,am_hours,pm_hours,notes,updated_at) values
 (${literal(uuid(401))},${literal(f.main)},null,'2026-09-28',${literal(f.worker)},${literal(f.task)},10,10,${literal(f.notesSentinel)},'2026-10-28T17:00:00Z'),
 (${literal(uuid(402))},${literal(f.main)},null,'2026-09-29',${literal(f.worker)},${literal(f.task)},1.25,2.75,${literal(f.notesSentinel)},'2026-10-28T17:00:00Z'),
 (${literal(uuid(403))},${literal(f.main)},null,'2026-10-15',${literal(f.worker)},${literal(f.task)},0.10,0.20,${literal(f.notesSentinel)},'2026-10-28T17:00:00Z'),
 (${literal(uuid(404))},${literal(f.main)},null,'2026-10-28',${literal(f.worker)},${literal(f.task)},3,1,${literal(f.notesSentinel)},'2026-10-28T17:00:00Z'),
 (${literal(uuid(405))},${literal(f.main)},null,'2026-10-29',${literal(f.worker)},${literal(f.task)},9,9,${literal(f.notesSentinel)},'2026-10-28T17:00:00Z'),
 (${literal(uuid(406))},${literal(f.ambiguousA)},null,'2026-10-28',${literal(f.worker)},${literal(f.task)},7,7,${literal(f.notesSentinel)},'2026-10-28T17:00:00Z'),
 (${literal(uuid(407))},${literal(f.terminal)},null,'2026-10-28',${literal(f.worker)},${literal(f.task)},1,1,${literal(f.notesSentinel)},'2026-10-28T17:00:00Z'),
 (${literal(uuid(408))},${literal(f.terminal)},${literal(f.completedRework)},'2026-10-12',${literal(f.worker)},${literal(f.task)},1.5,0.5,${literal(f.notesSentinel)},'2026-10-28T17:00:00Z'),
 (${literal(uuid(409))},${literal(f.terminal)},${literal(f.activeRework)},'2026-10-28',${literal(f.worker)},${literal(f.task)},0.75,0.25,${literal(f.notesSentinel)},'2026-10-28T17:00:00Z')
 on conflict(id) do nothing;
 insert into manpower_entries(id,job_id,unlisted_work_label,work_date,worker_id,task_id,am_hours,pm_hours,notes) values(${literal(uuid(410))},null,'TenBot Review North Countertops','2026-10-28',${literal(f.worker)},${literal(f.task)},8,8,${literal(f.notesSentinel)}) on conflict(id) do nothing;
 insert into job_updates(id,job_id,author_name,body,requires_follow_up,resolved_at,resolved_by_name) values
 (${literal(uuid(501))},${literal(f.main)},'SYNTHETIC-AUTHOR-NEVER-RETRIEVE',${literal(f.notesSentinel)},true,null,null),
 (${literal(uuid(502))},${literal(f.main)},'SYNTHETIC-AUTHOR-NEVER-RETRIEVE',${literal(f.notesSentinel)},true,'2026-10-27T12:00:00Z','Synthetic Resolver'),
 (${literal(uuid(503))},${literal(f.main)},'SYNTHETIC-AUTHOR-NEVER-RETRIEVE',${literal(f.notesSentinel)},false,null,null)
 on conflict(id) do nothing;
 -- Restrictive fixture policy proves caller RLS survives the adapter. It applies
 -- only to this task actor/Job pair and grants no new visibility to anyone.
 do $$ begin if not exists(select 1 from pg_policy where polrelid='public.jobs'::regclass and polname='tenbot_job_fixture_hidden') then
 create policy tenbot_job_fixture_hidden on jobs as restrictive for select to authenticated using(auth.uid()<>${literal(f.actor)}::uuid or id<>${literal(f.hidden)}::uuid);end if;end $$;
 commit;`);
 if(protectedTenbotState(container)!==preserved)throw Error('Existing TenBot records changed during Job fixture preparation.');
 return {container,applied,fixture:jobFixture,preservedTenbotRecords:true};
}

// Fixed table/column/operator allowlist: this adapter is not a SQL endpoint.
// All selections execute SET LOCAL ROLE authenticated with the supplied fixture
// actor and current capability/RLS checks. No model/caller SQL is accepted.
const allowed={
 jobs:new Set('id,name,customer,job_number,production_status,material_status,requested_delivery_date,planned_start,planned_end,estimated_man_hours,archived_at,updated_at'.split(',')),
 production_rework_cycles:new Set('id,job_id,sequence_number,production_status,planned_start,planned_end,updated_at'.split(',')),
 manpower_entries:new Set('id,job_id,rework_cycle_id,work_date,am_hours,pm_hours,updated_at'.split(',')),
 job_updates:new Set('id,job_id,requires_follow_up,resolved_at'.split(',')),
};
function splitOr(value){
 const chunks=[];let start=0,quoted=false;
 for(let i=0;i<value.length;i++){if(value[i]==='"'&&value[i-1]!=='\\')quoted=!quoted;if(value[i]===','&&!quoted){chunks.push(value.slice(start,i));start=i+1;}}
 if(quoted)throw Error('Invalid local filter');chunks.push(value.slice(start));return chunks;
}
/**
 * @param {string} [container]
 * @param {string} [actor]
 * @param {{trace?: Array<Record<string,unknown>>,failTable?: string|null}} [options]
 * @returns {{from:(table:string)=>import('../../supabase/functions/_shared/tenbot-job-tools.ts').JobToolQuery,rpc:import('../../supabase/functions/_shared/tenbot-job-tools.ts').JobToolCaller['rpc']}}
 */
export function createTenbotJobCaller(container=TENBOT_JOB_DATABASE,actor=jobFixture.actor,options={}){
 const {trace=[],failTable=null}=options;
 if(container!==TENBOT_JOB_DATABASE||!/^[0-9a-f-]{36}$/i.test(actor))throw Error('Invalid local Job-tool caller');
 const run=statement=>sql(container,`begin;set local role authenticated;set local request.jwt.claim.sub=${literal(actor)};set local statement_timeout='3s';${statement};commit;`);
 const caller={
  async rpc(name,args={}){
   trace.push({kind:'rpc',name,role:'authenticated',actor});
   if(name!=='has_app_capability'||!['readOperationalData','manageUsers'].includes(args.p_capability))return {data:null,error:{message:'Unsupported local RPC'}};
   try{return {data:run('select public.has_app_capability('+literal(args.p_capability)+')')==='t',error:null};}catch{return {data:null,error:{message:'Local authorization unavailable'}};}
  },
  from(table){
   if(!Object.hasOwn(allowed,table))throw Error('Table is outside the Job-tool allowlist');
   const state={columns:[],filters:[],orders:[],count:false,head:false,start:0,size:501,single:false};
   const col=name=>{if(!allowed[table].has(name))throw Error('Column is outside the Job-tool allowlist');return '"'+name+'"';};
   const value=v=>v===null?'null':typeof v==='boolean'?String(v):typeof v==='number'&&Number.isFinite(v)?String(v):literal(v);
   const comparison=(column,operator,v)=>{const name=col(column);if(!['eq','neq','gte','lte','gt','lt','ilike','is','in'].includes(operator))throw Error('Unsupported local operator');if(operator==='is'){if(v!==null&&v!==true&&v!==false)throw Error('Invalid local IS filter');return name+' is '+value(v);}if(operator==='in'){if(typeof v!=='string'||!/^\([a-z_]+(?:,[a-z_]+)*\)$/.test(v))throw Error('Invalid local IN filter');return name+' in ('+v.slice(1,-1).split(',').map(value).join(',')+')';}return name+' '+({eq:'=',neq:'<>',gte:'>=',lte:'<=',gt:'>',lt:'<',ilike:'ilike'}[operator])+' '+value(v);};
   const q={
    select(columns,options={}){state.columns=String(columns).split(',').map(s=>s.trim());state.columns.forEach(col);state.count=options.count==='exact';state.head=options.head===true;return q;},
    eq(column,v){state.filters.push(comparison(column,'eq',v));return q;},
    neq(column,v){state.filters.push(comparison(column,'neq',v));return q;},
    is(column,v){state.filters.push(comparison(column,'is',v));return q;},
    not(column,operator,v){state.filters.push('not ('+comparison(column,operator,v)+')');return q;},
    in(column,values){if(!Array.isArray(values)||values.length>200)throw Error('Invalid local IN filter');state.filters.push(values.length?col(column)+' in ('+values.map(value).join(',')+')':'false');return q;},
    gte(column,v){state.filters.push(comparison(column,'gte',v));return q;},
    lte(column,v){state.filters.push(comparison(column,'lte',v));return q;},
    gt(column,v){state.filters.push(comparison(column,'gt',v));return q;},
    lt(column,v){state.filters.push(comparison(column,'lt',v));return q;},
    or(filter){if(typeof filter!=='string'||filter.length>2000)throw Error('Invalid local OR filter');const expressions=splitOr(filter).map(part=>{const match=/^([a-z_]+)\.(eq|neq|gt|lt|ilike|is)\.(.*)$/.exec(part);if(!match)throw Error('Unsupported local OR filter');let v=match[3];if(v.startsWith('"'))v=JSON.parse(v);if(match[2]==='is'&&v==='null')v=null;return comparison(match[1],match[2],v);});state.filters.push('('+expressions.join(' or ')+')');return q;},
    order(column,options={}){state.orders.push(col(column)+(options.ascending===false?' desc':' asc')+(options.nullsFirst===false?' nulls last':options.nullsFirst===true?' nulls first':''));return q;},
    range(from,to){if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<from||to-from>1000)throw Error('Invalid bounded local range');state.start=from;state.size=to-from+1;return q;},
    limit(size){if(!Number.isInteger(size)||size<0||size>1001)throw Error('Invalid bounded local limit');state.size=size;return q;},
    maybeSingle(){state.single=true;state.size=2;return q;},
    abortSignal(){return q;},
    then(resolve,reject){return Promise.resolve().then(()=>{
     trace.push({kind:'query',table,columns:[...state.columns],filters:[...state.filters],role:'authenticated',actor,limit:state.size,head:state.head});
     if(table===failTable)return {data:null,error:{message:'Synthetic local tool outage'},count:null};
     try{
      if(!state.columns.length)throw Error('Explicit local projection required');
      const where=state.filters.length?' where '+state.filters.join(' and '):'';
      const order=state.orders.length?' order by '+state.orders.join(','):'';
      const projection=state.columns.map(col).join(',');
      const page=`select ${projection} from public.${table}${where}${order} limit ${state.size} offset ${state.start}`;
      const query=`select jsonb_build_object('data',${state.head?"'null'::jsonb":`(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (${page}) r)`},'count',${state.count?`(select count(*) from public.${table}${where})`:'null'})`;
      const result=JSON.parse(run(query));
      if(state.single){if(result.data.length>1)return {data:null,error:{message:'Multiple local rows'},count:result.count};result.data=result.data[0]??null;}
      return {...result,error:null};
     }catch{return {data:null,error:{message:'Local query unavailable'},count:null};}
    }).then(resolve,reject);},
   };return q;
  },
 };
 return caller;
}
