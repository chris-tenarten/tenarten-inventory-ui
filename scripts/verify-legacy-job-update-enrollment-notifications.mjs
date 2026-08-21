import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [migration, notifications, enrollment, admin] = await Promise.all([
  read("supabase/migrations/20260819_002_legacy_job_update_enrollment_notifications.sql"),
  read("src/components/AccountNotifications.tsx"),
  read("src/components/LegacyJobUpdateEnrollment.tsx"),
  read("src/components/AdminSettingsPanel.tsx"),
]);

const previewFunction = migration.match(/create or replace function public\.preview_legacy_job_update_enrollment[\s\S]*?\$function\$;/)?.[0] ?? "";
const executeFunction = migration.match(/create or replace function public\.execute_legacy_job_update_enrollment[\s\S]*?\$function\$;/)?.[0] ?? "";

assert(previewFunction, "Enrollment preview RPC must exist");
assert(executeFunction, "Enrollment execution RPC must exist");
assert.doesNotMatch(previewFunction, /\b(insert|update|delete)\s+(into|public|from)/i, "Preview must perform zero writes");
assert.match(previewFunction, /perform public\.require_app_capability\('manageUsers'\)/, "Preview must be Admin-authorized at the database boundary");
assert.match(executeFunction, /perform public\.require_app_capability\('manageUsers'\)/, "Execution must be Admin-authorized at the database boundary");
assert.match(migration, /btrim\(updates\.follow_up_assignee_name\) = legacy_identity/, "Enrollment must use the explicitly approved exact legacy identity");
assert.doesNotMatch(migration, /updates\.body\s+(ilike|like)|similarity\(|levenshtein/i, "Enrollment must never infer identity from body text or fuzzy matching");
assert.match(previewFunction, /when updates\.resolved_at is not null then 'resolved_excluded'/);
assert.match(previewFunction, /'canonical_assignee_conflict'/);
assert.match(previewFunction, /not target_user\.is_active/);
assert.match(executeFunction, /for update/);
assert.match(executeFunction, /candidate\.resolved_at is not null/);
assert.match(executeFunction, /candidate\.follow_up_assignee_user_id <> p_target_user_id/);
assert.match(executeFunction, /updates\.id = any\(p_approved_update_ids\)/, "Execution must be limited to IDs explicitly reviewed in preview");
assert.match(executeFunction, /set follow_up_assignee_user_id = p_target_user_id/);
assert.doesNotMatch(executeFunction, /set[\s\S]{0,180}(body|author_name|created_at|resolved_at)\s*=/, "Enrollment must preserve historical content and attribution");
assert.match(executeFunction, /'job-update-legacy-assignment-enrollment:' \|\| candidate\.id::text/);
assert.match(executeFunction, /'job_update_legacy_assignment_enrollment'/);
assert.match(executeFunction, /'purpose', 'legacy_assignment_enrollment'/);
assert.match(executeFunction, /on conflict \(user_id, notification_key\) do nothing/);
assert.doesNotMatch(executeFunction, /read_at/, "Enrollment notifications must begin unread through the canonical default");

assert.match(migration, /list_my_account_notification_history\(p_limit integer default 100\)/);
assert.match(migration, /where notifications\.user_id = auth\.uid\(\)[\s\S]*order by notifications\.created_at desc, notifications\.id desc[\s\S]*limit p_limit/);
assert.match(migration, /mark_all_my_account_notifications_read\(\)[\s\S]*where user_id = auth\.uid\(\) and read_at is null/);
assert.match(migration, /mark_my_account_notification_read\(p_notification_id uuid\)[\s\S]*where id = p_notification_id and user_id = auth\.uid\(\)/);
assert.doesNotMatch(migration, /delete from public\.account_notifications/);
assert.match(migration, /revoke all on function public\.preview_legacy_job_update_enrollment\(uuid,text\) from public/);
assert.match(migration, /revoke all on function public\.execute_legacy_job_update_enrollment\(uuid,text,uuid\[\]\) from public/);
assert.doesNotMatch(migration, /grant execute[\s\S]*to anon/);

assert.match(notifications, /"unread" \| "all"/);
assert.match(notifications, /item\.read_at === null/);
assert.match(notifications, /list_my_account_notification_history/);
assert.match(notifications, /mark_all_my_account_notifications_read/);
assert.match(notifications, /You're all caught up\./);
assert.match(notifications, /No notifications yet\./);
assert.doesNotMatch(notifications, /filter\(\(candidate\) => candidate !== item\)/, "Reading must not remove retained history from local state");
assert.match(notifications, /onOpen\(item\)/, "Job Update notifications must retain the canonical deep-link callback");
assert.match(enrollment, /Preview assignments/);
assert.match(enrollment, /Connect \{eligibleCount\} reviewed assignment/);
assert.match(enrollment, /p_approved_update_ids: approvedIds/);
assert.match(admin, /<LegacyJobUpdateEnrollment users=\{users\} \/>/);

// Deterministic model checks use synthetic identities only; no real account or database is touched.
const target = "00000000-0000-4000-8000-000000000101";
const other = "00000000-0000-4000-8000-000000000102";
function eligible(row) {
  const notice = row.notified;
  return row.legacy === "Legacy Operator" && !row.resolved && (!row.userId || row.userId === target) && !notice;
}
assert.equal(eligible({ legacy: "Legacy Operator", resolved: false, userId: null, notified: false }), true);
assert.equal(eligible({ legacy: "legacy operator", resolved: false, userId: null, notified: false }), false, "Matching must not silently change case");
assert.equal(eligible({ legacy: "Legacy Operator", resolved: true, userId: null, notified: false }), false);
assert.equal(eligible({ legacy: "Legacy Operator", resolved: false, userId: other, notified: false }), false);
assert.equal(eligible({ legacy: "Legacy Operator", resolved: false, userId: target, notified: true }), false);
assert.equal(eligible({ legacy: "Legacy Operator", resolved: false, userId: target, notified: false }), true, "Missing notification may be repaired without rewriting assignment");

console.log("Legacy Job Update enrollment and Notification Center checks passed.");
