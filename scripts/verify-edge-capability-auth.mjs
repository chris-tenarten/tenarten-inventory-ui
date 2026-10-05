import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';

// Execute the shared Edge guard with the real SDK, mocking only HTTP responses.
const source = fs.readFileSync('supabase/functions/_shared/rbac.ts', 'utf8')
  .replace(/import \{ createClient \} from "npm:[^"]+";/, 'const createClient = globalThis.__edgeTestCreateClient;');
const originalFetch = globalThis.fetch;
globalThis.__edgeTestCreateClient = createClient;
globalThis.Deno = { env: { get: (key) => ({ SUPABASE_URL: 'https://auth-test.invalid', SUPABASE_ANON_KEY: 'test-anon' })[key] } };
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { requireEdgeCapability } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
let allowed = true;
let calls = [];
globalThis.fetch = async (url, init) => {
  const authorization = new Headers(init.headers).get('authorization');
  calls.push({ url: String(url), authorization });
  if (String(url).endsWith('/auth/v1/user')) {
    const valid = authorization === 'Bearer valid-token';
    return Response.json(valid ? { id: 'admin-user' } : { message: 'Invalid JWT', code: 'bad_jwt' }, { status: valid ? 200 : 401 });
  }
  assert.equal(authorization, 'Bearer valid-token');
  assert.equal(JSON.parse(init.body).p_capability, 'manageUsers');
  return Response.json(allowed);
};
const request = (token) => new Request('https://edge-test.invalid', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
try {
  assert.equal((await requireEdgeCapability(request('valid-token'), 'manageUsers')).id, 'admin-user');
  assert.equal(calls.length, 2);
  assert(calls.every((call) => call.authorization === 'Bearer valid-token'));
  allowed = false;
  await assert.rejects(requireEdgeCapability(request('valid-token'), 'manageUsers'), (error) => error.status === 403);
  calls = [];
  await assert.rejects(requireEdgeCapability(request('invalid-token'), 'manageUsers'), (error) => error.status === 401);
  assert.equal(calls.length, 1, 'Invalid authentication must not reach the capability RPC');
  calls = [];
  await assert.rejects(requireEdgeCapability(request(), 'manageUsers'), (error) => error.status === 401);
  assert.equal(calls.length, 0, 'Missing authentication must not make an upstream request');
  console.log('PASS: Admin allowed; unauthorized user denied; invalid/missing tokens denied; single bearer header preserved through real SDK.');
} finally {
  globalThis.fetch = originalFetch;
  delete globalThis.__edgeTestCreateClient;
  delete globalThis.Deno;
}
