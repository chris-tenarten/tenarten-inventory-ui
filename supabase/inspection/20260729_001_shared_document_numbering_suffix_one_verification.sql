begin;

do $$
declare
  issue_definition text;
  preview_definition text;
begin
  select pg_get_functiondef(
    'public.issue_job_transmittal(uuid,text,jsonb,text)'::regprocedure
  ) into issue_definition;
  select pg_get_functiondef(
    'public.preview_next_job_document_number(uuid)'::regprocedure
  ) into preview_definition;

  if issue_definition !~ $pattern$p_requested_number,\s*1\s*\)$pattern$ then
    raise exception 'VERIFY_TRANSMITTAL_MINIMUM_SUFFIX_NOT_ONE';
  end if;
  if issue_definition ~ $pattern$p_requested_number,\s*2\s*\)$pattern$ then
    raise exception 'VERIFY_TRANSMITTAL_MINIMUM_SUFFIX_STILL_TWO';
  end if;
  if preview_definition !~ 'job_document_number_sequences'
     or preview_definition !~ 'job_document_numbers'
     or preview_definition !~ '\+ 1' then
    raise exception 'VERIFY_PROVISIONAL_SHARED_SEQUENCE_INVALID';
  end if;
end;
$$;

do $$
declare
  first_prefix text;
  second_prefix text;
  first_number text;
  second_number text;
  third_number text;
begin
  select lpad(candidate::text,4,'0') into first_prefix
  from generate_series(9000,9998) candidate
  where not exists (
    select 1 from public.job_document_numbers
    where prefix = lpad(candidate::text,4,'0')
  )
    and not exists (
      select 1 from public.job_document_number_sequences
      where prefix = lpad(candidate::text,4,'0')
    )
  limit 1;

  select lpad(candidate::text,4,'0') into second_prefix
  from generate_series(9000,9998) candidate
  where lpad(candidate::text,4,'0') <> first_prefix
    and not exists (
      select 1 from public.job_document_numbers
      where prefix = lpad(candidate::text,4,'0')
    )
    and not exists (
      select 1 from public.job_document_number_sequences
      where prefix = lpad(candidate::text,4,'0')
    )
  limit 1;

  if first_prefix is null or second_prefix is null then
    raise exception 'VERIFY_NO_DISPOSABLE_PREFIX';
  end if;

  first_number := public.reserve_job_document_number(
    first_prefix, 'purchase_order', gen_random_uuid(), null, null, 1
  );
  second_number := public.reserve_job_document_number(
    first_prefix, 'job_transmittal', gen_random_uuid(), null, null, 1
  );
  third_number := public.reserve_job_document_number(
    first_prefix, 'purchase_order', gen_random_uuid(), null, null, 1
  );
  if first_number <> (first_prefix || '-001')
     or second_number <> (first_prefix || '-002')
     or third_number <> (first_prefix || '-003') then
    raise exception 'VERIFY_PO_TRANSMITTAL_PO_SEQUENCE: %, %, %',
      first_number, second_number, third_number;
  end if;

  first_number := public.reserve_job_document_number(
    second_prefix, 'job_transmittal', gen_random_uuid(), null, null, 1
  );
  second_number := public.reserve_job_document_number(
    second_prefix, 'job_transmittal', gen_random_uuid(), null, null, 1
  );
  third_number := public.reserve_job_document_number(
    second_prefix, 'purchase_order', gen_random_uuid(), null, null, 1
  );
  if first_number <> (second_prefix || '-001')
     or second_number <> (second_prefix || '-002')
     or third_number <> (second_prefix || '-003') then
    raise exception 'VERIFY_TRANSMITTAL_TRANSMITTAL_PO_SEQUENCE: %, %, %',
      first_number, second_number, third_number;
  end if;
end;
$$;

rollback;
