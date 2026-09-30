-- Batch basis is optional captured provenance. Working calculations and historical records stay intact.
begin;
alter table public.sample_operational_profiles add column batch_reference_thickness_in numeric(14,6)
 check(batch_reference_thickness_in>0 and batch_reference_thickness_in::text not in ('NaN','Infinity','-Infinity'));
comment on column public.sample_operational_profiles.batch_reference_thickness_in is 'Reference thickness in inches for deriving Batch coverage from chip target and captured profile density. Null is unconfigured; independent of Working Pour thickness.';

alter function public.save_sample_operational_profile(uuid,integer,jsonb) rename to save_sample_operational_profile_before_batch_reference;
revoke all on function public.save_sample_operational_profile_before_batch_reference(uuid,integer,jsonb) from public,anon,authenticated,service_role;
create function public.save_sample_operational_profile(p_id uuid,p_expected_revision integer,p_values jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid; target numeric(14,6);
begin
 -- The existing function owns auth, concurrency, revisions and all existing rates.
 result:=public.save_sample_operational_profile_before_batch_reference(p_id,p_expected_revision,p_values);
 if p_values ? 'batch_reference_thickness_in' then
  target:=nullif(p_values->>'batch_reference_thickness_in','')::numeric;
  if target is not null and (target<=0 or target::text in ('NaN','Infinity','-Infinity')) then raise exception 'Batch reference thickness must be a finite positive thickness in inches.' using errcode='22023'; end if;
  update public.sample_operational_profiles set batch_reference_thickness_in=target where id=result;
 end if;
 return result;
end $$;
revoke all on function public.save_sample_operational_profile(uuid,integer,jsonb) from public,anon;
grant execute on function public.save_sample_operational_profile(uuid,integer,jsonb) to authenticated,service_role;

alter function public.normalize_sample_formulation(jsonb) rename to normalize_sample_formulation_before_batch_reference;
revoke all on function public.normalize_sample_formulation_before_batch_reference(jsonb) from public,anon,authenticated,service_role;
create function public.normalize_sample_formulation(p_state jsonb)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare normalized jsonb; target numeric(14,6);
begin
 normalized:=public.normalize_sample_formulation_before_batch_reference(p_state);
 if normalized->>'calculationVersion'='sample-formulation-v4-density-profile' and (p_state->'profile') ? 'batchReferenceThicknessIn' then
  if jsonb_typeof(p_state#>'{profile,batchReferenceThicknessIn}') not in ('null','string','number') then raise exception 'Invalid Batch reference thickness.' using errcode='22023'; end if;
  target:=nullif(p_state#>>'{profile,batchReferenceThicknessIn}','')::numeric;
  if target is not null and (target<=0 or target::text in ('NaN','Infinity','-Infinity')) then raise exception 'Batch reference thickness must be a finite positive thickness in inches.' using errcode='22023'; end if;
  normalized:=jsonb_set(normalized,'{profile,batchReferenceThicknessIn}',coalesce(to_jsonb(target::text),'null'::jsonb));
 end if;
 return normalized;
end $$;
revoke all on function public.normalize_sample_formulation(jsonb) from public,anon;
grant execute on function public.normalize_sample_formulation(jsonb) to service_role;

alter function public.save_sample_draft(jsonb,jsonb) rename to save_sample_draft_before_batch_reference;
revoke all on function public.save_sample_draft_before_batch_reference(jsonb,jsonb) from public,anon,authenticated,service_role;
create function public.save_sample_draft(p_sample jsonb,p_rows jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare prior jsonb; incoming jsonb:=p_sample#>'{formulation_state,profile}';
begin
 perform public.require_app_capability('readOperationalData');
 select formulation_state->'profile' into prior from public.samples where id=(p_sample->>'id')::uuid for update;
 -- Older clients omit an unknown field. Preserve it only for the same captured profile revision.
 -- Explicit null is intentional clearing. Different profile captures remain independent.
 if incoming is not null and not (incoming ? 'batchReferenceThicknessIn') and prior ? 'batchReferenceThicknessIn'
  and incoming->>'id'=prior->>'id' and incoming->>'version'=prior->>'version' then
  p_sample:=jsonb_set(p_sample,'{formulation_state,profile,batchReferenceThicknessIn}',prior->'batchReferenceThicknessIn');
 end if;
 perform public.save_sample_draft_before_batch_reference(p_sample,p_rows);
end $$;
revoke all on function public.save_sample_draft(jsonb,jsonb) from public,anon;
grant execute on function public.save_sample_draft(jsonb,jsonb) to authenticated,service_role;

-- Existing restore bypasses omission preservation and normalizes the exact saved capture.
-- No Samples, working versions, issued documents or profile values are backfilled.
commit;
