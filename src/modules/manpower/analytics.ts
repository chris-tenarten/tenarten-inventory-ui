import type { ManpowerEntry, ManpowerReference } from './types';
import { entryHundredths, productKey, productLabel, UNCATEGORIZED } from './product-reporting';

export const LABOR_PERIODS = [30, 90, 'year'] as const;
export type LaborPeriodDays = typeof LABOR_PERIODS[number];
export type LaborPeriod = { start: string; end: string; days: LaborPeriodDays };
export type LaborSlice = { id: string; label: string; units: number };
export type LaborRank = LaborSlice & { products: LaborSlice[] };
export type LaborJob = Omit<LaborRank, 'products'> & { products: (LaborSlice & { tasks: LaborSlice[] })[] };
export type LaborWeek = LaborRank & { start: string; end: string; partial: boolean };
const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const calendarDate = (key: string) => new Date(`${key}T12:00:00Z`);
export function shiftLaborDate(key: string, days: number) {
  const date = calendarDate(key); date.setUTCDate(date.getUTCDate() + days); return dateKey(date);
}
export function localLaborToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function laborPeriod(days: LaborPeriodDays, today = localLaborToday()): LaborPeriod {
  if (days === 'year') {
    // Inclusive trailing calendar year; clamp Feb 29's anniversary to Feb 28.
    const date = calendarDate(today), year = date.getUTCFullYear() - 1, month = date.getUTCMonth();
    const day = Math.min(date.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
    const anniversary = dateKey(new Date(Date.UTC(year, month, day, 12)));
    return { start: shiftLaborDate(anniversary, 1), end: today, days };
  }
  return { start: shiftLaborDate(today, 1 - days), end: today, days };
}
function monthStart(key: string) { return key.slice(0, 7) + '-01'; }
function nextMonth(key: string) { const date = calendarDate(monthStart(key)); date.setUTCMonth(date.getUTCMonth() + 1); return dateKey(date); }
function monday(key: string) { return shiftLaborDate(key, -((calendarDate(key).getUTCDay() + 6) % 7)); }
export const laborDateLabel = (key: string) => calendarDate(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
/** UUID-derived palette slot: independent of vocabulary names, ordering and filters. */
export function laborColorSlot(id: string) {
  if (id === UNCATEGORIZED) return 'uncategorized';
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return String((hash >>> 0) % 12);
}


/** Allocate from the full vocabulary, including inactive/unused categories. Existing
 * creation order reserves slots before later additions; UUID resolves ties and
 * determines the preferred color. Names, sort order and selected period never do. */
export function laborColorSlots(categories: ManpowerReference[]) {
  const used = new Set<number>(), slots = new Map<string, string>();
  for (const category of [...categories].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))) {
    let slot = Number(laborColorSlot(category.id));
    while (used.has(slot)) slot += 1;
    used.add(slot); slots.set(category.id, String(slot));
  }
  slots.set(UNCATEGORIZED, 'uncategorized');
  return slots;
}
/** Extra vocabulary slots retain the same muted family with a distinct tone. */
export function laborColorValue(slot: string) {
  if (slot === 'uncategorized') return 'var(--labor-uncategorized)';
  const n = Number(slot), base = `var(--labor-palette-${n % 12})`;
  return n < 12 ? base : `color-mix(in srgb, ${base} ${Math.max(45, 88 - Math.floor(n / 12) * 8)}%, var(--surface-primary))`;
}

