import { ACTIVE_PRODUCTION_STATUSES, ADMIN_ONLY_PRODUCTION_FIXTURE_ID, applyProductionLifecycle, getJobReadiness, isActiveProductionRework } from './production-job-facts.mjs';
import { entryHundredths } from './labor-hours.mjs';

/** The adapter must be the requesting user's JWT-bound client. It has no
 * service-role argument, SQL input, write method or caller-selected projection. */
export type JobQueryResult = { data: unknown; error: unknown; count?: number | null };
export interface JobToolQuery extends PromiseLike<JobQueryResult> {
  select(columns: string, options?: { count?: 'exact'; head?: boolean }): JobToolQuery;
  eq(column: string, value: unknown): JobToolQuery;
  is(column: string, value: null): JobToolQuery;
  not(column: string, operator: string, value: unknown): JobToolQuery;
  in(column: string, values: readonly string[]): JobToolQuery;
  gte(column: string, value: string): JobToolQuery;
  lte(column: string, value: string): JobToolQuery;
  or(filters: string): JobToolQuery;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): JobToolQuery;
  range(from: number, to: number): JobToolQuery;
  limit(limit: number): JobToolQuery;
  abortSignal(signal: AbortSignal): JobToolQuery;
  maybeSingle(): PromiseLike<JobQueryResult>;
}
export type JobToolCaller = {
  // Keep the SDK's generic table-builder type opaque at this boundary; the
  // internal read facade below exposes only fixed SELECT operations.
  from(table: string): unknown;
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
};
type JobDataReader = Omit<JobToolCaller, 'from'> & { from(table: string): { select(columns: string, options?: { count?: 'exact'; head?: boolean }): JobToolQuery } };
export type TenbotJobToolName = 'find_jobs' | 'get_job_summary' | 'get_job_planning' | 'get_job_labor_summary' | 'get_production_overview';
export type JobIdentity = { job_id: string; job_number: string | null; name: string; customer: string | null; reference: string; archived: boolean };
export type JobFacts = JobIdentity & {
  original: { status: string; planned_start: string | null; planned_end: string | null; updated_at: string };
  effective: { lifecycle: 'original' | 'rework'; rework_cycle_id: string | null; sequence_number: number | null; status: string; planned_start: string | null; planned_end: string | null; updated_at: string };
  material_status: string; requested_delivery_date: string | null;
  readiness: { state: 'ready' | 'needs_planning' | 'not_scheduled'; label: string; missing_fields: string[] };
};
export type JobSourceReference = { relation: 'jobs' | 'production_rework_cycles' | 'job_updates' | 'manpower_entries'; job_id?: string; record_id?: string; record_updated_at?: string; observed_at: string };
export type JobFindData = { jobs: JobFacts[]; match: 'exact' | 'search' | 'browse'; has_more: boolean; next_cursor: string | null };
export type JobSummaryData = { job: JobFacts; counts: { rework_cycles: number | null; active_rework_cycles: number | null; open_follow_ups: number | null } };
export type JobPlanningData = { job: JobFacts; phases: { availability: 'disabled'; reason: string }; schedule_is_persisted: true };
export type JobLaborData = { job: JobFacts; period: { start_date: string; end_date: string }; total_hours: number | null; entry_count: number | null; original_or_unclassified_hours: number | null; reworks: { rework_cycle_id: string; sequence_number: number | null; hours: number; entry_count: number }[]; daily: { date: string; hours: number }[]; latest_work_date: string | null };
export type JobOverviewData = { counts: { jobs: number | null; active_jobs: number | null; by_status: Record<string, number | null>; scheduled: number | null; unscheduled: number | null }; upcoming: { job_id: string; reference: string; planned_end: string; lifecycle: 'original' | 'rework' }[]; has_more_upcoming: boolean };
export type JobToolData = JobFindData | JobSummaryData | JobPlanningData | JobLaborData | JobOverviewData;
export type JobToolResult = {
  tool: TenbotJobToolName; version: 'tenbot-job-read.v1';
  status: 'ok' | 'partial' | 'not_found_or_not_authorized' | 'unavailable' | 'invalid_request';
  observed_at: string; timezone: 'America/Chicago'; filters: Record<string, unknown>;
  read_started_at: string; read_completed_at: string; consistency: 'best_effort_multi_query';
  units: Record<string, string>; sources: JobSourceReference[]; unknowns: string[];
  complete: boolean; truncated: boolean; data: JobToolData | null;
};

