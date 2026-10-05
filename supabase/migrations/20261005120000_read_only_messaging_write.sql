-- Candidate only. No hosted application authorized.
-- Visibility stays in the existing role/policies. Restrictions do not grant reads.
begin;

alter table public.app_users add column read_only boolean not null default false;
alter table public.app_users add column messaging_write boolean not null default false;
alter table public.app_users add constraint app_users_read_only_guest check (not read_only or role='guest');
comment on column public.app_users.read_only is 'Guest restriction: no business writes, including legacy RPCs that use a read capability.';
comment on column public.app_users.messaging_write is 'Explicit messaging.write assignment for restricted accounts. Unrestricted accounts retain existing participation.';
insert into public.app_role_capabilities(role,capability)
select role,capability from (values ('guest'),('member'),('lead'),('developer'),('admin')) roles(role)
cross join (values ('writeBusinessData'),('messaging.write')) capabilities(capability);

create or replace function public.has_app_capability(p_capability text)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.app_users u where u.user_id=auth.uid() and u.is_active and
   case when u.read_only and p_capability='messaging.write' then u.messaging_write
        when u.read_only and p_capability not in ('readOperationalData','viewIntake','previewOperationalDocuments','accessDevelopmentEnvironment') then false
        else exists(select 1 from public.app_role_capabilities c where c.role=u.role and c.capability=p_capability) end);
$$;

create function public.get_my_app_access()
returns table(user_id uuid,display_name text,role text,is_active boolean,read_only boolean,messaging_write boolean)
language sql stable security definer set search_path=pg_catalog,public as $$
 select u.user_id,u.display_name,u.role,u.is_active,u.read_only,u.messaging_write from public.app_users u where u.user_id=auth.uid();
$$;
revoke all on function public.get_my_app_access() from public,anon;
grant execute on function public.get_my_app_access() to authenticated;

create function public.admin_list_app_access()
returns table(user_id uuid,display_name text,email text,role text,is_active boolean,created_at timestamptz,updated_at timestamptz,read_only boolean,messaging_write boolean)
language plpgsql stable security definer set search_path=pg_catalog,public,auth as $$
begin
 perform public.require_app_capability('manageUsers');
 return query select u.user_id,u.display_name,a.email::text,u.role,u.is_active,u.created_at,u.updated_at,u.read_only,u.messaging_write
 from public.app_users u join auth.users a on a.id=u.user_id order by u.display_name,u.user_id;
end;$$;
revoke all on function public.admin_list_app_access() from public,anon;
grant execute on function public.admin_list_app_access() to authenticated;

create function public.admin_set_app_access(p_user_id uuid,p_display_name text,p_role text,p_is_active boolean,p_read_only boolean,p_messaging_write boolean)
returns public.app_users language plpgsql security definer set search_path=pg_catalog,public as $$
declare result public.app_users;
begin
 perform public.require_app_capability('manageUsers');
 if p_read_only is null or p_messaging_write is null or (p_read_only and p_role<>'guest') then
   raise exception 'Read-only restriction requires Guest and explicit permission choices.' using errcode='22023';
 end if;
 -- Lock before either update; all changes roll back together on any validation failure.
 perform 1 from public.app_users where user_id=p_user_id for update;
 -- Clear only inside this transaction so the Guest constraint permits a role change.
 update public.app_users set read_only=false where user_id=p_user_id;
 perform public.admin_set_app_user_access(p_user_id,p_display_name,p_role,p_is_active);
 update public.app_users set read_only=p_read_only,messaging_write=p_messaging_write,updated_by_user_id=auth.uid()
 where user_id=p_user_id returning * into result;
 return result;
end;$$;
revoke all on function public.admin_set_app_access(uuid,text,text,boolean,boolean,boolean) from public,anon;
grant execute on function public.admin_set_app_access(uuid,text,text,boolean,boolean,boolean) to authenticated;

-- Enforce at the tables as well as capabilities: legacy SECURITY DEFINER RPCs
-- sometimes authorize a mutation using readOperationalData. Statement triggers
-- reject even zero-row writes. Existing grants, read policies and ownership checks stay in force.
create function public.guard_tenops_business_write() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if auth.role() in ('anon','authenticated') or auth.uid() is not null then
   -- Preserve the original first-Admin bootstrap, whose RPC verifies the empty
   -- Admin state. Direct authenticated app_users writes remain ungranted.
   if tg_table_name='app_users' and auth.uid() is not null
     and not exists(select 1 from public.app_users where user_id=auth.uid())
     and not exists(select 1 from public.app_users where role='admin' and is_active) then return null; end if;
   perform public.require_app_capability('writeBusinessData');
 end if;
 return null;
end;$$;
revoke all on function public.guard_tenops_business_write() from public,anon,authenticated;

do $$declare t record; command text;
begin
 for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','p') and not c.relispartition
 and c.relname not in ('my_work_messages','my_work_message_attachments','my_work_message_versions','my_work_attachment_previews','account_notifications')
 loop
   execute format('create trigger tenops_business_write_guard before insert or update or delete or truncate on public.%I for each statement execute function public.guard_tenops_business_write()',t.relname);
   foreach command in array array['insert','update','delete'] loop
     execute format('create policy tenops_business_write_%s on public.%I as restrictive for %s to authenticated,anon %s',command,t.relname,command,
       case when command='insert' then 'with check (public.has_app_capability(''writeBusinessData''))'
            when command='update' then 'using (public.has_app_capability(''writeBusinessData'')) with check (public.has_app_capability(''writeBusinessData''))'
            else 'using (public.has_app_capability(''writeBusinessData''))' end);
   end loop;
 end loop;
