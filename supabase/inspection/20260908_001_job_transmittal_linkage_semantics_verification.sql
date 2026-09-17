-- Post-apply verification for 20260908_001.
-- Run as a migration-capable administrative role. Every fixture is rolled back.
begin;

create temporary table verify_existing_job_transmittals
on commit drop
as
select id, job_id, transmittal_number, snapshot, snapshot_hash, issued_at
from public.job_transmittals;

do $$
declare
  issue_oid oid := to_regprocedure('public.issue_job_transmittal(uuid,text,jsonb,text)');
  list_oid oid := to_regprocedure('public.list_job_transmittals(uuid)');
  issue_definition text;
  list_definition text;
begin
  if issue_oid is null or list_oid is null then
    raise exception 'VERIFY_LINKAGE_RPC_MISSING';
  end if;

  if exists (
    select 1
    from pg_attribute attribute
    where attribute.attrelid = 'public.job_transmittals'::regclass
      and attribute.attname = 'job_id'
      and attribute.attnotnull
  ) then
    raise exception 'VERIFY_STANDALONE_JOB_ID_STILL_REQUIRED';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_record
    where constraint_record.conrelid = 'public.job_transmittals'::regclass
      and constraint_record.contype = 'f'
      and constraint_record.confrelid = 'public.jobs'::regclass
      and constraint_record.confdeltype = 'r'
      and pg_get_constraintdef(constraint_record.oid) ~ 'FOREIGN KEY \(job_id\)'
  ) then
    raise exception 'VERIFY_JOB_RELATIONSHIP_RESTRICT_FK_MISSING';
  end if;

  if (select pg_get_userbyid(proowner) from pg_proc where oid = issue_oid) <> 'postgres'
    or not (select prosecdef from pg_proc where oid = issue_oid)
    or (select pg_get_userbyid(proowner) from pg_proc where oid = list_oid) <> 'postgres'
    or not (select prosecdef from pg_proc where oid = list_oid)
  then
    raise exception 'VERIFY_LINKAGE_RPC_SECURITY_BOUNDARY';
  end if;

  if pg_get_function_result(list_oid) <>
    'TABLE(id uuid, job_id uuid, transmittal_number text, document_date date, recipient_name text, generated_by text, issued_at timestamp with time zone, generated_at timestamp with time zone, document_status text, generation_attempts integer, recoverable boolean, error_summary text)'
  then
    raise exception 'VERIFY_HISTORY_RETURN_CONTRACT_CHANGED';
  end if;

  if not has_function_privilege('anon', issue_oid, 'EXECUTE')
    or not has_function_privilege('authenticated', issue_oid, 'EXECUTE')
    or not has_function_privilege('service_role', issue_oid, 'EXECUTE')
    or not has_function_privilege('anon', list_oid, 'EXECUTE')
    or not has_function_privilege('authenticated', list_oid, 'EXECUTE')
    or not has_function_privilege('service_role', list_oid, 'EXECUTE')
  then
    raise exception 'VERIFY_ESTABLISHED_RPC_GRANTS_CHANGED';
  end if;

  select pg_get_functiondef(issue_oid) into issue_definition;
  select pg_get_functiondef(list_oid) into list_definition;
  if issue_definition !~ 'JOB_NUMBER_REQUIRED_FOR_JOB_LINKED_TRANSMITTAL'
    or issue_definition !~ 'JOB_LINKED_TRANSMITTAL_NUMBER_OVERRIDE_NOT_ALLOWED'
    or issue_definition !~ 'STANDALONE_TRANSMITTAL_NUMBER_REQUIRED'
    or issue_definition !~* $pattern$selected_prefix,\s*'job_transmittal',\s*selected_id,\s*p_job_id,\s*null,\s*1$pattern$
    or issue_definition !~* $pattern$selected_prefix,\s*'job_transmittal',\s*selected_id,\s*null,\s*normalized_requested,\s*1$pattern$
    or issue_definition ~ 'insert\s+into\s+public\.jobs\M'
    or issue_definition ~ 'update\s+public\.jobs\M'
  then
    raise exception 'VERIFY_ISSUANCE_LINKAGE_DEFINITION_INVALID';
  end if;
  if list_definition !~* 'p_job_id is null and transmittal\.job_id is null'
    or list_definition !~* 'p_job_id is not null and transmittal\.job_id = p_job_id'
  then
    raise exception 'VERIFY_HISTORY_LINKAGE_FILTER_INVALID';
  end if;
end;
$$;

do $$
declare
  linked_prefix text;
  standalone_prefix text;
  linked_job_id uuid := gen_random_uuid();
  unnumbered_job_id uuid := gen_random_uuid();
  linked_issue record;
  standalone_issue record;
  base_snapshot jsonb;
  linked_number text;
  standalone_number text;
  jobs_before_standalone bigint;
  registry_before_rejection bigint;
  rejected boolean;
