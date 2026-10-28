'use client';
import {useEffect,useState} from 'react';
import {FileText,FlaskConical,FolderOpen} from 'lucide-react';
import {useAuth} from '@/lib/auth';
import {hasProposalAccess} from '@/modules/proposals/queries';
export default function BidTools({bidId}:{bidId:string}){
 const auth=useAuth(),[proposalAccess,setProposalAccess]=useState<boolean|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;void hasProposalAccess().then(allowed=>{if(active)setProposalAccess(allowed);}).catch(()=>{if(active)setError('Proposal access could not be checked. Reopen Overview to retry.');});return()=>{active=false;};},[bidId]);
 const canCreate=auth.can('accessIntake')&&auth.can('writeBusinessData');
 const links=[
  {label:'Create Proposal',href:`/proposals?bid=${encodeURIComponent(bidId)}`,icon:FileText,allowed:proposalAccess&&canCreate},
  {label:'Create Sample',href:`/samples?bid=${encodeURIComponent(bidId)}&open=new`,icon:FlaskConical,allowed:auth.can('readOperationalData')&&canCreate},
  {label:'Open related Proposals',href:`/proposals?bid=${encodeURIComponent(bidId)}`,icon:FolderOpen,allowed:proposalAccess},
  {label:'Open related Samples',href:`/samples?bid=${encodeURIComponent(bidId)}`,icon:FolderOpen,allowed:auth.can('readOperationalData')},
 ];
 return <section aria-label="Bid Preparation" className="mt-4 rounded-sm border border-slate-200 bg-white p-4"><h3 className="text-sm font-bold">Bid Preparation</h3>{error&&<p role="alert" className="mt-3 text-xs text-red-800">{error}</p>}<div className="mt-3 grid gap-2 sm:grid-cols-2">{links.map(({icon:Icon,...item})=>item.allowed?<a key={item.label} href={item.href} className="flex min-h-11 items-center gap-2 rounded-sm border border-slate-300 px-3 py-2 text-sm font-semibold text-blue-900 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600"><Icon aria-hidden="true" className="h-4 w-4 shrink-0"/>{item.label}</a>:<div key={item.label} className="min-h-11 rounded-sm border border-slate-200 px-3 py-2 text-slate-500"><span className="text-sm font-semibold">{item.label}</span><p className="mt-1 text-xs">{proposalAccess===null&&item.label.includes('Proposal')?'Checking access…':'Existing module permissions are required.'}</p></div>)}</div></section>;
}
