import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { getJobNonblockingPlanningIssues, getJobPlanningIssues, getJobReadiness, getJobSchedulingIssues, schedulingAttentionLabel } from '../src/modules/production/readiness.ts';

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
assert.deepEqual(getJobSchedulingIssues(missingDetails), []);
assert.deepEqual(getJobNonblockingPlanningIssues(missingDetails), ['job_number', 'customer', 'requested_delivery_date', 'estimated_man_hours']);

const missingSchedule = { ...completeJob, planned_start: null, planned_end: null };
assert.deepEqual(getJobPlanningIssues(missingSchedule), ['planned_start', 'planned_end']);
assert.equal(getJobReadiness(missingSchedule).state, 'not_scheduled');
assert.deepEqual(getJobSchedulingIssues(missingSchedule), ['planned_start', 'planned_end']);
assert.deepEqual(getJobNonblockingPlanningIssues(missingSchedule), []);

const stagedScheduleView = { ...missingSchedule, planned_start: '2026-07-20', planned_end: '2026-07-24' };
assert.equal(getJobReadiness(stagedScheduleView).state, 'ready', 'Shared readiness must recognize proposed dates when callers supply the staged view.');

assert.equal(schedulingAttentionLabel(1), '1 job needs scheduling');
assert.equal(schedulingAttentionLabel(3), '3 jobs need scheduling');

const [workspace, panel, gantt, badge, inspector, table, queue, statusBadge, productionTag] = await Promise.all([
  readFile(new URL('../src/modules/production/ProductionWorkspace.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/production/components/PlanningIssuesPanel.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/production/components/ProductionGantt.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/production/components/UnscheduledBadge.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/production/components/ProductionJobInspector.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/production/components/ProductionTable.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/production/components/ProductionQueue.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/production/components/ProductionStatusBadge.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/production/components/production-tag.ts', import.meta.url), 'utf8'),
]);
assert.match(workspace, /schedulingAttentionJobs\.length > 0 &&/);
assert.match(workspace, /const jobsInQueue = activeReadinessJobs\.length/);
assert.match(workspace, /const scheduledCount = activeReadinessJobs\.filter\(isScheduled\)\.length/);
assert.match(workspace, /tr\('Scheduled', 'Programados'\)/);
assert.match(workspace, /activeView === 'queue'[\s\S]*activeView === 'spreadsheet'[\s\S]*<ProductionGantt/);
assert.match(workspace, /data-nonblocking-issue-count/);
assert.match(workspace, /data-nonblocking-issue-badge/);
assert.match(workspace, /bg-red-600/);
assert.match(workspace, /setPlanningIssuesCategory\('scheduling'\)/);
assert.match(workspace, /setPlanningIssuesCategory\('nonblocking'\)/);
assert.match(workspace, /selectJob\(schedulingAttentionJobs\[0\], 'planned-dates'\)/);
assert.doesNotMatch(workspace, /openJobScheduling\(schedulingAttentionJobs\[0\]\)/);
assert.match(workspace, /openJobScheduling\(canonicalJob\)/);
assert.match(panel, /category === 'scheduling' \? getJobSchedulingIssues\(effective\) : getJobNonblockingPlanningIssues\(effective\)/);
assert.match(panel, /onClose\(\); onOpenInspector\(job, focus\)/);
assert.doesNotMatch(gantt, /data-needs-scheduling/);
assert.doesNotMatch(gantt, /Needs Scheduling <span/);
assert.match(badge, /Needs dates/);
assert.match(inspector, /data-field="requested-delivery"/);
assert.match(inspector, /data-inspector-save-region/);
assert.match(inspector, /Save failed/);
assert.match(inspector, /Changes saved/);
assert.match(table, /onBlur=\{blur/);
assert.match(table, /Changes saved/);
assert.match(table, /state === 'error' \? 'alert' : 'status'/);
assert.match(table, /data-table-needs-dates/);
assert.match(badge, /title="Needs planned dates"/);
assert.doesNotMatch(table, /<UnscheduledBadge compact/);
assert.match(queue, /data-overview-schedule-condition/);
assert.match(queue, /<UnscheduledBadge ariaLabel/);
assert.doesNotMatch(queue, /<UnscheduledBadge compact/);
assert.match(queue, /prioritizeProductionOverviewJobs\(jobs, jobUpdateSummaries\)/);
assert.match(badge, /whitespace-nowrap/);
assert.match(statusBadge, /productionTagClassName/);
assert.match(badge, /productionTagClassName/);
assert.match(productionTag, /rounded-sm border px-2 py-0\.5 !text-\[10px\] !font-bold !leading-\[1\.5\] shadow-sm/);
assert.match(queue, /data-overview-needs-dates=\{needsScheduling\(job\) \? 'true' : undefined\}/);
assert.match(queue, /needsScheduling\(job\) \? 'bg-amber-50\/50 hover:bg-amber-50\/70'/);

console.log('Production planning issue readiness checks passed.');
