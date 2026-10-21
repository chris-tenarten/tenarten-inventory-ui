# Visual semantics source evidence
Released source 01e5e83. Numbered excerpts; no hosted records or effective-policy claims.
Light palette and behavior definitions only. The prototype uses its own blue navigation selection, not a new status.

## src/modules/production/components/ProductionGantt.tsx

```text
1100:           {scheduledJobs.map((job) => {
1101:             const hasSchedule = Boolean(job.planned_start && job.planned_end);
1102:             const hasDeliveryMilestone = Boolean(!hasSchedule && job.requested_delivery_date);
1103:             const activeInteraction = interaction?.jobId === job.id ? interaction : null;
1104:             const displayStart = activeInteraction?.previewStart || job.planned_start;
1105:             const displayEnd = activeInteraction?.previewEnd || job.planned_end;
1106:             const startOffset = hasSchedule && displayStart
1107:               ? differenceInCalendarDays(parseScheduleDate(displayStart), start)
1108:               : 0;
1109:             const duration = hasSchedule && displayStart && displayEnd
1110:               ? inclusiveCalendarDays(displayStart, displayEnd)
1111:               : 0;
1112:             const barWidth = Math.max(18, duration * dayWidth - 6);
1113:             const handleWidth = Math.min(12, Math.max(5, barWidth / 3));
1114:             const deliveryOffset = hasDeliveryMilestone
1115:               ? differenceInCalendarDays(parseScheduleDate(job.requested_delivery_date!), start)
1116:               : 0;
1117:             const intensity = displayStart && displayEnd ? laborIntensity(job.estimated_man_hours, displayStart, displayEnd) : null;
1118:             const stagedSchedule = stagedSchedules[job.id];
1119:             const isStaged = Boolean(stagedSchedule);
1120:             const statusVisual = productionStatusVisualByValue[job.production_status];
1121:             const jobPhases = phasesByJob.get(job.id) ?? [];
1122:             const timelinePhases = jobPhases.filter((card) => card.timeline_behavior !== 'planning_only' && card.start_date && card.end_date)
1123:               .sort((first, second) => first.start_date!.localeCompare(second.start_date!) || first.id.localeCompare(second.id));
1124:             const collapsedPhases = selectCollapsedTimelinePhases(timelinePhases, { canvasStart: canvasStartKey, canvasEnd: canvasEndKey, productionStart: displayStart, productionEnd: displayEnd });
1125:             const visibleOverlays = collapsedPhases.visible.filter((card) => card.timeline_behavior === 'overlay');
```

```text
1190:                   {todayIndex >= 0 && <div data-gantt-today className="pointer-events-none absolute inset-y-0 z-[1] w-px bg-blue-600" style={{ left: todayIndex * dayWidth + dayWidth / 2 }} />}
1191:
1192:                   {isStaged && stagedSchedule?.original_planned_start && stagedSchedule.original_planned_end && (
1193:                     <div
1194:                       aria-label={`Last saved schedule for ${job.name}: ${stagedSchedule.original_planned_start} through ${stagedSchedule.original_planned_end}`}
1195:                       className="pointer-events-none absolute top-1/2 z-[2] h-8 -translate-y-1/2 border-2 border-dashed border-slate-700 bg-slate-400/35"
1196:                       style={{
1197:                         left: differenceInCalendarDays(parseScheduleDate(stagedSchedule.original_planned_start), start) * dayWidth + 3,
1198:                         width: Math.max(18, inclusiveCalendarDays(stagedSchedule.original_planned_start, stagedSchedule.original_planned_end) * dayWidth - 6),
1199:                       }}
1200:                     >
1201:                       <span className="sr-only">Ghost bar showing the last saved schedule.</span>
1202:                     </div>
1203:                   )}
1204:
1205:                   {hasSchedule && displayStart && displayEnd && (
1206:                     <div
1207:                       data-timeline-interactive="true"
1208:                       data-production-bar
1209:                       data-production-status={job.production_status}
1210:                       data-fit-participant={productionTimelineFitParticipates(job.production_status) ? 'true' : 'false'}
1211:                       className={`absolute top-1/2 z-[3] h-8 -translate-y-1/2 border shadow-sm transition-[box-shadow,filter] ${statusVisual.timelineClassName ?? statusVisual.className} ${activeInteraction ? 'z-20 brightness-110 shadow-lg outline outline-2 outline-slate-950/50' : 'hover:brightness-105 hover:shadow-md'} ${isStaged ? 'ring-2 ring-amber-300 ring-offset-1' : ''}`}
```

