import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calculatePhaseProgress, calculatePlanningProgress } from "../src/modules/planning/progress.mjs";
import {
  isPlanningEnabled,
  normalizeLoadedJobIds,
  planningIntervalGeometry,
  selectCollapsedTimelinePhases,
} from "../src/modules/planning/timeline-model.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [migration, refinement, schedulingMigration, schedulingVerification, scheduling, schedulingModel, data, panel, editor, library, workspace, gantt, inspector, shell, settings, visuals, demo] = await Promise.all([
  read("supabase/migrations/20260731_003_planning_phases_items.sql"),
  read("supabase/migrations/20260803_001_planning_library_colors_and_phase_cap.sql"),
  read("supabase/migrations/20260803_003_atomic_production_planning_schedule.sql"),
  read("supabase/inspection/20260803_003_atomic_production_planning_schedule_verification.sql"),
  read("src/modules/planning/schedule-staging.ts"),
  read("src/modules/planning/schedule-model.mjs"),
  read("src/modules/planning/data.ts"),
  read("src/modules/planning/PlanningPanel.tsx"),
  read("src/modules/planning/PlanningPhaseEditor.tsx"),
  read("src/modules/planning/PhaseLibraryManager.tsx"),
  read("src/modules/production/ProductionWorkspace.tsx"),
  read("src/modules/production/components/ProductionGantt.tsx"),
  read("src/modules/production/components/ProductionJobInspector.tsx"),
  read("src/app/client-layout-shell.tsx"),
  read("src/app/settings/page.tsx"),
  read("src/modules/planning/phase-visuals.ts"),
  read("scripts/planning-demo-data.mjs"),
]);

assert.equal(isPlanningEnabled("true"), true);
for (const value of [undefined, "", "TRUE", "1", "false"]) assert.equal(isPlanningEnabled(value), false);
assert.deepEqual(normalizeLoadedJobIds(["a", "", "a", "b"]), ["a", "b"]);

const intervalGeometry = planningIntervalGeometry("2026-08-03", "2026-08-05", "2026-08-01", 20);
assert.deepEqual(intervalGeometry, { left: 43, width: 54, right: 97 });
assert.equal(planningIntervalGeometry("2026-08-03", "2026-08-03", "2026-08-01", 4).width, 12);

const phase = (id, overrides = {}) => ({
  id, job_id: "job", title: id, category: "internal", status: "open",
  start_date: "2026-08-01", end_date: "2026-08-01", timeline_behavior: "overlay",
  include_in_planning_progress: true, ...overrides,
});
const items = [
  { id: "1", phase_id: "p1", is_complete: true },
  { id: "2", phase_id: "p1", is_complete: false },
  { id: "3", phase_id: "p2", is_complete: true },
];
assert.deepEqual(calculatePhaseProgress(items.slice(0, 2)), { complete: 1, total: 2, percent: 50 });
assert.deepEqual(calculatePlanningProgress([phase("p1"), phase("p2", { timeline_behavior: "planning_only" })], items), { complete: 2, total: 3, percent: 67 });
assert.deepEqual(calculatePlanningProgress([phase("p1"), phase("p2", { timeline_behavior: "pause" })], items), { complete: 1, total: 2, percent: 50 });
assert.deepEqual(calculatePlanningProgress([], []), { complete: 0, total: 0, percent: 0 });

const selected = selectCollapsedTimelinePhases([
  phase("far", { start_date: "2027-01-01", end_date: "2027-01-02" }), phase("normal"),
  phase("pause", { timeline_behavior: "pause" }), phase("third"), phase("fourth"),
], { canvasStart: "2026-07-01", canvasEnd: "2026-09-01", productionStart: "2026-08-01", productionEnd: "2026-08-05" });
assert.equal(selected.visible.length, 4);
assert.equal(selected.hidden.length, 0);
assert.equal(selected.all.some((entry) => entry.id === "far"), false);

