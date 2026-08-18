-- Additive TenOps application identity and capability infrastructure.
-- SAFE IN COMPATIBILITY MODE: this migration does not revoke or narrow existing access.

begin;

create table if not exists public.app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (btrim(display_name) <> ''),
  role text not null check (role in ('guest', 'member', 'lead', 'developer', 'admin')),
  is_active boolean not null default true,
  created_by_user_id uuid references auth.users(id),
  updated_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_role_capabilities (
  role text not null check (role in ('guest', 'member', 'lead', 'developer', 'admin')),
  capability text not null,
  primary key (role, capability)
);

comment on table public.app_users is 'TenOps application membership tied to Supabase Auth. Disabled membership denies all application access after RBAC enforcement.';
comment on table public.app_role_capabilities is 'System-defined TenOps role bundles. Dynamic/custom roles are intentionally deferred.';

insert into public.app_role_capabilities(role, capability) values
  ('guest','readOperationalData'), ('guest','previewOperationalDocuments'),
  ('member','readOperationalData'), ('member','previewOperationalDocuments'),
  ('member','createProductionJob'), ('member','editProductionJobRoutine'),
  ('member','modifyPlanning'), ('member','postJobUpdate'), ('member','editJobUpdate'),
  ('member','assignJobUpdate'), ('member','resolveJobUpdate'),
  ('member','uploadSupportingFiles'), ('member','deleteSupportingFiles'),
  ('member','createPurchaseOrderDraft'), ('member','receiveInventory'),
  ('lead','readOperationalData'), ('lead','previewOperationalDocuments'),
  ('lead','createProductionJob'), ('lead','editProductionJobRoutine'),
  ('lead','modifyPlanning'), ('lead','postJobUpdate'), ('lead','editJobUpdate'),
  ('lead','assignJobUpdate'), ('lead','resolveJobUpdate'),
  ('lead','uploadSupportingFiles'), ('lead','deleteSupportingFiles'),
  ('lead','createPurchaseOrderDraft'), ('lead','receiveInventory'),
  ('lead','editProductionJobDetails'), ('lead','archiveProductionJob'),
  ('lead','scheduleProduction'), ('lead','manageProductionRework'),
  ('lead','managePhaseLibrary'), ('lead','issuePurchaseOrder'),
  ('lead','issueTransmittal'), ('lead','adjustInventory'), ('lead','manageVendorsCatalog'),
  ('developer','readOperationalData'), ('developer','previewOperationalDocuments'),
  ('developer','accessDevelopmentEnvironment'),
  ('admin','readOperationalData'), ('admin','previewOperationalDocuments'),
  ('admin','createProductionJob'), ('admin','editProductionJobRoutine'),
  ('admin','editProductionJobDetails'), ('admin','archiveProductionJob'),
  ('admin','scheduleProduction'), ('admin','manageProductionRework'),
  ('admin','modifyPlanning'), ('admin','managePhaseLibrary'),
  ('admin','postJobUpdate'), ('admin','editJobUpdate'), ('admin','assignJobUpdate'),
  ('admin','resolveJobUpdate'), ('admin','uploadSupportingFiles'),
  ('admin','deleteSupportingFiles'), ('admin','createPurchaseOrderDraft'),
  ('admin','issuePurchaseOrder'), ('admin','issueTransmittal'),
  ('admin','receiveInventory'), ('admin','adjustInventory'),
  ('admin','manageVendorsCatalog'), ('admin','accessDevelopmentEnvironment'),
  ('admin','manageUsers'), ('admin','manageRolesPermissions')
on conflict do nothing;

create or replace function public.tenops_touch_updated_at()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
alter function public.tenops_touch_updated_at() owner to postgres;

drop trigger if exists app_users_touch_updated_at on public.app_users;
create trigger app_users_touch_updated_at before update on public.app_users
for each row execute function public.tenops_touch_updated_at();

create or replace function public.has_app_capability(p_capability text)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (
    select 1
    from public.app_users u
    join public.app_role_capabilities c on c.role = u.role
    where u.user_id = auth.uid() and u.is_active and c.capability = p_capability
  );
