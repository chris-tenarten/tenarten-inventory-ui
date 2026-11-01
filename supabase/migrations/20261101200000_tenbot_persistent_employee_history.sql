-- Persistent private employee transcript in the existing assistant tables.
-- Local candidate only. Shared application requires separate Product approval.
begin;
alter table public.tenbot_conversations add column persistent boolean not null default false;
create unique index tenbot_employee_conversation_owner on public.tenbot_conversations(owner_id) where persistent;
alter table public.tenbot_conversation_turns add column display_id uuid,add column display_turn jsonb;
create unique index tenbot_employee_display_id on public.tenbot_conversation_turns(conversation_id,display_id) where display_id is not null;
create index tenbot_employee_display_page on public.tenbot_conversation_turns(conversation_id,id desc) where display_id is not null;
alter table public.tenbot_conversation_turns add constraint tenbot_employee_display_pair check((display_id is null)=(display_turn is null));

-- Old ephemeral loaders/appends must neither expire nor trim durable display.
-- Raw archive bodies never become legacy model history (question/answer remain
-- non-content-bearing sentinels for these rows). Explicit owner Clear still works.
create function public.tenbot_preserve_employee_conversation() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if tg_table_name='tenbot_conversations' then
  if new.persistent then new.expires_at:='9999-12-31T00:00:00Z'::timestamptz;end if;
 elsif exists(select 1 from public.tenbot_conversations c where c.id=new.conversation_id and c.persistent) then
  new.expires_at:='9999-12-31T00:00:00Z'::timestamptz;
 end if;
 return new;
end;$$;
revoke all on function public.tenbot_preserve_employee_conversation() from public,anon,authenticated,service_role;
create trigger tenbot_employee_conversation_lifetime before insert or update on public.tenbot_conversations for each row execute function public.tenbot_preserve_employee_conversation();
create trigger tenbot_employee_context_lifetime before insert or update on public.tenbot_agent_history for each row execute function public.tenbot_preserve_employee_conversation();

create or replace function public.tenbot_load_conversation(p_conversation_id text default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare c public.tenbot_conversations; v_turns jsonb;
begin
 if not public.has_app_capability('readOperationalData') then return jsonb_build_object('ok',false); end if;
 -- Only the caller's expired history is retired, never another account's data.
 delete from public.tenbot_conversations where owner_id=auth.uid() and expires_at<=now();
 if p_conversation_id is null then
  if (select count(*) from public.tenbot_conversations where owner_id=auth.uid())>=50 then return jsonb_build_object('ok',false); end if;
  insert into public.tenbot_conversations(owner_id) values(auth.uid()) returning * into c;
 else
  if p_conversation_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return jsonb_build_object('ok',false); end if;
  select * into c from public.tenbot_conversations where id=p_conversation_id::uuid and owner_id=auth.uid() and expires_at>now();
  if not found then return jsonb_build_object('ok',false); end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('question',t.question,'answer',t.answer) order by t.id),'[]') into v_turns
 from (select id,question,answer from public.tenbot_conversation_turns where conversation_id=c.id and owner_id=auth.uid() and display_turn is null order by id desc limit 2) t;
 return jsonb_build_object('ok',true,'id',c.id,'ownerId',auth.uid(),'version',c.version,'turns',v_turns);
exception when others then return jsonb_build_object('ok',false);
end; $$;

create or replace function public.tenbot_append_conversation_turn(p_user uuid,p_conversation_id text,p_expected_version integer,p_question text,p_answer text) returns boolean
language plpgsql security definer set search_path=pg_catalog,public as $$
declare c public.tenbot_conversations;
begin
 if p_user is null or not exists(select 1 from public.app_users where user_id=p_user and is_active) or p_conversation_id is null
  or p_conversation_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  or coalesce(length(btrim(p_question)),0) not between 1 and 1200 or coalesce(length(p_answer),0) not between 1 and 1600 then return false; end if;
 select * into c from public.tenbot_conversations where id=p_conversation_id::uuid and owner_id=p_user and expires_at>now() for update;
 if not found or p_expected_version is distinct from c.version then return false; end if;
 insert into public.tenbot_conversation_turns(conversation_id,owner_id,question,answer) values(c.id,p_user,p_question,p_answer);
 update public.tenbot_conversations set version=version+1,expires_at=now()+interval '8 hours' where id=c.id and owner_id=p_user;
 delete from public.tenbot_conversation_turns where conversation_id=c.id and owner_id=p_user and display_turn is null
  and id not in(select id from public.tenbot_conversation_turns where conversation_id=c.id and owner_id=p_user and display_turn is null order by id desc limit 8);
 return true;
exception when others then return false;
end; $$;


