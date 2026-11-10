'use client';

import { BriefcaseBusiness, Copy } from 'lucide-react';
import { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import type { AppRole } from '@/lib/rbac';
import { loadProductionJobOption, openProductionJob } from '@/modules/production/job-options';
import { productionJobsVisibleToRole } from '@/modules/production/fixture-visibility';
import { productionJobUrl, requestedProductionJob, splitProductionJobLinks } from '@/modules/production/job-links';
import { JobReferenceResolver, type AuthorizedJobReference } from './job-reference-resolver';

type ReferenceScope = { resolver: JobReferenceResolver; enabled: boolean; revision: number };
const ReferenceContext = createContext<ReferenceScope | null>(null);

function ReferenceScope({ identity, canRead, role, children }: { identity: string; canRead: boolean; role: AppRole | null; children: ReactNode }) {
  const [foreground, setForeground] = useState({ enabled: typeof document === 'undefined' || document.visibilityState !== 'hidden', revision: 0 });
  const resolution = useMemo(() => ({ identity, resolver: new JobReferenceResolver(loadProductionJobOption, canRead, id => productionJobsVisibleToRole([{ id }], role).length > 0) }), [canRead, role, identity]);
  const resolver = resolution.resolver;
  useEffect(() => {
    const invalidate = (enabled: boolean) => {
      resolver.reset();
      setForeground(current => ({ enabled, revision: current.revision + 1 }));
    };
    const focus = () => invalidate(document.visibilityState !== 'hidden');
    const blur = () => invalidate(false);
    const visibility = () => invalidate(document.visibilityState !== 'hidden');
    window.addEventListener('focus', focus);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      resolver.reset();
      window.removeEventListener('focus', focus);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [resolver]);
  const value = useMemo(() => ({ resolver, enabled: canRead && foreground.enabled, revision: foreground.revision }), [canRead, foreground, resolver]);
  return <ReferenceContext.Provider value={value}>{children}</ReferenceContext.Provider>;
}

/** Closing Inbox or changing account, authorization or destination drops all names. */
export function MessagingJobReferenceScope({ conversation, children }: { conversation: string; children: ReactNode }) {
  const auth = useAuth();
  const canRead = auth.ready && auth.accessAllowed && auth.accessStatus === 'allowed' && !auth.requiresPasswordSetup && auth.isAuthenticated && Boolean(auth.profile?.isActive) && auth.user?.id === auth.profile?.userId && auth.can('readOperationalData');
  const owner = canRead ? auth.user?.id ?? '' : '';
  const role = canRead ? auth.profile?.role ?? null : null;
  return <ReferenceScope identity={`${owner}:${role}:${canRead}:${conversation}`} canRead={canRead} role={role}>{children}</ReferenceScope>;
}

function JobReferenceCard({ jobId, href, copyable, onJobNavigation }: { jobId: string; href: string; copyable: boolean; onJobNavigation(): void }) {
  const scope = useContext(ReferenceContext);
  const [copyStatus, setCopyStatus] = useState('');
  const [manualCopy, setManualCopy] = useState(false);
  const copyInput = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<{ jobId: string; resolver: JobReferenceResolver; revision: number; record: AuthorizedJobReference | null } | null>(null);
  const resolver = scope?.resolver;
  const revision = scope?.revision;
  const enabled = scope?.enabled ?? false;
  useEffect(() => {
    if (!resolver || !enabled || revision === undefined) return;
    let live = true;
    void resolver.read(jobId).then(record => { if (live) setView({ jobId, resolver, revision, record }); });
    return () => { live = false; };
  }, [enabled, jobId, resolver, revision]);
  const record = enabled && view?.jobId === jobId && view.resolver === resolver && view.revision === revision ? view.record : undefined;
  const state = !enabled || record === null ? 'unavailable' : record ? 'available' : 'loading';
  const name = state === 'available' ? record!.name : state === 'loading' ? 'Loading Job reference…' : 'Job reference unavailable';
  useEffect(() => { if (manualCopy) { copyInput.current?.focus(); copyInput.current?.select(); } }, [manualCopy]);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setManualCopy(false);
      setCopyStatus('Link copied.');
    } catch {
      setManualCopy(true);
      setCopyStatus('Copy this Job link:');
    }
  };
  const navigate = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (openProductionJob(jobId)) onJobNavigation();
  };
  const link = <a href={href} onClick={navigate} data-job-reference-card data-job-id={jobId} data-job-reference-id={jobId} data-job-reference-state={state} aria-label={state === 'available' ? `Open Production Job: ${name}` : name} className="my-1 flex min-h-12 w-full min-w-0 max-w-sm items-center gap-2 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-left text-slate-800 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
    <BriefcaseBusiness className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
    <span className="min-w-0"><strong className="block truncate text-sm font-semibold text-slate-900">{name}</strong><span className="block text-[11px] text-slate-500">{state === 'available' ? 'Production Job · Open Inspector' : 'Production Job'}</span></span>
  </a>;
  if (!copyable) return link;
  return <div className="max-w-sm">
    <div className="flex min-w-0 items-stretch gap-1">{link}<button type="button" onClick={() => void copyLink()} aria-label="Copy Job link" className="my-1 inline-flex shrink-0 flex-col items-center justify-center gap-1 rounded border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><Copy className="h-3.5 w-3.5" aria-hidden="true" />Copy link</button></div>
    {copyStatus ? <p role="status" className="text-xs text-slate-600">{copyStatus}</p> : null}
    {manualCopy ? <input ref={copyInput} aria-label="Copyable Job URL" readOnly value={href} onFocus={event => event.currentTarget.select()} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-xs text-slate-800" /> : null}
  </div>;
}

/** Canonical URLs are the stored identity; surrounding employee text stays text. */
export default function MessagingJobReferences({ body, legacyJobId, referencesOnly = false, copyable = false, onJobNavigation }: { body: string; legacyJobId?: string; referencesOnly?: boolean; copyable?: boolean; onJobNavigation(): void }) {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const parts = origin ? splitProductionJobLinks(body, origin) : [{ text: body }];
  const seen = new Set<string>();
  const rendered = parts.map((part, index) => {
    if (!part.jobId || !part.href) return referencesOnly ? null : <Fragment key={`text-${index}`}>{part.text}</Fragment>;
    if (referencesOnly && seen.has(part.jobId)) return null;
    seen.add(part.jobId);
    return <JobReferenceCard key={`job-${part.jobId}-${index}`} jobId={part.jobId} href={part.href} copyable={referencesOnly || copyable} onJobNavigation={onJobNavigation} />;
  });
  const legacyId = legacyJobId ? requestedProductionJob(`?open-production-job=${encodeURIComponent(legacyJobId)}`).jobId : null;
  if (legacyId && origin && !seen.has(legacyId)) rendered.push(<JobReferenceCard key="legacy-job" jobId={legacyId} href={productionJobUrl(legacyId, origin)} copyable={referencesOnly || copyable} onJobNavigation={onJobNavigation} />);
  if (referencesOnly && !seen.size && !legacyId) return null;
  return <div data-message-job-preview={referencesOnly ? '' : undefined} className={referencesOnly ? 'space-y-1' : 'whitespace-pre-wrap break-words'}>{rendered}</div>;
}
