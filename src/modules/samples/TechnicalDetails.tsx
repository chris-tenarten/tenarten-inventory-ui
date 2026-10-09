'use client';
import {useState} from 'react';
import {useAuth} from '@/lib/auth';
import type {GenerationDiagnostic} from '../../../supabase/functions/_shared/sample-diagnostics.mjs';
export default function TechnicalDetails({diagnostic}:{diagnostic:GenerationDiagnostic|null}){
 const auth=useAuth();const [copied,setCopied]=useState(false);
 if(!diagnostic||!auth.profile?.isActive||!['admin','developer'].includes(auth.profile.role))return null;
 const text=JSON.stringify(diagnostic,null,2);
 return <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold">Technical Details</summary><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded bg-slate-100 p-2 text-slate-800">{text}</pre><button type="button" className="my-2 border px-3 py-2" onClick={()=>void navigator.clipboard.writeText(text).then(()=>setCopied(true)).catch(()=>setCopied(false))}>{copied?'Copied':'Copy technical details'}</button></details>;
}
