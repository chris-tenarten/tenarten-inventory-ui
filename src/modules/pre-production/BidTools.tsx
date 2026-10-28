'use client';
import {useEffect,useId,useState} from 'react';
import {FileText,FlaskConical,FolderOpen} from 'lucide-react';
import {useAuth} from '@/lib/auth';
import {hasProposalAccess} from '@/modules/proposals/queries';
// Reuse the Production Job Inspector's documentActionClass pattern.
const cardClass='group flex min-h-20 w-full flex-col items-start justify-center gap-1 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-left transition';
const availableCardClass=`${cardClass} text-blue-900 hover:border-slate-400 hover:bg-white hover:shadow-sm focus-visible:ring-2 focus-visible:ring-blue-600`;
export default function BidTools({bidId}:{bidId:string}){
 const cardId=useId();
 const auth=useAuth(),[proposalAccess,setProposalAccess]=useState<boolean|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;void hasProposalAccess().then(allowed=>{if(active)setProposalAccess(allowed);}).catch(()=>{if(active)setError('Proposal access could not be checked. Reopen Overview to retry.');});return()=>{active=false;};},[bidId]);
 const canCreate=auth.can('accessIntake')&&auth.can('writeBusinessData');
 const links=[
  {label:'Create Proposal',description:'Prepare a Proposal for this Bid.',href:`/proposals?bid=${encodeURIComponent(bidId)}`,icon:FileText,allowed:proposalAccess&&canCreate},
  {label:'Create Sample',description:'Start a Sample with this Bid attached.',href:`/samples?bid=${encodeURIComponent(bidId)}&open=new`,icon:FlaskConical,allowed:auth.can('readOperationalData')&&canCreate},
  {label:'Open related Proposals',description:'View this Bid’s Proposals.',href:`/proposals?bid=${encodeURIComponent(bidId)}`,icon:FolderOpen,allowed:proposalAccess},
  {label:'Open related Samples',description:'View this Bid’s Samples and Blend Sheets.',href:`/samples?bid=${encodeURIComponent(bidId)}`,icon:FolderOpen,allowed:auth.can('readOperationalData')},
 ];
 return <section aria-label="Bid Preparation" className="mt-4 rounded-sm border border-slate-200 bg-white p-4">
  <h3 className="text-sm font-bold">Bid Preparation</h3>
  {error&&<p role="alert" className="mt-3 text-xs text-red-800">{error}</p>}
  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">{links.map(({icon:Icon,...item},index)=>{
   const titleId=`${cardId}-${index}-title`,descriptionId=`${cardId}-${index}-description`;
   const content=<>
    <span id={titleId} className="flex items-center gap-2 text-sm font-semibold"><Icon aria-hidden="true" className="h-4 w-4 shrink-0"/>{item.label}</span>
    <span id={descriptionId} className="text-xs font-normal text-slate-600">{item.allowed?item.description:proposalAccess===null&&item.label.includes('Proposal')?'Checking access…':'Existing module permissions are required.'}</span>
   </>;
   return item.allowed?<a key={item.label} href={item.href} aria-labelledby={titleId} aria-describedby={descriptionId} className={availableCardClass}>{content}</a>:<div key={item.label} className={`${cardClass} text-slate-500`}>{content}</div>;
  })}</div>
 </section>;
}
