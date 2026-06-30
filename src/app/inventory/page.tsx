'use client';

import Link from 'next/link';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type InventoryRow = {
  id: string | number;
  vendor: string | null;
  color: string | null;
  size: string | null;
  category: string | null;
  quantity: number | string | null;
  unit: string | null;
  location: string | null;
  pallet_number: string | null;
  notes: string | null;
  earmarked_for_job: boolean | null;
  earmarked_job: string | null;
  earmark_notes: string | null;
  updated_at?: string | null;
  last_counted_at?: string | null;
  last_counted_by?: string | null;
};

type AdjustmentType = 'add' | 'remove' | 'set_exact';

const LAST_ENTERED_BY_KEY = 'tenarten_last_entered_by';
const ADMIN_STORAGE_KEY = 'tenarten_admin_access';

const fieldClass =
  'w-full border border-slate-400 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900';

const labelClass = 'mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-600';

function normalizeSearch(value: unknown) {
  return String(value ?? '').toLowerCase();
}

function formatQuantity(value: number | string | null) {
  if (value === null || typeof value === 'undefined') return '—';

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return String(value);
  }

  return parsed.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatNamedNote(name: string, note: string) {
  const timestamp = new Date().toLocaleString();
  return `[${timestamp}] ${name.trim()}: ${note.trim()}`;
}

function appendNote(existing: string | null | undefined, noteEntry: string) {
  const current = existing?.trim();
  if (!current) return noteEntry;
  return `${current}\n\n${noteEntry}`;
}

