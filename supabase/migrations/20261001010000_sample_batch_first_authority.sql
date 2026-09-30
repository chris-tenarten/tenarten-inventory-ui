-- V5 Batch authority and independent shop preparation. Forward-only; no historical backfill.
begin;
alter table public.sample_operational_profiles add column batch_contract jsonb;
-- Seed only operational profile metadata, never captured Samples or issues.
update public.sample_operational_profiles set batch_contract=jsonb_build_object('version',1,'components',jsonb_build_object(
 'filler',jsonb_build_object('exact',null,'unit','lb','authority','unresolved','provenance','Exact Batch requirement not established','shopWorking',jsonb_build_object('quantity',case when name='MTT' then '18' else (filler_rate/32)::text end,'unit','oz','volumeCft','0.03125','rule',case when name='MTT' then 'at_volume' else 'historical_volume_rate' end,'provenance',case when name='MTT' then 'Anthony operational clarification: 18 oz at representative Working Pour' else 'Captured historical Sample profile; shop-only volume rate' end)),
 'resin',jsonb_build_object('exact',null,'unit','gal','authority','unresolved','provenance','Exact Batch charge versus shop Batch charge unresolved','shopWorking',jsonb_build_object('quantity',(resin_rate/32)::text,'unit','fl oz','volumeCft','0.03125','rule','historical_volume_rate','provenance','Historical shop Sample binder rate; not exact Batch projection')),
 'hardener',jsonb_build_object('exact',null,'unit','gal','authority','confirmed','rule','resin_ratio','provenance','Captured profile binder relationship; absolute charge depends on authoritative Part A')
)),revision=revision+1;
update public.sample_operational_profiles set batch_chip_target_lb=180,batch_reference_thickness_in=0.375,chip_density=128,
 batch_contract=jsonb_set(batch_contract,'{components,filler,shopBatch}','{"quantity":"50","unit":"lb","packageLabel":"one 50-lb bag","provenance":"Anthony confirmed operational shop Batch charge; canonical operational Batch baseline"}'::jsonb)
 where name='MTT';
update public.sample_operational_profiles set batch_contract=jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(batch_contract,
 '{components,filler,exact}','"50"'::jsonb),'{components,filler,authority}','"confirmed"'::jsonb),
 '{components,filler,provenance}','"Chris operational authority: common MTT canonical shop Batch filler 50 lb"'::jsonb),
 '{components,resin}','{"exact":"5","unit":"gal","authority":"confirmed","provenance":"Chris operational authority: common MTT canonical shop Batch Part A 5 US gal","shopWorking":{"quantity":"15","unit":"fl oz","volumeCft":"0.03125","rule":"at_volume","provenance":"Historical MTT representative shop instruction 15/3; not a universal rounding rule"}}'::jsonb),
 '{components,hardener,provenance}','"Common MTT canonical Batch Part B 1 US gal; preserved 5:1 relationship"'::jsonb)
 where name='MTT';


create function public.sample_batch_component(p_profile jsonb,p_role text,p_volume numeric,p_shop boolean default false)
returns numeric language plpgsql immutable set search_path=pg_catalog,public as $$
declare c jsonb:=p_profile#>array['batchContract','components',p_role]; instruction jsonb; q numeric; v numeric; target numeric; loading numeric;
begin
 if p_role='hardener' then return public.sample_batch_component(p_profile,'resin',p_volume,p_shop)/(p_profile->>'resinParts')::numeric; end if;
 if p_shop then
  instruction:=c->'shopWorking'; q:=nullif(instruction->>'quantity','')::numeric; v:=nullif(instruction->>'volumeCft','')::numeric;
  if q is not null and v>0 and p_volume is not null then
   if abs(v-p_volume)<0.000000001 then return q; end if;
   if instruction->>'rule'='historical_volume_rate' then return q*p_volume/v; end if;
  end if;
 end if;
 if c->>'authority'<>'confirmed' or nullif(c->>'provenance','') is null then return null; end if;
 q:=nullif(c->>'exact','')::numeric;
 if p_volume is null then return q; end if;
 target:=nullif(p_profile->>'batchChipTargetLb','')::numeric; loading:=nullif(p_profile->>'defaultChipDensityLbCft','')::numeric;
 if target>0 and loading>0 then return q*p_volume/(target/loading)*(case when p_role='filler' then 16 else 128 end); end if;
 return null;
