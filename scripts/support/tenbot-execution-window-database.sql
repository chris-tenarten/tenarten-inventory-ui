-- PREPARED, NOT RUN. Isolated Free fixture jltgxcfiprocydhbrahz ONLY, through
-- its existing fixed-project branch-query helper after separate authorization.
-- Never use the shared TenOps project. The new migration must already be applied
-- to that isolated fixture. These checks make NO grant or operational records;
-- every attempted change is rejected and the transaction rolls back.
--
-- This is not signed-JWT/positive activation proof. The fixed shared source is
-- absent in the fixture and its prior same-hash chris_dev original is retained.
-- Do not rewrite retained evidence, suspend indexes, or substitute another source.
-- Positive arm/bind, expiry-at-commit, replay and revoked-grant authorization
-- require a separately approved safe synthetic fixture and real Auth callers.
begin;
set local lock_timeout='500ms';set local statement_timeout='5s';
do $checks$
declare w public.tenbot_chris_dev_execution_window;before_usage text;before_funding text;before_grants text;
begin
 select * into strict w from public.tenbot_chris_dev_execution_window where singleton;
 if w.enabled or w.starts_at is not null or w.expires_at is not null or w.bound_grant_id is not null or w.inference_allowed then raise exception 'Fresh dormant isolated window required';end if;
 if not (select relrowsecurity from pg_class where oid='public.tenbot_chris_dev_execution_window'::regclass)
  or exists(select 1 from pg_policy where polrelid='public.tenbot_chris_dev_execution_window'::regclass)
  or has_table_privilege('authenticated','public.tenbot_chris_dev_execution_window','SELECT,INSERT,UPDATE,DELETE')
  or has_table_privilege('service_role','public.tenbot_chris_dev_execution_window','SELECT,INSERT,UPDATE,DELETE')
  or has_function_privilege('authenticated','public.tenbot_execution_original_ready(boolean)','EXECUTE')
  or has_function_privilege('service_role','public.tenbot_execution_original_ready(boolean)','EXECUTE') then raise exception 'Window privacy/privilege invariant failed';end if;
 select md5(coalesce(string_agg(to_jsonb(u)::text,',' order by id),'')) into before_usage from public.tenbot_openai_usage u;
 select md5(to_jsonb(f)::text) into before_funding from public.tenbot_chris_dev_canary_funding f where singleton;
 select md5(coalesce(string_agg(to_jsonb(g)::text,',' order by id),'')) into before_grants from public.tenbot_chris_dev_canary_grants g;
 begin update public.tenbot_chris_dev_execution_window set enabled=true where singleton;raise exception 'Expected missing-window rejection';exception when check_violation then null;end;
 begin update public.tenbot_chris_dev_execution_window set inference_allowed=true where singleton;raise exception 'Expected inference-authority rejection';exception when check_violation then null;end;
 begin update public.tenbot_chris_dev_execution_window set source_id='10302026-0000-4000-8000-000000000099' where singleton;raise exception 'Expected source-scope rejection';exception when check_violation then null;end;
 begin update public.tenbot_chris_dev_execution_window set owner_user_id='10302026-0000-4000-8000-000000000099' where singleton;raise exception 'Expected owner-scope rejection';exception when check_violation then null;end;
 begin update public.tenbot_chris_dev_execution_window set enabled=true,starts_at=clock_timestamp(),expires_at=clock_timestamp()+interval '16 minutes' where singleton;raise exception 'Expected overlong-window rejection';exception when insufficient_privilege or check_violation then null;end;
 begin update public.tenbot_chris_dev_execution_window set bound_grant_id='10302026-0000-4000-8000-000000000099' where singleton;raise exception 'Expected noncanonical binding rejection';exception when insufficient_privilege then null;end;
 begin delete from public.tenbot_chris_dev_execution_window where singleton;raise exception 'Expected immutable-window deletion rejection';exception when check_violation then null;end;
 if before_usage is distinct from(select md5(coalesce(string_agg(to_jsonb(u)::text,',' order by id),'')) from public.tenbot_openai_usage u)
  or before_funding is distinct from(select md5(to_jsonb(f)::text) from public.tenbot_chris_dev_canary_funding f where singleton)
  or before_grants is distinct from(select md5(coalesce(string_agg(to_jsonb(g)::text,',' order by id),'')) from public.tenbot_chris_dev_canary_grants g) then raise exception 'Rejected tests changed existing authority or accounting';end if;
end $checks$;
select 'dormant/private/scope/negative-window checks only; no positive Auth or execution claim' as evidence;
rollback;
