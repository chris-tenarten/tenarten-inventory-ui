-- Add authenticated, account-native deletion for Job Updates.
-- Existing Job files and account notification history remain intact.

begin;

insert into public.app_role_capabilities(role, capability)
values ('admin', 'deleteJobUpdate')
on conflict do nothing;

create or replace function public.delete_job_update(p_update_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  caller_user public.app_users%rowtype;
  selected_update public.job_updates%rowtype;
  selected_job public.jobs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select users.* into caller_user
  from public.app_users users
  where users.user_id = auth.uid() and users.is_active;
  if not found then
    raise exception 'An active TenOps account is required.' using errcode = '42501';
  end if;

  select updates.* into selected_update
  from public.job_updates updates
  where updates.id = p_update_id
  for update;
  if not found then
    raise exception 'Job Update was not found.' using errcode = 'P0002';
  end if;

  if selected_update.author_user_id is distinct from caller_user.user_id then
    perform public.require_app_capability('deleteJobUpdate');
  end if;

  select jobs.* into selected_job
  from public.jobs jobs
  where jobs.id = selected_update.job_id;
  if not found then
    raise exception 'Production Job was not found.' using errcode = 'P0002';
  end if;

  update public.account_notifications notifications
  set body = coalesce(nullif(btrim(selected_job.job_number), '') || ' · ', '')
      || selected_job.name || E'\nThis Job Update is no longer available.',
      metadata = notifications.metadata || jsonb_build_object(
        'source_available', false,
        'source_deleted_at', clock_timestamp()
      )
  where notifications.notification_type in (
      'job_update_mention',
      'job_update_assignment',
      'job_update_legacy_assignment_enrollment'
    )
    and notifications.metadata ->> 'update_id' = selected_update.id::text;

  delete from public.job_updates where id = selected_update.id;
end;
$function$;

alter function public.delete_job_update(uuid) owner to postgres;
revoke all on function public.delete_job_update(uuid) from public, anon;
grant execute on function public.delete_job_update(uuid) to authenticated;

comment on function public.delete_job_update(uuid) is
  'Deletes a Job Update for its canonical author or an Admin while preserving files and tombstoning account notification history.';

notify pgrst, 'reload schema';

commit;
