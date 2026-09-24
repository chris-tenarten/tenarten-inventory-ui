import { expect, test, type Page } from '@playwright/test';
import { aggregateLabor, laborPeriod, laborColorSlot, laborColorSlots } from '../../src/modules/manpower/analytics';
import { UNCATEGORIZED } from '../../src/modules/manpower/product-reporting';
import { loadCompleteLabor } from '../../src/modules/manpower/pagination';
import type { ManpowerEntry, ManpowerReference } from '../../src/modules/manpower/types';
import { mockManpowerAuth } from '../support/manpower-auth';

const stamp = '2026-09-24T12:00:00Z';
const ref = (id: string, name = id, active = true): ManpowerReference => ({ id, display_name: name, is_active: active, sort_order: 1, created_at: stamp, updated_at: stamp });
const categories = [ref('cat-a', 'Seat Panels'), { ...ref('cat-b', 'Retired Base', false), sort_order: 2 }, { ...ref('cat-zero', 'No hours'), sort_order: 3 }];
const tasks = [ref('task-a', 'Rough Grinding'), ref('task-b', 'Mix Forms')];
const worker = ref('worker', 'Fixture Worker');
const job = { id: 'job-a', name: 'Fixture Job', job_number: '26-001', production_status: 'in_production' as const, archived_at: null };
const group = { id: 'group', display_name: 'Fixture labor', created_at: stamp, updated_at: stamp };
function row(id: string, patch: Partial<ManpowerEntry> = {}): ManpowerEntry { return { id, work_date: '2026-09-23', am_hours: 1.25, pm_hours: 0.1, product_category_id: 'cat-a', job_id: job.id, job, task_id: 'task-a', task: tasks[0], worker_id: worker.id, worker, reporting_group_id: group.id, reporting_group: group, rework_cycle_id: null, rework_cycle: null, unlisted_work_label: null, notes: '', entered_by: null, created_at: stamp, updated_at: stamp, ...patch }; }
const records = () => [row('a'), row('b', { am_hours: 2, pm_hours: 0, product_category_id: null }), row('c', { am_hours: 3, pm_hours: 0, product_category_id: 'cat-b', task_id: 'task-b', task: tasks[1] }), row('d', { am_hours: 4, pm_hours: 0, job_id: null, job: null, unlisted_work_label: 'Unlinked label' }), row('start', { work_date: '2026-08-26', am_hours: 5, pm_hours: 0 }), row('outside', { work_date: '2026-08-25', am_hours: 6, pm_hours: 0 }), row('future', { work_date: '2026-09-25', am_hours: 100, pm_hours: 0 })];

test('inclusive periods, DST-safe calendar boundaries and Monday partial weeks reconcile every dimension', () => {
  expect(laborPeriod('year', '2026-09-24').start).toBe('2025-09-25');
  expect(laborPeriod(30, '2026-09-24').start).toBe('2026-08-26');
  expect(laborPeriod(90, '2026-09-24').start).toBe('2026-06-27');
  expect(laborPeriod(30, '2026-03-15').start).toBe('2026-02-14');
  expect(laborPeriod(30, '2028-03-01').start).toBe('2028-02-01');
  const a = aggregateLabor(records(), categories, tasks, laborPeriod(30, '2026-09-24'), null);
  expect(a.total).toBe(1535); expect(a.categorized).toBe(1335); expect(a.uncategorized).toBe(200); expect(a.unlinked).toBe(400);
  expect(a.weeks.map(w => [w.start, w.end, w.partial])).toEqual([['2026-08-26', '2026-08-30', true], ['2026-08-31', '2026-09-06', false], ['2026-09-07', '2026-09-13', false], ['2026-09-14', '2026-09-20', false], ['2026-09-21', '2026-09-24', true]]);
  for (const dimension of [a.products, a.tasks, a.weeks]) expect(dimension.reduce((sum, x) => sum + x.units, 0)).toBe(a.total);
  expect(a.jobs.reduce((sum, x) => sum + x.units, a.unlinked)).toBe(a.total);
  expect(a.products.find(p => p.id === 'cat-b')?.label).toBe('Retired Base · Inactive');
  expect(a.zeroCategories).toBe(1); expect(a.latest).toBe('2026-09-23');
  expect(a.tasks[0].products.reduce((sum, x) => sum + x.units, 0)).toBe(a.tasks[0].units);
  expect(aggregateLabor(records(), categories, tasks, laborPeriod('year', '2026-09-24'), null).total).toBe(2135);
  expect(aggregateLabor(records(), categories, tasks, laborPeriod(90, '2026-09-24'), null).total).toBe(2135);
});

