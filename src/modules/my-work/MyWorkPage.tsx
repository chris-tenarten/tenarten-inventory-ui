"use client";

import {
  ArrowUpDown,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Handshake,
  NotebookPen,
  Plus,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { openProductionJob } from "@/modules/production/job-options";
import {
  createWorkTask,
  loadMyWorkTasks,
  loadWorkCollaborators,
  loadWorkJobs,
  setWorkTaskCompleted,
  updateWorkTask,
} from "./queries";
import type { WorkCollaborator, WorkJob, WorkTask, WorkTaskColor } from "./types";

type View = "all" | "private" | "shared";
type SortMode = "attention" | "due" | "recent" | "color" | "job";
type DetailDraft = { title: string; notes: string; assigneeUserId: string; dueDate: string; jobId: string; color: WorkTaskColor };

const COLORS: Array<{ key: WorkTaskColor; label: string; swatch: string; edge: string }> = [
  { key: "neutral", label: "Default", swatch: "bg-slate-300", edge: "border-l-slate-300" },
  { key: "blue", label: "Blue", swatch: "bg-blue-500", edge: "border-l-blue-500" },
  { key: "teal", label: "Teal", swatch: "bg-teal-500", edge: "border-l-teal-500" },
  { key: "green", label: "Green", swatch: "bg-emerald-500", edge: "border-l-emerald-500" },
  { key: "yellow", label: "Yellow", swatch: "bg-amber-400", edge: "border-l-amber-400" },
  { key: "orange", label: "Orange", swatch: "bg-orange-500", edge: "border-l-orange-500" },
  { key: "rose", label: "Rose", swatch: "bg-rose-500", edge: "border-l-rose-500" },
  { key: "violet", label: "Violet", swatch: "bg-violet-500", edge: "border-l-violet-500" },
];
const colorEdge = (color: WorkTaskColor) => COLORS.find((item) => item.key === color)?.edge ?? "border-l-slate-300";
const firstName = (value: string) => value.trim().split(/\s+/)[0] || "TenOps user";
const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
const detailFromTask = (task: WorkTask): DetailDraft => ({ title: task.title, notes: task.notes, assigneeUserId: task.assigneeUserId, dueDate: task.dueDate, jobId: task.contextType === "job" ? task.contextId : "", color: task.color });
const jobLabel = (job: WorkJob) => [job.jobNumber, job.name, job.customer].filter(Boolean).join(" · ");
const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [{ value: "attention", label: "Attention" }, { value: "due", label: "Due Date" }, { value: "recent", label: "Recently Added" }, { value: "color", label: "Color" }, { value: "job", label: "Job" }];

function PrivateTaskIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d="M8 10V7a4 4 0 0 1 8 0v3" /><rect width="14" height="11" x="5" y="10" rx="2" /><path d="m9 15 2 2 4-4" /></svg>;
}

function dueCopy(value: string) {
  if (!value) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(`${value}T00:00:00`);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { label: "Overdue", className: "text-red-700" };
  if (days === 0) return { label: "Today", className: "text-amber-700" };
  return { label: new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(due), className: "text-slate-500" };
}

function ColorPicker({ value, onChange }: { value: WorkTaskColor; onChange: (value: WorkTaskColor) => void }) {
  return <div className="flex flex-wrap gap-2" aria-label="Task color">{COLORS.map((color) => <button key={color.key} type="button" onClick={() => onChange(color.key)} aria-label={color.label} aria-pressed={value === color.key} className={`flex h-10 w-10 items-center justify-center rounded-full border ${value === color.key ? "border-slate-900 ring-2 ring-blue-200" : "border-slate-300"}`}><span className={`h-5 w-5 rounded-full ${color.swatch}`} /></button>)}</div>;
}

