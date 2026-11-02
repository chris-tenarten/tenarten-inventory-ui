'use client';

import {useRef, useState} from 'react';
import {Check, Lightbulb, X} from 'lucide-react';
import {
  canOfferCapabilityRequest, capabilityDraftFromGap, isPersistedSubmission,
  unavailableCapabilityRequestAdapter, validCapabilityDraft,
  type AutomationGap, type CapabilityRequestAdapter, type CapabilitySignal,
} from './model';

export function CapabilityRequestCard({signal, adapter = unavailableCapabilityRequestAdapter, onDismiss}: {
  signal: CapabilitySignal | null;
  adapter?: CapabilityRequestAdapter;
  onDismiss?: () => void;
}) {
  if (!canOfferCapabilityRequest(signal)) return null;
  return <RequestCard key={signal.id} gap={signal} adapter={adapter} onDismiss={onDismiss} />;
}

function RequestCard({gap, adapter, onDismiss}: {
  gap: AutomationGap;
  adapter: CapabilityRequestAdapter;
  onDismiss?: () => void;
}) {
  const [draft, setDraft] = useState(() => capabilityDraftFromGap(gap));
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'submitted' | 'preview' | null>(null);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const editContext = (value: string) => {
    setDraft(current => ({...current, additionalContext: value}));
    setError('');
    setResult(null);
  };
  async function submit() {
    if (submitting.current || !validCapabilityDraft(draft) || adapter.availability === 'unavailable') return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const receipt = await adapter.submit({...draft}, gap);
      if (adapter.availability === 'preview' || receipt?.kind === 'preview') setResult('preview');
      else if (isPersistedSubmission(receipt)) setResult('submitted');
      else throw new Error('A saved suggestion could not be confirmed. Please check before retrying.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Submission could not be confirmed. Please check before retrying.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  if (dismissed) return null;
  if (result === 'submitted') return <div role="status" data-capability-request="submitted" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /><p>Suggestion submitted for Chris to review. This does not approve or schedule the capability.</p></div>;
  return <section aria-label="Suggest a TenBot capability" data-capability-request="offer" className="rounded-lg border border-blue-200 bg-slate-50 p-3 text-sm text-slate-800">
    <div className="flex items-start gap-2"><Lightbulb aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-blue-800" /><div className="min-w-0 flex-1"><h3 className="font-semibold text-slate-950">Suggest this TenBot capability?</h3><p className="mt-1 text-sm leading-relaxed">{draft.requestedCapability}</p></div></div>
    <form className="mt-3 space-y-3" onSubmit={event => {event.preventDefault(); void submit();}}>
      <dl className="space-y-1 text-xs leading-relaxed text-slate-600"><div><dt className="inline font-semibold">Your objective: </dt><dd className="inline">{draft.employeeObjective}</dd></div>{draft.existingWorkflow ? <div><dt className="inline font-semibold">Existing TenOps workflow: </dt><dd className="inline">{draft.existingWorkflow}</dd></div> : null}</dl>
      <details><summary className="min-h-9 cursor-pointer py-2 text-xs font-medium text-blue-800">Add context (optional)</summary><label className="block text-xs text-slate-600">Additional context<textarea disabled={busy} maxLength={1200} rows={2} value={draft.additionalContext} onChange={event => editContext(event.target.value)} placeholder="How would this help your work?" className="mt-1 min-h-11 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 sm:text-sm" /></label></details>
      <p className="text-xs leading-relaxed text-slate-500">Share only the details shown here and your account name with Chris. Your conversation is not included.</p>
      {adapter.availability === 'unavailable' ? <p role="status" className="rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-600">Suggestions are not connected yet. Nothing will be sent.</p> : null}
      {adapter.availability === 'preview' ? <p className="text-xs font-medium text-amber-800">Interaction preview · No request will be saved or sent.</p> : null}
      {result === 'preview' ? <p role="status" className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950">Preview complete. This suggestion was not submitted.</p> : null}
      {error ? <p role="alert" className="text-xs text-red-800">{error}</p> : null}
      <div className="flex flex-wrap gap-2"><button type="submit" disabled={busy || !validCapabilityDraft(draft) || adapter.availability === 'unavailable'} className="tenops-selected-surface min-h-11 rounded-md border px-3 text-sm font-semibold disabled:opacity-50">{busy ? 'Submitting…' : 'Yes, submit suggestion'}</button><button type="button" disabled={busy} onClick={() => {setDismissed(true); onDismiss?.();}} className="flex min-h-11 items-center gap-1 rounded-md px-3 text-sm text-slate-600 hover:bg-slate-200 disabled:opacity-50"><X aria-hidden="true" className="h-3.5 w-3.5" />No, dismiss</button></div>
    </form>
  </section>;
}
