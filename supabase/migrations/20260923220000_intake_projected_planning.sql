-- Local implementation only. Apply through a separately authorized hosted gate.
begin;

alter table public.bids
  add column projected_production_start date,
  add column projected_production_end date,
  add column projected_window_updated_by uuid references public.app_users(user_id),
  add column projected_window_updated_at timestamptz,
  add column production_job_id uuid unique references public.jobs(id) on delete restrict,
  add column converted_by_user_id uuid references public.app_users(user_id),
  add column converted_at timestamptz,
  add constraint bids_projected_window_valid check (
    (projected_production_start is null and projected_production_end is null)
    or (projected_production_start is not null and projected_production_end is not null
        and projected_production_start <= projected_production_end)
  );
create index bids_projected_window_idx on public.bids(projected_production_start,projected_production_end)
  where production_job_id is null and status <> 'lost';

-- Reuse the existing history types and add only two events, retaining any installed extensions.
do $block$
declare old_expression text;
begin
  select pg_get_expr(conbin,conrelid) into strict old_expression from pg_constraint
    where conrelid='public.bid_activity'::regclass and conname='bid_activity_activity_type_check';
  alter table public.bid_activity drop constraint bid_activity_activity_type_check;
  execute 'alter table public.bid_activity add constraint bid_activity_activity_type_check check (('
    ||old_expression||') or activity_type in (''projected_window_changed'',''converted_to_job''))';
end $block$;

create function public.set_bid_projected_window(
  p_bid_id uuid, p_start date, p_end date, p_expected_updated_at timestamptz
) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare b public.bids%rowtype; actor uuid := auth.uid();
begin
  perform public.require_app_capability('accessIntake');
  select * into strict b from public.bids where id=p_bid_id for update;
  if b.production_job_id is not null then raise exception 'Production scheduling is authoritative for this converted Bid.' using errcode='22023'; end if;
  if b.updated_at is distinct from p_expected_updated_at then raise exception 'This Bid changed. Refresh before changing its projected window.' using errcode='40001'; end if;
  if (p_start is null) <> (p_end is null) or p_end < p_start then raise exception 'Set both projected dates, with start on or before end, or clear both.' using errcode='22023'; end if;
  if row(b.projected_production_start,b.projected_production_end) is not distinct from row(p_start,p_end) then return; end if;
  update public.bids set projected_production_start=p_start,projected_production_end=p_end,
    projected_window_updated_by=actor,projected_window_updated_at=clock_timestamp() where id=p_bid_id;
  insert into public.bid_activity(bid_id,activity_type,actor_user_id,details) values(p_bid_id,'projected_window_changed',actor,
    jsonb_build_object('from_start',b.projected_production_start,'from_end',b.projected_production_end,'to_start',p_start,'to_end',p_end));
end $$;

create function public.convert_bid_to_production(
  p_bid_id uuid, p_expected_updated_at timestamptz, p_window_choice text,
  p_start date default null, p_end date default null, p_job_number text default null
) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare b public.bids%rowtype; actor public.app_users%rowtype; j public.jobs%rowtype;
  next_start date; next_end date;
begin
  perform public.require_app_capability('accessIntake');
  perform public.require_app_capability('createProductionJob');
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  select * into strict b from public.bids where id=p_bid_id for update;
  -- Serializing on the Bid makes retry after an uncertain response return the same Job.
  if b.production_job_id is not null then return b.production_job_id; end if;
  if b.updated_at is distinct from p_expected_updated_at then raise exception 'This Bid changed. Refresh before converting it.' using errcode='40001'; end if;
  if exists(select 1 from public.bid_file_relationships where bid_id=b.id and relationship_state='removal_pending') then raise exception 'Finish or cancel Bid file cleanup before conversion.' using errcode='55000'; end if;
  if b.status <> 'won' or b.deposit_received_date is null then raise exception 'Conversion requires Won and a recorded Deposit Received Date.' using errcode='22023'; end if;
  if p_window_choice='carry' then
    next_start:=b.projected_production_start; next_end:=b.projected_production_end;
    if next_start is null then raise exception 'No projected window is available to carry forward.' using errcode='22023'; end if;
  elsif p_window_choice='new' then
    next_start:=p_start; next_end:=p_end;
    if next_start is null or next_end is null then raise exception 'Both new Production dates are required.' using errcode='22023'; end if;
  elsif p_window_choice='unscheduled' then
    if p_start is not null or p_end is not null then raise exception 'Unscheduled conversion cannot include Production dates.' using errcode='22023'; end if;
  else raise exception 'Choose Carry Forward, Set New Dates, or Plan in Production Later.' using errcode='22023'; end if;
  if next_end < next_start then raise exception 'Production end must not precede start.' using errcode='22023'; end if;
  if next_start is not null then perform public.require_app_capability('scheduleProduction'); end if;

  -- No number allocation, fake Job identity, document rewriting or implicit phase creation.
  insert into public.jobs(name,customer,job_number,deposit_date)
    values(b.project_name,b.customer,nullif(btrim(p_job_number),''),b.deposit_received_date) returning * into j;
  insert into public.job_activity(job_id,event_type,summary,actor_name,metadata)
    values(j.id,'job_created','Job created from Intake Bid',actor.display_name,jsonb_build_object('source_bid_id',b.id));
  if next_start is not null then
    perform public.save_production_schedule_batch(jsonb_build_array(jsonb_build_object(
      'job_id',j.id,'original_planned_start',null,'original_planned_end',null,'original_updated_at',j.updated_at,
      'proposed_planned_start',next_start,'proposed_planned_end',next_end,'change_source','production_inspector'
    )),actor.display_name,'Initial schedule explicitly confirmed during Intake conversion',gen_random_uuid());
  end if;
  update public.bids set production_job_id=j.id,converted_by_user_id=actor.user_id,converted_at=clock_timestamp() where id=b.id;
  insert into public.bid_activity(bid_id,activity_type,actor_user_id,details) values(b.id,'converted_to_job',actor.user_id,
    jsonb_build_object('job_id',j.id,'window_choice',p_window_choice,'projected_start',b.projected_production_start,
      'projected_end',b.projected_production_end,'production_start',next_start,'production_end',next_end));
  return j.id;
