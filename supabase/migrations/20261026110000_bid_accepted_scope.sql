-- Additive acceptance provenance; no issued documents, existing Jobs or stock rewritten.
begin;
create table public.bid_scope_captures (
 id uuid primary key default gen_random_uuid(),
 bid_id uuid not null references public.bids(id) on delete restrict,
 revision integer not null check(revision>0),
 accepted_by uuid not null references public.app_users(user_id),
 accepted_by_name text not null,
 accepted_at timestamptz not null default clock_timestamp(),
 proposal_id uuid references public.proposals(id) on delete restrict,
 proposal_reference jsonb not null,
 calculation_version text not null default 'bid-material-requirements-v1',
 evidence text not null check(length(btrim(evidence)) between 1 and 10000),
 lines jsonb not null,
 sources jsonb not null,
 requirements jsonb not null,
 unresolved jsonb not null,
 unique(bid_id,revision)
);
create trigger bid_scope_capture_immutable before update or delete on public.bid_scope_captures for each row execute function public.intake_capture_immutable();
alter table public.bid_scope_captures enable row level security;
revoke all on public.bid_scope_captures from public,anon,authenticated;
grant select on public.bid_scope_captures to authenticated;
grant all on public.bid_scope_captures to service_role;
-- Scope contains commercial quantities/evidence; retain Proposal authorization.
create policy bid_scope_authorized_read on public.bid_scope_captures for select to authenticated using(public.has_app_capability('viewIntake') and public.has_proposal_access());
create function public.bid_scope_context(p_bid_id uuid,p_proposal_id uuid,p_lines jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare b public.bids; proposal jsonb:='{}'; sources jsonb:='[]'; line jsonb; snapshot jsonb; source_id uuid; historical_id uuid; context jsonb;
begin
 perform public.require_app_capability('accessIntake');perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');perform public.require_app_capability('production_blend.manage');
 if not public.has_proposal_access() then raise exception 'Proposal access required' using errcode='42501';end if;
 select * into strict b from public.bids where id=p_bid_id;
 if b.production_job_id is not null then raise exception 'Converted scope is retained; manage subsequent changes in Production';end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 50 or pg_column_size(p_lines)>1048576 then raise exception 'Select 1–50 scope lines';end if;
 if p_proposal_id is not null then
  select jsonb_build_object('id',p.id,'estimate_number',p.estimate_number,'issued_at',p.issued_at,'version_major',p.version_major,'version_minor',p.version_minor) into proposal
  from public.proposals p join public.bid_proposal_relationships r on r.proposal_id=p.id where p.id=p_proposal_id and r.bid_id=b.id and p.status='issued';
  if proposal is null then raise exception 'Select an issued Proposal revision linked to this Bid';end if;
 end if;
 for line in select value from jsonb_array_elements(p_lines) loop
  source_id:=nullif(line->>'sourceId','')::uuid;snapshot:=null;historical_id:=null;
  if source_id is null then snapshot:='{}';
  elsif line->>'sourceKind'='issued' then select d.issued_snapshot||jsonb_build_object('_scope_provenance',to_jsonb(d)-'issued_snapshot') into snapshot from public.sample_issued_documents d where d.id=source_id and exists(select 1 from public.samples s where s.id=d.sample_id and (s.bid_id is null or s.bid_id=b.id)) and nullif(d.issued_snapshot->>'approved_date','') is not null;
  elsif line->>'sourceKind'='version' then select v.version_snapshot||jsonb_build_object('_scope_provenance',to_jsonb(v)-'version_snapshot') into snapshot from public.sample_working_versions v join public.samples s on s.id=v.sample_id where v.id=source_id and (s.bid_id is null or s.bid_id=b.id) and nullif(v.version_snapshot->>'approved_date','') is not null;
  elsif line->>'sourceKind'='blend' then select p.source_snapshot||jsonb_build_object('_scope_provenance',to_jsonb(p)-'source_snapshot'-'model') into snapshot from public.production_blend_plans p where p.id=source_id and (not exists(select 1 from public.samples bs where bs.id=p.sample_id) or exists(select 1 from public.samples bs where bs.id=p.sample_id and (bs.bid_id is null or bs.bid_id=b.id))) and p.status='issued' and nullif(coalesce(p.source_snapshot->>'approved_date',p.source_snapshot->>'approvedDate'),'') is not null;
  elsif line->>'sourceKind'='historical' then select v.snapshot||jsonb_build_object('_scope_provenance',to_jsonb(v)-'snapshot') into snapshot from public.historical_sample_verifications v join public.samples s on s.id=v.sample_id where v.id=source_id and (s.bid_id is null or s.bid_id=b.id);
  end if;
  if snapshot is null then raise exception 'Source unavailable, not approved, or not an immutable version';end if;
  -- An imported Sample cannot bypass verification by setting approved_date/issuing.
  if line->>'sourceKind'<>'historical' and exists(select 1 from public.historical_sample_imports i where i.sample_id=nullif(coalesce(snapshot->>'id',snapshot->>'sample_id'),'')::uuid) then raise exception 'Use the explicit Verified historical capture';end if;
  sources:=sources||jsonb_build_array(snapshot);
 end loop;
 context:=jsonb_build_object('bid_id',b.id,'bid_updated_at',b.updated_at,'proposal_reference',coalesce(proposal,'{}'),'sources',sources);
 return context||jsonb_build_object('fingerprint',md5(context::text));
end $$;
-- Trusted Edge service only. Re-resolve sources under the Bid lock; reject stale previews.
create function public.persist_bid_scope(p_actor uuid,p_expected_scope_id uuid,p_proposal_id uuid,p_lines jsonb,p_context jsonb,p_evidence text,p_requirements jsonb,p_unresolved jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare result public.bid_scope_captures; context jsonb; latest uuid; next_revision integer; old_sub text:=current_setting('request.jwt.claim.sub',true); bid uuid:=(p_context->>'bid_id')::uuid;
begin
 perform set_config('request.jwt.claim.sub',p_actor::text,true);
 perform 1 from public.bids where id=bid for update;
 context:=public.bid_scope_context(bid,p_proposal_id,p_lines);
 if context->>'fingerprint' is distinct from p_context->>'fingerprint' then raise exception 'Source or Bid changed; review again' using errcode='40001';end if;
 select id into latest from public.bid_scope_captures where bid_id=bid order by revision desc limit 1;
 if latest is distinct from p_expected_scope_id then raise exception 'Accepted scope changed; reload before accepting' using errcode='40001';end if;
 select coalesce(max(revision),0)+1 into next_revision from public.bid_scope_captures where bid_id=bid;
 insert into public.bid_scope_captures(bid_id,revision,accepted_by,accepted_by_name,proposal_id,proposal_reference,evidence,lines,sources,requirements,unresolved)
 values(bid,next_revision,p_actor,(select display_name from public.app_users where user_id=p_actor),p_proposal_id,context->'proposal_reference',p_evidence,p_lines,context->'sources',p_requirements,p_unresolved) returning * into result;
 -- A Bid concurrency token changes with accepted scope, preventing stale conversion.
 update public.bids set updated_at=clock_timestamp() where id=bid;
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
 return to_jsonb(result);
end $$;
revoke all on function public.persist_bid_scope(uuid,uuid,uuid,jsonb,jsonb,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.persist_bid_scope(uuid,uuid,uuid,jsonb,jsonb,text,jsonb,jsonb) to service_role;
revoke all on function public.bid_scope_context(uuid,uuid,jsonb) from public,anon;
grant execute on function public.bid_scope_context(uuid,uuid,jsonb) to authenticated;
-- Ordinary users see only sources authorized by the existing document capabilities.
create function public.list_bid_scope_sources(p_bid_id uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 perform public.require_app_capability('viewIntake');perform public.require_app_capability('readOperationalData');
 return (select coalesce(jsonb_agg(x),'[]') from (
 select 'issued' as kind,d.id,coalesce(s.color_plate_number,s.sample_name,'Sample')||' · issued '||d.issue_number as label from public.sample_issued_documents d join public.samples s on s.id=d.sample_id where (s.bid_id is null or s.bid_id=p_bid_id) and nullif(d.issued_snapshot->>'approved_date','') is not null and not exists(select 1 from public.historical_sample_imports i where i.sample_id=s.id)
 union all select 'version',v.id,coalesce(s.color_plate_number,s.sample_name,'Sample')||' · saved v'||v.version_number from public.sample_working_versions v join public.samples s on s.id=v.sample_id where (s.bid_id is null or s.bid_id=p_bid_id) and nullif(v.version_snapshot->>'approved_date','') is not null and not exists(select 1 from public.historical_sample_imports i where i.sample_id=s.id)
 union all select 'historical',v.id,coalesce(v.snapshot->>'color_plate_number','Historical Sample')||' · verified '||to_char(v.verified_at,'YYYY-MM-DD HH24:MI:SS TZ') from public.historical_sample_verifications v join public.samples s on s.id=v.sample_id where s.bid_id is null or s.bid_id=p_bid_id
 union all select 'blend',p.id,coalesce(p.model->>'identity','Blend')||' · issued Blend' from public.production_blend_plans p where public.has_app_capability('production_blend.manage') and (not exists(select 1 from public.samples bs where bs.id=p.sample_id) or exists(select 1 from public.samples bs where bs.id=p.sample_id and (bs.bid_id is null or bs.bid_id=p_bid_id))) and p.status='issued' and exists(select 1 from public.samples bs where bs.id=p.sample_id and (bs.bid_id is null or bs.bid_id=p_bid_id)) and nullif(coalesce(p.source_snapshot->>'approved_date',p.source_snapshot->>'approvedDate'),'') is not null and not exists(select 1 from public.historical_sample_imports i where i.sample_id=p.sample_id)
 ) x);
end $$;
create function public.bid_material_supply() returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
begin
 perform public.require_app_capability('viewIntake');perform public.require_app_capability('readOperationalData');
 return jsonb_build_object('inventory',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'vendor',i.vendor,'color',i.color,'size',i.size,'category',i.category,'unit',i.unit,'quantity',i.quantity,'production_job_id',i.production_job_id,'temporary_job_label',i.temporary_job_label,'earmarked_for_job',i.earmarked_for_job)),'[]') from public.inventory_items i),
 'incoming',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'vendor',p.vendor,'material_name',p.material_name,'size',p.size,'category',p.category,'unit',p.unit,'quantity_expected',p.quantity_expected,'quantity_received',p.quantity_received,'production_job_id',p.production_job_id,'temporary_job_label',p.temporary_job_label,'is_earmarked',p.is_earmarked,'eta',p.eta,'status',p.status)),'[]') from public.pending_receivals p where p.status in ('pending','partially_received')),'assessed_at',clock_timestamp());
