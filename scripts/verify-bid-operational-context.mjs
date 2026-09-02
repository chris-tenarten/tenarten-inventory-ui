import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../supabase/migrations/20260901_002_bid_operational_context.sql', import.meta.url), 'utf8');
const queries = await readFile(new URL('../src/modules/pre-production/queries.ts', import.meta.url), 'utf8');
const types = await readFile(new URL('../src/modules/pre-production/types.ts', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../src/modules/pre-production/BidWorkspace.tsx', import.meta.url), 'utf8');

for (const column of ['contact_name', 'contact_email', 'contact_phone', 'notes']) {
  assert.match(migration, new RegExp(`add column ${column} text`));
}
assert.doesNotMatch(migration, /next_follow_up|reminder|expected_production/i);
assert.match(migration, /create table public\.bid_updates/);
assert.match(migration, /bid_id uuid not null references public\.bids\(id\) on delete restrict/);
assert.match(migration, /author_user_id uuid not null references public\.app_users\(user_id\)/);
assert.match(migration, /created_at timestamptz not null default now\(\)/);
assert.match(migration, /create policy bid_updates_operational_select[\s\S]+public\.has_app_capability\('readOperationalData'\)/);
assert.match(migration, /perform public\.require_app_capability\('readOperationalData'\)/);
assert.match(migration, /select \* into strict actor from public\.app_users where user_id=auth\.uid\(\) and is_active/);
assert.match(migration, /revoke all on public\.bid_updates from public,anon,authenticated/);
assert.match(migration, /grant select on public\.bid_updates to authenticated/);
assert.doesNotMatch(migration, /grant (?:update|delete|insert|all)[^;]*public\.bid_updates to authenticated/i);
assert.doesNotMatch(migration, /owner_user_id\s*=\s*auth\.uid\(\)|auth\.uid\(\)\s*=\s*owner_user_id/i);
assert.doesNotMatch(migration, /insert into public\.jobs|update public\.jobs|delete from public\.jobs/i);
assert.doesNotMatch(migration, /contract_value|bid_line_items|bid_number|job_number|my_work/i);
assert.doesNotMatch(migration, /notes_changed[^;]+(?:next_notes|p_notes)/is, 'Notes body must not be copied into activity metadata.');
assert.match(migration, /values\(p_bid_id,'notes_changed',actor\.user_id,recorded_at,jsonb_build_object\('changed',true\)\)/);
assert.match(migration, /values\(created_id,p_bid_id,actor\.user_id,normalized_body\)/);

for (const field of ['contactName', 'contactEmail', 'contactPhone', 'notes']) {
  assert.match(types, new RegExp(`${field}: string`));
  assert.match(queries, new RegExp(field));
  assert.match(workspace, new RegExp(field));
}
assert.match(types, /export type BidUpdate/);
assert.match(queries, /list_bid_updates/);
assert.match(queries, /create_bid_update/);
assert.match(workspace, /Primary Contact/);
assert.doesNotMatch(workspace, /Next Follow-up|reminder|expected Production window/i);
assert.match(workspace, /Durable pursuit touchpoints, separate from structural lifecycle history/);
assert.match(workspace, /data-shell-below-header/);
assert.doesNotMatch(workspace, /Contract Value|sales funnel|probability|reminder notification/i);

console.log('Bid operational context verification passed.');
