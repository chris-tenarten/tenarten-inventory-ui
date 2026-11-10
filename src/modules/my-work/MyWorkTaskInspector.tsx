'use client';

import {useEffect,useRef,useState,type RefObject} from 'react';
import {BriefcaseBusiness,Info,X} from 'lucide-react';
import {BusinessInput,BusinessSelect,BusinessTextarea,BusinessButton} from '@/components/BusinessWriteControls';
import {useAuth} from '@/lib/auth';
import {openProductionJob} from '@/modules/production/job-options';
import ProductionDialog from '@/modules/production/contacts/ProductionDialog';
import {ColorPicker,EstimatedTimeInput,JobCombobox,AttachmentList,StagedAttachments} from './task-controls';
import {loadWorkCollaborators,loadWorkJobs,loadWorkTaskAttachments,updateWorkTask,setWorkTaskGroup,uploadWorkTaskAttachments,finalizeWorkTaskCreation,permanentlyDeleteWorkTask,setWorkTaskCompleted} from './queries';
import type {WorkTask,WorkTaskGroup,WorkTaskAttachment,WorkCollaborator,WorkJob} from './types';
import './task-inspector.css';

/** One detail form/controller, shared by My Work and the Dashboard; no task-list copy. */
export default function MyWorkTaskInspector({task:selectedTask,groups:taskGroups,onDismiss,onChanged,returnFocusRef,fallbackFocusRef}:{
  task:WorkTask;groups:WorkTaskGroup[];onDismiss:()=>void;onChanged?:()=>Promise<void>;
  returnFocusRef?:RefObject<HTMLElement|null>;fallbackFocusRef?:RefObject<HTMLElement|null>;
}){
  const auth=useAuth(),initialSession=useRef(auth.actionSessionSnapshot()),authRef=useRef(auth);
  authRef.current=auth;
  const live=useRef(true),operation=useRef(false);
  const currentSession=auth.actionSessionSnapshot();
  const authorized=Boolean(initialSession.current&&currentSession&&initialSession.current.ownerId===currentSession.ownerId&&initialSession.current.contextKey===currentSession.contextKey&&(selectedTask.assigneeUserId===currentSession.ownerId||(selectedTask.visibility==='shared'&&selectedTask.creatorUserId===currentSession.ownerId)));
  const [detail,setDetail]=useState(()=>({title:selectedTask.title,notes:selectedTask.notes,assigneeUserId:selectedTask.assigneeUserId,dueDate:selectedTask.dueDate,estimatedMinutes:selectedTask.estimatedMinutes,jobId:selectedTask.contextType==='job'?selectedTask.contextId:'',color:selectedTask.color,groupId:selectedTask.groupId}));
  const [detailSaving,setDetailSaving]=useState(false),[taskDeleting,setTaskDeleting]=useState(false);
  const [detailAttachments,setDetailAttachments]=useState<WorkTaskAttachment[]>([]),[detailFiles,setDetailFiles]=useState<File[]>([]);
  const completionBlocked=detailFiles.length>0||detail.title!==selectedTask.title||detail.notes!==selectedTask.notes||detail.assigneeUserId!==selectedTask.assigneeUserId||detail.dueDate!==selectedTask.dueDate||detail.estimatedMinutes!==selectedTask.estimatedMinutes||detail.jobId!==(selectedTask.contextType==='job'?selectedTask.contextId:'')||detail.color!==selectedTask.color||detail.groupId!==selectedTask.groupId;
  const [collaborators,setCollaborators]=useState<WorkCollaborator[]>([]),[jobs,setJobs]=useState<WorkJob[]>([]);
  const [optionsLoading,setOptionsLoading]=useState(true),[attachmentsLoading,setAttachmentsLoading]=useState(true);
  const [attachmentActivity,setAttachmentActivity]=useState(''),[error,setError]=useState('');
  useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  useEffect(()=>{if(!authorized)onDismiss();},[authorized,onDismiss]);
  useEffect(()=>{
    if(!authorized)return;let active=true;
    void Promise.all([loadWorkCollaborators(),loadWorkJobs()]).then(([users,jobRows])=>{if(active){setCollaborators(users.filter(user=>user.userId!==initialSession.current?.ownerId));setJobs(jobRows);}}).catch(caught=>{if(active)setError(caught instanceof Error?caught.message:'Some My Work options could not be loaded.');}).finally(()=>{if(active)setOptionsLoading(false);});
    void loadWorkTaskAttachments(selectedTask.id).then(rows=>{if(active)setDetailAttachments(rows);}).catch(caught=>{if(active)setError(caught instanceof Error?caught.message:'Unable to load attachments.');}).finally(()=>{if(active)setAttachmentsLoading(false);});
    return()=>{active=false;};
  },[authorized,selectedTask.id]);
  function guard(){const current=authRef.current.actionSessionSnapshot();if(!live.current||!current||!initialSession.current||current.ownerId!==initialSession.current.ownerId||current.contextKey!==initialSession.current.contextKey||!authRef.current.can('writeBusinessData'))throw Error('Your access changed. Close task details and reopen the task.');}
  function closeDetails(){if(!operation.current)onDismiss();}
  async function changed(){window.dispatchEvent(new Event('tenops:notifications-changed'));if(onChanged)await onChanged();if(live.current)onDismiss();}
  async function saveDetails(){
    if(operation.current||!detail.title.trim()||optionsLoading||attachmentsLoading)return;
    operation.current=true;setDetailSaving(true);setError('');
    try{
      guard();await updateWorkTask({id:selectedTask.id,title:detail.title.trim(),notes:detail.notes,assigneeUserId:detail.assigneeUserId,dueDate:detail.dueDate,estimatedMinutes:detail.estimatedMinutes,jobId:detail.jobId,color:detail.color});
      guard();if(detail.groupId!==selectedTask.groupId)await setWorkTaskGroup(selectedTask.id,detail.groupId);
      guard();if(detailFiles.length)await uploadWorkTaskAttachments(selectedTask.id,detailFiles,stage=>{if(live.current)setAttachmentActivity(stage==='uploading'?'Uploading attachments…':'Associating attachments…');});
      guard();const nextAttachments=await loadWorkTaskAttachments(selectedTask.id);
      guard();if(selectedTask.creatorUserId===initialSession.current?.ownerId)await finalizeWorkTaskCreation(selectedTask.id,nextAttachments.length);
      guard();await changed();
    }catch(caught){if(live.current)setError(caught instanceof Error?caught.message:'Unable to save task.');}
    finally{operation.current=false;if(live.current){setDetailSaving(false);setAttachmentActivity('');}}
  }
  async function completeTask(){if(operation.current||completionBlocked)return;operation.current=true;setDetailSaving(true);setError('');try{guard();await setWorkTaskCompleted(selectedTask.id,!selectedTask.completedAt);guard();await changed();}catch(caught){if(live.current)setError(caught instanceof Error?caught.message:'Unable to update task.');}finally{operation.current=false;if(live.current)setDetailSaving(false);}}
  async function deleteSelectedTask(){if(operation.current||!window.confirm('Permanently delete this task? This removes the task, its attachments, and task-owned metadata for all participants. This cannot be undone.'))return;operation.current=true;setTaskDeleting(true);setError('');try{guard();await permanentlyDeleteWorkTask(selectedTask.id);guard();await changed();}catch(caught){if(live.current)setError(caught instanceof Error?caught.message:'Unable to permanently delete task.');}finally{operation.current=false;if(live.current)setTaskDeleting(false);}}
  if(!authorized)return null;
  return <ProductionDialog label="Edit task" onDismiss={closeDetails} returnFocusRef={returnFocusRef} fallbackFocusRef={fallbackFocusRef} preventFocusScroll className="my-work-task-inspector"><div data-my-work data-my-work-task-inspector className="flex h-full min-h-0 flex-col">
    {error&&<p role="alert" className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6"><div><div className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Task details</div><h2 id="my-work-detail-title" className="mt-1 text-xl font-semibold text-slate-950">Edit task</h2></div><button type="button" onClick={closeDetails} aria-label="Close task details" className="flex h-11 w-11 items-center justify-center rounded-md border border-slate-300"><X className="h-5 w-5" /></button></header>
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
        <label className="block text-sm font-medium text-slate-700">Title<BusinessInput value={detail.title} onChange={(event) => setDetail({ ...detail, title: event.target.value })} className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base font-normal" /></label>
        <label className="block text-sm font-medium text-slate-700">Notes<BusinessTextarea value={detail.notes} onChange={(event) => setDetail({ ...detail, notes: event.target.value })} rows={6} placeholder="What do you need to remember?" className="mt-1 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal" /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Due date<BusinessInput type="date" value={detail.dueDate} onChange={(event) => setDetail({ ...detail, dueDate: event.target.value })} className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" /></label><label className="text-sm font-medium text-slate-700">Estimated time<span className="mt-1 block"><EstimatedTimeInput value={detail.estimatedMinutes} onChange={(next)=>setDetail({...detail,estimatedMinutes:next})} label="Task estimated time" /></span></label><label className="text-sm font-medium text-slate-700">Share with<BusinessSelect aria-label="Share with" value={detail.assigneeUserId} disabled={optionsLoading || selectedTask.creatorUserId !== auth.profile?.userId} onChange={(event) => setDetail({ ...detail, assigneeUserId: event.target.value })} className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 font-normal disabled:opacity-60"><option value={selectedTask.creatorUserId}>Keep private</option>{collaborators.map((user) => <option key={user.userId} value={user.userId}>{user.displayName}</option>)}</BusinessSelect></label></div>
        <label className="block text-sm font-medium text-slate-700">Job<span className="mt-1 block"><JobCombobox loading={optionsLoading} jobs={jobs} value={detail.jobId} onChange={(nextJobId) => setDetail({ ...detail, jobId: nextJobId })} label="Task detail Job" /></span></label>
        {detail.jobId && <button type="button" onClick={() => openProductionJob(detail.jobId)} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium text-blue-800"><BriefcaseBusiness className="h-4 w-4" />Open linked Job</button>}
        <label className="block text-sm font-medium text-slate-700">Task Group<BusinessSelect aria-label="Task Group" value={detail.groupId} onChange={(event)=>setDetail({...detail,groupId:event.target.value})} className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 font-normal"><option value="">Ungrouped</option>{taskGroups.map(group=><option key={group.id} value={group.id}>{group.name}</option>)}</BusinessSelect></label>
        <div><div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-700">Task color<span title={detail.groupId?"This stored Task color returns when the task is removed from its Group. Group color is currently displayed.":"Task color is personal to your workspace and does not change another participant’s view."} aria-label="About task color" tabIndex={0} className="inline-flex text-slate-400"><Info className="h-3.5 w-3.5" /></span></div>{detail.groupId&&<p className="mb-2 text-xs text-slate-500">Group color is currently displayed.</p>}<ColorPicker value={detail.color} onChange={(color) => setDetail({ ...detail, color })} /></div>
        <div className="space-y-2"><div className="text-sm font-medium text-slate-700">Attachments</div><AttachmentList attachments={detailAttachments} currentUserId={auth.profile?.userId??""} creatorUserId={selectedTask.creatorUserId} setError={setError} onChanged={async()=>setDetailAttachments(await loadWorkTaskAttachments(selectedTask.id))} /><StagedAttachments files={detailFiles} onAdd={(files)=>setDetailFiles((current)=>[...current,...files])} onRemove={(index)=>setDetailFiles((current)=>current.filter((_,candidate)=>candidate!==index))} onError={setError} onPreparing={(preparing)=>setAttachmentActivity(preparing?"Preparing preview…":"")} disabled={detailSaving||taskDeleting} />{attachmentActivity?<p role="status" className="text-xs font-medium text-blue-800">{attachmentActivity}</p>:null}<p className="text-[11px] text-slate-400">Photos, PDFs, and Office files · 25 MB max</p></div>
        {auth.profile?.role==="admin"?<section className="rounded-md border border-red-200 bg-red-50/60 p-3"><h3 className="text-sm font-semibold text-red-900">Admin cleanup</h3><p className="mt-1 text-xs text-red-800">Permanently removes this task and its task-owned attachments and metadata. This cannot be undone.</p><BusinessButton type="button" onClick={()=>void deleteSelectedTask()} disabled={taskDeleting||detailSaving} className="mt-3 min-h-11 w-full rounded-md border border-red-500 bg-white px-3 text-sm font-semibold text-red-700 disabled:opacity-50 sm:w-auto">{taskDeleting?"Permanently deleting…":"Permanently delete task"}</BusinessButton></section>:null}
      </div>
      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 sm:px-6"><BusinessButton type="button" onClick={()=>void completeTask()} title={completionBlocked?"Save task changes before changing completion.":undefined} disabled={detailSaving||taskDeleting||attachmentsLoading||completionBlocked} className="mr-auto h-10 rounded-md border border-slate-300 px-3 text-sm font-medium">{selectedTask.completedAt?"Reopen task":"Mark complete"}</BusinessButton><button type="button" onClick={closeDetails} disabled={taskDeleting||detailSaving} className="h-10 rounded-md border border-slate-300 px-4 text-sm font-medium disabled:opacity-50">Cancel</button><BusinessButton type="button" onClick={() => void saveDetails()} disabled={!detail.title.trim() || detailSaving || taskDeleting || optionsLoading || attachmentsLoading} className="tenops-selected-surface h-10 rounded-md border px-4 text-sm font-medium disabled:opacity-40">{detailSaving ? attachmentActivity||"Saving…" : "Save task"}</BusinessButton></footer>
  </div></ProductionDialog>;
}
