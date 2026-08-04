import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { adjustPlanningInterval, dependentPlanningPhaseIds, evaluatePlanningSchedule, planningCascadeDelta, planningDependencyGraphIsAcyclic, planningProductionStartDelta, translatedPlanningIntervals } from '../src/modules/planning/schedule-model.mjs';

const phase = (id, overrides = {}) => ({ id, job_id: 'job', title: id, status: 'open', timeline_behavior: 'overlay', start_date: '2026-08-04', end_date: '2026-08-07', updated_at: `2026-08-03T00:00:0${id.length}.000Z`, blocked_by_phase_id: null, ...overrides });
const job = { id: 'job', planned_start: '2026-08-03', planned_end: '2026-08-28', requested_delivery_date: '2026-09-10' };

assert.deepEqual(adjustPlanningInterval('2026-08-04', '2026-08-07', 19, 'move'), { start: '2026-08-23', end: '2026-08-26' });
assert.deepEqual(adjustPlanningInterval('2026-08-04', '2026-08-07', 2, 'resize-start'), { start: '2026-08-06', end: '2026-08-07' });
assert.deepEqual(adjustPlanningInterval('2026-08-04', '2026-08-07', -2, 'resize-end'), { start: '2026-08-04', end: '2026-08-05' });
assert.deepEqual(adjustPlanningInterval('2026-08-04', '2026-08-07', 99, 'resize-start'), { start: '2026-08-07', end: '2026-08-07' });
assert.deepEqual(adjustPlanningInterval('2026-08-04', '2026-08-07', -99, 'resize-end'), { start: '2026-08-04', end: '2026-08-04' });
assert.equal(planningProductionStartDelta(job.planned_start, '2026-08-05'), 2);
assert.equal(planningProductionStartDelta(job.planned_start, job.planned_start), 0);

const overlay = phase('overlay');
const planningOnly = phase('planning-only', { timeline_behavior: 'planning_only', start_date: '2026-08-08', end_date: '2026-08-09' });
const pause = phase('pause', { timeline_behavior: 'pause', start_date: '2026-08-18', end_date: '2026-08-19' });
const completed = phase('completed', { status: 'done', start_date: '2026-08-01', end_date: '2026-08-02' });
const translated = translatedPlanningIntervals([overlay, planningOnly, pause, completed], {}, job.id, 2);
assert.deepEqual(translated.map(({ phase: item, start, end }) => [item.id, start, end]), [
  ['overlay', '2026-08-06', '2026-08-09'],
  ['planning-only', '2026-08-10', '2026-08-11'],
  ['pause', '2026-08-20', '2026-08-21'],
  ['completed', '2026-08-03', '2026-08-04'],
]);
assert.deepEqual(translatedPlanningIntervals([overlay], {}, job.id, 0), []);
const manual = { overlay: { proposed_start_date: '2026-08-06', proposed_end_date: '2026-08-09', change_source: 'planning_timeline' } };
assert.deepEqual(translatedPlanningIntervals([overlay], manual, job.id, -2).map(({ start, end, source }) => ({ start, end, source })), [{ start: '2026-08-04', end: '2026-08-07', source: 'planning_timeline' }]);

const predecessor = phase('predecessor', { start_date: '2026-08-01', end_date: '2026-08-05' });
const successor = phase('successor', { blocked_by_phase_id: predecessor.id, start_date: '2026-08-05', end_date: '2026-08-08' });
const warnings = evaluatePlanningSchedule([predecessor, successor], [job]);
assert.equal(warnings.find((issue) => issue.kind === 'dependency_overlap')?.severity, 'warning');
const healthy = evaluatePlanningSchedule([predecessor, { ...successor, start_date: '2026-08-06' }], [job]);
assert.equal(healthy.some((issue) => issue.kind === 'dependency_overlap'), false);
const circular = evaluatePlanningSchedule([{ ...predecessor, blocked_by_phase_id: successor.id }, successor], [job]);
assert.equal(circular.filter((issue) => issue.kind === 'circular_dependency').every((issue) => issue.severity === 'error'), true);
assert.equal(evaluatePlanningSchedule([phase('invalid', { start_date: '2026-08-08', end_date: '2026-08-07' })], [job])[0].severity, 'error');

