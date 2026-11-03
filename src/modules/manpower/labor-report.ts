// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- direct Edge/Node shared source
// @ts-ignore -- explicit Edge extension.
import { aggregateLabor, laborPeriod, type LaborAnalyticsEntry, type LaborPeriod, type LaborPeriodDays } from './analytics.ts';
import type { ManpowerReference } from './types.ts';

export const LABOR_REPORT_LIMITS = { page: 500, entries: 5000, references: 500, jobs: 1000, results: 5, deadlineMs: 10000 } as const;
const UNCATEGORIZED = '__uncategorized__';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENTRY_COLUMNS = 'id,work_date,task_id,product_category_id,job_id,rework_cycle_id,am_hours,pm_hours,created_at,updated_at,job:jobs(id,name,job_number,production_status,archived_at)';
const REFERENCE_COLUMNS = 'id,display_name,sort_order,is_active,created_at,updated_at';
type Row = Record<string, unknown>;
type QueryResult = { data: unknown; count?: number | null; error: unknown };
export interface LaborReportQuery extends PromiseLike<QueryResult> {
  eq(column: string, value: unknown): LaborReportQuery;
  gte(column: string, value: string): LaborReportQuery;
  lte(column: string, value: string): LaborReportQuery;
  or(filters: string): LaborReportQuery;
  order(column: string, options?: { ascending?: boolean }): LaborReportQuery;
  range(from: number, to: number): LaborReportQuery;
  limit(limit: number): LaborReportQuery;
  abortSignal(signal: AbortSignal): LaborReportQuery;
}
/** Requesting employee's JWT-bound client only. No SQL, privileged client, write
 * methods or employee-supplied relation/projection are exposed by this contract. */
export type LaborReportCaller = { from(table: string): unknown };
type Reader = { from(table: string): { select(columns: string, options?: { count?: 'exact' }): LaborReportQuery } };
export type LaborReportArgs = { period: LaborPeriodDays; job_id?: string; product_category_id?: string; limit: number };
export type LaborReportJob = { job_id: string; job_number: string | null; name: string; reference: string; hours: number };
export type LaborReportProduct = {
  id: string; label: string; hours: number; unlinked_hours: number;
  contributing_jobs: LaborReportJob[]; contributing_job_count: number; has_more_jobs: boolean;
};
export type LaborReportData = {
  period: LaborPeriod; requestedPeriod: LaborPeriod;
  scope: { job_id: string | null; job_reference: string | null; product_category_id: string | null; archives: 'included'; lifecycles: 'original_and_rework'; productMeaning: 'manpower_product_category'; totals: 'all_products'; ranking: 'selected_product' | 'all_products'; fixture: 'caller_visible' };
  total_hours: number; categorized_hours: number; uncategorized_hours: number; unlinked_hours: number; selected_product_hours: number | null;
  entry_count: number; latest_work_date: string | null;
  products: LaborReportProduct[]; product_count: number; has_more_products: boolean;
  jobs: (LaborReportJob & { products: { id: string; label: string; hours: number }[]; product_count: number; has_more_products: boolean })[];
  job_count: number; has_more_jobs: boolean;
};
export type LaborReportResult = {
  version: 'manpower-labor-report.v1'; status: 'ok' | 'invalid_request' | 'not_authorized' | 'unavailable' | 'incomplete';
  complete: boolean; truncated: boolean; observed_at: string; read_started_at: string; read_completed_at: string;
  consistency: 'best_effort_multi_query'; accessRefs: string[]; data: LaborReportData | null; unknowns: string[];
};
export type LaborReportOptions = { hasCapability: (capability: 'readOperationalData') => Promise<boolean>; today?: string; signal?: AbortSignal; deadlineMs?: number; now?: () => Date };
class Incomplete extends Error {}
class Invalid extends Error {}
class Unauthorized extends Error {}
const object = (value: unknown): value is Row => typeof value === 'object' && value !== null && !Array.isArray(value);
const uuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 400;
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
const compareRank = (a: { units: number; label: string; id: string }, b: { units: number; label: string; id: string }) => b.units - a.units || a.label.localeCompare(b.label) || a.id.localeCompare(b.id);
function input(value: unknown): LaborReportArgs {
  if (!object(value) || Object.keys(value).some(k => !['period', 'job_id', 'product_category_id', 'limit'].includes(k)) || ![30, 90, 'year'].includes(value.period as LaborPeriodDays) || !Number.isInteger(value.limit) || Number(value.limit) < 1 || Number(value.limit) > 5 || value.job_id !== undefined && !uuid(value.job_id) || value.product_category_id !== undefined && value.product_category_id !== UNCATEGORIZED && !uuid(value.product_category_id)) throw new Invalid();
  return { ...value, ...(typeof value.job_id === 'string' ? { job_id: value.job_id.toLowerCase() } : {}), ...(typeof value.product_category_id === 'string' ? { product_category_id: value.product_category_id.toLowerCase() } : {}) } as LaborReportArgs;
}
function reference(value: unknown): ManpowerReference {
  if (!object(value) || !uuid(value.id) || !text(value.display_name) || typeof value.is_active !== 'boolean' || !Number.isSafeInteger(value.sort_order) || Number(value.sort_order) <= 0 || typeof value.created_at !== 'string' || typeof value.updated_at !== 'string') throw new Incomplete();
  return value as unknown as ManpowerReference;
}

