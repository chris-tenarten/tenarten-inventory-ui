'use client';

import { useState } from 'react';
import type { ManpowerReference } from './types';
import { saveProductCategory } from './manpower';

const field = 'h-9 min-w-0 rounded-sm border border-slate-300 bg-white px-2 text-sm';
export default function ProductCategoryManager({ categories, onChanged, onClose }: {
  categories: ManpowerReference[]; onChanged(): Promise<void>; onClose(): void;
}) {
  const [editing, setEditing] = useState<ManpowerReference | 'new' | null>(null);
  const [name, setName] = useState('');
  const [order, setOrder] = useState('1');
  const [showInactive, setShowInactive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function edit(item: ManpowerReference | 'new') {
    setEditing(item); setName(item === 'new' ? '' : item.display_name);
    setOrder(String(item === 'new' ? Math.max(0, ...categories.map((c) => c.sort_order)) + 1 : item.sort_order));
    setError('');
  }
  async function save() {
    if (!editing) return;
    const id = editing === 'new' ? null : editing.id;
    if (!name.trim() || name.trim().toLowerCase() === 'uncategorized') { setError('Enter a category name other than Uncategorized.'); return; }
    if (!Number.isInteger(Number(order)) || Number(order) < 1) { setError('Order must be a positive whole number.'); return; }
    if (categories.some((c) => c.id !== id && c.display_name.toLocaleLowerCase() === name.trim().toLocaleLowerCase())) { setError('A category with that name already exists.'); return; }
    setBusy(true); setError('');
    try {
      await saveProductCategory(id, { display_name: name, sort_order: Number(order), is_active: editing === 'new' || editing.is_active }, editing === 'new' ? undefined : editing.updated_at);
      setEditing(null); await onChanged();
    } catch (caught) { setError(message(caught)); }
    finally { setBusy(false); }
  }
  async function toggle(item: ManpowerReference) {
    setBusy(true); setError('');
    try { await saveProductCategory(item.id, { ...item, is_active: !item.is_active }, item.updated_at); await onChanged(); }
    catch (caught) { setError(message(caught)); }
    finally { setBusy(false); }
  }
  return <section aria-label="Product Categories management" className="mt-4 min-w-0 rounded-sm border border-slate-300 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Product Categories</h2><button type="button" disabled={busy} onClick={() => { if (editing) setError('Save or cancel your category edit before closing.'); else onClose(); }} className="px-3 py-2 text-sm font-semibold">Close categories</button></div>
    <p className="mt-1 text-xs text-slate-600">Renaming updates historical labels. For a different meaning, deactivate the old category and add a new one. Deactivation preserves historical hours.</p>
    <p className="mt-1 text-xs text-slate-600">MISC. is another product or deliverable. General / Shared is labor shared across products. Uncategorized means no category has been assigned.</p>
    <div className="my-3 flex flex-wrap items-center gap-4"><button type="button" disabled={busy || editing !== null} onClick={() => edit('new')} className="rounded-sm bg-slate-900 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Add category</button><label className="text-sm"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="mr-2" />Show inactive</label><button type="button" disabled={busy} onClick={() => void onChanged().catch((caught) => setError(message(caught)))} className="text-sm underline">Refresh categories</button></div>
    {editing && <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="mb-3 flex flex-wrap items-end gap-2 rounded-sm bg-blue-50 p-3">
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs">Category name<input autoFocus required value={name} disabled={busy} onChange={(e) => setName(e.target.value)} className={field} /></label>
      <label className="flex w-24 flex-col gap-1 text-xs">Display order<input type="number" min="1" step="1" required value={order} disabled={busy} onChange={(e) => setOrder(e.target.value)} className={field} /></label>
      <button type="submit" disabled={busy} className="h-9 bg-slate-900 px-3 text-sm font-bold text-white">Save category</button><button type="button" disabled={busy} onClick={() => { setEditing(null); setError(''); }} className="h-9 px-3 text-sm">Cancel category edit</button>
    </form>}
    {error && <p role="alert" className="my-2 text-sm text-red-700">{error}</p>}
    <ul className="divide-y divide-slate-200">{categories.filter((c) => showInactive || c.is_active).map((item) => <li key={item.id} className="flex flex-wrap items-center gap-2 py-2"><span className="w-8 text-sm tabular-nums text-slate-500">{item.sort_order}</span><span className="min-w-32 flex-1 break-words text-sm font-semibold">{item.display_name}</span><span className="text-xs text-slate-500">{item.is_active ? 'Active' : 'Inactive'}</span><button type="button" disabled={busy || editing !== null} onClick={() => edit(item)} aria-label={`Edit ${item.display_name}`} className="px-2 py-2 text-sm text-blue-800 disabled:opacity-50">Rename / Reorder</button><button type="button" disabled={busy || editing !== null} onClick={() => void toggle(item)} aria-label={`${item.is_active ? 'Deactivate' : 'Reactivate'} ${item.display_name}`} className="px-2 py-2 text-sm text-blue-800 disabled:opacity-50">{item.is_active ? 'Deactivate' : 'Reactivate'}</button></li>)}</ul>
  </section>;
}
function message(caught: unknown) {
  const value = caught && typeof caught === 'object' && 'message' in caught ? String(caught.message) : 'Unable to save category.';
  if (/duplicate|unique/i.test(value)) return 'A category with that name already exists.';
  if (/0 rows|multiple \(or no\) rows|Cannot coerce/i.test(value)) return 'The category changed or access was denied. Cancel the edit, refresh categories, and try again.';
  return value;
}
