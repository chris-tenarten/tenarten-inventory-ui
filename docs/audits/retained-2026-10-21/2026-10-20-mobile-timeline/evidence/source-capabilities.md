# Canonical Timeline capability evidence
Source checkpoint 01e5e83. Selected excerpts only; not a hosted policy certification.
All numbered lines refer to repository paths. No account/session data is included.

## src/modules/production/components/ProductionGantt.tsx

```text
40: import {
41:   COLLAPSED_PHASE_DISPLAY_EVENT,
42:   COLLAPSED_PHASE_DISPLAY_STORAGE_KEY,
43:   readCollapsedPhaseDisplayMode,
44:   type CollapsedPhaseDisplayMode,
45: } from '@/modules/planning/collapsed-phase-display';
46: import { adjustPlanningInterval, planningPhaseWithStagedDates, type StagedPlanningSchedules } from '@/modules/planning/schedule-staging';
47: import { dependentPlanningPhaseIds, evaluatePlanningSchedule, planningCascadeDelta, planningDependencyGraphIsAcyclic, type PlanningScheduleIssue } from '@/modules/planning/schedule-model.mjs';
48: import { overlayVisualForPhase, PLANNING_PAUSE_HATCH } from '@/modules/planning/phase-visuals';
49: import { mergePauseRanges, planningIntervalGeometry, rangesIntersect, selectCollapsedTimelinePhases } from '@/modules/planning/timeline-model.mjs';
50: import { useAccountPreferences } from '@/lib/account-preferences';
51:
52: type ProductionGanttProps = {
53:   jobs: ProductionJob[];
54:   stagedSchedules: StagedSchedules;
55:   onStageSchedule: (job: ProductionJob, start: string, end: string) => void;
56:   onSelectJob: (job: ProductionJob, focus?: string) => void;
57:   planningPhases?: PlanningPhase[];
58:   planningItems?: Pick<PlanningItem, 'id' | 'phase_id' | 'is_complete' | 'estimated_hours'>[];
59:   stagedPlanningSchedules?: StagedPlanningSchedules;
60:   onStagePlanningSchedules?: (changes: Array<{ phase: PlanningPhase; start: string; end: string }>) => void;
61:   planningEnabled?: boolean;
62:   onSelectPlanningPhase?: (job: ProductionJob, card: PlanningPhase) => void;
63:   planningIssues?: PlanningScheduleIssue[];
64:   onPreviewPlanningIssuesChange?: (issues: PlanningScheduleIssue[] | null) => void;
65:   onDependencyIssueFocus?: (issueId: string | null) => void;
```

```text
253:   const phaseElementRefs = useRef(new Map<string, HTMLDivElement>());
254:   const zoom = preferences.zoom;
255:   const railWidth = mobileReadOnly ? mobileLandscape ? 220 : 176 : preferences.railWidth;
256:   const rowDensityIndex = Math.max(0, TIMELINE_ROW_DENSITY_OPTIONS.findIndex((option) => option.value === preferences.rowDensity));
257:   const rowDensityOption = TIMELINE_ROW_DENSITY_OPTIONS[rowDensityIndex];
258:   const displayJobRowHeight = mobileLandscape ? 44 : rowDensityOption.height;
259:   const displayJobs = useMemo(() => arrangeProductionTimelineJobs(jobs.map((job) => stagedSchedules[job.id]
260:     ? { ...job, planned_start: stagedSchedules[job.id].proposed_planned_start, planned_end: stagedSchedules[job.id].proposed_planned_end }
261:     : job)), [jobs, stagedSchedules]);
262:   const scheduledJobs = useMemo(() => displayJobs.filter((job) => job.planned_start && job.planned_end), [displayJobs]);
263:   const timeline = useMemo(() => createTimeline(displayJobs, zoom, domainExtension), [displayJobs, domainExtension, zoom]);
264:   const zoomOption = timelineZoomOption(zoom);
265:   const dayWidth = preferences.dayWidths[zoom];
266:   const effectivePlanningPhases = useMemo(() => {
```

```text
317:   useEffect(() => {
318:     const narrowQuery = window.matchMedia('(max-width: 767px)');
319:     const touchQuery = window.matchMedia('(pointer: coarse) and (max-width: 1023px)');
320:     const landscapeQuery = window.matchMedia('(orientation: landscape) and (max-width: 1023px) and (max-height: 600px)');
321:     const syncMobileMode = () => {
322:       setMobileReadOnly(narrowQuery.matches || touchQuery.matches || landscapeQuery.matches);
323:       setMobileLandscape(landscapeQuery.matches);
324:     };
325:     syncMobileMode();
326:     narrowQuery.addEventListener('change', syncMobileMode);
327:     touchQuery.addEventListener('change', syncMobileMode);
328:     landscapeQuery.addEventListener('change', syncMobileMode);
329:     return () => {
330:       narrowQuery.removeEventListener('change', syncMobileMode);
331:       touchQuery.removeEventListener('change', syncMobileMode);
332:       landscapeQuery.removeEventListener('change', syncMobileMode);
333:     };
334:   }, []);
```

```text
615:       originClientX: event.clientX,
616:       pointerX: event.clientX,
617:       pointerY: event.clientY,
618:       originalStart: start,
619:       originalEnd: end,
620:       previewStart: start,
621:       previewEnd: end,
622:       hasMoved: false,
623:       dayWidth,
624:     });
625:   }
626:
627:   function startPhaseInteraction(event: ReactPointerEvent, phase: PlanningPhase, mode: InteractionMode) {
628:     if (mobileReadOnly || !auth.can('writeBusinessData')) {
629:       event.preventDefault();
630:       event.stopPropagation();
631:       if (mode === 'move') {
632:         const job = jobs.find((candidate) => candidate.id === phase.job_id);
633:         if (job) onSelectPlanningPhase?.(job, planningPhases.find((candidate) => candidate.id === phase.id) ?? phase);
634:       }
635:       return;
636:     }
637:     if (!phase.start_date || !phase.end_date || phase.timeline_behavior === 'planning_only') return;
638:     event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
639:     const jobPhases = effectivePlanningPhases.filter((candidate) => candidate.job_id === phase.job_id);
640:     const canCascade = mode !== 'resize-start' && planningDependencyGraphIsAcyclic(jobPhases, phase.id);
641:     const cascadeIds = canCascade ? dependentPlanningPhaseIds(jobPhases, phase.id) : [];
642:     const cascadeOriginals = Object.fromEntries(jobPhases
643:       .filter((candidate) => cascadeIds.includes(candidate.id) && candidate.start_date && candidate.end_date)
644:       .map((candidate) => [candidate.id, { start: candidate.start_date!, end: candidate.end_date! }]));
645:     setPhaseInteraction({ phaseId: phase.id, pointerId: event.pointerId, mode, originClientX: event.clientX, pointerX: event.clientX, pointerY: event.clientY, originalStart: phase.start_date, originalEnd: phase.end_date, previewStart: phase.start_date, previewEnd: phase.end_date, hasMoved: false, dayWidth, cascadeOriginals });
646:   }
647:
648:   function handlePhaseScheduleKey(event: KeyboardEvent<HTMLButtonElement>, phase: PlanningPhase, mode: InteractionMode) {
```

