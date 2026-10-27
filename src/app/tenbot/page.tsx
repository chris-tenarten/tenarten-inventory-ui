'use client';
import {useEffect} from 'react';
import {OPEN_TENBOT_EVENT} from '@/modules/tenbot/FloatingTenbot';
export default function TenbotPage(){
 useEffect(()=>{window.dispatchEvent(new Event(OPEN_TENBOT_EVENT));},[]);
 return <section className="mx-auto max-w-3xl p-6"><h1 className="text-xl font-bold">TenBot is here to help</h1><p className="mt-2 text-sm text-slate-600">Ask TenBot while you work in any TenOps module. Minimize the assistant whenever you need more room; your conversation stays with you.</p><button type="button" onClick={()=>window.dispatchEvent(new Event(OPEN_TENBOT_EVENT))} className="tenops-selected-surface mt-4 min-h-11 rounded px-4">Open TenBot</button></section>;
}
