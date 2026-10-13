// Explicit fresh local resources only. Never resets/stops/reuses an existing environment.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const project = 'tenops-label-permission-review', directory = path.resolve('.tmp-label-permission-validation');
const containers = ['tenops-label-permission-db', 'tenops-label-permission-auth', 'tenops-label-permission-rest'];
const volume = 'tenops_label_permission_review_db', network = 'tenops_label_permission_review_network';
const images = {
  db: 'sha256:9f64a845786d2e5f6cf41610e0cacc1d287d33267806b0db89294ece1a4248e4',
  auth: 'sha256:57eefe69e701e2d6639ad640bebe3e4128bb71cd0bbfd7e04551e9756ea6c193',
  rest: 'sha256:fcb9fa67dd53b3b978b52ef07fb195d4bb26434c2e8cba8c96ef257abf2ee753',
};
if (!process.argv.includes('--create')) throw new Error('Review the isolation plan, then explicitly pass --create.');
function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Local Docker command failed (${args[0]}): ${result.stderr}`);
  return result.stdout.trim();
}
const resume = (process.argv.includes('--resume-auth-start') || process.argv.includes('--resume-migrations'));
const names = docker(['ps', '-a', '--format', '{{.Names}}']).split('\n');
if (!resume) {
assert.ok(containers.every(name => !names.includes(name)), 'A proposed container name already exists; refusing to reuse or replace it.');
assert.ok(!docker(['volume', 'ls', '--format', '{{.Name}}']).split('\n').includes(volume), 'Proposed volume already exists.');
assert.ok(!docker(['network', 'ls', '--format', '{{.Name}}']).split('\n').includes(network), 'Proposed network already exists.');
assert.ok(!existsSync(directory), 'Proposed local configuration directory already exists.');
assert.ok(!existsSync('/private/tmp/tenops-sample-label-permission-build'), 'Proposed isolated build directory already exists.');
for (const port of [4318, 55582, 55583, 55584]) for (const host of ['127.0.0.1', '::1']) {
  await new Promise((resolve, reject) => { const server = net.createServer(); server.once('error', reject); server.listen(port, host, () => server.close(resolve)); });
}
for (const image of Object.values(images)) docker(['image', 'inspect', image, '--format', '{{.Id}}']);
}
const existing = docker(['ps', '-a', '--format', '{{.ID}} {{.Names}} {{.Status}}']);
if (!resume) mkdirSync(directory, { mode: 0o700 });
const savedEnv = resume ? readFileSync(path.join(directory, 'docker.env'), 'utf8') : '';
const password = resume ? savedEnv.match(/POSTGRES_PASSWORD=(.+)/)[1] : randomBytes(24).toString('hex'), secret = resume ? savedEnv.match(/JWT_SECRET=(.+)/)[1] : randomBytes(32).toString('hex');
if (resume) for (const name of containers) assert.equal(docker(['inspect', name, '--format', '{{index .Config.Labels "com.docker.compose.project"}}']), project);
if (resume) assert.ok(!existsSync(path.join(directory, 'config.json')), 'Completed setup cannot be resumed.');
const jwt = role => {
  const part = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const payload = `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ iss: 'supabase', role, iat: Math.floor(Date.now() / 1000), exp: 4102444800 })}`;
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
};
const cfg = { project, directory, containers, volume, network, images, appOrigin: 'http://localhost:4318', authOrigin: 'http://127.0.0.1:55583', restOrigin: 'http://127.0.0.1:55584', anonKey: jwt('anon'), serviceKey: jwt('service_role'), actors: {} };
writeFileSync(path.join(directory, 'docker.env'), `POSTGRES_PASSWORD=${password}\nJWT_SECRET=${secret}\n`, { mode: 0o600 });
if (!resume) writeFileSync(path.join(directory, 'existing-resources-before.txt'), existing + '\n');
const compose = `name: ${project}
services:
  db:
    image: ${images.db}
    pull_policy: never
    container_name: ${containers[0]}
    environment:
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      POSTGRES_DB: postgres
    ports: ["127.0.0.1:55582:5432"]
    volumes: ["db:/var/lib/postgresql/data"]
    networks: [review]
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "postgres"]
      interval: 1s
      timeout: 5s
      retries: 60
  auth:
    image: ${images.auth}
    pull_policy: never
    container_name: ${containers[1]}
    depends_on:
      db: {condition: service_healthy}
    environment:
      API_EXTERNAL_URL: http://localhost:4318
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: "9999"
      GOTRUE_SITE_URL: http://localhost:4318
      GOTRUE_URI_ALLOW_LIST: http://localhost:4318/**
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://supabase_admin:\${POSTGRES_PASSWORD}@${containers[0]}:5432/postgres?search_path=auth
      GOTRUE_JWT_SECRET: \${JWT_SECRET}
      GOTRUE_JWT_EXP: "3600"
      GOTRUE_JWT_AUD: authenticated
      GOTRUE_JWT_ADMIN_ROLES: service_role
      GOTRUE_JWT_DEFAULT_GROUP_NAME: authenticated
      GOTRUE_DISABLE_SIGNUP: "true"
      GOTRUE_EXTERNAL_EMAIL_ENABLED: "true"
      GOTRUE_MAILER_AUTOCONFIRM: "true"
      GOTRUE_LOG_LEVEL: warn
    ports: ["127.0.0.1:55583:9999"]
    networks: [review]
  rest:
    image: ${images.rest}
    pull_policy: never
    container_name: ${containers[2]}
    depends_on:
      db: {condition: service_healthy}
    environment:
      PGRST_DB_URI: postgres://postgres:\${POSTGRES_PASSWORD}@${containers[0]}:5432/postgres
      PGRST_DB_SCHEMAS: public
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: \${JWT_SECRET}
      PGRST_SERVER_PORT: "3000"
    ports: ["127.0.0.1:55584:3000"]
    networks: [review]
