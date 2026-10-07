import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch();const page=await browser.newPage();page.setDefaultTimeout(12000);
const writes=[];page.on('request',r=>{if(r.method()!=='GET'&&/save_sample|blend-issue/.test(r.url()+r.postData()))writes.push(r.url());});
try {
 // Supply disposable suggestion values through the existing recent-values read contract.
 await page.route('**/rpc/list_my_sample_recent_values',r=>r.fulfill({json:[{value:'Sherwin-Williams'},{value:'Terroxy'},{value:'MTT'}]}));
 await page.goto('http://localhost:3000/samples?open=53587d50-88c8-4b06-8c93-19dd99aa4feb');
 const adj=page.getByRole('spinbutton',{name:'ADJ (lb)',exact:true}),batches=page.getByRole('spinbutton',{name:'ADJD Batches',exact:true});
 const production=page.getByRole('region',{name:'Production Blend Sheet',exact:true});const cards=production.locator('fieldset > div');
 await expect(batches).toHaveValue('1');
 for(const key of ['Backspace','Delete','ControlOrMeta+A Backspace','ControlOrMeta+A Delete']){
  await adj.fill('0');await adj.press(key.startsWith('Control')?'ControlOrMeta+A':key==='Backspace'?'End':'Home');await adj.press(key.split(' ').at(-1));
  await expect(adj).toHaveValue('');await expect(cards.nth(1).locator('strong')).toHaveText('180 lb');await expect(cards.nth(2).locator('strong')).toHaveText('0.18');
  await expect(page.getByRole('button',{name:'Generate Blend Sheet',exact:true})).toBeEnabled();
  await adj.fill('40');await expect(cards.nth(1).locator('strong')).toHaveText('220 lb');
 }
 await batches.fill('');await expect(production).toContainText('Enter at least 1 Production Batch.');await batches.fill('2');await expect(cards.nth(1).locator('strong')).toHaveText('400 lb');
 await adj.fill('');await adj.blur();await expect(adj).toHaveValue('0');await expect(production).toContainText('100 lb (50 lb/Batch × 2 Batches)');await expect(production).toContainText('Part A: 10 US gal');
 console.log('PASS numeric blank/edit/blur, required Batch count, live totals and binder/Filler');
 const supplier=page.getByRole('combobox',{name:'Resin Supplier',exact:true});
 await supplier.fill('Sherwin-Williams');await supplier.press('Escape');await supplier.click();await page.getByRole('option',{name:'Terroxy',exact:true}).click();await expect(supplier).toHaveValue('Terroxy');
 await supplier.click();await expect(page.getByRole('option',{name:'Sherwin-Williams',exact:true})).toBeVisible();await supplier.press('Escape');await expect(supplier).toHaveValue('Terroxy');
 await supplier.fill('Sher');await supplier.press('ArrowDown');await supplier.press('Enter');await expect(supplier).toHaveValue('Sherwin-Williams');
 await supplier.locator('..').getByRole('button',{name:'Browse choices'}).click();await page.locator('#sample-context').click({position:{x:4,y:4}});await expect(supplier).toHaveValue('Sherwin-Williams');
 console.log('PASS recent-value shared combobox replacement, reopen, search/keyboard/Escape/click-away/chevron');
 const color=page.locator('[data-sample-material-row]').first().locator('.blend-color input');
 await color.click();await page.getByRole('option').filter({hasText:'Blue Glass'}).click();await expect(color).toHaveValue('Blue Glass');await color.click();await expect(page.getByRole('option').filter({hasText:'Blanco #1'})).toBeVisible();await color.press('Escape');await expect(color).toHaveValue('Blue Glass');
 console.log('PASS Sample Catalog selected material reopens alternatives without clearing');
 assert.equal(writes.length,0);
 // Inventory uses the same component with its own existing option source. Read-only browser fixture.
 await page.route('**/rest/v1/inventory_items?**',r=>r.fulfill({headers:{'content-range':'0-1/2'},json:[{id:901,color:'Blanco',vendor:'Sherwin-Williams',size:'1',quantity:50,unit:'lb',location:'Shop',category:'Aggregate'},{id:902,color:'Blue Glass',vendor:'Terroxy',size:'2',quantity:50,unit:'lb',location:'Shop',category:'Aggregate'}]}));
 await page.goto('http://localhost:3000/inventory');
 await page.locator('button[aria-controls="pending-receivals"]').click();
 await page.getByRole('button',{name:'+ Pending Receival',exact:true}).click();
 const vendor=page.getByRole('combobox',{name:'Vendor',exact:true}).first();await vendor.fill('Sherwin-Williams');await vendor.press('Escape');await vendor.click();await page.getByRole('option',{name:'Terroxy',exact:true}).click();await expect(vendor).toHaveValue('Terroxy');await vendor.click();await expect(page.getByRole('option',{name:'Sherwin-Williams',exact:true})).toBeVisible();await vendor.press('Escape');await expect(vendor).toHaveValue('Terroxy');
 console.log('PASS Inventory second shared consumer selection/reopen/cancel (read-only options fixture)');
} finally {await browser.close();}
