import assert from 'node:assert/strict';
import {
  formatProductionJobSelectorLabel,
  getProductionJobReferenceLabel,
} from '../src/modules/production/job-reference.ts';

assert.equal(
  getProductionJobReferenceLabel({ name: '  Central Library  ', job_number: 'J-101' }),
  'Central Library',
  'A linked reference should prefer the Job name.',
);
assert.equal(
  getProductionJobReferenceLabel({ name: '   ', job_number: ' J-101 ' }),
  'J-101',
  'A linked reference should fall back to the Job number.',
);
assert.equal(
  getProductionJobReferenceLabel({ name: null, job_number: null }),
  'Production Job',
  'A linked reference should have a safe missing-data fallback.',
);
assert.equal(
  formatProductionJobSelectorLabel({ name: 'Central Library', job_number: 'J-101' }),
  'J-101 — Central Library',
  'Selector labels should retain both recognizable identifiers.',
);
assert.equal(
  formatProductionJobSelectorLabel({ name: 'Central Library', job_number: null }),
  'Central Library',
  'Selector labels should support Jobs without a Job number.',
);

console.log('Production Job reference checks passed.');
