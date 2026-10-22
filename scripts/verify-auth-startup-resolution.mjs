/** Actual app/provider/browser, local intercepted transport only; no hosted accounts or writes. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium,expect} from '@playwright/test';
const origin=process.env.AUTH_REVIEW_ORIGIN||'http://localhost:3000';
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const A='00000000-0000-0000-0000-0000000000a1',B='00000000-0000-0000-0000-0000000000b2';
function session(id=A,version=1,loginIdentity=false){const user={id,aud:'authenticated',role:'authenticated',email:`review-${id.slice(-2)}@example.invalid`,app_metadata:{},user_metadata:{},created_at:'2026-10-16T00:00:00Z'};const token=Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp:4102444800,version,...(loginIdentity?{session_id:'00000000-0000-4000-8000-000000000099'}:{})})).toString('base64url')+'.local-only';return{access_token:token,refresh_token:'local-only',expires_at:4102444800,expires_in:3600,token_type:'bearer',user};}
const profile=(id=A,active=true)=>[{user_id:id,display_name:id===A?'Review A':'Review B',role:'admin',is_active:active,read_only:false,messaging_write:true,production_blend_manage:false,sample_labels_generate:false}];
const browser=await chromium.launch({headless:true}),checks=[],external=[],pageErrors=[];
async function fixture({settings=false,loginIdentity=false,accessFailure=false}={}){
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),pending=[],statusRequests=[];
 const status={enabled:true,generation:1,delivery_enabled:true,show_previews:true,environment:'prod',key_version:'v1',endpoint_hash:createHash('sha256').update('https://web.push.apple.com/browser-review').digest('hex')};let statusFailure=false,holdStatus=settings;
 await context.addInitScript(({seed,A,B})=>{
  if(!localStorage.getItem('sb-127-auth-token'))localStorage.setItem('sb-127-auth-token',JSON.stringify(seed));
  for(const id of [A,B])sessionStorage.setItem('tenops.welcomeHeroPlayed:'+id,'true');
  localStorage.setItem('tenops.push.device.v1',JSON.stringify({id:'00000000-0000-4000-8000-000000000030',owner:A,generation:1}));
  window.pushProbe={unsubscribes:0,revokes:0};
  const registration={getNotifications:async()=>[],pushManager:{getSubscription:async()=>({endpoint:'https://web.push.apple.com/browser-review',expirationTime:null,unsubscribe:async()=>{window.pushProbe.unsubscribes++;return true;}})}};
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{addEventListener(){},removeEventListener(){},getRegistration:async()=>registration,register:async()=>registration,ready:Promise.resolve(registration)}});
  Object.defineProperty(Notification,'permission',{configurable:true,get:()=> 'granted'});
  window.denialTrace=[];new MutationObserver(()=>{if(document.body?.innerText.includes('This account is disabled'))window.denialTrace.push(performance.now());}).observe(document,{childList:true,subtree:true,characterData:true});
 },{seed:session(A,1,loginIdentity),A,B});
 await context.route('**/*',async route=>{
  const r=route.request(),u=new URL(r.url());
  if(u.origin===origin)return route.continue();
  if(u.origin!=='http://127.0.0.1:55592'){external.push(u.origin);return route.abort();}
  if(u.pathname==='/rest/v1/rpc/get_my_app_access')return new Promise(resolve=>pending.push({reply:async(data,status=200)=>{const response=page.waitForResponse(response=>response.request()===r);await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});await response;await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));resolve();}}));
  if(u.pathname==='/rest/v1/rpc/can_view_my_web_push_settings')return accessFailure?route.fulfill({status:503,json:{message:'Temporary verification failure'}}):route.fulfill({json:true});
  if(u.pathname==='/rest/v1/rpc/get_my_web_push_configuration')return route.fulfill({json:{environment:'prod',key_version:'v1',public_key:'BA'+'A'.repeat(85)}});
  if(u.pathname==='/rest/v1/rpc/get_my_web_push_subscription'){
   if(holdStatus)await new Promise(resolve=>statusRequests.push(resolve));
   return statusFailure?route.fulfill({status:503,json:{message:'Temporary status unavailable'}}):route.fulfill({json:status});
  }
  if(u.pathname==='/rest/v1/rpc/revoke_my_web_push_subscription'){await page.evaluate(()=>window.pushProbe.revokes++);return route.fulfill({json:true});}
  if(u.pathname==='/rest/v1/rpc/get_my_account_preferences')return route.fulfill({status:200,contentType:'application/json',body:'{}'});
  if(u.pathname==='/rest/v1/rpc/ensure_my_welcome_notification')return route.fulfill({status:403,contentType:'application/json',body:'{"message":"No diagnostic writes"}'});
  return route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'0-0/0'},body:'[]'});
 });
 const page=await context.newPage();page.on('pageerror',e=>pageErrors.push(e.message));await page.goto(origin+(settings?'/settings':'/my-work'));
 async function request(index){await expect.poll(()=>pending.length,{timeout:15000}).toBeGreaterThan(index);return pending[index];}
 async function waiting(){await expect(page.getByText('Restoring your TenOps session…',{exact:true})).toBeVisible();assert.equal(await page.getByRole('button',{name:'Messaging',exact:true}).count(),0);assert.equal(await page.getByText(/This account is disabled/).count(),0);}
 async function allowed(){await expect(page.getByRole('button',{name:'Messaging',exact:true})).toBeVisible();assert.equal(await page.getByText(/This account is disabled/).count(),0);}
 async function denied(){await expect(page.getByText('This account is disabled or does not have access to this TenOps environment.',{exact:true})).toBeVisible();assert.equal(await page.getByRole('button',{name:'Messaging',exact:true}).count(),0);}
 async function failed(){await expect(page.getByRole('alert').filter({hasText:'Unable to verify your TenOps account access.'})).toBeVisible();assert.equal(await page.getByText(/This account is disabled/).count(),0);assert.equal(await page.getByRole('button',{name:'Messaging',exact:true}).count(),0);}
 async function event(name,next){await page.evaluate(({name,next})=>{if(next)localStorage.setItem('sb-127-auth-token',JSON.stringify(next));else localStorage.removeItem('sb-127-auth-token');const channel=new BroadcastChannel('sb-127-auth-token');channel.postMessage({event:name,session:next});channel.close();},{name,next});}
 return {context,page,request,waiting,allowed,denied,failed,event,status,setAccessFailure:value=>{accessFailure=value;},setStatusFailure:value=>{statusFailure=value;},releaseStatus:()=>{holdStatus=false;for(const resolve of statusRequests.splice(0))resolve();}};
}
async function run(name,test,options){if(process.env.AUTH_REVIEW_CHECK&&!new RegExp(process.env.AUTH_REVIEW_CHECK).test(name))return;const f=await fixture(options);try{await test(f);checks.push(name);console.log('PASS '+name);}catch(error){console.error(JSON.stringify({pageErrors,external,body:(await f.page.locator('body').innerText()).slice(0,400)}));throw error;}finally{await f.context.close();}}
try{
 await run('delayed active restoration, refresh and no false denial',async f=>{await f.request(0);await f.waiting();await (await f.request(0)).reply(profile());await f.allowed();assert.deepEqual(await f.page.evaluate(()=>window.denialTrace),[]);await f.page.reload();await f.request(1);await f.waiting();await (await f.request(1)).reply(profile());await f.allowed();assert.deepEqual(await f.page.evaluate(()=>window.denialTrace),[]);});
 await run('later TOKEN_REFRESHED event stays pending and then allowed',async f=>{await(await f.request(0)).reply(profile());await f.allowed();await f.event('TOKEN_REFRESHED',session(A,2));await f.request(1);await f.waiting();await(await f.request(1)).reply(profile());await f.allowed();assert.deepEqual(await f.page.evaluate(()=>window.denialTrace),[]);});
 await run('push binding survives profile failure and same-account recovery with access closed',async f=>{
  await(await f.request(0)).reply(profile());await f.allowed();const binding=await f.page.evaluate(()=>localStorage.getItem('tenops.push.device.v1'));
  await f.event('TOKEN_REFRESHED',session(A,2));await f.waiting();await(await f.request(1)).reply({message:'Temporary access service unavailable'},503);await f.failed();
  assert.equal(await f.page.evaluate(()=>localStorage.getItem('tenops.push.device.v1')),binding);assert.deepEqual(await f.page.evaluate(()=>window.pushProbe),{unsubscribes:0,revokes:0});
  await f.event('TOKEN_REFRESHED',session(A,3));await f.waiting();await(await f.request(2)).reply(profile());await f.allowed();assert.equal(await f.page.evaluate(()=>localStorage.getItem('tenops.push.device.v1')),binding);assert.deepEqual(await f.page.evaluate(()=>window.pushProbe),{unsubscribes:0,revokes:0});
 });
 await run('confirmed access denial still clears push binding',async f=>{await(await f.request(0)).reply(profile(A,false));await f.denied();await expect.poll(()=>f.page.evaluate(()=>localStorage.getItem('tenops.push.device.v1'))).toBeNull();assert((await f.page.evaluate(()=>window.pushProbe.unsubscribes))>0);await expect.poll(()=>f.page.evaluate(()=>window.pushProbe.revokes)).toBeGreaterThan(0);});
 await run('inactive account denied',async f=>{await(await f.request(0)).reply(profile(A,false));await f.denied();});
 await run('missing profile denied',async f=>{await(await f.request(0)).reply([]);await f.denied();});
 await run('profile request failure fails closed without disabled wording',async f=>{await(await f.request(0)).reply({message:'Synthetic verification failure'},400);await f.failed();});
 await run('identity change rejects old active result while next identity denied',async f=>{const old=await f.request(0);await f.event('SIGNED_IN',session(B));const next=await f.request(1);await f.waiting();await old.reply(profile());await f.waiting();await next.reply(profile(B,false));await f.denied();});
 await run('late old error cannot revoke newer allowed identity',async f=>{const old=await f.request(0);await f.event('SIGNED_IN',session(B));await(await f.request(1)).reply(profile(B));await f.allowed();await old.reply({message:'Old identity failed'},400);await f.allowed();});
 await run('same-user session change rejects old active response',async f=>{const old=await f.request(0);await f.event('TOKEN_REFRESHED',session(A,2));const next=await f.request(1);await old.reply(profile());await f.waiting();await next.reply({message:'New session verification failed'},400);await f.failed();});
 await run('sign-out rejects pending active result',async f=>{const old=await f.request(0);await f.event('SIGNED_OUT',null);await expect(f.page.getByLabel('Email',{exact:true})).toBeVisible();await old.reply(profile());await expect(f.page.getByLabel('Email',{exact:true})).toBeVisible();assert.equal(await f.page.getByRole('button',{name:'Messaging',exact:true}).count(),0);await expect.poll(()=>f.page.evaluate(()=>localStorage.getItem('tenops.push.device.v1'))).toBeNull();});
 await run('mismatched returned identity fails closed',async f=>{await(await f.request(0)).reply(profile(B));await f.failed();});
 await run('explicit sign-out revokes push before ending the authenticated session',async f=>{await(await f.request(0)).reply(profile());await f.allowed();await f.page.getByRole('button',{name:/Account menu for Review A/}).click();await f.page.getByRole('menuitem',{name:'Sign out',exact:true}).click();await expect(f.page.getByLabel('Email',{exact:true})).toBeVisible();assert.equal(await f.page.evaluate(()=>localStorage.getItem('tenops.push.device.v1')),null);assert((await f.page.evaluate(()=>window.pushProbe.revokes))>0);});
 await run('password recovery retains deliberate device cleanup',async f=>{await(await f.request(0)).reply(profile());await f.allowed();await f.event('PASSWORD_RECOVERY',session(A,2));await(await f.request(1)).reply(profile());await expect.poll(()=>f.page.evaluate(()=>localStorage.getItem('tenops.push.device.v1'))).toBeNull();assert((await f.page.evaluate(()=>window.pushProbe.revokes))>0);});
 await run('same-login token rotation failure blocks access and recovers without revocation',async f=>{
  await(await f.request(0)).reply(profile());await f.allowed();const before=await f.page.evaluate(()=>localStorage.getItem('tenops.push.device.v1'));
  await f.event('TOKEN_REFRESHED',session(A,2,true));await(await f.request(1)).reply({message:'Temporary verification failure'},503);await f.failed();assert.equal(await f.page.evaluate(()=>localStorage.getItem('tenops.push.device.v1')),before);
  await f.event('TOKEN_REFRESHED',session(A,3,true));await f.waiting();await(await f.request(2)).reply(profile());await f.allowed();assert.equal(await f.page.evaluate(()=>localStorage.getItem('tenops.push.device.v1')),before);assert.deepEqual(await f.page.evaluate(()=>window.pushProbe),{unsubscribes:0,revokes:0});
 },{loginIdentity:true});
 await run('Settings initial verification failure offers neutral retry without enrollment controls',async f=>{
  await(await f.request(0)).reply(profile());const section=f.page.locator('#notifications');await expect(section.getByText('Unable to verify registration',{exact:true})).toBeVisible();assert.equal(await section.getByRole('button',{name:'Enable notifications on this device',exact:true}).count(),0);assert.equal(await f.page.evaluate(()=>window.pushProbe.revokes),0);
  f.setAccessFailure(false);f.releaseStatus();await section.getByRole('button',{name:'Check again'}).click();await expect(section.getByText('Registered on this device',{exact:true})).toBeVisible();
 },{settings:true,accessFailure:true});
 await run('Settings checking, confirmed and unavailable states preserve a healthy registration',async f=>{
  await(await f.request(0)).reply(profile());const section=f.page.locator('#notifications');await expect(section.getByText('Checking this device…',{exact:true})).toBeVisible();f.releaseStatus();await expect(section.getByText('Registered on this device',{exact:true})).toBeVisible();
  f.setStatusFailure(true);await section.getByRole('button',{name:'Check again'}).click();await expect(section.getByText('Unable to verify registration',{exact:true})).toBeVisible();assert(await f.page.evaluate(()=>localStorage.getItem('tenops.push.device.v1')));assert.equal(await f.page.evaluate(()=>window.pushProbe.revokes),0);
  f.setStatusFailure(false);await section.getByRole('button',{name:'Check again'}).click();await expect(section.getByText('Registered on this device',{exact:true})).toBeVisible();
 },{settings:true});
 await run('Settings endpoint mismatch stays unverified; confirmed server revocation is not registered',async f=>{
  await(await f.request(0)).reply(profile());f.status.endpoint_hash='0'.repeat(64);f.releaseStatus();const section=f.page.locator('#notifications');await expect(section.getByText('Unable to verify registration',{exact:true})).toBeVisible();assert.equal(await f.page.evaluate(()=>window.pushProbe.revokes),0);
  f.status.enabled=false;f.status.generation=2;await section.getByRole('button',{name:'Check again'}).click();await expect(section.getByText('Not registered on this device',{exact:true})).toBeVisible();assert.equal(await f.page.evaluate(()=>window.pushProbe.revokes),0);
  await section.getByRole('button',{name:'Disable on this device'}).click();await expect.poll(()=>f.page.evaluate(()=>window.pushProbe.revokes)).toBeGreaterThan(0);
 },{settings:true});
 assert.deepEqual(external,[]);assert.deepEqual(pageErrors,[]);console.log(JSON.stringify({passed:checks.length,checks,pageErrors,externalRequests:external,hostedWrites:0},null,2));
}finally{await browser.close();}
