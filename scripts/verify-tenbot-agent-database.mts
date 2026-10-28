// Focused new agent-wrapper evidence over the existing disposable PostgreSQL
// fixture. No initialization, reseeding, business/history writes, or inference.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runTenbotAgent, emptyUsage, type AgentProvider, type AgentStep, type AgentTool, type JsonValue } from '../supabase/functions/_shared/tenbot-agent';
import { createTenbotAgentJobTools } from '../supabase/functions/_shared/tenbot-agent-operations';
import { createTenbotJobTools, type JobToolResult } from '../supabase/functions/_shared/tenbot-job-tools';
import { createTenbotJobCaller, protectedTenbotState, jobFixture as f, TENBOT_JOB_DATABASE as container } from './support/tenbot-job-database.mjs';

const directory = '/private/tmp/tenops-tenbot-agent-poc';
const checks: string[] = [];
const trace: Array<Record<string, unknown>> = [];
const before = protectedTenbotState(container);
const caller = (actor: string) => createTenbotJobCaller(container, actor, { trace });
const canonical = (actor: string) => createTenbotJobTools(caller(actor), { now: () => new Date(f.now) });
const authorized = async (actor: string) => {
  const value = await caller(actor).rpc('has_app_capability', { p_capability: 'readOperationalData' });
  return !value.error && value.data === true;
};
const call = (id: string, name: string, args: Record<string, JsonValue> = {}) => ({ id, name, arguments: args });
const step = (calls: AgentStep['calls'] = [], final?: AgentStep['final']): AgentStep => ({ calls, ...(final === undefined ? {} : { final }), continuation: [], usage: emptyUsage() });
const final = (ids: string[] = []) => ({ answer: 'Synthetic fixture findings only. No changes were made.', observations: ids.length ? [{ text: 'The caller-authorized tools returned the fixture findings.', evidence_ids: ids }] : [], inferences: [], recommendations: [], questions: [], completed_actions: [] });
function scripted(steps: AgentStep[], onStep?: (index: number) => void): AgentProvider {
  let index = 0;
  return { name: 'offline PostgreSQL wrapper verifier', model: 'scripted-no-inference', async step() {
    onStep?.(index);
    const value = steps[index++];
    assert(value, 'Unexpected scripted provider step');
    return value;
  } };
}
async function run(actor: string, tools: AgentTool[], steps: AgentStep[], publish: () => Promise<boolean>) {
  return runTenbotAgent({ question: 'Investigate synthetic Job TB-2801 using authorized recorded data.' }, {
    callerId: actor, provider: scripted(steps), tools,
    authorize: async check => await authorized(actor) && (check.phase !== 'publish' || await publish()),
  });
}
async function check(name: string, action: () => Promise<void>) { await action(); checks.push(name); }
const document = (value: JsonValue) => value as unknown as JobToolResult;
const execute = async (tools: AgentTool[], name: string, args: Record<string, JsonValue>) => {
  const tool = tools.find(item => item.name === name); assert(tool);
  return document((await tool.execute(args, { callerId: f.actor, signal: new AbortController().signal })).data);
};

