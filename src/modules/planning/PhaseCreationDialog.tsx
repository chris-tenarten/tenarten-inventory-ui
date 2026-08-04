"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PhaseLibraryEntry, PhaseLibraryItem } from "./types";
import { formatPlanningHours } from "./progress.mjs";

type Props = {
  entry: PhaseLibraryEntry;
  items: PhaseLibraryItem[];
  busy: boolean;
  error: string;
  onCreate(selectedItemIds: string[]): Promise<void>;
  onClose(): void;
};

function timelineBehaviorLabel(entry: PhaseLibraryEntry) {
  if (entry.default_timeline_behavior === "planning_only") return "Planning only";
  return entry.default_timeline_behavior === "pause" ? "Pause" : "Overlay";
}

export default function PhaseCreationDialog({ entry, items, busy, error, onCreate, onClose }: Props) {
  const orderedItems = useMemo(() => [...items].sort((left, right) => left.sort_order - right.sort_order || left.title.localeCompare(right.title)), [items]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(() => new Set(orderedItems.map((item) => item.id)));
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const selectedItems = orderedItems.filter((item) => selectedItemIds.has(item.id));
  const estimatedHours = selectedItems.reduce((total, item) => total + item.estimated_hours, 0);
  const requiresItems = entry.default_timeline_behavior === "overlay";
  const selectionInvalid = requiresItems && selectedItems.length === 0;

  useEffect(() => {
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);

  function toggleItem(itemId: string) {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="phase-creation-title" className="flex max-h-[88vh] w-full max-w-lg flex-col border border-slate-400 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Planning · Phase Library</div><h2 id="phase-creation-title" className="mt-1 text-lg font-bold text-slate-950">Create {entry.name}</h2></div>
          <button ref={closeRef} type="button" disabled={busy} onClick={onClose} className="h-8 border border-slate-300 px-3 text-xs font-bold hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50">Close</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {error && <div role="alert" className="mb-3 border border-red-300 bg-red-50 p-2 text-sm font-semibold text-red-800">{error}</div>}
          <section aria-labelledby="phase-template-summary">
            <h3 id="phase-template-summary" className="text-xs font-bold uppercase tracking-[0.1em] text-slate-700">Template</h3>
            <dl className="mt-2 grid gap-x-4 gap-y-2 border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-2">
              <div><dt className="font-bold text-slate-600">Template name</dt><dd className="mt-0.5 text-slate-800">{entry.name}</dd></div>
              <div className="sm:col-span-2"><dt className="font-bold text-slate-600">Description</dt><dd className="mt-0.5 text-slate-800">{entry.default_description || "No description"}</dd></div>
              <div><dt className="font-bold text-slate-600">Timeline behavior</dt><dd className="mt-0.5 text-slate-800">{timelineBehaviorLabel(entry)}</dd></div>
              {entry.suggested_owner && <div><dt className="font-bold text-slate-600">Suggested owner</dt><dd className="mt-0.5 text-slate-800">{entry.suggested_owner}</dd></div>}
            </dl>
          </section>

          <section aria-labelledby="phase-template-items" className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="phase-template-items" className="text-xs font-bold uppercase tracking-[0.1em] text-slate-700">Items</h3>
              {orderedItems.length > 0 && <div className="flex gap-2"><button type="button" onClick={() => setSelectedItemIds(new Set(orderedItems.map((item) => item.id)))} className="text-xs font-bold text-blue-800 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-blue-600">Select All</button><button type="button" onClick={() => setSelectedItemIds(new Set())} className="text-xs font-bold text-slate-600 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-blue-600">Deselect All</button></div>}
            </div>
            <div className="mt-2 max-h-56 overflow-y-auto border border-slate-300">
              {orderedItems.length === 0 ? <p className="p-3 text-sm text-slate-500">{entry.default_timeline_behavior === "pause" ? "Pause templates intentionally contain no Items." : "This template contains no Items."}</p> : orderedItems.map((item) => <label key={item.id} className="flex min-h-10 cursor-pointer items-center gap-2 border-b border-slate-200 px-3 py-2 last:border-b-0 hover:bg-slate-50"><input type="checkbox" checked={selectedItemIds.has(item.id)} onChange={() => toggleItem(item.id)} className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 text-sm text-slate-800">{item.title}</span><span className="shrink-0 tabular-nums text-xs font-semibold text-slate-600">{formatPlanningHours(item.estimated_hours)} hrs</span></label>)}
            </div>
          </section>

          <section aria-label="Selected template totals" className="mt-4 grid grid-cols-2 gap-2 border border-slate-200 bg-slate-50 p-3">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Estimated Hours</div><div className="mt-1 text-lg font-bold tabular-nums text-slate-950">{formatPlanningHours(estimatedHours)} hrs</div></div>
            <div><div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Item Count</div><div className="mt-1 text-lg font-bold tabular-nums text-slate-950">{selectedItems.length} Item{selectedItems.length === 1 ? "" : "s"}</div></div>
          </section>
          {selectionInvalid && <p className="mt-3 text-sm font-semibold text-amber-800">Select at least one Item to create this Phase.</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button type="button" disabled={busy} onClick={onClose} className="h-9 border border-slate-300 px-4 text-sm font-bold disabled:opacity-50">Cancel</button>
          <button type="button" disabled={busy || selectionInvalid} onClick={() => void onCreate([...selectedItemIds])} className="h-9 bg-slate-900 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Creating…" : "Create Phase"}</button>
        </div>
      </div>
    </div>
  );
}
