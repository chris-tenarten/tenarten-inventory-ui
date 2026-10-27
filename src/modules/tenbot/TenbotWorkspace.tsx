'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {useAuth} from '@/lib/auth';
import {supabase} from '@/lib/supabase';
type Source={id:string;title:string;status:string;guidance:string;path:string;route:string|null;source:string;availability?:string;constraints?:string[]};
type Answer={mode:string;message:string;resolution?:'available'|'partial'|'unavailable'|'permission-denied'|'documentation-missing';sources:Source[];snapshot:{revision:string;verifiedAt:string};summary:string|null;fallback?:boolean};
type Draft={capability:string;problem:string;desired:string;module:string;original:string;summary:string;summaryKind:string;context:string};
type Feedback={id:string;submitter_name:string;status:string;created_at:string;draft:Draft;history:{id:number;status:string;note:string;created_at:string}[]};
type Usage={sharedDayLimit:number;sharedDayUsed:number;sharedDayRemaining:number;perAccountMinuteLimit:number;monthReservedUsd:number;monthlyBudgetUsd:number};
const statuses=['New','Needs Clarification','Under Consideration','Backlogged','Declined','Shipped'];
const modules=['General','Messaging','My Work','Intake','Production','Inventory','Purchasing','Contacts','Settings'];
const field='min-h-11 w-full rounded border border-slate-300 bg-white px-3 py-2 text-base';
async function invoke<T>(body:Record<string,unknown>,owner:string):Promise<T>{
 const {data:sessionData}=await supabase.auth.getSession();
 if(!owner||sessionData.session?.user.id!==owner)throw new Error('Your account changed. Reopen TenBot to continue.');
 // Existing loopback fixture tokens cannot authenticate to hosted Supabase.
 // Keep the review adapter usable when another local task rebuilds the shared export.
 const localFixture=typeof window!=='undefined'&&window.location.origin==='http://localhost:3000'&&sessionData.session?.access_token.endsWith('.local');
 const endpoint=process.env.NEXT_PUBLIC_TENBOT_REVIEW_URL||(localFixture?'http://localhost:55593':undefined);
 if(endpoint&&typeof window!=='undefined'&&window.location.hostname==='localhost'){
 const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${sessionData.session?.access_token||''}`},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});const value=await r.json();if(!r.ok)throw new Error(value.error||'TenBot unavailable.');return value;
 }
 const {data,error}=await supabase.functions.invoke('tenbot',{body,headers:{Authorization:`Bearer ${sessionData.session.access_token}`},signal:AbortSignal.timeout(20000)});
 if(error){const detail='context' in error&&error.context instanceof Response?await error.context.json().catch(()=>null):null;throw new Error(detail?.error||'TenBot is unavailable. The rest of TenOps remains available.');}return data;
}
type ModuleContext={label:string;module:string};
function moduleContext(pathname:string):ModuleContext{
 // Only fixed module labels leave this hook. No record IDs, search params or content.
 switch(pathname.split('/')[1]){
  case 'settings':return {label:'Settings',module:'Settings'};
  case 'my-work':return {label:'My Work',module:'My Work'};
  case 'manpower-reporting':return {label:'Manpower Reporting',module:'Production'};
  case 'samples':return {label:'Samples',module:'Intake'};
  case 'pre-production':return {label:'Intake',module:'Intake'};
  case 'contacts':return {label:'Contacts',module:'Contacts'};
  case 'inventory':case 'activity':return {label:'Inventory',module:'Inventory'};
  case 'purchasing':case 'catalog':return {label:'Purchasing',module:'Purchasing'};
  case '':case 'production':return {label:'Production',module:'Production'};
  default:return {label:'TenOps',module:'General'};
 }
}
type Turn={id:number;question:string;createdAt:string;answeredAt?:string;answer:Answer|null;error?:string};
type AssistantEntry={id:string;createdAt:string;content:ReactNode};
export type TenbotConversation={available:boolean;busy:boolean;send:(question:string)=>Promise<boolean>;history:ReactNode;entries:AssistantEntry[];controls:(question:string)=>ReactNode;activityKey:string};
const messageTime=(value:string)=>new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(new Date(value));

// InboxDialog owns this hook for one authenticated account. It accepts only an
// explicitly submitted question, never Messaging history, recipients or records.
export function useTenbotConversation():TenbotConversation{
 const auth=useAuth(),pathname=usePathname();
 const available=auth.ready&&auth.accessStatus!=='pending'&&auth.isAuthenticated&&auth.accessAllowed&&Boolean(auth.user?.id)&&auth.user?.id===auth.profile?.userId&&auth.can('readOperationalData');
 const reviewAllowed=available&&auth.can('manageUsers');
 const identity=auth.profile?.displayName||'Your account';
 const owner=auth.user?.id||'';
 const currentModule=moduleContext(pathname);
 const [messages,setMessages]=useState<Turn[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [draft,setDraft]=useState<Draft|null>(null),[confirmed,setConfirmed]=useState(false);
 const [notice,setNotice]=useState(''),[showFeedback,setShowFeedback]=useState(false);
 const [items,setItems]=useState<Feedback[]>([]),[filter,setFilter]=useState(''),[moduleFilter,setModuleFilter]=useState('');
 const [usage,setUsage]=useState<Usage|null>(null),[usageError,setUsageError]=useState('');
 const [notes,setNotes]=useState<Record<string,string>>({});
 const lock=useRef(false),sequence=useRef(0);
 const draftForm=useRef<HTMLFormElement>(null);
 const drafting=Boolean(draft);
 const lastAnswer=messages.at(-1)?.answer;
 useEffect(()=>{
  if(drafting&&draftForm.current?.getClientRects().length){
   draftForm.current.scrollIntoView({block:'nearest'});
   draftForm.current.querySelector('textarea')?.focus({preventScroll:true});
  }
 },[drafting]);
 const context=()=>[`Current module: ${currentModule.label}`,...messages.filter(m=>m.answer).slice(-1).map(m=>m.question)];
 const request=<T,>(body:Record<string,unknown>)=>invoke<T>(body,owner);
 function begin(){if(!available||lock.current)return false;lock.current=true;setBusy(true);setError('');return true;}
 function finish(){lock.current=false;setBusy(false);}
 async function send(question:string):Promise<boolean>{
  const current=question.trim();
  if(!current||current.length>1200||!begin())return false;
  setNotice('');
  const previous=messages.at(-1);
  // Retrying an unsuccessful send updates that turn instead of duplicating it.
  const retry=previous?.error&&previous.question===current?previous:undefined;
  const turn:Turn={id:retry?.id??++sequence.current,question:current,createdAt:retry?.createdAt??new Date().toISOString(),answer:null};
  setMessages(m=>[...m.filter(item=>item.id!==turn.id).slice(-7),turn]);
  try{
   const response=await request<Answer>({action:'ask',question:current,context:context()});
   setMessages(m=>m.map(item=>item.id===turn.id?{...item,answer:response,answeredAt:new Date().toISOString()}:item));
   return true;
  }catch(e){
   const failure=e instanceof Error?e.message:'TenBot unavailable.';
   setMessages(m=>m.map(item=>item.id===turn.id?{...item,error:failure}:item));
   return false;
  }finally{finish();}
 }
 async function makeDraft(question:string){
  const original=question.trim()||messages.at(-1)?.question;if(!original||!begin())return;
  try{const r=await request<Answer>({action:'draft',question:original,context:context()});setDraft({capability:original,problem:'',desired:'',module:currentModule.module,original,summary:r.summary||'',summaryKind:r.summary?'AI-generated':'Employee-written',context:''});setConfirmed(false);}
  catch(e){setError(e instanceof Error?e.message:'Draft unavailable.');}finally{finish();}
 }
 async function submit(){
  if(!draft||!confirmed||!begin())return;
  try{await request({action:'submit',draft,confirmed});setDraft(null);setConfirmed(false);setNotice('Suggestion submitted to Product. It has not been approved or added to the roadmap.');}
  catch(e){setError(e instanceof Error?e.message:'Submission failed.');}finally{finish();}
 }
 async function refreshFeedback(status:string,module:string){
  await Promise.all([
   request<{usage:Usage}>({action:'usage'}).then(r=>{setUsage(r.usage);setUsageError('');}).catch(()=>{setUsage(null);setUsageError('Usage is unavailable.');}),
   request<{items:Feedback[]}>({action:'list',status,module}).then(r=>setItems(r.items)),
  ]);
 }
 async function load(status=filter,module=moduleFilter){
  if(!reviewAllowed||!begin())return;
  try{await refreshFeedback(status,module);}
  catch(e){setItems([]);setError(e instanceof Error?e.message:'Feedback unavailable.');}finally{finish();}
 }
 async function review(id:string,status:string){
  if(!reviewAllowed||!begin())return;
  try{await request({action:'review',id,status,note:notes[id]||''});await refreshFeedback(filter,moduleFilter);}
  catch(e){setError(e instanceof Error?e.message:'Review failed.');}finally{finish();}
 }
 const entries:AssistantEntry[]=available?messages.flatMap(m=>[{id:`assistant-question-${m.id}`,createdAt:m.createdAt,content:<article className="relative mb-3 ml-auto max-w-[88%] rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">{m.question}</div>
    <time className="mt-1 block text-[10px] text-slate-400">{messageTime(m.createdAt)}</time>
   </article>},{id:`assistant-answer-${m.id}`,createdAt:m.answeredAt??m.createdAt,content:<article aria-label="TenBot assistant reply" className="relative mb-3 max-w-[88%] space-y-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
    <p className="text-xs font-semibold text-slate-600">TenBot · Assistant</p>
    {m.answer?<>
     <p className="whitespace-pre-wrap break-words leading-relaxed text-slate-800">{m.answer.mode==='guide'?(m.answer.fallback?"AI is unavailable right now. Here’s guidance from the TenOps Guide.":"Here’s what I found in the TenOps Guide."):m.answer.message}</p>
     {!m.answer.sources.length&&m.answer.mode==='guide'?<p>The TenOps Guide does not have enough verified information to confirm that workflow. Please check with Product.</p>:null}
     {m.answer.sources.map(s=><div key={s.id} className="border-t pt-2">
      <strong>{s.title}</strong><span className="ml-2 rounded bg-slate-100 px-1 text-xs">{s.availability==='partial'?'Partly available':s.status==='deployed'?'Available':s.status==='local'?'Unreleased':s.status==='planned'?'Planned / deferred':'Unable to verify'}</span>
      {m.answer?.mode==='ai'?<>{s.constraints?.map(rule=><p key={rule} className="mt-2 text-xs text-slate-600">{rule}</p>)}<details className="mt-2"><summary className="min-h-11 cursor-pointer py-3 text-xs text-slate-600">Read TenOps Guide</summary><p className="whitespace-pre-wrap">{s.guidance.replace('in the deployed TenOps capability snapshot','in the TenOps Guide')}</p></details></>:m.answer?.mode==='verified'?null:<p className="mt-2 whitespace-pre-wrap">{s.guidance.replace('in the deployed TenOps capability snapshot','in the TenOps Guide')}</p>}{s.path?<p className="mt-2 font-medium">{s.path}</p>:null}
      {s.route?<Link className="inline-block min-h-11 py-3 font-semibold text-blue-800 underline" href={s.route}>Open {s.route==='/settings'?'Settings':s.route==='/contacts'?'Contacts':'My Work'}</Link>:null}
     </div>)}
     {m.answer.sources.length?<p className="text-xs text-slate-500">Source: TenOps Guide</p>:null}
    </>:m.error?<p role="alert" className="text-red-800">{m.error} TenBot could not answer. Use Send to retry.</p>:<p role="status" className="text-slate-500">Working…</p>}
    {m.answeredAt?<time className="block text-[10px] text-slate-400">{messageTime(m.answeredAt)}</time>:null}
   </article>}]):[];
 const history=available?<div role="log" aria-label="TenBot conversation" aria-live="polite">{entries.map(entry=><div key={entry.id}>{entry.content}</div>)}</div>:null;
 const controls=(question:string):ReactNode=>{
  if(!available)return null;
  const offerSuggestion=Boolean(question.trim())||Boolean(lastAnswer?.sources.length&&lastAnswer.sources[0].status!=='unknown'&&lastAnswer.resolution!=='documentation-missing'&&lastAnswer.resolution!=='permission-denied');
  return <div className="space-y-3" data-tenbot-controls>
   {error?<p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>:null}
   {notice?<p role="status" className="rounded bg-green-50 px-3 py-2 text-sm">{notice}</p>:null}
   <div className="flex flex-wrap items-center gap-2 text-xs">
    {offerSuggestion?<button type="button" disabled={busy} onClick={()=>void makeDraft(question)} className="min-h-11 rounded border px-3 disabled:opacity-50">Draft a feature suggestion</button>:null}
    {reviewAllowed?<button type="button" className="min-h-11 rounded border px-3" disabled={busy} aria-expanded={showFeedback} onClick={()=>{setShowFeedback(value=>!value);if(!showFeedback)void load();}}>Product feedback</button>:null}
    {messages.length||draft?<button type="button" disabled={busy} onClick={()=>{setMessages([]);setDraft(null);setError('');setNotice('');}} className="min-h-11 px-1 text-slate-500">Clear assistant chat</button>:null}
   </div>
   {draft?<form ref={draftForm} onSubmit={e=>{e.preventDefault();void submit();}} className="space-y-3 rounded-lg border bg-white p-3" aria-label="Feature suggestion draft">
    <h3 className="font-bold">Review your suggestion</h3><p className="text-xs text-slate-600">Submitter: {identity}. Only this draft will be saved; your assistant chat is not stored.</p>
    {([['capability','Requested capability'],['problem','Current workflow or problem'],['desired','Desired behavior'],['context','Optional context and frequency'],['original','Original wording'],['summary',draft.summaryKind+' summary']] as const).map(([k,label])=><label key={k} className="block text-sm">{label}<textarea readOnly={k==='original'} required={k!=='context'&&k!=='summary'} maxLength={k==='summary'?800:1200} value={draft[k]} onChange={e=>setDraft({...draft,[k]:e.target.value})} className={field}/></label>)}
    <label className="block text-sm">Affected module<select className={field} value={draft.module} onChange={e=>setDraft({...draft,module:e.target.value})}>{modules.map(m=><option key={m}>{m}</option>)}</select></label>
    <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed this draft and want to submit it to Product.</label>
    <button disabled={busy||!confirmed} className="tenops-selected-surface min-h-11 rounded px-3 disabled:opacity-50">Submit suggestion</button><button type="button" className="min-h-11 px-3" onClick={()=>setDraft(null)}>Cancel</button>
   </form>:null}
   {reviewAllowed&&showFeedback?<section aria-label="Product feedback inbox" className="space-y-3 rounded border bg-white p-3">
    <section aria-label="Shared TenBot usage" className="space-y-1 rounded border bg-slate-50 p-3 text-xs">
     <h3 className="font-semibold">Shared AI usage</h3>
     {usage?<><p>{usage.sharedDayUsed} of {usage.sharedDayLimit} shared attempts used today · {usage.sharedDayRemaining} remaining.</p><p>Resets at midnight UTC. Burst limit: {usage.perAccountMinuteLimit} per minute per account.</p><p>Monthly reservation: ${Number(usage.monthReservedUsd).toFixed(2)} of ${Number(usage.monthlyBudgetUsd).toFixed(2)}. These limits do not enable paid inference.</p></>:<p>{usageError||'Loading usage…'}</p>}
    </section>
    <div className="flex flex-wrap gap-2 text-xs">
     <label className="min-w-0 flex-1">Status<select disabled={busy} className={field} value={filter} onChange={e=>{setFilter(e.target.value);void load(e.target.value,moduleFilter);}}><option value="">All statuses</option>{statuses.map(s=><option key={s}>{s}</option>)}</select></label>
     <label className="min-w-0 flex-1">Module<select disabled={busy} className={field} value={moduleFilter} onChange={e=>{setModuleFilter(e.target.value);void load(filter,e.target.value);}}><option value="">All modules</option>{modules.map(m=><option key={m}>{m}</option>)}</select></label>
     <button type="button" className="min-h-11 self-end rounded border px-2" disabled={busy} onClick={()=>void load()}>Refresh</button>
    </div>
    {!items.length?<p className="py-5 text-sm text-slate-500">{busy?'Loading feedback…':'No submissions match these filters.'}</p>:null}
    {items.map(item=><article key={item.id} className="space-y-3 break-words rounded-lg border bg-white p-3">
     <h3 className="font-bold">{item.draft.capability}</h3><p className="text-xs text-slate-500">{item.submitter_name} · {item.created_at.slice(0,10)} · {item.draft.module} · {item.status}</p>
     {(['original','problem','desired','summary','context'] as const).map(k=><p key={k} className="whitespace-pre-wrap text-sm"><strong>{k==='summary'?item.draft.summaryKind+' summary':k}: </strong>{item.draft[k]||'—'}</p>)}
     <label className="block text-sm">Review note<textarea className={field} maxLength={1200} value={notes[item.id]||''} onChange={e=>setNotes({...notes,[item.id]:e.target.value})}/></label>
     <div className="flex flex-wrap gap-2">{statuses.filter(s=>s!==item.status).map(s=><button type="button" disabled={busy} key={s} className="min-h-11 rounded border px-2 text-xs" onClick={()=>void review(item.id,s)}>Mark {s}</button>)}</div>
     <details><summary className="min-h-11 cursor-pointer py-3 text-sm">Request history</summary>{item.history.map(h=><p key={h.id} className="py-1 text-xs">{h.created_at} · {h.status} · {h.note}</p>)}</details>
    </article>)}
   </section>:null}
  </div>;
 };
 return {available,busy,send,history,entries,controls,activityKey:`${messages.length}:${messages.at(-1)?.id??0}:${busy}:${drafting}:${showFeedback}:${error}:${notice}`};
}
