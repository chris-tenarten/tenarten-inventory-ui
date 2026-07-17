import assert from 'node:assert/strict';

import { getJobPlanningIssues, getJobReadiness } from '../src/modules/production/readiness.ts';

const completeJob = {
  id: 'job-1', name: 'Test project', customer: 'Customer', job_number: '26-0001',
  estimate_number: null, work_order_number: null, contract_value: null, deposit_date: null,
  color_plate_number: null, sample_submitted_date: null, approval_date: null, resin_po: null,
  chip_po: null, estimated_man_hours: 40, estimated_calendar_days: null,
  requested_delivery_date: '2026-08-01', planned_start: '2026-07-20', planned_end: '2026-07-24',
  production_status: 'not_started', material_status: 'unknown', priority: 'normal', progress_percent: 0,
  owner_name: null, remarks: null, archived_at: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z',
};

assert.deepEqual(getJobPlanningIssues(completeJob), [], 'Complete planning fields must have no issues.');
assert.equal(getJobReadiness(completeJob).state, 'ready');

const missingDetails = { ...completeJob, job_number: ' ', customer: null, requested_delivery_date: null, estimated_man_hours: null };
assert.deepEqual(getJobPlanningIssues(missingDetails), ['job_number', 'customer', 'requested_delivery_date', 'estimated_man_hours']);
assert.equal(getJobReadiness(missingDetails).state, 'needs_planning');

const missingSchedule = { ...completeJob, planned_start: null, planned_end: null };
assert.deepEqual(getJobPlanningIssues(missingSchedule), ['planned_start', 'planned_end']);
assert.equal(getJobReadiness(missingSchedule).state, 'not_scheduled');

const stagedScheduleView = { ...missingSchedule, planned_start: '2026-07-20', planned_end: '2026-07-24' };
assert.equal(getJobReadiness(stagedScheduleView).state, 'ready', 'Shared readiness must recognize proposed dates when callers supply the staged view.');

console.log('Production planning issue readiness checks passed.');
