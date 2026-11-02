'use client';

import {Check, FileText, RefreshCw, ShieldCheck, X} from 'lucide-react';
import {createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import DocumentViewer from '@/components/documents/DocumentViewer';
import {actionRecordLink, parseActionReceipt, parseActionStatus, type ActionCard, type ActionReceipt, type ActionStatus, type JsonValue} from './contract';
import {unavailableActionAdapter, type ActionAdapter} from './adapter';

const ActionInteractionContext=createContext(false);

/** Each conversation presentation supplies visibility; hidden panels retain no credential UI. */
export function ActionInteractionProvider({active,children}:{active:boolean;children:ReactNode}){
 return <ActionInteractionContext.Provider value={active}>{children}</ActionInteractionContext.Provider>;
}

type Props={card:ActionCard;publishedStatus?:ActionStatus;adapter?:ActionAdapter;ownerKey:string;sessionKey:string;active?:boolean;onRequestCorrection?():void};
const referenceKey=(card:ActionCard)=>[card.operation,card.reference.id,card.reference.revision,card.reference.hash,card.reference.expiresAt].join(':');
const label=(value:string)=>value.replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' ').replace(/^./,part=>part.toUpperCase());
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ReviewValue({value}:{value:JsonValue}):ReactNode{
 if(value===null||value==='')return <span className="italic text-slate-500">Not provided</span>;
 if(typeof value==='boolean')return value?'Yes':'No';
 if(typeof value==='string')return uuid.test(value)?'Linked record':value;
 if(typeof value==='number')return new Intl.NumberFormat(undefined,{maximumFractionDigits:8}).format(value);
 if(Array.isArray(value))return value.length?<ul className="space-y-1">{value.map((item,index)=><li key={index}><ReviewValue value={item}/></li>)}</ul>:<span className="text-slate-500">None</span>;
 return <dl className="space-y-1">{Object.entries(value).map(([key,item])=><div key={key} className="min-w-0"><dt className="inline font-medium text-slate-500">{label(key)}: </dt><dd className="inline break-words"><ReviewValue value={item}/></dd></div>)}</dl>;
}

function Overview({card,completed=false}:{card:ActionCard;completed?:boolean}){
 return <>
  <div className="flex items-start gap-2"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-800" aria-hidden="true"/><div className="min-w-0"><h3 className="font-semibold text-slate-950">{completed?'Reviewed changes':card.review.title}</h3>{!completed?<p className="mt-1 text-sm leading-relaxed text-slate-700">{card.review.summary}</p>:null}</div></div>
  <p className="text-xs font-medium text-slate-600">{card.operation==='proposal.save_draft'?'Saves a draft only. The Proposal will not be issued.':'Adds items to the receiving queue. Inventory quantities will not increase.'}</p>
  {card.review.fields.length?<details open className="rounded-md border border-slate-200 bg-white"><summary className="min-h-11 cursor-pointer px-3 py-3 text-xs font-semibold text-slate-700">Proposed details ({card.review.fields.length})</summary><dl className="max-h-64 space-y-2 overflow-y-auto border-t border-slate-100 px-3 py-3 text-xs">{card.review.fields.map((field,index)=><div key={`${field.path}:${index}`} className="min-w-0"><dt className="font-medium text-slate-500">{field.label}</dt><dd className="mt-0.5 whitespace-pre-wrap break-words text-slate-800"><ReviewValue value={field.value}/></dd></div>)}</dl></details>:null}
  {card.review.consequences.length?<div className="text-xs leading-relaxed text-slate-600"><p className="mb-1 font-semibold">{completed?'Reviewed effects':'After confirmation'}</p><ul className="list-disc space-y-1 pl-4">{card.review.consequences.map((consequence,index)=><li key={index}>{consequence}</li>)}</ul></div>:null}
  {card.review.issues.length?<div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950" aria-label="Review attention needed"><p className="font-semibold">{card.review.issues.some(issue=>issue.blocking)?'Resolve before confirming':'Details to review'}</p><ul className="list-disc space-y-1 pl-4">{card.review.issues.map((issue,index)=><li key={`${issue.code}:${index}`}>{issue.message}</li>)}</ul></div>:null}
 </>;
}

/** History can carry a freshly reauthorized committed receipt. It is display
 * evidence only and never supplies an interactive prepared/authorized state. */
function publishedReceipt(card:ActionCard,status:ActionStatus|undefined):ActionReceipt|null{
 if(!status)return null;
 try{
  const parsed=parseActionStatus(status,card.reference);
  if(parsed.state!=='completed'||!parsed.receipt||parsed.card.operation!==card.operation||JSON.stringify(parsed.card.review)!==JSON.stringify(card.review))return null;
  return parseActionReceipt(parsed.receipt,card.reference,card.operation);
 }catch{return null;}
}
function ReadOnlyCompletion({card,receipt,previewOnly}:{card:ActionCard;receipt:ActionReceipt;previewOnly:boolean}){
 const recordLink=previewOnly?null:actionRecordLink(receipt);
 return <section aria-label="Proposed TenOps action" data-tenbot-action="completed" className="space-y-3 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm">
  <Overview card={card} completed/>
  <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900"><Check className="mr-1 inline h-3.5 w-3.5" aria-hidden="true"/>{previewOnly?'Preview receipt only. No authenticated record was created.':card.operation==='proposal.save_draft'?'Proposal draft saved. It has not been issued.':'Items added to Pending Receivals. Inventory quantities have not increased.'}</p>
  {!previewOnly?<p className="text-xs text-slate-500">Completed <time dateTime={receipt.completedAt}>{new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(receipt.completedAt))}</time></p>:null}
  {recordLink?<a href={recordLink.href} className="inline-flex min-h-11 items-center rounded-md border border-blue-200 bg-white px-3 text-xs font-semibold text-blue-800">{recordLink.label}</a>:null}
 </section>;
}

