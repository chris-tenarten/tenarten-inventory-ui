"use client";

import { loadProductionJobOptions, openProductionJob, type ProductionJobOption } from "../production/job-options";
import { getProductionJobReferenceLabel } from "../production/job-reference";
import { JobTag } from "../production/components/JobTag";
import ProductionStatusBadge from "../production/components/ProductionStatusBadge";
import { productionStatusVisualByValue, productionStatusVisuals } from "../production/status-visuals";
import type { ProductionStatus } from "../production/types";

import { MaterialUsageReportSummary } from "./types";
import { localDateKey } from "./daily-status";
import { useEffect, useMemo, useState } from "react";

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
  const [search, setSearch] = useState("");
  const [jobId, setJobId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("historyJob") ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilters, setStatusFilters] = useState<Set<ProductionStatus>>(() => new Set());
  const [archived, setArchived] = useState(false);
  const [unlinked, setUnlinked] = useState(false);
  const [jobs, setJobs] = useState<ProductionJobOption[]>([]);
  const today = localDateKey();
  useEffect(() => { void loadProductionJobOptions({ orderBy: 'schedule', includeArchived: true }).then(setJobs); }, []);
  useEffect(() => {
    const syncJobFilter = () => setJobId(new URLSearchParams(window.location.search).get('historyJob') ?? '');
    window.addEventListener('popstate', syncJobFilter);
    return () => window.removeEventListener('popstate', syncJobFilter);
  }, []);
  const jobsById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);
  const visibleReports = useMemo(() => reports.filter((report) => {
    if (jobId && report.jobId !== jobId) return false;
    const job = report.jobId ? jobsById.get(report.jobId) : undefined;
    const hasCategoryFilter = statusFilters.size > 0 || archived || unlinked;
    if (hasCategoryFilter) {
      const matchesStatus = Boolean(job && !job.archived_at && statusFilters.has(job.production_status as ProductionStatus));
      const matchesArchived = Boolean(archived && job?.archived_at);
      const matchesUnlinked = Boolean(unlinked && !report.jobId);
      if (!matchesStatus && !matchesArchived && !matchesUnlinked) return false;
    } else if (job?.archived_at) return false;
    const term = search.trim().toLowerCase();
    const statusText = report.reportDate === today ? 'reported today' : 'historical report';
    const productionStatus = job ? productionStatusVisualByValue[job.production_status as ProductionStatus]?.label : report.jobId ? '' : 'unlinked';
    return !term || [report.jobNumber, report.jobName, report.unlistedJobName, report.workOrder, report.terrazzoType, report.notes, statusText, productionStatus, job?.archived_at ? 'archived' : ''].some((value) => value?.toLowerCase().includes(term));
  }), [archived, jobId, jobsById, reports, search, statusFilters, today, unlinked]);
  const activeFilterCount = statusFilters.size + Number(archived) + Number(unlinked);
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
        <div className="mt-3 space-y-2">
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reports…" className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm" />
          <div className="relative"><button type="button" onClick={() => setFiltersOpen((current) => !current)} className={`h-9 w-full rounded-md border px-3 text-xs font-semibold ${activeFilterCount ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-300 bg-white text-slate-700'}`}>Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}</button>{filtersOpen ? <div className="absolute right-0 top-10 z-30 w-64 rounded-md border border-slate-300 bg-white p-3 text-xs shadow-xl"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Production Status</div><div className="mt-2 space-y-2">{productionStatusVisuals.map((visual) => <label key={visual.value} className="flex items-center justify-between gap-2 text-slate-700"><span className="flex items-center gap-2"><input type="checkbox" checked={statusFilters.has(visual.value)} onChange={() => setStatusFilters((current) => { const next = new Set(current); if (next.has(visual.value)) next.delete(visual.value); else next.add(visual.value); return next; })} /><span className="sr-only">{visual.label}</span></span><ProductionStatusBadge status={visual.value} /></label>)}</div><div className="mt-3 space-y-2 border-t border-slate-200 pt-3"><label className="flex items-center gap-2 text-slate-700"><input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />Archived</label><label className="flex items-center gap-2 text-slate-700"><input type="checkbox" checked={unlinked} onChange={(event) => setUnlinked(event.target.checked)} />Unlinked</label></div>{activeFilterCount ? <button type="button" onClick={() => { setStatusFilters(new Set()); setArchived(false); setUnlinked(false); }} className="mt-3 w-full border-t border-slate-200 pt-2 font-semibold text-blue-700">Clear filters</button> : null}</div> : null}</div>
          {jobId ? <div className="flex items-center justify-between rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800"><span className="truncate">Job: {jobs.find((job) => job.id === jobId)?.name ?? reports.find((report) => report.jobId === jobId)?.jobName ?? 'Production Job'}</span><button type="button" aria-label="Clear job filter" onClick={() => { const url = new URL(window.location.href); url.searchParams.delete('historyJob'); window.history.pushState(null, '', `${url.pathname}${url.search}`); setJobId(""); }} className="ml-2 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">×</button></div> : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-5 text-sm text-slate-500">
            Loading reports...
          </div>
        ) : null}

        {!loading && visibleReports.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-medium text-slate-700">
              No material reports yet
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Create the first report to begin tracking usage.
            </p>
          </div>
        ) : null}

        {visibleReports.map((report) => {
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
                        `Open ${jobReferenceLabel} in the Production Pipeline?`,
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

                {report.reportDate === today ? <span className="bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-800">Reported Today</span> : null}

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
