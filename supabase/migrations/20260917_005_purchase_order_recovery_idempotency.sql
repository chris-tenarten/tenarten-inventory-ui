-- Make exceptional lost-Draft recovery server-authoritatively idempotent.
-- Ordinary Purchase Order saves and number allocation remain unchanged.
begin;

alter table public.purchase_orders
  add column recovery_key text,
  add column recovery_payload_hash text;

alter table public.purchase_orders
  add constraint purchase_orders_recovery_identity_complete
  check ((recovery_key is null) = (recovery_payload_hash is null));

create unique index purchase_orders_recovery_key_unique_idx
  on public.purchase_orders(recovery_key)
  where recovery_key is not null;

create function public.recover_purchase_order_draft_v2(
  p_order jsonb,p_lines jsonb,p_actor text,p_confirmation text,p_recovery_key text
)
returns uuid language plpgsql security definer
set search_path=pg_catalog,public,extensions,pg_temp as $function$
declare
  order_id uuid;
  existing_hash text;
  selected_key text:=nullif(btrim(p_recovery_key),'');
  selected_hash text;
begin
  if p_confirmation <> 'RECOVER_EVIDENCE_BACKED_UNNUMBERED_DRAFT' then
    raise exception 'Recovery confirmation is required.' using errcode='22023';
  end if;
  if selected_key is null or selected_key !~ '^[a-z0-9][a-z0-9._:-]{7,127}$' then
    raise exception 'A stable recovery identity is required.' using errcode='22023';
  end if;
  if nullif(p_order->>'id','') is not null or nullif(p_order->>'po_number','') is not null then
    raise exception 'Recovery creates only a new unnumbered Draft.' using errcode='22023';
  end if;

  selected_hash:=encode(extensions.digest(convert_to(jsonb_build_object(
    'order',p_order-'id'-'po_number'-'job_po_reference_type',
    'lines',p_lines,
    'actor',btrim(p_actor)
  )::text,'UTF8'),'sha256'),'hex');

  -- Serialize retries for one logical recovery before any Draft is created.
  perform pg_advisory_xact_lock(hashtextextended('purchase-order-recovery:'||selected_key,0));
  select id,recovery_payload_hash into order_id,existing_hash
  from public.purchase_orders where recovery_key=selected_key for update;
  if found then
    if existing_hash is distinct from selected_hash then
      raise exception 'A recovery Draft already exists, but the supplied recovery data conflicts.' using errcode='23505';
    end if;
    return order_id;
  end if;

  -- Delegate all authorization, validation, totals, and line persistence to the
  -- already-applied guarded recovery implementation.
  order_id:=public.recover_purchase_order_draft_v2(p_order,p_lines,p_actor,p_confirmation);
  update public.purchase_orders set
    recovery_key=selected_key,
    recovery_payload_hash=selected_hash,
    updated_at=now()
  where id=order_id and status='draft' and po_number is null;
  if not found then
    raise exception 'Recovery did not create an unnumbered Purchase Order Draft.';
  end if;
  return order_id;
end;$function$;

alter function public.recover_purchase_order_draft_v2(jsonb,jsonb,text,text,text) owner to postgres;
revoke all on function public.recover_purchase_order_draft_v2(jsonb,jsonb,text,text) from public,anon,authenticated,service_role;
revoke all on function public.recover_purchase_order_draft_v2(jsonb,jsonb,text,text,text) from public,anon;
grant execute on function public.recover_purchase_order_draft_v2(jsonb,jsonb,text,text,text) to authenticated,service_role;

comment on column public.purchase_orders.recovery_key is 'Stable identity for an exceptional evidence-backed Draft recovery; NULL for ordinary Purchase Orders.';
comment on function public.recover_purchase_order_draft_v2(jsonb,jsonb,text,text,text) is 'Server-authoritative idempotent recovery of one evidence-backed unnumbered Purchase Order Draft.';

commit;
