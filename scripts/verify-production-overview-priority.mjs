import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prioritizeProductionOverviewJobs } from '../src/modules/production/arrangement.ts';

const queue = readFileSync(new URL('../src/modules/production/components/ProductionQueue.tsx', import.meta.url), 'utf8');
const table = readFileSync(new URL('../src/modules/production/components/ProductionTable.tsx', import.meta.url), 'utf8');
const gantt = readFileSync(new URL('../src/modules/production/components/ProductionGantt.tsx', import.meta.url), 'utf8');
const base = { job_number: null, requested_delivery_date: null, estimated_man_hours: null };
const jobs = [
  { ...base, id: 'C', name: 'Normal', production_status: 'not_started', planned_start: '2026-08-01', planned_end: '2026-08-02' },
  { ...base, id: 'A', name: 'Unscheduled', production_status: 'not_started', planned_start: null, planned_end: null },
  { ...base, id: 'E', name: 'Resolved history', production_status: 'not_started', planned_start: '2026-08-03', planned_end: '2026-08-04' },
  { ...base, id: 'D', name: 'Both', production_status: 'not_started', planned_start: null, planned_end: null },
  { ...base, id: 'B', name: 'Update attention', production_status: 'not_started', planned_start: '2026-08-05', planned_end: '2026-08-06' },
];
const attention = { B: { openFollowUpCount: 1 }, D: { openFollowUpCount: 1 }, E: { openFollowUpCount: 0 } };

assert.deepEqual(prioritizeProductionOverviewJobs(jobs, attention).map((job) => job.id), ['A', 'D', 'B', 'C', 'E']);
assert.deepEqual(prioritizeProductionOverviewJobs(jobs, { ...attention, B: { openFollowUpCount: 0 } }).map((job) => job.id), ['A', 'D', 'C', 'E', 'B']);
assert.deepEqual(prioritizeProductionOverviewJobs(jobs.map((job) => job.id === 'D' ? { ...job, planned_start: '2026-08-07', planned_end: '2026-08-08' } : job), attention).map((job) => job.id), ['A', 'D', 'B', 'C', 'E']);
assert.deepEqual(prioritizeProductionOverviewJobs(jobs, { ...attention, D: { openFollowUpCount: 0 } }).map((job) => job.id), ['A', 'D', 'B', 'C', 'E']);

assert.match(queue, /prioritizeProductionOverviewJobs\(jobs, jobUpdateSummaries\)/);
assert.match(queue, /data-overview-needs-dates-marker/);
assert.match(queue, /onClick=\{\(\) => onScheduleJob\(job\)\}/);
assert.match(queue, /data-overview-update-attention-marker/);
assert.match(queue, /onClick=\{\(\) => onSelectJob\(job, 'job-updates'\)\}/);
assert.match(queue, /flex-col items-center justify-center gap-1/);
assert.doesNotMatch(table, /prioritizeProductionOverviewJobs/);
assert.doesNotMatch(gantt, /prioritizeProductionOverviewJobs/);
console.log('Production Overview priority checks passed.');