function buildTransactionNote({
  enteredBy,
  reason,
  location,
  palletNumber,
  category,
}: {
  enteredBy: string;
  reason: string;
  location: string;
  palletNumber: string;
  category: string;
}) {
  const details = [
    reason.trim(),
    location.trim() ? `Location: ${location.trim()}` : '',
    palletNumber.trim() ? `Pallet: ${palletNumber.trim()}` : '',
    category.trim() ? `Category: ${category.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  if (!details) return null;

  return formatNamedNote(enteredBy, details);
}

function adjustmentLabel(type: AdjustmentType) {
  if (type === 'add') return 'Intake';
  if (type === 'remove') return 'Outtake';
  return 'Set Exact';
}

function rowStatus(row: InventoryRow) {
  if (row.earmarked_for_job) return 'Reserved';
  return 'General';
}

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [editLocation, setEditLocation] = useState('');
  const [editPalletNumber, setEditPalletNumber] = useState('');
  const [editEnteredBy, setEditEnteredBy] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editReserved, setEditReserved] = useState(false);
  const [editEarmarkJob, setEditEarmarkJob] = useState('');
  const [editEarmarkNotes, setEditEarmarkNotes] = useState('');
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [detailsMessage, setDetailsMessage] = useState('');

  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('remove');
  const [adjustmentQty, setAdjustmentQty] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [isApplyingAdjustment, setIsApplyingAdjustment] = useState(false);
  const [adjustmentMessage, setAdjustmentMessage] = useState('');
  const [isDeletingMaterial, setIsDeletingMaterial] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    const { data, error } = await supabase
      .from('inventory_items')
      .select(
        'id, vendor, color, size, category, quantity, unit, location, pallet_number, notes, earmarked_for_job, earmarked_job, earmark_notes, updated_at, last_counted_at, last_counted_by',
      )
      .order('vendor', { ascending: true })
      .order('color', { ascending: true })
      .order('size', { ascending: true });

    if (error) {
      console.error('Failed to load inventory:', error);
      setLoadError(error.message || 'Failed to load inventory.');
      setLoading(false);
      return;
    }

    setRows((data as InventoryRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setEditEnteredBy(window.localStorage.getItem(LAST_ENTERED_BY_KEY) || '');
    setIsAdmin(window.localStorage.getItem(ADMIN_STORAGE_KEY) === 'granted');
  }, []);

  const filteredRows = useMemo(() => {
    const q = normalizeSearch(search.trim());

    if (!q) return rows;

    return rows.filter((row) =>
      [
        row.vendor,
        row.color,
        row.size,
        row.category,
        row.quantity,
        row.unit,
        row.location,
        row.pallet_number,
        row.notes,
        row.earmarked_job,
        row.earmark_notes,
        row.last_counted_by,
        rowStatus(row),
      ]
        .map(normalizeSearch)
        .join(' ')
        .includes(q),
    );
  }, [rows, search]);

  const selectedRow = useMemo(() => {
    if (!selectedRowId) return null;
    return rows.find((row) => String(row.id) === selectedRowId) || null;
  }, [rows, selectedRowId]);

  const totalQuantity = useMemo(() => {
    return filteredRows.reduce((sum, row) => {
      const qty = Number(row.quantity || 0);
      return Number.isFinite(qty) ? sum + qty : sum;
    }, 0);
  }, [filteredRows]);

  function getSelectedRow() {
    return selectedRow;
  }

  function openRow(row: InventoryRow) {
    const rowId = String(row.id);

    if (selectedRowId === rowId) {
      setSelectedRowId(null);
      setDetailsMessage('');
      setAdjustmentMessage('');
      return;
    }

    setSelectedRowId(rowId);
    setEditLocation(row.location || '');
    setEditPalletNumber(row.pallet_number || '');
    setEditNote('');
    setEditReserved(Boolean(row.earmarked_for_job));
    setEditEarmarkJob(row.earmarked_job || '');
    setEditEarmarkNotes(row.earmark_notes || '');
    setAdjustmentType('remove');
    setAdjustmentQty('');
    setAdjustmentReason('');
    setDetailsMessage('');
    setAdjustmentMessage('');
  }

  async function handleSaveDetails() {
    const row = getSelectedRow();
    if (!row) return;

    const enteredBy = editEnteredBy.trim();
    const note = editNote.trim();
    const earmarkNotes = editEarmarkNotes.trim();
    const earmarkJob = editEarmarkJob.trim();

    if ((note || earmarkNotes) && !enteredBy) {
      setDetailsMessage('Your name is required when adding a note.');
      return;
    }

    if (editReserved && !earmarkJob) {
      setDetailsMessage('Job name is required when material is reserved.');
      return;
    }

    if (enteredBy && typeof window !== 'undefined') {
      window.localStorage.setItem(LAST_ENTERED_BY_KEY, enteredBy);
    }

    setIsSavingDetails(true);
    setDetailsMessage('');

    const nextNotes = note
      ? appendNote(row.notes, formatNamedNote(enteredBy, note))
      : row.notes || null;

    const nextEarmarkNotes = editReserved
      ? earmarkNotes
        ? appendNote(row.earmark_notes, formatNamedNote(enteredBy, earmarkNotes))
        : row.earmark_notes || null
      : null;

    const payload = {
      location: editLocation.trim() || null,
      pallet_number: editPalletNumber.trim() || null,
      notes: nextNotes,
      earmarked_for_job: editReserved,
      earmarked_job: editReserved ? earmarkJob : null,
      earmark_notes: nextEarmarkNotes,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('inventory_items').update(payload).eq('id', row.id);

    if (error) {
      console.error('Failed to save inventory details:', error);
      setDetailsMessage(error.message || 'Failed to save inventory details.');
      setIsSavingDetails(false);
      return;
    }

    setRows((prev) =>
      prev.map((current) =>
        String(current.id) === String(row.id)
          ? {
              ...current,
              ...payload,
            }
          : current,
      ),
    );

    setEditNote('');
    setDetailsMessage('Changes saved.');
    setIsSavingDetails(false);
  }

  async function handleApplyAdjustment() {
    const row = getSelectedRow();
    if (!row) return;

    const qty = Number(adjustmentQty);
    const currentQty = Number(row.quantity || 0);
    const enteredBy = editEnteredBy.trim();
    const reason = adjustmentReason.trim();

    if (!enteredBy) {
      setAdjustmentMessage('Your name is required.');
      return;
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      setAdjustmentMessage('Quantity must be a positive number.');
      return;
    }

    if (adjustmentType === 'set_exact' && !isAdmin) {
      setAdjustmentMessage('Set exact count is admin-only.');
      return;
    }

    if (enteredBy && typeof window !== 'undefined') {
      window.localStorage.setItem(LAST_ENTERED_BY_KEY, enteredBy);
    }

    const vendor = row.vendor?.trim() || '';
    const itemName = row.color?.trim() || '';

    if (!vendor || !itemName) {
      setAdjustmentMessage('Vendor and material are required for adjustments.');
      return;
    }

    let nextQty = currentQty;
    let transactionType: 'intake' | 'outtake' | 'adjustment' = 'outtake';

    if (adjustmentType === 'add') {
      nextQty = currentQty + qty;
      transactionType = 'intake';
    }

    if (adjustmentType === 'remove') {
      nextQty = Math.max(0, currentQty - qty);
      transactionType = 'outtake';
    }

    if (adjustmentType === 'set_exact') {
      nextQty = qty;
      transactionType = 'adjustment';
    }

    const nowIso = new Date().toISOString();

    setIsApplyingAdjustment(true);
    setAdjustmentMessage('');

    try {
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({
          quantity: nextQty,
          updated_at: nowIso,
          ...(adjustmentType === 'set_exact'
            ? {
                last_counted_at: nowIso,
                last_counted_by: enteredBy,
              }
            : {}),
        })
        .eq('id', row.id);

      if (updateError) {
        console.error('Failed to update quantity:', updateError);
        setAdjustmentMessage(updateError.message || 'Failed to update quantity.');
        setIsApplyingAdjustment(false);
        return;
      }

      const txNote = buildTransactionNote({
        enteredBy,
        reason:
          reason ||
          (adjustmentType === 'add'
            ? 'Inline stock intake.'
            : adjustmentType === 'remove'
              ? 'Inline stock outtake.'
              : 'Inline exact-count correction.'),
        location: editLocation,
        palletNumber: editPalletNumber,
        category: row.category || '',
      });

      const { error: txError } = await supabase.from('inventory_transactions').insert({
        transaction_type: transactionType,
        vendor,
        item_name: itemName,
        size: row.size || null,
        unit: row.unit || null,
        quantity: qty,
        location: editLocation.trim() || row.location || null,
        notes: txNote,
        catalog_source: 'standard',
        catalog_row_id: null,
        mix_number: null,
        custom_mix_label: null,
        specialty_vendor_name: null,
        specialty_product_line: null,
        specialty_component_type: null,
        is_earmarked: Boolean(row.earmarked_for_job),
        earmarked_job_name: row.earmarked_job || null,
        earmarked_job_id: null,
        earmarked_at: null,
        earmark_released_at: null,
        earmark_notes: row.earmark_notes || null,
        synced_to_inventory_at: nowIso,
      });

      if (txError) {
        console.error('Failed to record transaction:', txError);
        setAdjustmentMessage(txError.message || 'Quantity changed, but failed to record transaction.');
        setIsApplyingAdjustment(false);
        return;
      }

      setRows((prev) =>
        prev.map((current) =>
          String(current.id) === String(row.id)
            ? {
                ...current,
                quantity: nextQty,
                updated_at: nowIso,
                ...(adjustmentType === 'set_exact'
                  ? {
                      last_counted_at: nowIso,
                      last_counted_by: enteredBy,
                    }
                  : {}),
              }
            : current,
        ),
      );

      setAdjustmentQty('');
      setAdjustmentReason('');
      setAdjustmentMessage(
        adjustmentType === 'add'
          ? 'Intake recorded. Inventory updated.'
          : adjustmentType === 'remove'
            ? 'Outtake recorded. Inventory updated.'
            : 'Exact count correction recorded.',
      );
    } finally {
      setIsApplyingAdjustment(false);
    }
  }

  async function handleDeleteMaterial(row: InventoryRow) {
    const vendor = row.vendor || '—';
    const material = row.color || '—';
    const size = row.size || '—';
    const quantity = row.quantity ?? '—';
    const unit = row.unit || '';

    const confirmed = window.confirm(
      `Delete this material from Inventory?\n\n${vendor} / ${material} / ${size}\nCurrent quantity: ${quantity} ${unit}\n\nThis removes only the current inventory row. Activity history will remain.`,
    );

    if (!confirmed) return;

    setIsDeletingMaterial(true);
    setDetailsMessage('');

    const { error } = await supabase.from('inventory_items').delete().eq('id', row.id);

    if (error) {
      console.error('Failed to delete material:', error);
      setDetailsMessage(error.message || 'Failed to delete material.');
      setIsDeletingMaterial(false);
      return;
    }

    setRows((prev) => prev.filter((current) => String(current.id) !== String(row.id)));
    setSelectedRowId(null);
    setDetailsMessage('');
    setAdjustmentMessage('');
    setIsDeletingMaterial(false);
  }

  return (
    <main className="min-h-[calc(100vh-69px)] bg-[#eef1f4] px-3 py-3 text-slate-950 sm:px-4 sm:py-4">
      <section className="mx-auto max-w-[1500px] border border-slate-400 bg-white shadow-[0_1px_0_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-400 bg-gradient-to-b from-[#f4f6f8] to-[#dfe5ec]">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                Tenarten Material Control
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                Inventory
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={loadData}
                className="border border-slate-400 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-slate-700 transition hover:border-slate-700 hover:bg-slate-100"
              >
                Refresh
              </button>

              <Link
                href="/transactions"
                className="border border-slate-900 bg-slate-800 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-950"
              >
                + Record Stock
              </Link>
            </div>
          </div>

          <div className="grid border-t border-slate-300 bg-[#f6f7f9] lg:grid-cols-[1fr_auto]">
            <div className="border-b border-slate-300 p-3 lg:border-b-0 lg:border-r">
              <label htmlFor="inventory-search" className={labelClass}>
                Search current stock
              </label>

              <input
                id="inventory-search"
                className={fieldClass}
                placeholder="Vendor, material, size, category, quantity, unit, location, pallet, reservation, notes"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="grid min-w-[360px] grid-cols-3 divide-x divide-slate-300 border-slate-300 bg-white text-center">
              <div className="px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Visible</div>
                <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950">
                  {filteredRows.length.toLocaleString()}
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Total</div>
                <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950">
                  {rows.length.toLocaleString()}
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Qty Sum</div>
                <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950">
                  {formatQuantity(totalQuantity)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {loadError && (
          <div className="border-b border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {loadError}
          </div>
        )}

        <div className="bg-white">
          {loading ? (
            <div className="py-12 text-center text-sm font-semibold text-slate-500">Loading inventory...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] border-collapse text-sm">
                <thead className="border-b border-slate-500 bg-[#cfd6df] text-[10px] uppercase tracking-[0.12em] text-slate-700">
                  <tr>
                    <th className="border-r border-slate-400 px-3 py-2 text-left font-black">Vendor</th>
                    <th className="border-r border-slate-400 px-3 py-2 text-left font-black">Material</th>
                    <th className="border-r border-slate-400 px-3 py-2 text-left font-black">Size</th>
                    <th className="border-r border-slate-400 px-3 py-2 text-left font-black">Category</th>
                    <th className="border-r border-slate-400 px-3 py-2 text-left font-black">Location</th>
                    <th className="border-r border-slate-400 px-3 py-2 text-left font-black">Pallet</th>
                    <th className="border-r border-slate-400 px-3 py-2 text-right font-black">Qty</th>
                    <th className="border-r border-slate-400 px-3 py-2 text-left font-black">Status</th>
                    <th className="w-[80px] px-3 py-2 text-left font-black">Open</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {filteredRows.map((row) => {
                    const isSelected = selectedRowId === String(row.id);
                    const status = rowStatus(row);

                    return (
                      <Fragment key={row.id}>
                        <tr
                          onClick={() => openRow(row)}
                          className={`cursor-pointer transition hover:bg-slate-100 ${isSelected ? 'bg-slate-100' : 'bg-white'}`}
                        >
                          <td className="border-r border-slate-200 px-3 py-2 align-top text-slate-700">
                            {row.vendor || '—'}
                          </td>

                          <td className="border-r border-slate-200 px-3 py-2 align-top">
                            <div className="font-semibold text-slate-950">{row.color || '—'}</div>
                            {row.notes?.trim() && (
                              <div className="mt-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                                Notes attached
                              </div>
                            )}
                          </td>

                          <td className="border-r border-slate-200 px-3 py-2 align-top text-slate-700">
                            {row.size || '—'}
                          </td>

                          <td className="border-r border-slate-200 px-3 py-2 align-top text-slate-700">
                            {row.category || '—'}
                          </td>

                          <td className="border-r border-slate-200 px-3 py-2 align-top text-slate-700">
                            {row.location || '—'}
                          </td>

                          <td className="border-r border-slate-200 px-3 py-2 align-top text-slate-700">
                            {row.pallet_number || '—'}
                          </td>

                          <td className="border-r border-slate-200 px-3 py-2 text-right align-top font-black tabular-nums text-slate-950">
                            {formatQuantity(row.quantity)} <span className="font-semibold text-slate-500">{row.unit || ''}</span>
                          </td>

                          <td className="border-r border-slate-200 px-3 py-2 align-top">
                            {status === 'Reserved' ? (
                              <div className="inline-block border border-slate-400 bg-slate-100 px-2 py-1">
                                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-950">Reserved</div>
                                <div className="max-w-[210px] truncate text-xs text-slate-600">{row.earmarked_job || 'Unnamed job'}</div>
                              </div>
                            ) : (
                              <span className="text-slate-500">General</span>
                            )}
                          </td>

                          <td className="w-[80px] px-3 py-2 align-top">
                            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-800">
                              {isSelected ? 'Close' : 'Open'}
                            </span>
                          </td>
                        </tr>

                        {isSelected && (
                          <tr className="bg-[#f3f5f7]">
                            <td colSpan={9} className="p-0">
                              <div className="border-y border-slate-400 bg-[#eef1f4]">
                                <div className="grid gap-0 xl:grid-cols-[1.35fr_0.65fr]">
                                  <section className="border-b border-slate-300 p-4 xl:border-b-0 xl:border-r">
                                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                                      <div>
                                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                                          Row Detail
                                        </div>
                                        <h2 className="mt-1 text-lg font-semibold text-slate-950">
                                          {row.vendor || '—'} / {row.color || '—'} / {row.size || '—'}
                                        </h2>
                                      </div>

                                      <div className="grid grid-cols-2 divide-x divide-slate-300 border border-slate-400 bg-white text-sm">
                                        <div className="px-3 py-2">
                                          <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Current Qty</div>
                                          <div className="mt-1 font-black tabular-nums text-slate-950">
                                            {formatQuantity(row.quantity)} {row.unit || ''}
                                          </div>
                                        </div>
                                        <div className="px-3 py-2">
                                          <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Updated</div>
                                          <div className="mt-1 text-xs font-semibold text-slate-700">{formatDateTime(row.updated_at)}</div>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-2">
                                      <div>
                                        <label className={labelClass}>Location</label>
                                        <input
                                          value={editLocation}
                                          onChange={(event) => setEditLocation(event.target.value)}
                                          className={fieldClass}
                                          placeholder="e.g. Denton / Backstock / Aisle 2"
                                        />
                                      </div>

                                      <div>
                                        <label className={labelClass}>Pallet #</label>
                                        <input
                                          value={editPalletNumber}
                                          onChange={(event) => setEditPalletNumber(event.target.value)}
                                          className={fieldClass}
                                          placeholder="e.g. P-014"
                                        />
                                      </div>

                                      <div>
                                        <label className={labelClass}>Your Name</label>
                                        <input
                                          value={editEnteredBy}
                                          onChange={(event) => setEditEnteredBy(event.target.value)}
                                          className={fieldClass}
                                          placeholder="e.g. Chris"
                                        />
                                      </div>

                                      <div className="flex items-end">
                                        <label className="flex w-full cursor-pointer items-center gap-3 border border-slate-400 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">
                                          <input
                                            type="checkbox"
                                            checked={editReserved}
                                            onChange={(event) => setEditReserved(event.target.checked)}
                                            className="h-4 w-4 accent-slate-800"
                                          />
                                          Reserved for job
                                        </label>
                                      </div>

                                      {editReserved && (
                                        <>
                                          <div>
                                            <label className={labelClass}>Job Name</label>
                                            <input
                                              value={editEarmarkJob}
                                              onChange={(event) => setEditEarmarkJob(event.target.value)}
                                              className={fieldClass}
                                              placeholder="e.g. Bank of America Lobby"
                                            />
                                          </div>

                                          <div>
                                            <label className={labelClass}>Reservation Note</label>
                                            <input
                                              value={editEarmarkNotes}
                                              onChange={(event) => setEditEarmarkNotes(event.target.value)}
                                              className={fieldClass}
                                              placeholder="Optional note to append"
                                            />
                                          </div>
                                        </>
                                      )}

                                      <div className="md:col-span-2">
                                        <label className={labelClass}>Add Note</label>
                                        <textarea
                                          value={editNote}
                                          onChange={(event) => setEditNote(event.target.value)}
                                          rows={3}
                                          className={fieldClass}
                                          placeholder="Append a timestamped note to this material"
                                        />
                                      </div>
                                    </div>

                                    {row.notes?.trim() && (
                                      <div className="mt-4 border border-slate-300 bg-white p-3">
                                        <div className={labelClass}>Existing Notes</div>
                                        <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{row.notes}</div>
                                      </div>
                                    )}

                                    {detailsMessage && (
                                      <div className="mt-3 border border-slate-300 bg-white p-3 text-sm font-semibold text-slate-700">
                                        {detailsMessage}
                                      </div>
                                    )}

                                    <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-slate-300 pt-4">
                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={handleSaveDetails}
                                          disabled={isSavingDetails || isDeletingMaterial}
                                          className="border border-slate-900 bg-slate-800 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          {isSavingDetails ? 'Saving...' : 'Save Details'}
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => openRow(row)}
                                          disabled={isDeletingMaterial}
                                          className="border border-slate-400 bg-white px-4 py-2 text-sm font-black text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          Cancel
                                        </button>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => handleDeleteMaterial(row)}
                                        disabled={isDeletingMaterial || isSavingDetails || isApplyingAdjustment}
                                        className="border border-red-400 bg-red-50 px-4 py-2 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {isDeletingMaterial ? 'Deleting...' : 'Delete Material'}
                                      </button>
                                    </div>
                                  </section>

                                  <aside className="bg-[#f8fafc] p-4">
                                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                                      Stock Movement
                                    </div>
                                    <p className="mt-1 border-b border-slate-300 pb-3 text-xs font-semibold leading-5 text-slate-600">
                                      Updates inventory immediately and writes a transaction to Activity.
                                    </p>

                                    <div className="mt-4 grid gap-3">
                                      <div>
                                        <label className={labelClass}>Movement Type</label>
                                        <div className="inline-flex border border-slate-400 bg-white p-1">
                                          {(['add', 'remove'] as AdjustmentType[]).map((type) => (
                                            <button
                                              key={type}
                                              type="button"
                                              onClick={() => setAdjustmentType(type)}
                                              className={`px-3 py-2 text-xs font-black transition ${
                                                adjustmentType === type
                                                  ? 'bg-slate-800 text-white'
                                                  : 'text-slate-800 hover:bg-slate-100'
                                              }`}
                                            >
                                              {adjustmentLabel(type)}
                                            </button>
                                          ))}

                                          {isAdmin && (
                                            <button
                                              type="button"
                                              onClick={() => setAdjustmentType('set_exact')}
                                              className={`px-3 py-2 text-xs font-black transition ${
                                                adjustmentType === 'set_exact'
                                                  ? 'bg-slate-800 text-white'
                                                  : 'text-slate-800 hover:bg-slate-100'
                                              }`}
                                            >
                                              Set Exact
                                            </button>
                                          )}
                                        </div>
                                      </div>

                                      <div>
                                        <label className={labelClass}>Quantity</label>
                                        <input
                                          value={adjustmentQty}
                                          onChange={(event) => setAdjustmentQty(event.target.value)}
                                          inputMode="decimal"
                                          className={fieldClass}
                                          placeholder="e.g. 5"
                                        />
                                      </div>

                                      <div>
                                        <label className={labelClass}>Reason / Note</label>
                                        <textarea
                                          value={adjustmentReason}
                                          onChange={(event) => setAdjustmentReason(event.target.value)}
                                          rows={4}
                                          className={fieldClass}
                                          placeholder="e.g. Used for Job 25-017"
                                        />
                                      </div>
                                    </div>

                                    {adjustmentMessage && (
                                      <div className="mt-3 border border-slate-300 bg-white p-3 text-sm font-semibold text-slate-700">
                                        {adjustmentMessage}
                                      </div>
                                    )}

                                    <button
                                      type="button"
                                      onClick={handleApplyAdjustment}
                                      disabled={isApplyingAdjustment}
                                      className="mt-4 w-full border border-slate-900 bg-slate-800 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {isApplyingAdjustment
                                        ? 'Applying...'
                                        : adjustmentType === 'add'
                                          ? 'Record Intake'
                                          : adjustmentType === 'remove'
                                            ? 'Record Outtake'
                                            : 'Set Exact Count'}
                                    </button>
                                  </aside>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}

                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-sm font-semibold text-slate-500">
                        No matching inventory rows found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}