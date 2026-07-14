begin;

-- Match the current anonymous MVP policy model while limiting deletion to
-- manpower labor entries. Reference records remain deactivate-only.
create policy "Allow anon delete manpower entries"
  on public.manpower_entries for delete to anon using (true);

commit;
