import type { ProductionJob } from './types';

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
