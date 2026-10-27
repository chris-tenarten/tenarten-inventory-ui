-- Local candidate only. No hosted application authorized.
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
