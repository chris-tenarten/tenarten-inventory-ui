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
  rows.set(args.p_id,{owner,generation:1,enabled:true,endpoint_hash:Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(args.p_subscription.endpoint))).toString('hex'),environment:config.environment,key_version:config.key_version});return{data:{id:args.p_id,generation:1}};
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
await run('temporary verification failure preserves opt-in and same-owner recovery',async()=>{
 const before=values.get('tenops.push.device.v1'),id=JSON.parse(before).id,local=subscription,revokes=revokeCalls;
 push.suspendPushAccount();await flush();assert.equal(values.get('tenops.push.device.v1'),before);assert.equal(subscription,local);assert.equal(rows.get(id).enabled,true);assert.equal(revokeCalls,revokes);
 await assert.rejects(push.enablePushDevice('A',config),/Verify your account/);
 push.setPushAccount('A');await flush();assert.equal((await push.inspectPushDevice('A')).registered,true);assert.equal(values.get('tenops.push.device.v1'),before);assert.equal(revokeCalls,revokes);
});
await run('stalled browser subscription lookup times out without clearing registration',async()=>{
 const before=values.get('tenops.push.device.v1'),local=subscription,get=registration.pushManager.getSubscription,timer=window.setTimeout;let deadline;
 registration.pushManager.getSubscription=()=>new Promise(()=>{});window.setTimeout=(callback,ms)=>{deadline=ms;return timer(callback,5);};
 try{const status=await push.inspectPushDevice('A');assert(status.error.includes('timed out'));assert.equal(deadline,4500);assert.equal(subscription,local);assert.equal(values.get('tenops.push.device.v1'),before);}finally{registration.pushManager.getSubscription=get;window.setTimeout=timer;}
});
await run('missing or revoked server status is not registered and does not mutate browser binding',async()=>{
 const before=values.get('tenops.push.device.v1'),id=JSON.parse(before).id,row={...rows.get(id)},local=subscription;
 rows.delete(id);assert.equal((await push.inspectPushDevice('A')).registered,false);rows.set(id,{...row,enabled:false,generation:2});assert.equal((await push.inspectPushDevice('A')).registered,false);assert.equal(subscription,local);assert.equal(values.get('tenops.push.device.v1'),before);rows.set(id,row);assert.equal((await push.inspectPushDevice('A')).registered,true);
});
await run('existing matching endpoint stays registered when the enrollment key version changes',async()=>{
 const original=config.key_version;config.key_version='future-version';try{assert.equal((await push.inspectPushDevice('A')).registered,true);}finally{config.key_version=original;}
});
await run('endpoint mismatch and status failure are unverified without revoking healthy opt-in',async()=>{
 const binding=values.get('tenops.push.device.v1'),id=JSON.parse(binding).id,original=subscription;
 subscription=freshSubscription();const mismatch=await push.inspectPushDevice('A');assert.equal(mismatch.registered,false);assert.match(mismatch.error,/Unable to verify/);assert.equal(rows.get(id).enabled,true);assert.equal(values.get('tenops.push.device.v1'),binding);
 subscription=original;failRpc=true;const offline=await push.inspectPushDevice('A');assert(offline.error);assert.equal(rows.get(id).enabled,true);assert.equal(subscription,original);failRpc=false;assert.equal((await push.inspectPushDevice('A')).registered,true);
});
await run('account change after suspension never carries old binding to new account',async()=>{
 push.suspendPushAccount();actor='B';push.setPushAccount('B');await flush();assert.equal(subscription,null);assert(!values.has('tenops.push.device.v1'));assert.equal((await push.inspectPushDevice('B')).registered,false);
 actor='A';push.setPushAccount('A');await flush();await push.enablePushDevice('A',config);
});
await run('real sign-out still revokes after temporary suspension',async()=>{
 const id=JSON.parse(values.get('tenops.push.device.v1')).id;push.suspendPushAccount();await push.releasePushDevice();assert.equal(subscription,null);assert(!values.has('tenops.push.device.v1'));
 assert.equal(rows.get(id).enabled,false);push.setPushAccount('A');await flush();await push.enablePushDevice('A',config);
});
await run('confirmed account denial revokes the suspended owner binding',async()=>{
 const id=JSON.parse(values.get('tenops.push.device.v1')).id;push.suspendPushAccount();push.setPushAccount(null);await flush();assert.equal(rows.get(id).enabled,false);assert.equal(subscription,null);push.setPushAccount('A');await flush();await push.enablePushDevice('A',config);
});
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
await run('worker and Stage A migration preserve cache/privacy boundaries',async()=>{
 const worker=readFileSync('public/sw.js','utf8');assert(!/addEventListener\(['"]fetch/.test(worker));assert(!/caches\./.test(worker));
 const sql=readFileSync('supabase/migrations/20261020200000_web_push_device_registration.sql','utf8');
 for(const match of ['enable row level security','user_id=auth.uid()','generation=generation+1','existing.user_id<>auth.uid()','registration_enabled boolean not null default false','unique(environment,endpoint_hash)'])assert(sql.includes(match),match);
 assert(!/grant (?:all|select).*web_push_subscriptions/i.test(sql));assert(!/net.http|cron.schedule|create trigger|insert into public.web_push_environments/i.test(sql));
});
const evidence=process.env.WEB_PUSH_EVIDENCE||'docs/project-memory/evidence/web-push-stage-a';
mkdirSync(evidence,{recursive:true});
writeFileSync(evidence+'/controller.json',JSON.stringify({checks,databaseExecution:'Controller simulation only; see separate database execution evidence',realPushRequests:0},null,2));
await supabase.auth.stopAutoRefresh();
