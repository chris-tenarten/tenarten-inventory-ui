'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { archiveProductionJob } from '../jobs';
import { openProductionJob } from '../job-options';
import { loadMonthlySnapshot, type RankedValue, type SnapshotData } from '../snapshot';
import type { ProductionJob } from '../types';
import { getJobReadiness } from '../readiness';
import { JobTag } from './JobTag';
import ProductionStatusBadge from './ProductionStatusBadge';

const activeStatuses = new Set(['not_started', 'on_deck', 'in_production', 'on_hold']);
const terminalStatuses = new Set(['shipped', 'complete', 'cancelled']);
const hours = (value: number) => `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)}h`;
const count = (value: number) => new Intl.NumberFormat().format(value);
const formatDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

function Metrics({ items }: { items: Array<{ label: string; value: string; detail?: string }> }) {
  return <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-slate-200 bg-slate-200 sm:grid-cols-3 xl:grid-cols-6">{items.map((item) => <div key={item.label} className="min-h-20 bg-white px-3 py-3"><div className="text-[10px] font-bold uppercase tracking-[0.09em] text-slate-500">{item.label}</div><div className="mt-1 text-xl font-bold tabular-nums text-slate-950">{item.value}</div>{item.detail ? <div className="mt-0.5 text-[10px] text-slate-500">{item.detail}</div> : null}</div>)}</div>;
}

function RankedList({ title, items, empty, jobLinks = false, quantity = false }: { title: string; items: RankedValue[]; empty: string; jobLinks?: boolean; quantity?: boolean }) {
  return <section className="min-w-0"><h3 className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{title}</h3><div className="mt-2 divide-y divide-slate-200 border-y border-slate-200">{items.length ? items.map((item, index) => <div key={item.label} className="flex min-h-9 items-center gap-2 py-1.5 text-xs"><span className="w-4 shrink-0 text-slate-400">{index + 1}</span>{jobLinks && item.jobId ? <JobTag label={item.label} onClick={() => { window.location.href = `/manpower-reporting?job=${item.jobId}`; }} className="max-w-full" /> : <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{item.label}</span>}<strong className="ml-auto shrink-0 tabular-nums text-slate-900">{quantity ? count(item.value) : hours(item.value)}</strong></div>) : <div className="py-4 text-xs text-slate-500">{empty}</div>}</div></section>;
}

function DailyLaborChart({ values }: { values: Array<{ date: string; hours: number }> }) {
  const maximum = Math.max(0, ...values.map((item) => item.hours));
  return <div className="mt-4 border-y border-slate-200 py-3"><div className="flex items-baseline justify-between gap-3"><h3 className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Daily Reported Labor</h3><span className="text-[10px] text-slate-500">Peak {hours(maximum)}</span></div>{maximum > 0 ? <><div className="mt-3 flex h-24 items-end gap-px" role="img" aria-label="Daily reported labor hours for the last 30 days">{values.map((item) => <div key={item.date} title={`${formatDate(item.date)}: ${hours(item.hours)}`} className="group relative flex h-full min-w-0 flex-1 items-end"><span className="w-full min-h-px bg-blue-700/75 transition-colors group-hover:bg-blue-800" style={{ height: `${Math.max(item.hours > 0 ? 4 : 1, (item.hours / maximum) * 100)}%` }} /></div>)}</div><div className="mt-1 flex justify-between text-[9px] text-slate-500"><span>{formatDate(values[0].date)}</span><span>{formatDate(values[Math.floor(values.length / 2)].date)}</span><span>{formatDate(values[values.length - 1].date)}</span></div></> : <p className="mt-3 text-xs text-slate-500">No manpower was reported during this period.</p>}</div>;
}

