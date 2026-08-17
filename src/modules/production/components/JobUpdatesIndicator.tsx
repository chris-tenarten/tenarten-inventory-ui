"use client";

import { Flag, MessageSquare } from "lucide-react";
import type { MouseEvent } from "react";
import type { JobUpdateSummary } from "../jobs";
import type { ProductionJob } from "../types";

type Props = {
  job: ProductionJob;
  summary: JobUpdateSummary;
  onOpen(): void;
  className?: string;
  display?: "compact" | "overview-slots";
};

export default function JobUpdatesIndicator({
  job,
  summary,
  onOpen,
  className = "",
  display = "compact",
}: Props) {
  const jobLabel = job.job_number || job.name;
  const assigneeLabel = summary.openFollowUpAssignees.join(", ");
  const tooltip = summary.total
    ? `${summary.total} job ${summary.total === 1 ? "update" : "updates"}${summary.openFollowUpCount ? ` · ${summary.openFollowUpCount} need attention${assigneeLabel ? `: ${assigneeLabel}` : ""}` : ""}`
    : "No job updates";
  const accessibleLabel = `Open Job Updates for ${jobLabel}: ${summary.total} ${summary.total === 1 ? "update" : "updates"}${summary.openFollowUpCount ? `, ${summary.openFollowUpCount} need attention${assigneeLabel ? `, assigned to ${assigneeLabel}` : ""}` : ""}`;

  function openUpdates(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onOpen();
  }

  return (
    <button
      type="button"
      data-job-updates-indicator
      data-has-updates={summary.total > 0 ? "true" : undefined}
      data-needs-attention={summary.openFollowUpCount > 0 ? "true" : undefined}
      onClick={openUpdates}
      aria-label={accessibleLabel}
      title={tooltip}
      className={`pointer-events-auto inline-flex h-6 items-center overflow-hidden border text-[10px] font-bold tabular-nums hover:border-slate-400 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${
        display === "overview-slots"
          ? "border-slate-200 bg-slate-50"
          : summary.total
          ? "border-blue-200 bg-blue-50/60"
          : "border-slate-200 bg-slate-50 text-slate-400"
      } ${className}`}
    >
      <span data-job-updates-total className={`inline-flex h-full items-center justify-center gap-1 ${display === "overview-slots" ? `w-12 shrink-0 ${summary.total ? "bg-blue-50/60 text-blue-900" : "text-slate-400"}` : `min-w-0 flex-1 px-1.5 ${summary.total ? "text-blue-900" : "text-slate-400"}`}`}>
        <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
        {summary.total > 0 && <span className="min-w-4 text-center">{summary.total}</span>}
      </span>
      {(display === "overview-slots" || summary.openFollowUpCount > 0) && (
        <span data-job-updates-attention className={`inline-flex h-full min-w-0 shrink items-center justify-center gap-1 border-l ${display === "overview-slots" ? `${summary.openFollowUpCount ? "max-w-36 border-amber-200 bg-amber-50/70 px-1.5 text-amber-900" : "w-12 shrink-0 border-slate-200 text-slate-400"}` : "max-w-36 border-amber-200 bg-amber-50/70 px-1.5 text-amber-900"}`}>
          <Flag
            className={`h-3.5 w-3.5 ${display === "overview-slots" ? "fill-current" : ""}`}
            aria-hidden="true"
          />
          {summary.openFollowUpCount > 0 && (
            <span className="shrink-0 text-center">{summary.openFollowUpCount}</span>
          )}
          {summary.openFollowUpCount > 0 && assigneeLabel && (
            <>
              <span className="shrink-0 px-0.5" aria-hidden="true">|</span>
              <span className="min-w-0 truncate" title={assigneeLabel}>{assigneeLabel}</span>
            </>
          )}
        </span>
      )}
    </button>
  );
}
