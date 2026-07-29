-- Post-apply verification for 20260728_002.
-- Run as a migration-capable administrative role. Every fixture is rolled back.
begin;

do $$
declare
  function_oid oid;
  function_result text;
  function_name text;
  browser_function regprocedure;
  service_function regprocedure;
  owner_function regprocedure;
begin
  foreach function_name in array array[
    'issue_job_transmittal(uuid,text,jsonb,text)',
    'preview_next_job_document_number(uuid)',
    'list_job_transmittals(uuid)',
    'reserve_job_document_number(text,text,uuid,uuid,text,integer)',
    'allocate_purchase_order_number(uuid)',
    'claim_job_transmittal_pdf_generation(uuid,integer)',
    'complete_job_transmittal_pdf_generation(uuid,uuid,text,text,text,bigint,text)',
    'fail_job_transmittal_pdf_generation(uuid,uuid,text)'
  ] loop
    function_oid := to_regprocedure('public.' || function_name);
    if function_oid is null then
      raise exception 'VERIFY_FUNCTION_MISSING: %', function_name;
    end if;
    if exists (
      select 1 from pg_proc
      where pronamespace = 'public'::regnamespace
        and proname = split_part(function_name, '(', 1)
        and oid <> function_oid
    ) then
      raise exception 'VERIFY_UNEXPECTED_FUNCTION_OVERLOAD: %', split_part(function_name, '(', 1);
    end if;
  end loop;

  select pg_get_function_result('public.list_job_transmittals(uuid)'::regprocedure)
    into function_result;
  if function_result <> 'TABLE(id uuid, job_id uuid, transmittal_number text, document_date date, recipient_name text, generated_by text, issued_at timestamp with time zone, generated_at timestamp with time zone, document_status text, generation_attempts integer, recoverable boolean, error_summary text)' then
    raise exception 'VERIFY_SANITIZED_HISTORY_CONTRACT: %', function_result;
  end if;
  if function_result ~* '(snapshot|storage|claim|hash|content|size|document_error)' then
    raise exception 'VERIFY_SANITIZED_HISTORY_EXPOSES_INTERNALS: %', function_result;
  end if;

  foreach browser_function in array array[
    'public.issue_job_transmittal(uuid,text,jsonb,text)'::regprocedure,
    'public.preview_next_job_document_number(uuid)'::regprocedure,
    'public.list_job_transmittals(uuid)'::regprocedure
  ] loop
    if not has_function_privilege('anon', browser_function, 'EXECUTE')
      or not has_function_privilege('authenticated', browser_function, 'EXECUTE')
      or not has_function_privilege('service_role', browser_function, 'EXECUTE')
    then
      raise exception 'VERIFY_BROWSER_RPC_GRANT: %', browser_function;
    end if;
    if exists (
      select 1
      from pg_proc procedure
      cross join lateral aclexplode(coalesce(
        procedure.proacl,
        acldefault('f', procedure.proowner)
      )) privilege
      where procedure.oid = browser_function
        and privilege.privilege_type = 'EXECUTE'
        and privilege.grantee not in (
          procedure.proowner,
          (select oid from pg_roles where rolname='anon'),
          (select oid from pg_roles where rolname='authenticated'),
          (select oid from pg_roles where rolname='service_role')
        )
    ) then
      raise exception 'VERIFY_UNEXPECTED_BROWSER_RPC_GRANTEE: %', browser_function;
    end if;
  end loop;

  foreach service_function in array array[
    'public.validate_job_transmittal_snapshot(jsonb)'::regprocedure,
    'public.claim_job_transmittal_pdf_generation(uuid,integer)'::regprocedure,
    'public.complete_job_transmittal_pdf_generation(uuid,uuid,text,text,text,bigint,text)'::regprocedure,
    'public.fail_job_transmittal_pdf_generation(uuid,uuid,text)'::regprocedure
  ] loop
    if not has_function_privilege('service_role', service_function, 'EXECUTE')
      or has_function_privilege('anon', service_function, 'EXECUTE')
      or has_function_privilege('authenticated', service_function, 'EXECUTE')
    then
      raise exception 'VERIFY_SERVICE_RPC_GRANT: %', service_function;
    end if;
    if exists (
      select 1
      from pg_proc procedure
      cross join lateral aclexplode(coalesce(
        procedure.proacl,
        acldefault('f', procedure.proowner)
      )) privilege
      where procedure.oid = service_function
        and privilege.privilege_type = 'EXECUTE'
        and privilege.grantee not in (
          procedure.proowner,
          (select oid from pg_roles where rolname='service_role')
        )
    ) then
      raise exception 'VERIFY_UNEXPECTED_SERVICE_RPC_GRANTEE: %', service_function;
    end if;
  end loop;

  foreach owner_function in array array[
    'public.reserve_job_document_number(text,text,uuid,uuid,text,integer)'::regprocedure,
    'public.allocate_purchase_order_number(uuid)'::regprocedure
  ] loop
    function_oid := owner_function;
    if (select pg_get_userbyid(proowner) from pg_proc where oid=function_oid) <> 'postgres'
      or has_function_privilege('anon', function_oid, 'EXECUTE')
      or has_function_privilege('authenticated', function_oid, 'EXECUTE')
      or has_function_privilege('service_role', function_oid, 'EXECUTE')
    then
      raise exception 'VERIFY_OWNER_PRIVATE_FUNCTION: %', owner_function;
    end if;
    if exists (
      select 1
      from pg_proc procedure
      cross join lateral aclexplode(coalesce(
        procedure.proacl,
        acldefault('f', procedure.proowner)
      )) privilege
      where procedure.oid = function_oid
        and privilege.privilege_type = 'EXECUTE'
        and privilege.grantee <> procedure.proowner
    ) then
      raise exception 'VERIFY_OWNER_PRIVATE_EXTERNAL_GRANTEE: %', owner_function;
    end if;
  end loop;
  if exists (
    select 1
    from pg_proc procedure
    where procedure.oid in (
      'public.allocate_purchase_order_number(uuid)'::regprocedure,
      'public.issue_job_transmittal(uuid,text,jsonb,text)'::regprocedure
    )
      and (
        pg_get_userbyid(procedure.proowner) <> 'postgres'
        or not procedure.prosecdef
        or pg_get_functiondef(procedure.oid) !~ 'reserve_job_document_number'
      )
  ) then
    raise exception 'VERIFY_RESERVATION_HELPER_CALLER_BOUNDARY';
  end if;
  if not exists (
    select 1
    from pg_proc procedure
    where procedure.oid =
      'public.save_chip_purchase_order_draft_v2(jsonb,jsonb,text)'::regprocedure
      and pg_get_userbyid(procedure.proowner) = 'postgres'
      and procedure.prosecdef
      and pg_get_functiondef(procedure.oid) ~
        'allocate_purchase_order_number'
  ) then
    raise exception 'VERIFY_PO_ALLOCATOR_CALLER_BOUNDARY';
  end if;

  if exists (
    select 1
    from pg_proc procedure
    cross join lateral aclexplode(coalesce(
      procedure.proacl,
      acldefault('f', procedure.proowner)
    )) privilege
    where procedure.oid in (
      'public.issue_job_transmittal(uuid,text,jsonb,text)'::regprocedure,
      'public.preview_next_job_document_number(uuid)'::regprocedure,
      'public.list_job_transmittals(uuid)'::regprocedure,
      'public.reserve_job_document_number(text,text,uuid,uuid,text,integer)'::regprocedure,
      'public.allocate_purchase_order_number(uuid)'::regprocedure,
      'public.validate_job_transmittal_snapshot(jsonb)'::regprocedure,
      'public.claim_job_transmittal_pdf_generation(uuid,integer)'::regprocedure,
      'public.complete_job_transmittal_pdf_generation(uuid,uuid,text,text,text,bigint,text)'::regprocedure,
      'public.fail_job_transmittal_pdf_generation(uuid,uuid,text)'::regprocedure
    )
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ) then
    raise exception 'VERIFY_PUBLIC_FUNCTION_EXECUTE';
  end if;

  if pg_get_functiondef(
    'public.allocate_purchase_order_number(uuid)'::regprocedure
  ) !~ 'reserve_job_document_number' then
    raise exception 'VERIFY_PO_ALLOCATOR_NOT_SHARED';
  end if;
