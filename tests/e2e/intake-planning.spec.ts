import { expect, test, type Page } from '@playwright/test';
import { mockManpowerAuth } from '../support/manpower-auth';
import { fitPlanningRanges } from '../../src/modules/pre-production/planning-viewport';
import { intakePlanningDemo } from '../../src/modules/pre-production/planning-demo';

const actor = '00000000-0000-0000-0000-000000000004';
const stamp = '2026-09-22T12:00:00Z';
async function fixture(page: Page, role = 'admin') {
  await page.clock.setFixedTime(new Date('2026-09-22T12:00:00Z'));
  const bids = intakePlanningDemo.map(row => ({ ...row, creator_user_id: actor, creator_name: 'TEST Admin', owner_user_id: actor, owner_name: 'TEST Admin', created_at: stamp, updated_at: stamp, production_job_id: null as string | null, converted_at: null as string | null, converted_by_user_id: null as string | null, projected_window_updated_by: actor, projected_window_updated_at: stamp }));
  const jobs = [{ id: 'fixture-job', name: 'TEST — Committed Production', job_number: 'TEST-ONLY', customer: 'TEST CUSTOMER', production_status: 'not_started', planned_start: '2026-10-05', planned_end: '2026-10-16', archived_at: null, created_at: stamp, updated_at: stamp }];
  const phases = [{ id: 'phase', job_id: jobs[0].id, title: 'TEST Pause', timeline_behavior: 'pause', start_date: '2026-10-08', end_date: '2026-10-09', created_at: stamp, updated_at: stamp }];
  const reworks: Array<Record<string,unknown>>=[];
  const calls: string[] = [], writes: Array<{ name: string; body: Record<string, unknown> }> = [];
  let failSave = false;
  let tick = 1;
  await page.routeWebSocket('**/realtime/v1/**', () => {});
  await page.route('**/rest/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), name = url.pathname.split('/').at(-1)!;
    calls.push(name);
    let body: unknown = [];
    const args = request.method() === 'POST' ? request.postDataJSON() : {};
    if (name === 'list_bids') body = bids;
    else if (name === 'list_bid_updates') body = [{ id: 'fixture-update', bid_id: args.p_bid_id, author_user_id: actor, author_name: 'TEST Admin', body: 'TEST visible Update', created_at: stamp }];
    else if (name === 'list_bid_files') body = [{ id: 'fixture-file', bid_id: args.p_bid_id, uploader_user_id: actor, uploader_name: 'TEST Admin', storage_path: 'fixture/test.png', original_filename: 'TEST-preview.png', content_type: 'image/png', byte_size: 68, created_at: stamp }];
    else if (name === 'list_bid_owners') body = [{ user_id: actor, display_name: 'TEST Admin' }];
    else if (name === 'bids') body = url.searchParams.has('id') ? bids.filter(row => row.id === url.searchParams.get('id')?.slice(3)) : bids;
    else if (name === 'jobs') body = jobs;
    else if (name === 'planning_phases') body = phases;
    else if (name === 'production_rework_cycles') body = reworks;
    else if (name === 'set_bid_projected_window') {
      writes.push({ name, body: args });
      if (failSave) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ message: 'This Bid changed. Refresh before changing its projected window.', code: '40001' }) });
      const bid = bids.find(row => row.id === args.p_bid_id)!;
      bid.projected_production_start = args.p_start; bid.projected_production_end = args.p_end; bid.updated_at = `2026-09-22T12:00:${String(tick++).padStart(2, '0')}Z`;
    } else if (name === 'convert_bid_to_production') {
      writes.push({ name, body: args }); const bid = bids.find(row => row.id === args.p_bid_id)!;
      if (!bid.production_job_id) {
        bid.production_job_id = `job-${bid.id}`; bid.updated_at = `2026-09-22T13:00:${String(tick++).padStart(2, '0')}Z`;
        jobs.push({ ...jobs[0], id: bid.production_job_id, name: bid.project_name, planned_start: args.p_window_choice === 'carry' ? bid.projected_production_start! : String(args.p_start), planned_end: args.p_window_choice === 'carry' ? bid.projected_production_end! : String(args.p_end) });
      }
      body = bid.production_job_id;
    } else if (name === 'update_bid') {
      writes.push({ name, body: args }); const bid = bids.find(row => row.id === args.p_bid_id)!;
      Object.assign(bid, { customer: args.p_customer, project_name: args.p_project_name, status: args.p_status, deposit_received_date: args.p_deposit_received_date, notes: args.p_notes, updated_at: `2026-09-22T14:00:${String(tick++).padStart(2, '0')}Z` });
    }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Array.isArray(body) ? Math.max(0, body.length - 1) : 0}/${Array.isArray(body) ? body.length : 0}`, 'access-control-expose-headers': 'content-range' }, body: JSON.stringify(body) });
  });
  await page.route('**/storage/v1/**', route => route.request().method() === 'POST' ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedURL: '/object/sign/bid-files/fixture/test.png?token=fixture' }) }) : route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1kAAAAASUVORK5CYII=', 'base64') }));
  await mockManpowerAuth(page, role);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  return { bids, jobs, phases, reworks, calls, writes, errors, fail: () => { failSave = true; } };
}
const projection = (page: Page, number = 2) => page.locator(`[data-intake-planning-row="${intakePlanningDemo[number - 1].id}"]`);
async function dragBy(page: Page, target: ReturnType<Page['locator']>, delta: number) {
  await target.scrollIntoViewIfNeeded(); const box = await target.boundingBox(); expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2, y = box!.y + box!.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + delta, y, { steps: 5 }); await page.mouse.up();
}

test('lazy Planning, source modes, move/resize, accessible editing and unchanged contextual actions', async ({ page }) => {
  const f = await fixture(page); await page.goto('/pre-production');
  await expect(page.getByRole('heading', { name: 'Bids', exact: true })).toBeVisible();
  expect(f.calls).not.toContain('bids'); expect(f.calls).not.toContain('jobs'); expect(f.calls).not.toContain('planning_phases');
  await page.getByRole('button', { name: 'Planning', exact: true }).click();
  await expect(page.locator('[data-intake-planning-row]')).toHaveCount(8);
  expect(f.calls).not.toContain('jobs');
  await page.getByRole('button', { name: 'Combined', exact: true }).click();
  await expect(page.locator('[data-production-planning-row]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Production', exact: true }).click();
  await expect(page.locator('[data-intake-planning-row]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Projected Intake', exact: true }).click();
  await expect(page.locator('[data-intake-planning-row]')).toHaveCount(8);
  expect(f.calls.filter(name => name === 'jobs')).toHaveLength(1);
  await dragBy(page, projection(page).getByRole('button', { name: /^PROJECTED$/ }), 20);
  await expect.poll(() => f.bids[1].projected_production_start).toBe('2026-10-06');
  await expect(page.getByRole('status').filter({ hasText: 'Projected production window updated' })).toBeVisible();
  await dragBy(page, projection(page).getByRole('button', { name: /Edit projected start/ }), 20);
  await expect.poll(() => f.bids[1].projected_production_start).toBe('2026-10-07');
  await dragBy(page, projection(page).getByRole('button', { name: /Edit projected end/ }), 20);
  await expect.poll(() => f.bids[1].projected_production_end).toBe('2026-10-25');
  for (const write of f.writes) { expect(write.name).toBe('set_bid_projected_window'); expect(Object.keys(write.body).sort()).toEqual(['p_bid_id', 'p_end', 'p_expected_updated_at', 'p_start']); }
  expect(f.bids[1].status).toBe('active'); expect(f.bids[1].deposit_received_date).toBeNull();
  await projection(page).getByRole('button', { name: /TEST — Hotel Lobby Terrazzo INTAKE/ }).click();
  await expect(page.getByLabel('Projected start', { exact: true })).toHaveValue('2026-10-07');
  await page.getByLabel('Projected start', { exact: true }).fill('2026-10-08');
  await page.getByRole('button', { name: 'Save projected window', exact: true }).click();
  await expect.poll(() => f.bids[1].projected_production_start).toBe('2026-10-08');
  await expect(page.getByText('Proposal & Estimate', { exact: true })).toBeVisible();
  await expect(page.getByText('Samples / Color Plates', { exact: true })).toBeVisible();
  expect(f.errors).toEqual([]);
});

test('explicit carry-forward and new-date conversion remove projected duplicate', async ({ page }) => {
  const f = await fixture(page); await page.goto('/pre-production');
  await page.getByRole('button', { name: 'Planning', exact: true }).click();
  await projection(page, 8).getByRole('button', { name: /TEST — Award/ }).first().click();
  await page.getByRole('button', { name: 'Convert to Production', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm conversion', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Production Job', exact: true })).toBeVisible();
  expect(f.writes.find(write => write.name === 'convert_bid_to_production')?.body.p_window_choice).toBe('carry');
  await page.getByRole('button', { name: 'Close Bid workspace', exact: true }).click();
  await expect(projection(page, 8)).toHaveCount(0);
  await page.getByRole('button', { name: 'Combined', exact: true }).click();
  await expect(page.locator('[data-production-planning-row]')).toHaveCount(2);
  expect(f.jobs[1].planned_start).toBe('2026-10-12');
  await projection(page, 2).getByRole('button', { name: /TEST — Hotel/ }).first().click();
  await page.getByRole('combobox').filter({ has: page.locator('option[value=won]') }).selectOption('won');
  await page.getByLabel('Deposit Received Date', { exact: true }).fill('2026-09-22');
  await page.getByRole('button', { name: 'Save Bid', exact: true }).click();
  await page.getByRole('button', { name: 'Convert to Production', exact: true }).click();
  await page.getByRole('radio', { name: 'Set New Dates', exact: true }).check();
  await page.getByLabel('Production start', { exact: true }).fill('2026-11-02');
  await page.getByLabel('Production end', { exact: true }).fill('2026-11-13');
  await page.getByRole('button', { name: 'Confirm conversion', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Production Job', exact: true })).toBeVisible();
  expect(f.jobs[2].planned_start).toBe('2026-11-02'); expect(f.jobs[2].planned_end).toBe('2026-11-13');
  expect(f.bids[1].projected_production_start).toBe('2026-10-05');
  expect(f.errors).toEqual([]);
});

test('narrow layout retains local scrolling, Inspector date editing and clear stale-save feedback', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); const f = await fixture(page); await page.goto('/pre-production');
  await page.getByRole('button', { name: 'Planning', exact: true }).click();
  await expect(page.locator('[data-intake-planning-row]')).toHaveCount(8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await projection(page).getByRole('button', { name: /TEST — Hotel/ }).first().click();
  await page.getByLabel('Projected start', { exact: true }).fill('2026-10-06'); f.fail();
  await page.getByRole('button', { name: 'Save projected window', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'This Bid changed' })).toBeVisible();
  expect(f.bids[1].projected_production_start).toBe('2026-10-05');
  expect(f.errors).toEqual([]);
});

for (const role of ['admin', 'developer', 'lead', 'member', 'guest']) {
  test(`Early Access ordinary editing and separate conversion/deletion: ${role}`, async ({ page }) => {
    const f = await fixture(page, role);
    await page.goto('/pre-production');
    await expect(page.getByRole('button', { name: 'New Bid', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: /My Test|Create Test|Reset Test/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Planning', exact: true }).click();
    await expect(projection(page).locator('[data-window-edge]')).toHaveCount(2);
    await dragBy(page, projection(page).getByRole('button', { name: 'PROJECTED', exact: true }), 20);
    await expect.poll(() => f.writes.some(w => w.name === 'set_bid_projected_window')).toBe(true);
    await projection(page).getByRole('button', { name: /TEST — Hotel/ }).first().click();
    for (const name of ['Projected start', 'Deposit Received Date']) await expect(page.getByLabel(name,{exact:true})).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Save Bid', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Convert to Production', exact: true })).toHaveCount(['admin','lead','member'].includes(role)?1:0);
    await expect(page.getByRole('button', { name: 'Permanently delete Bid', exact: true })).toHaveCount(role==='admin'?1:0);
    await page.getByRole('tab', { name: 'Updates', exact: true }).click();
    await expect(page.getByLabel('Add Update',{exact:true})).toBeEnabled();
    await page.getByRole('tab', { name: /^Files/ }).click();
    for (const input of await page.locator('input[type="file"]').all()) await expect(input).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Remove TEST-preview.png', exact: true })).toBeEnabled();
    expect(f.calls.some(c=>/training|personal_test/.test(c))).toBe(false);
    expect(f.errors).toEqual([]);
  });
}

test('viewport pan, wheel, bounded zoom and Fit are local; block click still opens', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 650 });
  const f = await fixture(page); await page.goto('/pre-production');
  await page.getByRole('button', { name: 'Planning', exact: true }).click();
  await expect(page.locator('[data-intake-planning-row]')).toHaveCount(8);
  const region = page.getByRole('region', { name: 'Scrollable planning timeline' });
  await region.scrollIntoViewIfNeeded();
  const beforeCalls = f.calls.length;
  const box = (await region.boundingBox())!;
  const before = await region.evaluate(el => el.scrollLeft);
  await page.mouse.move(box.x + 650, box.y + 44); await page.mouse.down();
  await page.mouse.move(box.x + 450, box.y + 44, { steps: 5 }); await page.mouse.up();
  await expect.poll(() => region.evaluate(el => el.scrollLeft)).toBeGreaterThan(before + 150);
  await page.mouse.wheel(150, 0);
  await expect.poll(() => region.evaluate(el => el.scrollLeft)).toBeGreaterThan(before + 250);
  for (let i = 0; i < 12 && await page.getByRole('button', { name: 'Zoom out', exact: true }).isEnabled(); i++) await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Zoom out', exact: true })).toBeDisabled();
  for (let i = 0; i < 12 && await page.getByRole('button', { name: 'Zoom in', exact: true }).isEnabled(); i++) await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  expect(f.calls.length).toBe(beforeCalls); expect(f.writes).toEqual([]);
  for (const mode of ['Combined', 'Production', 'Projected Intake']) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Fit', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Fit', exact: true }).click();
    if (mode !== 'Projected Intake') await expect(page.locator('[data-production-planning-row]')).toHaveCount(1);
  }
  expect(f.writes).toEqual([]);
  await projection(page).getByRole('button', { name: 'PROJECTED', exact: true }).click();
  await expect(page.getByLabel('Projected start', { exact: true })).toBeVisible();
  expect(f.writes).toEqual([]); expect(f.errors).toEqual([]);
});

test('Fit without dated work remains usable and does not save', async ({ page }) => {
  const f = await fixture(page);
  for (const b of f.bids) { b.projected_production_start = null; b.projected_production_end = null; }
  await page.goto('/pre-production'); await page.getByRole('button', { name: 'Planning', exact: true }).click();
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'No dated work' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'No projected window — set dates' })).toHaveCount(8);
  expect(f.writes).toEqual([]); expect(f.errors).toEqual([]);
});


test('Fit geometry bounds single records, overlaps, long ranges and outliers', () => {
  const today = '2026-09-01';
  const single = fitPlanningRanges([{ start: '2026-10-05', end: '2026-10-05' }], 900, today);
  expect(single.center).toBe('2026-10-05'); expect(single.dayWidth).toBeLessThanOrEqual(48);
  const overlap = fitPlanningRanges([{ start: '2026-10-01', end: '2026-10-20' }, { start: '2026-10-10', end: '2026-11-01' }], 900, today);
  expect(overlap.limited).toBe(false);
  const distant = fitPlanningRanges([{ start: '2026-10-01', end: '2026-10-20' }, { start: '2026-10-10', end: '2026-11-01' }, { start: '2040-01-01', end: '2040-02-01' }], 900, today);
  expect(distant.limited).toBe(true); expect(distant.center.startsWith('2026')).toBe(true); expect(distant.dayWidth).toBeGreaterThanOrEqual(2);
  expect(fitPlanningRanges([{ start: '2026-01-01', end: '2030-01-01' }], 900, today).limited).toBe(true);
  expect(fitPlanningRanges([], 80, today).dayWidth).toBeGreaterThanOrEqual(2);
});

test('workspace coverage across desktop, tablet and narrow layouts', async ({ page }, testInfo) => {
  const f = await fixture(page); await page.goto('/pre-production');
  await expect(page.getByRole('heading', { name: 'Bids', exact: true })).toBeVisible();
  const workspace = page.getByRole('heading', { name: 'Bids', exact: true }).locator('xpath=ancestor::main').locator(':scope > div').first();
  const measurements = [];
  for (const width of [1280, 1440, 1600, 1920, 768, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.getByRole('button', { name: 'Pipeline', exact: true }).click();
    const pipeline = await workspace.evaluate(el => { const s = getComputedStyle(el); return el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight); });
    // Existing shared header overflows at 768px; keep this Intake-only change scoped.
    if (width !== 768) await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await workspace.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.getByRole('button', { name: 'Planning', exact: true }).click();
    const timeline = page.getByRole('region', { name: 'Scrollable planning timeline' });
    await expect(timeline).toBeVisible();
    const planning = (await timeline.boundingBox())!.width;
    expect(planning).toBe(pipeline);
    expect(await timeline.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
    // Existing shared header overflows at 768px; keep this Intake-only change scoped.
    if (width !== 768) await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await workspace.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(pipeline).toBe(Math.min(width, 1800) - (width >= 640 ? 40 : 16));
    measurements.push({ viewport: width, pipeline, planning, calendar: planning - 242, documentWidth: await page.evaluate(() => document.documentElement.scrollWidth) });
    if (width === 1920 || width === 390) await testInfo.attach(`planning-${width}`, { body: await page.screenshot(), contentType: 'image/png' });
  }
  console.log('Intake content measurements:', JSON.stringify(measurements));
  await testInfo.attach('content-widths', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' });
  expect(f.writes).toEqual([]); expect(f.errors).toEqual([]);
});

test('Today controls and marker preserve zoom and stay local in every source mode', async ({ page }) => {
  const f = await fixture(page); await page.goto('/pre-production');
  await page.getByRole('button', { name: 'Planning', exact: true }).click();
  const region = page.getByRole('region', { name: 'Scrollable planning timeline' });
  const today = page.getByRole('button', { name: 'Today', exact: true });
  const fit = page.getByRole('button', { name: 'Fit', exact: true });
  await expect(page.locator('[data-today-marker]')).toHaveAttribute('aria-label', 'Today: 2026-09-22');
  for (const mode of ['Projected Intake', 'Production', 'Combined']) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    await expect(fit).toBeEnabled();
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    const width = await page.locator('[data-planning-canvas]').first().evaluate(el => el.getBoundingClientRect().width);
    const calls = f.calls.length;
    await region.evaluate(el => { el.scrollLeft += 1800; });
    await today.focus(); await page.keyboard.press('Enter');
    expect(await page.locator('[data-planning-canvas]').first().evaluate(el => el.getBoundingClientRect().width)).toBe(width);
    const actual = await region.evaluate(el => {
      const marker = el.querySelector('[data-today-line]')!.getBoundingClientRect();
      return { actual: marker.left - el.getBoundingClientRect().left - el.clientLeft - 240, expected: (el.clientWidth - 240) / 3 };
    });
    expect(Math.abs(actual.actual - actual.expected)).toBeLessThan(2);
    expect(f.calls.length).toBe(calls); expect(f.writes).toEqual([]);
    await fit.focus(); await page.keyboard.press('Space');
    expect(await fit.evaluate(el => getComputedStyle(el).textDecorationLine)).toBe('none');
    expect(await today.evaluate(el => getComputedStyle(el).borderTopStyle)).toBe('solid');
    expect(await fit.evaluate(el => getComputedStyle(el).borderTopStyle)).toBe('solid');
  }
  // Marker itself must not pull a manually navigated viewport back to today.
  const scroll = await region.evaluate(el => { el.scrollLeft += 200; return el.scrollLeft; });
  await page.getByRole('button', { name: 'Projected Intake', exact: true }).click();
  expect(await region.evaluate(el => el.scrollLeft)).toBe(scroll);
  expect(f.writes).toEqual([]); expect(f.errors).toEqual([]);
});


test('Intake module badge is scoped, readable and responsive in light/dark', async ({ page }) => {
  await fixture(page); await page.goto('/pre-production');
  await page.getByRole('button', { name: 'Planning', exact: true }).click();
  await page.getByRole('button', { name: 'Pipeline', exact: true }).click();
  const heading = page.getByRole('heading', { name: 'Bids', exact: true });
  await expect(heading).toBeVisible();
  const badge = heading.locator('..').getByText('Early Access', { exact: true });
  for (const width of [1440, 390]) for (const appearance of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(mode => { document.documentElement.dataset.appearance = mode; }, appearance);
    await expect(badge).toBeVisible();
    const style = await badge.evaluate(el => { const s=getComputedStyle(el);return {fg:s.color,bg:s.backgroundColor,border:s.borderStyle}; });
    expect(style.fg).not.toBe(style.bg); expect(style.border).toBe('solid');
    const nav = page.locator('a[href="/"][aria-haspopup="menu"]');
    await nav.focus();
    await expect(page.locator('a[href="/pre-production"]').getByText('Early Access', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await nav.evaluate(el => (el as HTMLElement).blur());
    await page.mouse.move(0, 500);
  }
  await page.getByRole('button', { name: 'Planning', exact: true }).click();
  await expect(page.locator('[data-intake-planning-row]').getByText('Early Access', { exact: true })).toHaveCount(0);
});


for (const viewport of [{ width: 1280, height: 720 }, { width: 1920, height: 1000 }, { width: 1440, height: 520 }]) {
  test(`Fit frames vertical workspace ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport); const f = await fixture(page);
    for (let i = 0; i < 15; i++) f.jobs.push({ ...f.jobs[0], id: `job-${i}`, name: `TEST committed ${i}` });
    await page.goto('/pre-production'); await page.getByRole('button', { name: 'Planning', exact: true }).click();
    const fit = page.getByRole('button', { name: 'Fit', exact: true });
    const timeline = page.getByRole('region', { name: 'Scrollable planning timeline' });
    for (const mode of ['Combined', 'Projected Intake', 'Production']) {
      await page.getByRole('button', { name: mode, exact: true }).click(); await expect(fit).toBeEnabled();
      await page.evaluate(() => window.scrollTo(0, 0));
      const calls = f.calls.length;
      await fit.click();
      await expect.poll(() => timeline.evaluate(el => Math.round(el.getBoundingClientRect().bottom))).toBeLessThanOrEqual(viewport.height);
      const layout = await page.evaluate(() => {
        const controls = document.querySelector('[data-planning-controls]')!.getBoundingClientRect();
        const header = document.querySelector('[data-shell-header]')!.getBoundingClientRect();
        return { controlsTop: controls.top, headerBottom: header.bottom, scroll: scrollY };
      });
      expect(layout.controlsTop).toBeGreaterThanOrEqual(layout.headerBottom - 1);
      if (mode !== 'Projected Intake' || viewport.height < 720) expect(layout.controlsTop - layout.headerBottom).toBeLessThan(35);
      if (mode !== 'Projected Intake') {
        expect(await timeline.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
        await timeline.evaluate(el => { el.scrollTop = el.scrollHeight; });
        // Combined is chronologically interleaved; its final row may be projected.
        await expect(page.locator('[data-intake-planning-row], [data-production-planning-row]').last()).toBeInViewport();
      }
      await fit.click();
      const once = await timeline.evaluate(el => ({ left: el.scrollLeft, top: el.scrollTop, height: el.clientHeight, page: scrollY }));
      await fit.click();
      expect(await timeline.evaluate(el => ({ left: el.scrollLeft, top: el.scrollTop, height: el.clientHeight, page: scrollY }))).toEqual(once);
      expect(f.calls.length).toBe(calls); expect(f.writes).toEqual([]);
      await page.getByRole('button', { name: 'Today', exact: true }).click();
      await expect(page.locator('[data-today-marker]')).toBeInViewport();
    }
    for (const appearance of ['light', 'dark']) {
      await page.evaluate(mode => { document.documentElement.dataset.appearance = mode; }, appearance);
      const rgb = await page.locator('[data-today-line]').first().evaluate(el => {
        const canvas = document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d')!;
        ctx.fillStyle=getComputedStyle(el).borderLeftColor;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];
      });
      if (appearance === 'light') expect(rgb[2]).toBeGreaterThan(rgb[0]); else expect(rgb[0]).toBeGreaterThan(rgb[2]);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(f.errors).toEqual([]);
  });
}


