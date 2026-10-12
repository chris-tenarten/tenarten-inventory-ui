import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import { degrees, PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Run production mutations -> real SDK invoke -> exact Edge handler -> real SDK Auth.
// HTTP, credentials and persistence are disposable. Unexpected routes fail closed.
const root = path.resolve(process.argv[2] || 'supabase/functions');
const compile = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText).toString('base64')}`;
const originalFetch = globalThis.fetch;
globalThis.__lotClient = createClient;
globalThis.__lotPdf = { degrees, PDFDocument, StandardFonts, rgb };
let handler;
globalThis.Deno = {
  env: { get: key => ({ SUPABASE_URL: 'https://lot.invalid', SUPABASE_ANON_KEY: 'fixture-anon', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service', TENOPS_ALLOWED_ORIGINS: 'http://localhost:3000' })[key] },
  serve: callback => { handler = callback; },
};
const guardSource = fs.readFileSync(path.join(root, '_shared/rbac.ts'), 'utf8').replace(/import \{ createClient \} from "npm:[^"]+";/, 'const createClient = globalThis.__lotClient;');
const guard = await import(compile(guardSource));
globalThis.__lotGuard = guard;
const { APP_ROLES, accountHasCapability } = await import(compile(fs.readFileSync('src/lib/rbac.ts', 'utf8')));
assert.deepEqual(APP_ROLES.filter(role => accountHasCapability(role, 'issueTransmittal', false, false)), ['lead', 'admin']);
assert(APP_ROLES.every(role => accountHasCapability(role, 'previewOperationalDocuments', false, false)));
assert(APP_ROLES.every(role => !accountHasCapability(role, 'issueTransmittal', true, false)));
let frontendRole = 'lead';
globalThis.__lotFrontend = createClient('https://lot.invalid', 'fixture-anon', {
  accessToken: async () => `fixture-${frontendRole}`,
  auth: { persistSession: false, autoRefreshToken: false },
});
const mutations = await import(compile(fs.readFileSync('src/modules/transmittals/mutations.ts', 'utf8')
  .replace(/import \{ supabase \} from "@\/lib\/supabase";/, 'const supabase = globalThis.__lotFrontend;')));
let source = fs.readFileSync(path.join(root, 'generate-job-transmittal-pdf/index.ts'), 'utf8')
  .replace(/import \{ createClient \} from "npm:[^"]+";/, 'const createClient = globalThis.__lotClient;')
  .replace(/import \{ degrees, PDFDocument, StandardFonts, rgb \} from "npm:[^"]+";/, 'const { degrees, PDFDocument, StandardFonts, rgb } = globalThis.__lotPdf;')
  .replace(/import \{ EdgeAuthorizationError, requireEdgeCapability \} from "[^"]+";/, 'const { EdgeAuthorizationError, requireEdgeCapability } = globalThis.__lotGuard;')
  .replaceAll(/"\.\.\/_shared\/([^"]+\.mjs)"/g, (_, file) => JSON.stringify(pathToFileURL(path.join(root, '_shared', file)).href));
await import(compile(source));

const id = '11111111-1111-4111-8111-111111111111';
const snapshot = { cc: '', comments: '', customer: 'Disposable Customer', delivery: { attached: true, separate_cover: false, via: '' }, document_date: '2026-10-12', document_version: 'job-transmittal-pdf-v2', items: [{ line_number: 1, submittal: 'Fixture', quantity: '1', date: '2026-10-12', number: '1', description: 'Disposable test' }], job_id: null, job_name: 'Disposable fixture', job_number: '', purpose: { approval: false, use: true, record: false, rfi: false, review: false, review_by: '' }, recipient: { company: 'Fixture', address_line_1: '', address_line_2: '', attention: '', office_phone: '', mobile_phone: '', email: '' }, sender: { name: 'Fixture', phone: '', email: '' }, template_version: 1, transmittal_number: '9999-001', transmitted_types: { shop_drawing: false, letter: true, samples: false, other: false, other_label: '' } };
const originalSnapshot = structuredClone(snapshot);
const captures = [{ id, snapshot, document_status: 'pending', storage_bucket: 'job-transmittal-documents', storage_path: null }];
let uploads = 0, failUpload = false, claims = 0, capabilityCalls = [], serviceCalls = 0, frontendCalls = 0, authCalls = 0;
const permissions = Object.fromEntries(APP_ROLES.map(role => [role, ['issueTransmittal', 'previewOperationalDocuments'].filter(capability => accountHasCapability(role, capability, false, false))]));
permissions.inactive = [];
permissions.readonly = ['previewOperationalDocuments'];
globalThis.fetch = async (url, init) => {
  const parsed = new URL(url), route = parsed.pathname;
  const header = new Headers(init.headers).get('authorization');
  if (route === '/functions/v1/generate-job-transmittal-pdf') {
    frontendCalls++;
    assert.equal(header, `Bearer fixture-${frontendRole}`, 'SDK invoke must forward one effective session Authorization value');
    assert(!header.includes(','), 'Conflicting header casing must never combine bearer values');
    const headers = new Headers(init.headers);
    headers.set('origin', 'http://localhost:3000'); // A browser supplies Origin at transport time.
    return handler(new Request(url, { ...init, headers }));
  }
  if (route === '/auth/v1/user') {
    authCalls++;
    assert(!header.includes(','), 'getUser(token) must not combine lowercase/uppercase bearer headers');
    const role = header?.replace('Bearer fixture-', '');
    return permissions[role] ? Response.json({ id: `fixture-${role}` }) : Response.json({ message: 'Invalid JWT', code: 'bad_jwt' }, { status: 401 });
  }
  const body = init.body && typeof init.body === 'string' ? JSON.parse(init.body) : {};
  if (route.endsWith('/has_app_capability')) {
    capabilityCalls.push(body.p_capability);
    return Response.json(permissions[header?.replace('Bearer fixture-', '')]?.includes(body.p_capability) || false);
  }
  serviceCalls++;
  assert.equal(header, 'Bearer fixture-service');
  const capture = captures[0];
  if (route.endsWith('/claim_job_transmittal_pdf_generation')) {
    claims++;
    assert.equal(body.p_transmittal_id, id);
    if (capture.document_status === 'generating') return Response.json({ message: 'GENERATION_ALREADY_ACTIVE' }, { status: 400 });
    if (capture.document_status !== 'generated') capture.document_status = 'generating';
    return Response.json([{ snapshot, transmittal_number: snapshot.transmittal_number, claim_token: id, document_status: capture.document_status, storage_bucket: capture.storage_bucket, storage_path: capture.storage_path }]);
  }
  if (route.endsWith('/complete_job_transmittal_pdf_generation')) {
    capture.document_status = 'generated'; capture.storage_path = body.p_path;
    return Response.json(true);
  }
  if (route.endsWith('/fail_job_transmittal_pdf_generation')) { capture.document_status = 'failed'; return Response.json(true); }
  if (route.startsWith('/storage/v1/object/sign/')) return Response.json({ signedURL: '/object/sign/fixture?token=disposable' });
  if (route.startsWith('/storage/v1/object/')) {
    if (failUpload) return Response.json({ message: 'Disposable storage outage' }, { status: 503 });
    uploads++;
    return Response.json({ Key: 'fixture' });
  }
  if (route === '/rest/v1/job_transmittals') return Response.json(capture);
  throw new Error(`Unexpected fixture route ${route}`);
};
const call = (action, role = 'lead', casing = 'Authorization') => handler(new Request('https://lot.invalid/functions/v1/generate-job-transmittal-pdf', { method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json', ...(role ? { [casing]: `Bearer fixture-${role}` } : {}) }, body: JSON.stringify(action === 'draft-preview' ? { action, snapshot } : { action, transmittalId: id }) }));
const draft = { documentDate: snapshot.document_date, recipient: { company: 'Fixture', addressLine1: '', addressLine2: '', attention: '', officePhone: '', mobilePhone: '', email: '' }, cc: '', deliveryAttached: true, deliverySeparateCover: false, deliveryVia: '', typeShopDrawing: false, typeLetter: true, typeSamples: false, typeOther: false, typeOtherLabel: '', items: [{ submittal: 'Fixture', quantity: '1', date: snapshot.document_date, number: '1', description: 'Disposable test' }], purposeApproval: false, purposeUse: true, purposeRecord: false, purposeRfi: false, purposeReview: false, reviewBy: '', comments: '', senderName: 'Fixture', senderPhone: '', senderEmail: '', jobId: '', jobNumber: '', jobName: 'Disposable fixture', customer: 'Disposable Customer', transmittalNumber: '9999-001' };
try {
  for (const action of ['draft-preview', 'preview', 'generate']) {
    for (const role of [null, 'invalid', 'expired', 'inactive']) {
      const before = JSON.stringify(captures), beforeService = serviceCalls;
      assert.equal((await call(action, role)).status, role === 'inactive' ? 403 : 401);
      assert.equal(JSON.stringify(captures), before);
      assert.equal(serviceCalls, beforeService, 'Rejected auth must not reach persistence/storage');
    }
  }
  for (const casing of ['Authorization', 'authorization', 'AUTHORIZATION']) {
    assert.equal((await call('draft-preview', 'member', casing)).status, 200);
  }
  for (const role of [...APP_ROLES, 'readonly']) {
    frontendRole = role;
    const blob = await mutations.previewJobTransmittal(draft);
    assert(blob instanceof Blob);
    assert.equal(Buffer.from(await blob.arrayBuffer()).subarray(0, 4).toString(), '%PDF');
  }
  assert.equal(serviceCalls, 0, 'Draft preview must not touch captures');
  for (const role of ['guest', 'member', 'developer', 'readonly']) {
    frontendRole = role;
    await assert.rejects(mutations.generateJobTransmittalPdf(id), /not authorized/);
  }
  frontendRole = 'invalid';
  await assert.rejects(mutations.previewJobTransmittal(draft), /Authentication required/);
  assert.equal(serviceCalls, 0);
  frontendRole = 'lead';
  assert.equal((await call('preview')).status, 409, 'Issued capture has no PDF yet');
  captures[0].document_status = 'generating';
  await assert.rejects(mutations.generateJobTransmittalPdf(id), /generation is already active/);
  assert.equal(uploads, 0);
  captures[0].document_status = 'pending';
  failUpload = true;
  const originalError = console.error; console.error = () => {};
  try { await assert.rejects(mutations.generateJobTransmittalPdf(id), /transmittal request failed/); } finally { console.error = originalError; }
  assert.equal(captures[0].document_status, 'failed'); assert.equal(captures.length, 1);
  failUpload = false;
  assert(await mutations.generateJobTransmittalPdf(id));
  assert.equal(captures[0].document_status, 'generated'); assert.equal(uploads, 1);
  frontendRole = 'member';
  assert(await mutations.getJobTransmittalPdfUrl(id));
  frontendRole = 'admin';
  assert(await mutations.generateJobTransmittalPdf(id));
  assert.equal(uploads, 1, 'Retry of generated capture must reuse existing PDF');
  assert.equal(captures.length, 1); assert.deepEqual(captures[0].snapshot, originalSnapshot);
  assert(capabilityCalls.includes('issueTransmittal') && capabilityCalls.includes('previewOperationalDocuments'));
  assert.equal(claims, 4);
  assert(frontendCalls > 0 && authCalls > frontendCalls);
  console.log('PASS LoT mutations + real SDK invoke/Auth + actual Edge: one effective bearer header; casing variants; missing/invalid/expired/inactive denial; existing role/read-only permissions; capture-free Preview; Generate failure/retry and generated reuse (one capture, one successful upload). HTTP persistence fixtures only; no hosted writes.');
} finally {
  globalThis.fetch = originalFetch;
  for (const name of ['Deno', '__lotClient', '__lotPdf', '__lotGuard', '__lotFrontend']) delete globalThis[name];
}
