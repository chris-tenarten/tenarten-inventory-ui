'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Info,MoreHorizontal,Paperclip,X} from 'lucide-react';
import {useAuth} from '@/lib/auth';
import {supabase} from '@/lib/supabase';
import {ReceivalDraftReview} from './ReceivalDraftReview';
import {localAgentExperimentRequested,localReceivalCandidateRequested,prepareInvoiceImage,receivalExecutionBlock,receivalReviewNotice,type LocalDemoStatus,type LocalAttachment,type LocalReceivalDraft,type LocalApproval,type LocalOrderDetails,type LocalRowEdit} from './live-review';
type Source={id:string;title:string;status:string;guidance:string;path:string;route:string|null;source:string;availability?:string;constraints?:string[]};
type Answer={conversationId?:string;mode:string;message:string;resolution?:'available'|'partial'|'unavailable'|'permission-denied'|'documentation-missing';sources:Source[];snapshot:{revision:string;verifiedAt:string};summary:string|null;fallback?:boolean;notices?:string[];suggestionAllowed?:boolean;operational?:{observedAt:string|null;complete:boolean;truncated:boolean;facts:{id:string;text:string}[];refreshable:boolean}};
type Draft={capability:string;problem:string;desired:string;module:string;original:string;summary:string;summaryKind:string;context:string};
type Feedback={id:string;submitter_name:string;status:string;created_at:string;draft:Draft;history:{id:number;status:string;note:string;created_at:string}[]};
type Usage={sharedDayLimit:number;sharedDayUsed:number;sharedDayRemaining:number;sharedMonthLimit:number;sharedMonthUsed:number;sharedMonthRemaining:number;perAccountMinuteLimit:number;dayNeuronLimit:number;dayAccountedNeurons:number;monthNeuronLimit:number;monthAccountedNeurons:number;dayMeasuredInputTokens:number;dayMeasuredOutputTokens:number;dayUnmeasuredAttempts:number};
type AgentClaim={text:string;evidence_ids:string[]};
type AgentView={mode:'offline-scripted'|'openai';provider:string;model:string;status:string;durationMs:number;executionAvailable:false;final:{observations:AgentClaim[];inferences:AgentClaim[];recommendations:AgentClaim[];questions:string[];completed_actions:[]}|null;proposals:{evidenceId:string;tool:string;proposal:Record<string,unknown>}[];evidence:{id:string;tool:string;data:unknown}[];trace:{event:string;name?:string;outcome:string;durationMs:number}[];usage:{inputTokens:number;outputTokens:number;costUsd:number;reservedUsd:number}};
type ExperimentalAnswer=Answer&{agent?:AgentView;localDemo?:{simulation:boolean;draft:LocalReceivalDraft|null;attachment?:{id:string;filename:string;mediaType:string}}};
const objectValue=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const rowsValue=(value:unknown):Record<string,unknown>[]=>Array.isArray(value)?value.map(objectValue):[];
const displayValue=(value:unknown)=>value===null||value===undefined||value===''?'—':String(value);
const answerNotices=(answer:Answer)=>[...new Set(answer.notices)].filter(note=>!answer.message.includes(note)&&!(answer.mode==='guide'&&answer.sources[0]&&guideText(answer.sources[0]).includes(note))).map(note=><p key={note} className="text-xs text-slate-600">{note}</p>);
function AgentReview({agent,liveDemo=false,simulation=true,diagnostics=false}:{agent:AgentView;liveDemo?:boolean;simulation?:boolean;diagnostics?:boolean}){
 return <section aria-label="Experimental operational answer" className="space-y-3 border-t border-slate-200 pt-3">
  {diagnostics?<p className="text-xs text-slate-500">{liveDemo?simulation?'Live OpenAI reasoning · Simulated local records · No Production writes':'Local OpenAI candidate · Caller-scoped TenOps records · Review required':<>{agent.mode==='offline-scripted'?'Scripted transport demonstration · no model inference':'Local OpenAI experiment'} · No execution capability</>}</p>:null}
  {([['observations','Recorded observations'],['inferences','Interpretations'],['recommendations','Suggested next steps']] as const).map(([key,label])=>agent.final?.[key].length?<section key={key}><p className="font-medium">{label}</p><ul className="list-disc space-y-1 pl-5">{agent.final[key].map((claim,index)=><li key={index}>{claim.text} <span className="text-xs text-slate-500">({claim.evidence_ids.join(', ')})</span></li>)}</ul></section>:null)}
  {agent.final?.questions.length?<section><p className="font-medium">Information needed</p><ul className="list-disc space-y-1 pl-5">{agent.final.questions.map((question,index)=><li key={index}>{question}</li>)}</ul></section>:null}
  {!liveDemo&&agent.proposals.map(({evidenceId,proposal})=>{
   const ready=rowsValue(proposal.ready_lines),held=rowsValue(proposal.held_lines),excluded=rowsValue(proposal.excluded_lines),missing=Array.isArray(proposal.missing_employee_confirmations)?proposal.missing_employee_confirmations:[];
   return <section key={evidenceId} aria-label="Pending receival proposals" className="space-y-2 rounded border border-slate-300 p-3">
    <p className="font-semibold">Pending receival proposals · Review only</p><p>{displayValue(proposal.supplier)} · {displayValue(proposal.document_reference)}</p>
    <p className="text-xs">{ready.length} matched lines · {held.length} held · {excluded.length} excluded. Review against the synthetic document. Pending entries do not count as on-hand stock.</p>
    {missing.length?<p className="rounded bg-slate-50 p-2 text-xs text-slate-600">Missing employee order details: {missing.map(String).join(', ')}. These proposals remain incomplete.</p>:null}
    <div className="max-w-full overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-1">Material / size</th><th className="p-1">Quantity</th><th className="p-1">Order details</th></tr></thead><tbody>{ready.map((line,index)=>{const row=objectValue(line.proposal);return <tr key={index} className="border-t"><td className="p-1">{displayValue(row.material_name)} / {displayValue(row.size)}</td><td className="p-1">{displayValue(row.quantity_expected)} {displayValue(row.unit)}</td><td className="p-1">{displayValue(row.ordered_by)} · {displayValue(row.order_date)} · {displayValue(row.location)}</td></tr>;})}</tbody></table></div>
    {held.length?<ul className="list-disc space-y-1 pl-5 text-xs">{held.map((line,index)=><li key={index}>{displayValue(objectValue(line.extracted).description)}: {Array.isArray(line.reasons)?line.reasons.map(String).join(', ').replaceAll('_',' '):'Needs clarification'}</li>)}</ul>:null}
    {excluded.length?<p className="text-xs">Excluded: {excluded.map(line=>displayValue(line.reason)).join(', ')}.</p>:null}
    <p className="text-xs font-medium">No rows created. Employee approval and a separately authorized execution service would be required.</p>
   </section>;
  })}
  <p className="text-xs font-medium">{liveDemo?simulation?'Production database actions: none.':'This model response does not authorize or complete database actions.':'Completed database actions: none.'}</p>
  <details className="text-xs text-slate-600"><summary className="min-h-9 cursor-pointer py-2">{diagnostics?'Evidence and developer measurements':'Supporting evidence'}</summary>
   {diagnostics?<><p>{agent.provider} · {agent.model} · {agent.status}</p><p>Elapsed {(agent.durationMs/1000).toFixed(2)} s · {agent.trace.filter(row=>row.event==='tool').length} tool attempts · {agent.usage.inputTokens} input / {agent.usage.outputTokens} output tokens · ${agent.usage.costUsd.toFixed(4)} accounted</p>
   <p>{agent.mode==='offline-scripted'?'Scripted timings measure local orchestration only. ':'Measured model inference and local tool time. '}Source references support provenance; free prose and interpretations still require review.</p></>:null}
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
 const {localAgentExperiment,localReceivalExecution,...payload}=body;
 const experiment=typeof window!=='undefined'&&window.location.origin==='http://localhost:3000'&&localAgentExperiment===true;
 const endpoint=experiment?(localReceivalExecution===true?'http://localhost:55596':'http://localhost:55595'):process.env.NEXT_PUBLIC_TENBOT_REVIEW_URL||(localFixture?'http://localhost:55593':undefined);
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
export type TenbotConversation={available:boolean;busy:boolean;send:(question:string)=>Promise<boolean>;history:ReactNode;entries:AssistantEntry[];controls:(question:string)=>ReactNode;menu:(question:string)=>ReactNode;disclosure:ReactNode;attachmentControl:ReactNode;attachmentStatus:ReactNode;activityKey:string};
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
 const [experiment,setExperiment]=useState(false),[authenticatedExperiment,setAuthenticatedExperiment]=useState(false),[developerDiagnostics,setDeveloperDiagnostics]=useState(false);
 const [orderDetails,setOrderDetails]=useState({orderedBy:'',orderDate:'',location:''});
 const [experimentStatus,setExperimentStatus]=useState<LocalDemoStatus|null>(null),[syntheticConfirmed,setSyntheticConfirmed]=useState(false);
 const [attachment,setAttachment]=useState<LocalAttachment|null>(null),[attachmentPreview,setAttachmentPreview]=useState('');
 const [selectedAttachment,setSelectedAttachment]=useState<File|null>(null);
 const [attachmentOrigin,setAttachmentOrigin]=useState<{originalFilename:string;renderedPdf:boolean}|null>(null);
 const [receivalDraft,setReceivalDraft]=useState<LocalReceivalDraft|null>(null),[localApproval,setLocalApproval]=useState<LocalApproval|null>(null);
 const authenticatedReceivals=experiment&&authenticatedExperiment;
 const liveDemo=experiment&&(authenticatedExperiment||experimentStatus?.mode==='synthetic-live'||experimentStatus?.mode==='authenticated-receivals');
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
 const privacyRef=useRef<HTMLDetailsElement>(null);
 const attachmentInput=useRef<HTMLInputElement>(null);
 const drafting=Boolean(draft);
 const lastAnswer=messages.at(-1)?.answer;
 const accessFingerprint=JSON.stringify(auth.profile);
 const currentAccess=useRef(accessFingerprint);currentAccess.current=accessFingerprint;
 useEffect(()=>{
  const closeOutside=(event:PointerEvent)=>{const popup=privacyRef.current;if(popup?.open&&event.target instanceof Node&&!popup.contains(event.target))popup.open=false;};
  window.addEventListener('pointerdown',closeOutside);
  return()=>window.removeEventListener('pointerdown',closeOutside);
 },[]);
 useEffect(()=>{
  let current=true;setExperiment(false);setAuthenticatedExperiment(false);setDeveloperDiagnostics(window.location.origin==='http://localhost:3000'&&new URLSearchParams(window.location.search).get('tenbotDiagnostics')==='1');setExperimentStatus(null);setOrderDetails({orderedBy:'',orderDate:'',location:''});setAttachment(null);setSelectedAttachment(null);setAttachmentPreview('');setAttachmentOrigin(null);setReceivalDraft(null);setLocalApproval(null);setSyntheticConfirmed(false);
  void supabase.auth.getSession().then(async({data})=>{if(!current||data.session?.user.id!==owner)return;const authenticated=Boolean(data.session.access_token),enabled=localAgentExperimentRequested(window.location.origin,window.location.search,authenticated),receivals=localReceivalCandidateRequested(window.location.origin,window.location.search,authenticated);setExperiment(enabled);setAuthenticatedExperiment(receivals);if(enabled){try{const status=await invoke<LocalDemoStatus>({action:'status',localAgentExperiment:true,localReceivalExecution:receivals},owner);if(receivals&&(status.mode!=='authenticated-receivals'||status.simulation!==false))throw new Error('The authenticated receivals server returned an incompatible mode.');if(current&&currentOwner.current===owner)setExperimentStatus(status);}catch(error){if(current)setError(receivals?`Authenticated database unavailable; writes disabled. ${error instanceof Error?error.message:'Reopen TenBot after the isolated database is available.'}`:'The local experiment is unavailable. Reopen TenBot after its server is ready.');}}});
  return()=>{current=false;};
 },[owner]);
 useEffect(()=>{
  // Live facts have no client persistence or reusable response cache.
  liveTurn.current=null;setMessages([]);setReceivalDraft(null);setLocalApproval(null);setAttachment(null);setSelectedAttachment(null);setAttachmentPreview('');setAttachmentOrigin(null);
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
   const result=await invoke<T&{conversationId?:string}>({...body,...(chat&&conversation.current.id?{conversationId:conversation.current.id}:{}),...(experiment?{localAgentExperiment:true,localReceivalExecution:authenticatedExperiment}:{})},owner);
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
  if(experiment&&!experimentStatus){setError('The local experiment is not ready. Reopen TenBot after its server is ready.');return false;}
  if(!current||current.length>1200||lock.current)return false;
  let turnAttachment=attachment;
  if(selectedAttachment){
   if(!syntheticConfirmed){setError('Confirm the attachment contains approved synthetic test data before sending.');return false;}
   const uploaded=await uploadInvoice(selectedAttachment);
   if(!uploaded)return false;
   turnAttachment=uploaded;
  }
  if(!begin())return false;
  const requestAccess=currentAccess.current;
  setNotice('');
  const previous=messages.at(-1);
  // Retrying an unsuccessful send updates that turn instead of duplicating it.
  const retry=previous?.error&&previous.question===current?previous:undefined;
  const turn:Turn={id:retry?.id??++sequence.current,question:current,createdAt:retry?.createdAt??new Date().toISOString(),answer:null};
  liveTurn.current=null;
  setMessages(m=>[...m.filter(item=>item.id!==turn.id).slice(-7).map(item=>item.answer?.operational||item.answer?.agent?{...item,answer:null,error:'Live Job facts are refreshed for each request.'}:item),turn]);
  try{
   const response=await request<ExperimentalAnswer>({action:'ask',question:current,context:context(),...(liveDemo?{...(turnAttachment?{attachmentId:turnAttachment.attachmentId}:{}),orderDetails}:experiment?{demoScenario:'job-investigation',orderDetails}:{})});
   if(currentOwner.current!==owner||currentAccess.current!==requestAccess)return false;
   if(response.operational)liveTurn.current={id:turn.id,owner};
   if((response.operational||response.agent)&&(!foreground.current||document.visibilityState!=='visible'))return true;
   if(liveDemo){setReceivalDraft(response.localDemo?.draft??null);setLocalApproval(null);}
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
   if(conversation.current.id||attachment)await request({action:'clear',...(conversation.current.id?{conversationId:conversation.current.id}:{}),...(attachment?{attachmentId:attachment.attachmentId}:{})});
   conversation.current={owner};setMessages([]);setDraft(null);setError('');setNotice('');setAttachment(null);setSelectedAttachment(null);setAttachmentPreview('');setAttachmentOrigin(null);setReceivalDraft(null);setLocalApproval(null);setOrderDetails({orderedBy:'',orderDate:'',location:''});setSyntheticConfirmed(false);
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
 async function uploadInvoice(file:File):Promise<LocalAttachment|undefined>{
  if(!liveDemo||!syntheticConfirmed||!experimentStatus||experimentStatus.canPrepare===false||!begin())return;
  const requestAccess=currentAccess.current;
  try{
   const prepared=await prepareInvoiceImage(file,experimentStatus.maxAttachmentBytes);
   if(currentOwner.current!==owner||currentAccess.current!==requestAccess)return;
   const uploaded=await request<LocalAttachment>({action:'upload',syntheticConfirmed:true,attachment:{filename:prepared.filename,mediaType:prepared.mediaType,dataBase64:prepared.dataBase64}});
   if(currentOwner.current!==owner||currentAccess.current!==requestAccess)return;
   setAttachment(uploaded);setSelectedAttachment(null);setAttachmentPreview(prepared.preview);setAttachmentOrigin({originalFilename:prepared.originalFilename,renderedPdf:prepared.renderedPdf});setReceivalDraft(null);setLocalApproval(null);setMessages([]);conversation.current={owner};
   setNotice(`${prepared.originalFilename} attached.`);
   return uploaded;
  }catch(e){setError(e instanceof Error?e.message:'The attachment could not be uploaded.');}finally{finish();}
 }
 async function saveReceivalReview(edits:LocalRowEdit[],details:LocalOrderDetails){
  if(authenticatedReceivals&&edits.some(row=>!row.excluded&&row.catalogRequest)){
   setError('Combined catalog-material and pending-receival creation is not available in the authenticated review. This proposal can only be reviewed and approved in the simulated local experiment; no records were created.');
   setLocalApproval(null);return;
  }
  if(authenticatedReceivals&&edits.some(row=>!row.excluded&&row.duplicateAcknowledgement)){
   setError('Duplicate acknowledgement is available only for simulated review. Real duplicate protection cannot be overridden here.');setLocalApproval(null);return;
  }
  if(!liveDemo||!receivalDraft||!begin())return;
  const requestAccess=currentAccess.current;
  try{
   // The real service accepts only existing-material edits. Proposal metadata,
   // including explicit nulls and excluded local requests, stays outside its RPC.
   const reviewedEdits=authenticatedReceivals?edits.map(row=>{const existing={...row};delete existing.catalogRequest;delete existing.duplicateAcknowledgement;return existing;}):edits;
   const value=await request<{draft:LocalReceivalDraft;simulation:boolean}>({action:'review',draftId:receivalDraft.id,revision:receivalDraft.revision,edits:reviewedEdits,orderDetails:details});
   if(currentOwner.current!==owner||currentAccess.current!==requestAccess)return;
   setReceivalDraft(value.draft);setLocalApproval(null);setOrderDetails(value.draft.orderDetails);setNotice(value.simulation&&experimentStatus?receivalReviewNotice(value.draft,{...experimentStatus,canCreateCatalog:available&&auth.can('writeBusinessData')&&auth.can('manageVendorsCatalog')&&experimentStatus.canCreateCatalog!==false}):value.draft.durableDraftId&&value.draft.durableHash?'This exact draft was saved for durable server review. Check all current lines before approval.':'Draft changes reviewed. Durable database review remains required before execution.');
  }catch(e){setError(e instanceof Error?e.message:'The draft could not be reviewed.');}finally{finish();}
 }
 async function approveReceivalReview(current:LocalReceivalDraft){
  if(!liveDemo||!experimentStatus||receivalExecutionBlock(current,experimentStatus)||receivalDraft?.id!==current.id||receivalDraft.revision!==current.revision||receivalDraft.hash!==current.hash||!current.canApprove||!begin())return;
  const requestAccess=currentAccess.current;
  try{
   const value=await request<LocalApproval>({action:'approve',draftId:current.id,revision:current.revision,hash:current.hash,...(!current.simulation?{durableDraftId:current.durableDraftId,durableHash:current.durableHash}:{}),confirmation:true});
   if(currentOwner.current!==owner||currentAccess.current!==requestAccess)return;
   setReceivalDraft(value.draft);setLocalApproval(value);setNotice(value.simulation?value.catalogAdditions?.length?'Simulated catalog additions and dependent pending receivals approved locally. No catalog or receival records were created.':'Simulated pending receivals approved locally. No catalog or receival records were created.':`${value.idempotent?value.receivals.length:value.createdCount} pending receivals ${value.idempotent?'already created':'created'} through your authorized TenOps access. Review the returned record IDs below.`);
  }catch(e){setError(e instanceof Error?e.message:'The pending entries could not be approved.');}finally{finish();}
 }
 const entries:AssistantEntry[]=available?messages.flatMap(m=>[{id:`assistant-question-${m.id}`,createdAt:m.createdAt,content:<article className="relative mb-3 ml-auto max-w-[88%] rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">{m.question}</div>
    <time className="mt-1 block text-[10px] text-slate-400">{messageTime(m.createdAt)}</time>
   </article>},{id:`assistant-answer-${m.id}`,createdAt:m.answeredAt??m.createdAt,content:<article aria-label="TenBot assistant reply" className="relative mb-3 max-w-[88%] space-y-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
    <p className="text-xs font-semibold text-slate-600">TenBot · Assistant</p>
    {m.answer?<>
     {m.answer.mode==='guide'?<p className="text-xs text-slate-500">{m.answer.fallback?"AI is unavailable right now. Here’s guidance from the TenOps Guide.":"Here’s what I found in the TenOps Guide."}</p>:null}
     <p data-tenbot-answer className="whitespace-pre-wrap break-words leading-relaxed text-slate-800">{m.answer.mode==='guide'&&m.answer.sources[0]?guideText(m.answer.sources[0]):m.answer.message}</p>
     {m.answer.agent?<details className="text-xs text-slate-600"><summary className="min-h-9 cursor-pointer py-2">Sources and evidence</summary><AgentReview agent={m.answer.agent} liveDemo={liveDemo} simulation={!authenticatedReceivals} diagnostics={developerDiagnostics}/>{answerNotices(m.answer)}</details>:answerNotices(m.answer)}
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
    {messages.length||draft||attachment||receivalDraft?<button type="button" disabled={busy} onClick={()=>{closeMenu();void clear();}} className="block min-h-11 w-full rounded px-3 text-left text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">Clear assistant chat</button>:null}
    {!offerSuggestion&&!reviewAllowed&&!messages.length&&!draft&&!attachment&&!receivalDraft?<p className="px-3 py-2 text-xs text-slate-500">Ask TenBot to start a conversation.</p>:null}
   </div>
  </details>;
 };
 const disclosure=<details ref={privacyRef} className="relative shrink-0 text-slate-500" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(privacyRef.current){privacyRef.current.open=false;privacyRef.current.querySelector('summary')?.focus();}}}}>
  <summary aria-label="About TenBot AI" title="About TenBot AI" className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-blue-500 [&::-webkit-details-marker]:hidden"><Info className="h-4 w-4" aria-hidden="true"/></summary>
  <div role="note" aria-label="TenBot AI privacy" className="absolute right-0 top-full z-40 mt-1 max-h-[min(24rem,60dvh)] w-72 max-w-[calc(100vw-3rem)] overflow-y-auto rounded-md border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-600 shadow-lg">
   <p>TenBot uses AI to help answer questions and process attachments. Submitted content may be processed by OpenAI. Your TenOps permissions still apply.</p>
   <details className="mt-2"><summary className="min-h-9 cursor-pointer py-2 text-slate-500">More privacy details</summary><p>{authenticatedReceivals?'This local candidate sends only the approved test attachment image, submitted questions and narrowly authorized catalog/Job tool results to OpenAI. Documents are untrusted input and cannot grant permissions or approve actions. A one-page PDF is rendered locally without OCR or text extraction. Reads use your authenticated TenOps access. Review and explicit approval are separate from model reasoning; execution remains disabled until database-backed release gates pass. No personal ChatGPT context is connected.':liveDemo?'This local demo sends the approved synthetic attachment image and questions you submit to OpenAI for actual inference. A one-page PDF is rendered locally into an image without offline OCR or text extraction. Operational records, catalog matches and approved pending entries are simulated locally. No Production records are read or written, and real database authorization/RLS is not validated by this demonstration.':'When AI is available, text you submit, recent private TenBot turns and limited authorized Production facts are processed by the configured AI provider. Job lookups use your current access. Live answers are refreshed for each request and are not saved in assistant history. TenBot does not independently read private messages, personal tasks or financial information. Other private TenBot history expires after eight hours without a new turn.'}</p></details>
  </div>
 </details>;
 const attachmentControl=available&&liveDemo?<>
  <input ref={attachmentInput} aria-label="TenBot attachment file" tabIndex={-1} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={busy||!experimentStatus||experimentStatus.canPrepare===false} className="hidden" onChange={event=>{
   const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(!file)return;
   setError('');
   if(!['application/pdf','image/jpeg','image/png'].includes(file.type)){setError('Choose a PNG, JPEG or one-page PDF invoice.');return;}
   if(file.size>12000000){setError('Choose an invoice attachment smaller than 12 MB.');return;}
   setSelectedAttachment(file);setSyntheticConfirmed(false);
  }}/>
  <button type="button" aria-label="Attach PDF or image" title="Attach PDF, JPG or PNG" disabled={busy||!experimentStatus||experimentStatus.canPrepare===false} onClick={()=>attachmentInput.current?.click()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40"><Paperclip className="h-4 w-4" aria-hidden="true"/></button>
 </>:null;
 const attachmentName=selectedAttachment?.name||attachmentOrigin?.originalFilename||attachment?.filename;
 const attachmentStatus=available&&liveDemo&&attachmentName?<div className="mb-2 space-y-1" aria-label="TenBot attachment">
  <div className="flex min-w-0 items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5"><Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true"/><bdi title={attachmentName} className="min-w-0 flex-1 truncate text-xs">{attachmentName}</bdi><span className="shrink-0 text-[10px] text-slate-500">{selectedAttachment?'Ready to send':'Attached'}</span><button type="button" disabled={busy} aria-label={`Remove ${attachmentName}`} title={selectedAttachment?'Remove attachment':'Remove attachment and clear its conversation'} onClick={()=>{if(selectedAttachment){setSelectedAttachment(null);setSyntheticConfirmed(false);}else void clear();}} className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-slate-600 hover:bg-slate-200 disabled:opacity-40"><X className="h-4 w-4" aria-hidden="true"/></button></div>
  {selectedAttachment?<><label className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" disabled={busy} checked={syntheticConfirmed} onChange={event=>setSyntheticConfirmed(event.target.checked)}/>I confirm this attachment contains approved synthetic test data.</label><p className="text-[10px] text-slate-500">Add a message, then Send to process this attachment. One-page PDF, JPG or PNG · up to 12 MB.</p></>:null}
 </div>:null;
 const controls=():ReactNode=>{
  if(!available)return null;
  return <div className="space-y-3" data-tenbot-controls>
   {authenticatedReceivals&&experimentStatus?.executionEnabled!==true?<p role="status" className="text-xs text-slate-600">Real pending-receival creation is disabled in this local review.</p>:null}
   {experiment&&developerDiagnostics?<section aria-label="TenBot developer diagnostics" className="rounded border border-slate-200 p-2 text-xs text-slate-500"><p>{authenticatedReceivals?'Authenticated local candidate':'Local agent candidate'} · {experimentStatus?.mode||'Checking status'}</p>{experimentStatus?.blockedReason?<p>{experimentStatus.blockedReason}</p>:null}</section>:null}
   {liveDemo?<>
     {attachment?<details className="rounded border border-slate-200 bg-white p-2"><summary className="min-h-11 cursor-pointer py-2">Attachment preview · {attachmentOrigin?.originalFilename||attachment.filename}</summary>{attachmentOrigin?.renderedPdf?<p className="mb-2 text-xs text-slate-600">PDF page rendered for actual OpenAI vision; no offline OCR.</p>:null}{attachmentPreview?<>
      {/* Native image preserves an owner-local data URL without remote optimization. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={attachmentPreview} alt={`Uploaded test invoice: ${attachment.filename}`} className="mx-auto max-h-[32rem] max-w-full object-contain"/>
     </>:null}<p className="mt-2 text-xs text-slate-600">This is the image sent for interpretation. Only your submitted attachment is used.</p></details>:null}
     {attachment&&!receivalDraft?<details className="text-xs text-slate-600"><summary className="min-h-9 cursor-pointer py-2">Order details (optional)</summary><div className="space-y-2"><p>Leave unknown values blank. Invoice date does not automatically supply the order date.</p>{([['orderedBy','Ordered by'],['orderDate','Order date'],['location','Destination location']] as const).map(([key,label])=><label key={key} className="block">{label}<input aria-label={label} disabled={busy} type={key==='orderDate'?'date':'text'} maxLength={120} value={orderDetails[key]} onChange={event=>setOrderDetails(value=>({...value,[key]:event.target.value}))} className="min-h-11 w-full rounded border bg-white p-2"/></label>)}</div></details>:null}
   </>:null}
   {liveDemo&&receivalDraft&&experimentStatus?<ReceivalDraftReview key={`${receivalDraft.id}:${receivalDraft.revision}:${receivalDraft.hash}:${receivalDraft.status}`} draft={receivalDraft} status={experimentStatus} busy={busy} approval={localApproval} onDetails={setOrderDetails} onEdit={()=>{setError('');setNotice('');}} onReview={saveReceivalReview} onApprove={approveReceivalReview} canRequestCatalogMaterial={available&&auth.can('writeBusinessData')&&auth.can('manageVendorsCatalog')} canAcknowledgeDuplicates={available&&auth.can('writeBusinessData')&&auth.can('adjustInventory')}/>:null}
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
 return {available,busy,send,history,entries,controls,menu,disclosure,attachmentControl,attachmentStatus,activityKey:`${messages.length}:${messages.at(-1)?.id??0}:${busy}:${drafting}:${showFeedback}:${error}:${notice}:${attachment?.attachmentId??''}:${receivalDraft?.id??''}:${receivalDraft?.revision??''}:${receivalDraft?.status??''}`};
}
