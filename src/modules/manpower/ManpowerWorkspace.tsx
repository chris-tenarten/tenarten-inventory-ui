'use client';

import { ChevronDown, ChevronRight, Pencil, Plus, RotateCw, Search, Settings2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { JobTag } from '../production/components/JobTag';
import ProductionStatusBadge from '../production/components/ProductionStatusBadge';
import { openProductionJob } from '../production/job-options';
import { productionStatusVisualByValue } from '../production/status-visuals';
import {
  createManpowerEntry,
  createManpowerReference,
  createManpowerReportingGroup,
  deleteManpowerEntries,
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

type Draft = {
  reportingGroupId: string;
  workDate: string;
  workerId: string;
  taskId: string;
  jobChoice: string;
  unlistedLabel: string;
  amHours: string;
  pmHours: string;
  notes: string;
};

const UNLISTED = '__unlisted__';
const inputClass = 'h-9 w-full min-w-0 rounded-sm border border-slate-300 bg-white px-2 text-sm outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100';
const headerClass = 'border-b border-r border-slate-200 bg-slate-100 px-2 py-2 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600';

function today() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function blankDraft(): Draft {
  return {
    reportingGroupId: '', workDate: today(), workerId: '', taskId: '', jobChoice: '', unlistedLabel: '',
    amHours: '', pmHours: '', notes: '',
  };
}

function entryDraft(entry: ManpowerEntry): Draft {
  return {
    reportingGroupId: entry.reporting_group_id ?? '',
    workDate: entry.work_date,
    workerId: entry.worker_id,
    taskId: entry.task_id,
    jobChoice: entry.job_id ?? UNLISTED,
    unlistedLabel: entry.unlisted_work_label ?? '',
    amHours: String(entry.am_hours),
    pmHours: String(entry.pm_hours),
    notes: entry.notes ?? '',
  };
}

function toInput(draft: Draft): ManpowerEntryInput {
  return {
    reporting_group_id: draft.reportingGroupId || null,
    work_date: draft.workDate,
    worker_id: draft.workerId,
    task_id: draft.taskId,
    job_id: draft.jobChoice === UNLISTED ? null : draft.jobChoice,
    unlisted_work_label: draft.jobChoice === UNLISTED ? draft.unlistedLabel.trim() : null,
    am_hours: Number(draft.amHours || 0),
    pm_hours: Number(draft.pmHours || 0),
    notes: draft.notes.trim() || null,
  };
}

function validate(draft: Draft) {
  if (!draft.reportingGroupId || !draft.workDate || !draft.workerId || !draft.taskId || !draft.jobChoice) return 'Reporting group, date, worker, task, and job are required.';
  if (draft.jobChoice === UNLISTED && !draft.unlistedLabel.trim()) return 'Enter the unlisted job or work label.';
  const am = Number(draft.amHours || 0);
  const pm = Number(draft.pmHours || 0);
  if (!Number.isFinite(am) || !Number.isFinite(pm) || am < 0 || pm < 0) return 'Hours must be valid nonnegative numbers.';
  if (am + pm > 24) return 'AM and PM hours cannot total more than 24.';
  return '';
}

function jobLabel(job: Pick<ManpowerJob, 'name' | 'job_number'>) {
  return job.job_number ? `${job.job_number} — ${job.name}` : job.name;
}

function jobOptionLabel(job: ManpowerJob) {
  return `${jobLabel(job)} — ${productionStatusVisualByValue[job.production_status].label}`;
}

function ProductionJobLinkSelector({ groupLabel, jobs, value, disabled, onChange }: { groupLabel: string; jobs: ManpowerJob[]; value: string; disabled: boolean; onChange(value: string): void }) {
  const [open, setOpen] = useState(false);
  const selectedJob = jobs.find((job) => job.id === value);

  return <div className="relative min-w-72" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <button type="button" aria-label={`Production job for ${groupLabel}`} aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => setOpen((current) => !current)} className="flex h-9 w-full items-center justify-between gap-3 rounded-sm border border-slate-300 bg-white px-2 text-left text-xs text-slate-800 outline-none transition hover:border-slate-500 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-wait disabled:opacity-60">
      <span className="min-w-0 truncate font-medium">{selectedJob ? jobLabel(selectedJob) : 'Not Linked to Production'}</span>
      <span className="flex shrink-0 items-center gap-2">{selectedJob ? <ProductionStatusBadge status={selectedJob.production_status} /> : null}<ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" /></span>
    </button>
    {open ? <div role="listbox" aria-label={`Production jobs for ${groupLabel}`} className="absolute right-0 top-10 z-50 max-h-80 w-[28rem] overflow-y-auto rounded-sm border border-slate-300 bg-white p-1 shadow-xl">
      <button type="button" role="option" aria-selected={!value} onClick={() => { setOpen(false); onChange(''); }} className={`flex min-h-9 w-full items-center px-2 text-left text-xs font-medium hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none ${!value ? 'bg-blue-50 text-blue-900' : 'text-slate-700'}`}>Not Linked to Production</button>
      {jobs.map((job) => <button key={job.id} type="button" role="option" aria-selected={job.id === value} onClick={() => { setOpen(false); onChange(job.id); }} className={`flex min-h-10 w-full items-center justify-between gap-3 px-2 text-left hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none ${job.id === value ? 'bg-blue-50' : ''}`}><span className="min-w-0 truncate text-xs font-semibold text-slate-900">{jobLabel(job)}</span><ProductionStatusBadge status={job.production_status} /></button>)}
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

  return <section className="min-w-0"><div className="flex items-center justify-between gap-3"><h2 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-700">{title}</h2><button type="button" onClick={beginAdd} className="inline-flex h-8 items-center gap-1 border border-slate-400 bg-white px-2 text-xs font-bold text-slate-800"><Plus className="h-3.5 w-3.5" /> Add {noun}</button></div>
    <div className="mt-2 max-h-80 overflow-auto border border-slate-300"><table className="w-full border-collapse text-sm"><thead className="sticky top-0 z-10"><tr><th className={headerClass}>Name</th><th className={`${headerClass} w-20`}>Order</th><th className={`${headerClass} w-20`}>Status</th><th className={`${headerClass} w-40`}>Actions</th></tr></thead><tbody>
      {adding && <tr className="bg-blue-50"><td className="p-1"><input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void save(); if (event.key === 'Escape') cancel(); }} className={inputClass} placeholder={`${title.slice(0, -1)} name`} /></td><td className="p-1"><input type="number" step="1" value={order} onChange={(event) => setOrder(event.target.value)} className={inputClass} /></td><td className="px-2 text-xs font-semibold text-emerald-700">Active</td><td className="p-1"><button type="button" onClick={() => void save()} disabled={saving} className="h-8 bg-slate-900 px-2 text-xs font-bold text-white disabled:opacity-50">Save</button><button type="button" onClick={cancel} className="h-8 px-2 text-xs font-bold text-slate-600">Cancel</button></td></tr>}
      {options.map((option) => editingId === option.id ? <tr key={option.id} className="bg-blue-50"><td className="p-1"><input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void save(option); if (event.key === 'Escape') cancel(); }} className={inputClass} /></td><td className="p-1"><input type="number" step="1" value={order} onChange={(event) => setOrder(event.target.value)} className={inputClass} /></td><td className="px-2 text-xs font-semibold">{option.is_active ? 'Active' : 'Inactive'}</td><td className="p-1"><button type="button" onClick={() => void save(option)} disabled={saving} className="h-8 bg-slate-900 px-2 text-xs font-bold text-white disabled:opacity-50">Save</button><button type="button" onClick={cancel} className="h-8 px-2 text-xs font-bold text-slate-600">Cancel</button></td></tr> : <tr key={option.id} className="border-t border-slate-200"><td className={`px-2 py-2 ${option.is_active ? 'font-medium' : 'text-slate-500'}`}>{option.display_name}</td><td className="px-2 py-2 tabular-nums text-slate-600">{option.sort_order}</td><td className={`px-2 py-2 text-xs font-semibold ${option.is_active ? 'text-emerald-700' : 'text-slate-500'}`}>{option.is_active ? 'Active' : 'Inactive'}</td><td className="whitespace-nowrap px-1 py-1"><button type="button" onClick={() => beginEdit(option)} className="h-8 px-2 text-xs font-bold text-blue-700">Edit</button><button type="button" onClick={() => void toggle(option)} className="h-8 px-2 text-xs font-bold text-blue-700">{option.is_active ? 'Deactivate' : 'Reactivate'}</button></td></tr>)}
    </tbody></table></div>{error && <div className="mt-1 text-xs font-semibold text-red-700">{error}</div>}</section>;
}

