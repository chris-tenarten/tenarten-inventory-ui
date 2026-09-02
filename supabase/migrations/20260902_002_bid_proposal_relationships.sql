-- Contextual Bid gateway for canonical Proposal lineages.
-- Relationship metadata is nonfinancial and remains visible only to Proposal-authorized operational users.
begin;

create table public.bid_proposal_relationships (
  bid_id uuid not null references public.bids(id) on delete cascade,
  proposal_id uuid not null unique references public.proposals(id) on delete cascade,
  linked_by_user_id uuid not null references public.app_users(user_id),
  linked_at timestamptz not null default clock_timestamp(),
  primary key (bid_id,proposal_id)
);

create index bid_proposal_relationships_bid_linked_idx
  on public.bid_proposal_relationships(bid_id,linked_at desc,proposal_id);

alter table public.bid_proposal_relationships enable row level security;
create policy bid_proposal_relationships_authorized_all
  on public.bid_proposal_relationships for all to authenticated
  using (public.has_proposal_access() and public.has_app_capability('readOperationalData'))
  with check (public.has_proposal_access() and public.has_app_capability('readOperationalData'));

revoke all on public.bid_proposal_relationships from public,anon,authenticated;
grant select on public.bid_proposal_relationships to authenticated;
grant all on public.bid_proposal_relationships to service_role;

create function public.inherit_bid_proposal_relationship()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if new.prior_proposal_id is not null then
    insert into public.bid_proposal_relationships(bid_id,proposal_id,linked_by_user_id)
    select relationship.bid_id,new.id,new.created_by_user_id
    from public.bid_proposal_relationships relationship
    where relationship.proposal_id=new.prior_proposal_id
    on conflict(proposal_id) do nothing;
  end if;
  return new;
end $$;
create trigger proposals_inherit_bid_relationship
after insert on public.proposals for each row execute function public.inherit_bid_proposal_relationship();

create function public.create_bid_proposal(p_bid_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  target_bid public.bids%rowtype;
  created_id uuid;
begin
  if not public.has_proposal_access() then
    raise exception 'TenOps Proposal access denied.' using errcode='42501';
  end if;
  perform public.require_app_capability('readOperationalData');
  select * into strict target_bid from public.bids where id=p_bid_id;
  created_id:=public.create_proposal();
  update public.proposals
     set customer_name=target_bid.customer,
         project_name=target_bid.project_name
   where id=created_id and status='draft';
  insert into public.bid_proposal_relationships(bid_id,proposal_id,linked_by_user_id)
  values(p_bid_id,created_id,auth.uid());
  return created_id;
end $$;

create function public.link_proposal_to_bid(p_bid_id uuid,p_proposal_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  target public.proposals%rowtype;
begin
  if not public.has_proposal_access() then
    raise exception 'TenOps Proposal access denied.' using errcode='42501';
  end if;
  perform public.require_app_capability('readOperationalData');
  perform 1 from public.bids where id=p_bid_id;
  if not found then raise exception 'Bid not found.' using errcode='P0002'; end if;
  select * into strict target from public.proposals where id=p_proposal_id;
  if target.job_id is not null then
    raise exception 'Only a standalone Proposal can be linked to a Bid.' using errcode='22023';
  end if;
  if exists(select 1 from public.bid_proposal_relationships where proposal_id=p_proposal_id) then
    raise exception 'This Proposal is already linked to a Bid.' using errcode='23505';
  end if;
  insert into public.bid_proposal_relationships(bid_id,proposal_id,linked_by_user_id)
  values(p_bid_id,p_proposal_id,auth.uid());
end $$;

alter function public.create_bid_proposal(uuid) owner to postgres;
alter function public.link_proposal_to_bid(uuid,uuid) owner to postgres;
revoke all on function public.create_bid_proposal(uuid),public.link_proposal_to_bid(uuid,uuid) from public,anon;
grant execute on function public.create_bid_proposal(uuid),public.link_proposal_to_bid(uuid,uuid) to authenticated,service_role;

create function public.link_sample_to_bid(p_bid_id uuid,p_sample_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare current_bid_id uuid;
begin
  perform public.require_app_capability('readOperationalData');
  perform 1 from public.bids where id=p_bid_id;
  if not found then raise exception 'Bid not found.' using errcode='P0002'; end if;
  select bid_id into current_bid_id from public.samples where id=p_sample_id for update;
  if not found then raise exception 'Sample not found.' using errcode='P0002'; end if;
  if current_bid_id is not null and current_bid_id<>p_bid_id then
    raise exception 'This Sample is already linked to another Bid.' using errcode='23505';
  end if;
  update public.samples set bid_id=p_bid_id where id=p_sample_id and bid_id is null;
end $$;

alter function public.link_sample_to_bid(uuid,uuid) owner to postgres;
revoke all on function public.link_sample_to_bid(uuid,uuid) from public,anon;
grant execute on function public.link_sample_to_bid(uuid,uuid) to authenticated,service_role;

comment on table public.bid_proposal_relationships is
  'Current relational Bid context for canonical Proposal records; issued Proposal snapshots remain unchanged.';

commit;
