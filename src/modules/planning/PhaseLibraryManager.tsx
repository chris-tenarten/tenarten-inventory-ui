"use client";

import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { openProductionJob } from "@/modules/production/job-options";
import { overlayVisualForColor, PLANNING_OVERLAY_PALETTE, PLANNING_PAUSE_HATCH } from "./phase-visuals";
import {
  createPhaseLibraryEntry,
  createPhaseLibraryItem,
  deletePhaseLibraryEntry,
  deletePhaseLibraryItem,
  loadPhaseLibrary,
  updatePhaseLibraryEntry,
  updatePhaseLibraryItem,
} from "./data";
import { timelineBehaviors } from "./types";
import type {
  PhaseLibraryEntry,
  PhaseLibraryEntryInput,
  PhaseLibraryItem,
  PhaseLibraryItemInput,
  TimelineBehavior,
  PlanningTimelineColor,
} from "./types";

const fieldClass = "mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm";

function blankEntry(sortOrder: number): PhaseLibraryEntryInput {
  return {
    name: "",
    default_description: "",
    default_category: "internal",
    suggested_owner: null,
    suggested_duration_days: null,
    default_timeline_behavior: "planning_only",
    default_include_in_planning_progress: false,
    default_timeline_color: "steel_blue",
    active: true,
    sort_order: sortOrder,
    created_by: null,
  };
}

function blankItem(libraryPhaseId: string, sortOrder: number): PhaseLibraryItemInput {
  return {
    library_phase_id: libraryPhaseId,
    title: "",
    notes: "",
    suggested_owner: null,
    estimated_hours: 1,
    suggested_due_offset_days: null,
    sort_order: sortOrder,
  };
}

