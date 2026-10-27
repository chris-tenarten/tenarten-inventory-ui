import {createClient} from 'npm:@supabase/supabase-js@2.101.1';
import {handleTenbot} from '../_shared/tenbot-handler.ts';
import {cloudflareProvider,TenbotError} from '../_shared/tenbot-core.ts';
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
 const caller=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
 const {data,error}=await caller.auth.getUser(authorization.replace(/^Bearer\s+/i,''));if(error||!data.user)return reply({error:'Sign in required.'},401);
 // Stream-bound request body even when Content-Length is absent or false.
 const reader=request.body?.getReader();let raw='';let bytes=0;if(!reader)throw new TenbotError('Request required.');const decoder=new TextDecoder();
 while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>16000){await reader.cancel();throw new TenbotError('Request too large.',413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();
 const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw new TenbotError('Invalid request.');
 const account=Deno.env.get('TENBOT_CF_ACCOUNT_ID'),token=Deno.env.get('TENBOT_CF_AI_TOKEN');
 const provider=account&&token?cloudflareProvider(account,token):null;
 // Privileged client is confined to two usage RPCs, never handed to inference.
 const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 return reply(await handleTenbot(body,data.user.id,(n,a)=>caller.rpc(n,a),(n,a)=>service.rpc(n,a),provider,Number(Deno.env.get('TENBOT_MONTHLY_BUDGET_USD')||0)));
 }catch(e){return reply({error:e instanceof TenbotError?e.message:'TenBot is temporarily unavailable.'},e instanceof TenbotError?e.status:503);}
});
