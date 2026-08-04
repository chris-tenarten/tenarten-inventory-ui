"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProductionJob } from "@/modules/production/types";
import { planningStatuses, statusLabels, timelineBehaviors } from "./types";
import type { PlanningItem, PlanningItemInput, PlanningPhase, PlanningPhaseInput, PlanningStatus, TimelineBehavior } from "./types";
import { overlayVisualForPhase, PLANNING_PAUSE_HATCH } from "./phase-visuals";
import type { PhaseLibraryEntry } from "./types";
import { calculatePhaseProgress, formatPlanningHours } from "./progress.mjs";
import PlanningItemEditor from "./PlanningItemEditor";

type Props = {
  job: ProductionJob;
  phase: PlanningPhase | null;
  phases: PlanningPhase[];
  libraryEntry?: PhaseLibraryEntry;
  phaseLimitReached: boolean;
  onSave(input: PlanningPhaseInput): Promise<void>;
  onDelete?(): Promise<void>;
  onClose(): void;
  items?: PlanningItem[];
  onSaveItem?(item: PlanningItem, input: PlanningItemInput): Promise<void>;
  onDeleteItem?(item: PlanningItem): Promise<void>;
};

const fieldClass = "mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm focus:border-blue-700 focus:ring-2 focus:ring-blue-100";

