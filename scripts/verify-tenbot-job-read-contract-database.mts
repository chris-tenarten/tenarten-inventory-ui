/** Focused real Job-read/JWT/RLS checks. Fixed isolated Free fixture only.
 * No persistent migration, reset, Production access, inference, Inventory or assistant-history writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {createTenbotJobTools,type JobToolCaller,type JobToolResult} from '../supabase/functions/_shared/tenbot-job-tools';

const REF='jltgxcfiprocydhbrahz';
const CONFIG='/private/tmp/tenops-tenbot-hosted-adapter-20261029/free-project-credentials.private.json';
const HELPER='/private/tmp/tenops-tenbot-hosted-adapter-20261029/branch-query.mjs';
const RECEIPT_MIGRATION='supabase/migrations/20261101210000_job_read_status_receipts.sql';
assert.deepEqual(process.argv.slice(2),['--isolated-free-fixture'],'Explicit isolated-fixture switch required');
const stat=fs.lstatSync(CONFIG);
assert(stat.isFile()&&!stat.isSymbolicLink()&&(stat.mode&0o077)===0&&stat.uid===process.getuid?.(),'Owner-only existing fixture config required');
const cfg=JSON.parse(fs.readFileSync(CONFIG,'utf8'));
assert(cfg.fixtureKind==='standalone-free'&&cfg.projectRef===REF&&cfg.branchRef===REF&&cfg.url==='https://'+REF+'.supabase.co','Fixed standalone Free fixture required');
const suffix=randomBytes(6).toString('hex'),marker='tenbot-job-read-20261101-'+suffix;
const DIR='/private/tmp/tenops-tenbot-job-read-20261101/database-'+suffix;
fs.mkdirSync(DIR,{recursive:true,mode:0o700});
const save=(name:string,value:unknown)=>fs.writeFileSync(DIR+'/'+name,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});
const quote=(v:string)=>"'"+v.replaceAll("'","''")+"'";
const scopePolicy='tenbot_read_scope_'+suffix,revokePolicy='tenbot_read_revoke_'+suffix;
const statuses=['in_production','on_deck','on_hold','shipped'];
const actors=['member','admin'].map((role,i)=>({id:randomUUID(),role,email:'job-read-'+randomUUID()+'@tenbot-fixture.example.invalid',password:'Synthetic-'+randomBytes(24).toString('base64url'),display:'Synthetic Job Read '+suffix+' '+i}));
const jobs=Array.from({length:13},(_,i)=>({
 id:randomUUID(),number:'READ-'+suffix+'-'+String(i+1).padStart(2,'0'),
 name:i===1||i===2?'Synthetic Read Shared '+suffix:'Synthetic Read Contract '+suffix+' '+(i+1),
 status:i<8?statuses[i%4]:['shipped','complete','in_production','on_hold','on_hold'][i-8],
 archived:i>=4&&i<8||i===11,
}));
const cycles=[{job:8,status:'in_production'},{job:9,status:'on_deck'},{job:10,status:'shipped'},{job:11,status:'on_deck'},{job:12,status:'complete'}].map(x=>({...x,id:randomUUID()}));
const actorSql=actors.map(a=>quote(a.id)+'::uuid').join(','),jobSql=jobs.map(j=>quote(j.id)+'::uuid').join(','),cycleSql=cycles.map(c=>quote(c.id)+'::uuid').join(',');
const checks:string[]=[],events:{caller:string;method:string;path:string}[]=[],deadline=Date.now()+300000;
let serial=0,cleanup=false,seedAttempted=false,midReadRevocation=false;
const attemptedActors=new Set<string>(),createdActors=new Set<string>();
save('actors.private.json',actors);
save('scope.json',{fixture:REF,marker,roles:actors.map(a=>a.role),jobIds:jobs.map(j=>j.id),cycleIds:cycles.map(c=>c.id),policies:[scopePolicy,revokePolicy],inference:false,ProductionRequests:0});

function sql(name:string,query:string):Record<string,unknown>[] {
 const file=DIR+'/'+String(++serial).padStart(2,'0')+'-'+name+'.sql';
 fs.writeFileSync(file,query,{mode:0o600,flag:'wx'});
 let raw:string;
 try{raw=execFileSync(process.execPath,[HELPER,'--file',file],{encoding:'utf8',timeout:12000,stdio:['ignore','pipe','pipe'],maxBuffer:2000000});}
 catch{throw Error('Bounded isolated fixture SQL failed: '+name);}
 const result=JSON.parse(raw);assert(result.ok,'Isolated fixture SQL rejected: '+name);return result.rows;
}
function dropOwnedPolicy(name:string):string {
 assert(/^tenbot_read_(?:scope|revoke)_[a-f0-9]{12}$/.test(name));
 return `do $cleanup$ declare target oid;begin select oid into target from pg_policy where polrelid='public.jobs'::regclass and polname=${quote(name)};if target is not null then if obj_description(target,'pg_policy') is distinct from ${quote(marker)} then raise exception 'Fixture policy ownership mismatch';end if;execute 'drop policy ${name} on public.jobs';end if;end $cleanup$;`;
}
function revokeOne():void {
 sql('revoke-one',`begin;create policy ${revokePolicy} on public.jobs as restrictive for select to authenticated using(auth.uid()<>${quote(actors[0].id)}::uuid or id<>${quote(jobs[0].id)}::uuid);comment on policy ${revokePolicy} on public.jobs is ${quote(marker)};commit;`);
}
const allowedPaths=new Set(['/auth/v1/admin/users','/auth/v1/token','/auth/v1/user','/auth/v1/logout','/rest/v1/jobs','/rest/v1/production_rework_cycles','/rest/v1/rpc/has_app_capability','/rest/v1/rpc/tenbot_authorize_history_jobs']);
const fetcher=(caller:string):typeof fetch=>async(input,init)=>{
 assert(cleanup||Date.now()<deadline,'Focused fixture deadline');
 const url=new URL(String(input));assert.equal(url.origin,cfg.url,'No external or Production requests');
 assert(allowedPaths.has(url.pathname)||url.pathname.startsWith('/auth/v1/admin/users/'),'Unexpected fixture capability');
 const method=init?.method??'GET';events.push({caller,method,path:url.pathname});
 const response=await fetch(input,{...init,signal:AbortSignal.timeout(8000)});
 // A real restrictive RLS policy changes after the database returned the initial
 // Job rows but before the executor's final authorization read. No fake rows/JWTs.
 if(midReadRevocation&&caller==='member'&&url.pathname==='/rest/v1/jobs'&&response.ok&&url.searchParams.get('select')!=='id'){
  midReadRevocation=false;revokeOne();
 }
 return response;
};
const client=(key=cfg.anonKey,caller='anonymous')=>createClient(cfg.url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:fetcher(caller)}});
const service=client(cfg.serviceRoleKey,'fixture-setup'),clients:ReturnType<typeof client>[]=[];
const tools=(i:number)=>createTenbotJobTools(clients[i] as unknown as JobToolCaller,{deadlineMs:10000,now:()=>new Date('2026-11-01T18:00:00Z')});
const execute=(i:number,name:'find_jobs'|'get_production_overview',args:Record<string,unknown>)=>tools(i).execute(name,args);
function findData(result:JobToolResult){assert(result.data&&'jobs' in result.data,'Expected Job enumeration');return result.data;}
function overviewData(result:JobToolResult){assert(result.data&&'upcoming' in result.data&&'counts' in result.data,'Expected overview');return result.data;}
async function list(i:number,selection:string[],includeArchived:boolean,limit=1){
 const ids:string[]=[],pages:JobToolResult[]=[];let cursor:string|undefined;
 do{
  const result=await execute(i,'find_jobs',{statuses:selection,include_archived:includeArchived,limit,...(cursor?{cursor}:{})});
  assert(result.status==='ok'&&result.complete,'Complete authorized enumeration required');
  const data=findData(result);assert(data.jobs.length<=limit);pages.push(result);
  ids.push(...data.jobs.map(j=>j.job_id));assert.equal(new Set(ids).size,ids.length,'No repeated page IDs');
  assert.equal(data.has_more,data.next_cursor!==null);cursor=data.next_cursor??undefined;
  assert(pages.length<=jobs.length+1,'Bounded fixture pagination');
 }while(cursor);
 return{ids:ids.sort(),pages};
}
const expected=(selection:string[],includeArchived:boolean)=>jobs.filter((j,i)=>{
 const cycle=cycles.find(c=>c.job===i&&!['complete','cancelled'].includes(c.status));
 return (includeArchived||!j.archived)&&(!selection.length||selection.includes(cycle?.status??j.status));
}).map(j=>j.id).sort();

const receiptMetadata=`(select jsonb_build_object('definitionMd5',md5(pg_get_functiondef(p.oid)),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'signature',p.oid::regprocedure::text,'definer',p.prosecdef,'volatility',p.provolatile::text,'config',p.proconfig) from pg_proc p where p.oid=to_regprocedure('public.tenbot_operational_receipts_valid(jsonb)'))`;
function validateReceiptMigrationRollback():void {
 const original=sql('receipt-predecessor',`begin read only;select ${receiptMetadata} as metadata;commit;`)[0].metadata;
 assert(original,'Existing isolated receipt validation contract required');
 const source=fs.readFileSync(RECEIPT_MIGRATION,'utf8');
 assert.equal((source.match(/^begin;$/gmi)||[]).length,1,'One bounded migration transaction required');
 assert.equal((source.match(/^commit;$/gmi)||[]).length,1,'One migration commit marker required');
 const body=source.replace(/^begin;\r?\n/mi,'').replace(/^commit;\s*$/mi,'');
 const old=(name:string,args:Record<string,unknown>)=>[{id:randomUUID(),question:'Synthetic receipt contract',message:'Historical synthetic answer',createdAt:'2026-11-01T18:00:00Z',answeredAt:'2026-11-01T18:00:00Z',expiresAt:'2026-11-01T18:10:00Z',scopeDigest:'a'.repeat(64),sources:[],reads:[{name,args,digest:'b'.repeat(64)}]}];
 const cases:{label:string;value:unknown;valid:boolean}[]=[];
 for(const name of ['find_jobs','get_production_overview']){
  cases.push({label:name+' legacy args',value:old(name,{include_archived:false,limit:20}),valid:true});
  for(const selection of [[],['on_deck'],['in_production','on_deck','on_hold','shipped','not_started','complete','cancelled']])cases.push({label:name+' canonical statuses',value:old(name,{statuses:selection}),valid:true});
  for(const selection of [['unknown'],['on_deck','on_deck'],Array(8).fill('on_deck'),'on_deck',null,[1]])cases.push({label:name+' invalid statuses',value:old(name,{statuses:selection}),valid:false});
 }
 cases.push({label:'detail tool cannot acquire population filter',value:old('get_job_summary',{job_id:jobs[0].id,statuses:['on_deck']}),valid:false});
 const assertions=cases.map(test=>`if public.tenbot_operational_receipts_valid(${quote(JSON.stringify(test.value))}::jsonb) is distinct from ${test.valid} then raise exception ${quote('Receipt contract: '+test.label)};end if;`).join('\n');
 let result:Record<string,unknown>[]|undefined;
 try{
  result=sql('receipt-candidate-rollback',`begin;create temporary table job_read_receipt_baseline on commit drop as select pg_get_userbyid(proowner) as owner,proacl::text as acl,oid::regprocedure::text as signature,prosecdef as definer,provolatile::text as volatility,proconfig as config from pg_proc where oid=to_regprocedure('public.tenbot_operational_receipts_valid(jsonb)');${body}\ndo $receipt_contract$ declare prior record;candidate record;begin select * into prior from job_read_receipt_baseline;select pg_get_userbyid(proowner) as owner,proacl::text as acl,oid::regprocedure::text as signature,prosecdef as definer,provolatile::text as volatility,proconfig as config into candidate from pg_proc where oid=to_regprocedure('public.tenbot_operational_receipts_valid(jsonb)');if to_jsonb(prior) is distinct from to_jsonb(candidate) then raise exception 'Receipt owner/ACL/signature changed';end if;${assertions}end $receipt_contract$;select true as receipts_compatible;rollback;`);
 }finally{
  const restored=sql('receipt-rollback-readback',`begin read only;select ${receiptMetadata} as metadata;commit;`)[0].metadata;
  assert.deepEqual(restored,original,'Rollback must preserve exact original receipt function/owner/ACL');
 }
 assert(result?.some(row=>row.receipts_compatible===true));
 save('receipt-rollback.json',{passed:true,migration:RECEIPT_MIGRATION,sha256:createHash('sha256').update(source).digest('hex'),cases:cases.length,actualPostgreSQL:true,ownerAclSignaturePreserved:true,originalDefinitionRestored:true,persistentApplication:false,migrationLedgerChanged:false});
 checks.push('Real PostgreSQL rollback-only receipt compatibility accepts legacy/canonical filters, rejects invalid widening and preserves exact owner/ACL/signature/original function');
}

try{
 const pre=sql('preflight',`begin read only;select to_regprocedure('public.has_app_capability(text)') is not null as capability,(select relrowsecurity from pg_class where oid='public.jobs'::regclass) as job_rls,(select relrowsecurity from pg_class where oid='public.production_rework_cycles'::regclass) as rework_rls,(select count(*) from public.jobs where id in(${jobSql}))::int as existing_jobs,(select count(*) from public.app_users where user_id in(${actorSql}))::int as existing_profiles,(select count(*) from pg_policy where polrelid='public.jobs'::regclass and polname in(${quote(scopePolicy)},${quote(revokePolicy)}))::int as existing_policies;commit;`)[0];
 assert(pre.capability&&pre.job_rls&&pre.rework_rls&&pre.existing_jobs===0&&pre.existing_profiles===0&&pre.existing_policies===0,'Existing isolated RLS contracts/unused exact fixture IDs required');
 validateReceiptMigrationRollback();
 for(const actor of actors){
  attemptedActors.add(actor.id);
  const made=await service.auth.admin.createUser({id:actor.id,email:actor.email,password:actor.password,email_confirm:true,user_metadata:{fixtureTask:marker}});
  if(made.error&&[400,401,403,404,422].includes(made.error.status??0))attemptedActors.delete(actor.id);
  assert(!made.error&&made.data.user?.id===actor.id&&made.data.user?.user_metadata.fixtureTask===marker,'Synthetic Auth creation failed');createdActors.add(actor.id);
 }
 seedAttempted=true;
 sql('seed-owned',`begin;insert into public.app_users(user_id,display_name,role,is_active,read_only) values ${actors.map(a=>`(${quote(a.id)},${quote(a.display)},${quote(a.role)},true,false)`).join(',')};insert into public.jobs(id,name,job_number,customer,production_status,material_status,planned_start,planned_end,archived_at) values ${jobs.map(j=>`(${quote(j.id)},${quote(j.name)},${quote(j.number)},'Synthetic',${quote(j.status)},'ready','2026-11-01','2026-11-10',${j.archived?"'2026-10-31T12:00:00Z'":'null'})`).join(',')};insert into public.production_rework_cycles(id,job_id,sequence_number,production_status,planned_start,planned_end,updated_at) values ${cycles.map(c=>`(${quote(c.id)},${quote(jobs[c.job].id)},1,${quote(c.status)},'2026-11-01','2026-11-10',now())`).join(',')};create policy ${scopePolicy} on public.jobs as restrictive for select to authenticated using(auth.uid() not in(${actorSql}) or id in(${jobSql}));comment on policy ${scopePolicy} on public.jobs is ${quote(marker)};commit;`);
 for(const actor of actors){const c=client(cfg.anonKey,actor.role),r=await c.auth.signInWithPassword({email:actor.email,password:actor.password});assert(!r.error&&r.data.user?.id===actor.id&&r.data.session,'Genuine synthetic sign-in required');const u=await c.auth.getUser();assert(!u.error&&u.data.user?.id===actor.id,'Signed JWT identity verification failed');clients.push(c);}
 checks.push('Genuine synthetic Member/Admin JWTs use existing isolated RLS/capability contracts; setup credentials are never used for tool reads');

 for(let i=0;i<actors.length;i++)for(const includeArchived of [false,true])for(const status of statuses){
  const ids=expected([status],includeArchived),overview=await execute(i,'get_production_overview',{statuses:[status],include_archived:includeArchived,limit:20});
  assert(overview.status==='ok'&&overview.complete,'Complete current count required');
  assert.equal(overviewData(overview).counts.jobs,ids.length);
  const found=await list(i,[status],includeArchived);assert.deepEqual(found.ids,ids);
  assert.deepEqual([...overview.accessRefs??[]].sort(),ids,'Every counted Job is reauthorized/referenced');
 }
 checks.push('Four lifecycle count/list equivalence classes agree through real PostgreSQL for Member/Admin, archived excluded/included and one-row pagination');
 checks.push('Effective active Rework overrides original status before filtering; terminal Rework leaves original lifecycle; archived Rework remains archive-scoped');

 for(const includeArchived of [false,true]){
  const selected=['on_deck','on_hold'],count=await execute(0,'get_production_overview',{statuses:selected,include_archived:includeArchived});
  assert.equal(overviewData(count).counts.jobs,expected(selected,includeArchived).length);assert.deepEqual((await list(0,selected,includeArchived,2)).ids,expected(selected,includeArchived));
 }
 const omitted=await execute(0,'find_jobs',{}),empty=await execute(0,'find_jobs',{statuses:[]});assert.deepEqual(findData(omitted),findData(empty));
 checks.push('Composed status unions and omitted/empty-status compatibility share the same authorized population');

 const duplicate=await execute(0,'find_jobs',{query:'Synthetic Read Shared '+suffix,statuses:[],limit:20});assert(findData(duplicate).match==='exact');assert.deepEqual(findData(duplicate).jobs.map(j=>j.job_id).sort(),[jobs[1].id,jobs[2].id].sort());
 const invalid=await execute(0,'find_jobs',{statuses:['not_a_status']});assert.equal(invalid.status,'invalid_request');assert.equal(invalid.data,null);
 checks.push('Exact-name ambiguity returns both canonical choices; invalid lifecycle arguments return no facts');

 const anonymous=await createTenbotJobTools(client() as unknown as JobToolCaller,{deadlineMs:10000}).execute('get_production_overview',{statuses:['on_deck']});assert(anonymous.data===null&&!anonymous.complete&&['not_found_or_not_authorized','unavailable'].includes(anonymous.status));
 const raw=await client().from('jobs').select('id').in('id',jobs.map(j=>j.id));assert(raw.error||raw.data?.length===0,'Anonymous direct Job read must be denied');
 checks.push('Anonymous tool and direct REST access cannot reveal fixture Job records');

 revokeOne();
 const revokedCount=await execute(0,'get_production_overview',{statuses:['in_production']}),revokedList=await list(0,['in_production'],false);
 assert.equal(overviewData(revokedCount).counts.jobs,1);assert.deepEqual(revokedList.ids,[jobs[8].id]);
 const denied=await execute(0,'find_jobs',{query:jobs[0].id,statuses:[]});assert.equal(findData(denied).jobs.length,0);
 assert.equal(overviewData(await execute(1,'get_production_overview',{statuses:['in_production']})).counts.jobs,2);
 sql('restore-record',`begin;${dropOwnedPolicy(revokePolicy)}commit;`);
 checks.push('Real actor-specific record RLS revocation changes both populations and blocks exact identity; Admin remains scoped by its own JWT');

 midReadRevocation=true;
 const during=await execute(0,'get_production_overview',{statuses:['in_production']});
 assert(!midReadRevocation&&during.data===null&&!during.complete,'Final real RLS reauthorization must suppress revoked count');
 sql('restore-mid-read',`begin;${dropOwnedPolicy(revokePolicy)}commit;`);
 checks.push('Record permission revoked after initial PostgreSQL rows but before final authorization suppresses the entire count, not a stale or zero answer');

 sql('revoke-capability',`begin;update public.app_users set is_active=false where user_id=${quote(actors[0].id)} and display_name=${quote(actors[0].display)};commit;`);
 const identity=await clients[0].auth.getUser();assert(!identity.error&&identity.data.user?.id===actors[0].id,'JWT remains genuinely signed');
 const blocked=await execute(0,'find_jobs',{statuses:['on_deck']});assert(blocked.data===null&&!blocked.complete&&['not_found_or_not_authorized','unavailable'].includes(blocked.status));
 checks.push('Current capability revocation denies tool facts under a still-valid signed employee JWT');
 save('results.json',{passed:true,fixture:REF,groups:checks.length,checks,realPostgreSQL:true,genuineSignedJwtRls:true,syntheticIdentities:actors.length,syntheticJobs:jobs.length,syntheticReworks:cycles.length,paginationLimit:1,actualInferenceCalls:0,ProductionRequests:0,inventoryWrites:0,assistantHistoryWrites:0,migrationsApplied:0,httpCalls:events.length});
 console.log(JSON.stringify({passed:true,groups:checks.length,fixture:REF,evidence:DIR,actualSignedJwtRls:true,inferenceCalls:0}));
}catch(error){save('stop.json',{passed:false,checks,reason:error instanceof Error?error.message.split('\n')[0].slice(0,200):'Focused fixture stopped',ProductionRequests:0});throw error;}
finally{
 cleanup=true;midReadRevocation=false;
 let recordsRemoved=!seedAttempted,authResolved=0,authRemoved=0,authAbsent=0;
 try{
  if(seedAttempted||createdActors.size){
   const profiles=actors.filter(a=>createdActors.has(a.id)).map(a=>`(user_id=${quote(a.id)}::uuid and display_name=${quote(a.display)})`).join(' or ')||'false';
   const ownedJobs=jobs.map(j=>`(id=${quote(j.id)}::uuid and job_number=${quote(j.number)})`).join(' or ');
   const r=sql('cleanup-owned',`begin;${dropOwnedPolicy(revokePolicy)}${dropOwnedPolicy(scopePolicy)}delete from public.production_rework_cycles where id in(${cycleSql}) and job_id in(select id from public.jobs where ${ownedJobs});delete from public.jobs where ${ownedJobs};delete from public.app_users where ${profiles};select (select count(*) from public.jobs where ${ownedJobs})=0 and (select count(*) from public.production_rework_cycles where id in(${cycleSql}))=0 and (select count(*) from public.app_users where ${profiles})=0 and (select count(*) from pg_policy where polrelid='public.jobs'::regclass and polname in(${quote(scopePolicy)},${quote(revokePolicy)}))=0 as removed;commit;`);recordsRemoved=r[0].removed===true;
  }
 }catch{save('cleanup-record-stop.json',{exactTaskCleanupNeeded:true,marker,jobIds:jobs.map(j=>j.id),cycleIds:cycles.map(c=>c.id),policies:[scopePolicy,revokePolicy],actorIds:actors.map(a=>a.id),ProductionChanges:0});}
 for(const actor of actors.filter(a=>attemptedActors.has(a.id))){try{const found=await service.auth.admin.getUserById(actor.id);if(found.error&&found.error.status===404){authAbsent++;authResolved++;continue;}if(found.data.user?.user_metadata.fixtureTask===marker){const gone=await service.auth.admin.deleteUser(actor.id);if(!gone.error){authRemoved++;authResolved++;}}}catch{/* Record exact unresolved identity; never broaden cleanup. */}}
 save('cleanup.json',{taskRecordsRemoved:recordsRemoved,taskAuthUsersRemoved:authRemoved,taskAuthAlreadyAbsent:authAbsent,taskAuthIdentitiesResolved:authResolved,expectedAttemptedAuth:attemptedActors.size,policiesOwnedByMarker:marker,priorFixtureReset:false,migrationsApplied:0,ProductionChanges:0});
 assert(recordsRemoved&&authResolved===attemptedActors.size,'Exact isolated-task cleanup remains required; inspect owner-only task evidence');
}
