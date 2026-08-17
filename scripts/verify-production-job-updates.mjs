import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [migration, resolutionMigration, assignmentMigration, jobs, types, inspector, updatesPanel, personnel, indicator] = await Promise.all([
  read('supabase/migrations/20260727_001_production_job_updates.sql'),
  read('supabase/migrations/20260728_001_job_update_resolution_details.sql'),
  read('supabase/migrations/20260817_001_job_update_assignment.sql'),
  read('src/modules/production/jobs.ts'),
  read('src/modules/production/types.ts'),
  read('src/modules/production/components/ProductionJobInspector.tsx'),
  read('src/modules/production/components/JobUpdatesPanel.tsx'),
  read('src/modules/production/production-personnel.ts'),
  read('src/modules/production/components/JobUpdatesIndicator.tsx'),
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
assert.match(assignmentMigration, /add column follow_up_assignee_name text/);
assert.doesNotMatch(assignmentMigration, /check|user_id|json/i);

assert.match(types, /job_update_id: string \| null/);
assert.match(
  types,
  /job_update_attachment_role: "update" \| "resolution" \| null/,
);
assert.match(types, /export type JobUpdate/);
assert.match(types, /resolution_message: string \| null/);
assert.match(types, /follow_up_assignee_name: string \| null/);
assert.match(jobs, /loadJobUpdates/);
assert.match(jobs, /createJobUpdate/);
assert.match(jobs, /resolveJobUpdate/);
assert.match(jobs, /job_update_id: jobUpdateId/);
assert.match(jobs, /uploaded_by: uploadedBy/);
assert.match(jobs, /resolve_job_update/);
assert.match(jobs, /p_resolution_message/);
assert.match(jobs, /job_update_attachment_role/);
assert.match(jobs, /follow_up_assignee_name: requiresFollowUp \? assignee : null/);
assert.match(jobs, /Select who needs to resolve this update/);

assert.match(inspector, /Job Updates/);
assert.match(inspector, /From update/);
assert.match(inspector, /View update/);
assert.match(inspector, /<JobUpdatesPanel/);
assert.match(updatesPanel, /Post a job update/);
assert.match(updatesPanel, /Posting as/);
assert.match(updatesPanel, /Needs attention/);
assert.match(updatesPanel, /Last updated/);
assert.match(updatesPanel, /Update history/);
assert.match(personnel, /Anthony/);
assert.match(personnel, /Chris/);
assert.match(personnel, /Gio/);
assert.match(personnel, /Marcos/);
assert.match(personnel, /Pat/);
assert.match(updatesPanel, /Other…/);
assert.doesNotMatch(updatesPanel, /AUTHOR_OPTIONS/);
assert.match(updatesPanel, /PRODUCTION_PERSONNEL_NAMES/);
assert.match(updatesPanel, /Needs resolution from/);
assert.match(updatesPanel, /followUpAssigneeName/);
assert.match(updatesPanel, /Resolve as/);
assert.match(updatesPanel, /getResolutionResolverName/);
assert.match(updatesPanel, /resolverNamesByUpdate/);
assert.match(updatesPanel, /selectedResolverName/);
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
assert.ok(
  updatesPanel.indexOf('Update history') <
    updatesPanel.indexOf('Post a job update'),
  'Update history should render before the posting composer.',
);
assert.ok(
  updatesPanel.indexOf('Resolution notes') <
    updatesPanel.indexOf('Mark resolved'),
  'Mark resolved should render after the resolution notes field.',
);
assert.match(updatesPanel, /Resolved by/);
assert.match(updatesPanel, /localStorage/);
assert.match(updatesPanel, /uploadJobAttachments/);
assert.match(updatesPanel, /attachmentsByUpdate/);
assert.doesNotMatch(updatesPanel, /deleteJobUpdate|editJobUpdate/);
assert.match(indicator, /openFollowUpAssignees/);
assert.match(indicator, /assigned to/);

console.log('Production Job Updates checks passed.');
