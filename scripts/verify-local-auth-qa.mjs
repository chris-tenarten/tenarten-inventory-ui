import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const config = read("auth-qa/supabase/config.toml");
const migration = read("auth-qa/supabase/migrations/00000000000001_auth_qa_identity.sql");
const reset = read("scripts/reset-local-auth-qa.mjs");
const environment = read("scripts/local-auth-qa-env.mjs");
const start = read("scripts/start-local-auth-qa.mjs");
const flow = read("scripts/verify-local-auth-qa-flow.mjs");
const docs = read("docs/local-auth-qa.md");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(config.includes('project_id = "tenops-auth-qa"'), "Auth QA must use an isolated local project");
assert(config.includes('site_url = "http://localhost:3000"'), "Auth callbacks must remain local");
assert(config.includes("[local_smtp]") && config.includes("port = 54324"), "Local email inbox must be enabled");
assert(!config.includes("vxdxjhazkqhpkwdqtobp"), "Hosted project reference must never appear in Auth QA config");
assert(migration.includes("create table public.app_users"), "Local app identity fixture is required");
assert(migration.includes("public.get_my_app_user()"), "Local profile lookup must match the application contract");
assert(reset.includes("pending.user@tenops.local"), "Pending fixture is required");
assert(reset.includes("confirmed.user@tenops.local"), "Confirmed fixture is required");
assert(reset.includes("email_confirm: fixture.emailConfirm"), "Fixtures must preserve pending/confirmed states");
assert(environment.includes('["127.0.0.1", "localhost"]'), "Fixture tooling must reject non-local hosts");
assert(environment.includes('parsedUrl.port !== "54321"'), "Fixture tooling must reject unexpected Supabase ports");
assert(start.includes("NEXT_PUBLIC_SUPABASE_URL: localAuthQa.apiUrl"), "QA dev server must explicitly use local Auth");
assert(flow.includes("pending.user@tenops.local") && flow.includes("confirmed.user@tenops.local"), "Flow verification must exercise both disposable accounts");
assert(flow.includes("scope: \"local\""), "Password flow must close only the local callback session");
assert(flow.includes('startsWith(`${localAuthQa.apiUrl}/auth/v1/verify?`)'), "Flow verification must reject non-local email links");
assert(docs.includes("npm run auth:qa:reset"), "Reset instructions must be documented");
assert(docs.includes("npm run auth:qa:verify-flow"), "End-to-end local flow verification must be documented");
assert(docs.includes("http://127.0.0.1:54324"), "Mailpit location must be documented");

console.log("Local Auth QA harness verification passed.");
