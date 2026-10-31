-- REVIEW CANDIDATE ONLY. Do not apply without separate Product approval.
-- Narrow source-preparation boundary; creates no grant/enrollment/funding or
-- business rows. Approval, durable business drafts, execution and cleanup retain
-- their existing stronger contracts. Applied predecessors are never edited.
begin;
set local lock_timeout='3s';set local statement_timeout='30s';

-- Eligibility is permission metadata, not an arbitrary actor/database gateway.
-- This private helper is callable only by owner-defined source functions.
create function public.tenbot_invoice_preparation_actor_allowed(p_actor uuid)
returns boolean language sql volatile security definer set search_path=pg_catalog,public as $$
 select coalesce(exists(select 1 from public.app_users u where u.user_id=p_actor
  and u.is_active and not u.read_only
  and public.tenbot_canary_user_has_capability(u.user_id,'readOperationalData')),false)
$$;
revoke all on function public.tenbot_invoice_preparation_actor_allowed(uuid)
 from public,anon,authenticated,service_role,tenbot_invoice_executor;

create function public.can_prepare_invoice_receival()
returns boolean language sql volatile security definer set search_path=pg_catalog,public as $$
 select coalesce(auth.role()='authenticated' and auth.uid() is not null
  and public.tenbot_invoice_preparation_actor_allowed(auth.uid()),false)
$$;
revoke all on function public.can_prepare_invoice_receival() from public,anon,authenticated,service_role;
grant execute on function public.can_prepare_invoice_receival() to authenticated;

-- Binding/retention checks run inside this fixed source-only helper, avoiding
-- false NOT EXISTS answers caused by the caller's stronger binding-table RLS.
create function public.tenbot_invoice_source_preparation_allowed(p_source uuid,p_actor uuid)
returns boolean language sql volatile security definer set search_path=pg_catalog,public as $$
 select coalesce(public.tenbot_invoice_preparation_actor_allowed(p_actor)
  and exists(select 1 from public.invoice_receival_sources s where s.id=p_source and s.owner_user_id=p_actor
   and s.lifecycle_state in('uploading','ready') and s.expires_at>clock_timestamp()
   and s.retained_draft_id is null and s.retained_at is null
   and not exists(select 1 from public.invoice_receival_source_bindings b where b.source_id=s.id)
   -- Only the approved synthetic original gains the weaker read-only boundary.
   and s.sha256='c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a'
   and s.content_type='application/pdf' and s.byte_size=2877),false)
$$;
revoke all on function public.tenbot_invoice_source_preparation_allowed(uuid,uuid)
 from public,anon,authenticated,service_role,tenbot_invoice_executor;

-- Public policy/RPC surface accepts only a source ID. The actor is always the
-- genuine authenticated caller; another employee's ID is never accepted.
create function public.can_read_invoice_preparation_source(p_source_id uuid)
returns boolean language sql volatile security definer set search_path=pg_catalog,public as $$
 select coalesce(auth.role()='authenticated' and auth.uid() is not null
  and public.tenbot_invoice_source_preparation_allowed(p_source_id,auth.uid()),false)
$$;
revoke all on function public.can_read_invoice_preparation_source(uuid) from public,anon,authenticated,service_role;
grant execute on function public.can_read_invoice_preparation_source(uuid) to authenticated;

