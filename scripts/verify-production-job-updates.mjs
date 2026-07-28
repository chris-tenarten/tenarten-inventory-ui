import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [migration, resolutionMigration, jobs, types, inspector, updatesPanel] = await Promise.all([
  read('supabase/migrations/20260727_001_production_job_updates.sql'),
  read('supabase/migrations/20260728_001_job_update_resolution_details.sql'),
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
assert.match(resolutionMigration, /add column resolution_message text/);
assert.match(
  resolutionMigration,
  /add column job_update_attachment_role text/,
);
assert.match(
  resolutionMigration,
  /job_update_attachment_role in \('update', 'resolution'\)/,
);
assert.match(
  resolutionMigration,
  /p_resolution_message text/,
);
assert.match(
  resolutionMigration,
  /resolution_message = resolution/,
);

assert.match(types, /job_update_id: string \| null/);
assert.match(
  types,
  /job_update_attachment_role: "update" \| "resolution" \| null/,
);
assert.match(types, /export type JobUpdate/);
assert.match(types, /resolution_message: string \| null/);
assert.match(jobs, /loadJobUpdates/);
assert.match(jobs, /createJobUpdate/);
assert.match(jobs, /resolveJobUpdate/);
assert.match(jobs, /job_update_id: jobUpdateId/);
assert.match(jobs, /uploaded_by: uploadedBy/);
assert.match(jobs, /resolve_job_update/);
assert.match(jobs, /p_resolution_message/);
assert.match(jobs, /job_update_attachment_role/);

assert.match(inspector, /Job Updates/);
assert.match(inspector, /From update/);
assert.match(inspector, /View update/);
assert.match(inspector, /<JobUpdatesPanel/);
assert.match(updatesPanel, /Post a job update/);
assert.match(updatesPanel, /Posting as/);
assert.match(updatesPanel, /Needs attention/);
assert.match(updatesPanel, /Last updated/);
assert.match(updatesPanel, /Update history/);
assert.match(updatesPanel, /Chris/);
assert.match(updatesPanel, /Gio/);
assert.match(updatesPanel, /Anthony/);
assert.match(updatesPanel, /Marcos/);
assert.match(updatesPanel, /Pat/);
assert.match(updatesPanel, /Other…/);
assert.match(
  updatesPanel,
  /AUTHOR_OPTIONS = \["Anthony", "Chris", "Gio", "Marcos", "Pat"\]/,
);
assert.match(updatesPanel, /Resolve as/);
assert.match(updatesPanel, /Resolution notes/);
assert.doesNotMatch(updatesPanel, /How was this resolved\?/);
assert.match(updatesPanel, /resolution_message/);
assert.match(updatesPanel, /job_update_attachment_role === "resolution"/);
assert.match(updatesPanel, /"resolution"/);
assert.match(updatesPanel, /border-l-amber-500/);
assert.match(updatesPanel, /onSummaryChanged/);
assert.doesNotMatch(updatesPanel, /Job Updates \(\{updates\.length\}\)/);
assert.doesNotMatch(updatesPanel, /Requires follow-up/);
assert.doesNotMatch(updatesPanel, /Open only/);
assert.match(updatesPanel, /Mark resolved/);
assert.match(updatesPanel, /Resolved by/);
assert.match(updatesPanel, /localStorage/);
assert.match(updatesPanel, /uploadJobAttachments/);
assert.match(updatesPanel, /attachmentsByUpdate/);
assert.doesNotMatch(updatesPanel, /deleteJobUpdate|editJobUpdate/);

console.log('Production Job Updates checks passed.');