```text
851:   }
852:
853:   function startCanvasPan(event: ReactPointerEvent<HTMLDivElement>) {
854:     const shouldPan = event.button === 1 || (event.button === 0 && (spacePressed || isTimelinePanCanvas(event.target)));
855:     if (!shouldPan || isInteractivePanTarget(event.target)) return;
856:     setNavigationMode(null);
857:     event.preventDefault();
858:     event.currentTarget.setPointerCapture(event.pointerId);
859:     setCanvasPan({
860:       pointerId: event.pointerId,
861:       startX: event.clientX,
862:       startY: event.clientY,
863:       startScrollLeft: event.currentTarget.scrollLeft,
864:       startScrollTop: event.currentTarget.scrollTop,
865:     });
866:   }
867:
868:   function moveCanvasPan(event: ReactPointerEvent<HTMLDivElement>) {
869:     if (!canvasPan || canvasPan.pointerId !== event.pointerId) return;
870:     event.preventDefault();
871:     event.currentTarget.scrollLeft = canvasPan.startScrollLeft - (event.clientX - canvasPan.startX);
872:     event.currentTarget.scrollTop = canvasPan.startScrollTop - (event.clientY - canvasPan.startY);
873:   }
874:
875:   function finishCanvasPan(event: ReactPointerEvent<HTMLDivElement>) {
876:     if (!canvasPan || canvasPan.pointerId !== event.pointerId) return;
877:     if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
878:     setCanvasPan(null);
```

```text
965:   const canvasEndKey = days.at(-1)?.key ?? canvasStartKey;
966:   const activeJob = interaction ? jobs.find((job) => job.id === interaction.jobId) : null;
967:   const currentIntensity = activeJob && interaction
968:     ? laborIntensity(activeJob.estimated_man_hours, interaction.originalStart, interaction.originalEnd)
969:     : null;
970:   const proposedIntensity = activeJob && interaction
971:     ? laborIntensity(activeJob.estimated_man_hours, interaction.previewStart, interaction.previewEnd)
972:     : null;
973:   const expandableJobIds = displayJobs.filter((job) => (phasesByJob.get(job.id) ?? []).some((card) => card.timeline_behavior !== 'planning_only' && card.start_date && card.end_date)).map((job) => job.id);
974:   const allExpandableJobsExpanded = expandableJobIds.length > 0 && expandableJobIds.every((jobId) => expandedJobs.has(jobId));
975:
976:   return (
977:     <div ref={ganttRef} data-production-gantt data-mobile-read-only={mobileReadOnly ? 'true' : undefined} data-mobile-landscape={mobileLandscape ? 'true' : undefined} className="scroll-mt-16 overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
978:       <div ref={workspaceRef} className="scroll-mt-16 border-b border-slate-200 bg-white px-3 py-2">
```

```text
1040:       </div>
1041:       <div
1042:         ref={scrollRef}
1043:         onScroll={handleTimelineScroll}
1044:         onWheel={(event) => {
1045:           if (!event.shiftKey || event.ctrlKey || event.metaKey) return;
1046:           event.preventDefault();
1047:           setNavigationMode(null);
1048:           event.currentTarget.scrollLeft += event.deltaY || event.deltaX;
1049:         }}
1050:         onPointerDown={startCanvasPan}
1051:         onPointerMove={moveCanvasPan}
1052:         onPointerUp={finishCanvasPan}
1053:         onPointerCancel={finishCanvasPan}
1054:         onLostPointerCapture={finishCanvasPan}
1055:         onPointerEnter={() => { timelinePointerInsideRef.current = true; }}
1056:         onPointerLeave={() => { timelinePointerInsideRef.current = false; if (!canvasPan) setSpacePressed(false); }}
1057:         className={`relative max-h-[calc(100dvh-9rem)] overflow-auto ${canvasPan ? 'cursor-grabbing select-none' : spacePressed ? 'cursor-grab' : ''}`}
1058:       >
1059:         <div style={{ minWidth: railWidth + timelineWidth }}>
1060:           <div data-gantt-header className="sticky top-0 z-20 flex border-b border-slate-200 bg-slate-100/90">
1061:             <div data-gantt-header-rail className="sticky left-0 z-30 flex shrink-0 items-end border-r border-slate-300 bg-slate-100 px-4 pb-3 pt-9" style={{ width: railWidth }}>
1062:               <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">Project / Schedule</div>
1063:               <button
1064:                 type="button"
```

## src/modules/pre-production/IntakePlanningTimeline.tsx

