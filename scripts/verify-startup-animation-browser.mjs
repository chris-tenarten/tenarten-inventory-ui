// Actual exported application; synthetic local fixture only. No hosted traffic.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
import {session,userId} from './support/wave4-fixture.mjs';
const origin=process.env.STARTUP_REVIEW_ORIGIN||'http://localhost:3355';
const brand=process.env.STARTUP_REVIEW_BRAND||'TenOps';
const evidence='docs/project-memory/evidence/startup-animation';
mkdirSync(evidence,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:process.env.STARTUP_REVIEW_HEADED!=='true'});
const checks=[],errors=[],external=[];
const hero=p=>p.locator('div[data-welcome-hero]');
const skip=p=>p.locator('[data-welcome-skip]');
async function fixture({mobile=false,reduced=false,failAsset=false,delay=0,deny=false,failJobs=false,video=false}={}){
 const context=await browser.newContext({viewport:mobile?{width:320,height:568}:{width:1440,height:1000},hasTouch:mobile,isMobile:mobile,reducedMotion:reduced?'reduce':'no-preference',...(video?{recordVideo:{dir:evidence,size:mobile?{width:320,height:568}:{width:1440,height:1000}}}:{})});
 await context.addInitScript(s=>localStorage.setItem('sb-localhost-auth-token',JSON.stringify(s)),session());
 await context.routeWebSocket('**/realtime/v1/**',()=>{});
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.origin!==origin){external.push(u.href);return route.abort();}
  if(failAsset&&u.pathname.includes('terrazzo-welcome'))return route.abort();
  if(failJobs&&u.pathname==='/rest/v1/jobs')return route.fulfill({status:400,json:{message:'Controlled initialization failure'}});
  if(u.pathname==='/rest/v1/jobs'&&delay)await new Promise(r=>setTimeout(r,delay));
  if(deny&&u.pathname.endsWith('/rpc/get_my_app_access'))return route.fulfill({json:[{user_id:userId,display_name:'Denied review',role:'admin',is_active:false,read_only:false}]});
  return route.continue();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 return{context,page};
}
async function run(name,test,options={}){
 const filter=process.env.STARTUP_CHECK;
 if(filter==='visual'&&!/^(full|desktop|mobile)/.test(name))return;
 if(filter==='skip'&&!/^(desktop|mobile)/.test(name))return;
 if(filter&&!['visual','skip'].includes(filter)&&!name.startsWith(filter))return;
 const f=await fixture(options);try{await test(f.page);checks.push(name);console.log('PASS '+name);}finally{const video=f.page.video();await f.context.close();if(video)await video.saveAs(`${evidence}/${brand}-${name.startsWith('full')?'full':name.startsWith('mobile')?'mobile-skip':'skip'}.webm`);}
}
async function readyToSkip(p){await expect(skip(p)).toBeVisible({timeout:18000});await expect(hero(p)).toHaveAttribute('data-critical-app-ready','true');await expect(hero(p)).toHaveAttribute('data-hero-animation-complete','true');}
const emit=async(p,event,s)=>p.evaluate(({event,s})=>{localStorage.setItem('sb-localhost-auth-token',JSON.stringify(s));const c=new BroadcastChannel('sb-localhost-auth-token');c.postMessage({event,session:s});c.close();},{event,s});
try{
 await run('full sequence, 1.85-second hold and continuous mounted entrance',async p=>{
  await p.goto(origin+'/');await expect(hero(p)).toBeVisible();
  await expect(p.locator('[data-welcome-secondary]')).toHaveText(brand==='TenDev'?'TenDev RESEARCH & DEVELOPMENT':'TenOps OPERATIONS CONTROL');
  const box=await p.locator('div[data-welcome-hero] [data-welcome-logo-stack]').boundingBox();
  await p.screenshot({path:`${evidence}/${brand}-opening.png`});
  await p.evaluate(()=>{
   window.keptShell=document.querySelector('[data-app-shell]');window.startupPhases={};
   const node=document.querySelector('div[data-welcome-hero]');
   new MutationObserver(()=>{const phase=node.dataset.welcomePhase;if(!(phase in window.startupPhases))window.startupPhases[phase]=performance.now();}).observe(node,{attributes:true,attributeFilter:['data-welcome-phase']});
  });
  assert.equal(await skip(p).count(),0);await p.keyboard.press('Space');await expect(hero(p)).toBeVisible();
  await readyToSkip(p);await expect(p.locator('[data-welcome-secondary]')).toHaveCSS('opacity','0');await expect(p.locator('[data-welcome-embedded-wordmark]')).toHaveCSS('opacity','0');
  const isolated=await p.locator('div[data-welcome-hero] [data-welcome-logo-stack]').boundingBox();
  for(const k of ['x','y','width','height'])assert(Math.abs(box[k]-isolated[k])<.1,`Crest ${k} moved`);
  await p.waitForTimeout(900);await p.screenshot({path:`${evidence}/${brand}-sparks.png`});
  await p.waitForTimeout(1100);await p.screenshot({path:`${evidence}/${brand}-plates.png`});
  await expect(hero(p)).toHaveAttribute('data-welcome-phase','hold',{timeout:6000});
  await p.screenshot({path:`${evidence}/${brand}-terrazzo.png`});
  for(const plate of await p.locator('[data-welcome-plate]').all())await expect(plate).toHaveCSS('opacity','0');
  await p.waitForFunction(()=>performance.now()-window.startupPhases.hold>=1200);await expect(hero(p)).toHaveAttribute('data-welcome-phase','hold');
  await expect(hero(p)).toHaveAttribute('data-welcome-phase','entrance',{timeout:1200});
  const holdMs=await p.evaluate(()=>window.startupPhases.entrance-window.startupPhases.hold);assert(holdMs>=1700&&holdMs<=2100,`Unexpected hold: ${holdMs}ms`);
  await expect(hero(p)).toHaveCount(0,{timeout:2000});
  assert(await p.evaluate(()=>window.keptShell===document.querySelector('[data-app-shell]')));
  await p.screenshot({path:`${evidence}/${brand}-application.png`});
 },{video:true});
 await run('desktop skip, editable-space guard, keyboard access and session replay protection',async p=>{
  await p.goto(origin+'/');await readyToSkip(p);
  await p.evaluate(()=>{const input=document.createElement('input');input.id='typing-check';document.querySelector('div[data-welcome-hero]').append(input);input.focus();});
  await p.keyboard.press('Space');assert.equal(await p.locator('#typing-check').inputValue(),' ');await expect(hero(p)).toBeVisible();
  await p.locator('#typing-check').evaluate(e=>e.remove());await p.keyboard.press('Tab');await expect(skip(p)).toBeFocused();
  await p.keyboard.press('Space');await expect(hero(p)).toHaveCount(0,{timeout:2500});
  const kept=await p.evaluate(()=>{window.keptShell=document.querySelector('[data-app-shell]');return sessionStorage.getItem('tenops.welcomeHeroPlayed:'+JSON.parse(localStorage.getItem('sb-localhost-auth-token')).user.id);});assert.equal(kept,'true');
  for(const event of ['SIGNED_IN','TOKEN_REFRESHED']){await emit(p,event,session(userId,event==='SIGNED_IN'?1:2));await p.waitForTimeout(500);await expect(hero(p)).toHaveCount(0);assert(await p.evaluate(()=>window.keptShell===document.querySelector('[data-app-shell]')));}
  await p.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('online'));});await p.waitForTimeout(300);await expect(hero(p)).toHaveCount(0);
  await p.reload();await p.waitForTimeout(1000);await expect(hero(p)).toHaveCount(0);
  await p.goto(origin+'/inventory');await p.waitForTimeout(1000);await expect(hero(p)).toHaveCount(0);
  const tab=await p.context().newPage();await tab.goto(origin+'/');await expect(hero(tab)).toBeVisible();await tab.close();
 },{video:true});
 await run('mobile tap skip and small viewport',async p=>{
  await p.goto(origin+'/');await readyToSkip(p);await expect(skip(p).getByText('Tap to skip')).toBeVisible();
  const b=await skip(p).boundingBox();assert(b.x>=0&&b.x+b.width<=320&&b.y+b.height<=568);
  await p.screenshot({path:`${evidence}/${brand}-mobile.png`});await skip(p).tap();await expect(hero(p)).toHaveCount(0,{timeout:2500});
 },{mobile:true,video:true});
 await run('readiness delay cannot be bypassed after decorative progress reaches 100',async p=>{
  await p.goto(origin+'/');await expect(hero(p)).toHaveAttribute('data-hero-animation-complete','true',{timeout:10000});
  await expect(hero(p)).toHaveAttribute('data-critical-app-ready','false');assert.equal(await skip(p).count(),0);
  await p.keyboard.press('Space');await expect(hero(p)).toBeVisible();await readyToSkip(p);await p.keyboard.press('Space');await expect(hero(p)).toHaveCount(0,{timeout:2500});
 },{delay:8500});
 await run('reduced motion has no sparks or decorative hold',async p=>{
  await p.goto(origin+'/');await expect(hero(p)).toBeVisible();await expect(hero(p)).toHaveCount(0,{timeout:5000});assert.equal(await skip(p).count(),0);
  await expect(p.locator('[data-shell-header]')).toBeVisible();
 },{reduced:true});
 await run('asset failure enters ready application without decorative hold',async p=>{
  await p.goto(origin+'/');await expect(hero(p)).toBeVisible();await expect(hero(p)).toHaveCount(0,{timeout:8500});
 },{failAsset:true});
 await run('initialization failure exposes recovery UI without decorative hold',async p=>{
  await p.goto(origin+'/');await expect(p.getByText('Controlled initialization failure',{exact:true})).toBeVisible();await expect(hero(p)).toHaveCount(0,{timeout:3000});
 },{failJobs:true});
 await run('denied account exposes real access error without startup',async p=>{
  await p.goto(origin+'/');await expect(p.getByText(/This account is disabled/)).toBeVisible();await expect(hero(p)).toHaveCount(0);
 },{deny:true});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 writeFileSync(`${evidence}/${brand}${process.env.STARTUP_CHECK?"-"+process.env.STARTUP_CHECK:""}-results.json`,JSON.stringify({brand,origin,checks,errors,external,notes:['Focus/visibility events and continuing auth events are simulated. Physical OS tab suspension and Home Screen launch require manual review.']},null,2)+'\n');
}finally{await browser.close();}
