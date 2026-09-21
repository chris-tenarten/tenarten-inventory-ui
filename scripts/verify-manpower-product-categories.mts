import assert from 'node:assert/strict';
import { loadCompleteLabor } from '../src/modules/manpower/pagination';
import { laborHours, summarizeProductLabor, validateProductSelection, productLabel, UNCATEGORIZED } from '../src/modules/manpower/product-reporting';
import { summarizeLaborLifecycles } from '../src/modules/production/labor-lifecycle';
import { roleHasCapability } from '../src/lib/rbac';
import type { ManpowerEntry, ManpowerReference } from '../src/modules/manpower/types';

const category = (id: string, name: string, active = true): ManpowerReference => ({ id, display_name: name, is_active: active, sort_order: 1, created_at: '', updated_at: '' });
const categories = [category('slabs', 'Slabs'), category('stairs', 'Stairs', false)];
const tasks = [category('wizard', 'Rough Grind on Wizard'), category('polisher', 'Rough Grind on Polisher')];
const row = (id: string, hours: number, product: string | null, task = 'wizard', rework: string | null = null): ManpowerEntry => ({
  id, am_hours: hours, pm_hours: 0, product_category_id: product, task_id: task,
  job_id: 'job', rework_cycle_id: rework, task: { id: task, display_name: task },
  work_date: '2026-09-17', worker_id: 'worker', worker: { id: 'worker', display_name: 'Worker' },
  reporting_group_id: 'group', reporting_group: null, job: null, rework_cycle: null,
  unlisted_work_label: null, notes: null, entered_by: null, created_at: '', updated_at: '',
});
// Equivalent count/total fixture, with >1,000 rows and decimal-hour boundaries.
const historical = Array.from({ length: 1674 }, (_, index) => row(String(index), index < 504 ? 5 : 4, null));
assert.equal(laborHours(historical), 7200);
const calls: number[] = [];
const loaded = await loadCompleteLabor(async (from, to) => { calls.push(from); return { data: historical.slice(from, to + 1), error: null, count: historical.length }; });
assert.equal(loaded.length, 1674); assert.equal(laborHours(loaded), 7200); assert.deepEqual(calls, [0, 500, 1000, 1500]);
assert.equal(summarizeProductLabor(loaded, categories, tasks, 'product')[0].id, UNCATEGORIZED);
assert.equal(summarizeProductLabor(loaded, categories, tasks, 'product')[0].hours, 7200);
await assert.rejects(loadCompleteLabor(async () => ({ data: historical.slice(0, 100), error: null, count: 1674 })), /incomplete/);
await assert.rejects(loadCompleteLabor(async (from, to) => ({ data: historical.slice(from, to + 1), error: null, count: from ? 1675 : 1674 })), /changed/);
await assert.rejects(loadCompleteLabor(async () => ({ data: null, error: { message: 'network failure' }, count: null })), /network failure/);
assert.deepEqual(await loadCompleteLabor(async () => ({ data: [], error: null, count: 0 })), []);
const mixed = [row('1', 2.13, 'slabs'), row('2', 0.27, 'slabs', 'polisher', 'rework'), row('3', 3.1, 'stairs'), row('4', 1.05, null)];
for (const orientation of ['task', 'product'] as const) {
  const result = summarizeProductLabor(mixed, categories, tasks, orientation);
  assert.equal(result.reduce((sum, parent) => sum + Math.round(parent.hours * 100), 0), 655);
  for (const parent of result) assert.equal(parent.children.reduce((sum, child) => sum + Math.round(child.hours * 100), 0), Math.round(parent.hours * 100));
}
assert.equal(summarizeProductLabor(mixed, categories, tasks, 'task').length, 2);
assert.equal(laborHours(mixed.filter((r) => r.product_category_id === 'slabs')), 2.4);
assert.equal(summarizeLaborLifecycles(mixed).get('job')?.reworks[0].hours, 0.27);
assert.equal(laborHours(mixed), 6.55);
assert.equal(validateProductSelection('', categories, null), '');
assert.notEqual(validateProductSelection('', categories), '');
assert.notEqual(validateProductSelection('', categories, 'slabs'), '');
assert.equal(validateProductSelection('stairs', categories, 'stairs'), '');
assert.notEqual(validateProductSelection('stairs', categories), '');
assert.equal(validateProductSelection('slabs', categories), '');
assert.equal(productLabel('slabs', [{ ...categories[0], display_name: 'Renamed slabs' }]), 'Renamed slabs');
assert.match(productLabel('stairs', categories), /Inactive/);
for (const role of ['guest', 'member', 'developer'] as const) assert.equal(roleHasCapability(role, 'manageManpowerProductCategories'), false);
for (const role of ['lead', 'admin'] as const) assert.equal(roleHasCapability(role, 'manageManpowerProductCategories'), true);
console.log('Manpower Product Category logic passed: 1,674 rows / 7,200 hours; pagination failures; both orientations; decimals; historical edits; Rework; role map.');

if (process.argv.includes('--hosted-read-only')) {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const hosted = await loadCompleteLabor((from, to) => client.from('manpower_entries').select('id,job_id,rework_cycle_id,am_hours,pm_hours', { count: 'exact' }).order('work_date', { ascending: false }).order('created_at', { ascending: false }).order('id').range(from, to));
  assert.equal(hosted.length, 1674); assert.equal(laborHours(hosted), 7200);
  assert.equal(laborHours(hosted.filter((entry) => entry.job_id)), 4059);
  console.log('Hosted READ ONLY validation passed: production pagination helper returned all 1,674 entries / 7,200 hours; linked Job labor 4,059 hours.');
}