end $$;

-- A converted Bid is durable source provenance; existing cleanup must not detach it.
create function public.protect_converted_bid_source()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  if old.production_job_id is not null then raise exception 'A converted Bid is the source of a Production Job and cannot be deleted.' using errcode='23503'; end if;
  return old;
end $$;
create trigger bids_protect_converted_source before delete on public.bids
  for each row execute function public.protect_converted_bid_source();

alter function public.set_bid_projected_window(uuid,date,date,timestamptz) owner to postgres;
alter function public.convert_bid_to_production(uuid,timestamptz,text,date,date,text) owner to postgres;
revoke all on function public.set_bid_projected_window(uuid,date,date,timestamptz) from public,anon;
revoke all on function public.convert_bid_to_production(uuid,timestamptz,text,date,date,text) from public,anon;
grant execute on function public.set_bid_projected_window(uuid,date,date,timestamptz) to authenticated,service_role;
grant execute on function public.convert_bid_to_production(uuid,timestamptz,text,date,date,text) to authenticated,service_role;

-- Preserve installed cleanup logic, but reject converted sources before any Storage removal.
alter function public.prepare_admin_delete_bid(uuid) rename to intake_base_prepare_admin_delete_bid;
revoke all on function public.intake_base_prepare_admin_delete_bid(uuid) from public,anon,authenticated,service_role;
create function public.prepare_admin_delete_bid(p_bid_id uuid)
returns table(storage_path text) language plpgsql security definer set search_path=pg_catalog,public as $$
declare linked_job uuid;
begin
  perform public.require_app_capability('manageUsers');
  select production_job_id into linked_job from public.bids where id=p_bid_id for update;
  if linked_job is not null then raise exception 'A converted Bid cannot be deleted.' using errcode='23503'; end if;
  return query select * from public.intake_base_prepare_admin_delete_bid(p_bid_id);
end $$;
alter function public.production_job_delete_blockers(uuid) rename to intake_base_production_job_delete_blockers;
revoke all on function public.intake_base_production_job_delete_blockers(uuid) from public,anon,authenticated,service_role;
create function public.production_job_delete_blockers(p_job_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare blockers jsonb;
begin
  blockers:=public.intake_base_production_job_delete_blockers(p_job_id);
  if exists(select 1 from public.bids where production_job_id=p_job_id) then blockers:=blockers||'"Source Intake Bid exists"'::jsonb; end if;
  return blockers;
end $$;
alter function public.prepare_admin_delete_bid(uuid) owner to postgres;
alter function public.production_job_delete_blockers(uuid) owner to postgres;
revoke all on function public.prepare_admin_delete_bid(uuid),public.production_job_delete_blockers(uuid) from public,anon,authenticated;
grant execute on function public.prepare_admin_delete_bid(uuid) to authenticated,service_role;
grant execute on function public.production_job_delete_blockers(uuid) to service_role;

-- Requires the preceding Intake early-access boundary; other capabilities remain unchanged.
comment on column public.bids.projected_production_start is 'Tentative Intake planning only; does not reserve Production capacity.';
comment on column public.bids.production_job_id is 'One canonical Production Job per converted Bid; Production owns scheduling after conversion.';
commit;
