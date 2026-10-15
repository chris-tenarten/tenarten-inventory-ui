-- Forward correction only: remove hosted default anonymous EXECUTE grants.
-- Preserve function bodies, authenticated/service_role grants and all other contracts.
begin;
revoke execute on function public.can_publish_sample_to_job(uuid) from anon;
revoke execute on function public.can_upload_sample_update(text) from anon;
revoke execute on function public.search_sample_update_jobs(text) from anon;
revoke execute on function public.publish_sample_job_update(uuid,uuid,text,bigint,text,text,uuid[]) from anon;

-- Effective checks include PUBLIC and inherited role privileges. Roll back if
-- revoking these explicit grants does not establish the intended boundary.
do $grant_check$
declare signature text; target oid;
begin
 foreach signature in array array[
  'public.can_publish_sample_to_job(uuid)',
  'public.can_upload_sample_update(text)',
  'public.search_sample_update_jobs(text)',
  'public.publish_sample_job_update(uuid,uuid,text,bigint,text,text,uuid[])'
 ] loop
  target:=signature::regprocedure;
  if has_function_privilege('anon',target,'EXECUTE') then
   raise exception 'Anonymous EXECUTE remains effective: %',signature;
  end if;
  if not has_function_privilege('authenticated',target,'EXECUTE')
     or not has_function_privilege('service_role',target,'EXECUTE') then
   raise exception 'Intended EXECUTE permission missing: %',signature;
  end if;
 end loop;
end;
$grant_check$;
commit;
