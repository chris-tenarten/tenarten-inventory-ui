-- Review/apply separately from the frozen application migration. Does not enable the job.
begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do $$ begin
 if coalesce(current_setting('cron.timezone',true),'GMT') not in ('GMT','UTC','Etc/UTC') then raise exception 'UTC Cron timezone required; do not change global timezone silently'; end if;
 if to_regclass('vault.secrets') is null then raise exception 'Supabase Vault required'; end if;
 if to_regprocedure('public.claim_abandoned_my_work_transfers(integer)') is null then raise exception 'Messaging migration required'; end if;
end $$;
create table if not exists public.messaging_cleanup_runs(
 id uuid primary key default gen_random_uuid(),
 requested_at timestamptz not null default clock_timestamp(),
 started_at timestamptz,finished_at timestamptz,request_id bigint,
 status text not null check(status in ('queued','running','succeeded','failed')),
 claimed integer not null default 0 check(claimed between 0 and 50),
 cleaned integer not null default 0 check(cleaned between 0 and 50),
 failed integer not null default 0 check(failed between 0 and 50),category text
);
alter table public.messaging_cleanup_runs enable row level security;
revoke all on public.messaging_cleanup_runs from public,anon,authenticated,service_role;
grant select,insert,update on public.messaging_cleanup_runs to service_role;
create or replace function public.dispatch_messaging_cleanup()
returns bigint language plpgsql security definer set search_path=pg_catalog,public as $$
declare invocation text; jwt text; run uuid:=gen_random_uuid(); request bigint; payload text;
begin
 select decrypted_secret into strict invocation from vault.decrypted_secrets where name='messaging_cleanup_invocation';
 select decrypted_secret into strict jwt from vault.decrypted_secrets where name='messaging_cleanup_gateway_jwt';
 if length(invocation) not between 32 and 256 or length(jwt)<32 then raise exception 'Cleanup secrets not configured'; end if;
 payload:=translate(split_part(jwt,'.',2),'-_','+/');
 if (convert_from(decode(rpad(payload,((length(payload)+3)/4)*4,'='),'base64'),'UTF8')::jsonb->>'role') is distinct from 'anon' then raise exception 'Gateway credential must be anon JWT, never service_role'; end if;
 insert into public.messaging_cleanup_runs(id,status) values(run,'queued');
 request:=net.http_post(
  url:='https://vxdxjhazkqhpkwdqtobp.supabase.co/functions/v1/cleanup-messaging-drafts',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||jwt,
   'x-messaging-cleanup-secret',invocation,'x-messaging-cleanup-run',run::text),
  body:='{}'::jsonb,timeout_milliseconds:=110000);
 update public.messaging_cleanup_runs set request_id=request where id=run;
 -- Operational count-only records, never business data. Keep 30 days.
 delete from public.messaging_cleanup_runs where requested_at<clock_timestamp()-interval '30 days';
 return request;
end $$;
revoke all on function public.dispatch_messaging_cleanup() from public,anon,authenticated,service_role;
do $$ declare cleanup_job_id bigint; begin
 if exists(select 1 from cron.job where jobname='tenops-messaging-abandoned-drafts' and username<>current_user) then raise exception 'Job name owned by another role'; end if;
 select jobid into cleanup_job_id from cron.job where jobname='tenops-messaging-abandoned-drafts' and username=current_user;
 if cleanup_job_id is null then
  cleanup_job_id:=cron.schedule('tenops-messaging-abandoned-drafts','17 * * * *','select public.dispatch_messaging_cleanup();');
  perform cron.alter_job(cleanup_job_id,active:=false);
 elsif exists(select 1 from cron.job where jobid=cleanup_job_id and (schedule<>'17 * * * *' or command<>'select public.dispatch_messaging_cleanup();')) then
  raise exception 'Unexpected existing cleanup schedule; inspect drift';
 end if;
end $$;
commit;
