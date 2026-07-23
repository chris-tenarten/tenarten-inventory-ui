begin;

create table if not exists public.purchase_order_documents (
  id uuid primary key default gen_random_uuid(),
  issuance_id uuid not null unique references public.purchase_order_issuances(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'generating', 'generated', 'failed')),
  snapshot_hash text not null check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  storage_bucket text not null default 'purchase-order-documents',
  storage_path text,
  document_version text not null default 'po-pdf-v1',
  generation_started_at timestamptz,
  generated_at timestamptz,
  failed_at timestamptz,
  last_error text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_order_documents_generated_complete check (
    status <> 'generated'
    or (
      storage_path is not null
      and generated_at is not null
      and last_error is null
    )
  )
);

create index if not exists purchase_order_documents_status_idx
  on public.purchase_order_documents (status, updated_at desc);

alter table public.purchase_order_documents enable row level security;
drop policy if exists "Purchase Order document read" on public.purchase_order_documents;
create policy "Purchase Order document read"
  on public.purchase_order_documents for select to anon, authenticated using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'purchase-order-documents',
  'purchase-order-documents',
  false,
  10485760,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.capture_purchase_order_pdf_snapshot_fields()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $function$
declare
  customer_snapshot text;
begin
  if nullif(new.order_snapshot->>'production_job_id', '') is not null then
    select jobs.customer
      into customer_snapshot
    from public.jobs
    where jobs.id = (new.order_snapshot->>'production_job_id')::uuid;
  end if;

  new.order_snapshot := new.order_snapshot || jsonb_build_object(
    'customer', customer_snapshot,
    'miscellaneous_amount', null
  );
  new.snapshot_hash := encode(
    digest(
      convert_to(new.order_snapshot::text || E'\n' || new.lines_snapshot::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
  return new;
end;
$function$;

drop trigger if exists purchase_order_issuances_capture_pdf_fields
  on public.purchase_order_issuances;
create trigger purchase_order_issuances_capture_pdf_fields
  before insert on public.purchase_order_issuances
  for each row execute function public.capture_purchase_order_pdf_snapshot_fields();

create or replace function public.initialize_purchase_order_document()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  insert into public.purchase_order_documents (issuance_id, snapshot_hash)
  values (new.id, new.snapshot_hash)
  on conflict (issuance_id) do nothing;
  return new;
end;
$function$;

drop trigger if exists purchase_order_issuances_initialize_document
  on public.purchase_order_issuances;
create trigger purchase_order_issuances_initialize_document
  after insert on public.purchase_order_issuances
  for each row execute function public.initialize_purchase_order_document();

insert into public.purchase_order_documents (issuance_id, snapshot_hash)
select issuance.id, issuance.snapshot_hash
from public.purchase_order_issuances issuance
on conflict (issuance_id) do nothing;

create or replace function public.claim_purchase_order_pdf_generation(
  p_issuance_id uuid,
  p_actor text
)
returns table (
  document_id uuid,
  document_status text,
  storage_bucket text,
  storage_path text,
  document_version text,
  snapshot_hash text,
  order_snapshot jsonb,
  lines_snapshot jsonb,
  generation_started_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  selected_issuance public.purchase_order_issuances%rowtype;
  selected_document public.purchase_order_documents%rowtype;
  safe_number text;
  started_at timestamptz := clock_timestamp();
begin
  if nullif(trim(p_actor), '') is null then
    raise exception 'A generating actor is required.';
  end if;

  select issuance.*
    into selected_issuance
  from public.purchase_order_issuances issuance
  where issuance.id = p_issuance_id
  for update;
  if not found then raise exception 'Purchase Order issuance was not found.'; end if;

  insert into public.purchase_order_documents (issuance_id, snapshot_hash)
  values (selected_issuance.id, selected_issuance.snapshot_hash)
  on conflict (issuance_id) do nothing;

  select documents.*
    into selected_document
  from public.purchase_order_documents documents
  where documents.issuance_id = selected_issuance.id
  for update;

  if selected_document.snapshot_hash <> selected_issuance.snapshot_hash then
    raise exception 'Purchase Order document snapshot hash does not match its issuance.';
  end if;

  safe_number := regexp_replace(
    coalesce(nullif(selected_issuance.order_snapshot->>'po_number', ''), selected_issuance.id::text),
    '[^A-Za-z0-9._-]+',
    '-',
    'g'
  );

  if selected_document.status = 'generated' then
    return query select
      selected_document.id,
      selected_document.status,
      selected_document.storage_bucket,
      selected_document.storage_path,
      selected_document.document_version,
      selected_document.snapshot_hash,
      selected_issuance.order_snapshot,
      selected_issuance.lines_snapshot,
      selected_document.generation_started_at;
    return;
  end if;

  if selected_document.status = 'generating'
     and selected_document.generation_started_at > started_at - interval '15 minutes' then
    raise exception 'Purchase Order PDF generation is already in progress.';
  end if;

  update public.purchase_order_documents documents
  set status = 'generating',
      storage_path = coalesce(
        documents.storage_path,
        selected_issuance.id::text || '/' || safe_number || '.pdf'
      ),
      generation_started_at = started_at,
      failed_at = null,
      last_error = null,
      attempt_count = documents.attempt_count + 1,
      updated_at = started_at
  where documents.id = selected_document.id
  returning documents.* into selected_document;

  return query select
    selected_document.id,
    selected_document.status,
    selected_document.storage_bucket,
    selected_document.storage_path,
    selected_document.document_version,
    selected_document.snapshot_hash,
    selected_issuance.order_snapshot,
    selected_issuance.lines_snapshot,
    selected_document.generation_started_at;
end;
$function$;

revoke all on function public.claim_purchase_order_pdf_generation(uuid, text) from public;
grant execute on function public.claim_purchase_order_pdf_generation(uuid, text)
  to service_role;

comment on table public.purchase_order_documents is
  'One retryable permanent PDF artifact owned by each immutable Purchase Order issuance.';
comment on function public.claim_purchase_order_pdf_generation(uuid, text) is
  'Claims or reuses deterministic PDF generation using only the immutable issuance snapshot.';

commit;
