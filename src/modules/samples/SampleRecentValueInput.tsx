'use client';

import SuggestionInput from '@/components/SuggestionInput';

import type {SampleRecentFieldKey} from './recent-values';

type Props={label:string;value:string;fieldKey:SampleRecentFieldKey;className:string;suggestions:string[];onLoad:(field:SampleRecentFieldKey)=>void;onChange:(value:string)=>void};

export default function SampleRecentValueInput({label,value,fieldKey,className,suggestions,onLoad,onChange}:Props){
  return <label className="text-xs font-bold text-slate-700">{label}<SuggestionInput ariaLabel={label} value={value} options={suggestions} onFocus={()=>onLoad(fieldKey)} onChange={onChange} className={className}/></label>;
}
