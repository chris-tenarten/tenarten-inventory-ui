-- Owner-only verification metadata; no enrollment, revocation or transport changes.
begin;
create or replace function public.get_my_web_push_subscription(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare result jsonb;
begin
 if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active) then raise exception 'Active account required.' using errcode='42501'; end if;
 select jsonb_build_object('enabled',s.enabled and (s.expiration_time is null or s.expiration_time>clock_timestamp()),
  'generation',s.generation,'show_previews',s.show_previews,
  'delivery_enabled',exists(select 1 from public.web_push_transport t where t.environment=s.environment and t.enabled),
  'endpoint_hash',s.endpoint_hash,'environment',s.environment,'key_version',s.key_version)
 into result from public.web_push_subscriptions s join public.web_push_environments e using(environment)
 where s.id=p_id and s.user_id=auth.uid() and e.origin=public.web_push_request_origin();return result;
end;$$;
revoke all on function public.get_my_web_push_subscription(uuid) from public,anon,service_role;
grant execute on function public.get_my_web_push_subscription(uuid) to authenticated;
commit;