export default function PhaseLibraryManager() {
  const [entries, setEntries] = useState<PhaseLibraryEntry[]>([]);
  const [items, setItems] = useState<PhaseLibraryItem[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingEntry, setEditingEntry] = useState<PhaseLibraryEntry | null | undefined>();
  const [entryDraft, setEntryDraft] = useState<PhaseLibraryEntryInput>(() => blankEntry(0));
  const [editingItem, setEditingItem] = useState<PhaseLibraryItem | null | undefined>();
  const [itemDraft, setItemDraft] = useState<PhaseLibraryItemInput>(() => blankItem("", 0));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [returnContext, setReturnContext] = useState<{ jobId: string; jobName: string } | null>(null);

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const jobId = parameters.get("returnJobId");
    const jobName = parameters.get("returnJobName");
    if (jobId && jobName) setReturnContext({ jobId, jobName });
    loadPhaseLibrary()
      .then((data) => {
        setEntries(data.entries);
        setItems(data.items);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load Phase Library."))
      .finally(() => setLoading(false));
  }, []);

  const orderedEntries = useMemo(
    () => [...entries].sort((first, second) => first.sort_order - second.sort_order || first.name.localeCompare(second.name)),
    [entries],
  );

  function editEntry(entry: PhaseLibraryEntry | null) {
    setEditingEntry(entry);
    setEntryDraft(entry ? {
      name: entry.name,
      default_description: entry.default_description,
      default_category: entry.default_category,
      suggested_owner: entry.suggested_owner,
      suggested_duration_days: entry.suggested_duration_days,
      default_timeline_behavior: entry.default_timeline_behavior,
      default_include_in_planning_progress: entry.default_include_in_planning_progress,
      default_timeline_color: entry.default_timeline_color,
      active: entry.active,
      sort_order: entry.sort_order,
      created_by: entry.created_by,
    } : blankEntry(entries.length));
  }

  function editItem(libraryPhaseId: string, item: PhaseLibraryItem | null) {
    setEditingItem(item);
    setItemDraft(item ? {
      library_phase_id: item.library_phase_id,
      title: item.title,
      notes: item.notes,
      suggested_owner: item.suggested_owner,
      estimated_hours: item.estimated_hours,
      suggested_due_offset_days: item.suggested_due_offset_days,
      sort_order: item.sort_order,
    } : blankItem(libraryPhaseId, items.filter((candidate) => candidate.library_phase_id === libraryPhaseId).length));
  }

  async function saveEntry() {
    if (!entryDraft.name.trim()) { setError("Phase Library name is required."); return; }
    if (entryDraft.suggested_duration_days !== null && entryDraft.suggested_duration_days < 1) { setError("Suggested duration must be at least one day."); return; }
    setBusy(true); setError("");
    try {
      const input = {
        ...entryDraft,
        name: entryDraft.name.trim(),
        default_description: entryDraft.default_description.trim(),
        default_category: editingEntry?.default_category ?? "internal",
        default_include_in_planning_progress: entryDraft.default_timeline_behavior !== "pause",
        suggested_owner: entryDraft.suggested_owner?.trim() || null,
      };
      if (editingEntry) {
        const next = await updatePhaseLibraryEntry(editingEntry.id, input);
        setEntries((current) => current.map((entry) => entry.id === next.id ? next : entry));
      } else {
        const next = await createPhaseLibraryEntry(input);
        setEntries((current) => [...current, next]);
        setExpanded((current) => new Set(current).add(next.id));
        editItem(next.id, null);
      }
      setEditingEntry(undefined);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save Phase Library definition."); }
    finally { setBusy(false); }
  }

  async function saveItem() {
    if (!itemDraft.title.trim()) { setError("Item title is required."); return; }
    if (!Number.isFinite(itemDraft.estimated_hours) || itemDraft.estimated_hours <= 0) { setError("Estimated hours must be greater than zero."); return; }
    setBusy(true); setError("");
    try {
      const input = { ...itemDraft, title: itemDraft.title.trim(), notes: itemDraft.notes.trim(), suggested_owner: itemDraft.suggested_owner?.trim() || null };
      if (editingItem) {
        const next = await updatePhaseLibraryItem(editingItem.id, input);
        setItems((current) => current.map((item) => item.id === next.id ? next : item));
      } else {
        const next = await createPhaseLibraryItem(input);
        setItems((current) => [...current, next]);
      }
      setEditingItem(undefined);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save reusable Item."); }
    finally { setBusy(false); }
  }

  return (
    <section id="phase-library" className="mt-6 scroll-mt-4 border border-slate-300 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Planning configuration</div><h2 className="mt-1 text-lg font-bold text-slate-950">Phase Library</h2><p className="mt-1 text-sm text-slate-600">Create reusable Phase and Item definitions. Nothing is added to a Production job automatically.</p></div>
        <div className="flex flex-wrap gap-2">{returnContext && <button type="button" onClick={() => openProductionJob(returnContext.jobId, "planning")} className="h-9 border border-slate-400 bg-white px-3 text-xs font-bold text-slate-700 focus-visible:ring-2 focus-visible:ring-blue-600">Back to {returnContext.jobName}</button>}<button type="button" onClick={() => editEntry(null)} className="inline-flex h-9 items-center gap-1.5 bg-slate-900 px-3 text-xs font-bold text-white"><Plus className="h-4 w-4" />Add definition</button></div>
      </div>
      {error && <div role="alert" className="mt-3 border border-red-300 bg-red-50 p-2 text-sm font-semibold text-red-800">{error}</div>}
      {loading ? <p className="mt-4 text-sm text-slate-500">Loading Phase Library…</p> : orderedEntries.length === 0 ? <div className="mt-4 border border-dashed border-slate-300 p-4 text-sm text-slate-500">The Phase Library is empty.</div> : (
        <div className="mt-4 space-y-2">{orderedEntries.map((entry) => { const entryItems = items.filter((item) => item.library_phase_id === entry.id).sort((a, b) => a.sort_order - b.sort_order); const isExpanded = expanded.has(entry.id); return (
          <div key={entry.id} className="border border-slate-300">
            <div className="flex items-center gap-2 p-3"><button type="button" aria-expanded={isExpanded} aria-label={`${isExpanded ? "Collapse" : "Expand"} ${entry.name}`} onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(entry.id)) next.delete(entry.id); else next.add(entry.id); return next; })} className="inline-flex h-8 w-8 items-center justify-center">{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button><button type="button" onClick={() => editEntry(entry)} className="min-w-0 flex-1 text-left"><span className="inline-flex items-center gap-2 font-bold text-slate-950">{entry.default_timeline_behavior === "overlay" && <span className={`h-3 w-5 border ${overlayVisualForColor(entry.default_timeline_color).swatchClassName}`} aria-hidden="true" />}{entry.default_timeline_behavior === "pause" && <span className="h-3 w-5 border border-slate-950 bg-white" style={{backgroundImage:PLANNING_PAUSE_HATCH}} aria-hidden="true" />}{entry.name}</span><span className="ml-2 text-xs text-slate-500">{entry.active ? "Active" : "Inactive"} · {entryItems.length} Item{entryItems.length === 1 ? "" : "s"}</span></button>{entry.default_timeline_behavior !== "pause" && <button type="button" onClick={() => editItem(entry.id, null)} className="h-8 border border-slate-300 px-2 text-xs font-bold">Add Item</button>}</div>
            {isExpanded && <div className="border-t border-slate-200 bg-slate-50 p-3"><dl className="grid gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-2"><div><dt className="font-bold">Timeline</dt><dd>{entry.default_timeline_behavior === "planning_only" ? "Planning only" : entry.default_timeline_behavior === "pause" ? "Pause" : `Overlay · ${overlayVisualForColor(entry.default_timeline_color).name}`}</dd></div><div><dt className="font-bold">Suggested owner</dt><dd>{entry.suggested_owner || "None"}</dd></div><div><dt className="font-bold">Suggested duration</dt><dd>{entry.suggested_duration_days ? `${entry.suggested_duration_days} days` : "None"}</dd></div></dl><div className="mt-3 space-y-1">{entryItems.length ? entryItems.map((item) => <button key={item.id} type="button" onClick={() => editItem(entry.id, item)} className="block w-full border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-slate-400"><span className="font-semibold">{item.title}</span>{(item.suggested_owner || item.suggested_due_offset_days !== null) && <span className="ml-2 text-xs text-slate-500">{[item.suggested_owner, item.suggested_due_offset_days !== null ? `Due offset ${item.suggested_due_offset_days} days` : null].filter(Boolean).join(" · ")}</span>}</button>) : entry.default_timeline_behavior === "pause" ? <p className="text-xs text-slate-500">Pause definitions do not create reusable Items.</p> : <p className="text-xs text-slate-500">No reusable Items.</p>}</div></div>}
          </div>
        ); })}</div>
      )}

      {editingEntry !== undefined && <div className="mt-4 border border-blue-300 bg-blue-50/30 p-4"><h3 className="font-bold">{editingEntry ? "Edit definition" : "Add definition"}</h3>{!editingEntry && <p className="mt-1 text-xs text-slate-600">Save the Phase definition before adding reusable Items.</p>}<div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Name<input value={entryDraft.name} maxLength={200} onChange={(event) => setEntryDraft((value) => ({ ...value, name: event.target.value }))} className={fieldClass} /></label><label className="text-xs font-bold">Suggested owner <span className="font-normal text-slate-500">(optional)</span><input value={entryDraft.suggested_owner ?? ""} maxLength={200} onChange={(event) => setEntryDraft((value) => ({ ...value, suggested_owner: event.target.value || null }))} className={fieldClass} /></label><label className="text-xs font-bold sm:col-span-2">Default description<textarea value={entryDraft.default_description} maxLength={12000} rows={3} onChange={(event) => setEntryDraft((value) => ({ ...value, default_description: event.target.value }))} className="mt-1 w-full border border-slate-300 p-2 text-sm" /></label><label className="text-xs font-bold">Suggested duration <span className="font-normal text-slate-500">(days)</span><input type="number" min="1" value={entryDraft.suggested_duration_days ?? ""} onChange={(event) => setEntryDraft((value) => ({ ...value, suggested_duration_days: event.target.value ? Number(event.target.value) : null }))} className={fieldClass} /></label><label className="text-xs font-bold">Default Timeline behavior<select value={entryDraft.default_timeline_behavior} onChange={(event) => setEntryDraft((value) => ({ ...value, default_timeline_behavior: event.target.value as TimelineBehavior }))} className={fieldClass}>{timelineBehaviors.map((behavior) => <option key={behavior} value={behavior}>{behavior === "planning_only" ? "Planning only" : behavior === "pause" ? "Pause" : "Overlay"}</option>)}</select></label>{entryDraft.default_timeline_behavior === "overlay" && <label className="text-xs font-bold">Default Timeline Color<div className="mt-1 flex items-center gap-2"><span className={`h-9 w-12 shrink-0 border ${overlayVisualForColor(entryDraft.default_timeline_color).swatchClassName}`} aria-hidden="true" /><select value={entryDraft.default_timeline_color} onChange={(event) => setEntryDraft((value) => ({...value,default_timeline_color:event.target.value as PlanningTimelineColor}))} className="h-9 min-w-0 flex-1 border border-slate-300 bg-white px-2 text-sm">{PLANNING_OVERLAY_PALETTE.map((visual)=><option key={visual.key} value={visual.key}>{visual.name}</option>)}</select></div></label>}<label className="text-xs font-bold">Sort order<input type="number" min="0" value={entryDraft.sort_order} onChange={(event) => setEntryDraft((value) => ({ ...value, sort_order: Number(event.target.value) }))} className={fieldClass} /></label><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={entryDraft.active} onChange={(event) => setEntryDraft((value) => ({ ...value, active: event.target.checked }))} />Active</label></div><div className="mt-4 flex justify-between"><div>{editingEntry && <button type="button" disabled={busy} onClick={async () => { if (!window.confirm(`Delete ${editingEntry.name} from the Phase Library?`)) return; setBusy(true); try { await deletePhaseLibraryEntry(editingEntry.id); setEntries((current) => current.filter((entry) => entry.id !== editingEntry.id)); setItems((current) => current.filter((item) => item.library_phase_id !== editingEntry.id)); setEditingEntry(undefined); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to delete definition."); } finally { setBusy(false); } }} className="h-9 border border-red-300 px-3 text-xs font-bold text-red-700">Delete</button>}</div><div className="flex gap-2"><button type="button" onClick={() => setEditingEntry(undefined)} className="h-9 border border-slate-300 px-3 text-xs font-bold">Cancel</button><button type="button" disabled={busy} onClick={() => void saveEntry()} className="h-9 bg-slate-900 px-3 text-xs font-bold text-white">Save definition</button></div></div></div>}

      {editingItem !== undefined && <div className="mt-4 border border-blue-300 bg-blue-50/30 p-4"><h3 className="font-bold">{editingItem ? "Edit reusable Item" : "Add reusable Item"}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold sm:col-span-2">Title<input value={itemDraft.title} maxLength={200} onChange={(event) => setItemDraft((value) => ({ ...value, title: event.target.value }))} className={fieldClass} /></label><label className="text-xs font-bold">Suggested owner <span className="font-normal text-slate-500">(optional)</span><input value={itemDraft.suggested_owner ?? ""} maxLength={200} onChange={(event) => setItemDraft((value) => ({ ...value, suggested_owner: event.target.value || null }))} className={fieldClass} /></label><label className="text-xs font-bold">Estimated hours<input type="number" min="0.01" step="any" value={itemDraft.estimated_hours} onChange={(event) => setItemDraft((value) => ({ ...value, estimated_hours: Number(event.target.value) }))} className={fieldClass} /></label><label className="text-xs font-bold">Suggested due offset <span className="font-normal text-slate-500">(days)</span><input type="number" min="0" value={itemDraft.suggested_due_offset_days ?? ""} onChange={(event) => setItemDraft((value) => ({ ...value, suggested_due_offset_days: event.target.value ? Number(event.target.value) : null }))} className={fieldClass} /></label><label className="text-xs font-bold sm:col-span-2">Notes<textarea value={itemDraft.notes} maxLength={12000} rows={3} onChange={(event) => setItemDraft((value) => ({ ...value, notes: event.target.value }))} className="mt-1 w-full border border-slate-300 p-2 text-sm" /></label></div><div className="mt-4 flex justify-between"><div>{editingItem && <button type="button" disabled={busy} onClick={async () => { if (!window.confirm("Delete this reusable Item?")) return; setBusy(true); try { await deletePhaseLibraryItem(editingItem.id); setItems((current) => current.filter((item) => item.id !== editingItem.id)); setEditingItem(undefined); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to delete reusable Item."); } finally { setBusy(false); } }} className="h-9 border border-red-300 px-3 text-xs font-bold text-red-700">Delete</button>}</div><div className="flex gap-2"><button type="button" onClick={() => setEditingItem(undefined)} className="h-9 border border-slate-300 px-3 text-xs font-bold">Cancel</button><button type="button" disabled={busy} onClick={() => void saveItem()} className="h-9 bg-slate-900 px-3 text-xs font-bold text-white">Save Item</button></div></div></div>}
    </section>
  );
}
