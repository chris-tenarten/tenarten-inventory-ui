"use client";
import {useMemo,useState} from 'react';
import {Paperclip,Upload,X,Trash2,Search} from 'lucide-react';
import {BusinessInput,BusinessSelect,BusinessButton} from '@/components/BusinessWriteControls';
import AttachmentFileInput,{StagedImagePreview} from './AttachmentFileInput';
import {openWorkTaskAttachment,removeWorkTaskAttachment} from './queries';
import {estimateInputToMinutes,estimatedMinutesToInput,normalizeEstimatedMinutes,type EstimateUnit} from './estimated-time';
import type {WorkTaskColor,WorkTaskAttachment,WorkJob} from './types';
export const jobLabel=(job:WorkJob)=>[job.jobNumber,job.name,job.customer].filter(Boolean).join(' · ');
export const COLORS: Array<{ key: WorkTaskColor; label: string; swatch: string; edge: string }> = [
  { key: "neutral", label: "Default", swatch: "bg-slate-300", edge: "border-l-slate-300" },
  { key: "blue", label: "Blue", swatch: "bg-blue-500", edge: "border-l-blue-500" },
  { key: "teal", label: "Teal", swatch: "bg-cyan-500", edge: "border-l-cyan-500" },
  { key: "green", label: "Green", swatch: "bg-emerald-600", edge: "border-l-emerald-600" },
  { key: "yellow", label: "Yellow", swatch: "bg-amber-400", edge: "border-l-amber-400" },
  { key: "orange", label: "Orange", swatch: "bg-orange-500", edge: "border-l-orange-500" },
  { key: "rose", label: "Rose", swatch: "bg-rose-500", edge: "border-l-rose-500" },
  { key: "violet", label: "Violet", swatch: "bg-violet-500", edge: "border-l-violet-500" },
];
export function ColorPicker({ value, onChange }: { value: WorkTaskColor; onChange: (value: WorkTaskColor) => void }) {
  return <div className="flex flex-wrap gap-2" aria-label="Task color">{COLORS.map((color) => <BusinessButton key={color.key} type="button" onClick={() => onChange(color.key)} aria-label={color.label} aria-pressed={value === color.key} className={`flex h-10 w-10 items-center justify-center rounded-full border ${value === color.key ? "border-slate-900 ring-2 ring-blue-200" : "border-slate-300"}`}><span className={`h-5 w-5 rounded-full ${color.swatch}`} /></BusinessButton>)}</div>;
}

export function EstimatedTimeInput({value,onChange,label="Estimated time",showPresets=false}:{value:number|null;onChange:(value:number|null)=>void;label?:string;showPresets?:boolean}){
  const[unit,setUnit]=useState<EstimateUnit>('minutes');
  const[draft,setDraft]=useState(()=>String(estimatedMinutesToInput(value,'minutes')??''));
  const[syncedValue,setSyncedValue]=useState(value);
  const presets:Record<EstimateUnit,number[]>={minutes:[15,30,45],hours:[1,1.5,2,4],days:[0.5,1,2,3]};
  if(value!==syncedValue){const canonical=normalizeEstimatedMinutes(value);setSyncedValue(value);if(estimateInputToMinutes(draft,unit)!==canonical)setDraft(String(estimatedMinutesToInput(canonical,unit)??''));}
  const changeUnit=(next:EstimateUnit)=>{setUnit(next);setDraft(String(estimatedMinutesToInput(value,next)??''));};
  const changeDraft=(next:string)=>{setDraft(next);onChange(estimateInputToMinutes(next,unit));};
  return <div className="max-w-full space-y-1"><div className="grid w-full min-w-0 grid-cols-[minmax(0,110px)_minmax(110px,130px)] gap-2 sm:w-fit sm:grid-cols-[110px_120px]"><BusinessInput type="number" inputMode="decimal" min={unit==='minutes'?1:0} step={unit==='minutes'?1:'any'} value={draft} onChange={(event)=>changeDraft(event.target.value)} placeholder="Value" aria-label={`${label} value`} className="h-11 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" /><BusinessSelect value={unit} onChange={(event)=>changeUnit(event.target.value as EstimateUnit)} aria-label={`${label} unit`} className="h-11 min-w-0 rounded-md border border-slate-300 bg-white px-2 text-sm"><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option></BusinessSelect></div>{unit==='days'&&<p className="text-[10px] text-slate-400">1 day = 8 hours</p>}{showPresets&&<div className="flex flex-wrap gap-1" aria-label={`${label} presets`}>{presets[unit].map((preset)=><BusinessButton key={preset} type="button" onClick={()=>changeDraft(String(preset))} className="h-9 min-w-9 rounded border border-slate-300 px-2 text-xs">{preset}</BusinessButton>)}</div>}</div>;
}

