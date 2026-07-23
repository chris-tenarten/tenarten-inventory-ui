begin;

alter table public.purchase_orders
  add column if not exists document_template text not null default 'tenops';

alter table public.purchase_orders
  drop constraint if exists purchase_orders_document_template_check,
  add constraint purchase_orders_document_template_check
    check (document_template in ('classic', 'tenops'));

alter table public.purchase_order_documents
  add column if not exists template_name text not null default 'tenops',
  add column if not exists template_version integer not null default 1;

alter table public.purchase_order_documents
  drop constraint if exists purchase_order_documents_template_name_check,
  drop constraint if exists purchase_order_documents_template_version_check,
  add constraint purchase_order_documents_template_name_check
    check (template_name in ('classic', 'tenops')),
  add constraint purchase_order_documents_template_version_check
    check (template_version > 0);

alter table public.purchase_order_documents
  alter column document_version set default 'po-pdf-v2';

update public.purchase_order_documents
set document_version = 'po-pdf-v2',
    updated_at = now()
where status in ('pending', 'failed')
  and storage_path is null
  and document_version = 'po-pdf-v1';

create or replace function public.capture_purchase_order_pdf_snapshot_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  customer_snapshot text;
  selected_template text;
begin
  if nullif(new.order_snapshot->>'production_job_id', '') is not null then
    select jobs.customer
      into customer_snapshot
    from public.jobs
    where jobs.id = (new.order_snapshot->>'production_job_id')::uuid;
  end if;

  select orders.document_template
    into selected_template
  from public.purchase_orders orders
  where orders.id = new.purchase_order_id;

  new.order_snapshot := new.order_snapshot || jsonb_build_object(
    'customer', customer_snapshot,
    'template_name', coalesce(selected_template, 'tenops'),
    'template_version', 1,
    'document_version', 'po-pdf-v2'
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
$$;

create or replace function public.initialize_purchase_order_document()
returns trigger
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
begin
  insert into public.purchase_order_documents (
    issuance_id,
    snapshot_hash,
    document_version,
    template_name,
    template_version
  )
  values (
    new.id,
    new.snapshot_hash,
    coalesce(nullif(new.order_snapshot->>'document_version', ''), 'po-pdf-v2'),
    coalesce(nullif(new.order_snapshot->>'template_name', ''), 'tenops'),
    coalesce((new.order_snapshot->>'template_version')::integer, 1)
  )
  on conflict (issuance_id) do nothing;
  return new;
end;
$$;

create or replace function public.set_purchase_order_document_template(
  p_purchase_order_id uuid,
  p_template_name text,
  p_actor text
)
returns public.purchase_orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_order public.purchase_orders%rowtype;
  normalized_template text := lower(trim(coalesce(p_template_name, '')));
begin
  if normalized_template not in ('classic', 'tenops') then
    raise exception 'Document template must be Classic or TenOps.';
  end if;

  select *
    into selected_order
  from public.purchase_orders
  where id = p_purchase_order_id
  for update;

  if not found then raise exception 'Purchase Order not found.'; end if;
  if selected_order.status <> 'draft' then
    raise exception 'The document template cannot change after issuance.';
  end if;

  update public.purchase_orders
  set document_template = normalized_template,
      updated_by = coalesce(nullif(trim(p_actor), ''), updated_by),
      updated_at = now()
  where id = p_purchase_order_id
  returning * into selected_order;

  return selected_order;
end;
$$;

revoke all on function public.set_purchase_order_document_template(uuid, text, text) from public;
grant execute on function public.set_purchase_order_document_template(uuid, text, text)
  to anon, authenticated, service_role;

comment on column public.purchase_order_documents.document_version is
  'Versioned immutable PDF renderer contract. Generated v1 documents remain unchanged; new and not-yet-generated documents use po-pdf-v2.';
comment on column public.purchase_orders.document_template is
  'Explicit draft selection for the immutable issued Purchase Order renderer.';
comment on function public.set_purchase_order_document_template(uuid, text, text) is
  'Changes the selected renderer only while a Purchase Order remains a draft.';

commit;
