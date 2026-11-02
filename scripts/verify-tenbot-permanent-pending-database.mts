/** Exact forward-migration validation in the existing fixed synthetic fixture.
 * Reuses the reviewed-action/Auth/Storage verifier; always restores the sole
 * changed function. No shared target, provider, funding, reset or actor seed. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fixtureSql,RECEIVAL_ACTOR_CONFIG,RECEIVAL_FIXTURE_REF} from './support/tenbot-receival-fixture.mjs';

assert(process.argv[2]==='--authorized-isolated-fixture'&&process.argv.length<=4);
const groups=process.argv[3]??'--only-groups=5,6,7,8,9,11,13,14,15,16,17';
assert(/^--only-groups=\d+(,\d+)*$/.test(groups));
const selectedGroups=groups.slice(14).split(',').map(Number);
assert(new Set(selectedGroups).size===selectedGroups.length&&selectedGroups.every(n=>[5,6,7,8,9,11,13,14,15,16,17].includes(n)));
assert.equal(RECEIVAL_FIXTURE_REF,'jltgxcfiprocydhbrahz');
process.env.TENBOT_RECEIVAL_FIXTURE_CONFIG=RECEIVAL_ACTOR_CONFIG;
const directory='/private/tmp/tenops-final-pending-authorization-20261102/database';mkdirSync(directory,{recursive:true});
const save=(name:string,value:unknown)=>writeFileSync(directory+'/'+name+'.json',JSON.stringify(value,null,2)+'\n',{mode:0o600});
const target='public.execute_tenbot_reviewed_action(uuid,integer,text)';
const migrationPath='supabase/migrations/20261102170000_tenbot_permanent_reviewed_pending.sql',migration=readFileSync(migrationPath,'utf8');
const migrationSha256=createHash('sha256').update(migration).digest('hex');
const metadataQuery=`begin read only;select pg_get_functiondef('${target}'::regprocedure) as definition,md5(prosrc) as body_md5,pg_get_userbyid(proowner) as owner,proacl::text as acl,proconfig as configuration,(select md5(jsonb_agg(jsonb_build_array(p.oid,pg_get_functiondef(p.oid),p.proowner,p.proacl,p.proconfig) order by p.oid)::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind in('f','p') and p.oid<>'${target}'::regprocedure) as other_functions,(select to_jsonb(c) from public.tenbot_action_control c) as action_control,(select to_jsonb(c) from public.tenbot_receival_execution_control c) as execution_control,(select to_jsonb(c) from public.tenbot_receival_pilot_policy c) as pilot,(select count(*) from public.tenbot_receival_pilot_employees) as enrollment,(select md5(coalesce(jsonb_agg(to_jsonb(i) order by id)::text,'[]')) from public.inventory_items i) as stock,(select md5(coalesce(jsonb_agg(to_jsonb(i) order by id)::text,'[]')) from public.inventory_transactions i) as transactions,(select md5(coalesce(jsonb_agg(to_jsonb(c) order by role,capability)::text,'[]')) from public.app_role_capabilities c) as capabilities from pg_proc where oid='${target}'::regprocedure;commit;`;
const before=fixtureSql('permanent-pending-before',metadataQuery)[0];save('migration-before',before);
assert.equal(before.body_md5,'78e5c6b1bdfebfaaaef5f06846980516');
assert.equal((before.action_control as Record<string,unknown>).receivals_enabled,false);
assert.equal((before.execution_control as Record<string,unknown>).execution_enabled,false);
assert.equal((before.pilot as Record<string,unknown>).enabled,false);assert.equal(before.enrollment,0);
let childStatus:number|null=null;let applied=false;let appliedBody:string|undefined;
try{
 fixtureSql('permanent-pending-apply',migration);applied=true;
 const installed=fixtureSql('permanent-pending-installed',metadataQuery)[0];appliedBody=String(installed.body_md5);save('migration-installed',installed);
 assert.notEqual(installed.body_md5,before.body_md5);
 for(const key of ['owner','acl','configuration','other_functions','action_control','execution_control','pilot','enrollment','stock','transactions','capabilities'])assert.deepEqual(installed[key],before[key],'Migration changed '+key);
 const child=spawnSync(process.execPath,['--import','tsx','scripts/verify-tenbot-reviewed-actions-database.mts','--authorized-isolated-fixture','--permanent-pending',groups],{encoding:'utf8',timeout:360000,maxBuffer:2e6,env:process.env});
 childStatus=child.status;
 writeFileSync(directory+'/focused-run.log',(child.stdout??'')+(child.stderr??''),{mode:0o600});
 assert.equal(child.status,0,'Focused fixture verifier failed; inspect private focused-run.log');
}finally{
 if(applied)fixtureSql('permanent-pending-restore','begin;'+String(before.definition)+';notify pgrst,\'reload schema\';commit;');
 const after=fixtureSql('permanent-pending-after',metadataQuery)[0];save('migration-after',after);
 for(const key of ['body_md5','owner','acl','configuration','other_functions','enrollment','stock','transactions','capabilities'])assert.deepEqual(after[key],before[key],'Restoration changed '+key);
 for(const [key,flag] of [['action_control','receivals_enabled'],['execution_control','execution_enabled'],['pilot','enabled']])assert.equal((after[key] as Record<string,unknown>)[flag],false);
 save('migration-result',{passed:childStatus===0,fixtureRef:RECEIVAL_FIXTURE_REF,migration:{path:migrationPath,sha256:migrationSha256,appliedInIsolation:applied,sharedApplied:false,fixturePersisted:false,appliedBodyMd5:appliedBody},childStatus,originalFunctionRestored:true,otherFunctionsPreserved:true,stockAndTransactionsPreserved:true,capabilitiesPreserved:true,controlsOff:true,enrollment:0,providerCalls:0,sharedCalls:0});
}
const report=JSON.parse(readFileSync(directory+'/results.json','utf8'));
assert.equal(report.groupsPassed,selectedGroups.length);console.log(JSON.stringify({passed:true,groupsPassed:report.groupsPassed,fixtureRef:RECEIVAL_FIXTURE_REF,createdIds:report.createdIds,migrationSha256,originalFunctionRestored:true,providerCalls:0,sharedCalls:0}));
