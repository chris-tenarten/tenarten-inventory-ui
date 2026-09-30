import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
const output='/private/tmp/tenops-sample-batch-review';
const {sampleId}=JSON.parse(readFileSync(`${output}/server.json`));
const route=`http://localhost:3000/samples?open=${sampleId}`;
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto(route);
 await page.getByRole('button',{name:'Working Pour',exact:true}).click();await expect(page.locator('[data-welcome-hero]')).toBeHidden({timeout:20000});
 const rows=page.locator('[data-sample-material-row]');
 for(let i=0;i<5;i++)await expect(rows.nth(i).locator('span').first()).toHaveText(`Aggregate ${i+1} · Manual`);
 for(const [index,role] of [[5,'Filler'],[6,'Resin'],[7,'Hardener']])await expect(rows.nth(index).locator('span').first()).toHaveText(`${role} · Manual`);
 for(const [i,color] of ['Blanco #1','Blanco #2','MOP','True Grey #1','True Grey #2','ATF-20','Resin','Hardener'].entries())await expect(rows.nth(i).getByRole('combobox',{name:'Color',exact:true})).toHaveValue(color);
 const visibleInputs=await page.locator('input,textarea').evaluateAll(es=>es.map(e=>e.value));assert.ok(!visibleInputs.some(v=>/Operator-authored local|Local fixture|\(local fixture\)|LOCAL REVIEW|Browser /i.test(v)));
 await expect(rows.first().getByText(/^Calculated$/i)).toBeVisible();await expect(rows.first().getByText('40% × 64 oz Chip Mix',{exact:true})).toBeVisible();
 for(const index of [5,6])await expect(rows.nth(index).getByText(/^Profile Default$/)).toBeVisible();await expect(rows.nth(7).getByText('Calculated from 5:1',{exact:true})).toBeVisible();
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await rows.first().evaluate(e=>e.scrollIntoView({block:'center'}));await rows.first().screenshot({path:`${output}/row-cleanup-${width}.png`});}
 await page.getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('button',{name:'New Sample',exact:true}).click();
 await expect(rows.first().getByRole('combobox',{name:'Color',exact:true})).toHaveValue('');await rows.first().getByLabel('%',{exact:true}).fill('100');await expect(rows.first().getByText('100% × 64 oz Chip Mix',{exact:true})).toBeVisible();
 const color=rows.first().getByPlaceholder('Type or search Catalog');await expect(color).toHaveAttribute('placeholder','Type or search Catalog');await color.fill('Blanco');await expect(color).toHaveValue('Blanco');
 // A read-only catalog-backed fixture proves the existing source label is preserved.
 await page.route('**/rest/v1/rpc/list_samples',async r=>{const response=await r.fetch();const body=await response.json();const row=body.find(item=>item.sample.id===sampleId).sample.blend_rows[0];row.catalog_item_id='00000000-0000-4000-8000-000000000001';await r.fulfill({response,json:body});});await page.goto(route);await expect(rows.first().locator('span').first()).toHaveText('Aggregate 1 · Catalog-assisted');await expect(rows.first().getByRole('combobox',{name:'Color',exact:true})).toHaveValue('Blanco #1');
 console.log('Row presentation passed: natural role labels, preserved manual/catalog status and quantity provenance, unchanged operational Colors, empty new Color and manual entry. No Samples saved.');
}finally{await browser.close();}
