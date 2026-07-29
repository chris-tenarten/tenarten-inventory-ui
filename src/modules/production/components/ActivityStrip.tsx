"use client";

import { Paperclip } from "lucide-react";
import type { MouseEvent } from "react";
import type { JobUpdateSummary } from "../jobs";
import type { ProductionJob } from "../types";
import JobUpdatesIndicator from "./JobUpdatesIndicator";

type Props = {
  job: ProductionJob;
  attachmentCount: number;
  updateSummary: JobUpdateSummary;
  onOpenAttachments(): void;
  onOpenUpdates(): void;
};

export default function ActivityStrip({
  job,
  attachmentCount,
  updateSummary,
  onOpenAttachments,
  onOpenUpdates,
}: Props) {
  function openAttachments(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onOpenAttachments();
  }

  return (
    <span className="pointer-events-none mt-1.5 flex h-6 items-center gap-1.5">
      <JobUpdatesIndicator
        job={job}
        summary={updateSummary}
        onOpen={onOpenUpdates}
        className="w-24"
        display="overview-slots"
      />
      <button
        type="button"
        onClick={openAttachments}
        aria-label={`Open Project Files for ${job.job_number || job.name}: ${attachmentCount} ${attachmentCount === 1 ? "attachment" : "attachments"}`}
        title={attachmentCount ? `${attachmentCount} attached ${attachmentCount === 1 ? "file" : "files"}` : "No attached files"}
        className={`pointer-events-auto inline-flex h-6 w-12 items-center justify-center gap-1 border text-[10px] font-bold tabular-nums hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${
          attachmentCount
            ? "border-slate-300 bg-white text-slate-600"
            : "border-slate-200 bg-slate-50 text-slate-400"
        }`}
      >
        <Paperclip className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="min-w-4 text-center">
          {attachmentCount > 0 ? attachmentCount : ""}
        </span>
      </button>
    </span>
  );
}
