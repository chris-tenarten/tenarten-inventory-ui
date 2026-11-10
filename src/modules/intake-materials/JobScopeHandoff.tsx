'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {useAuth} from '@/lib/auth';
import BidScopePanel from './BidScopePanel';
export default function JobScopeHandoff({jobId}:{jobId:string}){
 const auth=useAuth(),[handoff,setHandoff]=useState<{bid_id:string;scope_id:string|null;outstanding:string[]}|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;void supabase.from('job_bid_scope_handoffs').select('bid_id,scope_id,outstanding').eq('job_id',jobId).maybeSingle().then(r=>{if(active){if(r.error)setError('Intake handoff is unavailable.');else setHandoff(r.data);}});return()=>{active=false;};},[jobId]);
 if(error)return <p className="mt-3 text-xs text-amber-900">{error}</p>;
 if(!handoff)return null;
 return <details className="mt-4 border border-slate-300 bg-white p-3"><summary className="min-h-9 cursor-pointer text-sm font-bold">Intake handoff · {handoff.scope_id?'Accepted scope retained':'Scope unresolved'}</summary><a className="text-sm text-blue-900 underline" href={`/pre-production?bid=${handoff.bid_id}`}>Open source Bid</a>{auth.can('viewIntake')&&<BidScopePanel bidId={handoff.bid_id} converted/>}</details>;
}
