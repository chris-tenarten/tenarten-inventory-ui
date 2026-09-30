import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
const fixture=JSON.parse(readFileSync('/private/tmp/tenops-sample-batch-review/batch-first-review.json'));
const dir='output/pdf/batch-first';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(fixture.url);await expect(page.getByRole('button',{name:'Batch',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('[data-welcome-hero="true"]')).toBeHidden({timeout:20000});
 await expect(page.getByTestId('batch-reference-yield')).toContainText('45 SF');await expect(page.getByTestId('working-pour-chip-mix')).toContainText('64 oz');
 await expect(page.getByRole('button',{name:'Adjust Formulation',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Working Pour',exact:true}).click();
 await expect(page.getByLabel('filler quantity',{exact:true})).toHaveValue('18');await expect(page.getByLabel('resin quantity',{exact:true})).toHaveValue('15');await expect(page.getByLabel('hardener quantity',{exact:true})).toHaveValue('3');
 await expect(page.getByText(/Shop preparation dry quantity: 82.00 oz/)).toBeVisible();
 const filler=page.locator('[data-sample-material-row]').filter({has:page.getByLabel('filler quantity',{exact:true})});
 await filler.getByRole('button',{name:'Enter manually',exact:true}).click();await page.getByLabel('filler quantity',{exact:true}).fill('64');
 await expect(page.getByTestId('working-pour-chip-mix')).toContainText('64 oz');await expect(page.getByText(/Shop preparation dry quantity: 128.00 oz/)).toBeVisible();
 await page.getByRole('button',{name:'Batch',exact:true}).click();await expect(page.getByLabel('filler Batch quantity',{exact:true})).toHaveText('50 lb');
 await page.getByRole('button',{name:'Working Pour',exact:true}).click();await filler.getByRole('button',{name:'Use profile default',exact:true}).click();
 // Search real catalog, independently on two aggregate rows; supplier matches retain identity.
 const aggregates=page.locator('[data-sample-material-row]').filter({has:page.getByLabel('aggregate quantity',{exact:true})});
 for(const [i,term] of [[0,'Blanco Mexicano'],[1,'Blue']]){
  const row=aggregates.nth(i);await row.getByPlaceholder('Type or search Catalog').fill(term);
  const options=row.getByRole('listbox',{name:'Catalog matches'}).getByRole('option');await expect(options.first()).toBeVisible();await options.first().click();
 }
 for(const [role,term] of [['filler','ATF'],['resin','Resin']]){
  const row=page.locator('[data-sample-material-row]').filter({has:page.getByLabel(`${role} quantity`,{exact:true})});await row.getByPlaceholder('Type or search Catalog').fill(term);const options=row.getByRole('listbox',{name:'Catalog matches'}).getByRole('option');await expect(options.first()).toBeVisible();await options.first().click();
 }
 await page.getByRole('button',{name:'Batch',exact:true}).click();await page.getByRole('button',{name:'Working Pour',exact:true}).click();await expect(page.getByLabel('filler quantity',{exact:true})).toHaveValue('18');
 async function generate(button,action,filename){
  const response=page.waitForResponse(r=>r.url().includes('/functions/v1/generate-sample-pdf')&&r.request().postDataJSON()?.action===action);await page.getByRole('button',{name:button,exact:true}).click();const r=await response;assert.equal(r.status(),200,await r.text());await expect(page.getByRole('button',{name:'Close document viewer',exact:true})).toBeVisible();const href=await page.getByRole('link',{name:/Download/i}).getAttribute('href');const bytes=await page.evaluate(async url=>Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer())),href);assert.equal(Buffer.from(bytes).subarray(0,4).toString(),'%PDF');writeFileSync(`${dir}/${filename}`,Buffer.from(bytes));await page.getByRole('button',{name:'Close document viewer',exact:true}).click();
 }
 await generate('Generate Working Sheet','working','MTT-Working-Sample-review.pdf');
 await generate('Generate Production Batch Blend Sheet','batch-working','MTT-Production-Batch-review.pdf');
 page.on('dialog',dialog=>dialog.accept());
 const issuedResponse=page.waitForResponse(r=>r.url().includes('/rpc/issue_sample_form'));await page.getByRole('button',{name:'Formal Issue',exact:true}).click();assert.equal((await issuedResponse).status(),200);
 await expect(page.getByRole('button',{name:'Close document viewer',exact:true})).toBeVisible();await page.getByRole('button',{name:'Close document viewer',exact:true}).click();
 await page.goto(fixture.url);await expect(page.getByRole('button',{name:'Working Pour',exact:true})).toBeVisible();await page.getByRole('button',{name:'Working Pour',exact:true}).click();
 const source=page.getByLabel('Source formulation');const issuedOption=await source.locator('option').last().getAttribute('value');await source.selectOption(issuedOption);
 await generate('Generate Production Batch Blend Sheet','batch-issued','MTT-Production-Batch-issued-review.pdf');
 await source.selectOption('working');

 for(const width of [1440,390,320]){await page.setViewportSize({width,height:1100});await page.getByTestId('working-pour-chip-mix').scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/review-${width}.png`});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await page.setViewportSize({width:1440,height:1100});await page.goto('http://localhost:3000/samples');await page.getByRole('button',{name:'New Sample',exact:false}).click();await expect(page.getByRole('button',{name:'Batch',exact:true})).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'Working Pour',exact:true}).click();await expect(page.getByLabel('filler quantity',{exact:true})).toHaveValue('18');

 await page.getByLabel('Sample Name').fill('Sherwin — Working Sample');
 await page.getByRole('button',{name:'Adjust Sample Plate Calculation',exact:true}).click();
 await page.getByRole('button',{name:'Configure profiles',exact:true}).click();await page.getByRole('button',{name:'Edit MTT',exact:true}).click();await expect(page.getByLabel('Canonical Batch filler (lb)',{exact:true})).toHaveValue('50');await expect(page.getByLabel('Canonical Batch Part A (US gal)',{exact:true})).toHaveValue('5');await page.getByRole('button',{name:'Close profiles',exact:true}).click();
 await expect(page.getByLabel('Batch reference chip loading',{exact:false})).toHaveAttribute('readonly','');
 const profile=page.getByLabel('Formulation Profile',{exact:true});const sherwin=await profile.locator('option').filter({hasText:'Sherwin — 4:1'}).first().getAttribute('value');await profile.selectOption(sherwin);await page.getByRole('button',{name:'Apply configured profile',exact:true}).click();
 await expect(page.getByLabel('resin quantity',{exact:true})).toHaveValue('16');await expect(page.getByLabel('hardener quantity',{exact:true})).toHaveValue('4');await expect(page.getByRole('button',{name:'Generate Production Batch Blend Sheet',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Close Calculation Settings',exact:true}).click();
 await page.locator('[data-sample-material-row]').first().getByLabel('%',{exact:true}).fill('100');await page.locator('[data-sample-material-row]').first().getByPlaceholder('Type or search Catalog').fill('White');await page.getByTestId('working-pour-chip-mix').click();
 await generate('Generate Working Sheet','working','Sherwin-Working-Sample-review.pdf');
 assert.deepEqual(errors,[]);console.log('PASS actual localhost UI: Batch default, MTT provenance, 18/82 shop baseline, filler isolation, aggregate Blue/Blanco + ATF/Resin catalog, working/issued PDFs, formal issue, profile editor, Sherwin Sample-only, desktop/mobile and New Sample');
}finally{await browser.close();}
