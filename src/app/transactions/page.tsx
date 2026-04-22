'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type StandardCatalogRow = {
  id: string;
  vendor: string;
  item_name: string;
  size: string;
  unit: string;
};

type SpecialtyCatalogRow = {
  id: string;
  vendor_name: string;
  item_name: string;
  size?: string | null;
  packaging?: string | null;
  price_unit?: string | null;
  product_line?: string | null;
  component_type?: string | null;
  material_type?: string | null;
  quote_required?: boolean | null;
};

type TransactionSourceMode = 'standard' | 'specialty';

type InventoryHistoryRow = {
  id: string;
  created_at: string | null;
  transaction_type: string | null;
  vendor: string | null;
  specialty_vendor_name: string | null;
  item_name: string | null;
  size: string | null;
  unit: string | null;
  quantity: number | null;
  location: string | null;
  notes: string | null;
  catalog_source: string | null;
  mix_number: string | null;
  custom_mix_label: string | null;
  specialty_product_line: string | null;
  specialty_component_type: string | null;
};

type StandardLineItem = {
  id: string;
  item_name: string;
  size: string;
  unit: string;
  quantity: string;
};

const PAGE_SIZE = 1000;
const PRESET_SIZE_OPTIONS = ['#3-5', '#4', '#5-7'];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

function formatDateTime(value: string | null) {
  if (!value) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString();
}

function getHistoryDisplayVendor(row: InventoryHistoryRow) {
  if (row.catalog_source === 'specialty') {
    return row.specialty_vendor_name || row.vendor || '—';
  }

  return row.vendor || row.specialty_vendor_name || '—';
}

function makeStandardLine(): StandardLineItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    item_name: '',
    size: '',
    unit: '',
    quantity: '',
  };
}

