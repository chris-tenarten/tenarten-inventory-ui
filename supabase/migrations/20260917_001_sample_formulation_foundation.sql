-- Sample Formulation Configurator V1: confirmed calculation foundation and standalone issuance.
-- Forward-only. Do not apply without Product/Chris authorization.
begin;

alter table public.samples add column formulation_state jsonb not null default '{"basis":"total_weight","weightUnit":"lb","totalWeight":"","length":"","width":"","dimensionUnit":"in","weightPerSf":"","resinParts":"5","hardenerParts":"1","defaultVersion":1,"calculationVersion":"sample-formulation-v1"}'::jsonb check(jsonb_typeof(formulation_state)='object');
alter table public.sample_blend_rows add column component_role text not null default 'aggregate' check(component_role in('aggregate','resin','hardener','other'));
alter table public.sample_blend_rows add column calculation_basis text check(calculation_basis is null or calculation_basis='target_total');
alter table public.sample_blend_rows add column quantity_provenance text not null default 'manual' check(quantity_provenance in('calculated','manual'));
alter table public.sample_blend_rows add column calculated_quantity numeric(14,4) check(calculated_quantity is null or calculated_quantity>=0);

create table public.sample_formulation_defaults(
  version integer generated always as identity primary key,
  resin_parts numeric(12,4) not null check(resin_parts>0),
  hardener_parts numeric(12,4) not null check(hardener_parts>0),
  created_at timestamptz not null default clock_timestamp(),
  created_by_user_id uuid references public.app_users(user_id)
);
insert into public.sample_formulation_defaults(resin_parts,hardener_parts) values(5,1);
alter table public.sample_formulation_defaults enable row level security;
revoke all on public.sample_formulation_defaults from public,anon,authenticated;
grant select on public.sample_formulation_defaults to authenticated;
grant all on public.sample_formulation_defaults to service_role;
create policy sample_formulation_defaults_operational_select on public.sample_formulation_defaults for select to authenticated using(public.has_app_capability('readOperationalData'));

create table public.sample_working_versions(
  id uuid primary key default gen_random_uuid(),
  sample_id uuid not null references public.samples(id) on delete restrict,
  version_number integer not null check(version_number>0),
  version_note text not null default '' check(length(version_note)<=200),
  version_snapshot jsonb not null check(jsonb_typeof(version_snapshot)='object'),
  saved_by_user_id uuid not null references public.app_users(user_id),
  saved_at timestamptz not null default clock_timestamp(),
  unique(sample_id,version_number)
);
create index sample_working_versions_sample_idx on public.sample_working_versions(sample_id,version_number desc);
alter table public.sample_working_versions enable row level security;
revoke all on public.sample_working_versions from public,anon,authenticated;
grant select on public.sample_working_versions to authenticated;
grant all on public.sample_working_versions to service_role;
create policy sample_working_versions_operational_select on public.sample_working_versions for select to authenticated using(public.has_app_capability('readOperationalData'));
create function public.sample_working_version_immutable()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin raise exception 'Saved Sample working versions are immutable.' using errcode='55000'; end $$;
create trigger sample_working_version_immutable before update or delete on public.sample_working_versions for each row execute function public.sample_working_version_immutable();

create function public.sample_nonnegative_numeric(p_value text)
returns numeric language sql immutable set search_path=pg_catalog as $$
  select case when coalesce(p_value,'')~'^[0-9]+([.][0-9]+)?$' then p_value::numeric else null end
$$;

create function public.normalize_sample_formulation(p_state jsonb)
returns jsonb language plpgsql stable set search_path=pg_catalog,public as $$
declare basis text:=coalesce(nullif(p_state->>'basis',''),'total_weight'); unit text:=coalesce(nullif(p_state->>'dimensionUnit',''),'in');
  total_weight numeric:=public.sample_nonnegative_numeric(p_state->>'totalWeight'); length_value numeric:=public.sample_nonnegative_numeric(p_state->>'length'); width_value numeric:=public.sample_nonnegative_numeric(p_state->>'width'); rate numeric:=public.sample_nonnegative_numeric(p_state->>'weightPerSf');
  resin_parts numeric:=public.sample_nonnegative_numeric(p_state->>'resinParts'); hardener_parts numeric:=public.sample_nonnegative_numeric(p_state->>'hardenerParts'); area_sf numeric; target_weight numeric;
