-- Temporary RBAC compatibility bridge.
-- Preserve the legacy anonymous application contract for authenticated sessions
-- until the separately authorized final enforcement cutover.

begin;

-- Production Jobs and their operational activity used legacy anon-only policies.
drop policy if exists "Compatibility authenticated read jobs" on public.jobs;
drop policy if exists "Compatibility authenticated insert jobs" on public.jobs;
drop policy if exists "Compatibility authenticated update jobs" on public.jobs;
drop policy if exists "Compatibility authenticated delete jobs" on public.jobs;
create policy "Compatibility authenticated read jobs" on public.jobs for select to authenticated using (true);
create policy "Compatibility authenticated insert jobs" on public.jobs for insert to authenticated with check (true);
create policy "Compatibility authenticated update jobs" on public.jobs for update to authenticated using (true) with check (true);
create policy "Compatibility authenticated delete jobs" on public.jobs for delete to authenticated using (true);
grant select, insert, update, delete on public.jobs to authenticated;

drop policy if exists "Compatibility authenticated read job activity" on public.job_activity;
drop policy if exists "Compatibility authenticated insert job activity" on public.job_activity;
drop policy if exists "Compatibility authenticated update job activity" on public.job_activity;
drop policy if exists "Compatibility authenticated delete job activity" on public.job_activity;
create policy "Compatibility authenticated read job activity" on public.job_activity for select to authenticated using (true);
create policy "Compatibility authenticated insert job activity" on public.job_activity for insert to authenticated with check (true);
create policy "Compatibility authenticated update job activity" on public.job_activity for update to authenticated using (true) with check (true);
create policy "Compatibility authenticated delete job activity" on public.job_activity for delete to authenticated using (true);
grant select, insert, update, delete on public.job_activity to authenticated;

-- Production Job attachment metadata and the existing private bucket.
drop policy if exists "Compatibility authenticated read job attachments" on public.job_attachments;
drop policy if exists "Compatibility authenticated insert job attachments" on public.job_attachments;
drop policy if exists "Compatibility authenticated delete job attachments" on public.job_attachments;
create policy "Compatibility authenticated read job attachments" on public.job_attachments for select to authenticated using (true);
create policy "Compatibility authenticated insert job attachments" on public.job_attachments for insert to authenticated with check (true);
create policy "Compatibility authenticated delete job attachments" on public.job_attachments for delete to authenticated using (true);
grant select, insert, delete on public.job_attachments to authenticated;

drop policy if exists "Compatibility authenticated read job attachment objects" on storage.objects;
drop policy if exists "Compatibility authenticated upload job attachment objects" on storage.objects;
drop policy if exists "Compatibility authenticated delete job attachment objects" on storage.objects;
create policy "Compatibility authenticated read job attachment objects"
  on storage.objects for select to authenticated using (bucket_id = 'job-attachments');
create policy "Compatibility authenticated upload job attachment objects"
  on storage.objects for insert to authenticated with check (bucket_id = 'job-attachments');
create policy "Compatibility authenticated delete job attachment objects"
  on storage.objects for delete to authenticated using (bucket_id = 'job-attachments');

-- Manpower reporting was also introduced before authenticated compatibility
-- policies became the repository convention.
drop policy if exists "Compatibility authenticated read manpower workers" on public.manpower_workers;
drop policy if exists "Compatibility authenticated insert manpower workers" on public.manpower_workers;
drop policy if exists "Compatibility authenticated update manpower workers" on public.manpower_workers;
create policy "Compatibility authenticated read manpower workers" on public.manpower_workers for select to authenticated using (true);
create policy "Compatibility authenticated insert manpower workers" on public.manpower_workers for insert to authenticated with check (true);
create policy "Compatibility authenticated update manpower workers" on public.manpower_workers for update to authenticated using (true) with check (true);
grant select, insert, update on public.manpower_workers to authenticated;

drop policy if exists "Compatibility authenticated read manpower tasks" on public.manpower_tasks;
drop policy if exists "Compatibility authenticated insert manpower tasks" on public.manpower_tasks;
drop policy if exists "Compatibility authenticated update manpower tasks" on public.manpower_tasks;
create policy "Compatibility authenticated read manpower tasks" on public.manpower_tasks for select to authenticated using (true);
create policy "Compatibility authenticated insert manpower tasks" on public.manpower_tasks for insert to authenticated with check (true);
create policy "Compatibility authenticated update manpower tasks" on public.manpower_tasks for update to authenticated using (true) with check (true);
grant select, insert, update on public.manpower_tasks to authenticated;

drop policy if exists "Compatibility authenticated read manpower entries" on public.manpower_entries;
drop policy if exists "Compatibility authenticated insert manpower entries" on public.manpower_entries;
drop policy if exists "Compatibility authenticated update manpower entries" on public.manpower_entries;
drop policy if exists "Compatibility authenticated delete manpower entries" on public.manpower_entries;
create policy "Compatibility authenticated read manpower entries" on public.manpower_entries for select to authenticated using (true);
create policy "Compatibility authenticated insert manpower entries" on public.manpower_entries for insert to authenticated with check (true);
create policy "Compatibility authenticated update manpower entries" on public.manpower_entries for update to authenticated using (true) with check (true);
create policy "Compatibility authenticated delete manpower entries" on public.manpower_entries for delete to authenticated using (true);
grant select, insert, update, delete on public.manpower_entries to authenticated;

drop policy if exists "Compatibility authenticated read manpower reporting groups" on public.manpower_reporting_groups;
drop policy if exists "Compatibility authenticated insert manpower reporting groups" on public.manpower_reporting_groups;
drop policy if exists "Compatibility authenticated update manpower reporting groups" on public.manpower_reporting_groups;
create policy "Compatibility authenticated read manpower reporting groups" on public.manpower_reporting_groups for select to authenticated using (true);
create policy "Compatibility authenticated insert manpower reporting groups" on public.manpower_reporting_groups for insert to authenticated with check (true);
create policy "Compatibility authenticated update manpower reporting groups" on public.manpower_reporting_groups for update to authenticated using (true) with check (true);
grant select, insert, update on public.manpower_reporting_groups to authenticated;

commit;
