// Narrow $5 -> $10 ceiling verification. Reuse the fixed isolated fixture and
// existing meter; preserve every prior record and roll the entire test back.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,lstatSync,mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const migrationPath='supabase/migrations/20261102180000_tenbot_monthly_allowance_ceiling_ten.sql';
const migration=readFileSync(new URL('../'+migrationPath,import.meta.url),'utf8');
const monthly=readFileSync(new URL('../supabase/migrations/20261102100000_tenbot_monthly_allowance.sql',import.meta.url),'utf8');
const sha256=value=>createHash('sha256').update(value).digest('hex');
const checks=[];
const check=(name,fn)=>{fn();checks.push(name);};
check('Accepted monthly predecessor remains byte-exact',()=>{
 assert.equal(sha256(monthly),'2336e07e712e0728119d582a05525db45cd180da1707236b516baf62028690c8');
});
check('The only financial amendment is the existing named ceiling and its comment',()=>{
 assert.match(migration,/drop constraint tenbot_openai_monthly_allowance_ceiling;/);
 assert.match(migration,/add constraint tenbot_openai_monthly_allowance_ceiling\s+check\(month_limit_microusd<=10000000\);/);
 assert.match(migration,/hard maximum \$10\. Unknown charges carry forward\./);
 assert.doesNotMatch(migration,/\b(?:insert\s+into|update\s+public\.|delete\s+from|truncate|grant|revoke|create\s+(?:or\s+replace\s+)?(?:function|table))\b/i);
});
check('Disabled policy, exact predecessor and unchanged security contracts are required',()=>{
 for(const text of ['policy.enabled','where singleton for update','lock table public.tenbot_openai_policy in access exclusive mode',
  'CHECK ((month_limit_microusd <= 5000000))','c.relrowsecurity','pg_policy','actual.proacl','actual.proconfig',
  '493aedf722fcda9e2deb33f1e1669d0f','9520e66b49b61b98d8a8b4edcc34b886',
  '87c68ce9f5b2dc42db95c717a25337f4','9ffd4f0b4e9efbf96c179a7278993432'])assert(migration.includes(text),text);
});
const args=process.argv.slice(2);
assert(args.length===0||args.length===1&&args[0]==='--isolated-free-fixture','Use only the fixed isolated fixture switch');
const baseResult={migration:migrationPath,migrationSha256:sha256(migration),staticChecks:checks.length,providerCalls:0,ProductionRequests:0};
if(!args.length){
 console.log(JSON.stringify({passed:true,...baseResult,names:checks,realPostgreSQL:false},null,2));process.exit(0);
}

