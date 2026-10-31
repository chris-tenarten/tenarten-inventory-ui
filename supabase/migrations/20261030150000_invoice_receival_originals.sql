-- Local candidate: private original invoice evidence for the accepted receival flow.
-- Apply only after compatibility/security validation and separate release approval.
-- Business creation still runs the canonical caller-JWT invoice service. The one
-- service-only RPC below writes bounded source verification/state, never Inventory.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

do $preflight$ begin
 if to_regclass('public.invoice_receival_drafts') is null or to_regprocedure('public.prepare_invoice_receival_draft(jsonb,jsonb,jsonb,jsonb)') is null then raise exception 'Validated invoice-receival prerequisites required.';end if;
 if exists(select 1 from storage.buckets where id='invoice-receival-originals') then raise exception 'Invoice source bucket already exists; inspect its private policy before adoption.';end if;
end $preflight$;

create table public.invoice_receival_sources(
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references public.app_users(user_id),
 original_filename text not null check(length(original_filename) between 1 and 255 and original_filename !~ '[[:cntrl:]]'),
 content_type text not null check(content_type in('application/pdf','image/jpeg','image/png')),
 byte_size bigint not null check(byte_size between 1 and 12000000),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 storage_path text not null unique,
 lifecycle_state text not null default 'uploading' check(lifecycle_state in('uploading','ready','retained','deleting','deleted')),
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '24 hours',
 version integer not null default 0 check(version>=0),
 agent_state jsonb,
 evidence_sha256 text check(evidence_sha256 is null or evidence_sha256 ~ '^[a-f0-9]{64}$'),
 verified_at timestamptz,
 retained_at timestamptz,
 retained_draft_id uuid unique references public.invoice_receival_drafts(id),
 deleted_at timestamptz,
 check(expires_at>created_at),
 check(agent_state is null or jsonb_typeof(agent_state)='object' and pg_column_size(agent_state)<=262144),
 check((lifecycle_state='retained')=(retained_draft_id is not null and retained_at is not null)),
 check((lifecycle_state='deleted')=(deleted_at is not null))
);
create unique index invoice_source_owner_digest_live on public.invoice_receival_sources(owner_user_id,sha256) where lifecycle_state<>'deleted';
create index invoice_source_expiry on public.invoice_receival_sources(owner_user_id,expires_at) where lifecycle_state in('uploading','ready','deleting');
create table public.invoice_receival_source_bindings(
 draft_id uuid primary key references public.invoice_receival_drafts(id),
 source_id uuid not null references public.invoice_receival_sources(id),
 owner_user_id uuid not null references public.app_users(user_id),
 content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
 original_sha256 text not null check(original_sha256 ~ '^[a-f0-9]{64}$'),
 evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 bound_at timestamptz not null default clock_timestamp()
);
revoke all on public.invoice_receival_sources,public.invoice_receival_source_bindings from public,anon,authenticated,service_role;
grant select on public.invoice_receival_sources,public.invoice_receival_source_bindings to authenticated;
alter table public.invoice_receival_sources enable row level security;
alter table public.invoice_receival_source_bindings enable row level security;
create policy invoice_sources_owner_read on public.invoice_receival_sources for select to authenticated using(owner_user_id=auth.uid() and public.has_app_capability('readOperationalData') and public.has_app_capability('writeBusinessData') and public.has_app_capability('adjustInventory'));
create policy invoice_source_bindings_owner_read on public.invoice_receival_source_bindings for select to authenticated using(owner_user_id=auth.uid() and public.has_app_capability('readOperationalData') and public.has_app_capability('writeBusinessData') and public.has_app_capability('adjustInventory'));
create trigger invoice_source_bindings_immutable before update or delete on public.invoice_receival_source_bindings for each row execute function public.tenbot_invoice_immutable();

create function public.tenbot_invoice_source_guard() returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
 if tg_op='DELETE' then raise exception 'Invoice source provenance is retained.' using errcode='42501';end if;
 if old.lifecycle_state in('retained','deleted') or
  (to_jsonb(new)-array['lifecycle_state','version','agent_state','evidence_sha256','verified_at','retained_at','retained_draft_id','deleted_at']) is distinct from
  (to_jsonb(old)-array['lifecycle_state','version','agent_state','evidence_sha256','verified_at','retained_at','retained_draft_id','deleted_at'])
 then raise exception 'Original source identity is immutable.' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.tenbot_invoice_source_guard() from public,anon,authenticated,service_role;
