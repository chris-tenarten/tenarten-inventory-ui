'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type AppendBalanceRow = {
  vendor: string;
  item_name: string;
  size: string;
  unit: string;
  qty_on_hand: number;
  last_transaction_at: string | null;
  notes?: string;
  match_warning?: string;
  appearance_notes?: string;
  annotated_by?: string;
};

type CurrentInventoryRow = {
  id: string;
  category: string | null;
  color: string | null;
  size: string | null;
  quantity: number | null;
  vendor: string | null;
  location: string | null;
  pallet_number: string | null;
  match_confidence: number | string | null;
};

type CatalogAnnotationRow = {
  id?: string;
  vendor: string;
  item_name: string;
  size: string;
  notes: string | null;
  match_warning: string | null;
  appearance_notes?: string | null;
  annotated_by?: string | null;
  updated_at?: string | null;
};


type ViewMode = 'append' | 'current';

function normalizeKey(
  vendor: string | null,
  itemName: string | null,
  size: string | null
) {
  return `${vendor || ''}|${itemName || ''}|${size || ''}`;
}

function hasAnnotation(row: Partial<CatalogAnnotationRow>) {
  return Boolean(
    row.notes?.trim() ||
      row.match_warning?.trim() ||
      row.appearance_notes?.trim()
  );
}

function annotationSummary(row: Partial<CatalogAnnotationRow>) {
  if (row.match_warning?.trim()) return row.match_warning.trim();
  if (row.notes?.trim()) return row.notes.trim();
  if (row.appearance_notes?.trim()) return row.appearance_notes.trim();
  return 'Annotated entry';
}



