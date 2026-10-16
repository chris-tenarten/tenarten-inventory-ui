/** Actual app/provider/browser, local intercepted transport only; no hosted accounts or writes. */
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const origin=process.env.AUTH_REVIEW_ORIGIN||'http://localhost:3000';
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const A='00000000-0000-0000-0000-0000000000a1',B='00000000-0000-0000-0000-0000000000b2';
function session(id=A,version=1){const user={id,aud:'authenticated',role:'authenticated',email:`review-${id.slice(-2)}@example.invalid`,app_metadata:{},user_metadata:{},created_at:'2026-10-16T00:00:00Z'};const token=Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp:4102444800,version})).toString('base64url')+'.local-only';return{access_token:token,refresh_token:'local-only',expires_at:4102444800,expires_in:3600,token_type:'bearer',user};}
const profile=(id=A,active=true)=>[{user_id:id,display_name:id===A?'Review A':'Review B',role:'admin',is_active:active,read_only:false,messaging_write:true,production_blend_manage:false,sample_labels_generate:false}];
const browser=await chromium.launch({headless:true}),checks=[],external=[],pageErrors=[];
async function fixture(){
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),pending=[];
 await context.addInitScript(({seed,A,B})=>{
  if(!localStorage.getItem('sb-127-auth-token'))localStorage.setItem('sb-127-auth-token',JSON.stringify(seed));
  for(const id of [A,B])sessionStorage.setItem('tenops.welcomeHeroPlayed:'+id,'true');
  window.denialTrace=[];new MutationObserver(()=>{if(document.body?.innerText.includes('This account is disabled'))window.denialTrace.push(performance.now());}).observe(document,{childList:true,subtree:true,characterData:true});
 },{seed:session(),A,B});
 await context.route('**/*',async route=>{
  const r=route.request(),u=new URL(r.url());
  if(u.origin===origin)return route.continue();
  if(u.origin!=='http://127.0.0.1:55592'){external.push(u.origin);return route.abort();}
  if(u.pathname==='/rest/v1/rpc/get_my_app_access')return new Promise(resolve=>pending.push({reply:async(data,status=200)=>{const response=page.waitForResponse(response=>response.request()===r);await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});await response;await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));resolve();}}));
  if(u.pathname==='/rest/v1/rpc/get_my_account_preferences')return route.fulfill({status:200,contentType:'application/json',body:'{}'});
  if(u.pathname==='/rest/v1/rpc/ensure_my_welcome_notification')return route.fulfill({status:403,contentType:'application/json',body:'{"message":"No diagnostic writes"}'});
  return route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'0-0/0'},body:'[]'});
 });
 const page=await context.newPage();page.on('pageerror',e=>pageErrors.push(e.message));await page.goto(origin+'/my-work');
 async function request(index){await expect.poll(()=>pending.length,{timeout:15000}).toBeGreaterThan(index);return pending[index];}
 async function waiting(){await expect(page.getByText('Restoring your TenOps session…',{exact:true})).toBeVisible();assert.equal(await page.getByRole('button',{name:'Messaging',exact:true}).count(),0);assert.equal(await page.getByText(/This account is disabled/).count(),0);}
 async function allowed(){await expect(page.getByRole('button',{name:'Messaging',exact:true})).toBeVisible();assert.equal(await page.getByText(/This account is disabled/).count(),0);}
 async function denied(){await expect(page.getByText('This account is disabled or does not have access to this TenOps environment.',{exact:true})).toBeVisible();assert.equal(await page.getByRole('button',{name:'Messaging',exact:true}).count(),0);}
 async function failed(){await expect(page.getByRole('alert').filter({hasText:'Unable to verify your TenOps account access.'})).toBeVisible();assert.equal(await page.getByText(/This account is disabled/).count(),0);assert.equal(await page.getByRole('button',{name:'Messaging',exact:true}).count(),0);}
 async function event(name,next){await page.evaluate(({name,next})=>{if(next)localStorage.setItem('sb-127-auth-token',JSON.stringify(next));else localStorage.removeItem('sb-127-auth-token');const channel=new BroadcastChannel('sb-127-auth-token');channel.postMessage({event:name,session:next});channel.close();},{name,next});}
 return {context,page,request,waiting,allowed,denied,failed,event};
}
async function run(name,test){const f=await fixture();try{await test(f);checks.push(name);}finally{await f.context.close();}}
try{
 await run('delayed active restoration, refresh and no false denial',async f=>{await f.request(0);await f.waiting();await (await f.request(0)).reply(profile());await f.allowed();assert.deepEqual(await f.page.evaluate(()=>window.denialTrace),[]);await f.page.reload();await f.request(1);await f.waiting();await (await f.request(1)).reply(profile());await f.allowed();assert.deepEqual(await f.page.evaluate(()=>window.denialTrace),[]);});
 await run('later TOKEN_REFRESHED event stays pending and then allowed',async f=>{await(await f.request(0)).reply(profile());await f.allowed();await f.event('TOKEN_REFRESHED',session(A,2));await f.request(1);await f.waiting();await(await f.request(1)).reply(profile());await f.allowed();assert.deepEqual(await f.page.evaluate(()=>window.denialTrace),[]);});
 await run('inactive account denied',async f=>{await(await f.request(0)).reply(profile(A,false));await f.denied();});
 await run('missing profile denied',async f=>{await(await f.request(0)).reply([]);await f.denied();});
 await run('profile request failure fails closed without disabled wording',async f=>{await(await f.request(0)).reply({message:'Synthetic verification failure'},400);await f.failed();});
 await run('identity change rejects old active result while next identity denied',async f=>{const old=await f.request(0);await f.event('SIGNED_IN',session(B));const next=await f.request(1);await f.waiting();await old.reply(profile());await f.waiting();await next.reply(profile(B,false));await f.denied();});
 await run('late old error cannot revoke newer allowed identity',async f=>{const old=await f.request(0);await f.event('SIGNED_IN',session(B));await(await f.request(1)).reply(profile(B));await f.allowed();await old.reply({message:'Old identity failed'},400);await f.allowed();});
 await run('same-user session change rejects old active response',async f=>{const old=await f.request(0);await f.event('TOKEN_REFRESHED',session(A,2));const next=await f.request(1);await old.reply(profile());await f.waiting();await next.reply({message:'New session verification failed'},400);await f.failed();});
 await run('sign-out rejects pending active result',async f=>{const old=await f.request(0);await f.event('SIGNED_OUT',null);await expect(f.page.getByLabel('Email',{exact:true})).toBeVisible();await old.reply(profile());await expect(f.page.getByLabel('Email',{exact:true})).toBeVisible();assert.equal(await f.page.getByRole('button',{name:'Messaging',exact:true}).count(),0);});
 await run('mismatched returned identity fails closed',async f=>{await(await f.request(0)).reply(profile(B));await f.failed();});
 assert.deepEqual(external,[]);assert.deepEqual(pageErrors,[]);console.log(JSON.stringify({passed:checks.length,checks,pageErrors,externalRequests:external,hostedWrites:0},null,2));
}finally{await browser.close();}
