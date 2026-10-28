// Focused real localhost conversations. --live explicitly authorizes the
// existing free-only Qwen adapter; no request interception or Auth injection.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
if(!process.argv.includes('--live'))throw Error('Use --live for the bounded safe-fixture conversation review.');
const origin='http://localhost:3000',endpoint='http://localhost:55593';
const directory='/private/tmp/tenops-tenbot-job-browser-20261028';mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}});
const responses=[],errors=[],checks=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('response',async response=>{if(new URL(response.url()).origin===endpoint&&response.request().method()==='POST'){try{responses.push({request:response.request().postDataJSON(),status:response.status(),answer:await response.json()});}catch{}}});
try{
 await page.goto(origin+'/my-work',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Messaging',exact:true}).click();
 const panel=page.getByRole('dialog',{name:'Inbox',exact:true});await expect(panel).toBeVisible();
 await panel.locator('aside').getByRole('button').filter({has:page.getByText('TenBot',{exact:true})}).click();
 const input=panel.getByRole('textbox',{name:'Message',exact:true});
 const ask=async(question,verify)=>{
  const before=responses.filter(row=>row.request.action==='ask').length;
  await input.fill(question);await input.press('Enter');
  await expect.poll(()=>responses.filter(row=>row.request.action==='ask').length,{timeout:35000}).toBe(before+1);
  await expect(input).toBeEnabled();
  const row=responses.filter(row=>row.request.action==='ask').at(-1);assert.equal(row.status,200);assert(row.answer.operational,question);
  verify(row.answer);await expect(panel.locator('[data-tenbot-answer]').last()).toHaveText(row.answer.message);
  assert(!JSON.stringify(row.answer).match(/SYNTHETIC-(?:FINANCIAL|NOTES|WORKER|AUTHOR)|987654\.32/));
  return row.answer;
 };
 await ask('What is the current status of Job TB-2801?',answer=>assert(answer.operational.facts.some(fact=>fact.text.includes('In Production'))));
 await ask('How many recorded labor hours does that job have?',answer=>assert(answer.operational.facts.some(fact=>fact.text.includes('8.3 hours'))));
 await panel.locator('[data-tenbot-records]').last().locator('summary').click();
 await page.screenshot({path:directory+'/desktop-labor.png'});checks.push('Desktop actual Job resolution, caller-authorized labor follow-up and source details');
 await ask('How many active Production Jobs are there?',answer=>assert(answer.operational.facts.some(fact=>fact.text.startsWith('Active Production Jobs:'))));
 checks.push('Current Production counts render deterministic source facts');
 await page.setViewportSize({width:390,height:844});
 await ask('What is the status of Job "TenBot Review Shared Name"?',answer=>{assert.equal(answer.mode,'operational');assert.equal(answer.operational.choices.length,2);assert(answer.message.includes('I have not selected a Job'));});
 await page.screenshot({path:directory+'/mobile-ambiguous.png'});checks.push('Mobile ambiguous names never select a Job');
 await ask('What is the status of Job TB-2805?',answer=>assert(answer.operational.facts.some(fact=>fact.text.includes('Rework 2'))));
 await ask('What work is scheduled next for that job?',answer=>assert(answer.operational.facts.some(fact=>fact.text.includes('Planning phase detail is disabled'))));
 await page.screenshot({path:directory+'/mobile-planning.png'});checks.push('Mobile effective Rework and saved schedule distinguish disabled phase detail/readiness');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 // Foreground invalidation removes fetched facts immediately, then performs a
 // no-inference server-owned lookup refresh before displaying them again.
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 await expect(panel.locator('[data-tenbot-records]')).toHaveCount(0);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(panel.locator('[data-tenbot-records]').last()).toBeVisible({timeout:15000});
 checks.push('Background clears live response contents; foreground reauthorizes without inference');
 assert.equal(errors.length,0);
 writeFileSync(directory+'/report.json',JSON.stringify({passed:true,at:new Date().toISOString(),origin,checks,responses,errors,authFixturesInjectedByVerifier:false,requestInterceptions:0},null,2));
 console.log(JSON.stringify({passed:true,checks:checks.length,requests:responses.length,modes:responses.map(row=>row.answer.mode),directory}));
}catch(error){
 await page.screenshot({path:directory+'/failure.png',fullPage:true}).catch(()=>{});
 writeFileSync(directory+'/failure.json',JSON.stringify({error:error.message,responses,errors,visibleText:(await page.locator('body').innerText()).slice(0,6000)},null,2));throw error;
}finally{await browser.close();}
