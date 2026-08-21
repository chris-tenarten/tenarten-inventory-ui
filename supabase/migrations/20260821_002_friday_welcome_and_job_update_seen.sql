-- One-time Friday onboarding reset and durable per-account Job Update seen state.
-- Additive only. Compatibility access and final RBAC enforcement remain unchanged.

begin;

update public.account_notifications notifications
set read_at = null,
    metadata = notifications.metadata || jsonb_build_object(
      'friday_welcome_reset_v1', true,
      'friday_welcome_reset_at', statement_timestamp()
    )
from public.app_users users
where notifications.user_id = users.user_id
  and users.is_active
  and notifications.notification_key = 'account-welcome-v1'
  and notifications.notification_type = 'welcome'
  and notifications.read_at is not null
  and not coalesce((notifications.metadata ->> 'friday_welcome_reset_v1')::boolean, false);

create table if not exists public.job_update_seen_state (
  user_id uuid not null references public.app_users(user_id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  last_seen_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

comment on table public.job_update_seen_state is
  'Per-account watermark for general Production Job Update activity; canonical mentions and assignments remain account notifications.';

alter table public.job_update_seen_state enable row level security;
drop policy if exists job_update_seen_state_read_self on public.job_update_seen_state;
create policy job_update_seen_state_read_self on public.job_update_seen_state
  for select to authenticated using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.app_users users
      where users.user_id = auth.uid()
        and users.is_active
    )
  );
revoke all on public.job_update_seen_state from public, anon;
grant select on public.job_update_seen_state to authenticated;
grant all on public.job_update_seen_state to service_role;

-- Existing Update history is the rollout baseline, so applying this migration does
-- not make every historical conversation appear newly unseen.
insert into public.job_update_seen_state(user_id, job_id, last_seen_at)
select users.user_id, updates.job_id, max(updates.created_at)
from public.app_users users
cross join public.job_updates updates
where users.is_active
group by users.user_id, updates.job_id
on conflict (user_id, job_id) do nothing;

create or replace function public.list_my_unseen_job_update_jobs()
returns table(job_id uuid, unseen_count bigint)
language plpgsql stable security definer
set search_path = pg_catalog, public
as $function$
begin
  perform public.require_app_capability('readOperationalData');
  return query
  select updates.job_id, count(*)::bigint
  from public.job_updates updates
  left join public.job_update_seen_state seen
    on seen.user_id = auth.uid() and seen.job_id = updates.job_id
  where updates.created_at > coalesce(seen.last_seen_at, '-infinity'::timestamptz)
    and updates.author_user_id is distinct from auth.uid()
    and not exists (
      select 1 from public.job_update_mentions mentions
      where mentions.job_update_id = updates.id and mentions.user_id = auth.uid()
    )
    and not coalesce((
      updates.requires_follow_up
      and updates.follow_up_assignee_user_id = auth.uid()
    ), false)
  group by updates.job_id
  order by updates.job_id;
end;
$function$;

create or replace function public.mark_my_job_updates_seen(p_job_id uuid)
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $function$
declare
  latest_update_at timestamptz;
begin
  perform public.require_app_capability('readOperationalData');
  if not exists (select 1 from public.jobs where id = p_job_id) then
    raise exception 'Production Job was not found.' using errcode = 'P0002';
  end if;

  select max(created_at) into latest_update_at
  from public.job_updates
  where job_id = p_job_id;

  if latest_update_at is null then return; end if;

  insert into public.job_update_seen_state(user_id, job_id, last_seen_at, updated_at)
  values (auth.uid(), p_job_id, latest_update_at, statement_timestamp())
  on conflict (user_id, job_id) do update
  set last_seen_at = greatest(public.job_update_seen_state.last_seen_at, excluded.last_seen_at),
      updated_at = statement_timestamp();
end;
$function$;

alter function public.list_my_unseen_job_update_jobs() owner to postgres;
alter function public.mark_my_job_updates_seen(uuid) owner to postgres;
revoke all on function public.list_my_unseen_job_update_jobs() from public;
revoke all on function public.mark_my_job_updates_seen(uuid) from public;
grant execute on function public.list_my_unseen_job_update_jobs() to authenticated;
grant execute on function public.mark_my_job_updates_seen(uuid) to authenticated;