test('complete loading, ranking, inactive identities, empty weeks, zero hours and Rework counted once', async () => {
  const many = Array.from({ length: 1002 }, (_, i) => row(String(i), { job_id: `j${i % 7}`, task_id: `t${i % 8}`, rework_cycle_id: i % 2 ? 'rework' : null }));
  const loaded = await loadCompleteLabor(async (from, to) => ({ data: many.slice(from, to + 1), count: many.length, error: null }));
  const a = aggregateLabor(loaded, categories, tasks, laborPeriod(30, '2026-09-24'), null);
  expect(a.total).toBe(135270); expect(a.jobs).toHaveLength(7); expect(a.tasks).toHaveLength(8);
  expect(a.jobs.slice(0, 5).reduce((sum, j) => sum + j.units, 0) + a.jobs.slice(5).reduce((sum, j) => sum + j.units, 0)).toBe(a.total);
  await expect(loadCompleteLabor(async from => ({ data: from ? null : many.slice(0, 500), count: 1002, error: from ? { message: 'failed page' } : null }))).rejects.toThrow('failed page');
  const changed = aggregateLabor(loaded, categories.map(c => ({ ...c, display_name: 'Renamed', sort_order: 9 })), tasks, a.period, null);
  expect(changed.total).toBe(a.total); expect(laborColorSlot(changed.products[0].id)).toBe(laborColorSlot(a.products[0].id));
  expect(laborColorSlot(UNCATEGORIZED)).toBe('uncategorized');
  const empty = aggregateLabor([], categories, tasks, a.period, null); expect(empty.total).toBe(0); expect(empty.weeks).toHaveLength(5); expect(empty.latest).toBeNull();
  expect(aggregateLabor([row('zero', { am_hours: 0, pm_hours: 0 })], categories, tasks, a.period, null).products).toHaveLength(0);
});

async function fixture(page: Page, fail = false, fullPalette = false, fullYear = false, account: { values: Record<string, unknown>; failLoad?: boolean; failSave?: boolean; userId?: string } = { values: { manpower_recent_labor_expanded: (page.viewportSize()?.width ?? 1440) >= 1024 } }) {
  await page.clock.setFixedTime(new Date('2026-09-24T12:00:00'));
  await page.addInitScript(id => sessionStorage.setItem(`tenops.welcomeHeroPlayed:${id}`, 'true'), account.userId ?? '00000000-0000-0000-0000-000000000004');
  const vocabulary = fullPalette ? Array.from({ length: 12 }, (_, i) => ref(`palette-${i}`, `Category ${i + 1}`, i !== 11)) : categories;
  let entries = fullPalette ? [...vocabulary.map((c, i) => row(`palette-row-${i}`, { product_category_id: c.id, am_hours: 1, pm_hours: 0 })), row('neutral', { product_category_id: null, am_hours: 1, pm_hours: 0 })] : records();
  if (fullYear) entries = [...entries, ...Array.from({ length: 13 }, (_, i) => row(`history-${i}`, { work_date: new Date(Date.UTC(2025, 8 + i, 1)).toISOString().slice(0, 10), am_hours: 100, pm_hours: 0 }))];
  const reads: string[] = []; const writes: string[] = []; const preferenceWrites: unknown[] = [];
  await page.routeWebSocket('**/realtime/v1/**', () => {});
  await page.route('**/rest/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), table = url.pathname.split('/').at(-1)!;
    if (table === 'get_my_account_preferences') return route.fulfill({ status: account.failLoad ? 503 : 200, contentType: 'application/json', body: JSON.stringify(account.failLoad ? { message: 'Fixture load failure' } : account.values) });
    if (table === 'set_my_account_preference') {
      const payload = request.postDataJSON(); preferenceWrites.push(payload);
      if (!account.failSave) account.values = { ...account.values, [payload.p_key]: payload.p_value };
      return route.fulfill({ status: account.failSave ? 503 : 200, contentType: 'application/json', body: JSON.stringify(account.failSave ? { message: 'Fixture save failure' } : account.values) });
    }
    if (url.pathname.includes('/rpc/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (request.method() === 'GET' || request.method() === 'HEAD') reads.push(table);
    if (table === 'manpower_entries' && fail) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Complete labor unavailable' }) });
    if (request.method() === 'PATCH') {
      writes.push(table); const patch = request.postDataJSON(), id = url.searchParams.get('id')?.replace('eq.', '');
      const ids = url.searchParams.get('id')?.startsWith('in.') ? url.searchParams.get('id')!.slice(4, -1).split(',') : [id];
      entries = entries.map(e => ids.includes(e.id) ? { ...e, ...patch } : e);
      const changed = entries.filter(e => ids.includes(e.id));
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${changed.length - 1}/${changed.length}`, 'access-control-expose-headers': 'content-range' }, body: JSON.stringify(url.searchParams.get('id')?.startsWith('in.') ? changed : changed[0]) });
    }
    const result = table === 'manpower_entries' ? entries : table === 'jobs' ? [job] : table === 'manpower_tasks' ? tasks : table === 'manpower_workers' ? [worker] : table === 'manpower_product_categories' ? vocabulary : table === 'manpower_reporting_groups' ? [group] : [];
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${result.length - 1}/${result.length}`, 'access-control-expose-headers': 'content-range' }, body: JSON.stringify(result) });
  });
  await mockManpowerAuth(page, 'lead', account.userId);
  return { reads, writes, preferenceWrites, changeCategory: () => { entries = entries.map(e => e.id === 'b' ? { ...e, product_category_id: 'cat-a' } : e); } };
}

