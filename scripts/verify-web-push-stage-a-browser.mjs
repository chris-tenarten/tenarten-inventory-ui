// Actual Settings and AuthProvider, real root service worker, synthetic browser subscription API.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
import {session,userId,otherUserId} from './support/wave4-fixture.mjs';
const origin='http://localhost:3000',evidence=process.env.WEB_PUSH_EVIDENCE||'docs/project-memory/evidence/web-push-stage-a';
mkdirSync(evidence,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const checks=[],errors=[],external=[];
async function fixture({mobile=false,denied=false}={}){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1365,height:1000},hasTouch:mobile,isMobile:mobile,userAgent:mobile?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 Version/18.4 Mobile/15E148 Safari/604.1':undefined,reducedMotion:'reduce'});
 await context.addInitScript(({s,userId,denied})=>{localStorage.setItem('sb-localhost-auth-token',JSON.stringify(s));sessionStorage.setItem('tenops.welcomeHeroPlayed:'+userId,'1');if(denied)localStorage.setItem('review.push.answer','denied');},{s:session(),userId,denied});
 await context.routeWebSocket('**/realtime/v1/**',()=>{});
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==origin){external.push(u.origin);return route.abort();}return route.continue();});
 await context.request.post(origin+'/__review/control',{data:{}});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin+'/settings');await expect(page.getByRole('heading',{name:'Device notifications'})).toBeVisible();
 const section=page.locator('#notifications');await expect(section.getByText('Not registered on this device',{exact:true})).toBeVisible();
 return{context,page,section};
}
const enable=f=>f.section.getByRole('button',{name:'Enable notifications on this device',exact:true});
const disable=f=>f.section.getByRole('button',{name:'Disable on this device',exact:true});
const registered=f=>f.section.getByText('Registered on this device',{exact:true});
const emit=async(f,event,s)=>f.page.evaluate(({event,s})=>{if(s)localStorage.setItem('sb-localhost-auth-token',JSON.stringify(s));else localStorage.removeItem('sb-localhost-auth-token');const c=new BroadcastChannel('sb-localhost-auth-token');c.postMessage({event,session:s});c.close();},{event,s});
async function run(name,work,options){const f=await fixture(options);try{await work(f);checks.push(name);console.log('PASS '+name);}finally{await f.context.close();}}
try{
 await run('desktop explicit enable, real root worker, disable and no caching',async f=>{
  await expect(enable(f)).toBeEnabled();assert.equal(await f.page.evaluate(()=>window.__pushReview.requests),0);
  await enable(f).click();await expect(registered(f)).toBeVisible();
  assert.equal(await f.page.evaluate(()=>window.__pushReview.requests),1);
  const scope=await f.page.evaluate(async()=>{const r=await navigator.serviceWorker.ready;return r.scope;});assert.equal(scope,origin+'/');
  assert.deepEqual(await f.page.evaluate(()=>caches.keys()),[]);
  await f.section.screenshot({path:evidence+'/desktop-settings.png'});
  await disable(f).click();await expect(f.section.getByText('Not registered on this device',{exact:true})).toBeVisible();
 });
 await run('denied permission and recovery without repeated prompts',async f=>{
  await enable(f).click();await expect(f.section.getByText('Blocked',{exact:true})).toBeVisible();await expect(enable(f)).toBeDisabled();
  assert.equal(await f.page.evaluate(()=>window.__pushReview.requests),1);
  await f.section.getByRole('button',{name:'Check again'}).click();assert.equal(await f.page.evaluate(()=>window.__pushReview.requests),1);
 },{denied:true});
 await run('registration failure cleans browser subscription and retry succeeds',async f=>{
  await f.context.request.post(origin+'/__review/control',{data:{pushFailure:true}});
  await enable(f).click();await expect(f.section.getByText(/could not be updated/).first()).toBeVisible();
  assert.equal(await f.page.evaluate(()=>localStorage.getItem('review.push.endpoint')),null);
  await f.context.request.post(origin+'/__review/control',{data:{}});await f.section.getByRole('button',{name:'Check again'}).click();await expect(enable(f)).toBeEnabled();await enable(f).click();await expect(registered(f)).toBeVisible();
 });
 await run('offline disable preserves cleanup and successful retry drains it',async f=>{
  await enable(f).click();await expect(registered(f)).toBeVisible();await f.context.request.post(origin+'/__review/control',{data:{pushFailure:true}});
  await disable(f).click();await expect(f.section.getByText(/could not be updated/).first()).toBeVisible();
  assert.equal(await f.page.evaluate(()=>localStorage.getItem('review.push.endpoint')),null);
  assert((await f.page.evaluate(()=>JSON.parse(localStorage.getItem('tenops.push.revocations.v1')))).length>0);
  await f.context.request.post(origin+'/__review/control',{data:{}});await disable(f).click();await expect(f.section.getByText('Notifications are disabled on this device.',{exact:true})).toBeVisible();
  assert.equal((await f.page.evaluate(()=>JSON.parse(localStorage.getItem('tenops.push.revocations.v1')))).length,0);
 });
 await run('reload and continuing token refresh preserve binding and startup',async f=>{
  await enable(f).click();await expect(registered(f)).toBeVisible();const binding=await f.page.evaluate(()=>localStorage.getItem('tenops.push.device.v1'));
  await f.page.reload();await expect(registered(f)).toBeVisible();await f.page.evaluate(()=>window.keptShell=document.querySelector('[data-app-shell]'));
  await emit(f,'TOKEN_REFRESHED',session(userId,2));await f.page.waitForTimeout(500);
  await expect(registered(f)).toBeVisible();assert.equal(await f.page.evaluate(()=>localStorage.getItem('tenops.push.device.v1')),binding);
  assert(await f.page.evaluate(()=>window.keptShell===document.querySelector('[data-app-shell]')));assert.equal(await f.page.locator('div[data-welcome-hero]').count(),0);
 });
 await run('explicit sign-out removes registration without permission prompt',async f=>{
  await enable(f).click();await expect(registered(f)).toBeVisible();await f.page.getByRole('button',{name:'Sign out of account',exact:true}).click();
  await expect(f.page.getByLabel('Email',{exact:true})).toBeVisible();assert.equal(await f.page.evaluate(()=>localStorage.getItem('tenops.push.device.v1')),null);assert.equal(await f.page.evaluate(()=>localStorage.getItem('review.push.endpoint')),null);
 });
 await run('account switching clears former binding and shows independent device state',async f=>{
  await enable(f).click();await expect(registered(f)).toBeVisible();await emit(f,'SIGNED_IN',session(otherUserId));
  await expect(f.page.getByText('Review B',{exact:true}).first()).toBeVisible();await expect(f.section.getByText('Not registered on this device',{exact:true})).toBeVisible();
  assert.equal(await f.page.evaluate(()=>localStorage.getItem('tenops.push.device.v1')),null);await expect(enable(f)).toBeEnabled();await enable(f).click();await expect(registered(f)).toBeVisible();
  assert.equal(await f.page.evaluate(()=>JSON.parse(localStorage.getItem('tenops.push.device.v1')).owner),otherUserId);
 });
 await run('lost session unsubscribes locally',async f=>{
  await enable(f).click();await expect(registered(f)).toBeVisible();await emit(f,'SIGNED_OUT',null);await expect(f.page.getByLabel('Email',{exact:true})).toBeVisible();
  await expect.poll(()=>f.page.evaluate(()=>localStorage.getItem('review.push.endpoint'))).toBe(null);
 });
 await run('profile revocation removes device access and browser subscription',async f=>{
  await enable(f).click();await expect(registered(f)).toBeVisible();
  await f.context.route('**/rest/v1/rpc/get_my_app_access',route=>route.fulfill({json:[{user_id:userId,display_name:'Disabled review',role:'admin',is_active:false}]}));
  await emit(f,'TOKEN_REFRESHED',session(userId,3));await expect(f.page.getByText(/This account is disabled/)).toBeVisible();
  await expect.poll(()=>f.page.evaluate(()=>localStorage.getItem('review.push.endpoint'))).toBe(null);
 });
 await run('password recovery sign-out clears device binding',async f=>{
  await enable(f).click();await expect(registered(f)).toBeVisible();await emit(f,'PASSWORD_RECOVERY',session(userId,4));
  await f.page.getByLabel('New password',{exact:true}).fill('Synthetic-only-password');await f.page.getByLabel('Confirm new password',{exact:true}).fill('Synthetic-only-password');
  await f.page.getByRole('button',{name:'Set password',exact:true}).click();await expect(f.page.getByLabel('Email',{exact:true})).toBeVisible();
  assert.equal(await f.page.evaluate(()=>localStorage.getItem('tenops.push.device.v1')),null);assert.equal(await f.page.evaluate(()=>localStorage.getItem('review.push.endpoint')),null);
 });
 await run('delayed registration across account switch never registers the new account',async f=>{
  await f.context.request.post(origin+'/__review/control',{data:{pushDelay:800}});
  const request=f.page.waitForRequest(r=>r.url().endsWith('/rpc/register_my_web_push_subscription'));await enable(f).click();await request;
  await emit(f,'SIGNED_IN',session(otherUserId));await expect(f.page.getByText('Review B',{exact:true}).first()).toBeVisible();
  await f.page.waitForTimeout(1000);assert.equal(await f.page.evaluate(()=>localStorage.getItem('tenops.push.device.v1')),null);assert.equal(await f.page.evaluate(()=>localStorage.getItem('review.push.endpoint')),null);
 });
 await run('safe localhost Sample library creation remains functional',async f=>{
  await f.page.goto(origin+'/samples');await expect(f.page.getByRole('button').filter({hasText:'Disposable Sample — Post to Job'})).toBeVisible();
  await f.page.getByRole('button',{name:'New Sample',exact:true}).click();
  await f.page.getByRole('combobox',{name:'Resin System',exact:true}).selectOption({index:1});
  await f.page.getByRole('button',{name:'Save Sample',exact:true}).click();await expect(f.page.getByRole('button',{name:'Save Changes',exact:true})).toBeVisible();
 });
 await run('unconfigured environment remains disabled and does not prompt',async f=>{
  await f.context.request.post(origin+'/__review/control',{data:{pushUnconfigured:true}});await f.section.getByRole('button',{name:'Check again'}).click();await expect(enable(f)).toBeDisabled();await expect(f.section.getByText(/not available in this environment/)).toBeVisible();
 });
 await run('mobile Safari installation guidance and navigation fit',async f=>{
  await expect(f.section.getByText('Home Screen installation needed',{exact:true})).toBeVisible();await expect(enable(f)).toBeDisabled();
  assert(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await f.section.scrollIntoViewIfNeeded();await f.page.screenshot({path:evidence+'/mobile-settings.png'});
  await expect(f.page.getByRole('button',{name:'Messaging',exact:true})).toBeVisible();
 },{mobile:true});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 writeFileSync(evidence+'/browser.json',JSON.stringify({checks,pageErrors:errors,externalRequests:external,permissionAndSubscriptions:'Simulated only; real root service worker',realDevicePushes:0},null,2));
}finally{await browser.close();}
