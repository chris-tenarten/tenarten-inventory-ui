import { expect, test, type Page } from '@playwright/test';

const now = '2026-07-22T12:00:00.000Z';
const group = { id: '10000000-0000-4000-8000-000000000001', display_name: 'July 22 Shop Labor', created_at: now, updated_at: now };
const worker = { id: '20000000-0000-4000-8000-000000000001', display_name: 'Existing Worker', sort_order: 1, is_active: true, created_at: now, updated_at: now };
const task = { id: '30000000-0000-4000-8000-000000000001', display_name: 'Existing Task', sort_order: 1, is_active: true, created_at: now, updated_at: now };
const entry = { id: '40000000-0000-4000-8000-000000000001', work_date: '2026-07-22', worker_id: worker.id, task_id: task.id, job_id: null, reporting_group_id: group.id, unlisted_work_label: 'General Operations', am_hours: 4, pm_hours: 2, notes: 'Existing entry', entered_by: 'Test', created_at: now, updated_at: now, worker, task, job: null, reporting_group: group };

async function mockManpower(page: Page) {
  await page.route('**/rest/v1/**', async route => {
    const table = new URL(route.request().url()).pathname.split('/').at(-1);
    const rows = table === 'manpower_entries' ? [entry] : table === 'manpower_reporting_groups' ? [group] : table === 'manpower_workers' ? [worker] : table === 'manpower_tasks' ? [task] : [];
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` }, body: JSON.stringify(rows) });
  });
}

test('Add New Line stays directly below the group header and opens before existing entries', async ({ page }) => {
  await mockManpower(page);
  await page.goto('/manpower-reporting');
  if (await page.getByRole('textbox', { name: 'Password' }).isVisible()) {
    await page.getByRole('textbox', { name: 'Password' }).fill('tenarten123');
    await page.getByRole('button', { name: 'Unlock Workspace' }).click();
  }
  await page.getByRole('button', { name: `Expand ${group.display_name}` }).click();

  const addLine = page.getByRole('button', { name: 'Add New Line' });
  const existingEntry = page.getByRole('textbox', { name: 'Notes' }).first();
  await expect(addLine).toBeVisible();
  await expect(existingEntry).toBeVisible();
  await expect(existingEntry).toHaveValue('Existing entry');
  await expect(page.getByText('TOTAL 6.0 hrs', { exact: true })).toBeVisible();
  expect((await addLine.boundingBox())!.y).toBeLessThan((await existingEntry.boundingBox())!.y);

  const entrySelection = page.getByRole('checkbox', { name: 'Select Existing Worker entry on 2026-07-22' });
  await entrySelection.check();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await addLine.click();

  await expect(page.getByText('New', { exact: true })).toBeVisible();
  await expect(entrySelection).toBeChecked();
  await expect(page.getByText('TOTAL 6.0 hrs', { exact: true })).toBeVisible();
  expect((await page.getByText('New', { exact: true }).boundingBox())!.y).toBeLessThan((await existingEntry.boundingBox())!.y);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  await expect(page.getByRole('button', { name: 'Add New Line' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add Entry' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
});
