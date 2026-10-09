"use client";
import {useState} from 'react';
import JobUpdateMentionTextarea,{type SelectedMention} from '@/modules/production/components/JobUpdateMentionTextarea';
import type {BidOwner} from './types';
const field='mt-1 min-h-10 w-full border border-slate-300 bg-white px-2 text-sm';
export default function BidCollaborationPreview({owners,mode}:{owners:BidOwner[];mode:'update'|'task'}){
 const [body,setBody]=useState(''),[mentions,setMentions]=useState<SelectedMention[]>([]),[due,setDue]=useState('');
 return <details className="mt-4 border border-amber-300 bg-amber-50 p-3">
 <summary className="min-h-9 cursor-pointer text-xs font-bold">{mode==='update'?'Preview mentions & Update attachments':'Preview Bid task & reminders'} · EARLY ACCESS</summary>
 <section aria-label={mode==='update'?'Bid collaboration preview':'Bid task preview'} className="mt-3 space-y-3">
 <p role="note" className="text-xs font-semibold text-amber-950">Not Yet Available — preview only. Nothing entered here is saved, uploaded or sent. Closing this workspace discards the preview.</p>
 {mode==='update'?<><label htmlFor="bid-mention-preview" className="text-xs font-bold">Mention interaction preview</label><JobUpdateMentionTextarea id="bid-mention-preview" value={body} mentions={mentions} collaborators={owners.map(owner=>({...owner,role:''}))} placeholder="Type @ to try mention selection…" onChange={(value,next)=>{setBody(value);setMentions(next);}}/><p className="text-xs text-slate-600">Preview suggestions use the existing Bid owner list. No mention notifications are sent.</p><button type="button" disabled className="min-h-10 border border-slate-300 px-3 text-xs opacity-60">Attach to Update — Not Yet Available</button><button type="button" disabled className="ml-2 min-h-10 border border-slate-300 px-3 text-xs opacity-60">Post with mentions — Not Yet Available</button></>:<>
 <label className="block text-xs font-bold">Task title (preview)<input className={field} maxLength={500}/></label>
 <label className="block text-xs font-bold">Description (preview)<textarea className={field} maxLength={10000}/></label>
 <label className="block text-xs font-bold">Assignee (preview)<select className={field}>{owners.map(owner=><option key={owner.userId}>{owner.displayName}</option>)}</select></label>
 <label className="block text-xs font-bold">Due date (preview)<input type="date" value={due} onChange={e=>setDue(e.target.value)} className={field}/></label>
 <label className="flex items-center gap-2 text-xs"><input type="checkbox" defaultChecked/>Due-date notification at 8:00 a.m. Central Time (preview)</label>
 <label className="block text-xs">Days before due date (preview)<input type="number" min={1} max={365} className={field}/></label>
 <p className="text-xs text-slate-600">America/Chicago, including daylight saving time. Reminder delivery is not activated.</p>
 <button type="button" disabled className="min-h-10 border border-slate-300 px-3 text-xs opacity-60">Attach to task — Not Yet Available</button><button type="button" disabled className="ml-2 min-h-10 border border-slate-300 px-3 text-xs opacity-60">Create Bid task — Not Yet Available</button>
 </>}
 </section></details>;
}
