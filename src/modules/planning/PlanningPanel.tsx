"use client";

import Link from "next/link";
import { AlertTriangle, ChevronDown, ChevronRight, Info, Layers, Plus, Settings2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ProductionJob } from "@/modules/production/types";
import {
  copyLibraryPhaseToJob,
  createPlanningItem,
  createPlanningPhase,
  deletePlanningItem,
  deletePlanningPhase,
  loadPhaseLibrary,
  loadPlanningItems,
  loadPlanningPhases,
  updatePlanningItem,
  updatePlanningPhase,
} from "./data";
import { calculatePhaseProgress, calculatePlanningCoverage, calculatePlanningProgress, formatPlanningHours } from "./progress.mjs";
import { overlayVisualForPhase, PLANNING_PAUSE_HATCH } from "./phase-visuals";
import PlanningItemEditor from "./PlanningItemEditor";
import PlanningPhaseEditor from "./PlanningPhaseEditor";
import PhaseCreationDialog from "./PhaseCreationDialog";
import { planningPhaseWithStagedDates, type StagedPlanningSchedules } from "./schedule-staging";
import type { PlanningScheduleIssue } from "./schedule-model.mjs";
import { countsTowardPlanningPhaseLimit, MAX_PLANNING_PHASES, planningStatuses, statusLabels } from "./types";
import type {
  PhaseLibraryEntry,
  PhaseLibraryItem,
  PlanningItem,
  PlanningItemInput,
  PlanningPhase,
  PlanningPhaseInput,
  PlanningStatus,
} from "./types";

type Props = {
  job: ProductionJob;
  compact?: boolean;
  initialPhaseId?: string;
  onPhasesChanged?: (jobId: string, phases: PlanningPhase[]) => void;
  onItemsChanged?: (jobId: string, items: PlanningItem[]) => void;
  onEditorOpenChanged?: (open: boolean) => void;
  stagedSchedules?: StagedPlanningSchedules;
  planningIssues?: PlanningScheduleIssue[];
};

type ItemEditorState = { phaseId: string; item: PlanningItem | null };

function phaseDateLabel(phase: PlanningPhase) {
  if (!phase.start_date) return null;
  return phase.end_date && phase.end_date !== phase.start_date
    ? `${phase.start_date} – ${phase.end_date}`
    : phase.start_date;
}

function timelineBehaviorLabel(phase: PlanningPhase) {
  if (phase.timeline_behavior === "planning_only") return "Planning only";
  return phase.timeline_behavior === "pause" ? "Pause" : "Overlay";
}