const dependencyChain = [
  phase('color'),
  phase('drawings', { blocked_by_phase_id: 'color' }),
  phase('approval', { blocked_by_phase_id: 'drawings' }),
  phase('freeze', { blocked_by_phase_id: 'approval' }),
  phase('shipping', { blocked_by_phase_id: 'freeze' }),
  phase('parallel', { blocked_by_phase_id: 'drawings' }),
];
assert.deepEqual(dependentPlanningPhaseIds(dependencyChain, 'approval'), ['freeze', 'shipping']);
assert.deepEqual(dependentPlanningPhaseIds(dependencyChain, 'drawings'), ['approval', 'parallel', 'freeze', 'shipping']);
assert.deepEqual(dependentPlanningPhaseIds(dependencyChain, 'shipping'), []);
assert.equal(planningDependencyGraphIsAcyclic(dependencyChain, 'color'), true);
assert.equal(planningDependencyGraphIsAcyclic([{ ...dependencyChain[0], blocked_by_phase_id: 'shipping' }, ...dependencyChain.slice(1)], 'color'), false);
assert.equal(planningCascadeDelta('2026-08-01', '2026-08-05', '2026-08-03', '2026-08-07', 'move'), 2);
assert.equal(planningCascadeDelta('2026-08-01', '2026-08-05', '2026-08-01', '2026-08-07', 'resize-end'), 2);
assert.equal(planningCascadeDelta('2026-08-01', '2026-08-05', '2026-08-03', '2026-08-05', 'resize-start'), 0);

const preliminaryJob = { ...job, planned_start: '2026-08-03', planned_end: '2026-08-20', requested_delivery_date: '2026-08-25' };
assert.equal(evaluatePlanningSchedule([phase('inside', { start_date: '2026-08-03', end_date: '2026-08-20' })], [preliminaryJob]).some((issue) => issue.kind.includes('preliminary_timeline')), false);
assert.equal(evaluatePlanningSchedule([phase('before', { start_date: '2026-08-01', end_date: '2026-08-06' })], [preliminaryJob]).find((issue) => issue.kind === 'before_preliminary_timeline')?.message, 'before begins 2 days before the job’s preliminary timeline.');
assert.equal(evaluatePlanningSchedule([phase('after', { start_date: '2026-08-18', end_date: '2026-08-23' })], [preliminaryJob]).find((issue) => issue.kind === 'after_preliminary_timeline')?.message, 'after finishes 3 days after the job’s preliminary timeline.');
assert.equal(evaluatePlanningSchedule([phase('both', { start_date: '2026-08-01', end_date: '2026-08-23' })], [preliminaryJob]).find((issue) => issue.kind === 'spans_preliminary_timeline')?.message, 'both: This Phase begins before and finishes after the job’s preliminary timeline.');
assert.equal(evaluatePlanningSchedule([phase('pause-outside', { timeline_behavior: 'pause', start_date: '2026-08-22', end_date: '2026-08-23' })], [preliminaryJob]).find((issue) => issue.kind === 'outside_preliminary_timeline')?.message, 'pause-outside: This calendar constraint does not intersect the job’s preliminary timeline.');
const stagedPreliminaryJob = { ...preliminaryJob, planned_start: '2026-08-01', planned_end: '2026-08-23' };
assert.equal(evaluatePlanningSchedule([phase('staged-inside', { start_date: '2026-08-01', end_date: '2026-08-23' })], [stagedPreliminaryJob]).some((issue) => issue.kind.includes('preliminary_timeline')), false);
const cascadedBeyond = dependencyChain.map((item) => item.id === 'shipping' ? { ...item, start_date: '2026-08-22', end_date: '2026-08-24' } : item);
const cascadeBoundaryIssues = evaluatePlanningSchedule(cascadedBeyond, [preliminaryJob]);
assert.equal(cascadeBoundaryIssues.some((issue) => issue.kind === 'after_preliminary_timeline'), true);
assert.equal(cascadeBoundaryIssues.some((issue) => issue.severity === 'error'), false);
assert.equal(evaluatePlanningSchedule([phase('returned-inside', { start_date: '2026-08-05', end_date: '2026-08-10' })], [preliminaryJob]).some((issue) => issue.kind.includes('preliminary_timeline')), false);
const multiPredecessor = phase('multi-predecessor', { start_date: '2026-08-20', end_date: '2026-08-28' });
const multiplyWarned = phase('multi-warning', { blocked_by_phase_id: multiPredecessor.id, start_date: '2026-08-26', end_date: '2026-08-30' });
const multipleWarnings = evaluatePlanningSchedule([multiPredecessor, multiplyWarned], [preliminaryJob]).filter((issue) => issue.phase_ids.includes(multiplyWarned.id) && issue.severity === 'warning');
assert.equal(multipleWarnings.some((issue) => issue.kind === 'dependency_overlap'), true);
assert.equal(multipleWarnings.some((issue) => issue.kind === 'after_preliminary_timeline'), true);
assert.equal(multipleWarnings.some((issue) => issue.kind === 'after_delivery'), true);

