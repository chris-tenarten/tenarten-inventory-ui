-- Runs after existing density-profile lifecycle fixtures in disposable PostgreSQL.
insert into public.app_users values('00000000-0000-0000-0000-000000000010','TEST Profile Admin','admin',true),('00000000-0000-0000-0000-000000000011','TEST Profile Inactive','admin',false);
create temp table profile_history_baseline as select 'samples' kind,to_jsonb(s) payload from public.samples s union all select 'versions',to_jsonb(v) from public.sample_working_versions v union all select 'issued',to_jsonb(i) from public.sample_issued_documents i;
do $$declare p public.sample_operational_profiles%rowtype;new_id uuid;begin
 if (select array_agg(name order by sort_order) from public.sample_operational_profiles)<>array['MTT','Key Resin','Terroxy','Sherwin','Cement'] then raise exception 'Operational vocabulary incorrect';end if;
 if not exists(select 1 from public.sample_operational_profiles where name='Cement' and resin_parts is null and chip_density is null) then raise exception 'Cement guessed';end if;
 if exists(select 1 from public.sample_operational_profiles where name in('Key Resin','Terroxy') and (resin_parts<>5 or chip_density is not null)) then raise exception 'Unapproved defaults';end if;
 begin perform public.save_sample_operational_profile(null,null,'{"name":"Denied"}');raise exception 'Member management allowed';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',true);
 begin perform public.save_sample_operational_profile(null,null,'{"name":"Denied"}');raise exception 'Inactive management allowed';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',true);
 new_id:=public.save_sample_operational_profile(null,null,'{"name":"TEST Profile","is_active":true,"resin_parts":5,"hardener_parts":1}');
 select * into p from public.sample_operational_profiles where id=new_id;
 perform public.save_sample_operational_profile(p.id,p.revision,to_jsonb(p)||'{"name":"TEST Renamed","is_active":false}'::jsonb);
 begin perform public.save_sample_operational_profile(p.id,p.revision,to_jsonb(p));raise exception 'Stale management allowed';exception when serialization_failure then null;end;
 select * into p from public.sample_operational_profiles where id=new_id;
 if p.is_active or p.name<>'TEST Renamed' then raise exception 'Rename/deactivate failed';end if;
 perform public.save_sample_operational_profile(p.id,p.revision,to_jsonb(p)||'{"is_active":true}'::jsonb);
 select * into p from public.sample_operational_profiles where id=new_id;
 perform public.move_sample_operational_profile(p.id,p.revision,-1);
 if (select sort_order from public.sample_operational_profiles where id=new_id)<>50 then raise exception 'Reorder failed';end if;
 if exists((select kind,payload from profile_history_baseline) except (select 'samples',to_jsonb(s) from public.samples s union all select 'versions',to_jsonb(v) from public.sample_working_versions v union all select 'issued',to_jsonb(i) from public.sample_issued_documents i)) then raise exception 'Management rewrote history';end if;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$declare sid uuid;pid uuid;captured jsonb;state jsonb;version_id uuid;issued_id uuid;begin
 select id,jsonb_build_object('id','operational:'||id::text,'version',revision,'name',name||' — 5:1','defaultChipDensityLbCft',chip_density::text,'dryPoolOzPerCft',dry_pool_rate::text,'defaultFillerOzPerCft',filler_rate::text,'resinFlOzPerCft',resin_rate::text,'resinParts',resin_parts::text,'hardenerParts',hardener_parts::text,'evidence',description) into pid,captured from public.sample_operational_profiles where name='MTT';
 sid:=public.create_sample();
 select formulation_state into state from public.samples where id=(select id from ids where name='v4');
 state:=state||jsonb_build_object('profile',captured,'profileProvenance','selected','adjustment',null,'chipDensityProvenance','profile_default','fillerProvenance','profile_default','materialDensity','128','resinParts','5','hardenerParts','1');
 perform public.save_sample_draft(jsonb_build_object('id',sid,'prepared_by','TEST Member','formulation_state',state),jsonb_build_array(jsonb_build_object('percentage','100','component_role','aggregate','calculation_basis','target_total','quantity_provenance','calculated'),jsonb_build_object('component_role','filler','quantity_provenance','calculated','unit','oz'),jsonb_build_object('component_role','resin','quantity_provenance','calculated','unit','fl oz'),jsonb_build_object('component_role','hardener','quantity_provenance','calculated','unit','fl oz')));
 version_id:=public.save_sample_working_version(sid,'Managed profile checkpoint');
 perform public.restore_sample_working_version(sid,version_id);issued_id:=public.issue_sample_form(sid);
 if (select formulation_state->'profile' from public.samples where id=sid)<>captured or (select issued_snapshot#>'{formulation_state,profile}' from public.sample_issued_documents where id=issued_id)<>captured then raise exception 'Managed captured profile lost at persistence/issue';end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',true);
 perform public.save_sample_operational_profile(pid,1,(select to_jsonb(p)||'{"name":"MTT Future","chip_density":130}'::jsonb from public.sample_operational_profiles p where id=pid));
 perform public.restore_sample_working_version(sid,version_id);
 if (select formulation_state->'profile' from public.samples where id=sid)<>captured or (select issued_snapshot#>'{formulation_state,profile}' from public.sample_issued_documents where id=issued_id)<>captured then raise exception 'Profile edit altered captured/issued values';end if;
end$$;