create trigger invoice_sources_identity_guard before update or delete on public.invoice_receival_sources for each row execute function public.tenbot_invoice_source_guard();

create function public.tenbot_invoice_source_json(p_source public.invoice_receival_sources) returns jsonb language sql stable set search_path=pg_catalog as $$
 select jsonb_build_object('id',p_source.id,'ownerId',p_source.owner_user_id,'filename',p_source.original_filename,'mediaType',p_source.content_type,'byteSize',p_source.byte_size,'sha256',p_source.sha256,'storageBucket','invoice-receival-originals','storagePath',p_source.storage_path,'state',p_source.lifecycle_state,'createdAt',p_source.created_at,'expiresAt',p_source.expires_at,'version',p_source.version,'verifiedAt',p_source.verified_at,'retainedAt',p_source.retained_at,'retainedDraftId',p_source.retained_draft_id,'evidenceSha256',p_source.evidence_sha256,'agentState',case when p_source.expires_at>clock_timestamp() and p_source.lifecycle_state='ready' then p_source.agent_state else null end)
$$;
revoke all on function public.tenbot_invoice_source_json(public.invoice_receival_sources) from public,anon,authenticated,service_role;

create function public.begin_invoice_receival_source(p_filename text,p_content_type text,p_byte_size bigint,p_sha256 text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare source public.invoice_receival_sources; ident uuid:=gen_random_uuid();
begin
 perform public.tenbot_lock_invoice_actor();perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');perform public.require_app_capability('adjustInventory');
 if p_filename is null or length(p_filename) not between 1 and 255 or p_filename ~ '[[:cntrl:]]' or p_content_type not in('application/pdf','image/jpeg','image/png') or p_byte_size is null or p_byte_size not between 1 and 12000000 or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'Valid bounded original invoice metadata required.' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_sha256,427905));
 select * into source from public.invoice_receival_sources s where s.owner_user_id=auth.uid() and s.sha256=p_sha256 and s.lifecycle_state<>'deleted';
 if found then
  if source.byte_size<>p_byte_size or source.content_type<>p_content_type then raise exception 'Original digest metadata conflicts.' using errcode='22023';end if;
  if source.lifecycle_state='deleting' or source.expires_at<=clock_timestamp() and source.lifecycle_state<>'retained' then raise exception 'Expired source cleanup must finish before retry.' using errcode='22023';end if;
  return public.tenbot_invoice_source_json(source);
 end if;
 insert into public.invoice_receival_sources(id,owner_user_id,original_filename,content_type,byte_size,sha256,storage_path)
 values(ident,auth.uid(),p_filename,p_content_type,p_byte_size,p_sha256,auth.uid()::text||'/'||ident::text||'/original') returning * into source;
 return public.tenbot_invoice_source_json(source);
end $$;