const gantt = await readFile(new URL('../src/modules/production/components/ProductionGantt.tsx', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../src/modules/production/ProductionWorkspace.tsx', import.meta.url), 'utf8');
const staging = await readFile(new URL('../src/modules/planning/schedule-staging.ts', import.meta.url), 'utf8');
const inspector = await readFile(new URL('../src/modules/planning/PlanningPanel.tsx', import.meta.url), 'utf8');
const review = await readFile(new URL('../src/modules/production/components/ScheduleReviewDialog.tsx', import.meta.url), 'utf8');
assert.match(gantt, /DRAG_THRESHOLD_PX/);
assert.match(gantt, /phaseInteraction\.previewStart/);
assert.match(gantt, /planningIssues/);
assert.match(gantt, /connectorColor/);
assert.match(gantt, /#d97706/);
assert.match(gantt, /#dc2626/);
assert.match(gantt, /focusDependencyIssue/);
assert.match(gantt, /planningDependencyGraphIsAcyclic/);
assert.match(gantt, /dependentPlanningPhaseIds/);
assert.match(gantt, /data-planning-warning-popover/);
assert.match(gantt, /Dependency remains intact/);
assert.match(gantt, /phaseIssues\.map/);
assert.match(gantt, /Scheduling feedback for/);
assert.match(gantt, /issue\.kind !== 'dependency_overlap' && issue\.kind !== 'circular_dependency'/);
assert.match(gantt, /<rect x=\{destinationNodeX\} y=\{blockedY - destinationNodeSize \/ 2\}/);
assert.match(gantt, /issueIsOpen \? 'z-40'/);
const phaseInteractionSource = gantt.slice(gantt.indexOf('function startPhaseInteraction'), gantt.indexOf('function handleScheduleKey'));
assert.doesNotMatch(phaseInteractionSource, /altKey|Alt-drag|modifier-key/);
assert.match(gantt, /Last saved schedule for \$\{phase\.title\}/);
assert.match(workspace, /translateJobPlanningSchedules/);
assert.match(workspace, /schedulingErrors\.length > 0/);
assert.match(workspace, /SchedulingFeedbackPanel/);
assert.match(workspace, /ScheduleReviewDialog/);
assert.match(workspace, /planned_start: stagedSchedules\[job\.id\]\.proposed_planned_start/);
assert.match(workspace, /schedulingErrors = activePlanningIssues\.filter\(\(issue\) => issue\.severity === 'error'\)/);
assert.match(inspector, /issue\.inspector_message \?\? issue\.message/);
assert.match(inspector, /Waiting for/);
assert.match(review, /issues\.map/);
assert.match(staging, /stagePlanningSchedule/);
assert.match(staging, /planningPhaseWithStagedDates/);
assert.match(staging, /rebaseStagedPlanningVersion/);

console.log('Planning schedule staging checks passed.');
