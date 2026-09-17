import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [migration, priorMigration, verification] = await Promise.all([
  read("../supabase/migrations/20260908_001_job_transmittal_linkage_semantics.sql"),
  read("../supabase/migrations/20260904_001_job_transmittal_without_job_number.sql"),
  read("../supabase/inspection/20260908_001_job_transmittal_linkage_semantics_verification.sql"),
]);

// The prior applied behavior remains historical evidence and is superseded only
// by an additive forward migration.
assert.match(priorMigration, /TRANSMITTAL_NUMBER_REQUIRED_WITHOUT_JOB_NUMBER/);
assert.match(priorMigration, /selected_prefix := split_part\(normalized_requested, '-', 1\)/);

assert.match(migration, /^begin;/);
assert.match(migration, /commit;\s*$/);
assert.match(migration, /JOB_TRANSMITTAL_LINKAGE_SEMANTICS_PREDECESSOR_MISSING/);
assert.match(migration, /alter table public\.job_transmittals\s+alter column job_id drop not null/);
assert.match(migration, /NULL only for an explicitly standalone \/ one-off Letter of Transmittal/);
assert.doesNotMatch(migration, /create table/i);
assert.doesNotMatch(migration, /alter table public\.jobs/i);
assert.doesNotMatch(migration, /(?:insert into|update|delete from) public\.jobs\b/i);

const issueDefinitions = migration.match(/create or replace function public\.issue_job_transmittal\(/g) ?? [];
const historyDefinitions = migration.match(/create or replace function public\.list_job_transmittals\(/g) ?? [];
assert.equal(issueDefinitions.length, 1);
assert.equal(historyDefinitions.length, 1);
assert.match(migration, /issue_job_transmittal\(\s*p_job_id uuid, p_requested_number text, p_snapshot jsonb, p_actor text\s*\)/);
assert.match(migration, /list_job_transmittals\(p_job_id uuid\)/);
assert.doesNotMatch(migration, /issue_standalone/i);

// Job-linked issuance is tied to the canonical Job Number and always allocates
// the next number from the shared PO/LoT namespace.
assert.match(migration, /if p_job_id is not null then/);
assert.match(migration, /select \* into selected_job from public\.jobs where id = p_job_id for share/);
assert.match(migration, /right\(regexp_replace\(coalesce\(selected_job\.job_number,''\), '\\D', '', 'g'\), 4\)/);
assert.match(migration, /JOB_NUMBER_REQUIRED_FOR_JOB_LINKED_TRANSMITTAL/);
assert.match(migration, /JOB_LINKED_TRANSMITTAL_NUMBER_OVERRIDE_NOT_ALLOWED/);
assert.match(migration, /display_job_number := trim\(selected_job\.job_number\)/);
assert.match(
  migration,
  /selected_prefix, 'job_transmittal', selected_id, p_job_id, null, 1/,
);

// Standalone issuance is explicit, requires a manual canonical document number,
// and stores no Job relationship or fabricated Job Number.
assert.match(migration, /STANDALONE_TRANSMITTAL_NUMBER_REQUIRED/);
assert.match(migration, /normalized_requested !~ '\^\[0-9\]\{4\}-\[0-9\]\{3\}\$'/);
assert.match(migration, /selected_prefix := split_part\(normalized_requested, '-', 1\)/);
assert.match(migration, /display_job_number := ''/);
assert.match(
  migration,
  /selected_prefix, 'job_transmittal', selected_id, null, normalized_requested, 1/,
);
assert.match(migration, /'job_id', p_job_id, 'job_number', display_job_number/);
assert.doesNotMatch(migration, /update public\.jobs|insert into public\.jobs/i);

// The established RPC names, sanitized return shape, and authorization grants
// remain intact so the existing PostgREST capability map continues to apply.
assert.match(migration, /returns table\(\s*transmittal_id uuid, transmittal_number text, issued_at timestamptz, snapshot_hash text\s*\)/);
assert.match(migration, /where \(p_job_id is null and transmittal\.job_id is null\)/);
assert.match(migration, /or \(p_job_id is not null and transmittal\.job_id = p_job_id\)/);
assert.match(migration, /alter function public\.issue_job_transmittal\(uuid,text,jsonb,text\) owner to postgres/);
assert.match(migration, /alter function public\.list_job_transmittals\(uuid\) owner to postgres/);
assert.match(
  migration,
  /grant execute on function public\.issue_job_transmittal\(uuid,text,jsonb,text\)\s+to anon, authenticated, service_role/,
);
assert.match(
  migration,
  /grant execute on function public\.list_job_transmittals\(uuid\)\s+to anon, authenticated, service_role/,
);

for (const requirement of [
  /begin;/,
  /create temporary table verify_existing_job_transmittals/,
  /VERIFY_STANDALONE_JOB_ID_STILL_REQUIRED/,
  /VERIFY_JOB_RELATIONSHIP_RESTRICT_FK_MISSING/,
  /VERIFY_LINKED_NUMBER_NOT_DERIVED/,
  /VERIFY_SAME_PREFIX_LINKED_OVERRIDE_ACCEPTED/,
  /VERIFY_UNRELATED_LINKED_OVERRIDE_ACCEPTED/,
  /VERIFY_UNNUMBERED_JOB_ISSUED_LINKED_TRANSMITTAL/,
  /VERIFY_FAKE_JOB_NUMBER_CREATED/,
  /VERIFY_BLANK_STANDALONE_NUMBER_ACCEPTED/,
  /VERIFY_INVALID_STANDALONE_NUMBER_ACCEPTED/,
  /VERIFY_STANDALONE_CREATED_JOB/,
  /VERIFY_STANDALONE_LINKAGE_SNAPSHOT_INVALID/,
  /VERIFY_STANDALONE_REGISTRY_INVALID/,
  /VERIFY_LINKED_HISTORY_NOT_ISOLATED/,
  /VERIFY_STANDALONE_HISTORY_NOT_ISOLATED/,
  /VERIFY_STANDALONE_COLLISION_ACCEPTED/,
  /VERIFY_HISTORICAL_TRANSMITTAL_CHANGED/,
  /rollback;\s*$/,
]) {
  assert.match(verification, requirement);
}

console.log("Job Transmittal linkage semantics verification passed.");