end;
$$;

do $$
declare
  table_name text;
  table_oid oid;
begin
  if not (
    select relrowsecurity
    from pg_class
    where oid = 'public.job_transmittals'::regclass
  ) then
    raise exception 'VERIFY_TRANSMITTAL_RLS_DISABLED';
  end if;

  foreach table_name in array array[
    'job_transmittals',
    'job_document_numbers',
    'job_document_number_sequences'
  ] loop
    table_oid := to_regclass(format('public.%I', table_name));
    if has_table_privilege('anon', table_oid, 'SELECT')
      or has_table_privilege('anon', table_oid, 'INSERT')
      or has_table_privilege('anon', table_oid, 'UPDATE')
      or has_table_privilege('anon', table_oid, 'DELETE')
    then
      raise exception 'VERIFY_ANON_RAW_TABLE_ACCESS: %', table_name;
    end if;
    if exists (
      select 1
      from pg_class relation
      cross join lateral aclexplode(coalesce(
        relation.relacl,
        acldefault('r', relation.relowner)
      )) privilege
      where relation.oid = table_oid
        and privilege.grantee = 0
        and privilege.privilege_type in ('SELECT','INSERT','UPDATE','DELETE')
    ) then
      raise exception 'VERIFY_PUBLIC_RAW_TABLE_ACCESS: %', table_name;
    end if;
  end loop;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'job_transmittals'
  ) then
    raise exception 'VERIFY_UNEXPECTED_TRANSMITTAL_POLICY';
  end if;
