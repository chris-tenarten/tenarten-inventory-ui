"use client";

import {
  ArrowUpDown,
  BriefcaseBusiness,
  CalendarDays,
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Handshake,
  Info,
  Inbox as InboxIcon,
  MessageSquarePlus,
  MoreHorizontal,
  NotebookPen,
  Paperclip,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import ToolboxLauncher from "@/components/ToolboxLauncher";
import { supabase } from "@/lib/supabase";
import { openProductionJob } from "@/modules/production/job-options";
import InboxDialog from "./InboxDialog";
import { isTenOpsSystemInboxUser, loadInboxMessages, loadInboxUnreadCount, type InboxMessage } from "./inbox";
import {
  createWorkTask,
  finalizeWorkTaskCreation,
  loadMyWorkTasks,
  loadWorkTaskAttachmentCounts,
  loadWorkTaskAttachments,
  loadWorkCollaborators,
  loadWorkJobs,
  openWorkTaskAttachment,
  permanentlyDeleteWorkTask,
  removeWorkTaskAttachment,
  setWorkTaskCompleted,
  updateWorkTask,
  uploadWorkTaskAttachments,
} from "./queries";
import type { WorkCollaborator, WorkJob, WorkTask, WorkTaskAttachment, WorkTaskColor } from "./types";
import AttachmentFileInput, { StagedImagePreview } from "./AttachmentFileInput";
import { formatEstimatedMinutes, MAX_ESTIMATED_MINUTES, normalizeEstimatedMinutes } from "./estimated-time";

type View = "today" | "all" | "private" | "shared";
type SortMode = "attention" | "due" | "recent" | "color" | "job" | "estimate-asc" | "estimate-desc";
type GroupMode = "none" | "due" | "job" | "effort";
type DetailDraft = { title: string; notes: string; assigneeUserId: string; dueDate: string; estimatedMinutes: number|null; jobId: string; color: WorkTaskColor };

const COLORS: Array<{ key: WorkTaskColor; label: string; swatch: string; edge: string }> = [
  { key: "neutral", label: "Default", swatch: "bg-slate-300", edge: "border-l-slate-300" },
  { key: "blue", label: "Blue", swatch: "bg-blue-500", edge: "border-l-blue-500" },
  { key: "teal", label: "Teal", swatch: "bg-cyan-500", edge: "border-l-cyan-500" },
  { key: "green", label: "Green", swatch: "bg-emerald-600", edge: "border-l-emerald-600" },
  { key: "yellow", label: "Yellow", swatch: "bg-amber-400", edge: "border-l-amber-400" },
  { key: "orange", label: "Orange", swatch: "bg-orange-500", edge: "border-l-orange-500" },
  { key: "rose", label: "Rose", swatch: "bg-rose-500", edge: "border-l-rose-500" },
  { key: "violet", label: "Violet", swatch: "bg-violet-500", edge: "border-l-violet-500" },
];
const colorEdge = (color: WorkTaskColor) => COLORS.find((item) => item.key === color)?.edge ?? "border-l-slate-300";
const participantName = (value: string) => value.trim() || "TenOps user";
const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
const detailFromTask = (task: WorkTask): DetailDraft => ({ title: task.title, notes: task.notes, assigneeUserId: task.assigneeUserId, dueDate: task.dueDate, estimatedMinutes: task.estimatedMinutes, jobId: task.contextType === "job" ? task.contextId : "", color: task.color });
const jobLabel = (job: WorkJob) => [job.jobNumber, job.name, job.customer].filter(Boolean).join(" · ");
const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [{ value: "attention", label: "Recommended" }, { value: "due", label: "Due Date" }, { value: "recent", label: "Recently Added" }, { value: "estimate-asc", label: "Estimated time: shortest first" }, { value: "estimate-desc", label: "Estimated time: longest first" }, { value: "color", label: "Color" }, { value: "job", label: "Job" }];
const ESTIMATE_PRESETS=[15,30,45,60,90,120];
const inboxInitials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map((part)=>part[0]?.toUpperCase()).join("")||"?";
const inboxTime=(value:string)=>new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric"}).format(new Date(value));

function InboxRail({expanded,onExpanded,messages,currentUserId,recipients,unreadCount,onOpenConversation,onNewMessage}:{expanded:boolean;onExpanded:(value:boolean)=>void;messages:InboxMessage[];currentUserId:string;recipients:WorkCollaborator[];unreadCount:number;onOpenConversation:(userId:string)=>void;onNewMessage:()=>void}){
  const conversations=useMemo(()=>{const grouped=new Map<string,InboxMessage[]>();for(const message of messages){const other=message.senderUserId===currentUserId?message.recipientUserId:message.senderUserId;grouped.set(other,[...(grouped.get(other)??[]),message]);}return[...grouped.entries()].map(([userId,items])=>{const latest=items.at(-1)!;const person=recipients.find((candidate)=>candidate.userId===userId);return{userId,name:person?.displayName||(latest.senderUserId===userId?latest.senderName:latest.recipientName),latest,unread:items.filter((item)=>item.recipientUserId===currentUserId&&!item.readAt).length};}).sort((left,right)=>new Date(right.latest.createdAt).getTime()-new Date(left.latest.createdAt).getTime());},[currentUserId,messages,recipients]);
  return <aside data-inbox-rail data-expanded={expanded?"true":"false"} className={`sticky top-[53px] hidden h-[calc(100dvh-53px)] shrink-0 self-start border-r border-slate-300 bg-white transition-[width] duration-200 min-[1440px]:flex min-[1440px]:flex-col ${expanded?"w-72":"w-14"}`}>
    <button type="button" onClick={()=>onExpanded(!expanded)} aria-label={expanded?"Collapse Inbox rail":"Expand Inbox rail"} aria-expanded={expanded} className={`tenops-selected-surface relative flex h-14 shrink-0 items-center border-b ${expanded?"justify-between px-4":"justify-center"}`}><span className="flex items-center gap-2"><InboxIcon className="h-5 w-5" />{expanded?<strong className="text-sm">Inbox</strong>:null}</span>{expanded?<ChevronLeft className="h-4 w-4" />:<ChevronRight className="absolute bottom-1 right-1 h-3 w-3" />}{unreadCount?<span aria-label={`${unreadCount} unread messages`} className={`absolute inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white ring-2 ring-white ${expanded?"right-9 top-2":"right-1 top-1"}`}>{unreadCount>9?"9+":unreadCount}</span>:null}</button>
    {expanded?<><div className="p-3"><button type="button" onClick={onNewMessage} className="tenops-selected-surface flex h-10 w-full items-center justify-center gap-2 rounded-md border text-sm font-semibold"><MessageSquarePlus className="h-4 w-4" />New message</button></div><div className="min-h-0 flex-1 overflow-y-auto">{conversations.length?conversations.map((conversation)=><button key={conversation.userId} type="button" onClick={()=>onOpenConversation(conversation.userId)} className="flex w-full gap-2 border-t border-slate-200 px-3 py-3 text-left hover:bg-slate-50"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${isTenOpsSystemInboxUser(conversation.userId)?"tenops-selected-surface":"border-slate-300 bg-slate-50"}`}>{isTenOpsSystemInboxUser(conversation.userId)?<Sparkles className="h-3.5 w-3.5" />:inboxInitials(conversation.name)}</span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><strong className="truncate text-xs text-slate-900">{conversation.name}</strong><time className="shrink-0 text-[9px] text-slate-400">{inboxTime(conversation.latest.createdAt)}</time></span><span className="mt-1 flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-[11px] text-slate-500">{conversation.latest.body}</span>{conversation.unread?<span className="h-2 w-2 shrink-0 rounded-full bg-red-600" aria-label={`${conversation.unread} unread`} />:null}</span></span></button>):<p className="px-4 py-8 text-center text-xs text-slate-500">No conversations yet.</p>}</div></>:null}
  </aside>;
}

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
  if (days === 1) return { label: "Tomorrow", className: "text-slate-500" };
  return { label: new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(due), className: "text-slate-500" };
}

const localDateKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
function dueBucket(task:WorkTask,upcomingDays?:number){if(!task.dueDate)return"undated" as const;const today=new Date();today.setHours(0,0,0,0);const todayKey=localDateKey(today);if(task.dueDate<todayKey)return"overdue" as const;if(task.dueDate===todayKey)return"today" as const;if(upcomingDays!==undefined){const end=new Date(today);end.setDate(end.getDate()+upcomingDays);if(task.dueDate>localDateKey(end))return"later" as const;}return"upcoming" as const;}

function ColorPicker({ value, onChange }: { value: WorkTaskColor; onChange: (value: WorkTaskColor) => void }) {
  return <div className="flex flex-wrap gap-2" aria-label="Task color">{COLORS.map((color) => <button key={color.key} type="button" onClick={() => onChange(color.key)} aria-label={color.label} aria-pressed={value === color.key} className={`flex h-10 w-10 items-center justify-center rounded-full border ${value === color.key ? "border-slate-900 ring-2 ring-blue-200" : "border-slate-300"}`}><span className={`h-5 w-5 rounded-full ${color.swatch}`} /></button>)}</div>;
}

function EstimatedTimeInput({value,onChange,label="Estimated time"}:{value:number|null;onChange:(value:number|null)=>void;label?:string}){
  const listId=`${label.toLowerCase().replaceAll(/[^a-z0-9]+/g,"-")}-presets`;
  return <div className="relative"><input type="number" inputMode="numeric" min={1} max={MAX_ESTIMATED_MINUTES} step={1} list={listId} value={value??""} onChange={(event)=>onChange(normalizeEstimatedMinutes(event.target.value))} placeholder="Minutes" aria-label={label} className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 pr-12 text-sm" /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">min</span><datalist id={listId}>{ESTIMATE_PRESETS.map((minutes)=><option key={minutes} value={minutes}>{formatEstimatedMinutes(minutes)??`${minutes}m`}</option>)}</datalist></div>;
}

const attachmentSize=(bytes:number)=>bytes<1024?`${bytes} B`:bytes<1048576?`${Math.ceil(bytes/1024)} KB`:`${(bytes/1048576).toFixed(1)} MB`;
function StagedAttachments({files,onAdd,onRemove,onError,onPreparing,disabled=false}:{files:File[];onAdd:(files:File[])=>void;onRemove:(index:number)=>void;onError:(message:string)=>void;onPreparing?:(preparing:boolean)=>void;disabled?:boolean}){
  return <div><label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700"><Upload className="h-4 w-4" />Add attachments<AttachmentFileInput disabled={disabled} onFiles={onAdd} onError={onError} onPreparing={onPreparing} /></label>{files.length>0&&<div className="mt-2 space-y-1">{files.map((file,index)=><div key={`${file.name}-${file.size}-${index}`} className="flex min-w-0 items-center gap-2 rounded border border-slate-200 px-2 py-1.5 text-xs"><StagedImagePreview file={file} /><Paperclip className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0 flex-1 truncate">{file.name}</span><span className="shrink-0 text-slate-400">{attachmentSize(file.size)}</span><button type="button" onClick={()=>onRemove(index)} aria-label={`Remove ${file.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center text-red-700"><X className="h-4 w-4" /></button></div>)}</div>}</div>;
}

function AttachmentList({attachments,currentUserId,creatorUserId,onChanged,setError}:{attachments:WorkTaskAttachment[];currentUserId:string;creatorUserId:string;onChanged:()=>Promise<void>;setError:(value:string)=>void}){
  const[busyId,setBusyId]=useState("");
  return attachments.length?<div className="space-y-1">{attachments.map(attachment=><div key={attachment.id} className="flex min-w-0 items-center gap-2 rounded border border-slate-200 px-2 py-1.5 text-sm"><Paperclip className="h-4 w-4 shrink-0 text-slate-500" /><button type="button" onClick={()=>void openWorkTaskAttachment(attachment).catch((caught)=>setError(caught instanceof Error?caught.message:"Unable to open attachment."))} className="min-w-0 flex-1 truncate text-left font-medium text-blue-800 hover:underline">{attachment.originalFilename}</button><span className="shrink-0 text-xs text-slate-400">{attachmentSize(attachment.byteSize)}</span>{(attachment.uploaderUserId===currentUserId||creatorUserId===currentUserId)&&<button type="button" disabled={busyId===attachment.id} onClick={()=>void(async()=>{setBusyId(attachment.id);try{await removeWorkTaskAttachment(attachment);await onChanged();}catch(caught){setError(caught instanceof Error?caught.message:"Unable to remove attachment.");}finally{setBusyId("");}})()} aria-label={`Delete ${attachment.originalFilename}`} className="flex h-10 w-10 shrink-0 items-center justify-center text-red-700 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>}</div>)}</div>:null;
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
  const [estimatedMinutes, setEstimatedMinutes] = useState<number|null>(null);
  const [jobId, setJobId] = useState("");
  const [notes, setNotes] = useState("");
  const [color, setColor] = useState<WorkTaskColor>("neutral");
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("attention");
  const [groupMode, setGroupMode] = useState<GroupMode>("none");
  const [composerOpen, setComposerOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attachmentActivity,setAttachmentActivity]=useState("");
  const [error, setError] = useState("");
  const [filterJobId, setFilterJobId] = useState("");
  const [focusTaskId, setFocusTaskId] = useState("");
  const [transitioning, setTransitioning] = useState<Record<string, boolean>>({});
  const [collapsing, setCollapsing] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<WorkTask | null>(null);
  const [detail, setDetail] = useState<DetailDraft | null>(null);
  const [detailSaving, setDetailSaving] = useState(false);
  const [taskDeleting,setTaskDeleting]=useState(false);
  const [detailAttachments, setDetailAttachments] = useState<WorkTaskAttachment[]>([]);
  const [detailFiles, setDetailFiles] = useState<File[]>([]);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxInitialUserId, setInboxInitialUserId] = useState("");
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);
  const [inboxRecipients, setInboxRecipients] = useState<WorkCollaborator[]>([]);
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([]);
  const [inboxRailExpanded, setInboxRailExpanded] = useState(false);
  const [inboxComposeNew, setInboxComposeNew] = useState(false);
  const [quickTaskId,setQuickTaskId]=useState("");
  const [quickAction,setQuickAction]=useState<""|"color"|"due"|"estimate">("");
  const [quickDueDate,setQuickDueDate]=useState("");
  const [quickEstimate,setQuickEstimate]=useState<number|null>(null);
  const [quickSaving,setQuickSaving]=useState(false);
  const [workloadOpen,setWorkloadOpen]=useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!auth.profile?.isActive) return;
    setLoading(true);
    try {
      const nextTasks = await loadMyWorkTasks();
      setTasks((current)=>{const counts=new Map(current.map((task)=>[task.id,task.attachmentCount]));return nextTasks.map((task)=>({...task,attachmentCount:counts.get(task.id)??0}));});
      setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load My Work."); }
    finally { setLoading(false); }
  }, [auth.profile?.isActive]);

  const refreshAttachmentCounts=useCallback(async()=>{const counts=await loadWorkTaskAttachmentCounts();setTasks((current)=>current.map((task)=>({...task,attachmentCount:counts.get(task.id)??0})));},[]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFilterJobId(params.get("jobId") || "");
    setFocusTaskId(params.get("taskId") || "");
    if (params.get("view") === "shared") setView("shared");
    if (params.get("inbox") === "1" || params.get("inboxUserId")) {
      setInboxInitialUserId(params.get("inboxUserId") || "");
      setInboxComposeNew(false);
      setInboxOpen(true);
      params.delete("inbox");
      params.delete("inboxUserId");
      const nextQuery=params.toString();
      window.history.replaceState({},"",`${window.location.pathname}${nextQuery?`?${nextQuery}`:""}`);
    }
    if (params.get("newTask") === "1") {
      setComposerOpen(true);
      setJobId(params.get("newTaskJobId") || "");
      params.delete("newTask");
      params.delete("newTaskJobId");
      const nextQuery=params.toString();
      window.history.replaceState({},"",`${window.location.pathname}${nextQuery?`?${nextQuery}`:""}`);
      window.setTimeout(()=>titleInputRef.current?.focus(),0);
    }
    void load();
  }, [load]);
  useEffect(()=>{if(!auth.profile?.isActive)return;void Promise.all([loadWorkCollaborators(),loadWorkJobs(),refreshAttachmentCounts()]).then(([nextUsers,nextJobs])=>{const others=nextUsers.filter((user)=>user.userId!==auth.profile?.userId);setCollaborators(others);setInboxRecipients(others);setJobs(nextJobs);}).catch((caught)=>setError(caught instanceof Error?caught.message:"Some My Work options could not be loaded."));},[auth.profile?.isActive,auth.profile?.userId,refreshAttachmentCounts]);
  const refreshInboxUnread = useCallback(async () => {
    if(!auth.profile?.userId)return;
    try { setInboxUnreadCount(await loadInboxUnreadCount(auth.profile.userId)); } catch { /* The Inbox surface reports migration/load errors when opened. */ }
  },[auth.profile?.userId]);
  useEffect(()=>{void refreshInboxUnread();},[refreshInboxUnread]);
  useEffect(()=>{if(!inboxRailExpanded)return;void loadInboxMessages().then(setInboxMessages).catch(()=>setInboxMessages([]));},[inboxRailExpanded]);
  useEffect(()=>{const userId=auth.profile?.userId;if(!userId)return;const refresh=()=>{void refreshInboxUnread();if(inboxRailExpanded)void loadInboxMessages().then(setInboxMessages).catch(()=>setInboxMessages([]));};const channel=supabase.channel(`my-work-inbox-badge:${userId}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"my_work_messages",filter:`recipient_user_id=eq.${userId}`},refresh).on("postgres_changes",{event:"UPDATE",schema:"public",table:"my_work_messages",filter:`recipient_user_id=eq.${userId}`},refresh).subscribe();return()=>{void supabase.removeChannel(channel);};},[auth.profile?.userId,inboxRailExpanded,refreshInboxUnread]);
  useEffect(()=>{const openInbox=(event:Event)=>{const userId=(event as CustomEvent<{userId?:string}>).detail?.userId??"";setInboxInitialUserId(userId);setInboxComposeNew(false);setInboxOpen(true);};window.addEventListener("tenops:open-inbox",openInbox);return()=>window.removeEventListener("tenops:open-inbox",openInbox);},[]);
  useEffect(() => { if (!focusTaskId || loading) return; window.setTimeout(() => document.querySelector(`[data-work-task-id="${focusTaskId}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 0); }, [focusTaskId, loading]);
  useEffect(() => {
    const userId = auth.profile?.userId;
    if (!userId) return;
    const stored = window.localStorage.getItem(`tenops_my_work_sort:${userId}`);
    if (SORT_OPTIONS.some((option) => option.value === stored)) setSortMode(stored as SortMode);
  }, [auth.profile?.userId]);

  const visible = useMemo(() => tasks.filter((task) => (view === "today" || view === "all" || (view === "private" ? task.visibility === "private" : task.visibility === "shared")) && (!filterJobId || task.contextId === filterJobId)), [filterJobId, tasks, view]);
  const sortedVisible = useMemo(() => {
    const colorOrder = new Map(COLORS.map((color, index) => [color.key, index]));
    const dueValue = (task: WorkTask) => task.dueDate ? new Date(`${task.dueDate}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
    return [...visible].sort((left, right) => {
      let comparison = 0;
      if (sortMode === "attention" || sortMode === "due") comparison = dueValue(left) - dueValue(right);
      else if (sortMode === "recent") comparison = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      else if (sortMode === "estimate-asc") comparison = (normalizeEstimatedMinutes(left.estimatedMinutes)??Number.POSITIVE_INFINITY)-(normalizeEstimatedMinutes(right.estimatedMinutes)??Number.POSITIVE_INFINITY);
      else if (sortMode === "estimate-desc") {const leftEstimate=normalizeEstimatedMinutes(left.estimatedMinutes);const rightEstimate=normalizeEstimatedMinutes(right.estimatedMinutes);comparison=leftEstimate===null?1:rightEstimate===null?-1:rightEstimate-leftEstimate;}
      else if (sortMode === "color") comparison = (colorOrder.get(left.color) ?? 0) - (colorOrder.get(right.color) ?? 0);
      else comparison = `${left.jobNumber} ${left.jobName}`.localeCompare(`${right.jobNumber} ${right.jobName}`, undefined, { numeric: true, sensitivity: "base" });
      return comparison || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime() || left.id.localeCompare(right.id);
    });
  }, [sortMode, visible]);
  const open = sortedVisible.filter((task) => !task.completedAt);
  const completed = sortedVisible.filter((task) => Boolean(task.completedAt));
  const todaySections=useMemo(()=>{const relevant=open.filter((task)=>dueBucket(task,7)!=="undated"&&dueBucket(task,7)!=="later");return([['overdue','Overdue'],['today','Today'],['upcoming','Upcoming']] as const).map(([key,label])=>({key,label,tasks:relevant.filter((task)=>dueBucket(task,7)===key)})).filter((section)=>section.tasks.length);},[open]);
  const workloadScope=useMemo(()=>view==='today'?sortedVisible.filter((task)=>!task.completedAt&&dueBucket(task,7)!=='undated'&&dueBucket(task,7)!=='later'):sortedVisible,[sortedVisible,view]);
  const workload=useMemo(()=>{const viewerId=auth.profile?.userId;const personal=workloadScope.filter((task)=>task.assigneeUserId===viewerId);const delegated=workloadScope.filter((task)=>task.visibility==='shared'&&task.creatorUserId===viewerId&&task.assigneeUserId!==viewerId);const estimated=personal.filter((task)=>normalizeEstimatedMinutes(task.estimatedMinutes)!==null);const completedCount=personal.filter((task)=>Boolean(task.completedAt)).length;const estimatedTotal=estimated.reduce((total,task)=>total+(normalizeEstimatedMinutes(task.estimatedMinutes)??0),0);const estimatedCompleted=estimated.filter((task)=>Boolean(task.completedAt)).reduce((total,task)=>total+(normalizeEstimatedMinutes(task.estimatedMinutes)??0),0);const estimatedRemaining=estimatedTotal-estimatedCompleted;const delegatedOpen=delegated.filter((task)=>!task.completedAt);const delegatedEstimatedRemaining=delegatedOpen.reduce((total,task)=>total+(normalizeEstimatedMinutes(task.estimatedMinutes)??0),0);return{total:personal.length,open:personal.length-completedCount,completed:completedCount,estimatedTotal,estimatedCompleted,estimatedRemaining,unestimated:personal.length-estimated.length,delegated:delegated.length,delegatedOpen:delegatedOpen.length,delegatedEstimatedRemaining};},[auth.profile?.userId,workloadScope]);
  const groupedOpen=useMemo(()=>{
    if(groupMode==='none')return[];
    if(groupMode==='due')return([['overdue','Overdue'],['today','Today'],['upcoming','Upcoming'],['undated','No Date']] as const).map(([key,label])=>({key,label,tasks:open.filter((task)=>dueBucket(task)===key)})).filter((section)=>section.tasks.length);
    if(groupMode==='effort')return([{key:'quick',label:'Quick',matches:(task:WorkTask)=>{const value=normalizeEstimatedMinutes(task.estimatedMinutes);return value!==null&&value<30;}},{key:'short',label:'Short',matches:(task:WorkTask)=>{const value=normalizeEstimatedMinutes(task.estimatedMinutes);return value!==null&&value>=30&&value<60;}},{key:'medium',label:'Medium',matches:(task:WorkTask)=>{const value=normalizeEstimatedMinutes(task.estimatedMinutes);return value!==null&&value>=60&&value<=120;}},{key:'long',label:'Long',matches:(task:WorkTask)=>{const value=normalizeEstimatedMinutes(task.estimatedMinutes);return value!==null&&value>120;}},{key:'no-estimate',label:'No estimate',matches:(task:WorkTask)=>normalizeEstimatedMinutes(task.estimatedMinutes)===null}]).map((group)=>({key:group.key,label:group.label,tasks:open.filter(group.matches)})).filter((group)=>group.tasks.length);
    const groups=new Map<string,{key:string;label:string;tasks:WorkTask[]}>();for(const task of open){const key=task.contextType==='job'?task.contextId:'no-job';const label=task.contextType==='job'?[task.jobNumber,task.jobName].filter(Boolean).join(' · '):'No Job';const group=groups.get(key)??{key,label,tasks:[]};group.tasks.push(task);groups.set(key,group);}return[...groups.values()].sort((left,right)=>left.key==='no-job'?1:right.key==='no-job'?-1:left.label.localeCompare(right.label,undefined,{numeric:true,sensitivity:'base'}));
  },[groupMode,open]);
  const selectedJob = jobs.find((job) => job.id === filterJobId);
  const changeSort = (next: SortMode) => { setSortMode(next); if (auth.profile?.userId) window.localStorage.setItem(`tenops_my_work_sort:${auth.profile.userId}`, next); };

  async function add() {
    if (!title.trim() || saving) return;
    setSaving(true); setError("");
    try {
      const id = await createWorkTask({ title: title.trim(), notes, assigneeUserId: assignee, dueDate, estimatedMinutes, jobId, color });
      try { await uploadWorkTaskAttachments(id,stagedFiles,(stage)=>setAttachmentActivity(stage==='uploading'?'Uploading attachments…':'Associating attachments…'));setAttachmentActivity('Finalizing task…'); await finalizeWorkTaskCreation(id,stagedFiles.length); }
      catch(caught){setTitle("");setNotes("");setDueDate("");setEstimatedMinutes(null);setJobId("");setAssignee("");setColor("neutral");setStagedFiles([]);await load();setFocusTaskId(id);throw new Error(`Task created, but attachments are incomplete and no assignment notification was sent. Open the task and retry the attachment. ${caught instanceof Error?caught.message:""}`.trim());}
      setTitle(""); setNotes(""); setDueDate(""); setEstimatedMinutes(null); setJobId(""); setAssignee(""); setColor("neutral"); setStagedFiles([]);setAttachmentActivity("");
      await load();setTasks((current)=>current.map((task)=>task.id===id?{...task,attachmentCount:stagedFiles.length}:task)); setFocusTaskId(id);
      window.dispatchEvent(new Event("tenops:notifications-changed"));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create task."); }
    finally { setSaving(false);setAttachmentActivity(""); }
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

  function openDetails(task: WorkTask) { setSelectedTask(task); setDetail(detailFromTask(task));setDetailFiles([]);setDetailAttachments([]);void loadWorkTaskAttachments(task.id).then(setDetailAttachments).catch((caught)=>setError(caught instanceof Error?caught.message:"Unable to load attachments.")); }
  function closeDetails() { if (!detailSaving&&!taskDeleting) { setSelectedTask(null); setDetail(null); setDetailFiles([]);setDetailAttachments([]); } }
  async function saveDetails() {
    if (!selectedTask || !detail || !detail.title.trim() || detailSaving) return;
    setDetailSaving(true); setError("");
    try {
      await updateWorkTask({ id: selectedTask.id, ...detail, title: detail.title.trim() });
      if(detailFiles.length)await uploadWorkTaskAttachments(selectedTask.id,detailFiles,(stage)=>setAttachmentActivity(stage==='uploading'?'Uploading attachments…':'Associating attachments…'));
      const nextAttachments=await loadWorkTaskAttachments(selectedTask.id);
      if(selectedTask.creatorUserId===auth.profile?.userId)await finalizeWorkTaskCreation(selectedTask.id,nextAttachments.length);
      await load();setTasks((current)=>current.map((task)=>task.id===selectedTask.id?{...task,attachmentCount:nextAttachments.length}:task)); setSelectedTask(null); setDetail(null);
      window.dispatchEvent(new Event("tenops:notifications-changed"));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save task."); }
    finally { setDetailSaving(false);setAttachmentActivity(""); }
  }
  async function applyQuickTaskUpdate(task:WorkTask,changes:{color?:WorkTaskColor;dueDate?:string;estimatedMinutes?:number|null}){
    if(quickSaving)return;setQuickSaving(true);setError("");
    try{await updateWorkTask({id:task.id,title:task.title,notes:task.notes,assigneeUserId:task.assigneeUserId,dueDate:changes.dueDate??task.dueDate,estimatedMinutes:changes.estimatedMinutes===undefined?task.estimatedMinutes:changes.estimatedMinutes,jobId:task.contextType==='job'?task.contextId:'',color:changes.color??task.color});await load();setQuickTaskId("");setQuickAction("");}
    catch(caught){setError(caught instanceof Error?caught.message:"Unable to update task.");}
    finally{setQuickSaving(false);}
  }
  async function addQuickAttachments(task:WorkTask,files:File[]){
    if(!files.length||quickSaving)return;setQuickSaving(true);setError("");
    try{await uploadWorkTaskAttachments(task.id,files,(stage)=>setAttachmentActivity(stage==='uploading'?'Uploading attachments…':'Associating attachments…'));const attachments=await loadWorkTaskAttachments(task.id);if(task.creatorUserId===auth.profile?.userId)await finalizeWorkTaskCreation(task.id,attachments.length);await load();setTasks((current)=>current.map((candidate)=>candidate.id===task.id?{...candidate,attachmentCount:attachments.length}:candidate));setQuickTaskId("");}
    catch(caught){setError(caught instanceof Error?caught.message:"Unable to add attachment.");}
    finally{setQuickSaving(false);setAttachmentActivity("");}
  }
  async function deleteSelectedTask(){if(!selectedTask||taskDeleting||!window.confirm("Permanently delete this task? This removes the task, its attachments, and task-owned metadata for all participants. This cannot be undone."))return;setTaskDeleting(true);setError("");try{await permanentlyDeleteWorkTask(selectedTask.id);setSelectedTask(null);setDetail(null);setDetailAttachments([]);setDetailFiles([]);await load();window.dispatchEvent(new Event("tenops:notifications-changed"));}catch(caught){setError(caught instanceof Error?caught.message:"Unable to permanently delete task.");}finally{setTaskDeleting(false);}}

  function taskCard(task: WorkTask,{hideJob=false,hideDue=false}:{hideJob?:boolean;hideDue?:boolean}={}) {
    const isFocused = task.id === focusTaskId;
    const visualCompleted = task.id in transitioning ? transitioning[task.id] : Boolean(task.completedAt);
    const sharedCopy = task.creatorUserId === auth.profile?.userId
      ? `Assigned to ${participantName(task.assigneeName)}`
      : task.assigneeUserId === auth.profile?.userId
        ? `From ${participantName(task.creatorName)}`
        : `With ${participantName(task.assigneeName)}`;
    const due = dueCopy(task.dueDate);
    return <div key={task.id} className={`grid transition-[grid-template-rows,opacity,margin] duration-150 ${collapsing.has(task.id) ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}><div className={`min-h-0 ${collapsing.has(task.id)?"overflow-hidden":"overflow-visible"}`}><article data-work-task-id={task.id} data-task-color={task.color} role="button" tabIndex={0} onClick={(event)=>{if((event.target as Element).closest('[data-task-interactive]'))return;openDetails(task);}} onKeyDown={(event)=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openDetails(task);}}} className={`group relative flex min-h-14 cursor-pointer items-start gap-2 rounded-md border border-l-4 bg-white px-2 py-1.5 transition hover:border-slate-400 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${colorEdge(task.color)} ${isFocused ? "border-blue-600 ring-2 ring-blue-200" : "border-slate-200"}`}>
      <button data-task-interactive type="button" onClick={() => void toggle(task)} aria-label={visualCompleted ? `Reopen ${task.title}` : `Complete ${task.title}`} className="flex h-11 w-11 shrink-0 items-center justify-center"><span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition ${visualCompleted ? "border-blue-700 bg-blue-700 text-white" : "border-slate-400 bg-white text-transparent group-hover:border-blue-700"}`}><Check className="h-4 w-4" /></span></button>
      <div className="min-w-0 flex-1 py-1">
        <div className={`text-[16px] font-medium leading-5 text-slate-950 transition ${visualCompleted ? "text-slate-500 line-through decoration-slate-400" : ""}`}>{task.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
          {!hideJob&&task.contextType === "job" && <button data-task-interactive type="button" onClick={() => openProductionJob(task.contextId)} className="inline-flex min-w-0 max-w-full items-center gap-1 font-medium text-blue-800 hover:underline"><BriefcaseBusiness className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{task.jobNumber ? `${task.jobNumber} · ` : ""}{task.jobName}</span></button>}
          {task.visibility === "shared" ? <span className="inline-flex items-center gap-1"><Handshake className="h-4 w-4" />{sharedCopy}</span> : <span className="inline-flex items-center gap-1"><PrivateTaskIcon className="h-3.5 w-3.5" />Private</span>}
          {formatEstimatedMinutes(task.estimatedMinutes)&&<span className="inline-flex items-center gap-1" title={`Estimated time: ${formatEstimatedMinutes(task.estimatedMinutes)}`}><Clock3 className="h-3.5 w-3.5" />{formatEstimatedMinutes(task.estimatedMinutes)}</span>}
          {task.attachmentCount>0&&<span className="inline-flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" />{task.attachmentCount}</span>}
        </div>
      </div>
      {!hideDue&&due && <div className={`shrink-0 px-2 py-2 text-xs font-medium ${visualCompleted?"text-slate-400":due.className}`}><CalendarDays className="mr-1 inline h-3.5 w-3.5" />{due.label}</div>}
      <div data-task-interactive className="shrink-0"><button type="button" aria-label={`Quick actions for ${task.title}`} aria-expanded={quickTaskId===task.id} onClick={()=>{const opening=quickTaskId!==task.id;setQuickTaskId(opening?task.id:"");setQuickAction("");setQuickDueDate(task.dueDate);setQuickEstimate(normalizeEstimatedMinutes(task.estimatedMinutes));}} className="flex h-11 w-11 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"><MoreHorizontal className="h-5 w-5" /></button>{quickTaskId===task.id&&<div role="menu" className="absolute right-2 top-12 z-40 w-[min(18rem,calc(100vw-2rem))] rounded-md border border-slate-300 bg-white p-2 text-left shadow-xl" onClick={(event)=>event.stopPropagation()}>
        <div className="grid gap-1"><button type="button" onClick={()=>setQuickAction(quickAction==='color'?'':'color')} className="min-h-11 rounded px-3 text-left text-sm font-medium hover:bg-slate-100">Change color</button>{quickAction==='color'&&<div className="flex flex-wrap gap-2 border-b border-slate-200 px-2 pb-3">{COLORS.map((item)=><button key={item.key} type="button" aria-label={item.label} onClick={()=>void applyQuickTaskUpdate(task,{color:item.key})} className={`flex h-10 w-10 items-center justify-center rounded-full border ${task.color===item.key?'border-slate-900 ring-2 ring-blue-200':'border-slate-300'}`}><span className={`h-5 w-5 rounded-full ${item.swatch}`} /></button>)}</div>}
        <button type="button" onClick={()=>setQuickAction(quickAction==='due'?'':'due')} className="min-h-11 rounded px-3 text-left text-sm font-medium hover:bg-slate-100">Set or change due date</button>{quickAction==='due'&&<div className="flex gap-2 border-b border-slate-200 px-2 pb-3"><input type="date" value={quickDueDate} onChange={(event)=>setQuickDueDate(event.target.value)} className="h-11 min-w-0 flex-1 rounded border border-slate-300 px-2 text-sm" /><button type="button" disabled={quickSaving} onClick={()=>void applyQuickTaskUpdate(task,{dueDate:quickDueDate})} className="tenops-selected-surface h-11 rounded border px-3 text-sm">Apply</button></div>}
        <button type="button" onClick={()=>setQuickAction(quickAction==='estimate'?'':'estimate')} className="min-h-11 rounded px-3 text-left text-sm font-medium hover:bg-slate-100">Set or change estimated time</button>{quickAction==='estimate'&&<div className="space-y-2 border-b border-slate-200 px-2 pb-3"><EstimatedTimeInput value={quickEstimate} onChange={setQuickEstimate} label={`Quick estimated time ${task.id}`} /><div className="flex flex-wrap gap-1">{ESTIMATE_PRESETS.map((minutes)=><button key={minutes} type="button" onClick={()=>setQuickEstimate(minutes)} className="h-9 min-w-9 rounded border border-slate-300 px-2 text-xs">{minutes}</button>)}</div><div className="flex gap-2"><button type="button" onClick={()=>setQuickEstimate(null)} className="h-10 rounded border border-slate-300 px-3 text-xs">Clear</button><button type="button" disabled={quickSaving} onClick={()=>void applyQuickTaskUpdate(task,{estimatedMinutes:quickEstimate})} className="tenops-selected-surface h-10 rounded border px-3 text-xs">Apply</button></div></div>}
        <label className="flex min-h-11 cursor-pointer items-center rounded px-3 text-sm font-medium hover:bg-slate-100">Add attachment<AttachmentFileInput disabled={quickSaving} onFiles={(files)=>void addQuickAttachments(task,files)} onError={setError} onPreparing={(preparing)=>setAttachmentActivity(preparing?'Preparing preview…':'')} /></label>
        {task.contextType==='job'&&<button type="button" onClick={()=>{setQuickTaskId("");openProductionJob(task.contextId);}} className="min-h-11 rounded px-3 text-left text-sm font-medium hover:bg-slate-100">Open Job</button>}
        <button type="button" onClick={()=>{setQuickTaskId("");void toggle(task);}} className="min-h-11 rounded px-3 text-left text-sm font-medium hover:bg-slate-100">{task.completedAt?'Mark open':'Mark complete'}</button></div>
      </div>}</div>
    </article></div></div>;
  }

  return <main data-my-work className="flex w-full items-start">
    <InboxRail expanded={inboxRailExpanded} onExpanded={setInboxRailExpanded} messages={inboxMessages} currentUserId={auth.profile?.userId??""} recipients={inboxRecipients} unreadCount={inboxUnreadCount} onOpenConversation={(userId)=>{setInboxInitialUserId(userId);setInboxComposeNew(false);setInboxOpen(true);}} onNewMessage={()=>{setInboxInitialUserId("");setInboxComposeNew(true);setInboxOpen(true);}} />
    <div className="mx-auto min-w-0 w-full max-w-[1120px] flex-1 px-3 py-5 sm:px-6 sm:py-7">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-[.15em] text-slate-500">Personal workspace</div><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">My Work</h1><p className="mt-0.5 text-sm text-slate-600">Your tasks, all in one place.</p></div><div className="flex flex-wrap items-center justify-end gap-2"><button type="button" onClick={()=>{setInboxInitialUserId("");setInboxComposeNew(false);setInboxOpen(true);}} aria-label={inboxUnreadCount?`Inbox, ${inboxUnreadCount} unread messages`:"Inbox"} className="relative inline-flex h-11 items-center gap-2 rounded-md border border-blue-300 bg-blue-50/70 px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-px hover:border-blue-400 hover:bg-blue-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 min-[1440px]:hidden"><InboxIcon className="h-4 w-4 text-blue-800" />Inbox{inboxUnreadCount?<span aria-hidden="true" className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">{inboxUnreadCount>9?"9+":inboxUnreadCount}</span>:null}</button><ToolboxLauncher /></div></header>

    <div className="mt-2 flex max-w-full flex-nowrap overflow-x-auto border-b border-slate-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="My Work views">{([['today','Today'],['all','All Tasks'],['private','My Tasks'],['shared','Shared Tasks']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={view === value} onClick={(event) => {setView(value);event.currentTarget.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});}} className={`flex h-11 shrink-0 items-center justify-center gap-2 border-b-2 px-3 text-sm font-medium sm:px-4 ${view === value ? "border-blue-800 text-blue-900" : "border-transparent text-slate-500 hover:text-slate-900"}`}>{value === "today"&&<CalendarCheck className="h-4 w-4" />}{value === "private" && <PrivateTaskIcon className="h-4 w-4" />}{value === "shared" && <Handshake className="h-[18px] w-[18px]" />}{label}</button>)}</div>
    <div className="mt-2 min-h-5 text-xs text-slate-500">{view === "today"?"Open tasks due now or within the next 7 days.":view === "private" ? <span className="inline-flex items-center gap-1.5"><PrivateTaskIcon className="h-3.5 w-3.5" />Private to you</span> : view === "shared" ? <span className="inline-flex items-center gap-1.5"><Handshake className="h-[17px] w-[17px]" />Tasks exchanged with another TenOps user</span> : "Your private tasks and participant-visible Shared Tasks together."}</div>

    {filterJobId && <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900"><span className="truncate">Showing tasks for {selectedJob ? jobLabel(selectedJob) : "this Job"}</span><button type="button" onClick={() => { setFilterJobId(""); window.history.replaceState({}, "", window.location.pathname); }} className="flex h-10 w-10 shrink-0 items-center justify-center" aria-label="Clear Job filter"><X className="h-4 w-4" /></button></div>}

    <section className="mt-4 rounded-lg border border-slate-300 bg-white p-2 sm:p-3" onFocus={() => setComposerOpen(true)}>
      <div className="flex items-center gap-2"><Plus className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" /><input ref={titleInputRef} value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void add(); } }} placeholder="What needs to get done?" aria-label="Task title" className="h-11 min-w-0 flex-1 border-0 bg-transparent px-1 text-base font-normal text-slate-950 outline-none" /><button type="button" onClick={() => void add()} disabled={!title.trim() || saving} className="tenops-selected-surface hidden h-10 shrink-0 rounded-md border px-4 text-sm font-medium disabled:opacity-40 sm:block">{saving ? attachmentActivity||"Adding…" : "Add task"}</button></div>
      {composerOpen && <div className="mt-2 space-y-2 border-t border-slate-200 pt-2">
        <label className="block text-xs text-slate-600"><span className="mb-1 flex items-center gap-1"><NotebookPen className="h-3.5 w-3.5" />Notes</span><textarea value={notes} onChange={(event)=>setNotes(event.target.value)} rows={2} className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-[160px_160px_minmax(0,1fr)_220px]">
          <label className="text-xs text-slate-600"><span className="mb-1 flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />Due</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="h-11 w-full rounded-md border border-slate-300 bg-white px-2 text-sm" /></label>
          <label className="text-xs text-slate-600"><span className="mb-1 flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />Estimated time</span><EstimatedTimeInput value={estimatedMinutes} onChange={setEstimatedMinutes} label="Composer estimated time" /></label>
          <label className="text-xs text-slate-600"><span className="mb-1 flex items-center gap-1"><BriefcaseBusiness className="h-3.5 w-3.5" />Job</span><JobCombobox jobs={jobs} value={jobId} onChange={setJobId} label="Composer Job" /></label>
          <label className="text-xs text-slate-600"><span className="mb-1 flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />Share</span><select value={assignee} onChange={(event) => setAssignee(event.target.value)} className="h-11 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"><option value="">Keep private</option>{collaborators.map((user) => <option key={user.userId} value={user.userId}>{user.displayName}</option>)}</select></label>
        </div>
        <div><div className="mb-2 text-xs text-slate-600">Color</div><ColorPicker value={color} onChange={setColor} /></div>
        <StagedAttachments files={stagedFiles} onAdd={(files)=>setStagedFiles((current)=>[...current,...files])} onRemove={(index)=>setStagedFiles((current)=>current.filter((_,candidate)=>candidate!==index))} onError={setError} onPreparing={(preparing)=>setAttachmentActivity(preparing?"Preparing preview…":"")} disabled={saving} />
        {attachmentActivity&&!saving?<p role="status" className="text-xs font-medium text-blue-800">{attachmentActivity}</p>:null}
        <button type="button" onClick={() => void add()} disabled={!title.trim() || saving} className="tenops-selected-surface h-11 w-full rounded-md border px-4 text-sm font-medium disabled:opacity-40 sm:hidden">{saving ? attachmentActivity||"Adding…" : "Add task"}</button>
      </div>}
    </section>

    {error && <div role="alert" className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{error}</div>}
    {loading ? <div className="mt-6 text-sm text-slate-500">Loading My Work…</div> : <>
      <section data-workload-summary className="mt-2 rounded-md border border-slate-200 bg-white"><button type="button" onClick={()=>setWorkloadOpen((current)=>!current)} aria-expanded={workloadOpen} className="flex min-h-11 w-full min-w-0 items-center justify-between gap-3 px-3 text-left text-xs text-slate-600"><span className="min-w-0 truncate"><strong className="font-semibold text-slate-800">Workload</strong> · {view==='shared'?`Assigned to me: ${workload.open} open · Assigned by me: ${workload.delegatedOpen} open`:`${workload.open} open · ${workload.estimatedRemaining>0?`~${formatEstimatedMinutes(workload.estimatedRemaining)} estimated`:workload.estimatedTotal===0?'No estimates yet':'No estimated effort remaining'}`}</span>{workloadOpen?<ChevronDown className="h-4 w-4 shrink-0"/>:<ChevronRight className="h-4 w-4 shrink-0"/>}</button>{workloadOpen&&<div className="space-y-3 border-t border-slate-200 px-3 py-3 text-xs text-slate-600"><div><strong className="font-semibold text-slate-700">Assigned to me</strong> · {workload.completed} of {workload.total} tasks complete</div>{workload.estimatedTotal>0&&<><div className="h-1.5 overflow-hidden rounded-full bg-slate-200" aria-label="Estimated effort completion for tasks assigned to me"><div className="h-full bg-blue-700" style={{width:`${Math.min(100,(workload.estimatedCompleted/workload.estimatedTotal)*100)}%`}} /></div><div>{workload.estimatedCompleted>0?`${formatEstimatedMinutes(workload.estimatedCompleted)} of ${formatEstimatedMinutes(workload.estimatedTotal)} estimated effort complete`:`No estimated effort complete of ${formatEstimatedMinutes(workload.estimatedTotal)}`}</div><div>{workload.estimatedRemaining>0?`~${formatEstimatedMinutes(workload.estimatedRemaining)} estimated effort remaining`:'No estimated effort remaining'}</div></>}{workload.estimatedTotal===0&&<div>No estimates yet for tasks assigned to me</div>}{workload.unestimated>0&&<div>{workload.unestimated} {workload.unestimated===1?'task':'tasks'} assigned to me without estimates</div>}{workload.delegated>0&&<div className="border-t border-slate-200 pt-3"><strong className="font-semibold text-slate-700">Assigned by me</strong> · {workload.delegatedOpen} open{workload.delegatedEstimatedRemaining>0?` · ~${formatEstimatedMinutes(workload.delegatedEstimatedRemaining)} delegated`:''}</div>}</div>}</section>
      <div className="mt-5 flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2"><span className="text-sm font-medium text-slate-700">{view==='today'?todaySections.reduce((count,section)=>count+section.tasks.length,0):open.length} open</span><div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{view!=='today'&&<label className="flex items-center gap-1 text-xs text-slate-500"><span>Group</span><select value={groupMode} onChange={(event)=>setGroupMode(event.target.value as GroupMode)} className="h-10 max-w-full rounded-md border border-slate-300 bg-white px-2 text-sm font-medium text-slate-700"><option value="none">None</option><option value="due">Due Date</option><option value="job">Job</option><option value="effort">Effort</option></select></label>}<label className="flex min-w-0 flex-1 items-center gap-1 text-xs text-slate-500 sm:flex-none"><ArrowUpDown className="h-4 w-4 shrink-0" /><span className="sr-only">Sort tasks</span><select value={sortMode} onChange={(event) => changeSort(event.target.value as SortMode)} className="h-10 min-w-0 max-w-full rounded-md border border-slate-300 bg-white px-2 text-sm font-medium text-slate-700">{SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div></div>
      {view==='today'?<section className="mt-3 space-y-5" aria-label="Today tasks">{todaySections.length?todaySections.map((section)=><div key={section.key}><div className="mb-2 flex items-center gap-2"><h2 className={`shrink-0 text-[11px] font-semibold uppercase tracking-[.12em] ${section.key==='overdue'?'text-red-700':section.key==='today'?'text-amber-700':'text-slate-500'}`}>{section.label}</h2><span className="h-px flex-1 bg-slate-200" /></div><div className="space-y-2">{section.tasks.map((task)=>taskCard(task,{hideDue:section.key!=='upcoming'}))}</div></div>):<p className="py-8 text-center text-sm text-slate-500">Nothing needs attention today.</p>}</section>:groupMode==='none'?<section className="mt-2 space-y-2" aria-label="Open tasks">{open.length ? open.map((task)=>taskCard(task)) : <div className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-10 text-center"><div className="text-sm font-medium text-slate-700">Nothing open</div><div className="mt-1 text-xs text-slate-500">Add a task when something comes up.</div></div>}</section>:<section className="mt-3 space-y-5" aria-label="Grouped open tasks">{groupedOpen.map((section)=><div key={section.key}><div className="mb-2 flex items-center gap-2"><h2 className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[.12em] text-slate-500">{section.label}</h2><span className="h-px min-w-6 flex-1 bg-slate-200" /></div><div className="space-y-2">{section.tasks.map((task)=>taskCard(task,{hideJob:groupMode==='job'&&section.key!=='no-job',hideDue:groupMode==='due'&&(section.key==='overdue'||section.key==='today')}))}</div></div>)}</section>}
      {view!=='today'&&completed.length > 0 && <section className="mt-8 border-t-2 border-slate-400 pt-2"><button type="button" onClick={() => setCompletedOpen((value) => !value)} aria-expanded={completedOpen} className="flex h-11 w-full items-center justify-between border-b border-slate-200 px-2 text-sm font-medium text-slate-500"><span>Completed ({completed.length})</span>{completedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>{completedOpen && <div className="mt-3 space-y-2">{completed.map((task)=>taskCard(task))}</div>}</section>}
    </>}

    {selectedTask && detail && <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/35" role="dialog" aria-modal="true" aria-labelledby="my-work-detail-title" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetails(); }}><div className="flex h-full w-full max-w-xl flex-col border-l border-slate-300 bg-white shadow-[-12px_0_30px_rgba(15,23,42,.18)]">
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6"><div><div className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Task details</div><h2 id="my-work-detail-title" className="mt-1 text-xl font-semibold text-slate-950">Edit task</h2></div><button type="button" onClick={closeDetails} aria-label="Close task details" className="flex h-11 w-11 items-center justify-center rounded-md border border-slate-300"><X className="h-5 w-5" /></button></header>
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
        <label className="block text-sm font-medium text-slate-700">Title<input value={detail.title} onChange={(event) => setDetail({ ...detail, title: event.target.value })} className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base font-normal" /></label>
        <label className="block text-sm font-medium text-slate-700">Notes<textarea value={detail.notes} onChange={(event) => setDetail({ ...detail, notes: event.target.value })} rows={6} placeholder="What do you need to remember?" className="mt-1 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal" /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Due date<input type="date" value={detail.dueDate} onChange={(event) => setDetail({ ...detail, dueDate: event.target.value })} className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" /></label><label className="text-sm font-medium text-slate-700">Estimated time<span className="mt-1 block"><EstimatedTimeInput value={detail.estimatedMinutes} onChange={(next)=>setDetail({...detail,estimatedMinutes:next})} label="Task estimated time" /></span></label><label className="text-sm font-medium text-slate-700">Share with<select value={detail.assigneeUserId} disabled={selectedTask.creatorUserId !== auth.profile?.userId} onChange={(event) => setDetail({ ...detail, assigneeUserId: event.target.value })} className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 font-normal disabled:opacity-60"><option value={selectedTask.creatorUserId}>Keep private</option>{collaborators.map((user) => <option key={user.userId} value={user.userId}>{user.displayName}</option>)}</select></label></div>
        <label className="block text-sm font-medium text-slate-700">Job<span className="mt-1 block"><JobCombobox jobs={jobs} value={detail.jobId} onChange={(nextJobId) => setDetail({ ...detail, jobId: nextJobId })} label="Task detail Job" /></span></label>
        {detail.jobId && <button type="button" onClick={() => openProductionJob(detail.jobId)} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium text-blue-800"><BriefcaseBusiness className="h-4 w-4" />Open linked Job</button>}
        <div><div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-700">Color<span title="Color is personal to your workspace and does not change another participant’s view." aria-label="About task color" tabIndex={0} className="inline-flex text-slate-400"><Info className="h-3.5 w-3.5" /></span></div><ColorPicker value={detail.color} onChange={(color) => setDetail({ ...detail, color })} /></div>
        <div className="space-y-2"><div className="text-sm font-medium text-slate-700">Attachments</div><AttachmentList attachments={detailAttachments} currentUserId={auth.profile?.userId??""} creatorUserId={selectedTask.creatorUserId} setError={setError} onChanged={async()=>setDetailAttachments(await loadWorkTaskAttachments(selectedTask.id))} /><StagedAttachments files={detailFiles} onAdd={(files)=>setDetailFiles((current)=>[...current,...files])} onRemove={(index)=>setDetailFiles((current)=>current.filter((_,candidate)=>candidate!==index))} onError={setError} onPreparing={(preparing)=>setAttachmentActivity(preparing?"Preparing preview…":"")} disabled={detailSaving} />{attachmentActivity?<p role="status" className="text-xs font-medium text-blue-800">{attachmentActivity}</p>:null}<p className="text-[11px] text-slate-400">Photos, PDFs, and Office files · 25 MB max</p></div>
        {auth.profile?.role==="admin"?<section className="rounded-md border border-red-200 bg-red-50/60 p-3"><h3 className="text-sm font-semibold text-red-900">Admin cleanup</h3><p className="mt-1 text-xs text-red-800">Permanently removes this task and its task-owned attachments and metadata. This cannot be undone.</p><button type="button" onClick={()=>void deleteSelectedTask()} disabled={taskDeleting||detailSaving} className="mt-3 min-h-11 w-full rounded-md border border-red-500 bg-white px-3 text-sm font-semibold text-red-700 disabled:opacity-50 sm:w-auto">{taskDeleting?"Permanently deleting…":"Permanently delete task"}</button></section>:null}
      </div>
      <footer className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 sm:px-6"><button type="button" onClick={closeDetails} disabled={taskDeleting} className="h-10 rounded-md border border-slate-300 px-4 text-sm font-medium disabled:opacity-50">Cancel</button><button type="button" onClick={() => void saveDetails()} disabled={!detail.title.trim() || detailSaving || taskDeleting} className="tenops-selected-surface h-10 rounded-md border px-4 text-sm font-medium disabled:opacity-40">{detailSaving ? attachmentActivity||"Saving…" : "Save task"}</button></footer>
    </div></div>}
    </div>
    <InboxDialog open={inboxOpen} onClose={()=>{setInboxOpen(false);setInboxComposeNew(false);}} currentUserId={auth.profile?.userId??""} collaborators={inboxRecipients} jobs={jobs} initialUserId={inboxInitialUserId} startNewMessage={inboxComposeNew} onUnreadChange={setInboxUnreadCount} />
  </main>;
}