```text
19: export default function IntakePlanningTimeline({ bids, onSelectBid, onChanged, mode, setMode, items, loaded, productionLoaded, onRefresh }: {
20:   bids: Bid[]; onSelectBid(bid: Bid): void; onChanged(): Promise<unknown>;
21:   mode: PlanningMode; setMode(mode: PlanningMode): void; items: PlanningRecord[];
22:   loaded: boolean; productionLoaded: boolean;
23:   onRefresh(): Promise<unknown>;
24: }) {
25:   const auth = useAuth();
26:   const canWrite = Boolean(auth.profile?.isActive && auth.can('accessIntake'));
27:   const canEdit = () => canWrite;
28:   const [dayWidth, setDayWidth] = useState(20);
29:   const [compact,setCompact]=useState(false);
30:   const [calendarAnchor] = useState(monthStart);
31:   const [today, setToday] = useState(() => formatScheduleDate(new Date()));
32:   const rangeStart = shiftedDate(calendarAnchor, -3650);
33:   const days = 7301;
34:   const viewport = useRef<HTMLDivElement>(null);
35:   const controls = useRef<HTMLDivElement>(null);
36:   const hint = useRef<HTMLParagraphElement>(null);
37:   const fitFramed = useRef(false);
38:   const pan = useRef<{ x: number; scroll: number } | null>(null);
39:   const navigation = useRef<{ center: string } | null>({ center: shiftedDate(calendarAnchor, 21) });
40:   const [fitNotice, setFitNotice] = useState('');
41:   const [error, setError] = useState('');
42:   const [message, setMessage] = useState('');
43:   const [pendingId, setPendingId] = useState('');
44:   const [drag, setDrag] = useState<Drag | null>(null);
45:   const dragRef = useRef<Drag | null>(null);
46:   const suppressClick = useRef(false);
47:   const rangeEnd = formatScheduleDate(addCalendarDays(rangeStart, days - 1));
48:   const width = days * dayWidth;
49:   const tickDays = dayWidth >= 12 ? 7 : dayWidth >= 4 ? 28 : 56;
50:   const ticks = useMemo(() => Array.from({ length: Math.ceil(days / tickDays) }, (_, index) => ({ date: shiftedDate(rangeStart, index * tickDays), left: index * tickDays * dayWidth })), [rangeStart, days, dayWidth, tickDays]);
51:   useLayoutEffect(() => {
52:     const el = viewport.current, target = navigation.current;
53:     if (el && target) {
54:       el.scrollLeft = dayDistance(rangeStart, target.center) * dayWidth - Math.max(80, el.clientWidth - RAIL_WIDTH) / 2;
55:       navigation.current = null;
56:     }
57:   });
58:   // Keep a long-lived Planning tab current without moving its viewport.
59:   useEffect(() => {
60:     const update = () => setToday(formatScheduleDate(new Date()));
```

```text
119:     if (event.button !== 0 || event.pointerType === 'touch' || !(event.target as HTMLElement).closest('[data-planning-canvas]') || (event.target as HTMLElement).closest('button, a, input, select, [data-projected-block]')) return;
120:     pan.current = { x: event.clientX, scroll: event.currentTarget.scrollLeft };
121:     event.currentTarget.setPointerCapture(event.pointerId);
122:     event.currentTarget.style.cursor = 'grabbing';
123:     event.preventDefault();
124:   }
125:   function endPan() { pan.current = null; if (viewport.current) viewport.current.style.cursor = ''; }
126:   function geometry(start: string, end: string) {
127:     return planningIntervalGeometry(start < rangeStart ? rangeStart : start, end > rangeEnd ? rangeEnd : end, rangeStart, dayWidth);
128:   }
129:   function begin(event: PointerEvent<HTMLDivElement>, record: BidPlanning) {
130:     if (!canEdit() || pendingId || event.button !== 0 || !record.projected_production_start || !record.projected_production_end) return;
131:     const target = event.target as HTMLElement;
132:     const mode = (target.closest('[data-window-edge]')?.getAttribute('data-window-edge') ?? 'move') as WindowEdit;
133:     const next = { record, mode, x: event.clientX, start: record.projected_production_start, end: record.projected_production_end, moved: false };
134:     dragRef.current = next; setDrag(next); suppressClick.current = false;
135:     viewport.current?.focus({preventScroll:true});
136:     event.currentTarget.setPointerCapture(event.pointerId);
137:     event.preventDefault();
138:   }
139:   function move(event: PointerEvent<HTMLDivElement>) {
140:     const current = dragRef.current; if (!current) return;
141:     const moved = Math.abs(event.clientX - current.x) > 4;
142:     const delta = Math.round((event.clientX - current.x) / dayWidth);
143:     const adjusted = adjustProjectedWindow(current.record.projected_production_start!, current.record.projected_production_end!, delta, current.mode);
144:     if (adjusted && (adjusted.start !== current.start || adjusted.end !== current.end || moved !== current.moved)) { const next = { ...current, ...adjusted, moved: current.moved || moved }; dragRef.current = next; setDrag(next); }
145:   }
146:   async function finish() {
147:     const current = dragRef.current; dragRef.current = null; setDrag(null);
148:     if (!current || !canEdit()) return;
149:     suppressClick.current = current.moved;
150:     if (!current.moved) { const bid = bids.find(bid => bid.id === current.record.id); if (bid) onSelectBid(bid); suppressClick.current = true; return; }
151:     if (!current.moved || (current.start === current.record.projected_production_start && current.end === current.record.projected_production_end)) return;
152:     setPendingId(current.record.id); setError(''); setMessage('');
153:     try { await saveBidProjectedWindow(current.record, current.start, current.end); await onChanged(); setMessage('Projected production window updated.'); }
154:     catch (caught) { setError(`${caught instanceof Error ? caught.message : 'Unable to save projected window.'} Refresh to verify the saved dates before retrying.`); }
155:     finally { setPendingId(''); }
156:   }
157:   const cancel = () => { dragRef.current = null; setDrag(null); suppressClick.current = true; };
```

