import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('supabase/migrations/20260902_005_sample_recent_value_suggestions.sql','utf8');
const workspace=fs.readFileSync('src/modules/samples/SampleWorkspace.tsx','utf8');
const input=fs.readFileSync('src/modules/samples/SampleRecentValueInput.tsx','utf8');
const queries=fs.readFileSync('src/modules/samples/recent-values.ts','utf8');

assert.match(migration,/create table public\.sample_user_recent_values/);
assert.match(migration,/primary key \(user_id, field_key, normalized_value\)/);
assert.ok(migration.includes("regexp_replace(btrim(entry.value), '\\s+', ' ', 'g')"));
assert.match(migration,/lower\(clean_value\)/);
assert.match(migration,/ranked\.position > 15/);
assert.match(migration,/where recent\.user_id = auth\.uid\(\) and recent\.field_key = p_field_key/);
assert.match(migration,/revoke all on public\.sample_user_recent_values from public, anon, authenticated/);
assert.match(migration,/grant execute on function public\.list_my_sample_recent_values\(text\) to authenticated, service_role/);
assert.doesNotMatch(migration,/create policy/);

assert.match(input,/list=\{listId\}/);
assert.match(input,/onFocus=\{\(\)=>onLoad\(fieldKey\)\}/);
assert.match(input,/autoComplete="off"/);
assert.match(workspace,/if\(recentValues\[fieldKey\]\|\|recentLoading\.has\(fieldKey\)\)return/);
assert.match(workspace,/await saveSample\(draft\);await recordMySampleRecentValues\(draft\)/);
assert.match(queries,/list_my_sample_recent_values/);
assert.match(queries,/record_my_sample_recent_values/);

for(const excluded of ['colorPlateNumber','requestedDate','approvedDate','jobId','bidId','notes','moreNotes']){
  assert.doesNotMatch(queries,new RegExp(`${excluded}:sample\\.`),`${excluded} must not enter recent-value history`);
}

console.log('Sample recent-value suggestion checks passed.');
