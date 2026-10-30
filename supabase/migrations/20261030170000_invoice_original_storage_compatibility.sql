-- Forward-only corrections discovered by actual Supabase Storage validation.
-- 150000 remains byte-for-byte frozen. No Inventory/canonical write changes.
begin;
set local lock_timeout='3s';set local statement_timeout='30s';

-- Expired raw extraction/review state must not escape through direct SELECT.
-- Owner cleanup RPCs may still return non-sensitive lifecycle/path metadata.
alter policy invoice_sources_owner_read on public.invoice_receival_sources using(owner_user_id=auth.uid() and public.has_app_capability('readOperationalData') and public.has_app_capability('writeBusinessData') and public.has_app_capability('adjustInventory') and (lifecycle_state='retained' or expires_at>clock_timestamp()));

create or replace function public.begin_invoice_receival_source(p_filename text,p_content_type text,p_byte_size bigint,p_sha256 text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare source public.invoice_receival_sources; ident uuid:=gen_random_uuid();
begin
 perform public.tenbot_lock_invoice_actor();perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');perform public.require_app_capability('adjustInventory');
 if p_filename is null or length(p_filename) not between 1 and 255 or p_filename ~ '[[:cntrl:]]' or p_content_type not in('application/pdf','image/jpeg','image/png') or p_byte_size is null or p_byte_size not between 1 and 12000000 or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'Valid bounded original invoice metadata required.' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,427906));
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_sha256,427905));
 select * into source from public.invoice_receival_sources s where s.owner_user_id=auth.uid() and s.sha256=p_sha256 and s.lifecycle_state<>'deleted';
 if found then
  if source.byte_size<>p_byte_size or source.content_type<>p_content_type then raise exception 'Original digest metadata conflicts.' using errcode='22023';end if;
  if source.lifecycle_state='deleting' or source.expires_at<=clock_timestamp() and source.lifecycle_state<>'retained' then raise exception 'Expired source cleanup must finish before retry.' using errcode='22023';end if;
  return public.tenbot_invoice_source_json(source);
 end if;
 if (select count(*) from public.invoice_receival_sources s where s.owner_user_id=auth.uid() and s.lifecycle_state in('uploading','ready','deleting'))>=20 then raise exception 'Finish or clean up pending invoice uploads before adding another.' using errcode='54000';end if;
 insert into public.invoice_receival_sources(id,owner_user_id,original_filename,content_type,byte_size,sha256,storage_path)
 values(ident,auth.uid(),p_filename,p_content_type,p_byte_size,p_sha256,auth.uid()::text||'/'||ident::text||'/original') returning * into source;
 return public.tenbot_invoice_source_json(source);
end $$;

