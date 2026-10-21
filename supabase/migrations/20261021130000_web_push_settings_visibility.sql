-- Cohort-only Settings visibility; does not enroll a device or enable delivery.
begin;
create function public.can_view_my_web_push_settings()
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.app_users u join public.web_push_environments e
  on e.origin=public.web_push_request_origin()
  where u.user_id=auth.uid() and u.is_active
  and public.web_push_enrollment_allowed(e.environment,u.user_id))
$$;
revoke all on function public.can_view_my_web_push_settings() from public,anon,service_role;
grant execute on function public.can_view_my_web_push_settings() to authenticated;
commit;
