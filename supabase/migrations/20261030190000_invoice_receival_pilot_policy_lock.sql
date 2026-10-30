-- Forward correction from real isolated PostgreSQL validation: SELECT FOR SHARE
-- requires UPDATE privilege. Keep the non-bypass business executor read-only on
-- pilot policy; a fixed private metadata helper acquires only its row lock.
-- No public/service grant, policy mutation or business privilege is added.
begin;
set local lock_timeout='3s';set local statement_timeout='30s';
do $preflight$ begin
 if to_regprocedure('public.tenbot_execute_invoice_receival_core(uuid,text,uuid)') is null
  or to_regclass('public.invoice_receival_execution_permits') is null
  or pg_get_userbyid((select proowner from pg_proc where oid='public.execute_invoice_receival_draft(uuid,text,uuid)'::regprocedure))<>'tenbot_invoice_executor' then
  raise exception 'The reviewed caller-scoped permit wrapper is required.';
 end if;
end $preflight$;
create function public.tenbot_lock_receival_pilot_policy() returns public.tenbot_receival_pilot_policy
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='3s' set statement_timeout='5s' as $$
declare policy public.tenbot_receival_pilot_policy;
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null then raise exception 'Employee authentication required.' using errcode='42501';end if;
 perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');perform public.require_app_capability('adjustInventory');
 select * into policy from public.tenbot_receival_pilot_policy where singleton for share;
 return policy;
end $$;
revoke all on function public.tenbot_lock_receival_pilot_policy() from public,anon,authenticated,service_role;
grant execute on function public.tenbot_lock_receival_pilot_policy() to tenbot_invoice_executor;
create or replace function public.execute_invoice_receival_draft(p_draft_id uuid,p_expected_hash text,p_approval_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='3s' set statement_timeout='15s' as $$
declare policy public.tenbot_receival_pilot_policy; permit public.invoice_receival_execution_permits;
begin
 perform public.tenbot_lock_invoice_actor();perform pg_advisory_xact_lock(hashtextextended(p_draft_id::text,427901));
 perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');perform public.require_app_capability('adjustInventory');
 -- A committed receipt has no new write to authorize. Delegate to its existing
 -- exact hash/approval/current permission/RLS reconciliation checks.
 if exists(select 1 from public.invoice_receival_executions where draft_id=p_draft_id and owner_user_id=auth.uid() and approval_id=p_approval_id and content_hash=p_expected_hash) then
  return public.tenbot_execute_invoice_receival_core(p_draft_id,p_expected_hash,p_approval_id);
 end if;
 policy:=public.tenbot_lock_receival_pilot_policy();
 if policy.singleton is distinct from true or policy.enabled is distinct from true or policy.starts_at is null or policy.expires_at is null or policy.starts_at>clock_timestamp() or policy.expires_at<=clock_timestamp() or policy.allowed_origin is distinct from 'https://tendev.pages.dev' or not exists(select 1 from public.tenbot_receival_pilot_employees where user_id=auth.uid()) then raise exception 'Restricted write pilot is disabled or unavailable.' using errcode='42501';end if;
 select * into permit from public.invoice_receival_execution_permits where owner_user_id=auth.uid() and draft_id=p_draft_id and approval_id=p_approval_id and content_hash=p_expected_hash for update;
 if permit.id is null or permit.consumed_at is not null or permit.expires_at<=clock_timestamp() or permit.origin<>policy.allowed_origin or permit.policy_version<>policy.policy_version or permit.authorization_version<>public.tenbot_invoice_authorization_version() then raise exception 'Fresh server execution authorization required.' using errcode='42501';end if;
 update public.invoice_receival_execution_permits set consumed_at=clock_timestamp() where id=permit.id;
 -- A partial failure rolls back permit consumption along with catalog,
 -- pending rows, retained original association and audit in the same transaction.
 return public.tenbot_execute_invoice_receival_core(p_draft_id,p_expected_hash,p_approval_id);
end $$;
-- CREATE OR REPLACE retains the reviewed wrapper owner and ACL.
do $owner$ begin
 if pg_get_userbyid((select proowner from pg_proc where oid='public.execute_invoice_receival_draft(uuid,text,uuid)'::regprocedure))<>'tenbot_invoice_executor'
  or has_table_privilege('tenbot_invoice_executor','public.tenbot_receival_pilot_policy','UPDATE')
  or has_schema_privilege('tenbot_invoice_executor','public','CREATE') then
  raise exception 'Non-bypass wrapper or read-only policy boundary changed.';
 end if;
end $owner$;
notify pgrst,'reload schema';
commit;
