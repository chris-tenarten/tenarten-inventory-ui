-- PP-001 follow-up: lightweight operational context and authored updates for canonical Bids.
-- This migration does not read from or write to public.jobs.
begin;

alter table public.bids
  add column contact_name text,
  add column contact_email text,
  add column contact_phone text,
  add column notes text,
  add constraint bids_contact_name_length check (contact_name is null or length(contact_name) <= 200),
  add constraint bids_contact_email_length check (contact_email is null or length(contact_email) <= 320),
  add constraint bids_contact_phone_length check (contact_phone is null or length(contact_phone) <= 80),
  add constraint bids_notes_length check (notes is null or length(notes) <= 10000);

comment on column public.bids.contact_name is 'Optional Bid-owned primary contact name; not a shared CRM contact.';
comment on column public.bids.contact_email is 'Optional Bid-owned primary contact email; not a shared CRM contact.';
comment on column public.bids.contact_phone is 'Optional Bid-owned primary contact phone; not a shared CRM contact.';
comment on column public.bids.notes is 'Editable current operational context for the Bid; historical touchpoints belong in bid_updates.';
alter table public.bid_activity drop constraint bid_activity_activity_type_check;
alter table public.bid_activity add constraint bid_activity_activity_type_check check (
  activity_type in (
    'created',
    'details_updated',
    'owner_changed',
    'status_changed',
    'deposit_received_changed',
    'contact_changed',
    'notes_changed'
  )
);

create table public.bid_updates (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references public.bids(id) on delete restrict,
  author_user_id uuid not null references public.app_users(user_id),
  body text not null check (btrim(body) <> '' and length(btrim(body)) <= 5000),
  created_at timestamptz not null default now()
);

create index bid_updates_bid_created_idx on public.bid_updates(bid_id,created_at desc,id desc);

alter table public.bid_updates enable row level security;
create policy bid_updates_operational_select on public.bid_updates for select to authenticated
using (public.has_app_capability('readOperationalData'));

revoke all on public.bid_updates from public,anon,authenticated;
grant select on public.bid_updates to authenticated;
grant all on public.bid_updates to service_role;