```text
1256:                     const pauseGeometry = planningIntervalGeometry(pauseRange.start, pauseRange.end, formatScheduleDate(start), dayWidth);
1257:                     const intersectsProduction = rangesIntersect(pauseRange.start, pauseRange.end, displayStart, displayEnd);
1258:                     return <div key={pauseRange.phases.map((phase) => phase.id).join('-')} data-collapsed-planning-pause="true" aria-label={pauseRange.phases.map(phaseTitle).join('; ')} title={pauseRange.phases.map(phaseTitle).join('; ')} className={`pointer-events-none absolute border-y border-l border-slate-950 bg-white ${collapsedPhaseDisplay === 'fill' ? 'top-1/2 z-[4] h-8 -translate-y-1/2' : `top-[calc(50%+10px)] z-[5] h-1.5 ${intersectsProduction ? '' : 'opacity-80'}`}`} style={{ left: pauseGeometry.left - 3, width: pauseGeometry.width + 6, backgroundImage: PLANNING_PAUSE_HATCH }} />;
1259:                   })}
1260:                   {hasSchedule && visibleOverlays.map((card) => {
1261:                     const cardGeometry = planningIntervalGeometry(card.start_date!, card.end_date!, formatScheduleDate(start), dayWidth);
1262:                     const visual = overlayVisualForPhase(jobPhases, card.id);
1263:                     return <button key={card.id} type="button" data-timeline-interactive="true" data-collapsed-planning-phase="true" data-collapsed-phase-display={collapsedPhaseDisplay} onClick={(event) => { event.stopPropagation(); onSelectPlanningPhase?.(job, card); }} title={phaseTitle(card)} aria-label={`Open Phase ${card.title}`} className={`absolute border-y border-l outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${collapsedPhaseDisplay === 'fill' ? 'top-1/2 z-[4] h-8 -translate-y-1/2 opacity-70 hover:opacity-80 focus-visible:opacity-[0.85]' : 'top-[calc(50%+10px)] z-[5] h-1.5'} ${visual.className}`} style={{ left: cardGeometry.left - 3, width: cardGeometry.width + 6, borderColor: '#0f172a' }}><span className="sr-only">Planning overlay: {card.title}</span></button>;
1264:                   })}
1265:                   {hasSchedule && displayStart && displayEnd && hasCollapsedFillLayers && (
1266:                     <>
1267:                       <div
1268:                         data-collapsed-production-label="true"
1269:                         className="pointer-events-none absolute top-1/2 z-[6] flex h-8 min-w-0 -translate-y-1/2 items-center gap-2 overflow-hidden px-1.5 text-left text-[10px] font-bold uppercase tracking-[0.05em] text-slate-950"
1270:                         style={{ left: startOffset * dayWidth + 3 + handleWidth, width: Math.max(0, barWidth - handleWidth * 2) }}
1271:                         aria-hidden="true"
1272:                       >
```

```text
1292:                       >
1293:                         <span className="absolute left-1/2 top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-white/90 shadow-sm" />
1294:                       </div>
1295:                     </>
1296:                   )}
1297:                   {hasDeliveryMilestone && (
1298:                     <div className="absolute top-1/2 z-[3] -translate-x-1/2 -translate-y-1/2" style={{ left: deliveryOffset * dayWidth + dayWidth / 2 }} title={`Requested delivery: ${job.requested_delivery_date}`}>
1299:                       <div className="h-5 w-5 rotate-45 border-2 border-violet-800 bg-violet-200 shadow-sm" />
1300:                       <div className="absolute left-5 top-1/2 w-40 -translate-y-1/2 pl-2 text-[10px] font-bold uppercase tracking-[0.05em] text-violet-900">Delivery</div>
1301:                     </div>
1302:                   )}
1303:                   {!hasSchedule && !hasDeliveryMilestone && <div className="absolute left-4 top-1/2 z-[2] -translate-y-1/2"><span className="inline-flex border border-dashed border-slate-400 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600">Schedule not set</span></div>}
```