```text
166:   return <section className="mt-4 min-w-0" aria-label="Intake Planning">
167:     <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-bold">Projected Production Planning</h2><p className="mt-1 text-xs text-slate-600">Dashed PROJECTED = potential Intake work. Solid PRODUCTION = committed work. Projections do not reserve capacity.</p></div><div className="flex flex-wrap items-center gap-3"><button type="button" disabled={Boolean(pendingId)} onClick={() => { setError(''); void onRefresh().catch(caught => setError(caught.message)); }} className="min-h-10 border border-slate-300 px-3 text-sm">Refresh planning</button></div></div>
168:     <div ref={controls} data-planning-controls className="my-3 flex flex-wrap items-center gap-3"><div role="group" aria-label="Planning sources" className="flex flex-wrap border border-slate-300">{(['intake', 'production', 'combined'] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={`min-h-10 px-3 text-xs font-bold ${mode === value ? 'tenops-selected-surface' : 'bg-white text-slate-600'}`}>{value === 'intake' ? 'Projected Intake' : value === 'production' ? 'Production' : 'Combined'}</button>)}</div><div role="group" aria-label="Timeline viewport" className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-slate-600">Zoom</span><div className="flex items-center gap-1"><button type="button" aria-label="Zoom out" title="Zoom out" disabled={dayWidth <= MIN_DAY_WIDTH} onClick={() => zoomBy(1 / 1.5)} className={`${viewportButton} min-w-10 text-base`}>−</button><button type="button" aria-label="Zoom in" title="Zoom in" disabled={dayWidth >= MAX_DAY_WIDTH} onClick={() => zoomBy(1.5)} className={`${viewportButton} min-w-10 text-base`}>+</button></div><button type="button" onClick={resetZoom} disabled={dayWidth===20} className={viewportButton}>Reset zoom</button><button type="button" aria-pressed={compact} onClick={()=>setCompact(value=>!value)} className={viewportButton}>{compact?'Compact rows':'Comfortable rows'}</button><button type="button" onClick={goToToday} title="Show today with upcoming dates ahead" className={viewportButton}>Today</button><button type="button" onClick={fit} disabled={!loaded || (mode !== 'intake' && !productionLoaded)} className={viewportButton}>Fit</button></div></div>
169:     {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="mb-3 text-sm text-emerald-700">{message}</p>}
170:     {!loaded && <p className="py-4 text-sm">Loading projected windows…</p>}
171:     {mode !== 'intake' && !productionLoaded && <p className="py-4 text-sm">Loading current Production planning…</p>}
172:     <div ref={viewport} onPointerDown={beginPan} onPointerMove={event => { if (pan.current) event.currentTarget.scrollLeft = pan.current.scroll - (event.clientX - pan.current.x); }} onPointerUp={endPan} onPointerCancel={endPan} onLostPointerCapture={endPan} role="region" aria-label="Scrollable planning timeline" tabIndex={0} className="max-h-[65dvh] min-w-0 overflow-auto border border-slate-300 bg-white" onKeyDown={event => { if (event.key === 'Escape') { cancel(); endPan(); } }}>
173:       <div style={{ minWidth: width + RAIL_WIDTH }}>
174:         <div className="sticky top-0 z-20 flex h-10 border-b border-slate-300 bg-slate-100"><div className={`${railClass} bg-slate-100 text-xs font-bold`}>Opportunity / Job</div><div data-planning-canvas className="relative shrink-0 cursor-grab" style={canvasStyle}>{todayLine}{todayVisible && <span data-today-marker aria-label={`Today: ${today}`} className="pointer-events-none absolute top-0 rounded-sm bg-slate-100 px-1 text-[9px] font-semibold tracking-wide text-slate-600" style={{ left: todayLeft + 2 }}>TODAY</span>}{ticks.map(tick => <span key={tick.date} className="absolute top-5 text-[10px] text-slate-600" style={{ left: tick.left + 5 }}>{parseScheduleDate(tick.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}</span>)}</div></div>
```

```text
180:           const record = item.planning; const current = drag?.record.id === bid.id ? drag : null;
181:           const start = current?.start ?? record.projected_production_start, end = current?.end ?? record.projected_production_end;
182:           const visible = start && end && rangesIntersect(start, end, rangeStart, rangeEnd);
183:           return <div key={bid.id} data-intake-planning-row={bid.id} className={`flex border-b border-slate-200 ${compact?'min-h-11':'min-h-14'}`}><button type="button" onClick={() => onSelectBid(bid)} title={bid.projectName} className={railClass}><span className="flex min-w-0 items-center gap-1"><strong className="truncate text-xs">{bid.projectName}</strong><CuratedDemoBadge bidId={bid.id}/></span><span className="text-[10px] text-slate-500">INTAKE · {bid.status === 'won' ? 'Won' : 'Active'}</span></button><div data-planning-canvas className={`relative shrink-0 cursor-grab ${compact?'h-11':'h-14'}`} style={canvasStyle}>
184:             {visible ? <div data-projected-block onPointerDown={canWrite ? event => begin(event, record) : undefined} onPointerMove={canWrite ? move : undefined} onPointerUp={canWrite ? () => void finish() : undefined} onPointerCancel={canWrite ? cancel : undefined} onLostPointerCapture={canWrite ? ()=>{if(dragRef.current)cancel();} : undefined} className={`absolute top-1 flex ${compact?'h-9':'h-10'} touch-none items-center overflow-hidden rounded border border-dashed border-blue-600 hover:border-blue-800 focus-within:ring-2 focus-within:ring-blue-600 bg-blue-100/60 text-blue-950 ${current?'ring-2 ring-blue-700':''}`} style={{ ...geometry(start!, end!), backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 8px, rgba(59,130,246,.08) 8px 12px)' }} title={`PROJECTED: ${start} – ${end}. Tentative; no capacity reservation.`}>
185:               {canWrite && <button type="button" data-window-edge="start" aria-label={`Edit projected start for ${bid.projectName}`} onClick={() => open(bid)} className="h-full w-3 shrink-0 cursor-ew-resize border-r border-blue-400/40 hover:bg-blue-200 focus-visible:outline-2"/>}
186:               <button type="button" disabled={Boolean(pendingId)} onClick={() => open(bid)} className={`h-full min-w-0 flex-1 truncate px-1 text-left text-[10px] font-bold ${canWrite ? 'cursor-grab' : 'cursor-pointer'}`}>{current?`${start} – ${end}`:'PROJECTED'}</button>
187:               {canWrite && <button type="button" data-window-edge="end" aria-label={`Edit projected end for ${bid.projectName}`} onClick={() => open(bid)} className="h-full w-3 shrink-0 cursor-ew-resize border-l border-blue-400/40 hover:bg-blue-200 focus-visible:outline-2"/>}
188:             </div> : <button type="button" onClick={() => onSelectBid(bid)} className="sticky left-[248px] m-3 h-10 px-2 text-xs text-slate-500 underline">{start ? `Outside this period: ${start} – ${end}` : 'No projected window — set dates'}</button>}
189:           </div></div>;
190:           } else { const job = item.job;
191:           const jobPhases = item.phases;
192:           return <div key={item.key} data-production-planning-row={job.id} className="flex border-b border-slate-200"><button type="button" onClick={() => openProductionJob(job.id)} title={job.name} className={railClass}><strong className="block truncate text-xs">{job.job_number ? `${job.job_number} · ` : ''}{job.name}</strong><span className="text-[10px] text-slate-500">PRODUCTION{job.rework_cycle ? ' · REWORK' : ''}</span></button><div data-planning-canvas className="relative shrink-0 cursor-grab" style={{ ...canvasStyle, height: (compact?48:64) + jobPhases.length * (compact?20:24) }}>
193:             {job.planned_start && job.planned_end && rangesIntersect(job.planned_start, job.planned_end, rangeStart, rangeEnd) ? <button type="button" onClick={() => openProductionJob(job.id)} title={`PRODUCTION: ${job.planned_start} – ${job.planned_end}. Edit in Production.`} className="absolute top-3 h-9 overflow-hidden rounded border border-blue-950 bg-blue-800 px-2 text-left text-[10px] font-bold whitespace-nowrap text-white" style={geometry(job.planned_start, job.planned_end)}>PRODUCTION</button> : <span className="sticky left-[248px] m-3 inline-block text-xs text-slate-500">{job.planned_start ? 'Scheduled outside this period' : 'Production dates not set'}</span>}
194:             {jobPhases.map((phase, index) => phase.start_date && phase.end_date && rangesIntersect(phase.start_date, phase.end_date, rangeStart, rangeEnd) ? <button type="button" key={phase.id} onClick={() => openProductionJob(job.id)} title={`${phase.title} · ${phase.timeline_behavior} · ${phase.start_date} – ${phase.end_date}`} className={`absolute h-5 overflow-hidden rounded border px-1 text-left text-[9px] font-semibold whitespace-nowrap ${overlayVisualForPhase(jobPhases, phase.id).className}`} style={{ ...geometry(phase.start_date, phase.end_date), top: (compact?43:55) + index * (compact?20:24), ...(phase.timeline_behavior === 'pause' ? { backgroundImage: PLANNING_PAUSE_HATCH, color: '#111827' } : {}) }}><span className={phase.timeline_behavior === 'pause' ? 'bg-white px-1' : ''}>{phase.timeline_behavior === 'pause' ? 'PAUSE · ' : phase.timeline_behavior === 'planning_only' ? 'PLANNING ONLY · ' : ''}{phase.title}</span></button> : null)}
195:           </div></div>;
196:           }
197:         })}
198:         </div>
199:       </div>
200:     </div>
201:     {drag?.moved && <p role="status" aria-live="polite" className="mt-2 text-xs font-semibold text-blue-900">Proposed window: {drag.start} – {drag.end}. Release to save; Escape to cancel.</p>}
```

