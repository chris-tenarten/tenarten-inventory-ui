import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
const fixture=JSON.parse(readFileSync('/private/tmp/tenops-production-blend-v11-review/server.json'));
const output='output/pdf/generator-ux';mkdirSync(output,{recursive:true});
const browser=await chromium.launch();let diagnosticPage;
try {
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),writes=[],errors=[];
 diagnosticPage=page;page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('generate-sample-pdf'))writes.push(r.postDataJSON());});
 await page.goto(fixture.route);await expect(page.locator('[data-welcome-hero="true"]')).toBeHidden({timeout:30000});
 const card=page.getByRole('region',{name:'Production Blend Sheet'});await expect(card).toBeVisible({timeout:30000});await card.getByRole('button',{name:'Plan Production Blend',exact:true}).click();
 await expect(card.getByLabel('ADJD Batches',{exact:true})).toHaveValue('1');const initialHistory=await card.getByRole('button',{name:/230 lb/}).count();
 await card.getByLabel('ADJD Batches',{exact:true}).fill('10');await card.getByLabel('ADJ (lb)',{exact:true}).fill('200');
 await expect(card.getByText('2,000 lb',{exact:true})).toBeVisible();await expect(card.getByText('50 US gal',{exact:true})).toBeVisible();
 await card.getByLabel('Blend Size (lb)',{exact:true}).fill('500');await expect(card.getByText('4 × 500-lb Blends',{exact:true})).toBeVisible();await expect(card.getByText('50 US gal',{exact:true})).toBeVisible();
 assert(!writes.some(x=>['blend-save','blend-issue'].includes(x.action)));
 const help=card.getByRole('button',{name:'Help: ADJ',exact:true});await help.focus();await expect(help.locator('..').getByRole('tooltip')).toBeVisible();await help.click();await expect(help).toHaveAttribute('aria-expanded','true');await help.click();await help.blur();await help.hover();await expect(help.locator('..').getByRole('tooltip')).toBeVisible();
 for(const width of [1440,390]){await page.setViewportSize({width,height:1100});await card.screenshot({path:`${output}/planner-${width}.png`});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));}
 await page.setViewportSize({width:1440,height:1100});
 await card.getByLabel('ADJD Batches',{exact:true}).fill('1');await card.getByLabel('ADJ (lb)',{exact:true}).fill('50');await card.getByLabel('Blend Size (lb)',{exact:true}).fill('1000');
 async function generate(file){const response=page.waitForResponse(r=>r.url().includes('generate-sample-pdf')&&r.request().postDataJSON()?.action==='blend-pdf');await card.getByRole('button',{name:'Generate Blend Sheet',exact:true}).click();const pdf=await response;assert.equal(pdf.status(),200);writeFileSync(`${output}/${file}.pdf`,await pdf.body());await expect(page.getByRole('button',{name:'Close document viewer',exact:true})).toBeVisible();await page.getByRole('button',{name:'Close document viewer',exact:true}).click();}
 await generate('Production-230-lb');assert.equal(writes.filter(x=>x.action==='blend-issue').length,1);assert(!writes.some(x=>x.action==='blend-save'));
 await generate('Production-repeat');assert.equal(writes.filter(x=>x.action==='blend-issue').length,2);
 // PDF delivery failure must retry the already captured document, not create another.
 await page.route('**/functions/v1/generate-sample-pdf',async route=>{if(route.request().postDataJSON()?.action==='blend-pdf')await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Local PDF delivery failure'})});else await route.continue();});
 await card.getByRole('button',{name:'Generate Blend Sheet',exact:true}).click();
 await expect(card.getByRole('button',{name:'Retry opening generated sheet',exact:true})).toBeVisible();
 await expect(card.getByRole('button',{name:'Retry opening generated sheet',exact:true})).toBeEnabled();
 assert.equal(writes.filter(x=>x.action==='blend-issue').length,3);
 await page.unroute('**/functions/v1/generate-sample-pdf');const retry=page.waitForResponse(r=>r.url().includes('generate-sample-pdf')&&r.request().postDataJSON()?.action==='blend-pdf');await card.getByRole('button',{name:'Retry opening generated sheet',exact:true}).click();assert.equal((await retry).status(),200);assert.equal(writes.filter(x=>x.action==='blend-issue').length,3);await page.getByRole('button',{name:'Close document viewer',exact:true}).click();
 await page.reload();await card.getByRole('button',{name:'Plan Production Blend',exact:true}).click();await expect(card.getByRole('button',{name:/230 lb/})).toHaveCount(initialHistory+3);
 const count=writes.filter(x=>x.action==='blend-issue').length;const open=page.waitForResponse(r=>r.url().includes('generate-sample-pdf')&&r.request().postDataJSON()?.action==='blend-pdf');await card.getByRole('button',{name:/230 lb/}).first().click();assert.equal((await open).status(),200);assert.equal(writes.filter(x=>x.action==='blend-issue').length,count);await page.getByRole('button',{name:'Close document viewer',exact:true}).click();
 assert.deepEqual(errors,[]);console.log('PASS real UI: transient edits; ADJ/staging isolation; accessible help; desktop/mobile; Generate creates one immutable record; repeat generates another; history opens without writes.');
}catch(e){if(diagnosticPage)console.error(await diagnosticPage.getByRole('region',{name:'Production Blend Sheet'}).innerText());console.error(e);throw e;}finally{await browser.close();}
