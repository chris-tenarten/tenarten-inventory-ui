-- Prepared restricted TenDev pilot. This file does not authorize application or
-- activation on the shared TenOps database. Defaults OFF, no enrolled employees.
-- The privileged RPC writes authorization metadata only; canonical business
-- execution always retains the employee JWT and NOBYPASSRLS executor.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

do $preflight$ begin
 if to_regprocedure('public.execute_invoice_receival_draft(uuid,text,uuid)') is null
  or to_regprocedure('public.get_invoice_receival_source_for_draft(uuid)') is null
  or to_regclass('public.invoice_receival_permission_epochs') is null
  or not exists(select 1 from pg_roles where rolname='tenbot_invoice_executor' and not rolcanlogin and not rolbypassrls and not rolsuper)
  or to_regprocedure('public.tenbot_execute_invoice_receival_core(uuid,text,uuid)') is not null then
  raise exception 'Reviewed invoice, original-source and non-bypass executor prerequisites required.';
 end if;
end $preflight$;

create table public.tenbot_receival_pilot_policy(
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 policy_version bigint not null default 1 check(policy_version>0),
 allowed_origin text not null default 'https://tendev.pages.dev' check(allowed_origin='https://tendev.pages.dev'),
 starts_at timestamptz,
 expires_at timestamptz,
 validation_receipt_sha256 text check(validation_receipt_sha256 ~ '^[a-f0-9]{64}$'),
 check(not enabled or (starts_at is not null and expires_at is not null and expires_at>starts_at and expires_at<=starts_at+interval '24 hours' and validation_receipt_sha256 is not null))
);
insert into public.tenbot_receival_pilot_policy(singleton) values(true);
create table public.tenbot_receival_pilot_employees(
 user_id uuid primary key references public.app_users(user_id),
 enrolled_at timestamptz not null default clock_timestamp()
);
create table public.invoice_receival_execution_permits(
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references public.app_users(user_id),
 draft_id uuid not null references public.invoice_receival_drafts(id),
 approval_id uuid not null unique references public.invoice_receival_approvals(id),
 content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
 authorization_version text not null check(authorization_version ~ '^[a-f0-9]{64}$'),
 policy_version bigint not null,
 origin text not null check(origin='https://tendev.pages.dev'),
 issued_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 consumed_at timestamptz,
 check(expires_at>issued_at and expires_at<=issued_at+interval '2 minutes')
);
revoke all on public.tenbot_receival_pilot_policy,public.tenbot_receival_pilot_employees,public.invoice_receival_execution_permits from public,anon,authenticated,service_role;
grant select on public.tenbot_receival_pilot_policy,public.tenbot_receival_pilot_employees to tenbot_invoice_executor;
grant select,update(consumed_at) on public.invoice_receival_execution_permits to tenbot_invoice_executor;
alter table public.invoice_receival_execution_permits enable row level security;
create policy invoice_execution_permits_owner_read on public.invoice_receival_execution_permits for select to tenbot_invoice_executor using(owner_user_id=auth.uid() and public.has_app_capability('readOperationalData') and public.has_app_capability('writeBusinessData') and public.has_app_capability('adjustInventory'));
create policy invoice_execution_permits_owner_consume on public.invoice_receival_execution_permits for update to tenbot_invoice_executor using(owner_user_id=auth.uid() and public.has_app_capability('readOperationalData') and public.has_app_capability('writeBusinessData') and public.has_app_capability('adjustInventory')) with check(owner_user_id=auth.uid() and public.has_app_capability('readOperationalData') and public.has_app_capability('writeBusinessData') and public.has_app_capability('adjustInventory'));

-- Every policy/allowlist change invalidates outstanding permits, including
-- disable/re-enable and employee removal/re-enrollment with identical end state.
create function public.tenbot_receival_pilot_version_changed() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if tg_table_name='tenbot_receival_pilot_policy' then
  new.policy_version:=old.policy_version+1;return new;
 end if;
 update public.tenbot_receival_pilot_policy set policy_version=policy_version where singleton;
 return null;
end $$;
revoke all on function public.tenbot_receival_pilot_version_changed() from public,anon,authenticated,service_role;
create trigger tenbot_receival_policy_version before update on public.tenbot_receival_pilot_policy for each row execute function public.tenbot_receival_pilot_version_changed();
create trigger tenbot_receival_employee_version after insert or update or delete on public.tenbot_receival_pilot_employees for each statement execute function public.tenbot_receival_pilot_version_changed();

