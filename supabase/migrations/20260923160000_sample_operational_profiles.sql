-- Managed vocabulary for future explicit profile selection. Historical profiles/snapshots untouched.
begin;
create table public.sample_operational_profiles (
 id uuid primary key default gen_random_uuid(),
 revision integer not null default 1 check(revision>0),
 name text not null check(length(btrim(name)) between 1 and 120),
 sort_order integer not null,
 is_active boolean not null default true,
 chip_density numeric(14,6) check(chip_density>0 and chip_density::text<>'NaN'),
 dry_pool_rate numeric(14,6) check(dry_pool_rate>0 and dry_pool_rate::text<>'NaN'),
 filler_rate numeric(14,6) check(filler_rate>=0 and filler_rate::text<>'NaN'),
 resin_rate numeric(14,6) check(resin_rate>0 and resin_rate::text<>'NaN'),
 resin_parts numeric(12,4), hardener_parts numeric(12,4),
 description text not null default '' check(length(description)<=2000),
 updated_at timestamptz not null default clock_timestamp(),
 updated_by uuid references public.app_users(user_id),
 constraint sample_operational_ratio check((resin_parts is null and hardener_parts is null) or (resin_parts is not null and hardener_parts is not null and resin_parts in(4,5) and hardener_parts=1)),
 constraint sample_operational_filler_pool check(filler_rate is null or dry_pool_rate is null or filler_rate<dry_pool_rate)
);
create unique index sample_operational_profiles_name on public.sample_operational_profiles(lower(btrim(name)));
alter table public.sample_operational_profiles enable row level security;
revoke all on public.sample_operational_profiles from public,anon,authenticated;
grant select on public.sample_operational_profiles to authenticated;
grant all on public.sample_operational_profiles to service_role;
create policy sample_operational_profiles_read on public.sample_operational_profiles for select to authenticated using(public.has_app_capability('readOperationalData'));

create function public.save_sample_operational_profile(p_id uuid,p_expected_revision integer,p_values jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid:=auth.uid(); current_profile public.sample_operational_profiles%rowtype; result uuid;
begin
 if not exists(select 1 from public.app_users where user_id=actor and is_active and role in('admin','developer')) then raise exception 'Profile management requires an active Admin or Developer.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('sample-operational-profiles',0));
 if jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Profile values are required.' using errcode='22023'; end if;
 if p_id is null then
  insert into public.sample_operational_profiles(name,sort_order,is_active,chip_density,dry_pool_rate,filler_rate,resin_rate,resin_parts,hardener_parts,description,updated_by)
  values(btrim(p_values->>'name'),coalesce((select max(sort_order) from public.sample_operational_profiles),0)+10,coalesce((p_values->>'is_active')::boolean,true),nullif(p_values->>'chip_density','')::numeric,nullif(p_values->>'dry_pool_rate','')::numeric,nullif(p_values->>'filler_rate','')::numeric,nullif(p_values->>'resin_rate','')::numeric,nullif(p_values->>'resin_parts','')::numeric,nullif(p_values->>'hardener_parts','')::numeric,coalesce(p_values->>'description',''),actor) returning id into result;
 else
  select * into strict current_profile from public.sample_operational_profiles where id=p_id for update;
  if current_profile.revision is distinct from p_expected_revision then raise exception 'Profile changed. Refresh before saving.' using errcode='40001'; end if;
  update public.sample_operational_profiles set name=btrim(p_values->>'name'),is_active=(p_values->>'is_active')::boolean,chip_density=nullif(p_values->>'chip_density','')::numeric,dry_pool_rate=nullif(p_values->>'dry_pool_rate','')::numeric,filler_rate=nullif(p_values->>'filler_rate','')::numeric,resin_rate=nullif(p_values->>'resin_rate','')::numeric,resin_parts=nullif(p_values->>'resin_parts','')::numeric,hardener_parts=nullif(p_values->>'hardener_parts','')::numeric,description=coalesce(p_values->>'description',''),revision=revision+1,updated_at=clock_timestamp(),updated_by=actor where id=p_id;
  result:=p_id;
 end if;
 return result;
end $$;
create function public.move_sample_operational_profile(p_id uuid,p_expected_revision integer,p_direction integer)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare current_profile public.sample_operational_profiles%rowtype; neighbor public.sample_operational_profiles%rowtype;
begin
 if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active and role in('admin','developer')) then raise exception 'Profile management requires an active Admin or Developer.' using errcode='42501'; end if;
 if p_direction is null or p_direction not in(-1,1) then raise exception 'Invalid direction.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('sample-operational-profiles',0));
 select * into strict current_profile from public.sample_operational_profiles where id=p_id for update;
 if current_profile.revision is distinct from p_expected_revision then raise exception 'Profile changed. Refresh before reordering.' using errcode='40001'; end if;
 select * into neighbor from public.sample_operational_profiles where (sort_order-current_profile.sort_order)*p_direction>0 order by (sort_order-current_profile.sort_order)*p_direction limit 1 for update;
 if not found then return; end if;
 update public.sample_operational_profiles set sort_order=case when id=p_id then neighbor.sort_order else current_profile.sort_order end,revision=revision+1,updated_at=clock_timestamp(),updated_by=auth.uid() where id in(p_id,neighbor.id);
end $$;
alter function public.save_sample_operational_profile(uuid,integer,jsonb) owner to postgres;
alter function public.move_sample_operational_profile(uuid,integer,integer) owner to postgres;
revoke all on function public.save_sample_operational_profile(uuid,integer,jsonb),public.move_sample_operational_profile(uuid,integer,integer) from public,anon;
grant execute on function public.save_sample_operational_profile(uuid,integer,jsonb),public.move_sample_operational_profile(uuid,integer,integer) to authenticated,service_role;
-- Chris approved ordinary MTT/Sherwin defaults; no inferred Key/Terroxy material rates or Cement ratio.
insert into public.sample_operational_profiles(name,sort_order,chip_density,dry_pool_rate,filler_rate,resin_rate,resin_parts,hardener_parts,description) values
 ('MTT',10,128,2560,512,480,5,1,'Initial operational defaults copied from existing ordinary MTT profile; not a product compatibility specification.'),
 ('Key Resin',20,null,null,null,null,5,1,'Operational ratio fallback only. Material rates require confirmation; no exact product compatibility inferred.'),
 ('Terroxy',30,null,null,null,null,5,1,'Operational ratio fallback only. Material rates require confirmation; no exact product compatibility inferred.'),
 ('Sherwin',40,128,2560,512,512,4,1,'Initial operational defaults copied from existing ordinary Sherwin profile. No Resuflor 3520 identity inferred.'),
 ('Cement',50,null,null,null,null,null,null,'Unconfigured binder system. Do not calculate until the required inputs and supported calculation contract are confirmed.');
commit;
