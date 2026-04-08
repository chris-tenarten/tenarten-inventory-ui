'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type AppendBalanceRow = {
  vendor: string | null;
  item_name: string | null;
  size: string | null;
  unit: string | null;
  qty_on_hand: number;
  last_transaction_at: string | null;
};

type CurrentInventoryRow = {
  id: string;
  color: string | null;
  size: string | null;
  quantity: number | null;
  vendor: string | null;
  location: string | null;
  pallet_number: string | null;
  category?: string | null;
  match_confidence?: number | string | null;
};

type CatalogContextRow = {
  id: string;
  vendor: string | null;
  item_name: string | null;
  size: string | null;
  notes: string | null;
  match_warning: string | null;
  appearance_notes: string | null;
};

type ViewMode = 'append' | 'current';

function normalize(value: string | null | undefined) {
  return (value || '').trim().toLowerCase();
}

function hasContext(row: CatalogContextRow) {
  return Boolean(row.notes || row.match_warning || row.appearance_notes);
}

function scoreCatalogMatch(
  row: CatalogContextRow,
  targetItem: string,
  targetSize?: string | null,
  targetVendor?: string | null
) {
  let score = 0;

  const rowItem = normalize(row.item_name);
  const rowSize = normalize(row.size);
  const rowVendor = normalize(row.vendor);

  const item = normalize(targetItem);
  const size = normalize(targetSize);
  const vendor = normalize(targetVendor);

  if (rowItem === item) score += 100;
  if (size && rowSize === size) score += 20;
  if (vendor && rowVendor === vendor) score += 40;
  if (hasContext(row)) score += 10;

  return score;
}

