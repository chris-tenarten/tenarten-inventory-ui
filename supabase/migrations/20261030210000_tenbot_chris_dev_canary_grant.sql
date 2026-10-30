-- Dormant, one-user permission exception for the exact reviewed receival canary.
-- This migration creates no grant, enrollment or activation. It must not be
-- applied to the shared database without separate Product approval.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

do $preflight$ begin
 if (select md5(prosrc) from pg_proc where oid='public.has_app_capability(text)'::regprocedure)
   is distinct from '7e83083b79c3ba2a1b1b3e01c690386d' then
  raise exception 'Reviewed canonical capability function changed; inspect before applying.';
 end if;
 if to_regclass('public.invoice_receival_permission_epochs') is null
  or to_regclass('public.invoice_receival_execution_permits') is null
  or to_regclass('public.invoice_receival_source_bindings') is null then
  raise exception 'Accepted invoice source, permission epoch and pilot contracts required.';
 end if;
end $preflight$;

create table public.tenbot_chris_dev_canary_grants(
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null default '3785f6b9-742e-452f-af6c-31613a983633'
  references public.app_users(user_id)
  check(owner_user_id='3785f6b9-742e-452f-af6c-31613a983633'),
 capability text not null default 'adjustInventory' check(capability='adjustInventory'),
 starts_at timestamptz not null,
 expires_at timestamptz not null,
 activated_by uuid not null references public.app_users(user_id),
 reason text not null check(length(btrim(reason)) between 1 and 500),
 revoked_at timestamptz,
 revoked_by uuid references public.app_users(user_id),
 revoke_reason text,
 approved_draft_id uuid unique references public.invoice_receival_drafts(id),
 executed_draft_id uuid unique references public.invoice_receival_executions(draft_id) deferrable initially deferred,
 check(expires_at>starts_at and expires_at<=starts_at+interval '15 minutes'),
 check((revoked_at is null and revoked_by is null and revoke_reason is null)
   or (revoked_at is not null and revoked_by is not null and length(btrim(revoke_reason)) between 1 and 500)),
 check(executed_draft_id is null or executed_draft_id=approved_draft_id)
);
create table public.tenbot_chris_dev_canary_grant_audit(
 id bigint generated always as identity primary key,
 grant_id uuid not null references public.tenbot_chris_dev_canary_grants(id),
 actor_user_id uuid not null references public.app_users(user_id),
 event text not null check(event in('activated','approval_bound','executed','revoked')),
 details jsonb not null,
 occurred_at timestamptz not null default clock_timestamp()
);
revoke all on public.tenbot_chris_dev_canary_grants,public.tenbot_chris_dev_canary_grant_audit
 from public,anon,authenticated,service_role,tenbot_invoice_executor;
revoke all on sequence public.tenbot_chris_dev_canary_grant_audit_id_seq
 from public,anon,authenticated,service_role,tenbot_invoice_executor;
alter table public.tenbot_chris_dev_canary_grants enable row level security;
alter table public.tenbot_chris_dev_canary_grant_audit enable row level security;

create function public.tenbot_canary_grant_immutable() returns trigger
language plpgsql set search_path=pg_catalog,public as $$
begin
 if tg_op='DELETE' then raise exception 'Canary permission audit cannot be deleted.' using errcode='42501';end if;
 if (to_jsonb(new)-array['revoked_at','revoked_by','revoke_reason','approved_draft_id','executed_draft_id'])
   is distinct from (to_jsonb(old)-array['revoked_at','revoked_by','revoke_reason','approved_draft_id','executed_draft_id'])
  or old.revoked_at is not null and (new.revoked_at,new.revoked_by,new.revoke_reason) is distinct from (old.revoked_at,old.revoked_by,old.revoke_reason)
  or old.approved_draft_id is not null and new.approved_draft_id is distinct from old.approved_draft_id
  or old.executed_draft_id is not null and new.executed_draft_id is distinct from old.executed_draft_id then
  raise exception 'Canary identity, lifetime and prior audit bindings are immutable.' using errcode='42501';
 end if;
 return new;
end $$;
create trigger tenbot_canary_grants_immutable before update or delete on public.tenbot_chris_dev_canary_grants
 for each row execute function public.tenbot_canary_grant_immutable();
