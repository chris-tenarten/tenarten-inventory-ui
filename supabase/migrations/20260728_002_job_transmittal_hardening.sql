begin;

do $$
begin
  if exists (
    select normalized_number
    from (
      select lower(trim(po_number)) as normalized_number
      from public.purchase_orders
      where nullif(trim(po_number), '') is not null
      union all
      select lower(trim(transmittal_number))
      from public.job_transmittals
      where nullif(trim(transmittal_number), '') is not null
    ) documents
    group by normalized_number
    having count(*) > 1
  ) then
    raise exception 'Duplicate normalized PO/Transmittal numbers exist. Run the Transmittal hardening preflight and resolve them before applying this migration.';
  end if;
  if exists (
    select 1
    from (
      select po_number as document_number from public.purchase_orders
      union all
      select transmittal_number from public.job_transmittals
    ) documents
    where nullif(trim(document_number), '') is not null
      and trim(document_number) ~ '^[0-9]+-[0-9]+$'
      and case
        when trim(document_number) ~ '^[0-9]{4}-[0-9]{3}$'
          then substring(trim(document_number) from '-([0-9]{3})$')::integer not between 1 and 999
        else true
      end
  ) then
    raise exception 'Registry-ineligible numeric PO/Transmittal numbers exist. Run the Transmittal hardening preflight and resolve them before applying this migration.';
  end if;
  if exists (
    select 1 from public.job_transmittals
    where jsonb_typeof(snapshot) <> 'object'
       or nullif(snapshot->>'document_date','') is null
       or nullif(coalesce(nullif(snapshot#>>'{recipient,company}',''), snapshot#>>'{recipient,attention}'),'') is null
       or nullif(snapshot#>>'{sender,name}','') is null
       or jsonb_typeof(snapshot->'items') <> 'array'
       or case when jsonb_typeof(snapshot->'items') = 'array'
          then jsonb_array_length(snapshot->'items') = 0 else true end
  ) then
    raise exception 'Malformed existing Transmittal snapshots exist. Run the hardening preflight and resolve them explicitly before applying this migration.';
  end if;
end;
$$;

create table if not exists public.job_document_numbers (
  normalized_number text primary key,
  prefix text not null check (prefix ~ '^[0-9]{4}$'),
  suffix integer not null check (suffix between 1 and 999),
  document_type text not null check (document_type in ('purchase_order', 'job_transmittal')),
  document_id uuid not null,
  job_id uuid references public.jobs(id) on delete restrict,
  reserved_at timestamptz not null default now(),
  unique (document_type, document_id),
  unique (prefix, suffix)
);

create table if not exists public.job_document_number_sequences (
  prefix text primary key check (prefix ~ '^[0-9]{4}$'),
  last_value integer not null check (last_value between 0 and 999),
  updated_at timestamptz not null default now()
);

revoke all on public.job_document_numbers from public, anon, authenticated;
revoke all on public.job_document_number_sequences from public, anon, authenticated;
grant all on public.job_document_numbers, public.job_document_number_sequences to service_role;

insert into public.job_document_numbers(
  normalized_number, prefix, suffix, document_type, document_id, job_id, reserved_at
)
select lower(trim(po_number)),
       substring(trim(po_number) from '^([0-9]{4})-[0-9]{3}$'),
       substring(trim(po_number) from '^[0-9]{4}-([0-9]{3})$')::integer,
       'purchase_order', id, production_job_id, coalesce(created_at, now())
from public.purchase_orders
where trim(po_number) ~ '^[0-9]{4}-[0-9]{3}$'
on conflict do nothing;

insert into public.job_document_numbers(
  normalized_number, prefix, suffix, document_type, document_id, job_id, reserved_at
)
select lower(trim(transmittal_number)),
       substring(trim(transmittal_number) from '^([0-9]{4})-[0-9]{3}$'),
       substring(trim(transmittal_number) from '^[0-9]{4}-([0-9]{3})$')::integer,
       'job_transmittal', id, job_id, issued_at
from public.job_transmittals
where trim(transmittal_number) ~ '^[0-9]{4}-[0-9]{3}$'
on conflict do nothing;

insert into public.job_document_number_sequences(prefix, last_value)
select prefix, max(suffix)
from public.job_document_numbers
group by prefix
on conflict (prefix) do update
set last_value = greatest(public.job_document_number_sequences.last_value, excluded.last_value),
    updated_at = now();

create or replace function public.reserve_job_document_number(
  p_prefix text,
  p_document_type text,
  p_document_id uuid,
  p_job_id uuid,
  p_requested_number text default null,
  p_minimum_suffix integer default 1
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_number text;
  selected_suffix integer;
  normalized_requested text := lower(regexp_replace(trim(coalesce(p_requested_number, '')), '\s+', '', 'g'));
  existing_number text;
begin
  if p_prefix !~ '^[0-9]{4}$' then raise exception 'DOCUMENT_PREFIX_INVALID'; end if;
  if p_document_type not in ('purchase_order', 'job_transmittal') then raise exception 'DOCUMENT_TYPE_INVALID'; end if;
  if p_minimum_suffix < 1 or p_minimum_suffix > 999 then raise exception 'DOCUMENT_SUFFIX_INVALID'; end if;

  select normalized_number into existing_number
  from public.job_document_numbers
  where document_type = p_document_type and document_id = p_document_id;
  if found then return upper(existing_number); end if;

  perform pg_advisory_xact_lock(hashtext('job-document-number:' || p_prefix));

  if normalized_requested <> '' then
    if normalized_requested !~ '^[0-9]{4}-[0-9]{3}$' then raise exception 'DOCUMENT_NUMBER_FORMAT_INVALID'; end if;
    if split_part(normalized_requested, '-', 1) <> p_prefix then raise exception 'DOCUMENT_NUMBER_PREFIX_INVALID'; end if;
    selected_suffix := split_part(normalized_requested, '-', 2)::integer;
    if selected_suffix < p_minimum_suffix or selected_suffix > 999 then raise exception 'DOCUMENT_SUFFIX_INVALID'; end if;
    selected_number := normalized_requested;
  else
    insert into public.job_document_number_sequences(prefix, last_value)
    values (p_prefix, p_minimum_suffix - 1)
    on conflict (prefix) do nothing;

    select greatest(last_value + 1, p_minimum_suffix)
      into selected_suffix
    from public.job_document_number_sequences
    where prefix = p_prefix
    for update;

    if selected_suffix > 999 then raise exception 'DOCUMENT_NUMBER_NAMESPACE_EXHAUSTED'; end if;
    selected_number := p_prefix || '-' || lpad(selected_suffix::text, 3, '0');
  end if;

  insert into public.job_document_numbers(
    normalized_number, prefix, suffix, document_type, document_id, job_id
  ) values (
    selected_number, p_prefix, selected_suffix, p_document_type, p_document_id, p_job_id
  );

  insert into public.job_document_number_sequences(prefix, last_value)
  values (p_prefix, selected_suffix)
  on conflict (prefix) do update
  set last_value = greatest(public.job_document_number_sequences.last_value, excluded.last_value),
      updated_at = now();

  return upper(selected_number);
exception
  when unique_violation then
    raise exception 'DOCUMENT_NUMBER_COLLISION';
end;
$$;

revoke all on function public.reserve_job_document_number(text, text, uuid, uuid, text, integer) from public;
grant execute on function public.reserve_job_document_number(text, text, uuid, uuid, text, integer) to service_role;

create or replace function public.allocate_purchase_order_number(p_purchase_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_order public.purchase_orders%rowtype;
  selected_prefix text;
  allocated_number text;
begin
  select * into selected_order from public.purchase_orders where id = p_purchase_order_id for update;
  if not found then raise exception 'Purchase Order draft was not found.'; end if;
  if selected_order.status <> 'draft' then raise exception 'Only draft Purchase Orders can receive a number.'; end if;
  if nullif(trim(selected_order.po_number), '') is not null then return trim(selected_order.po_number); end if;
  selected_prefix := case when selected_order.production_job_id is null then '9999'
    else right(regexp_replace(coalesce(selected_order.job_number_snapshot, ''), '[^0-9]', '', 'g'), 4) end;
  if selected_prefix !~ '^[0-9]{4}$' then raise exception 'The linked Production Job needs a Job Number before a Purchase Order number can be allocated.'; end if;

  allocated_number := public.reserve_job_document_number(
    selected_prefix, 'purchase_order', selected_order.id,
    selected_order.production_job_id, null, 1
  );
  update public.purchase_orders set po_number = allocated_number, updated_at = now()
  where id = selected_order.id and nullif(trim(po_number), '') is null;
  return allocated_number;
end;
$$;

alter table public.job_transmittals
  add column if not exists generation_claim_token uuid,
  add column if not exists generation_claimed_at timestamptz,
  add column if not exists document_hash text,
  add column if not exists document_size_bytes bigint,
  add column if not exists document_content_type text;

create or replace function public.validate_job_transmittal_snapshot(p_snapshot jsonb)
returns void
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare item jsonb;
begin
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then raise exception 'TRANSMITTAL_SNAPSHOT_INVALID'; end if;
  if pg_column_size(p_snapshot) > 262144 then raise exception 'TRANSMITTAL_SNAPSHOT_TOO_LARGE'; end if;
  if coalesce(p_snapshot->>'document_date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'TRANSMITTAL_DATE_INVALID'; end if;
  if coalesce(
    nullif(trim(p_snapshot#>>'{recipient,company}'),''),
    nullif(trim(p_snapshot#>>'{recipient,attention}'),'')
  ) is null then raise exception 'TRANSMITTAL_RECIPIENT_REQUIRED'; end if;
  if length(trim(coalesce(p_snapshot#>>'{sender,name}', ''))) = 0 then raise exception 'TRANSMITTAL_SENDER_REQUIRED'; end if;
  if jsonb_typeof(p_snapshot->'items') <> 'array' or jsonb_array_length(p_snapshot->'items') not between 1 and 100 then raise exception 'TRANSMITTAL_ITEMS_INVALID'; end if;
  if length(coalesce(p_snapshot#>>'{recipient,email}','')) > 0 and p_snapshot#>>'{recipient,email}' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'TRANSMITTAL_RECIPIENT_EMAIL_INVALID'; end if;
  if length(coalesce(p_snapshot#>>'{sender,email}','')) > 0 and p_snapshot#>>'{sender,email}' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'TRANSMITTAL_SENDER_EMAIL_INVALID'; end if;
  if length(coalesce(p_snapshot#>>'{recipient,company}','')) > 200
    or length(coalesce(p_snapshot#>>'{recipient,attention}','')) > 200
    or length(coalesce(p_snapshot#>>'{recipient,address_line_1}','')) > 200
    or length(coalesce(p_snapshot#>>'{recipient,address_line_2}','')) > 200
    or length(coalesce(p_snapshot->>'cc','')) > 400
    or length(coalesce(p_snapshot#>>'{delivery,via}','')) > 160
    or length(coalesce(p_snapshot#>>'{transmitted_types,other_label}','')) > 100
    or length(coalesce(p_snapshot#>>'{sender,name}','')) > 120
  then raise exception 'TRANSMITTAL_FIELD_TOO_LONG'; end if;
  for item in select value from jsonb_array_elements(p_snapshot->'items') loop
    if jsonb_typeof(item) <> 'object'
      or coalesce(
        nullif(trim(item->>'submittal'),''),
        nullif(trim(item->>'description'),''),
        nullif(trim(item->>'number'),'')
      ) is null
    then raise exception 'TRANSMITTAL_ITEM_CONTENT_REQUIRED'; end if;
    if length(coalesce(item->>'quantity','')) > 0 and (item->>'quantity' !~ '^\d+(\.\d+)?$' or (item->>'quantity')::numeric <= 0) then raise exception 'TRANSMITTAL_ITEM_QUANTITY_INVALID'; end if;
    if length(coalesce(item->>'date','')) > 0 and item->>'date' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'TRANSMITTAL_ITEM_DATE_INVALID'; end if;
    if length(coalesce(item->>'description','')) > 12000 then raise exception 'TRANSMITTAL_ITEM_DESCRIPTION_TOO_LONG'; end if;
    if length(coalesce(item->>'submittal','')) > 120 or length(coalesce(item->>'number','')) > 80 then raise exception 'TRANSMITTAL_ITEM_FIELD_TOO_LONG'; end if;
  end loop;
  if length(coalesce(p_snapshot->>'comments','')) > 30000 then raise exception 'TRANSMITTAL_COMMENTS_TOO_LONG'; end if;
end;
$$;

create or replace function public.issue_job_transmittal(
  p_job_id uuid, p_requested_number text, p_snapshot jsonb, p_actor text
)
returns table(transmittal_id uuid, transmittal_number text, issued_at timestamptz, snapshot_hash text)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  selected_job public.jobs%rowtype;
  selected_id uuid := gen_random_uuid();
  selected_prefix text;
  selected_number text;
  selected_snapshot jsonb;
  selected_hash text;
  issued_time timestamptz := now();
begin
  if p_job_id is null then raise exception 'JOB_ID_REQUIRED'; end if;
  if length(trim(coalesce(p_actor,''))) = 0 then raise exception 'TRANSMITTAL_SENDER_REQUIRED'; end if;
  if length(trim(p_actor)) > 120 then raise exception 'TRANSMITTAL_SENDER_TOO_LONG'; end if;
  if length(trim(coalesce(p_requested_number,''))) > 32 then raise exception 'DOCUMENT_NUMBER_FORMAT_INVALID'; end if;
  select * into selected_job from public.jobs where id = p_job_id for share;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  perform public.validate_job_transmittal_snapshot(p_snapshot);
  if trim(coalesce(p_actor,'')) <> trim(coalesce(p_snapshot#>>'{sender,name}','')) then raise exception 'TRANSMITTAL_SENDER_MISMATCH'; end if;
  selected_prefix := right(regexp_replace(coalesce(selected_job.job_number,''), '\D', '', 'g'), 4);
  if selected_prefix !~ '^[0-9]{4}$' then raise exception 'DOCUMENT_PREFIX_INVALID'; end if;
  selected_number := public.reserve_job_document_number(
    selected_prefix, 'job_transmittal', selected_id, p_job_id, p_requested_number, 2
  );
  selected_snapshot := p_snapshot || jsonb_build_object(
    'job_id', selected_job.id, 'job_number', selected_job.job_number,
    'job_name', selected_job.name, 'customer', selected_job.customer,
    'transmittal_number', selected_number, 'issued_at', issued_time,
    'generated_by', trim(p_actor), 'template_version', 1,
    'document_version', 'job-transmittal-pdf-v2'
  );
  selected_hash := encode(digest(convert_to(selected_snapshot::text,'UTF8'),'sha256'),'hex');
  insert into public.job_transmittals(
    id, job_id, transmittal_number, document_date, recipient_name,
    generated_by, snapshot, snapshot_hash, issued_at
  ) values (
    selected_id, p_job_id, selected_number, (selected_snapshot->>'document_date')::date,
    coalesce(nullif(trim(selected_snapshot#>>'{recipient,company}'),''), trim(selected_snapshot#>>'{recipient,attention}')),
    trim(p_actor), selected_snapshot, selected_hash, issued_time
  );
  return query select selected_id, selected_number, issued_time, selected_hash;
end;
$$;

create or replace function public.preview_next_job_document_number(p_job_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare selected_prefix text; selected_suffix integer;
begin
  if p_job_id is null then raise exception 'JOB_ID_REQUIRED'; end if;
  select right(regexp_replace(coalesce(job_number,''),'\D','','g'),4)
    into selected_prefix from public.jobs where id = p_job_id;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if selected_prefix !~ '^[0-9]{4}$' then return null; end if;
  select greatest(coalesce(max(suffix),1)+1,2) into selected_suffix
  from public.job_document_numbers where prefix = selected_prefix;
  if selected_suffix > 999 then return null; end if;
  return selected_prefix || '-' || lpad(selected_suffix::text,3,'0');
end;
$$;

create or replace function public.claim_job_transmittal_pdf_generation(p_transmittal_id uuid, p_stale_after_seconds integer default 900)
returns table(snapshot jsonb, snapshot_hash text, transmittal_number text, claim_token uuid, document_status text, storage_bucket text, storage_path text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare selected public.job_transmittals%rowtype; token uuid := gen_random_uuid();
begin
  if p_transmittal_id is null then raise exception 'TRANSMITTAL_ID_REQUIRED'; end if;
  if p_stale_after_seconds not between 60 and 3600 then raise exception 'STALE_WINDOW_INVALID'; end if;
  select * into selected from public.job_transmittals where id = p_transmittal_id for update;
  if not found then raise exception 'TRANSMITTAL_NOT_FOUND'; end if;
  if selected.document_status = 'generated' then
    return query select selected.snapshot, selected.snapshot_hash, selected.transmittal_number, selected.generation_claim_token, selected.document_status, selected.storage_bucket, selected.storage_path;
    return;
  end if;
  if selected.document_status = 'generating'
     and selected.generation_claimed_at > now() - make_interval(secs => greatest(p_stale_after_seconds,60))
  then raise exception 'GENERATION_ALREADY_ACTIVE'; end if;
  update public.job_transmittals set document_status='generating',
    generation_claim_token=token, generation_claimed_at=now(),
    document_generation_attempts=document_generation_attempts+1, document_error=null
  where id=p_transmittal_id;
  return query select selected.snapshot, selected.snapshot_hash, selected.transmittal_number, token, 'generating'::text, selected.storage_bucket, selected.storage_path;
end; $$;

create or replace function public.complete_job_transmittal_pdf_generation(
  p_transmittal_id uuid, p_claim_token uuid, p_bucket text, p_path text,
  p_document_hash text, p_size_bytes bigint, p_content_type text
) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.job_transmittals set document_status='generated', document_error=null,
    storage_bucket=p_bucket, storage_path=p_path, generated_at=now(),
    document_hash=p_document_hash, document_size_bytes=p_size_bytes,
    document_content_type=p_content_type, generation_claim_token=null
  where id=p_transmittal_id and document_status='generating' and generation_claim_token=p_claim_token;
  return found;
end; $$;

create or replace function public.fail_job_transmittal_pdf_generation(
  p_transmittal_id uuid, p_claim_token uuid, p_error text
) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.job_transmittals set document_status='failed',
    document_error=left(coalesce(p_error,'PDF generation failed.'),1000),
    generation_claim_token=null
  where id=p_transmittal_id and document_status='generating' and generation_claim_token=p_claim_token;
  return found;
end; $$;

create or replace function public.list_job_transmittals(p_job_id uuid)
returns table(
  id uuid,
  job_id uuid,
  transmittal_number text,
  document_date date,
  recipient_name text,
  generated_by text,
  issued_at timestamptz,
  generated_at timestamptz,
  document_status text,
  generation_attempts integer,
  recoverable boolean,
  error_summary text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_job_id is null then raise exception 'JOB_ID_REQUIRED'; end if;
  if not exists (select 1 from public.jobs where public.jobs.id = p_job_id) then
    raise exception 'JOB_NOT_FOUND';
  end if;
  return query
  select
    transmittal.id,
    transmittal.job_id,
    transmittal.transmittal_number,
    transmittal.document_date,
    transmittal.recipient_name,
    transmittal.generated_by,
    transmittal.issued_at,
    transmittal.generated_at,
    transmittal.document_status,
    transmittal.document_generation_attempts,
    transmittal.document_status in ('pending', 'failed')
      or (
        transmittal.document_status = 'generating'
        and (
          transmittal.generation_claim_token is null
          or transmittal.generation_claimed_at is null
          or transmittal.generation_claimed_at <= now() - interval '15 minutes'
        )
      ),
    case
      when transmittal.document_status = 'failed'
        then 'PDF generation failed. Retry this Transmittal.'
      else null
    end
  from public.job_transmittals transmittal
  where transmittal.job_id = p_job_id
  order by transmittal.issued_at desc
  limit 500;
end;
$$;

-- Temporary internal-MVP access model: anon callers may invoke only the
-- validated issuance, provisional-number, and sanitized-history operations.
-- Sender attribution is user-entered and is not an authenticated identity.
revoke all on function public.issue_job_transmittal(uuid,text,jsonb,text) from public, anon, authenticated;
revoke all on function public.preview_next_job_document_number(uuid) from public, anon, authenticated;
revoke all on function public.list_job_transmittals(uuid) from public, anon, authenticated;
revoke all on function public.validate_job_transmittal_snapshot(jsonb) from public, anon, authenticated;
revoke all on function public.claim_job_transmittal_pdf_generation(uuid,integer) from public, anon, authenticated;
revoke all on function public.complete_job_transmittal_pdf_generation(uuid,uuid,text,text,text,bigint,text) from public, anon, authenticated;
revoke all on function public.fail_job_transmittal_pdf_generation(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.issue_job_transmittal(uuid,text,jsonb,text) to anon, authenticated, service_role;
grant execute on function public.preview_next_job_document_number(uuid) to anon, authenticated, service_role;
grant execute on function public.list_job_transmittals(uuid) to anon, authenticated, service_role;
grant execute on function public.validate_job_transmittal_snapshot(jsonb) to service_role;
grant execute on function public.claim_job_transmittal_pdf_generation(uuid,integer) to service_role;
grant execute on function public.complete_job_transmittal_pdf_generation(uuid,uuid,text,text,text,bigint,text) to service_role;
grant execute on function public.fail_job_transmittal_pdf_generation(uuid,uuid,text) to service_role;

alter function public.reserve_job_document_number(text,text,uuid,uuid,text,integer) owner to postgres;
alter function public.allocate_purchase_order_number(uuid) owner to postgres;
alter function public.validate_job_transmittal_snapshot(jsonb) owner to postgres;
alter function public.issue_job_transmittal(uuid,text,jsonb,text) owner to postgres;
alter function public.preview_next_job_document_number(uuid) owner to postgres;
alter function public.list_job_transmittals(uuid) owner to postgres;
alter function public.claim_job_transmittal_pdf_generation(uuid,integer) owner to postgres;
alter function public.complete_job_transmittal_pdf_generation(uuid,uuid,text,text,text,bigint,text) owner to postgres;
alter function public.fail_job_transmittal_pdf_generation(uuid,uuid,text) owner to postgres;

revoke all on public.job_transmittals from anon;
revoke all on public.job_transmittals from authenticated;
drop policy if exists "job_transmittals_read" on public.job_transmittals;
drop policy if exists "job_transmittals_authenticated_read" on public.job_transmittals;

commit;
