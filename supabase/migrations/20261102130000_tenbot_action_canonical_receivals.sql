-- LOCAL FORWARD CANDIDATE. Requires isolated validation and separate Product
-- application/activation approval. Extends accepted 120000 without editing it.
-- No employee role/capability changes, pilot activation or funding changes.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

do $preflight$ begin
 if to_regclass('public.tenbot_reviewed_actions') is null
  or to_regprocedure('public.tenbot_action_require_verified_owner(uuid,uuid,text)') is null
  or to_regprocedure('public.prepare_invoice_receival_draft_with_source(uuid,jsonb,jsonb,jsonb,jsonb)') is null
  or to_regprocedure('public.approve_invoice_receival_draft(uuid,text,text)') is null
  or to_regprocedure('public.tenbot_receival_mint_execution_permit(uuid,uuid,text,uuid,text)') is null
  or to_regprocedure('public.execute_invoice_receival_draft(uuid,text,uuid)') is null
  or to_regclass('public.invoice_receival_source_bindings') is null then
  raise exception 'Accepted reviewed-action and canonical original/permit contracts required.';
 end if;
 if pg_get_userbyid((select proowner from pg_proc where oid='public.execute_invoice_receival_draft(uuid,text,uuid)'::regprocedure))<>'tenbot_invoice_executor'
  or not exists(select 1 from pg_roles where rolname='tenbot_invoice_executor' and not rolcanlogin and not rolsuper and not rolbypassrls) then
  raise exception 'Unchanged non-bypass canonical receival executor required.';
 end if;
end $preflight$;

-- Enablement becomes reviewable, never implicit: the existing row stays OFF.
alter table public.tenbot_action_control drop constraint tenbot_action_control_receivals_enabled_check;