begin
  if basis not in('total_weight','weight_per_sf') then raise exception 'Invalid Sample formulation basis.' using errcode='22023'; end if;
  if unit not in('in','ft') then raise exception 'Invalid Sample dimension unit.' using errcode='22023'; end if;
  if resin_parts is null or resin_parts<=0 or hardener_parts is null or hardener_parts<=0 or (resin_parts<>5 and resin_parts<>4) or hardener_parts<>1 then raise exception 'Resin : Hardener ratio must be 5:1 or 4:1.' using errcode='22023'; end if;
  if length_value is not null and width_value is not null then area_sf:=length_value*width_value*(case when unit='in' then 1::numeric/144 else 1 end); end if;
  target_weight:=case when basis='total_weight' then total_weight when area_sf is not null and rate is not null then area_sf*rate end;
  return jsonb_build_object('basis',basis,'weightUnit','lb','totalWeight',coalesce(p_state->>'totalWeight',''),'length',coalesce(p_state->>'length',''),'width',coalesce(p_state->>'width',''),'dimensionUnit',unit,'weightPerSf',coalesce(p_state->>'weightPerSf',''),'resinParts',trim(trailing '.' from trim(trailing '0' from resin_parts::text)),'hardenerParts',trim(trailing '.' from trim(trailing '0' from hardener_parts::text)),'defaultVersion',case when coalesce(p_state->>'defaultVersion','')~'^[0-9]+$' then (p_state->>'defaultVersion')::integer end,'calculationVersion','sample-formulation-v1','derived',jsonb_build_object('areaSf',area_sf,'targetWeight',target_weight));
end $$;

create function public.get_sample_formulation_default()
returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
  select jsonb_build_object('version',version,'resinParts',resin_parts::text,'hardenerParts',hardener_parts::text) from public.sample_formulation_defaults where public.has_app_capability('readOperationalData') order by version desc limit 1
$$;
create function public.set_sample_formulation_default(p_resin_parts numeric,p_hardener_parts numeric)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_users%rowtype; created public.sample_formulation_defaults%rowtype;
begin
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active and role in('admin','developer');
  if p_resin_parts not in(4,5) or p_hardener_parts<>1 then raise exception 'Supported Sample ratios are 5:1 and 4:1.' using errcode='22023'; end if;
  insert into public.sample_formulation_defaults(resin_parts,hardener_parts,created_by_user_id) values(p_resin_parts,p_hardener_parts,actor.user_id) returning * into created;
  return jsonb_build_object('version',created.version,'resinParts',created.resin_parts::text,'hardenerParts',created.hardener_parts::text);
exception when no_data_found then raise exception 'Sample formulation default management requires an active Admin or Developer.' using errcode='42501';
end $$;

create or replace function public.create_sample(p_bid_id uuid default null,p_job_id uuid default null)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_users%rowtype; created_id uuid:=gen_random_uuid(); linked_bid public.bids%rowtype; linked_job public.jobs%rowtype; defaults public.sample_formulation_defaults%rowtype;
begin
  perform public.require_app_capability('readOperationalData'); select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  if p_bid_id is not null then select * into strict linked_bid from public.bids where id=p_bid_id; end if; if p_job_id is not null then select * into strict linked_job from public.jobs where id=p_job_id; end if;
  select * into strict defaults from public.sample_formulation_defaults order by version desc limit 1;
  insert into public.samples(id,bid_id,job_id,requested_by,project_name,prepared_by,customer_name,formulation_state,created_by_user_id) values(created_id,p_bid_id,p_job_id,'',coalesce(linked_bid.project_name,linked_job.name,''),actor.display_name,coalesce(linked_bid.customer,linked_job.customer,''),public.normalize_sample_formulation(jsonb_build_object('basis','total_weight','weightUnit','lb','dimensionUnit','in','resinParts',defaults.resin_parts,'hardenerParts',defaults.hardener_parts,'defaultVersion',defaults.version)),actor.user_id);
  insert into public.sample_blend_rows(sample_id,display_order) values(created_id,0); return created_id;
end $$;