// The existing controlled chris-dev-test / DEV-20260803 fixture, verified in
// scripts/planning-demo-data.mjs and production/fixture-visibility.ts. Identity,
// not a fuzzy prefix or user-controlled legacy-source string, defines this rule.
export const TENBOT_EXCLUDED_JOB_FIXTURE_ID = ADMIN_ONLY_PRODUCTION_FIXTURE_ID;
export const TENBOT_JOB_TOOL_LIMITS = { page: 200, jobs: 1000, labor_entries: 2000, result_jobs: 20, period_days: 366 } as const;
const JOB_COLUMNS = 'id,name,customer,job_number,production_status,material_status,requested_delivery_date,planned_start,planned_end,estimated_man_hours,archived_at,updated_at';
const REWORK_COLUMNS = 'id,job_id,sequence_number,production_status,planned_start,planned_end,updated_at';
const LABOR_COLUMNS = 'id,job_id,rework_cycle_id,work_date,am_hours,pm_hours,updated_at';
const STATUSES = ['not_started', 'on_deck', 'in_production', 'on_hold', 'shipped', 'complete', 'cancelled'];
const MATERIAL_STATUSES = ['unknown', 'not_ready', 'ordered', 'ready'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Row = Record<string, unknown>;
type JobRow = { id: string; name: string; customer: string | null; job_number: string | null; production_status: string; material_status: string; requested_delivery_date: string | null; planned_start: string | null; planned_end: string | null; estimated_man_hours: number | null; archived_at: string | null; updated_at: string };
type Cycle = { id: string; job_id: string; sequence_number: number; production_status: string; planned_start: string | null; planned_end: string | null; updated_at: string };
class InvalidInput extends Error {}
class Unavailable extends Error {}
const object = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
const normalize = (value: string) => value.trim().toLowerCase();
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
function date(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
const shiftDate = (value: string, days: number) => new Date(Date.parse(`${value}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
function chicagoDate(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}
function nullableText(value: unknown, max = 300): value is string | null {
  return value === null || typeof value === 'string' && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
}
function jobRow(value: unknown): JobRow {
  if (!object(value) || !isUuid(value.id) || typeof value.name !== 'string' || !nullableText(value.name) || !nullableText(value.customer) || !nullableText(value.job_number, 120) || !STATUSES.includes(String(value.production_status)) || !MATERIAL_STATUSES.includes(String(value.material_status)) || ![value.requested_delivery_date, value.planned_start, value.planned_end].every(v => v === null || date(v)) || !nullableText(value.archived_at, 80) || typeof value.updated_at !== 'string' || !Number.isFinite(Date.parse(value.updated_at)) || !(value.estimated_man_hours === null || Number.isFinite(Number(value.estimated_man_hours)) && Number(value.estimated_man_hours) >= 0)) throw new Unavailable();
  return { id: value.id, name: value.name, customer: value.customer, job_number: value.job_number as string | null, production_status: String(value.production_status), material_status: String(value.material_status), requested_delivery_date: value.requested_delivery_date as string | null, planned_start: value.planned_start as string | null, planned_end: value.planned_end as string | null, estimated_man_hours: value.estimated_man_hours === null ? null : Number(value.estimated_man_hours), archived_at: value.archived_at as string | null, updated_at: value.updated_at };
}
function cycleRow(value: unknown): Cycle {
  if (!object(value) || !isUuid(value.id) || !isUuid(value.job_id) || !Number.isSafeInteger(value.sequence_number) || Number(value.sequence_number) <= 0 || !STATUSES.includes(String(value.production_status)) || ![value.planned_start, value.planned_end].every(v => v === null || date(v)) || typeof value.updated_at !== 'string' || !Number.isFinite(Date.parse(value.updated_at))) throw new Unavailable();
  return { id: value.id, job_id: value.job_id, sequence_number: Number(value.sequence_number), production_status: String(value.production_status), planned_start: value.planned_start as string | null, planned_end: value.planned_end as string | null, updated_at: value.updated_at };
}
function facts(job: JobRow, cycle: Cycle | null): JobFacts {
  const effective = applyProductionLifecycle(job, cycle), readiness = getJobReadiness(effective);
  return {
    job_id: job.id, job_number: job.job_number, name: job.name, customer: job.customer,
    reference: [job.job_number?.trim(), job.name.trim()].filter(Boolean).join(' — ') || 'Unnamed Production Job', archived: job.archived_at !== null,
    original: { status: job.production_status, planned_start: job.planned_start, planned_end: job.planned_end, updated_at: job.updated_at },
    effective: { lifecycle: cycle ? 'rework' : 'original', rework_cycle_id: cycle?.id ?? null, sequence_number: cycle?.sequence_number ?? null, status: effective.production_status, planned_start: effective.planned_start, planned_end: effective.planned_end, updated_at: effective.updated_at },
    material_status: job.material_status, requested_delivery_date: job.requested_delivery_date,
    readiness: { state: readiness.state, label: readiness.label, missing_fields: readiness.missingFields },
  };
}
function strictKeys(args: Row, allowed: string[]) {
  if (Object.keys(args).some(key => !allowed.includes(key))) throw new InvalidInput();
}
function includeArchived(args: Row) {
  if (args.include_archived !== undefined && typeof args.include_archived !== 'boolean') throw new InvalidInput();
  return args.include_archived === true;
}
function resultLimit(args: Row) {
  const value = args.limit ?? 20;
  if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > TENBOT_JOB_TOOL_LIMITS.result_jobs) throw new InvalidInput();
  return Number(value);
}
function period(args: Row, today: string, upcoming = false) {
  if ((args.start_date === undefined) !== (args.end_date === undefined)) throw new InvalidInput();
  const start = args.start_date ?? (upcoming ? today : shiftDate(today, -29));
  const end = args.end_date ?? (upcoming ? shiftDate(today, 29) : today);
  if (!date(start) || !date(end) || start > end || Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`) >= TENBOT_JOB_TOOL_LIMITS.period_days * 86400000) throw new InvalidInput();
  return { start_date: start, end_date: end };
}
// Quote PostgREST logic values, then escape LIKE metacharacters. Employee text
// cannot select extra columns, append an OR branch or become a SQL expression.
function searchValue(value: string, contains: boolean) {
  const literal = value.replace(/[\\%_]/g, character => `\\${character}`);
  return `"${(contains ? `%${literal}%` : literal).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function createJobToolRunner(caller: JobDataReader, options: { now?: () => Date } = {}) {
  const capability = async (name: string) => {
    const result = await caller.rpc('has_app_capability', { p_capability: name });
    if (result.error) throw new Unavailable();
    return result.data === true;
  };
  const scan = async (make: () => JobToolQuery, cap: number) => {
    const rows: unknown[] = [], ids = new Set<string>();
    let expected: number | null = null;
    for (let from = 0; from <= cap; from += TENBOT_JOB_TOOL_LIMITS.page) {
      const size = Math.min(TENBOT_JOB_TOOL_LIMITS.page, cap + 1 - from);
      const result = await make().order('id').range(from, from + size - 1);
      if (result.error || !Array.isArray(result.data)) throw new Unavailable();
      const count = result.count;
      if (!Number.isSafeInteger(count) || Number(count) < 0 || expected !== null && count !== expected) return { rows, complete: false };
      expected = Number(count);
      for (const row of result.data) {
        if (!object(row) || !isUuid(row.id) || ids.has(row.id)) return { rows, complete: false };
        ids.add(row.id); rows.push(row);
      }
      if (rows.length > cap) return { rows: rows.slice(0, cap), complete: false };
      if (rows.length === expected) return { rows, complete: true };
      if (result.data.length !== size || rows.length > expected) return { rows, complete: false };
    }
    return { rows, complete: false };
  };
  const activeCycles = async (ids: string[]) => {
    const cycles = new Map<string, Cycle>();
    for (let offset = 0; offset < ids.length; offset += 200) {
      const scope = ids.slice(offset, offset + 200);
      const result = await scan(() => caller.from('production_rework_cycles').select(REWORK_COLUMNS, { count: 'exact' }).in('job_id', scope).not('production_status', 'in', '(complete,cancelled)'), scope.length);
      if (!result.complete) throw new Unavailable();
      for (const value of result.rows) {
        const cycle = cycleRow(value);
        if (!scope.includes(cycle.job_id) || !isActiveProductionRework(cycle) || cycles.has(cycle.job_id)) throw new Unavailable();
        cycles.set(cycle.job_id, cycle);
      }
    }
    return cycles;
  };
  const count = async (make: () => JobToolQuery) => {
    try {
      const result = await make();
      if (result.error || !Number.isSafeInteger(result.count) || Number(result.count) < 0) return null;
      return Number(result.count);
    } catch { return null; }
  };
  const loadJob = async (id: string) => {
    id = id.toLowerCase();
    if (id === TENBOT_EXCLUDED_JOB_FIXTURE_ID && !await capability('manageUsers')) return null;
    const result = await caller.from('jobs').select(JOB_COLUMNS).eq('id', id).maybeSingle();
    if (result.error) throw new Unavailable();
    if (result.data === null) return null;
    const job = jobRow(result.data);
    if (job.id !== id) throw new Unavailable();
    const cycles = await activeCycles([id]);
    return { row: job, cycle: cycles.get(id) ?? null, job: facts(job, cycles.get(id) ?? null) };
  };
  const jobSources = (job: JobFacts, observed: string): JobSourceReference[] => [
    { relation: 'jobs', job_id: job.job_id, record_id: job.job_id, record_updated_at: job.original.updated_at, observed_at: observed },
    ...(job.effective.rework_cycle_id ? [{ relation: 'production_rework_cycles' as const, job_id: job.job_id, record_id: job.effective.rework_cycle_id, record_updated_at: job.effective.updated_at, observed_at: observed }] : []),
  ];
  return {
    async execute(tool: TenbotJobToolName, suppliedArgs: Record<string, unknown> = {}): Promise<JobToolResult> {
      const now = options.now?.() ?? new Date(), observed = now.toISOString();
      const result: JobToolResult = { tool, version: 'tenbot-job-read.v1', status: 'ok', observed_at: observed, read_started_at: observed, read_completed_at: observed, consistency: 'best_effort_multi_query', timezone: 'America/Chicago', filters: {}, units: {}, sources: [], unknowns: [], complete: true, truncated: false, data: null };
      let verifiedIds: string[] = [];
      const partial = (message: string, truncated = false) => { result.status = 'partial'; result.complete = false; result.truncated ||= truncated; result.unknowns.push(message); };
      try {
        if (!await capability('readOperationalData')) { result.status = 'not_found_or_not_authorized'; result.complete = false; return result; }
        if (!object(suppliedArgs)) throw new InvalidInput();
        const args = suppliedArgs, today = chicagoDate(now);
        if (tool === 'find_jobs') {
          strictKeys(args, ['query', 'include_archived', 'limit', 'cursor']);
          if (args.query !== undefined && (typeof args.query !== 'string' || args.query.length > 120 || /[\u0000-\u001f\u007f]/.test(args.query))) throw new InvalidInput();
          const query = typeof args.query === 'string' ? args.query.trim() : '', archived = includeArchived(args), limit = resultLimit(args);
          if (args.cursor !== undefined && (typeof args.cursor !== 'string' || !/^\d{1,4}$/.test(args.cursor) || Number(args.cursor) >= TENBOT_JOB_TOOL_LIMITS.jobs)) throw new InvalidInput();
          const offset = Number(args.cursor ?? 0);
          result.filters = { query, include_archived: archived, limit, cursor: offset, fixture_scope: 'excluded_except_exact_admin_lookup' };
          result.units = { jobs: 'jobs' };
          let candidates: JobRow[] = [], match: JobFindData['match'] = query ? 'search' : 'browse';
          if (isUuid(query)) {
            const loaded = await loadJob(query);
            if (loaded && (archived || !loaded.job.archived)) candidates = [loaded.row];
            match = 'exact';
          } else {
            if (query) {
              const admin = await capability('manageUsers'), literal = searchValue(query, false);
              const exact = await scan(() => {
                let q = caller.from('jobs').select(JOB_COLUMNS, { count: 'exact' }).or(`job_number.ilike.${literal},name.ilike.${literal}`);
                if (!archived) q = q.is('archived_at', null);
                if (!admin) q = q.not('id', 'eq', TENBOT_EXCLUDED_JOB_FIXTURE_ID);
                return q;
              }, TENBOT_JOB_TOOL_LIMITS.jobs);
              if (!exact.complete) { partial('Exact Job lookup exceeded the bounded complete scope.', true); return result; }
              candidates = exact.rows.map(jobRow).filter(job => normalize(job.job_number ?? '') === normalize(query) || normalize(job.name) === normalize(query));
              if (candidates.length) match = 'exact';
            }
            if (!candidates.length) {
              const search = await scan(() => {
                let q = caller.from('jobs').select(JOB_COLUMNS, { count: 'exact' }).not('id', 'eq', TENBOT_EXCLUDED_JOB_FIXTURE_ID);
                if (!archived) q = q.is('archived_at', null);
                if (query) { const literal = searchValue(query, true); q = q.or(`job_number.ilike.${literal},name.ilike.${literal},customer.ilike.${literal}`); }
                return q;
              }, TENBOT_JOB_TOOL_LIMITS.jobs);
              if (!search.complete) { partial('Job lookup exceeded the bounded complete scope. Use a specific Job number or name.', true); return result; }
              candidates = search.rows.map(jobRow);
            }
          }
          const page = candidates.slice(offset, offset + limit), cycles = await activeCycles(page.map(job => job.id));
          const jobs = page.map(job => facts(job, cycles.get(job.id) ?? null)), more = offset + page.length < candidates.length;
          result.data = { jobs, match, has_more: more, next_cursor: more ? String(offset + page.length) : null };
          verifiedIds = jobs.map(job => job.job_id);
          result.truncated = more;
          result.sources = jobs.flatMap(job => jobSources(job, observed));
          return result;
        }
        if (tool === 'get_production_overview') {
          strictKeys(args, ['include_archived', 'start_date', 'end_date', 'limit']);
          const archived = includeArchived(args), range = period(args, today, true), limit = resultLimit(args);
          result.filters = { include_archived: archived, ...range, upcoming_statuses: [...ACTIVE_PRODUCTION_STATUSES], fixture_scope: 'excluded', limit };
          result.units = { jobs: 'jobs', active_jobs: 'jobs', scheduled: 'jobs', unscheduled: 'jobs', upcoming: 'jobs', dates: 'calendar_date' };
          const empty: JobOverviewData = { counts: { jobs: null, active_jobs: null, by_status: Object.fromEntries(STATUSES.map(status => [status, null])), scheduled: null, unscheduled: null }, upcoming: [], has_more_upcoming: false };
          result.data = empty;
          const loaded = await scan(() => {
            let q = caller.from('jobs').select(JOB_COLUMNS, { count: 'exact' }).not('id', 'eq', TENBOT_EXCLUDED_JOB_FIXTURE_ID);
            if (!archived) q = q.is('archived_at', null);
            return q;
          }, TENBOT_JOB_TOOL_LIMITS.jobs);
          if (!loaded.complete) { partial('The Job scope is incomplete; exact counts and upcoming lists are unavailable.', true); return result; }
          const rows = loaded.rows.map(jobRow), cycles = await activeCycles(rows.map(job => job.id)), jobs = rows.map(job => facts(job, cycles.get(job.id) ?? null));
          verifiedIds = rows.map(job => job.id);
          const byStatus = Object.fromEntries(STATUSES.map(status => [status, 0]));
          for (const job of jobs) byStatus[job.effective.status] += 1;
          const scheduled = jobs.filter(job => job.effective.planned_start && job.effective.planned_end).length;
          const upcoming = jobs.filter(job => !job.archived && ACTIVE_PRODUCTION_STATUSES.includes(job.effective.status) && job.effective.planned_end && job.effective.planned_end >= range.start_date && job.effective.planned_end <= range.end_date)
            .sort((a, b) => a.effective.planned_end!.localeCompare(b.effective.planned_end!) || a.job_id.localeCompare(b.job_id));
          result.data = { counts: { jobs: jobs.length, active_jobs: jobs.filter(job => !job.archived && ACTIVE_PRODUCTION_STATUSES.includes(job.effective.status)).length, by_status: byStatus, scheduled, unscheduled: jobs.length - scheduled },
            upcoming: upcoming.slice(0, limit).map(job => ({ job_id: job.job_id, reference: job.reference, planned_end: job.effective.planned_end!, lifecycle: job.effective.lifecycle })), has_more_upcoming: upcoming.length > limit };
          result.truncated = upcoming.length > limit;
          result.sources = [{ relation: 'jobs', observed_at: observed }, { relation: 'production_rework_cycles', observed_at: observed }];
          return result;
        }
        if (!['get_job_summary', 'get_job_planning', 'get_job_labor_summary'].includes(tool)) throw new InvalidInput();
        strictKeys(args, tool === 'get_job_labor_summary' ? ['job_id', 'start_date', 'end_date'] : ['job_id']);
        if (!isUuid(args.job_id)) throw new InvalidInput();
        const range = tool === 'get_job_labor_summary' ? period(args, today) : null;
        result.filters = { job_id: args.job_id, ...(range ?? {}), lifecycle: 'effective_with_original_preserved' };
        const loaded = await loadJob(args.job_id);
        if (!loaded) { result.status = 'not_found_or_not_authorized'; result.complete = false; return result; }
        const job = loaded.job;
        verifiedIds = [job.job_id];
        result.filters.job_id = job.job_id;
        result.sources = jobSources(job, observed);
        if (tool === 'get_job_summary') {
          result.units = { rework_cycles: 'cycles', active_rework_cycles: 'cycles', open_follow_ups: 'recorded_follow_ups', dates: 'calendar_date' };
          const [reworks, followups] = await Promise.all([
            count(() => caller.from('production_rework_cycles').select('id', { count: 'exact', head: true }).eq('job_id', job.job_id)),
            count(() => caller.from('job_updates').select('id', { count: 'exact', head: true }).eq('job_id', job.job_id).eq('requires_follow_up', true).is('resolved_at', null)),
          ]);
          if (reworks === null) partial('The recorded Rework count is unavailable.');
          if (followups === null) partial('The recorded open-follow-up count is unavailable.');
          result.data = { job, counts: { rework_cycles: reworks, active_rework_cycles: loaded.cycle ? 1 : 0, open_follow_ups: followups } };
          result.sources.push({ relation: 'production_rework_cycles', job_id: job.job_id, observed_at: observed }, { relation: 'job_updates', job_id: job.job_id, observed_at: observed });
          result.unknowns.push('Planning completeness and recorded Material Status do not establish physical readiness or absence of blockers.');
          return result;
        }
        if (tool === 'get_job_planning') {
          result.units = { dates: 'calendar_date' };
          result.data = { job, phases: { availability: 'disabled', reason: 'Phase and Item Planning is disabled in the released application.' }, schedule_is_persisted: true };
          result.unknowns.push('Phase/Item progress and a complete remaining-work list are unavailable. Unsaved schedule proposals are excluded.');
          return result;
        }
        const window = range!;
        result.units = { total_hours: 'hours', original_or_unclassified_hours: 'hours', reworks: 'hours', daily: 'hours', entry_count: 'recorded_entries', dates: 'calendar_date' };
        const data: JobLaborData = { job, period: window, total_hours: null, entry_count: null, original_or_unclassified_hours: null, reworks: [], daily: [], latest_work_date: null };
        result.data = data;
        result.sources.push({ relation: 'manpower_entries', job_id: job.job_id, observed_at: observed });
        let labor: { rows: unknown[]; complete: boolean };
        try {
          labor = await scan(() => caller.from('manpower_entries').select(LABOR_COLUMNS, { count: 'exact' }).eq('job_id', job.job_id).gte('work_date', window.start_date).lte('work_date', window.end_date), TENBOT_JOB_TOOL_LIMITS.labor_entries);
        } catch { partial('The recorded labor period is unavailable; the verified Job facts remain available.'); return result; }
        if (!labor.complete) { partial('The bounded labor period is incomplete; exact labor totals are unavailable.', true); return result; }
        const daily = new Map<string, number>(), reworks = new Map<string, { units: number; count: number }>();
        let total = 0, original = 0;
        for (const value of labor.rows) {
          if (!object(value) || value.job_id !== job.job_id || !date(value.work_date) || value.work_date < window.start_date || value.work_date > window.end_date || !(value.rework_cycle_id === null || isUuid(value.rework_cycle_id)) || ![value.am_hours, value.pm_hours].every(v => (typeof v === 'number' || typeof v === 'string' && /^\d+(?:\.\d+)?$/.test(v)) && Number.isFinite(Number(v)) && Number(v) >= 0)) { partial('A recorded labor entry is incomplete or invalid; exact labor totals are unavailable.'); data.latest_work_date = null; return result; }
          const units = entryHundredths({ am_hours: value.am_hours as number | string | null, pm_hours: value.pm_hours as number | string | null });
          if (!Number.isSafeInteger(units) || !Number.isSafeInteger(total + units)) throw new Unavailable();
          total += units;
          daily.set(value.work_date, (daily.get(value.work_date) ?? 0) + units);
          if (value.rework_cycle_id) { const item = reworks.get(value.rework_cycle_id as string) ?? { units: 0, count: 0 }; item.units += units; item.count += 1; reworks.set(value.rework_cycle_id as string, item); }
          else original += units;
          if (!data.latest_work_date || value.work_date > data.latest_work_date) data.latest_work_date = value.work_date;
        }
        // Totals cover every completely loaded entry; only a bounded set of
        // lifecycle labels enters the response or requires an extra lookup.
        const allCycleIds = [...reworks.keys()].sort(), cycleIds = allCycleIds.slice(0, 20), sequences = new Map<string, number>();
        for (let offset = 0; offset < cycleIds.length; offset += 200) {
          const scope = cycleIds.slice(offset, offset + 200);
          try {
            const cycles = await scan(() => caller.from('production_rework_cycles').select(REWORK_COLUMNS, { count: 'exact' }).eq('job_id', job.job_id).in('id', scope), scope.length);
            if (!cycles.complete) { partial('Some recorded Rework sequence labels are unavailable.'); continue; }
            for (const value of cycles.rows) { const cycle = cycleRow(value); if (cycle.job_id !== job.job_id || !scope.includes(cycle.id)) throw new Unavailable(); sequences.set(cycle.id, cycle.sequence_number); }
          } catch { partial('Some recorded Rework sequence labels are unavailable.'); }
        }
        data.total_hours = total / 100; data.entry_count = labor.rows.length; data.original_or_unclassified_hours = original / 100;
        data.reworks = cycleIds.map(id => { const item = reworks.get(id)!; return { rework_cycle_id: id, sequence_number: sequences.get(id) ?? null, hours: item.units / 100, entry_count: item.count }; }).sort((a, b) => (a.sequence_number ?? Infinity) - (b.sequence_number ?? Infinity) || a.rework_cycle_id.localeCompare(b.rework_cycle_id));
        for (let key = window.start_date; key <= window.end_date; key = shiftDate(key, 1)) data.daily.push({ date: key, hours: (daily.get(key) ?? 0) / 100 });
        if (cycleIds.some(id => !sequences.has(id))) { if (!result.unknowns.includes('Some recorded Rework sequence labels are unavailable.')) partial('Some recorded Rework sequence labels are unavailable.'); }
        if (allCycleIds.length > cycleIds.length) { result.truncated = true; result.unknowns.push('The Rework breakdown shows at most 20 lifecycles; complete period totals include the omitted lifecycles.'); }
        result.unknowns.push('These are recorded hours in the stated work-date period, not proof of all labor worked, a remaining-hours estimate or a forecast. Null Rework attribution is Original Production / Legacy Unclassified.');
        return result;
      } catch (error) {
        result.status = error instanceof InvalidInput ? 'invalid_request' : 'unavailable';
        result.complete = false; result.data = null; result.sources = [];
        result.unknowns = [error instanceof InvalidInput ? 'The tool arguments are outside the supported contract.' : 'Authorized operational records could not be verified. Retry or open the Production record.'];
        return result;
      } finally {
        // Compatibility table policies can be broader than account visibility.
        // Re-check capabilities AND the candidate UUIDs immediately before
        // returning any facts, including direct/no-inference and refresh paths.
        if (result.data !== null) {
          try {
            let allowed = await capability('readOperationalData');
            if (allowed && verifiedIds.includes(TENBOT_EXCLUDED_JOB_FIXTURE_ID)) allowed = await capability('manageUsers');
            for (let offset = 0; allowed && offset < verifiedIds.length; offset += 200) {
              const scope = verifiedIds.slice(offset, offset + 200);
              const visible = await scan(() => caller.from('jobs').select('id', { count: 'exact' }).in('id', scope), scope.length);
              allowed = visible.complete && visible.rows.length === scope.length && visible.rows.every(row => object(row) && scope.includes(String(row.id)));
            }
            if (!allowed) { result.status = 'not_found_or_not_authorized'; result.complete = false; result.data = null; result.sources = []; result.unknowns = ['The requested operational records are unavailable or no longer authorized.']; }
          } catch { result.status = 'unavailable'; result.complete = false; result.data = null; result.sources = []; result.unknowns = ['Current authorization could not be verified; no operational facts were returned.']; }
        }
        result.read_completed_at = (options.now?.() ?? new Date()).toISOString();
        result.observed_at = result.read_completed_at;
      }
    },
  };
}

/** One abort signal and deadline cover capability checks, all bounded pages and
 * final reauthorization together. The SDK cancels in-flight REST requests;
 * the race also bounds transports that do not implement cancellation. */
export function createTenbotJobTools(caller: JobToolCaller, options: { now?: () => Date; deadlineMs?: number } = {}) {
  const deadlineMs = options.deadlineMs ?? 4000;
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 10000) throw new Error('Invalid operational tool deadline.');
  return {
    async execute(tool: TenbotJobToolName, args: Record<string, unknown> = {}): Promise<JobToolResult> {
      const controller = new AbortController();
      let rejectDeadline: (error: Error) => void = () => {};
      const deadline = new Promise<never>((_resolve, reject) => { rejectDeadline = reject; });
      // Mark the shared rejection handled even when a synchronous query fails
      // before its first await. Every actual query still races this deadline.
      void deadline.catch(() => {});
      const timer = setTimeout(() => { controller.abort(); rejectDeadline(new Unavailable()); }, deadlineMs);
      const bounded = (query: JobToolQuery): JobToolQuery => new Proxy(query, {
        get(target, key) {
          if (key === 'then') return (resolve: (value: JobQueryResult) => unknown, reject: (error: unknown) => unknown) => Promise.race([Promise.resolve(target), deadline]).then(resolve, reject);
          const member = Reflect.get(target, key);
          if (typeof member !== 'function') return member;
          return (...parameters: unknown[]) => {
            const next: unknown = Reflect.apply(member, target, parameters);
            return next && typeof next === 'object' && 'then' in next ? bounded(next as JobToolQuery) : next;
          };
        },
      });
      const scoped: JobDataReader = {
        from(table) { return { select(columns, selectOptions) {
          if (controller.signal.aborted) throw new Unavailable();
          const source = caller.from(table) as ReturnType<JobDataReader['from']>;
          if (!source || typeof source.select !== 'function') throw new Unavailable();
          const query = source.select(columns, selectOptions);
          if (!query || typeof query.abortSignal !== 'function') throw new Unavailable();
          return bounded(query.abortSignal(controller.signal));
        } }; },
        rpc(name, rpcArgs) {
          if (controller.signal.aborted) return Promise.reject(new Unavailable());
          const request = caller.rpc(name, rpcArgs) as ReturnType<JobToolCaller['rpc']> & { abortSignal?: (signal: AbortSignal) => ReturnType<JobToolCaller['rpc']> };
          return Promise.race([Promise.resolve(typeof request.abortSignal === 'function' ? request.abortSignal(controller.signal) : request), deadline]);
        },
      };
      try { return await createJobToolRunner(scoped, options).execute(tool, args); }
      finally { clearTimeout(timer); controller.abort(); }
    },
  };
}
