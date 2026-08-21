-- Add canonical multi-user mentions and durable account notifications to Job Updates.
-- Additive only. Compatibility access remains available; final RBAC enforcement is unchanged.

begin;

create table public.job_update_mentions (
  job_update_id uuid not null references public.job_updates(id) on delete cascade,
  user_id uuid not null references public.app_users(user_id),
  created_at timestamptz not null default now(),
  primary key (job_update_id, user_id)
);

create index job_update_mentions_user_idx
  on public.job_update_mentions(user_id, created_at desc);

comment on table public.job_update_mentions is
  'Canonical account identities explicitly mentioned by a persisted Production Job Update.';

alter table public.job_update_mentions enable row level security;
create policy job_update_mentions_authenticated_read on public.job_update_mentions
  for select to authenticated using (public.has_app_capability('readOperationalData'));
revoke all on public.job_update_mentions from public, anon;
grant select on public.job_update_mentions to authenticated;
grant all on public.job_update_mentions to service_role;

create or replace function public.list_active_job_update_collaborators()
returns table(user_id uuid, display_name text, role text)
language plpgsql stable security definer
set search_path = pg_catalog, public
as $function$
begin
  perform public.require_app_capability('readOperationalData');
  return query
  select users.user_id, users.display_name, users.role
  from public.app_users users
  where users.is_active
  order by lower(users.display_name), users.user_id;
end;
$function$;

create or replace function public.list_job_update_mentions(p_job_id uuid)
returns table(update_id uuid, user_id uuid, display_name text, is_active boolean)
language plpgsql stable security definer
set search_path = pg_catalog, public
as $function$
begin
  perform public.require_app_capability('readOperationalData');
  return query
  select mentions.job_update_id, users.user_id, users.display_name, users.is_active
  from public.job_update_mentions mentions
  join public.job_updates updates on updates.id = mentions.job_update_id
  join public.app_users users on users.user_id = mentions.user_id
  where updates.job_id = p_job_id
  order by mentions.created_at, users.display_name;
end;
$function$;

create or replace function public.notify_job_update_account(
  p_user_id uuid,
  p_update public.job_updates,
  p_purpose text
)
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $function$
declare
  selected_job public.jobs%rowtype;
  notification_title text;
begin
  if p_user_id is null or p_user_id = auth.uid() then return; end if;
  if p_purpose not in ('mention', 'assignment') then
    raise exception 'Invalid Job Update notification purpose.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.app_users where user_id = p_user_id and is_active) then
    raise exception 'Job Update recipient must be an active TenOps user.' using errcode = '22023';
  end if;

  select * into selected_job from public.jobs where id = p_update.job_id;
  if not found then raise exception 'Production Job was not found.' using errcode = 'P0002'; end if;
  notification_title := case p_purpose
    when 'mention' then 'You were mentioned in a Job Update'
    else 'A Job Update was assigned to you'
  end;

  insert into public.account_notifications(
    user_id, notification_key, notification_type, title, body, metadata
  ) values (
    p_user_id,
    'job-update-' || p_purpose || ':' || p_update.id::text,
    'job_update_' || p_purpose,
    notification_title,
    coalesce(nullif(btrim(selected_job.job_number), '') || ' · ', '') || selected_job.name || E'\n' || left(p_update.body, 180),
    jsonb_build_object(
      'job_id', p_update.job_id,
      'update_id', p_update.id,
      'job_number', selected_job.job_number,
      'job_name', selected_job.name,
      'purpose', p_purpose
    )
  ) on conflict (user_id, notification_key) do nothing;
end;
$function$;

create or replace function public.sync_job_update_mentions(
  p_update public.job_updates,
  p_mentioned_user_ids uuid[]
)
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $function$
declare
  mentioned_user_id uuid;
begin
  if auth.uid() is null and coalesce(cardinality(p_mentioned_user_ids), 0) > 0 then
    raise exception 'Sign in to mention a TenOps user.' using errcode = '42501';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_mentioned_user_ids, array[]::uuid[])) candidate(user_id)
    left join public.app_users users on users.user_id = candidate.user_id and users.is_active
    where users.user_id is null
  ) then
    raise exception 'Mentions may target active TenOps users only.' using errcode = '22023';
  end if;

  delete from public.job_update_mentions
  where job_update_id = p_update.id
    and not (user_id = any(coalesce(p_mentioned_user_ids, array[]::uuid[])));

  for mentioned_user_id in
    insert into public.job_update_mentions(job_update_id, user_id)
    select p_update.id, candidate.user_id
    from (select distinct unnest(coalesce(p_mentioned_user_ids, array[]::uuid[])) user_id) candidate
    on conflict do nothing
    returning user_id
  loop
    perform public.notify_job_update_account(mentioned_user_id, p_update, 'mention');
  end loop;
end;
$function$;

