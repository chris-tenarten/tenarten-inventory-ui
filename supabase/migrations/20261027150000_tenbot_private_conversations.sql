-- Local candidate. No hosted application authorized.
-- Separate owner-only assistant history; never reads ordinary Messages/Tasks.
begin;
create table public.tenbot_conversations (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.app_users(user_id),
 version integer not null default 0,
 expires_at timestamptz not null default now()+interval '8 hours'
);
create index on public.tenbot_conversations(owner_id,expires_at);
create table public.tenbot_conversation_turns (
 id bigint generated always as identity primary key,
 conversation_id uuid not null references public.tenbot_conversations(id) on delete cascade,
 owner_id uuid not null references public.app_users(user_id),
 question text not null, answer text not null
);
create index on public.tenbot_conversation_turns(conversation_id,id);
alter table public.tenbot_conversations enable row level security;
alter table public.tenbot_conversation_turns enable row level security;
create policy tenbot_conversation_owner on public.tenbot_conversations for select to authenticated
 using(owner_id=auth.uid() and public.has_app_capability('readOperationalData'));
create policy tenbot_turn_owner on public.tenbot_conversation_turns for select to authenticated
 using(owner_id=auth.uid() and public.has_app_capability('readOperationalData'));
revoke all on public.tenbot_conversations,public.tenbot_conversation_turns from public,anon,authenticated,service_role;

create function public.tenbot_load_conversation(p_conversation_id text default null) returns jsonb
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
 from (select id,question,answer from public.tenbot_conversation_turns where conversation_id=c.id and owner_id=auth.uid() order by id desc limit 2) t;
 return jsonb_build_object('ok',true,'id',c.id,'ownerId',auth.uid(),'version',c.version,'turns',v_turns);
exception when others then return jsonb_build_object('ok',false);
end; $$;

create function public.tenbot_append_conversation_turn(p_user uuid,p_conversation_id text,p_expected_version integer,p_question text,p_answer text) returns boolean
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
 delete from public.tenbot_conversation_turns where conversation_id=c.id and owner_id=p_user
  and id not in(select id from public.tenbot_conversation_turns where conversation_id=c.id and owner_id=p_user order by id desc limit 8);
 return true;
exception when others then return false;
end; $$;

-- Validate before writes and return a non-content-bearing rejection rather
-- than raising a PostgreSQL error that could log the rejected argument values.
create function public.tenbot_feedback_is_valid(p_draft jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog,public as $$
declare k text; v text;
begin
 if jsonb_typeof(p_draft) is distinct from 'object' or octet_length(p_draft::text)>10000 then return false; end if;
 if exists(select 1 from jsonb_object_keys(p_draft) keys(key) where keys.key not in ('capability','problem','desired','module','original','summary','summaryKind','context')) then return false; end if;
 foreach k in array array['capability','problem','desired','module','original','summary','summaryKind','context'] loop
  if jsonb_typeof(p_draft->k) is distinct from 'string' then return false; end if;
  v=p_draft->>k;
  if regexp_replace(v,E'[\n\r\t]','','g') ~ '[[:cntrl:]]' then return false; end if;
 end loop;
 foreach k in array array['capability','problem','desired','module','original'] loop
  if coalesce(length(btrim(p_draft->>k)),0) not between 1 and 1200 then return false; end if;
 end loop;
 if length(p_draft->>'context')>1200 or length(p_draft->>'summary')>800 or p_draft->>'summaryKind' not in ('AI-generated','Employee-written') then return false; end if;
 if p_draft->>'summary' ~* '(https?://|www\.|<[^>]*>|-----BEGIN|\meyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.|\m(sk-|sb_secret_)[A-Za-z0-9_-]{12,}|\m(password|passwd|api[ _-]?key|access[ _-]?token|refresh[ _-]?token|client[ _-]?secret)[[:space:]]*([:=][[:space:]]*[A-Za-z0-9_/-]{8,}|[[:space:]]+[A-Za-z0-9]*[-_/][A-Za-z0-9_/-]{6,}))' then return false; end if;
 return true;
exception when others then return false;
end; $$;
revoke all on function public.tenbot_feedback_is_valid(jsonb) from public,anon,authenticated,service_role;

create or replace function public.tenbot_submit_feedback(p_draft jsonb,p_confirmed boolean) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid; v_name text;
begin
 if not public.has_app_capability('readOperationalData') or p_confirmed is distinct from true or not public.tenbot_feedback_is_valid(p_draft) then return null; end if;
 perform pg_advisory_xact_lock(hashtextextended('tenbot-feedback:'||auth.uid()::text,0));
 if (select count(*) from public.tenbot_feedback where submitter_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then return null; end if;
 select display_name into v_name from public.app_users where user_id=auth.uid() and is_active;
 if not found then return null; end if;
 insert into public.tenbot_feedback(submitter_id,submitter_name,draft) values(auth.uid(),v_name,p_draft) returning id into v_id;
 insert into public.tenbot_feedback_history(feedback_id,actor_id,status) values(v_id,auth.uid(),'New');
 return v_id;
exception when others then return null;
end; $$;

create or replace function public.tenbot_list_feedback(p_status text default '',p_module text default '') returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not public.has_app_capability('manageUsers') or p_status is null or p_module is null or length(p_status)>80 or length(p_module)>120 then return '[]'::jsonb; end if;
 return (select coalesce(jsonb_agg(to_jsonb(f)||jsonb_build_object('history',(select coalesce(jsonb_agg(h order by h.id),'[]') from public.tenbot_feedback_history h where h.feedback_id=f.id))),'[]') from
 (select * from public.tenbot_feedback where (p_status='' or status=p_status) and (p_module='' or draft->>'module'=p_module) order by created_at desc limit 100) f);
exception when others then return '[]'::jsonb;
end; $$;

create or replace function public.tenbot_review_feedback(p_id uuid,p_status text,p_note text default '') returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not public.has_app_capability('manageUsers') or p_status is null or p_status not in ('New','Needs Clarification','Under Consideration','Backlogged','Declined','Shipped') or p_note is null or length(p_note)>1200 then return; end if;
 update public.tenbot_feedback set status=p_status where id=p_id;
 if not found then return; end if;
 insert into public.tenbot_feedback_history(feedback_id,actor_id,status,note) values(p_id,auth.uid(),p_status,p_note);
exception when others then return;
end; $$;

create function public.tenbot_clear_conversation(p_conversation_id text) returns boolean
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not public.has_app_capability('readOperationalData') or p_conversation_id is null or p_conversation_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
 delete from public.tenbot_conversations where id=p_conversation_id::uuid and owner_id=auth.uid();
 return found;
exception when others then return false;
end; $$;
alter function public.tenbot_load_conversation(text) owner to postgres;
alter function public.tenbot_append_conversation_turn(uuid,text,integer,text,text) owner to postgres;
alter function public.tenbot_clear_conversation(text) owner to postgres;
revoke all on function public.tenbot_load_conversation(text),public.tenbot_clear_conversation(text) from public,anon,service_role;
grant execute on function public.tenbot_load_conversation(text),public.tenbot_clear_conversation(text) to authenticated;
revoke all on function public.tenbot_append_conversation_turn(uuid,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.tenbot_append_conversation_turn(uuid,text,integer,text,text) to service_role;
commit;
