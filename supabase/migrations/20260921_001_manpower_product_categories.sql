begin;

insert into public.app_role_capabilities(role, capability)
values ('lead', 'manageManpowerProductCategories'), ('admin', 'manageManpowerProductCategories')
on conflict do nothing;

create table public.manpower_product_categories (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (display_name = btrim(display_name) and length(display_name) > 0),
  sort_order integer not null check (sort_order > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid references public.app_users(user_id),
  updated_by_user_id uuid references public.app_users(user_id),
  constraint manpower_product_category_reserved_name check (lower(display_name) <> 'uncategorized')
);
create unique index manpower_product_categories_name_unique
  on public.manpower_product_categories(lower(btrim(display_name)));
create index manpower_product_categories_order_idx
  on public.manpower_product_categories(sort_order, display_name, id);

-- Reference records only. Never infer or backfill historical labor attribution.
insert into public.manpower_product_categories(display_name, sort_order) values
  ('Base', 1), ('Slabs', 2), ('Cove Base', 3), ('Stairs', 4), ('MISC.', 5), ('General / Shared', 6);

create function public.audit_manpower_product_category()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $function$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then raise exception 'Category identity cannot change.'; end if;
    new.created_at := old.created_at;
    new.created_by_user_id := old.created_by_user_id;
  else
    new.created_at := now();
    new.created_by_user_id := auth.uid();
  end if;
  new.display_name := btrim(new.display_name);
  new.updated_at := clock_timestamp();
  new.updated_by_user_id := auth.uid();
  return new;
end;
$function$;
alter function public.audit_manpower_product_category() owner to postgres;
revoke all on function public.audit_manpower_product_category() from public, anon, authenticated;
create trigger manpower_product_category_audit before insert or update
  on public.manpower_product_categories for each row execute function public.audit_manpower_product_category();

alter table public.manpower_product_categories enable row level security;
revoke all on public.manpower_product_categories from public, anon, authenticated;
grant select, insert, update on public.manpower_product_categories to authenticated;
grant all on public.manpower_product_categories to service_role;
create policy manpower_product_categories_read on public.manpower_product_categories
  for select to authenticated using (public.has_app_capability('readOperationalData'));
create policy manpower_product_categories_insert on public.manpower_product_categories
  for insert to authenticated with check (public.has_app_capability('manageManpowerProductCategories'));
create policy manpower_product_categories_update on public.manpower_product_categories
  for update to authenticated using (public.has_app_capability('manageManpowerProductCategories'))
  with check (public.has_app_capability('manageManpowerProductCategories'));

alter table public.manpower_entries add column product_category_id uuid
  references public.manpower_product_categories(id) on delete restrict;
create index manpower_entries_job_product_date_idx
  on public.manpower_entries(job_id, product_category_id, work_date, id);
comment on column public.manpower_entries.product_category_id is
  'Deliverable kind consuming labor, independent of Job/Rework/reporting group and any future Work Order. Historical NULL means Uncategorized.';

create function public.validate_manpower_product_category()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare category_active boolean;
begin
  -- Historical nulls and inactive references survive unrelated corrections.
  if tg_op = 'UPDATE' then
    if new.product_category_id is not distinct from old.product_category_id then return new; end if;
  end if;
  if new.product_category_id is null then
    raise exception 'Select an active Product Category. Refresh the application if this field is missing.' using errcode = '23514';
  end if;
  perform public.require_app_capability('readOperationalData');
  -- SHARE conflicts with category UPDATE: assignment and deactivation serialize.
  select is_active into category_active from public.manpower_product_categories
    where id = new.product_category_id for share;
  if not found or not category_active then
    raise exception 'This Product Category is no longer active. Refresh categories and choose an active category.' using errcode = '23514';
  end if;
  return new;
end;
$function$;
alter function public.validate_manpower_product_category() owner to postgres;
revoke all on function public.validate_manpower_product_category() from public, anon, authenticated;
create trigger manpower_entry_product_category_guard before insert or update
  on public.manpower_entries for each row execute function public.validate_manpower_product_category();

notify pgrst, 'reload schema';
commit;
