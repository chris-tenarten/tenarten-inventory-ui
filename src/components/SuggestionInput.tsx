'use client';

import {useId,useState} from 'react';
import type {FocusEventHandler} from 'react';
import {BusinessInput,BusinessButton} from './BusinessWriteControls';

/** Browsing is independent of the authored value; free-text edits retain their existing callback. */
export default function SuggestionInput({id,value,options,onChange,onFocus,onBlur,className,placeholder,disabled,ariaLabel}:{id?:string;value:string;options:string[];onChange:(value:string)=>void;onFocus?:()=>void;onBlur?:FocusEventHandler<HTMLInputElement>;className:string;placeholder?:string;disabled?:boolean;ariaLabel?:string}){
 const generated=useId();const listId=`suggestions-${generated.replaceAll(':','')}`;
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(-1);
 const matches=[...new Set(options)].filter(option=>option.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 const browse=()=>{setQuery('');setActive(-1);setOpen(true);};
 const select=(option:string)=>{onChange(option);setOpen(false);setActive(-1);};
 return <span className="relative block min-w-0">
  <BusinessInput id={id} aria-label={ariaLabel} value={value} disabled={disabled} placeholder={placeholder} autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId} aria-activedescendant={open&&active>=0&&active<matches.length?`${listId}-${active}`:undefined}
   onFocus={()=>{browse();onFocus?.();}} onClick={()=>{if(!open)browse();}}
   onBlur={event=>{setOpen(false);onBlur?.(event);}}
   onChange={event=>{setQuery(event.target.value);setActive(-1);setOpen(true);onChange(event.target.value);}}
   onKeyDown={event=>{
    if(event.key==='Escape'){event.preventDefault();setOpen(false);setActive(-1);}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(!open){browse();setActive(event.key==='ArrowDown'?0:new Set(options).size-1);}else setActive(index=>matches.length?(index<0?(event.key==='ArrowDown'?0:matches.length-1):(index+(event.key==='ArrowDown'?1:-1)+matches.length)%matches.length):-1);}
    if(event.key==='Enter'&&open){event.preventDefault();if(active>=0&&matches[active])select(matches[active]);else setOpen(false);}
   }} className={`${className} pr-8`}/>
  <BusinessButton type="button" tabIndex={-1} disabled={disabled} aria-label="Browse choices" aria-expanded={open} onMouseDown={event=>event.preventDefault()} onClick={event=>{const input=event.currentTarget.previousElementSibling as HTMLInputElement;input.focus();browse();}} className="absolute right-1 top-1/2 -translate-y-1/2 px-1 text-slate-500">▾</BusinessButton>
  {open&&<span id={listId} role="listbox" className="absolute left-0 right-0 z-40 mt-1 block max-h-64 overflow-y-auto border border-slate-300 bg-white text-slate-900 shadow-lg">
   {matches.map((option,index)=><button key={option} id={`${listId}-${index}`} type="button" role="option" aria-selected={option===value} tabIndex={-1} onMouseDown={event=>event.preventDefault()} onClick={()=>select(option)} className={`block w-full px-3 py-2 text-left text-sm font-normal hover:bg-slate-100 ${index===active?'bg-blue-100':option===value?'bg-blue-50 font-semibold':''}`}>{option}{option===value&&<span aria-hidden="true"> ✓</span>}</button>)}
   {!matches.length&&<span className="block px-3 py-2 text-xs font-normal text-slate-500">No matching choices. You can enter a value.</span>}
  </span>}
 </span>;
}
