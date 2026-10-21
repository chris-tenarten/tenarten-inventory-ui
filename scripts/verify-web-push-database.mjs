import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
export const container='tenops-push-stage-b-db';
export const sql=q=>execFileSync('docker',['exec','-i',container,'psql','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
export const A='00000000-0000-4000-8000-000000000010',B='00000000-0000-4000-8000-000000000020';
export const actor=(id,q,role='authenticated')=>sql(`begin;set local role ${role};select set_config('request.jwt.claim.sub','${id}',true);select set_config('request.headers','{"origin":"https://tenops.example"}',true);${q};commit;`).split('\n').slice(2).join('\n');
const focus=process.env.WEB_PUSH_DATABASE_FOCUS;
const pilotOnly=Boolean(focus);
const checks=[];const check=(name,work)=>{if(pilotOnly)return;work();checks.push(name);console.log('PASS '+name);};
const deny=work=>assert.throws(work);
// Only this purpose-created, network-isolated disposable container is reset.
const metadata=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
assert.equal(metadata.Name,'/'+container);assert.equal(metadata.Config.Image,'postgres:17.6');assert.equal(metadata.HostConfig.NetworkMode,'none');
sql(`drop schema if exists public cascade;create schema public;create schema if not exists auth;
do $$ begin create role authenticated;exception when duplicate_object then null;end $$;
do $$ begin create role anon;exception when duplicate_object then null;end $$;
do $$ begin create role service_role bypassrls;exception when duplicate_object then null;end $$;
grant usage on schema public,auth to authenticated,anon,service_role;
create or replace function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.app_users(user_id uuid primary key,display_name text,role text,is_active boolean,read_only boolean default false);
insert into public.app_users values('${A}','Alex Operator','member',true,true),('${B}','Blair Lead','lead',true,false);
`);
sql(readFileSync('supabase/migrations/20261020200000_web_push_device_registration.sql','utf8'));
const id='00000000-0000-4000-8000-000000000030',key='BA'+'A'.repeat(85),auth='A'.repeat(22);
sql(`insert into web_push_environments values('prod','https://tenops.example','${key}','v1',true)`);
const sub={endpoint:'https://web.push.apple.com/local-test',keys:{p256dh:key,auth},expirationTime:null};
const register=(owner,value=sub,device=id)=>actor(owner,`select register_my_web_push_subscription('${device}','prod','v1','${JSON.stringify(value)}')`);
check('read-only active owner can register without messaging-write grant',()=>assert.equal(JSON.parse(register(A)).generation,1));
check('duplicate registration is idempotent',()=>assert.equal(JSON.parse(register(A)).id,id));
check('direct subscription reads denied to authenticated, anonymous and service roles',()=>{for(const role of ['authenticated','anon','service_role'])deny(()=>actor(A,'select * from web_push_subscriptions',role));});
check('anonymous cannot execute registration or configuration',()=>{deny(()=>actor(A,'select get_my_web_push_configuration()','anon'));});
check('cross-account safe summary is null and endpoint takeover denied',()=>{assert.equal(actor(B,`select get_my_web_push_subscription('${id}') is null`),'t');deny(()=>register(B));});
check('foreign revoke cannot affect owner binding',()=>{actor(B,`select revoke_my_web_push_subscription('${id}',1)`);assert.equal(JSON.parse(actor(A,`select get_my_web_push_subscription('${id}')`)).enabled,true);});
check('generation revoke is idempotent and cannot rebind revoked endpoint',()=>{assert.equal(actor(A,`select revoke_my_web_push_subscription('${id}',1)`),'t');assert.equal(actor(A,`select revoke_my_web_push_subscription('${id}',1)`),'t');assert.equal(JSON.parse(actor(A,`select get_my_web_push_subscription('${id}')`)).generation,2);deny(()=>register(A));});
check('endpoint SSRF and key/expiration validation',()=>{for(const endpoint of ['http://web.push.apple.com/x','https://web.push.apple.com.evil.test/x','https://127.0.0.1/x','https://web.push.apple.com:443/x','https://a@web.push.apple.com/x','https://web.push.apple.com/x#f'])deny(()=>register(A,{...sub,endpoint}));deny(()=>register(A,{...sub,keys:{...sub.keys,auth:'x'}}));deny(()=>register(A,{...sub,expirationTime:1}));});
check('inactive cannot register; owner can still revoke',()=>{sql(`update app_users set is_active=false where user_id='${A}'`);deny(()=>register(A));assert.equal(actor(A,`select revoke_my_web_push_subscription('${id}',2)`),'t');sql(`update app_users set is_active=true where user_id='${A}'`);});
check('search paths and helper execution privileges are restricted',()=>{assert.equal(sql("select count(*) from pg_proc where proname in ('get_my_web_push_configuration','register_my_web_push_subscription','get_my_web_push_subscription','revoke_my_web_push_subscription') and prosecdef and proconfig @> array['search_path=pg_catalog, public']"),'4');deny(()=>actor(A,'select web_push_request_origin()'));});
mkdirSync('docs/project-memory/evidence/web-push-stage-b',{recursive:true});
if(!pilotOnly)writeFileSync('docs/project-memory/evidence/web-push-stage-b/stage-a-database.json',JSON.stringify({checks,engine:sql('select version()'),roles:['authenticated','anon','service_role'],hostedChanges:0},null,2));

// Exercise actual repository send/finalize/mention functions on a narrow source-schema fixture.
const migration=name=>readFileSync('supabase/migrations/'+name,'utf8');
const extract=(name,fn)=>{const source=migration(name),start=source.search(new RegExp('create (?:or replace )?function public\\.'+fn+'\\(','i'));assert(start>=0,fn);const tail=source.slice(start),open=/as\s+(\$[a-z_]*\$)/i.exec(tail);assert(open,fn);const closing=tail.indexOf(open[1],open.index+open[0].length);assert(closing>=0,fn);return tail.slice(0,closing+open[1].length)+';';};
sql(`create table public.jobs(id uuid primary key,name text,job_number text);
create table public.job_updates(id uuid primary key,job_id uuid references jobs(id),body text,author_name text,author_user_id uuid);
create table public.job_update_mentions(job_update_id uuid references job_updates(id),user_id uuid,primary key(job_update_id,user_id));
create table public.app_role_capabilities(role text,capability text);
insert into app_role_capabilities values('member','readOperationalData'),('lead','readOperationalData');
drop publication if exists supabase_realtime;create publication supabase_realtime;
`);
const notif=migration('20260818_004_final_compatibility_support.sql');sql(notif.slice(notif.indexOf('create table if not exists public.account_notifications'),notif.indexOf('create or replace function public.ensure_my_welcome_notification')));
sql(migration('20260831_016_my_work_inbox.sql'));
sql(`alter table my_work_messages add column delivery_status text default 'ready',add column sender_kind text default 'user',add column upload_request jsonb,add column upload_state text,add column upload_touched_at timestamptz;
alter table my_work_messages drop constraint my_work_messages_body_check;alter table my_work_messages add constraint my_work_messages_body_check check(length(btrim(body))<=10000 and(length(btrim(body))>=1 or upload_request is not null));
create table public.my_work_message_attachments(id uuid primary key default gen_random_uuid(),message_id uuid references my_work_messages(id),storage_path text,byte_size bigint,uploader_user_id uuid,original_filename text,content_type text);
create table my_work_message_deletion_audit(deleted_message_id uuid);
drop schema if exists storage cascade;create schema storage;create table storage.objects(bucket_id text,name text,metadata jsonb,id uuid default gen_random_uuid());
`);
sql(extract('20260925200000_messaging_v11.sql','begin_my_work_attachment_transfer'));
sql(extract('20260925120000_messaging_large_attachments.sql','finalize_my_work_inbox_message'));
sql(extract('20260821_003_job_update_self_mention_notifications.sql','notify_job_update_account'));
sql(extract('20260819_001_job_update_account_collaboration.sql','sync_job_update_mentions'));
sql(migration('20261020210000_web_push_transport.sql'));
// Source participant SELECT policy matches the later ready-state definition.
sql(`drop policy my_work_messages_participant_select on my_work_messages;
create policy my_work_messages_participant_select on my_work_messages for select to authenticated using(exists(select 1 from app_users a where a.user_id=auth.uid() and a.is_active) and (sender_user_id=auth.uid() or(recipient_user_id=auth.uid() and delivery_status='ready')));
grant select on app_users,jobs,job_updates to authenticated;`);
if(focus==='production'){await import('./support/web-push-production-database.mjs');process.exit(0);}
if(focus==='posting'){await import('./support/web-push-posting-permission.mjs');process.exit(0);}
if(pilotOnly){await import('./support/web-push-pilot-database.mjs');process.exit(0);}
const fresh={...sub,endpoint:'https://web.push.apple.com/fresh-test'};
const device=JSON.parse(register(B,fresh,'00000000-0000-4000-8000-000000000031')).id;
let message;check('outbound defaults disabled and existing messages do not backfill',()=>{message=actor(A,`select send_my_work_inbox_message('${B}','First synthetic message')`);assert.equal(sql('select count(*) from web_push_outbox'),'0');sql("insert into web_push_transport(environment,enabled,activated_at) values('prod',true,clock_timestamp())");assert.equal(sql('select count(*) from web_push_outbox'),'0');});
const send=text=>actor(A,`select send_my_work_inbox_message('${B}','${text}')`);
const count=()=>sql('select count(*) from web_push_outbox');
check('DM notification and frozen device delivery commit together',()=>{message=send('Can you check the revised plate?');assert.equal(count(),'1');assert.equal(sql('select count(*) from web_push_deliveries'),'1');});
check('transaction rollback removes notification and outbox',()=>{const before=count();sql(`begin;select set_config('request.jwt.claim.sub','${A}',true);select send_my_work_inbox_message('${B}','Rolled back');rollback;`);assert.equal(count(),before);});
check('attachment drafts never enqueue; actual finalization enqueues once',()=>{
 const before=count(),draft='00000000-0000-4000-8000-000000000071',file='00000000-0000-4000-8000-000000000072';
 actor(A,`select begin_my_work_attachment_transfer('${draft}','${B}','',null,'[{"id":"${file}","size":4,"name":"local.pdf","contentType":"application/octet-stream"}]')`);assert.equal(count(),before);
 deny(()=>actor(A,`select finalize_my_work_inbox_message('${draft}',1)`));assert.equal(count(),before);
 sql(`insert into storage.objects(bucket_id,name,metadata) values('my-work-inbox-attachments','${draft}/${file}/file','{"size":4}')`);
 actor(A,`select finalize_my_work_inbox_message('${draft}',1)`);assert.equal(Number(count()),Number(before)+1);actor(A,`select finalize_my_work_inbox_message('${draft}',1)`);assert.equal(Number(count()),Number(before)+1);
 assert.equal(sql(`select web_push_source(id)->>'attachment_only' from account_notifications where notification_key='inbox-message:${draft}'`),'true');
});
check('canonical system sender and sender-kind events excluded',()=>{
 const before=count(),system='00000000-0000-0000-0000-000000000001';sql(`insert into app_users(user_id,display_name,role,is_active) values('${system}','TenOps','admin',true)`);
 for(const [sender,kind] of [[A,'system'],[system,'user']]){
  const id=sql(`insert into my_work_messages(sender_user_id,recipient_user_id,body,sender_kind) values('${sender}','${B}','Release announcement','${kind}') returning id`);
  sql(`insert into account_notifications(user_id,notification_key,notification_type,title,body,metadata) values('${B}','inbox-message:${id}','inbox_message','System','System','{"message_id":"${id}"}')`);
 }
 assert.equal(count(),before);
});
check('outbox insertion failure rolls back the message transaction',()=>{
 const before=sql('select count(*) from my_work_messages');
 sql(`create function reject_local_outbox() returns trigger language plpgsql as $$begin raise exception 'Synthetic outbox failure';end;$$;create trigger reject_local_outbox before insert on web_push_outbox for each row execute function reject_local_outbox();`);
 deny(()=>send('Must roll back'));assert.equal(sql('select count(*) from my_work_messages'),before);sql('drop trigger reject_local_outbox on web_push_outbox;drop function reject_local_outbox()');
});
const job='00000000-0000-4000-8000-000000000040',update='00000000-0000-4000-8000-000000000041';
sql(`insert into jobs values('${job}','Synthetic Job','26-1042');insert into job_updates values('${update}','${job}','Please verify material readiness.','Alex Operator','${A}')`);
check('canonical mentions enqueue once including remove and re-add',()=>{const before=Number(count());actor(A,`select sync_job_update_mentions((select u from job_updates u where id='${update}'),array['${B}'::uuid])`);assert.equal(Number(count()),before+1);actor(A,`select sync_job_update_mentions((select u from job_updates u where id='${update}'),array[]::uuid[])`);actor(A,`select sync_job_update_mentions((select u from job_updates u where id='${update}'),array['${B}'::uuid])`);assert.equal(Number(count()),before+1);});
const notification=sql(`select id from account_notifications where notification_key='inbox-message:${message}'`);
check('authorized resolver uses owner; wrong account and revoked sources denied',()=>{assert.equal(JSON.parse(actor(B,`select resolve_my_push_notification('${notification}')`)).kind,'dm');assert.equal(actor(A,`select resolve_my_push_notification('${notification}') is null`),'t');sql(`update app_users set is_active=false where user_id='${B}'`);deny(()=>actor(B,`select resolve_my_push_notification('${notification}')`));sql(`update app_users set is_active=true where user_id='${B}'`);});
check('browser roles cannot read transport or invoke worker/source RPCs',()=>{for(const table of ['web_push_outbox','web_push_deliveries','web_push_runs','web_push_transport'])deny(()=>actor(B,'select * from '+table));deny(()=>actor(B,"select claim_web_push_deliveries('prod',5)"));deny(()=>actor(B,`select web_push_source('${notification}')`));});
check('server-side preview setting is owner/generation scoped',()=>{assert.equal(actor(A,`select set_my_web_push_previews('${device}',1,false)`),'f');assert.equal(actor(B,`select set_my_web_push_previews('${device}',1,false)`),'t');assert.equal(JSON.parse(actor(B,`select get_my_web_push_subscription('${device}')`)).show_previews,false);});
const claim=()=>JSON.parse(actor(B,"select coalesce(jsonb_agg(c),'[]') from claim_web_push_deliveries('prod',20) c",'service_role'));
let claims;check('atomic claims do not overlap active leases',()=>{claims=claim();assert(claims.length>=3);assert.equal(claim().length,0);});
const dmClaim=claims.find(c=>sql(`select notification_id from web_push_deliveries where id='${c.id}'`)===notification);
const prepare=c=>actor(B,`select prepare_web_push_delivery('${c.id}','${c.lease_token}')`,'service_role');
check('claim preparation returns authorized previews and skips genuinely read messages',()=>{const row=JSON.parse(prepare(dmClaim));assert.equal(row.previews,false);sql(`update account_notifications set read_at=clock_timestamp() where id='${notification}'`);assert(prepare(dmClaim));sql(`update my_work_messages set read_at=clock_timestamp() where id='${message}'`);assert.equal(prepare(dmClaim),'');sql(`update my_work_messages set read_at=null where id='${message}'`);});
check('disabled device generation invalidates outstanding claims',()=>{actor(B,`select revoke_my_web_push_subscription('${device}',1)`);assert.equal(prepare(dmClaim),'');});
check('lease token and generation cannot be retargeted',()=>{assert.equal(actor(B,`select finish_web_push_delivery('${dmClaim.id}','00000000-0000-4000-8000-000000000099','accepted')`,'service_role'),'f');});
check('retry delay capped; expired leases recover; maximum six attempts',()=>{const c=claims[0];assert.equal(actor(B,`select finish_web_push_delivery('${c.id}','${c.lease_token}','retryable',99999)`,'service_role'),'t');assert.equal(sql(`select next_attempt_at<=clock_timestamp()+interval '901 seconds' from web_push_deliveries where id='${c.id}'`),'t');sql(`update web_push_deliveries set state='leased',lease_until=clock_timestamp()-interval '1 second',next_attempt_at=clock_timestamp()-interval '1 second',attempts=5 where id='${c.id}'`);const next=claim();assert(next.some(r=>r.id===c.id));sql(`update web_push_deliveries set lease_until=clock_timestamp()-interval '1 second' where id='${c.id}'`);claim();assert.equal(sql(`select state from web_push_deliveries where id='${c.id}'`),'failed');});
check('single-use worker run enforces environment, expiry and replay',()=>{const id='00000000-0000-4000-8000-000000000050',exp=Number(sql("select floor(extract(epoch from clock_timestamp()))::bigint+60"));sql(`insert into web_push_runs(id,environment,expires_at) values('${id}','prod',${exp})`);assert.equal(actor(B,`select consume_web_push_run('${id}','dev',${exp})`,'service_role'),'f');assert.equal(actor(B,`select consume_web_push_run('${id}','prod',${exp})`,'service_role'),'t');assert.equal(actor(B,`select consume_web_push_run('${id}','prod',${exp})`,'service_role'),'f');});
check('one-hour expiry terminates pending deliveries',()=>{sql("update web_push_outbox set expires_at=clock_timestamp()-interval '1 second';update web_push_deliveries set state='pending'");claim();assert.equal(sql("select count(*) from web_push_deliveries where state='expired'"),sql('select count(*) from web_push_deliveries'));});
writeFileSync('docs/project-memory/evidence/web-push-stage-b/database.json',JSON.stringify({checks,engine:sql('select version()'),hostedChanges:0,sourceFunctions:'Repository DM send, attachment draft/latest finalization, canonical mention sync/notify; narrow synthetic supporting schema'},null,2));
// Two real concurrent transactions hold their locks briefly; SKIP LOCKED must split work.
const{promisify}=await import('node:util');const{execFile}=await import('node:child_process');const execute=promisify(execFile);
const concurrentDevice=JSON.parse(register(B,{...sub,endpoint:'https://web.push.apple.com/concurrency'},'00000000-0000-4000-8000-000000000060')).id;
send('Concurrent one');send('Concurrent two');
const concurrentQuery=`begin;set local role service_role;select row_to_json(c) from claim_web_push_deliveries('prod',1)c;select pg_sleep(0.3);commit;`;
const concurrent=await Promise.all([1,2].map(()=>execute('docker',['exec','-i',container,'psql','-qAt','-U','postgres','-v','ON_ERROR_STOP=1','-c',concurrentQuery])));
const records=concurrent.flatMap(r=>r.stdout.split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l)));
assert.equal(records.length,2);assert.notEqual(records[0].id,records[1].id);checks.push('two real concurrent worker transactions claim distinct deliveries');
check('provider invalidation revokes device and invalidates other in-flight work',()=>{const c=records[0];actor(B,`select finish_web_push_delivery('${c.id}','${c.lease_token}','invalid_subscription')`,'service_role');assert.equal(sql(`select enabled from web_push_subscriptions where id='${concurrentDevice}'`),'f');assert.equal(prepare(records[1]),'');});
check('thirty-day terminal transport retention',()=>{sql("update web_push_deliveries set finished_at=clock_timestamp()-interval '31 days',state='failed';");actor(B,'select prune_web_push_transport()','service_role');assert.equal(sql('select count(*) from web_push_deliveries'),'0');});
writeFileSync('docs/project-memory/evidence/web-push-stage-b/database.json',JSON.stringify({checks,engine:sql('select version()'),hostedChanges:0,sourceFunctions:'Repository DM send, attachment draft/latest finalization, canonical mention sync/notify; narrow synthetic supporting schema'},null,2));
// Exercise the prepared SQL wake signer with a local recording pg_net stub.
// This container has no network. Synthetic Vault values are disposable test fixtures.
sql(`create schema if not exists extensions;create extension if not exists pgcrypto with schema extensions;
drop schema if exists vault cascade;create schema vault;create table vault.decrypted_secrets(name text,decrypted_secret text);
drop schema if exists net cascade;create schema net;create table net.captured(headers jsonb,body jsonb);
create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language plpgsql as $$begin insert into net.captured values(headers,body);return 1;end;$$;
insert into vault.decrypted_secrets values('web_push_wake_prod','synthetic-wake-key-synthetic-wake-key-synthetic-wake-key'),('web_push_url_prod','https://synthetic.supabase.co/functions/v1/send-web-push');`);
sql(readFileSync('supabase/operations/web-push/setup.sql','utf8'));
sql("select dispatch_web_push('prod')");
const captured=JSON.parse(sql('select jsonb_build_object(\'headers\',headers,\'body\',body) from net.captured limit 1'));
const{verifyWake}=await import('../supabase/functions/send-web-push/core.mjs');
assert(await verifyWake(captured.body,'synthetic-wake-key-synthetic-wake-key-synthetic-wake-key','prod'));
assert(!JSON.stringify(captured).includes('synthetic-wake-key'));assert(!JSON.stringify(captured.headers).includes('Authorization'));
checks.push('prepared SQL wake signer matches worker HMAC without queued reusable credentials');
writeFileSync('docs/project-memory/evidence/web-push-stage-b/database.json',JSON.stringify({checks,engine:sql('select version()'),hostedChanges:0,sourceFunctions:'Repository DM send, attachment draft/latest finalization, canonical mention sync/notify; narrow synthetic supporting schema',wakeNetwork:'Recording stub in network-isolated container'},null,2));

