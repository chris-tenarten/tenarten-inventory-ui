import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [migration, identityMigration, jobs, panel, mentionEditor, notifications, shell, indicator, rollout] = await Promise.all([
  read("supabase/migrations/20260819_001_job_update_account_collaboration.sql"),
  read("supabase/migrations/20260818_001_rbac_identity_infrastructure.sql"),
  read("src/modules/production/jobs.ts"),
  read("src/modules/production/components/JobUpdatesPanel.tsx"),
  read("src/modules/production/components/JobUpdateMentionTextarea.tsx"),
  read("src/components/AccountNotifications.tsx"),
  read("src/app/client-layout-shell.tsx"),
  read("src/modules/production/components/JobUpdatesIndicator.tsx"),
  read("supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql"),
]);

assert.match(migration, /create table public\.job_update_mentions/);
assert.match(migration, /primary key \(job_update_id, user_id\)/);
assert.match(migration, /references public\.app_users\(user_id\)/);
assert.match(migration, /where users\.is_active/);
assert.match(migration, /author_name := caller_user\.display_name/,
  "Authenticated Job Update attribution must use canonical app_users.display_name");
assert.match(migration, /select users\.user_id, users\.display_name, users\.role/,
  "Mention suggestions must use canonical app_users.display_name");
assert.match(migration, /perform public\.require_app_capability\('postJobUpdate'\)/,
  "Authenticated posting must require the canonical posting capability");
assert.match(migration, /perform public\.require_app_capability\('editJobUpdate'\)/,
  "Authenticated editing must reject unmapped, inactive, and unauthorized callers");
assert.match(migration, /perform public\.require_app_capability\('assignJobUpdate'\)/,
  "Authenticated assignment changes must require assignment authority");
assert.match(migration, /perform public\.require_app_capability\('resolveJobUpdate'\)/,
  "Authenticated resolution must require resolution authority");
assert.match(identityMigration, /where u\.user_id = auth\.uid\(\) and u\.is_active and c\.capability = p_capability/,
  "Capability enforcement must reject unmapped and inactive authenticated callers");
assert.match(identityMigration, /if auth\.uid\(\) is null or not public\.has_app_capability\(p_capability\) then[\s\S]*errcode = '42501'/,
  "Unauthorized authenticated callers must be rejected at the RPC boundary");
assert.match(identityMigration, /\('member','postJobUpdate'\), \('member','editJobUpdate'\),[\s\S]*\('member','assignJobUpdate'\), \('member','resolveJobUpdate'\)/,
  "An authorized active Member must retain the established Job Update capabilities");
assert.match(migration, /resolver_name := caller_user\.display_name/,
  "Authenticated resolver attribution must come from the caller profile");
assert.match(migration, /resolver_user_id := caller_user\.user_id/,
  "Authenticated resolver identity must come from the caller profile");
assert.doesNotMatch(migration, /\bcurrent_user\b/,
  "PL/pgSQL record variables must not collide with PostgreSQL CURRENT_USER");
assert.match(migration, /p_user_id = auth\.uid\(\)/, "Self mentions must not notify");
assert.match(migration, /on conflict \(user_id, notification_key\) do nothing/, "Notification keys must be idempotent");
assert.match(migration, /'job-update-' \|\| p_purpose \|\| ':' \|\| p_update\.id::text/);
assert.match(migration, /delete from public\.job_update_mentions/);
assert.match(migration, /if mentions_changed then[\s\S]*edited_at = clock_timestamp\(\)/,
  "A persisted mention-only edit must receive normal edited-state attribution");
assert.match(migration, /insert into public\.job_update_mentions[\s\S]*on conflict do nothing[\s\S]*returning user_id/,
  "Only newly added mentions should produce notification work");
assert.match(migration, /'mention' then 'You were mentioned in a Job Update'/);
assert.match(migration, /'A Job Update was assigned to you'/);
assert.match(migration, /'job_id', p_update\.job_id/);
assert.match(migration, /'update_id', p_update\.id/);
assert.match(migration, /auth\.uid\(\) is null and coalesce\(cardinality\(p_mentioned_user_ids\), 0\) > 0/,
  "Anonymous compatibility may post but cannot forge canonical mentions");
assert.match(migration, /elsif author_name is null then[\s\S]*elsif p_follow_up_assignee_user_id is not null then/,
  "Anonymous compatibility posting must retain legacy name attribution while rejecting canonical account assignment");
assert.match(migration, /if auth\.uid\(\) is not null then[\s\S]*perform public\.sync_job_update_mentions\(edited_update, p_mentioned_user_ids\)/,
  "Anonymous compatibility edits must preserve existing canonical mentions");
assert.match(migration, /existing_update\.follow_up_assignee_name is not distinct from assignee_name[\s\S]*existing_update\.follow_up_assignee_user_id/,
  "Anonymous body edits must preserve an unchanged canonical assignment");
assert.match(migration, /revoke all on function public\.notify_job_update_account[\s\S]*from public/,
  "The notification helper must not be browser executable");
assert.match(migration, /revoke all on function public\.sync_job_update_mentions[\s\S]*from public/,
  "The mention synchronization helper must not be browser executable");
assert.doesNotMatch(migration, /grant execute on function public\.notify_job_update_account/,
  "No client role may invoke the notification helper directly");
assert.doesNotMatch(migration, /grant execute on function public\.sync_job_update_mentions/,
  "No client role may invoke the mention helper directly");
