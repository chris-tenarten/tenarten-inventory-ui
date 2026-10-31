-- PREPARED, NOT RUN. Fixed isolated Free fixture only after authorization.
-- Start A, then B in a second session while A holds the singleton. This tests
-- row-lock serialization only, not positive concurrent grant activation.
begin;
set local lock_timeout='500ms';set local statement_timeout='5s';
select singleton from public.tenbot_chris_dev_execution_window where singleton for update;
select pg_sleep(2);
rollback;
