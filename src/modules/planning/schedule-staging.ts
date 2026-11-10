import type { PlanningPhase } from './types';
import { evaluatePlanningSchedule, planningProductionStartDelta, translatedPlanningIntervals } from './schedule-model.mjs';
import type { PlanningScheduleIssue } from './schedule-model.mjs';
import type { ProductionJob } from '@/modules/production/types';

export type PlanningScheduleChangeSource = 'planning_timeline' | 'production_reschedule';

export type StagedPlanningSchedule = {
  phase_id: string;
  job_id: string;
  original_start_date: string;
  original_end_date: string;
  original_updated_at: string;
  proposed_start_date: string;
  proposed_end_date: string;
  change_source: PlanningScheduleChangeSource;
  changed_fields: Array<'start_date' | 'end_date'>;
};

export type StagedPlanningSchedules = Record<string, StagedPlanningSchedule>;

export { adjustPlanningInterval } from './schedule-model.mjs';

export function stagePlanningSchedule(
  current: StagedPlanningSchedules,
  phase: PlanningPhase,
  start: string,
  end: string,
  source: PlanningScheduleChangeSource,
): StagedPlanningSchedules {
  if (!phase.start_date || !phase.end_date) return current;
  const existing = current[phase.id];
  const originalStart = existing?.original_start_date ?? phase.start_date;
  const originalEnd = existing?.original_end_date ?? phase.end_date;
  if (start === originalStart && end === originalEnd) {
    const next = { ...current };
    delete next[phase.id];
    return next;
  }
  const changedFields: StagedPlanningSchedule['changed_fields'] = [];
  if (start !== originalStart) changedFields.push('start_date');
  if (end !== originalEnd) changedFields.push('end_date');
  return {
    ...current,
    [phase.id]: {
      phase_id: phase.id,
      job_id: phase.job_id,
      original_start_date: originalStart,
      original_end_date: originalEnd,
      original_updated_at: existing?.original_updated_at ?? phase.updated_at,
      proposed_start_date: start,
      proposed_end_date: end,
      change_source: source,
      changed_fields: changedFields,
    },
  };
}

export function planningPhaseWithStagedDates(phase: PlanningPhase, staged: StagedPlanningSchedules) {
  const proposal = staged[phase.id];
  return proposal
    ? { ...phase, start_date: proposal.proposed_start_date, end_date: proposal.proposed_end_date }
    : phase;
}

export function productionStartDelta(job: ProductionJob, proposedStart: string | null) {
  return planningProductionStartDelta(job.planned_start, proposedStart);
}

export function translateJobPlanningSchedules(
  current: StagedPlanningSchedules,
  phases: PlanningPhase[],
  jobId: string,
  deltaDays: number,
) {
  return translatedPlanningIntervals(phases, current, jobId, deltaDays).reduce((next, interval) => (
    stagePlanningSchedule(next, interval.phase, interval.start, interval.end, interval.source)
  ), current);
}

export function schedulingIssues(phases: PlanningPhase[], jobs: ProductionJob[]): PlanningScheduleIssue[] {
  return evaluatePlanningSchedule(phases, jobs);
}

export function hasUnsavedPlanningSchedules(staged: StagedPlanningSchedules) {
  return Object.keys(staged).length > 0;
}

export function rebaseStagedPlanningVersion(staged: StagedPlanningSchedules, phase: PlanningPhase) {
  const proposal = staged[phase.id];
  if (!proposal || phase.start_date !== proposal.original_start_date || phase.end_date !== proposal.original_end_date) return staged;
  return { ...staged, [phase.id]: { ...proposal, original_updated_at: phase.updated_at } };
}
