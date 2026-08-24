"use client";

import { MessageSquare } from "lucide-react";
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
}: Props) {
  const jobLabel = job.job_number || job.name;
  const hasUpdates = summary.total > 0;
  const hasUnseenActivity = hasUpdates && summary.hasUnseenActivity;
  const tooltip = hasUpdates
    ? `${summary.total} job ${summary.total === 1 ? "update" : "updates"}`
    : "No job updates";
  const accessibleLabel = `Open Job Updates for ${jobLabel}: ${tooltip}`;

  function openUpdates(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onOpen();
  }

  return (
    <button
      type="button"
      data-job-updates-indicator
      data-has-updates={hasUpdates ? "true" : undefined}
      data-unseen-activity={hasUnseenActivity ? "true" : undefined}
      onClick={openUpdates}
      aria-label={accessibleLabel}
      title={tooltip}
      className={`tenops-compact-type pointer-events-auto inline-flex h-6 items-center border border-slate-300 bg-white px-1.5 font-bold tabular-nums text-slate-600 hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${className}`}
    >
      <span data-job-updates-total className="inline-flex items-center gap-1">
        <span className="relative inline-flex">
        <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
          {hasUnseenActivity ? <span data-job-updates-unseen-dot aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-blue-600 ring-1 ring-white" /> : null}
        </span>
        {hasUpdates ? <>
          <span aria-hidden="true" className="text-[9px] font-semibold text-slate-400">|</span>
          <span className="min-w-3 text-center">{summary.total}</span>
        </> : null}
      </span>
    </button>
  );
}
