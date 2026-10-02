-- Complete normal Key/Terroxy 5:1 profiles from accepted MTT configuration.
-- Preserve independently configured values/confirmed component authority. No captured data backfill.
begin;
with baseline as (select * from public.sample_operational_profiles where name='MTT' and resin_parts=5 and hardener_parts=1), resolved as (
 select p.id,jsonb_object_agg(role,case when p.batch_contract#>>array['components',role,'authority']='confirmed'
 and (p.batch_contract#>>array['components',role,'exact'] is not null or p.batch_contract#>>array['components',role,'rule']='resin_ratio')
 then p.batch_contract#>array['components',role] else m.batch_contract#>array['components',role] end) components
 from public.sample_operational_profiles p cross join baseline m cross join unnest(array['filler','resin','hardener']) role
 where p.name in ('Key Resin','Terroxy') and p.resin_parts=5 and p.hardener_parts=1 group by p.id
)
update public.sample_operational_profiles p set
 chip_density=coalesce(p.chip_density,m.chip_density),dry_pool_rate=coalesce(p.dry_pool_rate,m.dry_pool_rate),filler_rate=coalesce(p.filler_rate,m.filler_rate),resin_rate=coalesce(p.resin_rate,m.resin_rate),
 batch_chip_target_lb=coalesce(p.batch_chip_target_lb,m.batch_chip_target_lb),batch_reference_thickness_in=coalesce(p.batch_reference_thickness_in,m.batch_reference_thickness_in),
 batch_contract=coalesce(p.batch_contract,'{}')||jsonb_build_object('version',1,'fillerSubstitution',coalesce(p.batch_contract->>'fillerSubstitution',m.batch_contract->>'fillerSubstitution'),'components',r.components),
 description=p.description||' Normal 5:1 configuration completed from accepted MTT baseline per Gio/Chris Product direction, October 2, 2026.',revision=p.revision+1
from baseline m,resolved r where p.id=r.id;
-- New issues capture the compact layout version; old issue versions are untouched.
alter function public.issue_sample_form(uuid) rename to issue_sample_form_before_compact;
revoke all on function public.issue_sample_form_before_compact(uuid) from public,anon,authenticated,service_role;
create function public.issue_sample_form(p_sample_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid;
begin
 result:=public.issue_sample_form_before_compact(p_sample_id);
 update public.sample_issued_documents set document_version='sample-work-order-pdf-v9-compact'
 where id=result and issued_snapshot#>>'{formulation_state,calculationVersion}'='sample-formulation-v5-batch-first';
 return result;
end $$;
revoke all on function public.issue_sample_form(uuid) from public,anon;
grant execute on function public.issue_sample_form(uuid) to authenticated,service_role;
commit;
