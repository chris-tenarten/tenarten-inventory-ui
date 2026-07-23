"use client";

import { useMemo, useState } from "react";
import type {
  PendingReceivalProposalLine,
  PurchaseOrderPendingReceivalProjection,
} from "./types";

const input = "h-9 w-full border border-slate-300 bg-white px-2 text-sm disabled:bg-slate-100 disabled:text-slate-500";
const label = "text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600";

export default function PendingReceivalsReviewDialog({
  initial,
  saving,
  onClose,
  onCreate,
}: {
  initial: PurchaseOrderPendingReceivalProjection;
  saving: boolean;
  onClose(): void;
  onCreate(lines: PendingReceivalProposalLine[]): Promise<void>;
}) {
  const [lines, setLines] = useState(initial.lines);
  const selected = useMemo(
    () => lines.filter(line => line.eligible && !line.alreadyCreated && line.selected),
    [lines],
  );
  const update = (sourceLineId: string, change: Partial<PendingReceivalProposalLine>) =>
    setLines(current => current.map(line => line.sourceLineId === sourceLineId ? { ...line, ...change } : line));
  const invalidSelected = selected.some(line =>
    !line.materialName.trim()
    || !line.unit.trim()
    || !line.location.trim()
    || !Number.isFinite(Number(line.quantityExpected))
    || Number(line.quantityExpected) <= 0,
  );

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="pending-receivals-review-title">
      <div className="mx-auto max-w-[1280px] border border-slate-300 bg-[#eef1f4] shadow-2xl">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-300 bg-white p-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Issued PO {initial.poNumber}</div>
            <h3 id="pending-receivals-review-title" className="text-xl font-bold">Review Pending Receivals</h3>
            <p className="mt-1 text-sm text-slate-600">
              Review the operational receiving rows before creating them. ETA is intentionally blank unless you enter an expected material-arrival date.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="h-9 border border-slate-400 bg-white px-4 text-sm font-bold disabled:opacity-50">Close</button>
        </header>

        <div className="border-b border-slate-300 bg-slate-50 px-4 py-3 text-sm">
          <b>{initial.vendorName}</b>
          {(initial.jobNumber || initial.jobName) && (
            <span className="ml-3 text-slate-600">
              Reserved for {[initial.jobNumber, initial.jobName].filter(Boolean).join(" — ")}
            </span>
          )}
        </div>

        <div className="space-y-3 p-4">
          {lines.map(line => {
            const locked = line.alreadyCreated || !line.eligible;
            return (
              <section key={line.sourceLineId || `line-${line.sourceLineNumber}`} className={`border p-3 ${line.alreadyCreated ? "border-emerald-300 bg-emerald-50/60" : !line.eligible ? "border-slate-300 bg-slate-100" : "border-slate-300 bg-white"}`}>
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Include PO line ${line.sourceLineNumber}`}
                    checked={line.selected && !locked}
                    disabled={locked || saving}
                    onChange={event => update(line.sourceLineId, { selected:event.target.checked })}
                  />
                  <b>Line {line.sourceLineNumber}</b>
                  {line.vendorSku && <span className="text-xs text-slate-500">SKU {line.vendorSku}</span>}
                  {line.alreadyCreated && <span className="border border-emerald-300 bg-white px-2 py-1 text-[10px] font-bold uppercase text-emerald-800">Previously created</span>}
                  {!line.eligible && <span className="text-xs font-bold text-slate-600">Excluded: {line.exclusionReason}</span>}
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <label className={label}>Material
                    <input className={input} value={line.materialName} disabled={locked || saving} onChange={event => update(line.sourceLineId, { materialName:event.target.value })} />
                  </label>
                  <label className={label}>Size
                    <input className={input} value={line.size} disabled={locked || saving} onChange={event => update(line.sourceLineId, { size:event.target.value })} />
                  </label>
                  <label className={label}>Category
                    <input className={input} value={line.category} disabled={locked || saving} onChange={event => update(line.sourceLineId, { category:event.target.value })} />
                  </label>
                  <label className={label}>Quantity
                    <input className={input} type="number" min="0.0001" step="any" value={line.quantityExpected} disabled={locked || saving} onChange={event => update(line.sourceLineId, { quantityExpected:event.target.value })} />
                  </label>
                  <label className={label}>Unit
                    <input className={input} value={line.unit} disabled={locked || saving} onChange={event => update(line.sourceLineId, { unit:event.target.value })} />
                  </label>
                  <label className={label}>ETA
                    <input className={input} type="date" value={line.eta} disabled={locked || saving} onChange={event => update(line.sourceLineId, { eta:event.target.value })} />
                  </label>
                  <label className={`${label} md:col-span-2`}>Location
                    <input className={input} value={line.location} disabled={locked || saving} onChange={event => update(line.sourceLineId, { location:event.target.value })} />
                  </label>
                </div>
              </section>
            );
          })}
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-300 bg-white p-4">
          <div className="text-sm text-slate-600">
            {selected.length} remaining line{selected.length === 1 ? "" : "s"} selected
          </div>
          <button
            type="button"
            disabled={saving || selected.length === 0 || invalidSelected}
            onClick={() => void onCreate(selected)}
            className="h-10 border border-blue-800 bg-blue-700 px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Creating Pending Receivals…" : `Create ${selected.length} Pending Receival${selected.length === 1 ? "" : "s"}`}
          </button>
        </footer>
      </div>
    </div>
  );
}