end;
$$;

do $$
declare
  eligible_count bigint;
  registry_count bigint;
begin
  select count(*) into eligible_count
  from (
    select id from public.purchase_orders
    where trim(po_number) ~ '^[0-9]{4}-[0-9]{3}$'
      and substring(trim(po_number) from '-([0-9]{3})$')::integer between 1 and 999
    union all
    select id from public.job_transmittals
    where trim(transmittal_number) ~ '^[0-9]{4}-[0-9]{3}$'
      and substring(trim(transmittal_number) from '-([0-9]{3})$')::integer between 1 and 999
  ) eligible;
  select count(*) into registry_count from public.job_document_numbers;
  if registry_count <> eligible_count then
    raise exception 'VERIFY_REGISTRY_COUNT: expected %, found %', eligible_count, registry_count;
  end if;

  if exists (
    select 1
    from public.purchase_orders po
    left join public.job_document_numbers registry
      on registry.document_type = 'purchase_order'
      and registry.document_id = po.id
      and registry.normalized_number = lower(trim(po.po_number))
    where trim(po.po_number) ~ '^[0-9]{4}-[0-9]{3}$'
      and substring(trim(po.po_number) from '-([0-9]{3})$')::integer between 1 and 999
      and registry.document_id is null
  ) or exists (
    select 1
    from public.job_transmittals transmittal
    left join public.job_document_numbers registry
      on registry.document_type = 'job_transmittal'
      and registry.document_id = transmittal.id
      and registry.normalized_number = lower(trim(transmittal.transmittal_number))
    where trim(transmittal.transmittal_number) ~ '^[0-9]{4}-[0-9]{3}$'
      and substring(trim(transmittal.transmittal_number) from '-([0-9]{3})$')::integer between 1 and 999
      and registry.document_id is null
  ) then
    raise exception 'VERIFY_MISSING_REGISTRY_DOCUMENT';
  end if;

  if exists (
    select 1 from public.job_document_numbers registry
    where not exists (
      select 1 from public.purchase_orders po
      where registry.document_type = 'purchase_order' and po.id = registry.document_id
    )
      and not exists (
        select 1 from public.job_transmittals transmittal
        where registry.document_type = 'job_transmittal'
          and transmittal.id = registry.document_id
      )
  ) then
    raise exception 'VERIFY_ORPHAN_REGISTRY_DOCUMENT';
  end if;

  if exists (
    select normalized_number from public.job_document_numbers
    group by normalized_number having count(*) > 1
  ) or exists (
    select prefix, suffix from public.job_document_numbers
    group by prefix, suffix having count(*) > 1
  ) then
    raise exception 'VERIFY_DUPLICATE_REGISTRY_NUMBER';
  end if;
  if exists (
    select 1 from public.job_document_numbers where suffix not between 1 and 999
  ) then
    raise exception 'VERIFY_REGISTRY_SUFFIX_RANGE';
  end if;
  if exists (
    select 1
    from public.job_document_number_sequences sequence
    left join (
      select prefix, max(suffix) as maximum_suffix
      from public.job_document_numbers group by prefix
    ) registry using (prefix)
    where sequence.last_value <> coalesce(registry.maximum_suffix, 0)
       or (sequence.last_value = 0 and registry.maximum_suffix is not null)
  ) then
    raise exception 'VERIFY_SEQUENCE_REGISTRY_MISMATCH';
  end if;