end $$;

alter function public.save_sample_operational_profile(uuid,integer,jsonb) rename to save_sample_operational_profile_before_batch_first;
revoke all on function public.save_sample_operational_profile_before_batch_first(uuid,integer,jsonb) from public,anon,authenticated,service_role;
create function public.save_sample_operational_profile(p_id uuid,p_expected_revision integer,p_values jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid;
begin
 result:=public.save_sample_operational_profile_before_batch_first(p_id,p_expected_revision,p_values);
 if p_values ? 'batch_contract' then
  if p_values->'batch_contract' is null or p_values#>>'{batch_contract,version}' is distinct from '1' then raise exception 'Versioned Batch contract required.' using errcode='22023'; end if;
  update public.sample_operational_profiles set batch_contract=p_values->'batch_contract' where id=result;
 end if;
 return result;
end $$;
revoke all on function public.save_sample_operational_profile(uuid,integer,jsonb) from public,anon;
grant execute on function public.save_sample_operational_profile(uuid,integer,jsonb) to authenticated,service_role;

alter function public.normalize_sample_formulation(jsonb) rename to normalize_sample_formulation_before_batch_first;
revoke all on function public.normalize_sample_formulation_before_batch_first(jsonb) from public,anon,authenticated,service_role;
create function public.normalize_sample_formulation(p_state jsonb)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare p jsonb:=p_state->'profile'; c jsonb; role text; instruction jsonb; n numeric; area numeric; v numeric; density numeric; chips numeric; normalized jsonb; key text;
begin
 if p_state->>'calculationVersion' is distinct from 'sample-formulation-v5-batch-first' then return public.normalize_sample_formulation_before_batch_first(p_state); end if;
 if jsonb_typeof(p)<>'object' or coalesce(p->>'id','')='' or coalesce(p->>'version','')!~'^[1-9][0-9]*$' or p#>>'{batchContract,version}' is distinct from '1' then raise exception 'Captured Batch-first profile required.' using errcode='22023'; end if;
 density:=public.sample_nonnegative_numeric(p->>'defaultChipDensityLbCft');
 if density is null or density<=0 or public.sample_nonnegative_numeric(p->>'resinParts') not in(4,5) or public.sample_nonnegative_numeric(p->>'hardenerParts')<>1 then raise exception 'Invalid Batch loading or binder relationship.' using errcode='22023'; end if;
 if p_state->>'dimensionUnit' not in('in','ft') then raise exception 'Invalid Working dimensions.' using errcode='22023'; end if;
 foreach key in array array['batchChipTargetLb','batchReferenceThicknessIn'] loop
  if nullif(p->>key,'') is not null then n:=public.sample_nonnegative_numeric(p->>key); if n is null or n<=0 then raise exception 'Invalid Batch basis.' using errcode='22023'; end if; end if;
 end loop;
 foreach role in array array['filler','resin','hardener'] loop
  c:=p#>array['batchContract','components',role];
  if c is null or c->>'authority' not in('confirmed','unresolved') or c->>'unit' is distinct from (case when role='filler' then 'lb' else 'gal' end) then raise exception 'Invalid component authority/unit.' using errcode='22023'; end if;
  if c->>'authority'='unresolved' and nullif(c->>'exact','') is not null then raise exception 'Unresolved component cannot carry an exact Batch quantity.' using errcode='22023'; end if;
  if c->>'authority'='confirmed' and (nullif(c->>'provenance','') is null or (coalesce(c->>'rule','')<>'resin_ratio' and public.sample_nonnegative_numeric(c->>'exact') is null)) then raise exception 'Confirmed Batch quantity requires a value and provenance.' using errcode='22023'; end if;
  if c ? 'rule' and (role<>'hardener' or c->>'rule'<>'resin_ratio') then raise exception 'Unsupported Batch rule.' using errcode='22023'; end if;
  instruction:=c->'shopWorking';
  if instruction is not null then
   if public.sample_nonnegative_numeric(instruction->>'quantity') is null or coalesce(public.sample_nonnegative_numeric(instruction->>'volumeCft'),0)<=0 or instruction->>'rule' not in('at_volume','historical_volume_rate') or nullif(instruction->>'provenance','') is null or instruction->>'unit' is distinct from (case when role='filler' then 'oz' else 'fl oz' end) then raise exception 'Invalid captured shop instruction.' using errcode='22023'; end if;
  end if;
 end loop;
 area:=public.sample_nonnegative_numeric(p_state->>'length')*public.sample_nonnegative_numeric(p_state->>'width')/case when p_state->>'dimensionUnit'='in' then 144 else 1 end;
 v:=area*public.sample_nonnegative_numeric(p_state->>'thicknessIn')/12; chips:=v*density*16;
 normalized:=p_state||jsonb_build_object('basis','weight_per_sf','weightUnit','lb','totalWeight','','totalFormulaWeightOz','','materialDensity',density::text,'weightPerSf','','weightPerSfProvenance','calculated','chipDensityProvenance','profile_default','adjustment',null,'resinParts',p->>'resinParts','hardenerParts',p->>'hardenerParts','ratioProvenance','default');
 return normalized||jsonb_build_object('derived',jsonb_build_object('areaSf',area,'productionVolumeCft',v,'availableChipMixOz',chips,'targetWeightOz',chips,'targetWeight',chips/16,'geometryChipMixWeight',chips/16,'effectiveChipDensityLbCft',density,'calculatedWeightPerSf',density*public.sample_nonnegative_numeric(p_state->>'thicknessIn')/12,'effectiveWeightPerSf',density*public.sample_nonnegative_numeric(p_state->>'thicknessIn')/12,'defaultFillerOz',public.sample_batch_component(p,'filler',v,true),'defaultResinFlOz',public.sample_batch_component(p,'resin',v,true),'dryPoolOz',chips+public.sample_batch_component(p,'filler',v,false)));
end $$;
revoke all on function public.normalize_sample_formulation(jsonb) from public,anon,authenticated;
grant execute on function public.normalize_sample_formulation(jsonb) to service_role;

alter function public.save_sample_draft(jsonb,jsonb) rename to save_sample_draft_before_batch_first;
revoke all on function public.save_sample_draft_before_batch_first(jsonb,jsonb) from public,anon,authenticated,service_role;
create function public.save_sample_draft(p_sample jsonb,p_rows jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare target_id uuid:=(p_sample->>'id')::uuid; normalized jsonb:=public.normalize_sample_formulation(coalesce(p_sample->'formulation_state','{}'::jsonb)); color_plate text:=nullif(upper(btrim(coalesce(p_sample->>'color_plate_number',''))),''); chip_oz numeric; default_filler numeric; default_resin numeric; filler_effective numeric; resin_effective numeric; ratio numeric; dry_pool numeric; actual_dry numeric; volume_cft numeric; adjustment jsonb; prior_profile jsonb; current_profile public.sample_operational_profiles%rowtype;
begin
 if normalized->>'calculationVersion'<>'sample-formulation-v5-batch-first' then perform public.save_sample_draft_before_batch_first(p_sample,p_rows); return; end if;
 perform public.require_app_capability('readOperationalData'); perform 1 from public.app_users where user_id=auth.uid() and is_active; if not found then raise exception 'Active operational access is required.' using errcode='42501'; end if;
 if not exists(select 1 from public.samples where id=target_id for update) then raise exception 'Sample not found.' using errcode='P0002'; end if;
 select formulation_state->'profile' into prior_profile from public.samples where id=target_id;
 if prior_profile is distinct from normalized->'profile' then
  select * into current_profile from public.sample_operational_profiles where 'operational:'||id=normalized#>>'{profile,id}' and revision::text=normalized#>>'{profile,version}';
  if current_profile.id is null or current_profile.batch_contract is distinct from normalized#>'{profile,batchContract}'
   or current_profile.chip_density is distinct from (normalized#>>'{profile,defaultChipDensityLbCft}')::numeric
   or current_profile.batch_chip_target_lb is distinct from nullif(normalized#>>'{profile,batchChipTargetLb}','')::numeric
   or current_profile.batch_reference_thickness_in is distinct from nullif(normalized#>>'{profile,batchReferenceThicknessIn}','')::numeric
   or current_profile.resin_parts is distinct from (normalized#>>'{profile,resinParts}')::numeric
   or current_profile.hardener_parts is distinct from (normalized#>>'{profile,hardenerParts}')::numeric then
   raise exception 'Batch authority must match a captured or managed profile revision.' using errcode='22023';
  end if;
 end if;
 if color_plate is not null and color_plate !~ '^T[0-9]{2}-[0-9]{3}[A-Z]$' then raise exception 'New Color Plate numbers must use TYY-NNNL format, for example T26-123A.' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r where r->>'component_role' in('filler','resin','hardener') group by r->>'component_role' having count(*)>1) then raise exception 'Use one row per binder or filler component.' using errcode='22023'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>200 then raise exception 'Invalid Sample formulation rows.' using errcode='22023'; end if;
 if nullif(p_sample->>'bid_id','') is not null and not exists(select 1 from public.bids where id=(p_sample->>'bid_id')::uuid) then raise exception 'Bid not found.' using errcode='P0002'; end if;
 if nullif(p_sample->>'job_id','') is not null and not exists(select 1 from public.jobs where id=(p_sample->>'job_id')::uuid) then raise exception 'Production Job not found.' using errcode='P0002'; end if;
 update public.samples set bid_id=nullif(p_sample->>'bid_id','')::uuid,job_id=nullif(p_sample->>'job_id','')::uuid,requested_by=left(coalesce(p_sample->>'requested_by',''),200),requested_date=coalesce(nullif(p_sample->>'requested_date','')::date,current_date),project_name=left(coalesce(p_sample->>'project_name',''),300),prepared_by=left(coalesce(p_sample->>'prepared_by',''),200),customer_name=left(coalesce(p_sample->>'customer_name',''),200),color_plate_number=color_plate,finish_requested=left(coalesce(p_sample->>'finish_requested',''),300),sample_size=left(coalesce(p_sample->>'sample_size',''),100),sample_quantity=left(coalesce(p_sample->>'sample_quantity',''),100),notes=left(coalesce(p_sample->>'notes',''),20000),filler=left(coalesce(p_sample->>'filler',''),300),sealer=left(coalesce(p_sample->>'sealer',''),300),resin_supplier=left(coalesce(p_sample->>'resin_supplier',''),300),resin_color_number=left(coalesce(p_sample->>'resin_color_number',''),300),more_notes=left(coalesce(p_sample->>'more_notes',''),20000),approved_date=nullif(p_sample->>'approved_date','')::date,formulation_state=normalized where id=target_id;
 delete from public.sample_blend_rows where sample_id=target_id;
 insert into public.sample_blend_rows(sample_id,display_order,percentage,color,size,material_type,quantity,unit,vendor,catalog_source,catalog_item_id,catalog_snapshot,component_role,calculation_basis,quantity_provenance,calculated_quantity) select target_id,ordinality-1,nullif(row_data->>'percentage','')::numeric,left(coalesce(row_data->>'color',''),300),left(coalesce(row_data->>'size',''),120),left(coalesce(row_data->>'material_type',''),200),nullif(row_data->>'quantity','')::numeric,left(coalesce(nullif(row_data->>'unit',''),'oz'),80),left(coalesce(row_data->>'vendor',''),300),nullif(row_data->>'catalog_source',''),nullif(row_data->>'catalog_item_id',''),coalesce(row_data->'catalog_snapshot','{}'::jsonb),coalesce(nullif(row_data->>'component_role',''),'aggregate'),nullif(row_data->>'calculation_basis',''),coalesce(nullif(row_data->>'quantity_provenance',''),'manual'),null from jsonb_array_elements(p_rows) with ordinality as rows(row_data,ordinality);
 chip_oz:=(normalized#>>'{derived,availableChipMixOz}')::numeric; default_filler:=(normalized#>>'{derived,defaultFillerOz}')::numeric; default_resin:=(normalized#>>'{derived,defaultResinFlOz}')::numeric; dry_pool:=(normalized#>>'{derived,dryPoolOz}')::numeric; volume_cft:=(normalized#>>'{derived,productionVolumeCft}')::numeric; ratio:=(normalized->>'hardenerParts')::numeric/(normalized->>'resinParts')::numeric;
 update public.sample_blend_rows set quantity=default_filler,calculated_quantity=default_filler,unit='oz' where sample_id=target_id and component_role='filler' and quantity_provenance='calculated';
 select case when count(*)=0 or count(*) filter(where quantity is null)>0 then null else sum(case when lower(unit)='lb' then quantity*16 else quantity end) end into filler_effective from public.sample_blend_rows where sample_id=target_id and component_role='filler';
 update public.sample_blend_rows set quantity=default_resin,calculated_quantity=default_resin,unit='fl oz' where sample_id=target_id and component_role='resin' and quantity_provenance='calculated';
 select case when lower(unit) in('fl oz','fluid oz','fluid ounce','fluid ounces','oz') then quantity when lower(unit) in('gal','gallon','gallons') then quantity*128 end into resin_effective from public.sample_blend_rows where sample_id=target_id and component_role='resin' order by display_order limit 1;
 update public.sample_blend_rows set calculated_quantity=resin_effective*ratio,quantity=resin_effective*ratio,unit='fl oz' where sample_id=target_id and component_role='hardener' and quantity_provenance='calculated' and resin_effective is not null;
 if exists(select 1 from public.sample_blend_rows where sample_id=target_id and component_role='hardener' and quantity_provenance='manual' and abs(quantity-resin_effective*ratio)>.0005) then raise exception 'Shop binder must preserve the captured ratio.' using errcode='22023'; end if;
 update public.sample_blend_rows set calculated_quantity=chip_oz*percentage/100,quantity=chip_oz*percentage/100,unit='oz' where sample_id=target_id and component_role='aggregate' and quantity_provenance='calculated' and calculation_basis='target_total';
 actual_dry:=chip_oz+filler_effective; adjustment:=normalized->'adjustment';
 if adjustment is not null and normalized->>'chipDensityProvenance'='increased_filler_adjustment' and (abs(actual_dry-dry_pool)>.0005 or abs((adjustment->>'targetFillerOz')::numeric-filler_effective)>.0005 or abs((adjustment->>'resultingChipDensityLbCft')::numeric-(normalized->>'materialDensity')::numeric)>.0005) then raise exception 'Coordinated formulation adjustment no longer matches its captured Filler, density, and dry-pool values.' using errcode='22023'; end if;
 normalized:=jsonb_set(normalized,'{derived}',(normalized->'derived')||jsonb_build_object('effectiveFillerOz',filler_effective,'effectiveResinFlOz',resin_effective,'actualDryTotalOz',actual_dry,'dryPoolVarianceOz',null),true); update public.samples set formulation_state=normalized where id=target_id;
end $$;

revoke all on function public.save_sample_draft(jsonb,jsonb) from public,anon;
grant execute on function public.save_sample_draft(jsonb,jsonb) to authenticated,service_role;

alter function public.create_sample(uuid,uuid) rename to create_sample_before_batch_first;
revoke all on function public.create_sample_before_batch_first(uuid,uuid) from public,anon,authenticated,service_role;
create function public.create_sample(p_bid_id uuid default null,p_job_id uuid default null)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid; p public.sample_operational_profiles%rowtype; state jsonb; captured jsonb;
begin
 result:=public.create_sample_before_batch_first(p_bid_id,p_job_id);
 select * into p from public.sample_operational_profiles where is_active and batch_contract is not null and chip_density>0 and resin_parts in(4,5) and hardener_parts=1 order by sort_order,id limit 1;
 if p.id is null then raise exception 'No configured Batch-first profile is available.' using errcode='22023'; end if;
 select formulation_state into state from public.samples where id=result;
 captured:=jsonb_build_object('id','operational:'||p.id,'version',p.revision,'name',p.name||' — '||p.resin_parts||':1','defaultChipDensityLbCft',p.chip_density::text,'batchChipTargetLb',p.batch_chip_target_lb::text,'batchReferenceThicknessIn',p.batch_reference_thickness_in::text,'batchContract',p.batch_contract,'dryPoolOzPerCft',p.dry_pool_rate::text,'defaultFillerOzPerCft',p.filler_rate::text,'resinFlOzPerCft',p.resin_rate::text,'resinParts',p.resin_parts::text,'hardenerParts','1','evidence',p.description);
 update public.samples set formulation_state=public.normalize_sample_formulation(state||jsonb_build_object('calculationVersion','sample-formulation-v5-batch-first','profile',captured)) where id=result;
 return result;
end $$;
revoke all on function public.create_sample(uuid,uuid) from public,anon;
grant execute on function public.create_sample(uuid,uuid) to authenticated,service_role;

alter function public.issue_sample_form(uuid) rename to issue_sample_form_before_batch_first;
revoke all on function public.issue_sample_form_before_batch_first(uuid) from public,anon,authenticated,service_role;
create function public.issue_sample_form(p_sample_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid; state jsonb; total numeric;
begin
 perform public.require_app_capability('readOperationalData');
 select formulation_state into state from public.samples where id=p_sample_id for update;
 if state->>'calculationVersion'='sample-formulation-v5-batch-first' then
  select sum(percentage) into total from public.sample_blend_rows where sample_id=p_sample_id and component_role='aggregate';
  if total is null or abs(total-100)>.0005 then raise exception 'Aggregate blend must total 100%%.' using errcode='22023'; end if;
  if exists(select 1 from public.sample_blend_rows where sample_id=p_sample_id and quantity is null) then raise exception 'Complete the shop preparation quantities before issuing.' using errcode='22023'; end if;
  if exists(select 1 from unnest(array['aggregate','filler','resin','hardener']) role where not exists(select 1 from public.sample_blend_rows r where r.sample_id=p_sample_id and r.component_role=role)) then raise exception 'Required preparation components are missing.' using errcode='22023'; end if;
 end if;
 result:=public.issue_sample_form_before_batch_first(p_sample_id);
 if state->>'calculationVersion'='sample-formulation-v5-batch-first' then update public.sample_issued_documents set document_version='sample-work-order-pdf-v8-batch-first' where id=result; end if;
 return result;
end $$;
revoke all on function public.issue_sample_form(uuid) from public,anon;
grant execute on function public.issue_sample_form(uuid) to authenticated,service_role;
revoke all on function public.sample_batch_component(jsonb,text,numeric,boolean) from public,anon,authenticated;
grant execute on function public.sample_batch_component(jsonb,text,numeric,boolean) to service_role;
commit;
