'use client';

import {FileText} from 'lucide-react';
import {useEffect,useState} from 'react';
import {hasProposalAccess,loadBidProposalSummaries,type BidProposalSummary} from '@/modules/proposals/queries';

export default function BidProposalCard({bidId}:{bidId:string}){
 const[allowed,setAllowed]=useState<boolean|null>(null);const[proposals,setProposals]=useState<BidProposalSummary[]>([]);const[error,setError]=useState('');
 useEffect(()=>{let active=true;void hasProposalAccess().then(async(value)=>{if(!active)return;setAllowed(value);if(value)setProposals(await loadBidProposalSummaries(bidId));}).catch((caught)=>{if(active)setError(caught instanceof Error?caught.message:'Unable to load Proposal relationship.');});return()=>{active=false;};},[bidId]);
 const latest=proposals[0];
 const description=error?'Proposal relationship unavailable.':allowed===false?'Proposal access is required.':allowed===null?'Loading Proposal relationship…':latest?`${latest.estimateNumber} · ${latest.status==='issued'?'Issued':'Draft'}${proposals.length>1?` · ${proposals.length} linked`:''}`:'Create or manage this Bid’s commercial proposal.';
 return <button type="button" onClick={()=>window.location.assign(`/proposals?bid=${encodeURIComponent(bidId)}${latest?`&open=${encodeURIComponent(latest.id)}`:''}`)} className="group min-h-24 w-full rounded-sm border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-slate-400 hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-slate-500 transition group-hover:text-blue-800"/><h3 className="text-xs font-bold uppercase tracking-[0.05em] text-slate-800">Proposal &amp; Estimate</h3></div><p className={`mt-2 text-xs leading-5 ${error?'font-semibold text-red-700':'text-slate-600'}`}>{description}</p></button>;
}
