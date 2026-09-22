'use client';

import { GripVertical, MoreHorizontal, Pencil, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ManpowerReference } from './types';
import { saveProductCategoryOrder } from './manpower';
import { activeCategories, normalizeCategories } from './category-order';

const button = 'inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-sm px-2 text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-40';
export default function ProductCategoryManager({ categories, onChanged, onEditingChange }: {
  categories: ManpowerReference[]; onChanged(): Promise<void>; onEditingChange(locked: boolean): void;
}) {
  const [editing, setEditing] = useState<ManpowerReference | 'new' | null>(null);
  const [name, setName] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; over: string; after: boolean } | null>(null);
  const root = useRef<HTMLElement>(null);
  const saving = useRef(false);
  const active = activeCategories(categories);
  const locked = busy || editing !== null || needsRefresh;
  useEffect(() => { onEditingChange(busy || editing !== null); }, [busy, editing, onEditingChange]);
  function focus(control: string) {
    requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(`[data-control="${control}"]`)?.focus());
  }
  function edit(item: ManpowerReference | 'new') {
    setMenu(null); setEditing(item); setName(item === 'new' ? '' : item.display_name); setError(''); setStatus('');
  }
  async function commit(desired: ManpowerReference[], announcement: string, control: string, addedName?: string) {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(''); setStatus(''); setMenu(null); setDrag(null);
    try {
      await saveProductCategoryOrder(categories, desired, addedName);
      setEditing(null);
      await onChanged();
      setNeedsRefresh(false); setStatus(announcement);
    } catch (caught) {
      setEditing(null);
      const detail = caught && typeof caught === 'object' && 'message' in caught ? String(caught.message) : 'Request failed.';
      setError(`Changes may have partially saved. ${detail} Review the refreshed list before retrying; use Normalize order if positions have gaps.`);
      try { await onChanged(); setNeedsRefresh(false); }
      catch { setNeedsRefresh(true); setError('The result is uncertain and categories could not be refreshed. Refresh categories before making further changes.'); }
    } finally { saving.current = false; setBusy(false); focus(control); }
  }
  function save() {
    if (!editing) return;
    const value = name.trim();
    if (!value || value.toLowerCase() === 'uncategorized') { setError('Enter a category name other than Uncategorized.'); return; }
    if (categories.some(c => c.id !== (editing === 'new' ? null : editing.id) && c.display_name.trim().toLocaleLowerCase() === value.toLocaleLowerCase())) { setError('A category with that name already exists.'); return; }
    if (editing === 'new') void commit(normalizeCategories(categories), `${value} added at the end.`, 'add', value);
    else void commit(categories.map(c => c.id === editing.id ? { ...c, display_name: value } : c), 'Category renamed. Labor history preserved.', `edit-${editing.id}`);
  }
  function toggle(item: ManpowerReference) {
    const ids = active.filter(c => c.id !== item.id).map(c => c.id);
    if (!item.is_active) ids.push(item.id);
    const desired = normalizeCategories(categories.map(c => c.id === item.id ? { ...c, is_active: !c.is_active } : c), ids);
    void commit(desired, `${item.display_name} ${item.is_active ? 'deactivated' : 'reactivated at the end'}.`, item.is_active ? 'add' : `handle-${item.id}`);
  }
  function move(id: string, index: number) {
    const ids = active.map(c => c.id); const from = ids.indexOf(id);
    if (from < 0 || index < 0 || index >= ids.length || from === index || locked) return;
    ids.splice(from, 1); ids.splice(index, 0, id);
    void commit(normalizeCategories(categories, ids), `${active[from].display_name} moved to position ${index + 1} of ${ids.length}.`, `handle-${id}`);
  }
  async function refresh() {
    if (saving.current) return;
    setBusy(true);
    try { await onChanged(); setNeedsRefresh(false); setError(''); setStatus('Categories refreshed.'); }
    catch { setNeedsRefresh(true); setError('Unable to refresh categories. Try again before making changes.'); }
    finally { setBusy(false); }
  }
  function actions(item: ManpowerReference, index?: number) {
    return <>
      <button type="button" data-control={`edit-${item.id}`} disabled={locked} aria-label={`Edit ${item.display_name}`} onClick={() => edit(item)} className={button}><Pencil size={16} aria-hidden="true" /></button>
      <div className="relative" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setMenu(null); }} onKeyDown={e => { if (e.key === 'Escape') { setMenu(null); focus(`actions-${item.id}`); } }}>
        <button type="button" data-control={`actions-${item.id}`} disabled={locked} aria-label={`Actions for ${item.display_name}`} aria-expanded={menu === item.id} aria-controls={`category-actions-${item.id}`} onClick={() => setMenu(menu === item.id ? null : item.id)} className={button}><MoreHorizontal size={18} aria-hidden="true" /></button>
        {menu === item.id && <div id={`category-actions-${item.id}`} className="absolute right-0 top-10 z-20 w-44 rounded-sm border border-slate-300 bg-white p-1 shadow-lg">
          {index !== undefined && <><button type="button" disabled={index === 0} className={`${button} w-full justify-start`} onClick={() => move(item.id, index - 1)}>Move up</button><button type="button" disabled={index === active.length - 1} className={`${button} w-full justify-start`} onClick={() => move(item.id, index + 1)}>Move down</button></>}
          <button type="button" aria-label={`${item.is_active ? 'Deactivate' : 'Reactivate'} ${item.display_name}`} className={`${button} w-full justify-start`} onClick={() => toggle(item)}>{item.is_active ? 'Deactivate' : 'Reactivate'}</button>
        </div>}
      </div>
    </>;
  }
  return <section ref={root} aria-label="Product Categories management" className="flex min-h-0 min-w-0 flex-col">
    <div className="shrink-0">
    <p className="text-xs leading-relaxed text-slate-600">Manage the Product Categories available when entering labor. Renaming preserves labor history; deactivate categories no longer in use.</p>
    <p className="mt-1 text-xs text-slate-500">MISC. covers other products or deliverables. Historical entries without a category remain Uncategorized.</p>
    <div className="my-3 flex flex-wrap items-center gap-2">
      <button type="button" data-control="add" disabled={locked} onClick={() => edit('new')} className={`${button} border border-slate-300 text-xs font-bold`}><Plus size={16} aria-hidden="true" /> Add Category</button>
      <label className="flex min-h-10 items-center gap-2 text-xs"><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />Show inactive</label>
      <button type="button" disabled={busy || editing !== null} onClick={() => void refresh()} className={`${button} text-xs`}>Refresh categories</button>
    </div>
    {editing && <form onSubmit={e => { e.preventDefault(); save(); }} className="mb-3 flex flex-wrap items-end gap-2 rounded-sm bg-blue-50 p-3">
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs">Category name<input autoFocus required disabled={busy} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Escape' && !busy) { const control = editing === 'new' ? 'add' : `edit-${editing.id}`; setEditing(null); setError(''); focus(control); } }} className="h-10 min-w-0 rounded-sm border border-slate-300 bg-white px-2 text-sm" /></label>
      <button type="submit" disabled={busy} className={`${button} bg-slate-900 text-white hover:bg-slate-700`}>Save category</button>
      <button type="button" disabled={busy} onClick={() => { const control = editing === 'new' ? 'add' : `edit-${editing.id}`; setEditing(null); setError(''); focus(control); }} className={button}>Cancel category edit</button>
    </form>}
    {error && <p role="alert" className="my-2 text-sm text-red-700">{error}</p>}
    <p role="status" className="text-xs text-slate-600">{busy ? 'Saving / refreshing categories…' : status}</p>
    <p id="category-reorder-help" className="mb-2 mt-2 text-xs text-slate-500">Drag a handle to reorder, use its ↑ / ↓ keys, or choose Move up / down from Actions.</p>
    {active.some((c, i) => c.sort_order !== i + 1) && <button type="button" disabled={locked} className={`${button} mb-2 border border-amber-300 text-xs`} onClick={() => void commit(normalizeCategories(categories), 'Active order normalized.', 'add')}>Normalize order</button>}
    </div>
    <div data-settings-list className="min-h-0 overflow-y-auto overscroll-contain">
    <ol aria-label="Active Categories" className="divide-y divide-slate-200 border-y border-slate-200">
      {active.map((item, index) => <li key={item.id} data-category-id={item.id} onDragOver={e => { if (!drag || locked) return; e.preventDefault(); const rect = e.currentTarget.getBoundingClientRect(); setDrag({ ...drag, over: item.id, after: e.clientY > rect.top + rect.height / 2 }); }} onDrop={e => {
        e.preventDefault(); if (!drag || locked) return;
        const ids = active.map(c => c.id); const from = ids.indexOf(drag.id); const target = index + (drag.after ? 1 : 0); move(drag.id, target > from ? target - 1 : target); setDrag(null);
      }} className={`flex min-w-0 items-center gap-1 py-1 ${drag?.id === item.id ? 'opacity-50' : ''} ${drag?.over === item.id ? drag.after ? 'border-b-2 border-b-blue-600 bg-blue-50' : 'border-t-2 border-t-blue-600 bg-blue-50' : ''}`}>
        <button type="button" data-control={`handle-${item.id}`} disabled={locked} draggable={!locked} onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', item.id); setDrag({ id: item.id, over: item.id, after: false }); }} onDragEnd={() => setDrag(null)} onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); move(item.id, index + (e.key === 'ArrowUp' ? -1 : 1)); } }} aria-label={`Reorder ${item.display_name}, position ${index + 1} of ${active.length}`} aria-describedby="category-reorder-help" className={`${button} cursor-grab active:cursor-grabbing`}><GripVertical size={18} aria-hidden="true" /></button>
        <span className="w-6 shrink-0 text-xs tabular-nums text-slate-500">{index + 1}</span><span className="min-w-0 flex-1 break-words text-sm font-medium">{item.display_name}</span>{actions(item, index)}
      </li>)}
    </ol>
    {!active.length && <p className="py-3 text-sm text-slate-500">No active categories. Add or reactivate a category to enter labor.</p>}
    {showInactive && <section aria-label="Inactive Categories" className="mt-5"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Inactive Categories</h3><ul className="mt-2 divide-y divide-slate-200">{categories.filter(c => !c.is_active).map(item => <li key={item.id} className="flex min-w-0 items-center gap-1 py-1"><span className="min-w-0 flex-1 break-words text-sm text-slate-600">{item.display_name}</span><span className="text-xs text-slate-500">Inactive</span><button type="button" disabled={locked} onClick={() => toggle(item)} aria-label={`Reactivate ${item.display_name}`} className={`${button} text-xs`}>Reactivate</button>{actions(item)}</li>)}</ul></section>}
    </div>
  </section>;
}
