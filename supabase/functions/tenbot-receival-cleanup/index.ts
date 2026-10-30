import {createClient} from 'npm:@supabase/supabase-js@2.101.1';
import {createTenbotReceivalCleanupHandler} from '../_shared/tenbot-receival-cleanup.ts';
import {INVOICE_RECEIVAL_SOURCE_BUCKET} from '../../../src/modules/inventory/invoice-receival-attachments.ts';
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
const clients=new WeakMap<AbortSignal,ReturnType<typeof createClient>>();
function maintenance(signal:AbortSignal){
 let client=clients.get(signal);if(client)return client;
 const boundedFetch:typeof fetch=(input,init)=>fetch(input,{...init,signal:AbortSignal.any([signal,...(init?.signal?[init.signal]:[]),AbortSignal.timeout(15000)])});
 client=createClient(Deno.env.get('SUPABASE_URL')??'',key,{global:{fetch:boundedFetch},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});clients.set(signal,client);return client;
}
Deno.serve(createTenbotReceivalCleanupHandler({
 enabled:Deno.env.get('TENBOT_RECEIVAL_CLEANUP_ENABLED')==='true',
 wakeSecret:Deno.env.get('TENBOT_RECEIVAL_CLEANUP_WAKE_SECRET')??'',
 rpc:(name,args,signal)=>maintenance(signal).rpc(name,args),
 remove:(paths,signal)=>maintenance(signal).storage.from(INVOICE_RECEIVAL_SOURCE_BUCKET).remove(paths),
}));
