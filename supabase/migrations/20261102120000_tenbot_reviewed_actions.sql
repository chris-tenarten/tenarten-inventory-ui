-- LOCAL REVIEW CANDIDATE, UNAPPLIED. No activation or hosted application is
-- authorized. Reuses existing Auth, permission epochs and domain RPCs; changes
-- no existing roles, capabilities, business functions, policies or pilot gates.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

do $preflight$ begin
 if to_regclass('public.tenbot_conversations') is null
  or to_regclass('public.invoice_receival_permission_epochs') is null
  or to_regclass('auth.sessions') is null
  or to_regprocedure('public.create_proposal()') is null
  or to_regprocedure('public.save_proposal_v2_draft(jsonb,jsonb,jsonb,jsonb)') is null
  or to_regprocedure('public.has_proposal_access()') is null then
  raise exception 'Existing reviewed Auth, conversation and domain contracts required.';
 end if;
end $preflight$;

create table public.tenbot_action_control(
 singleton boolean primary key default true check(singleton),
 proposal_enabled boolean not null default false,
 -- Not activatable: the legacy permit path needs a reviewed canonical
 -- action-linked commit guard and isolated database evidence first.
 receivals_enabled boolean not null default false check(not receivals_enabled),
 policy_version bigint not null default 1 check(policy_version>0)
);
insert into public.tenbot_action_control(singleton) values(true);
create table public.tenbot_reviewed_actions(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.app_users(user_id),
 -- Deliberately no cascading conversation FK: assistant-history retirement
 -- must not erase a committed operation's durable authorization/receipt.
 conversation_id uuid not null,
 prepare_session_id uuid not null,
 revision integer not null check(revision>0),
 supersedes_id uuid unique references public.tenbot_reviewed_actions(id),
 operation text not null check(operation in('proposal.save_draft','inventory.create_pending_receivals')),
 intent jsonb not null check(jsonb_typeof(intent)='object' and octet_length(intent::text)<=120000),
 content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
 permission_version text not null check(permission_version ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 execution_session_id uuid,
 password_verified_at timestamptz,
 authorization_expires_at timestamptz,
 authorization_policy_version bigint,
 authorization_consumed_at timestamptz,
 completed_at timestamptz,
 committed_result jsonb,
 failed_at timestamptz,
 failure_code text check(failure_code='business_rejected'),
 check(expires_at>created_at and expires_at<=created_at+interval '15 minutes'),
 check((password_verified_at is null)=(execution_session_id is null)),
 check((password_verified_at is null)=(authorization_expires_at is null)),
 check((password_verified_at is null)=(authorization_policy_version is null)),
 check(authorization_expires_at is null or (authorization_expires_at>password_verified_at and authorization_expires_at<=password_verified_at+interval '2 minutes' and authorization_expires_at<=expires_at)),
 check((completed_at is null)=(committed_result is null)),
 check((completed_at is null and failed_at is null)=(authorization_consumed_at is null)),
 check((failed_at is null)=(failure_code is null)),
 check(completed_at is null or failed_at is null),
 check(committed_result is null or jsonb_typeof(committed_result)='object')
);
create index on public.tenbot_reviewed_actions(owner_id,conversation_id,created_at);
alter table public.tenbot_action_control enable row level security;
alter table public.tenbot_reviewed_actions enable row level security;
-- No direct content-reading path, including service role. Narrow RPCs only.
revoke all on public.tenbot_action_control,public.tenbot_reviewed_actions from public,anon,authenticated,service_role;

create function public.tenbot_action_control_changed() returns trigger language plpgsql set search_path=pg_catalog as $$
begin new.policy_version:=old.policy_version+1;return new;end $$;
create trigger tenbot_action_control_epoch before update on public.tenbot_action_control for each row execute function public.tenbot_action_control_changed();
create function public.tenbot_action_immutable() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if tg_op='DELETE' then raise exception 'Reviewed action evidence is retained.' using errcode='42501';end if;
 if (to_jsonb(new)-array['revoked_at','execution_session_id','password_verified_at','authorization_expires_at','authorization_policy_version','authorization_consumed_at','completed_at','committed_result','failed_at','failure_code'])
  is distinct from (to_jsonb(old)-array['revoked_at','execution_session_id','password_verified_at','authorization_expires_at','authorization_policy_version','authorization_consumed_at','completed_at','committed_result','failed_at','failure_code'])
  or old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at
  or old.completed_at is not null and new is distinct from old
  or old.failed_at is not null and new is distinct from old
  or old.password_verified_at is not null and (new.execution_session_id,new.password_verified_at,new.authorization_expires_at,new.authorization_policy_version) is distinct from (old.execution_session_id,old.password_verified_at,old.authorization_expires_at,old.authorization_policy_version) then
  raise exception 'Reviewed action is immutable; prepare and confirm a replacement.' using errcode='42501';
 end if;
 return new;
end $$;
create trigger tenbot_reviewed_action_immutable before update or delete on public.tenbot_reviewed_actions for each row execute function public.tenbot_action_immutable();

-- Proposal access is independently configurable. Revoke/regrant must not
-- resurrect an old password proof even when the final allowlist matches.
-- This trigger changes only new action metadata, never business access.
create function public.tenbot_action_proposal_access_changed() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare owners uuid[];
begin
 if tg_op='INSERT' then owners:=array[new.user_id];
 elsif tg_op='DELETE' then owners:=array[old.user_id];
 else owners:=array[old.user_id,new.user_id];end if;
 update public.tenbot_reviewed_actions set revoked_at=clock_timestamp()
 where owner_id=any(owners) and operation='proposal.save_draft' and completed_at is null and failed_at is null and revoked_at is null;
 return null;
end $$;
create trigger tenbot_action_proposal_access_epoch after insert or update or delete on public.proposal_access_users for each row execute function public.tenbot_action_proposal_access_changed();

create function public.tenbot_action_permission_version(p_owner uuid) returns text
language sql stable security definer set search_path=pg_catalog,public as $$
 select encode(sha256(convert_to(p_owner::text||':'||coalesce((select revision::text from public.invoice_receival_permission_epochs where scope='actor:'||p_owner::text),'0')||':'||coalesce((select revision::text from public.invoice_receival_permission_epochs where scope='capabilities'),'0'),'UTF8')),'hex')
$$;
create function public.tenbot_action_session_live(p_owner uuid,p_session uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,auth as $$
 select p_owner is not null and p_session is not null and exists(select 1 from auth.sessions s where s.id=p_session and s.user_id=p_owner
  and (nullif(to_jsonb(s)->>'not_after','') is null or (to_jsonb(s)->>'not_after')::timestamptz>clock_timestamp()))
$$;
create function public.tenbot_action_require_employee(p_operation text) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
declare session_id uuid;
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null then raise exception 'Employee authentication required.' using errcode='42501';end if;
 session_id:=nullif(auth.jwt()->>'session_id','')::uuid;
 if auth.jwt()->>'aal' is distinct from 'aal1' or not public.tenbot_action_session_live(auth.uid(),session_id) then raise exception 'Current password-capable employee session required.' using errcode='42501';end if;
 perform 1 from public.app_users where user_id=auth.uid() and is_active and not read_only for share;
 if not found then raise exception 'Current employee write permission required.' using errcode='42501';end if;
 lock table public.app_role_capabilities in share mode;
 perform 1 from public.tenbot_action_control where singleton for share;
 perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');
 if p_operation='proposal.save_draft' then
  lock table public.proposal_access_users in share mode;
  if not public.has_proposal_access() then raise exception 'Proposal access required.' using errcode='42501';end if;
 elsif p_operation='inventory.create_pending_receivals' then perform public.require_app_capability('adjustInventory');
 else raise exception 'Unsupported reviewed operation.' using errcode='22023';end if;
 return session_id;
end $$;

-- Trusted metadata publication has explicit verified identity; do not install
-- employee claims or impersonate an employee with a service-role JWT/GUC.
create function public.tenbot_action_require_verified_owner(p_owner uuid,p_session_id uuid,p_operation text) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_users;required text;
begin
 if not public.tenbot_action_session_live(p_owner,p_session_id) then raise exception 'Current verified employee session required.' using errcode='42501';end if;
 select * into actor from public.app_users where user_id=p_owner for share;
 lock table public.app_role_capabilities in share mode;
 perform 1 from public.tenbot_action_control where singleton for share;
 lock table public.proposal_access_users in share mode;
 if actor.user_id is null or actor.is_active is distinct from true or actor.read_only is distinct from false then raise exception 'Current employee write permission required.' using errcode='42501';end if;
 foreach required in array array['readOperationalData','writeBusinessData'] loop
  if not exists(select 1 from public.app_role_capabilities where role=actor.role and capability=required) then raise exception 'Current employee write permission required.' using errcode='42501';end if;
 end loop;
 if p_operation='proposal.save_draft' then
  if not(actor.role='admin' or exists(select 1 from public.proposal_access_users where user_id=p_owner)) then raise exception 'Proposal access required.' using errcode='42501';end if;
 elsif p_operation='inventory.create_pending_receivals' then
  if not exists(select 1 from public.app_role_capabilities where role=actor.role and capability='adjustInventory') then raise exception 'Inventory access required.' using errcode='42501';end if;
 else raise exception 'Unsupported reviewed operation.' using errcode='22023';end if;
end $$;

create function public.preview_tenbot_reviewed_action(p_action_id uuid,p_revision integer,p_expected_hash text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='3s' set statement_timeout='5s' as $$
declare action public.tenbot_reviewed_actions;session_id uuid;
begin
 select * into action from public.tenbot_reviewed_actions where id=p_action_id and owner_id=auth.uid();
 if action.id is null or action.revision is distinct from p_revision or action.content_hash is distinct from p_expected_hash or action.operation<>'proposal.save_draft' then raise exception 'Owned exact Proposal review required.' using errcode='42501';end if;
 session_id:=public.tenbot_action_require_employee(action.operation);
 if session_id not in(action.prepare_session_id,coalesce(action.execution_session_id,action.prepare_session_id)) or action.revoked_at is not null or action.failed_at is not null or action.expires_at<=clock_timestamp() or action.permission_version<>public.tenbot_action_permission_version(auth.uid()) then raise exception 'Current exact Proposal review required.' using errcode='42501';end if;
 return action.intent;
end $$;

create function public.tenbot_action_intent_valid(p_intent jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog,public as $$
declare r jsonb;p jsonb;entry jsonb;
begin
 if jsonb_typeof(p_intent) is distinct from 'object' or octet_length(p_intent::text)>120000 or (p_intent-array['operation','parameters','review','sourceReferences'])<>'{}'::jsonb
  or p_intent->>'operation' not in('proposal.save_draft','inventory.create_pending_receivals') or jsonb_typeof(p_intent->'parameters') is distinct from 'object' then return false;end if;
 r:=p_intent->'review';p:=p_intent->'parameters';
 if jsonb_typeof(r) is distinct from 'object' or (r-array['title','summary','consequences','fields','issues','preview'])<>'{}'::jsonb
  or jsonb_typeof(r->'title') is distinct from 'string' or length(r->>'title') not between 1 and 160 or jsonb_typeof(r->'summary') is distinct from 'string' or length(r->>'summary') not between 1 and 1200
  or jsonb_typeof(r->'consequences') is distinct from 'array' or jsonb_array_length(r->'consequences')>12 or jsonb_typeof(r->'fields') is distinct from 'array' or jsonb_array_length(r->'fields')>240
  or jsonb_typeof(r->'issues') is distinct from 'array' or jsonb_array_length(r->'issues')>80 then return false;end if;
 for entry in select value from jsonb_array_elements(r->'consequences') loop if jsonb_typeof(entry)<>'string' or length(entry#>>'{}') not between 1 and 600 then return false;end if;end loop;
 for entry in select value from jsonb_array_elements(r->'fields') loop
  if jsonb_typeof(entry)<>'object' or (entry-array['path','label','value','editable'])<>'{}'::jsonb or not(entry ?& array['path','label','value'])
   or jsonb_typeof(entry->'path') is distinct from 'string' or length(entry->>'path') not between 1 and 200 or jsonb_typeof(entry->'label') is distinct from 'string' or length(entry->>'label') not between 1 and 200
   or entry ? 'editable' and jsonb_typeof(entry->'editable') is distinct from 'boolean' then return false;end if;
 end loop;
 for entry in select value from jsonb_array_elements(r->'issues') loop
  if jsonb_typeof(entry)<>'object' or (entry-array['code','message','blocking'])<>'{}'::jsonb or jsonb_typeof(entry->'code') is distinct from 'string' or length(entry->>'code') not between 1 and 100
   or jsonb_typeof(entry->'message') is distinct from 'string' or length(entry->>'message') not between 1 and 600 or jsonb_typeof(entry->'blocking') is distinct from 'boolean' then return false;end if;
 end loop;
 if r ? 'preview' and (r->'preview'<>'{"kind":"proposal_pdf"}'::jsonb or p_intent->>'operation'<>'proposal.save_draft') then return false;end if;
 if p_intent ? 'sourceReferences' then
  if jsonb_typeof(p_intent->'sourceReferences')<>'array' or jsonb_array_length(p_intent->'sourceReferences')>100 then return false;end if;
  for entry in select value from jsonb_array_elements(p_intent->'sourceReferences') loop
   if jsonb_typeof(entry)<>'object' or (entry-array['kind','id'])<>'{}'::jsonb or jsonb_typeof(entry->'kind') is distinct from 'string' or length(entry->>'kind') not between 1 and 80 or jsonb_typeof(entry->'id') is distinct from 'string' or length(entry->>'id') not between 1 and 200 then return false;end if;
  end loop;
 end if;
 if p_intent->>'operation'='proposal.save_draft' then
  if (p-array['p_proposal','p_lines','p_estimate_inputs','p_estimate_overrides'])<>'{}'::jsonb or not(p ?& array['p_proposal','p_lines','p_estimate_inputs','p_estimate_overrides']) or jsonb_typeof(p->'p_proposal')<>'object' or jsonb_typeof(p->'p_lines')<>'array' or jsonb_array_length(p->'p_lines')>80 or jsonb_typeof(p->'p_estimate_inputs')<>'object' or jsonb_typeof(p->'p_estimate_overrides')<>'object'
   or p->'p_proposal' ?| array['id','job_id','bid_id','status','issued_snapshot','issued_at','issued_by_user_id','lineage_id','estimate_number','created_by_user_id','created_at','updated_at'] then return false;end if;
 else
  if (p-array['sourceId','document','lines','metadata','provenance'])<>'{}'::jsonb or not(p ?& array['sourceId','document','lines','metadata','provenance']) or coalesce(p->>'sourceId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   or jsonb_typeof(p->'document')<>'object' or jsonb_typeof(p->'lines')<>'array' or jsonb_array_length(p->'lines') not between 1 and 80 or jsonb_typeof(p->'metadata')<>'object' or jsonb_typeof(p->'provenance')<>'object' then return false;end if;
 end if;
 return true;
exception when others then return false;
end $$;

create function public.tenbot_action_card(p_action public.tenbot_reviewed_actions,p_viewer_session_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare available boolean;
begin
 select case p_action.operation when 'proposal.save_draft' then proposal_enabled else receivals_enabled end into available from public.tenbot_action_control where singleton;
 available:=coalesce(available,false) and p_action.operation='proposal.save_draft' and p_action.revoked_at is null and p_action.completed_at is null and p_action.failed_at is null and p_action.password_verified_at is null and p_action.expires_at>clock_timestamp()
  and p_action.prepare_session_id=p_viewer_session_id
  and p_action.permission_version=public.tenbot_action_permission_version(p_action.owner_id)
  and not exists(select 1 from jsonb_array_elements(p_action.intent->'review'->'issues') x where x->'blocking'='true'::jsonb);
 return jsonb_build_object('kind','proposed_action','contract','tenbot.actions.v1','reference',jsonb_build_object('id',p_action.id,'revision',p_action.revision,'hash',p_action.content_hash,'expiresAt',p_action.expires_at),
  'operation',p_action.operation,'review',p_action.intent->'review','confirmation',jsonb_build_object('kind','account_password','available',available));
end $$;
create function public.tenbot_action_receipt(p_action public.tenbot_reviewed_actions,p_idempotent boolean) returns jsonb
language sql stable security definer set search_path=pg_catalog,public as $$
 select jsonb_build_object('contract','tenbot.actions.v1','kind','action_result','reference',jsonb_build_object('id',p_action.id,'revision',p_action.revision,'hash',p_action.content_hash,'expiresAt',p_action.expires_at),
  'operation',p_action.operation,'status','completed','idempotent',p_idempotent,'result',p_action.committed_result,'completedAt',p_action.completed_at)
$$;

create function public.prepare_tenbot_reviewed_action(p_owner uuid,p_session_id uuid,p_conversation_id uuid,p_intent jsonb,p_supersedes_id uuid default null,p_supersedes_hash text default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='3s' set statement_timeout='10s' as $$
declare action public.tenbot_reviewed_actions;prior public.tenbot_reviewed_actions;next_revision integer:=1;server_now timestamptz;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Trusted reviewed-operation publication required.' using errcode='42501';end if;
 if not public.tenbot_action_intent_valid(p_intent) then raise exception 'Invalid reviewed operation.' using errcode='22023';end if;
 perform public.tenbot_action_require_verified_owner(p_owner,p_session_id,p_intent->>'operation');
 perform 1 from public.tenbot_conversations where id=p_conversation_id and owner_id=p_owner and expires_at>clock_timestamp() for share;
 if not found then raise exception 'Current owned assistant conversation required.' using errcode='42501';end if;
 if (p_supersedes_id is null) is distinct from (p_supersedes_hash is null) then raise exception 'Exact prior review required.' using errcode='22023';end if;
 if p_supersedes_id is not null then
  select * into prior from public.tenbot_reviewed_actions where id=p_supersedes_id and owner_id=p_owner for update;
  if prior.id is null or prior.content_hash is distinct from p_supersedes_hash or prior.conversation_id<>p_conversation_id or prior.completed_at is not null or prior.revoked_at is not null then raise exception 'Exact current review required.' using errcode='22023';end if;
  if prior.failed_at is null then update public.tenbot_reviewed_actions set revoked_at=clock_timestamp() where id=prior.id;end if;
  next_revision:=prior.revision+1;
 end if;
 server_now:=clock_timestamp();
 insert into public.tenbot_reviewed_actions(owner_id,conversation_id,prepare_session_id,revision,supersedes_id,operation,intent,content_hash,permission_version,created_at,expires_at)
 values(p_owner,p_conversation_id,p_session_id,next_revision,p_supersedes_id,p_intent->>'operation',p_intent,
  encode(sha256(convert_to(jsonb_build_object('contract','tenbot.actions.v1','owner',p_owner,'conversation',p_conversation_id,'session',p_session_id,'revision',next_revision,'intent',p_intent)::text,'UTF8')),'hex'),public.tenbot_action_permission_version(p_owner),server_now,server_now+interval '15 minutes') returning * into action;
 return public.tenbot_action_card(action,p_session_id);
end $$;

create function public.get_tenbot_reviewed_action(p_action_id uuid,p_revision integer,p_expected_hash text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='3s' set statement_timeout='5s' as $$
declare action public.tenbot_reviewed_actions;state text;
begin
 select * into action from public.tenbot_reviewed_actions where id=p_action_id and owner_id=auth.uid();
 if action.id is null or action.revision is distinct from p_revision or action.content_hash is distinct from p_expected_hash then raise exception 'Owned exact action required.' using errcode='42501';end if;
 perform public.tenbot_action_require_employee(action.operation);
 state:=case when action.completed_at is not null then 'completed' when action.revoked_at is not null then 'revoked' when action.failed_at is not null then 'failed' when action.expires_at<=clock_timestamp() or action.authorization_expires_at<=clock_timestamp() then 'expired' when action.password_verified_at is not null then 'authorized' else 'prepared' end;
 return jsonb_build_object('contract','tenbot.actions.v1','card',public.tenbot_action_card(action,nullif(auth.jwt()->>'session_id','')::uuid),'state',state,'receipt',case when action.completed_at is null then null else public.tenbot_action_receipt(action,true) end);
end $$;

create function public.revoke_tenbot_reviewed_action(p_action_id uuid,p_revision integer,p_expected_hash text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='3s' set statement_timeout='5s' as $$
declare action public.tenbot_reviewed_actions;
begin
 select * into action from public.tenbot_reviewed_actions where id=p_action_id and owner_id=auth.uid();
 if action.id is null or action.revision is distinct from p_revision or action.content_hash is distinct from p_expected_hash then raise exception 'Owned exact action required.' using errcode='42501';end if;
 perform public.tenbot_action_require_employee(action.operation);
 select * into action from public.tenbot_reviewed_actions where id=p_action_id and owner_id=auth.uid() for update;
 if action.completed_at is not null then raise exception 'Committed operation cannot be revoked.' using errcode='22023';end if;
 if action.revoked_at is null and action.failed_at is null then update public.tenbot_reviewed_actions set revoked_at=clock_timestamp() where id=action.id;end if;
 return jsonb_build_object('id',action.id,'revoked',true);
end $$;

-- Service role stamps only after isolated Supabase password sign-in. No
-- password/hash is accepted by SQL, and this RPC cannot execute business data.
create function public.stamp_tenbot_action_password(p_owner uuid,p_action_id uuid,p_revision integer,p_expected_hash text,p_original_session_id uuid,p_execution_session_id uuid,p_aal text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='3s' set statement_timeout='10s' as $$
declare action public.tenbot_reviewed_actions;control public.tenbot_action_control;actor public.app_users;required text;verified_at timestamptz;
begin
 if auth.role() is distinct from 'service_role' or p_aal is distinct from 'aal1' or p_original_session_id is null or p_execution_session_id is null or p_original_session_id=p_execution_session_id then raise exception 'Trusted password verification required.' using errcode='42501';end if;
 select * into actor from public.app_users where user_id=p_owner for share;
 lock table public.app_role_capabilities in share mode;
 if actor.user_id is null or actor.is_active is distinct from true or actor.read_only is distinct from false then raise exception 'Current employee write permission required.' using errcode='42501';end if;
 select * into control from public.tenbot_action_control where singleton for share;
 lock table public.proposal_access_users in share mode;
 select * into action from public.tenbot_reviewed_actions where id=p_action_id and owner_id=p_owner for update;
 if action.id is null or action.operation is distinct from 'proposal.save_draft' or action.revision is distinct from p_revision or action.content_hash is distinct from p_expected_hash or action.prepare_session_id<>p_original_session_id or action.password_verified_at is not null or action.completed_at is not null or action.failed_at is not null or action.revoked_at is not null or action.expires_at<=clock_timestamp()
  or action.permission_version<>public.tenbot_action_permission_version(p_owner) or not public.tenbot_action_session_live(p_owner,p_original_session_id) or not public.tenbot_action_session_live(p_owner,p_execution_session_id)
  or not exists(select 1 from public.tenbot_conversations where id=action.conversation_id and owner_id=p_owner and expires_at>clock_timestamp())
  or exists(select 1 from jsonb_array_elements(action.intent->'review'->'issues') x where x->'blocking'='true'::jsonb)
  or control.singleton is distinct from true or not(case action.operation when 'proposal.save_draft' then control.proposal_enabled else control.receivals_enabled end) then raise exception 'Fresh exact reviewed authorization required.' using errcode='42501';end if;
 foreach required in array array['readOperationalData','writeBusinessData'] loop
  if not exists(select 1 from public.app_role_capabilities where role=actor.role and capability=required) then raise exception 'Current employee write permission required.' using errcode='42501';end if;
 end loop;
 if not(actor.role='admin' or exists(select 1 from public.proposal_access_users where user_id=p_owner)) then raise exception 'Current operation permission required.' using errcode='42501';end if;
 verified_at:=clock_timestamp();
 update public.tenbot_reviewed_actions set execution_session_id=p_execution_session_id,password_verified_at=verified_at,authorization_expires_at=least(verified_at+interval '2 minutes',expires_at),authorization_policy_version=control.policy_version where id=action.id;
 return jsonb_build_object('id',action.id,'hash',action.content_hash,'authorized',true);
end $$;

-- Private fixed checker; caller RPCs acquire the action row lock before it.
create function public.tenbot_action_require_authorized(p_action public.tenbot_reviewed_actions) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare session_id uuid;control public.tenbot_action_control;
begin
 session_id:=public.tenbot_action_require_employee(p_action.operation);
 select * into control from public.tenbot_action_control where singleton for share;
 if p_action.operation is distinct from 'proposal.save_draft' or p_action.owner_id is distinct from auth.uid() or p_action.execution_session_id is distinct from session_id or p_action.password_verified_at is null or p_action.authorization_consumed_at is not null or p_action.failed_at is not null or p_action.revoked_at is not null or p_action.expires_at<=clock_timestamp() or p_action.authorization_expires_at<=clock_timestamp()
  or p_action.permission_version<>public.tenbot_action_permission_version(auth.uid()) or p_action.authorization_policy_version is distinct from control.policy_version
  or control.singleton is distinct from true or not(case p_action.operation when 'proposal.save_draft' then control.proposal_enabled else control.receivals_enabled end)
  or not exists(select 1 from public.tenbot_conversations where id=p_action.conversation_id and owner_id=auth.uid() and expires_at>clock_timestamp()) then raise exception 'Fresh exact account confirmation required.' using errcode='42501';end if;
end $$;

create function public.execute_tenbot_reviewed_action(p_action_id uuid,p_revision integer,p_expected_hash text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='3s' set statement_timeout='20s' as $$
declare action public.tenbot_reviewed_actions;p jsonb;proposal_id uuid;result jsonb;server_now timestamptz;
begin
 -- Actor/capability locking precedes action locks, matching canonical invoice
 -- lock order and administrative permission changes.
 if auth.role() is distinct from 'authenticated' or auth.uid() is null then raise exception 'Employee authentication required.' using errcode='42501';end if;
 select * into action from public.tenbot_reviewed_actions where id=p_action_id and owner_id=auth.uid();
 if action.id is null then raise exception 'Owned exact action required.' using errcode='42501';end if;
 if action.operation is distinct from 'proposal.save_draft' then raise exception 'Pending Receival execution requires a separately reviewed canonical authorization bridge.' using errcode='42501';end if;
 perform public.tenbot_action_require_employee(action.operation);
 select * into action from public.tenbot_reviewed_actions where id=p_action_id and owner_id=auth.uid() for update;
 if action.revision is distinct from p_revision or action.content_hash is distinct from p_expected_hash then raise exception 'Exact current action required.' using errcode='22023';end if;
 -- A receipt is historical output, not fresh authorization. Current owner,
 -- live session and business access remain mandatory for recovery reads.
 if action.completed_at is not null then return public.tenbot_action_receipt(action,true);end if;
 perform public.tenbot_action_require_authorized(action);
 p:=action.intent->'parameters';
 begin
 if action.operation='proposal.save_draft' then
  proposal_id:=public.create_proposal();
  perform public.save_proposal_v2_draft((p->'p_proposal')||jsonb_build_object('id',proposal_id),p->'p_lines',p->'p_estimate_inputs',p->'p_estimate_overrides');
  result:=jsonb_build_object('proposalId',proposal_id,'status','draft','url','/proposals?open='||proposal_id::text);
 else raise exception 'Unsupported reviewed operation.' using errcode='22023';end if;
 -- Recheck finite authorization at completion. Any failure rolls back all
 -- business changes and this action's receipt.
 perform public.tenbot_action_require_authorized(action);
 exception when others then
  update public.tenbot_reviewed_actions set failed_at=clock_timestamp(),failure_code='business_rejected',authorization_consumed_at=clock_timestamp() where id=action.id;
  return jsonb_build_object('contract','tenbot.actions.v1','kind','action_failure','id',action.id,'hash',action.content_hash,'status','failed');
 end;
 server_now:=clock_timestamp();
 update public.tenbot_reviewed_actions set authorization_consumed_at=server_now,completed_at=server_now,committed_result=result where id=action.id returning * into action;
 return public.tenbot_action_receipt(action,false);
end $$;

revoke all on function public.tenbot_action_control_changed(),public.tenbot_action_immutable(),public.tenbot_action_proposal_access_changed(),public.tenbot_action_permission_version(uuid),public.tenbot_action_session_live(uuid,uuid),public.tenbot_action_require_employee(text),public.tenbot_action_require_verified_owner(uuid,uuid,text),public.tenbot_action_intent_valid(jsonb),public.tenbot_action_card(public.tenbot_reviewed_actions,uuid),public.tenbot_action_receipt(public.tenbot_reviewed_actions,boolean),public.tenbot_action_require_authorized(public.tenbot_reviewed_actions) from public,anon,authenticated,service_role;
revoke all on function public.prepare_tenbot_reviewed_action(uuid,uuid,uuid,jsonb,uuid,text),public.get_tenbot_reviewed_action(uuid,integer,text),public.preview_tenbot_reviewed_action(uuid,integer,text),public.revoke_tenbot_reviewed_action(uuid,integer,text),public.execute_tenbot_reviewed_action(uuid,integer,text),public.stamp_tenbot_action_password(uuid,uuid,integer,text,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.get_tenbot_reviewed_action(uuid,integer,text),public.preview_tenbot_reviewed_action(uuid,integer,text),public.revoke_tenbot_reviewed_action(uuid,integer,text),public.execute_tenbot_reviewed_action(uuid,integer,text) to authenticated;
grant execute on function public.prepare_tenbot_reviewed_action(uuid,uuid,uuid,jsonb,uuid,text),public.stamp_tenbot_action_password(uuid,uuid,integer,text,uuid,uuid,text) to service_role;
comment on function public.execute_tenbot_reviewed_action(uuid,integer,text) is 'Default-OFF standalone Proposal draft only. Exact password stamp and employee JWT; existing create/save RPCs, atomic actual receipt. Pending Receival execution blocked: legacy permit needs action-linked canonical commit guard. No issuance, receiving, Job creation or dynamic mutation.';
notify pgrst,'reload schema';
commit;
