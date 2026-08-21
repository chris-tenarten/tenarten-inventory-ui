import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [migration, rbac, jobs, panel, notifications] = await Promise.all([
  read("supabase/migrations/20260821_001_job_update_deletion.sql"),
  read("src/lib/rbac.ts"),
  read("src/modules/production/jobs.ts"),
  read("src/modules/production/components/JobUpdatesPanel.tsx"),
  read("src/components/AccountNotifications.tsx"),
]);

assert.match(rbac, /"deleteJobUpdate"/);
assert.doesNotMatch(rbac.match(/const member = \[[\s\S]*?\] as const;/)?.[0] ?? "", /deleteJobUpdate/);
assert.match(migration, /values \('admin', 'deleteJobUpdate'\)/);
assert.match(migration, /create or replace function public\.delete_job_update\(p_update_id uuid\)/);
assert.match(migration, /where users\.user_id = auth\.uid\(\) and users\.is_active/);
assert.match(migration, /selected_update\.author_user_id is distinct from caller_user\.user_id[\s\S]*require_app_capability\('deleteJobUpdate'\)/,
  "Only the canonical author or an Admin may delete");
assert.doesNotMatch(migration, /author_name\s*=/, "Display names must not authorize deletion");
for (const notificationType of [
  "job_update_mention",
  "job_update_assignment",
  "job_update_legacy_assignment_enrollment",
]) assert.match(migration, new RegExp(`'${notificationType}'`));
assert.doesNotMatch(migration, /notification_type like/,
  "Deletion must tombstone only the canonical Job Update notification types");
assert.match(migration, /'source_available', false/);
assert.match(migration, /delete from public\.job_updates where id = selected_update\.id/);
assert.match(migration, /revoke all on function public\.delete_job_update\(uuid\) from public, anon/);
assert.match(migration, /grant execute on function public\.delete_job_update\(uuid\) to authenticated/);
assert.doesNotMatch(migration, /delete from public\.job_attachments|delete from storage\./,
  "Deleting an Update must not delete canonical Job files or Storage objects");
assert.match(jobs, /supabase\.rpc\('delete_job_update'/);
assert.match(panel, /update\.author_user_id === auth\.profile\.userId \|\| auth\.can\("deleteJobUpdate"\)/);
assert.match(panel, /role="dialog" aria-modal="true" aria-labelledby="delete-job-update-title"/);
assert.match(notifications, /item\.source_available \? "Open Job Update" : "Job Update no longer available"/);

console.log("Job Update deletion checks passed.");