export default function PlanningPhaseEditor({ job, phase, phases, libraryEntry, phaseLimitReached, onSave, onDelete, onClose, items = [], onSaveItem, onDeleteItem }: Props) {
  const initialDraft = useMemo(
    () => ({
      title: phase?.title ?? "",
      description: phase?.description ?? "",
      owner: phase?.owner ?? "",
      status: (phase?.status ?? "open") as PlanningStatus,
      start: phase?.start_date ?? "",
      end: phase?.end_date ?? "",
      timeline: (phase?.timeline_behavior ?? (phaseLimitReached ? "pause" : "planning_only")) as TimelineBehavior,
      blockedBy: phase?.blocked_by_phase_id ?? "",
      createdBy: phase?.created_by ?? "",
    }),
    [phase, phaseLimitReached],
  );
  const [draft, setDraft] = useState(initialDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState<PlanningItem | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft);
  const progress = useMemo(() => calculatePhaseProgress(items), [items]);

  const requestClose = useCallback(() => {
    if (dirty && !window.confirm("Discard unsaved Phase changes?")) return;
    onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    requestAnimationFrame(() => titleRef.current?.focus());
    const handleKey = (event: KeyboardEvent) => {
      if (selectedItem) return;
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button,input,select,textarea")].filter((element) => !element.hasAttribute("disabled"));
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0]?.focus(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [requestClose, selectedItem]);

  async function save() {
    if (!draft.title.trim()) { setError("Phase title is required."); return; }
    if (draft.owner.trim().length > 200 || draft.createdBy.trim().length > 200) { setError("Owner and creator names must be 200 characters or fewer."); return; }
    if (draft.timeline !== "planning_only" && (!draft.start || !draft.end)) { setError("Overlay and Pause Phases require start and end dates."); return; }
    if (draft.start && draft.end && draft.end < draft.start) { setError("End date must be on or after start date."); return; }
    setBusy(true);
    setError("");
    try {
      await onSave({
        job_id: job.id,
        title: draft.title.trim(),
        description: draft.description.trim(),
        owner: draft.owner.trim() || null,
        category: phase?.category ?? "internal",
        status: draft.status,
        start_date: draft.start || null,
        end_date: draft.end || null,
        timeline_behavior: draft.timeline,
        include_in_planning_progress: draft.timeline !== "pause",
        timeline_color: draft.timeline === "overlay" ? (phase?.timeline_color ?? null) : null,
        library_phase_id: phase?.library_phase_id ?? null,
        blocked_by_phase_id: draft.blockedBy || null,
        created_by: draft.createdBy.trim() || null,
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save Phase.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => event.target === event.currentTarget && requestClose()}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={selectedItem ? "planning-item-title" : "planning-phase-title"} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-slate-400 bg-white p-5 shadow-2xl">
        {selectedItem && phase && onSaveItem ? <PlanningItemEditor embedded backLabel={phase.title} phaseId={phase.id} item={selectedItem} sortOrder={selectedItem.sort_order} onClose={() => setSelectedItem(null)} onSave={(input) => onSaveItem(selectedItem, input)} onDelete={onDeleteItem ? () => onDeleteItem(selectedItem) : undefined} /> : <>
        <div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">{job.job_number || "Production job"} · {job.name}</div><h2 id="planning-phase-title" className="mt-1 text-xl font-bold">{phase ? "Edit Phase" : "Add Phase"}</h2></div><button type="button" onClick={requestClose} className="h-9 border border-slate-300 px-3 font-bold">Close</button></div>
        {error && <div role="alert" className="mt-4 border border-red-300 bg-red-50 p-2 text-sm font-semibold text-red-800">{error}</div>}
        {phase && draft.timeline !== "pause" && <div className="mt-4 border border-slate-300 bg-slate-50 p-3">
          <div className="flex items-end justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Execution Progress</div><div className="mt-1 text-2xl font-bold text-slate-950">{progress.percent}%</div></div><div className="text-right text-xs text-slate-600"><div>{formatPlanningHours(progress.completedHours)} / {formatPlanningHours(progress.totalHours)} planned hrs</div><div className="mt-1">{progress.completedItems} / {progress.totalItems} Items complete</div></div></div>
          <div className="mt-2 h-2 overflow-hidden bg-slate-200"><div className="h-full bg-blue-700" style={{ width: `${progress.percent}%` }} /></div>
        </div>}
        {phase && draft.timeline !== "pause" && <section className="mt-4" aria-labelledby="phase-item-overview-title">
          <h3 id="phase-item-overview-title" className="text-xs font-bold uppercase tracking-[0.1em] text-slate-700">Item Overview</h3>
          <div className="mt-2 max-h-52 overflow-y-auto border border-slate-300 bg-white">
            {items.length === 0 ? <p className="p-3 text-sm text-slate-500">No Items in this Phase.</p> : items.map((item) => <button key={item.id} type="button" onClick={() => setSelectedItem(item)} className="flex min-h-10 w-full items-center gap-2 border-b border-slate-200 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"><span className={`min-w-0 flex-1 truncate text-sm ${item.is_complete ? "text-slate-500 line-through" : "text-slate-800"}`}>{item.title}</span><span className="shrink-0 tabular-nums text-xs font-semibold text-slate-600">{formatPlanningHours(item.estimated_hours)} hrs</span></button>)}
          </div>
        </section>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold sm:col-span-2">Title<input ref={titleRef} value={draft.title} maxLength={200} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} className={fieldClass} /></label>
          <label className="text-xs font-bold sm:col-span-2">Description<textarea value={draft.description} maxLength={12000} rows={4} onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} className="mt-1 w-full border border-slate-300 p-2 text-sm" /></label>
          <label className="text-xs font-bold">Owner <span className="font-normal text-slate-500">(optional)</span><input value={draft.owner} maxLength={200} onChange={(event) => setDraft((value) => ({ ...value, owner: event.target.value }))} className={fieldClass} /></label>
          <label className="text-xs font-bold">Status<select value={draft.status} onChange={(event) => setDraft((value) => ({ ...value, status: event.target.value as PlanningStatus }))} className={fieldClass}>{planningStatuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label>
          <label className="text-xs font-bold">Timeline behavior<select value={draft.timeline} onChange={(event) => setDraft((value) => ({ ...value, timeline: event.target.value as TimelineBehavior }))} className={fieldClass}>{timelineBehaviors.map((value) => <option key={value} value={value} disabled={!phase && phaseLimitReached && value !== "pause"}>{value === "overlay" ? "Overlay" : value === "pause" ? "Pause" : "Planning only"}</option>)}</select>{!phase && phaseLimitReached && <span className="mt-1 block text-[10px] font-normal text-slate-500">Only Pause intervals can be added while four Planning Phases exist.</span>}</label>
          <label className="text-xs font-bold">Start date <span className="font-normal text-slate-500">(optional)</span><input type="date" value={draft.start} onChange={(event) => setDraft((value) => ({ ...value, start: event.target.value }))} className={fieldClass} /></label>
          <label className="text-xs font-bold">End date <span className="font-normal text-slate-500">(optional)</span><input type="date" min={draft.start || undefined} value={draft.end} onChange={(event) => setDraft((value) => ({ ...value, end: event.target.value }))} className={fieldClass} /></label>
          <label className="text-xs font-bold">Depends on <span className="font-normal text-slate-500">(optional)</span><select value={draft.blockedBy} onChange={(event) => setDraft((value) => ({ ...value, blockedBy: event.target.value }))} className={fieldClass}><option value="">None</option>{phases.filter((item) => item.id !== phase?.id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          <div className="border border-slate-300 bg-slate-50 p-3 sm:col-span-2"><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Timeline appearance</div>{draft.timeline === "overlay" ? <div className="mt-2 flex items-center gap-3"><span className={`h-5 w-10 shrink-0 border ${overlayVisualForPhase(phases, phase?.id).swatchClassName}`} aria-hidden="true" /><div><div className="text-sm font-bold text-slate-900">{draft.title.trim() || "Ad-hoc Phase"}</div><div className="text-sm font-semibold text-slate-700">{overlayVisualForPhase(phases, phase?.id).name}</div><div className="text-[10px] text-slate-500">{libraryEntry ? "Inherited from Phase Library" : "Automatically assigned for an ad-hoc Phase"}</div></div></div> : draft.timeline === "pause" ? <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-800"><span className="h-4 w-8 border border-slate-950 bg-white" style={{ backgroundImage: PLANNING_PAUSE_HATCH }} aria-hidden="true" />Pause · Black/white hatch</div> : <div className="mt-2"><div className="text-sm font-bold text-slate-900">{draft.title.trim() || "Planning Phase"}</div><div className="text-sm font-semibold text-slate-600">Not shown on Timeline</div></div>}</div>
        </div>
        <div className="mt-5 flex justify-between gap-3">{onDelete ? <button type="button" disabled={busy} onClick={async () => { if (!window.confirm("Delete this Phase and its Items?")) return; setBusy(true); try { await onDelete(); onClose(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to delete Phase."); setBusy(false); } }} className="h-10 border border-red-300 px-4 text-sm font-bold text-red-700">Delete</button> : <span />}<div className="flex gap-2"><button type="button" onClick={requestClose} className="h-10 border border-slate-300 px-4 text-sm font-bold">Cancel</button><button type="button" disabled={busy} onClick={() => void save()} className="h-10 bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Save Phase"}</button></div></div>
        </>}
      </div>
    </div>
  );
}