$$;
alter function public.has_app_capability(text) owner to postgres;
revoke all on function public.has_app_capability(text) from public;
grant execute on function public.has_app_capability(text) to authenticated, service_role;

create or replace function public.require_app_capability(p_capability text)
returns void language plpgsql stable security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null or not public.has_app_capability(p_capability) then
    raise exception 'TenOps permission denied.' using errcode = '42501', detail = p_capability;
  end if;
end;
$$;
alter function public.require_app_capability(text) owner to postgres;
revoke all on function public.require_app_capability(text) from public;
grant execute on function public.require_app_capability(text) to authenticated, service_role;

create or replace function public.get_my_app_user()
returns table(user_id uuid, display_name text, role text, is_active boolean)
language sql stable security definer set search_path = pg_catalog, public as $$
  select u.user_id, u.display_name, u.role, u.is_active
  from public.app_users u where u.user_id = auth.uid();
$$;
alter function public.get_my_app_user() owner to postgres;
revoke all on function public.get_my_app_user() from public;
grant execute on function public.get_my_app_user() to authenticated, service_role;

create or replace function public.bootstrap_first_tenops_admin(p_display_name text)
returns public.app_users language plpgsql security definer set search_path = pg_catalog, public as $$
declare created_user public.app_users;
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  if btrim(coalesce(p_display_name, '')) = '' then raise exception 'Display name is required.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('tenops-first-admin', 0));
  if exists (select 1 from public.app_users where role = 'admin' and is_active) then
    raise exception 'An active TenOps Admin already exists.' using errcode = '42501';
  end if;
  insert into public.app_users(user_id, display_name, role, is_active, created_by_user_id, updated_by_user_id)
  values (auth.uid(), btrim(p_display_name), 'admin', true, auth.uid(), auth.uid())
  on conflict (user_id) do update set display_name = excluded.display_name, role = 'admin', is_active = true, updated_by_user_id = auth.uid()
  returning * into created_user;
  return created_user;
end;
$$;
alter function public.bootstrap_first_tenops_admin(text) owner to postgres;
revoke all on function public.bootstrap_first_tenops_admin(text) from public;
grant execute on function public.bootstrap_first_tenops_admin(text) to authenticated;

create or replace function public.admin_set_app_user_access(p_user_id uuid, p_display_name text, p_role text, p_is_active boolean)
returns public.app_users language plpgsql security definer set search_path = pg_catalog, public as $$
declare existing_user public.app_users; updated_user public.app_users;
begin
  perform public.require_app_capability('manageUsers');
  if p_role not in ('guest','member','lead','developer','admin') then raise exception 'Invalid TenOps role.' using errcode = '22023'; end if;
  if btrim(coalesce(p_display_name, '')) = '' then raise exception 'Display name is required.' using errcode = '22023'; end if;
  select * into existing_user from public.app_users where user_id = p_user_id for update;
  if not found then raise exception 'TenOps user not found.' using errcode = 'P0002'; end if;
  if existing_user.role = 'admin' and existing_user.is_active
     and (p_role <> 'admin' or not p_is_active)
     and not exists (select 1 from public.app_users where user_id <> p_user_id and role = 'admin' and is_active)
  then
    raise exception 'The final active Admin cannot be disabled or demoted.' using errcode = '42501';
  end if;
  update public.app_users set display_name = btrim(p_display_name), role = p_role,
    is_active = p_is_active, updated_by_user_id = auth.uid()
  where user_id = p_user_id returning * into updated_user;
  return updated_user;
end;
$$;
alter function public.admin_set_app_user_access(uuid,text,text,boolean) owner to postgres;
revoke all on function public.admin_set_app_user_access(uuid,text,text,boolean) from public;
grant execute on function public.admin_set_app_user_access(uuid,text,text,boolean) to authenticated;

