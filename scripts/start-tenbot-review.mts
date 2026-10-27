// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Node fixture shares untyped SQL helpers.
// @ts-nocheck -- Local-only adapter; only privacy-filtered workflow intent, own-assistant context and vetted excerpts reach AI.
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {sql,literal,json,asUser,admin,docker,startIntakeDatabase} from './support/intake-materials-database.mjs';
import {handleTenbot} from '../supabase/functions/_shared/tenbot-handler.ts';
import {TenbotError} from '../supabase/functions/_shared/tenbot-core.ts';
import {pilotProvider,pilotCaps} from './support/tenbot-ai-pilot.mjs';
const container='tenops-tenbot-review',port=55593,origin='http://localhost:3000';
const aiPilot=process.argv.includes('--ai-pilot'),provider=aiPilot?pilotProvider():null;
// Reuse the established disposable fixture in a task-owned store. Other local
// workstreams may restart their review database without destroying feedback.
try{docker(['inspect',container]);}catch{startIntakeDatabase(container);}
const migration=readFileSync('supabase/migrations/20261027120000_tenbot_feedback_usage.sql','utf8');
if(!sql(container,"select to_regclass('public.tenbot_feedback')"))sql(container,migration);
else sql(container,'begin;'+migration.slice(migration.indexOf('create function public.tenbot_submit_feedback')).replaceAll('create function public.tenbot_','create or replace function public.tenbot_')); // Refresh only this task’s local RPCs, preserving feedback/history.
// Forward candidate policy, local fixture only. Refreshing functions preserves
// all prior reservations; no user receives a separate daily allocation.
const sharedUsage=readFileSync('supabase/migrations/20261027130000_tenbot_shared_usage_pool.sql','utf8');
sql(container,sharedUsage.replace('create function public.tenbot_usage_summary','create or replace function public.tenbot_usage_summary'));
const measuredUsage=readFileSync('supabase/migrations/20261027140000_tenbot_measured_free_pool.sql','utf8');
if(!sql(container,"select column_name from information_schema.columns where table_schema='public' and table_name='tenbot_usage' and column_name='reserved_neurons'"))sql(container,measuredUsage);
else sql(container,'begin;'+measuredUsage.slice(measuredUsage.indexOf('create function public.tenbot_usage_policy')).replaceAll('create function public.tenbot_','create or replace function public.tenbot_'));
if(process.argv.includes('--refresh-only')){console.log('Local TenBot RPCs refreshed; feedback preserved.');process.exit(0);}
const rpc=(role='authenticated')=>async(name,args={})=>{try{if(!/^(has_app_capability|has_proposal_access|tenbot_[a-z_]+)$/.test(name))throw Error('Unsupported local RPC');const expression=`public.${name}(${Object.entries(args).map(([k,v])=>`${k}=>${v===null?'null':typeof v==='object'?json(v):typeof v==='boolean'?String(v):literal(v)}`).join(',')})`;const query=asUser('select to_jsonb('+expression+')',admin,role);
 const raw=sql(container,query);
 return {data:raw?JSON.parse(raw):null,error:null};}catch(e){return {data:null,error:{message:e.message}};}};
const server=createServer(async(req,res)=>{
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const send=(status,body)=>res.writeHead(status,headers).end(JSON.stringify(body));
 if(req.headers.origin!==origin)return send(403,{error:'Local review origin required.'});
 if(req.method==='OPTIONS'){res.writeHead(204,headers).end();return;}
 if(req.method!=='POST')return send(405,{error:'POST required'});
 // Only the existing local fixture token is accepted. No synthetic Auth accounts.
 const token=(req.headers.authorization||'').replace(/^Bearer /,'');
 if(!token.endsWith('.local'))return send(401,{error:'Local review session required.'});
 try{const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());if(claims.sub!==admin)throw Error();}catch{return send(401,{error:'Invalid local session.'});}
 try{let raw='';for await(const c of req){raw+=c;if(Buffer.byteLength(raw)>16000)return send(413,{error:'Request too large'});}const body=JSON.parse(raw);
 try{send(200,await handleTenbot(body,admin,rpc(),rpc('service_role'),body.action==='ask'?provider:null,aiPilot?pilotCaps.monthlyUsd:0));}
 catch(e){
  // Keep existing direct search usable on quota, provider and validation errors.
  // Authorization and feedback errors retain their original behavior.
  if(!aiPilot||body.action!=='ask'||!(e instanceof TenbotError)||![429,502,503].includes(e.status))throw e;
  send(200,{...await handleTenbot(body,admin,rpc(),rpc('service_role'),null,0),fallback:true});
 }
 }catch(e){send(e instanceof TenbotError?e.status:500,{error:e instanceof TenbotError?e.message:'Local review request failed.'});}
});
mkdirSync('/private/tmp/tenops-tenbot-review',{recursive:true});
server.listen(port,'::1',()=>{writeFileSync('/private/tmp/tenops-tenbot-review/server.json',JSON.stringify({pid:process.pid,port,container,origin,provider:aiPilot?provider.name:'not activated',...(aiPilot?{caps:pilotCaps}:{})},null,2));console.log('TenBot review adapter on localhost:'+port+'; application remains '+origin+'/my-work');});
