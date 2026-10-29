// LOCAL, existing isolated Supabase only. Never forwards to the released project.
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync,lstatSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {createAuthenticatedReceivalAgent} from './support/tenbot-receival-agent.mjs';
import {TenbotError} from '../supabase/functions/_shared/tenbot-core';
import type {OpenAIModel} from '../supabase/functions/_shared/tenbot-openai';

const origin='http://localhost:3000',port=55596,directory='/private/tmp/tenops-tenbot-real-receivals-2026-10-29';
const configPath='.tmp-permission-review/config.json',info=lstatSync(configPath);
if(!info.isFile()||info.isSymbolicLink()||info.uid!==process.getuid?.()||(info.mode&0o777)!==0o600)throw Error('Existing owner-only isolated fixture configuration required.');
// This existing file contains test actor credentials too. Only the public anon
// key and fixed API URL are selected, never logged, returned or sent to inference.
const config=JSON.parse(readFileSync(configPath,'utf8'));
const url=config.apiUrl,key=config.anonKey;
if(url!=='http://127.0.0.1:55481'||typeof key!=='string')throw Error('Only the existing reviewed loopback Supabase fixture is allowed.');
try{if(JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role!=='anon')throw Error();}catch{throw Error('Only the existing public anonymous project key is allowed.');}
const model=(process.argv.find(a=>a.startsWith('--model='))?.slice(8)??'gpt-6.1-terra') as OpenAIModel;
if(!['gpt-6.1-terra','gpt-6.1-sol'].includes(model))throw Error('Experimental model is outside the allowlist.');
const provider=await import('./support/tenbot-live-provider.mjs');
const handler=createAuthenticatedReceivalAgent({model,createProvider:(label,image)=>provider.createMeasuredProvider(model,label,image),remainingUsd:()=>Math.max(0,5-provider.getJournal().reservedOrSpentUsd),assertNoFatal:provider.assertNoFatal});
const server=createServer(async(req,res)=>{
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const send=(status:number,value:unknown)=>res.writeHead(status,headers).end(JSON.stringify(value));
 if(req.headers.origin!==origin)return send(403,{error:'Exact localhost review origin required.'});
 if(req.method==='OPTIONS'){res.writeHead(204,headers).end();return;}
 if(req.method!=='POST')return send(405,{error:'POST required.'});
 const authorization=req.headers.authorization??'',token=authorization.replace(/^Bearer\s+/i,'');
 // Reject unsigned fixture sessions locally: do not retry the unresponsive
// database merely because the accepted simulation UI is open in another tab.
 if(!authorization.startsWith('Bearer ')||token.length>8000||token.split('.').length!==3||token.endsWith('.local')||token.endsWith('.local-only'))return send(401,{error:'A real authenticated isolated TenOps session is required. Real writes remain disabled.'});
 try{
  const caller=createClient(url,key,{global:{headers:{Authorization:authorization},fetch:async(input,init)=>fetch(input,{...init,signal:AbortSignal.any([AbortSignal.timeout(4000),...(init?.signal?[init.signal]:[])])})},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const authenticated=await caller.auth.getUser(token);
  if(authenticated.error||!authenticated.data.user)return send(401,{error:'Isolated TenOps authentication is unavailable or rejected. Real writes remain disabled.'});
  let bytes=0,raw='';for await(const chunk of req){bytes+=chunk.length;if(bytes>145000)return send(413,{error:'Invoice request is too large.'});raw+=chunk;}
  const body:unknown=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw new TenbotError('Invalid invoice request.');
  return send(200,await handler(body as Record<string,unknown>,authenticated.data.user.id,caller));
 }catch(error){return send(error instanceof TenbotError?error.status:503,{error:error instanceof TenbotError?error.message:'Authenticated isolated database integration is unavailable. Real writes remain disabled; no simulation or provider fallback was used.'});}
});
const shutdown=()=>server.close(()=>{provider.closeBudget();process.exit(0);});process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
mkdirSync(directory,{recursive:true});server.listen(port,'::1',()=>{
 writeFileSync(directory+'/server.json',JSON.stringify({pid:process.pid,port,origin,mode:'authenticated-receivals',model,target:'tenops-permission-review / loopback55481',callerAuth:'getUser on every request; no fixture JWTs or privileged key',executionEnabled:false,databaseBackedTestsPassed:false,productionRequests:0,budgetJournal:'/private/tmp/tenops-tenbot-agent-poc/openai-budget.json'},null,2));
 console.log('Authenticated TenBot candidate at '+origin+'/my-work?tenbotExperiment=1&tenbotReceivals=1; real execution disabled pending database validation.');
});
