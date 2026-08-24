import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const notifications = read("src/components/AccountNotifications.tsx");
const navigation = read("src/modules/production/job-options.ts");
const shell = read("src/app/client-layout-shell.tsx");
const migration = read("supabase/migrations/20260824_003_account_notifications_realtime.sql");
const workspace = read("src/modules/production/ProductionWorkspace.tsx");
const inspector = read("src/modules/production/components/ProductionJobInspector.tsx");
const updates = read("src/modules/production/components/JobUpdatesPanel.tsx");

assert.match(notifications, /event: "INSERT", schema: "public", table: "account_notifications"/);
assert.match(notifications, /filter: `user_id=eq\.\$\{profileUserId\}`/);
assert.match(notifications, /inserted\.user_id !== profileUserId/);
assert.match(notifications, /supabase\.removeChannel\(channel\)/);
assert.match(notifications, /pendingLiveIdsRef/);
assert.match(notifications, /observeLiveNotificationArrival/);
assert.match(shell, /`job-updates:\$\{notification\.update_id\}`/);
assert.match(navigation, /PRODUCTION_JOB_FOCUS_SECTION_STORAGE_KEY, focus/);
assert.match(navigation, /open-production-job=\$\{encodeURIComponent\(jobId\)\}/);
assert.doesNotMatch(workspace, /const focusedSection = .*\n\s*window\.sessionStorage\.removeItem/, "Production must not clear pending focus immediately after reading it");
assert.match(workspace, /onInitialFocusResolved=/);
assert.match(workspace, /key=\{`\$\{selectedJob\.id\}:\$\{inspectorFocus \?\? ''\}`\}/);
assert.match(workspace, /getItem\(PRODUCTION_JOB_FOCUS_SECTION_STORAGE_KEY\) === focus/);
assert.match(inspector, /onFocusedUpdateResolved=/);
assert.match(updates, /getElementById\(`job-update-\$\{focusedUpdateId\}`\)/);
assert.match(updates, /onFocusedUpdateResolved\?\.\(focusedUpdateId, true\)/);
assert.match(updates, /onFocusedUpdateResolved\?\.\(focusedUpdateId, false\)/);
assert.match(migration, /alter publication supabase_realtime add table public\.account_notifications/);
assert.match(migration, /pg_catalog\.pg_publication_tables/);

console.log("Notification live-arrival and Job Update deep-link checks passed.");
