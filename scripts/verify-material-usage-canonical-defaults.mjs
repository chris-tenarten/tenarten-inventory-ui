import assert from 'node:assert/strict';
import {
  applyCanonicalJobSelection,
  applySharedChipBlendColorPlate,
  getSharedChipBlendColorPlate,
  resolveColorPlateDecision,
} from '../src/modules/material-usage/canonical-job-defaults.ts';

const job = {
  id: 'job-2',
  name: 'Central Library',
  job_number: '26-0206',
  customer: 'City',
  work_order_number: 'WO-441',
  color_plate_number: 'CP-12A',
  production_status: 'in_production',
  archived_at: null,
  planned_start: '2026-07-21',
};

const report = {
  id: 'report-1',
  jobId: 'job-1',
  unlistedJobName: '',
  jobNumberSnapshot: '25-0999',
  jobNameSnapshot: 'Prior Job',
  reportDate: '2026-07-21',
  workOrder: 'OLD-WO',
  terrazzoType: 'Epoxy',
  notes: '',
  lines: [
    { materialType: 'Resin', manufacturer: '', materialName: '', quantity: null, unit: '', plate: 'INVALID', notes: '' },
    { materialType: 'Chip Blend', manufacturer: '', materialName: 'Chip Blend A', quantity: null, unit: '', plate: 'MU-PLATE', notes: '' },
    { materialType: 'Chip Blend', manufacturer: '', materialName: 'Chip Blend B', quantity: null, unit: '', plate: '', notes: '' },
  ],
};

assert.equal(resolveColorPlateDecision('', ' CP-12A '), 'use_production');
assert.equal(resolveColorPlateDecision('MU-PLATE', ''), 'keep_report');
assert.equal(resolveColorPlateDecision(' cp-12a ', 'CP-12A'), 'keep_report');
assert.equal(resolveColorPlateDecision('MU-PLATE', 'CP-12A'), 'conflict');

const unchangedReport = structuredClone(report);
assert.equal(
  resolveColorPlateDecision(
    getSharedChipBlendColorPlate(report.lines),
    job.color_plate_number,
  ),
  'conflict',
);
assert.deepEqual(report, unchangedReport, 'Evaluating or canceling a conflict must not mutate the current report.');

const reassigned = applyCanonicalJobSelection(report, job, job.color_plate_number);
assert.equal(reassigned.jobId, 'job-2');
assert.equal(reassigned.jobNumberSnapshot, '26-0206');
assert.equal(reassigned.workOrder, 'WO-441');
assert.equal(reassigned.lines[0].plate, '', 'Non-Chip Blend plate values must be cleared.');
assert.deepEqual(
  reassigned.lines.slice(1).map((line) => line.plate),
  ['CP-12A', 'CP-12A'],
  'Every Chip Blend line must share the selected Color Plate #.',
);

const editedLines = applySharedChipBlendColorPlate(reassigned.lines, 'Custom Plate');
assert.deepEqual(editedLines.slice(1).map((line) => line.plate), ['Custom Plate', 'Custom Plate']);

console.log('Material Usage Canonical Job Defaults checks passed.');
