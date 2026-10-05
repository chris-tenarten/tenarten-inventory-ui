-- Explicit, per-account Production Blend access. No hosted grants or fixture rows.
begin;
alter table public.app_users add column production_blend_manage boolean not null default false;
comment on column public.app_users.production_blend_manage is 'Explicit production_blend.manage grant; Admin has access inherently. No other role implies it.';

create or replace function public.has_app_capability(p_capability text)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.app_users u where u.user_id=auth.uid() and u.is_active and
   case when p_capability='production_blend.manage' then u.role='admin' or u.production_blend_manage
        when u.read_only and p_capability='messaging.write' then u.messaging_write
        when u.read_only and p_capability not in ('readOperationalData','viewIntake','previewOperationalDocuments','accessDevelopmentEnvironment') then false
        else exists(select 1 from public.app_role_capabilities c where c.role=u.role and c.capability=p_capability) end);
$$;

-- Return types gain one field; existing clients may safely ignore it.
drop function public.get_my_app_access();
create function public.get_my_app_access()
returns table(user_id uuid,display_name text,role text,is_active boolean,read_only boolean,messaging_write boolean,production_blend_manage boolean)
language sql stable security definer set search_path=pg_catalog,public as $$
 select u.user_id,u.display_name,u.role,u.is_active,u.read_only,u.messaging_write,u.production_blend_manage from public.app_users u where u.user_id=auth.uid();
$$;
revoke all on function public.get_my_app_access() from public,anon;
grant execute on function public.get_my_app_access() to authenticated;

drop function public.admin_list_app_access();
create function public.admin_list_app_access()
returns table(user_id uuid,display_name text,email text,role text,is_active boolean,created_at timestamptz,updated_at timestamptz,read_only boolean,messaging_write boolean,production_blend_manage boolean)
language plpgsql stable security definer set search_path=pg_catalog,public,auth as $$
begin
 perform public.require_app_capability('manageUsers');
 return query select u.user_id,u.display_name,a.email::text,u.role,u.is_active,u.created_at,u.updated_at,u.read_only,u.messaging_write,u.production_blend_manage
 from public.app_users u join auth.users a on a.id=u.user_id order by u.display_name,u.user_id;
end;$$;
revoke all on function public.admin_list_app_access() from public,anon;
grant execute on function public.admin_list_app_access() to authenticated;

-- Keep the released six-argument RPC compatible. Assignment is atomic with access edits.
create function public.admin_set_app_access_v2(p_user_id uuid,p_display_name text,p_role text,p_is_active boolean,p_read_only boolean,p_messaging_write boolean,p_production_blend_manage boolean)
returns public.app_users language plpgsql security definer set search_path=pg_catalog,public as $$
declare result public.app_users;
begin
 if not exists(select 1 from public.app_users where user_id=auth.uid() and role='admin' and is_active) then
  raise exception 'Admin access required.' using errcode='42501';
 end if;
 if p_production_blend_manage is null then raise exception 'Explicit Production Blend permission choice is required.' using errcode='22023'; end if;
 perform public.admin_set_app_access(p_user_id,p_display_name,p_role,p_is_active,p_read_only,p_messaging_write);
 update public.app_users set production_blend_manage=p_production_blend_manage,updated_by_user_id=auth.uid() where user_id=p_user_id returning * into result;
 return result;
end;$$;
revoke all on function public.admin_set_app_access_v2(uuid,text,text,boolean,boolean,boolean,boolean) from public,anon;
grant execute on function public.admin_set_app_access_v2(uuid,text,text,boolean,boolean,boolean,boolean) to authenticated;

drop policy production_blend_admin_read on public.production_blend_plans;
create policy production_blend_authorized_read on public.production_blend_plans for select to authenticated
 using(public.has_app_capability('production_blend.manage'));
create or replace function public.persist_production_blend(p_actor uuid,p_id uuid,p_revision integer,p_sample_id uuid,p_source_document_id uuid,p_source_snapshot jsonb,p_inputs jsonb,p_model jsonb,p_issue boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare old_plan production_blend_plans; result production_blend_plans;
begin
 if not exists(select 1 from app_users where user_id=p_actor and (role='admin' or production_blend_manage) and is_active) then raise exception 'Production Blend planning access required' using errcode='42501'; end if;
 if p_model->>'version' is distinct from 'production-blend-v1' then raise exception 'Unsupported Production Blend contract'; end if;
 if p_issue and ((p_model->>'adjustment')::numeric<0 or jsonb_array_length(p_model->'warnings')>0) then raise exception 'Correct Production planning warnings before issue'; end if;
 if p_id is null then
  insert into production_blend_plans(sample_id,source_document_id,source_snapshot,inputs,model,created_by,status,issued_at)
   values(p_sample_id,p_source_document_id,p_source_snapshot,p_inputs,p_model,p_actor,case when p_issue then 'issued' else 'working' end,case when p_issue then now() end) returning * into result;
 else
  select * into old_plan from production_blend_plans where id=p_id for update;
  if not found or old_plan.revision is distinct from p_revision then raise exception 'Plan changed; reload before saving' using errcode='40001'; end if;
  update production_blend_plans set inputs=p_inputs,model=p_model,revision=revision+1,updated_at=now(),status=case when p_issue then 'issued' else 'working' end,issued_at=case when p_issue then now() end where id=p_id returning * into result;
 end if;
 return to_jsonb(result);
end $$;

-- Existing service-only persistence grants and issued immutability stay in force.
notify pgrst,'reload schema';
commit;
