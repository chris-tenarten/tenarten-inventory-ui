/** LOCAL ONLY: reuse the guarded V1.1 fixture/harness, not its completed test suite. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const local=process.env.MESSAGING_LOCAL_WORKDIR||'/private/tmp/tenops-messaging-large-attachments/.tmp-messaging-supabase';
const fixture=readFileSync('scripts/verify-messaging-storage-local.mjs','utf8').split('const mid=randomUUID()')[0].replaceAll("'.tmp-messaging-supabase'",JSON.stringify(local));
const v11=readFileSync('scripts/messaging-v11-tests.mjs','utf8');
const setup=v11.slice(0,v11.indexOf("console.log('PASS migration"))+v11.slice(v11.indexOf('const cfg='),v11.indexOf('try{\n const contexts='));
const tests=readFileSync('scripts/messaging-composer-completion-tests.mjs','utf8');
mkdirSync('.tmp-messaging-completion',{recursive:true});
writeFileSync('.tmp-messaging-completion/verifier.mjs',(fixture+setup+tests).replaceAll('.tmp-messaging-v11','.tmp-messaging-completion'));
const result=spawnSync(process.execPath,['.tmp-messaging-completion/verifier.mjs','--reset-local-fixture'],{stdio:'inherit',env:process.env});process.exitCode=result.status;
