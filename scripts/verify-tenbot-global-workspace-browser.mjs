/** Actual app UI, synthetic owner/session/history transport. No hosted calls or inference. */
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {reviewSession} from './support/messaging-groups-review-fixture.mjs';
import {verifyTenbotActionsBrowser} from './support/tenbot-actions-browser.mjs';

const actionsOnly=process.argv.includes('--actions-only');
const origin=process.env.TENBOT_WORKSPACE_REVIEW_ORIGIN||'http://localhost:3100';
assert.equal(new URL(origin).hostname,'localhost');
const directory=actionsOnly?'/private/tmp/tenops-tenbot-interactive-actions-evidence':'/private/tmp/tenops-tenbot-global-workspace-evidence';
mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({headless:true});
const checks=[],calls=[],errors=[],outbound=[];
let user=reviewSession.user,allowed=true,failNext=false;
const conversationId='00000000-0000-4000-8000-000000000777';
const answer=message=>({mode:'assistant',contentScope:'workflow',conversationId,message,sources:[],snapshot:{revision:'synthetic-presentation',verifiedAt:'2026-11-02T12:00:00Z'},summary:null});
let turns=Array.from({length:12},(_,index)=>({id:'saved-'+index,question:'Synthetic saved question '+index,createdAt:new Date(Date.UTC(2026,10,2,12,index)).toISOString(),answeredAt:new Date(Date.UTC(2026,10,2,12,index,1)).toISOString(),answer:answer('Synthetic saved workflow answer '+index+'. Use the existing TenOps workflow to review your work. '.repeat(4))}));
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const browserSession=structuredClone(reviewSession);
if(actionsOnly){const parts=browserSession.access_token.split('.'),payload=JSON.parse(Buffer.from(parts[1],'base64url').toString());payload.session_id='00000000-0000-4000-8000-000000000711';payload.aal='aal1';parts[1]=Buffer.from(JSON.stringify(payload)).toString('base64url');browserSession.access_token=parts.join('.');}
await context.addInitScript(session=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(session));sessionStorage.setItem('tenops.welcomeHeroPlayed:'+session.user.id,'true');},browserSession);
await context.routeWebSocket('**/realtime/v1/websocket*',socket=>{socket.onMessage(raw=>{try{const frame=JSON.parse(String(raw));if(!Array.isArray(frame))return;socket.send(JSON.stringify([frame[0],frame[1],frame[2],'phx_reply',{status:'ok',response:{postgres_changes:[]}}]));}catch{/* Binary typing transport is irrelevant to this UI fixture. */}});});
await context.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url());
 const fulfill=value=>route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':origin,'content-range':'0-0/0','access-control-expose-headers':'content-range'},body:JSON.stringify(value)});
 if(url.origin===origin)return route.continue();
 if(!['http://127.0.0.1:55592','http://localhost:55598'].includes(url.origin)){outbound.push(url.origin);return route.abort();}
 if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-supabase-api-version','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}});
 if(url.origin==='http://localhost:55598'){
  const body=request.postDataJSON();calls.push(body);
  if(body.action==='status')return fulfill({mode:'assistant',historyAvailable:true,persistentHistoryAvailable:true});
  if(body.action==='history')return fulfill({mode:'assistant',persistentHistory:true,conversationId,turns,nextCursor:null});
  if(body.action==='ask'){
   if(failNext){failNext=false;return route.fulfill({status:503,contentType:'application/json',headers:{'Access-Control-Allow-Origin':origin},body:JSON.stringify({error:'Synthetic temporary failure'})});}
   const createdAt=new Date().toISOString(),response=answer('Synthetic answer: open Production and review the current workflow.');
   const turn={id:'sent-'+calls.length,question:body.question,createdAt,answeredAt:createdAt,answer:response};turns.push(turn);
   return fulfill({...response,historyTurnId:turn.id,createdAt,answeredAt:createdAt});
  }
  throw Error('Unexpected assistant action '+body.action);
 }
 if(url.pathname.startsWith('/auth/v1/'))return fulfill(user);
 if(url.pathname.endsWith('/get_my_app_access'))return fulfill([{user_id:user.id,display_name:'Synthetic workspace review',role:allowed?'admin':'member',is_active:allowed,read_only:false,messaging_write:allowed}]);
 if(url.pathname.endsWith('/get_my_account_preferences'))return fulfill({});
 if(url.pathname.endsWith('/list_my_work_inbox_recipients'))return fulfill([{user_id:'00000000-0000-4000-8000-000000900022',display_name:'Synthetic colleague',role:'member'}]);
 if(url.pathname.endsWith('/ensure_my_welcome_notification'))return fulfill(null);
 if(url.pathname.startsWith('/rest/v1/'))return fulfill([]);
 return route.abort();
});
const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
const panel=()=>page.locator('[data-tenbot-global-workspace]');
const input=()=>panel().getByRole('textbox',{name:'Message',exact:true});
const launcher=()=>page.getByRole('button',{name:'Open TenBot',exact:true});
const asks=()=>calls.filter(call=>call.action==='ask');
const viewport=async(height,top=0)=>page.evaluate(({height,top})=>{for(const[name,value]of Object.entries({height,offsetTop:top}))Object.defineProperty(window.visualViewport,name,{configurable:true,value});window.visualViewport.dispatchEvent(new Event('resize'));window.visualViewport.dispatchEvent(new Event('scroll'));},{height,top});
try{
 if(actionsOnly){await verifyTenbotActionsBrowser({page,origin,directory,checks,publishHistoryStatus:status=>{if(status===null){turns=[];return;}const time=new Date().toISOString();turns=[{id:'saved-action',question:'Synthetic historical action receipt',createdAt:time,answeredAt:time,answer:{...answer('Synthetic historical receipt fixture. No authenticated business write was performed.'),actionStatuses:[status],history:{persistent:true,state:'verified',historical:true,observedAt:time,checkedAt:time}}}];}});}else{
 await page.goto(origin+'/my-work',{waitUntil:'domcontentloaded'});
 await launcher().click();await expect(input()).toBeEnabled();await expect(panel().locator('[data-tenbot-answer]')).toHaveCount(12);
 assert.equal(new URL(page.url()).pathname,'/my-work');assert.equal(asks().length,0);
 const bounds=await panel().boundingBox();assert(bounds.width<=461&&bounds.x>900);assert(bounds.y>=(await page.locator('[data-shell-header]').boundingBox()).height);
 checks.push('Header opens right-side assistant without navigation; existing owner history hydrates with no ask');
 const history=panel().locator('[data-tenbot-global-history]');
 await input().fill('Unsent shared draft');await history.evaluate(element=>{element.scrollTop=140;});const scroll=await history.evaluate(element=>element.scrollTop);
 await panel().getByRole('button',{name:'Close TenBot',exact:true}).click();await expect(panel()).toBeHidden();await expect(launcher()).toBeFocused();
 await launcher().click();await expect(input()).toHaveValue('Unsent shared draft');assert.equal(await history.evaluate(element=>element.scrollTop),scroll);
 checks.push('Close/reopen preserves draft, mid-history scroll and focus return');
 await panel().getByRole('button',{name:'Expand TenBot workspace'}).click();await expect(panel()).toHaveAttribute('aria-modal','true');assert.equal(await page.locator('[data-app-shell]').evaluate(element=>element.inert),true);
 await panel().getByRole('button',{name:'Send',exact:true}).focus();await page.keyboard.press('Tab');assert.equal(await panel().evaluate(element=>element.contains(document.activeElement)),true);await page.screenshot({path:directory+'/expanded.png'});
 await panel().getByRole('button',{name:'Collapse TenBot workspace'}).click();assert.equal(await page.locator('[data-app-shell]').evaluate(element=>element.inert),false);await expect(input()).toHaveValue('Unsent shared draft');
 await page.locator('[data-shell-brand-link]').click();await expect(page).toHaveURL(origin+'/');await expect(panel()).toBeVisible();await expect(input()).toHaveValue('Unsent shared draft');
 checks.push('Expanded workspace traps background; collapse and in-app navigation preserve assistant state');
 await page.getByRole('button',{name:'Messaging',exact:true}).click();await expect(panel()).toBeHidden();const inbox=page.getByRole('dialog',{name:'Inbox',exact:true});await expect(inbox).toBeVisible();
 await inbox.locator('aside').getByRole('button').filter({has:page.getByText('TenBot',{exact:true})}).click();await expect(inbox.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('Unsent shared draft');
 await inbox.getByRole('textbox',{name:'Message',exact:true}).fill('Draft returned from Messaging');await inbox.getByRole('button',{name:'Close Inbox',exact:true}).click();await expect(inbox).toBeHidden();await launcher().click();await expect(inbox).toBeHidden();await expect(input()).toHaveValue('Draft returned from Messaging');
 checks.push('Legacy Messaging remains accessible and shares the exact conversation controller and unsent draft');
 await input().dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true});assert.equal(asks().length,0);
 failNext=true;await input().press('Enter');await expect(panel().getByRole('alert')).toContainText('Synthetic temporary failure');await expect(input()).toHaveValue('Draft returned from Messaging');
 await input().press('Enter');await expect(input()).toHaveValue('');await expect(panel().locator('[data-tenbot-answer]').last()).toContainText('Synthetic answer');
 assert.equal(asks().length,2);assert(asks().every(call=>call.conversationId===conversationId));assert(asks().every(call=>JSON.stringify(call.context)==='["Current module: Production"]'));
 await expect(panel().locator('[data-capability-request]')).toHaveCount(0);
 checks.push('IME Enter does not send; failed send retains draft; retry uses same conversation; ordinary answer has no capability prompt');
 await page.screenshot({path:directory+'/desktop.png'});await page.evaluate(()=>document.documentElement.dataset.appearance='light');await page.screenshot({path:directory+'/desktop-light.png'});await page.evaluate(()=>document.documentElement.dataset.appearance='dark');
 await page.setViewportSize({width:390,height:844});await expect(panel()).toHaveAttribute('aria-modal','true');
 assert.equal(await page.locator('[data-app-shell]').evaluate(element=>element.inert),true);
 await viewport(470,12);await expect.poll(async()=>Math.round((await panel().boundingBox()).height)).toBe(470);
 await expect(input()).toBeVisible();const keyboardBox=await input().boundingBox();assert(keyboardBox.y+keyboardBox.height<=482);
 await input().fill('Mobile draft\nwith a second line');await page.screenshot({path:directory+'/mobile-keyboard.png'});
 await panel().getByRole('button',{name:'Close TenBot',exact:true}).click();await expect(panel()).toBeHidden();assert.equal(await page.locator('[data-app-shell]').evaluate(element=>element.inert),false);await viewport(844);await launcher().click();await expect(input()).toHaveValue('Mobile draft\nwith a second line');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:directory+'/mobile.png'});
 checks.push('Mobile fullscreen follows keyboard visualViewport; composer remains accessible; safe-area/body lock releases and draft survives');
 const beforeBack=page.url();await page.goBack();await expect(panel()).toBeHidden();assert.equal(page.url(),beforeBack);await launcher().click();await expect(input()).toHaveValue('Mobile draft\nwith a second line');checks.push('Mobile browser Back closes fullscreen assistant on the same underlying route');
 await panel().getByRole('button',{name:'Close TenBot',exact:true}).click();await expect(panel()).toBeHidden();await page.setViewportSize({width:1440,height:1000});
 await page.goto(origin+'/my-work?tenbotCapabilityPreview=1',{waitUntil:'domcontentloaded'});await launcher().click();await expect(input()).toBeEnabled();
 const card=panel().getByRole('region',{name:'Suggest a TenBot capability'});await expect(card).toBeVisible();await expect(panel()).toContainText('Synthetic interaction preview');
 await card.getByText('Add context (optional)',{exact:true}).click();await card.getByRole('textbox',{name:'Additional context'}).fill('Synthetic additional context');
 await card.getByRole('button',{name:'Yes, submit suggestion'}).click();await expect(card.getByRole('status')).toContainText('not submitted');assert.equal(calls.filter(call=>call.action==='submit').length,0);await page.screenshot({path:directory+'/inline-preview.png'});
 await card.getByRole('button',{name:'No, dismiss'}).click();await expect(card).toHaveCount(0);
 checks.push('Explicit local synthetic capability preview supports optional context, Yes preview and No with zero submission calls');
 // A different authenticated owner cannot inherit the first owner’s history or draft.
 user={...reviewSession.user,id:'00000000-0000-4000-8000-000000900099',email:'different-owner@example.invalid'};turns=[];
 await page.evaluate(nextUser=>{const key='sb-127-auth-token',oldValue=localStorage.getItem(key),session=JSON.parse(oldValue);session.user=nextUser;sessionStorage.setItem('tenops.welcomeHeroPlayed:'+nextUser.id,'true');const payload=JSON.parse(atob(session.access_token.split('.')[1]));payload.sub=nextUser.id;session.access_token=session.access_token.split('.')[0]+'.'+btoa(JSON.stringify(payload)).replaceAll('=','')+'.local-only';const newValue=JSON.stringify(session);localStorage.setItem(key,newValue);const channel=new BroadcastChannel(key);channel.postMessage({event:'SIGNED_IN',session});channel.close();},user);
 await expect(panel()).toHaveCount(0);await launcher().click();await expect(input()).toBeEnabled();await expect(input()).toHaveValue('');await expect(panel().locator('[data-tenbot-answer]')).toHaveCount(0);
 checks.push('Authenticated owner switch remounts assistant and exposes no previous draft or history');
 // Remove the current account's access and trigger the actual Auth profile path.
 await panel().getByRole('button',{name:'Expand TenBot workspace'}).click();await expect(panel()).toHaveAttribute('aria-modal','true');allowed=false;
 await page.evaluate(()=>{const key='sb-127-auth-token',oldValue=localStorage.getItem(key),session=JSON.parse(oldValue);session.access_token+='-changed';const newValue=JSON.stringify(session);localStorage.setItem(key,newValue);const channel=new BroadcastChannel(key);channel.postMessage({event:'SIGNED_IN',session});channel.close();});
 await expect(launcher()).toHaveCount(0);await expect(panel()).toHaveCount(0);assert.equal(await page.locator('[data-app-shell]').evaluate(element=>element.inert),false);
 checks.push('Access revocation removes launcher/panel and releases modal background lock');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(outbound,[]);
 const report={passed:true,origin,checks,actions:calls.map(call=>call.action),errors,blockedOutbound:outbound,actualApplicationUi:true,syntheticAuthAndHistory:true,hostedCalls:0,inferenceCalls:0,persistenceClaims:false};
 writeFileSync(directory+'/browser.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch(error){await page.screenshot({path:directory+'/failure.png'}).catch(()=>{});writeFileSync(directory+'/browser-failure.json',JSON.stringify({passed:false,message:error.message,checks,errors,actions:calls.map(call=>call.action)},null,2));throw error;}
finally{await context.close();await browser.close();}
