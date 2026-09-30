import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
const root='/private/tmp/tenops-sample-batch-review';const fixture=JSON.parse(readFileSync(root+'/production-review.json'));
const output='output/pdf/production-batch';mkdirSync(output,{recursive:true});
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const requests=[];page.on('request',r=>{if(r.method()==='POST')requests.push({url:r.url(),body:r.postDataJSON()});});
 await page.goto(fixture.url);const card=page.getByRole('region',{name:'Production Batch Blend Sheet'});
 await expect(card.getByText('WORKING BATCH BLEND — NOT ISSUED',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Batch',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('[data-welcome-hero="true"]')).toBeHidden({timeout:20000});
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1100});await card.scrollIntoViewIfNeeded();
  assert.ok(await card.locator('p,button,select').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth&&getComputedStyle(e).textOverflow!=='ellipsis')));
  await card.screenshot({path:`${root}/production-ui-${width}.png`});
 }
 await page.setViewportSize({width:1440,height:1100});
 async function generate(action,filename){
  const responsePromise=page.waitForResponse(r=>r.url().includes('/functions/v1/generate-sample-pdf')&&r.request().postDataJSON()?.action===action);
  await card.getByRole('button',{name:'Generate Production Batch Blend Sheet',exact:true}).click();const response=await responsePromise;assert.equal(response.status(),200,await response.text());
  const download=page.getByRole('link',{name:/Download/i});await expect(download).toBeVisible();const href=await download.getAttribute('href');
  const bytes=await page.evaluate(async url=>Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer())),href);assert.equal(Buffer.from(bytes).subarray(0,4).toString(),'%PDF');writeFileSync(`${output}/${filename}.pdf`,Buffer.from(bytes));
  await page.getByRole('button',{name:'Close document viewer',exact:true}).click();
 }
 // Select through the real catalog UI, then verify the exact saved package context.
 const aggregate=page.locator('[data-sample-material-row]').first();
 await aggregate.getByPlaceholder('Type or search Catalog').fill('Blanco Mexicano');
 await aggregate.getByRole('listbox',{name:'Catalog matches'}).getByRole('option').filter({hasText:'Regular · T&M Supply · #1'}).first().click();
 await generate('batch-working','MTT-Working-Batch');
 const saved=requests.filter(r=>r.url.includes('/rpc/save_sample_draft')).at(-1);
 assert.equal(saved.body.p_rows[0].catalog_snapshot.package_context.amount,'50');
 assert.equal(saved.body.p_rows[0].catalog_snapshot.package_context.unit,'lb');
 assert.equal(saved.body.p_rows[0].catalog_snapshot.package_context.catalog_item_id,fixture.catalogIds[0]);
 await card.getByLabel('Source formulation').selectOption(fixture.issueId);await expect(card.getByText('Issued formulation · Issue 1',{exact:true})).toBeVisible();
 const before=requests.length;await generate('batch-issued','MTT-Production-Batch');assert.ok(!requests.slice(before).some(r=>r.url.includes('/rpc/save_')||r.url.includes('/rpc/issue_')),'issued output must not save or issue');
 const workingPdf=page.waitForResponse(r=>r.url().includes('/functions/v1/generate-sample-pdf')&&r.request().postDataJSON()?.action==='working');
 await page.getByRole('button',{name:'Generate Working Sheet',exact:true}).click();assert.equal((await workingPdf).status(),200);
 await expect(page.getByRole('link',{name:/Download/i})).toBeVisible();await page.getByRole('button',{name:'Close document viewer',exact:true}).click();
 // Current edits may be incomplete; a captured issue remains independently available.
 await page.locator('[data-sample-material-row]').first().getByLabel('%',{exact:true}).fill('10');await expect(card.getByRole('button',{name:'Generate Production Batch Blend Sheet'})).toBeEnabled();
 await card.getByLabel('Source formulation').selectOption('working');await expect(card.getByRole('button',{name:'Generate Production Batch Blend Sheet'})).toBeDisabled();await expect(card.getByText(/Unavailable: Incomplete chip composition/)).toBeVisible();
 // Read-only response variant exercises honest legacy availability without changing saved data.
 await page.route('**/rest/v1/rpc/list_samples',async route=>{const response=await route.fetch();const body=await response.json();for(const item of body){delete item.sample.formulation_state.profile.batchChipTargetLb;for(const issue of item.sample.issued_documents??[])delete issue.issued_snapshot.formulation_state.profile.batchChipTargetLb;}await route.fulfill({response,json:body});});
 await page.reload();await expect(card.getByRole('button',{name:'Generate Production Batch Blend Sheet'})).toBeDisabled();await card.getByLabel('Source formulation').selectOption(fixture.issueId);await expect(card.getByRole('button',{name:'Generate Production Batch Blend Sheet'})).toBeDisabled();
 assert.deepEqual(errors,[]);assert.ok(!requests.some(r=>/inventory|consum|reserv|stock/i.test(r.url)));
 console.log('Actual localhost Production UI passed: desktop/mobile, Batch default, working/issued PDFs, independent source selection, Working Sample, incomplete/legacy availability and no Inventory requests.');
}finally{await browser.close();}
