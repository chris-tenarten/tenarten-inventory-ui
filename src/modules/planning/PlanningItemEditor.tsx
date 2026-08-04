"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlanningItem, PlanningItemInput } from "./types";

type Props = {
  phaseId: string;
  item: PlanningItem | null;
  sortOrder: number;
  onSave(input: PlanningItemInput): Promise<void>;
  onDelete?(): Promise<void>;
  onClose(): void;
  embedded?: boolean;
  backLabel?: string;
};

const fieldClass = "mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm focus:border-blue-700 focus:ring-2 focus:ring-blue-100";

export default function PlanningItemEditor({ phaseId, item, sortOrder, onSave, onDelete, onClose, embedded = false, backLabel }: Props) {
  const initialDraft = useMemo(
    () => ({
      title: item?.title ?? "",
      notes: item?.notes ?? "",
      owner: item?.owner ?? "",
      dueDate: item?.due_date ?? "",
      complete: item?.is_complete ?? false,
      estimatedHours: String(item?.estimated_hours ?? 1),
      createdBy: item?.created_by ?? "",
    }),
    [item],
  );
  const [draft, setDraft] = useState(initialDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft);

  const requestClose = useCallback(() => {
    if (dirty && !window.confirm("Discard unsaved Item changes?")) return;
    onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    requestAnimationFrame(() => titleRef.current?.focus());
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button,input,textarea")].filter(
        (element) => !element.hasAttribute("disabled"),
      );
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {
        event.preventDefault();
        focusable[0]?.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [requestClose]);

  async function save() {
    if (!draft.title.trim()) {
      setError("Item title is required.");
      return;
    }
    if (draft.owner.trim().length > 200 || draft.createdBy.trim().length > 200) {
      setError("Owner and creator names must be 200 characters or fewer.");
      return;
    }
    const estimatedHours = Number(draft.estimatedHours);
    if (!Number.isFinite(estimatedHours) || estimatedHours <= 0) {
      setError("Estimated hours must be greater than zero.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave({
        phase_id: phaseId,
        title: draft.title.trim(),
        notes: draft.notes.trim(),
        owner: draft.owner.trim() || null,
        is_complete: draft.complete,
        estimated_hours: estimatedHours,
        due_date: draft.dueDate || null,
        sort_order: item?.sort_order ?? sortOrder,
        created_by: draft.createdBy.trim() || null,
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save Item.");
    } finally {
      setBusy(false);
    }
  }

  const editor = (
      <div ref={dialogRef} role={embedded ? undefined : "dialog"} aria-modal={embedded ? undefined : "true"} aria-labelledby="planning-item-title" className={embedded ? "w-full" : "w-full max-w-lg border border-slate-400 bg-white p-5 shadow-2xl"}>
        <div className="flex items-start justify-between gap-3">
          <h2 id="planning-item-title" className="text-lg font-bold">{item ? "Edit Item" : "Add Item"}</h2>
          <button type="button" onClick={requestClose} className="h-9 border border-slate-300 px-3 text-sm font-bold">{embedded && backLabel ? `← Back to ${backLabel}` : "Close"}</button>
        </div>
        {error && <div role="alert" className="mt-3 border border-red-300 bg-red-50 p-2 text-sm font-semibold text-red-800">{error}</div>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold sm:col-span-2">Title<input ref={titleRef} value={draft.title} maxLength={200} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} className={fieldClass} /></label>
          <label className="text-xs font-bold">Owner <span className="font-normal text-slate-500">(optional)</span><input value={draft.owner} maxLength={200} onChange={(event) => setDraft((value) => ({ ...value, owner: event.target.value }))} className={fieldClass} /></label>
          <label className="text-xs font-bold">Due date <span className="font-normal text-slate-500">(optional)</span><input type="date" value={draft.dueDate} onChange={(event) => setDraft((value) => ({ ...value, dueDate: event.target.value }))} className={fieldClass} /></label>
          <label className="text-xs font-bold">Estimated hours<input type="number" min="0.01" step="any" value={draft.estimatedHours} onChange={(event) => setDraft((value) => ({ ...value, estimatedHours: event.target.value }))} className={fieldClass} /></label>
          <label className="text-xs font-bold sm:col-span-2">Notes <span className="font-normal text-slate-500">(optional)</span><textarea value={draft.notes} maxLength={12000} rows={3} onChange={(event) => setDraft((value) => ({ ...value, notes: event.target.value }))} className="mt-1 w-full border border-slate-300 p-2 text-sm" /></label>
          <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2"><input type="checkbox" checked={draft.complete} onChange={(event) => setDraft((value) => ({ ...value, complete: event.target.checked }))} />Complete</label>
        </div>
        <div className="mt-5 flex justify-between gap-3">
          {onDelete ? <button type="button" disabled={busy} onClick={async () => { if (!window.confirm("Delete this Item?")) return; setBusy(true); try { await onDelete(); onClose(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to delete Item."); setBusy(false); } }} className="h-10 border border-red-300 px-4 text-sm font-bold text-red-700">Delete</button> : <span />}
          <div className="flex gap-2"><button type="button" onClick={requestClose} className="h-10 border border-slate-300 px-4 text-sm font-bold">Cancel</button><button type="button" disabled={busy} onClick={() => void save()} className="h-10 bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Save Item"}</button></div>
        </div>
      </div>
  );
  return embedded ? editor : <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && requestClose()}>{editor}</div>;
}
