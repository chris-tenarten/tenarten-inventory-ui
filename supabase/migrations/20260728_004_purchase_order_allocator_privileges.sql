begin;

do $$
begin
  if not exists (
    select 1
    from pg_proc procedure
    where procedure.oid =
      to_regprocedure('public.save_chip_purchase_order_draft_v2(jsonb,jsonb,text)')
      and pg_get_userbyid(procedure.proowner) = 'postgres'
      and procedure.prosecdef
      and pg_get_functiondef(procedure.oid) ~
        'allocate_purchase_order_number'
  ) then
    raise exception 'PO_ALLOCATOR_WRAPPER_BOUNDARY_INVALID';
  end if;
end;
$$;

-- allocate_purchase_order_number is reached through the browser-callable,
-- postgres-owned SECURITY DEFINER draft-save RPC. No API or Edge Function role
-- needs to invoke this lower-level allocator directly.
alter function public.allocate_purchase_order_number(uuid) owner to postgres;

revoke all on function public.allocate_purchase_order_number(uuid)
  from public, anon, authenticated, service_role;

comment on function public.allocate_purchase_order_number(uuid) is
  'Owner-private Purchase Order numbering helper. Called by the postgres-owned SECURITY DEFINER save_chip_purchase_order_draft_v2 RPC.';

commit;
