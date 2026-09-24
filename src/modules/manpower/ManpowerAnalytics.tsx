'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAccountPreferences } from '@/lib/account-preferences';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ManpowerEntry, ManpowerReference } from './types';
import { aggregateLabor, LABOR_PERIODS, laborColorSlot, laborDateLabel, laborPeriod, localLaborToday, type LaborPeriodDays, type LaborSlice, type LaborJob, laborColorSlots, laborColorValue } from './analytics';
import { entryHundredths, productKey, productLabel } from './product-reporting';
import styles from './ManpowerAnalytics.module.css';

const ChartColors = createContext<{ slots: Map<string, string>; inactive: Set<string> }>({ slots: new Map(), inactive: new Set() });
function ColorMark({ id, className, style, dim, description }: { id: string; className: string; style?: React.CSSProperties; dim?: boolean; description?: string }) {
  const colors = useContext(ChartColors);
  const slot = colors.slots.get(id) ?? laborColorSlot(id);
  return <span className={className} title={description} data-category-color={id} data-inactive={colors.inactive.has(id)} data-dim={dim} aria-hidden="true" style={{ ...style, '--labor-color': laborColorValue(slot) } as React.CSSProperties} />;
}

const hours = (units: number) => `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(units / 100)} h`;
const periodName = (days: LaborPeriodDays) => days === 'year' ? '1 Year' : `${days} Days`;
const compositionDescription = (products: LaborSlice[]) => products.map(p => `${p.label}: ${hours(p.units)}`).join('; ');
type Detail = { kind: 'task' | 'product' | 'week'; id: string } | { kind: 'job'; id: string; categoryId?: string; taskId?: string };
function Stack({ products, total, maximum = total, focus }: { products: LaborSlice[]; total: number; maximum?: number; focus: string }) {
  return <div className={styles.track} aria-hidden="true"><div className={styles.stack} style={{ width: `${maximum ? total / maximum * 100 : 0}%` }}>{products.map(p => <ColorMark key={p.id} id={p.id} description={`${p.label}: ${hours(p.units)}`} className={styles.segment} dim={Boolean(focus && p.id !== focus)} style={{ width: `${total ? p.units / total * 100 : 0}%` }} />)}</div></div>;
}
function JobAnalyticsPanel({ jobs, focus, period, onReview }: { jobs: LaborJob[]; focus: string; period: string; onReview(detail: Extract<Detail, { kind: 'job' }>): void }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  return <>{jobs.slice(0, 5).map(job => {
    const expanded = jobId === job.id;
    const category = job.products.find(p => p.id === categoryId);
    const task = category?.tasks.find(t => t.id === taskId);
    return <div className={styles.row} key={job.id}>
      <button type="button" className={styles.rowButton} aria-expanded={expanded} aria-controls={`job-analytics-${job.id}`}
        onClick={() => { setJobId(expanded ? null : job.id); setCategoryId(null); setTaskId(null); }}
        title={job.label} aria-label={`${job.label}, ${hours(job.units)}; ${compositionDescription(job.products)}`}>
        <span className={styles.label}>{expanded ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}{job.label}</span><strong className={styles.value}>{hours(job.units)}</strong>
      </button>
      <Stack products={job.products} total={job.units} maximum={jobs[0].units} focus={focus} />
      {expanded && <div className={styles.jobDetail} id={`job-analytics-${job.id}`} role="region" aria-label={`Job breakdown: ${job.label}`}>
        <p className={styles.muted}>{period} · Share of this Job’s hours</p>
        {job.products.map(product => <div key={product.id}>
          <button type="button" className={styles.rowButton} aria-expanded={categoryId === product.id} aria-controls={`job-category-${job.id}-${product.id}`} title={product.label}
            onClick={() => { setCategoryId(categoryId === product.id ? null : product.id); setTaskId(null); }}>
            <span className={styles.label}><ColorMark id={product.id} className={styles.swatch} />{product.label}</span>
            <span className={styles.value}>{hours(product.units)} · {(product.units / job.units * 100).toFixed(1)}%</span>
          </button>
          {categoryId === product.id && <div id={`job-category-${job.id}-${product.id}`} className={styles.taskDetail} role="region" aria-label={`Task breakdown: ${product.label}`}>
            {product.tasks.map(item => <button type="button" key={item.id} className={styles.rowButton} title={item.label} aria-pressed={taskId === item.id}
              onClick={() => setTaskId(taskId === item.id ? null : item.id)}><span className={styles.label}>{item.label}</span><span className={styles.value}>{hours(item.units)}</span></button>)}
          </div>}
        </div>)}
        <p className={styles.muted}>Entry scope: {category?.label ?? 'All Products'} · {task?.label ?? 'All Tasks'} · {hours(task?.units ?? category?.units ?? job.units)}</p>
        <button type="button" className={styles.button} onClick={() => onReview({ kind: 'job', id: job.id, categoryId: category?.id, taskId: task?.id })}>View matching entries</button>
      </div>}
    </div>;
  })}</>;
}
export default function ManpowerAnalytics({ entries, categories, tasks, jobId, productFocus, loading, error }: {
  entries: ManpowerEntry[]; categories: ManpowerReference[]; tasks: ManpowerReference[]; jobId: string | null;
  productFocus: string; loading: boolean; error: string;
}) {
  const [days, setDays] = useState<LaborPeriodDays>(30);
  const accountPreferences = useAccountPreferences();
  const expanded = accountPreferences.preferences.manpower_recent_labor_expanded === true;
  const [preferenceSaving, setPreferenceSaving] = useState(false);
  const [preferenceFailure, setPreferenceFailure] = useState('');
  const toggleExpanded = async () => {
    if (preferenceSaving || !accountPreferences.ready) return;
    setPreferenceSaving(true); setPreferenceFailure('');
    try { await accountPreferences.setPreference('manpower_recent_labor_expanded', !expanded); }
    catch { setPreferenceFailure('That account preference could not be saved. The current page remains usable.'); }
    finally { setPreferenceSaving(false); }
  };
  const [today, setToday] = useState(localLaborToday);
  const detailScope = `${days}:${jobId}:${today}`;
  const [detailState, setDetailState] = useState<{ scope: string; detail: Detail } | null>(null);
  const detail = detailState?.scope === detailScope ? detailState.detail : null;
  const setDetail = (next: Detail | null) => setDetailState(next ? { scope: detailScope, detail: next } : null);
  const [showEntries, setShowEntries] = useState(false);
  useEffect(() => {
    const tick = () => setToday(localLaborToday());
    const timer = window.setInterval(tick, 60000); window.addEventListener('focus', tick);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', tick); };
  }, []);
  const data = useMemo(() => aggregateLabor(entries, categories, tasks, laborPeriod(days, today), jobId), [entries, categories, tasks, days, today, jobId]);
  const colors = useMemo(() => ({ slots: laborColorSlots(categories), inactive: new Set(categories.filter(c => !c.is_active).map(c => c.id)) }), [categories]);
  const available = !loading && !error;
  const openDetail = (next: Detail) => { setDetail(next); setShowEntries(false); };
  const detailJob = detail?.kind === 'job' ? data.jobs.find(job => job.id === detail.id) : undefined;
  const detailCategory = detail?.kind === 'job' ? detailJob?.products.find(p => p.id === detail.categoryId) : undefined;
  const detailTask = detail?.kind === 'job' ? detailCategory?.tasks.find(t => t.id === detail.taskId) : undefined;
  const selected = detail?.kind === 'job' ? detail.taskId ? detailTask : detail.categoryId ? detailCategory : detailJob : detail?.kind === 'task' ? data.tasks.find(t => t.id === detail.id) : detail?.kind === 'product' ? data.products.find(p => p.id === detail.id) : data.weeks.find(w => w.id === detail?.id);
  const detailRows = showEntries && selected && detail ? data.entries.filter(e => detail.kind === 'job' ? e.job_id === detail.id && (!detail.categoryId || productKey(e) === detail.categoryId) && (!detail.taskId || e.task_id === detail.taskId) : detail.kind === 'task' ? e.task_id === detail.id : detail.kind === 'product' ? productKey(e) === detail.id : e.work_date >= detail.id && e.work_date <= data.weeks.find(w => w.id === detail.id)!.end) : [];
  const detailSlices: LaborSlice[] = detail?.kind === 'job' ? detailCategory ? [{ ...detailCategory, units: selected?.units ?? 0 }] : detailJob?.products ?? [] : detail?.kind === 'task' ? data.tasks.find(t => t.id === detail.id)?.products ?? [] : detail?.kind === 'week' ? data.weeks.find(w => w.id === detail.id)?.products ?? [] : selected ? [{ id: selected.id, label: selected.label, units: selected.units }] : [];
  const selectedWeek = detail?.kind === 'week' ? data.weeks.find(w => w.id === detail.id) : undefined;
  const detailTitle = detailJob ? [detailJob.label, detailCategory?.label, detailTask?.label].filter(Boolean).join(' → ') : selectedWeek ? `${selectedWeek.partial ? `Partial ${data.trendUnit}` : data.trendUnit === 'month' ? 'Month' : 'Week'} · ${laborDateLabel(selectedWeek.start)}–${laborDateLabel(selectedWeek.end)}` : selected?.label;
  const maxWeek = Math.max(1, ...data.weeks.map(w => w.units));
  const summary = available ? <><span className={styles.value} data-testid="analytics-total">{hours(data.total)}</span><span className={styles.muted}>{data.total ? `${(data.categorized / data.total * 100).toFixed(1)}% categorized` : 'No labor recorded in this period'}</span><span className={styles.muted}>Latest work {data.latest ? laborDateLabel(data.latest) : '—'}</span></> : <span role="status" className={styles.muted}>{loading ? 'Loading complete labor…' : 'Analytics unavailable — complete labor could not be loaded.'}</span>;
  return <ChartColors.Provider value={colors}><section className={styles.band} aria-label="Recent labor" data-testid="recent-labor">
    <div className={styles.header}>
      <button type="button" className={styles.disclosure} aria-label="Recent labor" aria-expanded={expanded} aria-controls="recent-labor-panels" disabled={!accountPreferences.ready || preferenceSaving} aria-busy={preferenceSaving} onClick={() => void toggleExpanded()}><span className={styles.chevron} aria-hidden="true">{expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span><span className={styles.summary}><strong>Recent labor</strong><span>{periodName(days)}</span>{summary}</span></button>
      <div className={styles.controls} aria-label="Recent labor period">{LABOR_PERIODS.map(value => <button type="button" key={value} className={styles.button} aria-pressed={days === value} onClick={() => { setDays(value); setDetail(null); setShowEntries(false); }}>{periodName(value)}</button>)}</div>
    </div>
    {(accountPreferences.error || preferenceFailure) && <p role="status" className={styles.scope}>{accountPreferences.error || preferenceFailure}</p>}
    <p className={styles.scope}>{data.period.start} – {data.period.end}{data.period.start !== data.requestedPeriod.start && <> · Available recorded history</>} · {jobId ? 'Selected Job' : 'All Jobs + unlinked work'} · All Products · Entry search does not affect analytics.{productFocus && <> Focus: {productLabel(productFocus, categories)} · {hours(data.products.find(p => p.id === productFocus)?.units ?? 0)}; totals unchanged.</>}</p>
    <div id="recent-labor-panels" hidden={!expanded}>
      {available && <div className={styles.grid}>
        <section className={styles.panel} aria-label="Recent Labor Trend"><h3 className={styles.title}>Recent Labor Trend</h3><div className={styles.weekChart}>{data.weeks.map((week, index) => <button type="button" className={styles.week} key={week.id} onClick={() => openDetail({ kind: 'week', id: week.id })} aria-label={`${week.start} to ${week.end}${week.partial ? `, partial ${data.trendUnit}` : ''}: ${hours(week.units)}${week.units ? '' : ', No labor recorded'}; ${compositionDescription(week.products)}`}>
          <span className={styles.value} style={{ visibility: data.weeks.length > 6 && index % 2 !== 0 ? 'hidden' : undefined }}>{week.units ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(week.units / 100) : '—'}</span>
          <span className={styles.column} style={{ height: `${week.units / maxWeek * 91}px` }} aria-hidden="true">{week.products.map(p => <ColorMark key={p.id} id={p.id} description={`${p.label}: ${hours(p.units)}`} className={styles.segment} dim={Boolean(productFocus && productFocus !== p.id)} style={{ height: `${week.units ? p.units / week.units * 100 : 0}%` }} />)}</span>
          <span className={styles.weekDate}>{data.weeks.length <= 6 || index % 2 === 0 ? (data.trendUnit === 'month' ? laborDateLabel(week.start).split(' ')[0] : laborDateLabel(week.start).replace(' ', '\u00a0')) : '·'}{week.partial ? '*' : ''}</span>
          {week.partial && <span className={styles.weekHint} aria-hidden="true">Partial {data.trendUnit} · {laborDateLabel(week.start)}–{laborDateLabel(week.end)}</span>}
        </button>)}</div><p className={styles.muted}>{data.trendUnit === 'month' ? 'Monthly labor hours' : 'Weekly labor hours · Weeks start Monday'} · * Partial {data.trendUnit}</p></section>
        <section className={styles.panel} aria-label="Products"><h3 className={styles.title} title="Category colors are shared across all four panels">Products · Color key</h3>{data.products.map(p => <div key={p.id} className={styles.row}><button type="button" className={styles.rowButton} onClick={() => openDetail({ kind: 'product', id: p.id })} title={p.label}><span className={styles.label}><ColorMark id={p.id} className={styles.swatch} />{p.label}</span><span className={styles.value}>{hours(p.units)} · {(p.units / data.total * 100).toFixed(1)}%</span></button><Stack products={[p]} total={p.units} maximum={data.total} focus={productFocus} /></div>)}{!data.products.length && <p className={styles.muted}>No labor recorded.</p>}<p className={styles.muted}>Share of all period hours, including Uncategorized.{data.zeroCategories > 0 && <> {data.zeroCategories} active categories with no hours.</>}</p></section>
        <section className={styles.panel} aria-label="Top Jobs"><h3 className={styles.title}>Top Jobs</h3><JobAnalyticsPanel key={`${days}:${jobId}:${data.period.start}:${data.period.end}`} jobs={data.jobs} focus={productFocus} period={`${data.period.start} – ${data.period.end}`} onReview={next => { setDetail(next); setShowEntries(true); }} />{data.jobs.length > 5 && <p className={styles.muted}>Other Jobs · {hours(data.jobs.slice(5).reduce((sum, j) => sum + j.units, 0))}</p>}{data.unlinked > 0 && <p className={styles.muted}>Unlinked work · {hours(data.unlinked)}</p>}{!data.jobs.length && <p className={styles.muted}>No Job-linked labor recorded.</p>}<p className={styles.muted}>Select a Job, then a Product for Task hours.</p></section>
        <section className={styles.panel} aria-label="Task Hotspots"><h3 className={styles.title}>Task Hotspots</h3>{data.tasks.slice(0, 5).map(t => <div className={styles.row} key={t.id}><button type="button" className={styles.rowButton} onClick={() => openDetail({ kind: 'task', id: t.id })} title={`${t.label} — ${compositionDescription(t.products)}`} aria-label={`${t.label}, ${hours(t.units)}; ${compositionDescription(t.products)}`}><span className={styles.label}>{t.label}</span><strong className={styles.value}>{hours(t.units)}</strong></button><Stack products={t.products} total={t.units} maximum={data.tasks[0].units} focus={productFocus} /></div>)}{data.tasks.length > 5 && <p className={styles.muted}>Other Tasks · {hours(data.tasks.slice(5).reduce((sum, t) => sum + t.units, 0))}</p>}{!data.tasks.length && <p className={styles.muted}>No labor recorded.</p>}<p className={styles.muted}>Select a Task for its Product composition.</p></section>
      </div>}
      {available && selected && <section className={styles.detail} aria-label="Labor analytics detail"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{detailTitle} · {hours(selected.units)}</strong><button type="button" className={styles.button} onClick={() => setDetail(null)}>Close detail</button></div><p className={styles.muted}>{data.period.start} – {data.period.end}{data.period.start !== data.requestedPeriod.start && <> · Available recorded history</>} · {detailJob ? <>Selected Job · {detailCategory?.label ?? 'All Products'} · {detailTask?.label ?? 'All Tasks'}</> : <>{jobId ? 'Selected Job' : 'All Jobs + unlinked work'} · All Products; focus does not exclude hours.</>}</p><ul className={styles.detailList}>{detailSlices.map(p => <li key={p.id}><ColorMark id={p.id} className={styles.swatch} />{p.label} · {hours(p.units)}</li>)}</ul><button className={styles.button} type="button" aria-expanded={showEntries} onClick={() => setShowEntries(!showEntries)}>{showEntries ? 'Hide matching entries' : 'View matching entries'}</button>
        {showEntries && <div className={styles.entries} tabIndex={0} aria-label="Matching labor entries"><p className={styles.muted}>Read-only detail · {detailRows.length} entries. Editable reporting groups and bulk selection are unchanged.</p><table><thead><tr>{['Work date', 'Job / Work', 'Worker', 'Task', 'Product', 'Hours'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{detailRows.map(e => <tr key={e.id}><td>{e.work_date}</td><td>{e.job?.name ?? e.unlisted_work_label ?? 'Unlinked work'}</td><td>{e.worker.display_name}</td><td>{e.task.display_name}</td><td>{productLabel(productKey(e), categories)}</td><td>{hours(entryHundredths(e))}</td></tr>)}</tbody></table></div>}
      </section>}
    </div>
  </section></ChartColors.Provider>;
}
