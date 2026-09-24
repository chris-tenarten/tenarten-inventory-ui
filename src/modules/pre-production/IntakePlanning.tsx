'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useAuth } from '@/lib/auth';
import { loadProductionJobs } from '@/modules/production/jobs';
import { productionJobsVisibleToRole } from '@/modules/production/fixture-visibility';
import { openProductionJob } from '@/modules/production/job-options';
import { addCalendarDays, formatScheduleDate, parseScheduleDate } from '@/modules/production/schedule';
import { timelineZoomOption } from '@/modules/production/timeline-preferences';
import type { ProductionJob } from '@/modules/production/types';
import { loadPlanningPhases } from '@/modules/planning/data';
import type { PlanningPhase } from '@/modules/planning/types';
import { isPlanningEnabled, planningIntervalGeometry, rangesIntersect } from '@/modules/planning/timeline-model.mjs';
import { overlayVisualForPhase, PLANNING_PAUSE_HATCH } from '@/modules/planning/phase-visuals';
import type { Bid } from './types';
import { adjustProjectedWindow, projectedWindowEligible, type BidPlanning, type WindowEdit } from './planning';
import { loadBidPlanning, saveBidProjectedWindow } from './planning-data';

type Mode = 'intake' | 'production' | 'combined';
type Zoom = 'weeks' | 'months' | 'quarters';
type Drag = { record: BidPlanning; mode: WindowEdit; x: number; start: string; end: string; moved: boolean };
const monthStart = () => { const now = new Date(); return formatScheduleDate(new Date(now.getFullYear(), now.getMonth(), 1)); };
export default function IntakePlanning({ bids, onSelectBid, onChanged }: { bids: Bid[]; onSelectBid(bid: Bid): void; onChanged(): Promise<unknown> }) {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('intake');
  const [zoom, setZoom] = useState<Zoom>('months');
  const [rangeStart, setRangeStart] = useState(monthStart);
  const [records, setRecords] = useState<BidPlanning[]>([]);
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [phases, setPhases] = useState<PlanningPhase[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [productionLoaded, setProductionLoaded] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pendingId, setPendingId] = useState('');
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const productionRequest = useRef<{ bids: Bid[]; revision: number; promise: Promise<[ProductionJob[], PlanningPhase[]]> } | null>(null);
  const refresh = useCallback(async () => { setRecords(await loadBidPlanning()); setLoaded(true); }, []);
  useEffect(() => { let live = true; void loadBidPlanning().then(next => { if (live) { setRecords(next); setLoaded(true); } }).catch(caught => { if (live) setError(caught.message); }); return () => { live = false; }; }, [bids]);
  useEffect(() => {
    if (mode === 'intake') return;
    let live = true;
    if (!productionRequest.current || productionRequest.current.bids !== bids || productionRequest.current.revision !== revision) {
      productionRequest.current = { bids, revision, promise: Promise.all([loadProductionJobs(), isPlanningEnabled(process.env.NEXT_PUBLIC_ENABLE_PLANNING) ? loadPlanningPhases() : Promise.resolve([])]) };
    }
    void productionRequest.current.promise.then(([nextJobs, nextPhases]) => {
      if (live) { setJobs(productionJobsVisibleToRole(nextJobs, auth.profile?.role)); setPhases(nextPhases); setProductionLoaded(true); }
    }).catch(caught => { productionRequest.current = null; if (live) setError(caught.message); });
    return () => { live = false; };
  }, [mode, bids, revision, auth.profile?.role]);
  const days = zoom === 'weeks' ? 42 : zoom === 'months' ? 90 : 180;
  const dayWidth = timelineZoomOption(zoom === 'quarters' ? 'year' : zoom).defaultDayWidth;
  const rangeEnd = formatScheduleDate(addCalendarDays(rangeStart, days - 1));
  const width = days * dayWidth;
  const byId = useMemo(() => new Map(records.map(record => [record.id, record])), [records]);
  const projected = useMemo(() => bids.filter(bid => byId.has(bid.id) && projectedWindowEligible(bid.status, byId.get(bid.id))), [bids, byId]);
  const committed = useMemo(() => jobs.filter(job => !['complete', 'shipped', 'cancelled'].includes(job.production_status)), [jobs]);
  const phaseByJob = useMemo(() => {
    const map = new Map<string, PlanningPhase[]>();
    for (const phase of phases) { const group = map.get(phase.job_id) ?? []; group.push(phase); map.set(phase.job_id, group); }
    return map;
  }, [phases]);
  const ticks = useMemo(() => Array.from({ length: Math.ceil(days / 7) }, (_, index) => ({ date: formatScheduleDate(addCalendarDays(rangeStart, index * 7)), left: index * 7 * dayWidth })), [rangeStart, days, dayWidth]);
  function geometry(start: string, end: string) {
    return planningIntervalGeometry(start < rangeStart ? rangeStart : start, end > rangeEnd ? rangeEnd : end, rangeStart, dayWidth);
  }
  function begin(event: PointerEvent<HTMLDivElement>, record: BidPlanning) {
    if (pendingId || event.button !== 0 || !record.projected_production_start || !record.projected_production_end) return;
    const target = event.target as HTMLElement;
    const mode = (target.closest('[data-window-edge]')?.getAttribute('data-window-edge') ?? 'move') as WindowEdit;
    const next = { record, mode, x: event.clientX, start: record.projected_production_start, end: record.projected_production_end, moved: false };
    dragRef.current = next; setDrag(next); suppressClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const current = dragRef.current; if (!current) return;
    const moved = Math.abs(event.clientX - current.x) > 4;
    const delta = Math.round((event.clientX - current.x) / dayWidth);
    const adjusted = adjustProjectedWindow(current.record.projected_production_start!, current.record.projected_production_end!, delta, current.mode);
    if (adjusted) { const next = { ...current, ...adjusted, moved: current.moved || moved }; dragRef.current = next; setDrag(next); }
  }
  async function finish() {
    const current = dragRef.current; dragRef.current = null; setDrag(null);
    if (!current) return;
    suppressClick.current = current.moved;
    if (!current.moved) { const bid = bids.find(bid => bid.id === current.record.id); if (bid) onSelectBid(bid); suppressClick.current = true; return; }
    if (!current.moved || (current.start === current.record.projected_production_start && current.end === current.record.projected_production_end)) return;
    setPendingId(current.record.id); setError(''); setMessage('');
    try { await saveBidProjectedWindow(current.record, current.start, current.end); await onChanged(); setMessage('Projected production window updated.'); }
    catch (caught) { setError(`${caught instanceof Error ? caught.message : 'Unable to save projected window.'} Refresh to verify the saved dates before retrying.`); }
    finally { setPendingId(''); }
  }
  const cancel = () => { dragRef.current = null; setDrag(null); suppressClick.current = true; };
  function open(bid: Bid) { if (suppressClick.current) { suppressClick.current = false; return; } onSelectBid(bid); }
  const railClass = 'sticky left-0 z-10 w-[200px] shrink-0 border-r border-slate-300 bg-white px-3 py-2 text-left';
  const canvasStyle = { width, backgroundImage: 'linear-gradient(to right, var(--border-default, #cbd5e1) 1px, transparent 1px)', backgroundSize: `${dayWidth * 7}px 100%` };
  return <section className="mt-4 min-w-0" aria-label="Intake Planning">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-bold">Projected Production Planning</h2><p className="mt-1 text-xs text-slate-600">Dashed PROJECTED = potential Intake work. Solid PRODUCTION = committed work. Projections do not reserve capacity.</p></div><button type="button" disabled={Boolean(pendingId)} onClick={() => { setError(''); setRevision(value => value + 1); setProductionLoaded(false); void refresh().catch(caught => setError(caught.message)); }} className="min-h-10 border border-slate-300 px-3 text-sm">Refresh planning</button></div>
    <div className="my-3 flex flex-wrap items-center gap-3"><div role="group" aria-label="Planning sources" className="flex flex-wrap border border-slate-300">{(['intake', 'production', 'combined'] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={`min-h-10 px-3 text-xs font-bold ${mode === value ? 'tenops-selected-surface' : 'bg-white text-slate-600'}`}>{value === 'intake' ? 'Projected Intake' : value === 'production' ? 'Production' : 'Combined'}</button>)}</div><label className="text-xs font-semibold">Scale<select aria-label="Planning scale" value={zoom} onChange={event => setZoom(event.target.value as Zoom)} className="ml-2 min-h-10 border border-slate-300 bg-white px-2">{(['weeks', 'months', 'quarters'] as const).map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label><button type="button" aria-label="Previous planning period" onClick={() => setRangeStart(formatScheduleDate(addCalendarDays(rangeStart, -days)))} className="min-h-10 border px-3">←</button><button type="button" onClick={() => setRangeStart(monthStart())} className="min-h-10 border px-3 text-xs">Today</button><button type="button" aria-label="Next planning period" onClick={() => setRangeStart(formatScheduleDate(addCalendarDays(rangeStart, days)))} className="min-h-10 border px-3">→</button><span className="text-xs">{rangeStart} – {rangeEnd}</span></div>
    {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="mb-3 text-sm text-emerald-700">{message}</p>}
    {!loaded && <p className="py-4 text-sm">Loading projected windows…</p>}
    {mode !== 'intake' && !productionLoaded && <p className="py-4 text-sm">Loading current Production planning…</p>}
    <div role="region" aria-label="Scrollable planning timeline" tabIndex={0} className="max-h-[65dvh] min-w-0 overflow-auto border border-slate-300 bg-white" onKeyDown={event => { if (event.key === 'Escape') cancel(); }}>
      <div style={{ minWidth: width + 200 }}>
        <div className="sticky top-0 z-20 flex h-10 border-b border-slate-300 bg-slate-100"><div className={`${railClass} bg-slate-100 text-xs font-bold`}>Opportunity / Job</div><div className="relative shrink-0" style={canvasStyle}>{ticks.map(tick => <span key={tick.date} className="absolute top-3 text-[10px] text-slate-600" style={{ left: tick.left + 5 }}>{parseScheduleDate(tick.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>)}</div></div>
        {mode !== 'production' && projected.map(bid => {
          const record = byId.get(bid.id)!; const current = drag?.record.id === bid.id ? drag : null;
          const start = current?.start ?? record.projected_production_start, end = current?.end ?? record.projected_production_end;
          const visible = start && end && rangesIntersect(start, end, rangeStart, rangeEnd);
          return <div key={bid.id} data-intake-planning-row={bid.id} className="flex min-h-16 border-b border-slate-200"><button type="button" onClick={() => onSelectBid(bid)} className={railClass}><strong className="block truncate text-xs">{bid.projectName}</strong><span className="text-[10px] text-slate-500">INTAKE · {bid.status === 'won' ? 'Won' : 'Active'}</span></button><div className="relative h-16 shrink-0" style={canvasStyle}>
            {visible ? <div onPointerDown={event => begin(event, record)} onPointerMove={move} onPointerUp={() => void finish()} onPointerCancel={cancel} className="absolute top-3 flex h-10 touch-none items-center overflow-hidden rounded border-2 border-dashed border-blue-600 bg-blue-100/60 text-blue-950" style={{ ...geometry(start!, end!), backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 8px, rgba(59,130,246,.08) 8px 12px)' }} title={`PROJECTED: ${start} – ${end}. Tentative; no capacity reservation.`}>
              <button type="button" data-window-edge="start" aria-label={`Edit projected start for ${bid.projectName}`} onClick={() => open(bid)} className="h-full w-3 shrink-0 cursor-ew-resize border-r border-dashed border-blue-500"/>
              <button type="button" disabled={Boolean(pendingId)} onClick={() => open(bid)} className="h-full min-w-0 flex-1 cursor-grab truncate px-1 text-left text-[10px] font-bold">PROJECTED · {bid.projectName}</button>
              <button type="button" data-window-edge="end" aria-label={`Edit projected end for ${bid.projectName}`} onClick={() => open(bid)} className="h-full w-3 shrink-0 cursor-ew-resize border-l border-dashed border-blue-500"/>
            </div> : <button type="button" onClick={() => onSelectBid(bid)} className="sticky left-[208px] m-3 h-10 px-2 text-xs text-slate-500 underline">{start ? `Outside this period: ${start} – ${end}` : 'No projected window — set dates'}</button>}
          </div></div>;
        })}
        {mode !== 'intake' && committed.map(job => {
          const jobPhases = phaseByJob.get(job.id) ?? [];
          return <div key={job.id} data-production-planning-row={job.id} className="flex border-b border-slate-200"><button type="button" onClick={() => openProductionJob(job.id)} className={railClass}><strong className="block truncate text-xs">{job.job_number ? `${job.job_number} · ` : ''}{job.name}</strong><span className="text-[10px] text-slate-500">PRODUCTION{job.rework_cycle ? ' · REWORK' : ''}</span></button><div className="relative shrink-0" style={{ ...canvasStyle, height: 64 + jobPhases.length * 24 }}>
            {job.planned_start && job.planned_end && rangesIntersect(job.planned_start, job.planned_end, rangeStart, rangeEnd) ? <button type="button" onClick={() => openProductionJob(job.id)} title={`PRODUCTION: ${job.planned_start} – ${job.planned_end}. Edit in Production.`} className="absolute top-3 h-9 overflow-hidden rounded border border-blue-950 bg-blue-800 px-2 text-left text-[10px] font-bold whitespace-nowrap text-white" style={geometry(job.planned_start, job.planned_end)}>PRODUCTION · {job.name}</button> : <span className="sticky left-[208px] m-3 inline-block text-xs text-slate-500">{job.planned_start ? 'Scheduled outside this period' : 'Production dates not set'}</span>}
            {jobPhases.map((phase, index) => phase.start_date && phase.end_date && rangesIntersect(phase.start_date, phase.end_date, rangeStart, rangeEnd) ? <button type="button" key={phase.id} onClick={() => openProductionJob(job.id)} title={`${phase.title} · ${phase.timeline_behavior} · ${phase.start_date} – ${phase.end_date}`} className={`absolute h-5 overflow-hidden rounded border px-1 text-left text-[9px] font-semibold whitespace-nowrap ${overlayVisualForPhase(jobPhases, phase.id).className}`} style={{ ...geometry(phase.start_date, phase.end_date), top: 55 + index * 24, ...(phase.timeline_behavior === 'pause' ? { backgroundImage: PLANNING_PAUSE_HATCH, color: '#111827' } : {}) }}><span className={phase.timeline_behavior === 'pause' ? 'bg-white px-1' : ''}>{phase.timeline_behavior === 'pause' ? 'PAUSE · ' : phase.timeline_behavior === 'planning_only' ? 'PLANNING ONLY · ' : ''}{phase.title}</span></button> : null)}
          </div></div>;
        })}
      </div>
    </div>
    <p className="mt-2 text-xs text-slate-500">Drag projected blocks to move; drag their edges to resize. Open an Intake record for keyboard-accessible date editing. Production blocks open the existing Production workspace.</p>
  </section>;
}
