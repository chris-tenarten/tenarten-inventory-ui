'use client';

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

type InventoryGroup = {
  key: string;
  primary: InventoryRow;
  lots: InventoryRow[];
  totalQuantity: number;
  unit: string | null;
  isReserved: boolean;
  updatedAt: string | null;
};

type AdjustmentType = 'add' | 'remove' | 'set_exact';

type StockLine = {
  id: string;
  vendor: string;
  material: string;
  size: string;
  category: string;
  quantity: string;
  unit: string;
  location: string;
  palletNumber: string;
  note: string;
};

type StockMovementMode = 'single' | 'multiple';

const LAST_ENTERED_BY_KEY = 'tenarten_last_entered_by';
const ADMIN_STORAGE_KEY = 'tenarten_admin_access';

const fieldClass =
  'w-full border border-slate-400 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900';

const labelClass = 'mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-600';

function RefreshIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 12a9 9 0 0 1-15.5 6.2" />
      <path d="M3 12A9 9 0 0 1 18.5 5.8" />
      <path d="M18 2v5h-5" />
      <path d="M6 22v-5h5" />
    </svg>
  );
}

function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function ChevronRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}


function normalizeSearch(value: unknown) {
  return String(value ?? '').toLowerCase();
}

function normalizeKeyPart(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getNumericQuantity(value: number | string | null) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
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

function createStockLine(seed?: Partial<StockLine>): StockLine {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    vendor: seed?.vendor || '',
    material: seed?.material || '',
    size: seed?.size || '',
    category: seed?.category || '',
    quantity: seed?.quantity || '',
    unit: seed?.unit || 'Bags',
    location: seed?.location || 'Denton',
    palletNumber: seed?.palletNumber || '',
    note: seed?.note || '',
  };
}

function lineMatchesRow(line: StockLine, row: InventoryRow) {
  return (
    normalizeKeyPart(row.vendor) === normalizeKeyPart(line.vendor) &&
    normalizeKeyPart(row.color) === normalizeKeyPart(line.material) &&
    normalizeKeyPart(row.size) === normalizeKeyPart(line.size) &&
    normalizeKeyPart(row.unit || 'Bags') === normalizeKeyPart(line.unit || 'Bags') &&
    normalizeKeyPart(row.location || 'Denton') === normalizeKeyPart(line.location || 'Denton')
  );
}

function rowStatus(row: InventoryRow) {
  if (row.earmarked_for_job) return 'Reserved';
  return 'General';
}

function groupKey(row: InventoryRow) {
  return [row.vendor, row.color, row.size, row.category, row.unit, row.location].map(normalizeKeyPart).join('|');
}

function latestDate(rows: InventoryRow[]) {
  const timestamps = rows
    .map((row) => (row.updated_at ? new Date(row.updated_at).getTime() : 0))
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) return null;
  const latest = Math.max(...timestamps);
  return latest > 0 ? new Date(latest).toISOString() : null;
}

function buildInventoryGroups(rows: InventoryRow[]) {
  const map = new Map<string, InventoryRow[]>();

  rows.forEach((row) => {
    const key = groupKey(row);
    const existing = map.get(key) || [];
    existing.push(row);
    map.set(key, existing);
  });

  return Array.from(map.entries()).map(([key, lots]) => ({
    key,
    lots,
    primary: lots[0],
    totalQuantity: lots.reduce((sum, lot) => sum + getNumericQuantity(lot.quantity), 0),
    unit: lots[0]?.unit || null,
    isReserved: lots.some((lot) => Boolean(lot.earmarked_for_job)),
    updatedAt: latestDate(lots),
  }));
}

