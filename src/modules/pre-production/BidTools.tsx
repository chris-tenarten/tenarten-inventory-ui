'use client';
import {useEffect,useState} from 'react';
import {FileText,FlaskConical,FolderOpen} from 'lucide-react';
import {useAuth} from '@/lib/auth';
import {hasProposalAccess} from '@/modules/proposals/queries';
export default function BidTools({bidId}:{bidId:string}){
 const auth=useAuth(),[proposalAccess,setProposalAccess]=useState<boolean|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;void hasProposalAccess().then(allowed=>{if(active)setProposalAccess(allowed);}).catch(()=>{if(active)setError('Proposal access could not be checked. Reopen Tools to retry.');});return()=>{active=false;};},[bidId]);
 const canCreate=auth.can('accessIntake')&&auth.can('writeBusinessData');
 const links=[
  {label:'Create Proposal',href:`/proposals?bid=${encodeURIComponent(bidId)}`,icon:FileText,allowed:proposalAccess&&canCreate,description:'Open the Proposal Generator for this Bid.'},
  {label:'Create Sample',href:`/samples?bid=${encodeURIComponent(bidId)}&open=new`,icon:FlaskConical,allowed:auth.can('readOperationalData')&&canCreate,description:'Start a Sample in the established generator with this Bid attached.'},
  {label:'Open related Proposals',href:`/proposals?bid=${encodeURIComponent(bidId)}`,icon:FolderOpen,allowed:proposalAccess,description:'Review and manage this Bid’s Proposals.'},
  {label:'Open related Samples',href:`/samples?bid=${encodeURIComponent(bidId)}`,icon:FolderOpen,allowed:auth.can('readOperationalData'),description:'Review Samples and Blend Sheets in their existing workspace.'},
 ];
 return <section aria-label="Bid Tools" className="mt-4 rounded-sm border border-slate-200 bg-white p-4"><h3 className="text-sm font-bold">Tools</h3><p className="mt-1 text-xs text-slate-600">Use the established generators with this Bid in context.</p>{error&&<p role="alert" className="mt-3 text-xs text-red-800">{error}</p>}<div className="mt-3 grid gap-3 sm:grid-cols-2">{links.map(({icon:Icon,...item})=>item.allowed?<a key={item.label} href={item.href} className="block min-h-20 rounded-sm border border-slate-300 p-3 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600"><span className="flex items-center gap-2 text-sm font-bold text-blue-900"><Icon className="h-4 w-4"/>{item.label}</span><span className="mt-1 block text-xs text-slate-600">{item.description}</span></a>:<div key={item.label} className="min-h-20 rounded-sm border border-slate-200 p-3 text-slate-500"><span className="text-sm font-semibold">{item.label}</span><p className="mt-1 text-xs">{proposalAccess===null&&item.label.includes('Proposal')?'Checking access…':'Existing module permissions are required.'}</p></div>)}</div></section>;
}
