import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { last30Days } from '../src/modules/production/snapshot-period.ts';
import { summarizeLaborLifecycles } from '../src/modules/production/labor-lifecycle.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const workspace = read('src/modules/production/ProductionWorkspace.tsx');
const snapshot = read('src/modules/production/components/MonthlySnapshot.tsx');
const data = read('src/modules/production/snapshot.ts');
const types = read('src/modules/production/types.ts');

assert.deepEqual(last30Days(new Date(2026, 6, 21, 16)), { key: 'last_30_days', start: '2026-06-22', end: '2026-07-21' });
assert.deepEqual(last30Days(new Date(2026, 0, 1, 8)), { key: 'last_30_days', start: '2025-12-03', end: '2026-01-01' });
assert.match(workspace, /DashboardMode = 'pipeline' \| 'snapshot'/);
assert.match(workspace, /get\('view'\) === 'snapshot'/);
assert.match(workspace, /addEventListener\('popstate'/);
assert.match(workspace, /dashboardMode === 'snapshot' \? <MonthlySnapshot/);
assert.match(data, /gte\('work_date', period\.start\)\.lte\('work_date', period\.end\)/);
assert.match(data, /gte\('report_date', period\.start\)\.lte\('report_date', period\.end\)/);
assert.match(data, /from\('inventory_transactions'\).*gte\('created_at'/s);
assert.match(data, /statusTransition/);
assert.doesNotMatch(data, /jobs\.filter\([^\n]*production_status[^\n]*transition/i);
assert.match(snapshot, /terminalStatuses = new Set\(\['shipped', 'complete', 'cancelled'\]\)/);
assert.match(snapshot, /archiveProductionJob\(job\)/);
assert.doesNotMatch(types, /['"]archived['"]/i);
assert.match(snapshot, /No terminal jobs are currently ready to archive/);
assert.match(snapshot, /grid-cols-2.*sm:grid-cols-3.*xl:grid-cols-6/);
assert.match(data, /rework_cycle_id,work_date,am_hours,pm_hours/);
assert.match(snapshot, /Original Production \/ Legacy Unclassified/);
assert.match(snapshot, /REWORK #\{rework\.sequenceNumber/);

const lifecycle = summarizeLaborLifecycles([
  { job_id: 'job-a', rework_cycle_id: null, am_hours: 4, pm_hours: 2 },
  { job_id: 'job-a', rework_cycle_id: 'rw-1', am_hours: 3, pm_hours: 1, rework_cycle: { id: 'rw-1', sequence_number: 1 } },
  { job_id: 'job-a', rework_cycle_id: 'rw-2', am_hours: 2, pm_hours: 0, rework_cycle: { id: 'rw-2', sequence_number: 2 } },
  { job_id: 'job-b', rework_cycle_id: null, am_hours: 5, pm_hours: 0 },
]).get('job-a');
assert.ok(lifecycle);
assert.equal(lifecycle.totalHours, 12, 'Whole-Job total includes original/unclassified and every Rework exactly once');
assert.equal(lifecycle.originalOrUnclassifiedHours, 6);
assert.deepEqual(lifecycle.reworks.map((item) => [item.reworkCycleId, item.sequenceNumber, item.hours]), [
  ['rw-1', 1, 4],
  ['rw-2', 2, 2],
]);
assert.equal(lifecycle.originalOrUnclassifiedHours + lifecycle.reworks.reduce((sum, item) => sum + item.hours, 0), lifecycle.totalHours);

console.log('Dashboard Monthly Snapshot checks passed.');
