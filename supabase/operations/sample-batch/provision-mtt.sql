-- Reviewed configuration operation, NOT an automatic migration. Requires separately authorized hosted execution.
-- psql -v mtt_id=<reviewed UUID> -v expected_revision=<reviewed revision> -f this-file
-- Local fixtures resolve their known seed UUID; hosted operators must verify the exact record first.
begin;
select set_config('tenops.batch_mtt_id', :'mtt_id', true);
select set_config('tenops.batch_mtt_revision', :'expected_revision', true);
do $$
declare p public.sample_operational_profiles%rowtype;
begin
 select * into strict p from public.sample_operational_profiles where id=current_setting('tenops.batch_mtt_id')::uuid for update;
 if p.revision<>current_setting('tenops.batch_mtt_revision')::integer or p.name<>'MTT' or not p.is_active
  or p.chip_density is distinct from 128 or p.dry_pool_rate is distinct from 2560 or p.filler_rate is distinct from 512
  or p.resin_rate is distinct from 480 or p.resin_parts is distinct from 5 or p.hardener_parts is distinct from 1
  or p.batch_chip_target_lb is not null then raise exception 'Common MTT identity/revision/rates mismatch; no configuration changed.'; end if;
 perform public.save_sample_operational_profile(p.id,p.revision,to_jsonb(p)||jsonb_build_object('batch_chip_target_lb',180,'description',p.description||' Batch chip target 180 lb approved by Chris, September 30 2026. Composition remains operator-authored.'));
end $$;
commit;
