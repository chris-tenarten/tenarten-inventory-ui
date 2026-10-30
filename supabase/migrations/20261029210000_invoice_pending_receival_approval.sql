-- LOCAL CANDIDATE / UNAPPLIED. Applying or activating requires separate Product
-- approval and real isolated Auth/RLS/transaction/concurrency verification.
-- No source-table policy changes, service-role bypass, dynamic SQL, model SQL,
-- receiving/on-hand mutation, fabricated PO lineage or application gate mutator.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('public.pending_receivals') is null
    or to_regclass('public.vendor_catalog') is null
    or to_regclass('public.vendor_catalog_v2') is null
    or to_regclass('public.jobs') is null
    or to_regprocedure('public.require_app_capability(text)') is null then
    raise exception 'Canonical Inventory, catalog, Jobs and RBAC prerequisites are required.';
  end if;
  if exists(select 1 from pg_roles where rolname='tenbot_invoice_executor') then
    raise exception 'Execution role already exists; inspect rather than adopting unknown privileges.';
  end if;
end $preflight$;

-- Inherits existing authenticated policy membership, never the caller's role
-- assignment or postgres RLS bypass. Nobody can log in or SET ROLE to this role.
create role tenbot_invoice_executor nologin inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant authenticated to tenbot_invoice_executor;
-- Migration owner can transfer fixed functions; no application role gains this membership.
grant tenbot_invoice_executor to postgres;
grant usage on schema public, auth to tenbot_invoice_executor;

create table public.tenbot_receival_execution_control(
  singleton boolean primary key default true check(singleton),
  execution_enabled boolean not null default false,
  isolated_validation_receipt text,
  validated_at timestamptz,
  constraint validated_before_enable check(not execution_enabled or (validated_at is not null and nullif(btrim(isolated_validation_receipt),'') is not null))
);
insert into public.tenbot_receival_execution_control(singleton,execution_enabled) values(true,false);
revoke all on public.tenbot_receival_execution_control from public,anon,authenticated,service_role;
grant select on public.tenbot_receival_execution_control to tenbot_invoice_executor;
comment on table public.tenbot_receival_execution_control is 'Default-off independent environment gate. No application mutation RPC. Separate reviewed migration/DB owner action after real isolated validation and Product approval only.';

create table public.invoice_receival_drafts(
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.app_users(user_id),
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp()+interval '30 minutes',
  check(expires_at>created_at)
);
create table public.invoice_receival_approvals(
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null unique references public.invoice_receival_drafts(id),
  owner_user_id uuid not null references public.app_users(user_id),
  content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
  confirmation text not null check(confirmation='CREATE_REVIEWED_PENDING_RECEIVALS'),
  approved_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null
);
create table public.invoice_receival_executions(
  draft_id uuid primary key references public.invoice_receival_drafts(id),
  approval_id uuid not null unique references public.invoice_receival_approvals(id),
  owner_user_id uuid not null references public.app_users(user_id),
  content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
  created_record_ids uuid[] not null check(cardinality(created_record_ids)>0),
  executed_at timestamptz not null default clock_timestamp()
);
-- Unique across employees/drafts, with RLS hiding the prior owner's evidence.
-- Canonical supplier + invoice reference catches rescans, crops and reuploads.
create table public.invoice_receival_document_claims(
  document_key text primary key,
  attachment_sha256 text not null unique check(attachment_sha256 ~ '^[a-f0-9]{64}$'),
  draft_id uuid not null unique references public.invoice_receival_drafts(id),
  owner_user_id uuid not null references public.app_users(user_id)
);
create table public.invoice_receival_audit(
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.invoice_receival_drafts(id),
  owner_user_id uuid not null references public.app_users(user_id),
  event text not null check(event in('prepared','approved','executed')),
  content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
  details jsonb not null check(jsonb_typeof(details)='object'),
  occurred_at timestamptz not null default clock_timestamp()
);