create function public.tenbot_receival_mint_execution_permit(p_user uuid,p_draft_id uuid,p_expected_hash text,p_approval_id uuid,p_origin text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='3s' set statement_timeout='10s' as $$
declare actor public.app_users; policy public.tenbot_receival_pilot_policy; draft public.invoice_receival_drafts; approval public.invoice_receival_approvals; permit public.invoice_receival_execution_permits; current_version text; required text; expiry timestamptz;
begin
 if auth.role() is distinct from 'service_role' or p_user is null or p_draft_id is null or p_approval_id is null or coalesce(p_expected_hash,'') !~ '^[a-f0-9]{64}$' or p_origin is distinct from 'https://tendev.pages.dev' then
  raise exception 'Fixed hosted execution authorization required.' using errcode='42501';
 end if;
 select * into actor from public.app_users where user_id=p_user for share;
 lock table public.app_role_capabilities in share mode;
 if actor.user_id is null or actor.is_active is distinct from true or actor.read_only is distinct from false then raise exception 'Current employee write permission required.' using errcode='42501';end if;
 foreach required in array array['readOperationalData','writeBusinessData','adjustInventory'] loop
  if not exists(select 1 from public.app_role_capabilities c where c.role=actor.role and c.capability=required) then raise exception 'Current employee write permission required.' using errcode='42501';end if;
 end loop;
 select * into policy from public.tenbot_receival_pilot_policy where singleton for share;
 if policy.singleton is distinct from true or policy.enabled is distinct from true or policy.starts_at is null or policy.expires_at is null or policy.starts_at>clock_timestamp() or policy.expires_at<=clock_timestamp() or policy.allowed_origin is distinct from p_origin or not exists(select 1 from public.tenbot_receival_pilot_employees where user_id=p_user) then
  raise exception 'Restricted write pilot is disabled or unavailable.' using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_draft_id::text,427901));
 select * into draft from public.invoice_receival_drafts where id=p_draft_id and owner_user_id=p_user;
 select * into approval from public.invoice_receival_approvals where id=p_approval_id and draft_id=p_draft_id and owner_user_id=p_user;
 current_version:=encode(sha256(convert_to(p_user::text||':'||coalesce((select revision::text from public.invoice_receival_permission_epochs where scope='actor:'||p_user::text),'0')||':'||coalesce((select revision::text from public.invoice_receival_permission_epochs where scope='capabilities'),'0'),'UTF8')),'hex');
 if draft.id is null or approval.id is null or draft.content_hash is distinct from p_expected_hash or approval.content_hash is distinct from p_expected_hash or draft.payload->>'authorizationVersion' is distinct from current_version
  or exists(select 1 from public.invoice_receival_supersessions where old_draft_id=draft.id) or exists(select 1 from public.invoice_receival_revocations where draft_id=draft.id)
  or encode(sha256(convert_to(draft.payload::text,'UTF8')),'hex') is distinct from draft.content_hash then raise exception 'Exact current approval required.' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(draft.payload->'lines') l where l->'newMaterial'<>'null'::jsonb) and not exists(select 1 from public.app_role_capabilities c where c.role=actor.role and c.capability='manageVendorsCatalog') then raise exception 'Catalog creation permission required.' using errcode='42501';end if;
 if exists(select 1 from public.invoice_receival_executions where draft_id=draft.id and owner_user_id=p_user and content_hash=p_expected_hash and approval_id=p_approval_id) then return jsonb_build_object('ok',true,'alreadyExecuted',true);end if;
 expiry:=least(clock_timestamp()+interval '2 minutes',policy.expires_at,draft.expires_at,approval.expires_at);
 if expiry<=clock_timestamp() then raise exception 'Execution approval expired.' using errcode='22023';end if;
 select * into permit from public.invoice_receival_execution_permits where approval_id=approval.id for update;
 if found and permit.consumed_at is not null then raise exception 'Execution permit already consumed.' using errcode='22023';end if;
 if permit.id is not null and (permit.owner_user_id<>p_user or permit.draft_id<>draft.id or permit.content_hash<>p_expected_hash) then raise exception 'Execution permit identity differs.' using errcode='22023';end if;
 if permit.id is null then
  insert into public.invoice_receival_execution_permits(owner_user_id,draft_id,approval_id,content_hash,authorization_version,policy_version,origin,expires_at) values(p_user,draft.id,approval.id,p_expected_hash,current_version,policy.policy_version,p_origin,expiry) returning * into permit;
 elsif permit.policy_version<>policy.policy_version or permit.authorization_version<>current_version then
  raise exception 'Execution policy or employee permission changed; prepare a fresh approval.' using errcode='22023';
 elsif permit.expires_at<=clock_timestamp() then
  update public.invoice_receival_execution_permits set issued_at=clock_timestamp(),expires_at=expiry where id=permit.id returning * into permit;
 end if;
 return jsonb_build_object('ok',true,'alreadyExecuted',false,'permitId',permit.id,'draftId',draft.id,'hash',p_expected_hash,'approvalId',approval.id,'policyVersion',permit.policy_version,'expiresAt',permit.expires_at);
