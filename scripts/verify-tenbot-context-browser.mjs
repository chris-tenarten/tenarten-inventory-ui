/** Actual localhost Messaging UI; synthetic Auth/data/model transports only. */
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {reviewSession} from './support/messaging-groups-review-fixture.mjs';
const origin='http://localhost:3000',directory='/private/tmp/tenops-tenbot-live-history-20261101',checks=[],calls=[],errors=[];
const browser=await chromium.launch({headless:true});mkdirSync(directory,{recursive:true});
try{
 const context=await browser.newContext({viewport:{width:1365,height:900}}),page=await context.newPage();page.setDefaultTimeout(12000);
 await page.addInitScript(session=>{localStorage.setItem('sb-localhost-auth-token',JSON.stringify(session));sessionStorage.setItem('tenops.welcomeHeroPlayed:'+session.user.id,'true');},reviewSession);
 await page.route('**/*',async route=>{const r=route.request(),url=new URL(r.url());if(![origin,'http://localhost:55597'].includes(url.origin)&&!['blob:','data:'].includes(url.protocol))return route.abort();if(url.pathname==='/functions/v1/tenbot'&&r.method()==='POST')calls.push(r.postDataJSON().action);return route.continue();});
 page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/my-work',{waitUntil:'domcontentloaded'});
 const panel=()=>page.getByRole('dialog',{name:'Inbox',exact:true});
 const open=async()=>{await page.getByRole('button',{name:'Messaging',exact:true}).click();await expect(panel()).toBeVisible();await panel().locator('aside').getByRole('button').filter({has:page.getByText('TenBot',{exact:true})}).click();await expect(panel().getByRole('textbox',{name:'Message',exact:true})).toBeEnabled();};
 const send=async q=>{const box=panel().getByRole('textbox',{name:'Message',exact:true});await box.fill(q);await panel().locator('[data-messaging-composer]').getByRole('button',{name:'Send',exact:true}).click();await expect.poll(()=>calls.filter(x=>x==='ask').length).toBeGreaterThan(0);await expect(box).toBeEnabled();};
 await open();await send('How many active jobs are in Production?');await expect(panel().locator('[data-tenbot-answer]').last()).toContainText('8');
 await send('Which ones?');await expect(panel().locator('[data-tenbot-answer]').last()).toContainText('CTX-8');await expect(panel().locator('[data-tenbot-answer]').first()).toContainText('8');await expect(panel().locator('[data-tenbot-history-state]').first()).toContainText('Previous answer');checks.push('Count and Which ones remain simultaneously readable with historical labels');
 const oldHistory=calls.filter(x=>x==='history').length;await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));});await expect.poll(()=>calls.filter(x=>x==='history').length).toBeGreaterThan(oldHistory);await expect(panel().locator('[data-tenbot-answer]').first()).toContainText('8');checks.push('Blur/focus reauthorizes and restores prior readable answers without another ask');
 const before=calls.filter(x=>x==='ask').length;await page.reload({waitUntil:'domcontentloaded'});await open();assert.equal(calls.filter(x=>x==='ask').length,before);await expect(panel().locator('[data-tenbot-answer]').first()).toContainText('8');await send('Which ones?');await expect(panel().locator('[data-tenbot-answer]').last()).toContainText('CTX-1');checks.push('Remount restores both historical prose and subject without repeating inference');
 const storage=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));assert(!storage.includes('Context Alpha'));assert(!storage.includes('Active Production Jobs'));checks.push('Browser storage contains no operational answer or Job label');
 await page.screenshot({path:directory+'/context-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await expect(panel().getByRole('textbox',{name:'Message',exact:true})).toBeVisible();await page.screenshot({path:directory+'/context-mobile.png',fullPage:true});checks.push('Composer remains usable at mobile width');assert.deepEqual(errors,[]);
 const result={passed:true,checks,actions:calls,errors,actualMessagingUi:true,syntheticAuthAndData:true,liveInference:false,realDatabase:false,hostedCalls:0};writeFileSync(directory+'/browser.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));await context.close();
}catch(e){writeFileSync(directory+'/browser-failure.json',JSON.stringify({passed:false,message:e.message,checks,actions:calls,errors},null,2)+'\n');throw e;}finally{await browser.close();}
