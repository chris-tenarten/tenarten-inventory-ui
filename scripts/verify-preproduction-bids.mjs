import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const migration=await readFile(new URL('../supabase/migrations/20260901_001_preproduction_bids.sql',import.meta.url),'utf8');
const workspace=await readFile(new URL('../src/modules/pre-production/BidWorkspace.tsx',import.meta.url),'utf8');
const proposalCard=await readFile(new URL('../src/modules/pre-production/BidProposalCard.tsx',import.meta.url),'utf8');
const samplesCard=await readFile(new URL('../src/modules/pre-production/BidSamplesCard.tsx',import.meta.url),'utf8');
const queries=await readFile(new URL('../src/modules/pre-production/queries.ts',import.meta.url),'utf8');

assert.match(migration,/create table public\.bids/);
assert.match(migration,/id uuid primary key default gen_random_uuid\(\)/);
assert.match(migration,/status text not null default 'active' check \(status in \('active','won','lost'\)\)/);
assert.match(migration,/creator_user_id uuid not null/);
assert.match(migration,/owner_user_id uuid not null/);
assert.match(migration,/deposit_received_date date/);
assert.doesNotMatch(migration,/insert into public\.jobs|update public\.jobs|delete from public\.jobs/i);
assert.doesNotMatch(migration,/bid_line_items|bid_number|job_number/);
assert.match(migration,/values\(created_id,btrim\(p_customer\),btrim\(p_project_name\),actor\.user_id,actor\.user_id\)/);
assert.match(migration,/public\.require_app_capability\('readOperationalData'\)/);
assert.match(migration,/public\.has_app_capability\('readOperationalData'\)/);
assert.match(migration,/revoke all on public\.bids, public\.bid_activity from public,anon,authenticated/);
assert.match(migration,/grant select on public\.bids, public\.bid_activity to authenticated/);
assert.match(migration,/activity_type.*'created'.*'details_updated'.*'owner_changed'.*'status_changed'.*'deposit_received_changed'/s);
assert.match(migration,/from_status/);assert.match(migration,/to_status/);
assert.match(migration,/from_business_date/);assert.match(migration,/to_business_date/);
assert.match(migration,/occurred_at timestamptz not null default now\(\)/);
assert.match(migration,/on delete restrict/);
assert.doesNotMatch(migration,/policy[^;]+owner_user_id\s*=\s*auth\.uid\(\)/is);

assert.match(workspace,/No Production Job is created/);
assert.match(workspace,/useState<BidStatus\|'all'>\('active'\)/);
assert.match(workspace,/filter==='all'\|\|bid\.status===filter/);
assert.match(proposalCard,/Proposal &amp; Estimate/);
assert.match(samplesCard,/Samples \/ Color Plates/);
assert.match(workspace,/This Bid is not a Production Job/);
assert.doesNotMatch(workspace,/Bid Number|Pre-Job|lead scoring|probability/i);
assert.match(queries,/p_deposit_received_date:bid\.depositReceivedDate\|\|null/);

console.log('PP-001 Bid domain verification passed.');
