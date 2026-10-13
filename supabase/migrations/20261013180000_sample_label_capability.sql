-- Dedicated per-account Color Plate Label access. Forward-only; no hosted application authorized.
begin;
alter table public.app_users add column sample_labels_generate boolean not null default false;
comment on column public.app_users.sample_labels_generate is 'Explicit sample_labels.generate grant. Admin has access inherently; no other role implies it.';

create or replace function public.has_app_capability(p_capability text)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.app_users u where u.user_id=auth.uid() and u.is_active and
   case when p_capability='sample_labels.generate' then u.role='admin' or u.sample_labels_generate
        when p_capability='production_blend.manage' then u.role='admin' or u.production_blend_manage
        when u.read_only and p_capability='messaging.write' then u.messaging_write
        when u.read_only and p_capability not in ('readOperationalData','viewIntake','previewOperationalDocuments','accessDevelopmentEnvironment') then false
        else exists(select 1 from public.app_role_capabilities c where c.role=u.role and c.capability=p_capability) end);
$$;

drop function public.get_my_app_access();
create function public.get_my_app_access()
returns table(user_id uuid,display_name text,role text,is_active boolean,read_only boolean,messaging_write boolean,production_blend_manage boolean,sample_labels_generate boolean)
language sql stable security definer set search_path=pg_catalog,public as $$
 select u.user_id,u.display_name,u.role,u.is_active,u.read_only,u.messaging_write,u.production_blend_manage,u.sample_labels_generate
 from public.app_users u where u.user_id=auth.uid();
$$;
revoke all on function public.get_my_app_access() from public,anon;
grant execute on function public.get_my_app_access() to authenticated;

drop function public.admin_list_app_access();
create function public.admin_list_app_access()
returns table(user_id uuid,display_name text,email text,role text,is_active boolean,created_at timestamptz,updated_at timestamptz,read_only boolean,messaging_write boolean,production_blend_manage boolean,sample_labels_generate boolean)
language plpgsql stable security definer set search_path=pg_catalog,public,auth as $$
begin
 perform public.require_app_capability('manageUsers');
 return query select u.user_id,u.display_name,a.email::text,u.role,u.is_active,u.created_at,u.updated_at,u.read_only,u.messaging_write,u.production_blend_manage,u.sample_labels_generate
 from public.app_users u join auth.users a on a.id=u.user_id order by u.display_name,u.user_id;
end;$$;
revoke all on function public.admin_list_app_access() from public,anon;
grant execute on function public.admin_list_app_access() to authenticated;

-- Existing v1/v2 clients leave the new column untouched. V3 can edit label access
-- independently; omitted Blend permission retains the locked current value.
create function public.admin_set_app_access_v3(p_user_id uuid,p_display_name text,p_role text,p_is_active boolean,p_read_only boolean,p_messaging_write boolean,p_production_blend_manage boolean,p_sample_labels_generate boolean)
returns public.app_users language plpgsql security definer set search_path=pg_catalog,public as $$
declare result public.app_users;
begin
 if not exists(select 1 from public.app_users where user_id=auth.uid() and role='admin' and is_active) then
  raise exception 'Admin access required.' using errcode='42501';
 end if;
 if p_sample_labels_generate is null then raise exception 'Explicit Color Plate Label permission choice is required.' using errcode='22023'; end if;
 select * into strict result from public.app_users where user_id=p_user_id for update;
 perform public.admin_set_app_access_v2(p_user_id,p_display_name,p_role,p_is_active,p_read_only,p_messaging_write,coalesce(p_production_blend_manage,result.production_blend_manage));
 update public.app_users set sample_labels_generate=p_sample_labels_generate,updated_by_user_id=auth.uid()
 where user_id=p_user_id returning * into result;
 return result;
end;$$;
revoke all on function public.admin_set_app_access_v3(uuid,text,text,boolean,boolean,boolean,boolean,boolean) from public,anon;
grant execute on function public.admin_set_app_access_v3(uuid,text,text,boolean,boolean,boolean,boolean,boolean) to authenticated;

-- Side-effect-free authorization for existing Sample visibility and transient output.
-- SECURITY INVOKER intentionally retains the caller's SELECT grants and Sample RLS.
create function public.authorize_sample_color_plate_label(p_sample_id uuid default null)
returns boolean language plpgsql stable security invoker set search_path=pg_catalog,public as $$
begin
 perform public.require_app_capability('readOperationalData');
 perform public.require_app_capability('sample_labels.generate');
 if p_sample_id is not null and not exists(select 1 from public.samples where id=p_sample_id) then
  raise exception 'Sample access required.' using errcode='42501';
 end if;
 return true;
end;$$;
revoke all on function public.authorize_sample_color_plate_label(uuid) from public,anon;
grant execute on function public.authorize_sample_color_plate_label(uuid) to authenticated;

-- No role grants, user assignments, Sample policies, document writes or print service.
notify pgrst,'reload schema';
commit;
