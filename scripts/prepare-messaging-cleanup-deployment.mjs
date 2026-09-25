/** Local staging only. Never deploys, sets secrets, or accesses hosted services. */
import {mkdir,copyFile,cp} from 'node:fs/promises';
const target='.tmp-messaging-operations/deploy/supabase';
await mkdir(`${target}/functions`,{recursive:true});
await copyFile('supabase/operations/messaging/edge-config.toml',`${target}/config.toml`);
await cp('supabase/functions/cleanup-messaging-drafts',`${target}/functions/cleanup-messaging-drafts`,{recursive:true});
console.log('Prepared isolated JWT-verified Edge deployment directory; no hosted requests.');
