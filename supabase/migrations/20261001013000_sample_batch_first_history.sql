-- Final V5 capture integrity: trusted historical profile restore and shop dry-mass totals.
begin;
-- Unknown legacy rates do not become malformed shop instructions on incomplete profiles.
update public.sample_operational_profiles set batch_contract=batch_contract #- '{components,filler,shopWorking}'
 where batch_contract#>>'{components,filler,shopWorking,quantity}' is null;
update public.sample_operational_profiles set batch_contract=batch_contract #- '{components,resin,shopWorking}'
 where batch_contract#>>'{components,resin,shopWorking,quantity}' is null;
create or replace function public.save_sample_draft(p_sample jsonb,p_rows jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare target_id uuid:=(p_sample->>'id')::uuid; normalized jsonb:=public.normalize_sample_formulation(coalesce(p_sample->'formulation_state','{}'::jsonb)); color_plate text:=nullif(upper(btrim(coalesce(p_sample->>'color_plate_number',''))),''); chip_oz numeric; default_filler numeric; default_resin numeric; filler_effective numeric; resin_effective numeric; ratio numeric; dry_pool numeric; actual_dry numeric; volume_cft numeric; adjustment jsonb; prior_profile jsonb; current_profile public.sample_operational_profiles%rowtype;
begin
 if normalized->>'calculationVersion'<>'sample-formulation-v5-batch-first' then perform public.save_sample_draft_before_batch_first(p_sample,p_rows); return; end if;
 perform public.require_app_capability('readOperationalData'); perform 1 from public.app_users where user_id=auth.uid() and is_active; if not found then raise exception 'Active operational access is required.' using errcode='42501'; end if;
 if not exists(select 1 from public.samples where id=target_id for update) then raise exception 'Sample not found.' using errcode='P0002'; end if;
 select formulation_state->'profile' into prior_profile from public.samples where id=target_id;
 if prior_profile is distinct from normalized->'profile'
  and not exists(select 1 from public.sample_working_versions where sample_id=target_id and version_snapshot#>'{formulation_state,profile}'=normalized->'profile')
  and not exists(select 1 from public.sample_issued_documents where sample_id=target_id and issued_snapshot#>'{formulation_state,profile}'=normalized->'profile') then
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
 if exists(select 1 from public.sample_blend_rows where sample_id=target_id and component_role='hardener' and quantity_provenance='manual' and abs((case when lower(unit) in('gal','gallon','gallons') then quantity*128 else quantity end)-resin_effective*ratio)>.0005) then raise exception 'Shop binder must preserve the captured ratio.' using errcode='22023'; end if;
 update public.sample_blend_rows set calculated_quantity=chip_oz*percentage/100,quantity=chip_oz*percentage/100,unit='oz' where sample_id=target_id and component_role='aggregate' and quantity_provenance='calculated' and calculation_basis='target_total';
 select case when count(*)=0 or count(*) filter(where quantity is null)>0 then null else sum(case when lower(unit)='lb' then quantity*16 else quantity end) end + filler_effective into actual_dry from public.sample_blend_rows where sample_id=target_id and component_role='aggregate'; adjustment:=normalized->'adjustment';
 if adjustment is not null and normalized->>'chipDensityProvenance'='increased_filler_adjustment' and (abs(actual_dry-dry_pool)>.0005 or abs((adjustment->>'targetFillerOz')::numeric-filler_effective)>.0005 or abs((adjustment->>'resultingChipDensityLbCft')::numeric-(normalized->>'materialDensity')::numeric)>.0005) then raise exception 'Coordinated formulation adjustment no longer matches its captured Filler, density, and dry-pool values.' using errcode='22023'; end if;
 normalized:=jsonb_set(normalized,'{derived}',(normalized->'derived')||jsonb_build_object('effectiveFillerOz',filler_effective,'effectiveResinFlOz',resin_effective,'actualDryTotalOz',actual_dry,'dryPoolVarianceOz',null),true); update public.samples set formulation_state=normalized where id=target_id;
end $$;

commit;
