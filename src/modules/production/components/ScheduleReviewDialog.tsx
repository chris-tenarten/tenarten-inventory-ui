"use client";

import { AlertTriangle, CircleX, Check } from "lucide-react";
import type { PlanningScheduleIssue } from "@/modules/planning/schedule-model.mjs";
import type { PlanningPhase } from "@/modules/planning/types";
import type { StagedPlanningSchedules } from "@/modules/planning/schedule-staging";
import type { StagedSchedules } from "../schedule-staging";
import type { ProductionJob } from "../types";

type Props = {
  jobs: ProductionJob[];
  phases: PlanningPhase[];
  production: StagedSchedules;
  planning: StagedPlanningSchedules;
  issues: PlanningScheduleIssue[];
  onClose(): void;
  onRevertJob(jobId: string): void;
  onRevertPhase(phaseId: string): void;
};

function dayDelta(original: string, proposed: string) {
  return Math.round((Date.parse(`${proposed}T00:00:00Z`) - Date.parse(`${original}T00:00:00Z`)) / 86_400_000);
}

function phaseChangeSummary(title: string, originalStart: string, originalEnd: string, proposedStart: string, proposedEnd: string) {
  const startDelta = dayDelta(originalStart, proposedStart);
  const endDelta = dayDelta(originalEnd, proposedEnd);
  if (startDelta === endDelta) return `${title} moved ${startDelta > 0 ? "+" : ""}${startDelta} day${Math.abs(startDelta) === 1 ? "" : "s"}`;
  if (startDelta !== 0 && endDelta === 0) return `${title} start adjusted ${startDelta > 0 ? "+" : ""}${startDelta} day${Math.abs(startDelta) === 1 ? "" : "s"}`;
  if (endDelta !== 0 && startDelta === 0) return `${title} finish adjusted ${endDelta > 0 ? "+" : ""}${endDelta} day${Math.abs(endDelta) === 1 ? "" : "s"}`;
  return `${title} interval resized`;
}

export default function ScheduleReviewDialog({ jobs, phases, production, planning, issues, onClose, onRevertJob, onRevertPhase }: Props) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="schedule-review-title" className="max-h-[80vh] w-full max-w-2xl overflow-y-auto border border-slate-500 bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between"><h2 id="schedule-review-title" className="text-xl font-bold">Review proposed schedules</h2><button type="button" onClick={onClose} className="h-9 border px-3 font-bold">Close</button></div>
        <section className="mt-4"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Production changes</h3><div className="mt-2 divide-y border">{Object.values(production).map((proposal) => { const job = jobs.find((item) => item.id === proposal.job_id); return <div key={proposal.job_id} className="p-3"><div className="font-bold">{job?.name}{job?.job_number ? ` · ${job.job_number}` : ""}</div><div className="mt-1 text-sm">{proposal.original_planned_start && proposal.original_planned_end ? `${proposal.original_planned_start} – ${proposal.original_planned_end}` : "Not scheduled"} → {proposal.proposed_planned_start} – {proposal.proposed_planned_end}</div><button type="button" onClick={() => onRevertJob(proposal.job_id)} className="mt-2 text-xs font-bold text-red-700 underline">Revert this job</button></div>; })}</div></section>
        <section className="mt-4"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Planning changes</h3><div className="mt-2 divide-y border">{Object.values(planning).map((proposal) => { const phase = phases.find((item) => item.id === proposal.phase_id); return <div key={proposal.phase_id} className="p-3"><div className="flex items-center gap-2 font-bold"><Check className="h-4 w-4 text-emerald-700" aria-hidden="true" />{phaseChangeSummary(phase?.title ?? "Phase", proposal.original_start_date, proposal.original_end_date, proposal.proposed_start_date, proposal.proposed_end_date)}</div><div className="mt-1 text-sm">{proposal.original_start_date} – {proposal.original_end_date} → {proposal.proposed_start_date} – {proposal.proposed_end_date}</div><div className="mt-1 text-xs text-slate-600">{proposal.change_source === "production_reschedule" ? "Moved with Production" : "Manual Timeline edit"}</div><button type="button" onClick={() => onRevertPhase(proposal.phase_id)} className="mt-2 text-xs font-bold text-red-700 underline">Revert this Phase</button></div>; })}</div></section>
        {issues.length > 0 && <section className="mt-4"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Scheduling feedback</h3><ul className="mt-2 space-y-2">{issues.map((issue) => <li key={issue.id} className={`flex gap-2 border-l-4 px-3 py-2 text-sm ${issue.severity === "error" ? "border-red-600 bg-red-50 text-red-900" : "border-orange-500 bg-orange-50 text-orange-950"}`}>{issue.severity === "error" ? <CircleX className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}<span>{issue.message}</span></li>)}</ul></section>}
      </div>
    </div>
  );
}
