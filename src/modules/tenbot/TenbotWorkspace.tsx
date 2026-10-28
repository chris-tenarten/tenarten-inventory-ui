'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {MoreHorizontal} from 'lucide-react';
import {useAuth} from '@/lib/auth';
import {supabase} from '@/lib/supabase';
type Source={id:string;title:string;status:string;guidance:string;path:string;route:string|null;source:string;availability?:string;constraints?:string[]};
type Answer={conversationId?:string;mode:string;message:string;resolution?:'available'|'partial'|'unavailable'|'permission-denied'|'documentation-missing';sources:Source[];snapshot:{revision:string;verifiedAt:string};summary:string|null;fallback?:boolean;notices?:string[];suggestionAllowed?:boolean;operational?:{observedAt:string|null;complete:boolean;truncated:boolean;facts:{id:string;text:string}[];refreshable:boolean}};
type Draft={capability:string;problem:string;desired:string;module:string;original:string;summary:string;summaryKind:string;context:string};
type Feedback={id:string;submitter_name:string;status:string;created_at:string;draft:Draft;history:{id:number;status:string;note:string;created_at:string}[]};
type Usage={sharedDayLimit:number;sharedDayUsed:number;sharedDayRemaining:number;sharedMonthLimit:number;sharedMonthUsed:number;sharedMonthRemaining:number;perAccountMinuteLimit:number;dayNeuronLimit:number;dayAccountedNeurons:number;monthNeuronLimit:number;monthAccountedNeurons:number;dayMeasuredInputTokens:number;dayMeasuredOutputTokens:number;dayUnmeasuredAttempts:number};
type AgentClaim={text:string;evidence_ids:string[]};
type AgentView={mode:'offline-scripted'|'openai';provider:string;model:string;status:string;durationMs:number;executionAvailable:false;final:{observations:AgentClaim[];inferences:AgentClaim[];recommendations:AgentClaim[];questions:string[];completed_actions:[]}|null;proposals:{evidenceId:string;tool:string;proposal:Record<string,unknown>}[];evidence:{id:string;tool:string;data:unknown}[];trace:{event:string;name?:string;outcome:string;durationMs:number}[];usage:{inputTokens:number;outputTokens:number;costUsd:number;reservedUsd:number}};
type ExperimentalAnswer=Answer&{agent?:AgentView};
const objectValue=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const rowsValue=(value:unknown):Record<string,unknown>[]=>Array.isArray(value)?value.map(objectValue):[];
const displayValue=(value:unknown)=>value===null||value===undefined||value===''?'—':String(value);
function AgentReview({agent}:{agent:AgentView}){
 return <section aria-label="Experimental operational answer" className="space-y-3 border-t border-slate-200 pt-3">
  <p className="rounded bg-amber-50 p-2 text-xs text-amber-900">{agent.mode==='offline-scripted'?'Scripted transport demonstration · no model inference':'Local OpenAI experiment'} · No execution capability</p>
  {([['observations','Recorded observations'],['inferences','Interpretations'],['recommendations','Suggested next steps']] as const).map(([key,label])=>agent.final?.[key].length?<section key={key}><p className="font-medium">{label}</p><ul className="list-disc space-y-1 pl-5">{agent.final[key].map((claim,index)=><li key={index}>{claim.text} <span className="text-xs text-slate-500">({claim.evidence_ids.join(', ')})</span></li>)}</ul></section>:null)}
  {agent.final?.questions.length?<section><p className="font-medium">Information needed</p><ul className="list-disc space-y-1 pl-5">{agent.final.questions.map((question,index)=><li key={index}>{question}</li>)}</ul></section>:null}
  {agent.proposals.map(({evidenceId,proposal})=>{
   const ready=rowsValue(proposal.ready_lines),held=rowsValue(proposal.held_lines),excluded=rowsValue(proposal.excluded_lines),missing=Array.isArray(proposal.missing_employee_confirmations)?proposal.missing_employee_confirmations:[];
   return <section key={evidenceId} aria-label="Pending receival proposals" className="space-y-2 rounded border border-slate-300 p-3">
    <p className="font-semibold">Pending receival proposals · Review only</p><p>{displayValue(proposal.supplier)} · {displayValue(proposal.document_reference)}</p>
    <p className="text-xs">{ready.length} matched lines · {held.length} held · {excluded.length} excluded. Review against the synthetic document. Pending entries do not count as on-hand stock.</p>
    {missing.length?<p className="rounded bg-amber-50 p-2 text-xs">Missing employee order details: {missing.map(String).join(', ')}. These proposals remain incomplete.</p>:null}
    <div className="max-w-full overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-1">Material / size</th><th className="p-1">Quantity</th><th className="p-1">Order details</th></tr></thead><tbody>{ready.map((line,index)=>{const row=objectValue(line.proposal);return <tr key={index} className="border-t"><td className="p-1">{displayValue(row.material_name)} / {displayValue(row.size)}</td><td className="p-1">{displayValue(row.quantity_expected)} {displayValue(row.unit)}</td><td className="p-1">{displayValue(row.ordered_by)} · {displayValue(row.order_date)} · {displayValue(row.location)}</td></tr>;})}</tbody></table></div>
    {held.length?<ul className="list-disc space-y-1 pl-5 text-xs">{held.map((line,index)=><li key={index}>{displayValue(objectValue(line.extracted).description)}: {Array.isArray(line.reasons)?line.reasons.map(String).join(', ').replaceAll('_',' '):'Needs clarification'}</li>)}</ul>:null}
    {excluded.length?<p className="text-xs">Excluded: {excluded.map(line=>displayValue(line.reason)).join(', ')}.</p>:null}
    <p className="text-xs font-medium">No rows created. Employee approval and a separately authorized execution service would be required.</p>
   </section>;
  })}
  <p className="text-xs font-medium">Completed database actions: none.</p>
  <details className="text-xs text-slate-600"><summary className="min-h-9 cursor-pointer py-2">Experiment evidence and measurements</summary>
   <p>{agent.provider} · {agent.model} · {agent.status}</p><p>Elapsed {(agent.durationMs/1000).toFixed(2)} s · {agent.trace.filter(row=>row.event==='tool').length} tool attempts · {agent.usage.inputTokens} input / {agent.usage.outputTokens} output tokens · ${agent.usage.costUsd.toFixed(4)} accounted</p>
   <p>Scripted timings measure local orchestration only. Source references support provenance; free prose and interpretations still require review.</p>
   {agent.evidence.map(item=><details key={item.id} className="border-t py-1"><summary className="min-h-9 cursor-pointer py-2">{item.id} · {item.tool}</summary><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all text-[10px]">{JSON.stringify(item.data,null,2)}</pre></details>)}
  </details>
 </section>;
}
const statuses=['New','Needs Clarification','Under Consideration','Backlogged','Declined','Shipped'];
const modules=['General','Messaging','My Work','Intake','Production','Inventory','Purchasing','Contacts','Settings'];
const field='min-h-11 w-full rounded border border-slate-300 bg-white px-3 py-2 text-base';
const routeLabels:Record<string,string>={'/':'Production','/my-work':'My Work','/settings':'Settings','/contacts':'Contacts','/production':'Production','/manpower-reporting':'Manpower Reporting','/inventory':'Inventory','/activity':'Inventory Activity','/samples':'Samples','/proposals':'Proposals'};
async function invoke<T>(body:Record<string,unknown>,owner:string):Promise<T>{
 const {data:sessionData}=await supabase.auth.getSession();
 if(!owner||sessionData.session?.user.id!==owner)throw new Error('Your account changed. Reopen TenBot to continue.');
 // Existing loopback fixture tokens cannot authenticate to hosted Supabase.
 // Keep the review adapter usable when another local task rebuilds the shared export.
 const localFixture=typeof window!=='undefined'&&window.location.origin==='http://localhost:3000'&&sessionData.session?.access_token.endsWith('.local');
 // The owner-scoped controller selects this mode once. Route changes must not
 // silently send experimental questions to the ordinary Qwen adapter.
 const {localAgentExperiment,...payload}=body;
 const experiment=localFixture&&localAgentExperiment===true;
 const endpoint=experiment?'http://localhost:55595':process.env.NEXT_PUBLIC_TENBOT_REVIEW_URL||(localFixture?'http://localhost:55593':undefined);
 if(endpoint&&typeof window!=='undefined'&&window.location.hostname==='localhost'){
 const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${sessionData.session?.access_token||''}`},body:JSON.stringify(payload),signal:AbortSignal.timeout(experiment?100000:35000)});const value=await r.json();if(!r.ok)throw new Error(value.error||'TenBot unavailable.');return value;
 }
 const {data,error}=await supabase.functions.invoke('tenbot',{body:payload,headers:{Authorization:`Bearer ${sessionData.session.access_token}`},signal:AbortSignal.timeout(35000)});
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
type Turn={id:number;question:string;createdAt:string;answeredAt?:string;answer:ExperimentalAnswer|null;error?:string};
type AssistantEntry={id:string;createdAt:string;content:ReactNode};
export type TenbotConversation={available:boolean;busy:boolean;send:(question:string)=>Promise<boolean>;history:ReactNode;entries:AssistantEntry[];controls:(question:string)=>ReactNode;menu:(question:string)=>ReactNode;disclosure:ReactNode;activityKey:string};
const messageTime=(value:string)=>new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(new Date(value));
const guideText=(source:Source)=>source.guidance.replace('in the deployed TenOps capability snapshot','in the TenOps Guide');
const sourceStatus=(source:Source)=>source.availability==='unavailable'?'Not enabled':source.availability==='partial'?'Partly available':source.status==='deployed'?'Available':source.status==='local'?'Unreleased':source.status==='planned'?'Planned / deferred':'Unable to verify';
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
 const [experiment,setExperiment]=useState(false),[demoScenario,setDemoScenario]=useState('job-investigation'),[invoiceAttached,setInvoiceAttached]=useState(false);
 const [orderDetails,setOrderDetails]=useState({orderedBy:'',orderDate:'',location:''});
 const [notes,setNotes]=useState<Record<string,string>>({});
 const lock=useRef(false),sequence=useRef(0);
 const conversation=useRef<{owner:string;id?:string}>({owner});
 const currentOwner=useRef(owner);currentOwner.current=owner;
 const liveTurn=useRef<{id:number;owner:string}|null>(null);
 const liveRefresh=useRef(false);
 const foreground=useRef(true);
 if(conversation.current.owner!==owner)conversation.current={owner};
 const draftForm=useRef<HTMLFormElement>(null);
 const menuRef=useRef<HTMLDetailsElement>(null);
 const drafting=Boolean(draft);
 const lastAnswer=messages.at(-1)?.answer;
 const accessFingerprint=JSON.stringify(auth.profile);
 const currentAccess=useRef(accessFingerprint);currentAccess.current=accessFingerprint;
 useEffect(()=>{
  let current=true;setExperiment(false);setInvoiceAttached(false);setOrderDetails({orderedBy:'',orderDate:'',location:''});
  void supabase.auth.getSession().then(({data})=>{if(current&&data.session?.user.id===owner)setExperiment(window.location.origin==='http://localhost:3000'&&new URLSearchParams(window.location.search).get('tenbotExperiment')==='1'&&Boolean(data.session.access_token.endsWith('.local')));});
  return()=>{current=false;};
 },[owner]);
 useEffect(()=>{
  // Live facts have no client persistence or reusable response cache.
  liveTurn.current=null;setMessages([]);
 },[owner,available,accessFingerprint]);
 useEffect(()=>{
  const invalidate=()=>setMessages(turns=>turns.map(turn=>turn.answer?.operational||turn.answer?.agent?{...turn,answer:null,error:'Live Job facts need refreshing.'}:turn));
  const refresh=async()=>{
   const live=liveTurn.current,id=conversation.current.id;
   if(!available||!live||live.owner!==owner||!id||!foreground.current||document.visibilityState!=='visible'||liveRefresh.current||lock.current)return;
   liveRefresh.current=true;invalidate();
   try{
    const result=await invoke<Answer&{expired?:boolean}>({action:'refresh-job',conversationId:id},owner);
    if(currentOwner.current!==live.owner||liveTurn.current?.id!==live.id||!foreground.current||document.visibilityState!=='visible')return;
    if(result.expired){liveTurn.current=null;return;}
    setMessages(turns=>turns.map(turn=>turn.id===live.id?{...turn,answer:result,error:undefined}:turn));
   }catch{invalidate();}finally{liveRefresh.current=false;}
  };
  const blur=()=>{foreground.current=false;invalidate();};
  const visibility=()=>{if(document.visibilityState!=='visible')blur();else{foreground.current=true;void refresh();}};
  const focus=()=>{foreground.current=true;void refresh();};
  window.addEventListener('blur',blur);window.addEventListener('focus',focus);document.addEventListener('visibilitychange',visibility);
  const timer=window.setInterval(()=>void refresh(),30000);
  return()=>{clearInterval(timer);window.removeEventListener('blur',blur);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',visibility);};
 },[owner,available]);
 useEffect(()=>{
  if(drafting&&draftForm.current?.getClientRects().length){
   draftForm.current.scrollIntoView({block:'nearest'});
   draftForm.current.querySelector('textarea')?.focus({preventScroll:true});
  }
 },[drafting]);
 const context=()=>[`Current module: ${currentModule.label}`];
 const request=async<T,>(body:Record<string,unknown>)=>{
  const chat=body.action==='ask'||body.action==='draft';
  try{
   const result=await invoke<T&{conversationId?:string}>({...body,...(chat&&conversation.current.id?{conversationId:conversation.current.id}:{}),...(experiment?{localAgentExperiment:true}:{})},owner);
   if(chat&&conversation.current.owner===owner&&result.conversationId)conversation.current.id=result.conversationId;
   return result;
  }catch(e){
   if(e instanceof Error&&/^Conversation (unavailable|changed)/.test(e.message)&&conversation.current.owner===owner)conversation.current={owner};
   throw e;
  }
 };
 function begin(){if(!available||lock.current)return false;lock.current=true;setBusy(true);setError('');return true;}
 function finish(){lock.current=false;setBusy(false);}
 async function send(question:string):Promise<boolean>{
  const current=question.trim();
  if(!current||current.length>1200||!begin())return false;
  const requestAccess=currentAccess.current;
  setNotice('');
  const previous=messages.at(-1);
  // Retrying an unsuccessful send updates that turn instead of duplicating it.
  const retry=previous?.error&&previous.question===current?previous:undefined;
  const turn:Turn={id:retry?.id??++sequence.current,question:current,createdAt:retry?.createdAt??new Date().toISOString(),answer:null};
  liveTurn.current=null;
  setMessages(m=>[...m.filter(item=>item.id!==turn.id).slice(-7).map(item=>item.answer?.operational||item.answer?.agent?{...item,answer:null,error:'Live Job facts are refreshed for each request.'}:item),turn]);
  try{
   const response=await request<ExperimentalAnswer>({action:'ask',question:current,context:context(),...(experiment?{demoScenario,...(invoiceAttached?{invoiceId:'synthetic-invoice-1042'}:{}),orderDetails}:{})});
   if(currentOwner.current!==owner||currentAccess.current!==requestAccess)return false;
   if(response.operational)liveTurn.current={id:turn.id,owner};
   if((response.operational||response.agent)&&(!foreground.current||document.visibilityState!=='visible'))return true;
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
  try{const r=await request<Answer>({action:'draft',question:original,context:context()});setDraft({capability:'',problem:'',desired:'',module:currentModule.module,original:'',summary:r.summary||'',summaryKind:r.summary?'AI-generated':'Employee-written',context:''});setConfirmed(false);}
  catch(e){setError(e instanceof Error?e.message:'Draft unavailable.');}finally{finish();}
 }
 async function submit(){
  if(!draft||!confirmed||!begin())return;
  try{await request({action:'submit',draft,confirmed});setDraft(null);setConfirmed(false);setNotice('Suggestion submitted to Product. It has not been approved or added to the roadmap.');}
  catch(e){setError(e instanceof Error?e.message:'Submission failed.');}finally{finish();}
 }
 function editDraft(key:keyof Draft,value:string){
  if(!draft)return;
  setDraft({...draft,[key]:value,...(key==='summary'?{summaryKind:'Employee-written'}:{})});setConfirmed(false);
 }
 async function clear(){
  if(!begin())return;
  try{
   if(conversation.current.id)await request({action:'clear',conversationId:conversation.current.id});
   conversation.current={owner};setMessages([]);setDraft(null);setError('');setNotice('');
  }catch{setError('TenBot could not clear this conversation. Retry.');}finally{finish();}
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
     {m.answer.mode==='guide'?<p className="text-xs text-slate-500">{m.answer.fallback?"AI is unavailable right now. Here’s guidance from the TenOps Guide.":"Here’s what I found in the TenOps Guide."}</p>:null}
     <p data-tenbot-answer className="whitespace-pre-wrap break-words leading-relaxed text-slate-800">{m.answer.mode==='guide'&&m.answer.sources[0]?guideText(m.answer.sources[0]):m.answer.message}</p>
     {m.answer.agent?<AgentReview agent={m.answer.agent}/>:null}
     {[...new Set(m.answer.notices)].filter(note=>!m.answer?.message.includes(note)&&!(m.answer?.mode==='guide'&&m.answer.sources[0]&&guideText(m.answer.sources[0]).includes(note))).map(note=><p key={note} className="text-xs text-slate-600">{note}</p>)}
     {!m.answer.sources.length&&m.answer.mode==='guide'?<p>The TenOps Guide does not have enough verified information to confirm that workflow. Please check with Product.</p>:null}
     {m.answer.sources.length?<details data-tenbot-sources className="text-xs">
      <summary aria-label="Sources for this answer" className="w-fit min-h-9 cursor-pointer py-2 text-slate-500">Sources ({m.answer.sources.length}) · TenOps Guide</summary>
      <div aria-label="Answer sources" className="space-y-3 border-t border-slate-100 pt-2">
      {m.answer.sources.map(s=><div key={s.id} data-tenbot-source className="space-y-2 border-l border-slate-200 pl-3 text-slate-600">
        <p><strong className="font-medium text-slate-700">{s.title}</strong><span className="ml-2 text-[10px] text-slate-500">{sourceStatus(s)}</span></p>
        <p className="whitespace-pre-wrap leading-relaxed">{guideText(s)}</p>
        {s.path?<p className="font-medium">{s.path}</p>:null}
        {s.route?<Link className="inline-block min-h-11 py-3 font-semibold text-blue-800 underline" href={s.route}>Open {routeLabels[s.route]||'workflow'}</Link>:null}
      </div>)}
      </div>
     </details>:null}
     {m.answer.operational?<details data-tenbot-records className="text-xs text-slate-600">
      <summary className="w-fit min-h-9 cursor-pointer py-2">Production records · {m.answer.operational.complete?'Verified scope':'Partial information'}</summary>
      {m.answer.operational.observedAt?<p>Checked {new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(m.answer.operational.observedAt))}</p>:null}
      <div className="space-y-1 border-t border-slate-100 pt-2">{m.answer.operational.facts.map(fact=><p key={fact.id}>{fact.text}</p>)}</div>
      {m.answer.operational.truncated?<p>Some records could not be included. Incomplete totals are not presented as exact.</p>:null}
     </details>:null}
    </>:m.error?.startsWith('Live Job facts')?<p className="text-xs text-slate-500">Ask again to refresh this live answer.</p>:m.error?<p role="alert" className="text-red-800">{m.error} TenBot could not answer. Use Send to retry.</p>:<p role="status" className="text-slate-500">Working…</p>}
    {m.answeredAt?<time className="block text-[10px] text-slate-400">{messageTime(m.answeredAt)}</time>:null}
   </article>}]):[];
 const history=available?<div role="log" aria-label="TenBot conversation" aria-live="polite">{entries.map(entry=><div key={entry.id}>{entry.content}</div>)}</div>:null;
 const menu=(question:string):ReactNode=>{
  if(!available)return null;
  const offerSuggestion=Boolean(question.trim())||Boolean(lastAnswer?.suggestionAllowed)||Boolean(lastAnswer?.sources.length&&lastAnswer.sources[0].status!=='unknown'&&lastAnswer.resolution!=='documentation-missing'&&lastAnswer.resolution!=='permission-denied');
  const closeMenu=()=>{if(menuRef.current){menuRef.current.open=false;menuRef.current.querySelector('summary')?.focus();}};
  return <details ref={menuRef} className="relative" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeMenu();menuRef.current?.querySelector('summary')?.focus();}}}>
   <summary aria-label="TenBot conversation actions" className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded text-slate-500 hover:bg-slate-100 [&::-webkit-details-marker]:hidden"><MoreHorizontal className="h-4 w-4"/></summary>
   <div className="absolute right-0 z-30 mt-1 min-w-52 rounded-md border border-slate-300 bg-white p-1 shadow-lg">
    {offerSuggestion&&!experiment?<button type="button" disabled={busy} onClick={()=>{closeMenu();void makeDraft(question);}} className="block min-h-11 w-full rounded px-3 text-left text-sm hover:bg-slate-50 disabled:opacity-50">Draft a feature suggestion</button>:null}
    {reviewAllowed&&!experiment?<button type="button" disabled={busy} aria-expanded={showFeedback} onClick={()=>{closeMenu();setShowFeedback(value=>!value);if(!showFeedback)void load();}} className="block min-h-11 w-full rounded px-3 text-left text-sm hover:bg-slate-50 disabled:opacity-50">Product feedback</button>:null}
    {messages.length||draft?<button type="button" disabled={busy} onClick={()=>{closeMenu();void clear();}} className="block min-h-11 w-full rounded px-3 text-left text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">Clear assistant chat</button>:null}
    {!offerSuggestion&&!reviewAllowed&&!messages.length&&!draft?<p className="px-3 py-2 text-xs text-slate-500">Ask TenBot to start a conversation.</p>:null}
   </div>
  </details>;
 };
 const disclosure=<details className="text-[10px] text-slate-500">
  <summary className="w-fit min-h-9 cursor-pointer py-2">AI may process your text and recent TenBot turns · Privacy details</summary>
  <p className="pb-2 text-xs leading-relaxed">When AI is available, text you submit, recent private TenBot turns and limited authorized Production facts are processed by the configured AI provider. Job lookups use your current access. Live answers are refreshed for each request and are not saved in assistant history. TenBot does not independently read private messages, personal tasks or financial information. Other private TenBot history expires after eight hours without a new turn.</p>
 </details>;
 const controls=():ReactNode=>{
  if(!available)return null;
  return <div className="space-y-3" data-tenbot-controls>
   {experiment?<details className="rounded border border-amber-200 bg-amber-50 p-2 text-xs" aria-label="Local agent experiment controls"><summary className="min-h-9 cursor-pointer py-2 font-medium">Local agent experiment · Synthetic data · No execution</summary>
    <p>Offline mode uses explicitly selected scripted test responses. OpenAI requires server credentials and separate spending authorization. Existing Production Qwen is unchanged.</p>
    <label className="mt-2 block">Scripted test scenario<select aria-label="Scripted test scenario" disabled={busy} value={demoScenario} onChange={event=>setDemoScenario(event.target.value)} className="min-h-11 w-full rounded border bg-white p-2"><option value="job-investigation">Job investigation</option><option value="invoice-preparation">Invoice preparation</option><option value="tool-recovery">Tool failure recovery</option></select></label>
    <button type="button" disabled={busy} onClick={()=>setInvoiceAttached(true)} className="mt-2 min-h-11 rounded border bg-white px-3">{invoiceAttached?'Synthetic invoice attached':'Attach synthetic invoice'}</button>
    {invoiceAttached?<div className="mt-2 space-y-2"><p>SYNTHETIC-supplier-invoice-1042.txt. Text fixture only; no photo/PDF interpretation is claimed.</p><p>Enter reviewed order details for this draft. Leave unknown values blank. These fields do not approve database writes.</p>{([['orderedBy','Ordered by'],['orderDate','Order date'],['location','Destination location']] as const).map(([key,label])=><label key={key} className="block">{label}<input aria-label={label} type={key==='orderDate'?'date':'text'} maxLength={120} value={orderDetails[key]} onChange={event=>setOrderDetails(value=>({...value,[key]:event.target.value}))} className="min-h-11 w-full rounded border bg-white p-2"/></label>)}</div>:null}
   </details>:null}
   {error?<p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>:null}
   {notice?<p role="status" className="rounded bg-green-50 px-3 py-2 text-sm">{notice}</p>:null}
   {draft?<form ref={draftForm} onSubmit={e=>{e.preventDefault();void submit();}} className="space-y-3 rounded-lg border bg-white p-3" aria-label="Feature suggestion draft">
    <h3 className="font-bold">Review your suggestion</h3><p className="text-xs text-slate-600">Submitter: {identity}. Only this reviewed draft is shared with Product.</p>
    <p className="text-sm text-slate-600">Only the fields you review and confirm here are shared with Product. Your private conversation and pasted context are not attached.</p>
    {([['capability','Requested capability'],['problem','Current workflow or problem'],['desired','Desired behavior'],['context','Optional context and frequency'],['original','Request wording to share'],['summary',draft.summaryKind+' summary']] as const).map(([k,label])=><label key={k} className="block text-sm">{label}<textarea required={k!=='context'&&k!=='summary'} maxLength={k==='summary'?800:1200} value={draft[k]} onChange={e=>editDraft(k,e.target.value)} className={field}/></label>)}
    <label className="block text-sm">Affected module<select className={field} value={draft.module} onChange={e=>editDraft('module',e.target.value)}>{modules.map(m=><option key={m}>{m}</option>)}</select></label>
    <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed this draft and want to submit it to Product.</label>
    <button disabled={busy||!confirmed} className="tenops-selected-surface min-h-11 rounded px-3 disabled:opacity-50">Submit suggestion</button><button type="button" className="min-h-11 px-3" onClick={()=>setDraft(null)}>Cancel</button>
   </form>:null}
   {reviewAllowed&&showFeedback?<section aria-label="Product feedback inbox" className="space-y-3 rounded border bg-white p-3">
    <section aria-label="Shared TenBot usage" className="space-y-1 rounded border bg-slate-50 p-3 text-xs">
     <h3 className="font-semibold">Shared AI usage</h3>
     {usage?<><p>{usage.sharedDayUsed} of {usage.sharedDayLimit} shared attempts used today · {usage.sharedDayRemaining} remaining.</p><p>{usage.sharedMonthUsed} of {usage.sharedMonthLimit} shared attempts used this month.</p><p>Resets at midnight UTC. Burst limit: {usage.perAccountMinuteLimit} per minute per account.</p><p>Internal daily inference budget: {Number(usage.dayAccountedNeurons).toLocaleString()} of {Number(usage.dayNeuronLimit).toLocaleString()} Neurons. Monthly: {Number(usage.monthAccountedNeurons).toLocaleString()} of {Number(usage.monthNeuronLimit).toLocaleString()}.</p><p>Measured tokens today: {Number(usage.dayMeasuredInputTokens).toLocaleString()} input / {Number(usage.dayMeasuredOutputTokens).toLocaleString()} output. Token-derived Neurons are estimates; {usage.dayUnmeasuredAttempts} unmeasured attempts retain conservative reservations. These internal limits are separate from Cloudflare’s actual account usage and do not enable paid inference.</p></>:<p>{usageError||'Loading usage…'}</p>}
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
 return {available,busy,send,history,entries,controls,menu,disclosure,activityKey:`${messages.length}:${messages.at(-1)?.id??0}:${busy}:${drafting}:${showFeedback}:${error}:${notice}`};
}
