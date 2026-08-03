begin;

do $$
begin
  if to_regclass('public.whiteboard_cards') is null then
    raise exception 'WHITEBOARD_PRIVILEGE_REPAIR_MISSING_TABLE';
  end if;
end $$;

revoke all privileges on table public.whiteboard_cards from public, anon, authenticated, service_role;

grant select, insert, update, delete on table public.whiteboard_cards to anon, authenticated;
grant all privileges on table public.whiteboard_cards to service_role;

commit;
