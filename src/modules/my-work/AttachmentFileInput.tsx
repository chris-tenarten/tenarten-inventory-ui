"use client";

import type { ChangeEvent } from "react";

export const attachmentAccept="image/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

type Props={disabled?:boolean;onFiles:(files:File[])=>void;onError:(message:string)=>void};

export default function AttachmentFileInput({disabled=false,onFiles,onError}:Props){
  async function retainFiles(event:ChangeEvent<HTMLInputElement>){
    const input=event.currentTarget;
    const selected=Array.from(input.files??[]);
    if(!selected.length){input.value="";return;}
    try{
      const owned=await Promise.all(selected.map(async(file)=>new File([await file.arrayBuffer()],file.name,{type:file.type,lastModified:file.lastModified})));
      onFiles(owned);
    }catch{
      onError("That attachment could not be read. Please choose or take the photo again.");
    }finally{
      input.value="";
    }
  }

  return <input type="file" multiple accept={attachmentAccept} disabled={disabled} onChange={(event)=>void retainFiles(event)} className="sr-only" />;
}
