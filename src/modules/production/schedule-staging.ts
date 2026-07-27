import type { ProductionScheduleBatchProposal, ProductionScheduleBatchRpcArgs } from './schedule-batch-contract';
import type { ProductionJob } from './types';

export type StagedSchedule = ProductionScheduleBatchProposal & {
  changed_fields: Array<'planned_start' | 'planned_end'>;
};
export type StagedSchedules = Record<string, StagedSchedule>;

export function stageSchedule(current: StagedSchedules, job: ProductionJob, start: string | null, end: string | null, source: StagedSchedule['change_source']): StagedSchedules {
  const existing = current[job.id];
  const originalStart = existing?.original_planned_start ?? job.planned_start;
  const originalEnd = existing?.original_planned_end ?? job.planned_end;
  if (start === originalStart && end === originalEnd) {
    const next = { ...current }; delete next[job.id]; return next;
  }
  const changed_fields: StagedSchedule['changed_fields'] = [];
  if (start !== originalStart) changed_fields.push('planned_start');
  if (end !== originalEnd) changed_fields.push('planned_end');
  return { ...current, [job.id]: { job_id: job.id, original_planned_start: originalStart, original_planned_end: originalEnd, original_updated_at: existing?.original_updated_at ?? job.updated_at, proposed_planned_start: start, proposed_planned_end: end, change_source: source, changed_fields } };
}

export function orderedStagedSchedules(staged: StagedSchedules, jobs: ProductionJob[]) {
  const order = new Map(jobs.map((job, index) => [job.id, index]));
  return Object.values(staged).sort((a, b) => (order.get(a.job_id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.job_id) ?? Number.MAX_SAFE_INTEGER));
}

export function batchRpcArgs(staged: StagedSchedules, jobs: ProductionJob[], actor: string, note: string | null, batchId: string): ProductionScheduleBatchRpcArgs {
  return { p_proposals: orderedStagedSchedules(staged, jobs).map((stagedProposal) => { const proposal = { ...stagedProposal }; delete (proposal as Partial<StagedSchedule>).changed_fields; return proposal; }), p_changed_by: actor, p_change_note: note, p_batch_id: batchId };
}

export function reconcileBatch(jobs: ProductionJob[], updated: ProductionJob[]) {
  const byId = new Map(updated.map((job) => [job.id, job]));
  return jobs.map((job) => byId.get(job.id) ?? job);
}

export function rebaseStagedScheduleVersion(
  staged: StagedSchedules,
  updatedJob: ProductionJob,
): StagedSchedules {
  const proposal = staged[updatedJob.id];
  if (!proposal) return staged;

  const scheduleBaselineIsUnchanged =
    updatedJob.planned_start === proposal.original_planned_start
    && updatedJob.planned_end === proposal.original_planned_end;
  if (!scheduleBaselineIsUnchanged) return staged;

  return {
    ...staged,
    [updatedJob.id]: {
      ...proposal,
      original_updated_at: updatedJob.updated_at,
    },
  };
}

export function hasUnsavedSchedules(staged: StagedSchedules) { return Object.keys(staged).length > 0; }
