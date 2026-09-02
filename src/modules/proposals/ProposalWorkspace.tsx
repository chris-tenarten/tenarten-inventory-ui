'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { hasProposalAccess } from './queries';
import ProposalPanel from './ProposalPanel';

export default function ProposalWorkspace() {
  const auth = useAuth();
  const [open, setOpen] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const context = useMemo(() => { if (typeof window === 'undefined') return { bidId: '', openId: '' }; const params = new URLSearchParams(window.location.search); return { bidId: params.get('bid') ?? '', openId: params.get('open') ?? '' }; }, []);

  useEffect(() => {
    let active = true;
    void hasProposalAccess().then((value) => { if (active) setAllowed(value); });
    return () => { active = false; };
  }, [auth.profile?.userId]);

  return (
    <main className="min-h-[calc(100vh-73px)] bg-[#eef1f4] px-3 py-5 text-slate-950 sm:px-5">
      <div className="mx-auto max-w-5xl">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Commercial tools</div>
        <h1 className="mt-1 text-3xl font-bold">Proposal Generator</h1>
        <p className="mt-1 text-sm text-slate-600">Create and manage Proposals independently from Production Jobs.</p>
        {allowed === false && <div role="alert" className="mt-5 border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Your account does not have Proposal Generator access.</div>}
        {allowed && !open && <button type="button" onClick={() => setOpen(true)} className="mt-5 h-10 border border-blue-900 bg-blue-900 px-4 text-sm font-bold text-white">Open Proposal Generator</button>}
      </div>
      {open && allowed && auth.profile && <ProposalPanel bidId={context.bidId || undefined} initialOpenId={context.openId || undefined} isAdmin={auth.profile.role === 'admin'} onClose={() => setOpen(false)} />}
    </main>
  );
}
