-- Read-only lifecycle metadata for the fixed, already-reviewed chris_dev canary.
-- No grant, enrollment, write gate, role or Inventory record is changed.
-- Apply to shared infrastructure only after separate Product staging approval.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

do $preflight$ begin
 if to_regclass('public.tenbot_chris_dev_canary_grants') is null
  or to_regprocedure('public.get_my_tenbot_receival_canary_access()') is null
  or (select md5(prosrc) from pg_proc where oid='public.activate_tenbot_chris_dev_canary_grant(timestamptz,text)'::regprocedure)
     is distinct from 'c2d6f546fad823a7a4ffdf8dd6cc9b1f'
  or (select md5(prosrc) from pg_proc where oid='public.revoke_tenbot_chris_dev_canary_grant(uuid,text)'::regprocedure)
     is distinct from '07f4bc465c8db61d4df67cc0896a8f96' then
  raise exception 'Exact accepted canary authorization contracts required.';
 end if;
end $preflight$;

create function public.get_tenbot_chris_dev_canary_control_status() returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,public
set lock_timeout='3s' set statement_timeout='10s' as $$
declare
 actor public.app_users; subject public.app_users;
 selected public.tenbot_chris_dev_canary_grants;
 now_at timestamptz:=clock_timestamp();
 viewer text; unrevoked integer; completed boolean; eligible boolean;
 pilot boolean; execution boolean; enrolled boolean; enrollments integer;
 active_grant boolean:=false; conflict boolean; blocked text; projected jsonb;
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null then
  raise exception 'Authenticated canary control access required.' using errcode='42501';
 end if;
 select * into actor from public.app_users where user_id=auth.uid();
 if actor.user_id is null or not actor.is_active then
  raise exception 'Authenticated canary control access required.' using errcode='42501';
 end if;
 if actor.role='admin' and not actor.read_only and public.has_app_capability('manageRolesPermissions') then
  viewer:='admin';
 elsif actor.user_id='3785f6b9-742e-452f-af6c-31613a983633'
  and public.has_app_capability('readOperationalData') then
  viewer:='owner';
 else
  raise exception 'This fixed canary control is unavailable.' using errcode='42501';
 end if;

 select * into subject from public.app_users where user_id='3785f6b9-742e-452f-af6c-31613a983633';
 eligible:=coalesce(subject.role='developer' and subject.is_active and not subject.read_only
  and not exists(select 1 from public.app_role_capabilities where role='developer' and capability='adjustInventory')
  and public.tenbot_canary_user_has_capability(subject.user_id,'readOperationalData')
  and public.tenbot_canary_user_has_capability(subject.user_id,'writeBusinessData'),false);
 select count(*) into unrevoked from public.tenbot_chris_dev_canary_grants where revoked_at is null;
 conflict:=unrevoked>1;
 completed:=exists(select 1 from public.tenbot_chris_dev_canary_grants where executed_draft_id is not null)
  or exists(select 1 from public.invoice_receival_executions e
   join public.invoice_receival_drafts d on d.id=e.draft_id
   where e.owner_user_id='3785f6b9-742e-452f-af6c-31613a983633'
    and d.payload->'document'->>'sha256'='c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a');
 if not conflict then
  -- Recover an expired unrevoked grant for cleanup before looking at history.
  -- A completed closure takes precedence over an unrelated earlier failed run.
  select * into selected from public.tenbot_chris_dev_canary_grants
   where owner_user_id='3785f6b9-742e-452f-af6c-31613a983633'
   order by (revoked_at is null) desc,(executed_draft_id is not null) desc,starts_at desc,id desc limit 1;
  if selected.id is not null then
   active_grant:=eligible and selected.revoked_at is null
    and selected.starts_at<=now_at and selected.expires_at>now_at;
   projected:=jsonb_build_object('id',selected.id,'startsAt',selected.starts_at,'expiresAt',selected.expires_at,
    'revokedAt',selected.revoked_at,'active',active_grant,
    'hasApproval',selected.approved_draft_id is not null,'hasExecution',selected.executed_draft_id is not null);
   -- Administrative grant lifecycle access is not private invoice-reading access.
   if viewer='admin' then projected:=projected||jsonb_build_object('activatedBy',selected.activated_by);
   else projected:=projected||jsonb_build_object('executedDraftId',selected.executed_draft_id);end if;
  end if;
 end if;
 select enabled into pilot from public.tenbot_receival_pilot_policy where singleton;
 select execution_enabled into execution from public.tenbot_receival_execution_control where singleton;
 if pilot is null or execution is null then
  raise exception 'Canary controls unavailable.' using errcode='42501';
 end if;
 select count(*),coalesce(bool_or(user_id='3785f6b9-742e-452f-af6c-31613a983633'),false)
  into enrollments,enrolled from public.tenbot_receival_pilot_employees;
 blocked:=case when viewer<>'admin' then 'admin-required'
  when conflict then 'grant-conflict' when completed then 'completed-canary'
  when unrevoked>0 then 'existing-grant' when not eligible then 'subject-ineligible'
  when pilot or execution then 'write-gates-enabled' when enrollments>0 then 'enrollment-not-empty' else null end;
 return jsonb_build_object('schemaVersion','tenbot-canary-control.v1','serverNow',now_at,'viewer',viewer,
  'ownerId','3785f6b9-742e-452f-af6c-31613a983633','subjectEligible',eligible,
  'completedCanary',completed,'grantConflict',conflict,'grant',projected,
  'database',jsonb_build_object('pilotEnabled',pilot,'executionEnabled',execution,
   'subjectEnrolled',enrolled,'enrollmentCount',enrollments),'activationBlock',blocked);
end $$;

revoke all on function public.get_tenbot_chris_dev_canary_control_status()
 from public,anon,authenticated,service_role,tenbot_invoice_executor;
grant execute on function public.get_tenbot_chris_dev_canary_control_status() to authenticated;
comment on function public.get_tenbot_chris_dev_canary_control_status() is
 'Read-only fixed-canary lifecycle metadata for existing permission-managing Admin or authorized self. No invoice content for Admin, arbitrary lookup, table SELECT grant, activation or write-gate authority.';
commit;
