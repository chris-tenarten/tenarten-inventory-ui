import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';

// Optional downloaded deployed source is read only. All tokens and HTTP are disposable.
const deployedPath = process.argv[2];
const originalFetch = globalThis.fetch;
globalThis.__lotAuthClient = createClient;
globalThis.Deno = { env: { get: key => ({ SUPABASE_URL: 'https://lot-fixture.invalid', SUPABASE_ANON_KEY: 'fixture-anon' })[key] } };
async function load(path) {
  const source = fs.readFileSync(path, 'utf8').replace(/import \{ createClient \} from "npm:[^"]+";/, 'const createClient = globalThis.__lotAuthClient;');
  return import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText).toString('base64')}`);
}
let calls = [], allowed = true;
globalThis.fetch = async (url, init) => {
  const header = new Headers(init.headers).get('authorization');
  calls.push({ auth: String(url).endsWith('/auth/v1/user'), duplicate: header?.includes(',') });
  if (String(url).endsWith('/auth/v1/user')) return header === 'Bearer fixture-valid'
    ? Response.json({ id: 'fixture-user' })
    : Response.json({ message: 'Invalid JWT', code: 'bad_jwt' }, { status: 401 });
  assert.equal(header, 'Bearer fixture-valid');
  assert.equal(JSON.parse(init.body).p_capability, 'issueTransmittal');
  return Response.json(allowed);
};
const request = token => new Request('https://lot-fixture.invalid', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
try {
  if (deployedPath) {
    const deployed = await load(deployedPath);
    await assert.rejects(deployed.requireEdgeCapability(request('fixture-valid'), 'issueTransmittal'), e => e.status === 401);
    assert.deepEqual(calls, [{ auth: true, duplicate: true }]);
    console.log('PASS deployed source: valid caller rejected at Auth with duplicated header; capability RPC not reached.');
  }
  const candidate = await load('supabase/functions/_shared/rbac.ts');
  for (const token of [undefined, 'fixture-expired', 'fixture-invalid']) {
    calls = [];
    await assert.rejects(candidate.requireEdgeCapability(request(token), 'issueTransmittal'), e => e.status === 401);
    assert.equal(calls.length, token ? 1 : 0);
  }
  calls = []; allowed = false;
  await assert.rejects(candidate.requireEdgeCapability(request('fixture-valid'), 'issueTransmittal'), e => e.status === 403);
  assert.equal(calls.length, 2);
  allowed = true;
  for (let retry = 0; retry < 2; retry++) {
    calls = [];
    assert.equal((await candidate.requireEdgeCapability(request('fixture-valid'), 'issueTransmittal')).id, 'fixture-user');
    assert.equal(calls.length, 2);
    assert(calls.every(c => !c.duplicate));
  }
  console.log('PASS candidate: authorized caller and repeated authorization succeed; expired/invalid/missing tokens and insufficient capability denied. HTTP fixtures only; no document generation or hosted writes.');
} finally {
  globalThis.fetch = originalFetch;
  delete globalThis.__lotAuthClient;
  delete globalThis.Deno;
}
