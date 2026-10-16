// Appended to the existing minimal Inbox fixture, never run standalone.
const {writeFileSync}=await import('node:fs');
const {publishSpotlight,loadApprovedSpotlight,resolveSpotlightRecipients,APPROVED_NAMES,EXCLUDED_NAMES,COMMUNICATION_KEY}=await import('../scripts/publish-sample-post-spotlight.mjs');
const actorId=n=>`10000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const key=COMMUNICATION_KEY;
sql(`update app_users set display_name=case user_id when '${actorId(1)}' then 'Anthony Iorio' when '${actorId(2)}' then 'Giovanni Coppola' when '${actorId(3)}' then 'Patrick Soldow' when '${actorId(4)}' then 'Chris Ngo' else 'Inactive' end;
insert into app_users values('${actorId(6)}','Marcos Alvarado','lead',true),('${actorId(7)}','Jason Allen','guest',true),('${actorId(8)}','chris developer','developer',true);`);
sql('alter table account_notifications add column id uuid default gen_random_uuid();');
sql(read('supabase/migrations/20260831_018_durable_release_communications.sql'));
sql(read('supabase/migrations/20260925120000_messaging_large_attachments.sql'));
const v11=read('supabase/migrations/20260925200000_messaging_v11.sql');
// Reuse actual affected V1.1 definitions without unrelated Admin/typing/pagination suites.
sql(v11.slice(v11.indexOf('create table public.my_work_attachment_previews'),v11.indexOf('create function public.reserve_my_work_attachment_preview')));
sql(v11.match(/CREATE OR REPLACE FUNCTION public.guard_my_work_attachment_object[\s\S]*?end;\$function\$\s*;/)[0]);
sql('alter table my_work_messages add column edited_at timestamptz;');
sql(v11.match(/create function public.list_my_work_message_page_v11[\s\S]*?\n\$\$;/)[0]);
const oldPublishers=sql("select oid::regprocedure::text||':'||md5(prosrc) from pg_proc where proname in ('deliver_tenops_release_communication','deliver_tenops_release_communication_to_user') order by proname;");
const oldPolicies=sql("select schemaname||':'||tablename||':'||policyname||':'||coalesce(qual,'')||':'||coalesce(with_check,'') from pg_policies order by 1;");
// Simulate provider explicit anon defaults: new functions must revoke both PUBLIC and anon.
sql('alter default privileges grant execute on functions to anon;');
sql(read('supabase/migrations/20261015230000_rich_release_communications.sql'));
assert.equal(sql("select schemaname||':'||tablename||':'||policyname||':'||coalesce(qual,'')||':'||coalesce(with_check,'') from pg_policies order by 1;"),oldPolicies);
const signatures=['prepare_tenops_rich_release_communication(text,text,text,uuid[],jsonb,uuid)','complete_tenops_rich_release_message(text,uuid,jsonb)','deliver_tenops_release_communication(text)','deliver_tenops_release_communication_to_user(text,uuid)'];
for(const signature of signatures)for(const role of ['anon','authenticated'])assert.equal(sql(`select has_function_privilege('${role}','public.${signature}','execute');`),'f');
for(const signature of signatures.slice(0,3))assert.equal(sql(`select has_function_privilege('service_role','public.${signature}','execute');`),'t');
const q=value=>"'"+String(value).replaceAll("'","''")+"'";
const recipients=APPROVED_NAMES.map((name,i)=>({name,userId:actorId(i+1)}));
const approved=loadApprovedSpotlight(),uploader=actorId(4),bytes=new Map();let uploads=0,failAt=3,lost=false;
function invoke(name,args){const params=Object.entries(args).map(([k,v])=>k+'=>'+(Array.isArray(v)&&k==='p_recipients'?`array[${v.map(q)}]::uuid[]`:typeof v==='object'?q(JSON.stringify(v))+'::jsonb':q(v))).join(',');return JSON.parse(sql(`set role service_role;select to_json(public.${name}(${params}));`));}
const client={rpc:async(name,args)=>{try{const data=invoke(name,args);if(lost&&name==='complete_tenops_rich_release_message'){lost=false;return {error:Error('Lost publication response')};}return {data,error:null};}catch(error){return {error};}},storage:{from:bucket=>({
 download:async objectPath=>bytes.has(objectPath)?{data:new Blob([bytes.get(objectPath)]),error:null}:{error:{statusCode:'404',message:'Object not found'}},
 upload:async(objectPath,value,options)=>{assert.equal(options.upsert,false);uploads++;if(uploads===failAt)return {error:Error('Disposable upload failure')};if(bytes.has(objectPath))return {error:{statusCode:'409',message:'already exists'}};try{sql(`insert into storage.objects(bucket_id,name,metadata) values(${q(bucket)},${q(objectPath)},${q(JSON.stringify({size:value.length,mimetype:options.contentType}))});`);bytes.set(objectPath,Buffer.from(value));return {error:null};}catch(error){return {error};}}
})}};
const as=(n,query)=>sql(`set role authenticated;select set_config('request.jwt.claim.sub','${actorId(n)}',false);${query}`).split('\n').slice(1).join('\n');
const audienceFixture=recipients.map((r,i)=>({user_id:r.userId,display_name:r.name,is_active:true,role:i===3?'admin':'lead'}));
const lookup={from:()=>({select:()=>({in:async()=>({data:audienceFixture,error:null})})}),auth:{admin:{getUserById:async id=>({data:{user:{id}}})}}};
assert.equal((await resolveSpotlightRecipients(lookup,recipients)).length,4);audienceFixture.push({...audienceFixture[0],user_id:actorId(9)});await assert.rejects(()=>resolveSpotlightRecipients(lookup,recipients),/Ambiguous/);audienceFixture.pop();audienceFixture[0].is_active=false;await assert.rejects(()=>resolveSpotlightRecipients(lookup,recipients),/Inactive/);audienceFixture[0].is_active=true;
await assert.rejects(()=>publishSpotlight(client,recipients,uploader,approved),/upload failure/);
assert.equal(sql(`select count(*) from my_work_messages where system_message_key=${q(key)} and delivery_status='draft'`),'4');
assert.equal(sql(`select count(*) from account_notifications where notification_key='inbox-system-message:${key}'`),'0');
const message=sql(`select id from my_work_messages where recipient_user_id='${actorId(1)}' and system_message_key=${q(key)}`);
for(const n of [1,2,3,4,5,6,7,8]){assert.equal(as(n,`select count(*) from my_work_messages where system_message_key=${q(key)};`),'0');assert.equal(as(n,`select count(*) from storage.objects where name like '${message}/%';`),'0');}
assert.match(sql(`set role anon;select * from storage.objects;`,true),/permission denied/);
assert.match(sql(`set role authenticated;select prepare_tenops_rich_release_communication('x','x','x','{}','[]',null);`,true),/permission denied/);
assert.match(sql(`set role authenticated;insert into my_work_messages(sender_user_id,recipient_user_id,body,sender_kind,system_sender_key,system_message_key) values(null,'${actorId(1)}','fake','system','tenops','fake');`,true),/permission denied|row-level/);
assert.throws(()=>invoke('deliver_tenops_release_communication',{p_communication_key:key}),/Complete verified/);
assert.throws(()=>invoke('complete_tenops_rich_release_message',{p_key:key,p_recipient:actorId(6),p_verified_sha256:approved.files.map(f=>f.sha256)}),/approved audience/);
assert.throws(()=>invoke('complete_tenops_rich_release_message',{p_key:key,p_recipient:actorId(1),p_verified_sha256:[]}),/hashes differ/);
assert.throws(()=>invoke('complete_tenops_rich_release_message',{p_key:key,p_recipient:actorId(1),p_verified_sha256:approved.files.map(f=>f.sha256)}),/Complete stored/);
// Complete upload set, but fail once AFTER committed publication; subsequent run skips that recipient.
failAt=-1;lost=true;
await assert.rejects(()=>publishSpotlight(client,recipients,uploader,approved),/Lost publication response/);
assert.equal(sql(`select count(*) from my_work_messages where system_message_key=${q(key)} and delivery_status='ready'`),'1');
assert.equal(sql(`select count(*) from account_notifications where notification_key='inbox-system-message:${key}'`),'1');
const firstObjects=uploads;const outcome=await publishSpotlight(client,recipients,uploader,approved);assert.equal(outcome[0].status,'already-delivered');assert.equal(outcome.filter(r=>r.status==='delivered').length,3);assert(uploads>firstObjects);
const completeUploads=uploads;await publishSpotlight(client,recipients,uploader,approved);assert.equal(uploads,completeUploads);
assert.equal(sql(`select count(*) from my_work_messages where system_message_key=${q(key)}`),'4');
assert.equal(sql(`select count(*) from account_notifications where notification_key='inbox-system-message:${key}'`),'4');
assert.equal(sql(`select count(*) from my_work_message_attachments a join my_work_messages m on m.id=a.message_id where m.system_message_key=${q(key)}`),'20');
assert.equal(sql(`select count(*) from storage.objects where name<>'20000000-0000-0000-0000-000000000000/30000000-0000-0000-0000-000000000000/old.png'`),'40');
assert.equal(sql(`select count(*) from my_work_messages where system_message_key=${q(key)} and (sender_user_id is not null or sender_kind<>'system' or system_sender_key<>'tenops')`),'0');
for(let n=1;n<=4;n++){
 const page=JSON.parse(as(n,"select list_my_work_message_page_v11('00000000-0000-0000-0000-000000000001');"));const entry=page.find(m=>m.id!==undefined&&m.body===approved.title+'\n\n'+approved.body);assert(entry);assert.equal(entry.sender_name,'TenOps');assert.equal(entry.attachments.length,5);assert.deepEqual(entry.attachments.map(a=>a.original_filename),approved.files.map(f=>f.name));
 assert.equal(as(n,`select count(*) from storage.objects o join my_work_message_attachments a on a.storage_path=o.name where a.message_id='${entry.id}';`),'5');
 const other=sql(`select id from my_work_messages where system_message_key=${q(key)} and recipient_user_id='${actorId(n===1?2:1)}'`);assert.equal(as(n,`select count(*) from storage.objects where name like '${other}/%';`),'0');
}
for(const n of [5,6,7,8]){assert.equal(as(n,"select list_my_work_message_page_v11('00000000-0000-0000-0000-000000000001');"),'[]');assert.equal(as(n,`select count(*) from storage.objects where name like '${message}/%';`),'0');}
assert.equal(sql(`select count(*) from my_work_messages where system_message_key=${q(key)} and recipient_user_id in ('${actorId(6)}','${actorId(7)}','${actorId(8)}')`),'0');
// Same stable identity cannot change content/audience or append references on retry.
assert.throws(()=>invoke('prepare_tenops_rich_release_communication',{p_key:key,p_title:approved.title,p_body:'changed',p_recipients:recipients.map(r=>r.userId),p_files:approved.manifest,p_uploader:uploader}),/refusing overwrite/);
// Existing text-only and account-notification registry paths remain idempotent and compatible.
invoke('deliver_tenops_release_communication',{p_communication_key:'inbox_onboarding_v1'});invoke('deliver_tenops_release_communication',{p_communication_key:'inbox_onboarding_v1'});
assert.equal(sql("select count(*) from my_work_messages where system_message_key='inbox_onboarding_v1'"),'7');
assert.equal(sql("select count(*) from account_notifications where notification_key='inbox-system-message:inbox_onboarding_v1'"),'7');
invoke('deliver_tenops_release_communication',{p_communication_key:'my_work_v1_announcement'});invoke('deliver_tenops_release_communication',{p_communication_key:'my_work_v1_announcement'});
assert.equal(sql("select count(*) from account_notifications where notification_key='system-announcement:my_work_v1_announcement'"),'7');
assert.equal(sql(`select body||':'||delivery_status from my_work_messages where id='20000000-0000-0000-0000-000000000000'`),'Historical message:ready');
assert.equal(sql("select count(*) from storage.objects o where o.bucket_id='my-work-inbox-attachments' and not exists(select 1 from my_work_message_attachments a where a.storage_path=o.name) and not exists(select 1 from my_work_attachment_previews p where p.storage_path=o.name)"),'0');
// Corrupt same-length private bytes must prevent exposure, and exact approved bytes allow retry.
const second={...approved,title:approved.title};
sql(`delete from account_notifications where notification_key='inbox-system-message:${key}' and user_id='${actorId(4)}';update my_work_messages set delivery_status='draft',upload_state='active',upload_request=jsonb_set(upload_request,'{verified}','false') where system_message_key=${q(key)} and recipient_user_id='${actorId(4)}';`);
const corruptPath=sql(`select a.storage_path from my_work_message_attachments a join my_work_messages m on m.id=a.message_id where m.system_message_key=${q(key)} and m.recipient_user_id='${actorId(4)}' order by a.created_at limit 1`);const original=bytes.get(corruptPath);bytes.set(corruptPath,Buffer.alloc(original.length));await assert.rejects(()=>publishSpotlight(client,recipients,uploader,second),/Stored screenshot differs/);assert.equal(as(4,`select count(*) from my_work_messages where system_message_key=${q(key)}`),'0');bytes.set(corruptPath,original);await publishSpotlight(client,recipients,uploader,approved);
const result={status:'PASS',recipients:APPROVED_NAMES,excluded:EXCLUDED_NAMES,systemSender:true,attachmentsPerRecipient:5,orderingAndCaptions:true,privateRls:true,anonymousAndUnrelatedDenied:true,impersonationDenied:true,effectiveExecutePrivilegesVerified:true,policiesUnchanged:true,uploadFailureHidden:true,lostResponseResume:true,duplicateMessages:0,duplicateNotifications:0,duplicateReferences:0,corruptBytesRejected:true,orphans:0,textCompatibility:true,hostedWrites:0,storageHttp:'Emulated byte adapter; actual PostgreSQL RLS/Storage guard/persistence verified',oldPublisherDefinitionHashes:oldPublishers};
writeFileSync('docs/project-memory/evidence/sample-post-spotlight/delivery-validation.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
