begin;

create table if not exists public.job_transmittal_number_sequences (
  prefix text primary key,
  last_value integer not null check (last_value >= 1),
  updated_at timestamptz not null default now()
);

revoke all on public.job_transmittal_number_sequences from public, anon, authenticated;

create table if not exists public.job_transmittals (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete restrict,
  transmittal_number text not null,
  document_date date not null,
  recipient_name text not null,
  generated_by text not null,
  status text not null default 'issued' check (status = 'issued'),
  snapshot jsonb not null,
  snapshot_hash text not null,
  document_status text not null default 'pending'
    check (document_status in ('pending', 'generating', 'generated', 'failed')),
  document_error text,
  document_generation_attempts integer not null default 0,
  storage_bucket text,
  storage_path text,
  generated_at timestamptz,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists job_transmittals_number_uidx
  on public.job_transmittals (lower(trim(transmittal_number)));
create index if not exists job_transmittals_job_issued_idx
  on public.job_transmittals (job_id, issued_at desc);

alter table public.job_transmittals enable row level security;

drop policy if exists "job_transmittals_read" on public.job_transmittals;
create policy "job_transmittals_read"
  on public.job_transmittals for select
  to anon, authenticated
  using (true);

grant select on public.job_transmittals to anon, authenticated;

create or replace function public.issue_job_transmittal(
  p_job_id uuid,
  p_requested_number text,
  p_snapshot jsonb,
  p_actor text
)
returns table (
  transmittal_id uuid,
  transmittal_number text,
  issued_at timestamptz,
  snapshot_hash text
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  selected_job public.jobs%rowtype;
  normalized_actor text := nullif(trim(p_actor), '');
  requested_number text := upper(regexp_replace(trim(coalesce(p_requested_number, '')), '\s+', '', 'g'));
  prefix_value text;
  suffix_value integer;
  selected_number text;
  selected_snapshot jsonb;
  selected_hash text;
  inserted public.job_transmittals%rowtype;
begin
  if normalized_actor is null then
    raise exception 'A transmitted-by name is required.';
  end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'A valid transmittal snapshot is required.';
  end if;

  select * into selected_job from public.jobs where id = p_job_id for share;
  if not found then raise exception 'The Production job no longer exists.'; end if;

  prefix_value := right(regexp_replace(coalesce(selected_job.job_number, ''), '\D', '', 'g'), 4);
  if length(prefix_value) <> 4 and requested_number = '' then
    raise exception 'The Job Number cannot produce a four-digit transmittal prefix. Enter a manual Transmittal Number.';
  end if;

  perform pg_advisory_xact_lock(hashtext('job-document-number:' || coalesce(prefix_value, requested_number)));

  if requested_number <> '' then
    if requested_number !~ '^[A-Z0-9]+-[0-9]{3}$' then
      raise exception 'Use a Transmittal Number such as 0319-002.';
    end if;
    if exists (
      select 1 from public.purchase_orders
      where lower(trim(po_number)) = lower(requested_number)
    ) or exists (
      select 1 from public.job_transmittals
      where lower(trim(transmittal_number)) = lower(requested_number)
    ) then
      raise exception 'Transmittal Number % is already in use.', requested_number;
    end if;
    selected_number := requested_number;
  else
    insert into public.job_transmittal_number_sequences(prefix, last_value)
    values (prefix_value, 1)
    on conflict (prefix) do nothing;

    select greatest(
      1,
      last_value,
      coalesce((
        select max((regexp_match(trim(po_number), '-([0-9]{3})$'))[1]::integer)
        from public.purchase_orders
        where trim(po_number) ~ ('^' || prefix_value || '-[0-9]{3}$')
      ), 1),
      coalesce((
        select max((regexp_match(trim(transmittal_number), '-([0-9]{3})$'))[1]::integer)
        from public.job_transmittals
        where trim(transmittal_number) ~ ('^' || prefix_value || '-[0-9]{3}$')
      ), 1)
    ) + 1 into suffix_value
    from public.job_transmittal_number_sequences
    where prefix = prefix_value
    for update;

    selected_number := prefix_value || '-' || lpad(suffix_value::text, 3, '0');
    update public.job_transmittal_number_sequences
      set last_value = suffix_value, updated_at = now()
      where prefix = prefix_value;
  end if;

  selected_snapshot := p_snapshot || jsonb_build_object(
    'job_id', selected_job.id,
    'job_number', selected_job.job_number,
    'job_name', selected_job.name,
    'customer', selected_job.customer,
    'transmittal_number', selected_number,
    'issued_at', now(),
    'generated_by', normalized_actor,
    'template_version', 1,
    'document_version', 'job-transmittal-pdf-v1'
  );
  selected_hash := encode(digest(convert_to(selected_snapshot::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.job_transmittals(
    job_id, transmittal_number, document_date, recipient_name,
    generated_by, snapshot, snapshot_hash
  ) values (
    p_job_id,
    selected_number,
    (selected_snapshot->>'document_date')::date,
    coalesce(nullif(trim(selected_snapshot#>>'{recipient,company}'), ''), nullif(trim(selected_snapshot#>>'{recipient,attention}'), '')),
    normalized_actor,
    selected_snapshot,
    selected_hash
  ) returning * into inserted;

  return query select inserted.id, inserted.transmittal_number, inserted.issued_at, inserted.snapshot_hash;
end;
$$;

grant execute on function public.issue_job_transmittal(uuid, text, jsonb, text)
  to anon, authenticated, service_role;

create or replace function public.guard_job_transmittal_immutable()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.id is distinct from new.id
    or old.job_id is distinct from new.job_id
    or old.transmittal_number is distinct from new.transmittal_number
    or old.document_date is distinct from new.document_date
    or old.recipient_name is distinct from new.recipient_name
    or old.generated_by is distinct from new.generated_by
    or old.status is distinct from new.status
    or old.snapshot is distinct from new.snapshot
    or old.snapshot_hash is distinct from new.snapshot_hash
    or old.issued_at is distinct from new.issued_at
    or old.created_at is distinct from new.created_at
  then
    raise exception 'Issued Letter of Transmittal records are immutable.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists job_transmittals_immutable on public.job_transmittals;
create trigger job_transmittals_immutable
before update on public.job_transmittals
for each row execute function public.guard_job_transmittal_immutable();

create or replace function public.prevent_job_transmittal_delete()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin raise exception 'Issued Letter of Transmittal records cannot be deleted.'; end;
$$;
drop trigger if exists job_transmittals_no_delete on public.job_transmittals;
create trigger job_transmittals_no_delete
before delete on public.job_transmittals
for each row execute function public.prevent_job_transmittal_delete();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-transmittal-documents', 'job-transmittal-documents', false, 10485760, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
