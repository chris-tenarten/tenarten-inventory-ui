import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
const fixture=JSON.parse(readFileSync('/private/tmp/tenops-production-blend-v11-review/server.json'));
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});const writes=[];
 page.on('request',r=>{if(/\/rpc\/(create_sample|save_sample_draft)$/.test(r.url()))writes.push(r.url());});
 // Inject historical text only into this browser response; do not mutate the fixture database.
 await page.route('**/rest/v1/rpc/list_samples',async route=>{const response=await route.fetch();const rows=await response.json();for(const r of rows)if(r.sample.id===fixture.sampleId)r.sample.more_notes='Retained historical shop instruction.';await route.fulfill({response,json:rows});});
 await page.goto(fixture.route);const summary=page.getByTestId('canonical-batch-summary');await expect(summary).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Notes',exact:true})).toHaveCount(1);await expect(page.getByRole('textbox',{name:'More Notes',exact:true})).toHaveCount(0);
 await page.getByText('Historical additional notes',{exact:true}).click();await expect(page.getByText('Retained historical shop instruction.',{exact:true})).toBeVisible();
 const values=()=>summary.locator('dd');await expect(values()).toHaveText(['180 lb','50 lb','5 US gal','1 US gal']);
 const first=page.locator('[data-sample-material-row]').first();const top=async el=>el.evaluate(e=>e.getBoundingClientRect().top);
 assert.ok(await top(page.locator('#formulation-materials'))<await top(summary));assert.ok(await top(summary)<await top(first));assert.equal(await first.evaluate(e=>e.getBoundingClientRect().height),46);
 await page.getByRole('spinbutton',{name:'Batch Filler (lb)',exact:true}).fill('100');await expect(values()).toHaveText(['130 lb','100 lb','5 US gal','1 US gal']);
 await page.getByRole('button',{name:'Restore Profile Default',exact:true}).click();await expect(values()).toHaveText(['180 lb','50 lb','5 US gal','1 US gal']);
 await expect(page.locator('#sample-plate')).toBeVisible();await expect(page.locator('#production-planning')).toBeVisible();assert.equal(writes.length,0);
 console.log('PASS one Notes editor; historical additional text retained read-only; setup/summary above rows; MTT 180/50/5/1; live Filler 100 → chips 130 and Restore; 46px rows; downstream sections; no persistence writes.');
}finally{await browser.close();}