export default function PlanningPanel({ job, compact = false, initialPhaseId, onPhasesChanged, onItemsChanged, onEditorOpenChanged, stagedSchedules = {}, planningIssues = [] }: Props) {
  const [phases, setPhases] = useState<PlanningPhase[]>([]);
  const [items, setItems] = useState<PlanningItem[]>([]);
  const [library, setLibrary] = useState<PhaseLibraryEntry[]>([]);
  const [libraryItems, setLibraryItems] = useState<PhaseLibraryItem[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [phaseEditor, setPhaseEditor] = useState<PlanningPhase | null | undefined>();
  const [itemEditor, setItemEditor] = useState<ItemEditorState | null>(null);
  const [creationTemplate, setCreationTemplate] = useState<PhaseLibraryEntry | null>(null);
  const [creationBusy, setCreationBusy] = useState(false);
  const [creationError, setCreationError] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<PlanningStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const openerRef = useRef<HTMLElement | null>(null);
  const itemsRef = useRef<PlanningItem[]>([]);
  const savingCompletionIdsRef = useRef<Set<string>>(new Set());
  const [savingCompletionIds, setSavingCompletionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    Promise.all([loadPlanningPhases(job.id), loadPhaseLibrary()])
      .then(async ([loadedPhases, templates]) => {
        const loadedItems = await loadPlanningItems(loadedPhases.map((phase) => phase.id));
        if (!active) return;
        setPhases(loadedPhases);
        itemsRef.current = loadedItems;
        setItems(loadedItems);
        onItemsChanged?.(job.id, loadedItems);
        setLibrary(templates.entries.filter((entry) => entry.active));
        setLibraryItems(templates.items);
        onPhasesChanged?.(job.id, loadedPhases);
        if (initialPhaseId) {
          const target = loadedPhases.find((phase) => phase.id === initialPhaseId);
          if (target) {
            setExpanded((current) => new Set(current).add(target.id));
            setPhaseEditor(target);
            onEditorOpenChanged?.(true);
          }
        }
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load Planning.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initialPhaseId, job.id, onEditorOpenChanged, onItemsChanged, onPhasesChanged]);

  const progress = useMemo(() => calculatePlanningProgress(phases, items), [items, phases]);
  const coverage = useMemo(() => calculatePlanningCoverage(phases, items), [items, phases]);
  const planningPhaseCount = phases.filter((phase) => countsTowardPlanningPhaseLimit(phase.timeline_behavior)).length;
  const owners = useMemo(
    () => [...new Set(phases.map((phase) => phase.owner).filter((value): value is string => Boolean(value)))].sort(),
    [phases],
  );
  const visiblePhases = phases
    .filter(
      (phase) =>
        (!ownerFilter || phase.owner === ownerFilter) &&
        (!statusFilter || phase.status === statusFilter),
    )
    .sort((left, right) => {
      const leftPhase = planningPhaseWithStagedDates(left, stagedSchedules);
      const rightPhase = planningPhaseWithStagedDates(right, stagedSchedules);
      if (leftPhase.start_date !== rightPhase.start_date) {
        if (!leftPhase.start_date) return 1;
        if (!rightPhase.start_date) return -1;
        return leftPhase.start_date.localeCompare(rightPhase.start_date);
      }
      if (leftPhase.end_date !== rightPhase.end_date) {
        if (!leftPhase.end_date) return 1;
        if (!rightPhase.end_date) return -1;
        return leftPhase.end_date.localeCompare(rightPhase.end_date);
      }
      return left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id);
    });

  function publishPhases(next: PlanningPhase[]) {
    setPhases(next);
    onPhasesChanged?.(job.id, next);
  }

  function publishItems(next: PlanningItem[]) {
    itemsRef.current = next;
    setItems(next);
    onItemsChanged?.(job.id, next);
  }

  function replacePublishedItem(itemId: string, update: (item: PlanningItem) => PlanningItem) {
    publishItems(itemsRef.current.map((item) => item.id === itemId ? update(item) : item));
  }

  async function toggleItemCompletion(item: PlanningItem, isComplete: boolean) {
    if (savingCompletionIdsRef.current.has(item.id)) return;

    const previousCompletion = item.is_complete;
    savingCompletionIdsRef.current.add(item.id);
    setSavingCompletionIds((current) => new Set(current).add(item.id));
    setError("");
    replacePublishedItem(item.id, (current) => ({ ...current, is_complete: isComplete }));

    try {
      const confirmed = await updatePlanningItem(item.id, { is_complete: isComplete });
      replacePublishedItem(item.id, () => confirmed);
    } catch (caught) {
      replacePublishedItem(item.id, (current) => ({ ...current, is_complete: previousCompletion }));
      setError(caught instanceof Error ? caught.message : "Unable to update Item completion.");
    } finally {
      savingCompletionIdsRef.current.delete(item.id);
      setSavingCompletionIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  }

  function openPhase(phase: PlanningPhase | null, opener: HTMLElement) {
    openerRef.current = opener;
    setPhaseEditor(phase);
    onEditorOpenChanged?.(true);
  }

  function openItem(phaseId: string, item: PlanningItem | null, opener: HTMLElement) {
    openerRef.current = opener;
    setItemEditor({ phaseId, item });
    onEditorOpenChanged?.(true);
  }

  function closeEditor() {
    setPhaseEditor(undefined);
    setItemEditor(null);
    onEditorOpenChanged?.(false);
    requestAnimationFrame(() => openerRef.current?.focus());
  }

  async function savePhase(input: PlanningPhaseInput) {
    if (phaseEditor) {
      if (!countsTowardPlanningPhaseLimit(phaseEditor.timeline_behavior)
        && countsTowardPlanningPhaseLimit(input.timeline_behavior)
        && planningPhaseCount >= MAX_PLANNING_PHASES) {
        throw new Error("Maximum of four Planning Phases per Production job. Pause intervals do not count toward this limit.");
      }
      const next = await updatePlanningPhase(phaseEditor.id, input);
      publishPhases(phases.map((phase) => (phase.id === next.id ? next : phase)));
    } else {
      if (countsTowardPlanningPhaseLimit(input.timeline_behavior) && planningPhaseCount >= MAX_PLANNING_PHASES) {
        throw new Error("Maximum of four Planning Phases per Production job. Pause intervals do not count toward this limit.");
      }
      const next = await createPlanningPhase(input);
      publishPhases([next, ...phases]);
      setExpanded((current) => new Set(current).add(next.id));
    }
  }

  async function saveItem(input: PlanningItemInput) {
    if (itemEditor?.item) {
      const next = await updatePlanningItem(itemEditor.item.id, input);
      publishItems(items.map((item) => (item.id === next.id ? next : item)));
    } else {
      const next = await createPlanningItem(input);
      publishItems([...items, next]);
      setExpanded((current) => new Set(current).add(input.phase_id));
    }
  }

  function openPhaseCreation(entryId: string, opener: HTMLElement) {
    const entry = library.find((candidate) => candidate.id === entryId);
    if (!entry) return;
    if (countsTowardPlanningPhaseLimit(entry.default_timeline_behavior) && planningPhaseCount >= MAX_PLANNING_PHASES) {
      setError("Maximum of four Planning Phases per Production job. Pause intervals do not count toward this limit.");
      return;
    }
    openerRef.current = opener;
    setCreationError("");
    setCreationTemplate(entry);
    onEditorOpenChanged?.(true);
  }

  function closePhaseCreation() {
    setCreationTemplate(null);
    setCreationError("");
    onEditorOpenChanged?.(false);
    requestAnimationFrame(() => openerRef.current?.focus());
  }

  async function applyLibraryPhase(entry: PhaseLibraryEntry, selectedItemIds: string[]) {
    if (entry.default_timeline_behavior === "overlay" && selectedItemIds.length === 0) {
      setCreationError("Select at least one Item to create this Phase.");
      return;
    }
    setError("");
    setCreationError("");
    setCreationBusy(true);
    try {
      const copied = await copyLibraryPhaseToJob(job.id, entry, libraryItems, job.planned_start, selectedItemIds);
      publishPhases([copied.phase, ...phases]);
      publishItems([...items, ...copied.items]);
      setExpanded((current) => new Set(current).add(copied.phase.id));
      closePhaseCreation();
    } catch (caught) {
      setCreationError(caught instanceof Error ? caught.message : "Unable to add the Phase Library definition.");
    } finally {
      setCreationBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {!compact && <h2 className="text-lg font-bold">{job.job_number ? `${job.job_number} — ` : ""}{job.name}</h2>}
          <p className="text-xs text-slate-500">{phases.length} Phase{phases.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/settings?returnJobId=${encodeURIComponent(job.id)}&returnJobName=${encodeURIComponent(job.name)}#phase-library`} className="inline-flex h-9 items-center gap-1.5 border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600"><Settings2 className="h-4 w-4" aria-hidden="true" />Phase Library</Link>
          {library.length > 0 && (
            <select aria-label="Add from Phase Library" defaultValue="" onChange={(event) => { const value = event.target.value; event.target.value = ""; if (value) openPhaseCreation(value, event.currentTarget); }} className="h-9 border border-slate-300 bg-white px-2 text-xs font-bold">
              <option value="">Add from Phase Library…</option>
              {library.map((entry) => <option key={entry.id} value={entry.id} disabled={planningPhaseCount >= MAX_PLANNING_PHASES && countsTowardPlanningPhaseLimit(entry.default_timeline_behavior)}>{entry.name}{planningPhaseCount >= MAX_PLANNING_PHASES && countsTowardPlanningPhaseLimit(entry.default_timeline_behavior) ? " — limit reached" : ""}</option>)}
            </select>
          )}
          <button type="button" title={planningPhaseCount >= MAX_PLANNING_PHASES ? "Four Planning Phases exist. Pause intervals may still be added." : "Add Planning Phase"} onClick={(event) => openPhase(null, event.currentTarget)} className="inline-flex h-9 items-center gap-1.5 border border-blue-800 bg-blue-50 px-3 text-xs font-bold text-blue-900 focus-visible:ring-2 focus-visible:ring-blue-600"><Plus className="h-4 w-4" aria-hidden="true" />{planningPhaseCount >= MAX_PLANNING_PHASES ? "Add Pause" : "Add Phase"}</button>
        </div>
      </div>

      {!loading && phases.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <section className="border border-slate-200 bg-white p-3" aria-label="Execution Progress">
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-1"><h3 className="text-xs font-bold uppercase tracking-[0.1em] text-slate-600">Execution Progress</h3><span tabIndex={0} aria-label="About Execution Progress" className="group relative inline-flex rounded-full text-slate-400 outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><Info className="h-3.5 w-3.5" aria-hidden="true" /><span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 hidden w-56 -translate-x-1/2 border border-slate-300 bg-slate-950 px-2 py-1.5 text-[11px] font-normal normal-case tracking-normal text-white shadow-lg group-hover:block group-focus:block">Weighted completion of all modeled Planning Items for this job.</span></span></div><strong className="text-sm text-slate-900">{progress.percent}%</strong></div>
          <div className="mt-2 h-2 overflow-hidden bg-slate-200"><div className="h-full bg-blue-700" style={{ width: `${progress.percent}%` }} /></div>
          <p className="mt-2 text-xs text-slate-600">{formatPlanningHours(progress.completedHours)} / {formatPlanningHours(progress.totalHours)} hrs · {progress.completedItems} / {progress.totalItems} items complete</p>
        </section>
        <section className="border border-slate-200 bg-slate-50 p-3" aria-label="Planning Coverage">
          <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-slate-600">Planning Coverage</h3>
          <p className="mt-3 text-xs text-slate-600">{coverage.plannedItems} planned items · {formatPlanningHours(coverage.plannedHours)} planned hrs · {coverage.activePhases} active phases</p>
        </section>
      </div>}

      {planningPhaseCount >= MAX_PLANNING_PHASES && <div className={`mt-3 border px-3 py-2 text-xs font-semibold ${planningPhaseCount > MAX_PLANNING_PHASES ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-300 bg-slate-50 text-slate-600"}`}>{planningPhaseCount > MAX_PLANNING_PHASES ? `This job has ${planningPhaseCount} Planning Phases. Existing data remains editable, but the over-limit condition cannot grow. Pause intervals remain available.` : "Maximum of four Planning Phases per Production job. Pause intervals do not count toward this limit."}</div>}

      {!compact && phases.length > 0 && (
        <div className="mt-3 grid gap-2 border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2" aria-label="Planning filters">
          <label className="text-xs font-bold">Owner<select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} className="mt-1 h-9 w-full border border-slate-300 bg-white px-2"><option value="">All owners</option>{owners.map((owner) => <option key={owner}>{owner}</option>)}</select></label>
          <label className="text-xs font-bold">Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as PlanningStatus | "")} className="mt-1 h-9 w-full border border-slate-300 bg-white px-2"><option value="">All statuses</option>{planningStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
        </div>
      )}

      {error && <div role="alert" className="mt-3 border border-red-300 bg-red-50 p-2 text-sm font-semibold text-red-800">{error}</div>}
      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading Planning…</p>
      ) : phases.length === 0 ? (
        <div className="mt-4 border border-dashed border-slate-300 p-4 text-sm text-slate-500"><Layers className="mr-1 inline h-4 w-4" aria-hidden="true" />No Phases for this job. Create a blank Phase or add one from the Phase Library.</div>
      ) : visiblePhases.length === 0 ? (
        <div className="mt-4 border border-dashed border-slate-300 p-4 text-sm text-slate-500">No Phases match the current filters.</div>
      ) : (
        <div className="mt-4 space-y-2">
          {visiblePhases.map((phase) => {
            const displayedPhase = planningPhaseWithStagedDates(phase, stagedSchedules);
            const phaseItems = items.filter((item) => item.phase_id === phase.id);
            const phaseProgress = calculatePhaseProgress(phaseItems);
            const isExpanded = expanded.has(phase.id);
            const dateLabel = phaseDateLabel(displayedPhase);
            const isScheduleStaged = Boolean(stagedSchedules[phase.id]);
            const prerequisite = phases.find((candidate) => candidate.id === phase.blocked_by_phase_id);
            const isBlocked = Boolean(prerequisite && prerequisite.status !== "done");
            const scheduleIssues = planningIssues.filter((issue) => issue.successor_id === phase.id);
            return (
              <section key={phase.id} className="border border-slate-300 bg-white">
                <div className="flex items-center gap-2 p-3">
                  <button type="button" aria-expanded={isExpanded} aria-label={`${isExpanded ? "Collapse" : "Expand"} ${phase.title}`} onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(phase.id)) next.delete(phase.id); else next.add(phase.id); return next; })} className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-slate-600 focus-visible:ring-2 focus-visible:ring-blue-600">{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
                  <button type="button" onClick={(event) => openPhase(phase, event.currentTarget)} className="min-w-0 flex-1 text-left focus-visible:ring-2 focus-visible:ring-blue-600">
                    <div className="flex items-center gap-2 font-bold text-slate-950">
                      {phase.timeline_behavior === "overlay" ? <span aria-label={`${phase.title} Overlay color: ${overlayVisualForPhase(phases, phase.id).name}`} title={`Overlay color: ${overlayVisualForPhase(phases, phase.id).name}`} className={`h-3 w-5 shrink-0 border ${overlayVisualForPhase(phases, phase.id).swatchClassName}`} /> : phase.timeline_behavior === "pause" ? <span aria-label={`${phase.title}: Pause hatch`} title="Pause: black-and-white diagonal hatch" className="h-3 w-5 shrink-0 border border-slate-950 bg-white" style={{ backgroundImage: PLANNING_PAUSE_HATCH }} /> : <span aria-label={`${phase.title}: Planning only`} title="Planning only: no Timeline bar" className="h-3 w-5 shrink-0 border border-dashed border-slate-400 bg-slate-50" />}
                      <span className="truncate">{phase.title}</span>
                      {isBlocked && <span title={`Waiting for ${prerequisite!.title}`} className="inline-flex shrink-0 items-center border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">Waiting</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">{[statusLabels[phase.status], timelineBehaviorLabel(phase), dateLabel ?? "Undated", isScheduleStaged ? "Unsaved schedule" : null, phaseItems.length ? `${formatPlanningHours(phaseProgress.completedHours)} / ${formatPlanningHours(phaseProgress.totalHours)} hrs · ${phaseProgress.completedItems} / ${phaseProgress.totalItems} items` : null].filter(Boolean).join(" · ")}</div>
                    {phaseItems.length > 0 && <div className="mt-1 h-1.5 overflow-hidden bg-slate-200"><div className="h-full bg-blue-700" style={{ width: `${phaseProgress.percent}%` }} /></div>}
                    {prerequisite && <div className="mt-0.5 text-[10px] font-semibold text-slate-500"><span>{isBlocked ? "Waiting for" : "Depends on"}: {prerequisite.title}</span></div>}
                    {scheduleIssues.map((issue) => <div key={issue.id} className={`mt-1 flex items-start gap-1 text-[10px] font-semibold ${issue.severity === "error" ? "text-red-700" : "text-orange-700"}`}><AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden="true" /><span>{issue.inspector_message ?? issue.message}</span></div>)}
                  </button>
                  {phase.timeline_behavior !== "pause" && <button type="button" onClick={(event) => openItem(phase.id, null, event.currentTarget)} className="h-8 border border-slate-300 px-2 text-xs font-bold text-slate-700 focus-visible:ring-2 focus-visible:ring-blue-600">Add Item</button>}
                </div>
                {isExpanded && (
                  <div className="border-t border-slate-200 bg-slate-50 px-4 py-2">
                    {phaseItems.length === 0 ? (
                      <div className="py-2 text-xs text-slate-500">No Items yet.</div>
                    ) : (
                      phaseItems.map((item) => (
                        <div key={item.id} className="flex min-h-9 items-center gap-2 border-b border-slate-200 py-1.5 last:border-b-0">
                          <input type="checkbox" checked={item.is_complete} disabled={savingCompletionIds.has(item.id)} aria-label={`Mark ${item.title} ${item.is_complete ? "incomplete" : "complete"}`} onChange={(event) => void toggleItemCompletion(item, event.target.checked)} />
                          <button type="button" onClick={(event) => openItem(phase.id, item, event.currentTarget)} className={`min-w-0 flex-1 text-left text-sm focus-visible:ring-2 focus-visible:ring-blue-600 ${item.is_complete ? "text-slate-500 line-through" : "text-slate-800"}`}><span className="block truncate">{item.title}</span><span className="block text-[10px] text-slate-500 no-underline">{[`${formatPlanningHours(item.estimated_hours)} hrs`, item.owner, item.due_date ? `Due ${item.due_date}` : null].filter(Boolean).join(" · ")}</span></button>
                          {savingCompletionIds.has(item.id) && <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-slate-400">Saving</span>}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {phaseEditor !== undefined && (
        <PlanningPhaseEditor job={job} phase={phaseEditor} phases={phases} items={phaseEditor ? items.filter((item) => item.phase_id === phaseEditor.id) : []} libraryEntry={phaseEditor?.library_phase_id ? library.find((entry) => entry.id === phaseEditor.library_phase_id) : undefined} phaseLimitReached={planningPhaseCount >= MAX_PLANNING_PHASES} onClose={closeEditor} onSave={savePhase} onSaveItem={async (item, input) => { const next = await updatePlanningItem(item.id, input); publishItems(items.map((candidate) => candidate.id === next.id ? next : candidate)); }} onDeleteItem={async (item) => { await deletePlanningItem(item.id); publishItems(items.filter((candidate) => candidate.id !== item.id)); }} onDelete={phaseEditor ? async () => { await deletePlanningPhase(phaseEditor.id); publishPhases(phases.filter((phase) => phase.id !== phaseEditor.id)); publishItems(items.filter((item) => item.phase_id !== phaseEditor.id)); } : undefined} />
      )}
      {itemEditor && (
        <PlanningItemEditor phaseId={itemEditor.phaseId} item={itemEditor.item} sortOrder={items.filter((item) => item.phase_id === itemEditor.phaseId).length} onClose={closeEditor} onSave={saveItem} onDelete={itemEditor.item ? async () => { await deletePlanningItem(itemEditor.item!.id); publishItems(items.filter((item) => item.id !== itemEditor.item!.id)); } : undefined} />
      )}
      {creationTemplate && <PhaseCreationDialog key={creationTemplate.id} entry={creationTemplate} items={libraryItems.filter((item) => item.library_phase_id === creationTemplate.id)} busy={creationBusy} error={creationError} onClose={closePhaseCreation} onCreate={(selectedItemIds) => applyLibraryPhase(creationTemplate, selectedItemIds)} />}
    </div>
  );
}
