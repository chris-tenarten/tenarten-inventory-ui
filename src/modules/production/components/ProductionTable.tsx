'use client';

import { FileText, Paperclip } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode, RefObject } from 'react';

import type { ProductionJobUpdate } from '../jobs';
import type { StagedSchedule } from '../ProductionWorkspace';
import type {
  MaterialStatus,
  NewProductionJob,
  ProductionJob,
  ProductionStatus,
} from '../types';

type Props = {
  jobs: ProductionJob[];
  attachmentCounts: Record<string, number>;
  onCreateJob: (input: NewProductionJob) => Promise<ProductionJob>;
  onUpdateJob: (
    jobId: string,
    changes: ProductionJobUpdate,
  ) => Promise<ProductionJob>;
  onOpenAttachments: (job: ProductionJob) => void;
  onOpenForms: (job: ProductionJob) => void;
  stagedSchedule: StagedSchedule | null;
  onStageSchedule: (job: ProductionJob, start: string, end: string) => void;
  selectedJobId: string | null;
  onSelectJob: (job: ProductionJob) => void;
};

type EditableRow = {
  name: string;
  customer: string;
  jobNumber: string;
  estimateNumber: string;
  workOrderNumber: string;
  depositDate: string;
  requestedDeliveryDate: string;
  plannedStart: string;
  plannedEnd: string;
  estimatedManHours: string;
  estimatedCalendarDays: string;
  colorPlateNumber: string;
  sampleSubmittedDate: string;
  approvalDate: string;
  materialStatus: MaterialStatus;
  productionStatus: ProductionStatus;
  remarks: string;
};

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
type EditableField = keyof EditableRow;

const productionStatuses: Array<{ value: ProductionStatus; label: string }> = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'on_deck', label: 'On Deck' },
  { value: 'in_production', label: 'In Production' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'complete', label: 'Complete' },
  { value: 'cancelled', label: 'Cancelled' },
];

const materialStatuses: Array<{ value: MaterialStatus; label: string }> = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'not_ready', label: 'Not Ready' },
  { value: 'ready', label: 'Ready' },
];

const headerClass =
  'whitespace-nowrap border-b border-r border-slate-400 bg-slate-100 px-1.5 py-2 text-center text-[9px] font-bold uppercase tracking-[0.08em] text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600';
const cellClass = 'border-b border-r border-slate-300 bg-white p-0 align-top';
const inputClass =
  'h-8 w-full min-w-0 border-0 bg-transparent px-1.5 text-xs text-slate-800 outline-none focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-600 [&[type=date]]:text-center [&[type=number]]:text-right';
const selectClass = `${inputClass} pr-6 text-center`;

function blankRow(): EditableRow {
  return {
    name: '',
    customer: '',
    jobNumber: '',
    estimateNumber: '',
    workOrderNumber: '',
    depositDate: '',
    requestedDeliveryDate: '',
    plannedStart: '',
    plannedEnd: '',
    estimatedManHours: '',
    estimatedCalendarDays: '',
    colorPlateNumber: '',
    sampleSubmittedDate: '',
    approvalDate: '',
    materialStatus: 'unknown',
    productionStatus: 'not_started',
    remarks: '',
  };
}

function toRow(job: ProductionJob): EditableRow {
  return {
    name: job.name,
    customer: job.customer ?? '',
    jobNumber: job.job_number ?? '',
    estimateNumber: job.estimate_number ?? '',
    workOrderNumber: job.work_order_number ?? '',
    depositDate: job.deposit_date ?? '',
    requestedDeliveryDate: job.requested_delivery_date ?? '',
    plannedStart: job.planned_start ?? '',
    plannedEnd: job.planned_end ?? '',
    estimatedManHours:
      job.estimated_man_hours === null ? '' : String(job.estimated_man_hours),
    estimatedCalendarDays:
      job.estimated_calendar_days === null
        ? ''
        : String(job.estimated_calendar_days),
    colorPlateNumber: job.color_plate_number ?? '',
    sampleSubmittedDate: job.sample_submitted_date ?? '',
    approvalDate: job.approval_date ?? '',
    materialStatus: job.material_status,
    productionStatus: job.production_status,
    remarks: job.remarks ?? '',
  };
}

function optionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNewJob(row: EditableRow): NewProductionJob {
  return {
    name: row.name.trim(),
    customer: row.customer.trim() || null,
    job_number: row.jobNumber.trim() || null,
    estimate_number: row.estimateNumber.trim() || null,
    work_order_number: row.workOrderNumber.trim() || null,
    deposit_date: row.depositDate || null,
    requested_delivery_date: row.requestedDeliveryDate || null,
    planned_start: row.plannedStart || null,
    planned_end: row.plannedEnd || null,
    estimated_man_hours: optionalNumber(row.estimatedManHours),
    estimated_calendar_days: optionalNumber(row.estimatedCalendarDays),
    color_plate_number: row.colorPlateNumber.trim() || null,
    sample_submitted_date: row.sampleSubmittedDate || null,
    approval_date: row.approvalDate || null,
    remarks: row.remarks.trim() || null,
  };
}

function validateDraft(row: EditableRow) {
  if (!row.name.trim()) return 'Project name is required.';

  if (row.plannedStart && row.plannedEnd && row.plannedEnd < row.plannedStart) {
    return 'Planned finish cannot be before planned start.';
  }

  if (row.estimatedManHours.trim()) {
    const hours = Number(row.estimatedManHours);
    if (!Number.isFinite(hours) || hours < 0) {
      return 'Estimated man hours must be zero or greater.';
    }
  }

  if (row.estimatedCalendarDays.trim()) {
    const days = Number(row.estimatedCalendarDays);
    if (!Number.isInteger(days) || days < 0) {
      return 'Estimated calendar days must be a whole number.';
    }
  }

  return '';
}

function fieldUpdate(
  field: EditableField,
  row: EditableRow,
): ProductionJobUpdate {
  switch (field) {
    case 'name':
      return { name: row.name.trim() };
    case 'customer':
      return { customer: row.customer.trim() || null };
    case 'jobNumber':
      return { job_number: row.jobNumber.trim() || null };
    case 'estimateNumber':
      return { estimate_number: row.estimateNumber.trim() || null };
    case 'workOrderNumber':
      return { work_order_number: row.workOrderNumber.trim() || null };
    case 'depositDate':
      return { deposit_date: row.depositDate || null };
    case 'requestedDeliveryDate':
      return { requested_delivery_date: row.requestedDeliveryDate || null };
    case 'plannedStart':
      return { planned_start: row.plannedStart || null };
    case 'plannedEnd':
      return { planned_end: row.plannedEnd || null };
    case 'estimatedManHours':
      return { estimated_man_hours: optionalNumber(row.estimatedManHours) };
    case 'estimatedCalendarDays':
      return {
        estimated_calendar_days: optionalNumber(row.estimatedCalendarDays),
      };
    case 'colorPlateNumber':
      return { color_plate_number: row.colorPlateNumber.trim() || null };
    case 'sampleSubmittedDate':
      return { sample_submitted_date: row.sampleSubmittedDate || null };
    case 'approvalDate':
      return { approval_date: row.approvalDate || null };
    case 'materialStatus':
      return { material_status: row.materialStatus };
    case 'productionStatus':
      return { production_status: row.productionStatus };
    case 'remarks':
      return { remarks: row.remarks.trim() || null };
  }
}

function savedFieldValue(job: ProductionJob, field: EditableField): string {
  const row = toRow(job);
  return String(row[field]);
}

function validateField(field: EditableField, row: EditableRow) {
  if (field === 'name' && !row.name.trim()) {
    return 'Project name is required.';
  }

  if (
    (field === 'plannedStart' || field === 'plannedEnd') &&
    row.plannedStart &&
    row.plannedEnd &&
    row.plannedEnd < row.plannedStart
  ) {
    return 'Planned finish cannot be before planned start.';
  }

  if (field === 'estimatedManHours' && row.estimatedManHours.trim()) {
    const hours = Number(row.estimatedManHours);
    if (!Number.isFinite(hours) || hours < 0) {
      return 'Estimated man hours must be zero or greater.';
    }
  }

  if (field === 'estimatedCalendarDays' && row.estimatedCalendarDays.trim()) {
    const days = Number(row.estimatedCalendarDays);
    if (!Number.isInteger(days) || days < 0) {
      return 'Estimated calendar days must be a whole number.';
    }
  }

  return '';
}

function StateLabel({ state }: { state: SaveState }) {
  const labels: Partial<Record<SaveState, string>> = {
    dirty: 'Unsaved',
    saving: 'Saving…',
    saved: 'Saved',
    error: 'Could not save',
  };

  const styles: Partial<Record<SaveState, string>> = {
    dirty: 'text-amber-700',
    saving: 'text-blue-700',
    saved: 'text-emerald-700',
    error: 'text-red-700',
  };

  if (!labels[state]) return null;

  return (
    <span
      className={`text-[9px] font-bold uppercase tracking-[0.08em] ${styles[state]}`}
    >
      {labels[state]}
    </span>
  );
}

