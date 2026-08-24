begin;

-- Narrow RBAC boundary for Pending Receivals. This intentionally does not
-- activate or reproduce the dormant broad RBAC enforcement migration.
do $preflight$
begin
  if to_regclass('public.pending_receivals') is null then
    raise exception 'Pending Receival RBAC enforcement requires public.pending_receivals.';
  end if;
  if to_regprocedure('public.has_app_capability(text)') is null
    or to_regprocedure('public.require_app_capability(text)') is null then
    raise exception 'Pending Receival RBAC enforcement requires the canonical TenOps capability helpers.';
  end if;
  if to_regprocedure('public.receive_pending_receival_with_reservation(uuid,text)') is null
    or to_regprocedure('public.undo_pending_receival_receipt(uuid,text,text)') is null
    or to_regprocedure('public.create_pending_receivals_from_purchase_order(uuid,jsonb,text)') is null then
    raise exception 'Pending Receival RBAC enforcement requires the deployed canonical Pending Receival RPCs.';
  end if;
end;
$preflight$;

-- Preserve existing reads while removing every legacy client write grant.
revoke insert, update, delete, truncate, references, trigger
  on table public.pending_receivals from anon, authenticated;
grant select on table public.pending_receivals to anon, authenticated;
grant insert, update, delete on table public.pending_receivals to authenticated;

drop policy if exists "Allow anon insert pending receivals" on public.pending_receivals;
drop policy if exists "Allow anon update pending receivals" on public.pending_receivals;
drop policy if exists "Pending receivals insert" on public.pending_receivals;
drop policy if exists "Pending receivals update" on public.pending_receivals;
drop policy if exists "Pending receivals delete" on public.pending_receivals;
drop policy if exists "Pending Receivals RBAC insert" on public.pending_receivals;
drop policy if exists "Pending Receivals RBAC update" on public.pending_receivals;
drop policy if exists "Pending Receivals RBAC delete" on public.pending_receivals;

create policy "Pending Receivals RBAC insert"
  on public.pending_receivals for insert to authenticated
  with check (public.has_app_capability('adjustInventory'));

create policy "Pending Receivals RBAC update"
  on public.pending_receivals for update to authenticated
  using (public.has_app_capability('adjustInventory'))
  with check (public.has_app_capability('adjustInventory'));

create policy "Pending Receivals RBAC delete"
  on public.pending_receivals for delete to authenticated
  using (public.has_app_capability('adjustInventory'));

-- Retain the deployed implementations byte-for-byte behind small capability
-- wrappers. The implementation functions are not client-callable.
do $wrap$
begin
  if to_regprocedure('public.tenops_receive_pending_receival_impl(uuid,text)') is null then
    alter function public.receive_pending_receival_with_reservation(uuid, text)
      rename to tenops_receive_pending_receival_impl;
  end if;
  if to_regprocedure('public.tenops_undo_pending_receival_impl(uuid,text,text)') is null then
    alter function public.undo_pending_receival_receipt(uuid, text, text)
      rename to tenops_undo_pending_receival_impl;
  end if;
  if to_regprocedure('public.tenops_create_pending_receivals_from_po_impl(uuid,jsonb,text)') is null then
    alter function public.create_pending_receivals_from_purchase_order(uuid, jsonb, text)
      rename to tenops_create_pending_receivals_from_po_impl;
  end if;
end;
$wrap$;

revoke all on function public.tenops_receive_pending_receival_impl(uuid, text)
  from public, anon, authenticated;
revoke all on function public.tenops_undo_pending_receival_impl(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.tenops_create_pending_receivals_from_po_impl(uuid, jsonb, text)
  from public, anon, authenticated;

create or replace function public.receive_pending_receival_with_reservation(
  p_receival_id uuid,
  p_received_by text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    perform public.require_app_capability('receiveInventory');
  end if;
  perform public.tenops_receive_pending_receival_impl(p_receival_id, p_received_by);
end;
$function$;

create or replace function public.undo_pending_receival_receipt(
  p_receival_id uuid,
  p_actor text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    perform public.require_app_capability('adjustInventory');
  end if;
  perform public.tenops_undo_pending_receival_impl(p_receival_id, p_actor, p_reason);
end;
$function$;

create or replace function public.create_pending_receivals_from_purchase_order(
  p_issuance_id uuid,
  p_lines jsonb,
  p_actor text
)
returns table (
  pending_receival_id uuid,
  source_line_id uuid,
  source_line_number integer,
  creation_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    perform public.require_app_capability('adjustInventory');
  end if;
  return query
  select *
  from public.tenops_create_pending_receivals_from_po_impl(p_issuance_id, p_lines, p_actor);
end;
$function$;

alter function public.receive_pending_receival_with_reservation(uuid, text) owner to postgres;
alter function public.undo_pending_receival_receipt(uuid, text, text) owner to postgres;
alter function public.create_pending_receivals_from_purchase_order(uuid, jsonb, text) owner to postgres;

revoke all on function public.receive_pending_receival_with_reservation(uuid, text) from public, anon;
revoke all on function public.undo_pending_receival_receipt(uuid, text, text) from public, anon;
revoke all on function public.create_pending_receivals_from_purchase_order(uuid, jsonb, text) from public, anon;
grant execute on function public.receive_pending_receival_with_reservation(uuid, text) to authenticated, service_role;
grant execute on function public.undo_pending_receival_receipt(uuid, text, text) to authenticated, service_role;
grant execute on function public.create_pending_receivals_from_purchase_order(uuid, jsonb, text) to authenticated, service_role;

-- Close legacy/test SECURITY DEFINER paths that could otherwise bypass the
-- canonical Pending Receival boundary. Neither is used by the application.
revoke all on function public.receive_pending_receival(uuid, text)
  from public, anon, authenticated;
revoke all on function public.purge_test_purchase_order(uuid, text, text)
  from public, anon, authenticated;

commit;
