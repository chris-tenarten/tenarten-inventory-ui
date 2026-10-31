-- PREPARED, NOT RUN. Fixed isolated Free fixture only after authorization.
-- Invoke during A's bounded lock. No business/grant/configuration mutations.
begin;
set local lock_timeout='200ms';set local statement_timeout='2s';
do $blocked$ begin
 begin
  perform 1 from public.tenbot_chris_dev_execution_window where singleton for update;
  raise exception 'Expected concurrent window lock to block; timing was not established';
 exception when lock_not_available then null;
 end;
end $blocked$;
rollback;
