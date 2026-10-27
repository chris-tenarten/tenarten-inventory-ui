-- Keep the established converter intact behind its new provenance wrapper.
begin;
create table public.job_bid_scope_handoffs (
 job_id uuid primary key references public.jobs(id) on delete restrict,
 bid_id uuid not null unique references public.bids(id) on delete restrict,
 scope_id uuid references public.bid_scope_captures(id) on delete restrict,
 captured_at timestamptz not null default clock_timestamp(),
 captured_by uuid not null references public.app_users(user_id),
 outstanding jsonb not null
);
alter table public.job_bid_scope_handoffs enable row level security;
revoke all on public.job_bid_scope_handoffs from public,anon,authenticated;
grant select on public.job_bid_scope_handoffs to authenticated;
grant all on public.job_bid_scope_handoffs to service_role;
create policy job_bid_scope_handoff_read on public.job_bid_scope_handoffs for select to authenticated using(public.has_app_capability('readOperationalData') and public.has_proposal_access());
create trigger job_bid_scope_handoff_immutable before update or delete on public.job_bid_scope_handoffs for each row execute function public.intake_capture_immutable();
alter function public.convert_bid_to_production(uuid,timestamptz,text,date,date,text) rename to convert_bid_to_production_before_scope;
revoke all on function public.convert_bid_to_production_before_scope(uuid,timestamptz,text,date,date,text) from public,anon,authenticated,service_role;
create function public.convert_bid_to_production(p_bid_id uuid,p_expected_updated_at timestamptz,p_window_choice text,p_start date default null,p_end date default null,p_job_number text default null)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare job uuid; latest public.bid_scope_captures; prior_job uuid;
begin
 perform public.require_app_capability('accessIntake');perform public.require_app_capability('createProductionJob');
 select production_job_id into prior_job from public.bids where id=p_bid_id for update;
 -- Existing converted Jobs are never retroactively attached to a new acceptance.
 job:=public.convert_bid_to_production_before_scope(p_bid_id,p_expected_updated_at,p_window_choice,p_start,p_end,p_job_number);
 if prior_job is null then
  select * into latest from public.bid_scope_captures where bid_id=p_bid_id order by revision desc limit 1;
  insert into public.job_bid_scope_handoffs(job_id,bid_id,scope_id,captured_by,outstanding)
  values(job,p_bid_id,latest.id,auth.uid(),case when latest.id is null then '["Accepted scope has not been captured."]'::jsonb else latest.unresolved end);
 end if;
 return job;
end $$;
revoke all on function public.convert_bid_to_production(uuid,timestamptz,text,date,date,text) from public,anon;
grant execute on function public.convert_bid_to_production(uuid,timestamptz,text,date,date,text) to authenticated,service_role;
commit;
