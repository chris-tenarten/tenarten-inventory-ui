'use client';

import { useEffect, useMemo, useState } from 'react';
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

const PAGE_SIZE = 1000;

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

export default function TransactionsPage() {
  const [standardCatalogRows, setStandardCatalogRows] = useState<StandardCatalogRow[]>([]);
  const [specialtyCatalogRows, setSpecialtyCatalogRows] = useState<SpecialtyCatalogRow[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [sourceMode, setSourceMode] = useState<TransactionSourceMode>('standard');
  const [txType, setTxType] = useState('intake');

  const [vendor, setVendor] = useState('');
  const [item, setItem] = useState('');
  const [size, setSize] = useState('');
  const [unit, setUnit] = useState('');
  const [quantity, setQuantity] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const [mixNumber, setMixNumber] = useState('');
  const [customMixLabel, setCustomMixLabel] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

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

  function handleReset(keepSourceMode = true) {
    const preservedSourceMode = sourceMode;
    setTxType('intake');
    setVendor('');
    setItem('');
    setSize('');
    setUnit('');
    setQuantity('');
    setLocation('');
    setNotes('');
    setMixNumber('');
    setCustomMixLabel('');
    if (!keepSourceMode) {
      setSourceMode('standard');
    } else {
      setSourceMode(preservedSourceMode);
    }
  }

  useEffect(() => {
    handleReset(true);
    setSubmitMessage('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceMode]);

  const standardVendors = useMemo(() => {
    return uniqueSorted(standardCatalogRows.map((r) => r.vendor));
  }, [standardCatalogRows]);

  const specialtyVendors = useMemo(() => {
    return uniqueSorted(specialtyCatalogRows.map((r) => r.vendor_name));
  }, [specialtyCatalogRows]);

  const vendors = sourceMode === 'standard' ? standardVendors : specialtyVendors;

  const standardVendorFilteredRows = useMemo(() => {
    if (!vendor.trim()) return standardCatalogRows;
    const v = normalize(vendor);
    return standardCatalogRows.filter((r) => normalize(r.vendor) === v);
  }, [standardCatalogRows, vendor]);

  const specialtyVendorFilteredRows = useMemo(() => {
    if (!vendor.trim()) return specialtyCatalogRows;
    const v = normalize(vendor);
    return specialtyCatalogRows.filter((r) => normalize(r.vendor_name) === v);
  }, [specialtyCatalogRows, vendor]);

  const itemSuggestions = useMemo(() => {
    if (sourceMode === 'standard') {
      const q = normalize(item);
      const items = uniqueSorted(standardVendorFilteredRows.map((r) => r.item_name));

      if (!q) return items.slice(0, 100);

      return items.filter((name) => normalize(name).includes(q)).slice(0, 100);
    }

    const q = normalize(item);
    const items = uniqueSorted(specialtyVendorFilteredRows.map((r) => r.item_name));

    if (!q) return items.slice(0, 100);

    return items.filter((name) => normalize(name).includes(q)).slice(0, 100);
  }, [sourceMode, standardVendorFilteredRows, specialtyVendorFilteredRows, item]);

  const sizeSuggestions = useMemo(() => {
    if (sourceMode === 'standard') {
      const itemNorm = normalize(item);

      const baseRows = standardVendorFilteredRows.filter((r) => {
        if (!itemNorm) return true;
        return normalize(r.item_name) === itemNorm;
      });

      const sizes = uniqueSorted(baseRows.map((r) => r.size));
      const q = normalize(size);

      if (!q) return sizes.slice(0, 100);

      return sizes.filter((value) => normalize(value).includes(q)).slice(0, 100);
    }

    const itemNorm = normalize(item);

    const baseRows = specialtyVendorFilteredRows.filter((r) => {
      if (!itemNorm) return true;
      return normalize(r.item_name) === itemNorm;
    });

    const sizes = uniqueSorted(baseRows.map((r) => r.size || ''));
    const q = normalize(size);

    if (!q) return sizes.slice(0, 100);

    return sizes.filter((value) => normalize(value).includes(q)).slice(0, 100);
  }, [sourceMode, standardVendorFilteredRows, specialtyVendorFilteredRows, item, size]);

  const exactVendorMatch = useMemo(() => {
    if (!vendor.trim()) return '';
    const v = normalize(vendor);
    return vendors.find((name) => normalize(name) === v) || '';
  }, [vendors, vendor]);

  const exactStandardItemMatches = useMemo(() => {
    const itemNorm = normalize(item);
    if (!itemNorm) return [];

    return standardVendorFilteredRows.filter((r) => normalize(r.item_name) === itemNorm);
  }, [standardVendorFilteredRows, item]);

  const exactSpecialtyItemMatches = useMemo(() => {
    const itemNorm = normalize(item);
    if (!itemNorm) return [];

    return specialtyVendorFilteredRows.filter((r) => normalize(r.item_name) === itemNorm);
  }, [specialtyVendorFilteredRows, item]);

  const exactStandardSizeMatch = useMemo(() => {
    const sizeNorm = normalize(size);
    if (!sizeNorm) return null;

    return exactStandardItemMatches.find((r) => normalize(r.size) === sizeNorm) || null;
  }, [exactStandardItemMatches, size]);

  const exactSpecialtySizeMatch = useMemo(() => {
    const sizeNorm = normalize(size);
    if (!sizeNorm) return null;

    return (
      exactSpecialtyItemMatches.find((r) => normalize(r.size || '') === sizeNorm) || null
    );
  }, [exactSpecialtyItemMatches, size]);

  const selectedSpecialtyContext = useMemo(() => {
    return exactSpecialtySizeMatch || (exactSpecialtyItemMatches.length === 1 ? exactSpecialtyItemMatches[0] : null);
  }, [exactSpecialtySizeMatch, exactSpecialtyItemMatches]);

  const resolvedSpecialtyIdentity = useMemo(() => {
    if (!selectedSpecialtyContext) return null;

    return {
      header: `${selectedSpecialtyContext.vendor_name} • ${selectedSpecialtyContext.item_name}`,
      subheader: [
        selectedSpecialtyContext.product_line,
        selectedSpecialtyContext.component_type,
        selectedSpecialtyContext.material_type,
      ]
        .filter(Boolean)
        .join(' • '),
      quoteLabel: selectedSpecialtyContext.quote_required ? 'Quote Required' : '',
    };
  }, [selectedSpecialtyContext]);

  const resolvedMixIdentity = useMemo(() => {
    if (!mixNumber.trim()) return '';
    if (customMixLabel.trim()) {
      return `Mix ${mixNumber.trim()} — ${customMixLabel.trim()}`;
    }
    return `Mix ${mixNumber.trim()}`;
  }, [mixNumber, customMixLabel]);

  useEffect(() => {
    if (!vendor.trim()) return;
    if (exactVendorMatch && exactVendorMatch !== vendor) {
      setVendor(exactVendorMatch);
    }
  }, [exactVendorMatch, vendor]);

  useEffect(() => {
    if (sourceMode === 'standard') {
      if (!item.trim()) {
        if (!size.trim()) {
          setUnit('');
        }
        return;
      }

      if (exactStandardItemMatches.length === 1) {
        const only = exactStandardItemMatches[0];

        if (!size && only.size) {
          setSize(only.size);
        }

        if (only.unit) {
          setUnit(only.unit);
        }
        return;
      }

      if (exactStandardSizeMatch?.unit) {
        setUnit(exactStandardSizeMatch.unit);
        return;
      }

      setUnit('');
      return;
    }

    if (!item.trim()) {
      if (!size.trim()) {
        setUnit('');
      }
      return;
    }

    if (exactSpecialtyItemMatches.length === 1) {
      const only = exactSpecialtyItemMatches[0];

      if (!size && only.size) {
        setSize(only.size || '');
      }

      const resolvedUnit = only.packaging || only.price_unit || '';
      if (resolvedUnit) {
        setUnit(resolvedUnit);
      }
      return;
    }

    if (exactSpecialtySizeMatch) {
      const resolvedUnit =
        exactSpecialtySizeMatch.packaging || exactSpecialtySizeMatch.price_unit || '';
      setUnit(resolvedUnit);
      return;
    }

    setUnit('');
  }, [
    sourceMode,
    item,
    size,
    exactStandardItemMatches,
    exactStandardSizeMatch,
    exactSpecialtyItemMatches,
    exactSpecialtySizeMatch,
  ]);

  async function handleSubmitTransaction() {
    setSubmitMessage('');

    if (!vendor.trim() || !item.trim() || !quantity.trim()) {
      setSubmitMessage('Vendor, item, and quantity are required.');
      return;
    }

    if (sourceMode === 'specialty' && !mixNumber.trim()) {
      setSubmitMessage('Mix number is required for specialty/custom transactions.');
      return;
    }

    const parsedQty = Number(quantity);
    if (Number.isNaN(parsedQty) || parsedQty <= 0) {
      setSubmitMessage('Quantity must be a positive number.');
      return;
    }

    setIsSubmitting(true);

    if (sourceMode === 'standard') {
      const matchedRow =
        exactStandardSizeMatch ||
        (exactStandardItemMatches.length === 1 ? exactStandardItemMatches[0] : null);

      const { error } = await supabase.from('inventory_transactions').insert({
        transaction_type: txType,
        vendor: vendor.trim(),
        item_name: item.trim(),
        size: size.trim() || null,
        unit: unit.trim() || null,
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
      });

      if (error) {
        console.error('Failed to submit transaction:', error);
        setSubmitMessage(`Failed to submit: ${error.message}`);
        setIsSubmitting(false);
        return;
      }

      handleReset(true);
      setSubmitMessage('Transaction submitted.');
      setIsSubmitting(false);
      return;
    }

    const matchedSpecialtyRow = selectedSpecialtyContext;
    const effectiveItemName = customMixLabel.trim() || item.trim();

    const { error } = await supabase.from('inventory_transactions').insert({
      transaction_type: txType,
      vendor: vendor.trim(),
      item_name: effectiveItemName,
      size: size.trim() || null,
      unit: unit.trim() || null,
      quantity: parsedQty,
      location: location.trim() || null,
      notes: notes.trim() || null,
      catalog_source: 'specialty',
      catalog_row_id: matchedSpecialtyRow?.id || null,
      mix_number: mixNumber.trim(),
      custom_mix_label: customMixLabel.trim() || null,
      specialty_vendor_name: vendor.trim(),
      specialty_product_line: matchedSpecialtyRow?.product_line || null,
      specialty_component_type: matchedSpecialtyRow?.component_type || null,
    });

    if (error) {
      console.error('Failed to submit specialty transaction:', error);
      setSubmitMessage(`Failed to submit: ${error.message}`);
      setIsSubmitting(false);
      return;
    }

    handleReset(true);
    setSubmitMessage('Specialty transaction submitted.');
    setIsSubmitting(false);
  }

  return (
    <div className="min-h-[calc(100vh-73px)] bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#f7f0d0]">
            Transactions
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Log intake, outtake, or adjustments here.
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Loaded {standardCatalogRows.length} standard rows, {specialtyCatalogRows.length} specialty rows, and {vendors.length} vendors in the current mode.
          </p>
        </div>

        {loadError && (
          <div className="rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
            Failed to load transaction options: {loadError}
          </div>
        )}

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-full border border-neutral-800 bg-black p-1">
              <button
                type="button"
                onClick={() => setSourceMode('standard')}
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
                onClick={() => setSourceMode('specialty')}
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
              {sourceMode === 'standard'
                ? 'Use the operational catalog for normal inventory intake, outtake, and adjustments.'
                : 'Use specialty mode for system vendors, quote-required materials, and custom mixes tied to a mix number.'}
            </div>
          </div>

          {sourceMode === 'specialty' && (
            <div className="mb-6 rounded-2xl border border-blue-800/50 bg-blue-950/20 p-4">
              <div className="text-sm font-semibold text-[#f7f0d0]">
                Specialty / Custom Mix Guidance
              </div>
              <p className="mt-2 text-sm text-neutral-300">
                Use this mode for specialty vendors and custom-to-Tenarten materials.
                A mix number is required so these items can be identified consistently
                later, even when the received material is vendor-specific or custom-labeled.
              </p>
            </div>
          )}

          {sourceMode === 'specialty' && selectedSpecialtyContext && (
            <div className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
              <div className="mb-3 text-sm font-semibold text-white">
                Selected Specialty Context
              </div>

              {resolvedSpecialtyIdentity && (
                <div className="rounded-xl border border-neutral-800 bg-black/30 p-4">
                  <div className="text-sm font-semibold text-[#f7f0d0]">
                    Resolved Material Identity
                  </div>

                  <div className="mt-2 text-sm font-medium text-white">
                    {resolvedSpecialtyIdentity.header}
                  </div>

                  {resolvedSpecialtyIdentity.subheader && (
                    <div className="mt-1 text-xs text-neutral-400">
                      {resolvedSpecialtyIdentity.subheader}
                    </div>
                  )}

                  {resolvedSpecialtyIdentity.quoteLabel && (
                    <div className="mt-2 inline-flex rounded-full border border-blue-700/60 bg-blue-950/40 px-2 py-1 text-[11px] font-medium text-blue-300">
                      {resolvedSpecialtyIdentity.quoteLabel}
                    </div>
                  )}

                  {resolvedMixIdentity && (
                    <div className="mt-3 text-sm font-medium text-[#c8a43a]">
                      {resolvedMixIdentity}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm">
                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                    Product Line
                  </div>
                  <div>{selectedSpecialtyContext.product_line || '—'}</div>
                </div>

                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                    Component Type
                  </div>
                  <div>{selectedSpecialtyContext.component_type || '—'}</div>
                </div>

                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                    Material Type
                  </div>
                  <div>{selectedSpecialtyContext.material_type || '—'}</div>
                </div>

                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                    Quote Status
                  </div>
                  <div>
                    {selectedSpecialtyContext.quote_required
                      ? 'Quote Required'
                      : 'Standard pricing available'}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-300">
                Transaction Type
              </label>
              <select
                value={txType}
                onChange={(e) => setTxType(e.target.value)}
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
                  setItem('');
                  setSize('');
                  setUnit('');
                  setMixNumber('');
                  setCustomMixLabel('');
                  setSubmitMessage('');
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

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-300">
                Item Name
              </label>
              <input
                value={item}
                onChange={(e) => {
                  setItem(e.target.value);
                  setSize('');
                  setUnit('');
                  setSubmitMessage('');
                }}
                list="item-options"
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                placeholder={
                  vendor
                    ? 'Start typing item name for selected vendor'
                    : 'Select a vendor, then start typing item name'
                }
                disabled={isLoadingCatalog || !vendor}
              />
              <datalist id="item-options">
                {itemSuggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-300">
                Size
              </label>
              <input
                value={size}
                onChange={(e) => {
                  setSize(e.target.value);
                  setSubmitMessage('');
                }}
                list="size-options"
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                placeholder="Start typing size"
                disabled={isLoadingCatalog || !vendor || !item}
              />
              <datalist id="size-options">
                {sizeSuggestions.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-300">
                Quantity
              </label>
              <input
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
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
                value={unit}
                onChange={(e) => {
                  setUnit(e.target.value);
                  setSubmitMessage('');
                }}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                placeholder={
                  sourceMode === 'standard'
                    ? 'lb / bag / pallet'
                    : 'pail / system / bag / custom unit'
                }
              />
            </div>

            {sourceMode === 'specialty' && (
              <>
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
              </>
            )}

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
                placeholder={
                  sourceMode === 'standard'
                    ? 'Optional context, lot note, pallet note, or appearance note'
                    : 'Optional vendor, batch, or mix-specific context'
                }
              />
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSubmitTransaction}
              disabled={isSubmitting || isLoadingCatalog}
              className="rounded-xl bg-[#c8a43a] px-4 py-2.5 font-medium text-black transition hover:bg-[#d6b24a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Transaction'}
            </button>

            <button
              onClick={() => {
                handleReset(true);
                setSubmitMessage('');
              }}
              className="rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-2.5 font-medium text-white transition hover:border-neutral-600 hover:bg-neutral-900"
            >
              Reset
            </button>
          </div>

          {submitMessage && (
            <div className="mt-3 text-sm text-neutral-300">{submitMessage}</div>
          )}
        </div>
      </div>
    </div>
  );
}