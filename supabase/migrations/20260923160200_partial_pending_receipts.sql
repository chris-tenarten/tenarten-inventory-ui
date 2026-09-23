-- Explicit partial receiving reuses existing lot/transaction semantics and preserves guarded undo.
begin;
-- Fail closed against the read-only Production capture dated 2026-09-23.
-- Fingerprints include full definitions, attributes, owner and effective grants.
-- Only CRLF/LF transport normalization is allowed; no semantic whitespace stripping.
do $production_guard$
declare expected record; actual text;
begin
 for expected in select * from (values
  ('public.receive_pending_receival_with_reservation(uuid,text)','6108582a016e47bf9f57cd0ec86269c2'),
  ('public.undo_pending_receival_receipt(uuid,text,text)','df3595c408108a56fe3d54ee64fc34ab'),
  ('public.tenops_receive_pending_receival_impl(uuid,text)','7f7ddc5ba9a2f18e0e8888f9a95b72e6'),
  ('public.tenops_undo_pending_receival_impl(uuid,text,text)','f281362f76f45c75eef9fd9fe5b466a5')) as baseline(identity,fingerprint) loop
  select md5((jsonb_build_object('definition',replace(pg_get_functiondef(p.oid),E'\r\n',E'\n'),'owner',pg_get_userbyid(p.proowner),'kind',p.prokind,'security_definer',p.prosecdef,'strict',p.proisstrict,'volatility',p.provolatile,'leakproof',p.proleakproof,'parallel',p.proparallel,'config',p.proconfig,'acl',(select jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(a.grantor),'grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,'privilege',a.privilege_type,'grantable',a.is_grantable) order by pg_get_userbyid(a.grantor),case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable) from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)))::text) into actual from pg_proc p where p.oid=to_regprocedure(expected.identity);
  if actual is distinct from expected.fingerprint then raise exception 'Production function drift: %. Stop and review the installed definition/attributes/grants.',expected.identity; end if;
 end loop;
 select md5((jsonb_build_object('definition',pg_get_constraintdef(c.oid),'validated',c.convalidated,'deferrable',c.condeferrable,'deferred',c.condeferred,'type',c.contype))::text) into actual from pg_constraint c where c.conrelid='public.pending_receivals'::regclass and c.conname='pending_receivals_status_check';
 if actual is distinct from '77ece92d67cfcbc475227cc876379d1c' then raise exception 'Production status constraint drift: pending_receivals_status_check'; end if;
end $production_guard$;
create table public.pending_receival_receipt_batches(
 request_id uuid primary key,
 pending_receival_id uuid not null references public.pending_receivals(id) on delete restrict,
 quantity numeric not null check(quantity>0),
 prior_state jsonb not null,
 transaction_id uuid not null references public.inventory_transactions(id) on delete restrict,
 received_by_user_id uuid references public.app_users(user_id),
 received_by_auth_role text not null check(received_by_auth_role in ('authenticated','service_role')),
 constraint receipt_batch_actor check(received_by_user_id is not null or received_by_auth_role='service_role'),
 created_at timestamptz not null default clock_timestamp(),
 reversed_at timestamptz
);
alter table public.pending_receival_receipt_batches enable row level security;
revoke all on public.pending_receival_receipt_batches from public,anon,authenticated;
grant select on public.pending_receival_receipt_batches to authenticated;
grant all on public.pending_receival_receipt_batches to service_role;
create policy receipt_batches_read on public.pending_receival_receipt_batches for select to authenticated using(public.has_app_capability('readOperationalData'));
create function public.receive_pending_receival_quantity(
  p_receival_id uuid,
  p_received_by text, p_quantity numeric, p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  receival public.pending_receivals%rowtype;
  destination public.inventory_items%rowtype;
  remaining_quantity numeric;
  reservation_label text;
  reservation_enabled boolean;
  transaction_vendor text;
  destination_found boolean := false;
  created_inventory_item boolean := false;
  destination_id bigint;
  new_receipt_transaction_id uuid;
  receipt_note text;
  event_time timestamptz := clock_timestamp();
  prior jsonb;
  receipt_catalog_source text:='standard';
  replay public.pending_receival_receipt_batches%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
   perform public.require_app_capability('receiveInventory');
 end if;
  if p_request_id is null or p_quantity is null or p_quantity<=0 or p_quantity::text in('NaN','Infinity','-Infinity') then raise exception 'A positive receipt quantity and request ID are required.' using errcode='22023'; end if;
  if nullif(trim(p_received_by), '') is null then
    raise exception 'Received by is required.';
  end if;

  select * into receival
  from public.pending_receivals
  where id = p_receival_id
  for update;

  if not found then raise exception 'Pending receival was not found.'; end if;
  select * into replay from public.pending_receival_receipt_batches where request_id=p_request_id;
  if found then
    if replay.pending_receival_id<>p_receival_id or replay.quantity<>p_quantity or replay.reversed_at is not null then raise exception 'Receipt request ID was already used for a different or reversed receipt.'; end if;
    return;
  end if;
  prior:=to_jsonb(receival);
  if receival.source_purchase_order_issuance_id is not null then
    select coalesce(nullif(item->>'catalog_source',''),'standard') into receipt_catalog_source from public.purchase_order_issuances i cross join lateral jsonb_array_elements(i.lines_snapshot)item where i.id=receival.source_purchase_order_issuance_id and item->>'purchase_order_line_id'=receival.source_purchase_order_line_id::text;
  end if;
  if receival.status <> 'pending' then
    raise exception 'Pending receival is no longer receivable.';
  end if;

  remaining_quantity := receival.quantity_expected - coalesce(receival.quantity_received, 0);
  if receival.quantity_expected is null
    or coalesce(receival.quantity_received, 0) < 0
    or coalesce(receival.quantity_received, 0) > receival.quantity_expected then
    raise exception 'Pending receival has invalid expected or received quantities.';
  end if;
  if p_quantity>remaining_quantity then raise exception 'Receipt exceeds remaining expected quantity.' using errcode='22023'; end if;
  remaining_quantity:=p_quantity;

  if receival.production_job_id is not null then
    select coalesce(
      nullif(trim(receival.earmarked_job_name), ''),
      case when nullif(trim(job_number), '') is not null then trim(job_number) || ' — ' || name else name end
    ) into reservation_label
    from public.jobs where id = receival.production_job_id;
  else
    reservation_label := coalesce(
      nullif(trim(receival.temporary_job_label), ''),
      nullif(trim(receival.earmarked_job_name), '')
    );
  end if;

  reservation_enabled := receival.production_job_id is not null
    or nullif(trim(receival.temporary_job_label), '') is not null
    or coalesce(receival.is_earmarked, false);
  transaction_vendor := coalesce(nullif(trim(receival.vendor), ''), 'Unspecified');
  receipt_note := concat_ws(' ', 'Received from pending receival.', nullif(receival.notes, ''));

  if not reservation_enabled then
    select * into destination
    from public.inventory_items inventory
    where lower(trim(coalesce(inventory.vendor, ''))) = lower(trim(coalesce(receival.vendor, '')))
      and lower(trim(coalesce(inventory.color, ''))) = lower(trim(coalesce(receival.material_name, '')))
      and lower(trim(coalesce(inventory.size, ''))) = lower(trim(coalesce(receival.size, '')))
      and lower(trim(coalesce(inventory.category, ''))) = lower(trim(coalesce(receival.category, '')))
      and lower(trim(coalesce(inventory.unit, 'Bags'))) = lower(trim(coalesce(nullif(receival.unit, ''), 'Bags')))
      and lower(trim(coalesce(inventory.location, 'Denton'))) = lower(trim(coalesce(nullif(receival.location, ''), 'Denton')))
      and lower(trim(coalesce(inventory.pallet_number, ''))) = lower(trim(coalesce(receival.pallet_number, '')))
      and coalesce(inventory.earmarked_for_job, false) = false
      and inventory.production_job_id is null
      and nullif(trim(inventory.temporary_job_label), '') is null
    order by inventory.updated_at desc nulls last, inventory.id desc
    limit 1 for update;
    destination_found := found;
  end if;

  if destination_found then
    destination_id := destination.id;
    update public.inventory_items
    set quantity = coalesce(quantity, 0) + remaining_quantity,
        updated_at = event_time,
        last_counted_at = event_time
    where id = destination_id;
  else
    insert into public.inventory_items (
      vendor, color, size, category, quantity, unit, location, pallet_number, notes,
      earmarked_for_job, earmarked_job, earmark_notes, production_job_id, temporary_job_label,
      updated_at, last_counted_at
    ) values (
      nullif(receival.vendor, ''), receival.material_name, nullif(receival.size, ''), nullif(receival.category, ''),
      remaining_quantity, coalesce(nullif(receival.unit, ''), 'Bags'),
      coalesce(nullif(receival.location, ''), 'Denton'), nullif(receival.pallet_number, ''), receival.notes,
      reservation_enabled, reservation_label, nullif(receival.earmark_notes, ''), receival.production_job_id,
      nullif(trim(receival.temporary_job_label), ''), event_time, event_time
    ) returning id into destination_id;
    created_inventory_item := true;
  end if;

  insert into public.inventory_transactions (
    transaction_type, vendor, item_name, size, unit, quantity, location, notes,
    catalog_source, is_earmarked, earmarked_job_name, earmarked_job_id,
    earmark_notes, production_job_id, temporary_job_label, synced_to_inventory_at,
    pending_receival_id, inventory_item_id
  ) values (
    'intake', transaction_vendor, receival.material_name, nullif(receival.size, ''),
    coalesce(nullif(receival.unit, ''), 'Bags'), remaining_quantity,
    coalesce(nullif(receival.location, ''), 'Denton'), receipt_note,
    coalesce(receipt_catalog_source,'standard'), reservation_enabled, reservation_label, null, nullif(receival.earmark_notes, ''),
    receival.production_job_id, nullif(trim(receival.temporary_job_label), ''), event_time,
    receival.id, destination_id
  ) returning id into new_receipt_transaction_id;

  update public.pending_receivals
  set quantity_received = coalesce(receival.quantity_received,0)+p_quantity,
      status = case when coalesce(receival.quantity_received,0)+p_quantity=receival.quantity_expected then 'received' else 'pending' end,
      received_by = trim(p_received_by),
      received_at = event_time,
      receipt_inventory_item_id = destination_id,
      receipt_transaction_id = new_receipt_transaction_id,
      receipt_created_inventory_item = created_inventory_item
  where id = p_receival_id;
  insert into public.pending_receival_receipt_batches(request_id,pending_receival_id,quantity,prior_state,transaction_id,received_by_user_id,received_by_auth_role) values(p_request_id,p_receival_id,p_quantity,prior,new_receipt_transaction_id,case when auth.role()='service_role' then null else auth.uid() end,auth.role());
end;
$function$;


create or replace function public.receive_pending_receival_with_reservation(p_receival_id uuid,p_received_by text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare remaining numeric;
begin
 if coalesce(auth.role(), '') <> 'service_role' then
   perform public.require_app_capability('receiveInventory');
 end if;
 select quantity_expected-coalesce(quantity_received,0) into strict remaining from public.pending_receivals where id=p_receival_id for update;
 perform public.receive_pending_receival_quantity(p_receival_id,p_received_by,remaining,gen_random_uuid());
end $$;
alter function public.undo_pending_receival_receipt(uuid,text,text) rename to po_base_undo_pending_receival;
revoke all on function public.po_base_undo_pending_receival(uuid,text,text) from public,anon,authenticated,service_role;
create function public.undo_pending_receival_receipt(p_receival_id uuid,p_actor text,p_reason text default null)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.pending_receivals%rowtype; batch public.pending_receival_receipt_batches%rowtype;
begin
 if coalesce(auth.role(), '') <> 'service_role' then
   perform public.require_app_capability('adjustInventory');
 end if;
 select * into strict r from public.pending_receivals where id=p_receival_id for update;
 select * into batch from public.pending_receival_receipt_batches where transaction_id=r.receipt_transaction_id and reversed_at is null for update;
 if not found then perform public.po_base_undo_pending_receival(p_receival_id,p_actor,p_reason);return; end if;
 if r.status not in('received','pending') or coalesce(r.quantity_received,0)<=0 then raise exception 'Only a received or partially received record can undo its latest receipt.'; end if;
 update public.pending_receivals set status='received' where id=r.id;
 perform public.po_base_undo_pending_receival(p_receival_id,p_actor,p_reason);
 update public.pending_receivals set quantity_received=(batch.prior_state->>'quantity_received')::numeric,status=batch.prior_state->>'status',received_by=batch.prior_state->>'received_by',received_at=(batch.prior_state->>'received_at')::timestamptz,receipt_inventory_item_id=(batch.prior_state->>'receipt_inventory_item_id')::bigint,receipt_transaction_id=(batch.prior_state->>'receipt_transaction_id')::uuid,receipt_created_inventory_item=(batch.prior_state->>'receipt_created_inventory_item')::boolean where id=r.id;
 update public.pending_receival_receipt_batches set reversed_at=clock_timestamp() where request_id=batch.request_id;
end $$;
alter function public.receive_pending_receival_quantity(uuid,text,numeric,uuid) owner to postgres;
alter function public.receive_pending_receival_with_reservation(uuid,text) owner to postgres;
alter function public.undo_pending_receival_receipt(uuid,text,text) owner to postgres;
revoke all on function public.receive_pending_receival_quantity(uuid,text,numeric,uuid),public.receive_pending_receival_with_reservation(uuid,text),public.undo_pending_receival_receipt(uuid,text,text) from public,anon;
grant execute on function public.receive_pending_receival_quantity(uuid,text,numeric,uuid),public.receive_pending_receival_with_reservation(uuid,text),public.undo_pending_receival_receipt(uuid,text,text) to authenticated,service_role;
commit;
