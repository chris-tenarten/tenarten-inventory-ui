// Focused transport/accounting contract tests. RPCs are doubles, NOT database certification.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHostedOpenAIMetering, HostedMeteringError, usdToMicrousd, type HostedMeterRpc } from '../supabase/functions/_shared/tenbot-openai-metering';
const owner = '11111111-1111-4111-8111-111111111111', requestId = '22222222-2222-4222-8222-222222222222';
const calls: { name: string; args: Record<string, unknown> }[] = [];
const checks: string[] = [];
async function check(name: string, fn: () => unknown | Promise<unknown>) { await fn(); checks.push(name); }
const reserveReply = (args: Record<string, unknown>) => ({ data: { ok: true, id: args.p_id, requestId: args.p_request_id, reservedMicrousd: args.p_reserved_microusd } });
const meter = (rpc: HostedMeterRpc, extra = {}) => createHostedOpenAIMetering({ owner, requestId, model: 'gpt-6.1-terra', rpc, ...extra });
await check('Decimal ceilings preserve fractions and scientific notation without downward rounding', () => {
  for (const [usd, micro] of [[0, 0], [0.53193765, 531938], [0.5399555000000006, 539956], [0.000001, 1], [0.000001000001, 2], [1e-7, 1], [5e-324, 1], [1.1e-5, 11], [5, 5000000], [1e6, 1e12]]) assert.equal(usdToMicrousd(usd), micro);
  for (const value of [-1, Infinity, NaN, 1e6 + 1]) assert.throws(() => usdToMicrousd(value), HostedMeteringError);
});
await check('Configuration and zero reservations fail before any RPC', async () => {
  const rpc: HostedMeterRpc = async () => { throw Error('must not run'); };
  for (const extra of [{ owner: 'other' }, { requestId: 'model-output' }, { model: 'unallowlisted' }, { timeoutMs: 0 }, { timeoutMs: 10001 }]) assert.throws(() => meter(rpc, extra), HostedMeteringError);
  await assert.rejects(meter(rpc).reserveBudget(0), HostedMeteringError);
});
await check('Reserve binds authenticated owner, per-turn server ID, model and integer ceiling', async () => {
  const rpc: HostedMeterRpc = async (name, args) => { calls.push({ name, args }); return reserveReply(args); };
  await meter(rpc).reserveBudget(0.0000035);
  assert.equal(calls[0].name, 'tenbot_openai_reserve'); assert.equal(calls[0].args.p_user, owner); assert.equal(calls[0].args.p_request_id, requestId); assert.equal(calls[0].args.p_model, 'gpt-6.1-terra'); assert.equal(calls[0].args.p_reserved_microusd, 4); assert.match(String(calls[0].args.p_id), /^[0-9a-f-]{36}$/);
});
await check('Concurrent per-step reservations receive unique IDs; no model or caller replay IDs accepted', async () => {
  const ids = new Set(); const run = meter(async (_name, args) => { ids.add(args.p_id); return reserveReply(args); });
  await Promise.all(Array.from({ length: 40 }, () => run.reserveBudget(0.001))); assert.equal(ids.size, 40);
});
await check('Unknown reservation response is not retried and cannot dispatch', async () => {
  let count = 0; await assert.rejects(meter(async () => { count++; throw Error('SENSITIVE_RPC_ERROR'); }).reserveBudget(0.01), error => error instanceof HostedMeteringError && error.message === 'meter-unavailable'); assert.equal(count, 1);
  await assert.rejects(meter(async () => ({ data: { ok: false } })).reserveBudget(0.01), HostedMeteringError);
});
await check('Malformed reservation acknowledgement fails closed', async () => {
  for (const change of [{ id: 'wrong' }, { requestId: 'wrong' }, { reservedMicrousd: 1 }, { ok: false }]) await assert.rejects(meter(async (_name, args) => ({ data: { ...reserveReply(args).data, ...change } })).reserveBudget(0.01), HostedMeteringError);
});
await check('RPC deadline is bounded; uncertain reserve remains un-retried', async () => {
  let count = 0; const start = Date.now(); await assert.rejects(meter(async () => { count++; return await new Promise(() => {}); }, { timeoutMs: 10 }).reserveBudget(0.01), HostedMeteringError); assert.equal(count, 1); assert(Date.now() - start < 1000);
});
await check('Measured settlement passes a conservative integer ceiling and permits idempotent retry', async () => {
  const captured: Record<string, unknown>[] = [];
  const run = meter(async (name, args) => {
    if (name === 'tenbot_openai_reserve') return reserveReply(args);
    captured.push(args); return { data: { ok: true, id: args.p_id, state: 'measured', accountedMicrousd: args.p_actual_microusd, overrun: false } };
  });
  const r = await run.reserveBudget(0.01); await r.settle(0.0000015); await r.settle(0.0000015);
  assert.equal(captured.length, 2); assert.deepEqual(captured[0], captured[1]); assert.equal(captured[0].p_actual_microusd, 2); assert.equal(captured[0].p_user, owner);
});
await check('Undefined settlement retains full reservation; proven pre-dispatch zero is distinct', async () => {
  let reserved = 0; const measurements: unknown[] = [];
  const run = meter(async (name, args) => {
    if (name === 'tenbot_openai_reserve') { reserved = Number(args.p_reserved_microusd); return reserveReply(args); }
    measurements.push(args.p_actual_microusd); return { data: { ok: true, id: args.p_id, state: args.p_actual_microusd === null ? 'uncertain' : 'measured', accountedMicrousd: args.p_actual_microusd ?? reserved, overrun: false } };
  });
  const r = await run.reserveBudget(0.01); await r.settle(); await r.settle(0); assert.deepEqual(measurements, [null, 0]);
});
await check('Settlement transport errors, conflicting replies and accounting overruns propagate fail closed', async () => {
  for (const response of [{ ok: false }, { ok: true, state: 'measured', accountedMicrousd: 0, overrun: false }, { ok: true, state: 'measured', accountedMicrousd: 1000, overrun: true }]) {
    const r = await meter(async (name, args) => name === 'tenbot_openai_reserve' ? reserveReply(args) : { data: { id: args.p_id, ...response } }).reserveBudget(0.01);
    await assert.rejects(async () => await r.settle(0.001), HostedMeteringError);
  }
});
await check('SQL security/activation contract is explicit (static inspection, not SQL execution)', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261029220000_tenbot_openai_metering.sql', import.meta.url), 'utf8');
  assert.match(sql, /enabled boolean not null default false/); assert.match(sql, /total_limit_microusd bigint not null default 0/); assert.match(sql, /legacy_accounted_microusd>=539956/); assert.match(sql, /where singleton for update/g);
  assert.match(sql, /u\.is_active and c\.capability='readOperationalData'/); assert.match(sql, /Inference reservation already exists/); assert.match(sql, /Inference measurement conflict/); assert.match(sql, /set enabled=false/);
  assert.match(sql, /new\.legacy_accounted_microusd<old\.legacy_accounted_microusd/);
  assert.match(sql, /revoke all on public\.tenbot_openai_policy,public\.tenbot_openai_usage from public,anon,authenticated,service_role/); assert.match(sql, /grant execute on function .* to service_role/);
  assert(!/grant .* to authenticated|insert into public\.(materials|inventory|pending_receivals)|tenbot_reserve_usage\(/i.test(sql));
});
console.log(JSON.stringify({ passed: true, checks: checks.length, names: checks, liveDatabase: false, providerCalls: 0, hostedCalls: 0, limitation: 'RPC doubles plus SQL static contract checks; run verify-tenbot-openai-metering-database.mjs against an explicitly disposable local PostgreSQL database for real atomicity/role validation.' }, null, 2));
