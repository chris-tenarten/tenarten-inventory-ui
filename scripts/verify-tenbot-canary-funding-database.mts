/** Focused REAL PostgreSQL counter/expiry proof in the existing isolated Free
 * fixture. No paid inference, Production request, business write or source edit.
 *
 * The only existing exact original is retained historical synthetic evidence.
 * The public reserve MUST reject that source. A private, disposable fixture
 * relation copies its immutable metadata with an uploading lifecycle, and an
 * exact normalized reserve clone substitutes ONLY that relation lookup. This
 * permits real concurrent budget/lock tests against the production funding,
 * usage, grants, roles, Storage metadata and catalog without altering history.
 * It is NOT positive source-lifecycle/RLS or uploaded-byte validation evidence.
 * The setup grant is a postgres synthetic fixture insert, not proof of Admin
 * activation. Prior canonical authorization evidence is reused separately.
 *
 * Root must apply the exact accepted prerequisite/status + dormant funding
 * migration to the fixed fixture first. Script refuses an already-used window.
 */
import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,lstatSync,mkdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {RECEIVAL_FIXTURE_REF,RECEIVAL_ACTOR_CONFIG,RECEIVAL_FIXTURE_DIR,receivalFixtureConfig,fixtureSql} from './support/tenbot-receival-fixture.mjs';

assert.deepEqual(process.argv.slice(2),['--authorized-isolated-fixture']);
assert.equal(RECEIVAL_FIXTURE_REF,'jltgxcfiprocydhbrahz');
process.env.TENBOT_RECEIVAL_FIXTURE_CONFIG=RECEIVAL_ACTOR_CONFIG;
const fixture=receivalFixtureConfig(),owner='3785f6b9-742e-452f-af6c-31613a983633';
assert.equal(fixture.url,'https://jltgxcfiprocydhbrahz.supabase.co');
const actorFile='/private/tmp/tenops-tenbot-chris-dev-grant-20261030/fixture-actors.private.json';
const actorStat=lstatSync(actorFile);
assert(actorStat.isFile()&&!actorStat.isSymbolicLink()&&actorStat.uid===process.getuid?.()&&(actorStat.mode&0o077)===0);
type Actor={id:string;email:string;password:string};
const actors=JSON.parse(readFileSync(actorFile,'utf8')) as {fixtureRef:string;subject:Actor;admin:Actor;otherDeveloper:Actor;otherEmployee:Actor};
assert.equal(actors.fixtureRef,RECEIVAL_FIXTURE_REF);assert.equal(actors.subject.id,owner);
const migration='supabase/migrations/20261031010000_tenbot_canary_funding_window.sql';
const migrationSource=readFileSync(migration,'utf8');
const run=randomBytes(4).toString('hex'),schema='tenbot_canary_funding_fixture_'+run;
assert(/^[a-z0-9_]+$/.test(schema));
const dir='/private/tmp/tenops-tenbot-canary-funding-20261031/'+run;
mkdirSync(dir,{recursive:true});
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const quote=(s:string)=>"'"+s.replaceAll("'","''")+"'";
const save=(name:string,v:unknown,privateFile=false)=>writeFileSync(dir+'/'+name,JSON.stringify(v,null,2)+'\n',{mode:privateFile?0o600:0o644});
const sql=(label:string,value:string)=>fixtureSql('funding-'+label+'-'+run,value);
const sourceId='edd97a2e-43cc-4734-a5dd-f8ff316417c0',grantId=randomUUID(),requestId=randomUUID();
const ordinarySignature='public.tenbot_openai_reserve(uuid,uuid,uuid,text,bigint)';
const reserveSignature='public.tenbot_openai_canary_reserve(uuid,uuid,uuid,text,bigint,text,uuid,uuid)';
const clone=schema+'.tenbot_openai_canary_reserve';
const ids={first:randomUUID(),unknown:randomUUID(),raceA:randomUUID(),raceB:randomUUID(),late:randomUUID()};
const sourceLookup='from public.invoice_receival_sources where id=p_source_id and owner_user_id=p_user for share';
const cloneLookup='from '+schema+'.invoice_receival_sources where id=p_source_id and owner_user_id=p_user for share';
const policyState=`(select to_jsonb(p) from public.tenbot_openai_policy p where singleton)`;
const stateSql=`jsonb_build_object(
 'policy',${policyState},
 'profiles',(select md5(coalesce(string_agg(to_jsonb(u)::text,',' order by user_id),'')) from public.app_users u),
 'capabilities',(select md5(coalesce(string_agg(to_jsonb(c)::text,',' order by role,capability),'')) from public.app_role_capabilities c),
 'source',(select to_jsonb(s) from public.invoice_receival_sources s where id=${quote(sourceId)}),
 'sourceTrigger',(select pg_get_triggerdef(oid) from pg_trigger where tgrelid='public.invoice_receival_sources'::regclass and tgname='invoice_sources_identity_guard'),
 'sourceIndex',(select pg_get_indexdef(indexrelid) from pg_index where indexrelid='public.invoice_source_owner_digest_live'::regclass),
 'canonical',(select jsonb_object_agg(oid::regprocedure::text,md5(prosrc)) from pg_proc where oid in(
 '${ordinarySignature}'::regprocedure,'public.tenbot_openai_settle(uuid,uuid,bigint)'::regprocedure,
 'public.activate_tenbot_chris_dev_canary_grant(timestamptz,text)'::regprocedure,
 'public.revoke_tenbot_chris_dev_canary_grant(uuid,text)'::regprocedure,
 'public.get_tenbot_chris_dev_canary_control_status()'::regprocedure)),
 'gates',jsonb_build_object('pilot',(select enabled from public.tenbot_receival_pilot_policy where singleton),
 'execution',(select execution_enabled from public.tenbot_receival_execution_control where singleton),'enrollments',(select count(*) from public.tenbot_receival_pilot_employees)),
 'business',jsonb_build_object('pending',(select count(*) from public.pending_receivals),'stock',(select md5(coalesce(string_agg(to_jsonb(i)::text,',' order by id),'')) from public.inventory_items i),
 'drafts',(select count(*) from public.invoice_receival_drafts),'executions',(select count(*) from public.invoice_receival_executions)),
 'oldUsage',(select md5(coalesce(string_agg(to_jsonb(u)::text,',' order by id),'')) from public.tenbot_openai_usage u where not exists(select 1 from public.tenbot_chris_dev_canary_usage m where m.usage_id=u.id)))`;
