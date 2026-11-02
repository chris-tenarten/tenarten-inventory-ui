'use client';

import dynamic from 'next/dynamic';
import {createPortal} from 'react-dom';
import {Component, useEffect, useState, type ReactNode} from 'react';
import {useAuth} from '@/lib/auth';
import {TenbotAvatar} from '@/modules/tenbot/TenbotAvatar';
import {MESSAGING_OPENED_EVENT, OPEN_TENBOT_WORKSPACE_EVENT} from '@/modules/tenbot/events';
import {CapabilityRequestSlot} from '@/modules/tenbot/capability-requests/CapabilityRequestSlot';
import '@/modules/tenbot/global-workspace.css';

const Workspace=dynamic(()=>import('@/modules/tenbot/GlobalTenbotWorkspace').then(module=>module.GlobalTenbotWorkspace),{ssr:false});

class AssistantBoundary extends Component<{children:ReactNode;open:boolean;onClose():void},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){
    if(!this.state.failed)return this.props.children;
    if(!this.props.open||typeof document==='undefined')return null;
    return createPortal(<div className="tenbot-global-overlay"><aside role="dialog" aria-label="TenBot unavailable" className="tenbot-global-panel p-5"><strong>TenBot couldn’t be displayed.</strong><p className="mt-2 text-sm text-slate-600">Your saved conversation is still available in Messaging.</p><button type="button" className="mt-4 min-h-11 rounded border px-4 text-sm" onClick={()=>{this.setState({failed:false});this.props.onClose();}}>Close TenBot</button></aside></div>,document.body);
  }
}

export default function GlobalTenbot(){
  const auth=useAuth();
  const [workspace,setWorkspace]=useState({open:false,activated:false});
  const owner=auth.user?.id;
  const available=auth.ready&&auth.isAuthenticated&&auth.accessAllowed&&auth.profile?.isActive&&auth.profile.userId===owner&&auth.can('readOperationalData');
  useEffect(()=>{
    const open=()=>{if(available)setWorkspace({open:true,activated:true});};
    const close=()=>setWorkspace(value=>({...value,open:false}));
    window.addEventListener(OPEN_TENBOT_WORKSPACE_EVENT,open);
    window.addEventListener(MESSAGING_OPENED_EVENT,close);
    return()=>{window.removeEventListener(OPEN_TENBOT_WORKSPACE_EVENT,open);window.removeEventListener(MESSAGING_OPENED_EVENT,close);};
  },[available]);
  if(!available||!owner)return null;
  const close=()=>setWorkspace(value=>({...value,open:false}));
  return <>
    <button type="button" data-tenbot-launcher aria-label="Open TenBot" title="TenBot assistant" aria-haspopup="dialog" aria-expanded={workspace.open} aria-controls={workspace.activated?'tenbot-global-workspace':undefined} onClick={()=>{if(workspace.open)close();else window.dispatchEvent(new Event(OPEN_TENBOT_WORKSPACE_EVENT));}} className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${workspace.open?'bg-blue-100 ring-1 ring-inset ring-blue-200':''}`}><TenbotAvatar className="h-7 w-7"/></button>
    {workspace.activated?<AssistantBoundary open={workspace.open} onClose={close}><Workspace open={workspace.open} onClose={close} ownerId={owner} capabilityRequest={<CapabilityRequestSlot ownerId={owner} accessKey={JSON.stringify(auth.profile)}/>}/></AssistantBoundary>:null}
  </>;
}
