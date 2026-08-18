begin;

do $$
begin
  if to_regclass('public.app_users') is null then raise exception 'VERIFY_APP_USERS_MISSING'; end if;
  if to_regclass('public.app_role_capabilities') is null then raise exception 'VERIFY_ROLE_CAPABILITIES_MISSING'; end if;
  if not exists (select 1 from pg_proc where proname = 'has_app_capability') then raise exception 'VERIFY_CAPABILITY_HELPER_MISSING'; end if;
  if not exists (select 1 from pg_proc where proname = 'list_my_job_update_notifications') then raise exception 'VERIFY_NOTIFICATIONS_RPC_MISSING'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='job_updates' and column_name='follow_up_assignee_user_id') then raise exception 'VERIFY_ASSIGNEE_IDENTITY_MISSING'; end if;
  if (select count(*) from public.app_role_capabilities where role='developer' and capability not in ('readOperationalData','previewOperationalDocuments','accessDevelopmentEnvironment')) <> 0 then raise exception 'VERIFY_DEVELOPER_ESCALATION'; end if;
  if not exists (select 1 from public.app_role_capabilities where role='lead' and capability='manageProductionRework') then raise exception 'VERIFY_LEAD_REWORK'; end if;
  if exists (select 1 from public.app_role_capabilities where role='member' and capability='manageProductionRework') then raise exception 'VERIFY_MEMBER_REWORK_ELEVATION'; end if;
end;
$$;

rollback;
