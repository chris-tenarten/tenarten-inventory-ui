import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
const directory='/private/tmp/tenops-sample-batch-review';
const {route}=JSON.parse(readFileSync(directory+'/server.json'));
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[],requests=[];
 page.on('dialog',dialog=>dialog.accept());
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto(route);const batch=page.getByRole('button',{name:'Batch',exact:true}),working=page.getByRole('button',{name:'Working Pour',exact:true});await working.waitFor();await page.waitForLoadState('networkidle');
 for(let i=0;i<5;i++)await page.locator('[data-sample-material-row]').nth(i).getByLabel('%',{exact:true}).fill(String([40,30,20,5,5][i]));
 await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByText('Sample saved.',{exact:true})).toBeVisible();await page.waitForLoadState('networkidle');
 const initial=await page.locator('input,select,textarea').evaluateAll(es=>es.map(e=>({value:e.value,disabled:e.disabled})));
 const initialWrites=(await (await page.request.get(new URL('/review/evidence',route).href)).json()).writes.length;const requestCount=requests.length;
 const start=performance.now();for(let i=0;i<10;i++){await batch.click();await expect(page.getByText('Batch chip target: 180 lb = 100%',{exact:true})).toBeVisible();await working.click();}
 const toggleMs=performance.now()-start;
 assert.equal(requests.length,requestCount,'toggle makes zero browser requests: '+JSON.stringify(requests.slice(requestCount)));assert.deepEqual(await page.locator('input,select,textarea').evaluateAll(es=>es.map(e=>({value:e.value,disabled:e.disabled}))),initial);
 assert.equal((await (await page.request.get(new URL('/review/evidence',route).href)).json()).writes.length,initialWrites);
 await batch.click();assert.deepEqual(await page.locator('output').allTextContents(),['72 lb','54 lb','36 lb','9 lb','9 lb','45 lb','≈ 5.273438 gal','≈ 1.054688 gal']);
 await batch.scrollIntoViewIfNeeded();await page.screenshot({path:directory+'/batch-desktop.png'});
 const rows=page.locator('[data-sample-material-row]');
 // Preserve five material rows; zero-share rows remain legitimate authored entries.
 for(const [blend,expected] of [[[50,25,25,0,0],['90 lb','45 lb','45 lb','0 lb','0 lb']],[[30,40,30,0,0],['54 lb','72 lb','54 lb','0 lb','0 lb']]]){
  for(let i=0;i<5;i++)await rows.nth(i).getByLabel('%',{exact:true}).fill(String(blend[i]));
  assert.deepEqual((await page.locator('output').allTextContents()).slice(0,5),expected);
  await working.click();await batch.click();for(let i=0;i<5;i++)await expect(rows.nth(i).getByLabel('%',{exact:true})).toHaveValue(String(blend[i]));
 }
 await rows.first().getByLabel('%',{exact:true}).fill('10');await expect(page.getByText('Incomplete chip composition: 80% of 100%.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('button',{name:'Save',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Formal Issue',exact:true}).click();await expect(page.getByText(/Adjust them to 100% before continuing/i).first()).toBeVisible();
 // Reload returns to Working Pour and retains the incomplete draft.
 await page.reload();await expect(working).toHaveAttribute('aria-pressed','true');await batch.click();await expect(page.getByText('Incomplete chip composition: 80% of 100%.',{exact:true})).toBeVisible();
 for(let i=0;i<5;i++)await rows.nth(i).getByLabel('%',{exact:true}).fill(String([40,30,20,5,5][i]));
 await page.getByLabel('Sample Quantity (document metadata)',{exact:true}).fill('2');await expect(page.getByTestId('working-pour-chip-mix')).toHaveText('64 oz');await page.getByLabel('Sample Quantity (document metadata)',{exact:true}).fill('1');
 await page.getByRole('button',{name:'Adjust Sample Plate Calculation',exact:true}).click();await page.getByLabel('Finished Pieces',{exact:true}).fill('1');await expect(page.getByTestId('working-pour-chip-mix')).toHaveText('64 oz');await page.getByLabel('Finished Pieces',{exact:true}).fill('4');
 await page.getByLabel('Working Pour Width',{exact:true}).fill('6');await page.getByLabel('Working Pour Length',{exact:true}).fill('6');await expect(page.getByTestId('working-pour-chip-mix')).toHaveText('16 oz');assert.equal(await page.locator('output').first().innerText(),'72 lb');
 await page.getByLabel('Working Pour Width',{exact:true}).fill('12');await page.getByLabel('Working Pour Length',{exact:true}).fill('12');
 const profile=page.getByLabel('Formulation Profile',{exact:true});const sherwin=await profile.locator('option').evaluateAll(es=>es.find(e=>e.textContent.includes('Sherwin')).value);await profile.selectOption(sherwin);await expect(page.getByRole('button',{name:'Apply configured profile',exact:true})).toBeVisible();await expect(page.getByText('Batch chip target: 180 lb = 100%',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Apply configured profile',exact:true}).click();await expect(page.getByText('Batch chip target not configured',{exact:true})).toBeVisible();
 const mtt=await profile.locator('option').evaluateAll(es=>es.find(e=>e.textContent==='MTT — 5:1').value);await profile.selectOption(mtt);await page.getByRole('button',{name:'Apply configured profile',exact:true}).click();await expect(page.getByText('Batch chip target: 180 lb = 100%',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Close Calculation Settings',exact:true}).click();await page.getByRole('button',{name:'Save',exact:true}).click();await page.waitForLoadState('networkidle');
 await Promise.all([page.waitForResponse(r=>r.url().includes('generate-sample-pdf')&&r.status()===200),page.getByRole('button',{name:'Generate Working Sheet',exact:true}).click()]);await page.waitForTimeout(300);
 await page.getByRole('button',{name:'Close document viewer',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await batch.scrollIntoViewIfNeeded();await page.screenshot({path:directory+'/batch-phone.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'no horizontal overflow');
 await working.click();await working.scrollIntoViewIfNeeded();await page.screenshot({path:directory+'/working-phone.png'});assert.equal(errors.length,0,errors.join('\n'));
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('button',{name:'New Sample',exact:true}).click();await expect(working).toHaveAttribute('aria-pressed','true');await batch.click();await expect(page.getByText('Batch chip target: 180 lb = 100%',{exact:true})).toBeVisible();await expect(rows.first().getByLabel('%',{exact:true})).toHaveValue('');
 await page.getByRole('button',{name:'Formulation Profiles',exact:true}).click();await page.getByRole('button',{name:'Edit MTT',exact:true}).click();await expect(page.getByLabel('Batch chip target (lb)',{exact:true})).toHaveValue('180');
 writeFileSync(directory+'/browser-evidence.json',JSON.stringify({route,toggleCycles:10,toggleMs,additionalToggleRequests:0,additionalToggleWrites:0,blends:['40/30/20/5/5','50/25/25','30/40/30'],incompleteDraftSaved:true,issueRejected:true,geometryAndMetadataSeparated:true,profilePreviewAndFallback:true,phoneOverflow:false,pageErrors:errors},null,2));
 console.log('Actual UI Batch browser gate passed', {toggleMs,route});
}finally{await browser.close();}
