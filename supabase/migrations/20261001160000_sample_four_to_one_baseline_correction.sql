-- Final Product correction: 4:1 has independently owned 150-lb chips / 50-lb filler.
-- Forward correction of the prior local candidate; never reinterpret captured Samples.
begin;
update public.sample_operational_profiles
set batch_contract=jsonb_set(jsonb_set(batch_contract,'{components,filler,exact}','"50"'),
 '{components,filler,provenance}','"Chris final V1 authority: independent 4:1 baselines, 150 lb chips and 50 lb filler"'), revision=revision+1
where name='Sherwin' and resin_parts=4 and hardener_parts=1
 and batch_contract->>'fillerSubstitution'='equal_mass_preserve_yield_v1';
commit;
