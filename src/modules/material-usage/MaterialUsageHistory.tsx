"use client";

import { openProductionJob } from "../production/job-options";
import { getProductionJobReferenceLabel } from "../production/job-reference";
import { JobTag } from "../production/components/JobTag";

import { MaterialUsageReportSummary } from "./types";

interface Props {
  reports: MaterialUsageReportSummary[];
  selectedId: string | null;
  loading: boolean;

  onSelect(id: string): void;
  onNew(): void;
}

function formatReportDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function MaterialUsageHistory({
  reports,
  selectedId,
  loading,
  onSelect,
  onNew,
}: Props) {
  return (
    <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-4">
        <div className="mb-3">
          <h1 className="text-base font-semibold text-slate-900">
            Material Usage
          </h1>

          <p className="mt-0.5 text-xs text-slate-500">
            Daily material-use reports
          </p>
        </div>

        <button
          type="button"
          onClick={onNew}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New Material Report
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-5 text-sm text-slate-500">
            Loading reports...
          </div>
        ) : null}

        {!loading && reports.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-medium text-slate-700">
              No material reports yet
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Create the first report to begin tracking usage.
            </p>
          </div>
        ) : null}

        {reports.map((report) => {
          const jobReferenceLabel = getProductionJobReferenceLabel({
            name: report.jobName,
            job_number: report.jobNumber,
          });
          const title = report.jobId
            ? jobReferenceLabel
            : report.jobName || report.jobNumber || "Unlisted Job";

          return (
            <div
              role="button"
              tabIndex={0}
              key={report.id}
              onClick={() => onSelect(report.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(report.id);
                }
              }}
              className={[
                "w-full border-b border-slate-100 px-4 py-3 text-left transition-colors",
                selectedId === report.id
                  ? "bg-slate-100"
                  : "bg-white hover:bg-slate-50",
              ].join(" ")}
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                  {title}
                </div>

                {report.jobId ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();

                      const shouldOpen = window.confirm(
                        `Open ${jobReferenceLabel} in the Production Queue?`,
                      );

                      if (shouldOpen) {
                        openProductionJob(report.jobId!);
                      }
                    }}
                    className="m-0 inline-flex max-w-[140px] shrink-0 appearance-none items-center justify-center border-0 bg-transparent p-0 leading-none"
                    title="Open Production job"
                  >
                    <JobTag label={report.jobName || report.jobNumber || "Production Job"} className="w-full justify-center" />
                  </button>
                ) : (
                  <span className="inline-flex max-w-[140px] shrink-0 items-center text-right text-[10px] font-medium leading-tight text-slate-500">
                    Not linked to Production
                  </span>
                )}
              </div>

              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                <span>{formatReportDate(report.reportDate)}</span>

                {report.workOrder ? (
                  <span className="min-w-0 truncate">
                    WO {report.workOrder}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
