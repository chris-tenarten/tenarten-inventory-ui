"use client";
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { createInboxAttachmentUrl, type InboxAttachment } from '../inbox';

/** Navigate only the previewable attachments belonging to one message. */
export default function AttachmentImageViewer({attachments,initialIndex,onClose}:{attachments:InboxAttachment[];initialIndex:number;onClose:()=>void}) {
  const [index,setIndex]=useState(initialIndex),[resource,setResource]=useState({id:'',url:'',error:''});
  const close=useRef<HTMLButtonElement>(null);
  const attachment=attachments[index];
  const url=resource.id===attachment.id?resource.url:'',error=resource.id===attachment.id?resource.error:'';
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;close.current?.focus();return()=>previous?.focus();},[]);
  useEffect(()=>{let active=true;void createInboxAttachmentUrl(attachment).then(value=>{if(active)setResource({id:attachment.id,url:value,error:''});}).catch(()=>{if(active)setResource({id:attachment.id,url:'',error:'Preview unavailable. Close this view and use Download to save the attachment.'});});return()=>{active=false;};},[attachment]);
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.key==='ArrowLeft'){event.preventDefault();setIndex(value=>Math.max(0,value-1));}if(event.key==='ArrowRight'){event.preventDefault();setIndex(value=>Math.min(attachments.length-1,value+1));}if(event.key==='Tab'){const controls=close.current?.closest('[role="dialog"]')?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');if(!controls?.length)return;const first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[attachments.length]);
  return <div role="dialog" aria-modal="true" aria-label="Attachment images" className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/85 p-3 sm:p-6" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded border border-slate-600 bg-slate-950 text-white">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-700 px-4 py-2"><span aria-live="polite" className="text-sm font-semibold">Image {index+1} of {attachments.length}</span><button ref={close} type="button" onClick={onClose} aria-label="Close image preview" className="flex h-11 w-11 items-center justify-center rounded hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-300"><X className="h-5 w-5"/></button></header>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2">{error?<p role="alert" className="p-6 text-sm">{error}</p>:url?<Image unoptimized src={url} alt={attachment.originalFilename} width={1600} height={1200} onError={()=>setResource({id:attachment.id,url:'',error:'Preview unavailable. Close this view and use Download to save the attachment.'})} className="h-auto max-h-[65dvh] w-auto max-w-full object-contain"/>:<p role="status" className="p-6 text-sm">Loading image…</p>}</div>
      <footer className="shrink-0 border-t border-slate-700 p-3"><p className="break-words text-sm leading-relaxed" aria-live="polite">{attachment.originalFilename.replace(/\.[^.]+$/,'')}</p>{attachments.length>1?<div className="mt-3 flex justify-between gap-3"><button type="button" disabled={index===0} onClick={()=>setIndex(index-1)} className="flex min-h-11 items-center gap-1 rounded border border-slate-500 px-3 text-sm disabled:opacity-40"><ChevronLeft className="h-4 w-4"/>Previous</button><button type="button" disabled={index===attachments.length-1} onClick={()=>setIndex(index+1)} className="flex min-h-11 items-center gap-1 rounded border border-slate-500 px-3 text-sm disabled:opacity-40">Next<ChevronRight className="h-4 w-4"/></button></div>:null}</footer>
    </section>
  </div>;
}
