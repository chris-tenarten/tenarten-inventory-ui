'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import type {WorkTask,WorkTaskGroup} from './types';

type TaskSnapshot={userId:string;tasks:WorkTask[];groups:WorkTaskGroup[];loading:boolean;error:boolean};

/** Same participant overview as My Work; no reads until the employee chooses a task view. */
export function useCalendarTasks(enabled:boolean,userId:string){
  const [snapshot,setSnapshot]=useState<TaskSnapshot>({userId:'',tasks:[],groups:[],loading:false,error:false});
  const refreshRef=useRef<(()=>Promise<void>)|null>(null);
  const refresh=useCallback(async()=>{await refreshRef.current?.();},[]);
  useEffect(()=>{
    if(!enabled||!userId)return;
    let live=true,pending:Promise<void>|null=null;
    const load=():Promise<void>=>{
      if(!live||document.visibilityState==='hidden')return Promise.resolve();
      if(pending)return pending;
      pending=(async()=>{
        setSnapshot(previous=>({userId,tasks:previous.userId===userId?previous.tasks:[],groups:previous.userId===userId?previous.groups:[],loading:true,error:false}));
        try{
          const {loadMyWorkOverview}=await import('./queries');if(!live)return;
          const {tasks,groups}=await loadMyWorkOverview();
          if(live)setSnapshot({userId,tasks,groups,loading:false,error:false});
        }catch{if(live)setSnapshot({userId,tasks:[],groups:[],loading:false,error:true});}
        finally{pending=null;}
      })();
      return pending;
    };
    refreshRef.current=load;void load();
    const onRefresh=()=>{void load();};
    window.addEventListener('focus',onRefresh);window.addEventListener('tenops:notifications-changed',onRefresh);document.addEventListener('visibilitychange',onRefresh);
    return()=>{live=false;if(refreshRef.current===load)refreshRef.current=null;window.removeEventListener('focus',onRefresh);window.removeEventListener('tenops:notifications-changed',onRefresh);document.removeEventListener('visibilitychange',onRefresh);};
  },[enabled,userId]);
  if(!enabled||!userId)return{tasks:[],groups:[],loading:false,error:false,refresh};
  return snapshot.userId===userId?{...snapshot,refresh}:{tasks:[],groups:[],loading:true,error:false,refresh};
}
