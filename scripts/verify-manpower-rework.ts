import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildManpowerWorkTargetOptions,
  manpowerEntryTargetValue,
  manpowerIdentityForTarget,
} from '../src/modules/manpower/work-target';
import { isActiveProductionRework } from '../src/modules/production/rework';
import type { ManpowerEntry, ManpowerJob, ManpowerReworkCycle } from '../src/modules/manpower/types';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20260824_002_manpower_rework_attribution.sql');
const persistence = read('src/modules/manpower/manpower.ts');
const workspace = read('src/modules/manpower/ManpowerWorkspace.tsx');
const productionJobs = read('src/modules/production/jobs.ts');

assert.match(migration, /add column rework_cycle_id uuid/);
assert.match(migration, /unique \(id, job_id\)/);
assert.match(migration, /check \(rework_cycle_id is null or job_id is not null\)/);
assert.match(migration, /foreign key \(rework_cycle_id, job_id\)[\s\S]*references public\.production_rework_cycles\(id, job_id\)[\s\S]*on delete restrict/);
assert.match(migration, /where rework_cycle_id is not null/);
assert.doesNotMatch(migration, /update public\.manpower_entries/);
assert.match(persistence, /rework_cycle:production_rework_cycles!manpower_entries_rework_matches_job_fkey/);
assert.match(persistence, /isActiveProductionRework\(cycle\)/);
assert.match(productionJobs, /isActiveProductionRework\(cycle\)/);
assert.match(workspace, /Change \$\{groupEntries\.length\} manpower entries to \$\{destination\}/);
assert.match(workspace, /Mixed lifecycle targets/);

const active: ManpowerReworkCycle = { id: 'rw-active', job_id: 'job-a', sequence_number: 1, production_status: 'in_production' };
const complete: ManpowerReworkCycle = { id: 'rw-complete', job_id: 'job-a', sequence_number: 2, production_status: 'complete' };
const cancelled: ManpowerReworkCycle = { id: 'rw-cancelled', job_id: 'job-a', sequence_number: 3, production_status: 'cancelled' };
assert.equal(isActiveProductionRework(active), true);
assert.equal(isActiveProductionRework(complete), false);
assert.equal(isActiveProductionRework(cancelled), false);

const job: ManpowerJob = {
  id: 'job-a', name: 'Bank of America', job_number: '25-1218', production_status: 'complete', archived_at: null,
  active_rework_cycle: active,
};
const historicalEntry = {
  job_id: job.id,
  rework_cycle_id: complete.id,
  job,
  rework_cycle: complete,
} as ManpowerEntry;
const options = buildManpowerWorkTargetOptions([job], [historicalEntry]);
assert.deepEqual(options.map(({ value, selectable }) => [value, selectable]), [
  ['job:job-a', true],
  ['rework:rw-active', true],
  ['rework:rw-complete', false],
]);
assert.equal(options[1].label, '25-1218 — Bank of America · REWORK #1');
assert.equal(manpowerEntryTargetValue(historicalEntry), 'rework:rw-complete');

assert.deepEqual(manpowerIdentityForTarget('rework:rw-active', '', options), {
  job_id: 'job-a', rework_cycle_id: 'rw-active', unlisted_work_label: null,
});
assert.deepEqual(manpowerIdentityForTarget('job:job-a', '', options), {
  job_id: 'job-a', rework_cycle_id: null, unlisted_work_label: null,
});
assert.deepEqual(manpowerIdentityForTarget('__unlisted__', ' Shop ', options), {
  job_id: null, rework_cycle_id: null, unlisted_work_label: 'Shop',
});
assert.throws(() => manpowerIdentityForTarget('rework:wrong-job', '', options));

const baseKey = manpowerEntryTargetValue({ job_id: 'job-a', rework_cycle_id: null });
const reworkKey = manpowerEntryTargetValue({ job_id: 'job-a', rework_cycle_id: 'rw-active' });
assert.notEqual(baseKey, reworkKey);

const laborRows = [
  { job_id: 'job-a', rework_cycle_id: null, hours: 3 },
  { job_id: 'job-a', rework_cycle_id: 'rw-active', hours: 5 },
];
assert.equal(laborRows.filter((row) => row.job_id === 'job-a').reduce((sum, row) => sum + row.hours, 0), 8);

console.log('Manpower Rework attribution checks passed.');