function WorkIdentityControl({ value, temporaryLabel, jobs, onChange, compact = false, savedTemporaryLabel }: {
  value: string;
  temporaryLabel: string;
  jobs: ManpowerJob[];
  onChange: (value: string, temporaryLabel: string) => void;
  compact?: boolean;
  savedTemporaryLabel?: string | null;
}) {
  const [changingSavedTemporary, setChangingSavedTemporary] = useState(false);
  const controlClass = compact
    ? 'h-8 min-w-0 border border-slate-400 bg-white px-2 text-xs text-slate-950 outline-none focus:border-blue-700'
    : inputClass;
  const hasSavedTemporary = value === UNLISTED && Boolean(savedTemporaryLabel) && temporaryLabel === savedTemporaryLabel;
  if (hasSavedTemporary && !changingSavedTemporary) {
    return <div className="flex min-w-[260px] items-center gap-1"><span title="Preserved label from an imported or unlinked labor entry." className="shrink-0 rounded bg-slate-100 px-1.5 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">Imported Label</span><span className="min-w-0 flex-1 truncate text-sm text-slate-900">{temporaryLabel}</span></div>;
  }
  if (changingSavedTemporary) {
    return <div className="flex min-w-[260px] items-center gap-1" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setChangingSavedTemporary(false); }}><select autoFocus defaultValue="" onChange={(event) => { const next = event.target.value; if (!next) return; setChangingSavedTemporary(false); onChange(next, next === UNLISTED ? '' : temporaryLabel); }} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); setChangingSavedTemporary(false); } }} className={`${controlClass} min-w-0 flex-1`}><option value="">Choose Production job</option><option value={UNLISTED}>+ Replace imported label</option>{jobs.map((job) => <option key={job.id} value={job.id}>{jobOptionLabel(job)}</option>)}</select><button type="button" onClick={() => setChangingSavedTemporary(false)} className="h-8 shrink-0 px-1.5 text-[10px] font-bold text-slate-700">Back</button></div>;
  }
  if (value === UNLISTED) {
    const cancelTemporaryEdit = () => onChange(savedTemporaryLabel ? UNLISTED : '', savedTemporaryLabel ?? '');
    return <div className="flex min-w-[260px] items-center gap-1" onBlur={(event) => { if (savedTemporaryLabel && !event.currentTarget.contains(event.relatedTarget as Node | null)) { event.stopPropagation(); cancelTemporaryEdit(); } }}><span className="shrink-0 rounded bg-slate-100 px-1.5 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">Imported Label</span><input autoFocus value={temporaryLabel} onChange={(event) => onChange(UNLISTED, event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); cancelTemporaryEdit(); } }} placeholder="Enter imported or unlinked label" className={`${controlClass} bg-slate-50`} /><button type="button" onClick={cancelTemporaryEdit} className="h-8 shrink-0 px-1.5 text-[10px] font-bold text-blue-700">Back</button></div>;
  }
  return <select value={value} onChange={(event) => onChange(event.target.value, '')} className={`${controlClass} min-w-[260px]`}>
    <option value="">Production Job</option>
    <option value={UNLISTED}>+ Add temporary job label</option>
    {jobs.map((job) => <option key={job.id} value={job.id}>{jobOptionLabel(job)}</option>)}
  </select>;
}