export default function TransactionsPage() {
  const searchParams = useSearchParams();

  const inventoryVendorParam = searchParams.get('vendor')?.trim() || '';
  const inventoryItemParam = searchParams.get('item_name')?.trim() || '';
  const inventorySizeParam = searchParams.get('size')?.trim() || '';
  const hasInventoryContext = Boolean(
    inventoryVendorParam || inventoryItemParam || inventorySizeParam
  );

  const [standardCatalogRows, setStandardCatalogRows] = useState<
    StandardCatalogRow[]
  >([]);
  const [specialtyCatalogRows, setSpecialtyCatalogRows] = useState<
    SpecialtyCatalogRow[]
  >([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [sourceMode, setSourceMode] =
    useState<TransactionSourceMode>('standard');
  const [txType, setTxType] = useState('intake');

  const [vendor, setVendor] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const [standardLines, setStandardLines] = useState<StandardLineItem[]>([
    makeStandardLine(),
  ]);

  const [specialtyItem, setSpecialtyItem] = useState('');
  const [specialtySize, setSpecialtySize] = useState('');
  const [specialtyUnit, setSpecialtyUnit] = useState('');
  const [specialtyQuantity, setSpecialtyQuantity] = useState('');
  const [mixNumber, setMixNumber] = useState('');
  const [customMixLabel, setCustomMixLabel] = useState('');

  const [inventoryHistoryRows, setInventoryHistoryRows] = useState<
    InventoryHistoryRow[]
  >([]);
  const [isLoadingInventoryHistory, setIsLoadingInventoryHistory] =
    useState(false);
  const [inventoryHistoryError, setInventoryHistoryError] = useState('');
  const [detectedInventoryMode, setDetectedInventoryMode] = useState<
    TransactionSourceMode | 'mixed' | null
  >(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  const [editingTransactionId, setEditingTransactionId] = useState<
    string | null
  >(null);

  useEffect(() => {
    async function loadCatalogs() {
      setIsLoadingCatalog(true);
      setLoadError('');

      const allStandardRows: StandardCatalogRow[] = [];
      let standardFrom = 0;
      let keepLoadingStandard = true;

      while (keepLoadingStandard) {
        const to = standardFrom + PAGE_SIZE - 1;

        const { data, error } = await supabase
          .from('vendor_catalog')
          .select('id, vendor, item_name, size, unit')
          .order('vendor', { ascending: true })
          .order('item_name', { ascending: true })
          .order('size', { ascending: true })
          .range(standardFrom, to);

        if (error) {
          console.error('Failed to load standard transaction options:', error);
          setLoadError(error.message);
          setIsLoadingCatalog(false);
          return;
        }

        const cleaned: StandardCatalogRow[] = (data || []).map((row) => ({
          id: row.id,
          vendor: row.vendor || '',
          item_name: row.item_name || '',
          size: row.size || '',
          unit: row.unit || '',
        }));

        allStandardRows.push(...cleaned);

        if (!data || data.length < PAGE_SIZE) {
          keepLoadingStandard = false;
        } else {
          standardFrom += PAGE_SIZE;
        }
      }

      const allSpecialtyRows: SpecialtyCatalogRow[] = [];
      let specialtyFrom = 0;
      let keepLoadingSpecialty = true;

      while (keepLoadingSpecialty) {
        const to = specialtyFrom + PAGE_SIZE - 1;

        const { data, error } = await supabase
          .from('vendor_catalog_v2')
          .select(
            'id, vendor_name, item_name, size, packaging, price_unit, product_line, component_type, material_type, quote_required'
          )
          .order('vendor_name', { ascending: true })
          .order('item_name', { ascending: true })
          .order('size', { ascending: true })
          .range(specialtyFrom, to);

        if (error) {
          console.error('Failed to load specialty transaction options:', error);
          setLoadError(error.message);
          setIsLoadingCatalog(false);
          return;
        }

        const cleaned: SpecialtyCatalogRow[] = (data || []).map((row) => ({
          id: row.id,
          vendor_name: row.vendor_name || '',
          item_name: row.item_name || '',
          size: row.size || '',
          packaging: row.packaging || '',
          price_unit: row.price_unit || '',
          product_line: row.product_line || '',
          component_type: row.component_type || '',
          material_type: row.material_type || '',
          quote_required: row.quote_required ?? false,
        }));

        allSpecialtyRows.push(...cleaned);

        if (!data || data.length < PAGE_SIZE) {
          keepLoadingSpecialty = false;
        } else {
          specialtyFrom += PAGE_SIZE;
        }
      }

      setStandardCatalogRows(allStandardRows);
      setSpecialtyCatalogRows(allSpecialtyRows);
      setIsLoadingCatalog(false);
    }

    loadCatalogs();
  }, []);

  const standardVendors = useMemo(
    () => uniqueSorted(standardCatalogRows.map((r) => r.vendor)),
    [standardCatalogRows]
  );

  const specialtyVendors = useMemo(
    () => uniqueSorted(specialtyCatalogRows.map((r) => r.vendor_name)),
    [specialtyCatalogRows]
  );

  const vendors = sourceMode === 'standard' ? standardVendors : specialtyVendors;

  const standardVendorFilteredRows = useMemo(() => {
    if (!vendor.trim()) return standardCatalogRows;
    const vendorNorm = normalize(vendor);
    return standardCatalogRows.filter(
      (row) => normalize(row.vendor) === vendorNorm
    );
  }, [standardCatalogRows, vendor]);

  const specialtyVendorFilteredRows = useMemo(() => {
    if (!vendor.trim()) return specialtyCatalogRows;
    const vendorNorm = normalize(vendor);
    return specialtyCatalogRows.filter(
      (row) => normalize(row.vendor_name) === vendorNorm
    );
  }, [specialtyCatalogRows, vendor]);

  const specialtyItemSuggestions = useMemo(() => {
    const items = uniqueSorted(
      specialtyVendorFilteredRows.map((row) => row.item_name)
    );
    const q = normalize(specialtyItem);

    if (!q) return items.slice(0, 100);

    return items.filter((name) => normalize(name).includes(q)).slice(0, 100);
  }, [specialtyVendorFilteredRows, specialtyItem]);

  const specialtyItemMatches = useMemo(() => {
    const itemNorm = normalize(specialtyItem);
    if (!itemNorm) return [];

    return specialtyVendorFilteredRows.filter(
      (row) => normalize(row.item_name) === itemNorm
    );
  }, [specialtyVendorFilteredRows, specialtyItem]);

  const specialtySizeSuggestions = useMemo(() => {
    const itemNorm = normalize(specialtyItem);

    if (!vendor.trim() || !itemNorm) {
      return [];
    }

    const baseRows = specialtyVendorFilteredRows.filter(
      (row) => normalize(row.item_name) === itemNorm
    );

    const catalogSizes = baseRows
      .map((row) => (row.size || '').trim())
      .filter(Boolean);

    const sizes = uniqueSorted(
      catalogSizes.length > 0 ? catalogSizes : PRESET_SIZE_OPTIONS
    );

    const q = normalize(specialtySize);

    if (!q) return sizes.slice(0, 100);

    return sizes.filter((value) => normalize(value).includes(q)).slice(0, 100);
  }, [specialtyVendorFilteredRows, specialtyItem, specialtySize, vendor]);

  const exactSpecialtySizeMatch = useMemo(() => {
    const itemNorm = normalize(specialtyItem);
    const sizeNorm = normalize(specialtySize);

    if (!itemNorm || !sizeNorm || !vendor.trim()) return null;

    return (
      specialtyVendorFilteredRows.find(
        (row) =>
          normalize(row.item_name) === itemNorm &&
          normalize(row.size || '') === sizeNorm
      ) || null
    );
  }, [specialtyVendorFilteredRows, specialtyItem, specialtySize, vendor]);

  const selectedSpecialtyContext = useMemo(() => {
    if (exactSpecialtySizeMatch) return exactSpecialtySizeMatch;
    if (specialtyItemMatches.length === 1) return specialtyItemMatches[0];
    return null;
  }, [exactSpecialtySizeMatch, specialtyItemMatches]);

  const resolvedMixIdentity = useMemo(() => {
    if (!mixNumber.trim()) return '';
    if (customMixLabel.trim()) {
      return `Mix ${mixNumber.trim()} — ${customMixLabel.trim()}`;
    }
    return `Mix ${mixNumber.trim()}`;
  }, [mixNumber, customMixLabel]);

  function resetFormForMode(mode: TransactionSourceMode) {
    setLocation('');
    setNotes('');
    setSubmitMessage('');
    setEditingTransactionId(null);

    if (mode === 'standard') {
      setStandardLines([
        {
          ...makeStandardLine(),
          item_name:
            hasInventoryContext && detectedInventoryMode === 'standard'
              ? inventoryItemParam
              : '',
          size:
            hasInventoryContext && detectedInventoryMode === 'standard'
              ? inventorySizeParam
              : '',
          unit: '',
          quantity: '',
        },
      ]);
      setSpecialtyItem('');
      setSpecialtySize('');
      setSpecialtyUnit('');
      setSpecialtyQuantity('');
      setMixNumber('');
      setCustomMixLabel('');
    } else {
      setSpecialtyItem(
        hasInventoryContext && detectedInventoryMode === 'specialty'
          ? inventoryItemParam
          : ''
      );
      setSpecialtySize(
        hasInventoryContext && detectedInventoryMode === 'specialty'
          ? inventorySizeParam
          : ''
      );
      setSpecialtyUnit('');
      setSpecialtyQuantity('');
      setMixNumber('');
      setCustomMixLabel('');
      setStandardLines([makeStandardLine()]);
    }
  }

  useEffect(() => {
    if (!hasInventoryContext) {
      setInventoryHistoryRows([]);
      setInventoryHistoryError('');
      setDetectedInventoryMode(null);
      setIsLoadingInventoryHistory(false);
      return;
    }

    async function loadInventoryHistory() {
      setIsLoadingInventoryHistory(true);
      setInventoryHistoryError('');

      const standardQuery = supabase
        .from('inventory_transactions')
        .select(
          'id, created_at, transaction_type, vendor, specialty_vendor_name, item_name, size, unit, quantity, location, notes, catalog_source, mix_number, custom_mix_label, specialty_product_line, specialty_component_type'
        )
        .eq('item_name', inventoryItemParam)
        .eq('size', inventorySizeParam)
        .eq('vendor', inventoryVendorParam)
        .order('created_at', { ascending: false })
        .limit(100);

      const specialtyQuery = supabase
        .from('inventory_transactions')
        .select(
          'id, created_at, transaction_type, vendor, specialty_vendor_name, item_name, size, unit, quantity, location, notes, catalog_source, mix_number, custom_mix_label, specialty_product_line, specialty_component_type'
        )
        .eq('item_name', inventoryItemParam)
        .eq('size', inventorySizeParam)
        .eq('specialty_vendor_name', inventoryVendorParam)
        .order('created_at', { ascending: false })
        .limit(100);

      const [standardResult, specialtyResult] = await Promise.all([
        standardQuery,
        specialtyQuery,
      ]);

      if (standardResult.error || specialtyResult.error) {
        const firstError = standardResult.error || specialtyResult.error;
        console.error('Failed to load matching transaction history:', firstError);
        setInventoryHistoryError(
          firstError?.message || 'Failed to load matching transaction history.'
        );
        setInventoryHistoryRows([]);
        setDetectedInventoryMode(null);
        setIsLoadingInventoryHistory(false);
        return;
      }

      const combined = [
        ...((standardResult.data as InventoryHistoryRow[]) || []),
        ...((specialtyResult.data as InventoryHistoryRow[]) || []),
      ];

      const deduped = new Map<string, InventoryHistoryRow>();
      for (const entry of combined) {
        if (!deduped.has(entry.id)) {
          deduped.set(entry.id, entry);
        }
      }

      const sorted = Array.from(deduped.values()).sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });

      setInventoryHistoryRows(sorted);

      const modes = Array.from(
        new Set(
          sorted
            .map((entry) => entry.catalog_source)
            .filter(
              (mode): mode is TransactionSourceMode =>
                mode === 'standard' || mode === 'specialty'
            )
        )
      );

      if (modes.length === 1) {
        setDetectedInventoryMode(modes[0]);
        setSourceMode(modes[0]);
      } else if (modes.length > 1) {
        setDetectedInventoryMode('mixed');
      } else {
        setDetectedInventoryMode(null);
      }

      setIsLoadingInventoryHistory(false);
    }

    loadInventoryHistory();
  }, [
    hasInventoryContext,
    inventoryVendorParam,
    inventoryItemParam,
    inventorySizeParam,
  ]);

  useEffect(() => {
    if (!hasInventoryContext) return;

    setVendor(inventoryVendorParam);
    setSubmitMessage('');

    if (sourceMode === 'standard') {
      setStandardLines((prev) => {
        const first = prev[0] || makeStandardLine();
        return [
          {
            ...first,
            item_name: inventoryItemParam,
            size: inventorySizeParam,
            unit: '',
            quantity: '',
          },
          ...prev.slice(1),
        ];
      });
    } else {
      setSpecialtyItem(inventoryItemParam);
      setSpecialtySize(inventorySizeParam);
      setSpecialtyQuantity('');
    }
  }, [
    hasInventoryContext,
    inventoryVendorParam,
    inventoryItemParam,
    inventorySizeParam,
    sourceMode,
  ]);

  useEffect(() => {
    if (sourceMode !== 'specialty') return;

    if (!specialtyItem.trim()) {
      if (!specialtySize.trim()) {
        setSpecialtyUnit('');
      }
      return;
    }

    if (specialtyItemMatches.length === 1) {
      const only = specialtyItemMatches[0];

      if (!specialtySize && only.size) {
        setSpecialtySize(only.size || '');
      }

      const resolvedUnit = only.packaging || only.price_unit || '';
      if (resolvedUnit) {
        setSpecialtyUnit(resolvedUnit);
      }
      return;
    }

    if (exactSpecialtySizeMatch) {
      const resolvedUnit =
        exactSpecialtySizeMatch.packaging || exactSpecialtySizeMatch.price_unit || '';
      setSpecialtyUnit(resolvedUnit);
      return;
    }

    setSpecialtyUnit('');
  }, [
    sourceMode,
    specialtyItem,
    specialtySize,
    specialtyItemMatches,
    exactSpecialtySizeMatch,
  ]);

  function updateStandardLine(
    lineId: string,
    field: keyof Omit<StandardLineItem, 'id'>,
    value: string
  ) {
    setStandardLines((prev) =>
      prev.map((line) =>
        line.id === lineId ? { ...line, [field]: value } : line
      )
    );
    setSubmitMessage('');
  }

  function hydrateStandardLine(lineId: string, itemName: string, sizeValue: string) {
    const itemNorm = normalize(itemName);
    const sizeNorm = normalize(sizeValue);

    if (!vendor.trim() || !itemNorm || !sizeNorm) {
      return;
    }

    const match = standardVendorFilteredRows.find(
      (row) =>
        normalize(row.item_name) === itemNorm &&
        normalize(row.size) === sizeNorm
    );

    if (!match?.unit) return;

    setStandardLines((prev) =>
      prev.map((line) =>
        line.id === lineId ? { ...line, unit: match.unit } : line
      )
    );
  }

  function addStandardLine(copyFromId?: string) {
    if (editingTransactionId) return;

    if (copyFromId) {
      const source = standardLines.find((line) => line.id === copyFromId);
      if (source) {
        setStandardLines((prev) => [
          ...prev,
          {
            ...source,
            id: makeStandardLine().id,
            quantity: '',
          },
        ]);
        return;
      }
    }

    setStandardLines((prev) => [...prev, makeStandardLine()]);
  }

  function removeStandardLine(lineId: string) {
    if (editingTransactionId) return;

    setStandardLines((prev) => {
      if (prev.length === 1) {
        return [makeStandardLine()];
      }
      return prev.filter((line) => line.id !== lineId);
    });
    setSubmitMessage('');
  }

  function loadEntryIntoEdit(entry: InventoryHistoryRow) {
    const mode: TransactionSourceMode =
      entry.catalog_source === 'specialty' ? 'specialty' : 'standard';

    setEditingTransactionId(entry.id);
    setSourceMode(mode);
    setTxType(entry.transaction_type || 'intake');
    setVendor(
      mode === 'specialty'
        ? entry.specialty_vendor_name || entry.vendor || ''
        : entry.vendor || entry.specialty_vendor_name || ''
    );
    setLocation(entry.location || '');
    setNotes(entry.notes || '');
    setSubmitMessage('');

    if (mode === 'standard') {
      setStandardLines([
        {
          id: makeStandardLine().id,
          item_name: entry.item_name || '',
          size: entry.size || '',
          unit: entry.unit || '',
          quantity:
            entry.quantity === null || entry.quantity === undefined
              ? ''
              : String(entry.quantity),
        },
      ]);
      setSpecialtyItem('');
      setSpecialtySize('');
      setSpecialtyUnit('');
      setSpecialtyQuantity('');
      setMixNumber('');
      setCustomMixLabel('');
    } else {
      setSpecialtyItem(entry.item_name || '');
      setSpecialtySize(entry.size || '');
      setSpecialtyUnit(entry.unit || '');
      setSpecialtyQuantity(
        entry.quantity === null || entry.quantity === undefined
          ? ''
          : String(entry.quantity)
      );
      setMixNumber(entry.mix_number || '');
      setCustomMixLabel(entry.custom_mix_label || '');
      setStandardLines([makeStandardLine()]);
    }
  }

  function cancelEditMode() {
    setEditingTransactionId(null);
    setSubmitMessage('');
    resetFormForMode(sourceMode);
  }

  function resetForm() {
    setVendor(hasInventoryContext ? inventoryVendorParam : '');
    setLocation('');
    setNotes('');
    setSubmitMessage('');
    setEditingTransactionId(null);

    if (sourceMode === 'standard') {
      setStandardLines([
        {
          ...makeStandardLine(),
          item_name:
            hasInventoryContext &&
            (detectedInventoryMode === 'standard' ||
              detectedInventoryMode === 'mixed')
              ? inventoryItemParam
              : '',
          size:
            hasInventoryContext &&
            (detectedInventoryMode === 'standard' ||
              detectedInventoryMode === 'mixed')
              ? inventorySizeParam
              : '',
          unit: '',
          quantity: '',
        },
      ]);
    } else {
      setSpecialtyItem(
        hasInventoryContext &&
          (detectedInventoryMode === 'specialty' ||
            detectedInventoryMode === 'mixed')
          ? inventoryItemParam
          : ''
      );
      setSpecialtySize(
        hasInventoryContext &&
          (detectedInventoryMode === 'specialty' ||
            detectedInventoryMode === 'mixed')
          ? inventorySizeParam
          : ''
      );
      setSpecialtyUnit('');
      setSpecialtyQuantity('');
      setMixNumber('');
      setCustomMixLabel('');
    }
  }

  async function saveStandardEdit() {
    const line = standardLines[0];

    if (!vendor.trim() || !line?.item_name.trim() || !line?.quantity.trim()) {
      setSubmitMessage('Vendor, item, and quantity are required.');
      return;
    }

    const parsedQty = Number(line.quantity);
    if (Number.isNaN(parsedQty) || parsedQty <= 0) {
      setSubmitMessage('Quantity must be a positive number.');
      return;
    }

    const matchedRow = standardVendorFilteredRows.find(
      (row) =>
        normalize(row.item_name) === normalize(line.item_name) &&
        normalize(row.size) === normalize(line.size)
    );

    const payload = {
      transaction_type: txType,
      vendor: vendor.trim(),
      item_name: line.item_name.trim(),
      size: line.size.trim() || null,
      unit: line.unit.trim() || matchedRow?.unit || null,
      quantity: parsedQty,
      location: location.trim() || null,
      notes: notes.trim() || null,
      catalog_source: 'standard',
      catalog_row_id: matchedRow?.id || null,
      mix_number: null,
      custom_mix_label: null,
      specialty_vendor_name: null,
      specialty_product_line: null,
      specialty_component_type: null,
    };

    const { error } = await supabase
      .from('inventory_transactions')
      .update(payload)
      .eq('id', editingTransactionId);

    if (error) {
      console.error('Failed to update transaction:', error);
      setSubmitMessage(`Failed to save: ${error.message}`);
      return;
    }

    cancelEditMode();
    setSubmitMessage('Changes saved.');
  }

  async function saveSpecialtyEdit() {
    if (!vendor.trim() || !specialtyItem.trim() || !specialtyQuantity.trim()) {
      setSubmitMessage('Vendor, item, and quantity are required.');
      return;
    }

    if (!mixNumber.trim()) {
      setSubmitMessage('Mix number is required for specialty/custom transactions.');
      return;
    }

    const parsedQty = Number(specialtyQuantity);
    if (Number.isNaN(parsedQty) || parsedQty <= 0) {
      setSubmitMessage('Quantity must be a positive number.');
      return;
    }

    const effectiveItemName = customMixLabel.trim() || specialtyItem.trim();

    const payload = {
      transaction_type: txType,
      vendor: vendor.trim(),
      item_name: effectiveItemName,
      size: specialtySize.trim() || null,
      unit: specialtyUnit.trim() || null,
      quantity: parsedQty,
      location: location.trim() || null,
      notes: notes.trim() || null,
      catalog_source: 'specialty',
      catalog_row_id: selectedSpecialtyContext?.id || null,
      mix_number: mixNumber.trim(),
      custom_mix_label: customMixLabel.trim() || null,
      specialty_vendor_name: vendor.trim(),
      specialty_product_line: selectedSpecialtyContext?.product_line || null,
      specialty_component_type: selectedSpecialtyContext?.component_type || null,
    };

    const { error } = await supabase
      .from('inventory_transactions')
      .update(payload)
      .eq('id', editingTransactionId);

    if (error) {
      console.error('Failed to update specialty transaction:', error);
      setSubmitMessage(`Failed to save: ${error.message}`);
      return;
    }

    cancelEditMode();
    setSubmitMessage('Changes saved.');
  }

  async function submitStandardBulk() {
    if (!vendor.trim()) {
      setSubmitMessage('Vendor is required.');
      return;
    }

    const cleanedLines = standardLines
      .map((line) => ({
        ...line,
        item_name: line.item_name.trim(),
        size: line.size.trim(),
        unit: line.unit.trim(),
        quantity: line.quantity.trim(),
      }))
      .filter(
        (line) =>
          line.item_name || line.size || line.unit || line.quantity
      );

    if (cleanedLines.length === 0) {
      setSubmitMessage('Add at least one line item.');
      return;
    }

    for (const line of cleanedLines) {
      if (!line.item_name || !line.quantity) {
        setSubmitMessage(
          'Each populated line needs at least an item and quantity.'
        );
        return;
      }

      const parsedQty = Number(line.quantity);
      if (Number.isNaN(parsedQty) || parsedQty <= 0) {
        setSubmitMessage('Each line quantity must be a positive number.');
        return;
      }
    }

    const payload = cleanedLines.map((line) => {
      const parsedQty = Number(line.quantity);

      const matchedRow = standardVendorFilteredRows.find(
        (row) =>
          normalize(row.item_name) === normalize(line.item_name) &&
          normalize(row.size) === normalize(line.size)
      );

      return {
        transaction_type: txType,
        vendor: vendor.trim(),
        item_name: line.item_name,
        size: line.size || null,
        unit: line.unit || matchedRow?.unit || null,
        quantity: parsedQty,
        location: location.trim() || null,
        notes: notes.trim() || null,
        catalog_source: 'standard',
        catalog_row_id: matchedRow?.id || null,
        mix_number: null,
        custom_mix_label: null,
        specialty_vendor_name: null,
        specialty_product_line: null,
        specialty_component_type: null,
      };
    });

    const { error } = await supabase
      .from('inventory_transactions')
      .insert(payload);

    if (error) {
      console.error('Failed to submit bulk standard transaction:', error);
      setSubmitMessage(`Failed to submit: ${error.message}`);
      return;
    }

    resetForm();
    setSubmitMessage(
      payload.length === 1
        ? 'Transaction recorded.'
        : `${payload.length} transactions recorded.`
    );
  }

  async function submitSpecialtySingle() {
    if (!vendor.trim() || !specialtyItem.trim() || !specialtyQuantity.trim()) {
      setSubmitMessage('Vendor, item, and quantity are required.');
      return;
    }

    if (!mixNumber.trim()) {
      setSubmitMessage('Mix number is required for specialty/custom transactions.');
      return;
    }

    const parsedQty = Number(specialtyQuantity);
    if (Number.isNaN(parsedQty) || parsedQty <= 0) {
      setSubmitMessage('Quantity must be a positive number.');
      return;
    }

    const effectiveItemName = customMixLabel.trim() || specialtyItem.trim();

    const payload = {
      transaction_type: txType,
      vendor: vendor.trim(),
      item_name: effectiveItemName,
      size: specialtySize.trim() || null,
      unit: specialtyUnit.trim() || null,
      quantity: parsedQty,
      location: location.trim() || null,
      notes: notes.trim() || null,
      catalog_source: 'specialty',
      catalog_row_id: selectedSpecialtyContext?.id || null,
      mix_number: mixNumber.trim(),
      custom_mix_label: customMixLabel.trim() || null,
      specialty_vendor_name: vendor.trim(),
      specialty_product_line: selectedSpecialtyContext?.product_line || null,
      specialty_component_type: selectedSpecialtyContext?.component_type || null,
    };

    const { error } = await supabase
      .from('inventory_transactions')
      .insert(payload);

    if (error) {
      console.error('Failed to submit specialty transaction:', error);
      setSubmitMessage(`Failed to submit: ${error.message}`);
      return;
    }

    resetForm();
    setSubmitMessage('Transaction recorded.');
  }

  async function handleSubmitTransaction() {
    setSubmitMessage('');
    setIsSubmitting(true);

    try {
      if (editingTransactionId) {
        if (sourceMode === 'standard') {
          await saveStandardEdit();
        } else {
          await saveSpecialtyEdit();
        }
        return;
      }

      if (sourceMode === 'standard') {
        await submitStandardBulk();
      } else {
        await submitSpecialtySingle();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-73px)] bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#f7f0d0]">
            Transactions
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Log intake, outtake, or adjustments here.
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Loaded {standardCatalogRows.length} standard rows,{' '}
            {specialtyCatalogRows.length} specialty rows, and {vendors.length}{' '}
            vendors in the current mode.
          </p>
        </div>

        {loadError && (
          <div className="rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
            Failed to load transaction options: {loadError}
          </div>
        )}

        {hasInventoryContext && (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
            <div className="text-sm font-semibold text-[#f7f0d0]">
              Opened from Inventory
            </div>
            <p className="mt-2 text-sm text-neutral-300">
              This page was opened from Append View for {inventoryVendorParam || '—'} •{' '}
              {inventoryItemParam || '—'} • {inventorySizeParam || '—'}.
            </p>
          </div>
        )}

        {hasInventoryContext && detectedInventoryMode === 'standard' && (
          <div className="rounded-2xl border border-green-800/50 bg-green-950/20 p-4">
            <div className="text-sm font-semibold text-[#f7f0d0]">
              Mode Auto-Detected: Standard
            </div>
            <p className="mt-2 text-sm text-neutral-300">
              All matching transactions for this inventory row are standard entries,
              so the page switched to Standard Material automatically.
            </p>
          </div>
        )}

        {hasInventoryContext && detectedInventoryMode === 'specialty' && (
          <div className="rounded-2xl border border-blue-800/50 bg-blue-950/20 p-4">
            <div className="text-sm font-semibold text-[#f7f0d0]">
              Mode Auto-Detected: Specialty
            </div>
            <p className="mt-2 text-sm text-neutral-300">
              All matching transactions for this inventory row are specialty
              entries, so the page switched to Specialty / Custom Mix automatically.
            </p>
          </div>
        )}

        {hasInventoryContext && detectedInventoryMode === 'mixed' && (
          <div className="rounded-2xl border border-yellow-800/50 bg-yellow-950/20 p-4">
            <div className="text-sm font-semibold text-[#f7f0d0]">
              Mixed History Detected
            </div>
            <p className="mt-2 text-sm text-neutral-300">
              Matching transactions include both standard and specialty entries.
              Review the matching rows below and choose the exact one you want to
              edit, or switch modes and record a new transaction.
            </p>
          </div>
        )}

        {hasInventoryContext && (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
            <div className="mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-300">
                Matching Transactions
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                Click <span className="font-semibold text-neutral-300">Edit Entry</span>{' '}
                to load the exact historical row into the form below.
              </p>
            </div>

            {isLoadingInventoryHistory ? (
              <div className="text-sm text-neutral-400">
                Loading matching transaction history...
              </div>
            ) : inventoryHistoryError ? (
              <div className="rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
                {inventoryHistoryError}
              </div>
            ) : inventoryHistoryRows.length === 0 ? (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-400">
                No matching transactions were found for this append row.
              </div>
            ) : (
              <div className="space-y-3">
                {inventoryHistoryRows.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-neutral-800 bg-black/40 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-300">
                            {entry.transaction_type || 'Transaction'}
                          </span>

                          {entry.catalog_source && (
                            <span className="rounded-full border border-[#c8a43a]/50 bg-[#c8a43a]/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[#f0d98a]">
                              {entry.catalog_source}
                            </span>
                          )}

                          {editingTransactionId === entry.id && (
                            <span className="rounded-full border border-green-700/60 bg-green-950/40 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-green-300">
                              Editing
                            </span>
                          )}
                        </div>

                        <div className="mt-3 grid gap-2 text-sm text-neutral-300 sm:grid-cols-2">
                          <div>
                            <span className="text-neutral-500">Vendor:</span>{' '}
                            {getHistoryDisplayVendor(entry)}
                          </div>
                          <div>
                            <span className="text-neutral-500">Item:</span>{' '}
                            {entry.item_name || '—'}
                          </div>
                          <div>
                            <span className="text-neutral-500">Size:</span>{' '}
                            {entry.size || '—'}
                          </div>
                          <div>
                            <span className="text-neutral-500">Unit:</span>{' '}
                            {entry.unit || '—'}
                          </div>
                          <div>
                            <span className="text-neutral-500">Quantity:</span>{' '}
                            {entry.quantity ?? '—'}
                          </div>
                          <div>
                            <span className="text-neutral-500">Created:</span>{' '}
                            {formatDateTime(entry.created_at)}
                          </div>
                          <div>
                            <span className="text-neutral-500">Location:</span>{' '}
                            {entry.location || '—'}
                          </div>
                          <div>
                            <span className="text-neutral-500">Mix #:</span>{' '}
                            {entry.mix_number || '—'}
                          </div>
                          <div>
                            <span className="text-neutral-500">Custom Mix Label:</span>{' '}
                            {entry.custom_mix_label || '—'}
                          </div>
                          <div>
                            <span className="text-neutral-500">Product Line:</span>{' '}
                            {entry.specialty_product_line || '—'}
                          </div>
                          <div>
                            <span className="text-neutral-500">Component Type:</span>{' '}
                            {entry.specialty_component_type || '—'}
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
                            Notes
                          </div>
                          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-sm text-neutral-300">
                            {entry.notes?.trim() || '—'}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <button
                          type="button"
                          onClick={() => loadEntryIntoEdit(entry)}
                          className="rounded-xl border border-[#c8a43a]/50 bg-[#c8a43a]/10 px-3 py-2 text-sm font-medium text-[#f0d98a] transition hover:bg-[#c8a43a]/20"
                        >
                          Edit Entry
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-full border border-neutral-800 bg-black p-1">
              <button
                type="button"
                onClick={() => {
                  setSourceMode('standard');
                  setSubmitMessage('');
                  setEditingTransactionId(null);
                }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  sourceMode === 'standard'
                    ? 'bg-[#c8a43a] text-black'
                    : 'text-neutral-300 hover:bg-neutral-900'
                }`}
              >
                Standard Material
              </button>

              <button
                type="button"
                onClick={() => {
                  setSourceMode('specialty');
                  setSubmitMessage('');
                  setEditingTransactionId(null);
                }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  sourceMode === 'specialty'
                    ? 'bg-[#c8a43a] text-black'
                    : 'text-neutral-300 hover:bg-neutral-900'
                }`}
              >
                Specialty / Custom Mix
              </button>
            </div>

            <div className="text-xs text-neutral-500">
              {editingTransactionId
                ? 'Edit mode is active.'
                : sourceMode === 'standard'
                ? 'Standard mode supports bulk entry by default.'
                : 'Specialty mode remains single-entry for now.'}
            </div>
          </div>

          {editingTransactionId && (
            <div className="mb-6 rounded-2xl border border-[#c8a43a]/40 bg-[#c8a43a]/10 p-4">
              <div className="text-sm font-semibold text-[#f7f0d0]">
                Editing Existing Transaction
              </div>
              <p className="mt-2 text-sm text-neutral-300">
                The form below is editing a real historical row. Saving will update
                that exact transaction in the database.
              </p>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={cancelEditMode}
                  className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-medium text-white transition hover:border-neutral-600 hover:bg-neutral-900"
                >
                  Cancel Edit
                </button>
              </div>
            </div>
          )}

          {sourceMode === 'specialty' && (
            <div className="mb-6 rounded-2xl border border-blue-800/50 bg-blue-950/20 p-4">
              <div className="text-sm font-semibold text-[#f7f0d0]">
                Specialty / Custom Mix Guidance
              </div>
              <p className="mt-2 text-sm text-neutral-300">
                Use this mode for specialty vendors and custom-to-Tenarten
                materials. A mix number is required so these items can be identified
                consistently later.
              </p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-300">
                Transaction Type
              </label>
              <select
                value={txType}
                onChange={(e) => {
                  setTxType(e.target.value);
                  setSubmitMessage('');
                }}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
              >
                <option value="intake">Intake</option>
                <option value="outtake">Outtake</option>
                <option value="adjustment">Adjustment</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-300">
                Vendor
              </label>
              <select
                value={vendor}
                onChange={(e) => {
                  setVendor(e.target.value);
                  setSubmitMessage('');
                  if (!editingTransactionId) {
                    if (sourceMode === 'standard') {
                      setStandardLines((prev) =>
                        prev.map((line) => ({ ...line, unit: '' }))
                      );
                    } else {
                      setSpecialtyUnit('');
                    }
                  }
                }}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                disabled={isLoadingCatalog}
              >
                <option value="">Select vendor</option>
                {vendors.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-neutral-300">
                Location
              </label>
              <input
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setSubmitMessage('');
                }}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                placeholder="Warehouse A"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-neutral-300">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setSubmitMessage('');
                }}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                rows={4}
                placeholder="Optional context for this order / movement"
              />
            </div>
          </div>

          {sourceMode === 'standard' ? (
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-300">
                    Line Items
                  </h2>
                  <p className="mt-1 text-xs text-neutral-500">
                    {editingTransactionId
                      ? 'Edit mode updates one selected row at a time.'
                      : 'Bulk by default. Add one or many rows for the same vendor/order.'}
                  </p>
                </div>

                {!editingTransactionId && (
                  <button
                    type="button"
                    onClick={() => addStandardLine()}
                    className="rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:border-[#c8a43a] hover:text-[#f7f0d0]"
                  >
                    Add Line
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {standardLines.map((line, index) => {
                  const itemSuggestions = vendor.trim()
                    ? uniqueSorted(
                        standardVendorFilteredRows.map((row) => row.item_name)
                      ).slice(0, 200)
                    : [];

                  const sizeSuggestions = (() => {
                    const itemNorm = normalize(line.item_name);

                    if (!vendor.trim() || !itemNorm) {
                      return [];
                    }

                    const matchingRows = standardVendorFilteredRows.filter(
                      (row) => normalize(row.item_name) === itemNorm
                    );

                    return uniqueSorted([
                      ...matchingRows.map((row) => row.size),
                      ...PRESET_SIZE_OPTIONS,
                    ]).slice(0, 200);
                  })();

                  return (
                    <div
                      key={line.id}
                      className="rounded-2xl border border-neutral-800 bg-black/30 p-4"
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-[#f7f0d0]">
                          {editingTransactionId ? 'Editing Line' : `Line ${index + 1}`}
                        </div>

                        {!editingTransactionId && (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => addStandardLine(line.id)}
                              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:border-[#c8a43a] hover:text-white"
                            >
                              Duplicate
                            </button>

                            <button
                              type="button"
                              onClick={() => removeStandardLine(line.id)}
                              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:border-red-700 hover:text-red-300"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-neutral-300">
                            Item
                          </label>
                          <input
                            value={line.item_name}
                            onChange={(e) => {
                              updateStandardLine(line.id, 'item_name', e.target.value);
                              updateStandardLine(line.id, 'unit', '');
                            }}
                            list={`standard-item-suggestions-${line.id}`}
                            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                            placeholder={
                              vendor.trim()
                                ? 'Start typing item name'
                                : 'Select vendor first'
                            }
                            disabled={!vendor.trim()}
                          />
                          <datalist id={`standard-item-suggestions-${line.id}`}>
                            {itemSuggestions.map((suggestion) => (
                              <option key={suggestion} value={suggestion} />
                            ))}
                          </datalist>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-neutral-300">
                            Size
                          </label>
                          <input
                            value={line.size}
                            onChange={(e) => {
                              const next = e.target.value;
                              updateStandardLine(line.id, 'size', next);
                              hydrateStandardLine(line.id, line.item_name, next);
                            }}
                            list={`standard-size-suggestions-${line.id}`}
                            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                            placeholder={
                              line.item_name.trim()
                                ? 'Select or enter size'
                                : 'Select item first'
                            }
                            disabled={!vendor.trim() || !line.item_name.trim()}
                          />
                          <datalist id={`standard-size-suggestions-${line.id}`}>
                            {sizeSuggestions.map((suggestion) => (
                              <option key={suggestion} value={suggestion} />
                            ))}
                          </datalist>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-neutral-300">
                            Quantity
                          </label>
                          <input
                            value={line.quantity}
                            onChange={(e) =>
                              updateStandardLine(line.id, 'quantity', e.target.value)
                            }
                            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                            placeholder="e.g. 20"
                            inputMode="decimal"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-neutral-300">
                            Unit
                          </label>
                          <input
                            value={line.unit}
                            onChange={(e) =>
                              updateStandardLine(line.id, 'unit', e.target.value)
                            }
                            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                            placeholder="lb / bag / pallet"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-300">
                  Item
                </label>
                <input
                  value={specialtyItem}
                  onChange={(e) => {
                    setSpecialtyItem(e.target.value);
                    setSubmitMessage('');
                  }}
                  list="specialty-item-suggestions"
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                  placeholder={
                    vendor.trim() ? 'Start typing item name' : 'Select vendor first'
                  }
                  disabled={!vendor.trim()}
                />
                <datalist id="specialty-item-suggestions">
                  {specialtyItemSuggestions.map((suggestion) => (
                    <option key={suggestion} value={suggestion} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-300">
                  Size
                </label>
                <input
                  value={specialtySize}
                  onChange={(e) => {
                    setSpecialtySize(e.target.value);
                    setSubmitMessage('');
                  }}
                  list="specialty-size-suggestions"
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                  placeholder={
                    specialtyItem.trim() ? 'Select or enter size' : 'Select item first'
                  }
                  disabled={!vendor.trim() || !specialtyItem.trim()}
                />
                <datalist id="specialty-size-suggestions">
                  {specialtySizeSuggestions.map((suggestion) => (
                    <option key={suggestion} value={suggestion} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-300">
                  Quantity
                </label>
                <input
                  value={specialtyQuantity}
                  onChange={(e) => {
                    setSpecialtyQuantity(e.target.value);
                    setSubmitMessage('');
                  }}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                  placeholder="e.g. 20"
                  inputMode="decimal"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-300">
                  Unit
                </label>
                <input
                  value={specialtyUnit}
                  onChange={(e) => {
                    setSpecialtyUnit(e.target.value);
                    setSubmitMessage('');
                  }}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                  placeholder="pail / system / bag / custom unit"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-300">
                  Mix Number
                </label>
                <input
                  value={mixNumber}
                  onChange={(e) => {
                    setMixNumber(e.target.value);
                    setSubmitMessage('');
                  }}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                  placeholder="e.g. MIX-117"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-300">
                  Custom Mix Label
                </label>
                <input
                  value={customMixLabel}
                  onChange={(e) => {
                    setCustomMixLabel(e.target.value);
                    setSubmitMessage('');
                  }}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                  placeholder="Optional internal label"
                />
              </div>

              {selectedSpecialtyContext && (
                <div className="md:col-span-2 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
                  <div className="text-sm font-semibold text-white">
                    Selected Specialty Context
                  </div>

                  <div className="mt-2 text-sm font-medium text-[#f7f0d0]">
                    {selectedSpecialtyContext.vendor_name} •{' '}
                    {selectedSpecialtyContext.item_name}
                  </div>

                  <div className="mt-1 text-xs text-neutral-400">
                    {[
                      selectedSpecialtyContext.product_line,
                      selectedSpecialtyContext.component_type,
                      selectedSpecialtyContext.material_type,
                    ]
                      .filter(Boolean)
                      .join(' • ') || '—'}
                  </div>

                  {resolvedMixIdentity && (
                    <div className="mt-3 text-sm font-medium text-[#c8a43a]">
                      {resolvedMixIdentity}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={handleSubmitTransaction}
              disabled={isSubmitting || isLoadingCatalog}
              className="rounded-xl bg-[#c8a43a] px-4 py-2.5 font-medium text-black transition hover:bg-[#d6b24a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? editingTransactionId
                  ? 'Saving...'
                  : 'Recording...'
                : editingTransactionId
                ? 'Save Changes'
                : sourceMode === 'standard'
                ? `Record ${Math.max(
                    1,
                    standardLines.filter(
                      (line) =>
                        line.item_name.trim() ||
                        line.size.trim() ||
                        line.unit.trim() ||
                        line.quantity.trim()
                    ).length
                  )} Transaction${
                    Math.max(
                      1,
                      standardLines.filter(
                        (line) =>
                          line.item_name.trim() ||
                          line.size.trim() ||
                          line.unit.trim() ||
                          line.quantity.trim()
                      ).length
                    ) === 1
                      ? ''
                      : 's'
                  }`
                : 'Record Transaction'}
            </button>

            <button
              onClick={resetForm}
              className="rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-2.5 font-medium text-white transition hover:border-neutral-600 hover:bg-neutral-900"
            >
              Reset
            </button>

            {editingTransactionId && (
              <button
                type="button"
                onClick={cancelEditMode}
                className="rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-2.5 font-medium text-white transition hover:border-neutral-600 hover:bg-neutral-900"
              >
                Exit Edit Mode
              </button>
            )}
          </div>

          {submitMessage && (
            <div className="mt-3 text-sm text-neutral-300">{submitMessage}</div>
          )}
        </div>
      </div>
    </div>
  );
}