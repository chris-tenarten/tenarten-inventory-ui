begin;

create or replace function public.delete_empty_manpower_reporting_group(
  p_group_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  perform 1
  from public.manpower_reporting_groups
  where id = p_group_id
  for update;

  if not found then
    raise exception 'The reporting group was not found.';
  end if;

  if exists (
    select 1
    from public.manpower_entries
    where reporting_group_id = p_group_id
  ) then
    raise exception 'Only reporting groups without labor entries can be deleted.';
  end if;

  delete from public.manpower_reporting_groups
  where id = p_group_id;
end;
$function$;

revoke all on function public.delete_empty_manpower_reporting_group(uuid) from public;
grant execute on function public.delete_empty_manpower_reporting_group(uuid)
  to anon, authenticated, service_role;

comment on function public.delete_empty_manpower_reporting_group(uuid) is
  'Deletes a Manpower reporting group only while it has no labor entries.';

commit;
