import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const hero = readFileSync(new URL('../src/components/WelcomeHero.tsx', import.meta.url), 'utf8');
const notifications = readFileSync(new URL('../src/components/AccountNotifications.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../src/app/client-layout-shell.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const rollout = readFileSync(new URL('../supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql', import.meta.url), 'utf8');

assert(existsSync(new URL('../public/tenarten-logo-gold-welcome.webp', import.meta.url)), 'Registered gold Welcome asset is missing');
assert(existsSync(new URL('../public/tenarten-logo-steel-welcome.webp', import.meta.url)), 'Registered steel Welcome asset is missing');
assert.match(hero, /!auth\.isAuthenticated \|\| !auth\.profile\?\.isActive/);
assert.match(hero, /auth\.profile\.displayName/);
assert.match(hero, /ROLE_LABELS\[auth\.profile\.role\]/);
assert.match(hero, /data-welcome-account-identity[\s\S]*items-center[\s\S]*auth\.profile\.displayName[\s\S]*ROLE_LABELS\[auth\.profile\.role\]/,
  'Canonical full name and restrained role must share the same responsive identity line');
assert.match(hero, /productionTagClassName/,
  'The Welcome role must reuse the established Production tag shell');
assert.match(hero, /data-welcome-role-tag[\s\S]{0,240}ROLE_LABELS\[auth\.profile\.role\]/,
  'Every canonical role label must render through the restrained Welcome role tag');
assert.doesNotMatch(hero, /Welcome, \{auth\.profile\.displayName\}/, 'The final identity line must not retain the Welcome prefix');
assert.match(hero, /item\.notification_type === "welcome"/);
assert.match(hero, /welcome\.read_at === null/);
assert.doesNotMatch(hero, /mark_my_account_notification_read/, 'Hero progress and close must never read Welcome');
assert.doesNotMatch(hero, /open-welcome-getting-started/, 'Hero completion must not bypass real Notification discovery');
assert.match(hero, /tenops:start-notification-onboarding/);
assert.match(hero, /completedWelcomeIdRef/, 'Hero completion must remain session-scoped while Welcome stays unread');
assert.doesNotMatch(hero, /dismissedWelcomeIdRef/, 'Mandatory Welcome must not retain a UI-dismiss suppression path');
assert.match(hero, /tenops:replay-welcome-hero/);
assert.match(hero, /type WelcomeMode = "mandatory" \| "replay"/);
assert.match(hero, /setMode\("mandatory"\)/, 'Unread canonical Welcome state must open mandatory mode');
assert.match(hero, /setMode\("replay"\)/, 'Voluntary Replay must open replay mode');
assert.match(hero, /requestAnimationFrame/);
assert.match(hero, /prefers-reduced-motion: reduce/);
assert.match(hero, /clamp\(2016px,313\.6vh,3136px\)/, 'Welcome reveal distance must remain 70% of the extended implementation');
assert.doesNotMatch(hero, /Skip introduction|>Skip</, 'The first-time Welcome must not offer a Skip action');
assert.match(hero, /data-welcome-scroll-affordance/);
assert.match(hero, /data-welcome-content-layout/);
assert.match(hero, /data-welcome-primary-region/);
assert.match(hero, /data-welcome-identity-group/);
assert.match(hero, /data-welcome-identity-group[\s\S]*data-welcome-scroll-affordance/, 'Identity and scroll guidance must be separate groups in one normal-flow layout');
assert.match(hero, /grid-rows-\[minmax\(0,1fr\)_auto\]/, 'Available viewport height must separate primary identity from the reserved guidance row');
assert.match(hero, /data-welcome-primary-region[\s\S]{0,180}pb-\[clamp\(0rem,1vh,0\.75rem\)\]/,
  'The identity group must remain centered without bottom padding pushing the crest beyond the viewport');
assert.doesNotMatch(hero, /data-welcome-scroll-affordance[\s\S]{0,250}className="[^"]*absolute/, 'The scroll cue must not use independent absolute positioning');
assert.match(hero, /Scroll to explore/);
assert.match(hero, /onClick=\{explore\}/, 'The scroll affordance must be keyboard-clickable');
assert.match(hero, /revealDistance \* 0\.38/, 'The scroll affordance must advance without completing Welcome');
assert.match(hero, /behavior: reducedMotion \? "auto" : "smooth"/);
assert.match(hero, /data-welcome-logo-stack/);
assert.match(hero, /data-welcome-logo-stack className="relative aspect-\[1024\/1048\] shrink-0"/,
  'Welcome crest sizing must remain centralized on its semantic logo stack');
assert.match(styles, /\[data-welcome-logo-stack\] \{[\s\S]*width: clamp\(19rem, 51\.25vw, 34\.5rem\);[\s\S]*margin-top: max\(0rem, calc\(clamp\(13rem, 35vw, 23\.5rem\) - clamp\(19rem, 51\.25vw, 34\.5rem\)\)\);/,
  'Welcome crest must reach the 552px desktop target without allowing a negative composition lift to clip the artwork');
assert.match(hero, /tenarten-logo-gold-welcome\.webp/);
assert.match(hero, /tenarten-logo-steel-welcome\.webp/);
assert.match(hero, /data-welcome-logo-steel/);
assert.match(hero, /clipPath: diagonalRevealClip\(revealProgress\)/, 'Steel material must use a scroll-driven clipping boundary');
assert.doesNotMatch(hero, /opacity: 1 - logoProgress|opacity: logoProgress/, 'Material transformation must not use an opacity crossfade');
assert.match(hero, /revealStart: 0,/);
assert.match(hero, /revealEnd: 0\.65/);
assert.match(hero, /holdEnd: 0\.74/);
assert.match(hero, /linearPhaseProgress\(progress, HERO_PHASES\.revealStart, HERO_PHASES\.revealEnd\)/, 'Material reveal must respond linearly from the first scroll movement');
assert.match(hero, /progress > HERO_PHASES\.revealStart \? 1 : 0/, 'Reduced motion must remain gold at rest and switch only after scroll begins');
assert.match(hero, /phaseProgress\(progress, HERO_PHASES\.holdEnd, 1\)/);
assert.match(hero, /className="fixed inset-0 z-\[80\] overflow-y-auto"/, 'The Welcome scroller must own the full viewport');
assert.match(hero, /opacity: Math\.max\(0, 1 - exitProgress \* 1\.35\)/, 'Logo exit opacity must begin only in the exit phase');
assert.match(hero, /setProgress\(next\)/, 'Scroll position must remain the animation source of truth');
assert.match(hero, /mode === "replay" \? <button[^>]*onClick=\{\(\) => setVisible\(false\)\}[^>]*aria-label="Close Welcome introduction"/, 'Only Replay may expose the Close control');
assert.match(hero, /if \(!visible \|\| mode !== "replay"\) return;/, 'Escape dismissal must be restricted to Replay');
assert.match(hero, /if \(event\.key === "Escape"\) setVisible\(false\)/);
assert.doesNotMatch(hero, /onClick=\{dismiss\}|function dismiss/, 'Mandatory Welcome must not expose a generic dismiss path');
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
assert.match(notifications, /Open Welcome <ArrowRight/, 'The durable Welcome item must expose an explicit opener');
assert.match(notifications, /Open Welcome to finish Getting Started/);
assert.match(notifications, /createPortal/, 'Notification and Getting Started surfaces must escape the transformed header scroll container');
assert.match(notifications, /max-h-\[calc\(100dvh-max\(5rem,env\(safe-area-inset-top\)\)\)\]/);
assert.match(notifications, /data-notification-scroll-region/);
assert.match(notifications, /min-h-0 flex-1 overflow-y-auto/);
assert.match(notifications, /if \(!await markRead\(item\)\) return;/, 'Only selecting a notification may mark it read');
assert.match(notifications, /notificationOnboardingReducer/,
  'Notification onboarding transitions must be owned atomically rather than split across independent open and spotlight setters');
assert.match(notifications, /dispatchOnboarding\(\{ type: "toggle" \}\)/,
  'The real Notification bell must use the atomic onboarding transition');
assert.match(notifications, /setTab\(welcomeItem\?\.read_at \? "all" : "unread"\)/, 'Replay must find a retained read Welcome under All');
assert.match(notifications, /if \(event\.key === "Escape"\) dispatchOnboarding\(\{ type: "cancel-spotlight" \}\)/, 'Escape must end guidance without changing durable state');
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
assert.match(shell, /data-header-steel-logo-preview[\s\S]{0,100}src="\/tenarten-logo-steel-welcome\.webp"/, 'The global Production and TenDev header must preview the approved steel asset');
assert.match(shell, /data-login-gate-body[\s\S]*src="\/tenarten-logo-steel-welcome\.webp"/, 'Production and TenDev must share the approved static steel login logo');
assert.doesNotMatch(shell, /data-login-gate-body[\s\S]*src="\/tenarten-logo-gold-welcome\.webp"/, 'Login must not use or animate the gold logo');
assert.match(shell, /auth\.profile\.displayName/, 'Header identity must use the canonical app_users profile display name');
assert.match(styles, /\[data-welcome-chevron\]/);
assert.doesNotMatch(styles, /\[data-welcome-scroll-affordance\] \{[\s\S]*animation:/, 'Only the chevron may animate; the interaction label must remain still');
assert.match(styles, /\[data-welcome-hero\] \{[\s\S]*background: #eef1f4;[\s\S]*overscroll-behavior-y: none;/, 'Welcome must contain vertical boundary overscroll on an opaque backing surface');
assert.match(styles, /html\[data-appearance="dark"\] \[data-welcome-hero\],[\s\S]*background: #111820;/, 'TenDev dark Welcome must retain an opaque backing surface');
assert.match(styles, /\[data-header-steel-logo-preview\] \{[\s\S]*filter: contrast/, 'Header-scale steel contrast treatment must remain presentation-scoped');
assert.match(styles, /html\[data-appearance="dark"\] \[data-header-steel-logo-preview\]/, 'Dark mode must receive its own restrained steel-logo treatment');
assert.match(styles, /@media \(max-height: 36rem\)[\s\S]*\[data-welcome-logo-stack\]/, 'Only genuinely short viewports may constrain the enlarged crest by height');
assert.match(styles, /prefers-reduced-motion: reduce/);

console.log('TenOps branded Welcome hero checks passed.');
