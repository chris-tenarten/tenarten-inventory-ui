import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [inspector, workspace, jobs] = await Promise.all([
  readFile(new URL('../src/modules/production/components/ProductionJobInspector.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/production/ProductionWorkspace.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/production/jobs.ts', import.meta.url), 'utf8'),
]);

const ordinaryFields = [
  'name',
  'customer',
  'job_number',
  'estimate_number',
  'work_order_number',
  'contract_value',
  'deposit_date',
  'requested_delivery_date',
  'estimated_man_hours',
  'estimated_calendar_days',
  'color_plate_number',
  'sample_submitted_date',
  'approval_date',
  'production_status',
  'material_status',
  'remarks',
];

const normalizedDraft = inspector.match(/const normalizedDraft: ProductionJobUpdate = \{([\s\S]*?)\n  \};/)?.[1] ?? '';
assert.ok(normalizedDraft, 'Inspector ordinary update model must be discoverable.');
for (const field of ordinaryFields) {
  assert.match(normalizedDraft, new RegExp(`\\b${field}:`), `${field} must participate in Inspector ordinary saves.`);
}
assert.doesNotMatch(normalizedDraft, /planned_start|planned_end/, 'Planned dates must remain outside ordinary Inspector saves.');

assert.match(inspector, /Object\.entries\(normalizedDraft\)\.filter/);
assert.match(inspector, /productionValuesEqual/);
assert.match(inspector, /await onUpdateJob\(job\.id, changedDraft\)/);
assert.match(inspector, /setDraft\(inspectorDraftFromJob\(updated\)\)/);
assert.match(inspector, /setDraft\(inspectorDraftFromJob\(job\)\)/);
assert.match(inspector, /Project name is required\./);
assert.match(
  inspector,
  /Enter a valid non-negative contract value and labor hours, plus whole calendar days/,
);
assert.match(inspector, /Save failed/);
assert.match(inspector, /Retry save/);
assert.match(inspector, /onOrdinarySaveStateChange\(\{ jobId: job\.id, dirty: dirtyCount > 0, saving \}\)/);
assert.match(inspector, /onChange=\{\(event\) => schedule\("start", event\.target\.value\)\}/);
assert.match(inspector, /onChange=\{\(event\) => schedule\("end", event\.target\.value\)\}/);
assert.match(inspector, /Save job details first\. Planned dates will remain staged\./);
assert.match(inspector, /Planned dates remain staged for Save All\./);
assert.match(inspector, /aria-label="Edit project name"/);
assert.match(inspector, /headerNameEditing/);
assert.match(inspector, /headerProjectNameRef\.current\?\.select\(\)/);
assert.match(inspector, /headerNameSessionStartRef\.current = draft\.name/);
assert.match(inspector, /updateDraft\("name", headerNameSessionStartRef\.current\)/);
assert.match(inspector, /event\.key === "Enter"/);
assert.match(inspector, /event\.key === "Escape"/);
assert.match(inspector, /value=\{draft\.name\}/);
assert.match(inspector, /type="number"[\s\S]*?value=\{draft\.contract_value\}/);
assert.match(inspector, /Resin \/ Chip PO/);

assert.match(workspace, /const updated = await updateProductionJob\(original, changes\)/);
assert.match(workspace, /job\.id === jobId \? updated : job/);
assert.match(workspace, /rebaseStagedScheduleVersion\(current, updated\)/);
assert.match(workspace, /for \(const key of Object\.keys\(changes\)/);
assert.match(jobs, /Object\.entries\(changes\)\.filter/);
assert.match(jobs, /\.update\(effectiveChanges\)/);
assert.match(jobs, /\.select\(JOB_COLUMNS\)/);
assert.match(jobs, /\| 'contract_value'/);

console.log('Production Inspector editing checks passed.');
