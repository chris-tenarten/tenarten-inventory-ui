-- psql variables from verified Pages metadata, NOT a substitute for browser verification.
-- psql -v client_sha=<verified SHA> -v deployment_id=<verified deployment UUID> -f ...
begin;
update public.messaging_attachment_release
set client_sha=:'client_sha',deployment_id=:'deployment_id',refreshed_verified=true
where singleton and phase='migrated';
do $$ begin
 if not exists(select 1 from public.messaging_attachment_release where singleton and phase='migrated'
  and client_sha='5cbc69dd67d380baa0bf03b01ae65c9318f7889a'
  and deployment_id ~ '^[0-9a-f-]{36}$' and refreshed_verified) then raise exception 'Exact deployed client identity required'; end if;
end $$;
commit;
