-- Read-only preflight for 20260728_002_job_transmittal_hardening.sql.
select count(*) as transmittal_row_count from public.job_transmittals;

select id, job_id, transmittal_number, document_status, issued_at
from public.job_transmittals order by issued_at, id;

-- Every row returned here blocks _002. No production data is changed.
with documents as (
  select
    'purchase_order'::text as source_domain,
    po.id as row_id,
    po.production_job_id as job_id,
    po.po_number as document_number,
    lower(trim(po.po_number)) as normalized_number
  from public.purchase_orders po
  where nullif(trim(po.po_number), '') is not null
  union all
  select
    'job_transmittal',
    transmittal.id,
    transmittal.job_id,
    transmittal.transmittal_number,
    lower(trim(transmittal.transmittal_number))
  from public.job_transmittals transmittal
  where nullif(trim(transmittal.transmittal_number), '') is not null
),
duplicates as (
  select normalized_number
  from documents
  group by normalized_number
  having count(*) > 1
)
select
  document.source_domain,
  document.row_id,
  document.job_id,
  document.document_number,
  document.normalized_number,
  substring(trim(document.document_number) from '^([0-9]+)-') as parsed_prefix,
  case
    when trim(document.document_number) ~ '^[0-9]+-[0-9]{1,9}$'
      then substring(trim(document.document_number) from '-([0-9]+)$')::integer
    else null
  end as parsed_suffix,
  case
    when duplicate.normalized_number is not null then 'duplicate normalized number'
    when trim(document.document_number) ~ '^[0-9]{4}-000$' then 'suffix 000 is outside 001..999'
    when trim(document.document_number) ~ '^[0-9]+-[0-9]+$'
      and trim(document.document_number) !~ '^[0-9]{4}-[0-9]{3}$'
      then 'broad numeric document number fails exact ####-### registry format'
    when trim(document.document_number) ~ '^[0-9]{4}-[0-9]{3}$'
      and substring(trim(document.document_number) from '-([0-9]{3})$')::integer not between 1 and 999
      then 'parsed suffix is outside 001..999'
    else null
  end as reason
from documents document
left join duplicates duplicate using (normalized_number)
where duplicate.normalized_number is not null
   or (
     trim(document.document_number) ~ '^[0-9]+-[0-9]+$'
     and (
       trim(document.document_number) !~ '^[0-9]{4}-[0-9]{3}$'
       or case
         when trim(document.document_number) ~ '^[0-9]{4}-[0-9]{3}$'
           then substring(trim(document.document_number) from '-([0-9]{3})$')::integer not between 1 and 999
         else true
       end
     )
   )
order by document.normalized_number, document.source_domain, document.row_id;

select document_status, count(*)
from public.job_transmittals group by document_status order by document_status;

select id, transmittal_number, document_status, issued_at, updated_at
from public.job_transmittals
where document_status in ('pending', 'generating')
order by issued_at;

select id, transmittal_number
from public.job_transmittals
where jsonb_typeof(snapshot) <> 'object'
   or nullif(snapshot->>'document_date', '') is null
   or nullif(coalesce(nullif(snapshot#>>'{recipient,company}', ''), snapshot#>>'{recipient,attention}'), '') is null
   or nullif(snapshot#>>'{sender,name}', '') is null
   or jsonb_typeof(snapshot->'items') <> 'array'
   or case when jsonb_typeof(snapshot->'items') = 'array'
      then jsonb_array_length(snapshot->'items') = 0 else true end;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('job_transmittals', 'job_transmittal_number_sequences')
order by table_name, grantee, privilege_type;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('job_transmittals', 'job_transmittal_number_sequences');

select routine_name, grantee, privilege_type
from information_schema.role_routine_grants
where routine_schema = 'public'
  and routine_name like '%job_transmittal%'
order by routine_name, grantee;

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'job-transmittal-documents';
