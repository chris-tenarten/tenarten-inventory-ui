import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch();const page=await browser.newPage();page.setDefaultTimeout(12000);
try {
 await page.goto('http://localhost:3000/samples?open=53587d50-88c8-4b06-8c93-19dd99aa4feb');
 await expect(page.getByRole('button',{name:'Duplicate',exact:true})).toBeVisible();
 const copied=page.waitForResponse(r=>r.url().includes('/rpc/duplicate_sample'));
 await page.getByRole('button',{name:'Duplicate',exact:true}).click();
 const copy=await(await copied).json();const id=typeof copy==='string'?copy:copy.id;assert.ok(id);
 await expect(page.getByText('Created a new Sample draft.',{exact:false})).toBeVisible();
 const row=role=>page.locator(`[data-sample-material-row][data-role="${role}"]`).first();
 const filler=row('filler'),color=filler.locator('.blend-color input'),vendor=filler.getByRole('combobox',{name:'Vendor',exact:true});
 await color.fill('ATF-20');await page.getByRole('option').filter({hasText:'ATF-20'}).click();await expect(vendor).toHaveValue('Sherwin-Williams');
 const system=await page.getByRole('combobox',{name:'Resin System',exact:true}).inputValue();
 const identity=await row('hardener').locator('.blend-color input').inputValue();
 await vendor.fill('Alternate local supplier');await vendor.press('Escape');await expect(color).toHaveValue('ATF-20');await expect(filler).toContainText('Catalog SKU/package belongs to Sherwin-Williams');
 await row('hardener').getByRole('combobox',{name:'Vendor',exact:true}).fill('Alternate binder supplier');
 await expect(row('hardener').locator('.blend-color input')).toHaveValue(identity);await expect(page.getByRole('combobox',{name:'Resin System',exact:true})).toHaveValue(system);
 const supplier=page.getByRole('combobox',{name:'Resin Supplier',exact:true});await supplier.click();
 const options=await supplier.locator('..').getByRole('option').allTextContents();assert.ok(options.some(x=>x.includes('Sherwin-Williams')));assert.ok(!options.some(x=>x.includes('Key Resin')),'A profile name without a vendor record must not enter vendor suggestions');
 await supplier.press('Escape');await supplier.fill('Independent supplier');await supplier.press('Escape');await expect(page.getByRole('combobox',{name:'Resin System',exact:true})).toHaveValue(system);
 const beforeSave=page.waitForResponse(r=>r.url().includes('/rpc/save_sample_draft'));
 await page.getByRole('button',{name:'Save Changes',exact:true}).click();const response=await beforeSave;assert.equal(response.status(),200);
 const payload=response.request().postDataJSON();const rows=payload.p_rows;const savedFiller=rows.find(r=>r.component_role==='filler');assert.equal(savedFiller.color,'ATF-20');assert.equal(savedFiller.vendor,'Alternate local supplier');assert.ok(savedFiller.catalog_item_id);assert.equal(savedFiller.catalog_snapshot.vendor,'Sherwin-Williams');assert.ok(savedFiller.catalog_snapshot.vendor_sku);
 await page.goto(`http://localhost:3000/samples?open=${id}`);await expect(color).toHaveValue('ATF-20');await expect(vendor).toHaveValue('Alternate local supplier');await expect(row('hardener').getByRole('combobox',{name:'Vendor',exact:true})).toHaveValue('Alternate binder supplier');await expect(row('hardener').locator('.blend-color input')).toHaveValue(identity);
 console.log(`PASS ATF-20 default, independent Filler/binder overrides, vendor source, package warning/evidence, save/reopen. Disposable review: http://localhost:3000/samples?open=${id}`);
} finally {await browser.close();}