/** One pass over complete authoritative entries; all accounting uses integer hundredths. */
export function aggregateLabor(entries: ManpowerEntry[], categories: ManpowerReference[], tasks: ManpowerReference[], period: LaborPeriod, jobId: string | null) {
  const monthly = period.days === 'year';
  const requestedPeriod = period;
  if (monthly) {
    const earliest = entries.reduce<string | null>((first, entry) =>
      (!jobId || entry.job_id === jobId) && entry.work_date <= period.end && (!first || entry.work_date < first) ? entry.work_date : first, null);
    if (earliest && earliest > period.start) period = { ...period, start: earliest };
  }
  const bucketStart = monthly ? monthStart : monday;
  const bucketNext = monthly ? nextMonth : (key: string) => shiftLaborDate(key, 7);
  const bucketEnd = (key: string) => shiftLaborDate(bucketNext(key), -1);
  const categoryById = new Map(categories.map(c => [c.id, c]));
  const taskById = new Map(tasks.map(t => [t.id, t.display_name]));
  const products = new Map<string, LaborSlice>();
  type Bucket = { id: string; label: string; units: number; products: Map<string, LaborSlice> };
  const jobs = new Map<string, Bucket>(), taskBuckets = new Map<string, Bucket>(), weeks = new Map<string, Bucket>();
  const jobTasks = new Map<string, Map<string, Map<string, LaborSlice>>>();
  const scopedEntries: ManpowerEntry[] = [];
  let total = 0, categorized = 0, unlinked = 0, latest: string | null = null;
  for (let key = bucketStart(period.start); key <= period.end; key = bucketNext(key)) weeks.set(key, { id: key, label: laborDateLabel(key), units: 0, products: new Map() });
  const add = (map: Map<string, LaborSlice>, id: string, label: string, units: number) => {
    const item = map.get(id) ?? { id, label, units: 0 }; item.units += units; map.set(id, item);
  };
  const bucket = (map: Map<string, Bucket>, id: string, label: string, product: string, productName: string, units: number) => {
    const item = map.get(id) ?? { id, label, units: 0, products: new Map() };
    item.units += units; add(item.products, product, productName, units); map.set(id, item);
  };
  for (const entry of entries) {
    if (jobId && entry.job_id !== jobId) continue;
    if (entry.work_date > period.end) continue;
    if (!latest || entry.work_date > latest) latest = entry.work_date;
    if (entry.work_date < period.start) continue;
    scopedEntries.push(entry);
    const units = entryHundredths(entry), product = productKey(entry), category = categoryById.get(product);
    const name = product === UNCATEGORIZED ? 'Uncategorized' : category ? `${category.display_name}${category.is_active ? '' : ' · Inactive'}` : 'Unavailable category';
    total += units; if (product !== UNCATEGORIZED) categorized += units;
    add(products, product, name, units);
    bucket(weeks, bucketStart(entry.work_date), '', product, name, units);
    bucket(taskBuckets, entry.task_id, taskById.get(entry.task_id) ?? entry.task.display_name, product, name, units);
    if (entry.job_id) {
      bucket(jobs, entry.job_id, entry.job ? [entry.job.job_number, entry.job.name].filter(Boolean).join(' — ') : 'Unavailable Job', product, name, units);
      const categories = jobTasks.get(entry.job_id) ?? new Map<string, Map<string, LaborSlice>>();
      const tasks = categories.get(product) ?? new Map<string, LaborSlice>();
      add(tasks, entry.task_id, taskById.get(entry.task_id) ?? entry.task.display_name, units);
      categories.set(product, tasks); jobTasks.set(entry.job_id, categories);
    }
    else unlinked += units;
  }
  const order = (a: LaborSlice, b: LaborSlice) => {
    if (a.id === UNCATEGORIZED) return b.id === UNCATEGORIZED ? 0 : 1;
    if (b.id === UNCATEGORIZED) return -1;
    return (categoryById.get(a.id)?.sort_order ?? Infinity) - (categoryById.get(b.id)?.sort_order ?? Infinity) || a.label.localeCompare(b.label) || a.id.localeCompare(b.id);
  };
  const materialize = (b: Bucket): LaborRank => ({ ...b, products: [...b.products.values()].filter(p => p.units > 0).sort(order) });
  const ranked = (map: Map<string, Bucket>) => [...map.values()].filter(b => b.units > 0).map(materialize).sort((a, b) => b.units - a.units || a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
  return {
    period, requestedPeriod, trendUnit: monthly ? 'month' as const : 'week' as const, total, categorized, uncategorized: total - categorized, unlinked, latest, entries: scopedEntries,
    products: [...products.values()].filter(p => p.units > 0).sort(order), jobs: ranked(jobs).map(job => ({ ...job, products: job.products.map(product => ({ ...product,
      tasks: [...(jobTasks.get(job.id)?.get(product.id)?.values() ?? [])].filter(task => task.units > 0).sort((a, b) => b.units - a.units || a.label.localeCompare(b.label) || a.id.localeCompare(b.id)),
    })) })) as LaborJob[], tasks: ranked(taskBuckets),
    zeroCategories: categories.filter(c => c.is_active && !(products.get(c.id)?.units)).length,
    weeks: [...weeks.values()].map(b => ({ ...materialize(b), start: b.id < period.start ? period.start : b.id, end: bucketEnd(b.id) > period.end ? period.end : bucketEnd(b.id), partial: b.id < period.start || bucketEnd(b.id) > period.end })) as LaborWeek[],
  };
}
export type LaborAnalytics = ReturnType<typeof aggregateLabor>;
export { productLabel };