end$$;

-- No new participant access. Receipt updates are ordinary reading, allowed even
-- without messaging.write; content/draft/attachment/version writes require it.
create function public.guard_tenops_messaging_write() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if auth.role() in ('anon','authenticated') or auth.uid() is not null then
   if tg_table_name='my_work_messages' and tg_op='UPDATE' then
     if old.recipient_user_id=auth.uid() and
        (to_jsonb(new)-'read_at')=(to_jsonb(old)-'read_at') then
       perform public.require_app_capability('readOperationalData');
       return new;
     end if;
   end if;
   perform public.require_app_capability('messaging.write');
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end;$$;
revoke all on function public.guard_tenops_messaging_write() from public,anon,authenticated;
do $$declare name text;
begin
 foreach name in array array['my_work_messages','my_work_message_attachments','my_work_message_versions','my_work_attachment_previews'] loop
   execute format('create trigger tenops_messaging_write_guard before insert or update or delete on public.%I for each row execute function public.guard_tenops_messaging_write()',name);
 end loop;
end$$;

-- Notifications may be produced by Messaging, but are not a business-write escape.
create function public.guard_tenops_notification_write() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if exists(select 1 from public.app_users where user_id=auth.uid() and read_only) then
   if tg_op='INSERT' and new.notification_type='inbox_message' and exists(
     select 1 from public.my_work_messages m where m.id::text=new.metadata->>'message_id'
       and m.sender_user_id=auth.uid() and m.recipient_user_id=new.user_id
   ) and public.has_app_capability('messaging.write') then return new; end if;
   if tg_op='UPDATE' and old.user_id=auth.uid() and
     (to_jsonb(old)-'read_at')=(to_jsonb(new)-'read_at') then return new; end if;
   raise exception 'TenOps business write denied.' using errcode='42501';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end;$$;
revoke all on function public.guard_tenops_notification_write() from public,anon,authenticated;
create trigger tenops_notification_write_guard before insert or update or delete on public.account_notifications
for each row execute function public.guard_tenops_notification_write();

-- Explicit RPC entry guards also reject no-op attempts and recovery/finalization.
-- Preserve each installed function's complete body, signature and ownership checks.
do $$declare f record; definition text;
begin
 for f in select p.oid,p.proname,l.lanname from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
 where n.nspname='public' and p.proname in (
 'send_my_work_inbox_message','create_my_work_inbox_message_draft','finalize_my_work_inbox_message',
 'discard_my_work_inbox_message_draft','edit_my_work_inbox_message','begin_my_work_attachment_transfer',
 'recover_my_work_attachment_transfer','heartbeat_my_work_attachment_transfer','cancel_my_work_attachment_transfer','reserve_my_work_attachment_preview')
 loop
   if f.lanname<>'plpgsql' then raise exception 'Unexpected Messaging function language: %',f.proname; end if;
   definition:=pg_get_functiondef(f.oid);
   if definition !~* '\mBEGIN\M' then raise exception 'Missing Messaging function body: %',f.proname; end if;
   execute regexp_replace(definition,'\mBEGIN\M',E'BEGIN\n  perform public.require_app_capability(''messaging.write'');','i');
 end loop;
end$$;

create trigger tenops_storage_bucket_write_guard before insert or update or delete or truncate on storage.buckets
for each statement execute function public.guard_tenops_business_write();

create function public.guard_tenops_storage_write() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare bucket text;
begin
 if tg_op='DELETE' then bucket:=old.bucket_id; else bucket:=new.bucket_id; end if;
 if auth.role() in ('anon','authenticated') or auth.uid() is not null then
   if bucket='my-work-inbox-attachments' then perform public.require_app_capability('messaging.write');
   else perform public.require_app_capability('writeBusinessData'); end if;
   if tg_op='UPDATE' and old.bucket_id is distinct from new.bucket_id then
     perform public.require_app_capability('writeBusinessData');
   end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end;$$;
revoke all on function public.guard_tenops_storage_write() from public,anon,authenticated;
create trigger tenops_storage_write_guard before insert or update or delete on storage.objects
for each row execute function public.guard_tenops_storage_write();
create policy tenops_storage_write_insert on storage.objects as restrictive for insert to authenticated,anon
with check (public.has_app_capability(case when bucket_id='my-work-inbox-attachments' then 'messaging.write' else 'writeBusinessData' end));
create policy tenops_storage_write_update on storage.objects as restrictive for update to authenticated,anon
using (public.has_app_capability(case when bucket_id='my-work-inbox-attachments' then 'messaging.write' else 'writeBusinessData' end))
with check (public.has_app_capability(case when bucket_id='my-work-inbox-attachments' then 'messaging.write' else 'writeBusinessData' end));
create policy tenops_storage_write_delete on storage.objects as restrictive for delete to authenticated,anon
using (public.has_app_capability(case when bucket_id='my-work-inbox-attachments' then 'messaging.write' else 'writeBusinessData' end));

create policy tenops_messaging_publish on realtime.messages as restrictive for insert to authenticated
with check (public.has_app_capability('messaging.write'));

notify pgrst,'reload schema';
commit;
