import type { ProductionJob } from './types';

export type PlanningIssueField = 'job_number' | 'customer' | 'requested_delivery_date' | 'estimated_man_hours' | 'planned_start' | 'planned_end';

export const schedulingIssueFields: PlanningIssueField[] = ['planned_start', 'planned_end'];

export const planningIssueLabels: Record<PlanningIssueField, string> = {
  job_number: 'Job number',
  customer: 'Customer',
  requested_delivery_date: 'Requested delivery',
  estimated_man_hours: 'Labor estimate',
  planned_start: 'Planned start',
  planned_end: 'Planned finish',
};

export type JobReadiness = {
  state: 'ready' | 'needs_planning' | 'not_scheduled';
  label: string;
  guidance: string;
  missing: string[];
  missingFields: PlanningIssueField[];
};

export function getJobPlanningIssues(job: ProductionJob): PlanningIssueField[] {
  const missing: PlanningIssueField[] = [];
  if (!job.job_number?.trim()) missing.push('job_number');
  if (!job.customer?.trim()) missing.push('customer');
  if (!job.requested_delivery_date) missing.push('requested_delivery_date');
  if (job.estimated_man_hours === null) missing.push('estimated_man_hours');
  if (!job.planned_start) missing.push('planned_start');
  if (!job.planned_end) missing.push('planned_end');
  return missing;
}

export function getJobSchedulingIssues(job: ProductionJob): PlanningIssueField[] {
  return getJobPlanningIssues(job).filter((field) => schedulingIssueFields.includes(field));
}

export function getJobNonblockingPlanningIssues(job: ProductionJob): PlanningIssueField[] {
  return getJobPlanningIssues(job).filter((field) => !schedulingIssueFields.includes(field));
}

export function schedulingAttentionLabel(count: number): string {
  return `${count} ${count === 1 ? 'job needs scheduling' : 'jobs need scheduling'}`;
}

export function getJobReadiness(job: ProductionJob): JobReadiness {
  const missingFields = getJobPlanningIssues(job);
  const missing = missingFields.map((field) => planningIssueLabels[field].toLowerCase());
  const missingDates = missingFields.includes('planned_start') || missingFields.includes('planned_end');
  if (missingDates) return { state: 'not_scheduled', label: 'Needs Dates', guidance: 'Add planned start and finish dates so this job appears on the Timeline.', missing, missingFields };
  if (missing.length) return { state: 'needs_planning', label: 'Planning Needed', guidance: `${planningIssueLabels[missingFields[0]]} missing — complete setup for a clearer production plan.`, missing, missingFields };
  return { state: 'ready', label: 'Planning Complete', guidance: 'Required planning details are complete. Material readiness and production status are tracked separately.', missing: [], missingFields: [] };
}
