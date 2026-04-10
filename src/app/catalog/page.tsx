'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type CatalogRow = {
  id: string;
  vendor: string;
  item_name: string;
  size: string;
  category: string;
  material_class: string;
  unit: string;
  source_file: string;
  notes: string;
  match_warning: string;
  appearance_notes: string;
  price: string | number;
  price_basis: string;
  updated_at?: string;
};

export default function CatalogPage() {
  const [catalogRows, setCatalogRows] = useState<CatalogRow[]>([]);
  const [recentAnnotations, setRecentAnnotations] = useState<CatalogRow[]>([]);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState<CatalogRow | null>(null);

  const [notes, setNotes] = useState('');
  const [matchWarning, setMatchWarning] = useState('');
  const [appearanceNotes, setAppearanceNotes] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [loadError, setLoadError] = useState('');

  // 🔹 debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);

    return () => clearTimeout(t);
  }, [search]);

  // 🔹 fetch search results
  useEffect(() => {
    async function loadCatalog() {
      let query = supabase
        .from('vendor_catalog')
        .select('*')
        .order('vendor', { ascending: true })
        .order('item_name', { ascending: true })
        .limit(100);

      if (debouncedSearch) {
        const term = debouncedSearch.toLowerCase();

        query = query.or(
          `item_name.ilike.%${term}%,vendor.ilike.%${term}%,category.ilike.%${term}%,material_class.ilike.%${term}%`
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to load:', error);
        setLoadError(error.message);
        return;
      }

      setCatalogRows(data || []);
    }

    loadCatalog();
  }, [debouncedSearch]);

  // 🔹 fetch recent annotations
  useEffect(() => {
    async function loadRecentAnnotations() {
      const { data, error } = await supabase
        .from('vendor_catalog')
        .select('*')
        .or(
          'notes.not.is.null,match_warning.not.is.null,appearance_notes.not.is.null'
        )
        .order('updated_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Failed to load recent annotations:', error);
        return;
      }

      setRecentAnnotations(data || []);
    }

    loadRecentAnnotations();
  }, []);

  async function handleSaveAnnotation() {
    if (!selected) return;

    setIsSaving(true);
    setSaveMessage('');

    const { error } = await supabase
      .from('vendor_catalog')
      .update({
        notes,
        match_warning: matchWarning,
        appearance_notes: appearanceNotes,
      })
      .eq('id', selected.id);

    if (error) {
      console.error('Failed to save annotation:', error);
      setSaveMessage(`Failed to save: ${error.message}`);
      setIsSaving(false);
      return;
    }

    const updatedRow: CatalogRow = {
      ...selected,
      notes,
      match_warning: matchWarning,
      appearance_notes: appearanceNotes,
    };

    setSelected(updatedRow);
    setCatalogRows((prev) =>
      prev.map((row) => (row.id === selected.id ? updatedRow : row))
    );

    // refresh recent annotations after save
    const { data } = await supabase
      .from('vendor_catalog')
      .select('*')
      .or(
        'notes.not.is.null,match_warning.not.is.null,appearance_notes.not.is.null'
      )
      .order('updated_at', { ascending: false })
      .limit(10);

    setRecentAnnotations(data || []);

    setSaveMessage('Annotation saved.');
    setIsSaving(false);
  }

  return (
    <div className="min-h-[calc(100vh-73px)] bg-black p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-[#f7f0d0]">Catalog</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Search vendor materials, review details, and save mismatch annotations.
          </p>
        </div>

        {/* 🔥 NEW: RECENT ANNOTATIONS */}
        <div className="mb-6 rounded border border-neutral-800 p-4">
          <h2 className="mb-3 text-lg text-yellow-400">Recent Annotations</h2>

          {recentAnnotations.length === 0 ? (
            <div className="text-neutral-500 text-sm">
              No annotated entries yet.
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {recentAnnotations.map((row) => (
                <div
                  key={row.id}
                  onClick={() => {
                    setSelected(row);
                    setNotes(row.notes || '');
                    setMatchWarning(row.match_warning || '');
                    setAppearanceNotes(row.appearance_notes || '');
                    setSaveMessage('');
                  }}
                  className="cursor-pointer rounded border border-neutral-700 bg-neutral-900 p-3 hover:bg-neutral-800"
                >
                  <div className="font-medium">{row.item_name}</div>
                  <div className="text-xs text-neutral-400">
                    {row.vendor} • {row.size || '—'}
                  </div>

                  {row.match_warning && (
                    <div className="mt-1 text-xs text-red-400">
                      ⚠ {row.match_warning}
                    </div>
                  )}

                  {row.notes && (
                    <div className="mt-1 text-xs text-neutral-300 line-clamp-2">
                      {row.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-6">
          <input
            className="w-full rounded border border-neutral-700 bg-neutral-900 p-3"
            placeholder="Search material (item, vendor, size, unit)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loadError && (
          <div className="mb-4 rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
            Failed to load catalog: {loadError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* RESULTS */}
          <div className="rounded border border-neutral-800 p-4">
            <h2 className="mb-3 text-lg">Results</h2>

            {search.trim() === '' ? (
              <div className="text-neutral-500">Start typing to search the catalog.</div>
            ) : catalogRows.length === 0 ? (
              <div className="text-neutral-500">No matching materials found.</div>
            ) : (
              <div className="max-h-[500px] space-y-2 overflow-y-auto">
                {catalogRows.map((row) => (
                  <div
                    key={row.id}
                    onClick={() => {
                      setSelected(row);
                      setNotes(row.notes || '');
                      setMatchWarning(row.match_warning || '');
                      setAppearanceNotes(row.appearance_notes || '');
                      setSaveMessage('');
                    }}
                    className={`cursor-pointer rounded border p-3 ${
                      selected?.id === row.id
                        ? 'border-yellow-600 bg-neutral-800'
                        : 'border-transparent bg-neutral-900 hover:bg-neutral-800'
                    }`}
                  >
                    <div className="font-medium">{row.item_name}</div>
                    <div className="text-sm text-neutral-400">
                      {row.vendor} • {row.size || '—'} • {row.unit || '—'}
                    </div>

                    {row.match_warning && (
                      <div className="mt-1 text-xs text-red-400">
                        ⚠ {row.match_warning}
                      </div>
                    )}

                    {row.notes && (
                      <div className="mt-1 text-xs text-yellow-300">
                        Annotated
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DETAILS */}
          <div className="rounded border border-neutral-800 p-4">
            <h2 className="mb-3 text-lg">Details & Annotation</h2>

            {selected ? (
              <div className="space-y-4">
                <div><div className="text-sm text-neutral-400">Vendor</div><div>{selected.vendor}</div></div>
                <div><div className="text-sm text-neutral-400">Item</div><div>{selected.item_name}</div></div>
                <div><div className="text-sm text-neutral-400">Size</div><div>{selected.size || '—'}</div></div>
                <div><div className="text-sm text-neutral-400">Unit</div><div>{selected.unit || '—'}</div></div>
                <div><div className="text-sm text-neutral-400">Category</div><div>{selected.category || '—'}</div></div>
                <div><div className="text-sm text-neutral-400">Material Class</div><div>{selected.material_class || '—'}</div></div>

                <div>
                  <label className="text-sm text-neutral-400">Notes</label>
                  <textarea className="w-full rounded border border-neutral-700 bg-neutral-900 p-2"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                  />
                </div>

                <div>
                  <label className="text-sm text-neutral-400">Match Warning</label>
                  <textarea className="w-full rounded border border-neutral-700 bg-neutral-900 p-2"
                    value={matchWarning}
                    onChange={(e) => setMatchWarning(e.target.value)}
                    rows={3}
                  />
                </div>

                <div>
                  <label className="text-sm text-neutral-400">Appearance Notes</label>
                  <textarea className="w-full rounded border border-neutral-700 bg-neutral-900 p-2"
                    value={appearanceNotes}
                    onChange={(e) => setAppearanceNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    className="rounded bg-yellow-600 px-4 py-2 text-black hover:bg-yellow-500 disabled:opacity-60"
                    onClick={handleSaveAnnotation}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Annotation'}
                  </button>

                  {saveMessage && (
                    <div className="text-sm text-neutral-300">{saveMessage}</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-neutral-500">Select a material to view details.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}