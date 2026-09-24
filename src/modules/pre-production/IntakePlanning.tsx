'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useAuth } from '@/lib/auth';
import styles from './IntakePlanning.module.css';
import { loadProductionJobs } from '@/modules/production/jobs';
import { productionJobsVisibleToRole } from '@/modules/production/fixture-visibility';
import { openProductionJob } from '@/modules/production/job-options';
import { addCalendarDays, formatScheduleDate, parseScheduleDate } from '@/modules/production/schedule';
import { dayDistance, fitPlanningRanges, MAX_DAY_WIDTH, MIN_DAY_WIDTH, RAIL_WIDTH, shiftedDate } from './planning-viewport';
import type { ProductionJob } from '@/modules/production/types';
import { loadPlanningPhases } from '@/modules/planning/data';
import type { PlanningPhase } from '@/modules/planning/types';
import { isPlanningEnabled, planningIntervalGeometry, rangesIntersect } from '@/modules/planning/timeline-model.mjs';
import { overlayVisualForPhase, PLANNING_PAUSE_HATCH } from '@/modules/planning/phase-visuals';
import type { Bid } from './types';
import { adjustProjectedWindow, projectedWindowEligible, type BidPlanning, type WindowEdit } from './planning';
import { loadBidPlanning, saveBidProjectedWindow } from './planning-data';

