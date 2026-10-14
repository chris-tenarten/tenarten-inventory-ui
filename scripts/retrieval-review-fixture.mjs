// Synthetic local retrieval data only. No hosted credentials or connections.
export const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const stamp = '2026-10-14T12:00:00Z';
export function makeRetrievalFixture() {
  const ref = (n, name) => ({ id: uuid(n), display_name: name, sort_order: n, is_active: true, created_at: stamp, updated_at: stamp });
  const workers = [ref(50001, 'Fixture Worker')], tasks = [ref(50002, 'Grinding')], categories = [ref(50003, 'Slabs')];
  const groups = Array.from({ length: 42 }, (_, i) => ref(51000 + i, `10/14/26 Group ${i}`));
  const jobs = Array.from({ length: 40 }, (_, i) => ({ id: uuid(1000 + i), name: `Retrieval Job ${i}`, job_number: `26-${1000 + i}`, customer: 'Local fixture', production_status: 'in_production', material_status: 'ready', priority: 'normal', progress_percent: 25, owner_name: 'Fixture', planned_start: '2026-10-01', planned_end: '2026-10-31', requested_delivery_date: '2026-11-01', estimated_man_hours: 40, estimated_calendar_days: 4, remarks: '', archived_at: i < 20 ? null : stamp, created_at: stamp, updated_at: stamp }));
  const labor = Array.from({ length: 12001 }, (_, i) => {
    const job = jobs[i < 1201 ? i % 20 : 20 + i % 20];
    return { id: uuid(100000 + i), work_date: i < 1201 ? '2026-10-14' : i < 1801 ? '2026-08-01' : '2024-01-01', worker_id: workers[0].id, task_id: tasks[0].id, product_category_id: i % 2 ? null : categories[0].id, job_id: job.id, rework_cycle_id: null, reporting_group_id: groups[i % 42].id, unlisted_work_label: null, am_hours: 2.25, pm_hours: 1.5, notes: 'Synthetic history only', entered_by: null, created_at: stamp, updated_at: stamp, job, rework_cycle: null, worker: workers[0], task: tasks[0], reporting_group: groups[i % 42] };
  });
  return { jobs, manpower_entries: labor, manpower_workers: workers, manpower_tasks: tasks, manpower_reporting_groups: groups, manpower_product_categories: categories, production_rework_cycles: [], material_usage_reports: Array.from({ length: 1201 }, (_, i) => ({ id: uuid(200000 + i), job_id: jobs[0].id, report_date: `2026-10-${String(i % 14 + 1).padStart(2, '0')}` })), job_attachments: [], job_updates: [], planning_phases: [] };
}
function fields(select) { let depth = 0, part = '', result = []; for (const c of select) { if (c === ',' && !depth) { result.push(part.trim()); part = ''; } else { part += c; if (c === '(') depth++; if (c === ')') depth--; } } if (part) result.push(part.trim()); return result; }
function project(row, select) { if (select === '*') return row; return Object.fromEntries(fields(select).map(field => { const split = field.indexOf('('); if (split < 0) return [field, row[field]]; const name = field.slice(0, split).split(':')[0]; const value = row[name]; return [name, value == null ? null : project(value, field.slice(split + 1, -1))]; })); }
export function fixtureResponse(url, tables, cap = 500) {
  const table = url.pathname.split('/').at(-1);
  let rows = [...(tables[table] ?? [])];
  for (const [key, value] of url.searchParams) {
    if (['select', 'order', 'offset', 'limit'].includes(key)) continue;
    rows = rows.filter(row => value === 'is.null' ? row[key] == null : value === 'not.is.null' ? row[key] != null : value.startsWith('eq.') ? String(row[key]) === value.slice(3) : value.startsWith('gte.') ? row[key] >= value.slice(4) : value.startsWith('lte.') ? row[key] <= value.slice(4) : value.startsWith('in.(') ? value.slice(4, -1).split(',').includes(String(row[key])) : value.startsWith('not.in.(') ? !value.slice(8, -1).split(',').includes(String(row[key])) : true);
  }
  const count = rows.length;
  const orders = (url.searchParams.get('order') ?? '').split(',').filter(Boolean);
  rows.sort((a, b) => { for (const order of orders) { const [key, direction, nulls] = order.split('.'); if (a[key] == null && b[key] == null) continue; if (a[key] == null) return nulls === 'nullsfirst' ? -1 : 1; if (b[key] == null) return nulls === 'nullsfirst' ? 1 : -1; const cmp = typeof a[key] === 'number' ? a[key] - b[key] : String(a[key]).localeCompare(String(b[key])); if (cmp) return direction === 'desc' ? -cmp : cmp; } return 0; });
  const offset = Number(url.searchParams.get('offset') ?? 0), limit = Math.min(cap, Number(url.searchParams.get('limit') ?? 1000));
  const selected = rows.slice(offset, offset + limit).map(row => project(row, url.searchParams.get('select') ?? '*'));
  return { table, count, rows: selected, headers: { 'content-type': 'application/json', 'content-range': `${offset}-${Math.max(offset, offset + selected.length - 1)}/${count}`, 'access-control-expose-headers': 'content-range' } };
}
