-- PP-001: canonical Pre-Production Bids and durable lifecycle evidence.
-- This migration does not read from or write to public.jobs.
begin;

create table public.bids (
  id uuid primary key default gen_random_uuid(),
  customer text not null check (btrim(customer) <> '' and length(btrim(customer)) <= 200),
  project_name text not null check (btrim(project_name) <> '' and length(btrim(project_name)) <= 300),
  creator_user_id uuid not null references public.app_users(user_id),
  owner_user_id uuid not null references public.app_users(user_id),
  status text not null default 'active' check (status in ('active','won','lost')),
  deposit_received_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bids_status_updated_idx on public.bids(status,updated_at desc,id);
create index bids_owner_updated_idx on public.bids(owner_user_id,updated_at desc,id);

create table public.bid_activity (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references public.bids(id) on delete restrict,
  activity_type text not null check (activity_type in ('created','details_updated','owner_changed','status_changed','deposit_received_changed')),
  actor_user_id uuid not null references public.app_users(user_id),
  occurred_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object')
);

create index bid_activity_bid_occurred_idx on public.bid_activity(bid_id,occurred_at desc,id);

create trigger bids_touch_updated_at before update on public.bids
for each row execute function public.tenops_touch_updated_at();

alter table public.bids enable row level security;
alter table public.bid_activity enable row level security;

create policy bids_operational_select on public.bids for select to authenticated
using (public.has_app_capability('readOperationalData'));
create policy bid_activity_operational_select on public.bid_activity for select to authenticated
using (public.has_app_capability('readOperationalData'));

revoke all on public.bids, public.bid_activity from public,anon,authenticated;
grant select on public.bids, public.bid_activity to authenticated;
grant all on public.bids, public.bid_activity to service_role;

create function public.list_bid_owners()
returns table(user_id uuid,display_name text)
language sql stable security definer set search_path=pg_catalog,public as $$
  select u.user_id,u.display_name
  from public.app_users u
  where public.has_app_capability('readOperationalData') and u.is_active
  order by u.display_name,u.user_id
$$;

create function public.list_bids()
returns table(id uuid,customer text,project_name text,creator_user_id uuid,creator_name text,owner_user_id uuid,owner_name text,status text,deposit_received_date date,created_at timestamptz,updated_at timestamptz)
language sql stable security definer set search_path=pg_catalog,public as $$
  select b.id,b.customer,b.project_name,b.creator_user_id,creator.display_name,b.owner_user_id,owner_user.display_name,b.status,b.deposit_received_date,b.created_at,b.updated_at
  from public.bids b
  join public.app_users creator on creator.user_id=b.creator_user_id
  join public.app_users owner_user on owner_user.user_id=b.owner_user_id
  where public.has_app_capability('readOperationalData')
  order by b.updated_at desc,b.id
$$;

create function public.list_bid_activity(p_bid_id uuid)
returns table(id uuid,activity_type text,actor_user_id uuid,actor_name text,occurred_at timestamptz,details jsonb)
language sql stable security definer set search_path=pg_catalog,public as $$
  select a.id,a.activity_type,a.actor_user_id,u.display_name,a.occurred_at,a.details
  from public.bid_activity a join public.app_users u on u.user_id=a.actor_user_id
  where public.has_app_capability('readOperationalData') and a.bid_id=p_bid_id
  order by a.occurred_at desc,a.id desc
$$;

create function public.create_bid(p_customer text,p_project_name text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_users%rowtype; created_id uuid:=gen_random_uuid();
begin
  perform public.require_app_capability('readOperationalData');
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  if nullif(btrim(p_customer),'') is null then raise exception 'Customer is required.' using errcode='22023'; end if;
  if nullif(btrim(p_project_name),'') is null then raise exception 'Project Name is required.' using errcode='22023'; end if;
  insert into public.bids(id,customer,project_name,creator_user_id,owner_user_id)
  values(created_id,btrim(p_customer),btrim(p_project_name),actor.user_id,actor.user_id);
  insert into public.bid_activity(bid_id,activity_type,actor_user_id,details)
  values(created_id,'created',actor.user_id,jsonb_build_object('customer',btrim(p_customer),'project_name',btrim(p_project_name),'owner_user_id',actor.user_id,'status','active'));
  return created_id;
end $$;

create function public.update_bid(
  p_bid_id uuid,
  p_customer text,
  p_project_name text,
  p_owner_user_id uuid,
  p_status text,
  p_deposit_received_date date
) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_users%rowtype; current_bid public.bids%rowtype; next_owner public.app_users%rowtype; recorded_at timestamptz:=clock_timestamp();
begin
  perform public.require_app_capability('readOperationalData');
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  select * into strict current_bid from public.bids where id=p_bid_id for update;
  if nullif(btrim(p_customer),'') is null then raise exception 'Customer is required.' using errcode='22023'; end if;
  if nullif(btrim(p_project_name),'') is null then raise exception 'Project Name is required.' using errcode='22023'; end if;
  if p_status not in ('active','won','lost') then raise exception 'Unsupported Bid status.' using errcode='22023'; end if;
  select * into strict next_owner from public.app_users where user_id=p_owner_user_id and is_active;

  if row(current_bid.customer,current_bid.project_name) is distinct from row(btrim(p_customer),btrim(p_project_name)) then
    insert into public.bid_activity(bid_id,activity_type,actor_user_id,occurred_at,details)
    values(p_bid_id,'details_updated',actor.user_id,recorded_at,jsonb_build_object('from',jsonb_build_object('customer',current_bid.customer,'project_name',current_bid.project_name),'to',jsonb_build_object('customer',btrim(p_customer),'project_name',btrim(p_project_name))));
  end if;
  if current_bid.owner_user_id is distinct from next_owner.user_id then
    insert into public.bid_activity(bid_id,activity_type,actor_user_id,occurred_at,details)
    values(p_bid_id,'owner_changed',actor.user_id,recorded_at,jsonb_build_object('from_owner_user_id',current_bid.owner_user_id,'to_owner_user_id',next_owner.user_id));
  end if;
  if current_bid.status is distinct from p_status then
    insert into public.bid_activity(bid_id,activity_type,actor_user_id,occurred_at,details)
    values(p_bid_id,'status_changed',actor.user_id,recorded_at,jsonb_build_object('from_status',current_bid.status,'to_status',p_status));
  end if;
  if current_bid.deposit_received_date is distinct from p_deposit_received_date then
    insert into public.bid_activity(bid_id,activity_type,actor_user_id,occurred_at,details)
    values(p_bid_id,'deposit_received_changed',actor.user_id,recorded_at,jsonb_strip_nulls(jsonb_build_object('from_business_date',current_bid.deposit_received_date,'to_business_date',p_deposit_received_date)));
  end if;

  update public.bids set customer=btrim(p_customer),project_name=btrim(p_project_name),owner_user_id=next_owner.user_id,status=p_status,deposit_received_date=p_deposit_received_date where id=p_bid_id;
end $$;

alter function public.list_bid_owners() owner to postgres;
alter function public.list_bids() owner to postgres;
alter function public.list_bid_activity(uuid) owner to postgres;
alter function public.create_bid(text,text) owner to postgres;
alter function public.update_bid(uuid,text,text,uuid,text,date) owner to postgres;
revoke all on function public.list_bid_owners() from public,anon;
revoke all on function public.list_bids() from public,anon;
revoke all on function public.list_bid_activity(uuid) from public,anon;
revoke all on function public.create_bid(text,text) from public,anon;
revoke all on function public.update_bid(uuid,text,text,uuid,text,date) from public,anon;
grant execute on function public.list_bid_owners() to authenticated,service_role;
grant execute on function public.list_bids() to authenticated,service_role;
grant execute on function public.list_bid_activity(uuid) to authenticated,service_role;
grant execute on function public.create_bid(text,text) to authenticated,service_role;
grant execute on function public.update_bid(uuid,text,text,uuid,text,date) to authenticated,service_role;

comment on table public.bids is 'Canonical Pre-Production commercial pursuits. A Bid never implies or creates a Production Job.';
comment on table public.bid_activity is 'Append-only lifecycle evidence for canonical Bids; details retain prior and resulting business facts.';
comment on column public.bids.deposit_received_date is 'Actual business date the deposit was received, distinct from activity occurred_at recording time.';
commit;