create or replace function public.save_sample_draft(p_sample jsonb,p_rows jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare target_id uuid:=(p_sample->>'id')::uuid; color_plate text:=nullif(upper(btrim(coalesce(p_sample->>'color_plate_number',''))),''); normalized jsonb:=public.normalize_sample_formulation(coalesce(p_sample->'formulation_state','{}'::jsonb)); target_weight numeric; resin_effective numeric; ratio numeric;
begin
  perform public.require_app_capability('readOperationalData'); perform 1 from public.app_users where user_id=auth.uid() and is_active; if not found then raise exception 'Active operational access is required.' using errcode='42501'; end if;
  if not exists(select 1 from public.samples where id=target_id for update) then raise exception 'Sample not found.' using errcode='P0002'; end if;
  if color_plate is not null and color_plate !~ '^T[0-9]{2}-[0-9]{3}[A-Z]$' then raise exception 'New Color Plate numbers must use TYY-NNNL format, for example T26-123A.' using errcode='22023'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>200 then raise exception 'Invalid Sample formulation rows.' using errcode='22023'; end if;
  if nullif(p_sample->>'bid_id','') is not null and not exists(select 1 from public.bids where id=(p_sample->>'bid_id')::uuid) then raise exception 'Bid not found.' using errcode='P0002'; end if;
  if nullif(p_sample->>'job_id','') is not null and not exists(select 1 from public.jobs where id=(p_sample->>'job_id')::uuid) then raise exception 'Production Job not found.' using errcode='P0002'; end if;
  update public.samples set bid_id=nullif(p_sample->>'bid_id','')::uuid,job_id=nullif(p_sample->>'job_id','')::uuid,requested_by=left(coalesce(p_sample->>'requested_by',''),200),requested_date=coalesce(nullif(p_sample->>'requested_date','')::date,current_date),project_name=left(coalesce(p_sample->>'project_name',''),300),prepared_by=left(coalesce(p_sample->>'prepared_by',''),200),customer_name=left(coalesce(p_sample->>'customer_name',''),200),color_plate_number=color_plate,finish_requested=left(coalesce(p_sample->>'finish_requested',''),300),sample_size=left(coalesce(p_sample->>'sample_size',''),100),sample_quantity=left(coalesce(p_sample->>'sample_quantity',''),100),notes=left(coalesce(p_sample->>'notes',''),20000),filler=left(coalesce(p_sample->>'filler',''),300),sealer=left(coalesce(p_sample->>'sealer',''),300),resin_supplier=left(coalesce(p_sample->>'resin_supplier',''),300),resin_color_number=left(coalesce(p_sample->>'resin_color_number',''),300),more_notes=left(coalesce(p_sample->>'more_notes',''),20000),approved_date=nullif(p_sample->>'approved_date','')::date,formulation_state=normalized where id=target_id;
  target_weight:=public.sample_nonnegative_numeric(normalized#>>'{derived,targetWeight}'); ratio:=(normalized->>'hardenerParts')::numeric/(normalized->>'resinParts')::numeric;
  delete from public.sample_blend_rows where sample_id=target_id;
  insert into public.sample_blend_rows(sample_id,display_order,percentage,color,size,material_type,quantity,unit,vendor,catalog_source,catalog_item_id,catalog_snapshot,component_role,calculation_basis,quantity_provenance,calculated_quantity)
  select target_id,ordinality-1,nullif(row_data->>'percentage','')::numeric,left(coalesce(row_data->>'color',''),300),left(coalesce(row_data->>'size',''),120),left(coalesce(row_data->>'material_type',''),200),case when coalesce(row_data->>'quantity_provenance','manual')='manual' then nullif(row_data->>'quantity','')::numeric when coalesce(row_data->>'calculation_basis','')='target_total' and target_weight is not null then target_weight*nullif(row_data->>'percentage','')::numeric/100 end,left(coalesce(nullif(row_data->>'unit',''),'lb'),80),left(coalesce(row_data->>'vendor',''),300),nullif(row_data->>'catalog_source',''),nullif(row_data->>'catalog_item_id',''),coalesce(row_data->'catalog_snapshot','{}'::jsonb),coalesce(nullif(row_data->>'component_role',''),'aggregate'),nullif(row_data->>'calculation_basis',''),coalesce(nullif(row_data->>'quantity_provenance',''),'manual'),case when coalesce(row_data->>'calculation_basis','')='target_total' and target_weight is not null then target_weight*nullif(row_data->>'percentage','')::numeric/100 end from jsonb_array_elements(p_rows) with ordinality as rows(row_data,ordinality);
  select coalesce(quantity,calculated_quantity) into resin_effective from public.sample_blend_rows where sample_id=target_id and component_role='resin' order by display_order limit 1;
  update public.sample_blend_rows set calculated_quantity=resin_effective*ratio,quantity=resin_effective*ratio where sample_id=target_id and component_role='hardener' and quantity_provenance='calculated' and resin_effective is not null;
end $$;

create or replace function public.duplicate_sample(p_sample_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_users%rowtype; created_id uuid:=gen_random_uuid(); source public.samples%rowtype;
begin
  perform public.require_app_capability('readOperationalData'); select * into strict actor from public.app_users where user_id=auth.uid() and is_active; select * into strict source from public.samples where id=p_sample_id;
  insert into public.samples(id,bid_id,job_id,requested_by,requested_date,project_name,prepared_by,customer_name,color_plate_number,finish_requested,sample_size,sample_quantity,notes,filler,sealer,resin_supplier,resin_color_number,more_notes,approved_date,formulation_state,created_by_user_id) values(created_id,source.bid_id,source.job_id,source.requested_by,current_date,source.project_name,actor.display_name,source.customer_name,null,source.finish_requested,source.sample_size,source.sample_quantity,source.notes,source.filler,source.sealer,source.resin_supplier,source.resin_color_number,source.more_notes,null,source.formulation_state,actor.user_id);
  insert into public.sample_blend_rows(sample_id,display_order,percentage,color,size,material_type,quantity,unit,vendor,catalog_source,catalog_item_id,catalog_snapshot,component_role,calculation_basis,quantity_provenance,calculated_quantity) select created_id,display_order,percentage,color,size,material_type,quantity,unit,vendor,catalog_source,catalog_item_id,catalog_snapshot,component_role,calculation_basis,quantity_provenance,calculated_quantity from public.sample_blend_rows where sample_id=p_sample_id order by display_order; return created_id;
end $$;

create or replace function public.list_samples(p_bid_id uuid default null)
returns table(sample jsonb) language sql stable security definer set search_path=pg_catalog,public as $$
  select to_jsonb(s)||jsonb_build_object(
    'creator_name',creator.display_name,
    'job_number',j.job_number,
    'blend_rows',(select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.display_order),'[]'::jsonb) from public.sample_blend_rows row_data where row_data.sample_id=s.id),
    'working_versions',(select coalesce(jsonb_agg(to_jsonb(version_data)||jsonb_build_object('saved_by_name',saver.display_name) order by version_data.version_number desc),'[]'::jsonb) from public.sample_working_versions version_data join public.app_users saver on saver.user_id=version_data.saved_by_user_id where version_data.sample_id=s.id),
    'issued_documents',(select coalesce(jsonb_agg(to_jsonb(document) order by document.issue_number desc),'[]'::jsonb) from public.sample_issued_documents document where document.sample_id=s.id)
  )
  from public.samples s join public.app_users creator on creator.user_id=s.created_by_user_id left join public.jobs j on j.id=s.job_id
  where public.has_app_capability('readOperationalData') and (p_bid_id is null or s.bid_id=p_bid_id)
  order by s.updated_at desc,s.id
$$;

create function public.save_sample_working_version(p_sample_id uuid,p_note text default null)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_users%rowtype; target public.samples%rowtype; created_id uuid:=gen_random_uuid(); next_version integer; snapshot jsonb;
begin
  perform public.require_app_capability('readOperationalData'); select * into strict actor from public.app_users where user_id=auth.uid() and is_active; select * into strict target from public.samples where id=p_sample_id for update;
  select coalesce(max(version_number),0)+1 into next_version from public.sample_working_versions where sample_id=p_sample_id;
  snapshot:=to_jsonb(target)||jsonb_build_object('job_number',(select job_number from public.jobs where id=target.job_id),'blend_rows',(select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.display_order),'[]'::jsonb) from public.sample_blend_rows row_data where row_data.sample_id=target.id),'working_version_number',next_version,'working_version_saved_at',clock_timestamp(),'working_version_saved_by_name',actor.display_name,'render_context','working');
  insert into public.sample_working_versions(id,sample_id,version_number,version_note,version_snapshot,saved_by_user_id) values(created_id,p_sample_id,next_version,left(coalesce(p_note,''),200),snapshot,actor.user_id); return created_id;
