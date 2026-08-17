begin;

alter table public.job_updates
  add column edited_at timestamptz;

comment on column public.job_updates.edited_at is
  'Time of the latest successful edit to user-authored Job Update content or unresolved follow-up state. Null means the update has never been edited.';

comment on table public.job_updates is
  'Production job conversation. Unresolved updates may be corrected through edit_job_update; follow-up updates may be resolved through resolve_job_update.';

create or replace function public.edit_job_update(
  p_update_id uuid,
  p_body text,
  p_requires_follow_up boolean,
  p_follow_up_assignee_name text
)
returns public.job_updates
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  update_body text := nullif(trim(p_body), '');
  assignee text := nullif(trim(p_follow_up_assignee_name), '');
  desired_assignee text;
  existing_update public.job_updates;
  edited_update public.job_updates;
begin
  if p_update_id is null then
    raise exception 'Job Update ID is required.' using errcode = '22023';
  end if;

  if update_body is null then
    raise exception 'Job Update body is required.' using errcode = '22023';
  end if;

  if p_requires_follow_up is null then
    raise exception 'Needs-attention state is required.' using errcode = '22023';
  end if;

  if p_requires_follow_up and assignee is null then
    raise exception 'Select who needs to resolve this update.' using errcode = '22023';
  end if;

  if p_requires_follow_up then
    desired_assignee := assignee;
  else
    desired_assignee := null;
  end if;

  select *
  into existing_update
  from public.job_updates
  where id = p_update_id
  for update;

  if not found then
    raise exception 'Job Update was not found.' using errcode = 'P0002';
  end if;

  if existing_update.resolved_at is not null then
    raise exception 'Resolved Job Updates cannot be edited.' using errcode = '55000';
  end if;

  if existing_update.body = update_body
    and existing_update.requires_follow_up = p_requires_follow_up
    and existing_update.follow_up_assignee_name is not distinct from desired_assignee
  then
    return existing_update;
  end if;

  update public.job_updates
  set body = update_body,
      requires_follow_up = p_requires_follow_up,
      follow_up_assignee_name = desired_assignee,
      edited_at = now()
  where id = p_update_id
    and resolved_at is null
  returning * into edited_update;

  if not found then
    raise exception 'Resolved Job Updates cannot be edited.' using errcode = '55000';
  end if;

  return edited_update;
end;
$function$;

alter function public.edit_job_update(uuid, text, boolean, text)
  owner to postgres;

revoke all on function public.edit_job_update(uuid, text, boolean, text)
  from public;
grant execute on function public.edit_job_update(uuid, text, boolean, text)
  to anon, authenticated, service_role;

commit;
