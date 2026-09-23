// Restores the read-only Production capture. No network/hosted database operations.
// Usage: node scripts/verify-po-reservation-allocations.mjs --capture-dir=/private/tmp/tenops-po-sample-production-gate-20260923
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const capture = arg('capture-dir');
if (!capture) throw Error('Supply --capture-dir containing the read-only Production public-schema.sql, ledger.json and config-data.json. Generic schema fixtures are not sufficient.');
const output = resolve(arg('output-dir') ?? '/tmp/tenops-po-sample-corrected-replay');
mkdirSync(output, { recursive: true });
const read = path => readFileSync(path, 'utf8');
const schema = read(join(capture, 'public-schema.sql'));
const schemaHash = createHash('sha256').update(readFileSync(join(capture, 'public-schema.sql'))).digest('hex');
if (schemaHash !== 'e91deb23931cf7cfafc64c73ec77a03805b9afa137a94b1c597a0a8920b68746') throw Error('Capture changed: independently review before updating the expected schema fingerprint.');
const files = ['20260923160000_sample_operational_profiles.sql', '20260923160100_po_reservation_allocations.sql', '20260923160200_partial_pending_receipts.sql'];
const versions = files.map(f => f.split('_')[0]);
if (versions.some(v => readdirSync('supabase/migrations').filter(f => f.startsWith(v + '_')).length !== 1)) throw Error('Repository migration version collision.');
const ledger = JSON.parse(read(join(capture, 'ledger.json'))).rows;
if (new Set(versions).size !== 3 || versions.some(v => !/^\d{14}$/.test(v) || v === '20260922' || ledger.some(r => r.version === v)) || versions.join() !== [...versions].sort().join()) throw Error('Migration identity collision/order failure.');
const migrations = files.map(f => read(`supabase/migrations/${f}`));
const hashes = migrations.map(s => createHash('sha256').update(s).digest('hex'));
if (hashes[0] !== '0fce994d5086b37c36cda085c5623767c8688b71862336e1f4cf9840d6120d0e') throw Error('Sample migration changed beyond its filename.');
const name = `tenops-po-sample-corrected-${process.pid}`;
const outcomes = [];
function run(args, input, allowError = false) {
 const r = spawnSync('docker', args, { input, encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });
 if (r.status && !allowError) throw Error(r.stderr.slice(-5000));
 return r;
}
const psql = db => ['exec', '-i', name, 'psql', '-X', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-At'];
const sql = (db, input) => run(psql(db), input).stdout;
const record = message => { outcomes.push(message); console.log(message); };
const bootstrap = `create role anon;create role authenticated;create role service_role bypassrls;create role supabase_admin;create role supabase_auth_admin;create role supabase_storage_admin;create role authenticator;
create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'authenticated')$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
grant usage on schema auth to authenticated,anon,service_role;create schema extensions;create extension pgcrypto with schema extensions;create extension pg_trgm with schema extensions;`;
const admin = '00000000-0000-4000-8000-000000000001', member = '00000000-0000-4000-8000-000000000002', guest = '00000000-0000-4000-8000-000000000003';
const seed = `insert into auth.users(id) values('${admin}'),('${member}'),('${guest}'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000010'),('00000000-0000-0000-0000-000000000011');
insert into app_users(user_id,display_name,role,is_active) values('${admin}','TEST Admin','admin',true),('${member}','TEST Member','member',true),('${guest}','TEST Guest','guest',true),('00000000-0000-0000-0000-000000000002','TEST Sample Member','member',true);
insert into jobs(id,name,job_number) values('10000000-0000-4000-8000-000000000001','TEST A','26-9001'),('10000000-0000-4000-8000-000000000002','TEST B','26-9002');`;
const configTables = { capabilities: 'app_role_capabilities', profiles: 'sample_formulation_profiles', defaults: 'sample_formulation_defaults' };
const config = JSON.parse(read(join(capture, 'config-data.json'))).rows.map(r => {
 const table = configTables[r.kind]; if (!table) throw Error('Unknown configuration capture');
 return `insert into public.${table} overriding system value select * from jsonb_populate_recordset(null::public.${table},'${JSON.stringify(r.rows).replaceAll("'", "''")}'::jsonb);`;
}).join('\n');
const [poBefore, poAfter] = read('scripts/fixtures/po-reservation-lifecycle.sql').split('-- AFTER MIGRATIONS');
// Reuse existing trusted repository SQL assertions; do not replay their simplified schema bootstrap.
const sampleSource = read('scripts/verify-sample-mass-balance-migration.mjs').replace(/^import .*;\n/gm, '').split('function run(args, input)')[0];
const sampleTests = new Function('readFileSync', `${sampleSource};return tests;`)(readFileSync).replace('create temp table ids', 'create table sample_test_ids').replaceAll('from ids where', 'from sample_test_ids where').replaceAll('insert into ids ', 'insert into sample_test_ids ');
const managedTests = read('scripts/fixtures/sample-operational-profiles.sql').replace('insert into public.app_users values', 'insert into public.app_users(user_id,display_name,role,is_active) values').replaceAll('from ids where', 'from sample_test_ids where');
const protectedTables = ['app_role_capabilities', 'purchase_orders', 'purchase_order_lines', 'chip_purchase_order_line_details', 'purchase_order_issuances', 'purchase_order_documents', 'pending_receivals', 'inventory_items', 'inventory_transactions', 'samples', 'sample_blend_rows', 'sample_working_versions', 'sample_issued_documents', 'sample_formulation_profiles', 'sample_formulation_defaults'];
const wrapperMetadata = () => sql('postgres', `select jsonb_agg(jsonb_build_object('identity',p.oid::regprocedure::text,'language',l.lanname,'kind',p.prokind,'security',p.prosecdef,'strict',p.proisstrict,'volatility',p.provolatile,'parallel',p.proparallel,'leakproof',p.proleakproof,'cost',p.procost,'rows',p.prorows,'config',p.proconfig,'owner',pg_get_userbyid(p.proowner),'acl',(select jsonb_agg(to_jsonb(a) order by a.grantee,a.grantor,a.privilege_type) from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)) order by p.proname) from pg_proc p join pg_language l on l.oid=p.prolang where p.oid in('public.create_pending_receivals_from_purchase_order(uuid,jsonb,text)'::regprocedure,'public.receive_pending_receival_with_reservation(uuid,text)'::regprocedure,'public.undo_pending_receival_receipt(uuid,text,text)'::regprocedure);`);
const digest = () => sql('postgres', protectedTables.map(t => `select '${t}',count(*),encode(extensions.digest(coalesce(string_agg(row_hash,'' order by row_hash),''),'sha256'),'hex') from (select encode(extensions.digest((to_jsonb(t)-'source_allocation_key')::text,'sha256'),'hex') row_hash from public.${t} t) s`).join(';') + ';');
try {
 run(['run', '--rm', '-d', '--name', name, '-e', 'POSTGRES_PASSWORD=local-only', 'postgres:17.6']);
 for (let i = 0; i < 60; i++) { if (!spawnSync('docker', ['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']).status) break; if (i === 59) throw Error('PostgreSQL readiness timeout'); await new Promise(r => setTimeout(r, 250)); }
 sql('postgres', bootstrap + schema);
 run(['exec', name, 'createdb', '-U', 'postgres', '-T', 'postgres', 'captured_baseline']);
 sql('postgres', seed + config + poBefore);
 sql('postgres', sampleTests);
 const before = digest();
 const originalWrapperMetadata = wrapperMetadata();
 const sampleFunctionBaseline = sql('postgres', "create table sample_function_baseline as select oid,pg_get_functiondef(oid) definition from pg_proc where pronamespace='public'::regnamespace and proname like '%sample%'; select count(*) from sample_function_baseline;").trim();
 for (let i = 0; i < migrations.length; i++) sql('postgres', migrations[i]);
 if (digest() !== before) throw Error('Protected original-column data changed during migration');
 if (wrapperMetadata() !== originalWrapperMetadata) throw Error('Existing public wrapper attributes/ACLs changed');
 sql('postgres', "do $$begin if exists(select 1 from sample_function_baseline where definition is distinct from pg_get_functiondef(oid)) then raise exception 'Historical Sample function dispatch changed';end if;end$$;");
 record(`PASS: ${sampleFunctionBaseline.split('\n').at(-1)} existing Sample functions unchanged, including historical dispatch.`);
 writeFileSync(join(output, 'synthetic-before-after.txt'), before);
 record('PASS: unique ordered versions; exact captured schema; all migrations succeed; original-column historical digests unchanged.');
 sql('postgres', poAfter);
 record('PASS: PO save/reopen, caps, immutable issuance, multi-Job/remainder projection, partial/full receiving, retries, over-receipt rejection, undo, cancellation, provenance, authorization.');
 sql('postgres', "select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);" + managedTests);
 record('PASS: managed Sample profile lifecycle, member/inactive denial, version/restore/issuance and historical capture preservation.');
 sql('postgres', read('scripts/fixtures/po-receipt-compatibility.sql'));
 record('PASS: service-role projection/receipt/undo with no app-user identity; ordinary role matrix; quantity-based pending visibility; guarded undo and general-stock partial receipts.');
 const rid = '40000000-0000-4000-8000-000000000001', request = '50000000-0000-4000-8000-000000000001';
 sql('postgres', `insert into pending_receivals(id,material_name,quantity_expected,unit,production_job_id,is_earmarked) values('${rid}','TEST concurrent',10,'lb','10000000-0000-4000-8000-000000000001',true);`);
 const concurrentSql = `begin;set role authenticated;select set_config('request.jwt.claim.sub','${member}',true);select receive_pending_receival_quantity('${rid}','TEST Member',3,'${request}');select pg_sleep(.1);commit;`;
 const session = () => new Promise((resolve, reject) => { const child = spawn('docker', psql('postgres')); let error = ''; child.stdout.on('data', () => {}); child.stderr.on('data', c => error += c); child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(Error(error))); child.stdin.end(concurrentSql); });
 await Promise.all([session(), session()]);
 sql('postgres', `do $$begin if(select quantity_received from pending_receivals where id='${rid}')<>3 or(select status from pending_receivals where id='${rid}')<>'pending' or(select count(*) from inventory_transactions where pending_receival_id='${rid}')<>1 then raise exception 'Concurrent receipt duplicated or hid pending inventory';end if;end$$;`);
 record('PASS: simultaneous identical receipt requests create one Inventory transaction.');
 const drifts = [
  [1, 'projection_body', `create or replace function public.create_pending_receivals_from_purchase_order(p_issuance_id uuid,p_lines jsonb,p_actor text) returns table(pending_receival_id uuid,source_line_id uuid,source_line_number integer,creation_status text) language plpgsql security definer set search_path=pg_catalog,public as $$begin raise exception 'new Production behavior';end$$;`],
  [1, 'projection_impl', `alter function public.tenops_create_pending_receivals_from_po_impl(uuid,jsonb,text) security invoker;`],
  [1, 'projection_acl', `grant execute on function public.create_pending_receivals_from_purchase_order(uuid,jsonb,text) to anon;`],
  [1, 'index', `drop index public.pending_receivals_purchase_order_source_uidx;create unique index pending_receivals_purchase_order_source_uidx on public.pending_receivals(source_purchase_order_issuance_id,source_purchase_order_line_id) where source_purchase_order_issuance_id is not null and source_purchase_order_line_id is not null and quantity_expected>0;`],
  [2, 'receive_body', `create or replace function public.receive_pending_receival_with_reservation(p_receival_id uuid,p_received_by text) returns void language plpgsql security definer set search_path=pg_catalog,public as $$begin raise exception 'new Production behavior';end$$;`],
  [2, 'undo_body', `create or replace function public.undo_pending_receival_receipt(p_receival_id uuid,p_actor text,p_reason text default null) returns void language plpgsql security definer set search_path=pg_catalog,public as $$begin raise exception 'new Production behavior';end$$;`],
  [2, 'receive_impl', `alter function public.tenops_receive_pending_receival_impl(uuid,text) set search_path=public;`],
  [2, 'undo_impl', `alter function public.tenops_undo_pending_receival_impl(uuid,text,text) security invoker;`],
  [2, 'receive_acl', `grant execute on function public.receive_pending_receival_with_reservation(uuid,text) to anon;`],
  [2, 'status_constraint', `alter table public.pending_receivals drop constraint pending_receivals_status_check;alter table public.pending_receivals add constraint pending_receivals_status_check check(status in('pending','received','cancelled','cleared','partially_received'));`],
 ];
 for (const [index, label, mutation] of drifts) {
  const db = `drift_${label}`; run(['exec', name, 'createdb', '-U', 'postgres', '-T', 'captured_baseline', db]);
  for (let i = 0; i < index; i++) sql(db, migrations[i]);
  sql(db, mutation);
  const r = run(psql(db), migrations[index], true);
  if (!r.status || !/Production (function|index|status constraint) drift/.test(r.stderr)) throw Error(`Drift guard failed: ${label}: ${r.stderr}`);
  const object = index === 1 ? 'purchase_order_line_allocations' : 'pending_receival_receipt_batches';
  if (sql(db, `select to_regclass('public.${object}') is null;`).trim() !== 't') throw Error(`Drift mutation was not atomic: ${label}`);
  run(['exec', name, 'dropdb', '-U', 'postgres', db]);
 }
 record(`PASS: ${drifts.length} altered-definition/security/search_path/grant/index/constraint cases fail closed before migration changes.`);
 writeFileSync(join(output, 'result.json'), JSON.stringify({ schemaHash, migrations: files.map((file, i) => ({ file, sha256: hashes[i] })), outcomes }, null, 2));
} finally { spawnSync('docker', ['stop', name], { stdio: 'ignore' }); }
