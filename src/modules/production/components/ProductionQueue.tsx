'use client';

import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/lib/language';
import type { JobUpdateSummary, ProductionIntegrationSummary } from '../jobs';
import { materialStatusLabel } from '../material-status';
import { getJobReadiness } from '../readiness';
import type { ProductionJob } from '../types';
import ActivityStrip from './ActivityStrip';
import ProductionStatusBadge from './ProductionStatusBadge';
import UnscheduledBadge from './UnscheduledBadge';

type Props = {
  jobs: ProductionJob[];
  selectedJobId: string | null;
  attachmentCounts: Record<string, number>;
  integrationSummaries: Record<string, ProductionIntegrationSummary>;
  jobUpdateSummaries: Record<string, JobUpdateSummary>;
  onSelectJob(job: ProductionJob, focus?: string): void;
  onScheduleJob(job: ProductionJob): void;
};

function formatHours(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
}

function formatMobileDate(value: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    new Date(`${value}T00:00:00`),
  );
}

function formatOverviewDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(`${value}T00:00:00`),
  );
}

export default function ProductionQueue({
  jobs,
  selectedJobId,
  attachmentCounts,
  integrationSummaries,
  jobUpdateSummaries,
  onSelectJob,
  onScheduleJob,
}: Props) {
  const { language, tr } = useLanguage();
  const materialLabels = { unknown: 'Sin definir', not_ready: 'No listo', ordered: 'Pedido', ready: 'Listo' } as const;
  const needsScheduling = (job: ProductionJob) => !['complete', 'cancelled'].includes(job.production_status) && (!job.planned_start || !job.planned_end);
  const scheduledNotStarted = (job: ProductionJob) => job.production_status === 'not_started' && Boolean(job.planned_start && job.planned_end);
  const overviewJobs = [
    ...jobs.filter(needsScheduling),
    ...jobs.filter(scheduledNotStarted),
    ...jobs.filter((job) => !needsScheduling(job) && !scheduledNotStarted(job)),
  ];

  return (
    <div className="overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
      <div className="hidden grid-cols-[minmax(260px,1.7fr)_125px_160px_140px_150px_145px] gap-2 border-b border-slate-200 bg-slate-100/80 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.09em] text-slate-600 md:grid">
        <span>{tr('Job', 'Trabajo')}</span>
        <span>{tr('Status', 'Estado')}</span>
        <span>{tr('Schedule', 'Programación')}</span>
        <span>{tr('Delivery', 'Entrega')}</span>
        <span>{tr('Operations', 'Operaciones')}</span>
        <span>{tr('Planning', 'Planificación')}</span>
      </div>

      <div className="divide-y divide-slate-200">
        {overviewJobs.map((job) => {
          const readiness = getJobReadiness(job);
          const setupFocus = readiness.state === 'not_scheduled' ? 'planned-dates' : readiness.missing.includes('labor estimate') ? 'labor' : undefined;
          const fileCount = attachmentCounts[job.id] ?? 0;
          const updateSummary = jobUpdateSummaries[job.id] ?? { total: 0, openFollowUpCount: 0, latestCreatedAt: null };
          const summary = integrationSummaries[job.id] ?? { actualHours: 0, laborEntryCount: 0, materialReportDates: [] };
          const hasMaterialUse = summary.materialReportDates.length > 0;
          const materialLabel = language === 'es' ? materialLabels[job.material_status] : materialStatusLabel(job.material_status);

          return (
            <article
              key={job.id}
              data-overview-needs-dates={needsScheduling(job) ? 'true' : undefined}
              className={`relative px-3 py-3 md:grid md:grid-cols-[minmax(260px,1.7fr)_125px_160px_140px_150px_145px] md:items-center md:gap-2 md:px-4 ${needsScheduling(job) ? 'bg-amber-50/50 hover:bg-amber-50/70' : 'hover:bg-slate-50'} ${selectedJobId === job.id ? 'bg-blue-50/70 ring-2 ring-inset ring-blue-600' : ''}`}
            >
              <button type="button" aria-label={`Open ${job.name}`} onClick={() => onSelectJob(job, setupFocus)} className="absolute inset-0 z-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-700">
                <span className="sr-only">Open job details</span>
              </button>

              <div className="pointer-events-none relative z-10 md:hidden">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{job.job_number || tr('No job number', 'Sin número')}</div>
                    <h2 className="mt-0.5 truncate text-base font-bold leading-5 text-slate-950">{job.name}</h2>
                    <div className="mt-0.5 truncate text-xs text-slate-500">{job.customer || tr('Customer not recorded', 'Cliente no registrado')}</div>
                  </div>
                  <div className="pointer-events-auto flex shrink-0 flex-col items-end justify-center gap-1"><ProductionStatusBadge status={job.production_status} />{!job.planned_start || !job.planned_end ? <span data-overview-schedule-condition><UnscheduledBadge ariaLabel={`${job.name} needs planned dates`} onClick={() => onScheduleJob(job)} /></span> : null}</div>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-px border border-slate-200 bg-slate-200 text-xs">
                  <div className="min-w-0 bg-white px-2.5 py-2">
                    <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">Schedule</div>
                    <div className="mt-0.5 truncate font-semibold text-slate-800">{job.planned_start && job.planned_end ? `${formatMobileDate(job.planned_start)} – ${formatMobileDate(job.planned_end)}` : 'Dates not set'}</div>
                  </div>
                  <div className="min-w-0 bg-white px-2.5 py-2">
                    <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">Delivery</div>
                    <div className="mt-0.5 truncate font-semibold text-slate-800">{formatMobileDate(job.requested_delivery_date)}</div>
                  </div>
                </div>

                <div data-mobile-planning-summary data-planning-state={readiness.state} className={`mt-2 border-y border-r border-l-2 border-slate-200 bg-white px-2.5 py-1.5 ${readiness.state === 'ready' ? 'border-l-emerald-500' : 'border-l-amber-500'}`}>
                  <div className={`text-xs font-bold ${readiness.state === 'ready' ? 'text-emerald-800' : 'text-amber-900'}`}>
                    {language === 'es' ? readiness.state === 'ready' ? 'Planificación completa' : 'Requiere planificación' : readiness.label}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-600">
                    <span>Material: <strong className="text-slate-800">{materialLabel}</strong></span>
                    <span>·</span>
                    <span>{job.estimated_man_hours !== null ? `${formatHours(job.estimated_man_hours)}h estimated` : tr('No labor estimate', 'Sin estimación')}</span>
                    <span>·</span>
                    {summary.laborEntryCount > 0 ? (
                      <button type="button" onClick={() => { window.location.href = `/manpower-reporting?job=${job.id}`; }} className="pointer-events-auto font-bold text-blue-800 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-blue-600">{formatHours(summary.actualHours)}h reported</button>
                    ) : <span>{tr('No labor reports', 'Sin reportes')}</span>}
                    <span>·</span>
                    <button type="button" onClick={() => { window.location.href = hasMaterialUse ? `/material-usage?historyJob=${job.id}&openReportJob=${job.id}` : `/material-usage?newJob=${job.id}`; }} className={`pointer-events-auto font-bold underline-offset-2 hover:underline focus-visible:ring-2 ${hasMaterialUse ? 'text-emerald-800 focus-visible:ring-emerald-700' : 'text-amber-800 focus-visible:ring-amber-700'}`}>{hasMaterialUse ? tr('Material use linked', 'Uso vinculado') : tr('No material use', 'Sin uso vinculado')}</button>
                  </div>
                </div>

                <div className="mt-2 flex min-w-0 items-center justify-between gap-2 border-t border-slate-200 pt-2">
                  <ActivityStrip job={job} attachmentCount={fileCount} updateSummary={updateSummary} onOpenAttachments={() => onSelectJob(job, 'attachments')} onOpenUpdates={() => onSelectJob(job, 'job-updates')} />
                  {job.archived_at ? <span className="text-[9px] font-bold uppercase text-slate-500">{tr('Archived', 'Archivado')}</span> : null}
                </div>
              </div>

              <div className="pointer-events-none relative z-10 hidden min-w-0 items-start gap-4 md:flex">
                {needsScheduling(job) ? <AlertTriangle data-overview-needs-dates-marker aria-hidden="true" className="h-4 w-4 shrink-0 self-center text-amber-700" /> : null}
                <div className="min-w-0">
                  <span className="block text-sm font-bold leading-5">{job.job_number && <span className="mr-2 text-slate-500">{job.job_number}</span>}{job.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">{job.customer || tr('Customer not recorded', 'Cliente no registrado')}</span>
                  <ActivityStrip job={job} attachmentCount={fileCount} updateSummary={updateSummary} onOpenAttachments={() => onSelectJob(job, 'attachments')} onOpenUpdates={() => onSelectJob(job, 'job-updates')} />
                  {job.archived_at ? <span className="mt-1 inline-block text-[10px] font-bold uppercase text-slate-500">{tr('Archived', 'Archivado')}</span> : null}
                </div>
              </div>
              <div className="relative z-10 hidden min-w-0 flex-col items-start justify-center gap-1 md:flex md:pr-2"><span className="pointer-events-none"><ProductionStatusBadge status={job.production_status} /></span>{!job.planned_start || !job.planned_end ? <span data-overview-schedule-condition className="max-w-full"><UnscheduledBadge ariaLabel={`${job.name} needs planned dates`} onClick={() => onScheduleJob(job)} /></span> : null}</div>
              <span className="pointer-events-none relative z-10 hidden text-xs md:flex md:flex-col md:items-start md:justify-center md:pl-2">
                {job.planned_start && job.planned_end ? (
                  <>
                    <span className="whitespace-nowrap">{formatOverviewDate(job.planned_start)}</span>
                    <span className="whitespace-nowrap">{formatOverviewDate(job.planned_end)}</span>
                  </>
                ) : <span className="whitespace-nowrap">Dates not set</span>}
              </span>
              <span className="pointer-events-none relative z-10 hidden text-xs md:block">{job.requested_delivery_date ? `Delivery ${job.requested_delivery_date}` : 'Delivery not set'}</span>
              <span className="relative z-10 hidden flex-col items-start gap-1 text-[10px] md:flex">
                {job.estimated_man_hours !== null ? <span className="pointer-events-none flex items-baseline gap-1 text-slate-500"><strong className="text-xs text-slate-800">{formatHours(job.estimated_man_hours)}h</strong><span>{tr('Estimated', 'Estimadas')}</span></span> : <span className="pointer-events-none px-0.5 py-1 font-semibold text-slate-900">{tr('No Labor Estimate', 'Sin estimación de mano de obra')}</span>}
                {summary.laborEntryCount > 0 ? <button type="button" aria-label={`${tr('Open manpower reporting for', 'Abrir reporte de mano de obra para')} ${job.name}`} onClick={() => { window.location.href = `/manpower-reporting?job=${job.id}`; }} className="inline-flex h-6 cursor-pointer items-center rounded-sm border border-blue-200 bg-blue-50 px-1.5 font-bold text-blue-900 shadow-sm transition hover:-translate-y-px hover:border-blue-300 hover:bg-blue-100 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">{formatHours(summary.actualHours)}h {tr('Current', 'Registradas')}</button> : <span className="pointer-events-none px-0.5 py-1 font-semibold text-slate-900">{tr('No Labor Reports', 'Sin reportes de mano de obra')}</span>}
                {hasMaterialUse ? <button type="button" data-operational-tone="success" aria-label={`${tr('Open material usage for', 'Abrir uso de materiales para')} ${job.name}`} onClick={() => { window.location.href = `/material-usage?historyJob=${job.id}&openReportJob=${job.id}`; }} className="inline-flex h-6 cursor-pointer items-center rounded-sm border border-emerald-200 bg-emerald-100 px-1.5 font-bold text-emerald-800 shadow-sm transition hover:-translate-y-px hover:border-emerald-300 hover:bg-emerald-200 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">{tr('Material Use', 'Uso de materiales')}</button> : <button type="button" data-operational-tone="warning" aria-label={`${tr('Create material usage report for', 'Crear reporte de materiales para')} ${job.name}`} onClick={() => { window.location.href = `/material-usage?newJob=${job.id}`; }} className="inline-flex h-6 cursor-pointer items-center rounded-sm border border-amber-200 bg-amber-100 px-1.5 font-bold text-amber-900 shadow-sm transition hover:-translate-y-px hover:border-amber-300 hover:bg-amber-200 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700">{tr('No Material Use Linked', 'Sin reporte de materiales')}</button>}
              </span>
              <span className={`pointer-events-none relative z-10 hidden text-xs font-bold md:block ${readiness.state === 'ready' ? 'text-green-700' : 'text-amber-800'}`}>{language === 'es' ? readiness.state === 'ready' ? 'Planificación completa' : 'Requiere planificación' : readiness.label}<span className="block font-normal text-slate-500">{tr('Material Status', 'Estado de materiales')}: {materialLabel}</span></span>
            </article>
          );
        })}
        {!jobs.length && <div className="px-4 py-10 text-center text-sm text-slate-600">{tr('No jobs match the current view.', 'Ningún trabajo coincide con la vista actual.')}</div>}
      </div>
    </div>
  );
}