type Mode = 'intake' | 'production' | 'combined';
type Drag = { record: BidPlanning; mode: WindowEdit; x: number; start: string; end: string; moved: boolean };
const monthStart = () => { const now = new Date(); return formatScheduleDate(new Date(now.getFullYear(), now.getMonth(), 1)); };
export default function IntakePlanning({ bids, editableTestBidId, onSelectBid, onChanged }: { bids: Bid[]; editableTestBidId?: string; onSelectBid(bid: Bid): void; onChanged(): Promise<unknown> }) {
  const auth = useAuth();
  const canWrite = Boolean(auth.profile?.isActive && auth.can('accessIntake'));
  const canEdit = (id: string) => Boolean(auth.profile?.isActive && (canWrite || id === editableTestBidId));
  const [mode, setMode] = useState<Mode>('intake');
  const [dayWidth, setDayWidth] = useState(20);
  const [calendarAnchor] = useState(monthStart);
  const [today, setToday] = useState(() => formatScheduleDate(new Date()));
  const rangeStart = shiftedDate(calendarAnchor, -3650);
  const days = 7301;
  const viewport = useRef<HTMLDivElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLParagraphElement>(null);
  const fitFramed = useRef(false);
  const pan = useRef<{ x: number; scroll: number } | null>(null);
  const navigation = useRef<{ center: string } | null>({ center: shiftedDate(calendarAnchor, 21) });
  const [fitNotice, setFitNotice] = useState('');
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
  const tickDays = dayWidth >= 12 ? 7 : dayWidth >= 4 ? 28 : 56;
  const ticks = useMemo(() => Array.from({ length: Math.ceil(days / tickDays) }, (_, index) => ({ date: shiftedDate(rangeStart, index * tickDays), left: index * tickDays * dayWidth })), [rangeStart, days, dayWidth, tickDays]);
  useLayoutEffect(() => {
    const el = viewport.current, target = navigation.current;
    if (el && target) {
      el.scrollLeft = dayDistance(rangeStart, target.center) * dayWidth - Math.max(80, el.clientWidth - RAIL_WIDTH) / 2;
      navigation.current = null;
    }
  });
  // Keep a long-lived Planning tab current without moving its viewport.
  useEffect(() => {
    const update = () => setToday(formatScheduleDate(new Date()));
    const timer = window.setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, []);
  function goToToday() {
    const el = viewport.current; if (!el) return;
    const date = formatScheduleDate(new Date());
    setToday(date);
    navigation.current = null;
    el.scrollLeft = dayDistance(rangeStart, date) * dayWidth - Math.max(80, el.clientWidth - RAIL_WIDTH) / 3;
    setFitNotice('');
  }
  function zoomBy(factor: number) {
    const el = viewport.current; if (!el) return;
    navigation.current = { center: shiftedDate(rangeStart, Math.round((el.scrollLeft + Math.max(80, el.clientWidth - RAIL_WIDTH) / 2) / dayWidth)) };
    setDayWidth(value => Math.max(MIN_DAY_WIDTH, Math.min(MAX_DAY_WIDTH, value * factor)));
    setFitNotice('');
  }
  const frameVertically = useCallback((reposition: boolean) => {
    const el = viewport.current, bar = controls.current;
    if (!el || !bar) return;
    const headerBottom = document.querySelector('[data-shell-header]')?.getBoundingClientRect().bottom ?? 0;
    const gap = parseFloat(getComputedStyle(bar).marginTop) || 12;
    const offset = el.getBoundingClientRect().top - bar.getBoundingClientRect().top;
    const footer = hint.current;
    const footerHeight = footer ? footer.getBoundingClientRect().height + (parseFloat(getComputedStyle(footer).marginTop) || 0) : 0;
    el.style.maxHeight = `${Math.max(40, window.innerHeight - headerBottom - gap - offset - footerHeight - gap)}px`;
    if (reposition) {
      window.scrollBy({ top: bar.getBoundingClientRect().top - headerBottom - gap, behavior: 'instant' });
      el.scrollTop = 0;
    }
  }, []);
  useEffect(() => {
    const update = () => { if (fitFramed.current) frameVertically(false); };
    const observer = new ResizeObserver(update);
    for (const el of [controls.current, hint.current, document.querySelector('[data-shell-header]')]) if (el) observer.observe(el);
    window.addEventListener('resize', update);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, [frameVertically]);
  function fit() {
    fitFramed.current = true;
    frameVertically(true);
    const ranges: Array<{ start: string; end: string }> = [];
    if (mode !== 'production') for (const bid of projected) {
      const r = byId.get(bid.id)!;
      if (r.projected_production_start && r.projected_production_end) ranges.push({ start: r.projected_production_start, end: r.projected_production_end });
    }
    if (mode !== 'intake') for (const job of committed) {
      if (job.planned_start && job.planned_end) ranges.push({ start: job.planned_start, end: job.planned_end });
      for (const phase of phaseByJob.get(job.id) ?? []) if (phase.start_date && phase.end_date) ranges.push({ start: phase.start_date, end: phase.end_date });
    }
    const result = fitPlanningRanges(ranges, (viewport.current?.clientWidth ?? 1000) - RAIL_WIDTH, today);
    const center = result.center < rangeStart ? rangeStart : result.center > rangeEnd ? rangeEnd : result.center;
    navigation.current = result.dayWidth === dayWidth ? null : { center };
    setDayWidth(result.dayWidth);
    setFitNotice(result.limited ? 'Fit capped for readability. Scroll to other dates or open a row to edit.' : ranges.length ? '' : 'No dated work — showing dates around today.');
    // Fit also works when the zoom and notice are already unchanged.
    if (viewport.current) viewport.current.scrollLeft = dayDistance(rangeStart, center) * result.dayWidth - Math.max(80, viewport.current.clientWidth - RAIL_WIDTH) / 2;
  }
  function beginPan(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.pointerType === 'touch' || !(event.target as HTMLElement).closest('[data-planning-canvas]') || (event.target as HTMLElement).closest('button, a, input, select, [data-projected-block]')) return;
    pan.current = { x: event.clientX, scroll: event.currentTarget.scrollLeft };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.style.cursor = 'grabbing';
    event.preventDefault();
  }
  function endPan() { pan.current = null; if (viewport.current) viewport.current.style.cursor = ''; }
  function geometry(start: string, end: string) {
    return planningIntervalGeometry(start < rangeStart ? rangeStart : start, end > rangeEnd ? rangeEnd : end, rangeStart, dayWidth);
  }
  function begin(event: PointerEvent<HTMLDivElement>, record: BidPlanning) {
    if (!canEdit(record.id) || pendingId || event.button !== 0 || !record.projected_production_start || !record.projected_production_end) return;
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
    if (adjusted && (adjusted.start !== current.start || adjusted.end !== current.end || moved !== current.moved)) { const next = { ...current, ...adjusted, moved: current.moved || moved }; dragRef.current = next; setDrag(next); }
  }
  async function finish() {
    const current = dragRef.current; dragRef.current = null; setDrag(null);
    if (!current || !canEdit(current.record.id)) return;
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
  const viewportButton = 'min-h-10 rounded-sm border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 enabled:hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';
  const todayLeft = dayDistance(rangeStart, today) * dayWidth;
  const todayVisible = today >= rangeStart && today <= rangeEnd;
  const todayLine = todayVisible ? <span aria-hidden="true" data-today-line className={`pointer-events-none absolute inset-y-0 border-l ${styles.todayLine}`} style={{ left: todayLeft }} /> : null;
  const railClass = 'sticky left-0 z-10 w-[240px] shrink-0 border-r border-slate-300 bg-white px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-blue-600';
  const canvasStyle = { width, backgroundImage: 'linear-gradient(to right, var(--border-default, #cbd5e1) 1px, transparent 1px)', backgroundSize: `${dayWidth * 7}px 100%` };
  return <section className="mt-4 min-w-0" aria-label="Intake Planning">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-bold">Projected Production Planning</h2><p className="mt-1 text-xs text-slate-600">Dashed PROJECTED = potential Intake work. Solid PRODUCTION = committed work. Projections do not reserve capacity.</p></div><button type="button" disabled={Boolean(pendingId)} onClick={() => { setError(''); setRevision(value => value + 1); setProductionLoaded(false); void refresh().catch(caught => setError(caught.message)); }} className="min-h-10 border border-slate-300 px-3 text-sm">Refresh planning</button></div>
    <div ref={controls} data-planning-controls className="my-3 flex flex-wrap items-center gap-3"><div role="group" aria-label="Planning sources" className="flex flex-wrap border border-slate-300">{(['intake', 'production', 'combined'] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={`min-h-10 px-3 text-xs font-bold ${mode === value ? 'tenops-selected-surface' : 'bg-white text-slate-600'}`}>{value === 'intake' ? 'Projected Intake' : value === 'production' ? 'Production' : 'Combined'}</button>)}</div><div role="group" aria-label="Timeline viewport" className="flex flex-wrap items-center gap-2"><div className="flex items-center gap-1"><button type="button" aria-label="Zoom out" title="Zoom out" disabled={dayWidth <= MIN_DAY_WIDTH} onClick={() => zoomBy(1 / 1.5)} className={`${viewportButton} min-w-10 text-base`}>−</button><button type="button" aria-label="Zoom in" title="Zoom in" disabled={dayWidth >= MAX_DAY_WIDTH} onClick={() => zoomBy(1.5)} className={`${viewportButton} min-w-10 text-base`}>+</button></div><button type="button" onClick={goToToday} title="Show today with upcoming dates ahead" className={viewportButton}>Today</button><button type="button" onClick={fit} disabled={!loaded || (mode !== 'intake' && !productionLoaded)} className={viewportButton}>Fit</button></div></div>
    {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="mb-3 text-sm text-emerald-700">{message}</p>}
    {!loaded && <p className="py-4 text-sm">Loading projected windows…</p>}
    {mode !== 'intake' && !productionLoaded && <p className="py-4 text-sm">Loading current Production planning…</p>}
    <div ref={viewport} onPointerDown={beginPan} onPointerMove={event => { if (pan.current) event.currentTarget.scrollLeft = pan.current.scroll - (event.clientX - pan.current.x); }} onPointerUp={endPan} onPointerCancel={endPan} onLostPointerCapture={endPan} role="region" aria-label="Scrollable planning timeline" tabIndex={0} className="max-h-[65dvh] min-w-0 overflow-auto border border-slate-300 bg-white" onKeyDown={event => { if (event.key === 'Escape') { cancel(); endPan(); } }}>
      <div style={{ minWidth: width + RAIL_WIDTH }}>
        <div className="sticky top-0 z-20 flex h-10 border-b border-slate-300 bg-slate-100"><div className={`${railClass} bg-slate-100 text-xs font-bold`}>Opportunity / Job</div><div data-planning-canvas className="relative shrink-0 cursor-grab" style={canvasStyle}>{todayLine}{todayVisible && <span data-today-marker aria-label={`Today: ${today}`} className="pointer-events-none absolute top-0 rounded-sm bg-slate-100 px-1 text-[9px] font-semibold tracking-wide text-slate-600" style={{ left: todayLeft + 2 }}>TODAY</span>}{ticks.map(tick => <span key={tick.date} className="absolute top-5 text-[10px] text-slate-600" style={{ left: tick.left + 5 }}>{parseScheduleDate(tick.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}</span>)}</div></div>
        {mode !== 'production' && projected.map(bid => {
          const canWrite = canEdit(bid.id);
          const record = byId.get(bid.id)!; const current = drag?.record.id === bid.id ? drag : null;
          const start = current?.start ?? record.projected_production_start, end = current?.end ?? record.projected_production_end;
          const visible = start && end && rangesIntersect(start, end, rangeStart, rangeEnd);
          return <div key={bid.id} data-intake-planning-row={bid.id} className="flex min-h-14 border-b border-slate-200"><button type="button" onClick={() => onSelectBid(bid)} title={bid.projectName} className={railClass}><strong className="block truncate text-xs">{bid.projectName}</strong><span className="text-[10px] text-slate-500">INTAKE · {bid.status === 'won' ? 'Won' : 'Active'}</span></button><div data-planning-canvas className="relative h-14 shrink-0 cursor-grab" style={canvasStyle}>
            {todayLine}{visible ? <div data-projected-block onPointerDown={canWrite ? event => begin(event, record) : undefined} onPointerMove={canWrite ? move : undefined} onPointerUp={canWrite ? () => void finish() : undefined} onPointerCancel={canWrite ? cancel : undefined} className="absolute top-2 flex h-10 touch-none items-center overflow-hidden rounded border border-dashed border-blue-600 hover:border-blue-800 focus-within:ring-2 focus-within:ring-blue-600 bg-blue-100/60 text-blue-950" style={{ ...geometry(start!, end!), backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 8px, rgba(59,130,246,.08) 8px 12px)' }} title={`PROJECTED: ${start} – ${end}. Tentative; no capacity reservation.`}>
              {canWrite && <button type="button" data-window-edge="start" aria-label={`Edit projected start for ${bid.projectName}`} onClick={() => open(bid)} className="h-full w-3 shrink-0 cursor-ew-resize border-r border-blue-400/40 hover:bg-blue-200 focus-visible:outline-2"/>}
              <button type="button" disabled={Boolean(pendingId)} onClick={() => open(bid)} className={`h-full min-w-0 flex-1 truncate px-1 text-left text-[10px] font-bold ${canWrite ? 'cursor-grab' : 'cursor-pointer'}`}>PROJECTED</button>
              {canWrite && <button type="button" data-window-edge="end" aria-label={`Edit projected end for ${bid.projectName}`} onClick={() => open(bid)} className="h-full w-3 shrink-0 cursor-ew-resize border-l border-blue-400/40 hover:bg-blue-200 focus-visible:outline-2"/>}
            </div> : <button type="button" onClick={() => onSelectBid(bid)} className="sticky left-[248px] m-3 h-10 px-2 text-xs text-slate-500 underline">{start ? `Outside this period: ${start} – ${end}` : 'No projected window — set dates'}</button>}
          </div></div>;
        })}
        {mode !== 'intake' && committed.map(job => {
          const jobPhases = phaseByJob.get(job.id) ?? [];
          return <div key={job.id} data-production-planning-row={job.id} className="flex border-b border-slate-200"><button type="button" onClick={() => openProductionJob(job.id)} title={job.name} className={railClass}><strong className="block truncate text-xs">{job.job_number ? `${job.job_number} · ` : ''}{job.name}</strong><span className="text-[10px] text-slate-500">PRODUCTION{job.rework_cycle ? ' · REWORK' : ''}</span></button><div data-planning-canvas className="relative shrink-0 cursor-grab" style={{ ...canvasStyle, height: 64 + jobPhases.length * 24 }}>
            {todayLine}{job.planned_start && job.planned_end && rangesIntersect(job.planned_start, job.planned_end, rangeStart, rangeEnd) ? <button type="button" onClick={() => openProductionJob(job.id)} title={`PRODUCTION: ${job.planned_start} – ${job.planned_end}. Edit in Production.`} className="absolute top-3 h-9 overflow-hidden rounded border border-blue-950 bg-blue-800 px-2 text-left text-[10px] font-bold whitespace-nowrap text-white" style={geometry(job.planned_start, job.planned_end)}>PRODUCTION</button> : <span className="sticky left-[248px] m-3 inline-block text-xs text-slate-500">{job.planned_start ? 'Scheduled outside this period' : 'Production dates not set'}</span>}
            {jobPhases.map((phase, index) => phase.start_date && phase.end_date && rangesIntersect(phase.start_date, phase.end_date, rangeStart, rangeEnd) ? <button type="button" key={phase.id} onClick={() => openProductionJob(job.id)} title={`${phase.title} · ${phase.timeline_behavior} · ${phase.start_date} – ${phase.end_date}`} className={`absolute h-5 overflow-hidden rounded border px-1 text-left text-[9px] font-semibold whitespace-nowrap ${overlayVisualForPhase(jobPhases, phase.id).className}`} style={{ ...geometry(phase.start_date, phase.end_date), top: 55 + index * 24, ...(phase.timeline_behavior === 'pause' ? { backgroundImage: PLANNING_PAUSE_HATCH, color: '#111827' } : {}) }}><span className={phase.timeline_behavior === 'pause' ? 'bg-white px-1' : ''}>{phase.timeline_behavior === 'pause' ? 'PAUSE · ' : phase.timeline_behavior === 'planning_only' ? 'PLANNING ONLY · ' : ''}{phase.title}</span></button> : null)}
          </div></div>;
        })}
      </div>
    </div>
    {fitNotice && <p role="status" className="mt-2 text-xs text-slate-500">{fitNotice}</p>}
    <p ref={hint} className="mt-2 text-xs text-slate-500">{canWrite || editableTestBidId ? 'Drag blank space to pan · Drag projected blocks to move · Drag edges to resize · Open a row to edit dates with the keyboard.' : 'Drag blank space to pan · Open a row to view details · Intake is read-only for your role.'}</p>
  </section>;
}
