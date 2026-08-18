"use client";

import { useState } from "react";
import { createProductionRework } from "../jobs";
import type { ProductionJob, ProductionReworkCycle, ReworkReasonCategory } from "../types";

const reasons: Array<{ value: ReworkReasonCategory; label: string }> = [
  { value: "quality_qc", label: "Quality / QC" },
  { value: "shipping_handling", label: "Shipping / Handling Damage" },
  { value: "customer_change", label: "Customer Change" },
  { value: "other", label: "Other" },
];

export default function CreateReworkDialog({ job, onClose, onCreated }: { job: ProductionJob; onClose(): void; onCreated(cycle: ProductionReworkCycle): void }) {
  const [reason, setReason] = useState<ReworkReasonCategory>("quality_qc");
  const [scope, setScope] = useState("");
  const [intakeDate, setIntakeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!scope.trim() || !intakeDate || saving) return;
    setSaving(true); setError("");
    try {
      const cycle = await createProductionRework({ jobId: job.id, reasonCategory: reason, scopeDetails: scope, intakeDate, createdBy: null });
      onCreated(cycle);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create Rework."); }
    finally { setSaving(false); }
  }
  return <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/55 px-4 py-8" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form onSubmit={submit} className="w-full max-w-md rounded-sm border border-slate-300 bg-white p-5 shadow-2xl" aria-labelledby="create-rework-title">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-700">Production</div>
      <h2 id="create-rework-title" className="mt-1 text-xl font-bold text-slate-950">Create Rework</h2>
      <p className="mt-1 text-sm text-slate-600">{job.job_number ? `${job.job_number} · ` : ""}{job.name}</p>
      <label className="mt-4 block text-xs font-bold text-slate-800">Reason<select value={reason} onChange={(event) => setReason(event.target.value as ReworkReasonCategory)} className="mt-1 h-10 w-full rounded-sm border border-slate-300 bg-white px-2 text-sm">{reasons.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label className="mt-3 block text-xs font-bold text-slate-800">Rework Scope / Work Required<textarea required rows={4} value={scope} onChange={(event) => setScope(event.target.value)} className="mt-1 w-full resize-y rounded-sm border border-slate-300 bg-white px-2 py-2 text-sm" /></label>
      <label className="mt-3 block text-xs font-bold text-slate-800">Intake / Return Date<input required type="date" value={intakeDate} onChange={(event) => setIntakeDate(event.target.value)} className="mt-1 h-10 w-full rounded-sm border border-slate-300 bg-white px-2 text-sm" /></label>
      {error ? <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}
      <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="h-10 border border-slate-400 px-4 text-sm font-bold">Cancel</button><button disabled={saving || !scope.trim() || !intakeDate} className="tenops-selected-surface h-10 border px-4 text-sm font-bold disabled:opacity-50">{saving ? "Creating…" : "Create Rework"}</button></div>
    </form>
  </div>;
}
