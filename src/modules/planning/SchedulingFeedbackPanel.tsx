"use client";

import { AlertTriangle, CircleX } from "lucide-react";
import { useEffect, useRef } from "react";
import type { PlanningScheduleIssue } from "./schedule-model.mjs";

type Props = { issues: PlanningScheduleIssue[]; focusedIssueId?: string | null };

export default function SchedulingFeedbackPanel({ issues, focusedIssueId }: Props) {
  const panelRef = useRef<HTMLElement | null>(null);
  const focusedRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    if (!focusedIssueId || !focusedRef.current) return;
    focusedRef.current.focus({ preventScroll: true });
    panelRef.current?.scrollTo({ top: Math.max(0, focusedRef.current.offsetTop - 48), behavior: "smooth" });
  }, [focusedIssueId]);
  if (!issues.length) return null;
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  return (
    <section ref={panelRef} data-scheduling-feedback data-severity={errors.length ? "error" : "warning"} aria-live="polite" aria-label="Scheduling feedback" className={`sticky top-20 z-[80] mt-3 max-h-56 overflow-y-auto border border-l-4 bg-white px-4 py-3 shadow-md ${errors.length ? "border-red-300 border-l-red-600" : "border-orange-300 border-l-orange-500"}`}>
      <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
        {errors.length ? <CircleX className="h-4 w-4 text-red-600" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4 text-orange-600" aria-hidden="true" />}
        {errors.length ? "Scheduling Error" : "Scheduling Warning"}
        <span className="font-normal text-slate-500">{errors.length ? "Resolve before saving." : "Review before saving."}</span>
      </div>
      <ul className="mt-2 space-y-1.5 text-sm">
        {[...errors, ...warnings].map((issue) => (
          <li key={issue.id} data-scheduling-feedback-item data-severity={issue.severity} ref={focusedIssueId === issue.id ? focusedRef : undefined} tabIndex={focusedIssueId === issue.id ? -1 : undefined} className={`flex items-start gap-2 px-2 py-1.5 outline-none ${focusedIssueId === issue.id ? "ring-2 ring-blue-600" : ""} ${issue.severity === "error" ? "bg-red-50 text-red-900" : "bg-orange-50 text-orange-950"}`}>
            {issue.severity === "error" ? <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" aria-hidden="true" />}
            <span>{issue.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
