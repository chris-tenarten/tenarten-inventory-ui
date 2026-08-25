import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const hero = readFileSync(new URL('../src/components/WelcomeHero.tsx', import.meta.url), 'utf8');
const notifications = readFileSync(new URL('../src/components/AccountNotifications.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../src/app/client-layout-shell.tsx', import.meta.url), 'utf8');
const access = readFileSync(new URL('../src/components/AccountAccessPanel.tsx', import.meta.url), 'utf8');
const auth = readFileSync(new URL('../src/lib/auth.tsx', import.meta.url), 'utf8');
const production = readFileSync(new URL('../src/modules/production/ProductionWorkspace.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const rollout = readFileSync(new URL('../supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql', import.meta.url), 'utf8');

function callbackRequiresPasswordSetup({ accountFlow, event, hasSession }) {
  const callbackFlow = accountFlow === 'setup' || accountFlow === 'recovery';
  return hasSession && (event === 'PASSWORD_RECOVERY' || callbackFlow);
}

function automaticHeroEligible({ ready = true, requiresPasswordSetup = false, authenticated = true, activeProfile = true, accessAllowed = true, user = true } = {}) {
  return ready && !requiresPasswordSetup && authenticated && activeProfile && accessAllowed && user;
}

function sourceSection(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing source section start: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source section end: ${end}`);
  return source.slice(startIndex, endIndex);
}

function assertOrdered(source, fragments, message) {
  let priorIndex = -1;
  for (const fragment of fragments) {
    const index = source.indexOf(fragment);
    assert.ok(index > priorIndex, `${message}: expected ${fragment} after prior transition`);
    priorIndex = index;
  }
}

for (const accountFlow of ['setup', 'recovery']) {
  assert.equal(callbackRequiresPasswordSetup({ accountFlow, event: 'SIGNED_IN', hasSession: true }), true,
    `${accountFlow} URL plus a temporary session must require password setup`);
  assert.equal(automaticHeroEligible({ requiresPasswordSetup: true }), false,
    `${accountFlow} callback state must make automatic Hero ineligible`);
}
assert.equal(callbackRequiresPasswordSetup({ accountFlow: null, event: 'PASSWORD_RECOVERY', hasSession: true }), true,
  'Supabase PASSWORD_RECOVERY must be protected even without a retained query parameter');
assert.equal(callbackRequiresPasswordSetup({ accountFlow: null, event: 'SIGNED_IN', hasSession: true }), false,
  'Ordinary sign-in must not enter callback mode');
assert.equal(callbackRequiresPasswordSetup({ accountFlow: 'setup', event: 'SIGNED_IN', hasSession: false }), false,
  'An invalid or expired Setup URL without a session must not create stale callback state');
assert.equal(callbackRequiresPasswordSetup({ accountFlow: 'recovery', event: 'SIGNED_IN', hasSession: false }), false,
  'An invalid or expired Recovery URL without a session must not create stale callback state');
assert.equal(automaticHeroEligible(), true, 'Ordinary eligible sign-in must retain automatic Hero behavior');

const initialSessionPath = sourceSection(auth, 'void supabase.auth.getSession()', 'const { data } = supabase.auth.onAuthStateChange');
assertOrdered(initialSessionPath, [
  'setRequiresPasswordSetup(',
  'setSession(data.session)',
  'await loadProfile(data.session)',
  'setReady(true)',
], 'Initial callback URL state must precede session/profile readiness');

const authChangePath = sourceSection(auth, 'const { data } = supabase.auth.onAuthStateChange', 'return () => {');
assertOrdered(authChangePath, [
  'setRequiresPasswordSetup(',
  'setSession(nextSession)',
  'window.setTimeout(',
  'loadProfile(nextSession)',
  'setReady(true)',
], 'Auth callback state must be committed with the session before deferred profile readiness');

const heroBootPath = sourceSection(hero, 'useEffect(() => {\n    if (!auth.ready) return;', 'useEffect(() => {\n    const refresh');
assert.match(heroBootPath, /if \(auth\.requiresPasswordSetup \|\|[\s\S]{0,520}setVisible\(false\);\s*return;/,
  'Callback guard must clear automatic Hero state and exit');
assert.ok(
  heroBootPath.indexOf('if (auth.requiresPasswordSetup ||') < heroBootPath.indexOf('window.sessionStorage.setItem(playedKey, "true")'),
  'Callback guard must precede every automatic Hero playback marker write',
);

const passwordCompletionPath = sourceSection(auth, 'async updatePassword(password)', 'refreshProfile,');
assertOrdered(passwordCompletionPath, [
  'updateUser({ password })',
  'if (error) throw error',
  'signOut({ scope: "local" })',
  'if (signOutError) throw signOutError',
  'setRequiresPasswordSetup(false)',
  'window.history.replaceState',
], 'Callback completion must clear state only after password update and local sign-out succeed');

assert(existsSync(new URL('../public/logo.png', import.meta.url)), 'Original persistent logo is missing');
assert(existsSync(new URL('../public/tenarten-logo-gold-welcome.webp', import.meta.url)), 'Registered gold Hero asset is missing');
assert(existsSync(new URL('../public/tenarten-logo-steel-welcome.webp', import.meta.url)), 'Registered steel Hero asset is missing');

assert.match(hero, /type WelcomeMode = "boot" \| "replay"/);
assert.match(hero, /BOOT_PLAYED_KEY_PREFIX = "tenops\.welcomeHeroPlayed:"/,
  'Boot playback must be scoped to the authenticated browser session');
assert.match(hero, /sessionStorage\.getItem\(playedKey\)/);
assert.match(hero, /sessionStorage\.setItem\(playedKey, "true"\)/);
assert.match(hero, /sessionStorage\.removeItem\(`\$\{BOOT_PLAYED_KEY_PREFIX\}\$\{lastAuthenticatedUserRef\.current\}`\)/,
  'Signing out must permit a later fresh login to boot again');
assert.match(hero, /tenops:replay-welcome-hero/);
assert.match(hero, /prefers-reduced-motion: reduce/);
assert.match(hero, /requestAnimationFrame\(tick\)/, 'Elapsed automatic animation must use animation frames');
assert.match(hero, /HERO_DURATION_MS = 4600/,
  'The normalized Hero timeline must be 15% slower than the approved 4000ms duration');
assert.doesNotMatch(hero, /onScroll=|handleScroll|Scroll to explore|ChevronDown/,
  'Boot must not depend on scroll interaction');

assert.match(hero, /const \[heroAnimationComplete, setHeroAnimationComplete\]/);
assert.match(hero, /const \[criticalAppReady, setCriticalAppReady\]/);
assert.match(hero, /criticalAppReadyRef\.current && now - animationCompletedAtRef\.current >= ONLINE_HOLD_MS/,
  'Fade must wait for both animation completion and app readiness');
assert.match(hero, /ONLINE_HOLD_MS = 900/,
  'The completed ONLINE composition must hold before the gradual fade');
assert.match(hero, /OPERATIONS ENGINE INITIATING/);
assert.match(hero, /OPERATIONS ENGINE ONLINE/);
assert.match(hero, /heroAnimationComplete \? "text-emerald-700" : ""/,
  'ONLINE must use the established TenOps success green');
assert.match(hero, /const heroProgress = [\s\S]{0,120}smoothstep\(progress\)/);
assert.match(hero, /const logoProgress = heroProgress/);
assert.match(hero, /diagonalRevealClip\(logoProgress\)/);
assert.match(hero, /function diagonalRevealCoverage/);
assert.match(hero, /Math\.round\(diagonalRevealCoverage\(logoProgress\) \* 100\)/,
  'The progress bar must report the visibly revealed diagonal crest area');
assert.match(hero, /role="progressbar"/);
assert.match(hero, /aria-valuenow=\{percent\}/);
assert.match(hero, /setFadeProgress\(smoothstep\(nextFade\)\)/, 'Hero dismissal must retain a gradual fade');
assert.match(hero, /document\.body\.style\.overflow = "hidden"/);
assert.match(hero, /document\.body\.style\.overflow = previousOverflow/,
  'Interaction lock cleanup must restore the prior body state');
assert.match(hero, /const bootRequired = heroEligible && !bootClaimed[\s\S]{0,180}sessionStorage\.getItem/,
  'Fresh-login Hero ownership must be decided during render before the authenticated workspace can flash');
assert.match(hero, /const heroVisible = heroEligible && \(visible \|\| bootRequired\)/);
assert.match(hero, /const heroEligible = auth\.ready && !auth\.requiresPasswordSetup && auth\.isAuthenticated/,
  'Temporary Setup and Recovery sessions must never become eligible for automatic Hero boot');
assert.match(access, /tenops:prepare-hero-boot[\s\S]{0,120}await auth\.signIn/,
  'The login action must establish Hero ownership before Supabase can expose authenticated content');
assert.match(access, /tenops:cancel-hero-boot/,
  'A failed login must release the pre-auth Hero cover');
assert.match(access, /const activeMode = auth\.requiresPasswordSetup \? "password" : mode/,
  'A recognized callback must keep the password setup/recovery UI active');
assert.match(access, /activeMode === "signin"[\s\S]{0,520}else \{[\s\S]{0,260}auth\.updatePassword\(password\)/,
  'Password callback submission must not arm the ordinary sign-in Hero cover');
assert.match(auth, /onAuthStateChange[\s\S]{0,800}window\.setTimeout\(\(\) => \{[\s\S]{0,100}loadProfile\(nextSession\)/,
  'Authenticated profile loading must begin after the Supabase auth callback releases its token lock');
assert.match(auth, /callbackFlow = accountFlow === "setup" \|\| accountFlow === "recovery"/,
  'Setup and Recovery URLs must remain canonical temporary-auth callback flows');
assert.match(auth, /setRequiresPasswordSetup\(Boolean\(nextSession\) && \(event === "PASSWORD_RECOVERY" \|\| callbackFlow\)\)/,
  'Callback state must be established atomically with the temporary Supabase session');
assert.match(auth, /updateUser\(\{ password \}\)[\s\S]{0,180}signOut\(\{ scope: "local" \}\)[\s\S]{0,180}setRequiresPasswordSetup\(false\)[\s\S]{0,120}history\.replaceState/,
  'Successful Setup and Recovery must sign out locally and clear callback state before normal login');
assert.match(hero, /const heroStartingCoverVisible = !auth\.requiresPasswordSetup && \(preparingBoot \|\| \(bootRequired && !visible\)\)/,
  'Restored sessions must retain the pre-mounted starting cover until the animated Hero explicitly owns the screen');
assert.match(hero, /const heroCoverVisible = heroStartingCoverVisible \|\| heroVisible/,
  'Callback state must synchronously release stale ownership while every active Hero surface retains the interaction lock');
assert.match(hero, /const coverRef = useRef<HTMLDivElement \| null>\(null\)/);
assert.match(hero, /if \(coverRef\.current\) coverRef\.current\.hidden = false;[\s\S]{0,160}setPreparingBoot\(true\)/,
  'Sign-in must synchronously reveal the already-mounted Hero cover before queued React state can yield ownership');
assert.match(hero, /const cancel = \(\) => \{\s*if \(coverRef\.current\) coverRef\.current\.hidden = true;/,
  'A failed login must synchronously return visual ownership to Account Access');
assert.match(hero, /ref=\{coverRef\}[\s\S]{0,120}hidden=\{!heroStartingCoverVisible\}[\s\S]{0,80}data-welcome-hero-cover/,
  'A lightweight static starting cover must remain mounted and natively hidden between boots');
assert.match(hero, /data-welcome-hero-cover[\s\S]{0,100}z-\[81\]/,
  'The starting cover must remain above the newly mounted animated Hero until ownership transfers');
assert.match(hero, /data-welcome-hero-cover[\s\S]{0,1800}data-welcome-progress-cover[\s\S]{0,500}OPERATIONS ENGINE INITIATING[\s\S]{0,120}0%/,
  'The immediate handoff cover must include the same starting progress composition and grid geometry');
assert.match(hero, /\{heroVisible \? <div\s*data-welcome-hero/,
  'The full animated Hero subtree must mount only when existing auth and profile readiness permits animation');
assert.doesNotMatch(hero, /if \(!heroCoverVisible\) return null/,
  'The lightweight ownership cover must not require mounting a new subtree after login begins');
assert.match(hero, /sessionStorage\.getItem\(playedKey\) && !preparingBootRef\.current/,
  'An explicitly armed fresh login must boot even if stale session playback state remains');

assert.match(hero, /tenarten-logo-gold-welcome\.webp/);
assert.match(hero, /tenarten-logo-steel-welcome\.webp/);
assert.match(hero, /clipPath: diagonalRevealClip\(logoProgress\)/);
assert.match(hero, /auth\.profile\.displayName/);
assert.match(hero, /ROLE_LABELS\[auth\.profile\.role\]/);
assert.match(hero, /productionTagClassName/);

assert.match(production, /setJobs\(sortJobs\(visibleJobs\)\);[\s\S]{0,120}announceCriticalAppReady\(\)/,
  'Production must become ready when canonical core Job rows render');
assert.match(production, /supportingDataPromise/,
  'Secondary Production summaries must remain progressive');
assert.match(production, /catch \(error\)[\s\S]{0,420}announceCriticalAppReady\(\)/,
  'A rendered Production load error must not strand the boot lock');
assert.match(hero, /window\.location\.pathname !== "\/"/,
  'Non-Production destinations must not wait for the Production workspace signal');

assert.match(hero, /item\.notification_type === "welcome"/);
assert.match(hero, /welcome && welcome\.read_at === null/);
assert.doesNotMatch(hero, /mark_my_account_notification_read/,
  'Hero completion must never mark durable Welcome read');
assert.match(hero, /completedWelcomeIdRef/);
assert.match(hero, /tenops:start-notification-onboarding/);
assert.match(notifications, /Replay introduction/);
assert.match(notifications, /tenops:start-notification-onboarding/);
assert.match(notifications, /data-onboarding-spotlight/);
assert.match(notifications, /Your updates live here/);
assert.match(notifications, /Open Notifications to continue\./);
assert.doesNotMatch(notifications, /spotlight === "bell"[\s\S]{0,500}>Skip</,
  'The real notification bell must remain the onboarding action');
assert.match(notifications, /data-welcome-notification-row/);
assert.match(notifications, /Open Welcome <ArrowRight/);
assert.match(notifications, /Open Welcome to finish Getting Started/);
assert.match(notifications, /createPortal/);
assert.match(notifications, /data-notification-scroll-region/);
assert.match(notifications, /if \(!await markRead\(item\)\) return;/,
  'Only selecting a notification may mark it read');
assert.match(notifications, /notificationOnboardingReducer/);
assert.match(notifications, /dispatchOnboarding\(\{ type: "toggle" \}\)/);
assert.match(notifications, /setTab\(welcomeItem\?\.read_at \? "all" : "unread"\)/,
  'Replay must find a retained read Welcome under All');
assert.match(notifications, /if \(event\.key === "Escape"\) dispatchOnboarding\(\{ type: "cancel-spotlight" \}\)/);
assert.match(notifications, /Use the Job Update control to open each Job’s conversation/);
assert.match(rollout, /notifications\.notification_type = 'welcome'/);
assert.match(rollout, /notifications\.notification_key = 'account-welcome-v1'/);
assert.match(rollout, /notifications\.read_at is not null/);
assert.match(rollout, /friday_welcome_reset_v1/);
assert.match(rollout, /create table if not exists public\.job_update_seen_state/);
assert.doesNotMatch(rollout, /insert into public\.account_notifications/,
  'The rollout must preserve the durable Welcome record rather than duplicate it');

assert.match(shell, /data-authenticated-header-logo[\s\S]{0,400}h-9 w-9[\s\S]{0,180}h-11 w-11/,
  'Authenticated logo artwork must render inside fixed geometry');
assert.match(shell, /data-authenticated-steel-logo="true"[\s\S]{0,120}src="\/tenarten-logo-steel-welcome\.webp"/,
  'Authenticated header branding must settle immediately on the static steel crest');
assert.doesNotMatch(shell, /headerLogoState|tenops:boot-hero-complete/,
  'The authenticated header must not retain the mixed-logo transformation experiment');
assert.match(shell, /data-login-gate-body[\s\S]*src="\/logo\.png"/,
  'Login must use the original persistent Tenarten logo');
assert.match(styles, /data-authenticated-steel-logo/);
assert.match(styles, /html\[data-appearance="dark"\] \[data-welcome-hero\]/,
  'Dark development appearance must retain the opaque Hero surface');
assert.match(styles, /html\[data-appearance="dark"\] \[data-welcome-hero-cover\]/,
  'The immediate handoff cover and animated Hero must consume the same retained Appearance');
assert.match(styles, /\[data-welcome-hero\],[\s\S]{0,80}\[data-welcome-hero-cover\][\s\S]{0,240}--tenops-type-label: 14px;[\s\S]{0,120}--tenops-type-body: 20px;/,
  'Both viewport-composed Hero surfaces must retain the established Large typography independent of account resolution');

console.log('TenOps automatic post-login Hero checks passed.');
