"use client";

import dynamic from "next/dynamic";
import { ChevronDown, Inbox, Send, Sparkles, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { isTenOpsSystemInboxUser, loadInboxRecipients, loadInboxUnreadCount, loadRecentInboxMessages, type RecentInboxMessage } from "@/modules/my-work/inbox";
import { loadWorkJobs } from "@/modules/my-work/queries";
import type { WorkCollaborator, WorkJob } from "@/modules/my-work/types";

const InboxDialog = dynamic(() => import("@/modules/my-work/InboxDialog"), { ssr: false });
const SIDEBAR_SESSION_KEY="tenops_global_message_sidebar";
const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(part=>part[0]?.toUpperCase()).join("")||"?";
const recentTime=(value:string)=>new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric"}).format(new Date(value));

class MessagingErrorBoundary extends Component<{ children: ReactNode; onClose(): void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Messaging presentation failed", error, info); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4"><section role="dialog" aria-modal="true" aria-label="Messaging unavailable" className="w-full max-w-lg border border-slate-300 bg-white p-4 shadow-2xl"><div className="flex items-center justify-between"><strong>Messaging unavailable</strong><button type="button" onClick={this.props.onClose} aria-label="Close Messaging" className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-300"><X className="h-5 w-5" /></button></div><p className="mt-4 text-sm text-slate-600">Messaging could not be displayed. The rest of TenOps remains available.</p></section></div>;
  }
}