end;
$$;

do $$
declare
  base_snapshot jsonb := jsonb_build_object(
    'document_date','2026-07-28',
    'recipient',jsonb_build_object('company','Example Company','attention',''),
    'sender',jsonb_build_object('name','Verification User','email',''),
    'items',jsonb_build_array(jsonb_build_object(
      'submittal','Shop drawing','description','','number','','quantity','1','date','2026-07-28'
    )),
    'comments',''
  );
  candidate jsonb;
  rejected boolean;
begin
  perform public.validate_job_transmittal_snapshot(
    jsonb_set(base_snapshot,'{recipient}',jsonb_build_object('company','','attention','Architect'))
  );
  perform public.validate_job_transmittal_snapshot(
    jsonb_set(base_snapshot,'{recipient}',jsonb_build_object('company','Example Company','attention','Architect'))
  );
  perform public.validate_job_transmittal_snapshot(
    jsonb_set(base_snapshot,'{recipient}',jsonb_build_object('company','   ','attention','Architect'))
  );
  rejected := false;
  begin
    perform public.validate_job_transmittal_snapshot(
      jsonb_set(base_snapshot,'{recipient}',jsonb_build_object('company',' ','attention',' '))
    );
  exception when others then rejected := sqlerrm = 'TRANSMITTAL_RECIPIENT_REQUIRED';
  end;
  if not rejected then raise exception 'VERIFY_BLANK_RECIPIENT_ACCEPTED'; end if;
  rejected := false;
  begin
    perform public.validate_job_transmittal_snapshot(
      jsonb_set(base_snapshot,'{recipient}',jsonb_build_object('company','','attention',''))
    );
  exception when others then rejected := sqlerrm = 'TRANSMITTAL_RECIPIENT_REQUIRED';
  end;
  if not rejected then raise exception 'VERIFY_EMPTY_RECIPIENT_ACCEPTED'; end if;

  candidate := jsonb_set(base_snapshot,'{items}',jsonb_build_array(
    jsonb_build_object('submittal','','description','Description only','number','','quantity','1','date','')
  ));
  perform public.validate_job_transmittal_snapshot(candidate);
  candidate := jsonb_set(base_snapshot,'{items}',jsonb_build_array(
    jsonb_build_object('submittal','','description','','number','A-101','quantity','1','date','')
  ));
  perform public.validate_job_transmittal_snapshot(candidate);
  candidate := jsonb_set(base_snapshot,'{items}',jsonb_build_array(
    jsonb_build_object('submittal','','description','','number','','quantity','1','date','')
  ));
  rejected := false;
  begin
    perform public.validate_job_transmittal_snapshot(candidate);
  exception when others then rejected := sqlerrm = 'TRANSMITTAL_ITEM_CONTENT_REQUIRED';
  end;
  if not rejected then raise exception 'VERIFY_EMPTY_ITEM_ACCEPTED'; end if;
  rejected := false;
  begin
    perform public.validate_job_transmittal_snapshot(jsonb_set(
      base_snapshot,'{items}',jsonb_build_array(jsonb_build_object(
        'submittal',' ','description',' ','number',' ','quantity','1','date',''
      ))
    ));
  exception when others then rejected := sqlerrm = 'TRANSMITTAL_ITEM_CONTENT_REQUIRED';
  end;
  if not rejected then raise exception 'VERIFY_BLANK_ITEM_ACCEPTED'; end if;
