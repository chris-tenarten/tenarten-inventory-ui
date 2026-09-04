begin;

do $$
begin
  if to_regprocedure('public.issue_job_transmittal(uuid,text,jsonb,text)') is null
    or to_regprocedure('public.validate_job_transmittal_snapshot(jsonb)') is null
    or to_regprocedure('public.reserve_job_document_number(text,text,uuid,uuid,text,integer)') is null
    or to_regclass('public.job_transmittals') is null
    or to_regclass('public.job_document_numbers') is null
  then
    raise exception 'JOB_TRANSMITTAL_WITHOUT_JOB_NUMBER_PREDECESSOR_MISSING';
  end if;
end $$;

-- A Letter of Transmittal can precede assignment of a Production Job Number.
-- In that case the operator supplies the canonical Transmittal Number. The
-- existing shared PO/Transmittal registry still validates and reserves it;
-- no placeholder Job Number or alternate document-number store is created.
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
  if p_job_id is null then raise exception 'JOB_ID_REQUIRED'; end if;
  if length(trim(coalesce(p_actor,''))) = 0 then raise exception 'TRANSMITTAL_SENDER_REQUIRED'; end if;
  if length(trim(p_actor)) > 120 then raise exception 'TRANSMITTAL_SENDER_TOO_LONG'; end if;
  if length(trim(coalesce(p_requested_number,''))) > 32 then raise exception 'DOCUMENT_NUMBER_FORMAT_INVALID'; end if;
  select * into selected_job from public.jobs where id = p_job_id for share;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  perform public.validate_job_transmittal_snapshot(p_snapshot);
  if trim(coalesce(p_actor,'')) <> trim(coalesce(p_snapshot#>>'{sender,name}','')) then raise exception 'TRANSMITTAL_SENDER_MISMATCH'; end if;
  if jsonb_typeof(p_snapshot->'customer') is distinct from 'string' then raise exception 'TRANSMITTAL_CUSTOMER_INVALID'; end if;
  if length(coalesce(p_snapshot->>'customer','')) > 200 then raise exception 'TRANSMITTAL_CUSTOMER_TOO_LONG'; end if;

  selected_prefix := right(regexp_replace(coalesce(selected_job.job_number,''), '\D', '', 'g'), 4);
  if selected_prefix !~ '^[0-9]{4}$' then
    if normalized_requested = '' then
      raise exception 'TRANSMITTAL_NUMBER_REQUIRED_WITHOUT_JOB_NUMBER';
    end if;
    if normalized_requested !~ '^[0-9]{4}-[0-9]{3}$' then
      raise exception 'DOCUMENT_NUMBER_FORMAT_INVALID';
    end if;
    selected_prefix := split_part(normalized_requested, '-', 1);
  end if;

  display_job_number := coalesce(nullif(trim(p_snapshot->>'job_number'), ''), selected_job.job_number);
  display_job_name := coalesce(nullif(trim(p_snapshot->>'job_name'), ''), selected_job.name);
  display_customer := trim(coalesce(p_snapshot->>'customer', ''));
  selected_number := public.reserve_job_document_number(
    selected_prefix, 'job_transmittal', selected_id, p_job_id, p_requested_number, 1
  );
  selected_snapshot := p_snapshot || jsonb_build_object(
    'job_id', selected_job.id, 'job_number', display_job_number,
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

alter function public.issue_job_transmittal(uuid,text,jsonb,text) owner to postgres;
revoke all on function public.issue_job_transmittal(uuid,text,jsonb,text)
  from public, anon, authenticated, service_role;
grant execute on function public.issue_job_transmittal(uuid,text,jsonb,text)
  to anon, authenticated, service_role;

comment on function public.issue_job_transmittal(uuid,text,jsonb,text) is
  'Issues an immutable job-linked Transmittal. Jobs without a canonical Job Number require a manually supplied registered Transmittal Number.';

commit;