create function public.get_invoice_receival_source(p_source_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare source public.invoice_receival_sources;
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null then raise exception 'Employee authentication required.' using errcode='42501';end if;
 perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');perform public.require_app_capability('adjustInventory');
 select * into source from public.invoice_receival_sources s where s.id=p_source_id and s.owner_user_id=auth.uid();
 if not found then raise exception 'Owned invoice source unavailable.' using errcode='P0002';end if;
 return public.tenbot_invoice_source_json(source);
end $$;

-- Only the authenticated Edge server receives this RPC capability. It verifies
-- original bytes through caller Storage access, hashes them and submits a bounded
-- evidence/review snapshot. No arbitrary actor SQL or business write is available.
create function public.record_invoice_receival_source_state(p_actor uuid,p_source_id uuid,p_expected_version integer,p_verified_sha256 text,p_state jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,storage as $$
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
   or jsonb_typeof(row->'sourceQuantity')='object' and ((row->'sourceQuantity'-array['quantity','unit'])<>'{}'::jsonb or jsonb_typeof(row->'sourceQuantity'->'quantity') is distinct from 'string' or jsonb_typeof(row->'sourceQuantity'->'unit') is distinct from 'string' or length(row->'sourceQuantity'->>'quantity') not between 1 and 30 or length(row->'sourceQuantity'->>'unit') not between 1 and 40)
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
revoke all on function public.record_invoice_receival_source_state(uuid,uuid,integer,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.record_invoice_receival_source_state(uuid,uuid,integer,text,jsonb) to service_role;

create function public.prepare_invoice_receival_draft_with_source(p_source_id uuid,p_document jsonb,p_lines jsonb,p_metadata jsonb,p_provenance jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare source public.invoice_receival_sources; line jsonb; evidence jsonb; result jsonb;
begin
 perform public.tenbot_lock_invoice_actor();perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');perform public.require_app_capability('adjustInventory');
 select * into source from public.invoice_receival_sources s where s.id=p_source_id and s.owner_user_id=auth.uid();
 if not found or source.lifecycle_state<>'ready' or source.expires_at<=clock_timestamp() or source.agent_state is null or source.sha256 is distinct from p_document->>'sha256' or source.content_type is distinct from p_provenance->>'sourceMediaType' or source.evidence_sha256 is distinct from p_provenance->>'extractionSha256' then raise exception 'Verified current original evidence required before review.' using errcode='22023';end if;
 for line in select value from jsonb_array_elements(p_lines) loop
  select value into evidence from jsonb_array_elements(source.agent_state->'sourceRows') where value->>'lineId'=line->>'sourceLineId';
  if evidence is null or evidence->>'sourceText' is distinct from line->>'sourceText' or evidence->'sourceQuantity' is distinct from line->'sourceQuantity' then raise exception 'Reviewed source quantity/text does not match verified original evidence.' using errcode='22023';end if;
 end loop;
 result:=public.prepare_invoice_receival_draft(p_document,p_lines,p_metadata,p_provenance);
 -- Canonical prepare takes prior draft locks before this source lock. Cleanup
 -- uses that same draft->source order; changed source state rolls back prepare.
 select * into source from public.invoice_receival_sources s where s.id=p_source_id and s.owner_user_id=auth.uid() for update;
 if source.lifecycle_state<>'ready' or source.expires_at<=clock_timestamp() or source.sha256 is distinct from p_document->>'sha256' then raise exception 'Original source changed while reviewing.' using errcode='22023';end if;
 insert into public.invoice_receival_source_bindings(draft_id,source_id,owner_user_id,content_hash,original_sha256,evidence_sha256) values((result->>'id')::uuid,source.id,auth.uid(),result->>'hash',source.sha256,source.evidence_sha256);
 return result||jsonb_build_object('sourceDocumentId',source.id);
end $$;

create function public.get_invoice_receival_source_for_draft(p_draft_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare source_id uuid;
begin
 perform public.get_invoice_receival_draft(p_draft_id);
 select b.source_id into source_id from public.invoice_receival_source_bindings b where b.draft_id=p_draft_id and b.owner_user_id=auth.uid();
 if source_id is null then raise exception 'Reviewed original source unavailable.' using errcode='P0002';end if;
 return public.get_invoice_receival_source(source_id);
end $$;

create function public.guard_invoice_receival_source_approval() returns trigger language plpgsql security definer set search_path=pg_catalog,public,storage as $$
declare source public.invoice_receival_sources; binding public.invoice_receival_source_bindings; draft public.invoice_receival_drafts; object_metadata jsonb;
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null or new.owner_user_id is distinct from auth.uid() then raise exception 'Explicit employee approval required.' using errcode='42501';end if;
 perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');perform public.require_app_capability('adjustInventory');
 select * into binding from public.invoice_receival_source_bindings b where b.draft_id=new.draft_id and b.owner_user_id=auth.uid();
 select * into draft from public.invoice_receival_drafts d where d.id=new.draft_id and d.owner_user_id=auth.uid();
 select * into source from public.invoice_receival_sources s where s.id=binding.source_id and s.owner_user_id=auth.uid() for update;
 if source.id is null or draft.id is null or source.lifecycle_state<>'ready' or source.expires_at<=clock_timestamp() or source.verified_at is null or binding.content_hash is distinct from new.content_hash or binding.content_hash is distinct from draft.content_hash or binding.original_sha256 is distinct from source.sha256 or binding.original_sha256 is distinct from draft.payload->'document'->>'sha256' or binding.evidence_sha256 is distinct from source.evidence_sha256 then raise exception 'Exact approved source evidence is unavailable.' using errcode='22023';end if;
 select o.metadata into object_metadata from storage.objects o where o.bucket_id='invoice-receival-originals' and o.name=source.storage_path;
 if object_metadata is null or coalesce(object_metadata->>'size','') !~ '^[0-9]+$' or (object_metadata->>'size')::bigint<>source.byte_size or object_metadata->>'mimetype' is distinct from source.content_type then raise exception 'Approved original object is missing or changed.' using errcode='22023';end if;
 if tg_table_name='invoice_receival_executions' then
  update public.invoice_receival_sources set lifecycle_state='retained',retained_draft_id=new.draft_id,retained_at=clock_timestamp(),agent_state=null,version=version+1 where id=source.id;
 end if;
 return new;
end $$;
revoke all on function public.guard_invoice_receival_source_approval() from public,anon,authenticated,service_role;
create trigger invoice_approval_original_required before insert on public.invoice_receival_approvals for each row execute function public.guard_invoice_receival_source_approval();
create trigger invoice_execution_original_retained before insert on public.invoice_receival_executions for each row execute function public.guard_invoice_receival_source_approval();

create function public.prepare_invoice_receival_source_removal(p_source_id uuid,p_abandoned boolean default false) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare source public.invoice_receival_sources; bound record;
begin
 perform public.tenbot_lock_invoice_actor();perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');perform public.require_app_capability('adjustInventory');
 -- Match execution's draft-before-source lock order and invalidate approvals
 -- before allowing Storage API cleanup of an abandoned document.
 for bound in select b.draft_id from public.invoice_receival_source_bindings b where b.source_id=p_source_id and b.owner_user_id=auth.uid() order by b.draft_id loop perform pg_advisory_xact_lock(hashtextextended(bound.draft_id::text,427901));end loop;
 select * into source from public.invoice_receival_sources s where s.id=p_source_id and s.owner_user_id=auth.uid() for update;
 if not found then raise exception 'Owned source unavailable.' using errcode='P0002';end if;
 if source.lifecycle_state='deleted' then return public.tenbot_invoice_source_json(source);end if;
 if source.lifecycle_state='retained' or exists(select 1 from public.invoice_receival_executions e join public.invoice_receival_source_bindings b on b.draft_id=e.draft_id where b.source_id=source.id) then raise exception 'Approved original business evidence is retained.' using errcode='42501';end if;
 if p_abandoned is distinct from true and source.expires_at>clock_timestamp() then raise exception 'Source has not expired; explicit abandonment required.' using errcode='22023';end if;
 for bound in select b.draft_id,b.content_hash from public.invoice_receival_source_bindings b where b.source_id=source.id and b.owner_user_id=auth.uid() order by b.draft_id loop
  perform public.revoke_invoice_receival_draft(bound.draft_id,bound.content_hash);
 end loop;
 update public.invoice_receival_sources set lifecycle_state='deleting',agent_state=null,version=version+1 where id=source.id returning * into source;
 return public.tenbot_invoice_source_json(source);
end $$;
create function public.finish_invoice_receival_source_removal(p_source_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,storage as $$
declare source public.invoice_receival_sources;
begin
 perform public.tenbot_lock_invoice_actor();perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');perform public.require_app_capability('adjustInventory');
 select * into source from public.invoice_receival_sources s where s.id=p_source_id and s.owner_user_id=auth.uid() for update;
 if not found then raise exception 'Owned source unavailable.' using errcode='P0002';end if;
 if source.lifecycle_state='deleted' then return public.tenbot_invoice_source_json(source);end if;
 if source.lifecycle_state<>'deleting' or exists(select 1 from storage.objects o where o.bucket_id='invoice-receival-originals' and o.name=source.storage_path) then raise exception 'Storage API cleanup must complete before metadata retirement.' using errcode='22023';end if;
 update public.invoice_receival_sources set lifecycle_state='deleted',deleted_at=clock_timestamp(),version=version+1 where id=source.id returning * into source;
 return public.tenbot_invoice_source_json(source);
end $$;
create function public.list_expired_invoice_receival_sources() returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null then raise exception 'Employee authentication required.' using errcode='42501';end if;
 perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');perform public.require_app_capability('adjustInventory');
 return coalesce((select jsonb_agg(public.tenbot_invoice_source_json(s)) from (select * from public.invoice_receival_sources where owner_user_id=auth.uid() and lifecycle_state in('uploading','ready','deleting') and expires_at<=clock_timestamp() order by expires_at,id limit 20) s),'[]'::jsonb);
end $$;


-- A fixed maintenance worker may retire expired, unexecuted upload objects even
-- after the original employee loses access. It cannot read object bytes or
-- select arbitrary business records; its output is only this generated path.
-- The caller must use Storage API DELETE, then acknowledge actual absence.
create function public.claim_expired_invoice_receival_sources(p_limit integer default 20) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare source public.invoice_receival_sources; claimed jsonb:='[]'::jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Source maintenance is server-only.' using errcode='42501';end if;
 if p_limit is null or p_limit not between 1 and 20 then raise exception 'Bounded maintenance limit required.' using errcode='22023';end if;
 for source in select s.* from public.invoice_receival_sources s where s.lifecycle_state in('uploading','ready','deleting') and s.expires_at<=clock_timestamp() and s.retained_draft_id is null and not exists(select 1 from public.invoice_receival_executions e join public.invoice_receival_source_bindings b on b.draft_id=e.draft_id where b.source_id=s.id) order by s.expires_at,s.id for update skip locked limit p_limit loop
  update public.invoice_receival_sources set lifecycle_state='deleting',agent_state=null,version=version+1 where id=source.id;
  claimed:=claimed||jsonb_build_array(jsonb_build_object('id',source.id,'storageBucket','invoice-receival-originals','storagePath',source.storage_path));
 end loop;
 return claimed;
end $$;
create function public.finish_expired_invoice_receival_source_removal(p_source_id uuid) returns void language plpgsql security definer set search_path=pg_catalog,public,storage as $$
declare source public.invoice_receival_sources;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Source maintenance is server-only.' using errcode='42501';end if;
 select * into source from public.invoice_receival_sources s where s.id=p_source_id for update;
 if not found then raise exception 'Expired source unavailable.' using errcode='P0002';end if;
 if source.lifecycle_state='deleted' then return;end if;
 if source.lifecycle_state<>'deleting' or source.expires_at>clock_timestamp() or source.retained_draft_id is not null or exists(select 1 from public.invoice_receival_executions e join public.invoice_receival_source_bindings b on b.draft_id=e.draft_id where b.source_id=source.id) or exists(select 1 from storage.objects o where o.bucket_id='invoice-receival-originals' and o.name=source.storage_path) then raise exception 'Only absent expired unexecuted sources may be retired.' using errcode='42501';end if;
 update public.invoice_receival_sources set lifecycle_state='deleted',deleted_at=clock_timestamp(),version=version+1 where id=source.id;
end $$;
revoke all on function public.claim_expired_invoice_receival_sources(integer),public.finish_expired_invoice_receival_source_removal(uuid) from public,anon,authenticated,service_role;
grant execute on function public.claim_expired_invoice_receival_sources(integer),public.finish_expired_invoice_receival_source_removal(uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('invoice-receival-originals','invoice-receival-originals',false,12000000,array['application/pdf','image/jpeg','image/png']);
create function public.invoice_receival_original_allowed(p_path text,p_operation text) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select (auth.role()='authenticated' and auth.uid() is not null and public.has_app_capability('readOperationalData') and public.has_app_capability('writeBusinessData') and public.has_app_capability('adjustInventory') and exists(select 1 from public.invoice_receival_sources s where s.storage_path=p_path and s.owner_user_id=auth.uid() and case p_operation when 'read' then s.lifecycle_state in('uploading','ready','retained','deleting') and (s.lifecycle_state in('retained','deleting') or s.expires_at>clock_timestamp()) when 'insert' then s.lifecycle_state='uploading' and s.expires_at>clock_timestamp() when 'delete' then s.lifecycle_state='deleting' and s.retained_draft_id is null else false end))
 or (auth.role()='service_role' and p_operation='delete' and exists(select 1 from public.invoice_receival_sources s where s.storage_path=p_path and s.lifecycle_state='deleting' and s.expires_at<=clock_timestamp() and s.retained_draft_id is null and not exists(select 1 from public.invoice_receival_executions e join public.invoice_receival_source_bindings b on b.draft_id=e.draft_id where b.source_id=s.id)))
$$;
revoke all on function public.invoice_receival_original_allowed(text,text) from public,anon,authenticated,service_role;
grant execute on function public.invoice_receival_original_allowed(text,text) to anon,authenticated;
create policy invoice_original_read on storage.objects for select to authenticated using(bucket_id='invoice-receival-originals' and public.invoice_receival_original_allowed(name,'read'));
create policy invoice_original_upload on storage.objects for insert to authenticated with check(bucket_id='invoice-receival-originals' and public.invoice_receival_original_allowed(name,'insert'));
create policy invoice_original_remove on storage.objects for delete to authenticated using(bucket_id='invoice-receival-originals' and public.invoice_receival_original_allowed(name,'delete'));
-- Restrictive guards protect this bucket even if a legacy permissive policy is
-- broadened elsewhere. UPDATE is never allowed: originals cannot be replaced.
create policy invoice_original_read_boundary on storage.objects as restrictive for select to public using(bucket_id<>'invoice-receival-originals' or public.invoice_receival_original_allowed(name,'read'));
create policy invoice_original_insert_boundary on storage.objects as restrictive for insert to public with check(bucket_id<>'invoice-receival-originals' or public.invoice_receival_original_allowed(name,'insert'));
create policy invoice_original_delete_boundary on storage.objects as restrictive for delete to public using(bucket_id<>'invoice-receival-originals' or public.invoice_receival_original_allowed(name,'delete'));
create policy invoice_original_update_boundary on storage.objects as restrictive for update to public using(bucket_id<>'invoice-receival-originals') with check(bucket_id<>'invoice-receival-originals');

-- Same immutable-original defense used by existing document buckets, scoped to
-- this bucket only. Protects against accidental privileged object replacement.
create function public.guard_invoice_receival_original_object() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if tg_op='INSERT' then
  if new.bucket_id='invoice-receival-originals' and not public.invoice_receival_original_allowed(new.name,'insert') then raise exception 'Owned original upload required.' using errcode='42501';end if;
  return new;
 end if;
 if old.bucket_id='invoice-receival-originals' or tg_op='UPDATE' and new.bucket_id='invoice-receival-originals' then
  if tg_op<>'DELETE' or not public.invoice_receival_original_allowed(old.name,'delete') then raise exception 'Original invoice cannot be replaced or removed.' using errcode='42501';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function public.guard_invoice_receival_original_object() from public,anon,authenticated,service_role;
create trigger guard_invoice_receival_original_object before insert or update or delete on storage.objects for each row execute function public.guard_invoice_receival_original_object();

revoke all on function public.begin_invoice_receival_source(text,text,bigint,text),public.get_invoice_receival_source(uuid),public.prepare_invoice_receival_draft_with_source(uuid,jsonb,jsonb,jsonb,jsonb),public.get_invoice_receival_source_for_draft(uuid),public.prepare_invoice_receival_source_removal(uuid,boolean),public.finish_invoice_receival_source_removal(uuid),public.list_expired_invoice_receival_sources() from public,anon,authenticated,service_role;
grant execute on function public.begin_invoice_receival_source(text,text,bigint,text),public.get_invoice_receival_source(uuid),public.prepare_invoice_receival_draft_with_source(uuid,jsonb,jsonb,jsonb,jsonb),public.get_invoice_receival_source_for_draft(uuid),public.prepare_invoice_receival_source_removal(uuid,boolean),public.finish_invoice_receival_source_removal(uuid),public.list_expired_invoice_receival_sources() to authenticated;
comment on table public.invoice_receival_sources is 'Private original bytes are uploaded/downloaded through caller Storage access. Server-only verified processing state expires with abandoned sources after24h; successful batches retain one immutable original, with raw agent state cleared. Cleanup must use Storage API, never SQL deletion of storage.objects. Approved originals have no delete/update policy; business retention follows existing immutable document conventions.';
notify pgrst,'reload schema';
commit;
