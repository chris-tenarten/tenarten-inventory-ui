-- Optional Sample identity for standalone Draft Library recognition.
-- Forward-only. 20260917_001 is already applied and remains immutable.
begin;

alter table public.samples
  add column sample_name text not null default '' check(length(sample_name)<=200);

alter table public.sample_formulation_defaults
  add column finished_plate_width numeric(12,4) not null default 6 check(finished_plate_width>0),
  add column finished_plate_length numeric(12,4) not null default 6 check(finished_plate_length>0),
  add column finished_plate_quantity integer not null default 4 check(finished_plate_quantity>0),
  add column thickness_in numeric(12,4) not null default .375 check(thickness_in>0),
  add column pour_width numeric(12,4) not null default 12 check(pour_width>0),
  add column pour_length numeric(12,4) not null default 12 check(pour_length>0),
  add column dimension_unit text not null default 'in' check(dimension_unit in('in','ft')),
  add column material_density numeric(12,4) not null default 128 check(material_density>0),
  add column supplier_ratio_defaults jsonb not null default '{"mtt":"5:1","key":"5:1","key resin co.":"5:1","terroxy":"5:1","sherwin":"4:1","sherwin williams":"4:1","sherwin-williams":"4:1"}'::jsonb check(jsonb_typeof(supplier_ratio_defaults)='object');

create or replace function public.normalize_sample_formulation(p_state jsonb)
returns jsonb language plpgsql stable set search_path=pg_catalog,public as $$
declare basis text:=coalesce(nullif(p_state->>'basis',''),'total_weight'); unit text:=coalesce(nullif(p_state->>'dimensionUnit',''),'in'); rate_provenance text:=coalesce(nullif(p_state->>'weightPerSfProvenance',''),'calculated'); ratio_provenance text:=coalesce(nullif(p_state->>'ratioProvenance',''),'default');
  total_weight numeric:=public.sample_nonnegative_numeric(p_state->>'totalWeight'); length_value numeric:=public.sample_nonnegative_numeric(p_state->>'length'); width_value numeric:=public.sample_nonnegative_numeric(p_state->>'width'); finished_width numeric:=public.sample_nonnegative_numeric(p_state->>'finishedPlateWidth'); finished_length numeric:=public.sample_nonnegative_numeric(p_state->>'finishedPlateLength'); finished_quantity numeric:=public.sample_nonnegative_numeric(p_state->>'finishedPlateQuantity'); density numeric:=public.sample_nonnegative_numeric(p_state->>'materialDensity'); thickness numeric:=public.sample_nonnegative_numeric(p_state->>'thicknessIn'); authored_rate numeric:=public.sample_nonnegative_numeric(p_state->>'weightPerSf');
  resin_parts numeric:=public.sample_nonnegative_numeric(p_state->>'resinParts'); hardener_parts numeric:=public.sample_nonnegative_numeric(p_state->>'hardenerParts'); area_sf numeric; finished_area_sf numeric; production_volume_cft numeric; calculated_rate numeric; effective_rate numeric; target_weight numeric; supplier_defaults jsonb:=coalesce(p_state->'supplierRatioDefaults','{}'::jsonb);
begin
  if basis not in('total_weight','weight_per_sf') then raise exception 'Invalid Sample formulation basis.' using errcode='22023'; end if;
  if unit not in('in','ft') then raise exception 'Invalid Sample dimension unit.' using errcode='22023'; end if;
  if rate_provenance not in('calculated','manual') or ratio_provenance not in('default','manual') then raise exception 'Invalid Sample formulation provenance.' using errcode='22023'; end if;
  if jsonb_typeof(supplier_defaults)<>'object' then raise exception 'Invalid Sample supplier ratio defaults.' using errcode='22023'; end if;
  if resin_parts is null or resin_parts<=0 or hardener_parts is null or hardener_parts<=0 or resin_parts not in(4,5) or hardener_parts<>1 then raise exception 'Resin : Hardener ratio must be 5:1 or 4:1.' using errcode='22023'; end if;
  if length_value is not null and width_value is not null then area_sf:=length_value*width_value*(case when unit='in' then 1::numeric/144 else 1 end); end if;
  if finished_width is not null and finished_length is not null and finished_quantity is not null then finished_area_sf:=finished_width*finished_length*finished_quantity/144; end if;
  if area_sf is not null and thickness is not null then production_volume_cft:=area_sf*thickness/12; end if;
  if density is not null and thickness is not null then calculated_rate:=density*thickness/12; end if;
  effective_rate:=case when rate_provenance='manual' then authored_rate else calculated_rate end;
  target_weight:=case when basis='total_weight' then total_weight when area_sf is not null and effective_rate is not null then area_sf*effective_rate end;
  return jsonb_build_object(
    'basis',basis,'weightUnit','lb','totalWeight',coalesce(p_state->>'totalWeight',''),
    'finishedPlateWidth',coalesce(p_state->>'finishedPlateWidth',''),'finishedPlateLength',coalesce(p_state->>'finishedPlateLength',''),'finishedPlateQuantity',coalesce(p_state->>'finishedPlateQuantity',''),'thicknessIn',coalesce(p_state->>'thicknessIn',''),
    'length',coalesce(p_state->>'length',''),'width',coalesce(p_state->>'width',''),'dimensionUnit',unit,'materialDensity',coalesce(p_state->>'materialDensity',''),'weightPerSf',coalesce(p_state->>'weightPerSf',''),'weightPerSfProvenance',rate_provenance,
    'resinParts',trim(trailing '.' from trim(trailing '0' from resin_parts::text)),'hardenerParts',trim(trailing '.' from trim(trailing '0' from hardener_parts::text)),'ratioProvenance',ratio_provenance,'ratioDefaultSource',coalesce(p_state->>'ratioDefaultSource','General'),'supplierRatioDefaults',supplier_defaults,
    'defaultVersion',case when coalesce(p_state->>'defaultVersion','')~'^[0-9]+$' then (p_state->>'defaultVersion')::integer end,'calculationVersion','sample-formulation-v1',
    'derived',jsonb_build_object('finishedAreaSf',finished_area_sf,'areaSf',area_sf,'productionVolumeCft',production_volume_cft,'calculatedWeightPerSf',calculated_rate,'effectiveWeightPerSf',effective_rate,'targetWeight',target_weight,'targetWeightOz',target_weight*16));