function EntryFields({
  draft, setDraft, jobs, workers, tasks, addWorker, addTask, actions, savedTemporaryLabel, jobReadOnly = false, jobControl,
}: {
  draft: Draft;
  setDraft: (next: Draft) => void;
  jobs: ManpowerJob[];
  workers: ManpowerReference[];
  tasks: ManpowerReference[];
  addWorker: (name: string) => Promise<ManpowerReference>;
  addTask: (name: string) => Promise<ManpowerReference>;
  actions?: ReactNode;
  savedTemporaryLabel?: string | null;
  jobReadOnly?: boolean;
  jobControl?: ReactNode;
}) {
  const set = (field: keyof Draft, value: string) => setDraft({ ...draft, [field]: value });
  const total = Number(draft.amHours || 0) + Number(draft.pmHours || 0);
  return (
    <>
      <td className="border-r border-slate-300 p-1"><input type="date" value={draft.workDate} onChange={(e) => set('workDate', e.target.value)} className={inputClass} /></td>
      <td className="border-r border-slate-300 p-1"><ReferenceSelect value={draft.workerId} options={workers} noun="worker" onChange={(value) => set('workerId', value)} onAdd={addWorker} /></td>
      <td className="border-r border-slate-300 p-1"><ReferenceSelect value={draft.taskId} options={tasks} noun="task" onChange={(value) => set('taskId', value)} onAdd={addTask} /></td>
      <td className="border-r border-slate-300 p-1">
        {jobControl ?? (jobReadOnly ? <div className="min-w-[220px] px-2 text-xs text-slate-600">{draft.jobChoice && draft.jobChoice !== UNLISTED ? jobLabel(jobs.find((job) => job.id === draft.jobChoice) ?? { name: 'Linked Production job', job_number: null }) : draft.unlistedLabel || 'Unlinked'}</div> : <WorkIdentityControl value={draft.jobChoice} temporaryLabel={draft.unlistedLabel} savedTemporaryLabel={savedTemporaryLabel} jobs={jobs} onChange={(jobChoice, unlistedLabel) => setDraft({ ...draft, jobChoice, unlistedLabel })} />)}
      </td>
      <td className="border-r border-slate-300 p-1"><input type="number" min="0" max="24" step="0.25" value={draft.amHours} onChange={(e) => set('amHours', e.target.value)} className={inputClass} /></td>
      <td className="border-r border-slate-300 p-1"><input type="number" min="0" max="24" step="0.25" value={draft.pmHours} onChange={(e) => set('pmHours', e.target.value)} className={inputClass} /></td>
      <td className="border-r border-slate-300 bg-slate-50 px-3 text-right text-sm font-bold tabular-nums">{Number.isFinite(total) ? total.toFixed(2) : '—'}</td>
      <td className="p-1"><div className="flex min-w-[220px] items-center gap-2"><input value={draft.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Notes" className={inputClass} />{actions}</div></td>
    </>
  );
}

function EditableEntryRow({ entry, jobs, workers, tasks, addWorker, addTask, onSaved, selected, onSelected, jobControl }: {
  entry: ManpowerEntry;
  jobs: ManpowerJob[];
  workers: ManpowerReference[];
  tasks: ManpowerReference[];
  addWorker: (name: string) => Promise<ManpowerReference>;
  addTask: (name: string) => Promise<ManpowerReference>;
  onSaved: (entry: ManpowerEntry) => void;
  selected: boolean;
  onSelected: (selected: boolean) => void;
  jobControl?: ReactNode;
}) {
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
    const validation = validate(draft);
    if (validation) { setState('error'); setMessage(validation); return; }
    setState('saving');
    try {
      const updated = await updateManpowerEntry(entry.id, toInput(draft));
      onSaved(updated);
      setState('saved');
      setMessage('');
    } catch (caught) {
      setState('error');
      setMessage(caught instanceof Error ? caught.message : 'Unable to save entry.');
    }
  }

  return (
    <tr className={`border-b border-slate-300 align-top ${selected ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : draft.jobChoice === UNLISTED ? 'bg-amber-50/50' : 'bg-white'}`} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) void save();
    }}>
      <td className="border-r border-slate-300 px-3 pt-3 text-center"><SelectionCheckbox checked={selected} label={`Select ${entry.worker.display_name} entry on ${entry.work_date}`} onChange={onSelected} /></td>
      <EntryFields draft={draft} setDraft={change} jobs={jobs} workers={workers} tasks={tasks} addWorker={addWorker} addTask={addTask} savedTemporaryLabel={entry.unlisted_work_label} jobReadOnly jobControl={jobControl} actions={<span className="shrink-0 text-center text-[10px] font-bold uppercase tracking-wide">
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
  jobs,
  reportingGroups,
  workers,
  tasks,
  onClear,
  onDelete,
  onApply,
}: {
  selectedCount: number;
  jobs: ManpowerJob[];
  reportingGroups: ManpowerReportingGroup[];
  workers: ManpowerReference[];
  tasks: ManpowerReference[];
  onClear: () => void;
  onDelete: () => Promise<{ deleted: number; failed: number }>;
  onApply: (changes: Partial<ManpowerEntryInput>) => Promise<{ updated: number; failed: number }>;
}) {
  const [workDate, setWorkDate] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [jobChoice, setJobChoice] = useState('');
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

  const buttonClass = 'h-8 border border-blue-800 bg-blue-800 px-2 text-[10px] font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-40';
  const compactInput = 'h-8 border border-slate-400 bg-white px-2 text-xs text-slate-950 outline-none focus:border-blue-700';

  return (
    <div className="border-t border-blue-300 bg-blue-50 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-bold text-blue-950">{selectedCount} selected</span>
        <button type="button" onClick={onClear} className="h-8 px-2 text-xs font-bold text-blue-800 hover:bg-blue-100">Deselect all</button>
        <button type="button" onClick={() => void removeSelected()} disabled={Boolean(busy)} className="h-8 border border-red-700 bg-red-700 px-2 text-xs font-bold text-white disabled:opacity-50">{busy === 'delete' ? 'Deleting…' : 'Delete selected'}</button>

        <div className="flex items-center gap-1 border-l border-blue-300 pl-2">
          <select value={reportingGroupId} onChange={(event) => setReportingGroupId(event.target.value)} className={compactInput}>
            <option value="">Reporting Group</option>
            {reportingGroups.map((group) => <option key={group.id} value={group.id}>{group.display_name}</option>)}
          </select>
          <button type="button" disabled={!reportingGroupId || Boolean(busy)} onClick={() => void apply('group', { reporting_group_id: reportingGroupId })} className={buttonClass}>{busy === 'group' ? 'Applying…' : 'Move to Group'}</button>
        </div>

        <div className="flex items-center gap-1 border-l border-blue-300 pl-2">
          <input type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} className={compactInput} />
          <button type="button" disabled={!workDate || Boolean(busy)} onClick={() => void apply('date', { work_date: workDate })} className={buttonClass}>{busy === 'date' ? 'Applying…' : 'Apply Date'}</button>
        </div>

        <div className="flex items-center gap-1 border-l border-blue-300 pl-2">
          <select value={workerId} onChange={(event) => setWorkerId(event.target.value)} className={compactInput}>
            <option value="">Worker</option>
            {workers.filter((worker) => worker.is_active).map((worker) => <option key={worker.id} value={worker.id}>{worker.display_name}</option>)}
          </select>
          <button type="button" disabled={!workerId || Boolean(busy)} onClick={() => void apply('worker', { worker_id: workerId })} className={buttonClass}>{busy === 'worker' ? 'Applying…' : 'Apply Worker'}</button>
        </div>

        <div className="flex items-center gap-1 border-l border-blue-300 pl-2">
          <select value={taskId} onChange={(event) => setTaskId(event.target.value)} className={compactInput}>
            <option value="">Task</option>
            {tasks.filter((task) => task.is_active).map((task) => <option key={task.id} value={task.id}>{task.display_name}</option>)}
          </select>
          <button type="button" disabled={!taskId || Boolean(busy)} onClick={() => void apply('task', { task_id: taskId })} className={buttonClass}>{busy === 'task' ? 'Applying…' : 'Apply Task'}</button>
        </div>

        <div className="flex items-center gap-1 border-l border-blue-300 pl-2">
          <WorkIdentityControl compact value={jobChoice} temporaryLabel={unlistedLabel} jobs={jobs} onChange={(value, label) => { setJobChoice(value); setUnlistedLabel(label); }} />
          <button
            type="button"
            disabled={!jobChoice || (jobChoice === UNLISTED && !unlistedLabel.trim()) || Boolean(busy)}
            onClick={() => void apply('identity', jobChoice === UNLISTED
              ? { job_id: null, unlisted_work_label: unlistedLabel.trim() }
              : { job_id: jobChoice, unlisted_work_label: null })}
            className={buttonClass}
          >{busy === 'identity' ? 'Applying…' : 'Apply Job / Label'}</button>
        </div>
      </div>
      {message && <div className={`mt-2 text-xs font-semibold ${message.includes('failed') ? 'text-red-700' : 'text-emerald-700'}`}>{message}</div>}
    </div>
  );
}