begin
  select lpad(candidate::text, 4, '0')
    into linked_prefix
  from generate_series(7000, 8998) candidate
  where not exists (
    select 1 from public.job_document_numbers
    where prefix = lpad(candidate::text, 4, '0')
  )
    and not exists (
      select 1 from public.job_document_number_sequences
      where prefix = lpad(candidate::text, 4, '0')
    )
    and not exists (
      select 1 from public.jobs
      where right(regexp_replace(coalesce(job_number, ''), '\D', '', 'g'), 4) = lpad(candidate::text, 4, '0')
    )
  limit 1;

  select lpad(candidate::text, 4, '0')
    into standalone_prefix
  from generate_series(7000, 8998) candidate
  where lpad(candidate::text, 4, '0') <> linked_prefix
    and not exists (
      select 1 from public.job_document_numbers
      where prefix = lpad(candidate::text, 4, '0')
    )
    and not exists (
      select 1 from public.job_document_number_sequences
      where prefix = lpad(candidate::text, 4, '0')
    )
    and not exists (
      select 1 from public.jobs
      where right(regexp_replace(coalesce(job_number, ''), '\D', '', 'g'), 4) = lpad(candidate::text, 4, '0')
    )
  limit 1;

  if linked_prefix is null or standalone_prefix is null then
    raise exception 'VERIFY_NO_DISPOSABLE_DOCUMENT_PREFIX';
  end if;

  insert into public.jobs(id, name, customer, job_number)
  values
    (linked_job_id, 'LoT linkage verification Job', 'Verification Customer', '26-' || linked_prefix),
    (unnumbered_job_id, 'LoT unnumbered verification Job', 'Verification Customer', null);

  base_snapshot := jsonb_build_object(
    'document_date', '2026-09-08',
    'recipient', jsonb_build_object('company', 'Verification Recipient', 'attention', ''),
    'sender', jsonb_build_object('name', 'Verification User', 'email', ''),
    'items', jsonb_build_array(jsonb_build_object(
      'submittal', 'Verification item', 'description', '', 'number', '',
      'quantity', '1', 'date', '2026-09-08'
    )),
    'comments', '',
    'customer', 'Document-specific Customer',
    'job_id', 'spoofed-job-id',
    'job_number', '9999-999',
    'job_name', 'Document-specific Project'
  );

  if public.preview_next_job_document_number(linked_job_id) <> (linked_prefix || '-001') then
    raise exception 'VERIFY_LINKED_PROVISIONAL_NUMBER_INVALID';
  end if;

  select * into linked_issue
  from public.issue_job_transmittal(linked_job_id, null, base_snapshot, 'Verification User');
  linked_number := linked_prefix || '-001';
  if linked_issue.transmittal_number <> linked_number then
    raise exception 'VERIFY_LINKED_NUMBER_NOT_DERIVED: %', linked_issue.transmittal_number;
  end if;
  if not exists (
    select 1
    from public.job_transmittals transmittal
    where transmittal.id = linked_issue.transmittal_id
      and transmittal.job_id = linked_job_id
      and transmittal.snapshot->>'job_id' = linked_job_id::text
      and transmittal.snapshot->>'job_number' = '26-' || linked_prefix
  ) then
    raise exception 'VERIFY_LINKED_CANONICAL_SNAPSHOT_INVALID';
  end if;
  if not exists (
    select 1
    from public.job_document_numbers number_record
    where number_record.document_type = 'job_transmittal'
      and number_record.document_id = linked_issue.transmittal_id
      and number_record.job_id = linked_job_id
      and number_record.normalized_number = lower(linked_number)
  ) then
    raise exception 'VERIFY_LINKED_REGISTRY_INVALID';
  end if;

  select count(*) into registry_before_rejection from public.job_document_numbers;
  rejected := false;
  begin
    perform public.issue_job_transmittal(
      linked_job_id, linked_prefix || '-099', base_snapshot, 'Verification User'
    );
  exception when others then
    if sqlerrm = 'JOB_LINKED_TRANSMITTAL_NUMBER_OVERRIDE_NOT_ALLOWED' then rejected := true;
    else raise; end if;
  end;
  if not rejected then raise exception 'VERIFY_SAME_PREFIX_LINKED_OVERRIDE_ACCEPTED'; end if;

  rejected := false;
  begin
    perform public.issue_job_transmittal(
      linked_job_id, standalone_prefix || '-099', base_snapshot, 'Verification User'
    );
  exception when others then
    if sqlerrm = 'JOB_LINKED_TRANSMITTAL_NUMBER_OVERRIDE_NOT_ALLOWED' then rejected := true;
    else raise; end if;
  end;
  if not rejected then raise exception 'VERIFY_UNRELATED_LINKED_OVERRIDE_ACCEPTED'; end if;
  if (select count(*) from public.job_document_numbers) <> registry_before_rejection then
    raise exception 'VERIFY_LINKED_OVERRIDE_RESERVED_NUMBER';
  end if;

  rejected := false;
  begin
    perform public.issue_job_transmittal(
      unnumbered_job_id, standalone_prefix || '-002', base_snapshot, 'Verification User'
    );
  exception when others then
    if sqlerrm = 'JOB_NUMBER_REQUIRED_FOR_JOB_LINKED_TRANSMITTAL' then rejected := true;
    else raise; end if;
  end;
  if not rejected then raise exception 'VERIFY_UNNUMBERED_JOB_ISSUED_LINKED_TRANSMITTAL'; end if;
  if (select job_number from public.jobs where id = unnumbered_job_id) is not null then
    raise exception 'VERIFY_FAKE_JOB_NUMBER_CREATED';
  end if;

  rejected := false;
  begin
    perform public.issue_job_transmittal(null, null, base_snapshot, 'Verification User');
  exception when others then
    if sqlerrm = 'STANDALONE_TRANSMITTAL_NUMBER_REQUIRED' then rejected := true;
    else raise; end if;
  end;
  if not rejected then raise exception 'VERIFY_BLANK_STANDALONE_NUMBER_ACCEPTED'; end if;

  rejected := false;
  begin
    perform public.issue_job_transmittal(null, 'SAMP-001', base_snapshot, 'Verification User');
  exception when others then
    if sqlerrm = 'DOCUMENT_NUMBER_FORMAT_INVALID' then rejected := true;
    else raise; end if;
  end;
  if not rejected then raise exception 'VERIFY_INVALID_STANDALONE_NUMBER_ACCEPTED'; end if;

  select count(*) into jobs_before_standalone from public.jobs;
  standalone_number := standalone_prefix || '-001';
  select * into standalone_issue
  from public.issue_job_transmittal(null, standalone_number, base_snapshot, 'Verification User');
  if standalone_issue.transmittal_number <> standalone_number then
    raise exception 'VERIFY_STANDALONE_NUMBER_CHANGED: %', standalone_issue.transmittal_number;
  end if;
  if (select count(*) from public.jobs) <> jobs_before_standalone then
    raise exception 'VERIFY_STANDALONE_CREATED_JOB';
  end if;
  if not exists (
    select 1
    from public.job_transmittals transmittal
    where transmittal.id = standalone_issue.transmittal_id
      and transmittal.job_id is null
      and transmittal.snapshot->'job_id' = 'null'::jsonb
      and transmittal.snapshot->>'job_number' = ''
  ) then
    raise exception 'VERIFY_STANDALONE_LINKAGE_SNAPSHOT_INVALID';
  end if;
  if not exists (
    select 1
    from public.job_document_numbers number_record
    where number_record.document_type = 'job_transmittal'
      and number_record.document_id = standalone_issue.transmittal_id
      and number_record.job_id is null
      and number_record.normalized_number = lower(standalone_number)
  ) then
    raise exception 'VERIFY_STANDALONE_REGISTRY_INVALID';
  end if;

  if not exists (
    select 1 from public.list_job_transmittals(linked_job_id) history
    where history.id = linked_issue.transmittal_id and history.job_id = linked_job_id
  ) or exists (
    select 1 from public.list_job_transmittals(linked_job_id) history
    where history.id = standalone_issue.transmittal_id
  ) then
    raise exception 'VERIFY_LINKED_HISTORY_NOT_ISOLATED';
  end if;
  if not exists (
    select 1 from public.list_job_transmittals(null) history
    where history.id = standalone_issue.transmittal_id and history.job_id is null
  ) or exists (
    select 1 from public.list_job_transmittals(null) history
    where history.id = linked_issue.transmittal_id
  ) then
    raise exception 'VERIFY_STANDALONE_HISTORY_NOT_ISOLATED';
  end if;

  rejected := false;
  begin
    perform public.issue_job_transmittal(null, standalone_number, base_snapshot, 'Verification User');
  exception when others then
    if sqlerrm = 'DOCUMENT_NUMBER_COLLISION' then rejected := true;
    else raise; end if;
  end;
  if not rejected then raise exception 'VERIFY_STANDALONE_COLLISION_ACCEPTED'; end if;

  if exists (
    select 1
    from verify_existing_job_transmittals existing
    left join public.job_transmittals current_record on current_record.id = existing.id
    where current_record.id is null
      or row(
        current_record.job_id,
        current_record.transmittal_number,
        current_record.snapshot,
        current_record.snapshot_hash,
        current_record.issued_at
      ) is distinct from row(
        existing.job_id,
        existing.transmittal_number,
        existing.snapshot,
        existing.snapshot_hash,
        existing.issued_at
      )
  ) then
    raise exception 'VERIFY_HISTORICAL_TRANSMITTAL_CHANGED';
  end if;
end;
$$;

rollback;
