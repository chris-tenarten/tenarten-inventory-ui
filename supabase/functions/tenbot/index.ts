import {createClient} from 'npm:@supabase/supabase-js@2.101.1';
import {cloudflareProvider,TenbotError,MODEL} from '../_shared/tenbot-core.ts';
import {isAllowedModel} from '../_shared/tenbot-models.ts';
import {createTenbotJobTools} from '../_shared/tenbot-job-tools.ts';
import {createHostedTenbot,TENBOT_HOSTED_SERVICE_RPCS} from '../_shared/tenbot-hosted.ts';
Deno.serve(async(request:Request)=>{
 const origin=request.headers.get('origin')||'';
 const allowed=(Deno.env.get('TENBOT_ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean);
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Origin':allowed.includes(origin)?origin:'null','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!allowed.includes(origin))return reply({error:'Origin not allowed.'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return reply({error:'POST required.'},405);
 try{
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
 const authorization=request.headers.get('authorization')||'';
 const boundedFetch:typeof fetch=(input,init)=>fetch(input,{...init,signal:AbortSignal.any([...(init?.signal?[init.signal]:[]),AbortSignal.timeout(15000)])});
 const caller=createClient(url,anon,{global:{headers:{Authorization:authorization},fetch:boundedFetch},auth:{persistSession:false}});
 const {data,error}=await caller.auth.getUser(authorization.replace(/^Bearer\s+/i,''));if(error||!data.user)return reply({error:'Sign in required.'},401);
 // Stream-bound request body even when Content-Length is absent or false.
 const reader=request.body?.getReader();let raw='';let bytes=0;if(!reader)throw new TenbotError('Request required.');const decoder=new TextDecoder();
 while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>16000){await reader.cancel();throw new TenbotError('Request too large.',413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();
 const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw new TenbotError('Invalid request.');
 const account=Deno.env.get('TENBOT_CF_ACCOUNT_ID'),token=Deno.env.get('TENBOT_CF_AI_TOKEN');
 // Hosted inference stays default-off; removing legacy dollar-shaped testing
 // credits must not implicitly activate a configured provider. This flag is
 // not set by the local pilot or this candidate. Employee activation still
 // requires a separately reviewed free-only boundary and release.
 const model=Deno.env.get('TENBOT_CF_MODEL')||MODEL;
 const provider=Deno.env.get('TENBOT_AI_ENABLED')==='true'&&account&&token&&isAllowedModel(model)?cloudflareProvider(account,token,fetch,model):null;
 // Privileged client is confined to metering and a write-only assistant-turn RPC, never handed to inference.
 const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{global:{fetch:boundedFetch},auth:{persistSession:false}});
 const hosted=createHostedTenbot({owner:data.user.id,origin,
  config:{enabled:Deno.env.get('TENBOT_OPENAI_ENABLED')==='true',origins:(Deno.env.get('TENBOT_OPENAI_ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean),
   apiKey:Deno.env.get('TENBOT_OPENAI_API_KEY')||'',keyExpiresAt:Deno.env.get('TENBOT_OPENAI_KEY_EXPIRES_AT')||'',spendingAuthorized:Deno.env.get('TENBOT_OPENAI_SPEND_AUTHORIZED')==='true'},
  caller:(n,a)=>caller.rpc(n,a),service:(n,a)=>TENBOT_HOSTED_SERVICE_RPCS.has(n)?service.rpc(n,a):Promise.resolve({data:null,error:{message:'Metering action unavailable'}}),qwen:provider,jobTools:createTenbotJobTools(caller)});
 return reply(await hosted(body));
 }catch(e){return reply({error:e instanceof TenbotError?e.message:'TenBot is temporarily unavailable.'},e instanceof TenbotError?e.status:503);}
});
