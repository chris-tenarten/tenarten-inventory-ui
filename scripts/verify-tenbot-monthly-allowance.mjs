// Focused allowance checks. Optional database mode reuses the established local
// TenBot fixture and rolls every schema/data change back. No hosted/provider IO.
import assert from 'node:assert/strict';
import {readFileSync,lstatSync,mkdtempSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {assertTenbotFixtureReady,sql} from './support/tenbot-fixture-health.mjs';

const migration=readFileSync(new URL('../supabase/migrations/20261102100000_tenbot_monthly_allowance.sql',import.meta.url),'utf8');
const original=readFileSync(new URL('../supabase/migrations/20261029220000_tenbot_openai_metering.sql',import.meta.url),'utf8');
const checks=[];
const check=(name,fn)=>{fn();checks.push(name);};
check('Monthly migration is disabled-first and caps the shared allowance at $5',()=>{
 assert.match(migration,/set enabled=false/);assert.match(migration,/check\(month_limit_microusd<=5000000\)/);
 assert.match(migration,/month_limit_microusd=5000000/);
});
check('Unmeasured charges carry over without double-counting imported history',()=>{
 assert.match(migration,/created_at>=v_month or state in \('reserved','uncertain'\)/);
 assert.match(migration,/legacy_accounted_microusd-p\.legacy_unresolved_microusd/);
 assert.match(migration,/new\.legacy_unresolved_microusd<old\.legacy_unresolved_microusd/);
 assert.doesNotMatch(migration,/\b(?:delete from|truncate|drop table)\b/i);
});
check('Reserve/settle interface and shared atomic lock are retained',()=>{
 assert.match(migration,/where singleton for update/);assert.match(migration,/c\.capability='readOperationalData'/);
 assert.match(migration,/p_request_id uuid,p_id uuid,p_model text,p_reserved_microusd bigint/);
 assert.doesNotMatch(migration,/create or replace function public\.tenbot_openai_settle/);
 assert.doesNotMatch(migration,/grant\b/i);
});
check('Only allowance, request limits and minute burst checks gate ordinary spending',()=>{
 const reserve=migration.slice(migration.indexOf('create or replace function public.tenbot_openai_reserve'),migration.indexOf('create or replace function public.tenbot_openai_meter_status'));
 for(const field of ['month_limit_microusd','request_limit_microusd','request_step_limit','global_minute_step_limit','user_minute_step_limit'])assert(reserve.includes('p.'+field));
 for(const field of ['total_limit_microusd','day_limit_microusd','user_day_limit_microusd','global_open_limit','user_open_limit','global_day_request_limit','user_day_request_limit'])assert(!reserve.includes('p.'+field));
});

const args=process.argv.slice(2);
assert(args.length===0||args.length===1&&['--database','--isolated-free-fixture'].includes(args[0]),'Use one explicit established-fixture switch');
if(!args.length){
 console.log(JSON.stringify({passed:true,checks:checks.length,names:checks,mode:'static migration contract only',realPostgreSQL:false,hostedCalls:0,providerCalls:0,databaseGate:'Use --database for the established local fixture or --isolated-free-fixture for the existing fixed standalone Free fixture; all changes roll back.'},null,2));
 process.exit(0);
}

const container='tenops-tenbot-review';
const isolated=args[0]==='--isolated-free-fixture';
let queries=0,query;
if(isolated){
 const directory='/private/tmp/tenops-tenbot-hosted-adapter-20261029';
 const configPath=directory+'/free-project-credentials.private.json',stat=lstatSync(configPath);
 assert(stat.isFile()&&!stat.isSymbolicLink()&&(stat.mode&0o077)===0&&stat.uid===process.getuid?.(),'Existing owner-only fixture config required');
 const config=JSON.parse(readFileSync(configPath,'utf8')),ref='jltgxcfiprocydhbrahz';
 assert(config.fixtureKind==='standalone-free'&&config.projectRef===ref&&config.branchRef===ref&&config.url==='https://'+ref+'.supabase.co','Only the established fixed standalone Free fixture is allowed');
 const scratch=mkdtempSync('/private/tmp/tenops-monthly-allowance-');
 query=statement=>{
  const path=scratch+'/'+String(++queries)+'.sql';writeFileSync(path,statement,{mode:0o600,flag:'wx'});
  let result;
  try{result=JSON.parse(execFileSync(process.execPath,[directory+'/branch-query.mjs','--file',path],{encoding:'utf8',timeout:12000,stdio:['ignore','pipe','pipe'],maxBuffer:2000000}));}
  catch(error){
   let code='unavailable';try{const response=JSON.parse(String(error.stdout));if(/^[A-Z0-9_]{1,80}$/.test(response.code))code=response.code;}catch{}
   throw Error('Bounded isolated fixture SQL '+code+'; no Production or inference calls');
  }
  assert(result.ok&&Array.isArray(result.rows),'Isolated fixture SQL rejected');
  return result.rows;
 };
}else{
 try{assertTenbotFixtureReady({container});}catch(error){
  console.log(JSON.stringify({passed:false,staticChecksPassed:checks.length,blocked:error?.code??'fixture-unavailable',realPostgreSQL:false,hostedCalls:0,providerCalls:0}));process.exit(2);
 }
 query=statement=>{queries++;return sql(container,statement);};
}
const jsonQuery=statement=>{
 const result=query(statement);return isolated?result.find(row=>row.metadata)?.metadata:JSON.parse(result);
};
const fixture=jsonQuery("select json_build_object('meter',to_regclass('public.tenbot_openai_policy') is not null,'monthly',exists(select 1 from information_schema.columns where table_schema='public' and table_name='tenbot_openai_policy' and column_name='legacy_unresolved_microusd'),'actor',(select u.user_id from public.app_users u join public.app_role_capabilities c on c.role=u.role where u.is_active and c.capability='readOperationalData' order by u.user_id limit 1)) as metadata;");
assert(fixture&&/^[0-9a-f-]{36}$/.test(fixture.actor),'An existing authorized synthetic fixture actor is required');
assert.equal(fixture.monthly,false,'Run against the established fixture before durable monthly migration application; this verifier never resets a fixture.');
const snapshotSql="select json_build_object('policy',(select md5(coalesce(jsonb_agg(to_jsonb(t))::text,'[]')) from public.tenbot_openai_policy t),'usage',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]')) from public.tenbot_openai_usage t),'reserve',(select md5(pg_get_functiondef(to_regprocedure('public.tenbot_openai_reserve(uuid,uuid,uuid,text,bigint)')))),'status',(select md5(pg_get_functiondef(to_regprocedure('public.tenbot_openai_meter_status()'))))) as metadata;";
const before=fixture.meter?jsonQuery(snapshotSql):null;
function body(source){
 assert.equal((source.match(/^begin;$/gm)??[]).length,1);assert.equal((source.match(/^commit;$/gm)??[]).length,1);
 return source.replace(/^begin;$/m,'').replace(/^commit;$/m,'');
}
const dbChecks=[];
function verify(name,statement){dbChecks.push(name);return statement;}
const statements=[
 'begin;',
 fixture.meter?'':body(original),
 "create temp table allowance_existing_usage as select * from public.tenbot_openai_usage;create temp table allowance_existing_policy as select * from public.tenbot_openai_policy;",
 body(migration),
 `create function pg_temp.ensure(ok boolean) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'Allowance assertion failed';end if;end $$;`,
 `create function pg_temp.denied(statement text) returns void language plpgsql as $$ begin begin execute statement; exception when others then return; end;raise exception 'Expected allowance rejection';end $$;`,
 verify('Migration disables spending without altering ledger rows or imported totals',`
 select pg_temp.ensure(not enabled and month_limit_microusd=5000000 and legacy_unresolved_microusd=0) from public.tenbot_openai_policy;
 select pg_temp.ensure(not exists((select * from public.tenbot_openai_usage except select * from allowance_existing_usage) union all (select * from allowance_existing_usage except select * from public.tenbot_openai_usage)));
 select pg_temp.ensure((select legacy_accounted_microusd from public.tenbot_openai_policy)=(select legacy_accounted_microusd from allowance_existing_policy));
 select pg_temp.denied($q$select public.tenbot_openai_reserve('10282026-0000-4000-8000-000000000001',gen_random_uuid(),gen_random_uuid(),'gpt-6.1-terra',1)$q$);`),
 verify('Anonymous/authenticated roles retain no meter invocation or direct-table access',`
 select pg_temp.ensure(not has_function_privilege('anon','public.tenbot_openai_reserve(uuid,uuid,uuid,text,bigint)','execute'));
 select pg_temp.ensure(not has_function_privilege('authenticated','public.tenbot_openai_meter_status()','execute'));
 select pg_temp.ensure(not has_table_privilege('authenticated','public.tenbot_openai_usage','select'));
 select pg_temp.ensure(not has_table_privilege('service_role','public.tenbot_openai_policy','update'));
 select pg_temp.ensure(has_function_privilege('service_role','public.tenbot_openai_reserve(uuid,uuid,uuid,text,bigint)','execute'));
 select pg_temp.ensure((select relrowsecurity from pg_class where oid='public.tenbot_openai_usage'::regclass));`),
 // Neutralize existing synthetic ledger values only inside this rollback-only
 // transaction. Keep row IDs and related fixture references intact throughout.
 `update public.tenbot_openai_usage set state='measured',actual_microusd=0,settled_at=clock_timestamp(),created_at=date_trunc('month',clock_timestamp())-interval '1 day';
 update public.app_users set is_active=true where user_id='10282026-0000-4000-8000-000000000001';
 update public.tenbot_openai_policy set enabled=true,expires_at=clock_timestamp()+interval '1 hour',legacy_accounted_day=(date_trunc('month',clock_timestamp() at time zone 'UTC')-interval '1 day')::date,request_limit_microusd=5000000,request_step_limit=16,global_minute_step_limit=10000,user_minute_step_limit=1000;`,
 verify('The $5 ceiling rejects a policy increase and a reservation beyond remaining funds',`
 select pg_temp.denied('update public.tenbot_openai_policy set month_limit_microusd=5000001');
 select public.tenbot_openai_reserve('10282026-0000-4000-8000-000000000001',gen_random_uuid(),gen_random_uuid(),'gpt-6.1-terra',5000000);
 select pg_temp.denied($q$select public.tenbot_openai_reserve('10282026-0000-4000-8000-000000000001',gen_random_uuid(),gen_random_uuid(),'gpt-6.1-terra',1)$q$);
 select pg_temp.ensure((public.tenbot_openai_meter_status()->>'remainingMicrousd')::bigint=0);
 delete from public.tenbot_openai_usage where id not in(select id from allowance_existing_usage);`),
 verify('Prior-month measured cost rolls out; reserved/uncertain charges remain held',`
 insert into public.tenbot_openai_usage(id,user_id,request_id,model,policy_version,created_at,reserved_microusd,actual_microusd,state,settled_at) values
 (gen_random_uuid(),'10282026-0000-4000-8000-000000000001',gen_random_uuid(),'gpt-6.1-terra',1,date_trunc('month',clock_timestamp())-interval '1 day',4000000,4000000,'measured',clock_timestamp()),
 (gen_random_uuid(),'10282026-0000-4000-8000-000000000001',gen_random_uuid(),'gpt-6.1-terra',1,date_trunc('month',clock_timestamp())-interval '1 day',20000,null,'uncertain',null),
 (gen_random_uuid(),'10282026-0000-4000-8000-000000000001',gen_random_uuid(),'gpt-6.1-terra',1,date_trunc('month',clock_timestamp())-interval '1 day',30000,null,'reserved',null);
 select pg_temp.ensure((public.tenbot_openai_meter_status()->>'monthAccountedMicrousd')::bigint=50000);
 select public.tenbot_openai_reserve('10282026-0000-4000-8000-000000000001',gen_random_uuid(),gen_random_uuid(),'gpt-6.1-terra',4950000);
 select pg_temp.denied($q$select public.tenbot_openai_reserve('10282026-0000-4000-8000-000000000001',gen_random_uuid(),gen_random_uuid(),'gpt-6.1-terra',1)$q$);
 delete from public.tenbot_openai_usage where id not in(select id from allowance_existing_usage);`),
 verify('Imported unknowns stay held across rollover and are counted once in their original month',`
 update public.tenbot_openai_policy set legacy_unresolved_microusd=18723;
 select pg_temp.ensure((public.tenbot_openai_meter_status()->>'monthAccountedMicrousd')::bigint=18723);
 update public.tenbot_openai_policy set legacy_accounted_day=(clock_timestamp() at time zone 'UTC')::date;
 select pg_temp.ensure((public.tenbot_openai_meter_status()->>'monthAccountedMicrousd')::bigint=(select legacy_accounted_microusd from public.tenbot_openai_policy));
 select pg_temp.denied('update public.tenbot_openai_policy set legacy_unresolved_microusd=0');
 update public.tenbot_openai_policy set legacy_accounted_day=(date_trunc('month',clock_timestamp() at time zone 'UTC')-interval '1 day')::date;`),
 verify('Stale unknowns consume dollars without locking every future request',`
 update public.tenbot_openai_policy set user_open_limit=1,global_open_limit=1;
 select public.tenbot_openai_reserve('10282026-0000-4000-8000-000000000001',gen_random_uuid(),gen_random_uuid(),'gpt-6.1-terra',1) from generate_series(1,3);
 select pg_temp.ensure((select count(*) from public.tenbot_openai_usage where state='reserved')=3);
 select pg_temp.ensure((public.tenbot_openai_meter_status()->>'heldMicrousd')::bigint=18726);
 delete from public.tenbot_openai_usage where id not in(select id from allowance_existing_usage);`),
 verify('Request cost/step caps and account burst remain enforced',`
 update public.tenbot_openai_policy set request_limit_microusd=100,request_step_limit=1;
 select pg_temp.denied($q$select public.tenbot_openai_reserve('10282026-0000-4000-8000-000000000001',gen_random_uuid(),gen_random_uuid(),'gpt-6.1-terra',101)$q$);
 select public.tenbot_openai_reserve('10282026-0000-4000-8000-000000000001','10282026-0000-4000-8000-000000000009',gen_random_uuid(),'gpt-6.1-terra',1);
 select pg_temp.denied($q$select public.tenbot_openai_reserve('10282026-0000-4000-8000-000000000001','10282026-0000-4000-8000-000000000009',gen_random_uuid(),'gpt-6.1-terra',1)$q$);
 update public.tenbot_openai_policy set user_minute_step_limit=1;
 select pg_temp.denied($q$select public.tenbot_openai_reserve('10282026-0000-4000-8000-000000000001',gen_random_uuid(),gen_random_uuid(),'gpt-6.1-terra',1)$q$);
 delete from public.tenbot_openai_usage where id not in(select id from allowance_existing_usage);
 update public.tenbot_openai_policy set user_minute_step_limit=1000;`),
 verify('Revocation prevents a new dispatch; settlement/unknown hold/overrun accounting remain intact',`
 select public.tenbot_openai_reserve('10282026-0000-4000-8000-000000000001',gen_random_uuid(),'10282026-0000-4000-8000-000000000010','gpt-6.1-terra',100);
 update public.app_users set is_active=false where user_id='10282026-0000-4000-8000-000000000001';
 select pg_temp.denied($q$select public.tenbot_openai_reserve('10282026-0000-4000-8000-000000000001',gen_random_uuid(),gen_random_uuid(),'gpt-6.1-terra',1)$q$);
 select public.tenbot_openai_settle('10282026-0000-4000-8000-000000000001','10282026-0000-4000-8000-000000000010',null);
 select pg_temp.ensure((select state='uncertain' and actual_microusd is null from public.tenbot_openai_usage where id='10282026-0000-4000-8000-000000000010'));
 select public.tenbot_openai_settle('10282026-0000-4000-8000-000000000001','10282026-0000-4000-8000-000000000010',101);
 select pg_temp.ensure(not enabled) from public.tenbot_openai_policy;`),
 'rollback;',
 "select json_build_object('done',true) as metadata;",
];
let completed;
try{
 const output=query(statements.join('\n').replaceAll('10282026-0000-4000-8000-000000000001',fixture.actor));
 completed=isolated?output.some(row=>row.metadata?.done===true):output.endsWith('{"done" : true}');
}finally{
 if(before)assert.deepEqual(jsonQuery(snapshotSql),before,'Rollback must preserve exact policy/usage/function definitions');
}
assert(completed,'Rollback-only allowance assertions must finish');
assert.equal(jsonQuery("select json_build_object('monthly',exists(select 1 from information_schema.columns where table_schema='public' and table_name='tenbot_openai_policy' and column_name='legacy_unresolved_microusd')) as metadata;").monthly,false);
console.log(JSON.stringify({passed:true,checks:checks.length+dbChecks.length,names:[...checks,...dbChecks],mode:'real PostgreSQL; established '+(isolated?'fixed standalone Free':'local')+' fixture; rollback-only',realPostgreSQL:true,originalPolicyLedgerFunctionsRestored:true,concurrentConnections:0,hostedCalls:isolated?queries:0,ProductionRequests:0,providerCalls:0,limitation:'Shared locking is retained from the existing concurrent-tested meter; this focused delta verifier does not repeat the original concurrency/HTTP JWT gates.'},null,2));