/** The outer presentation survives closing; all interactive/credential state is destroyed on hide. */
export function ActionReviewCard({card,publishedStatus,adapter=unavailableActionAdapter,ownerKey,sessionKey,active,onRequestCorrection}:Props){
 const visible=useContext(ActionInteractionContext);
 const enabled=(active??visible)&&Boolean(ownerKey)&&Boolean(sessionKey);
 const key=[ownerKey,sessionKey,referenceKey(card),JSON.stringify(card.review),card.confirmation.available,adapter.availability].join(':');
 const receipt=ownerKey?publishedReceipt(card,publishedStatus):null;
 if(receipt&&(adapter.availability==='unavailable'||!enabled))return <ReadOnlyCompletion card={card} receipt={receipt} previewOnly={adapter.availability==='preview'}/>;
 if(!enabled)return <section aria-label="Proposed TenOps action" data-tenbot-action="inactive" className="space-y-3 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm"><Overview card={card}/></section>;
 return <ActionReviewSession key={key} card={card} adapter={adapter} onRequestCorrection={onRequestCorrection}/>;
}

function ActionReviewSession({card,adapter,onRequestCorrection}:{card:ActionCard;adapter:ActionAdapter;onRequestCorrection?:()=>void}){
 const [status,setStatus]=useState<ActionStatus|null>(null);
 const [phase,setPhase]=useState<'checking'|'previewing'|'confirming'|'cancelling'|null>(adapter.availability==='unavailable'?null:'checking');
 const [needsReconciliation,setNeedsReconciliation]=useState(true);
 const [error,setError]=useState('');
 const [confirmOpen,setConfirmOpen]=useState(false);
 const [preview,setPreview]=useState<{url:string;size:number}|null>(null);
 const [now,setNow]=useState(Date.now);
 const passwordRef=useRef<HTMLInputElement>(null);
 const previewRef=useRef<HTMLDivElement>(null);
 const previewUrl=useRef('');
 const generation=useRef(0);
 const visibilityVersion=useRef(0);
 const pending=useRef<AbortController|null>(null);
 const confirmationDispatched=useRef(false);
 const expired=Date.parse(card.reference.expiresAt)<=now;
 const blocked=card.review.issues.some(issue=>issue.blocking);
 const busy=phase!==null;
 const verified=status!==null&&!needsReconciliation;
 const confirmAvailable=verified&&status.state==='prepared'&&status.card.confirmation.available&&!blocked&&!expired&&!busy&&adapter.availability!=='unavailable';
 const previewAvailable=verified&&['prepared','authorized'].includes(status.state)&&Boolean(card.review.preview)&&!expired&&!busy;
 const currentReceipt=status?.state==='completed'?status.receipt:null;
 const clearPassword=()=>{if(passwordRef.current)passwordRef.current.value='';};
 const closePreview=()=>{if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);previewUrl.current='';setPreview(null);};
 const begin=()=>{pending.current?.abort();const controller=new AbortController();pending.current=controller;return {controller,id:++generation.current,view:visibilityVersion.current};};
 const current=(id:number)=>generation.current===id&&!pending.current?.signal.aborted;
 function checkedStatus(value:ActionStatus){
  const parsed=parseActionStatus(value,card.reference);
  if(parsed.card.operation!==card.operation||JSON.stringify(parsed.card.review)!==JSON.stringify(card.review))throw new Error('review_changed');
  return parsed;
 }
 async function refresh(){
  clearPassword();setConfirmOpen(false);closePreview();
  const {controller,id,view}=begin();setPhase('checking');setError('');setNeedsReconciliation(true);
  try{const next=checkedStatus(await adapter.status(card.reference,controller.signal));if(current(id)){setStatus(next);setNeedsReconciliation(visibilityVersion.current!==view);}}
  catch{if(current(id))setError('The current action could not be verified. Check status before continuing.');}
  finally{if(current(id))setPhase(null);}
 }
 useEffect(()=>{
  if(adapter.availability!=='unavailable')void refresh();
  const invalidate=(discardPreview:boolean)=>{visibilityVersion.current++;clearPassword();setConfirmOpen(false);setNeedsReconciliation(true);if(discardPreview)closePreview();};
  // Focusing an embedded PDF can blur the window, so retain its visible content
  // until the document hides or the main window regains focus. Confirmation is
  // invalidated immediately, without interrupting an in-flight mutation.
  const blur=()=>invalidate(false);
  const focus=()=>invalidate(true);
  const visibility=()=>invalidate(true);
  window.addEventListener('blur',blur);window.addEventListener('focus',focus);document.addEventListener('visibilitychange',visibility);
  return()=>{
   // This invalidates asynchronous work; it is not a DOM ref.
   // eslint-disable-next-line react-hooks/exhaustive-deps
   generation.current++;if(!confirmationDispatched.current)pending.current?.abort();clearPassword();if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);window.removeEventListener('blur',blur);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',visibility);};
  // A keyed instance binds card, owner, access/session and adapter availability.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[adapter]);
 useEffect(()=>{
  const timeout=window.setTimeout(()=>{clearPassword();if(!confirmationDispatched.current){pending.current?.abort();generation.current++;setPhase(null);}setNow(Date.now());setConfirmOpen(false);if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);previewUrl.current='';setPreview(null);},Math.max(0,Math.min(2147483647,Date.parse(card.reference.expiresAt)-Date.now())));
  return()=>window.clearTimeout(timeout);
 },[card.reference.expiresAt]);
 useLayoutEffect(()=>{if(confirmOpen)passwordRef.current?.focus();},[confirmOpen]);
 useLayoutEffect(()=>{if(preview)previewRef.current?.querySelector<HTMLButtonElement>('[aria-label="Close attachment preview"]')?.focus();},[preview]);

 async function showPreview(){
  if(!previewAvailable)return;clearPassword();setConfirmOpen(false);closePreview();
  const {controller,id,view}=begin();setPhase('previewing');setError('');
  try{
   const next=checkedStatus(await adapter.status(card.reference,controller.signal));
   if(!current(id))return;
   setStatus(next);
   if(!['prepared','authorized'].includes(next.state)||Date.parse(card.reference.expiresAt)<=Date.now())throw new Error('preview_unavailable');
   const blob=await adapter.preview(card.reference,controller.signal);
   if(!current(id)||visibilityVersion.current!==view||document.visibilityState!=='visible'||Date.parse(card.reference.expiresAt)<=Date.now())return;
   const url=URL.createObjectURL(blob);previewUrl.current=url;setPreview({url,size:blob.size});
  }catch{if(current(id)){setNeedsReconciliation(true);setError('The exact reviewed document is unavailable. Check status or ask TenBot to complete the missing details.');}}
  finally{if(current(id))setPhase(null);}
 }
 async function cancel(){
  if(busy||!verified||!['prepared','authorized'].includes(status.state)||expired)return;
  clearPassword();setConfirmOpen(false);closePreview();const {controller,id}=begin();setPhase('cancelling');setError('');
  try{await adapter.cancel(card.reference,controller.signal);if(current(id)){setStatus({...status,state:'revoked',receipt:null});setNeedsReconciliation(false);}}
  catch{if(current(id)){setNeedsReconciliation(true);setError('Cancellation could not be confirmed. Check status before continuing.');}}
  finally{if(current(id))setPhase(null);}
 }
 async function confirm(){
  if(!confirmAvailable||!confirmOpen)return;
  const password=passwordRef.current?.value??'';clearPassword();setConfirmOpen(false);
  if(!password){setError('Enter your existing TenOps password to confirm.');return;}
  const {controller,id,view}=begin();setPhase('confirming');setError('');closePreview();setNeedsReconciliation(true);
  try{
   const next=checkedStatus(await adapter.status(card.reference,controller.signal));
   if(!current(id))return;
   if(next.state!=='prepared'||!next.card.confirmation.available||next.card.review.issues.some(issue=>issue.blocking)||Date.parse(card.reference.expiresAt)<=Date.now()){setStatus(next);throw new Error('review_changed');}
   confirmationDispatched.current=true;
   const result=await adapter.confirm(card.reference,password,controller.signal);
   if(!current(id))return;
   if(result.status==='completed'&&result.receipt){const receipt=parseActionReceipt(result.receipt,card.reference,card.operation);setStatus({...next,state:'completed',receipt});setNeedsReconciliation(visibilityVersion.current!==view);}
   else setError(result.status==='uncertain'?'The result is not confirmed. Check status before trying anything else.':'The action was not confirmed. Check status and review any changed requirements.');
  }catch{if(current(id))setError('Confirmation could not be verified. Check status before trying again.');}
  finally{confirmationDispatched.current=false;clearPassword();if(current(id))setPhase(null);}
 }
 const stateText=currentReceipt?adapter.availability==='preview'?'Preview receipt only. No authenticated record was created.':card.operation==='proposal.save_draft'?'Proposal draft saved. It has not been issued.':'Items added to Pending Receivals. Inventory quantities have not increased.':expired||status?.state==='expired'?'This review expired. Ask TenBot for a fresh review.':status?.state==='revoked'?'This action was cancelled or replaced.':status?.state==='failed'?'This action was not completed. Ask TenBot for a corrected review.':status?.state==='authorized'?'Confirmation is being processed. Check status to see the result.':phase==='checking'?'Checking the saved review…':needsReconciliation&&adapter.availability!=='unavailable'?'Check the current status before continuing.':!(status?.card.confirmation.available??card.confirmation.available)?'Confirmation is not available for this action.':null;
 const recordLink:ReturnType<typeof actionRecordLink>=currentReceipt&&adapter.availability==='connected'?actionRecordLink(currentReceipt):null;
 return <section aria-label="Proposed TenOps action" data-tenbot-action={currentReceipt?'completed':status?.state??'unverified'} className="space-y-3 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm" onKeyDownCapture={event=>{if(event.key==='Escape'&&preview){event.preventDefault();event.stopPropagation();closePreview();}else if(event.key==='Escape')clearPassword();}}>
  {adapter.availability==='preview'?<p className="text-xs font-semibold text-amber-800">Local interaction preview · No authenticated records will be created.</p>:null}
  <Overview card={card} completed={Boolean(currentReceipt)}/>
  {stateText?<p role="status" className={`rounded-md border p-2 text-xs ${currentReceipt&&adapter.availability==='connected'?'border-emerald-200 bg-emerald-50 text-emerald-900':'border-slate-200 bg-white text-slate-600'}`}>{currentReceipt?<Check className="mr-1 inline h-3.5 w-3.5" aria-hidden="true"/>:null}{stateText}</p>:null}
  {recordLink?<a href={recordLink.href} className="inline-flex min-h-11 items-center rounded-md border border-blue-200 bg-white px-3 text-xs font-semibold text-blue-800">{recordLink.label}</a>:null}
  {adapter.availability==='unavailable'?<p role="status" className="rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-600">Interactive actions are not connected yet. Nothing has been submitted.</p>:null}
  {error?<p role="alert" className="text-xs text-red-800">{error}</p>:null}
  {preview&&!expired?<div ref={previewRef}><DocumentViewer mode="embedded" title="Reviewed Proposal preview" filename="Proposal draft preview.pdf" mimeType="application/pdf" sizeBytes={preview.size} metadata="Exact reviewed draft · Not issued" url={preview.url} onClose={closePreview}/></div>:null}
  <div className="flex flex-wrap gap-2">
   {card.review.preview&&!currentReceipt?<button type="button" disabled={!previewAvailable} onClick={()=>void showPreview()} className="inline-flex min-h-11 items-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 disabled:opacity-40"><FileText className="h-3.5 w-3.5" aria-hidden="true"/>{phase==='previewing'?'Loading preview…':'Preview Proposal'}</button>:null}
   {!currentReceipt?<button type="button" disabled={!confirmAvailable} onClick={()=>{clearPassword();setError('');setConfirmOpen(true);}} className="tenops-selected-surface inline-flex min-h-11 items-center gap-1 rounded-md border px-3 text-xs font-semibold disabled:opacity-40"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true"/>Review and confirm</button>:null}
   <button type="button" disabled={busy||adapter.availability==='unavailable'} onClick={()=>void refresh()} className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-xs font-medium text-blue-800 disabled:opacity-40"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true"/>Check status</button>
   {verified&&!currentReceipt&&['prepared','authorized'].includes(status.state)?<button type="button" disabled={busy||expired} onClick={()=>void cancel()} className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-xs text-slate-600 disabled:opacity-40"><X className="h-3.5 w-3.5" aria-hidden="true"/>{phase==='cancelling'?'Cancelling…':'Cancel action'}</button>:null}
  </div>
  {confirmOpen&&confirmAvailable?<form aria-label="Confirm with TenOps password" className="space-y-2 rounded-md border border-slate-300 bg-white p-3" onSubmit={event=>{event.preventDefault();void confirm();}}><label className="block text-xs font-medium text-slate-700">Your TenOps password<input ref={passwordRef} type="password" autoComplete="current-password" maxLength={4096} aria-label="Your TenOps password" className="mt-1 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950"/></label><p className="text-xs text-slate-500">Confirm these exact reviewed changes with your existing account password.</p><div className="flex flex-wrap gap-2"><button type="submit" className="tenops-selected-surface min-h-11 rounded-md border px-3 text-xs font-semibold">{adapter.availability==='preview'?'Confirm preview':'Confirm action'}</button><button type="button" onClick={()=>{clearPassword();setConfirmOpen(false);}} className="min-h-11 rounded-md px-3 text-xs text-slate-600">Back to review</button></div></form>:null}
  {onRequestCorrection&&!currentReceipt?<button type="button" disabled={busy||needsReconciliation||expired||status?.state==='revoked'} onClick={()=>{clearPassword();setConfirmOpen(false);closePreview();onRequestCorrection();}} className="min-h-11 text-xs font-medium text-blue-800 underline disabled:opacity-40">Ask TenBot to change these details</button>:null}
  {phase==='confirming'?<p role="status" className="text-xs text-slate-600">Confirming through your TenOps account…</p>:null}
 </section>;
}