check('explicit canonical self-mention remains eligible and deduplicated',()=>{
 register(A,{...sub,endpoint:'https://web.push.apple.com/self-mention'},'00000000-0000-4000-8000-000000000073');const before=Number(count());
 actor(A,`select sync_job_update_mentions((select u from job_updates u where id='${update}'),array['${A}'::uuid])`);assert.equal(Number(count()),before+1);
 actor(A,`select sync_job_update_mentions((select u from job_updates u where id='${update}'),array['${A}'::uuid])`);assert.equal(Number(count()),before+1);
});
writeFileSync('docs/project-memory/evidence/web-push-stage-b/database.json',JSON.stringify({checks,engine:sql('select version()'),hostedChanges:0,sourceFunctions:'Repository DM send, current attachment begin/latest finalization, canonical mention sync/notify; narrow synthetic supporting schema',wakeNetwork:'Recording stub in network-isolated container'},null,2));
check('deleted source cannot resolve and unrelated event types or edits never enqueue',()=>{
 const message=actor(B,`select send_my_work_inbox_message('${A}','Synthetic deletion check')`);
 const id=sql(`select id from account_notifications where notification_key='inbox-message:${message}'`);
 assert.equal(JSON.parse(actor(A,`select resolve_my_push_notification('${id}')`)).kind,'dm');
 const before=count();sql(`update my_work_messages set body='Edited without another push' where id='${message}'`);assert.equal(count(),before);
 for(const type of['job_update_assignment','shared_task_assigned','feature_announcement'])sql(`insert into account_notifications(user_id,notification_key,notification_type,title,body) values('${A}','unrelated-${type}','${type}','Synthetic unrelated event','No push')`);
 assert.equal(count(),before);sql(`delete from my_work_messages where id='${message}'`);assert.equal(actor(A,`select resolve_my_push_notification('${id}') is null`),'t');
});
writeFileSync('docs/project-memory/evidence/web-push-stage-b/database.json',JSON.stringify({checks,engine:sql('select version()'),hostedChanges:0,sourceFunctions:'Repository DM send, current attachment begin/latest finalization, canonical mention sync/notify; narrow synthetic supporting schema',wakeNetwork:'Recording stub in network-isolated container'},null,2));
