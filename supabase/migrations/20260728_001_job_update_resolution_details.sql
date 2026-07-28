begin;

alter table public.job_updates
  add column resolution_message text;

comment on column public.job_updates.resolution_message is
  'Optional plain-text operational outcome recorded when a needs-attention update is resolved.';

alter table public.job_updates
  drop constraint job_updates_resolution_check;

alter table public.job_updates
  add constraint job_updates_resolution_check check (
    (
      requires_follow_up
      and (
        (
          resolved_at is null
          and resolved_by_name is null
          and resolution_message is null
        )
        or
        (
          resolved_at is not null
          and nullif(trim(resolved_by_name), '') is not null
          and (
            resolution_message is null
            or nullif(trim(resolution_message), '') is not null
          )
        )
      )
    )
    or
    (
      not requires_follow_up
      and resolved_at is null
      and resolved_by_name is null
      and resolution_message is null
    )
  );

alter table public.job_attachments
  add column job_update_attachment_role text;

update public.job_attachments
set job_update_attachment_role = 'update'
where job_update_id is not null;

alter table public.job_attachments
  add constraint job_attachments_update_role_check check (
    (
      job_update_id is null
      and job_update_attachment_role is null
    )
    or
    (
      job_update_id is not null
      and job_update_attachment_role in ('update', 'resolution')
    )
  );

comment on column public.job_attachments.job_update_attachment_role is
  'Identifies whether a Job Update attachment supports the original update or its resolution. The file remains a canonical Job file.';

create or replace function public.resolve_job_update(
  p_update_id uuid,
  p_resolved_by_name text,
  p_resolution_message text
)
returns public.job_updates
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  resolver text := nullif(trim(p_resolved_by_name), '');
  resolution text := nullif(trim(p_resolution_message), '');
  resolved_update public.job_updates;
begin
  if p_update_id is null then
    raise exception 'Job Update ID is required.' using errcode = '22023';
  end if;

  if resolver is null then
    raise exception 'Resolver name is required.' using errcode = '22023';
  end if;

  update public.job_updates
  set resolved_at = now(),
      resolved_by_name = resolver,
      resolution_message = resolution
  where id = p_update_id
    and requires_follow_up
    and resolved_at is null
  returning * into resolved_update;

  if not found then
    raise exception 'Open follow-up update was not found.'
      using errcode = 'P0002';
  end if;

  return resolved_update;
end;
$function$;

create or replace function public.resolve_job_update(
  p_update_id uuid,
  p_resolved_by_name text
)
returns public.job_updates
language sql
security definer
set search_path = public, pg_temp
as $function$
  select public.resolve_job_update(
    p_update_id,
    p_resolved_by_name,
    null
  );
$function$;

alter function public.resolve_job_update(uuid, text, text) owner to postgres;
alter function public.resolve_job_update(uuid, text) owner to postgres;

revoke all on function public.resolve_job_update(uuid, text, text) from public;
grant execute on function public.resolve_job_update(uuid, text, text)
  to anon, authenticated, service_role;

revoke all on function public.resolve_job_update(uuid, text) from public;
grant execute on function public.resolve_job_update(uuid, text)
  to anon, authenticated, service_role;

commit;
