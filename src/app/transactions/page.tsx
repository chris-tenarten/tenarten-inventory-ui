'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type CatalogRow = {
  id: string;
  vendor: string;
  item_name: string;
  size: string;
  unit: string;
};

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
  const [catalogRows, setCatalogRows] = useState<CatalogRow[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [txType, setTxType] = useState('intake');
  const [vendor, setVendor] = useState('');
  const [item, setItem] = useState('');
  const [size, setSize] = useState('');
  const [unit, setUnit] = useState('');
  const [quantity, setQuantity] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  useEffect(() => {
    async function loadCatalog() {
      setIsLoadingCatalog(true);
      setLoadError('');

      const allRows: CatalogRow[] = [];
      let from = 0;
      let keepGoing = true;

      while (keepGoing) {
        const to = from + PAGE_SIZE - 1;

        const { data, error } = await supabase
          .from('vendor_catalog')
          .select('id, vendor, item_name, size, unit')
          .order('vendor', { ascending: true })
          .order('item_name', { ascending: true })
          .order('size', { ascending: true })
          .range(from, to);

        if (error) {
          console.error('Failed to load transaction options:', error);
          setLoadError(error.message);
          setIsLoadingCatalog(false);
          return;
        }

        const cleaned: CatalogRow[] = (data || []).map((row) => ({
          id: row.id,
          vendor: row.vendor || '',
          item_name: row.item_name || '',
          size: row.size || '',
          unit: row.unit || '',
        }));

        allRows.push(...cleaned);

        if (!data || data.length < PAGE_SIZE) {
          keepGoing = false;
        } else {
          from += PAGE_SIZE;
        }
      }

      setCatalogRows(allRows);
      setIsLoadingCatalog(false);
    }

    loadCatalog();
  }, []);

  const vendors = useMemo(() => {
    return uniqueSorted(catalogRows.map((r) => r.vendor));
  }, [catalogRows]);

  const vendorFilteredRows = useMemo(() => {
    if (!vendor.trim()) return catalogRows;
    const v = normalize(vendor);
    return catalogRows.filter((r) => normalize(r.vendor) === v);
  }, [catalogRows, vendor]);

  const itemSuggestions = useMemo(() => {
    const q = normalize(item);
    const items = uniqueSorted(vendorFilteredRows.map((r) => r.item_name));

    if (!q) return items.slice(0, 100);

    return items.filter((name) => normalize(name).includes(q)).slice(0, 100);
  }, [vendorFilteredRows, item]);

  const sizeSuggestions = useMemo(() => {
    const itemNorm = normalize(item);

    const baseRows = vendorFilteredRows.filter((r) => {
      if (!itemNorm) return true;
      return normalize(r.item_name) === itemNorm;
    });

    const sizes = uniqueSorted(baseRows.map((r) => r.size));
    const q = normalize(size);

    if (!q) return sizes.slice(0, 100);

    return sizes.filter((value) => normalize(value).includes(q)).slice(0, 100);
  }, [vendorFilteredRows, item, size]);

  const exactVendorMatch = useMemo(() => {
    if (!vendor.trim()) return '';
    const v = normalize(vendor);
    return vendors.find((name) => normalize(name) === v) || '';
  }, [vendors, vendor]);

  const exactItemMatches = useMemo(() => {
    const itemNorm = normalize(item);
    if (!itemNorm) return [];

    return vendorFilteredRows.filter((r) => normalize(r.item_name) === itemNorm);
  }, [vendorFilteredRows, item]);

  const exactSizeMatch = useMemo(() => {
    const sizeNorm = normalize(size);
    if (!sizeNorm) return null;

    return exactItemMatches.find((r) => normalize(r.size) === sizeNorm) || null;
  }, [exactItemMatches, size]);

  useEffect(() => {
    if (!vendor.trim()) return;
    if (exactVendorMatch && exactVendorMatch !== vendor) {
      setVendor(exactVendorMatch);
    }
  }, [exactVendorMatch, vendor]);

  useEffect(() => {
    if (!item.trim()) {
      if (!size.trim()) {
        setUnit('');
      }
      return;
    }

    if (exactItemMatches.length === 1) {
      const only = exactItemMatches[0];

      if (!vendor && only.vendor) {
        setVendor(only.vendor);
      }

      if (!size && only.size) {
        setSize(only.size);
      }

      if (only.unit) {
        setUnit(only.unit);
      }
      return;
    }

    if (exactSizeMatch?.unit) {
      setUnit(exactSizeMatch.unit);
      return;
    }

    setUnit('');
  }, [exactItemMatches, exactSizeMatch, item, size, vendor]);

  async function handleSubmitTransaction() {
    setSubmitMessage('');

    if (!vendor.trim() || !item.trim() || !quantity.trim()) {
      setSubmitMessage('Vendor, item, and quantity are required.');
      return;
    }

    const parsedQty = Number(quantity);
    if (Number.isNaN(parsedQty) || parsedQty <= 0) {
      setSubmitMessage('Quantity must be a positive number.');
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.from('inventory_transactions').insert({
      transaction_type: txType,
      vendor: vendor.trim(),
      item_name: item.trim(),
      size: size.trim() || null,
      unit: unit.trim() || null,
      quantity: parsedQty,
      location: location.trim() || null,
      notes: notes.trim() || null,
    });

    if (error) {
      console.error('Failed to submit transaction:', error);
      setSubmitMessage(`Failed to submit: ${error.message}`);
      setIsSubmitting(false);
      return;
    }

    setSubmitMessage('Transaction submitted.');
    handleReset();
    setSubmitMessage('Transaction submitted.');
    setIsSubmitting(false);
  }

  function handleReset() {
    setTxType('intake');
    setVendor('');
    setItem('');
    setSize('');
    setUnit('');
    setQuantity('');
    setLocation('');
    setNotes('');
  }

  return (
    <div className="min-h-[calc(100vh-73px)] bg-black p-6 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-[#f7f0d0]">Transactions</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Log intake, outtake, or adjustments here.
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Loaded {catalogRows.length} catalog rows and {vendors.length} vendors.
          </p>
        </div>

        {loadError && (
          <div className="rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
            Failed to load transaction options: {loadError}
          </div>
        )}

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-neutral-400">
                Transaction Type
              </label>
              <select
                value={txType}
                onChange={(e) => setTxType(e.target.value)}
                className="w-full rounded border border-neutral-700 bg-neutral-900 p-3"
              >
                <option value="intake">Intake</option>
                <option value="outtake">Outtake</option>
                <option value="adjustment">Adjustment</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-neutral-400">Vendor</label>
              <select
                value={vendor}
                onChange={(e) => {
                  setVendor(e.target.value);
                  setItem('');
                  setSize('');
                  setUnit('');
                  setSubmitMessage('');
                }}
                className="w-full rounded border border-neutral-700 bg-neutral-900 p-3"
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
              <label className="mb-2 block text-sm text-neutral-400">Item Name</label>
              <input
                value={item}
                onChange={(e) => {
                  setItem(e.target.value);
                  setSize('');
                  setUnit('');
                  setSubmitMessage('');
                }}
                list="item-options"
                className="w-full rounded border border-neutral-700 bg-neutral-900 p-3"
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
              <label className="mb-2 block text-sm text-neutral-400">Size</label>
              <input
                value={size}
                onChange={(e) => {
                  setSize(e.target.value);
                  setSubmitMessage('');
                }}
                list="size-options"
                className="w-full rounded border border-neutral-700 bg-neutral-900 p-3"
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
              <label className="mb-2 block text-sm text-neutral-400">Quantity</label>
              <input
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setSubmitMessage('');
                }}
                className="w-full rounded border border-neutral-700 bg-neutral-900 p-3"
                placeholder="e.g. 20"
                inputMode="decimal"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-neutral-400">Unit</label>
              <input
                value={unit}
                onChange={(e) => {
                  setUnit(e.target.value);
                  setSubmitMessage('');
                }}
                className="w-full rounded border border-neutral-700 bg-neutral-900 p-3"
                placeholder="lb / bag / pallet"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm text-neutral-400">Location</label>
              <input
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setSubmitMessage('');
                }}
                className="w-full rounded border border-neutral-700 bg-neutral-900 p-3"
                placeholder="Warehouse A"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm text-neutral-400">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setSubmitMessage('');
                }}
                className="w-full rounded border border-neutral-700 bg-neutral-900 p-3"
                rows={4}
                placeholder="Optional context, lot note, pallet note, or appearance note"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSubmitTransaction}
              disabled={isSubmitting || isLoadingCatalog}
              className="rounded bg-yellow-600 px-4 py-2 text-black hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Transaction'}
            </button>

            <button
              onClick={() => {
                handleReset();
                setSubmitMessage('');
              }}
              className="rounded border border-neutral-700 bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-800"
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