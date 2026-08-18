'use client';

import { ArrowDown, ArrowUp, ChevronsLeftRight, Paperclip, Search, Settings2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';

import { EMPTY_JOB_UPDATE_SUMMARY, type JobUpdateSummary, type ProductionIntegrationSummary, type ProductionJobUpdate } from '../jobs';
import { materialStatusLabel, materialStatusOptions } from '../material-status';
import type { StagedSchedules } from '../schedule-staging';
import type {
  MaterialStatus,
  ProductionJob,
  ProductionStatus,
} from '../types';
import { productionValuesEqual } from '../update-normalization';
import JobUpdatesIndicator from './JobUpdatesIndicator';
import UnscheduledBadge from './UnscheduledBadge';
import ReworkBadge from './ReworkBadge';
import ReworkQuickAction from './ReworkQuickAction';

const formatHours = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);

type Props = {
  jobs: ProductionJob[];
  attachmentCounts: Record<string, number>;
  integrationSummaries: Record<string, ProductionIntegrationSummary>;
  jobUpdateSummaries: Record<string, JobUpdateSummary>;
  onUpdateJob: (
    jobId: string,
    changes: ProductionJobUpdate,
  ) => Promise<ProductionJob>;
  onOpenAttachments: (job: ProductionJob) => void;
  onCreateRework: (job: ProductionJob) => void;
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
const TABLE_LAYOUT_STORAGE_KEY = 'tenops.productionTableLayout.v2';

const tableColumns = [
  { id: 'inspector', label: 'Inspector', defaultWidth: 28, minWidth: 28, maxWidth: 28, hideable: false, resizable: false },
  { id: 'jobNumber', label: 'Job #', defaultWidth: 74, minWidth: 60, maxWidth: 160, hideable: false, resizable: true },
  { id: 'project', label: 'Project', defaultWidth: 150, minWidth: 110, maxWidth: 360, hideable: false, resizable: true },
  { id: 'customer', label: 'Customer', defaultWidth: 120, minWidth: 90, maxWidth: 300, hideable: true, resizable: true },
  { id: 'estimate', label: 'Estimate', defaultWidth: 108, minWidth: 80, maxWidth: 220, hideable: true, resizable: true },
  { id: 'workOrder', label: 'Work Order', defaultWidth: 112, minWidth: 86, maxWidth: 280, hideable: true, resizable: true },
  { id: 'deposit', label: 'Deposit', defaultWidth: 96, minWidth: 88, maxWidth: 160, hideable: true, resizable: true },
  { id: 'delivery', label: 'Delivery', defaultWidth: 96, minWidth: 88, maxWidth: 160, hideable: true, resizable: true },
  { id: 'start', label: 'Planned Start', defaultWidth: 96, minWidth: 88, maxWidth: 160, hideable: true, resizable: true },
  { id: 'finish', label: 'Planned Finish', defaultWidth: 96, minWidth: 88, maxWidth: 160, hideable: true, resizable: true },
  { id: 'labor', label: 'Labor', defaultWidth: 68, minWidth: 56, maxWidth: 120, hideable: true, resizable: true },
  { id: 'days', label: 'Calendar Days', defaultWidth: 60, minWidth: 56, maxWidth: 120, hideable: true, resizable: true },
  { id: 'colorPlate', label: 'Color Plate', defaultWidth: 96, minWidth: 78, maxWidth: 220, hideable: true, resizable: true },
  { id: 'sample', label: 'Sample', defaultWidth: 96, minWidth: 88, maxWidth: 160, hideable: true, resizable: true },
  { id: 'approval', label: 'Approval', defaultWidth: 96, minWidth: 88, maxWidth: 160, hideable: true, resizable: true },
  { id: 'operations', label: 'Operations', defaultWidth: 230, minWidth: 180, maxWidth: 360, hideable: true, resizable: true },
  { id: 'material', label: 'Material Status', defaultWidth: 96, minWidth: 90, maxWidth: 200, hideable: true, resizable: true },
  { id: 'status', label: 'Production Status', defaultWidth: 108, minWidth: 96, maxWidth: 220, hideable: true, resizable: true },
  { id: 'remarks', label: 'Remarks', defaultWidth: 150, minWidth: 110, maxWidth: 420, hideable: true, resizable: true },
] as const;

type TableColumn = (typeof tableColumns)[number];
type TableColumnId = TableColumn['id'];
type SortableTableColumnId = Exclude<TableColumnId, 'inspector' | 'operations'>;
type TableSort = { column: SortableTableColumnId; direction: 'ascending' | 'descending' };
type TableLayout = {
  widths: Partial<Record<TableColumnId, number>>;
  hidden: TableColumnId[];
};

const tableColumnById = Object.fromEntries(tableColumns.map((column) => [column.id, column])) as Record<TableColumnId, TableColumn>;
const defaultTableLayout: TableLayout = { widths: {}, hidden: ['operations'] };
const tableSortCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const materialSortOrder = new Map(materialStatusOptions.map((option, index) => [option.value, index]));
const productionSortOrder = new Map(productionStatuses.map((option, index) => [option.value, index]));

function tableSortValue(job: ProductionJob, column: SortableTableColumnId): string | number | null {
  switch (column) {
    case 'jobNumber': return job.job_number;
    case 'project': return job.name;
    case 'customer': return job.customer;
    case 'estimate': return job.estimate_number;
    case 'workOrder': return job.work_order_number;
    case 'deposit': return job.deposit_date;
    case 'delivery': return job.requested_delivery_date;
    case 'start': return job.planned_start;
    case 'finish': return job.planned_end;
    case 'labor': return job.estimated_man_hours;
    case 'days': return job.estimated_calendar_days;
    case 'colorPlate': return job.color_plate_number;
    case 'sample': return job.sample_submitted_date;
    case 'approval': return job.approval_date;
    case 'material': return materialSortOrder.get(job.material_status) ?? null;
    case 'status': return productionSortOrder.get(job.production_status) ?? null;
    case 'remarks': return job.remarks;
  }
}

function compareTableSortValues(first: string | number | null, second: string | number | null, direction: TableSort['direction']) {
  const firstBlank = first === null || first === '';
  const secondBlank = second === null || second === '';
  if (firstBlank || secondBlank) {
    if (firstBlank && secondBlank) return 0;
    return firstBlank ? 1 : -1;
  }
  const comparison = typeof first === 'number' && typeof second === 'number'
    ? first - second
    : tableSortCollator.compare(String(first), String(second));
  return direction === 'ascending' ? comparison : -comparison;
}

function clampColumnWidth(column: TableColumn, width: number) {
  return Math.min(column.maxWidth, Math.max(column.minWidth, Math.round(width)));
}

function parseStoredTableLayout(value: string | null): TableLayout {
  if (!value) return defaultTableLayout;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaultTableLayout;
    const candidate = parsed as { widths?: unknown; hidden?: unknown };
    const widths: TableLayout['widths'] = {};
    if (candidate.widths && typeof candidate.widths === 'object' && !Array.isArray(candidate.widths)) {
      for (const [id, width] of Object.entries(candidate.widths)) {
        if (!(id in tableColumnById) || typeof width !== 'number' || !Number.isFinite(width)) continue;
        const column = tableColumnById[id as TableColumnId];
        if (!column.resizable) continue;
        widths[column.id] = clampColumnWidth(column, width);
      }
    }
    const hidden = Array.isArray(candidate.hidden)
      ? candidate.hidden.filter((id): id is TableColumnId => typeof id === 'string' && id in tableColumnById && tableColumnById[id as TableColumnId].hideable)
      : [];
    return { widths, hidden: [...new Set(hidden)] };
  } catch {
    return defaultTableLayout;
  }
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

function blurOnEnter(event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) {
  if (event.key === 'Enter') {
    event.preventDefault();
    event.currentTarget.blur();
  }
}

export default function ProductionTable({
  jobs,
  attachmentCounts,
  integrationSummaries,
  jobUpdateSummaries,
  onUpdateJob,
  onOpenAttachments,
  onCreateRework,
  stagedSchedules,
  onStageSchedule,
  selectedJobId,
  onSelectJob,
}: Props) {
  const [rows, setRows] = useState<Record<string, EditableRow>>({});
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, SaveFeedback | undefined>>({});
  const [remarksEditor, setRemarksEditor] = useState<RemarksEditor | null>(null);
  const [remarksPosition, setRemarksPosition] = useState({ left: 12, top: 12, width: 420 });
  const [remarksSaving, setRemarksSaving] = useState(false);
  const [remarksError, setRemarksError] = useState('');
  const [tableLayout, setTableLayout] = useState<TableLayout>(defaultTableLayout);
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columnsToolbarTarget, setColumnsToolbarTarget] = useState<HTMLElement | null>(null);
  const [layoutMessage, setLayoutMessage] = useState('');
  const [resizingColumn, setResizingColumn] = useState<TableColumnId | null>(null);
  const [tableSort, setTableSort] = useState<TableSort | null>(null);
  const remarksPanelRef = useRef<HTMLDivElement | null>(null);
  const remarksTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const columnsPanelRef = useRef<HTMLDivElement | null>(null);
  const resizeRef = useRef<{ id: TableColumnId; startX: number; startWidth: number } | null>(null);
  const scheduleInputRefs = useRef(new Map<string, HTMLInputElement>());
  const savingFieldsRef = useRef<Record<string, Set<EditableField>>>({});
  const remarksSavingRef = useRef(false);

  const remarksDirty = Boolean(remarksEditor && remarksEditor.draft !== remarksEditor.canonical);
  const remarksAnchor = remarksEditor?.anchor ?? null;
  const hiddenColumns = useMemo(() => new Set(tableLayout.hidden), [tableLayout.hidden]);
  const effectiveWidths = useMemo(() => Object.fromEntries(tableColumns.map((column) => [
    column.id,
    clampColumnWidth(column, tableLayout.widths[column.id] ?? column.defaultWidth),
  ])) as Record<TableColumnId, number>, [tableLayout.widths]);
  const visibleColumns = useMemo(() => tableColumns.filter((column) => !hiddenColumns.has(column.id)), [hiddenColumns]);
  const tableWidth = useMemo(() => visibleColumns.reduce((total, column) => total + effectiveWidths[column.id], 0), [effectiveWidths, visibleColumns]);
  const sortedJobs = useMemo(() => {
    if (!tableSort) return jobs;
    const originalOrder = new Map(jobs.map((job, index) => [job.id, index]));
    return [...jobs].sort((first, second) => {
      const comparison = compareTableSortValues(
        tableSortValue(first, tableSort.column),
        tableSortValue(second, tableSort.column),
        tableSort.direction,
      );
      return comparison || (originalOrder.get(first.id) ?? 0) - (originalOrder.get(second.id) ?? 0);
    });
  }, [jobs, tableSort]);
  const jobNumberStickyLeft = effectiveWidths.inspector;
  const projectStickyLeft = effectiveWidths.inspector + effectiveWidths.jobNumber;
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setTableLayout(parseStoredTableLayout(window.localStorage.getItem(TABLE_LAYOUT_STORAGE_KEY)));
      setLayoutLoaded(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!layoutLoaded) return;
    window.localStorage.setItem(TABLE_LAYOUT_STORAGE_KEY, JSON.stringify(tableLayout));
  }, [layoutLoaded, tableLayout]);

  useEffect(() => {
    setColumnsToolbarTarget(document.getElementById('production-table-columns-toolbar-slot'));
  }, []);

  useEffect(() => {
    if (!columnsOpen) return;
    function handleOutsidePointer(event: PointerEvent) {
      if (!columnsPanelRef.current?.contains(event.target as Node)) setColumnsOpen(false);
    }
    document.addEventListener('pointerdown', handleOutsidePointer, true);
    return () => document.removeEventListener('pointerdown', handleOutsidePointer, true);
  }, [columnsOpen]);

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

  function focusMissingScheduleField(job: ProductionJob, row: EditableRow) {
    const field = !row.plannedStart ? 'plannedStart' : 'plannedEnd';
    const column: TableColumnId = field === 'plannedStart' ? 'start' : 'finish';
    const focusInput = () => {
      const input = scheduleInputRefs.current.get(`${job.id}:${field}`);
      input?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      input?.focus();
    };

    if (hiddenColumns.has(column)) {
      setColumnVisible(column, true);
      requestAnimationFrame(() => requestAnimationFrame(focusInput));
      return;
    }
    requestAnimationFrame(focusInput);
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
      }, 2500);
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
    if (!remarksEditor || remarksSavingRef.current) return;
    const normalized = remarksEditor.draft.trim() || null;
    const { job, anchor } = remarksEditor;

    if (productionValuesEqual('remarks', job.remarks, normalized)) {
      closeRemarksEditor();
      return;
    }

    remarksSavingRef.current = true;
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
      }, 2500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save remarks.';
      setStates((current) => ({ ...current, [job.id]: 'error' }));
      setErrors((current) => ({ ...current, [job.id]: message }));
      setRemarksError(message);
    } finally {
      remarksSavingRef.current = false;
      setRemarksSaving(false);
    }
  }

  function setColumnWidth(id: TableColumnId, width: number) {
    const column = tableColumnById[id];
    if (!column.resizable) return;
    const nextWidth = clampColumnWidth(column, width);
    setTableLayout((current) => ({
      ...current,
      widths: {
        ...current.widths,
        [id]: nextWidth === column.defaultWidth ? undefined : nextWidth,
      },
    }));
  }

  function startColumnResize(id: TableColumnId, event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = { id, startX: event.clientX, startWidth: effectiveWidths[id] };
    setResizingColumn(id);
  }

  function moveColumnResize(event: ReactPointerEvent<HTMLButtonElement>) {
    const resize = resizeRef.current;
    if (!resize || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.preventDefault();
    setColumnWidth(resize.id, resize.startWidth + event.clientX - resize.startX);
  }

  function finishColumnResize(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    resizeRef.current = null;
    setResizingColumn(null);
  }

  function setColumnVisible(id: TableColumnId, visible: boolean) {
    const column = tableColumnById[id];
    if (!column.hideable) return;
    setLayoutMessage('');
    if (!visible && id === 'remarks' && remarksEditor) {
      if (remarksDirty || remarksSaving) {
        setLayoutMessage('Save or cancel the open Remarks edit before hiding Remarks.');
        return;
      }
      setRemarksEditor(null);
      setRemarksError('');
    }
    setTableLayout((current) => ({
      ...current,
      hidden: visible
        ? current.hidden.filter((columnId) => columnId !== id)
        : [...new Set([...current.hidden, id])],
    }));
  }

  function showAllColumns() {
    setLayoutMessage('');
    setTableLayout((current) => ({ ...current, hidden: [] }));
  }

  function resetTableLayout() {
    if (remarksDirty || remarksSaving) {
      setLayoutMessage('Save or cancel the open Remarks edit before resetting the layout.');
      return;
    }
    setRemarksEditor(null);
    setRemarksError('');
    setLayoutMessage('');
    setTableLayout(defaultTableLayout);
  }

  function renderResizeHandle(column: TableColumn) {
    if (!column.resizable) return null;
    return (
      <button
        type="button"
        aria-label={`Resize ${column.label} column`}
        title={`Drag to resize ${column.label}. Double-click to reset.`}
        onPointerDown={(event) => startColumnResize(column.id, event)}
        onPointerMove={moveColumnResize}
        onPointerUp={finishColumnResize}
        onPointerCancel={finishColumnResize}
        onLostPointerCapture={finishColumnResize}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setColumnWidth(column.id, column.defaultWidth);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          const direction = event.key === 'ArrowLeft' ? -1 : 1;
          setColumnWidth(column.id, effectiveWidths[column.id] + direction * (event.shiftKey ? 16 : 4));
        }}
        className={`group/resize absolute -right-1.5 top-0 z-[60] flex h-full w-3 cursor-col-resize touch-none select-none items-center justify-center border-0 bg-transparent p-0 outline-none after:absolute after:bottom-0.5 after:left-1/2 after:top-0.5 after:w-px after:-translate-x-1/2 after:bg-slate-400/0 after:transition-colors group-hover/column:after:bg-slate-500 hover:after:bg-blue-600 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 focus-visible:after:bg-blue-600 ${resizingColumn === column.id ? 'after:!bg-blue-700' : ''}`}
      >
        <ChevronsLeftRight aria-hidden="true" className={`relative z-10 h-3 w-3 rounded-sm bg-slate-100 text-slate-600 opacity-0 transition-opacity group-hover/column:opacity-100 group-focus-visible/resize:opacity-100 group-hover/resize:text-blue-700 ${resizingColumn === column.id ? '!bg-blue-50 !text-blue-700 !opacity-100' : ''}`} />
      </button>
    );
  }

  function toggleTableSort(column: SortableTableColumnId) {
    setTableSort((current) => current?.column === column
      ? { column, direction: current.direction === 'ascending' ? 'descending' : 'ascending' }
      : { column, direction: 'ascending' });
  }

  function renderHeader(column: TableColumn, content: ReactNode, className = '', title?: string) {
    if (hiddenColumns.has(column.id)) return null;
    const sortable = column.id !== 'inspector' && column.id !== 'operations';
    const activeSort = sortable && tableSort?.column === column.id ? tableSort : null;
    return (
      <th
        title={[title, sortable ? `Double-click to sort by ${column.label}. Press Enter when focused for keyboard sorting.` : null].filter(Boolean).join(' ')}
        tabIndex={sortable ? 0 : undefined}
        aria-sort={activeSort?.direction ?? (sortable ? 'none' : undefined)}
        onDoubleClick={sortable ? () => toggleTableSort(column.id as SortableTableColumnId) : undefined}
        onKeyDown={sortable ? (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          toggleTableSort(column.id as SortableTableColumnId);
        } : undefined}
        className={`${headerClass} group/column relative select-none ${sortable ? 'cursor-default' : ''} ${activeSort ? '!bg-blue-100 !text-blue-900' : ''} ${className}`}
        style={column.id === 'jobNumber' ? { left: jobNumberStickyLeft } : column.id === 'project' ? { left: projectStickyLeft } : undefined}
      >
        <span className="inline-flex items-center justify-center gap-1">
          {content}
          {activeSort?.direction === 'ascending' && <ArrowUp className="h-3 w-3 text-blue-700" aria-hidden="true" />}
          {activeSort?.direction === 'descending' && <ArrowDown className="h-3 w-3 text-blue-700" aria-hidden="true" />}
        </span>
        {renderResizeHandle(column)}
      </th>
    );
  }

  function renderCells(
    row: EditableRow,
    onChange: <K extends EditableField>(field: K, value: EditableRow[K]) => void,
    onBlur?: (field: EditableField) => void,
    nameRef?: RefObject<HTMLInputElement | null>,
    scheduleRefs?: {
      start: (element: HTMLInputElement | null) => void;
      finish: (element: HTMLInputElement | null) => void;
    },
    scheduleState?: 'staged' | 'locked',
    jobNumberIndicator?: ReactNode,
    projectAttachmentIndicator?: ReactNode,
    operationsControl?: ReactNode,
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
          <div className="flex h-6 min-w-0 items-center bg-white">
            {jobNumberIndicator}
            <input value={row.jobNumber} title={row.jobNumber || undefined} onChange={(e) => onChange('jobNumber', e.target.value)} onBlur={blur('jobNumber')} onKeyDown={blurOnEnter} placeholder="Job #" className={`${inputClass} min-w-0 flex-1 bg-white`} />
          </div>
        </td>
        <td className={`${cellClass} sticky z-20`} style={{ left: projectStickyLeft }}>
          <div className="relative bg-white">
            <input ref={nameRef} value={row.name} title={row.name} onChange={(e) => onChange('name', e.target.value)} onBlur={blur('name')} onKeyDown={blurOnEnter} placeholder="Project name *" className={`${inputClass} bg-white pr-24 font-semibold text-slate-950`} />
            {projectAttachmentIndicator && <div className="absolute right-1 top-1/2 z-10 -translate-y-1/2">{projectAttachmentIndicator}</div>}
          </div>
        </td>
        {!hiddenColumns.has('customer') && <td className={cellClass}><input list="production-customer-suggestions" autoComplete="off" value={row.customer} title={row.customer || undefined} onChange={(e) => onChange('customer', e.target.value)} onBlur={blur('customer')} onKeyDown={blurOnEnter} placeholder="Customer" className={inputClass} /></td>}
        {!hiddenColumns.has('estimate') && <td className={cellClass}><input value={row.estimateNumber} title={row.estimateNumber || undefined} onChange={(e) => onChange('estimateNumber', e.target.value)} onBlur={blur('estimateNumber')} onKeyDown={blurOnEnter} placeholder="Estimate #" className={inputClass} /></td>}
        {!hiddenColumns.has('workOrder') && <td className={cellClass}><input value={row.workOrderNumber} title={row.workOrderNumber || undefined} onChange={(e) => onChange('workOrderNumber', e.target.value)} onBlur={blur('workOrderNumber')} onKeyDown={blurOnEnter} placeholder="Work order #" className={inputClass} /></td>}
        {!hiddenColumns.has('deposit') && <td className={cellClass}><input aria-label="Deposit date" title={row.depositDate || undefined} type="date" value={row.depositDate} onChange={(e) => onChange('depositDate', e.target.value)} onBlur={blur('depositDate')} onKeyDown={blurOnEnter} className={`${dateInputClass} ${row.depositDate ? populatedDateClass : emptyDateClass}`} /></td>}
        {!hiddenColumns.has('delivery') && <td className={cellClass}><input aria-label="Requested delivery date" title={row.requestedDeliveryDate || undefined} type="date" value={row.requestedDeliveryDate} onChange={(e) => onChange('requestedDeliveryDate', e.target.value)} onBlur={blur('requestedDeliveryDate')} onKeyDown={blurOnEnter} className={`${dateInputClass} ${row.requestedDeliveryDate ? populatedDateClass : emptyDateClass}`} /></td>}
        {!hiddenColumns.has('start') && <td className={cellClass}><div className="relative"><input ref={scheduleRefs?.start} aria-label={scheduleState === 'staged' ? 'Proposed planned start date, unsaved' : 'Planned start date'} title={row.plannedStart || undefined} disabled={scheduleState === 'locked'} type="date" value={row.plannedStart} onChange={(e) => onChange('plannedStart', e.target.value)} onBlur={blur('plannedStart')} onKeyDown={blurOnEnter} className={`${dateInputClass} ${row.plannedStart ? populatedDateClass : emptyDateClass} ${scheduleState === 'staged' ? 'bg-amber-50 pr-10 ring-2 ring-inset ring-amber-400' : ''} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`} />{scheduleState === 'staged' && <span className="pointer-events-none absolute right-1 top-0.5 text-[7px] font-bold uppercase text-amber-800">Unsaved</span>}</div></td>}
        {!hiddenColumns.has('finish') && <td className={cellClass}><div className="relative"><input ref={scheduleRefs?.finish} aria-label={scheduleState === 'staged' ? 'Proposed planned finish date, unsaved' : 'Planned finish date'} title={row.plannedEnd || undefined} disabled={scheduleState === 'locked'} type="date" value={row.plannedEnd} min={row.plannedStart || undefined} onChange={(e) => onChange('plannedEnd', e.target.value)} onBlur={blur('plannedEnd')} onKeyDown={blurOnEnter} className={`${dateInputClass} ${row.plannedEnd ? populatedDateClass : emptyDateClass} ${scheduleState === 'staged' ? 'bg-amber-50 pr-10 ring-2 ring-inset ring-amber-400' : ''} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`} />{scheduleState === 'staged' && <span className="pointer-events-none absolute right-1 top-0.5 text-[7px] font-bold uppercase text-amber-800">Unsaved</span>}</div></td>}
        {!hiddenColumns.has('labor') && <td className={cellClass}><input type="number" min="0" step="0.25" value={row.estimatedManHours} onChange={(e) => onChange('estimatedManHours', e.target.value)} onBlur={blur('estimatedManHours')} onKeyDown={blurOnEnter} placeholder="Hours" className={inputClass} /></td>}
        {!hiddenColumns.has('days') && <td className={cellClass}><input type="number" min="0" step="1" value={row.estimatedCalendarDays} onChange={(e) => onChange('estimatedCalendarDays', e.target.value)} onBlur={blur('estimatedCalendarDays')} onKeyDown={blurOnEnter} placeholder="Days" className={inputClass} /></td>}
        {!hiddenColumns.has('colorPlate') && <td className={cellClass}><input value={row.colorPlateNumber} title={row.colorPlateNumber || undefined} onChange={(e) => onChange('colorPlateNumber', e.target.value)} onBlur={blur('colorPlateNumber')} onKeyDown={blurOnEnter} placeholder="Color plate #" className={inputClass} /></td>}
        {!hiddenColumns.has('sample') && <td className={cellClass}><input aria-label="Sample submitted date" title={row.sampleSubmittedDate || undefined} type="date" value={row.sampleSubmittedDate} onChange={(e) => onChange('sampleSubmittedDate', e.target.value)} onBlur={blur('sampleSubmittedDate')} onKeyDown={blurOnEnter} className={`${dateInputClass} ${row.sampleSubmittedDate ? populatedDateClass : emptyDateClass}`} /></td>}
        {!hiddenColumns.has('approval') && <td className={cellClass}><input aria-label="Approval date" title={row.approvalDate || undefined} type="date" value={row.approvalDate} onChange={(e) => onChange('approvalDate', e.target.value)} onBlur={blur('approvalDate')} onKeyDown={blurOnEnter} className={`${dateInputClass} ${row.approvalDate ? populatedDateClass : emptyDateClass}`} /></td>}
        {!hiddenColumns.has('operations') && <td className={`${cellClass} px-1`}>{operationsControl}</td>}
        {!hiddenColumns.has('material') && <td className={cellClass}>
          <select value={row.materialStatus} onChange={(e) => onChange('materialStatus', e.target.value as MaterialStatus)} onBlur={blur('materialStatus')} onKeyDown={blurOnEnter} className={selectClass}>
            {materialStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </td>}
        {!hiddenColumns.has('status') && <td className={cellClass}>
          <select value={row.productionStatus} onChange={(e) => onChange('productionStatus', e.target.value as ProductionStatus)} onBlur={blur('productionStatus')} onKeyDown={blurOnEnter} className={selectClass}>
            {productionStatuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </td>}
        {!hiddenColumns.has('remarks') && <td className={cellClass}>
          {remarksControl ?? <textarea value={row.remarks} title={row.remarks || undefined} onChange={(e) => onChange('remarks', e.target.value)} onBlur={blur('remarks')} placeholder="Remarks" rows={1} wrap="off" className="h-6 w-full min-w-0 resize-none overflow-hidden whitespace-nowrap border-0 bg-transparent px-0.5 py-0 text-[10px] leading-6 outline-none focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-600" />}
        </td>}
      </>
    );
  }

  return (
    <>
      {columnsToolbarTarget && createPortal(
        <div ref={columnsPanelRef} className="relative flex w-full items-center gap-2 lg:w-auto">
          {tableSort && (
            <button
              type="button"
              onClick={() => setTableSort(null)}
              aria-label={`Clear ${tableColumnById[tableSort.column].label} ${tableSort.direction} sort`}
              title="Clear table sort and restore the default planned-start order"
              className="inline-flex h-9 max-w-48 items-center gap-1.5 rounded-sm border border-blue-300 bg-blue-50 px-2.5 text-[10px] font-bold uppercase tracking-[0.05em] text-blue-900 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {tableSort.direction === 'ascending' ? <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
              <span className="truncate">{tableColumnById[tableSort.column].label}</span>
              <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            id="production-table-columns-control"
            aria-label="Configure table columns"
            title="Configure table columns"
            aria-haspopup="dialog"
            aria-expanded={columnsOpen}
            aria-controls="production-table-columns-popover"
            onClick={() => {
              setLayoutMessage('');
              setColumnsOpen((current) => !current);
            }}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-sm border border-slate-300 bg-white px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 lg:w-auto"
          >
            <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
            Columns
          </button>
          {columnsOpen && (
            <div
              role="dialog"
              id="production-table-columns-popover"
              aria-label="Production Table columns"
              aria-labelledby="production-table-columns-control"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setColumnsOpen(false);
                }
              }}
              className="absolute right-0 top-full z-[90] mt-1 flex max-h-[min(75vh,32rem)] w-72 flex-col overflow-hidden rounded-sm border border-slate-300 bg-white shadow-xl"
            >
              <div className="min-h-0 flex-1 overflow-y-auto p-2 pr-1">
                {tableColumns.map((column) => (
                  <label key={column.id} className={`flex min-h-8 items-center gap-2 rounded-sm px-2 text-xs ${column.hideable ? 'cursor-pointer text-slate-700 hover:bg-slate-50' : 'cursor-not-allowed text-slate-400'}`}>
                    <input
                      type="checkbox"
                      checked={!hiddenColumns.has(column.id)}
                      disabled={!column.hideable}
                      onChange={(event) => setColumnVisible(column.id, event.target.checked)}
                      className="h-4 w-4 rounded-sm border-slate-300 text-blue-700 focus:ring-blue-600"
                    />
                    <span className="flex-1">{column.label}</span>
                    {!column.hideable && <span className="text-[9px] font-bold uppercase tracking-wide">Required</span>}
                  </label>
                ))}
              </div>
              {layoutMessage && <div role="alert" className="mx-2 mb-2 shrink-0 border-l-2 border-amber-500 bg-amber-50 px-2 py-1.5 text-[10px] font-semibold leading-4 text-amber-900">{layoutMessage}</div>}
              <div className="flex h-11 shrink-0 items-center gap-2 border-t border-slate-200 bg-white px-2">
                <button type="button" onClick={showAllColumns} className="h-7 min-w-0 flex-1 whitespace-nowrap rounded-sm px-2 text-[10px] font-bold uppercase tracking-wide text-blue-800 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-600">Show all</button>
                <button type="button" onClick={resetTableLayout} className="h-7 shrink-0 whitespace-nowrap rounded-sm border border-slate-300 bg-white px-3 text-[10px] font-bold uppercase tracking-[0.04em] text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600">Reset layout</button>
              </div>
            </div>
          )}
        </div>,
        columnsToolbarTarget,
      )}
    <div className={`overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm ${resizingColumn ? 'cursor-col-resize select-none' : ''}`}>
      <div className="max-h-[68vh] overflow-auto">
        <table className="table-fixed border-separate border-spacing-0" style={{ width: tableWidth }}>
          <colgroup>
            {visibleColumns.map((column) => <col key={column.id} style={{ width: effectiveWidths[column.id] }} />)}
          </colgroup>
          <thead data-production-table-header className="sticky top-0 z-30">
            <tr>
              {renderHeader(tableColumnById.inspector, <Search className="mx-auto h-3 w-3" aria-hidden="true" />, 'sticky left-0 z-50 px-0', 'Inspect job actions')}
              {renderHeader(tableColumnById.jobNumber, 'Job #', 'sticky z-40')}
              {renderHeader(tableColumnById.project, 'Project', 'sticky z-40')}
              {renderHeader(tableColumnById.customer, 'Customer')}
              {renderHeader(tableColumnById.estimate, 'Estimate')}
              {renderHeader(tableColumnById.workOrder, 'WO #', '', 'Work Order Number')}
              {renderHeader(tableColumnById.deposit, 'Deposit', '', 'Deposit Received')}
              {renderHeader(tableColumnById.delivery, 'Delivery', '', 'Requested Delivery Date')}
              {renderHeader(tableColumnById.start, 'Start', '', 'Planned Production Start')}
              {renderHeader(tableColumnById.finish, 'Finish', '', 'Planned Production Finish')}
              {renderHeader(tableColumnById.labor, 'Labor', '', 'Estimated Labor Hours')}
              {renderHeader(tableColumnById.days, 'Days', '', 'Estimated Calendar Days')}
              {renderHeader(tableColumnById.colorPlate, 'Color Plate', '', 'Color Plate Number')}
              {renderHeader(tableColumnById.sample, 'Sample', '', 'Sample Submitted Date')}
              {renderHeader(tableColumnById.approval, 'Approval')}
              {renderHeader(tableColumnById.operations, 'Operations', '', 'Labor and Material Usage reporting')}
              {renderHeader(tableColumnById.material, 'Material', '', 'Material Readiness Status')}
              {renderHeader(tableColumnById.status, 'Status', '', 'Production Status')}
              {renderHeader(tableColumnById.remarks, 'Remarks')}
            </tr>
          </thead>

          <tbody>
            {sortedJobs.map((job) => {
              const row = rows[job.id] ?? toRow(job);
              const state = states[job.id] ?? 'idle';
              const count = attachmentCounts[job.id] ?? 0;
              const updateSummary = jobUpdateSummaries[job.id] ?? EMPTY_JOB_UPDATE_SUMMARY;
              const integration = integrationSummaries[job.id] ?? { actualHours: 0, laborEntryCount: 0, materialReportDates: [] };
              const hasMaterialUse = integration.materialReportDates.length > 0;

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
                    {
                      start: (element) => {
                        const key = `${job.id}:plannedStart`;
                        if (element) scheduleInputRefs.current.set(key, element);
                        else scheduleInputRefs.current.delete(key);
                      },
                      finish: (element) => {
                        const key = `${job.id}:plannedEnd`;
                        if (element) scheduleInputRefs.current.set(key, element);
                        else scheduleInputRefs.current.delete(key);
                      },
                    },
                    stagedSchedules[job.id] ? 'staged' : undefined,
                    !row.plannedStart || !row.plannedEnd ? <span data-table-needs-dates className="flex h-6 w-5 shrink-0 items-center justify-center"><UnscheduledBadge iconOnly ariaLabel={`${job.name} needs planned dates`} onClick={() => focusMissingScheduleField(job, row)} /></span> : null,
                    <div className="flex items-center gap-1">{job.rework_cycle ? <ReworkBadge sequence={job.rework_cycle.sequence_number} /> : null}{count > 0 && <button
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
                      </button>}<JobUpdatesIndicator job={job} summary={updateSummary} onOpen={() => onSelectJob(job, 'job-updates')} /><ReworkQuickAction job={job} onCreate={onCreateRework} /></div>,
                    <div className="flex h-6 min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap">
                      {job.estimated_man_hours !== null ? <span className="h-6 px-1 text-[9px] leading-6 text-slate-600"><strong className="text-slate-900">{formatHours(job.estimated_man_hours)}h</strong> Estimated</span> : <span className="h-6 px-1 text-[9px] font-semibold leading-6 text-slate-900">No Labor Estimate</span>}
                      {integration.laborEntryCount > 0 ? <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          window.location.href = `/manpower-reporting?job=${job.id}`;
                        }}
                        title="Open job labor"
                        aria-label={`Open manpower reporting for ${job.name}`}
                        className="h-6 cursor-pointer border border-blue-200 bg-blue-50 px-1 text-[9px] font-bold text-blue-900 shadow-sm transition hover:bg-blue-100 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                      >
                        {formatHours(integration.actualHours)}h Current
                      </button> : <span className="h-6 px-1 text-[9px] font-semibold leading-6 text-slate-900">No Labor Reports</span>}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          window.location.href = hasMaterialUse ? `/material-usage?historyJob=${job.id}` : `/material-usage?newJob=${job.id}`;
                        }}
                        aria-label={`${hasMaterialUse ? 'Open' : 'Create'} material usage for ${job.name}`}
                        className={`h-6 cursor-pointer rounded-sm border px-1 text-[9px] font-bold shadow-sm transition hover:-translate-y-px hover:shadow focus-visible:outline-none focus-visible:ring-2 ${hasMaterialUse ? 'border-emerald-200 bg-emerald-100 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-200 focus-visible:ring-emerald-700' : 'border-amber-200 bg-amber-100 text-amber-900 hover:border-amber-300 hover:bg-amber-200 focus-visible:ring-amber-700'}`}
                      >
                        {hasMaterialUse ? 'Material Use' : 'No Material Use Linked'}
                      </button>
                    </div>,
                    <div className="relative flex h-6 items-center justify-center">
                      <button type="button" onClick={(event) => { event.stopPropagation(); onSelectJob(job); }} aria-label="Inspect job" title={`Inspect ${job.job_number ? `${job.job_number} — ` : ''}${job.name}`} className={`inline-flex h-6 w-6 items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 group-hover:text-slate-700 ${selectedJobId === job.id ? 'text-blue-700' : ''}`}><Search className="h-3.5 w-3.5" aria-hidden="true" /></button>
                      {(state === 'saving' || state === 'saved' || state === 'error') && (() => {
                        const transition = feedback[job.id] ? `${feedback[job.id]!.field}: ${feedback[job.id]!.oldValue} → ${feedback[job.id]!.newValue}` : '';
                        const message = state === 'saving' ? `Saving…${transition ? ` · ${transition}` : ''}` : state === 'saved' ? `Changes saved${transition ? ` · ${transition}` : ''}` : `Could not save${transition ? ` · ${transition}` : ''}${errors[job.id] ? ` · ${errors[job.id]}` : ''}`;
                        return <div role={state === 'error' ? 'alert' : 'status'} aria-live="polite" aria-label={message} title={message} className={`pointer-events-none absolute left-[38px] top-full z-[60] h-7 w-80 truncate border px-2 text-left text-[10px] font-bold leading-7 shadow-md ${state === 'error' ? 'border-red-400 bg-red-50 text-red-800' : state === 'saved' ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-blue-400 bg-blue-50 text-blue-800'}`}>{message}</div>;
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
          </tbody>
        </table>
      </div>

      {jobs.length === 0 && (
        <div className="flex min-h-40 items-center justify-center border-t border-slate-300 px-6 py-8 text-center">
          <div>
            <div className="text-lg font-bold text-slate-900">Production Pipeline is empty</div>
            <div className="mt-2 text-sm text-slate-600">Use New Job in the Production toolbar to create the first active job.</div>
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