test('period, Job, Product focus, Task drill and collapse do not fetch or mutate; refresh reconciles', async ({ page }) => {
  const f = await fixture(page); await page.goto('/manpower-reporting');
  const band = page.getByRole('region', { name: 'Recent labor', exact: true });
  await expect(band.getByTestId('analytics-total')).toHaveText('15.35 h');
  const laborReads = f.reads.filter(x => x === 'manpower_entries').length;
  await band.getByRole('button', { name: '1 Year', exact: true }).click(); await expect(band.getByTestId('analytics-total')).toHaveText('21.35 h');
  await band.getByRole('button', { name: '90 Days', exact: true }).click(); await expect(band.getByTestId('analytics-total')).toHaveText('21.35 h');
  await band.getByRole('button', { name: '30 Days', exact: true }).click();
  await band.getByRole('region', { name: 'Task Hotspots' }).getByRole('button', { name: /Rough Grinding/ }).click();
  const detail = band.getByRole('region', { name: 'Labor analytics detail' });
  await expect(detail).toContainText('Uncategorized · 2 h');
  await detail.getByRole('button', { name: 'View matching entries' }).click(); await expect(detail.locator('tbody tr')).toHaveCount(4);
  await detail.getByRole('button', { name: 'Close detail' }).click();
  await band.getByRole('region', { name: 'Top Jobs' }).getByRole('button').click();
  await expect(page.getByLabel('Job labor review')).toHaveValue('');
  await page.getByLabel('Job labor review').selectOption('job-a'); await expect(band.getByTestId('analytics-total')).toHaveText('11.35 h');
  await page.getByText('Product / Task breakdown', { exact: true }).click();
  await page.getByLabel('Product Category filter').selectOption('cat-a'); await expect(band.getByTestId('analytics-total')).toHaveText('11.35 h');
  await expect(band).toContainText('totals unchanged');
  await page.getByPlaceholder('Search manpower…').fill('no matching entries'); await expect(band.getByTestId('analytics-total')).toHaveText('11.35 h');
  await band.getByRole('button', { name: 'Recent labor', exact: true }).click();
  await expect(band.getByRole('button', { name: 'Recent labor', exact: true })).toHaveAttribute('aria-expanded', 'false');
  expect(f.reads.filter(x => x === 'manpower_entries')).toHaveLength(laborReads); expect(f.writes).toEqual([]);
  await page.reload(); await expect(band.getByTestId('analytics-total')).toHaveText('11.35 h');
  await expect(band.getByRole('button', { name: 'Recent labor', exact: true })).toHaveAttribute('aria-expanded', 'false');
  f.changeCategory(); await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(band).toContainText('100.0% categorized');
});

