begin;
do $$ declare cleanup_job_id bigint; begin
 select jobid into strict cleanup_job_id from cron.job where jobname='tenops-messaging-abandoned-drafts' and username=current_user;
 if not exists(select 1 from public.messaging_cleanup_runs where status='succeeded' and finished_at>now()-interval '1 hour') then raise exception 'Successful authenticated endpoint verification required first'; end if;
 perform cron.alter_job(cleanup_job_id,active:=true);
end $$;
commit;
