import {createClient} from 'npm:@supabase/supabase-js@2.101.1';
import {createTenbotReceivalCleanupHandler} from '../_shared/tenbot-receival-cleanup.ts';
import {INVOICE_RECEIVAL_SOURCE_BUCKET} from '../../../src/modules/inventory/invoice-receival-attachments.ts';
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
const boundedFetch:typeof fetch=(input,init)=>fetch(input,{...init,signal:AbortSignal.any([...(init?.signal?[init.signal]:[]),AbortSignal.timeout(15000)])});
let client:ReturnType<typeof createClient>|undefined;
function maintenance(){return client??=createClient(Deno.env.get('SUPABASE_URL')??'',key,{global:{fetch:boundedFetch},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
Deno.serve(createTenbotReceivalCleanupHandler({
 enabled:Deno.env.get('TENBOT_RECEIVAL_CLEANUP_ENABLED')==='true',serviceRoleKey:key,
 rpc:(name,args)=>maintenance().rpc(name,args),
 remove:(paths)=>maintenance().storage.from(INVOICE_RECEIVAL_SOURCE_BUCKET).remove(paths),
}));
