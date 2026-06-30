'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type TransactionTypeFilter = 'all' | 'intake' | 'outtake' | 'adjustment';

type TransactionRow = {
  id: string;
  created_at: string | null;
  transaction_type: string | null;
  vendor: string | null;
  specialty_vendor_name: string | null;
  item_name: string | null;
  size: string | null;
  unit: string | null;
  quantity: number | string | null;
  location: string | null;
  notes: string | null;
  catalog_source: string | null;
  is_earmarked: boolean | null;
  earmarked_job_name: string | null;
  earmark_notes: string | null;
  synced_to_inventory_at: string | null;
};

const fieldClass =
  'w-full border border-slate-400 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900';

function formatDateTime(value: string | null) {
  if (!value) return '—';

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTransactionType(value: string | null) {
  if (value === 'intake') return 'Intake';
  if (value === 'outtake') return 'Outtake';
  if (value === 'adjustment') return 'Adjustment';

  return value || 'Transaction';
}

function getDisplayVendor(row: TransactionRow) {
  if (row.catalog_source === 'specialty') {
    return row.specialty_vendor_name?.trim() || row.vendor?.trim() || '—';
  }

  return row.vendor?.trim() || row.specialty_vendor_name?.trim() || '—';
}

function formatQuantity(value: number | string | null) {
  if (value === null || typeof value === 'undefined') return '—';

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return String(value);
  }

  return parsed.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function getSignedQuantity(row: TransactionRow) {
  const quantity = Number(row.quantity || 0);

  if (!Number.isFinite(quantity)) {
    return '—';
  }

  if (row.transaction_type === 'outtake') {
    return `-${formatQuantity(Math.abs(quantity))}`;
  }

  if (row.transaction_type === 'adjustment') {
    return quantity < 0
      ? `-${formatQuantity(Math.abs(quantity))}`
      : `+${formatQuantity(Math.abs(quantity))}`;
  }

  return `+${formatQuantity(Math.abs(quantity))}`;
}

function getQuantityClass(row: TransactionRow) {
  if (row.transaction_type === 'outtake') {
    return 'text-red-700';
  }

  if (row.transaction_type === 'adjustment') {
    return 'text-slate-800';
  }

  return 'text-emerald-700';
}

function typeBadgeClass(type: string | null) {
  if (type === 'intake') return 'border-emerald-700 bg-emerald-50 text-emerald-800';
  if (type === 'outtake') return 'border-red-700 bg-red-50 text-red-800';
  if (type === 'adjustment') return 'border-slate-500 bg-slate-100 text-slate-900';

  return 'border-slate-400 bg-white text-slate-700';
}

function filterLabel(filter: TransactionTypeFilter) {
  if (filter === 'all') return 'All';
  if (filter === 'intake') return 'Intake';
  if (filter === 'outtake') return 'Outtake';
  return 'Adjustment';
}

export default function ActivityPage() {
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>('all');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    const { data, error } = await supabase
      .from('inventory_transactions')
      .select(
        'id, created_at, transaction_type, vendor, specialty_vendor_name, item_name, size, unit, quantity, location, notes, catalog_source, is_earmarked, earmarked_job_name, earmark_notes, synced_to_inventory_at',
      )
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Failed to load activity:', error);
      setLoadError(error.message || 'Failed to load activity.');
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data as TransactionRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (typeFilter !== 'all' && row.transaction_type !== typeFilter) {
        return false;
      }

      if (!q) return true;

      return `${formatTransactionType(row.transaction_type)} ${getDisplayVendor(row)} ${
        row.item_name || ''
      } ${row.size || ''} ${row.unit || ''} ${row.quantity || ''} ${
        row.location || ''
      } ${row.notes || ''} ${row.earmarked_job_name || ''} ${
        row.earmark_notes || ''
      }`
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search, typeFilter]);

  function toggleRow(rowId: string) {
    setExpandedRowId((current) => (current === rowId ? null : rowId));
  }

  return (
    <div className="min-h-[calc(100vh-73px)] bg-[#eef1f4] px-3 py-3 text-slate-950 sm:px-6 sm:py-6">
      <div className="border border-slate-400 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col items-stretch gap-4 border-b sm:flex-row sm:items-start sm:justify-between border-slate-300 bg-gradient-to-b from-[#f8fafc] to-[#e8edf3] px-4 py-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-600">
              Inventory Audit Trail
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Activity
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium text-slate-600">
              Transaction history is read-only by design. Corrections should be recorded as new adjustment entries, not silent edits to old rows.
            </p>
          </div>

          <button
            type="button"
            onClick={loadRows}
            disabled={loading}
            className="w-full border border-slate-500 bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-slate-900 transition hover:border-slate-900 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {loading ? 'Refreshing' : 'Refresh'}
          </button>
        </div>

        <div className="grid border-b border-slate-300 lg:grid-cols-[1fr_auto]">
          <div className="border-b border-slate-300 bg-[#f6f7f9] p-4 lg:border-b-0 lg:border-r">
            <label
              htmlFor="activity-search"
              className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-700"
            >
              Search Activity
            </label>
            <input
              id="activity-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={fieldClass}
              placeholder="Vendor, material, size, quantity, location, notes, or job"
            />
          </div>

          <div className="grid grid-cols-2 divide-x divide-y divide-slate-300 bg-white sm:grid-cols-4 sm:divide-y-0 lg:min-w-[520px]">
            {(['all', 'intake', 'outtake', 'adjustment'] as TransactionTypeFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setTypeFilter(filter)}
                className={`px-3 py-3 text-center text-[11px] font-black uppercase tracking-[0.1em] sm:px-4 sm:py-4 sm:text-xs sm:tracking-[0.12em] transition ${
                  typeFilter === filter
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                }`}
              >
                {filterLabel(filter)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid border-b border-slate-300 bg-white sm:grid-cols-3">
          <div className="border-b border-slate-300 px-4 py-3 sm:border-b-0 sm:border-r">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Visible</div>
            <div className="mt-1 text-2xl font-black text-slate-950">{filteredRows.length}</div>
          </div>
          <div className="border-b border-slate-300 px-4 py-3 sm:border-b-0 sm:border-r">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Loaded</div>
            <div className="mt-1 text-2xl font-black text-slate-950">{rows.length}</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Mode</div>
            <div className="mt-1 text-sm font-black uppercase tracking-[0.12em] text-slate-800">Audit Only</div>
          </div>
        </div>

        {loadError && (
          <div className="border-b border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            {loadError}
          </div>
        )}

        <div>
          {loading ? (
            <div className="px-4 py-8 text-sm font-semibold text-slate-600">Loading activity...</div>
          ) : filteredRows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
              No matching activity found.
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[1080px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-400 bg-[#dbe2ea] text-[11px] uppercase tracking-[0.14em] text-slate-800">
                  <th className="border-r border-slate-400 px-3 py-2 text-left font-black">Date</th>
                  <th className="border-r border-slate-400 px-3 py-2 text-left font-black">Type</th>
                  <th className="border-r border-slate-400 px-3 py-2 text-left font-black">Vendor</th>
                  <th className="border-r border-slate-400 px-3 py-2 text-left font-black">Material</th>
                  <th className="border-r border-slate-400 px-3 py-2 text-left font-black">Size</th>
                  <th className="border-r border-slate-400 px-3 py-2 text-right font-black">Qty</th>
                  <th className="border-r border-slate-400 px-3 py-2 text-left font-black">Unit</th>
                  <th className="border-r border-slate-400 px-3 py-2 text-left font-black">Location</th>
                  <th className="px-3 py-2 text-left font-black">Open</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row) => {
                  const isExpanded = expandedRowId === row.id;

                  return (
                    <Fragment key={row.id}>
                      <tr
                        onClick={() => toggleRow(row.id)}
                        className={`cursor-pointer border-b border-slate-300 transition hover:bg-slate-50 ${
                          isExpanded ? 'bg-slate-100' : 'bg-white'
                        }`}
                      >
                        <td className="whitespace-nowrap border-r border-slate-200 px-3 py-3 align-top font-medium text-slate-700">
                          {formatDateTime(row.created_at)}
                        </td>

                        <td className="whitespace-nowrap border-r border-slate-200 px-3 py-3 align-top">
                          <span className={`inline-flex border px-2 py-1 text-[11px] font-black uppercase tracking-[0.1em] ${typeBadgeClass(row.transaction_type)}`}>
                            {formatTransactionType(row.transaction_type)}
                          </span>
                        </td>

                        <td className="border-r border-slate-200 px-3 py-3 align-top font-semibold text-slate-800">
                          {getDisplayVendor(row)}
                        </td>

                        <td className="border-r border-slate-200 px-3 py-3 align-top">
                          <div className="font-black text-slate-950">{row.item_name || '—'}</div>
                          {row.is_earmarked && (
                            <div className="mt-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                              Reserved: {row.earmarked_job_name || 'Job'}
                            </div>
                          )}
                        </td>

                        <td className="border-r border-slate-200 px-3 py-3 align-top font-medium text-slate-700">
                          {row.size || '—'}
                        </td>

                        <td className={`border-r border-slate-200 px-3 py-3 text-right align-top text-base font-black tabular-nums ${getQuantityClass(row)}`}>
                          {getSignedQuantity(row)}
                        </td>

                        <td className="border-r border-slate-200 px-3 py-3 align-top font-medium text-slate-700">
                          {row.unit || '—'}
                        </td>

                        <td className="border-r border-slate-200 px-3 py-3 align-top font-medium text-slate-700">
                          {row.location || '—'}
                        </td>

                        <td className="px-3 py-3 align-top">
                          <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-900">
                            {isExpanded ? 'Close' : 'Open'}
                          </span>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="border-b border-slate-400 bg-[#f6f7f9]">
                          <td colSpan={9} className="px-4 py-4">
                            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
                              <div className="border border-slate-300 bg-white">
                                <div className="border-b border-slate-300 bg-[#e8edf3] px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-700">
                                  Transaction Notes
                                </div>
                                <div className="min-h-[84px] whitespace-pre-wrap px-3 py-3 text-sm leading-6 text-slate-700">
                                  {row.notes?.trim() || 'No notes recorded.'}
                                </div>
                              </div>

                              <div className="border border-slate-300 bg-white">
                                <div className="border-b border-slate-300 bg-[#e8edf3] px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-700">
                                  Reservation
                                </div>
                                <div className="space-y-2 px-3 py-3 text-sm text-slate-700">
                                  <div>
                                    <span className="font-black text-slate-950">Reserved:</span>{' '}
                                    {row.is_earmarked ? 'Yes' : 'No'}
                                  </div>
                                  <div>
                                    <span className="font-black text-slate-950">Job:</span>{' '}
                                    {row.earmarked_job_name || '—'}
                                  </div>
                                  <div>
                                    <span className="font-black text-slate-950">Notes:</span>{' '}
                                    {row.earmark_notes || '—'}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 border border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                              <span className="font-black text-slate-950">Correction policy:</span>{' '}
                              Do not directly edit transaction history. If this row is wrong, create a new correction or exact-count adjustment so the audit trail remains honest.
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-300 md:hidden">
                {filteredRows.map((row) => {
                  const isExpanded = expandedRowId === row.id;

                  return (
                    <div key={row.id} className={isExpanded ? 'bg-slate-50' : 'bg-white'}>
                      <button
                        type="button"
                        onClick={() => toggleRow(row.id)}
                        className="w-full px-4 py-4 text-left"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex border px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${typeBadgeClass(row.transaction_type)}`}>
                                {formatTransactionType(row.transaction_type)}
                              </span>
                              <span className="text-xs font-bold text-slate-500">{formatDateTime(row.created_at)}</span>
                            </div>
                            <div className="mt-2 truncate text-base font-black text-slate-950">{row.item_name || '—'}</div>
                            <div className="mt-1 text-sm font-semibold text-slate-700">
                              {getDisplayVendor(row)} • {row.size || '—'} • {row.location || '—'}
                            </div>
                            {row.is_earmarked && (
                              <div className="mt-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                                Reserved: {row.earmarked_job_name || 'Job'}
                              </div>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <div className={`text-xl font-black tabular-nums ${getQuantityClass(row)}`}>{getSignedQuantity(row)}</div>
                            <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{row.unit || '—'}</div>
                          </div>
                        </div>
                        <div className="mt-3 text-[11px] font-black uppercase tracking-[0.14em] text-slate-700">
                          {isExpanded ? 'Close Details' : 'Open Details'}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-slate-300 bg-[#f6f7f9] px-4 py-4">
                          <div className="border border-slate-300 bg-white">
                            <div className="border-b border-slate-300 bg-[#e8edf3] px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-700">Transaction Notes</div>
                            <div className="min-h-[72px] whitespace-pre-wrap px-3 py-3 text-sm leading-6 text-slate-700">{row.notes?.trim() || 'No notes recorded.'}</div>
                          </div>
                          <div className="mt-3 border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700">
                            <div><span className="font-black text-slate-950">Reserved:</span> {row.is_earmarked ? 'Yes' : 'No'}</div>
                            <div className="mt-2"><span className="font-black text-slate-950">Job:</span> {row.earmarked_job_name || '—'}</div>
                            <div className="mt-2"><span className="font-black text-slate-950">Notes:</span> {row.earmark_notes || '—'}</div>
                          </div>
                          <div className="mt-3 border border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                            <span className="font-black text-slate-950">Correction policy:</span> Create a new correction or exact-count adjustment instead of editing old activity.
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
