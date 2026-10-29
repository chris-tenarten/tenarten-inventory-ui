-- Focused hosted read-only TenBot candidate. DO NOT APPLY without review.
-- Extends existing private assistant conversations; not a general memory store.
begin;
create table public.tenbot_agent_history (
 conversation_id uuid primary key references public.tenbot_conversations(id) on delete cascade,
 owner_id uuid not null references public.app_users(user_id),
 state jsonb not null default '{"guidance":[],"display":[]}'::jsonb,
 expires_at timestamptz not null default clock_timestamp()+interval '1 hour',
 claim_token uuid,
 claim_until timestamptz,
 constraint tenbot_agent_history_size check(octet_length(state::text)<=64000),
 constraint tenbot_agent_claim_pair check((claim_token is null)=(claim_until is null))
);
alter table public.tenbot_agent_history enable row level security;
-- No direct reads/writes, including service_role. Only narrowly scoped RPCs.
revoke all on public.tenbot_agent_history from public,anon,authenticated,service_role;
create policy tenbot_agent_history_owner on public.tenbot_agent_history for select to authenticated
 using(owner_id=auth.uid() and expires_at>clock_timestamp() and public.has_app_capability('readOperationalData'));

create function public.tenbot_agent_proofs_valid(p_proofs jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog,public as $$
declare p jsonb;
begin
 if jsonb_typeof(p_proofs) is distinct from 'array' or jsonb_array_length(p_proofs)>12 then return false;end if;
 for p in select value from jsonb_array_elements(p_proofs) loop
  if jsonb_typeof(p) is distinct from 'object' or (select count(*) from jsonb_object_keys(p))<>2
   or not(p ?& array['id','digest']) or jsonb_typeof(p->'id') is distinct from 'string' or length(p->>'id') not between 1 and 160
   or jsonb_typeof(p->'digest') is distinct from 'string' or p->>'digest' !~ '^[a-f0-9]{64}$' then return false;end if;
 end loop;
 return true;
exception when others then return false;
end; $$;
create function public.tenbot_agent_state_valid(p_state jsonb,p_conversation_id uuid) returns boolean
language plpgsql immutable set search_path=pg_catalog,public as $$
declare t jsonb;a jsonb;
begin
 if jsonb_typeof(p_state) is distinct from 'object' or octet_length(p_state::text)>64000
  or (select count(*) from jsonb_object_keys(p_state))<>2 or not(p_state ?& array['guidance','display'])
  or jsonb_typeof(p_state->'guidance') is distinct from 'array' or jsonb_array_length(p_state->'guidance')>3
  or jsonb_typeof(p_state->'display') is distinct from 'array' or jsonb_array_length(p_state->'display')>8 then return false;end if;
 for t in select value from jsonb_array_elements(p_state->'guidance') loop
  if jsonb_typeof(t) is distinct from 'object' or (select count(*) from jsonb_object_keys(t))<>3
   or not(t ?& array['question','answer','sources']) or jsonb_typeof(t->'question') is distinct from 'string' or length(t->>'question') not between 1 and 1200
   or jsonb_typeof(t->'answer') is distinct from 'string' or length(t->>'answer') not between 1 and 2400
   or not public.tenbot_agent_proofs_valid(t->'sources') or jsonb_array_length(t->'sources')<1 then return false;end if;
 end loop;
 for t in select value from jsonb_array_elements(p_state->'display') loop
  if jsonb_typeof(t) is distinct from 'object' or (select count(*) from jsonb_object_keys(t))<>7
   or not(t ?& array['id','question','createdAt','answeredAt','answer','sources','scopeDigest'])
   or jsonb_typeof(t->'id') is distinct from 'string' or t->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or jsonb_typeof(t->'question') is distinct from 'string' or length(t->>'question') not between 1 and 1200
   or jsonb_typeof(t->'createdAt') is distinct from 'string' or jsonb_typeof(t->'answeredAt') is distinct from 'string'
   or t->>'createdAt' !~ '^\d{4}-\d\d-\d\dT' or t->>'answeredAt' !~ '^\d{4}-\d\d-\d\dT'
   or not public.tenbot_agent_proofs_valid(t->'sources') or jsonb_typeof(t->'scopeDigest') is distinct from 'string' or t->>'scopeDigest' !~ '^[a-f0-9]{64}$' then return false;end if;
  perform (t->>'createdAt')::timestamptz,(t->>'answeredAt')::timestamptz;
  a=t->'answer';
  if jsonb_typeof(a) is distinct from 'object' or (select count(*) from jsonb_object_keys(a))<>9
   or not(a ?& array['conversationId','mode','contentScope','message','sources','snapshot','summary','suggestionAllowed','notices'])
   or jsonb_typeof(a->'conversationId') is distinct from 'string' or a->>'conversationId' is distinct from p_conversation_id::text
   or a->>'mode' is distinct from 'assistant' or coalesce(a->>'contentScope','') not in ('workflow','scope')
   or jsonb_typeof(a->'message') is distinct from 'string' or length(a->>'message') not between 1 and 2400
   or a->'sources' is distinct from '[]'::jsonb or a->'notices' is distinct from '[]'::jsonb or a->'summary' is distinct from 'null'::jsonb
   or a->'suggestionAllowed' is distinct from 'false'::jsonb or jsonb_typeof(a->'snapshot') is distinct from 'object'
   or (select count(*) from jsonb_object_keys(a->'snapshot'))<>2 or not((a->'snapshot') ?& array['revision','verifiedAt'])
   or jsonb_typeof(a->'snapshot'->'revision') is distinct from 'string' or length(a->'snapshot'->>'revision') not between 1 and 100
   or jsonb_typeof(a->'snapshot'->'verifiedAt') is distinct from 'string'
   or a->'snapshot'->>'verifiedAt' !~ '^\d{4}-\d\d-\d\dT'
   or a->>'contentScope'='workflow' and jsonb_array_length(t->'sources')<1 then return false;end if;
  perform (a->'snapshot'->>'verifiedAt')::timestamptz;
 end loop;
 return true;
exception when others then return false;
end; $$;

-- A caller can claim only its own conversation. It cannot publish state.
create function public.tenbot_agent_claim(p_conversation_id text default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='2s' as $$
declare c public.tenbot_conversations;s public.tenbot_agent_history;v_claim uuid;
begin
 if not public.has_app_capability('readOperationalData') then return jsonb_build_object('ok',false);end if;
 perform pg_advisory_xact_lock(hashtextextended('tenbot-agent-owner:'||auth.uid()::text,0));
 if not public.has_app_capability('readOperationalData') then return jsonb_build_object('ok',false);end if;
 delete from public.tenbot_conversations c0 where c0.owner_id=auth.uid() and
  (c0.expires_at<=clock_timestamp() or exists(select 1 from public.tenbot_agent_history h where h.conversation_id=c0.id and h.owner_id=auth.uid() and h.expires_at<=clock_timestamp()));
 if p_conversation_id is null then
  if (select count(*) from public.tenbot_conversations where owner_id=auth.uid())>=50 then return jsonb_build_object('ok',false,'reason','limit');end if;
  insert into public.tenbot_conversations(owner_id,expires_at) values(auth.uid(),clock_timestamp()+interval '1 hour') returning * into c;
  insert into public.tenbot_agent_history(conversation_id,owner_id) values(c.id,auth.uid()) returning * into s;
 else
  if p_conversation_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return jsonb_build_object('ok',false);end if;
  select * into c from public.tenbot_conversations where id=p_conversation_id::uuid and owner_id=auth.uid() and expires_at>clock_timestamp() for update;
  if not found then return jsonb_build_object('ok',false);end if;
  select * into s from public.tenbot_agent_history where conversation_id=c.id and owner_id=auth.uid() and expires_at>clock_timestamp() for update;
  if not found then return jsonb_build_object('ok',false);end if;
 end if;
 if not public.has_app_capability('readOperationalData') or c.expires_at<=clock_timestamp() or s.expires_at<=clock_timestamp() then return jsonb_build_object('ok',false);end if;
 if s.claim_until>clock_timestamp() then return jsonb_build_object('ok',false,'reason','busy');end if;
 v_claim=gen_random_uuid();
 update public.tenbot_agent_history set claim_token=v_claim,claim_until=clock_timestamp()+interval '120 seconds' where conversation_id=c.id and owner_id=auth.uid();
 return jsonb_build_object('ok',true,'id',c.id,'ownerId',auth.uid(),'revision',c.version,'claim',v_claim,'expiresAt',least(c.expires_at,s.expires_at));
exception when others then return jsonb_build_object('ok',false);
end; $$;

-- Only the trusted adapter can retrieve prose for fresh source/grant checks.
-- An authenticated client can never retrieve proof-bypassing retained answers.
create function public.tenbot_agent_load(p_user uuid,p_conversation_id uuid,p_claim uuid,p_revision integer) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='2s' as $$
begin
 if p_user is null or not exists(select 1 from public.app_users u join public.app_role_capabilities rc on rc.role=u.role where u.user_id=p_user and u.is_active and rc.capability='readOperationalData') then return null;end if;
 return (select h.state from public.tenbot_agent_history h join public.tenbot_conversations c on c.id=h.conversation_id
  where h.conversation_id=p_conversation_id and h.owner_id=p_user and c.owner_id=p_user and c.version=p_revision
   and h.claim_token=p_claim and h.claim_until>clock_timestamp() and h.expires_at>clock_timestamp() and c.expires_at>clock_timestamp());
exception when others then return null;
end; $$;

-- The trusted Edge adapter supplies only proof-filtered state, never client state.
-- Current account/capability and the exact live claim are checked again at commit.
create function public.tenbot_agent_commit(p_user uuid,p_conversation_id uuid,p_claim uuid,p_revision integer,p_state jsonb,p_renew boolean) returns boolean
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='2s' as $$
declare c public.tenbot_conversations;s public.tenbot_agent_history;
begin
 if p_user is null or p_claim is null or not exists(select 1 from public.app_users u join public.app_role_capabilities rc on rc.role=u.role where u.user_id=p_user and u.is_active and rc.capability='readOperationalData')
  or p_renew is null or not public.tenbot_agent_state_valid(p_state,p_conversation_id) then return false;end if;
 select * into c from public.tenbot_conversations where id=p_conversation_id and owner_id=p_user and expires_at>clock_timestamp() for update;
 if not found or c.version is distinct from p_revision then return false;end if;
 select * into s from public.tenbot_agent_history where conversation_id=c.id and owner_id=p_user and expires_at>clock_timestamp() for update;
 if not found or s.claim_token is null or s.claim_until is null or s.claim_token is distinct from p_claim or s.claim_until<=clock_timestamp()
  or c.expires_at<=clock_timestamp() or s.expires_at<=clock_timestamp() then return false;end if;
 if not exists(select 1 from public.app_users u join public.app_role_capabilities rc on rc.role=u.role where u.user_id=p_user and u.is_active and rc.capability='readOperationalData') then return false;end if;
 update public.tenbot_agent_history set state=p_state,claim_token=null,claim_until=null,
  expires_at=case when p_renew then clock_timestamp()+interval '1 hour' else expires_at end where conversation_id=c.id and owner_id=p_user;
 update public.tenbot_conversations set version=version+1,
  expires_at=case when p_renew then clock_timestamp()+interval '1 hour' else expires_at end where id=c.id and owner_id=p_user;
 return true;
exception when others then return false;
end; $$;
create function public.tenbot_agent_release(p_conversation_id uuid,p_claim uuid,p_revision integer) returns boolean
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='2s' as $$
declare c public.tenbot_conversations;s public.tenbot_agent_history;
begin
 if not public.has_app_capability('readOperationalData') then return false;end if;
 select * into c from public.tenbot_conversations where id=p_conversation_id and owner_id=auth.uid() for update;
 if not found then return true;end if;
 select * into s from public.tenbot_agent_history where conversation_id=c.id and owner_id=auth.uid() for update;
 if not found then return true;end if;
 if not public.has_app_capability('readOperationalData') then return false;end if;
 if c.version=p_revision and s.claim_token=p_claim then
  update public.tenbot_agent_history set claim_token=null,claim_until=null where conversation_id=c.id and owner_id=auth.uid();
  return true;
 end if;
 -- A replaced live lease must not be treated as safely released for fallback.
 return s.claim_token is null;
exception when others then return false;
end; $$;
create function public.tenbot_agent_clear(p_conversation_id uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='2s' as $$
declare c public.tenbot_conversations;s public.tenbot_agent_history;
begin
 if not public.has_app_capability('readOperationalData') then return false;end if;
 select * into c from public.tenbot_conversations where id=p_conversation_id and owner_id=auth.uid() for update;
 if not found then return false;end if;
 select * into s from public.tenbot_agent_history where conversation_id=c.id and owner_id=auth.uid() for update;
 if not found or not public.has_app_capability('readOperationalData') then return false;end if;
 -- Delete, rather than empty state: an in-flight late commit cannot resurrect it.
 delete from public.tenbot_conversations where id=c.id and owner_id=auth.uid();
 return found;
exception when others then return false;
end; $$;

alter function public.tenbot_agent_proofs_valid(jsonb) owner to postgres;
alter function public.tenbot_agent_state_valid(jsonb,uuid) owner to postgres;
alter function public.tenbot_agent_claim(text) owner to postgres;
alter function public.tenbot_agent_load(uuid,uuid,uuid,integer) owner to postgres;
alter function public.tenbot_agent_commit(uuid,uuid,uuid,integer,jsonb,boolean) owner to postgres;
alter function public.tenbot_agent_release(uuid,uuid,integer) owner to postgres;
alter function public.tenbot_agent_clear(uuid) owner to postgres;
revoke all on function public.tenbot_agent_proofs_valid(jsonb),public.tenbot_agent_state_valid(jsonb,uuid),public.tenbot_agent_claim(text),public.tenbot_agent_load(uuid,uuid,uuid,integer),public.tenbot_agent_commit(uuid,uuid,uuid,integer,jsonb,boolean),public.tenbot_agent_release(uuid,uuid,integer),public.tenbot_agent_clear(uuid) from public,anon,authenticated,service_role;
grant execute on function public.tenbot_agent_claim(text),public.tenbot_agent_release(uuid,uuid,integer),public.tenbot_agent_clear(uuid) to authenticated;
grant execute on function public.tenbot_agent_load(uuid,uuid,uuid,integer),public.tenbot_agent_commit(uuid,uuid,uuid,integer,jsonb,boolean) to service_role;
notify pgrst,'reload schema';
commit;