test('anonymous cannot discover or load Intake', async ({ page }) => {
  const calls: string[] = [];
  await page.route('**/auth/v1/**', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
  await page.route('**/rest/v1/**', route => { calls.push(new URL(route.request().url()).pathname);return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); });
  await page.goto('/pre-production');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.locator('a[href="/pre-production"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Bids', exact: true })).toHaveCount(0);
  expect(calls.filter(path => /bid|planning_phases/.test(path))).toEqual([]);
});


test('Timeline-only controls, chronological Rework interleaving and continuous Today marker',async({page})=>{
 const f=await fixture(page);
 f.reworks.push({id:'active-cycle',job_id:'fixture-job',sequence_number:2,production_status:'in_progress',planned_start:'2026-10-10',planned_end:'2026-10-11',updated_at:stamp});
 f.phases.push({...f.phases[0],id:'earlier-phase',title:'Earlier phase',start_date:'2026-10-06',end_date:'2026-10-07'});
 await page.goto('/pre-production');await page.getByRole('button',{name:'Planning',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Planning view'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Calendar',exact:true})).toHaveCount(0);
 const scope=page.getByRole('group',{name:'Planning sources'});
 await scope.getByRole('button',{name:'Combined',exact:true}).click();await expect(page.locator('[data-production-planning-row]')).toHaveCount(1);
 const ids=await page.locator('[data-intake-planning-row], [data-production-planning-row]').evaluateAll(rows=>rows.map(r=>r.getAttribute('data-intake-planning-row')??r.getAttribute('data-production-planning-row')));
 expect(ids.indexOf(f.bids[1].id)).toBeLessThan(ids.indexOf('fixture-job'));
 expect(ids.indexOf('fixture-job')).toBeLessThan(ids.indexOf(f.bids[7].id));
 const job=page.locator('[data-production-planning-row="fixture-job"]');await expect(job).toContainText('REWORK');
 await expect(job.getByRole('button',{name:'PRODUCTION',exact:true})).toHaveAttribute('title',/2026-10-10 – 2026-10-11/);
 const phases=await job.locator('button[title*="pause"]').allTextContents();expect(phases.join('|')).toMatch(/Earlier phase.*TEST Pause/);
 const marker=page.locator('[data-continuous-today]');await expect(marker).toHaveCount(1);
 const geometry=await marker.evaluate(el=>({height:el.getBoundingClientRect().height,parent:el.parentElement!.getBoundingClientRect().height,pointer:getComputedStyle(el).pointerEvents,style:getComputedStyle(el).borderLeftStyle}));
 expect(geometry.height).toBe(geometry.parent);expect(geometry.pointer).toBe('none');expect(geometry.style).toBe('solid');
 for(const name of ['Production','Projected Intake','Combined'])await scope.getByRole('button',{name,exact:true}).click();
 expect(f.calls.filter(n=>n==='jobs')).toHaveLength(1);expect(f.calls.filter(n=>n==='planning_phases')).toHaveLength(1);
 expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);
});