create table public.tenbot_reviewed_receival_stages(
 action_id uuid primary key references public.tenbot_reviewed_actions(id),
 owner_id uuid not null references public.app_users(user_id),
 source_id uuid not null references public.invoice_receival_sources(id),
 draft_id uuid not null unique references public.invoice_receival_drafts(id),
 approval_id uuid not null unique references public.invoice_receival_approvals(id),
 content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp()
);
create table public.tenbot_reviewed_action_dispatches(
 action_id uuid primary key references public.tenbot_reviewed_actions(id),
 owner_id uuid not null references public.app_users(user_id),
 session_id uuid not null,
 revision integer not null check(revision>0),
 content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
 transaction_id bigint not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table public.tenbot_reviewed_receival_stages enable row level security;
alter table public.tenbot_reviewed_action_dispatches enable row level security;
revoke all on public.tenbot_reviewed_receival_stages,public.tenbot_reviewed_action_dispatches from public,anon,authenticated,service_role;
create function public.tenbot_action_receival_metadata_immutable() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin raise exception 'Reviewed execution metadata is immutable.' using errcode='42501';end $$;
create trigger tenbot_action_receival_stage_immutable before update or delete on public.tenbot_reviewed_receival_stages for each row execute function public.tenbot_action_receival_metadata_immutable();
create trigger tenbot_action_dispatch_immutable before update or delete on public.tenbot_reviewed_action_dispatches for each row execute function public.tenbot_action_receival_metadata_immutable();

create or replace function public.tenbot_action_card(p_action public.tenbot_reviewed_actions,p_viewer_session_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare available boolean;
begin
 select case p_action.operation when 'proposal.save_draft' then proposal_enabled else receivals_enabled end into available from public.tenbot_action_control where singleton;
 available:=coalesce(available,false) and p_action.revoked_at is null and p_action.completed_at is null and p_action.failed_at is null and p_action.password_verified_at is null and p_action.expires_at>clock_timestamp()
  and p_action.prepare_session_id=p_viewer_session_id and public.tenbot_action_session_live(p_action.owner_id,p_viewer_session_id)
  and p_action.permission_version=public.tenbot_action_permission_version(p_action.owner_id)
  and not exists(select 1 from jsonb_array_elements(p_action.intent->'review'->'issues') x where x->'blocking'='true'::jsonb);
 return jsonb_build_object('kind','proposed_action','contract','tenbot.actions.v1','reference',jsonb_build_object('id',p_action.id,'revision',p_action.revision,'hash',p_action.content_hash,'expiresAt',p_action.expires_at),
  'operation',p_action.operation,'review',p_action.intent->'review','confirmation',jsonb_build_object('kind','account_password','available',available));
end $$;

create or replace function public.stamp_tenbot_action_password(p_owner uuid,p_action_id uuid,p_revision integer,p_expected_hash text,p_original_session_id uuid,p_execution_session_id uuid,p_aal text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='3s' set statement_timeout='10s' as $$
declare action public.tenbot_reviewed_actions;control public.tenbot_action_control;verified_at timestamptz;
begin
 if auth.role() is distinct from 'service_role' or p_aal is distinct from 'aal1' or p_original_session_id is null or p_execution_session_id is null or p_original_session_id=p_execution_session_id then raise exception 'Trusted password verification required.' using errcode='42501';end if;
 select * into action from public.tenbot_reviewed_actions where id=p_action_id and owner_id=p_owner;
 if action.id is null then raise exception 'Exact owned review required.' using errcode='42501';end if;
 -- Match actor/capability/control/access-before-action lock order.
 perform public.tenbot_action_require_verified_owner(p_owner,p_original_session_id,action.operation);
 select * into control from public.tenbot_action_control where singleton for share;
 select * into action from public.tenbot_reviewed_actions where id=p_action_id and owner_id=p_owner for update;
 if action.revision is distinct from p_revision or action.content_hash is distinct from p_expected_hash or action.prepare_session_id<>p_original_session_id or action.password_verified_at is not null or action.completed_at is not null or action.failed_at is not null or action.revoked_at is not null or action.expires_at<=clock_timestamp()
  or action.permission_version<>public.tenbot_action_permission_version(p_owner) or not public.tenbot_action_session_live(p_owner,p_execution_session_id)
  or not exists(select 1 from public.tenbot_conversations where id=action.conversation_id and owner_id=p_owner and expires_at>clock_timestamp())
  or exists(select 1 from jsonb_array_elements(action.intent->'review'->'issues') x where x->'blocking'='true'::jsonb)
  or control.singleton is distinct from true or not(case action.operation when 'proposal.save_draft' then control.proposal_enabled else control.receivals_enabled end) then raise exception 'Fresh exact reviewed authorization required.' using errcode='42501';end if;
 verified_at:=clock_timestamp();
 update public.tenbot_reviewed_actions set execution_session_id=p_execution_session_id,password_verified_at=verified_at,authorization_expires_at=least(verified_at+interval '2 minutes',expires_at),authorization_policy_version=control.policy_version where id=action.id;
 return jsonb_build_object('id',action.id,'hash',action.content_hash,'authorized',true);
end $$;

create or replace function public.tenbot_action_require_authorized(p_action public.tenbot_reviewed_actions) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare session_id uuid;control public.tenbot_action_control;
begin
 session_id:=public.tenbot_action_require_employee(p_action.operation);
 select * into control from public.tenbot_action_control where singleton for share;
 if p_action.owner_id is distinct from auth.uid() or p_action.execution_session_id is distinct from session_id or p_action.password_verified_at is null or p_action.authorization_consumed_at is not null or p_action.failed_at is not null or p_action.revoked_at is not null or p_action.expires_at<=clock_timestamp() or p_action.authorization_expires_at<=clock_timestamp()
  or p_action.permission_version<>public.tenbot_action_permission_version(auth.uid()) or p_action.authorization_policy_version is distinct from control.policy_version
  or control.singleton is distinct from true or not(case p_action.operation when 'proposal.save_draft' then control.proposal_enabled else control.receivals_enabled end)
  or not exists(select 1 from public.tenbot_conversations where id=p_action.conversation_id and owner_id=auth.uid() and expires_at>clock_timestamp()) then raise exception 'Fresh exact account confirmation required.' using errcode='42501';end if;
end $$;

-- Metadata stage only, after the exact account-password stamp. Canonical
-- original, quantity, catalog and duplicate validation is not duplicated.
-- A surviving stage after a lost response is not a committed business action.
create function public.stage_tenbot_reviewed_receivals(p_action_id uuid,p_revision integer,p_expected_hash text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='3s' set statement_timeout='15s' as $$
declare action public.tenbot_reviewed_actions;stage public.tenbot_reviewed_receival_stages;p jsonb;draft jsonb;approval jsonb;line jsonb;reviewed jsonb;line_index bigint;
begin
 select * into action from public.tenbot_reviewed_actions where id=p_action_id and owner_id=auth.uid();
 if action.id is null or action.operation<>'inventory.create_pending_receivals' then raise exception 'Owned exact receival action required.' using errcode='42501';end if;
 perform public.tenbot_action_require_employee(action.operation);
 select * into action from public.tenbot_reviewed_actions where id=p_action_id and owner_id=auth.uid() for update;
 if action.revision is distinct from p_revision or action.content_hash is distinct from p_expected_hash then raise exception 'Exact reviewed receival action required.' using errcode='22023';end if;
 perform public.tenbot_action_require_authorized(action);
 select * into stage from public.tenbot_reviewed_receival_stages where action_id=action.id;
 if stage.action_id is not null then return jsonb_build_object('draftId',stage.draft_id,'hash',stage.content_hash,'approvalId',stage.approval_id);end if;
 p:=action.intent->'parameters';
 begin
  draft:=public.prepare_invoice_receival_draft_with_source((p->>'sourceId')::uuid,p->'document',p->'lines',p->'metadata',p->'provenance');
  -- The canonical snapshot must still describe the material the employee saw.
  -- Same-ID catalog edits after preview cannot silently alter that review.
  for line,line_index in select value,ordinality-1 from jsonb_array_elements(draft->'lines') with ordinality loop
   select x->'value' into reviewed from jsonb_array_elements(action.intent->'review'->'fields') x where x->>'path'='lines.'||line_index::text;
   if reviewed is null or (select count(*) from jsonb_array_elements(action.intent->'review'->'fields') x where x->>'path'='lines.'||line_index::text)<>1
    or btrim(reviewed->>'supplier') is distinct from line->>'vendor' or btrim(reviewed->>'material') is distinct from line->>'material'
    or coalesce(reviewed->>'size','') is distinct from coalesce(line->>'size','') or nullif(reviewed->>'quantity','')::numeric is distinct from (line->>'quantityExpected')::numeric
    or public.tenbot_invoice_unit(reviewed->>'unit') is distinct from line->>'unit' or reviewed->'sourceQuantity' is distinct from line->'sourceQuantity'
    or coalesce(reviewed->>'vendorSku','') is distinct from coalesce(line->'catalogSnapshot'->>'vendor_sku','')
    or nullif(reviewed->'package'->>'quantity','')::numeric is distinct from nullif(line->'quantityBasis'->'perPackage'->>'quantity','')::numeric
    or nullif(reviewed->'package'->>'quantity','') is not null and (public.tenbot_invoice_unit(reviewed->'package'->>'measure') is distinct from line->'quantityBasis'->'perPackage'->>'unit' or public.tenbot_invoice_unit(reviewed->'package'->>'container') is distinct from line->'quantityBasis'->'perPackage'->>'container') then
    raise exception 'Catalog or reviewed material details changed; prepare a new review.' using errcode='22023';
   end if;
  end loop;
  approval:=public.approve_invoice_receival_draft((draft->>'id')::uuid,draft->>'hash','CREATE_REVIEWED_PENDING_RECEIVALS');
  perform public.tenbot_action_require_authorized(action);
  insert into public.tenbot_reviewed_receival_stages(action_id,owner_id,source_id,draft_id,approval_id,content_hash)
  values(action.id,action.owner_id,(p->>'sourceId')::uuid,(draft->>'id')::uuid,(approval->>'id')::uuid,draft->>'hash') returning * into stage;
 exception when others then
  -- Roll back all stage work, permanently invalidate a definitely failed proof.
  update public.tenbot_reviewed_actions set failed_at=clock_timestamp(),failure_code='business_rejected',authorization_consumed_at=clock_timestamp() where id=action.id;
  return jsonb_build_object('contract','tenbot.actions.v1','kind','action_failure','id',action.id,'hash',action.content_hash,'status','failed');
 end;
 return jsonb_build_object('draftId',stage.draft_id,'hash',stage.content_hash,'approvalId',stage.approval_id);
end $$;

-- Authoritative commit guard. Only execute_tenbot_reviewed_action can create
-- the private transaction dispatch. A legacy public RPC, reusable permit,
-- caller header or caller-set GUC cannot manufacture that row. Denial here
-- rolls back the entire canonical transaction, including any Pending rows.
create function public.tenbot_action_guard_receival_execution() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare stage public.tenbot_reviewed_receival_stages;dispatch public.tenbot_reviewed_action_dispatches;action public.tenbot_reviewed_actions;
begin
 select * into stage from public.tenbot_reviewed_receival_stages where draft_id=new.draft_id;
 if stage.action_id is null then return new;end if; -- unrelated legacy flow
 select * into dispatch from public.tenbot_reviewed_action_dispatches where action_id=stage.action_id;
 if dispatch.action_id is null or dispatch.transaction_id<>txid_current() or dispatch.owner_id is distinct from auth.uid()
  or dispatch.session_id is distinct from nullif(auth.jwt()->>'session_id','')::uuid or stage.owner_id is distinct from new.owner_user_id
  or stage.content_hash is distinct from new.content_hash or stage.approval_id is distinct from new.approval_id then
  raise exception 'Exact reviewed action transaction required.' using errcode='42501';
 end if;
 -- The authorized wrapper already holds this action's row lock. A rejected
 -- direct legacy call never waits for an action lock in reverse domain order.
 select * into action from public.tenbot_reviewed_actions where id=stage.action_id;
 if action.id is null or action.operation<>'inventory.create_pending_receivals' or action.owner_id is distinct from stage.owner_id
  or action.revision is distinct from dispatch.revision or action.content_hash is distinct from dispatch.content_hash then raise exception 'Exact reviewed action binding required.' using errcode='42501';end if;
 perform public.tenbot_action_require_authorized(action);
 return new;
end $$;
create trigger tenbot_action_receival_execution_guard before insert on public.invoice_receival_executions for each row execute function public.tenbot_action_guard_receival_execution();

create or replace function public.execute_tenbot_reviewed_action(p_action_id uuid,p_revision integer,p_expected_hash text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='3s' set statement_timeout='20s' as $$
declare action public.tenbot_reviewed_actions;stage public.tenbot_reviewed_receival_stages;p jsonb;proposal_id uuid;result jsonb;server_now timestamptz;
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null then raise exception 'Employee authentication required.' using errcode='42501';end if;
 select * into action from public.tenbot_reviewed_actions where id=p_action_id and owner_id=auth.uid();
 if action.id is null then raise exception 'Owned exact action required.' using errcode='42501';end if;
 perform public.tenbot_action_require_employee(action.operation);
 select * into action from public.tenbot_reviewed_actions where id=p_action_id and owner_id=auth.uid() for update;
 if action.revision is distinct from p_revision or action.content_hash is distinct from p_expected_hash then raise exception 'Exact current action required.' using errcode='22023';end if;
 -- Read-only reconciliation retains canonical per-record/RLS checks. This is
 -- not fresh execution authority and cannot create another set of records.
 if action.completed_at is not null then
  if action.operation='inventory.create_pending_receivals' then
   select * into stage from public.tenbot_reviewed_receival_stages where action_id=action.id;
   perform public.execute_invoice_receival_draft(stage.draft_id,stage.content_hash,stage.approval_id);
  end if;
  return public.tenbot_action_receipt(action,true);
 end if;
 perform public.tenbot_action_require_authorized(action);
 p:=action.intent->'parameters';
 begin
  if action.operation='proposal.save_draft' then
   proposal_id:=public.create_proposal();
   perform public.save_proposal_v2_draft((p->'p_proposal')||jsonb_build_object('id',proposal_id),p->'p_lines',p->'p_estimate_inputs',p->'p_estimate_overrides');
   result:=jsonb_build_object('proposalId',proposal_id,'status','draft','url','/proposals?open='||proposal_id::text);
  elsif action.operation='inventory.create_pending_receivals' then
   select * into stage from public.tenbot_reviewed_receival_stages where action_id=action.id and owner_id=action.owner_id;
   if stage.action_id is null then raise exception 'Exact canonical source review and existing pilot permit required.' using errcode='42501';end if;
   insert into public.tenbot_reviewed_action_dispatches(action_id,owner_id,session_id,revision,content_hash,transaction_id)
   values(action.id,action.owner_id,action.execution_session_id,action.revision,action.content_hash,txid_current());
   -- Unchanged employee-JWT canonical entry point: every original, duplicate,
   -- permission, pilot, enrollment, policy, permit and zero-stock gate remains.
   result:=public.execute_invoice_receival_draft(stage.draft_id,stage.content_hash,stage.approval_id)
    ||jsonb_build_object('onHandChangedByCreation',false,'url','/inventory#pending-receivals');
  else raise exception 'Unsupported reviewed operation.' using errcode='22023';end if;
  perform public.tenbot_action_require_authorized(action);
 exception when others then
  -- Domain writes, dispatch, permit consumption and canonical audit all roll
  -- back in the savepoint; failed action authorization is retained consumed.
  update public.tenbot_reviewed_actions set failed_at=clock_timestamp(),failure_code='business_rejected',authorization_consumed_at=clock_timestamp() where id=action.id;
  return jsonb_build_object('contract','tenbot.actions.v1','kind','action_failure','id',action.id,'hash',action.content_hash,'status','failed');
 end;
 server_now:=clock_timestamp();
 update public.tenbot_reviewed_actions set authorization_consumed_at=server_now,completed_at=server_now,committed_result=result where id=action.id returning * into action;
 return public.tenbot_action_receipt(action,false);
end $$;

revoke all on function public.tenbot_action_receival_metadata_immutable(),public.tenbot_action_guard_receival_execution() from public,anon,authenticated,service_role;
revoke all on function public.stage_tenbot_reviewed_receivals(uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.stage_tenbot_reviewed_receivals(uuid,integer,text) to authenticated;
-- CREATE OR REPLACE preserves accepted owners/ACLs. No business-role grants.
comment on function public.execute_tenbot_reviewed_action(uuid,integer,text) is 'Default-OFF reviewed Proposal/Pending actions. Password/session-bound exact intent; canonical business services, private transaction dispatch and commit guard; durable actual results. No Inventory receiving or Job creation.';
notify pgrst,'reload schema';
commit;
