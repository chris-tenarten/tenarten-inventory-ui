/** Dedicated disposable postgres fixture; no hosted connection or large file bodies. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {migrationTransaction} from './prepare-messaging-transition.mjs';
const root='supabase/operations/messaging/';
const wrapped=migrationTransaction(readFileSync('supabase/migrations/20260925120000_messaging_large_attachments.sql','utf8'));
// Reuse the frozen ancestor fixture setup, stopping BEFORE candidate migration/tests.
const fixture=readFileSync('scripts/verify-messaging-attachments-db.mjs','utf8').split('const history=')[0];
const tests=`
const op=name=>sql(read('${root}'+name));
const sender='10000000-0000-0000-0000-000000000001',recipient='10000000-0000-0000-0000-000000000002';
const actor=(q,fail=false)=>sql("set role authenticated; select set_config('request.jwt.claim.sub','"+sender+"',false); "+q,fail).split('\\n').slice(1).join('\\n');
const draft=()=>actor("select create_my_work_inbox_message_draft('"+recipient+"','active',null);");
op('transition-setup.sql');op('pause.sql');op('pause.sql');
actor("select create_my_work_inbox_message_draft('"+recipient+"','denied',null);",true);
actor("select send_my_work_inbox_message('"+recipient+"','Text during pause',null);");
assert(Number(actor('select count(*) from my_work_messages;'))>0);
op('drain-barrier.sql');op('drain-barrier.sql');op('abort-before-migration.sql');op('abort-before-migration.sql');
const active=draft();op('pause.sql');sql(read('${root}drain-barrier.sql'),true);
actor("select discard_my_work_inbox_message_draft('"+active+"');");op('drain-barrier.sql');
// Inject transaction failure after the real candidate DDL: complete rollback; barrier remains.
const migration=${JSON.stringify(wrapped)};
sql(migration.replace(/commit;\\s*$/,'select 1/0; commit;'),true);
assert.equal(sql("select to_regprocedure('public.begin_my_work_attachment_transfer(uuid,uuid,text,uuid,jsonb)') is null;"),'t');
assert.equal(sql('select phase from messaging_attachment_release;'),'barrier');
sql(migration);
assert.equal(sql("select has_function_privilege('authenticated','public.begin_my_work_attachment_transfer(uuid,uuid,text,uuid,jsonb)','execute');"),'f');
sql(migration,true); // repeat safely refuses instead of silently altering contract
sql(read('${root}abort-before-migration.sql'),true);
// Failed bucket config rolls back and entry stays closed.
sql(read('supabase/config-changes/20260925_messaging_attachment_bucket.sql').replace(/commit;\\s*$/,'select 1/0; commit;'),true);
assert.equal(sql("select file_size_limit from storage.buckets where id='my-work-inbox-attachments';"),'26214400');
sql(read('supabase/config-changes/20260925_messaging_attachment_bucket.sql'));
// Dependency fixtures for reopen gates (real extensions/setup tested separately).
sql("create schema cron; create table cron.job(jobname text,active boolean,schedule text); create table messaging_cleanup_runs(status text,finished_at timestamptz);");
sql(read('${root}reopen.sql'),true); // no client deployment attestation
sql("update messaging_attachment_release set client_sha='5cbc69dd67d380baa0bf03b01ae65c9318f7889a',deployment_id='local-fixture',refreshed_verified=true;");
sql(read('${root}reopen.sql'),true); // scheduler missing
sql("insert into cron.job values('tenops-messaging-abandoned-drafts',true,'17 * * * *');");
sql(read('${root}reopen.sql'),true); // endpoint never succeeded
sql("insert into messaging_cleanup_runs values('succeeded',now());");
op('reopen.sql');op('reopen.sql');
assert.equal(sql("select has_function_privilege('authenticated','public.begin_my_work_attachment_transfer(uuid,uuid,text,uuid,jsonb)','execute');"),'t');
assert.equal(sql("select has_function_privilege('authenticated','public.create_my_work_inbox_message_draft(uuid,text,uuid)','execute');"),'f');
op('hold-new-uploads.sql');op('hold-new-uploads.sql');
assert.equal(sql("select has_function_privilege('authenticated','public.begin_my_work_attachment_transfer(uuid,uuid,text,uuid,jsonb)','execute');"),'f');
actor("select send_my_work_inbox_message('"+recipient+"','Text after hold',null);");
// Exact seven-day threshold, recent heartbeat, batch cap, ready and unrelated protection.
sql("insert into my_work_messages(id,sender_user_id,recipient_user_id,body,delivery_status,upload_touched_at) select gen_random_uuid(),'"+sender+"','"+recipient+"','stale','draft',now()-interval '8 days' from generate_series(1,55); insert into my_work_messages(sender_user_id,recipient_user_id,body,delivery_status,upload_touched_at) values('"+sender+"','"+recipient+"','heartbeat','draft',now()); insert into storage.buckets(id,name,public) values('unrelated','unrelated',false); insert into storage.objects(bucket_id,name,metadata) values('unrelated','keep','{}');");
assert.equal(sql('select count(*) from claim_abandoned_my_work_transfers(50);'),'50');
assert.equal(sql("select count(*) from my_work_messages where body='heartbeat' and upload_state is null;"),'1');
assert.equal(sql("select count(*) from storage.objects where bucket_id='unrelated';"),'1');
assert.equal(sql("select count(*) from storage.objects where name like '%old.png';"),'1');
// Transaction timestamp is slightly before clock_timestamp: younger than seven days remains safe.
sql("update my_work_messages set upload_touched_at=now()-interval '7 days'+interval '1 minute' where body='stale';");
assert.equal(sql('select count(*) from claim_abandoned_my_work_transfers(50);'),'0');
console.log('PASS: zero/active drain, pre-migration abort, migration/bucket rollback, runner/client gates, reopen/hold/retry, text/history continuity, seven-day protection, batch50, historical/unrelated safety.');
`;
mkdirSync('.tmp-messaging-operations',{recursive:true});writeFileSync('.tmp-messaging-operations/db-verifier.mjs',fixture+tests);
const result=spawnSync(process.execPath,['.tmp-messaging-operations/db-verifier.mjs'],{stdio:'inherit'});process.exitCode=result.status;
