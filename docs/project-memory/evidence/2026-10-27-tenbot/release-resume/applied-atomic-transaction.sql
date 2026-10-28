begin isolation level repeatable read;
set local search_path=pg_catalog,public;
set local lock_timeout='5s';
set local statement_timeout='90s';
lock table supabase_migrations.schema_migrations in share row exclusive mode;
do $tenbot_preconditions$
declare fn record;
begin
 if current_database()<>'postgres' or current_user<>'postgres' then raise exception 'Unexpected migration execution context'; end if;
 
 if to_regprocedure('public.has_app_capability(text)') is null or md5(pg_get_functiondef(to_regprocedure('public.has_app_capability(text)'))) is distinct from 'ae6b0fa1f2e5e1655b79014a0e50266f' then raise exception 'TenBot predecessor definition drift'; end if;
 select * into strict fn from pg_proc where oid=to_regprocedure('public.has_app_capability(text)');
 if pg_get_userbyid(fn.proowner)<>'postgres' or not fn.prosecdef or fn.proconfig is distinct from array['search_path=pg_catalog, public']::text[]
  or has_function_privilege('anon',fn.oid,'EXECUTE') is distinct from true
  or has_function_privilege('authenticated',fn.oid,'EXECUTE') is distinct from true
  or has_function_privilege('service_role',fn.oid,'EXECUTE') is distinct from true then raise exception 'TenBot predecessor privilege drift'; end if;

 if to_regprocedure('public.has_proposal_access()') is null or md5(pg_get_functiondef(to_regprocedure('public.has_proposal_access()'))) is distinct from 'e3db326eaa5105820560ec6927445ee5' then raise exception 'TenBot predecessor definition drift'; end if;
 select * into strict fn from pg_proc where oid=to_regprocedure('public.has_proposal_access()');
 if pg_get_userbyid(fn.proowner)<>'postgres' or not fn.prosecdef or fn.proconfig is distinct from array['search_path=pg_catalog, public']::text[]
  or has_function_privilege('anon',fn.oid,'EXECUTE') is distinct from false
  or has_function_privilege('authenticated',fn.oid,'EXECUTE') is distinct from true
  or has_function_privilege('service_role',fn.oid,'EXECUTE') is distinct from true then raise exception 'TenBot predecessor privilege drift'; end if;
 if exists(select 1 from supabase_migrations.schema_migrations where version=any(array['20261027120000','20261027130000','20261027140000','20261027150000']::text[])) then raise exception 'TenBot migration already present'; end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'tenbot\_%' escape '\') or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'tenbot\_%' escape '\') or exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and (t.typname like 'tenbot\_%' escape '\' or t.typname like '\_tenbot\_%' escape '\')) then raise exception 'Partial TenBot object state exists'; end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='f') then raise exception 'Public foreign-table tuple preservation needs separate review'; end if;
 if not exists(select 1 from pg_attribute where attrelid='public.app_users'::regclass and attname='user_id' and atttypid='uuid'::regtype and attnotnull and not attisdropped) or not exists(select 1 from pg_attribute where attrelid='public.app_users'::regclass and attname='display_name' and atttypid='text'::regtype and attnotnull and not attisdropped) or not exists(select 1 from pg_attribute where attrelid='public.app_users'::regclass and attname='is_active' and atttypid='boolean'::regtype and attnotnull and not attisdropped) then raise exception 'TenBot user-column prerequisite mismatch'; end if;
 if not exists(select 1 from pg_index i where i.indrelid='public.app_users'::regclass and i.indisunique and i.indisvalid and i.indnkeyatts=1 and (select attname from pg_attribute a where a.attrelid=i.indrelid and a.attnum=i.indkey[0])='user_id') or to_regprocedure('auth.uid()') is null or to_regprocedure('gen_random_uuid()') is null then raise exception 'TenBot UUID/auth/user-key prerequisite mismatch'; end if;
