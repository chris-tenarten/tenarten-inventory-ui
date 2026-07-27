import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [migration, jobs, types, inspector, updatesPanel] = await Promise.all([
  read('supabase/migrations/20260727_001_production_job_updates.sql'),
  read('src/modules/production/jobs.ts'),
  read('src/modules/production/types.ts'),
  read('src/modules/production/components/ProductionJobInspector.tsx'),
  read('src/modules/production/components/JobUpdatesPanel.tsx'),
]);

assert.match(migration, /create table public\.job_updates/);
assert.match(migration, /job_id uuid not null references public\.jobs\(id\) on delete cascade/);
assert.match(migration, /requires_follow_up boolean not null default false/);
assert.match(migration, /resolved_at timestamptz/);
assert.match(migration, /resolved_by_name text/);
assert.match(migration, /add column job_update_id uuid references public\.job_updates\(id\) on delete set null/);
assert.match(migration, /Attachment and Job Update must belong to the same Production job/);
assert.match(migration, /create or replace function public\.resolve_job_update/);
assert.match(migration, /security definer/);
assert.match(migration, /set search_path = public, pg_temp/);
assert.doesNotMatch(migration, /policy .*delete job updates/i);

assert.match(types, /job_update_id: string \| null/);
assert.match(types, /export type JobUpdate/);
assert.match(jobs, /loadJobUpdates/);
assert.match(jobs, /createJobUpdate/);
assert.match(jobs, /resolveJobUpdate/);
assert.match(jobs, /job_update_id: jobUpdateId/);
assert.match(jobs, /uploaded_by: uploadedBy/);
assert.match(jobs, /resolve_job_update/);

assert.match(inspector, /Job Updates/);
assert.match(inspector, /From update/);
assert.match(inspector, /View update/);
assert.match(inspector, /<JobUpdatesPanel/);
assert.match(updatesPanel, /Requires follow-up/);
assert.match(updatesPanel, /Open only/);
assert.match(updatesPanel, /Mark resolved/);
assert.match(updatesPanel, /Resolved by/);
assert.match(updatesPanel, /localStorage/);
assert.match(updatesPanel, /uploadJobAttachments/);
assert.match(updatesPanel, /attachmentsByUpdate/);
assert.doesNotMatch(updatesPanel, /deleteJobUpdate|editJobUpdate/);

console.log('Production Job Updates checks passed.');