test('Planning segmented sources switch immediately and reflow without changing data',async({page})=>{
 const f=await fixture(page);await page.goto('/pre-production');await page.getByRole('button',{name:'Planning',exact:true}).click();
 const sources=page.getByRole('group',{name:'Planning sources'});
 await expect(sources.getByRole('button',{name:'Projected Intake',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('combobox',{name:'Planning source scope'})).toHaveCount(0);
 for(const width of [1440,390])for(const appearance of ['light','dark']){
  await page.setViewportSize({width,height:844});await page.evaluate(value=>document.documentElement.dataset.appearance=value,appearance);
  for(const name of ['Combined','Production','Projected Intake']){
   const button=sources.getByRole('button',{name,exact:true});await button.click();await expect(button).toHaveAttribute('aria-pressed','true');
   await expect(sources.locator('[aria-pressed="true"]')).toHaveCount(1);
   await expect(page.locator('[data-intake-planning-row]')).toHaveCount(name==='Production'?0:8);
   await expect(page.locator('[data-production-planning-row]')).toHaveCount(name==='Projected Intake'?0:1);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const name of ['Zoom out','Zoom in','Today','Fit'])await expect(page.getByRole('button',{name,exact:true})).toBeVisible();
 }
 await sources.getByRole('button',{name:'Combined',exact:true}).focus();await page.keyboard.press('Enter');
 await expect(sources.getByRole('button',{name:'Combined',exact:true})).toHaveAttribute('aria-pressed','true');
 expect(f.calls.filter(n=>n==='jobs')).toHaveLength(1);expect(f.calls.filter(n=>n==='planning_phases')).toHaveLength(1);
 expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);
});

test('Early Access demo badges are UUID-only and Admin deletion is readable in both themes', async ({page}) => {
 const f=await fixture(page);
 f.bids[0].id='11000000-0000-4000-8000-000000000001'; // TEST-prefixed name cannot earn a badge.
 f.bids[1].project_name='Hotel Lobby Terrazzo'; // Removing TEST from a known ID keeps its badge.
 await page.goto('/pre-production');
 await page.getByRole('tab',{name:'All',exact:true}).click();
 await expect(page.getByText('TEST',{exact:true})).toHaveCount(7);
 await page.getByRole('button',{name:/Hotel Lobby Terrazzo/}).first().click();
 const dialog=page.getByRole('dialog',{name:/Hotel Lobby Terrazzo/});
 await expect(dialog.getByText('TEST',{exact:true})).toHaveCount(1);
 const remove=page.getByRole('button',{name:'Permanently delete Bid',exact:true});
 for(const appearance of ['light','dark']) {
  await page.evaluate(mode=>{document.documentElement.dataset.appearance=mode;},appearance);
  for(const state of ['normal','hover','focus']) {
   if(state==='hover')await remove.hover();
   else if(state==='focus'){await remove.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await expect(remove).toBeFocused();}
   const ratios=await remove.evaluate(el=>{
    const rgb=(s:string)=>s.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
    const lum=(s:string)=>rgb(s).reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0);
    const contrast=(a:string,b:string)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
    const s=getComputedStyle(el);return {text:contrast(s.color,s.backgroundColor),border:contrast(s.borderTopColor,s.backgroundColor),outline:s.outlineStyle};
   });
   expect(ratios.text).toBeGreaterThanOrEqual(4.5);expect(ratios.border).toBeGreaterThanOrEqual(3);
   if(state==='focus')expect(ratios.outline).toBe('solid');
  }
  await page.screenshot({path:`/tmp/intake-early-destructive-${appearance}.png`});
 }
 const prompt=page.waitForEvent('dialog');const clicking=remove.click();const confirmation=await prompt;
 expect(confirmation.type()).toBe('prompt');expect(confirmation.message()).toContain('Hotel Lobby Terrazzo');
 await confirmation.dismiss();await clicking;expect(f.writes).toEqual([]);
 await page.getByRole('button',{name:'Close Bid workspace',exact:true}).click();
 await page.getByRole('button',{name:'Planning',exact:true}).click();
 await expect(page.locator('[data-intake-planning-row]').getByText('TEST',{exact:true})).toHaveCount(7);
 expect(f.calls.some(c=>/training|personal_test/.test(c))).toBe(false);
});
