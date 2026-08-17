import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { batchRpcArgs, hasUnsavedSchedules, orderedStagedSchedules, rebaseStagedScheduleVersion, reconcileBatch, scheduleSaveBlockedByInspector, stageSchedule } from '../src/modules/production/schedule-staging.ts';
import { describeProductionScheduleSaveError } from '../src/modules/production/schedule-batch-contract.ts';

const job = (id, start, end) => ({ id, name: id, job_number: id, planned_start: start, planned_end: end, updated_at: `2026-07-16T00:00:0${id}.000Z` });
const jobs = [job('a', '2026-07-01', '2026-07-02'), job('b', '2026-07-03', '2026-07-04')];
const createdV1 = { ...job('created', null, null), updated_at: '2026-07-16T03:00:00.000Z' };
const canonicalV2 = { ...createdV1, updated_at: '2026-07-16T03:01:00.000Z' };
const handoffStaged = stageSchedule({}, canonicalV2, '2026-08-01', '2026-08-07', 'production_inspector');
assert.notEqual(canonicalV2.updated_at, createdV1.updated_at);
assert.equal(handoffStaged.created.original_updated_at, canonicalV2.updated_at);
assert.notEqual(handoffStaged.created.original_updated_at, createdV1.updated_at);
const canonicalV3 = { ...canonicalV2, updated_at: '2026-07-16T03:02:00.000Z' };
const stagedBaselineConflictsWith = (proposal, canonical) => (
  proposal.original_planned_start !== canonical.planned_start
  || proposal.original_planned_end !== canonical.planned_end
  || proposal.original_updated_at !== canonical.updated_at
);
assert.equal(stagedBaselineConflictsWith(handoffStaged.created, canonicalV2), false);
assert.equal(stagedBaselineConflictsWith(handoffStaged.created, canonicalV3), true);
let staged = {};
staged = stageSchedule(staged, jobs[0], '2026-07-02', '2026-07-03', 'production_timeline');
staged = stageSchedule(staged, jobs[1], '2026-07-04', '2026-07-05', 'production_table');
assert.equal(Object.keys(staged).length, 2);
staged = stageSchedule(staged, jobs[0], '2026-07-05', '2026-07-06', 'production_inspector');
assert.equal(Object.keys(staged).length, 2);
assert.equal(staged.a.proposed_planned_start, '2026-07-05');
assert.deepEqual(orderedStagedSchedules(staged, jobs).map((item) => item.job_id), ['a', 'b']);
const args = batchRpcArgs(staged, jobs, 'Planner', null, 'batch-id');
assert.equal(args.p_batch_id, 'batch-id');
assert.equal(args.p_proposals.length, 2);
assert.equal('changed_fields' in args.p_proposals[0], false);
staged = stageSchedule(staged, jobs[1], jobs[1].planned_start, jobs[1].planned_end, 'production_table');
assert.deepEqual(Object.keys(staged), ['a']);
assert.equal(hasUnsavedSchedules(staged), true);
assert.equal(reconcileBatch(jobs, [{ ...jobs[0], name: 'updated' }])[0].name, 'updated');
const rebased = rebaseStagedScheduleVersion(staged, {
  ...jobs[0],
  requested_delivery_date: '2026-07-20',
  updated_at: '2026-07-16T01:00:00.000Z',
});
assert.equal(rebased.a.original_updated_at, '2026-07-16T01:00:00.000Z');
assert.equal(rebased.a.original_planned_start, jobs[0].planned_start);
assert.equal(rebased.a.original_planned_end, jobs[0].planned_end);
assert.equal(rebased.a.proposed_planned_start, staged.a.proposed_planned_start);
assert.equal(rebased.a.proposed_planned_end, staged.a.proposed_planned_end);
assert.deepEqual(rebased.a.changed_fields, staged.a.changed_fields);
assert.equal(hasUnsavedSchedules(rebased), true);
const ordinarySaveThenScheduleArgs = batchRpcArgs(
  rebased,
  [{ ...jobs[0], requested_delivery_date: '2026-07-20', updated_at: '2026-07-16T01:00:00.000Z' }, jobs[1]],
  'Planner',
  null,
  'ordinary-save-then-schedule',
);
assert.equal(ordinarySaveThenScheduleArgs.p_proposals[0].original_updated_at, '2026-07-16T01:00:00.000Z');
assert.equal(ordinarySaveThenScheduleArgs.p_proposals[0].proposed_planned_start, staged.a.proposed_planned_start);
assert.equal(ordinarySaveThenScheduleArgs.p_proposals[0].proposed_planned_end, staged.a.proposed_planned_end);
assert.equal(scheduleSaveBlockedByInspector({ jobId: 'a', dirty: true, saving: false }, staged), true);
assert.equal(scheduleSaveBlockedByInspector({ jobId: 'a', dirty: false, saving: true }, staged), true);
assert.equal(scheduleSaveBlockedByInspector({ jobId: 'a', dirty: false, saving: false }, rebased), false);
assert.equal(scheduleSaveBlockedByInspector({ jobId: 'b', dirty: true, saving: false }, staged), false);
assert.equal(scheduleSaveBlockedByInspector({ jobId: 'a', dirty: true, saving: false }, {}), false);
assert.equal(rebased.a.proposed_planned_start, staged.a.proposed_planned_start);
assert.equal(rebased.a.proposed_planned_end, staged.a.proposed_planned_end);
const concurrentSchedule = rebaseStagedScheduleVersion(staged, {
  ...jobs[0],
  planned_end: '2026-07-10',
  updated_at: '2026-07-16T02:00:00.000Z',
});
assert.equal(concurrentSchedule.a.original_updated_at, staged.a.original_updated_at);
assert.equal(concurrentSchedule.a.proposed_planned_start, staged.a.proposed_planned_start);
assert.equal(concurrentSchedule.a.proposed_planned_end, staged.a.proposed_planned_end);
const conflictFeedback = describeProductionScheduleSaveError({
  message: 'production_schedule_conflict',
  details: JSON.stringify({
    code: 'production_schedule_conflict',
    conflicts: [{
      job_id: 'a',
      job_number: '1234',
      name: 'McCullough',
      expected: {},
      current: {},
      proposed: {},
    }],
  }),
});
assert.match(conflictFeedback.message, /1234 changed after you began editing/);
assert.match(conflictFeedback.message, /proposed dates are still available/);
assert.equal(conflictFeedback.conflicts.length, 1);
const planningConflictFeedback = describeProductionScheduleSaveError({
  message: 'production_planning_schedule_conflict',
  details: JSON.stringify({ code: 'production_planning_schedule_conflict', conflicts: [{ title: 'Shop Drawings' }] }),
});
assert.match(planningConflictFeedback.message, /Shop Drawings changed after you began editing/);
assert.match(planningConflictFeedback.message, /Nothing was saved/);
assert.match(describeProductionScheduleSaveError({
  message: 'production_schedule_validation',
  details: JSON.stringify({
    code: 'production_schedule_validation',
    message: 'proposed dates must form a valid range',
  }),
}).message, /proposed dates must form a valid range/);
assert.equal(
  describeProductionScheduleSaveError(
    new Error('Production approval expired. Confirm the batch again.'),
  ).message,
  'Production approval expired. Confirm the batch again.',
);
const workspaceSource = readFileSync(new URL('../src/modules/production/ProductionWorkspace.tsx', import.meta.url), 'utf8');
const inspectorSource = readFileSync(new URL('../src/modules/production/components/ProductionJobInspector.tsx', import.meta.url), 'utf8');
const jobsSource = readFileSync(new URL('../src/modules/production/jobs.ts', import.meta.url), 'utf8');
assert.equal(workspaceSource.includes('saveProductionPlanningScheduleBatch('), true);
assert.equal(workspaceSource.includes('updateProductionJobSchedule'), false);
assert.equal(workspaceSource.includes('recordProductionScheduleAudit'), false);
assert.equal(workspaceSource.includes('rebaseStagedScheduleVersion(current, updated)'), true);
assert.equal(workspaceSource.includes('scheduleSaveBlockedByInspector(inspectorOrdinarySaveState, stagedSchedules)'), true);
assert.equal(workspaceSource.includes("Save the open Inspector job details before saving schedule changes. Proposed dates remain staged."), true);
assert.equal(workspaceSource.includes('scheduleIsStaged={Boolean(stagedSchedules[selectedJob.id])}'), true);
assert.equal(workspaceSource.includes('onSaveSchedule={openApprovalDialog}'), true);
assert.equal(workspaceSource.includes('onOrdinarySaveStateChange={setInspectorOrdinarySaveState}'), true);
assert.equal(workspaceSource.includes("onClick={() => { setApprovalDialogOpen(false); setApprovalPassword(''); setApprovalError(''); }}"), true);
assert.equal(inspectorSource.includes('Schedule changes pending'), true);
assert.equal(inspectorSource.includes('onClick={onSaveSchedule}'), true);
assert.equal(inspectorSource.includes('Save job details first. Planned dates will remain staged.'), true);
assert.equal(inspectorSource.includes('scheduleSaveDisabled || dirtyCount > 0 || saving'), true);
assert.equal(inspectorSource.includes('planned_start: job.planned_start'), false);
assert.equal(inspectorSource.includes('planned_end: job.planned_end'), false);
assert.equal(inspectorSource.includes('Planned dates remain staged for Save All.'), true);
assert.equal(jobsSource.includes("supabase.rpc('save_production_schedule_batch'"), true);
assert.equal(jobsSource.includes("supabase.rpc('save_production_planning_schedule_batch'"), true);
assert.equal(jobsSource.includes('updateProductionJobSchedule'), false);
assert.equal(jobsSource.includes('recordProductionScheduleAudit'), false);
console.log('Production schedule staging checks passed.');