```text
1345:                       const phaseSeverity = phaseIssues.some((issue) => issue.severity === 'error') ? 'error' : phaseIssues.some((issue) => issue.severity === 'warning') ? 'warning' : null;
1346:                       const phaseIssuePopoverOpen = selectedPhaseWarningId === phase.id;
1347:                       const visual = phase.timeline_behavior === 'overlay' ? overlayVisualForPhase(jobPhases, phase.id) : null;
1348:                       const phaseProgress = calculatePhaseProgress(planningItems.filter((item) => item.phase_id === phase.id));
1349:                       const barClass = phase.timeline_behavior === 'pause' ? 'border-slate-950 bg-white text-slate-950' : visual!.className;
1350:                       const activePhaseInteraction = phaseInteraction?.phaseId === phase.id ? phaseInteraction : null;
1351:                       const handleWidth = Math.max(6, Math.min(10, Math.floor(geometry.width / 3)));
1352:                       const savedGeometry = stagedPhase ? planningIntervalGeometry(stagedPhase.original_start_date, stagedPhase.original_end_date, formatScheduleDate(start), dayWidth) : null;
1353:                       return <>{savedGeometry && <div aria-label={`Last saved schedule for ${phase.title}`} className="pointer-events-none absolute top-1/2 z-[2] h-6 -translate-y-1/2 border-2 border-dashed border-slate-700 bg-slate-400/25" style={{ left: savedGeometry.left, width: savedGeometry.width }} />}<div data-planning-phase-bar ref={(element) => { if (element) phaseElementRefs.current.set(phase.id, element); else phaseElementRefs.current.delete(phase.id); }} className={`absolute top-1/2 h-6 overflow-visible -translate-y-1/2 border shadow-sm transition-[box-shadow,filter] ${phaseIssuePopoverOpen ? 'z-50' : 'z-[3]'} ${activePhaseInteraction ? 'z-20 brightness-110 shadow-lg outline outline-2 outline-slate-950/50' : 'hover:brightness-105 hover:shadow-md'} ${isHighlighted ? 'ring-2 ring-slate-500 ring-offset-1' : ''} ${isStagedPhase ? 'ring-2 ring-amber-300 ring-offset-1' : ''} ${phaseSeverity === 'error' ? 'outline outline-2 outline-red-600 outline-offset-1' : phaseSeverity === 'warning' ? 'outline outline-2 outline-orange-500 outline-offset-1' : ''} ${barClass}`} style={{ left: geometry.left, width: geometry.width, backgroundImage: phase.timeline_behavior === 'pause' ? PLANNING_PAUSE_HATCH : undefined }}>
1354:                         {visual && phaseProgress.percent > 0 && <div aria-hidden="true" data-planning-progress-fill className={`pointer-events-none absolute inset-y-0 left-0 z-[1] ${visual.progressClassName}`} style={{ width: `${phaseProgress.percent}%` }} />}
1355:                         {visual && phaseProgress.percent > 0 && phaseProgress.percent < 100 && <div aria-hidden="true" data-planning-progress-boundary className="pointer-events-none absolute inset-y-0 z-[9] w-0.5 -translate-x-0.5 bg-slate-950/80" style={{ left: `${phaseProgress.percent}%` }} />}
1356:                         <BusinessButton type="button" data-timeline-interactive="true" aria-label={`Resize ${phase.title} start date. Use left and right arrow keys for one-day adjustments.`} onPointerDown={(event) => startPhaseInteraction(event, phase, 'resize-start')} onKeyDown={(event) => handlePhaseScheduleKey(event, phase, 'resize-start')} onDragStart={(event) => event.preventDefault()} className="group/handle absolute inset-y-0 left-0 z-20 border-r border-white/20 bg-black/10 outline-none hover:bg-white/30 focus-visible:bg-white/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white" style={{ width: handleWidth, cursor: 'ew-resize', pointerEvents: 'auto', touchAction: 'none' }}><span className="absolute left-1/2 top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-white/75 shadow-sm" /></BusinessButton>
```

