-- Add explicit Admin enrollment of legacy Job Update assignments and durable notification history.
-- Additive only. Requires 20260819_001; compatibility access and final RBAC enforcement are unchanged.

begin;

create index if not exists account_notifications_user_history_idx
  on public.account_notifications(user_id, created_at desc, id desc);

create or replace function public.preview_legacy_job_update_enrollment(
  p_target_user_id uuid,
  p_legacy_assignee_name text
)
returns table(
  update_id uuid,
  job_id uuid,
  job_number text,
  job_name text,
  update_created_at timestamptz,
  update_preview text,
  legacy_assignee_name text,
  is_resolved boolean,
  canonical_assignee_user_id uuid,
  canonical_assignee_name text,
  enrollment_notification_exists boolean,
  eligibility_status text,
  is_eligible boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  legacy_identity text := nullif(btrim(p_legacy_assignee_name), '');
  target_user public.app_users%rowtype;
begin
  perform public.require_app_capability('manageUsers');
  if legacy_identity is null then
    raise exception 'Legacy assignee identity is required.' using errcode = '22023';
  end if;

  select users.* into target_user
  from public.app_users users
  where users.user_id = p_target_user_id;
  if not found then raise exception 'Target TenOps account was not found.' using errcode = 'P0002'; end if;
  if not target_user.is_active then raise exception 'Target TenOps account must be active.' using errcode = '55000'; end if;

  return query
  select
    updates.id,
    updates.job_id,
    jobs.job_number::text,
    jobs.name,
    updates.created_at,
    left(updates.body, 220),
    updates.follow_up_assignee_name,
    updates.resolved_at is not null,
    updates.follow_up_assignee_user_id,
    canonical_user.display_name,
    enrollment_notice.id is not null,
    case
      when updates.resolved_at is not null then 'resolved_excluded'
      when updates.follow_up_assignee_user_id is not null
       and updates.follow_up_assignee_user_id <> p_target_user_id then 'canonical_assignee_conflict'
      when enrollment_notice.id is not null then 'already_enrolled'
      when updates.follow_up_assignee_user_id = p_target_user_id then 'assigned_to_target_missing_notification'
      else 'eligible'
    end,
    updates.resolved_at is null
      and (updates.follow_up_assignee_user_id is null or updates.follow_up_assignee_user_id = p_target_user_id)
      and enrollment_notice.id is null
  from public.job_updates updates
  join public.jobs jobs on jobs.id = updates.job_id
  left join public.app_users canonical_user on canonical_user.user_id = updates.follow_up_assignee_user_id
  left join public.account_notifications enrollment_notice
    on enrollment_notice.user_id = p_target_user_id
   and enrollment_notice.notification_key = 'job-update-legacy-assignment-enrollment:' || updates.id::text
  where updates.requires_follow_up
    and btrim(updates.follow_up_assignee_name) = legacy_identity
  order by updates.created_at desc, updates.id;
end;
$function$;

create or replace function public.execute_legacy_job_update_enrollment(
  p_target_user_id uuid,
  p_legacy_assignee_name text,
  p_approved_update_ids uuid[]
)
returns table(converted_count integer, notified_count integer, skipped_count integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  legacy_identity text := nullif(btrim(p_legacy_assignee_name), '');
  target_user public.app_users%rowtype;
  candidate record;
  converted integer := 0;
  notified integer := 0;
  skipped integer := 0;
  inserted_notification_id uuid;
begin
  perform public.require_app_capability('manageUsers');
  if legacy_identity is null then
    raise exception 'Legacy assignee identity is required.' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_approved_update_ids), 0) = 0 then
    raise exception 'At least one reviewed Job Update is required.' using errcode = '22023';
  end if;

  select users.* into target_user
  from public.app_users users
  where users.user_id = p_target_user_id
  for update;
  if not found then raise exception 'Target TenOps account was not found.' using errcode = 'P0002'; end if;
  if not target_user.is_active then raise exception 'Target TenOps account must be active.' using errcode = '55000'; end if;

  for candidate in
    select updates.*, jobs.job_number, jobs.name as job_name
    from public.job_updates updates
    join public.jobs jobs on jobs.id = updates.job_id
    where updates.requires_follow_up
      and updates.id = any(p_approved_update_ids)
      and btrim(updates.follow_up_assignee_name) = legacy_identity
    order by updates.created_at, updates.id
    for update of updates
  loop
    if candidate.resolved_at is not null
       or (candidate.follow_up_assignee_user_id is not null
           and candidate.follow_up_assignee_user_id <> p_target_user_id) then
      skipped := skipped + 1;
      continue;
    end if;

    if candidate.follow_up_assignee_user_id is null then
      update public.job_updates
      set follow_up_assignee_user_id = p_target_user_id
      where id = candidate.id
        and resolved_at is null
        and follow_up_assignee_user_id is null;
      if not found then
        skipped := skipped + 1;
        continue;
      end if;
      converted := converted + 1;
    end if;

    inserted_notification_id := null;
    insert into public.account_notifications(
      user_id, notification_key, notification_type, title, body, metadata
    ) values (
      p_target_user_id,
      'job-update-legacy-assignment-enrollment:' || candidate.id::text,
      'job_update_legacy_assignment_enrollment',
      'Outstanding Job Update assigned to you',
      coalesce(nullif(btrim(candidate.job_number), '') || ' — ', '') || candidate.job_name || E'\n' || left(candidate.body, 180),
      jsonb_build_object(
        'job_id', candidate.job_id,
        'update_id', candidate.id,
        'job_number', candidate.job_number,
        'job_name', candidate.job_name,
        'purpose', 'legacy_assignment_enrollment'
      )
    )
    on conflict (user_id, notification_key) do nothing
    returning id into inserted_notification_id;
    if inserted_notification_id is not null then notified := notified + 1; end if;
  end loop;

  return query select converted, notified, skipped;