create or replace function public.create_job_update_with_mentions(
  p_job_id uuid,
  p_author_name text,
  p_body text,
  p_requires_follow_up boolean,
  p_follow_up_assignee_name text,
  p_follow_up_assignee_user_id uuid,
  p_mentioned_user_ids uuid[] default array[]::uuid[]
)
returns public.job_updates
language plpgsql security definer
set search_path = pg_catalog, public
as $function$
declare
  update_body text := nullif(btrim(p_body), '');
  author_name text := nullif(btrim(p_author_name), '');
  assignee_name text := nullif(btrim(p_follow_up_assignee_name), '');
  caller_user public.app_users%rowtype;
  selected_assignee public.app_users%rowtype;
  created_update public.job_updates;
begin
  if update_body is null then raise exception 'Job Update body is required.' using errcode = '22023'; end if;
  if p_requires_follow_up is null then raise exception 'Needs-attention state is required.' using errcode = '22023'; end if;

  if auth.uid() is not null then
    perform public.require_app_capability('postJobUpdate');
    select * into caller_user from public.app_users where user_id = auth.uid() and is_active;
    if not found then raise exception 'An active TenOps account is required.' using errcode = '42501'; end if;
    author_name := caller_user.display_name;
  elsif author_name is null then
    raise exception 'Your name is required.' using errcode = '22023';
  elsif p_follow_up_assignee_user_id is not null then
    raise exception 'Sign in to assign a Job Update to a TenOps account.' using errcode = '42501';
  end if;

  if p_requires_follow_up and p_follow_up_assignee_user_id is not null then
    if auth.uid() is not null then
      perform public.require_app_capability('assignJobUpdate');
    end if;
    select * into selected_assignee from public.app_users
    where user_id = p_follow_up_assignee_user_id and is_active;
    if not found then raise exception 'Select an active TenOps user.' using errcode = '22023'; end if;
    assignee_name := selected_assignee.display_name;
  end if;
  if auth.uid() is not null and p_requires_follow_up and p_follow_up_assignee_user_id is null then
    raise exception 'Select an active TenOps user.' using errcode = '22023';
  end if;
  if p_requires_follow_up and assignee_name is null then
    raise exception 'Select who needs to resolve this update.' using errcode = '22023';
  end if;

  insert into public.job_updates(
    job_id, author_name, author_user_id, body, requires_follow_up,
    follow_up_assignee_name, follow_up_assignee_user_id
  ) values (
    p_job_id, author_name, auth.uid(), update_body, p_requires_follow_up,
    case when p_requires_follow_up then assignee_name end,
    case when p_requires_follow_up then p_follow_up_assignee_user_id end
  ) returning * into created_update;

  perform public.sync_job_update_mentions(created_update, p_mentioned_user_ids);
  if created_update.follow_up_assignee_user_id is not null then
    perform public.notify_job_update_account(created_update.follow_up_assignee_user_id, created_update, 'assignment');
  end if;
  return created_update;
end;
$function$;

create or replace function public.edit_job_update_with_mentions(
  p_update_id uuid,
  p_body text,
  p_requires_follow_up boolean,
  p_follow_up_assignee_name text,
  p_follow_up_assignee_user_id uuid,
  p_mentioned_user_ids uuid[] default array[]::uuid[]
)
returns public.job_updates
language plpgsql security definer
set search_path = pg_catalog, public
as $function$
declare
  existing_update public.job_updates;
  edited_update public.job_updates;
  selected_assignee public.app_users%rowtype;
  assignee_name text := nullif(btrim(p_follow_up_assignee_name), '');
  mentions_changed boolean;
  desired_assignee_user_id uuid;
