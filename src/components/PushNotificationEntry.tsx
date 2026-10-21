"use client";
import {useEffect,useState} from 'react';
import {useAuth} from '@/lib/auth';
import {supabase} from '@/lib/supabase';
import {clearNotification,pendingNotificationId,rememberNotification} from '@/lib/notification-entry';
import {hasLocalPushBinding,inspectPushDevice} from '@/lib/web-push';
import {openProductionJob} from '@/modules/production/job-options';
export default function PushNotificationEntry(){
 const auth=useAuth();const account=auth.accessAllowed?auth.profile?.userId:undefined;
 const[status,setStatus]=useState('');
 const[entrySignal,setEntrySignal]=useState(0);
 useEffect(()=>{
  if(!('serviceWorker' in navigator))return;
  const open=(event:MessageEvent)=>{
   if(event.origin!==window.location.origin||event.data?.type!=='tenops:push-open')return;
   const id=event.data.id;
   if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))return;
   rememberNotification(id);window.dispatchEvent(new Event('tenops:notification-entry'));setEntrySignal(value=>value+1);
  };
  navigator.serviceWorker.addEventListener('message',open);return()=>navigator.serviceWorker.removeEventListener('message',open);
 },[]);
 useEffect(()=>{
  const id=pendingNotificationId();if(id)rememberNotification(id);
  if(!account)return;
  let active=true;
  let request:AbortController|undefined;
  const refresh=()=>{if(hasLocalPushBinding(account))void inspectPushDevice(account);};refresh();window.addEventListener('focus',refresh);
  const resolve=async()=>{
   if(!id)return;
   // A cold mobile connection can fail its first read. Retry only transient
   // failures once; each attempt still resolves through the authenticated RPC.
   let data;
   for(let attempt=0;attempt<2;attempt++){
    if(!active)return;
    const session=await supabase.auth.getSession();if(!active||session.data.session?.user.id!==account)return;
    const pending=new AbortController();request=pending;
    const timeout=window.setTimeout(()=>pending.abort(),5000);
    let result;
    try{result=await supabase.rpc('resolve_my_push_notification',{p_id:id}).setHeader('Authorization',`Bearer ${session.data.session.access_token}`).abortSignal(pending.signal);}
    catch{result={data:null,error:true,status:0};}
    finally{window.clearTimeout(timeout);}
    const current=await supabase.auth.getSession();if(!active||current.data.session?.user.id!==account)return;
    if(!result.error){data=result.data;break;}
    const transient=result.status===0||result.status===408||result.status===429||result.status>=500;
    if(attempt===0&&transient)continue;
    setStatus('Unable to open this notification. Check your connection and retry.');return;
   }
   if(!data){setStatus('This notification is unavailable for this account or its content is no longer accessible.');return;}
   clearNotification();setStatus('');
   if(data.kind==='dm'&&typeof data.conversation_user_id==='string'){
    window.dispatchEvent(new CustomEvent('tenops:open-inbox',{detail:{userId:data.conversation_user_id}}));
   }else if(data.kind==='mention'&&data.job_id&&data.update_id)openProductionJob(data.job_id,`job-updates:${data.update_id}`);
  };
  const timer=window.setTimeout(()=>void resolve(),0);
  return()=>{active=false;request?.abort();window.clearTimeout(timer);window.removeEventListener('focus',refresh);};
 },[account,entrySignal]);
 return status&&account?<div role="status" className="fixed bottom-6 left-4 right-4 z-[130] border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950">{status}<div className="mt-2 flex gap-4"><button type="button" className="min-h-10 underline" onClick={()=>window.location.reload()}>Retry</button><button type="button" className="min-h-10 underline" onClick={()=>{clearNotification();setStatus('');}}>Dismiss</button></div></div>:null;
}
