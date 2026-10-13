import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Read-only hosted checks. Never log tokens, signed links, row contents or upstream error bodies.
const mode = process.argv[2];
const evidenceFile = process.argv[3];
assert(['before', 'after'].includes(mode) && evidenceFile);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(new URL(url).hostname, 'vxdxjhazkqhpkwdqtobp.supabase.co');
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: rows, error } = await service.from('job_transmittals')
  .select('id,transmittal_number,snapshot_hash,document_hash,document_status,storage_bucket,storage_path,issued_at')
  .order('id').limit(10000);
assert(!error, 'Capture metadata read failed');
assert(rows.length < 10000, 'Capture evidence requires pagination');
const hash = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const caller = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const token = process.env.TENOPS_DEMO_CHRIS_ACCESS_TOKEN;
let validSession = false, canPreview = false, canGenerate = false;
if (token) {
  const { data, error: authError } = await caller.auth.getUser(token);
  validSession = !authError && Boolean(data.user);
  if (validSession) {
    for (const capability of ['previewOperationalDocuments', 'issueTransmittal']) {
      const response = await fetch(`${url}/rest/v1/rpc/has_app_capability`, { method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ p_capability: capability }) });
      assert(response.ok, 'Capability read failed');
      if (capability === 'issueTransmittal') canGenerate = (await response.json()) === true;
      else canPreview = (await response.json()) === true;
    }
  }
}
const snapshot = { cc: '', comments: '', customer: 'Disposable authentication preview', delivery: {}, document_date: '2026-10-12', document_version: 'job-transmittal-pdf-v1', items: [], job_id: null, job_name: 'Disposable preview — not issued', job_number: '', purpose: {}, recipient: { address_line_1: '', address_line_2: '' }, sender: { name: 'Disposable preview' }, template_version: 1, transmittal_number: '', transmitted_types: {} };
async function invoke(action, bearer, extra = {}) {
  const response = await fetch(`${url}/functions/v1/generate-job-transmittal-pdf`, {
    method: 'POST', headers: { apikey: anon, origin: 'https://tenops.pages.dev', 'content-type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify({ action, ...extra }),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  return { status: response.status, pdf: bytes.subarray(0, 4).toString() === '%PDF' };
}
const probes = [];
for (const action of ['draft-preview', 'preview', 'generate']) {
  for (const kind of ['missing', 'invalid']) {
    const result = await invoke(action, kind === 'invalid' ? 'disposable-invalid-token' : null);
    assert.equal(result.status, 401, 'Missing/invalid token must remain rejected');
    probes.push({ action, kind, status: result.status });
  }
}
if (validSession && canPreview) {
  const result = await invoke('draft-preview', token, { snapshot });
  assert.equal(result.status, mode === 'before' ? 401 : 200);
  if (mode === 'after') assert(result.pdf);
  probes.push({ action: 'draft-preview', kind: 'valid-user', ...result });
  // Read-only saved-preview path with invalid ID: validates auth and shape without touching a capture.
  const saved = await invoke('preview', token, { transmittalId: 'disposable-invalid-id' });
  assert.equal(saved.status, mode === 'before' ? 401 : 400);
  probes.push({ action: 'preview', kind: 'valid-user-invalid-id', status: saved.status });
}
if (validSession && canGenerate) {
  // Shape rejection after auth/capability; cannot reach the generation claim RPC.
  const generated = await invoke('generate', token, { transmittalId: 'disposable-invalid-id' });
  assert.equal(generated.status, mode === 'before' ? 401 : 400);
  probes.push({ action: 'generate', kind: 'valid-user-invalid-id', status: generated.status });
}
const evidence = { mode, captureCount: rows.length, captureMetadataSha256: hash, validSessionAvailable: validSession, canPreview, canGenerate, probes };
const { data: finalRows, error: finalError } = await service.from('job_transmittals')
  .select('id,transmittal_number,snapshot_hash,document_hash,document_status,storage_bucket,storage_path,issued_at')
  .order('id').limit(10000);
assert(!finalError && finalRows.length === rows.length, 'Capture count changed during probes');
assert.equal(createHash('sha256').update(JSON.stringify(finalRows)).digest('hex'), hash, 'Capture metadata changed during probes');
evidence.probesLeftCapturesUnchanged = true;
if (mode === 'after') {
  const before = JSON.parse(fs.readFileSync(evidenceFile, 'utf8'));
  assert.equal(rows.length, before.captureCount, 'Capture count changed during release');
  assert.equal(hash, before.captureMetadataSha256, 'Existing capture metadata changed during release');
  evidence.capturesUnchanged = true;
}
const destination = mode === 'after' ? evidenceFile.replace(/\.json$/, '-after.json') : evidenceFile;
fs.writeFileSync(destination, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence));