end;
$$;

do $$
declare
  test_prefix text;
  first_number text;
  second_number text;
  third_number text;
  transmittal_only_prefix text;
  before_registry bigint;
  before_sequences bigint;
  before_sequence_value integer;
  rejected boolean;
begin
  select lpad(candidate::text,4,'0') into test_prefix
  from generate_series(9000,9998) candidate
  where not exists (
    select 1 from public.job_document_numbers where prefix=lpad(candidate::text,4,'0')
  )
    and not exists (
      select 1 from public.job_document_number_sequences where prefix=lpad(candidate::text,4,'0')
    )
  limit 1;
  if test_prefix is null then raise exception 'VERIFY_NO_DISPOSABLE_PREFIX'; end if;

  first_number := public.reserve_job_document_number(
    test_prefix,'purchase_order',gen_random_uuid(),null,null,1
  );
  if first_number <> (test_prefix || '-001') then
    raise exception 'VERIFY_PO_FIRST_SUFFIX: %', first_number;
  end if;
  second_number := public.reserve_job_document_number(
    test_prefix,'job_transmittal',gen_random_uuid(),null,null,2
  );
  if second_number <> (test_prefix || '-002') then
    raise exception 'VERIFY_TRANSMITTAL_AFTER_PO: %', second_number;
  end if;
  third_number := public.reserve_job_document_number(
    test_prefix,'purchase_order',gen_random_uuid(),null,null,1
  );
  if third_number <> (test_prefix || '-003') then
    raise exception 'VERIFY_AUTOMATIC_ALLOCATION_DID_NOT_SKIP: %', third_number;
  end if;

  select lpad(candidate::text,4,'0') into transmittal_only_prefix
  from generate_series(9000,9998) candidate
  where lpad(candidate::text,4,'0') <> test_prefix
    and not exists (
      select 1 from public.job_document_numbers where prefix=lpad(candidate::text,4,'0')
    )
    and not exists (
      select 1 from public.job_document_number_sequences where prefix=lpad(candidate::text,4,'0')
    )
  limit 1;
  if public.reserve_job_document_number(
    transmittal_only_prefix,'job_transmittal',gen_random_uuid(),null,null,2
  ) <> (transmittal_only_prefix || '-002') then
    raise exception 'VERIFY_FIRST_TRANSMITTAL_SUFFIX';
  end if;

  rejected := false;
  begin
    perform public.reserve_job_document_number(
      test_prefix,'job_transmittal',gen_random_uuid(),null,test_prefix || '-002',2
    );
  exception when others then rejected := sqlerrm = 'DOCUMENT_NUMBER_COLLISION';
  end;
  if not rejected then raise exception 'VERIFY_MANUAL_COLLISION_ACCEPTED'; end if;

  rejected := false;
  begin
    perform public.reserve_job_document_number(
      test_prefix,'job_transmittal',gen_random_uuid(),null,test_prefix || '-000',2
    );
  exception when others then rejected := sqlerrm = 'DOCUMENT_SUFFIX_INVALID';
  end;
  if not rejected then raise exception 'VERIFY_SUFFIX_ZERO_ACCEPTED'; end if;

  rejected := false;
  begin
    perform public.reserve_job_document_number(
      test_prefix,'job_transmittal',gen_random_uuid(),null,test_prefix || '-1000',2
    );
  exception when others then rejected := sqlerrm in ('DOCUMENT_NUMBER_FORMAT_INVALID','DOCUMENT_SUFFIX_INVALID');
  end;
  if not rejected then raise exception 'VERIFY_SUFFIX_ABOVE_999_ACCEPTED'; end if;

  select count(*) into before_registry from public.job_document_numbers;
  select count(*) into before_sequences from public.job_document_number_sequences;
  select last_value into before_sequence_value
  from public.job_document_number_sequences where prefix=test_prefix;
  begin
    perform public.reserve_job_document_number(
      test_prefix,'purchase_order',gen_random_uuid(),null,null,1
    );
    raise exception 'VERIFY_FORCED_ROLLBACK';
  exception when others then
    if sqlerrm <> 'VERIFY_FORCED_ROLLBACK' then raise; end if;
  end;
  if (select count(*) from public.job_document_numbers) <> before_registry
    or (select count(*) from public.job_document_number_sequences) <> before_sequences
    or (select last_value from public.job_document_number_sequences where prefix=test_prefix)
      is distinct from before_sequence_value
  then
    raise exception 'VERIFY_RESERVATION_ROLLBACK_FAILED';
  end if;
