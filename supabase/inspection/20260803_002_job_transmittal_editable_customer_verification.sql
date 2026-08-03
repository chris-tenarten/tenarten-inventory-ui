begin;

do $$
declare
  test_job uuid := gen_random_uuid();
  test_prefix text;
  test_job_number text;
  result record;
  stored_customer text;
  canonical_customer text;
  existing_transmittal_signature text;
  final_transmittal_signature text;
  existing_registry_signature text;
  final_registry_signature text;
  existing_sequence_signature text;
  final_sequence_signature text;
  function_definition text;
begin
  if to_regprocedure('public.issue_job_transmittal(uuid,text,jsonb,text)') is null
  then raise exception 'VERIFY_ISSUE_FUNCTION_MISSING'; end if;
  select lpad(candidate::text,4,'0') into test_prefix
  from generate_series(9000,9999) candidate
  where not exists (
    select 1 from public.job_document_numbers where prefix=lpad(candidate::text,4,'0')
  )
    and not exists (
      select 1 from public.job_document_number_sequences where prefix=lpad(candidate::text,4,'0')
    )
  order by candidate limit 1;
  if test_prefix is null then raise exception 'VERIFY_NO_UNUSED_DOCUMENT_PREFIX'; end if;
  test_job_number := '99-' || test_prefix;

  select md5(coalesce(string_agg(to_jsonb(record)::text,'' order by record.id),''))
  into existing_transmittal_signature from public.job_transmittals record;
  select md5(coalesce(string_agg(to_jsonb(record)::text,'' order by record.normalized_number),''))
  into existing_registry_signature from public.job_document_numbers record;
  select md5(coalesce(string_agg(to_jsonb(record)::text,'' order by record.prefix),''))
  into existing_sequence_signature from public.job_document_number_sequences record;

  select pg_get_functiondef('public.issue_job_transmittal(uuid,text,jsonb,text)'::regprocedure)
  into function_definition;
  if function_definition not like '%SECURITY DEFINER%'
    or function_definition not like '%SET search_path TO ''public'', ''extensions'', ''pg_temp''%'
    or function_definition not like '%p_requested_number, 1%'
    or function_definition like '%' || quote_literal('customer') || ', selected_job.customer%'
  then raise exception 'VERIFY_ISSUE_FUNCTION_CONTRACT'; end if;
  if (select pg_get_userbyid(proowner) from pg_proc where oid='public.issue_job_transmittal(uuid,text,jsonb,text)'::regprocedure) <> 'postgres'
  then raise exception 'VERIFY_ISSUE_FUNCTION_OWNER'; end if;
  if exists (
      select 1 from pg_proc procedure
      cross join lateral aclexplode(coalesce(procedure.proacl,acldefault('f',procedure.proowner))) acl
      where procedure.oid='public.issue_job_transmittal(uuid,text,jsonb,text)'::regprocedure
        and acl.grantee=0 and acl.privilege_type='EXECUTE'
    )
    or not has_function_privilege('anon','public.issue_job_transmittal(uuid,text,jsonb,text)','execute')
    or not has_function_privilege('authenticated','public.issue_job_transmittal(uuid,text,jsonb,text)','execute')
    or not has_function_privilege('service_role','public.issue_job_transmittal(uuid,text,jsonb,text)','execute')
  then raise exception 'VERIFY_ISSUE_FUNCTION_GRANTS'; end if;

  insert into public.jobs(id,name,job_number,customer)
  values(test_job,'Transmittal customer verification 20260803',test_job_number,'Canonical Customer');

  select * into result from public.issue_job_transmittal(
    test_job,
    null,
    jsonb_build_object(
      'document_date', current_date::text,
      'recipient', jsonb_build_object('company','Verification Recipient','address_line_1',E'Line One\nLine Two','address_line_2','','attention','','office_phone','','mobile_phone','','email',''),
      'cc','', 'delivery',jsonb_build_object('attached',true,'separate_cover',false,'via',''),
      'transmitted_types',jsonb_build_object('shop_drawing',false,'letter',true,'samples',false,'other',false,'other_label',''),
      'items',jsonb_build_array(jsonb_build_object('line_number',1,'submittal','Letter','quantity','1','date',current_date::text,'number','','description','Verification')),
      'purpose',jsonb_build_object('approval',false,'use',false,'record',true,'rfi',false,'review',false,'review_by',''),
      'comments','', 'sender',jsonb_build_object('name','Verification','phone','','email',''),
      'job_id',test_job,'job_number',test_job_number,'job_name','Transmittal customer verification',
      'customer','Document Customer','transmittal_number','','template_version',1,'document_version','job-transmittal-pdf-v1'
    ),
    'Verification'
  );

  select snapshot->>'customer', snapshot#>>'{recipient,address_line_1}'
  into stored_customer, canonical_customer
  from public.job_transmittals where id=result.transmittal_id;
  if stored_customer <> 'Document Customer' then raise exception 'VERIFY_CUSTOMER_NOT_PRESERVED'; end if;
  if canonical_customer <> E'Line One\nLine Two' then raise exception 'VERIFY_ADDRESS_NEWLINE_NOT_PRESERVED'; end if;
  if result.transmittal_number <> (test_prefix || '-001') then raise exception 'VERIFY_SHARED_NUMBER_ALLOCATION'; end if;
  select customer into canonical_customer from public.jobs where id=test_job;
  if canonical_customer <> 'Canonical Customer' then raise exception 'VERIFY_JOB_CUSTOMER_MUTATED'; end if;

  select md5(coalesce(string_agg(to_jsonb(record)::text,'' order by record.id),''))
  into final_transmittal_signature
  from public.job_transmittals record where record.job_id is distinct from test_job;
  if final_transmittal_signature <> existing_transmittal_signature
  then raise exception 'VERIFY_EXISTING_TRANSMITTALS_MUTATED'; end if;
  select md5(coalesce(string_agg(to_jsonb(record)::text,'' order by record.normalized_number),''))
  into final_registry_signature
  from public.job_document_numbers record where record.job_id is distinct from test_job;
  if final_registry_signature <> existing_registry_signature
  then raise exception 'VERIFY_EXISTING_NUMBER_RESERVATIONS_MUTATED'; end if;
  select md5(coalesce(string_agg(to_jsonb(record)::text,'' order by record.prefix),''))
  into final_sequence_signature
  from public.job_document_number_sequences record where record.prefix <> test_prefix;
  if final_sequence_signature <> existing_sequence_signature
  then raise exception 'VERIFY_EXISTING_NUMBER_SEQUENCES_MUTATED'; end if;
end $$;

rollback;

do $$
begin
  if exists (select 1 from public.jobs where name='Transmittal customer verification 20260803')
  then raise exception 'VERIFY_FIXTURE_JOB_RESIDUE'; end if;
end $$;