begin
  if auth.uid() is null and p_follow_up_assignee_user_id is not null then
    raise exception 'Sign in to assign a Job Update to a TenOps account.' using errcode = '42501';
  end if;
  if auth.uid() is not null then
    perform public.require_app_capability('editJobUpdate');
  end if;
  select * into existing_update from public.job_updates where id = p_update_id for update;
  if not found then raise exception 'Job Update was not found.' using errcode = 'P0002'; end if;
  if existing_update.resolved_at is not null then raise exception 'Resolved Job Updates cannot be edited.' using errcode = '55000'; end if;

  if auth.uid() is null then
    mentions_changed := false;
    desired_assignee_user_id := case
      when p_requires_follow_up
       and existing_update.follow_up_assignee_name is not distinct from assignee_name
      then existing_update.follow_up_assignee_user_id
    end;
  else
    desired_assignee_user_id := case when p_requires_follow_up then p_follow_up_assignee_user_id end;
    select coalesce(array_agg(mentions.user_id order by mentions.user_id), array[]::uuid[])
           is distinct from
           coalesce((select array_agg(candidate.user_id order by candidate.user_id)
                     from (select distinct unnest(coalesce(p_mentioned_user_ids, array[]::uuid[])) user_id) candidate), array[]::uuid[])
    into mentions_changed
    from public.job_update_mentions mentions
    where mentions.job_update_id = p_update_id;
  end if;

  if p_requires_follow_up and p_follow_up_assignee_user_id is not null then
    select * into selected_assignee from public.app_users
    where user_id = p_follow_up_assignee_user_id and is_active;
    if not found then raise exception 'Select an active TenOps user.' using errcode = '22023'; end if;
    assignee_name := selected_assignee.display_name;
  end if;
  if auth.uid() is not null and p_requires_follow_up and p_follow_up_assignee_user_id is null then
    raise exception 'Select an active TenOps user.' using errcode = '22023';
  end if;
  if auth.uid() is not null and (
    existing_update.requires_follow_up is distinct from p_requires_follow_up
    or existing_update.follow_up_assignee_user_id is distinct from desired_assignee_user_id
  ) then
    perform public.require_app_capability('assignJobUpdate');
  end if;

  edited_update := public.edit_job_update(
    p_update_id, p_body, p_requires_follow_up,
    case when p_requires_follow_up then assignee_name end
  );

  if edited_update.follow_up_assignee_user_id is distinct from
     desired_assignee_user_id then
    update public.job_updates
    set follow_up_assignee_user_id = desired_assignee_user_id,
        edited_at = clock_timestamp()
    where id = p_update_id
    returning * into edited_update;
  end if;

  if auth.uid() is not null then
    perform public.sync_job_update_mentions(edited_update, p_mentioned_user_ids);
  end if;
  if mentions_changed then
    update public.job_updates set edited_at = clock_timestamp()
    where id = p_update_id returning * into edited_update;
  end if;
  if auth.uid() is not null
     and edited_update.follow_up_assignee_user_id is not null
     and edited_update.follow_up_assignee_user_id is distinct from existing_update.follow_up_assignee_user_id then
    perform public.notify_job_update_account(edited_update.follow_up_assignee_user_id, edited_update, 'assignment');
  end if;
  return edited_update;
end;
$function$;

create or replace function public.resolve_job_update_with_identity(
  p_update_id uuid,
  p_resolved_by_name text,
  p_resolution_message text,
  p_resolved_by_user_id uuid
)
returns public.job_updates
language plpgsql security definer
set search_path = pg_catalog, public
as $function$
declare
  resolver_name text := nullif(btrim(p_resolved_by_name), '');
  resolver_user_id uuid;
  caller_user public.app_users%rowtype;
  resolved_update public.job_updates;
begin
  if auth.uid() is not null then
    perform public.require_app_capability('resolveJobUpdate');
    select * into caller_user from public.app_users
    where user_id = auth.uid() and is_active;
    if not found then raise exception 'An active TenOps account is required.' using errcode = '42501'; end if;
    resolver_name := caller_user.display_name;
    resolver_user_id := caller_user.user_id;
  else
    if p_resolved_by_user_id is not null then
      raise exception 'Sign in to resolve as a TenOps account.' using errcode = '42501';
    end if;
    resolver_user_id := null;
  end if;
  resolved_update := public.resolve_job_update(p_update_id, resolver_name, p_resolution_message);
  update public.job_updates set resolved_by_user_id = resolver_user_id
  where id = p_update_id returning * into resolved_update;
  return resolved_update;
end;
$function$;

alter function public.list_active_job_update_collaborators() owner to postgres;
alter function public.list_job_update_mentions(uuid) owner to postgres;
alter function public.notify_job_update_account(uuid, public.job_updates, text) owner to postgres;
alter function public.sync_job_update_mentions(public.job_updates, uuid[]) owner to postgres;
alter function public.create_job_update_with_mentions(uuid,text,text,boolean,text,uuid,uuid[]) owner to postgres;
alter function public.edit_job_update_with_mentions(uuid,text,boolean,text,uuid,uuid[]) owner to postgres;
alter function public.resolve_job_update_with_identity(uuid,text,text,uuid) owner to postgres;

revoke all on function public.list_active_job_update_collaborators() from public;
revoke all on function public.list_job_update_mentions(uuid) from public;
revoke all on function public.notify_job_update_account(uuid, public.job_updates, text) from public;
revoke all on function public.sync_job_update_mentions(public.job_updates, uuid[]) from public;
revoke all on function public.create_job_update_with_mentions(uuid,text,text,boolean,text,uuid,uuid[]) from public;
revoke all on function public.edit_job_update_with_mentions(uuid,text,boolean,text,uuid,uuid[]) from public;
revoke all on function public.resolve_job_update_with_identity(uuid,text,text,uuid) from public;

grant execute on function public.list_active_job_update_collaborators() to authenticated;
grant execute on function public.list_job_update_mentions(uuid) to authenticated;
grant execute on function public.create_job_update_with_mentions(uuid,text,text,boolean,text,uuid,uuid[]) to anon, authenticated, service_role;
grant execute on function public.edit_job_update_with_mentions(uuid,text,boolean,text,uuid,uuid[]) to anon, authenticated, service_role;
grant execute on function public.resolve_job_update_with_identity(uuid,text,text,uuid) to anon, authenticated, service_role;

commit;