-- Explicit grants rather than a privileged database gateway. The five new
-- tables stay postgres-owned and cannot be updated/deleted by the executor.
revoke all on public.invoice_receival_drafts,public.invoice_receival_approvals,public.invoice_receival_executions,public.invoice_receival_document_claims,public.invoice_receival_audit from public,anon,authenticated,service_role;
grant select on public.invoice_receival_drafts,public.invoice_receival_approvals,public.invoice_receival_executions,public.invoice_receival_audit to authenticated;
grant select,insert on public.invoice_receival_drafts,public.invoice_receival_approvals,public.invoice_receival_executions,public.invoice_receival_document_claims,public.invoice_receival_audit to tenbot_invoice_executor;
grant select on public.vendor_catalog,public.vendor_catalog_v2,public.jobs,public.pending_receivals to tenbot_invoice_executor;
grant insert on public.pending_receivals to tenbot_invoice_executor;

alter table public.invoice_receival_drafts enable row level security;
alter table public.invoice_receival_approvals enable row level security;
alter table public.invoice_receival_executions enable row level security;
alter table public.invoice_receival_document_claims enable row level security;
alter table public.invoice_receival_audit enable row level security;
create policy invoice_drafts_owner_read on public.invoice_receival_drafts for select to authenticated using(owner_user_id=auth.uid() and public.has_app_capability('readOperationalData'));
create policy invoice_approvals_owner_read on public.invoice_receival_approvals for select to authenticated using(owner_user_id=auth.uid() and public.has_app_capability('readOperationalData'));
create policy invoice_executions_owner_read on public.invoice_receival_executions for select to authenticated using(owner_user_id=auth.uid() and public.has_app_capability('readOperationalData'));
create policy invoice_claims_owner_read on public.invoice_receival_document_claims for select to authenticated using(owner_user_id=auth.uid() and public.has_app_capability('readOperationalData'));
create policy invoice_audit_owner_read on public.invoice_receival_audit for select to authenticated using(owner_user_id=auth.uid() and public.has_app_capability('readOperationalData'));
create policy invoice_drafts_owner_insert on public.invoice_receival_drafts for insert to tenbot_invoice_executor with check(owner_user_id=auth.uid() and public.has_app_capability('readOperationalData') and public.has_app_capability('writeBusinessData') and public.has_app_capability('adjustInventory'));
create policy invoice_approvals_owner_insert on public.invoice_receival_approvals for insert to tenbot_invoice_executor with check(owner_user_id=auth.uid() and public.has_app_capability('writeBusinessData') and public.has_app_capability('adjustInventory'));
create policy invoice_executions_owner_insert on public.invoice_receival_executions for insert to tenbot_invoice_executor with check(owner_user_id=auth.uid() and public.has_app_capability('writeBusinessData') and public.has_app_capability('adjustInventory'));
create policy invoice_claims_owner_insert on public.invoice_receival_document_claims for insert to tenbot_invoice_executor with check(owner_user_id=auth.uid() and public.has_app_capability('writeBusinessData') and public.has_app_capability('adjustInventory'));
create policy invoice_audit_owner_insert on public.invoice_receival_audit for insert to tenbot_invoice_executor with check(owner_user_id=auth.uid() and public.has_app_capability('writeBusinessData') and public.has_app_capability('adjustInventory'));

create function public.tenbot_invoice_immutable() returns trigger language plpgsql set search_path=pg_catalog as $$
begin raise exception 'Invoice review evidence is immutable; prepare a new draft.' using errcode='42501'; end $$;
revoke all on function public.tenbot_invoice_immutable() from public,anon,authenticated,service_role;
create trigger invoice_drafts_immutable before update or delete on public.invoice_receival_drafts for each row execute function public.tenbot_invoice_immutable();
create trigger invoice_approvals_immutable before update or delete on public.invoice_receival_approvals for each row execute function public.tenbot_invoice_immutable();
create trigger invoice_executions_immutable before update or delete on public.invoice_receival_executions for each row execute function public.tenbot_invoice_immutable();
create trigger invoice_claims_immutable before update or delete on public.invoice_receival_document_claims for each row execute function public.tenbot_invoice_immutable();
create trigger invoice_audit_immutable before update or delete on public.invoice_receival_audit for each row execute function public.tenbot_invoice_immutable();

-- No-argument, no-data-return lock helpers. Their only elevated authority is
-- serialization, needed because ordinary SELECT callers have no UPDATE grant
-- on membership/catalog rows. No arbitrary identity, SQL or record access.
create function public.tenbot_lock_invoice_actor() returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if auth.role() is distinct from 'authenticated' or auth.uid() is null then raise exception 'Employee authentication required.' using errcode='42501'; end if;
  perform 1 from public.app_users where user_id=auth.uid() for share;
  if not found then raise exception 'Employee authentication required.' using errcode='42501'; end if;
  lock table public.app_role_capabilities in share mode;