export default function InventoryPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('append');
  const [guidedMode, setGuidedMode] = useState(true);

  const [appendRows, setAppendRows] = useState<AppendBalanceRow[]>([]);
  const [currentRows, setCurrentRows] = useState<CurrentInventoryRow[]>([]);
  const [recentAnnotations, setRecentAnnotations] = useState<CatalogAnnotationRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');


  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setLoadError('');

      const [appendResult, currentResult, catalogResult] = await Promise.all([
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

        supabase
          .from('vendor_catalog')
          .select(
            'id, vendor, item_name, size, notes, match_warning, appearance_notes, annotated_by, updated_at'
          )
          .order('updated_at', { ascending: false })
          .limit(100),
      ]);

      if (appendResult.error || currentResult.error || catalogResult.error) {
        const firstError =
          appendResult.error || currentResult.error || catalogResult.error;
        console.error('Failed to load inventory data:', firstError);
        setLoadError(firstError?.message || 'Failed to load inventory data.');
        setLoading(false);
        return;
      }

      const catalogData = ((catalogResult.data as CatalogAnnotationRow[]) || []).filter(
        (row) => hasAnnotation(row)
      );

      const catalogMap: Record<string, CatalogAnnotationRow> = {};
      for (const row of catalogData) {
        const key = normalizeKey(row.vendor, row.item_name, row.size);
        if (!catalogMap[key]) {
          catalogMap[key] = row;
        }
      }

      const enrichedAppendRows = ((appendResult.data as AppendBalanceRow[]) || []).map(
        (row) => {
          const match = catalogMap[normalizeKey(row.vendor, row.item_name, row.size)];

          return {
            ...row,
            notes: match?.notes || undefined,
            match_warning: match?.match_warning || undefined,
            appearance_notes: match?.appearance_notes || undefined,
            annotated_by: match?.annotated_by || undefined,
          };
        }
      );

      setAppendRows(enrichedAppendRows);
      setCurrentRows((currentResult.data as CurrentInventoryRow[]) || []);
      setRecentAnnotations(catalogData.slice(0, 6));
      setLoading(false);
    }

    loadData();
  }, []);


  const filteredAppendRows = useMemo(() => {
    const q = search.toLowerCase();
    return appendRows.filter((row) =>
      `${row.vendor} ${row.item_name} ${row.size} ${row.unit} ${row.notes || ''} ${
        row.match_warning || ''
      } ${row.annotated_by || ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [appendRows, search]);

  const filteredCurrentRows = useMemo(() => {
    const q = search.toLowerCase();
    return currentRows.filter((row) =>
      `${row.vendor || ''} ${row.category || ''} ${row.color || ''} ${row.size || ''} ${row.location || ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [currentRows, search]);

  return (
    <div className="min-h-[calc(100vh-73px)] bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#f7f0d0]">
              Inventory
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-neutral-400">
              Source materials with quantity visibility and annotation signals.
            </p>
          </div>

          <button
            onClick={() => setGuidedMode((prev) => !prev)}
            className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
              guidedMode
                ? 'border-[#c8a43a] bg-[#c8a43a] text-black hover:bg-[#d6b24a]'
                : 'border-neutral-700 bg-neutral-950 text-neutral-200 hover:border-neutral-600 hover:bg-neutral-900'
            }`}
          >
            {guidedMode ? 'Hide Guidance' : 'Show Guidance'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-full border border-neutral-800 bg-neutral-950 p-1">
            <button
              onClick={() => setViewMode('append')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                viewMode === 'append'
                  ? 'bg-[#c8a43a] text-black'
                  : 'text-neutral-300 hover:bg-neutral-900'
              }`}
            >
              Append View
            </button>

            <button
              onClick={() => setViewMode('current')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                viewMode === 'current'
                  ? 'bg-[#c8a43a] text-black'
                  : 'text-neutral-300 hover:bg-neutral-900'
              }`}
            >
              Current Inventory
            </button>
          </div>
        </div>

        {guidedMode && viewMode === 'append' && (
          <div className="rounded-2xl border border-yellow-800/60 bg-yellow-950/20 p-4">
            <div className="text-sm font-semibold text-[#f7f0d0]">
              Append View Guidance
            </div>
            <p className="mt-2 text-sm text-neutral-300">
              This view is the transaction-derived inventory balance. Use it as the
              preferred sourcing view because it preserves history and surfaces
              warnings from the catalog.
            </p>
          </div>
        )}

        {guidedMode && viewMode === 'current' && (
          <div className="rounded-2xl border border-blue-800/60 bg-blue-950/20 p-4">
            <div className="text-sm font-semibold text-[#f7f0d0]">
              Current Inventory Guidance
            </div>
            <p className="mt-2 text-sm text-neutral-300">
              This is the legacy table. It is still useful for comparison, but it
              does not preserve the same transaction history and annotation context
              as the append-based flow.
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
          <label
            htmlFor="inventory-search"
            className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-neutral-500"
          >
            Search
          </label>
          <input
            id="inventory-search"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
            placeholder="Search inventory, vendor, item, size, or notes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loadError && (
          <div className="rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
            {loadError}
          </div>
        )}

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
          {loading ? (
            <div className="text-sm text-neutral-400">Loading...</div>
          ) : viewMode === 'append' ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b border-neutral-800 text-neutral-400">
                  <tr>
                    <th className="py-3 text-left font-medium">Vendor</th>
                    <th className="py-3 text-left font-medium">Item</th>
                    <th className="py-3 text-left font-medium">Size</th>
                    <th className="py-3 text-left font-medium">Unit</th>
                    <th className="py-3 text-left font-medium">Qty</th>
                    <th className="py-3 text-left font-medium">Entry</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppendRows.map((row, index) => {
                    const annotated = Boolean(
                      row.notes?.trim() ||
                        row.match_warning?.trim() ||
                        row.appearance_notes?.trim()
                    );

                    return (
                      <tr
                        key={`${row.vendor}-${row.item_name}-${row.size}-${index}`}
                        className={`border-b border-neutral-900 ${
                          row.match_warning?.trim() ? 'bg-red-950/10' : ''
                        }`}
                      >
                        <td className="py-3 align-top">{row.vendor}</td>
                        <td className="py-3 align-top">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-white">{row.item_name}</div>
                              {annotated && (
                                <span className="rounded-full border border-yellow-700/60 bg-yellow-950/40 px-2 py-1 text-[11px] font-medium text-yellow-300">
                                  Annotated
                                </span>
                              )}
                            </div>

                            {row.match_warning?.trim() && (
                              <div className="mt-1 text-xs text-red-400">
                                {row.match_warning}
                              </div>
                            )}

                            {row.annotated_by?.trim() && (
                              <div className="mt-1 text-xs text-neutral-500">
                                By {row.annotated_by}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 align-top">{row.size}</td>
                        <td className="py-3 align-top">{row.unit}</td>
                        <td className="py-3 align-top font-medium text-green-400">
                          {row.qty_on_hand}
                        </td>
                        <td className="py-3 align-top">
                          <button
                            type="button"
                            onClick={() => {
                              const params = new URLSearchParams({
                                vendor: row.vendor,
                                item_name: row.item_name,
                                size: row.size || '',
                              });
                              router.push(`/transactions?${params.toString()}`);
                            }}
                            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:border-[#c8a43a] hover:text-white"
                          >
                            Edit Entries
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredAppendRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-neutral-500">
                        No matching inventory rows found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-neutral-800 text-neutral-400">
                  <tr>
                    <th className="py-3 text-left font-medium">Vendor</th>
                    <th className="py-3 text-left font-medium">Color</th>
                    <th className="py-3 text-left font-medium">Size</th>
                    <th className="py-3 text-left font-medium">Location</th>
                    <th className="py-3 text-left font-medium">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCurrentRows.map((row) => (
                    <tr key={row.id} className="border-b border-neutral-900">
                      <td className="py-3">{row.vendor}</td>
                      <td className="py-3">{row.color}</td>
                      <td className="py-3">{row.size}</td>
                      <td className="py-3">{row.location || '—'}</td>
                      <td className="py-3">{row.quantity}</td>
                    </tr>
                  ))}

                  {filteredCurrentRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-neutral-500">
                        No matching legacy inventory rows found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-300">
              Recent Annotations
            </h2>
            <span className="text-xs text-neutral-500">
              Recent catalog notes that may affect sourcing
            </span>
          </div>

          {recentAnnotations.length === 0 ? (
            <div className="text-sm text-neutral-500">No recent annotations found.</div>
          ) : (
            <div className="divide-y divide-neutral-800">
              {recentAnnotations.map((row, index) => (
                <div
                  key={`${row.vendor}-${row.item_name}-${row.size}-${index}`}
                  className="flex items-start justify-between gap-4 py-3"
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
                      {annotationSummary(row)}
                    </div>
                  </div>

                  {row.match_warning?.trim() && (
                    <span className="shrink-0 rounded-full border border-red-800/70 bg-red-950/40 px-2 py-1 text-[11px] text-red-300">
                      Warning
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
