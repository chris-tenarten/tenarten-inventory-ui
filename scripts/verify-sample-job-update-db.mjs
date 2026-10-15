import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const name='tenops-sample-update-check-'+process.pid;
const docker=(args,input)=>{const r=spawnSync('docker',args,{input,encoding:'utf8',timeout:20000,maxBuffer:4*1024*1024});if(r.error||r.status!==0)throw Error(r.error?.message||r.stderr);return r.stdout.trim();};
const sql=q=>docker(['exec','-i',name,'psql','-U','postgres','-qAt','-v','ON_ERROR_STOP=1'],q);
const read=f=>readFileSync('supabase/migrations/'+f,'utf8');
try{
 docker(['run','--rm','-d','--name',name,'-e','POSTGRES_PASSWORD=postgres','postgres:17.6']);
 for(let i=0;i<40;i++){const r=spawnSync('docker',['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres'],{timeout:1000});if(r.status===0)break;await new Promise(r=>setTimeout(r,250));}
 sql(`create role authenticated;create role anon;create role service_role;create schema auth;create schema storage;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table app_users(user_id uuid primary key,display_name text,role text,is_active boolean);
 create table app_role_capabilities(role text,capability text,primary key(role,capability));
 create table jobs(id uuid primary key,name text,customer text,job_number text);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,primary key(bucket_id,name));
 create table account_notifications(id uuid default gen_random_uuid(),user_id uuid,notification_key text,notification_type text,title text,body text,href text,metadata jsonb,created_at timestamptz default now(),unique(user_id,notification_key));`);
 sql(read('20260713_003_job_attachments.sql')+read('20260727_001_production_job_updates.sql')+read('20260728_001_job_update_resolution_details.sql')+read('20260817_001_job_update_assignment.sql')+read('20260817_002_job_update_editing.sql'));
 // Reuse the real capability function and real collaboration/notification RPCs.
 const identity=read('20260818_001_rbac_identity_infrastructure.sql');
 sql(identity.slice(identity.indexOf('create or replace function public.has_app_capability'),identity.indexOf('create or replace function public.get_my_app_user')));
 sql(`alter table job_updates add column author_user_id uuid,add column follow_up_assignee_user_id uuid,add column resolved_by_user_id uuid;
 insert into app_users values('00000000-0000-0000-0000-000000000001','Member','member',true),('00000000-0000-0000-0000-000000000002','Peer','member',true),('00000000-0000-0000-0000-000000000003','Guest','guest',true),('00000000-0000-0000-0000-000000000004','Inactive','member',false);
 insert into app_role_capabilities select 'member',unnest(array['postJobUpdate','uploadSupportingFiles','writeBusinessData','readOperationalData']);
 insert into app_role_capabilities values('guest','writeBusinessData'),('guest','readOperationalData');
 insert into jobs values('00000000-0000-0000-0000-000000000010','Visible','Customer','LOCAL-10'),('00000000-0000-0000-0000-000000000011','Hidden','Private','LOCAL-11');
 grant usage on schema public,auth,storage to authenticated,anon;grant select on app_users,app_role_capabilities,jobs,storage.objects to authenticated;
 alter table jobs enable row level security;create policy visible on jobs for select to authenticated using(id='00000000-0000-0000-0000-000000000010');
 alter table storage.objects enable row level security;grant insert,update,delete on storage.objects to authenticated,anon;
 create policy fixture_storage on storage.objects for all to authenticated,anon using(true) with check(true);
 create policy fixture_metadata on job_attachments for all to authenticated,anon using(true) with check(true);grant all on job_attachments to authenticated,anon;`);
 sql(read('20260819_001_job_update_account_collaboration.sql')+read('20260821_003_job_update_self_mention_notifications.sql')+read('20261015170000_sample_job_update_publishing.sql'));
 const actor='00000000-0000-0000-0000-000000000001',job='00000000-0000-0000-0000-000000000010',hidden='00000000-0000-0000-0000-000000000011',request='00000000-0000-0000-0000-000000000020',path=job+'/sample-updates/'+request+'.pdf';
 const as=(id,q)=>`set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);${q}`;
 const publish=`select (publish_sample_job_update('${job}','${request}','Exact.pdf',42,'work_order','',array['00000000-0000-0000-0000-000000000002']::uuid[])).id;`;
 sql(as(actor,`insert into storage.objects(bucket_id,name) values('job-attachments','${path}');`));
 const first=sql(as(actor,publish)).split('\n').at(-1),second=sql(as(actor,publish)).split('\n').at(-1);assert.equal(first,second);
 assert.equal(sql('select count(*) from job_updates'), '1');assert.equal(sql('select count(*) from job_attachments'),'1');assert.equal(sql('select count(*) from account_notifications'),'1');
 assert.match(sql('select body from job_updates'),/Sample document: Exact.pdf/);
 assert.equal(sql(as(actor,`select can_publish_sample_to_job('${hidden}');`)).split('\n').at(-1),'f');
 for(const id of ['00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004'])assert.throws(()=>sql(as(id,publish)),/not authorized/);
 assert.throws(()=>sql(as('00000000-0000-0000-0000-000000000003',`insert into job_updates(job_id,author_name,body) values('${job}','Guest','Bypass');`)),/row-level security/);
 assert.throws(()=>sql(`set role anon;${publish}`),/permission denied/);
 assert.equal(sql(as(actor,`update storage.objects set name='changed' where name='${path}';select name from storage.objects where name='${path}';`)).split('\n').at(-1),path);
 const before=sql('select count(*) from job_updates');
 assert.throws(()=>sql(as(actor,`select publish_sample_job_update('${hidden}','${request}','Hidden.pdf',42,'work_order');`)),/not authorized/);assert.equal(sql('select count(*) from job_updates'),before);
 // Cover the remaining requested database contracts without rerunning application suites.
 const peer='00000000-0000-0000-0000-000000000002',guest='00000000-0000-0000-0000-000000000003',inactive='00000000-0000-0000-0000-000000000004';
 const objectCount=sql('select count(*) from storage.objects');
 for(const id of [guest,inactive,''])assert.throws(()=>sql(as(id,`insert into storage.objects(bucket_id,name) values('job-attachments','${job}/sample-updates/00000000-0000-0000-0000-000000000030.pdf');`)),/row-level security|permission denied/);
 assert.throws(()=>sql(as(actor,`insert into storage.objects(bucket_id,name) values('job-attachments','${hidden}/sample-updates/00000000-0000-0000-0000-000000000030.pdf');`)),/row-level security/);
 assert.throws(()=>sql(`set role anon;insert into storage.objects(bucket_id,name) values('job-attachments','${job}/sample-updates/00000000-0000-0000-0000-000000000030.pdf');`),/row-level security|permission denied/);
 assert.equal(sql('select count(*) from storage.objects'),objectCount);
 assert.throws(()=>sql(as(guest,`insert into job_attachments(job_id,file_name,storage_path,document_type,job_update_id) values('${job}','Bypass.pdf','${job}/sample-updates/00000000-0000-0000-0000-000000000030.pdf','work_order','${first}');`)),/row-level security/);
 // Ordinary Update creation and existing manual attachment paths retain compatibility.
 const legacy=sql(as(actor,`select (create_job_update_with_mentions('${job}','Ignored client name','Legacy Update',false,null,null,'{}'::uuid[])).id;`)).split('\n').at(-1);
 const manualPath=job+'/manual-existing.pdf';
 sql(as(actor,`insert into storage.objects(bucket_id,name) values('job-attachments','${manualPath}');insert into job_attachments(job_id,file_name,storage_path,document_type,job_update_id,job_update_attachment_role) values('${job}','Manual.pdf','${manualPath}','other','${legacy}','update');`));
 assert.equal(sql(`select author_name from job_updates where id='${legacy}'`),'Member');
 assert.equal(sql(`select count(*) from job_attachments where storage_path='${manualPath}' and job_update_id='${legacy}'`),'1');
 assert.equal(sql(`select count(*) from job_attachments where storage_path='${path}' and job_update_id='${first}'`),'1');
 assert.equal(sql(`select count(*) from account_notifications where user_id='${peer}' and notification_type='job_update_mention' and metadata->>'update_id'='${first}' and metadata->>'job_id'='${job}'`),'1');
 // A rejected mention must roll back Update/attachment/notification together.
 // Upload precedes the RPC, so it stays available for a retry or client cleanup.
 const failedRequest='00000000-0000-0000-0000-000000000031',failedPath=job+'/sample-updates/'+failedRequest+'.pdf';
 sql(as(actor,`insert into storage.objects(bucket_id,name) values('job-attachments','${failedPath}');`));
 const counts=()=>sql("select (select count(*) from job_updates)||':'||(select count(*) from job_attachments)||':'||(select count(*) from account_notifications)");
 const initial=counts();
 const retry=(recipient)=>`select (publish_sample_job_update('${job}','${failedRequest}','Retry.pdf',42,'work_order','Retry',array['${recipient}']::uuid[])).id;`;
 assert.throws(()=>sql(as(actor,retry(inactive))),/Mentions may target active TenOps users only/);assert.equal(counts(),initial);
 assert.equal(sql(`select count(*) from storage.objects where name='${failedPath}'`),'1');
 const recovered=sql(as(actor,retry(peer))).split('\n').at(-1);assert.equal(sql(as(actor,retry(peer))).split('\n').at(-1),recovered);
 assert.equal(sql(`select count(*) from account_notifications where metadata->>'update_id'='${recovered}'`),'1');
 const cleanupRequest='00000000-0000-0000-0000-000000000032',cleanupPath=job+'/sample-updates/'+cleanupRequest+'.pdf';
 sql(as(actor,`insert into storage.objects(bucket_id,name) values('job-attachments','${cleanupPath}');`));
 const preCleanup=counts();assert.throws(()=>sql(as(actor,`select publish_sample_job_update('${job}','${cleanupRequest}','Reject.pdf',42,'invalid');`)),/Invalid Sample PDF attachment/);assert.equal(counts(),preCleanup);
 sql(as(actor,`delete from storage.objects where bucket_id='job-attachments' and name='${cleanupPath}' and not exists(select 1 from job_attachments where storage_path='${cleanupPath}');`));
 assert.equal(sql(`select count(*) from storage.objects where name='${cleanupPath}'`),'0');
 assert.equal(sql("select count(*) from storage.objects o where o.bucket_id='job-attachments' and not exists(select 1 from job_attachments a where a.storage_path=o.name)"),'0');
 console.log('PASS real PostgreSQL: permitted/hidden Jobs RLS; direct-insert denial; denied guest/inactive/anonymous/hidden-Job generated uploads; generated metadata denial and immutability; ordinary Update/manual attachment compatibility; canonical mention notifications; atomic failed-post rollback; safe retry/idempotency; cleanup permissions and zero unreferenced Storage rows. Physical PDF bytes and Storage API cleanup reuse prior browser evidence.');
}finally{try{docker(['stop',name]);}catch{}}
