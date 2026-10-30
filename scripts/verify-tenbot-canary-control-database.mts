/** New status RPC only: rollback-only PostgreSQL role-context checks in the
 * existing synthetic Free fixture. No grant, profile, gate, enrollment,
 * Inventory write, persistent DDL or inference is performed.
 * Auth verifies existing synthetic JWTs; SQL role-context execution below is
 * explicitly not proof of the unapplied RPC's HTTP/gateway integration.
 */
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {readFileSync,lstatSync,mkdirSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {RECEIVAL_FIXTURE_REF,RECEIVAL_ACTOR_CONFIG,receivalFixtureConfig,fixtureSql} from './support/tenbot-receival-fixture.mjs';

assert.deepEqual(process.argv.slice(2),['--authorized-read-only-fixture']);
assert.equal(RECEIVAL_FIXTURE_REF,'jltgxcfiprocydhbrahz');
process.env.TENBOT_RECEIVAL_FIXTURE_CONFIG=RECEIVAL_ACTOR_CONFIG;
const fixture=receivalFixtureConfig(),owner='3785f6b9-742e-452f-af6c-31613a983633';
const actorFile='/private/tmp/tenops-tenbot-chris-dev-grant-20261030/fixture-actors.private.json';
const stat=lstatSync(actorFile);
assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.uid===process.getuid?.()&&(stat.mode&0o077)===0);
type Actor={id:string;email:string;password:string};
const actors=JSON.parse(readFileSync(actorFile,'utf8')) as {fixtureRef:string;subject:Actor;admin:Actor;otherDeveloper:Actor;otherEmployee:Actor};
assert.equal(actors.fixtureRef,RECEIVAL_FIXTURE_REF);assert.equal(actors.subject.id,owner);
const folder='/private/tmp/tenops-tenbot-chris-dev-staging-20261030/canary-preparation/application-controls';
mkdirSync(folder,{recursive:true});
const migration='supabase/migrations/20261030220000_tenbot_canary_control_status.sql';
const source=readFileSync(migration,'utf8'),digest=(s:string)=>createHash('sha256').update(s).digest('hex');
assert(source.includes('begin;')&&source.trimEnd().endsWith('commit;'));
const inner=source.slice(source.indexOf('begin;')+6,source.lastIndexOf('commit;'));
assert(!/\b(?:insert\s+into|update\s+public\.|delete\s+from|alter\s+table|create\s+table)\b/i.test(inner));
const functionName='get_tenbot_chris_dev_canary_control_status',signature='public.'+functionName+'()';
const quote=(s:string)=>"'"+s.replaceAll("'","''")+"'";
let phase='preflight',httpCalls=0;
const run=randomBytes(5).toString('hex');
const dataState=`jsonb_build_object(
 'grants',(select md5(coalesce(string_agg(to_jsonb(t)::text,',' order by id),'')) from public.tenbot_chris_dev_canary_grants t),
 'grantAudit',(select md5(coalesce(string_agg(to_jsonb(t)::text,',' order by id),'')) from public.tenbot_chris_dev_canary_grant_audit t),
 'profiles',(select md5(coalesce(string_agg(to_jsonb(t)::text,',' order by user_id),'')) from public.app_users t),
 'capabilities',(select md5(coalesce(string_agg(to_jsonb(t)::text,',' order by role,capability),'')) from public.app_role_capabilities t),
 'stock',(select md5(coalesce(string_agg(to_jsonb(t)::text,',' order by id),'')) from public.inventory_items t),
 'transactions',(select count(*) from public.inventory_transactions),
 'pending',(select md5(coalesce(string_agg(to_jsonb(t)::text,',' order by id),'')) from public.pending_receivals t),
 'pilot',(select to_jsonb(t) from public.tenbot_receival_pilot_policy t where singleton),
 'execution',(select to_jsonb(t) from public.tenbot_receival_execution_control t where singleton),
 'enrollment',(select count(*) from public.tenbot_receival_pilot_employees),
 'canon',(select jsonb_object_agg(proname,md5(prosrc)) from pg_proc where oid in(
 'public.activate_tenbot_chris_dev_canary_grant(timestamptz,text)'::regprocedure,
 'public.revoke_tenbot_chris_dev_canary_grant(uuid,text)'::regprocedure,
 'public.get_my_tenbot_receival_canary_access()'::regprocedure)))`;
