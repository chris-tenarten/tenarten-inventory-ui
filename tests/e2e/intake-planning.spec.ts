import { expect, test, type Page } from '@playwright/test';
import { mockManpowerAuth } from '../support/manpower-auth';
import { fitPlanningRanges } from '../../src/modules/pre-production/planning-viewport';
import { intakePlanningDemo } from '../../src/modules/pre-production/planning-demo';

const actor = '00000000-0000-0000-0000-000000000004';
const stamp = '2026-09-22T12:00:00Z';
async function fixture(page: Page, role = 'admin', personalTraining = false) {
  await page.clock.setFixedTime(new Date('2026-09-22T12:00:00Z'));
  const bids = intakePlanningDemo.map(row => ({ ...row, creator_user_id: actor, creator_name: 'TEST Admin', owner_user_id: actor, owner_name: 'TEST Admin', created_at: stamp, updated_at: stamp, production_job_id: null as string | null, converted_at: null as string | null, converted_by_user_id: null as string | null, projected_window_updated_by: actor, projected_window_updated_at: stamp }));
  const jobs = [{ id: 'fixture-job', name: 'TEST — Committed Production', job_number: 'TEST-ONLY', customer: 'TEST CUSTOMER', production_status: 'not_started', planned_start: '2026-10-05', planned_end: '2026-10-16', archived_at: null, created_at: stamp, updated_at: stamp }];
  const calls: string[] = [], writes: Array<{ name: string; body: Record<string, unknown> }> = [];
  const workflows: Array<{owner_user_id:string;bid_id:string;job_id:string|null}> = personalTraining ? [{owner_user_id:actor,bid_id:bids[1].id,job_id:null}] : [];
  let failSave = false;
  let tick = 1;
  await page.routeWebSocket('**/realtime/v1/**', () => {});
  await page.route('**/rest/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), name = url.pathname.split('/').at(-1)!;
    calls.push(name);
    let body: unknown = [];
    const args = request.method() === 'POST' ? request.postDataJSON() : {};
    if (name === 'has_intake_training_access') body = personalTraining;
    else if (name === 'intake_training_workflows') body = workflows;
    else if (name === 'list_bids') body = bids;
    else if (name === 'list_bid_updates') body = [{ id: 'fixture-update', bid_id: args.p_bid_id, author_user_id: actor, author_name: 'TEST Admin', body: 'TEST visible Update', created_at: stamp }];
    else if (name === 'list_bid_files') body = [{ id: 'fixture-file', bid_id: args.p_bid_id, uploader_user_id: actor, uploader_name: 'TEST Admin', storage_path: 'fixture/test.png', original_filename: 'TEST-preview.png', content_type: 'image/png', byte_size: 68, created_at: stamp }];
    else if (name === 'list_bid_owners') body = [{ user_id: actor, display_name: 'TEST Admin' }];
    else if (name === 'bids') body = url.searchParams.has('id') ? bids.filter(row => row.id === url.searchParams.get('id')?.slice(3)) : bids;
    else if (name === 'jobs') body = jobs;
    else if (name === 'planning_phases') body = [{ id: 'phase', job_id: jobs[0].id, title: 'TEST Pause', timeline_behavior: 'pause', start_date: '2026-10-08', end_date: '2026-10-09', created_at: stamp, updated_at: stamp }];
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
      const workflow=workflows.find(w=>w.bid_id===bid.id);if(workflow)workflow.job_id=bid.production_job_id;
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
  return { bids, jobs, calls, writes, errors, fail: () => { failSave = true; } };
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
  test(`Intake view/write separation: ${role}`, async ({ page }) => {
    const f = await fixture(page, role); const writer = ['admin', 'developer'].includes(role);
    await page.goto('/pre-production');
    await expect(page.getByRole('heading', { name: 'Bids', exact: true })).toBeVisible();
    await expect(page.locator('a[href="/pre-production"]')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'New Bid', exact: true })).toBeEnabled({ enabled: writer });
    await page.getByRole('button', { name: 'Planning', exact: true }).click();
    await expect(page.locator('[data-intake-planning-row]')).toHaveCount(8);
    await expect(projection(page).locator('[data-window-edge]')).toHaveCount(writer ? 2 : 0);
    await page.getByRole('button', { name: 'Combined', exact: true }).click();
    await expect(page.locator('[data-production-planning-row]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Today', exact: true }).click();
    await page.getByRole('button', { name: 'Fit', exact: true }).click();
    if (!writer) {
      await dragBy(page, projection(page).getByRole('button', { name: 'PROJECTED', exact: true }), 40);
      expect(f.writes).toEqual([]);
      if (await page.getByRole('button', { name: 'Close Bid workspace', exact: true }).isVisible()) await page.getByRole('button', { name: 'Close Bid workspace', exact: true }).click();
      await projection(page).getByRole('button', { name: /TEST — Hotel/ }).first().click();
      await expect(page.getByLabel('Projected start', { exact: true })).toBeDisabled();
      await expect(page.getByLabel('Deposit Received Date', { exact: true })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Save Bid', exact: true })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Save projected window', exact: true })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Convert to Production', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Permanently delete Bid', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Samples \/ Color Plates/ })).toBeDisabled();
      await expect(page.getByRole('button', { name: /Proposal & Estimate/ })).toBeDisabled();
      await page.getByRole('tab', { name: 'Updates', exact: true }).click();
      await expect(page.getByText('TEST visible Update', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add Update', exact: true })).toBeDisabled();
      await page.getByRole('tab', { name: /^Files/ }).click();
      for (const input of await page.locator('input[type="file"]').all()) await expect(input).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Remove TEST-preview.png', exact: true })).toBeDisabled();
      await page.getByRole('button', { name: /TEST-preview.png image\/png/ }).click();
      await expect(page.getByRole('img', { name: 'TEST-preview.png', exact: true })).toBeVisible();
    }
    expect(f.writes).toEqual([]); expect(f.errors).toEqual([]);
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
  const badge = heading.locator('..').getByText('Under Development', { exact: true });
  for (const width of [1440, 390]) for (const appearance of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(mode => { document.documentElement.dataset.appearance = mode; }, appearance);
    await expect(badge).toBeVisible();
    const style = await badge.evaluate(el => { const s=getComputedStyle(el);return {fg:s.color,bg:s.backgroundColor,border:s.borderStyle}; });
    expect(style.fg).not.toBe(style.bg); expect(style.border).toBe('solid');
    const nav = page.locator('a[href="/"][aria-haspopup="menu"]');
    await nav.focus();
    await expect(page.locator('a[href="/pre-production"]').getByText('Under Development', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await nav.evaluate(el => (el as HTMLElement).blur());
    await page.mouse.move(0, 500);
  }
  await page.getByRole('button', { name: 'Planning', exact: true }).click();
  await expect(page.locator('[data-intake-planning-row]').getByText('Under Development', { exact: true })).toHaveCount(0);
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
        await expect(page.locator('[data-production-planning-row]').last()).toBeInViewport();
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


test('personal training authorizes only its own Bid and preserves normal read-only Intake', async ({ page }) => {
  const f=await fixture(page,'lead',true);
  await page.goto('/pre-production');
  await expect(page.getByRole('button',{name:'New Bid',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Open My Test Bid',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Planning',exact:true}).click();
  await expect(projection(page,2).locator('[data-window-edge]')).toHaveCount(2);
  await expect(projection(page,8).locator('[data-window-edge]')).toHaveCount(0);
  await dragBy(page,projection(page,2).getByRole('button',{name:'PROJECTED',exact:true}),20);
  await expect.poll(()=>f.bids[1].projected_production_start).toBe('2026-10-06');
  await page.getByRole('button',{name:'Open My Test Bid',exact:true}).click();
  await expect(page.getByLabel('Projected start',{exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'Save Bid',exact:true})).toBeEnabled();
  await expect(page.getByRole('combobox',{name:'Owner',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Delete / Reset Test Bid',exact:true})).toBeVisible();
  await page.getByRole('combobox').filter({has:page.locator('option[value=won]')}).selectOption('won');
  await page.getByLabel('Deposit Received Date',{exact:true}).fill('2026-09-22');
  await page.getByRole('button',{name:'Save Bid',exact:true}).click();
  await page.getByRole('button',{name:'Convert to Production',exact:true}).click();
  await expect(page.getByText('A separate TEST identifier is assigned automatically.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Confirm conversion',exact:true}).click();
  await expect(page.getByRole('button',{name:'Delete My Test Production Job',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close Bid workspace',exact:true}).click();
  await projection(page,8).getByRole('button',{name:/TEST — Award/}).first().click();
  await expect(page.getByRole('button',{name:'Save Bid',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Convert to Production',exact:true})).toHaveCount(0);
  expect(f.writes.every(w=>w.body.p_bid_id===f.bids[1].id)).toBe(true);
  expect(f.errors).toEqual([]);
});
