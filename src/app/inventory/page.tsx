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
  reservedForJob: boolean;
  earmarkJob: string;
  earmarkNotes: string;
  excludeFromOrderReservation: boolean;
};

type PendingReceival = {
  id: string;
  vendor: string | null;
  material_name: string;
  size: string | null;
  category: string | null;
  quantity_expected: number | string;
  quantity_received: number | string | null;
  unit: string | null;
  location: string | null;
  pallet_number: string | null;
  status: 'pending' | 'partially_received' | 'received' | 'cancelled' | string;
  ordered_by: string | null;
  order_date: string | null;
  received_by: string | null;
  eta: string | null;
  notes: string | null;
  created_at: string | null;
  received_at: string | null;
  is_earmarked: boolean | null;
  earmarked_job_name: string | null;
  earmark_notes: string | null;
};

type PendingReceivalForm = {
  vendor: string;
  material: string;
  size: string;
  category: string;
  quantity: string;
  unit: string;
  location: string;
  palletNumber: string;
  orderedBy: string;
  orderDate: string;
  eta: string;
  note: string;
  reserveOrderForJob: boolean;
  orderEarmarkJob: string;
  orderEarmarkNotes: string;
};

type StockMovementMode = 'single' | 'multiple';

const LAST_ENTERED_BY_KEY = 'tenarten_last_entered_by';
const ADMIN_STORAGE_KEY = 'tenarten_admin_access';
const PENDING_RECEIVAL_ACCESS_KEY = 'tenarten_pending_receival_access';
const PENDING_RECEIVAL_PASSWORD = 'tenarten123';
const PEOPLE_OPTIONS = ['Gio', 'Anthony'];
const DEFAULT_LOCATION_OPTIONS = ['Denton', 'Carrollton'];

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


function getSupabaseErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = String((error as { message?: unknown }).message || '').trim();
    if (message) return message;
  }
  if (typeof error === 'object' && error && 'details' in error) {
    const details = String((error as { details?: unknown }).details || '').trim();
    if (details) return details;
  }
  return fallback;
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
    reservedForJob: seed?.reservedForJob || false,
    earmarkJob: seed?.earmarkJob || '',
    earmarkNotes: seed?.earmarkNotes || '',
    excludeFromOrderReservation: seed?.excludeFromOrderReservation || false,
  };
}

function getTodayDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function createPendingReceivalForm(seed?: Partial<PendingReceivalForm>): PendingReceivalForm {
  return {
    vendor: seed?.vendor || '',
    material: seed?.material || '',
    size: seed?.size || '',
    category: seed?.category || '',
    quantity: seed?.quantity || '',
    unit: seed?.unit || 'Bags',
    location: seed?.location || 'Denton',
    palletNumber: seed?.palletNumber || '',
    orderedBy: seed?.orderedBy || '',
    orderDate: seed?.orderDate || getTodayDateInputValue(),
    eta: seed?.eta || '',
    note: seed?.note || '',
    reserveOrderForJob: seed?.reserveOrderForJob || false,
    orderEarmarkJob: seed?.orderEarmarkJob || '',
    orderEarmarkNotes: seed?.orderEarmarkNotes || '',
  };
}

