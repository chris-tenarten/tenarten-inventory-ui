import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const migration=readFileSync('supabase/migrations/20260902_004_my_work_task_groups.sql','utf8');
const page=readFileSync('src/modules/my-work/MyWorkPage.tsx','utf8');
const name=`tenops-task-groups-${process.pid}`,image='public.ecr.aws/supabase/postgres:17.6.1.084';
const alice='00000000-0000-0000-0000-000000000001',bob='00000000-0000-0000-0000-000000000002',outsider='00000000-0000-0000-0000-000000000003',task='10000000-0000-0000-0000-000000000001';
assert.doesNotMatch(migration,/update public\.work_task_preferences|update public\.work_tasks set.*color/is);
assert.match(page,/const effectiveColor=\(task:WorkTask\)=>task\.groupColor\?\?task\.color/);
assert.match(page,/Change \{task\.groupId\?'Group':'Task'\} color/);
const setup=String.raw`
do $$begin if not exists(select 1 from pg_roles where rolname='authenticated')then create role authenticated nologin;end if;end$$;create schema if not exists auth;
do $$begin if to_regprocedure('auth.uid()') is null then execute $fn$create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid'$fn$;end if;end$$;
create table public.app_users(user_id uuid primary key,is_active boolean);create table public.jobs(id uuid primary key);create table public.work_tasks(id uuid primary key,creator_user_id uuid,assignee_user_id uuid,context_type text,context_id uuid);create table public.work_task_preferences(task_id uuid,user_id uuid,color_key text,primary key(task_id,user_id));
insert into public.app_users values('${alice}',true),('${bob}',true),('${outsider}',true);insert into public.jobs values('20000000-0000-0000-0000-000000000001');insert into public.work_tasks values('${task}','${alice}','${bob}','job','20000000-0000-0000-0000-000000000001');insert into public.work_task_preferences values('${task}','${alice}','rose'),('${task}','${bob}','teal');
`;
const tests=String.raw`
select set_config('request.jwt.claim.sub','${alice}',false);select public.create_my_work_task_group('Alice Group','blue') as alice_group \gset
select public.set_my_work_task_group('${task}',:'alice_group');
select set_config('request.jwt.claim.sub','${bob}',false);select public.create_my_work_task_group('Bob Group','green') as bob_group \gset
select public.set_my_work_task_group('${task}',:'bob_group');
do $$begin if(select count(*) from public.list_my_work_task_groups())<>1 or not exists(select 1 from public.list_my_work_task_groups() where name='Bob Group')then raise exception 'Another user group leaked';end if;if not exists(select 1 from public.list_my_work_task_group_memberships() membership join public.my_work_task_groups group_row on group_row.id=membership.group_id where membership.task_id='${task}' and group_row.name='Bob Group')then raise exception 'Bob membership missing';end if;end$$;
select set_config('request.jwt.claim.sub','${alice}',false);
do $$begin if(select count(*) from public.list_my_work_task_groups())<>1 or not exists(select 1 from public.list_my_work_task_groups() where name='Alice Group')then raise exception 'Alice personal groups incorrect';end if;if not exists(select 1 from public.list_my_work_task_group_memberships() membership join public.my_work_task_groups group_row on group_row.id=membership.group_id where membership.task_id='${task}' and group_row.name='Alice Group')then raise exception 'Alice membership changed by Bob';end if;end$$;
select public.update_my_work_task_group(:'alice_group','Renamed','violet');
do $$begin if not exists(select 1 from public.list_my_work_task_groups() where color_key='violet')then raise exception 'Group color update failed';end if;if(select color_key from public.work_task_preferences where task_id='${task}' and user_id='${alice}')<>'rose' then raise exception 'Stored Task color changed';end if;end$$;
select set_config('request.jwt.claim.sub','${outsider}',false);do $$begin begin perform public.set_my_work_task_group('${task}',null);raise exception 'Nonparticipant organized private task';exception when insufficient_privilege then null;end;end$$;
select set_config('request.jwt.claim.sub','${alice}',false);select public.delete_my_work_task_group(:'alice_group');
do $$begin if not exists(select 1 from public.work_tasks where id='${task}' and context_type='job' and context_id='20000000-0000-0000-0000-000000000001')then raise exception 'Task or Job context changed';end if;if not exists(select 1 from public.work_task_preferences where task_id='${task}' and user_id='${alice}' and color_key='rose')then raise exception 'Ungroup did not preserve Task color';end if;if exists(select 1 from public.my_work_task_group_memberships where task_id='${task}' and user_id='${alice}')then raise exception 'Deleted Group membership survived';end if;if not exists(select 1 from public.my_work_task_group_memberships where task_id='${task}' and user_id='${bob}')then raise exception 'Other participant organization changed';end if;end$$;
`;
function run(args,input){const result=spawnSync('docker',args,{input,encoding:'utf8'});if(result.status!==0)throw new Error(`${result.stdout}\n${result.stderr}`);return result.stdout;}
try{run(['run','--rm','-d','--name',name,'-e','POSTGRES_PASSWORD=postgres',image]);for(let i=0;i<40;i++){if(spawnSync('docker',['exec',name,'pg_isready','-U','postgres']).status===0)break;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250);if(i===39)throw new Error('Disposable PostgreSQL did not become ready.');}run(['exec','-e','PGPASSWORD=postgres','-i',name,'psql','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],setup+migration+tests);console.log('My Work Task Group privacy/lifecycle checks passed.');}finally{spawnSync('docker',['stop',name]);}
