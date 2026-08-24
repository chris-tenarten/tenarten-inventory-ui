import type { ProductionStatus } from '../production/types';
import type {
  ManpowerEntry,
  ManpowerJob,
  ManpowerReworkCycle,
  ManpowerWorkTarget,
} from './types';

export const UNLISTED_WORK_TARGET = '__unlisted__';

export type ManpowerWorkTargetOption = {
  value: string;
  target: Exclude<ManpowerWorkTarget, { kind: 'temporary' }>;
  label: string;
  status: ProductionStatus;
  selectable: boolean;
};

export function manpowerJobLabel(job: Pick<ManpowerJob, 'name' | 'job_number'>) {
  return job.job_number ? `${job.job_number} — ${job.name}` : job.name;
}

export function manpowerJobTargetValue(jobId: string) {
  return `job:${jobId}`;
}

export function manpowerReworkTargetValue(reworkCycleId: string) {
  return `rework:${reworkCycleId}`;
}

export function manpowerEntryTargetValue(
  entry: Pick<ManpowerEntry, 'job_id' | 'rework_cycle_id'>,
) {
  if (entry.rework_cycle_id) return manpowerReworkTargetValue(entry.rework_cycle_id);
  if (entry.job_id) return manpowerJobTargetValue(entry.job_id);
  return UNLISTED_WORK_TARGET;
}

function reworkOption(job: ManpowerJob, cycle: ManpowerReworkCycle, selectable: boolean): ManpowerWorkTargetOption {
  return {
    value: manpowerReworkTargetValue(cycle.id),
    target: { kind: 'rework', jobId: job.id, reworkCycleId: cycle.id },
    label: `${manpowerJobLabel(job)} · REWORK #${cycle.sequence_number}`,
    status: cycle.production_status,
    selectable,
  };
}

export function buildManpowerWorkTargetOptions(
  jobs: ManpowerJob[],
  entries: ManpowerEntry[] = [],
): ManpowerWorkTargetOption[] {
  const options: ManpowerWorkTargetOption[] = [];
  const values = new Set<string>();
  for (const job of jobs) {
    const base: ManpowerWorkTargetOption = {
      value: manpowerJobTargetValue(job.id),
      target: { kind: 'job', jobId: job.id },
      label: manpowerJobLabel(job),
      status: job.production_status,
      selectable: true,
    };
    options.push(base);
    values.add(base.value);
    if (job.active_rework_cycle) {
      const active = reworkOption(job, job.active_rework_cycle, true);
      options.push(active);
      values.add(active.value);
    }
  }
  for (const entry of entries) {
    if (!entry.job || !entry.rework_cycle) continue;
    const value = manpowerReworkTargetValue(entry.rework_cycle.id);
    if (values.has(value)) continue;
    options.push(reworkOption(entry.job, entry.rework_cycle, false));
    values.add(value);
  }
  return options;
}

export function manpowerIdentityForTarget(
  value: string,
  temporaryLabel: string,
  options: ManpowerWorkTargetOption[],
) {
  if (value === UNLISTED_WORK_TARGET) {
    return { job_id: null, rework_cycle_id: null, unlisted_work_label: temporaryLabel.trim() };
  }
  const option = options.find((candidate) => candidate.value === value);
  if (!option) throw new Error('Choose a valid Production Job or Rework lifecycle.');
  if (option.target.kind === 'rework') {
    return {
      job_id: option.target.jobId,
      rework_cycle_id: option.target.reworkCycleId,
      unlisted_work_label: null,
    };
  }
  return { job_id: option.target.jobId, rework_cycle_id: null, unlisted_work_label: null };
}
