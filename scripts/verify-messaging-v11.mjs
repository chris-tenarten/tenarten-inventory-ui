/** LOCAL ONLY: real Auth/Storage/PostgREST/Realtime, two browser contexts, small fixtures. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const local=process.env.MESSAGING_LOCAL_WORKDIR||'/private/tmp/tenops-messaging-large-attachments/.tmp-messaging-supabase';
let fixture=readFileSync('scripts/verify-messaging-storage-local.mjs','utf8').split('const mid=randomUUID()')[0];
fixture=fixture.replaceAll("'.tmp-messaging-supabase'",JSON.stringify(local));
const tests=readFileSync('scripts/messaging-v11-tests.mjs','utf8');
mkdirSync('.tmp-messaging-v11',{recursive:true});
writeFileSync('.tmp-messaging-v11/verifier.mjs',fixture+tests);
const result=spawnSync(process.execPath,['.tmp-messaging-v11/verifier.mjs','--reset-local-fixture'],{stdio:'inherit',env:process.env});process.exitCode=result.status;
