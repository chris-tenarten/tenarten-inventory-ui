-- CANDIDATE ONLY: not applied. Product approval required for shared backend.
-- Replace only the strict context-shape predicate; preserve owner/ACL/search_path,
-- state size/proofs, employee authorization, revision and 120-second lease guards.
-- Prerequisite: ALL readers of this shared store must accept both forms first.
-- Production v77's strict-five-field reader must receive the reviewed reader-only
-- bridge before any isolated/new runtime writes laborScope. See owner release plan.
-- No table, data, policy, grant, spending or business-action changes.
begin;
-- Fail closed if a concurrent change introduced an unreviewed predicate.
-- The second fingerprint allows a verified rerun without resetting any state.
do $compatibility$
begin
 if coalesce((select pg_catalog.md5(p.prosrc) from pg_catalog.pg_proc p
  where p.oid=pg_catalog.to_regprocedure('public.tenbot_conversation_context_valid(jsonb)')),'')
  not in ('e1bfc9cf87eaff3fe1244511389cc6b4','9547d1a73f64e4b2489de497c49c9545') then
  raise exception 'TenBot context validator has an unreviewed predecessor; stop for compatibility review';
 end if;
end; $compatibility$;
CREATE OR REPLACE FUNCTION public.tenbot_conversation_context_valid(v jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare s jsonb; r jsonb; started timestamptz; ended timestamptz;
begin
 if jsonb_typeof(v) is distinct from 'object' or octet_length(v::text)>4096
  or (select count(*) from jsonb_object_keys(v))<>10
  or not(v ?& array['version','subject','operation','resultType','references','selection','sources','awaitingClarification','updatedAt','expiresAt'])
  or v->'version' is distinct from '1'::jsonb
  or coalesce(v->>'subject','') not in ('Production','Job','Intake','Inventory','Purchasing','Planning','Messaging','My Work','Settings','Contacts','Samples','Proposals','Manpower Reporting','TenOps')
  or coalesce(v->>'operation','') not in ('get_production_overview','find_jobs','get_job_summary','get_job_planning','get_job_labor_summary','guidance','scope')
  or coalesce(v->>'resultType','') not in ('count','collection','record','guidance','scope','clarification')
  or jsonb_typeof(v->'awaitingClarification') is distinct from 'boolean'
  or jsonb_typeof(v->'references') is distinct from 'array' or jsonb_array_length(v->'references')>4
  or jsonb_typeof(v->'updatedAt') is distinct from 'string' or jsonb_typeof(v->'expiresAt') is distinct from 'string'
  or v->>'updatedAt' !~ '^\d{4}-\d\d-\d\dT' or v->>'expiresAt' !~ '^\d{4}-\d\d-\d\dT'
  or not public.tenbot_agent_proofs_valid(v->'sources') then return false;end if;
 started:=(v->>'updatedAt')::timestamptz; ended:=(v->>'expiresAt')::timestamptz;
 if ended<=started or ended>started+interval '30 minutes' then return false;end if;
 for r in select value from jsonb_array_elements(v->'references') loop
  if jsonb_typeof(r) is distinct from 'string' or r#>>'{}' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false;end if;
 end loop;
 if (select count(*)<>count(distinct value) from jsonb_array_elements(v->'references')) then return false;end if;
 s:=v->'selection';
 if jsonb_typeof(s) is distinct from 'object' or (select count(*) from jsonb_object_keys(s))<>case when s ? 'laborScope' then 6 else 5 end or not(s ?& array['query','includeArchived','statuses','startDate','endDate'])
  or jsonb_typeof(s->'query') is distinct from 'string' or length(s->>'query')>120 or s->>'query' ~ '[[:cntrl:]]'
  or jsonb_typeof(s->'includeArchived') is distinct from 'boolean'
  or jsonb_typeof(s->'statuses') is distinct from 'array' or jsonb_array_length(s->'statuses')>7 then return false;end if;
 -- The optional extension is exact, not an arbitrary sixth selector.
 -- Null date bounds alone retain their legacy meaning; they do not imply scope.
 if s ? 'laborScope' and (s->'laborScope' is distinct from '"all_recorded"'::jsonb
  or s->'startDate' is distinct from 'null'::jsonb or s->'endDate' is distinct from 'null'::jsonb) then return false;end if;
 for r in select value from jsonb_array_elements(s->'statuses') loop
  if jsonb_typeof(r) is distinct from 'string' or r#>>'{}' not in ('not_started','on_deck','in_production','on_hold','shipped','complete','cancelled') then return false;end if;
 end loop;
 if (select count(*)<>count(distinct value) from jsonb_array_elements(s->'statuses')) then return false;end if;
 if s->'startDate'<>'null'::jsonb or s->'endDate'<>'null'::jsonb then
  if jsonb_typeof(s->'startDate') is distinct from 'string' or jsonb_typeof(s->'endDate') is distinct from 'string'
   or s->>'startDate' !~ '^\d{4}-\d\d-\d\d$' or s->>'endDate' !~ '^\d{4}-\d\d-\d\d$'
   or (s->>'startDate')::date::text<>s->>'startDate' or (s->>'endDate')::date::text<>s->>'endDate'
   or (s->>'endDate')::date<(s->>'startDate')::date or (s->>'endDate')::date-(s->>'startDate')::date>=366 then return false;end if;
 end if;
 return true;
exception when others then return false;
end; $function$;
commit;
