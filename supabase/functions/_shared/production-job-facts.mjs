// Shared existing Production definitions. Keep operational meaning independent
// of the app, inference provider and database transport.
export const ACTIVE_PRODUCTION_STATUSES = ['not_started', 'on_deck', 'in_production', 'on_hold'];
export const TERMINAL_PRODUCTION_STATUSES = ['shipped', 'complete', 'cancelled'];
export const PRODUCTION_REWORK_TERMINAL_STATUSES = ['complete', 'cancelled'];
export const ADMIN_ONLY_PRODUCTION_FIXTURE_ID = 'cba79566-3fde-4910-9cf6-45687db70b01';
export function isActiveProductionRework(cycle) {
  return !PRODUCTION_REWORK_TERMINAL_STATUSES.includes(cycle.production_status);
}
export function applyProductionLifecycle(job, cycle) {
  if (!cycle) return { ...job, lifecycle_key: `original:${job.id}`, rework_cycle: null };
  return {
    ...job, lifecycle_key: `rework:${cycle.id}`, rework_cycle: cycle,
    original_production_status: job.production_status,
    original_planned_start: job.planned_start, original_planned_end: job.planned_end,
    original_updated_at: job.updated_at,
    production_status: cycle.production_status, planned_start: cycle.planned_start,
    planned_end: cycle.planned_end, updated_at: cycle.updated_at,
  };
}
export const schedulingIssueFields = ['planned_start', 'planned_end'];
export const planningIssueLabels = {
  job_number: 'Job number', customer: 'Customer', requested_delivery_date: 'Requested delivery',
  estimated_man_hours: 'Labor estimate', planned_start: 'Planned start', planned_end: 'Planned finish',
};
export function getJobPlanningIssues(job) {
  const missing = [];
  if (!job.job_number?.trim()) missing.push('job_number');
  if (!job.customer?.trim()) missing.push('customer');
  if (!job.requested_delivery_date) missing.push('requested_delivery_date');
  if (job.estimated_man_hours === null) missing.push('estimated_man_hours');
  if (!job.planned_start) missing.push('planned_start');
  if (!job.planned_end) missing.push('planned_end');
  return missing;
}
export function getJobSchedulingIssues(job) {
  return getJobPlanningIssues(job).filter(field => schedulingIssueFields.includes(field));
}
export function getJobNonblockingPlanningIssues(job) {
  return getJobPlanningIssues(job).filter(field => !schedulingIssueFields.includes(field));
}
export function schedulingAttentionLabel(count) {
  return `${count} ${count === 1 ? 'job needs scheduling' : 'jobs need scheduling'}`;
}
export function getJobReadiness(job) {
  const missingFields = getJobPlanningIssues(job);
  const missing = missingFields.map(field => planningIssueLabels[field].toLowerCase());
  const missingDates = missingFields.includes('planned_start') || missingFields.includes('planned_end');
  if (missingDates) return { state: 'not_scheduled', label: 'Needs Dates', guidance: 'Add planned start and finish dates so this job appears on the Timeline.', missing, missingFields };
  if (missing.length) return { state: 'needs_planning', label: 'Planning Needed', guidance: `${planningIssueLabels[missingFields[0]]} missing — complete setup for a clearer production plan.`, missing, missingFields };
  return { state: 'ready', label: 'Planning Complete', guidance: 'Required planning details are complete. Material readiness and production status are tracked separately.', missing: [], missingFields: [] };
}
