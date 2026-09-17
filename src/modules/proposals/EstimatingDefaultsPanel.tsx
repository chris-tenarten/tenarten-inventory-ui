'use client';

import { useEffect, useState } from 'react';
import { Settings2, X } from 'lucide-react';
import EstimateAssumptionField from './EstimateAssumptionField';
import { estimateAssumptionsByGroup, type EstimateAssumptionGroup, type EstimateAssumptionKey } from './estimate-assumption-fields';
import { validateEstimateAssumptions } from './estimate-calculations';
import { loadProposalEstimatingDefaults, saveProposalEstimatingDefaults } from './queries';
import type { EstimateRoundingMode, ProposalEstimateAssumptions, ProposalEstimatingDefaults } from './estimate-types';

const groups: Array<{ key: EstimateAssumptionGroup; label: string }> = [
  { key: 'production', label: 'Production & Yield' },
  { key: 'materials', label: 'Materials' },
  { key: 'labor', label: 'Labor' },
  { key: 'freightShop', label: 'Freight & Shop' },
  { key: 'pricing', label: 'Pricing' },
];

type Props = {
  open: boolean;
  onClose(): void;
  onSaved?(defaults: ProposalEstimatingDefaults): void;
};

export default function EstimatingDefaultsPanel({ open, onClose, onSaved }: Props) {
  const [defaults, setDefaults] = useState<ProposalEstimatingDefaults | null>(null);
  const [draft, setDraft] = useState<ProposalEstimateAssumptions | null>(null);
  const [changeNote, setChangeNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBusy(true);
    setError('');
    setMessage('');
    void loadProposalEstimatingDefaults().then((value) => {
      if (cancelled) return;
      setDefaults(value);
      setDraft(value.assumptions);
    }).catch((caught: unknown) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to load Estimating Defaults.');
    }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [busy, onClose, open]);

  if (!open) return null;
  const errors = draft ? validateEstimateAssumptions(draft) : [];
  const changed = Boolean(defaults && draft && JSON.stringify(defaults.assumptions) !== JSON.stringify(draft));

  function patch(key: EstimateAssumptionKey, value: number | EstimateRoundingMode) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
    setMessage('');
  }

  async function save() {
    if (!defaults || !draft || errors.length || !changed) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const saved = await saveProposalEstimatingDefaults(draft, defaults.version, changeNote);
      setDefaults(saved);
      setDraft(saved.assumptions);
      setChangeNote('');
      setMessage(`Version ${saved.version} saved. It will be captured only by future new Estimates; existing Estimates are unchanged.`);
      onSaved?.(saved);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save Estimating Defaults.');
    } finally {
      setBusy(false);
    }
  }

  return <div data-shell-below-header className="fixed inset-0 z-[135] flex justify-end bg-slate-950/45" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="estimating-defaults-title" className="flex h-full w-full max-w-3xl flex-col overflow-hidden border-l border-slate-300 bg-[#eef1f4] shadow-2xl">
      <header className="flex items-start justify-between border-b border-slate-300 bg-white px-4 py-3 sm:px-5">
        <div className="min-w-0"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-slate-500"><Settings2 className="h-4 w-4" aria-hidden="true" />Proposal Generator</div><h2 id="estimating-defaults-title" className="mt-1 text-xl font-bold">Estimating Defaults</h2><p className="mt-1 max-w-2xl text-xs text-slate-600">Changes create a new canonical defaults version for future new Estimates only. Existing saved or issued Estimates keep their captured defaults and overrides.</p></div>
        <button type="button" aria-label="Close Estimating Defaults" disabled={busy} onClick={onClose} className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center border border-slate-300 bg-white text-slate-700 disabled:opacity-50"><X className="h-5 w-5" /></button>
      </header>
      {error ? <div role="alert" className="border-b border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div> : null}
      {message ? <div role="status" className="border-b border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">{message}</div> : null}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
        {busy && !draft ? <p className="text-sm text-slate-500">Loading Estimating Defaults…</p> : null}
        {draft ? <div className="space-y-4">
          <div className="border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-950"><strong>Current canonical version: {defaults?.version ?? '—'}</strong>{defaults?.createdByName ? ` · last changed by ${defaults.createdByName}` : ''}</div>
          {errors.length ? <div role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">{errors.join(' ')}</div> : null}
          {groups.map((group) => <section key={group.key} className="border border-slate-300 bg-white p-4"><h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">{group.label}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{estimateAssumptionsByGroup(group.key).map((definition) => <EstimateAssumptionField key={definition.key} definition={definition} value={draft[definition.key]} helperText="Used only when a future new Estimate captures this defaults version." showReset={false} disabled={busy} onChange={(value) => patch(definition.key, value)} />)}</div></section>)}
          <label className="block text-xs font-bold text-slate-700">Change note <span className="font-normal text-slate-500">(optional)</span><textarea rows={2} maxLength={500} disabled={busy} value={changeNote} onChange={(event) => setChangeNote(event.target.value)} className="mt-1 w-full border border-slate-300 bg-white p-2 text-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100" placeholder="Why these defaults changed" /></label>
        </div> : null}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-300 bg-white px-4 py-3 sm:px-5"><p className="text-xs text-slate-500">Saving does not recalculate or alter any existing Estimate.</p><div className="flex gap-2"><button type="button" disabled={busy} onClick={onClose} className="h-9 border border-slate-300 bg-white px-4 text-sm font-bold disabled:opacity-50">Close</button><button type="button" disabled={busy || !draft || !changed || errors.length > 0} onClick={() => void save()} className="h-9 bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Save New Defaults Version'}</button></div></footer>
    </section>
  </div>;
}