end $$;

create function public.restore_sample_working_version(p_sample_id uuid,p_version_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare current_sample public.samples%rowtype; source public.sample_working_versions%rowtype; restored jsonb;
begin
  perform public.require_app_capability('readOperationalData'); perform 1 from public.app_users where user_id=auth.uid() and is_active; if not found then raise exception 'Active operational access is required.' using errcode='42501'; end if;
  select * into strict current_sample from public.samples where id=p_sample_id for update; select * into strict source from public.sample_working_versions where id=p_version_id and sample_id=p_sample_id;
  restored:=source.version_snapshot||jsonb_build_object('id',current_sample.id,'bid_id',current_sample.bid_id,'job_id',current_sample.job_id,'project_name',current_sample.project_name,'customer_name',current_sample.customer_name,'prepared_by',current_sample.prepared_by,'color_plate_number',current_sample.color_plate_number,'approved_date',current_sample.approved_date);
  perform public.save_sample_draft(restored,coalesce(source.version_snapshot->'blend_rows','[]'::jsonb));
end $$;

create function public.get_sample_working_pdf_snapshot(p_sample_id uuid,p_version_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare target public.samples%rowtype; snapshot jsonb;
begin
  perform public.require_app_capability('readOperationalData'); perform 1 from public.app_users where user_id=auth.uid() and is_active; if not found then raise exception 'Active operational access is required.' using errcode='42501'; end if;
  if p_version_id is not null then select version_snapshot into strict snapshot from public.sample_working_versions where id=p_version_id and sample_id=p_sample_id; return snapshot||jsonb_build_object('render_context','working'); end if;
  select * into strict target from public.samples where id=p_sample_id;
  return to_jsonb(target)||jsonb_build_object('job_number',(select job_number from public.jobs where id=target.job_id),'blend_rows',(select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.display_order),'[]'::jsonb) from public.sample_blend_rows row_data where row_data.sample_id=target.id),'render_context','working');