end $$;
create function public.tenbot_lock_invoice_resources() returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if auth.role() is distinct from 'authenticated' or auth.uid() is null then raise exception 'Employee authentication required.' using errcode='42501'; end if;
  perform public.require_app_capability('readOperationalData');
  perform public.require_app_capability('writeBusinessData');
  perform public.require_app_capability('adjustInventory');
  lock table public.vendor_catalog,public.vendor_catalog_v2,public.jobs in share mode;
  -- Serializes ordinary manual inserts too; locks last only for this transaction.
  lock table public.pending_receivals in share row exclusive mode;
end $$;
revoke all on function public.tenbot_lock_invoice_actor(),public.tenbot_lock_invoice_resources() from public,anon,authenticated,service_role;
grant execute on function public.tenbot_lock_invoice_actor(),public.tenbot_lock_invoice_resources() to tenbot_invoice_executor;

create function public.tenbot_invoice_vendor_key(p_value text) returns text language sql immutable set search_path=pg_catalog as $$
  with value as(select regexp_replace(regexp_replace(lower(btrim(coalesce(p_value,''))), '\m(inc|incorporated|llc|company|co|corp|corporation)\M','','g'),'[^a-z0-9]','','g') as key)
  select case key when 'tmsupply' then 'terrazzomarblesupply' when 'kci' then 'klein' else key end from value
$$;
create function public.tenbot_invoice_unit(p_value text) returns text language sql immutable set search_path=pg_catalog as $$
  select case regexp_replace(lower(btrim(coalesce(p_value,''))),'\.$','')
    when 'bag' then 'Bag' when 'bags' then 'Bag' when 'pail' then 'Pail' when 'pails' then 'Pail'
    when 'box' then 'Box' when 'boxes' then 'Box' when 'bucket' then 'Bucket' when 'buckets' then 'Bucket'
    when 'drum' then 'Drum' when 'drums' then 'Drum' when 'case' then 'Case' when 'cases' then 'Case'
    when 'tote' then 'Tote' when 'totes' then 'Tote' when 'kit' then 'Kit' when 'kits' then 'Kit'
    when 'each' then 'Each' when 'ea' then 'Each' when 'lb' then 'LB' when 'lbs' then 'LB' when 'pound' then 'LB' when 'pounds' then 'LB'
    when 'kg' then 'KG' when 'kilogram' then 'KG' when 'kilograms' then 'KG' when 'gal' then 'GAL' when 'gallon' then 'GAL' when 'gallons' then 'GAL'
    when 'l' then 'L' when 'liter' then 'L' when 'liters' then 'L' when 'oz' then 'OZ' when 'ounce' then 'OZ' when 'ounces' then 'OZ' else null end
$$;
create function public.tenbot_invoice_text_key(p_value text) returns text language sql immutable set search_path=pg_catalog as $$
  select regexp_replace(lower(btrim(coalesce(p_value,''))),'\s+',' ','g')
$$;
revoke all on function public.tenbot_invoice_vendor_key(text),public.tenbot_invoice_unit(text),public.tenbot_invoice_text_key(text) from public,anon,authenticated,service_role;
grant execute on function public.tenbot_invoice_vendor_key(text),public.tenbot_invoice_unit(text),public.tenbot_invoice_text_key(text) to tenbot_invoice_executor;

