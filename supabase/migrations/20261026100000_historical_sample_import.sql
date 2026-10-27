-- Local candidate only. Immutable originals and explicit verified formulation captures.
begin;
create table public.historical_sample_imports (
 id uuid primary key default gen_random_uuid(),
 created_by uuid not null references public.app_users(user_id),
 created_at timestamptz not null default clock_timestamp(),
 filename text not null check(length(filename) between 1 and 255),
 content_type text not null check(content_type in ('application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')),
 byte_size bigint not null check(byte_size between 1 and 20971520),
 storage_path text not null unique,
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 extraction jsonb not null,
 sample_id uuid unique references public.samples(id) on delete restrict,
 transcribed_at timestamptz
);
create table public.historical_sample_verifications (
 id uuid primary key default gen_random_uuid(),
 import_id uuid not null references public.historical_sample_imports(id) on delete restrict,
 sample_id uuid not null references public.samples(id) on delete restrict,
 verified_by uuid not null references public.app_users(user_id),
 verified_at timestamptz not null default clock_timestamp(),
 evidence text not null check(length(btrim(evidence)) between 1 and 10000),
 snapshot jsonb not null
);
create function public.intake_capture_immutable() returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin raise exception 'Historical and accepted captures are immutable; create a new revision.' using errcode='55000'; end $$;
create trigger historical_verification_immutable before update or delete on public.historical_sample_verifications for each row execute function public.intake_capture_immutable();
alter table public.historical_sample_imports enable row level security;
alter table public.historical_sample_verifications enable row level security;
revoke all on public.historical_sample_imports,public.historical_sample_verifications from public,anon,authenticated;
grant select on public.historical_sample_imports,public.historical_sample_verifications to authenticated;
grant all on public.historical_sample_imports,public.historical_sample_verifications to service_role;
create policy historical_import_read on public.historical_sample_imports for select to authenticated using(public.has_app_capability('readOperationalData'));
create policy historical_verification_read on public.historical_sample_verifications for select to authenticated using(public.has_app_capability('readOperationalData'));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('historical-samples','historical-samples',false,20971520,array['application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
create policy historical_sample_original_read on storage.objects for select to authenticated using(bucket_id='historical-samples' and public.has_app_capability('readOperationalData') and exists(select 1 from public.historical_sample_imports i where i.storage_path=name));
create policy historical_sample_original_insert on storage.objects for insert to authenticated with check(bucket_id='historical-samples' and public.has_app_capability('writeBusinessData') and public.has_app_capability('readOperationalData') and exists(select 1 from public.historical_sample_imports i where i.storage_path=name and i.created_by=auth.uid() and i.sample_id is null));
-- Deliberately no UPDATE/DELETE policies: evidence cannot be replaced after upload.
create function public.begin_historical_sample_import(p_filename text,p_content_type text,p_byte_size bigint,p_sha256 text,p_extraction jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare result public.historical_sample_imports; ident uuid:=gen_random_uuid();
begin
 perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');
 if pg_column_size(p_extraction)>1048576 then raise exception 'Extraction is too large';end if;
 insert into public.historical_sample_imports(id,created_by,filename,content_type,byte_size,storage_path,sha256,extraction)
 values(ident,auth.uid(),p_filename,p_content_type,p_byte_size,ident::text||'/original',p_sha256,p_extraction) returning * into result;
 return to_jsonb(result);
end $$;
create function public.complete_historical_sample_import(p_import_id uuid,p_sample jsonb,p_rows jsonb,p_sample_name text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare original public.historical_sample_imports; plate text; result jsonb;
begin
 perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');
 select * into strict original from public.historical_sample_imports where id=p_import_id for update;
 if original.created_by<>auth.uid() then raise exception 'Import belongs to another account' using errcode='42501';end if;
 if original.sample_id is not null then return original.sample_id;end if;
 if not exists(select 1 from storage.objects where bucket_id='historical-samples' and name=original.storage_path) then raise exception 'Upload original evidence before saving';end if;
 plate:=upper(btrim(p_sample->>'color_plate_number'));
 if plate is null or plate!~'^T[0-9]{2}-[0-9]{3,}-?[A-Z]$' then raise exception 'Review the full historical Plate identity';end if;
 perform pg_advisory_xact_lock(761006,1900);
 if exists(select 1 from public.samples where regexp_replace(upper(color_plate_number),'-','','g')=regexp_replace(plate,'-','','g'))
 or exists(select 1 from public.sample_issued_documents where regexp_replace(upper(issued_snapshot->>'color_plate_number'),'-','','g')=regexp_replace(plate,'-','','g'))
 or exists(select 1 from public.sample_working_versions where regexp_replace(upper(version_snapshot->>'color_plate_number'),'-','','g')=regexp_replace(plate,'-','','g')) or exists(select 1 from public.production_blend_plans where regexp_replace(upper(coalesce(source_snapshot->>'color_plate_number',source_snapshot->>'colorPlateNumber')),'-','','g')=regexp_replace(plate,'-','','g'))
 or exists(select 1 from public.historical_sample_verifications where regexp_replace(upper(snapshot->>'color_plate_number'),'-','','g')=regexp_replace(plate,'-','','g')) then raise exception 'Plate already exists. Open the existing record; imports never overwrite.' using errcode='23505';end if;
 if to_regclass('public.bid_scope_captures') is not null then
  if exists(select 1 from public.bid_scope_captures c cross join lateral jsonb_array_elements(c.sources) source where regexp_replace(upper(coalesce(source->>'color_plate_number',source->>'colorPlateNumber')),'-','','g')=regexp_replace(plate,'-','','g')) then raise exception 'Plate already exists in accepted scope history' using errcode='23505';end if;
 end if;
 if nullif(p_sample->>'id','') is not null or nullif(p_sample->>'job_id','') is not null then raise exception 'Historical import must create a standalone Sample';end if;
 result:=public.create_sample_with_formulation(p_sample||jsonb_build_object('color_plate_number',plate,'approved_date',null),p_rows,p_sample_name,false);
 update public.historical_sample_imports set sample_id=(result->>'id')::uuid,transcribed_at=clock_timestamp() where id=p_import_id;
 return (result->>'id')::uuid;
end $$;
create function public.verify_historical_sample(p_import_id uuid,p_expected_updated_at timestamptz,p_evidence text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare original public.historical_sample_imports; s public.samples; ident uuid;
begin
 perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');perform public.require_app_capability('production_blend.manage');
 select * into strict original from public.historical_sample_imports where id=p_import_id;
 select * into strict s from public.samples where id=original.sample_id for update;
 if s.updated_at is distinct from p_expected_updated_at then raise exception 'Sample changed; reload before verifying' using errcode='40001';end if;
 insert into public.historical_sample_verifications(import_id,sample_id,verified_by,evidence,snapshot)
 values(original.id,s.id,auth.uid(),p_evidence,public.get_sample_working_pdf_snapshot(s.id,null)) returning id into ident;
 return ident;
end $$;
-- Preserve original identity/digest/extraction even through privileged application writes.
create function public.protect_historical_original() returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
 if tg_op='DELETE' then raise exception 'Historical evidence is retained';end if;
 if (to_jsonb(new)-'sample_id'-'transcribed_at') is distinct from (to_jsonb(old)-'sample_id'-'transcribed_at') or old.sample_id is not null then raise exception 'Original import evidence is immutable';end if;
 return new;
end $$;
create trigger protect_historical_original before update or delete on public.historical_sample_imports for each row execute function public.protect_historical_original();
revoke all on function public.begin_historical_sample_import(text,text,bigint,text,jsonb),public.complete_historical_sample_import(uuid,jsonb,jsonb,text),public.verify_historical_sample(uuid,timestamptz,text) from public,anon;
grant execute on function public.begin_historical_sample_import(text,text,bigint,text,jsonb),public.complete_historical_sample_import(uuid,jsonb,jsonb,text),public.verify_historical_sample(uuid,timestamptz,text) to authenticated;
-- Digest is computed from stored bytes by the authenticated Edge handler.
revoke all on function public.complete_historical_sample_import(uuid,jsonb,jsonb,text) from public,anon,authenticated,service_role;
create function public.persist_historical_sample(p_actor uuid,p_import_id uuid,p_sha256 text,p_sample jsonb,p_rows jsonb,p_sample_name text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid; old_sub text:=current_setting('request.jwt.claim.sub',true);
begin
 perform set_config('request.jwt.claim.sub',p_actor::text,true);
 if not exists(select 1 from public.historical_sample_imports where id=p_import_id and created_by=p_actor and sha256=p_sha256) then raise exception 'Original digest does not match evidence';end if;
 result:=public.complete_historical_sample_import(p_import_id,p_sample,p_rows,p_sample_name);
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);return result;
end $$;
revoke all on function public.persist_historical_sample(uuid,uuid,text,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.persist_historical_sample(uuid,uuid,text,jsonb,jsonb,text) to service_role;
-- Restrict evidence operations even if a legacy bucket policy is broad.
create function public.guard_historical_storage() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if tg_op='INSERT' then
  if new.bucket_id='historical-samples' and (not public.has_app_capability('writeBusinessData') or not public.has_app_capability('readOperationalData') or not exists(select 1 from public.historical_sample_imports i where i.storage_path=new.name and i.created_by=auth.uid() and i.sample_id is null)) then raise exception 'Original evidence upload denied' using errcode='42501';end if;
  return new;
 end if;
 if old.bucket_id='historical-samples' then raise exception 'Original evidence cannot be removed or replaced';end if;
 if tg_op='DELETE' then return old;end if;
 return new;
end $$;
create trigger guard_historical_sample_storage before insert or update or delete on storage.objects for each row execute function public.guard_historical_storage();
alter function public.prepare_admin_delete_sample(uuid) rename to prepare_admin_delete_sample_before_historical;
revoke all on function public.prepare_admin_delete_sample_before_historical(uuid) from public,anon,authenticated,service_role;
create function public.prepare_admin_delete_sample(p_sample_id uuid) returns table(storage_bucket text,storage_path text) language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 perform public.require_app_capability('manageUsers');
 if exists(select 1 from public.historical_sample_imports where sample_id=p_sample_id) then raise exception 'Historical Sample and original evidence are retained';end if;
 return query select * from public.prepare_admin_delete_sample_before_historical(p_sample_id);
end $$;
revoke all on function public.prepare_admin_delete_sample(uuid) from public,anon;
grant execute on function public.prepare_admin_delete_sample(uuid) to authenticated;
commit;
