'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { openProductionJob } from '@/modules/production/job-options';
import type { Bid } from './types';
import type { BidPlanning } from './planning';
import { convertBidToProduction, loadBidPlanning, saveBidProjectedWindow } from './planning-data';

const input = 'mt-1 min-h-10 w-full rounded-sm border border-slate-300 bg-white px-2 text-sm text-slate-950';
export default function BidPlanningCard({ bid, onChanged }: { bid: Bid; onChanged(): Promise<unknown> }) {
  const auth = useAuth();
  const canWrite = Boolean(auth.profile?.isActive && auth.can('accessIntake'));
  const [record, setRecord] = useState<BidPlanning | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [converting, setConverting] = useState(false);
  const [choice, setChoice] = useState<'carry' | 'new' | 'unscheduled'>('carry');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [jobNumber, setJobNumber] = useState('');
  const reload = useCallback(async () => {
    const next = (await loadBidPlanning(bid.id))[0];
    if (!next) throw new Error('Bid planning record was not found.');
    setRecord(next); setStart(next.projected_production_start ?? ''); setEnd(next.projected_production_end ?? '');
  }, [bid.id]);
  useEffect(() => { let live = true; void loadBidPlanning(bid.id).then(([next]) => {
    if (!live) return;
    if (!next) throw new Error('Bid planning record was not found.');
    setRecord(next); setStart(next.projected_production_start ?? ''); setEnd(next.projected_production_end ?? '');
  }).catch(caught => { if (live) setError(caught.message); }); return () => { live = false; }; }, [bid.id, bid.updatedAt]);
  async function save() {
    if (!canWrite || !record || busy) return;
    setBusy(true); setError(''); setMessage('');
    try { await saveBidProjectedWindow(record, start, end); await onChanged(); setMessage('Projected production window updated.'); }
    catch (caught) { setError(`${caught instanceof Error ? caught.message : 'Unable to save projected window.'} Refresh to verify the saved dates before retrying.`); }
    finally { setBusy(false); }
  }
  async function convert() {
    if (!canWrite || !auth.can('createProductionJob') || !record || busy) return;
    setBusy(true); setError(''); setMessage('');
    try { await convertBidToProduction(record, choice, newStart, newEnd, jobNumber); await onChanged(); setConverting(false); setMessage('Converted to Production. Production scheduling is now authoritative.'); }
    catch (caught) { setError(`${caught instanceof Error ? caught.message : 'Unable to convert Bid.'} Refresh to check whether conversion completed. Retrying will not create a second Job.`); }
    finally { setBusy(false); }
  }
  const valid = (!start && !end) || Boolean(start && end && start <= end);
  return <section className="mt-3 rounded-sm border border-slate-200 bg-white p-4" aria-label="Projected Production Window">
    <h3 className="text-sm font-bold">Projected Production Window</h3>
    <p className="mt-1 text-xs text-slate-600">Projected / tentative — does not reserve Production capacity. Separate from when an estimate or proposal is due.</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="mt-3 text-sm text-emerald-700">{message}</p>}
    {!record ? <p className="mt-3 text-sm text-slate-500">{error ? 'Planning information is unavailable. The planning migration must be installed before this feature can be used.' : 'Loading planning information…'}</p> : <>
      {record.production_job_id ? <div className="mt-3 space-y-2 text-sm"><p>Converted to Production. Original projection: {start && end ? `${start} – ${end}` : 'Not set'}.</p><button type="button" onClick={() => openProductionJob(record.production_job_id!)} className="min-h-10 font-semibold text-blue-700 underline">Open Production Job</button></div> : <>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Projected start<input type="date" aria-label="Projected start" value={start} disabled={!canWrite || busy} onChange={event => setStart(event.target.value)} className={input}/></label><label className="text-xs font-semibold">Projected end<input type="date" aria-label="Projected end" min={start || undefined} value={end} disabled={!canWrite || busy} onChange={event => setEnd(event.target.value)} className={input}/></label></div>
        <div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={!canWrite || busy || !valid} onClick={() => void save()} className="min-h-10 border border-blue-900 bg-blue-900 px-3 text-sm font-bold text-white disabled:opacity-50">Save projected window</button><button type="button" disabled={!canWrite || busy} onClick={() => { setStart(''); setEnd(''); }} className="min-h-10 px-2 text-sm underline">Clear dates</button><button type="button" disabled={busy} onClick={() => void reload().then(() => setError('')).catch(caught => setError(caught.message))} className="min-h-10 px-2 text-sm underline">Refresh planning</button></div>
        {canWrite && auth.can('createProductionJob') && <div className="mt-4 border-t border-slate-200 pt-3"><p className="text-xs text-slate-600">Conversion requires a saved Won status and Deposit Received Date. Unsaved Bid edits are not carried forward.</p><button type="button" disabled={busy || bid.status !== 'won' || !bid.depositReceivedDate} onClick={() => { setConverting(true); setChoice(auth.can('scheduleProduction') && record.projected_production_start ? 'carry' : 'unscheduled'); }} className="mt-2 min-h-10 border border-slate-400 px-3 text-sm font-bold disabled:opacity-50">Convert to Production</button></div>}
        {converting && <fieldset className="mt-4 space-y-3 border border-slate-300 p-3" disabled={!canWrite || busy}><legend className="px-1 text-sm font-bold">Confirm Production handoff</legend><p className="text-xs text-slate-600">Creates one canonical Job. Original Bid and issued documents remain intact.</p><label className="block text-sm"><input type="radio" name="conversion-window" checked={choice === 'carry'} disabled={!auth.can('scheduleProduction') || !record.projected_production_start} onChange={() => setChoice('carry')}/> Carry Forward: {record.projected_production_start ?? 'No projection'} – {record.projected_production_end ?? ''}</label><label className="block text-sm"><input type="radio" name="conversion-window" checked={choice === 'new'} disabled={!auth.can('scheduleProduction')} onChange={() => setChoice('new')}/> Set New Dates</label><label className="block text-sm"><input type="radio" name="conversion-window" checked={choice === 'unscheduled'} onChange={() => setChoice('unscheduled')}/> Plan in Production Later (original projection remains on Bid)</label>
          {!auth.can('scheduleProduction') && <p className="text-xs text-slate-600">A user with Production scheduling permission must confirm committed dates.</p>}
          {choice === 'new' && <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs">Production start<input type="date" value={newStart} onChange={event => setNewStart(event.target.value)} className={input}/></label><label className="text-xs">Production end<input type="date" min={newStart || undefined} value={newEnd} onChange={event => setNewEnd(event.target.value)} className={input}/></label></div>}
          <label className="block text-xs">Job number (optional; not allocated automatically)<input value={jobNumber} onChange={event => setJobNumber(event.target.value)} className={input}/></label>
          <div className="flex flex-wrap gap-3"><button type="button" onClick={() => void convert()} disabled={choice === 'new' && (!newStart || !newEnd || newEnd < newStart)} className="min-h-10 bg-blue-900 px-3 text-sm font-bold text-white disabled:opacity-50">Confirm conversion</button><button type="button" onClick={() => setConverting(false)} className="min-h-10 px-2 text-sm underline">Cancel conversion</button></div>
        </fieldset>}
      </>}
    </>}
  </section>;
}
