'use client';

import { Paperclip } from 'lucide-react';
import type { ProductionIntegrationSummary } from '../jobs';
import { materialStatusLabel } from '../material-status';
import { getJobReadiness } from '../readiness';
import type { ProductionJob } from '../types';
import ProductionStatusBadge from './ProductionStatusBadge';

type Props = { jobs: ProductionJob[]; selectedJobId: string | null; attachmentCounts: Record<string, number>; integrationSummaries: Record<string, ProductionIntegrationSummary>; onSelectJob(job: ProductionJob, focus?: string): void };

function formatHours(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
}

export default function ProductionQueue({ jobs, selectedJobId, attachmentCounts, integrationSummaries, onSelectJob }: Props) {
  return <div className="overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm"><div className="hidden grid-cols-[minmax(260px,1.7fr)_125px_160px_140px_150px_145px] gap-2 border-b border-slate-200 bg-slate-100/80 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.09em] text-slate-600 md:grid"><span>Job</span><span>Status</span><span>Schedule</span><span>Delivery</span><span>Operations</span><span>Planning</span></div><div className="divide-y divide-slate-200">
    {jobs.map((job) => { const readiness = getJobReadiness(job); const setupFocus = readiness.state === 'not_scheduled' ? 'planned-dates' : readiness.missing.includes('labor estimate') ? 'labor' : undefined; const fileCount = attachmentCounts[job.id] ?? 0; const summary = integrationSummaries[job.id] ?? { actualHours: 0, laborEntryCount: 0, materialReportDates: [] }; const hasMaterialUse = summary.materialReportDates.length > 0; return <div key={job.id} className={`relative grid grid-cols-1 items-center gap-2 px-4 py-3 hover:bg-slate-50 md:grid-cols-[minmax(260px,1.7fr)_125px_160px_140px_150px_145px] ${selectedJobId === job.id ? 'bg-blue-50/70 ring-2 ring-inset ring-blue-600' : ''}`}>
      <button type="button" aria-label={`Open ${job.name}`} onClick={() => onSelectJob(job, setupFocus)} className="absolute inset-0 z-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-700"><span className="sr-only">Open job details</span></button>
      <span className="pointer-events-none relative z-10 min-w-0"><span className="flex items-center gap-2"><span className="truncate text-sm font-bold">{job.job_number && <span className="mr-2 text-slate-500">{job.job_number}</span>}{job.name}</span>{fileCount > 0 && <button type="button" onClick={() => onSelectJob(job, 'attachments')} className="pointer-events-auto inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-bold"><Paperclip className="h-3 w-3" />{fileCount}</button>}</span><span className="mt-1 block truncate text-xs text-slate-500">{job.customer || 'Customer not recorded'}</span>{job.archived_at ? <span className="mt-1 inline-block text-[10px] font-bold uppercase text-slate-500">Archived</span> : null}</span>
      <span className="pointer-events-none relative z-10"><ProductionStatusBadge status={job.production_status} /></span>
      <span className="pointer-events-none relative z-10 text-xs">{job.planned_start && job.planned_end ? `${job.planned_start} – ${job.planned_end}` : 'Dates not set'}</span>
      <span className="pointer-events-none relative z-10 text-xs">{job.requested_delivery_date ? `Delivery ${job.requested_delivery_date}` : 'Delivery not set'}</span>
      <span className="relative z-10 flex flex-col items-start gap-1 text-[10px]">
        {job.estimated_man_hours !== null ? <span className="pointer-events-none flex items-baseline gap-1 text-slate-500"><strong className="text-xs text-slate-800">{formatHours(job.estimated_man_hours)}h</strong><span>Estimated</span></span> : <span className="pointer-events-none px-0.5 py-1 font-semibold text-slate-900">No Labor Estimate</span>}
        {summary.laborEntryCount > 0 ? <button type="button" aria-label={`Open manpower reporting for ${job.name}`} onClick={() => { window.location.href = `/manpower-reporting?job=${job.id}`; }} className="inline-flex h-6 cursor-pointer items-center rounded-sm border border-blue-200 bg-blue-50 px-1.5 font-bold text-blue-900 shadow-sm transition hover:-translate-y-px hover:border-blue-300 hover:bg-blue-100 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">{formatHours(summary.actualHours)}h Current</button> : <span className="pointer-events-none px-0.5 py-1 font-semibold text-slate-900">No Labor Reports</span>}
        {hasMaterialUse ? <button type="button" aria-label={`Open material usage for ${job.name}`} onClick={() => { window.location.href = `/material-usage?historyJob=${job.id}&openReportJob=${job.id}`; }} className="inline-flex h-6 cursor-pointer items-center rounded-sm border border-emerald-200 bg-emerald-100 px-1.5 font-bold text-emerald-800 shadow-sm transition hover:-translate-y-px hover:border-emerald-300 hover:bg-emerald-200 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">Material Use</button> : <button type="button" aria-label={`Create material usage report for ${job.name}`} onClick={() => { window.location.href = `/material-usage?newJob=${job.id}`; }} className="inline-flex h-6 cursor-pointer items-center rounded-sm border border-amber-200 bg-amber-100 px-1.5 font-bold text-amber-900 shadow-sm transition hover:-translate-y-px hover:border-amber-300 hover:bg-amber-200 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700">No Material Use Linked</button>}
      </span>
      <span className={`pointer-events-none relative z-10 text-xs font-bold ${readiness.state === 'ready' ? 'text-green-700' : 'text-amber-800'}`}>{readiness.label}<span className="block font-normal text-slate-500">Material Status: {materialStatusLabel(job.material_status)}</span></span>
    </div>; })}
    {!jobs.length && <div className="px-4 py-10 text-center text-sm text-slate-600">No jobs match the current view.</div>}
  </div></div>;
}
