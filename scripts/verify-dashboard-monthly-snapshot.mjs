import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { last30Days } from '../src/modules/production/snapshot-period.ts';

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

console.log('Dashboard Monthly Snapshot checks passed.');
