import { expect, test, type Page } from '@playwright/test';
import { mockManpowerAuth } from '../support/manpower-auth';
import { intakePlanningDemo } from '../../src/modules/pre-production/planning-demo';

const actor = '00000000-0000-0000-0000-000000000004';
const stamp = '2026-09-22T12:00:00Z';
async function fixture(page: Page, role = 'admin') {
  await page.clock.setFixedTime(new Date('2026-09-22T12:00:00Z'));
  const bids = intakePlanningDemo.map(row => ({ ...row, creator_user_id: actor, creator_name: 'TEST Admin', owner_user_id: actor, owner_name: 'TEST Admin', created_at: stamp, updated_at: stamp, production_job_id: null as string | null, converted_at: null as string | null, converted_by_user_id: null as string | null, projected_window_updated_by: actor, projected_window_updated_at: stamp }));
  const jobs = [{ id: 'fixture-job', name: 'TEST — Committed Production', job_number: 'TEST-ONLY', customer: 'TEST CUSTOMER', production_status: 'not_started', planned_start: '2026-10-05', planned_end: '2026-10-16', archived_at: null, created_at: stamp, updated_at: stamp }];
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
      body = bid.production_job_id;
    } else if (name === 'update_bid') {
      writes.push({ name, body: args }); const bid = bids.find(row => row.id === args.p_bid_id)!;
      Object.assign(bid, { customer: args.p_customer, project_name: args.p_project_name, status: args.p_status, deposit_received_date: args.p_deposit_received_date, notes: args.p_notes, updated_at: `2026-09-22T14:00:${String(tick++).padStart(2, '0')}Z` });
    }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Array.isArray(body) ? Math.max(0, body.length - 1) : 0}/${Array.isArray(body) ? body.length : 0}`, 'access-control-expose-headers': 'content-range' }, body: JSON.stringify(body) });
  });
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
  await dragBy(page, projection(page).getByRole('button', { name: /PROJECTED ·/ }), 20);
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
  await page.getByRole('combobox', { name: 'Planning scale' }).selectOption('quarters');
  await page.getByRole('button', { name: 'Next planning period' }).click();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await projection(page).getByRole('button', { name: /TEST — Hotel/ }).first().click();
  await page.getByLabel('Projected start', { exact: true }).fill('2026-10-06'); f.fail();
  await page.getByRole('button', { name: 'Save projected window', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'This Bid changed' })).toBeVisible();
  expect(f.bids[1].projected_production_start).toBe('2026-10-05');
  expect(f.errors).toEqual([]);
});

for (const role of ['admin', 'developer', 'lead', 'member', 'guest']) {
  test(`Intake early access: ${role}`, async ({ page }) => {
    const f = await fixture(page, role);
    await page.goto('/pre-production');
    if (role === 'admin' || role === 'developer') {
      await expect(page.getByRole('button', { name: 'Planning', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Planning', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Combined', exact: true })).toBeVisible();
      expect(f.calls).toContain('list_bids');
      expect(await page.locator('a[href="/pre-production"]').count()).toBeGreaterThan(0);
    } else {
      await expect(page.getByRole('heading', { name: 'Intake access restricted' })).toBeVisible();
      await expect(page.locator('a[href="/pre-production"]')).toHaveCount(0);
      expect(f.calls.filter(name => /bid|planning_phases|jobs/.test(name))).toEqual([]);
      await expect(page.getByRole('button', { name: 'Planning', exact: true })).toHaveCount(0);
    }
  });
}
