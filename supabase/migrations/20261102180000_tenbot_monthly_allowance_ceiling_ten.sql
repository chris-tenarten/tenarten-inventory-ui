-- Product-authorized ceiling correction only. The policy must already be OFF;
-- this migration does not fund inference, change policy values or reset usage.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
lock table public.tenbot_openai_policy in access exclusive mode;

do $monthly_allowance_ceiling$
declare
 expected record;actual pg_proc;policy public.tenbot_openai_policy;month_column smallint;
begin
 select * into policy from public.tenbot_openai_policy where singleton for update;
 if not found or policy.enabled then
  raise exception 'Existing monthly allowance policy must be disabled.';
 end if;
 if exists(select 1 from pg_class c
  where c.oid in('public.tenbot_openai_policy'::regclass,'public.tenbot_openai_usage'::regclass)
  and (c.relowner<>'postgres'::regrole or not c.relrowsecurity or c.relforcerowsecurity
   or array(select acl::text from unnest(c.relacl) acl order by acl::text)
    is distinct from array['postgres=arwdDxtm/postgres']::text[]))
  or exists(select 1 from pg_policy
   where polrelid in('public.tenbot_openai_policy'::regclass,'public.tenbot_openai_usage'::regclass)) then
  raise exception 'Exact service-only meter table ownership, ACL and RLS required.';
 end if;
 for expected in select * from(values
  ('public.tenbot_openai_reserve(uuid,uuid,uuid,text,bigint)','493aedf722fcda9e2deb33f1e1669d0f',true,'jsonb',array['lock_timeout=2s','search_path=pg_catalog,public']),
  ('public.tenbot_openai_settle(uuid,uuid,bigint)','9520e66b49b61b98d8a8b4edcc34b886',true,'jsonb',array['lock_timeout=2s','search_path=pg_catalog,public']),
  ('public.tenbot_openai_meter_status()','87c68ce9f5b2dc42db95c717a25337f4',true,'jsonb',array['search_path=pg_catalog,public']),
  ('public.tenbot_openai_preserve_carryover()','9ffd4f0b4e9efbf96c179a7278993432',false,'trigger',array['search_path=pg_catalog,public'])
 ) as contracts(signature,body_md5,security_definer,result_type,configuration) loop
  select * into actual from pg_proc where oid=to_regprocedure(expected.signature);
  if actual.oid is null or md5(actual.prosrc) is distinct from expected.body_md5
   or actual.proowner<>'postgres'::regrole or actual.prosecdef<>expected.security_definer
   or actual.provolatile<>'v' or actual.prorettype<>expected.result_type::regtype
   or actual.prolang<>(select oid from pg_language where lanname='plpgsql')
   or array(select acl::text from unnest(actual.proacl) acl order by acl::text)
    is distinct from (case when expected.security_definer
     then array['postgres=X/postgres','service_role=X/postgres']::text[]
     else array['postgres=X/postgres']::text[] end)
   or array(select regexp_replace(setting,'[[:space:]]','','g') from unnest(actual.proconfig) setting order by setting)
    is distinct from expected.configuration then
   raise exception 'Exact monthly meter predecessor body, interface and security metadata required: %',expected.signature;
  end if;
 end loop;
 if not exists(select 1 from pg_trigger
  where tgrelid='public.tenbot_openai_policy'::regclass
   and tgname='tenbot_openai_preserve_carryover' and not tgisinternal and tgenabled='O'
   and tgfoid='public.tenbot_openai_preserve_carryover()'::regprocedure
   and pg_get_triggerdef(oid)='CREATE TRIGGER tenbot_openai_preserve_carryover BEFORE UPDATE OF legacy_accounted_microusd, legacy_unresolved_microusd ON public.tenbot_openai_policy FOR EACH ROW EXECUTE FUNCTION tenbot_openai_preserve_carryover()') then
  raise exception 'Existing imported-accounting preservation trigger required.';
 end if;
 select attnum into month_column from pg_attribute
  where attrelid='public.tenbot_openai_policy'::regclass and attname='month_limit_microusd'
   and atttypid='bigint'::regtype and attnotnull and not attisdropped;
 if month_column is null or not exists(select 1 from pg_constraint
  where conrelid='public.tenbot_openai_policy'::regclass
   and conname='tenbot_openai_monthly_allowance_ceiling' and contype='c'
   and convalidated and not connoinherit and conkey=array[month_column]
   and pg_get_constraintdef(oid)='CHECK ((month_limit_microusd <= 5000000))')
  or col_description('public.tenbot_openai_policy'::regclass,month_column) is distinct from
   'Ordinary shared USD allowance per UTC calendar month; hard maximum $5. Unknown charges carry forward.' then
  raise exception 'Exact existing $5 monthly ceiling and column comment required.';
 end if;
end $monthly_allowance_ceiling$;

alter table public.tenbot_openai_policy
 drop constraint tenbot_openai_monthly_allowance_ceiling;
alter table public.tenbot_openai_policy
 add constraint tenbot_openai_monthly_allowance_ceiling
 check(month_limit_microusd<=10000000);
comment on column public.tenbot_openai_policy.month_limit_microusd is
 'Ordinary shared USD allowance per UTC calendar month; hard maximum $10. Unknown charges carry forward.';
commit;
