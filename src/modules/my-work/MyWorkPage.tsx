"use client";

import { BusinessInput, BusinessSelect, BusinessButton, BusinessTextarea } from '@/components/BusinessWriteControls';

import {
  ArrowUpDown,
  BriefcaseBusiness,
  CalendarDays,
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Folder,
  Handshake,
  MoreHorizontal,
  NotebookPen,
  Paperclip,
  Plus,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import ToolboxLauncher from "@/components/ToolboxLauncher";
import { openProductionJob } from "@/modules/production/job-options";
import {
  createWorkTask,
  createWorkTaskGroup,
  deleteWorkTaskGroup,
  finalizeWorkTaskCreation,
  loadMyWorkOverview,
  loadWorkTaskAttachmentCounts,
  loadWorkTaskAttachments,
  loadWorkCollaborators,
  loadWorkJobs,
  setWorkTaskCompleted,
  setWorkTaskGroup,
  updateWorkTaskGroup,
  updateWorkTask,
  uploadWorkTaskAttachments,
} from "./queries";
import type { WorkCollaborator, WorkJob, WorkTask, WorkTaskColor, WorkTaskGroup } from "./types";
import { dueBucket } from "./task-dates";
import {COLORS,ColorPicker,EstimatedTimeInput,StagedAttachments,JobCombobox,jobLabel} from "./task-controls";
import AttachmentFileInput from "./AttachmentFileInput";
import MyWorkTaskInspector from "./MyWorkTaskInspector";
import { formatEstimatedMinutes, normalizeEstimatedMinutes } from "./estimated-time";

type View = "today" | "all" | "private" | "shared";
type SortMode = "attention" | "due" | "recent" | "color" | "job" | "estimate-asc" | "estimate-desc";
type GroupMode = "none" | "due" | "job" | "effort";


const colorEdge = (color: WorkTaskColor) => COLORS.find((item) => item.key === color)?.edge ?? "border-l-slate-300";
const effectiveColor=(task:WorkTask)=>task.groupColor??task.color;
const participantName = (value: string) => value.trim() || "TenOps user";
const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));


const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [{ value: "attention", label: "Recommended" }, { value: "due", label: "Due Date" }, { value: "recent", label: "Recently Added" }, { value: "estimate-asc", label: "Estimated time: shortest first" }, { value: "estimate-desc", label: "Estimated time: longest first" }, { value: "color", label: "Color" }, { value: "job", label: "Job" }];
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

