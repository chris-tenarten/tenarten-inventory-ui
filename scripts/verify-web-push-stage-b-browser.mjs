import assert from 'node:assert/strict';import{mkdirSync,writeFileSync}from'node:fs';import{chromium,expect}from'@playwright/test';import{session,userId,otherUserId}from'./support/wave4-fixture.mjs';
const origin='http://localhost:3000',folder=process.env.WEB_PUSH_EVIDENCE_DIR||'docs/project-memory/evidence/web-push-stage-b';mkdirSync(folder,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const checks=[],errors=[],external=[];
async function fixture(){const context=await browser.newContext({viewport:{width:1365,height:1000},reducedMotion:'reduce'});await context.addInitScript(({s,id})=>{if(!sessionStorage.getItem('review.auth.seeded')){localStorage.setItem('sb-localhost-auth-token',JSON.stringify(s));sessionStorage.setItem('review.auth.seeded','true');}sessionStorage.setItem('tenops.welcomeHeroPlayed:'+id,'true');},{s:session(),id:userId});await context.routeWebSocket('**/realtime/v1/**',()=>{});await context.route('**/*',r=>{if(new URL(r.request().url()).origin!==origin){external.push(r.request().url());return r.abort();}return r.continue();});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/settings');await expect(page.getByRole('heading',{name:'Device notifications'})).toBeVisible();return{page,context};}
async function run(name,work){if(process.env.WEB_PUSH_BROWSER_CHECK&&!new RegExp(process.env.WEB_PUSH_BROWSER_CHECK).test(name))return;const f=await fixture();try{await work(f);checks.push(name);console.log('PASS '+name);}finally{await f.context.close();}}
const enable=async f=>{await f.page.getByRole('button',{name:'Enable notifications on this device',exact:true}).click();await expect(f.page.getByText('Registered on this device',{exact:true})).toBeVisible();};
const simulate=async(f,kind)=>{await f.page.locator('#push-demo-controls').evaluate(el=>el.open=true);const previous=await f.page.evaluate(()=>window.lastPushPreview?.id);await f.page.getByRole('button',{name:kind==='dm'?'Simulate Direct Message':'Simulate Job mention',exact:true}).click();await expect.poll(()=>f.page.evaluate(()=>window.lastPushPreview?.id)).not.toBe(previous);return f.page.evaluate(()=>window.lastPushPreview);};
try{
 await run('server preference defaults on, informative DM and generic preview off',async f=>{
  await enable(f);const checkbox=f.page.getByRole('checkbox',{name:'Show message previews in notifications'});await expect(checkbox).toBeChecked();
  await simulate(f,'dm');await expect(f.page.locator('[data-simulated-banner]')).toContainText('Alex Operator · Direct Message');await expect(f.page.locator('[data-simulated-banner]')).toContainText('revised color plate');
  await f.page.screenshot({path:folder+'/dm-preview.png'});await checkbox.uncheck();await expect(checkbox).not.toBeChecked();await expect(checkbox).toBeEnabled();await simulate(f,'dm');await expect(f.page.locator('[data-simulated-banner]')).toContainText('New TenOps message');assert(!await f.page.locator('[data-simulated-banner]').innerText().then(t=>t.includes('color plate')));
 });
 await run('warm notification tap opens actual Messaging without decorative replay',async f=>{
  await enable(f);await simulate(f,'dm');await f.page.evaluate(()=>window.keptPushShell=document.querySelector('[data-app-shell]'));
  await f.page.locator('[data-simulated-banner]').click();await expect(f.page.getByRole('dialog',{name:'Inbox',exact:true})).toBeVisible();assert.equal(await f.page.locator('div[data-welcome-hero]').count(),0);assert(await f.page.evaluate(()=>window.keptPushShell===document.querySelector('[data-app-shell]')));
 });
 await run('mention preview and tap reuse actual Job Update Inspector',async f=>{
  await enable(f);await simulate(f,'mention');await expect(f.page.locator('[data-simulated-banner]')).toContainText('Mentioned by Blair Lead');await f.page.screenshot({path:folder+'/mention-preview.png'});
  await f.page.locator('[data-simulated-banner]').click();await expect(f.page.getByText('Please verify material readiness before production.',{exact:true}).last()).toBeVisible();assert.equal(await f.page.locator('div[data-welcome-hero]').count(),0);
 });
 await run('cold notification launch bypasses decoration after profile checks',async f=>{
  const preview=await simulate(f,'dm');await f.page.evaluate(id=>sessionStorage.removeItem('tenops.welcomeHeroPlayed:'+id),userId);
  let profiles=0;await f.context.route('**/rpc/get_my_app_access',async route=>{profiles++;await route.continue();});
  await f.page.goto(origin+'/?pushNotificationId='+preview.id);await expect(f.page.getByRole('dialog',{name:'Inbox',exact:true})).toBeVisible();assert(profiles>0);assert.equal(await f.page.locator('div[data-welcome-hero]').count(),0);
 });
 for(const failure of ['unavailable','network','timeout'])await run('cold DM recovers '+failure+' lookup without manual Retry',async f=>{
  const preview=await simulate(f,'dm');let attempts=0;
  await f.context.route('**/rpc/resolve_my_push_notification',async route=>{
   attempts++;assert.match(route.request().headers().authorization||'',/^Bearer /);
   if(attempts===1){
    if(failure==='network')return route.abort('failed');
    if(failure==='timeout'){await new Promise(r=>setTimeout(r,5500));return route.abort().catch(()=>{});}
    return route.fulfill({status:503,json:{message:'Temporary unavailable'}});
   }
   return route.continue();
  });
  await f.page.goto(origin+'/?pushNotificationId='+preview.id);
  await expect(f.page.getByRole('dialog',{name:'Inbox',exact:true})).toBeVisible({timeout:15000});assert.equal(attempts,2);await expect(f.page.getByRole('dialog',{name:'Inbox',exact:true})).toContainText('Can you check the revised color plate before tomorrow?');
  await expect(f.page.getByRole('button',{name:'Retry',exact:true})).toHaveCount(0);assert.equal(await f.page.locator('div[data-welcome-hero]').count(),0);
 });
 await run('cold mention launch preserves authorized Job Update destination',async f=>{
  const preview=await simulate(f,'mention');await f.page.goto(origin+'/?pushNotificationId='+preview.id);
  await expect(f.page.getByText('Please verify material readiness before production.',{exact:true}).last()).toBeVisible();assert.equal(await f.page.locator('div[data-welcome-hero]').count(),0);
 });
 for(const status of [401,403,503])await run('lookup '+status+' remains bounded and never opens unauthorized Messaging',async f=>{
  const preview=await simulate(f,'dm');let attempts=0;
  await f.context.route('**/rpc/resolve_my_push_notification',route=>{attempts++;return route.fulfill({status,json:{message:'Denied or unavailable'}});});
  await f.page.goto(origin+'/?pushNotificationId='+preview.id);await expect(f.page.getByRole('button',{name:'Retry',exact:true})).toBeVisible();assert.equal(attempts,status>=500?2:1);assert.equal(await f.page.getByRole('dialog',{name:'Inbox',exact:true}).count(),0);
 });
 await run('account switch during transient lookup cancels old-account navigation',async f=>{
  const preview=await simulate(f,'dm');let attempts=0,started;
  const ready=new Promise(resolve=>{started=resolve;});let release;
  const paused=new Promise(resolve=>{release=resolve;});
  await f.context.route('**/rpc/resolve_my_push_notification',async route=>{
   attempts++;if(attempts===1){started();await paused;return route.fulfill({status:503,json:{message:'Temporary unavailable'}}).catch(()=>{});}return route.continue();
  });
  await f.page.goto(origin+'/?pushNotificationId='+preview.id);await ready;
  await f.page.evaluate(s=>{localStorage.setItem('sb-localhost-auth-token',JSON.stringify(s));const c=new BroadcastChannel('sb-localhost-auth-token');c.postMessage({event:'SIGNED_IN',session:s});c.close();},session(otherUserId));
  await expect(f.page.getByRole('button',{name:/Account menu for Review B/})).toBeVisible();release();
  await expect(f.page.getByText(/unavailable for this account/)).toBeVisible();assert.equal(attempts,2);assert.equal(await f.page.getByRole('dialog',{name:'Inbox',exact:true}).count(),0);
 });
 await run('wrong account cannot resolve prior-account destination',async f=>{
  const preview=await simulate(f,'dm');await f.page.evaluate(s=>{localStorage.setItem('sb-localhost-auth-token',JSON.stringify(s));const c=new BroadcastChannel('sb-localhost-auth-token');c.postMessage({event:'SIGNED_IN',session:s});c.close();},session(otherUserId));
  await expect(f.page.getByText('Review B',{exact:true}).first()).toBeVisible();await f.page.goto(origin+'/?pushNotificationId='+preview.id);await expect(f.page.getByText(/unavailable for this account/)).toBeVisible();assert.equal(await f.page.getByRole('dialog',{name:'Inbox',exact:true}).count(),0);
 });
 await run('expired session signs in before resolving notification without animation',async f=>{
  const preview=await simulate(f,'dm');await f.page.evaluate(()=>localStorage.setItem('sb-localhost-auth-token','null'));
  await f.context.route('**/auth/v1/token**',route=>route.fulfill({json:session()}));
  await f.page.goto(origin+'/?pushNotificationId='+preview.id);await f.page.getByLabel('Email',{exact:true}).fill('synthetic@example.invalid');await f.page.getByLabel('Password',{exact:true}).fill('synthetic-only');
  await f.page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(f.page.getByRole('dialog',{name:'Inbox',exact:true})).toBeVisible();assert.equal(await f.page.locator('div[data-welcome-hero]').count(),0);
 });
 await run('unavailable content uses neutral state and never opens Messaging',async f=>{
  await f.page.goto(origin+'/?pushNotificationId=00000000-0000-4000-8000-999999999999');await expect(f.page.getByText(/unavailable for this account/)).toBeVisible();assert.equal(await f.page.getByRole('dialog',{name:'Inbox',exact:true}).count(),0);
 });
 await run('push-owned DM and mention do not create intrusive in-app arrival attention',async f=>{
  await enable(f);await simulate(f,'dm');await simulate(f,'mention');await f.page.waitForTimeout(300);assert.equal(await f.page.locator('[data-arrival-attention]:not([data-arrival-attention=""])').count(),0);assert.equal(await f.page.locator('[data-notification-arrival-guidance]').count(),0);
  await f.page.getByRole('button',{name:'Disable on this device',exact:true}).click();await simulate(f,'dm');await expect(f.page.locator('[data-notification-arrival-guidance]')).toBeVisible();
 });
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);writeFileSync(folder+'/browser.json',JSON.stringify({checks,pageErrors:errors,external,simulatedBanners:true,realDevicePushes:0},null,2));
}finally{await browser.close();}
