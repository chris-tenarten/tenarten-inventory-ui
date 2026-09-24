-- Disposable only. Runs after the view-access matrix, never hosted.
reset role;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000101'),('00000000-0000-4000-8000-000000000102'),('00000000-0000-4000-8000-000000000103');
insert into app_users(user_id,display_name,role,is_active) values
 ('00000000-0000-4000-8000-000000000101','Patrick Soldow','lead',true),
 ('00000000-0000-4000-8000-000000000102','Giovanni Coppola','lead',true),
 ('00000000-0000-4000-8000-000000000103','Anthony Iorio','lead',true);
insert into bids(customer,project_name,creator_user_id,owner_user_id) select 'Fictional curated demo','TEST — Curated reference '||i,'00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001' from generate_series(1,8) i;
insert into jobs(id,name) values('90000000-0000-4000-8000-000000000001','Protected real Job');
create temp table training_preserved_jobs as select id,to_jsonb(j) row from jobs j;
create temp table training_preserved as select id,to_jsonb(b) row from bids b;
create temp table training_counts as select (select count(*) from account_notifications) notifications,(select count(*) from inventory_items) inventory,(select count(*) from samples) samples,(select count(*) from proposals) proposals;
-- Compare actual normal-Job behavior before/after. Each successful probe rolls
-- back its own row mutation; capabilities are never inferred from role labels.
create function public.test_probe_job_operation(q text) returns text language plpgsql as $$begin
 begin execute q;raise exception using errcode='ZZ001';
 exception when sqlstate 'ZZ001' then return 'allowed';when others then return sqlstate;end;
end$$;
create table public.test_job_access_results(stage text,actor uuid,operation text,result text);
grant insert,select on public.test_job_access_results to authenticated;
create function public.test_measure_job_access(p_stage text) returns void language plpgsql as $$
declare uid uuid;q text;begin
 foreach uid in array array['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000005']::uuid[] loop
  execute 'set local role authenticated';perform set_config('request.jwt.claim.sub',uid::text,true);
  foreach q in array array[
   'select * from public.jobs where id=''90000000-0000-4000-8000-000000000001''',
   'insert into public.jobs(name) values(''TEST normal authorization probe'')',
   'update public.jobs set requested_delivery_date=''2026-10-20'' where id=''90000000-0000-4000-8000-000000000001''',
   'update public.jobs set remarks=''Routine'',priority=''high'',progress_percent=10 where id=''90000000-0000-4000-8000-000000000001''',
   'update public.jobs set name=''Ordinary edit'',customer=''Fictional'',contract_value=20,deposit_date=''2026-09-24'',estimated_man_hours=5 where id=''90000000-0000-4000-8000-000000000001''',
   'update public.jobs set planned_start=''2026-10-01'',planned_end=''2026-10-02'' where id=''90000000-0000-4000-8000-000000000001''',
   'update public.jobs set archived_at=now() where id=''90000000-0000-4000-8000-000000000001'''
  ] loop insert into public.test_job_access_results values(p_stage,uid,q,public.test_probe_job_operation(q));end loop;
  execute 'reset role';
 end loop;
end$$;
select public.test_measure_job_access('before');
create temp table training_jobs_policies as select * from pg_policies where schemaname='public' and tablename='jobs';
create temp table training_role_capabilities as select * from public.app_role_capabilities;
-- APPLY_TRAINING_MIGRATION
select public.test_measure_job_access('after');
do $$begin
 if exists(select 1 from public.test_job_access_results b full join public.test_job_access_results a on a.stage='after' and b.actor=a.actor and b.operation=a.operation where b.stage='before' and b.result is distinct from a.result) then raise exception 'Normal Job authorization changed';end if;
 if (select count(*) from public.test_job_access_results where result='allowed')<>70 then raise exception 'Unexpected baseline operation failure';end if;
 if exists((select * from training_jobs_policies except select * from pg_policies where schemaname='public' and tablename='jobs') union all (select * from pg_policies where schemaname='public' and tablename='jobs' except select * from training_jobs_policies)) then raise exception 'Existing Jobs policies changed';end if;
 if exists((select * from training_role_capabilities except select * from public.app_role_capabilities) union all (select * from public.app_role_capabilities except select * from training_role_capabilities)) then raise exception 'Existing role capabilities changed';end if;
