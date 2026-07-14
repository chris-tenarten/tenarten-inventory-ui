'use client';

import { ListFilter, RotateCw } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import JobAttachmentsPanel from './components/JobAttachmentsPanel';
import JobFormsPanel from './components/JobFormsPanel';
import ProductionGantt from './components/ProductionGantt';
import ProductionTable from './components/ProductionTable';

import {
  createProductionJob,
  loadJobAttachmentCounts,
  loadProductionJobs,
  updateProductionJob,
} from './jobs';

import type { ProductionJobUpdate } from './jobs';
import type {
  NewProductionJob,
  ProductionJob,
  ProductionStatus,
} from './types';

type ProductionView = 'table' | 'gantt';
type ScheduleFilter = 'scheduled' | 'unscheduled';

const statusOptions: Array<{ value: ProductionStatus; label: string }> = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'on_deck', label: 'On Deck' },
  { value: 'in_production', label: 'In Production' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'complete', label: 'Complete' },
  { value: 'cancelled', label: 'Cancelled' },
];

function isScheduled(job: ProductionJob) {
  return Boolean(job.planned_start && job.planned_end);
}

function sortJobs(jobs: ProductionJob[]) {
  return [...jobs].sort((first, second) => {
    if (!first.planned_start && !second.planned_start) {
      return first.name.localeCompare(second.name);
    }
    if (!first.planned_start) return 1;
    if (!second.planned_start) return -1;
    return first.planned_start.localeCompare(second.planned_start);
  });
}

