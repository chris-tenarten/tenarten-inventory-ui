import assert from 'node:assert/strict';
import workerImport from './tenbot-ai/worker';
import { MODEL, type InferenceInput } from '../supabase/functions/_shared/tenbot-core';
import { guideOnlyInput } from './support/tenbot-ai-pilot.mjs';

// tsx's ESM runner wraps this repository's CommonJS .ts default export.
const worker = ('default' in workerImport ? workerImport.default : workerImport) as typeof workerImport;

const input: InferenceInput = {
  question: 'How do I create a group?', context: ['Current module: My Work'], draft: false,
  excerpts: [{ id: 'group', title: 'Create a group conversation', guidance: 'Open Messaging and choose New group.', status: 'deployed' }],
};
const key = 'synthetic-local-binding-key-'.repeat(2);
let calls = 0, cases = 0;
let mode: 'success' | 'invalid-usage' | 'invalid-json' | 'failure' = 'success';
const env = {
  TENBOT_PILOT_BRIDGE_KEY: key,
  AI: { async run(model: string, request: { max_tokens: number; temperature: number; messages: { content: string }[] }) {
    calls++;
    assert.equal(model, MODEL);
    assert.equal(request.max_tokens, 384);
    assert.equal(request.temperature, 0);
    assert.deepEqual(Object.keys(request).sort(), ['max_tokens', 'messages', 'temperature']);
    assert.deepEqual(JSON.parse(request.messages[1].content), input);
    if (mode === 'failure') throw Error('synthetic credential must stay private');
    return {
      response: mode === 'invalid-json' ? '{' : JSON.stringify({ ids: ['group'], summary: '' }),
      usage: mode === 'invalid-usage'
        ? { prompt_tokens: -1, completion_tokens: Infinity, total_tokens: 12, private: 'synthetic secret' }
        : { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12, private: 'synthetic secret' },
    };
  } },
};

async function check(name: string, options: {
  path?: string; method?: string; headers?: Record<string, string>; body?: string; status?: number;
} = {}) {
  const { path = '/infer', method = 'POST', headers = {}, body = JSON.stringify(input), status = 400 } = options;
  const response = await worker.fetch(new Request('http://127.0.0.1:55594' + path, {
    method, headers: { 'x-tenbot-pilot-key': key, 'content-type': 'application/json', ...headers },
    ...(method === 'GET' ? {} : { body }),
  }), env);
  assert.equal(response.status, status, name);
  assert.equal(response.headers.get('cache-control'), 'no-store', name);
  assert.equal(response.headers.has('access-control-allow-origin'), false, name);
  cases++;
  return response;
}

// No test may contact Cloudflare or another network service.
const originalFetch = globalThis.fetch;
let networkCalls = 0;
globalThis.fetch = async () => { networkCalls++; throw Error('Network forbidden in binding verifier'); };
try {
  await check('wrong key', { headers: { 'x-tenbot-pilot-key': 'wrong' }, status: 403 });
  await check('same-length wrong key', { headers: { 'x-tenbot-pilot-key': 'x'.repeat(key.length) }, status: 403 });
  for (const origin of ['http://localhost:3000', 'null', '']) {
    await check('browser Origin denied', { headers: { origin }, status: 403 });
  }
  await check('wrong path', { path: '/other', status: 404 });
  await check('wrong method', { method: 'GET', status: 405 });
  const health = await check('authenticated health', { path: '/health', method: 'GET', status: 200 });
  assert.deepEqual(await health.json(), { ready: true });
  await check('health requires key', { path: '/health', method: 'GET', headers: { 'x-tenbot-pilot-key': '' }, status: 403 });
  await check('wrong MIME', { headers: { 'content-type': 'application/json-malformed' }, status: 415 });
  await check('invalid JSON', { body: '{' });
  await check('declared oversize', { headers: { 'content-length': '16001' }, status: 413 });
  await check('streamed oversize', { body: 'x'.repeat(16001), status: 413 });
  await check('UTF-8 byte limit', { body: 'é'.repeat(8001), status: 413 });
  for (const body of [
    { ...input, model: 'arbitrary' }, { ...input, question: 'x'.repeat(1201) }, { ...input, question: ' ' },
    { ...input, context: ['one', 'two', 'three'] }, { ...input, context: [42] }, { ...input, draft: 'false' },
    { ...input, excerpts: Array(4).fill(input.excerpts[0]) },
    { ...input, excerpts: [{ ...input.excerpts[0], guidance: 'x'.repeat(3001) }] },
    { ...input, excerpts: [{ ...input.excerpts[0], status: 'production' }] },
    { ...input, excerpts: [{ ...input.excerpts[0], credentials: 'synthetic private value' }] },
  ]) await check('invalid input shape', { body: JSON.stringify(body) });
  assert.equal(calls, 0, 'rejected inputs and health never invoke the model');
  const response = await check('fixed-model dispatch', { status: 200 });
  assert.deepEqual(await response.json(), { output: { ids: ['group'], summary: '' }, usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 } });
  mode = 'invalid-usage';
  assert.deepEqual(await (await check('invalid usage omitted', { status: 200 })).json(), { output: { ids: ['group'], summary: '' }, usage: { total_tokens: 12 } });
  for (const failure of ['invalid-json', 'failure'] as const) {
    mode = failure;
    assert.deepEqual(await (await check('provider failure stays generic', { status: 503 })).json(), { error: 'AI inference unavailable' });
  }

  const privateText = 'Synthetic customer Acme, invoice 123, credential example-secret, https://private.example/job';
  const raw = { ...input, question: privateText, context: [privateText, 'Current module: My Work', 'Current module: My Work /private-record', 'Current module: Admin'] };
  const projected = guideOnlyInput(raw);
  assert.deepEqual(projected, { ...input, question: input.excerpts[0].title });
  assert.equal(JSON.stringify(projected).includes(privateText), false, 'raw wording and prior conversation stay local');
  assert.equal(raw.question, privateText, 'projection does not rewrite employee input');
  for (const moduleLabel of ['TenOps', 'Production', 'My Work', 'Settings', 'Contacts', 'Intake', 'Samples', 'Inventory', 'Purchasing', 'Manpower Reporting']) {
    assert.deepEqual(guideOnlyInput({ ...raw, context: ['Current module: ' + moduleLabel] }).context, ['Current module: ' + moduleLabel]);
  }
  assert.deepEqual(guideOnlyInput({ ...raw, excerpts: [] }), { question: 'No verified guide match', draft: false, excerpts: [], context: ['Current module: My Work'] });
  assert.throws(() => guideOnlyInput({ ...raw, draft: true }), /employee-written/);
  assert.equal(networkCalls, 0, 'verifier performs no network calls');
  console.log(`PASS: ${cases} binding boundary/dispatch cases and guide-only privacy projection; mock inference only, no network.`);
} finally {
  globalThis.fetch = originalFetch;
}