end$$;
select 'PASS: 35 normal Job operations preserve identical before/after outcomes; Jobs policies and role capabilities unchanged';

create function public.test_expect_denied(q text,expected text default '42501') returns void language plpgsql as $$begin
 begin execute q;exception when others then if sqlstate=expected then return;end if;raise;end;
 raise exception 'Expected SQLSTATE %: %',expected,q;
end$$;
grant execute on function test_expect_denied(text,text) to authenticated,anon;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',false);
select test_expect_denied('delete from jobs where id=''90000000-0000-4000-8000-000000000001''');
select create_personal_test_bid() as pat_bid \gset
select test_expect_denied('select create_personal_test_bid()','23505');
select update_bid(:'pat_bid','Fictional customer','Renamed exercise','00000000-0000-4000-8000-000000000101','active',null,'','','','Training only');
select create_bid_update(:'pat_bid','Fictional discussion');
select set_bid_projected_window(:'pat_bid','2026-10-01','2026-10-05',(select updated_at from bids where id=:'pat_bid'));
select test_expect_denied(format('select convert_bid_to_production(%L,(select updated_at from bids where id=%L),%L)',:'pat_bid',:'pat_bid','carry'),'22023');
select test_expect_denied(format('select update_bid(%L,%L,%L,%L,%L,null,%L,%L,%L,%L)',:'pat_bid','TEST','Spoof owner','00000000-0000-4000-8000-000000000102','active','','','',''));
select test_expect_denied('select update_bid(''10000000-0000-4000-8000-000000000001'',''TEST'',''TEST spoof'',''00000000-0000-4000-8000-000000000101'',''won'',null,'''','''','''','''')');
select test_expect_denied('insert into intake_training_workflows(owner_user_id,bid_id) values(auth.uid(),''10000000-0000-4000-8000-000000000001'')');
select file_id,storage_path from begin_bid_file_upload(:'pat_bid','training.pdf','application/pdf',10) \gset
insert into storage.objects(bucket_id,name,metadata) values('bid-files',:'storage_path','{"size":10}');
select finalize_bid_file_upload(:'file_id');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',false);
select test_expect_denied(format('select create_bid_update(%L,%L)',:'pat_bid','Not mine'));
select test_expect_denied(format('select prepare_bid_file_removal(%L,%L)',:'pat_bid',:'file_id'));
select test_expect_denied(format('select reset_personal_test_workflow(%L,%L,%L)',:'pat_bid','bid','DELETE TEST'));
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000103',false);
select create_personal_test_bid() as anthony_bid \gset
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',false);
select update_bid(:'pat_bid','Fictional customer','TEST — Exercise','00000000-0000-4000-8000-000000000101','won','2026-09-24','','','','');
select convert_bid_to_production(:'pat_bid',(select updated_at from bids where id=:'pat_bid'),'carry') as pat_job \gset
select test_expect_denied(format('delete from jobs where id=%L',:'pat_job'));
select test_expect_denied(format('update jobs set job_number=%L where id=%L','REAL-123',:'pat_job'));
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',false);
select test_expect_denied(format('select reset_personal_test_workflow(%L,%L,%L)',:'pat_bid','job','DELETE TEST'));
-- Existing Production editing authority is independent of TEST cleanup authority.
update jobs set name='Production-authorized edit' where id=:'pat_job';
reset role;
do $$begin if not exists(select 1 from intake_training_workflows w join bids b on b.id=w.bid_id join jobs j on j.id=w.job_id where w.owner_user_id='00000000-0000-4000-8000-000000000101' and b.production_job_id=j.id and j.job_number ilike 'TEST-%' and j.planned_start='2026-10-01' and j.planned_end='2026-10-05') then raise exception 'Conversion lineage/date/number failed';end if;end$$;
-- Future CASCADE dependencies must also block cleanup, without destructive cascading.
create table public.test_training_dependency(job_id uuid references public.jobs(id) on delete cascade);
insert into test_training_dependency values(:'pat_job');
set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',false);
select test_expect_denied(format('select reset_personal_test_workflow(%L,%L,%L)',:'pat_bid','job','DELETE TEST'),'55000');
reset role;delete from test_training_dependency;set role authenticated;
select reset_personal_test_workflow(:'pat_bid','job','DELETE TEST');
select test_expect_denied(format('select reset_personal_test_workflow(%L,%L,%L)',:'pat_bid','bid','DELETE TEST'),'55000');
select prepare_bid_file_removal(:'pat_bid',:'file_id');delete from storage.objects where name=:'storage_path';select finalize_bid_file_removal(:'pat_bid',:'file_id');
select reset_personal_test_workflow(:'pat_bid','bid','DELETE TEST');
select create_personal_test_bid() as pat_again \gset
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select reset_personal_test_workflow(:'pat_again','bid','DELETE TEST');
select reset_personal_test_workflow(:'anthony_bid','bid','DELETE TEST');
-- Normal Production creation, routine editing and guarded Admin deletion still work.
insert into jobs(name) values('TEST normal Job regression') returning id as real_job \gset
update jobs set remarks='Routine',planned_start='2026-10-01',planned_end='2026-10-03' where id=:'real_job';
select test_expect_denied(format('select reset_personal_test_workflow(%L,%L,%L)','10000000-0000-4000-8000-000000000001','job','DELETE TEST'),'P0002');
select test_expect_denied(format('delete from jobs where id=%L',:'real_job'));
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',false);
update jobs set remarks='Member routine update' where id=:'real_job';
update jobs set contract_value=5,requested_delivery_date='2026-10-20' where id=:'real_job';
update jobs set planned_start='2026-10-02' where id=:'real_job';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
-- No new normal-Job INSERT restriction: preserve current hosted grants/RLS.
insert into jobs(name) values('TEST existing Developer direct insert') returning id as developer_job \gset
select test_expect_denied('select convert_bid_to_production(''10000000-0000-4000-8000-000000000001'',now(),''unscheduled'')');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select admin_permanently_delete_production_job(:'real_job','TEST normal Job regression');
select admin_permanently_delete_production_job(:'developer_job','TEST existing Developer direct insert');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);select test_expect_denied('select create_personal_test_bid()');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',false);
select test_expect_denied('select create_personal_test_bid()');
reset role;set role anon;select set_config('request.jwt.claim.sub','',false);
select test_expect_denied('select create_personal_test_bid()');select test_expect_denied('insert into jobs(name) values(''Unauthorized'')');select test_expect_denied('delete from jobs');select test_expect_denied('select * from jobs');
reset role;
do $$begin
 if exists(select 1 from training_preserved_jobs t full join jobs j on j.id=t.id where t.row is distinct from to_jsonb(j)) then raise exception 'Real Production Job changed';end if;
 if exists(select 1 from training_preserved t full join bids b on b.id=t.id where t.row is distinct from to_jsonb(b)) then raise exception 'Non-training/curated Bid changed';end if;
 if exists(select 1 from training_counts where notifications<>(select count(*) from account_notifications) or inventory<>(select count(*) from inventory_items) or samples<>(select count(*) from samples) or proposals<>(select count(*) from proposals)) then raise exception 'Unrelated side effects';end if;
 if exists(select 1 from intake_training_workflows) then raise exception 'Training residue';end if;
end$$;
select 'PASS personal TEST identity, lifecycle, ownership, files, conversion, safe cleanup, raw Job hardening, curated preservation';
