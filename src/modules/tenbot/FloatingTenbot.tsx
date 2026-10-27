'use client';
import {usePathname} from 'next/navigation';
import {useEffect,useRef,useState} from 'react';
import {Bot,ChevronDown} from 'lucide-react';
import TenbotWorkspace from './TenbotWorkspace';
import './tenbot.css';

export const OPEN_TENBOT_EVENT='tenops:open-tenbot';

export default function FloatingTenbot(){
 const pathname=usePathname();
 const [open,setOpen]=useState(pathname==='/tenbot');
 const [started,setStarted]=useState(pathname==='/tenbot');
 const root=useRef<HTMLDivElement>(null);
 const panel=useRef<HTMLElement>(null);
 const launcher=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  const show=()=>{setStarted(true);setOpen(true);};
  window.addEventListener(OPEN_TENBOT_EVENT,show);
  return ()=>window.removeEventListener(OPEN_TENBOT_EVENT,show);
 },[]);
 useEffect(()=>{
  const viewport=window.visualViewport;
  const measure=()=>{
   const height=viewport?.height??window.innerHeight;
   const bottom=Math.max(0,window.innerHeight-height-(viewport?.offsetTop??0));
   root.current?.style.setProperty('--tenbot-visible-height',`${height}px`);
   root.current?.style.setProperty('--tenbot-keyboard-inset',`${bottom}px`);
  };
  measure();
  viewport?.addEventListener('resize',measure);
  viewport?.addEventListener('scroll',measure);
  window.addEventListener('resize',measure);
  return ()=>{viewport?.removeEventListener('resize',measure);viewport?.removeEventListener('scroll',measure);window.removeEventListener('resize',measure);};
 },[]);
 useEffect(()=>{if(open)panel.current?.focus({preventScroll:true});},[open]);
 function minimize(){setOpen(false);requestAnimationFrame(()=>launcher.current?.focus({preventScroll:true}));}
 return <div ref={root} data-tenbot-floating data-open={open?'true':'false'}>
  <button ref={launcher} type="button" className="tenbot-launcher" aria-label="Ask TenBot" aria-expanded={open} aria-controls="tenbot-assistant" onClick={()=>{setStarted(true);setOpen(true);}}>
   <Bot size={20} aria-hidden="true"/><span>Ask TenBot</span>
  </button>
  {started?<section ref={panel} id="tenbot-assistant" role="dialog" aria-modal="false" aria-label="TenBot assistant" tabIndex={-1} hidden={!open} className="tenbot-panel" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();minimize();}}}>
   <header className="tenbot-panel-header"><div className="flex items-center gap-2"><Bot size={22} aria-hidden="true"/><div><h2 className="font-bold">Ask TenBot</h2><p className="text-xs opacity-80">Your TenOps guide</p></div></div><button type="button" onClick={minimize} aria-label="Minimize TenBot" title="Minimize TenBot" className="flex h-11 w-11 items-center justify-center rounded hover:bg-white/10"><ChevronDown size={22}/></button></header>
   <TenbotWorkspace visible={open}/>
  </section>:null}
 </div>;
}
