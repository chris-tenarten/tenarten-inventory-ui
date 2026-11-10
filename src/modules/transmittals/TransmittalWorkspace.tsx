'use client';

import { useEffect, useState } from 'react';
import { loadProductionJob } from '@/modules/production/jobs';
import { formatProductionJobOption, loadProductionJobOptions, type ProductionJobOption } from '@/modules/production/job-options';
import type { ProductionJob } from '@/modules/production/types';
import JobTransmittalPanel from './JobTransmittalPanel';
import type { TransmittalMode } from './types';
import { hasUsableTransmittalJobNumber } from './validation';

export default function TransmittalWorkspace() {
  const [jobs, setJobs] = useState<ProductionJobOption[]>([]);
  const [job, setJob] = useState<ProductionJob | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [mode, setMode] = useState<TransmittalMode>('job-linked');
  const [standaloneOpen, setStandaloneOpen] = useState(false);
  const [error, setError] = useState('');
  const selectedJob = jobs.find((option) => option.id === selectedId) ?? null;

  useEffect(() => {
    void loadProductionJobOptions({ includeArchived: false })
      .then(setJobs)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load Production Jobs.'));
  }, []);

  async function open() {
    if (!selectedId) return;
    setError('');
    try {
      const value = await loadProductionJob(selectedId);
      if (!value) throw new Error('The selected Production Job is unavailable.');
      setJob(value);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to open Letter of Transmittal.');
    }
  }

  function chooseMode(nextMode: TransmittalMode) {
    setMode(nextMode);
    setJob(null);
    setStandaloneOpen(false);
    setError('');
  }

  return <main className="min-h-[calc(100vh-73px)] bg-[#eef1f4] px-3 py-5 text-slate-950 sm:px-5">
    <div className="mx-auto max-w-3xl">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Commercial tools</div>
      <h1 className="mt-1 text-3xl font-bold">Letter of Transmittal</h1>
      <p className="mt-1 text-sm text-slate-600">Choose a Job-linked document for normal Production work or a standalone document for a rare one-off.</p>
      <section className="mt-5 border border-slate-300 bg-white p-4">
        <div className="text-xs font-bold text-slate-700">LoT context</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <button type="button" aria-pressed={mode === 'job-linked'} onClick={() => chooseMode('job-linked')} className={`min-h-16 border px-3 py-2 text-left ${mode === 'job-linked' ? 'border-blue-900 bg-blue-50 text-blue-950' : 'border-slate-300 bg-white text-slate-700'}`}>
            <span className="block text-sm font-bold">Job-linked</span>
            <span className="mt-0.5 block text-xs">Uses a canonical Production Job and derived numbering.</span>
          </button>
          <button type="button" aria-pressed={mode === 'standalone'} onClick={() => chooseMode('standalone')} className={`min-h-16 border px-3 py-2 text-left ${mode === 'standalone' ? 'border-blue-900 bg-blue-50 text-blue-950' : 'border-slate-300 bg-white text-slate-700'}`}>
            <span className="block text-sm font-bold">Standalone / one-off</span>
            <span className="mt-0.5 block text-xs">No Production Job; identifying number is entered manually.</span>
          </button>
        </div>
        {mode === 'job-linked' ? <>
          <label className="mt-4 block text-xs font-bold text-slate-700">Production Job
            <select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setError(''); }} className="mt-1 h-11 w-full border border-slate-300 bg-white px-3 text-sm">
              <option value="">Select a Job…</option>
              {jobs.map((option) => <option key={option.id} value={option.id}>{formatProductionJobOption(option)}</option>)}
            </select>
          </label>
          {selectedJob && !hasUsableTransmittalJobNumber(selectedJob.job_number) && <div className="mt-3 border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            This Job has no usable canonical Job Number. You can open its existing history, but a new Job-linked LoT cannot be generated until the Job Number is assigned in Production.
          </div>}
        </> : <p className="mt-4 text-sm text-slate-600">Standalone LoTs remain canonical document history, but they are explicitly unlinked and do not create a Production Job or Job Number.</p>}
        {error && <div role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</div>}
        {mode === 'job-linked'
          ? <button type="button" disabled={!selectedId} onClick={() => void open()} className="mt-4 h-10 border border-blue-900 bg-blue-900 px-4 text-sm font-bold text-white disabled:opacity-40">Open Job-linked LoT</button>
          : <button type="button" onClick={() => setStandaloneOpen(true)} className="mt-4 h-10 border border-blue-900 bg-blue-900 px-4 text-sm font-bold text-white">Open Standalone LoT</button>}
      </section>
    </div>
    {job && <JobTransmittalPanel job={job} mode="job-linked" onClose={() => setJob(null)} />}
    {standaloneOpen && <JobTransmittalPanel mode="standalone" onClose={() => setStandaloneOpen(false)} />}
  </main>;
}
