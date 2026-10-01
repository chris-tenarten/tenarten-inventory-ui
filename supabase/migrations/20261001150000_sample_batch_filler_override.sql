-- Normal formulation substitution: captured profile baseline -> resolved Batch -> Working Pour.
-- No Sample/issue backfill. Only future profile captures gain the supported rule.
begin;
update public.sample_operational_profiles
set batch_contract=jsonb_set(batch_contract,'{fillerSubstitution}','"equal_mass_preserve_yield_v1"'),revision=revision+1
where name='MTT' and resin_parts=5 and hardener_parts=1 and batch_chip_target_lb=180
 and batch_contract#>>'{components,filler,exact}'='50';
update public.sample_operational_profiles
set batch_chip_target_lb=150,
 batch_contract=jsonb_set(jsonb_set(batch_contract,'{fillerSubstitution}','"equal_mass_preserve_yield_v1"'),'{components,filler}',
 '{"exact":"80","unit":"lb","authority":"confirmed","provenance":"Chris authorized normal 4:1 baseline: 150 lb chips / 80 lb filler"}'),revision=revision+1
where name='Sherwin' and resin_parts=4 and hardener_parts=1 and batch_contract is not null;

alter function public.normalize_sample_formulation(jsonb) rename to normalize_sample_formulation_before_filler_override;
revoke all on function public.normalize_sample_formulation_before_filler_override(jsonb) from public,anon,authenticated,service_role;
create function public.normalize_sample_formulation(p_state jsonb)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare result jsonb; p jsonb; baseline numeric; filler_default numeric; filler numeric; chips numeric; batch_volume numeric; working_volume numeric; fraction numeric; chip_oz numeric; modified boolean; enabled boolean; override_present boolean; shop_profile jsonb; resin numeric; role text;
begin
 result:=public.normalize_sample_formulation_before_filler_override(p_state);
 if result->>'calculationVersion' is distinct from 'sample-formulation-v5-batch-first' then return result; end if;
 p:=result->'profile';
 enabled:=p#>>'{batchContract,fillerSubstitution}'='equal_mass_preserve_yield_v1';
 override_present:=p_state ? 'batchFillerOverrideLb' and jsonb_typeof(p_state->'batchFillerOverrideLb')<>'null';
 if p#>'{batchContract,fillerSubstitution}' is not null and not coalesce(enabled,false) then raise exception 'Unsupported Batch Filler rule.' using errcode='22023'; end if;
 if not coalesce(enabled,false) then
  if override_present then raise exception 'Captured profile does not support Batch Filler modification.' using errcode='22023'; end if;
  return result - 'resolvedBatch';
 end if;
 baseline:=public.sample_nonnegative_numeric(p->>'batchChipTargetLb');
 filler_default:=public.sample_batch_component(p,'filler',null,false);
 if coalesce(baseline,0)<=0 or filler_default is null then raise exception 'Batch Filler rule requires authoritative chip and filler baselines.' using errcode='22023'; end if;
 filler:=case when override_present then public.sample_nonnegative_numeric(p_state->>'batchFillerOverrideLb') else filler_default end;
 chips:=baseline+filler_default-filler;
 if filler is null or chips<=0 then raise exception 'Batch Filler must be nonnegative and leave a positive Chip Mix.' using errcode='22023'; end if;
 modified:=filler<>filler_default;
 batch_volume:=baseline/(p->>'defaultChipDensityLbCft')::numeric;
 working_volume:=(result#>>'{derived,productionVolumeCft}')::numeric;
 fraction:=working_volume/batch_volume; chip_oz:=chips*fraction*16;
 shop_profile:=p;
 -- Changed recipes have no inherited exact-volume shop rounding. Unresolved binder
 -- retains its captured historical Sample-only instruction, never Production authority.
 if modified then
  foreach role in array array['resin','hardener'] loop
   if public.sample_batch_component(p,role,null,false) is not null then
    shop_profile:=shop_profile #- array['batchContract','components',role,'shopWorking'];
   end if;
  end loop;
 end if;
 resin:=public.sample_batch_component(shop_profile,'resin',working_volume,true);
 result:=result||jsonb_build_object('batchFillerOverrideLb',case when modified then to_jsonb(filler::text) else 'null'::jsonb end,
 'resolvedBatch',jsonb_build_object('rule','equal_mass_preserve_yield_v1','baselineChipLb',baseline,'baselineFillerLb',filler_default,'fillerLb',filler,'chipLb',chips,'modified',modified,'volumeCft',batch_volume,'referenceThicknessIn',p->'batchReferenceThicknessIn','resinGal',public.sample_batch_component(p,'resin',null,false),'hardenerGal',public.sample_batch_component(p,'hardener',null,false),'workingFraction',fraction));
 return jsonb_set(result,'{derived}',(result->'derived')||jsonb_build_object(
 'availableChipMixOz',chip_oz,'targetWeightOz',chip_oz,'targetWeight',chip_oz/16,'geometryChipMixWeight',chip_oz/16,
 'effectiveWeightPerSf',chips/batch_volume*public.sample_nonnegative_numeric(result->>'thicknessIn')/12,
 'defaultFillerOz',case when modified then filler*fraction*16 else public.sample_batch_component(p,'filler',working_volume,true) end,
 'defaultResinFlOz',resin,'dryPoolOz',(chips+filler)*fraction*16));
end $$;
revoke all on function public.normalize_sample_formulation(jsonb) from public,anon,authenticated;
grant execute on function public.normalize_sample_formulation(jsonb) to service_role;

-- Validate supported rule configuration at the Admin save boundary, not only on capture.
alter function public.save_sample_operational_profile(uuid,integer,jsonb) rename to save_sample_operational_profile_before_filler_override;
revoke all on function public.save_sample_operational_profile_before_filler_override(uuid,integer,jsonb) from public,anon,authenticated,service_role;
create function public.save_sample_operational_profile(p_id uuid,p_expected_revision integer,p_values jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid; p public.sample_operational_profiles%rowtype;
begin
 result:=public.save_sample_operational_profile_before_filler_override(p_id,p_expected_revision,p_values);
 select * into p from public.sample_operational_profiles where id=result;
 if p.batch_contract ? 'fillerSubstitution' then
  if p.batch_contract->>'fillerSubstitution' is distinct from 'equal_mass_preserve_yield_v1'
   or coalesce(p.batch_chip_target_lb,0)<=0 or coalesce(p.chip_density,0)<=0
   or p.resin_parts not in(4,5) or p.hardener_parts<>1
   or p.batch_contract#>>'{components,filler,authority}' is distinct from 'confirmed'
   or p.batch_contract#>>'{components,filler,unit}' is distinct from 'lb'
   or nullif(p.batch_contract#>>'{components,filler,provenance}','') is null
   or public.sample_nonnegative_numeric(p.batch_contract#>>'{components,filler,exact}') is null then
   raise exception 'Filler substitution requires a supported ratio, reference loading and authoritative chip/filler baselines.' using errcode='22023';
  end if;
 end if;
 return result;
end $$;
revoke all on function public.save_sample_operational_profile(uuid,integer,jsonb) from public,anon;
grant execute on function public.save_sample_operational_profile(uuid,integer,jsonb) to authenticated,service_role;
commit;
