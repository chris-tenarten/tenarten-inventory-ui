begin;

create table public.whiteboard_cards (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 12000),
  owner text check (owner is null or length(owner) <= 200),
  category text not null default 'internal' check (category in ('internal','customer','vendor','logistics','blocker','reference')),
  status text not null default 'open' check (status in ('open','planned','in_progress','waiting','done')),
  start_date date,
  end_date date,
  timeline_behavior text not null default 'whiteboard_only' check (timeline_behavior in ('overlay','pause','whiteboard_only')),
  progress_behavior text not null default 'none' check (progress_behavior in ('none','included')),
  blocked_by_card_id uuid references public.whiteboard_cards(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text check (created_by is null or length(created_by) <= 200),
  constraint whiteboard_card_date_range check (start_date is null or end_date is null or end_date >= start_date),
  constraint whiteboard_card_timeline_dates check (timeline_behavior = 'whiteboard_only' or (start_date is not null and end_date is not null)),
  constraint whiteboard_card_not_self_blocked check (blocked_by_card_id is null or blocked_by_card_id <> id)
);

create index whiteboard_cards_job_idx on public.whiteboard_cards(job_id, status, updated_at desc);
create index whiteboard_cards_owner_idx on public.whiteboard_cards(lower(owner)) where owner is not null;
create index whiteboard_cards_category_idx on public.whiteboard_cards(category, status);
create index whiteboard_cards_timeline_idx on public.whiteboard_cards(job_id, start_date, end_date) where timeline_behavior <> 'whiteboard_only';

create function public.set_whiteboard_card_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger trg_whiteboard_cards_updated_at before update on public.whiteboard_cards
for each row execute function public.set_whiteboard_card_updated_at();

create function public.validate_whiteboard_card_dependency()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.blocked_by_card_id is not null and not exists (
    select 1 from public.whiteboard_cards dependency
    where dependency.id = new.blocked_by_card_id and dependency.job_id = new.job_id
  ) then
    raise exception 'A Whiteboard dependency must belong to the same Production job.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger trg_whiteboard_cards_dependency before insert or update of job_id, blocked_by_card_id on public.whiteboard_cards
for each row execute function public.validate_whiteboard_card_dependency();

alter table public.whiteboard_cards enable row level security;
create policy "Allow anon read whiteboard cards" on public.whiteboard_cards for select to anon using (true);
create policy "Allow anon insert whiteboard cards" on public.whiteboard_cards for insert to anon with check (true);
create policy "Allow anon update whiteboard cards" on public.whiteboard_cards for update to anon using (true) with check (true);
create policy "Allow anon delete whiteboard cards" on public.whiteboard_cards for delete to anon using (true);
create policy "Allow authenticated read whiteboard cards" on public.whiteboard_cards for select to authenticated using (true);
create policy "Allow authenticated insert whiteboard cards" on public.whiteboard_cards for insert to authenticated with check (true);
create policy "Allow authenticated update whiteboard cards" on public.whiteboard_cards for update to authenticated using (true) with check (true);
create policy "Allow authenticated delete whiteboard cards" on public.whiteboard_cards for delete to authenticated using (true);

grant select, insert, update, delete on public.whiteboard_cards to anon, authenticated;
grant all on public.whiteboard_cards to service_role;
revoke all on function public.set_whiteboard_card_updated_at() from public, anon, authenticated, service_role;
revoke all on function public.validate_whiteboard_card_dependency() from public, anon, authenticated, service_role;

comment on table public.whiteboard_cards is 'Optional job-linked planning cards. Production jobs and their canonical schedule remain authoritative.';
comment on column public.whiteboard_cards.timeline_behavior is 'overlay annotates Production, pause visualizes an interruption, whiteboard_only remains off Timeline. No value changes jobs dates.';
comment on column public.whiteboard_cards.progress_behavior is 'included contributes one unweighted card to Whiteboard completion; none does not.';

commit;
