'use client';

import { Download, Eye, FileText, Plus, RefreshCw, Settings2, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import DocumentViewer from '@/components/documents/DocumentViewer';
import type { ProductionJob } from '@/modules/production/types';
import EstimateEditor from './EstimateEditor';
import EstimatingDefaultsPanel from './EstimatingDefaultsPanel';
import ProposalCustomerEditor from './ProposalCustomerEditor';
import { formatMoney, initializeNewProposalDefaults } from './model';
import {
  createBidProposal,
  createGenericProposal,
  createProposal,
  createProposalRevision,
  deleteDraftProposal,
  deleteIssuedProposal,
  ensureProposalEstimate,
  generateProposalPdf,
  getProposalPdfUrl,
  issueProposal,
  linkProposalToBid,
  loadBidProposals,
  loadJobProposals,
  loadLinkableProposals,
  loadProposal,
  loadProposals,
  previewProposal,
  saveProposal,
} from './queries';
import { PROPOSAL_DISCLAIMER, type Proposal } from './types';

type EditorTab = 'estimate' | 'proposal';
const tabClass = (active: boolean) => 'h-10 px-4 text-sm font-bold ' + (active ? 'border-b-2 border-blue-700 bg-slate-100 text-slate-950' : 'text-slate-500');

export default function ProposalPanel({
  job,
  bidId,
  initialOpenId,
  isAdmin,
  onClose,
}: {
  job?: ProductionJob;
  bidId?: string;
  initialOpenId?: string;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<Proposal[]>([]);
  const [linkable, setLinkable] = useState<Proposal[]>([]);
  const [linkSelection, setLinkSelection] = useState('');
  const [draft, setDraft] = useState<Proposal | null>(null);
  const [editorTab, setEditorTab] = useState<EditorTab>('estimate');
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<{ url: string; filename: string; title: string } | null>(null);
  const initialOpened = useRef(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [nextHistory, nextLinkable] = await Promise.all([
        job ? loadJobProposals(job.id) : bidId ? loadBidProposals(bidId) : loadProposals(),
        bidId ? loadLinkableProposals() : Promise.resolve([]),
      ]);
      setHistory(nextHistory);
      setLinkable(nextLinkable);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Proposals.');
    } finally {
      setLoading(false);
    }
  }, [job, bidId]);

  const hydrateProposal = useCallback(async (id: string, isNew = false) => {
    let value = await loadProposal(id);
    if (isNew) value = initializeNewProposalDefaults(value);
    if (value.status === 'draft' && !value.estimate) {
      value = { ...value, estimate: await ensureProposalEstimate(value.id) };
    }
    if (value.status === 'draft' && !value.disclaimerSnapshot) {
      value = { ...value, disclaimerSnapshot: PROPOSAL_DISCLAIMER };
    }
    return value;
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  async function open(id: string, isNew = false) {
    setBusy(id);
    setError('');
    try {
      const value = await hydrateProposal(id, isNew);
      setDraft(value);
      setEditorTab(value.estimate ? 'estimate' : 'proposal');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to open Proposal.');
    } finally {
      setBusy('');
    }
  }

  useEffect(() => {
    if (!initialOpenId || initialOpened.current || loading) return;
    if (bidId && !history.some((item) => item.id === initialOpenId)) return;
    initialOpened.current = true;
    setBusy(initialOpenId);
    setError('');
    void hydrateProposal(initialOpenId)
      .then((value) => {
        setDraft(value);
        setEditorTab(value.estimate ? 'estimate' : 'proposal');
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Unable to open Proposal.'))
      .finally(() => setBusy(''));
  }, [bidId, history, hydrateProposal, initialOpenId, loading]);

  async function create() {
    const existing = job || bidId ? history.find((item) => item.status === 'draft') : undefined;
    if (existing) {
      setMessage('A draft Proposal already exists for this ' + (job ? 'Job' : 'Bid') + '. Open the existing draft or delete it before creating a new Proposal.');
      return;
    }
    setBusy('create');
    setError('');
    try {
      const id = job ? await createProposal(job.id) : bidId ? await createBidProposal(bidId) : await createGenericProposal();
      await open(id, true);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create Proposal.');
    } finally {
      setBusy('');
    }
  }

  async function linkExisting() {
    if (!bidId || !linkSelection) return;
    setBusy('link');
    setError('');
    try {
      await linkProposalToBid(bidId, linkSelection);
      await reload();
      await open(linkSelection);
      setMessage('Existing Proposal linked to this Bid. Issued history was not changed.');
      setLinkSelection('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to link Proposal.');
    } finally {
      setBusy('');
    }
  }

  async function save() {
    if (!draft) return;
    setBusy('save');
    setError('');
    try {
      await saveProposal(draft);
      setDraft(await loadProposal(draft.id));
      setMessage('Draft saved.');
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save Proposal.');
    } finally {
      setBusy('');
    }
  }

  async function showPreview() {
    if (!draft) return;
    setBusy('preview');
    setError('');
    try {
      const blob = draft.status === 'issued' ? null : await previewProposal(draft);
      const url = blob ? URL.createObjectURL(blob) : await getProposalPdfUrl(draft.id);
      setPreview({ url, filename: draft.estimateNumber + '.pdf', title: 'Tenarten Proposal' });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to preview Proposal.');
    } finally {
      setBusy('');
    }
  }

  async function issue() {
    if (!draft || draft.status !== 'draft') return;
    if (!window.confirm('Issue ' + draft.estimateNumber + '?\n\nThe customer Proposal and internal Estimate snapshot become immutable. Future changes require a revision.')) return;
    setBusy('issue');
    setError('');
    try {
      await saveProposal(draft);
      await issueProposal(draft.id);
      const url = await generateProposalPdf(draft.id);
      setDraft(await loadProposal(draft.id));
      setPreview({ url, filename: draft.estimateNumber + '.pdf', title: 'Tenarten Proposal' });
      setMessage('Proposal and Estimate issued; PDF generated.');
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to issue Proposal.');
    } finally {
      setBusy('');
    }
  }

  async function revise(id: string) {
    setBusy(id);
    setError('');
    try {
      const revisionId = await createProposalRevision(id);
      await open(revisionId);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create revision.');
    } finally {
      setBusy('');
    }
  }

  async function removeDraft() {
    if (!draft || draft.status !== 'draft') return;
    if (!window.confirm('Delete Draft ' + draft.estimateNumber + '?\n\nThis removes only this Proposal draft and its internal Estimate. The Job, Bid, and unrelated records are not affected.')) return;
    setBusy('delete-draft');
    setError('');
    try {
      await deleteDraftProposal(draft.id);
      setPreview(null);
      setDraft(null);
      setMessage('Deleted Draft ' + draft.estimateNumber + '.');
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to delete Proposal draft.');
    } finally {
      setBusy('');
    }
  }

  async function removeIssued() {
    if (!draft || draft.status !== 'issued' || !isAdmin) return;
    if (!window.confirm('Delete issued Proposal ' + draft.estimateNumber + '?\n\nThis exceptional Admin action removes its generated PDF and Proposal records. The Job, Bid, and unrelated attachments are not affected.')) return;
    setBusy('delete');
    setError('');
    try {
      await deleteIssuedProposal(draft.id);
      if (preview?.url.startsWith('blob:')) URL.revokeObjectURL(preview.url);
      setPreview(null);
      setDraft(null);
      setMessage('Deleted Proposal ' + draft.estimateNumber + '.');
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to delete Proposal.');
    } finally {
      setBusy('');
    }
  }

  const activeDraft = job || bidId ? history.find((item) => item.status === 'draft') : undefined;
  const contextLabel = job ? (job.job_number || 'No Job #') + ' · ' + job.name : bidId ? 'Bid-context Proposal workspace' : 'Generic Proposal workspace';

  return <>
    <div data-shell-below-header className="fixed inset-0 z-[120] bg-slate-950/45" role="dialog" aria-modal="true" aria-label="Proposal Generator">
      <div className="ml-auto flex h-full w-full max-w-6xl flex-col overflow-hidden bg-[#eef1f4] shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-300 bg-white px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0"><div className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-500">Commercial tools</div><h2 className="mt-1 text-xl font-bold">Proposal Generator</h2><p className="truncate text-sm text-slate-600">{contextLabel}</p></div>
          <div className="ml-3 flex shrink-0 items-center gap-2"><button type="button" onClick={() => setDefaultsOpen(true)} className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-xs font-bold"><Settings2 className="h-4 w-4" /><span className="hidden sm:inline">Estimating Defaults</span></button><button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center border border-slate-300 bg-white" aria-label="Close"><X className="h-5 w-5" /></button></div>
        </header>
        {error ? <div role="alert" className="border-b border-red-300 bg-red-50 px-5 py-2 text-sm font-semibold text-red-800">{error}</div> : null}
        {message ? <div role="status" className="border-b border-emerald-300 bg-emerald-50 px-5 py-2 text-sm font-semibold text-emerald-800">{message}</div> : null}

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
          {!draft ? <section>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">Proposal history</h3>{activeDraft ? <p className="mt-1 max-w-2xl text-sm text-slate-600">A draft Proposal already exists for this {job ? 'Job' : 'Bid'}. Open the existing draft or delete it before creating a new Proposal.</p> : null}</div><button type="button" disabled={Boolean(busy) || Boolean(activeDraft)} onClick={() => void create()} className="inline-flex h-10 items-center gap-2 border border-blue-900 bg-blue-900 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" />{busy === 'create' ? 'Creating…' : 'Create Proposal'}</button></div>
            {bidId && linkable.length ? <div className="mb-4 flex flex-col gap-2 border border-slate-300 bg-white p-3 sm:flex-row sm:items-end"><label className="min-w-0 flex-1 text-xs font-bold text-slate-700">Link existing standalone Proposal<select value={linkSelection} onChange={(event) => setLinkSelection(event.target.value)} className="mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm"><option value="">Select Proposal</option>{linkable.map((item) => <option key={item.id} value={item.id}>{item.estimateNumber} · {item.status.toUpperCase()} · {item.customerName || 'No customer'} · {item.projectName || 'No project'}</option>)}</select></label><button type="button" disabled={!linkSelection || Boolean(busy)} onClick={() => void linkExisting()} className="h-9 border border-slate-400 px-3 text-xs font-bold disabled:opacity-40">{busy === 'link' ? 'Linking…' : 'Link Proposal'}</button></div> : null}
            {loading ? <p>Loading…</p> : history.length === 0 ? <div className="border border-slate-300 bg-white p-5 text-sm text-slate-600">No Proposals are linked to this {job ? 'Job' : bidId ? 'Bid' : 'workspace'}.</div> : <div className="space-y-2">{history.map((item) => <article key={item.id} className="flex flex-wrap items-center gap-3 border border-slate-300 bg-white p-4"><FileText className="h-5 w-5 text-slate-500" /><div className="min-w-0 flex-1"><div className="font-bold">{item.estimateNumber}{item.versionMinor > 0 ? <span className="ml-2 text-xs font-bold text-red-700">REVISED</span> : null}</div><div className="text-xs text-slate-500">{item.status.toUpperCase()} · {item.issuedAt ? new Date(item.issuedAt).toLocaleDateString() : new Date(item.createdAt).toLocaleDateString()} · {item.creatorName || 'TenOps'}{!bidId ? ' · ' + formatMoney(item.total) : ''}</div></div><button type="button" disabled={Boolean(busy)} onClick={() => void open(item.id)} className="h-9 border border-slate-300 px-3 text-xs font-bold">{item.status === 'draft' ? 'Open draft' : 'View issued'}</button>{item.status === 'issued' ? <button type="button" disabled={Boolean(busy)} onClick={() => void revise(item.id)} className="inline-flex h-9 items-center gap-1 border border-slate-300 px-3 text-xs font-bold"><RefreshCw className="h-3.5 w-3.5" />Create Revision</button> : null}</article>)}</div>}
          </section> : <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={() => setDraft(null)} className="h-9 border border-slate-400 bg-white px-3 text-xs font-bold">Back to history</button><div className="text-right"><div className="font-bold">{draft.estimateNumber} {draft.versionMinor > 0 ? <span className="text-xs text-red-700">REVISED</span> : null}</div><div className="text-xs uppercase text-slate-500">{draft.status}</div></div></div>
            <nav className="grid grid-cols-2 border border-slate-300 bg-white sm:w-[28rem]" aria-label="Proposal workspace sections"><button type="button" aria-current={editorTab === 'estimate' ? 'page' : undefined} onClick={() => setEditorTab('estimate')} className={tabClass(editorTab === 'estimate')}>Internal Estimate</button><button type="button" aria-current={editorTab === 'proposal' ? 'page' : undefined} onClick={() => setEditorTab('proposal')} className={tabClass(editorTab === 'proposal')}>Customer Proposal</button></nav>
            {editorTab === 'estimate' ? draft.estimate ? <EstimateEditor estimate={draft.estimate} disabled={draft.status === 'issued'} onChange={(estimate) => setDraft((current) => current ? { ...current, estimate } : current)} /> : <div className="border border-slate-300 bg-white p-5 text-sm text-slate-600">This legacy issued Proposal predates the V2 internal Estimate snapshot. Its issued customer document remains unchanged.</div> : <ProposalCustomerEditor proposal={draft} onChange={(value) => { setDraft(value); setMessage(''); }} />}
          </div>}
        </main>

        {draft ? <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-300 bg-white px-4 py-3 sm:px-5"><div className="text-xs text-slate-500">Issued customer Proposals and internal Estimate snapshots are immutable. Create a revision to make changes.</div><div className="flex flex-wrap gap-2">{draft.status === 'issued' && isAdmin ? <button type="button" disabled={Boolean(busy)} onClick={() => void removeIssued()} className="inline-flex h-10 items-center gap-2 border border-red-400 bg-red-50 px-4 text-sm font-bold text-red-800"><Trash2 className="h-4 w-4" />{busy === 'delete' ? 'Deleting…' : 'Delete Proposal'}</button> : null}{draft.status === 'draft' ? <button type="button" disabled={Boolean(busy)} onClick={() => void removeDraft()} className="inline-flex h-10 items-center gap-2 border border-red-300 px-3 text-sm font-bold text-red-700"><Trash2 className="h-4 w-4" />{busy === 'delete-draft' ? 'Deleting…' : 'Delete Draft'}</button> : null}<button type="button" disabled={Boolean(busy)} onClick={() => void showPreview()} className="inline-flex h-10 items-center gap-2 border border-slate-400 px-4 text-sm font-bold"><Eye className="h-4 w-4" />Preview PDF</button>{draft.status === 'draft' ? <><button type="button" disabled={Boolean(busy)} onClick={() => void save()} className="h-10 border border-slate-400 px-4 text-sm font-bold">{busy === 'save' ? 'Saving…' : 'Save Draft'}</button><button type="button" disabled={Boolean(busy)} onClick={() => void issue()} className="inline-flex h-10 items-center gap-2 border border-blue-900 bg-blue-900 px-4 text-sm font-bold text-white"><Download className="h-4 w-4" />{busy === 'issue' ? 'Issuing…' : 'Issue / Generate PDF'}</button></> : <button type="button" disabled={Boolean(busy)} onClick={() => void revise(draft.id)} className="inline-flex h-10 items-center gap-2 border border-blue-900 bg-blue-900 px-4 text-sm font-bold text-white"><RefreshCw className="h-4 w-4" />Create Revision</button>}</div></footer> : null}
      </div>
    </div>
    <EstimatingDefaultsPanel open={defaultsOpen} onClose={() => setDefaultsOpen(false)} />
    {preview ? <DocumentViewer title={preview.title} filename={preview.filename} mimeType="application/pdf" url={preview.url} onClose={() => { if (preview.url.startsWith('blob:')) URL.revokeObjectURL(preview.url); setPreview(null); }} /> : null}
  </>;
}
