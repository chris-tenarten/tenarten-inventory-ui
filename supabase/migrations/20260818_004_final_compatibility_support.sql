-- Additive compatibility-mode support for canonical Job PO references and
-- durable, exactly-once account welcome notifications. Does not enforce RBAC.

begin;

alter table public.purchase_orders
  add column if not exists job_po_reference_type text;

alter table public.purchase_orders
  drop constraint if exists purchase_orders_job_po_reference_type_check;
alter table public.purchase_orders
  add constraint purchase_orders_job_po_reference_type_check
  check (job_po_reference_type is null or job_po_reference_type in ('resin', 'chip'));

comment on column public.purchase_orders.job_po_reference_type is
  'Structured optional mapping used only at successful issuance to populate the linked Job Resin PO or Chip PO compatibility reference.';

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
  reference_type text := nullif(btrim(p_order->>'job_po_reference_type'), '');
begin
  if reference_type is not null and reference_type not in ('resin', 'chip') then
    raise exception 'Production PO reference type must be Resin or Chip.' using errcode = '22023';
  end if;
  if reference_type is not null and nullif(p_order->>'production_job_id', '') is null then
    raise exception 'Link a Production Job before selecting a Resin or Chip PO reference.' using errcode = '22023';
  end if;

  order_id := public.save_chip_purchase_order_draft(p_order - 'po_number' - 'job_po_reference_type', p_lines, p_actor);

  update public.purchase_orders
  set job_po_reference_type = reference_type,
      updated_at = now()
  where id = order_id and status = 'draft';
  if not found then raise exception 'Only draft Purchase Orders can set a Production PO reference.'; end if;

  perform public.allocate_purchase_order_number(order_id);
  return order_id;
end;
$function$;

alter function public.save_chip_purchase_order_draft_v2(jsonb, jsonb, text) owner to postgres;
revoke all on function public.save_chip_purchase_order_draft_v2(jsonb, jsonb, text) from public;
grant execute on function public.save_chip_purchase_order_draft_v2(jsonb, jsonb, text)
  to anon, authenticated, service_role;

create or replace function public.apply_issued_purchase_order_job_reference()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  selected_order public.purchase_orders%rowtype;
  current_reference text;
  reference_column text;
begin
  select orders.* into selected_order
  from public.purchase_orders orders
  where orders.id = new.purchase_order_id
  for update;

  if selected_order.job_po_reference_type is null then return new; end if;
  if selected_order.production_job_id is null then
    raise exception 'The issued Purchase Order reference has no linked Production Job.';
  end if;
  if nullif(btrim(selected_order.po_number), '') is null then
    raise exception 'The issued Purchase Order reference has no canonical PO number.';
  end if;

  reference_column := case selected_order.job_po_reference_type
    when 'resin' then 'resin_po'
    when 'chip' then 'chip_po'
  end;

  if reference_column = 'resin_po' then
    select jobs.resin_po into current_reference from public.jobs jobs
    where jobs.id = selected_order.production_job_id for update;
  else
    select jobs.chip_po into current_reference from public.jobs jobs
    where jobs.id = selected_order.production_job_id for update;
  end if;
  if not found then raise exception 'The linked Production Job was not found.'; end if;

  if nullif(btrim(current_reference), '') is not null
     and btrim(current_reference) <> btrim(selected_order.po_number) then
    raise exception 'The linked Job already has a different % reference (%).',
      case selected_order.job_po_reference_type when 'resin' then 'Resin PO' else 'Chip PO' end,
      current_reference;
  end if;

  if nullif(btrim(current_reference), '') is null then
    if reference_column = 'resin_po' then
      update public.jobs set resin_po = btrim(selected_order.po_number), updated_at = now()
      where id = selected_order.production_job_id;
    else
      update public.jobs set chip_po = btrim(selected_order.po_number), updated_at = now()
      where id = selected_order.production_job_id;
    end if;
  end if;

  return new;
end;
$function$;

