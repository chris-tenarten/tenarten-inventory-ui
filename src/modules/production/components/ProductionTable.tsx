'use client';

import { Paperclip, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { KeyboardEvent, ReactNode, RefObject } from 'react';

import type { ProductionJobUpdate } from '../jobs';
import { materialStatusLabel, materialStatusOptions } from '../material-status';
import type { StagedSchedules } from '../schedule-staging';
import type {
  MaterialStatus,
  NewProductionJob,
  ProductionJob,
  ProductionStatus,
} from '../types';
import { productionValuesEqual } from '../update-normalization';

type Props = {
  jobs: ProductionJob[];
  attachmentCounts: Record<string, number>;
  onCreateJob: (input: NewProductionJob) => Promise<ProductionJob>;
  onUpdateJob: (
    jobId: string,
    changes: ProductionJobUpdate,
  ) => Promise<ProductionJob>;
  onOpenAttachments: (job: ProductionJob) => void;
  stagedSchedules: StagedSchedules;
  onStageSchedule: (job: ProductionJob, start: string, end: string) => void;
  selectedJobId: string | null;
  onSelectJob: (job: ProductionJob, focus?: string) => void;
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
type SaveFeedback = { field: string; oldValue: string; newValue: string };
type RemarksEditor = {
  job: ProductionJob;
  anchor: HTMLButtonElement;
  canonical: string;
  draft: string;
};

const fieldLabels: Record<EditableField, string> = {
  name: 'Project', customer: 'Customer', jobNumber: 'Job number', estimateNumber: 'Estimate number',
  workOrderNumber: 'Work order', depositDate: 'Deposit date', requestedDeliveryDate: 'Requested delivery',
  plannedStart: 'Planned start', plannedEnd: 'Planned finish', estimatedManHours: 'Labor estimate',
  estimatedCalendarDays: 'Calendar days', colorPlateNumber: 'Color plate', sampleSubmittedDate: 'Sample submitted',
  approvalDate: 'Approval date', materialStatus: 'Material status', productionStatus: 'Production status', remarks: 'Remarks',
};

function feedbackValue(field: EditableField, value: unknown) {
  if (value === null || value === undefined || value === '') return 'Blank';
  if (field === 'materialStatus') return materialStatusLabel(value);
  if (field === 'productionStatus') return productionStatuses.find((status) => status.value === value)?.label ?? String(value);
  if (['depositDate', 'requestedDeliveryDate', 'plannedStart', 'plannedEnd', 'sampleSubmittedDate', 'approvalDate'].includes(field)) {
    const date = new Date(`${String(value)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (field === 'estimatedManHours') return `${value} hours`;
  return String(value);
}

const productionStatuses: Array<{ value: ProductionStatus; label: string }> = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'on_deck', label: 'On Deck' },
  { value: 'in_production', label: 'In Production' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'complete', label: 'Complete' },
  { value: 'cancelled', label: 'Cancelled' },
];

const headerClass =
  'h-6 whitespace-nowrap border-b border-r border-slate-300 bg-slate-200/70 px-0.5 py-1 text-center text-[8px] font-bold uppercase tracking-[0.07em] text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600';
const cellClass = 'border-b border-r border-slate-200 bg-white p-0 align-top transition-colors group-hover:bg-slate-50';
const inputClass =
  'h-6 w-full min-w-0 truncate border-0 bg-transparent px-0.5 text-[10px] leading-6 text-slate-800 outline-none focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-600 [&[type=number]]:text-right';
const selectClass = `${inputClass} pr-6 text-center`;
const dateInputClass = `${inputClass} relative cursor-pointer px-1 text-center [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-1 [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer`;
const populatedDateClass = '[&::-webkit-calendar-picker-indicator]:opacity-0 hover:[&::-webkit-calendar-picker-indicator]:opacity-60 focus:[&::-webkit-calendar-picker-indicator]:opacity-60';
const emptyDateClass = 'text-transparent [&::-webkit-datetime-edit]:text-transparent [&::-webkit-calendar-picker-indicator]:opacity-50 focus:text-slate-800 focus:[&::-webkit-datetime-edit]:text-slate-800';
const tableColumns = [
  ['inspector', 28], ['jobNumber', 74], ['project', 150], ['customer', 120],
  ['estimate', 108], ['workOrder', 112], ['deposit', 96], ['delivery', 96],
  ['start', 96], ['finish', 96], ['labor', 68], ['days', 60], ['colorPlate', 96],
  ['sample', 96], ['approval', 96], ['material', 96], ['status', 108], ['remarks', 150],
] as const;
const tableWidth = tableColumns.reduce((total, [, width]) => total + width, 0);
const jobNumberStickyLeft = tableColumns[0][1];
const projectStickyLeft = jobNumberStickyLeft + tableColumns[1][1];

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

type NonScheduleEditableField = Exclude<EditableField, 'plannedStart' | 'plannedEnd'>;

function fieldUpdate(
  field: NonScheduleEditableField,
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
    dirty: 'Editing',
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
  stagedSchedules,
  onStageSchedule,
  selectedJobId,
  onSelectJob,
}: Props) {
  const [rows, setRows] = useState<Record<string, EditableRow>>({});
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, SaveFeedback | undefined>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState<EditableRow>(blankRow);
  const [draftState, setDraftState] = useState<SaveState>('idle');
  const [draftError, setDraftError] = useState('');
  const [remarksEditor, setRemarksEditor] = useState<RemarksEditor | null>(null);
  const [remarksPosition, setRemarksPosition] = useState({ left: 12, top: 12, width: 420 });
  const [remarksSaving, setRemarksSaving] = useState(false);
  const [remarksError, setRemarksError] = useState('');
  const draftNameRef = useRef<HTMLInputElement | null>(null);
  const remarksPanelRef = useRef<HTMLDivElement | null>(null);
  const remarksTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const savingFieldsRef = useRef<Record<string, Set<EditableField>>>({});

  const remarksDirty = Boolean(remarksEditor && remarksEditor.draft !== remarksEditor.canonical);
  const remarksAnchor = remarksEditor?.anchor ?? null;

  useEffect(() => {
    setRows((current) => {
      const next = { ...current };
      for (const job of jobs) {
        if (states[job.id] !== 'dirty' && states[job.id] !== 'saving' && states[job.id] !== 'error') {
          next[job.id] = toRow(job);
        }
      }
      return next;
    });
  }, [jobs, states]);

  useEffect(() => {
    if (isAdding) requestAnimationFrame(() => draftNameRef.current?.focus());
  }, [isAdding]);

  useEffect(() => {
    if (!remarksAnchor) return;

    function positionEditor() {
      const rect = remarksAnchor!.getBoundingClientRect();
      const width = Math.min(420, window.innerWidth - 24);
      const estimatedHeight = 214;
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
      const below = rect.bottom + 6;
      const top = below + estimatedHeight <= window.innerHeight
        ? below
        : Math.max(12, rect.top - estimatedHeight - 6);
      setRemarksPosition({ left, top, width });
    }

    positionEditor();
    requestAnimationFrame(() => remarksTextareaRef.current?.focus());
    window.addEventListener('resize', positionEditor);
    document.addEventListener('scroll', positionEditor, true);
    return () => {
      window.removeEventListener('resize', positionEditor);
      document.removeEventListener('scroll', positionEditor, true);
    };
  }, [remarksAnchor]);

  useEffect(() => {
    if (!remarksEditor) return;

    function handleOutsidePointer(event: PointerEvent) {
      const target = event.target as Node;
      if (remarksPanelRef.current?.contains(target) || remarksEditor!.anchor.contains(target)) return;
      if (remarksEditor!.draft !== remarksEditor!.canonical) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const anchor = remarksEditor!.anchor;
      setRemarksEditor(null);
      requestAnimationFrame(() => anchor.focus());
    }

    document.addEventListener('pointerdown', handleOutsidePointer, true);
    return () => document.removeEventListener('pointerdown', handleOutsidePointer, true);
  }, [remarksEditor]);

  useEffect(() => {
    if (!remarksDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [remarksDirty]);

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
      if (!row.plannedStart || !row.plannedEnd) {
        setStates((current) => ({ ...current, [job.id]: 'error' }));
        setErrors((current) => ({ ...current, [job.id]: 'Both planned dates are required for a staged schedule change.' }));
        return;
      }
      onStageSchedule(job, row.plannedStart, row.plannedEnd);
      setStates((current) => ({ ...current, [job.id]: 'dirty' }));
      return;
    }

    const changes = fieldUpdate(field, row);
    const [changedField, normalizedValue] = Object.entries(changes)[0] as [keyof ProductionJob, unknown];
    if (productionValuesEqual(changedField, job[changedField], normalizedValue)) {
      setRows((current) => ({ ...current, [job.id]: toRow(job) }));
      setStates((current) => ({ ...current, [job.id]: 'idle' }));
      return;
    }
    if (changedField === 'estimated_man_hours' && job.estimated_man_hours !== null && normalizedValue === null) {
      const confirmed = window.confirm('Clear labor estimate?\n\nThis removes the current estimate. You can enter a new one later.');
      if (!confirmed) {
        setRows((current) => ({ ...current, [job.id]: toRow(job) }));
        setStates((current) => ({ ...current, [job.id]: 'idle' }));
        return;
      }
    }

    const activeFields = savingFieldsRef.current[job.id] ?? new Set();
    if (activeFields.has(field)) return;
    activeFields.add(field);
    savingFieldsRef.current[job.id] = activeFields;

    setStates((current) => ({ ...current, [job.id]: 'saving' }));
    setErrors((current) => ({ ...current, [job.id]: '' }));
    const saveFeedback = { field: fieldLabels[field], oldValue: feedbackValue(field, job[changedField]), newValue: feedbackValue(field, normalizedValue) };
    setFeedback((current) => ({ ...current, [job.id]: saveFeedback }));

    try {
      const updated = await onUpdateJob(job.id, changes);
      setRows((current) => ({ ...current, [job.id]: toRow(updated) }));
      setStates((current) => ({ ...current, [job.id]: 'saved' }));
      window.setTimeout(() => {
        setStates((current) =>
          current[job.id] === 'saved'
            ? { ...current, [job.id]: 'idle' }
            : current,
        );
        setFeedback((current) => current[job.id] === saveFeedback ? { ...current, [job.id]: undefined } : current);
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

  function closeRemarksEditor() {
    if (!remarksEditor) return;
    const anchor = remarksEditor.anchor;
    setRemarksEditor(null);
    setRemarksError('');
    requestAnimationFrame(() => anchor.focus());
  }

  function openRemarksEditor(job: ProductionJob, anchor: HTMLButtonElement) {
    if (remarksEditor?.job.id === job.id) return;
    if (remarksDirty) return;
    const canonical = job.remarks ?? '';
    setRemarksError('');
    setRemarksEditor({ job, anchor, canonical, draft: canonical });
  }

  async function saveRemarks() {
    if (!remarksEditor || remarksSaving) return;
    const normalized = remarksEditor.draft.trim() || null;
    const { job, anchor } = remarksEditor;

    if (productionValuesEqual('remarks', job.remarks, normalized)) {
      closeRemarksEditor();
      return;
    }

    setRemarksSaving(true);
    setRemarksError('');
    setStates((current) => ({ ...current, [job.id]: 'saving' }));
    const saveFeedback = {
      field: fieldLabels.remarks,
      oldValue: feedbackValue('remarks', job.remarks),
      newValue: feedbackValue('remarks', normalized),
    };
    setFeedback((current) => ({ ...current, [job.id]: saveFeedback }));

    try {
      const updated = await onUpdateJob(job.id, { remarks: normalized });
      setRows((current) => ({ ...current, [job.id]: toRow(updated) }));
      setStates((current) => ({ ...current, [job.id]: 'saved' }));
      setRemarksEditor(null);
      requestAnimationFrame(() => anchor.focus());
      window.setTimeout(() => {
        setStates((current) => current[job.id] === 'saved' ? { ...current, [job.id]: 'idle' } : current);
        setFeedback((current) => current[job.id] === saveFeedback ? { ...current, [job.id]: undefined } : current);
      }, 1500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save remarks.';
      setStates((current) => ({ ...current, [job.id]: 'error' }));
      setErrors((current) => ({ ...current, [job.id]: message }));
      setRemarksError(message);
    } finally {
      setRemarksSaving(false);
    }
  }

  function renderCells(
    row: EditableRow,
    onChange: <K extends EditableField>(field: K, value: EditableRow[K]) => void,
    onBlur?: (field: EditableField) => void,
    nameRef?: RefObject<HTMLInputElement | null>,
    scheduleState?: 'staged' | 'locked',
    projectAttachmentIndicator?: ReactNode,
    historyAction?: ReactNode,
    remarksControl?: ReactNode,
  ) {
    const blur = (field: EditableField) => () => onBlur?.(field);

    return (
      <>
        <td className={`${cellClass} sticky left-0 z-30 h-6 bg-slate-50 text-center group-hover:bg-blue-50`}>
          {historyAction}
        </td>
        <td className={`${cellClass} sticky z-20`} style={{ left: jobNumberStickyLeft }}>
          <input value={row.jobNumber} title={row.jobNumber || undefined} onChange={(e) => onChange('jobNumber', e.target.value)} onBlur={blur('jobNumber')} onKeyDown={blurOnEnter} placeholder="Job #" className={`${inputClass} bg-white`} />
        </td>
        <td className={`${cellClass} sticky z-20`} style={{ left: projectStickyLeft }}>
          <div className="relative bg-white">
            <input ref={nameRef} value={row.name} title={row.name} onChange={(e) => onChange('name', e.target.value)} onBlur={blur('name')} onKeyDown={blurOnEnter} placeholder="Project name *" className={`${inputClass} bg-white pr-16 font-semibold text-slate-950`} />
            {projectAttachmentIndicator && <div className="absolute right-1 top-1/2 z-10 -translate-y-1/2">{projectAttachmentIndicator}</div>}
          </div>
        </td>
        <td className={`${cellClass} w-[120px] min-w-[120px] max-w-[120px]`}><input value={row.customer} title={row.customer || undefined} onChange={(e) => onChange('customer', e.target.value)} onBlur={blur('customer')} onKeyDown={blurOnEnter} placeholder="Customer" className={inputClass} /></td>
        <td className={`${cellClass} w-[108px] min-w-[108px] max-w-[108px]`}><input value={row.estimateNumber} title={row.estimateNumber || undefined} onChange={(e) => onChange('estimateNumber', e.target.value)} onBlur={blur('estimateNumber')} onKeyDown={blurOnEnter} placeholder="Estimate #" className={inputClass} /></td>
        <td className={`${cellClass} w-[112px] min-w-[112px] max-w-[112px]`}><input value={row.workOrderNumber} title={row.workOrderNumber || undefined} onChange={(e) => onChange('workOrderNumber', e.target.value)} onBlur={blur('workOrderNumber')} onKeyDown={blurOnEnter} placeholder="Work order #" className={inputClass} /></td>
        <td className={`${cellClass} w-[96px] min-w-[96px] max-w-[96px]`}><input aria-label="Deposit date" title={row.depositDate || undefined} type="date" value={row.depositDate} onChange={(e) => onChange('depositDate', e.target.value)} onBlur={blur('depositDate')} onKeyDown={blurOnEnter} className={`${dateInputClass} ${row.depositDate ? populatedDateClass : emptyDateClass}`} /></td>
        <td className={`${cellClass} w-[96px] min-w-[96px] max-w-[96px]`}><input aria-label="Requested delivery date" title={row.requestedDeliveryDate || undefined} type="date" value={row.requestedDeliveryDate} onChange={(e) => onChange('requestedDeliveryDate', e.target.value)} onBlur={blur('requestedDeliveryDate')} onKeyDown={blurOnEnter} className={`${dateInputClass} ${row.requestedDeliveryDate ? populatedDateClass : emptyDateClass}`} /></td>
        <td className={`${cellClass} w-[96px] min-w-[96px] max-w-[96px]`}><div className="relative"><input aria-label={scheduleState === 'staged' ? 'Proposed planned start date, unsaved' : 'Planned start date'} title={row.plannedStart || undefined} disabled={scheduleState === 'locked'} type="date" value={row.plannedStart} onChange={(e) => onChange('plannedStart', e.target.value)} onBlur={blur('plannedStart')} onKeyDown={blurOnEnter} className={`${dateInputClass} ${row.plannedStart ? populatedDateClass : emptyDateClass} ${scheduleState === 'staged' ? 'bg-amber-50 pr-10 ring-2 ring-inset ring-amber-400' : ''} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`} />{scheduleState === 'staged' && <span className="pointer-events-none absolute right-1 top-0.5 text-[7px] font-bold uppercase text-amber-800">Unsaved</span>}</div></td>
        <td className={`${cellClass} w-[96px] min-w-[96px] max-w-[96px]`}><div className="relative"><input aria-label={scheduleState === 'staged' ? 'Proposed planned finish date, unsaved' : 'Planned finish date'} title={row.plannedEnd || undefined} disabled={scheduleState === 'locked'} type="date" value={row.plannedEnd} min={row.plannedStart || undefined} onChange={(e) => onChange('plannedEnd', e.target.value)} onBlur={blur('plannedEnd')} onKeyDown={blurOnEnter} className={`${dateInputClass} ${row.plannedEnd ? populatedDateClass : emptyDateClass} ${scheduleState === 'staged' ? 'bg-amber-50 pr-10 ring-2 ring-inset ring-amber-400' : ''} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`} />{scheduleState === 'staged' && <span className="pointer-events-none absolute right-1 top-0.5 text-[7px] font-bold uppercase text-amber-800">Unsaved</span>}</div></td>
        <td className={`${cellClass} w-[68px] min-w-[68px] max-w-[68px]`}><input type="number" min="0" step="0.25" value={row.estimatedManHours} onChange={(e) => onChange('estimatedManHours', e.target.value)} onBlur={blur('estimatedManHours')} onKeyDown={blurOnEnter} placeholder="Hours" className={inputClass} /></td>
        <td className={`${cellClass} w-[60px] min-w-[60px] max-w-[60px]`}><input type="number" min="0" step="1" value={row.estimatedCalendarDays} onChange={(e) => onChange('estimatedCalendarDays', e.target.value)} onBlur={blur('estimatedCalendarDays')} onKeyDown={blurOnEnter} placeholder="Days" className={inputClass} /></td>
        <td className={`${cellClass} w-[96px] min-w-[96px] max-w-[96px]`}><input value={row.colorPlateNumber} title={row.colorPlateNumber || undefined} onChange={(e) => onChange('colorPlateNumber', e.target.value)} onBlur={blur('colorPlateNumber')} onKeyDown={blurOnEnter} placeholder="Color plate #" className={inputClass} /></td>
        <td className={`${cellClass} w-[96px] min-w-[96px] max-w-[96px]`}><input aria-label="Sample submitted date" title={row.sampleSubmittedDate || undefined} type="date" value={row.sampleSubmittedDate} onChange={(e) => onChange('sampleSubmittedDate', e.target.value)} onBlur={blur('sampleSubmittedDate')} onKeyDown={blurOnEnter} className={`${dateInputClass} ${row.sampleSubmittedDate ? populatedDateClass : emptyDateClass}`} /></td>
        <td className={`${cellClass} w-[96px] min-w-[96px] max-w-[96px]`}><input aria-label="Approval date" title={row.approvalDate || undefined} type="date" value={row.approvalDate} onChange={(e) => onChange('approvalDate', e.target.value)} onBlur={blur('approvalDate')} onKeyDown={blurOnEnter} className={`${dateInputClass} ${row.approvalDate ? populatedDateClass : emptyDateClass}`} /></td>
        <td className={`${cellClass} w-[96px] min-w-[96px] max-w-[96px]`}>
          <select value={row.materialStatus} onChange={(e) => onChange('materialStatus', e.target.value as MaterialStatus)} onBlur={blur('materialStatus')} onKeyDown={blurOnEnter} className={selectClass}>
            {materialStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </td>
        <td className={`${cellClass} w-[108px] min-w-[108px] max-w-[108px]`}>
          <select value={row.productionStatus} onChange={(e) => onChange('productionStatus', e.target.value as ProductionStatus)} onBlur={blur('productionStatus')} onKeyDown={blurOnEnter} className={selectClass}>
            {productionStatuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </td>
        <td className={`${cellClass} w-[150px] min-w-[150px] max-w-[150px]`}>
          {remarksControl ?? <textarea value={row.remarks} title={row.remarks || undefined} onChange={(e) => onChange('remarks', e.target.value)} onBlur={blur('remarks')} placeholder="Remarks" rows={1} wrap="off" className="h-6 w-full min-w-0 resize-none overflow-hidden whitespace-nowrap border-0 bg-transparent px-0.5 py-0 text-[10px] leading-6 outline-none focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-600" />}
        </td>
      </>
    );
  }

  return (
    <>
    <div className="overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
      <div className="max-h-[68vh] overflow-auto">
        <table className="table-fixed border-separate border-spacing-0" style={{ width: tableWidth }}>
          <colgroup>
            {tableColumns.map(([name, width]) => <col key={name} style={{ width }} />)}
          </colgroup>
          <thead className="sticky top-0 z-30">
            <tr>
              <th title="Inspect job actions" aria-label="Inspect job actions" className={`${headerClass} sticky left-0 z-50 px-0`}><Search className="mx-auto h-3 w-3" aria-hidden="true" /></th>
              <th className={`${headerClass} sticky z-40`} style={{ left: jobNumberStickyLeft }}>Job #</th>
              <th className={`${headerClass} sticky z-40`} style={{ left: projectStickyLeft }}>Project</th>
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
                  aria-selected={selectedJobId === job.id}
                  className={`group relative h-6 odd:bg-white even:bg-slate-50/40 hover:bg-blue-50/30 ${selectedJobId === job.id ? 'bg-blue-50/70 ring-2 ring-inset ring-blue-600' : ''}`}
                >
                  {renderCells(
                    row,
                    (field, value) => changeRow(job, field, value),
                    (field) => void saveField(job, field),
                    undefined,
                    stagedSchedules[job.id] ? 'staged' : undefined,
                    count > 0 ? <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenAttachments(job);
                        }}
                        aria-label={`View ${count} attached ${count === 1 ? 'file' : 'files'} for ${job.name}`}
                        title="View attached files"
                        className="inline-flex h-6 items-center gap-1 border border-slate-300 bg-slate-50 px-1.5 text-[10px] font-bold text-slate-600 hover:border-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                      >
                        <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                        {count}
                      </button> : undefined,
                    <div className="relative flex h-6 items-center justify-center">
                      <button type="button" onClick={(event) => { event.stopPropagation(); onSelectJob(job); }} aria-label="Inspect job" title={`Inspect ${job.job_number ? `${job.job_number} — ` : ''}${job.name}`} className={`inline-flex h-6 w-6 items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 group-hover:text-slate-700 ${selectedJobId === job.id ? 'text-blue-700' : ''}`}><Search className="h-3.5 w-3.5" aria-hidden="true" /></button>
                      {(state === 'saving' || state === 'saved' || state === 'error') && (() => {
                        const transition = feedback[job.id] ? `${feedback[job.id]!.field}: ${feedback[job.id]!.oldValue} → ${feedback[job.id]!.newValue}` : '';
                        const message = state === 'saving' ? `Saving…${transition ? ` · ${transition}` : ''}` : state === 'saved' ? `Saved · ${transition}` : `Could not save${transition ? ` · ${transition}` : ''}${errors[job.id] ? ` · ${errors[job.id]}` : ''}`;
                        return <div role="status" aria-live="polite" aria-label={message} title={message} className={`pointer-events-none absolute left-[38px] top-full z-[60] h-7 w-80 truncate border px-2 text-left text-[10px] font-bold leading-7 shadow-md ${state === 'error' ? 'border-red-400 bg-red-50 text-red-800' : state === 'saved' ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-blue-400 bg-blue-50 text-blue-800'}`}>{message}</div>;
                      })()}
                    </div>,
                    <button
                      type="button"
                      title={row.remarks || undefined}
                      aria-label={`Edit remarks for ${job.job_number ? `${job.job_number}, ` : ''}${job.name}`}
                      aria-haspopup="dialog"
                      aria-expanded={remarksEditor?.job.id === job.id}
                      onClick={(event) => openRemarksEditor(job, event.currentTarget)}
                      className={`block h-6 w-full min-w-0 truncate px-0.5 text-left text-[10px] leading-6 outline-none focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-600 ${row.remarks ? 'text-slate-800' : 'italic text-slate-400'}`}
                    >
                      {row.remarks || 'Add remarks…'}
                    </button>,
                  )}
                </tr>
              );
            })}

            {isAdding && (
              <tr className="bg-blue-50/40">
                {renderCells(draft, changeDraft, undefined, draftNameRef, undefined, undefined, <span className="block h-6 w-[28px]" />)}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-3 py-3">
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
    {remarksEditor && createPortal(
      <div
        ref={remarksPanelRef}
        role="dialog"
        aria-label={`Edit remarks for ${remarksEditor.job.job_number ? `${remarksEditor.job.job_number}, ` : ''}${remarksEditor.job.name}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !remarksSaving) {
            event.preventDefault();
            closeRemarksEditor();
          }
        }}
        className="fixed z-[120] rounded-sm border border-slate-300 bg-white p-3 shadow-[0_14px_34px_rgba(15,23,42,0.2)]"
        style={{ left: remarksPosition.left, top: remarksPosition.top, width: remarksPosition.width }}
      >
        <label htmlFor="production-table-remarks-editor" className="block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600">
          Remarks · {remarksEditor.job.job_number || remarksEditor.job.name}
        </label>
        <textarea
          ref={remarksTextareaRef}
          id="production-table-remarks-editor"
          value={remarksEditor.draft}
          onChange={(event) => {
            setRemarksEditor((current) => current ? { ...current, draft: event.target.value } : current);
            setRemarksError('');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void saveRemarks();
            }
          }}
          rows={7}
          disabled={remarksSaving}
          className="mt-2 h-36 w-full resize-none rounded-sm border border-slate-300 px-2.5 py-2 text-sm leading-5 text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
        />
        {remarksError && <div role="alert" className="mt-2 border-l-2 border-red-600 bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-800">Could not save: {remarksError}</div>}
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[10px] text-slate-500">Ctrl/Cmd+Enter to save · Esc to cancel</span>
          <div className="flex gap-2">
            <button type="button" onClick={closeRemarksEditor} disabled={remarksSaving} className="h-8 rounded-sm border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50">Cancel</button>
            <button type="button" onClick={() => void saveRemarks()} disabled={remarksSaving} className="h-8 rounded-sm border border-slate-950 bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-950 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50">{remarksSaving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>,
      document.body,
    )}
    </>
  );
}