for (const width of [390, 820, 1280, 1440, 1920]) for (const appearance of ['light', 'dark']) test(`compact responsive ${width} ${appearance}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await fixture(page);
  await page.addInitScript(mode => { localStorage.setItem('tenops_appearance', mode); localStorage.setItem('tenops:tendev:appearance', mode); }, appearance);
  await page.goto('/manpower-reporting');
  await page.evaluate(mode => document.documentElement.setAttribute('data-appearance', mode), appearance);
  const band = page.getByRole('region', { name: 'Recent labor', exact: true }); await expect(band.getByTestId('analytics-total')).toHaveText('15.35 h');
  const disclosure = band.getByRole('button', { name: 'Recent labor', exact: true });
  await expect(disclosure).toHaveAttribute('aria-expanded', width >= 1024 ? 'true' : 'false');
  if (width < 1024) { await disclosure.focus(); await page.keyboard.press('Enter'); }
  await expect(band.getByRole('heading', { name: 'Products · Color key' })).toBeVisible();
  const box = await band.boundingBox(); expect(box!.width).toBeLessThanOrEqual(width);
  if (width >= 1280) { expect(box!.height).toBeGreaterThanOrEqual(240); expect(box!.height).toBeLessThanOrEqual(280); }
  expect(await band.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  if (width === 820) {
    // Existing global navigation overflow is outside this feature. Prove the band adds none.
    await band.evaluate(e => { e.style.display = 'none'; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(pageWidth);
    await page.getByTestId('recent-labor').evaluate(e => { e.style.display = ''; });
    expect(await page.getByRole('banner').evaluate(e => e.scrollWidth > e.clientWidth)).toBe(true);
    console.log(`Existing shell overflow: viewport ${width}, page ${pageWidth}; unchanged with analytics removed.`);
  } else expect(pageWidth).toBeLessThanOrEqual(width + 1);
  await page.evaluate(() => window.scrollTo(0, 0));
  if (width < 1024) await page.screenshot({ path: `tmp/manpower-analytics-${width}-${appearance}.png`, fullPage: true });
  else await band.screenshot({ path: `tmp/manpower-analytics-${width}-${appearance}.png` });
  await band.getByRole('region', { name: 'Task Hotspots' }).getByRole('button', { name: /Rough Grinding/ }).click();
  await band.getByRole('button', { name: 'View matching entries' }).click();
  expect(await band.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
});

test('incomplete load never publishes authoritative totals', async ({ page }) => {
  await fixture(page, true); await page.goto('/manpower-reporting');
  const band = page.getByRole('region', { name: 'Recent labor', exact: true });
  await expect(band).toContainText('Analytics unavailable'); await expect(band.getByTestId('analytics-total')).toHaveCount(0);
});


test('existing row save and category bulk apply update analytics immediately without new reads', async ({ page }) => {
  const f = await fixture(page); await page.goto('/manpower-reporting');
  const band = page.getByRole('region', { name: 'Recent labor', exact: true });
  await expect(band.getByTestId('analytics-total')).toHaveText('15.35 h');
  await page.getByRole('button', { name: 'Expand Fixture labor', exact: true }).click();
  const checkboxes = page.getByRole('checkbox', { name: 'Select Fixture Worker entry on 2026-09-23', exact: true });
  const firstRow = page.locator('tr').filter({ has: checkboxes.nth(0) });
  await firstRow.getByRole('spinbutton').nth(0).fill('2.25');
  await band.getByRole('button', { name: '30 Days', exact: true }).click();
  await expect(band.getByTestId('analytics-total')).toHaveText('16.35 h');
  const reads = f.reads.filter(t => t === 'manpower_entries').length;
  await checkboxes.nth(1).check();
  await page.getByLabel('Bulk Product Category').selectOption('cat-a');
  await page.getByRole('button', { name: 'Apply Category', exact: true }).click();
  await expect(band).toContainText('100.0% categorized');
  await expect(band.getByTestId('analytics-total')).toHaveText('16.35 h');
  expect(f.writes).toEqual(['manpower_entries', 'manpower_entries']);
  expect(f.reads.filter(t => t === 'manpower_entries')).toHaveLength(reads);
});


test('category palette identity survives rename, reorder, period omission and later vocabulary additions', () => {
  const refs = Array.from({ length: 12 }, (_, i) => ref(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, `Category ${i}`));
  const original = laborColorSlots(refs);
  expect(new Set([...original.values()]).size).toBe(13);
  const renamed = laborColorSlots([...refs].reverse().map(c => ({ ...c, display_name: 'Changed', sort_order: 99, is_active: false })));
  for (const c of refs) expect(renamed.get(c.id)).toBe(original.get(c.id));
  const extended = laborColorSlots([...refs, { ...ref('later'), created_at: '2026-10-01T00:00:00Z' }]);
  for (const c of refs) expect(extended.get(c.id)).toBe(original.get(c.id));
  expect(original.get(UNCATEGORIZED)).toBe('uncategorized');
});

for (const appearance of ['light', 'dark']) test(`visual polish disclosure and palette ${appearance}`, async ({ page }) => {
  const f = await fixture(page, false, true);
  await page.goto('/manpower-reporting');
  await page.evaluate(mode => document.documentElement.setAttribute('data-appearance', mode), appearance);
  const band = page.getByTestId('recent-labor');
  const disclosure = band.getByRole('button', { name: 'Recent labor', exact: true });
  await expect(band.getByTestId('analytics-total')).toHaveText('13 h');
  await expect(band.getByRole('heading', { name: 'Products · Color key', exact: true })).toBeVisible();
  const height = (await band.boundingBox())!.height;
  expect(height).toBeGreaterThanOrEqual(260); expect(height).toBeLessThanOrEqual(300);
  const colors = await band.locator('[data-category-color]').evaluateAll(elements => {
    const byId: Record<string, string[]> = {};
    for (const element of elements) {
      const id = element.getAttribute('data-category-color')!;
      (byId[id] ??= []).push(getComputedStyle(element).backgroundColor);
    }
    return Object.values(byId).map(values => [...new Set(values)]);
  });
  expect(colors.every(values => values.length === 1)).toBe(true);
  expect(new Set(colors.flat()).size).toBe(colors.length);
  await band.screenshot({ path: `tmp/manpower-polish-palette-${appearance}.png` });
  await disclosure.getByTestId('analytics-total').click();
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  await expect(band.getByRole('heading', { name: 'Products · Color key' })).toHaveCount(0);
  await band.screenshot({ path: `tmp/manpower-polish-collapsed-${appearance}.png` });
  await band.getByRole('button', { name: '90 Days', exact: true }).click();
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  await disclosure.focus(); await page.keyboard.press('Enter');
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Space');
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Space');
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  await band.getByRole('button', { name: '30 Days', exact: true }).click();
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  expect((await band.boundingBox())!.height).toBe(height);
  expect(f.writes).toEqual([]);
});


test('shared color key exposes category hours on segments and accessible chart controls', async ({ page }) => {
  await fixture(page); await page.goto('/manpower-reporting');
  const band = page.getByTestId('recent-labor');
  await expect(band.getByRole('heading', { name: 'Products · Color key' })).toBeVisible();
  for (const name of ['Recent Labor Trend', 'Top Jobs', 'Task Hotspots']) {
    const panel = band.getByRole('region', { name, exact: true });
    await expect(panel.locator('[data-category-color="cat-a"][title]').first()).toHaveAttribute('title', /Seat Panels: .* h/);
    await expect(panel.locator('button[aria-label*="Seat Panels"]').first()).toHaveAttribute('aria-label', /Seat Panels: .* h/);
  }
  const task = band.getByRole('region', { name: 'Task Hotspots' }).getByRole('button', { name: /Rough Grinding/ });
  await task.focus(); await page.keyboard.press('Enter');
  await expect(band.getByRole('region', { name: 'Labor analytics detail' })).toContainText('Seat Panels · 10.35 h');
  await band.getByRole('region', { name: 'Top Jobs' }).getByRole('button', { name: /Fixture Job/ }).click();
  await expect(band.getByRole('region', { name: /Job breakdown:/ })).toContainText('6.35 h');
});

for (const width of [390, 1280, 1920]) test(`search alignment ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await fixture(page);
  await page.goto('/manpower-reporting');
  await expect(page.getByTestId('analytics-total')).toHaveText('15.35 h');
  const search = await page.getByRole('searchbox', { name: 'Search manpower', exact: true }).boundingBox();
  const filter = await page.getByRole('combobox', { name: 'Job labor review', exact: true }).boundingBox();
  const add = page.getByRole('button', { name: 'New Group', exact: true });
  const addBox = (await add.boundingBox())!;
  const dashboard = (await page.getByTestId('recent-labor').boundingBox())!;
  if (width >= 1280) {
    expect(Math.abs(search!.y - filter!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(search!.y - addBox.y)).toBeLessThanOrEqual(1);
    expect(search!.x).toBeGreaterThan(filter!.x + filter!.width);
    expect(addBox.x).toBeGreaterThan(search!.x + search!.width);
    expect(search!.width).toBeGreaterThanOrEqual(450);
    if (width === 1920) expect(search!.width).toBeGreaterThan(900);
    const leftGap = search!.x - (filter!.x + filter!.width);
    const rightGap = addBox.x - (search!.x + search!.width);
    expect(leftGap).toBeCloseTo(12, 0);
    expect(rightGap).toBeCloseTo(12, 0);
    console.log(`Toolbar ${width}: search ${search!.width}px; gaps ${leftGap}px / ${rightGap}px`);
  } else {
    expect(search!.y).toBeGreaterThan(filter!.y);
    expect(addBox.y).toBeGreaterThan(search!.y);
  }
  const placeholderWeight = await page.getByRole('searchbox', { name: 'Search manpower', exact: true }).evaluate(e => getComputedStyle(e, '::placeholder').fontWeight);
  const selectorWeight = await page.getByRole('combobox', { name: 'Job labor review', exact: true }).evaluate(e => getComputedStyle(e).fontWeight);
  expect(placeholderWeight).toBe(selectorWeight);
  expect(dashboard.y).toBeGreaterThan(addBox.y + addBox.height);
  expect(await add.evaluate(e => getComputedStyle(e).whiteSpace)).toBe('nowrap');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await expect(page.getByRole('button', { name: 'New Group', exact: true })).toBeVisible();
});

