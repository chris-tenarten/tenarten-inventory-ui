-- Forward-only fail-closed hardening of the exact Storage backend exception.
--150000/170000 are already isolated-applied and stay unchanged. Missing JWT
--role claims must never be treated as a true Storage backend authorization.
begin;
set local lock_timeout='3s';set local statement_timeout='15s';
do $preflight$ begin
 if (select md5(prosrc) from pg_proc where oid='public.guard_invoice_receival_original_object()'::regprocedure) is distinct from 'dd486def6456ad521063168ae2da0a2b' then raise exception 'Reviewed Storage guard changed; inspect before hardening.';end if;
end $preflight$;
create or replace function public.guard_invoice_receival_original_object() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare source public.invoice_receival_sources; backend boolean:=session_user='supabase_storage_admin' and auth.role()='service_role' and auth.uid() is null; actor public.app_users;
begin
 if tg_op='INSERT' and new.bucket_id='invoice-receival-originals' then
  if public.invoice_receival_original_allowed(new.name,'insert') is true then return new;end if;
  -- The real Storage API probes RLS with the signed employee, then persists
  -- bytes/metadata in its internal storage-admin session. That trusted second
  -- phase must retain the original owner's ID and exact generated manifest.
  select * into source from public.invoice_receival_sources s where s.storage_path=new.name for update;
  select * into actor from public.app_users u where u.user_id=source.owner_user_id for share;
  lock table public.app_role_capabilities in share mode;
  if backend is distinct from true or source.id is null or source.lifecycle_state<>'uploading' or source.expires_at<=clock_timestamp() or new.owner_id is distinct from source.owner_user_id::text
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
   or not(public.invoice_receival_original_allowed(old.name,'delete') is true or backend is true and old.owner_id is not distinct from source.owner_user_id::text)
  then raise exception 'Retained or unauthorized invoice original cannot be removed.' using errcode='42501';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
notify pgrst,'reload schema';
commit;
