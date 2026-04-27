'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  earmarked_for_job?: boolean | null;
  earmarked_job?: string | null;
  earmark_notes?: string | null;
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

type InventorySyncStateRow = {
  id?: string;
  vendor: string;
  item_name: string;
  size: string;
  last_synced_qty: number;
  last_synced_at?: string | null;
};

type AppendSyncStatus = 'needs_sync' | 'synced' | 'changed';

type AppendDisplayRow = AppendBalanceRow & {
  sync_status: AppendSyncStatus;
  last_synced_qty?: number;
  last_synced_at?: string | null;
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

function annotationKey(row: Partial<CatalogAnnotationRow>, index: number) {
  return `${row.vendor || ''}|${row.item_name || ''}|${row.size || ''}|${index}`;
}

function getSyncStatus(
  row: AppendBalanceRow,
  syncMap: Record<string, InventorySyncStateRow>
): {
  sync_status: AppendSyncStatus;
  last_synced_qty?: number;
  last_synced_at?: string | null;
} {
  const key = normalizeKey(row.vendor, row.item_name, row.size);
  const syncRow = syncMap[key];

  if (!syncRow) {
    return {
      sync_status: 'needs_sync',
    };
  }

  const currentQty = Number(row.qty_on_hand ?? 0);
  const syncedQty = Number(syncRow.last_synced_qty ?? 0);

  if (currentQty !== syncedQty) {
    return {
      sync_status: 'changed',
      last_synced_qty: syncedQty,
      last_synced_at: syncRow.last_synced_at ?? null,
    };
  }

  return {
    sync_status: 'synced',
    last_synced_qty: syncedQty,
    last_synced_at: syncRow.last_synced_at ?? null,
  };
}

function SyncStatusBadge({
  status,
}: {
  status: AppendSyncStatus;
}) {
  if (status === 'needs_sync') {
    return (
      <span className="rounded-full border border-amber-700/60 bg-amber-950/40 px-2 py-1 text-[11px] font-medium text-amber-300">
        Needs Sync
      </span>
    );
  }

  if (status === 'changed') {
    return (
      <span className="rounded-full border border-blue-700/60 bg-blue-950/40 px-2 py-1 text-[11px] font-medium text-blue-300">
        Changed
      </span>
    );
  }

  return (
    <span className="rounded-full border border-emerald-700/60 bg-emerald-950/40 px-2 py-1 text-[11px] font-medium text-emerald-300">
      Synced
    </span>
  );
}

export default function InventoryPage() {
  const router = useRouter();

  const [viewMode, setViewMode] = useState<ViewMode>('append');
  const [guidedMode, setGuidedMode] = useState(true);
  const [showSyncedRows, setShowSyncedRows] = useState(false);

  const [appendRows, setAppendRows] = useState<AppendDisplayRow[]>([]);
  const [currentRows, setCurrentRows] = useState<CurrentInventoryRow[]>([]);
  const [recentAnnotations, setRecentAnnotations] = useState<CatalogAnnotationRow[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');

  const [expandedAnnotationKey, setExpandedAnnotationKey] = useState<string | null>(
    null
  );

  const [syncMessage, setSyncMessage] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const [pendingEarmarkRow, setPendingEarmarkRow] =
    useState<CurrentInventoryRow | null>(null);
  const [earmarkJob, setEarmarkJob] = useState('');
  const [earmarkNotes, setEarmarkNotes] = useState('');
  const [isSavingEarmark, setIsSavingEarmark] = useState(false);
  const [earmarkMessage, setEarmarkMessage] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    const [appendResult, currentResult, catalogResult, syncStateResult] =
      await Promise.all([
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

        supabase
          .from('inventory_sync_state')
          .select('id, vendor, item_name, size, last_synced_qty, last_synced_at'),
      ]);

    if (
      appendResult.error ||
      currentResult.error ||
      catalogResult.error ||
      syncStateResult.error
    ) {
      const firstError =
        appendResult.error ||
        currentResult.error ||
        catalogResult.error ||
        syncStateResult.error;

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

    const syncRows = (syncStateResult.data as InventorySyncStateRow[]) || [];
    const syncMap: Record<string, InventorySyncStateRow> = {};
    for (const row of syncRows) {
      const key = normalizeKey(row.vendor, row.item_name, row.size);
      syncMap[key] = row;
    }

    const enrichedAppendRows = ((appendResult.data as AppendBalanceRow[]) || []).map(
      (row) => {
        const match = catalogMap[normalizeKey(row.vendor, row.item_name, row.size)];
        const syncInfo = getSyncStatus(row, syncMap);

        return {
          ...row,
          notes: match?.notes || undefined,
          match_warning: match?.match_warning || undefined,
          appearance_notes: match?.appearance_notes || undefined,
          annotated_by: match?.annotated_by || undefined,
          sync_status: syncInfo.sync_status,
          last_synced_qty: syncInfo.last_synced_qty,
          last_synced_at: syncInfo.last_synced_at,
        };
      }
    );

    setAppendRows(enrichedAppendRows);
    setCurrentRows((currentResult.data as CurrentInventoryRow[]) || []);
    setRecentAnnotations(catalogData.slice(0, 6));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredAppendRows = useMemo(() => {
    const q = search.toLowerCase();

    return appendRows.filter((row) => {
      if (!showSyncedRows && row.sync_status === 'synced') {
        return false;
      }

      return `${row.vendor} ${row.item_name} ${row.size} ${row.unit} ${row.notes || ''} ${
        row.match_warning || ''
      } ${row.annotated_by || ''} ${row.sync_status}`
        .toLowerCase()
        .includes(q);
    });
  }, [appendRows, search, showSyncedRows]);

  const filteredCurrentRows = useMemo(() => {
    const q = search.toLowerCase();
    return currentRows.filter((row) =>
      `${row.vendor || ''} ${row.category || ''} ${row.color || ''} ${
        row.size || ''
      } ${row.location || ''} ${row.earmarked_job || ''} ${row.earmark_notes || ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [currentRows, search]);

  async function handleSyncToCurrentInventory() {
    const confirmed = window.confirm(
      'Sync unsynced transactions to Current Inventory?\n\nThis will apply new intake/outtake/adjustment transactions to inventory_items without deleting existing inventory rows.'
    );

    if (!confirmed) return;

    setSyncMessage('');
    setIsSyncing(true);

    try {
      const { data: transactionRows, error: transactionError } = await supabase
        .from('inventory_transactions')
        .select(
          'id, transaction_type, vendor, specialty_vendor_name, item_name, size, quantity, catalog_source, synced_to_inventory_at'
        )
        .is('synced_to_inventory_at', null)
        .order('created_at', { ascending: true });

      if (transactionError) {
        console.error('Failed to load unsynced transactions:', transactionError);
        setSyncMessage(transactionError.message || 'Failed to load unsynced transactions.');
        return;
      }

      const unsyncedTransactions = (transactionRows || []) as Array<{
        id: string;
        transaction_type: string | null;
        vendor: string | null;
        specialty_vendor_name: string | null;
        item_name: string | null;
        size: string | null;
        quantity: number | null;
        catalog_source: string | null;
        synced_to_inventory_at: string | null;
      }>;

      if (unsyncedTransactions.length === 0) {
        setSyncMessage('No unsynced transactions found. Current Inventory was left unchanged.');
        await loadData();
        return;
      }

      const deltaMap = new Map<
        string,
        {
          vendor: string;
          color: string;
          size: string | null;
          delta: number;
          transactionIds: string[];
        }
      >();

      const makeInventoryKey = (
        vendorValue: string,
        colorValue: string,
        sizeValue: string | null
      ) => `${vendorValue}|${colorValue}|${sizeValue || ''}`;

      for (const tx of unsyncedTransactions) {
        const resolvedVendor =
          tx.catalog_source === 'specialty'
            ? tx.specialty_vendor_name?.trim() || tx.vendor?.trim() || ''
            : tx.vendor?.trim() || tx.specialty_vendor_name?.trim() || '';

        const resolvedColor = tx.item_name?.trim() || '';
        const resolvedSize = tx.size?.trim() || null;
        const quantity = Math.abs(Number(tx.quantity || 0));

        if (!resolvedVendor || !resolvedColor || !quantity) continue;

        let signedDelta = quantity;

        if (tx.transaction_type === 'outtake') {
          signedDelta = -quantity;
        }

        if (tx.transaction_type === 'adjustment') {
          signedDelta = quantity;
        }

        const key = makeInventoryKey(resolvedVendor, resolvedColor, resolvedSize);
        const existing = deltaMap.get(key);

        if (existing) {
          existing.delta += signedDelta;
          existing.transactionIds.push(tx.id);
        } else {
          deltaMap.set(key, {
            vendor: resolvedVendor,
            color: resolvedColor,
            size: resolvedSize,
            delta: signedDelta,
            transactionIds: [tx.id],
          });
        }
      }

      if (deltaMap.size === 0) {
        setSyncMessage('No syncable transaction rows found. Current Inventory was left unchanged.');
        await loadData();
        return;
      }

      const { data: currentRows, error: currentError } = await supabase
        .from('inventory_items')
        .select('id, vendor, color, size, quantity');

      if (currentError) {
        console.error('Failed to load Current Inventory:', currentError);
        setSyncMessage(currentError.message || 'Failed to load Current Inventory.');
        return;
      }

      const currentMap = new Map<
        string,
        {
          id: string;
          quantity: number;
        }
      >();

      for (const row of (currentRows || []) as Array<{
        id: string;
        vendor: string | null;
        color: string | null;
        size: string | null;
        quantity: number | null;
      }>) {
        currentMap.set(
          makeInventoryKey(row.vendor || '', row.color || '', row.size || null),
          {
            id: row.id,
            quantity: Number(row.quantity || 0),
          }
        );
      }

      let added = 0;
      let updated = 0;
      const syncedTransactionIds: string[] = [];

      for (const [, deltaRow] of deltaMap.entries()) {
        const key = makeInventoryKey(deltaRow.vendor, deltaRow.color, deltaRow.size);
        const existing = currentMap.get(key);

        if (existing) {
          const nextQuantity = Math.max(0, existing.quantity + deltaRow.delta);

          const { error: updateError } = await supabase
            .from('inventory_items')
            .update({ quantity: nextQuantity })
            .eq('id', existing.id);

          if (updateError) {
            console.error('Failed to update inventory row:', updateError);
            setSyncMessage(updateError.message || 'Failed to update inventory row.');
            return;
          }

          updated += 1;
        } else {
          const startingQuantity = Math.max(0, deltaRow.delta);

          if (startingQuantity > 0) {
            const { error: insertError } = await supabase.from('inventory_items').insert({
              vendor: deltaRow.vendor,
              color: deltaRow.color,
              size: deltaRow.size,
              quantity: startingQuantity,
              location: null,
              pallet_number: null,
              earmarked_for_job: false,
              earmarked_job: null,
              earmark_notes: null,
            });

            if (insertError) {
              console.error('Failed to insert inventory row:', insertError);
              setSyncMessage(insertError.message || 'Failed to insert inventory row.');
              return;
            }

            added += 1;
          }
        }

        syncedTransactionIds.push(...deltaRow.transactionIds);
      }

      if (syncedTransactionIds.length > 0) {
        const { error: markSyncedError } = await supabase
          .from('inventory_transactions')
          .update({ synced_to_inventory_at: new Date().toISOString() })
          .in('id', syncedTransactionIds);

        if (markSyncedError) {
          console.error('Failed to mark transactions as synced:', markSyncedError);
          setSyncMessage(
            markSyncedError.message ||
              'Inventory updated, but failed to mark transactions as synced. Do not sync again until this is fixed.'
          );
          return;
        }
      }

      setSyncMessage(
        `Sync complete. Applied ${syncedTransactionIds.length} transaction${
          syncedTransactionIds.length === 1 ? '' : 's'
        }. Added ${added}, updated ${updated}. Existing inventory rows were preserved.`
      );

      await loadData();
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncMessage('Sync failed.');
    } finally {
      setIsSyncing(false);
    }
  }

  function openEarmarkModal(row: CurrentInventoryRow) {
    setPendingEarmarkRow(row);
    setEarmarkJob(row.earmarked_job || '');
    setEarmarkNotes(row.earmark_notes || '');
    setEarmarkMessage('');
  }

  async function handleSaveEarmark() {
    if (!pendingEarmarkRow) return;

    if (!earmarkJob.trim()) {
      setEarmarkMessage('Job name is required to earmark inventory.');
      return;
    }

    setIsSavingEarmark(true);
    setEarmarkMessage('');

    const { error } = await supabase
      .from('inventory_items')
      .update({
        earmarked_for_job: true,
        earmarked_job: earmarkJob.trim(),
        earmark_notes: earmarkNotes.trim() || null,
      })
      .eq('id', pendingEarmarkRow.id);

    if (error) {
      console.error('Failed to save earmark:', error);
      setEarmarkMessage(`Failed to save earmark: ${error.message}`);
      setIsSavingEarmark(false);
      return;
    }

    setPendingEarmarkRow(null);
    setEarmarkJob('');
    setEarmarkNotes('');
    setEarmarkMessage('');
    setIsSavingEarmark(false);
    await loadData();
  }

  async function handleClearEarmark() {
    if (!pendingEarmarkRow) return;

    setIsSavingEarmark(true);
    setEarmarkMessage('');

    const { error } = await supabase
      .from('inventory_items')
      .update({
        earmarked_for_job: false,
        earmarked_job: null,
        earmark_notes: null,
      })
      .eq('id', pendingEarmarkRow.id);

    if (error) {
      console.error('Failed to clear earmark:', error);
      setEarmarkMessage(`Failed to clear earmark: ${error.message}`);
      setIsSavingEarmark(false);
      return;
    }

    setPendingEarmarkRow(null);
    setEarmarkJob('');
    setEarmarkNotes('');
    setEarmarkMessage('');
    setIsSavingEarmark(false);
    await loadData();
  }

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

          <div className="flex flex-wrap items-center gap-3">
            {viewMode === 'append' && (
              <button
                type="button"
                onClick={handleSyncToCurrentInventory}
                disabled={isSyncing}
                className="rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-2.5 text-sm font-medium text-neutral-200 transition hover:border-[#c8a43a] hover:bg-neutral-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSyncing ? 'Syncing...' : 'Sync to Current Inventory'}
              </button>
            )}

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

          {viewMode === 'append' && (
            <button
              type="button"
              onClick={() => setShowSyncedRows((prev) => !prev)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                showSyncedRows
                  ? 'border-neutral-700 bg-neutral-900 text-white'
                  : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:bg-neutral-900'
              }`}
            >
              {showSyncedRows ? 'Hide Synced' : 'Show Synced'}
            </button>
          )}
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
            <p className="mt-2 text-xs text-neutral-400">
              Default view shows items that still need attention. Synced rows can be
              revealed with the toggle above.
            </p>
          </div>
        )}

        {guidedMode && viewMode === 'current' && (
          <div className="rounded-2xl border border-blue-800/60 bg-blue-950/20 p-4">
            <div className="text-sm font-semibold text-[#f7f0d0]">
              Current Inventory Guidance
            </div>
            <p className="mt-2 text-sm text-neutral-300">
              This is the operational inventory table used for stock visibility and
              job reservation. Use earmarks here to reserve material for a specific
              job or release it back into the general pool.
            </p>
          </div>
        )}

        {viewMode === 'append' && syncMessage && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-300">
            {syncMessage}
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
              <table className="w-full min-w-[980px] table-fixed text-sm">
                <thead className="border-b border-neutral-800 text-neutral-400">
                  <tr>
                    <th className="py-3 text-left font-medium">Vendor</th>
                    <th className="py-3 text-left font-medium">Item</th>
                    <th className="py-3 text-left font-medium">Size</th>
                    <th className="py-3 text-left font-medium">Unit</th>
                    <th className="py-3 text-left font-medium">Qty</th>
                    <th className="py-3 text-left font-medium">Sync</th>
                    <th className="w-[140px] py-3 text-left font-medium">Entry</th>
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
                            <div className="flex flex-wrap items-center gap-2">
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
                          <div className="flex flex-col items-start gap-1">
                            <SyncStatusBadge status={row.sync_status} />
                            {row.sync_status === 'changed' &&
                              typeof row.last_synced_qty !== 'undefined' && (
                                <span className="text-[11px] text-neutral-500">
                                  Was {row.last_synced_qty}
                                </span>
                              )}
                          </div>
                        </td>

                        <td className="w-[140px] py-3 align-middle">
                          <div className="flex items-center justify-start">
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
                              className="inline-flex min-h-[32px] items-center justify-center rounded-md border border-neutral-700 bg-neutral-900 px-3 text-xs font-medium leading-none text-neutral-200 whitespace-nowrap transition hover:border-[#c8a43a] hover:text-white"
                            >
                              edit entry
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredAppendRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-neutral-500">
                        No matching inventory rows found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="border-b border-neutral-800 text-neutral-400">
                  <tr>
                    <th className="py-3 text-left font-medium">Vendor</th>
                    <th className="py-3 text-left font-medium">Color</th>
                    <th className="py-3 text-left font-medium">Size</th>
                    <th className="py-3 text-left font-medium">Location</th>
                    <th className="py-3 text-left font-medium">Qty</th>
                    <th className="py-3 text-left font-medium">Reservation</th>
                    <th className="w-[160px] py-3 text-left font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCurrentRows.map((row) => (
                    <tr key={row.id} className="border-b border-neutral-900">
                      <td className="py-3 align-top">{row.vendor}</td>
                      <td className="py-3 align-top">{row.color}</td>
                      <td className="py-3 align-top">{row.size}</td>
                      <td className="py-3 align-top">{row.location || '—'}</td>
                      <td className="py-3 align-top">{row.quantity}</td>
                      <td className="py-3 align-top">
                        {row.earmarked_for_job ? (
                          <div className="space-y-1">
                            <span className="inline-flex rounded-full border border-purple-700/60 bg-purple-950/40 px-2 py-1 text-[11px] font-medium text-purple-300">
                              Earmarked
                            </span>
                            <div className="text-xs text-neutral-300">
                              {row.earmarked_job || 'Unnamed job'}
                            </div>
                            {row.earmark_notes?.trim() && (
                              <div className="text-xs text-neutral-500">
                                {row.earmark_notes}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-neutral-500">General pool</span>
                        )}
                      </td>
                      <td className="w-[160px] py-3 align-middle">
                        <button
                          type="button"
                          onClick={() => openEarmarkModal(row)}
                          className="inline-flex min-h-[32px] items-center justify-center rounded-md border border-neutral-700 bg-neutral-900 px-3 text-xs font-medium leading-none text-neutral-200 whitespace-nowrap transition hover:border-[#c8a43a] hover:text-white"
                        >
                          {row.earmarked_for_job ? 'Edit Earmark' : 'Earmark'}
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filteredCurrentRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-neutral-500">
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
              Click an entry to expand details
            </span>
          </div>

          {recentAnnotations.length === 0 ? (
            <div className="text-sm text-neutral-500">No recent annotations found.</div>
          ) : (
            <div className="divide-y divide-neutral-800">
              {recentAnnotations.map((row, index) => {
                const key = annotationKey(row, index);
                const isExpanded = expandedAnnotationKey === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setExpandedAnnotationKey((prev) => (prev === key ? null : key))
                    }
                    className="block w-full py-3 text-left transition hover:bg-neutral-900/50"
                  >
                    <div className="flex items-start justify-between gap-4">
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

                        {!isExpanded && (
                          <div className="mt-1 truncate text-xs text-neutral-400">
                            {annotationSummary(row)}
                          </div>
                        )}

                        {isExpanded && (
                          <div className="mt-3 space-y-2 text-xs text-neutral-300">
                            {row.match_warning?.trim() && (
                              <div>
                                <div className="mb-1 font-semibold uppercase tracking-[0.14em] text-red-300">
                                  Match Warning
                                </div>
                                <div className="rounded-lg border border-red-900/60 bg-red-950/20 px-3 py-2 text-red-200">
                                  {row.match_warning}
                                </div>
                              </div>
                            )}

                            {row.notes?.trim() && (
                              <div>
                                <div className="mb-1 font-semibold uppercase tracking-[0.14em] text-neutral-400">
                                  Notes
                                </div>
                                <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2">
                                  {row.notes}
                                </div>
                              </div>
                            )}

                            {row.appearance_notes?.trim() && (
                              <div>
                                <div className="mb-1 font-semibold uppercase tracking-[0.14em] text-neutral-400">
                                  Appearance Notes
                                </div>
                                <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2">
                                  {row.appearance_notes}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {row.match_warning?.trim() && (
                          <span className="rounded-full border border-red-800/70 bg-red-950/40 px-2 py-1 text-[11px] text-red-300">
                            Warning
                          </span>
                        )}
                        <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">
                          {isExpanded ? 'Hide' : 'Expand'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {pendingEarmarkRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-[#f7f0d0]">
              {pendingEarmarkRow.earmarked_for_job ? 'Edit Earmark' : 'Earmark Inventory'}
            </h2>

            <p className="mt-2 text-sm text-neutral-400">
              Reserve this inventory row for a specific job, or clear the earmark to
              return it to the general inventory pool.
            </p>

            <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 text-sm text-neutral-300">
              <div>
                <span className="text-neutral-500">Vendor:</span>{' '}
                {pendingEarmarkRow.vendor || '—'}
              </div>
              <div>
                <span className="text-neutral-500">Color:</span>{' '}
                {pendingEarmarkRow.color || '—'}
              </div>
              <div>
                <span className="text-neutral-500">Size:</span>{' '}
                {pendingEarmarkRow.size || '—'}
              </div>
              <div>
                <span className="text-neutral-500">Quantity:</span>{' '}
                {pendingEarmarkRow.quantity ?? '—'}
              </div>
            </div>

            <div className="mt-4">
              <label
                htmlFor="earmark-job"
                className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-neutral-500"
              >
                Job
              </label>
              <input
                id="earmark-job"
                type="text"
                value={earmarkJob}
                onChange={(e) => setEarmarkJob(e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                placeholder="e.g. Bank of America Lobby"
              />
            </div>

            <div className="mt-4">
              <label
                htmlFor="earmark-notes"
                className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-neutral-500"
              >
                Notes
              </label>
              <textarea
                id="earmark-notes"
                value={earmarkNotes}
                onChange={(e) => setEarmarkNotes(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                placeholder="Optional reservation notes"
              />
            </div>

            {earmarkMessage && (
              <div className="mt-3 rounded-xl border border-neutral-800 bg-black/40 p-3 text-sm text-neutral-300">
                {earmarkMessage}
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              {pendingEarmarkRow.earmarked_for_job && (
                <button
                  type="button"
                  onClick={handleClearEarmark}
                  disabled={isSavingEarmark}
                  className="rounded-xl border border-red-800/70 bg-red-950/40 px-4 py-2.5 text-sm font-medium text-red-200 transition hover:bg-red-950/60 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Clear Earmark
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (isSavingEarmark) return;
                  setPendingEarmarkRow(null);
                  setEarmarkJob('');
                  setEarmarkNotes('');
                  setEarmarkMessage('');
                }}
                className="rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-2.5 text-sm font-medium text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-900"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveEarmark}
                disabled={isSavingEarmark}
                className="rounded-xl border border-[#c8a43a] bg-[#c8a43a] px-4 py-2.5 text-sm font-medium text-black transition hover:bg-[#d6b24a] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingEarmark ? 'Saving...' : 'Save Earmark'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}