const attachmentSize=(bytes:number)=>bytes<1024?`${bytes} B`:bytes<1048576?`${Math.ceil(bytes/1024)} KB`:`${(bytes/1048576).toFixed(1)} MB`;
export function StagedAttachments({files,onAdd,onRemove,onError,onPreparing,disabled=false}:{files:File[];onAdd:(files:File[])=>void;onRemove:(index:number)=>void;onError:(message:string)=>void;onPreparing?:(preparing:boolean)=>void;disabled?:boolean}){
  return <div><label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700"><Upload className="h-4 w-4" />Add attachments<AttachmentFileInput disabled={disabled} onFiles={onAdd} onError={onError} onPreparing={onPreparing} /></label>{files.length>0&&<div className="mt-2 space-y-1">{files.map((file,index)=><div key={`${file.name}-${file.size}-${index}`} className="flex min-w-0 items-center gap-2 rounded border border-slate-200 px-2 py-1.5 text-xs"><StagedImagePreview file={file} /><Paperclip className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0 flex-1 truncate">{file.name}</span><span className="shrink-0 text-slate-400">{attachmentSize(file.size)}</span><BusinessButton type="button" onClick={()=>onRemove(index)} aria-label={`Remove ${file.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center text-red-700"><X className="h-4 w-4" /></BusinessButton></div>)}</div>}</div>;
}

export function AttachmentList({attachments,currentUserId,creatorUserId,onChanged,setError}:{attachments:WorkTaskAttachment[];currentUserId:string;creatorUserId:string;onChanged:()=>Promise<void>;setError:(value:string)=>void}){
  const[busyId,setBusyId]=useState("");
  return attachments.length?<div className="space-y-1">{attachments.map(attachment=><div key={attachment.id} className="flex min-w-0 items-center gap-2 rounded border border-slate-200 px-2 py-1.5 text-sm"><Paperclip className="h-4 w-4 shrink-0 text-slate-500" /><button type="button" onClick={()=>void openWorkTaskAttachment(attachment).catch((caught)=>setError(caught instanceof Error?caught.message:"Unable to open attachment."))} className="min-w-0 flex-1 truncate text-left font-medium text-blue-800 hover:underline">{attachment.originalFilename}</button><span className="shrink-0 text-xs text-slate-400">{attachmentSize(attachment.byteSize)}</span>{(attachment.uploaderUserId===currentUserId||creatorUserId===currentUserId)&&<BusinessButton type="button" disabled={busyId===attachment.id} onClick={()=>void(async()=>{setBusyId(attachment.id);try{await removeWorkTaskAttachment(attachment);await onChanged();}catch(caught){setError(caught instanceof Error?caught.message:"Unable to remove attachment.");}finally{setBusyId("");}})()} aria-label={`Delete ${attachment.originalFilename}`} className="flex h-10 w-10 shrink-0 items-center justify-center text-red-700 disabled:opacity-50"><Trash2 className="h-4 w-4" /></BusinessButton>}</div>)}</div>:null;
}

export function JobCombobox({ jobs, value, onChange, label, loading = false }: { jobs: WorkJob[]; value: string; onChange: (value: string) => void; label: string; loading?: boolean }) {
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
      <input disabled={loading} role="combobox" aria-label={label} aria-expanded={open} aria-controls={`${label.replaceAll(" ", "-").toLowerCase()}-results`} aria-autocomplete="list" value={open ? query : selected ? jobLabel(selected) : ""} placeholder={loading ? "Loading Jobs…" : "Search number, project, or customer"} onFocus={() => { setOpen(true); setQuery(""); setActiveIndex(0); }} onClick={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); setActiveIndex(0); }} onKeyDown={(event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((current) => Math.min(current + 1, Math.max(0, matches.length - 1))); }
        else if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((current) => Math.max(0, current - 1)); }
        else if (event.key === "Enter" && open && matches[activeIndex]) { event.preventDefault(); select(matches[activeIndex]); }
        else if (event.key === "Escape") { event.preventDefault(); setOpen(false); setQuery(""); }
      }} className="h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white pl-9 pr-10 text-sm" />
      {value && <BusinessButton type="button" onClick={() => { onChange(""); setQuery(""); }} aria-label="Clear Job" className="absolute right-0 flex h-11 w-10 items-center justify-center text-slate-500"><X className="h-4 w-4" /></BusinessButton>}
    </div>
    {open && <div id={`${label.replaceAll(" ", "-").toLowerCase()}-results`} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-300 bg-white py-1 shadow-lg">{matches.length ? matches.map((job, index) => <BusinessButton key={job.id} type="button" role="option" aria-selected={job.id === value} onMouseDown={(event) => event.preventDefault()} onClick={() => select(job)} className={`block min-h-11 w-full px-3 py-2 text-left text-sm ${index === activeIndex ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-50"}`}><span className="block truncate font-medium">{job.jobNumber ? `${job.jobNumber} · ` : ""}{job.name}</span>{job.customer && <span className="block truncate text-xs text-slate-500">{job.customer}</span>}</BusinessButton>) : <div className="px-3 py-3 text-sm text-slate-500">No matching Jobs</div>}</div>}
  </div>;
}