-- Pin every final deployed source body, then perform exactly one occurrence of
-- each reviewed substitution. All existing hash/MIME/size/version/evidence and
-- lifecycle checks outside these permission clauses remain byte-for-byte intact.
do $source_preparation_boundary$
declare signature text;expected_body text;definition text;old_check text;new_check text;matches integer;
begin

 -- Reviewed target: begin_invoice_receival_source
 signature:='public.begin_invoice_receival_source(text,text,bigint,text)';expected_body:='da3396f856c6736e7a5bbd23239a2711';
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure(signature) and proowner='postgres'::regrole and prosecdef) is distinct from expected_body then
  raise exception 'Reviewed source contract changed: %',signature;end if;
 select pg_get_functiondef(to_regprocedure(signature)) into definition;
 old_check:=$old$perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');perform public.require_app_capability('adjustInventory');$old$;
 new_check:=$new$if not public.can_prepare_invoice_receival() then raise exception 'Current authenticated invoice preparation access required.' using errcode='42501';end if;$new$;
 matches:=(length(definition)-length(replace(definition,old_check,'')))/length(old_check);
 if matches<>1 then raise exception 'Exact reviewed source clause required: %',signature;end if;
 definition:=replace(definition,old_check,new_check);
 old_check:=$old$ perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,427906));$old$;
 new_check:=$new$ -- Read-only preparation is not general invoice-upload permission.
 if not (public.tenbot_canary_user_has_capability(auth.uid(),'writeBusinessData') and public.tenbot_canary_user_has_capability(auth.uid(),'adjustInventory'))
  and (p_sha256 is distinct from 'c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a'
   or p_content_type is distinct from 'application/pdf' or p_byte_size is distinct from 2877::bigint) then
  raise exception 'Only the approved synthetic original is available for read-only preparation.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,427906));$new$;
 matches:=(length(definition)-length(replace(definition,old_check,'')))/length(old_check);
 if matches<>1 then raise exception 'Exact reviewed source clause required: %',signature;end if;
 definition:=replace(definition,old_check,new_check);
 old_check:=$old$  return public.tenbot_invoice_source_json(source);$old$;
 new_check:=$new$  -- A hash match is not permission to reopen a retained/bound/expired original.
  if not public.can_read_invoice_preparation_source(source.id) then perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');perform public.require_app_capability('adjustInventory');end if;
  return public.tenbot_invoice_source_json(source);$new$;
 matches:=(length(definition)-length(replace(definition,old_check,'')))/length(old_check);
 if matches<>1 then raise exception 'Exact reviewed source clause required: %',signature;end if;
 definition:=replace(definition,old_check,new_check);
 execute definition;

 -- Reviewed target: get_invoice_receival_source
 signature:='public.get_invoice_receival_source(uuid)';expected_body:='10750241b1fbf4014f5db37784359479';
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure(signature) and proowner='postgres'::regrole and prosecdef) is distinct from expected_body then
  raise exception 'Reviewed source contract changed: %',signature;end if;
 select pg_get_functiondef(to_regprocedure(signature)) into definition;
 old_check:=$old$perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');perform public.require_app_capability('adjustInventory');$old$;
 new_check:=$new$if not public.can_prepare_invoice_receival() then raise exception 'Current authenticated invoice preparation access required.' using errcode='42501';end if;$new$;
 matches:=(length(definition)-length(replace(definition,old_check,'')))/length(old_check);
 if matches<>1 then raise exception 'Exact reviewed source clause required: %',signature;end if;
 definition:=replace(definition,old_check,new_check);
 old_check:=$old$ if not found then raise exception 'Owned invoice source unavailable.' using errcode='P0002';end if;$old$;
 new_check:=$new$ if not found then raise exception 'Owned invoice source unavailable.' using errcode='P0002';end if;
 if not public.can_read_invoice_preparation_source(source.id) then perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');perform public.require_app_capability('adjustInventory');end if;$new$;
 matches:=(length(definition)-length(replace(definition,old_check,'')))/length(old_check);
 if matches<>1 then raise exception 'Exact reviewed source clause required: %',signature;end if;
 definition:=replace(definition,old_check,new_check);
 execute definition;

 -- Reviewed target: record_invoice_receival_source_state
 signature:='public.record_invoice_receival_source_state(uuid,uuid,integer,text,jsonb)';expected_body:='11a16948c94741f7be2d59a510f8aa23';
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure(signature) and proowner='postgres'::regrole and prosecdef) is distinct from expected_body then
  raise exception 'Reviewed source contract changed: %',signature;end if;
 select pg_get_functiondef(to_regprocedure(signature)) into definition;
 old_check:=$old$actor.user_id is null or not actor.is_active or actor.read_only or exists(select 1 from unnest(array['readOperationalData','writeBusinessData','adjustInventory']) required(capability) where not public.tenbot_canary_user_has_capability(actor.user_id,required.capability))$old$;
 new_check:=$new$not public.tenbot_invoice_preparation_actor_allowed(actor.user_id)$new$;
 matches:=(length(definition)-length(replace(definition,old_check,'')))/length(old_check);
 if matches<>1 then raise exception 'Exact reviewed source clause required: %',signature;end if;
 definition:=replace(definition,old_check,new_check);
 old_check:=$old$ if jsonb_typeof(p_state) is distinct from 'object'$old$;
 new_check:=$new$ -- Canonical bound/retained lifecycle access retains its stronger capability rule.
 if not public.tenbot_invoice_source_preparation_allowed(source.id,p_actor)
  and not (public.tenbot_canary_user_has_capability(p_actor,'writeBusinessData') and public.tenbot_canary_user_has_capability(p_actor,'adjustInventory')) then
  raise exception 'Bound original source permissions required.' using errcode='42501';end if;
 -- Preparation state can never claim approval, execution or a durable business draft.
 if not (public.tenbot_canary_user_has_capability(p_actor,'writeBusinessData') and public.tenbot_canary_user_has_capability(p_actor,'adjustInventory'))
  and coalesce(jsonb_typeof(p_state->'draft'),'null')<>'null' and
   (jsonb_typeof(p_state->'draft') is distinct from 'object'
    or p_state->'draft'->'canApprove' is distinct from 'false'::jsonb
    or p_state->'draft'->'executionEnabled' is distinct from 'false'::jsonb
    or p_state->'draft'->'simulation' is distinct from 'false'::jsonb
    or p_state->'draft'->>'status' is distinct from 'review_required'
    or p_state->'draft' ?| array['durableDraftId','durableHash','approvalId','createdRecordIds','completed_actions']) then
  raise exception 'Non-executing preparation state required.' using errcode='42501';end if;
 if jsonb_typeof(p_state) is distinct from 'object'$new$;
 matches:=(length(definition)-length(replace(definition,old_check,'')))/length(old_check);
 if matches<>1 then raise exception 'Exact reviewed source clause required: %',signature;end if;
 definition:=replace(definition,old_check,new_check);
 execute definition;

 -- Reviewed target: invoice_receival_original_allowed
 signature:='public.invoice_receival_original_allowed(text,text)';expected_body:='a726b7cc254a1cd5d03100449abe03ad';
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure(signature) and proowner='postgres'::regrole and prosecdef) is distinct from expected_body then
  raise exception 'Reviewed source contract changed: %',signature;end if;
 select pg_get_functiondef(to_regprocedure(signature)) into definition;
 old_check:=$old$ select (auth.role()='authenticated'$old$;
 new_check:=$new$ select (auth.role()='authenticated' and auth.uid() is not null and p_operation in('read','insert')
  and exists(select 1 from public.invoice_receival_sources s where s.storage_path=p_path
   and public.can_read_invoice_preparation_source(s.id)
   and (p_operation='read' or s.lifecycle_state='uploading')))
 or (auth.role()='authenticated'$new$;
 matches:=(length(definition)-length(replace(definition,old_check,'')))/length(old_check);
 if matches<>1 then raise exception 'Exact reviewed source clause required: %',signature;end if;
 definition:=replace(definition,old_check,new_check);
 execute definition;

 -- Reviewed target: guard_invoice_receival_original_object
 signature:='public.guard_invoice_receival_original_object()';expected_body:='e9e3509b2c992f25b5b640f9634b623b';
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure(signature) and proowner='postgres'::regrole and prosecdef) is distinct from expected_body then
  raise exception 'Reviewed source contract changed: %',signature;end if;
 select pg_get_functiondef(to_regprocedure(signature)) into definition;
 old_check:=$old$actor.user_id is null or not actor.is_active or actor.read_only
   or exists(select 1 from unnest(array['readOperationalData','writeBusinessData','adjustInventory']) required(capability) where not public.tenbot_canary_user_has_capability(actor.user_id,required.capability))$old$;
 new_check:=$new$actor.user_id is null or not actor.is_active or actor.read_only
   or (exists(select 1 from unnest(array['readOperationalData','writeBusinessData','adjustInventory']) required(capability) where not public.tenbot_canary_user_has_capability(actor.user_id,required.capability))
    and (not public.tenbot_invoice_preparation_actor_allowed(actor.user_id)
     or source.retained_draft_id is not null or source.retained_at is not null
     or exists(select 1 from public.invoice_receival_source_bindings b where b.source_id=source.id)
     or source.sha256<>'c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a' or source.content_type<>'application/pdf' or source.byte_size<>2877))$new$;
 matches:=(length(definition)-length(replace(definition,old_check,'')))/length(old_check);
 if matches<>1 then raise exception 'Exact reviewed source clause required: %',signature;end if;
 definition:=replace(definition,old_check,new_check);
 execute definition;

 -- Reviewed target: tenbot_guard_chris_dev_canary_source
 signature:='public.tenbot_guard_chris_dev_canary_source()';expected_body:='699a5a9d40d3307246b56711e27f16ab';
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure(signature) and proowner='postgres'::regrole and prosecdef) is distinct from expected_body then
  raise exception 'Reviewed source contract changed: %',signature;end if;
 select pg_get_functiondef(to_regprocedure(signature)) into definition;
 old_check:=$old$(public.tenbot_active_chris_dev_canary_grant(new.owner_user_id)).id is null$old$;
 new_check:=$new$not public.can_prepare_invoice_receival()$new$;
 matches:=(length(definition)-length(replace(definition,old_check,'')))/length(old_check);
 if matches<>1 then raise exception 'Exact reviewed source clause required: %',signature;end if;
 definition:=replace(definition,old_check,new_check);
 execute definition;

 -- Reviewed target: tenbot_chris_dev_canary_commit_authorized
 signature:='public.tenbot_chris_dev_canary_commit_authorized()';expected_body:='5a36467c6d12a5e0b734ff4735962aaa';
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure(signature) and proowner='postgres'::regrole and prosecdef) is distinct from expected_body then
  raise exception 'Reviewed source contract changed: %',signature;end if;
 select pg_get_functiondef(to_regprocedure(signature)) into definition;
 old_check:=$old$begin
 if new.owner_user_id=$old$;
 new_check:=$new$begin
 -- Source preparation alone does not grant approval/execution authority.
 -- All OTHER attached business-table branches below remain byte-identical.
 if tg_table_schema='public' and tg_table_name='invoice_receival_sources'
  and new.owner_user_id='3785f6b9-742e-452f-af6c-31613a983633'
  and auth.role()='authenticated' and auth.uid()=new.owner_user_id
  and public.can_read_invoice_preparation_source(new.id) then
  return null;
 end if;
 if new.owner_user_id=$new$;
 matches:=(length(definition)-length(replace(definition,old_check,'')))/length(old_check);
 if matches<>1 then raise exception 'Exact reviewed source clause required: %',signature;end if;
 definition:=replace(definition,old_check,new_check);
 execute definition;
end $source_preparation_boundary$;

-- Preserve the entire old strong owner policy as one OR branch. The only new
-- branch is the caller-owned, live, unbound preparation source defined above.
do $source_read_policy$
declare definition text;
begin
 select pg_get_expr(polqual,polrelid) into definition from pg_policy
 where polrelid='public.invoice_receival_sources'::regclass and polname='invoice_sources_owner_read'
  and polcmd='r' and polpermissive and polroles=array['authenticated'::regrole::oid] and polwithcheck is null;
 if md5(definition) is distinct from '4857968a96b7787b85b9bf57e0a4fd53' then
  raise exception 'Reviewed original source read policy changed; inspect before applying.';end if;
 execute format('alter policy invoice_sources_owner_read on public.invoice_receival_sources using ((%s) or public.can_read_invoice_preparation_source(id))',definition);
end $source_read_policy$;

-- No change to removal/expiry claims, retained originals, binding-table RLS,
-- canonical role/capability grants, invoice approval/execution, permits or audit.
notify pgrst,'reload schema';
commit;
