import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { operationalFirstName } from "../src/lib/identity-presentation";

assert.equal(operationalFirstName("  Taylor   Morgan  "), "Taylor");
assert.equal(operationalFirstName("Taylor"), "Taylor");
assert.equal(operationalFirstName(""), "");
assert.equal(operationalFirstName(null), "");

const hero = readFileSync(new URL("../src/components/WelcomeHero.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../src/app/client-layout-shell.tsx", import.meta.url), "utf8");
const jobs = readFileSync(new URL("../src/modules/production/jobs.ts", import.meta.url), "utf8");
const updates = readFileSync(new URL("../src/modules/production/components/JobUpdatesPanel.tsx", import.meta.url), "utf8");
const helper = readFileSync(new URL("../src/lib/identity-presentation.ts", import.meta.url), "utf8");
const collaboration = readFileSync(new URL("../supabase/migrations/20260819_001_job_update_account_collaboration.sql", import.meta.url), "utf8");

assert.match(hero, /data-welcome-account-identity[\s\S]*\{auth\.profile\.displayName\}/, "Welcome must use the full canonical display name");
assert.doesNotMatch(hero, /Welcome, \{auth\.profile\.displayName\}/, "Welcome must present identity without redundant greeting copy");
assert.doesNotMatch(hero, /operationalFirstName/, "Welcome must not shorten the canonical display name");
assert.match(shell, /operationalFirstName\(auth\.profile\.displayName\)/);
assert.match(updates, /Posting as <strong[^>]*>\{operationalFirstName\(auth\.profile\.displayName\)\}/);
assert.match(jobs, /displayName: operationalFirstName\(row\.display_name\)/,
  "Mention suggestions and persisted mention presentation must derive from canonical display_name");
assert.match(collaboration, /author_name := caller_user\.display_name/,
  "Canonical authenticated authorship must continue to originate from app_users.display_name");
assert.match(collaboration, /author_name, author_user_id, body/, "Canonical author_user_id must remain persisted");
assert.match(collaboration, /follow_up_assignee_user_id/, "Canonical assignment user_id must remain persisted");
assert.match(collaboration, /resolver_user_id := caller_user\.user_id/, "Canonical resolver user_id must remain authoritative");
assert.doesNotMatch(helper, /Chris|Giovanni|Anthony|Patrick|Marcos/);

for (const migration of [
  "20260818_001_rbac_identity_infrastructure.sql",
  "20260819_001_job_update_account_collaboration.sql",
  "20260821_002_friday_welcome_and_job_update_seen.sql",
]) {
  const source = readFileSync(new URL(`../supabase/migrations/${migration}`, import.meta.url), "utf8");
  assert.doesNotMatch(source, /\bfirst_name\b/, `${migration} must not introduce a first_name field`);
}

console.log("Identity presentation checks passed.");
