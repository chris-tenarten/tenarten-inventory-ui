import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
const fixture=JSON.parse(readFileSync('/private/tmp/tenops-production-blend-v11-review/server.json'));
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(15000);
 const library=page.waitForResponse(r=>r.url().includes('/rpc/list_samples'));
 await page.goto(fixture.route);const before=(await(await library).json()).find(r=>r.sample.id===fixture.sampleId).sample;
 const panel=page.locator('#workspace-panel-Sample');await expect(panel).toBeVisible();
 for(const name of ['Sample Name','Sample Size','Sample Quantity','Date Requested','Customer Name','Finish Requested'])await expect(page.getByLabel(name,{exact:true})).toHaveCount(0);
 for(const name of ['Color Plate / Formula #','Date Initiated','Requested By','Prepared By','Project Name','Customer','Finish','Approved Date','Notes'])await expect(panel.getByLabel(name,{exact:true})).toBeVisible();
 await page.getByLabel('Customer',{exact:true}).fill('Tenarten');await page.getByLabel('Finish',{exact:true}).fill('Honed');await page.getByLabel('Date Initiated',{exact:true}).fill('2026-10-06');await page.getByLabel('Notes',{exact:true}).fill('Match approved finish.');
 const save=page.waitForResponse(r=>r.url().includes('/rpc/save_sample_draft'));
 await page.getByRole('button',{name:'Save Changes',exact:true}).click();const response=await save;assert.equal(response.status(),200);const payload=response.request().postDataJSON();
 assert.equal(payload.p_sample_name,before.sample_name);assert.equal(payload.p_sample.sample_size,before.sample_size);assert.equal(payload.p_sample.sample_quantity,before.sample_quantity);assert.deepEqual(payload.p_sample.formulation_state,before.formulation_state);
 await expect(page.getByRole('button',{name:'Save Changes',exact:true})).toBeEnabled();await page.reload();await expect(page.getByLabel('Customer',{exact:true})).toHaveValue('Tenarten');await expect(page.getByLabel('Finish',{exact:true})).toHaveValue('Honed');await expect(page.getByLabel('Date Initiated',{exact:true})).toHaveValue('2026-10-06');await expect(page.getByLabel('Notes',{exact:true})).toHaveValue('Match approved finish.');
 await page.getByText('Legacy context',{exact:true}).click();if(before.sample_name)await expect(page.getByText(before.sample_name,{exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Sample Plate',exact:true}).click();await expect(page.getByText('Finished Plates',{exact:true}).first()).toBeVisible();await expect(page.getByText('Working Pour',{exact:true}).first()).toBeVisible();
 await page.getByRole('tab',{name:'Sample',exact:true}).click();mkdirSync('output/pdf/sample-context',{recursive:true});await page.screenshot({path:'output/pdf/sample-context/existing.png'});
 const generated=page.waitForResponse(r=>r.url().includes('generate-sample-pdf')&&r.request().postDataJSON()?.action==='generate');await page.getByRole('button',{name:'Generate Sample Work Order',exact:true}).click();assert.equal((await generated).status(),200);await expect(page.getByRole('button',{name:'Close document viewer',exact:true})).toBeVisible();await page.getByRole('button',{name:'Close document viewer',exact:true}).click();
 const writes=[];page.on('request',r=>{if(r.url().includes('/rpc/create_sample')||r.url().includes('/rpc/save_sample_draft'))writes.push(r.url());});await page.goto('http://localhost:3000/samples?open=new');await expect(page.getByRole('button',{name:'Save Sample',exact:true})).toBeVisible();await expect(page.getByLabel('Prepared By',{exact:true})).not.toHaveValue('');for(const name of ['Sample Name','Sample Size','Sample Quantity'])await expect(page.getByLabel(name,{exact:true})).toHaveCount(0);assert.deepEqual(writes,[]);await page.screenshot({path:'output/pdf/sample-context/new.png'});
 console.log('PASS existing/new Context fields, legacy metadata preserved on save, geometry state unchanged, save/reopen labels/values, Sample Plate authority visible, existing generation path, direct unsaved link without persistence.');
}finally{await browser.close();}
