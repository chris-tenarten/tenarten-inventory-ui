'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { BusinessButton, BusinessInput, BusinessTextarea } from '@/components/BusinessWriteControls';
import { useAuth } from '@/lib/auth';
import { captureChoice, emptySnapshot, unlinkedContact, type ContactChoice, type ContactSnapshot, type ProjectContact } from './model';
import { CONTACT_PAGE_SIZE, getContactChoice, getCustomer, searchCustomers } from './queries';
import CustomerInspector from './CustomerInspector';

const field = 'h-10 w-full rounded-sm border border-slate-300 bg-white px-3 text-sm text-slate-900';
const action = 'min-h-9 rounded-sm border border-slate-300 bg-white px-3 py-1 text-xs font-semibold disabled:opacity-50';
const labels: Record<keyof ContactSnapshot, string> = {
  company_name: 'Customer / Company', contact_name: 'Contact name', contact_email: 'Contact email',
  contact_phone: 'Contact phone', contact_title: 'Contact title', company_phone: 'Company phone',
  company_email: 'Company email', mailing_address: 'Company mailing address', notes: 'Notes',
};
const optionalFields = ['contact_email','contact_phone','contact_title','company_phone','company_email','mailing_address','notes'] as const;
type Props = { customer: string; value: ProjectContact; onChange: (customer: string, contact: ProjectContact) => void; historicalNames?: string[]; onPendingChange?: (pending: boolean) => void; variant?: 'creator' | 'inspector' | 'proposal' };
const message = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Unable to load customers.';

