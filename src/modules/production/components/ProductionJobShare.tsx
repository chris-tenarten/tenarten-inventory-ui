'use client';

import { Copy, Send, Share2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { productionJobUrl } from '../job-links';
import type { ProductionJobReference } from '../job-reference';

export default function ProductionJobShare({ job }: { job: ProductionJobReference }) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [manualLink, setManualLink] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const fallback = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('keydown', escape, true);
    };
  }, [open]);

  useEffect(() => {
    if (manualLink) { fallback.current?.focus(); fallback.current?.select(); }
  }, [manualLink]);

  async function copyLink() {
    const url = productionJobUrl(job.id, window.location.origin);
    try {
      await navigator.clipboard.writeText(url);
      setManualLink('');
      setMessage('Link copied.');
    } catch {
      setManualLink(url);
      setMessage('Copy this Job link:');
    }
  }

  function sendInMessaging() {
    if (!auth.can('messaging.write')) return;
    trigger.current?.focus();
    window.dispatchEvent(new CustomEvent('tenops:open-inbox', {
      // Names are resolved by each viewer's authorized card presenter. Sending
      // only identity avoids copying a name into an unauthorized peer's text.
      detail: { draft: { id: crypto.randomUUID(), body: productionJobUrl(job.id, window.location.origin) } },
    }));
    setOpen(false);
  }

  return <div ref={container} data-job-share className="relative shrink-0">
    <button ref={trigger} type="button" aria-expanded={open} aria-controls="job-share-actions" onClick={() => { setOpen(value => !value); setMessage(''); setManualLink(''); }} className="inline-flex h-8 items-center gap-1.5 border border-slate-400 px-2 text-xs font-bold hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600">
      <Share2 className="h-3.5 w-3.5" aria-hidden="true" />Share
    </button>
    {open ? <div id="job-share-actions" aria-label="Share Job" className="absolute right-0 top-full z-10 mt-1 w-64 border border-slate-300 bg-white p-1 shadow-xl">
      <button type="button" onClick={() => void copyLink()} className="flex min-h-10 w-full items-center gap-2 px-3 text-left text-sm hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600"><Copy className="h-4 w-4" aria-hidden="true" />Copy link</button>
      <button type="button" disabled={!auth.can('messaging.write')} onClick={sendInMessaging} className="flex min-h-10 w-full items-center gap-2 px-3 text-left text-sm hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-40"><Send className="h-4 w-4" aria-hidden="true" />Send in Messaging</button>
      {message ? <p role="status" className="px-3 py-2 text-xs text-slate-700">{message}</p> : null}
      {manualLink ? <input ref={fallback} aria-label="Job link" readOnly value={manualLink} onFocus={event => event.currentTarget.select()} className="mb-2 w-full border border-slate-400 px-2 py-2 text-xs" /> : null}
    </div> : null}
  </div>;
}
