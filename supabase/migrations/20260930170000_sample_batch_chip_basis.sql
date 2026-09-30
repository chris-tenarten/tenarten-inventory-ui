-- Batch basis is optional captured provenance. Working calculations and historical records stay intact.
begin;
alter table public.sample_operational_profiles add column batch_chip_target_lb numeric(14,6)
 check(batch_chip_target_lb>0 and batch_chip_target_lb::text not in ('NaN','Infinity','-Infinity'));
comment on column public.sample_operational_profiles.batch_chip_target_lb is 'Total chip weight in lb represented by 100% at full Batch scale. Null is unconfigured.';

alter function public.save_sample_operational_profile(uuid,integer,jsonb) rename to save_sample_operational_profile_before_batch;
revoke all on function public.save_sample_operational_profile_before_batch(uuid,integer,jsonb) from public,anon,authenticated,service_role;
create function public.save_sample_operational_profile(p_id uuid,p_expected_revision integer,p_values jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid; target numeric(14,6);
begin
 -- The existing function owns auth, concurrency, revisions and all existing rates.
 result:=public.save_sample_operational_profile_before_batch(p_id,p_expected_revision,p_values);
 if p_values ? 'batch_chip_target_lb' then
  target:=nullif(p_values->>'batch_chip_target_lb','')::numeric;
  if target is not null and (target<=0 or target::text in ('NaN','Infinity','-Infinity')) then raise exception 'Batch chip target must be a finite positive weight in lb.' using errcode='22023'; end if;
  update public.sample_operational_profiles set batch_chip_target_lb=target where id=result;
 end if;
 return result;
end $$;
revoke all on function public.save_sample_operational_profile(uuid,integer,jsonb) from public,anon;
grant execute on function public.save_sample_operational_profile(uuid,integer,jsonb) to authenticated,service_role;

alter function public.normalize_sample_formulation(jsonb) rename to normalize_sample_formulation_before_batch;
revoke all on function public.normalize_sample_formulation_before_batch(jsonb) from public,anon,authenticated,service_role;
create function public.normalize_sample_formulation(p_state jsonb)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare normalized jsonb; target numeric(14,6);
begin
 normalized:=public.normalize_sample_formulation_before_batch(p_state);
 if normalized->>'calculationVersion'='sample-formulation-v4-density-profile' and (p_state->'profile') ? 'batchChipTargetLb' then
  if jsonb_typeof(p_state#>'{profile,batchChipTargetLb}') not in ('null','string','number') then raise exception 'Invalid Batch chip target.' using errcode='22023'; end if;
  target:=nullif(p_state#>>'{profile,batchChipTargetLb}','')::numeric;
  if target is not null and (target<=0 or target::text in ('NaN','Infinity','-Infinity')) then raise exception 'Batch chip target must be a finite positive weight in lb.' using errcode='22023'; end if;
  normalized:=jsonb_set(normalized,'{profile,batchChipTargetLb}',coalesce(to_jsonb(target::text),'null'::jsonb));
 end if;
 return normalized;
end $$;
revoke all on function public.normalize_sample_formulation(jsonb) from public,anon;
grant execute on function public.normalize_sample_formulation(jsonb) to service_role;

alter function public.save_sample_draft(jsonb,jsonb) rename to save_sample_draft_before_batch;
revoke all on function public.save_sample_draft_before_batch(jsonb,jsonb) from public,anon,authenticated,service_role;
create function public.save_sample_draft(p_sample jsonb,p_rows jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare prior jsonb; incoming jsonb:=p_sample#>'{formulation_state,profile}';
begin
 perform public.require_app_capability('readOperationalData');
 select formulation_state->'profile' into prior from public.samples where id=(p_sample->>'id')::uuid for update;
 -- Older clients omit an unknown field. Preserve it only for the same captured profile revision.
 -- Explicit null is intentional clearing. Different profile captures remain independent.
 if incoming is not null and not (incoming ? 'batchChipTargetLb') and prior ? 'batchChipTargetLb'
  and incoming->>'id'=prior->>'id' and incoming->>'version'=prior->>'version' then
  p_sample:=jsonb_set(p_sample,'{formulation_state,profile,batchChipTargetLb}',prior->'batchChipTargetLb');
 end if;
 perform public.save_sample_draft_before_batch(p_sample,p_rows);
end $$;
revoke all on function public.save_sample_draft(jsonb,jsonb) from public,anon;
grant execute on function public.save_sample_draft(jsonb,jsonb) to authenticated,service_role;

-- Restore intentionally bypasses old-client omission preservation, using the saved capture exactly.
create or replace function public.restore_sample_working_version(p_sample_id uuid,p_version_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare current_sample public.samples%rowtype; source public.sample_working_versions%rowtype; restored jsonb;
begin
  perform public.require_app_capability('readOperationalData'); perform 1 from public.app_users where user_id=auth.uid() and is_active; if not found then raise exception 'Active operational access is required.' using errcode='42501'; end if;
  select * into strict current_sample from public.samples where id=p_sample_id for update; select * into strict source from public.sample_working_versions where id=p_version_id and sample_id=p_sample_id;
  restored:=source.version_snapshot||jsonb_build_object('id',current_sample.id,'bid_id',current_sample.bid_id,'job_id',current_sample.job_id,'project_name',current_sample.project_name,'customer_name',current_sample.customer_name,'prepared_by',current_sample.prepared_by,'color_plate_number',current_sample.color_plate_number,'approved_date',current_sample.approved_date);
  perform public.save_sample_draft_before_batch(restored,coalesce(source.version_snapshot->'blend_rows','[]'::jsonb));
end $$;


-- Only newly issued documents select the new presentation. No historical rows are updated.
alter function public.issue_sample_form(uuid) rename to issue_sample_form_before_batch;
revoke all on function public.issue_sample_form_before_batch(uuid) from public,anon,authenticated,service_role;
create function public.issue_sample_form(p_sample_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid;
begin
 result:=public.issue_sample_form_before_batch(p_sample_id);
 update public.sample_issued_documents set document_version='sample-work-order-pdf-v7-batch-basis' where id=result;
 return result;
end $$;
revoke all on function public.issue_sample_form(uuid) from public,anon;
grant execute on function public.issue_sample_form(uuid) to authenticated,service_role;
commit;