function formatDateOnly(value?: string | null) {
  if (!value) return '—';

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function lineMatchesRow(line: StockLine, row: InventoryRow) {
  const lineVendor = normalizeKeyPart(line.vendor);
  const rowVendor = normalizeKeyPart(row.vendor);

  return (
    (!lineVendor || !rowVendor || rowVendor === lineVendor) &&
    normalizeKeyPart(row.color) === normalizeKeyPart(line.material) &&
    normalizeKeyPart(row.size) === normalizeKeyPart(line.size) &&
    normalizeKeyPart(row.unit || 'Bags') === normalizeKeyPart(line.unit || 'Bags') &&
    normalizeKeyPart(row.location || 'Denton') === normalizeKeyPart(line.location || 'Denton')
  );
}

function rowStatus(row: InventoryRow) {
  if (row.earmarked_for_job) return row.earmarked_job || 'Reserved';
  return 'General';
}

function groupReservedLabel(group: InventoryGroup) {
  const reservedLot = group.lots.find((lot) => Boolean(lot.earmarked_for_job));
  return reservedLot?.earmarked_job || 'Reserved';
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


function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}


function formatMaterialOption(row: InventoryRow) {
  const material = String(row.color || '').trim();
  const size = String(row.size || '').trim();
  if (!material) return '';
  return [material, size].filter(Boolean).join(' ');
}

function getLineDisplayMaterial(line: StockLine) {
  return [line.material.trim(), line.size.trim()].filter(Boolean).join(' ');
}

function stockLineStatusClass(tone: 'neutral' | 'good' | 'warning' | 'bad') {
  if (tone === 'good') return 'border-emerald-300 bg-emerald-50 text-emerald-800';
  if (tone === 'warning') return 'border-amber-300 bg-amber-50 text-amber-800';
  if (tone === 'bad') return 'border-red-300 bg-red-50 text-red-700';
  return 'border-slate-300 bg-white text-slate-600';
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
  const [editReserveQuantity, setEditReserveQuantity] = useState('');
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

  const [pendingReceivals, setPendingReceivals] = useState<PendingReceival[]>([]);
  const [pendingReceivalsLoading, setPendingReceivalsLoading] = useState(true);
  const [pendingReceivalsError, setPendingReceivalsError] = useState('');
  const [pendingReceivalUnlocked, setPendingReceivalUnlocked] = useState(false);
  const [isPendingReceivalFormOpen, setIsPendingReceivalFormOpen] = useState(false);
  const [pendingReceivalForm, setPendingReceivalForm] = useState<PendingReceivalForm>(createPendingReceivalForm());
  const [pendingReceivalLines, setPendingReceivalLines] = useState<StockLine[]>([createStockLine()]);
  const [pendingReceivalMessage, setPendingReceivalMessage] = useState('');
  const [pendingReceivalPasswordInput, setPendingReceivalPasswordInput] = useState('');
  const [isSavingPendingReceival, setIsSavingPendingReceival] = useState(false);
  const [receivingPendingId, setReceivingPendingId] = useState<string | null>(null);
  const [cancellingPendingId, setCancellingPendingId] = useState<string | null>(null);
  const [clearingReceivedPending, setClearingReceivedPending] = useState(false);
  const [receivePendingTargetId, setReceivePendingTargetId] = useState<string | null>(null);
  const [receivePendingByInput, setReceivePendingByInput] = useState('');
  const [receivePendingMessage, setReceivePendingMessage] = useState('');

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

  const loadPendingReceivals = useCallback(async () => {
    setPendingReceivalsLoading(true);
    setPendingReceivalsError('');

    const { data, error } = await supabase
      .from('pending_receivals')
      .select(
        'id, vendor, material_name, size, category, quantity_expected, quantity_received, unit, location, pallet_number, status, ordered_by, received_by, eta, notes, created_at, received_at, is_earmarked, earmarked_job_name, earmark_notes',
      )
      .in('status', ['pending', 'partially_received', 'received'])
      .order('eta', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to load pending receivals:', error);
      setPendingReceivalsError(error.message || 'Failed to load pending receivals.');
      setPendingReceivalsLoading(false);
      return;
    }

    setPendingReceivals((data as PendingReceival[]) || []);
    setPendingReceivalsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    loadPendingReceivals();
  }, [loadData, loadPendingReceivals]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setEditEnteredBy(window.localStorage.getItem(LAST_ENTERED_BY_KEY) || '');
    setIsAdmin(window.localStorage.getItem(ADMIN_STORAGE_KEY) === 'granted');
    setPendingReceivalUnlocked(window.localStorage.getItem(PENDING_RECEIVAL_ACCESS_KEY) === 'granted');
  }, []);

  useEffect(() => {
    if ((!selectedGroupKey && !isRecordStockOpen && !isPendingReceivalFormOpen) || typeof document === 'undefined') return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedGroupKey, isRecordStockOpen, isPendingReceivalFormOpen]);

  const inventoryGroups = useMemo(() => buildInventoryGroups(rows), [rows]);

  const materialOptions = useMemo(() => uniqueSorted([...rows.map((row) => row.color), ...pendingReceivals.map((row) => row.material_name)]), [rows, pendingReceivals]);
  const materialSelectionOptions = useMemo(() => uniqueSorted([...rows.map(formatMaterialOption), ...pendingReceivals.map((row) => [row.material_name, row.size].filter(Boolean).join(' '))]), [rows, pendingReceivals]);
  const sizeOptions = useMemo(() => uniqueSorted([...rows.map((row) => row.size), ...pendingReceivals.map((row) => row.size)]), [rows, pendingReceivals]);
  const vendorOptions = useMemo(() => uniqueSorted([...rows.map((row) => row.vendor), ...pendingReceivals.map((row) => row.vendor)]), [rows, pendingReceivals]);
  const categoryOptions = useMemo(() => uniqueSorted([...rows.map((row) => row.category), ...pendingReceivals.map((row) => row.category)]), [rows, pendingReceivals]);
  const unitOptions = useMemo(() => uniqueSorted([...rows.map((row) => row.unit), ...pendingReceivals.map((row) => row.unit), 'Bags', 'Pails', 'Buckets', 'Boxes']), [rows, pendingReceivals]);
  const locationOptions = useMemo(() => uniqueSorted([...rows.map((row) => row.location), ...pendingReceivals.map((row) => row.location), ...DEFAULT_LOCATION_OPTIONS]), [rows, pendingReceivals]);

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
    setEditReserveQuantity(row.earmarked_for_job ? String(row.quantity || '') : '');
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
    const currentQty = Number(row.quantity || 0);
    const reserveQty = Number(editReserveQuantity || currentQty);

    const identityChanged =
      nextVendor !== (row.vendor || '') ||
      nextMaterial !== (row.color || '') ||
      nextSize !== (row.size || '') ||
      nextCategory !== (row.category || '') ||
      nextUnit !== (row.unit || '');

    const isNewReservationSplit = editReserved && !row.earmarked_for_job;

    if (identityChanged && !enteredBy) {
      setDetailsMessage('Your name is required when correcting material information.');
      return;
    }

    if ((note || earmarkNotes || isNewReservationSplit) && !enteredBy) {
      setDetailsMessage('Your name is required when adding a note or reserving stock.');
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

    if (isNewReservationSplit) {
      if (!Number.isFinite(reserveQty) || reserveQty <= 0) {
        setDetailsMessage('Reservation quantity must be a positive number.');
        return;
      }

      if (reserveQty > currentQty) {
        setDetailsMessage(
          `Cannot reserve ${formatQuantity(reserveQty)} ${row.unit || ''}. Selected lot only has ${formatQuantity(currentQty)} ${row.unit || ''}.`,
        );
        return;
      }
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

    const basePayload = {
      vendor: nextVendor || null,
      color: nextMaterial,
      size: nextSize || null,
      category: nextCategory || null,
      unit: nextUnit || null,
      location: editLocation.trim() || null,
      pallet_number: editPalletNumber.trim() || null,
      notes: nextNotes,
      updated_at: new Date().toISOString(),
    };

    try {
      if (isNewReservationSplit && reserveQty < currentQty) {
        const remainingQty = currentQty - reserveQty;

        const { error: updateOriginalError } = await supabase
          .from('inventory_items')
          .update({
            ...basePayload,
            quantity: remainingQty,
            earmarked_for_job: false,
            earmarked_job: null,
            earmark_notes: null,
          })
          .eq('id', row.id);

        if (updateOriginalError) {
          throw updateOriginalError;
        }

        const reservationNotes = appendNote(
          null,
          formatNamedNote(
            enteredBy,
            [
              `Reserved ${formatQuantity(reserveQty)} ${nextUnit || row.unit || ''} for ${earmarkJob}.`,
              earmarkNotes ? `Note: ${earmarkNotes}` : '',
            ]
              .filter(Boolean)
              .join('\n'),
          ),
        );

        const { error: insertReservedError } = await supabase.from('inventory_items').insert({
          ...basePayload,
          quantity: reserveQty,
          notes: nextNotes,
          earmarked_for_job: true,
          earmarked_job: earmarkJob,
          earmark_notes: reservationNotes,
          last_counted_at: row.last_counted_at || null,
          last_counted_by: row.last_counted_by || null,
        });

        if (insertReservedError) {
          throw insertReservedError;
        }

        setEditNote('');
        setDetailsMessage(`Reserved ${formatQuantity(reserveQty)} ${nextUnit || row.unit || ''} for ${earmarkJob}. Remaining stock stayed general.`);
        await loadData();
        setIsSavingDetails(false);
        return;
      }

      const payload = {
        ...basePayload,
        earmarked_for_job: editReserved,
        earmarked_job: editReserved ? earmarkJob : null,
        earmark_notes: nextEarmarkNotes,
      };

      const { error } = await supabase.from('inventory_items').update(payload).eq('id', row.id);

      if (error) {
        throw error;
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
    } catch (error) {
      console.error('Failed to save inventory details:', error);
      setDetailsMessage(getSupabaseErrorMessage(error, 'Failed to save inventory details.'));
    } finally {
      setIsSavingDetails(false);
    }
  }

  function getMaterialCandidatesForLine(line: StockLine) {
    const material = normalizeKeyPart(line.material);
    const vendor = normalizeKeyPart(line.vendor);

    if (!material) return [];

    const exactMaterial = rows.filter((row) => {
      const materialMatches = normalizeKeyPart(row.color) === material;
      const vendorMatches = !vendor || !normalizeKeyPart(row.vendor) || normalizeKeyPart(row.vendor) === vendor;
      return materialMatches && vendorMatches;
    });

    if (exactMaterial.length > 0) return exactMaterial;

    return rows.filter((row) => {
      const rowMaterial = normalizeKeyPart(row.color);
      const vendorMatches = !vendor || !normalizeKeyPart(row.vendor) || normalizeKeyPart(row.vendor) === vendor;
      return material.length >= 3 && rowMaterial.includes(material) && vendorMatches;
    });
  }

  function getMatchingLotsForLine(line: StockLine) {
    const unit = line.unit.trim() || 'Bags';
    const location = line.location.trim() || 'Denton';
    return rows
      .filter((row) => lineMatchesRow({ ...line, unit, location }, row))
      .sort((a, b) => getNumericQuantity(b.quantity) - getNumericQuantity(a.quantity));
  }

  function findInventoryMatchForLine(line: StockLine) {
    const material = normalizeKeyPart(line.material);
    const size = normalizeKeyPart(line.size);

    if (!material) return null;

    const matchingLots = getMatchingLotsForLine(line);
    if (matchingLots.length > 0) return matchingLots[0];

    const candidates = getMaterialCandidatesForLine(line);
    if (size) {
      const matchingSize = candidates.find((row) => normalizeKeyPart(row.size) === size);
      if (matchingSize) return matchingSize;
    }

    return candidates[0] || null;
  }

  function hydrateStockLine(line: StockLine) {
    const match = findInventoryMatchForLine(line);

    if (!match) return line;

    const exactMaterialCandidates = rows.filter((row) => normalizeKeyPart(row.color) === normalizeKeyPart(match.color));
    const candidateSizes = uniqueSorted(exactMaterialCandidates.map((row) => row.size));

    return {
      ...line,
      material: line.material || match.color || '',
      size: line.size || (candidateSizes.length === 1 ? candidateSizes[0] : ''),
      vendor: line.vendor || match.vendor || '',
      category: line.category || match.category || '',
      unit: line.unit || match.unit || 'Bags',
      location: line.location || match.location || 'Denton',
    };
  }

  function autofillStockLine(lineId: string) {
    setStockLines((prev) => prev.map((line) => (line.id === lineId ? hydrateStockLine(line) : line)));
  }

  function updateStockLine(lineId: string, field: keyof StockLine, value: string) {
    setStockLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, [field]: value } : line)));
  }

  function getStockLineStatus(line: StockLine, movementType: 'intake' | 'outtake') {
    const material = line.material.trim();
    const size = line.size.trim();
    const qty = Number(line.quantity);
    const candidates = getMaterialCandidatesForLine(line);
    const matchingLots = getMatchingLotsForLine(line);
    const totalAvailable = matchingLots.reduce((sum, lot) => sum + getNumericQuantity(lot.quantity), 0);
    const exactMaterialCandidates = rows.filter((row) => normalizeKeyPart(row.color) === normalizeKeyPart(material));
    const candidateSizes = uniqueSorted(exactMaterialCandidates.map((row) => row.size));

    if (!material) {
      return {
        tone: 'neutral' as const,
        title: 'Enter a material name.',
        detail: 'Existing inventory will be checked as you type.',
      };
    }

    if (movementType === 'intake') {
      if (matchingLots.length > 0) {
        return {
          tone: 'good' as const,
          title: `Existing lot found: ${formatQuantity(totalAvailable)} ${line.unit || matchingLots[0].unit || 'Bags'} on hand.`,
          detail: 'This intake will add to the largest matching lot.',
        };
      }

      if (candidates.length > 0) {
        return {
          tone: 'warning' as const,
          title: 'Existing material found, but not this exact lot.',
          detail: 'This intake will create a new lot for the entered size, unit, or location.',
        };
      }

      return {
        tone: 'neutral' as const,
        title: 'New material will be created.',
        detail: 'No matching inventory item was found with the current material name.',
      };
    }

    if (!size && candidateSizes.length > 1) {
      return {
        tone: 'warning' as const,
        title: 'Choose a size before outtaking.',
        detail: `This material has multiple sizes: ${candidateSizes.join(', ')}.`,
      };
    }

    if (matchingLots.length === 0) {
      const closest = candidates[0]?.color;
      return {
        tone: 'bad' as const,
        title: 'No matching stock found.',
        detail: closest ? `Closest material match: ${closest}. Check size, unit, or location.` : 'This material is not currently in inventory.',
      };
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      return {
        tone: 'good' as const,
        title: `${formatQuantity(totalAvailable)} ${line.unit || matchingLots[0].unit || 'Bags'} available.`,
        detail: `${matchingLots.length} matching lot${matchingLots.length === 1 ? '' : 's'} found. Enter a quantity to validate the outtake.`,
      };
    }

    if (qty > totalAvailable) {
      return {
        tone: 'bad' as const,
        title: `Only ${formatQuantity(totalAvailable)} ${line.unit || matchingLots[0].unit || 'Bags'} available.`,
        detail: `Requested outtake is short by ${formatQuantity(qty - totalAvailable)} ${line.unit || matchingLots[0].unit || 'Bags'}.`,
      };
    }

    return {
      tone: 'good' as const,
      title: `${formatQuantity(totalAvailable)} ${line.unit || matchingLots[0].unit || 'Bags'} available.`,
      detail: `This outtake can be filled from ${matchingLots.length} matching lot${matchingLots.length === 1 ? '' : 's'}.`,
    };
  }

  function addStockLine() {
    setStockLines((prev) => [
      ...prev,
      createStockLine({
        vendor: prev.at(-1)?.vendor || '',
        unit: prev.at(-1)?.unit || 'Bags',
        location: prev.at(-1)?.location || 'Denton',
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

    if (!material) throw new Error('Material is required for every line.');
    if (!Number.isFinite(qty) || qty <= 0) throw new Error(`Invalid quantity for ${material} ${size || ''}.`);

    const matchingLots = getMatchingLotsForLine({ ...line, unit, location });

    if (movementType === 'outtake') {
      let remaining = qty;

      for (const lot of matchingLots) {
        if (remaining <= 0) break;
        const currentQty = getNumericQuantity(lot.quantity);
        if (currentQty <= 0) continue;
        remaining -= Math.min(currentQty, remaining);
      }

      if (remaining > 0) {
        throw new Error(`Not enough stock for ${vendor} / ${material} / ${size || 'no size'}.`);
      }
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
      vendor: vendor || null,
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

    if (txError) {
      throw new Error(getSupabaseErrorMessage(txError, 'Failed to record inventory transaction. Inventory was not changed.'));
    }

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
            vendor: vendor || null,
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

      return;
    }

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

  async function handleApplyBulkMovement() {
    const enteredBy = editEnteredBy.trim();

    if (!enteredBy) {
      setBulkMovementMessage('Your name is required.');
      return;
    }

    const activeLines = stockLines.filter((line) =>
      [line.material, line.size, line.quantity].some((value) => value.trim()),
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

    if (!itemName) {
      setAdjustmentMessage('Material is required for adjustments.');
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
        vendor: vendor || null,
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
        setAdjustmentMessage(getSupabaseErrorMessage(txError, 'Failed to record transaction. Inventory was not changed.'));
        setIsApplyingAdjustment(false);
        return;
      }

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
        setAdjustmentMessage(getSupabaseErrorMessage(updateError, 'Transaction was recorded, but inventory update failed.'));
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

  function openPendingReceivalForm() {
    if (!pendingReceivalUnlocked) {
      setPendingReceivalPasswordInput('');
      setPendingReceivalMessage('Enter the pending receival password to add expected material.');
    } else {
      setPendingReceivalMessage('');
    }

    setPendingReceivalForm(createPendingReceivalForm());
    setPendingReceivalLines([createStockLine()]);
    setIsPendingReceivalFormOpen(true);
  }

  function closePendingReceivalForm() {
    setIsPendingReceivalFormOpen(false);
    setPendingReceivalMessage('');
    setPendingReceivalPasswordInput('');
    setIsSavingPendingReceival(false);
  }

  function unlockPendingReceivalForm() {
    if (pendingReceivalPasswordInput === PENDING_RECEIVAL_PASSWORD) {
      window.localStorage.setItem(PENDING_RECEIVAL_ACCESS_KEY, 'granted');
      setPendingReceivalUnlocked(true);
      setPendingReceivalPasswordInput('');
      setPendingReceivalMessage('Unlocked.');
      return;
    }

    setPendingReceivalMessage('Incorrect pending receival password.');
  }

  function updatePendingReceivalForm(field: keyof PendingReceivalForm, value: string | boolean) {
    setPendingReceivalForm((prev) => ({ ...prev, [field]: value }));
  }

  function updatePendingReceivalLine(lineId: string, field: keyof StockLine, value: string | boolean) {
    setPendingReceivalLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, [field]: value } : line)));
  }

  function hydratePendingReceivalLine(line: StockLine) {
    const typed = getLineDisplayMaterial(line);
    const exactDisplayMatch = rows.find((row) => normalizeKeyPart(formatMaterialOption(row)) === normalizeKeyPart(typed));
    const materialOnlyMatch = rows.find((row) => normalizeKeyPart(row.color) === normalizeKeyPart(line.material));
    const match = exactDisplayMatch || materialOnlyMatch || findInventoryMatchForLine(line);

    if (!match) return line;

    return {
      ...line,
      material: match.color || line.material,
      size: match.size || line.size,
      vendor: line.vendor || match.vendor || '',
      category: line.category || match.category || '',
      unit: line.unit || match.unit || 'Bags',
      location: line.location || match.location || 'Denton',
    };
  }

  function autofillPendingReceivalLine(lineId: string) {
    setPendingReceivalLines((prev) => prev.map((line) => (line.id === lineId ? hydratePendingReceivalLine(line) : line)));
  }

  function addPendingReceivalLine() {
    const previousLine = pendingReceivalLines.at(-1);
    const nextLine = createStockLine({
      vendor: previousLine?.vendor || '',
      unit: previousLine?.unit || 'Bags',
      location: previousLine?.location || 'Denton',
      excludeFromOrderReservation: previousLine?.excludeFromOrderReservation || false,
    });

    setPendingReceivalLines((prev) => [...prev, nextLine]);
  }

  function removePendingReceivalLine(lineId: string) {
    setPendingReceivalLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.id !== lineId)));
  }

  async function handleCreatePendingReceival() {
    if (!pendingReceivalUnlocked) {
      setPendingReceivalMessage('Unlock pending receivals before creating expected material lines.');
      return;
    }

    const vendor = pendingReceivalForm.vendor.trim();
    const orderedBy = pendingReceivalForm.orderedBy.trim();
    const orderDate = pendingReceivalForm.orderDate.trim();

    if (!vendor) {
      setPendingReceivalMessage('Vendor is required.');
      return;
    }

    if (!orderedBy) {
      setPendingReceivalMessage('Ordered by is required.');
      return;
    }

    if (!orderDate) {
      setPendingReceivalMessage('Order date is required.');
      return;
    }

    const cleanedLines = pendingReceivalLines.map((line, index) => {
      const quantity = Number(line.quantity);
      const material = line.material.trim();

      return {
        line,
        index,
        quantity,
        material,
      };
    });

    const populatedLines = cleanedLines.filter(({ line, material }) => {
      return Boolean(material || line.vendor.trim() || line.size.trim() || line.quantity.trim());
    });

    if (populatedLines.length === 0) {
      setPendingReceivalMessage('Add at least one material line.');
      return;
    }

    const invalidLine = populatedLines.find(({ quantity, material }) => !material || !Number.isFinite(quantity) || quantity <= 0);

    if (invalidLine) {
      setPendingReceivalMessage(`Line ${invalidLine.index + 1} needs a material and a positive expected quantity.`);
      return;
    }

    if (pendingReceivalForm.reserveOrderForJob && !pendingReceivalForm.orderEarmarkJob.trim()) {
      setPendingReceivalMessage('Job name is required when reserving the order.');
      return;
    }

    if (orderedBy && typeof window !== 'undefined') {
      window.localStorage.setItem(LAST_ENTERED_BY_KEY, orderedBy);
      setEditEnteredBy(orderedBy);
    }

    setIsSavingPendingReceival(true);
    setPendingReceivalMessage('');

    const rowsToInsert = populatedLines.map(({ line, quantity, material }) => {
      const isReserved = Boolean(pendingReceivalForm.reserveOrderForJob && !line.excludeFromOrderReservation);
      const earmarkJob = pendingReceivalForm.orderEarmarkJob.trim();
      const earmarkNotes = pendingReceivalForm.orderEarmarkNotes.trim();

      return {
        vendor: line.vendor.trim() || vendor,
        material_name: material,
        size: line.size.trim() || null,
        category: line.category.trim() || null,
        quantity_expected: quantity,
        quantity_received: 0,
        unit: line.unit.trim() || 'Bags',
        location: line.location.trim() || 'Denton',
        pallet_number: line.palletNumber.trim() || null,
        status: 'pending',
        ordered_by: orderedBy,
        order_date: orderDate,
        received_by: null,
        eta: pendingReceivalForm.eta || null,
        notes: [line.note.trim(), pendingReceivalForm.note.trim()].filter(Boolean).join('\n\n')
          ? formatNamedNote(orderedBy, [line.note.trim(), pendingReceivalForm.note.trim()].filter(Boolean).join('\n\n'))
          : null,
        received_at: null,
        is_earmarked: isReserved,
        earmarked_job_name: isReserved ? earmarkJob : null,
        earmark_notes: isReserved && earmarkNotes ? earmarkNotes : null,
      };
    });

    for (let rowIndex = 0; rowIndex < rowsToInsert.length; rowIndex += 1) {
      const { error } = await supabase.from('pending_receivals').insert(rowsToInsert[rowIndex]);

      if (error) {
        console.error(`Failed to create pending receival line ${rowIndex + 1}:`, error);
        setPendingReceivalMessage(
          `Line ${rowIndex + 1} failed: ${getSupabaseErrorMessage(error, 'Failed to create pending receival.')}`
        );
        setIsSavingPendingReceival(false);
        return;
      }
    }

    setPendingReceivalMessage(`${rowsToInsert.length} pending receival line${rowsToInsert.length === 1 ? '' : 's'} added.`);
    setPendingReceivalForm(createPendingReceivalForm({ vendor }));
    setPendingReceivalLines([createStockLine()]);
    setIsSavingPendingReceival(false);
    await loadPendingReceivals();
  }

  function openReceivePendingDialog(receival: PendingReceival) {
    setReceivePendingTargetId(receival.id);
    setReceivePendingByInput(editEnteredBy && editEnteredBy !== 'chris_test' ? editEnteredBy : '');
    setReceivePendingMessage('');
    setPendingReceivalsError('');
  }

  function closeReceivePendingDialog() {
    setReceivePendingTargetId(null);
    setReceivePendingByInput('');
    setReceivePendingMessage('');
  }

  async function confirmReceivePendingReceival() {
    const receival = pendingReceivals.find((item) => item.id === receivePendingTargetId);

    if (!receival) {
      setReceivePendingMessage('Pending receival no longer exists.');
      return;
    }

    const receivedBy = receivePendingByInput.trim();

    if (!receivedBy) {
      setReceivePendingMessage('Received by is required.');
      return;
    }

    await handleReceivePendingReceival(receival, receivedBy);
  }

  async function handleReceivePendingReceival(receival: PendingReceival, receivedBy: string) {
    const expectedQty = getNumericQuantity(receival.quantity_expected);
    const receivedQty = getNumericQuantity(receival.quantity_received);
    const remainingQty = expectedQty - receivedQty;

    if (remainingQty <= 0) return;

    if (receivedBy && typeof window !== 'undefined') {
      window.localStorage.setItem(LAST_ENTERED_BY_KEY, receivedBy);
      setEditEnteredBy(receivedBy);
    }

    setReceivingPendingId(receival.id);
    setPendingReceivalsError('');

    try {
      const { error } = await supabase.rpc('receive_pending_receival', {
        p_receival_id: receival.id,
        p_received_by: receivedBy,
      });

      if (error) {
        throw new Error(getSupabaseErrorMessage(error, 'Failed to receive pending material.'));
      }

      await Promise.all([loadData(), loadPendingReceivals()]);
      closeReceivePendingDialog();
    } catch (error) {
      const message = getSupabaseErrorMessage(
        error,
        'Failed to receive pending material. Run the pending receival safety SQL migration, then try again.',
      );
      setPendingReceivalsError(message);
    } finally {
      setReceivingPendingId(null);
    }
  }

  async function handleCancelPendingReceival(receival: PendingReceival) {
    const confirmed = window.confirm(
      `Cancel this pending receival?\n\n${receival.vendor || '—'} / ${receival.material_name} / ${receival.size || '—'}\nExpected: ${formatQuantity(receival.quantity_expected)} ${receival.unit || ''}\n\nThis will not affect inventory.`,
    );

    if (!confirmed) return;

    setCancellingPendingId(receival.id);
    setPendingReceivalsError('');

    const { error } = await supabase
      .from('pending_receivals')
      .update({ status: 'cancelled' })
      .eq('id', receival.id);

    if (error) {
      setPendingReceivalsError(error.message || 'Failed to cancel pending receival.');
      setCancellingPendingId(null);
      return;
    }

    setPendingReceivals((prev) => prev.filter((item) => item.id !== receival.id));
    setCancellingPendingId(null);
  }

  async function handleClearReceivedPendingReceivals() {
    const receivedIds = pendingReceivals.filter((item) => item.status === 'received').map((item) => item.id);

    if (receivedIds.length === 0) return;

    setClearingReceivedPending(true);
    setPendingReceivalsError('');

    const { error } = await supabase
      .from('pending_receivals')
      .update({ status: 'cleared' })
      .in('id', receivedIds);

    if (error) {
      setPendingReceivalsError(error.message || 'Failed to clear received pending receivals.');
      setClearingReceivedPending(false);
      return;
    }

    setPendingReceivals((prev) => prev.filter((item) => item.status !== 'received'));
    setClearingReceivedPending(false);
  }

  function renderPendingReceivalsQueue() {
    return (
      <section className="mx-auto mb-4 max-w-[1500px] overflow-hidden border border-slate-500 bg-[#d8dde3] shadow-[0_2px_0_rgba(15,23,42,0.12)]">
        <style>{`
          @keyframes pending-receivals-ticker {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
          }
        `}</style>

        <div className="overflow-hidden border-b border-slate-700 bg-slate-950">
          <div
            className="flex w-max whitespace-nowrap py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-100"
            style={{ animation: 'pending-receivals-ticker 26s linear infinite' }}
          >
            {Array.from({ length: 12 }).map((_, index) => (
              <span key={index} className="mx-4 shrink-0">
                • PENDING RECEIVALS •
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-500 bg-[#c8ced6] px-3 py-3 sm:px-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-700">Expected Material Queue</div>
            <p className="mt-1 text-xs font-semibold text-slate-700">Office logs placed orders here. Shop receives them into stock only after material physically arrives.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {pendingReceivals.some((item) => item.status === 'received') && (
              <button
                type="button"
                onClick={handleClearReceivedPendingReceivals}
                disabled={clearingReceivedPending}
                className="border border-emerald-700 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-emerald-900 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {clearingReceivedPending ? 'Clearing...' : 'Clear Received Items'}
              </button>
            )}
            <button
              type="button"
              onClick={openPendingReceivalForm}
              className="border border-slate-950 bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:bg-slate-950"
            >
              + Pending Receival
            </button>
          </div>
        </div>

        {pendingReceivalsError && (
          <div className="border-b border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {pendingReceivalsError}
          </div>
        )}

        <div className="bg-[#d8dde3] p-2">
          {pendingReceivalsLoading ? (
            <div className="border border-slate-400 bg-[#e5e9ee] px-4 py-5 text-sm font-semibold text-slate-600">Loading pending receivals...</div>
          ) : pendingReceivals.length === 0 ? (
            <div className="border border-slate-400 bg-[#e5e9ee] px-4 py-5 text-sm font-semibold text-slate-600">No pending receivals.</div>
          ) : (
            <div className="overflow-x-auto border border-slate-500 bg-[#e1e5ea]">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-[#b9c1cb] text-[10px] font-black uppercase tracking-[0.12em] text-slate-800">
                  <tr className="border-b border-slate-500">
                    <th className="px-3 py-2">Vendor</th>
                    <th className="px-3 py-2">Material</th>
                    <th className="px-3 py-2">Size</th>
                    <th className="px-3 py-2 text-right">Expected</th>
                    <th className="px-3 py-2">Order Date</th>
                    <th className="px-3 py-2">ETA</th>
                    <th className="px-3 py-2">Ordered By</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-400">
                  {pendingReceivals.map((receival) => {
                    const isReceived = receival.status === 'received';
                    const isReserved = Boolean(receival.is_earmarked);
                    const rowClass = isReceived
                      ? 'bg-emerald-50/80 hover:bg-emerald-100/70'
                      : 'bg-red-50/70 hover:bg-red-100/60';

                    return (
                      <tr key={receival.id} className={rowClass}>
                        <td className="px-3 py-2 font-semibold text-slate-800">{receival.vendor || '—'}</td>
                        <td className="px-3 py-2 font-black text-slate-950">
                          <div>{receival.material_name}</div>
                          {isReserved && (
                            <div className="mt-1 inline-flex border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-white">
                              {receival.earmarked_job_name || 'Reserved'}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-800">{receival.size || '—'}</td>
                        <td className="px-3 py-2 text-right font-black tabular-nums text-slate-950">
                          {formatQuantity(receival.quantity_expected)} {receival.unit || ''}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{formatDateOnly(receival.order_date || receival.created_at)}</td>
                        <td className="px-3 py-2 text-slate-700">{formatDateOnly(receival.eta)}</td>
                        <td className="px-3 py-2 text-slate-700">
                          {isReceived ? receival.received_by || 'Received' : receival.ordered_by || '—'}
                          {isReceived && <div className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-800">Received</div>}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            {isReceived ? (
                              <span className="border border-emerald-700 bg-emerald-100 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-emerald-900">
                                Received
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openReceivePendingDialog(receival)}
                                disabled={receivingPendingId === receival.id || cancellingPendingId === receival.id}
                                className="border border-slate-950 bg-slate-800 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-white transition hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {receivingPendingId === receival.id ? 'Receiving...' : 'Receive'}
                              </button>
                            )}
                            {!isReceived && (
                              <button
                                type="button"
                                onClick={() => handleCancelPendingReceival(receival)}
                                disabled={receivingPendingId === receival.id || cancellingPendingId === receival.id}
                                className="border border-slate-500 bg-[#f6f7f9] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {cancellingPendingId === receival.id ? 'Cancelling...' : 'Cancel'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    );
  }

  function renderPendingReceivalFormDialog() {
    return (
      <div
        className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/35 px-2 py-3 backdrop-blur-[2px] sm:px-4 sm:py-6"
        role="dialog"
        aria-modal="true"
        aria-label="Pending receival"
        onClick={closePendingReceivalForm}
      >
        <div
          className="max-h-[calc(100vh-1.5rem)] w-full max-w-[900px] overflow-hidden border border-slate-500 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] sm:max-h-[calc(100vh-3rem)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-400 bg-[#dfe4ea] px-3 py-3 sm:px-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">Pending Receival</div>
              <h2 className="mt-1 text-lg font-black text-slate-950">Add Expected Material</h2>
            </div>
            <button
              type="button"
              onClick={closePendingReceivalForm}
              className="border border-slate-500 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-800 transition hover:border-slate-900 hover:bg-slate-100 active:translate-y-px"
            >
              Close
            </button>
          </div>

          <div className="max-h-[calc(100vh-7.5rem)] overflow-y-auto bg-[#eef1f4] p-3 sm:p-4">
            {!pendingReceivalUnlocked ? (
              <div className="border border-slate-400 bg-white p-4">
                <label className={labelClass}>Pending Receival Password</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={pendingReceivalPasswordInput}
                    onChange={(event) => setPendingReceivalPasswordInput(event.target.value)}
                    type="password"
                    className={fieldClass}
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={unlockPendingReceivalForm}
                    className="border border-slate-900 bg-slate-800 px-5 py-2 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:bg-slate-950"
                  >
                    Unlock
                  </button>
                </div>
                <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">This is only a temporary client-side gate. It is not real security.</p>
              </div>
            ) : (
              <div className="border border-slate-400 bg-white p-4">
                <datalist id="pending-inventory-material-options">
                  {materialSelectionOptions.map((material) => (
                    <option key={material} value={material} />
                  ))}
                </datalist>
                <datalist id="pending-inventory-size-options">
                  {sizeOptions.map((size) => (
                    <option key={size} value={size} />
                  ))}
                </datalist>
                <datalist id="pending-inventory-vendor-options">
                  {vendorOptions.map((vendor) => (
                    <option key={vendor} value={vendor} />
                  ))}
                </datalist>
                <datalist id="pending-inventory-category-options">
                  {categoryOptions.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
                <datalist id="pending-inventory-unit-options">
                  {unitOptions.map((unit) => (
                    <option key={unit} value={unit} />
                  ))}
                </datalist>
                <datalist id="pending-inventory-location-options">
                  {locationOptions.map((location) => (
                    <option key={location} value={location} />
                  ))}
                </datalist>
                <datalist id="pending-people-options">
                  {PEOPLE_OPTIONS.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>

                <div className="mb-4 grid gap-3 md:grid-cols-4">
                  <div>
                    <label className={labelClass}>Vendor *</label>
                    <input value={pendingReceivalForm.vendor} onChange={(event) => updatePendingReceivalForm('vendor', event.target.value)} list="pending-inventory-vendor-options" className={fieldClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Ordered By *</label>
                    <input value={pendingReceivalForm.orderedBy} onChange={(event) => updatePendingReceivalForm('orderedBy', event.target.value)} list="pending-people-options" className={fieldClass} placeholder="Enter your name" />
                  </div>
                  <div>
                    <label className={labelClass}>Order Date *</label>
                    <input value={pendingReceivalForm.orderDate} onChange={(event) => updatePendingReceivalForm('orderDate', event.target.value)} type="date" className={fieldClass} />
                  </div>
                  <div>
                    <label className={labelClass}>ETA</label>
                    <input value={pendingReceivalForm.eta} onChange={(event) => updatePendingReceivalForm('eta', event.target.value)} type="date" className={fieldClass} />
                  </div>
                  <div className="md:col-span-4">
                    <label className={labelClass}>Order Note</label>
                    <input value={pendingReceivalForm.note} onChange={(event) => updatePendingReceivalForm('note', event.target.value)} className={fieldClass} placeholder="PO, vendor note, etc." />
                  </div>
                </div>

                <div className={`mb-4 border p-3 ${pendingReceivalForm.reserveOrderForJob ? 'border-sky-300 bg-sky-50' : 'border-slate-300 bg-[#f8fafc]'}`}>
                  <label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={pendingReceivalForm.reserveOrderForJob}
                      onChange={(event) => updatePendingReceivalForm('reserveOrderForJob', event.target.checked)}
                      className="h-4 w-4 accent-slate-800"
                    />
                    Reserve entire order for job
                  </label>
                  {pendingReceivalForm.reserveOrderForJob && (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <label className={labelClass}>Job Name *</label>
                        <input value={pendingReceivalForm.orderEarmarkJob} onChange={(event) => updatePendingReceivalForm('orderEarmarkJob', event.target.value)} className={fieldClass} placeholder="e.g. Belmont Park VIP Desk" />
                      </div>
                      <div>
                        <label className={labelClass}>Reservation Note</label>
                        <input value={pendingReceivalForm.orderEarmarkNotes} onChange={(event) => updatePendingReceivalForm('orderEarmarkNotes', event.target.value)} className={fieldClass} placeholder="Optional reservation note" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-y border-slate-300 bg-[#f3f5f7] px-3 py-2">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">Order Lines</div>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Add every material on the same placed order. Each line uses the order vendor unless a vendor override is entered.</p>
                  </div>
                </div>

                <div className="grid gap-3">
                  {pendingReceivalLines.map((line, index) => (
                    <div key={line.id} className="border border-slate-300 bg-[#f8fafc] p-3">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">Line {index + 1}</div>
                        {pendingReceivalLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePendingReceivalLine(line.id)}
                            className="border border-slate-300 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-slate-600 transition hover:border-red-400 hover:text-red-700"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid gap-3 md:grid-cols-4">
                        <div>
                          <label className={labelClass}>Vendor Override</label>
                          <input placeholder={pendingReceivalForm.vendor || 'Uses order vendor'} value={line.vendor} onChange={(event) => updatePendingReceivalLine(line.id, 'vendor', event.target.value)} onBlur={() => autofillPendingReceivalLine(line.id)} list="pending-inventory-vendor-options" className={fieldClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Material</label>
                          <input value={line.material} onChange={(event) => updatePendingReceivalLine(line.id, 'material', event.target.value)} onBlur={() => autofillPendingReceivalLine(line.id)} list="pending-inventory-material-options" className={fieldClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Size</label>
                          <input value={line.size} onChange={(event) => updatePendingReceivalLine(line.id, 'size', event.target.value)} onBlur={() => autofillPendingReceivalLine(line.id)} list="pending-inventory-size-options" className={fieldClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Quantity Expected</label>
                          <input value={line.quantity} onChange={(event) => updatePendingReceivalLine(line.id, 'quantity', event.target.value)} inputMode="decimal" className={fieldClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Unit</label>
                          <input value={line.unit} onChange={(event) => updatePendingReceivalLine(line.id, 'unit', event.target.value)} onBlur={() => autofillPendingReceivalLine(line.id)} list="pending-inventory-unit-options" className={fieldClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Location</label>
                          <input value={line.location} onChange={(event) => updatePendingReceivalLine(line.id, 'location', event.target.value)} onBlur={() => autofillPendingReceivalLine(line.id)} list="pending-inventory-location-options" className={fieldClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Category</label>
                          <input value={line.category} onChange={(event) => updatePendingReceivalLine(line.id, 'category', event.target.value)} onBlur={() => autofillPendingReceivalLine(line.id)} list="pending-inventory-category-options" className={fieldClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Pallet #</label>
                          <input value={line.palletNumber} onChange={(event) => updatePendingReceivalLine(line.id, 'palletNumber', event.target.value)} className={fieldClass} />
                        </div>
                        <div className="md:col-span-4">
                          <label className={labelClass}>Line Note</label>
                          <input value={line.note} onChange={(event) => updatePendingReceivalLine(line.id, 'note', event.target.value)} className={fieldClass} placeholder="Optional note for this material" />
                        </div>
                        {pendingReceivalForm.reserveOrderForJob && (
                          <div className="md:col-span-4 border border-slate-300 bg-white p-3">
                            <label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-slate-800">
                              <input
                                type="checkbox"
                                checked={line.excludeFromOrderReservation}
                                onChange={(event) => updatePendingReceivalLine(line.id, 'excludeFromOrderReservation', event.target.checked)}
                                className="h-4 w-4 accent-slate-800"
                              />
                              Exclude this line from reservation
                            </label>
                            <p className="mt-2 text-xs font-semibold text-slate-500">
                              {line.excludeFromOrderReservation
                                ? 'This material will go into general stock when received.'
                                : `This material will be reserved for ${pendingReceivalForm.orderEarmarkJob || 'the selected job'} when received.`}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 border-t border-slate-300 pt-4">
                  <button
                    type="button"
                    onClick={addPendingReceivalLine}
                    className="w-full border border-slate-500 bg-white px-4 py-2.5 text-sm font-black uppercase tracking-[0.08em] text-slate-800 transition hover:border-slate-800 hover:bg-slate-100"
                  >
                    + Add Another Material
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-300 pt-4">
                  <p className="text-xs font-semibold leading-5 text-slate-500">This records expected material only. It will not touch inventory until someone clicks Receive.</p>
                  <button
                    type="button"
                    onClick={handleCreatePendingReceival}
                    disabled={isSavingPendingReceival}
                    className="border border-slate-900 bg-slate-800 px-5 py-2.5 text-sm font-black text-white transition hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingPendingReceival ? 'Saving...' : 'Add Pending Receivals'}
                  </button>
                </div>
              </div>
            )}

            {pendingReceivalMessage && (
              <div className="mt-3 border border-slate-300 bg-white p-3 text-sm font-semibold text-slate-700">
                {pendingReceivalMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderReceivePendingDialog() {
    const receival = pendingReceivals.find((item) => item.id === receivePendingTargetId);

    if (!receival) return null;

    const expectedQty = getNumericQuantity(receival.quantity_expected);
    const receivedQty = getNumericQuantity(receival.quantity_received);
    const remainingQty = expectedQty - receivedQty;

    return (
      <div
        className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/35 px-2 py-3 backdrop-blur-[2px] sm:px-4 sm:py-6"
        role="dialog"
        aria-modal="true"
        aria-label="Receive pending receival"
        onClick={closeReceivePendingDialog}
      >
        <div
          className="w-full max-w-[560px] overflow-hidden border border-slate-500 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-slate-500 bg-[#c8ced6] px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-700">Receive Pending Material</div>
            <h2 className="mt-1 text-lg font-black text-slate-950">{receival.material_name}</h2>
            <p className="mt-1 text-xs font-semibold text-slate-600">
              {receival.vendor || '—'} / {receival.size || '—'} / {formatQuantity(remainingQty)} {receival.unit || 'Bags'} remaining
            </p>
          </div>

          <div className="bg-[#eef1f4] p-4">
            <datalist id="pending-people-options">
              {PEOPLE_OPTIONS.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>

            <div className="grid gap-3">
              <div>
                <label className={labelClass}>Received By</label>
                <input
                  value={receivePendingByInput}
                  onChange={(event) => setReceivePendingByInput(event.target.value)}
                  list="pending-people-options"
                  className={fieldClass}
                  placeholder="Name"
                />
              </div>
            </div>

            {receivePendingMessage && (
              <div className="mt-3 border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-700">{receivePendingMessage}</div>
            )}

            <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-300 pt-4">
              <button
                type="button"
                onClick={closeReceivePendingDialog}
                className="border border-slate-400 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReceivePendingReceival}
                disabled={receivingPendingId === receival.id}
                className="border border-slate-950 bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {receivingPendingId === receival.id ? 'Receiving...' : 'Confirm Receive'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
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

                      {!row.earmarked_for_job && (
                        <div>
                          <label className={labelClass}>Reservation Quantity</label>
                          <input
                            value={editReserveQuantity}
                            onChange={(event) => setEditReserveQuantity(event.target.value)}
                            className={fieldClass}
                            placeholder={`Max ${formatQuantity(Number(row.quantity || 0))} ${row.unit || ''}`}
                            inputMode="decimal"
                          />
                          <p className="mt-1 text-[11px] font-medium text-slate-500">
                            Reserving less than the selected lot creates a separate reserved lot and leaves the remaining stock general.
                          </p>
                        </div>
                      )}

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
            <datalist id="inventory-material-options">
              {materialOptions.map((material) => (
                <option key={material} value={material} />
              ))}
            </datalist>
            <datalist id="inventory-size-options">
              {sizeOptions.map((size) => (
                <option key={size} value={size} />
              ))}
            </datalist>
            <datalist id="inventory-vendor-options">
              {vendorOptions.map((vendor) => (
                <option key={vendor} value={vendor} />
              ))}
            </datalist>
            <datalist id="inventory-category-options">
              {categoryOptions.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
            <datalist id="inventory-unit-options">
              {unitOptions.map((unit) => (
                <option key={unit} value={unit} />
              ))}
            </datalist>
            <datalist id="inventory-location-options">
              {locationOptions.map((location) => (
                <option key={location} value={location} />
              ))}
            </datalist>

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
                    Intake will add to an existing matching lot when possible, or create a new lot. Outtake will pull from matching lots until the line quantity is satisfied. Vendor is optional when matching existing inventory.
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
                  {stockLines.map((line, index) => {
                    const status = getStockLineStatus(line, recordMovementType);

                    return (
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
                          <input value={line.vendor} onChange={(event) => updateStockLine(line.id, 'vendor', event.target.value)} onBlur={() => autofillStockLine(line.id)} list="inventory-vendor-options" className={fieldClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Material</label>
                          <input value={line.material} onChange={(event) => updateStockLine(line.id, 'material', event.target.value)} onBlur={() => autofillStockLine(line.id)} list="inventory-material-options" className={fieldClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Size</label>
                          <input value={line.size} onChange={(event) => updateStockLine(line.id, 'size', event.target.value)} onBlur={() => autofillStockLine(line.id)} list="inventory-size-options" className={fieldClass} />
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

                      <div className={`mt-3 border px-3 py-2 text-xs font-semibold leading-5 ${stockLineStatusClass(status.tone)}`}>
                        <div className="font-black">{status.title}</div>
                        <div className="mt-0.5 opacity-90">{status.detail}</div>
                      </div>
                    </div>
                    );
                  })}
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
      {renderPendingReceivalsQueue()}

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
                onClick={() => {
                  loadData();
                  loadPendingReceivals();
                }}
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
                    const status = group.isReserved ? groupReservedLabel(group) : 'General';

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
                            {group.isReserved ? (
                              <span className="truncate text-xs font-black text-slate-950">{status}</span>
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
                      const status = group.isReserved ? groupReservedLabel(group) : 'General';

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
                                  group.isReserved
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
      {isPendingReceivalFormOpen && renderPendingReceivalFormDialog()}
      {receivePendingTargetId && renderReceivePendingDialog()}
    </main>
  );
}