end $$;
revoke all on function public.list_bid_scope_sources(uuid),public.bid_material_supply() from public,anon;
grant execute on function public.list_bid_scope_sources(uuid),public.bid_material_supply() to authenticated;
create function public.intake_workflow_summaries() returns table(id uuid,production_job_id uuid,accepted_revision integer,unresolved_count integer)
language sql stable security invoker set search_path=pg_catalog,public as $$
 select b.id,b.production_job_id,c.revision,jsonb_array_length(c.unresolved) from public.bids b
 left join lateral(select s.revision,s.unresolved from public.bid_scope_captures s where s.bid_id=b.id order by s.revision desc limit 1)c on true
 where public.has_app_capability('viewIntake')
$$;
revoke all on function public.intake_workflow_summaries() from public,anon;
grant execute on function public.intake_workflow_summaries() to authenticated;
-- Reject destructive preparation before any Bid-owned Storage removal.
alter function public.prepare_admin_delete_bid(uuid) rename to prepare_admin_delete_bid_before_scope;
revoke all on function public.prepare_admin_delete_bid_before_scope(uuid) from public,anon,authenticated,service_role;
create function public.prepare_admin_delete_bid(p_bid_id uuid) returns table(storage_path text) language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 perform public.require_app_capability('manageUsers');perform 1 from public.bids where id=p_bid_id for update;
 if exists(select 1 from public.bid_scope_captures where bid_id=p_bid_id) then raise exception 'Accepted scope history is retained; this Bid cannot be deleted';end if;
 return query select * from public.prepare_admin_delete_bid_before_scope(p_bid_id);
end $$;
revoke all on function public.prepare_admin_delete_bid(uuid) from public,anon;
grant execute on function public.prepare_admin_delete_bid(uuid) to authenticated,service_role;
commit;
