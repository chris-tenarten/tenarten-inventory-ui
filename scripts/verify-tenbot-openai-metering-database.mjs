// Explicit opt-in ONLY: mutates a NEW, EMPTY, disposable local database with a
// tenbot_meter_test_* name. Never calls Docker, hosted Supabase or inference.
// Requires PostgreSQL CLI + preexisting anon/authenticated/service_role roles.
// TENBOT_METER_DB_TEST_AUTHORIZED=true TENBOT_METER_TEST_DATABASE_URL=... node <this file>
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const blocked = message => { console.log(JSON.stringify({ passed: false, blocked: message, hostedCalls: 0, providerCalls: 0 })); process.exit(2); };
if (process.env.TENBOT_METER_DB_TEST_AUTHORIZED !== 'true') blocked('Explicit disposable local database authorization is required; no database connection attempted.');
let target;
try { target = new URL(process.env.TENBOT_METER_TEST_DATABASE_URL ?? ''); } catch { blocked('Set TENBOT_METER_TEST_DATABASE_URL to a new empty local tenbot_meter_test_* database.'); }
if (!['postgres:', 'postgresql:'].includes(target.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)
  || !/^\/tenbot_meter_test_[a-z0-9_]{1,48}$/.test(target.pathname) || target.search || target.hash) blocked('Refusing target: only explicit loopback disposable test databases are allowed.');
