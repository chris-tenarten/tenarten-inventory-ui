-- REVIEW/APPLY SEPARATELY. No keys installed; no schedule enabled.
-- Requires pg_cron, pg_net, pgcrypto (extensions schema), Vault and Stage A/B.
begin;
create function public.dispatch_web_push(p_environment text)
returns bigint language plpgsql security definer set search_path=pg_catalog,public as $$
declare secret text;target text;run uuid;expiry bigint;signature text;request_id bigint;
begin
 if not exists(select 1 from public.web_push_transport where environment=p_environment and enabled) then return null;end if;
 select decrypted_secret into strict secret from vault.decrypted_secrets where name='web_push_wake_'||p_environment;
 select decrypted_secret into strict target from vault.decrypted_secrets where name='web_push_url_'||p_environment;
 if length(secret)<32 or target !~ '^https://[a-z0-9]+[.]supabase[.]co/functions/v1/send-web-push$' then raise exception 'Invalid worker configuration';end if;
 expiry:=floor(extract(epoch from clock_timestamp()))::bigint+60;
 insert into public.web_push_runs(environment,expires_at) values(p_environment,expiry) returning id into run;
 signature:=encode(extensions.hmac(convert_to('v1'||E'\n'||p_environment||E'\n'||run::text||E'\n'||expiry::text,'UTF8'),convert_to(secret,'UTF8'),'sha256'),'hex');
 request_id:=net.http_post(url:=target,headers:=jsonb_build_object('Content-Type','application/json'),
  body:=jsonb_build_object('v',1,'environment',p_environment,'run_id',run,'exp',expiry,'sig',signature),timeout_milliseconds:=60000);
 return request_id;
end;$$;
revoke all on function public.dispatch_web_push(text) from public,anon,authenticated,service_role;
-- Proposed periodic recovery, to be created DISABLED after configuration approval:
-- select cron.schedule('tenops-web-push-prod','* * * * *',$command$select public.dispatch_web_push('prod');$command$);
-- select cron.alter_job((select jobid from cron.job where jobname='tenops-web-push-prod'),active:=false);
commit;