function ProjectContactEditorSession({ customer, value, onChange, historicalNames = [], onPendingChange, variant = 'creator' }: Props) {
  const auth = useAuth();
  const canWrite = auth.can('writeBusinessData') && (variant === 'proposal' || auth.can('createProductionJob') || auth.can('editProductionJobRoutine') || auth.can('editProductionJobDetails'));
  const canCreate = auth.can('writeBusinessData') && (auth.can('createProductionJob') || auth.can('editProductionJobRoutine') || auth.can('editProductionJobDetails'));
  const [open, setOpen] = useState(false);
  const [manager, setManager] = useState<'new' | 'manage' | null>(null);
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<ContactChoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [projectEdit, setProjectEdit] = useState(false);
  const latestOnChange = useRef(onChange);
  useEffect(() => { latestOnChange.current = onChange; }, [onChange]);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const operation = useRef(false);
  const identity = useRef('');
  const trigger = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const managerTrigger = useRef<HTMLElement | null>(null);
  const dropdownId = useId();
  identity.current = `${value.customer_company_id}:${value.customer_contact_id}`;
  const lookup = open || manager === 'manage';

  useEffect(() => {
    onPendingChange?.(busy || manager !== null);
    return () => onPendingChange?.(false);
  }, [busy, manager, onPendingChange]);
  useEffect(() => {
    if (!manager && !busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [manager, busy]);
  useEffect(() => { if (open) searchRef.current?.focus(); }, [open]);
  useEffect(() => {
    if (!lookup) return;
    let live = true;
    setLoading(true);
    const timer = setTimeout(() => {
      setError('');
      void searchCustomers(search,offset).then((next) => { if (live) setRows(next); })
        .catch((cause) => { if (live) { setRows([]); setError(message(cause)); } })
        .finally(() => { if (live) setLoading(false); });
    }, 180);
    return () => { live = false; clearTimeout(timer); };
  }, [lookup, search, offset, auth.profile?.userId]);

  function changeSearch(next: string) { setSearch(next); setOffset(0); setRows([]); }
  function closeDropdown() { setOpen(false); trigger.current?.focus(); }
  function applyChoice(choice: ContactChoice) {
    latestOnChange.current(choice.company.name,captureChoice(choice));
    closeDropdown(); setProjectEdit(false); setNotice('');
  }
  async function select(choice: ContactChoice) {
    if (operation.current || !canWrite) return;
    operation.current = true; setBusy(true); setError('');
    try { const fresh = await getCustomer(choice.company.id); if (mounted.current) applyChoice(fresh); }
    catch (cause) { setError(message(cause)); }
    finally { operation.current = false; setBusy(false); }
  }
  function selectHistoricalName(name: string) {
    onChange(name,canWrite ? unlinkedContact() : value); closeDropdown(); setNotice('');
  }
  function openInspector(mode: 'new' | 'manage', name = '') {
    managerTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setNewName(name); setManager(mode); setOpen(false); setError(''); setNotice('');
  }
  function closeInspector() { if (!busy) setManager(null); }
  async function refreshSnapshot() {
    if (!value.customer_company_id || operation.current) return;
    const current = identity.current;
    operation.current = true; setBusy(true); setError('');
    try {
      const choice = await getContactChoice(value.customer_company_id,value.customer_contact_id);
      if (!mounted.current || current !== identity.current) return;
      if (window.confirm('Replace this Job’s captured customer details with the linked saved information? Unrelated Job fields will stay as entered.')) {
        applyChoice(choice); setNotice('Captured details refreshed. Save the Job to keep this change.');
      }
    } catch (cause) { setError(message(cause)); }
    finally { operation.current = false; setBusy(false); }
  }
  function navigate(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); closeDropdown(); return; }
    if (!['ArrowDown','ArrowUp'].includes(event.key)) return;
    const options = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]')].filter((item) => !item.disabled);
    if (!options.length) return;
    event.preventDefault();
    const current = options.indexOf(document.activeElement as HTMLButtonElement);
    options[event.key === 'ArrowDown' ? (current+1)%options.length : current<0 ? options.length-1 : (current-1+options.length)%options.length]?.focus();
  }
  const historical = [...new Map(historicalNames.map((name) => name.trim()).filter(Boolean).map((name) => [name.toLocaleLowerCase(),name])).values()]
    .filter((name) => name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).slice(0,20);
  const snapshot = value.customer_contact_snapshot;
  const summary = snapshot ? [snapshot.contact_name,snapshot.contact_phone || snapshot.company_phone,snapshot.contact_email || snapshot.company_email].filter(Boolean).join(' · ') : '';
  function editSnapshot(key: keyof ContactSnapshot, next: string) {
    const updated = { ...(snapshot ?? emptySnapshot(customer)), [key]: next };
    onChange(updated.company_name,{ ...value, customer_contact_snapshot: updated });
  }
  return <div className="space-y-2 text-slate-900" data-project-contact-editor>
    <div className="text-xs font-bold">Customer</div>
    <div className="flex items-center gap-1.5">
      {variant === 'inspector' && <BusinessInput aria-label="Customer" list="production-customer-suggestions" autoComplete="off" value={customer} disabled={busy || manager!==null} onChange={(event) => onChange(event.target.value,canWrite ? unlinkedContact() : value)} className={`${field} min-w-0 flex-1`} />}
      <button ref={trigger} type="button" role="combobox" aria-label={variant !== 'inspector' ? 'Customer' : 'Select customer'} aria-expanded={open} aria-controls={`${dropdownId}-list`} aria-haspopup="listbox" disabled={busy || manager!==null} onClick={() => setOpen(!open)} onKeyDown={(event) => { if (event.key==='ArrowDown') { event.preventDefault(); setOpen(true); } }} className={`${field} flex items-center justify-between gap-2 text-left ${variant==='inspector' ? '!w-10 shrink-0 !px-2' : 'flex-1'}`}>
        {variant !== 'inspector' && <span className={`truncate ${customer ? '' : 'text-slate-500'}`}>{customer || 'Select customer…'}</span>}<ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
      </button>
      <button type="button" aria-label="Manage Customer List" title="Manage Customer List" disabled={busy || manager!==null} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50" onClick={() => openInspector('manage')}><SlidersHorizontal className="h-4 w-4" aria-hidden="true" /></button>
    </div>
    {summary && <p className="break-words text-xs text-slate-500">{summary}</p>}
    {open && <section id={dropdownId} aria-label="Customer choices" onKeyDown={navigate} className="space-y-2 rounded-sm border border-slate-300 bg-white p-3 shadow-sm">
      <input ref={searchRef} aria-label="Search customers" value={search} onChange={(event) => changeSearch(event.target.value)} maxLength={300} placeholder="Search customers…" className={field} />
      <div id={`${dropdownId}-list`} role="listbox" aria-label="Customers" className="max-h-60 overflow-y-auto">
        <div role="group" aria-label="Configured Customers"><p className="py-1 text-xs font-bold text-slate-500">Configured Customers</p>
        {loading ? <p role="status" className="py-2 text-sm">Loading customers…</p> : <>
          {rows.slice(0,CONTACT_PAGE_SIZE).map((choice) => <button key={choice.company.id} type="button" role="option" aria-selected={value.customer_company_id===choice.company.id} disabled={!canWrite} className="block min-h-10 w-full px-2 py-2 text-left text-sm hover:bg-blue-50 focus:bg-blue-50 disabled:opacity-50" onClick={() => void select(choice)}>{choice.company.name}<span className="block text-[10px] text-slate-500">{rows.some(other => other.company.id !== choice.company.id && other.company.name.toLocaleLowerCase() === choice.company.name.toLocaleLowerCase()) ? `Directory ID · ${choice.company.id}` : choice.contact?.name || choice.company.email || choice.company.phone || `Directory ID · ${choice.company.id}`}</span></button>)}
          {!rows.length && <p className="py-1 text-xs text-slate-500">No configured matches.</p>}
        </>}
        </div>
        {historical.length>0 && <div role="group" aria-label="Previously Used Names"><p className="mt-2 border-t border-slate-200 pt-2 text-xs font-bold text-slate-500">Previously Used Names</p>{historical.map((name) => <button key={name} type="button" role="option" aria-selected={!value.customer_company_id && customer===name} disabled={!auth.can('writeBusinessData')} className="block min-h-10 w-full px-2 py-2 text-left text-sm hover:bg-blue-50 focus:bg-blue-50 disabled:opacity-50" onClick={() => selectHistoricalName(name)}>{name}</button>)}</div>}
      </div>
      {(offset>0 || rows.length>CONTACT_PAGE_SIZE) && <div className="flex gap-2"><button type="button" className={action} disabled={!offset || loading} onClick={() => setOffset(Math.max(0,offset-CONTACT_PAGE_SIZE))}>Previous</button><button type="button" className={action} disabled={rows.length<=CONTACT_PAGE_SIZE || loading} onClick={() => setOffset(offset+CONTACT_PAGE_SIZE)}>Next</button></div>}
      {canCreate && <div className="space-y-1 border-t border-slate-200 pt-2">
        <BusinessButton type="button" className="block min-h-10 w-full px-2 text-left text-sm font-semibold hover:bg-blue-50" onClick={() => openInspector('new',search.trim())}>+ Add New Customer</BusinessButton>
        <button type="button" className="block min-h-10 w-full px-2 text-left text-sm font-semibold hover:bg-blue-50" onClick={() => openInspector('manage')}>Manage Customer List</button>
        {!value.customer_company_id && customer.trim() && <BusinessButton type="button" className="block min-h-10 w-full px-2 text-left text-sm hover:bg-blue-50" onClick={() => openInspector('new',customer)}>Save to Customer List</BusinessButton>}
      </div>}
      {search.trim() && auth.can('writeBusinessData') && <button type="button" className="block min-h-10 w-full px-2 text-left text-xs text-slate-600 hover:bg-slate-50" onClick={() => selectHistoricalName(search.trim())}>Use “{search.trim()}” without saving to list</button>}
      {customer && auth.can('writeBusinessData') && <button type="button" className="block min-h-10 w-full px-2 text-left text-xs text-slate-600 hover:bg-slate-50" onClick={() => selectHistoricalName('')}>Clear customer</button>}
    </section>}
    {manager && <CustomerInspector returnFocusRef={managerTrigger} fallbackFocusRef={trigger} key={`${manager}:${newName}`} newName={manager==='new' ? newName : null} rows={rows} loading={loading} search={search} offset={offset} onSearch={changeSearch} onPage={setOffset} onClose={closeInspector} onBusyChange={setBusy}
      onSaved={(choice) => { if (manager==='new') applyChoice(choice); else setNotice('Customer saved. Existing captured details are unchanged.'); setManager(null); setRows([]); }}
      onRemoved={() => { setManager(null); setRows([]); setNotice('Removed from the customer list. Existing Jobs and Proposals keep their captured details.'); }} />}
    {canWrite && variant !== 'proposal' && !manager && <details className="text-xs text-slate-500">
      <summary className="cursor-pointer py-1">Project contact details</summary>
      <div className="mt-2 space-y-2 border border-slate-200 p-3 text-slate-700">
        <p>{value.customer_company_id ? 'Linked customer with a separate Job capture. Saved changes do not update this Job.' : 'Customer information entered for this Job.'}</p>
        <div className="flex flex-wrap gap-2"><BusinessButton type="button" disabled={busy} className={action} onClick={() => setProjectEdit(!projectEdit)}>Edit for this Project</BusinessButton>{value.customer_company_id && <BusinessButton type="button" disabled={busy} className={action} onClick={() => void refreshSnapshot()}>Refresh from saved contact</BusinessButton>}</div>
        {projectEdit && <section aria-label="Project contact information" className="grid gap-2 sm:grid-cols-2">
          <p className="sm:col-span-2">Only this Job’s capture changes. Save the Job to keep these edits.</p>
          {(['company_name','contact_name',...optionalFields] as const).map((key) => <label key={key} className="text-xs font-bold">{labels[key]}<BusinessTextarea aria-label={labels[key]} rows={key==='notes'||key==='mailing_address'?2:1} disabled={busy} value={(snapshot ?? emptySnapshot(customer))[key]} maxLength={key==='notes'?8001:key==='mailing_address'?2000:key.includes('phone')?100:key.includes('email')?320:300} onChange={(event) => editSnapshot(key,event.target.value)} className="mt-1 w-full border border-slate-300 p-2 text-sm" /></label>)}
        </section>}
      </div>
    </details>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    {notice && <p role="status" className="text-xs text-slate-600">{notice}</p>}
  </div>;
}

export default function ProjectContactEditor(props: Props) {
  const auth = useAuth();
  return <ProjectContactEditorSession key={`${auth.profile?.userId}:${auth.profile?.role}:${auth.profile?.readOnly}`} {...props} />;
}
