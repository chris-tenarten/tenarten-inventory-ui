import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { arrangeProductionJobs } from '../src/modules/production/arrangement.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const workspace = read('src/modules/production/ProductionWorkspace.tsx');
const jobsSource = read('src/modules/production/jobs.ts');
const queue = read('src/modules/production/components/ProductionQueue.tsx');
const inspector = read('src/modules/production/components/ProductionJobInspector.tsx');
const manpower = read('src/modules/manpower/ManpowerWorkspace.tsx');
const materials = read('src/modules/material-usage/MaterialUsageHistory.tsx');
const materialWorkspace = read('src/modules/material-usage/MaterialUsageWorkspace.tsx');
const materialEditor = read('src/modules/material-usage/MaterialUsageEditor.tsx');
const inventory = read('src/app/inventory/page.tsx');
const jobOptions = read('src/modules/production/job-options.ts');

const base = { id: '', name: '', job_number: null, requested_delivery_date: null, planned_start: null, estimated_man_hours: null };
const jobs = [
  { ...base, id: 'hold', name: 'Hold', production_status: 'on_hold', requested_delivery_date: '2026-07-22', estimated_man_hours: 20 },
  { ...base, id: 'prod', name: 'Production', production_status: 'in_production', requested_delivery_date: '2026-07-20', estimated_man_hours: 10 },
  { ...base, id: 'ship', name: 'Shipped', production_status: 'shipped', requested_delivery_date: null, estimated_man_hours: 30 },
  { ...base, id: 'done', name: 'Complete', production_status: 'complete', requested_delivery_date: '2026-08-01', estimated_man_hours: null },
];
assert.deepEqual(arrangeProductionJobs(jobs, 'stage').map((job) => job.id), ['prod','hold','done','ship']);
assert.deepEqual(arrangeProductionJobs(jobs, 'deadline', '2026-07-21').map((job) => job.id), ['prod','hold','done','ship']);
assert.deepEqual(arrangeProductionJobs(jobs, 'labor').map((job) => job.id), ['ship','hold','prod','done']);
assert.match(workspace, /PRODUCTION_ARRANGEMENT_KEY/);
assert.match(jobsSource, /from\('manpower_entries'\)/);
assert.match(jobsSource, /from\('material_usage_reports'\)/);
assert.match(jobsSource, /archived_at: archivedAt/);
assert.match(jobsSource, /restoreProductionJob/);
assert.match(jobsSource, /job_restored/);
assert.match(queue, /manpower-reporting\?job=/);
assert.match(queue, /material-usage\?historyJob=/);
assert.match(queue, /openReportJob=/);
assert.match(queue, /material-usage\?newJob=/);
assert.match(queue, /No Material Use Linked/);
assert.doesNotMatch(queue, /Reported Today|Not Reported Today/);
assert.match(queue, /laborEntryCount > 0/);
assert.match(queue, /No Labor Reports/);
assert.match(queue, /No Labor Estimate/);
assert.match(queue, /job\.estimated_man_hours !== null \? <span/);
assert.match(queue, /maximumFractionDigits: 1/);
assert.match(queue, /cursor-pointer/);
assert.match(queue, /focus-visible:ring-2/);
assert.doesNotMatch(queue, /materialStatusBadgeClass/);
assert.match(inspector, /Only Complete|\['complete', 'shipped', 'cancelled'\]/);
assert.match(inspector, /Restore job/);
assert.match(inspector, /Archive Job/);
assert.match(manpower, /entry\.job_id !== linkedJobId/);
assert.match(manpower, /sortedGroups\.filter\(\(group\) => group\.entries\.length > 0\)/);
assert.match(manpower, /No manpower reporting groups are linked to this Production job/);
assert.match(manpower, /linkReportingGroup/);
assert.match(manpower, /applyGroupIdentity/);
assert.match(manpower, /job_id: jobId, unlisted_work_label: null/);
assert.match(manpower, /job_id: null, unlisted_work_label: previousJobName/);
assert.match(manpower, /groupJob \? <JobTag label=\{jobLabel\(groupJob\)\}/);
assert.match(manpower, /contributes to the Current Hours/);
assert.match(manpower, />Job<\/th>/);
assert.match(manpower, /openProductionJob\(groupJob\.id\)/);
assert.match(manpower, /popstate/);
assert.match(materials, /productionStatusVisuals/);
assert.match(materials, />Archived</);
assert.match(materials, />Unlinked</);
assert.doesNotMatch(materials, /All Jobs/);
assert.doesNotMatch(materials, /reportedToday|notReportedToday/);
assert.doesNotMatch(materials, /dateFrom|dateTo/);
assert.match(materials, /popstate/);
assert.match(materialWorkspace, /params\.get\("newJob"\)/);
assert.match(materialWorkspace, /params\.get\("openReportJob"\)/);
assert.match(materialWorkspace, /reports\.find\(\(report\) => report\.jobId === jobId\)/);
assert.doesNotMatch(materialWorkspace, /params\.get\("historyJob"\)/);
assert.match(materialEditor, /ProductionStatusBadge/);
assert.match(materialEditor, /setJobSearch\(currentJobDisplay\)/);
assert.match(manpower, /jobOptionLabel/);
assert.match(inventory, /formatProductionJobOptionWithStatus/);
assert.match(jobOptions, /formatProductionJobOptionWithStatus/);
assert.doesNotMatch(jobOptions, /not\('production_status'/);
console.log('Production Pipeline integration checks passed.');
