begin;

create table if not exists public.purchase_order_number_sequences (
  prefix text primary key,
  last_value integer not null,
  updated_at timestamptz not null default now(),
  constraint purchase_order_number_sequences_prefix_format
    check (prefix ~ '^[0-9]{4}$'),
  constraint purchase_order_number_sequences_value_positive
    check (last_value > 0)
);

revoke all on table public.purchase_order_number_sequences from public, anon, authenticated;
grant all on table public.purchase_order_number_sequences to service_role;

-- Bootstrap sequence state from legitimate existing numbers without changing
-- any historical or test Purchase Order. Runtime allocation never uses MAX().
insert into public.purchase_order_number_sequences (prefix, last_value)
select
  substring(trim(po_number) from '^([0-9]{4})-[0-9]{3}$'),
  max(substring(trim(po_number) from '^[0-9]{4}-([0-9]{3})$')::integer)
from public.purchase_orders
where trim(po_number) ~ '^[0-9]{4}-[0-9]{3}$'
group by substring(trim(po_number) from '^([0-9]{4})-[0-9]{3}$')
on conflict (prefix) do update
set
  last_value = greatest(public.purchase_order_number_sequences.last_value, excluded.last_value),
  updated_at = now();

create or replace function public.allocate_purchase_order_number(
  p_purchase_order_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  selected_order public.purchase_orders%rowtype;
  selected_prefix text;
  selected_value integer;
  allocated_number text;
begin
  select orders.*
    into selected_order
  from public.purchase_orders orders
  where orders.id = p_purchase_order_id
  for update;

  if not found then
    raise exception 'Purchase Order draft was not found.';
  end if;
  if selected_order.status <> 'draft' then
    raise exception 'Only draft Purchase Orders can receive a number.';
  end if;
  if nullif(trim(selected_order.po_number), '') is not null then
    return trim(selected_order.po_number);
  end if;

  if selected_order.production_job_id is null then
    selected_prefix := '9999';
  else
    selected_prefix := right(regexp_replace(coalesce(selected_order.job_number_snapshot, ''), '[^0-9]', '', 'g'), 4);
    if selected_prefix !~ '^[0-9]{4}$' then
      raise exception 'The linked Production Job needs a Job Number before a Purchase Order number can be allocated.';
    end if;
  end if;

  insert into public.purchase_order_number_sequences (prefix, last_value)
  values (selected_prefix, 1)
  on conflict (prefix) do update
  set last_value = public.purchase_order_number_sequences.last_value + 1,
      updated_at = now()
  returning last_value into selected_value;

  allocated_number := selected_prefix || '-' || lpad(selected_value::text, 3, '0');

  update public.purchase_orders
  set po_number = allocated_number,
      updated_at = now()
  where id = selected_order.id
    and nullif(trim(po_number), '') is null;

  if not found then
    select trim(orders.po_number)
      into allocated_number
    from public.purchase_orders orders
    where orders.id = selected_order.id;
  end if;

  return allocated_number;
exception
  when unique_violation then
    raise exception 'Purchase Order number allocation encountered an existing number. No number was assigned; retry after reconciling the sequence.';
end;
$function$;

create or replace function public.save_chip_purchase_order_draft_v2(
  p_order jsonb,
  p_lines jsonb,
  p_actor text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  order_id uuid;
begin
  order_id := public.save_chip_purchase_order_draft(p_order - 'po_number', p_lines, p_actor);
  perform public.allocate_purchase_order_number(order_id);
  return order_id;
end;
$function$;

revoke all on function public.allocate_purchase_order_number(uuid) from public;
grant execute on function public.allocate_purchase_order_number(uuid)
  to service_role;

revoke all on function public.save_chip_purchase_order_draft_v2(jsonb, jsonb, text) from public;
grant execute on function public.save_chip_purchase_order_draft_v2(jsonb, jsonb, text)
  to anon, authenticated, service_role;

comment on table public.purchase_order_number_sequences is
  'Private concurrency-safe allocator state for immutable Purchase Order numbers.';
comment on function public.allocate_purchase_order_number(uuid) is
  'Allocates one immutable ####-### number to an unnumbered draft using its linked Job suffix or stock prefix 9999.';

commit;