alter function public.apply_issued_purchase_order_job_reference() owner to postgres;
revoke all on function public.apply_issued_purchase_order_job_reference() from public;

drop trigger if exists purchase_order_issuance_apply_job_reference on public.purchase_order_issuances;
create trigger purchase_order_issuance_apply_job_reference
after insert on public.purchase_order_issuances
for each row execute function public.apply_issued_purchase_order_job_reference();

create table if not exists public.account_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(user_id) on delete cascade,
  notification_key text not null,
  notification_type text not null,
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint account_notifications_key_not_blank check (btrim(notification_key) <> ''),
  constraint account_notifications_type_not_blank check (btrim(notification_type) <> ''),
  constraint account_notifications_title_not_blank check (btrim(title) <> ''),
  constraint account_notifications_body_not_blank check (btrim(body) <> ''),
  unique (user_id, notification_key)
);

create index if not exists account_notifications_user_unread_idx
  on public.account_notifications(user_id, created_at desc)
  where read_at is null;

alter table public.account_notifications enable row level security;
drop policy if exists account_notifications_read_self on public.account_notifications;
create policy account_notifications_read_self on public.account_notifications
for select to authenticated using (user_id = auth.uid());
revoke all on public.account_notifications from public, anon;
grant select on public.account_notifications to authenticated;
grant all on public.account_notifications to service_role;

create or replace function public.ensure_my_welcome_notification()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  selected_user public.app_users%rowtype;
  notification_id uuid;
  welcome_title text;
begin
  select users.* into selected_user
  from public.app_users users
  where users.user_id = auth.uid() and users.is_active;
  if not found then raise exception 'An active TenOps account is required.' using errcode = '42501'; end if;

  welcome_title := case when nullif(btrim(selected_user.display_name), '') is null
    then 'Welcome to TenOps'
    else 'Welcome to TenOps, ' || btrim(selected_user.display_name)
  end;

  insert into public.account_notifications(
    user_id, notification_key, notification_type, title, body, metadata
  ) values (
    selected_user.user_id,
    'account-welcome-v1',
    'welcome',
    welcome_title,
    'Your TenOps account is active. Role-based access is enabled for your account, with permissions based on your assigned role. Use this account for secure access to TenOps.',
    jsonb_build_object('role', selected_user.role)
  )
  on conflict (user_id, notification_key) do update
    set user_id = excluded.user_id
  returning id into notification_id;

  return notification_id;
end;
$function$;

create or replace function public.list_my_account_notifications()
returns table(id uuid, notification_type text, title text, body text, metadata jsonb, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
begin
  perform public.require_app_capability('readOperationalData');
  return query
  select notifications.id, notifications.notification_type, notifications.title,
    notifications.body, notifications.metadata, notifications.created_at
  from public.account_notifications notifications
  where notifications.user_id = auth.uid() and notifications.read_at is null
  order by notifications.created_at desc;
end;
$function$;

create or replace function public.mark_my_account_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  update public.account_notifications
  set read_at = coalesce(read_at, clock_timestamp())
  where id = p_notification_id and user_id = auth.uid();
  if not found then raise exception 'Notification was not found.' using errcode = 'P0002'; end if;
end;
$function$;

alter function public.ensure_my_welcome_notification() owner to postgres;
alter function public.list_my_account_notifications() owner to postgres;
alter function public.mark_my_account_notification_read(uuid) owner to postgres;
revoke all on function public.ensure_my_welcome_notification() from public;
revoke all on function public.list_my_account_notifications() from public;
revoke all on function public.mark_my_account_notification_read(uuid) from public;
grant execute on function public.ensure_my_welcome_notification() to authenticated;
grant execute on function public.list_my_account_notifications() to authenticated;
grant execute on function public.mark_my_account_notification_read(uuid) to authenticated;

comment on table public.account_notifications is
  'Durable account-scoped informational notifications. Authorization remains sourced from app_users and role capabilities.';

commit;
