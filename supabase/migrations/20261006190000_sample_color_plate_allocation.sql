-- Prospective TenOps annual numbering. No historical rows are rewritten.
begin;
create table public.sample_color_plate_counters (
 allocation_year integer primary key check(allocation_year between 2000 and 9999),
 last_sequence bigint not null check(last_sequence>=900)
);
alter table public.sample_color_plate_counters enable row level security;
revoke all on public.sample_color_plate_counters from public,anon,authenticated;

-- Private read-only high-water lookup. Include captures so changing/deleting a live
-- identity does not allow an existing historical family to be assigned again.
create function public.sample_color_plate_next_sequence(p_year integer)
returns bigint language sql stable security definer set search_path=pg_catalog,public as $$
 with identities(value) as (
  select color_plate_number from public.samples
  union all select version_snapshot->>'color_plate_number' from public.sample_working_versions
  union all select issued_snapshot->>'color_plate_number' from public.sample_issued_documents
  union all select coalesce(source_snapshot->>'color_plate_number',source_snapshot->>'colorPlateNumber') from public.production_blend_plans
 ), matches as (
  select regexp_match(upper(btrim(value)), '^T'||right(p_year::text,2)||'-([0-9]{3,})-?[A-Z]$') as parts from identities
 )
 select (greatest(899::numeric,
   coalesce((select last_sequence from public.sample_color_plate_counters where allocation_year=p_year),899),
   coalesce((select max((parts[1])::numeric) from matches where parts is not null),899))+1)::bigint
$$;
revoke all on function public.sample_color_plate_next_sequence(integer) from public,anon,authenticated;

-- Serialize identity writes with automatic allocation, including older clients and
-- manual saves. This is not a uniqueness rule: deliberate manual duplicates remain
-- subject to the existing warning workflow. No counters are advanced by this trigger.
create function public.lock_sample_color_plate_identity()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
 perform pg_advisory_xact_lock(761006,1900);
 return new;
end $$;
revoke all on function public.lock_sample_color_plate_identity() from public,anon,authenticated;
create trigger sample_color_plate_identity_lock before insert or update of color_plate_number
 on public.samples for each row execute function public.lock_sample_color_plate_identity();

create function public.suggest_sample_color_plate_number()
returns text language plpgsql security definer set search_path=pg_catalog,public as $$
declare allocation_year integer:=extract(year from clock_timestamp() at time zone 'UTC');
begin
 perform public.require_app_capability('readOperationalData');
 return 'T'||right(allocation_year::text,2)||'-'||public.sample_color_plate_next_sequence(allocation_year)::text||'-A';
end $$;
revoke all on function public.suggest_sample_color_plate_number() from public,anon;
grant execute on function public.suggest_sample_color_plate_number() to authenticated;

-- Creation, allocation and the existing validated save are a single transaction.
-- A failed save rolls back both the new Sample and its counter increment.
create function public.create_sample_with_formulation(p_sample jsonb,p_rows jsonb,p_sample_name text,p_auto_number boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare created_id uuid; allocation_year integer; allocated_sequence bigint; plate text;
begin
 perform public.require_app_capability('readOperationalData');
 perform public.require_app_capability('writeBusinessData');
 if nullif(p_sample->>'id','') is not null then raise exception 'New Sample must not have an existing identity.' using errcode='22023'; end if;
 if p_auto_number is null then raise exception 'Choose automatic or manual numbering.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(761006,1900);
 if p_auto_number then
  allocation_year:=extract(year from clock_timestamp() at time zone 'UTC');
  allocated_sequence:=public.sample_color_plate_next_sequence(allocation_year);
  plate:='T'||right(allocation_year::text,2)||'-'||allocated_sequence::text||'-A';
  insert into public.sample_color_plate_counters values(allocation_year,allocated_sequence)
   on conflict on constraint sample_color_plate_counters_pkey do update set last_sequence=excluded.last_sequence;
  p_sample:=jsonb_set(p_sample,'{color_plate_number}',to_jsonb(plate));
 end if;
 created_id:=public.create_sample(nullif(p_sample->>'bid_id','')::uuid,nullif(p_sample->>'job_id','')::uuid);
 perform public.save_sample_draft(p_sample||jsonb_build_object('id',created_id),p_rows,p_sample_name);
 select color_plate_number into plate from public.samples where id=created_id;
 return jsonb_build_object('id',created_id,'color_plate_number',plate);
end $$;
revoke all on function public.create_sample_with_formulation(jsonb,jsonb,text,boolean) from public,anon;
grant execute on function public.create_sample_with_formulation(jsonb,jsonb,text,boolean) to authenticated;
commit;
