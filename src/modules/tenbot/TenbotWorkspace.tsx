'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useRef,useState} from 'react';
import {useAuth} from '@/lib/auth';
import {supabase} from '@/lib/supabase';
type Source={id:string;title:string;status:string;guidance:string;path:string;route:string|null;source:string};
type Answer={mode:string;message:string;sources:Source[];snapshot:{revision:string;verifiedAt:string};summary:string|null};
type Draft={capability:string;problem:string;desired:string;module:string;original:string;summary:string;summaryKind:string;context:string};
type Feedback={id:string;submitter_name:string;status:string;created_at:string;draft:Draft;history:{id:number;status:string;note:string;created_at:string}[]};
const statuses=['New','Needs Clarification','Under Consideration','Backlogged','Declined','Shipped'];
const modules=['General','Messaging','My Work','Intake','Production','Inventory','Purchasing','Contacts','Settings'];
const field='min-h-11 w-full rounded border border-slate-300 bg-white px-3 py-2 text-base';
async function invoke<T>(body:Record<string,unknown>):Promise<T>{
 const {data:sessionData}=await supabase.auth.getSession();
 // Existing loopback fixture tokens cannot authenticate to hosted Supabase.
 // Keep the review adapter usable when another local task rebuilds the shared export.
 const localFixture=typeof window!=='undefined'&&window.location.origin==='http://localhost:3000'&&sessionData.session?.access_token.endsWith('.local');
 const endpoint=process.env.NEXT_PUBLIC_TENBOT_REVIEW_URL||(localFixture?'http://localhost:55593':undefined);
 if(endpoint&&typeof window!=='undefined'&&window.location.hostname==='localhost'){
 const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${sessionData.session?.access_token||''}`},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});const value=await r.json();if(!r.ok)throw new Error(value.error||'TenBot unavailable.');return value;
 }
 const {data,error}=await supabase.functions.invoke('tenbot',{body,signal:AbortSignal.timeout(20000)});
 if(error){const detail='context' in error&&error.context instanceof Response?await error.context.json().catch(()=>null):null;throw new Error(detail?.error||'TenBot is unavailable. The rest of TenOps remains available.');}return data;
}
type ModuleContext={label:string;module:string;examples:string[]};
function moduleContext(pathname:string):ModuleContext{
 // Only fixed module labels leave this component. No record IDs, search params or content.
 const section=pathname.split('/')[1];
 const general=['How do I create a group conversation?','Can I set a recurring task?'];
 switch(section){
  case 'settings':return {label:'Settings',module:'Settings',examples:['How do I enable notifications on my phone?',...general.slice(0,1)]};
  case 'my-work':return {label:'My Work',module:'My Work',examples:general};
  case 'samples':return {label:'Samples',module:'Intake',examples:['How do I attach a sample to a bid?','Can I estimate material lead times from a blend sheet?']};
  case 'pre-production':return {label:'Intake',module:'Intake',examples:['How do I attach a sample to a bid?','Can I estimate material lead times from a blend sheet?']};
  case 'contacts':return {label:'Contacts',module:'Contacts',examples:["Where do I find a customer's previous jobs?",general[0]]};
  case 'inventory':case 'activity':return {label:'Inventory',module:'Inventory',examples:['Can I estimate material lead times from a blend sheet?',general[0]]};
  case 'purchasing':case 'catalog':return {label:'Purchasing',module:'Purchasing',examples:['Can I estimate material lead times from a blend sheet?',general[0]]};
  case '':case 'production':return {label:'Production',module:'Production',examples:['Can I share a job in a message?',general[0]]};
  default:return {label:'TenOps',module:'General',examples:general};
 }
}
export default function TenbotWorkspace({visible}:{visible:boolean}){
 const auth=useAuth(),pathname=usePathname();
 if(!auth.ready||auth.accessStatus==='pending')return <p className="p-4">Checking account access…</p>;
 if(!auth.isAuthenticated||!auth.accessAllowed||!auth.can('readOperationalData'))return <p className="p-4">Sign in with an authorized TenOps account to use TenBot.</p>;
 return <Workspace key={auth.profile?.userId} visible={visible} currentModule={moduleContext(pathname)} reviewAllowed={auth.can('manageUsers')} identity={auth.profile?.displayName||'Your account'}/>;
}
function Workspace({reviewAllowed,identity,currentModule,visible}:{reviewAllowed:boolean;identity:string;currentModule:ModuleContext;visible:boolean}){
 const [question,setQuestion]=useState('');
 const [messages,setMessages]=useState<{question:string;answer:Answer}[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [draft,setDraft]=useState<Draft|null>(null),[confirmed,setConfirmed]=useState(false);
 const [notice,setNotice]=useState(''),[tab,setTab]=useState('chat');
 const [items,setItems]=useState<Feedback[]>([]),[filter,setFilter]=useState(''),[moduleFilter,setModuleFilter]=useState('');
 const [notes,setNotes]=useState<Record<string,string>>({});
 const scroll=useRef<HTMLDivElement>(null);
 const draftForm=useRef<HTMLFormElement>(null);
 const drafting=Boolean(draft);
 useEffect(()=>{
  if(drafting&&scroll.current&&draftForm.current?.getClientRects().length){
   scroll.current.scrollTop=draftForm.current.offsetTop;
   draftForm.current.querySelector('textarea')?.focus({preventScroll:true});
  }
 },[drafting]);
 useEffect(()=>{if(visible&&!draft&&scroll.current)scroll.current.scrollTop=scroll.current.scrollHeight;},[messages,visible,draft]);
 const context=()=>[`Current module: ${currentModule.label}`,...messages.slice(-1).map(m=>m.question)];
 async function ask(){
  if(busy||!question.trim())return;
  const current=question;setBusy(true);setError('');setNotice('');
  try{const response=await invoke<Answer>({action:'ask',question:current,context:context()});setMessages(m=>[...m.slice(-7),{question:current,answer:response}]);setQuestion('');}
  catch(e){setError(e instanceof Error?e.message:'TenBot unavailable.');}finally{setBusy(false);}
 }
 async function makeDraft(){
  const original=question.trim()||messages.at(-1)?.question;if(!original)return;
  setBusy(true);setError('');
  try{const r=await invoke<Answer>({action:'draft',question:original,context:context()});setDraft({capability:original,problem:'',desired:'',module:currentModule.module,original,summary:r.summary||'',summaryKind:r.summary?'AI-generated':'Employee-written',context:''});setConfirmed(false);}
  catch(e){setError(e instanceof Error?e.message:'Draft unavailable.');}finally{setBusy(false);}
 }
 async function submit(){
  if(!draft||!confirmed)return;setBusy(true);setError('');
  try{await invoke({action:'submit',draft,confirmed});setDraft(null);setConfirmed(false);setNotice('Suggestion submitted to Product. It has not been approved or added to the roadmap.');}
  catch(e){setError(e instanceof Error?e.message:'Submission failed.');}finally{setBusy(false);}
 }
 async function load(status=filter,module=moduleFilter){
  setBusy(true);setError('');try{const r=await invoke<{items:Feedback[]}>({action:'list',status,module});setItems(r.items);}
  catch(e){setItems([]);setError(e instanceof Error?e.message:'Feedback unavailable.');}finally{setBusy(false);}
 }
 async function review(id:string,status:string){
  setBusy(true);setError('');try{await invoke({action:'review',id,status,note:notes[id]||''});await load();}
  catch(e){setError(e instanceof Error?e.message:'Review failed.');}finally{setBusy(false);}
 }
 return <section className="flex min-h-0 flex-1 flex-col" aria-label="TenBot workspace">
  <div className="shrink-0 border-b border-slate-200 px-3 py-2">
   <p className="text-xs text-slate-600">Current module: {currentModule.label}</p>
   <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
    {reviewAllowed?<><button type="button" className="min-h-9 rounded border px-2" onClick={()=>{setTab('chat');setError('');}}>Guide</button><button type="button" className="min-h-9 rounded border px-2" disabled={busy} onClick={()=>{setTab('feedback');void load();}}>Product feedback</button></>:null}
    <button type="button" disabled={busy} onClick={()=>{setMessages([]);setDraft(null);setQuestion('');setError('');setNotice('');}} className="ml-auto min-h-9 px-1 text-slate-500">Clear conversation</button>
   </div>
  </div>
  {error?<p role="alert" className="shrink-0 border-b border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>:null}
  {notice?<p role="status" className="shrink-0 bg-green-50 px-3 py-2 text-sm">{notice}</p>:null}
  {tab==='chat'?<>
   <div ref={scroll} data-tenbot-scroll className="tenbot-scroll relative flex-1 space-y-3 p-3">
    <p className="text-xs text-slate-500">{process.env.NEXT_PUBLIC_TENBOT_REVIEW_URL?'AI is not connected in this local review.':'Ask about TenOps workflows and capabilities.'} Please keep private business details out of questions.</p>
    {!messages.length?<><p className="text-sm text-slate-600">A little guidance while you work. Ask how something works or describe a capability you need.</p><div className="flex flex-col gap-2">{currentModule.examples.map(q=><button type="button" key={q} disabled={busy} onClick={()=>setQuestion(q)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-xs text-slate-700">{q}</button>)}</div></>:null}
    <div role="log" aria-label="TenBot conversation" aria-live="polite" className="space-y-4">
     {messages.map((m,i)=><article key={i} className="space-y-2">
      <p className="ml-6 whitespace-pre-wrap break-words rounded-lg bg-slate-800 px-3 py-2 text-sm text-white">{m.question}</p>
      <div className="space-y-3 rounded-lg border bg-white p-3 text-sm">
       <p>{m.answer.mode==='guide'?"Here’s what I found in the TenOps Guide.":m.answer.message}</p>
       {!m.answer.sources.length?<p>I cannot verify that workflow for your account. You can draft a suggestion below.</p>:null}
       {m.answer.sources.map(s=><div key={s.id} className="border-t pt-2">
        <strong>{s.title}</strong><span className="ml-2 rounded bg-slate-100 px-1 text-xs">{s.status==='deployed'?'Available':s.status==='local'?'Unreleased':s.status==='planned'?'Planned / deferred':'Unable to verify'}</span>
        <p className="mt-2 whitespace-pre-wrap">{s.guidance.replace('in the deployed TenOps capability snapshot','in the TenOps Guide')}</p>{s.path?<p className="mt-2 font-medium">{s.path}</p>:null}
        {s.route?<Link className="inline-block min-h-11 py-3 font-semibold text-blue-800 underline" href={s.route}>Open {s.route==='/settings'?'Settings':'My Work'}</Link>:null}
       </div>)}
       {m.answer.sources.length?<p className="text-xs text-slate-500">Source: TenOps Guide</p>:null}
      </div>
     </article>)}
    </div>
    {draft?<form ref={draftForm} onSubmit={e=>{e.preventDefault();void submit();}} className="space-y-3 rounded-lg border bg-white p-3" aria-label="Feature suggestion draft">
     <h3 className="font-bold">Review your suggestion</h3><p className="text-xs text-slate-600">Submitter: {identity}. Only this draft will be saved; your chat is not stored.</p>
     {([['capability','Requested capability'],['problem','Current workflow or problem'],['desired','Desired behavior'],['context','Optional context and frequency'],['original','Original wording'],['summary',draft.summaryKind+' summary']] as const).map(([k,label])=><label key={k} className="block text-sm">{label}<textarea readOnly={k==='original'} required={k!=='context'&&k!=='summary'} maxLength={k==='summary'?800:1200} value={draft[k]} onChange={e=>setDraft({...draft,[k]:e.target.value})} className={field}/></label>)}
     <label className="block text-sm">Affected module<select className={field} value={draft.module} onChange={e=>setDraft({...draft,module:e.target.value})}>{modules.map(m=><option key={m}>{m}</option>)}</select></label>
     <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed this draft and want to submit it to Product.</label>
     <button disabled={busy||!confirmed} className="tenops-selected-surface min-h-11 rounded px-3 disabled:opacity-50">Submit suggestion</button><button type="button" className="min-h-11 px-3" onClick={()=>setDraft(null)}>Cancel</button>
    </form>:null}
   </div>
   <form onSubmit={e=>{e.preventDefault();void ask();}} className="shrink-0 space-y-2 border-t border-slate-200 bg-white p-3">
    <label className="sr-only" htmlFor="tenbot-question">Your question</label>
    <textarea id="tenbot-question" disabled={busy} value={question} onChange={e=>setQuestion(e.target.value)} maxLength={1200} rows={2} className={field} placeholder="How do I…? Can I…?"/>
    <div className="flex flex-wrap gap-2"><button disabled={busy||!question.trim()} className="tenops-selected-surface min-h-11 rounded px-3 text-sm font-semibold disabled:opacity-50">{busy?'Working…':'Ask TenBot'}</button><button type="button" disabled={busy||(!question.trim()&&!messages.length)} onClick={()=>void makeDraft()} className="min-h-11 rounded border px-3 text-xs disabled:opacity-50">Draft a feature suggestion</button></div>
   </form>
  </>:<section className="tenbot-scroll flex-1 p-3" aria-label="Product feedback inbox">
   <div className="mb-3 flex flex-wrap gap-2 text-xs">
    <label className="min-w-0 flex-1">Status<select disabled={busy} className={field} value={filter} onChange={e=>{setFilter(e.target.value);void load(e.target.value,moduleFilter);}}><option value="">All statuses</option>{statuses.map(s=><option key={s}>{s}</option>)}</select></label>
    <label className="min-w-0 flex-1">Module<select disabled={busy} className={field} value={moduleFilter} onChange={e=>{setModuleFilter(e.target.value);void load(filter,e.target.value);}}><option value="">All modules</option>{modules.map(m=><option key={m}>{m}</option>)}</select></label>
    <button className="min-h-11 self-end rounded border px-2" disabled={busy} onClick={()=>void load()}>Refresh</button>
   </div>
   {!items.length?<p className="py-5 text-sm text-slate-500">{busy?'Loading feedback…':'No submissions match these filters.'}</p>:null}
   {items.map(item=><article key={item.id} className="mb-3 space-y-3 break-words rounded-lg border bg-white p-3">
    <h3 className="font-bold">{item.draft.capability}</h3><p className="text-xs text-slate-500">{item.submitter_name} · {item.created_at.slice(0,10)} · {item.draft.module} · {item.status}</p>
    {(['original','problem','desired','summary','context'] as const).map(k=><p key={k} className="whitespace-pre-wrap text-sm"><strong>{k==='summary'?item.draft.summaryKind+' summary':k}: </strong>{item.draft[k]||'—'}</p>)}
    <label className="block text-sm">Review note<textarea className={field} maxLength={1200} value={notes[item.id]||''} onChange={e=>setNotes({...notes,[item.id]:e.target.value})}/></label>
    <div className="flex flex-wrap gap-2">{statuses.filter(s=>s!==item.status).map(s=><button disabled={busy} key={s} className="min-h-11 rounded border px-2 text-xs" onClick={()=>void review(item.id,s)}>Mark {s}</button>)}</div>
    <details><summary className="min-h-11 cursor-pointer py-3 text-sm">Request history</summary>{item.history.map(h=><p key={h.id} className="py-1 text-xs">{h.created_at} · {h.status} · {h.note}</p>)}</details>
   </article>)}
  </section>}
 </section>;
}
