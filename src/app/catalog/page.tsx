'use client';

import { useEffect, useState } from 'react';
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
  annotated_by: string;
  price: string | number;
  price_basis: string;
  updated_at?: string;
};

function hasAnnotation(row: Partial<CatalogRow>) {
  return Boolean(
    row.notes?.trim() ||
      row.match_warning?.trim() ||
      row.appearance_notes?.trim()
  );
}

function formatAnnotationSummary(row: CatalogRow) {
  if (row.match_warning?.trim()) return row.match_warning.trim();
  if (row.notes?.trim()) return row.notes.trim();
  if (row.appearance_notes?.trim()) return row.appearance_notes.trim();
  return 'Annotated entry';
}

export default function CatalogPage() {
  const [catalogRows, setCatalogRows] = useState<CatalogRow[]>([]);
  const [recentAnnotations, setRecentAnnotations] = useState<CatalogRow[]>([]);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState<CatalogRow | null>(null);

  const [notes, setNotes] = useState('');
  const [matchWarning, setMatchWarning] = useState('');
  const [appearanceNotes, setAppearanceNotes] = useState('');
  const [annotatedBy, setAnnotatedBy] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    async function loadCatalog() {
      setLoadError('');

      let query = supabase
        .from('vendor_catalog')
        .select('*')
        .order('vendor', { ascending: true })
        .order('item_name', { ascending: true })
        .limit(100);

      if (debouncedSearch) {
        const term = debouncedSearch.toLowerCase();
        query = query.or(
          `item_name.ilike.%${term}%,vendor.ilike.%${term}%,size.ilike.%${term}%,unit.ilike.%${term}%,category.ilike.%${term}%,material_class.ilike.%${term}%`
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to load catalog:', error);
        setLoadError(error.message);
        return;
      }

      setCatalogRows((data as CatalogRow[]) || []);
    }

    loadCatalog();
  }, [debouncedSearch]);

  useEffect(() => {
    async function loadRecentAnnotations() {
      const { data, error } = await supabase
        .from('vendor_catalog')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Failed to load recent annotations:', error);
        return;
      }

      const recent = ((data as CatalogRow[]) || [])
        .filter((row) => hasAnnotation(row))
        .slice(0, 8);

      setRecentAnnotations(recent);
    }

    loadRecentAnnotations();
  }, []);

  function selectRow(row: CatalogRow) {
    setSelected(row);
    setNotes(row.notes || '');
    setMatchWarning(row.match_warning || '');
    setAppearanceNotes(row.appearance_notes || '');
    setAnnotatedBy(row.annotated_by || '');
    setSaveMessage('');
  }

  async function refreshRecentAnnotations() {
    const { data, error } = await supabase
      .from('vendor_catalog')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Failed to refresh recent annotations:', error);
      return;
    }

    const recent = ((data as CatalogRow[]) || [])
      .filter((row) => hasAnnotation(row))
      .slice(0, 8);

    setRecentAnnotations(recent);
  }

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
        annotated_by: annotatedBy.trim() || null,
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
      annotated_by: annotatedBy.trim(),
      updated_at: new Date().toISOString(),
    };

    setSelected(updatedRow);
    setCatalogRows((prev) =>
      prev.map((row) => (row.id === selected.id ? updatedRow : row))
    );

    await refreshRecentAnnotations();

    setSaveMessage('Annotation saved.');
    setIsSaving(false);
  }

  return (
    <div className="min-h-[calc(100vh-73px)] bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#f7f0d0]">
            Catalog
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-neutral-400">
            Search vendor materials, review details, and save mismatch annotations.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
          <label
            htmlFor="catalog-search"
            className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-neutral-500"
          >
            Search
          </label>
          <input
            id="catalog-search"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
            placeholder="Search material, vendor, size, unit, or category"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loadError && (
          <div className="rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
            Failed to load catalog: {loadError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Results</h2>
              {search.trim() !== '' && (
                <span className="text-xs text-neutral-500">
                  {catalogRows.length} shown
                </span>
              )}
            </div>

            {search.trim() === '' ? (
              <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-950/60 p-6 text-sm text-neutral-500">
                Start typing to search the catalog.
              </div>
            ) : catalogRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-950/60 p-6 text-sm text-neutral-500">
                No matching materials found.
              </div>
            ) : (
              <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                {catalogRows.map((row) => {
                  const isSelected = selected?.id === row.id;
                  const annotated = hasAnnotation(row);

                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => selectRow(row)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                        isSelected
                          ? 'border-[#c8a43a] bg-neutral-900 shadow-[inset_0_0_0_1px_rgba(200,164,58,0.35)]'
                          : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700 hover:bg-neutral-900'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-white">
                            {row.item_name}
                          </div>
                          <div className="mt-1 text-sm text-neutral-400">
                            {row.vendor} • {row.size || '—'} • {row.unit || '—'}
                          </div>
                        </div>

                        {annotated && (
                          <span className="shrink-0 rounded-full border border-yellow-700/60 bg-yellow-950/40 px-2 py-1 text-[11px] font-medium text-yellow-300">
                            Annotated
                          </span>
                        )}
                      </div>

                      {row.match_warning?.trim() && (
                        <div className="mt-2 text-xs text-red-400">
                          {row.match_warning}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
            <h2 className="mb-4 text-lg font-semibold text-white">
              Details & Annotation
            </h2>

            {selected ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                      Vendor
                    </div>
                    <div>{selected.vendor}</div>
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                      Item
                    </div>
                    <div>{selected.item_name}</div>
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                      Size
                    </div>
                    <div>{selected.size || '—'}</div>
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                      Unit
                    </div>
                    <div>{selected.unit || '—'}</div>
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                      Category
                    </div>
                    <div>{selected.category || '—'}</div>
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                      Material Class
                    </div>
                    <div>{selected.material_class || '—'}</div>
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                      Price
                    </div>
                    <div>{selected.price || '—'}</div>
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                      Price Basis
                    </div>
                    <div>{selected.price_basis || '—'}</div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    Annotated By
                  </label>
                  <input
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                    value={annotatedBy}
                    onChange={(e) => setAnnotatedBy(e.target.value)}
                    placeholder="Name"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    Notes
                  </label>
                  <textarea
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    Match Warning
                  </label>
                  <textarea
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                    value={matchWarning}
                    onChange={(e) => setMatchWarning(e.target.value)}
                    rows={3}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    Appearance Notes
                  </label>
                  <textarea
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                    value={appearanceNotes}
                    onChange={(e) => setAppearanceNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    className="rounded-xl bg-[#c8a43a] px-4 py-2.5 font-medium text-black transition hover:bg-[#d6b24a] disabled:cursor-not-allowed disabled:opacity-60"
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
              <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-950/60 p-6 text-sm text-neutral-500">
                Select a material to view details.
              </div>
            )}
          </section>
        </div>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-300">
              Recent Annotations
            </h2>
            <span className="text-xs text-neutral-500">
              Latest catalog notes and warnings
            </span>
          </div>

          {recentAnnotations.length === 0 ? (
            <div className="text-sm text-neutral-500">No annotated entries yet.</div>
          ) : (
            <div className="divide-y divide-neutral-800">
              {recentAnnotations.slice(0, 8).map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => selectRow(row)}
                  className="flex w-full items-start justify-between gap-4 py-3 text-left transition hover:bg-neutral-900/50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-white">
                        {row.item_name}
                      </div>
                      <span className="rounded-full border border-yellow-700/60 bg-yellow-950/40 px-2 py-1 text-[11px] font-medium text-yellow-300">
                        Annotated
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {row.vendor} • {row.size || '—'}
                      {row.annotated_by?.trim() ? ` • ${row.annotated_by}` : ''}
                    </div>
                    <div className="mt-1 truncate text-xs text-neutral-400">
                      {formatAnnotationSummary(row)}
                    </div>
                  </div>

                  {row.match_warning?.trim() && (
                    <span className="shrink-0 rounded-full border border-red-800/70 bg-red-950/40 px-2 py-1 text-[11px] text-red-300">
                      Warning
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}