create trigger tenbot_canary_grant_audit_immutable before update or delete on public.tenbot_chris_dev_canary_grant_audit
 for each row execute function public.tenbot_invoice_immutable();

-- Private subject-based helper is permission metadata, not a business gateway.
-- No application role may call it with a user-selected subject.
create function public.tenbot_active_chris_dev_canary_grant(p_user uuid)
returns public.tenbot_chris_dev_canary_grants language sql volatile security definer
set search_path=pg_catalog,public as $$
 select g from public.tenbot_chris_dev_canary_grants g
 join public.app_users u on u.user_id=g.owner_user_id
 where p_user='3785f6b9-742e-452f-af6c-31613a983633' and g.owner_user_id=p_user
  and u.role='developer' and u.is_active and not u.read_only
  and g.revoked_at is null and g.starts_at<=clock_timestamp() and g.expires_at>clock_timestamp()
 order by g.starts_at desc,g.id limit 1
$$;
create function public.tenbot_canary_user_has_capability(p_user uuid,p_capability text)
returns boolean language sql volatile security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.app_users u where u.user_id=p_user and u.is_active and
  case when p_capability='postJobUpdate' and u.job_updates_post and not u.read_only then true
   when p_capability='sample_labels.generate' then u.role='admin' or u.sample_labels_generate
   when p_capability='production_blend.manage' then u.role='admin' or u.production_blend_manage
   when u.read_only and p_capability='messaging.write' then u.messaging_write
   when u.read_only and p_capability not in('readOperationalData','viewIntake','previewOperationalDocuments','accessDevelopmentEnvironment') then false
   else exists(select 1 from public.app_role_capabilities c where c.role=u.role and c.capability=p_capability)
    or p_capability='adjustInventory' and (public.tenbot_active_chris_dev_canary_grant(u.user_id)).id is not null
  end)
$$;
-- Keep the SAME function OID: every existing RLS policy follows the canonical
-- permission evaluator. All pre-existing role/profile semantics remain intact.
create or replace function public.has_app_capability(p_capability text)
returns boolean language sql volatile security definer set search_path=pg_catalog,public as $$
 select public.tenbot_canary_user_has_capability(auth.uid(),p_capability)
$$;

create function public.get_my_tenbot_receival_canary_access() returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,public as $$
declare grant_row public.tenbot_chris_dev_canary_grants; now_at timestamptz:=clock_timestamp();
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is distinct from '3785f6b9-742e-452f-af6c-31613a983633'::uuid then
  return jsonb_build_object('active',false,'serverNow',now_at);
 end if;
 grant_row:=public.tenbot_active_chris_dev_canary_grant(auth.uid());
 if grant_row.id is null then return jsonb_build_object('active',false,'serverNow',now_at);end if;
 return jsonb_build_object('active',true,'grantId',grant_row.id,'ownerId',grant_row.owner_user_id,
  'startsAt',grant_row.starts_at,'expiresAt',grant_row.expires_at,'serverNow',now_at,
  'documentSha256','c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a',
  'documentReference','SYN-TENDEV-RECEIVAL-20261030-01','supplier','T&M Supply',
  'catalogSource','standard','catalogId','ba6a3690-0886-4f72-9f86-581bcc1f3b44',
  'quantityExpected','1','unit','Bag');
end $$;