end;
$function$;

create or replace function public.list_my_account_notification_history(p_limit integer default 100)
returns table(
  id uuid,
  notification_type text,
  title text,
  body text,
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
begin
  perform public.require_app_capability('readOperationalData');
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception 'Notification history limit must be between 1 and 200.' using errcode = '22023';
  end if;
  return query
  select notifications.id, notifications.notification_type, notifications.title,
    notifications.body, notifications.metadata, notifications.read_at, notifications.created_at
  from public.account_notifications notifications
  where notifications.user_id = auth.uid()
  order by notifications.created_at desc, notifications.id desc
  limit p_limit;
end;
$function$;

create or replace function public.mark_all_my_account_notifications_read()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  changed_count integer;
begin
  perform public.require_app_capability('readOperationalData');
  update public.account_notifications
  set read_at = clock_timestamp()
  where user_id = auth.uid() and read_at is null;
  get diagnostics changed_count = row_count;
  return changed_count;
end;
$function$;

create or replace function public.mark_my_account_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  perform public.require_app_capability('readOperationalData');
  update public.account_notifications
  set read_at = coalesce(read_at, clock_timestamp())
  where id = p_notification_id and user_id = auth.uid();
  if not found then raise exception 'Notification was not found.' using errcode = 'P0002'; end if;
end;
$function$;

alter function public.preview_legacy_job_update_enrollment(uuid,text) owner to postgres;
alter function public.execute_legacy_job_update_enrollment(uuid,text,uuid[]) owner to postgres;
alter function public.list_my_account_notification_history(integer) owner to postgres;
alter function public.mark_all_my_account_notifications_read() owner to postgres;
alter function public.mark_my_account_notification_read(uuid) owner to postgres;

revoke all on function public.preview_legacy_job_update_enrollment(uuid,text) from public;
revoke all on function public.execute_legacy_job_update_enrollment(uuid,text,uuid[]) from public;
revoke all on function public.list_my_account_notification_history(integer) from public;
revoke all on function public.mark_all_my_account_notifications_read() from public;
revoke all on function public.mark_my_account_notification_read(uuid) from public;

grant execute on function public.preview_legacy_job_update_enrollment(uuid,text) to authenticated;
grant execute on function public.execute_legacy_job_update_enrollment(uuid,text,uuid[]) to authenticated;
grant execute on function public.list_my_account_notification_history(integer) to authenticated;
grant execute on function public.mark_all_my_account_notifications_read() to authenticated;
grant execute on function public.mark_my_account_notification_read(uuid) to authenticated;

commit;
