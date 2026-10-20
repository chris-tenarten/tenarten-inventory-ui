// Focused controller tests: injected browser/SDK adapters; no real vendor requests.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
process.env.NEXT_PUBLIC_SUPABASE_URL='http://localhost:3000';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='local-test-only';
const values=new Map();
globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
globalThis.window={isSecureContext:true,matchMedia:()=>({matches:false}),setTimeout,clearTimeout,PushManager:{},Notification:{}};
let permission='default',permissionCalls=0,subscription=null,failUnsubscribe=false,failRpc=false,actor='A',registrationHold=null;
let registerCalls=0,revokeCalls=0;const rows=new Map();
globalThis.Notification={get permission(){return permission;},requestPermission:()=>{permissionCalls++;return Promise.resolve(permission='granted');}};
function freshSubscription(){const endpoint='https://web.push.apple.com/test-'+crypto.randomUUID();return{endpoint,expirationTime:null,toJSON:()=>({endpoint,keys:{p256dh:'BA'+'A'.repeat(85),auth:'A'.repeat(22)}}),unsubscribe:async()=>{if(failUnsubscribe)throw Error('offline unsubscribe');subscription=null;return true;}};}
const registration={getNotifications:async()=>[],pushManager:{getSubscription:async()=>subscription,subscribe:async()=>subscription=freshSubscription()}};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{userAgent:'Desktop',platform:'MacIntel',maxTouchPoints:0,serviceWorker:{register:async()=>registration,ready:Promise.resolve(registration),getRegistration:async()=>registration}}});
const {supabase}=await import('../src/lib/supabase.ts');
supabase.auth.getSession=async()=>({data:{session:{user:{id:actor},access_token:actor}}});
supabase.rpc=(name,args)=>({setHeader(){return this;},abortSignal:async()=>{
 if(failRpc)return{error:{message:'offline'}};
 if(name==='get_my_web_push_configuration')return{data:config};
 if(name==='register_my_web_push_subscription'){
  registerCalls++;const owner=actor;
  if(registrationHold)await registrationHold;
  rows.set(args.p_id,{owner,generation:1,enabled:true});return{data:{id:args.p_id,generation:1}};
 }
 const row=rows.get(args.p_id);
 if(name==='get_my_web_push_subscription')return{data:row?.owner===actor?row:null};
 if(name==='revoke_my_web_push_subscription'){revokeCalls++;if(row?.owner===actor&&row.generation===args.p_generation){row.enabled=false;row.generation++;}return{data:!(row?.owner===actor&&row.enabled)};}
 throw Error(name);
}});
const config={environment:'test',public_key:'BA'+'A'.repeat(85),key_version:'test'};
const push=await import('../src/lib/web-push.ts');
const checks=[];
const flush=()=>new Promise(r=>setTimeout(r,5));
async function run(name,work){await work();checks.push(name);console.log('PASS '+name);}
await run('mount and account verification never request permission',async()=>{push.setPushAccount('A');await flush();assert.equal((await push.inspectPushDevice('A')).registered,false);assert.equal(permissionCalls,0);});
await run('explicit click requests permission synchronously and registers',async()=>{const work=push.enablePushDevice('A',config);assert.equal(permissionCalls,1);await work;assert.equal((await push.inspectPushDevice('A')).registered,true);});
await run('stored browser metadata excludes subscription material',async()=>{const stored=values.get('tenops.push.device.v1');assert(stored);assert(!/endpoint|p256dh|public_key|access_token/.test(stored));});
await run('same account resolution preserves registration',async()=>{push.setPushAccount('A');await flush();assert.equal((await push.inspectPushDevice('A')).registered,true);});
await run('disable revokes generation and local subscription',async()=>{const id=JSON.parse(values.get('tenops.push.device.v1')).id;await push.disablePushDevice('A');assert.equal(rows.get(id).enabled,false);assert.equal(rows.get(id).generation,2);assert.equal(subscription,null);});
await run('denied permission causes no registration',async()=>{permission='denied';const before=registerCalls;await assert.rejects(push.enablePushDevice('A',config),/not allowed/);assert.equal(registerCalls,before);});
await run('expired browser subscription is cleaned up',async()=>{permission='granted';await push.enablePushDevice('A',config);subscription.expirationTime=Date.now()-1;assert.equal((await push.inspectPushDevice('A')).registered,false);assert.equal(subscription,null);});
await run('permission revocation is reconciled',async()=>{await push.enablePushDevice('A',config);permission='denied';assert.equal((await push.inspectPushDevice('A')).registered,false);permission='granted';});
await run('offline revoke keeps token-free tombstone and removes local subscription',async()=>{await push.enablePushDevice('A',config);failRpc=true;await assert.rejects(push.disablePushDevice('A'));assert.equal(subscription,null);assert(!values.has('tenops.push.device.v1'));assert(JSON.parse(values.get('tenops.push.revocations.v1')).length);failRpc=false;await push.disablePushDevice('A');assert.equal(JSON.parse(values.get('tenops.push.revocations.v1')).length,0);});
await run('unsubscribe failure still revokes server and allows retry',async()=>{await push.enablePushDevice('A',config);const id=JSON.parse(values.get('tenops.push.device.v1')).id;failUnsubscribe=true;await assert.rejects(push.disablePushDevice('A'));assert.equal(rows.get(id).enabled,false);failUnsubscribe=false;await push.disablePushDevice('A');assert.equal(subscription,null);});
await run('logout is not held by an unanswered permission prompt',async()=>{permission='default';let answer;Notification.requestPermission=()=>new Promise(r=>answer=r);const work=push.enablePushDevice('A',config);await push.releasePushDevice();answer('granted');await assert.rejects(work,/account changed/);permission='granted';push.setPushAccount('A');await flush();});
await run('late registration after account change cannot attach to new owner',async()=>{let finish;registrationHold=new Promise(r=>finish=r);const before=registerCalls;const work=push.enablePushDevice('A',config);while(registerCalls===before)await flush();actor='B';push.setPushAccount('B');finish();await assert.rejects(work,/account changed/);registrationHold=null;await flush();assert(!values.has('tenops.push.device.v1'));assert.equal(subscription,null);assert(JSON.parse(values.get('tenops.push.revocations.v1')).some(row=>row.owner==='A'));});
await run('new account has an independent fresh registration',async()=>{await push.enablePushDevice('B',config);assert.equal((await push.inspectPushDevice('B')).registered,true);assert.equal((await push.inspectPushDevice('A')).registered,false);});
await run('previous account retry drains only its own revocations',async()=>{await push.releasePushDevice();actor='A';push.setPushAccount('A');await flush();assert.equal(JSON.parse(values.get('tenops.push.revocations.v1')).length,0);assert(revokeCalls>0);});
await run('unsupported and uninstalled iPhone states are explicit',async()=>{navigator.userAgent='iPhone';assert.equal(push.deviceSupport().needsInstall,true);await assert.rejects(push.enablePushDevice('A',config),/Home Screen/);navigator.userAgent='Desktop';window.isSecureContext=false;assert.equal(push.deviceSupport().supported,false);window.isSecureContext=true;});
await run('worker and migration have no delivery path or public subscription grants',async()=>{
 const worker=readFileSync('public/sw.js','utf8');assert(!/addEventListener\(['"](?:push|fetch|notificationclick)/.test(worker));assert(!/showNotification|caches\./.test(worker));
 const sql=readFileSync('supabase/migrations/20261020200000_web_push_device_registration.sql','utf8');
 for(const match of ['enable row level security','user_id=auth.uid()','generation=generation+1','existing.user_id<>auth.uid()','registration_enabled boolean not null default false','unique(environment,endpoint_hash)'])assert(sql.includes(match),match);
 assert(!/grant (?:all|select).*web_push_subscriptions/i.test(sql));assert(!/net.http|cron.schedule|create trigger|insert into public.web_push_environments/i.test(sql));
});
mkdirSync('docs/project-memory/evidence/web-push-stage-a',{recursive:true});
writeFileSync('docs/project-memory/evidence/web-push-stage-a/controller.json',JSON.stringify({checks,databaseExecution:'Not performed: migration application is not authorized',realPushRequests:0},null,2));
await supabase.auth.stopAutoRefresh();
