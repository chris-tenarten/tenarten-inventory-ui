'use client';

import { Paperclip } from 'lucide-react';
import { getJobReadiness } from '../readiness';
import { materialStatusBadgeClass, materialStatusLabel } from '../material-status';
import type { ProductionJob } from '../types';
import ProductionStatusBadge from './ProductionStatusBadge';

type Props = {
  jobs: ProductionJob[];
  selectedJobId: string | null;
  attachmentCounts: Record<string, number>;
  onSelectJob: (job: ProductionJob, focus?: string) => void;
};

export default function ProductionQueue({ jobs, selectedJobId, attachmentCounts, onSelectJob }: Props) {
  return <div className="overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm"><div className="hidden grid-cols-[minmax(220px,1.7fr)_125px_160px_140px_115px_145px] gap-2 border-b border-slate-200 bg-slate-100/80 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.09em] text-slate-600 md:grid"><span>Job</span><span>Status</span><span>Schedule</span><span>Delivery</span><span>Material</span><span>Planning</span></div><div className="divide-y divide-slate-200">
    {jobs.map((job) => {
      const readiness = getJobReadiness(job);
      const setupFocus = readiness.state === 'not_scheduled' ? 'planned-dates' : readiness.missing.includes('labor estimate') ? 'labor' : undefined;
      const fileCount = attachmentCounts[job.id] ?? 0;
      return <div key={job.id} className={`relative grid grid-cols-1 items-center gap-2 px-4 py-3 transition-colors hover:bg-slate-50 md:grid-cols-[minmax(220px,1.7fr)_125px_160px_140px_115px_145px] ${selectedJobId === job.id ? 'bg-blue-50/70 ring-2 ring-inset ring-blue-600' : ''}`}>
        <button type="button" aria-label={`Open ${job.name}`} onClick={() => onSelectJob(job, setupFocus)} className="absolute inset-0 z-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-700"><span className="sr-only">Open job details</span></button>
        <span className="pointer-events-none relative z-10 min-w-0"><span className="flex items-center gap-2"><span className="truncate text-sm font-bold text-slate-950" title={job.name}>{job.job_number && <span className="mr-2 text-slate-500">{job.job_number}</span>}{job.name}</span>{fileCount > 0 && <button type="button" onClick={() => onSelectJob(job, 'attachments')} className="pointer-events-auto inline-flex shrink-0 items-center gap-1 border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-700" title="View attached files" aria-label={`${fileCount} attached ${fileCount === 1 ? 'file' : 'files'}`}><Paperclip className="h-3 w-3"/>{fileCount}</button>}</span><span className="mt-1 block truncate text-xs text-slate-500" title={job.customer || ''}>{job.customer || 'Customer not recorded'}</span></span>
        <span className="pointer-events-none relative z-10"><ProductionStatusBadge status={job.production_status}/></span>
        <span className="pointer-events-none relative z-10 text-xs text-slate-700">{job.planned_start && job.planned_end ? `${job.planned_start} – ${job.planned_end}` : 'Dates not set'}</span>
        <span className="pointer-events-none relative z-10 text-xs text-slate-700">{job.requested_delivery_date ? `Delivery ${job.requested_delivery_date}` : 'Delivery not set'}</span>
        <span className="pointer-events-none relative z-10 text-xs font-semibold uppercase text-slate-600">Material: <span className={`inline-flex px-1.5 py-0.5 ${materialStatusBadgeClass(job.material_status)}`}>{materialStatusLabel(job.material_status)}</span></span>
        <span className={`pointer-events-none relative z-10 text-xs font-bold ${readiness.state === 'ready' ? 'text-green-700' : 'text-amber-800'}`} title={readiness.guidance}>{readiness.label}<span className="block font-normal text-slate-500">{job.estimated_man_hours === null ? 'Add labor estimate' : `${job.estimated_man_hours} labor hours`}</span></span>
      </div>;
    })}
    {jobs.length === 0 && <div className="px-4 py-10 text-center text-sm text-slate-600">No jobs match the current view.</div>}
  </div></div>;
}