function blurOnEnter(event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) {
  if (event.key === 'Enter') {
    event.preventDefault();
    event.currentTarget.blur();
  }
}

export default function ProductionTable({
  jobs,
  attachmentCounts,
  onCreateJob,
  onUpdateJob,
  onOpenAttachments,
  onOpenForms,
  stagedSchedule,
  onStageSchedule,
  selectedJobId,
  onSelectJob,
}: Props) {
  const [rows, setRows] = useState<Record<string, EditableRow>>({});
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState<EditableRow>(blankRow);
  const [draftState, setDraftState] = useState<SaveState>('idle');
  const [draftError, setDraftError] = useState('');
  const draftNameRef = useRef<HTMLInputElement | null>(null);
  const savingFieldsRef = useRef<Record<string, Set<EditableField>>>({});

  useEffect(() => {
    setRows((current) => {
      const next = { ...current };
      for (const job of jobs) {
        if (states[job.id] !== 'dirty' && states[job.id] !== 'saving') {
          next[job.id] = toRow(job);
        }
      }
      return next;
    });
  }, [jobs, states]);

  useEffect(() => {
    if (isAdding) requestAnimationFrame(() => draftNameRef.current?.focus());
  }, [isAdding]);

  function changeRow<K extends EditableField>(
    job: ProductionJob,
    field: K,
    value: EditableRow[K],
  ) {
    setRows((current) => ({
      ...current,
      [job.id]: { ...(current[job.id] ?? toRow(job)), [field]: value },
    }));
    setStates((current) => ({ ...current, [job.id]: 'dirty' }));
    setErrors((current) => ({ ...current, [job.id]: '' }));
  }

  function changeDraft<K extends EditableField>(
    field: K,
    value: EditableRow[K],
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
    setDraftState('dirty');
    setDraftError('');
  }

  async function saveField(job: ProductionJob, field: EditableField) {
    const row = rows[job.id] ?? toRow(job);
    const currentValue = String(row[field]);

    if (currentValue === savedFieldValue(job, field)) {
      return;
    }

    const validationError = validateField(field, row);
    if (validationError) {
      setStates((current) => ({ ...current, [job.id]: 'error' }));
      setErrors((current) => ({ ...current, [job.id]: validationError }));
      return;
    }

    if (field === 'plannedStart' || field === 'plannedEnd') {
      if (stagedSchedule && stagedSchedule.jobId !== job.id) {
        setStates((current) => ({ ...current, [job.id]: 'error' }));
        setErrors((current) => ({ ...current, [job.id]: 'Save or discard the existing staged schedule before changing another job.' }));
        return;
      }
      if (!row.plannedStart || !row.plannedEnd) {
        setStates((current) => ({ ...current, [job.id]: 'error' }));
        setErrors((current) => ({ ...current, [job.id]: 'Both planned dates are required for a staged schedule change.' }));
        return;
      }
      onStageSchedule(job, row.plannedStart, row.plannedEnd);
      setStates((current) => ({ ...current, [job.id]: 'dirty' }));
      return;
    }

    const activeFields = savingFieldsRef.current[job.id] ?? new Set();
    if (activeFields.has(field)) return;
    activeFields.add(field);
    savingFieldsRef.current[job.id] = activeFields;

    setStates((current) => ({ ...current, [job.id]: 'saving' }));
    setErrors((current) => ({ ...current, [job.id]: '' }));

    try {
      const updated = await onUpdateJob(job.id, fieldUpdate(field, row));
      setRows((current) => ({ ...current, [job.id]: toRow(updated) }));
      setStates((current) => ({ ...current, [job.id]: 'saved' }));
      window.setTimeout(() => {
        setStates((current) =>
          current[job.id] === 'saved'
            ? { ...current, [job.id]: 'idle' }
            : current,
        );
      }, 1500);
    } catch (error) {
      setStates((current) => ({ ...current, [job.id]: 'error' }));
      setErrors((current) => ({
        ...current,
        [job.id]: error instanceof Error ? error.message : 'Unable to save job.',
      }));
    } finally {
      activeFields.delete(field);
    }
  }

  async function saveDraft() {
    const validationError = validateDraft(draft);
    if (validationError) {
      setDraftState('error');
      setDraftError(validationError);
      return;
    }

    setDraftState('saving');

    try {
      await onCreateJob(toNewJob(draft));
      setDraft(blankRow());
      setDraftState('idle');
      setDraftError('');
      setIsAdding(false);
    } catch (error) {
      setDraftState('error');
      setDraftError(error instanceof Error ? error.message : 'Unable to create job.');
    }
  }

  function renderCells(
    row: EditableRow,
    onChange: <K extends EditableField>(field: K, value: EditableRow[K]) => void,
    onBlur?: (field: EditableField) => void,
    nameRef?: RefObject<HTMLInputElement | null>,
    scheduleState?: 'staged' | 'locked',
    projectAttachmentIndicator?: ReactNode,
  ) {
    const blur = (field: EditableField) => () => onBlur?.(field);

    return (
      <>
        <td className={`${cellClass} sticky left-0 z-20 min-w-[105px]`}>
          <input value={row.jobNumber} onChange={(e) => onChange('jobNumber', e.target.value)} onBlur={blur('jobNumber')} onKeyDown={blurOnEnter} placeholder="Job #" className={`${inputClass} bg-white`} />
        </td>
        <td className={`${cellClass} sticky left-[105px] z-20 min-w-[215px]`}>
          <div className="relative bg-white">
            <input ref={nameRef} value={row.name} title={row.name} onChange={(e) => onChange('name', e.target.value)} onBlur={blur('name')} onKeyDown={blurOnEnter} placeholder="Project name *" className={`${inputClass} bg-white pr-16 font-semibold text-slate-950`} />
            {projectAttachmentIndicator}
          </div>
        </td>
        <td className={`${cellClass} min-w-[190px]`}><input value={row.customer} title={row.customer} onChange={(e) => onChange('customer', e.target.value)} onBlur={blur('customer')} onKeyDown={blurOnEnter} placeholder="Customer" className={inputClass} /></td>
        <td className={`${cellClass} min-w-[130px]`}><input value={row.estimateNumber} onChange={(e) => onChange('estimateNumber', e.target.value)} onBlur={blur('estimateNumber')} onKeyDown={blurOnEnter} placeholder="Estimate #" className={inputClass} /></td>
        <td className={`${cellClass} min-w-[140px]`}><input value={row.workOrderNumber} onChange={(e) => onChange('workOrderNumber', e.target.value)} onBlur={blur('workOrderNumber')} onKeyDown={blurOnEnter} placeholder="Work order #" className={inputClass} /></td>
        <td className={`${cellClass} min-w-[150px]`}><input type="date" value={row.depositDate} onChange={(e) => onChange('depositDate', e.target.value)} onBlur={blur('depositDate')} onKeyDown={blurOnEnter} className={inputClass} /></td>
        <td className={`${cellClass} min-w-[160px]`}><input type="date" value={row.requestedDeliveryDate} onChange={(e) => onChange('requestedDeliveryDate', e.target.value)} onBlur={blur('requestedDeliveryDate')} onKeyDown={blurOnEnter} className={inputClass} /></td>
        <td className={`${cellClass} min-w-[145px]`}><div className="relative"><input aria-label={scheduleState === 'staged' ? 'Proposed planned start date, unsaved' : undefined} disabled={scheduleState === 'locked'} type="date" value={row.plannedStart} onChange={(e) => onChange('plannedStart', e.target.value)} onBlur={blur('plannedStart')} onKeyDown={blurOnEnter} className={`${inputClass} ${scheduleState === 'staged' ? 'bg-amber-50 pr-14 ring-2 ring-inset ring-amber-400' : ''} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`} />{scheduleState === 'staged' && <span className="pointer-events-none absolute right-1 top-1 text-[8px] font-bold uppercase text-amber-800">Unsaved</span>}</div></td>
        <td className={`${cellClass} min-w-[145px]`}><div className="relative"><input aria-label={scheduleState === 'staged' ? 'Proposed planned finish date, unsaved' : undefined} disabled={scheduleState === 'locked'} type="date" value={row.plannedEnd} min={row.plannedStart || undefined} onChange={(e) => onChange('plannedEnd', e.target.value)} onBlur={blur('plannedEnd')} onKeyDown={blurOnEnter} className={`${inputClass} ${scheduleState === 'staged' ? 'bg-amber-50 pr-14 ring-2 ring-inset ring-amber-400' : ''} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`} />{scheduleState === 'staged' && <span className="pointer-events-none absolute right-1 top-1 text-[8px] font-bold uppercase text-amber-800">Unsaved</span>}</div></td>
        <td className={`${cellClass} min-w-[120px]`}><input type="number" min="0" step="0.25" value={row.estimatedManHours} onChange={(e) => onChange('estimatedManHours', e.target.value)} onBlur={blur('estimatedManHours')} onKeyDown={blurOnEnter} placeholder="Hours" className={inputClass} /></td>
        <td className={`${cellClass} min-w-[140px]`}><input type="number" min="0" step="1" value={row.estimatedCalendarDays} onChange={(e) => onChange('estimatedCalendarDays', e.target.value)} onBlur={blur('estimatedCalendarDays')} onKeyDown={blurOnEnter} placeholder="Days" className={inputClass} /></td>
        <td className={`${cellClass} min-w-[135px]`}><input value={row.colorPlateNumber} onChange={(e) => onChange('colorPlateNumber', e.target.value)} onBlur={blur('colorPlateNumber')} onKeyDown={blurOnEnter} placeholder="Color plate #" className={inputClass} /></td>
        <td className={`${cellClass} min-w-[150px]`}><input type="date" value={row.sampleSubmittedDate} onChange={(e) => onChange('sampleSubmittedDate', e.target.value)} onBlur={blur('sampleSubmittedDate')} onKeyDown={blurOnEnter} className={inputClass} /></td>
        <td className={`${cellClass} min-w-[145px]`}><input type="date" value={row.approvalDate} onChange={(e) => onChange('approvalDate', e.target.value)} onBlur={blur('approvalDate')} onKeyDown={blurOnEnter} className={inputClass} /></td>
        <td className={`${cellClass} min-w-[140px]`}>
          <select value={row.materialStatus} onChange={(e) => onChange('materialStatus', e.target.value as MaterialStatus)} onBlur={blur('materialStatus')} onKeyDown={blurOnEnter} className={selectClass}>
            {materialStatuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </td>
        <td className={`${cellClass} min-w-[155px]`}>
          <select value={row.productionStatus} onChange={(e) => onChange('productionStatus', e.target.value as ProductionStatus)} onBlur={blur('productionStatus')} onKeyDown={blurOnEnter} className={selectClass}>
            {productionStatuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </td>
        <td className={`${cellClass} min-w-[280px]`}>
          <textarea value={row.remarks} title={row.remarks} onChange={(e) => onChange('remarks', e.target.value)} onBlur={blur('remarks')} placeholder="Remarks" rows={1} className="min-h-8 w-full resize-y border-0 bg-transparent px-1.5 py-1.5 text-xs outline-none focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-600" />
        </td>
      </>
    );
  }

  return (
    <div className="overflow-hidden border border-slate-400 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.07)]">
      <div className="max-h-[68vh] overflow-auto">
        <table className="min-w-max border-separate border-spacing-0">
          <thead className="sticky top-0 z-30">
            <tr>
              <th className={`${headerClass} sticky left-0 z-40 min-w-[105px]`}>Job #</th>
              <th className={`${headerClass} sticky left-[105px] z-40 min-w-[215px]`}>Project</th>
              <th className={headerClass}>Customer</th>
              <th className={headerClass}>Estimate</th>
              <th tabIndex={0} title="Work Order Number" className={headerClass}>WO #</th>
              <th tabIndex={0} title="Deposit Received" className={headerClass}>Deposit</th>
              <th tabIndex={0} title="Requested Delivery Date" className={headerClass}>Delivery</th>
              <th tabIndex={0} title="Planned Production Start" className={headerClass}>Start</th>
              <th tabIndex={0} title="Planned Production Finish" className={headerClass}>Finish</th>
              <th tabIndex={0} title="Estimated Labor Hours" className={headerClass}>Labor</th>
              <th tabIndex={0} title="Estimated Calendar Days" className={headerClass}>Days</th>
              <th tabIndex={0} title="Color Plate Number" className={headerClass}>Color Plate</th>
              <th tabIndex={0} title="Sample Submitted Date" className={headerClass}>Sample</th>
              <th className={headerClass}>Approval</th>
              <th tabIndex={0} title="Material Readiness Status" className={headerClass}>Material</th>
              <th tabIndex={0} title="Production Status" className={headerClass}>Status</th>
              <th className={headerClass}>Remarks</th>
              <th className={`${headerClass} min-w-[115px]`}>Forms</th>
            </tr>
          </thead>

          <tbody>
            {jobs.map((job) => {
              const row = rows[job.id] ?? toRow(job);
              const state = states[job.id] ?? 'idle';
              const count = attachmentCounts[job.id] ?? 0;

              return (
                <tr
                  key={job.id}
                  tabIndex={0}
                  aria-selected={selectedJobId === job.id}
                  onClick={(event) => {
                    if (!(event.target as HTMLElement).closest('input, select, textarea, button, a')) onSelectJob(job);
                  }}
                  onKeyDown={(event) => {
                    if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
                      event.preventDefault();
                      onSelectJob(job);
                    }
                  }}
                  className={`odd:bg-white even:bg-slate-50/40 hover:bg-blue-50/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 ${selectedJobId === job.id ? 'bg-blue-50/70 ring-2 ring-inset ring-blue-600' : ''}`}
                >
                  {renderCells(
                    row,
                    (field, value) => changeRow(job, field, value),
                    (field) => void saveField(job, field),
                    undefined,
                    stagedSchedule?.jobId === job.id ? 'staged' : stagedSchedule ? 'locked' : undefined,
                    count > 0 ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenAttachments(job);
                        }}
                        aria-label={`View ${count} attached ${count === 1 ? 'file' : 'files'} for ${job.name}`}
                        title="View attached files"
                        className="absolute right-1 top-1/2 inline-flex h-6 -translate-y-1/2 items-center gap-1 border border-slate-300 bg-slate-50 px-1.5 text-[10px] font-bold text-slate-600 hover:border-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                      >
                        <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                        {count}
                      </button>
                    ) : undefined,
                  )}
                  <td className={`${cellClass} min-w-[115px] px-2 py-1.5`}>
                    <button type="button" onClick={() => onOpenForms(job)} className="inline-flex h-8 w-full items-center justify-center gap-1.5 border border-slate-400 bg-white px-2 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-700 hover:bg-slate-100">
                      <FileText className="h-3.5 w-3.5" />
                      Forms
                    </button>
                    <div className="mt-1 min-h-3 text-center"><StateLabel state={state} /></div>
                    {errors[job.id] && <div className="mt-1 max-w-[180px] text-xs font-semibold leading-4 text-red-700">{errors[job.id]}</div>}
                  </td>
                </tr>
              );
            })}

            {isAdding && (
              <tr className="bg-blue-50/40">
                {renderCells(draft, changeDraft, undefined, draftNameRef)}
                <td className={`${cellClass} min-w-[115px] px-2 py-1.5`}>
                  <button type="button" disabled className="inline-flex h-8 w-full items-center justify-center gap-1.5 border border-slate-300 bg-slate-100 px-2 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400"><FileText className="h-3.5 w-3.5" /> Save First</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-400 bg-slate-100 px-3 py-3">
        {!isAdding ? (
          <button type="button" onClick={() => { setDraft(blankRow()); setDraftState('idle'); setDraftError(''); setIsAdding(true); }} className="h-10 border border-dashed border-slate-500 bg-white px-5 text-xs font-bold uppercase tracking-[0.08em] text-slate-700 hover:border-slate-950 hover:bg-slate-50">
            + Add Job
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void saveDraft()} disabled={draftState === 'saving'} className="h-9 border border-blue-900 bg-blue-900 px-4 text-[10px] font-bold uppercase tracking-[0.07em] text-white disabled:opacity-50">
              {draftState === 'saving' ? 'Saving…' : 'Save New Job'}
            </button>
            <button type="button" onClick={() => { setDraft(blankRow()); setDraftState('idle'); setDraftError(''); setIsAdding(false); }} disabled={draftState === 'saving'} className="h-9 border border-slate-300 bg-white px-3 text-[10px] font-bold uppercase tracking-[0.07em] text-slate-600">
              Cancel
            </button>
            <StateLabel state={draftState} />
            {draftError && <span className="text-xs font-semibold text-red-700">{draftError}</span>}
          </div>
        )}
      </div>

      {jobs.length === 0 && !isAdding && (
        <div className="flex min-h-40 items-center justify-center border-t border-slate-300 px-6 py-8 text-center">
          <div>
            <div className="text-lg font-bold text-slate-900">Production queue is empty</div>
            <div className="mt-2 text-sm text-slate-600">Use Add Job at the bottom of the table to create the first active job.</div>
          </div>
        </div>
      )}
    </div>
  );
}