create function public.tenbot_employee_display_valid(t jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog,public as $$
declare v jsonb;
begin
 if jsonb_typeof(t) is distinct from 'object' or (select count(*) from jsonb_object_keys(t))<>9
  or not(t ?& array['id','question','message','createdAt','answeredAt','scopeDigest','sources','jobIds','contentScope'])
  or jsonb_typeof(t->'id') is distinct from 'string' or t->>'id' !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  or jsonb_typeof(t->'question') is distinct from 'string' or length(t->>'question') not between 1 and 1200
  or jsonb_typeof(t->'message') is distinct from 'string' or length(t->>'message') not between 1 and 2400
  or jsonb_typeof(t->'scopeDigest') is distinct from 'string' or t->>'scopeDigest' !~ '^[a-f0-9]{64}$'
  or not public.tenbot_agent_proofs_valid(t->'sources')
  or coalesce(t->>'contentScope','') not in ('workflow','scope','operational-history')
  or jsonb_typeof(t->'createdAt') is distinct from 'string' or jsonb_typeof(t->'answeredAt') is distinct from 'string'
  or t->>'createdAt' !~ '^\d{4}-\d\d-\d\dT' or t->>'answeredAt' !~ '^\d{4}-\d\d-\d\dT'
  or jsonb_typeof(t->'jobIds') is distinct from 'array' or jsonb_array_length(t->'jobIds')>1000 then return false;end if;
 if (t->>'createdAt')::timestamptz>(t->>'answeredAt')::timestamptz then return false;end if;
 for v in select value from jsonb_array_elements(t->'jobIds') loop
  if jsonb_typeof(v) is distinct from 'string' or v#>>'{}' !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then return false;end if;
 end loop;
 return octet_length(t::text)<=64000;
exception when others then return false;
end;$$;
revoke all on function public.tenbot_employee_display_valid(jsonb) from public,anon,authenticated,service_role;

-- Caller selects only its own durable thread. Stable discovery does not depend
-- on browser storage or on a previous access token/login. No Admin override.
create function public.tenbot_employee_claim(p_conversation_id text default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='2s' as $$
declare c public.tenbot_conversations;r jsonb;
begin
 if not public.has_app_capability('readOperationalData') then return jsonb_build_object('ok',false);end if;
 perform pg_advisory_xact_lock(hashtextextended('tenbot-agent-owner:'||auth.uid()::text,0));
 select * into c from public.tenbot_conversations where owner_id=auth.uid() and persistent for update;
 if not found then
  -- A supplied legacy locator may be promoted only for its actual owner.
  if p_conversation_id is not null then
   if p_conversation_id !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then return jsonb_build_object('ok',false);end if;
   select * into c from public.tenbot_conversations where id=p_conversation_id::uuid and owner_id=auth.uid() for update;
   if not found then return jsonb_build_object('ok',false);end if;
   update public.tenbot_conversations set persistent=true where id=c.id;
   update public.tenbot_agent_history set expires_at='9999-12-31T00:00:00Z' where conversation_id=c.id;
  else
   insert into public.tenbot_conversations(owner_id,persistent) values(auth.uid(),true) returning * into c;
   insert into public.tenbot_agent_history(conversation_id,owner_id) values(c.id,auth.uid());
  end if;
 elsif p_conversation_id is not null and p_conversation_id<>c.id::text then return jsonb_build_object('ok',false);
 end if;
 insert into public.tenbot_conversation_turns(conversation_id,owner_id,question,answer,display_id,display_turn)
 select c.id,auth.uid(),'[Private historical display]','[Not model context]',(t->>'id')::uuid,
  jsonb_build_object('id',t->>'id','question',t->>'question','message',t->'answer'->>'message','createdAt',t->>'createdAt','answeredAt',t->>'answeredAt','scopeDigest',t->>'scopeDigest','sources',t->'sources','jobIds','[]'::jsonb,'contentScope',t->'answer'->>'contentScope')
 from public.tenbot_agent_history h cross join lateral jsonb_array_elements(h.state->'display') t
 where h.conversation_id=c.id and h.owner_id=auth.uid() and public.tenbot_agent_state_valid(h.state,c.id)
 on conflict(conversation_id,display_id) where display_id is not null do nothing;
 r:=public.tenbot_agent_claim(c.id::text);
 if r->>'ok'='true' then r:=jsonb_set(r,'{expiresAt}',to_jsonb(clock_timestamp()+interval '1 hour'));end if;
 return r;
exception when others then return jsonb_build_object('ok',false);
end;$$;
revoke all on function public.tenbot_employee_claim(text) from public,anon,service_role;
grant execute on function public.tenbot_employee_claim(text) to authenticated;

create function public.tenbot_employee_commit(p_user uuid,p_conversation_id uuid,p_claim uuid,p_revision integer,p_state jsonb,p_renew boolean,p_turn jsonb default null) returns boolean
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='2s' as $$
begin
 if p_turn is not null and not public.tenbot_employee_display_valid(p_turn) then return false;end if;
 if not exists(select 1 from public.tenbot_conversations where id=p_conversation_id and owner_id=p_user and persistent) then return false;end if;
 if not public.tenbot_agent_commit(p_user,p_conversation_id,p_claim,p_revision,p_state,p_renew) then return false;end if;
 if p_turn is not null then
  insert into public.tenbot_conversation_turns(conversation_id,owner_id,question,answer,display_id,display_turn)
   values(p_conversation_id,p_user,'[Private historical display]','[Not model context]',(p_turn->>'id')::uuid,p_turn)
   on conflict(conversation_id,display_id) where display_id is not null do nothing;
 end if;
 return true;
end;$$;
revoke all on function public.tenbot_employee_commit(uuid,uuid,uuid,integer,jsonb,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.tenbot_employee_commit(uuid,uuid,uuid,integer,jsonb,boolean,jsonb) to service_role;

-- Raw transcript is available only inside the trusted display adapter with a
-- current caller-owned claim. Never expose this RPC or raw tables to clients.
create function public.tenbot_employee_page(p_user uuid,p_conversation_id uuid,p_claim uuid,p_revision integer,p_before bigint default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='2s' as $$
declare turns jsonb;cursor text;append_cursor text;
begin
 if not exists(select 1 from public.app_users u join public.app_role_capabilities rc on rc.role=u.role where u.user_id=p_user and u.is_active and rc.capability='readOperationalData')
  or not exists(select 1 from public.tenbot_conversations c join public.tenbot_agent_history h on h.conversation_id=c.id where c.id=p_conversation_id and c.owner_id=p_user and h.owner_id=p_user and c.persistent and c.version=p_revision and h.claim_token=p_claim and h.claim_until>clock_timestamp()) then return null;end if;
 select coalesce(jsonb_agg(display_turn order by id),'[]') into turns from(select id,display_turn from public.tenbot_conversation_turns where conversation_id=p_conversation_id and owner_id=p_user and display_id is not null and (p_before is null or id<p_before) order by id desc limit 20)t;
 select min(id)::text into cursor from(select id from public.tenbot_conversation_turns where conversation_id=p_conversation_id and owner_id=p_user and display_id is not null and (p_before is null or id<p_before) order by id desc limit 20)t;
 if not exists(select 1 from public.tenbot_conversation_turns where conversation_id=p_conversation_id and owner_id=p_user and display_id is not null and id<cursor::bigint) then cursor:=null;end if;
 if jsonb_array_length(turns)=20 then select id::text into append_cursor from(select id from public.tenbot_conversation_turns where conversation_id=p_conversation_id and owner_id=p_user and display_id is not null and (p_before is null or id<p_before) order by id desc limit 20)t order by id offset 1 limit 1;else append_cursor:=cursor;end if;
 return jsonb_build_object('turns',turns,'nextCursor',cursor,'appendCursor',append_cursor);
end;$$;
revoke all on function public.tenbot_employee_page(uuid,uuid,uuid,integer,bigint) from public,anon,authenticated;
grant execute on function public.tenbot_employee_page(uuid,uuid,uuid,integer,bigint) to service_role;

-- Read-only fixed projection under the caller's JWT/RLS. No supplied SQL,
-- service-role gateway, records or business metrics in its response.
create function public.tenbot_authorize_history_jobs(p_ids uuid[]) returns boolean
language plpgsql security invoker set search_path=pg_catalog,public set statement_timeout='4s' as $$
begin
 if not public.has_app_capability('readOperationalData') or p_ids is null or cardinality(p_ids)>1000 then return false;end if;
 if 'cba79566-3fde-4910-9cf6-45687db70b01'::uuid=any(p_ids) and not public.has_app_capability('manageUsers') then return false;end if;
 return (select count(distinct id) from public.jobs where id=any(p_ids))=(select count(distinct x) from unnest(p_ids)x);
end;$$;
revoke all on function public.tenbot_authorize_history_jobs(uuid[]) from public,anon,service_role;
grant execute on function public.tenbot_authorize_history_jobs(uuid[]) to authenticated;
comment on column public.tenbot_conversation_turns.display_turn is 'Private durable employee display only. Edge rechecks owner, current source proofs and caller-visible Job references before each page. Never supplied as inference history.';
notify pgrst,'reload schema';
commit;