## src/modules/pre-production/IntakePlanning.tsx

```text
15: export default function IntakePlanning({ bids, onSelectBid, onChanged }: { bids: Bid[]; onSelectBid(bid: Bid): void; onChanged(): Promise<unknown> }) {
16:   const auth=useAuth();
17:   const [mode,setMode]=useState<PlanningMode>('intake');
18:   const [records,setRecords]=useState<BidPlanning[]>([]);
19:   const [jobs,setJobs]=useState<ProductionScheduleJob[]>([]);
20:   const [phases,setPhases]=useState<PlanningPhase[]>([]);
21:   const [loaded,setLoaded]=useState(false);
22:   const [loadedFor,setLoadedFor]=useState<{bids:Bid[];revision:number;role:string|undefined}|null>(null);
23:   const [error,setError]=useState(''),[revision,setRevision]=useState(0);
24:   const request=useRef<{bids: Bid[];revision:number;role: string | undefined;promise:Promise<[ProductionScheduleJob[],PlanningPhase[]]>}|null>(null);
25:   useEffect(()=>{let live=true;void loadBidPlanning().then(rows=>{if(live){setRecords(rows);setLoaded(true);}}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[bids,revision]);
26:   useEffect(()=>{
27:     if(mode==='intake')return;
28:     let live=true;
29:     if(!request.current||request.current.bids!==bids||request.current.revision!==revision||request.current.role!==auth.profile?.role){
30:       request.current={bids,revision,role:auth.profile?.role,promise:loadProductionScheduleJobs().then(async loadedJobs=>{
31:         const visible=productionJobsVisibleToRole(loadedJobs,auth.profile?.role);
32:         const loadedPhases=isPlanningEnabled(process.env.NEXT_PUBLIC_ENABLE_PLANNING)?await loadPlanningPhases(visible.map(j=>j.id)):[];
33:         return [visible,loadedPhases] as [ProductionScheduleJob[],PlanningPhase[]];
34:       })};
35:     }
36:     void request.current.promise.then(([nextJobs,nextPhases])=>{if(live){setJobs(nextJobs);setPhases(nextPhases);setLoadedFor({bids,revision,role:auth.profile?.role});}}).catch(e=>{request.current=null;if(live)setError(e.message);});
37:     return()=>{live=false;};
38:   },[mode,bids,revision,auth.profile?.role]);
39:   const productionLoaded=loadedFor?.bids===bids&&loadedFor.revision===revision&&loadedFor.role===auth.profile?.role;
40:   const all=useMemo(()=>normalizePlanning(bids,records,productionLoaded?jobs:[],productionLoaded?phases:[]),[bids,records,jobs,phases,productionLoaded]);
41:   const items=useMemo(()=>planningForMode(all,mode),[all,mode]);
42:   const refresh=async()=>{setError('');setRevision(v=>v+1);};
43:   return <div className="min-w-0">
44:     {error&&<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
45:     <IntakePlanningTimeline bids={bids} onSelectBid={onSelectBid} onChanged={onChanged} mode={mode} setMode={setMode} items={items} loaded={loaded} productionLoaded={productionLoaded} onRefresh={refresh}/>
46:   </div>;
47: }
```

## src/modules/pre-production/planning.ts