await check('Five-tool registry composes real caller-authorized Job, planning, deterministic labor and overview reads', async () => {
  const wrapper = createTenbotAgentJobTools(canonical(f.actor));
  assert.equal(wrapper.tools.length, 5); assert(wrapper.tools.every(tool => tool.kind === 'read'));
  const result = await run(f.actor, wrapper.tools, [
    step([call('d', 'discover_capabilities', { names: wrapper.tools.map(tool => tool.name) })]),
    step([call('f', 'find_jobs', { query: 'TB-2801', include_archived: false, limit: 20, cursor: '' })]),
    step([call('s', 'get_job_summary', { job_id: f.main }), call('p', 'get_job_planning', { job_id: f.main }), call('l', 'get_job_labor_summary', { job_id: f.main, start_date: '', end_date: '' })]),
    step([call('o', 'get_production_overview', { include_archived: false, start_date: '', end_date: '', limit: 2 })]),
    step([], final(['e2', 'e3', 'e4', 'e5'])),
  ], wrapper.fresh);
  assert.equal(result.status, 'completed'); assert.equal(result.evidence.length, 5);
  const summary = document(result.evidence[1].data), planning = document(result.evidence[2].data), labor = document(result.evidence[3].data);
  assert.equal((summary.data as { job: { job_id: string }; counts: { open_follow_ups: number } }).job.job_id, f.main);
  assert.equal((summary.data as { counts: { open_follow_ups: number } }).counts.open_follow_ups, 1);
  assert.equal((planning.data as { phases: { availability: string } }).phases.availability, 'disabled');
  assert.equal((labor.data as { total_hours: number }).total_hours, 8.3);
  assert.deepEqual(labor.filters, { job_id: f.main, start_date: '2026-09-29', end_date: '2026-10-28', lifecycle: 'effective_with_original_preserved' });
  assert.deepEqual(result.proposals, []); assert.equal(result.usage.costUsd, 0);
});
await check('Canonical UUID lookup and direct summary reuse the actual read contracts', async () => {
  const wrapper = createTenbotAgentJobTools(canonical(f.actor));
  const found = await execute(wrapper.tools, 'find_jobs', { query: f.main, include_archived: false, limit: 20, cursor: '' });
  assert.equal(found.status, 'ok'); assert.equal((found.data as { jobs: { job_id: string }[] }).jobs[0].job_id, f.main);
  const summary = await execute(wrapper.tools, 'get_job_summary', { job_id: f.main });
  assert.equal(summary.status, 'ok'); assert.equal(await wrapper.fresh(), true);
});
await check('Real restrictive RLS hides the Job from lookup and all exact Job wrappers', async () => {
  const wrapper = createTenbotAgentJobTools(canonical(f.actor));
  const found = await execute(wrapper.tools, 'find_jobs', { query: f.hidden, include_archived: false, limit: 20, cursor: '' });
  assert.deepEqual((found.data as { jobs: unknown[] }).jobs, []);
  for (const name of ['get_job_summary', 'get_job_planning', 'get_job_labor_summary']) {
    const args: Record<string, JsonValue> = name === 'get_job_labor_summary' ? { job_id: f.hidden, start_date: '', end_date: '' } : { job_id: f.hidden };
    const value = await execute(wrapper.tools, name, args);
    assert.equal(value.status, 'not_found_or_not_authorized'); assert.equal(value.data, null); assert.deepEqual(value.sources, []);
    assert(!JSON.stringify(value).includes('TenBot Review Hidden By RLS'));
  }
});
await check('Inactive membership denies the agent before model or record reads', async () => {
  const wrapper = createTenbotAgentJobTools(canonical(f.inactive));
  const start = trace.length;
  const result = await run(f.inactive, wrapper.tools, [], wrapper.fresh);
  assert.equal(result.reason, 'authorization-denied'); assert.deepEqual(result.evidence, []);
  assert(!trace.slice(start).some(row => row.kind === 'query'));
});
await check('Permitted read-only Guest may investigate and registry exposes no prepare or execution tool', async () => {
  const wrapper = createTenbotAgentJobTools(canonical(f.readOnly));
  const result = await run(f.readOnly, wrapper.tools, [step([call('d', 'discover_capabilities', { names: ['get_job_summary'] })]), step([call('s', 'get_job_summary', { job_id: f.main })]), step([], final(['e1']))], wrapper.fresh);
  assert.equal(result.status, 'completed'); assert.equal(document(result.evidence[0].data).status, 'ok');
  assert(wrapper.tools.every(tool => tool.kind === 'read')); assert.deepEqual(result.proposals, []);
});
await check('Strict model schemas reject SQL and unknown fields before PostgreSQL record queries', async () => {
  const wrapper = createTenbotAgentJobTools(canonical(f.actor));
  const start = trace.length;
  const result = await run(f.actor, wrapper.tools, [step([call('d', 'discover_capabilities', { names: ['get_job_summary'] })]), step([call('s', 'get_job_summary', { job_id: f.main, sql: 'select * from jobs' })]), step([], final())], wrapper.fresh);
  assert.equal(result.status, 'completed'); assert.deepEqual(result.evidence, []);
  assert(!trace.slice(start).some(row => row.kind === 'query'));
});
await check('Changed result detection rejects stale combined evidence without changing PostgreSQL rows', async () => {
  const source = canonical(f.actor); let reads = 0;
  const wrapper = createTenbotAgentJobTools({ async execute(name, args) {
    const value = await source.execute(name, args);
    if (++reads > 1) value.unknowns = [...value.unknowns, 'Synthetic changed result on freshness reread.'];
    return value;
  } });
  const result = await run(f.actor, wrapper.tools, [step([call('d', 'discover_capabilities', { names: ['get_job_summary'] })]), step([call('s', 'get_job_summary', { job_id: f.main })]), step([], final(['e1']))], wrapper.fresh);
  assert.equal(result.reason, 'authorization-denied'); assert.equal(result.final, null); assert.deepEqual(result.evidence, []);
});
await check('A repeated read cannot hide an earlier stale evidence result from publication checks', async () => {
  const source = canonical(f.actor); let reads = 0;
  const wrapper = createTenbotAgentJobTools({ async execute(name, args) {
    const value = await source.execute(name, args);
    if (++reads > 1) value.unknowns = [...value.unknowns, 'Synthetic changed result on repeated read.'];
    return value;
  } });
  const result = await run(f.actor, wrapper.tools, [
    step([call('d', 'discover_capabilities', { names: ['get_job_summary'] })]),
    step([call('first', 'get_job_summary', { job_id: f.main })]),
    step([call('second', 'get_job_summary', { job_id: f.main })]),
    step([], final(['e1', 'e2'])),
  ], wrapper.fresh);
  assert.equal(result.reason, 'authorization-denied'); assert.equal(result.final, null); assert.deepEqual(result.evidence, []);
});
await check('Freshness reauthorization detects real inactive-caller denial through an injected delegate', async () => {
  const active = canonical(f.actor), inactive = canonical(f.inactive); let current = active;
  const wrapper = createTenbotAgentJobTools({ execute: (name, args) => current.execute(name, args) });
  const value = await execute(wrapper.tools, 'get_job_summary', { job_id: f.main }); assert.equal(value.status, 'ok');
  current = inactive;
  const start = trace.length;
  assert.equal(await wrapper.fresh(), false);
  assert(!trace.slice(start).some(row => row.kind === 'query'));
});

assert.equal(protectedTenbotState(container), before, 'Existing feedback/history/usage must remain byte-for-byte unchanged');
for (const row of trace.filter(item => item.kind === 'query')) {
  assert.equal(row.role, 'authenticated');
  assert(!(row.columns as string[]).some(column => /contract|remarks|body|notes|worker|entered_by|scope_details/.test(column)));
}
mkdirSync(directory, { recursive: true });
const report = { passed: true, checks, checkCount: checks.length, realPostgreSQL: true, container, queryCount: trace.filter(item => item.kind === 'query').length, externalModelCalls: 0, hostedCalls: 0, databaseMutations: 0, protectedTenbotRecordsPreserved: true, protectedStateSha256: createHash('sha256').update(before).digest('hex'), limits: ['Existing role/JWT-sub PostgreSQL fixture; no full HTTP Auth certification.', 'Provider is a scripted local double; no OpenAI/Qwen model-quality claim.', 'Changed result and delegate revocation are explicit injected cases; no fixture permissions or records changed.'] };
writeFileSync(directory + '/database.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, checks: checks.length, queryCount: report.queryCount, externalModelCalls: 0, databaseMutations: 0, evidence: directory + '/database.json' }));