let phase='baseline',httpCalls=0,setupCommitted=false,setupAttempted=false;
const groups:{name:string;durationMs:number}[]=[];
const group=async(name:string,test:()=>Promise<void>)=>{phase=name;const start=Date.now();await test();groups.push({name,durationMs:Date.now()-start});save('progress.json',{groups});console.log(JSON.stringify({group:groups.length,name,passed:true}));};
const claims=(role:string,sub?:string)=>`do $claims$ begin perform set_config('request.jwt.claims',${quote(JSON.stringify({role,...(sub?{sub}:{})}))},true);end $claims$;`;
const service=(query:string)=>`begin;set local role service_role;${claims('service_role')}${query}commit;`;
// Management SQL returns only its final rowset. Capture intermediate results in
// transaction-local GUCs, then emit exactly one final SELECT per query group.
const capture=(key:string,expression:string)=>`do $capture$ begin perform set_config('tenbot.funding_${key}',(${expression})::text,true);end $capture$;`;
const captured=(key:string)=>`current_setting('tenbot.funding_${key}')::jsonb`;
function args(id:string,amount:number,overrides:Record<string,string|number>={}){
 const p={user:owner,request:requestId,id,model:'gpt-6.1-terra',amount,origin:'https://tendev.pages.dev',source:sourceId,grant:grantId,...overrides};
 return [p.user,p.request,p.id,p.model,p.amount,p.origin,p.source,p.grant].map(x=>typeof x==='number'?String(x):quote(x)).join(',');
}
function expected(sqlExpression:string,code:string){return `do $denied$ begin begin perform ${sqlExpression};raise exception 'Expected focused rejection' using errcode='XX000';exception when sqlstate '${code}' then null;end;end $denied$;`;}
async function signed(actor:Actor){
 const c=createClient(fixture.url,fixture.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,init={})=>{
  const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  assert.equal(u.origin,fixture.url);assert(['/auth/v1/token','/auth/v1/user'].includes(u.pathname));httpCalls++;
  return fetch(input,{...init,signal:AbortSignal.timeout(8000)});
 }}});
 const login=await c.auth.signInWithPassword({email:actor.email,password:actor.password});
 assert(!login.error&&login.data.user?.id===actor.id&&login.data.session,'Synthetic Auth sign-in failed');
 const verified=await c.auth.getUser(login.data.session.access_token);
 assert(!verified.error&&verified.data.user?.id===actor.id,'Synthetic Auth verification failed');
 const cclaims=JSON.parse(Buffer.from(login.data.session.access_token.split('.')[1],'base64url').toString());
 assert.equal(cclaims.sub,actor.id);assert.equal(cclaims.role,'authenticated');assert.equal(cclaims.iss,fixture.url+'/auth/v1');
 return {sub:actor.id,role:'authenticated'};
}
async function sqlConcurrent(label:string,query:string):Promise<Record<string,unknown>[]> {
 const file=RECEIVAL_FIXTURE_DIR+'/funding-'+label+'-'+run+'.sql';writeFileSync(file,query+'\n',{mode:0o600});
 return await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['/private/tmp/tenops-tenbot-hosted-adapter-20261029/branch-query.mjs','--file',file],{stdio:['ignore','pipe','pipe']});
  let out='',err='';const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Concurrent fixture SQL exceeded 15 seconds'));},15000);
  child.stdout.on('data',v=>{out+=String(v);if(out.length>2e6)child.kill('SIGKILL');});
  child.stderr.on('data',v=>{err+=String(v);if(err.length>10000)child.kill('SIGKILL');});
  child.once('error',error=>{clearTimeout(timer);reject(new Error('Concurrent fixture subprocess unavailable: '+error.name));});
  child.once('close',code=>{clearTimeout(timer);try{const r=JSON.parse(out);assert(code===0&&r.ok===true&&Array.isArray(r.rows),'Bounded concurrent fixture SQL failed');resolve(r.rows);}catch{reject(new Error('Bounded concurrent fixture SQL failed'));}});
 });
}
let baseline:Record<string,unknown>,expiresAt='';
try{
 await group('Pristine dormant migration and immutable synthetic evidence baseline',async()=>{
  const r=sql('baseline',`begin read only;select ${stateSql} as state,
   (select to_jsonb(f) from public.tenbot_chris_dev_canary_funding f where singleton) as funding,
   (select count(*) from public.tenbot_chris_dev_canary_usage) as mapped,
   (select count(*) from public.tenbot_chris_dev_canary_grants where revoked_at is null) as unrevoked,
   (select pg_get_functiondef('${reserveSignature}'::regprocedure)) as reserve_definition;commit;`)[0];
  baseline=r.state as Record<string,unknown>;save('baseline.private.json',r,true);
  const f=r.funding as Record<string,unknown>;assert.equal(f.enabled,false);assert.equal(f.starts_at,null);assert.equal(f.expires_at,null);assert.equal(f.bound_grant_id,null);assert.equal(f.bound_source_id,null);assert.equal(r.mapped,0);assert.equal(r.unrevoked,0);
  assert.deepEqual(baseline.gates,{pilot:false,execution:false,enrollments:0});
  const source=baseline.source as Record<string,unknown>;assert.equal(source.owner_user_id,owner);assert.equal(source.lifecycle_state,'retained');assert.equal(source.byte_size,2877);assert.equal(source.content_type,'application/pdf');assert.equal(source.sha256,'c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a');
  const def=r.reserve_definition as string;assert.equal(def.split(sourceLookup).length,2,'Only one exact source relation substitution is permitted');
  const policy=baseline.policy as Record<string,unknown>;assert(Number(policy.request_limit_microusd)>=250000&&Number(policy.user_day_limit_microusd)>=250000,'Fixture needs existing conservative nonzero per-request/user caps; do not silently reconfigure it');
 });
 let admin:{sub:string;role:string},self:{sub:string;role:string},other:{sub:string;role:string},employee:{sub:string;role:string};
 await group('Existing synthetic Auth JWTs verified without secret export',async()=>{[admin,self,other,employee]=await Promise.all([signed(actors.admin),signed(actors.subject),signed(actors.otherDeveloper),signed(actors.otherEmployee)]);});
 await group('Dormant exact RPC, role ACLs, finite-window and no-reset constraints',async()=>{
  const actor=(who:{sub:string;role:string})=>`reset role;set local role authenticated;${claims(who.role,who.sub)}`;
  const r=sql('dormant',`begin;
   ${capture('acl',`jsonb_build_object('callerReserve',has_function_privilege('authenticated','${reserveSignature}','EXECUTE'),
   'serviceReserve',has_function_privilege('service_role','${reserveSignature}','EXECUTE'),
   'callerFundingSelect',has_table_privilege('authenticated','public.tenbot_chris_dev_canary_funding','SELECT'),
   'serviceFundingSelect',has_table_privilege('service_role','public.tenbot_chris_dev_canary_funding','SELECT'))`)}
   ${actor(admin!)}${capture('admin','public.get_tenbot_chris_dev_canary_funding_status()')}
   ${actor(self!)}${capture('owner','public.get_tenbot_chris_dev_canary_funding_status()')}
   ${actor(other!)}${expected('public.get_tenbot_chris_dev_canary_funding_status()','42501')}
   ${actor(employee!)}${expected('public.get_tenbot_chris_dev_canary_funding_status()','42501')}
   reset role;set local role service_role;${claims('service_role')}
   ${expected('public.tenbot_openai_canary_reserve('+args(randomUUID(),1)+')','P0001')}
   reset role;${expected("public.activate_tenbot_chris_dev_canary_grant(clock_timestamp()+interval '2 minutes','No authenticated caller')",'42501')}
   do $constraints$ begin
    begin update public.tenbot_chris_dev_canary_funding set enabled=true,starts_at=clock_timestamp(),expires_at=clock_timestamp()+interval '16 minutes';raise exception 'Expected window rejection' using errcode='XX000';exception when check_violation then null;end;
    begin update public.tenbot_chris_dev_canary_funding set budget_microusd=250001;raise exception 'Expected cap rejection' using errcode='XX000';exception when check_violation then null;end;
   end $constraints$;
   select ${captured('acl')} as acl,${captured('admin')} as admin,${captured('owner')} as owner;rollback;`);
  const acl=r.find(x=>x.acl)?.acl as Record<string,unknown>;assert.deepEqual(acl,{callerReserve:false,serviceReserve:true,callerFundingSelect:false,serviceFundingSelect:false});
  for(const key of ['admin','owner']){const s=r.find(x=>x[key])?.[key] as Record<string,unknown>;assert.equal(s.schemaVersion,'tenbot-canary-funding.v1');assert.equal(s.active,false);assert.equal(s.enabled,false);assert.equal(s.remainingMicrousd,250000);assert.equal(s.grantId,null);}
 });
 await group('Exact public reserve positive/negative metadata contract; all fixture setup rolled back',async()=>{
  const source=randomUUID(),grant=randomUUID(),request=randomUUID(),usage=randomUUID();
  const path=owner+'/'+source+'/original';
  const exactArgs=(id:string)=>args(id,1000,{source,grant,request});
  // Transaction-local index suspension permits one synthetic sibling at the
  // fixed digest without changing the retained original. Its new Storage row
  // is metadata-only test setup, NOT proof of object-byte upload/inference.
  // Both index definition and all synthetic rows are restored by ROLLBACK.
  const r=sql('exact-public-rollback',`begin;
   update public.tenbot_chris_dev_canary_funding set enabled=true,starts_at=clock_timestamp(),expires_at=clock_timestamp()+interval '2 minutes' where singleton;
   insert into public.tenbot_chris_dev_canary_grants(id,owner_user_id,starts_at,expires_at,activated_by,reason)
    select ${quote(grant)},${quote(owner)},clock_timestamp(),expires_at,${quote(actors.admin.id)},'Rollback-only synthetic exact reserve metadata proof'
    from public.tenbot_chris_dev_canary_funding where singleton;
   drop index public.invoice_source_owner_digest_live;
   ${claims('authenticated',owner)}
   insert into public.invoice_receival_sources(id,owner_user_id,original_filename,content_type,byte_size,sha256,storage_path)
    values(${quote(source)},${quote(owner)},'rollback-only-fixed-canary.pdf','application/pdf',2877,
     'c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a',${quote(path)});
   set local role service_role;${claims('service_role')}
   ${expected('public.tenbot_openai_canary_reserve('+exactArgs(randomUUID())+')','42501')}
   reset role;${claims('authenticated',owner)}
   insert into storage.objects(bucket_id,name,metadata) values('invoice-receival-originals',${quote(path)},jsonb_build_object('size',2877,'mimetype','application/pdf'));
   set local role service_role;${claims('service_role')}
   ${capture('exact_reserved','public.tenbot_openai_canary_reserve('+exactArgs(usage)+')')}
   ${capture('exact_measured','public.tenbot_openai_canary_settle('+quote(owner)+','+quote(usage)+',500)')}
   select ${captured('exact_reserved')} as exact_reserved,${captured('exact_measured')} as exact_measured;
   rollback;`);
  assert.equal((r.find(x=>x.exact_reserved)?.exact_reserved as Record<string,unknown>).reservedMicrousd,1000);
  assert.equal((r.find(x=>x.exact_measured)?.exact_measured as Record<string,unknown>).accountedMicrousd,500);
  const after=sql('rollback-readback',`begin read only;select ${stateSql} as state,
   (select to_jsonb(f) from public.tenbot_chris_dev_canary_funding f where singleton) as funding,
   (select count(*) from public.tenbot_chris_dev_canary_usage) as mapped;commit;`)[0];
  assert.deepEqual(after.state,baseline!);assert.equal(after.mapped,0);
  const f=after.funding as Record<string,unknown>;assert.equal(f.enabled,false);assert.equal(f.starts_at,null);assert.equal(f.bound_grant_id,null);
 });
 await group('Fixture-only source relation clone; exact normalized reserve body and dormant gates',async()=>{
  setupAttempted=true;
  const r=sql('fixture-setup',`begin;
   create schema ${schema};revoke all on schema ${schema} from public,anon,authenticated,service_role;grant usage on schema ${schema} to service_role;
   create table ${schema}.invoice_receival_sources(like public.invoice_receival_sources including all);
   insert into ${schema}.invoice_receival_sources select (jsonb_populate_record(null::public.invoice_receival_sources,to_jsonb(s)||jsonb_build_object(
    'lifecycle_state','uploading','retained_at',null,'retained_draft_id',null,'created_at',clock_timestamp(),'expires_at',clock_timestamp()+interval '1 hour',
    'agent_state',null,'evidence_sha256',null,'verified_at',null,'version',0))).* from public.invoice_receival_sources s where id=${quote(sourceId)};
   do $clone$ declare definition text;begin
    select pg_get_functiondef('${reserveSignature}'::regprocedure) into definition;
    if length(definition)-length(replace(definition,${quote(sourceLookup)},''))<>length(${quote(sourceLookup)}) then raise exception 'Unexpected source lookup contract';end if;
    definition:=replace(definition,'public.tenbot_openai_canary_reserve(',${quote(clone+'(')});
    definition:=replace(definition,${quote(sourceLookup)},${quote(cloneLookup)});execute definition;
   end $clone$;
   revoke all on function ${clone}(uuid,uuid,uuid,text,bigint,text,uuid,uuid) from public,anon,authenticated,service_role;
   grant execute on function ${clone}(uuid,uuid,uuid,text,bigint,text,uuid,uuid) to service_role;
   update public.tenbot_chris_dev_canary_funding set enabled=true,starts_at=clock_timestamp(),expires_at=clock_timestamp()+interval '45 seconds' where singleton;
   insert into public.tenbot_chris_dev_canary_grants(id,owner_user_id,starts_at,expires_at,activated_by,reason)
    select ${quote(grantId)},${quote(owner)},clock_timestamp(),expires_at,${quote(actors.admin.id)},${quote('Synthetic fixture-only counter setup '+run)} from public.tenbot_chris_dev_canary_funding where singleton;
   insert into public.tenbot_chris_dev_canary_grant_audit(grant_id,actor_user_id,event,details)
    values(${quote(grantId)},${quote(actors.admin.id)},'activated',jsonb_build_object('fixtureOnly',true,'setup','direct synthetic counter fixture; not Admin RPC activation proof','run',${quote(run)}));
   select (select expires_at from public.tenbot_chris_dev_canary_funding where singleton) as expires,
    (select md5(replace(prosrc,${quote(cloneLookup)},${quote(sourceLookup)})) from pg_proc
     where oid='${clone}(uuid,uuid,uuid,text,bigint,text,uuid,uuid)'::regprocedure) as normalized_clone,
    (select md5(prosrc) from pg_proc where oid='${reserveSignature}'::regprocedure) as original;
   commit;`);
  setupCommitted=true;expiresAt=String(r.find(x=>x.expires)?.expires);
  assert.equal(r.find(x=>x.normalized_clone)?.normalized_clone,r.find(x=>x.original)?.original,'Normalized reserve body differs beyond source fixture relation');
  save('fixture-setup.json',{sourceFixtureSubstitutionOnly:true,sourceRowEdited:false,grantId,requestId,expiresAt,canonicalReserveBodyMd5:r.find(x=>x.original)?.original});
 });
 await group('Exact public retained-source denial and fixed-scope negative reservations',async()=>{
  const bad:{scope:Record<string,string>;code:string}[]=[{scope:{user:actors.otherDeveloper.id},code:'42501'},
   {scope:{origin:'https://tenops.pages.dev'},code:'42501'},{scope:{model:'gpt-6.1-sol'},code:'42501'},
   {scope:{grant:randomUUID()},code:'P0001'},{scope:{source:randomUUID()},code:'42501'}];
  sql('scope',service(expected('public.tenbot_openai_canary_reserve('+args(randomUUID(),1)+')','42501')+
   bad.map(p=>expected(clone+'('+args(randomUUID(),1,p.scope)+')',p.code)).join('')));
 });
 await group('Measured, uncertain, replay and one-request accounting',async()=>{
  const r=sql('accounting',service(`${capture('reserved',clone+'('+args(ids.first,30000)+')')}
   ${capture('measured','public.tenbot_openai_canary_settle('+quote(owner)+','+quote(ids.first)+',10000)')}
   ${capture('unknown_reserved',clone+'('+args(ids.unknown,20000)+')')}
   ${capture('uncertain','public.tenbot_openai_canary_settle('+quote(owner)+','+quote(ids.unknown)+',null)')}
   ${expected(clone+'('+args(ids.first,1)+')','23505')}
   ${expected(clone+'('+args(randomUUID(),1,{request:randomUUID()})+')','P0001')}
   ${expected('public.tenbot_openai_canary_settle('+quote(owner)+','+quote(ids.first)+',10001)','P0001')}
   select ${captured('measured')} as measured,${captured('uncertain')} as uncertain;`));
  assert.equal((r.find(x=>x.measured)?.measured as Record<string,unknown>).accountedMicrousd,10000);
  assert.equal((r.find(x=>x.uncertain)?.uncertain as Record<string,unknown>).accountedMicrousd,20000);
 });
 await group('Actual concurrent reservations serialize and cannot exceed finite cap',async()=>{
  const reserve=(id:string)=>service(`do $race$ begin begin perform set_config('tenbot.race_result',(${clone}(${args(id,120000)}))::text,true);
   exception when sqlstate 'P0001' then perform set_config('tenbot.race_result',jsonb_build_object('denied',true,'code',sqlstate)::text,true);end;end $race$;
   select current_setting('tenbot.race_result')::jsonb as result;`);
  const races=await Promise.all([sqlConcurrent('race-a',reserve(ids.raceA)),sqlConcurrent('race-b',reserve(ids.raceB))]);
  const results=races.map(rows=>rows.find(x=>x.result)?.result as Record<string,unknown>);
  assert.equal(results.filter(x=>x.ok===true).length,1);assert.equal(results.filter(x=>x.denied===true).length,1);
  const winner=String(results.find(x=>x.ok===true)?.id);
  sql('race-settle',service(`select public.tenbot_openai_canary_settle(${quote(owner)},${quote(winner)},80000);`));
  const r=sql('race-readback',`begin read only;select sum(coalesce(u.actual_microusd,u.reserved_microusd)) as accounted,count(*) as count from public.tenbot_chris_dev_canary_usage m join public.tenbot_openai_usage u on u.id=m.usage_id;commit;`)[0];
  assert.equal(Number(r.accounted),110000);assert.equal(Number(r.count),3);save('concurrency.json',{results,accountedMicrousd:r.accounted});
 });
 await group('Immutable window, source/request binding, preserved ordinary expiry and hard cap',async()=>{
  sql('immutable',`begin;
   update public.tenbot_openai_policy set enabled=false,expires_at=clock_timestamp()-interval '1 second' where singleton;
   set local role service_role;${claims('service_role')}
   ${expected("public.tenbot_openai_reserve('"+owner+"','"+randomUUID()+"','"+randomUUID()+"','gpt-6.1-terra',1)",'P0001')}
   reset role;
   do $immutable$ begin
    begin update public.tenbot_chris_dev_canary_funding set expires_at=expires_at+interval '1 second';raise exception 'Expected immutable window' using errcode='XX000';exception when check_violation then null;end;
    begin update public.tenbot_chris_dev_canary_funding set bound_request_id=gen_random_uuid();raise exception 'Expected immutable request' using errcode='XX000';exception when check_violation then null;end;
   end $immutable$;rollback;`);
  sql('hard-cap',service(expected(clone+'('+args(randomUUID(),140001)+')','P0001')+`select ${clone}(${args(ids.late,140000)}) as reserved;`));
  const state=sql('exact-cap-active',`begin;set local role authenticated;${claims('authenticated',owner)}
   select public.get_tenbot_chris_dev_canary_funding_status() as status;rollback;`)[0].status as Record<string,unknown>;
  assert.equal(state.accountedMicrousd,250000);assert.equal(state.remainingMicrousd,0);
  assert.equal(state.active,true,'A fully reserved allowance must not invalidate already-authorized deterministic operations');
 });
 await group('Real server expiry denies new spending independently of cleanup',async()=>{
  const remaining=Date.parse(expiresAt)-Date.now();assert(remaining<46000&&remaining>-10000,'Unexpected fixture execution clock');
  if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining+150));
  sql('expiry',service(expected(clone+'('+args(randomUUID(),1)+')','P0001')));
 });
 await group('Exact revocation, late/uncertain accounting, overrun isolation and no rearm',async()=>{
  const r=sql('late-settle',`begin;set local role authenticated;${claims('authenticated',actors.admin.id)}
   ${capture('revoked','public.revoke_tenbot_chris_dev_canary_grant('+quote(grantId)+','+quote('Synthetic funding fixture complete '+run)+')')}
   reset role;set local role service_role;${claims('service_role')}
   ${capture('late','public.tenbot_openai_canary_settle('+quote(owner)+','+quote(ids.late)+',140001)')}
   ${capture('still_uncertain','public.tenbot_openai_canary_settle('+quote(owner)+','+quote(ids.unknown)+',null)')}
   reset role;do $no_rearm$ begin
    begin update public.tenbot_chris_dev_canary_funding set enabled=true;raise exception 'Expected no-rearm protection' using errcode='XX000';exception when check_violation then null;end;
   end $no_rearm$;
   select ${captured('revoked')} as revoked,${captured('late')} as late,${captured('still_uncertain')} as still_uncertain,${policyState} as policy;commit;`);
  assert.equal((r.find(x=>x.revoked)?.revoked as Record<string,unknown>).revoked,true);
  assert.equal((r.find(x=>x.late)?.late as Record<string,unknown>).overrun,true);
  assert.equal((r.find(x=>x.still_uncertain)?.still_uncertain as Record<string,unknown>).accountedMicrousd,20000);
  assert.deepEqual(r.find(x=>x.policy)?.policy,baseline!.policy,'Canary failure changed ordinary spending policy');
 });
}catch(error){
 save('failure.json',{passed:false,phase,message:error instanceof Error?error.message:'Focused fixture failure',groups,productionRequests:0,inferenceCalls:0});
 console.error(JSON.stringify({passed:false,phase,message:error instanceof Error?error.message:'Focused fixture failure'}));process.exitCode=1;
}finally{
 if(setupAttempted){
  try{
   // Fixed fixture only; revoke exact grant if a setup response was uncertain.
   // Do not reset the used funding window or delete its accounting/audit rows.
   const after=sql('cleanup',`begin;
    update public.tenbot_chris_dev_canary_funding set enabled=false where singleton;
    do $cleanup$ begin
     if exists(select 1 from public.tenbot_chris_dev_canary_grants where id=${quote(grantId)} and revoked_at is null) then
      perform set_config('request.jwt.claims',${quote(JSON.stringify({role:'authenticated',sub:actors.admin.id}))},true);
      perform public.revoke_tenbot_chris_dev_canary_grant(${quote(grantId)},${quote('Focused synthetic funding fixture cleanup '+run)});
     end if;
    end $cleanup$;
    drop schema if exists ${schema} cascade;
    select ${stateSql} as state,
     (select enabled from public.tenbot_chris_dev_canary_funding where singleton) as funding_enabled,
     (select count(*) from public.tenbot_chris_dev_canary_grants where revoked_at is null) as unrevoked,
     to_regnamespace(${quote(schema)}) is null as fixture_schema_removed;
    commit;`)[0];
   assert.deepEqual(after.state,baseline!,'Existing source, index, trigger, ordinary accounting/policy or business evidence changed');
   assert.equal(after.funding_enabled,false);assert.equal(after.unrevoked,0);assert.equal(after.fixture_schema_removed,true);
   save('cleanup.json',{passed:true,sourceHistoryUnchanged:true,ordinaryPolicyAndPriorUsageUnchanged:true,fundingEnabled:false,unrevokedGrants:0,fixtureSchemaRemoved:true,oldAccountingPreserved:true,newFixtureAccountingRetained:true});
  }catch(error){save('cleanup-failure.json',{passed:false,grantId,schema,setupCommitted,message:error instanceof Error?error.message:'Exact fixture cleanup failed'});console.error(JSON.stringify({passed:false,phase:'fixture-cleanup',grantId,schema,message:'Exact synthetic fixture cleanup requires reconciliation; no automatic retry'}));process.exitCode=1;}
 }
 if(!process.exitCode){const result={passed:true,fixtureRef:RECEIVAL_FIXTURE_REF,migration,migrationSha256:hash(migrationSource),groups,authHttpCalls:httpCalls,
  actualPostgreSQL:true,concurrency:'Two independent PostgreSQL backend transactions against exact shared funding/usage locks and normalized reserve body.',
  limitations:['Positive source lifecycle uses a private synthetic source relation substitution; public exact RPC separately rejects retained source. No source history or triggers altered.','Synthetic fixture grant was direct operator setup, not Admin activation proof.','No inference or actual uploaded-byte interpretation performed.'],
  sourceHistoryUnchanged:true,ordinaryPolicyAndPriorUsageUnchanged:true,productionRequests:0,inferenceCalls:0,operationalWrites:0,fundingEnabled:false,activeGrants:0,enrollments:0};
  save('result.json',result);console.log(JSON.stringify({passed:true,groups:groups.length,report:dir+'/result.json',productionRequests:0,inferenceCalls:0,operationalWrites:0}));}
}
