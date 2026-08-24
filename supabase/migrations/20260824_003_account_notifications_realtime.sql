-- Allow authenticated clients to receive their own account notification inserts.
-- Existing SELECT RLS restricts Postgres Changes delivery to auth.uid().

begin;

do $block$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'account_notifications'
  ) then
    alter publication supabase_realtime add table public.account_notifications;
  end if;
end;
$block$;

commit;