-- Normalize from canonical catalog records, never caller-authored material/vendor
-- labels. Package grammar follows purchasing/catalog-records.ts. A missing or
-- unrecognized order unit is rejected rather than silently choosing Bags.
create function public.tenbot_invoice_catalog_line(p_line jsonb) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare source text:=p_line->>'catalogSource'; catalog jsonb; package_match text[]; order_unit text; selected_unit text; selected_job uuid; job_label text; vendor text; material text; size text; category text; quantity numeric;
begin
  if jsonb_typeof(p_line) is distinct from 'object' or (p_line-array['sourceLineId','catalogSource','catalogId','quantityExpected','unit','productionJobId'])<>'{}'::jsonb
    or nullif(btrim(p_line->>'sourceLineId'),'') is null or length(p_line->>'sourceLineId')>160
    or nullif(p_line->>'catalogId','') is null or length(p_line->>'catalogId')>160
    or coalesce(p_line->>'quantityExpected','') !~ '^(0|[1-9][0-9]{0,8})(\.[0-9]{1,6})?$' then raise exception 'Invalid invoice line.' using errcode='22023'; end if;
  quantity:=(p_line->>'quantityExpected')::numeric;
  if quantity<=0 then raise exception 'Positive expected quantity required.' using errcode='22023'; end if;
  if source='standard' then
    select jsonb_build_object('id',id::text,'vendor',vendor_catalog.vendor,'item_name',item_name,'size',vendor_catalog.size,'category',vendor_catalog.category,'unit',unit,'vendor_sku',vendor_sku,'material_class',material_class) into catalog from public.vendor_catalog where id::text=p_line->>'catalogId';
    vendor:=btrim(catalog->>'vendor'); material:=btrim(catalog->>'item_name'); size:=coalesce(catalog->>'size',''); category:=coalesce(nullif(catalog->>'category',''),catalog->>'material_class','');
    package_match:=regexp_match(catalog->>'unit','([0-9]+(?:\.[0-9]+)?)\s*(pounds|pound|lbs|lb|kilograms|kilogram|kg|ounces|ounce|oz|gallons|gallon|gal|liters|liter|l)\.?\s*(bag|pail|box|bucket|drum|case|tote|kit)?','i');
    order_unit:=case when package_match is null then catalog->>'unit' else package_match[3] end;
  elsif source='specialty' then
    select jsonb_build_object('id',id::text,'vendor_name',vendor_name,'item_name',item_name,'canonical_item_name',canonical_item_name,'size',vendor_catalog_v2.size,'canonical_size',canonical_size,'category',vendor_catalog_v2.category,'packaging',packaging,'unit_size',unit_size,'unit_size_uom',unit_size_uom,'price_unit',price_unit,'vendor_sku',vendor_sku,'material_type',material_type,'is_active',is_active) into catalog from public.vendor_catalog_v2 where id::text=p_line->>'catalogId' and is_active;
    vendor:=btrim(catalog->>'vendor_name'); material:=btrim(coalesce(nullif(catalog->>'canonical_item_name',''),catalog->>'item_name')); size:=coalesce(nullif(catalog->>'canonical_size',''),catalog->>'size',''); category:=coalesce(nullif(catalog->>'category',''),catalog->>'material_type','');
    package_match:=regexp_match(catalog->>'packaging','([0-9]+(?:\.[0-9]+)?)\s*(pounds|pound|lbs|lb|kilograms|kilogram|kg|ounces|ounce|oz|gallons|gallon|gal|liters|liter|l)\.?\s*(bag|pail|box|bucket|drum|case|tote|kit)?','i');
    order_unit:=case when lower(btrim(coalesce(catalog->>'price_unit',''))) in('quote','call')
      then case when package_match is null then catalog->>'packaging' else package_match[3] end
      else coalesce(nullif(btrim(catalog->>'price_unit'),''),case when package_match is null then catalog->>'packaging' else package_match[3] end) end;
  else raise exception 'Unknown catalog source.' using errcode='22023'; end if;
  selected_unit:=public.tenbot_invoice_unit(p_line->>'unit');
  if catalog is null or nullif(vendor,'') is null or nullif(material,'') is null or selected_unit is null or selected_unit is distinct from public.tenbot_invoice_unit(order_unit) then raise exception 'Catalog material or compatible unit unavailable.' using errcode='22023'; end if;
  selected_job:=nullif(p_line->>'productionJobId','')::uuid;
  if selected_job is not null then
    select case when nullif(btrim(job_number),'') is not null and nullif(btrim(name),'') is not null then btrim(job_number)||' — '||btrim(name) else coalesce(nullif(btrim(name),''),nullif(btrim(job_number),''),'Unnamed Production Job') end into job_label from public.jobs where id=selected_job;
    if not found then raise exception 'Authorized canonical Job unavailable.' using errcode='22023'; end if;
  end if;
  return jsonb_build_object('sourceLineId',btrim(p_line->>'sourceLineId'),'catalogSource',source,'catalogId',p_line->>'catalogId','quantityExpected',quantity::text,'unit',selected_unit,'productionJobId',selected_job,'vendor',vendor,'material',material,'size',size,'category',category,'jobLabel',job_label,'catalogSnapshot',catalog);
