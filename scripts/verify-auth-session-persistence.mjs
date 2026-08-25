import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [client, auth, access, shell, hero, notifications] = await Promise.all([
  read("src/lib/supabase.ts"),
  read("src/lib/auth.tsx"),
  read("src/components/AccountAccessPanel.tsx"),
  read("src/app/client-layout-shell.tsx"),
  read("src/components/WelcomeHero.tsx"),
  read("src/components/AccountNotifications.tsx"),
]);

assert.match(client, /persistSession: true/);
assert.match(client, /autoRefreshToken: true/);
assert.match(client, /detectSessionInUrl: true/);
assert.match(auth, /supabase\.auth\.getSession\(\)[\s\S]{0,420}setSession\(data\.session\)[\s\S]{0,160}loadProfile\(data\.session\)[\s\S]{0,100}setReady\(true\)/,
  "Startup must restore the persisted session and profile before Auth becomes ready");
assert.match(shell, /auth\.ready[\s\S]{0,140}<AccountAccessPanel/,
  "The credential form must wait for persisted-session restoration");
assert.match(shell, /Restoring your TenOps session…/);
assert.match(access, /autoComplete="email"/);
assert.match(access, /autoComplete=\{activeMode === "password" \? "new-password" : "current-password"\}/);
assert.doesNotMatch(access, /CUTOVER_NOTICE_KEY|TenOps account sign-in is changing|legacy TenOps access method/,
  "The obsolete RBAC/login announcement must not remain active");
assert.doesNotMatch(client, /password|credential/i,
  "The Supabase client must not introduce application-managed password storage");

for (const flow of ["setup", "recovery"]) assert.match(auth, new RegExp(`accountFlow === "${flow}"`));
assert.match(auth, /event === "PASSWORD_RECOVERY" \|\| callbackFlow/);
assert.match(auth, /signOut\(\{ scope: "local" \}\)/);
assert.match(hero, /!auth\.requiresPasswordSetup/);
assert.match(auth, /ensure_my_welcome_notification/);
assert.match(notifications, /item\.notification_type === "welcome"/);
assert.match(notifications, /item\.notification_type\.startsWith\("job_update_"\)/);

console.log("TenOps persisted Auth session checks passed.");
