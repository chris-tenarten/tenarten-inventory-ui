-- Entirely fictional local fixtures. Never run hosted.
insert into auth.users(id) select ('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,5)i;
insert into app_users(user_id,display_name,role,is_active)
select ('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'LOCAL fixture '||role,role,true
from unnest(array['guest','member','lead','developer','admin']) with ordinality r(role,i);
insert into manpower_workers(id,display_name) values('10000000-0000-4000-8000-000000000100','LOCAL worker');
insert into manpower_tasks(id,display_name) values('10000000-0000-4000-8000-000000000101','LOCAL task');
insert into manpower_reporting_groups(id,display_name) values('10000000-0000-4000-8000-000000000102','LOCAL occupied'),('10000000-0000-4000-8000-000000000103','LOCAL empty');
-- Category audit requires a real local active Lead/Admin even for privileged seed.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',false);
insert into manpower_product_categories(id,display_name,sort_order) values('10000000-0000-4000-8000-000000000104','LOCAL active',1);
insert into jobs(id,name,production_status) values('10000000-0000-4000-8000-000000000105','LOCAL completed without Rework','complete'),('10000000-0000-4000-8000-000000000106','LOCAL active Rework Job','complete');
insert into production_rework_cycles(id,job_id,sequence_number,reason_category,scope_details,intake_date) values('10000000-0000-4000-8000-000000000107','10000000-0000-4000-8000-000000000106',1,'other','LOCAL fixture','2026-09-01');
insert into manpower_entries(id,work_date,worker_id,task_id,job_id,reporting_group_id,product_category_id,am_hours,pm_hours,notes,rework_cycle_id)
select ('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'2026-09-01','10000000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000101','10000000-0000-4000-8000-000000000106','10000000-0000-4000-8000-000000000102','10000000-0000-4000-8000-000000000104',1,0.5,'LOCAL synthetic history','10000000-0000-4000-8000-000000000107' from generate_series(1,1003)i;
select set_config('request.jwt.claim.sub','',false);
-- Roll back every probe, including writes and side effects, and report actual row count.
create function public.security_probe(q text) returns jsonb language plpgsql as $$
declare result jsonb;n bigint;begin
 begin
 execute q; get diagnostics n=row_count;
 result:=jsonb_build_object('state','allowed','rows',n);
 raise exception using errcode='Z0001';
 exception when sqlstate 'Z0001' then return result;
 when others then return jsonb_build_object('state',sqlstate,'message',sqlerrm);end;
end$$;
grant execute on function security_probe(text) to anon,authenticated,service_role;
