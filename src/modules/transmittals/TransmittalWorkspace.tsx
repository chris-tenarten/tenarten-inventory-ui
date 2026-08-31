'use client';

import { useEffect, useState } from 'react';
import { loadProductionJob } from '@/modules/production/jobs';
import { formatProductionJobOption, loadProductionJobOptions, type ProductionJobOption } from '@/modules/production/job-options';
import type { ProductionJob } from '@/modules/production/types';
import JobTransmittalPanel from './JobTransmittalPanel';

export default function TransmittalWorkspace() {
  const [jobs, setJobs] = useState<ProductionJobOption[]>([]);
  const [job, setJob] = useState<ProductionJob | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');

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

  return <main className="min-h-[calc(100vh-73px)] bg-[#eef1f4] px-3 py-5 text-slate-950 sm:px-5">
    <div className="mx-auto max-w-3xl">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Commercial tools</div>
      <h1 className="mt-1 text-3xl font-bold">Letter of Transmittal</h1>
      <p className="mt-1 text-sm text-slate-600">Choose the Production Job whose document history and recipient details should be used.</p>
      <section className="mt-5 border border-slate-300 bg-white p-4">
        <label className="text-xs font-bold text-slate-700">Production Job
          <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="mt-1 h-11 w-full border border-slate-300 bg-white px-3 text-sm">
            <option value="">Select a Job…</option>
            {jobs.map((option) => <option key={option.id} value={option.id}>{formatProductionJobOption(option)}</option>)}
          </select>
        </label>
        {error && <div role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</div>}
        <button type="button" disabled={!selectedId} onClick={() => void open()} className="mt-4 h-10 border border-blue-900 bg-blue-900 px-4 text-sm font-bold text-white disabled:opacity-40">Open Transmittal</button>
      </section>
    </div>
    {job && <JobTransmittalPanel job={job} onClose={() => setJob(null)} />}
  </main>;
}