export default function MyWorkPage() {
  const auth = useAuth();
  const [view, setView] = useState<View>("all");
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [collaborators, setCollaborators] = useState<WorkCollaborator[]>([]);
  const [jobs, setJobs] = useState<WorkJob[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [taskGroups,setTaskGroups]=useState<WorkTaskGroup[]>([]);
  const [groupsOpen,setGroupsOpen]=useState(false);
  const [groupName,setGroupName]=useState("");
  const [groupColor,setGroupColor]=useState<WorkTaskColor>("blue");
  const [groupSaving,setGroupSaving]=useState(false);
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
  const [detailTaskId,setDetailTaskId]=useState('');
  const selectedTask=tasks.find(task=>task.id===detailTaskId)??null;
  const detailOpenerRef=useRef<HTMLElement|null>(null);
  const detailFallbackRef=useRef<HTMLHeadingElement|null>(null);
  const [quickTaskId,setQuickTaskId]=useState("");
  const [quickAction,setQuickAction]=useState<""|"color"|"due"|"estimate">("");
  const [quickDueDate,setQuickDueDate]=useState("");
  const [quickEstimate,setQuickEstimate]=useState<number|null>(null);
  const [quickSaving,setQuickSaving]=useState(false);
  const [workloadOpen,setWorkloadOpen]=useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const attachmentCountsRef=useRef<Map<string,number>>(new Map());
  const openedDeepLinkRef = useRef("");

  const load = useCallback(async () => {
    if (!auth.profile?.isActive) return;
    setLoading(true);
    try {
      const {tasks:nextTasks,groups:nextGroups} = await loadMyWorkOverview();
      setTasks(nextTasks.map((task)=>({...task,attachmentCount:attachmentCountsRef.current.get(task.id)??0})));
      setTaskGroups(nextGroups);
      setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load My Work."); }
    finally { setLoading(false); }
  }, [auth.profile?.isActive]);

  const refreshAttachmentCounts=useCallback(async()=>{const counts=await loadWorkTaskAttachmentCounts();attachmentCountsRef.current=counts;setTasks((current)=>current.map((task)=>({...task,attachmentCount:counts.get(task.id)??0})));},[]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFilterJobId(params.get("jobId") || "");
    setFocusTaskId(params.get("taskId") || "");
    if (params.get("view") === "shared") setView("shared");
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
  useEffect(() => {
    if (!auth.profile?.isActive) return;
    void refreshAttachmentCounts().catch(caught => setError(caught instanceof Error ? caught.message : "Unable to load attachment counts."));
  }, [auth.profile?.isActive, auth.profile?.userId, refreshAttachmentCounts]);
  const optionsVisible = composerOpen || Boolean(filterJobId);
  useEffect(() => {
    if (!auth.profile?.isActive || !optionsVisible) return;
    let live = true;
    setOptionsLoading(true);
    setJobs([]);
    setCollaborators([]);
    void Promise.all([loadWorkCollaborators(), loadWorkJobs()]).then(([nextUsers, nextJobs]) => {
      if (!live) return;
      setCollaborators(nextUsers.filter(user => user.userId !== auth.profile?.userId));
      setJobs(nextJobs);
    }).catch(caught => { if (live) setError(caught instanceof Error ? caught.message : "Some My Work options could not be loaded."); })
      .finally(() => { if (live) setOptionsLoading(false); });
    return () => { live = false; };
  }, [auth.profile?.isActive, auth.profile?.userId, optionsVisible]);
  useEffect(()=>{if(!quickTaskId)return;const dismissPointer=(event:PointerEvent)=>{const target=event.target as Element|null;if(target?.closest('[role="menu"]')||target?.closest('button[aria-expanded="true"][aria-label^="Quick actions"]'))return;setQuickTaskId("");setQuickAction("");};const dismissKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){setQuickTaskId("");setQuickAction("");}};document.addEventListener('pointerdown',dismissPointer);document.addEventListener('keydown',dismissKey);return()=>{document.removeEventListener('pointerdown',dismissPointer);document.removeEventListener('keydown',dismissKey);};},[quickTaskId]);
  useEffect(() => {
    // Resolve only from the current participant-scoped list, including completed tasks.
    if (loading || !focusTaskId || openedDeepLinkRef.current === focusTaskId) return;
    const userId = auth.profile?.userId;
    const task = tasks.find(candidate => candidate.id === focusTaskId && (candidate.assigneeUserId === userId || (candidate.visibility === 'shared' && candidate.creatorUserId === userId)));
    if (!task) return;
    openedDeepLinkRef.current = focusTaskId;
    setDetailTaskId(task.id);
  }, [auth.profile?.userId, focusTaskId, loading, tasks]);
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
      else if (sortMode === "color") comparison = (colorOrder.get(effectiveColor(left)) ?? 0) - (colorOrder.get(effectiveColor(right)) ?? 0);
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

  async function refreshGroups(){await load();}
  async function addGroup(){if(!groupName.trim()||groupSaving)return;setGroupSaving(true);setError("");try{await createWorkTaskGroup(groupName.trim(),groupColor);setGroupName("");setGroupColor("blue");await refreshGroups();}catch(caught){setError(caught instanceof Error?caught.message:"Unable to create Task Group.");}finally{setGroupSaving(false);}}
  async function editGroup(group:WorkTaskGroup,changes:{name?:string;color?:WorkTaskColor}){setGroupSaving(true);setError("");try{await updateWorkTaskGroup(group.id,changes.name??group.name,changes.color??group.color);await refreshGroups();}catch(caught){setError(caught instanceof Error?caught.message:"Unable to update Task Group.");}finally{setGroupSaving(false);}}
  async function removeGroup(group:WorkTaskGroup){const count=tasks.filter(task=>task.groupId===group.id).length;if(!window.confirm(count?`Delete “${group.name}” and remove ${count} task ${count===1?'membership':'memberships'}? Tasks will remain intact.`:`Delete empty Task Group “${group.name}”?`))return;setGroupSaving(true);setError("");try{await deleteWorkTaskGroup(group.id);await refreshGroups();}catch(caught){setError(caught instanceof Error?caught.message:"Unable to delete Task Group.");}finally{setGroupSaving(false);}}
  async function assignGroup(task:WorkTask,nextGroupId:string){setQuickSaving(true);setError("");try{await setWorkTaskGroup(task.id,nextGroupId);await load();setQuickTaskId("");setQuickAction("");}catch(caught){setError(caught instanceof Error?caught.message:"Unable to organize task.");}finally{setQuickSaving(false);}}

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

  function openDetails(task:WorkTask){detailOpenerRef.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setDetailTaskId(task.id);}
  const closeDetails=useCallback(()=>setDetailTaskId(''),[]);
  async function applyQuickTaskUpdate(task:WorkTask,changes:{color?:WorkTaskColor;dueDate?:string;estimatedMinutes?:number|null}){
    if(quickSaving)return;setQuickSaving(true);setError("");
    try{if(changes.color&&task.groupId){const group=taskGroups.find(candidate=>candidate.id===task.groupId);if(group)await updateWorkTaskGroup(group.id,group.name,changes.color);}else await updateWorkTask({id:task.id,title:task.title,notes:task.notes,assigneeUserId:task.assigneeUserId,dueDate:changes.dueDate??task.dueDate,estimatedMinutes:changes.estimatedMinutes===undefined?task.estimatedMinutes:changes.estimatedMinutes,jobId:task.contextType==='job'?task.contextId:'',color:changes.color??task.color});await load();setQuickTaskId("");setQuickAction("");}
    catch(caught){setError(caught instanceof Error?caught.message:"Unable to update task.");}
    finally{setQuickSaving(false);}
  }
  async function addQuickAttachments(task:WorkTask,files:File[]){
    if(!files.length||quickSaving)return;setQuickSaving(true);setError("");
    try{await uploadWorkTaskAttachments(task.id,files,(stage)=>setAttachmentActivity(stage==='uploading'?'Uploading attachments…':'Associating attachments…'));const attachments=await loadWorkTaskAttachments(task.id);if(task.creatorUserId===auth.profile?.userId)await finalizeWorkTaskCreation(task.id,attachments.length);await load();setTasks((current)=>current.map((candidate)=>candidate.id===task.id?{...candidate,attachmentCount:attachments.length}:candidate));setQuickTaskId("");}
    catch(caught){setError(caught instanceof Error?caught.message:"Unable to add attachment.");}
    finally{setQuickSaving(false);setAttachmentActivity("");}
  }


  function taskCard(task: WorkTask,{hideJob=false,hideDue=false}:{hideJob?:boolean;hideDue?:boolean}={}) {
    const isFocused = task.id === focusTaskId;
    const visualCompleted = task.id in transitioning ? transitioning[task.id] : Boolean(task.completedAt);
    const sharedCopy = task.creatorUserId === auth.profile?.userId
      ? `Assigned to ${participantName(task.assigneeName)}`
      : task.assigneeUserId === auth.profile?.userId
        ? `From ${participantName(task.creatorName)}`
        : `With ${participantName(task.assigneeName)}`;
    const due = dueCopy(task.dueDate);
    const shownColor=effectiveColor(task);
    return <div key={task.id} className={`grid min-w-0 max-w-full transition-[grid-template-rows,opacity,margin] duration-150 ${collapsing.has(task.id) ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}><div className={`min-h-0 min-w-0 ${collapsing.has(task.id)?"overflow-hidden":"overflow-visible"}`}><article data-work-task-id={task.id} data-task-color={shownColor} role="button" tabIndex={0} onClick={(event)=>{if((event.target as Element).closest('[data-task-interactive]'))return;openDetails(task);}} onKeyDown={(event)=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openDetails(task);}}} className={`group relative grid min-h-14 min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] cursor-pointer items-start gap-x-2 rounded-md border border-l-4 bg-white px-2 py-1.5 transition hover:border-slate-400 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:flex sm:gap-2 ${colorEdge(shownColor)} ${isFocused ? "border-blue-600 ring-2 ring-blue-200" : "border-slate-200"}`}>
      <button data-task-interactive type="button" disabled={!auth.can("writeBusinessData")} onClick={() => void toggle(task)} aria-label={visualCompleted ? `Reopen ${task.title}` : `Complete ${task.title}`} className="flex h-11 w-11 shrink-0 items-center justify-center"><span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition ${visualCompleted ? "border-blue-700 bg-blue-700 text-white" : "border-slate-400 bg-white text-transparent group-hover:border-blue-700"}`}><Check className="h-4 w-4" /></span></button>
      <div className="col-start-2 row-start-1 min-w-0 flex-1 py-1">
        <div className={`text-[16px] font-medium leading-5 text-slate-950 [overflow-wrap:anywhere] transition ${visualCompleted ? "text-slate-500 line-through decoration-slate-400" : ""}`}>{task.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
          {task.groupId&&<span className="inline-flex min-w-0 max-w-full items-center gap-1 font-medium text-slate-700 [overflow-wrap:anywhere]"><Folder className="h-3.5 w-3.5 shrink-0"/>{task.groupName}</span>}
          {!hideJob&&task.contextType === "job" && <button data-task-interactive type="button" onClick={() => openProductionJob(task.contextId)} className="inline-flex min-w-0 max-w-full items-center gap-1 text-left font-medium text-blue-800 hover:underline"><BriefcaseBusiness className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0 [overflow-wrap:anywhere] sm:truncate">{task.jobNumber ? `${task.jobNumber} · ` : ""}{task.jobName}</span></button>}
          {task.visibility === "shared" ? <span className="inline-flex min-w-0 max-w-full items-center gap-1 [overflow-wrap:anywhere]"><Handshake className="h-4 w-4 shrink-0" />{sharedCopy}</span> : <span className="inline-flex items-center gap-1"><PrivateTaskIcon className="h-3.5 w-3.5 shrink-0" />Private</span>}
          {formatEstimatedMinutes(task.estimatedMinutes)&&<span className="inline-flex items-center gap-1" title={`Estimated time: ${formatEstimatedMinutes(task.estimatedMinutes)}`}><Clock3 className="h-3.5 w-3.5 shrink-0" />{formatEstimatedMinutes(task.estimatedMinutes)}</span>}
          {task.attachmentCount>0&&<span className="inline-flex items-center gap-1"><Paperclip className="h-3.5 w-3.5 shrink-0" />{task.attachmentCount}</span>}
        </div>
      </div>
      {!hideDue&&due && <div className={`col-start-2 row-start-2 shrink-0 pb-1 text-xs font-medium sm:px-2 sm:py-2 ${visualCompleted?"text-slate-400":due.className}`}><CalendarDays className="mr-1 inline h-3.5 w-3.5" />{due.label}</div>}
      <div data-task-interactive className="col-start-3 row-start-1 shrink-0"><BusinessButton type="button" aria-label={`Quick actions for ${task.title}`} aria-expanded={quickTaskId===task.id} onClick={()=>{const opening=quickTaskId!==task.id;setQuickTaskId(opening?task.id:"");setQuickAction("");setQuickDueDate(task.dueDate);setQuickEstimate(normalizeEstimatedMinutes(task.estimatedMinutes));}} className="flex h-11 w-11 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"><MoreHorizontal className="h-5 w-5" /></BusinessButton>{quickTaskId===task.id&&<div role="menu" className="absolute right-2 top-12 z-40 w-[min(18rem,calc(100vw-2rem))] rounded-md border border-slate-300 bg-white p-2 text-left shadow-xl" onClick={(event)=>event.stopPropagation()}>
        <div className="grid gap-1"><BusinessButton type="button" onClick={()=>setQuickAction(quickAction==='color'?'':'color')} className="min-h-11 rounded px-3 text-left text-sm font-medium hover:bg-slate-100">Change {task.groupId?'Group':'Task'} color</BusinessButton>{quickAction==='color'&&<div className="flex flex-wrap gap-2 border-b border-slate-200 px-2 pb-3">{COLORS.map((item)=><BusinessButton key={item.key} type="button" aria-label={item.label} onClick={()=>void applyQuickTaskUpdate(task,{color:item.key})} className={`flex h-10 w-10 items-center justify-center rounded-full border ${shownColor===item.key?'border-slate-900 ring-2 ring-blue-200':'border-slate-300'}`}><span className={`h-5 w-5 rounded-full ${item.swatch}`} /></BusinessButton>)}</div>}
        <label className="px-3 py-2 text-xs font-medium text-slate-600">Task Group<BusinessSelect value={task.groupId} onChange={(event)=>void assignGroup(task,event.target.value)} disabled={quickSaving} className="mt-1 h-11 w-full rounded border border-slate-300 bg-white px-2 text-sm text-slate-800"><option value="">Ungrouped</option>{taskGroups.map(group=><option key={group.id} value={group.id}>{group.name}</option>)}</BusinessSelect></label>
        <BusinessButton type="button" onClick={()=>setQuickAction(quickAction==='due'?'':'due')} className="min-h-11 rounded px-3 text-left text-sm font-medium hover:bg-slate-100">Set or change due date</BusinessButton>{quickAction==='due'&&<div className="flex gap-2 border-b border-slate-200 px-2 pb-3"><BusinessInput type="date" value={quickDueDate} onChange={(event)=>setQuickDueDate(event.target.value)} className="h-11 min-w-0 flex-1 rounded border border-slate-300 px-2 text-sm" /><BusinessButton type="button" disabled={quickSaving} onClick={()=>void applyQuickTaskUpdate(task,{dueDate:quickDueDate})} className="tenops-selected-surface h-11 rounded border px-3 text-sm">Apply</BusinessButton></div>}
        <BusinessButton type="button" onClick={()=>setQuickAction(quickAction==='estimate'?'':'estimate')} className="min-h-11 rounded px-3 text-left text-sm font-medium hover:bg-slate-100">Set or change estimated time</BusinessButton>{quickAction==='estimate'&&<div className="space-y-2 border-b border-slate-200 px-2 pb-3"><EstimatedTimeInput value={quickEstimate} onChange={setQuickEstimate} label={`Quick estimated time ${task.id}`} showPresets /><div className="flex gap-2"><BusinessButton type="button" onClick={()=>setQuickEstimate(null)} className="h-10 rounded border border-slate-300 px-3 text-xs">Clear</BusinessButton><BusinessButton type="button" disabled={quickSaving} onClick={()=>void applyQuickTaskUpdate(task,{estimatedMinutes:quickEstimate})} className="tenops-selected-surface h-10 rounded border px-3 text-xs">Apply</BusinessButton></div></div>}
        <label className="flex min-h-11 cursor-pointer items-center rounded px-3 text-sm font-medium hover:bg-slate-100">Add attachment<AttachmentFileInput disabled={quickSaving} onFiles={(files)=>void addQuickAttachments(task,files)} onError={setError} onPreparing={(preparing)=>setAttachmentActivity(preparing?'Preparing preview…':'')} /></label>
        {task.contextType==='job'&&<button type="button" onClick={()=>{setQuickTaskId("");openProductionJob(task.contextId);}} className="min-h-11 rounded px-3 text-left text-sm font-medium hover:bg-slate-100">Open Job</button>}
        <button type="button" onClick={()=>{setQuickTaskId("");void toggle(task);}} className="min-h-11 rounded px-3 text-left text-sm font-medium hover:bg-slate-100">{task.completedAt?'Mark open':'Mark complete'}</button></div>
      </div>}</div>
    </article></div></div>;
  }

  return <main data-my-work className="flex w-full items-start">
    <div className="mx-auto min-w-0 w-full max-w-[1120px] flex-1 px-3 py-5 sm:px-6 sm:py-7">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-[.15em] text-slate-500">Personal workspace</div><h1 ref={detailFallbackRef} tabIndex={-1} className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">My Work</h1><p className="mt-0.5 text-sm text-slate-600">Your tasks, all in one place.</p></div><div className="flex flex-wrap items-center justify-end gap-2"><BusinessButton type="button" onClick={()=>setGroupsOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800"><Folder className="h-4 w-4"/>Task Groups</BusinessButton><ToolboxLauncher /></div></header>

    <div className="mt-2 flex max-w-full flex-nowrap overflow-x-auto border-b border-slate-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="My Work views">{([['today','Today'],['all','All Tasks'],['private','My Tasks'],['shared','Shared Tasks']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={view === value} onClick={(event) => {setView(value);event.currentTarget.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});}} className={`flex h-11 shrink-0 items-center justify-center gap-2 border-b-2 px-3 text-sm font-medium sm:px-4 ${view === value ? "border-blue-800 text-blue-900" : "border-transparent text-slate-500 hover:text-slate-900"}`}>{value === "today"&&<CalendarCheck className="h-4 w-4" />}{value === "private" && <PrivateTaskIcon className="h-4 w-4" />}{value === "shared" && <Handshake className="h-[18px] w-[18px]" />}{label}</button>)}</div>
    <div className="mt-2 min-h-5 text-xs text-slate-500">{view === "today"?"Open tasks due now or within the next 7 days.":view === "private" ? <span className="inline-flex items-center gap-1.5"><PrivateTaskIcon className="h-3.5 w-3.5" />Private to you</span> : view === "shared" ? <span className="inline-flex items-center gap-1.5"><Handshake className="h-[17px] w-[17px]" />Tasks exchanged with another TenOps user</span> : "Your private tasks and participant-visible Shared Tasks together."}</div>

    {filterJobId && <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900"><span className="truncate">Showing tasks for {selectedJob ? jobLabel(selectedJob) : "this Job"}</span><button type="button" onClick={() => { setFilterJobId(""); window.history.replaceState({}, "", window.location.pathname); }} className="flex h-10 w-10 shrink-0 items-center justify-center" aria-label="Clear Job filter"><X className="h-4 w-4" /></button></div>}

    <section className="mt-4 rounded-lg border border-slate-300 bg-white p-2 sm:p-3" onFocus={() => setComposerOpen(true)}>
      <div className="flex items-center gap-2"><Plus className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" /><BusinessInput ref={titleInputRef} value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void add(); } }} placeholder="What needs to get done?" aria-label="Task title" className="h-11 min-w-0 flex-1 border-0 bg-transparent px-1 text-base font-normal text-slate-950 outline-none" /><BusinessButton type="button" onClick={() => void add()} disabled={!title.trim() || saving} className="tenops-selected-surface hidden h-10 shrink-0 rounded-md border px-4 text-sm font-medium disabled:opacity-40 sm:block">{saving ? attachmentActivity||"Adding…" : "Add task"}</BusinessButton></div>
      {optionsVisible && optionsLoading && <p role="status" className="text-xs text-slate-500">Loading task options…</p>}
      {composerOpen && <div className="mt-2 space-y-2 border-t border-slate-200 pt-2">
        <label className="block text-xs text-slate-600"><span className="mb-1 flex items-center gap-1"><NotebookPen className="h-3.5 w-3.5" />Notes</span><BusinessTextarea value={notes} onChange={(event)=>setNotes(event.target.value)} rows={2} className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[160px_238px_minmax(0,1fr)_220px]">
          <label className="text-xs text-slate-600"><span className="mb-1 flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />Due</span><BusinessInput type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="h-11 w-full rounded-md border border-slate-300 bg-white px-2 text-sm" /></label>
          <label className="text-xs text-slate-600"><span className="mb-1 flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />Estimated time</span><EstimatedTimeInput value={estimatedMinutes} onChange={setEstimatedMinutes} label="Composer estimated time" /></label>
          <label className="text-xs text-slate-600"><span className="mb-1 flex items-center gap-1"><BriefcaseBusiness className="h-3.5 w-3.5" />Job</span><JobCombobox loading={optionsLoading} jobs={jobs} value={jobId} onChange={setJobId} label="Composer Job" /></label>
          <label className="text-xs text-slate-600"><span className="mb-1 flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />Share</span><BusinessSelect disabled={optionsLoading} value={assignee} onChange={(event) => setAssignee(event.target.value)} className="h-11 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"><option value="">Keep private</option>{collaborators.map((user) => <option key={user.userId} value={user.userId}>{user.displayName}</option>)}</BusinessSelect></label>
        </div>
        <div><div className="mb-2 text-xs text-slate-600">Task color</div><ColorPicker value={color} onChange={setColor} /></div>
        <StagedAttachments files={stagedFiles} onAdd={(files)=>setStagedFiles((current)=>[...current,...files])} onRemove={(index)=>setStagedFiles((current)=>current.filter((_,candidate)=>candidate!==index))} onError={setError} onPreparing={(preparing)=>setAttachmentActivity(preparing?"Preparing preview…":"")} disabled={saving} />
        {attachmentActivity&&!saving?<p role="status" className="text-xs font-medium text-blue-800">{attachmentActivity}</p>:null}
        <BusinessButton type="button" onClick={() => void add()} disabled={!title.trim() || saving} className="tenops-selected-surface h-11 w-full rounded-md border px-4 text-sm font-medium disabled:opacity-40 sm:hidden">{saving ? attachmentActivity||"Adding…" : "Add task"}</BusinessButton>
      </div>}
    </section>

    {error && <div role="alert" className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{error}</div>}
    {loading ? <div className="mt-6 text-sm text-slate-500">Loading My Work…</div> : <>
      <section data-workload-summary className="mt-2 rounded-md border border-slate-200 bg-white"><button type="button" onClick={()=>setWorkloadOpen((current)=>!current)} aria-expanded={workloadOpen} className="flex min-h-11 w-full min-w-0 items-center justify-between gap-3 px-3 text-left text-xs text-slate-600"><span className="min-w-0 truncate"><strong className="font-semibold text-slate-800">Workload</strong> · {view==='shared'?`Assigned to me: ${workload.open} open · Assigned by me: ${workload.delegatedOpen} open`:`${workload.open} open · ${workload.estimatedRemaining>0?`~${formatEstimatedMinutes(workload.estimatedRemaining)} estimated`:workload.estimatedTotal===0?'No estimates yet':'No estimated effort remaining'}`}</span>{workloadOpen?<ChevronDown className="h-4 w-4 shrink-0"/>:<ChevronRight className="h-4 w-4 shrink-0"/>}</button>{workloadOpen&&<div className="space-y-3 border-t border-slate-200 px-3 py-3 text-xs text-slate-600"><div><strong className="font-semibold text-slate-700">Assigned to me</strong> · {workload.completed} of {workload.total} tasks complete</div>{workload.estimatedTotal>0&&<><div className="h-1.5 overflow-hidden rounded-full bg-slate-200" aria-label="Estimated effort completion for tasks assigned to me"><div className="h-full bg-blue-700" style={{width:`${Math.min(100,(workload.estimatedCompleted/workload.estimatedTotal)*100)}%`}} /></div><div>{workload.estimatedCompleted>0?`${formatEstimatedMinutes(workload.estimatedCompleted)} of ${formatEstimatedMinutes(workload.estimatedTotal)} estimated effort complete`:`No estimated effort complete of ${formatEstimatedMinutes(workload.estimatedTotal)}`}</div><div>{workload.estimatedRemaining>0?`~${formatEstimatedMinutes(workload.estimatedRemaining)} estimated effort remaining`:'No estimated effort remaining'}</div></>}{workload.estimatedTotal===0&&<div>No estimates yet for tasks assigned to me</div>}{workload.unestimated>0&&<div>{workload.unestimated} {workload.unestimated===1?'task':'tasks'} assigned to me without estimates</div>}{workload.delegated>0&&<div className="border-t border-slate-200 pt-3"><strong className="font-semibold text-slate-700">Assigned by me</strong> · {workload.delegatedOpen} open{workload.delegatedEstimatedRemaining>0?` · ~${formatEstimatedMinutes(workload.delegatedEstimatedRemaining)} delegated`:''}</div>}</div>}</section>
      <div className="mt-5 flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2"><span className="text-sm font-medium text-slate-700">{view==='today'?todaySections.reduce((count,section)=>count+section.tasks.length,0):open.length} open</span><div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{view!=='today'&&<label className="flex items-center gap-1 text-xs text-slate-500"><span>Group</span><select value={groupMode} onChange={(event)=>setGroupMode(event.target.value as GroupMode)} className="h-10 max-w-full rounded-md border border-slate-300 bg-white px-2 text-sm font-medium text-slate-700"><option value="none">None</option><option value="due">Due Date</option><option value="job">Job</option><option value="effort">Effort</option></select></label>}<label className="flex min-w-0 flex-1 items-center gap-1 text-xs text-slate-500 sm:flex-none"><ArrowUpDown className="h-4 w-4 shrink-0" /><span className="sr-only">Sort tasks</span><select value={sortMode} onChange={(event) => changeSort(event.target.value as SortMode)} className="h-10 min-w-0 max-w-full rounded-md border border-slate-300 bg-white px-2 text-sm font-medium text-slate-700">{SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div></div>
      {view==='today'?<section className="mt-3 space-y-5" aria-label="Today tasks">{todaySections.length?todaySections.map((section)=><div key={section.key}><div className="mb-2 flex items-center gap-2"><h2 className={`shrink-0 text-[11px] font-semibold uppercase tracking-[.12em] ${section.key==='overdue'?'text-red-700':section.key==='today'?'text-amber-700':'text-slate-500'}`}>{section.label}</h2><span className="h-px flex-1 bg-slate-200" /></div><div className="space-y-2">{section.tasks.map((task)=>taskCard(task,{hideDue:section.key!=='upcoming'}))}</div></div>):<p className="py-8 text-center text-sm text-slate-500">Nothing needs attention today.</p>}</section>:groupMode==='none'?<section className="mt-2 space-y-2" aria-label="Open tasks">{open.length ? open.map((task)=>taskCard(task)) : <div className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-10 text-center"><div className="text-sm font-medium text-slate-700">Nothing open</div><div className="mt-1 text-xs text-slate-500">Add a task when something comes up.</div></div>}</section>:<section className="mt-3 space-y-5" aria-label="Grouped open tasks">{groupedOpen.map((section)=><div key={section.key}><div className="mb-2 flex items-center gap-2"><h2 className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[.12em] text-slate-500">{section.label}</h2><span className="h-px min-w-6 flex-1 bg-slate-200" /></div><div className="space-y-2">{section.tasks.map((task)=>taskCard(task,{hideJob:groupMode==='job'&&section.key!=='no-job',hideDue:groupMode==='due'&&(section.key==='overdue'||section.key==='today')}))}</div></div>)}</section>}
      {view!=='today'&&completed.length > 0 && <section className="mt-8 border-t-2 border-slate-400 pt-2"><BusinessButton type="button" onClick={() => setCompletedOpen((value) => !value)} aria-expanded={completedOpen} className="flex h-11 w-full items-center justify-between border-b border-slate-200 px-2 text-sm font-medium text-slate-500"><span>Completed ({completed.length})</span>{completedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</BusinessButton>{completedOpen && <div className="mt-3 space-y-2">{completed.map((task)=>taskCard(task))}</div>}</section>}
    </>}

    {groupsOpen&&<div data-shell-below-header className="fixed inset-0 z-[85] flex justify-end bg-slate-950/35" role="dialog" aria-modal="true" aria-labelledby="task-groups-title" onMouseDown={(event)=>{if(event.target===event.currentTarget)setGroupsOpen(false);}}><div className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div><div className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Personal organization</div><h2 id="task-groups-title" className="mt-1 text-xl font-semibold">Task Groups</h2></div><button type="button" onClick={()=>setGroupsOpen(false)} aria-label="Close Task Groups" className="flex h-11 w-11 items-center justify-center rounded-md border border-slate-300"><X className="h-5 w-5"/></button></header><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"><section className="rounded-md border border-slate-300 p-3"><label className="text-xs font-medium text-slate-600">New Group name<BusinessInput value={groupName} maxLength={100} onChange={(event)=>setGroupName(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-base"/></label><div className="mt-3 text-xs font-medium text-slate-600">Group color</div><div className="mt-2"><ColorPicker value={groupColor} onChange={setGroupColor}/></div><BusinessButton type="button" disabled={!groupName.trim()||groupSaving} onClick={()=>void addGroup()} className="tenops-selected-surface mt-3 h-11 w-full rounded-md border px-4 text-sm font-medium disabled:opacity-40">Create Group</BusinessButton></section><div className="mt-4 space-y-3">{taskGroups.map(group=><article key={group.id} className="rounded-md border border-slate-200 p-3"><div className="flex items-start gap-2"><label className="min-w-0 flex-1 text-xs font-medium text-slate-600">Group name<BusinessInput defaultValue={group.name} maxLength={100} onBlur={(event)=>{const name=event.target.value.trim();if(name&&name!==group.name)void editGroup(group,{name});}} className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-base"/></label><BusinessButton type="button" disabled={groupSaving} onClick={()=>void removeGroup(group)} aria-label={`Delete ${group.name}`} className="mt-5 flex h-11 w-11 items-center justify-center rounded-md border border-red-300 text-red-700"><Trash2 className="h-4 w-4"/></BusinessButton></div><div className="mt-3 text-xs font-medium text-slate-600">Group color</div><div className="mt-2 flex flex-wrap gap-2">{COLORS.map(color=><BusinessButton key={color.key} type="button" aria-label={`${group.name}: ${color.label}`} aria-pressed={group.color===color.key} disabled={groupSaving} onClick={()=>void editGroup(group,{color:color.key})} className={`flex h-10 w-10 items-center justify-center rounded-full border ${group.color===color.key?'border-slate-900 ring-2 ring-blue-200':'border-slate-300'}`}><span className={`h-5 w-5 rounded-full ${color.swatch}`}/></BusinessButton>)}</div><p className="mt-2 text-xs text-slate-500">{tasks.filter(task=>task.groupId===group.id).length} tasks in your view</p></article>)}{!taskGroups.length&&<p className="py-8 text-center text-sm text-slate-500">No Task Groups yet.</p>}</div></div></div></div>}
    {selectedTask && <MyWorkTaskInspector key={`${auth.profile?.userId}:${selectedTask.id}`} task={selectedTask} groups={taskGroups} onDismiss={closeDetails} onChanged={load} returnFocusRef={detailOpenerRef} fallbackFocusRef={detailFallbackRef} />}

    </div>
  </main>;
}
