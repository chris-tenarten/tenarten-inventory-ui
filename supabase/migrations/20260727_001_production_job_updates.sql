begin;

create table public.job_updates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  author_name text not null,
  body text not null,
  requires_follow_up boolean not null default false,
  resolved_at timestamptz,
  resolved_by_name text,
  created_at timestamptz not null default now(),

  constraint job_updates_author_name_not_blank check (
    length(trim(author_name)) > 0
  ),
  constraint job_updates_body_not_blank check (
    length(trim(body)) > 0
  ),
  constraint job_updates_resolution_check check (
    (
      requires_follow_up
      and (
        (resolved_at is null and resolved_by_name is null)
        or
        (
          resolved_at is not null
          and nullif(trim(resolved_by_name), '') is not null
        )
      )
    )
    or
    (
      not requires_follow_up
      and resolved_at is null
      and resolved_by_name is null
    )
  )
);

comment on table public.job_updates is
  'Append-only Production job conversation. Follow-up updates may be resolved through resolve_job_update.';

create index job_updates_job_created_idx
  on public.job_updates (job_id, created_at desc);

create index job_updates_open_follow_up_idx
  on public.job_updates (job_id, created_at desc)
  where requires_follow_up and resolved_at is null;

alter table public.job_attachments
  add column job_update_id uuid references public.job_updates(id) on delete set null;

comment on column public.job_attachments.job_update_id is
  'Optional originating Job Update. The attachment remains a durable Job file if the update relationship is removed.';

create index job_attachments_job_update_idx
  on public.job_attachments (job_update_id)
  where job_update_id is not null;

create or replace function public.validate_job_attachment_update_job()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if new.job_update_id is not null and not exists (
    select 1
    from public.job_updates update_row
    where update_row.id = new.job_update_id
      and update_row.job_id = new.job_id
  ) then
    raise exception 'Attachment and Job Update must belong to the same Production job.'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

create trigger trg_job_attachments_validate_update_job
before insert or update of job_id, job_update_id on public.job_attachments
for each row execute function public.validate_job_attachment_update_job();

create or replace function public.resolve_job_update(
  p_update_id uuid,
  p_resolved_by_name text
)
returns public.job_updates
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  resolver text := nullif(trim(p_resolved_by_name), '');
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
      resolved_by_name = resolver
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

alter table public.job_updates enable row level security;

create policy "Allow anon read job updates"
  on public.job_updates for select to anon using (true);

create policy "Allow authenticated read job updates"
  on public.job_updates for select to authenticated using (true);

create policy "Allow anon insert job updates"
  on public.job_updates for insert to anon with check (true);

create policy "Allow authenticated insert job updates"
  on public.job_updates for insert to authenticated with check (true);

alter function public.resolve_job_update(uuid, text) owner to postgres;

revoke all on table public.job_updates from public, anon, authenticated;
grant select, insert on table public.job_updates to anon, authenticated;
grant all on table public.job_updates to service_role;

revoke all on function public.resolve_job_update(uuid, text) from public;
grant execute on function public.resolve_job_update(uuid, text)
  to anon, authenticated, service_role;

commit;