create or replace function public.tenops_account_preferences_valid(p_preferences jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, public
as $function$
declare
  preference_key text;
  preference_value jsonb;
  text_value text;
begin
  if p_preferences is null or jsonb_typeof(p_preferences) <> 'object' then return false; end if;

  for preference_key, preference_value in select key, value from jsonb_each(p_preferences)
  loop
    if preference_key = 'appearance' then
      if preference_value not in ('"light"'::jsonb, '"dark"'::jsonb) then return false; end if;
    elsif preference_key = 'language' then
      if preference_value not in ('"en"'::jsonb, '"es"'::jsonb) then return false; end if;
    elsif preference_key = 'display_size' then
      if preference_value not in ('"compact"'::jsonb, '"default"'::jsonb, '"large"'::jsonb) then return false; end if;
    elsif preference_key = 'production_view' then
      if preference_value not in ('"overview"'::jsonb, '"table"'::jsonb, '"timeline"'::jsonb) then return false; end if;
    elsif preference_key = 'production_arrangement' then
      if preference_value not in ('"stage"'::jsonb, '"deadline"'::jsonb, '"labor"'::jsonb) then return false; end if;
    elsif preference_key = 'timeline_zoom' then
      if preference_value not in ('"days"'::jsonb, '"weeks"'::jsonb, '"months"'::jsonb, '"year"'::jsonb) then return false; end if;
    elsif preference_key = 'timeline_row_density' then
      if preference_value not in ('"compact"'::jsonb, '"standard"'::jsonb, '"comfortable"'::jsonb) then return false; end if;
    elsif preference_key = 'collapsed_phase_display' then
      if preference_value not in ('"compact"'::jsonb, '"fill"'::jsonb) then return false; end if;
    elsif preference_key = 'production_table_hidden_columns' then
      if jsonb_typeof(preference_value) <> 'array' then return false; end if;
      for text_value in select jsonb_array_elements_text(preference_value)
      loop
        if text_value not in (
          'customer', 'estimate', 'workOrder', 'deposit', 'delivery', 'start', 'finish',
          'labor', 'days', 'colorPlate', 'sample', 'approval', 'operations', 'material',
          'status', 'remarks'
        ) then return false; end if;
      end loop;
      if jsonb_array_length(preference_value) <> (
        select count(distinct value) from jsonb_array_elements_text(preference_value)
      ) then return false; end if;
    elsif preference_key = 'transmittal_sender' then
      if jsonb_typeof(preference_value) <> 'object' then return false; end if;
      if exists (
        select 1 from jsonb_object_keys(preference_value) key
        where key not in ('name', 'phone', 'email')
      ) then return false; end if;
      if (select count(*) from jsonb_object_keys(preference_value)) > 3 then return false; end if;
      if exists (
        select 1 from jsonb_each(preference_value) entry
        where jsonb_typeof(entry.value) <> 'string' or length(entry.value #>> '{}') > 240
      ) then return false; end if;
    else
      return false;
    end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$function$;

create table if not exists public.account_user_preferences (
  user_id uuid primary key references public.app_users(user_id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_user_preferences_valid check (public.tenops_account_preferences_valid(preferences))
);

comment on table public.account_user_preferences is
  'Validated durable TenOps operator preferences owned by the canonical authenticated app user.';

drop trigger if exists account_user_preferences_touch_updated_at on public.account_user_preferences;
create trigger account_user_preferences_touch_updated_at
before update on public.account_user_preferences
for each row execute function public.tenops_touch_updated_at();

alter table public.account_user_preferences enable row level security;
drop policy if exists account_user_preferences_read_self on public.account_user_preferences;
create policy account_user_preferences_read_self on public.account_user_preferences
  for select to authenticated using (
    user_id = auth.uid()
    and exists (select 1 from public.app_users users where users.user_id = auth.uid() and users.is_active)
  );
revoke all on public.account_user_preferences from public, anon, authenticated;
grant all on public.account_user_preferences to service_role;

create or replace function public.get_my_account_preferences()
returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, public
as $function$
declare
  stored_preferences jsonb;
begin
  if not exists (
    select 1 from public.app_users users where users.user_id = auth.uid() and users.is_active
  ) then raise exception 'An active TenOps account is required.' using errcode = '42501'; end if;

  select preferences into stored_preferences
  from public.account_user_preferences
  where user_id = auth.uid();
  return coalesce(stored_preferences, '{}'::jsonb);
end;
$function$;

create or replace function public.set_my_account_preference(p_key text, p_value jsonb)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public
as $function$
declare
  next_preferences jsonb;
begin
  if not exists (
    select 1 from public.app_users users where users.user_id = auth.uid() and users.is_active
  ) then raise exception 'An active TenOps account is required.' using errcode = '42501'; end if;
  if p_key is null or btrim(p_key) = '' then
    raise exception 'Preference key is required.' using errcode = '22023';
  end if;

  next_preferences := jsonb_build_object(p_key, p_value);
  if not public.tenops_account_preferences_valid(next_preferences) then
    raise exception 'Unsupported TenOps account preference.' using errcode = '22023';
  end if;

  insert into public.account_user_preferences(user_id, preferences)
  values (auth.uid(), next_preferences)
  on conflict (user_id) do update
  set preferences = public.account_user_preferences.preferences || excluded.preferences
  returning preferences into next_preferences;
  return next_preferences;
end;
$function$;

alter function public.tenops_account_preferences_valid(jsonb) owner to postgres;
alter function public.get_my_account_preferences() owner to postgres;
alter function public.set_my_account_preference(text,jsonb) owner to postgres;
revoke all on function public.tenops_account_preferences_valid(jsonb) from public;
revoke all on function public.get_my_account_preferences() from public;
revoke all on function public.set_my_account_preference(text,jsonb) from public;
grant execute on function public.get_my_account_preferences() to authenticated;
grant execute on function public.set_my_account_preference(text,jsonb) to authenticated;

commit;
