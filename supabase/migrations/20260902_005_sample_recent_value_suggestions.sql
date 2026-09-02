-- Personal, bounded recent-value suggestions for Sample header/setup entry.
begin;

create table public.sample_user_recent_values (
  user_id uuid not null references public.app_users(user_id) on delete cascade,
  field_key text not null check (field_key in (
    'requested_by','project_name','customer_name','finish_requested','sample_size',
    'sample_quantity','filler','sealer','resin_supplier','resin_color_number'
  )),
  normalized_value text not null,
  display_value text not null check (length(display_value) between 1 and 300),
  last_used_at timestamptz not null default clock_timestamp(),
  primary key (user_id, field_key, normalized_value)
);

comment on table public.sample_user_recent_values is
  'Private, bounded autocomplete history for the authenticated user entering Sample header/setup fields.';

alter table public.sample_user_recent_values enable row level security;
revoke all on public.sample_user_recent_values from public, anon, authenticated;
grant all on public.sample_user_recent_values to service_role;

create function public.list_my_sample_recent_values(p_field_key text)
returns table(value text)
language plpgsql stable security definer
set search_path = pg_catalog, public
as $function$
begin
  perform public.require_app_capability('readOperationalData');
  if p_field_key not in (
    'requested_by','project_name','customer_name','finish_requested','sample_size',
    'sample_quantity','filler','sealer','resin_supplier','resin_color_number'
  ) then raise exception 'Unsupported Sample suggestion field.' using errcode = '22023'; end if;

  return query
  select recent.display_value
  from public.sample_user_recent_values recent
  where recent.user_id = auth.uid() and recent.field_key = p_field_key
  order by recent.last_used_at desc, recent.display_value
  limit 15;
end;
$function$;

create function public.record_my_sample_recent_values(p_values jsonb)
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $function$
declare
  entry record;
  clean_value text;
  normalized text;
begin
  perform public.require_app_capability('readOperationalData');
  if jsonb_typeof(p_values) <> 'object' then
    raise exception 'Sample suggestion values must be an object.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_values) key
    where key not in (
      'requested_by','project_name','customer_name','finish_requested','sample_size',
      'sample_quantity','filler','sealer','resin_supplier','resin_color_number'
    )
  ) then raise exception 'Unsupported Sample suggestion field.' using errcode = '22023'; end if;

  for entry in select key, value from jsonb_each_text(p_values)
  loop
    clean_value := regexp_replace(btrim(entry.value), '\s+', ' ', 'g');
    if clean_value <> '' then
      clean_value := left(clean_value, 300);
      normalized := lower(clean_value);
      insert into public.sample_user_recent_values(user_id, field_key, normalized_value, display_value, last_used_at)
      values (auth.uid(), entry.key, normalized, clean_value, clock_timestamp())
      on conflict (user_id, field_key, normalized_value) do update
      set display_value = excluded.display_value, last_used_at = excluded.last_used_at;
    end if;
  end loop;

  delete from public.sample_user_recent_values recent
  using (
    select user_id, field_key, normalized_value,
      row_number() over (partition by user_id, field_key order by last_used_at desc, normalized_value) as position
    from public.sample_user_recent_values
    where user_id = auth.uid()
  ) ranked
  where recent.user_id = ranked.user_id
    and recent.field_key = ranked.field_key
    and recent.normalized_value = ranked.normalized_value
    and ranked.position > 15;
end;
$function$;

alter function public.list_my_sample_recent_values(text) owner to postgres;
alter function public.record_my_sample_recent_values(jsonb) owner to postgres;
revoke all on function public.list_my_sample_recent_values(text) from public, anon;
revoke all on function public.record_my_sample_recent_values(jsonb) from public, anon;
grant execute on function public.list_my_sample_recent_values(text) to authenticated, service_role;
grant execute on function public.record_my_sample_recent_values(jsonb) to authenticated, service_role;

commit;
