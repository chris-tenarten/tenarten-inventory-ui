import { useCallback, useEffect, useRef, useState } from 'react';
import { loadMessagePage, type InboxMessage, type MessageCursor } from '../inbox';

export function mergeMessages(current:InboxMessage[],rows:InboxMessage[],removed:string[]=[]){
  const map=new Map(current.filter(row=>!removed.includes(row.id)).map(row=>[row.id,row]));
  for(const row of rows)map.set(row.id,row);
  return [...map.values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
}
/** One serial authoritative stream per mounted conversation; old requests cannot affect a new peer. */
export function useConversation(peer:string,onError:(message:string)=>void){
  const [messages,setMessages]=useState<InboxMessage[]>([]);const [loading,setLoading]=useState(false);const [hasOlder,setHasOlder]=useState(false);
  const state=useRef<{peer:string;alive:boolean;tail:Promise<void>;cursor?:MessageCursor;older:boolean;pending:Set<string>;scheduled:boolean;ids:Set<string>;timer?:ReturnType<typeof setTimeout>}>({peer:'',alive:false,tail:Promise.resolve(),older:false,pending:new Set(),scheduled:false,ids:new Set<string>()});
  const enqueue=useCallback((task:(s:typeof state.current)=>Promise<void>)=>{
    const s=state.current;if(!s.alive)return Promise.resolve();
    s.tail=s.tail.then(async()=>{if(s.alive)await task(s);}).catch(error=>{if(s.alive)onError(error instanceof Error?error.message:'Unable to load conversation.');});return s.tail;
  },[onError]);
  const refresh=useCallback(()=>enqueue(async s=>{
    setLoading(true);try{const rows=await loadMessagePage(s.peer);if(!s.alive)return;setMessages(rows);s.ids=new Set(rows.map(row=>row.id));s.cursor=rows[0];s.older=rows.length===40;setHasOlder(s.older);}finally{if(s.alive)setLoading(false);}
  }),[enqueue]);
  useEffect(()=>{
    const s:typeof state.current={peer,alive:!!peer,tail:Promise.resolve(),cursor:undefined,older:false,pending:new Set<string>(),scheduled:false,ids:new Set<string>()};state.current=s;
    setMessages([]);setHasOlder(false);if(peer)void refresh();
    return()=>{s.alive=false;s.pending.clear();clearTimeout(s.timer);};
  },[peer,refresh]);
  const reconcile=useCallback((id:string,existingOnly=false)=>{
    if(!/^[0-9a-f-]{36}$/i.test(id))return;
    const s=state.current;if(!s.alive||(existingOnly&&!s.ids.has(id)))return;s.pending.add(id);if(s.scheduled)return;s.scheduled=true;
    s.timer=setTimeout(()=>{s.scheduled=false;if(!s.alive)return;const ids=[...s.pending];s.pending.clear();
      void enqueue(async current=>{if(current!==s)return;for(let i=0;i<ids.length;i+=40){const batch=ids.slice(i,i+40);const rows=await loadMessagePage(s.peer,undefined,batch);if(!s.alive)return;for(const id of batch)s.ids.delete(id);for(const row of rows)s.ids.add(row.id);setMessages(existing=>mergeMessages(existing,rows,batch.filter(id=>!rows.some(row=>row.id===id))));}});
    },60);
  },[enqueue]);
  const older=useCallback(()=>enqueue(async s=>{
    if(!s.older||!s.cursor)return;
    setLoading(true);try{const rows=await loadMessagePage(s.peer,s.cursor);if(!s.alive)return;s.cursor=rows[0]??s.cursor;s.older=rows.length===40;setHasOlder(s.older);for(const row of rows)s.ids.add(row.id);setMessages(existing=>mergeMessages(existing,rows));}finally{if(s.alive)setLoading(false);}
  }),[enqueue]);
  return {messages:state.current.peer===peer?messages:[],setMessages,loading,hasOlder,older,refresh,reconcile};
}