end $$;

create or replace function public.issue_sample_form(p_sample_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_users%rowtype; target public.samples%rowtype; issued_id uuid:=gen_random_uuid(); next_issue integer; snapshot jsonb;
begin
  perform public.require_app_capability('readOperationalData'); select * into strict actor from public.app_users where user_id=auth.uid() and is_active; select * into strict target from public.samples where id=p_sample_id for update;
  if btrim(target.prepared_by)='' then raise exception 'Prepared By is required to issue a Sample Form.' using errcode='22023'; end if;
  select coalesce(max(issue_number),0)+1 into next_issue from public.sample_issued_documents where sample_id=p_sample_id;
  snapshot:=to_jsonb(target)||jsonb_build_object('job_number',(select job_number from public.jobs where id=target.job_id),'blend_rows',(select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.display_order),'[]'::jsonb) from public.sample_blend_rows row_data where row_data.sample_id=target.id),'issue_number',next_issue,'issued_at',clock_timestamp(),'issued_by_name',actor.display_name,'render_context','issued');
  insert into public.sample_issued_documents(id,sample_id,issue_number,issued_snapshot,issued_by_user_id,document_version) values(issued_id,p_sample_id,next_issue,snapshot,actor.user_id,'sample-work-order-pdf-v3-formulation'); return issued_id;
end $$;

alter function public.sample_nonnegative_numeric(text) owner to postgres;
alter function public.normalize_sample_formulation(jsonb) owner to postgres;
alter function public.get_sample_formulation_default() owner to postgres;
alter function public.set_sample_formulation_default(numeric,numeric) owner to postgres;
alter function public.save_sample_working_version(uuid,text) owner to postgres;
alter function public.restore_sample_working_version(uuid,uuid) owner to postgres;
alter function public.get_sample_working_pdf_snapshot(uuid,uuid) owner to postgres;
revoke all on function public.sample_nonnegative_numeric(text),public.normalize_sample_formulation(jsonb),public.get_sample_formulation_default(),public.set_sample_formulation_default(numeric,numeric) from public,anon;
grant execute on function public.get_sample_formulation_default(),public.set_sample_formulation_default(numeric,numeric) to authenticated,service_role;
revoke all on function public.save_sample_working_version(uuid,text),public.restore_sample_working_version(uuid,uuid),public.get_sample_working_pdf_snapshot(uuid,uuid) from public,anon;
grant execute on function public.save_sample_working_version(uuid,text),public.restore_sample_working_version(uuid,uuid),public.get_sample_working_pdf_snapshot(uuid,uuid) to authenticated,service_role;
grant execute on function public.sample_nonnegative_numeric(text),public.normalize_sample_formulation(jsonb) to service_role;

comment on column public.samples.formulation_state is 'Captured Sample-specific inputs, effective ratio/default version, calculation version, and authoritative derived totals.';
comment on column public.sample_blend_rows.calculation_basis is 'Explicit opt-in percentage denominator. Null means no formula basis is assumed.';
comment on table public.sample_working_versions is 'Immutable non-issued Sample formulation checkpoints. They do not carry issued-document hashes or imply approval.';
commit;
