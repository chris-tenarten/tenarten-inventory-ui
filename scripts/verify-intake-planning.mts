import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { adjustProjectedWindow, projectedWindowEligible } from '../src/modules/pre-production/planning';
import { planningIntervalGeometry } from '../src/modules/planning/timeline-model.mjs';
import { intakePlanningDemo } from '../src/modules/pre-production/planning-demo';
import { intakeDemoSql } from './intake-planning-demo-sql.mjs';

assert.deepEqual(adjustProjectedWindow('2026-10-30','2026-11-04',3,'move'),{start:'2026-11-02',end:'2026-11-07'});
assert.deepEqual(adjustProjectedWindow('2026-10-30','2026-11-04',2,'start'),{start:'2026-11-01',end:'2026-11-04'});
assert.deepEqual(adjustProjectedWindow('2026-10-30','2026-11-04',-1,'end'),{start:'2026-10-30',end:'2026-11-03'});
assert.equal(adjustProjectedWindow('2026-10-30','2026-11-04',10,'start'),null);
assert.deepEqual(planningIntervalGeometry('2026-11-01','2026-11-03','2026-11-01',20),{left:3,width:54,right:57});
assert.equal(projectedWindowEligible('lost',undefined),false);
assert.equal(intakePlanningDemo.length,8);
assert.equal(new Set(intakePlanningDemo.map(row=>row.id)).size,8);
assert(intakePlanningDemo.every(row=>row.project_name.startsWith('TEST — ')&&row.customer.startsWith('TEST CUSTOMER — ')&&row.contact_email.endsWith('@example.invalid')));
assert.equal(intakePlanningDemo.filter(row=>!row.projected_production_start).length,1);
const read=(name:string)=>readFileSync(`supabase/migrations/${name}.sql`,'utf8');
const admin='00000000-0000-4000-8000-000000000001',member='00000000-0000-4000-8000-000000000002',guest='00000000-0000-4000-8000-000000000003',inactive='00000000-0000-4000-8000-000000000004';
const bid='10000000-0000-4000-8000-000000000001',bid2='10000000-0000-4000-8000-000000000002';
const setup=`create role anon nologin;create role authenticated nologin;create role service_role nologin;create schema auth;create schema storage;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon,service_role;
`;
const identity=read('20260818_001_rbac_identity_infrastructure').split('create or replace function public.get_my_app_user()')[0]+'commit;';
const seed=`insert into auth.users values('${admin}'),('${member}'),('${guest}'),('${inactive}');
insert into public.app_users(user_id,display_name,role,is_active) values('${admin}','TEST Admin','admin',true),('${member}','TEST Member','member',true),('${guest}','TEST Guest','guest',true),('${inactive}','TEST Inactive','admin',false);
insert into public.bids(id,customer,project_name,creator_user_id,owner_user_id,notes) values('${bid}','TEST CUSTOMER','TEST historical','${admin}','${admin}','unchanged historical notes'),('${bid2}','TEST CUSTOMER','TEST new dates','${admin}','${admin}','unchanged');
create table public.bid_file_relationships(bid_id uuid references public.bids(id),file_id uuid,relationship_state text);
create table public.canonical_files(id uuid,storage_path text);
`;
// Use the real cleanup entry point; unrelated module tables are not needed by its empty fixture.
const cleanupSource=read('20260901_004_admin_canonical_cleanup');
const cleanup=cleanupSource.slice(cleanupSource.indexOf('create function public.prepare_admin_delete_bid('),cleanupSource.indexOf('create function public.cancel_admin_delete_bid('))+`
create function public.production_job_delete_blockers(p_job_id uuid) returns jsonb language sql as $$select '[]'::jsonb$$;
create table public.test_baseline as select to_jsonb(b) as row from public.bids b;
`;
const accessSetup=`insert into public.app_role_capabilities(role,capability) values ('admin','accessIntake'),('developer','accessIntake'); create policy intake_early_access on public.bids as restrictive for select to authenticated using(public.has_app_capability('accessIntake'));`;
const migration=read('20260923220000_intake_projected_planning');
const tests=`
do $$begin if exists(select 1 from public.bids where projected_production_start is not null or production_job_id is not null) then raise exception 'Historical backfill';end if;
if exists(select 1 from public.bids b join public.test_baseline old on old.row->>'id'=b.id::text where (to_jsonb(b)-array['projected_production_start','projected_production_end','projected_window_updated_by','projected_window_updated_at','production_job_id','converted_by_user_id','converted_at'])<>old.row) then raise exception 'Historical fields changed';end if;end$$;
set role authenticated;select set_config('request.jwt.claim.sub','${inactive}',false);
do $$begin if (select count(*) from public.bids)<>0 then raise exception 'Inactive RLS leak';end if;
begin perform public.set_bid_projected_window('${bid}',null,null,now());raise exception 'Inactive write allowed';exception when insufficient_privilege then null;end;end$$;
select set_config('request.jwt.claim.sub','${guest}',false);
do $$begin if (select count(*) from public.bids)<>0 then raise exception 'Guest Intake visibility leak';end if;
begin perform public.convert_bid_to_production('${bid}',now(),'unscheduled');raise exception 'Guest conversion allowed';exception when insufficient_privilege then null;end;
begin update public.bids set projected_production_start='2026-11-01' where id='${bid}';raise exception 'Direct write allowed';exception when insufficient_privilege then null;end;end$$;
select set_config('request.jwt.claim.sub','${admin}',false);
select public.set_bid_projected_window('${bid}','2026-11-09','2026-11-27',(select updated_at from public.bids where id='${bid}'));
do $$begin
if not exists(select 1 from public.bids where id='${bid}' and projected_production_start='2026-11-09' and projected_window_updated_by='${admin}' and status='active' and deposit_received_date is null and notes='unchanged historical notes') then raise exception 'Window persistence or isolation failed';end if;
begin perform public.set_bid_projected_window('${bid}',null,'2026-11-27',(select updated_at from public.bids where id='${bid}'));raise exception 'Half window allowed';exception when invalid_parameter_value then null;end;
begin perform public.set_bid_projected_window('${bid}','2026-12-01','2026-11-27',(select updated_at from public.bids where id='${bid}'));raise exception 'Reversed window allowed';exception when invalid_parameter_value then null;end;
begin perform public.set_bid_projected_window('${bid}',null,null,'2000-01-01');raise exception 'Stale edit allowed';exception when serialization_failure then null;end;
begin perform public.convert_bid_to_production('${bid}',(select updated_at from public.bids where id='${bid}'),'carry');raise exception 'Active Bid converted';exception when invalid_parameter_value then null;end;
end$$;
select public.set_bid_projected_window('${bid}',null,null,(select updated_at from public.bids where id='${bid}'));
select public.set_bid_projected_window('${bid}','2026-11-09','2026-11-27',(select updated_at from public.bids where id='${bid}'));
reset role;update public.bids set status='won' where id='${bid}';
set role authenticated;
do $$begin begin perform public.convert_bid_to_production('${bid}',(select updated_at from public.bids where id='${bid}'),'carry');raise exception 'No deposit gate';exception when invalid_parameter_value then null;end;end$$;
reset role;update public.bids set deposit_received_date='2026-09-22' where id='${bid}';
set role authenticated;
select set_config('request.jwt.claim.sub','${member}',false);
do $$begin begin perform public.convert_bid_to_production('${bid}',now(),'carry');raise exception 'Member accessed Intake';exception when insufficient_privilege then null;end;end$$;
select set_config('request.jwt.claim.sub','${admin}',false);
select public.convert_bid_to_production('${bid}',(select updated_at from public.bids where id='${bid}'),'carry');
select public.convert_bid_to_production('${bid}','2000-01-01','carry');
do $$begin begin perform public.set_bid_projected_window('${bid}','2026-12-01','2026-12-05',(select updated_at from public.bids where id='${bid}'));raise exception 'Converted projection editable';exception when invalid_parameter_value then null;end;
begin perform public.prepare_admin_delete_bid('${bid}');raise exception 'Converted source cleanup allowed';exception when foreign_key_violation then null;end;end$$;
reset role;
do $$declare j public.jobs%rowtype;begin
select * into strict j from public.jobs where id=(select production_job_id from public.bids where id='${bid}');
if (select count(*) from public.jobs)<>1 or j.planned_start<>'2026-11-09' or j.planned_end<>'2026-11-27' or j.job_number is not null or j.deposit_date<>'2026-09-22' then raise exception 'Carry-forward / idempotency failed';end if;
if not (public.production_job_delete_blockers(j.id) @> '["Source Intake Bid exists"]'::jsonb) then raise exception 'Linked Job cleanup not blocked';end if;
if (select count(*) from public.bid_activity where bid_id='${bid}' and activity_type='converted_to_job')<>1 then raise exception 'Duplicate conversion history';end if;
begin delete from public.bids where id='${bid}';raise exception 'Converted source deleted';exception when foreign_key_violation then null;end;
end$$;
update public.bids set status='won',deposit_received_date='2026-09-22' where id='${bid2}';
set role authenticated;select public.convert_bid_to_production('${bid2}',(select updated_at from public.bids where id='${bid2}'),'new','2026-12-01','2026-12-11','TEST-LOCAL-ONLY');reset role;
do $$begin if not exists(select 1 from public.jobs where job_number='TEST-LOCAL-ONLY' and planned_start='2026-12-01' and planned_end='2026-12-11') then raise exception 'New dates not applied';end if;
if has_function_privilege('authenticated','public.intake_base_prepare_admin_delete_bid(uuid)','execute') or has_function_privilege('anon','public.convert_bid_to_production(uuid,timestamptz,text,date,date,text)','execute') then raise exception 'Internal/anonymous privilege leak';end if;
end$$;
`;
const demoTests=`do $$begin if (select count(*) from public.bids where id::text like 'de000000-%')<>8 or (select count(*) from public.bid_activity where details->>'demonstration'='TENOPS-INTAKE-PLANNING-DEMO-2026-09')<>8 then raise exception 'Demo is not idempotent';end if;if (select count(*) from public.jobs)<>2 then raise exception 'Demo created Jobs';end if;end$$;`;
const afterCleanup=`do $$begin if exists(select 1 from public.bids where id::text like 'de000000-%') or exists(select 1 from public.bid_activity where details->>'demonstration'='TENOPS-INTAKE-PLANNING-DEMO-2026-09') then raise exception 'Demo residue';end if;end$$;`;
const name=`tenops-intake-planning-${process.pid}`;
function run(args:string[],input?:string){const r=spawnSync('docker',args,{input,encoding:'utf8'});if(r.status!==0)throw new Error(`${r.stdout}\n${r.stderr}`);return r.stdout;}
try {
 run(['run','--rm','-d','--name',name,'-e','POSTGRES_PASSWORD=local-only','postgres:17.6']);
 for(let i=0;i<40;i++){if(spawnSync('docker',['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']).status===0)break;if(i===39)throw new Error('Postgres readiness timed out');await new Promise(resolve=>setTimeout(resolve,250));}
 const sql=setup+identity+read('20260713_002_production_mvp_jobs')+read('20260716_002_atomic_production_schedule_batch')+read('20260827_009_job_number_uniqueness')+read('20260901_001_preproduction_bids')+read('20260901_002_bid_operational_context')+seed+cleanup+accessSetup+migration+tests+intakeDemoSql(admin)+intakeDemoSql(admin)+demoTests+intakeDemoSql(admin,true)+intakeDemoSql(admin,true)+afterCleanup;
 run(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1'],sql);
 const raceBid='10000000-0000-4000-8000-000000000003';
 const sqlArgs=['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-At'];
 const stamp=run(sqlArgs,`insert into public.bids(id,customer,project_name,creator_user_id,owner_user_id,status,deposit_received_date) values('${raceBid}','TEST CUSTOMER','TEST concurrent conversion','${member}','${member}','won','2026-09-22');select updated_at from public.bids where id='${raceBid}';`).trim().split('\n').at(-1)!;
 const convert=`begin;set role authenticated;select set_config('request.jwt.claim.sub','${admin}',true);select public.convert_bid_to_production('${raceBid}','${stamp}','unscheduled');select pg_sleep(0.2);commit;`;
 async function session(sql:string){return new Promise<string>((resolve,reject)=>{const child=spawn('docker',sqlArgs);let output='',error='';child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{error+=chunk;});child.on('error',reject);child.on('close',code=>code===0?resolve(output):reject(new Error(error)));child.stdin.end(sql);});}
 const [first,second]=await Promise.all([session(convert),session(convert)]);
 const jobIds=(text:string)=>text.split('\n').filter(line=>/^[0-9a-f-]{36}$/.test(line)&&line!==admin);
 assert.deepEqual(jobIds(first),jobIds(second));assert.equal(jobIds(first).length,1);
 run(sqlArgs,`do $$begin if (select count(*) from public.jobs)<>3 or (select count(*) from public.bid_activity where bid_id='${raceBid}' and activity_type='converted_to_job')<>1 then raise exception 'Concurrent conversion duplicated work';end if;end$$;`);
 // Duplicate Job identity must roll back every part of the conversion transaction.
 const conflictBid='10000000-0000-4000-8000-000000000004';
 run(sqlArgs,`insert into public.bids(id,customer,project_name,creator_user_id,owner_user_id,status,deposit_received_date) values('${conflictBid}','TEST CUSTOMER','TEST failed conversion','${admin}','${admin}','won','2026-09-22');
 set role authenticated;select set_config('request.jwt.claim.sub','${admin}',false);
 do $$begin begin perform public.convert_bid_to_production('${conflictBid}',(select updated_at from public.bids where id='${conflictBid}'),'new','2026-11-01','2026-11-10','TEST-LOCAL-ONLY');raise exception 'Duplicate Job number allowed';exception when unique_violation then null;end;end$$;reset role;
 do $$begin if (select count(*) from public.jobs)<>3 or exists(select 1 from public.bids where id='${conflictBid}' and production_job_id is not null) or exists(select 1 from public.bid_activity where bid_id='${conflictBid}') then raise exception 'Failed conversion leaked changes';end if;end$$;`);
 console.log('Intake planning: date geometry, additive migration, preserved historical fields, RLS/roles, constraints, stale edits, guarded carry/new-date conversion, replay/concurrent conversion, rollback, source cleanup protection, demo idempotency and zero residue passed.');
} finally {spawnSync('docker',['stop',name],{stdio:'ignore'});}
