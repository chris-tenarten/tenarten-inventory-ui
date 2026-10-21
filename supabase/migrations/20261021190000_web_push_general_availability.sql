-- Product-authorized TenOps GA. No enrollment, backfill, key/flag or Cron changes.
-- TenDev continues to use its independent pilot allowlists and disabled transport.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create or replace function public.web_push_enrollment_allowed(p_environment text,p_user uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select (p_environment='tendev' and exists(select 1 from public.web_push_pilot_accounts where user_id=p_user))
 or (p_environment='tenops' and exists(select 1 from public.app_users where user_id=p_user and is_active))
$$;
revoke all on function public.web_push_enrollment_allowed(text,uuid) from public,anon,authenticated,service_role;

create or replace function public.web_push_environment_source(p_notification uuid,p_environment text)
returns boolean language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if p_environment='tendev' then return public.web_push_pilot_source(p_notification);end if;
 if p_environment<>'tenops' then return false;end if;
 -- Existing source authority enforces active recipient, DM ownership/read state,
 -- system-message exclusion and canonical Job Update mention/read permission.
 -- GA removes only sender/recipient/Job pilot allowlists, not these permissions.
 return public.web_push_source(p_notification) is not null;
end;$$;
revoke all on function public.web_push_environment_source(uuid,text) from public,anon,authenticated,service_role;
commit;
