import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calculatePhaseProgress, calculatePlanningCoverage, calculatePlanningProgress } from "../src/modules/planning/progress.mjs";
import {
  isPlanningEnabled,
  normalizeLoadedJobIds,
  planningIntervalGeometry,
  selectCollapsedTimelinePhases,
} from "../src/modules/planning/timeline-model.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [migration, refinement, progressMigration, progressVerification, schedulingMigration, schedulingVerification, scheduling, schedulingModel, data, panel, creationDialog, itemEditor, editor, library, collapsedPhaseDisplay, collapsedPhaseToggle, workspace, gantt, inspector, shell, settings, visuals, demo] = await Promise.all([
  read("supabase/migrations/20260731_003_planning_phases_items.sql"),
  read("supabase/migrations/20260803_001_planning_library_colors_and_phase_cap.sql"),
  read("supabase/migrations/20260804_001_planning_execution_progress.sql"),
  read("supabase/inspection/20260804_001_planning_execution_progress_verification.sql"),
  read("supabase/migrations/20260803_003_atomic_production_planning_schedule.sql"),
  read("supabase/inspection/20260803_003_atomic_production_planning_schedule_verification.sql"),
  read("src/modules/planning/schedule-staging.ts"),
  read("src/modules/planning/schedule-model.mjs"),
  read("src/modules/planning/data.ts"),
  read("src/modules/planning/PlanningPanel.tsx"),
  read("src/modules/planning/PhaseCreationDialog.tsx"),
  read("src/modules/planning/PlanningItemEditor.tsx"),
  read("src/modules/planning/PlanningPhaseEditor.tsx"),
  read("src/modules/planning/PhaseLibraryManager.tsx"),
  read("src/modules/planning/collapsed-phase-display.ts"),
  read("src/modules/planning/CollapsedPhaseDisplayToggle.tsx"),
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
  { id: "1", phase_id: "p1", is_complete: true, estimated_hours: 2 },
  { id: "2", phase_id: "p1", is_complete: false, estimated_hours: 6 },
  { id: "3", phase_id: "p2", is_complete: true, estimated_hours: 4.5 },
];
assert.deepEqual(calculatePhaseProgress(items.slice(0, 2)), { completedItems: 1, totalItems: 2, completedHours: 2, totalHours: 8, percent: 25 });
assert.deepEqual(calculatePlanningProgress([phase("p1"), phase("p2", { timeline_behavior: "planning_only" })], items), { completedItems: 2, totalItems: 3, completedHours: 6.5, totalHours: 12.5, percent: 52 });
assert.deepEqual(calculatePlanningProgress([phase("p1"), phase("p2", { timeline_behavior: "pause" })], items), { completedItems: 1, totalItems: 2, completedHours: 2, totalHours: 8, percent: 25 });
assert.deepEqual(calculatePlanningProgress([], []), { completedItems: 0, totalItems: 0, completedHours: 0, totalHours: 0, percent: 0 });
assert.deepEqual(calculatePlanningCoverage([phase("p1"), phase("p2", { timeline_behavior: "planning_only" })], items), { plannedItems: 3, plannedHours: 12.5, activePhases: 2 });

const selected = selectCollapsedTimelinePhases([
  phase("far", { start_date: "2027-01-01", end_date: "2027-01-02" }), phase("normal"),
  phase("pause", { timeline_behavior: "pause" }), phase("third"), phase("fourth"),
], { canvasStart: "2026-07-01", canvasEnd: "2026-09-01", productionStart: "2026-08-01", productionEnd: "2026-08-05" });
assert.equal(selected.visible.length, 4);
assert.equal(selected.hidden.length, 0);
assert.equal(selected.all.some((entry) => entry.id === "far"), false);

