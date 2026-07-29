-- Read-only deployed-state inspection for the exact PO allocator.
with target as (
  select
    procedure.oid,
    procedure.proowner,
    procedure.prosecdef,
    procedure.proacl
  from pg_proc procedure
  where procedure.oid =
    to_regprocedure('public.allocate_purchase_order_number(uuid)')
)
select
  target.oid::regprocedure as function_identity,
  pg_get_function_identity_arguments(target.oid) as identity_arguments,
  pg_get_userbyid(target.proowner) as owner,
  target.prosecdef as security_definer,
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

-- PL/pgSQL body references are inspected through stored definitions because
-- PostgreSQL does not record every procedural body call as a pg_depend edge.
select
  procedure.oid::regprocedure as dependent_function,
  pg_get_userbyid(procedure.proowner) as owner,
  procedure.prosecdef as security_definer
from pg_proc procedure
where procedure.pronamespace = 'public'::regnamespace
  and procedure.oid <> to_regprocedure(
    'public.allocate_purchase_order_number(uuid)'
  )
  and pg_get_functiondef(procedure.oid) ~
    'allocate_purchase_order_number'
order by procedure.oid::regprocedure::text;