## src/modules/pre-production/IntakePlanningTimeline.tsx

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
```

## src/modules/planning/phase-visuals.ts

```text
1: import type { PlanningPhase, PlanningTimelineColor } from "./types";
2:
3: export const PLANNING_OVERLAY_PALETTE: ReadonlyArray<{ key: PlanningTimelineColor; name: string; className: string; swatchClassName: string; progressClassName: string }> = [
4:   { key: "steel_blue", name: "Steel Blue", className: "border-blue-700 bg-blue-300/90 text-blue-950", swatchClassName: "border-blue-700 bg-blue-300", progressClassName: "bg-blue-600" },
5:   { key: "industrial_teal", name: "Industrial Teal", className: "border-teal-700 bg-teal-200/90 text-teal-950", swatchClassName: "border-teal-700 bg-teal-300", progressClassName: "bg-teal-600" },
6:   { key: "muted_violet", name: "Muted Violet", className: "border-violet-700 bg-violet-200/90 text-violet-950", swatchClassName: "border-violet-700 bg-violet-300", progressClassName: "bg-violet-600" },
7:   { key: "ochre_gold", name: "Ochre Gold", className: "border-amber-700 bg-amber-200/90 text-amber-950", swatchClassName: "border-amber-700 bg-amber-300", progressClassName: "bg-amber-600" },
8:   { key: "slate", name: "Machine Slate", className: "border-slate-700 bg-slate-300/90 text-slate-950", swatchClassName: "border-slate-700 bg-slate-400", progressClassName: "bg-slate-600" },
9:   { key: "rust", name: "Muted Rust", className: "border-orange-800 bg-orange-200/90 text-orange-950", swatchClassName: "border-orange-800 bg-orange-300", progressClassName: "bg-orange-600" },
10:   { key: "sage", name: "Industrial Sage", className: "border-lime-800 bg-lime-200/80 text-lime-950", swatchClassName: "border-lime-800 bg-lime-300", progressClassName: "bg-lime-600" },
11:   { key: "deep_cyan", name: "Deep Cyan", className: "border-cyan-800 bg-cyan-200/90 text-cyan-950", swatchClassName: "border-cyan-800 bg-cyan-300", progressClassName: "bg-cyan-600" },
12: ];
13:
14: export const PLANNING_PAUSE_HATCH = "repeating-linear-gradient(135deg, #111827 0 3px, #ffffff 3px 6px)";
15:
16: export function orderedOverlayPhases(phases: PlanningPhase[]) {
17:   return phases.filter((phase) => phase.timeline_behavior === "overlay").sort((first, second) =>
18:     first.created_at.localeCompare(second.created_at) ||
19:     first.id.localeCompare(second.id));
20: }
21:
22: export function overlayVisualIndexForPhase(phases: PlanningPhase[], phaseId?: string) {
23:   const ordered = orderedOverlayPhases(phases);
24:   const index = phaseId ? ordered.findIndex((phase) => phase.id === phaseId) : ordered.length;
25:   return (index < 0 ? ordered.length : index) % PLANNING_OVERLAY_PALETTE.length;
26: }
27:
28: export function overlayVisualForPhase(phases: PlanningPhase[], phaseId?: string) {
29:   const assignedColor = phases.find((phase) => phase.id === phaseId)?.timeline_color;
30:   return PLANNING_OVERLAY_PALETTE.find((visual) => visual.key === assignedColor)
31:     ?? PLANNING_OVERLAY_PALETTE[overlayVisualIndexForPhase(phases, phaseId)];
32: }
33:
34: export function overlayVisualForColor(color: PlanningTimelineColor) {
35:   return PLANNING_OVERLAY_PALETTE.find((visual) => visual.key === color) ?? PLANNING_OVERLAY_PALETTE[0];
36: }
```

## src/modules/production/status-visuals.ts

```text
1: import type { ProductionStatus } from './types';
2:
3: export type ProductionStatusVisual = {
4:   value: ProductionStatus;
5:   label: string;
6:   className: string;
7:   pattern?: string;
8:   timelineClassName?: string;
9:   timelinePattern?: string;
10: };
11:
12: export const productionStatusVisuals: ProductionStatusVisual[] = [
13:   { value: 'not_started', label: 'Not Started', className: 'production-status-not-started' },
14:   {
15:     value: 'on_deck',
16:     label: 'On Deck',
17:     className: 'production-status-on-deck',
18:     pattern: 'repeating-linear-gradient(135deg, #2f855a 0, #2f855a 8px, #f8fafc 8px, #f8fafc 14px)',
19:   },
20:   { value: 'in_production', label: 'In Production', className: 'production-status-in-production' },
21:   {
22:     value: 'on_hold',
23:     label: 'On Hold',
24:     className: 'production-status-on-hold',
25:     pattern: 'repeating-linear-gradient(135deg, transparent 0, transparent 6px, rgba(255,255,255,0.24) 6px, rgba(255,255,255,0.24) 10px)',
26:   },
27:   {
28:     value: 'shipped',
29:     label: 'Shipped',
30:     className: 'production-status-shipped',
31:     pattern: 'repeating-linear-gradient(45deg, transparent 0, transparent 8px, rgba(255,255,255,0.1) 8px, rgba(255,255,255,0.1) 10px)',
32:   },
33:   {
34:     value: 'complete',
35:     label: 'Complete',
36:     className: 'production-status-complete',
37:     pattern: 'repeating-linear-gradient(135deg, #7c3aed 0, #7c3aed 8px, #f8fafc 8px, #f8fafc 14px)',
38:   },
39:   { value: 'cancelled', label: 'Cancelled', className: 'production-status-cancelled' },
40: ];
41:
42: export const productionStatusVisualByValue = Object.fromEntries(
43:   productionStatusVisuals.map((visual) => [visual.value, visual]),
44: ) as Record<ProductionStatus, ProductionStatusVisual>;
```

## src/modules/planning/progress.mjs

```text
1: export function calculatePhaseProgress(items) {
2:   const completedItems = items.filter((item) => item.is_complete).length;
3:   const totalHours = items.reduce((sum, item) => sum + Number(item.estimated_hours || 0), 0);
4:   const completedHours = items.reduce((sum, item) => sum + (item.is_complete ? Number(item.estimated_hours || 0) : 0), 0);
5:   return {
6:     completedItems,
7:     totalItems: items.length,
8:     completedHours,
9:     totalHours,
10:     percent: totalHours ? Math.round((completedHours / totalHours) * 100) : 0,
11:   };
12: }
13:
14: export function calculatePlanningProgress(phases, items) {
15:   const includedPhaseIds = new Set(phases.filter((phase) => phase.timeline_behavior !== "pause").map((phase) => phase.id));
16:   return calculatePhaseProgress(items.filter((item) => includedPhaseIds.has(item.phase_id)));
17: }
18:
19: export function calculatePlanningCoverage(phases, items) {
20:   const activePhaseIds = new Set(phases.filter((phase) => phase.timeline_behavior !== "pause").map((phase) => phase.id));
21:   const plannedItems = items.filter((item) => activePhaseIds.has(item.phase_id));
22:   return {
```

## src/app/globals.css

```text
261: .production-status-not-started {
262:   border-color: #94a3b8;
263:   background-color: #e2e8f0;
264:   color: #334155;
265: }
266:
267: .production-status-on-deck {
268:   border-color: #166534;
269:   background-color: #2f855a;
270:   color: #020617;
271:   box-shadow: 0 0 0 1px rgb(22 101 52 / 0.28), 0 2px 4px rgb(22 101 52 / 0.2);
272:   text-shadow: 0 1px 0 rgb(255 255 255 / 0.7);
273: }
274:
275: .production-status-in-production {
276:   border-color: #0f172a;
277:   background-color: #172554;
278:   color: #f8fafc;
279: }
280:
281: .production-status-on-hold {
282:   border-color: #881337;
283:   background-color: #be123c;
284:   color: #ffffff;
285: }
286:
287: .production-status-shipped {
288:   border-color: #155e75;
289:   background-color: #0e7490;
290:   color: #ffffff;
291: }
292:
293: .production-status-complete {
294:   border-color: #6d28d9;
295:   background-color: #7c3aed;
296:   color: #111827;
297:   text-shadow: -1px 0 rgb(255 255 255 / 0.95), 0 1px rgb(255 255 255 / 0.95), 1px 0 rgb(255 255 255 / 0.95), 0 -1px rgb(255 255 255 / 0.95);
298: }
299:
300: [data-production-bar][data-production-status="complete"] [data-gantt-bar-copy],
```

```text
331: .production-status-cancelled {
332:   border-color: #7f3f46;
333:   background-color: #a65359;
334:   color: #ffffff;
335: }
```

## src/modules/pre-production/planning-model.ts

```text
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