create or replace function public.admin_list_app_users()
returns table(user_id uuid, display_name text, email text, role text, is_active boolean, created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = pg_catalog, public, auth as $$
begin
  perform public.require_app_capability('manageUsers');
  return query select u.user_id, u.display_name, a.email::text, u.role, u.is_active, u.created_at, u.updated_at
  from public.app_users u join auth.users a on a.id = u.user_id order by u.display_name, u.user_id;
end;
$$;
alter function public.admin_list_app_users() owner to postgres;
revoke all on function public.admin_list_app_users() from public;
grant execute on function public.admin_list_app_users() to authenticated;

alter table public.job_updates add column if not exists author_user_id uuid references auth.users(id);
alter table public.job_updates add column if not exists follow_up_assignee_user_id uuid references auth.users(id);
alter table public.job_updates add column if not exists resolved_by_user_id uuid references auth.users(id);
alter table public.job_activity add column if not exists actor_user_id uuid references auth.users(id);
alter table public.production_rework_cycles add column if not exists created_by_user_id uuid references auth.users(id);
alter table public.production_rework_cycles add column if not exists completed_by_user_id uuid references auth.users(id);

create index if not exists job_updates_follow_up_assignee_user_open_idx
  on public.job_updates(follow_up_assignee_user_id, created_at desc)
  where requires_follow_up and resolved_at is null;

create or replace function public.list_my_job_update_notifications()
returns table(update_id uuid, job_id uuid, job_number text, job_name text, body text, created_at timestamptz)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
begin
  perform public.require_app_capability('readOperationalData');
  return query
  select u.id, u.job_id, j.job_number, j.name, u.body, u.created_at
  from public.job_updates u join public.jobs j on j.id = u.job_id
  where u.requires_follow_up and u.resolved_at is null and u.follow_up_assignee_user_id = auth.uid()
  order by u.created_at desc;
end;
$$;
alter function public.list_my_job_update_notifications() owner to postgres;
revoke all on function public.list_my_job_update_notifications() from public;
grant execute on function public.list_my_job_update_notifications() to authenticated;

create or replace function public.report_job_update_identity_backfill()
returns table(update_id uuid, identity_field text, snapshot_name text, match_state text, matched_user_id uuid)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
begin
  perform public.require_app_capability('manageUsers');
  return query
  with snapshots as (
    select id, 'author_user_id'::text field, author_name snapshot from public.job_updates where author_user_id is null and nullif(btrim(author_name), '') is not null
    union all select id, 'follow_up_assignee_user_id', follow_up_assignee_name from public.job_updates where follow_up_assignee_user_id is null and nullif(btrim(follow_up_assignee_name), '') is not null
    union all select id, 'resolved_by_user_id', resolved_by_name from public.job_updates where resolved_by_user_id is null and nullif(btrim(resolved_by_name), '') is not null
  ), matches as (
    select s.id, s.field, s.snapshot, count(u.user_id) match_count, min(u.user_id::text)::uuid matched
    from snapshots s left join public.app_users u on lower(btrim(u.display_name)) = lower(btrim(s.snapshot))
    group by s.id, s.field, s.snapshot
  )
  select id, field, snapshot, case when match_count = 1 then 'matched' when match_count = 0 then 'unmatched' else 'ambiguous' end, case when match_count = 1 then matched end
  from matches order by id, field;
end;
$$;
alter function public.report_job_update_identity_backfill() owner to postgres;
revoke all on function public.report_job_update_identity_backfill() from public;
grant execute on function public.report_job_update_identity_backfill() to authenticated;

alter table public.app_users enable row level security;
alter table public.app_role_capabilities enable row level security;
drop policy if exists app_users_read_self on public.app_users;
create policy app_users_read_self on public.app_users for select to authenticated using (user_id = auth.uid() or public.has_app_capability('manageUsers'));
drop policy if exists role_capabilities_read_active on public.app_role_capabilities;
create policy role_capabilities_read_active on public.app_role_capabilities for select to authenticated using (exists (select 1 from public.app_users where user_id = auth.uid() and is_active));
revoke all on public.app_users, public.app_role_capabilities from anon;
grant select on public.app_users, public.app_role_capabilities to authenticated;
grant all on public.app_users, public.app_role_capabilities to service_role;

commit;