assert.match(data, /from\("planning_phases"\)/);
assert.match(data, /from\("planning_items"\)/);
assert.match(data, /estimated_hours: template\.estimated_hours/);
assert.match(data, /deletePlanningPhase\(phase\.id\)/);
assert.match(data, /entry\.default_timeline_behavior !== "pause" && item\.library_phase_id === entry\.id/);
assert.match(data, /\.neq\("timeline_behavior", "pause"\)/);
assert.match(data, /timeline_color: entry\.default_timeline_behavior === "overlay" \? entry\.default_timeline_color : null/);
assert.match(data, /library_phase_id: entry\.id/);
assert.match(data, /selectedLibraryItemIds\?: readonly string\[\]/);
assert.match(data, /selectedItemIds\.has\(item\.id\)/);
assert.match(data, /default_shift_with_production\?: boolean/);
assert.match(data, /shift_with_production: shiftWithProduction/);
assert.match(panel, /Items/);
assert.match(panel, /Execution Progress/);
assert.match(panel, /Planning Coverage/);
assert.match(panel, /Weighted completion of all modeled Planning Items for this job\./);
assert.doesNotMatch(panel, /Planning Progress/);
assert.match(panel, /phaseProgress\.completedHours/);
assert.match(panel, /onItemsChanged/);
assert.match(panel, /savingCompletionIdsRef/);
assert.match(panel, /if \(savingCompletionIdsRef\.current\.has\(item\.id\)\) return/);
assert.match(panel, /replacePublishedItem\(item\.id, \(current\) => \(\{ \.\.\.current, is_complete: isComplete \}\)\)/);
assert.match(panel, /await updatePlanningItem\(item\.id, \{ is_complete: isComplete \}\)/);
assert.match(panel, /is_complete: previousCompletion/);
assert.match(panel, /disabled=\{savingCompletionIds\.has\(item\.id\)\}/);
assert.match(panel, />Saving<\/span>/);
assert.match(itemEditor, /Estimated hours/);
assert.match(itemEditor, /estimatedHours <= 0/);
assert.match(itemEditor, /embedded \? editor/);
assert.match(itemEditor, /Back to \$\{backLabel\}/);
assert.match(editor, /calculatePhaseProgress\(items\)/);
assert.match(editor, /Execution Progress/);
assert.doesNotMatch(editor, /Planning Progress/);
assert.match(editor, /planned hrs/);
assert.match(editor, /Items complete/);
assert.match(editor, /Item Overview/);
assert.match(editor, /max-h-52 overflow-y-auto/);
assert.match(editor, /draft\.timeline !== "pause"/);
assert.match(editor, /<PlanningItemEditor embedded/);
assert.match(panel, /items=\{phaseEditor \? items\.filter/);
assert.match(panel, /onSaveItem=/);
assert.match(panel, /onDeleteItem=/);
assert.match(panel, /leftPhase\.start_date\.localeCompare\(rightPhase\.start_date\)/);
assert.match(panel, /leftPhase\.end_date\.localeCompare\(rightPhase\.end_date\)/);
assert.match(panel, /left\.created_at\.localeCompare\(right\.created_at\)/);
assert.match(panel, /openPhaseCreation\(value, event\.currentTarget\)/);
assert.match(panel, /<PhaseCreationDialog/);
assert.match(creationDialog, /Select All/);
assert.match(creationDialog, /Deselect All/);
assert.match(creationDialog, /Template name/);
assert.match(creationDialog, /Estimated Hours/);
assert.match(creationDialog, /Item Count/);
assert.match(creationDialog, /Select at least one Item to create this Phase\./);
assert.match(creationDialog, /entry\.default_timeline_behavior === "overlay"/);
assert.match(creationDialog, /selectedItems\.reduce/);
assert.match(creationDialog, /disabled=\{busy \|\| selectionInvalid\}/);
assert.match(inspector, /role="tablist"\s+aria-label="Job inspector sections"/,
  'Inspector sections must remain an accessible tab strip');
assert.match(inspector, /className="(?=[^"]*\bflex\b)(?=[^"]*\boverflow-x-auto\b)(?=[^"]*\bborder-b\b)[^"]*"/,
  'Inspector tabs must remain horizontally scrollable with a visible strip boundary');
assert.match(inspector, /planningEnabled \? \[\{ id: "planning" as const, label: "Planning" \}\] : \[\]/,
  'Planning must remain present in the Inspector tab model when enabled');
