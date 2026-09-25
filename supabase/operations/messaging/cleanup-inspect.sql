-- Read-only: queued/running for >5 minutes is failure even if pg_net result expired.
select id,requested_at,started_at,finished_at,
 case when status in ('queued','running') and requested_at<now()-interval '5 minutes' then 'stalled' else status end as outcome,
 claimed,cleaned,failed,category,request_id
from public.messaging_cleanup_runs order by requested_at desc limit 48;
select jobid,jobname,schedule,active from cron.job where jobname='tenops-messaging-abandoned-drafts';
select start_time,end_time,status,return_message from cron.job_run_details
where jobid in (select jobid from cron.job where jobname='tenops-messaging-abandoned-drafts') order by start_time desc limit 24;
-- Cron success means dispatch was enqueued, NOT that cleanup succeeded.
select max(finished_at) as last_success,
 coalesce(max(finished_at)<now()-interval '2 hours',true) as attention_required
from public.messaging_cleanup_runs where status='succeeded';
