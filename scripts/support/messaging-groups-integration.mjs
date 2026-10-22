/** Focused real LOCAL Supabase gate. Reuses existing accounts; never creates Auth users.
 * No hosted URLs, provider submission, dispatcher setup, schema reset or worktree. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {randomUUID,createHmac,createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {payloadFor,createHandler,wakeText} from '../../supabase/functions/send-web-push/core.mjs';
const docker='/Applications/Docker.app/Contents/Resources/bin/docker',db='supabase_db_tenops-permission-review';
const cfg=JSON.parse(readFileSync('.tmp-permission-review/config.json','utf8'));
assert.equal(cfg.apiUrl,'http://127.0.0.1:55481');
const exec=(args,input)=>{const r=spawnSync(docker,args,{input,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
const sql=q=>exec(['exec','-i',db,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],q);
const read=name=>readFileSync('supabase/migrations/'+name,'utf8');
const countAuth=sql('select count(*) from auth.users;');
const checks=[];const check=(name)=>{checks.push(name);console.log('PASS '+name);};
const ok=result=>{assert.ifError(result.error);return result.data;};
const accounts={};
for(const name of ['admin','member','lead','outsider','support']){
 const stored=cfg.actors[name];assert(stored?.id,'Existing local account required: '+name);
 assert.equal(sql(`select count(*) from auth.users where id='${stored.id}'`),'1');
 const client=createClient(cfg.apiUrl,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const signed=ok(await client.auth.signInWithPassword({email:stored.email,password:stored.password}));
 assert.equal(signed.user.id,stored.id);accounts[name]={id:stored.id,client,session:signed.session};
}
// Minimal missing Job Update fixture tables; actual mention notification helpers below.
if(sql("select to_regclass('public.job_updates') is null")==='t')sql(`create table public.job_updates(id uuid primary key,job_id uuid references public.jobs(id),body text,author_name text,author_user_id uuid);create table public.job_update_mentions(job_update_id uuid references public.job_updates(id),user_id uuid references public.app_users(user_id),created_at timestamptz default clock_timestamp(),primary key(job_update_id,user_id));`);
if(sql("select to_regprocedure('public.sync_job_update_mentions(public.job_updates,uuid[])') is null")==='t'){
 const collaboration=read('20260819_001_job_update_account_collaboration.sql');
 sql(collaboration.slice(collaboration.indexOf('create or replace function public.notify_job_update_account('),collaboration.indexOf('create or replace function public.create_job_update_with_mentions(')));
}
if(process.argv.includes('--prepare-local')){
 // Install missing actual push predecessors only in this pre-existing disposable stack.
 for(const [object,file] of [
 ['web_push_subscriptions','20261020200000_web_push_device_registration.sql'],
 ['web_push_outbox','20261020210000_web_push_transport.sql'],
 ['web_push_pilot_accounts','20261020220000_web_push_tendev_pilot_guard.sql'],
 ['web_push_rollout_accounts','20261021120000_web_push_production_rollout.sql']]){
  if(sql(`select to_regclass('public.${object}') is null`)==='t')sql(read(file));
 }
 if(sql("select to_regprocedure('public.can_view_my_web_push_settings()') is null")==='t')sql(read('20261021130000_web_push_settings_visibility.sql'));
 // GA is the current released policy; no local registrations/transport exist yet.
 sql(read('20261021190000_web_push_general_availability.sql'));
 if(sql("select to_regclass('public.my_work_message_groups') is null")==='t')sql(read('20261022120000_messaging_groups_replies.sql'));
 if(!sql("select pg_get_functiondef('public.web_push_pilot_source(uuid)'::regprocedure)").includes("source->>'kind'='group'") && process.argv.includes('--with-fix'))sql(read('20261022130000_messaging_group_integration.sql'));
 sql("notify pgrst,'reload schema';");
}
const A=accounts.admin,B=accounts.member,C=accounts.lead,O=accounts.outsider;
const rpc=async(actor,name,args={})=>ok(await actor.client.rpc(name,args));
const deny=async promise=>{const result=await promise;assert(result.error,'Expected access denial');return result.error;};
const awaitSchema=async()=>{for(let i=0;i<50;i++){const r=await A.client.rpc('list_my_work_conversations_v12');if(!r.error)return;assert(['PGRST202','PGRST205'].includes(r.error.code),r.error.message);await new Promise(r=>setTimeout(r,100));}assert.fail('Schema reload did not finish');};
await awaitSchema();
const dm=await rpc(A,'send_my_work_message_v12',{p_peer:B.id,p_body:'Integration private DM '+randomUUID()});
const group=await rpc(A,'save_my_work_message_group',{p_id:null,p_name:'Integration group '+randomUUID().slice(0,8),p_members:[A.id,B.id,C.id]});
const groupName=sql(`select name from my_work_message_groups where id='${group}'`);
// A private DM is never a mutable conversation/membership entity.
await deny(A.client.rpc('save_my_work_message_group',{p_id:dm,p_name:'Forbidden conversion',p_members:[A.id,B.id,C.id]}));
await deny(A.client.from('my_work_messages').update({group_id:group,recipient_user_id:null}).eq('id',dm));
assert.throws(()=>sql(`begin;update my_work_messages set group_id='${group}',recipient_user_id=null where id='${dm}';rollback;`),/Message destination is immutable/);
assert.equal(ok(await C.client.from('my_work_messages').select('id').eq('id',dm)).length,0);
assert(!JSON.stringify(await rpc(C,'list_my_work_message_page_v12',{p_peer:group})).includes(dm));
assert.equal(sql(`select group_id is null and recipient_user_id='${B.id}' from my_work_messages where id='${dm}'`),'t');
check('existing DM cannot convert through group RPC, direct API or privileged UPDATE; new member cannot read DM history');
const channels=[];
const join=async(actor,peer=actor.id)=>{
 const events=[];await actor.client.realtime.setAuth(actor.session.access_token);
 const channel=actor.client.channel('my-work-inbox:'+peer,{config:{private:true}}).on('broadcast',{event:'overview_changed'},({payload})=>events.push(payload));channels.push({actor,channel});
 const status=await new Promise(resolve=>{const t=setTimeout(()=>resolve('TIMEOUT'),10000);channel.subscribe(s=>{if(['SUBSCRIBED','CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(s)){clearTimeout(t);resolve(s);}});});
 return{events,status};
};
try{
 const joined=await Promise.all([join(A),join(B),join(C),join(O)]);
 for(const j of joined)assert.equal(j.status,'SUBSCRIBED','Real private topic join');
 const foreignClient=createClient(cfg.apiUrl,cfg.anonKey,{auth:{persistSession:false}});await foreignClient.realtime.setAuth(O.session.access_token);
 const foreign=foreignClient.channel('my-work-inbox:'+B.id,{config:{private:true}});
 const foreignStatus=await new Promise(resolve=>{const t=setTimeout(()=>resolve('TIMEOUT'),10000);foreign.subscribe(s=>{if(['SUBSCRIBED','CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(s)){clearTimeout(t);resolve(s);}});});
 assert.notEqual(foreignStatus,'SUBSCRIBED');await foreignClient.removeChannel(foreign);
 const waitEvent=async(list,predicate)=>{const until=Date.now()+10000;while(Date.now()<until){if(list.some(predicate))return;await new Promise(r=>setTimeout(r,40));}assert.fail('Expected real Realtime event');};
 const message=await rpc(B,'send_my_work_message_v12',{p_peer:group,p_body:'Realtime group message'});
 for(const j of joined.slice(0,3))await waitEvent(j.events,p=>p.id===message);
 assert(!joined[3].events.some(p=>p.id===message));
 for(const actor of [A,B,C])assert((await rpc(actor,'list_my_work_message_page_v12',{p_peer:group})).some(m=>m.id===message));
 const unread=async actor=>(await rpc(actor,'list_my_work_conversations_v12')).find(g=>g.groupId===group).unread;
 assert.equal(await unread(A),1);assert.equal(await unread(B),0);assert.equal(await unread(C),1);
 const secondClient=createClient(cfg.apiUrl,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});await secondClient.realtime.setAuth(C.session.access_token);
 const second={...C,client:secondClient};await secondClient.auth.setSession(C.session);const secondJoin=await join(second);assert.equal(secondJoin.status,'SUBSCRIBED');
 await rpc(C,'mark_my_work_conversation_read_v12',{p_peer:group,p_ids:[message]});await waitEvent(secondJoin.events,p=>p.id===message);assert.equal(await unread(second),0);
 check('real authorized channels synchronize send/history/unread across three accounts and a second device; foreign topic and outsider events denied');
 const draft=randomUUID(),file=randomUUID(),path=`${draft}/${file}/file`,bytes=Buffer.from('Real local group attachment '+randomUUID());
 await rpc(B,'begin_my_work_attachment_transfer_v12',{p_id:draft,p_recipient:group,p_body:'Shared attachment',p_job:null,p_reply:message,p_files:[{id:file,name:'integration.txt',size:bytes.length,contentType:'text/plain'}]});
 assert.equal(ok(await C.client.from('my_work_messages').select('id').eq('id',draft)).length,0);
 ok(await B.client.storage.from('my-work-inbox-attachments').upload(path,bytes,{contentType:'application/octet-stream'}));
 await rpc(B,'finalize_my_work_inbox_message',{p_message_id:draft,p_expected_attachment_count:1});
 const signed=ok(await C.client.storage.from('my-work-inbox-attachments').createSignedUrl(path,60));
 const download=await fetch(signed.signedUrl);assert(download.ok);assert.deepEqual(Buffer.from(await download.arrayBuffer()),bytes);
 await deny(O.client.storage.from('my-work-inbox-attachments').createSignedUrl(path,60));
 assert.equal((await rpc(C,'list_my_work_message_page_v12',{p_peer:group})).find(m=>m.id===draft).reply.id,message);
 check('real Storage upload/finalization/signed download and durable attachment reply; draft and outsider access denied');
 // Configure dummy local-only device rows. No scheduler or provider dispatcher is installed.
 const key='BA'+'A'.repeat(85),auth='A'.repeat(22),runId=randomUUID();
 sql(`insert into web_push_environments values('tenops','https://tenops.pages.dev','${key}','v1',true),('tendev','https://tendev.pages.dev','${key}','v1',true) on conflict do nothing;insert into web_push_transport values('tenops',true,clock_timestamp()),('tendev',true,clock_timestamp()) on conflict(environment) do update set enabled=true,activated_at=clock_timestamp();`);
 const devices=[];
 for(const actor of [A,B,C,O])for(const environment of ['tenops','tendev']){
  const hash=createHash('sha256').update('messaging-integration:'+actor.id+environment).digest('hex');const id=hash.slice(0,8)+'-'+hash.slice(8,12)+'-4'+hash.slice(13,16)+'-8'+hash.slice(17,20)+'-'+hash.slice(20,32);devices.push({id,actor,environment});
  sql(`insert into web_push_subscriptions(id,user_id,environment,endpoint,endpoint_hash,p256dh,auth,key_version) values('${id}','${actor.id}','${environment}','https://web.push.apple.com/local-${id}',encode(sha256(convert_to('https://web.push.apple.com/local-${id}','UTF8')),'hex'),'${key}','${auth}','v1') on conflict(id) do update set enabled=true,show_previews=true;insert into web_push_pilot_accounts values('${actor.id}') on conflict do nothing;`);
 }
 sql(`update web_push_deliveries set state='skipped',outcome='unavailable',lease_token=null,lease_until=null where subscription_id in (${devices.map(d=>"'"+d.id+"'").join(',')}) and state in ('pending','retry','leased');`);
 const push=await rpc(B,'send_my_work_message_v12',{p_peer:group,p_body:'Group push preview'});
 assert.equal(sql(`select count(*) from account_notifications where metadata->>'message_id'='${push}'`),'2');
 const fanout=JSON.parse(sql(`select json_agg(json_build_object('user',o.user_id,'env',s.environment)) from web_push_deliveries d join web_push_outbox o on o.notification_id=d.notification_id join web_push_subscriptions s on s.id=d.subscription_id where o.notification_id in(select id from account_notifications where metadata->>'message_id'='${push}')`));
 assert.equal(fanout.length,4,'one delivery per eligible recipient/device in both environments');
 for(const row of fanout)assert([A.id,C.id].includes(row.user));
 const nid=sql(`select id from account_notifications where user_id='${C.id}' and metadata->>'message_id'='${push}'`);
 assert.equal((await rpc(C,'resolve_my_push_notification',{p_id:nid})).conversation_user_id,group);
 assert.equal(await rpc(O,'resolve_my_push_notification',{p_id:nid}),null);
 await rpc(B,'finalize_my_work_inbox_message',{p_message_id:draft,p_expected_attachment_count:1});
 assert.equal(sql(`select count(*) from account_notifications where metadata->>'message_id'='${draft}'`),'2');
 // Re-run the actual enqueue trigger on the same notification: uniqueness must hold.
 const enqueueDefinition=sql("select pg_get_functiondef('enqueue_web_push_notification()'::regprocedure)");
 assert(enqueueDefinition.includes('on conflict do nothing'));
 sql(`create trigger integration_enqueue_retry after update on account_notifications for each row execute function enqueue_web_push_notification();update account_notifications set body=body where id='${nid}';drop trigger integration_enqueue_retry on account_notifications;`);
 assert.equal(sql(`select count(*) from web_push_deliveries where notification_id='${nid}'`),'2');
 check('actual outbox fan-out targets only other authorized members; TenOps/TenDev device deduplication and owner-authenticated group deep links');
 // Actual worker orchestration + database claims/prepare/recheck/finish; only provider I/O mocked.
 const metadata=JSON.parse(exec(['inspect','supabase_auth_tenops-permission-review']))[0];
 const secret=metadata.Config.Env.find(v=>v.startsWith('GOTRUE_JWT_SECRET=')).slice('GOTRUE_JWT_SECRET='.length);
 const jwt=payload=>{const h=Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),b=Buffer.from(JSON.stringify(payload)).toString('base64url');return h+'.'+b+'.'+createHmac('sha256',secret).update(h+'.'+b).digest('base64url');};
 const service=createClient(cfg.apiUrl,cfg.anonKey,{global:{headers:{Authorization:'Bearer '+jwt({role:'service_role',iss:'supabase',exp:Math.floor(Date.now()/1000)+3600})}},auth:{persistSession:false,autoRefreshToken:false}});
 const claims=ok(await service.rpc('claim_web_push_deliveries',{p_environment:'tenops',p_limit:20}));
 const claim=claims.find(cl=>sql(`select notification_id from web_push_deliveries where id='${cl.id}'`)===nid);assert(claim);
 let prepared=ok(await service.rpc('prepare_web_push_delivery',{p_id:claim.id,p_lease:claim.lease_token}));assert(prepared);assert.equal(payloadFor(prepared).title,groupName+' · Local member');
 sql(`update web_push_subscriptions set show_previews=false where id=(select subscription_id from web_push_deliveries where id='${claim.id}')`);
 prepared=ok(await service.rpc('prepare_web_push_delivery',{p_id:claim.id,p_lease:claim.lease_token}));assert.equal(payloadFor(prepared).title,'New TenOps message');assert(!payloadFor(prepared).body.includes('preview'));
 const aClaim=claims.find(cl=>sql(`select notification_id from web_push_deliveries where id='${cl.id}'`)===sql(`select id from account_notifications where user_id='${A.id}' and metadata->>'message_id'='${push}'`));assert(aClaim);
 await rpc(A,'mark_my_work_conversation_read_v12',{p_peer:group,p_ids:[push]});assert.equal(ok(await service.rpc('prepare_web_push_delivery',{p_id:aClaim.id,p_lease:aClaim.lease_token})),null);
 await rpc(A,'save_my_work_message_group',{p_id:group,p_name:groupName,p_members:[A.id,B.id]});
 assert.equal(ok(await service.rpc('prepare_web_push_delivery',{p_id:claim.id,p_lease:claim.lease_token})),null);
 assert.equal(await rpc(C,'resolve_my_push_notification',{p_id:nid}),null);
 assert.equal((await rpc(C,'list_my_work_message_page_v12',{p_peer:group})).length,0);
 await deny(C.client.storage.from('my-work-inbox-attachments').createSignedUrl(path,60));
 check('prepare rechecks membership after claim, respects device preview preference; removal revokes history, new signed URLs and notification deep links');
 const workerMessage=await rpc(B,'send_my_work_message_v12',{p_peer:group,p_body:'Authorized worker recipient'});
 const recipientNid=sql(`select id from account_notifications where user_id='${A.id}' and metadata->>'message_id'='${workerMessage}'`);
 sql(`update web_push_deliveries set state='pending',lease_token=null,lease_until=null where notification_id='${recipientNid}';insert into web_push_runs(id,environment,expires_at) values('${runId}','tenops',extract(epoch from clock_timestamp())::bigint+90);`);
 const wake={v:1,environment:'tenops',run_id:runId,exp:Number(sql(`select expires_at from web_push_runs where id='${runId}'`))};const wakeSecret='local-integration-only-'.repeat(3);wake.sig=createHmac('sha256',wakeSecret).update(wakeText(wake)).digest('hex');
 const submitted=[];const handler=createHandler({enabled:true,environment:'tenops',secret:wakeSecret,rpc:async(n,args)=>ok(await service.rpc(n,args)),encrypt:async row=>({body:Buffer.from(JSON.stringify(payloadFor(row))),headers:{}}),submit:async(_url,request)=>{submitted.push(JSON.parse(Buffer.from(request.body).toString()));return new Response(null,{status:201});}});
 assert.equal((await handler(new Request('http://localhost/worker',{method:'POST',body:JSON.stringify(wake)}))).status,200);
 assert(submitted.some(p=>p.id===recipientNid));assert(!submitted.some(p=>p.id===nid));
 check('real worker claim/prepare/recheck/finish with mock encryption/provider; removed recipient never submitted');
 // Preserve direct and @mention source semantics with real database authority.
 const dm2=await rpc(B,'send_my_work_message_v12',{p_peer:A.id,p_body:'Preserved DM push'});
 const dmNid=sql(`select id from account_notifications where metadata->>'message_id'='${dm2}'`);
 assert.equal((await rpc(A,'resolve_my_push_notification',{p_id:dmNid})).conversation_user_id,B.id);
 assert.equal(JSON.parse(sql(`select web_push_source('${dmNid}')`)).kind,'dm');
 check('direct-message push source and destination remain unchanged');
 const job=randomUUID(),update=randomUUID();sql(`insert into jobs(id,name,job_number) values('${job}','Local integration Job','LOCAL-INTEGRATION');insert into job_updates values('${update}','${job}','Preserved mention push','Local member','${B.id}');insert into web_push_pilot_jobs values('${job}');begin;select set_config('request.jwt.claim.sub','${B.id}',true);select sync_job_update_mentions((select u from job_updates u where id='${update}'),array['${A.id}']::uuid[]);commit;`);
 const mentionNid=sql(`select id from account_notifications where notification_key='job-update-mention:${update}'`);
 assert.equal(JSON.parse(sql(`select web_push_source('${mentionNid}')`)).kind,'mention');
 assert.deepEqual(await rpc(A,'resolve_my_push_notification',{p_id:mentionNid}),{kind:'mention',job_id:job,update_id:update});
 assert.equal(await rpc(O,'resolve_my_push_notification',{p_id:mentionNid}),null);
 assert.equal(sql(`select count(*) from web_push_deliveries where notification_id='${mentionNid}'`),'2');
 sql(`delete from web_push_pilot_jobs where job_id='${job}'`);assert.equal(sql(`select web_push_environment_source('${mentionNid}','tendev')`),'f');assert.equal(sql(`select web_push_environment_source('${mentionNid}','tenops')`),'t');
 sql(`insert into web_push_pilot_jobs values('${job}');delete from web_push_pilot_accounts where user_id='${B.id}'`);assert.equal(sql(`select web_push_environment_source('${recipientNid}','tendev')`),'f');assert.equal(sql(`select web_push_environment_source('${dmNid}','tendev')`),'f');assert.equal(sql(`select web_push_environment_source('${mentionNid}','tendev')`),'f');sql(`insert into web_push_pilot_accounts values('${B.id}')`);
 check('actual mention helper/source/deep-link/queue and DM behavior preserved; TenDev sender and Job allowlists still enforced');
 mkdirSync('.tmp-messaging-groups-review',{recursive:true});writeFileSync('.tmp-messaging-groups-review/integration-sessions.json',JSON.stringify({apiUrl:cfg.apiUrl,anonKey:cfg.anonKey,accounts:Object.fromEntries(Object.entries(accounts).map(([k,v])=>[k,{id:v.id,session:v.session}])),group,groupName,dmNotification:dmNid,groupNotification:recipientNid,removedNotification:nid,mentionNotification:mentionNid,mentionJob:job,mentionUpdate:update}),{mode:0o600});
 assert.equal(sql('select count(*) from auth.users;'),countAuth);
 mkdirSync('docs/project-memory/evidence/2026-10-22-messaging-groups-replies',{recursive:true});writeFileSync('docs/project-memory/evidence/2026-10-22-messaging-groups-replies/integration-results.json',JSON.stringify({checks,realServices:['Auth existing-account sign-in','PostgREST','PostgreSQL RLS','private Realtime sockets','Storage upload/sign/download','push database queue and worker orchestration'],providerNetworkRequests:0,authAccountsCreated:0,hostedMutations:false,group},null,2)+'\n');
}finally{
 for(const {actor,channel} of channels)await actor.client.removeChannel(channel);
 // Disable local dummy transports even when any assertion fails. No dispatch schedule exists.
 if(sql("select to_regclass('public.web_push_transport') is not null")==='t')sql('update web_push_transport set enabled=false;');
 for(const a of Object.values(accounts))await a.client.removeAllChannels();
}
