// Disposable PostgreSQL only. No ports, credentials, hosted URLs, or business data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const baseline = readFileSync('supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql', 'utf8');
const path = 'supabase/migrations/20260924200000_manpower_analytics_preference.sql';
const migration = readFileSync(path, 'utf8');
const prior = baseline.match(/create or replace function public.tenops_account_preferences_valid\(p_preferences jsonb\)[\s\S]*?\$function\$;/)[0];
const next = migration.match(/create or replace function public.tenops_account_preferences_valid\(p_preferences jsonb\)[\s\S]*?\$function\$;/)[0];
assert.equal(next.replace("    if preference_key = 'manpower_recent_labor_expanded' then\n      if jsonb_typeof(preference_value) <> 'boolean' then return false; end if;\n    elsif preference_key = 'appearance' then", "    if preference_key = 'appearance' then"), prior, 'All prior rules remain byte-identical');
const name = 'tenops-manpower-preference-' + process.pid;
const docker = args => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
const sql = (input, failure = false) => {
  const result = spawnSync('docker', ['exec', '-i', name, 'psql', '-X', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { input, encoding: 'utf8' });
  if (failure) { assert.notEqual(result.status, 0, 'Expected SQL to fail closed'); return result.stderr; }
  assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
};
const metadata = () => sql(`select jsonb_build_object('owner',proowner,'acl',proacl,'security',prosecdef,'config',proconfig,'volatility',provolatile,'language',prolang,'oid',oid) from pg_proc where oid='public.tenops_account_preferences_valid(jsonb)'::regprocedure;`);
const rows = () => sql('select coalesce(jsonb_agg(to_jsonb(p) order by user_id),\'[]\') from public.account_user_preferences p;');
try {
  docker(['run', '--rm', '-d', '--name', name, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17.6']);
  for (let attempt = 0; attempt < 50; attempt++) {
    const ready = spawnSync('docker', ['exec', name, 'pg_isready', '-U', 'postgres']);
    if (ready.status === 0) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  sql(`
create role authenticated; create role anon; create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid$$;
grant usage on schema auth to authenticated, anon, service_role;
create table public.app_users(user_id uuid primary key, is_active boolean not null);
insert into public.app_users values ('00000000-0000-0000-0000-000000000001',true),('00000000-0000-0000-0000-000000000002',true),('00000000-0000-0000-0000-000000000003',false);
create function public.tenops_touch_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now(); return new; end$$;
` + baseline.slice(baseline.indexOf('create or replace function public.tenops_account_preferences_valid'), baseline.indexOf('grant execute on function public.set_my_account_preference(text,jsonb) to authenticated;') + 'grant execute on function public.set_my_account_preference(text,jsonb) to authenticated;'.length));
  sql(prior.replaceAll('public.tenops_account_preferences_valid', 'public.verify_prior_preferences'));
  sql(`insert into account_user_preferences(user_id,preferences) values ('00000000-0000-0000-0000-000000000001','{"appearance":"dark","display_size":"large"}');`);
  const beforeRows = rows(), beforeMetadata = metadata();
  const priorBody = sql("select md5(prosrc) from pg_proc where oid='public.tenops_account_preferences_valid(jsonb)'::regprocedure;");
  const fault = migration.replace('commit;', "do $$begin raise exception 'simulated postcondition failure'; end$$; commit;");
  assert.match(sql(fault, true), /simulated postcondition failure/);
  assert.equal(sql("select md5(prosrc) from pg_proc where oid='public.tenops_account_preferences_valid(jsonb)'::regprocedure;"), priorBody);
  assert.equal(rows(), beforeRows); assert.equal(metadata(), beforeMetadata);
  sql('alter function public.tenops_account_preferences_valid(jsonb) stable;');
  assert.match(sql(migration, true), /validator drift/);
  assert.equal(rows(), beforeRows);
  sql('alter function public.tenops_account_preferences_valid(jsonb) immutable;');
  sql(migration);
  assert.equal(metadata(), beforeMetadata, 'Owner, grants, OID and security attributes preserved');
  assert.equal(rows(), beforeRows, 'Migration never rewrites historical preference rows');
  assert.match(sql(migration, true), /validator drift/, 'Accidental repeat fails closed');

  const cases = {
    appearance: ['light','dark','wrong',null,true],
    language: ['en','es','fr',null,4],
    display_size: ['compact','default','large','wrong',null],
    production_view: ['overview','table','timeline','wrong'],
    production_arrangement: ['stage','deadline','labor','wrong'],
    timeline_zoom: ['days','weeks','months','year','wrong'],
    timeline_row_density: ['compact','standard','comfortable','wrong'],
    collapsed_phase_display: ['compact','fill','wrong'],
    production_table_hidden_columns: [[],['customer','labor'],['customer','customer'],['wrong'],null,{}],
    transmittal_sender: [{},{name:'Fixture',phone:'555',email:'fixture@example.invalid'},{other:'bad'},{name:1},{name:'x'.repeat(241)}],
    unsupported: [true,false,{},null],
  };
  const json = value => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
  let count = 0;
  for (const [key, values] of Object.entries(cases)) for (const value of values) {
    const input = json({ [key]: value }); count++;
    assert.equal(sql(`select public.tenops_account_preferences_valid(${input}) = public.verify_prior_preferences(${input});`), 't');
  }
  for (const value of [true,false]) assert.equal(sql(`select public.tenops_account_preferences_valid(${json({manpower_recent_labor_expanded:value})});`),'t');
  for (const value of [null,'true','false',0,1,[],{}]) assert.equal(sql(`select public.tenops_account_preferences_valid(${json({manpower_recent_labor_expanded:value})});`),'f');
  const asUser = (id, body) => `set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-${id}'; ${body}`;
  sql(asUser('000000000001', "select public.set_my_account_preference('manpower_recent_labor_expanded','true');"));
  assert.match(sql(asUser('000000000001', 'select public.get_my_account_preferences();')), /"manpower_recent_labor_expanded": true/);
  assert.ok(sql(asUser('000000000002', 'select public.get_my_account_preferences();')).endsWith('{}'));
  sql(asUser('000000000002', "select public.set_my_account_preference('manpower_recent_labor_expanded','false');"));
  assert.match(sql(asUser('000000000001', 'select public.get_my_account_preferences();')), /"manpower_recent_labor_expanded": true/);
  sql(asUser('000000000001', "select public.set_my_account_preference('manpower_recent_labor_expanded','false');"));
  assert.match(sql(asUser('000000000001', 'select public.get_my_account_preferences();')), /"manpower_recent_labor_expanded": false/);
  assert.match(sql(asUser('000000000001', "select public.set_my_account_preference('manpower_recent_labor_expanded','1');"), true), /Unsupported TenOps account preference/);
  assert.match(sql(asUser('000000000003', "select public.set_my_account_preference('manpower_recent_labor_expanded','true');"), true), /active TenOps account/);
  assert.match(sql('set role anon; select public.get_my_account_preferences();', true), /permission denied/);
  assert.match(sql(asUser('000000000001', 'select * from account_user_preferences;'), true), /permission denied/);
  assert.match(sql(asUser('000000000001', "update account_user_preferences set preferences='{}';"), true), /permission denied/);
  sql("set role service_role; select count(*) from account_user_preferences;");
  console.log(JSON.stringify({ result: 'PASS', priorContractCases: count, newBooleanCases: 9, accountIsolation: 'PASS', historicalRows: 'unchanged by migration', metadata: 'unchanged', rollback: 'transaction fault rolled back', guard: 'drift/repeat rejected', sha256: createHash('sha256').update(migration).digest('hex') }, null, 2));
} finally {
  spawnSync('docker', ['stop', name], { stdio: 'pipe' });
}
