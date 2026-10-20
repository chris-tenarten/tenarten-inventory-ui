'use client';

import { useEffect, useState } from 'react';
import { openProductionJob } from '../job-options';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import CustomerInspector from './CustomerInspector';
import { CONTACT_PAGE_SIZE, searchCustomers } from './queries';
import type { ContactChoice } from './model';

const button = 'min-h-10 rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50';
const message = (cause: unknown) => cause && typeof cause === 'object' && 'message' in cause ? String(cause.message) : 'Unable to load contacts.';
type Job = { id: string; name: string; job_number: string | null };

function CustomerJobs({ companyId }: { companyId: string }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    void supabase.from('production_job_contacts').select('job:jobs(id,name,job_number)')
      .eq('customer_company_id', companyId).order('job_id').range(offset, offset + CONTACT_PAGE_SIZE)
      .then(({ data, error }) => {
        if (!live) return;
        if (error) { setJobs([]); setError(message(error)); }
        else setJobs((data ?? []).flatMap(row => row.job ? [row.job as unknown as Job] : []));
        setLoading(false);
      });
    return () => { live = false; };
  }, [companyId, offset]);
  return <section className="mt-3 border-t border-slate-200 pt-3" aria-label="Linked Production Jobs">
    <h2 className="text-sm font-bold">Linked Production Jobs</h2>
    {loading ? <p role="status">Loading linked Jobs…</p> : <>
      {jobs.slice(0, CONTACT_PAGE_SIZE).map(job => <button key={job.id} onClick={() => openProductionJob(job.id)} className="block py-2 text-left text-sm text-blue-800 underline">{job.job_number || 'Unnumbered Job'} · {job.name}</button>)}
      {!jobs.length && !error && <p className="py-2 text-sm text-slate-600">No visible linked Jobs on this page.</p>}
      {(offset > 0 || jobs.length > CONTACT_PAGE_SIZE) && <div className="flex gap-2"><button className={button} disabled={!offset} onClick={() => { setLoading(true); setError(''); setOffset(Math.max(0, offset - CONTACT_PAGE_SIZE)); }}>Previous Jobs</button><button className={button} disabled={jobs.length <= CONTACT_PAGE_SIZE} onClick={() => { setLoading(true); setError(''); setOffset(offset + CONTACT_PAGE_SIZE); }}>Next Jobs</button></div>}
    </>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <p className="mt-2 text-xs text-slate-500">Historical customer text and Bid names do not establish a directory link. Proposal customer details are independent document snapshots.</p>
  </section>;
}

function Directory() {
  const auth = useAuth();
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<ContactChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<ContactChoice | null | undefined>();
  const [expanded, setExpanded] = useState<string | null>(null);
  const canCreate = auth.can('writeBusinessData') && (auth.can('createProductionJob') || auth.can('editProductionJobRoutine') || auth.can('editProductionJobDetails'));
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      void searchCustomers(search, offset).then(next => { if (live) setRows(next); })
        .catch(cause => { if (live) { setRows([]); setError(message(cause)); } })
        .finally(() => { if (live) setLoading(false); });
    }, 180);
    return () => { live = false; clearTimeout(timer); };
  }, [search, offset, revision]);
  function reload() { setRows([]); setLoading(true); setError(''); setRevision(value => value + 1); }
  function page(next: number) { setRows([]); setLoading(true); setError(''); setExpanded(null); setOffset(next); }
  function saved() { setEditing(undefined); reload(); }
  return <main className="mx-auto max-w-4xl space-y-4 p-3 sm:p-5">
    <div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Contacts</h1><p className="mt-1 text-sm text-slate-600">Shared customer companies and their contact people.</p></div>{canCreate && <button className={button} onClick={() => setEditing(null)}>Add Customer</button>}</div>
    <label className="block text-xs font-bold">Search customers<input aria-label="Search customer directory" value={search} maxLength={300} placeholder="Company name starts with…" onChange={event => { page(0); setSearch(event.target.value); }} className="mt-1 h-10 w-full rounded-sm border border-slate-300 bg-white px-3 text-sm" /></label>
    {error && <div role="alert" className="space-y-2 text-sm text-red-700"><p>{error}</p><button className={button} onClick={reload}>Retry</button></div>}
    {loading ? <p role="status">Loading customers…</p> : <ul className="divide-y divide-slate-200 rounded-sm border border-slate-300 bg-white">
      {rows.slice(0, CONTACT_PAGE_SIZE).map(choice => <li key={choice.company.id} className="p-3">
        <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1"><button onClick={() => setEditing(choice)} className="min-h-10 break-words text-left text-sm font-bold text-blue-900 hover:underline">{choice.company.name}</button><p className="break-words text-xs text-slate-600">{[choice.contact?.name, choice.contact?.email || choice.company.email, choice.contact?.phone || choice.company.phone].filter(Boolean).join(' · ') || 'No contact information saved.'}</p><p className="mt-1 break-words text-xs text-slate-500">{choice.company.mailing_address}</p><span className="text-[10px] text-slate-500">Directory ID · {choice.company.id}</span></div><button className={button} aria-expanded={expanded === choice.company.id} onClick={() => setExpanded(expanded === choice.company.id ? null : choice.company.id)}>Linked Jobs</button></div>
        {expanded === choice.company.id && <CustomerJobs companyId={choice.company.id} />}
      </li>)}
      {!rows.length && !error && <li className="p-4 text-sm text-slate-600">No customers found.</li>}
    </ul>}
    <div className="flex items-center gap-2"><button className={button} disabled={!offset || loading} onClick={() => page(Math.max(0, offset - CONTACT_PAGE_SIZE))}>Previous</button><span className="text-xs text-slate-600">Page {Math.floor(offset / CONTACT_PAGE_SIZE) + 1}</span><button className={button} disabled={rows.length <= CONTACT_PAGE_SIZE || loading} onClick={() => page(offset + CONTACT_PAGE_SIZE)}>Next</button></div>
    {editing !== undefined && <CustomerInspector initialChoice={editing ?? undefined} newName={editing ? null : search} rows={[]} loading={false} search="" offset={0} onSearch={() => {}} onPage={() => {}} onClose={() => setEditing(undefined)} onSaved={saved} onRemoved={saved} onBusyChange={() => {}} />}
  </main>;
}

export default function ContactsWorkspace() {
  const auth = useAuth();
  if (!auth.can('readOperationalData')) return <p role="alert" className="p-5">Your account does not have customer directory access.</p>;
  return <Directory key={`${auth.profile?.userId}:${auth.profile?.role}:${auth.profile?.readOnly}`} />;
}
