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
};

const INITIAL_BROWSE_LIMIT = 250;

function sortCatalogRows(rows: CatalogRow[]) {
  return [...rows].sort((a, b) => {
    const itemCompare = (a.item_name || '').localeCompare(b.item_name || '');
    if (itemCompare !== 0) return itemCompare;

    const vendorCompare = (a.vendor || '').localeCompare(b.vendor || '');
    if (vendorCompare !== 0) return vendorCompare;

    return (a.size || '').localeCompare(b.size || '');
  });
}

export default function CatalogPage() {
  const [catalogRows, setCatalogRows] = useState<CatalogRow[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [notes, setNotes] = useState('');
  const [matchWarning, setMatchWarning] = useState('');
  const [appearanceNotes, setAppearanceNotes] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    async function loadCatalog() {
      const { data, error } = await supabase.from('vendor_catalog').select('*');

      if (error) {
        console.error('Failed to load catalog:', error);
        setLoadError(error.message);
        return;
      }

      const cleaned: CatalogRow[] = (data || []).map((row) => ({
        id: row.id,
        vendor: row.vendor || '',
        item_name: row.item_name || '',
        size: row.size || '',
        category: row.category || '',
        material_class: row.material_class || '',
        unit: row.unit || '',
        source_file: row.source_file || '',
        notes: row.notes || '',
        match_warning: row.match_warning || '',
        appearance_notes: row.appearance_notes || '',
        price: row.price || '',
        price_basis: row.price_basis || '',
      }));

      setCatalogRows(cleaned);
      if (cleaned.length > 0) {
        setSelectedId(sortCatalogRows(cleaned)[0].id);
      }
    }

    loadCatalog();
  }, []);

  const sortedRows = useMemo(() => sortCatalogRows(catalogRows), [catalogRows]);

  const filteredRows = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    if (!normalized) {
      return sortedRows.slice(0, INITIAL_BROWSE_LIMIT);
    }

    return sortedRows.filter((row) => {
      return (
        (row.item_name || '').toLowerCase().includes(normalized) ||
        (row.vendor || '').toLowerCase().includes(normalized) ||
        (row.size || '').toLowerCase().includes(normalized) ||
        (row.unit || '').toLowerCase().includes(normalized) ||
        (row.category || '').toLowerCase().includes(normalized) ||
        (row.material_class || '').toLowerCase().includes(normalized)
      );
    });
  }, [search, sortedRows]);

  const selected =
    filteredRows.find((row) => row.id === selectedId) ||
    sortedRows.find((row) => row.id === selectedId) ||
    null;

  useEffect(() => {
    if (filteredRows.length === 0) {
      return;
    }

    const stillVisible = filteredRows.some((row) => row.id === selectedId);

    if (!selectedId || !stillVisible) {
      setSelectedId(filteredRows[0].id);
    }
  }, [filteredRows, selectedId]);

  useEffect(() => {
    if (!selected) return;

    setNotes(selected.notes || '');
    setMatchWarning(selected.match_warning || '');
    setAppearanceNotes(selected.appearance_notes || '');
    setSaveMessage('');
  }, [selectedId, selected]);

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

    setCatalogRows((prev) =>
      prev.map((row) =>
        row.id === selected.id
          ? {
              ...row,
              notes,
              match_warning: matchWarning,
              appearance_notes: appearanceNotes,
            }
          : row
      )
    );

    setSaveMessage('Annotation saved.');
    setIsSaving(false);
  }

  const resultSummary =
    search.trim() === ''
      ? `Showing first ${Math.min(INITIAL_BROWSE_LIMIT, sortedRows.length)} of ${sortedRows.length} alphabetically`
      : `${filteredRows.length} matching rows`;

  return (
    <div className="min-h-[calc(100vh-73px)] bg-black p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[#bda86a]">
            Catalog
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[#f7f0d0]">
            Material Lookup
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-neutral-400">
            Browse vendor material records, review known differences, and save
            guidance before sourcing, substitution, or production use.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
          <div className="text-sm font-medium text-white">What this page is for</div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-neutral-800 bg-black/40 p-4">
              <div className="font-medium text-[#f7f0d0]">Browse</div>
              <p className="mt-2 text-sm text-neutral-400">
                View the catalog alphabetically before entering a search.
              </p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-black/40 p-4">
              <div className="font-medium text-[#f7f0d0]">Compare</div>
              <p className="mt-2 text-sm text-neutral-400">
                Check whether similar names actually represent safe or equivalent
                material choices.
              </p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-black/40 p-4">
              <div className="font-medium text-[#f7f0d0]">Document</div>
              <p className="mt-2 text-sm text-neutral-400">
                Save notes, match warnings, and appearance-specific guidance on
                the record itself.
              </p>
            </div>
          </div>
        </div>

        <div>
          <input
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a]"
            placeholder="Browse alphabetically or search by item, vendor, size, unit, category, or class"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loadError && (
          <div className="rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
            Failed to load catalog: {loadError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-lg font-semibold text-[#f7f0d0]">Results</div>
              <div className="text-xs text-neutral-500">{resultSummary}</div>
            </div>

            {filteredRows.length === 0 ? (
              <div className="text-sm text-neutral-500">No matching materials found.</div>
            ) : (
              <div className="max-h-[720px] overflow-y-auto pr-1 pb-4">
                <div className="space-y-2">
                  {filteredRows.map((row) => {
                    const hasAnnotation =
                      Boolean(row.notes) ||
                      Boolean(row.match_warning) ||
                      Boolean(row.appearance_notes);

                    return (
                      <button
                        key={row.id}
                        onClick={() => setSelectedId(row.id)}
                        className={`w-full rounded-xl border p-4 text-left transition ${
                          selectedId === row.id
                            ? 'border-[#c8a43a] bg-[#1a1610]'
                            : 'border-neutral-800 bg-black/40 hover:border-neutral-700 hover:bg-neutral-900'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="font-medium text-white">{row.item_name}</div>
                            <div className="mt-1 text-sm text-neutral-400">
                              {row.vendor || '—'} • {row.size || '—'} • {row.unit || '—'}
                            </div>
                          </div>

                          {hasAnnotation && (
                            <div className="rounded-full border border-yellow-900 bg-yellow-950/40 px-2.5 py-1 text-xs text-yellow-300">
                              Annotated
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-semibold text-[#f7f0d0]">Record Details</div>
              {selected && (
                <div className="rounded-full border border-neutral-800 bg-black/40 px-3 py-1 text-xs text-neutral-400">
                  {selected.vendor || '—'}
                </div>
              )}
            </div>

            {selected ? (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-neutral-800 bg-black/40 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                      Item
                    </div>
                    <div className="mt-2 font-medium text-white">
                      {selected.item_name}
                    </div>
                  </div>

                  <div className="rounded-xl border border-neutral-800 bg-black/40 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                      Size / Unit
                    </div>
                    <div className="mt-2 font-medium text-white">
                      {selected.size || '—'} • {selected.unit || '—'}
                    </div>
                  </div>

                  <div className="rounded-xl border border-neutral-800 bg-black/40 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                      Category
                    </div>
                    <div className="mt-2 font-medium text-white">
                      {selected.category || '—'}
                    </div>
                  </div>

                  <div className="rounded-xl border border-neutral-800 bg-black/40 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                      Material Class
                    </div>
                    <div className="mt-2 font-medium text-white">
                      {selected.material_class || '—'}
                    </div>
                  </div>

                  <div className="rounded-xl border border-neutral-800 bg-black/40 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                      Price
                    </div>
                    <div className="mt-2 font-medium text-white">
                      {selected.price || '—'}
                    </div>
                  </div>

                  <div className="rounded-xl border border-neutral-800 bg-black/40 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                      Price Basis
                    </div>
                    <div className="mt-2 font-medium text-white">
                      {selected.price_basis || '—'}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-neutral-400">Notes</label>
                    <textarea
                      className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a]"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-neutral-400">Match Warning</label>
                    <textarea
                      className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a]"
                      value={matchWarning}
                      onChange={(e) => setMatchWarning(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-neutral-400">Appearance Notes</label>
                    <textarea
                      className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a]"
                      value={appearanceNotes}
                      onChange={(e) => setAppearanceNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    className="rounded-xl bg-yellow-600 px-4 py-2 text-black transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
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
              <div className="text-sm text-neutral-500">
                Select a material from the list to inspect its record and edit notes.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}