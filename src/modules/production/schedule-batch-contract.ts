import type { ProductionJob } from './types';
import type { PlanningPhase } from '@/modules/planning/types';
import type { StagedPlanningSchedule } from '@/modules/planning/schedule-staging';

export type ProductionScheduleBatchProposal = {
  job_id: string;
  original_planned_start: string | null;
  original_planned_end: string | null;
  original_updated_at: string;
  proposed_planned_start: string | null;
  proposed_planned_end: string | null;
  change_source: 'production_timeline' | 'production_table' | 'production_inspector';
};

export type ProductionScheduleBatchRequest = {
  proposals: ProductionScheduleBatchProposal[];
  changed_by: string;
  change_note: string | null;
  batch_id: string;
};

/** Arguments passed to supabase.rpc('save_production_schedule_batch', args). */
export type ProductionScheduleBatchRpcArgs = {
  p_proposals: ProductionScheduleBatchProposal[];
  p_changed_by: string;
  p_change_note: string | null;
  p_batch_id: string;
};

export type ProductionScheduleBatchUpdatedJob = ProductionJob & {
  changed_fields: Array<'planned_start' | 'planned_end'>;
};

export type ProductionScheduleBatchSuccess = {
  batch_id: string;
  replayed: boolean;
  updated_count: number;
  ignored_no_op_count: number;
  updated_jobs: ProductionScheduleBatchUpdatedJob[];
};

export type MixedScheduleBatchRpcArgs = {
  p_job_proposals: ProductionScheduleBatchProposal[];
  p_phase_proposals: Array<Omit<StagedPlanningSchedule, 'changed_fields' | 'job_id'>>;
  p_changed_by: string;
  p_change_note: string | null;
  p_batch_id: string;
};

export type MixedScheduleBatchSuccess = {
  batch_id: string;
  replayed: boolean;
  updated_count: number;
  updated_jobs: ProductionScheduleBatchUpdatedJob[];
  updated_phases: PlanningPhase[];
};

export type ProductionScheduleBatchConflictDetail = {
  code: 'production_schedule_conflict';
  conflicts: Array<{
    job_id: string;
    job_number: string | null;
    name: string;
    expected: { planned_start: string | null; planned_end: string | null; updated_at: string };
    current: { planned_start: string | null; planned_end: string | null; updated_at: string };
    proposed: { planned_start: string | null; planned_end: string | null };
  }>;
};

export type ProductionScheduleBatchValidationDetail = {
  code: 'production_schedule_validation' | 'production_schedule_batch_reused';
  message: string;
  proposal_index?: number;
};

/**
 * PostgreSQL raises P0001 with `message` equal to the detail code and `details`
 * containing the JSON-encoded conflict or validation shape above.
 */
export type ProductionScheduleBatchRpcError = {
  code: 'P0001';
  message: ProductionScheduleBatchConflictDetail['code'] | ProductionScheduleBatchValidationDetail['code'];
  details: string;
  hint: string | null;
};

export type ProductionScheduleErrorFeedback = {
  message: string;
  conflicts: ProductionScheduleBatchConflictDetail['conflicts'];
};

export function describeProductionScheduleSaveError(
  error: unknown,
): ProductionScheduleErrorFeedback {
  const candidate = error as { message?: string; details?: string };

  if (candidate.message === 'production_planning_schedule_conflict' && candidate.details) {
    try {
      const detail = JSON.parse(candidate.details) as { conflicts?: Array<{ title?: string }> };
      const labels = (detail.conflicts ?? []).slice(0, 2).map((conflict) => conflict.title?.trim()).filter(Boolean);
      const remaining = Math.max(0, (detail.conflicts?.length ?? 0) - labels.length);
      const subject = labels.length ? `${labels.join(', ')}${remaining ? ` and ${remaining} more` : ''}` : 'A Planning Phase';
      return {
        conflicts: [],
        message: `${subject} changed after you began editing. Nothing was saved, but your proposed dates are still available. Review the latest saved dates and try again.`,
      };
    } catch {
      // Use the shared safe conflict explanation below.
    }
  }

  if (
    candidate.message === 'production_schedule_conflict'
    && candidate.details
  ) {
    try {
      const detail = JSON.parse(
        candidate.details,
      ) as ProductionScheduleBatchConflictDetail;
      const conflicts = Array.isArray(detail.conflicts)
        ? detail.conflicts
        : [];
      const jobLabels = conflicts
        .slice(0, 2)
        .map((conflict) => conflict.job_number?.trim() || conflict.name)
        .filter(Boolean);
      const remaining = Math.max(0, conflicts.length - jobLabels.length);
      const subject = jobLabels.length
        ? `${jobLabels.join(', ')}${remaining ? ` and ${remaining} more` : ''}`
        : 'One or more jobs';
      return {
        conflicts,
        message: `${subject} changed after you began editing. The Production schedule was not saved, but your proposed dates are still available. Review the latest saved dates and try again.`,
      };
    } catch {
      // Fall through to the safe conflict explanation.
    }

    return {
      conflicts: [],
      message:
        'A Production job or Planning Phase changed after you began editing. Nothing was saved, but your proposed dates are still available. Review the latest saved dates and try again.',
    };
  }

  if (
    (
      candidate.message === 'production_schedule_validation'
      || candidate.message === 'production_planning_schedule_validation'
      || candidate.message === 'production_planning_schedule_batch_reused'
      || candidate.message === 'production_schedule_batch_reused'
    )
    && candidate.details
  ) {
    try {
      const detail = JSON.parse(
        candidate.details,
      ) as ProductionScheduleBatchValidationDetail;
      if (detail.message?.trim()) {
        return {
          conflicts: [],
          message: `The Production schedule was not saved: ${detail.message}`,
        };
      }
    } catch {
      // Use the safe fallback below.
    }
  }

  if (
    typeof candidate.message === 'string'
    && candidate.message.startsWith('Production approval')
  ) {
    return { conflicts: [], message: candidate.message };
  }

  return {
    conflicts: [],
    message:
      'The Production schedule could not be saved. Your proposed dates are still available. Check your connection and try again.',
  };
}
