import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
const name = `tenops-product-labor-${process.pid}`;
const read = (path) => readFileSync(path, 'utf8');
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const roles = ['guest', 'member', 'developer', 'lead', 'admin', 'inactive'];
const contractFlag = process.argv.indexOf('--hosted-contract');
const hostedContract = contractFlag < 0 ? null : JSON.parse(read(process.argv[contractFlag + 1])).gate;
const ident = (value) => `"${value.replaceAll('"', '""')}"`;
const captureIntegrity = () => {
  const output = sql(read('supabase/inspection/20260921_001_manpower_product_categories_gate.sql'));
  return JSON.parse(output.split('\n').find(line => line.trimStart().startsWith('{')));
};
function run(args, input) { const r = spawnSync('docker', args, { input, encoding: 'utf8' }); if(r.status !== 0) throw new Error(`${r.stdout}\n${r.stderr}`); return r.stdout; }
const args = ['exec', '-i', name, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'];
const sql = (query) => run(args, query);
const asUser = (index, query) => `set role authenticated; select set_config('request.jwt.claim.sub','${id(index + 1)}',false); ${query} reset role;`;
const insert = (product, entryId = 110) => `insert into public.manpower_entries(id,work_date,worker_id,task_id,job_id,rework_cycle_id,reporting_group_id,am_hours,pm_hours,product_category_id) values('${id(entryId)}','2026-09-21','${id(100)}','${id(101)}','${id(102)}','${id(103)}','${id(104)}',2,3,${product})`;
const fail = (statement, code) => `select test_expect_error($test$${statement}$test$,'${code}');`;
try {
  run(['run','--rm','-d','--name',name,'-p','127.0.0.1::3000','-e','POSTGRES_PASSWORD=postgres','postgres:17.6']);
  for(let i=0;i<60;i++){ if(spawnSync('docker',['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']).status === 0) break; await new Promise(r=>setTimeout(r,250)); if(i===59) throw new Error('Database did not start'); }
  sql(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
grant usage on schema public,auth to anon,authenticated,service_role;
create table public.app_users(user_id uuid primary key,display_name text,role text,is_active boolean);
create table public.app_role_capabilities(role text,capability text,primary key(role,capability));
${roles.map((r,i)=>`insert into app_users values('${id(i+1)}','${r}','${r==='inactive'?'lead':r}',${r!=='inactive'});`).join('\n')}
insert into app_role_capabilities select role,'readOperationalData' from app_users group by role;
create function public.has_app_capability(p_capability text) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from app_users u join app_role_capabilities c on c.role=u.role where u.user_id=auth.uid() and u.is_active and c.capability=p_capability)$$;
create function public.require_app_capability(p_capability text) returns void language plpgsql security definer as $$begin if not public.has_app_capability(p_capability) then raise exception 'denied' using errcode='42501';end if;end$$;
create table public.jobs(id uuid primary key); insert into jobs values('${id(102)}');
create table public.production_rework_cycles(id uuid primary key,job_id uuid references jobs(id)); insert into production_rework_cycles values('${id(103)}','${id(102)}');
create function public.test_assert(value boolean,msg text) returns void language plpgsql as $$begin if value is distinct from true then raise exception 'ASSERT: %',msg;end if;end$$;
create function public.test_expect_error(statement text,code text) returns void language plpgsql as $$begin begin execute statement; exception when others then if sqlstate=code then return;else raise;end if;end;raise exception 'Expected SQLSTATE % for %',code,statement;end$$;`);
  sql(read('supabase/migrations/20260714_001_manpower_reporting_mvp.sql') + read('supabase/migrations/20260714_002_manpower_reporting_groups_and_import_correction.sql') + read('supabase/migrations/20260714_003_normalize_manpower_reference_order.sql') + read('supabase/migrations/20260824_002_manpower_rework_attribution.sql'));
  sql(`insert into manpower_workers(id,display_name,sort_order) values('${id(100)}','Test worker',1); insert into manpower_tasks(id,display_name,sort_order) values('${id(101)}','Test task',1);insert into manpower_reporting_groups(id,display_name) values('${id(104)}','Test group');
insert into manpower_entries(id,work_date,worker_id,task_id,job_id,reporting_group_id,am_hours,pm_hours) values('${id(105)}','2026-09-17','${id(100)}','${id(101)}','${id(102)}','${id(104)}',4,2);`);
  sql(read('supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql').split('-- Manpower reporting')[1].replace(/^[\s\S]*?drop policy/, 'drop policy').replace(/commit;\s*$/, ''));
  sql(`grant select,insert,update,delete on manpower_entries to anon,authenticated;`);
  if (hostedContract) {
    assert.equal(hostedContract.server_version, '17.6');
    assert.equal(hostedContract.category_table, null, 'contract must precede migration');
    // Replay only reviewed captured authorization/schema metadata into disposable fixtures.
    // Never copy hosted people or business rows; this is not a hosted mutation test.
    for (const fn of hostedContract.functions.filter(f => ['auth.uid', 'public.has_app_capability', 'public.require_app_capability', 'public.set_manpower_updated_at'].includes(f.name))) {
      sql(fn.definition);
      if (fn.name !== 'auth.uid') {
        const signature = fn.name + (fn.name.includes('capability') ? '(text)' : '()');
        sql(`revoke all on function ${signature} from public,anon,authenticated,service_role;`);
        for (const acl of fn.acl ?? []) {
          const [grantee, privileges] = acl.split('=');
          if (privileges.startsWith('X')) sql(`grant execute on function ${signature} to ${grantee ? ident(grantee) : 'public'};`);
        }
      }
    }
    const tables = [...new Set(hostedContract.rls.map(t => t.table))];
    for (const table of tables) {
      sql(`do $$declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='${table}' loop execute format('drop policy %I on public.%I',p.policyname,'${table}'); end loop; end$$;`);
      sql(`alter table public.${ident(table)} enable row level security; revoke all on public.${ident(table)} from public,anon,authenticated,service_role;`);
    }
    for (const policy of hostedContract.policies) {
      sql(`create policy ${ident(policy.policyname)} on public.${ident(policy.tablename)} as ${policy.permissive} for ${policy.cmd} to ${policy.roles.map(ident).join(',')}${policy.qual ? ` using (${policy.qual})` : ''}${policy.with_check ? ` with check (${policy.with_check})` : ''};`);
    }
    for (const grant of hostedContract.grants) sql(`grant ${grant.privilege} on public.${ident(grant.table)} to ${ident(grant.role)};`);
    // Existing labor columns/constraints must agree with the installed contract.
    const local = captureIntegrity();
    const labor = value => value.table.startsWith('manpower_');
    const columnShape = values => values.filter(labor).map(({table,name,type,nullable,precision,scale}) => ({table,name,type,nullable,precision,scale}));
    assert.deepEqual(columnShape(local.columns), columnShape(hostedContract.columns), 'installed labor column shape');
    assert.deepEqual(local.constraints.filter(labor), hostedContract.constraints.filter(labor), 'installed labor constraints');
    assert.deepEqual(local.policies, hostedContract.policies, 'installed RLS policies');
    assert.deepEqual(local.grants, hostedContract.grants, 'installed grants');
    assert.deepEqual(local.role_caps, hostedContract.role_caps, 'installed operational capabilities');
    console.log('Captured hosted labor columns/constraints, policies, grants, and capability contract matched in local replay.');
  }
  const beforeMigration = captureIntegrity();
  sql(read('supabase/migrations/20260921_001_manpower_product_categories.sql'));
  const afterMigration = captureIntegrity();
  assert.equal(afterMigration.integrity_sha256, beforeMigration.integrity_sha256, 'migration preserves every existing protected row field');
  assert.equal(afterMigration.reporting_sha256, beforeMigration.reporting_sha256, 'migration preserves reporting dimensions and sums');
  assert.deepEqual(afterMigration.historical_entry_manifest, beforeMigration.historical_entry_manifest);
  assert.equal(afterMigration.counts.classified_entries, 0, 'no historical classification');
  assert.equal(afterMigration.new_capability_rows, 2);
  console.log('Before/after migration SHA-256 equality passed for all fixture labor, Jobs, Tasks, Workers, Rework, groups and reporting.');
  const captureDir = mkdtempSync(join(tmpdir(), 'tenops-category-integrity-'));
  try {
    const beforePath = join(captureDir, 'before.json');
    const afterPath = join(captureDir, 'after.json');
    writeFileSync(beforePath, JSON.stringify(beforeMigration));
    writeFileSync(afterPath, JSON.stringify(afterMigration));
    const comparison = spawnSync(process.execPath, ['scripts/verify-manpower-product-category-integrity.mjs', beforePath, afterPath], { encoding: 'utf8' });
    assert.equal(comparison.status, 0, comparison.stderr);
    // A changed hour/updated_at/Job/etc. field must fail the release comparison.
    writeFileSync(afterPath, JSON.stringify({ ...afterMigration, integrity_sha256: 'changed' }));
    const rejected = spawnSync(process.execPath, ['scripts/verify-manpower-product-category-integrity.mjs', beforePath, afterPath], { encoding: 'utf8' });
    assert.notEqual(rejected.status, 0);
    console.log('Release integrity comparator accepts unchanged migration and rejects a changed protected digest.');
  } finally { rmSync(captureDir, { recursive: true }); }

  const slabs = sql("select id from manpower_product_categories where display_name='Slabs'").trim();
  const ref = `'${slabs}'`;
  sql(`select test_assert((select count(*)=6 from manpower_product_categories),'six editable categories');select test_assert((select product_category_id is null and am_hours+pm_hours=6 from manpower_entries where id='${id(105)}'),'history unchanged');`);
  sql(`set role anon; ${fail('select * from manpower_product_categories','42501')} ${fail("insert into manpower_product_categories(display_name,sort_order) values('bad',9)",'42501')} ${fail(insert(ref),'42501')} reset role;`);
  for(let i=0;i<roles.length;i++) {
    const canManage = ['lead','admin'].includes(roles[i]);
    sql(asUser(i, `select test_assert((select count(*)=${roles[i]==='inactive'?0:6} from manpower_product_categories),'category read matrix');`));
    if(!canManage) {
      sql(asUser(i, fail("insert into manpower_product_categories(display_name,sort_order) values('Forbidden',99)",'42501') + `with changed as(update manpower_product_categories set display_name='Forbidden' where id=${ref} returning id) select test_assert(count(*)=0,'update denied') from changed;`));
    } else {
      sql(asUser(i, `insert into manpower_product_categories(display_name,sort_order) values('Temporary ${roles[i]}',20); update manpower_product_categories set display_name='Renamed ${roles[i]}',sort_order=30 where display_name='Temporary ${roles[i]}'; update manpower_product_categories set is_active=false where display_name='Renamed ${roles[i]}'; update manpower_product_categories set is_active=true where display_name='Renamed ${roles[i]}'; select test_assert((select sort_order=30 and is_active and updated_by_user_id=auth.uid() from manpower_product_categories where display_name='Renamed ${roles[i]}'),'manage lifecycle');`));
      sql(`delete from manpower_product_categories where display_name='Renamed ${roles[i]}'`);
    }
    sql(asUser(i, fail('delete from manpower_product_categories','42501') + fail('truncate manpower_product_categories cascade','42501')));
  }
  sql(asUser(3, fail("insert into manpower_product_categories(display_name,sort_order) values(' SLABS ',2)",'23505') + fail("insert into manpower_product_categories(display_name,sort_order) values('Uncategorized',2)",'23514') + fail("insert into manpower_product_categories(display_name,sort_order) values(' ',2)",'23514') + fail("insert into manpower_product_categories(display_name,sort_order) values('Bad order',0)",'23514')));
  sql(asUser(1, fail(insert('null'),'23514') + `update manpower_entries set notes='Historical correction',am_hours=5 where id='${id(105)}'; select test_assert((select product_category_id is null from manpower_entries where id='${id(105)}'),'historical unrelated edit');` + insert(ref) + ';'));
  sql(`select test_assert((select job_id='${id(102)}' and rework_cycle_id='${id(103)}' and reporting_group_id='${id(104)}' and am_hours+pm_hours=5 from manpower_entries where id='${id(110)}'),'Job Rework group hours preserved');`);
  sql(asUser(3, `update manpower_product_categories set display_name='Slabs renamed',sort_order=8,is_active=false,created_by_user_id='${id(1)}',updated_by_user_id='${id(1)}' where id=${ref}; select test_assert((select created_by_user_id is null and updated_by_user_id=auth.uid() from manpower_product_categories where id=${ref}),'server audit prevents spoof');`));
  sql(asUser(1, `select test_assert((select c.display_name='Slabs renamed' from manpower_entries e join manpower_product_categories c on c.id=e.product_category_id where e.id='${id(110)}'),'historical rename');update manpower_entries set notes='Inactive historical correction' where id='${id(110)}';` + fail(insert(ref,111),'23514') + fail(`update manpower_entries set product_category_id=null where id='${id(110)}'`,'23514') + fail(`update manpower_entries set product_category_id=${ref} where id='${id(105)}'`,'23514')));
  sql(fail(`delete from manpower_product_categories where id=${ref}`,'23503'));
  sql(asUser(4,`update manpower_product_categories set is_active=true where id=${ref};`));
  sql(asUser(1, `update manpower_entries set product_category_id=${ref} where id='${id(105)}';`));
  sql(asUser(5, fail(insert(ref,112),'42501')));
  // Two real sessions: a pending deactivation holds the category lock before assignment.
  const holder = spawn('docker',args,{stdio:['pipe','pipe','pipe']});
  let holderOutput=''; let holderError='';
  holder.stdout.on('data', part=>holderOutput+=part); holder.stderr.on('data',part=>holderError+=part);
  const holderDone = new Promise((resolve,reject)=>holder.on('close',code=>code===0?resolve():reject(new Error(holderError))));
  holder.stdin.end(`begin; ${asUser(3,`update manpower_product_categories set is_active=false where id=${ref};`)} select 'category-locked'; select pg_sleep(1); commit;`);
  while(!holderOutput.includes('category-locked')) await new Promise(r=>setTimeout(r,25));
  const started=Date.now();
  sql(asUser(1,fail(insert(ref,113),'23514')));
  assert.ok(Date.now()-started > 400,'assignment should wait for deactivation lock');
  await holderDone;
  sql(`select test_assert(not exists(select 1 from manpower_entries where id='${id(113)}'),'racing assignment rejected');`);
  // Actual local PostgREST requests, with signed fixture JWTs and no browser gates.
  const secret='local-product-category-verifier-secret-at-least-32';
  run(['run','--rm','-d','--name',`${name}-rest`,'--network',`container:${name}`,
    '-e','PGRST_DB_URI=postgres://postgres:postgres@127.0.0.1:5432/postgres',
    '-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e',`PGRST_JWT_SECRET=${secret}`,
    'public.ecr.aws/supabase/postgrest:v14.15']);
  const port=run(['port',name,'3000/tcp']).trim().split(':').at(-1);
  const base=`http://127.0.0.1:${port}`;
  for(let i=0;i<80;i++){try{const ready=await fetch(base);if(ready.status!==503)break;if(i===79)throw new Error(await ready.text());await new Promise(r=>setTimeout(r,100));}catch{if(i===79)throw new Error('PostgREST did not start');await new Promise(r=>setTimeout(r,100));}}
  function token(index){const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');const body=Buffer.from(JSON.stringify({role:'authenticated',sub:id(index+1),exp:Math.floor(Date.now()/1000)+300})).toString('base64url');const unsigned=`${header}.${body}`;return `${unsigned}.${createHmac('sha256',secret).update(unsigned).digest('base64url')}`;}
  async function request(path,index,method='GET',body){const response=await fetch(`${base}/${path}`,{method,headers:{'content-type':'application/json',Prefer:'return=representation',...(index===null?{}:{Authorization:`Bearer ${token(index)}`})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json()};}
  assert.equal((await request('manpower_product_categories',null)).status,401);
  for(let i=0;i<roles.length;i++){
    const readResult=await request('manpower_product_categories',i);
    assert.equal(readResult.status,200);if(roles[i]==='inactive')assert.deepEqual(readResult.body,[]);else assert.ok(readResult.body.length>=6);
    const createResult=await request('manpower_product_categories',i,'POST',{display_name:`API ${roles[i]}`,sort_order:40});
    assert.equal(createResult.status,['lead','admin'].includes(roles[i])?201:403,JSON.stringify(createResult));
    const updateResult=await request(`manpower_product_categories?id=eq.${slabs}`,i,'PATCH',{sort_order:12});
    assert.equal(updateResult.status,200);assert.equal(updateResult.body.length,['lead','admin'].includes(roles[i])?1:0);
    assert.equal((await request(`manpower_product_categories?id=eq.${slabs}`,i,'DELETE')).status,403);
  }
  const activeCategory=sql("select id from manpower_product_categories where display_name='Stairs'").trim();
  const entryBody={work_date:'2026-09-21',worker_id:id(100),task_id:id(101),job_id:id(102),reporting_group_id:id(104),am_hours:1,pm_hours:0};
  assert.equal((await request('manpower_entries',1,'POST',entryBody)).status,400);
  assert.equal((await request('manpower_entries',null,'POST',{...entryBody,product_category_id:activeCategory})).status,401);
  assert.equal((await request('manpower_entries',5,'POST',{...entryBody,product_category_id:activeCategory})).status,403);
  const created=await request('manpower_entries',1,'POST',{...entryBody,product_category_id:activeCategory});
  assert.equal(created.status,201,JSON.stringify(created));
  assert.equal((await request(`manpower_entries?id=eq.${created.body[0].id}`,1,'PATCH',{product_category_id:null})).status,400);
  console.log('Local PostgREST direct API tests passed: anonymous, inactive, Guest/Member/Developer/Lead/Admin management, entry enforcement and clear prevention.');
  console.log('Product Category database checks passed: full caller matrix, direct writes, CRUD lifecycle, audit, duplicates, historical edits, immutable assignment, restrictive FK, Job/Rework/group preservation, concurrent deactivation.');
} finally { spawnSync('docker',['stop',`${name}-rest`],{stdio:'ignore'}); spawnSync('docker',['stop',name],{stdio:'ignore'}); }
