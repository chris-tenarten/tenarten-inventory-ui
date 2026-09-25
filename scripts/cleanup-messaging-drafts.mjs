/** Prepared maintenance worker. No work unless --execute is explicitly passed.
 * Schedule daily only after separate hosted authorization. Never log private paths.
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must come from the runtime secret store.
 */
import {createClient} from '@supabase/supabase-js';
const execute=process.argv.includes('--execute');
if(!execute){console.log('Dry run: no requests. Seven-day draft cleanup requires --execute; hosted execution additionally requires --allow-hosted.');process.exit(0);}
const url=process.env.SUPABASE_URL;
if(!url||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Runtime Storage credentials required.');
const local=['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname);
if(!local&&!process.argv.includes('--allow-hosted'))throw Error('Hosted cleanup requires explicit authorization and --allow-hosted.');
const client=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data,error}=await client.rpc('claim_abandoned_my_work_transfers',{p_limit:50});
if(error)throw Error('Unable to claim abandoned drafts.');
let completed=0,failed=0;
for(const draft of data??[]){
  try{
    for(let i=0;i<draft.paths.length;i+=100){const{error}=await client.storage.from('my-work-inbox-attachments').remove(draft.paths.slice(i,i+100));if(error)throw error;}
    const{error}=await client.rpc('finish_abandoned_my_work_transfer',{p_id:draft.message_id});if(error)throw error;
    completed++;
  }catch{failed++;}
}
console.log(JSON.stringify({claimed:data?.length??0,completed,failed}));
if(failed)process.exitCode=1;
