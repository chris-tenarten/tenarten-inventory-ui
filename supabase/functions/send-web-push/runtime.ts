import webpush from 'npm:web-push@3.6.7';
import {createClient} from 'npm:@supabase/supabase-js@2.101.1';
import {createHandler,endpointAllowed} from './core.mjs';
import {createDiagnosticRpc} from './diagnostics.mjs';
export function serveWebPush(environment:string,prefix:string){
const config=(name:string)=>Deno.env.get(prefix+name);
// Each invocation owns its client and diagnostic state; concurrent wakes cannot mix IDs.
Deno.serve(request=>{
const rpc=createDiagnosticRpc({environment,deploymentId:Deno.env.get('DENO_DEPLOYMENT_ID'),executionId:Deno.env.get('SB_EXECUTION_ID'),connect:(transportFetch:typeof fetch)=>createClient(Deno.env.get('SUPABASE_URL')||'http://127.0.0.1',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'disabled',{
 auth:{persistSession:false,autoRefreshToken:false},global:{fetch:transportFetch},
})});
return createHandler({
 environment,enabled:config('ENABLED')==='true',secret:config('WAKE_SECRET')||'',rpc,
 encrypt:async(row:{key_version:string;endpoint:string;keys:{auth:string;p256dh:string}},payload:unknown,ttl:number)=>{
  const keys=JSON.parse(config('VAPID_KEYS')||'{}')[row.key_version];
  if(!keys)throw new Error('VAPID version unavailable');
  return webpush.generateRequestDetails({endpoint:row.endpoint,keys:row.keys},JSON.stringify(payload),{TTL:ttl,contentEncoding:'aes128gcm',vapidDetails:{subject:config('CONTACT')||'mailto:operations@example.invalid',publicKey:keys.publicKey,privateKey:keys.privateKey}});
 },
 submit:(endpoint:string,details:{headers:HeadersInit;body:Uint8Array})=>{
  if(!endpointAllowed(endpoint))throw new Error('Invalid endpoint');
  // Library generates encryption only. Native fetch prevents redirects and bounds duration.
  return fetch(endpoint,{method:'POST',headers:details.headers,body:details.body,redirect:'error',signal:AbortSignal.timeout(5000)});
 },
})(request);
});

}
