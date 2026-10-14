'use client';
import { useEffect, useRef, useState } from 'react';
import { BusinessButton, BusinessInput, BusinessSelect } from '@/components/BusinessWriteControls';
import { useAuth } from '@/lib/auth';
import type { Contact, ContactChoice } from './model';
import { archiveCustomer, CONTACT_PAGE_SIZE, listCompanyContacts, saveCustomer } from './queries';

const field = 'mt-1 h-10 w-full rounded-sm border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:bg-slate-50';
const button = 'min-h-9 rounded-sm border border-slate-300 px-3 py-1 text-sm font-semibold disabled:opacity-50';
const errorMessage = (cause: unknown) => cause && typeof cause === 'object' && 'message' in cause ? String(cause.message) : 'Unable to save customer.';
export type CustomerSearchProps = {
  rows: ContactChoice[]; loading: boolean; search: string; offset: number;
  onSearch: (search: string) => void; onPage: (offset: number) => void;
};
type Props = CustomerSearchProps & {
  newName: string | null; onClose: () => void;
  onSaved: (choice: ContactChoice) => void; onRemoved: () => void;
  onBusyChange: (busy: boolean) => void;
};

export default function CustomerInspector({ newName, rows, loading, search, offset, onSearch, onPage, onClose, onSaved, onRemoved, onBusyChange }: Props) {
  const auth = useAuth();
  const canCreate = auth.can('writeBusinessData') && (auth.can('createProductionJob') || auth.can('editProductionJobRoutine') || auth.can('editProductionJobDetails'));
  const canShared = auth.can('writeBusinessData') && auth.can('editProductionJobDetails');
  // undefined = list; null = new customer; a choice = existing customer.
  const [editing, setEditing] = useState<ContactChoice | null | undefined>(newName === null ? undefined : null);
  const [name, setName] = useState(newName ?? '');
  const [person, setPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactOffset, setContactOffset] = useState(0);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const operation = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const allowed = editing ? canShared : canCreate;

  useEffect(() => {
    if (editing !== undefined) nameRef.current?.focus();
  }, [editing]);
  useEffect(() => {
    if (!detailsOpen || !editing) return;
    let live = true;
    setContactsLoading(true);
    void listCompanyContacts(editing.company.id, contactOffset).then((next) => { if (live) setContacts(next); })
      .catch((cause) => { if (live) setError(errorMessage(cause)); })
      .finally(() => { if (live) setContactsLoading(false); });
    return () => { live = false; };
  }, [detailsOpen, editing, contactOffset]);

  function openCustomer(choice: ContactChoice | null) {
    setEditing(choice); setName(choice?.company.name ?? '');
    setSelectedContact(choice?.contact ?? null); setPerson(choice?.contact?.name ?? '');
    setPhone(choice?.contact?.phone ?? choice?.company.phone ?? '');
    setEmail(choice?.contact?.email ?? choice?.company.email ?? '');
    setDetailsOpen(false); setContacts([]); setContactOffset(0); setError('');
  }
  function chooseContact(id: string) {
    const contact = [...contacts, ...(editing?.contact ? [editing.contact] : [])].find((item) => item.id === id) ?? null;
    setSelectedContact(contact); setPerson(contact?.name ?? '');
    setPhone(contact?.phone ?? editing?.company.phone ?? '');
    setEmail(contact?.email ?? editing?.company.email ?? '');
  }
  async function save() {
    if (!allowed || !name.trim() || operation.current) return;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email address or leave it blank.'); return; }
    operation.current = true; setBusy(true); onBusyChange(true); setError('');
    try {
      const named = Boolean(person.trim());
      const company = { ...(editing?.company ?? {}), name: name.trim(),
        ...(!named ? { phone: phone.trim(), email: email.trim() } : {}) };
      const contact = named ? { ...(selectedContact ?? {}), name: person.trim(), phone: phone.trim(), email: email.trim() } : null;
      onSaved(await saveCustomer(company, contact));
    } catch (cause) { setError(errorMessage(cause)); }
    finally { operation.current = false; setBusy(false); onBusyChange(false); }
  }
  async function remove() {
    if (!editing || !canShared || operation.current) return;
    if (!window.confirm(`Remove ${editing.company.name} from the customer list? Existing Jobs will keep their customer names and captured information.`)) return;
    operation.current = true; setBusy(true); onBusyChange(true); setError('');
    try { await archiveCustomer(editing.company); onRemoved(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { operation.current = false; setBusy(false); onBusyChange(false); }
  }
  return <section role="dialog" aria-label="Customer Inspector" onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!busy) onClose(); } }} className="space-y-3 rounded-sm border-2 border-blue-200 bg-slate-50 p-3 sm:p-4">
    <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-bold">{editing === undefined ? 'Manage Customer List' : editing ? 'Customer Inspector' : 'Add New Customer'}</h4><button type="button" disabled={busy} onClick={onClose} className={button}>Cancel</button></div>
    {editing === undefined ? <>
      <label className="block text-xs font-bold">Search customers<input autoFocus aria-label="Search managed customers" value={search} maxLength={300} onChange={(event) => onSearch(event.target.value)} className={field} /></label>
      {loading ? <p role="status" className="text-sm">Loading customers…</p> : <>
        <ul className="max-h-52 overflow-auto divide-y divide-slate-200">{rows.slice(0,CONTACT_PAGE_SIZE).map((choice) => <li key={choice.company.id}><button type="button" className="min-h-10 w-full px-2 py-2 text-left text-sm hover:bg-blue-50" onClick={() => openCustomer(choice)}>{choice.company.name}</button></li>)}</ul>
        {!rows.length && <p className="text-sm text-slate-600">No customers found.</p>}
        <div className="flex gap-2"><button type="button" className={button} disabled={!offset} onClick={() => onPage(Math.max(0,offset-CONTACT_PAGE_SIZE))}>Previous</button><button type="button" className={button} disabled={rows.length<=CONTACT_PAGE_SIZE || offset>=10000} onClick={() => onPage(offset+CONTACT_PAGE_SIZE)}>Next</button></div>
      </>}
      {canCreate && <BusinessButton type="button" className={button} onClick={() => openCustomer(null)}>+ Add New Customer</BusinessButton>}
    </> : <>
      <label className="block text-xs font-bold">Customer / Company Name *<BusinessInput ref={nameRef} aria-label="Customer / Company Name" value={name} required maxLength={300} disabled={busy || !allowed} onChange={(event) => setName(event.target.value)} className={field} /></label>
      <details open={detailsOpen} onToggle={(event) => setDetailsOpen(event.currentTarget.open)}>
        <summary className="min-h-8 cursor-pointer py-1 text-xs font-bold">Additional Information (Optional)</summary>
        <div className="mt-2 space-y-3">
          {editing && (contacts.length>0 || selectedContact) && <div>
            <label className="block text-xs font-bold">Saved contact (optional)<BusinessSelect aria-label="Saved contact" value={selectedContact?.id ?? ''} disabled={busy || !allowed || contactsLoading} onChange={(event) => chooseContact(event.target.value)} className={field}><option value="">None / enter a new contact</option>{[...contacts.slice(0,CONTACT_PAGE_SIZE), ...(selectedContact && !contacts.slice(0,CONTACT_PAGE_SIZE).some((item) => item.id===selectedContact.id) ? [selectedContact] : [])].map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</BusinessSelect></label>
            {(contactOffset>0 || contacts.length>CONTACT_PAGE_SIZE) && <div className="mt-1 flex gap-2"><button type="button" className={button} disabled={!contactOffset || contactsLoading} onClick={() => setContactOffset(Math.max(0,contactOffset-CONTACT_PAGE_SIZE))}>Previous contacts</button><button type="button" className={button} disabled={contacts.length<=CONTACT_PAGE_SIZE || contactsLoading || contactOffset>=10000} onClick={() => setContactOffset(contactOffset+CONTACT_PAGE_SIZE)}>Next contacts</button></div>}
          </div>}
          <label className="block text-xs font-bold">Contact Name<BusinessInput aria-label="Contact Name" value={person} maxLength={300} disabled={busy || !allowed} onChange={(event) => setPerson(event.target.value)} className={field} /></label>
          <label className="block text-xs font-bold">Phone Number<BusinessInput aria-label="Phone Number" type="tel" value={phone} maxLength={100} disabled={busy || !allowed} onChange={(event) => setPhone(event.target.value)} className={field} /></label>
          <label className="block text-xs font-bold">Email Address<BusinessInput aria-label="Email Address" type="email" value={email} maxLength={320} disabled={busy || !allowed} onChange={(event) => setEmail(event.target.value)} className={field} /></label>
        </div>
      </details>
      {editing && <p className="text-xs text-slate-500">Saved changes apply to future selections. Existing Jobs keep their captured information.</p>}
      {editing && !canShared && <p className="text-xs text-slate-600">Lead/Admin access is required to edit or remove a saved customer.</p>}
      <div className="flex flex-wrap justify-end gap-2">
        {editing && canShared && <BusinessButton type="button" className={`${button} mr-auto text-red-700`} disabled={busy} onClick={() => void remove()}>Remove From List</BusinessButton>}
        {newName === null && <button type="button" disabled={busy} className={button} onClick={() => { setEditing(undefined); setError(''); }}>Back to list</button>}
        {allowed && <BusinessButton type="button" className={`${button} border-blue-900 bg-blue-900 text-white`} disabled={busy || !name.trim()} onClick={() => void save()}>{busy ? 'Saving…' : editing ? 'Save Changes' : 'Save Customer'}</BusinessButton>}
      </div>
    </>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