```text
1: import { addCalendarDays, formatScheduleDate } from '@/modules/production/schedule';
2:
3: export type BidPlanning = {
4:   id: string;
5:   updated_at: string;
6:   projected_production_start: string | null;
7:   projected_production_end: string | null;
8:   projected_window_updated_by: string | null;
9:   projected_window_updated_at: string | null;
10:   production_job_id: string | null;
11:   converted_at: string | null;
12:   converted_by_user_id: string | null;
13: };
14: export type WindowEdit = 'move' | 'start' | 'end';
15: export function adjustProjectedWindow(start: string, end: string, days: number, mode: WindowEdit) {
16:   const shift = (value: string) => formatScheduleDate(addCalendarDays(value, days));
17:   const nextStart = mode === 'end' ? start : shift(start);
18:   const nextEnd = mode === 'start' ? end : shift(end);
19:   return nextStart <= nextEnd ? { start: nextStart, end: nextEnd } : null;
20: }
21: export function projectedWindowEligible(status: string, planning: BidPlanning | undefined) {
22:   return status !== 'lost' && !planning?.production_job_id;
23: }
```

## src/modules/pre-production/planning-model.ts

```text
1: import type { ProductionScheduleJob } from '@/modules/production/jobs';
2: import type { PlanningPhase } from '@/modules/planning/types';
3: import type { Bid } from './types';
4: import { projectedWindowEligible, type BidPlanning } from './planning';
5:
6: export type PlanningMode = 'intake' | 'production' | 'combined';
7: type Common = { key: string; title: string; start: string | null; end: string | null };
8: export type PlanningRecord = Common & (
9:   { source: 'intake'; bid: Bid; planning: BidPlanning } |
10:   { source: 'production'; job: ProductionScheduleJob; phases: PlanningPhase[] }
11: );
12: const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
13: export const planningLabel = (s: string) => s.trim().toLocaleLowerCase('en-US');
14: export function chronologicalPlanning(a: PlanningRecord, b: PlanningRecord) {
15:   return compare(a.start ?? '9999-12-31', b.start ?? '9999-12-31') ||
16:     (a.source === b.source ? 0 : a.source === 'production' ? -1 : 1) ||
17:     compare(a.end ?? '9999-12-31', b.end ?? '9999-12-31') || compare(planningLabel(a.title), planningLabel(b.title)) || compare(a.key, b.key);
18: }
19: export function normalizePlanning(bids: Bid[], windows: BidPlanning[], jobs: ProductionScheduleJob[], phases: PlanningPhase[]): PlanningRecord[] {
20:   const windowsById = new Map(windows.map(w => [w.id, w]));
21:   const phasesByJob = new Map<string, PlanningPhase[]>();
22:   for (const phase of phases) { const list = phasesByJob.get(phase.job_id) ?? []; list.push(phase); phasesByJob.set(phase.job_id, list); }
23:   for (const list of phasesByJob.values()) list.sort((a,b) => compare(a.start_date ?? '9999-12-31', b.start_date ?? '9999-12-31') || compare(a.end_date ?? '9999-12-31', b.end_date ?? '9999-12-31') || compare(a.id,b.id));
24:   const result: PlanningRecord[] = [];
25:   for (const bid of bids) {
26:     const planning = windowsById.get(bid.id);
27:     if (!planning || !projectedWindowEligible(bid.status, planning)) continue;
28:     result.push({ key: `intake:${bid.id}`, source: 'intake', title: bid.projectName, start: planning.projected_production_start, end: planning.projected_production_end, bid, planning });
29:   }
30:   for (const job of jobs) {
31:     if (['complete','shipped','cancelled'].includes(job.production_status)) continue;
32:     result.push({ key: job.lifecycle_key ?? `original:${job.id}`, source: 'production', title: `${job.job_number ? `${job.job_number} · ` : ''}${job.name}`, start: job.planned_start, end: job.planned_end, job, phases: phasesByJob.get(job.id) ?? [] });
33:   }
34:   return result.sort(chronologicalPlanning);
35: }
36: export const planningForMode = (records: PlanningRecord[], mode: PlanningMode) => records.filter(r => mode === 'combined' || r.source === mode);
```

## src/modules/pre-production/planning-viewport.ts

```text
1: import { addCalendarDays, differenceInCalendarDays, formatScheduleDate, parseScheduleDate } from '@/modules/production/schedule';
2:
3: export const MIN_DAY_WIDTH = 2;
4: export const MAX_DAY_WIDTH = 48;
5: export const RAIL_WIDTH = 240;
6: export type PlanningRange = { start: string; end: string };
7: export const dayDistance = (start: string, end: string) => differenceInCalendarDays(parseScheduleDate(end), parseScheduleDate(start));
8: export const shiftedDate = (date: string, days: number) => formatScheduleDate(addCalendarDays(date, days));
9:
10: // Fit never compresses below 2px/day or frames more than one year. Distant
11: // outliers remain reachable by scrolling (ten years either side of today) or
12: // opening their row; they cannot collapse the useful calendar into a sliver.
13: export function fitPlanningRanges(ranges: PlanningRange[], availableWidth: number, today: string) {
14:   const starts = ranges.map(r => r.start).sort(), ends = ranges.map(r => r.end).sort();
15:   const start = starts[0] ?? today, end = ends.at(-1) ?? shiftedDate(today, 27);
16:   const span = dayDistance(start, end) + 1;
17:   const centers = ranges.map(r => shiftedDate(r.start, Math.floor(dayDistance(r.start, r.end) / 2))).sort();
18:   const center = span > 365 ? centers[Math.floor(centers.length / 2)] : shiftedDate(start, Math.floor(span / 2));
19:   const width = Math.max(80, availableWidth);
20:   const dayWidth = Math.max(MIN_DAY_WIDTH, Math.min(MAX_DAY_WIDTH, width / (Math.max(14, Math.min(365, span)) + 14)));
21:   return { center: center ?? today, dayWidth, limited: span > 365 || (span + 14) * MIN_DAY_WIDTH > width };
22: }
```

## src/modules/pre-production/planning-data.ts

```text
17:   }
18: }
19: export async function saveBidProjectedWindow(record: BidPlanning, start: string, end: string) {
20:   const { error } = await supabase.rpc('set_bid_projected_window', {
21:     p_bid_id: record.id, p_start: start || null, p_end: end || null, p_expected_updated_at: record.updated_at,
22:   });
23:   if (error) throw new Error(error.message);
24: }
25: export async function convertBidToProduction(record: BidPlanning, choice: 'carry' | 'new' | 'unscheduled', start: string, end: string, jobNumber: string) {
26:   const { data, error } = await supabase.rpc('convert_bid_to_production', {
27:     p_bid_id: record.id, p_expected_updated_at: record.updated_at, p_window_choice: choice,
28:     p_start: choice === 'new' ? start || null : null, p_end: choice === 'new' ? end || null : null,
29:     p_job_number: jobNumber.trim() || null,
30:   });
31:   if (error) throw new Error(error.message);
32:   return String(data);
33: }
```

