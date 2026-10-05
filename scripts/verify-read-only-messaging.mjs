/** Disposable LOCAL Supabase only. Real JWT/PostgREST/RLS/RPC/Storage checks.
 * No hosted URLs, role changes or data accepted. Re-run against a fresh project.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const workdir='.tmp-permission-supabase', db='supabase_db_tenops-permission-review';
const status=spawnSync('npx',['--yes','supabase@2.110.0','status','--workdir',workdir,'-o','json'],{encoding:'utf8'});
assert.equal(status.status,0,status.stderr);const cfg=JSON.parse(status.stdout);
assert.equal(new URL(cfg.API_URL).origin,'http://127.0.0.1:55481');
const sql=input=>{const r=spawnSync('docker',['exec','-i',db,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
const read=name=>readFile('supabase/migrations/'+name,'utf8');
const service=createClient(cfg.API_URL,cfg.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const actors={};
if(process.argv.includes('--reset-local-fixture')) sql('drop schema public cascade;create schema public;grant usage on schema public to anon,authenticated,service_role;grant all on schema public to postgres,service_role;');
const installed=sql("select to_regclass('public.app_users') is not null;")==='t';
if(!installed){
 sql('create table public.jobs(id uuid primary key default gen_random_uuid(),job_number text,name text,customer text,archived_at timestamptz,production_status text,deleted_at timestamptz);');
 const identity=await read('20260818_001_rbac_identity_infrastructure.sql');
 sql(identity.split('alter table public.job_updates')[0]+identity.slice(identity.indexOf('alter table public.app_users enable row level security')));
 const notifications=await read('20260818_004_final_compatibility_support.sql');
 sql(notifications.slice(notifications.indexOf('create table if not exists public.account_notifications'),notifications.indexOf('create or replace function public.ensure_my_welcome_notification')));
 for(const name of ['20260827_012_my_work_mvp.sql','20260828_013_my_work_enrichment.sql','20260831_015_my_work_task_attachments.sql','20260831_016_my_work_inbox.sql','20260831_017_my_work_inbox_attachments.sql','20260831_018_durable_release_communications.sql','20260831_019_private_my_work_typing_broadcast.sql','20260831_020_my_work_lifecycle_admin_cleanup.sql','20260831_021_my_work_task_estimated_time.sql','20260902_004_my_work_task_groups.sql','20260925120000_messaging_large_attachments.sql','20260925200000_messaging_v11.sql'])sql(await read(name));
 // Local business fixtures deliberately include permissive legacy authenticated/anonymous
 // writes. Candidate statement triggers must still deny restricted/anonymous mutations.
 // Create before reinstalling guard coverage below (the release migration sees existing tables).
 for(const name of ['inventory_items','samples','proposals','bids','reporting_records']){
   sql(`create table public.${name}(id uuid primary key default gen_random_uuid(),value text);alter table public.${name} enable row level security;grant select,insert,update,delete on public.${name} to authenticated,anon;grant all on public.${name} to service_role;create policy fixture_access on public.${name} for all to authenticated,anon using(true) with check(true);`);
 }
 sql("alter table public.jobs enable row level security;grant all on public.jobs to authenticated,anon;grant all on public.jobs to service_role;create policy fixture_access on public.jobs for all to authenticated,anon using(true) with check(true);");
 sql("create function public.fixture_legacy_sample_write() returns void language plpgsql security definer set search_path=pg_catalog,public as $$begin perform public.require_app_capability('readOperationalData');insert into public.samples(value) values('legacy RPC');end$$;revoke all on function public.fixture_legacy_sample_write() from public,anon;grant execute on function public.fixture_legacy_sample_write() to authenticated;");
 // Minimal read-only review functions: fixture data stays local; production source modules are real.
 sql("create function public.get_my_account_preferences() returns jsonb language sql stable as $$select '{}'::jsonb$$;create function public.list_my_account_notifications() returns setof public.account_notifications language sql stable security definer set search_path=pg_catalog,public as $$select * from public.account_notifications where user_id=auth.uid()$$;grant execute on function public.get_my_account_preferences(),public.list_my_account_notifications() to authenticated;");
 const proposal=await read('20260827_004_proposal_generator_v1.sql');
 sql(proposal.slice(proposal.indexOf('create table public.proposal_access_users'),proposal.indexOf('insert into public.proposal_access_users')));
 sql(proposal.slice(proposal.indexOf('create or replace function public.has_proposal_access'),proposal.indexOf('create table public.proposals')));
 const planning=await read('20260731_003_planning_phases_items.sql');
 sql(planning.slice(planning.indexOf('create table public.planning_phase_library ('),planning.indexOf('create function public.set_planning_record_updated_at')));
 for(const name of ['planning_phase_library','planning_phase_library_items'])sql(`alter table public.${name} enable row level security;grant all on public.${name} to authenticated,anon,service_role;create policy fixture_access on public.${name} for all to authenticated,anon using(true) with check(true);`);
 sql("insert into public.planning_phase_library(name,default_description) values('Local review phase','Isolated permission-review fixture');");
 sql(await read('20261005120000_read_only_messaging_write.sql'));
 sql("notify pgrst,'reload schema';");
}
for(let i=0;i<30;i++){const result=await service.from('app_users').select('messaging_write').limit(1);if(!result.error)break;if(i===29)assert.ifError(result.error);await new Promise(r=>setTimeout(r,200));}
for(const [name,role,readOnly,messagingWrite,active] of [
 ['support','guest',true,true,true],['reader','guest',true,false,true],['guest','guest',false,false,true],['member','member',false,false,true],['lead','lead',false,false,true],['admin','admin',false,false,true],['outsider','member',false,false,true],['inactive','guest',true,true,false]]){
 const email='permission-'+name+'@example.invalid',password='Local-permission-review-2026!';
 const list=await service.auth.admin.listUsers();assert.ifError(list.error);
 let user=list.data.users.find(u=>u.email===email);
 if(!user){const result=await service.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(result.error);user=result.data.user;}
 let profileResult;
 for(let attempt=0;attempt<30;attempt++){
   profileResult=await service.from('app_users').upsert({user_id:user.id,display_name:'Local '+name,role,is_active:active,read_only:readOnly,messaging_write:messagingWrite});
   if(!profileResult.error || !['PGRST204','PGRST205'].includes(profileResult.error.code))break;
   sql("notify pgrst,'reload schema';");await new Promise(r=>setTimeout(r,300));
 }
 assert.ifError(profileResult.error);
 const client=createClient(cfg.API_URL,cfg.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const signed=await client.auth.signInWithPassword({email,password});assert.ifError(signed.error);
 actors[name]={id:user.id,email,password,role,client,session:signed.data.session};
}
sql(`insert into public.proposal_access_users(user_id) values('${actors.support.id}') on conflict do nothing;`);
assert.equal((await actors.support.client.rpc('has_proposal_access')).data,true,'Existing independent Proposal access survives restriction');
assert.equal((await actors.reader.client.rpc('has_proposal_access')).data,false,'Restriction does not grant Proposal visibility');
await new Promise(r=>setTimeout(r,1200));
const denied=result=>{assert(result.error,'Expected authorization failure');assert.equal(result.error.code,'42501',JSON.stringify(result.error));};
for(const name of Object.keys(actors)){
 const expectedWrite=!['support','reader','inactive'].includes(name),expectedMessage=name!=='reader'&&name!=='inactive';
 assert.equal((await actors[name].client.rpc('has_app_capability',{p_capability:'writeBusinessData'})).data,expectedWrite,name);
 assert.equal((await actors[name].client.rpc('has_app_capability',{p_capability:'messaging.write'})).data,expectedMessage,name);
 for(const capability of ['createProductionJob','accessIntake','manageUsers','adjustInventory','issuePurchaseOrder','modifyPlanning'])if(['support','reader','inactive'].includes(name))assert.equal((await actors[name].client.rpc('has_app_capability',{p_capability:capability})).data,false,name+capability);
}
const lastAdmin=await actors.admin.client.rpc('admin_set_app_access',{p_user_id:actors.admin.id,p_display_name:'Local admin',p_role:'guest',p_is_active:true,p_read_only:false,p_messaging_write:false});denied(lastAdmin);
assert.equal((await actors.admin.client.rpc('get_my_app_access')).data[0].role,'admin');
denied(await actors.support.client.from('app_role_capabilities').insert({role:'guest',capability:'manageUsers'}));
const first=await service.auth.admin.createUser({email:'bootstrap-'+randomUUID()+'@example.invalid',password:'Local-bootstrap-test-2026!',email_confirm:true});assert.ifError(first.error);
sql(`begin;update public.app_users set is_active=false where role='admin';select set_config('request.jwt.claims','{"sub":"${first.data.user.id}","role":"authenticated"}',true);set local role authenticated;select user_id from public.bootstrap_first_tenops_admin('Local first Admin');rollback;`);
const business=['jobs','inventory_items','samples','proposals','bids','reporting_records'];
for(const table of business){
 const inserted=await service.from(table).insert(table==='jobs'?{job_number:'LOCAL-PERMISSION',name:'Local review only'}:{value:'Local review only'}).select('id').single();assert.ifError(inserted.error);
 for(const name of ['support','reader']){
   const client=actors[name].client;
   const visible=await client.from(table).select('*').eq('id',inserted.data.id);assert.ifError(visible.error);assert.equal(visible.data.length,1);
   denied(await client.from(table).insert(table==='jobs'?{name:'Forbidden'}:{value:'Forbidden'}));
   denied(await client.from(table).update(table==='jobs'?{name:'Forbidden'}:{value:'Forbidden'}).eq('id',inserted.data.id));
   denied(await client.from(table).delete().eq('id',randomUUID())); // zero-row requests also fail
 }
 const anonymous=createClient(cfg.API_URL,cfg.ANON_KEY,{auth:{persistSession:false}});
 denied(await anonymous.from(table).insert(table==='jobs'?{name:'Anonymous bypass'}:{value:'Anonymous bypass'}));
}
for(const name of ['support','reader']){
 denied(await actors[name].client.rpc('fixture_legacy_sample_write'));
 denied(await actors[name].client.rpc('create_my_work_task',{p_title:'Forbidden task',p_notes:'',p_color_key:'neutral'}));
 denied(await actors[name].client.rpc('admin_set_app_access',{p_user_id:actors[name].id,p_display_name:name,p_role:'guest',p_is_active:true,p_read_only:false,p_messaging_write:true}));
 denied(await actors[name].client.from('app_users').update({read_only:false}).eq('user_id',actors[name].id));
}
for(const name of ['member','lead','admin'])assert.ifError((await actors[name].client.rpc('create_my_work_task',{p_title:'Normal '+name+' task',p_notes:'',p_color_key:'neutral'})).error);
const sent=await actors.support.client.rpc('send_my_work_inbox_message',{p_recipient_user_id:actors.member.id,p_body:'Local support message'});assert.ifError(sent.error);
const reply=await actors.member.client.rpc('send_my_work_inbox_message',{p_recipient_user_id:actors.support.id,p_body:'Local reply'});assert.ifError(reply.error);
assert.ifError((await actors.support.client.rpc('edit_my_work_inbox_message',{p_message_id:sent.data,p_body:'Local edited message'})).error);
assert.ifError((await actors.support.client.rpc('mark_my_work_inbox_conversation_read',{p_other_user_id:actors.member.id})).error);
for(const name of ['reader','inactive'])denied(await actors[name].client.rpc('send_my_work_inbox_message',{p_recipient_user_id:actors.member.id,p_body:'Forbidden'}));
for(const name of ['guest','lead','admin'])assert.ifError((await actors[name].client.rpc('send_my_work_inbox_message',{p_recipient_user_id:actors.member.id,p_body:'Unchanged '+name})).error);
for(const name of ['outsider','admin','inactive']){
 const page=await actors[name].client.rpc('list_my_work_message_page_v11',{p_peer:actors.support.id,p_ids:[sent.data]});assert.ifError(page.error);assert.deepEqual(page.data,[],name+' cannot read unrelated conversation');
 denied(await actors[name].client.rpc('edit_my_work_inbox_message',{p_message_id:sent.data,p_body:'Cross account edit'}));
}
for(const name of ['support','reader'])assert((await actors[name].client.storage.createBucket('denied-'+randomUUID())).error);
const bucket='permission-business';if((await service.storage.getBucket(bucket)).error)assert.ifError((await service.storage.createBucket(bucket)).error);
sql("do $$begin if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='fixture_business_insert') then create policy fixture_business_insert on storage.objects for insert to authenticated,anon with check(bucket_id='permission-business');end if;end$$;");
for(const name of ['support','reader'])assert((await actors[name].client.storage.from(bucket).upload(randomUUID()+'.txt',Buffer.from('deny'))).error);
assert.ifError((await actors.member.client.storage.from(bucket).upload(randomUUID()+'.txt',Buffer.from('ordinary Member'))).error);
const mid=randomUUID(),aid=randomUUID(),path=mid+'/'+aid+'/file';
const args={p_id:mid,p_recipient:actors.member.id,p_body:'Local attachment',p_job:null,p_files:[{id:aid,name:'local.txt',size:3,contentType:'application/octet-stream'}]};
assert.ifError((await actors.support.client.rpc('begin_my_work_attachment_transfer',args)).error);
assert.equal((await actors.support.client.rpc('recover_my_work_attachment_transfer',{p_id:mid})).data.id,mid);
assert.ifError((await actors.support.client.storage.from('my-work-inbox-attachments').upload(path,Buffer.from('abc'),{contentType:'application/octet-stream'})).error);
assert.ifError((await actors.support.client.rpc('heartbeat_my_work_attachment_transfer',{p_id:mid})).error);
for(const name of ['outsider','admin']){assert.equal((await actors[name].client.rpc('recover_my_work_attachment_transfer',{p_id:mid})).data,null);assert((await actors[name].client.rpc('cancel_my_work_attachment_transfer',{p_id:mid})).error);}

assert.ifError((await actors.support.client.rpc('finalize_my_work_inbox_message',{p_message_id:mid,p_expected_attachment_count:1})).error);
assert((await actors.outsider.client.storage.from('my-work-inbox-attachments').download(path)).error);
assert.ifError((await actors.member.client.storage.from('my-work-inbox-attachments').download(path)).error);
denied(await actors.reader.client.rpc('begin_my_work_attachment_transfer',{...args,p_id:randomUUID()}));
const canceled=randomUUID(),canceledAid=randomUUID(),canceledPath=canceled+'/'+canceledAid+'/file';
assert.ifError((await actors.support.client.rpc('begin_my_work_attachment_transfer',{...args,p_id:canceled,p_files:[{id:canceledAid,name:'cancel.txt',size:3,contentType:'application/octet-stream'}]})).error);
assert.ifError((await actors.support.client.storage.from('my-work-inbox-attachments').upload(canceledPath,Buffer.from('abc'),{contentType:'application/octet-stream'})).error);
const cancel=await actors.support.client.rpc('cancel_my_work_attachment_transfer',{p_id:canceled});assert.ifError(cancel.error);assert.deepEqual(cancel.data,[canceledPath]);
assert.ifError((await actors.support.client.storage.from('my-work-inbox-attachments').remove(cancel.data)).error);
assert.ifError((await actors.support.client.rpc('discard_my_work_inbox_message_draft',{p_message_id:canceled})).error);
assert.equal(sql(`select count(*) from public.my_work_messages where id='${canceled}';`),'0');

const draft=await actors.member.client.rpc('send_my_work_inbox_message',{p_recipient_user_id:actors.reader.id,p_body:'Reader incoming'});assert.ifError(draft.error);
assert.ifError((await actors.reader.client.rpc('mark_my_work_inbox_conversation_read',{p_other_user_id:actors.member.id})).error);
for(const [rpc,args] of [['edit_my_work_inbox_message',{p_message_id:draft.data,p_body:'deny'}],['discard_my_work_inbox_message_draft',{p_message_id:randomUUID()}],['heartbeat_my_work_attachment_transfer',{p_id:randomUUID()}],['recover_my_work_attachment_transfer',{p_id:randomUUID()}],['cancel_my_work_attachment_transfer',{p_id:randomUUID()}]])denied(await actors.reader.client.rpc(rpc,args));
// Live assignment, revocation, inactive membership, and old Admin API preservation.
const assignment={p_user_id:actors.reader.id,p_display_name:'Local reader',p_role:'guest',p_is_active:true,p_read_only:true,p_messaging_write:true};
assert.ifError((await actors.admin.client.rpc('admin_set_app_access',assignment)).error);
assert.ifError((await actors.reader.client.rpc('send_my_work_inbox_message',{p_recipient_user_id:actors.member.id,p_body:'Assigned capability'})).error);
assert.ifError((await actors.admin.client.rpc('admin_set_app_user_access',{p_user_id:actors.reader.id,p_display_name:'Local reader',p_role:'guest',p_is_active:true})).error);
assert.equal((await actors.reader.client.rpc('get_my_app_access')).data[0].read_only,true);
assert.ifError((await actors.admin.client.rpc('admin_set_app_access',{...assignment,p_messaging_write:false})).error);
denied(await actors.reader.client.rpc('send_my_work_inbox_message',{p_recipient_user_id:actors.member.id,p_body:'Revoked capability'}));
const bad=await actors.admin.client.rpc('admin_set_app_access',{...assignment,p_role:'member'});assert.equal(bad.error?.code,'22023');
assert.equal((await actors.reader.client.rpc('get_my_app_access')).data[0].role,'guest');
const coverage=sql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and c.relname not in ('my_work_messages','my_work_message_attachments','my_work_message_versions','my_work_attachment_previews','account_notifications') and not exists(select 1 from pg_trigger t where t.tgrelid=c.oid and t.tgname='tenops_business_write_guard');");assert.equal(coverage,'0');
await mkdir('.tmp-permission-review',{recursive:true});
await writeFile('.tmp-permission-review/config.json',JSON.stringify({apiUrl:cfg.API_URL,anonKey:cfg.ANON_KEY,actors:Object.fromEntries(Object.entries(actors).map(([n,a])=>[n,{id:a.id,email:a.email,password:a.password,role:a.role,session:a.session}]))}),{mode:0o600});
const evidence={localOnly:true,realJwtRpcRls:true,readVisibility:true,businessTableDenials:business,legacyReadCapabilityRpcDenied:true,myWorkDenied:true,messagingSendReplyEditRead:true,attachmentUploadFinalizeDownload:true,transferRecoveryCancellation:true,unrelatedConversationAndStorageDenied:true,ordinaryUsersPreserved:true,assignmentRevocation:true,zeroRowDenial:true,anonymousBypassDenied:true,allExistingBusinessTablesGuarded:true,businessStorageDenied:true,firstAndLastAdminPreserved:true,independentProposalVisibilityPreserved:true,tenantModel:'Single TenOps app_users membership; participant isolation preserved. No tenant model introduced.'};
await writeFile('.tmp-permission-review/authorization-results.json',JSON.stringify(evidence,null,2));
console.log('PASS local JWT/RPC/RLS/Storage: restricted reads; send/reply/edit/attachments; business/legacy/My Work/anonymous denials; account isolation; normal roles; Admin assignment and revocation.');
