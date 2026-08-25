import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql');
const provider = read('src/lib/account-preferences.tsx');
const layout = read('src/app/layout.tsx');
const appearance = read('src/lib/appearance.tsx');
const language = read('src/lib/language.tsx');
const shell = read('src/app/client-layout-shell.tsx');
const settings = read('src/app/settings/page.tsx');
const workspace = read('src/modules/production/ProductionWorkspace.tsx');
const timeline = read('src/modules/production/components/ProductionGantt.tsx');
const table = read('src/modules/production/components/ProductionTable.tsx');
const phaseToggle = read('src/modules/planning/CollapsedPhaseDisplayToggle.tsx');
const transmittal = read('src/modules/transmittals/JobTransmittalPanel.tsx');
const updates = read('src/modules/production/components/JobUpdatesPanel.tsx');

assert.match(migration, /create table if not exists public\.account_user_preferences/);
assert.match(migration, /user_id uuid primary key references public\.app_users\(user_id\) on delete cascade/);
assert.match(migration, /create or replace function public\.get_my_account_preferences\(\)/);
assert.match(migration, /create or replace function public\.set_my_account_preference\(p_key text, p_value jsonb\)/);
assert.match(migration, /users\.user_id = auth\.uid\(\) and users\.is_active/g);
assert.match(
  migration,
  /create policy job_update_seen_state_read_self[\s\S]*user_id = auth\.uid\(\)[\s\S]*users\.user_id = auth\.uid\(\)[\s\S]*users\.is_active/,
  'Direct seen-state reads must require the current mapped account to remain active',
);
assert.doesNotMatch(migration, /set_my_account_preference\([^)]*p_user_id/);
assert.match(migration, /tenops_account_preferences_valid\(next_preferences\)/);
assert.match(migration, /account_user_preferences\.preferences \|\| excluded\.preferences/);
assert.match(migration, /Unsupported TenOps account preference/);
assert.match(migration, /revoke all on public\.account_user_preferences from public, anon, authenticated/);
assert.match(migration, /grant execute on function public\.get_my_account_preferences\(\) to authenticated/);
assert.match(migration, /grant execute on function public\.set_my_account_preference\(text,jsonb\) to authenticated/);

for (const key of [
  'appearance', 'language', 'display_size', 'production_view', 'production_arrangement',
  'timeline_zoom', 'timeline_row_density', 'production_table_hidden_columns',
  'collapsed_phase_display', 'transmittal_sender',
]) assert.match(migration, new RegExp(`preference_key = '${key}'`));

assert.match(provider, /auth\.profile\.userId === sessionUserId/, 'Account changes must reject the prior session profile immediately');
assert.match(provider, /preferences: loaded\.userId === accountUserId \? loaded\.preferences : \{\}/);
assert.match(provider, /get_my_account_preferences/);
assert.match(provider, /set_my_account_preference/);
assert.doesNotMatch(provider, /localStorage|sessionStorage/, 'Account preference state must never synchronize from ownerless browser storage');
assert.match(layout, /<AccountPreferencesProvider>/);

assert.match(settings, /accountPreferences\.accountScoped \? t\("settings\.accountPreference"\) : t\("settings\.browserOnly"\)/);
assert.doesNotMatch(settings, /Saved to your TenOps account/, 'Settings persistence copy must use localized behavioral language');
assert.doesNotMatch(language, /settings\.themeDescription[^\n]*browser/i, 'Account-scoped Appearance copy must not claim browser-only persistence');
assert.match(language, /"settings\.accountPreference": "Follows your account across devices\."/);
assert.match(language, /"settings\.browserOnly": "This preference is stored only in this browser\."/);
assert.match(settings, /<AccountAccessPanel/, 'Account access remains distinct from account-scoped preferences');

assert.match(appearance, /setPreference\("appearance", next\)/);
assert.match(appearance, /if \(!isTenDev && accountPreferences\.accountScoped\)/,
  'TenDev must bypass shared account Appearance persistence');
assert.match(appearance, /TENDEV_APPEARANCE_STORAGE_KEY = "tenops:tendev:appearance"/);
assert.doesNotMatch(appearance, /allowUserAppearance/,
  'Stored account Appearance must not be disabled by environment branding');
assert.doesNotMatch(layout, /allowUserAppearance=\{BRANDING\.showDeveloperArtwork\}/,
  'Production and development must consume the same account Appearance preference');
assert.match(language, /setPreference\("language", next\)/);
assert.match(shell, /preferences\.display_size/);
assert.match(workspace, /setAccountPreference\('production_view', storedView\)/);
assert.match(workspace, /setPreference\('production_arrangement', persistedProductionArrangement\(value\)\)/);
assert.match(timeline, /setPreference\('timeline_zoom', nextZoom\)/);
assert.match(timeline, /setPreference\('timeline_row_density', option\.value\)/);
assert.match(timeline, /const localPreferences = parseTimelinePreferences/);
assert.match(timeline, /setPreferences\(\{\s*\.\.\.localPreferences/);
assert.match(timeline, /const devicePreferences = accountPreferences\.accountScoped/);
assert.match(timeline, /zoom: defaultTimelinePreferences\.zoom/);
assert.match(timeline, /rowDensity: defaultTimelinePreferences\.rowDensity/);
assert.match(table, /setPreference\('production_table_hidden_columns', hidden\)/);
assert.match(table, /widths: localLayout\.widths/);
assert.match(phaseToggle, /setPreference\("collapsed_phase_display", value\)/);
assert.match(transmittal, /preferences\.transmittal_sender/);
assert.match(transmittal, /setPreference\("transmittal_sender", sender\)/);
assert.match(transmittal, /accountPreferences\.accountScoped[\s\S]*localStorage\.getItem\(senderKey\)/);

assert.match(workspace, /sessionStorage\.getItem\(APPROVAL_EXPIRES_KEY\)/);
assert.match(workspace, /sessionStorage\.getItem\(PRODUCTION_JOB_FOCUS_STORAGE_KEY\)/);
assert.match(updates, /auth\.profile\?\.displayName \?\? authorName/);

console.log('TenOps account-scoped preference checks passed.');
