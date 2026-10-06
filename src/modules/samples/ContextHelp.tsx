"use client";
import {Info} from 'lucide-react';
import {useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';

export default function ContextHelp({label,children}:{label:string;children:React.ReactNode}) {
 const id=useId(),button=useRef<HTMLButtonElement>(null);
 const [position,setPosition]=useState<{left:number;top:number}|null>(null);
 const show=()=>{const rect=button.current?.getBoundingClientRect();if(rect)setPosition({left:Math.max(8,Math.min(rect.left,window.innerWidth-272)),top:Math.min(rect.bottom+6,window.innerHeight-110)});};
 return <span className="inline-flex align-middle" onMouseEnter={show} onMouseLeave={()=>{if(document.activeElement!==button.current)setPosition(null);}}>
  <button ref={button} type="button" aria-label={`Help: ${label}`} aria-describedby={position?id:undefined} aria-expanded={Boolean(position)} onFocus={show} onBlur={()=>setPosition(null)} onClick={show} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();setPosition(null);}}} className="ml-1 inline-flex min-h-7 min-w-7 items-center justify-center rounded-full text-slate-500 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><Info aria-hidden="true" className="h-4 w-4"/></button>
  {position&&createPortal(<span id={id} role="tooltip" style={position} className="pointer-events-none fixed z-[100] w-64 max-w-[calc(100vw-1rem)] rounded bg-slate-900 p-2 text-xs font-normal text-white shadow-lg">{children}</span>,document.body)}
 </span>;
}
