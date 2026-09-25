/** Actual disposable Supabase Storage/Auth/PostgREST integration. Never accepts hosted URLs.
 * Requires .tmp-messaging-supabase stack (project tenops-messaging-isolated), dedicated
 * empty public schema and ignored .tmp-messaging/transfer.js browser bundle.
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {createClient} from '@supabase/supabase-js';
import {chromium} from '@playwright/test';
import {build} from 'esbuild';
const status=spawnSync('npx',['--yes','supabase@2.110.0','status','--workdir','.tmp-messaging-supabase','-o','json'],{encoding:'utf8'});
assert.equal(status.status,0,'Local stack must be running');const config=JSON.parse(status.stdout);
const base=config.API_URL;assert.equal(new URL(base).hostname,'127.0.0.1');assert.equal(new URL(base).port,'55431');
const ceiling=spawnSync('docker',['exec','supabase_storage_tenops-messaging-isolated','printenv','FILE_SIZE_LIMIT'],{encoding:'utf8'});
assert.equal(ceiling.status,0);assert.equal(Number(ceiling.stdout.trim()),52428800,'Mirror unchanged hosted Free-plan ceiling');
const key=config.ANON_KEY,service=createClient(base,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const db='supabase_db_tenops-messaging-isolated';
const sql=input=>{const r=spawnSync('docker',['exec','-i',db,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;};
if(process.argv.includes('--reset-local-fixture')){
  const bucket=await service.storage.getBucket('my-work-inbox-attachments');
  if(!bucket.error){const emptied=await service.storage.emptyBucket('my-work-inbox-attachments');assert.ifError(emptied.error);}
  sql('drop schema public cascade; create schema public; grant usage on schema public to anon,authenticated,service_role; grant all on schema public to postgres,service_role;');
}
assert.equal(sql("select count(*) from information_schema.tables where table_schema='public' and table_name='my_work_messages';").trim(),'0','Use a fresh dedicated local stack, never an existing project.');
const actors=[];
for(const role of ['lead','lead','lead','admin','lead']){
 const email=`messaging-${randomUUID()}@example.invalid`,password=`local-${randomUUID()}`;
 const created=await service.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(created.error);
 const client=createClient(base,key,{auth:{persistSession:false,autoRefreshToken:false}});const login=await client.auth.signInWithPassword({email,password});assert.ifError(login.error);
 actors.push({id:created.data.user.id,client,token:login.data.session.access_token,role});
}
const [sender,recipient,unrelated,admin,inactive]=actors;
const read=p=>readFile(p,'utf8');
sql(`create table public.app_users(user_id uuid primary key,display_name text,role text,is_active boolean);
create table public.jobs(id uuid primary key,job_number text,name text);
grant select on public.app_users,public.jobs to authenticated;
create table public.my_work_message_deletion_audit(deleted_message_id uuid);
create table public.account_notifications(user_id uuid,notification_key text,notification_type text,title text,body text,metadata jsonb,unique(user_id,notification_key));
${await read('supabase/migrations/20260831_016_my_work_inbox.sql')}
${await read('supabase/migrations/20260831_017_my_work_inbox_attachments.sql')}
${actors.map((a,i)=>`insert into app_users values('${a.id}','Local fixture ${i}','${a.role}',${i!==4});`).join('\n')}
`);
sql("notify pgrst,'reload schema';");
await new Promise(r=>setTimeout(r,1000));
const bucket='my-work-inbox-attachments';
// Real historical small-file workflow before installing the new contract.
const old=await sender.client.rpc('create_my_work_inbox_message_draft',{p_recipient_user_id:recipient.id,p_body:'Historical private message',p_job_id:null});assert.ifError(old.error);
const oldAttachment=randomUUID(),oldPath=`${old.data}/${oldAttachment}/old.png`;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7l8AAAAASUVORK5CYII=','base64');
assert.ifError((await sender.client.storage.from(bucket).upload(oldPath,png,{contentType:'image/png'})).error);
assert.ifError((await sender.client.from('my_work_message_attachments').insert({id:oldAttachment,message_id:old.data,uploader_user_id:sender.id,storage_path:oldPath,original_filename:'old.png',content_type:'image/png',byte_size:png.length})).error);
assert.ifError((await sender.client.rpc('finalize_my_work_inbox_message',{p_message_id:old.data,p_expected_attachment_count:1})).error);
const historyBefore=sql(`select md5(row_to_json(a)::text) from my_work_message_attachments a where message_id='${old.data}';`);
sql(await read('supabase/migrations/20260925120000_messaging_large_attachments.sql'));
sql(await read('supabase/config-changes/20260925_messaging_attachment_bucket.sql'));
// Match the existing Admin cleanup DELETE policy from the actual ancestor, without unrelated task fixtures.
const lifecycle=await read('supabase/migrations/20260831_020_my_work_lifecycle_admin_cleanup.sql');
sql(lifecycle.match(/create policy my_work_inbox_attachment_object_admin_delete[\s\S]*?\n\);/)[0]);
sql("notify pgrst,'reload schema';");
await new Promise(r=>setTimeout(r,1000));
const mid=randomUUID(),entries=[{id:randomUUID(),name:'drawing & #.dwg',size:50000000,contentType:'application/octet-stream'},{id:randomUUID(),name:'installer.exe',size:50000000,contentType:'application/octet-stream'}];
entries.push(...['archive.unknown','model.bin'].map(name=>({id:randomUUID(),name,size:50000000,contentType:'application/octet-stream'})));
const beginArgs={p_id:mid,p_recipient:recipient.id,p_body:'Large local fixture',p_job:null,p_files:entries};
assert.ifError((await sender.client.rpc('begin_my_work_attachment_transfer',beginArgs)).error);
const wrong=await sender.client.rpc('begin_my_work_attachment_transfer',{...beginArgs,p_id:randomUUID(),p_files:[{...entries[0],id:randomUUID(),size:50000001}]});assert(wrong.error);
assert((await sender.client.rpc('begin_my_work_attachment_transfer',{...beginArgs,p_id:randomUUID(),p_files:[...entries,{id:randomUUID(),name:'extra',size:1,contentType:'application/octet-stream'}]})).error);
assert((await sender.client.rpc('finalize_my_work_inbox_message',{p_message_id:mid,p_expected_attachment_count:4})).error);
await mkdir('.tmp-messaging',{recursive:true});
await build({stdin:{contents:"import * as transfer from './src/modules/my-work/messaging/transfer'; window.messaging=transfer;",resolveDir:process.cwd()},bundle:true,platform:'browser',format:'iife',outfile:'.tmp-messaging/transfer.js'});
const script=await readFile('.tmp-messaging/transfer.js');
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/transfer.js'?'text/javascript':'text/html');res.end(req.url==='/transfer.js'?script:'<!doctype html><script src="/transfer.js"></script>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}`);
 const uploadResult=await page.evaluate(async({base,key,token,mid,entries})=>{
  let maxProgress=0;for(const entry of entries){const file=new File(Array(50).fill(new Uint8Array(1000000)),entry.name);await window.messaging.uploadResumable({baseUrl:base,id:mid,entry,file,signal:new AbortController().signal,credentials:async()=>({token,key}),progress:bytes=>{maxProgress=Math.max(maxProgress,bytes);}});}return{maxProgress};
 },{base,key,token:sender.token,mid,entries});assert.equal(uploadResult.maxProgress,50000000);
 const path=`${mid}/${entries[0].id}/file`;
 for(const a of [recipient,unrelated,admin,inactive])assert((await a.client.storage.from(bucket).createSignedUrl(path,600)).error,'draft must remain sender-private');
 assert.ifError((await sender.client.rpc('finalize_my_work_inbox_message',{p_message_id:mid,p_expected_attachment_count:4})).error);
 assert.ifError((await sender.client.rpc('finalize_my_work_inbox_message',{p_message_id:mid,p_expected_attachment_count:4})).error);
 for(const a of [unrelated,admin,inactive])assert((await a.client.storage.from(bucket).createSignedUrl(path,600)).error,'nonparticipant signing denied');
 const anonymous=createClient(base,key,{auth:{persistSession:false}});assert((await anonymous.storage.from(bucket).createSignedUrl(path,600)).error);
 const signed=await recipient.client.storage.from(bucket).createSignedUrl(path,600);assert.ifError(signed.error);
 const download=new URL(signed.data.signedUrl);download.searchParams.set('download',entries[0].name);
 const response=await fetch(download);assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/attachment/);assert.match(response.headers.get('content-type'),/application\/octet-stream/);
 let size=0;const hash=createHash('sha256');for await(const chunk of response.body){size+=chunk.length;hash.update(chunk);}assert.equal(size,50000000);
 const expected=createHash('sha256');const part=Buffer.alloc(1000000);for(let i=0;i<50;i++)expected.update(part);assert.equal(hash.digest('hex'),expected.digest('hex'));
 const guessed=await fetch(`${base}/storage/v1/object/authenticated/${bucket}/${path}`,{headers:{apikey:key,Authorization:`Bearer ${unrelated.token}`}});assert.notEqual(guessed.status,200);
 assert.notEqual((await fetch(`${base}/storage/v1/object/public/${bucket}/${path}`)).status,200);
 assert.equal(sql(`select count(*) from account_notifications where notification_key='inbox-message:${mid}';`).trim(),'1');
 assert.equal(sql(`select md5(row_to_json(a)::text) from my_work_message_attachments a where message_id='${old.data}';`),historyBefore);
 const oldSigned=await recipient.client.storage.from(bucket).createSignedUrl(oldPath,600);assert.ifError(oldSigned.error);assert.deepEqual(Buffer.from(await (await fetch(oldSigned.data.signedUrl)).arrayBuffer()),png);
 // Actual cancel and cleanup including late writes. Small binary/active content uses same reservation.
 const cancelId=randomUUID(),entry={id:randomUUID(),name:'active.html',size:4,contentType:'application/octet-stream'};
 assert.ifError((await sender.client.rpc('begin_my_work_attachment_transfer',{p_id:cancelId,p_recipient:recipient.id,p_body:'Cancel fixture',p_job:null,p_files:[entry]})).error);
 const cancelPath=`${cancelId}/${entry.id}/file`;
 assert((await sender.client.storage.from(bucket).upload(cancelPath,Buffer.from('<b/>'),{contentType:'text/html'})).error,'active MIME must fail the actual-object guard');
 assert.ifError((await sender.client.storage.from(bucket).upload(cancelPath,Buffer.from('<b/>'),{contentType:'application/octet-stream'})).error);
 const canceled=await sender.client.rpc('cancel_my_work_attachment_transfer',{p_id:cancelId});assert.ifError(canceled.error);
 assert((await sender.client.rpc('discard_my_work_inbox_message_draft',{p_message_id:cancelId})).error);
 assert.ifError((await sender.client.storage.from(bucket).remove(canceled.data)).error);
 assert.ifError((await sender.client.rpc('discard_my_work_inbox_message_draft',{p_message_id:cancelId})).error);
 assert((await sender.client.storage.from(bucket).upload(cancelPath,Buffer.from('<b/>'),{contentType:'application/octet-stream'})).error);
 const expiry=await recipient.client.storage.from(bucket).createSignedUrl(path,1);assert.ifError(expiry.error);await new Promise(r=>setTimeout(r,2200));assert.notEqual((await fetch(expiry.data.signedUrl,{method:'HEAD'})).status,200);
 const renewed=await recipient.client.storage.from(bucket).createSignedUrl(path,600);assert.ifError(renewed.error);
 assert.equal((await recipient.client.rpc('recover_my_work_attachment_transfer',{p_id:mid})).data,null);
 assert.equal((await sender.client.rpc('recover_my_work_attachment_transfer',{p_id:mid})).data.id,mid);
 // New previewable small files use the same TUS path, while Storage keeps binary MIME.
 const imageId=randomUUID(),imageEntry={id:randomUUID(),name:'new.png',size:png.length,contentType:'image/png'};
 assert.ifError((await sender.client.rpc('begin_my_work_attachment_transfer',{p_id:imageId,p_recipient:recipient.id,p_body:'Small preview regression',p_job:null,p_files:[imageEntry]})).error);
 await page.evaluate(async({base,key,token,id,entry,bytes})=>{const file=new File([new Uint8Array(bytes)],'new.png',{type:'image/png'});await window.messaging.uploadResumable({baseUrl:base,id,entry,file,signal:new AbortController().signal,credentials:async()=>({token,key}),progress:()=>{}});},{base,key,token:sender.token,id:imageId,entry:imageEntry,bytes:[...png]});
 assert.ifError((await sender.client.rpc('finalize_my_work_inbox_message',{p_message_id:imageId,p_expected_attachment_count:1})).error);
 const imageSigned=await recipient.client.storage.from(bucket).createSignedUrl(`${imageId}/${imageEntry.id}/file`,600);assert.ifError(imageSigned.error);
 const width=await page.evaluate(url=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img.naturalWidth);img.onerror=()=>reject(Error('Binary-backed raster preview failed'));img.src=url;}),imageSigned.data.signedUrl);assert.equal(width,1);
 // Actual worker removes old draft bytes through Storage API, then guarded metadata cleanup.
 const abandoned=randomUUID(),abandonedEntry={id:randomUUID(),name:'abandoned.zip',size:4,contentType:'application/octet-stream'};
 assert.ifError((await sender.client.rpc('begin_my_work_attachment_transfer',{p_id:abandoned,p_recipient:recipient.id,p_body:'Abandoned local fixture',p_job:null,p_files:[abandonedEntry]})).error);
 const abandonedPath=`${abandoned}/${abandonedEntry.id}/file`;
 assert.ifError((await sender.client.storage.from(bucket).upload(abandonedPath,Buffer.from('test'),{contentType:'application/octet-stream'})).error);
 sql(`update my_work_messages set upload_touched_at=now()-interval '8 days' where id='${abandoned}';`);
 const cleaned=spawnSync(process.execPath,['scripts/cleanup-messaging-drafts.mjs','--execute'],{env:{...process.env,SUPABASE_URL:base,SUPABASE_SERVICE_ROLE_KEY:config.SERVICE_ROLE_KEY},encoding:'utf8'});assert.equal(cleaned.status,0,cleaned.stderr);assert.equal(sql(`select count(*) from my_work_messages where id='${abandoned}';`).trim(),'0');assert((await sender.client.storage.from(bucket).createSignedUrl(abandonedPath,600)).error);
 const result={smallTusImagePreview:true,actualAbandonedWorker:true,signedExpiryDenied:true,renewedAfterExpiry:true,senderOnlyRecovery:true,activeMimeRejected:true,actualSupabaseStorage:true,uploadedBytes:200000000,downloadedBytes:size,sha256Matches:true,contentDisposition:response.headers.get('content-disposition'),contentType:response.headers.get('content-type'),nosniff:response.headers.get('x-content-type-options'),draftRecipientDenied:true,unrelatedAdminDenied:true,inactiveAnonymousDenied:true,guessedPublicPathDenied:true,idempotentFinalize:true,actualCancelCleanup:true,historicalBytesUnchanged:true,scope:'Disposable LOCAL Supabase only; hosted capacity unverified'};
 await mkdir('.tmp-messaging',{recursive:true});await writeFile('.tmp-messaging/storage-results.json',JSON.stringify(result,null,2));
 console.log('PASS: actual local Supabase TUS 200 MB aggregate; byte-identical 50 MB download; forced disposition; sender/recipient/unrelated/Admin/inactive/anonymous authorization; finalize idempotency; cleanup; historical bytes.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
