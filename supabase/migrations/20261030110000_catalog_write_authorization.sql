-- Narrow local candidate: enforce the existing Catalog UI capability contract
-- on its two canonical save RPCs. No catalog data, taxonomy, pricing or shape
-- change. No Production application is authorized by this file's presence.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';

do $preflight$ begin
 if to_regprocedure('public.require_app_capability(text)') is null
  or to_regprocedure('public.save_purchasing_catalog_item(jsonb)') is null
  or to_regprocedure('public.save_purchasing_catalog_item_v2(jsonb)') is null then
  raise exception 'Existing canonical catalog services and RBAC are required.';
 end if;
 if to_regprocedure('public.tenops_catalog_save_impl(jsonb)') is not null
  or to_regprocedure('public.tenops_catalog_save_v2_impl(jsonb)') is not null then
  raise exception 'Catalog guard implementation names already exist; inspect rather than adopting unknown authority.';
 end if;
end $preflight$;

-- Preserve the exact released business implementations. Only the fixed public
-- wrappers below may invoke these postgres-owned functions; employee, anonymous
-- and service-role clients cannot call the implementations directly.
alter function public.save_purchasing_catalog_item(jsonb) rename to tenops_catalog_save_impl;
alter function public.save_purchasing_catalog_item_v2(jsonb) rename to tenops_catalog_save_v2_impl;
alter function public.tenops_catalog_save_impl(jsonb) owner to postgres;
alter function public.tenops_catalog_save_v2_impl(jsonb) owner to postgres;
revoke all on function public.tenops_catalog_save_impl(jsonb),public.tenops_catalog_save_v2_impl(jsonb) from public,anon,authenticated,service_role;

create function public.save_purchasing_catalog_item(p_item jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null then
  raise exception 'Employee authentication required.' using errcode='42501';
 end if;
 perform 1 from public.app_users where user_id=auth.uid() for share;
 lock table public.app_role_capabilities in share mode;
 perform public.require_app_capability('readOperationalData');
 perform public.require_app_capability('writeBusinessData');
 perform public.require_app_capability('manageVendorsCatalog');
 return public.tenops_catalog_save_impl(p_item);
end $$;

create function public.save_purchasing_catalog_item_v2(p_item jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null then
  raise exception 'Employee authentication required.' using errcode='42501';
 end if;
 perform 1 from public.app_users where user_id=auth.uid() for share;
 lock table public.app_role_capabilities in share mode;
 perform public.require_app_capability('readOperationalData');
 perform public.require_app_capability('writeBusinessData');
 perform public.require_app_capability('manageVendorsCatalog');
 -- The preserved v2 implementation delegates to the guarded public base save;
 -- both entry points therefore retain the same current-employee contract.
 return public.tenops_catalog_save_v2_impl(p_item);
end $$;
alter function public.save_purchasing_catalog_item(jsonb) owner to postgres;
alter function public.save_purchasing_catalog_item_v2(jsonb) owner to postgres;
revoke all on function public.save_purchasing_catalog_item(jsonb),public.save_purchasing_catalog_item_v2(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_purchasing_catalog_item(jsonb),public.save_purchasing_catalog_item_v2(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