export default function ManpowerWorkspace() {
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [manageReferences, setManageReferences] = useState(false);
  const [referenceEditors, setReferenceEditors] = useState<Set<'worker' | 'task'>>(() => new Set());
  const [referencePanelMessage, setReferencePanelMessage] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [addingToGroupId, setAddingToGroupId] = useState<string | null>(null);
  const [linkingGroupId, setLinkingGroupId] = useState<string | null>(null);
  const collapseInitialized = useRef(false);
  const newGroupInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (showNewGroup) newGroupInputRef.current?.focus();
  }, [showNewGroup]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [loadedEntries, loadedJobs, loadedGroups, loadedWorkers, loadedTasks] = await Promise.all([
        loadManpowerEntries(), loadManpowerJobs(), loadManpowerReportingGroups(), loadManpowerReferences('manpower_workers'), loadManpowerReferences('manpower_tasks'),
      ]);
      setEntries(loadedEntries); setJobs(loadedJobs); setReportingGroups(loadedGroups); setWorkers(loadedWorkers); setTasks(loadedTasks);
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
      setError(caught instanceof Error ? caught.message : 'Unable to load manpower reporting.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const syncJobFilter = () => setLinkedJobId(new URLSearchParams(window.location.search).get('job'));
    window.addEventListener('popstate', syncJobFilter);
    return () => window.removeEventListener('popstate', syncJobFilter);
  }, []);

  const setReferenceEditing = useCallback((kind: 'worker' | 'task', editing: boolean) => {
    setReferenceEditors((current) => {
      if (current.has(kind) === editing) return current;
      const next = new Set(current);
      if (editing) next.add(kind); else next.delete(kind);
      return next;
    });
  }, []);

  function closeReferencePanel() {
    if (referenceEditors.size > 0) {
      setReferencePanelMessage('Save or cancel the active Worker or Task edit before closing.');
      return;
    }
    setReferencePanelMessage('');
    setManageReferences(false);
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
    const validation = validate(draft);
    if (validation) { setError(validation); return; }
    setSaving(true); setError('');
    try {
      const created = await createManpowerEntry(toInput(draft));
      setEntries((items) => [created, ...items]);
      setDraft({ ...blankDraft(), reportingGroupId: draft.reportingGroupId, workDate: draft.workDate, jobChoice: draft.jobChoice, unlistedLabel: draft.unlistedLabel });
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to add labor entry.'); }
    finally { setSaving(false); }
  }

  async function createGroup() {
    if (!newGroupName.trim()) return;
    setCreatingGroup(true); setError('');
    try {
      const created = await createManpowerReportingGroup(newGroupName);
      setReportingGroups((groups) => [created, ...groups]);
      setCollapsed((current) => { const next = new Set(current); next.delete(created.id); return next; });
      setDraft({ ...blankDraft(), reportingGroupId: created.id });
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
      const key = entry.reporting_group_id ?? '__ungrouped__';
      const label = entry.reporting_group?.display_name ?? 'Ungrouped entries';
      const group = grouped.get(key) ?? { key, label, group: entry.reporting_group, entries: [] };
      group.entries.push(entry); grouped.set(key, group);
    }
    const sortedGroups = [...grouped.values()].sort((a, b) => {
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
    const nonEmptyGroups = sortedGroups.filter((group) => group.entries.length > 0);
    if (!normalizedSearch) return nonEmptyGroups;
    return nonEmptyGroups
      .map((group) => ({
        ...group,
        entries: group.entries.filter((entry) => [
          group.label,
          entry.work_date,
          entry.worker.display_name,
          entry.task.display_name,
          entry.job?.name,
          entry.job?.job_number,
          entry.unlisted_work_label,
          entry.notes,
          entry.entered_by,
        ].some((value) => value?.toLocaleLowerCase().includes(normalizedSearch))),
      }))
      .filter((group) => group.entries.length > 0);
  }, [entries, linkedJobId, normalizedSearch, reportingGroups]);

  function startAddingToGroup(groupId: string, groupEntries: ManpowerEntry[]) {
    const identities = new Map<string, Pick<Draft, 'jobChoice' | 'unlistedLabel'>>();
    for (const entry of groupEntries) {
      const key = entry.job_id ? `job:${entry.job_id}` : `temporary:${entry.unlisted_work_label}`;
      identities.set(key, {
        jobChoice: entry.job_id ?? UNLISTED,
        unlistedLabel: entry.unlisted_work_label ?? '',
      });
    }
    const identity = identities.size === 1 ? [...identities.values()][0] : null;
    setDraft({
      ...blankDraft(),
      reportingGroupId: groupId,
      jobChoice: identity?.jobChoice ?? '',
      unlistedLabel: identity?.unlistedLabel ?? '',
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

  async function applyGroupIdentity(groupKey: string, groupEntries: ManpowerEntry[], changes: Pick<ManpowerEntryInput, 'job_id' | 'unlisted_work_label'>) {
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

  async function linkReportingGroup(groupKey: string, groupEntries: ManpowerEntry[], jobId: string, previousJobName: string) {
    await applyGroupIdentity(groupKey, groupEntries, jobId
      ? { job_id: jobId, unlisted_work_label: null }
      : { job_id: null, unlisted_work_label: previousJobName });
  }

  async function renameUnlinkedGroup(groupKey: string, groupEntries: ManpowerEntry[], jobName: string) {
    const normalized = jobName.trim();
    if (!normalized) return;
    await applyGroupIdentity(groupKey, groupEntries, { job_id: null, unlisted_work_label: normalized });
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

  return (
    <div className="mx-auto w-full max-w-[1800px] px-3 py-5 sm:px-5 sm:py-7">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Operations Reporting</div><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Manpower Reporting</h1><p className="mt-1 text-sm text-slate-600">Record shop labor by job, worker, task, and work date.</p></div>
        <div className="flex gap-2">
          <button type="button" onClick={toggleReferencePanel} className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-700 transition hover:border-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><Settings2 className="h-4 w-4" /> Workers & Tasks</button>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-700 transition hover:border-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-60"><RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
        </div>
      </div>

      {manageReferences && <div className="mt-4 grid gap-4 rounded-sm border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-2">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3 lg:col-span-2"><div><h2 className="text-sm font-bold text-slate-900">Workers & Tasks</h2><p className="text-xs text-slate-600">Maintain names, display order, and active status.</p></div><button type="button" onClick={closeReferencePanel} className="h-9 border border-slate-300 bg-white px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Close</button></div>
        {referencePanelMessage && <div className="border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 lg:col-span-2">{referencePanelMessage}</div>}
        <ReferenceManager noun="worker" options={workers} onCreate={(name, order) => createManagedReference('worker', name, order)} onUpdate={(reference, changes) => updateReference('worker', reference, changes)} onEditingChange={(editing) => setReferenceEditing('worker', editing)} />
        <ReferenceManager noun="task" options={tasks} onCreate={(name, order) => createManagedReference('task', name, order)} onUpdate={(reference, changes) => updateReference('task', reference, changes)} onEditingChange={(editing) => setReferenceEditing('task', editing)} />
      </div>}

      {error && <div className="mt-4 border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div>}

      <div className="mt-5 space-y-3">
        <div className="flex min-h-9 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {!showNewGroup ? <button type="button" onClick={() => setShowNewGroup(true)} className="inline-flex h-9 items-center gap-1.5 border border-slate-500 bg-white px-3 text-xs font-bold uppercase tracking-wide text-slate-800 hover:bg-slate-100"><Plus className="h-4 w-4" /> New Group</button> : <div className="flex items-center gap-1 border border-slate-400 bg-white p-1"><input ref={newGroupInputRef} value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void createGroup(); } if (event.key === 'Escape') { setShowNewGroup(false); setNewGroupName(''); } }} placeholder="Reporting group name" className="h-8 w-72 px-2 text-sm outline-none" /><button type="button" onClick={() => void createGroup()} disabled={creatingGroup || !newGroupName.trim()} className="h-8 bg-slate-900 px-3 text-xs font-bold text-white disabled:opacity-50">{creatingGroup ? 'Creating…' : 'Create'}</button><button type="button" onClick={() => { setShowNewGroup(false); setNewGroupName(''); }} className="h-8 px-2 text-xs font-bold text-slate-600">Cancel</button></div>}
          <label className="relative block w-full sm:max-w-sm">
            <span className="sr-only">Search manpower</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search manpower…" className={`${inputClass} pl-9`} />
          </label>
        </div>
        {linkedJobId ? <div className="flex items-center gap-2 text-xs"><span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 font-semibold text-blue-800">Job: {jobs.find((job) => job.id === linkedJobId)?.name ?? 'Selected Production job'}</span><button type="button" onClick={() => { const url = new URL(window.location.href); url.searchParams.delete('job'); window.history.pushState(null, '', `${url.pathname}${url.search}`); setLinkedJobId(null); }} className="font-semibold text-slate-500 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Clear job filter</button></div> : null}
        {loading ? <div className="border border-slate-400 bg-white p-8 text-center text-sm text-slate-600">Loading manpower entries…</div> : groups.length === 0 ? <div className="border border-slate-400 bg-white p-8 text-center text-sm text-slate-600">{linkedJobId ? 'No manpower reporting groups are linked to this Production job.' : normalizedSearch ? 'No manpower entries match your search.' : 'No reporting groups yet. Create the first group to begin.'}</div> : groups.map((group) => {
          const isCollapsed = normalizedSearch ? false : collapsed.has(group.key);
          const am = group.entries.reduce((sum, entry) => sum + Number(entry.am_hours), 0);
          const pm = group.entries.reduce((sum, entry) => sum + Number(entry.pm_hours), 0);
          const groupIds = group.entries.map((entry) => entry.id);
          const selectedGroupIds = groupIds.filter((id) => selectedIds.has(id));
          const allSelected = groupIds.length > 0 && selectedGroupIds.length === groupIds.length;
          const someSelected = selectedGroupIds.length > 0 && !allSelected;
          const linkedJobIds = [...new Set(group.entries.map((entry) => entry.job_id).filter((id): id is string => Boolean(id)))];
          const groupJobId = linkedJobIds.length === 1 && group.entries.every((entry) => entry.job_id === linkedJobIds[0]) ? linkedJobIds[0] : '';
          const groupJob = jobs.find((job) => job.id === groupJobId);
          const previousJobName = group.entries.find((entry) => entry.unlisted_work_label?.trim())?.unlisted_work_label?.trim() || group.label;
          const effectiveJobLabel = groupJob ? jobLabel(groupJob) : previousJobName;
          const jobCell = groupJob ? <div className="min-w-[220px] px-2 text-xs font-semibold text-slate-700">{effectiveJobLabel}</div> : <input key={`${group.key}:${previousJobName}`} defaultValue={previousJobName} aria-label={`Job name for ${group.label}`} onBlur={(event) => { if (event.target.value.trim() !== previousJobName) void renameUnlinkedGroup(group.key, group.entries, event.target.value); }} className="h-8 min-w-[220px] w-full border border-slate-300 bg-white px-2 text-xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-200" />;
          return (
            <section key={group.key} className={`overflow-hidden rounded-sm border bg-white ${selectedGroupIds.length > 0 ? 'border-blue-600' : 'border-slate-200'}`}>
              <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2.5 text-slate-800">
                <SelectionCheckbox checked={allSelected} indeterminate={someSelected} label={`Select all entries in ${group.label}`} onChange={(checked) => setGroupSelected(groupIds, checked)} />
                <button type="button" onClick={() => setCollapsed((current) => { const next = new Set(current); if (next.has(group.key)) next.delete(group.key); else next.add(group.key); return next; })} className="shrink-0" aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${group.label}`}>
                  {isCollapsed ? <ChevronRight className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                </button>
                {group.group ? <ReportingGroupName group={group.group} onRename={(name) => renameGroup(group.group!, name)} /> : <span className="min-w-0 truncate text-sm font-bold text-slate-950">{group.label}</span>}
                {groupJob ? <JobTag label={jobLabel(groupJob)} onClick={() => openProductionJob(groupJob.id)} title={`Open ${jobLabel(groupJob)} in Production`} className="max-w-[140px] shrink-0" /> : <span className="shrink-0 rounded-sm bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-700">Unlinked</span>}
                <span className="min-w-0 flex-1" />
                <span className="shrink-0 rounded-sm bg-white px-2 py-1 text-xs font-bold text-slate-700">{group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}</span>
                {isCollapsed && selectedGroupIds.length > 0 && <span className="shrink-0 rounded bg-blue-500 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">{selectedGroupIds.length} selected</span>}
                <span className="shrink-0 rounded-sm bg-white px-2 py-1 text-xs font-bold tabular-nums text-slate-600">AM {am.toFixed(1)} hrs</span>
                <span className="shrink-0 rounded-sm bg-white px-2 py-1 text-xs font-bold tabular-nums text-slate-600">PM {pm.toFixed(1)} hrs</span>
                <span className="shrink-0 rounded-sm bg-slate-900 px-2.5 py-1.5 text-xs font-extrabold tabular-nums text-white">TOTAL {(am + pm).toFixed(1)} hrs</span>
              </div>
              {!isCollapsed && group.group && addingToGroupId !== group.key && <div className="border-b border-slate-200 bg-white px-3 py-1.5"><button type="button" onClick={() => startAddingToGroup(group.group!.id, group.entries)} className="inline-flex h-8 items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-blue-800 hover:text-blue-950"><Plus className="h-4 w-4" /> Add New Line</button></div>}
              {!isCollapsed && <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span className="flex-1">{groupJob ? 'This manpower group is linked to the Production job. Labor recorded here contributes to the Current Hours shown in the Production Pipeline.' : 'This manpower group is not linked to a Production job. Labor recorded here will not appear in Production until a job is linked.'}</span>
                <ProductionJobLinkSelector groupLabel={group.label} jobs={jobs} value={groupJobId} disabled={linkingGroupId === group.key} onChange={(jobId) => void linkReportingGroup(group.key, group.entries, jobId, previousJobName)} />
              </div>}
              {selectedGroupIds.length > 0 && <BulkActionBar selectedCount={selectedGroupIds.length} jobs={jobs} reportingGroups={reportingGroups} workers={workers} tasks={tasks} onClear={() => setGroupSelected(groupIds, false)} onDelete={() => deleteSelectedEntries(selectedGroupIds)} onApply={(changes) => applyBulkUpdate(selectedGroupIds, changes)} />}
              {!isCollapsed && <div className="overflow-x-auto"><table className="w-full min-w-[1300px] border-collapse"><thead><tr><th className={`${headerClass} w-12 text-center`}>Select</th><th className={headerClass}>Work Date</th><th className={headerClass}>Worker</th><th className={headerClass}>Task</th><th className={headerClass}>Job</th><th className={headerClass}>AM Hours</th><th className={headerClass}>PM Hours</th><th className={headerClass}>Total</th><th className={headerClass}>Notes</th></tr></thead><tbody>{addingToGroupId === group.key && group.group && <tr className="border-b-2 border-blue-500 bg-blue-50 align-top"><td className="border-r border-slate-300 px-2 pt-3 text-center text-[9px] font-bold uppercase text-blue-700">New</td><EntryFields draft={draft} setDraft={setDraft} jobs={jobs} workers={workers} tasks={tasks} addWorker={(name) => addReference('worker', name)} addTask={(name) => addReference('task', name)} jobReadOnly jobControl={jobCell} actions={<div className="flex gap-1"><button type="button" onClick={() => void createEntry()} disabled={saving} className="h-9 whitespace-nowrap bg-slate-900 px-3 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-50">{saving ? 'Saving…' : 'Add Entry'}</button><button type="button" onClick={() => setAddingToGroupId(null)} disabled={saving} className="h-9 whitespace-nowrap border border-slate-400 bg-white px-2 text-xs font-bold text-slate-700">Cancel</button></div>} /></tr>}{group.entries.map((entry) => <EditableEntryRow key={`${entry.id}:${entry.updated_at}`} entry={entry} jobs={jobs} workers={workers} tasks={tasks} addWorker={(name) => addReference('worker', name)} addTask={(name) => addReference('task', name)} onSaved={replaceEntry} selected={selectedIds.has(entry.id)} onSelected={(selected) => setEntrySelected(entry.id, selected)} jobControl={jobCell} />)}</tbody></table></div>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