assert.match(data, /from\("planning_phases"\)/);
assert.match(data, /from\("planning_items"\)/);
assert.match(data, /deletePlanningPhase\(phase\.id\)/);
assert.match(data, /entry\.default_timeline_behavior !== "pause" && item\.library_phase_id === entry\.id/);
assert.match(data, /\.neq\("timeline_behavior", "pause"\)/);
assert.match(data, /timeline_color: entry\.default_timeline_behavior === "overlay" \? entry\.default_timeline_color : null/);
assert.match(data, /library_phase_id: entry\.id/);
assert.match(panel, /Items/);
assert.match(panel, /Phase Library/);
assert.match(library, /Nothing is added to a Production job automatically/);
assert.match(library, /Save the Phase definition before adding reusable Items/);
assert.match(library, /Back to \{returnContext\.jobName\}/);
assert.match(workspace, /planningEnabled \? await loadPlanningPhases/);
assert.doesNotMatch(gantt, />Planning \{jobPhases\.length\}</);
assert.match(gantt, /No Planning Phases/);
assert.match(gantt, /Show Planning lanes/);
assert.match(gantt, /Hide Planning lanes/);
assert.match(gantt, /inCanvasPhases\.map/);
assert.doesNotMatch(gantt, /collapsedPhases\.hidden|additional Phase/);
assert.match(gantt, /planning-arrow-/);
assert.match(gantt, /pointer-events-none absolute left-0/);
assert.equal((gantt.match(/planningIntervalGeometry\(/g) ?? []).length, 6);
assert.match(gantt, /const blockerX = blockerGeometry\.right/);
assert.match(gantt, /const blockedX = blockedGeometry\.left/);
assert.match(gantt, /const destinationNodeSize = 6/);
assert.match(gantt, /const destinationNodeX = blockedX - destinationNodeSize \/ 2/);
assert.match(gantt, /const destinationApproachX = destinationNodeX - 10/);
assert.match(gantt, /H \$\{destinationApproachX\} V \$\{blockedY\} H \$\{destinationNodeX\}/);
assert.match(gantt, /<rect x=\{destinationNodeX\} y=\{blockedY - destinationNodeSize \/ 2\} width=\{destinationNodeSize\} height=\{destinationNodeSize\} fill=\{connectorColor\} \/>/);
assert.doesNotMatch(gantt, /IncomingDependencyIcon/);
assert.doesNotMatch(panel, /IncomingDependencyIcon/);
assert.match(gantt, /refX="8"/);
assert.match(gantt, /markerUnits="userSpaceOnUse"/);
assert.match(gantt, /issueIsOpen \? 'z-40' : 'z-\[4\]'/);
assert.match(gantt, /const issueAnchorX = Math\.round\(\(sourceExitX \+ destinationApproachX\) \/ 2\)/);
assert.match(gantt, /x=\{issueAnchorX - 7\} y=\{routingY - 7\} width=\{issueIsOpen \? 304 : 14\} height=\{issueIsOpen \? 148 : 14\}/);
assert.match(gantt, /data-planning-warning-popover className="relative h-3\.5 w-3\.5"/);
assert.match(gantt, /absolute inset-0 flex items-center justify-center rounded-full/);
assert.match(gantt, /AlertTriangle className="h-2\.5 w-2\.5 shrink-0"/);
assert.match(gantt, /issue\.kind !== 'dependency_overlap' && issue\.kind !== 'circular_dependency'/);
assert.match(gantt, /preferences\.rowDensity === 'compact' \? 'text-\[6px\]' : 'text-\[6\.5px\]'/);
assert.doesNotMatch(gantt, /Blocked by:/);
assert.doesNotMatch(gantt, /sr-only">Planning overlay:[\s\S]{0,200}card\.blocked_by_phase_id/);
assert.match(gantt, /onSelectJob\(job,\s*'planning'\)/);
assert.match(gantt, /focusJobProductionInterval\(job\)/);
assert.match(gantt, /timelineIntervalFocusScrollLeft/);
assert.doesNotMatch(gantt, /focusJobProductionInterval[\s\S]{0,1200}fitTimeline\(/);
assert.doesNotMatch(gantt, />Pause<|pauses<\/button>/);
assert.match(gantt, /PLANNING_PAUSE_HATCH/);
assert.match(panel, /overlayVisualForPhase/);
assert.match(panel, /Planning only: no Timeline bar/);
assert.match(visuals, /PLANNING_OVERLAY_PALETTE/);
assert.equal((visuals.match(/key: "/g) ?? []).length, 8);
assert.match(visuals, /assignedColor/);
assert.match(visuals, /overlayVisualForColor/);
assert.match(demo, /cba79566-3fde-4910-9cf6-45687db70b01/);
for (const title of ["Color Plate", "Shop Drawings", "Customer Approval", "Production Freeze", "Internal coordination"]) assert.match(demo, new RegExp(title));
assert.doesNotMatch(demo, /Freight Coordination/);
assert.match(panel, /MAX_PLANNING_PHASES/);
assert.match(panel, /countsTowardPlanningPhaseLimit/);
assert.match(panel, /Pause intervals do not count toward this limit/);
assert.match(panel, /phase\.timeline_behavior !== "pause"/);
assert.match(panel, /Waiting for/);
assert.doesNotMatch(panel, /Blocked by/);
assert.doesNotMatch(panel, /Category<select|categoryFilter/);
assert.doesNotMatch(library, /Default category|Include in Planning progress by default/);
assert.match(library, /Default Timeline Color/);
assert.match(library, /PLANNING_OVERLAY_PALETTE/);
assert.match(library, /Pause definitions do not create reusable Items/);
assert.match(editor, /Inherited from Phase Library/);
assert.match(editor, /Automatically assigned for an ad-hoc Phase/);
assert.match(editor, /draft\.timeline === "overlay" \? \(phase\?\.timeline_color \?\? null\) : null/);
assert.doesNotMatch(editor, /Overlay Color #/);
assert.doesNotMatch(gantt, /Planning progress:/);
assert.match(panel, /timelineBehaviorLabel\(phase\)/);
assert.match(panel, /dateLabel \?\? "Undated"/);
assert.match(inspector, /label:\s*"Planning"/);
assert.doesNotMatch(shell, /\/whiteboard|nav\.planning/);
assert.match(settings, /PhaseLibraryManager/);
assert.match(migration, /PLANNING_REFACTOR_SOURCE_NOT_EMPTY/);
assert.match(migration, /rename to planning_phases/);
assert.match(migration, /create table public\.planning_items/);
assert.match(migration, /create table public\.planning_phase_library_items/);
assert.match(migration, /revoke all privileges/);
assert.doesNotMatch(migration, /create table public\.planning_steps/);
assert.match(refinement, /add column default_timeline_color/);
assert.match(refinement, /add column timeline_color/);
assert.match(refinement, /add column library_phase_id/);
assert.match(refinement, /enforce_planning_phase_limit/);
assert.match(refinement, /old\.timeline_behavior = 'pause'/);
assert.match(refinement, /phase\.timeline_behavior <> 'pause'/);
assert.doesNotMatch(schedulingMigration, /shift_with_production/);
assert.match(schedulingMigration, /save_production_planning_schedule_batch/);
assert.match(schedulingMigration, /security definer/);
assert.match(schedulingMigration, /set search_path = public, pg_temp/);
assert.match(schedulingMigration, /revoke all on function public\.save_production_planning_schedule_batch/);
assert.match(schedulingVerification, /VERIFY_MIXED_ATOMIC_SAVE/);
assert.match(schedulingVerification, /VERIFY_STALE_PHASE_CONFLICT/);
assert.match(schedulingVerification, /VERIFY_STALE_PRODUCTION_CONFLICT/);
assert.match(schedulingVerification, /VERIFY_PRODUCTION_CONFLICT_PARTIAL_WRITE/);
assert.match(schedulingVerification, /rollback;/);
assert.match(schedulingModel, /translatedPlanningIntervals/);
assert.match(schedulingModel, /circular_dependency/);
assert.match(schedulingModel, /dependency_overlap/);
assert.match(scheduling, /productionStartDelta/);
assert.match(scheduling, /adjustPlanningInterval/);
assert.match(scheduling, /translateJobPlanningSchedules/);
assert.match(gantt, /startPhaseInteraction/);
assert.match(gantt, /phase\.timeline_behavior === 'planning_only'/);
assert.match(gantt, /handlePhaseScheduleKey/);
assert.match(gantt, /resize-start/);
assert.match(gantt, /resize-end/);
assert.match(gantt, /stagedPlanningSchedules/);
assert.match(gantt, /phaseInteraction\.previewStart/);
assert.doesNotMatch(workspace, /Apply proposed Planning shifts|Keep Planning dates unchanged/);
assert.match(workspace, /SchedulingFeedbackPanel/);
assert.match(workspace, /schedulingErrors\.length > 0/);
assert.match(workspace, /saveProductionPlanningScheduleBatch/);
assert.match(inspector, /stagedPlanningSchedules/);
assert.match(panel, /Unsaved schedule/);

console.log("Planning verifier passed.");