create function public.activate_tenbot_chris_dev_canary_grant(p_expires_at timestamptz,p_reason text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public
set lock_timeout='3s' set statement_timeout='10s' as $$
declare subject public.app_users; result public.tenbot_chris_dev_canary_grants; now_at timestamptz; owner_actor public.app_users;
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null then
  raise exception 'Authenticated permission-managing Admin activation required.' using errcode='42501';
 end if;
 select * into owner_actor from public.app_users where user_id=auth.uid() for share;
 lock table public.app_role_capabilities in share mode;
 if owner_actor.user_id is null or owner_actor.role<>'admin' or not owner_actor.is_active or owner_actor.read_only
  or public.has_app_capability('manageRolesPermissions') is distinct from true then
  raise exception 'Authenticated permission-managing Admin activation required.' using errcode='42501';
 end if;
 select * into subject from public.app_users where user_id='3785f6b9-742e-452f-af6c-31613a983633' for update;
 lock table public.app_role_capabilities in share mode;
 perform pg_advisory_xact_lock(761030,2101);
 now_at:=clock_timestamp();
 if subject.user_id is null or subject.role<>'developer' or not subject.is_active or subject.read_only
  or exists(select 1 from public.app_role_capabilities where role='developer' and capability='adjustInventory')
  or not public.tenbot_canary_user_has_capability(subject.user_id,'readOperationalData')
  or not public.tenbot_canary_user_has_capability(subject.user_id,'writeBusinessData') then
  raise exception 'Exact unchanged Developer baseline required.' using errcode='42501';
 end if;
 if p_expires_at is null or not isfinite(p_expires_at) or p_expires_at<=now_at or p_expires_at>now_at+interval '15 minutes'
  or length(btrim(coalesce(p_reason,''))) not between 1 and 500 then
  raise exception 'Explicit positive lifetime of at most 15 minutes and reason required.' using errcode='22023';
 end if;
 if exists(select 1 from public.tenbot_chris_dev_canary_grants where revoked_at is null)
  or exists(select 1 from public.tenbot_chris_dev_canary_grants where executed_draft_id is not null)
  or exists(select 1 from public.invoice_receival_executions e join public.invoice_receival_drafts d on d.id=e.draft_id
   where e.owner_user_id=subject.user_id and d.payload->'document'->>'sha256'='c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a') then
  raise exception 'A live or completed canary grant already exists; no extension or second execution.' using errcode='23505';
 end if;
 if exists(select 1 from public.tenbot_receival_execution_control where execution_enabled)
  or exists(select 1 from public.tenbot_receival_pilot_policy where enabled)
  or exists(select 1 from public.tenbot_receival_pilot_employees) then
  raise exception 'Activation requires write gates OFF and enrollment empty; it does not enable them.' using errcode='42501';
 end if;
 insert into public.tenbot_chris_dev_canary_grants(starts_at,expires_at,activated_by,reason)
 values(now_at,p_expires_at,auth.uid(),btrim(p_reason)) returning * into result;
 insert into public.invoice_receival_permission_epochs(scope,revision) values('actor:'||subject.user_id,1)
 on conflict(scope) do update set revision=invoice_receival_permission_epochs.revision+1;
 insert into public.tenbot_chris_dev_canary_grant_audit(grant_id,actor_user_id,event,details)
 values(result.id,auth.uid(),'activated',jsonb_build_object('subject',result.owner_user_id,'capability','adjustInventory',
  'startsAt',result.starts_at,'expiresAt',result.expires_at,'reason',result.reason,'rolePreserved','developer',
  'documentSha256','c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a'));
 return result.id;
end $$;

create function public.revoke_tenbot_chris_dev_canary_grant(p_grant_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public
set lock_timeout='3s' set statement_timeout='10s' as $$
declare grant_row public.tenbot_chris_dev_canary_grants; owner_actor public.app_users;
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null then
  raise exception 'Authenticated permission-managing Admin revocation required.' using errcode='42501';
 end if;
 select * into owner_actor from public.app_users where user_id=auth.uid() for share;
 lock table public.app_role_capabilities in share mode;
 if owner_actor.user_id is null or owner_actor.role<>'admin' or not owner_actor.is_active or owner_actor.read_only
  or public.has_app_capability('manageRolesPermissions') is distinct from true then
  raise exception 'Authenticated permission-managing Admin revocation required.' using errcode='42501';
 end if;
 if length(btrim(coalesce(p_reason,''))) not between 1 and 500 then raise exception 'Revocation reason required.' using errcode='22023';end if;
 -- Canonical writes hold this same actor row FOR SHARE. A revoke returning
 -- successfully therefore cannot race a still-authorized new agent commit.
 perform 1 from public.app_users where user_id='3785f6b9-742e-452f-af6c-31613a983633' for update;
 lock table public.app_role_capabilities in share mode;
 perform pg_advisory_xact_lock(761030,2101);
 select * into grant_row from public.tenbot_chris_dev_canary_grants where id=p_grant_id for update;
 if not found then raise exception 'Exact canary grant not found.' using errcode='22023';end if;
 if grant_row.revoked_at is not null then
  return jsonb_build_object('grantId',grant_row.id,'revoked',true,'alreadyRevoked',true);
 end if;
 update public.tenbot_chris_dev_canary_grants set revoked_at=clock_timestamp(),revoked_by=auth.uid(),revoke_reason=btrim(p_reason) where id=grant_row.id;
 insert into public.invoice_receival_permission_epochs(scope,revision) values('actor:'||grant_row.owner_user_id,1)
 on conflict(scope) do update set revision=invoice_receival_permission_epochs.revision+1;
 -- Preserve every permit/audit row. Changed actor/pilot versions invalidate
 -- outstanding permits/approvals; only this employee's enrollment is removed.
 update public.tenbot_receival_execution_control set execution_enabled=false where singleton;
 update public.tenbot_receival_pilot_policy set enabled=false where singleton;
 delete from public.tenbot_receival_pilot_employees where user_id=grant_row.owner_user_id;
 insert into public.tenbot_chris_dev_canary_grant_audit(grant_id,actor_user_id,event,details)
 values(grant_row.id,auth.uid(),'revoked',jsonb_build_object('reason',btrim(p_reason),'subject',grant_row.owner_user_id,
  'approvalAndPermitAuthorityInvalidated',true,'pilotDisabled',true,'rolePreserved','developer'));
 return jsonb_build_object('grantId',grant_row.id,'revoked',true,'alreadyRevoked',false);
end $$;

create function public.tenbot_canary_expiry_limit(p_user uuid) returns timestamptz
language sql volatile security definer set search_path=pg_catalog,public as $$
 select case when p_user='3785f6b9-742e-452f-af6c-31613a983633'
  then coalesce((public.tenbot_active_chris_dev_canary_grant(p_user)).expires_at,'-infinity'::timestamptz)
  else 'infinity'::timestamptz end
$$;

-- Replace only three reviewed role-bundle checks with the SAME effective
-- current-user capability rule. No other business/service implementation is
-- replaced, exposed, or changed. Exact body pins bind the reviewed versions.
do $effective_source_checks$
declare signature text;definition text;old_check text;new_check text;matches integer;expected_body text;
begin
 foreach signature in array array[
  'public.record_invoice_receival_source_state(uuid,uuid,integer,text,jsonb)',
  'public.guard_invoice_receival_original_object()',
  'public.tenbot_receival_mint_execution_permit(uuid,uuid,text,uuid,text)'] loop
  select pg_get_functiondef(to_regprocedure(signature)) into definition;
  if definition is null then raise exception 'Reviewed source/permit function missing: %',signature;end if;
  expected_body:=case
   when signature like '%record_invoice_receival_source_state%' then 'c2bde51e31927b108e3d292b92ba330b'
   when signature like '%guard_invoice_receival_original_object%' then 'd3fac5c6cd8f39a4b2e6e21e932377f3'
   else '9c6ff341fc4c576289c318c7fddb0eed' end;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure(signature)) is distinct from expected_body then
   raise exception 'Reviewed source/permit body changed: %',signature;
  end if;
  if signature like '%mint_execution_permit%' then
   old_check:='not exists(select 1 from public.app_role_capabilities c where c.role=actor.role and c.capability=required)';
   new_check:='not public.tenbot_canary_user_has_capability(actor.user_id,required)';
  else
   old_check:='not exists(select 1 from public.app_role_capabilities c where c.role=actor.role and c.capability=required.capability)';
   new_check:='not public.tenbot_canary_user_has_capability(actor.user_id,required.capability)';
  end if;
  matches:=(length(definition)-length(replace(definition,old_check,'')))/length(old_check);
  if matches<>1 then raise exception 'Reviewed direct permission check changed: %',signature;end if;
  definition:=replace(definition,old_check,new_check);
  if signature like '%mint_execution_permit%' then
   old_check:='least(clock_timestamp()+interval ''2 minutes'',policy.expires_at,draft.expires_at,approval.expires_at)';
   if position(old_check in definition)=0 then raise exception 'Reviewed permit expiry changed.';end if;
   definition:=replace(definition,old_check,'least(clock_timestamp()+interval ''2 minutes'',policy.expires_at,draft.expires_at,approval.expires_at,public.tenbot_canary_expiry_limit(p_user))');
  elsif signature like '%record_invoice_receival_source_state%' then
   old_check:='if not found or source.lifecycle_state not in(''uploading'',''ready'')';
   if position(old_check in definition)=0 then raise exception 'Reviewed source state scope changed.';end if;
   definition:=replace(definition,old_check,
    'if not found or (source.owner_user_id=''3785f6b9-742e-452f-af6c-31613a983633'' and (source.sha256<>''c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a'' or source.content_type<>''application/pdf'' or source.byte_size<>2877)) or source.lifecycle_state not in(''uploading'',''ready'')');
  end if;
  execute definition;
 end loop;
end $effective_source_checks$;

-- Reusing an older owned source must not evade the one-document restriction.
-- Only the permission exception's subject gains this extra restriction; the
-- existing service-only expired/deleting/unretained cleanup branch is kept.
alter policy invoice_sources_owner_read on public.invoice_receival_sources
 using(owner_user_id=auth.uid() and public.has_app_capability('readOperationalData')
  and public.has_app_capability('writeBusinessData') and public.has_app_capability('adjustInventory')
  and (lifecycle_state='retained' or expires_at>clock_timestamp())
  and (owner_user_id<>'3785f6b9-742e-452f-af6c-31613a983633'
   or (sha256='c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a'
    and content_type='application/pdf' and byte_size=2877)));
alter policy invoice_source_bindings_owner_read on public.invoice_receival_source_bindings
 using(owner_user_id=auth.uid() and public.has_app_capability('readOperationalData')
  and public.has_app_capability('writeBusinessData') and public.has_app_capability('adjustInventory')
  and (owner_user_id<>'3785f6b9-742e-452f-af6c-31613a983633'
   or original_sha256='c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a'));
do $original_scope$
declare definition text;old_check text;new_check text;
begin
 if (select md5(prosrc) from pg_proc where oid='public.invoice_receival_original_allowed(text,text)'::regprocedure)
   is distinct from '281666f7af5feb9cd7d29176c4645539' then
  raise exception 'Reviewed original authorization changed; inspect before narrowing.';
 end if;
 select pg_get_functiondef('public.invoice_receival_original_allowed(text,text)'::regprocedure) into definition;
 old_check:='s.owner_user_id=auth.uid() and case p_operation';
 if (length(definition)-length(replace(definition,old_check,'')))/length(old_check)<>1 then
  raise exception 'Exact owner original authorization branch required.';end if;
 new_check:='s.owner_user_id=auth.uid() and (s.owner_user_id<>''3785f6b9-742e-452f-af6c-31613a983633'' or (s.sha256=''c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a'' and s.content_type=''application/pdf'' and s.byte_size=2877)) and case p_operation';
 execute replace(definition,old_check,new_check);
end $original_scope$;

create function public.tenbot_assert_chris_dev_canary_payload(p_owner uuid,p_payload jsonb)
returns void language plpgsql volatile security definer set search_path=pg_catalog,public as $$
declare grant_row public.tenbot_chris_dev_canary_grants; line jsonb;
begin
 if p_owner is distinct from '3785f6b9-742e-452f-af6c-31613a983633'::uuid then return;end if;
 grant_row:=public.tenbot_active_chris_dev_canary_grant(p_owner);
 if grant_row.id is null then raise exception 'Active exact canary permission required.' using errcode='42501';end if;
 if p_payload->'document'->>'sha256' is distinct from 'c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a'
  or p_payload->'document'->>'reference' is distinct from 'SYN-TENDEV-RECEIVAL-20261030-01'
  or public.tenbot_invoice_vendor_key(p_payload->'document'->>'supplier') is distinct from public.tenbot_invoice_vendor_key('T&M Supply')
  or p_payload->'provenance'->>'sourceMediaType' is distinct from 'application/pdf'
  or jsonb_typeof(p_payload->'lines') is distinct from 'array' or jsonb_array_length(p_payload->'lines')<>1 then
  raise exception 'Only the exact approved one-line canary invoice is authorized.' using errcode='42501';
 end if;
 line:=p_payload->'lines'->0;
 if line->>'catalogSource' is distinct from 'standard'
  or line->>'catalogId' is distinct from 'ba6a3690-0886-4f72-9f86-581bcc1f3b44'
  or line->>'quantityExpected' is distinct from '1' or public.tenbot_invoice_unit(line->>'unit') is distinct from 'Bag'
  or line->'newMaterial' is distinct from 'null'::jsonb or line->'productionJobId' is distinct from 'null'::jsonb
  or line->'jobLabel' is distinct from 'null'::jsonb
  or public.tenbot_invoice_vendor_key(line->>'vendor') is distinct from public.tenbot_invoice_vendor_key('T&M Supply')
  or public.tenbot_invoice_text_key(line->>'material') is distinct from 'alaska white'
  or public.tenbot_invoice_text_key(line->>'size') is distinct from '#0'
  or coalesce(line->'sourceQuantity'->>'quantity','') !~ '^1([.]0{1,6})?$'
  or public.tenbot_invoice_unit(line->'sourceQuantity'->>'unit') is distinct from 'Bag'
  or line->'quantityBasis'->>'sourceKind' is distinct from 'package_count'
  or coalesce(line->'quantityBasis'->>'packageCount','') !~ '^1([.]0{1,6})?$'
  or coalesce(line->'quantityBasis'->>'receivalQuantity','') !~ '^1([.]0{1,6})?$'
  or line->'quantityBasis'->>'receivalUnit' is distinct from 'Bag'
  or line->'quantityBasis'->'inventoryStockingUnit' is distinct from 'null'::jsonb then
  raise exception 'Canary is one existing material, 1 Bag, no Job/catalog/stock operation.' using errcode='42501';
 end if;
end $$;

create function public.tenbot_guard_chris_dev_canary_source() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.owner_user_id='3785f6b9-742e-452f-af6c-31613a983633' then
  if auth.role() is distinct from 'authenticated' or auth.uid() is distinct from new.owner_user_id
   or (public.tenbot_active_chris_dev_canary_grant(new.owner_user_id)).id is null
   or new.sha256 is distinct from 'c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a'
   or new.content_type is distinct from 'application/pdf' or new.byte_size<>2877 then
   raise exception 'Only the exact owned approved canary original is authorized.' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
create trigger invoice_chris_dev_canary_source before insert on public.invoice_receival_sources
 for each row execute function public.tenbot_guard_chris_dev_canary_source();

create function public.tenbot_guard_chris_dev_canary_operation() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare grant_row public.tenbot_chris_dev_canary_grants; draft public.invoice_receival_drafts; target uuid; owner_id uuid;
begin
 owner_id:=new.owner_user_id;
 if owner_id is distinct from '3785f6b9-742e-452f-af6c-31613a983633'::uuid then return new;end if;
 -- Actor locking precedes grant locking throughout canonical writes/revocation.
 perform 1 from public.app_users where user_id=owner_id for share;
 if tg_table_name='invoice_receival_drafts' then
  perform public.tenbot_assert_chris_dev_canary_payload(owner_id,new.payload);return new;
 end if;
 target:=new.draft_id;
 select * into draft from public.invoice_receival_drafts where id=target and owner_user_id=owner_id;
 if draft.id is null then raise exception 'Exact owned canary draft required.' using errcode='42501';end if;
 perform public.tenbot_assert_chris_dev_canary_payload(owner_id,draft.payload);
 select * into grant_row from public.tenbot_chris_dev_canary_grants
 where id=(public.tenbot_active_chris_dev_canary_grant(owner_id)).id for update;
 if grant_row.id is null or grant_row.expires_at<=clock_timestamp() then raise exception 'Canary permission expired.' using errcode='42501';end if;
 if tg_table_name='invoice_receival_approvals' then
  if grant_row.approved_draft_id is not null and grant_row.approved_draft_id<>draft.id then
   raise exception 'This grant already bound another immutable approval; revoke and review anew.' using errcode='42501';
  end if;
  if grant_row.approved_draft_id is null then
   update public.tenbot_chris_dev_canary_grants set approved_draft_id=draft.id where id=grant_row.id;
   insert into public.tenbot_chris_dev_canary_grant_audit(grant_id,actor_user_id,event,details)
   values(grant_row.id,owner_id,'approval_bound',jsonb_build_object('draftId',draft.id,'contentHash',draft.content_hash));
  end if;
 elsif tg_table_name='invoice_receival_execution_permits' then
  if grant_row.approved_draft_id is distinct from draft.id or new.expires_at>grant_row.expires_at then
   raise exception 'Exact bound canary approval and grant-bounded permit required.' using errcode='42501';end if;
 elsif tg_table_name='invoice_receival_executions' then
  if grant_row.approved_draft_id is distinct from draft.id or grant_row.executed_draft_id is not null
   or cardinality(new.created_record_ids)<>1 or jsonb_array_length(new.created_catalog_records)<>0 then
   raise exception 'Canary permits exactly one execution and no catalog creation.' using errcode='42501';end if;
  update public.tenbot_chris_dev_canary_grants set executed_draft_id=draft.id where id=grant_row.id;
  insert into public.tenbot_chris_dev_canary_grant_audit(grant_id,actor_user_id,event,details)
  values(grant_row.id,owner_id,'executed',jsonb_build_object('draftId',draft.id,'contentHash',draft.content_hash,'createdRecordIds',to_jsonb(new.created_record_ids)));
 end if;
 return new;
end $$;
create trigger invoice_chris_dev_canary_draft before insert on public.invoice_receival_drafts
 for each row execute function public.tenbot_guard_chris_dev_canary_operation();
create trigger invoice_chris_dev_canary_approval before insert on public.invoice_receival_approvals
 for each row execute function public.tenbot_guard_chris_dev_canary_operation();
create trigger invoice_chris_dev_canary_binding before insert on public.invoice_receival_source_bindings
 for each row execute function public.tenbot_guard_chris_dev_canary_operation();
create trigger invoice_chris_dev_canary_permit before insert or update on public.invoice_receival_execution_permits
 for each row execute function public.tenbot_guard_chris_dev_canary_operation();
create trigger invoice_chris_dev_canary_execution before insert on public.invoice_receival_executions
 for each row execute function public.tenbot_guard_chris_dev_canary_operation();

-- Expiry is checked again at transaction completion. A write authorized just
-- before expiry cannot sleep past the deadline then commit merely because a
-- cleanup process failed. Retained/expired-source maintenance is not gated.
create function public.tenbot_chris_dev_canary_commit_authorized() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.owner_user_id='3785f6b9-742e-452f-af6c-31613a983633'
  and (public.tenbot_active_chris_dev_canary_grant(new.owner_user_id)).id is null then
  raise exception 'Canary permission expired or was revoked before commit.' using errcode='42501';
 end if;
 return null;
end $$;
create constraint trigger invoice_chris_dev_canary_source_commit after insert on public.invoice_receival_sources
 deferrable initially deferred for each row execute function public.tenbot_chris_dev_canary_commit_authorized();
create constraint trigger invoice_chris_dev_canary_draft_commit after insert on public.invoice_receival_drafts
 deferrable initially deferred for each row execute function public.tenbot_chris_dev_canary_commit_authorized();
create constraint trigger invoice_chris_dev_canary_approval_commit after insert on public.invoice_receival_approvals
 deferrable initially deferred for each row execute function public.tenbot_chris_dev_canary_commit_authorized();
create constraint trigger invoice_chris_dev_canary_permit_commit after insert or update on public.invoice_receival_execution_permits
 deferrable initially deferred for each row execute function public.tenbot_chris_dev_canary_commit_authorized();
create constraint trigger invoice_chris_dev_canary_execution_commit after insert on public.invoice_receival_executions
 deferrable initially deferred for each row execute function public.tenbot_chris_dev_canary_commit_authorized();

revoke all on function public.tenbot_canary_grant_immutable(),public.tenbot_active_chris_dev_canary_grant(uuid),
 public.tenbot_canary_user_has_capability(uuid,text),public.tenbot_canary_expiry_limit(uuid),
 public.tenbot_assert_chris_dev_canary_payload(uuid,jsonb),public.tenbot_guard_chris_dev_canary_source(),
 public.tenbot_guard_chris_dev_canary_operation(),public.tenbot_chris_dev_canary_commit_authorized()
 from public,anon,authenticated,service_role,tenbot_invoice_executor;
revoke all on function public.get_my_tenbot_receival_canary_access(),
 public.activate_tenbot_chris_dev_canary_grant(timestamptz,text),public.revoke_tenbot_chris_dev_canary_grant(uuid,text)
 from public,anon,authenticated,service_role,tenbot_invoice_executor;
grant execute on function public.get_my_tenbot_receival_canary_access(),
 public.activate_tenbot_chris_dev_canary_grant(timestamptz,text),public.revoke_tenbot_chris_dev_canary_grant(uuid,text)
 to authenticated;
notify pgrst,'reload schema';
commit;
