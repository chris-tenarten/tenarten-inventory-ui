-- Bounded private rendered operational answers; never raw tool snapshots/model context.
-- Owner/lease/CAS/RLS contracts unchanged. Application reauthorizes exact tool reads
-- before any publication; display expiry is independent of conversation renewal.
begin;
create function public.tenbot_operational_receipts_valid(v jsonb) returns boolean
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
   a:=r->'args';names:=case r->>'name' when 'find_jobs' then array['query','include_archived','limit','cursor'] when 'get_production_overview' then array['include_archived','start_date','end_date','limit'] when 'get_job_labor_summary' then array['job_id','start_date','end_date'] else array['job_id'] end;
   if exists(select 1 from jsonb_object_keys(a) kk where not(kk=any(names))) then return false;end if;
   if r->>'name' like 'get_job_%' and (jsonb_typeof(a->'job_id') is distinct from 'string' or a->>'job_id' !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$') then return false;end if;
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
alter function public.tenbot_operational_receipts_valid(jsonb) owner to postgres;
revoke all on function public.tenbot_operational_receipts_valid(jsonb) from public,anon,authenticated,service_role;

create or replace function public.tenbot_agent_state_valid(p_state jsonb,p_conversation_id uuid) returns boolean
language plpgsql immutable set search_path=pg_catalog,public as $$
declare t jsonb;a jsonb;
begin
 if jsonb_typeof(p_state) is distinct from 'object' or octet_length(p_state::text)>64000
  or (select count(*) from jsonb_object_keys(p_state)) not between 2 and 4 or not(p_state ?& array['guidance','display'])
  or exists(select 1 from jsonb_object_keys(p_state) k where k not in ('guidance','display','context','operational'))
  or (p_state ? 'context' and p_state->'context' <> 'null'::jsonb and not public.tenbot_conversation_context_valid(p_state->'context'))
  or (p_state ? 'operational' and not public.tenbot_operational_receipts_valid(p_state->'operational'))
  or jsonb_typeof(p_state->'guidance') is distinct from 'array' or jsonb_array_length(p_state->'guidance')>3
  or jsonb_typeof(p_state->'display') is distinct from 'array' or jsonb_array_length(p_state->'display')>8 then return false;end if;
 for t in select value from jsonb_array_elements(p_state->'guidance') loop
  if jsonb_typeof(t) is distinct from 'object' or (select count(*) from jsonb_object_keys(t))<>3
   or not(t ?& array['question','answer','sources']) or jsonb_typeof(t->'question') is distinct from 'string' or length(t->>'question') not between 1 and 1200
   or jsonb_typeof(t->'answer') is distinct from 'string' or length(t->>'answer') not between 1 and 2400
   or not public.tenbot_agent_proofs_valid(t->'sources') or jsonb_array_length(t->'sources')<1 then return false;end if;
 end loop;
 for t in select value from jsonb_array_elements(p_state->'display') loop
  if jsonb_typeof(t) is distinct from 'object' or (select count(*) from jsonb_object_keys(t))<>7
   or not(t ?& array['id','question','createdAt','answeredAt','answer','sources','scopeDigest'])
   or jsonb_typeof(t->'id') is distinct from 'string' or t->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or jsonb_typeof(t->'question') is distinct from 'string' or length(t->>'question') not between 1 and 1200
   or jsonb_typeof(t->'createdAt') is distinct from 'string' or jsonb_typeof(t->'answeredAt') is distinct from 'string'
   or t->>'createdAt' !~ '^\d{4}-\d\d-\d\dT' or t->>'answeredAt' !~ '^\d{4}-\d\d-\d\dT'
   or not public.tenbot_agent_proofs_valid(t->'sources') or jsonb_typeof(t->'scopeDigest') is distinct from 'string' or t->>'scopeDigest' !~ '^[a-f0-9]{64}$' then return false;end if;
  perform (t->>'createdAt')::timestamptz,(t->>'answeredAt')::timestamptz;
  a=t->'answer';
  if jsonb_typeof(a) is distinct from 'object' or (select count(*) from jsonb_object_keys(a))<>9
   or not(a ?& array['conversationId','mode','contentScope','message','sources','snapshot','summary','suggestionAllowed','notices'])
   or jsonb_typeof(a->'conversationId') is distinct from 'string' or a->>'conversationId' is distinct from p_conversation_id::text
   or a->>'mode' is distinct from 'assistant' or coalesce(a->>'contentScope','') not in ('workflow','scope')
   or jsonb_typeof(a->'message') is distinct from 'string' or length(a->>'message') not between 1 and 2400
   or a->'sources' is distinct from '[]'::jsonb or a->'notices' is distinct from '[]'::jsonb or a->'summary' is distinct from 'null'::jsonb
   or a->'suggestionAllowed' is distinct from 'false'::jsonb or jsonb_typeof(a->'snapshot') is distinct from 'object'
   or (select count(*) from jsonb_object_keys(a->'snapshot'))<>2 or not((a->'snapshot') ?& array['revision','verifiedAt'])
   or jsonb_typeof(a->'snapshot'->'revision') is distinct from 'string' or length(a->'snapshot'->>'revision') not between 1 and 100
   or jsonb_typeof(a->'snapshot'->'verifiedAt') is distinct from 'string'
   or a->'snapshot'->>'verifiedAt' !~ '^\d{4}-\d\d-\d\dT'
   or a->>'contentScope'='workflow' and jsonb_array_length(t->'sources')<1 then return false;end if;
  perform (a->'snapshot'->>'verifiedAt')::timestamptz;
 end loop;
 return true;
exception when others then return false;
end; $$;

-- No table, RLS, role capability, claim or business-tool changes.
notify pgrst,'reload schema';
commit;