end $tenbot_preconditions$;
create temporary table tenbot_release_ledger_before on commit drop as select * from supabase_migrations.schema_migrations;
create temporary table tenbot_release_metadata_before on commit drop as 
select 'relation'::text kind,c.oid::text identity,md5(jsonb_build_object('name',c.relname,'namespace',c.relnamespace,'kind',c.relkind,'owner',c.relowner,'acl',c.relacl,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'options',c.reloptions,'replica',c.relreplident,'persistence',c.relpersistence,'tablespace',c.reltablespace,'view',case when c.relkind in('v','m') then pg_get_viewdef(c.oid) else null end)::text) digest
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','storage') and not(n.nspname='public' and c.relname like 'tenbot\_%' escape '\')
union all select 'column',a.attrelid::text||':'||a.attnum::text,md5((to_jsonb(a)||jsonb_build_object('default',pg_get_expr(d.adbin,d.adrelid)))::text)
 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where n.nspname in('public','storage') and not(n.nspname='public' and c.relname like 'tenbot\_%' escape '\')
union all select 'function',p.oid::text,md5(to_jsonb(p)::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','storage') and not(n.nspname='public' and p.proname like 'tenbot\_%' escape '\')
union all select 'constraint',k.oid::text,md5((to_jsonb(k)||jsonb_build_object('definition',pg_get_constraintdef(k.oid)))::text) from pg_constraint k join pg_namespace n on n.oid=k.connamespace where n.nspname in('public','storage') and not(k.conrelid in(select c.oid from pg_class c join pg_namespace cn on cn.oid=c.relnamespace where cn.nspname='public' and c.relname=any(array['tenbot_feedback','tenbot_feedback_history','tenbot_usage','tenbot_conversations','tenbot_conversation_turns']::text[])))
union all select 'policy',p.oid::text,md5(to_jsonb(p)::text) from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','storage') and not(n.nspname='public' and c.relname=any(array['tenbot_feedback','tenbot_feedback_history','tenbot_usage','tenbot_conversations','tenbot_conversation_turns']::text[]))
union all select 'trigger',t.oid::text,md5((to_jsonb(t)||jsonb_build_object('definition',pg_get_triggerdef(t.oid)))::text) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','storage') and not(n.nspname='public' and c.relname=any(array['tenbot_feedback','tenbot_feedback_history','tenbot_usage','tenbot_conversations','tenbot_conversation_turns']::text[])) and not(t.tgisinternal and exists(select 1 from pg_constraint fk where fk.oid=t.tgconstraint and fk.contype='f' and fk.conrelid in(select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(array['tenbot_feedback','tenbot_feedback_history','tenbot_usage','tenbot_conversations','tenbot_conversation_turns']::text[])) and fk.confrelid='public.app_users'::regclass))
union all select 'index',i.indexrelid::text,md5((to_jsonb(i)||jsonb_build_object('definition',pg_get_indexdef(i.indexrelid)))::text) from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','storage') and not(n.nspname='public' and c.relname=any(array['tenbot_feedback','tenbot_feedback_history','tenbot_usage','tenbot_conversations','tenbot_conversation_turns']::text[]))
union all select 'type',t.oid::text,md5(to_jsonb(t)::text) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname<>all(array['tenbot_feedback','_tenbot_feedback','tenbot_feedback_history','_tenbot_feedback_history','tenbot_usage','_tenbot_usage','tenbot_conversations','_tenbot_conversations','tenbot_conversation_turns','_tenbot_conversation_turns']::text[])
union all select 'namespace',n.oid::text,md5(jsonb_build_object('name',n.nspname,'owner',n.nspowner,'acl',n.nspacl)::text) from pg_namespace n where n.nspname in('public','storage')
union all select 'default_acl',d.oid::text,md5(to_jsonb(d)::text) from pg_default_acl d
union all select 'role_membership',m.roleid::text||':'||m.member::text||':'||m.grantor::text,md5(to_jsonb(m)::text) from pg_auth_members m
union all select 'event_trigger',e.oid::text,md5(to_jsonb(e)::text) from pg_event_trigger e
union all select 'cron',j.jobid::text,md5(to_jsonb(j)::text) from cron.job j
union all select 'web_push_transport',t.environment::text,md5(to_jsonb(t)::text) from public.web_push_transport t
;

create temporary table tenbot_release_tuples_before(relation_oid oid primary key,relation text,relation_kind text,row_count bigint,tuple_digest text) on commit drop;
do $tuple_snapshot$
declare r record;v_count bigint;v_digest text;
begin
 for r in select c.oid relation_oid,n.nspname schema_name,c.relname relation_name,c.relkind::text relation_kind from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in('r','p','m') order by c.oid loop
  execute format('select count(*),md5(coalesce(string_agg(tuple_tag,E''\n'' order by tuple_tag),'''')) from (select t.tableoid::oid::text||'':''||t.ctid::text||'':''||t.xmin::text tuple_tag from ONLY %I.%I t) physical',r.schema_name,r.relation_name) into v_count,v_digest;
  insert into tenbot_release_tuples_before values(r.relation_oid,r.schema_name||'.'||r.relation_name,r.relation_kind,v_count,v_digest);
 end loop;
end $tuple_snapshot$;


-- Accepted 20261027120000_tenbot_feedback_usage.sql; SHA256 7efbc40a2203124e39f840a6c531873ff0f7ce8d2c8c69c895f81387b9fcab15
-- Local candidate only. No hosted application authorized.

create table public.tenbot_feedback (
 id uuid primary key default gen_random_uuid(), submitter_id uuid not null references public.app_users(user_id),
 submitter_name text not null, draft jsonb not null, status text not null default 'New'
 check(status in ('New','Needs Clarification','Under Consideration','Backlogged','Declined','Shipped')),
 created_at timestamptz not null default now()
);
create table public.tenbot_feedback_history (
 id bigint generated always as identity primary key, feedback_id uuid not null references public.tenbot_feedback(id),
 actor_id uuid not null references public.app_users(user_id), status text not null, note text not null default '', created_at timestamptz not null default now()
);
create table public.tenbot_usage (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.app_users(user_id),
 created_at timestamptz not null default now(), reserved_usd numeric not null check(reserved_usd > 0),
 outcome text not null default 'reserved' check(outcome in ('reserved','completed','failed'))
);
create index on public.tenbot_usage(user_id,created_at);
create index on public.tenbot_usage(created_at);
alter table public.tenbot_feedback enable row level security;
alter table public.tenbot_feedback_history enable row level security;
alter table public.tenbot_usage enable row level security;
revoke all on public.tenbot_feedback, public.tenbot_feedback_history, public.tenbot_usage from public,anon,authenticated;
-- Content is available only through bounded, caller-authorized RPCs. No private task/message reads.
create function public.tenbot_submit_feedback(p_draft jsonb,p_confirmed boolean) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid; v_name text; k text;
begin
 if not public.has_app_capability('readOperationalData') then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_confirmed is distinct from true or jsonb_typeof(p_draft) <> 'object' or octet_length(p_draft::text)>10000 then raise exception 'Confirmed bounded draft required'; end if;
 foreach k in array array['capability','problem','desired','module','original'] loop
 if jsonb_typeof(p_draft->k) is distinct from 'string' or coalesce(length(btrim(p_draft->>k)),0) not between 1 and 1200 then raise exception 'Incomplete draft: %',k; end if; end loop;
 if jsonb_typeof(p_draft->'summary') is distinct from 'string' or jsonb_typeof(p_draft->'context') is distinct from 'string' then raise exception 'Summary and context must be text'; end if;
 if coalesce(length(p_draft->>'summary'),0)>800 or coalesce(length(p_draft->>'context'),0)>1200 then raise exception 'Draft too long'; end if;
 if coalesce(p_draft->>'summaryKind','') not in ('AI-generated','Employee-written') then raise exception 'Summary provenance required'; end if;
 if exists(select 1 from jsonb_object_keys(p_draft) as keys(key) where keys.key not in ('capability','problem','desired','module','original','summary','summaryKind','context')) then raise exception 'Unknown draft field'; end if;
 perform pg_advisory_xact_lock(hashtextextended('tenbot-feedback:'||auth.uid()::text,0));
 if (select count(*) from public.tenbot_feedback where submitter_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception 'Feedback limit reached'; end if;
 select display_name into strict v_name from public.app_users where user_id=auth.uid() and is_active;
 insert into public.tenbot_feedback(submitter_id,submitter_name,draft) values(auth.uid(),v_name,p_draft) returning id into v_id;
 insert into public.tenbot_feedback_history(feedback_id,actor_id,status) values(v_id,auth.uid(),'New'); return v_id;
end; $$;
create function public.tenbot_list_feedback(p_status text default '',p_module text default '') returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not public.has_app_capability('manageUsers') then raise exception 'Not authorized' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(f)||jsonb_build_object('history',(select coalesce(jsonb_agg(h order by h.id),'[]') from public.tenbot_feedback_history h where h.feedback_id=f.id))),'[]') from
 (select * from public.tenbot_feedback where (p_status='' or status=p_status) and (p_module='' or draft->>'module'=p_module) order by created_at desc limit 100) f);
end; $$;
create function public.tenbot_review_feedback(p_id uuid,p_status text,p_note text default '') returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not public.has_app_capability('manageUsers') then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_status not in ('New','Needs Clarification','Under Consideration','Backlogged','Declined','Shipped') or p_status is null or length(p_note)>1200 then raise exception 'Invalid review'; end if;
 update public.tenbot_feedback set status=p_status where id=p_id;
 if not found then raise exception 'Request unavailable'; end if;
 insert into public.tenbot_feedback_history(feedback_id,actor_id,status,note) values(p_id,auth.uid(),p_status,coalesce(p_note,''));
end; $$;
-- Server-only atomic worst-case reservations survive restarts and concurrent Edge isolates.
-- Fixed $0.01 per attempt exceeds the bounded model input/output cost, including failures.
create function public.tenbot_reserve_usage(p_user uuid,p_monthly_usd numeric) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid;
begin
 if p_monthly_usd is null or p_monthly_usd<=0 or p_monthly_usd>100 then raise exception 'Inference budget disabled'; end if;
 if not exists(select 1 from public.app_users where user_id=p_user and is_active) then raise exception 'Not authorized'; end if;
 perform pg_advisory_xact_lock(27120000);
 if (select count(*) from public.tenbot_usage where user_id=p_user and created_at>now()-interval '1 minute')>=6 then raise exception 'TenBot rate limit reached'; end if;
 if (select coalesce(sum(reserved_usd),0) from public.tenbot_usage where created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')+0.01>p_monthly_usd then raise exception 'TenBot monthly budget exhausted'; end if;
 insert into public.tenbot_usage(user_id,reserved_usd) values(p_user,0.01) returning id into v_id; return v_id;
end; $$;
create function public.tenbot_finish_usage(p_id uuid,p_outcome text) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if p_outcome not in ('completed','failed') then raise exception 'Invalid outcome'; end if;
 update public.tenbot_usage set outcome=p_outcome where id=p_id and outcome='reserved';
end; $$;
alter function public.tenbot_submit_feedback(jsonb,boolean) owner to postgres;
alter function public.tenbot_list_feedback(text,text) owner to postgres;
alter function public.tenbot_review_feedback(uuid,text,text) owner to postgres;
alter function public.tenbot_reserve_usage(uuid,numeric) owner to postgres;
alter function public.tenbot_finish_usage(uuid,text) owner to postgres;
revoke all on function public.tenbot_submit_feedback(jsonb,boolean),public.tenbot_list_feedback(text,text),public.tenbot_review_feedback(uuid,text,text),public.tenbot_reserve_usage(uuid,numeric),public.tenbot_finish_usage(uuid,text) from public,anon,authenticated;
grant execute on function public.tenbot_submit_feedback(jsonb,boolean),public.tenbot_list_feedback(text,text),public.tenbot_review_feedback(uuid,text,text) to authenticated;
grant execute on function public.tenbot_reserve_usage(uuid,numeric),public.tenbot_finish_usage(uuid,text) to service_role;


insert into supabase_migrations.schema_migrations(version,name,statements) values('20261027120000','tenbot_feedback_usage',array[$accepted_20261027120000$-- Local candidate only. No hosted application authorized.
begin;
create table public.tenbot_feedback (
 id uuid primary key default gen_random_uuid(), submitter_id uuid not null references public.app_users(user_id),
 submitter_name text not null, draft jsonb not null, status text not null default 'New'
 check(status in ('New','Needs Clarification','Under Consideration','Backlogged','Declined','Shipped')),
 created_at timestamptz not null default now()
);
create table public.tenbot_feedback_history (
 id bigint generated always as identity primary key, feedback_id uuid not null references public.tenbot_feedback(id),
 actor_id uuid not null references public.app_users(user_id), status text not null, note text not null default '', created_at timestamptz not null default now()
);
create table public.tenbot_usage (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.app_users(user_id),
 created_at timestamptz not null default now(), reserved_usd numeric not null check(reserved_usd > 0),
 outcome text not null default 'reserved' check(outcome in ('reserved','completed','failed'))
);
create index on public.tenbot_usage(user_id,created_at);
create index on public.tenbot_usage(created_at);
alter table public.tenbot_feedback enable row level security;
alter table public.tenbot_feedback_history enable row level security;
alter table public.tenbot_usage enable row level security;
revoke all on public.tenbot_feedback, public.tenbot_feedback_history, public.tenbot_usage from public,anon,authenticated;
-- Content is available only through bounded, caller-authorized RPCs. No private task/message reads.
create function public.tenbot_submit_feedback(p_draft jsonb,p_confirmed boolean) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid; v_name text; k text;
begin
 if not public.has_app_capability('readOperationalData') then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_confirmed is distinct from true or jsonb_typeof(p_draft) <> 'object' or octet_length(p_draft::text)>10000 then raise exception 'Confirmed bounded draft required'; end if;
 foreach k in array array['capability','problem','desired','module','original'] loop
 if jsonb_typeof(p_draft->k) is distinct from 'string' or coalesce(length(btrim(p_draft->>k)),0) not between 1 and 1200 then raise exception 'Incomplete draft: %',k; end if; end loop;
 if jsonb_typeof(p_draft->'summary') is distinct from 'string' or jsonb_typeof(p_draft->'context') is distinct from 'string' then raise exception 'Summary and context must be text'; end if;
 if coalesce(length(p_draft->>'summary'),0)>800 or coalesce(length(p_draft->>'context'),0)>1200 then raise exception 'Draft too long'; end if;
 if coalesce(p_draft->>'summaryKind','') not in ('AI-generated','Employee-written') then raise exception 'Summary provenance required'; end if;
 if exists(select 1 from jsonb_object_keys(p_draft) as keys(key) where keys.key not in ('capability','problem','desired','module','original','summary','summaryKind','context')) then raise exception 'Unknown draft field'; end if;
 perform pg_advisory_xact_lock(hashtextextended('tenbot-feedback:'||auth.uid()::text,0));
 if (select count(*) from public.tenbot_feedback where submitter_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception 'Feedback limit reached'; end if;
 select display_name into strict v_name from public.app_users where user_id=auth.uid() and is_active;
 insert into public.tenbot_feedback(submitter_id,submitter_name,draft) values(auth.uid(),v_name,p_draft) returning id into v_id;
 insert into public.tenbot_feedback_history(feedback_id,actor_id,status) values(v_id,auth.uid(),'New'); return v_id;
end; $$;
create function public.tenbot_list_feedback(p_status text default '',p_module text default '') returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not public.has_app_capability('manageUsers') then raise exception 'Not authorized' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(f)||jsonb_build_object('history',(select coalesce(jsonb_agg(h order by h.id),'[]') from public.tenbot_feedback_history h where h.feedback_id=f.id))),'[]') from
 (select * from public.tenbot_feedback where (p_status='' or status=p_status) and (p_module='' or draft->>'module'=p_module) order by created_at desc limit 100) f);
end; $$;
create function public.tenbot_review_feedback(p_id uuid,p_status text,p_note text default '') returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not public.has_app_capability('manageUsers') then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_status not in ('New','Needs Clarification','Under Consideration','Backlogged','Declined','Shipped') or p_status is null or length(p_note)>1200 then raise exception 'Invalid review'; end if;
 update public.tenbot_feedback set status=p_status where id=p_id;
 if not found then raise exception 'Request unavailable'; end if;
 insert into public.tenbot_feedback_history(feedback_id,actor_id,status,note) values(p_id,auth.uid(),p_status,coalesce(p_note,''));
end; $$;
-- Server-only atomic worst-case reservations survive restarts and concurrent Edge isolates.
-- Fixed $0.01 per attempt exceeds the bounded model input/output cost, including failures.
create function public.tenbot_reserve_usage(p_user uuid,p_monthly_usd numeric) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid;
begin
 if p_monthly_usd is null or p_monthly_usd<=0 or p_monthly_usd>100 then raise exception 'Inference budget disabled'; end if;
 if not exists(select 1 from public.app_users where user_id=p_user and is_active) then raise exception 'Not authorized'; end if;
 perform pg_advisory_xact_lock(27120000);
 if (select count(*) from public.tenbot_usage where user_id=p_user and created_at>now()-interval '1 minute')>=6 then raise exception 'TenBot rate limit reached'; end if;
 if (select coalesce(sum(reserved_usd),0) from public.tenbot_usage where created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')+0.01>p_monthly_usd then raise exception 'TenBot monthly budget exhausted'; end if;
 insert into public.tenbot_usage(user_id,reserved_usd) values(p_user,0.01) returning id into v_id; return v_id;
end; $$;
create function public.tenbot_finish_usage(p_id uuid,p_outcome text) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if p_outcome not in ('completed','failed') then raise exception 'Invalid outcome'; end if;
 update public.tenbot_usage set outcome=p_outcome where id=p_id and outcome='reserved';
end; $$;
alter function public.tenbot_submit_feedback(jsonb,boolean) owner to postgres;
alter function public.tenbot_list_feedback(text,text) owner to postgres;
alter function public.tenbot_review_feedback(uuid,text,text) owner to postgres;
alter function public.tenbot_reserve_usage(uuid,numeric) owner to postgres;
alter function public.tenbot_finish_usage(uuid,text) owner to postgres;
revoke all on function public.tenbot_submit_feedback(jsonb,boolean),public.tenbot_list_feedback(text,text),public.tenbot_review_feedback(uuid,text,text),public.tenbot_reserve_usage(uuid,numeric),public.tenbot_finish_usage(uuid,text) from public,anon,authenticated;
grant execute on function public.tenbot_submit_feedback(jsonb,boolean),public.tenbot_list_feedback(text,text),public.tenbot_review_feedback(uuid,text,text) to authenticated;
grant execute on function public.tenbot_reserve_usage(uuid,numeric),public.tenbot_finish_usage(uuid,text) to service_role;
commit;
$accepted_20261027120000$]);


-- Accepted 20261027130000_tenbot_shared_usage_pool.sql; SHA256 b007ee3a5234876709c5d82c3269d78921a613815940df59669f5ce78548c435
-- Local candidate only. No hosted application authorized.
-- Supersedes separate local per-user daily allocations; preserves the ledger,
-- account burst protection and server-configured monthly reservation budget.

create or replace function public.tenbot_reserve_usage(p_user uuid,p_monthly_usd numeric) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid;
begin
 if p_monthly_usd is null or p_monthly_usd<=0 or p_monthly_usd>100 then raise exception 'Inference budget disabled'; end if;
 if not exists(select 1 from public.app_users where user_id=p_user and is_active) then raise exception 'Not authorized'; end if;
 perform pg_advisory_xact_lock(27120000);
 if (select count(*) from public.tenbot_usage where user_id=p_user and created_at>now()-interval '1 minute')>=6 then raise exception 'TenBot rate limit reached'; end if;
 if (select count(*) from public.tenbot_usage where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=20 then raise exception 'TenBot shared daily pool exhausted'; end if;
 if (select coalesce(sum(reserved_usd),0) from public.tenbot_usage where created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')+0.01>p_monthly_usd then raise exception 'TenBot monthly budget exhausted'; end if;
 insert into public.tenbot_usage(user_id,reserved_usd) values(p_user,0.01) returning id into v_id; return v_id;
end; $$;

-- Aggregate inference reservations only. Never returns account identities,
-- employee questions, feedback, messages or business records.
create function public.tenbot_usage_summary() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_day timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 v_month timestamptz:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 v_used bigint; v_reserved numeric;
begin
 if not public.has_app_capability('manageUsers') then raise exception 'Not authorized' using errcode='42501'; end if;
 select count(*) into v_used from public.tenbot_usage where created_at>=v_day;
 select coalesce(sum(reserved_usd),0) into v_reserved from public.tenbot_usage where created_at>=v_month;
 return jsonb_build_object('dayStart',v_day,'dayResetAt',v_day+interval '1 day',
  'sharedDayLimit',20,'sharedDayUsed',v_used,'sharedDayRemaining',greatest(0,20-v_used),
  'perAccountMinuteLimit',6,'monthStart',v_month,'monthReservedUsd',v_reserved,
  'dayCompleted',(select count(*) from public.tenbot_usage where created_at>=v_day and outcome='completed'),
  'dayFailed',(select count(*) from public.tenbot_usage where created_at>=v_day and outcome='failed'));
end; $$;
alter function public.tenbot_reserve_usage(uuid,numeric) owner to postgres;
alter function public.tenbot_usage_summary() owner to postgres;
revoke all on function public.tenbot_reserve_usage(uuid,numeric),public.tenbot_usage_summary() from public,anon,authenticated;
grant execute on function public.tenbot_reserve_usage(uuid,numeric) to service_role;
grant execute on function public.tenbot_usage_summary() to authenticated;


insert into supabase_migrations.schema_migrations(version,name,statements) values('20261027130000','tenbot_shared_usage_pool',array[$accepted_20261027130000$-- Local candidate only. No hosted application authorized.
-- Supersedes separate local per-user daily allocations; preserves the ledger,
-- account burst protection and server-configured monthly reservation budget.
begin;
create or replace function public.tenbot_reserve_usage(p_user uuid,p_monthly_usd numeric) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid;
begin
 if p_monthly_usd is null or p_monthly_usd<=0 or p_monthly_usd>100 then raise exception 'Inference budget disabled'; end if;
 if not exists(select 1 from public.app_users where user_id=p_user and is_active) then raise exception 'Not authorized'; end if;
 perform pg_advisory_xact_lock(27120000);
 if (select count(*) from public.tenbot_usage where user_id=p_user and created_at>now()-interval '1 minute')>=6 then raise exception 'TenBot rate limit reached'; end if;
 if (select count(*) from public.tenbot_usage where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=20 then raise exception 'TenBot shared daily pool exhausted'; end if;
 if (select coalesce(sum(reserved_usd),0) from public.tenbot_usage where created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')+0.01>p_monthly_usd then raise exception 'TenBot monthly budget exhausted'; end if;
 insert into public.tenbot_usage(user_id,reserved_usd) values(p_user,0.01) returning id into v_id; return v_id;
end; $$;

-- Aggregate inference reservations only. Never returns account identities,
-- employee questions, feedback, messages or business records.
create function public.tenbot_usage_summary() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_day timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 v_month timestamptz:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 v_used bigint; v_reserved numeric;
begin
 if not public.has_app_capability('manageUsers') then raise exception 'Not authorized' using errcode='42501'; end if;
 select count(*) into v_used from public.tenbot_usage where created_at>=v_day;
 select coalesce(sum(reserved_usd),0) into v_reserved from public.tenbot_usage where created_at>=v_month;
 return jsonb_build_object('dayStart',v_day,'dayResetAt',v_day+interval '1 day',
  'sharedDayLimit',20,'sharedDayUsed',v_used,'sharedDayRemaining',greatest(0,20-v_used),
  'perAccountMinuteLimit',6,'monthStart',v_month,'monthReservedUsd',v_reserved,
  'dayCompleted',(select count(*) from public.tenbot_usage where created_at>=v_day and outcome='completed'),
  'dayFailed',(select count(*) from public.tenbot_usage where created_at>=v_day and outcome='failed'));
end; $$;
alter function public.tenbot_reserve_usage(uuid,numeric) owner to postgres;
alter function public.tenbot_usage_summary() owner to postgres;
revoke all on function public.tenbot_reserve_usage(uuid,numeric),public.tenbot_usage_summary() from public,anon,authenticated;
grant execute on function public.tenbot_reserve_usage(uuid,numeric) to service_role;
grant execute on function public.tenbot_usage_summary() to authenticated;
commit;
$accepted_20261027130000$]);


-- Accepted 20261027140000_tenbot_measured_free_pool.sql; SHA256 3985d2912af54957c35f36bbb61374b4ff334f950bdc436da393b0aaa5c6bcaf
-- Local candidate only: no hosted application is authorized.
-- Replace pilot dollar-shaped testing credits with shared request and Neuron
-- limits. Keep every historical reservation; unknown usage stays conservative.

alter table public.tenbot_usage drop constraint tenbot_usage_reserved_usd_check;
alter table public.tenbot_usage add constraint tenbot_usage_reserved_usd_check check(reserved_usd >= 0);
alter table public.tenbot_usage
 add column reserved_neurons numeric not null default 200 check(reserved_neurons > 0),
 add column estimated_neurons numeric check(estimated_neurons >= 0),
 add column model text,
 add column input_tokens bigint check(input_tokens >= 0),
 add column output_tokens bigint check(output_tokens >= 0);
alter table public.tenbot_usage add constraint tenbot_usage_measurement_complete check(
 (estimated_neurons is null and input_tokens is null and output_tokens is null)
 or (estimated_neurons is not null and input_tokens is not null and output_tokens is not null and model is not null));

-- One policy shared by the atomic reservation and administrator summary. This
-- internal policy does not activate a provider or authorize paid inference.
create function public.tenbot_usage_policy() returns jsonb
language sql immutable set search_path=pg_catalog,public as $$
 select jsonb_build_object('version',2,'dayRequests',300,'monthRequests',6000,
  'minuteRequests',6,'dayNeurons',8000,'monthNeurons',240000);
$$;
alter function public.tenbot_usage_policy() owner to postgres;
revoke all on function public.tenbot_usage_policy() from public,anon,authenticated,service_role;

create function public.tenbot_reserve_usage(p_user uuid,p_model text,p_reserved_neurons numeric) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid; v_policy jsonb:=public.tenbot_usage_policy();
 v_day timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 v_month timestamptz:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
begin
 if p_model is null or p_model not in ('@cf/meta/llama-3.1-8b-instruct-fp8','@cf/meta/llama-3.3-70b-instruct-fp8-fast','@cf/qwen/qwen3-30b-a3b-fp8') or p_reserved_neurons is null
  or p_reserved_neurons<=0 or p_reserved_neurons>(v_policy->>'dayNeurons')::numeric then raise exception 'Invalid inference reservation'; end if;
 if not exists(select 1 from public.app_users where user_id=p_user and is_active) then raise exception 'Not authorized'; end if;
 perform pg_advisory_xact_lock(27120000);
 if (select count(*) from public.tenbot_usage where user_id=p_user and created_at>now()-interval '1 minute')>=(v_policy->>'minuteRequests')::int then raise exception 'TenBot rate limit reached'; end if;
 if (select count(*) from public.tenbot_usage where created_at>=v_day)>=(v_policy->>'dayRequests')::int then raise exception 'TenBot shared daily pool exhausted'; end if;
 if (select count(*) from public.tenbot_usage where created_at>=v_month)>=(v_policy->>'monthRequests')::int then raise exception 'TenBot shared monthly pool exhausted'; end if;
 if (select coalesce(sum(coalesce(estimated_neurons,reserved_neurons)),0) from public.tenbot_usage where created_at>=v_day)+p_reserved_neurons>(v_policy->>'dayNeurons')::numeric then raise exception 'TenBot daily inference budget exhausted'; end if;
 if (select coalesce(sum(coalesce(estimated_neurons,reserved_neurons)),0) from public.tenbot_usage where created_at>=v_month)+p_reserved_neurons>(v_policy->>'monthNeurons')::numeric then raise exception 'TenBot monthly inference budget exhausted'; end if;
 -- The legacy USD column remains historical. New requests use Neurons and
 -- reserve no dollar-shaped testing credit; none of these values are billing.
 insert into public.tenbot_usage(user_id,reserved_usd,reserved_neurons,model)
  values(p_user,0,p_reserved_neurons,p_model) returning id into v_id;
 return v_id;
end; $$;

create function public.tenbot_finish_usage(p_id uuid,p_outcome text,p_model text,p_input_tokens bigint,p_output_tokens bigint,p_estimated_neurons numeric) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_input_rate numeric;v_output_rate numeric;v_expected numeric;
begin
 if p_outcome not in ('completed','failed') or p_outcome is null then raise exception 'Invalid outcome'; end if;
 if (p_input_tokens is null or p_output_tokens is null or p_estimated_neurons is null)
  and (p_input_tokens is not null or p_output_tokens is not null or p_estimated_neurons is not null) then raise exception 'Incomplete inference measurement'; end if;
 if p_input_tokens<0 or p_input_tokens>100000 or p_output_tokens<0 or p_output_tokens>640 or p_estimated_neurons<0 then raise exception 'Invalid inference measurement'; end if;
 if p_estimated_neurons is not null then
  -- Defense against accidental under-accounting: independently reproduce the
  -- model's published token-to-Neuron estimate, never a client-supplied cost.
  select case p_model when '@cf/meta/llama-3.1-8b-instruct-fp8' then 13778 when '@cf/meta/llama-3.3-70b-instruct-fp8-fast' then 26668 when '@cf/qwen/qwen3-30b-a3b-fp8' then 4625 end,
   case p_model when '@cf/meta/llama-3.1-8b-instruct-fp8' then 26128 when '@cf/meta/llama-3.3-70b-instruct-fp8-fast' then 204805 when '@cf/qwen/qwen3-30b-a3b-fp8' then 30475 end into v_input_rate,v_output_rate;
  v_expected:=ceil((p_input_tokens*v_input_rate+p_output_tokens*v_output_rate)/1000)/1000;
  if v_expected is null or p_estimated_neurons is distinct from v_expected then raise exception 'Invalid inference measurement'; end if;
 end if;
 -- Only provider-side token telemetry is passed here. A missing measurement,
 -- including an uncertain timeout, keeps the full original reservation.
 update public.tenbot_usage set outcome=p_outcome,input_tokens=p_input_tokens,
  output_tokens=p_output_tokens,estimated_neurons=p_estimated_neurons
  where id=p_id and outcome='reserved' and model=p_model;
 if not found then raise exception 'Inference reservation unavailable'; end if;
end; $$;

create or replace function public.tenbot_usage_summary() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_policy jsonb:=public.tenbot_usage_policy();
 v_day timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 v_month timestamptz:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 v_day_used bigint;v_month_used bigint;v_day_neurons numeric;v_month_neurons numeric;
begin
 if not public.has_app_capability('manageUsers') then raise exception 'Not authorized' using errcode='42501'; end if;
 select count(*),coalesce(sum(coalesce(estimated_neurons,reserved_neurons)),0) into v_day_used,v_day_neurons from public.tenbot_usage where created_at>=v_day;
 select count(*),coalesce(sum(coalesce(estimated_neurons,reserved_neurons)),0) into v_month_used,v_month_neurons from public.tenbot_usage where created_at>=v_month;
 return jsonb_build_object('policyVersion',v_policy->'version','dayStart',v_day,'dayResetAt',v_day+interval '1 day',
  'sharedDayLimit',v_policy->'dayRequests','sharedDayUsed',v_day_used,'sharedDayRemaining',greatest(0,(v_policy->>'dayRequests')::int-v_day_used),
  'sharedMonthLimit',v_policy->'monthRequests','sharedMonthUsed',v_month_used,'sharedMonthRemaining',greatest(0,(v_policy->>'monthRequests')::int-v_month_used),
  'perAccountMinuteLimit',v_policy->'minuteRequests','monthStart',v_month,
  'dayNeuronLimit',v_policy->'dayNeurons','dayAccountedNeurons',v_day_neurons,
  'monthNeuronLimit',v_policy->'monthNeurons','monthAccountedNeurons',v_month_neurons,
  'dayMeasuredInputTokens',(select coalesce(sum(input_tokens),0) from public.tenbot_usage where created_at>=v_day),
  'dayMeasuredOutputTokens',(select coalesce(sum(output_tokens),0) from public.tenbot_usage where created_at>=v_day),
  'dayUnmeasuredAttempts',(select count(*) from public.tenbot_usage where created_at>=v_day and estimated_neurons is null),
  'dayCompleted',(select count(*) from public.tenbot_usage where created_at>=v_day and outcome='completed'),
  'dayFailed',(select count(*) from public.tenbot_usage where created_at>=v_day and outcome='failed'));
end; $$;
alter function public.tenbot_reserve_usage(uuid,text,numeric) owner to postgres;
alter function public.tenbot_finish_usage(uuid,text,text,bigint,bigint,numeric) owner to postgres;
revoke all on function public.tenbot_reserve_usage(uuid,text,numeric),public.tenbot_finish_usage(uuid,text,text,bigint,bigint,numeric) from public,anon,authenticated;
-- Old RPC definitions remain as history, but cannot bypass the new policy.
revoke all on function public.tenbot_reserve_usage(uuid,numeric),public.tenbot_finish_usage(uuid,text) from service_role;
grant execute on function public.tenbot_reserve_usage(uuid,text,numeric),public.tenbot_finish_usage(uuid,text,text,bigint,bigint,numeric) to service_role;


insert into supabase_migrations.schema_migrations(version,name,statements) values('20261027140000','tenbot_measured_free_pool',array[$accepted_20261027140000$-- Local candidate only: no hosted application is authorized.
-- Replace pilot dollar-shaped testing credits with shared request and Neuron
-- limits. Keep every historical reservation; unknown usage stays conservative.
begin;
alter table public.tenbot_usage drop constraint tenbot_usage_reserved_usd_check;
alter table public.tenbot_usage add constraint tenbot_usage_reserved_usd_check check(reserved_usd >= 0);
alter table public.tenbot_usage
 add column reserved_neurons numeric not null default 200 check(reserved_neurons > 0),
 add column estimated_neurons numeric check(estimated_neurons >= 0),
 add column model text,
 add column input_tokens bigint check(input_tokens >= 0),
 add column output_tokens bigint check(output_tokens >= 0);
alter table public.tenbot_usage add constraint tenbot_usage_measurement_complete check(
 (estimated_neurons is null and input_tokens is null and output_tokens is null)
 or (estimated_neurons is not null and input_tokens is not null and output_tokens is not null and model is not null));

-- One policy shared by the atomic reservation and administrator summary. This
-- internal policy does not activate a provider or authorize paid inference.
create function public.tenbot_usage_policy() returns jsonb
language sql immutable set search_path=pg_catalog,public as $$
 select jsonb_build_object('version',2,'dayRequests',300,'monthRequests',6000,
  'minuteRequests',6,'dayNeurons',8000,'monthNeurons',240000);
$$;
alter function public.tenbot_usage_policy() owner to postgres;
revoke all on function public.tenbot_usage_policy() from public,anon,authenticated,service_role;

create function public.tenbot_reserve_usage(p_user uuid,p_model text,p_reserved_neurons numeric) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid; v_policy jsonb:=public.tenbot_usage_policy();
 v_day timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 v_month timestamptz:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
begin
 if p_model is null or p_model not in ('@cf/meta/llama-3.1-8b-instruct-fp8','@cf/meta/llama-3.3-70b-instruct-fp8-fast','@cf/qwen/qwen3-30b-a3b-fp8') or p_reserved_neurons is null
  or p_reserved_neurons<=0 or p_reserved_neurons>(v_policy->>'dayNeurons')::numeric then raise exception 'Invalid inference reservation'; end if;
 if not exists(select 1 from public.app_users where user_id=p_user and is_active) then raise exception 'Not authorized'; end if;
 perform pg_advisory_xact_lock(27120000);
 if (select count(*) from public.tenbot_usage where user_id=p_user and created_at>now()-interval '1 minute')>=(v_policy->>'minuteRequests')::int then raise exception 'TenBot rate limit reached'; end if;
 if (select count(*) from public.tenbot_usage where created_at>=v_day)>=(v_policy->>'dayRequests')::int then raise exception 'TenBot shared daily pool exhausted'; end if;
 if (select count(*) from public.tenbot_usage where created_at>=v_month)>=(v_policy->>'monthRequests')::int then raise exception 'TenBot shared monthly pool exhausted'; end if;
 if (select coalesce(sum(coalesce(estimated_neurons,reserved_neurons)),0) from public.tenbot_usage where created_at>=v_day)+p_reserved_neurons>(v_policy->>'dayNeurons')::numeric then raise exception 'TenBot daily inference budget exhausted'; end if;
 if (select coalesce(sum(coalesce(estimated_neurons,reserved_neurons)),0) from public.tenbot_usage where created_at>=v_month)+p_reserved_neurons>(v_policy->>'monthNeurons')::numeric then raise exception 'TenBot monthly inference budget exhausted'; end if;
 -- The legacy USD column remains historical. New requests use Neurons and
 -- reserve no dollar-shaped testing credit; none of these values are billing.
 insert into public.tenbot_usage(user_id,reserved_usd,reserved_neurons,model)
  values(p_user,0,p_reserved_neurons,p_model) returning id into v_id;
 return v_id;
end; $$;

create function public.tenbot_finish_usage(p_id uuid,p_outcome text,p_model text,p_input_tokens bigint,p_output_tokens bigint,p_estimated_neurons numeric) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_input_rate numeric;v_output_rate numeric;v_expected numeric;
begin
 if p_outcome not in ('completed','failed') or p_outcome is null then raise exception 'Invalid outcome'; end if;
 if (p_input_tokens is null or p_output_tokens is null or p_estimated_neurons is null)
  and (p_input_tokens is not null or p_output_tokens is not null or p_estimated_neurons is not null) then raise exception 'Incomplete inference measurement'; end if;
 if p_input_tokens<0 or p_input_tokens>100000 or p_output_tokens<0 or p_output_tokens>640 or p_estimated_neurons<0 then raise exception 'Invalid inference measurement'; end if;
 if p_estimated_neurons is not null then
  -- Defense against accidental under-accounting: independently reproduce the
  -- model's published token-to-Neuron estimate, never a client-supplied cost.
  select case p_model when '@cf/meta/llama-3.1-8b-instruct-fp8' then 13778 when '@cf/meta/llama-3.3-70b-instruct-fp8-fast' then 26668 when '@cf/qwen/qwen3-30b-a3b-fp8' then 4625 end,
   case p_model when '@cf/meta/llama-3.1-8b-instruct-fp8' then 26128 when '@cf/meta/llama-3.3-70b-instruct-fp8-fast' then 204805 when '@cf/qwen/qwen3-30b-a3b-fp8' then 30475 end into v_input_rate,v_output_rate;
  v_expected:=ceil((p_input_tokens*v_input_rate+p_output_tokens*v_output_rate)/1000)/1000;
  if v_expected is null or p_estimated_neurons is distinct from v_expected then raise exception 'Invalid inference measurement'; end if;
 end if;
 -- Only provider-side token telemetry is passed here. A missing measurement,
 -- including an uncertain timeout, keeps the full original reservation.
 update public.tenbot_usage set outcome=p_outcome,input_tokens=p_input_tokens,
  output_tokens=p_output_tokens,estimated_neurons=p_estimated_neurons
  where id=p_id and outcome='reserved' and model=p_model;
 if not found then raise exception 'Inference reservation unavailable'; end if;
end; $$;

create or replace function public.tenbot_usage_summary() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_policy jsonb:=public.tenbot_usage_policy();
 v_day timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 v_month timestamptz:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 v_day_used bigint;v_month_used bigint;v_day_neurons numeric;v_month_neurons numeric;
begin
 if not public.has_app_capability('manageUsers') then raise exception 'Not authorized' using errcode='42501'; end if;
 select count(*),coalesce(sum(coalesce(estimated_neurons,reserved_neurons)),0) into v_day_used,v_day_neurons from public.tenbot_usage where created_at>=v_day;
 select count(*),coalesce(sum(coalesce(estimated_neurons,reserved_neurons)),0) into v_month_used,v_month_neurons from public.tenbot_usage where created_at>=v_month;
 return jsonb_build_object('policyVersion',v_policy->'version','dayStart',v_day,'dayResetAt',v_day+interval '1 day',
  'sharedDayLimit',v_policy->'dayRequests','sharedDayUsed',v_day_used,'sharedDayRemaining',greatest(0,(v_policy->>'dayRequests')::int-v_day_used),
  'sharedMonthLimit',v_policy->'monthRequests','sharedMonthUsed',v_month_used,'sharedMonthRemaining',greatest(0,(v_policy->>'monthRequests')::int-v_month_used),
  'perAccountMinuteLimit',v_policy->'minuteRequests','monthStart',v_month,
  'dayNeuronLimit',v_policy->'dayNeurons','dayAccountedNeurons',v_day_neurons,
  'monthNeuronLimit',v_policy->'monthNeurons','monthAccountedNeurons',v_month_neurons,
  'dayMeasuredInputTokens',(select coalesce(sum(input_tokens),0) from public.tenbot_usage where created_at>=v_day),
  'dayMeasuredOutputTokens',(select coalesce(sum(output_tokens),0) from public.tenbot_usage where created_at>=v_day),
  'dayUnmeasuredAttempts',(select count(*) from public.tenbot_usage where created_at>=v_day and estimated_neurons is null),
  'dayCompleted',(select count(*) from public.tenbot_usage where created_at>=v_day and outcome='completed'),
  'dayFailed',(select count(*) from public.tenbot_usage where created_at>=v_day and outcome='failed'));
end; $$;
alter function public.tenbot_reserve_usage(uuid,text,numeric) owner to postgres;
alter function public.tenbot_finish_usage(uuid,text,text,bigint,bigint,numeric) owner to postgres;
revoke all on function public.tenbot_reserve_usage(uuid,text,numeric),public.tenbot_finish_usage(uuid,text,text,bigint,bigint,numeric) from public,anon,authenticated;
-- Old RPC definitions remain as history, but cannot bypass the new policy.
revoke all on function public.tenbot_reserve_usage(uuid,numeric),public.tenbot_finish_usage(uuid,text) from service_role;
grant execute on function public.tenbot_reserve_usage(uuid,text,numeric),public.tenbot_finish_usage(uuid,text,text,bigint,bigint,numeric) to service_role;
commit;
$accepted_20261027140000$]);


-- Accepted 20261027150000_tenbot_private_conversations.sql; SHA256 81652bd3e335d2fe29d5b26012727eabaed765dc7950e2979b7fd2891ee53b3b
-- Local candidate. No hosted application authorized.
-- Separate owner-only assistant history; never reads ordinary Messages/Tasks.

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


insert into supabase_migrations.schema_migrations(version,name,statements) values('20261027150000','tenbot_private_conversations',array[$accepted_20261027150000$-- Local candidate. No hosted application authorized.
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
$accepted_20261027150000$]);


do $tenbot_final_security$
declare signature text;role_name text;tbl text;v_function_row record;v_relation_row record;v_count bigint;
begin
 if (select array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'tenbot\_%' escape '\') is distinct from (select array_agg(to_regprocedure(s)::regprocedure::text order by to_regprocedure(s)::regprocedure::text) from unnest(array['public.tenbot_submit_feedback(jsonb,boolean)','public.tenbot_list_feedback(text,text)','public.tenbot_review_feedback(uuid,text,text)','public.tenbot_reserve_usage(uuid,numeric)','public.tenbot_finish_usage(uuid,text)','public.tenbot_usage_summary()','public.tenbot_usage_policy()','public.tenbot_reserve_usage(uuid,text,numeric)','public.tenbot_finish_usage(uuid,text,text,bigint,bigint,numeric)','public.tenbot_load_conversation(text)','public.tenbot_append_conversation_turn(uuid,text,integer,text,text)','public.tenbot_feedback_is_valid(jsonb)','public.tenbot_clear_conversation(text)']::text[])s) then raise exception 'Unexpected TenBot function inventory'; end if;
 
 select * into strict v_function_row from pg_proc where oid=to_regprocedure('public.tenbot_submit_feedback(jsonb,boolean)');
 if md5(v_function_row.prosrc) is distinct from '7b7321599bb6d6f67b6a3819345afe76' or v_function_row.prorettype<>to_regtype('uuid') or v_function_row.prosecdef is distinct from true or v_function_row.provolatile<>'v' or v_function_row.prokind<>'f' or pg_get_userbyid(v_function_row.proowner)<>'postgres' or v_function_row.proconfig is distinct from array['search_path=pg_catalog, public']::text[] or v_function_row.pronargdefaults<>0 or coalesce(v_function_row.proargnames,array[]::text[]) is distinct from array['p_draft','p_confirmed']::text[] then raise exception 'TenBot function contract mismatch'; end if;
 if exists(select 1 from aclexplode(coalesce(v_function_row.proacl,acldefault('f',v_function_row.proowner))) x where x.grantee=0 and x.privilege_type='EXECUTE') then raise exception 'TenBot PUBLIC function execution exposed'; end if;


 select * into strict v_function_row from pg_proc where oid=to_regprocedure('public.tenbot_list_feedback(text,text)');
 if md5(v_function_row.prosrc) is distinct from '0a72381703589b6d560e0bf8096ae507' or v_function_row.prorettype<>to_regtype('jsonb') or v_function_row.prosecdef is distinct from true or v_function_row.provolatile<>'v' or v_function_row.prokind<>'f' or pg_get_userbyid(v_function_row.proowner)<>'postgres' or v_function_row.proconfig is distinct from array['search_path=pg_catalog, public']::text[] or v_function_row.pronargdefaults<>2 or coalesce(v_function_row.proargnames,array[]::text[]) is distinct from array['p_status','p_module']::text[] then raise exception 'TenBot function contract mismatch'; end if;
 if exists(select 1 from aclexplode(coalesce(v_function_row.proacl,acldefault('f',v_function_row.proowner))) x where x.grantee=0 and x.privilege_type='EXECUTE') then raise exception 'TenBot PUBLIC function execution exposed'; end if;


 select * into strict v_function_row from pg_proc where oid=to_regprocedure('public.tenbot_review_feedback(uuid,text,text)');
 if md5(v_function_row.prosrc) is distinct from '842cd13eb42f44efc5b3d803ec41eecf' or v_function_row.prorettype<>to_regtype('void') or v_function_row.prosecdef is distinct from true or v_function_row.provolatile<>'v' or v_function_row.prokind<>'f' or pg_get_userbyid(v_function_row.proowner)<>'postgres' or v_function_row.proconfig is distinct from array['search_path=pg_catalog, public']::text[] or v_function_row.pronargdefaults<>1 or coalesce(v_function_row.proargnames,array[]::text[]) is distinct from array['p_id','p_status','p_note']::text[] then raise exception 'TenBot function contract mismatch'; end if;
 if exists(select 1 from aclexplode(coalesce(v_function_row.proacl,acldefault('f',v_function_row.proowner))) x where x.grantee=0 and x.privilege_type='EXECUTE') then raise exception 'TenBot PUBLIC function execution exposed'; end if;


 select * into strict v_function_row from pg_proc where oid=to_regprocedure('public.tenbot_reserve_usage(uuid,numeric)');
 if md5(v_function_row.prosrc) is distinct from 'a6bbbd6551c53208b4ac83030b3c6da2' or v_function_row.prorettype<>to_regtype('uuid') or v_function_row.prosecdef is distinct from true or v_function_row.provolatile<>'v' or v_function_row.prokind<>'f' or pg_get_userbyid(v_function_row.proowner)<>'postgres' or v_function_row.proconfig is distinct from array['search_path=pg_catalog, public']::text[] or v_function_row.pronargdefaults<>0 or coalesce(v_function_row.proargnames,array[]::text[]) is distinct from array['p_user','p_monthly_usd']::text[] then raise exception 'TenBot function contract mismatch'; end if;
 if exists(select 1 from aclexplode(coalesce(v_function_row.proacl,acldefault('f',v_function_row.proowner))) x where x.grantee=0 and x.privilege_type='EXECUTE') then raise exception 'TenBot PUBLIC function execution exposed'; end if;


 select * into strict v_function_row from pg_proc where oid=to_regprocedure('public.tenbot_finish_usage(uuid,text)');
 if md5(v_function_row.prosrc) is distinct from '3564d45610e2f2ce1a6b442e32b3ddfb' or v_function_row.prorettype<>to_regtype('void') or v_function_row.prosecdef is distinct from true or v_function_row.provolatile<>'v' or v_function_row.prokind<>'f' or pg_get_userbyid(v_function_row.proowner)<>'postgres' or v_function_row.proconfig is distinct from array['search_path=pg_catalog, public']::text[] or v_function_row.pronargdefaults<>0 or coalesce(v_function_row.proargnames,array[]::text[]) is distinct from array['p_id','p_outcome']::text[] then raise exception 'TenBot function contract mismatch'; end if;
 if exists(select 1 from aclexplode(coalesce(v_function_row.proacl,acldefault('f',v_function_row.proowner))) x where x.grantee=0 and x.privilege_type='EXECUTE') then raise exception 'TenBot PUBLIC function execution exposed'; end if;


 select * into strict v_function_row from pg_proc where oid=to_regprocedure('public.tenbot_usage_summary()');
 if md5(v_function_row.prosrc) is distinct from '548d2481432a5881c4da1c83fef0f008' or v_function_row.prorettype<>to_regtype('jsonb') or v_function_row.prosecdef is distinct from true or v_function_row.provolatile<>'v' or v_function_row.prokind<>'f' or pg_get_userbyid(v_function_row.proowner)<>'postgres' or v_function_row.proconfig is distinct from array['search_path=pg_catalog, public']::text[] or v_function_row.pronargdefaults<>0 or coalesce(v_function_row.proargnames,array[]::text[]) is distinct from array[]::text[] then raise exception 'TenBot function contract mismatch'; end if;
 if exists(select 1 from aclexplode(coalesce(v_function_row.proacl,acldefault('f',v_function_row.proowner))) x where x.grantee=0 and x.privilege_type='EXECUTE') then raise exception 'TenBot PUBLIC function execution exposed'; end if;


 select * into strict v_function_row from pg_proc where oid=to_regprocedure('public.tenbot_usage_policy()');
 if md5(v_function_row.prosrc) is distinct from '3b10e69491b5bca8d4b964801824ce24' or v_function_row.prorettype<>to_regtype('jsonb') or v_function_row.prosecdef is distinct from false or v_function_row.provolatile<>'i' or v_function_row.prokind<>'f' or pg_get_userbyid(v_function_row.proowner)<>'postgres' or v_function_row.proconfig is distinct from array['search_path=pg_catalog, public']::text[] or v_function_row.pronargdefaults<>0 or coalesce(v_function_row.proargnames,array[]::text[]) is distinct from array[]::text[] then raise exception 'TenBot function contract mismatch'; end if;
 if exists(select 1 from aclexplode(coalesce(v_function_row.proacl,acldefault('f',v_function_row.proowner))) x where x.grantee=0 and x.privilege_type='EXECUTE') then raise exception 'TenBot PUBLIC function execution exposed'; end if;


 select * into strict v_function_row from pg_proc where oid=to_regprocedure('public.tenbot_reserve_usage(uuid,text,numeric)');
 if md5(v_function_row.prosrc) is distinct from 'd2b07c939fe58488b26eda572c349d7a' or v_function_row.prorettype<>to_regtype('uuid') or v_function_row.prosecdef is distinct from true or v_function_row.provolatile<>'v' or v_function_row.prokind<>'f' or pg_get_userbyid(v_function_row.proowner)<>'postgres' or v_function_row.proconfig is distinct from array['search_path=pg_catalog, public']::text[] or v_function_row.pronargdefaults<>0 or coalesce(v_function_row.proargnames,array[]::text[]) is distinct from array['p_user','p_model','p_reserved_neurons']::text[] then raise exception 'TenBot function contract mismatch'; end if;
 if exists(select 1 from aclexplode(coalesce(v_function_row.proacl,acldefault('f',v_function_row.proowner))) x where x.grantee=0 and x.privilege_type='EXECUTE') then raise exception 'TenBot PUBLIC function execution exposed'; end if;


 select * into strict v_function_row from pg_proc where oid=to_regprocedure('public.tenbot_finish_usage(uuid,text,text,bigint,bigint,numeric)');
 if md5(v_function_row.prosrc) is distinct from 'ac61f5555e03763481bfaa0a68ce6bf1' or v_function_row.prorettype<>to_regtype('void') or v_function_row.prosecdef is distinct from true or v_function_row.provolatile<>'v' or v_function_row.prokind<>'f' or pg_get_userbyid(v_function_row.proowner)<>'postgres' or v_function_row.proconfig is distinct from array['search_path=pg_catalog, public']::text[] or v_function_row.pronargdefaults<>0 or coalesce(v_function_row.proargnames,array[]::text[]) is distinct from array['p_id','p_outcome','p_model','p_input_tokens','p_output_tokens','p_estimated_neurons']::text[] then raise exception 'TenBot function contract mismatch'; end if;
 if exists(select 1 from aclexplode(coalesce(v_function_row.proacl,acldefault('f',v_function_row.proowner))) x where x.grantee=0 and x.privilege_type='EXECUTE') then raise exception 'TenBot PUBLIC function execution exposed'; end if;


 select * into strict v_function_row from pg_proc where oid=to_regprocedure('public.tenbot_load_conversation(text)');
 if md5(v_function_row.prosrc) is distinct from 'c42bcd0abe69d0d718b2b6ccad91b8e7' or v_function_row.prorettype<>to_regtype('jsonb') or v_function_row.prosecdef is distinct from true or v_function_row.provolatile<>'v' or v_function_row.prokind<>'f' or pg_get_userbyid(v_function_row.proowner)<>'postgres' or v_function_row.proconfig is distinct from array['search_path=pg_catalog, public']::text[] or v_function_row.pronargdefaults<>1 or coalesce(v_function_row.proargnames,array[]::text[]) is distinct from array['p_conversation_id']::text[] then raise exception 'TenBot function contract mismatch'; end if;
 if exists(select 1 from aclexplode(coalesce(v_function_row.proacl,acldefault('f',v_function_row.proowner))) x where x.grantee=0 and x.privilege_type='EXECUTE') then raise exception 'TenBot PUBLIC function execution exposed'; end if;


 select * into strict v_function_row from pg_proc where oid=to_regprocedure('public.tenbot_append_conversation_turn(uuid,text,integer,text,text)');
 if md5(v_function_row.prosrc) is distinct from '08a639991121cadc573a72ef0b9f9417' or v_function_row.prorettype<>to_regtype('boolean') or v_function_row.prosecdef is distinct from true or v_function_row.provolatile<>'v' or v_function_row.prokind<>'f' or pg_get_userbyid(v_function_row.proowner)<>'postgres' or v_function_row.proconfig is distinct from array['search_path=pg_catalog, public']::text[] or v_function_row.pronargdefaults<>0 or coalesce(v_function_row.proargnames,array[]::text[]) is distinct from array['p_user','p_conversation_id','p_expected_version','p_question','p_answer']::text[] then raise exception 'TenBot function contract mismatch'; end if;
 if exists(select 1 from aclexplode(coalesce(v_function_row.proacl,acldefault('f',v_function_row.proowner))) x where x.grantee=0 and x.privilege_type='EXECUTE') then raise exception 'TenBot PUBLIC function execution exposed'; end if;


 select * into strict v_function_row from pg_proc where oid=to_regprocedure('public.tenbot_feedback_is_valid(jsonb)');
 if md5(v_function_row.prosrc) is distinct from 'e6b1cc184c4c19b54bb43e10ecb7c896' or v_function_row.prorettype<>to_regtype('boolean') or v_function_row.prosecdef is distinct from false or v_function_row.provolatile<>'i' or v_function_row.prokind<>'f' or pg_get_userbyid(v_function_row.proowner)<>'postgres' or v_function_row.proconfig is distinct from array['search_path=pg_catalog, public']::text[] or v_function_row.pronargdefaults<>0 or coalesce(v_function_row.proargnames,array[]::text[]) is distinct from array['p_draft']::text[] then raise exception 'TenBot function contract mismatch'; end if;
 if exists(select 1 from aclexplode(coalesce(v_function_row.proacl,acldefault('f',v_function_row.proowner))) x where x.grantee=0 and x.privilege_type='EXECUTE') then raise exception 'TenBot PUBLIC function execution exposed'; end if;


 select * into strict v_function_row from pg_proc where oid=to_regprocedure('public.tenbot_clear_conversation(text)');
 if md5(v_function_row.prosrc) is distinct from '47ebd705ff7655990453b5572f4ab1ef' or v_function_row.prorettype<>to_regtype('boolean') or v_function_row.prosecdef is distinct from true or v_function_row.provolatile<>'v' or v_function_row.prokind<>'f' or pg_get_userbyid(v_function_row.proowner)<>'postgres' or v_function_row.proconfig is distinct from array['search_path=pg_catalog, public']::text[] or v_function_row.pronargdefaults<>0 or coalesce(v_function_row.proargnames,array[]::text[]) is distinct from array['p_conversation_id']::text[] then raise exception 'TenBot function contract mismatch'; end if;
 if exists(select 1 from aclexplode(coalesce(v_function_row.proacl,acldefault('f',v_function_row.proowner))) x where x.grantee=0 and x.privilege_type='EXECUTE') then raise exception 'TenBot PUBLIC function execution exposed'; end if;

 foreach signature in array array['public.tenbot_reserve_usage(uuid,text,numeric)','public.tenbot_finish_usage(uuid,text,text,bigint,bigint,numeric)','public.tenbot_append_conversation_turn(uuid,text,integer,text,text)']::text[] loop
  if has_function_privilege('anon',signature,'EXECUTE') or has_function_privilege('authenticated',signature,'EXECUTE') or not has_function_privilege('service_role',signature,'EXECUTE') then raise exception 'TenBot service-only RPC boundary failed'; end if;
 end loop;
 foreach signature in array array['public.tenbot_submit_feedback(jsonb,boolean)','public.tenbot_list_feedback(text,text)','public.tenbot_review_feedback(uuid,text,text)','public.tenbot_usage_summary()','public.tenbot_load_conversation(text)','public.tenbot_clear_conversation(text)']::text[] loop
  if has_function_privilege('anon',signature,'EXECUTE') or not has_function_privilege('authenticated',signature,'EXECUTE') then raise exception 'TenBot authenticated RPC boundary failed'; end if;
 end loop;
 -- Feedback and summary may retain inherited service EXECUTE; caller checks remain exact in body hashes.
 foreach signature in array array['public.tenbot_load_conversation(text)','public.tenbot_clear_conversation(text)']::text[] loop
  if has_function_privilege('service_role',signature,'EXECUTE') then raise exception 'Service role can load or clear private owner history'; end if;
 end loop;
 foreach signature in array array['public.tenbot_usage_policy()','public.tenbot_feedback_is_valid(jsonb)','public.tenbot_reserve_usage(uuid,numeric)','public.tenbot_finish_usage(uuid,text)']::text[] loop
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if has_function_privilege(role_name,signature,'EXECUTE') then raise exception 'Internal or legacy TenBot bypass exposed'; end if;
  end loop;
 end loop;
 foreach tbl in array array['public.tenbot_feedback','public.tenbot_feedback_history','public.tenbot_usage','public.tenbot_conversations','public.tenbot_conversation_turns']::text[] loop
  select * into strict v_relation_row from pg_class where oid=to_regclass(tbl);
  if v_relation_row.relkind<>'r' or not v_relation_row.relrowsecurity or v_relation_row.relforcerowsecurity or pg_get_userbyid(v_relation_row.relowner)<>'postgres' then raise exception 'TenBot table RLS/owner mismatch'; end if;
  foreach role_name in array array['anon','authenticated'] loop
   if has_table_privilege(role_name,v_relation_row.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege(role_name,v_relation_row.oid,'SELECT,INSERT,UPDATE,REFERENCES') then raise exception 'Direct TenBot table access exposed'; end if;
  end loop;
  if exists(select 1 from aclexplode(coalesce(v_relation_row.relacl,acldefault('r',v_relation_row.relowner))) x where x.grantee=0) then raise exception 'PUBLIC TenBot table access exposed'; end if;
  if tbl in('public.tenbot_conversations','public.tenbot_conversation_turns') and (has_table_privilege('service_role',v_relation_row.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege('service_role',v_relation_row.oid,'SELECT,INSERT,UPDATE,REFERENCES')) then raise exception 'Service direct private-history access exposed'; end if;
  execute format('select count(*) from %s',tbl) into v_count;
  if v_count<>0 then raise exception 'New TenBot table unexpectedly populated'; end if;
 end loop;
 if (select array_agg(c.relname::text order by c.relname::text collate "C") from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'tenbot\_%' escape '\' and c.relkind='r') is distinct from (select array_agg(x order by x collate "C") from unnest(array['tenbot_feedback','tenbot_feedback_history','tenbot_usage','tenbot_conversations','tenbot_conversation_turns']::text[])x)
  or (select array_agg(c.relname::text order by c.relname::text collate "C") from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'tenbot\_%' escape '\' and c.relkind='S') is distinct from (select array_agg(x order by x collate "C") from unnest(array['tenbot_feedback_history_id_seq','tenbot_conversation_turns_id_seq']::text[])x)
  or (select array_agg(c.relname::text order by c.relname::text collate "C") from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'tenbot\_%' escape '\' and c.relkind='i') is distinct from (select array_agg(x order by x collate "C") from unnest(array['tenbot_feedback_pkey','tenbot_feedback_history_pkey','tenbot_usage_pkey','tenbot_usage_user_id_created_at_idx','tenbot_usage_created_at_idx','tenbot_conversations_pkey','tenbot_conversations_owner_id_expires_at_idx','tenbot_conversation_turns_pkey','tenbot_conversation_turns_conversation_id_id_idx']::text[])x)
  or exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'tenbot\_%' escape '\' and c.relkind not in('r','S','i')) then raise exception 'Unexpected TenBot relation inventory'; end if;
 if (select array_agg(t.typname::text order by t.typname::text collate "C") from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and (t.typname like 'tenbot\_%' escape '\' or t.typname like '\_tenbot\_%' escape '\')) is distinct from (select array_agg(x order by x collate "C") from unnest(array['tenbot_feedback','_tenbot_feedback','tenbot_feedback_history','_tenbot_feedback_history','tenbot_usage','_tenbot_usage','tenbot_conversations','_tenbot_conversations','tenbot_conversation_turns','_tenbot_conversation_turns']::text[])x) then raise exception 'Unexpected TenBot type inventory'; end if;
 if (select count(*) from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(array['tenbot_feedback','tenbot_feedback_history','tenbot_usage','tenbot_conversations','tenbot_conversation_turns']::text[]))<>2 then raise exception 'Unexpected TenBot policy count'; end if;
 if not exists(select 1 from pg_policy where polrelid='public.tenbot_conversations'::regclass and polname='tenbot_conversation_owner' and polcmd='r' and polpermissive and polroles=array[(select oid from pg_roles where rolname='authenticated')]::oid[] and polwithcheck is null and pg_get_expr(polqual,polrelid) like '%owner_id = auth.uid()%' and pg_get_expr(polqual,polrelid) like '%has_app_capability(''readOperationalData''::text)%')
  or not exists(select 1 from pg_policy where polrelid='public.tenbot_conversation_turns'::regclass and polname='tenbot_turn_owner' and polcmd='r' and polpermissive and polroles=array[(select oid from pg_roles where rolname='authenticated')]::oid[] and polwithcheck is null and pg_get_expr(polqual,polrelid) like '%owner_id = auth.uid()%' and pg_get_expr(polqual,polrelid) like '%has_app_capability(''readOperationalData''::text)%') then raise exception 'Private history owner policy mismatch'; end if;
 if public.tenbot_usage_policy() is distinct from '{"version":2,"dayRequests":300,"monthRequests":6000,"minuteRequests":6,"dayNeurons":8000,"monthNeurons":240000}'::jsonb then raise exception 'TenBot final shared budget mismatch'; end if;
 if (select count(*) from pg_constraint k where k.contype='f' and k.conrelid=any(array['public.tenbot_feedback'::regclass,'public.tenbot_feedback_history'::regclass,'public.tenbot_usage'::regclass,'public.tenbot_conversations'::regclass,'public.tenbot_conversation_turns'::regclass]))<>7
  or exists(select 1 from pg_constraint k where k.conrelid=any(array['public.tenbot_feedback'::regclass,'public.tenbot_feedback_history'::regclass,'public.tenbot_usage'::regclass,'public.tenbot_conversations'::regclass,'public.tenbot_conversation_turns'::regclass]) and not k.convalidated) then raise exception 'TenBot FK/constraint validation mismatch'; end if;
 if exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(array['tenbot_feedback','tenbot_feedback_history','tenbot_usage','tenbot_conversations','tenbot_conversation_turns']::text[]) and not t.tgisinternal) then raise exception 'Unexpected user trigger on TenBot tables'; end if;
end $tenbot_final_security$;

create temporary table tenbot_release_metadata_after on commit drop as 
select 'relation'::text kind,c.oid::text identity,md5(jsonb_build_object('name',c.relname,'namespace',c.relnamespace,'kind',c.relkind,'owner',c.relowner,'acl',c.relacl,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'options',c.reloptions,'replica',c.relreplident,'persistence',c.relpersistence,'tablespace',c.reltablespace,'view',case when c.relkind in('v','m') then pg_get_viewdef(c.oid) else null end)::text) digest
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','storage') and not(n.nspname='public' and c.relname like 'tenbot\_%' escape '\')
union all select 'column',a.attrelid::text||':'||a.attnum::text,md5((to_jsonb(a)||jsonb_build_object('default',pg_get_expr(d.adbin,d.adrelid)))::text)
 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where n.nspname in('public','storage') and not(n.nspname='public' and c.relname like 'tenbot\_%' escape '\')
union all select 'function',p.oid::text,md5(to_jsonb(p)::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','storage') and not(n.nspname='public' and p.proname like 'tenbot\_%' escape '\')
union all select 'constraint',k.oid::text,md5((to_jsonb(k)||jsonb_build_object('definition',pg_get_constraintdef(k.oid)))::text) from pg_constraint k join pg_namespace n on n.oid=k.connamespace where n.nspname in('public','storage') and not(k.conrelid in(select c.oid from pg_class c join pg_namespace cn on cn.oid=c.relnamespace where cn.nspname='public' and c.relname=any(array['tenbot_feedback','tenbot_feedback_history','tenbot_usage','tenbot_conversations','tenbot_conversation_turns']::text[])))
union all select 'policy',p.oid::text,md5(to_jsonb(p)::text) from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','storage') and not(n.nspname='public' and c.relname=any(array['tenbot_feedback','tenbot_feedback_history','tenbot_usage','tenbot_conversations','tenbot_conversation_turns']::text[]))
union all select 'trigger',t.oid::text,md5((to_jsonb(t)||jsonb_build_object('definition',pg_get_triggerdef(t.oid)))::text) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','storage') and not(n.nspname='public' and c.relname=any(array['tenbot_feedback','tenbot_feedback_history','tenbot_usage','tenbot_conversations','tenbot_conversation_turns']::text[])) and not(t.tgisinternal and exists(select 1 from pg_constraint fk where fk.oid=t.tgconstraint and fk.contype='f' and fk.conrelid in(select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(array['tenbot_feedback','tenbot_feedback_history','tenbot_usage','tenbot_conversations','tenbot_conversation_turns']::text[])) and fk.confrelid='public.app_users'::regclass))
union all select 'index',i.indexrelid::text,md5((to_jsonb(i)||jsonb_build_object('definition',pg_get_indexdef(i.indexrelid)))::text) from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','storage') and not(n.nspname='public' and c.relname=any(array['tenbot_feedback','tenbot_feedback_history','tenbot_usage','tenbot_conversations','tenbot_conversation_turns']::text[]))
union all select 'type',t.oid::text,md5(to_jsonb(t)::text) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname<>all(array['tenbot_feedback','_tenbot_feedback','tenbot_feedback_history','_tenbot_feedback_history','tenbot_usage','_tenbot_usage','tenbot_conversations','_tenbot_conversations','tenbot_conversation_turns','_tenbot_conversation_turns']::text[])
union all select 'namespace',n.oid::text,md5(jsonb_build_object('name',n.nspname,'owner',n.nspowner,'acl',n.nspacl)::text) from pg_namespace n where n.nspname in('public','storage')
union all select 'default_acl',d.oid::text,md5(to_jsonb(d)::text) from pg_default_acl d
union all select 'role_membership',m.roleid::text||':'||m.member::text||':'||m.grantor::text,md5(to_jsonb(m)::text) from pg_auth_members m
union all select 'event_trigger',e.oid::text,md5(to_jsonb(e)::text) from pg_event_trigger e
union all select 'cron',j.jobid::text,md5(to_jsonb(j)::text) from cron.job j
union all select 'web_push_transport',t.environment::text,md5(to_jsonb(t)::text) from public.web_push_transport t
;

create temporary table tenbot_release_tuples_after(relation_oid oid primary key,relation text,relation_kind text,row_count bigint,tuple_digest text) on commit drop;
do $tuple_snapshot$
declare r record;v_count bigint;v_digest text;
begin
 for r in select b.relation_oid,n.nspname schema_name,c.relname relation_name,c.relkind::text relation_kind from tenbot_release_tuples_before b join pg_class c on c.oid=b.relation_oid join pg_namespace n on n.oid=c.relnamespace order by b.relation_oid loop
  execute format('select count(*),md5(coalesce(string_agg(tuple_tag,E''\n'' order by tuple_tag),'''')) from (select t.tableoid::oid::text||'':''||t.ctid::text||'':''||t.xmin::text tuple_tag from ONLY %I.%I t) physical',r.schema_name,r.relation_name) into v_count,v_digest;
  insert into tenbot_release_tuples_after values(r.relation_oid,r.schema_name||'.'||r.relation_name,r.relation_kind,v_count,v_digest);
 end loop;
end $tuple_snapshot$;

do $tenbot_preservation$
begin
 if exists((select * from tenbot_release_tuples_before except select * from tenbot_release_tuples_after) union all(select * from tenbot_release_tuples_after except select * from tenbot_release_tuples_before)) then raise exception 'Existing public tuple metadata changed within migration'; end if;
 if exists((select * from tenbot_release_metadata_before except select * from tenbot_release_metadata_after) union all(select * from tenbot_release_metadata_after except select * from tenbot_release_metadata_before)) then raise exception 'Unrelated schema/grant/policy/trigger/config metadata changed'; end if;
 if exists((select * from tenbot_release_ledger_before except select * from supabase_migrations.schema_migrations where version<>all(array['20261027120000','20261027130000','20261027140000','20261027150000']::text[])) union all(select * from supabase_migrations.schema_migrations where version<>all(array['20261027120000','20261027130000','20261027140000','20261027150000']::text[]) except select * from tenbot_release_ledger_before)) then raise exception 'Unrelated migration ledger changed'; end if;
 if (select count(*) from supabase_migrations.schema_migrations)<>(select count(*)+4 from tenbot_release_ledger_before) or (select count(*) from supabase_migrations.schema_migrations where version=any(array['20261027120000','20261027130000','20261027140000','20261027150000']::text[]))<>4 then raise exception 'TenBot migration ledger boundary mismatch'; end if;
 if not exists(select 1 from supabase_migrations.schema_migrations where version='20261027120000' and name='tenbot_feedback_usage' and cardinality(statements)=1 and md5(statements[1])='1518200cc1b2f91b90f1530eb2beebaf') then raise exception 'TenBot migration ledger/source mismatch'; end if;
if not exists(select 1 from supabase_migrations.schema_migrations where version='20261027130000' and name='tenbot_shared_usage_pool' and cardinality(statements)=1 and md5(statements[1])='d135d410433009ac3a80f7d273b5f891') then raise exception 'TenBot migration ledger/source mismatch'; end if;
if not exists(select 1 from supabase_migrations.schema_migrations where version='20261027140000' and name='tenbot_measured_free_pool' and cardinality(statements)=1 and md5(statements[1])='e10dca0924d83f9ccefb06a5fbb3d1d5') then raise exception 'TenBot migration ledger/source mismatch'; end if;
if not exists(select 1 from supabase_migrations.schema_migrations where version='20261027150000' and name='tenbot_private_conversations' and cardinality(statements)=1 and md5(statements[1])='d6f4eb72e650e5415fdba1e833c8fd63') then raise exception 'TenBot migration ledger/source mismatch'; end if;
end $tenbot_preservation$;
select jsonb_build_object('releaseSha','6cb6cf7962ccbaa2f403e9dca3a8b2582af0599c','versions',array['20261027120000','20261027130000','20261027140000','20261027150000']::text[],'appliedAt',clock_timestamp(),'project','vxdxjhazkqhpkwdqtobp','existingPublicTuplesPreservedWithinRepeatableRead',true,'nonTenbotMetadataPreserved',true,'newInternalAppUserForeignKeyTriggersOnly',true,'unrelatedLedgerPreserved',true,'webPushTransportCronPreserved',true,'newTenbotTablesEmpty',true,'exactFunctionBodiesAndPrivilegesVerified',true,'serviceOnlyMeteringAndAppend',true,'servicePrivateHistoryLoadClearDenied',true,'legacyServiceOverloadsRevoked',true,'sharedPolicyVersion',2,'protectedPublicRelations',(select count(*) from tenbot_release_tuples_before),'tupleFingerprintMethod','ONLY physical tableoid/ctid/xmin, count and sorted MD5; no business-column reads','scopeLimit','Same-transaction snapshot preservation; concurrent later commits are outside the repeatable-read snapshot') applied;
commit;
