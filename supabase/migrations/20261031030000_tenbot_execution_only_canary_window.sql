-- REVIEW CANDIDATE ONLY. No application/arming/grant/write authorization.
-- One zero-inference execution window for the already verified synthetic draft.
-- The used inference allowance, all usage/accounting, canonical grant RPCs,
-- approvals, permission epochs, idempotency and revocation remain intact.
begin;
set local lock_timeout='3s';set local statement_timeout='30s';

do $predecessors$ begin
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.tenbot_bind_canary_funding_grant()')) is distinct from '366162ba4b9d723f965758c57bb4ef72'
  or (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.tenbot_openai_canary_reserve(uuid,uuid,uuid,text,bigint,text,uuid,uuid)')) is distinct from '802f9b0f69a90452620cdee9748ed7dc'
  or (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.activate_tenbot_chris_dev_canary_grant(timestamptz,text)')) is distinct from 'c2d6f546fad823a7a4ffdf8dd6cc9b1f'
  or (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.revoke_tenbot_chris_dev_canary_grant(uuid,text)')) is distinct from '07f4bc465c8db61d4df67cc0896a8f96'
  or to_regprocedure('public.can_read_invoice_preparation_source(uuid)') is null then
  raise exception 'Exact accepted source preparation, grant and immutable inference funding contracts required.';
 end if;
 if exists(select 1 from pg_proc where oid in(to_regprocedure('public.tenbot_bind_canary_funding_grant()'),to_regprocedure('public.tenbot_openai_canary_reserve(uuid,uuid,uuid,text,bigint,text,uuid,uuid)')) and (not prosecdef or proowner<>'postgres'::regrole)) then
  raise exception 'Exact owner-defined server authorization functions required.';
 end if;
end $predecessors$;

create table public.tenbot_chris_dev_execution_window(
 singleton boolean primary key default true check(singleton),
 id uuid not null unique default '20261031-0300-4000-8000-000000000001' check(id='20261031-0300-4000-8000-000000000001'),
 enabled boolean not null default false,
 starts_at timestamptz,expires_at timestamptz,
 owner_user_id uuid not null default '3785f6b9-742e-452f-af6c-31613a983633' check(owner_user_id='3785f6b9-742e-452f-af6c-31613a983633'),
 -- Fixed identifier, verified at arm/bind/use. No fixture/Production source is
 -- manufactured merely by applying this dormant migration.
 source_id uuid not null default '1423d4e0-1a4a-48bd-af79-28e623102da4' check(source_id='1423d4e0-1a4a-48bd-af79-28e623102da4'),
 document_sha256 text not null default 'c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a' check(document_sha256='c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a'),
 source_evidence_sha256 text not null default '534087aeed62e2dd4d7112e22d700b760eb0f436445de16d300fc3ca83ad7c54' check(source_evidence_sha256='534087aeed62e2dd4d7112e22d700b760eb0f436445de16d300fc3ca83ad7c54'),
 preview_revision integer not null default 1 check(preview_revision=1),
 preview_hash text not null default '7b63a8b55d2d496c2e15d0d5f2af81fb8da06f81109c4da1dfeed89e0c8e7594' check(preview_hash='7b63a8b55d2d496c2e15d0d5f2af81fb8da06f81109c4da1dfeed89e0c8e7594'),
 bound_grant_id uuid unique references public.tenbot_chris_dev_canary_grants(id),
 inference_allowed boolean not null default false check(not inference_allowed),
 created_at timestamptz not null default clock_timestamp(),armed_at timestamptz,bound_at timestamptz,disabled_at timestamptz,
 check((starts_at is null and expires_at is null and not enabled and bound_grant_id is null and armed_at is null)
  or (starts_at is not null and expires_at is not null and isfinite(starts_at) and isfinite(expires_at) and expires_at>starts_at and expires_at<=starts_at+interval '15 minutes' and armed_at is not null)),
 check((bound_grant_id is null)=(bound_at is null))
);
insert into public.tenbot_chris_dev_execution_window(singleton) values(true);
alter table public.tenbot_chris_dev_execution_window enable row level security;
revoke all on public.tenbot_chris_dev_execution_window from public,anon,authenticated,service_role,tenbot_invoice_executor;

create function public.tenbot_execution_original_ready(p_require_preview boolean)
returns boolean language sql volatile security definer set search_path=pg_catalog,public as $$
 select coalesce(exists(select 1 from public.invoice_receival_sources s
  where s.id='1423d4e0-1a4a-48bd-af79-28e623102da4' and s.owner_user_id='3785f6b9-742e-452f-af6c-31613a983633'
   and s.sha256='c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a'
   and s.evidence_sha256='534087aeed62e2dd4d7112e22d700b760eb0f436445de16d300fc3ca83ad7c54'
   and s.content_type='application/pdf' and s.byte_size=2877 and s.lifecycle_state='ready' and s.expires_at>clock_timestamp()
   and s.retained_at is null and s.retained_draft_id is null
   and exists(select 1 from storage.objects o join storage.buckets b on b.id=o.bucket_id where o.bucket_id='invoice-receival-originals' and o.name=s.storage_path and not b.public and o.metadata->>'size'='2877' and o.metadata->>'mimetype'='application/pdf')
   and (not p_require_preview or (
    not exists(select 1 from public.invoice_receival_source_bindings b where b.source_id=s.id)
    and s.agent_state->'draft'->>'id'=s.id::text and s.agent_state->'draft'->>'revision'='1'
    and s.agent_state->'draft'->>'hash'='7b63a8b55d2d496c2e15d0d5f2af81fb8da06f81109c4da1dfeed89e0c8e7594'
    and s.agent_state->'draft'->>'status'='review_required' and s.agent_state->'draft'->'canApprove'='false'::jsonb
    and s.agent_state->'draft'->'executionEnabled'='false'::jsonb and not(s.agent_state->'draft' ? 'durableDraftId')
    and jsonb_array_length(s.agent_state->'draft'->'rows')=1
    and s.agent_state->'draft'->'rows'->0->>'materialId'='standard:ba6a3690-0886-4f72-9f86-581bcc1f3b44'
    and s.agent_state->'draft'->'rows'->0->>'quantity'='1' and s.agent_state->'draft'->'rows'->0->>'unit'='Bag'
    and s.agent_state->'draft'->'rows'->0->'sourceQuantity'='{"quantity":"1","unit":"Bag"}'::jsonb
    and s.agent_state->'draft'->'rows'->0->'jobId'='null'::jsonb
    and coalesce(s.agent_state->'draft'->'rows'->0->'catalogRequest','null'::jsonb)='null'::jsonb
   ))),false)
$$;
revoke all on function public.tenbot_execution_original_ready(boolean) from public,anon,authenticated,service_role,tenbot_invoice_executor;

create function public.tenbot_execution_window_immutable() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if tg_op='DELETE' then raise exception 'Execution-only window evidence is immutable.' using errcode='23514';end if;
 if (to_jsonb(new)-array['enabled','starts_at','expires_at','bound_grant_id','armed_at','bound_at','disabled_at']) is distinct from (to_jsonb(old)-array['enabled','starts_at','expires_at','bound_grant_id','armed_at','bound_at','disabled_at'])
  or (old.starts_at is not null and (new.starts_at is distinct from old.starts_at or new.expires_at is distinct from old.expires_at))
  or (old.starts_at is not null and not old.enabled and new.enabled)
  or (old.bound_grant_id is not null and new.bound_grant_id is distinct from old.bound_grant_id) then
  raise exception 'The single-use execution-only window cannot be reset, extended or rebound.' using errcode='23514';
 end if;
 new.armed_at:=old.armed_at;new.bound_at:=old.bound_at;new.disabled_at:=old.disabled_at;
 if old.starts_at is null and new.starts_at is not null then
  if not new.enabled or new.bound_grant_id is not null or new.starts_at<clock_timestamp()-interval '5 seconds' or new.starts_at>clock_timestamp() or new.expires_at<=clock_timestamp() or new.expires_at>new.starts_at+interval '15 minutes'
   or exists(select 1 from public.tenbot_chris_dev_canary_grants where revoked_at is null or executed_draft_id is not null)
   or exists(select 1 from public.tenbot_receival_pilot_employees) or exists(select 1 from public.tenbot_receival_pilot_policy where enabled) or exists(select 1 from public.tenbot_receival_execution_control where execution_enabled) then
   raise exception 'Fresh disabled-first execution-only arming required.' using errcode='42501';end if;
  perform 1 from public.app_users where user_id=new.owner_user_id and role='developer' and is_active and not read_only and public.tenbot_canary_user_has_capability(user_id,'readOperationalData') and public.tenbot_canary_user_has_capability(user_id,'writeBusinessData') for share;
  if not found or exists(select 1 from public.app_role_capabilities where role='developer' and capability='adjustInventory') then raise exception 'Exact unchanged Developer baseline required.' using errcode='42501';end if;
  perform 1 from public.invoice_receival_sources where id=new.source_id for share;
  if not public.tenbot_execution_original_ready(true) then raise exception 'Exact existing verified, unapproved preview required.' using errcode='42501';end if;
  if exists(select 1 from public.invoice_receival_document_claims where attachment_sha256=new.document_sha256 or document_key=public.tenbot_invoice_vendor_key('T&M Supply')||':syntendevreceival2026103001') then raise exception 'Synthetic document already claimed.' using errcode='23505';end if;
  new.armed_at:=clock_timestamp();
 end if;
 if old.bound_grant_id is null and new.bound_grant_id is not null then
  if pg_trigger_depth()<2 or not new.enabled or not exists(select 1 from public.tenbot_chris_dev_canary_grants g where g.id=new.bound_grant_id and g.owner_user_id=new.owner_user_id and g.revoked_at is null and g.starts_at>=new.starts_at and g.expires_at<=new.expires_at and g.expires_at>clock_timestamp()) then
   raise exception 'Only the genuine canonical grant activation can bind this window.' using errcode='42501';end if;
  new.bound_at:=clock_timestamp();
 end if;
 if old.enabled and not new.enabled then new.disabled_at:=clock_timestamp();end if;
 return new;
end $$;
revoke all on function public.tenbot_execution_window_immutable() from public,anon,authenticated,service_role,tenbot_invoice_executor;
create trigger tenbot_execution_window_immutable before update or delete on public.tenbot_chris_dev_execution_window
 for each row execute function public.tenbot_execution_window_immutable();

-- Exact predecessor body is pinned above. Legacy inference-funded activation
-- remains byte-identical after the new execution-only branch.
do $bind_execution_window$
declare definition text;old_check text;new_check text;
begin
 definition:=pg_get_functiondef('public.tenbot_bind_canary_funding_grant()'::regprocedure);
 old_check:='declare f public.tenbot_chris_dev_canary_funding; now_at timestamptz;';
 if (length(definition)-length(replace(definition,old_check,'')))/length(old_check)<>1 then raise exception 'Exact grant binder declaration required.';end if;
 definition:=replace(definition,old_check,old_check||' w public.tenbot_chris_dev_execution_window;');
 old_check:=' select * into f from public.tenbot_chris_dev_canary_funding where singleton for update;';
 new_check:=$branch$ select * into w from public.tenbot_chris_dev_execution_window where singleton for update;
 if found and w.enabled then
  now_at:=clock_timestamp();
  if w.starts_at is null or w.starts_at>now_at or w.expires_at<=now_at or w.bound_grant_id is not null
   or new.owner_user_id<>w.owner_user_id or new.starts_at<w.starts_at or new.expires_at>w.expires_at then
   raise exception 'Unused active execution-only window with matching grant lifetime required.' using errcode='42501';end if;
  perform 1 from public.invoice_receival_sources where id=w.source_id for share;
  if not public.tenbot_execution_original_ready(true) then raise exception 'Exact verified preview changed before activation.' using errcode='42501';end if;
  update public.tenbot_chris_dev_execution_window set bound_grant_id=new.id where singleton;
  return new;
 end if;
$branch$||old_check;
 if (length(definition)-length(replace(definition,old_check,'')))/length(old_check)<>1 then raise exception 'Exact legacy funding binder required.';end if;
 execute replace(definition,old_check,new_check);
end $bind_execution_window$;

-- No inference can be authorized by an execution-window-bound grant, even if a
-- stale caller tries the old canary reservation RPC. Settlement is unchanged.
do $deny_execution_inference$
declare definition text;old_check text;new_check text;
begin
 definition:=pg_get_functiondef('public.tenbot_openai_canary_reserve(uuid,uuid,uuid,text,bigint,text,uuid,uuid)'::regprocedure);
 old_check:=' if p_user is distinct from ''3785f6b9-742e-452f-af6c-31613a983633''::uuid';
 new_check:=$deny$ if exists(select 1 from public.tenbot_chris_dev_execution_window where bound_grant_id=p_grant_id) then
  raise exception 'Execution-only authorization never permits inference.' using errcode='42501';end if;
$deny$||old_check;
 if (length(definition)-length(replace(definition,old_check,'')))/length(old_check)<>1 then raise exception 'Exact canary reservation scope check required.';end if;
 execute replace(definition,old_check,new_check);
end $deny_execution_inference$;

create function public.tenbot_close_execution_window_on_revoke() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if old.revoked_at is null and new.revoked_at is not null then
  update public.tenbot_chris_dev_execution_window set enabled=false where bound_grant_id=new.id and enabled;
 end if;
 return new;
end $$;
revoke all on function public.tenbot_close_execution_window_on_revoke() from public,anon,authenticated,service_role,tenbot_invoice_executor;
create trigger tenbot_close_execution_window_on_revoke after update of revoked_at on public.tenbot_chris_dev_canary_grants
 for each row execute function public.tenbot_close_execution_window_on_revoke();

-- Preserve all canonical guards; narrow only operations using the new window.
create function public.tenbot_guard_execution_only_operation() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare w public.tenbot_chris_dev_execution_window;g public.tenbot_chris_dev_canary_grants;target uuid;
begin
 if new.owner_user_id<>'3785f6b9-742e-452f-af6c-31613a983633'::uuid then return new;end if;
 g:=public.tenbot_active_chris_dev_canary_grant(new.owner_user_id);
 select * into w from public.tenbot_chris_dev_execution_window where bound_grant_id=g.id for share;
 if not found then return new;end if;
 if not w.enabled or w.starts_at>clock_timestamp() or w.expires_at<=clock_timestamp() or g.expires_at>w.expires_at then raise exception 'Execution-only window is closed.' using errcode='42501';end if;
 if tg_table_name='invoice_receival_drafts' then
  if not public.tenbot_execution_original_ready(false) then raise exception 'The exact verified source evidence changed.' using errcode='42501';end if;
 elsif tg_table_name='invoice_receival_source_bindings' then
  if new.source_id<>w.source_id or new.original_sha256<>w.document_sha256 or new.evidence_sha256<>w.source_evidence_sha256 then raise exception 'Exact approved source binding required.' using errcode='42501';end if;
 else
  target:=new.draft_id;
  if not exists(select 1 from public.invoice_receival_source_bindings b where b.draft_id=target and b.owner_user_id=w.owner_user_id and b.source_id=w.source_id and b.original_sha256=w.document_sha256 and b.evidence_sha256=w.source_evidence_sha256) then raise exception 'Exact canonical source-bound review required.' using errcode='42501';end if;
 end if;
 return new;
end $$;
revoke all on function public.tenbot_guard_execution_only_operation() from public,anon,authenticated,service_role,tenbot_invoice_executor;
create trigger invoice_execution_only_draft before insert on public.invoice_receival_drafts for each row execute function public.tenbot_guard_execution_only_operation();
create trigger invoice_execution_only_binding before insert on public.invoice_receival_source_bindings for each row execute function public.tenbot_guard_execution_only_operation();
create trigger invoice_execution_only_approval before insert on public.invoice_receival_approvals for each row execute function public.tenbot_guard_execution_only_operation();
create trigger invoice_execution_only_permit before insert or update on public.invoice_receival_execution_permits for each row execute function public.tenbot_guard_execution_only_operation();
create trigger invoice_execution_only_execution before insert on public.invoice_receival_executions for each row execute function public.tenbot_guard_execution_only_operation();

create function public.get_tenbot_chris_dev_execution_window_status() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_users;w public.tenbot_chris_dev_execution_window;
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null then raise exception 'Genuine authorized caller required.' using errcode='42501';end if;
 select * into actor from public.app_users where user_id=auth.uid();
 if actor.user_id is null or not actor.is_active or actor.read_only or not(
  actor.role='admin' and public.has_app_capability('manageRolesPermissions')
  or actor.user_id='3785f6b9-742e-452f-af6c-31613a983633' and actor.role='developer' and public.has_app_capability('readOperationalData') and public.has_app_capability('writeBusinessData')) then
  raise exception 'Authorized Admin or fixed development owner required.' using errcode='42501';end if;
 select * into strict w from public.tenbot_chris_dev_execution_window where singleton;
 return jsonb_build_object('schemaVersion','tenbot-canary-execution.v1','serverNow',clock_timestamp(),'enabled',w.enabled,'startsAt',w.starts_at,'expiresAt',w.expires_at,'ownerId',w.owner_user_id,'sourceId',w.source_id,'documentSha256',w.document_sha256,'previewRevision',w.preview_revision,'previewHash',w.preview_hash,'sourceEvidenceSha256',w.source_evidence_sha256,'grantId',w.bound_grant_id,'inferenceAllowed',false);
end $$;
revoke all on function public.get_tenbot_chris_dev_execution_window_status() from public,anon,authenticated,service_role,tenbot_invoice_executor;
grant execute on function public.get_tenbot_chris_dev_execution_window_status() to authenticated;

notify pgrst,'reload schema';
commit;
