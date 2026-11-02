-- Correct only the Job-ID shape in the existing private display validator.
-- No transcript, claim/revision/lease, permission, grant or RLS change.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';

do $employee_job_uuid_validation$
declare
 target oid:=to_regprocedure('public.tenbot_employee_display_valid(jsonb)');
 original pg_proc;updated pg_proc;definition text;replacement_source text;
 old_pattern text:=$old$v#>>'{}' !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'$old$;
 new_pattern text:=$new$v#>>'{}' !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'$new$;
begin
 select * into original from pg_proc where oid=target;
 if original.oid is null
  or encode(sha256(convert_to(original.prosrc,'UTF8')),'hex') is distinct from '21b9626dbd839ea3d0f158ab06795d7e419206113beecaf3fc628464539b134c'
  or original.proowner<>'postgres'::regrole or original.prosecdef or original.provolatile<>'i'
  or original.prorettype<>'boolean'::regtype or original.prokind<>'f'
  or original.prolang<>(select oid from pg_language where lanname='plpgsql')
  or array(select acl::text from unnest(original.proacl) acl order by acl::text)
   is distinct from array['postgres=X/postgres']::text[]
  or array(select regexp_replace(setting,'[[:space:]]','','g') from unnest(original.proconfig) setting order by setting)
   is distinct from array['search_path=pg_catalog,public']::text[] then
  raise exception 'Exact private display-validator predecessor body and security metadata required.';
 end if;
 if (length(original.prosrc)-length(replace(original.prosrc,old_pattern,'')))/length(old_pattern)<>1
  or to_regprocedure('public.tenbot_agent_proofs_valid(jsonb)') is null then
  raise exception 'One exact Job-ID predicate and existing source-proof validator required.';
 end if;
 replacement_source:=replace(original.prosrc,old_pattern,new_pattern);
 if encode(sha256(convert_to(replacement_source,'UTF8')),'hex')<>'88d014e71ff09998792c22f12f6a153ec546b2c75f01c4ebeb5a49b514745fb3' then
  raise exception 'Exact one-predicate UUID correction required.';
 end if;
 select pg_get_functiondef(target) into definition;
 execute replace(definition,old_pattern,new_pattern);
 select * into updated from pg_proc where oid=target;
 if updated.prosrc is distinct from replacement_source
  or (to_jsonb(updated)-array['prosrc','prosqlbody']) is distinct from
   (to_jsonb(original)-array['prosrc','prosqlbody']) then
  raise exception 'Display correction changed unrelated function identity or metadata.';
 end if;
end $employee_job_uuid_validation$;

commit;
