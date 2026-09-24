// Disposable PostgreSQL/PostgREST only. No hosted URL, token, or mutation path.
// Input: fresh public schema-only dump + metadata/digests capture; never hosted rows.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHmac, createHash } from 'node:crypto';
const read=p=>readFileSync(p,'utf8');
const contract=scope=>read('scripts/fixtures/manpower-anonymous-hardening/contract.sql').replaceAll('__SCOPE__',scope);
if(process.argv.includes('--print-capture-sql')){
 const queries=['core','rework'].map(scope=>`select '${scope}' as kind,contract as evidence from (${contract(scope)}) q`);
 queries.push("select 'capabilities',jsonb_agg(to_jsonb(c) order by role,capability) from app_role_capabilities c");
 for(const table of ['manpower_entries','manpower_workers','manpower_tasks','manpower_reporting_groups','manpower_product_categories','production_rework_cycles','jobs','app_users','app_role_capabilities'])queries.push(`select '${table}',jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\\n' order by to_jsonb(t)::text),''),'UTF8')),'hex')) from public.${table} t`);
 queries.push("select 'labor_totals',jsonb_build_object('am',sum(am_hours),'pm',sum(pm_hours),'total',sum(am_hours+pm_hours)) from manpower_entries");
 queries.push("select 'ledger',coalesce(jsonb_agg(version),'[]') from supabase_migrations.schema_migrations where version in ('20260924210000','20260924210100')");
 console.log('begin transaction isolation level repeatable read read only;\n'+queries.join('\nunion all\n')+';\nrollback;');
 process.exit(0);
}
const dir=process.argv.find(a=>a.startsWith('--baseline-dir='))?.split('=').slice(1).join('=');
if(!dir)throw Error('Required --baseline-dir=<read-only schema capture directory>');
const name=`tenops-manpower-security-${process.pid}`;
const capture=Object.fromEntries(JSON.parse(read(`${dir}/capture.json`)).rows.map(r=>[r.kind,r.evidence]));
assert.deepEqual(capture.ledger,[],'migration versions already occupied');
const migrations=['20260924210000_manpower_anonymous_access','20260924210100_production_rework_anonymous_access'].map(n=>read(`supabase/migrations/${n}.sql`));
function run(args,input){const r=spawnSync('docker',args,{input,encoding:'utf8',maxBuffer:40e6});if(r.status!==0)throw Error(r.stderr+'\n'+r.stdout.slice(-4000));return r.stdout;}
const sql=q=>run(['exec','-i',name,'psql','-h','127.0.0.1','-X','-U','postgres','-v','ON_ERROR_STOP=1','-Atq'],q);
const json=q=>JSON.parse(sql(q).trim());
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const quote=s=>`'${s.replaceAll("'","''")}'`;
const roles=['guest','member','lead','developer','admin','service_role','anon'];
let report={};
try{
 run(['run','--rm','-d','--name',name,'-p','127.0.0.1::3000','-e','POSTGRES_PASSWORD=postgres','postgres:17.6']);
 for(let i=0;i<80;i++){if(!spawnSync('docker',['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']).status)break;await new Promise(r=>setTimeout(r,150));}
 const bootstrap=read('scripts/verify-po-reservation-allocations.mjs').match(/const bootstrap = `([\s\S]*?)`;/)[1];
 sql(bootstrap+read(`${dir}/public-schema.sql`));
 // Supabase auth schema is outside the public dump; emulate JWT extraction only.
 sql(`create or replace function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
 insert into app_role_capabilities select * from jsonb_populate_recordset(null::app_role_capabilities,${quote(JSON.stringify(capture.capabilities))}::jsonb);`);
 for(const scope of ['core','rework'])assert.deepEqual(json(contract(scope)),capture[scope],`${scope} exact hosted catalog replay`);
 console.log('PASS exact fresh hosted definitions, policies, grants, role attributes, constraints/triggers replay');
 sql(read('scripts/fixtures/manpower-anonymous-hardening/fixtures.sql'));

 const core=['manpower_entries','manpower_workers','manpower_tasks','manpower_reporting_groups'];
 const row="20000000-0000-4000-8000-000000000001";
 const insertion=`insert into manpower_entries(work_date,worker_id,task_id,job_id,reporting_group_id,product_category_id,am_hours,pm_hours) values('2026-09-24','${id(100)}','${id(101)}','${id(106)}','${id(102)}','${id(104)}',2,1)`;
 const proposal=`jsonb_build_array(jsonb_build_object('rework_cycle_id',id,'original_updated_at',updated_at,'original_planned_start',planned_start,'original_planned_end',planned_end,'proposed_planned_start','2026-10-01','proposed_planned_end','2026-10-03'))`;
 const probes={
  ...Object.fromEntries(core.map(t=>[`${t}:read`,`select * from ${t}`])),
  'entry:create':insertion,
  'entry:edit':`update manpower_entries set am_hours=3,notes='LOCAL edit' where id='${row}'`,
  'entry:delete':`delete from manpower_entries where id='${row}'`,
  'entry:category-change':`update manpower_entries set product_category_id='${id(104)}' where id='${row}'`,
  'entry:invalid-category':`update manpower_entries set product_category_id=null where id='${row}'`,
  ...Object.fromEntries(['manpower_workers','manpower_tasks','manpower_reporting_groups'].flatMap((t,i)=>[
   [`${t}:create`,`insert into ${t}(display_name) values('LOCAL added')`],
   [`${t}:edit`,`update ${t} set display_name='LOCAL changed' where id='${id(100+i)}'`],
   [`${t}:delete`,`delete from ${t} where id='${id(100+i)}'`]
  ])),
  'group:delete-empty':`select delete_empty_manpower_reporting_group('${id(103)}')`,
  'group:delete-occupied':`select delete_empty_manpower_reporting_group('${id(102)}')`,
  'category:read':'select * from manpower_product_categories',
  'category:create':"insert into manpower_product_categories(display_name,sort_order) values('LOCAL category',9)",
  'category:rename':`update manpower_product_categories set display_name='LOCAL renamed' where id='${id(104)}'`,
  'category:reorder':`update manpower_product_categories set sort_order=8 where id='${id(104)}'`,
  'category:deactivate':`update manpower_product_categories set is_active=false where id='${id(104)}'`,
  'snapshot:period-join':`select e.work_date,e.am_hours,e.pm_hours,w.display_name,t.display_name,c.display_name from manpower_entries e left join manpower_workers w on w.id=e.worker_id left join manpower_tasks t on t.id=e.task_id left join manpower_product_categories c on c.id=e.product_category_id where e.work_date>='2026-09-01' and e.work_date<'2026-10-01'`,
  'production:totals':`select j.id,sum(e.am_hours+e.pm_hours) from jobs j left join manpower_entries e on e.job_id=j.id group by j.id`,
  'reporting:full-join':`select e.id,j.name,g.display_name,c.display_name,r.scope_details from manpower_entries e left join jobs j on j.id=e.job_id left join manpower_reporting_groups g on g.id=e.reporting_group_id left join manpower_product_categories c on c.id=e.product_category_id left join production_rework_cycles r on r.id=e.rework_cycle_id`,
  'rework:read':'select * from production_rework_cycles',
  'rework:create':`select create_production_rework('${id(105)}','other','LOCAL new Rework','2026-09-24','LOCAL actor')`,
  'rework:status':`select update_production_rework_status(id,'on_deck',updated_at,'LOCAL actor') from production_rework_cycles where id='${id(107)}'`,
  'rework:schedule':`select save_production_rework_schedule_batch(${proposal},'LOCAL actor',null,'${id(200)}') from production_rework_cycles where id='${id(107)}'`,
  'rework:mixed':`select save_production_rework_mixed_schedule_batch('[]','[]',${proposal},'LOCAL actor',null,'${id(201)}') from production_rework_cycles where id='${id(107)}'`,
  'rework:direct-update':`update production_rework_cycles set scope_details='LOCAL edit' where id='${id(107)}'`
 };
 const actor=(role)=>`set local role ${['anon','service_role'].includes(role)?role:'authenticated'};select set_config('request.jwt.claim.sub',${quote(roles.indexOf(role)<5?id(roles.indexOf(role)+1):'')},true);`;
 const measure=()=>Object.fromEntries(roles.map(role=>{
  const fields=Object.entries(probes).map(([label,q])=>`${quote(label)},security_probe(${quote(q)})`).join(',');
  const out=sql(`begin;${actor(role)}select jsonb_build_object(${fields});rollback;`).trim().split('\n').at(-1);
  return [role,JSON.parse(out)];
 }));
 const integrity=()=>json(`select jsonb_object_agg(t.name,t.digest) from (
 ${['manpower_entries','manpower_workers','manpower_tasks','manpower_reporting_groups','manpower_product_categories','production_rework_cycles','production_rework_schedule_batches','jobs','job_activity','app_users','app_role_capabilities'].map(t=>`select '${t}' as name,jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\\n' order by to_jsonb(r)::text),''),'UTF8')),'hex')) as digest from ${t} r`).join(' union all ')}
 )t`);
 const before=measure(), preserved=integrity();
 const alternatePaths=()=>{
  assert.deepEqual(json("select coalesce(jsonb_agg(relname),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('v','m')"),[],'unexpected public view; review required');
  const functions=json("select jsonb_agg(jsonb_build_object('name',p.proname,'signature',p.oid::regprocedure::text,'body',p.prosrc,'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'trigger',p.prorettype in ('trigger'::regtype,'event_trigger'::regtype))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'");
  let names=new Set([...core,'production_rework_cycles','production_rework_schedule_batches']);
  let found=new Set();let changed=true;
  while(changed){changed=false;for(const f of functions)if(!found.has(f.signature)&&[...names].some(n=>new RegExp(`\\b${n}\\b`).test(f.body))){found.add(f.signature);names.add(f.name);changed=true;}}
  return functions.filter(f=>found.has(f.signature)&&f.anon&&!f.trigger).map(f=>f.signature).sort();
 };
 const pathsBefore=alternatePaths();
 assert.deepEqual(pathsBefore,['delete_empty_manpower_reporting_group(uuid)','create_production_rework(uuid,text,text,date,text)','update_production_rework_status(uuid,text,timestamp with time zone,text)','save_production_rework_schedule_batch(jsonb,text,text,uuid)','save_production_rework_mixed_schedule_batch(jsonb,jsonb,jsonb,text,text,uuid)'].sort(),'unexpected anonymous alternate RPC path');

 for(const role of roles.slice(0,5)){
  for(const key of ['entry:create','entry:edit','entry:delete','group:delete-empty','rework:create','rework:status','rework:schedule','rework:mixed'])assert.equal(before[role][key].state,'allowed',`${role} ${key}: ${JSON.stringify(before[role][key])}`);
  assert.equal(before[role]['category:create'].state,['lead','admin'].includes(role)?'allowed':'42501');
  assert.equal(before[role]['category:rename'].rows,['lead','admin'].includes(role)?1:0);
 }
 console.log(`PASS captured real baseline operation outcomes for all five roles + service + anonymous (${Object.keys(probes).length} each)`);
 // Guard adversaries, each isolated and rolled back. Never accept a guessed baseline.
 const drift=[
 [0,"alter table manpower_workers owner to supabase_admin"],
 [0,"alter table manpower_entries disable row level security"],
 [0,"alter table manpower_entries force row level security"],
 [0,"revoke update on manpower_workers from authenticated"],
 [0,"grant select(display_name) on manpower_workers to anon"],
 [0,'alter policy "Allow anon read manpower workers" on manpower_workers using (false)'],
 [0,"alter table manpower_entries disable trigger manpower_entry_product_category_guard"],
 [0,"alter table manpower_workers add constraint local_drift check(length(display_name)>0)"],
 [0,"alter function delete_empty_manpower_reporting_group(uuid) security invoker"],
 [0,"alter function delete_empty_manpower_reporting_group(uuid) set search_path=public"],
 [0,"grant execute on function delete_empty_manpower_reporting_group(uuid) to public"],
 [0,"create or replace function delete_empty_manpower_reporting_group(p_group_id uuid) returns void language plpgsql security definer as $$begin return;end$$"],
 [1,"revoke select on production_rework_cycles from authenticated"],
 [1,'alter policy "Compatibility read Production Rework" on production_rework_cycles using (false)'],
 [1,"alter function create_production_rework(uuid,text,text,date,text) owner to supabase_admin"],
 [1,"alter function save_production_rework_schedule_batch(jsonb,text,text,uuid) security invoker"],
 [1,"create function create_production_rework(text) returns void language plpgsql as $$begin return;end$$"],
 [1,"alter role anon bypassrls"]
 ];
 const body=m=>m.replace(/^begin;$/m,'').replace(/^commit;$/m,'');
 for(const [index,change]of drift){
  const out=sql(`begin;${change};select security_probe(${quote(body(migrations[index]))});rollback;`).trim().split('\n').at(-1);
  assert.equal(JSON.parse(out).state,'55000',`drift not blocked: ${change}: ${out}`);
 }
 assert.deepEqual(integrity(),preserved);
 // Explicit transaction rollback after valid migration also restores authorization.
 for(let i=0;i<2;i++){
  sql(`begin;${body(migrations[i])}rollback;`);
  assert.deepEqual(json(contract(i?'rework':'core')),capture[i?'rework':'core']);
 }
 console.log(`PASS ${drift.length} fail-closed drift cases and both transactional rollback cases`);
 // Start real PostgREST with the complete replayed relationships and signed local JWTs.
 const secret='local-only-manpower-anonymous-hardening-32-bytes';
 run(['run','--rm','-d','--name',`${name}-rest`,'--network',`container:${name}`,
  '-e','PGRST_DB_URI=postgres://postgres:postgres@127.0.0.1:5432/postgres','-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e',`PGRST_JWT_SECRET=${secret}`,'-e','PGRST_DB_MAX_ROWS=1000','public.ecr.aws/supabase/postgrest:v14.15']);
 const base=`http://127.0.0.1:${run(['port',name,'3000/tcp']).trim().split(':').at(-1)}`;
 for(let i=0;i<80;i++){try{const r=await fetch(base);if(r.status!==503)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const token=role=>{
  const a=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),b=Buffer.from(JSON.stringify({role:role==='service_role'?'service_role':'authenticated',sub:role==='service_role'?undefined:id(roles.indexOf(role)+1),exp:Math.floor(Date.now()/1000)+600})).toString('base64url');
  return `${a}.${b}.${createHmac('sha256',secret).update(`${a}.${b}`).digest('base64url')}`;
 };
 async function request(role,path,method='GET',payload){const r=await fetch(`${base}/${path}`,{method,headers:{'Content-Type':'application/json',Prefer:'return=representation,count=exact',...(role==='anon'?{}:{Authorization:`Bearer ${token(role)}`})},...(payload===undefined?{}:{body:JSON.stringify(payload)})});return {status:r.status,range:r.headers.get('content-range'),data:await r.json()};}
 async function apiReads(){const result={};for(const role of roles){result[role]={};for(const t of [...core,'production_rework_cycles','manpower_product_categories']){const r=await request(role,`${t}?select=*&limit=1`);result[role][t]={status:r.status,range:r.range,rows:Array.isArray(r.data)?r.data.length:r.data.code};}
 if(role!=='anon'){
  const pages=[];for(let offset=0;offset<1003;offset+=500){const r=await request(role,`manpower_entries?select=id,am_hours,pm_hours,manpower_workers(display_name),manpower_tasks(display_name),jobs(id,name),manpower_reporting_groups(display_name),manpower_product_categories(display_name),production_rework_cycles(id)&order=id&offset=${offset}&limit=500`);assert.ok(r.status===200||r.status===206,JSON.stringify(r));pages.push(...r.data);}
  assert.equal(pages.length,1003);assert.equal(new Set(pages.map(r=>r.id)).size,1003);assert.equal(pages.reduce((s,r)=>s+r.am_hours+r.pm_hours,0),1504.5);result[role].pagination={count:pages.length,hours:1504.5,sha256:createHash('sha256').update(JSON.stringify(pages)).digest('hex')};
 }
 }return result;}
 const apiBefore=await apiReads();
 sql(migrations[0]);
 // Stage 1 leaves connected Rework unchanged; no hidden all-or-nothing dependency.
 assert.deepEqual(json(contract('rework')),capture.rework);
 assert.deepEqual(integrity(),preserved);
 const coreAfterFirst=json(contract('core'));
 const stage2Failure=sql(`begin;alter function create_production_rework(uuid,text,text,date,text) security invoker;select security_probe(${quote(body(migrations[1]))});rollback;`).trim().split('\n').at(-1);
 assert.equal(JSON.parse(stage2Failure).state,'55000','stage 2 drift must stop after committed stage 1');
 assert.deepEqual(json(contract('core')),coreAfterFirst,'stage 1 security survives stage 2 failure');
 assert.deepEqual(json(contract('rework')),capture.rework,'stage 2 failure leaves stage 2 unchanged');
 assert.deepEqual(integrity(),preserved);
 sql(migrations[1]);
 assert.deepEqual(integrity(),preserved,'all synthetic business/config digests identical across both migrations');
 const after=measure();
 assert.deepEqual(alternatePaths(),[],'anonymous alternate RPC survives');
 // Exact postcondition: only the approved anonymous ACL/policy delta exists.
 for(const scope of ['core','rework']){
  const expected=structuredClone(capture[scope]);
  for(const t of expected.tables){t.acl=t.acl.filter(a=>a[1]!=='anon');t.policies=t.policies.filter(p=>!(p.roles.length===1&&p.roles[0]==='anon'));for(const p of t.policies)p.roles=p.roles.filter(r=>r!=='anon');}
  for(const f of expected.functions)if(pathsBefore.includes(f.signature))f.acl=f.acl.filter(a=>a[1]!=='anon');
  assert.deepEqual(json(contract(scope)),expected,`${scope} exact only-authorized catalog delta`);
 }

 for(const role of roles.filter(r=>r!=='anon'))assert.deepEqual(after[role],before[role],`${role} complete semantic equivalence`);
 for(const key of [...core.flatMap(t=>[`${t}:read`,...(t==='manpower_entries'?['entry:create','entry:edit','entry:delete']:[`${t}:create`,`${t}:edit`,`${t}:delete`])]),'group:delete-empty','group:delete-occupied','rework:read','rework:create','rework:status','rework:schedule','rework:mixed'])assert.equal(after.anon[key].state,'42501',`anonymous not denied ${key}`);
 // SQL/catalog boundary is authoritative; refresh PostgREST schema cache for HTTP checks.
 sql("notify pgrst,'reload schema';");await new Promise(r=>setTimeout(r,500));
 const apiAfter=await apiReads();
 for(const role of roles.filter(r=>r!=='anon'))assert.deepEqual(apiAfter[role],apiBefore[role],`${role} REST/pagination equivalence`);
 for(const t of [...core,'production_rework_cycles'])assert.equal(apiAfter.anon[t].status,401,`anonymous REST ${t}`);
 const anonymousRequests=[];
 for(const t of core)for(const method of ['POST','PATCH','DELETE']){
  const data=method==='DELETE'?undefined:t==='manpower_entries'?{am_hours:2}:{display_name:'LOCAL denied'};
  const r=await request('anon',`${t}?id=eq.${id(999)}`,method,data);assert.equal(r.status,401,JSON.stringify(r));anonymousRequests.push({t,method,status:r.status});
 }
 for(const [rpc,payload] of [
 ['delete_empty_manpower_reporting_group',{p_group_id:id(103)}],
 ['create_production_rework',{p_job_id:id(105),p_reason_category:'other',p_scope_details:'LOCAL denied',p_intake_date:'2026-09-24'}],
 ['update_production_rework_status',{p_rework_cycle_id:id(107),p_production_status:'on_deck',p_expected_updated_at:'2026-09-24T00:00:00Z'}],
 ['save_production_rework_schedule_batch',{p_proposals:[],p_changed_by:'LOCAL denied'}],
 ['save_production_rework_mixed_schedule_batch',{p_job_proposals:[],p_phase_proposals:[],p_rework_proposals:[],p_changed_by:'LOCAL denied'}]
 ]){const r=await request('anon',`rpc/${rpc}`,'POST',payload);assert.equal(r.status,401,JSON.stringify(r));anonymousRequests.push({rpc,status:r.status});}
 assert.deepEqual(integrity(),preserved,'probes and denied HTTP mutations left zero residue');
 report={migrationHashes:migrations.map(m=>createHash('sha256').update(m).digest('hex')),before,after,apiBefore,apiAfter,pathsBefore,pathsAfter:alternatePaths(),anonymousRequests,stage2Failure:JSON.parse(stage2Failure),driftCases:drift.map(d=>d[1]),integrity:preserved,hostedBaseline:Object.fromEntries(Object.entries(capture).filter(([k])=>!['core','rework','capabilities'].includes(k)))};
 writeFileSync(`${dir}/validation.json`,JSON.stringify(report,null,2)+'\n');
 console.log('PASS five-role + service before/after matrix, anonymous SQL/HTTP denial, 1003-row paginated complete joins, Snapshot/Production totals and unchanged integrity digests');

}finally{spawnSync('docker',['stop',`${name}-rest`],{stdio:'ignore'});spawnSync('docker',['stop',name],{stdio:'ignore'});}
