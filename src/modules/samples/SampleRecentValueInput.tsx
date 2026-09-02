'use client';

import {useId} from 'react';
import type {SampleRecentFieldKey} from './recent-values';

type Props={label:string;value:string;fieldKey:SampleRecentFieldKey;className:string;suggestions:string[];onLoad:(field:SampleRecentFieldKey)=>void;onChange:(value:string)=>void};

export default function SampleRecentValueInput({label,value,fieldKey,className,suggestions,onLoad,onChange}:Props){
  const generatedId=useId();
  const listId=`sample-recent-${generatedId.replaceAll(':','')}`;
  return <label className="text-xs font-bold text-slate-700">{label}<input value={value} list={listId} autoComplete="off" onFocus={()=>onLoad(fieldKey)} onChange={(event)=>onChange(event.target.value)} className={className}/><datalist id={listId}>{suggestions.map((suggestion)=><option key={suggestion} value={suggestion}/>)}</datalist></label>;
}