export default function GlobalMessaging(){
  const auth=useAuth();
  const currentUserId=auth.profile?.userId??"";
  const pathname=usePathname();
  const menuRef=useRef<HTMLDivElement>(null);
  const recentRequestRef=useRef(false);
  const recentLoadedRef=useRef(false);
  const awarenessVisibleRef=useRef(false);
  const[modalOpen,setModalOpen]=useState(false);
  const[menuOpen,setMenuOpen]=useState(false);
  const[sidebarOpen,setSidebarOpen]=useState(false);
  const[sidebarExpanded,setSidebarExpanded]=useState(false);
  const[initialUserId,setInitialUserId]=useState("");
  const[unreadCount,setUnreadCount]=useState(0);
  const[recentMessages,setRecentMessages]=useState<RecentInboxMessage[]>([]);
  const[collaborators,setCollaborators]=useState<WorkCollaborator[]>([]);
  const[jobs,setJobs]=useState<WorkJob[]>([]);
  const[modalReady,setModalReady]=useState(false);
  const[recentLoading,setRecentLoading]=useState(false);
  const[error,setError]=useState("");
  const[headerPortalTarget,setHeaderPortalTarget]=useState<HTMLElement|null>(null);

  const refreshUnread=useCallback((userId:string)=>{if(!userId)return;void loadInboxUnreadCount(userId).then(setUnreadCount).catch(()=>{});},[]);
  const loadRecent=useCallback((force=false)=>{if(!currentUserId||recentRequestRef.current||(!force&&recentLoadedRef.current))return;recentRequestRef.current=true;setRecentLoading(true);setError("");void Promise.all([loadRecentInboxMessages(),recentLoadedRef.current?Promise.resolve(null):loadInboxRecipients()]).then(([messages,people])=>{setRecentMessages(messages);if(people)setCollaborators(people.filter(user=>user.userId!==currentUserId));recentLoadedRef.current=true;}).catch(caught=>setError(caught instanceof Error?caught.message:"Unable to load recent messages.")).finally(()=>{recentRequestRef.current=false;setRecentLoading(false);});},[currentUserId]);
  const prepareWorkspace=useCallback((onReady:()=>void)=>{setModalReady(false);setError("");void Promise.all([collaborators.length?Promise.resolve(collaborators):loadInboxRecipients(),loadWorkJobs()]).then(([people,nextJobs])=>{setCollaborators(people.filter(user=>user.userId!==currentUserId));setJobs(nextJobs);setModalReady(true);onReady();}).catch(caught=>setError(caught instanceof Error?caught.message:"Unable to load Messaging."));},[collaborators,currentUserId]);
  const openModal=useCallback((userId="")=>{setInitialUserId(userId);setSidebarExpanded(false);setModalOpen(true);setMenuOpen(false);prepareWorkspace(()=>{});},[prepareWorkspace]);
  const expandSidebar=()=>{setInitialUserId("");setModalOpen(false);setMenuOpen(false);setSidebarExpanded(true);prepareWorkspace(()=>{});};

  const conversations=useMemo(()=>{const grouped=new Map<string,RecentInboxMessage[]>();for(const message of recentMessages){const other=message.senderUserId===currentUserId?message.recipientUserId:message.senderUserId;grouped.set(other,[...(grouped.get(other)??[]),message]);}return[...grouped.entries()].map(([userId,messages])=>{const latest=messages[0];const isSystem=isTenOpsSystemInboxUser(userId);return{userId,name:isSystem?"TenOps":collaborators.find(user=>user.userId===userId)?.displayName??"TenOps user",isSystem,latest,unread:messages.filter(message=>message.recipientUserId===currentUserId&&!message.readAt).length};}).sort((left,right)=>new Date(right.latest.createdAt).getTime()-new Date(left.latest.createdAt).getTime());},[collaborators,currentUserId,recentMessages]);

  useEffect(()=>{refreshUnread(currentUserId);},[currentUserId,refreshUnread]);
  useEffect(()=>{const timer=window.setTimeout(()=>setHeaderPortalTarget(document.querySelector<HTMLElement>("[data-shell-header]")),0);return()=>window.clearTimeout(timer);},[]);
  useEffect(()=>{const timer=window.setTimeout(()=>setSidebarOpen(window.sessionStorage.getItem(SIDEBAR_SESSION_KEY)==="shown"),0);return()=>window.clearTimeout(timer);},[]);
  useEffect(()=>{awarenessVisibleRef.current=menuOpen||sidebarOpen;},[menuOpen,sidebarOpen]);
  useEffect(()=>{if(!currentUserId)return;const refresh=()=>{refreshUnread(currentUserId);if(awarenessVisibleRef.current)loadRecent(true);};const channel=supabase.channel(`global-messaging-badge:${currentUserId}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"my_work_messages",filter:`recipient_user_id=eq.${currentUserId}`},refresh).on("postgres_changes",{event:"UPDATE",schema:"public",table:"my_work_messages",filter:`recipient_user_id=eq.${currentUserId}`},refresh).subscribe();return()=>{void supabase.removeChannel(channel);};},[currentUserId,loadRecent,refreshUnread]);
  useEffect(()=>{const handleOpen=(event:Event)=>openModal((event as CustomEvent<{userId?:string}>).detail?.userId??"");window.addEventListener("tenops:open-inbox",handleOpen);return()=>window.removeEventListener("tenops:open-inbox",handleOpen);},[openModal]);
  useEffect(()=>{if(!menuOpen)return;const pointer=(event:PointerEvent)=>{if(!menuRef.current?.contains(event.target as Node))setMenuOpen(false);};const key=(event:KeyboardEvent)=>{if(event.key==="Escape")setMenuOpen(false);};document.addEventListener("pointerdown",pointer);document.addEventListener("keydown",key);return()=>{document.removeEventListener("pointerdown",pointer);document.removeEventListener("keydown",key);};},[menuOpen]);
  useEffect(()=>{if(!auth.profile?.isActive)return;const params=new URLSearchParams(window.location.search);if(params.get("inbox")!=="1"&&!params.get("inboxUserId"))return;const timer=window.setTimeout(()=>openModal(params.get("inboxUserId")??""),0);params.delete("inbox");params.delete("inboxUserId");const query=params.toString();window.history.replaceState({},"",`${window.location.pathname}${query?`?${query}`:""}${window.location.hash}`);return()=>window.clearTimeout(timer);},[auth.profile?.isActive,openModal,pathname]);

  if(!auth.isAuthenticated||!auth.profile?.isActive)return null;
  const showMenu=()=>{setMenuOpen(true);loadRecent();};
  const toggleSidebar=()=>{if(window.matchMedia("(max-width: 767px)").matches){openModal();return;}const next=!sidebarOpen;if(next)loadRecent();else setSidebarExpanded(false);setSidebarOpen(next);window.sessionStorage.setItem(SIDEBAR_SESSION_KEY,next?"shown":"hidden");setMenuOpen(false);};
  const recentList=(compact=false)=><>{recentLoading&&!conversations.length?<p className="px-4 py-6 text-center text-xs text-slate-500">Loading recent messages…</p>:conversations.slice(0,compact?10:4).map(conversation=><button key={conversation.userId} type="button" onClick={()=>openModal(conversation.userId)} className="flex w-full gap-2 border-b border-slate-200 px-3 py-3 text-left hover:bg-slate-50"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${conversation.isSystem?"tenops-selected-surface":"border-slate-300 bg-slate-50"}`}>{conversation.isSystem?<Sparkles className="h-3.5 w-3.5"/>:initials(conversation.name)}</span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><strong className="truncate text-xs">{conversation.name}</strong><time className="shrink-0 text-[9px] text-slate-400">{recentTime(conversation.latest.createdAt)}</time></span><span className="mt-1 flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-[11px] text-slate-500">{conversation.latest.body}</span>{conversation.unread?<span className="inline-flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">{conversation.unread}</span>:null}</span></span></button>)}{!recentLoading&&!conversations.length?<p className="px-4 py-6 text-center text-xs text-slate-500">No conversations yet.</p>:null}</>;

  return <>
    <div ref={menuRef} className="relative flex shrink-0" onMouseEnter={showMenu} onMouseLeave={()=>setMenuOpen(false)} onFocus={showMenu} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setMenuOpen(false);}}>
      <button type="button" onClick={()=>openModal()} aria-label="Messaging" title="Messaging" aria-haspopup="dialog" className={`relative inline-flex h-9 w-8 items-center justify-center text-slate-600 transition hover:bg-slate-200/40 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:h-10 sm:w-9 ${modalOpen?"bg-slate-100 text-blue-800":""}`}><Send className="h-4 w-4" aria-hidden="true"/>{unreadCount?<span aria-label={`${unreadCount} unread messages`} className="tenops-compact-type absolute right-0 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 font-bold leading-none text-white ring-2 ring-white">{unreadCount>99?"99+":unreadCount}</span>:null}</button>
      <button type="button" onClick={()=>{if(menuOpen)setMenuOpen(false);else showMenu();}} aria-label="Open Messaging menu" aria-expanded={menuOpen} aria-haspopup="menu" className="inline-flex h-9 w-5 items-center justify-center text-slate-500 hover:bg-slate-200/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:h-10"><ChevronDown className={`h-3 w-3 transition ${menuOpen?"rotate-180":""}`}/></button>
      <div className={`absolute right-0 top-full z-[110] w-[min(21rem,calc(100vw-1rem))] pt-1 transition ${menuOpen?"visible opacity-100":"invisible opacity-0"}`}><div role="menu" aria-label="Messaging menu" className="border border-slate-300 bg-white shadow-xl"><div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2"><Inbox className="h-4 w-4 text-blue-800"/><strong className="text-xs">Recent messages</strong>{unreadCount?<span className="ml-auto text-[10px] font-bold text-red-700">{unreadCount} unread</span>:null}</div>{error?<p role="alert" className="px-3 py-3 text-xs text-red-700">Recent messages unavailable.</p>:recentList()}<button role="switch" aria-checked={sidebarOpen} type="button" onClick={toggleSidebar} className="flex min-h-12 w-full items-center justify-between gap-3 border-t border-slate-200 px-3 text-left text-xs font-bold text-slate-700"><span className="md:hidden">Open full Messaging</span><span className="hidden md:inline">Message sidebar</span><span aria-hidden="true" className={`hidden h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition md:flex ${sidebarOpen?"justify-end bg-blue-700":"justify-start bg-slate-300"}`}><span className="h-5 w-5 rounded-full bg-white shadow-sm"/></span></button></div></div>
    </div>
    {headerPortalTarget&&sidebarOpen&&!sidebarExpanded?createPortal(<button type="button" onClick={expandSidebar} aria-label="Expand message sidebar" aria-expanded="false" className="tenops-selected-surface absolute inset-y-0 right-full z-[110] hidden w-14 items-center justify-center md:flex"><Send className="h-[23px] w-[23px]"/>{unreadCount?<span aria-label={`${unreadCount} unread messages`} className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white ring-2 ring-white">{unreadCount>9?"9+":unreadCount}</span>:null}<span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px" style={{backgroundColor:"#172033"}}/></button>,headerPortalTarget):null}
    {typeof document!=="undefined"&&sidebarOpen&&!sidebarExpanded?createPortal(<aside data-global-message-sidebar data-expanded="false" aria-hidden="true" className="tenops-selected-surface fixed inset-y-0 left-0 z-[90] hidden w-14 border-r border-blue-800/20 shadow-xl md:block"/>,document.body):null}
    {(modalOpen||sidebarExpanded)&&!modalReady?createPortal(<div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={event=>{if(event.target===event.currentTarget){setModalOpen(false);setSidebarExpanded(false);}}}><section role="dialog" aria-modal="true" aria-label="Messaging" className="w-full max-w-lg border border-slate-300 bg-white p-4 shadow-2xl"><div className="flex items-center justify-between"><strong>Messaging</strong><button type="button" onClick={()=>{setModalOpen(false);setSidebarExpanded(false);}} aria-label="Close Messaging" className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-300"><X className="h-5 w-5"/></button></div>{error?<p role="alert" className="mt-4 text-sm text-red-700">Messaging could not be loaded. The rest of TenOps remains available.</p>:<p className="mt-4 text-sm text-slate-500">Loading Messaging…</p>}</section></div>,document.body):null}
    {modalReady?<MessagingErrorBoundary key={sidebarExpanded?"sidepane":modalOpen?"modal":"closed"} onClose={()=>{setModalOpen(false);setSidebarExpanded(false);}}><InboxDialog open={modalOpen||sidebarExpanded} onClose={()=>{if(sidebarExpanded)setSidebarExpanded(false);else setModalOpen(false);}} currentUserId={currentUserId} collaborators={collaborators} jobs={jobs} initialUserId={initialUserId} onUnreadChange={count=>{setUnreadCount(count);if(menuOpen||sidebarOpen)loadRecent(true);}} presentation={sidebarExpanded?"sidepane":"dialog"}/></MessagingErrorBoundary>:null}
  </>;
}
