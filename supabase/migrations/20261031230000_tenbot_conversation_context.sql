-- Retain only strict lookup selectors in the existing owner/lease/CAS store.
-- No new table, read policy, role capability, business tool or write authority.
-- Existing two-key states remain valid; migration application is separately gated.
begin;
create function public.tenbot_conversation_context_valid(v jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog,public as $$
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
 if jsonb_typeof(s) is distinct from 'object' or (select count(*) from jsonb_object_keys(s))<>5 or not(s ?& array['query','includeArchived','statuses','startDate','endDate'])
  or jsonb_typeof(s->'query') is distinct from 'string' or length(s->>'query')>120 or s->>'query' ~ '[[:cntrl:]]'
  or jsonb_typeof(s->'includeArchived') is distinct from 'boolean'
  or jsonb_typeof(s->'statuses') is distinct from 'array' or jsonb_array_length(s->'statuses')>7 then return false;end if;
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
end; $$;
alter function public.tenbot_conversation_context_valid(jsonb) owner to postgres;
revoke all on function public.tenbot_conversation_context_valid(jsonb) from public,anon,authenticated,service_role;

create or replace function public.tenbot_agent_state_valid(p_state jsonb,p_conversation_id uuid) returns boolean
language plpgsql immutable set search_path=pg_catalog,public as $$
declare t jsonb;a jsonb;
begin
 if jsonb_typeof(p_state) is distinct from 'object' or octet_length(p_state::text)>64000
  or (select count(*) from jsonb_object_keys(p_state)) not in (2,3) or not(p_state ?& array['guidance','display'])
  or exists(select 1 from jsonb_object_keys(p_state) k where k not in ('guidance','display','context'))
  or (p_state ? 'context' and p_state->'context' <> 'null'::jsonb and not public.tenbot_conversation_context_valid(p_state->'context'))
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

-- Claim/load/commit/release/clear, their ACLs and owner RLS remain unchanged.
notify pgrst,'reload schema';
commit;
