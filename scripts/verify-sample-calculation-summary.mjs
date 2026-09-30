import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
const output='/private/tmp/tenops-sample-batch-review';
const {sampleId}=JSON.parse(readFileSync(`${output}/server.json`));
const route=`http://localhost:3000/samples?open=${sampleId}`;
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto(route);
 const summary=page.locator('[data-sample-tutorial="chip-summary"]');

 await expect(summary.getByRole('heading',{name:'Sample Plate Calculation'})).toBeVisible();
 await expect(summary.getByText('180 lb chips = 100%',{exact:true})).toBeVisible();
 await expect(summary.getByText('4 lb chips/SF at this pour thickness',{exact:true})).toBeVisible();
 await expect(summary.getByTestId('working-pour-chip-mix')).toHaveText('64 oz');
 assert.ok(!(await summary.innerText()).includes('45 SF'),'no unsupported reference yield');
 await page.getByRole('button',{name:'Working Pour',exact:true}).click();
 await expect(page.locator('[data-welcome-hero]')).toBeHidden({timeout:20000});
 for(const width of [1440,768,390,320]) {
  await page.setViewportSize({width,height:1000});await summary.evaluate(e=>e.scrollIntoView({block:'center'}));
  for(const label of ['Finished Plates','Working Pour','Batch Basis','Working Pour Chip Mix'])await expect(summary.getByText(label,{exact:true})).toBeVisible();
  const bounds=await summary.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);
  assert.ok(await summary.locator('dd').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth&&e.scrollHeight<=e.clientHeight&&getComputedStyle(e).textOverflow!=='ellipsis')));
  await summary.screenshot({path:`${output}/calculation-summary-${width}.png`});
 }
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Adjust Sample Plate Calculation',exact:true}).click();
 await page.getByLabel('Working Pour Width',{exact:true}).fill('6');await page.getByLabel('Working Pour Length',{exact:true}).fill('6');
 await expect(summary.getByTestId('working-pour-chip-mix')).toHaveText('16 oz');await expect(summary.getByText('180 lb chips = 100%',{exact:true})).toBeVisible();
 await page.getByLabel(/^Thickness/).fill('0.5');await expect(summary.getByText('5.3333 lb chips/SF at this pour thickness',{exact:true})).toBeVisible();await expect(summary.getByTestId('working-pour-chip-mix')).toHaveText('21.3333 oz');
 const select=page.getByLabel('Formulation Profile',{exact:true});await select.selectOption(await select.locator('option').evaluateAll(es=>es.find(e=>e.textContent.includes('Sherwin')).value));await page.getByRole('button',{name:'Apply configured profile',exact:true}).click();await expect(summary.getByText('Batch basis not captured',{exact:true})).toBeVisible();assert.ok(!(await summary.innerText()).includes('180'));assert.ok(!(await summary.innerText()).includes('45 SF'));
 // Read-only legacy fixture response; no persisted data or product behavior changes.
 await page.route('**/rest/v1/rpc/list_samples',async r=>{const response=await r.fetch();const body=await response.json();for(const item of body){delete item.sample.formulation_state.profile.batchChipTargetLb;item.sample.formulation_state.calculationVersion='sample-formulation-v1';}await r.fulfill({response,json:body});});
 await page.reload();await expect(summary.getByText('Batch basis not captured',{exact:true})).toBeVisible();assert.ok(!(await summary.innerText()).includes('lb chips/SF at this pour thickness'));
 console.log('Summary browser checks passed: captured Batch basis, no assumed reference yield, current-thickness rate, geometry-only quantity change, Sherwin/legacy fallbacks, 1440/768/390/320px. No data saved.');
}finally{await browser.close();}