assert.match(inspector, /role="tab"[\s\S]{0,180}aria-selected=\{activeSection === tab\.id\}[\s\S]{0,220}onClick=\{\(\) => selectSection\(tab\.id\)\}/,
  'Inspector tabs must retain selected state and section navigation');
assert.match(inspector, /activeSection === "planning" && planningEnabled[\s\S]{0,260}<PlanningPanel/,
  'Selecting Planning must continue rendering the Planning panel');
assert.match(inspector, /className=\{`(?=[^`]*\bmin-w-max\b)(?=[^`]*\bborder-b-2\b)[^`]*`\}/,
  'Individual tabs must remain non-wrapping and visibly selectable');
assert.match(panel, /Phase Library/);
assert.match(library, /Nothing is added to a Production job automatically/);
assert.match(library, /Save the Phase definition before adding reusable Items/);
assert.match(library, /Back to \{returnContext\.jobName\}/);
assert.match(workspace, /const planningDataPromise = planningEnabled[\s\S]{0,180}loadPlanningPhases\(visibleJobs\.map\(\(job\) => job\.id\)\)/,
  'Planning-enabled Production loads phases for the currently visible Jobs');
assert.match(workspace, /loadPlanningPhases[\s\S]{0,220}items: await loadPlanningItems\(loadedPlanningPhases\.map\(\(phase\) => phase\.id\)\)/,
  'Production loads Planning items from the phases returned by the phase query');
assert.match(gantt, /phaseProgress\.percent/);
assert.match(gantt, /progressClassName/);
assert.match(gantt, /data-planning-progress-fill/);
assert.match(gantt, /data-planning-progress-boundary/);
assert.match(gantt, /data-planning-execution-metric/);
assert.match(gantt, /PhaseExecutionLabels title=\{phase\.title\} percent=\{phaseProgress\.percent\}/);
assert.match(gantt, /barWidth < 48/);
assert.match(gantt, /barWidth >= 112/);
assert.doesNotMatch(gantt, /PhaseExecutionLabels[^\n]*completedItems/);
assert.doesNotMatch(gantt, /data-planning-phase-title className="[^"]*bg-/);
assert.doesNotMatch(gantt, /data-planning-execution-metric[^>]*bg-/);
assert.match(gantt, /textShadow/);
assert.doesNotMatch(gantt, />Planning \{jobPhases\.length\}</);
assert.match(gantt, /No Planning Phases/);
assert.match(gantt, /Show Planning lanes/);
assert.match(gantt, /Hide Planning lanes/);
assert.match(gantt, /inCanvasPhases\.map/);
assert.doesNotMatch(gantt, /collapsedPhases\.hidden|additional Phase/);
assert.match(gantt, /data-collapsed-phase-display=\{collapsedPhaseDisplay\}/);
assert.match(gantt, /data-mobile-read-only=\{mobileReadOnly \? 'true' : undefined\}/);
assert.match(gantt, /window\.matchMedia\('\(pointer: coarse\) and \(max-width: 1023px\)'\)/);
assert.match(gantt, /window\.matchMedia\('\(orientation: landscape\) and \(max-width: 1023px\) and \(max-height: 600px\)'\)/);
assert.match(gantt, /mobileReadOnly \? mobileLandscape \? 220 : 176 : preferences\.railWidth/);
assert.match(gantt, /Mobile view · Read only/);
assert.match(gantt, /mobileLandscape \? 'Read only'/);
assert.match(gantt, /if \(mobileReadOnly\)[\s\S]*if \(mode === 'move'\) onSelectJob\(job\)/);
assert.match(gantt, /data-collapsed-planning-pause[\s\S]{0,500}collapsedPhaseDisplay === 'fill' \? '(?=[^']*\btop-1\/2\b)(?=[^']*\bh-8\b)(?=[^']*-translate-y-1\/2\b)[^']*' : `(?=[^`]*top-\[calc\(50%\+10px\)\])(?=[^`]*\bh-1\.5\b)[^`]*`/,
  'Collapsed pauses must fill the Production bar in Fill mode and use the compact strip geometry otherwise');
assert.match(gantt, /data-collapsed-planning-phase[\s\S]{0,500}collapsedPhaseDisplay === 'fill' \? '(?=[^']*\btop-1\/2\b)(?=[^']*\bh-8\b)(?=[^']*-translate-y-1\/2\b)[^']*' : '(?=[^']*top-\[calc\(50%\+10px\)\])(?=[^']*\bh-1\.5\b)[^']*'/,
  'Collapsed phase overlays must fill the Production bar in Fill mode and use the compact strip geometry otherwise');
