'use client';

import { ChevronDown, ChevronRight, Pencil, Plus, RotateCw, Search, Settings2 } from 'lucide-react';
import { createContext, useContext, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import ProductCategoryManager from './ProductCategoryManager';
import ProductLaborSummary from './ProductLaborSummary';
import ManpowerAnalytics from './ManpowerAnalytics';
import { productKey, productLabel, UNCATEGORIZED, validateProductSelection } from './product-reporting';
import { useLanguage } from '@/lib/language';
import { JobTag } from '../production/components/JobTag';
import ProductionStatusBadge from '../production/components/ProductionStatusBadge';
import { openProductionJob } from '../production/job-options';
import { productionStatusVisualByValue } from '../production/status-visuals';
import {
  loadProductCategories,
  updateManpowerProductCategory,
  MAX_BULK_PRODUCT_ENTRIES,
  createManpowerEntry,
  createManpowerReference,
  createManpowerReportingGroup,
  deleteManpowerEntries,
  deleteEmptyManpowerReportingGroup,
  loadManpowerEntries,
  loadManpowerJobs,
  loadManpowerReferences,
  loadManpowerReportingGroups,
  updateManpowerEntries,
  updateManpowerGroupIdentity,
  updateManpowerEntry,
  updateManpowerReference,
  updateManpowerReportingGroup,
} from './manpower';
import type {
  ManpowerEntry,
  ManpowerEntryInput,
  ManpowerJob,
  ManpowerReference,
  ManpowerReportingGroup,
} from './types';
import {
  buildManpowerWorkTargetOptions,
  manpowerEntryTargetValue,
  manpowerIdentityForTarget,
  manpowerJobLabel,
  UNLISTED_WORK_TARGET,
} from './work-target';
import type { ManpowerWorkTargetOption } from './work-target';

const ProductContext = createContext<{ categories: ManpowerReference[]; refresh(): Promise<void> }>({ categories: [], refresh: async () => {} });

type Draft = {
  reportingGroupId: string;
  workDate: string;
  workerId: string;
  taskId: string;
  productCategoryId: string;
  workTarget: string;
  unlistedLabel: string;
  amHours: string;
  pmHours: string;
  notes: string;
};

const inputClass = 'h-9 w-full min-w-0 rounded-sm border border-slate-300 bg-white px-2 text-sm outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100';
const headerClass = 'border-b border-r border-slate-200 bg-slate-100 px-2 py-2 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600';

function today() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function blankDraft(): Draft {
  return {
    reportingGroupId: '', workDate: today(), workerId: '', taskId: '', productCategoryId: '', workTarget: '', unlistedLabel: '',
    amHours: '', pmHours: '', notes: '',
  };
}

function entryDraft(entry: ManpowerEntry): Draft {
  return {
    reportingGroupId: entry.reporting_group_id ?? '',
    workDate: entry.work_date,
    workerId: entry.worker_id,
    taskId: entry.task_id,
    productCategoryId: entry.product_category_id ?? '',
    workTarget: manpowerEntryTargetValue(entry),
    unlistedLabel: entry.unlisted_work_label ?? '',
    amHours: String(entry.am_hours),
    pmHours: String(entry.pm_hours),
    notes: entry.notes ?? '',
  };
}

function toInput(draft: Draft, targets: ManpowerWorkTargetOption[]): ManpowerEntryInput {
  return {
    reporting_group_id: draft.reportingGroupId || null,
    work_date: draft.workDate,
    worker_id: draft.workerId,
    task_id: draft.taskId,
    product_category_id: draft.productCategoryId || null,
    ...manpowerIdentityForTarget(draft.workTarget, draft.unlistedLabel, targets),
    am_hours: Number(draft.amHours || 0),
    pm_hours: Number(draft.pmHours || 0),
    notes: draft.notes.trim() || null,
  };
}

function validate(draft: Draft) {
  if (!draft.reportingGroupId || !draft.workDate || !draft.workerId || !draft.taskId || !draft.workTarget) return 'Reporting group, date, worker, task, and job are required.';
  if (draft.workTarget === UNLISTED_WORK_TARGET && !draft.unlistedLabel.trim()) return 'Enter the unlisted job or work label.';
  const am = Number(draft.amHours || 0);
  const pm = Number(draft.pmHours || 0);
  if (!Number.isFinite(am) || !Number.isFinite(pm) || am < 0 || pm < 0) return 'Hours must be valid nonnegative numbers.';
  if (am + pm > 24) return 'AM and PM hours cannot total more than 24.';
  return '';
}

function ProductionJobLinkSelector({ groupLabel, targets, value, selectedLabel, disabled, onChange }: { groupLabel: string; targets: ManpowerWorkTargetOption[]; value: string; selectedLabel: string; disabled: boolean; onChange(value: string): void }) {
  const [open, setOpen] = useState(false);
  const selectedTarget = targets.find((target) => target.value === value);

  return <div className="relative w-full min-w-0 sm:w-auto sm:min-w-72" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <button type="button" aria-label={`Production job for ${groupLabel}`} aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => setOpen((current) => !current)} className="flex h-9 w-full items-center justify-between gap-3 rounded-sm border border-slate-300 bg-white px-2 text-left text-xs text-slate-800 outline-none transition hover:border-slate-500 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-wait disabled:opacity-60">
      <span className="min-w-0 truncate font-medium">{selectedLabel || 'Mixed lifecycle targets'}</span>
      <span className="flex shrink-0 items-center gap-2">{selectedTarget ? <ProductionStatusBadge status={selectedTarget.status} /> : null}<ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" /></span>
    </button>
    {open ? <div role="listbox" aria-label={`Production jobs for ${groupLabel}`} className="absolute right-0 top-10 z-50 max-h-80 w-[min(28rem,calc(100vw-3rem))] overflow-y-auto rounded-sm border border-slate-300 bg-white p-1 shadow-xl">
      <button type="button" role="option" aria-selected={!value && !selectedLabel} onClick={() => { setOpen(false); onChange(''); }} className={`flex min-h-9 w-full items-center px-2 text-left text-xs font-medium hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none ${!value && !selectedLabel ? 'bg-blue-50 text-blue-900' : 'text-slate-700'}`}>Not Linked to Production</button>
      {targets.filter((target) => target.selectable || target.value === value).map((target) => <button key={target.value} type="button" role="option" aria-selected={target.value === value} onClick={() => { setOpen(false); onChange(target.value); }} className={`flex min-h-10 w-full items-center justify-between gap-3 px-2 text-left hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none ${target.value === value ? 'bg-blue-50' : ''}`}><span className="min-w-0 truncate text-xs font-semibold text-slate-900">{target.label}</span><ProductionStatusBadge status={target.status} /></button>)}
    </div> : null}
  </div>;
}

function groupReportingDate(group: ManpowerReportingGroup): number | null {
  const match = group.display_name.match(/^\s*(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (match) {
    const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
    const month = Number(match[1]);
    const day = Number(match[2]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
      return date.getTime();
    }
  }
  return null;
}

function sortReferences(items: ManpowerReference[]) {
  return [...items].sort((a, b) => a.sort_order - b.sort_order || a.display_name.localeCompare(b.display_name) || a.id.localeCompare(b.id));
}

function caughtMessage(caught: unknown, fallback: string) {
  if (caught instanceof Error) return caught.message;
  if (caught && typeof caught === 'object' && 'message' in caught) return String(caught.message);
  return fallback;
}

function SelectionCheckbox({
  checked,
  indeterminate = false,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-label={label}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4 accent-blue-700"
    />
  );
}

function ReportingGroupName({ group, onRename }: {
  group: ManpowerReportingGroup;
  onRename: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(group.display_name);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => setName(group.display_name), [group.display_name]);
  async function save() {
    if (!name.trim()) return;
    if (name.trim() === group.display_name) { setName(group.display_name); setEditing(false); return; }
    setSaving(true);
    try { await onRename(name); setEditing(false); }
    finally { setSaving(false); }
  }
  function cancel() { setName(group.display_name); setEditing(false); }
  if (!editing) return <div className="flex min-w-0 items-center gap-2"><span className="max-w-72 truncate text-sm font-bold text-slate-950">{group.display_name}</span><button type="button" onClick={() => setEditing(true)} aria-label="Edit group name" title="Edit group name" className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-slate-500 hover:bg-white hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-blue-600"><Pencil className="h-3.5 w-3.5" /></button></div>;
  return <div className="flex min-w-0 items-center gap-1"><input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void save(); } if (event.key === 'Escape') cancel(); }} aria-label="Reporting group name" placeholder="Reporting group name" className="h-8 w-64 min-w-0 rounded-sm border border-blue-500 bg-white px-2 text-sm font-bold text-slate-950 caret-slate-950 outline-none selection:bg-blue-200 focus:ring-2 focus:ring-blue-200" disabled={saving} /><button type="button" onClick={() => void save()} disabled={saving || !name.trim()} className="h-8 rounded-sm bg-slate-900 px-2 text-xs font-bold text-white disabled:opacity-50">Save</button><button type="button" onClick={cancel} disabled={saving} className="h-8 rounded-sm px-2 text-xs font-bold text-slate-600 hover:bg-white">Cancel</button></div>;
}