export default function MonthlySnapshot() {
  const [data, setData] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(''); try { setData(await loadMonthlySnapshot()); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load the Monthly Snapshot.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);

  const derived = useMemo(() => {
    if (!data) return null;
    const today = data.period.end;
    const soon = new Date(`${today}T12:00:00`); soon.setDate(soon.getDate() + 14);
    const soonKey = soon.toISOString().slice(0, 10);
    const active = data.jobs.filter((job) => !job.archived_at && activeStatuses.has(job.production_status));
    const missingMaterial = active.filter((job) => !data.linkedMaterialJobIds.has(job.id));
    const attention = active.flatMap((job) => {
      const issues: Array<{ job: ProductionJob; issue: string; focus?: string }> = [];
      if (job.requested_delivery_date && job.requested_delivery_date < today) issues.push({ job, issue: 'Requested delivery overdue', focus: 'planned-dates' });
      else if (job.requested_delivery_date && job.requested_delivery_date <= soonKey && getJobReadiness(job).missingFields.length) issues.push({ job, issue: 'Delivery approaching with planning gaps', focus: 'planned-dates' });
      if (job.estimated_man_hours === null) issues.push({ job, issue: 'No labor estimate', focus: 'labor' });
      else if (!data.linkedLaborJobIds.has(job.id)) issues.push({ job, issue: 'Estimate exists, no labor reports' });
      if (!data.linkedMaterialJobIds.has(job.id)) issues.push({ job, issue: 'No Material Usage linked' });
      return issues;
    }).slice(0, 12);
    const readyToArchive = data.jobs.filter((job) => !job.archived_at && terminalStatuses.has(job.production_status)).sort((a, b) => (a.production_status === 'shipped' ? -1 : 0) - (b.production_status === 'shipped' ? -1 : 0));
    return { active, missingMaterial, attention, readyToArchive, soonKey };
  }, [data]);

  if (loading) return <div className="flex min-h-72 items-center justify-center border border-slate-200 bg-white text-sm font-semibold text-slate-600">Loading Monthly Snapshot…</div>;
  if (error || !data || !derived) return <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error || 'Monthly Snapshot is unavailable.'}<button type="button" onClick={() => void load()} className="ml-3 underline">Retry</button></div>;

  const metrics = [
    { label: 'Jobs Started', value: count(data.transitionJobIds.started.size), detail: 'Verified status events' },
    { label: 'Jobs Completed', value: count(data.transitionJobIds.completed.size), detail: 'Verified status events' },
    { label: 'Jobs Shipped', value: count(data.transitionJobIds.shipped.size), detail: 'Verified status events' },
    { label: 'Reported Labor', value: hours(data.reportedHours), detail: `${data.reportingDays} reporting days` },
    { label: 'Material Reports', value: count(data.materialReportCount), detail: `${data.materialJobIds.size} linked jobs` },
    { label: 'Receivals Completed', value: count(data.receivalsCompleted) },
  ];

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4"><div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Leadership review</div><h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Monthly Snapshot</h2><p className="mt-1 text-sm text-slate-600">{formatDate(data.period.start)}–{formatDate(data.period.end)}</p></div><div className="flex items-center gap-2"><span className="h-9 border border-slate-300 bg-slate-50 px-3 text-xs font-bold leading-9 text-slate-700">Last 30 Days</span><button type="button" onClick={() => void load()} aria-label="Refresh Monthly Snapshot" className="inline-flex h-9 w-9 items-center justify-center border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"><RotateCw className="h-4 w-4" /></button></div></div>
    <Metrics items={metrics} />
    {actionError ? <div role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">{actionError}</div> : null}
    <section className="rounded-sm border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold text-slate-950">Production Performance</h2><p className="mt-0.5 text-xs text-slate-500">Current operational state plus verified transitions during the period.</p></div></div><div className="mt-3 grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{[
      ['Active jobs', derived.active.length], ['Delivered late', data.jobsDeliveredLate], ['Approaching delivery', derived.active.filter((job) => job.requested_delivery_date && job.requested_delivery_date >= data.period.end && job.requested_delivery_date <= derived.soonKey).length], ['Missing labor estimates', derived.active.filter((job) => job.estimated_man_hours === null).length], ['Estimated, No Reports', derived.active.filter((job) => job.estimated_man_hours !== null && !data.linkedLaborJobIds.has(job.id)).length], ['Missing Material Usage', derived.missingMaterial.length],
    ].map(([label, value]) => <div key={String(label)} className="bg-slate-50 px-3 py-2"><span className="text-xs text-slate-600">{label}</span><strong className="float-right text-sm text-slate-950">{value}</strong></div>)}</div></section>
    <section className="rounded-sm border border-slate-200 bg-white p-4"><h2 className="text-sm font-bold text-slate-950">Labor Performance</h2><p className="mt-0.5 text-xs text-slate-500">{hours(data.reportedHours)} across {data.reportingDays} work dates and {data.laborJobCount} linked jobs.</p><DailyLaborChart values={data.dailyLabor} /><div className="mt-4 grid gap-5 lg:grid-cols-3"><RankedList title="Top Jobs" items={data.topLaborJobs} empty="No linked job labor was reported during this period." jobLinks /><RankedList title="Top Workers" items={data.topWorkers} empty="No worker hours were reported during this period." /><RankedList title="Top Tasks" items={data.topTasks} empty="No task hours were reported during this period." /></div></section>
    <section className="rounded-sm border border-slate-200 bg-white p-4"><h2 className="text-sm font-bold text-slate-950">Material Usage</h2><p className="mt-0.5 text-xs text-slate-500">Canonical reports dated within the selected period; Production Material Status is not used.</p><div className="mt-4 grid gap-5 lg:grid-cols-2"><RankedList title="Most Frequently Reported" items={data.topMaterialsByFrequency} empty="No materials were reported during this period." quantity /><RankedList title="Highest Reported Quantities" items={data.topMaterialsByQuantity} empty="No material quantities were reported during this period." quantity /></div></section>
    <section className="rounded-sm border border-slate-200 bg-white p-4"><h2 className="text-sm font-bold text-slate-950">Inventory & Receivals</h2><div className="mt-3 grid gap-px bg-slate-200 sm:grid-cols-4">{[['Intake transactions', data.inventoryCounts.intake], ['Outtake transactions', data.inventoryCounts.outtake], ['Adjustments', data.inventoryCounts.adjustment], ['Receivals completed', data.receivalsCompleted]].map(([label, value]) => <div key={String(label)} className="bg-slate-50 px-3 py-2 text-xs"><span className="text-slate-600">{label}</span><strong className="float-right text-slate-950">{value}</strong></div>)}</div><div className="mt-4 grid gap-5 lg:grid-cols-2"><section><h3 className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Most Active Materials</h3>{data.activeMaterials.length ? <div className="mt-2 divide-y border-y">{data.activeMaterials.map((item) => <div key={item.label} className="flex min-h-9 items-center justify-between text-xs"><span className="truncate font-medium">{item.label}</span><strong>{item.count} events</strong></div>)}</div> : <p className="mt-2 text-xs text-slate-500">No inventory activity was recorded during this period.</p>}</section><section><h3 className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Oldest Unresolved Receivals</h3>{data.unresolvedReceivals.length ? <div className="mt-2 divide-y border-y">{data.unresolvedReceivals.map((item) => <div key={item.id} className="py-2 text-xs"><div className="font-semibold text-slate-900">{item.material}</div><div className="text-slate-500">{item.vendor || 'Vendor not recorded'} · {item.eta ? `ETA ${formatDate(item.eta)}` : 'ETA not set'}</div></div>)}</div> : <p className="mt-2 text-xs text-slate-500">No unresolved Pending Receivals.</p>}</section></div></section>
    <section className="rounded-sm border border-amber-200 bg-white p-4"><h2 className="text-sm font-bold text-slate-950">Needs Attention</h2><p className="mt-0.5 text-xs text-slate-500">Current actionable exceptions; open the canonical Production workflow to resolve them.</p>{derived.attention.length ? <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">{derived.attention.map((item, index) => <button key={`${item.job.id}-${item.issue}-${index}`} type="button" onClick={() => openProductionJob(item.job.id)} className="flex min-h-11 w-full items-center gap-3 py-2 text-left hover:bg-amber-50"><JobTag label={`${item.job.job_number ? `${item.job.job_number} — ` : ''}${item.job.name}`} className="max-w-[220px]" /><span className="min-w-0 flex-1 truncate text-xs font-semibold text-amber-900">{item.issue}</span><ProductionStatusBadge status={item.job.production_status} /></button>)}</div> : <p className="mt-3 text-xs text-slate-500">No current operational exceptions match the Snapshot criteria.</p>}</section>
    <section className="rounded-sm border border-slate-200 bg-white p-4"><h2 className="text-sm font-bold text-slate-950">Ready to Archive</h2><p className="mt-0.5 text-xs text-slate-500">Terminal jobs remain available historically after manual archival.</p>{derived.readyToArchive.length ? <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">{derived.readyToArchive.map((job) => <div key={job.id} className="flex min-h-12 flex-wrap items-center gap-3 py-2"><JobTag label={`${job.job_number ? `${job.job_number} — ` : ''}${job.name}`} onClick={() => openProductionJob(job.id)} className="max-w-[260px]" /><span className="min-w-0 flex-1 truncate text-xs text-slate-500">{job.customer || 'Customer not recorded'}{job.requested_delivery_date ? ` · Delivery ${formatDate(job.requested_delivery_date)}` : ''}</span><ProductionStatusBadge status={job.production_status} /><button type="button" disabled={archivingId === job.id} onClick={async () => { if (!window.confirm('Archive this job? It will be removed from active Production views, but its activity, manpower, attachments, material usage, and history will be preserved.')) return; setArchivingId(job.id); setActionError(''); try { const archived = await archiveProductionJob(job); setData((current) => current ? { ...current, jobs: current.jobs.map((item) => item.id === job.id ? archived : item) } : current); } catch (caught) { setActionError(caught instanceof Error ? caught.message : 'Unable to archive job.'); } finally { setArchivingId(null); } }} className="h-8 border border-red-300 bg-white px-2.5 text-[10px] font-bold uppercase tracking-wide text-red-700 hover:bg-red-50 disabled:opacity-50">{archivingId === job.id ? 'Archiving…' : 'Archive'}</button></div>)}</div> : <p className="mt-3 text-xs text-slate-500">No terminal jobs are currently ready to archive.</p>}</section>
  </div>;
}
