begin;

-- Purchase Orders and Job Transmittals share one per-job suffix namespace.
-- Existing reservations and issued numbers remain unchanged; only future
-- Transmittal allocation is corrected to allow the first suffix to be 001.
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
  display_job_number text;
  display_job_name text;
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
  display_job_number := coalesce(nullif(trim(p_snapshot->>'job_number'), ''), selected_job.job_number);
  display_job_name := coalesce(nullif(trim(p_snapshot->>'job_name'), ''), selected_job.name);
  selected_number := public.reserve_job_document_number(
    selected_prefix, 'job_transmittal', selected_id, p_job_id, p_requested_number, 1
  );
  selected_snapshot := p_snapshot || jsonb_build_object(
    'job_id', selected_job.id, 'job_number', display_job_number,
    'job_name', display_job_name, 'customer', selected_job.customer,
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
declare
  selected_prefix text;
  selected_suffix integer;
begin
  if p_job_id is null then raise exception 'JOB_ID_REQUIRED'; end if;
  select right(regexp_replace(coalesce(job_number,''),'\D','','g'),4)
    into selected_prefix from public.jobs where id = p_job_id;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if selected_prefix !~ '^[0-9]{4}$' then return null; end if;

  select greatest(
    coalesce((
      select sequence.last_value
      from public.job_document_number_sequences sequence
      where sequence.prefix = selected_prefix
    ), 0),
    coalesce((
      select max(number.suffix)
      from public.job_document_numbers number
      where number.prefix = selected_prefix
    ), 0)
  ) + 1
  into selected_suffix;

  if selected_suffix > 999 then return null; end if;
  return selected_prefix || '-' || lpad(selected_suffix::text,3,'0');
end;
$$;

alter function public.issue_job_transmittal(uuid,text,jsonb,text) owner to postgres;
alter function public.preview_next_job_document_number(uuid) owner to postgres;

revoke all on function public.issue_job_transmittal(uuid,text,jsonb,text)
  from public, anon, authenticated, service_role;
revoke all on function public.preview_next_job_document_number(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.issue_job_transmittal(uuid,text,jsonb,text)
  to anon, authenticated, service_role;
grant execute on function public.preview_next_job_document_number(uuid)
  to anon, authenticated, service_role;

comment on function public.preview_next_job_document_number(uuid) is
  'Returns the next unreserved suffix from the shared Purchase Order and Job Transmittal namespace. The value is provisional and does not reserve a number.';

commit;