function ReferenceSelect({
  value, options, noun, onChange, onAdd,
}: {
  value: string;
  options: ManpowerReference[];
  noun: 'worker' | 'task';
  onChange: (value: string) => void;
  onAdd: (name: string) => Promise<ManpowerReference>;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function add() {
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const created = await onAdd(name);
      onChange(created.id);
      setName('');
      setAdding(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Unable to add ${noun}.`);
    } finally {
      setSaving(false);
    }
  }

  if (adding) {
    return (
      <div className="min-w-[180px]">
        <div className="flex gap-1">
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); void add(); }
            if (event.key === 'Escape') setAdding(false);
          }} placeholder={`New ${noun} name`} className={inputClass} />
          <button type="button" disabled={saving || !name.trim()} onClick={() => void add()} className="h-9 border border-slate-900 bg-slate-900 px-2 text-xs font-bold text-white disabled:opacity-50">Add</button>
          <button type="button" onClick={() => setAdding(false)} className="h-9 border border-slate-400 bg-white px-2 text-xs font-bold">×</button>
        </div>
        {error && <div className="mt-1 text-xs font-semibold text-red-700">{error}</div>}
      </div>
    );
  }

  return (
    <div className="flex min-w-[180px] gap-1">
      <button type="button" onClick={() => setAdding(true)} className="h-9 shrink-0 border border-blue-300 bg-blue-50 px-2 text-[10px] font-bold uppercase tracking-wide text-blue-800">+ Add</button>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
        <option value="">Select {noun}</option>
        {options.filter((option) => option.is_active || option.id === value).map((option) => (
          <option key={option.id} value={option.id}>{option.display_name}{option.is_active ? '' : ' (Inactive)'}</option>
        ))}
      </select>
    </div>
  );
}

function ReferenceManager({ noun, options, onCreate, onUpdate, onEditingChange }: {
  noun: 'worker' | 'task';
  options: ManpowerReference[];
  onCreate: (name: string, order: number) => Promise<void>;
  onUpdate: (reference: ManpowerReference, changes: Partial<Pick<ManpowerReference, 'display_name' | 'sort_order' | 'is_active'>>) => Promise<void>;
  onEditingChange?: (editing: boolean) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [order, setOrder] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const title = noun === 'worker' ? 'Workers' : 'Tasks';

  useEffect(() => onEditingChange?.(adding || editingId !== null), [adding, editingId, onEditingChange]);

  function beginAdd() {
    setEditingId(null); setName('');
    setOrder(String(Math.max(0, ...options.map((option) => option.sort_order)) + 1));
    setError(''); setAdding(true);
  }
  function beginEdit(reference: ManpowerReference) {
    setAdding(false); setEditingId(reference.id); setName(reference.display_name);
    setOrder(String(reference.sort_order)); setError('');
  }
  function cancel() { setAdding(false); setEditingId(null); setError(''); }
  function validation(excludeId?: string) {
    if (!name.trim()) return `${noun === 'worker' ? 'Worker' : 'Task'} name cannot be blank.`;
    if (!Number.isInteger(Number(order)) || Number(order) < 1) return 'Order must be a positive whole number.';
    if (options.some((option) => option.id !== excludeId && option.display_name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase())) {
      return `A ${noun} named “${name.trim()}” already exists.`;
    }
    return '';
  }
  async function save(reference?: ManpowerReference) {
    const invalid = validation(reference?.id);
    if (invalid) { setError(invalid); return; }
    setSaving(true); setError('');
    try {
      if (reference) await onUpdate(reference, { display_name: name.trim(), sort_order: Number(order) });
      else await onCreate(name.trim(), Number(order));
      cancel();
    } catch (caught) {
      const message = caughtMessage(caught, `Unable to save ${noun}.`);
      setError(/duplicate|unique/i.test(message) ? `A ${noun} with that name already exists.` : message);
    } finally { setSaving(false); }
  }
  async function toggle(reference: ManpowerReference) {
    setError('');
    try { await onUpdate(reference, { is_active: !reference.is_active }); }
    catch (caught) { setError(caughtMessage(caught, `Unable to update ${noun}.`)); }
  }

  return <section className="flex min-h-0 min-w-0 flex-col"><div className="flex shrink-0 items-center justify-between gap-3"><h2 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-700">{title}</h2><button type="button" onClick={beginAdd} className="inline-flex h-8 items-center gap-1 border border-slate-400 bg-white px-2 text-xs font-bold text-slate-800"><Plus className="h-3.5 w-3.5" /> Add {noun}</button></div>
    <div data-settings-list className="mt-2 min-h-0 overflow-auto overscroll-contain border border-slate-300"><table className="w-full border-collapse text-sm"><thead className="sticky top-0 z-10"><tr><th className={headerClass}>Name</th><th className={`${headerClass} w-20`}>Order</th><th className={`${headerClass} w-20`}>Status</th><th className={`${headerClass} w-40`}>Actions</th></tr></thead><tbody>
      {adding && <tr className="bg-blue-50"><td className="p-1"><input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void save(); if (event.key === 'Escape') cancel(); }} className={inputClass} placeholder={`${title.slice(0, -1)} name`} /></td><td className="p-1"><input type="number" step="1" value={order} onChange={(event) => setOrder(event.target.value)} className={inputClass} /></td><td className="px-2 text-xs font-semibold text-emerald-700">Active</td><td className="p-1"><button type="button" onClick={() => void save()} disabled={saving} className="h-8 bg-slate-900 px-2 text-xs font-bold text-white disabled:opacity-50">Save</button><button type="button" onClick={cancel} className="h-8 px-2 text-xs font-bold text-slate-600">Cancel</button></td></tr>}
      {options.map((option) => editingId === option.id ? <tr key={option.id} className="bg-blue-50"><td className="p-1"><input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void save(option); if (event.key === 'Escape') cancel(); }} className={inputClass} /></td><td className="p-1"><input type="number" step="1" value={order} onChange={(event) => setOrder(event.target.value)} className={inputClass} /></td><td className="px-2 text-xs font-semibold">{option.is_active ? 'Active' : 'Inactive'}</td><td className="p-1"><button type="button" onClick={() => void save(option)} disabled={saving} className="h-8 bg-slate-900 px-2 text-xs font-bold text-white disabled:opacity-50">Save</button><button type="button" onClick={cancel} className="h-8 px-2 text-xs font-bold text-slate-600">Cancel</button></td></tr> : <tr key={option.id} className="border-t border-slate-200"><td className={`px-2 py-2 ${option.is_active ? 'font-medium' : 'text-slate-500'}`}>{option.display_name}</td><td className="px-2 py-2 tabular-nums text-slate-600">{option.sort_order}</td><td className={`px-2 py-2 text-xs font-semibold ${option.is_active ? 'text-emerald-700' : 'text-slate-500'}`}>{option.is_active ? 'Active' : 'Inactive'}</td><td className="whitespace-nowrap px-1 py-1"><button type="button" onClick={() => beginEdit(option)} className="h-8 px-2 text-xs font-bold text-blue-700">Edit</button><button type="button" onClick={() => void toggle(option)} className="h-8 px-2 text-xs font-bold text-blue-700">{option.is_active ? 'Deactivate' : 'Reactivate'}</button></td></tr>)}
    </tbody></table></div>{error && <div className="mt-1 shrink-0 text-xs font-semibold text-red-700">{error}</div>}</section>;
}

function WorkIdentityControl({ value, temporaryLabel, targets, onChange, compact = false, savedTemporaryLabel }: {
  value: string;
  temporaryLabel: string;
  targets: ManpowerWorkTargetOption[];
  onChange: (value: string, temporaryLabel: string) => void;
  compact?: boolean;
  savedTemporaryLabel?: string | null;
}) {
  const [changingSavedTemporary, setChangingSavedTemporary] = useState(false);
  const controlClass = compact
    ? 'h-8 min-w-0 border border-slate-400 bg-white px-2 text-xs text-slate-950 outline-none focus:border-blue-700'
    : inputClass;
  const hasSavedTemporary = value === UNLISTED_WORK_TARGET && Boolean(savedTemporaryLabel) && temporaryLabel === savedTemporaryLabel;
  if (hasSavedTemporary && !changingSavedTemporary) {
    return <div className="flex min-w-[260px] items-center gap-1"><span title="Preserved label from an imported or unlinked labor entry." className="shrink-0 rounded bg-slate-100 px-1.5 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">Imported Label</span><span className="min-w-0 flex-1 truncate text-sm text-slate-900">{temporaryLabel}</span></div>;
  }
  if (changingSavedTemporary) {
    return <div className="flex min-w-[260px] items-center gap-1" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setChangingSavedTemporary(false); }}><select autoFocus defaultValue="" onChange={(event) => { const next = event.target.value; if (!next) return; setChangingSavedTemporary(false); onChange(next, next === UNLISTED_WORK_TARGET ? '' : temporaryLabel); }} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); setChangingSavedTemporary(false); } }} className={`${controlClass} min-w-0 flex-1`}><option value="">Choose Production job</option><option value={UNLISTED_WORK_TARGET}>+ Replace imported label</option>{targets.filter((target) => target.selectable || target.value === value).map((target) => <option key={target.value} value={target.value}>{target.label} — {productionStatusVisualByValue[target.status].label}</option>)}</select><button type="button" onClick={() => setChangingSavedTemporary(false)} className="h-8 shrink-0 px-1.5 text-[10px] font-bold text-slate-700">Back</button></div>;
  }
  if (value === UNLISTED_WORK_TARGET) {
    const cancelTemporaryEdit = () => onChange(savedTemporaryLabel ? UNLISTED_WORK_TARGET : '', savedTemporaryLabel ?? '');
    return <div className="flex min-w-[260px] items-center gap-1" onBlur={(event) => { if (savedTemporaryLabel && !event.currentTarget.contains(event.relatedTarget as Node | null)) { event.stopPropagation(); cancelTemporaryEdit(); } }}><span className="shrink-0 rounded bg-slate-100 px-1.5 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">Imported Label</span><input autoFocus value={temporaryLabel} onChange={(event) => onChange(UNLISTED_WORK_TARGET, event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); cancelTemporaryEdit(); } }} placeholder="Enter imported or unlinked label" className={`${controlClass} bg-slate-50`} /><button type="button" onClick={cancelTemporaryEdit} className="h-8 shrink-0 px-1.5 text-[10px] font-bold text-blue-700">Back</button></div>;
  }
  return <select value={value} onChange={(event) => onChange(event.target.value, '')} className={`${controlClass} min-w-[260px]`}>
    <option value="">Production Job</option>
    <option value={UNLISTED_WORK_TARGET}>+ Add temporary job label</option>
    {targets.filter((target) => target.selectable || target.value === value).map((target) => <option key={target.value} value={target.value}>{target.label} — {productionStatusVisualByValue[target.status].label}</option>)}
  </select>;
}

function EntryFields({
  draft, setDraft, targets, workers, tasks, addWorker, addTask, actions, savedTemporaryLabel, jobReadOnly = false, jobControl, allowUncategorized = false,
}: {
  draft: Draft;
  setDraft: (next: Draft) => void;
  targets: ManpowerWorkTargetOption[];
  workers: ManpowerReference[];
  tasks: ManpowerReference[];
  addWorker: (name: string) => Promise<ManpowerReference>;
  addTask: (name: string) => Promise<ManpowerReference>;
  actions?: ReactNode;
  savedTemporaryLabel?: string | null;
  jobReadOnly?: boolean;
  jobControl?: ReactNode;
  allowUncategorized?: boolean;
}) {
  const { categories, refresh } = useContext(ProductContext);
  const set = (field: keyof Draft, value: string) => setDraft({ ...draft, [field]: value });
  const total = Number(draft.amHours || 0) + Number(draft.pmHours || 0);
  return (
    <>
      <td className="border-r border-slate-300 p-1"><input type="date" value={draft.workDate} onChange={(e) => set('workDate', e.target.value)} className={inputClass} /></td>
      <td className="border-r border-slate-300 p-1"><select aria-label="Product Category" value={draft.productCategoryId} onFocus={() => void refresh().catch(() => {})} onChange={(e) => set('productCategoryId', e.target.value)} className={`${inputClass} min-w-[180px]`}><option value="" disabled={!allowUncategorized}>{allowUncategorized ? 'Uncategorized' : 'Select Product Category'}</option>{categories.filter((category) => category.is_active || category.id === draft.productCategoryId).map((category) => <option key={category.id} value={category.id} disabled={!category.is_active}>{category.display_name}{category.is_active ? '' : ' · Inactive'}</option>)}</select></td>
      <td className="border-r border-slate-300 p-1"><ReferenceSelect value={draft.workerId} options={workers} noun="worker" onChange={(value) => set('workerId', value)} onAdd={addWorker} /></td>
      <td className="border-r border-slate-300 p-1"><ReferenceSelect value={draft.taskId} options={tasks} noun="task" onChange={(value) => set('taskId', value)} onAdd={addTask} /></td>
      <td className="border-r border-slate-300 p-1">
        {jobControl ?? (jobReadOnly ? <div className="min-w-[220px] px-2 text-xs text-slate-600">{targets.find((target) => target.value === draft.workTarget)?.label ?? (draft.unlistedLabel || 'Unlinked')}</div> : <WorkIdentityControl value={draft.workTarget} temporaryLabel={draft.unlistedLabel} savedTemporaryLabel={savedTemporaryLabel} targets={targets} onChange={(workTarget, unlistedLabel) => setDraft({ ...draft, workTarget, unlistedLabel })} />)}
      </td>
      <td className="border-r border-slate-300 p-1"><input type="number" min="0" max="24" step="0.25" value={draft.amHours} onChange={(e) => set('amHours', e.target.value)} className={inputClass} /></td>
      <td className="border-r border-slate-300 p-1"><input type="number" min="0" max="24" step="0.25" value={draft.pmHours} onChange={(e) => set('pmHours', e.target.value)} className={inputClass} /></td>
      <td className="border-r border-slate-300 bg-slate-50 px-2 text-center align-middle text-sm font-bold tabular-nums">{Number.isFinite(total) ? total.toFixed(2) : '—'}</td>
      <td className="p-1"><div className="flex min-w-[220px] items-center gap-2"><input value={draft.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Notes" className={inputClass} />{actions}</div></td>
    </>
  );
}

function EditableEntryRow({ entry, targets, workers, tasks, addWorker, addTask, onSaved, selected, onSelected, jobControl }: {
  entry: ManpowerEntry;
  targets: ManpowerWorkTargetOption[];
  workers: ManpowerReference[];
  tasks: ManpowerReference[];
  addWorker: (name: string) => Promise<ManpowerReference>;
  addTask: (name: string) => Promise<ManpowerReference>;
  onSaved: (entry: ManpowerEntry) => void;
  selected: boolean;
  onSelected: (selected: boolean) => void;
  jobControl?: ReactNode;
}) {
  const { categories, refresh } = useContext(ProductContext);
  const [draft, setDraft] = useState(() => entryDraft(entry));
  const [state, setState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (state !== 'saved') return;
    const timeout = window.setTimeout(() => setState('idle'), 1800);
    return () => window.clearTimeout(timeout);
  }, [state]);

  function change(next: Draft) {
    setDraft(next);
    setState(JSON.stringify(next) === JSON.stringify(entryDraft(entry)) ? 'idle' : 'dirty');
    setMessage('');
  }

  async function save() {
    if (state !== 'dirty' && state !== 'error') return;
    const validation = validate(draft) || validateProductSelection(draft.productCategoryId, categories, entry.product_category_id);
    if (validation) { setState('error'); setMessage(validation); return; }
    setState('saving');
    try {
      const changes: Partial<ManpowerEntryInput> = toInput(draft, targets);
      // An unrelated edit must not overwrite a classification saved by another session.
      if (draft.productCategoryId === (entry.product_category_id ?? '')) delete changes.product_category_id;
      const updated = await updateManpowerEntry(entry.id, changes);
      onSaved(updated);
      setState('saved');
      setMessage('');
    } catch (caught) {
      setState('error');
      setMessage(caughtMessage(caught, 'Unable to save entry.'));
      void refresh().catch(() => {});
    }
  }

  return (
    <tr data-manpower-unlinked={!selected && draft.workTarget === UNLISTED_WORK_TARGET ? 'true' : undefined} className={`border-b border-slate-300 align-top ${selected ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : draft.workTarget === UNLISTED_WORK_TARGET ? 'bg-amber-50/50' : 'bg-white'}`} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) void save();
    }}>
      <td className="border-r border-slate-300 px-3 pt-3 text-center"><SelectionCheckbox checked={selected} label={`Select ${entry.worker.display_name} entry on ${entry.work_date}`} onChange={onSelected} /></td>
      <EntryFields allowUncategorized={entry.product_category_id === null} draft={draft} setDraft={change} targets={targets} workers={workers} tasks={tasks} addWorker={addWorker} addTask={addTask} savedTemporaryLabel={entry.unlisted_work_label} jobReadOnly jobControl={jobControl} actions={<span className="shrink-0 text-center text-[10px] font-bold uppercase tracking-wide">
        {state === 'dirty' && <button type="button" onClick={() => void save()} className="text-blue-700">Save</button>}
        {state === 'saving' && <span className="text-slate-500">Saving…</span>}
        {state === 'saved' && <span className="text-emerald-700">Saved</span>}
        {state === 'error' && <button type="button" onClick={() => void save()} title={message} className="text-red-700">Error · Retry</button>}
      </span>} />
    </tr>
  );
}

function BulkActionBar({
  selectedCount,
  targets,
  reportingGroups,
  workers,
  tasks,
  onClear,
  onDelete,
  onApply,
  onApplyCategory,
  categorySelectedCount,
  categoryBusy,
}: {
  selectedCount: number;
  categorySelectedCount: number;
  categoryBusy: boolean;
  onApplyCategory: (categoryId: string) => Promise<void>;
  targets: ManpowerWorkTargetOption[];
  reportingGroups: ManpowerReportingGroup[];
  workers: ManpowerReference[];
  tasks: ManpowerReference[];
  onClear: () => void;
  onDelete: () => Promise<{ deleted: number; failed: number }>;
  onApply: (changes: Partial<ManpowerEntryInput>) => Promise<{ updated: number; failed: number }>;
}) {
  const { categories, refresh } = useContext(ProductContext);
  const [categoryId, setCategoryId] = useState('');
  const activeCategoryId = categories.some((category) => category.id === categoryId && category.is_active) ? categoryId : '';
  const [workDate, setWorkDate] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [workTarget, setWorkTarget] = useState('');
  const [reportingGroupId, setReportingGroupId] = useState('');
  const [unlistedLabel, setUnlistedLabel] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  async function apply(label: string, changes: Partial<ManpowerEntryInput>) {
    setBusy(label);
    setMessage('');
    const result = await onApply(changes);
    setBusy('');
    setMessage(
      result.failed > 0
        ? `${result.updated} updated; ${result.failed} failed. Selection preserved.`
        : `${result.updated} ${result.updated === 1 ? 'row' : 'rows'} updated.`,
    );
  }

  async function removeSelected() {
    if (!window.confirm(`Delete ${selectedCount} selected manpower ${selectedCount === 1 ? 'entry' : 'entries'}? This cannot be undone.`)) return;
    setBusy('delete'); setMessage('');
    const result = await onDelete();
    setBusy('');
    setMessage(result.failed > 0 ? `${result.deleted} deleted; ${result.failed} failed. Failed rows remain selected.` : `${result.deleted} ${result.deleted === 1 ? 'entry' : 'entries'} deleted.`);
  }

  const buttonClass = 'manpower-bulk-action h-8 border border-blue-800 bg-blue-800 px-2 text-[10px] font-bold uppercase tracking-wide text-white enabled:hover:bg-blue-900 enabled:focus-visible:outline-2 enabled:focus-visible:outline-offset-2 enabled:focus-visible:outline-blue-600';
  const compactInput = 'h-8 border border-slate-400 bg-white px-2 text-xs text-slate-950 outline-none focus:border-blue-700';

  return (
    <div className="border-t border-blue-300 bg-blue-50 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-bold text-blue-950">{selectedCount} selected</span>
        <button type="button" onClick={onClear} className="h-8 px-2 text-xs font-bold text-blue-800 hover:bg-blue-100">Deselect all</button>
        <button type="button" onClick={() => void removeSelected()} disabled={(Boolean(busy) || categoryBusy)} className="h-8 border border-red-700 bg-red-700 px-2 text-xs font-bold text-white disabled:opacity-50">{busy === 'delete' ? 'Deleting…' : 'Delete selected'}</button>

        <div className="flex items-center gap-1 border-l border-blue-300 pl-2">
          <select value={reportingGroupId} onChange={(event) => setReportingGroupId(event.target.value)} className={compactInput}>
            <option value="">Reporting Group</option>
            {reportingGroups.map((group) => <option key={group.id} value={group.id}>{group.display_name}</option>)}
          </select>
          <button type="button" disabled={!reportingGroupId || (Boolean(busy) || categoryBusy)} onClick={() => void apply('group', { reporting_group_id: reportingGroupId })} className={buttonClass}>{busy === 'group' ? 'Applying…' : 'Move to Group'}</button>
        </div>

        <div className="flex items-center gap-1 border-l border-blue-300 pl-2">
          <input type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} className={compactInput} />
          <button type="button" disabled={!workDate || (Boolean(busy) || categoryBusy)} onClick={() => void apply('date', { work_date: workDate })} className={buttonClass}>{busy === 'date' ? 'Applying…' : 'Apply Date'}</button>
        </div>

        <div className="flex max-w-full flex-wrap items-center gap-1 border-l border-blue-300 pl-2">
          <select aria-label="Bulk Product Category" value={activeCategoryId} disabled={categoryBusy} onFocus={() => void refresh().catch(() => {})} onChange={(event) => setCategoryId(event.target.value)} className={`${compactInput} min-w-0 max-w-[180px]`}>
            <option value="">Product Category</option>
            {categories.filter((category) => category.is_active).map((category) => <option key={category.id} value={category.id}>{category.display_name}</option>)}
          </select>
          <button type="button" disabled={!activeCategoryId || Boolean(busy) || categoryBusy || categorySelectedCount > MAX_BULK_PRODUCT_ENTRIES} onClick={() => void onApplyCategory(activeCategoryId)} className={buttonClass}>{categoryBusy ? 'Applying…' : 'Apply Category'}</button>
        </div>

        <div className="flex items-center gap-1 border-l border-blue-300 pl-2">
          <select value={workerId} onChange={(event) => setWorkerId(event.target.value)} className={compactInput}>
            <option value="">Worker</option>
            {workers.filter((worker) => worker.is_active).map((worker) => <option key={worker.id} value={worker.id}>{worker.display_name}</option>)}
          </select>
          <button type="button" disabled={!workerId || (Boolean(busy) || categoryBusy)} onClick={() => void apply('worker', { worker_id: workerId })} className={buttonClass}>{busy === 'worker' ? 'Applying…' : 'Apply Worker'}</button>
        </div>

        <div className="flex items-center gap-1 border-l border-blue-300 pl-2">
          <select value={taskId} onChange={(event) => setTaskId(event.target.value)} className={compactInput}>
            <option value="">Task</option>
            {tasks.filter((task) => task.is_active).map((task) => <option key={task.id} value={task.id}>{task.display_name}</option>)}
          </select>
          <button type="button" disabled={!taskId || (Boolean(busy) || categoryBusy)} onClick={() => void apply('task', { task_id: taskId })} className={buttonClass}>{busy === 'task' ? 'Applying…' : 'Apply Task'}</button>
        </div>

        <div className="flex max-w-full flex-wrap items-center gap-1 border-l border-blue-300 pl-2">
          <WorkIdentityControl compact value={workTarget} temporaryLabel={unlistedLabel} targets={targets} onChange={(value, label) => { setWorkTarget(value); setUnlistedLabel(label); }} />
          <button
            type="button"
            disabled={!workTarget || (workTarget === UNLISTED_WORK_TARGET && !unlistedLabel.trim()) || (Boolean(busy) || categoryBusy)}
            onClick={() => void apply('identity', manpowerIdentityForTarget(workTarget, unlistedLabel, targets))}
            className={`${buttonClass} shrink-0 whitespace-nowrap`}
          >{busy === 'identity' ? 'Applying…' : 'Apply Job / Label'}</button>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-blue-900">Category applies to all {categorySelectedCount} selected rows across groups and filters. Other actions use this group’s {selectedCount} selected rows. Maximum {MAX_BULK_PRODUCT_ENTRIES} per category apply.</p>
      {message && <div className={`mt-2 text-xs font-semibold ${message.includes('failed') ? 'text-red-700' : 'text-emerald-700'}`}>{message}</div>}
    </div>
  );
}

export default function ManpowerWorkspace() {
  const { tr } = useLanguage();
  const auth = useAuth();
  const canManageCategories = auth.isAuthenticated && Boolean(auth.profile?.isActive) && auth.can('manageManpowerProductCategories');
  const [categories, setCategories] = useState<ManpowerReference[]>([]);
  const [settingsTab, setSettingsTab] = useState<'workers' | 'tasks' | 'products'>('workers');
  const [categoryEditing, setCategoryEditing] = useState(false);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const settingsPanel = useRef<HTMLElement>(null);
  const [productFilter, setProductFilter] = useState('');
  const [entries, setEntries] = useState<ManpowerEntry[]>([]);
  const [jobs, setJobs] = useState<ManpowerJob[]>([]);
  const [reportingGroups, setReportingGroups] = useState<ManpowerReportingGroup[]>([]);
  const [workers, setWorkers] = useState<ManpowerReference[]>([]);
  const [tasks, setTasks] = useState<ManpowerReference[]>([]);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [search, setSearch] = useState('');
  const [linkedJobId, setLinkedJobId] = useState<string | null>(() => typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('job'));
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [manageReferences, setManageReferences] = useState(false);
  const [referenceEditors, setReferenceEditors] = useState<Set<'worker' | 'task'>>(() => new Set());
  const [referencePanelMessage, setReferencePanelMessage] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [categoryBusy, setCategoryBusy] = useState(false);
  const categoryApplying = useRef(false);
  const [categoryResult, setCategoryResult] = useState<{ error: boolean; message: string } | null>(null);
  const [selectedEmptyGroupIds, setSelectedEmptyGroupIds] = useState<Set<string>>(() => new Set());
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [addingToGroupId, setAddingToGroupId] = useState<string | null>(null);
  const [linkingGroupId, setLinkingGroupId] = useState<string | null>(null);
  const collapseInitialized = useRef(false);
  const newGroupInputRef = useRef<HTMLInputElement | null>(null);
  // Review may include archived Jobs represented in labor; entry-target choices stay unchanged.
  const reviewJobs = useMemo(() => {
    const byId = new Map(entries.flatMap((entry) => entry.job ? [[entry.job.id, entry.job] as const] : []));
    for (const job of jobs) byId.set(job.id, job);
    return [...byId.values()].sort((a, b) => manpowerJobLabel(a).localeCompare(manpowerJobLabel(b)));
  }, [entries, jobs]);
  const targets = useMemo(() => buildManpowerWorkTargetOptions(jobs, entries), [entries, jobs]);

  useEffect(() => {
    if (showNewGroup) newGroupInputRef.current?.focus();
  }, [showNewGroup]);

  const selectJob = (jobId: string) => {
    const url = new URL(window.location.href);
    if (jobId) url.searchParams.set('job', jobId); else url.searchParams.delete('job');
    window.history.pushState(null, '', `${url.pathname}${url.search}`);
    setLinkedJobId(jobId || null);
    setProductFilter('');
  };

  const refreshCategories = useCallback(async () => {
    try { setCategories(await loadProductCategories()); }
    catch (caught) { setError(caughtMessage(caught, 'Unable to refresh Product Categories.')); throw caught; }
  }, []);
  useEffect(() => {
    const refresh = () => { void refreshCategories().catch(() => {}); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refreshCategories]);

  const load = useCallback(async () => {
    setLoading(true); setError(''); setLoadError('');
    try {
      const [loadedEntries, loadedJobs, loadedGroups, loadedWorkers, loadedTasks, loadedCategories] = await Promise.all([
        loadManpowerEntries(), loadManpowerJobs(), loadManpowerReportingGroups(), loadManpowerReferences('manpower_workers'), loadManpowerReferences('manpower_tasks'), loadProductCategories(),
      ]);
      setEntries(loadedEntries); setJobs(loadedJobs); setReportingGroups(loadedGroups); setWorkers(loadedWorkers); setTasks(loadedTasks); setCategories(loadedCategories);
      if (!collapseInitialized.current) {
        setCollapsed(new Set([
          ...loadedGroups.map((group) => group.id),
          ...(loadedEntries.some((entry) => !entry.reporting_group_id) ? ['__ungrouped__'] : []),
        ]));
        collapseInitialized.current = true;
      }
      const loadedIds = new Set(loadedEntries.map((entry) => entry.id));
      setSelectedIds((current) => new Set([...current].filter((id) => loadedIds.has(id))));
    } catch (caught) {
      setLoadError(caughtMessage(caught, 'Unable to load manpower reporting.'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const syncJobFilter = () => { setLinkedJobId(new URLSearchParams(window.location.search).get('job')); setProductFilter(''); };
    window.addEventListener('popstate', syncJobFilter);
    return () => window.removeEventListener('popstate', syncJobFilter);
  }, []);

  useLayoutEffect(() => {
    if (!manageReferences || !settingsPanel.current) return;
    const panel = settingsPanel.current;
    const sizePanel = () => {
      const viewport = window.visualViewport;
      const bottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
      const margin = window.innerWidth < 640 ? 24 : 48;
      // Measure the space below the actual panel top, not below the viewport top.
      const available = bottom - panel.getBoundingClientRect().top - margin;
      panel.style.maxHeight = `${Math.max(180, available)}px`;
    };
    sizePanel();
    const heading = panel.previousElementSibling;
    const observer = new ResizeObserver(sizePanel);
    if (heading) observer.observe(heading);
    window.addEventListener('resize', sizePanel);
    window.visualViewport?.addEventListener('resize', sizePanel);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', sizePanel);
      window.visualViewport?.removeEventListener('resize', sizePanel);
    };
  }, [manageReferences]);

  const setReferenceEditing = useCallback((kind: 'worker' | 'task', editing: boolean) => {
    setReferenceEditors((current) => {
      if (current.has(kind) === editing) return current;
      const next = new Set(current);
      if (editing) next.add(kind); else next.delete(kind);
      return next;
    });
  }, []);

  function closeReferencePanel() {
    if (referenceEditors.size > 0 || categoryEditing) {
      setReferencePanelMessage('Save or cancel the active edit before closing or switching tabs.');
      return;
    }
    setReferencePanelMessage('');
    setManageReferences(false);
    settingsButton.current?.focus();
  }

  function toggleReferencePanel() {
    if (manageReferences) closeReferencePanel();
    else { setReferencePanelMessage(''); setManageReferences(true); }
  }

  async function addReference(kind: 'worker' | 'task', name: string) {
    const current = kind === 'worker' ? workers : tasks;
    const created = await createManpowerReference(kind === 'worker' ? 'manpower_workers' : 'manpower_tasks', name, (Math.max(0, ...current.map((item) => item.sort_order)) + 1));
    if (kind === 'worker') setWorkers((items) => sortReferences([...items, created]));
    else setTasks((items) => sortReferences([...items, created]));
    return created;
  }

  async function createManagedReference(kind: 'worker' | 'task', name: string, order: number) {
    const created = await createManpowerReference(kind === 'worker' ? 'manpower_workers' : 'manpower_tasks', name, order);
    if (kind === 'worker') setWorkers((items) => sortReferences([...items, created]));
    else setTasks((items) => sortReferences([...items, created]));
  }

  async function updateReference(kind: 'worker' | 'task', reference: ManpowerReference, changes: Partial<Pick<ManpowerReference, 'display_name' | 'sort_order' | 'is_active'>>) {
    setError('');
    try {
      const updated = await updateManpowerReference(kind === 'worker' ? 'manpower_workers' : 'manpower_tasks', reference.id, changes);
      const update = (items: ManpowerReference[]) => sortReferences(items.map((item) => item.id === updated.id ? updated : item));
      if (kind === 'worker') setWorkers(update);
      else setTasks(update);
    } catch (caught) { setError(caughtMessage(caught, 'Unable to update reference data.')); throw caught; }
  }

  async function createEntry() {
    const validation = validate(draft) || validateProductSelection(draft.productCategoryId, categories);
    if (validation) { setError(validation); return; }
    setSaving(true); setError('');
    try {
      const created = await createManpowerEntry(toInput(draft, targets));
      setEntries((items) => [created, ...items]);
      setDraft({ ...blankDraft(), reportingGroupId: draft.reportingGroupId, workDate: draft.workDate, workTarget: draft.workTarget, unlistedLabel: draft.unlistedLabel });
    } catch (caught) { setError(caughtMessage(caught, 'Unable to add labor entry.')); void refreshCategories().catch(() => {}); }
    finally { setSaving(false); }
  }

  async function createGroup() {
    if (!newGroupName.trim()) return;
    setCreatingGroup(true); setError('');
    try {
      const created = await createManpowerReportingGroup(newGroupName);
      setReportingGroups((groups) => [created, ...groups]);
      setCollapsed((current) => { const next = new Set(current); next.delete(created.id); return next; });
      setDraft({
        ...blankDraft(),
        reportingGroupId: created.id,
        workTarget: UNLISTED_WORK_TARGET,
        unlistedLabel: created.display_name,
      });
      setAddingToGroupId(created.id);
      setNewGroupName('');
      setShowNewGroup(false);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to create reporting group.'); }
    finally { setCreatingGroup(false); }
  }

  async function renameGroup(group: ManpowerReportingGroup, displayName: string) {
    if (!displayName.trim() || displayName.trim() === group.display_name) return;
    setError('');
    try {
      const updated = await updateManpowerReportingGroup(group.id, displayName);
      setReportingGroups((groups) => groups.map((item) => item.id === updated.id ? updated : item));
    } catch (caught) { setError(caughtMessage(caught, 'Unable to rename reporting group.')); throw caught; }
  }

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const groups = useMemo(() => {
    const grouped = new Map<string, { key: string; label: string; group: ManpowerReportingGroup | null; entries: ManpowerEntry[] }>();
    for (const group of reportingGroups) {
      grouped.set(group.id, { key: group.id, label: group.display_name, group, entries: [] });
    }
    for (const entry of entries) {
      if (linkedJobId && entry.job_id !== linkedJobId) continue;
      if (productFilter && productKey(entry) !== productFilter) continue;
      const key = entry.reporting_group_id ?? '__ungrouped__';
      const label = entry.reporting_group?.display_name ?? 'Ungrouped entries';
      const group = grouped.get(key) ?? { key, label, group: entry.reporting_group, entries: [] };
      group.entries.push(entry); grouped.set(key, group);
    }
    const sortedGroups = [...grouped.values()].filter((group) => (!linkedJobId && !productFilter) || group.entries.length > 0).sort((a, b) => {
      if (a.group && b.group) {
        const aDate = groupReportingDate(a.group);
        const bDate = groupReportingDate(b.group);
        if (aDate !== null && bDate !== null && aDate !== bDate) return bDate - aDate;
        if (aDate !== null && bDate === null) return -1;
        if (aDate === null && bDate !== null) return 1;
        const createdDifference = b.group.created_at.localeCompare(a.group.created_at);
        if (createdDifference !== 0) return createdDifference;
        const nameDifference = a.group.display_name.localeCompare(b.group.display_name);
        if (nameDifference !== 0) return nameDifference;
        return a.group.id.localeCompare(b.group.id);
      }
      if (a.group && !b.group) return -1;
      if (!a.group && b.group) return 1;
      return a.label.localeCompare(b.label);
    });
    if (!normalizedSearch) return sortedGroups;
    return sortedGroups
      .map((group) => ({
        ...group,
        entries: group.entries.filter((entry) => [
          group.label,
          entry.work_date,
          entry.worker.display_name,
          entry.task.display_name,
          productLabel(productKey(entry), categories),
          entry.job?.name,
          entry.job?.job_number,
          entry.rework_cycle ? `REWORK #${entry.rework_cycle.sequence_number}` : null,
          entry.unlisted_work_label,
          entry.notes,
          entry.entered_by,
        ].some((value) => value?.toLocaleLowerCase().includes(normalizedSearch))),
      }))
      .filter((group) => group.entries.length > 0);
  }, [entries, linkedJobId, productFilter, normalizedSearch, reportingGroups, categories]);

  function startAddingToGroup(groupId: string, groupEntries: ManpowerEntry[], groupLabel: string) {
    const identities = new Map<string, Pick<Draft, 'workTarget' | 'unlistedLabel'>>();
    for (const entry of groupEntries) {
      const key = entry.rework_cycle_id ? `rework:${entry.rework_cycle_id}` : entry.job_id ? `job:${entry.job_id}` : `temporary:${entry.unlisted_work_label}`;
      identities.set(key, {
        workTarget: manpowerEntryTargetValue(entry),
        unlistedLabel: entry.unlisted_work_label ?? '',
      });
    }
    const identity = identities.size === 1 ? [...identities.values()][0] : null;
    setDraft({
      ...blankDraft(),
      reportingGroupId: groupId,
      workTarget: identity?.workTarget ?? (groupEntries.length === 0 ? UNLISTED_WORK_TARGET : ''),
      unlistedLabel: identity?.unlistedLabel ?? (groupEntries.length === 0 ? groupLabel : ''),
    });
    setAddingToGroupId(groupId);
  }

  function replaceEntry(updated: ManpowerEntry) {
    setEntries((items) => items.map((entry) => entry.id === updated.id ? updated : entry));
  }

  function setEntrySelected(id: string, selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function setGroupSelected(ids: string[], selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (selected) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function applyBulkCategory(categoryId: string) {
    if (categoryApplying.current) return;
    const ids = [...selectedIds];
    const validation = validateProductSelection(categoryId, categories);
    if (validation || ids.length > MAX_BULK_PRODUCT_ENTRIES) {
      setCategoryResult({ error: true, message: validation || `Select at most ${MAX_BULK_PRODUCT_ENTRIES} rows. No rows were changed.` });
      return;
    }
    categoryApplying.current = true;
    setCategoryBusy(true); setCategoryResult(null);
    try {
      const updated = await updateManpowerProductCategory(ids, categoryId);
      const byId = new Map(updated.map((entry) => [entry.id, entry]));
      setEntries((items) => items.map((entry) => byId.get(entry.id) ?? entry));
      setGroupSelected(ids, false);
      setCategoryResult({ error: false, message: `Product Category applied to ${updated.length} ${updated.length === 1 ? 'row' : 'rows'}. Hours and other labor facts unchanged.` });
    } catch (caught) {
      // A rejected SQL statement rolls back. A lost response or omitted RLS row is
      // ambiguous; reload authoritative values without retrying the write.
      const [labor, choices] = await Promise.allSettled([loadManpowerEntries(), loadProductCategories()]);
      if (labor.status === 'fulfilled') setEntries(labor.value);
      else setLoadError('Unable to reconcile labor after the category request. Refresh before relying on totals.');
      if (choices.status === 'fulfilled') setCategories(choices.value);
      setCategoryResult({ error: true, message: `Category application was not confirmed: ${caughtMessage(caught, 'Request failed.')} Selection preserved. ${labor.status === 'fulfilled' ? 'Current labor values reloaded; review before retrying.' : 'Labor refresh failed.'} ${choices.status === 'rejected' ? 'Category refresh failed; refresh before retrying.' : 'Category choices refreshed.'}` });
    } finally {
      categoryApplying.current = false; setCategoryBusy(false);
    }
  }

  async function applyBulkUpdate(
    ids: string[],
    changes: Partial<ManpowerEntryInput>,
  ) {
    setError('');
    const result = await updateManpowerEntries(ids, changes);
    if (result.updated.length > 0) {
      const updates = new Map(result.updated.map((entry) => [entry.id, entry]));
      setEntries((items) => items.map((entry) => updates.get(entry.id) ?? entry));
    }
    if (result.failures.length === 0) {
      setGroupSelected(ids, false);
    } else {
      setError(`${result.failures.length} bulk update ${result.failures.length === 1 ? 'failed' : 'updates failed'}. Selection was preserved so you can retry.`);
    }
    return { updated: result.updated.length, failed: result.failures.length };
  }

  async function applyGroupIdentity(groupKey: string, groupEntries: ManpowerEntry[], changes: Pick<ManpowerEntryInput, 'job_id' | 'rework_cycle_id' | 'unlisted_work_label'>) {
    setLinkingGroupId(groupKey);
    setError('');
    try {
      const updated = await updateManpowerGroupIdentity(groupEntries.map((entry) => entry.id), changes);
      const updates = new Map(updated.map((entry) => [entry.id, entry]));
      setEntries((items) => items.map((entry) => updates.get(entry.id) ?? entry));
    } catch (caught) {
      setError(caught instanceof Error ? `Unable to change this manpower group's Job: ${caught.message}` : "Unable to change this manpower group's Job.");
    } finally {
      setLinkingGroupId(null);
    }
  }

  async function linkReportingGroup(groupKey: string, groupEntries: ManpowerEntry[], workTarget: string, previousJobName: string) {
    const identity = workTarget
      ? manpowerIdentityForTarget(workTarget, '', targets)
      : { job_id: null, rework_cycle_id: null, unlisted_work_label: previousJobName };
    const destination = workTarget
      ? targets.find((target) => target.value === workTarget)?.label ?? 'selected Production target'
      : `temporary label “${previousJobName}”`;
    if (groupEntries.length > 1 && !window.confirm(`Change ${groupEntries.length} manpower entries to ${destination}?`)) return;
    await applyGroupIdentity(groupKey, groupEntries, identity);
  }

  async function renameUnlinkedGroup(groupKey: string, groupEntries: ManpowerEntry[], jobName: string) {
    const normalized = jobName.trim();
    if (!normalized) return;
    if (groupEntries.length > 1 && !window.confirm(`Change ${groupEntries.length} manpower entries to temporary label “${normalized}”?`)) return;
    await applyGroupIdentity(groupKey, groupEntries, { job_id: null, rework_cycle_id: null, unlisted_work_label: normalized });
  }

  async function deleteSelectedEntries(ids: string[]) {
    setError('');
    const result = await deleteManpowerEntries(ids);
    const deleted = new Set(result.deletedIds);
    if (deleted.size > 0) setEntries((items) => items.filter((entry) => !deleted.has(entry.id)));
    const attempted = new Set(ids);
    const failed = new Set(result.failures.map((failure) => failure.id));
    setSelectedIds((current) => new Set([...current].filter((id) => !attempted.has(id) || failed.has(id))));
    if (result.failures.length > 0) setError(`${result.failures.length} selected ${result.failures.length === 1 ? 'entry' : 'entries'} could not be deleted. Failed rows remain selected.`);
    return { deleted: result.deletedIds.length, failed: result.failures.length };
  }

  async function deleteSelectedEmptyGroup(group: ManpowerReportingGroup) {
    if (!window.confirm(`Delete empty reporting group "${group.display_name}"?`)) return;
    setError('');
    try {
      await deleteEmptyManpowerReportingGroup(group.id);
      setReportingGroups((groups) => groups.filter((item) => item.id !== group.id));
      setSelectedEmptyGroupIds((current) => {
        const next = new Set(current);
        next.delete(group.id);
        return next;
      });
      if (addingToGroupId === group.id) setAddingToGroupId(null);
    } catch (caught) {
      setError(caughtMessage(caught, 'Unable to delete the empty reporting group. It may now contain labor entries.'));
    }
  }

  return (
    <ProductContext.Provider value={{ categories, refresh: refreshCategories }}><div className="mx-auto w-full max-w-[1800px] px-3 py-5 sm:px-5 sm:py-7">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{tr('Operations Reporting','Reportes de operaciones')}</div><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{tr('Manpower Reporting','Reporte de mano de obra')}</h1><p className="mt-1 text-sm text-slate-600">{tr('Record shop labor by job, worker, task, and work date.','Registre las horas del taller por trabajo, empleado, tarea y fecha de trabajo.')}</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" ref={settingsButton} aria-expanded={manageReferences} aria-controls="manpower-settings" onClick={toggleReferencePanel} className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-700 transition hover:border-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><Settings2 className="h-4 w-4" /> {tr('Manpower Settings','Configuración de mano de obra')}</button>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-700 transition hover:border-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-60"><RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> {tr('Refresh','Actualizar')}</button>
        </div>
      </div>


      {manageReferences && <section ref={settingsPanel} id="manpower-settings" aria-label="Manpower Settings" className="mx-auto mt-4 flex max-h-[calc(100svh-4rem)] w-full max-w-[1080px] flex-col rounded-sm border border-slate-200 bg-white p-3 shadow-sm sm:w-[calc(100%-1rem)] sm:p-4">
        <div className="flex shrink-0 items-center justify-between gap-3"><h2 className="text-sm font-bold text-slate-900">Manpower Settings</h2><button type="button" onClick={closeReferencePanel} className="h-9 border border-slate-300 bg-white px-3 text-xs font-bold focus-visible:ring-2 focus-visible:ring-blue-600">Close settings</button></div>
        <div role="tablist" aria-label="Manpower vocabularies" className="my-3 flex shrink-0 border-b border-slate-200">
          {(['workers', 'tasks', ...(canManageCategories ? ['products'] : [])] as ('workers' | 'tasks' | 'products')[]).map(tab => <button key={tab} id={`settings-tab-${tab}`} type="button" role="tab" aria-selected={settingsTab === tab} aria-controls={`settings-panel-${tab}`} tabIndex={settingsTab === tab ? 0 : -1} onClick={() => {
            if (referenceEditors.size || categoryEditing) { setReferencePanelMessage('Save or cancel the active edit before closing or switching tabs.'); return; }
            setReferencePanelMessage(''); setSettingsTab(tab);
          }} onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            if (referenceEditors.size || categoryEditing) { setReferencePanelMessage('Save or cancel the active edit before closing or switching tabs.'); return; }
            const tabs = canManageCategories ? ['workers', 'tasks', 'products'] as const : ['workers', 'tasks'] as const;
            const index = tabs.indexOf(tab as 'workers' | 'tasks');
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
            setSettingsTab(tabs[next]); document.getElementById(`settings-tab-${tabs[next]}`)?.focus();
          }} className={`min-h-11 min-w-0 px-3 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-blue-600 ${settingsTab === tab ? 'border-b-2 border-blue-700 text-blue-800' : 'text-slate-600'}`}>{tab === 'products' ? 'Product Categories' : tab === 'workers' ? 'Workers' : 'Tasks'}</button>)}
        </div>
        {referencePanelMessage && <p role="alert" className="mb-3 text-xs text-amber-900">{referencePanelMessage}</p>}
        <div data-settings-content className="flex min-h-0 flex-col">
        <div role="tabpanel" className={`min-h-0 flex-col ${settingsTab === 'workers' ? 'flex' : 'hidden'}`} id="settings-panel-workers" aria-labelledby="settings-tab-workers" hidden={settingsTab !== 'workers'}><ReferenceManager noun="worker" options={workers} onCreate={(name, order) => createManagedReference('worker', name, order)} onUpdate={(reference, changes) => updateReference('worker', reference, changes)} onEditingChange={(editing) => setReferenceEditing('worker', editing)} /></div>
        <div role="tabpanel" className={`min-h-0 flex-col ${settingsTab === 'tasks' ? 'flex' : 'hidden'}`} id="settings-panel-tasks" aria-labelledby="settings-tab-tasks" hidden={settingsTab !== 'tasks'}><ReferenceManager noun="task" options={tasks} onCreate={(name, order) => createManagedReference('task', name, order)} onUpdate={(reference, changes) => updateReference('task', reference, changes)} onEditingChange={(editing) => setReferenceEditing('task', editing)} /></div>
        {canManageCategories && <div role="tabpanel" className={`min-h-0 flex-col ${settingsTab === 'products' ? 'flex' : 'hidden'}`} id="settings-panel-products" aria-labelledby="settings-tab-products" hidden={settingsTab !== 'products'}><ProductCategoryManager categories={categories} onChanged={refreshCategories} onEditingChange={setCategoryEditing} /></div>}
        </div>
      </section>}

      {categoryResult && <div role={categoryResult.error ? "alert" : "status"} className={`mt-4 border px-4 py-3 text-sm font-semibold ${categoryResult.error ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>{categoryResult.message}</div>}
      {error && <div className="mt-4 border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div>}

      <div className="mt-5 space-y-3">
        <div className="grid grid-cols-1 items-center gap-3 lg:grid-cols-[max-content_minmax(0,1fr)_max-content]">
          <label className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-semibold text-slate-600 sm:flex-nowrap"><span className="shrink-0 whitespace-nowrap">Job labor review</span>
            <select aria-label="Job labor review" className={`${inputClass} sm:flex-1 lg:w-auto lg:max-w-xs lg:flex-none`} value={linkedJobId ?? ''} onChange={(event) => selectJob(event.target.value)}>
              <option value="">All reporting groups</option>
              {linkedJobId && !reviewJobs.some((job) => job.id === linkedJobId) && <option value={linkedJobId}>Selected Production job</option>}
              {reviewJobs.map((job) => <option key={job.id} value={job.id}>{manpowerJobLabel(job)}{job.archived_at ? ' · Archived' : ''}</option>)}
            </select>
          </label>
          <label className="relative block w-full min-w-0">
            <span className="sr-only">{tr('Search manpower','Buscar registros de mano de obra')}</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr('Search manpower…','Buscar mano de obra…')} className={`${inputClass} pl-9 placeholder:font-semibold`} />
          </label>
          {!showNewGroup ? <button type="button" onClick={() => setShowNewGroup(true)} disabled={Boolean(normalizedSearch || productFilter || linkedJobId) || loading || Boolean(loadError)} title="Clear filters before creating an empty group" className="inline-flex h-9 w-max shrink-0 items-center gap-1.5 whitespace-nowrap border border-blue-400 bg-blue-50 px-3 text-xs font-bold uppercase tracking-wide text-blue-800 enabled:hover:bg-blue-100 enabled:active:bg-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:saturate-0"><Plus className="h-4 w-4" /> {tr('New Group','Nuevo grupo')}</button> : <div className="flex min-w-0 flex-wrap items-center gap-1 border border-slate-400 bg-white p-1 lg:col-span-3"><input ref={newGroupInputRef} value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void createGroup(); } if (event.key === 'Escape') { setShowNewGroup(false); setNewGroupName(''); } }} placeholder={tr('Reporting group name','Nombre del grupo de reporte')} className="h-8 w-72 min-w-0 max-w-full px-2 text-sm outline-none" /><button type="button" onClick={() => void createGroup()} disabled={creatingGroup || !newGroupName.trim() || Boolean(normalizedSearch || productFilter || linkedJobId)} className="h-8 bg-slate-900 px-3 text-xs font-bold text-white disabled:opacity-50">{creatingGroup ? tr('Creating…','Creando…') : tr('Create','Crear')}</button><button type="button" onClick={() => { setShowNewGroup(false); setNewGroupName(''); }} className="h-8 px-2 text-xs font-bold text-slate-600">{tr('Cancel','Cancelar')}</button></div>}
          {linkedJobId && <button type="button" onClick={() => selectJob('')} className="justify-self-start py-2 text-xs font-semibold text-slate-500 underline">Clear job filter</button>}
        </div>
        <ManpowerAnalytics entries={entries} categories={categories} tasks={tasks} jobId={linkedJobId} productFocus={productFilter} loading={loading} error={loadError} />
        {linkedJobId && !loading && !loadError && <ProductLaborSummary key={linkedJobId} entries={groups.flatMap((group) => group.entries)} totalEntries={entries.filter((entry) => entry.job_id === linkedJobId)} categories={categories} tasks={tasks}>
          <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">Product Category filter<select aria-label="Product Category filter" className={`${inputClass} max-w-xs`} value={productFilter} onFocus={() => void refreshCategories().catch(() => {})} onChange={(event) => setProductFilter(event.target.value)}><option value="">All Products</option>{categories.filter((category) => category.is_active || entries.some((entry) => entry.product_category_id === category.id)).map((category) => <option key={category.id} value={category.id}>{category.display_name}{category.is_active ? '' : ' · Inactive'}</option>)}<option value={UNCATEGORIZED}>Uncategorized</option></select></label>
        </ProductLaborSummary>}
        {(normalizedSearch || productFilter || linkedJobId) && <p className="text-xs text-slate-500">Clear filters to create an empty group or change a whole group’s Job.</p>}
        <p className="text-xs text-slate-500">Choose one Product Category per line. Split hours across separate lines when labor belongs to different products.</p>


        {loading ? <div className="border border-slate-400 bg-white p-8 text-center text-sm text-slate-600">Loading manpower entries…</div> : loadError ? <div role="alert" className="border border-red-300 bg-red-50 p-4 text-sm text-red-800">{loadError}</div> : groups.length === 0 ? <div className="border border-slate-400 bg-white p-8 text-center text-sm text-slate-600">{linkedJobId ? 'No manpower reporting groups are linked to this Production job.' : normalizedSearch || productFilter ? 'No manpower entries match your filters.' : 'No reporting groups yet. Create the first group to begin.'}</div> : groups.map((group) => {
          const identityEntries = entries.filter((entry) => (entry.reporting_group_id ?? '__ungrouped__') === group.key);
          const identityFiltered = Boolean(normalizedSearch || productFilter || linkedJobId);
          const isCollapsed = normalizedSearch || productFilter ? false : collapsed.has(group.key);
          const am = group.entries.reduce((sum, entry) => sum + Number(entry.am_hours), 0);
          const pm = group.entries.reduce((sum, entry) => sum + Number(entry.pm_hours), 0);
          const groupIds = group.entries.map((entry) => entry.id);
          const emptyGroupSelected = identityEntries.length === 0 && selectedEmptyGroupIds.has(group.key);
          const selectedGroupIds = groupIds.filter((id) => selectedIds.has(id));
          const allSelected = groupIds.length > 0 && selectedGroupIds.length === groupIds.length;
          const someSelected = selectedGroupIds.length > 0 && !allSelected;
          const linkedJobIds = [...new Set(identityEntries.map((entry) => entry.job_id).filter((id): id is string => Boolean(id)))];
          const groupJobId = linkedJobIds.length === 1 && identityEntries.every((entry) => entry.job_id === linkedJobIds[0]) ? linkedJobIds[0] : '';
          const groupJob = jobs.find((job) => job.id === groupJobId);
          const lifecycleIdentities = new Set(identityEntries.map((entry) => entry.job_id
            ? manpowerEntryTargetValue(entry)
            : `${UNLISTED_WORK_TARGET}:${entry.unlisted_work_label}`));
          const groupTargetValue = lifecycleIdentities.size === 1 && identityEntries.length > 0
            ? manpowerEntryTargetValue(identityEntries[0])
            : '';
          const groupTargetLabel = lifecycleIdentities.size === 1 && identityEntries.length > 0
            ? targets.find((target) => target.value === groupTargetValue)?.label ?? identityEntries[0].unlisted_work_label ?? ''
            : group.entries.length > 0 ? 'Mixed lifecycle targets' : '';
          const previousJobName = identityEntries.find((entry) => entry.unlisted_work_label?.trim())?.unlisted_work_label?.trim() || group.label;
          const newEntryJobCell = <div className="min-w-[220px] px-2 text-xs font-semibold text-slate-700">{targets.find((target) => target.value === draft.workTarget)?.label ?? (draft.unlistedLabel || 'Choose a work target')}</div>;
          const temporaryGroupJobCell = <input key={`${group.key}:${previousJobName}`} disabled={identityFiltered} defaultValue={previousJobName} aria-label={`Job name for ${group.label}`} onBlur={(event) => { if (event.target.value.trim() !== previousJobName) void renameUnlinkedGroup(group.key, identityEntries, event.target.value); }} className="h-8 min-w-[220px] w-full border border-slate-300 bg-white px-2 text-xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-200" />;
          return (
            <section key={group.key} className={`overflow-hidden rounded-sm border bg-white ${selectedGroupIds.length > 0 || emptyGroupSelected ? 'border-blue-600' : 'border-slate-200'}`}>
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2.5 text-slate-800">
                <SelectionCheckbox
                  checked={emptyGroupSelected || allSelected}
                  indeterminate={someSelected}
                  label={identityEntries.length === 0 ? `Select empty group ${group.label}` : `Select all entries in ${group.label}`}
                  onChange={(checked) => {
                    if (group.entries.length > 0) {
                      setGroupSelected(groupIds, checked);
                      return;
                    }
                    setSelectedEmptyGroupIds((current) => {
                      const next = new Set(current);
                      if (checked) next.add(group.key);
                      else next.delete(group.key);
                      return next;
                    });
                  }}
                />
                <button type="button" onClick={() => setCollapsed((current) => { const next = new Set(current); if (next.has(group.key)) next.delete(group.key); else next.add(group.key); return next; })} className="shrink-0" aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${group.label}`}>
                  {isCollapsed ? <ChevronRight className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                </button>
                {group.group ? <ReportingGroupName group={group.group} onRename={(name) => renameGroup(group.group!, name)} /> : <span className="min-w-0 truncate text-sm font-bold text-slate-950">{group.label}</span>}
                {groupJob ? <JobTag label={manpowerJobLabel(groupJob)} onClick={() => openProductionJob(groupJob.id)} title={`Open ${manpowerJobLabel(groupJob)} in Production`} className="max-w-[140px] shrink-0" /> : <span className="shrink-0 rounded-sm bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-700">{lifecycleIdentities.size > 1 ? 'Mixed' : 'Unlinked'}</span>}
                <span className="min-w-0 flex-1" />
                <span className="shrink-0 rounded-sm bg-white px-2 py-1 text-xs font-bold text-slate-700">{group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}</span>
                {isCollapsed && selectedGroupIds.length > 0 && <span className="shrink-0 rounded bg-blue-500 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">{selectedGroupIds.length} selected</span>}
                <span className="shrink-0 rounded-sm bg-white px-2 py-1 text-xs font-bold tabular-nums text-slate-600">AM {am.toFixed(1)} hrs</span>
                <span className="shrink-0 rounded-sm bg-white px-2 py-1 text-xs font-bold tabular-nums text-slate-600">PM {pm.toFixed(1)} hrs</span>
                <span className="shrink-0 rounded-sm bg-slate-900 px-2.5 py-1.5 text-xs font-extrabold tabular-nums text-white">{identityFiltered ? 'MATCHING' : 'TOTAL'} {(am + pm).toFixed(2)} hrs</span>
              </div>
              {!isCollapsed && group.group && addingToGroupId !== group.key && <div className="border-b border-slate-200 bg-white px-3 py-1.5"><button type="button" onClick={() => startAddingToGroup(group.group!.id, identityEntries, group.label)} className="inline-flex h-8 items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-blue-800 hover:text-blue-950"><Plus className="h-4 w-4" /> {tr('Add New Line','Agregar renglón')}</button></div>}
              {!isCollapsed && <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span className="flex-1">{groupJob ? tr('This manpower group is linked to the Production job. Labor recorded here contributes to the Current Hours shown in the Production Pipeline.','Este grupo de mano de obra está vinculado al trabajo de Producción. Las horas registradas aquí se incluyen en las horas registradas del flujo de producción.') : tr('This manpower group is not linked to a Production job. Labor recorded here will not appear in Production until a job is linked.','Este grupo de mano de obra no está vinculado a un trabajo de Producción. Las horas registradas aquí no aparecerán en Producción hasta que se vincule un trabajo.')}</span>
                <ProductionJobLinkSelector groupLabel={group.label} targets={targets} value={groupTargetValue} selectedLabel={groupTargetLabel} disabled={linkingGroupId === group.key || identityFiltered} onChange={(workTarget) => void linkReportingGroup(group.key, identityEntries, workTarget, previousJobName)} />
              </div>}
              {selectedGroupIds.length > 0 && <BulkActionBar categorySelectedCount={selectedIds.size} categoryBusy={categoryBusy} onApplyCategory={applyBulkCategory} selectedCount={selectedGroupIds.length} targets={targets} reportingGroups={reportingGroups} workers={workers} tasks={tasks} onClear={() => setGroupSelected(groupIds, false)} onDelete={() => deleteSelectedEntries(selectedGroupIds)} onApply={(changes) => applyBulkUpdate(selectedGroupIds, changes)} />}
              {emptyGroupSelected && group.group && <div className="flex items-center justify-between border-b border-blue-200 bg-blue-50 px-3 py-2 text-xs"><span className="font-semibold text-blue-900">Empty group selected</span><div className="flex items-center gap-3"><button type="button" onClick={() => setSelectedEmptyGroupIds((current) => { const next = new Set(current); next.delete(group.key); return next; })} className="font-bold text-slate-600 hover:underline">Clear selection</button><button type="button" onClick={() => void deleteSelectedEmptyGroup(group.group!)} className="h-8 border border-red-500 bg-white px-3 font-bold text-red-700 hover:bg-red-50">Delete Empty Group</button></div></div>}
              {!isCollapsed && <div className="overflow-x-auto"><table className="w-full min-w-[1480px] border-collapse"><thead><tr><th className={`${headerClass} w-12 text-center`}>Select</th><th className={headerClass}>Work Date</th><th className={headerClass}>Product Category</th><th className={headerClass}>Worker</th><th className={headerClass}>Task</th><th className={headerClass}>Job</th><th className={headerClass}>AM Hours</th><th className={headerClass}>PM Hours</th><th className={headerClass}>Total</th><th className={headerClass}>Notes</th></tr></thead><tbody>{addingToGroupId === group.key && group.group && <tr className="border-b-2 border-blue-500 bg-blue-50 align-top"><td className="border-r border-slate-300 px-2 pt-3 text-center text-[9px] font-bold uppercase text-blue-700">New</td><EntryFields draft={draft} setDraft={setDraft} targets={targets} workers={workers} tasks={tasks} addWorker={(name) => addReference('worker', name)} addTask={(name) => addReference('task', name)} jobReadOnly={Boolean(draft.workTarget)} jobControl={draft.workTarget ? newEntryJobCell : undefined} actions={<div className="flex gap-1"><button type="button" onClick={() => void createEntry()} disabled={saving} className="h-9 whitespace-nowrap bg-slate-900 px-3 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-50">{saving ? 'Saving…' : 'Add Entry'}</button><button type="button" onClick={() => setAddingToGroupId(null)} disabled={saving} className="h-9 whitespace-nowrap border border-slate-400 bg-white px-2 text-xs font-bold text-slate-700">Cancel</button></div>} /></tr>}{group.entries.map((entry) => <EditableEntryRow key={`${entry.id}:${entry.updated_at}`} entry={entry} targets={targets} workers={workers} tasks={tasks} addWorker={(name) => addReference('worker', name)} addTask={(name) => addReference('task', name)} onSaved={replaceEntry} selected={selectedIds.has(entry.id)} onSelected={(selected) => setEntrySelected(entry.id, selected)} jobControl={groupTargetValue === UNLISTED_WORK_TARGET ? temporaryGroupJobCell : <div className="min-w-[220px] px-2 text-xs font-semibold text-slate-700">{targets.find((target) => target.value === manpowerEntryTargetValue(entry))?.label ?? entry.unlisted_work_label ?? 'Unlinked'}</div>} />)}</tbody></table></div>}
            </section>
          );
        })}
      </div>
    </div></ProductContext.Provider>
  );
}
