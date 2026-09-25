/** LOCAL Supabase only: tiny objects, real JWT gateway, Edge runtime, Storage, Vault/pg_net/cron. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const fixture=readFileSync('scripts/verify-messaging-storage-local.mjs','utf8').split('const mid=randomUUID()')[0];
const tests=`
const {cp}=await import('node:fs/promises');const {spawn}=await import('node:child_process');
sql(await read('supabase/operations/messaging/cleanup-setup.sql'));
sql(await read('supabase/operations/messaging/cleanup-setup.sql'));
assert.equal(sql("select count(*) from cron.job where jobname='tenops-messaging-abandoned-drafts';").trim(),'1');
assert.equal(sql("select active from cron.job where jobname='tenops-messaging-abandoned-drafts';").trim(),'f');
assert.equal(sql("select has_table_privilege('service_role','public.messaging_cleanup_runs','delete');").trim(),'f');
const secret='local-only-messaging-'+randomUUID();
sql("delete from vault.secrets where name in ('messaging_cleanup_invocation','messaging_cleanup_gateway_jwt'); select vault.create_secret('"+secret+"','messaging_cleanup_invocation'); select vault.create_secret('"+key+"','messaging_cleanup_gateway_jwt');");
await mkdir('.tmp-messaging-supabase/supabase/functions',{recursive:true});
await cp('supabase/functions/cleanup-messaging-drafts','.tmp-messaging-supabase/supabase/functions/cleanup-messaging-drafts',{recursive:true});
await writeFile('.tmp-messaging-operations/edge.env','MESSAGING_CLEANUP_INVOCATION_SECRET='+secret+'\\n',{mode:0o600});
const edge=spawn('npx',['--yes','supabase@2.110.0','functions','serve','cleanup-messaging-drafts','--workdir','.tmp-messaging-supabase','--env-file','.tmp-messaging-operations/edge.env'],{stdio:['ignore','pipe','pipe'],detached:true});
let edgeLog='';edge.stdout.on('data',x=>edgeLog+=x);edge.stderr.on('data',x=>edgeLog+=x);
const endpoint=base+'/functions/v1/cleanup-messaging-drafts';
const invoke=(token=key,invocation=secret)=>fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'x-messaging-cleanup-secret':invocation}});
try{
 let ready=false;for(let i=0;i<60;i++){try{const r=await invoke();if(r.status===200){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
 if(!ready){await writeFile('.tmp-messaging-operations/edge-failure.log',edgeLog);throw Error('Local Edge startup failed; inspect ignored edge-failure.log');}
 assert.equal((await invoke('invalid-jwt')).status,401);assert.equal((await invoke(key,'wrong')).status,401);assert.equal((await invoke(key,'')).status,401);
 const before=sql("select count(*) from messaging_cleanup_runs;");await invoke(key,'wrong');assert.equal(sql("select count(*) from messaging_cleanup_runs;"),before);
 const active=randomUUID(),aid=randomUUID(),path=active+'/'+aid+'/file';
 assert.ifError((await sender.client.rpc('begin_my_work_attachment_transfer',{p_id:active,p_recipient:recipient.id,p_body:'Abandoned local fixture',p_job:null,p_files:[{id:aid,name:'fixture.bin',size:3,contentType:'application/octet-stream'}]})).error);
 assert.ifError((await sender.client.storage.from(bucket).upload(path,Buffer.from('abc'),{contentType:'application/octet-stream'})).error);
 assert.equal((await invoke()).status,200);assert.equal(sql("select count(*) from my_work_messages where id='"+active+"';").trim(),'1','Heartbeat grace protects active draft');
 sql("update my_work_messages set upload_touched_at=now()-interval '8 days' where id='"+active+"';");
 const cleaned=await invoke();assert.equal(cleaned.status,200);const result=await cleaned.json();assert.equal(result.claimed,1);assert.equal(result.cleaned,1);assert.equal(result.failed,0);
 assert.equal(sql("select count(*) from my_work_messages where id='"+active+"';").trim(),'0');
 assert.equal((await invoke()).status,200);assert.equal(sql("select count(*) from storage.objects where name='"+oldPath+"';").trim(),'1');
 // Use local Kong hostname ONLY in disposable copy of dispatcher; never modify release artifact.
 const production='https://vxdxjhazkqhpkwdqtobp.supabase.co/functions/v1/cleanup-messaging-drafts';
 const localSetup=(await read('supabase/operations/messaging/cleanup-setup.sql')).replace(production,'http://kong:8000/functions/v1/cleanup-messaging-drafts');
 sql(localSetup);
 const fakeServiceJWT='a.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.c';
 const rejected=spawnSync('docker',['exec','-i',db,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres'],{input:"begin; select vault.update_secret((select id from vault.secrets where name='messaging_cleanup_gateway_jwt'),'"+fakeServiceJWT+"'); select dispatch_messaging_cleanup(); rollback;",encoding:'utf8'});
 assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/must be anon JWT/);
 const requestId=sql('select dispatch_messaging_cleanup();').trim();
 let received=false;for(let i=0;i<40;i++){if(sql("select count(*) from messaging_cleanup_runs where request_id="+requestId+" and status='succeeded';").trim()==='1'){received=true;break;}await new Promise(r=>setTimeout(r,250));}
 assert(received,'Real pg_net request must reach authenticated Edge function');
 sql(await read('supabase/operations/messaging/cleanup-enable.sql'));sql(await read('supabase/operations/messaging/cleanup-enable.sql'));
 sql(localSetup);assert.equal(sql("select count(*) from cron.job where jobname='tenops-messaging-abandoned-drafts' and active;").trim(),'1');
 sql(await read('supabase/operations/messaging/cleanup-disable.sql'));sql(await read('supabase/operations/messaging/cleanup-disable.sql'));
 assert.equal(sql("select active from cron.job where jobname='tenops-messaging-abandoned-drafts';").trim(),'f');
 assert((await sender.client.from('messaging_cleanup_runs').select('*')).error,'Private operational logs');
 await mkdir('.tmp-messaging-operations',{recursive:true});await writeFile('.tmp-messaging-operations/local-results.json',JSON.stringify({realEdge:true,jwtDenied:true,wrongMissingSecretDenied:true,activeProtected:true,staleCleaned:true,finalizedPreserved:true,repeatSafe:true,realPgNetDispatch:true,realCronSetupIdempotent:true,enableDisable:true,privateMonitoring:true,largeTransfers:false},null,2));
 console.log('PASS: real local Edge/JWT/secret; small Storage cleanup; active/finalized protection; private run monitoring; Vault + pg_net dispatch; idempotent Cron install/enable/disable.');
}finally{process.kill(-edge.pid,'SIGTERM');edge.stdout.destroy();edge.stderr.destroy();}
`;
mkdirSync('.tmp-messaging-operations',{recursive:true});writeFileSync('.tmp-messaging-operations/local-verifier.mjs',fixture+tests);
const result=spawnSync(process.execPath,['.tmp-messaging-operations/local-verifier.mjs','--reset-local-fixture'],{stdio:'inherit'});process.exitCode=result.status;
