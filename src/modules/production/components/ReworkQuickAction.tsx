"use client";

import { RotateCcw } from "lucide-react";
import type { MouseEvent } from "react";
import type { ProductionJob } from "../types";

export function canCreateProductionRework(job: ProductionJob) {
  const canonicalStatus = job.original_production_status ?? job.production_status;
  return canonicalStatus === "complete" && !job.rework_cycle && !job.archived_at;
}

export default function ReworkQuickAction({
  job,
  onCreate,
  className = "",
}: {
  job: ProductionJob;
  onCreate(job: ProductionJob): void;
  className?: string;
}) {
  if (!canCreateProductionRework(job)) return null;

  function createRework(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onCreate(job);
  }

  return (
    <span
      data-rework-action-group
      className="pointer-events-none inline-flex h-6 shrink-0 items-center"
    >
      <button
        type="button"
        data-rework-quick-action
        onClick={createRework}
        aria-label={`Create Rework for ${job.job_number || job.name}`}
        title="Create Rework"
        className={`pointer-events-auto inline-flex h-6 w-7 shrink-0 items-center justify-center border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 ${className}`}
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </span>
  );
}
