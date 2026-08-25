import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  arrangeProductionJobs,
  normalizeProductionArrangement,
  persistedProductionArrangement,
} from '../src/modules/production/arrangement';
import type { ProductionJob } from '../src/modules/production/types';

const workspace = readFileSync(new URL('../src/modules/production/ProductionWorkspace.tsx', import.meta.url), 'utf8');
const job = (values: Partial<ProductionJob> & Pick<ProductionJob, 'id' | 'name' | 'production_status'>) => ({
  job_number: null,
  requested_delivery_date: null,
  planned_start: null,
  created_at: null,
  ...values,
} as ProductionJob);

const unchangedModes = [
  job({ id: 'hold', name: 'Hold', production_status: 'on_hold', requested_delivery_date: '2026-07-22' }),
  job({ id: 'prod', name: 'Production', production_status: 'in_production', requested_delivery_date: '2026-07-20' }),
  job({ id: 'ship', name: 'Shipped', production_status: 'shipped' }),
  job({ id: 'done', name: 'Complete', production_status: 'complete', requested_delivery_date: '2026-08-01' }),
];
assert.deepEqual(arrangeProductionJobs(unchangedModes, 'stage').map(({ id }) => id), ['prod', 'hold', 'done', 'ship']);
assert.deepEqual(arrangeProductionJobs(unchangedModes, 'deadline', '2026-07-21').map(({ id }) => id), ['prod', 'hold', 'done', 'ship']);

const recentJobs = [
  job({ id: 'older', name: 'Older', production_status: 'not_started', created_at: '2026-07-01T10:00:00Z' }),
  job({ id: 'newer', name: 'Newer', production_status: 'not_started', created_at: '2026-07-03T10:00:00Z' }),
  job({ id: 'tie-b', name: 'Tie B', production_status: 'not_started', created_at: '2026-07-02T10:00:00Z' }),
  job({ id: 'tie-a', name: 'Tie A', production_status: 'not_started', created_at: '2026-07-02T10:00:00Z' }),
  job({ id: 'missing', name: 'Missing', production_status: 'not_started', created_at: null as unknown as string }),
];
assert.deepEqual(arrangeProductionJobs(recentJobs, 'recent').map(({ id }) => id), ['newer', 'tie-a', 'tie-b', 'older', 'missing']);
assert.deepEqual(arrangeProductionJobs(recentJobs.filter(({ id }) => id !== 'tie-a'), 'recent').map(({ id }) => id), ['newer', 'tie-b', 'older', 'missing']);

assert.equal(normalizeProductionArrangement('labor'), 'recent');
assert.equal(normalizeProductionArrangement('recent'), 'recent');
assert.equal(normalizeProductionArrangement('invalid'), 'stage');
assert.equal(persistedProductionArrangement('recent'), 'labor');
assert.equal(persistedProductionArrangement('stage'), 'stage');
assert.equal(persistedProductionArrangement('deadline'), 'deadline');
assert.match(workspace, /\['stage','recent','deadline'\]/);
assert.match(workspace, /recent: 'Recently Added'/);
assert.match(workspace, /recent: 'Añadido recientemente'/);
assert.doesNotMatch(workspace, /Mano de obra|>Labor</);
assert.match(workspace, /arrangeProductionJobs\(filteredJobs\.map/);

console.log('Production Overview arrangement checks passed.');
