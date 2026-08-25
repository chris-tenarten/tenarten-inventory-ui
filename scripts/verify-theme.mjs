import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [provider, layout, shell, settings, styles, planningEditor, creationDialog, schedulingFeedback, workspace, queue, table, updatesIndicator, gantt, manpower, inventory, manifest] =
  await Promise.all([
    read("src/lib/appearance.tsx"),
    read("src/app/layout.tsx"),
    read("src/app/client-layout-shell.tsx"),
    read("src/app/settings/page.tsx"),
    read("src/app/globals.css"),
    read("src/modules/planning/PlanningPhaseEditor.tsx"),
    read("src/modules/planning/PhaseCreationDialog.tsx"),
    read("src/modules/planning/SchedulingFeedbackPanel.tsx"),
    read("src/modules/production/ProductionWorkspace.tsx"),
    read("src/modules/production/components/ProductionQueue.tsx"),
    read("src/modules/production/components/ProductionTable.tsx"),
    read("src/modules/production/components/JobUpdatesIndicator.tsx"),
    read("src/modules/production/components/ProductionGantt.tsx"),
    read("src/modules/manpower/ManpowerWorkspace.tsx"),
    read("src/app/inventory/page.tsx"),
    read("docs/workflows/PRODUCTION_PIPELINE.md"),
  ]);

assert.match(provider, /export function ThemeProvider/);
assert.match(provider, /createContext/);
assert.match(provider, /tenops_appearance/);
assert.match(provider, /\["light", "dark"\]/);
assert.match(provider, /useState<Appearance>\(defaultAppearance\)/);
assert.match(provider, /accountPreferences\.accountScoped/);
assert.match(provider, /accountPreferences\.preferences\.appearance/);
assert.match(provider, /accountPreferences\.accountScoped && !accountPreferences\.ready\) return/,
  'Authenticated Appearance must not fall back while account preferences are still resolving');
assert.match(provider, /accountPreferences\.setPreference\("appearance", next\)/);
assert.doesNotMatch(provider, /allowUserAppearance/,
  'Appearance availability must not be gated by the deployment environment');
assert.match(provider, /accountPreferences\.accountScoped \|\| event\.key !== APPEARANCE_STORAGE_KEY/,
  'Authenticated accounts must not synchronize another operator\'s browser-local Appearance');
assert.match(provider, /window\.localStorage\.setItem\(APPEARANCE_STORAGE_KEY, next\)/,
  'The pre-authentication Appearance fallback remains browser-local');
assert.doesNotMatch(provider, /hostname|NODE_ENV|branch|prefers-color-scheme|matchMedia/i);
assert.match(layout, /data-appearance=\{defaultAppearance\}/);
assert.doesNotMatch(layout, /localStorage\.getItem\(['"]tenops_appearance['"]\)/,
  'The root layout must not initialize authenticated Appearance from ownerless browser storage');
assert.doesNotMatch(layout, /allowUserAppearance=\{BRANDING\.showDeveloperArtwork\}/,
  'Production and development must both honor the canonical user Appearance preference');
assert.doesNotMatch(layout, /NEXT_PUBLIC_[A-Z_]*DARK|data-[a-z-]*prototype/);
assert.match(shell, /data-app-shell/);
assert.match(shell, /data-theme-access-brand/);
assert.match(shell, /data-theme-logout/);
assert.match(settings, /useAppearance/);
assert.match(settings, /APPEARANCES\.map/);
assert.match(settings, /id="appearance"/);
assert.doesNotMatch(settings, /BRANDING\.showDeveloperArtwork/);
assert.match(settings, /role="radiogroup"/);
assert.match(styles, /:root[\s\S]*--surface-page:/);
assert.match(styles, /html\[data-appearance="dark"\]/);
assert.match(styles, /--surface-selected:/);
assert.match(styles, /--semantic-info-foreground:/);
assert.match(styles, /--operational-violet-surface:/);
assert.match(styles, /\.tenops-selected-surface/);
assert.match(styles, /\[class\*="bg-\[\#eef1f4\]"\]/);
assert.match(styles, /\.border-orange-300/);
assert.match(styles, /\.border-red-300/);
assert.match(styles, /\.border-emerald-300/);
assert.match(styles, /\[data-manpower-unlinked="true"\]/);
assert.match(styles, /\[data-pending-receival-received="true"\]/);
assert.match(styles, /\.bg-violet-200/);
assert.match(manpower, /data-manpower-unlinked=/);
assert.match(inventory, /data-pending-receival-received=/);
assert.match(inventory, /data-received-status className="inline-flex min-h-8 items-center justify-center/);
assert.doesNotMatch(styles, /[a-z-]+-prototype/);
assert.match(styles, /\[role="dialog"\]/);
assert.match(styles, /\[role="tooltip"\]/);
assert.match(planningEditor, /PLANNING_PAUSE_HATCH/);
assert.match(creationDialog, /role="dialog"/);
assert.match(schedulingFeedback, /data-scheduling-feedback/);
assert.match(workspace, /data-operational-tone=\{schedulingAttentionJobs\.length > 0 \? 'attention' : undefined\}/);
assert.match(workspace, /tenops-selected-surface/);
assert.match(queue, /data-operational-tone="success"/);
assert.match(queue, /data-operational-tone="warning"/);
assert.match(table, /data-production-table-header/);
assert.match(updatesIndicator, /data-job-updates-indicator/);
assert.match(styles, /\[data-production-table-header\]/);
assert.match(styles, /\[data-job-updates-indicator\]/);
assert.match(gantt, /data-production-gantt/);
assert.match(gantt, /data-gantt-phase-row/);
assert.match(gantt, /data-gantt-navigator/);
assert.match(gantt, /data-planning-connector-state/);
assert.match(styles, /--semantic-success-surface:/);
assert.match(styles, /\[data-production-bar\]/);
assert.match(styles, /\[data-planning-phase-bar\]/);
assert.match(manifest, /Light or Dark preference/);
assert.doesNotMatch(manifest, /NEXT_PUBLIC_[A-Z_]*DARK/);

console.log("Appearance theme structural checks passed.");