end $$;

create or replace function public.get_sample_formulation_default()
returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
  select jsonb_build_object('version',version,'finishedPlateWidth',finished_plate_width::text,'finishedPlateLength',finished_plate_length::text,'finishedPlateQuantity',finished_plate_quantity::text,'thicknessIn',thickness_in::text,'pourWidth',pour_width::text,'pourLength',pour_length::text,'dimensionUnit',dimension_unit,'materialDensity',material_density::text,'resinParts',resin_parts::text,'hardenerParts',hardener_parts::text,'supplierRatioDefaults',supplier_ratio_defaults) from public.sample_formulation_defaults where public.has_app_capability('readOperationalData') order by version desc limit 1
$$;

create function public.set_sample_formulation_default(p_defaults jsonb,p_supplier_name text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_users%rowtype; prior public.sample_formulation_defaults%rowtype; created public.sample_formulation_defaults%rowtype; supplier_defaults jsonb; supplier_key text:=lower(regexp_replace(btrim(coalesce(p_supplier_name,'')),'\s+',' ','g')); ratio text:=concat(p_defaults->>'resinParts',':',p_defaults->>'hardenerParts');
begin
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active and role in('admin','developer');
  select * into strict prior from public.sample_formulation_defaults order by version desc limit 1;
  if ratio not in('5:1','4:1') then raise exception 'Supported Sample ratios are 5:1 and 4:1.' using errcode='22023'; end if;
  supplier_defaults:=prior.supplier_ratio_defaults||coalesce(p_defaults->'supplierRatioDefaults','{}'::jsonb);
  if supplier_key<>'' then supplier_defaults:=jsonb_set(supplier_defaults,array[supplier_key],to_jsonb(ratio),true); end if;
  insert into public.sample_formulation_defaults(resin_parts,hardener_parts,finished_plate_width,finished_plate_length,finished_plate_quantity,thickness_in,pour_width,pour_length,dimension_unit,material_density,supplier_ratio_defaults,created_by_user_id)
  values((p_defaults->>'resinParts')::numeric,(p_defaults->>'hardenerParts')::numeric,coalesce(nullif(p_defaults->>'finishedPlateWidth','')::numeric,prior.finished_plate_width),coalesce(nullif(p_defaults->>'finishedPlateLength','')::numeric,prior.finished_plate_length),coalesce(nullif(p_defaults->>'finishedPlateQuantity','')::integer,prior.finished_plate_quantity),coalesce(nullif(p_defaults->>'thicknessIn','')::numeric,prior.thickness_in),coalesce(nullif(p_defaults->>'pourWidth','')::numeric,prior.pour_width),coalesce(nullif(p_defaults->>'pourLength','')::numeric,prior.pour_length),coalesce(nullif(p_defaults->>'dimensionUnit',''),prior.dimension_unit),coalesce(nullif(p_defaults->>'materialDensity','')::numeric,prior.material_density),supplier_defaults,actor.user_id) returning * into created;
  return jsonb_build_object('version',created.version);
exception when no_data_found then raise exception 'Sample formulation default management requires an active Admin or Developer.' using errcode='42501';
end $$;

create or replace function public.create_sample(p_bid_id uuid default null,p_job_id uuid default null)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_users%rowtype; created_id uuid:=gen_random_uuid(); linked_bid public.bids%rowtype; linked_job public.jobs%rowtype; defaults public.sample_formulation_defaults%rowtype;
begin
  perform public.require_app_capability('readOperationalData'); select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  if p_bid_id is not null then select * into strict linked_bid from public.bids where id=p_bid_id; end if; if p_job_id is not null then select * into strict linked_job from public.jobs where id=p_job_id; end if;
  select * into strict defaults from public.sample_formulation_defaults order by version desc limit 1;
  insert into public.samples(id,bid_id,job_id,requested_by,project_name,prepared_by,customer_name,formulation_state,created_by_user_id) values(created_id,p_bid_id,p_job_id,'',coalesce(linked_bid.project_name,linked_job.name,''),actor.display_name,coalesce(linked_bid.customer,linked_job.customer,''),public.normalize_sample_formulation(jsonb_build_object('basis','weight_per_sf','weightUnit','lb','finishedPlateWidth',defaults.finished_plate_width,'finishedPlateLength',defaults.finished_plate_length,'finishedPlateQuantity',defaults.finished_plate_quantity,'thicknessIn',defaults.thickness_in,'length',defaults.pour_length,'width',defaults.pour_width,'dimensionUnit',defaults.dimension_unit,'materialDensity',defaults.material_density,'weightPerSfProvenance','calculated','resinParts',defaults.resin_parts,'hardenerParts',defaults.hardener_parts,'ratioProvenance','default','ratioDefaultSource','General','supplierRatioDefaults',defaults.supplier_ratio_defaults,'defaultVersion',defaults.version)),actor.user_id);
  insert into public.sample_blend_rows(sample_id,display_order) values(created_id,0); return created_id;
end $$;

create function public.save_sample_draft(p_sample jsonb,p_rows jsonb,p_sample_name text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare target_id uuid:=(p_sample->>'id')::uuid; normalized_rows jsonb;
begin
  select coalesce(jsonb_agg(case when coalesce(row_data->>'component_role','aggregate')='aggregate' then row_data else row_data-'calculation_basis' end order by ordinality),'[]'::jsonb) into normalized_rows from jsonb_array_elements(p_rows) with ordinality as rows(row_data,ordinality);
  perform public.save_sample_draft(p_sample,normalized_rows);
  update public.samples set sample_name=left(btrim(coalesce(p_sample_name,'')),200) where id=target_id;
end $$;

create function public.duplicate_sample(p_sample_id uuid,p_preserve_sample_name boolean)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare created_id uuid;
begin
  created_id:=public.duplicate_sample(p_sample_id);
  if p_preserve_sample_name then
    update public.samples created set sample_name=source.sample_name from public.samples source where created.id=created_id and source.id=p_sample_id;
  end if;
  return created_id;
end $$;

create or replace function public.issue_sample_form(p_sample_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_users%rowtype; target public.samples%rowtype; issued_id uuid:=gen_random_uuid(); next_issue integer; snapshot jsonb; aggregate_total numeric;
begin
  perform public.require_app_capability('readOperationalData'); select * into strict actor from public.app_users where user_id=auth.uid() and is_active; select * into strict target from public.samples where id=p_sample_id for update;
  if btrim(target.prepared_by)='' then raise exception 'Prepared By is required to issue a Sample Form.' using errcode='22023'; end if;
  if exists(select 1 from public.sample_blend_rows where sample_id=p_sample_id and component_role='aggregate' and calculation_basis='target_total') then
    select coalesce(sum(percentage),0) into aggregate_total from public.sample_blend_rows where sample_id=p_sample_id and component_role='aggregate' and calculation_basis='target_total';
    if abs(aggregate_total-100)>.0005 then raise exception 'Participating Aggregate formulation rows must total 100%%; current total is %.',aggregate_total using errcode='22023'; end if;
  end if;
  select coalesce(max(issue_number),0)+1 into next_issue from public.sample_issued_documents where sample_id=p_sample_id;
  snapshot:=to_jsonb(target)||jsonb_build_object('job_number',(select job_number from public.jobs where id=target.job_id),'blend_rows',(select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.display_order),'[]'::jsonb) from public.sample_blend_rows row_data where row_data.sample_id=target.id),'issue_number',next_issue,'issued_at',clock_timestamp(),'issued_by_name',actor.display_name,'render_context','issued');
  insert into public.sample_issued_documents(id,sample_id,issue_number,issued_snapshot,issued_by_user_id,document_version) values(issued_id,p_sample_id,next_issue,snapshot,actor.user_id,'sample-work-order-pdf-v3-formulation'); return issued_id;
end $$;

alter function public.save_sample_draft(jsonb,jsonb,text) owner to postgres;
alter function public.duplicate_sample(uuid,boolean) owner to postgres;
alter function public.set_sample_formulation_default(jsonb,text) owner to postgres;
revoke all on function public.save_sample_draft(jsonb,jsonb,text),public.duplicate_sample(uuid,boolean),public.set_sample_formulation_default(jsonb,text) from public,anon;
grant execute on function public.save_sample_draft(jsonb,jsonb,text),public.duplicate_sample(uuid,boolean),public.set_sample_formulation_default(jsonb,text) to authenticated,service_role;

comment on column public.samples.sample_name is 'Optional user-authored Sample identity; absence does not invalidate standalone or contextual Samples.';

commit;