create or replace function public.record_invoice_receival_source_state(p_actor uuid,p_source_id uuid,p_expected_version integer,p_verified_sha256 text,p_state jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,storage as $$
declare source public.invoice_receival_sources; actor public.app_users; row jsonb; extraction text; evidence_hash text; stable_keys text[]:=array['version','originalSha256','visionSha256','rawLines','document']; object_metadata jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Source verification is server-only.' using errcode='42501';end if;
 select * into actor from public.app_users where user_id=p_actor for share;
 lock table public.app_role_capabilities in share mode;
 if actor.user_id is null or not actor.is_active or actor.read_only or exists(select 1 from unnest(array['readOperationalData','writeBusinessData','adjustInventory']) required(capability) where not exists(select 1 from public.app_role_capabilities c where c.role=actor.role and c.capability=required.capability)) then raise exception 'Current source owner permissions required.' using errcode='42501';end if;
 select * into source from public.invoice_receival_sources s where s.id=p_source_id and s.owner_user_id=p_actor for update;
 if not found or source.lifecycle_state not in('uploading','ready') or source.expires_at<=clock_timestamp() or source.version is distinct from p_expected_version or source.sha256 is distinct from p_verified_sha256 then raise exception 'Current exact original source required.' using errcode='22023';end if;
 if jsonb_typeof(p_state) is distinct from 'object' or pg_column_size(p_state)>262144 or p_state->>'version' is distinct from 'invoice-receival-state.v1' or p_state->>'originalSha256' is distinct from source.sha256 or coalesce(p_state->>'visionSha256','') !~ '^[a-f0-9]{64}$'
  or (p_state-array['version','originalSha256','visionSha256','rawLines','sourceRows','draft','traceHash','document'])<>'{}'::jsonb
  or jsonb_typeof(p_state->'rawLines') is distinct from 'array' or jsonb_array_length(p_state->'rawLines') not between 1 and 80
  or jsonb_typeof(p_state->'sourceRows') is distinct from 'array' or jsonb_array_length(p_state->'sourceRows') not between 0 and 80
  or coalesce(jsonb_typeof(p_state->'draft'),'null') not in('object','null') or p_state->>'traceHash' is not null and p_state->>'traceHash' !~ '^[a-f0-9]{64}$'
  or coalesce(jsonb_typeof(p_state->'document'),'null') not in('object','null') then raise exception 'Bounded server-authored source evidence required.' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_state->'rawLines') line where jsonb_typeof(line)<>'string' or length(line#>>'{}')>1000) then raise exception 'Bounded invoice transcription required.' using errcode='22023';end if;
 for row in select value from jsonb_array_elements(p_state->'sourceRows') loop
  if jsonb_typeof(row) is distinct from 'object' or (row-array['lineId','sourceText','sourceQuantity'])<>'{}'::jsonb or length(coalesce(row->>'lineId','')) not between 1 and 160 or length(coalesce(row->>'sourceText','')) not between 1 and 2000 or coalesce(row->>'lineId','') !~ ('^'||source.id::text||':L[1-9][0-9]*$')
   or coalesce(jsonb_typeof(row->'sourceQuantity'),'null') not in('object','null')
   or jsonb_typeof(row->'sourceQuantity')='object' and (((row->'sourceQuantity')-array['quantity','unit'])<>'{}'::jsonb or jsonb_typeof(row->'sourceQuantity'->'quantity') is distinct from 'string' or jsonb_typeof(row->'sourceQuantity'->'unit') is distinct from 'string' or length(row->'sourceQuantity'->>'quantity') not between 1 and 30 or length(row->'sourceQuantity'->>'unit') not between 1 and 40)
  then raise exception 'Exact bounded source rows required.' using errcode='22023';end if;
  if substring(row->>'lineId' from ':L([0-9]+)$')::integer>jsonb_array_length(p_state->'rawLines') or row->>'sourceText' is distinct from p_state->'rawLines'->>(substring(row->>'lineId' from ':L([0-9]+)$')::integer-1) then raise exception 'Source rows must match the verified transcription exactly.' using errcode='22023';end if;
 end loop;
 if (select count(distinct value->>'lineId') from jsonb_array_elements(p_state->'sourceRows'))<>jsonb_array_length(p_state->'sourceRows') then raise exception 'Unique source line identities required.' using errcode='22023';end if;
 if source.agent_state is not null and jsonb_array_length(source.agent_state->'sourceRows')>0 and source.agent_state->'sourceRows' is distinct from p_state->'sourceRows' then raise exception 'Verified source quantities cannot be replaced.' using errcode='22023';end if;
 if source.agent_state is not null and exists(select 1 from unnest(stable_keys) k where source.agent_state->k is distinct from p_state->k) then raise exception 'Verified extraction and original evidence cannot be replaced.' using errcode='22023';end if;
 select string_agg(value#>>'{}',E'\n' order by ord) into extraction from jsonb_array_elements(p_state->'rawLines') with ordinality r(value,ord);
 evidence_hash:=encode(sha256(convert_to(extraction,'UTF8')),'hex');
 select o.metadata into object_metadata from storage.objects o where o.bucket_id='invoice-receival-originals' and o.name=source.storage_path;
 if object_metadata is null or coalesce(object_metadata->>'size','') !~ '^[0-9]+$' or (object_metadata->>'size')::bigint<>source.byte_size or object_metadata->>'mimetype' is distinct from source.content_type then raise exception 'Exact uploaded original object required.' using errcode='22023';end if;
 update public.invoice_receival_sources set lifecycle_state='ready',agent_state=p_state,evidence_sha256=evidence_hash,verified_at=coalesce(verified_at,clock_timestamp()),version=version+1 where id=source.id returning * into source;
 return public.tenbot_invoice_source_json(source);
end $$;

create or replace function public.invoice_receival_original_allowed(p_path text,p_operation text) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select (auth.role()='authenticated' and auth.uid() is not null and public.has_app_capability('readOperationalData') and public.has_app_capability('writeBusinessData') and public.has_app_capability('adjustInventory') and exists(select 1 from public.invoice_receival_sources s where s.storage_path=p_path and s.owner_user_id=auth.uid() and case p_operation when 'read' then s.lifecycle_state in('uploading','ready','retained','deleting') and (s.lifecycle_state='retained' or s.expires_at>clock_timestamp()) when 'insert' then s.lifecycle_state='uploading' and s.expires_at>clock_timestamp() when 'delete' then s.lifecycle_state='deleting' and s.retained_draft_id is null else false end))
 or (auth.role()='service_role' and p_operation='delete' and exists(select 1 from public.invoice_receival_sources s where s.storage_path=p_path and s.lifecycle_state='deleting' and s.expires_at<=clock_timestamp() and s.retained_draft_id is null and not exists(select 1 from public.invoice_receival_executions e join public.invoice_receival_source_bindings b on b.draft_id=e.draft_id where b.source_id=s.id)))
$$;

create or replace function public.guard_invoice_receival_original_object() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare source public.invoice_receival_sources; backend boolean:=session_user='supabase_storage_admin' and auth.role()='service_role' and auth.uid() is null; actor public.app_users;
begin
 if tg_op='INSERT' and new.bucket_id='invoice-receival-originals' then
  if public.invoice_receival_original_allowed(new.name,'insert') then return new;end if;
  -- The real Storage API probes RLS with the signed employee, then persists
  -- bytes/metadata in its internal storage-admin session. That trusted second
  -- phase must retain the original owner's ID and exact generated manifest.
  select * into source from public.invoice_receival_sources s where s.storage_path=new.name for update;
  select * into actor from public.app_users u where u.user_id=source.owner_user_id for share;
  lock table public.app_role_capabilities in share mode;
  if not backend or source.id is null or source.lifecycle_state<>'uploading' or source.expires_at<=clock_timestamp() or new.owner_id is distinct from source.owner_user_id::text
   or actor.user_id is null or not actor.is_active or actor.read_only
   or exists(select 1 from unnest(array['readOperationalData','writeBusinessData','adjustInventory']) required(capability) where not exists(select 1 from public.app_role_capabilities c where c.role=actor.role and c.capability=required.capability))
   or coalesce(new.metadata->>'size','') !~ '^[0-9]+$' or (new.metadata->>'size')::bigint<>source.byte_size or new.metadata->>'mimetype' is distinct from source.content_type
  then raise exception 'Exact owned Storage original upload required.' using errcode='42501';end if;
  return new;
 end if;
 if tg_op='UPDATE' and (old.bucket_id='invoice-receival-originals' or new.bucket_id='invoice-receival-originals') then raise exception 'Original invoice cannot be replaced.' using errcode='42501';end if;
 if tg_op='DELETE' and old.bucket_id='invoice-receival-originals' then
  select * into source from public.invoice_receival_sources s where s.storage_path=old.name for update;
  -- Deletion was authorized either by the owner explicitly abandoning and
  -- revoking its drafts, or by the fixed expired-source maintenance claim.
  -- Both become state=deleting before Storage performs its internal DELETE.
  if source.id is null or source.lifecycle_state<>'deleting' or source.retained_draft_id is not null
   or exists(select 1 from public.invoice_receival_executions e join public.invoice_receival_source_bindings b on b.draft_id=e.draft_id where b.source_id=source.id)
   or not(public.invoice_receival_original_allowed(old.name,'delete') or backend and old.owner_id is not distinct from source.owner_user_id::text)
  then raise exception 'Retained or unauthorized invoice original cannot be removed.' using errcode='42501';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;

notify pgrst,'reload schema';
commit;
