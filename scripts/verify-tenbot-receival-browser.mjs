// Actual localhost browser/HTTP gate checks; no inference or database requests.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const directory='/private/tmp/tenops-tenbot-real-receivals-2026-10-29',origin='http://localhost:3000',endpoint='http://localhost:55596';
mkdirSync(directory,{recursive:true});
const journalPath='/private/tmp/tenops-tenbot-agent-poc/openai-budget.json',journal=readFileSync(journalPath),requests=[],blocked=[],errors=[],checks=[];
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}});
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>{if(['http://localhost:55593','http://localhost:55595',endpoint].includes(new URL(request.url()).origin))requests.push({origin:new URL(request.url()).origin,method:request.method(),action:request.method()==='POST'?request.postDataJSON()?.action:null});});
await page.route('**/*',async route=>{const url=new URL(route.request().url());if(!['http://localhost:3000','http://localhost:55595',endpoint].includes(url.origin)&&!['data:','blob:'].includes(url.protocol)){blocked.push(url.origin);await route.abort();return;}await route.continue();});
try{
 const fixture='fixture.'+Buffer.from(JSON.stringify({sub:'00000000-0000-4000-8000-000000900021'})).toString('base64url')+'.local';
 for(const [label,headers,status] of [['missing auth',{Origin:origin},401],['fixture auth',{Origin:origin,Authorization:'Bearer '+fixture},401],['wrong origin',{Origin:'http://localhost:3001',Authorization:'Bearer '+fixture},403]]){
  const response=await page.request.post(endpoint,{headers,data:{action:'status'},timeout:3000});assert.equal(response.status(),status,label);checks.push(label+' rejected by actual loopback HTTP adapter before database authentication');
 }
 await page.goto(origin+'/my-work?tenbotExperiment=1&tenbotReceivals=1',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Messaging',exact:true}).click();const panel=page.getByRole('dialog',{name:'Inbox',exact:true});await expect(panel).toBeVisible();
 await panel.locator('aside').getByRole('button').filter({has:page.getByText('TenBot',{exact:true})}).click();
 const controls=panel.getByLabel('Local agent experiment controls',{exact:true});await expect(controls).toBeVisible();
 await expect(controls).toContainText('Real execution is disabled until database-backed release gates pass.');
 await expect(panel).toContainText('Authenticated database unavailable; writes disabled.');
 const composer=panel.locator('[data-messaging-composer]');
 await expect(composer.getByRole('button',{name:'Attach PDF or image',exact:true})).toBeDisabled();
 await expect(composer.locator('input[type=file]')).toBeDisabled();
 assert(!requests.some(r=>r.origin!==endpoint));assert(requests.some(r=>r.origin===endpoint&&r.action==='status'));assert(!requests.some(r=>['ask','upload','review','approve'].includes(r.action)));
 checks.push('Authenticated candidate shows exact real-database blocker, disables attachment actions, and never falls back to simulation or Qwen');
 await page.screenshot({path:directory+'/authenticated-desktop-blocked.png'});
 await page.setViewportSize({width:390,height:844});await controls.scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const box=await panel.boundingBox();assert(box&&box.width<=391);await page.screenshot({path:directory+'/authenticated-mobile-blocked.png'});checks.push('Actual mobile Messaging remains contained with its execution blocker visible');
 assert.equal(errors.length,0);assert.equal(blocked.length,0);assert(journal.equals(readFileSync(journalPath)));checks.push('No model calls, external requests or reservation-ledger changes');
 const result={passed:true,mode:'Actual browser and localhost HTTP failure gates only; no real JWT/RLS/transaction or inference claim',groups:checks.length,checks,requests,errors,externalRequests:blocked,journal:JSON.parse(journal.toString()),journalSha256:createHash('sha256').update(journal).digest('hex'),databaseRequests:0,inferenceCalls:0,productionWrites:0};writeFileSync(directory+'/browser-validation.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,groups:checks.length,report:directory+'/browser-validation.json'}));
}finally{await browser.close();}
