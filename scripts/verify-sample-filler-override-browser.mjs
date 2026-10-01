import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
const origin='http://localhost:3000',dir='output/pdf/filler-override';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/samples');await expect(page.locator('[data-welcome-hero="true"]')).toBeHidden({timeout:30000});
 await page.getByRole('button',{name:'New Sample',exact:false}).click();
 await expect(page.getByRole('button',{name:'Batch',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByLabel('Batch Filler (lb)',{exact:true})).toHaveValue('50');
 await page.getByLabel('Sample Name',{exact:false}).fill('MTT Filler review');await page.getByLabel('Prepared By',{exact:true}).fill('Marcos');
 const rows=page.locator('[data-sample-material-row]');
 for(let i=1;i<5;i++)await page.getByRole('button',{name:'Add Aggregate',exact:true}).click();
 for(const [i,p] of [40,30,20,5,5].entries()){
  const row=rows.nth(i);await row.getByLabel('%',{exact:true}).fill(String(p));
  await row.getByPlaceholder('Type or search Catalog').fill(i===1?'Blue':'Blanco');
  await row.getByRole('listbox',{name:'Catalog matches'}).getByRole('option').first().click();
 }
 for(const [i,term] of [[5,'ATF'],[6,'Resin'],[7,'Hardener']]){
  const row=rows.nth(i);await row.getByPlaceholder('Type or search Catalog').fill(term);await row.getByRole('listbox',{name:'Catalog matches'}).getByRole('option').first().click();
 }
 const percentages=()=>rows.locator('input').evaluateAll(inputs=>inputs.filter(i=>i.closest('label')?.textContent?.trim()==='%').map(i=>i.value));
 assert.deepEqual(await percentages(),['40','30','20','5','5']);
 await expect(page.getByTestId('batch-reference-yield')).toContainText('45 SF');
 await expect(page.getByTestId('working-pour-chip-mix')).toContainText('64 oz');
 await page.getByLabel('Batch Filler (lb)',{exact:true}).fill('100');
 await expect(page.getByTestId('batch-summary')).toContainText('130 lb');
 assert.deepEqual(await percentages(),['40','30','20','5','5']);
 assert.deepEqual(await page.getByLabel('aggregate Batch quantity',{exact:true}).allTextContents(),['52 lb','39 lb','26 lb','6.5 lb','6.5 lb']);
 await expect(page.getByLabel('resin Batch quantity',{exact:true})).toHaveText('5 gal');await expect(page.getByLabel('hardener Batch quantity',{exact:true})).toHaveText('1 gal');
 await page.getByRole('button',{name:'Working Pour',exact:true}).click();
 await expect(page.getByLabel('filler quantity',{exact:true})).toHaveValue('35.555556');
 await expect(page.getByLabel('resin quantity',{exact:true})).toHaveValue('14.222222');
 await expect(page.getByLabel('hardener quantity',{exact:true})).toHaveValue('2.844444');
 await expect(page.getByTestId('working-pour-chip-mix')).toContainText('46.2222 oz');
 const saveResponse=page.waitForResponse(r=>r.url().includes('/rpc/save_sample_draft'));await page.getByRole('button',{name:'Save',exact:true}).click();const savedResponse=await saveResponse;assert.equal(savedResponse.status(),200,await savedResponse.text());const saved=savedResponse.request().postDataJSON();const id=saved.p_sample.id;
 assert.deepEqual(saved.p_rows.filter(r=>r.component_role==='aggregate').map(r=>r.catalog_item_id),['local-catalog-0','local-catalog-1','local-catalog-0','local-catalog-0','local-catalog-0']);
 const route=origin+'/samples?open='+id;await page.goto(route);await expect(page.getByLabel('Batch Filler (lb)',{exact:true})).toHaveValue('100');
 await page.getByRole('button',{name:'Restore Profile Default',exact:true}).click();await expect(page.getByTestId('working-pour-chip-mix')).toContainText('64 oz');assert.deepEqual(await percentages(),['40','30','20','5','5']);
 await page.getByRole('button',{name:'Working Pour',exact:true}).click();await expect(page.getByLabel('filler quantity',{exact:true})).toHaveValue('18');await expect(page.getByLabel('resin quantity',{exact:true})).toHaveValue('15');await expect(page.getByLabel('hardener quantity',{exact:true})).toHaveValue('3');
 // Manual shop filler remains downstream.
 const filler=rows.nth(5);await filler.getByRole('button',{name:'Enter manually',exact:true}).click();await page.getByLabel('filler quantity',{exact:true}).fill('36');await expect(page.getByTestId('working-pour-chip-mix')).toContainText('64 oz');
 await page.getByRole('button',{name:'Batch',exact:true}).click();await expect(page.getByLabel('filler Batch quantity',{exact:true})).toHaveText('50 lb');
 await page.getByLabel('Batch Filler (lb)',{exact:true}).fill('100');
 async function pdf(button,action,filename){const response=page.waitForResponse(r=>r.url().includes('/functions/v1/generate-sample-pdf')&&r.request().postDataJSON()?.action===action);await page.getByRole('button',{name:button,exact:true}).click();const r=await response;assert.equal(r.status(),200,await r.text());await expect(page.getByRole('button',{name:'Close document viewer',exact:true})).toBeVisible();const href=await page.getByRole('link',{name:/Download/i}).getAttribute('href');const bytes=await page.evaluate(async u=>Array.from(new Uint8Array(await(await fetch(u)).arrayBuffer())),href);assert.equal(Buffer.from(bytes).subarray(0,4).toString(),'%PDF');writeFileSync(dir+'/'+filename,Buffer.from(bytes));await page.getByRole('button',{name:'Close document viewer',exact:true}).click();}
 await pdf('Generate Working Sheet','working','MTT-modified-Working-Sample-review.pdf');await pdf('Generate Production Batch Blend Sheet','batch-working','MTT-modified-Production-Batch-review.pdf');
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:1100});await page.getByLabel('Batch Filler (lb)',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:dir+`/filler-${width}.png`});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await page.setViewportSize({width:1440,height:1100});await page.goto(route);await expect(page.getByLabel('Batch Filler (lb)',{exact:true})).toHaveValue('100');
 await expect(page.getByTestId('primary-resin-system').getByLabel('Resin System',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Adjust Sample Plate Calculation',exact:true}).click();await expect(page.getByLabel('Resin System',{exact:true})).toHaveCount(1);await expect(page.getByLabel('Formulation Profile',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Close Calculation Settings',exact:true}).click();
 const selector=page.getByLabel('Resin System',{exact:true});const sherwin=await selector.locator('option').filter({hasText:'Sherwin — 4:1'}).first().getAttribute('value');await selector.selectOption(sherwin);await page.getByRole('button',{name:'Apply configured profile',exact:true}).click();
 await expect(page.getByLabel('Batch Filler (lb)',{exact:true})).toHaveValue('50');await expect(page.getByTestId('batch-summary')).toContainText('150 lb');
 await page.getByLabel('Batch Filler (lb)',{exact:true}).fill('100');await expect(page.getByTestId('batch-summary')).toContainText('100 lb');assert.deepEqual(await percentages(),['40','30','20','5','5']);await expect(page.getByRole('button',{name:'Generate Production Batch Blend Sheet',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Working Pour',exact:true}).click();await expect(page.getByLabel('resin quantity',{exact:true})).toHaveValue('16');await expect(page.getByLabel('hardener quantity',{exact:true})).toHaveValue('4');
 await page.getByRole('button',{name:'Batch',exact:true}).click();await page.getByRole('button',{name:'Restore Profile Default',exact:true}).click();await expect(page.getByTestId('batch-summary')).toContainText('150 lb');await expect(page.getByLabel('Batch Filler (lb)',{exact:true})).toHaveValue('50');
 // Reload the saved MTT review recipe; profile switch tests do not overwrite it.
 await page.goto(route);await expect(page.getByLabel('Batch Filler (lb)',{exact:true})).toHaveValue('100');
 writeFileSync(dir+'/browser-result.json',JSON.stringify({route,id,errors,catalog:'two aggregate identities plus filler/resin/hardener; metadata retained on save',percentages:[40,30,20,5,5]},null,2));assert.deepEqual(errors,[]);
 console.log('PASS actual localhost UI: new/save/reopen/restore, catalog identities, unchanged percentages/binder, exact modified shop defaults, shop isolation, PDFs, desktop/mobile; '+route);
}finally{await browser.close();}