const sql=(label:string,value:string)=>fixtureSql('control-'+label+'-'+run,value);
async function signed(actor:Actor){
 const client=createClient(fixture.url,fixture.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,init={})=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  assert.equal(url.origin,fixture.url);assert(['/auth/v1/token','/auth/v1/user'].includes(url.pathname));httpCalls++;
  return fetch(input,{...init,signal:AbortSignal.timeout(8000)});
 }}});
 const login=await client.auth.signInWithPassword({email:actor.email,password:actor.password});
 assert(!login.error&&login.data.session&&login.data.user?.id===actor.id,'Existing synthetic sign-in failed');
 const verified=await client.auth.getUser(login.data.session.access_token);
 assert(!verified.error&&verified.data.user?.id===actor.id,'Synthetic Auth verification failed');
 const claims=JSON.parse(Buffer.from(login.data.session.access_token.split('.')[1],'base64url').toString());
 assert.equal(claims.sub,actor.id);assert.equal(claims.role,'authenticated');
 assert.equal(claims.iss,fixture.url+'/auth/v1');
 // Only the verified role/sub are used for SQL role simulation; no token,
 // signature, email, refresh credential or full Auth claims enter SQL evidence.
 return {sub:actor.id,role:'authenticated'};
}
const setActor=(claims:{sub:string;role:string})=>`reset role;set local role authenticated;do $claims$ begin perform set_config('request.jwt.claims',${quote(JSON.stringify(claims))},true);end $claims$;`;
const capture=(name:string,expression:string)=>`do $capture$ begin perform set_config('tenbot.control_${name}',(${expression})::text,true);end $capture$;`;
const denied=(name:string,claims:{sub:string;role:string})=>setActor(claims)+`do $deny$ begin begin perform public.${functionName}();raise exception 'Unexpected fixed-canary access';exception when insufficient_privilege then perform set_config('tenbot.control_${name.replaceAll('-','_')}','true',true);end;end $deny$;`;
try{
 const before=sql('before',`begin read only;select jsonb_build_object('label','before','functionAbsent',to_regprocedure('${signature}') is null,'state',${dataState}) as check;commit;`)[0].check as Record<string,unknown>;
 assert.equal(before.functionAbsent,true,'Existing fixture object must not be overwritten');
 const baseline=before.state as Record<string,unknown>;
 assert.equal((baseline.pilot as {enabled:boolean}).enabled,false);assert.equal((baseline.execution as {execution_enabled:boolean}).execution_enabled,false);assert.equal(baseline.enrollment,0);
 phase='synthetic-auth';const [admin,self,other,employee]=await Promise.all([signed(actors.admin),signed(actors.subject),signed(actors.otherDeveloper),signed(actors.otherEmployee)]);
 phase='rollback-only-status-validation';
 const transaction=`begin;${inner}
 ${capture('acl',`jsonb_build_object('authenticatedExecute',has_function_privilege('authenticated','${signature}','EXECUTE'),
 'anonymousExecute',has_function_privilege('anon','${signature}','EXECUTE'),
 'serviceExecute',has_function_privilege('service_role','${signature}','EXECUTE'),
 'privateGrantSelect',has_table_privilege('authenticated','public.tenbot_chris_dev_canary_grants','SELECT'),
 'privateAuditSelect',has_table_privilege('authenticated','public.tenbot_chris_dev_canary_grant_audit','SELECT'))`)}
 ${setActor(admin)}${capture('admin',`public.${functionName}()`)}
 ${setActor(self)}${capture('owner',`public.${functionName}()`)}
 ${denied('other-developer',other)}${denied('other-employee',employee)}
 reset role;select jsonb_build_object('acl',current_setting('tenbot.control_acl')::jsonb,
 'admin',current_setting('tenbot.control_admin')::jsonb,'owner',current_setting('tenbot.control_owner')::jsonb,
 'otherDeveloperDenied',current_setting('tenbot.control_other_developer')::boolean,
 'otherEmployeeDenied',current_setting('tenbot.control_other_employee')::boolean,'state',${dataState}) as result;
 rollback;`;
 const resultRow=sql('rollback',transaction).find(row=>row.result)?.result as Record<string,unknown>|undefined;
 assert(resultRow,'Missing aggregated PostgreSQL result');
 const acl=resultRow.acl as Record<string,unknown>;assert.equal(acl.authenticatedExecute,true);
 for(const key of ['anonymousExecute','serviceExecute','privateGrantSelect','privateAuditSelect'])assert.equal(acl[key],false,key);
 const a=resultRow.admin as Record<string,unknown>,o=resultRow.owner as Record<string,unknown>;
 assert.equal(a.schemaVersion,'tenbot-canary-control.v1');assert.equal(a.viewer,'admin');assert.equal(o.viewer,'owner');
 assert.equal(a.ownerId,owner);assert.equal(o.ownerId,owner);
 for(const status of [a,o]){assert.equal(status.grantConflict,false);assert.equal((status.database as {pilotEnabled:boolean}).pilotEnabled,false);assert.equal((status.database as {executionEnabled:boolean}).executionEnabled,false);assert.equal((status.database as {enrollmentCount:number}).enrollmentCount,0);}
 assert.equal(o.activationBlock,'admin-required');
 if(a.grant){const g=a.grant as Record<string,unknown>;assert.equal(typeof g.activatedBy,'string');assert(!Object.hasOwn(g,'executedDraftId'));}
 if(o.grant){const g=o.grant as Record<string,unknown>;assert(Object.hasOwn(g,'executedDraftId'));assert(!Object.hasOwn(g,'activatedBy'));assert.equal(g.active,false);}
 assert(!JSON.stringify(a).match(/sourceText|storagePath|createdRecordIds|rawLines|filename|question|message|approvedDraftId/));
 assert.equal(resultRow.otherDeveloperDenied,true);assert.equal(resultRow.otherEmployeeDenied,true);
 assert.deepEqual(resultRow.state,baseline,'Status queries changed existing state');
 phase='post-rollback-readback';
 const after=sql('after',`begin read only;select jsonb_build_object('label','after','functionAbsent',to_regprocedure('${signature}') is null,'state',${dataState}) as check;commit;`)[0].check as Record<string,unknown>;
 assert.equal(after.functionAbsent,true);assert.deepEqual(after.state,baseline);
 const groups=['Fresh existing synthetic Auth JWTs verified without credential export.','Actual PostgreSQL migration syntax/predecessor pins and least-privilege function/table ACLs; transaction rolled back.','Existing authorized Admin sees only fixed grant lifecycle metadata.','Fixed self caller recovers its existing closed execution identity without another grant.','Unrelated Developer and employee are denied by the actual function.','Status is read-only; permission/profile/gate/grant/audit/stock/pending/canonical hashes unchanged, function absent after rollback.'];
 const result={passed:true,groups,fixtureRef:RECEIVAL_FIXTURE_REF,migration,migrationSha256:digest(source),authHttpCalls:httpCalls,validationMode:'Real PostgreSQL role-context simulation using Auth-verified synthetic role/sub. Not HTTP access to the unapplied RPC.',adminProjection:a,ownerProjection:o,acl,prePostStateUnchanged:true,ddlRolledBack:true,committedSchemaChanges:0,permissionDataChanges:0,grantActivations:0,operationalWrites:0,inferenceCalls:0,productionRequests:0,remainingGate:'Apply the accepted status migration at separately approved staging, then verify its actual authenticated RPC/UI transport without activating a grant.'};
 writeFileSync(folder+'/database-status-result.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({passed:true,groups:groups.length,ddlRolledBack:true,grantActivations:0,operationalWrites:0,report:folder+'/database-status-result.json'}));
}catch(error){
 writeFileSync(folder+'/database-status-failure.json',JSON.stringify({passed:false,phase,httpCalls,productionRequests:0,grantActivations:0,operationalWrites:0,message:error instanceof Error?error.message:'Bounded fixture validation failed'},null,2)+'\n');
 console.error(JSON.stringify({passed:false,phase,message:error instanceof Error?error.message:'Bounded fixture validation failed'}));process.exitCode=1;
}
