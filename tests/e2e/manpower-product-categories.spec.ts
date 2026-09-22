import { expect, test } from '@playwright/test';
import { fixture } from '../support/manpower-settings-fixture';

test('Job totals, pivots, inactive history, filters and safe group identity', async ({page})=>{
  await fixture(page);await page.goto('/manpower-reporting?job=job');
  await expect(page.getByTestId('labor-total')).toHaveText('10.00 h');
  await expect(page.getByTestId('labor-matching')).toHaveText('10.00 h');
  await page.getByText('Product / Task breakdown',{exact:true}).click();
  await expect(page.locator('summary').filter({hasText:'Slabs'})).toContainText('3.00 h');
  await expect(page.getByTestId('uncategorized-hours')).toHaveText('2.00 h');
  await expect(page.locator('summary').filter({hasText:'Base · Inactive'})).toContainText('1.00 h');
  await page.screenshot({path:'tmp/manpower-job-products-desktop.png',fullPage:true});
  await page.getByLabel('Product Category filter',{exact:true}).selectOption('stairs');
  await expect(page.getByTestId('labor-total')).toHaveText('10.00 h');
  await expect(page.getByTestId('labor-matching')).toHaveText('4.00 h');
  await expect(page.getByRole('button',{name:'Production job for Shop labor'})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Delete Empty Group'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'New Group',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'By Task',exact:true}).click();
  await expect(page.locator('summary')).toHaveCount(2);
  await expect(page.locator('summary').filter({hasText:'Rough Grind on Polisher'})).toBeVisible();
  await page.screenshot({path:'tmp/manpower-product-categories-desktop.png',fullPage:true});
});

test('required new selection, historical null edit and refresh retain drafts', async ({page})=>{
  const state=await fixture(page);await page.goto('/manpower-reporting');
  await page.getByRole('button',{name:'Expand Shop labor'}).click();
  const historical=page.locator('tbody tr').filter({has:page.locator('select[aria-label="Product Category"] option:checked', {hasText:'Uncategorized'})});
  await historical.getByPlaceholder('Notes').fill('corrected');
  await historical.getByRole('button',{name:'Save',exact:true}).click();
  await expect.poll(()=>state.writes.some(w=>w.table==='manpower_entries'&&w.body.notes==='corrected'&&!('product_category_id' in w.body))).toBe(true);
  await page.getByRole('button',{name:'Add New Line'}).click();
  const newRow=page.locator('tbody tr').filter({has:page.getByRole('button',{name:'Add Entry',exact:true})});
  await newRow.getByRole('combobox').nth(1).selectOption('worker');
  await newRow.getByRole('combobox').nth(2).selectOption('wizard');
  // Mixed original/Rework group intentionally requires a work target.
  await newRow.getByRole('combobox').nth(3).selectOption('job:job');
  await newRow.getByPlaceholder('Notes').fill('draft survives category refresh');
  await newRow.getByRole('button',{name:'Add Entry'}).click();
  await expect(page.getByText('Select an active Product Category.',{exact:true})).toBeVisible();
  state.addRemote();
  await newRow.getByLabel('Product Category',{exact:true}).focus();
  await expect(newRow.getByLabel('Product Category',{exact:true}).locator('option[value="remote"]')).toHaveCount(1);
  await expect(newRow.getByPlaceholder('Notes')).toHaveValue('draft survives category refresh');
  await newRow.getByLabel('Product Category',{exact:true}).selectOption('slabs');
  await newRow.getByRole('button',{name:'Add Entry'}).click();
  await expect.poll(()=>state.writes.some(w=>w.table==='manpower_entries'&&w.body.product_category_id==='slabs'&&w.body.notes==='draft survives category refresh')).toBe(true);
});

test('manager lifecycle, historical rename and duplicate protection',async({page})=>{
  await fixture(page);await page.goto('/manpower-reporting?job=job');
  await page.getByRole('button',{name:'Manpower Settings',exact:true}).click();
  await page.getByRole('tab',{name:'Product Categories',exact:true}).click();
  const manager=page.getByRole('region',{name:'Product Categories management'});
  await manager.getByRole('button',{name:'Edit Slabs',exact:true}).click();
  await manager.getByLabel('Category name').fill('Slabs renamed');
  await manager.getByRole('button',{name:'Save category',exact:true}).click();
  await page.getByText('Product / Task breakdown',{exact:true}).click();
  await expect(page.locator('summary').filter({hasText:'Slabs renamed'})).toContainText('3.00 h');
  await manager.getByRole('button',{name:'Actions for Slabs renamed',exact:true}).click();
  await manager.getByRole('button',{name:'Deactivate Slabs renamed',exact:true}).click();
  await manager.getByLabel('Show inactive').check();
  await expect(manager.getByRole('button',{name:'Reactivate Slabs renamed',exact:true})).toBeVisible();
  await expect(page.locator('summary').filter({hasText:'Slabs renamed'})).toContainText('Inactive');
  await manager.getByRole('button',{name:'Reactivate Slabs renamed',exact:true}).click();
  await manager.getByRole('button',{name:'Add Category',exact:true}).click();
  await manager.getByLabel('Category name').fill(' stairs ');
  await manager.getByRole('button',{name:'Save category',exact:true}).click();
  await expect(manager.getByRole('alert')).toHaveText('A category with that name already exists.');
  await manager.getByLabel('Category name').fill('General / Shared');
  await manager.getByRole('button',{name:'Save category',exact:true}).click();
  await expect(manager.getByText('General / Shared',{exact:true})).toBeVisible();
});

for(const role of ['guest','member','developer','admin'])test(`management visibility: ${role}`,async({page})=>{
  await fixture(page,role);await page.goto('/manpower-reporting');
  await expect(page.getByLabel('Job labor review')).toBeVisible();
  await expect(page.getByTestId('labor-total')).toHaveCount(0);
  await page.getByRole('button',{name:'Manpower Settings',exact:true}).click();
  await expect(page.getByRole('tab',{name:'Product Categories',exact:true})).toHaveCount(role==='admin'?1:0);
});

test('narrow layout keeps controls available and table locally scrollable',async({page})=>{
  await page.setViewportSize({width:390,height:844});await fixture(page);await page.goto('/manpower-reporting');
  await expect(page.getByLabel('Job labor review')).toBeVisible();
  await expect(page.getByTestId('labor-total')).toHaveCount(0);
  await page.getByRole('button',{name:'Expand Shop labor'}).click();
  await expect(page.getByLabel('Product Category',{exact:true}).first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await page.getByRole('button',{name:'Manpower Settings',exact:true}).click();
  await page.getByRole('tab',{name:'Product Categories',exact:true}).click();
  await expect(page.getByRole('button',{name:'Add Category',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await page.screenshot({path:'tmp/manpower-product-categories-narrow.png',fullPage:true});
});


test('failed complete load does not publish zero or partial totals',async({page})=>{
  await fixture(page);
  await page.route('**/rest/v1/manpower_entries?**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Fixture read unavailable'})}));
  await page.goto('/manpower-reporting');
  await expect(page.getByRole('alert').filter({hasText:'Fixture read unavailable'})).toBeVisible();
  await expect(page.getByTestId('labor-total')).toHaveCount(0);
  await expect(page.getByTestId('labor-matching')).toHaveCount(0);
});


test('groups stay primary; Job selection and browser navigation keep product filters scoped', async ({page}) => {
  await fixture(page); await page.goto('/manpower-reporting');
  await expect(page.getByLabel('Job labor review')).toBeVisible();
  await expect(page.getByRole('region', {name:'Job labor summary'})).toHaveCount(0);
  await expect(page.getByLabel('Product Category filter', {exact:true})).toHaveCount(0);
  await expect(page.getByTitle('TenOps Early Access environment')).toHaveCount(0);
  await page.getByRole('button',{name:'New Group',exact:true}).click({trial:true});
  await page.screenshot({path:'tmp/manpower-groups-primary.png',fullPage:true});
  await page.getByLabel('Job labor review').selectOption('job');
  await expect(page).toHaveURL(/job=job/);
  await expect(page.getByTestId('labor-total')).toHaveText('10.00 h');
  await expect(page.getByRole('button', {name:'By Product',exact:true})).not.toBeVisible();
  await page.getByText('Product / Task breakdown',{exact:true}).click();
  await expect(page.getByRole('button', {name:'By Product',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('summary').filter({hasText:'Slabs'})).toContainText('37.5%');
  await page.getByLabel('Product Category filter',{exact:true}).selectOption('stairs');
  await expect(page.getByTestId('labor-matching')).toHaveText('4.00 h');
  await page.getByRole('button',{name:'Clear job filter'}).click();
  await expect(page.getByTestId('labor-total')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'New Group',exact:true})).toBeEnabled();
  await page.goBack();
  await expect(page.getByTestId('labor-matching')).toHaveText('10.00 h');
  await page.goBack();
  await expect(page.getByTestId('labor-total')).toHaveCount(0);
  await page.getByLabel('Job labor review').selectOption('other-job');
  await expect(page.getByTestId('labor-total')).toHaveText('3.00 h');
  await expect(page.getByLabel('Job labor review').locator('option:checked')).toContainText('Archived');
  await page.setViewportSize({width:390,height:844});
  await page.getByText('Product / Task breakdown',{exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await page.screenshot({path:'tmp/manpower-job-products-narrow.png',fullPage:true});
});
