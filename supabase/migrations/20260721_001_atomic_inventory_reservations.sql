begin;

create or replace function public.reserve_inventory_quantity(
  p_item_id bigint,
  p_quantity numeric,
  p_production_job_id uuid,
  p_temporary_job_label text,
  p_actor text,
  p_note text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  source public.inventory_items%rowtype;
  reserved_id bigint;
  reservation_label text;
  audit_note text;
begin
  if nullif(trim(p_actor), '') is null then raise exception 'Your name is required.'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Reservation quantity must be greater than zero.'; end if;
  if (p_production_job_id is null) = (nullif(trim(p_temporary_job_label), '') is null) then
    raise exception 'Choose exactly one Production job or temporary reservation label.';
  end if;

  select * into source from public.inventory_items where id = p_item_id for update;
  if not found then raise exception 'Inventory lot was not found.'; end if;
  if source.production_job_id is not null or nullif(trim(source.temporary_job_label), '') is not null or coalesce(source.earmarked_for_job, false) then
    raise exception 'Only general stock can be split into a new reservation.';
  end if;
  if p_quantity > coalesce(source.quantity, 0) then raise exception 'Reservation quantity exceeds available stock.'; end if;

  if p_production_job_id is not null then
    select case when nullif(trim(job_number), '') is not null then trim(job_number) || ' — ' || name else name end
      into reservation_label from public.jobs where id = p_production_job_id;
    if reservation_label is null then raise exception 'Production job was not found.'; end if;
  else
    reservation_label := trim(p_temporary_job_label);
  end if;
  audit_note := '[' || trim(p_actor) || '] Reserved ' || p_quantity || ' ' || coalesce(nullif(trim(source.unit), ''), 'units') || ' for ' || reservation_label || '.';
  if nullif(trim(p_note), '') is not null then audit_note := audit_note || E'\nNote: ' || trim(p_note); end if;

  if p_quantity = source.quantity then
    update public.inventory_items set
      earmarked_for_job = true, earmarked_job = reservation_label,
      earmark_notes = concat_ws(E'\n\n', nullif(earmark_notes, ''), audit_note),
      production_job_id = p_production_job_id,
      temporary_job_label = nullif(trim(p_temporary_job_label), ''), updated_at = now()
    where id = source.id returning id into reserved_id;
  else
    update public.inventory_items set quantity = quantity - p_quantity, updated_at = now() where id = source.id;
    insert into public.inventory_items (
      vendor, color, size, category, quantity, unit, location, pallet_number, notes,
      earmarked_for_job, earmarked_job, earmark_notes, production_job_id, temporary_job_label,
      updated_at, last_counted_at, last_counted_by
    ) values (
      source.vendor, source.color, source.size, source.category, p_quantity, source.unit,
      source.location, source.pallet_number, source.notes, true, reservation_label, audit_note,
      p_production_job_id, nullif(trim(p_temporary_job_label), ''), now(), source.last_counted_at, source.last_counted_by
    ) returning id into reserved_id;
  end if;
  return reserved_id;
end;
$function$;

create or replace function public.release_inventory_reservation(
  p_item_id bigint,
  p_actor text,
  p_note text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  source public.inventory_items%rowtype;
  destination public.inventory_items%rowtype;
  release_note text;
begin
  if nullif(trim(p_actor), '') is null then raise exception 'Your name is required.'; end if;
  select * into source from public.inventory_items where id = p_item_id for update;
  if not found then raise exception 'Inventory lot was not found.'; end if;
  if source.production_job_id is null and nullif(trim(source.temporary_job_label), '') is null and not coalesce(source.earmarked_for_job, false) then
    raise exception 'Inventory lot is not reserved.';
  end if;

  release_note := '[' || trim(p_actor) || '] Returned reserved stock to the general pool.';
  if nullif(trim(p_note), '') is not null then release_note := release_note || E'\nNote: ' || trim(p_note); end if;

  select * into destination from public.inventory_items candidate
  where candidate.id <> source.id
    and candidate.production_job_id is null
    and nullif(trim(candidate.temporary_job_label), '') is null
    and not coalesce(candidate.earmarked_for_job, false)
    and lower(trim(coalesce(candidate.vendor, ''))) = lower(trim(coalesce(source.vendor, '')))
    and lower(trim(coalesce(candidate.color, ''))) = lower(trim(coalesce(source.color, '')))
    and lower(trim(coalesce(candidate.size, ''))) = lower(trim(coalesce(source.size, '')))
    and lower(trim(coalesce(candidate.category, ''))) = lower(trim(coalesce(source.category, '')))
    and lower(trim(coalesce(candidate.unit, ''))) = lower(trim(coalesce(source.unit, '')))
    and lower(trim(coalesce(candidate.location, ''))) = lower(trim(coalesce(source.location, '')))
    and lower(trim(coalesce(candidate.pallet_number, ''))) = lower(trim(coalesce(source.pallet_number, '')))
  order by candidate.updated_at desc nulls last, candidate.id desc
  limit 1 for update;

  if found then
    update public.inventory_items set
      quantity = coalesce(quantity, 0) + coalesce(source.quantity, 0),
      notes = concat_ws(E'\n\n', nullif(notes, ''), release_note), updated_at = now()
    where id = destination.id;
    delete from public.inventory_items where id = source.id;
    return destination.id;
  end if;

  update public.inventory_items set
    earmarked_for_job = false, earmarked_job = null, earmark_notes = null,
    production_job_id = null, temporary_job_label = null,
    notes = concat_ws(E'\n\n', nullif(notes, ''), release_note), updated_at = now()
  where id = source.id;
  return source.id;
end;
$function$;

create or replace function public.release_inventory_reservations_bulk(
  p_item_ids bigint[],
  p_actor text,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare item_id bigint; released integer := 0;
begin
  if coalesce(array_length(p_item_ids, 1), 0) = 0 then raise exception 'Select at least one reserved lot.'; end if;
  if cardinality(p_item_ids) <> (select count(distinct value) from unnest(p_item_ids) as ids(value)) then raise exception 'Duplicate inventory lot IDs are not allowed.'; end if;
  foreach item_id in array p_item_ids loop
    perform public.release_inventory_reservation(item_id, p_actor, p_note);
    released := released + 1;
  end loop;
  return released;
end;
$function$;

revoke all on function public.reserve_inventory_quantity(bigint,numeric,uuid,text,text,text) from public;
revoke all on function public.release_inventory_reservation(bigint,text,text) from public;
revoke all on function public.release_inventory_reservations_bulk(bigint[],text,text) from public;
grant execute on function public.reserve_inventory_quantity(bigint,numeric,uuid,text,text,text) to anon, authenticated, service_role;
grant execute on function public.release_inventory_reservation(bigint,text,text) to anon, authenticated, service_role;
grant execute on function public.release_inventory_reservations_bulk(bigint[],text,text) to anon, authenticated, service_role;

commit;
