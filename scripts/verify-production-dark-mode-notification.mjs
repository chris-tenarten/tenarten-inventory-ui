import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [migration, notifications, arrivals, settings] = await Promise.all([
  read("supabase/migrations/20260825_001_production_dark_mode_notification.sql"),
  read("src/components/AccountNotifications.tsx"),
  read("src/components/notification-arrival-state.ts"),
  read("src/app/settings/page.tsx"),
]);

assert.match(migration, /'account-production-dark-mode-v1'/);
assert.match(migration, /'appearance_available'/);
assert.match(migration, /'Dark Mode is now available'/);
assert.match(migration, /TenOps now supports Light and Dark appearance\. Choose your preference in Settings\./);
assert.match(migration, /from public\.app_users users\s+where users\.is_active/);
assert.match(migration, /on conflict \(user_id, notification_key\) do nothing/);
assert.doesNotMatch(migration, /welcome|read_at|email/i);
assert.match(notifications, /item\.notification_type === "appearance_available"/);
assert.match(notifications, /router\.push\("\/settings#appearance"\)/);
assert.match(settings, /id="appearance"/);
assert.doesNotMatch(arrivals, /appearance_available/);

console.log("Production Dark Mode notification checks passed.");
