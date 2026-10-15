import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
import {reviewSession} from './support/messaging-draft-review-fixture.mjs';
if(process.argv.includes('--sign-in-smoke')) {
 const b=await chromium.launch();try { const p=await b.newPage();await p.goto('http://localhost:3000/samples?open=00000000-0000-4000-8000-000000710001');await expect(p.locator('input[type=email]')).toBeVisible();await expect(p.locator('input[type=password]')).toBeVisible();const denied=await p.request.post('http://localhost:3000/rest/v1/rpc/publish_sample_job_update',{data:{}});assert.equal(denied.status(),403);console.log('PASS normal sign-in screen at exact localhost origin; unauthenticated publishing denied. Real account login is left to Product.');}finally{await b.close();}process.exit(0);
}
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1440,height:1000}}),external=[],errors=[];
await context.addInitScript(session=>{localStorage.setItem('sb-localhost-auth-token',JSON.stringify(session));sessionStorage.setItem('tenops.welcomeHeroPlayed:'+session.user.id,'true');},reviewSession);
await context.route('**/*',route=>{if(['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname))return route.continue();external.push(route.request().url());return route.abort();});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);mkdirSync('output/sample-job-updates',{recursive:true});
const state=async()=>context.request.get('http://localhost:3000/__review/state').then(r=>r.json());
async function compose(){await page.getByRole('button',{name:'Post to Job',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Post Sample PDF to Job'});await dialog.getByRole('button',{name:/Disposable Job/}).click();return dialog;}
try{
 await page.goto('http://localhost:3000/samples?open=00000000-0000-4000-8000-000000710001');
 await expect(page.getByRole('button',{name:'Generate Sample Work Order',exact:true})).toBeVisible({timeout:30000});
 await page.getByRole('button',{name:'Generate Sample Work Order',exact:true}).click();
 await expect(page.getByRole('button',{name:'Post to Job',exact:true})).toBeVisible();
 const url=await page.getByRole('link',{name:'Download',exact:true}).getAttribute('href');
 const pdf=Buffer.from(await page.evaluate(async u=>Array.from(new Uint8Array(await(await fetch(u)).arrayBuffer())),url));assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
 const before=await state();let dialog=await compose();
 await dialog.getByRole('button',{name:'Post Update',exact:true}).dblclick();await expect(dialog.getByRole('status')).toContainText('Update posted');
 let after=await state();assert.equal(after.tables.job_updates.length,1);assert.equal(after.tables.job_attachments.length,2);assert.deepEqual(after.sample,before.sample);assert.equal(after.tables.job_attachments[0].file_name,'Existing attachment.pdf');
 let attached=after.tables.job_attachments[1];const actual=await context.request.get('http://localhost:3000/storage/v1/object/public/job-attachments/'+attached.storage_path,{headers:{Authorization:'Bearer '+reviewSession.access_token}});assert.deepEqual(await actual.body(),pdf);
 await dialog.getByRole('button',{name:'Done',exact:true}).click();await page.getByRole('button',{name:'Close document viewer',exact:true}).click();
 // Reopen the captured issued PDF; it must not generate another document.
 await page.getByText('Documents / History',{exact:true}).click();await page.getByRole('button',{name:'View',exact:true}).last().click();dialog=await compose();
 const editor=dialog.locator('[data-job-update-mention-editor]');await editor.fill('@Review');await dialog.getByRole('option',{name:'Review',exact:true}).click();
 await context.request.post('http://localhost:3000/__review/failure',{data:{stage:'upload'}});
 await dialog.getByRole('button',{name:'Post Update',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Disposable upload failure');
 await context.request.post('http://localhost:3000/__review/failure',{data:{stage:'post'}});
 await dialog.getByRole('button',{name:'Post Update',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Disposable post failure');assert.equal((await state()).tables.job_updates.length,1);
 await context.request.post('http://localhost:3000/__review/failure',{data:{lost:true}});
 await dialog.getByRole('button',{name:'Post Update',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Retry this same post');
 await dialog.getByRole('button',{name:'Post Update',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('Update posted');
 after=await state();assert.equal(after.tables.job_updates.length,2);assert.equal(after.notifications.length,1);assert.equal(after.objectCount,2);assert.deepEqual(after.sample,before.sample);
 await page.screenshot({path:'output/sample-job-updates/post-success.png'});
 await dialog.getByRole('button',{name:'Done',exact:true}).click();await page.getByRole('button',{name:'Close document viewer',exact:true}).click();
 await page.goto('http://localhost:3000/production');await page.getByRole('button',{name:/Open Job Updates for LOCAL-901/}).click();await expect(page.getByText(/Sample document:/).first()).toBeVisible();
 await page.screenshot({path:'output/sample-job-updates/job-feed.png'});
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 writeFileSync('output/sample-job-updates/browser-results.json',JSON.stringify({updates:after.tables.job_updates.length,attachments:after.tables.job_attachments.length,notifications:after.notifications.length,exactPdfBytes:true,sampleUnchanged:true,external,errors},null,2));
 console.log('PASS actual localhost application: generate/preview, optional-message post, exact bytes, existing attachments, mentions, failed-post cleanup, lost-response retry/no duplicates, Sample unchanged, Job Updates feed. Notification transport is disposable; real SQL behavior is checked separately.');
}catch(e){console.error((await page.locator('body').innerText()).slice(-3500));await page.screenshot({path:'output/sample-job-updates/failure.png'});throw e;}finally{await browser.close();}
