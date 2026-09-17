begin;

do $$
begin
  if to_regprocedure('public.issue_job_transmittal(uuid,text,jsonb,text)') is null
    or to_regprocedure('public.list_job_transmittals(uuid)') is null
    or to_regprocedure('public.validate_job_transmittal_snapshot(jsonb)') is null
    or to_regprocedure('public.reserve_job_document_number(text,text,uuid,uuid,text,integer)') is null
    or to_regclass('public.jobs') is null
    or to_regclass('public.job_transmittals') is null
    or to_regclass('public.job_document_numbers') is null
  then
    raise exception 'JOB_TRANSMITTAL_LINKAGE_SEMANTICS_PREDECESSOR_MISSING';
  end if;
end $$;

-- A null canonical Job relationship now means the operator explicitly issued a
-- standalone / one-off Letter of Transmittal. Existing Job-linked rows and
-- their immutable snapshots remain unchanged.
alter table public.job_transmittals
  alter column job_id drop not null;

comment on column public.job_transmittals.job_id is
  'Canonical Production Job for a Job-linked Letter of Transmittal; NULL only for an explicitly standalone / one-off Letter of Transmittal.';

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
  normalized_requested text := lower(regexp_replace(trim(coalesce(p_requested_number, '')), '\s+', '', 'g'));
  selected_number text;
  selected_snapshot jsonb;
  selected_hash text;
  issued_time timestamptz := now();
  display_job_number text;
  display_job_name text;
  display_customer text;
begin
  if length(trim(coalesce(p_actor,''))) = 0 then raise exception 'TRANSMITTAL_SENDER_REQUIRED'; end if;
  if length(trim(p_actor)) > 120 then raise exception 'TRANSMITTAL_SENDER_TOO_LONG'; end if;
  if length(trim(coalesce(p_requested_number,''))) > 32 then raise exception 'DOCUMENT_NUMBER_FORMAT_INVALID'; end if;
  perform public.validate_job_transmittal_snapshot(p_snapshot);
  if trim(coalesce(p_actor,'')) <> trim(coalesce(p_snapshot#>>'{sender,name}','')) then raise exception 'TRANSMITTAL_SENDER_MISMATCH'; end if;
  if jsonb_typeof(p_snapshot->'customer') is distinct from 'string' then raise exception 'TRANSMITTAL_CUSTOMER_INVALID'; end if;
  if length(coalesce(p_snapshot->>'customer','')) > 200 then raise exception 'TRANSMITTAL_CUSTOMER_TOO_LONG'; end if;

  display_customer := trim(coalesce(p_snapshot->>'customer', ''));

  if p_job_id is not null then
    select * into selected_job from public.jobs where id = p_job_id for share;
    if not found then raise exception 'JOB_NOT_FOUND'; end if;

    selected_prefix := right(regexp_replace(coalesce(selected_job.job_number,''), '\D', '', 'g'), 4);
    if selected_prefix !~ '^[0-9]{4}$' then
      raise exception 'JOB_NUMBER_REQUIRED_FOR_JOB_LINKED_TRANSMITTAL';
    end if;
    if normalized_requested <> '' then
      raise exception 'JOB_LINKED_TRANSMITTAL_NUMBER_OVERRIDE_NOT_ALLOWED';
    end if;

    display_job_number := trim(selected_job.job_number);
    display_job_name := coalesce(nullif(trim(p_snapshot->>'job_name'), ''), selected_job.name);
    selected_number := public.reserve_job_document_number(
      selected_prefix, 'job_transmittal', selected_id, p_job_id, null, 1
    );
  else
    if normalized_requested = '' then
      raise exception 'STANDALONE_TRANSMITTAL_NUMBER_REQUIRED';
    end if;
    if normalized_requested !~ '^[0-9]{4}-[0-9]{3}$' then
      raise exception 'DOCUMENT_NUMBER_FORMAT_INVALID';
    end if;

    selected_prefix := split_part(normalized_requested, '-', 1);
    display_job_number := '';
    display_job_name := trim(coalesce(p_snapshot->>'job_name', ''));
    selected_number := public.reserve_job_document_number(
      selected_prefix, 'job_transmittal', selected_id, null, normalized_requested, 1
    );
  end if;

  selected_snapshot := p_snapshot || jsonb_build_object(
    'job_id', p_job_id, 'job_number', display_job_number,
    'job_name', display_job_name, 'customer', display_customer,
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
  if p_job_id is not null
    and not exists (select 1 from public.jobs where public.jobs.id = p_job_id)
  then
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
  where (p_job_id is null and transmittal.job_id is null)
     or (p_job_id is not null and transmittal.job_id = p_job_id)
  order by transmittal.issued_at desc
  limit 500;
end;
$$;

alter function public.issue_job_transmittal(uuid,text,jsonb,text) owner to postgres;
alter function public.list_job_transmittals(uuid) owner to postgres;

revoke all on function public.issue_job_transmittal(uuid,text,jsonb,text)
  from public, anon, authenticated, service_role;
revoke all on function public.list_job_transmittals(uuid)
  from public, anon, authenticated, service_role;

-- Preserve the deployed PostgREST pre-request authorization contract: these
-- established RPC names map to issueTransmittal and previewOperationalDocuments.
grant execute on function public.issue_job_transmittal(uuid,text,jsonb,text)
  to anon, authenticated, service_role;
grant execute on function public.list_job_transmittals(uuid)
  to anon, authenticated, service_role;

comment on function public.issue_job_transmittal(uuid,text,jsonb,text) is
  'Issues an immutable Letter of Transmittal. Job-linked documents require canonical Job numbering and automatic allocation; a NULL Job relationship is explicitly standalone and requires a manual registered number.';
comment on function public.list_job_transmittals(uuid) is
  'Returns sanitized immutable Letter of Transmittal history for one Job, or standalone history when the Job argument is NULL.';

commit;