export default function InventoryPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('append');

  const [appendRows, setAppendRows] = useState<AppendBalanceRow[]>([]);
  const [currentRows, setCurrentRows] = useState<CurrentInventoryRow[]>([]);

  const [selectedAppendRow, setSelectedAppendRow] =
    useState<AppendBalanceRow | null>(null);
  const [selectedCurrentRow, setSelectedCurrentRow] =
    useState<CurrentInventoryRow | null>(null);

  const [catalogMatches, setCatalogMatches] = useState<CatalogContextRow[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [matchModeLabel, setMatchModeLabel] = useState('');

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function loadInventoryViews() {
      setLoading(true);
      setErrorMessage('');

      const [appendResult, currentResult] = await Promise.all([
        supabase
          .from('inventory_balances')
          .select('*')
          .order('vendor', { ascending: true })
          .order('item_name', { ascending: true }),

        supabase
          .from('inventory_items')
          .select('*')
          .order('vendor', { ascending: true })
          .order('color', { ascending: true }),
      ]);

      if (appendResult.error && currentResult.error) {
        setErrorMessage(
          `Failed to load inventory: ${appendResult.error.message} / ${currentResult.error.message}`
        );
        setLoading(false);
        return;
      }

      const appendData = (appendResult.data as AppendBalanceRow[]) || [];
      const currentData = (currentResult.data as CurrentInventoryRow[]) || [];

      setAppendRows(appendData);
      setCurrentRows(currentData);
      setSelectedAppendRow(appendData[0] || null);
      setSelectedCurrentRow(currentData[0] || null);
      setLoading(false);
    }

    loadInventoryViews();
  }, []);

  const filteredAppendRows = useMemo(() => {
    const q = normalize(search);
    if (!q) return appendRows;

    return appendRows.filter((row) => {
      return (
        normalize(row.vendor).includes(q) ||
        normalize(row.item_name).includes(q) ||
        normalize(row.size).includes(q) ||
        normalize(row.unit).includes(q)
      );
    });
  }, [appendRows, search]);

  const filteredCurrentRows = useMemo(() => {
    const q = normalize(search);
    if (!q) return currentRows;

    return currentRows.filter((row) => {
      return (
        normalize(row.vendor).includes(q) ||
        normalize(row.color).includes(q) ||
        normalize(row.size).includes(q) ||
        normalize(row.location).includes(q) ||
        normalize(row.pallet_number).includes(q) ||
        normalize(row.category).includes(q)
      );
    });
  }, [currentRows, search]);

  useEffect(() => {
    if (viewMode === 'append') {
      const stillExists =
        selectedAppendRow &&
        filteredAppendRows.some(
          (row) =>
            normalize(row.vendor) === normalize(selectedAppendRow.vendor) &&
            normalize(row.item_name) === normalize(selectedAppendRow.item_name) &&
            normalize(row.size) === normalize(selectedAppendRow.size) &&
            normalize(row.unit) === normalize(selectedAppendRow.unit)
        );

      if (!stillExists) {
        setSelectedAppendRow(filteredAppendRows[0] || null);
      }
    } else {
      const stillExists =
        selectedCurrentRow &&
        filteredCurrentRows.some((row) => row.id === selectedCurrentRow.id);

      if (!stillExists) {
        setSelectedCurrentRow(filteredCurrentRows[0] || null);
      }
    }
  }, [
    viewMode,
    filteredAppendRows,
    filteredCurrentRows,
    selectedAppendRow,
    selectedCurrentRow,
  ]);

  useEffect(() => {
    async function loadCatalogContext() {
      setCatalogLoading(true);
      setCatalogMatches([]);
      setMatchModeLabel('');

      let targetItem = '';
      let targetSize: string | null = null;
      let targetVendor: string | null = null;

      if (viewMode === 'append' && selectedAppendRow) {
        targetItem = (selectedAppendRow.item_name || '').trim();
        targetSize = selectedAppendRow.size || null;
        targetVendor = selectedAppendRow.vendor || null;
      } else if (viewMode === 'current' && selectedCurrentRow) {
        targetItem = (selectedCurrentRow.color || '').trim();
        targetSize = selectedCurrentRow.size || null;
        targetVendor = selectedCurrentRow.vendor || null;
      } else {
        setCatalogLoading(false);
        return;
      }

      if (!targetItem) {
        setCatalogLoading(false);
        return;
      }

      // Step 1: pull candidate catalog rows by item name only, case-insensitive.
      // This avoids breaking on NULL vendor or slightly messy size data.
      const { data, error } = await supabase
        .from('vendor_catalog')
        .select(
          'id, vendor, item_name, size, notes, match_warning, appearance_notes'
        )
        .ilike('item_name', targetItem);

      if (error) {
        console.warn('Catalog context lookup failed:', error);
        setCatalogLoading(false);
        return;
      }

      const candidates = (data as CatalogContextRow[]) || [];

      if (candidates.length === 0) {
        setCatalogMatches([]);
        setMatchModeLabel('No catalog match');
        setCatalogLoading(false);
        return;
      }

      // Rank candidates by item exactness, then vendor/size preference, then context presence.
      const ranked = [...candidates].sort((a, b) => {
        const aScore = scoreCatalogMatch(a, targetItem, targetSize, targetVendor);
        const bScore = scoreCatalogMatch(b, targetItem, targetSize, targetVendor);
        return bScore - aScore;
      });

      setCatalogMatches(ranked);

      const best = ranked[0];
      const bestItem = normalize(best.item_name) === normalize(targetItem);
      const bestVendor =
        targetVendor && normalize(best.vendor) === normalize(targetVendor);
      const bestSize =
        targetSize && normalize(best.size) === normalize(targetSize);

      if (bestItem && bestVendor && bestSize) {
        setMatchModeLabel('Exact match');
      } else if (bestItem && bestVendor) {
        setMatchModeLabel('Item + vendor match');
      } else if (bestItem && bestSize) {
        setMatchModeLabel('Item + size match');
      } else if (bestItem) {
        setMatchModeLabel('Item-name match');
      } else {
        setMatchModeLabel('Best available match');
      }

      setCatalogLoading(false);
    }

    loadCatalogContext();
  }, [viewMode, selectedAppendRow, selectedCurrentRow]);

  function formatTimestamp(value: string | null | undefined) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  }

  function formatConfidence(value: number | string | null | undefined) {
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
  }

  const activeAppend = selectedAppendRow;
  const activeCurrent = selectedCurrentRow;
  const primaryCatalogMatch = catalogMatches[0] || null;

  return (
    <div className="min-h-[calc(100vh-73px)] bg-black p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-5">
        <div>
          <h1 className="text-3xl font-semibold text-[#f7f0d0]">Inventory</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Compare append-derived balances against current inventory.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full border border-neutral-800 bg-neutral-950 p-1">
            <button
              onClick={() => setViewMode('append')}
              className={`rounded-full px-4 py-2 text-sm transition ${
                viewMode === 'append'
                  ? 'bg-[#c8a43a] text-black'
                  : 'text-neutral-300 hover:bg-neutral-900'
              }`}
            >
              Append View
            </button>
            <button
              onClick={() => setViewMode('current')}
              className={`rounded-full px-4 py-2 text-sm transition ${
                viewMode === 'current'
                  ? 'bg-[#c8a43a] text-black'
                  : 'text-neutral-300 hover:bg-neutral-900'
              }`}
            >
              Current Inventory
            </button>
          </div>

          <div className="text-sm text-neutral-500">
            {viewMode === 'append'
              ? `${filteredAppendRows.length} rows`
              : `${filteredCurrentRows.length} rows`}
          </div>
        </div>

        <div>
          <input
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a]"
            placeholder={
              viewMode === 'append'
                ? 'Search vendor, item, size, or unit'
                : 'Search vendor, color, size, location, or pallet'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {errorMessage && (
          <div className="rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-semibold text-[#f7f0d0]">
                {viewMode === 'append' ? 'Append Rows' : 'Current Inventory'}
              </div>
              <div className="text-xs text-neutral-500">Select a row</div>
            </div>

            {loading ? (
              <div className="text-sm text-neutral-400">Loading...</div>
            ) : viewMode === 'append' ? (
              filteredAppendRows.length === 0 ? (
                <div className="text-sm text-neutral-500">No rows found.</div>
              ) : (
                <div className="max-h-[640px] space-y-2 overflow-y-auto pr-1">
                  {filteredAppendRows.map((row, idx) => {
                    const isSelected =
                      activeAppend &&
                      normalize(row.vendor) === normalize(activeAppend.vendor) &&
                      normalize(row.item_name) ===
                        normalize(activeAppend.item_name) &&
                      normalize(row.size) === normalize(activeAppend.size) &&
                      normalize(row.unit) === normalize(activeAppend.unit);

                    return (
                      <button
                        key={`${row.vendor}-${row.item_name}-${row.size}-${row.unit}-${idx}`}
                        onClick={() => setSelectedAppendRow(row)}
                        className={`w-full rounded-xl border p-4 text-left transition ${
                          isSelected
                            ? 'border-[#c8a43a] bg-[#1a1610]'
                            : 'border-neutral-800 bg-black/40 hover:border-neutral-700 hover:bg-neutral-900'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="font-medium text-white">
                              {row.item_name || '—'}
                            </div>
                            <div className="mt-1 text-sm text-neutral-400">
                              {row.vendor || '—'} • {row.size || '—'} •{' '}
                              {row.unit || '—'}
                            </div>
                          </div>

                          <div
                            className={`rounded-full px-3 py-1 text-xs ${
                              Number(row.qty_on_hand) > 0
                                ? 'border border-green-900 bg-green-950/40 text-green-300'
                                : Number(row.qty_on_hand) < 0
                                ? 'border border-red-900 bg-red-950/40 text-red-300'
                                : 'border border-neutral-800 bg-neutral-950 text-neutral-300'
                            }`}
                          >
                            {row.qty_on_hand}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            ) : filteredCurrentRows.length === 0 ? (
              <div className="text-sm text-neutral-500">No rows found.</div>
            ) : (
              <div className="max-h-[640px] space-y-2 overflow-y-auto pr-1">
                {filteredCurrentRows.map((row) => {
                  const isSelected = activeCurrent?.id === row.id;
                  const qty = Number(row.quantity || 0);

                  return (
                    <button
                      key={row.id}
                      onClick={() => setSelectedCurrentRow(row)}
                      className={`w-full rounded-xl border p-4 text-left transition ${
                        isSelected
                          ? 'border-[#c8a43a] bg-[#1a1610]'
                          : 'border-neutral-800 bg-black/40 hover:border-neutral-700 hover:bg-neutral-900'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-medium text-white">
                            {row.color || '—'}
                          </div>
                          <div className="mt-1 text-sm text-neutral-400">
                            {row.vendor || '—'} • {row.size || '—'} •{' '}
                            {row.location || '—'}
                          </div>
                        </div>

                        <div
                          className={`rounded-full px-3 py-1 text-xs ${
                            qty > 0
                              ? 'border border-green-900 bg-green-950/40 text-green-300'
                              : qty < 0
                              ? 'border border-red-900 bg-red-950/40 text-red-300'
                              : 'border border-neutral-800 bg-neutral-950 text-neutral-300'
                          }`}
                        >
                          {qty}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5 lg:sticky lg:top-6 lg:self-start">
            <div className="mb-4 text-lg font-semibold text-[#f7f0d0]">
              Details
            </div>

            {loading ? (
              <div className="text-sm text-neutral-500">Loading...</div>
            ) : viewMode === 'append' ? (
              activeAppend ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-2xl font-semibold text-white">
                      {activeAppend.item_name || '—'}
                    </div>
                    <div className="mt-1 text-sm text-neutral-500">
                      {activeAppend.vendor || '—'}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-neutral-800 bg-black/40 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                        Size
                      </div>
                      <div className="mt-2 font-medium text-white">
                        {activeAppend.size || '—'}
                      </div>
                    </div>

                    <div className="rounded-xl border border-neutral-800 bg-black/40 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                        Unit
                      </div>
                      <div className="mt-2 font-medium text-white">
                        {activeAppend.unit || '—'}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-neutral-800 bg-black/40 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                      Computed Quantity On Hand
                    </div>
                    <div className="mt-2 text-3xl font-semibold text-[#f7f0d0]">
                      {activeAppend.qty_on_hand}
                    </div>
                  </div>

                  <div className="rounded-xl border border-neutral-800 bg-black/40 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                      Last Transaction
                    </div>
                    <div className="mt-2 font-medium text-white">
                      {formatTimestamp(activeAppend.last_transaction_at)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-neutral-500">
                  Select a row to inspect details.
                </div>
              )
            ) : activeCurrent ? (
              <div className="space-y-4">
                <div>
                  <div className="text-2xl font-semibold text-white">
                    {activeCurrent.color || '—'}
                  </div>
                  <div className="mt-1 text-sm text-neutral-500">
                    {activeCurrent.vendor || '—'}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-neutral-800 bg-black/40 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                      Size
                    </div>
                    <div className="mt-2 font-medium text-white">
                      {activeCurrent.size || '—'}
                    </div>
                  </div>

                  <div className="rounded-xl border border-neutral-800 bg-black/40 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                      Location
                    </div>
                    <div className="mt-2 font-medium text-white">
                      {activeCurrent.location || '—'}
                    </div>
                  </div>

                  <div className="rounded-xl border border-neutral-800 bg-black/40 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                      Pallet Number
                    </div>
                    <div className="mt-2 font-medium text-white">
                      {activeCurrent.pallet_number || '—'}
                    </div>
                  </div>

                  <div className="rounded-xl border border-neutral-800 bg-black/40 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                      Match Confidence
                    </div>
                    <div className="mt-2 font-medium text-white">
                      {formatConfidence(activeCurrent.match_confidence)}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-neutral-800 bg-black/40 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                    Quantity
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-[#f7f0d0]">
                    {activeCurrent.quantity ?? '—'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-neutral-500">
                Select a row to inspect details.
              </div>
            )}

            <div className="mt-5 border-t border-neutral-800 pt-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-white">
                  Notes & Context
                </div>
                {matchModeLabel && (
                  <div className="rounded-md border border-neutral-700 bg-black/40 px-2.5 py-0.5 text-[11px] text-neutral-300">
                    {matchModeLabel}
                  </div>
                )}
              </div>

              {catalogLoading ? (
                <div className="text-sm text-neutral-500">
                  Loading catalog notes...
                </div>
              ) : primaryCatalogMatch ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-neutral-800 bg-black/40 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                      Catalog Match
                    </div>
                    <div className="mt-2 text-sm text-neutral-300">
                      {primaryCatalogMatch.vendor || '—'} •{' '}
                      {primaryCatalogMatch.item_name || '—'} •{' '}
                      {primaryCatalogMatch.size || '—'}
                    </div>
                  </div>

                  {primaryCatalogMatch.notes && (
                    <div className="rounded-xl border border-neutral-800 bg-black/40 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                        Notes
                      </div>
                      <div className="mt-2 text-sm text-neutral-300">
                        {primaryCatalogMatch.notes}
                      </div>
                    </div>
                  )}

                  {primaryCatalogMatch.match_warning && (
                    <div className="rounded-xl border border-yellow-900 bg-yellow-950/30 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-yellow-300">
                        Match Warning
                      </div>
                      <div className="mt-2 text-sm text-yellow-100">
                        {primaryCatalogMatch.match_warning}
                      </div>
                    </div>
                  )}

                  {primaryCatalogMatch.appearance_notes && (
                    <div className="rounded-xl border border-neutral-800 bg-black/40 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                        Appearance Notes
                      </div>
                      <div className="mt-2 text-sm text-neutral-300">
                        {primaryCatalogMatch.appearance_notes}
                      </div>
                    </div>
                  )}

                  {!primaryCatalogMatch.notes &&
                    !primaryCatalogMatch.match_warning &&
                    !primaryCatalogMatch.appearance_notes && (
                      <div className="text-sm text-neutral-500">
                        Matching catalog row found, but no notes or warnings are saved.
                      </div>
                    )}

                  {catalogMatches.length > 1 && (
                    <div className="text-xs text-neutral-500">
                      {catalogMatches.length} catalog matches found. Showing best match.
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-neutral-500">
                  No matching catalog notes found for this row.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}