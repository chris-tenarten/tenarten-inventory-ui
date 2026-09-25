/** Disposable local Postgres only. Run against the dedicated tenops-messaging-qa container.
 * Applies actual Inbox ancestors + candidate, with minimal external schema fixtures.
 * Does not model the Storage HTTP service; those gates are separate.
 */
import {execFileSync,spawnSync,spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const container='tenops-messaging-qa',db=`messaging_${Date.now()}`;
execFileSync('docker',['exec',container,'createdb','-U','postgres',db]);
function sql(input,fail=false){const r=spawnSync('docker',['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',db],{input,encoding:'utf8'});if(fail){assert.notEqual(r.status,0,'Expected denial');return r.stderr;}assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
const read=p=>readFileSync(p,'utf8');
sql(`
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role bypassrls; exception when duplicate_object then null; end $$;
create schema auth; create schema storage;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth,storage to authenticated,anon,service_role;
create table app_users(user_id uuid primary key,display_name text,role text,is_active boolean);
create table jobs(id uuid primary key,job_number text,name text);
grant select on app_users,jobs to authenticated;
create table public.my_work_message_deletion_audit(deleted_message_id uuid);
create table account_notifications(user_id uuid,notification_key text,notification_type text,title text,body text,metadata jsonb,unique(user_id,notification_key));
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));
alter table storage.objects enable row level security;
grant select,insert,delete on storage.objects to authenticated;
create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
create publication supabase_realtime;
${read('supabase/migrations/20260831_016_my_work_inbox.sql')}
${read('supabase/migrations/20260831_017_my_work_inbox_attachments.sql')}
insert into app_users values
('10000000-0000-0000-0000-000000000001','Sender','lead',true),
('10000000-0000-0000-0000-000000000002','Recipient','lead',true),
('10000000-0000-0000-0000-000000000003','Unrelated','lead',true),
('10000000-0000-0000-0000-000000000004','Admin','admin',true),
('10000000-0000-0000-0000-000000000005','Inactive','lead',false);
-- Historical ready attachment before installing candidate: must be untouched/readable.
insert into my_work_messages(id,sender_user_id,recipient_user_id,body) values('20000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','Historical message');
insert into my_work_message_attachments(id,message_id,uploader_user_id,storage_path,original_filename,content_type,byte_size) values('30000000-0000-0000-0000-000000000000','20000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000000/30000000-0000-0000-0000-000000000000/old.png','old.png','image/png',5);
insert into storage.objects(bucket_id,name,metadata) values('my-work-inbox-attachments','20000000-0000-0000-0000-000000000000/30000000-0000-0000-0000-000000000000/old.png','{"size":5,"mimetype":"image/png"}');
`);
const history=sql(`select row_to_json(m) from my_work_messages m; select row_to_json(a) from my_work_message_attachments a; select row_to_json(o) from storage.objects o;`);
sql(read('supabase/migrations/20260925120000_messaging_large_attachments.sql'));
// Compare all existing fields (new nullable columns intentionally excluded).
assert.equal(sql(`select body||':'||delivery_status from my_work_messages; select original_filename||':'||byte_size from my_work_message_attachments; select metadata from storage.objects;`),'Historical message:ready\nold.png:5\n{"size": 5, "mimetype": "image/png"}');
assert(history.includes('Historical message'));
sql("insert into storage.buckets(id,name,public,file_size_limit) values('project-task-attachments','project-task-attachments',false,null);");
const unrelatedBefore=sql("select row_to_json(b) from storage.buckets b where id<>'my-work-inbox-attachments';");
sql(read('supabase/config-changes/20260925_messaging_attachment_bucket.sql'));
assert.equal(sql("select row_to_json(b) from storage.buckets b where id<>'my-work-inbox-attachments';"),unrelatedBefore);
assert.equal(sql(`select public||':'||file_size_limit||':'||(allowed_mime_types is null) from storage.buckets where id='my-work-inbox-attachments';`),'false:50000000:true');
// Unrelated bucket stays inherited; no global configuration is present in either artifact.
const bucketConfig=read('supabase/config-changes/20260925_messaging_attachment_bucket.sql');
assert(!/project-task-attachments|update[^;]*config/si.test(bucketConfig));
assert.equal(sql("select file_size_limit is null from storage.buckets where id='project-task-attachments';"),'t');
const uid=n=>`10000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const mid=n=>`20000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const aid=n=>`30000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const actor=(n,q,fail=false)=>sql(`set role authenticated; select set_config('request.jwt.claim.sub','${uid(n)}',false); ${q}`,fail).split('\n').slice(1).join('\n');
const file=(n,size=50000000)=>({id:aid(n),name:`drawing & #${n}.dwg`,size,contentType:'application/octet-stream'});
const begin=(n,files)=>`select begin_my_work_attachment_transfer('${mid(n)}','${uid(2)}','Fixture',null,'${JSON.stringify(files)}');`;
actor(1,begin(1,[file(1),file(2),file(21),file(22)]));
actor(1,begin(1,[file(1),file(2),file(21),file(22)])); // duplicate create
assert.equal(sql(`select count(*) from my_work_messages where id='${mid(1)}';`),'1');
actor(1,begin(2,[file(3,50000001)]),true);
actor(1,begin(2,[file(3),file(4),file(23),file(24),file(5,1)]),true);
actor(1,begin(2,[file(3,-1)]),true);
actor(3,begin(1,[file(1),file(2),file(21),file(22)]),true);
actor(5,begin(2,[file(3)]),true);
actor(1,`select finalize_my_work_inbox_message('${mid(1)}',4);`,true);
actor(1,`select finalize_my_work_inbox_message('${mid(1)}',null);`,true);
actor(1,`insert into my_work_message_attachments(message_id,uploader_user_id,storage_path,original_filename,byte_size) values('${mid(1)}','${uid(1)}','bad','bad',1);`,true);
const object=(m,a,size=50000000,mime='application/octet-stream')=>`insert into storage.objects(bucket_id,name,metadata) values('my-work-inbox-attachments','${mid(m)}/${aid(a)}/file','{"size":${size},"mimetype":"${mime}"}');`;
actor(1,object(1,1,49999999),true);
actor(1,object(1,1,50000000,'text/html'),true);
actor(3,object(1,1),true);
actor(1,object(1,99),true);
actor(1,object(1,1));actor(1,object(1,2));actor(1,object(1,21));actor(1,object(1,22));
for(const n of [2,3,4,5])assert.equal(actor(n,`select count(*) from storage.objects where name like '${mid(1)}/%';`),'0');
assert.equal(actor(1,`select count(*) from storage.objects where name like '${mid(1)}/%';`),'4');
actor(1,`select finalize_my_work_inbox_message('${mid(1)}',4); select finalize_my_work_inbox_message('${mid(1)}',4);`);
assert.equal(sql(`select count(*) from account_notifications where notification_key='inbox-message:${mid(1)}';`),'1');
assert.equal(actor(2,`select count(*) from storage.objects where name like '${mid(1)}/%';`),'4');
for(const n of [3,4,5])assert.equal(actor(n,`select count(*) from storage.objects where name like '${mid(1)}/%';`),'0');
sql(`set role anon; select * from storage.objects;`,true);
actor(1,`select cancel_my_work_attachment_transfer('${mid(1)}');`,true);
actor(1,`select discard_my_work_inbox_message_draft('${mid(1)}');`,true);
actor(1,begin(3,[file(6,0),file(7,12)]));
actor(1,object(3,6,0));actor(1,object(3,7,12));
actor(1,`select cancel_my_work_attachment_transfer('${mid(3)}');`);
actor(1,`select finalize_my_work_inbox_message('${mid(3)}',2);`,true);
actor(1,`select discard_my_work_inbox_message_draft('${mid(3)}');`,true);
actor(1,`delete from storage.objects where name like '${mid(3)}/%'; select discard_my_work_inbox_message_draft('${mid(3)}'); select discard_my_work_inbox_message_draft('${mid(3)}');`);
actor(1,object(3,7,12),true); // late completion cannot recreate objects
actor(1,begin(4,[file(8,12)]));actor(1,object(4,8,12));
sql(`update my_work_messages set upload_touched_at=now()-interval '8 days' where id='${mid(4)}';`);
actor(1,`select claim_abandoned_my_work_transfers(50);`,true);
assert(sql(`set role service_role; select message_id from claim_abandoned_my_work_transfers(50);`).includes(mid(4)));
actor(1,`select heartbeat_my_work_attachment_transfer('${mid(4)}');`,true);
sql(`set role service_role; select finish_abandoned_my_work_transfer('${mid(4)}');`,true);
sql(`delete from storage.objects where name like '${mid(4)}/%'; set role service_role; select finish_abandoned_my_work_transfer('${mid(4)}');`);
assert.equal(sql(`select count(*) from my_work_messages where id='${mid(4)}';`),'0');
assert.equal(actor(2,`select count(*) from storage.objects where name like '${mid(0)}/%';`),'1');
assert.equal(actor(3,`select recover_my_work_attachment_transfer('${mid(1)}') is null;`),'t');
assert(actor(1,`select recover_my_work_attachment_transfer('${mid(1)}')->>'id';`).includes(mid(1)));
actor(5,`select recover_my_work_attachment_transfer('${mid(1)}');`,true);
sql(`update app_users set is_active=false where user_id='${uid(2)}';`);
actor(1,begin(1,[file(1),file(2),file(21),file(22)])); // lost response still reconciles after recipient is deactivated
sql(`update app_users set is_active=true where user_id='${uid(2)}'; insert into my_work_message_deletion_audit values('${mid(99)}');`);
actor(1,begin(99,[file(99,1)]),true); // cannot recreate an Admin-deleted message
// Independent connections exercise the locks, rather than asserting source patterns.
function concurrent(input){return new Promise(resolve=>{const p=spawn('docker',['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',db]);let stderr='';p.stderr.on('data',x=>stderr+=x);p.stdout.resume();p.on('close',code=>resolve({code,stderr}));p.stdin.end(input);});}
const authSql=q=>`set role authenticated; select set_config('request.jwt.claim.sub','${uid(1)}',false); ${q}`;
const duplicates=await Promise.all([concurrent(authSql(`begin; ${begin(10,[file(10,10)])} select pg_sleep(0.2); commit;`)),concurrent(authSql(begin(10,[file(10,10)])))]);
assert(duplicates.every(result=>result.code===0),JSON.stringify(duplicates));
assert.equal(sql(`select count(*) from my_work_message_attachments where message_id='${mid(10)}';`),'1');
actor(1,object(10,10,10));
const race=await Promise.all([concurrent(authSql(`select cancel_my_work_attachment_transfer('${mid(10)}');`)),concurrent(authSql(`select finalize_my_work_inbox_message('${mid(10)}',1);`))]);
assert.equal(race.filter(result=>result.code===0).length,1,'Exactly one of cancel/finalize wins');
assert(Number(sql(`select count(*) from account_notifications where notification_key='inbox-message:${mid(10)}';`))<=1);
console.log('PASS: actual migrations; decimal size/aggregate boundaries; immutable manifests; actual-object checks; sender/recipient/unrelated/Admin/inactive/anonymous RLS; idempotent finalize; cancellation; abandoned cleanup; historical attachment integrity.');
console.log(`Disposable database: ${db}. Storage HTTP/TUS and broad hosted-policy behavior are separate gates.`);
