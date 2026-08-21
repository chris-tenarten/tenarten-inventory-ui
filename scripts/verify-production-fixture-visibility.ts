import assert from 'node:assert/strict';
import {
  ADMIN_ONLY_PRODUCTION_FIXTURE_ID,
  productionJobsVisibleToRole,
} from '../src/modules/production/fixture-visibility';
import type { AppRole } from '../src/lib/rbac';
import type { ProductionJob } from '../src/modules/production/types';

const fixture = { id: ADMIN_ONLY_PRODUCTION_FIXTURE_ID, name: 'chris-dev-test' } as ProductionJob;
const ordinary = { id: '00000000-0000-4000-8000-000000000001', name: 'Ordinary Job' } as ProductionJob;
const jobs = [fixture, ordinary];

assert.deepEqual(productionJobsVisibleToRole(jobs, 'admin').map((job) => job.id), [fixture.id, ordinary.id]);
for (const role of ['lead', 'member', 'guest', 'developer'] satisfies AppRole[]) {
  assert.deepEqual(
    productionJobsVisibleToRole(jobs, role).map((job) => job.id),
    [ordinary.id],
    `${role} must not receive the controlled fixture at the Production presentation boundary`,
  );
}
assert.deepEqual(productionJobsVisibleToRole(jobs, null).map((job) => job.id), [ordinary.id]);

console.log('Production Admin-only fixture visibility checks passed.');
