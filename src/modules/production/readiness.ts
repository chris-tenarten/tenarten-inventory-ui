import type { ProductionJob } from './types';

export type JobReadiness = { state: 'ready' | 'needs_planning' | 'not_scheduled'; label: string; guidance: string; missing: string[] };

export function getJobReadiness(job: ProductionJob): JobReadiness {
  const missingDates = !job.planned_start || !job.planned_end;
  const missing: string[] = [];
  if (!job.job_number) missing.push('job number');
  if (!job.requested_delivery_date) missing.push('requested delivery');
  if (job.estimated_man_hours === null) missing.push('labor estimate');
  if (!job.customer) missing.push('customer');
  if (missingDates) return { state: 'not_scheduled', label: 'Not Scheduled', guidance: 'Add planned start and finish dates so this job appears on the Timeline.', missing: ['planned dates', ...missing] };
  if (missing.length) return { state: 'needs_planning', label: 'Planning Needed', guidance: `${missing[0][0].toUpperCase()}${missing[0].slice(1)} missing — complete setup for a clearer production plan.`, missing };
  return { state: 'ready', label: 'Planning Complete', guidance: 'Required planning details are complete. Material readiness and production status are tracked separately.', missing: [] };
}
