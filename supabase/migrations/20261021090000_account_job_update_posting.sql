-- Explicit per-account posting grant; no role-wide or seeded account changes.
begin;
alter table public.app_users add column job_updates_post boolean not null default false;
comment on column public.app_users.job_updates_post is 'Explicit postJobUpdate grant for this active, non-read-only account; does not grant edit, assignment or access to other private content.';
create or replace function public.has_app_capability(p_capability text)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.app_users u where u.user_id=auth.uid() and u.is_active and
   case when p_capability='postJobUpdate' and u.job_updates_post and not u.read_only then true
        when p_capability='sample_labels.generate' then u.role='admin' or u.sample_labels_generate
        when p_capability='production_blend.manage' then u.role='admin' or u.production_blend_manage
        when u.read_only and p_capability='messaging.write' then u.messaging_write
        when u.read_only and p_capability not in ('readOperationalData','viewIntake','previewOperationalDocuments','accessDevelopmentEnvironment') then false
        else exists(select 1 from public.app_role_capabilities c where c.role=u.role and c.capability=p_capability) end);
$$;
-- Append an optional response field; existing callers retain all original fields.
drop function public.get_my_app_access();
create function public.get_my_app_access()
returns table(user_id uuid,display_name text,role text,is_active boolean,read_only boolean,messaging_write boolean,production_blend_manage boolean,sample_labels_generate boolean,job_updates_post boolean)
language sql stable security definer set search_path=pg_catalog,public as $$
 select u.user_id,u.display_name,u.role,u.is_active,u.read_only,u.messaging_write,u.production_blend_manage,u.sample_labels_generate,u.job_updates_post
 from public.app_users u where u.user_id=auth.uid();
$$;
revoke all on function public.get_my_app_access() from public,anon;
grant execute on function public.get_my_app_access() to authenticated,service_role;
notify pgrst,'reload schema';
commit;