end;
$$;

do $$
declare
  selected_job public.jobs%rowtype;
  test_id uuid;
  claim record;
  second_claim_rejected boolean;
  before_registry bigint;
  before_transmittals bigint;
  provisional_number text;
  snapshot_value jsonb;
begin
  select * into selected_job
  from public.jobs job
  where right(regexp_replace(coalesce(job.job_number,''),'\D','','g'),4) ~ '^[0-9]{4}$'
    and coalesce((
      select max(registry.suffix)
      from public.job_document_numbers registry
      where registry.prefix = right(
        regexp_replace(coalesce(job.job_number,''),'\D','','g'),4
      )
    ),1) < 999
  limit 1;
  if not found then raise exception 'VERIFY_REQUIRES_NUMBERED_JOB'; end if;

  select count(*) into before_registry from public.job_document_numbers;
  provisional_number := public.preview_next_job_document_number(selected_job.id);
  if provisional_number is null then raise exception 'VERIFY_PROVISIONAL_NUMBER_MISSING'; end if;
  if (select count(*) from public.job_document_numbers) <> before_registry then
    raise exception 'VERIFY_PROVISIONAL_RESERVED_NUMBER';
  end if;

  snapshot_value := jsonb_build_object(
    'document_date','2026-07-28',
    'recipient',jsonb_build_object('company','Verification Recipient'),
    'sender',jsonb_build_object('name','Verification User'),
    'items',jsonb_build_array(jsonb_build_object('description','Verification item'))
  );

  test_id := gen_random_uuid();
  insert into public.job_transmittals(
    id,job_id,transmittal_number,document_date,recipient_name,generated_by,
    snapshot,snapshot_hash,document_status
  ) values (
    test_id,selected_job.id,'VERIFY-'||substr(test_id::text,1,8),current_date,
    'Verification Recipient','Verification User',snapshot_value,'fixture','pending'
  );
  select * into claim
  from public.claim_job_transmittal_pdf_generation(test_id,900);
  if claim.claim_token is null or claim.document_status <> 'generating' then
    raise exception 'VERIFY_PENDING_NOT_CLAIMED';
  end if;
  second_claim_rejected := false;
  begin
    perform public.claim_job_transmittal_pdf_generation(test_id,900);
  exception when others then second_claim_rejected := sqlerrm = 'GENERATION_ALREADY_ACTIVE';
  end;
  if not second_claim_rejected then raise exception 'VERIFY_ACTIVE_CLAIM_STOLEN'; end if;
  if public.complete_job_transmittal_pdf_generation(
    test_id,gen_random_uuid(),'job-transmittal-documents','wrong/path','hash',1,'application/pdf'
  ) then raise exception 'VERIFY_WRONG_CLAIM_COMPLETED'; end if;
  if not public.complete_job_transmittal_pdf_generation(
    test_id,claim.claim_token,'job-transmittal-documents',test_id::text||'/document.pdf','hash',1,'application/pdf'
  ) then raise exception 'VERIFY_MATCHING_CLAIM_NOT_COMPLETED'; end if;
  if public.fail_job_transmittal_pdf_generation(
    test_id,claim.claim_token,'stale failure'
  ) then raise exception 'VERIFY_STALE_FAILURE_OVERWROTE_SUCCESS'; end if;
  select * into claim from public.claim_job_transmittal_pdf_generation(test_id,900);
  if claim.document_status <> 'generated' then raise exception 'VERIFY_GENERATED_NOT_IDEMPOTENT'; end if;

  test_id := gen_random_uuid();
  insert into public.job_transmittals(
    id,job_id,transmittal_number,document_date,recipient_name,generated_by,
    snapshot,snapshot_hash,document_status,document_error
  ) values (
    test_id,selected_job.id,'VERIFY-'||substr(test_id::text,1,8),current_date,
    'Verification Recipient','Verification User',snapshot_value,'fixture','failed','fixture'
  );
  select * into claim from public.claim_job_transmittal_pdf_generation(test_id,900);
  if claim.claim_token is null then raise exception 'VERIFY_FAILED_NOT_CLAIMED'; end if;
  if not public.fail_job_transmittal_pdf_generation(test_id,claim.claim_token,'fixture failure') then
    raise exception 'VERIFY_MATCHING_CLAIM_NOT_FAILED';
  end if;

  test_id := gen_random_uuid();
  insert into public.job_transmittals(
    id,job_id,transmittal_number,document_date,recipient_name,generated_by,
    snapshot,snapshot_hash,document_status,generation_claim_token,generation_claimed_at
  ) values (
    test_id,selected_job.id,'VERIFY-'||substr(test_id::text,1,8),current_date,
    'Verification Recipient','Verification User',snapshot_value,'fixture','generating',
    gen_random_uuid(),now()-interval '16 minutes'
  );
  select * into claim from public.claim_job_transmittal_pdf_generation(test_id,900);
  if claim.claim_token is null then raise exception 'VERIFY_STALE_NOT_CLAIMED'; end if;

  test_id := gen_random_uuid();
  insert into public.job_transmittals(
    id,job_id,transmittal_number,document_date,recipient_name,generated_by,
    snapshot,snapshot_hash,document_status,generation_claim_token,generation_claimed_at
  ) values (
    test_id,selected_job.id,'VERIFY-'||substr(test_id::text,1,8),current_date,
    'Verification Recipient','Verification User',snapshot_value,'fixture','generating',
    null,null
  );
  if not exists (
    select 1 from public.list_job_transmittals(selected_job.id) history
    where history.id=test_id and history.recoverable
  ) then raise exception 'VERIFY_LEGACY_GENERATING_NOT_RECOVERABLE'; end if;
  select * into claim from public.claim_job_transmittal_pdf_generation(test_id,900);
  if claim.claim_token is null then raise exception 'VERIFY_LEGACY_GENERATING_NOT_CLAIMED'; end if;

  select count(*) into before_registry from public.job_document_numbers;
  select count(*) into before_transmittals from public.job_transmittals;
  begin
    perform public.issue_job_transmittal(
      selected_job.id,null,snapshot_value,'Verification User'
    );
    raise exception 'VERIFY_FORCED_ISSUANCE_ROLLBACK';
  exception when others then
    if sqlerrm <> 'VERIFY_FORCED_ISSUANCE_ROLLBACK' then raise; end if;
  end;
  if (select count(*) from public.job_document_numbers) <> before_registry
    or (select count(*) from public.job_transmittals) <> before_transmittals
  then
    raise exception 'VERIFY_ISSUANCE_ROLLBACK_FAILED';
  end if;
end;
$$;

rollback;
