import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile('supabase/migrations/20260817_003_production_rework_cycles.sql', 'utf8');
const jobs = await readFile('src/modules/production/jobs.ts', 'utf8');
const workspace = await readFile('src/modules/production/ProductionWorkspace.tsx', 'utf8');
const inspector = await readFile('src/modules/production/components/ProductionJobInspector.tsx', 'utf8');
const quickAction = await readFile('src/modules/production/components/ReworkQuickAction.tsx', 'utf8');
const queue = await readFile('src/modules/production/components/ProductionQueue.tsx', 'utf8');
const table = await readFile('src/modules/production/components/ProductionTable.tsx', 'utf8');

assert.match(migration, /production_rework_one_active_per_job_idx[\s\S]*where production_status not in \('complete', 'cancelled'\)/);
assert.match(migration, /^begin;[\s\S]*commit;\s*$/m);
assert.match(migration, /perform pg_advisory_xact_lock\(hashtextextended\(p_job_id::text, 0\)\)/);
assert.match(migration, /select coalesce\(max\(sequence_number\), 0\) \+ 1/);
assert.match(migration, /target_job\.production_status <> 'complete'/);
assert.match(migration, /save_production_rework_schedule_batch/);
assert.match(migration, /production_rework_schedule_batches/);
assert.match(migration, /return prior_batch\.result_payload \|\| jsonb_build_object\('replayed', true\)/);
for (const functionName of ['create_production_rework', 'update_production_rework_status', 'save_production_rework_schedule_batch']) {
  const functionSql = migration.match(new RegExp(`create or replace function public\\.${functionName}[\\s\\S]*?\\$\\$;`))?.[0] ?? '';
  assert.ok(functionSql, `${functionName} SQL body is present`);
  assert.doesNotMatch(functionSql, /update public\.jobs/);
}
assert.match(migration, /save_production_rework_mixed_schedule_batch/);
assert.match(migration, /production_rework_schedule_conflict/);
assert.match(migration, /Completed or cancelled Rework history cannot be changed/);
assert.match(migration, /Completed or cancelled Rework history cannot be rescheduled/);
for (const signature of [
  'create_production_rework\\(uuid,text,text,date,text\\)',
  'update_production_rework_status\\(uuid,text,timestamptz,text\\)',
  'save_production_rework_schedule_batch\\(jsonb,text,text,uuid\\)',
  'save_production_rework_mixed_schedule_batch\\(jsonb,jsonb,jsonb,text,text,uuid\\)',
]) {
  assert.match(migration, new RegExp(`alter function public\\.${signature} owner to postgres`));
}
assert.match(jobs, /supabase\.rpc\('create_production_rework',[\s\S]*?p_job_id:[\s\S]*?p_reason_category:[\s\S]*?p_scope_details:[\s\S]*?p_intake_date:[\s\S]*?p_created_by:/);
assert.match(jobs, /supabase\.rpc\('update_production_rework_status',[\s\S]*?p_rework_cycle_id:[\s\S]*?p_production_status:[\s\S]*?p_expected_updated_at:[\s\S]*?p_actor_name:/);
assert.match(jobs, /supabase\.rpc\('save_production_rework_mixed_schedule_batch', args\)/);
assert.match(jobs, /lifecycle_key: `rework:\$\{cycle\.id\}`/);
assert.match(workspace, /p_rework_proposals: reworkProposals/);
assert.match(workspace, /ordinaryStaged[\s\S]*!reworkJobIds\.has\(jobId\)/);
assert.match(workspace, /reworkStaged[\s\S]*reworkJobIds\.has\(jobId\)/);
assert.match(inspector, />Production History</);
assert.match(inspector, /canCreateProductionRework\(job\)[\s\S]*onCreateRework\(job\)[\s\S]*Create Rework/);
assert.match(quickAction, /canonicalStatus === "complete" && !job\.rework_cycle && !job\.archived_at/);
assert.match(quickAction, /title="Create Rework"/);
assert.match(quickAction, /onCreate\(job\)/);
assert.match(queue, /<ActivityStrip[\s\S]*onCreateRework=\{onCreateRework\}/);
assert.match(table, /<ReworkQuickAction job=\{job\} onCreate=\{onCreateRework\}/);
assert.match(workspace, /<CreateReworkDialog job=\{reworkTargetJob\}/);
assert.match(workspace, /<ProductionJobInspector[\s\S]*onCreateRework=\{setReworkTargetJob\}/);
assert.equal((jobs.match(/supabase\.rpc\('create_production_rework'/g) ?? []).length, 1);

console.log('Production whole-job Rework architecture checks passed.');