end $$;
revoke all on function public.tenbot_invoice_catalog_line(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.tenbot_invoice_catalog_line(jsonb) to tenbot_invoice_executor;

create function public.prepare_invoice_receival_draft(p_document jsonb,p_lines jsonb,p_metadata jsonb,p_provenance jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='3s' set statement_timeout='15s' as $$
declare item jsonb; normalized jsonb; normalized_lines jsonb:='[]'; payload jsonb; result public.invoice_receival_drafts; line_ids text[]:='{}'; material_keys text[]:='{}'; material_key text; supplier_key text; selected_order_date date;
begin
  perform public.tenbot_lock_invoice_actor();
  perform public.require_app_capability('readOperationalData'); perform public.require_app_capability('writeBusinessData'); perform public.require_app_capability('adjustInventory');
  if jsonb_typeof(p_document) is distinct from 'object' or (p_document-array['sha256','supplier','reference','documentDate'])<>'{}'::jsonb or coalesce(p_document->>'sha256','') !~ '^[a-f0-9]{64}$'
    or length(coalesce(p_document->>'supplier','')) not between 1 and 200 or length(coalesce(p_document->>'reference','')) not between 1 and 160
    or jsonb_typeof(p_metadata) is distinct from 'object' or (p_metadata-array['orderedBy','orderDate','location'])<>'{}'::jsonb
    or length(btrim(coalesce(p_metadata->>'orderedBy',''))) not between 1 and 160 or length(btrim(coalesce(p_metadata->>'location',''))) not between 1 and 160
    or coalesce(p_metadata->>'orderDate','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 25
    or jsonb_typeof(p_provenance) is distinct from 'object' or (p_provenance-array['model','sourceMediaType','extractionSha256','toolTraceSha256'])<>'{}'::jsonb
    or length(btrim(coalesce(p_provenance->>'model',''))) not between 1 and 100 or coalesce(p_provenance->>'sourceMediaType','') not in('application/pdf','image/jpeg','image/png')
    or coalesce(p_provenance->>'extractionSha256','') !~ '^[a-f0-9]{64}$' or coalesce(p_provenance->>'toolTraceSha256','') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid reviewed invoice draft.' using errcode='22023'; end if;
  selected_order_date:=(p_metadata->>'orderDate')::date;
  if p_document->>'documentDate' is not null then perform (p_document->>'documentDate')::date; end if;
  supplier_key:=public.tenbot_invoice_vendor_key(p_document->>'supplier');
  if supplier_key='' or regexp_replace(lower(p_document->>'reference'),'[^a-z0-9]','','g')='' then raise exception 'Supplier and document reference required.' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(p_lines) loop
    normalized:=public.tenbot_invoice_catalog_line(item);
    if public.tenbot_invoice_vendor_key(normalized->>'vendor')<>supplier_key then raise exception 'Catalog supplier does not match reviewed invoice.' using errcode='22023'; end if;
    -- A prepared review never clears an unresolved duplicate hold. This read is
    -- caller-RLS-scoped; execute repeats it while excluding concurrent manual writes.
    if exists(select 1 from public.pending_receivals pending where pending.status<>'received'
      and public.tenbot_invoice_vendor_key(pending.vendor)=supplier_key
      and public.tenbot_invoice_text_key(pending.material_name)=public.tenbot_invoice_text_key(normalized->>'material')
      and public.tenbot_invoice_text_key(pending.size)=public.tenbot_invoice_text_key(normalized->>'size')
      and coalesce(pending.production_job_id::text,'')=coalesce(normalized->>'productionJobId','')
      and public.tenbot_invoice_text_key(pending.temporary_job_label)='') then raise exception 'Potential duplicate requires separate Inventory review.' using errcode='23505'; end if;
    material_key:=public.tenbot_invoice_text_key(normalized->>'material')||'|'||public.tenbot_invoice_text_key(normalized->>'size')||'|'||coalesce(normalized->>'productionJobId','');
    if normalized->>'sourceLineId'=any(line_ids) or material_key=any(material_keys) then raise exception 'Duplicate reviewed line.' using errcode='22023'; end if;
    line_ids:=array_append(line_ids,normalized->>'sourceLineId'); material_keys:=array_append(material_keys,material_key);
    normalized_lines:=normalized_lines||jsonb_build_array(normalized);
  end loop;
  if exists(select 1 from public.invoice_receival_document_claims claim where claim.owner_user_id=auth.uid()
    and (claim.attachment_sha256=p_document->>'sha256' or claim.document_key=supplier_key||':'||regexp_replace(lower(p_document->>'reference'),'[^a-z0-9]','','g'))) then
    raise exception 'Document already claimed or conflicts with an existing receival request.' using errcode='23505';
  end if;
  -- Other employees' claims remain hidden by RLS. Global unique constraints are
  -- authoritative at execution; prepare must never claim global absence.
  payload:=jsonb_build_object('document',jsonb_build_object('sha256',p_document->>'sha256','supplier',btrim(p_document->>'supplier'),'reference',btrim(p_document->>'reference'),'documentDate',p_document->>'documentDate'),'metadata',jsonb_build_object('orderedBy',btrim(p_metadata->>'orderedBy'),'orderDate',selected_order_date::text,'location',btrim(p_metadata->>'location')),'lines',normalized_lines,'provenance',p_provenance);
  insert into public.invoice_receival_drafts(owner_user_id,payload,content_hash) values(auth.uid(),payload,encode(sha256(convert_to(payload::text,'UTF8')),'hex')) returning * into result;
  insert into public.invoice_receival_audit(draft_id,owner_user_id,event,content_hash,details) values(result.id,auth.uid(),'prepared',result.content_hash,jsonb_build_object('provenance',p_provenance,'provenanceTrust','untrusted_claims_bound_to_review','lineCount',jsonb_array_length(normalized_lines)));
  return result.payload||jsonb_build_object('id',result.id,'hash',result.content_hash,'ownerId',result.owner_user_id,'expiresAt',result.expires_at);
end $$;

create function public.get_invoice_receival_draft(p_draft_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare draft public.invoice_receival_drafts;
begin
  if auth.role() is distinct from 'authenticated' or auth.uid() is null then raise exception 'Employee authentication required.' using errcode='42501'; end if;
  perform public.require_app_capability('readOperationalData'); perform public.require_app_capability('writeBusinessData'); perform public.require_app_capability('adjustInventory');
  select * into draft from public.invoice_receival_drafts where id=p_draft_id and owner_user_id=auth.uid();
  if not found then raise exception 'Review draft unavailable.' using errcode='P0002'; end if;
  return draft.payload||jsonb_build_object('id',draft.id,'hash',draft.content_hash,'ownerId',draft.owner_user_id,'expiresAt',draft.expires_at);
end $$;

create function public.approve_invoice_receival_draft(p_draft_id uuid,p_expected_hash text,p_confirmation text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='3s' set statement_timeout='15s' as $$
declare draft public.invoice_receival_drafts; approval public.invoice_receival_approvals;
begin
  perform public.tenbot_lock_invoice_actor();
  perform pg_advisory_xact_lock(hashtextextended(p_draft_id::text,427901));
  perform public.require_app_capability('readOperationalData'); perform public.require_app_capability('writeBusinessData'); perform public.require_app_capability('adjustInventory');
  select * into draft from public.invoice_receival_drafts where id=p_draft_id and owner_user_id=auth.uid();
  if not found or draft.content_hash is distinct from p_expected_hash or p_confirmation is distinct from 'CREATE_REVIEWED_PENDING_RECEIVALS' then raise exception 'Current explicit employee approval required.' using errcode='22023'; end if;
  select * into approval from public.invoice_receival_approvals where draft_id=draft.id and owner_user_id=auth.uid();
  if approval.id is not null and approval.content_hash is distinct from draft.content_hash then raise exception 'Approval replay mismatch.' using errcode='22023'; end if;
  -- Reconcile a completed exact execution without creating/extending approval
  -- or adding an audit event. Employee identity, permission, literal approval
  -- confirmation and immutable hash were revalidated above.
  if approval.id is not null and exists(select 1 from public.invoice_receival_executions completed where completed.draft_id=draft.id and completed.approval_id=approval.id and completed.owner_user_id=auth.uid() and completed.content_hash=draft.content_hash) then
    return jsonb_build_object('id',approval.id,'draftId',draft.id,'hash',draft.content_hash,'expiresAt',approval.expires_at);
  end if;
  if draft.expires_at<=clock_timestamp() or (approval.id is not null and approval.expires_at<=clock_timestamp()) then raise exception 'Approval expired; prepare and review a fresh draft.' using errcode='22023'; end if;
  if approval.id is null then
    insert into public.invoice_receival_approvals(draft_id,owner_user_id,content_hash,confirmation,expires_at) values(draft.id,auth.uid(),draft.content_hash,p_confirmation,least(draft.expires_at,clock_timestamp()+interval '10 minutes')) returning * into approval;
    insert into public.invoice_receival_audit(draft_id,owner_user_id,event,content_hash,details) values(draft.id,auth.uid(),'approved',draft.content_hash,jsonb_build_object('approvalId',approval.id,'confirmation',p_confirmation));
  end if;
  if approval.expires_at<=clock_timestamp() then raise exception 'Approval expired; prepare and review a fresh draft.' using errcode='22023'; end if;
  return jsonb_build_object('id',approval.id,'draftId',draft.id,'hash',draft.content_hash,'expiresAt',approval.expires_at);
end $$;

create function public.execute_invoice_receival_draft(p_draft_id uuid,p_expected_hash text,p_approval_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='3s' set statement_timeout='15s' as $$
declare draft public.invoice_receival_drafts; approval public.invoice_receival_approvals; replay public.invoice_receival_executions; item jsonb; current_line jsonb; pending_id uuid; created_ids uuid[]:='{}'; document_key text; executed timestamptz;
begin
  perform public.tenbot_lock_invoice_actor();
  perform pg_advisory_xact_lock(hashtextextended(p_draft_id::text,427901));
  perform public.tenbot_lock_invoice_resources();
  -- All authorization, gate and expiry checks occur AFTER potentially waiting.
  perform public.require_app_capability('readOperationalData'); perform public.require_app_capability('writeBusinessData'); perform public.require_app_capability('adjustInventory');
  if not exists(select 1 from public.tenbot_receival_execution_control where singleton and execution_enabled and validated_at is not null and nullif(btrim(isolated_validation_receipt),'') is not null) then raise exception 'Pending-receival execution is disabled until isolated database validation and Product activation.' using errcode='42501'; end if;
  select * into draft from public.invoice_receival_drafts where id=p_draft_id and owner_user_id=auth.uid();
  select * into approval from public.invoice_receival_approvals where id=p_approval_id and draft_id=p_draft_id and owner_user_id=auth.uid();
  if draft.id is null or approval.id is null or draft.content_hash is distinct from p_expected_hash or approval.content_hash is distinct from p_expected_hash then raise exception 'Current immutable draft approval required.' using errcode='22023'; end if;
  if encode(sha256(convert_to(draft.payload::text,'UTF8')),'hex')<>draft.content_hash then raise exception 'Review integrity failure.' using errcode='22023'; end if;
  select * into replay from public.invoice_receival_executions where draft_id=draft.id and owner_user_id=auth.uid();
  if found then
    if replay.approval_id<>approval.id or replay.content_hash<>draft.content_hash then raise exception 'Approval replay mismatch.' using errcode='22023'; end if;
    return jsonb_build_object('draftId',draft.id,'hash',draft.content_hash,'createdRecordIds',to_jsonb(replay.created_record_ids),'idempotent',true,'executedAt',replay.executed_at);
  end if;
  -- Completed owned receipts remain reconcilable after expiry. This branch can
  -- create new rows, so both immutable review and approval must still be current.
  if draft.expires_at<=clock_timestamp() or approval.expires_at<=clock_timestamp() then raise exception 'Approval expired; prepare and review a fresh draft.' using errcode='22023'; end if;
  -- Validate ALL lines and duplicates before inserting any pending row.
  for item in select value from jsonb_array_elements(draft.payload->'lines') loop
    current_line:=public.tenbot_invoice_catalog_line(item-array['vendor','material','size','category','jobLabel','catalogSnapshot']);
    if current_line is distinct from item then raise exception 'Catalog or Job changed; prepare and approve a fresh draft.' using errcode='22023'; end if;
    if exists(select 1 from public.pending_receivals pending where pending.status<>'received'
      and public.tenbot_invoice_vendor_key(pending.vendor)=public.tenbot_invoice_vendor_key(item->>'vendor')
      and public.tenbot_invoice_text_key(pending.material_name)=public.tenbot_invoice_text_key(item->>'material')
      and public.tenbot_invoice_text_key(pending.size)=public.tenbot_invoice_text_key(item->>'size')
      and coalesce(pending.production_job_id::text,'')=coalesce(item->>'productionJobId','')
      and public.tenbot_invoice_text_key(pending.temporary_job_label)='') then raise exception 'Potential duplicate requires separate Inventory review.' using errcode='23505'; end if;
  end loop;
  document_key:=public.tenbot_invoice_vendor_key(draft.payload->'document'->>'supplier')||':'||regexp_replace(lower(draft.payload->'document'->>'reference'),'[^a-z0-9]','','g');
  begin
    insert into public.invoice_receival_document_claims(document_key,attachment_sha256,draft_id,owner_user_id) values(document_key,draft.payload->'document'->>'sha256',draft.id,auth.uid());
  exception when unique_violation then raise exception 'Document already claimed or conflicts with an existing receival request.' using errcode='23505'; end;
  for item in select value from jsonb_array_elements(draft.payload->'lines') loop
    insert into public.pending_receivals(vendor,material_name,size,category,quantity_expected,quantity_received,unit,location,pallet_number,status,ordered_by,order_date,received_by,eta,notes,received_at,is_earmarked,earmarked_job_name,earmark_notes,production_job_id,temporary_job_label)
    values(item->>'vendor',item->>'material',nullif(btrim(item->>'size'),''),nullif(btrim(item->>'category'),''),(item->>'quantityExpected')::numeric,0,item->>'unit',draft.payload->'metadata'->>'location',null,'pending',draft.payload->'metadata'->>'orderedBy',(draft.payload->'metadata'->>'orderDate')::date,null,null,'Invoice '||(draft.payload->'document'->>'reference')||'; reviewed draft '||draft.id::text,null,item->>'productionJobId' is not null,item->>'jobLabel',null,nullif(item->>'productionJobId','')::uuid,null)
    returning id into pending_id;
    created_ids:=array_append(created_ids,pending_id);
  end loop;
  -- No receipt RPC, inventory_items or inventory_transactions write exists here.
  perform public.require_app_capability('readOperationalData'); perform public.require_app_capability('writeBusinessData'); perform public.require_app_capability('adjustInventory');
  if draft.expires_at<=clock_timestamp() or approval.expires_at<=clock_timestamp() then raise exception 'Approval expired before completion.' using errcode='22023'; end if;
  executed:=clock_timestamp();
  insert into public.invoice_receival_executions(draft_id,approval_id,owner_user_id,content_hash,created_record_ids,executed_at) values(draft.id,approval.id,auth.uid(),draft.content_hash,created_ids,executed);
  insert into public.invoice_receival_audit(draft_id,owner_user_id,event,content_hash,details) values(draft.id,auth.uid(),'executed',draft.content_hash,jsonb_build_object('approvalId',approval.id,'createdRecordIds',to_jsonb(created_ids),'documentIdentity',document_key,'provenance',draft.payload->'provenance'));
  return jsonb_build_object('draftId',draft.id,'hash',draft.content_hash,'createdRecordIds',to_jsonb(created_ids),'idempotent',false,'executedAt',executed);
end $$;

-- Only these fixed four employee entry points are callable. The executor role
-- has no member other than its inherited authenticated policy role; it is not
-- granted to authenticated, anon, authenticator or service_role.
grant create on schema public to tenbot_invoice_executor;
alter function public.prepare_invoice_receival_draft(jsonb,jsonb,jsonb,jsonb) owner to tenbot_invoice_executor;
alter function public.get_invoice_receival_draft(uuid) owner to tenbot_invoice_executor;
alter function public.approve_invoice_receival_draft(uuid,text,text) owner to tenbot_invoice_executor;
alter function public.execute_invoice_receival_draft(uuid,text,uuid) owner to tenbot_invoice_executor;
revoke create on schema public from tenbot_invoice_executor;
revoke all on function public.prepare_invoice_receival_draft(jsonb,jsonb,jsonb,jsonb),public.get_invoice_receival_draft(uuid),public.approve_invoice_receival_draft(uuid,text,text),public.execute_invoice_receival_draft(uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.prepare_invoice_receival_draft(jsonb,jsonb,jsonb,jsonb),public.get_invoice_receival_draft(uuid),public.approve_invoice_receival_draft(uuid,text,text),public.execute_invoice_receival_draft(uuid,text,uuid) to authenticated;

commit;