for (const appearance of ['light', 'dark']) test(`partial week and primary action affordances ${appearance}`, async ({ page }) => {
  await fixture(page);
  await page.addInitScript(mode => { localStorage.setItem('tenops_appearance', mode); localStorage.setItem('tenops:tendev:appearance', mode); }, appearance);
  await page.goto('/manpower-reporting');
  await page.evaluate(mode => document.documentElement.setAttribute('data-appearance', mode), appearance);
  const band = page.getByTestId('recent-labor');
  await expect(band.getByTestId('analytics-total')).toHaveText('15.35 h');
  const first = band.getByRole('button', { name: /2026-08-26 to 2026-08-30, partial week/ });
  await first.hover(); await expect(first.getByText('Partial week · Aug 26–Aug 30')).toBeVisible();
  await page.mouse.move(0, 0); await first.focus();
  await expect(first.getByText('Partial week · Aug 26–Aug 30')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(band.getByRole('region', { name: 'Labor analytics detail' })).toContainText('Partial week · Aug 26–Aug 30');
  await band.getByRole('button', { name: /2026-09-21 to 2026-09-24, partial week/ }).click();
  await expect(band.getByRole('region', { name: 'Labor analytics detail' })).toContainText('Partial week · Sep 21–Sep 24');
  const full = band.getByRole('button', { name: /2026-08-31 to 2026-09-06/ });
  await expect(full).not.toHaveAttribute('aria-label', /partial week/);
  await expect(full.getByText(/Partial week/)).toHaveCount(0);
  const add = page.getByRole('button', { name: 'New Group', exact: true });
  await page.keyboard.press('Tab'); await add.focus();
  expect(await add.evaluate(e => getComputedStyle(e).outlineStyle)).not.toBe('none');
  await add.screenshot({ path: `tmp/manpower-new-group-${appearance}.png` });
  await page.keyboard.press('Enter');
  await expect(page.getByPlaceholder('Reporting group name', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await add.click();
  await expect(page.getByPlaceholder('Reporting group name', { exact: true })).toBeVisible();
});

test('calendar year boundaries and monthly clipping preserve period reconciliation', () => {
  expect(laborPeriod('year', '2024-02-29').start).toBe('2023-03-01');
  expect(laborPeriod('year', '2025-02-28').start).toBe('2024-02-29');
  expect(laborPeriod('year', '2026-01-01').start).toBe('2025-01-02');
  const entries = ['2025-09-24', '2025-09-25', '2026-02-28', '2026-09-24', '2026-09-25'].map((date, i) => row(String(i), { work_date: date, am_hours: 1, pm_hours: 0 }));
  const data = aggregateLabor(entries, categories, tasks, laborPeriod('year', '2026-09-24'), null);
  expect(data.total).toBe(300); expect(data.trendUnit).toBe('month'); expect(data.weeks).toHaveLength(13);
  expect(data.weeks[0]).toMatchObject({ start: '2025-09-25', end: '2025-09-30', partial: true });
  expect(data.weeks.at(-1)).toMatchObject({ start: '2026-09-01', end: '2026-09-24', partial: true });
  expect(data.weeks[1]).toMatchObject({ start: '2025-10-01', end: '2025-10-31', partial: false });
  expect(data.weeks.reduce((sum, x) => sum + x.units, 0)).toBe(data.total);
  const recent = aggregateLabor(records(), categories, tasks, laborPeriod('year', '2026-09-24'), null);
  expect(recent.period.start).toBe('2026-08-25'); expect(recent.weeks).toHaveLength(2); expect(recent.total).toBe(2135);
  for (const days of [30, 90] as const) {
    const weekly = aggregateLabor(records(), categories, tasks, laborPeriod(days, '2026-09-24'), null);
    expect(weekly.trendUnit).toBe('week');
    expect(weekly.weeks.reduce((sum, x) => sum + x.units, 0)).toBe(weekly.total);
  }
});

for (const width of [390, 1280, 1920]) for (const size of ['compact', 'standard', 'large']) for (const appearance of ['light', 'dark']) test(`consolidated typography ${width} ${size} ${appearance}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); const f = await fixture(page);
  await page.addInitScript(({ size, appearance }) => {
    localStorage.setItem('tenops_display_size', size);
    localStorage.setItem('tenops_appearance', appearance);
    localStorage.setItem('tenops:tendev:appearance', appearance);
  }, { size, appearance });
  await page.goto('/manpower-reporting');
  const band = page.getByTestId('recent-labor');
  await expect(band.getByTestId('analytics-total')).toHaveText('15.35 h');
  await page.evaluate(({ size, appearance }) => {
    document.documentElement.dataset.displaySize = size;
    document.documentElement.dataset.appearance = appearance;
  }, { size, appearance });

  const toggle = band.getByRole('button', { name: 'Recent labor', exact: true });
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
  const reads = f.reads.filter(x => x === 'manpower_entries').length;
  const totalFont = await band.getByTestId('analytics-total').evaluate(e => getComputedStyle(e).fontSize);
  expect(totalFont).toBe(size === 'large' ? '16px' : size === 'compact' ? '12.5px' : '14px');
  const height = (await band.boundingBox())!.height;
  if (width >= 1280) { expect(height).toBeGreaterThanOrEqual(260); expect(height).toBeLessThanOrEqual(300); }
  await expect(band.getByRole('button', { name: '4 Weeks', exact: true })).toHaveCount(0);
  await band.getByRole('button', { name: '90 Days', exact: true }).click();
  await expect(band).toContainText('Weekly labor hours · Weeks start Monday');
  await band.getByRole('button', { name: '1 Year', exact: true }).click();
  await expect(band).toContainText('Monthly labor hours');
  await expect(band).toContainText('2026-08-25 – 2026-09-24');
  await expect(band).toContainText('Available recorded history');
  await expect(band.getByTestId('analytics-total')).toHaveText('21.35 h');
  const first = band.getByRole('button', { name: /2026-08-25 to 2026-08-31, partial month/ });
  await first.focus(); await page.keyboard.press('Enter');
  await expect(band.getByRole('region', { name: 'Labor analytics detail' })).toContainText('Partial month · Aug 25–Aug 31');
  await band.getByRole('button', { name: 'Close detail', exact: true }).click();
  expect(f.reads.filter(x => x === 'manpower_entries')).toHaveLength(reads); expect(f.writes).toEqual([]);
  expect(await band.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await band.screenshot({ path: `tmp/manpower-typography-${width}-${size}-${appearance}.png` });
  console.log(`${width} ${size} ${appearance}: ${height}px dashboard, ${totalFont} primary type`);
});


test('full calendar-year monthly canvas remains readable at Large desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await fixture(page, false, false, true);
  await page.goto('/manpower-reporting');
  const band = page.getByTestId('recent-labor');
  await expect(band.getByTestId('analytics-total')).toBeVisible();
  await page.evaluate(() => { document.documentElement.dataset.displaySize = 'large'; document.documentElement.dataset.appearance = 'dark'; });
  await band.getByRole('button', { name: '1 Year', exact: true }).click();
  const trend = band.getByRole('region', { name: 'Recent Labor Trend' });
  await expect(trend.getByRole('button')).toHaveCount(13);
  expect(await trend.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
  await band.screenshot({ path: 'tmp/manpower-year-full-large.png' });
});


test('Job Product Task hierarchy reconciles authoritative entries including null and inactive categories', () => {
  const extra = row('split-task', { product_category_id: 'cat-a', task_id: 'task-b', task: tasks[1], am_hours: 2, pm_hours: 0, rework_cycle_id: 'rework' });
  for (const days of [30, 90, 'year'] as const) {
    const data = aggregateLabor([...records(), extra, row('second-job', { job_id: 'job-b', am_hours: 8, pm_hours: 0 })], categories, tasks, laborPeriod(days, '2026-09-24'), null);
    for (const job of data.jobs) {
      expect(job.products.reduce((sum, p) => sum + p.units, 0)).toBe(job.units);
      for (const product of job.products) expect(product.tasks.reduce((sum, t) => sum + t.units, 0)).toBe(product.units);
    }
    const job = data.jobs.find(j => j.id === 'job-a')!;
    expect(job.products.find(p => p.id === UNCATEGORIZED)?.units).toBe(200);
    expect(job.products.find(p => p.id === 'cat-b')?.label).toContain('Inactive');
    expect(job.products.find(p => p.id === 'cat-a')?.tasks.find(t => t.id === 'task-b')?.units).toBe(200);
  }
});

for (const width of [390, 1280]) test(`Job drill-down is scoped read-only and accessible ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); const f = await fixture(page);
  await page.goto('/manpower-reporting');
  const band = page.getByTestId('recent-labor');
  await expect(band.getByTestId('analytics-total')).toHaveText('15.35 h');
  const toggle = band.getByRole('button', { name: 'Recent labor', exact: true });
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
  const baseHeight = (await band.boundingBox())!.height;
  const reads = f.reads.filter(x => x === 'manpower_entries').length;
  const panel = band.getByRole('region', { name: 'Top Jobs', exact: true });
  const jobButton = panel.getByRole('button', { name: /Fixture Job/ });
  await jobButton.focus(); await page.keyboard.press('Enter');
  const detail = panel.getByRole('region', { name: /Job breakdown:/ });
  await expect(jobButton).toHaveAttribute('aria-expanded', 'true');
  await expect(detail.getByRole('button', { name: /Seat Panels/ })).toContainText('6.35 h · 55.9%');
  await expect(detail.getByRole('button', { name: /Uncategorized/ })).toContainText('2 h · 17.6%');
  await expect(page.getByLabel('Job labor review')).toHaveValue('');
  await expect(page.getByPlaceholder('Search manpower…')).toHaveValue('');
  if (width >= 1280) expect((await band.boundingBox())!.height).toBe(baseHeight);
  await detail.getByRole('button', { name: /Seat Panels/ }).click();
  await expect(detail.getByRole('region', { name: 'Task breakdown: Seat Panels' })).toContainText('Rough Grinding6.35 h');
  await detail.getByRole('button', { name: /Rough Grinding/ }).click();
  await expect(detail).toContainText('Entry scope: Seat Panels · Rough Grinding · 6.35 h');
  await panel.screenshot({ path: `tmp/manpower-job-drill-${width}.png` });
  await detail.getByRole('button', { name: 'View matching entries', exact: true }).click();
  const entries = band.getByRole('region', { name: 'Labor analytics detail' });
  await expect(entries).toContainText('Fixture Job → Seat Panels → Rough Grinding');
  await expect(entries.locator('tbody tr')).toHaveCount(2);
  await expect(entries).not.toContainText('Unlinked label');
  await expect(page.getByLabel('Job labor review')).toHaveValue('');
  await entries.getByRole('button', { name: 'Close detail', exact: true }).click();
  await detail.getByRole('button', { name: /Uncategorized/ }).click();
  await expect(detail.getByRole('region', { name: 'Task breakdown: Seat Panels' })).toHaveCount(0);
  await detail.getByRole('button', { name: 'View matching entries', exact: true }).click();
  await expect(entries.locator('tbody tr')).toHaveCount(1);
  await expect(entries).toContainText('Uncategorized');
  await band.getByRole('button', { name: '90 Days', exact: true }).click();
  await expect(jobButton).toHaveAttribute('aria-expanded', 'false');
  await expect(entries).toHaveCount(0);
  await jobButton.click();
  await expect(detail.getByRole('button', { name: /Seat Panels/ })).toContainText('12.35 h');
  await page.getByLabel('Job labor review').selectOption('job-a');
  await expect(jobButton).toHaveAttribute('aria-expanded', 'false');
  expect(f.reads.filter(x => x === 'manpower_entries')).toHaveLength(reads); expect(f.writes).toEqual([]);
});


test('account disclosure defaults collapsed and restores explicit choices across fresh sessions', async ({ page, browser }) => {
  const account = { values: {} as Record<string, unknown> };
  const f = await fixture(page, false, false, false, account);
  await page.goto('/manpower-reporting');
  const toggle = page.getByRole('button', { name: 'Recent labor', exact: true });
  await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false'); expect(f.preferenceWrites).toEqual([]);
  await toggle.click(); await expect(toggle).toBeEnabled();
  expect(account.values.manpower_recent_labor_expanded).toBe(true);
  expect(f.preferenceWrites).toEqual([{ p_key: 'manpower_recent_labor_expanded', p_value: true }]);
  await page.reload(); await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(f.preferenceWrites).toHaveLength(1);
  const context = await browser.newContext();
  try {
    const revisit = await context.newPage(); await fixture(revisit, false, false, false, account);
    await revisit.goto('/manpower-reporting');
    const otherToggle = revisit.getByRole('button', { name: 'Recent labor', exact: true });
    await expect(otherToggle).toBeEnabled(); await expect(otherToggle).toHaveAttribute('aria-expanded', 'true');
    await otherToggle.click(); await expect(otherToggle).toBeEnabled();
    expect(account.values.manpower_recent_labor_expanded).toBe(false);
    await revisit.reload(); await expect(otherToggle).toBeEnabled(); await expect(otherToggle).toHaveAttribute('aria-expanded', 'false');
    const separate = await context.newPage();
    const other = await fixture(separate, false, false, false, { userId: '00000000-0000-0000-0000-000000000005', values: {} });
    await separate.goto('/manpower-reporting');
    const independent = separate.getByRole('button', { name: 'Recent labor', exact: true });
    await expect(independent).toBeEnabled(); await expect(independent).toHaveAttribute('aria-expanded', 'false');
    await independent.click(); await expect(independent).toBeEnabled();
    expect(other.preferenceWrites).toHaveLength(1);
    expect(account.values.manpower_recent_labor_expanded).toBe(false);
  } finally { await context.close(); }
});

test('account preference failures leave reporting and explicit disclosure usable', async ({ page }) => {
  const account = { values: {} as Record<string, unknown>, failLoad: true, failSave: true };
  const f = await fixture(page, false, false, false, account);
  await page.goto('/manpower-reporting');
  const toggle = page.getByRole('button', { name: 'Recent labor', exact: true });
  await expect(toggle).toBeEnabled(); await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('recent-labor')).toContainText('Account preferences could not be loaded');
  expect(f.preferenceWrites).toEqual([]);
  await toggle.click(); await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('recent-labor')).toContainText('That account preference could not be saved');
  await expect(page.getByRole('searchbox', { name: 'Search manpower', exact: true })).toBeEnabled();
  await expect(page.getByTestId('recent-labor')).toContainText('Weekly labor hours · Weeks start Monday · * Partial week');
  await page.getByRole('button', { name: '1 Year', exact: true }).click();
  await expect(page.getByTestId('recent-labor')).toContainText('Monthly labor hours · * Partial month');
  await expect(page.getByTestId('recent-labor')).not.toContainText('Select for values');
  await toggle.click(); await expect(toggle).toBeEnabled(); await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(f.writes).toEqual([]);
});
