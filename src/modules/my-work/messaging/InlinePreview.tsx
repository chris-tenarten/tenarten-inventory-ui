"use client";
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { INBOX_ATTACHMENT_BUCKET } from './files';
import { fetchPreview, validPreviewMetadata, type PreviewMetadata } from './preview';

export default function InlinePreview({preview,name,onOpen}:{preview:PreviewMetadata;name:string;onOpen:()=>void}){
  const ref=useRef<HTMLButtonElement>(null);const [url,setUrl]=useState('');const [failed,setFailed]=useState(false);
  const {path,bytes,width,height}=preview;
  useEffect(()=>{
    const preview={path,bytes,width,height};
    const target=ref.current;if(!target||!validPreviewMetadata(preview))return;
    const controller=new AbortController();let objectUrl='';let started=false;
    const start=async()=>{if(started)return;started=true;try{
      const {data,error}=await supabase.storage.from(INBOX_ATTACHMENT_BUCKET).createSignedUrl(preview.path,120);
      if(error||!data)throw Error('Preview unavailable.');if(controller.signal.aborted)return;
      const blob=await fetchPreview(data.signedUrl,preview,controller.signal);if(controller.signal.aborted)return;
      objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);
    }catch{if(!controller.signal.aborted)setFailed(true);}};
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();void start();}},{root:target.closest('[data-message-history]'),rootMargin:'200px'});
    observer.observe(target);
    return()=>{observer.disconnect();controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[path,bytes,width,height]);
  if(!validPreviewMetadata(preview))return null;
  return <button ref={ref} type="button" onClick={onOpen} aria-label={`Open full image ${name}`} className="mt-2 block w-full max-w-[360px] overflow-hidden rounded-md border border-slate-200 bg-slate-100 text-xs text-slate-500" style={{aspectRatio:`${preview.width}/${preview.height}`,maxHeight:240}}>
    {url&&!failed?/* A validated, bounded JPEG blob, never a remote original. */
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={name} width={preview.width} height={preview.height} className="h-full w-full object-contain" onError={()=>setFailed(true)}/>
      :<span role="status">{failed?'Preview unavailable · use Download':'Image preview'}</span>}
  </button>;
}