drop function public.list_bids();
create function public.list_bids()
returns table(
  id uuid,
  customer text,
  project_name text,
  creator_user_id uuid,
  creator_name text,
  owner_user_id uuid,
  owner_name text,
  status text,
  deposit_received_date date,
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql stable security definer set search_path=pg_catalog,public as $$
  select
    b.id,
    b.customer,
    b.project_name,
    b.creator_user_id,
    creator.display_name,
    b.owner_user_id,
    owner_user.display_name,
    b.status,
    b.deposit_received_date,
    b.contact_name,
    b.contact_email,
    b.contact_phone,
    b.notes,
    b.created_at,
    b.updated_at
  from public.bids b
  join public.app_users creator on creator.user_id=b.creator_user_id
  join public.app_users owner_user on owner_user.user_id=b.owner_user_id
  where public.has_app_capability('readOperationalData')
  order by b.updated_at desc,b.id
$$;

create function public.list_bid_updates(p_bid_id uuid)
returns table(id uuid,bid_id uuid,author_user_id uuid,author_name text,body text,created_at timestamptz)
language sql stable security definer set search_path=pg_catalog,public as $$
  select u.id,u.bid_id,u.author_user_id,a.display_name,u.body,u.created_at
  from public.bid_updates u
  join public.app_users a on a.user_id=u.author_user_id
  where public.has_app_capability('readOperationalData') and u.bid_id=p_bid_id
  order by u.created_at desc,u.id desc
$$;

drop function public.update_bid(uuid,text,text,uuid,text,date);
create function public.update_bid(
  p_bid_id uuid,
  p_customer text,
  p_project_name text,
  p_owner_user_id uuid,
  p_status text,
  p_deposit_received_date date,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_notes text
) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  actor public.app_users%rowtype;
  current_bid public.bids%rowtype;
  next_owner public.app_users%rowtype;
  recorded_at timestamptz:=clock_timestamp();
  next_contact_name text:=nullif(btrim(p_contact_name),'');
  next_contact_email text:=nullif(btrim(p_contact_email),'');
  next_contact_phone text:=nullif(btrim(p_contact_phone),'');
  next_notes text:=nullif(btrim(p_notes),'');
  changed_contact_fields text[]:=array[]::text[];
begin
  perform public.require_app_capability('readOperationalData');
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  select * into strict current_bid from public.bids where id=p_bid_id for update;
  if nullif(btrim(p_customer),'') is null then raise exception 'Customer is required.' using errcode='22023'; end if;
  if nullif(btrim(p_project_name),'') is null then raise exception 'Project Name is required.' using errcode='22023'; end if;
  if p_status not in ('active','won','lost') then raise exception 'Unsupported Bid status.' using errcode='22023'; end if;
  if length(next_contact_name)>200 then raise exception 'Contact Name is too long.' using errcode='22023'; end if;
  if length(next_contact_email)>320 then raise exception 'Contact Email is too long.' using errcode='22023'; end if;
  if length(next_contact_phone)>80 then raise exception 'Contact Phone is too long.' using errcode='22023'; end if;
  if length(next_notes)>10000 then raise exception 'Notes are too long.' using errcode='22023'; end if;
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
  if current_bid.contact_name is distinct from next_contact_name then changed_contact_fields:=array_append(changed_contact_fields,'name'); end if;
  if current_bid.contact_email is distinct from next_contact_email then changed_contact_fields:=array_append(changed_contact_fields,'email'); end if;
  if current_bid.contact_phone is distinct from next_contact_phone then changed_contact_fields:=array_append(changed_contact_fields,'phone'); end if;
  if cardinality(changed_contact_fields)>0 then
    insert into public.bid_activity(bid_id,activity_type,actor_user_id,occurred_at,details)
    values(p_bid_id,'contact_changed',actor.user_id,recorded_at,jsonb_build_object('fields',to_jsonb(changed_contact_fields)));
  end if;
  if current_bid.notes is distinct from next_notes then
    insert into public.bid_activity(bid_id,activity_type,actor_user_id,occurred_at,details)
    values(p_bid_id,'notes_changed',actor.user_id,recorded_at,jsonb_build_object('changed',true));
  end if;
  update public.bids set
    customer=btrim(p_customer),
    project_name=btrim(p_project_name),
    owner_user_id=next_owner.user_id,
    status=p_status,
    deposit_received_date=p_deposit_received_date,
    contact_name=next_contact_name,
    contact_email=next_contact_email,
    contact_phone=next_contact_phone,
    notes=next_notes
  where id=p_bid_id;
end $$;

create function public.create_bid_update(p_bid_id uuid,p_body text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_users%rowtype; created_id uuid:=gen_random_uuid(); normalized_body text:=btrim(p_body);
begin
  perform public.require_app_capability('readOperationalData');
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  perform 1 from public.bids where id=p_bid_id;
  if not found then raise exception 'Bid was not found.' using errcode='P0002'; end if;
  if normalized_body='' then raise exception 'Update is required.' using errcode='22023'; end if;
  if length(normalized_body)>5000 then raise exception 'Update is too long.' using errcode='22023'; end if;
  insert into public.bid_updates(id,bid_id,author_user_id,body)
  values(created_id,p_bid_id,actor.user_id,normalized_body);
  return created_id;
end $$;

alter function public.list_bids() owner to postgres;
alter function public.list_bid_updates(uuid) owner to postgres;
alter function public.update_bid(uuid,text,text,uuid,text,date,text,text,text,text) owner to postgres;
alter function public.create_bid_update(uuid,text) owner to postgres;
revoke all on function public.list_bids() from public,anon;
revoke all on function public.list_bid_updates(uuid) from public,anon;
revoke all on function public.update_bid(uuid,text,text,uuid,text,date,text,text,text,text) from public,anon;
revoke all on function public.create_bid_update(uuid,text) from public,anon;
grant execute on function public.list_bids() to authenticated,service_role;
grant execute on function public.list_bid_updates(uuid) to authenticated,service_role;
grant execute on function public.update_bid(uuid,text,text,uuid,text,date,text,text,text,text) to authenticated,service_role;
grant execute on function public.create_bid_update(uuid,text) to authenticated,service_role;

comment on table public.bid_updates is 'Append-only human-authored operational touchpoints for a Bid, distinct from structural bid_activity.';
commit;
