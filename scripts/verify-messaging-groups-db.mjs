/** Disposable PostgreSQL database on the existing LOCAL Docker server. No Auth accounts,
 * network transport or hosted data. JWT claims exercise actual authenticated RLS. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
if(process.argv.includes('--integration')){await import('./support/messaging-groups-integration.mjs');process.exit(0);}
const docker='/Applications/Docker.app/Contents/Resources/bin/docker',container='supabase_db_tenops-contact-review';
const database='tenops_messaging_groups_'+Date.now();
const run=(db,input,ok=true)=>{const r=spawnSync(docker,['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',db],{input,encoding:'utf8'});if(ok)assert.equal(r.status,0,r.stderr);else assert.notEqual(r.status,0,'Expected access denial');return r.stdout.trim();};
const read=p=>readFileSync(p,'utf8');
const fn=(file,name)=>{const s=read(file);const pattern=new RegExp('create(?: or replace)? function public\\.'+name+'\\([^]*?end;\\$\\$;','i');const result=s.match(pattern);assert(result,'Missing '+name);return result[0];};
run('postgres',`create database ${database};`);
try{
run(database,`create schema auth;create schema storage;create schema realtime;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
create table realtime.messages(extension text);
alter table realtime.messages enable row level security;
create table realtime.test_events(payload jsonb,event text,topic text);
create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$insert into realtime.test_events values($1,$2,$3)$$;
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table public.app_users(user_id uuid primary key,display_name text,role text,is_active boolean,read_only boolean default false,messaging_write boolean default false);
create table public.jobs(id uuid primary key,job_number text,name text);
create table public.account_notifications(id uuid default gen_random_uuid() primary key,user_id uuid,notification_key text,notification_type text,title text,body text,metadata jsonb,unique(user_id,notification_key));
create function public.require_app_capability(text) returns void language plpgsql as $$begin if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active and (not read_only or messaging_write)) then raise exception 'Denied' using errcode='42501';end if;end$$;
create function public.has_app_capability(text) returns boolean language sql as $$ select exists(select 1 from public.app_users where user_id=auth.uid() and is_active and (not read_only or messaging_write)) $$;
grant usage on schema public,auth,storage,realtime to authenticated;
grant select on public.app_users,public.jobs,storage.objects to authenticated;
${read('supabase/migrations/20260831_016_my_work_inbox.sql').split('do $$ begin')[0]}
${read('supabase/migrations/20260831_017_my_work_inbox_attachments.sql')}
${read('supabase/migrations/20260831_018_durable_release_communications.sql').split('alter table public.my_work_messages alter column sender_user_id')[1].split('create unique index')[0].replace(/^/, 'alter table public.my_work_messages alter column sender_user_id')}
${read('supabase/migrations/20260831_020_my_work_lifecycle_admin_cleanup.sql').split('create table public.work_task_deletion_audit')[0].replace('begin;','')}
${fn('supabase/migrations/20260831_020_my_work_lifecycle_admin_cleanup.sql','edit_my_work_inbox_message')}
${read('supabase/migrations/20260925120000_messaging_large_attachments.sql').replace('begin;','').replace('commit;','')}
`);
// V1.1 migration includes exact hosted prerequisite hashes; fixture installs its complete
// implementations without pretending fixture bodies have the hosted predecessor hashes.
const v11=read('supabase/migrations/20260925200000_messaging_v11.sql');
run(database,v11.slice(v11.indexOf('create function public.guard_my_work_message_job_retirement()')).replace(/commit;\s*$/,''));
const permission=read('supabase/migrations/20261005120000_read_only_messaging_write.sql');
if(process.argv.includes('--hosted-guard-compatibility'))run(database,permission.slice(permission.indexOf('do $$declare f record; definition text;',permission.indexOf('-- Explicit RPC entry guards')),permission.indexOf('create trigger tenops_storage_bucket_write_guard')));
run(database,read('supabase/migrations/20261022120000_messaging_groups_replies.sql'));
run(database,permission.slice(permission.indexOf('create function public.guard_tenops_messaging_write()'),permission.indexOf('-- Explicit RPC entry guards'))
.replace(/create function public.guard_tenops_notification_write\(\)[^]*?end;\$\$;/,'')
.replace('create trigger tenops_notification_write_guard','create trigger tenops_notification_write_guard'));
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [a,b,c,outsider,admin,inactive]=[10,11,12,13,14,15].map(uid);
run(database,`insert into app_users(user_id,display_name,role,is_active) values ${[a,b,c,outsider,admin,inactive].map((id,i)=>`('${id}','Fixture ${i}','${i===4?'admin':'member'}',${i!==5})`).join(',')};`);
const as=(actor,sql,ok=true)=>run(database,`begin;set local role authenticated;set local request.jwt.claim.sub='${actor}';set local request.jwt.claim.role='authenticated';${sql};commit;`,ok);
if(process.argv.includes('--hosted-guard-compatibility')){
 const source=run(database,"select prosrc from pg_proc where oid='recover_my_work_attachment_transfer(uuid)'::regprocedure");
 assert.match(source,/\bBEGIN\b/);assert(!source.includes('public.is_my_work_group_member(group_id)'));
 const g=as(a,`select save_my_work_message_group(null,'Guard compatibility',array['${a}','${b}','${c}']::uuid[])`);
 const message=as(b,`select send_my_work_message_v12('${g}','Synthetic removed-sender message')`);
 const draft=uid(50),files=JSON.stringify([{id:uid(51),name:'guard-test.txt',size:3,contentType:'text/plain'}]);
 as(b,`select begin_my_work_attachment_transfer_v12('${draft}','${g}','Synthetic private draft',null,'${files}'::jsonb,null)`);
 as(a,`select save_my_work_message_group('${g}','Guard compatibility',array['${a}','${c}']::uuid[])`);
 assert.equal(JSON.parse(as(b,`select recover_my_work_attachment_transfer('${draft}')`)).body,'Synthetic private draft','Reproduce pre-correction leak under released uppercase BEGIN shape');
 const metadata=()=>run(database,`select json_agg(json_build_object('name',proname,'owner',proowner,'acl',proacl,'config',proconfig,'securityDefiner',prosecdef) order by proname) from pg_proc where oid=any(array['recover_my_work_attachment_transfer(uuid)'::regprocedure,'my_work_attachment_transfer_status(uuid)'::regprocedure,'edit_my_work_inbox_message(uuid,text)'::regprocedure])`);
 const before=metadata(),fix=read('supabase/migrations/20261022140000_messaging_removed_sender_entry_guards.sql');run(database,fix);assert.equal(metadata(),before);
 as(b,`select recover_my_work_attachment_transfer('${draft}')`,false);as(b,`select my_work_attachment_transfer_status('${draft}')`,false);as(b,`select edit_my_work_inbox_message('${message}','Removed edit')`,false);
 const dm=uid(52);as(b,`select begin_my_work_attachment_transfer_v12('${dm}','${a}','Unchanged direct draft',null,'${files}'::jsonb,null)`.replace(uid(51),uid(53)));
 assert.equal(JSON.parse(as(b,`select recover_my_work_attachment_transfer('${dm}')`)).body,'Unchanged direct draft');
 assert.equal(as(c,`select count(*) from my_work_messages where id='${message}'`),'1');
 run(database,fix);assert.equal(metadata(),before);
 console.log('PASS focused uppercase-BEGIN regression: original leak reproduced; forward correction denies removed sender recovery/status/edit; direct recovery and current-member history preserved; owners/ACL/search paths unchanged; correction repeat-safe.');
}else{
const g=as(a,`select save_my_work_message_group(null,'Shop team',array['${a}','${b}','${c}']::uuid[])`);
assert.match(g,/^[\da-f-]{36}$/);
const m=as(b,`select send_my_work_message_v12('${g}','Group original')`);
assert.equal(as(c,`select count(*) from my_work_messages where id='${m}'`),'1');
for(const actor of [outsider,admin,inactive]){
 assert.equal(as(actor,`select count(*) from my_work_messages where id='${m}'`),'0');
 assert.equal(as(actor,`select list_my_work_message_page_v12('${g}')`),'[]');
 as(actor,`select send_my_work_message_v12('${g}','Forbidden')`,false);
}
as(b,`select save_my_work_message_group('${g}','Hijacked',array['${a}','${b}']::uuid[])`,false);
const reply=as(c,`select send_my_work_message_v12('${g}','Group reply','${m}')`);
assert.equal(JSON.parse(as(c,`select list_my_work_message_page_v12('${g}')`)).find(r=>r.id===reply).reply.body,'Group original');
assert.equal(JSON.parse(as(a,'select list_my_work_conversations_v12()'))[0].unread,2);
as(a,`select mark_my_work_conversation_read_v12('${g}',array['${m}']::uuid[])`);
assert.equal(JSON.parse(as(a,'select list_my_work_conversations_v12()'))[0].unread,1);
const dm=as(a,`select send_my_work_message_v12('${b}','DM original')`);
as(a,`select send_my_work_message_v12('${g}','Cross scope','${dm}')`,false);
as(a,`select send_my_work_message_v12('${b}','Cross scope','${m}')`,false);
as(b,`select send_my_work_message_v12('${a}','DM reply','${dm}')`);
assert.equal(JSON.parse(as(a,`select list_my_work_message_page_v12('${b}')`)).length,2);
// A pre-upgrade DM transfer retains its identity when the new client resumes it.
const legacy=uid(40),legacyFile=JSON.stringify([{id:uid(41),name:'legacy.txt',size:3,contentType:'text/plain'}]);
as(a,`select begin_my_work_attachment_transfer('${legacy}','${b}','Legacy pending transfer',null,'${legacyFile}'::jsonb)`);
as(a,`select begin_my_work_attachment_transfer_v12('${legacy}','${b}','Legacy pending transfer',null,'${legacyFile}'::jsonb,null)`);
// Real reservation, metadata/storage checks and publication; tiny object, no uploads to network.
const draft=uid(30),attachment=uid(31),files=JSON.stringify([{id:attachment,name:'local.txt',size:3,contentType:'text/plain'}]);
as(b,`select begin_my_work_attachment_transfer_v12('${draft}','${g}','','{}'::uuid,'${files}'::jsonb,'${m}')`.replace("'{}'::uuid",'null'));
assert.equal(as(c,`select count(*) from my_work_messages where id='${draft}'`),'0');
as(b,`select finalize_my_work_inbox_message('${draft}',1)`,false);
run(database,`insert into storage.objects(bucket_id,name,metadata) values('my-work-inbox-attachments','${draft}/${attachment}/file','{"size":3,"mimetype":"application/octet-stream"}');`);
as(b,`select finalize_my_work_inbox_message('${draft}',1)`);
assert.equal(as(c,`select count(*) from my_work_message_attachments where message_id='${draft}'`),'1');
assert.equal(as(outsider,`select count(*) from storage.objects where name='${draft}/${attachment}/file'`),'0');
assert.equal(as(c,`select count(*) from storage.objects where name='${draft}/${attachment}/file'`),'1');
assert.equal(JSON.parse(as(b,`select recover_my_work_attachment_transfer('${draft}')`)).replyTo,m);
// Notification source revalidates membership and read state; no delivery dispatcher invoked.
const removedNotification=run(database,`select id from account_notifications where user_id='${b}' and metadata->>'message_id'='${reply}'`);
const notification=run(database,`select id from account_notifications where user_id='${c}' and metadata->>'message_id'='${m}'`);
assert.equal(JSON.parse(run(database,`select web_push_source('${notification}')`)).kind,'group');
as(a,`select save_my_work_message_group('${g}','Renamed team',array['${a}','${c}']::uuid[])`);
assert.equal(run(database,`select web_push_source('${removedNotification}')`),'');
assert.equal(as(b,`select resolve_my_push_notification('${removedNotification}')`),'');
assert.equal(as(b,`select count(*) from my_work_messages where group_id='${g}'`),'0','Removed sender cannot read own historical group messages');
assert.equal(as(b,`select list_my_work_message_page_v12('${g}')`),'[]');
assert.equal(as(b,`select count(*) from storage.objects where name='${draft}/${attachment}/file'`),'0');
as(b,`select recover_my_work_attachment_transfer('${draft}')`,false);
as(b,`select edit_my_work_inbox_message('${m}','Removed edit')`,false);
assert(!JSON.parse(as(b,'select list_my_work_conversations_v11()')).some(r=>r.userId===g));
as(a,`select save_my_work_message_group('${g}','Renamed team',array['${a}','${b}','${c}']::uuid[])`);
assert.equal(as(b,`select count(*) from my_work_messages where id='${m}'`),'1','Rejoined member gets shared history');
as(admin,`select admin_permanently_delete_my_work_message('${m}','PERMANENTLY_DELETE_MESSAGE')`);
assert.equal(run(database,`select original_group_id from my_work_message_deletion_audit where deleted_message_id='${m}'`),g);
const deleted=JSON.parse(as(c,`select list_my_work_message_page_v12('${g}')`)).find(r=>r.id===reply);
assert.equal(deleted.is_reply,true);assert.equal(deleted.reply,null);assert.equal(deleted.reply_to_message_id,null);
const system=run(database,`insert into my_work_messages(sender_kind,system_sender_key,system_message_key,recipient_user_id,body) values('system','tenops','fixture','${a}','System message') returning id`);
as(a,`select mark_my_work_conversation_read_v12('00000000-0000-0000-0000-000000000001',array['${system}']::uuid[])`);
assert.equal(run(database,`select read_at is not null from my_work_messages where id='${system}'`),'t');
run(database,`update app_users set is_active=false where user_id='${b}';`);
assert.equal(as(b,`select list_my_work_message_page_v12('${g}')`),'[]');
run(database,`update app_users set read_only=true,messaging_write=false where user_id='${c}';`);
as(c,`select send_my_work_message_v12('${g}','Read-only denial')`,false);
run(database,`update app_users set messaging_write=true where user_id='${c}';`);
as(c,`select send_my_work_message_v12('${g}','Explicit Messaging permission')`);
console.log('PASS PostgreSQL: migration, member/outsider/Admin/inactive RLS, owner management, group + DM replies, cross-conversation denial, unread receipts, attachment publication/Storage visibility/recovery, removal/rejoin, deletion fallback, push source authority. No login accounts or live notifications.');
}
}finally{run('postgres',`drop database ${database} with (force);`);}
