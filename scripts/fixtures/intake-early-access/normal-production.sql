-- Disposable compatibility probes. Every operation rolls back its own mutation.
insert into jobs(id,name) values('90000000-0000-4000-8000-000000000001','Protected ordinary Job');
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