assert.match(gantt, /data-collapsed-planning-phase[\s\S]{0,800}border-y border-l[\s\S]{0,500}borderColor: '#0f172a'/,
  'Collapsed phases must use a single thin dark boundary instead of a visible interval gap');
assert.match(gantt, /left: cardGeometry\.left - 3, width: cardGeometry\.width \+ 6/,
  'Collapsed overlay geometry must remove the shared editable-bar inset so contiguous dates touch');
assert.match(gantt, /collapsedPhaseDisplay === 'fill'[\s\S]{0,220}h-8 -translate-y-1\/2 opacity-70[\s\S]{0,220}visual\.className/,
  'Fill overlays must retain the original translucent tint across the full Production bar height');
assert.doesNotMatch(gantt, /data-collapsed-production-status-rail/,
  'Fill mode must not leave a separate Production-status strip visible above the phase tint');
assert.equal((gantt.match(/data-collapsed-production-label-copy/g) ?? []).length, 2,
  'Fill overlay Job and labor labels must share the outlined copy treatment');
assert.doesNotMatch(gantt, /data-collapsed-planning-progress-fill|data-collapsed-planning-progress-boundary/);
assert.doesNotMatch(library, /Collapsed Phase bar display|COLLAPSED_PHASE_DISPLAY_MODES/);
assert.match(panel, /<CollapsedPhaseDisplayToggle \/>/);
assert.match(collapsedPhaseToggle, /role="radiogroup" aria-label="Collapsed Phase bar display"/);
assert.match(collapsedPhaseToggle, /COLLAPSED_PHASE_DISPLAY_MODES\.map/);
assert.match(collapsedPhaseToggle, /Settings2 className="h-3 w-3 shrink-0"/);
assert.match(collapsedPhaseDisplay, /tenops\.planning\.collapsed-phase-display\.v1/);
assert.match(collapsedPhaseDisplay, /\["compact", "fill"\]/);
assert.match(collapsedPhaseDisplay, /typeof window === "undefined"\) return "fill"/);
assert.match(collapsedPhaseDisplay, /isCollapsedPhaseDisplayMode\(stored\) \? stored : "fill"/);
assert.match(collapsedPhaseDisplay, /window\.dispatchEvent/);
assert.match(collapsedPhaseToggle, /useState<CollapsedPhaseDisplayMode>\("fill"\)/);
assert.match(visuals, /steel_blue[\s\S]*bg-blue-300\/90/);
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
for (const title of ["Prep", "Grind", "CTS", "Finish", "Production Freeze", "Build A-Frame", "Rough Grind on Wizard"]) assert.match(demo, new RegExp(title));
assert.match(demo, /timeline_behavior: "pause"/);
assert.match(demo, /shift_with_production: false/);
assert.match(demo, /include_in_planning_progress: false/);
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
assert.match(progressMigration, /add column estimated_hours numeric\(10,2\) not null default 1/);
assert.equal((progressMigration.match(/estimated_hours > 0/g) ?? []).length, 2);
assert.match(progressMigration, /unrelated to Production labor estimates/);
assert.match(progressVerification, /VERIFY_NON_POSITIVE_ITEM_HOURS_ACCEPTED/);
assert.match(progressVerification, /VERIFY_NON_POSITIVE_LIBRARY_HOURS_ACCEPTED/);
assert.match(progressVerification, /rollback;/);
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
assert.match(workspace, /saveProductionReworkMixedScheduleBatch/);
assert.match(inspector, /stagedPlanningSchedules/);
assert.match(panel, /Unsaved schedule/);

console.log("Planning verifier passed.");
