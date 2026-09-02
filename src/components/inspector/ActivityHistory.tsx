'use client';

import {History} from 'lucide-react';
import type {ReactNode} from 'react';
import {useState} from 'react';

export type InspectorActivityEntry={id:string;actor:string;occurredAt:string;content:ReactNode};

export default function ActivityHistory({title,entries,initialCount=3,emptyCopy='No recorded changes yet.'}:{title:string;entries:InspectorActivityEntry[];initialCount?:number;emptyCopy?:string}){
 const[expanded,setExpanded]=useState(false);const visible=expanded?entries:entries.slice(0,initialCount);
 return <section className="rounded-sm border border-slate-200 bg-white p-4"><button type="button" onClick={()=>setExpanded((current)=>!current)} aria-expanded={expanded} className="flex min-h-10 w-full items-center justify-between gap-3 text-left"><span className="flex items-center gap-2"><History className="h-4 w-4 text-slate-500"/><span className="text-sm font-bold uppercase tracking-[0.05em] text-slate-800">{title}</span></span><span className="text-xs font-semibold text-blue-800">{expanded?'Collapse':entries.length>initialCount?`View all ${entries.length}`:'View history'}</span></button>{visible.length?<div className="mt-1 divide-y divide-slate-200">{visible.map((entry)=><article key={entry.id} className="grid grid-cols-[0.5rem_minmax(0,1fr)] gap-2 py-2 text-sm"><span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400"/><div className="min-w-0"><div><span className="font-semibold text-slate-900">{entry.actor}</span> {entry.content}</div><time dateTime={entry.occurredAt} className="mt-0.5 block text-xs text-slate-500">{new Date(entry.occurredAt).toLocaleString()}</time></div></article>)}</div>:<p className="py-2 text-sm text-slate-500">{emptyCopy}</p>}</section>;
}
