import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const hero = readFileSync(new URL('../src/components/WelcomeHero.tsx', import.meta.url), 'utf8');
const notifications = readFileSync(new URL('../src/components/AccountNotifications.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../src/app/client-layout-shell.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const rollout = readFileSync(new URL('../supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql', import.meta.url), 'utf8');

assert(existsSync(new URL('../public/tenarten-logo-hero.webp', import.meta.url)), 'Local Tenarten hero asset is missing');
assert.match(hero, /!auth\.isAuthenticated \|\| !auth\.profile\?\.isActive/);
assert.match(hero, /auth\.profile\.displayName/);
assert.match(hero, /ROLE_LABELS\[auth\.profile\.role\]/);
assert.match(hero, /item\.notification_type === "welcome"/);
assert.match(hero, /welcome\.read_at === null/);
assert.doesNotMatch(hero, /mark_my_account_notification_read/, 'Hero completion and Skip must never read Welcome');
assert.doesNotMatch(hero, /open-welcome-getting-started/, 'Hero completion must not bypass real Notification discovery');
assert.match(hero, /tenops:start-notification-onboarding/);
assert.match(hero, /completedWelcomeIdRef/, 'Hero completion must remain session-scoped while Welcome stays unread');
assert.match(hero, /tenops:replay-welcome-hero/);
assert.match(hero, /requestAnimationFrame/);
assert.match(hero, /prefers-reduced-motion: reduce/);
assert.match(hero, /clamp\(2016px,313\.6vh,3136px\)/, 'Welcome reveal distance must remain 70% of the extended implementation');
assert.match(hero, /cursor-pointer/);
assert.match(hero, /active:translate-y-px/);
assert.doesNotMatch(hero, /tenarten-site|https?:\/\//);
assert.match(notifications, /Replay introduction/);
assert.match(notifications, /tenops:start-notification-onboarding/);
assert.match(notifications, /data-onboarding-spotlight/);
assert.match(notifications, /Your updates live here/);
assert.match(notifications, /Open Notifications to continue\./);
assert.doesNotMatch(notifications, /spotlight === "bell"[\s\S]{0,500}>Skip</,
  'The real notification bell must be the onboarding action, without a redundant Skip control');
assert.doesNotMatch(notifications, /spotlight === "welcome" \? <button[^>]*>Skip</,
  'Welcome guidance must advance through the real Welcome row rather than a redundant Skip control');
assert.match(notifications, /data-welcome-notification-row/);
assert.match(notifications, /Open Welcome to finish Getting Started/);
assert.match(notifications, /createPortal/, 'Notification and Getting Started surfaces must escape the transformed header scroll container');
assert.match(notifications, /max-h-\[calc\(100dvh-max\(5rem,env\(safe-area-inset-top\)\)\)\]/);
assert.match(notifications, /data-notification-scroll-region/);
assert.match(notifications, /min-h-0 flex-1 overflow-y-auto/);
assert.match(notifications, /if \(!await markRead\(item\)\) return;/, 'Only selecting a notification may mark it read');
assert.match(notifications, /if \(nextOpen && spotlight === "bell"\)[\s\S]*setSpotlight\("welcome"\)/,
  'Opening the real Notification Center must advance guidance to the real Welcome row');
assert.match(notifications, /setTab\(welcomeItem\?\.read_at \? "all" : "unread"\)/, 'Replay must find a retained read Welcome under All');
assert.match(notifications, /if \(event\.key === "Escape"\) setSpotlight\(null\)/, 'Escape must end guidance without changing durable state');
assert.doesNotMatch(notifications, /<Flag/, 'Getting Started must not teach the retired Overview flag treatment');
assert.match(notifications, /Use the Job Update control to open each Job’s conversation/);
assert.match(rollout, /notifications\.notification_type = 'welcome'/);
assert.match(rollout, /notifications\.notification_key = 'account-welcome-v1'/);
assert.match(rollout, /notifications\.read_at is not null/);
assert.match(rollout, /friday_welcome_reset_v1/);
assert.match(rollout, /not coalesce\(\(notifications\.metadata ->> 'friday_welcome_reset_v1'\)::boolean, false\)/);
assert.match(rollout, /create table if not exists public\.job_update_seen_state/);
assert.match(rollout, /drop policy if exists job_update_seen_state_read_self/);
assert.doesNotMatch(rollout, /insert into public\.account_notifications/, 'The rollout must preserve the durable Welcome record rather than duplicate it');
assert.match(shell, /<WelcomeHero \/>/);
assert.match(shell, /auth\.profile\.displayName/, 'Header identity must use the canonical app_users profile display name');
assert.match(styles, /\[data-welcome-chevron\]/);
assert.match(styles, /prefers-reduced-motion: reduce/);

console.log('TenOps branded Welcome hero checks passed.');