/** Reuses the exact dashboard aggregator. Product selection narrows ranked
 * projections; all-product totals retain dashboard focus semantics. Empty or
 * partial scans never become a global maximum. No entry/worker/notes returned. */
export async function executeLaborReport(caller: LaborReportCaller, value: unknown, options: LaborReportOptions): Promise<LaborReportResult> {
  const now = options.now ?? (() => new Date()), started = now().toISOString();
  const result: LaborReportResult = { version: 'manpower-labor-report.v1', status: 'unavailable', complete: false, truncated: false, observed_at: started, read_started_at: started, read_completed_at: started, consistency: 'best_effort_multi_query', accessRefs: [], data: null, unknowns: [] };
  const controller = new AbortController(), abort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  const duration = Math.min(20000, Math.max(1, options.deadlineMs ?? LABOR_REPORT_LIMITS.deadlineMs)), deadline = Date.now() + duration;
  const bounded = async <T>(request: PromiseLike<T>): Promise<T> => {
    const remaining = deadline - Date.now();
    if (controller.signal.aborted || remaining <= 0) throw new Incomplete();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([Promise.resolve(request), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Incomplete()); }, remaining); })]); }
    finally { if (timer) clearTimeout(timer); }
  };
  try {
    const args = input(value), today = options.today ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now());
    if (!date(today)) throw new Invalid();
    if (!await bounded(options.hasCapability('readOperationalData'))) throw new Unauthorized();
    const reader = caller as Reader, period = laborPeriod(args.period, today);
    let selectedJob: { job_id: string; name: string; job_number: string | null; reference: string } | null = null;
    // Empty labor is not evidence of record access. Resolve the requested Job
    // through the same caller JWT even when no entries will contribute to it.
    if (args.job_id) {
      const selected = await bounded(reader.from('jobs').select('id,name,job_number,production_status,archived_at').eq('id', args.job_id).limit(1).abortSignal(controller.signal));
      if (selected.error || !Array.isArray(selected.data) || selected.data.length > 1) throw new Incomplete();
      if (!selected.data.length) throw new Unauthorized();
      const row = selected.data[0];
      if (!object(row) || row.id !== args.job_id || !text(row.name) || !(row.job_number === null || text(row.job_number)) || typeof row.production_status !== 'string' || !(row.archived_at === null || typeof row.archived_at === 'string')) throw new Incomplete();
      selectedJob = { job_id: row.id, name: row.name, job_number: row.job_number, reference: [row.job_number, row.name].filter(Boolean).join(' — ') };
    }
    const baseEntries = () => {
      let query = reader.from('manpower_entries').select(ENTRY_COLUMNS, { count: 'exact' })
        .lte('work_date', period.end);
      if (args.job_id) query = query.eq('job_id', args.job_id);
      return query;
    };
    const scan = async (make: () => LaborReportQuery, cap: number): Promise<Row[]> => {
      const rows: Row[] = [], ids = new Set<string>(); let expected: number | null = null;
      while (true) {
        const page = await bounded(make().range(rows.length, rows.length + LABOR_REPORT_LIMITS.page - 1).abortSignal(controller.signal));
        if (page.error || !Array.isArray(page.data) || !Number.isSafeInteger(page.count) || Number(page.count) < 0) throw new Incomplete();
        if (expected === null) expected = Number(page.count);
        if (expected !== page.count || expected > cap || rows.length + page.data.length > cap || rows.length + page.data.length > expected) throw new Incomplete();
        for (const row of page.data) { if (!object(row) || !uuid(row.id) || ids.has(row.id)) throw new Incomplete(); ids.add(row.id); rows.push(row); }
        if (rows.length === expected) return rows;
        if (!page.data.length || page.data.length !== LABOR_REPORT_LIMITS.page) throw new Incomplete();
      }
    };
    const rows = await scan(() => baseEntries().gte('work_date', period.start).order('work_date', { ascending: false }).order('created_at', { ascending: false }).order('id'), LABOR_REPORT_LIMITS.entries);
    // Dashboard year/latest-work presentation uses earliest/latest authorized
    // boundary rows, excluded by aggregateLabor from selected-period accounting.
    const boundary = async (ascending: boolean) => {
      const page = await bounded(baseEntries().order('work_date', { ascending }).order('created_at', { ascending }).order('id', { ascending }).limit(1).abortSignal(controller.signal));
      if (page.error || !Array.isArray(page.data) || page.data.length > 1) throw new Incomplete();
      return page.data as unknown[];
    };
    const categories = (await scan(() => reader.from('manpower_product_categories').select(REFERENCE_COLUMNS, { count: 'exact' }).order('sort_order').order('display_name').order('id'), LABOR_REPORT_LIMITS.references)).map(reference);
    const tasks = (await scan(() => reader.from('manpower_tasks').select(REFERENCE_COLUMNS, { count: 'exact' }).order('sort_order').order('display_name').order('id'), LABOR_REPORT_LIMITS.references)).map(reference);
    const first = await boundary(true), last = await boundary(false);
    const categoryIds = new Set(categories.map(c => c.id)), taskById = new Map(tasks.map(t => [t.id, t]));
    if (args.product_category_id && args.product_category_id !== UNCATEGORIZED && !categoryIds.has(args.product_category_id)) throw new Unauthorized();
    const jobs = new Map<string, { job_id: string; job_number: string | null; name: string; reference: string }>(), facts = new Map<string, LaborAnalyticsEntry>();
    if (selectedJob) jobs.set(selectedJob.job_id, selectedJob);
    for (const value of [...first, ...last, ...rows]) {
      if (!object(value) || !uuid(value.id) || !date(value.work_date) || value.work_date > period.end || !uuid(value.task_id) || !(value.product_category_id === null || uuid(value.product_category_id)) || !(value.job_id === null || uuid(value.job_id)) || !(value.rework_cycle_id === null || uuid(value.rework_cycle_id)) || value.rework_cycle_id !== null && value.job_id === null || args.job_id && value.job_id !== args.job_id) throw new Incomplete();
      const am = Number(value.am_hours), pm = Number(value.pm_hours);
      if (!['number', 'string'].includes(typeof value.am_hours) || !['number', 'string'].includes(typeof value.pm_hours) || !Number.isFinite(am) || !Number.isFinite(pm) || am < 0 || pm < 0 || am + pm > 24) throw new Incomplete();
      const task = taskById.get(value.task_id);
      if (!task || value.product_category_id !== null && !categoryIds.has(value.product_category_id)) throw new Incomplete();
      let job: { name: string; job_number: string | null } | null = null;
      if (value.job_id !== null) {
        const joined = value.job;
        if (!object(joined) || joined.id !== value.job_id || !text(joined.name) || !(joined.job_number === null || text(joined.job_number)) || !(joined.archived_at === null || typeof joined.archived_at === 'string') || typeof joined.production_status !== 'string') throw new Incomplete();
        job = { name: joined.name, job_number: joined.job_number };
        const identity = { job_id: value.job_id, ...job, reference: [job.job_number, job.name].filter(Boolean).join(' — ') }, previous = jobs.get(value.job_id);
        if (previous && JSON.stringify(previous) !== JSON.stringify(identity)) throw new Incomplete();
        jobs.set(value.job_id, identity);
      } else if (value.job !== null) throw new Incomplete();
      const entry: LaborAnalyticsEntry = { id: value.id, work_date: value.work_date, task_id: value.task_id, product_category_id: value.product_category_id, job_id: value.job_id, am_hours: am, pm_hours: pm, task: { display_name: task.display_name }, job };
      const previous = facts.get(entry.id);
      if (previous && JSON.stringify(previous) !== JSON.stringify(entry)) throw new Incomplete();
      facts.set(entry.id, entry);
    }
    if (jobs.size > LABOR_REPORT_LIMITS.jobs) throw new Incomplete();
    const report = aggregateLabor([...facts.values()], categories, tasks, period, args.job_id ?? null);
    if (report.entries.length !== rows.length) throw new Incomplete();
    const products = report.products.filter(p => !args.product_category_id || p.id === args.product_category_id).sort(compareRank);
    const rankedJobs = report.jobs.map(j => ({ job: j, units: args.product_category_id ? j.products.find(p => p.id === args.product_category_id)?.units ?? 0 : j.units }))
      .filter(j => j.units > 0).sort((a, b) => compareRank({ ...a.job, units: a.units }, { ...b.job, units: b.units }));
    const materializeJob = (id: string, units: number): LaborReportJob => { const job = jobs.get(id); if (!job) throw new Incomplete(); return { ...job, hours: units / 100 }; };
    const data: LaborReportData = {
      period: report.period, requestedPeriod: report.requestedPeriod,
      scope: { job_id: args.job_id ?? null, job_reference: selectedJob?.reference ?? null, product_category_id: args.product_category_id ?? null, archives: 'included', lifecycles: 'original_and_rework', productMeaning: 'manpower_product_category', totals: 'all_products', ranking: args.product_category_id ? 'selected_product' : 'all_products', fixture: 'caller_visible' },
      total_hours: report.total / 100, categorized_hours: report.categorized / 100, uncategorized_hours: report.uncategorized / 100, unlinked_hours: report.unlinked / 100,
      selected_product_hours: args.product_category_id ? products[0]?.units ? products[0].units / 100 : 0 : null,
      entry_count: report.entries.length, latest_work_date: report.latest,
      products: products.slice(0, args.limit).map(p => {
        const contributions = report.jobs.flatMap(j => { const found = j.products.find(c => c.id === p.id); return found ? [{ id: j.id, label: j.label, units: found.units }] : []; }).sort(compareRank);
        return { id: p.id, label: p.label, hours: p.units / 100, unlinked_hours: (p.units - contributions.reduce((sum, j) => sum + j.units, 0)) / 100, contributing_jobs: contributions.slice(0, args.limit).map(j => materializeJob(j.id, j.units)), contributing_job_count: contributions.length, has_more_jobs: contributions.length > args.limit };
      }), product_count: products.length, has_more_products: products.length > args.limit,
      jobs: rankedJobs.slice(0, args.limit).map(({ job, units }) => { const items = job.products.filter(p => !args.product_category_id || p.id === args.product_category_id).sort(compareRank); return { ...materializeJob(job.id, units), products: items.slice(0, args.limit).map(p => ({ id: p.id, label: p.label, hours: p.units / 100 })), product_count: items.length, has_more_products: items.length > args.limit }; }),
      job_count: rankedJobs.length, has_more_jobs: rankedJobs.length > args.limit,
    };
    if (!await bounded(options.hasCapability('readOperationalData'))) throw new Unauthorized();
    result.status = 'ok'; result.complete = true; result.data = data;
    // Every Job contributing to aggregate or boundary-dependent report metadata
    // is reauthorized by the existing private history contract, not only top N.
    result.accessRefs = [...jobs.keys()].sort();
    result.unknowns = ['Recorded Manpower hours, not forecasts, staffing capacity or remaining-work estimates. Product means reporting Product Category, not an individual production item.', 'All-product totals include Uncategorized and unlinked work; selected product narrows ranked projections only. Saved original and Rework hours are combined; archived Jobs are included.'];
    if (data.has_more_products || data.has_more_jobs || data.products.some(p => p.has_more_jobs) || data.jobs.some(j => j.has_more_products)) result.unknowns.push('Ranked output is limited; omitted members remain included in complete aggregate totals and the reported matching counts.');
  } catch (error) {
    result.status = error instanceof Invalid ? 'invalid_request' : error instanceof Unauthorized ? 'not_authorized' : error instanceof Incomplete ? 'incomplete' : 'unavailable';
    result.data = null; result.accessRefs = []; result.complete = false;
    result.unknowns = [result.status === 'not_authorized' ? 'This report or its selected records are not available under your current permissions.' : result.status === 'invalid_request' ? 'Choose a supported reporting period, valid record selectors and a result limit from one to five.' : 'Complete authorized historical labor could not be verified. No ranking or maximum is established.'];
  } finally { result.read_completed_at = now().toISOString(); options.signal?.removeEventListener('abort', abort); controller.abort(); }
  return result;
}