const psql = process.env.TENBOT_METER_PSQL ?? 'psql';
if (!/(?:^|\/)psql$/.test(psql) || psql.includes('\0')) blocked('Invalid PostgreSQL CLI path.');
const env = { ...process.env, PGHOST: target.hostname.replace(/^\[|\]$/g, ''), PGPORT: target.port || '5432', PGDATABASE: target.pathname.slice(1), PGUSER: decodeURIComponent(target.username) || 'postgres', PGPASSWORD: decodeURIComponent(target.password), PGCONNECT_TIMEOUT: '2', PGSSLMODE: 'disable', PGOPTIONS: '-c statement_timeout=5000 -c lock_timeout=2000' };
// Credentials travel only through subprocess environment; URI is never printed or an argv item.
async function sql(statement, expectSuccess = true) {
  const result = await new Promise(resolve => {
    const child = spawn(psql, ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { env, stdio: ['pipe', 'pipe', 'pipe'], timeout: 8000, killSignal: 'SIGKILL' });
    let output = '', bytes = 0, failed = false;
    child.stdout.on('data', value => { bytes += value.length; if (bytes > 1_000_000) child.kill('SIGKILL'); else output += value.toString(); });
    // Do not surface arbitrary PostgreSQL diagnostics or connection strings.
    child.stderr.on('data', () => {}); child.on('error', () => { failed = true; });
    child.on('close', code => resolve({ ok: !failed && code === 0, output: output.trim() }));
    child.stdin.on('error', () => {}); child.stdin.end(statement);
  });
  if (expectSuccess) assert.equal(result.ok, true, 'Disposable database query failed or exceeded its bounded timeout.');
  return result;
}
const probe = await sql("select json_build_object('db',current_database(),'tables',(select count(*) from information_schema.tables where table_schema='public'),'roles',(select count(*) from pg_roles where rolname in ('anon','authenticated','service_role')));", false);
if (!probe.ok) blocked('Local PostgreSQL CLI/connection unavailable; one bounded probe failed. No Docker or endpoint retry.');
let metadata; try { metadata = JSON.parse(probe.output); } catch { blocked('Disposable database probe returned an invalid response.'); }
if (metadata.db !== target.pathname.slice(1) || metadata.tables !== 0 || metadata.roles !== 3) blocked('Refusing fixture setup: target must be EMPTY and have the three preexisting Supabase test roles.');
const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
await sql(`create table public.app_users(user_id uuid primary key,role text not null,is_active boolean not null);create table public.app_role_capabilities(role text not null,capability text not null);insert into public.app_users values('${owner}','meter-test',true),('${other}','meter-test',true);insert into public.app_role_capabilities values('meter-test','readOperationalData');`);
await sql(readFileSync(new URL('../supabase/migrations/20261029220000_tenbot_openai_metering.sql', import.meta.url), 'utf8'));
const checks = [];
const legacy = 539956;
async function check(name, fn) { await fn(); checks.push(name); }
const reserveStatement = (amount = 1000, id = randomUUID(), request = randomUUID(), actor = owner) => `select public.tenbot_openai_reserve('${actor}','${request}','${id}','gpt-6.1-terra',${amount});`;
const settleStatement = (id, amount = 'null', actor = owner) => `select public.tenbot_openai_settle('${actor}','${id}',${amount});`;
async function denied(statement) { assert.equal((await sql(statement, false)).ok, false); }
async function reset(policy = '') {
  await sql(`truncate public.tenbot_openai_usage;update public.app_users set is_active=true;update public.tenbot_openai_policy set enabled=true,expires_at=now()+interval '1 hour',legacy_accounted_day=(now() at time zone 'UTC')::date,total_limit_microusd=${legacy + 100000},day_limit_microusd=${legacy + 100000},month_limit_microusd=${legacy + 100000},user_day_limit_microusd=100000,request_limit_microusd=100000,request_step_limit=16,global_minute_step_limit=10000,user_minute_step_limit=1000,global_day_request_limit=100000,user_day_request_limit=10000,global_open_limit=100,user_open_limit=10${policy ? ',' + policy : ''};`);
}
await check('Disabled zero-budget migration cannot reserve', async () => { await denied(reserveStatement()); const r = JSON.parse((await sql('select public.tenbot_openai_meter_status();')).output); assert.equal(r.enabled, false); assert.equal(r.legacyAccountedMicrousd, legacy); assert.equal(r.totalLimitMicrousd, 0); });
await check('Authenticated/anonymous cannot invoke metering or read direct financial tables', async () => {
  for (const role of ['anon', 'authenticated']) { await denied(`set role ${role};${reserveStatement()}`); await denied(`set role ${role};select public.tenbot_openai_meter_status();`); }
  await denied('set role service_role;select * from public.tenbot_openai_policy;'); await denied('set role service_role;update public.tenbot_openai_policy set enabled=true;');
  await sql('set role service_role;select public.tenbot_openai_meter_status();');
});
await check('Twelve concurrent SQL reservations cannot overspend the remaining 3000 microUSD', async () => {
  await reset(`total_limit_microusd=${legacy + 3000},day_limit_microusd=${legacy + 3000},month_limit_microusd=${legacy + 3000}`);
  const outcomes = await Promise.all(Array.from({ length: 12 }, () => sql(reserveStatement(), false))); assert.equal(outcomes.filter(r => r.ok).length, 3);
  assert.equal((await sql('select count(*) from public.tenbot_openai_usage;')).output, '3');
});
await check('Duplicate reservation ID denies a second dispatch; unknown outcome keeps full cost', async () => {
  const id = (await sql('select id from public.tenbot_openai_usage order by id limit 1;')).output;
  await denied(reserveStatement(1000, id)); await sql(settleStatement(id));
  assert.equal((await sql(`select coalesce(actual_microusd,reserved_microusd) from public.tenbot_openai_usage where id='${id}';`)).output, '1000'); await denied(reserveStatement(1));
});
await check('Measured settlement retries are idempotent, conflicting values fail, known zero releases only its reservation', async () => {
  const id = (await sql('select id from public.tenbot_openai_usage order by id limit 1;')).output;
  await sql(settleStatement(id, 0)); await sql(settleStatement(id, 0)); await denied(settleStatement(id, 1)); await sql(reserveStatement(1000)); await denied(reserveStatement(1));
});
await check('Owner mismatch cannot settle another reservation', async () => { const id = (await sql('select id from public.tenbot_openai_usage limit 1;')).output; await denied(settleStatement(id, 0, other)); });
await check('Active status and current capability are revalidated per inference; settlement survives revocation', async () => {
  await reset(); const id = randomUUID(); await sql(reserveStatement(1000, id)); await sql(`update public.app_users set is_active=false where user_id='${owner}';`); await denied(reserveStatement()); await sql(settleStatement(id, 500));
  await sql(`update public.app_users set is_active=true;delete from public.app_role_capabilities;`); await denied(reserveStatement()); await sql("insert into public.app_role_capabilities values('meter-test','readOperationalData');");
});
await check('Per-request cumulative cost and step limits survive separate SQL connections', async () => {
  await reset('request_limit_microusd=1000,request_step_limit=2'); const request = randomUUID(); await sql(reserveStatement(700, randomUUID(), request)); await denied(reserveStatement(400, randomUUID(), request)); await sql(reserveStatement(300, randomUUID(), request)); await denied(reserveStatement(1, randomUUID(), request));
});
await check('Per-user daily cap is independent of global remaining budget', async () => { await reset('user_day_limit_microusd=1000'); await sql(reserveStatement()); await denied(reserveStatement(1)); await sql(reserveStatement(1000, randomUUID(), randomUUID(), other)); });
await check('Daily and monthly caps independently fail closed', async () => { for (const field of ['day_limit_microusd', 'month_limit_microusd']) { await reset(`${field}=${legacy}`); await denied(reserveStatement(1)); } });
await check('Open/uncertain concurrency limits and request counts bound repeated attempts', async () => {
  await reset('user_open_limit=1'); const id = randomUUID(); await sql(reserveStatement(1, id)); await sql(settleStatement(id)); await denied(reserveStatement(1));
  await reset('user_day_request_limit=1'); await sql(reserveStatement(1)); await denied(reserveStatement(1));
  await reset('user_minute_step_limit=1'); await sql(reserveStatement(1)); await denied(reserveStatement(1));
});
await check('Unallowlisted models and expired policy cannot dispatch', async () => { await reset(); await denied(reserveStatement().replace('gpt-6.1-terra', 'gpt-6.1-sol')); await sql("update public.tenbot_openai_policy set expires_at=now()-interval '1 second';"); await denied(reserveStatement()); });
await check('Unexpected measured overrun is recorded and latches provider disabled', async () => { await reset(); const id = randomUUID(); await sql(reserveStatement(100, id)); const result = JSON.parse((await sql(settleStatement(id, 101))).output); assert.equal(result.overrun, true); assert.equal(result.accountedMicrousd, 101); await denied(reserveStatement(1)); });
await check('Imported cumulative spend cannot decrease, including after later reconciliation raises it', async () => {
  await denied('update public.tenbot_openai_policy set legacy_accounted_microusd=0;');
  await sql(`update public.tenbot_openai_policy set legacy_accounted_microusd=${legacy + 1};`);
  await denied(`update public.tenbot_openai_policy set legacy_accounted_microusd=${legacy};`);
});
console.log(JSON.stringify({ passed: true, checks: checks.length, names: checks, realPostgreSQL: true, concurrentConnections: 12, sqlRolePrivileges: true, actualHttpJwtRls: false, hostedCalls: 0, providerCalls: 0, fixture: 'explicit disposable local database; retained for inspection', limitation: 'Isolated SQL metering/role tests only. Does not certify HTTP JWT, live Job RLS or hosted deployment configuration.' }, null, 2));
