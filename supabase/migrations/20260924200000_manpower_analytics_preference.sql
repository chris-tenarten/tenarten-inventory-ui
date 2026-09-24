-- Add exactly one account-owned disclosure preference. No row writes/backfill.
-- Recovery: transaction failure rolls back completely. After commit, retain this
-- additive validator when rolling back the client; old clients ignore the new key.
-- Never restore the old validator while stored rows contain the new key.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $guard$
declare installed record;
begin
  select p.*, r.rolname as owner_name, l.lanname as language_name into installed
  from pg_proc p join pg_roles r on r.oid = p.proowner join pg_language l on l.oid = p.prolang
  where p.oid = to_regprocedure('public.tenops_account_preferences_valid(jsonb)');
  if not found then raise exception 'Account preference validator missing'; end if;
  if md5(installed.prosrc) <> '49d6b6d6f9a16141361585255feb3795'
     or installed.owner_name <> 'postgres' or installed.language_name <> 'plpgsql'
     or installed.provolatile <> 'i' or installed.prosecdef
     or installed.proconfig is distinct from array['search_path=pg_catalog, public']::text[]
     or installed.prorettype <> 'boolean'::regtype then
    raise exception 'Account preference validator drift: inspect before applying';
  end if;
end;
$guard$;

create or replace function public.tenops_account_preferences_valid(p_preferences jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, public
as $function$
declare
  preference_key text;
  preference_value jsonb;
  text_value text;
begin
  if p_preferences is null or jsonb_typeof(p_preferences) <> 'object' then return false; end if;

  for preference_key, preference_value in select key, value from jsonb_each(p_preferences)
  loop
    if preference_key = 'manpower_recent_labor_expanded' then
      if jsonb_typeof(preference_value) <> 'boolean' then return false; end if;
    elsif preference_key = 'appearance' then
      if preference_value not in ('"light"'::jsonb, '"dark"'::jsonb) then return false; end if;
    elsif preference_key = 'language' then
      if preference_value not in ('"en"'::jsonb, '"es"'::jsonb) then return false; end if;
    elsif preference_key = 'display_size' then
      if preference_value not in ('"compact"'::jsonb, '"default"'::jsonb, '"large"'::jsonb) then return false; end if;
    elsif preference_key = 'production_view' then
      if preference_value not in ('"overview"'::jsonb, '"table"'::jsonb, '"timeline"'::jsonb) then return false; end if;
    elsif preference_key = 'production_arrangement' then
      if preference_value not in ('"stage"'::jsonb, '"deadline"'::jsonb, '"labor"'::jsonb) then return false; end if;
    elsif preference_key = 'timeline_zoom' then
      if preference_value not in ('"days"'::jsonb, '"weeks"'::jsonb, '"months"'::jsonb, '"year"'::jsonb) then return false; end if;
    elsif preference_key = 'timeline_row_density' then
      if preference_value not in ('"compact"'::jsonb, '"standard"'::jsonb, '"comfortable"'::jsonb) then return false; end if;
    elsif preference_key = 'collapsed_phase_display' then
      if preference_value not in ('"compact"'::jsonb, '"fill"'::jsonb) then return false; end if;
    elsif preference_key = 'production_table_hidden_columns' then
      if jsonb_typeof(preference_value) <> 'array' then return false; end if;
      for text_value in select jsonb_array_elements_text(preference_value)
      loop
        if text_value not in (
          'customer', 'estimate', 'workOrder', 'deposit', 'delivery', 'start', 'finish',
          'labor', 'days', 'colorPlate', 'sample', 'approval', 'operations', 'material',
          'status', 'remarks'
        ) then return false; end if;
      end loop;
      if jsonb_array_length(preference_value) <> (
        select count(distinct value) from jsonb_array_elements_text(preference_value)
      ) then return false; end if;
    elsif preference_key = 'transmittal_sender' then
      if jsonb_typeof(preference_value) <> 'object' then return false; end if;
      if exists (
        select 1 from jsonb_object_keys(preference_value) key
        where key not in ('name', 'phone', 'email')
      ) then return false; end if;
      if (select count(*) from jsonb_object_keys(preference_value)) > 3 then return false; end if;
      if exists (
        select 1 from jsonb_each(preference_value) entry
        where jsonb_typeof(entry.value) <> 'string' or length(entry.value #>> '{}') > 240
      ) then return false; end if;
    else
      return false;
    end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$function$;

do $verify$
begin
  if not public.tenops_account_preferences_valid('{"manpower_recent_labor_expanded":true}'::jsonb)
     or not public.tenops_account_preferences_valid('{"manpower_recent_labor_expanded":false}'::jsonb)
     or public.tenops_account_preferences_valid('{"manpower_recent_labor_expanded":"true"}'::jsonb)
     or public.tenops_account_preferences_valid('{"manpower_recent_labor_expanded":null}'::jsonb) then
    raise exception 'Account disclosure preference postcondition failed';
  end if;
end;
$verify$;
commit;