export default function ProductionWorkspace() {
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [selectedAttachmentJob, setSelectedAttachmentJob] = useState<ProductionJob | null>(null);
  const [selectedFormsJob, setSelectedFormsJob] = useState<ProductionJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [activeView, setActiveView] = useState<ProductionView>('table');
  const [scheduleFilters, setScheduleFilters] = useState<Set<ScheduleFilter>>(
    () => new Set(),
  );
  const [statusFilters, setStatusFilters] = useState<Set<ProductionStatus>>(
    () => new Set(),
  );
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement | null>(null);

  const loadJobs = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');

    try {
      const [loadedJobs, loadedCounts] = await Promise.all([
        loadProductionJobs(),
        loadJobAttachmentCounts(),
      ]);

      setJobs(sortJobs(loadedJobs));
      setAttachmentCounts(loadedCounts);
    } catch (error) {
      console.error(error);
      setLoadError(
        error instanceof Error ? error.message : 'Unable to load active jobs.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        isFilterOpen &&
        filterRef.current &&
        !filterRef.current.contains(event.target as Node)
      ) {
        setIsFilterOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isFilterOpen]);

  const filteredJobs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return jobs.filter((job) => {
      if (statusFilters.size > 0 && !statusFilters.has(job.production_status)) {
        return false;
      }

      if (scheduleFilters.size > 0) {
        const scheduleKey: ScheduleFilter = isScheduled(job)
          ? 'scheduled'
          : 'unscheduled';
        if (!scheduleFilters.has(scheduleKey)) return false;
      }

      if (!normalizedSearch) return true;

      return [
        job.name,
        job.customer,
        job.job_number,
        job.estimate_number,
        job.work_order_number,
        job.color_plate_number,
        job.remarks,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedSearch));
    });
  }, [jobs, scheduleFilters, search, statusFilters]);

  async function handleCreateJob(input: NewProductionJob) {
    const created = await createProductionJob(input);
    setJobs((current) => sortJobs([...current, created]));
    return created;
  }

  async function handleUpdateJob(jobId: string, changes: ProductionJobUpdate) {
    const updated = await updateProductionJob(jobId, changes);
    setJobs((current) =>
      sortJobs(current.map((job) => (job.id === jobId ? updated : job))),
    );
    return updated;
  }

  function toggleScheduleFilter(value: ScheduleFilter) {
    setScheduleFilters((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function toggleStatusFilter(value: ProductionStatus) {
    setStatusFilters((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  const activeFilterCount = scheduleFilters.size + statusFilters.size;
  const jobsInQueue = jobs.filter(
    (job) => !['complete', 'cancelled'].includes(job.production_status),
  ).length;
  const unscheduledCount = jobs.filter(
    (job) =>
      !['complete', 'cancelled'].includes(job.production_status) &&
      !isScheduled(job),
  ).length;

  return (
    <div className="mx-auto w-full max-w-[1800px] px-3 py-5 sm:px-5 sm:py-7">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          TenOps
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
          Tenarten Operations Control
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Live production visibility from operational handoff through manufacturing and completion.
        </p>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex flex-col gap-3 border-b border-slate-300 pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-950">Production Pipeline</h2>
            <p className="mt-1 text-sm text-slate-600">
              Use the table to manage the production queue and the Timeline to plan scheduled work.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <div>
              <span className="font-bold uppercase tracking-[0.08em] text-slate-500">Jobs in Queue</span>
              <span className="ml-2 text-base font-bold text-slate-950">{jobsInQueue}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setScheduleFilters(new Set(['unscheduled']));
                setActiveView('gantt');
              }}
              className="text-left transition hover:text-amber-800"
            >
              <span className="font-bold uppercase tracking-[0.08em] text-slate-500">Unscheduled</span>
              <span className="ml-2 text-base font-bold text-slate-950">
                {unscheduledCount} / {jobsInQueue}
              </span>
            </button>
            <div className="font-semibold text-slate-500">
              Showing {filteredJobs.length}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border border-slate-400 bg-slate-100 p-3 lg:flex-row lg:items-center">
          <div className="flex shrink-0 border border-slate-400 bg-white p-1">
            <button
              type="button"
              onClick={() => setActiveView('table')}
              className={`h-8 px-4 text-[10px] font-bold uppercase tracking-[0.09em] ${
                activeView === 'table'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => setActiveView('gantt')}
              className={`h-8 px-4 text-[10px] font-bold uppercase tracking-[0.09em] ${
                activeView === 'gantt'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              Timeline
            </button>
          </div>

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search jobs..."
            className="h-9 min-w-0 flex-1 border border-slate-400 bg-white px-3 text-sm outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
          />

          <div ref={filterRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsFilterOpen((current) => !current)}
              className={`inline-flex h-9 items-center gap-2 border px-3 text-xs font-bold uppercase tracking-[0.07em] transition ${
                activeFilterCount > 0
                  ? 'border-blue-700 bg-blue-50 text-blue-800'
                  : 'border-slate-400 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <ListFilter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-700 px-1 text-[10px] text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {isFilterOpen && (
              <div className="absolute right-0 top-11 z-40 w-72 border border-slate-400 bg-white p-4 shadow-xl">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Schedule</div>
                <div className="mt-2 space-y-2">
                  {(['scheduled', 'unscheduled'] as ScheduleFilter[]).map((value) => (
                    <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={scheduleFilters.has(value)}
                        onChange={() => toggleScheduleFilter(value)}
                      />
                      {value === 'scheduled' ? 'Scheduled' : 'Unscheduled'}
                    </label>
                  ))}
                </div>

                <div className="mt-4 border-t border-slate-300 pt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Production Status</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {statusOptions.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={statusFilters.has(option.value)}
                        onChange={() => toggleStatusFilter(option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setScheduleFilters(new Set());
                    setStatusFilters(new Set());
                  }}
                  disabled={activeFilterCount === 0}
                  className="mt-4 h-9 w-full border border-slate-300 bg-slate-100 text-[10px] font-bold uppercase tracking-[0.07em] text-slate-700 disabled:opacity-40"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => void loadJobs()}
            disabled={isLoading}
            title="Refresh jobs"
            aria-label="Refresh jobs"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-slate-400 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RotateCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loadError && (
          <div className="mt-4 border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            {loadError}
          </div>
        )}

        <div className="mt-4">
          {isLoading ? (
            <div className="flex min-h-72 items-center justify-center border border-slate-400 bg-white text-sm font-semibold text-slate-600">Loading active jobs…</div>
          ) : activeView === 'table' ? (
            <ProductionTable
              jobs={filteredJobs}
              attachmentCounts={attachmentCounts}
              onCreateJob={handleCreateJob}
              onUpdateJob={handleUpdateJob}
              onOpenAttachments={setSelectedAttachmentJob}
              onOpenForms={setSelectedFormsJob}
            />
          ) : (
            <ProductionGantt jobs={filteredJobs} />
          )}
        </div>
      </div>

      <JobFormsPanel
        job={selectedFormsJob}
        onClose={() => setSelectedFormsJob(null)}
      />

      <JobAttachmentsPanel
        job={selectedAttachmentJob}
        onClose={() => setSelectedAttachmentJob(null)}
        onChanged={(jobId, count) =>
          setAttachmentCounts((current) => ({ ...current, [jobId]: count }))
        }
      />
    </div>
  );
}