const directory='/private/tmp/tenops-tenbot-hosted-adapter-20261029';
const configPath=directory+'/free-project-credentials.private.json',stat=lstatSync(configPath);
assert(stat.isFile()&&!stat.isSymbolicLink()&&(stat.mode&0o077)===0&&stat.uid===process.getuid?.(),'Existing owner-only fixture config required');
const config=JSON.parse(readFileSync(configPath,'utf8')),ref='jltgxcfiprocydhbrahz';
assert(config.fixtureKind==='standalone-free'&&config.projectRef===ref&&config.branchRef===ref&&config.url==='https://'+ref+'.supabase.co','Only the established fixed standalone Free fixture is allowed');
const artifactDirectory='/private/tmp/tenops-initial-production-release-20261102/financial-ceiling';
mkdirSync(artifactDirectory,{recursive:true});
const scratch=mkdtempSync(artifactDirectory+'/sql-');
let queries=0;
function query(statement){
 const path=scratch+'/'+String(++queries)+'.sql';writeFileSync(path,statement,{mode:0o600,flag:'wx'});
 let result;
 try{result=JSON.parse(execFileSync(process.execPath,[directory+'/branch-query.mjs','--file',path],{encoding:'utf8',timeout:12000,stdio:['ignore','pipe','pipe'],maxBuffer:2000000}));}
 catch(error){
  let code='unavailable';try{const response=JSON.parse(String(error.stdout));if(/^[A-Z0-9_]{1,80}$/.test(response.code))code=response.code;}catch{}
  throw Error('Bounded isolated fixture SQL '+code+'; no Production or inference calls');
 }
 assert(result.ok&&Array.isArray(result.rows),'Isolated fixture SQL rejected');return result.rows;
}
const snapshotSql=`select jsonb_build_object(
 'monthly',exists(select 1 from pg_attribute where attrelid='public.tenbot_openai_policy'::regclass and attname='legacy_unresolved_microusd' and not attisdropped),
 'policy',(select to_jsonb(p) from public.tenbot_openai_policy p),
 'usage',(select jsonb_build_object('rows',count(*),'hash',md5(coalesce(jsonb_agg(to_jsonb(u) order by id)::text,'[]'))) from public.tenbot_openai_usage u),
 'functions',(select md5(coalesce(jsonb_agg(jsonb_build_array(p.oid,pg_get_functiondef(p.oid),p.proowner,p.proacl,p.proconfig) order by p.oid)::text,'[]')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind in('f','p')),
 'relations',(select jsonb_agg(jsonb_build_array(c.relname,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity) order by c.relname) from pg_class c where c.oid in('public.tenbot_openai_policy'::regclass,'public.tenbot_openai_usage'::regclass)),
 'policies',(select coalesce(jsonb_agg(to_jsonb(p) order by polname),'[]') from pg_policy p where polrelid in('public.tenbot_openai_policy'::regclass,'public.tenbot_openai_usage'::regclass)),
 'constraints',(select jsonb_agg(jsonb_build_array(conname,pg_get_constraintdef(oid),convalidated,connoinherit,conkey) order by conname) from pg_constraint where conrelid='public.tenbot_openai_policy'::regclass),
 'columns',(select jsonb_agg(jsonb_build_array(attname,atttypid,attnotnull,col_description(attrelid,attnum)) order by attnum) from pg_attribute where attrelid='public.tenbot_openai_policy'::regclass and attnum>0 and not attisdropped),
 'triggers',(select jsonb_agg(jsonb_build_array(tgname,pg_get_triggerdef(oid),tgenabled) order by tgname) from pg_trigger where tgrelid='public.tenbot_openai_policy'::regclass and not tgisinternal),
 'actionControl',(select to_jsonb(c) from public.tenbot_action_control c),
 'executionControl',(select to_jsonb(c) from public.tenbot_receival_execution_control c),
 'pilot',(select to_jsonb(c) from public.tenbot_receival_pilot_policy c),
 'enrollment',(select count(*) from public.tenbot_receival_pilot_employees),
 'status',public.tenbot_openai_meter_status()
) as metadata;`;
const metadata=statement=>query(statement).find(row=>row.metadata)?.metadata;
const before=metadata('begin read only;'+snapshotSql+'commit;');
assert(before&&!before.policy.enabled&&!before.actionControl.proposal_enabled&&!before.actionControl.receivals_enabled
 &&!before.executionControl.execution_enabled&&!before.pilot.enabled&&before.enrollment===0,'Fixture controls must already be OFF; never reset them');
