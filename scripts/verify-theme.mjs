import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [provider, layout, shell, settings, styles, planningEditor, creationDialog, schedulingFeedback, workspace, queue, table, updatesIndicator, gantt, manifest] =
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
    read("docs/workflows/PRODUCTION_PIPELINE.md"),
  ]);

assert.match(provider, /export function ThemeProvider/);
assert.match(provider, /createContext/);
assert.match(provider, /tenops_appearance/);
assert.match(provider, /\["light", "dark"\]/);
assert.match(provider, /useState<Appearance>\(defaultAppearance\)/);
assert.match(provider, /window\.localStorage\.setItem/);
assert.doesNotMatch(provider, /hostname|NODE_ENV|branch|prefers-color-scheme|matchMedia/i);
assert.match(layout, /data-appearance=\{defaultAppearance\}/);
assert.match(layout, /localStorage\.getItem\('tenops_appearance'\)/);
assert.match(layout, /a==='dark'\|\|a==='light'\?a:/);
assert.match(layout, /<ThemeProvider defaultAppearance=\{defaultAppearance\}>/);
assert.doesNotMatch(layout, /NEXT_PUBLIC_[A-Z_]*DARK|data-[a-z-]*prototype/);
assert.match(shell, /data-app-shell/);
assert.match(shell, /data-theme-access-brand/);
assert.match(shell, /data-theme-logout/);
assert.match(settings, /useAppearance/);
assert.match(settings, /APPEARANCES\.map/);
assert.match(settings, /role="radiogroup"/);
assert.match(styles, /:root[\s\S]*--surface-page:/);
assert.match(styles, /html\[data-appearance="dark"\]/);
assert.match(styles, /--surface-selected:/);
assert.match(styles, /\.tenops-selected-surface/);
assert.doesNotMatch(styles, /[a-z-]+-prototype/);
assert.match(styles, /\[role="dialog"\]/);
assert.match(styles, /\[role="tooltip"\]/);
assert.match(planningEditor, /PLANNING_PAUSE_HATCH/);
assert.match(creationDialog, /role="dialog"/);
assert.match(schedulingFeedback, /data-scheduling-feedback/);
assert.match(workspace, /data-operational-tone="attention"/);
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