assert.doesNotMatch(migration, /insert into public\.account_notifications[\s\S]*select[\s\S]*from public\.job_updates[\s\S]*where.*created_at/i,
  "The migration must not backfill historical notifications");

assert.match(jobs, /create_job_update_with_mentions/);
assert.match(jobs, /edit_job_update_with_mentions/);
assert.match(jobs, /resolve_job_update_with_identity/);
assert.match(jobs, /list_active_job_update_collaborators/);
assert.match(jobs, /list_job_update_mentions/);
assert.match(panel, /JobUpdateMentionTextarea/);
assert.match(panel, /Type @ to mention an active TenOps user|collaborators/);
assert.match(panel, /collaborators\.filter\(\(user\) => !\["developer", "guest"\]\.includes\(user\.role\.toLocaleLowerCase\(\)\)\)/,
  "New mention suggestions must exclude the canonical Developer and Guest roles");
assert.doesNotMatch(panel, /displayName.*developer|email.*developer/i,
  "Developer mention eligibility must not be inferred from names or email addresses");
assert.match(panel, /setMentionsByUpdate\(loadedMentions\.reduce/,
  "Historical canonical mentions must continue loading independently of autocomplete eligibility");
assert.doesNotMatch(panel, /setOpenOnly|openOnly/,
  "Job Update history must no longer expose the retired Needs attention filter");
assert.doesNotMatch(panel, /checked=\{requiresFollowUp\}|setRequiresFollowUp/,
  "The Job Update composer must no longer expose the retired Needs attention checkbox");
assert.match(panel, /createJobUpdate\([\s\S]*?body,\s*false,\s*null,\s*null,/,
  "Ordinary Job Updates must post without the retired manual follow-up classification");
assert.match(panel, /auth\.profile\?\.displayName \?\? authorName/);
assert.match(panel, /Resolve as <strong[^>]*>\{operationalFirstName\(auth\.profile\?\.displayName\)\}/,
  "Authenticated resolution UI must present the caller-derived identity by first name");
assert.match(mentionEditor, /nextValue\.includes\(`@\$\{mention\.displayName\}`\)/,
  "Removing readable mention text must remove its canonical selection");
assert.match(mentionEditor, /mentions\.some\(\(mention\) => mention\.userId === user\.userId\)/,
  "The autocomplete must prevent duplicate structured mentions");
assert.match(mentionEditor, /onClick=\{\(\) => selectMention\(user\)\}/,
  "Mention autocomplete must support explicit mouse selection");
assert.match(mentionEditor, /font-medium text-blue-700/,
  "Selected canonical mentions must render blue immediately in the composer");
assert.match(mentionEditor, /mentions\.length > 0 \? "bg-transparent text-transparent caret-slate-900"/,
  "Composer highlighting must remain synchronized with the editable textarea");
for (const key of ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"]) {
  assert.match(mentionEditor, new RegExp(`event\\.key === \\\"${key}\\\"|\\[\\\"ArrowDown\\\", \\\"ArrowUp\\\", \\\"Enter\\\", \\\"Tab\\\", \\\"Escape\\\"\\]`),
    `Mention autocomplete must handle ${key}`);
}
assert.match(panel, /renderMentionedBody\(update\.body, mentionsByUpdate\[update\.id\]/,
  "Saved canonical mentions must render inline in the Job Update body");
assert.match(panel, /mentionByToken\.has\(part\)/,
  "Inline styling must be driven by canonical stored mention relationships");
assert.doesNotMatch(panel, /aria-label="Mentioned users"/,
  "Saved mentions must not be repeated as redundant chips");

assert.doesNotMatch(notifications, /list_my_job_update_notifications/,
  "Account notifications must no longer conflate unresolved assignment state with unread state");
assert.match(notifications, /mark_my_account_notification_read/);
assert.match(notifications, /onOpen\(item\)/);
assert.match(shell, /job-updates:\$\{notification\.update_id\}/,
  "Notification navigation must target the canonical Job Update focus identifier");
assert.match(panel, /focusedUpdateId === update\.id \? "ring-2 ring-blue-600 ring-offset-2"/,
  "The exact targeted update must be visually apparent");
assert.match(indicator, /data-job-updates-unseen-dot/);
assert.match(indicator, /absolute -right-0\.5 -top-0\.5/);
assert.match(indicator, /aria-hidden="true" className="text-\[9px\].*">\|<\/span>/);
assert.doesNotMatch(indicator, /if \(summary\.total === 0\) return null/,
  "Zero-update Jobs must retain the permanent Job Updates navigation control");
assert.match(indicator, /hasUnseenActivity = hasUpdates && summary\.hasUnseenActivity/,
  "Unseen activity must be impossible when the canonical Update count is zero");
assert.doesNotMatch(indicator, /Flag|openFollowUpAssignees/);
assert.match(rollout, /create table if not exists public\.job_update_seen_state/);
assert.match(rollout, /primary key \(user_id, job_id\)/);
assert.match(rollout, /updates\.author_user_id is distinct from auth\.uid\(\)/);
assert.match(rollout, /job_update_mentions mentions[\s\S]*mentions\.user_id = auth\.uid\(\)/);
assert.match(rollout, /updates\.follow_up_assignee_user_id = auth\.uid\(\)/);
assert.match(rollout, /mark_my_job_updates_seen/);
assert.match(rollout, /grant execute on function public\.mark_my_job_updates_seen\(uuid\) to authenticated/);
assert.doesNotMatch(rollout, /grant execute on function public\.mark_my_job_updates_seen\(uuid\) to anon/);

console.log("Job Update account collaboration checks passed.");
