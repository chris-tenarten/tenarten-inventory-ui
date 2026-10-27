import assert from 'node:assert/strict';
import workerImport from './tenbot-ai/worker';
import { MODEL, INFERENCE_CONTRACT, type InferenceInput } from '../supabase/functions/_shared/tenbot-core';
import { guideOnlyInput } from './support/tenbot-ai-pilot.mjs';
import { projectConversation } from '../supabase/functions/_shared/tenbot-privacy';
import { conversationGuides } from '../supabase/functions/_shared/tenbot-knowledge';

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
  assert.deepEqual(await health.json(), { ready: true, model: MODEL, inferenceContract: INFERENCE_CONTRACT });
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
  assert.throws(()=>guideOnlyInput(raw),/local guide fallback/,'credential-bearing wording declines inference');
  assert.equal(raw.question, privateText, 'projection does not rewrite employee input');
  const actualQuestion='How can I create a group for customer Acme?';
  const actualInput={...input,question:actualQuestion,context:[privateText,'Current module: My Work']};
  const projected = guideOnlyInput(actualInput);
  assert.deepEqual(projected,{...input,question:'how can i create a group for customer'});
  assert.notEqual(projected.question,input.excerpts[0].title,'provider preserves actual intent instead of canonical title');
  assert.equal(JSON.stringify(projected).includes('Acme'),false,'private names stay local');
  assert.equal(actualInput.question,actualQuestion,'provider projection does not mutate original question');
  assert.deepEqual(guideOnlyInput(projected),projected,'defensive provider projection is idempotent');
  for (const moduleLabel of ['TenOps', 'Production', 'Rework', 'Planning', 'My Work', 'Settings', 'Contacts', 'Intake', 'Samples', 'Proposals', 'Inventory', 'Purchasing', 'Manpower Reporting']) {
    assert.deepEqual(guideOnlyInput({ ...input, context: ['Current module: ' + moduleLabel] }).context, ['Current module: ' + moduleLabel]);
  }
  assert.deepEqual(guideOnlyInput({ ...input, excerpts: [] }), { ...input,question:'how do i create a group',excerpts:[] },'an unmatched question remains actual intent for clarification');
  assert.throws(() => guideOnlyInput({ ...raw, draft: true }), /employee-written/);

  // Intent projection keeps the employee's actual workflow wording. These
  // cases exercise only local pure functions and the fixed mock binding.
  const intentQuestions = [
    ['How do I create Rework for a completed Job?', 'how do i create rework for a completed job'],
    ['how do i filter by jobs in manpower reporting', 'how do i filter by jobs in manpower reporting'],
    ['how do i edit a saved customers details', 'how do i edit a saved customers details'],
    ['Can I turn a DM into a group?', 'can i turn a dm into a group'],
    ['Can I automatically predict supplier lead times from a Blend Sheet?', 'can i automatically predict supplier lead times from a blend sheet'],
    ["What if I don't see that button?", 'what if i do not see that button'],
    ['Can I do that for Rework instead?', 'can i do that for rework instead'],
  ];
  for(const [question,expected] of intentQuestions){
    assert.equal(projectConversation(question,[]).question,expected,question);
    cases++;
  }
  const sensitiveQuestion='How do I edit customer Mark Green details for Acme invoice INV-8821, 9b160e46-b65b-487e-912a-3794dd09a75c, chris@example.com, https://private.example/job, phone 214-555-0123?';
  const safeQuestion=projectConversation(sensitiveQuestion,[]).question;
  assert.match(safeQuestion,/how do i edit customer/);
  for(const secretPart of ['mark','green','acme','inv','8821','9b160e46','chris','example','private.example','214','555','0123']){
    assert.equal(new RegExp('\\b'+secretPart.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(safeQuestion),false,`removed ${secretPart}`);
  }
  assert.equal(/\d|https?:|@/.test(safeQuestion),false);
  assert.equal(projectConversation('How do I edit a customer named General Stock?',[]).question,'how do i edit a customer');
  for(const question of [
    'How do I create Rework? Authorization: Bearer synthetic-token',
    'How do I create Rework? password synthetic-private-value',
    'How do I create Rework? api_key=synthetic-private-value',
    'How do I edit a customer? {"company":"Acme","invoice":8821}',
    'How do I edit a customer?\nCustomer: Acme\nInvoice: 8821',
    'Employee message: Create rework for the customer tomorrow',
    'Gio wrote: Create rework for the customer tomorrow',
    'How do I create Rework?\ncompany\tinvoice\nAcme\t8821',
  ]){
    assert.equal(projectConversation(question,[]).question,'','structured records, credentials and pasted messages decline external inference');
    cases++;
  }
  const ownExchange='Conversation context:\nEmployee: How do I create Rework for customer Acme?\nTenBot: Open Production and select the Job.\nEmployee: What if I do not see that button?\nTenBot: Ask an administrator to review your access.';
  const projectedExchange=projectConversation('Can I do that instead?',[
    'Current module: Production',ownExchange,
  ]);
  assert.equal(projectedExchange.question,'can i do that instead');
  assert.equal(projectedExchange.context[0],'Current module: Production');
  assert.match(projectedExchange.context[1],/^Conversation context:\nEmployee: how do i create rework for customer\nTenBot: open production and select the job\nEmployee: what if i do not see that button/);
  assert.equal(projectedExchange.context[1].includes('Acme'),false);
  const providerExchange=guideOnlyInput({...input,...projectedExchange});
  assert.deepEqual(providerExchange.context,projectedExchange.context,'provider retains privacy-filtered own-assistant follow-ups');
  // Actual first Product-pilot response used a breadcrumb and inline field
  // slash. Neither must discard the assistant exchange or its follow-up topics.
  const firstQuestion='how do i initiate a rework for a job? Also, how do i filter by jobs in manpower reporting?';
  const firstAnswer='To initiate a rework for a job, open the job in Production, select Create Rework, choose a reason, describe the rework scope, enter the intake/return date, and select Create Rework. To filter by jobs in manpower reporting, open Reporting > Manpower Reporting, choose the job in Job labor review, and use the Clear job filter or All reporting groups to reset. Then, select a job and use the Product Category filter to narrow products.';
  const followup=projectConversation('What if that button is missing, and can a read-only employee use that Job filter?',[
    'Current module: Production',`Conversation context:\nEmployee: ${firstQuestion}\nTenBot: ${firstAnswer}`,
  ]);
  assert.equal(followup.context.length,2,'actual assistant breadcrumb retains completed exchange');
  assert.match(followup.context[1],/Employee: how do i initiate a rework/);
  assert.match(followup.context[1],/TenBot: to initiate a rework/);
  assert.match(followup.context[1],/intake return date/,'inline field slash retains both field words');
  assert.match(followup.context[1],/reporting manpower reporting/,'breadcrumb retains navigation words');
  const followupIds=conversationGuides(followup.question,followup.context).map(entry=>entry.id);
  assert(followupIds.includes('production-rework-create'),'actual follow-up retains Rework source');
  assert(followupIds.includes('manpower-job-filter'),'actual follow-up retains Manpower source');
  assert.deepEqual(guideOnlyInput({...input,...followup}).context,followup.context,'defensive provider pass preserves actual exchange');
  assert.equal(projectConversation('How do I create Rework > customer: Acme?',[]).question,'','employee questions keep structured rejection');
  assert.equal(projectConversation('How do I create Rework?',[`Conversation context:\nEmployee: How do I create Rework?\nTenBot: <script>Open Production</script>`]).context.length,0,'HTML is still rejected in own-assistant prose');
  cases++;
  for(const invalid of [
    'Private DM: synthetic-private-value',
    'Current module: Production /private-record',
    'Current module: Acme',
    'Conversation context:\nEmployee: Employee message: Create rework tomorrow\nTenBot: Open Production.',
    'Conversation context:\nEmployee: How do I create Rework?\nGio: synthetic-private-value',
  ]){
    assert.deepEqual(projectConversation('How do I create Rework?',[invalid]).context,[]);
    cases++;
  }
  for(const label of ['Production','Rework','Planning','Proposals','Manpower Reporting']){
    assert.deepEqual(projectConversation('How do I create Rework?',['Current module: '+label]).context,['Current module: '+label]);
  }
  assert.equal(projectConversation('Zqxv sentinel',[]).question,'');
  assert.equal(networkCalls, 0, 'verifier performs no network calls');
  console.log(`PASS: ${cases} binding boundary/dispatch and conversational privacy cases; mock inference only, no network.`);
} finally {
  globalThis.fetch = originalFetch;
}
