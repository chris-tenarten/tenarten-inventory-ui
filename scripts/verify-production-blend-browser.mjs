import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
const fixture=JSON.parse(readFileSync('/private/tmp/tenops-production-blend-review/server.json'));
const output='output/pdf/production-blend';mkdirSync(output,{recursive:true});
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],writes=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')writes.push(r.postDataJSON());});
 await page.goto(fixture.route);await expect(page.locator('[data-welcome-hero="true"]')).toBeHidden({timeout:25000});
 const card=page.getByRole('region',{name:'Production Blend Sheet'});await expect(card).toBeVisible({timeout:25000});
 await card.getByRole('button',{name:'Plan Production Blend',exact:true}).click();
 await card.getByLabel('Saved Production plans').selectOption({index:1});
 await expect(card.getByLabel('Batch Count',{exact:true})).toHaveValue('60');
 await expect(card.getByText('10,800 lb',{exact:true})).toBeVisible();await expect(card.getByText('+1,200 lb',{exact:true})).toBeVisible();
 const initialPercent=await card.locator('tbody tr td:nth-child(4)').allTextContents();
 await card.getByLabel('Planned Quantity',{exact:true}).fill('13000');await expect(card.getByText('+2,200 lb',{exact:true})).toBeVisible();await expect(card.getByText('300 US gal',{exact:true})).toBeVisible();
 await card.getByLabel('Blend Size',{exact:true}).fill('500');await expect(card.getByText('26',{exact:true})).toBeVisible();await expect(card.locator('tbody tr').first()).toContainText('1.75');await expect(card.locator('tbody tr').first()).toContainText('87.5');
 assert.deepEqual(await card.locator('tbody tr td:nth-child(4)').allTextContents(),initialPercent);
 await card.getByRole('button',{name:'Save Blend Plan',exact:true}).click();await expect(card.getByRole('button',{name:'Save Blend Plan',exact:true})).toBeEnabled();
 await page.reload();await card.getByRole('button',{name:'Plan Production Blend',exact:true}).click();await card.getByLabel('Saved Production plans').selectOption({index:1});await expect(card.getByLabel('Planned Quantity',{exact:true})).toHaveValue('13000');await expect(card.getByLabel('Blend Size',{exact:true})).toHaveValue('500');
 await card.getByLabel('Planned Quantity',{exact:true}).fill('1');await expect(card.getByRole('button',{name:'Issue Production Blend',exact:true})).toBeDisabled();await expect(card.getByRole('alert')).toContainText('below the calculated');
 await card.getByLabel('Planned Quantity',{exact:true}).fill('12000');await card.getByLabel('Blend Size',{exact:true}).fill('1000');
 for(const width of [1440,390]){await page.setViewportSize({width,height:1100});await card.scrollIntoViewIfNeeded();await card.screenshot({path:`${output}/editor-${width}.png`});assert.ok(await card.locator('p,button').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)));}
 await page.setViewportSize({width:1440,height:1100});
 async function generate(label,file){const pending=page.waitForResponse(r=>r.url().includes('generate-sample-pdf')&&r.request().postDataJSON()?.action==='blend-pdf');await card.getByRole('button',{name:label,exact:true}).click();const response=await pending;assert.equal(response.status(),200);writeFileSync(`${output}/${file}.pdf`,await response.body());await expect(page.getByRole('link',{name:/Download/i})).toBeVisible();await page.getByRole('button',{name:'Close document viewer',exact:true}).click();}
 await generate('Generate Working Production Blend PDF','Agawam-UI-working');
 await card.getByRole('button',{name:'Issue Production Blend',exact:true}).click();await expect(card.getByLabel('Batch Count',{exact:true})).toBeDisabled();await generate('Generate Issued Production Blend PDF','Agawam-UI-issued');
 await page.reload();await card.getByRole('button',{name:'Plan Production Blend',exact:true}).click();await card.getByLabel('Saved Production plans').selectOption({index:1});await expect(card.getByLabel('Batch Count',{exact:true})).toBeDisabled();
 await card.getByRole('button',{name:'New Blend Plan',exact:true}).click();await expect(card.getByLabel('Batch Count',{exact:true})).toBeEnabled();await card.getByLabel('Batch Count',{exact:true}).fill('2');await card.getByLabel('Planned Quantity',{exact:true}).fill('400');await expect(card.getByText('360 lb',{exact:true})).toBeVisible();
 assert.ok(!writes.some(b=>/inventory|reservation|consumption/i.test(b?.action||'')));assert.deepEqual(errors,[]);
 console.log('PASS actual TenOps UI: saved source, deterministic inputs, unchanged percentages, fractional package conversion, binder isolation, save/reopen, warning/issue, working/issued PDF, immutable issue, desktop/mobile, new plan');
}catch(e){console.error(e);throw e;}finally{await browser.close();}
