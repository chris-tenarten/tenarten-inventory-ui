begin;

-- Preserve the existing full-list order while replacing spaced values such as
-- 10, 20, 30 with the compact 1, 2, 3 display-order model.
with ordered as (
  select id, row_number() over (order by sort_order, display_name, id)::integer as normalized_order
  from public.manpower_workers
)
update public.manpower_workers reference
set sort_order = ordered.normalized_order
from ordered
where reference.id = ordered.id
  and reference.sort_order is distinct from ordered.normalized_order;

with ordered as (
  select id, row_number() over (order by sort_order, display_name, id)::integer as normalized_order
  from public.manpower_tasks
)
update public.manpower_tasks reference
set sort_order = ordered.normalized_order
from ordered
where reference.id = ordered.id
  and reference.sort_order is distinct from ordered.normalized_order;

alter table public.manpower_workers
  alter column sort_order set default 1,
  add constraint manpower_workers_sort_order_positive check (sort_order > 0);

alter table public.manpower_tasks
  alter column sort_order set default 1,
  add constraint manpower_tasks_sort_order_positive check (sort_order > 0);

commit;