## src/modules/pre-production/BidPlanningCard.tsx

```text
38:   const dirty=Boolean(record&&(start!==(record.projected_production_start??'')||end!==(record.projected_production_end??'')))||converting;
39:   useEffect(()=>{planningDraft.current=dirty;onDirtyChange?.(dirty);return()=>onDirtyChange?.(false);},[dirty,onDirtyChange]);
40:   useEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false);},[busy,onBusyChange]);
41:   async function save() {
42:     if (!canWrite || !record || busy) return;
43:     setBusy(true); setError(''); setMessage('');
44:     try { await saveBidProjectedWindow(record, start, end); await reload(); await onChanged(); setMessage('Projected production window updated.'); }
45:     catch (caught) { setError(`${caught instanceof Error ? caught.message : 'Unable to save projected window.'} Refresh to verify the saved dates before retrying.`); }
46:     finally { setBusy(false); }
47:   }
48:   async function convert() {
49:     if (!canWrite || !auth.can('createProductionJob') || !record || busy) return;
50:     setBusy(true); setError(''); setMessage('');
51:     try { await convertBidToProduction(record, choice, newStart, newEnd, jobNumber); await reload(); await onChanged(); setConverting(false); setMessage('Converted to Production. Production scheduling is now authoritative.'); }
52:     catch (caught) { setError(`${caught instanceof Error ? caught.message : 'Unable to convert Bid.'} Refresh to check whether conversion completed. Retrying will not create a second Job.`); }
53:     finally { setBusy(false); }
54:   }
55:   const valid = (!start && !end) || Boolean(start && end && start <= end);
```

```text
61:     {!record ? <p className="mt-3 text-sm text-slate-500">{error ? 'Planning information is unavailable. The planning migration must be installed before this feature can be used.' : 'Loading planning information…'}</p> : <>
62:       {record.production_job_id ? <div className="mt-3 space-y-2 text-sm"><p>Converted to Production. Original projection: {start && end ? `${start} – ${end}` : 'Not set'}.</p><button type="button" onClick={() => openProductionJob(record.production_job_id!)} className="min-h-10 font-semibold text-blue-700 underline">Open Production Job</button></div> : <>
63:         <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Projected start<BusinessInput type="date" aria-label="Projected start" value={start} disabled={!canWrite || busy} onChange={event => setStart(event.target.value)} className={input}/></label><label className="text-xs font-semibold">Projected end<BusinessInput type="date" aria-label="Projected end" min={start || undefined} value={end} disabled={!canWrite || busy} onChange={event => setEnd(event.target.value)} className={input}/></label></div>
64:         <div className="mt-3 flex flex-wrap gap-3"><BusinessButton type="button" disabled={!canWrite || busy || !valid} onClick={() => void save()} className="min-h-10 border border-blue-900 bg-blue-900 px-3 text-sm font-bold text-white disabled:opacity-50">Save projected window</BusinessButton><button type="button" disabled={!canWrite || busy} onClick={() => { setStart(''); setEnd(''); }} className="min-h-10 px-2 text-sm underline">Clear dates</button><button type="button" disabled={busy} onClick={() => {if(dirty&&!window.confirm('Discard unsaved planning dates and refresh?'))return;void reload().then(() => setError('')).catch(caught => setError(caught.message));}} className="min-h-10 px-2 text-sm underline">Refresh planning</button></div>
65:         {canWrite && auth.can('createProductionJob') && <div className="mt-4 border-t border-slate-200 pt-3"><p className="text-xs text-slate-600">Conversion requires a saved Won status and Deposit Received Date. Unsaved Bid edits are not carried forward.</p><button type="button" disabled={busy || bid.status !== 'won' || !bid.depositReceivedDate} onClick={() => { setConverting(true); setChoice(auth.can('scheduleProduction') && record.projected_production_start ? 'carry' : 'unscheduled'); }} className="mt-2 min-h-10 border border-slate-400 px-3 text-sm font-bold disabled:opacity-50">Convert to Production</button></div>}
66:         {converting && <fieldset className="mt-4 space-y-3 border border-slate-300 p-3" disabled={!canWrite || busy}><legend className="px-1 text-sm font-bold">Confirm Production handoff</legend><p className="text-xs text-slate-600">Creates one canonical Job. Original Bid and issued documents remain intact.</p><label className="block text-sm"><BusinessInput type="radio" name="conversion-window" checked={choice === 'carry'} disabled={!auth.can('scheduleProduction') || !record.projected_production_start} onChange={() => setChoice('carry')}/> Carry Forward: {record.projected_production_start ?? 'No projection'} – {record.projected_production_end ?? ''}</label><label className="block text-sm"><BusinessInput type="radio" name="conversion-window" checked={choice === 'new'} disabled={!auth.can('scheduleProduction')} onChange={() => setChoice('new')}/> Set New Dates</label><label className="block text-sm"><BusinessInput type="radio" name="conversion-window" checked={choice === 'unscheduled'} onChange={() => setChoice('unscheduled')}/> Plan in Production Later (original projection remains on Bid)</label>
67:           {!auth.can('scheduleProduction') && <p className="text-xs text-slate-600">A user with Production scheduling permission must confirm committed dates.</p>}
68:           {choice === 'new' && <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs">Production start<BusinessInput type="date" value={newStart} onChange={event => setNewStart(event.target.value)} className={input}/></label><label className="text-xs">Production end<BusinessInput type="date" min={newStart || undefined} value={newEnd} onChange={event => setNewEnd(event.target.value)} className={input}/></label></div>}
69:           <label className="block text-xs">Job number (optional; not allocated automatically)<BusinessInput value={jobNumber} onChange={event => setJobNumber(event.target.value)} className={input}/></label>
70:           <div className="flex flex-wrap gap-3"><button type="button" onClick={() => void convert()} disabled={choice === 'new' && (!newStart || !newEnd || newEnd < newStart)} className="min-h-10 bg-blue-900 px-3 text-sm font-bold text-white disabled:opacity-50">Confirm conversion</button><button type="button" onClick={() => setConverting(false)} className="min-h-10 px-2 text-sm underline">Cancel conversion</button></div>
```

