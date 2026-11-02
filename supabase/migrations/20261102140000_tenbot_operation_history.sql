-- Local/isolated continuation only. Backward-compatible private display links;
-- no new messaging store, raw business payload, password or Auth token archive.
begin;
set local lock_timeout='3s';set local statement_timeout='30s';
create or replace function public.tenbot_employee_display_valid(t jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog,public as $$
declare v jsonb;r jsonb;
begin
 if jsonb_typeof(t) is distinct from 'object' or (t-array['id','question','message','createdAt','answeredAt','scopeDigest','sources','jobIds','contentScope','actionReferences','operationAccess'])<>'{}'::jsonb
  or not(t ?& array['id','question','message','createdAt','answeredAt','scopeDigest','sources','jobIds','contentScope'])
  or jsonb_typeof(t->'id') is distinct from 'string' or t->>'id' !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  or jsonb_typeof(t->'question') is distinct from 'string' or length(t->>'question') not between 1 and 1200
  or jsonb_typeof(t->'message') is distinct from 'string' or length(t->>'message') not between 1 and 2400
  or jsonb_typeof(t->'scopeDigest') is distinct from 'string' or t->>'scopeDigest' !~ '^[a-f0-9]{64}$'
  or not public.tenbot_agent_proofs_valid(t->'sources')
  or coalesce(t->>'contentScope','') not in ('workflow','scope','operational-history')
  or jsonb_typeof(t->'createdAt') is distinct from 'string' or jsonb_typeof(t->'answeredAt') is distinct from 'string'
  or t->>'createdAt' !~ '^\d{4}-\d\d-\d\dT' or t->>'answeredAt' !~ '^\d{4}-\d\d-\d\dT'
  or jsonb_typeof(t->'jobIds') is distinct from 'array' or jsonb_array_length(t->'jobIds')>1000 then return false;end if;
 if (t->>'createdAt')::timestamptz>(t->>'answeredAt')::timestamptz then return false;end if;
 for v in select value from jsonb_array_elements(t->'jobIds') loop
  if jsonb_typeof(v) is distinct from 'string' or v#>>'{}' !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then return false;end if;
 end loop;
 if t ? 'actionReferences' then
  if jsonb_typeof(t->'actionReferences') is distinct from 'array' or jsonb_array_length(t->'actionReferences')>1 then return false;end if;
  for r in select value from jsonb_array_elements(t->'actionReferences') loop
   if jsonb_typeof(r) is distinct from 'object' or (select count(*) from jsonb_object_keys(r))<>4 or not(r ?& array['id','revision','hash','expiresAt'])
    or r->>'id' !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    or jsonb_typeof(r->'id') is distinct from 'string' or jsonb_typeof(r->'revision') is distinct from 'number' or r->>'revision' !~ '^[1-9][0-9]{0,8}$'
    or jsonb_typeof(r->'hash') is distinct from 'string' or r->>'hash' !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(r->'expiresAt') is distinct from 'string' or r->>'expiresAt' !~ '^\d{4}-\d\d-\d\dT' then return false;end if;
   perform (r->>'expiresAt')::timestamptz;
  end loop;
 end if;
 if t ? 'operationAccess' then
  r:=t->'operationAccess';
  if jsonb_typeof(r) is distinct from 'object' or (select count(*) from jsonb_object_keys(r))<>2 or not(r ?& array['documentIds','proposalAccess'])
   or jsonb_typeof(r->'proposalAccess') is distinct from 'boolean' or jsonb_typeof(r->'documentIds') is distinct from 'array' or jsonb_array_length(r->'documentIds')>8 then return false;end if;
  for v in select value from jsonb_array_elements(r->'documentIds') loop
   if jsonb_typeof(v) is distinct from 'string' or v#>>'{}' !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then return false;end if;
  end loop;
 end if;
 return octet_length(t::text)<=64000;
exception when others then return false;
end;$$;
-- CREATE OR REPLACE preserves the original private owner/ACL and every legacy
-- nine-field row. Existing trusted commit/page RPCs retain their owner/claim CAS.
revoke all on function public.tenbot_employee_display_valid(jsonb) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