end $$;
revoke all on function public.tenbot_receival_mint_execution_permit(uuid,uuid,text,uuid,text) from public,anon,authenticated,tenbot_invoice_executor;
grant execute on function public.tenbot_receival_mint_execution_permit(uuid,uuid,text,uuid,text) to service_role;

-- Hide the unchanged canonical implementation behind one fixed caller-scoped
-- permit check. The service key cannot invoke either business entry point.
alter function public.execute_invoice_receival_draft(uuid,text,uuid) rename to tenbot_execute_invoice_receival_core;
revoke all on function public.tenbot_execute_invoice_receival_core(uuid,text,uuid) from public,anon,authenticated,service_role;
create function public.execute_invoice_receival_draft(p_draft_id uuid,p_expected_hash text,p_approval_id uuid) returns jsonb
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
 select * into policy from public.tenbot_receival_pilot_policy where singleton for share;
 if policy.singleton is distinct from true or policy.enabled is distinct from true or policy.starts_at is null or policy.expires_at is null or policy.starts_at>clock_timestamp() or policy.expires_at<=clock_timestamp() or policy.allowed_origin is distinct from 'https://tendev.pages.dev' or not exists(select 1 from public.tenbot_receival_pilot_employees where user_id=auth.uid()) then raise exception 'Restricted write pilot is disabled or unavailable.' using errcode='42501';end if;
 select * into permit from public.invoice_receival_execution_permits where owner_user_id=auth.uid() and draft_id=p_draft_id and approval_id=p_approval_id and content_hash=p_expected_hash for update;
 if permit.id is null or permit.consumed_at is not null or permit.expires_at<=clock_timestamp() or permit.origin<>policy.allowed_origin or permit.policy_version<>policy.policy_version or permit.authorization_version<>public.tenbot_invoice_authorization_version() then raise exception 'Fresh server execution authorization required.' using errcode='42501';end if;
 update public.invoice_receival_execution_permits set consumed_at=clock_timestamp() where id=permit.id;
 -- A partial failure rolls back permit consumption along with catalog,
 -- pending rows, retained original association and audit in the same transaction.
 return public.tenbot_execute_invoice_receival_core(p_draft_id,p_expected_hash,p_approval_id);
end $$;
-- PostgreSQL requires temporary namespace CREATE for ownership transfer, as in
-- the existing canonical invoice migration. It is revoked before this TX ends.
grant create on schema public to tenbot_invoice_executor;
alter function public.execute_invoice_receival_draft(uuid,text,uuid) owner to tenbot_invoice_executor;
revoke create on schema public from tenbot_invoice_executor;
revoke all on function public.execute_invoice_receival_draft(uuid,text,uuid) from public,anon,service_role;
grant execute on function public.execute_invoice_receival_draft(uuid,text,uuid) to authenticated;
comment on table public.tenbot_receival_pilot_policy is 'Owner-configured, default-off finite TenDev write pilot. No employee/model/configuration mutation RPC. Enroll approved employees and pin validation evidence only after separate Product approval.';
comment on function public.tenbot_receival_mint_execution_permit(uuid,uuid,text,uuid,text) is 'Fixed service-only authorization metadata. Does not approve or execute business records; employee JWT canonical execution remains mandatory.';
notify pgrst,'reload schema';
commit;
