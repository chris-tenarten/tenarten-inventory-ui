'use client';

import {Maximize2,Minimize2,Send,X} from 'lucide-react';
import {useCallback,useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore,type ReactNode,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {useDetailNavigation} from '@/components/mobile/useDetailNavigation';
import {TenbotAvatar} from './TenbotAvatar';
import {ActionInteractionProvider} from './actions/ActionReviewCard';
import {ActionWorkspaceSlot} from './actions/ActionWorkspaceBridge';
import {useTenbotConversation} from './TenbotWorkspace';
import './global-workspace.css';

const mobileQuery='(max-width: 767px), (max-width: 1023px) and (pointer: coarse)';
const subscribeMobile=(notify:()=>void)=>{
 const query=window.matchMedia(mobileQuery);
 query.addEventListener('change',notify);
 return()=>query.removeEventListener('change',notify);
};
const mobileSnapshot=()=>window.matchMedia(mobileQuery).matches;
const serverMobileSnapshot=()=>false;
const focusable=(element:HTMLElement)=>Array.from(element.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),textarea:not(:disabled),input:not(:disabled),select:not(:disabled),summary,[tabindex]:not([tabindex="-1"])')).filter(item=>item.getClientRects().length&&!item.closest('[hidden],[inert]'));

/** Mount the existing mobile Back boundary only while this surface is open. */
function MobileTenbotNavigation({onClose,closeRef}:{onClose():void;closeRef:RefObject<(()=>void)|null>}){
 const close=useDetailNavigation(()=>true,onClose);
 useLayoutEffect(()=>{closeRef.current=close;return()=>{closeRef.current=null;};},[close,closeRef]);
 return null;
}

/** Presentation only: the authenticated controller and text-draft store are shared with Messaging. */
export function GlobalTenbotWorkspace({open,onClose,ownerId,capabilityRequest}:{open:boolean;onClose():void;ownerId:string;capabilityRequest?:ReactNode}){
 const tenbot=useTenbotConversation();
 const mobile=useSyncExternalStore(subscribeMobile,mobileSnapshot,serverMobileSnapshot);
 const [expanded,setExpanded]=useState(false);
 const {text:body,setText:setBody,captureSend}=tenbot.composer;
 const overlayRef=useRef<HTMLDivElement>(null);
 const panelRef=useRef<HTMLElement>(null);
 const closeRef=useRef<HTMLButtonElement>(null);
 const mobileCloseRef=useRef<(()=>void)|null>(null);
 const composerRef=useRef<HTMLTextAreaElement>(null);
 const historyRef=useRef<HTMLDivElement>(null);
 const nearBottom=useRef(true);
 const sendLock=useRef(false);
 const modal=mobile||expanded;
 const requestClose=useCallback(()=>{if(mobileCloseRef.current)mobileCloseRef.current();else onClose();},[onClose]);

 const send=useCallback(async()=>{
  if(!open||!ownerId||!body.trim()||tenbot.busy||sendLock.current)return;
  sendLock.current=true;nearBottom.current=true;
  const sent=captureSend();
  try{if(await tenbot.send(body))sent();}finally{sendLock.current=false;}
 },[body,captureSend,open,ownerId,tenbot]);

 useEffect(()=>{
  if(!open)return;
  const viewport=window.visualViewport;
  const measure=()=>{
   overlayRef.current?.style.setProperty('--tenbot-visible-height',`${viewport?.height??window.innerHeight}px`);
   overlayRef.current?.style.setProperty('--tenbot-visible-top',`${viewport?.offsetTop??0}px`);
  };
  measure();viewport?.addEventListener('resize',measure);viewport?.addEventListener('scroll',measure);window.addEventListener('resize',measure);
  return()=>{viewport?.removeEventListener('resize',measure);viewport?.removeEventListener('scroll',measure);window.removeEventListener('resize',measure);};
 },[open]);

 useEffect(()=>{
  if(!open)return;
  const overlay=overlayRef.current;
  const active=document.activeElement;
  const previous=active instanceof HTMLElement&&!overlay?.contains(active)?active:document.querySelector<HTMLElement>('[data-tenbot-launcher]');
  closeRef.current?.focus({preventScroll:true});
  return()=>{requestAnimationFrame(()=>{if(previous?.isConnected&&(!overlay?.isConnected||overlay.hidden))previous.focus({preventScroll:true});});};
 },[open]);

 useEffect(()=>{
  if(!open||!modal)return;
  const body=document.body,root=document.documentElement;
  const panel=panelRef.current;
  const shell=document.querySelector<HTMLElement>('[data-app-shell]');
  const shellInert=shell?.inert??false;
  const shellHidden=shell?.getAttribute('aria-hidden');
  const x=window.scrollX,y=window.scrollY,path=window.location.pathname;
  const properties=['position','top','left','width','overflow','overscroll-behavior'] as const;
  const previous=properties.map(name=>[name,body.style.getPropertyValue(name),body.style.getPropertyPriority(name)] as const);
  const rootOverflow=root.style.getPropertyValue('overflow'),rootPriority=root.style.getPropertyPriority('overflow');
  body.style.setProperty('position','fixed');body.style.setProperty('top',`${-y}px`);body.style.setProperty('left',`${-x}px`);body.style.setProperty('width','100%');body.style.setProperty('overflow','hidden');body.style.setProperty('overscroll-behavior','none');root.style.setProperty('overflow','hidden');
  if(shell){shell.inert=true;shell.setAttribute('aria-hidden','true');}
  return()=>{
   const active=document.activeElement;
   if(active instanceof HTMLElement&&panel?.contains(active)&&active.matches('textarea,input,[contenteditable="true"]'))active.blur();
   for(const[name,value,priority]of previous)if(value)body.style.setProperty(name,value,priority);else body.style.removeProperty(name);
   if(rootOverflow)root.style.setProperty('overflow',rootOverflow,rootPriority);else root.style.removeProperty('overflow');
   if(shell){shell.inert=shellInert;if(shellHidden===null||shellHidden===undefined)shell.removeAttribute('aria-hidden');else shell.setAttribute('aria-hidden',shellHidden);}
   window.scrollTo(x,window.location.pathname===path?y:0);
  };
 },[modal,open]);

 useEffect(()=>{
  if(!open)return;
  const keydown=(event:KeyboardEvent)=>{
   if(event.defaultPrevented)return;
   if(event.key==='Escape'){event.preventDefault();requestClose();return;}
   if(event.key!=='Tab'||!modal||!panelRef.current)return;
   const elements=focusable(panelRef.current),first=elements[0],last=elements.at(-1);
   if(!first){event.preventDefault();panelRef.current.focus();return;}
   const active=document.activeElement;
   if(event.shiftKey&&(active===first||!panelRef.current.contains(active))){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&(active===last||!panelRef.current.contains(active))){event.preventDefault();first.focus();}
  };
  window.addEventListener('keydown',keydown);
  return()=>window.removeEventListener('keydown',keydown);
 },[modal,requestClose,open]);

 useLayoutEffect(()=>{
  const scroller=historyRef.current;
  if(scroller&&nearBottom.current)scroller.scrollTop=scroller.scrollHeight;
 },[tenbot.activityKey,open,expanded]);

 useLayoutEffect(()=>{
  const composer=composerRef.current;if(!composer||!open)return;
  const grow=()=>{
   const maximum=Math.min(160,Math.max(72,(window.visualViewport?.height??window.innerHeight)*.3));
   composer.style.height='auto';composer.style.height=`${Math.max(44,Math.min(composer.scrollHeight+2,maximum))}px`;composer.style.overflowY=composer.scrollHeight>maximum?'auto':'hidden';
  };
  grow();window.visualViewport?.addEventListener('resize',grow);window.addEventListener('resize',grow);
  return()=>{window.visualViewport?.removeEventListener('resize',grow);window.removeEventListener('resize',grow);};
 },[body,open]);

 if(typeof document==='undefined')return null;
 return createPortal(<div ref={overlayRef} hidden={!open} data-tenbot-global-overlay data-expanded={expanded?'true':undefined} data-modal={modal?'true':undefined} className="tenbot-global-overlay" onMouseDown={event=>{if(expanded&&!mobile&&event.target===event.currentTarget)requestClose();}}>
  {open&&mobile?<MobileTenbotNavigation onClose={onClose} closeRef={mobileCloseRef}/>:null}
  <section ref={panelRef} id="tenbot-global-workspace" role="dialog" aria-modal={modal||undefined} aria-labelledby="tenbot-global-title" tabIndex={-1} data-tenbot-global-workspace className="tenbot-global-panel">
   <header className="tenbot-global-header">
    <TenbotAvatar className="h-9 w-9 shrink-0"/>
    <div className="min-w-0 flex-1"><h2 id="tenbot-global-title" className="text-sm font-bold tracking-tight text-slate-950">TenBot</h2><p className="mt-0.5 truncate text-[11px] text-slate-500">Your private assistant</p></div>
    {open?<>{tenbot.disclosure}{tenbot.menu(body)}</>:null}
    <button type="button" onClick={()=>setExpanded(value=>!value)} aria-label={expanded?'Collapse TenBot workspace':'Expand TenBot workspace'} aria-expanded={expanded} title={expanded?'Return to side panel':'Expand workspace'} className="tenbot-global-icon tenbot-global-expand">{expanded?<Minimize2 className="h-4 w-4"/>:<Maximize2 className="h-4 w-4"/>}</button>
    <button ref={closeRef} type="button" onClick={requestClose} aria-label="Close TenBot" title="Close TenBot" className="tenbot-global-icon"><X className="h-5 w-5"/></button>
   </header>
   <div ref={historyRef} data-tenbot-global-history className="tenbot-global-history tenbot-scroll" onScroll={event=>{const element=event.currentTarget;nearBottom.current=element.scrollHeight-element.scrollTop-element.clientHeight<64;}}>
    {!tenbot.available?<p role="status" className="px-2 py-6 text-sm text-slate-600">TenBot is unavailable for this account.</p>:<>
     {!tenbot.entries.length&&!tenbot.busy?<div className="tenbot-global-empty"><p className="text-base font-semibold text-slate-900">What are you working on?</p><p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">Ask about a TenOps workflow or look up work you can access.</p><div className="mt-5 flex flex-wrap gap-2">{['What is in Production?','How do I find a Job?'].map(question=><button key={question} type="button" onClick={()=>{setBody(question);composerRef.current?.focus();}} className="min-h-11 rounded-md border border-slate-200 bg-white px-3 text-left text-xs font-medium text-slate-700 hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-blue-600">{question}</button>)}</div></div>:null}
     <ActionInteractionProvider active={open}><div role="log" aria-label="TenBot conversation" aria-live="polite">{tenbot.entries.map(entry=><div key={entry.id}>{entry.content}</div>)}</div></ActionInteractionProvider>
     <ActionInteractionProvider active={open}><ActionWorkspaceSlot onRequestCorrection={()=>composerRef.current?.focus()}/></ActionInteractionProvider>
     {capabilityRequest}
     {open?tenbot.controls(body):null}
    </>}
   </div>
   <div data-messaging-composer data-tenbot-global-composer className="tenbot-global-composer">
    {open?tenbot.attachmentStatus:null}
    <div role="status" aria-live="polite" className={tenbot.busy?'mb-2 text-[11px] text-slate-500':'sr-only'}>{tenbot.busy?tenbot.restoring?'Restoring conversation…':'TenBot is answering…':''}</div>
    <div className="flex items-end gap-2">{open?tenbot.attachmentControl:null}<textarea ref={composerRef} disabled={!tenbot.available||tenbot.busy} value={body} onChange={event=>setBody(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing&&event.keyCode!==229){event.preventDefault();if(!event.repeat)void send();}}} maxLength={1200} rows={1} enterKeyHint="send" aria-label="Message" aria-describedby="tenbot-global-composer-help" placeholder="Ask TenBot about TenOps…" className="min-h-11 min-w-0 flex-1 resize-none rounded-md border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-700 disabled:bg-slate-50 sm:text-sm"/><button type="button" onClick={()=>void send()} disabled={!tenbot.available||tenbot.busy||!body.trim()} aria-label="Send" title="Send message" className="tenops-selected-surface flex h-11 w-11 shrink-0 items-center justify-center rounded-md border disabled:opacity-40"><Send className="h-4 w-4"/></button></div>
    <p id="tenbot-global-composer-help" className="mt-2 text-[10px] text-slate-500">Enter to send · Shift+Enter for a new line</p>
   </div>
  </section>
 </div>,document.body);
}