const actor=metadata("select jsonb_build_object('id',(select u.user_id from public.app_users u join public.app_role_capabilities c on c.role=u.role where u.is_active and c.capability='readOperationalData' order by u.user_id limit 1)) as metadata;")?.id;
assert(/^[0-9a-f-]{36}$/.test(actor),'Existing authorized synthetic fixture actor required');
function body(source){
 assert.equal((source.match(/^begin;$/gm)??[]).length,1);assert.equal((source.match(/^commit;$/gm)??[]).length,1);
 return source.replace(/^begin;$/m,'').replace(/^commit;$/m,'');
}
const dbChecks=[];
const verify=(name,statement)=>{dbChecks.push(name);return statement;};
const statements=[
 'begin;',
 before.monthly?'':body(monthly),
 `create temp table ceiling_existing_usage as select * from public.tenbot_openai_usage;
 create temp table ceiling_existing_policy as select * from public.tenbot_openai_policy;
 create temp table ceiling_existing_status as select public.tenbot_openai_meter_status() as value;
 create temp table ceiling_existing_functions as select p.oid,pg_get_functiondef(p.oid) as definition,p.proowner,p.proacl,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind in('f','p');
 create function pg_temp.ensure(ok boolean) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'Ceiling assertion failed';end if;end $$;
 create function pg_temp.rejected(statement text,expected_code text,expected_message text default null) returns void language plpgsql as $$
 begin begin execute statement;exception when others then
  if sqlstate<>expected_code or (expected_message is not null and sqlerrm<>expected_message) then raise;end if;return;
 end;raise exception 'Expected financial rejection';end $$;`,
 body(migration),
 verify('Ceiling-only amendment preserves exact policy, existing ledger and all public functions',`
 select pg_temp.ensure(not exists((select * from public.tenbot_openai_policy except select * from ceiling_existing_policy) union all (select * from ceiling_existing_policy except select * from public.tenbot_openai_policy)));
 select pg_temp.ensure(not exists((select * from public.tenbot_openai_usage except select * from ceiling_existing_usage) union all (select * from ceiling_existing_usage except select * from public.tenbot_openai_usage)));
 select pg_temp.ensure(not exists(select 1 from ceiling_existing_functions f join pg_proc p on p.oid=f.oid where pg_get_functiondef(p.oid)<>f.definition or p.proowner<>f.proowner or p.proacl is distinct from f.proacl or p.proconfig is distinct from f.proconfig));
 select pg_temp.ensure(public.tenbot_openai_meter_status()=(select value from ceiling_existing_status));`),
 verify('$10 is accepted and amounts above $10 are rejected while spending remains disabled',`
 update public.tenbot_openai_policy set month_limit_microusd=10000000;
 select pg_temp.ensure(not enabled and month_limit_microusd=10000000) from public.tenbot_openai_policy;
 select pg_temp.rejected('update public.tenbot_openai_policy set month_limit_microusd=10000001','23514');
 select pg_temp.rejected($q$select public.tenbot_openai_reserve('${actor}',gen_random_uuid(),gen_random_uuid(),'gpt-6.1-terra',1)$q$,'P0001','OpenAI meter unavailable');`),
 verify('Current UTC-month spending, historical unknown holds and $10 remaining allowance are retained',`
 select pg_temp.ensure((public.tenbot_openai_meter_status()->>'monthStartsAt')::timestamptz=date_trunc('month',clock_timestamp() at time zone 'UTC') at time zone 'UTC');
 select pg_temp.ensure((public.tenbot_openai_meter_status()->>'monthAccountedMicrousd')::numeric=((select value from ceiling_existing_status)->>'monthAccountedMicrousd')::numeric);
 select pg_temp.ensure((public.tenbot_openai_meter_status()->>'heldMicrousd')::numeric=((select value from ceiling_existing_status)->>'heldMicrousd')::numeric);
 select pg_temp.ensure((public.tenbot_openai_meter_status()->>'accountedMicrousd')::numeric=((select value from ceiling_existing_status)->>'accountedMicrousd')::numeric);
 select pg_temp.ensure((public.tenbot_openai_meter_status()->>'remainingMicrousd')::numeric=greatest(0,10000000-((select value from ceiling_existing_status)->>'monthAccountedMicrousd')::numeric));`),
 verify('Service-only RPC access, direct table denial and RLS stay unchanged',`
 select pg_temp.ensure(not has_function_privilege('anon','public.tenbot_openai_reserve(uuid,uuid,uuid,text,bigint)','execute'));
 select pg_temp.ensure(not has_function_privilege('authenticated','public.tenbot_openai_meter_status()','execute'));
 select pg_temp.ensure(not has_table_privilege('authenticated','public.tenbot_openai_usage','select'));
 select pg_temp.ensure(not has_table_privilege('service_role','public.tenbot_openai_policy','update'));
 select pg_temp.ensure(has_function_privilege('service_role','public.tenbot_openai_reserve(uuid,uuid,uuid,text,bigint)','execute'));
 select pg_temp.ensure(bool_and(relrowsecurity)) from pg_class where oid in('public.tenbot_openai_policy'::regclass,'public.tenbot_openai_usage'::regclass);`),
 // Only a new one-microUSD synthetic reservation is exercised. Prior ledger
 // rows are never updated, deleted, re-dated or neutralized, even temporarily.
 `create temp table ceiling_probe as select gen_random_uuid() as id,gen_random_uuid() as request_id;
 update public.tenbot_openai_policy set enabled=true,expires_at=clock_timestamp()+interval '1 minute';`,
 verify('Existing atomic reservation and retry rejection retain unknown accounting without changing prior rows',`
 select public.tenbot_openai_reserve('${actor}',request_id,id,'gpt-6.1-terra',1) from ceiling_probe;
 select pg_temp.rejected(format('select public.tenbot_openai_reserve(%L,%L,%L,%L,1)','${actor}',request_id,id,'gpt-6.1-terra'),'23505') from ceiling_probe;
 select pg_temp.ensure((select count(*) from public.tenbot_openai_usage where id=(select id from ceiling_probe))=1);
 select public.tenbot_openai_settle('${actor}',id,null) from ceiling_probe;
 select pg_temp.ensure((public.tenbot_openai_meter_status()->>'monthAccountedMicrousd')::numeric=((select value from ceiling_existing_status)->>'monthAccountedMicrousd')::numeric+1);
 select pg_temp.ensure((public.tenbot_openai_meter_status()->>'heldMicrousd')::numeric=((select value from ceiling_existing_status)->>'heldMicrousd')::numeric+1);
 select pg_temp.ensure(not exists((select u.* from public.tenbot_openai_usage u join ceiling_existing_usage e on e.id=u.id except select * from ceiling_existing_usage) union all (select * from ceiling_existing_usage except select u.* from public.tenbot_openai_usage u join ceiling_existing_usage e on e.id=u.id)));`),
 verify('Exhaustion still returns zero remaining and denies a new dispatch',`
 update public.tenbot_openai_policy set month_limit_microusd=(public.tenbot_openai_meter_status()->>'monthAccountedMicrousd')::bigint;
 select pg_temp.ensure((public.tenbot_openai_meter_status()->>'remainingMicrousd')::bigint=0);
 select pg_temp.rejected($q$select public.tenbot_openai_reserve('${actor}',gen_random_uuid(),gen_random_uuid(),'gpt-6.1-terra',1)$q$,'P0001','OpenAI budget unavailable');
 update public.tenbot_openai_policy set enabled=false;
 select pg_temp.ensure(not enabled) from public.tenbot_openai_policy;`),
 'rollback;',
 "select jsonb_build_object('done',true) as metadata;",
];
let completed;
try{completed=query(statements.join('\n')).some(row=>row.metadata?.done===true);}
finally{
 const after=metadata('begin read only;'+snapshotSql+'commit;');
 assert.deepEqual(after,before,'Rollback must preserve exact original policy, ledger, functions, security, constraints, comment and OFF controls');
 writeFileSync(scratch+'/restoration.json',JSON.stringify({before,after,equal:true},null,2)+'\n',{mode:0o600,flag:'wx'});
}
assert(completed,'Rollback-only focused ceiling assertions must finish');
console.log(JSON.stringify({passed:true,...baseResult,databaseChecks:dbChecks.length,names:[...checks,...dbChecks],
 realPostgreSQL:true,fixture:ref,queries,predecessorStagedRollbackOnly:!before.monthly,
 priorLedgerRows:before.usage.rows,priorLedgerHash:before.usage.hash,originalPolicyLedgerFunctionsSecuritySchemaAndControlsRestored:true,
 concurrentConnections:0,scratch,limitation:'Unchanged reserve/settle bodies and shared-row locking retain the accepted concurrency, UTC rollover and HTTP JWT evidence; this focused delta does not rerun those campaigns.'},null,2));
