import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
const cfg = JSON.parse(readFileSync('.tmp-label-permission-validation/config.json'));
assert.equal(cfg.appOrigin, 'http://localhost:4318');
const actors = {}, results = [];
const check = (name, condition) => { assert.ok(condition, name); results.push(name); };
for (const [name, actor] of Object.entries(cfg.actors)) {
 const client = createClient(cfg.appOrigin, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
 const signed = await client.auth.signInWithPassword({ email: actor.email, password: actor.password }); assert.ifError(signed.error);
 actors[name] = { client, token: signed.data.session.access_token, id: signed.data.user.id };
}
const rpc = (name, fn, args = {}) => actors[name].client.rpc(fn, args);
const cap = async (name, capability) => { const r = await rpc(name, 'has_app_capability', { p_capability: capability }); assert.ifError(r.error); return r.data; };
const authorize = (name, id = cfg.sampleId) => rpc(name, 'authorize_sample_color_plate_label', { p_sample_id: id });
const profile = async name => { const r = await rpc(name, 'get_my_app_access'); assert.ifError(r.error); return r.data[0]; };
const update = (name, labels, blend = false) => ({ action: 'update', userId: actors[name].id, displayName: cfg.actors[name].displayName, role: cfg.actors[name].role, isActive: name !== 'inactive', readOnly: name === 'support', messagingWrite: false, productionBlendManage: blend, sampleLabelsGenerate: labels });
const edge = (caller, body) => fetch(cfg.appOrigin + '/functions/v1/admin-manage-users', { method: 'POST', headers: { authorization: 'Bearer ' + actors[caller].token, origin: cfg.appOrigin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const set = async (name, labels, blend = false) => { const r = await edge('admin', update(name, labels, blend)); assert.equal(r.status, 200, await r.text()); };
const baseline = await profile('member');
check('Admin inherent label access with explicit flag false', await cap('admin', 'sample_labels.generate') && !(await profile('admin')).sample_labels_generate);
check('Admin direct saved-Sample authorization', (await authorize('admin')).data === true);
check('Ordinary Member denied without grant', !(await cap('member', 'sample_labels.generate')) && (await authorize('member')).error?.code === '42501');
check('Existing Sample remains readable without label permission', (await actors.member.client.from('samples').select('id').eq('id', cfg.sampleId)).data?.length === 1);
check('Member cannot self-grant through actual Admin endpoint', (await edge('member', update('member', true))).status === 403);
const args = { p_user_id: actors.member.id, p_display_name: cfg.actors.member.displayName, p_role: 'member', p_is_active: true, p_read_only: false, p_messaging_write: false, p_production_blend_manage: false, p_sample_labels_generate: true };
check('Member cannot self-grant through v3 RPC', (await rpc('member', 'admin_set_app_access_v3', args)).error?.code === '42501');
const rawUpdate = await actors.member.client.from('app_users').update({ sample_labels_generate: true }).eq('user_id', actors.member.id).select('user_id');
check('Raw user-table grant update cannot change permission', (!!rawUpdate.error || rawUpdate.data?.length === 0) && !(await profile('member')).sample_labels_generate);
check('Malformed optional permission rejected', (await edge('admin', { ...update('member', true), sampleLabelsGenerate: 'true' })).status === 400);
await set('member', true);
check('Grant visible to same Member session', await cap('member', 'sample_labels.generate') && (await authorize('member')).data === true);
check('Unsaved preview uses dedicated grant', (await authorize('member', null)).data === true);
check('Missing/invisible Sample denied even when granted', (await authorize('member', '00000000-0000-0000-0000-000000000000')).error?.code === '42501');
let after = await profile('member');
check('No broader identity or Blend grant', after.role === baseline.role && after.read_only === baseline.read_only && after.production_blend_manage === false && !(await cap('member', 'manageUsers')));
const legacy = update('member', true); delete legacy.sampleLabelsGenerate;
check('Legacy v2 update succeeds', (await edge('admin', legacy)).status === 200);
check('Legacy v2 preserves label grant', (await profile('member')).sample_labels_generate);
delete legacy.productionBlendManage;
check('Legacy v1 update succeeds', (await edge('admin', legacy)).status === 200);
check('Legacy v1 preserves label grant', (await profile('member')).sample_labels_generate);
await set('outsider', false, true);
check('Blend grant does not imply label access', await cap('outsider', 'production_blend.manage') && !(await cap('outsider', 'sample_labels.generate')));
await set('outsider', true, true);
const labelOnly = update('outsider', false); delete labelOnly.productionBlendManage;
check('Label-only change accepted', (await edge('admin', labelOnly)).status === 200);
check('Label-only change preserves Blend grant', (await profile('outsider')).production_blend_manage && !(await profile('outsider')).sample_labels_generate);
await set('support', true);
check('Explicit read-only Guest grant works without business or Blend access', (await authorize('support')).data === true && !(await cap('support', 'writeBusinessData')) && !(await cap('support', 'production_blend.manage')));
await set('inactive', true);
check('Inactive explicit grant denied', !(await cap('inactive', 'sample_labels.generate')) && !!(await authorize('inactive')).error);
const anon = createClient(cfg.appOrigin, cfg.anonKey, { auth: { persistSession: false } });
check('Anonymous direct RPC denied', !!(await anon.rpc('authorize_sample_color_plate_label', { p_sample_id: cfg.sampleId })).error);
// Narrow adversarial visibility fixture: add a restrictive policy in this new database only.
// Canonical policies stay intact; the test restriction is removed in finally.
function sql(statement) { const r = spawnSync('docker', ['exec', '-i', 'tenops-label-permission-db', 'psql', '-X', '-qAt', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: statement, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); }
try {
 sql(`create policy label_test_visibility_restriction on public.samples as restrictive for select to authenticated using (auth.uid() <> '${actors.member.id}'::uuid);`);
 check('Caller SELECT RLS hides Sample', (await actors.member.client.from('samples').select('id').eq('id', cfg.sampleId)).data?.length === 0);
 check('SECURITY INVOKER authorizer respects actual Sample RLS', (await authorize('member')).error?.code === '42501');
} finally { sql('drop policy if exists label_test_visibility_restriction on public.samples;'); }
const oldToken = actors.member.token;
await set('member', false);
check('Revoke immediately denies same stale Member token', actors.member.token === oldToken && !(await cap('member', 'sample_labels.generate')) && (await authorize('member')).error?.code === '42501' && (await authorize('member', null)).error?.code === '42501');
check('Revoked Member retains Sample visibility and original role', (await actors.member.client.from('samples').select('id').eq('id', cfg.sampleId)).data?.length === 1 && (await profile('member')).role === baseline.role);
for (const role of ['lead', 'developer']) {
 const changed = update('outsider', false); changed.role = role;
 assert.equal((await edge('admin', changed)).status, 200);
 check(role + ' receives no implicit label grant', !(await cap('outsider', 'sample_labels.generate')) && (await authorize('outsider')).error?.code === '42501');
}
check('Null explicit v3 choice rejected', (await rpc('admin', 'admin_set_app_access_v3', { ...args, p_sample_labels_generate: null })).error?.code === '22023');
check('Anonymous Sample read exposes no rows', !(await anon.from('samples').select('id').eq('id', cfg.sampleId)).data?.length);
await set('outsider', false); await set('support', false); await set('inactive', false);
const security = sql(`select jsonb_build_object('policies',(select jsonb_agg(to_jsonb(p) order by tablename,policyname) from pg_policies p where schemaname='public' and tablename in ('samples','sample_blend_rows','sample_working_versions','sample_issued_documents')),'grants',(select jsonb_agg(jsonb_build_array(c.relname,c.relacl::text) order by c.relname) from pg_class c where c.oid in ('public.samples'::regclass,'public.sample_blend_rows'::regclass,'public.sample_working_versions'::regclass,'public.sample_issued_documents'::regclass)))`);
check('Canonical Sample policies/grants unchanged after migration and tests', security === readFileSync('.tmp-label-permission-validation/sample-security-before.json', 'utf8').trim());
const existing = readFileSync('.tmp-label-permission-validation/existing-resources-before.txt', 'utf8').trim().split('\n').map(line => line.split(' ').slice(0, 2).join(' '));
const now = spawnSync('docker', ['ps', '-a', '--format', '{{.ID}} {{.Names}}'], { encoding: 'utf8' });
check('All pre-existing containers preserved with same identity', existing.every(line => now.stdout.includes(line)));
writeFileSync('docs/project-memory/evidence/2026-10-13-label-permission-api.json', JSON.stringify({ timestamp: new Date().toISOString(), environment: cfg.project, checks: results, count: results.length, realAuthSessions: Object.keys(actors), sameTokenGrantRevoke: true, sampleSecurityUnchanged: true }, null, 2) + '\n');
console.log(JSON.stringify({ passed: results.length, checks: results }, null, 2));