## src/app/pre-production/layout.tsx

```text
1: "use client";
2:
3: import type { ReactNode } from 'react';
4: import { useAuth } from '@/lib/auth';
5:
6: // Gate the entire route subtree before mounting any Intake data loaders.
7: export default function IntakeAccessBoundary({ children }: { children: ReactNode }) {
8:   const auth = useAuth();
9:   if (!auth.ready) return <p className="p-6">Loading access…</p>;
10:   if (!auth.profile?.isActive || !auth.can('viewIntake')) {
11:     return <section className="p-6" role="alert"><h1 className="text-xl font-semibold">Intake access restricted</h1><p>An active authenticated account with Intake view access is required.</p></section>;
12:   }
13:   return children;
14: }
```

## src/modules/production/ProductionWorkspace.tsx

```text
421:   const stageSchedule = useCallback((job: ProductionJob, start: string, end: string, source: 'production_timeline' | 'production_table' | 'production_inspector' = 'production_timeline') => {
422:     setScheduleMessage('');
423:     setScheduleSaveState('idle');
424:     setBatchId(null);
425:     setConflicts([]);
426:     const previousStart = stagedSchedules[job.id]?.proposed_planned_start ?? job.planned_start;
427:     const nextProduction = updateStagedSchedule(stagedSchedules, job, start, end, source);
428:     const nextStart = nextProduction[job.id]?.proposed_planned_start ?? job.planned_start;
429:     const incrementalDelta = productionStartDelta({ ...job, planned_start: previousStart }, nextStart);
430:     setStagedSchedules(nextProduction);
431:     if (!job.rework_cycle) setStagedPlanningSchedules((current) => translateJobPlanningSchedules(current, planningPhases, job.id, incrementalDelta));
432:   }, [planningPhases, stagedSchedules]);
```

## src/modules/production/schedule-staging.ts

```text
23: }
24:
25: export function stageSchedule(current: StagedSchedules, job: ProductionJob, start: string | null, end: string | null, source: StagedSchedule['change_source']): StagedSchedules {
26:   const existing = current[job.id];
27:   const originalStart = existing?.original_planned_start ?? job.planned_start;
28:   const originalEnd = existing?.original_planned_end ?? job.planned_end;
29:   if (start === originalStart && end === originalEnd) {
30:     const next = { ...current }; delete next[job.id]; return next;
31:   }
32:   const changed_fields: StagedSchedule['changed_fields'] = [];
33:   if (start !== originalStart) changed_fields.push('planned_start');
34:   if (end !== originalEnd) changed_fields.push('planned_end');
35:   return { ...current, [job.id]: { job_id: job.id, original_planned_start: originalStart, original_planned_end: originalEnd, original_updated_at: existing?.original_updated_at ?? job.updated_at, proposed_planned_start: start, proposed_planned_end: end, change_source: source, changed_fields } };
36: }
37:
38: export function orderedStagedSchedules(staged: StagedSchedules, jobs: ProductionJob[]) {
39:   const order = new Map(jobs.map((job, index) => [job.id, index]));
40:   return Object.values(staged).sort((a, b) => (order.get(a.job_id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.job_id) ?? Number.MAX_SAFE_INTEGER));
41: }
42:
43: export function batchRpcArgs(staged: StagedSchedules, jobs: ProductionJob[], actor: string, note: string | null, batchId: string): ProductionScheduleBatchRpcArgs {
44:   return { p_proposals: orderedStagedSchedules(staged, jobs).map((stagedProposal) => { const proposal = { ...stagedProposal }; delete (proposal as Partial<StagedSchedule>).changed_fields; return proposal; }), p_changed_by: actor, p_change_note: note, p_batch_id: batchId };
45: }
```

## src/modules/planning/schedule-staging.ts

```text
43:   return {
44:     ...current,
45:     [phase.id]: {
46:       phase_id: phase.id,
47:       job_id: phase.job_id,
48:       original_start_date: originalStart,
49:       original_end_date: originalEnd,
50:       original_updated_at: existing?.original_updated_at ?? phase.updated_at,
51:       proposed_start_date: start,
52:       proposed_end_date: end,
53:       change_source: source,
54:       changed_fields: changedFields,
55:     },
56:   };
57: }
58:
59: export function planningPhaseWithStagedDates(phase: PlanningPhase, staged: StagedPlanningSchedules) {
60:   const proposal = staged[phase.id];
61:   return proposal
62:     ? { ...phase, start_date: proposal.proposed_start_date, end_date: proposal.proposed_end_date }
63:     : phase;
64: }
65:
66: export function productionStartDelta(job: ProductionJob, proposedStart: string | null) {
67:   return planningProductionStartDelta(job.planned_start, proposedStart);
68: }
69:
70: export function translateJobPlanningSchedules(
71:   current: StagedPlanningSchedules,
72:   phases: PlanningPhase[],
73:   jobId: string,
74:   deltaDays: number,
75: ) {
76:   return translatedPlanningIntervals(phases, current, jobId, deltaDays).reduce((next, interval) => (
77:     stagePlanningSchedule(next, interval.phase, interval.start, interval.end, interval.source)
78:   ), current);
79: }
80:
81: export function schedulingIssues(phases: PlanningPhase[], jobs: ProductionJob[]): PlanningScheduleIssue[] {
82:   return evaluatePlanningSchedule(phases, jobs);
83: }
84:
85: export function hasUnsavedPlanningSchedules(staged: StagedPlanningSchedules) {
86:   return Object.keys(staged).length > 0;
87: }
88:
89: export function rebaseStagedPlanningVersion(staged: StagedPlanningSchedules, phase: PlanningPhase) {
90:   const proposal = staged[phase.id];
91:   if (!proposal || phase.start_date !== proposal.original_start_date || phase.end_date !== proposal.original_end_date) return staged;
92:   return { ...staged, [phase.id]: { ...proposal, original_updated_at: phase.updated_at } };
93: }
```
