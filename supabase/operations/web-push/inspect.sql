-- Privileged count-only operational view. No endpoint or content output.
select s.environment,d.state,d.outcome,count(*),min(d.next_attempt_at) as oldest_due
from public.web_push_deliveries d join public.web_push_subscriptions s on s.id=d.subscription_id
group by s.environment,d.state,d.outcome;
select environment,max(created_at) as last_wake,max(consumed_at) as last_consumed from public.web_push_runs group by environment;
