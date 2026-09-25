'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { fileSize } from './files';
import { dismissTransfer } from './client';
import type { MessageTransfer } from './transfer';

export default function TransferPanel({transfer}:{transfer:MessageTransfer}) {
  const [selectionError,setSelectionError]=useState('');
  const state=useSyncExternalStore(transfer.subscribe,transfer.snapshot,transfer.snapshot);
  const active=!['sent','canceled','failed'].includes(state.phase);
  useEffect(()=>{
    if(!active)return;
    const prevent=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',prevent);
    return()=>window.removeEventListener('beforeunload',prevent);
  },[active]);
  const file=transfer.files[state.fileIndex];
  const recovering=transfer.needsFiles&&!transfer.cancellationPending&&state.phase==='failed';
  return <section aria-label="Attachment transfer" className="shrink-0 border-b border-blue-200 bg-blue-50 p-3 text-xs">
    <p role="status">{state.phase==='sent'?'Message sent':state.phase==='canceled'?'Transfer canceled':state.phase==='failed'?'Transfer needs attention':state.phase==='canceling'?'Canceling and cleaning up…':state.phase==='finalizing'?'Finalizing message…':state.phase==='retrying'?'Connection interrupted; retrying…':state.phase==='preparing'?'Preparing attachments…':`Uploading file ${state.fileIndex+1} of ${transfer.files.length}`}</p>
    {file&&active?<p className="truncate"><bdi>{file.name}</bdi> · {fileSize(state.fileUploaded)} / {fileSize(file.size)}</p>:null}
    <progress aria-label="Total attachment upload progress" className="mt-1 w-full" max={Math.max(1,state.total)} value={state.phase==='sent'?Math.max(1,state.total):state.uploaded}/>
    <p>{fileSize(state.uploaded)} / {fileSize(state.total)}</p>
    {state.error?<p role="alert" className="mt-1 text-red-800">{state.error}</p>:null}
    {recovering?<div><p>Reselect the original files to resume. If clipboard files are no longer available, cancel this draft and attach them again.</p><ul className="max-h-24 overflow-y-auto">{transfer.draft.entries.map(entry=><li key={entry.id}><bdi>{entry.name}</bdi> · {fileSize(entry.size)}</li>)}</ul><input aria-label="Reselect original attachments" type="file" multiple onChange={event=>{try{transfer.supplyFiles(Array.from(event.currentTarget.files??[]));setSelectionError('');void transfer.start();}catch(error){setSelectionError(error instanceof Error?error.message:'Unable to reselect files.');}event.currentTarget.value='';}}/></div>:null}
    {selectionError?<p role="alert">{selectionError}</p>:null}
    <div className="flex gap-2">
      {state.phase==='failed'?<button type="button" onClick={()=>void transfer.start()} className="min-h-10 rounded border px-3">{transfer.cancellationPending?"Retry cleanup":recovering?"Check transfer result":"Retry transfer"}</button>:null}
      {!['sent','canceled'].includes(state.phase)?<button type="button" disabled={state.phase==='canceling'} onClick={()=>void transfer.cancel()} className="min-h-10 rounded border px-3">Cancel transfer</button>:<button type="button" onClick={dismissTransfer} className="min-h-10 rounded border px-3">Dismiss transfer</button>}
    </div>
  </section>;
}
