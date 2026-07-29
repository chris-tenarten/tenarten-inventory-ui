-- Read-only deployed-state inspection for the exact reservation helper.
with target as (
  select
    procedure.oid,
    procedure.proowner,
    procedure.proacl
  from pg_proc procedure
  where procedure.oid =
    to_regprocedure(
      'public.reserve_job_document_number(text,text,uuid,uuid,text,integer)'
    )
)
select
  target.oid::regprocedure as function_identity,
  pg_get_function_identity_arguments(target.oid) as identity_arguments,
  pg_get_userbyid(target.proowner) as owner,
  target.proacl,
  exists (
    select 1
    from aclexplode(coalesce(
      target.proacl,
      acldefault('f', target.proowner)
    )) privilege
    where privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ) as public_can_execute,
  has_function_privilege('anon', target.oid, 'EXECUTE')
    as anon_can_execute,
  has_function_privilege('authenticated', target.oid, 'EXECUTE')
    as authenticated_can_execute,
  has_function_privilege('service_role', target.oid, 'EXECUTE')
    as service_role_can_execute
from target;

-- Confirm that only the two postgres-owned business wrappers call the helper.
select
  procedure.oid::regprocedure as caller,
  pg_get_userbyid(procedure.proowner) as owner,
  procedure.prosecdef as security_definer
from pg_proc procedure
where procedure.oid in (
  to_regprocedure('public.allocate_purchase_order_number(uuid)'),
  to_regprocedure('public.issue_job_transmittal(uuid,text,jsonb,text)')
)
  and pg_get_functiondef(procedure.oid) ~ 'reserve_job_document_number'
order by procedure.oid::regprocedure::text;
