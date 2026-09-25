begin;
do $$ declare cleanup_job_id bigint; begin
 select jobid into strict cleanup_job_id from cron.job where jobname='tenops-messaging-abandoned-drafts' and username=current_user;
 perform cron.alter_job(cleanup_job_id,active:=false);
end $$;
commit;