function groupSearchText(group: InventoryGroup) {
  return group.lots
    .flatMap((row) => [
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
    ])
    .concat([group.totalQuantity, group.lots.length > 1 ? `${group.lots.length} lots` : 'single lot'])
    .map(normalizeSearch)
    .join(' ');
}

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [editVendor, setEditVendor] = useState('');
  const [editMaterial, setEditMaterial] = useState('');
  const [editSize, setEditSize] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editUnit, setEditUnit] = useState('');
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
  const [stockMovementMode, setStockMovementMode] = useState<StockMovementMode>('single');
  const [stockLines, setStockLines] = useState<StockLine[]>([createStockLine()]);
  const [bulkMovementMessage, setBulkMovementMessage] = useState('');
  const [isApplyingBulkMovement, setIsApplyingBulkMovement] = useState(false);
  const [isDeletingMaterial, setIsDeletingMaterial] = useState(false);
  const [isRecordStockOpen, setIsRecordStockOpen] = useState(false);
  const [recordMovementType, setRecordMovementType] = useState<'intake' | 'outtake'>('intake');

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

  useEffect(() => {
    if ((!selectedGroupKey && !isRecordStockOpen) || typeof document === 'undefined') return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedGroupKey, isRecordStockOpen]);

  const inventoryGroups = useMemo(() => buildInventoryGroups(rows), [rows]);

  const filteredGroups = useMemo(() => {
    const q = normalizeSearch(search.trim());

    if (!q) return inventoryGroups;

    return inventoryGroups.filter((group) => groupSearchText(group).includes(q));
  }, [inventoryGroups, search]);

  const selectedGroup = useMemo(() => {
    if (!selectedGroupKey) return null;
    return inventoryGroups.find((group) => group.key === selectedGroupKey) || null;
  }, [inventoryGroups, selectedGroupKey]);

  const selectedRow = useMemo(() => {
    if (!selectedGroup) return null;
    return (
      selectedGroup.lots.find((lot) => String(lot.id) === selectedLotId) || selectedGroup.primary || null
    );
  }, [selectedGroup, selectedLotId]);

  function getSelectedRow() {
    return selectedRow;
  }

  function populateEditFields(row: InventoryRow) {
    setSelectedLotId(String(row.id));
    setEditVendor(row.vendor || '');
    setEditMaterial(row.color || '');
    setEditSize(row.size || '');
    setEditCategory(row.category || '');
    setEditUnit(row.unit || '');
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
    setBulkMovementMessage('');
    setStockMovementMode('single');
    setStockLines([
      createStockLine({
        vendor: row.vendor || '',
        material: row.color || '',
        size: row.size || '',
        category: row.category || '',
        unit: row.unit || 'Bags',
        location: row.location || 'Denton',
      }),
    ]);
  }

  function openGroup(group: InventoryGroup) {
    if (selectedGroupKey === group.key) {
      setSelectedGroupKey(null);
      setSelectedLotId(null);
      setDetailsMessage('');
      setAdjustmentMessage('');
      return;
    }

    setSelectedGroupKey(group.key);
    populateEditFields(group.primary);
  }

  function selectLot(row: InventoryRow) {
    populateEditFields(row);
  }

  function openRecordStockDialog() {
    setSelectedGroupKey(null);
    setSelectedLotId(null);
    setDetailsMessage('');
    setAdjustmentMessage('');
    setBulkMovementMessage('');
    setRecordMovementType('intake');
    setStockLines([createStockLine()]);
    setIsRecordStockOpen(true);
  }

  function closeRecordStockDialog() {
    setIsRecordStockOpen(false);
    setBulkMovementMessage('');
    setIsApplyingBulkMovement(false);
  }

  async function handleSaveDetails() {
    const row = getSelectedRow();
    if (!row) return;

    const enteredBy = editEnteredBy.trim();
    const note = editNote.trim();
    const earmarkNotes = editEarmarkNotes.trim();
    const earmarkJob = editEarmarkJob.trim();
    const nextVendor = editVendor.trim();
    const nextMaterial = editMaterial.trim();
    const nextSize = editSize.trim();
    const nextCategory = editCategory.trim();
    const nextUnit = editUnit.trim();

    const identityChanged =
      nextVendor !== (row.vendor || '') ||
      nextMaterial !== (row.color || '') ||
      nextSize !== (row.size || '') ||
      nextCategory !== (row.category || '') ||
      nextUnit !== (row.unit || '');

    if (identityChanged && !enteredBy) {
      setDetailsMessage('Your name is required when correcting material information.');
      return;
    }

    if ((note || earmarkNotes) && !enteredBy) {
      setDetailsMessage('Your name is required when adding a note.');
      return;
    }

    if (!nextMaterial) {
      setDetailsMessage('Material name is required.');
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

    const identityCorrectionNote = identityChanged
      ? formatNamedNote(
          enteredBy,
          [
            'Material information corrected.',
            `Vendor: ${row.vendor || '—'} → ${nextVendor || '—'}`,
            `Material: ${row.color || '—'} → ${nextMaterial || '—'}`,
            `Size: ${row.size || '—'} → ${nextSize || '—'}`,
            `Category: ${row.category || '—'} → ${nextCategory || '—'}`,
            `Unit: ${row.unit || '—'} → ${nextUnit || '—'}`,
          ].join('\n'),
        )
      : '';

    let nextNotes = row.notes || null;

    if (identityCorrectionNote) {
      nextNotes = appendNote(nextNotes, identityCorrectionNote);
    }

    if (note) {
      nextNotes = appendNote(nextNotes, formatNamedNote(enteredBy, note));
    }

    const nextEarmarkNotes = editReserved
      ? earmarkNotes
        ? appendNote(row.earmark_notes, formatNamedNote(enteredBy, earmarkNotes))
        : row.earmark_notes || null
      : null;

    const payload = {
      vendor: nextVendor || null,
      color: nextMaterial,
      size: nextSize || null,
      category: nextCategory || null,
      unit: nextUnit || null,
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
    setDetailsMessage(identityChanged ? 'Material information corrected.' : 'Changes saved.');
    setIsSavingDetails(false);

    if (identityChanged) {
      setSelectedGroupKey(null);
      setSelectedLotId(null);
    }
  }

  function updateStockLine(lineId: string, field: keyof StockLine, value: string) {
    setStockLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, [field]: value } : line)));
  }

  function addStockLine() {
    const row = getSelectedRow();
    setStockLines((prev) => [
      ...prev,
      createStockLine({
        vendor: row?.vendor || prev.at(-1)?.vendor || '',
        material: row?.color || prev.at(-1)?.material || '',
        size: row?.size || prev.at(-1)?.size || '',
        category: row?.category || prev.at(-1)?.category || '',
        unit: row?.unit || prev.at(-1)?.unit || 'Bags',
        location: row?.location || prev.at(-1)?.location || 'Denton',
      }),
    ]);
  }

  function removeStockLine(lineId: string) {
    setStockLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.id !== lineId)));
  }

  async function applyLineMovement(line: StockLine, enteredBy: string, movementType: 'intake' | 'outtake', nowIso: string) {
    const qty = Number(line.quantity);
    const vendor = line.vendor.trim();
    const material = line.material.trim();
    const size = line.size.trim();
    const unit = line.unit.trim() || 'Bags';
    const location = line.location.trim() || 'Denton';
    const category = line.category.trim();

    if (!vendor || !material) throw new Error('Vendor and material are required for every line.');
    if (!Number.isFinite(qty) || qty <= 0) throw new Error(`Invalid quantity for ${material} ${size || ''}.`);

    const matchingLots = rows
      .filter((row) => lineMatchesRow({ ...line, unit, location }, row))
      .sort((a, b) => getNumericQuantity(b.quantity) - getNumericQuantity(a.quantity));

    if (movementType === 'intake') {
      const targetLot = matchingLots[0];

      if (targetLot) {
        const nextQty = getNumericQuantity(targetLot.quantity) + qty;
        const { error } = await supabase
          .from('inventory_items')
          .update({ quantity: nextQty, updated_at: nowIso })
          .eq('id', targetLot.id);

        if (error) throw error;

        setRows((prev) =>
          prev.map((row) =>
            String(row.id) === String(targetLot.id)
              ? { ...row, quantity: nextQty, updated_at: nowIso }
              : row,
          ),
        );
      } else {
        const { data, error } = await supabase
          .from('inventory_items')
          .insert({
            vendor,
            color: material,
            size: size || null,
            category: category || null,
            quantity: qty,
            unit,
            location,
            pallet_number: line.palletNumber.trim() || null,
            notes: null,
            earmarked_for_job: false,
            earmarked_job: null,
            earmark_notes: null,
            updated_at: nowIso,
          })
          .select('id, vendor, color, size, category, quantity, unit, location, pallet_number, notes, earmarked_for_job, earmarked_job, earmark_notes, updated_at, last_counted_at, last_counted_by')
          .single();

        if (error) throw error;
        if (data) setRows((prev) => [...prev, data as InventoryRow]);
      }
    } else {
      let remaining = qty;
      const updates: { row: InventoryRow; nextQty: number }[] = [];

      for (const lot of matchingLots) {
        if (remaining <= 0) break;
        const currentQty = getNumericQuantity(lot.quantity);
        if (currentQty <= 0) continue;
        const taken = Math.min(currentQty, remaining);
        updates.push({ row: lot, nextQty: currentQty - taken });
        remaining -= taken;
      }

      if (remaining > 0) {
        throw new Error(`Not enough stock for ${vendor} / ${material} / ${size || 'no size'}.`);
      }

      for (const update of updates) {
        const { error } = await supabase
          .from('inventory_items')
          .update({ quantity: update.nextQty, updated_at: nowIso })
          .eq('id', update.row.id);
        if (error) throw error;
      }

      setRows((prev) =>
        prev.map((row) => {
          const update = updates.find((item) => String(item.row.id) === String(row.id));
          return update ? { ...row, quantity: update.nextQty, updated_at: nowIso } : row;
        }),
      );
    }

    const txNote = buildTransactionNote({
      enteredBy,
      reason: line.note.trim() || (movementType === 'intake' ? 'Multi-line stock intake.' : 'Multi-line stock outtake.'),
      location,
      palletNumber: line.palletNumber,
      category,
    });

    const { error: txError } = await supabase.from('inventory_transactions').insert({
      transaction_type: movementType,
      vendor,
      item_name: material,
      size: size || null,
      unit,
      quantity: qty,
      location,
      notes: txNote,
      catalog_source: 'standard',
      catalog_row_id: null,
      mix_number: null,
      custom_mix_label: null,
      specialty_vendor_name: null,
      specialty_product_line: null,
      specialty_component_type: null,
      is_earmarked: false,
      earmarked_job_name: null,
      earmarked_job_id: null,
      earmarked_at: null,
      earmark_released_at: null,
      earmark_notes: null,
      synced_to_inventory_at: nowIso,
    });

    if (txError) throw txError;
  }

  async function handleApplyBulkMovement() {
    const enteredBy = editEnteredBy.trim();

    if (!enteredBy) {
      setBulkMovementMessage('Your name is required.');
      return;
    }

    const activeLines = stockLines.filter((line) =>
      [line.vendor, line.material, line.size, line.quantity].some((value) => value.trim()),
    );

    if (activeLines.length === 0) {
      setBulkMovementMessage('Add at least one line item.');
      return;
    }

    if (enteredBy && typeof window !== 'undefined') {
      window.localStorage.setItem(LAST_ENTERED_BY_KEY, enteredBy);
    }

    const nowIso = new Date().toISOString();

    setIsApplyingBulkMovement(true);
    setBulkMovementMessage('');

    try {
      for (const line of activeLines) {
        await applyLineMovement(line, enteredBy, recordMovementType, nowIso);
      }

      setBulkMovementMessage(
        recordMovementType === 'intake'
          ? `${activeLines.length} intake line${activeLines.length === 1 ? '' : 's'} recorded.`
          : `${activeLines.length} outtake line${activeLines.length === 1 ? '' : 's'} recorded.`,
      );
      setStockLines([createStockLine()]);
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to apply stock movement.';
      setBulkMovementMessage(message);
    } finally {
      setIsApplyingBulkMovement(false);
    }
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
      if (qty > currentQty) {
        setAdjustmentMessage(
          `Cannot outtake ${formatQuantity(qty)} ${row.unit || ''}. Selected lot only has ${formatQuantity(currentQty)} ${row.unit || ''}.`,
        );
        return;
      }

      nextQty = currentQty - qty;
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
      `Delete this inventory lot?\n\n${vendor} / ${material} / ${size}\nCurrent quantity: ${quantity} ${unit}\n\nThis removes only this current inventory lot. Activity history will remain.`,
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
    setSelectedGroupKey(null);
    setSelectedLotId(null);
    setDetailsMessage('');
    setAdjustmentMessage('');
    setIsDeletingMaterial(false);
  }

  function renderLotSelector(group: InventoryGroup) {
    if (group.lots.length <= 1) return null;

    return (
      <div className="border border-slate-300 bg-white p-3">
        <div className={labelClass}>Inventory Lots</div>
        <div className="grid gap-2">
          {group.lots.map((lot, index) => {
            const isActive = String(lot.id) === selectedLotId;
            return (
              <button
                key={lot.id}
                type="button"
                onClick={() => selectLot(lot)}
                className={`grid gap-2 border px-3 py-2 text-left text-sm transition sm:grid-cols-[auto_1fr_auto] sm:items-center ${
                  isActive
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-800 hover:border-slate-500 hover:bg-slate-50'
                }`}
              >
                <span className="text-[10px] font-black uppercase tracking-[0.14em] opacity-70">Lot {index + 1}</span>
                <span className="font-semibold">
                  {lot.location || 'No location'}{lot.pallet_number ? ` · Pallet ${lot.pallet_number}` : ''}
                </span>
                <span className="font-black tabular-nums">
                  {formatQuantity(lot.quantity)} {lot.unit || group.unit || ''}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
          The table shows the combined total. Select a lot before editing details, deleting, or recording stock movement.
        </p>
      </div>
    );
  }

  function renderDetailPanel(group: InventoryGroup) {
    const row = selectedRow || group.primary;
    const selectedLotLabel = group.lots.length > 1 ? `Selected lot: ${formatQuantity(row.quantity)} ${row.unit || group.unit || ''}` : 'Single lot';

    return (
      <div className="border-t border-slate-400 bg-[#eef1f4] p-3 md:p-4">
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <section className="border border-slate-400 bg-white p-3 md:p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                  Group Detail
                </div>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">
                  {group.primary.vendor || '—'} / {group.primary.color || '—'} / {group.primary.size || '—'}
                </h2>
              </div>

              <div className="grid grid-cols-3 divide-x divide-slate-300 border border-slate-400 bg-white text-sm">
                <div className="px-3 py-2">
                  <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Total Qty</div>
                  <div className="mt-1 font-black tabular-nums text-slate-950">
                    {formatQuantity(group.totalQuantity)} {group.unit || ''}
                  </div>
                </div>
                <div className="px-3 py-2">
                  <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Lots</div>
                  <div className="mt-1 font-black tabular-nums text-slate-950">{group.lots.length}</div>
                </div>
                <div className="px-3 py-2">
                  <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Updated</div>
                  <div className="mt-1 text-xs font-semibold text-slate-700">{formatDateTime(group.updatedAt)}</div>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              {renderLotSelector(group)}

              <div className="border border-slate-300 bg-[#f8fafc] p-3">
                <div className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                  Edit Lot Details
                </div>
                <p className="mb-3 text-xs font-semibold text-slate-500">{selectedLotLabel}</p>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className={labelClass}>Vendor</label>
                    <input value={editVendor} onChange={(event) => setEditVendor(event.target.value)} className={fieldClass} placeholder="e.g. Arim / KCI / TM" />
                  </div>

                  <div>
                    <label className={labelClass}>Material</label>
                    <input value={editMaterial} onChange={(event) => setEditMaterial(event.target.value)} className={fieldClass} placeholder="e.g. Blanco Mexicano" />
                  </div>

                  <div>
                    <label className={labelClass}>Size</label>
                    <input value={editSize} onChange={(event) => setEditSize(event.target.value)} className={fieldClass} placeholder="e.g. #1 / #3-5" />
                  </div>

                  <div>
                    <label className={labelClass}>Category</label>
                    <input value={editCategory} onChange={(event) => setEditCategory(event.target.value)} className={fieldClass} placeholder="e.g. glass / marble / filler" />
                  </div>

                  <div>
                    <label className={labelClass}>Unit</label>
                    <input value={editUnit} onChange={(event) => setEditUnit(event.target.value)} className={fieldClass} placeholder="e.g. Bags" />
                  </div>

                  <div>
                    <label className={labelClass}>Location</label>
                    <input value={editLocation} onChange={(event) => setEditLocation(event.target.value)} className={fieldClass} placeholder="e.g. Denton / Backstock / Aisle 2" />
                  </div>

                  <div>
                    <label className={labelClass}>Pallet #</label>
                    <input value={editPalletNumber} onChange={(event) => setEditPalletNumber(event.target.value)} className={fieldClass} placeholder="e.g. P-014" />
                  </div>

                  <div>
                    <label className={labelClass}>Your Name</label>
                    <input value={editEnteredBy} onChange={(event) => setEditEnteredBy(event.target.value)} className={fieldClass} placeholder="e.g. Chris" />
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
                        <input value={editEarmarkJob} onChange={(event) => setEditEarmarkJob(event.target.value)} className={fieldClass} placeholder="e.g. Bank of America Lobby" />
                      </div>

                      <div>
                        <label className={labelClass}>Reservation Note</label>
                        <input value={editEarmarkNotes} onChange={(event) => setEditEarmarkNotes(event.target.value)} className={fieldClass} placeholder="Optional note to append" />
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
                      placeholder="Append a timestamped note to this lot"
                    />
                  </div>
                </div>
              </div>

              {row.notes?.trim() && (
                <div className="border border-slate-300 bg-white p-3">
                  <div className={labelClass}>Selected Lot Notes</div>
                  <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{row.notes}</div>
                </div>
              )}

              {detailsMessage && (
                <div className="border border-slate-300 bg-white p-3 text-sm font-semibold text-slate-700">
                  {detailsMessage}
                </div>
              )}

              <div className="flex flex-wrap justify-between gap-2 border-t border-slate-300 pt-4">
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
                    onClick={() => openGroup(group)}
                    disabled={isDeletingMaterial}
                    className="border border-slate-400 bg-white px-4 py-2 text-sm font-black text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Close
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteMaterial(row)}
                  disabled={isDeletingMaterial || isSavingDetails || isApplyingAdjustment}
                  className="border border-red-400 bg-red-50 px-4 py-2 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeletingMaterial ? 'Deleting...' : 'Delete Selected Lot'}
                </button>
              </div>
            </div>
          </section>

          <aside className="border border-slate-400 bg-[#f8fafc] p-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                Stock Movement
              </div>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                Record a movement against the selected lot only. Use + Record Stock for multi-line entry.
              </p>
            </div>

            <div className="mt-4 border border-slate-300 bg-white p-3 text-sm">
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Selected Lot Qty</div>
              <div className="mt-1 font-black tabular-nums text-slate-950">
                {formatQuantity(row.quantity)} {row.unit || group.unit || ''}
              </div>
            </div>

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
                        adjustmentType === type ? 'bg-slate-800 text-white' : 'text-slate-800 hover:bg-slate-100'
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
                        adjustmentType === 'set_exact' ? 'bg-slate-800 text-white' : 'text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      Set Exact
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className={labelClass}>Quantity</label>
                <input value={adjustmentQty} onChange={(event) => setAdjustmentQty(event.target.value)} inputMode="decimal" className={fieldClass} placeholder="e.g. 5" />
              </div>

              <div>
                <label className={labelClass}>Reason / Note</label>
                <textarea value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} rows={4} className={fieldClass} placeholder="e.g. Used for Job 25-017" />
              </div>

              {adjustmentMessage && (
                <div className="border border-slate-300 bg-white p-3 text-sm font-semibold text-slate-700">
                  {adjustmentMessage}
                </div>
              )}

              <button
                type="button"
                onClick={handleApplyAdjustment}
                disabled={isApplyingAdjustment}
                className="w-full border border-slate-900 bg-slate-800 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isApplyingAdjustment
                  ? 'Applying...'
                  : adjustmentType === 'add'
                    ? 'Record Intake'
                    : adjustmentType === 'remove'
                      ? 'Record Outtake'
                      : 'Set Exact Count'}
              </button>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  function renderDetailsDialog(group: InventoryGroup) {
    const row = selectedRow || group.primary;

    return (
      <div
        className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/35 px-2 py-3 backdrop-blur-[2px] sm:px-4 sm:py-6"
        role="dialog"
        aria-modal="true"
        aria-label="Inventory details"
        onClick={() => {
          setSelectedGroupKey(null);
          setSelectedLotId(null);
          setDetailsMessage('');
          setAdjustmentMessage('');
        }}
      >
        <div
          className="max-h-[calc(100vh-1.5rem)] w-full max-w-[1380px] overflow-hidden border border-slate-500 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] sm:max-h-[calc(100vh-3rem)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-400 bg-[#dfe4ea] px-3 py-3 sm:px-4">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">Inventory Details</div>
              <div className="mt-1 truncate text-lg font-black text-slate-950">
                {group.primary.vendor || '—'} / {group.primary.color || '—'} / {group.primary.size || '—'}
              </div>
              <div className="mt-1 text-xs font-semibold text-slate-600">
                Selected lot: {formatQuantity(row.quantity)} {row.unit || group.unit || ''} · Group total: {formatQuantity(group.totalQuantity)} {group.unit || ''}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedGroupKey(null);
                setSelectedLotId(null);
                setDetailsMessage('');
                setAdjustmentMessage('');
              }}
              className="border border-slate-500 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-800 transition hover:border-slate-900 hover:bg-slate-100 active:translate-y-px"
            >
              Close
            </button>
          </div>

          <div className="max-h-[calc(100vh-7.5rem)] overflow-y-auto bg-[#eef1f4]">
            {renderDetailPanel(group)}
          </div>
        </div>
      </div>
    );
  }

  function renderRecordStockDialog() {
    return (
      <div
        className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/35 px-2 py-3 backdrop-blur-[2px] sm:px-4 sm:py-6"
        role="dialog"
        aria-modal="true"
        aria-label="Record stock"
        onClick={closeRecordStockDialog}
      >
        <div
          className="max-h-[calc(100vh-1.5rem)] w-full max-w-[1180px] overflow-hidden border border-slate-500 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] sm:max-h-[calc(100vh-3rem)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-400 bg-[#dfe4ea] px-3 py-3 sm:px-4">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">Record Stock</div>
              <div className="mt-1 text-lg font-black text-slate-950">Multi-line stock movement</div>
              <p className="mt-1 max-w-2xl text-xs font-semibold leading-5 text-slate-600">
                Add one or more material lines. Each line updates inventory immediately and creates its own activity transaction.
              </p>
            </div>

            <button
              type="button"
              onClick={closeRecordStockDialog}
              className="border border-slate-500 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-800 transition hover:border-slate-900 hover:bg-slate-100 active:translate-y-px"
            >
              Close
            </button>
          </div>

          <div className="max-h-[calc(100vh-7.5rem)] overflow-y-auto bg-[#eef1f4] p-3 sm:p-4">
            <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
              <aside className="border border-slate-400 bg-white p-4">
                <div className="grid gap-4">
                  <div>
                    <label className={labelClass}>Movement Type</label>
                    <div className="grid grid-cols-2 border border-slate-400 bg-white p-1">
                      {(['intake', 'outtake'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setRecordMovementType(type)}
                          className={`px-3 py-2 text-xs font-black uppercase tracking-[0.08em] transition ${
                            recordMovementType === type ? 'bg-slate-800 text-white' : 'text-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          {type === 'intake' ? 'Intake' : 'Outtake'}
                        </button>
                      ))}
                    </div>
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

                  <div className="border border-slate-300 bg-[#f8fafc] p-3 text-xs font-semibold leading-5 text-slate-600">
                    <div className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                      How this works
                    </div>
                    Intake will add to an existing matching lot when possible, or create a new lot. Outtake will pull from matching lots until the line quantity is satisfied.
                  </div>

                  {bulkMovementMessage && (
                    <div className="border border-slate-300 bg-white p-3 text-sm font-semibold text-slate-700">
                      {bulkMovementMessage}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleApplyBulkMovement}
                    disabled={isApplyingBulkMovement}
                    className="w-full border border-slate-900 bg-slate-800 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isApplyingBulkMovement
                      ? 'Recording...'
                      : recordMovementType === 'intake'
                        ? 'Record Intake Lines'
                        : 'Record Outtake Lines'}
                  </button>
                </div>
              </aside>

              <section className="border border-slate-400 bg-white p-3 sm:p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">Line Items</div>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Enter each material movement as its own line.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addStockLine}
                    className="border border-slate-400 bg-white px-4 py-2 text-sm font-black text-slate-800 transition hover:border-slate-700 hover:bg-slate-100"
                  >
                    + Add Line Item
                  </button>
                </div>

                <div className="space-y-3">
                  {stockLines.map((line, index) => (
                    <div key={line.id} className="border border-slate-300 bg-[#f8fafc] p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-600">Line {index + 1}</div>
                        <button
                          type="button"
                          onClick={() => removeStockLine(line.id)}
                          disabled={stockLines.length <= 1}
                          className="border border-red-300 bg-red-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <label className={labelClass}>Vendor</label>
                          <input value={line.vendor} onChange={(event) => updateStockLine(line.id, 'vendor', event.target.value)} className={fieldClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Material</label>
                          <input value={line.material} onChange={(event) => updateStockLine(line.id, 'material', event.target.value)} className={fieldClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Size</label>
                          <input value={line.size} onChange={(event) => updateStockLine(line.id, 'size', event.target.value)} className={fieldClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Quantity</label>
                          <input value={line.quantity} onChange={(event) => updateStockLine(line.id, 'quantity', event.target.value)} inputMode="decimal" className={fieldClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Unit</label>
                          <input value={line.unit} onChange={(event) => updateStockLine(line.id, 'unit', event.target.value)} className={fieldClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Location</label>
                          <input value={line.location} onChange={(event) => updateStockLine(line.id, 'location', event.target.value)} className={fieldClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Category</label>
                          <input value={line.category} onChange={(event) => updateStockLine(line.id, 'category', event.target.value)} className={fieldClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Pallet</label>
                          <input value={line.palletNumber} onChange={(event) => updateStockLine(line.id, 'palletNumber', event.target.value)} className={fieldClass} />
                        </div>
                        <div className="sm:col-span-2 xl:col-span-4">
                          <label className={labelClass}>Note</label>
                          <input value={line.note} onChange={(event) => updateStockLine(line.id, 'note', event.target.value)} className={fieldClass} placeholder="Optional" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-slate-300 pt-4">
                  <button
                    type="button"
                    onClick={addStockLine}
                    className="border border-slate-400 bg-white px-4 py-2 text-sm font-black text-slate-800 transition hover:border-slate-700 hover:bg-slate-100"
                  >
                    + Add Line Item
                  </button>

                  <button
                    type="button"
                    onClick={handleApplyBulkMovement}
                    disabled={isApplyingBulkMovement}
                    className="border border-slate-900 bg-slate-800 px-5 py-2 text-sm font-black text-white transition hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isApplyingBulkMovement
                      ? 'Recording...'
                      : recordMovementType === 'intake'
                        ? 'Record Intake Lines'
                        : 'Record Outtake Lines'}
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-69px)] bg-[#eef1f4] px-2 py-2 text-slate-950 sm:px-4 sm:py-4">
      <section className="mx-auto max-w-[1500px] border border-slate-400 bg-white shadow-[0_1px_0_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-400 bg-[#f6f7f9] p-3 sm:p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
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

            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch lg:justify-end">
              <button
                type="button"
                onClick={loadData}
                className="inline-flex min-h-11 items-center justify-center gap-2 border border-slate-400 bg-white px-4 py-2.5 text-[12px] font-black uppercase tracking-[0.11em] text-slate-700 transition hover:border-slate-700 hover:bg-slate-100 active:translate-y-px"
              >
                <RefreshIcon className="h-4 w-4" />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={openRecordStockDialog}
                className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap border border-slate-900 bg-slate-800 px-5 py-2.5 text-[13px] font-black uppercase tracking-[0.08em] text-white transition hover:bg-slate-950 active:translate-y-px"
              >
                <PlusIcon className="h-4 w-4" />
                <span>Record Stock</span>
              </button>
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
            <>
              <div className="md:hidden">
                <div className="divide-y divide-slate-300">
                  {filteredGroups.map((group) => {
                    const row = group.primary;
                    const isSelected = selectedGroupKey === group.key;
                    const status = group.isReserved ? 'Reserved' : 'General';

                    return (
                      <article key={group.key} className={`bg-white ${isSelected ? 'ring-2 ring-inset ring-slate-800' : ''}`}>
                        <button
                          type="button"
                          onClick={() => openGroup(group)}
                          className="block w-full cursor-pointer px-3 py-3 text-left transition hover:bg-slate-100 active:bg-slate-200"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                                {row.vendor || 'Unknown vendor'} {row.size ? `· ${row.size}` : ''}
                              </div>
                              <div className="mt-1 truncate text-base font-black leading-5 text-slate-950">
                                {row.color || '—'}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold text-slate-600">
                                <span className="border border-slate-300 bg-slate-50 px-2 py-1">{row.category || 'No category'}</span>
                                <span className="border border-slate-300 bg-slate-50 px-2 py-1">{row.location || 'No location'}</span>
                                {group.lots.length > 1 && <span className="border border-slate-300 bg-slate-50 px-2 py-1">{group.lots.length} lots</span>}
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              <div className="text-2xl font-black tabular-nums text-slate-950">{formatQuantity(group.totalQuantity)}</div>
                              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{group.unit || 'Units'}</div>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2">
                            {status === 'Reserved' ? (
                              <span className="truncate text-xs font-black text-slate-950">Reserved stock in group</span>
                            ) : (
                              <span className="text-xs font-bold text-slate-500">General stock</span>
                            )}
                            <span className="inline-flex items-center gap-1 border border-slate-500 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-900">
                              View
                              <ChevronRightIcon className="h-3 w-3" />
                            </span>
                          </div>
                        </button>
                      </article>
                    );
                  })}

                  {filteredGroups.length === 0 && (
                    <div className="py-12 text-center text-sm font-semibold text-slate-500">
                      No matching inventory rows found.
                    </div>
                  )}
                </div>
              </div>

              <div className="hidden md:block">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-[#dfe4ea] text-[10px] font-black uppercase tracking-[0.12em] text-slate-700">
                    <tr className="border-b border-slate-400">
                      <th className="px-3 py-2">Vendor</th>
                      <th className="px-3 py-2">Material</th>
                      <th className="px-3 py-2">Size</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Location</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="w-10 px-3 py-2 text-right" aria-label="Open details"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredGroups.map((group) => {
                      const row = group.primary;
                      const isSelected = selectedGroupKey === group.key;
                      const status = group.isReserved ? 'Reserved' : 'General';

                      return (
                        <Fragment key={group.key}>
                          <tr
                            onClick={() => openGroup(group)}
                            className={`${isSelected ? 'bg-slate-100' : 'bg-white'} group cursor-pointer transition hover:bg-slate-100 hover:shadow-[inset_3px_0_0_#0f172a]`}
                          >
                            <td className="px-3 py-2 font-semibold text-slate-800">{row.vendor || '—'}</td>
                            <td className="px-3 py-2 font-black text-slate-950">{row.color || '—'}</td>
                            <td className="px-3 py-2 font-semibold text-slate-800">{row.size || '—'}</td>
                            <td className="px-3 py-2 text-slate-700">{row.category || '—'}</td>
                            <td className="px-3 py-2 text-slate-700">{row.location || '—'}</td>
                            <td className="px-3 py-2 text-right font-black tabular-nums text-slate-950">
                              {formatQuantity(group.totalQuantity)} {group.unit || ''}
                              {group.lots.length > 1 && (
                                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                                  {group.lots.length} lots
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
                                  status === 'Reserved'
                                    ? 'border-slate-700 bg-slate-800 text-white'
                                    : 'border-slate-300 bg-slate-50 text-slate-600'
                                }`}
                              >
                                {status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span
                                className={`inline-flex h-7 w-7 items-center justify-center border transition ${
                                  isSelected
                                    ? 'border-slate-900 bg-slate-800 text-white'
                                    : 'border-slate-300 bg-white text-slate-700 group-hover:border-slate-700 group-hover:text-slate-950'
                                }`}
                                aria-hidden="true"
                              >
                                <ChevronRightIcon className="h-3.5 w-3.5" />
                              </span>
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })}

                    {filteredGroups.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-sm font-semibold text-slate-500">
                          No matching inventory rows found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>

      {selectedGroup && renderDetailsDialog(selectedGroup)}
      {isRecordStockOpen && renderRecordStockDialog()}
    </main>
  );
}
