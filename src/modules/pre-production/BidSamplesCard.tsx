'use client';

import {FlaskConical} from 'lucide-react';
import {useEffect,useState} from 'react';
import {loadSamples} from '@/modules/samples/queries';
import type {SampleRecord} from '@/modules/samples/types';

export default function BidSamplesCard({bidId}:{bidId:string}){
 const[samples,setSamples]=useState<SampleRecord[]>([]);const[error,setError]=useState('');
 useEffect(()=>{let active=true;void loadSamples(bidId).then((items)=>{if(active)setSamples(items);}).catch((caught)=>{if(active)setError(caught instanceof Error?caught.message:'Unable to load Samples.');});return()=>{active=false;};},[bidId]);
 const assigned=samples.map((sample)=>sample.colorPlateNumber).filter(Boolean);const approved=samples.filter((sample)=>Boolean(sample.approvedDate)).length;
 const description=error?'Sample relationship unavailable.':samples.length?`${samples.length} Sample${samples.length===1?'':'s'}${assigned.length?` · ${assigned.slice(0,2).join(', ')}${assigned.length>2?'…':''}`:''}${approved?` · ${approved} approved`:''}`:'Create or manage formulation samples for this Bid.';
 return <button type="button" onClick={()=>window.location.assign(`/samples?bid=${encodeURIComponent(bidId)}${samples.length===1?`&open=${encodeURIComponent(samples[0].id)}`:''}`)} className="group min-h-24 w-full rounded-sm border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-slate-400 hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><div className="flex items-center gap-2"><FlaskConical className="h-4 w-4 text-slate-500 transition group-hover:text-blue-800"/><h3 className="text-xs font-bold uppercase tracking-[0.05em] text-slate-800">Samples / Color Plates</h3></div><p className={`mt-2 text-xs leading-5 ${error?'font-semibold text-red-700':'text-slate-600'}`}>{description}</p></button>;
}
