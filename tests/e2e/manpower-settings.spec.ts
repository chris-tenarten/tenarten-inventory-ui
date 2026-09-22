import { expect, test, type Page } from '@playwright/test';
import { fixture } from '../support/manpower-settings-fixture';

async function open(page: Page) {
  await page.goto('/manpower-reporting');
  await page.getByRole('button', { name: 'Manpower Settings', exact: true }).click();
  await page.getByRole('tab', { name: 'Product Categories' }).click();
  return page.getByRole('region', { name: 'Product Categories management' });
}

test('shared settings tabs preserve Worker/Task editors and keyboard navigation', async ({ page }) => {
  await fixture(page); await page.goto('/manpower-reporting');
  await expect(page.getByRole('button', { name: 'Product Categories', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Manpower Settings', exact: true }).click();
  await expect(page.getByRole('tabpanel')).toContainText('Test Worker');
  await page.getByRole('button', { name: 'Add worker', exact: true }).click();
  await page.getByPlaceholder('Worker name').fill('Unsaved worker');
  await page.getByRole('tab', { name: 'Tasks', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Manpower Settings', exact: true }).getByRole('alert')).toContainText('Save or cancel');
  await expect(page.getByPlaceholder('Worker name')).toHaveValue('Unsaved worker');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('tab', { name: 'Workers', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Tasks', exact: true })).toBeFocused();
  await expect(page.getByRole('tabpanel')).toContainText('Rough Grind on Wizard');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(page.getByPlaceholder('Task name')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Close settings' }).click();
  await expect(page.getByRole('button', { name: 'Manpower Settings', exact: true })).toBeFocused();
});

test('keyboard reorder, deactivate normalization, add and reactivate append without labor changes', async ({ page }) => {
  const state = await fixture(page); const before = JSON.stringify(state.entries()); const manager = await open(page);
  await manager.getByRole('button', { name: 'Reorder Stairs, position 2 of 2' }).focus();
  await page.keyboard.press('ArrowUp');
  await expect(manager.getByRole('button', { name: 'Reorder Stairs, position 1 of 2' })).toBeFocused();
  expect(state.writes.every(w => w.table === 'manpower_product_categories' && Object.keys(w.body).join() === 'sort_order')).toBe(true);
  await manager.getByRole('button', { name: 'Actions for Stairs' }).click();
  await manager.getByRole('button', { name: 'Deactivate Stairs', exact: true }).click();
  await expect(manager.getByRole('button', { name: 'Reorder Slabs, position 1 of 1' })).toBeVisible();
  expect(state.categories().find(c => c.id === 'slabs')?.sort_order).toBe(1);
  await manager.getByRole('button', { name: 'Add Category', exact: true }).click();
  await manager.getByLabel('Category name').fill('Panels');
  await manager.getByRole('button', { name: 'Save category' }).click();
  await expect(manager.getByRole('button', { name: 'Reorder Panels, position 2 of 2' })).toBeVisible();
  await manager.getByLabel('Show inactive').check();
  const inactive = manager.getByRole('region', { name: 'Inactive Categories' });
  await expect(inactive).toContainText('Stairs');
  await inactive.getByRole('button', { name: 'Reactivate Base', exact: true }).click();
  await expect(manager.getByRole('button', { name: 'Reorder Base, position 3 of 3' })).toBeFocused();
  expect(state.categories().find(c => c.id === 'base')?.sort_order).toBe(3);
  expect(JSON.stringify(state.entries())).toBe(before);
  expect(state.writes.every(w => w.table === 'manpower_product_categories')).toBe(true);
  await page.getByRole('button', { name: 'Expand Shop labor' }).click();
  await page.getByRole('button', { name: 'Add New Line' }).click();
  const newRow = page.locator('tbody tr').filter({ has: page.getByRole('button', { name: 'Add Entry', exact: true }) });
  await expect(newRow.getByLabel('Product Category', { exact: true }).locator('option')).toHaveText(['Select Product Category', 'Slabs', 'Panels', 'Base']);
  await page.getByLabel('Select all entries in Shop labor', { exact: true }).check();
  await expect(page.getByLabel('Bulk Product Category', { exact: true }).locator('option')).toHaveText(['Product Category', 'Slabs', 'Panels', 'Base']);
});

test('pointer drag uses handle and persists only order', async ({ page }) => {
  const state = await fixture(page); const manager = await open(page);
  const handle = manager.getByRole('button', { name: 'Reorder Stairs, position 2 of 2' });
  await handle.dragTo(manager.locator('li[data-category-id="slabs"]'), { targetPosition: { x: 60, y: 2 } });
  await expect(manager.getByRole('button', { name: 'Reorder Stairs, position 1 of 2' })).toBeVisible();
  expect(state.categories().filter(c => c.is_active).map(c => [c.id, c.sort_order])).toEqual([['slabs', 2], ['stairs', 1]]);
  expect(state.writes.every(w => Object.keys(w.body).join() === 'sort_order')).toBe(true);
  await page.screenshot({ path: 'test-results/manpower-settings-desktop.png', fullPage: true });
});

test('partial save refreshes and offers explicit order repair', async ({ page }) => {
  const state = await fixture(page); const manager = await open(page); state.interruptAfter(1);
  await manager.getByRole('button', { name: 'Reorder Stairs, position 2 of 2' }).press('ArrowUp');
  await expect(manager.getByRole('alert')).toContainText('partially saved');
  await manager.getByRole('button', { name: 'Normalize order' }).click();
  await expect(manager.getByRole('status')).toHaveText('Active order normalized.');
  expect(state.categories().filter(c => c.is_active).map(c => c.sort_order).sort()).toEqual([1, 2]);
});

test('narrow layout supports touch-friendly overflow reorder and separate inactive section', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 }); await fixture(page); const manager = await open(page);
  await manager.getByRole('button', { name: 'Actions for Stairs' }).click();
  await manager.getByRole('button', { name: 'Move up', exact: true }).click();
  await expect(manager.getByRole('button', { name: 'Reorder Stairs, position 1 of 2' })).toBeVisible();
  await manager.getByLabel('Show inactive').check();
  await expect(manager.getByRole('region', { name: 'Inactive Categories' })).toContainText('Base');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/manpower-settings-narrow.png', fullPage: true });
});

for (const appearance of ['light', 'dark']) for (const width of [1280, 390]) {
  test(`bulk disabled contrast: ${appearance} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await fixture(page); await page.goto('/manpower-reporting');
    await page.getByRole('button', { name: 'Expand Shop labor' }).click();
    await page.getByLabel('Select all entries in Shop labor', { exact: true }).check();
    await page.evaluate(mode => { document.documentElement.dataset.appearance = mode; }, appearance);
    const buttons = page.locator('.manpower-bulk-action');
    await expect(buttons).toHaveCount(6);
    for (const action of await buttons.all()) {
      await expect(action).toBeDisabled();
      const before = await action.evaluate(el => { const s = getComputedStyle(el); return { color: s.color, background: s.backgroundColor, opacity: s.opacity }; });
      expect(before.opacity).toBe('1');
      const contrast = await action.evaluate(el => {
        const s = getComputedStyle(el);
        const luminance = (color: string) => {
          const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => { const n = v / 255; return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; });
          return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
        };
        const values = [luminance(s.color), luminance(s.backgroundColor)].sort((a,b) => a-b);
        return (values[1] + .05) / (values[0] + .05);
      });
      expect(contrast).toBeGreaterThan(4.5);
      await action.hover({ force: true });
      expect(await action.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(before.background);
    }
    await page.getByLabel('Bulk Product Category', { exact: true }).selectOption('slabs');
    const enabled = page.getByRole('button', { name: 'Apply Category', exact: true });
    await expect(enabled).toBeEnabled();
    expect(await enabled.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(await buttons.first().evaluate(el => getComputedStyle(el).backgroundColor));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `test-results/manpower-bulk-${appearance}-${width}.png`, fullPage: true });
  });
}


test('Workers and Tasks retain create, rename and deactivate behavior', async ({page}) => {
  const state=await fixture(page); await page.goto('/manpower-reporting');
  await page.getByRole('button',{name:'Manpower Settings',exact:true}).click();
  for (const noun of ['worker','task']) {
    await page.getByRole('tab',{name:noun==='worker'?'Workers':'Tasks',exact:true}).click();
    const panel=page.getByRole('tabpanel');
    await panel.getByRole('button',{name:`Add ${noun}`,exact:true}).click();
    await panel.getByPlaceholder(noun==='worker'?'Worker name':'Task name').fill(`New ${noun}`);
    await panel.getByRole('button',{name:'Save',exact:true}).click();
    const row=panel.getByRole('row').filter({hasText:`New ${noun}`});
    await row.getByRole('button',{name:'Edit',exact:true}).click();
    await panel.getByRole('textbox').fill(`Renamed ${noun}`);
    await panel.getByRole('button',{name:'Save',exact:true}).click();
    await panel.getByRole('row').filter({hasText:`Renamed ${noun}`}).getByRole('button',{name:'Deactivate',exact:true}).click();
    await expect(panel.getByRole('row').filter({hasText:`Renamed ${noun}`})).toContainText('Inactive');
  }
  expect(state.writes.every(w=>['manpower_workers','manpower_tasks'].includes(w.table))).toBe(true);
});

for (const viewport of [{width:1440,height:900}, {width:1280,height:640}, {width:390,height:844}]) {
  test(`settings list scroll keeps header, tabs and actions visible at ${viewport.width}x${viewport.height}`,async({page})=>{
    await page.setViewportSize(viewport); await fixture(page);
    for (const table of ['manpower_workers','manpower_tasks','manpower_product_categories']) {
      await page.route(`**/rest/v1/${table}?**`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(Array.from({length:60},(_,i)=>({id:`${table}-${i}`,display_name:`Vocabulary ${i}`,sort_order:i+1,is_active:true,created_at:'',updated_at:''})))}));
    }
    await page.goto('/manpower-reporting'); await page.getByRole('button',{name:'Manpower Settings',exact:true}).click();
    const panel=page.getByRole('region',{name:'Manpower Settings',exact:true});
    for (const tab of ['Workers','Tasks','Product Categories']) {
      await page.getByRole('tab',{name:tab,exact:true}).click();
      const box=await panel.boundingBox();
      if(viewport.width===1440)expect(box!.width).toBe(1080);
      expect(Math.abs(box!.x+box!.width/2-viewport.width/2)).toBeLessThan(2);
      expect(box!.y+box!.height).toBeLessThanOrEqual(viewport.height-(viewport.width<640?24:48)+1);
      const content=page.getByRole('tabpanel').locator('[data-settings-list]');
      expect(await content.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
      const action=panel.getByRole('button',{name:tab==='Workers'?'Add worker':tab==='Tasks'?'Add task':'Add Category',exact:true});
      const actionBefore=await action.boundingBox(); const scrollBefore=await page.evaluate(()=>scrollY);
      await content.evaluate(el=>{el.scrollTop=el.scrollHeight;});
      expect(await action.boundingBox()).toEqual(actionBefore);
      expect(await page.evaluate(()=>scrollY)).toBe(scrollBefore);
      expect(await panel.evaluate(el=>[...el.querySelectorAll('*')].filter(child=>child.getBoundingClientRect().height>0 && child.scrollHeight>child.clientHeight+1 && ['auto','scroll'].includes(getComputedStyle(child).overflowY)).length)).toBe(1);
      await expect(panel.getByRole('button',{name:'Close settings'})).toBeInViewport();
      await expect(action).toBeInViewport();
      await expect(page.getByRole('tab',{name:tab,exact:true})).toBeInViewport();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
      await page.screenshot({path:`test-results/settings-scroll-${tab.replaceAll(' ','-')}-${viewport.width}.png`});
    }
  });
}

test('short Product Categories remain naturally compact',async({page})=>{
  await page.setViewportSize({width:1440,height:900}); await fixture(page); await open(page);
  const panel=page.getByRole('region',{name:'Manpower Settings',exact:true});
  const box=await panel.boundingBox();expect(box!.height).toBeLessThan(450);
  const content=page.getByRole('tabpanel').locator('[data-settings-list]');
  expect(await content.evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
});

test('concurrent category changes are refreshed before any stale write', async ({page})=>{
  const state=await fixture(page);const manager=await open(page);state.addRemote();
  await manager.getByRole('button',{name:'Reorder Stairs, position 2 of 2'}).press('ArrowUp');
  await expect(manager.getByRole('alert')).toContainText('Categories changed');
  await expect(manager.getByText('Remote category',{exact:true})).toBeVisible();
  expect(state.writes).toEqual([]);
});

test('uncertain result blocks further writes until categories refresh', async ({page})=>{
  await fixture(page);const manager=await open(page);let interrupted=false;
  await page.route('**/rest/v1/manpower_product_categories?**',route=>{
    if(route.request().method()==='PATCH')interrupted=true;
    if(interrupted)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Simulated outage'})});
    return route.fallback();
  });
  await manager.getByRole('button',{name:'Reorder Stairs, position 2 of 2'}).press('ArrowUp');
  await expect(manager.getByRole('alert')).toContainText('result is uncertain');
  await expect(manager.getByRole('button',{name:'Add Category',exact:true})).toBeDisabled();
  await expect(manager.getByRole('button',{name:'Reorder Stairs, position 2 of 2'})).toBeDisabled();
  await page.unroute('**/rest/v1/manpower_product_categories?**');
  await manager.getByRole('button',{name:'Refresh categories',exact:true}).click();
  await expect(manager.getByRole('button',{name:'Add Category',exact:true})).toBeEnabled();
});
