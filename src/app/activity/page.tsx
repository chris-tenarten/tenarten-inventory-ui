'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/lib/language';

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
  reversal_of_transaction_id: string | null;
  reversed_at: string | null;
  reversed_by: string | null;
};

const fieldClass =
  'h-9 w-full rounded-sm border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-100';

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
  const { language, tr } = useLanguage();
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
        'id, created_at, transaction_type, vendor, specialty_vendor_name, item_name, size, unit, quantity, location, notes, catalog_source, is_earmarked, earmarked_job_name, earmark_notes, synced_to_inventory_at, reversal_of_transaction_id, reversed_at, reversed_by',
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
    const timeout = window.setTimeout(() => {
      void loadRows();
    }, 0);

    return () => window.clearTimeout(timeout);
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
    <div className="min-h-[calc(100vh-73px)] bg-[#eef1f4] px-3 py-5 text-slate-950 sm:px-5 sm:py-7">
      <div className="mx-auto w-full max-w-[1800px]">
        <div className="mb-4 border-b border-slate-200 pb-4"><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{tr('Operational ledger', 'Registro operativo')}</div><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{tr('Inventory Activity', 'Movimientos de inventario')}</h1><p className="mt-1 text-sm text-slate-600">{tr('Inventory receipts, usage, transfers, and adjustments.', 'Entradas, consumos, transferencias y ajustes de inventario.')}</p></div>
        <div className="overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-white p-3 sm:p-4">
          <div>
            <label
              htmlFor="activity-search"
              className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500"
            >
              {tr('Search Inventory Activity', 'Buscar movimientos de inventario')}
            </label>
            <input
              id="activity-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={fieldClass}
              placeholder={tr('Vendor, material, size, quantity, location, notes, or job', 'Proveedor, material, tamaño, cantidad, ubicación, notas o trabajo')}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span id="activity-filter-label" className="shrink-0 text-sm font-semibold text-slate-700">{tr('Show', 'Mostrar')}</span>
            <div role="group" aria-labelledby="activity-filter-label" className="inline-flex h-9 items-stretch divide-x divide-slate-300 overflow-hidden rounded-sm border border-slate-300 bg-slate-50">
              {(['all', 'intake', 'outtake', 'adjustment'] as TransactionTypeFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={typeFilter === filter}
                  onClick={() => setTypeFilter(filter)}
                  className={`h-full px-3 text-center text-xs font-semibold transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 sm:px-4 ${
                    typeFilter === filter
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-white hover:text-slate-950'
                  }`}
                >
                  {language === 'es'
                    ? ({ all: 'Todos', intake: 'Entrada', outtake: 'Salida', adjustment: 'Ajuste' } as const)[filter]
                    : filterLabel(filter)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={loadRows}
              disabled={loading}
              className="ml-auto h-9 rounded-sm border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? tr('Refreshing', 'Actualizando') : tr('Refresh', 'Actualizar')}
            </button>
          </div>
        </div>

        {loadError && (
          <div className="border-b border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            {loadError}
          </div>
        )}

        <div>
          {loading ? (
            <div className="px-4 py-8 text-sm font-semibold text-slate-600">{tr('Loading activity...', 'Cargando movimientos...')}</div>
          ) : filteredRows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
              {tr('No matching activity found.', 'No se encontraron movimientos.')}
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[1080px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-600">
                  <th className="border-r border-slate-200 px-3 py-2 text-left font-semibold">{tr('Date', 'Fecha')}</th>
                  <th className="border-r border-slate-200 px-3 py-2 text-left font-semibold">{tr('Type', 'Tipo')}</th>
                  <th className="border-r border-slate-200 px-3 py-2 text-left font-semibold">{tr('Vendor', 'Proveedor')}</th>
                  <th className="border-r border-slate-200 px-3 py-2 text-left font-semibold">{tr('Material', 'Material')}</th>
                  <th className="border-r border-slate-200 px-3 py-2 text-left font-semibold">{tr('Size', 'Tamaño')}</th>
                  <th className="border-r border-slate-200 px-3 py-2 text-right font-semibold">{tr('Qty', 'Cant.')}</th>
                  <th className="border-r border-slate-200 px-3 py-2 text-left font-semibold">{tr('Unit', 'Unidad')}</th>
                  <th className="border-r border-slate-200 px-3 py-2 text-left font-semibold">{tr('Location', 'Ubicación')}</th>
                  <th className="px-3 py-2 text-left font-semibold">{tr('Open', 'Abrir')}</th>
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
                        <td className="whitespace-nowrap border-r border-slate-200 px-3 py-2 align-top font-medium text-slate-700">
                          {formatDateTime(row.created_at)}
                        </td>

                        <td className="whitespace-nowrap border-r border-slate-200 px-3 py-2 align-top">
                          <span className={`inline-flex rounded-sm border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${typeBadgeClass(row.transaction_type)}`}>
                            {formatTransactionType(row.transaction_type)}
                          </span>
                          {row.reversed_at && (
                            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-red-700">{tr('Reversed', 'Revertido')}</div>
                          )}
                        </td>

                        <td className="border-r border-slate-200 px-3 py-2 align-top font-semibold text-slate-800">
                          {getDisplayVendor(row)}
                        </td>

                        <td className="border-r border-slate-200 px-3 py-2 align-top">
                          <div className="font-semibold text-slate-950">{row.item_name || '—'}</div>
                          {row.is_earmarked && (
                            <div className="mt-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                              Reserved: {row.earmarked_job_name || 'Job'}
                            </div>
                          )}
                        </td>

                        <td className="border-r border-slate-200 px-3 py-2 align-top font-medium text-slate-700">
                          {row.size || '—'}
                        </td>

                        <td className={`border-r border-slate-200 px-3 py-2 text-right align-top text-sm font-bold tabular-nums ${getQuantityClass(row)}`}>
                          {getSignedQuantity(row)}
                        </td>

                        <td className="border-r border-slate-200 px-3 py-2 align-top font-medium text-slate-700">
                          {row.unit || '—'}
                        </td>

                        <td className="border-r border-slate-200 px-3 py-2 align-top font-medium text-slate-700">
                          {row.location || '—'}
                        </td>

                        <td className="px-3 py-2 align-top">
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
                                  {tr('Transaction Notes', 'Notas del movimiento')}
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
                              <span className={`inline-flex rounded-sm border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${typeBadgeClass(row.transaction_type)}`}>
                                {formatTransactionType(row.transaction_type)}
                              </span>
                              <span className="text-xs font-bold text-slate-500">{formatDateTime(row.created_at)}</span>
                            </div>
                            <div className="mt-2 truncate text-base font-semibold text-slate-950">{row.item_name || '—'}</div>
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
                            <div className={`text-xl font-bold tabular-nums ${getQuantityClass(row)}`}>{getSignedQuantity(row)}</div>
                            <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{row.unit || '—'}</div>
                          </div>
                        </div>
                        <div className="mt-3 text-[11px] font-black uppercase tracking-[0.14em] text-slate-700">
                          {isExpanded ? tr('Close Details', 'Cerrar detalles') : tr('Open Details', 'Abrir detalles')}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-slate-300 bg-[#f6f7f9] px-4 py-4">
                          <div className="border border-slate-300 bg-white">
                            <div className="border-b border-slate-300 bg-[#e8edf3] px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-700">{tr('Transaction Notes', 'Notas del movimiento')}</div>
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
    </div>
  );
}