volumes:
  db:
    name: ${volume}
networks:
  review:
    name: ${network}
`;
const composePath = path.join(directory, 'compose.yaml'); writeFileSync(composePath, compose);
if (!resume) docker(['compose', '-p', project, '--env-file', path.join(directory, 'docker.env'), '-f', composePath, 'up', '-d', '--wait', 'db']);
docker(['exec', '-i', containers[0], 'psql', '-X', '-qAt', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], `alter role supabase_admin password '${password}';`);
docker(['compose', '-p', project, '--env-file', path.join(directory, 'docker.env'), '-f', composePath, 'up', '-d', '--pull', 'never']);
const sql = statement => docker(['exec', '-i', containers[0], 'psql', '-X', '-qAt', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], statement);
for (let attempt = 0; attempt < 60; attempt++) {
  try { if ((await fetch(cfg.authOrigin + '/health')).ok) break; } catch { /* New local Auth still starting. */ }
  if (attempt === 59) throw new Error('New local Auth did not become ready. No existing environment will be changed.');
  await new Promise(resolve => setTimeout(resolve, 1000));
}
// Empty ancillary fixtures needed by the canonical Sample/read-only migrations.
// No Sample table, permission policy or Auth function is approximated here.
sql(`create table if not exists public.jobs(id uuid primary key,name text,customer text,job_number text);
create table if not exists public.bids(id uuid primary key,customer text,project_name text);
create table if not exists public.job_updates(id uuid primary key,job_id uuid,created_at timestamptz,requires_follow_up boolean,resolved_at timestamptz,body text,author_name text,follow_up_assignee_name text,resolved_by_name text);
create table if not exists public.job_activity(id uuid primary key);
create table if not exists public.production_rework_cycles(id uuid primary key);
create schema if not exists realtime;
create table if not exists realtime.messages(id bigint primary key);
alter table realtime.messages enable row level security;
create schema if not exists storage;
create table if not exists storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table if not exists storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
create table if not exists public.my_work_messages(id uuid primary key,sender_user_id uuid,recipient_user_id uuid,read_at timestamptz);
create table if not exists public.my_work_message_attachments(id uuid primary key);
create table if not exists public.my_work_message_versions(id uuid primary key);
create table if not exists public.my_work_attachment_previews(id uuid primary key);
create table if not exists public.account_notifications(id uuid primary key,user_id uuid,notification_type text,metadata jsonb default '{}',read_at timestamptz);
grant usage on schema public,auth to authenticated,service_role;
grant all on all tables in schema public to service_role;`);
const migrations = JSON.parse(readFileSync('scripts/support/label-permission-migrations.json', 'utf8'));
assert.equal(migrations.at(-1), '20261013180000_sample_label_capability.sql');
assert.ok(migrations.every(file => !file.includes('DO_NOT_APPLY')));
const sampleSecurity = () => sql(`select jsonb_build_object('policies',(select jsonb_agg(to_jsonb(p) order by tablename,policyname) from pg_policies p where schemaname='public' and tablename in ('samples','sample_blend_rows','sample_working_versions','sample_issued_documents')),'grants',(select jsonb_agg(jsonb_build_array(c.relname,c.relacl::text) order by c.relname) from pg_class c where c.oid in ('public.samples'::regclass,'public.sample_blend_rows'::regclass,'public.sample_working_versions'::regclass,'public.sample_issued_documents'::regclass)))`);
const progressPath = path.join(directory, 'migration-progress.json');
const completed = existsSync(progressPath) ? JSON.parse(readFileSync(progressPath, 'utf8')) : [];
for (const file of migrations.slice(0, -1)) if (!completed.includes(file)) { sql(readFileSync('supabase/migrations/' + file, 'utf8')); completed.push(file); writeFileSync(progressPath, JSON.stringify(completed)); }
const before = sampleSecurity();
writeFileSync(path.join(directory, 'sample-security-before.json'), before + '\n');
sql(readFileSync('supabase/migrations/' + migrations.at(-1), 'utf8'));
assert.equal(sampleSecurity(), before, 'Label migration changed existing Sample policies/grants');
const routeFetch = (url, options) => {
  const request = new URL(url);
  assert.equal(request.origin, cfg.appOrigin);
  if (request.pathname.startsWith('/auth/v1/')) return fetch(cfg.authOrigin + request.pathname.slice('/auth/v1'.length) + request.search, options);
  if (request.pathname.startsWith('/rest/v1/')) return fetch(cfg.restOrigin + request.pathname.slice('/rest/v1'.length) + request.search, options);
  throw new Error('Unexpected local setup request');
};
const service = createClient(cfg.appOrigin, cfg.serviceKey, { global: { fetch: routeFetch }, auth: { persistSession: false, autoRefreshToken: false } });
for (const [name, role, readOnly, active] of [['admin', 'admin', false, true], ['member', 'member', false, true], ['outsider', 'member', false, true], ['support', 'guest', true, true], ['inactive', 'member', false, false]]) {
  const email = `label-${name}-${randomUUID()}@example.invalid`, actorPassword = randomBytes(24).toString('hex');
  const { data, error } = await service.auth.admin.createUser({ email, password: actorPassword, email_confirm: true }); assert.ifError(error);
  const displayName = `Label Permission ${name}`;
  const profile = await service.from('app_users').insert({ user_id: data.user.id, display_name: displayName, role, is_active: active, read_only: readOnly, messaging_write: false, production_blend_manage: false }); assert.ifError(profile.error);
  cfg.actors[name] = { id: data.user.id, email, password: actorPassword, displayName, role };
}
const member = createClient(cfg.appOrigin, cfg.anonKey, { global: { fetch: routeFetch }, auth: { persistSession: false, autoRefreshToken: false } });
assert.ifError((await member.auth.signInWithPassword(cfg.actors.member)).error);
const created = await member.rpc('create_sample'); assert.ifError(created.error); cfg.sampleId = created.data;
const source = JSON.parse(readFileSync('/private/tmp/tenops-dymo-print-test-packet/fixtures/samples.json', 'utf8'))[0].sample;
const fields = ['project_name', 'requested_by', 'requested_date', 'prepared_by', 'customer_name', 'color_plate_number', 'finish_requested', 'sealer', 'resin_supplier', 'resin_color_number', 'approved_date', 'sample_size', 'sample_quantity', 'formulation_state'];
assert.ifError((await service.from('samples').update(Object.fromEntries(fields.map(key => [key, source[key]]))).eq('id', cfg.sampleId)).error);
assert.ifError((await service.from('sample_blend_rows').delete().eq('sample_id', cfg.sampleId)).error);
const rows = source.blend_rows.map(row => { const copy = { ...row, id: randomUUID(), sample_id: cfg.sampleId }; delete copy.created_at; delete copy.updated_at; return copy; });
assert.ifError((await service.from('sample_blend_rows').insert(rows)).error);
writeFileSync(path.join(directory, 'config.json'), JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
writeFileSync(path.join(directory, 'migration-files.json'), JSON.stringify(migrations, null, 2) + '\n');
console.log('Prepared only the new isolated local project. Real Auth fixtures, canonical Sample/RBAC contracts and label migration ready; existing Sample policies/grants unchanged. Credentials remain in ignored mode-0600 config.json.');
