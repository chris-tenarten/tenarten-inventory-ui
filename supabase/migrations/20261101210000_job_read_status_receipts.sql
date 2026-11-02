-- Additive selector validation for existing bounded legacy read receipts only.
-- Existing function identity, owner, ACL, RLS and all authorization remain unchanged.
-- No new read/write authority, tables, grants or data changes.
begin;
create or replace function public.tenbot_operational_receipts_valid(v jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog,public as $$
declare t jsonb;r jsonb;a jsonb;k text;x jsonb;names text[];started timestamptz;ended timestamptz;
begin
 if jsonb_typeof(v) is distinct from 'array' or jsonb_array_length(v)>4 then return false;end if;
 for t in select value from jsonb_array_elements(v) loop
  if jsonb_typeof(t) is distinct from 'object' or (select count(*) from jsonb_object_keys(t))<>9
   or not(t ?& array['id','question','message','createdAt','answeredAt','expiresAt','scopeDigest','sources','reads'])
   or jsonb_typeof(t->'id') is distinct from 'string' or t->>'id' !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
   or jsonb_typeof(t->'question') is distinct from 'string' or length(t->>'question') not between 1 and 1200
   or jsonb_typeof(t->'message') is distinct from 'string' or length(t->>'message') not between 1 and 2400
   or jsonb_typeof(t->'scopeDigest') is distinct from 'string' or t->>'scopeDigest' !~ '^[a-f0-9]{64}$'
   or not public.tenbot_agent_proofs_valid(t->'sources')
   or jsonb_typeof(t->'createdAt') is distinct from 'string' or jsonb_typeof(t->'answeredAt') is distinct from 'string' or jsonb_typeof(t->'expiresAt') is distinct from 'string'
   or t->>'createdAt' !~ '^\d{4}-\d\d-\d\dT' or t->>'answeredAt' !~ '^\d{4}-\d\d-\d\dT' or t->>'expiresAt' !~ '^\d{4}-\d\d-\d\dT'
   or jsonb_typeof(t->'reads') is distinct from 'array' or jsonb_array_length(t->'reads') not between 1 and 4 then return false;end if;
  started:=(t->>'answeredAt')::timestamptz;ended:=(t->>'expiresAt')::timestamptz;
  if (t->>'createdAt')::timestamptz>started or ended<=started or ended>started+interval '10 minutes' then return false;end if;
  for r in select value from jsonb_array_elements(t->'reads') loop
   if jsonb_typeof(r) is distinct from 'object' or (select count(*) from jsonb_object_keys(r))<>3 or not(r ?& array['name','args','digest'])
    or jsonb_typeof(r->'name') is distinct from 'string' or r->>'name' not in ('find_jobs','get_production_overview','get_job_summary','get_job_planning','get_job_labor_summary')
    or jsonb_typeof(r->'digest') is distinct from 'string' or r->>'digest' !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(r->'args') is distinct from 'object' or octet_length((r->'args')::text)>512 then return false;end if;
   a:=r->'args';names:=case r->>'name' when 'find_jobs' then array['query','include_archived','limit','cursor','statuses'] when 'get_production_overview' then array['include_archived','start_date','end_date','limit','statuses'] when 'get_job_labor_summary' then array['job_id','start_date','end_date'] else array['job_id'] end;
   if exists(select 1 from jsonb_object_keys(a) kk where not(kk=any(names))) then return false;end if;
   if r->>'name' like 'get_job_%' and (jsonb_typeof(a->'job_id') is distinct from 'string' or a->>'job_id' !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$') then return false;end if;
   if a ? 'statuses' then
    x:=a->'statuses';
    if jsonb_typeof(x) is distinct from 'array' or jsonb_array_length(x)>7 then return false;end if;
    if exists(select 1 from jsonb_array_elements(x) s(value) where jsonb_typeof(value) is distinct from 'string' or value#>>'{}' not in ('not_started','on_deck','in_production','on_hold','shipped','complete','cancelled'))
     or (select count(distinct value) from jsonb_array_elements(x) s(value))<>jsonb_array_length(x) then return false;end if;
   end if;
   for k,x in select key,value from jsonb_each(a) loop
    if k='include_archived' and jsonb_typeof(x)<>'boolean'
     or k='limit' and (jsonb_typeof(x)<>'number' or (x#>>'{}')::numeric not between 1 and 20 or trunc((x#>>'{}')::numeric)<>(x#>>'{}')::numeric)
     or k='query' and (jsonb_typeof(x)<>'string' or length(x#>>'{}')>120 or x#>>'{}' ~ '[[:cntrl:]]')
     or k='cursor' and (jsonb_typeof(x)<>'string' or x#>>'{}' !~ '^\d{1,4}$')
     or k in ('start_date','end_date') and (jsonb_typeof(x)<>'string' or x#>>'{}' !~ '^\d{4}-\d\d-\d\d$') then return false;end if;
   end loop;
  end loop;
 end loop;
 return true;
exception when others then return false;
end;$$;
commit;
