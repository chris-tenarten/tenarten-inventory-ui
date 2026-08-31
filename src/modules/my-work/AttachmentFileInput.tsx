"use client";

import type { ChangeEvent } from "react";
import Image from "next/image";
import { useEffect, useMemo } from "react";

export const attachmentAccept="image/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

type Props={disabled?:boolean;onFiles:(files:File[])=>void;onError:(message:string)=>void;onPreparing?:(preparing:boolean)=>void};

export default function AttachmentFileInput({disabled=false,onFiles,onError,onPreparing}:Props){
  async function retainFiles(event:ChangeEvent<HTMLInputElement>){
    const input=event.currentTarget;
    const selected=Array.from(input.files??[]);
    if(!selected.length){input.value="";return;}
    onPreparing?.(true);
    try{
      const owned=await Promise.all(selected.map(async(file)=>new File([await file.arrayBuffer()],file.name,{type:file.type,lastModified:file.lastModified})));
      onFiles(owned);
    }catch{
      onError("That attachment could not be read. Please choose or take the photo again.");
    }finally{
      onPreparing?.(false);
      input.value="";
    }
  }

  return <input type="file" multiple accept={attachmentAccept} disabled={disabled} onChange={(event)=>void retainFiles(event)} className="sr-only" />;
}

export function StagedImagePreview({file}:{file:File}){
  const url=useMemo(()=>file.type.startsWith("image/")?URL.createObjectURL(file):"",[file]);
  useEffect(()=>()=>{if(url)URL.revokeObjectURL(url);},[url]);
  return url?<Image unoptimized src={url} alt="" width={48} height={48} className="h-10 w-10 shrink-0 rounded border border-slate-200 object-cover" />:null;
}