function JobCombobox({ jobs, value, onChange, label }: { jobs: WorkJob[]; value: string; onChange: (value: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = jobs.find((job) => job.id === value);
  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (normalized ? jobs.filter((job) => jobLabel(job).toLowerCase().includes(normalized)) : jobs).slice(0, 40);
  }, [jobs, query]);
  const select = (job: WorkJob) => { onChange(job.id); setQuery(""); setOpen(false); setActiveIndex(0); };
  return <div className="relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setQuery(""); } }}>
    <div className="relative flex items-center">
      <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
      <input role="combobox" aria-label={label} aria-expanded={open} aria-controls={`${label.replaceAll(" ", "-").toLowerCase()}-results`} aria-autocomplete="list" value={open ? query : selected ? jobLabel(selected) : ""} placeholder="Search number, project, or customer" onFocus={() => { setOpen(true); setQuery(""); setActiveIndex(0); }} onClick={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); setActiveIndex(0); }} onKeyDown={(event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((current) => Math.min(current + 1, Math.max(0, matches.length - 1))); }
        else if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((current) => Math.max(0, current - 1)); }
        else if (event.key === "Enter" && open && matches[activeIndex]) { event.preventDefault(); select(matches[activeIndex]); }
        else if (event.key === "Escape") { event.preventDefault(); setOpen(false); setQuery(""); }
      }} className="h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white pl-9 pr-10 text-sm" />
      {value && <button type="button" onClick={() => { onChange(""); setQuery(""); }} aria-label="Clear Job" className="absolute right-0 flex h-11 w-10 items-center justify-center text-slate-500"><X className="h-4 w-4" /></button>}
    </div>
    {open && <div id={`${label.replaceAll(" ", "-").toLowerCase()}-results`} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-300 bg-white py-1 shadow-lg">{matches.length ? matches.map((job, index) => <button key={job.id} type="button" role="option" aria-selected={job.id === value} onMouseDown={(event) => event.preventDefault()} onClick={() => select(job)} className={`block min-h-11 w-full px-3 py-2 text-left text-sm ${index === activeIndex ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-50"}`}><span className="block truncate font-medium">{job.jobNumber ? `${job.jobNumber} · ` : ""}{job.name}</span>{job.customer && <span className="block truncate text-xs text-slate-500">{job.customer}</span>}</button>) : <div className="px-3 py-3 text-sm text-slate-500">No matching Jobs</div>}</div>}
  </div>;
}

export default function MyWorkPage() {
  const auth = useAuth();
  const [view, setView] = useState<View>("all");
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [collaborators, setCollaborators] = useState<WorkCollaborator[]>([]);
  const [jobs, setJobs] = useState<WorkJob[]>([]);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [jobId, setJobId] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("attention");
  const [composerOpen, setComposerOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filterJobId, setFilterJobId] = useState("");
  const [focusTaskId, setFocusTaskId] = useState("");
  const [transitioning, setTransitioning] = useState<Record<string, boolean>>({});
  const [collapsing, setCollapsing] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<WorkTask | null>(null);
  const [detail, setDetail] = useState<DetailDraft | null>(null);
  const [detailSaving, setDetailSaving] = useState(false);

  const load = useCallback(async () => {
    if (!auth.profile?.isActive) return;
    setLoading(true);
    try {
      const [nextTasks, nextUsers, nextJobs] = await Promise.all([loadMyWorkTasks(), loadWorkCollaborators(), loadWorkJobs()]);
      setTasks(nextTasks);
      setCollaborators(nextUsers.filter((user) => user.userId !== auth.profile?.userId));
      setJobs(nextJobs);
      setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load My Work."); }
    finally { setLoading(false); }
  }, [auth.profile?.isActive, auth.profile?.userId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFilterJobId(params.get("jobId") || "");
    setFocusTaskId(params.get("taskId") || "");
    if (params.get("view") === "shared") setView("shared");
    void load();
  }, [load]);
  useEffect(() => { if (!focusTaskId || loading) return; window.setTimeout(() => document.querySelector(`[data-work-task-id="${focusTaskId}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 0); }, [focusTaskId, loading]);
  useEffect(() => {
    const userId = auth.profile?.userId;
    if (!userId) return;
    const stored = window.localStorage.getItem(`tenops_my_work_sort:${userId}`);
    if (SORT_OPTIONS.some((option) => option.value === stored)) setSortMode(stored as SortMode);
  }, [auth.profile?.userId]);

  const visible = useMemo(() => tasks.filter((task) => (view === "all" || (view === "private" ? task.visibility === "private" : task.visibility === "shared")) && (!filterJobId || task.contextId === filterJobId)), [filterJobId, tasks, view]);
  const sortedVisible = useMemo(() => {
    const colorOrder = new Map(COLORS.map((color, index) => [color.key, index]));
    const dueValue = (task: WorkTask) => task.dueDate ? new Date(`${task.dueDate}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
    return [...visible].sort((left, right) => {
      let comparison = 0;
      if (sortMode === "attention" || sortMode === "due") comparison = dueValue(left) - dueValue(right);
      else if (sortMode === "recent") comparison = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      else if (sortMode === "color") comparison = (colorOrder.get(left.color) ?? 0) - (colorOrder.get(right.color) ?? 0);
      else comparison = `${left.jobNumber} ${left.jobName}`.localeCompare(`${right.jobNumber} ${right.jobName}`, undefined, { numeric: true, sensitivity: "base" });
      return comparison || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime() || left.id.localeCompare(right.id);
    });
  }, [sortMode, visible]);
  const open = sortedVisible.filter((task) => !task.completedAt);
  const completed = sortedVisible.filter((task) => Boolean(task.completedAt));
  const selectedJob = jobs.find((job) => job.id === filterJobId);
  const changeSort = (next: SortMode) => { setSortMode(next); if (auth.profile?.userId) window.localStorage.setItem(`tenops_my_work_sort:${auth.profile.userId}`, next); };

  async function add() {
    if (!title.trim() || saving) return;
    setSaving(true); setError("");
    try {
      const id = await createWorkTask({ title: title.trim(), assigneeUserId: assignee, dueDate, jobId });
      setTitle(""); setDueDate(""); setJobId(""); setAssignee("");
      await load(); setFocusTaskId(id);
      window.dispatchEvent(new Event("tenops:notifications-changed"));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create task."); }
    finally { setSaving(false); }
  }

  async function toggle(task: WorkTask) {
    if (task.id in transitioning) return;
    const completing = !task.completedAt;
    setTransitioning((current) => ({ ...current, [task.id]: completing }));
    setError("");
    try {
      const request = setWorkTaskCompleted(task.id, completing);
      await wait(300);
      setCollapsing((current) => new Set(current).add(task.id));
      await Promise.all([request, wait(160)]);
      await load();
      window.dispatchEvent(new Event("tenops:notifications-changed"));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update task."); }
    finally {
      setTransitioning((current) => { const next = { ...current }; delete next[task.id]; return next; });
      setCollapsing((current) => { const next = new Set(current); next.delete(task.id); return next; });
    }
  }

  function openDetails(task: WorkTask) { setSelectedTask(task); setDetail(detailFromTask(task)); }
  function closeDetails() { if (!detailSaving) { setSelectedTask(null); setDetail(null); } }
  async function saveDetails() {
    if (!selectedTask || !detail || !detail.title.trim() || detailSaving) return;
    setDetailSaving(true); setError("");
    try {
      await updateWorkTask({ id: selectedTask.id, ...detail, title: detail.title.trim() });
      await load(); setSelectedTask(null); setDetail(null);
      window.dispatchEvent(new Event("tenops:notifications-changed"));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save task."); }
    finally { setDetailSaving(false); }
  }

  function taskCard(task: WorkTask) {
    const isFocused = task.id === focusTaskId;
    const visualCompleted = task.id in transitioning ? transitioning[task.id] : Boolean(task.completedAt);
    const sharedCopy = task.creatorUserId === auth.profile?.userId ? `With ${firstName(task.assigneeName)}` : `From ${firstName(task.creatorName)}`;
    const due = dueCopy(task.dueDate);
    return <div key={task.id} className={`grid transition-[grid-template-rows,opacity,margin] duration-150 ${collapsing.has(task.id) ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}><div className="min-h-0 overflow-hidden"><article data-work-task-id={task.id} className={`group flex min-h-14 items-start gap-2 rounded-md border border-l-4 bg-white px-2 py-1.5 transition ${colorEdge(task.color)} ${isFocused ? "border-blue-600 ring-2 ring-blue-200" : "border-slate-200"}`}>
      <button type="button" onClick={() => void toggle(task)} aria-label={visualCompleted ? `Reopen ${task.title}` : `Complete ${task.title}`} className="flex h-11 w-11 shrink-0 items-center justify-center"><span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition ${visualCompleted ? "border-blue-700 bg-blue-700 text-white" : "border-slate-400 bg-white text-transparent group-hover:border-blue-700"}`}><Check className="h-4 w-4" /></span></button>
      <div className="min-w-0 flex-1 py-1">
        <button type="button" onClick={() => openDetails(task)} className={`block w-full text-left text-[16px] font-medium leading-5 text-slate-950 transition ${visualCompleted ? "text-slate-500 line-through decoration-slate-400" : ""}`}>{task.title}</button>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
          {task.contextType === "job" && <button type="button" onClick={() => openProductionJob(task.contextId)} className="inline-flex min-w-0 items-center gap-1 font-medium text-blue-800 hover:underline"><BriefcaseBusiness className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{task.jobNumber ? `${task.jobNumber} · ` : ""}{task.jobName}</span></button>}
          {task.visibility === "shared" ? <span className="inline-flex items-center gap-1"><Handshake className="h-4 w-4" />{visualCompleted ? `${firstName(task.assigneeName)} completed` : sharedCopy}</span> : <span className="inline-flex items-center gap-1"><PrivateTaskIcon className="h-3.5 w-3.5" />Private</span>}
          {task.notes && <span className="inline-flex items-center gap-1"><NotebookPen className="h-3.5 w-3.5" />Notes</span>}
        </div>
      </div>
      {due && <div className={`shrink-0 px-2 py-2 text-xs font-medium ${due.className}`}><CalendarDays className="mr-1 inline h-3.5 w-3.5" />{due.label}</div>}
    </article></div></div>;
  }

  return <main data-my-work className="mx-auto w-full max-w-[1120px] px-3 py-5 sm:px-6 sm:py-7">
    <header><div className="text-[10px] font-semibold uppercase tracking-[.15em] text-slate-500">Personal workspace</div><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">My Work</h1><p className="mt-0.5 text-sm text-slate-600">Your tasks, all in one place.</p></header>

    <div className="mt-2 flex max-w-full flex-wrap border-b border-slate-300" role="tablist" aria-label="My Work views">{([['all','All Tasks'],['private','My Tasks'],['shared','Shared Tasks']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={view === value} onClick={() => setView(value)} className={`flex h-11 shrink-0 items-center justify-center gap-2 border-b-2 px-3 text-sm font-medium sm:px-4 ${view === value ? "border-blue-800 text-blue-900" : "border-transparent text-slate-500 hover:text-slate-900"}`}>{value === "private" && <PrivateTaskIcon className="h-4 w-4" />}{value === "shared" && <Handshake className="h-[18px] w-[18px]" />}{label}</button>)}</div>
    <div className="mt-2 min-h-5 text-xs text-slate-500">{view === "private" ? <span className="inline-flex items-center gap-1.5"><PrivateTaskIcon className="h-3.5 w-3.5" />Private to you</span> : view === "shared" ? <span className="inline-flex items-center gap-1.5"><Handshake className="h-[17px] w-[17px]" />Tasks exchanged with another TenOps user</span> : "Your private tasks and participant-visible Shared Tasks together."}</div>

    {filterJobId && <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900"><span className="truncate">Showing tasks for {selectedJob ? jobLabel(selectedJob) : "this Job"}</span><button type="button" onClick={() => { setFilterJobId(""); window.history.replaceState({}, "", window.location.pathname); }} className="flex h-10 w-10 shrink-0 items-center justify-center" aria-label="Clear Job filter"><X className="h-4 w-4" /></button></div>}

    <section className="mt-4 rounded-lg border border-slate-300 bg-white p-2 sm:p-3" onFocus={() => setComposerOpen(true)}>
      <div className="flex items-center gap-2"><Plus className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" /><input value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void add(); } }} placeholder="What needs to get done?" aria-label="Task title" className="h-11 min-w-0 flex-1 border-0 bg-transparent px-1 text-base font-normal text-slate-950 outline-none" /><button type="button" onClick={() => void add()} disabled={!title.trim() || saving} className="tenops-selected-surface hidden h-10 shrink-0 rounded-md border px-4 text-sm font-medium disabled:opacity-40 sm:block">{saving ? "Adding…" : "Add task"}</button></div>
      {composerOpen && <div className="mt-2 grid gap-2 pt-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_auto]">
        <label className="text-xs text-slate-600"><span className="mb-1 flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />Due</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm" /></label>
        <label className="text-xs text-slate-600"><span className="mb-1 flex items-center gap-1"><BriefcaseBusiness className="h-3.5 w-3.5" />Job</span><JobCombobox jobs={jobs} value={jobId} onChange={setJobId} label="Composer Job" /></label>
        <label className="text-xs text-slate-600"><span className="mb-1 flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />Share</span><select value={assignee} onChange={(event) => setAssignee(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"><option value="">Keep private</option>{collaborators.map((user) => <option key={user.userId} value={user.userId}>{user.displayName}</option>)}</select></label>
        <button type="button" onClick={() => void add()} disabled={!title.trim() || saving} className="tenops-selected-surface h-10 self-end rounded-md border px-4 text-sm font-medium disabled:opacity-40 sm:hidden">{saving ? "Adding…" : "Add task"}</button>
      </div>}
    </section>

    {error && <div role="alert" className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{error}</div>}
    {loading ? <div className="mt-6 text-sm text-slate-500">Loading My Work…</div> : <>
      <div className="mt-5 flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2"><span className="text-sm font-medium text-slate-700">{open.length} open</span><label className="flex items-center gap-2 text-xs text-slate-500"><ArrowUpDown className="h-4 w-4" /><span className="sr-only">Sort tasks</span><select value={sortMode} onChange={(event) => changeSort(event.target.value as SortMode)} className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm font-medium text-slate-700">{SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>
      <section className="mt-2 space-y-2" aria-label="Open tasks">{open.length ? open.map(taskCard) : <div className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-10 text-center"><div className="text-sm font-medium text-slate-700">Nothing open</div><div className="mt-1 text-xs text-slate-500">Add a task when something comes up.</div></div>}</section>
      {completed.length > 0 && <section className="mt-6"><button type="button" onClick={() => setCompletedOpen((value) => !value)} aria-expanded={completedOpen} className="flex h-11 w-full items-center justify-between border-y border-slate-200 px-2 text-sm font-medium text-slate-500"><span>Completed ({completed.length})</span>{completedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>{completedOpen && <div className="mt-2 space-y-2">{completed.map(taskCard)}</div>}</section>}
    </>}

    {selectedTask && detail && <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/35" role="dialog" aria-modal="true" aria-labelledby="my-work-detail-title" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetails(); }}><div className="flex h-full w-full max-w-xl flex-col border-l border-slate-300 bg-white shadow-[-12px_0_30px_rgba(15,23,42,.18)]">
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6"><div><div className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Task details</div><h2 id="my-work-detail-title" className="mt-1 text-xl font-semibold text-slate-950">Edit task</h2></div><button type="button" onClick={closeDetails} aria-label="Close task details" className="flex h-11 w-11 items-center justify-center rounded-md border border-slate-300"><X className="h-5 w-5" /></button></header>
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
        <label className="block text-sm font-medium text-slate-700">Title<input value={detail.title} onChange={(event) => setDetail({ ...detail, title: event.target.value })} className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base font-normal" /></label>
        <label className="block text-sm font-medium text-slate-700">Notes <span className="font-normal text-slate-400">optional</span><textarea value={detail.notes} onChange={(event) => setDetail({ ...detail, notes: event.target.value })} rows={6} placeholder="What do you need to remember?" className="mt-1 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal" /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Due date<input type="date" value={detail.dueDate} onChange={(event) => setDetail({ ...detail, dueDate: event.target.value })} className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" /></label><label className="text-sm font-medium text-slate-700">Share with<select value={detail.assigneeUserId} disabled={selectedTask.creatorUserId !== auth.profile?.userId} onChange={(event) => setDetail({ ...detail, assigneeUserId: event.target.value })} className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 font-normal disabled:opacity-60"><option value={selectedTask.creatorUserId}>Keep private</option>{collaborators.map((user) => <option key={user.userId} value={user.userId}>{user.displayName}</option>)}</select></label></div>
        <label className="block text-sm font-medium text-slate-700">Job <span className="font-normal text-slate-400">optional</span><span className="mt-1 block"><JobCombobox jobs={jobs} value={detail.jobId} onChange={(nextJobId) => setDetail({ ...detail, jobId: nextJobId })} label="Task detail Job" /></span></label>
        {detail.jobId && <button type="button" onClick={() => openProductionJob(detail.jobId)} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium text-blue-800"><BriefcaseBusiness className="h-4 w-4" />Open linked Job</button>}
        <div><div className="mb-2 text-sm font-medium text-slate-700">My task color</div><ColorPicker value={detail.color} onChange={(color) => setDetail({ ...detail, color })} /><p className="mt-2 text-xs text-slate-500">This color is personal to your workspace and does not change another participant’s view.</p></div>
      </div>
      <footer className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 sm:px-6"><button type="button" onClick={closeDetails} className="h-10 rounded-md border border-slate-300 px-4 text-sm font-medium">Cancel</button><button type="button" onClick={() => void saveDetails()} disabled={!detail.title.trim() || detailSaving} className="tenops-selected-surface h-10 rounded-md border px-4 text-sm font-medium disabled:opacity-40">{detailSaving ? "Saving…" : "Save task"}</button></footer>
    </div></div>}
  </main>;
}
